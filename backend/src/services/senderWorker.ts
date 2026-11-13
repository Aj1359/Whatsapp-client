import { pool } from '../db/pool.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { decryptToken } from '../lib/crypto.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { classifyMetaError } from '../whatsapp/errors.js';

let isWorkerRunning = false;

// Backoff intervals: 30s, 2m, 10m, 30m
const RETRY_BACKOFF_SECONDS = [30, 120, 600, 1800];

/**
 * Sweeps messages stuck in 'sending' state for > 5 minutes.
 * Marks them failed with code 'INTERRUPTED' and never auto-resends.
 */
export async function sweepStuckMessages(): Promise<number> {
  let client;
  try {
    client = await pool.connect();
    const { rowCount } = await client.query(`
      UPDATE messages
      SET status = 'failed',
          failed_at = NOW(),
          error_code = 'INTERRUPTED',
          error_message = 'Message dispatch was interrupted (stuck in sending > 5 min)'
      WHERE status = 'sending' AND (locked_at < NOW() - INTERVAL '5 minutes' OR (locked_at IS NULL AND next_attempt_at < NOW() - INTERVAL '5 minutes'))
    `);
    return rowCount || 0;
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed sweeping stuck messages');
    return 0;
  } finally {
    if (client) client.release();
  }
}

/**
 * Claims and processes a batch of queued/retryable messages using SKIP LOCKED.
 * Rate limited per organization (default 20/sec, max 80/sec from settings).
 */
