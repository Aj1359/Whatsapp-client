import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { sweepStuckMessages, processSendingBatch } from '../services/senderWorker.js';
import { syncTemplatesForOrg } from './templates.js';
import { forwardInbound } from '../services/forwardingService.js';
import { processFollowUpSequences } from '../services/sequenceService.js';

const router = Router();

const ADVISORY_LOCK_ID = 918273645;
let lastTemplateSyncAt = 0;

/**
 * POST /internal/tick
 * Protected by X-Cron-Secret header and pg_try_advisory_lock.
 * Safe to be pinged every minute by external cron (Render cron, GitHub Actions, Cloudflare Worker).
 *
 * Operations:
 * 1. Start scheduled campaigns whose scheduled_at is due.
 * 2. Convert today's planned daily_entries into active campaigns.
 * 3. Mark daily_entries more than 2 hours late as 'missed'.
 * 4. Sweep stuck messages (stuck in 'sending' > 5 min -> INTERRUPTED).
 * 5. Run sending worker batch.
 * 6. Process follow-up sequences.
 * 7. Retry failed forwards (up to 3 times).
 * 8. Sync templates every 30 minutes.
 * 9. Delete webhook_events older than 30 days.
 */
router.post('/tick', async (req: Request, res: Response) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;

  if (!secret || secret !== env.CRON_SECRET) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED_CRON', message: 'Missing or invalid X-Cron-Secret header' },
    });
  }

  let client;
  try {
    client = await pool.connect();
    // Try to acquire Postgres advisory lock so concurrent ticks do nothing
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [ADVISORY_LOCK_ID]);
    const acquired = lockRes.rows[0]?.acquired;

    if (!acquired) {
      return res.status(200).json({ data: { status: 'skipped', reason: 'another tick currently in progress' } });
    }

    const now = new Date();

    // 1. Start scheduled campaigns whose scheduled_at is due
    await client.query(`
      UPDATE campaigns
      SET status = 'running', started_at = NOW()
      WHERE status = 'scheduled' AND scheduled_at <= NOW()
    `);

    // 2. Convert today's planned daily_entries into campaigns
    const { rows: dueEntries } = await client.query(`
      SELECT de.id, de.org_id, de.template_id, de.list_id, de.variables, de.image_path,
             t.name as template_name
      FROM daily_entries de
      JOIN templates t ON de.template_id = t.id
      WHERE de.status = 'planned'
        AND de.send_date = CURRENT_DATE
        AND de.send_time <= CURRENT_TIME
        AND de.send_time >= (CURRENT_TIME - INTERVAL '2 hours')
    `);

    for (const entry of dueEntries) {
      // Fetch selectable contacts
      const { rows: contacts } = await client.query(`
        SELECT c.id FROM contacts c
        JOIN list_members lm ON c.id = lm.contact_id
        WHERE c.org_id = $1 AND lm.list_id = $2 AND c.status = 'active' AND c.opt_in_confirmed_at IS NOT NULL
      `, [entry.org_id, entry.list_id]);

      if (contacts.length > 0) {
        // Create campaign
        const campRes = await client.query(`
          INSERT INTO campaigns (
            org_id, name, kind, template_id, list_id, variables, status, started_at, total
          ) VALUES ($1, $2, 'daily', $3, $4, $5, 'running', NOW(), $6)
          RETURNING id
        `, [
          entry.org_id,
          `Daily: ${entry.template_name} (${now.toISOString().slice(0, 10)})`,
          entry.template_id,
          entry.list_id,
          entry.variables ? JSON.stringify(entry.variables) : null,
          contacts.length,
        ]);

        const campaignId = campRes.rows[0].id;

        // Insert messages
        for (const c of contacts) {
          await client.query(`
            INSERT INTO messages (org_id, campaign_id, contact_id, idempotency_key, status, next_attempt_at)
            VALUES ($1, $2, $3, $4, 'queued', NOW())
            ON CONFLICT (idempotency_key) DO NOTHING
          `, [entry.org_id, campaignId, c.id, `daily_${entry.id}_c_${c.id}`]);
        }

        // Mark daily entry as sent
        await client.query(`
          UPDATE daily_entries SET status = 'sent', campaign_id = $1 WHERE id = $2
        `, [campaignId, entry.id]);
      } else {
        await client.query(`UPDATE daily_entries SET status = 'skipped' WHERE id = $1`, [entry.id]);
      }
    }

    // 3. Mark entries more than 2 hours late as 'missed'
    await client.query(`
      UPDATE daily_entries
      SET status = 'missed'
      WHERE status = 'planned'
        AND (send_date < CURRENT_DATE OR (send_date = CURRENT_DATE AND send_time < (CURRENT_TIME - INTERVAL '2 hours')))
    `);

    // 4. Sweep stuck messages
    await sweepStuckMessages();

    // 5. Run sending batch
    await processSendingBatch();

    // 6. Process follow-up sequences
    await processFollowUpSequences();

    // 7. Retry failed forwards (up to 3 times)
    const { rows: failedForwards } = await client.query(`
      SELECT f.id, f.org_id, f.inbound_message_id, COUNT(f.id) as attempts
      FROM forwards f
      WHERE f.status = 'failed'
        AND f.created_at >= NOW() - INTERVAL '6 hours'
        AND f.inbound_message_id IS NOT NULL
      GROUP BY f.id, f.org_id, f.inbound_message_id
      HAVING COUNT(f.id) < 3
      LIMIT 10
    `);

    for (const fwd of failedForwards) {
      if (fwd.inbound_message_id) {
        await forwardInbound(fwd.org_id, fwd.inbound_message_id).catch(() => {});
      }
    }

    // 8. Sync templates every 30 minutes
    const THIRTY_MINUTES_MS = 30 * 60 * 1000;
    if (Date.now() - lastTemplateSyncAt > THIRTY_MINUTES_MS) {
      lastTemplateSyncAt = Date.now();
      const { rows: activeOrgs } = await client.query(`SELECT org_id FROM whatsapp_accounts`);
      for (const org of activeOrgs) {
        await syncTemplatesForOrg(org.org_id).catch((err) =>
          logger.warn({ err: err.message, orgId: org.org_id }, 'Tick template sync warning')
        );
      }
    }

    // 9. Delete webhook_events older than 30 days
    await client.query(`
      DELETE FROM webhook_events
      WHERE received_at < (NOW() - INTERVAL '30 days')
    `);

    // Release advisory lock
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);

    return res.status(200).json({
      data: {
        status: 'ok',
        timestamp: now.toISOString(),
      },
    });
  } catch (err: any) {
    if (client) {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => {});
    }
    logger.error({ err: err.message }, 'Error in /internal/tick execution');
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  } finally {
    if (client) client.release();
  }
});

// GET /internal/ping for simple platform keep-alive
router.get('/ping', (_req: Request, res: Response) => {
  res.status(200).send('PONG');
});

export default router;
