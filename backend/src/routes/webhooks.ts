
import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { verifyWebhookChallenge, verifyMetaSignature, isStopReply } from '../whatsapp/webhook.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'wa_verify_token_123456';
const META_APP_SECRET = process.env.META_APP_SECRET || 'meta_app_secret_placeholder';

export interface InboundReply {
  id: string;
  from_e164: string;
  from_name: string;
  body: string;
  is_stop: boolean;
  received_at: string;
  timestamp: number;
}

export const inMemoryReplies: InboundReply[] = [];
export const inMemoryStatuses: Record<string, { status: string; timestamp: string }> = {};

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

  // Only check signature if a real META_APP_SECRET is configured (prevents blocking real webhooks with placeholder)
  if (
    signature &&
    META_APP_SECRET &&
    META_APP_SECRET !== 'meta_app_secret_placeholder' &&
    !verifyMetaSignature(rawBody, signature, META_APP_SECRET)
  ) {
    console.warn('Webhook signature check failed against configured META_APP_SECRET');
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid signature' } });
  }

  // Answer 200 immediately to Meta
  res.status(200).send('EVENT_RECEIVED');

  // Background event processing
  try {
    const payload = req.body;
    console.log('Incoming Meta Webhook POST event received:', JSON.stringify(payload));
    const entries = payload?.entry || [];

    // 1. First capture in memory so UI is instantly updated
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        // Process status events
        if (Array.isArray(value.statuses)) {
          for (const statusObj of value.statuses) {
            const waId = statusObj.id;
            const status = statusObj.status;
            const ts = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();
            inMemoryStatuses[waId] = {
              status,
              timestamp: ts.toISOString(),
            };
          }
        }

        // Process inbound messages (customer replies)
        if (Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const fromE164 = '+' + msg.from;
            const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || '(Media/Unsupported)';
            const isStop = isStopReply(text);
            const ts = msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date();

            const profileName = value.contacts?.find((c: any) => c.wa_id === msg.from)?.profile?.name || fromE164;

            const replyItem: InboundReply = {
              id: msg.id || `msg_${Date.now()}`,
              from_e164: fromE164,
              from_name: profileName,
              body: text,
              is_stop: isStop,
              received_at: ts.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
              timestamp: ts.getTime(),
            };

            if (!inMemoryReplies.some((r) => r.id === replyItem.id)) {
              inMemoryReplies.unshift(replyItem);
              if (inMemoryReplies.length > 500) inMemoryReplies.pop();
            }
          }
        }
      }
    }

    // 2. Persist to DB if available
    try {
      const client = await pool.connect();
      try {
        await client.query(
          'INSERT INTO webhook_events (payload) VALUES ($1)',
          [JSON.stringify(payload)]
        );

        for (const entry of entries) {
          for (const change of entry.changes || []) {
            const value = change.value;
            if (!value) continue;

            if (Array.isArray(value.statuses)) {
              for (const statusObj of value.statuses) {
                const waId = statusObj.id;
                const status = statusObj.status;
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

            if (Array.isArray(value.messages)) {
              for (const msg of value.messages) {
                const fromE164 = '+' + msg.from;
                const text = msg.text?.body || msg.button?.text || '';
                const isStop = isStopReply(text);
                const ts = msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date();

                await client.query(`
                  INSERT INTO inbound_messages (from_e164, wa_message_id, body, is_stop, received_at)
                  VALUES ($1, $2, $3, $4, $5)
                  ON CONFLICT (wa_message_id) DO NOTHING
                `, [fromE164, msg.id, text, isStop, ts]);

                if (isStop) {
                  await client.query(`
                    UPDATE contacts
                    SET status = 'opted_out', opted_out_at = now()
                    WHERE whatsapp_e164 = $1
                  `, [fromE164]);
                }
              }
            }
          }
        }
      } finally {
        client.release();
      }
    } catch (dbErr) {
      // In-memory capture already succeeded, log db notification
      console.warn('Webhook DB persistence skipped (in-memory captured):', (dbErr as any)?.message);
    }
  } catch (err) {
    console.error('Error processing webhook payload:', err);
  }
});

export default router;
