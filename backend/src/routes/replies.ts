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

/**
 * GET /api/replies
 * Returns inbound customer message threads grouped by contact, newest first.
 * Supports filters: unread=true, handled=true/false.
 * Includes information on which campaign it answered.
 */
router.get('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { unread, handled } = req.query as Record<string, string>;

  let client;
  try {
    client = await pool.connect();

    let whereClause = `WHERE im.org_id = $1`;
    const params: any[] = [orgId];

    if (handled !== undefined) {
      params.push(handled === 'true');
      whereClause += ` AND im.handled = $${params.length}`;
    }

    const { rows } = await client.query(
      `SELECT im.id, im.org_id, im.contact_id, im.from_e164, im.wa_message_id,
              im.body, im.media, im.is_stop, im.handled, im.received_at, im.forwarded_at,
              im.matched_message_id, im.matched_campaign_id,
              c.name as contact_name,
              camp.name as matched_campaign_name
       FROM inbound_messages im
       LEFT JOIN contacts c ON im.contact_id = c.id
       LEFT JOIN campaigns camp ON im.matched_campaign_id = camp.id
       ${whereClause}
       ORDER BY im.received_at DESC
       LIMIT 200`,
      params
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

/**
 * GET /api/replies/:contactId
 * Returns the full message thread for a contact:
 * - Inbound messages
 * - Outbound replies sent from portal
 * - Campaign template messages sent
 */
router.get('/:contactId', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const contactId = parseInt(req.params.contactId, 10);

  let client;
  try {
    client = await pool.connect();

    // 1. Fetch Contact info
    const { rows: contactRows } = await client.query(
      `SELECT id, name, whatsapp_e164, status FROM contacts WHERE id = $1 AND org_id = $2`,
      [contactId, orgId]
    );
    if (contactRows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    }
    const contact = contactRows[0];

    // 2. Fetch Inbound Messages
    const { rows: inbounds } = await client.query(
      `SELECT id, 'inbound' as direction, body, media, is_stop, handled, received_at as timestamp, wa_message_id
       FROM inbound_messages
       WHERE contact_id = $1 AND org_id = $2`,
      [contactId, orgId]
    );

    // 3. Fetch Outbound 1-on-1 Replies
    const { rows: outbounds } = await client.query(
      `SELECT id, 'outbound' as direction, body, null as media, false as is_stop, true as handled,
              created_at as timestamp, wa_message_id, status, error_message
       FROM outbound_replies
       WHERE contact_id = $1 AND org_id = $2`,
      [contactId, orgId]
    );

    // 4. Fetch Campaign Template Broadcasts Sent
    const { rows: campaignMsgs } = await client.query(
      `SELECT m.id, 'campaign' as direction, t.name as body, null as media, false as is_stop, true as handled,
              m.sent_at as timestamp, m.wa_message_id, m.status, m.error_message
       FROM messages m
       JOIN campaigns camp ON m.campaign_id = camp.id
       JOIN templates t ON camp.template_id = t.id
       WHERE m.contact_id = $1 AND m.org_id = $2 AND m.sent_at IS NOT NULL`,
      [contactId, orgId]
    );

    // Combine and sort chronologically
    const thread = [...inbounds, ...outbounds, ...campaignMsgs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Check if 24-hour window is currently open
    const lastInbound = inbounds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    const isWindowOpen =
      lastInbound && new Date().getTime() - new Date(lastInbound.timestamp).getTime() < 24 * 60 * 60 * 1000;

    return res.json({
      data: {
        contact,
        is_window_open: Boolean(isWindowOpen),
        last_inbound_at: lastInbound?.timestamp || null,
        thread,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'DATABASE_ERROR', message: err.message } });
  } finally {
    if (client) client.release();
  }
});

/**
 * POST /api/replies/:contactId/send
 * Sends 1-on-1 free-form message in thread. Enforces 24-hour window.
 */
router.post('/:contactId/send', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const contactId = parseInt(req.params.contactId, 10);
  const { text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Message text is required' } });
  }

  let client;
  try {
    client = await pool.connect();

    // 1. Fetch Contact
    const { rows: cRows } = await client.query(
      `SELECT id, whatsapp_e164 FROM contacts WHERE id = $1 AND org_id = $2`,
      [contactId, orgId]
    );
    if (cRows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    }
    const to = cRows[0].whatsapp_e164;

    // 2. Enforce 24-hour customer care window
    const { rows: windowRows } = await client.query(
      `SELECT id, received_at FROM inbound_messages
       WHERE contact_id = $1 AND org_id = $2 AND received_at >= NOW() - INTERVAL '24 hours'
       ORDER BY received_at DESC LIMIT 1`,
      [contactId, orgId]
    );

    if (windowRows.length === 0) {
      return res.status(409).json({
        error: {
          code: 'WINDOW_CLOSED',
          message: 'The 24-hour customer care window is closed. Send an approved template instead.',
        },
      });
    }

    // 3. Credentials
    const { rows: accRows } = await client.query(
      `SELECT phone_number_id, token_encrypted, graph_version FROM whatsapp_accounts WHERE org_id = $1`,
      [orgId]
    );
    if (accRows.length === 0) {
      return res.status(400).json({ error: { code: 'NOT_CONFIGURED', message: 'WhatsApp account not configured' } });
    }

    const { phone_number_id, token_encrypted, graph_version } = accRows[0];
    const token = decryptToken(token_encrypted, env.ENCRYPTION_KEY);

    const clientToUse = new WhatsAppClient(graph_version || 'v21.0');
    const sendRes = await clientToUse.sendFreeForm(phone_number_id, token, to, 'text', { text: text.trim() });

    const waMsgId = sendRes.wa_message_id || null;

    // 4. Save into outbound_replies
    const { rows: outRows } = await client.query(
      `INSERT INTO outbound_replies (org_id, contact_id, to_e164, body, wa_message_id, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, 'sent', NOW())
       RETURNING *`,
      [orgId, contactId, to, text.trim(), waMsgId]
    );

    return res.status(201).json({ data: outRows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SEND_FAILED', message: err.message } });
  } finally {
    if (client) client.release();
  }
});

/**
 * POST /api/replies/:id/handled
 * Marks an inbound message inquiry as handled.
 */
router.post('/:id/handled', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rowCount } = await client.query(
      `UPDATE inbound_messages SET handled = true WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    return res.json({ data: { success: (rowCount ?? 0) > 0 } });
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/replies/forwards/log
 * Returns the forwarding audit log for settings.
 */
router.get('/forwards/log', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT f.id, f.to_e164, f.mode, f.status, f.error, f.created_at,
              im.body as customer_message,
              c.name as customer_name, c.whatsapp_e164 as customer_phone
       FROM forwards f
       LEFT JOIN inbound_messages im ON f.inbound_message_id = im.id
       LEFT JOIN contacts c ON im.contact_id = c.id
       WHERE f.org_id = $1
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [orgId]
    );
    return res.json({ data: rows });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'DATABASE_ERROR', message: err.message } });
  } finally {
    if (client) client.release();
  }
});

export default router;
