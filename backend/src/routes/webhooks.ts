import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { verifyWebhookChallenge, verifyMetaSignature, isStopReply } from '../whatsapp/webhook.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'wa_verify_token_123456';
const META_APP_SECRET = process.env.META_APP_SECRET || 'meta_app_secret_placeholder';

// GET /webhooks/whatsapp — Handshake verification
router.get('/whatsapp', (req: Request, res: Response) => {
  const query = req.query as any;
  const result = verifyWebhookChallenge(query, VERIFY_TOKEN);
  if (result.isValid && result.challenge) {
    return res.status(200).send(result.challenge);
  }
  return res.status(403).send('Forbidden');
});

// POST /webhooks/whatsapp — Incoming events
router.post('/whatsapp', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  // Quick signature check
  if (signature && !verifyMetaSignature(rawBody, signature, META_APP_SECRET)) {
    console.warn('Webhook signature check failed');
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid signature' } });
  }

  // PRD Page 11: store payload in webhook_events, answer 200 immediately, then process
  res.status(200).send('EVENT_RECEIVED');

  // Background event processing
  try {
    const payload = req.body;
    const client = await pool.connect();
    try {
      // 1. Store raw payload
      await client.query(
        'INSERT INTO webhook_events (payload) VALUES ($1)',
        [JSON.stringify(payload)]
      );

      const entries = payload?.entry || [];
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value) continue;

          // Status updates (sent -> delivered -> read; failed always wins)
          if (Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              const waId = statusObj.id;
              const status = statusObj.status; // sent | delivered | read | failed
              const ts = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

              if (status === 'read') {
                await client.query(`
                  UPDATE messages
                  SET status = 'read', read_at = $1
                  WHERE wa_message_id = $2 AND status != 'failed'
                `, [ts, waId]);
              } else if (status === 'delivered') {
                await client.query(`
                  UPDATE messages
                  SET status = CASE WHEN status = 'read' THEN 'read' ELSE 'delivered' END,
                      delivered_at = $1
                  WHERE wa_message_id = $2 AND status != 'failed'
                `, [ts, waId]);
              } else if (status === 'sent') {
                await client.query(`
                  UPDATE messages
                  SET status = CASE WHEN status IN ('delivered', 'read') THEN status ELSE 'sent' END,
                      sent_at = $1
                  WHERE wa_message_id = $2 AND status != 'failed'
                `, [ts, waId]);
              } else if (status === 'failed') {
                const errCode = statusObj.errors?.[0]?.code || 'UNKNOWN';
                const errMsg = statusObj.errors?.[0]?.title || 'Message failed';
                await client.query(`
                  UPDATE messages
                  SET status = 'failed', failed_at = $1, error_code = $2, error_message = $3
                  WHERE wa_message_id = $4
                `, [ts, errCode, errMsg, waId]);
              }
            }
          }

          // Inbound customer replies
          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              const fromE164 = '+' + msg.from;
              const text = msg.text?.body || '';
              const isStop = isStopReply(text);
              const ts = msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date();

              // Insert into inbound_messages
              await client.query(`
                INSERT INTO inbound_messages (from_e164, wa_message_id, body, is_stop, received_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (wa_message_id) DO NOTHING
              `, [fromE164, msg.id, text, isStop, ts]);

              if (isStop) {
                // Opt out the contact
                await client.query(`
                  UPDATE contacts
                  SET status = 'opted_out', opted_out_at = now()
                  WHERE whatsapp_e164 = $1
                `, [fromE164]);

                // Skip their queued messages
                await client.query(`
                  UPDATE messages
                  SET status = 'skipped'
                  WHERE contact_id IN (SELECT id FROM contacts WHERE whatsapp_e164 = $1)
                    AND status = 'queued'
                `, [fromE164]);

                // Exit sequence states
                await client.query(`
                  UPDATE sequence_state
                  SET status = 'exited_optout'
                  WHERE contact_id IN (SELECT id FROM contacts WHERE whatsapp_e164 = $1)
                    AND status = 'active'
                `, [fromE164]);
              } else {
                // Any other reply exits active sequence with exited_reply
                await client.query(`
                  UPDATE sequence_state
                  SET status = 'exited_reply'
                  WHERE contact_id IN (SELECT id FROM contacts WHERE whatsapp_e164 = $1)
                    AND status = 'active'
                `, [fromE164]);
              }
            }
          }
        }
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error processing webhook payload:', err);
  }
});

export default router;

