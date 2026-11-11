import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { fetchTemplates } from '../services/metaApi.js';

const router = Router();

// ── GET /credentials ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('wa_credentials')
      .select('id, label, phone_number_id, waba_id, is_active, created_at');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// ── POST /credentials ─────────────────────────────────────────────────────────
const credSchema = z.object({
  label: z.string().min(1),
  phone_number_id: z.string().min(1),
  waba_id: z.string().min(1),
  access_token: z.string().min(1),
  verify_token: z.string().min(1),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = credSchema.parse(req.body);
    const { data, error } = await supabase
      .from('wa_credentials')
      .insert({
        label: body.label,
        phone_number_id: body.phone_number_id,
        waba_id: body.waba_id,
        access_token_enc: encrypt(body.access_token),
        verify_token: body.verify_token,
      })
      .select('id, label, phone_number_id, waba_id, is_active, created_at')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// ── DELETE /credentials/:id ───────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await supabase.from('wa_credentials').update({ is_active: false }).eq('id', req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── POST /credentials/:id/sync-templates ─────────────────────────────────────
router.post('/:id/sync-templates', requireAuth, async (req, res, next) => {
  try {
    const { data: cred, error } = await supabase
      .from('wa_credentials')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !cred) { res.status(404).json({ error: 'Credential not found' }); return; }

    const token = decrypt(cred.access_token_enc);
    const templates = await fetchTemplates(cred.waba_id, token);

    const rows = templates
      .filter((t: any) => t.status === 'APPROVED')
      .map((t: any) => ({
        credential_id: cred.id,
        meta_template_id: t.id ?? t.name,
        name: t.name,
        language: t.language,
        category: t.category,
        components: t.components ?? [],
        status: t.status,
        synced_at: new Date().toISOString(),
      }));

    if (rows.length) {
      await supabase
        .from('templates')
        .upsert(rows, { onConflict: 'credential_id,name,language' });
    }

    res.json({ synced: rows.length });
  } catch (err) { next(err); }
});

// ── GET /credentials/:id/templates ───────────────────────────────────────────
router.get('/:id/templates', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('credential_id', req.params.id)
      .eq('status', 'APPROVED')
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;

