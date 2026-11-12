import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { decryptToken } from '../lib/crypto.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { getOrgId } from './settings.js';
import { logger } from '../config/logger.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/dashboard
 * Live, real counts only:
 * - Connected display_phone, verified_name, quality_rating, waba_id from whatsapp_accounts (refreshed via testConnection)
 * - Total contacts, active contacts
 * - Messages today
 * - Last campaign result
 * - Active banners (token error, missing template, forwarding problem)
 */
router.get('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();

    // 1. WhatsApp Account details
    const { rows: accRows } = await client.query(
      `SELECT phone_number_id, waba_id, token_encrypted, display_phone, verified_name,
              quality_rating, forward_enabled, forward_to_e164, forward_template_name, updated_at
       FROM whatsapp_accounts
       WHERE org_id = $1`,
      [orgId]
    );

    let waAccount: any = null;
    const banners: Array<{ type: 'warning' | 'error' | 'info'; message: string }> = [];

    if (accRows.length > 0) {
      const acc = accRows[0];
      waAccount = {
        is_connected: true,
        phone_number_id: acc.phone_number_id,
        waba_id: acc.waba_id,
        display_phone: acc.display_phone,
        verified_name: acc.verified_name,
        quality_rating: acc.quality_rating,
        updated_at: acc.updated_at,
      };

      // Test connection check to refresh status and detect token issues
      try {
        const token = decryptToken(acc.token_encrypted, env.ENCRYPTION_KEY);
        const waClient = new WhatsAppClient();
        const liveInfo = await waClient.testConnection(acc.phone_number_id, token);

        waAccount.display_phone = liveInfo.display_phone_number || waAccount.display_phone;
        waAccount.verified_name = liveInfo.verified_name || waAccount.verified_name;
        waAccount.quality_rating = liveInfo.quality_rating || waAccount.quality_rating;
      } catch (connErr: any) {
        banners.push({
          type: 'error',
          message: `WhatsApp Token Error: ${connErr.message || 'Access token invalid or expired on Meta.'}`,
        });
      }

      // Check forwarding status
      if (acc.forward_enabled) {
        if (!acc.forward_to_e164) {
          banners.push({
            type: 'warning',
            message: 'Forwarding is enabled but no personal WhatsApp phone number is configured.',
          });
        }
      }
    } else {
      waAccount = { is_connected: false };
      banners.push({
        type: 'warning',
        message: 'No WhatsApp Business Profile connected. Connect your account in Profile & Meta Connector.',
      });
    }

    // 2. Real Contact Counts
    const { rows: contactCounts } = await client.query(
      `SELECT
         COUNT(*)::int as total_contacts,
         COUNT(*) FILTER (WHERE status = 'active' AND opt_in_confirmed_at IS NOT NULL)::int as active_contacts,
         COUNT(*) FILTER (WHERE status = 'opted_out')::int as opted_out_contacts
       FROM contacts
       WHERE org_id = $1`,
      [orgId]
    );

    // 3. Messages Today Counts (real DB timestamps)
    const { rows: todayCounts } = await client.query(
      `SELECT
         COUNT(*)::int as total_today,
         COUNT(*) FILTER (WHERE status = 'sent')::int as sent_today,
         COUNT(*) FILTER (WHERE status = 'delivered')::int as delivered_today,
         COUNT(*) FILTER (WHERE status = 'read')::int as read_today,
         COUNT(*) FILTER (WHERE status = 'failed')::int as failed_today
       FROM messages
       WHERE org_id = $1 AND queued_at >= CURRENT_DATE`,
      [orgId]
    );

    // 4. Overall All-Time Messages Counts
    const { rows: overallCounts } = await client.query(
      `SELECT
         COUNT(*)::int as total_messages,
         COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read'))::int as total_dispatched,
         COUNT(*) FILTER (WHERE status IN ('delivered', 'read'))::int as total_delivered,
         COUNT(*) FILTER (WHERE status = 'read')::int as total_read,
         COUNT(*) FILTER (WHERE status = 'failed')::int as total_failed
       FROM messages
       WHERE org_id = $1`,
      [orgId]
    );

    // 5. Last Campaign Result
    const { rows: lastCampRows } = await client.query(
      `SELECT c.id, c.name, c.status, c.started_at, c.completed_at, c.total,
              t.name as template_name,
              COUNT(m.id) FILTER (WHERE m.status IN ('delivered', 'read'))::int as delivered_count,
              COUNT(m.id) FILTER (WHERE m.status = 'read')::int as read_count,
              COUNT(m.id) FILTER (WHERE m.status = 'failed')::int as failed_count
       FROM campaigns c
       LEFT JOIN templates t ON c.template_id = t.id
       LEFT JOIN messages m ON c.id = m.campaign_id
       WHERE c.org_id = $1
       GROUP BY c.id, t.name
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [orgId]
    );

    return res.json({
      data: {
        account: waAccount,
        contacts: contactCounts[0] || { total_contacts: 0, active_contacts: 0, opted_out_contacts: 0 },
        today: todayCounts[0] || { total_today: 0, sent_today: 0, delivered_today: 0, read_today: 0, failed_today: 0 },
        overall: overallCounts[0] || { total_messages: 0, total_dispatched: 0, total_delivered: 0, total_read: 0, total_failed: 0 },
        last_campaign: lastCampRows[0] || null,
        banners,
      },
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed computing /api/dashboard stats');
    return res.status(500).json({
      error: { code: 'DASHBOARD_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

export default router;

