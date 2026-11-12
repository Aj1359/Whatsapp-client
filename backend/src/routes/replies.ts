import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { decryptToken } from '../lib/crypto.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { getOrgId } from './settings.js';

const router = Router();
router.use(requireAuth);

const waClient = new WhatsAppClient();

// GET /api/replies — Returns inbound customer messages for caller's organization
router.get('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT im.id, im.org_id, im.contact_id, im.from_e164, im.wa_message_id,
              im.body, im.media, im.is_stop, im.handled, im.received_at, im.forwarded_at,
              c.name as contact_name
       FROM inbound_messages im
       LEFT JOIN contacts c ON im.contact_id = c.id
       WHERE im.org_id = $1
       ORDER BY im.received_at DESC
       LIMIT 100`,
      [orgId]
    );

    return res.json({
      data: rows,
      total: rows.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// POST /api/replies/send — Dispatches a direct 1-on-1 reply to a customer
const sendReplySchema = z.object({
  contact_id: z.coerce.number().optional(),
  to: z.string().min(1, 'Target recipient is required'),
  text: z.string().min(1, 'Message body is required'),
});

router.post('/send', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const parsed = sendReplySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', issues: parsed.error.issues },
    });
  }

  const { to, text, contact_id } = parsed.data;

  let client;
  try {
    client = await pool.connect();

    // 1. Fetch organization's WhatsApp credentials strictly from DB
    const { rows: accRows } = await client.query(
      `SELECT phone_number_id, token_encrypted FROM whatsapp_accounts WHERE org_id = $1`,
      [orgId]
    );

    if (accRows.length === 0) {
      return res.status(400).json({
        error: { code: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp account not configured for this organization' },
      });
    }

    const { phone_number_id, token_encrypted } = accRows[0];
    const token = decryptToken(token_encrypted, env.ENCRYPTION_KEY);

    // 2. Check 24-hour customer care window: customer must have messaged in last 24h
    const { rows: windowRows } = await client.query(
      `SELECT id, received_at FROM inbound_messages
       WHERE org_id = $1 AND from_e164 = $2 AND received_at >= NOW() - INTERVAL '24 hours'
       ORDER BY received_at DESC LIMIT 1`,
      [orgId, to]
    );

    if (windowRows.length === 0) {
      return res.status(409).json({
        error: {
          code: 'WINDOW_CLOSED',
          message: 'The 24-hour customer care window is closed. You must send an approved template instead.',
        },
      });
    }

    // 3. Dispatch text message via Meta Cloud API using sendFreeForm
    const metaRes = await waClient.sendFreeForm(
      phone_number_id,
      token,
      to,
      'text',
      { text }
    );

    const waMsgId = metaRes.wa_message_id || null;

    // 4. Save outbound reply to outbound_replies table
    if (contact_id) {
      await client.query(
        `INSERT INTO outbound_replies (org_id, contact_id, to_e164, body, wa_message_id, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, 'sent', NOW())`,
        [orgId, contact_id, to, text, waMsgId]
      );
    }

    return res.json({
      data: {
        success: true,
        wa_message_id: waMsgId,
        sent_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'SEND_FAILED', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

export default router;