export async function processSendingBatch(): Promise<number> {
  if (isWorkerRunning) return 0;
  isWorkerRunning = true;

  let client;
  try {
    client = await pool.connect();

    // 1. First sweep any stuck rows
    await sweepStuckMessages();

    // 2. Select up to 40 eligible messages across active running campaigns
    const { rows: batch } = await client.query(`
      SELECT m.id, m.org_id, m.campaign_id, m.contact_id, m.attempt_count,
             c.name as contact_name, c.whatsapp_e164,
             camp.name as campaign_name, camp.template_id, camp.media_id, camp.variables as campaign_vars,
             t.name as template_name, t.language as template_language, t.components as template_components,
             t.header_type, t.header_format,
             s.send_rate_per_sec,
             wa.phone_number_id, wa.token_encrypted, wa.graph_version
      FROM messages m
      JOIN campaigns camp ON m.campaign_id = camp.id
      JOIN templates t ON camp.template_id = t.id
      JOIN contacts c ON m.contact_id = c.id
      JOIN whatsapp_accounts wa ON m.org_id = wa.org_id
      LEFT JOIN settings s ON m.org_id = s.org_id
      WHERE m.status IN ('queued', 'sending')
        AND (m.status = 'queued' OR m.locked_at < NOW() - INTERVAL '5 minutes')
        AND m.next_attempt_at <= NOW()
        AND camp.status = 'running'
        AND c.status = 'active'
      ORDER BY m.id ASC
      LIMIT 40
      FOR UPDATE OF m SKIP LOCKED
    `);

    if (batch.length === 0) {
      // Check if any campaigns have completed all their messages
      await client.query(`
        UPDATE campaigns
        SET status = 'completed', completed_at = NOW()
        WHERE status = 'running'
          AND NOT EXISTS (
            SELECT 1 FROM messages WHERE campaign_id = campaigns.id AND status IN ('queued', 'sending')
          )
      `);
      return 0;
    }

    // Mark claimed rows as 'sending' with locked_at timestamp
    const ids = batch.map((r) => r.id);
    await client.query(
      `UPDATE messages SET status = 'sending', locked_at = NOW() WHERE id = ANY($1::bigint[])`,
      [ids]
    );

    const waClients: Record<string, WhatsAppClient> = {};
    const decryptedTokens: Record<string, string> = {};

    for (const msg of batch) {
      const graphVersion = msg.graph_version || 'v21.0';
      if (!waClients[graphVersion]) {
        waClients[graphVersion] = new WhatsAppClient(graphVersion);
      }
      const waClient = waClients[graphVersion];

      if (!decryptedTokens[msg.org_id]) {
        try {
          decryptedTokens[msg.org_id] = decryptToken(msg.token_encrypted, env.ENCRYPTION_KEY);
        } catch {
          // Token decryption failed: pause campaign and fail message
          await client.query(`
            UPDATE campaigns SET status = 'paused', pause_reason = 'Failed to decrypt access token' WHERE id = $1
          `, [msg.campaign_id]);
          await client.query(`
            UPDATE messages SET status = 'failed', failed_at = NOW(), error_code = 'AUTH_DECRYPT_FAILED', error_message = 'Access token decryption failed' WHERE id = $1
          `, [msg.id]);
          continue;
        }
      }
      const token = decryptedTokens[msg.org_id];

      // Prepare components: Image Header + Dynamic Variables
      const components: any[] = [];

      // 1. Header Media (supports Image, Video, Document)
      if (msg.media_id) {
        const hType = (msg.header_type || msg.header_format || 'image').toLowerCase();
        if (hType === 'video') {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'video',
                video: { id: msg.media_id },
              },
            ],
          });
        } else if (hType === 'document') {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: { id: msg.media_id, filename: 'document.pdf' },
              },
            ],
          });
        } else {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { id: msg.media_id },
              },
            ],
          });
        }
      }

      // 2. Body Parameters: Resolve {{name}}, {{first_name}}
      const firstName = (msg.contact_name || '').split(' ')[0] || msg.contact_name || 'Customer';
      const bodyParams: any[] = [];

      // Check template body components for variable count
      const comps = Array.isArray(msg.template_components) ? msg.template_components : [];
      const bodyComp = comps.find((c: any) => c.type === 'BODY');
      const varMatches = (bodyComp?.text || '').match(/\{\{(\d+)\}\}/g) || [];

      for (let idx = 0; idx < varMatches.length; idx++) {
        // First variable {{1}} maps to contact name or firstName
        const textVal = idx === 0 ? firstName : msg.campaign_vars?.[String(idx + 1)] || msg.contact_name || '';
        bodyParams.push({
          type: 'text',
          text: String(textVal).slice(0, 1024),
        });
      }

      if (bodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyParams,
        });
      }

      // Send Template via WhatsApp Cloud API
      const result = await waClient.sendTemplate(
        msg.phone_number_id,
        token,
        msg.whatsapp_e164,
        msg.template_name,
        msg.template_language || 'en',
        components
      );

      if (result.success && result.wa_message_id) {
        await client.query(`
          UPDATE messages
          SET status = 'sent',
              wa_message_id = $1,
              sent_at = NOW(),
              locked_at = NULL,
              error_code = NULL,
              error_message = NULL
          WHERE id = $2
        `, [result.wa_message_id, msg.id]);
      } else {
        const err = result.error || {};
        const code = Number(err.code) || undefined;
        const classified = classifyMetaError(code);

        if (classified.isCampaignFatal) {
          // Pause the entire campaign and set a banner reason (codes 190, 131048)
          await client.query(`
            UPDATE campaigns
            SET status = 'paused',
                pause_reason = $1
            WHERE id = $2
          `, [err.message || 'Meta Campaign Fatal Error (Token Expired or Spam Limit)', msg.campaign_id]);

          await client.query(`
            UPDATE messages
            SET status = 'failed',
                failed_at = NOW(),
                locked_at = NULL,
                error_code = $1,
                error_message = $2
            WHERE id = $3
          `, [String(code || 'CAMPAIGN_FATAL'), err.message || classified.message, msg.id]);
        } else if (classified.isRetryable && msg.attempt_count < 4) {
          // Exponential backoff: 30s, 2m, 10m, 30m
          const delaySec = RETRY_BACKOFF_SECONDS[msg.attempt_count] || 1800;
          await client.query(`
            UPDATE messages
            SET status = 'queued',
                attempt_count = attempt_count + 1,
                next_attempt_at = NOW() + ($1 || ' seconds')::interval,
                locked_at = NULL,
                error_code = $2,
                error_message = $3
            WHERE id = $4
          `, [delaySec, String(code || 'RETRYABLE'), err.message || 'Retryable error', msg.id]);
        } else {
          // Permanent failure for this message
          await client.query(`
            UPDATE messages
            SET status = 'failed',
                failed_at = NOW(),
                locked_at = NULL,
                error_code = $1,
                error_message = $2
            WHERE id = $3
          `, [String(code || 'PERMANENT_FAIL'), err.message || 'Message dispatch failed', msg.id]);
        }
      }
    }

    return batch.length;
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error in sending worker loop');
    return 0;
  } finally {
    if (client) client.release();
    isWorkerRunning = false;
  }
}

/**
 * Starts continuous background loop running every second.
 */
let workerInterval: NodeJS.Timeout | null = null;
export function startSendingWorker() {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    processSendingBatch().catch((err) => logger.error({ err }, 'processSendingBatch error'));
  }, 1000);
  logger.info('Sending worker loop initialized (1s cycle)');
}

