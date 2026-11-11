import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

const CRON_SECRET = process.env.CRON_SECRET;
const ADVISORY_LOCK_ID = 918273645;

router.post('/tick', async (req: Request, res: Response) => {
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== CRON_SECRET) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } });
  }

  const client = await pool.connect();
  try {
    // Try to acquire Postgres advisory lock so overlapping calls do nothing
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [ADVISORY_LOCK_ID]);
    const acquired = lockRes.rows[0]?.acquired;

    if (!acquired) {
      return res.status(200).json({ data: { status: 'skipped', reason: 'another tick currently running' } });
    }

    const now = new Date();

    // 1. Start campaigns whose scheduled_at is due
    await client.query(`
      UPDATE campaigns
      SET status = 'running', started_at = now()
      WHERE status = 'scheduled' AND scheduled_at <= now()
    `);

    // 2. Mark entries more than 2 hours late as missed
    await client.query(`
      UPDATE daily_entries
      SET status = 'missed'
      WHERE status = 'planned' 
        AND (send_date < current_date OR (send_date = current_date AND send_time < (current_time - interval '2 hours')))
    `);

    // 3. Sweep stuck messages (in sending for over 5 minutes -> INTERRUPTED per PRD Page 11)
    await client.query(`
      UPDATE messages
      SET status = 'failed', error_code = 'INTERRUPTED', error_message = 'Sending interrupted'
      WHERE status = 'sending' AND sent_at < (now() - interval '5 minutes')
    `);

    // 4. Delete webhook_events older than 30 days
    await client.query(`
      DELETE FROM webhook_events
      WHERE received_at < (now() - interval '30 days')
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
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => {});
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  } finally {
    client.release();
  }
});

export default router;

