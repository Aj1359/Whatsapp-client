/**
 * Meta webhook handler:
 * - GET  /webhook  → verify token (required by Meta)
 * - POST /webhook  → receive status updates (sent/delivered/read/failed) + inbound messages
 */
import { Router } from 'express';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';

const router = Router();

// ── GET /webhook  — Meta verification challenge ───────────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook verified by Meta');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// ── POST /webhook  — receive status updates ───────────────────────────────────
router.post('/', async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.status(200).send('OK');

  try {
    const body = req.body;
    const entries: any[] = body?.entry ?? [];

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};

        // Status updates
        for (const statusUpdate of value.statuses ?? []) {
          await handleStatusUpdate(statusUpdate);
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Webhook processing error');
  }
});

async function handleStatusUpdate(update: any) {
  const waMessageId: string = update.id;
  const status: string = update.status?.toUpperCase(); // sent | delivered | read | failed
  const ts = update.timestamp ? new Date(parseInt(update.timestamp, 10) * 1000).toISOString() : new Date().toISOString();

  if (!waMessageId || !status) return;

  const dbStatus = mapStatus(status);
  const patch: Record<string, unknown> = {
    status: dbStatus,
    status_updated_at: ts,
  };
  if (dbStatus === 'DELIVERED') patch.delivered_at = ts;
  if (dbStatus === 'READ') patch.read_at = ts;
  if (dbStatus === 'FAILED') {
    patch.error_code = update.errors?.[0]?.code?.toString();
    patch.error_message = update.errors?.[0]?.title;
  }

  // Update broadcast_recipients
  const { data: rows } = await supabase
    .from('broadcast_recipients')
    .update(patch)
    .eq('wa_message_id', waMessageId)
    .select('broadcast_id, status');

  // Update aggregate counters on the broadcast
  if (rows?.length) {
    const broadcastId = rows[0].broadcast_id;
    await refreshBroadcastCounts(broadcastId);
  }

  // Also update follow_up_recipients
  await supabase
    .from('follow_up_recipients')
    .update(patch)
    .eq('wa_message_id', waMessageId);
}

async function refreshBroadcastCounts(broadcastId: string) {
  const { data } = await supabase
    .from('broadcast_recipients')
    .select('status')
    .eq('broadcast_id', broadcastId);

  const counts = { sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const r of data ?? []) {
    if (r.status === 'SENT') counts.sent++;
    else if (r.status === 'DELIVERED') counts.delivered++;
    else if (r.status === 'READ') { counts.delivered++; counts.read++; }  // read implies delivered
    else if (r.status === 'FAILED') counts.failed++;
  }

  await supabase.from('broadcasts').update({
    sent_count: counts.sent + counts.delivered + counts.read,
    delivered_count: counts.delivered + counts.read,
    read_count: counts.read,
    failed_count: counts.failed,
  }).eq('id', broadcastId);
}

function mapStatus(raw: string): string {
  switch (raw) {
    case 'SENT': return 'SENT';
    case 'DELIVERED': return 'DELIVERED';
    case 'READ': return 'READ';
    case 'FAILED': return 'FAILED';
    default: return 'SENT';
  }
}

export default router;

