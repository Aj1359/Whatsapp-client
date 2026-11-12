import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { decryptToken } from '../lib/crypto.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { getOrgId } from './settings.js';
import { logger } from '../config/logger.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB image limit
});

// ── GET /api/campaigns ───────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT c.id, c.org_id, c.name, c.kind, c.template_id, c.list_id,
              c.image_path, c.media_id, c.variables, c.status, c.pause_reason,
              c.scheduled_at, c.started_at, c.completed_at, c.total, c.created_at,
              t.name as template_name,
              l.name as list_name,
              COUNT(m.id)::int as messages_count,
              COUNT(m.id) FILTER (WHERE m.status = 'sent')::int as sent_count,
              COUNT(m.id) FILTER (WHERE m.status = 'delivered')::int as delivered_count,
              COUNT(m.id) FILTER (WHERE m.status = 'read')::int as read_count,
              COUNT(m.id) FILTER (WHERE m.status = 'failed')::int as failed_count
       FROM campaigns c
       LEFT JOIN templates t ON c.template_id = t.id
       LEFT JOIN lists l ON c.list_id = l.id
       LEFT JOIN messages m ON c.id = m.campaign_id
       WHERE c.org_id = $1
       GROUP BY c.id, t.name, l.name
       ORDER BY c.created_at DESC`,
      [orgId]
    );

    return res.json({ data: rows, total: rows.length });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/campaigns (Create Campaign + Queue Messages) ───────────────────
router.post('/', upload.single('header_image'), async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const {
    name,
    template_id,
    list_id,
    contact_ids: contactIdsJson,
    variables: variablesJson,
    scheduled_at,
  } = req.body;

  if (!name || !template_id) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Campaign name and template_id are required' },
    });
  }

  const templateId = parseInt(template_id, 10);
  const parsedListId = list_id ? parseInt(list_id, 10) : null;
  let explicitContactIds: number[] = [];
  if (contactIdsJson) {
    try {
      explicitContactIds = typeof contactIdsJson === 'string' ? JSON.parse(contactIdsJson) : contactIdsJson;
    } catch {}
  }

  let variables: Record<string, any> = {};
  if (variablesJson) {
    try {
      variables = typeof variablesJson === 'string' ? JSON.parse(variablesJson) : variablesJson;
    } catch {}
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Verify WhatsApp Account & Credentials
    const { rows: accRows } = await client.query(
      `SELECT phone_number_id, token_encrypted, graph_version FROM whatsapp_accounts WHERE org_id = $1`,
      [orgId]
    );
    if (accRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: { code: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp account not configured' },
      });
    }

    const { phone_number_id, token_encrypted, graph_version } = accRows[0];
    const token = decryptToken(token_encrypted, env.ENCRYPTION_KEY);

    // 2. Verify Template (Must be approved)
    const { rows: tRows } = await client.query(
      `SELECT id, name, language, status, header_type, components FROM templates WHERE id = $1 AND org_id = $2`,
      [templateId, orgId]
    );
    if (tRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' },
      });
    }

    const template = tRows[0];
    if (template.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: { code: 'TEMPLATE_NOT_APPROVED', message: `Template status is '${template.status}'. Only 'approved' templates can be broadcast.` },
      });
    }

    // 3. Upload Header Image to Meta (Once per campaign) if provided
    let mediaId: string | null = null;
    if (req.file) {
      const waClient = new WhatsAppClient(graph_version || 'v21.0');
      try {
        const upRes = await waClient.uploadMedia(
          phone_number_id,
          token,
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname || 'header.jpg'
        );
        mediaId = upRes.mediaId;
      } catch (mediaErr: any) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: { code: 'MEDIA_UPLOAD_FAILED', message: `Failed to upload header image to Meta: ${mediaErr.message}` },
        });
      }
    }

    // 4. Fetch Selectable Contacts (status='active' AND opt_in_confirmed_at IS NOT NULL)
    let contactQuery = `SELECT id, whatsapp_e164 FROM contacts WHERE org_id = $1 AND status = 'active' AND opt_in_confirmed_at IS NOT NULL`;
    const qParams: any[] = [orgId];

    if (explicitContactIds.length > 0) {
      qParams.push(explicitContactIds);
      contactQuery += ` AND id = ANY($2::bigint[])`;
    } else if (parsedListId) {
      qParams.push(parsedListId);
      contactQuery = `
        SELECT c.id, c.whatsapp_e164
        FROM contacts c
        JOIN list_members lm ON c.id = lm.contact_id
        WHERE c.org_id = $1 AND lm.list_id = $2 AND c.status = 'active' AND c.opt_in_confirmed_at IS NOT NULL
      `;
    }

    const { rows: eligibleContacts } = await client.query(contactQuery, qParams);

    if (eligibleContacts.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: { code: 'NO_ELIGIBLE_CONTACTS', message: 'No active, opt-in confirmed contacts found for this audience' },
      });
    }

    // 5. Create Campaign Record
    const initialStatus = scheduled_at ? 'scheduled' : 'running';
    const { rows: campRows } = await client.query(
      `INSERT INTO campaigns (
         org_id, name, kind, template_id, list_id, media_id, variables,
         status, scheduled_at, started_at, total, created_by
       ) VALUES ($1, $2, 'broadcast', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        orgId,
        name,
        templateId,
        parsedListId || null,
        mediaId,
        JSON.stringify(variables),
        initialStatus,
        scheduled_at ? new Date(scheduled_at) : null,
        scheduled_at ? null : new Date(),
        eligibleContacts.length,
        req.auth?.userId || null,
      ]
    );

    const campaign = campRows[0];

    // 6. Bulk Insert Messages rows with status 'queued' and idempotency_key
    for (const c of eligibleContacts) {
      const idempotencyKey = `camp_${campaign.id}_c_${c.id}_1`;
      await client.query(
        `INSERT INTO messages (
           org_id, campaign_id, contact_id, idempotency_key, status, next_attempt_at
         ) VALUES ($1, $2, $3, $4, 'queued', NOW())
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [orgId, campaign.id, c.id, idempotencyKey]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      data: {
        campaign_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        total_queued: eligibleContacts.length,
        media_id: mediaId,
      },
    });
  } catch (err: any) {
    if (client) await client.query('ROLLBACK');
    logger.error({ err: err.message }, 'Failed creating campaign');
    return res.status(500).json({
      error: { code: 'CAMPAIGN_CREATE_FAILED', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/campaigns/:id/pause ───────────────────────────────────────────
router.post('/:id/pause', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rowCount } = await client.query(
      `UPDATE campaigns SET status = 'paused', pause_reason = 'Paused by user'
       WHERE id = $1 AND org_id = $2 AND status = 'running'`,
      [req.params.id, orgId]
    );
    return res.json({ data: { success: (rowCount ?? 0) > 0 } });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/campaigns/:id/resume ──────────────────────────────────────────
router.post('/:id/resume', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rowCount } = await client.query(
      `UPDATE campaigns SET status = 'running', pause_reason = NULL
       WHERE id = $1 AND org_id = $2 AND status = 'paused'`,
      [req.params.id, orgId]
    );
    return res.json({ data: { success: (rowCount ?? 0) > 0 } });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/campaigns/:id/cancel ──────────────────────────────────────────
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      `UPDATE campaigns SET status = 'cancelled' WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    await client.query(
      `UPDATE messages SET status = 'skipped', error_message = 'Campaign cancelled'
       WHERE campaign_id = $1 AND status IN ('queued', 'sending')`,
      [req.params.id]
    );
    await client.query('COMMIT');
    return res.json({ data: { success: true } });
  } catch (err: any) {
    if (client) await client.query('ROLLBACK');
    return res.status(500).json({ error: { code: 'DATABASE_ERROR', message: err.message } });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/campaigns/:id/retry-failed ────────────────────────────────────
router.post('/:id/retry-failed', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rowCount } = await client.query(
      `UPDATE messages
       SET status = 'queued', attempt_count = 0, next_attempt_at = NOW(), error_code = NULL, error_message = NULL
       WHERE campaign_id = $1 AND org_id = $2 AND status = 'failed' AND error_code != 'INTERRUPTED'`,
      [req.params.id, orgId]
    );

    // If campaign was completed or failed, reopen to running
    await client.query(
      `UPDATE campaigns SET status = 'running' WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );

    return res.json({ data: { requeued: rowCount } });
  } finally {
    if (client) client.release();
  }
});

export default router;
