import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { verifyWebhookChallenge, verifyMetaSignature, isStopReply } from '../whatsapp/webhook.js';
import { env } from '../config/env.js';
import { decryptToken } from '../lib/crypto.js';
import { maskPhoneNumber } from '../lib/phone.js';
import { logger } from '../config/logger.js';

const router = Router();

// GET /webhooks/whatsapp — Handshake verification using strict WEBHOOK_VERIFY_TOKEN
router.get('/whatsapp', (req: Request, res: Response) => {
  const query = req.query as any;
  const result = verifyWebhookChallenge(query, env.WEBHOOK_VERIFY_TOKEN);
  if (result.isValid && result.challenge) {
    return res.status(200).send(result.challenge);
  }
  return res.status(403).send('Forbidden');
});

// POST /webhooks/whatsapp — Incoming Meta events
router.post('/whatsapp', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody: Buffer | string = (req as any).rawBody || JSON.stringify(req.body);

  if (!signature) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Missing webhook signature header' } });
  }

  const payload = req.body;
  const entries = payload?.entry || [];
  let phoneNumberId: string | null = null;

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.value?.metadata?.phone_number_id) {
        phoneNumberId = String(change.value.metadata.phone_number_id);
        break;
      }
    }
    if (phoneNumberId) break;
  }

  let orgId: string | null = null;
  let customAppSecret: string | null = null;

  let client;
  try {
    client = await pool.connect();
    if (phoneNumberId) {
      const { rows } = await client.query(
        `SELECT org_id, app_secret_encrypted FROM whatsapp_accounts WHERE phone_number_id = $1`,
        [phoneNumberId]
      );
      if (rows.length > 0) {
        orgId = rows[0].org_id;
        if (rows[0].app_secret_encrypted) {
          try {
            customAppSecret = decryptToken(rows[0].app_secret_encrypted, env.ENCRYPTION_KEY);
          } catch {
            customAppSecret = null;
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed looking up whatsapp account for webhook phone');
  } finally {
    if (client) client.release();
  }

  // Verify HMAC-SHA256 signature using org app secret or global META_APP_SECRET
  const secretToVerify = customAppSecret || env.META_APP_SECRET;
  const isValidSignature = verifyMetaSignature(rawBody, signature, secretToVerify);

  if (!isValidSignature) {
    logger.warn('Webhook signature check failed with timing-safe HMAC');
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid webhook signature' } });
  }

  // Answer 200 immediately to Meta
  res.status(200).send('EVENT_RECEIVED');

  // Background processing
  setImmediate(async () => {
    let dbClient;
    try {
      dbClient = await pool.connect();

      // 1. Audit event payload (do not log bodies to stdout/console)
      await dbClient.query(
        `INSERT INTO webhook_events (org_id, payload, processed_at) VALUES ($1, $2, NOW())`,
        [orgId, JSON.stringify(payload)]
      );

      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value = change.value;
          const field = change.field;

          // A. Process message_template_status_update events
          if (field === 'message_template_status_update') {
            const templateName = value?.message_template_name;
            const templateLanguage = value?.message_template_language || 'en';
            const event = (value?.event || '').toLowerCase(); // APPROVED, REJECTED, PAUSED, etc.
            const reason = value?.reason || null;

            if (orgId && templateName) {
              await dbClient.query(
                `UPDATE templates
                 SET status = $1, rejection_reason = $2, updated_at = NOW()
                 WHERE org_id = $3 AND name = $4 AND language = $5`,
                [event, reason, orgId, templateName, templateLanguage]
              );
            }
            continue;
          }

          // B. Status events: update messages, outbound_replies, forwards in strict order
          if (Array.isArray(value?.statuses)) {
            for (const statusObj of value.statuses) {
              const waId = statusObj.id;
              const status = statusObj.status; // sent, delivered, read, failed
              const ts = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

              if (status === 'failed') {
                const errCode = String(statusObj.errors?.[0]?.code || 'UNKNOWN');
                const errMsg = String(statusObj.errors?.[0]?.title || statusObj.errors?.[0]?.message || 'Message failed');

                // 'failed' always wins
                await dbClient.query(
                  `UPDATE messages
                   SET status = 'failed', failed_at = $1, error_code = $2, error_message = $3
                   WHERE wa_message_id = $4`,
                  [ts, errCode, errMsg, waId]
                );

                await dbClient.query(
                  `UPDATE outbound_replies
                   SET status = 'failed', error_code = $1, error_message = $2
                   WHERE wa_message_id = $3`,
                  [errCode, errMsg, waId]
                );

                await dbClient.query(
                  `UPDATE forwards
                   SET status = 'failed', error = $1
                   WHERE wa_message_id = $2`,
                  [errMsg, waId]
                );
              } else if (status === 'read') {
                // Sent -> Delivered -> Read (Read wins over sent/delivered)
                await dbClient.query(
                  `UPDATE messages
                   SET status = 'read', read_at = $1
                   WHERE wa_message_id = $2 AND status != 'failed'`,
                  [ts, waId]
                );

                await dbClient.query(
                  `UPDATE outbound_replies
                   SET status = 'read', read_at = $1
                   WHERE wa_message_id = $2 AND status != 'failed'`,
                  [ts, waId]
                );
              } else if (status === 'delivered') {
                // Delivered wins over queued/sending/sent, but never overwrites read or failed
                await dbClient.query(
                  `UPDATE messages
                   SET status = CASE WHEN status = 'read' THEN 'read' ELSE 'delivered' END,
                       delivered_at = $1
                   WHERE wa_message_id = $2 AND status != 'failed'`,
                  [ts, waId]
                );

                await dbClient.query(
                  `UPDATE outbound_replies
                   SET status = CASE WHEN status = 'read' THEN 'read' ELSE 'delivered' END,
                       delivered_at = $1
                   WHERE wa_message_id = $2 AND status != 'failed'`,
                  [ts, waId]
                );
              } else if (status === 'sent') {
                // Sent only updates if still queued or sending
                await dbClient.query(
                  `UPDATE messages
                   SET status = CASE WHEN status IN ('delivered', 'read') THEN status ELSE 'sent' END,
                       sent_at = $1
                   WHERE wa_message_id = $2 AND status != 'failed'`,
                  [ts, waId]
                );

                await dbClient.query(
                  `UPDATE outbound_replies
                   SET status = CASE WHEN status IN ('delivered', 'read') THEN status ELSE 'sent' END,
                       sent_at = $1
                   WHERE wa_message_id = $2 AND status != 'failed'`,
                  [ts, waId]
                );
              }
            }
          }

          // C. Inbound customer messages
          if (Array.isArray(value?.messages)) {
            for (const msg of value.messages) {
              const fromE164 = '+' + msg.from;
              logger.info(`Processing inbound message from masked: ${maskPhoneNumber(fromE164)}`);

              let bodyText = '';
              let mediaJson: any = null;

              if (msg.text?.body) {
                bodyText = msg.text.body;
              } else if (msg.button?.text) {
                bodyText = msg.button.text;
              } else if (msg.interactive?.button_reply?.title) {
                bodyText = msg.interactive.button_reply.title;
              } else if (msg.interactive?.list_reply?.title) {
                bodyText = msg.interactive.list_reply.title;
              } else if (msg.image) {
                bodyText = '[image]';
                mediaJson = msg.image;
              } else if (msg.video) {
                bodyText = '[video]';
                mediaJson = msg.video;
              } else if (msg.document) {
                bodyText = '[document]';
                mediaJson = msg.document;
              } else if (msg.audio) {
                bodyText = '[audio]';
                mediaJson = msg.audio;
              } else {
                bodyText = `[${msg.type || 'unknown'}]`;
              }

              const isStop = isStopReply(bodyText);
              const ts = msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date();

              if (!orgId) {
                logger.warn('Skipping inbound message because no organization matched metadata phone_number_id');
                continue;
              }

              // 1. Upsert contact if unknown
              const contactName = value.contacts?.find((c: any) => c.wa_id === msg.from)?.profile?.name || fromE164;
              const contactRes = await dbClient.query(
                `INSERT INTO contacts (org_id, name, whatsapp_e164, status, opt_in_confirmed_at, opt_in_source)
                 VALUES ($1, $2, $3, 'active', NOW(), 'inbound_message')
                 ON CONFLICT (org_id, whatsapp_e164) DO UPDATE SET
                   updated_at = NOW()
                 RETURNING id`,
                [orgId, contactName, fromE164]
              );
              const contactId = contactRes.rows[0]?.id || null;

              // 2. Link to latest message sent to this contact
              let matchedMessageId: number | null = null;
              let matchedCampaignId: number | null = null;
              if (contactId) {
                const latestMsg = await dbClient.query(
                  `SELECT id, campaign_id FROM messages
                   WHERE org_id = $1 AND contact_id = $2
                   ORDER BY sent_at DESC NULLS LAST LIMIT 1`,
                  [orgId, contactId]
                );
                if (latestMsg.rows.length > 0) {
                  matchedMessageId = latestMsg.rows[0].id;
                  matchedCampaignId = latestMsg.rows[0].campaign_id;
                }
              }

              // 3. Insert inbound message (deduplicated by wa_message_id)
              const insertInbound = await dbClient.query(
                `INSERT INTO inbound_messages (
                   org_id, contact_id, from_e164, wa_message_id, body, media, is_stop, handled,
                   matched_message_id, matched_campaign_id, received_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10)
                 ON CONFLICT (wa_message_id) DO NOTHING
                 RETURNING id`,
                [
                  orgId,
                  contactId,
                  fromE164,
                  msg.id,
                  bodyText,
                  mediaJson ? JSON.stringify(mediaJson) : null,
                  isStop,
                  matchedMessageId,
                  matchedCampaignId,
                  ts,
                ]
              );

              // 4. Handle STOP: Scope STRICTLY to this organization's contact only
              if (isStop) {
                await dbClient.query(
                  `UPDATE contacts
                   SET status = 'opted_out', opted_out_at = NOW(), updated_at = NOW()
                   WHERE org_id = $1 AND whatsapp_e164 = $2`,
                  [orgId, fromE164]
                );

                if (contactId) {
                  await dbClient.query(
                    `UPDATE messages
                     SET status = 'skipped', error_code = 'OPTED_OUT', error_message = 'Contact opted out'
                     WHERE org_id = $1 AND contact_id = $2 AND status = 'queued'`,
                    [orgId, contactId]
                  );
                }
              }

              // 5. Trigger forwardInbound (implemented in Stage 8) if new row was inserted
              const inboundId = insertInbound.rows[0]?.id;
              if (inboundId && (global as any).forwardInbound) {
                try {
                  await (global as any).forwardInbound(orgId, inboundId);
                } catch (fwdErr: any) {
                  logger.warn({ err: fwdErr.message }, 'forwardInbound invocation warning');
                }
              }
            }
          }
        }
      }
    } catch (processErr: any) {
      logger.error({ err: processErr.message }, 'Error in async webhook event processing');
    } finally {
      if (dbClient) dbClient.release();
    }
  });
});

export default router;
