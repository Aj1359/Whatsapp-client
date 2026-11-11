import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { sendBroadcast } from '../services/broadcastSender.js';

const router = Router();

// ── GET /broadcasts ───────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = '1', limit = '20', status } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const from = (pageNum - 1) * limitNum;

    let query = supabase
      .from('broadcast_report')
      .select('*', { count: 'exact' });

    if (status) query = query.eq('status', status.toUpperCase());

    const { data, error, count } = await query
      .order('sent_at', { ascending: false, nullsFirst: false })
      .range(from, from + limitNum - 1);

    if (error) throw error;
    res.json({ data, total: count, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
});

// ── GET /broadcasts/:id ───────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*, wa_credentials(id,label), templates(id,name,language), follow_ups(*)')
      .eq('id', req.params.id)
      .single();
    if (error) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /broadcasts/:id/report ─────────────────────────────────────────────
router.get('/:id/report', requireAuth, async (req, res, next) => {
  try {
    const { status, page = '1', limit = '100' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const from = (pageNum - 1) * limitNum;

    let query = supabase
      .from('recipient_report')
      .select('*', { count: 'exact' })
      .eq('broadcast_id', req.params.id);

    if (status) query = query.eq('status', status.toUpperCase());

    const { data, error, count } = await query
      .order('display_name', { ascending: true })
      .range(from, from + limitNum - 1);

    if (error) throw error;

    // Summary counts
    const { data: summary } = await supabase
      .from('broadcast_recipients')
      .select('status')
      .eq('broadcast_id', req.params.id);

    const counts: Record<string, number> = {};
    for (const r of summary ?? []) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }

    res.json({ data, total: count, page: pageNum, limit: limitNum, summary: counts });
  } catch (err) {
    next(err);
  }
});

// ── POST /broadcasts ──────────────────────────────────────────────────────────
const broadcastSchema = z.object({
  name: z.string().min(1),
  credential_id: z.string().uuid(),
  template_id: z.string().uuid().optional().nullable(),
  message_body: z.string().optional().nullable(),
  media_url: z.string().url().optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
  recipient_mobile_numbers: z.array(z.string()).optional(), // explicit list
  recipient_tags: z.array(z.string()).optional(),           // all contacts with these tags
  all_active_contacts: z.boolean().optional(),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = broadcastSchema.parse(req.body);

    // Collect recipients
    let mobiles: { mobile_number: string; display_name: string }[] = [];

    if (body.all_active_contacts) {
      const { data } = await supabase
        .from('contacts')
        .select('mobile_number, display_name')
        .eq('is_active', true);
      mobiles = data ?? [];
    } else if (body.recipient_tags?.length) {
      const { data } = await supabase
        .from('contacts')
        .select('mobile_number, display_name')
        .eq('is_active', true)
        .overlaps('tags', body.recipient_tags);
      mobiles = data ?? [];
    } else if (body.recipient_mobile_numbers?.length) {
      const { data } = await supabase
        .from('contacts')
        .select('mobile_number, display_name')
        .in('mobile_number', body.recipient_mobile_numbers)
        .eq('is_active', true);
      mobiles = data ?? [];
    }

    if (!mobiles.length) {
      res.status(400).json({ error: 'No active contacts match the recipient criteria' });
      return;
    }

    // Create broadcast
    const { data: bc, error: bcErr } = await supabase
      .from('broadcasts')
      .insert({
        name: body.name,
        credential_id: body.credential_id,
        template_id: body.template_id ?? null,
        message_body: body.message_body ?? null,
        media_url: body.media_url ?? null,
        scheduled_at: body.scheduled_at ?? null,
        total_recipients: mobiles.length,
        status: body.scheduled_at ? 'SCHEDULED' : 'DRAFT',
        created_by: req.user?.id,
      })
      .select()
      .single();

    if (bcErr) throw bcErr;

    // Insert recipients
    await supabase.from('broadcast_recipients').insert(
      mobiles.map(m => ({
        broadcast_id: bc.id,
        mobile_number: m.mobile_number,
        display_name: m.display_name,
        status: 'PENDING',
      }))
    );

    res.status(201).json(bc);
  } catch (err) {
    next(err);
  }
});

// ── POST /broadcasts/:id/send  (immediate send) ───────────────────────────────
router.post('/:id/send', requireAuth, async (req, res, next) => {
  try {
    // Fire and forget — respond immediately, sending happens in background
    res.json({ message: 'Broadcast queued for sending' });
    sendBroadcast(req.params.id).catch(err =>
      logger.error({ err, broadcastId: req.params.id }, 'Broadcast send failed')
    );
  } catch (err) {
    next(err);
  }
});

// ── POST /broadcasts/:id/follow-ups ──────────────────────────────────────────
const followUpSchema = z.object({
  delay_hours: z.number().int().min(1).default(24),
  target_statuses: z.array(z.string()).default(['SENT', 'DELIVERED']),
  template_id: z.string().uuid().optional().nullable(),
  message_body: z.string().optional().nullable(),
  media_url: z.string().url().optional().nullable(),
});

router.post('/:id/follow-ups', requireAuth, async (req, res, next) => {
  try {
    const { data: bc } = await supabase.from('broadcasts').select('sent_at').eq('id', req.params.id).single();
    if (!bc?.sent_at) { res.status(400).json({ error: 'Parent broadcast not sent yet' }); return; }

    const body = followUpSchema.parse(req.body);
    const scheduledAt = new Date(new Date(bc.sent_at).getTime() + body.delay_hours * 3600 * 1000);

    const { data, error } = await supabase
      .from('follow_ups')
      .insert({ ...body, broadcast_id: req.params.id, scheduled_at: scheduledAt.toISOString() })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /broadcasts/:id ────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: bc } = await supabase.from('broadcasts').select('status').eq('id', req.params.id).single();
    if (bc?.status === 'SENDING') {
      res.status(409).json({ error: 'Cannot delete a broadcast that is currently sending' });
      return;
    }
    await supabase.from('broadcasts').delete().eq('id', req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

