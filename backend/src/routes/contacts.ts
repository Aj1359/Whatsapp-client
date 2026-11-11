import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { toE164 } from '../utils/phone.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── GET /contacts  (paginated, search, tag filter) ────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search, tag, active, page = '1', limit = '50' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const from = (pageNum - 1) * limitNum;

    let query = supabase.from('contacts').select('*', { count: 'exact' });

    if (active !== undefined) query = query.eq('is_active', active !== 'false');
    if (search) query = query.or(`display_name.ilike.%${search}%,mobile_number.ilike.%${search}%`);
    if (tag) query = query.contains('tags', [tag]);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, from + limitNum - 1);

    if (error) throw error;
    res.json({ data, total: count, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
});

// ── GET /contacts/:mobile ─────────────────────────────────────────────────────
router.get('/:mobile', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('mobile_number', req.params.mobile)
      .single();
    if (error) { res.status(404).json({ error: 'Contact not found' }); return; }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /contacts  (single upsert) ──────────────────────────────────────────
const contactSchema = z.object({
  mobile_number: z.string().min(7),
  display_name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = contactSchema.parse(req.body);
    const mobile = toE164(body.mobile_number);
    if (!mobile) { res.status(400).json({ error: 'Invalid mobile number' }); return; }

    const { data, error } = await supabase
      .from('contacts')
      .upsert({ ...body, mobile_number: mobile }, { onConflict: 'mobile_number' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /contacts/:mobile ───────────────────────────────────────────────────
router.patch('/:mobile', requireAuth, async (req, res, next) => {
  try {
    const patch = contactSchema.partial().parse(req.body);
    const { data, error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('mobile_number', req.params.mobile)
      .select()
      .single();
    if (error) { res.status(404).json({ error: 'Contact not found' }); return; }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /contacts/:mobile  (soft delete / opt-out) ────────────────────────
router.delete('/:mobile', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('contacts')
      .update({ is_active: false, opted_out_at: new Date().toISOString() })
      .eq('mobile_number', req.params.mobile);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── POST /contacts/import  (CSV or Excel bulk upsert) ────────────────────────
router.post('/import', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const rows = parseFile(req.file);
    const result = { total: rows.length, inserted: 0, updated: 0, skipped: 0, errors: [] as any[] };
    const batch: any[] = [];

    for (const [i, row] of rows.entries()) {
      const mobile = toE164(String(row['mobile_number'] ?? row['Mobile'] ?? row['Phone'] ?? ''));
      const name = String(row['display_name'] ?? row['Name'] ?? row['name'] ?? '').trim();
      if (!mobile || !name) {
        result.skipped++;
        result.errors.push({ row: i + 2, reason: 'Missing mobile or name', raw: row });
        continue;
      }
      const tags = parseTags(row['tags'] ?? row['Tags'] ?? '');
      const email = String(row['email'] ?? row['Email'] ?? '').trim() || null;
      // Everything else becomes custom_fields
      const known = new Set(['mobile_number','Mobile','Phone','display_name','Name','name','tags','Tags','email','Email']);
      const custom_fields: Record<string, unknown> = {};
      for (const k of Object.keys(row)) {
        if (!known.has(k)) custom_fields[k] = row[k];
      }
      batch.push({ mobile_number: mobile, display_name: name, email, tags, custom_fields });
    }

    if (batch.length) {
      const { error } = await supabase
        .from('contacts')
        .upsert(batch, { onConflict: 'mobile_number', ignoreDuplicates: false });
      if (error) throw error;
      result.inserted = batch.length;
    }

    // Log the import
    await supabase.from('contact_import_logs').insert({
      file_name: req.file.originalname,
      total_rows: result.total,
      inserted_rows: result.inserted,
      updated_rows: 0,
      skipped_rows: result.skipped,
      error_rows: result.errors.length,
      errors: result.errors,
      imported_by: req.user?.id,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseFile(file: Express.Multer.File): Record<string, unknown>[] {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const text = file.buffer.toString('utf8');
    const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    return result.data;
  }
  // Excel
  const wb = XLSX.read(file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
}

function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  const str = String(raw).trim();
  if (!str) return [];
  return str.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
}

export default router;

