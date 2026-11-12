import { pool } from '../db/pool.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { decryptToken } from '../lib/crypto.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { maskPhoneNumber } from '../lib/phone.js';

/**
 * Forwards an inbound customer reply to the organization owner's personal WhatsApp number.
 *
 * Rules:
 * 1. Ignore if sender number equals the personal number (loop guard).
 * 2. If forwarding enabled, send alert:
 *    - Mode 1 (Utility Template): If forward_template_name is set, sends the approved template with 3 parameters:
 *      {{1}} customer name, {{2}} customer number, {{3}} cleaned message text (cut to 900 chars).
 *    - Mode 2 (Freeform): Only works if personal number messaged the business number within the last 24h.
 * 3. Log results to 'forwards' table.
 */
export async function forwardInbound(orgId: string, inboundMessageId: number): Promise<void> {
  let client;
  try {
    client = await pool.connect();

    // 1. Fetch organization's forwarding settings and WhatsApp account
    const { rows: accRows } = await client.query(
      `SELECT phone_number_id, token_encrypted, graph_version,
              forward_enabled, forward_to_e164, forward_template_name, forward_template_language
       FROM whatsapp_accounts
       WHERE org_id = $1`,
      [orgId]
    );

    if (accRows.length === 0) return;
    const acc = accRows[0];
    if (!acc.forward_enabled || !acc.forward_to_e164) return;

    // 2. Fetch the inbound message details
    const { rows: inRows } = await client.query(
      `SELECT im.id, im.from_e164, im.body, c.name as contact_name
       FROM inbound_messages im
       LEFT JOIN contacts c ON im.contact_id = c.id
       WHERE im.id = $1 AND im.org_id = $2`,
      [inboundMessageId, orgId]
    );

    if (inRows.length === 0) return;
    const msg = inRows[0];

    // Loop guard: Never forward message if sender equals the destination personal number
    const personalNumber = acc.forward_to_e164.trim();
    if (msg.from_e164.trim() === personalNumber) {
      await client.query(
        `INSERT INTO forwards (org_id, inbound_message_id, to_e164, mode, status, error)
         VALUES ($1, $2, $3, 'freeform', 'skipped', 'Loop guard: Sender equals personal number')`,
        [orgId, inboundMessageId, personalNumber]
      );
      return;
    }

    const token = decryptToken(acc.token_encrypted, env.ENCRYPTION_KEY);
    const waClient = new WhatsAppClient(acc.graph_version || 'v21.0');

    // Clean customer message text: strip newlines/tabs, collapse runs of spaces, cut to 900 chars
    const cleanedText = (msg.body || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 900);

    const customerName = msg.contact_name || msg.from_e164;
    const customerPhone = msg.from_e164;

    if (acc.forward_template_name) {
      // ── MODE 1: Approved Utility Template ──
      const components = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName },
            { type: 'text', text: customerPhone },
            { type: 'text', text: cleanedText || '(No text)' },
          ],
        },
      ];

      const res = await waClient.sendTemplate(
        acc.phone_number_id,
        token,
        personalNumber,
        acc.forward_template_name,
        acc.forward_template_language || 'en',
        components
      );

      if (res.success && res.wa_message_id) {
        await client.query(
          `INSERT INTO forwards (org_id, inbound_message_id, to_e164, mode, status, wa_message_id)
           VALUES ($1, $2, $3, 'template', 'sent', $4)`,
          [orgId, inboundMessageId, personalNumber, res.wa_message_id]
        );
        await client.query(`UPDATE inbound_messages SET forwarded_at = NOW() WHERE id = $1`, [inboundMessageId]);
        logger.info(`Forwarded inbound inquiry to personal number ${maskPhoneNumber(personalNumber)} via template`);
      } else {
        await client.query(
          `INSERT INTO forwards (org_id, inbound_message_id, to_e164, mode, status, error)
           VALUES ($1, $2, $3, 'template', 'failed', $4)`,
          [orgId, inboundMessageId, personalNumber, res.error?.message || 'Template forward failed']
        );
      }
    } else {
      // ── MODE 2: Free-form Text (Valid only if personal number messaged business in last 24h) ──
      const { rows: windowCheck } = await client.query(
        `SELECT id FROM inbound_messages
         WHERE org_id = $1 AND from_e164 = $2 AND received_at >= NOW() - INTERVAL '24 hours'`,
        [orgId, personalNumber]
      );

      if (windowCheck.length === 0) {
        await client.query(
          `INSERT INTO forwards (org_id, inbound_message_id, to_e164, mode, status, error)
           VALUES ($1, $2, $3, 'freeform', 'failed', 'Personal number has no open 24h customer care window with business')`,
          [orgId, inboundMessageId, personalNumber]
        );
        logger.warn(`Forwarding skipped for ${maskPhoneNumber(personalNumber)}: no open 24h window and no template configured`);
        return;
      }

      const alertBody = `🔔 New WhatsApp Inquiry from ${customerName} (${customerPhone}):\n\n"${cleanedText}"`;
      try {
        const res = await waClient.sendFreeForm(
          acc.phone_number_id,
          token,
          personalNumber,
          'text',
          { text: alertBody }
        );

        await client.query(
          `INSERT INTO forwards (org_id, inbound_message_id, to_e164, mode, status, wa_message_id)
           VALUES ($1, $2, $3, 'freeform', 'sent', $4)`,
          [orgId, inboundMessageId, personalNumber, res.wa_message_id]
        );
        await client.query(`UPDATE inbound_messages SET forwarded_at = NOW() WHERE id = $1`, [inboundMessageId]);
      } catch (freeErr: any) {
        await client.query(
          `INSERT INTO forwards (org_id, inbound_message_id, to_e164, mode, status, error)
           VALUES ($1, $2, $3, 'freeform', 'failed', $4)`,
          [orgId, inboundMessageId, personalNumber, freeErr.message || 'Freeform dispatch failed']
        );
      }
    }
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error in forwardInbound execution');
  } finally {
    if (client) client.release();
  }
}

// Attach to global so webhooks can trigger without circular import
(global as any).forwardInbound = forwardInbound;

