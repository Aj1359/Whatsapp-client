import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { logger } from '../config/logger.js';
import { normalisePhoneNumber } from '../lib/phone.js';
import { parseFileContent } from '../lib/excel.js';
import { requireAuth } from '../middleware/auth.js';
import { getOrgId } from './settings.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit per PRD
});

// ── GET /api/contacts ────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { search, status, list_id, page = '1', limit = '50' } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let client;
  try {
    client = await pool.connect();

    let whereClause = `WHERE c.org_id = $1`;
    const params: any[] = [orgId];

    if (status && status !== 'all') {
      params.push(status);
      whereClause += ` AND c.status = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (c.name ILIKE $${params.length} OR c.whatsapp_e164 ILIKE $${params.length})`;
    }

    let joinClause = '';
    if (list_id) {
      params.push(parseInt(list_id, 10));
      joinClause = `JOIN list_members lm ON c.id = lm.contact_id AND lm.list_id = $${params.length}`;
    }

    const countRes = await client.query(
      `SELECT COUNT(DISTINCT c.id) FROM contacts c ${joinClause} ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const dataRes = await client.query(
      `SELECT DISTINCT c.id, c.org_id, c.name, c.whatsapp_e164, c.phone_raw, c.email, c.extra,
              c.status, c.opt_in_confirmed_at, c.opt_in_source, c.opted_out_at, c.created_at, c.updated_at
       FROM contacts c
       ${joinClause}
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset]
    );

    return res.json({
      data: dataRes.rows,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── GET /api/contacts/selectable ─────────────────────────────────────────────
// Returns only contacts that can receive campaigns (status='active' and opt_in_confirmed_at IS NOT NULL)
router.get('/selectable', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { list_id } = req.query as Record<string, string>;

  let client;
  try {
    client = await pool.connect();

    let query = `
      SELECT c.id, c.name, c.whatsapp_e164
      FROM contacts c
    `;
    const params: any[] = [orgId];

    if (list_id) {
      params.push(parseInt(list_id, 10));
      query += ` JOIN list_members lm ON c.id = lm.contact_id AND lm.list_id = $2`;
    }

    query += ` WHERE c.org_id = $1 AND c.status = 'active' AND c.opt_in_confirmed_at IS NOT NULL ORDER BY c.name ASC`;

    const { rows } = await client.query(query, params);
    return res.json({ data: rows, total: rows.length });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/contacts (Single Add) ──────────────────────────────────────────
const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')),
  consent_confirmed: z.boolean().refine((val) => val === true, {
    message: 'Explicit opt-in consent confirmation is required',
  }),
  opt_in_source: z.string().default('manual_entry'),
  list_ids: z.array(z.number()).optional(),
});

router.post('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const parsed = createContactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', issues: parsed.error.issues },
    });
  }

  const { name, phone, email, opt_in_source, list_ids } = parsed.data;
  const norm = normalisePhoneNumber(phone, 'IN');
  if (!norm.isValid || !norm.e164) {
    return res.status(400).json({
      error: { code: 'INVALID_PHONE', message: `Invalid phone number: ${phone}` },
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check if previously opted out
    const existing = await client.query(
      `SELECT id, status FROM contacts WHERE org_id = $1 AND whatsapp_e164 = $2`,
      [orgId, norm.e164]
    );

    let contactId: number;
    if (existing.rows.length > 0 && existing.rows[0].status === 'opted_out') {
      // Never re-activate an opted-out contact per requirements
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'CONTACT_OPTED_OUT',
          message: 'This contact previously opted out (STOP). Cannot reactivate without external re-consent.',
        },
      });
    }

    const insertRes = await client.query(
      `INSERT INTO contacts (
        org_id, name, whatsapp_e164, phone_raw, email, status, opt_in_confirmed_at, opt_in_source
      ) VALUES ($1, $2, $3, $4, $5, 'active', NOW(), $6)
      ON CONFLICT (org_id, whatsapp_e164) DO UPDATE SET
        name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, contacts.email),
        updated_at = NOW()
      RETURNING *`,
      [orgId, name, norm.e164, phone, email || null, opt_in_source]
    );

    contactId = insertRes.rows[0].id;

    if (Array.isArray(list_ids) && list_ids.length > 0) {
      for (const listId of list_ids) {
        await client.query(
          `INSERT INTO list_members (list_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [listId, contactId]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({ data: insertRes.rows[0] });
  } catch (err: any) {
    if (client) await client.query('ROLLBACK');
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/contacts/import (.xlsx, .xls, .csv up to 15MB, 50,000 rows) ────
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!req.file) {
    return res.status(400).json({
      error: { code: 'FILE_REQUIRED', message: 'No file uploaded' },
    });
  }

  const consentConfirmed = req.body.consent_confirmed === 'true' || req.body.consent_confirmed === true;
  if (!consentConfirmed) {
    return res.status(400).json({
      error: { code: 'CONSENT_REQUIRED', message: 'Explicit opt-in consent checkbox is required to import contacts' },
    });
  }

  const optInSource = req.body.opt_in_source || `file_import:${req.file.originalname}`;
  const listId = req.body.list_id ? parseInt(req.body.list_id, 10) : null;

  let parsedFile;
  try {
    parsedFile = parseFileContent(req.file.buffer, req.file.originalname);
  } catch (parseErr: any) {
    return res.status(400).json({
      error: { code: 'PARSE_FAILED', message: `Could not parse file: ${parseErr.message}` },
    });
  }

  if (parsedFile.rows.length === 0) {
    return res.status(400).json({
      error: { code: 'EMPTY_FILE', message: 'The uploaded file contains no data rows' },
    });
  }

  if (parsedFile.rows.length > 50000) {
    return res.status(400).json({
      error: { code: 'MAX_ROWS_EXCEEDED', message: 'Maximum 50,000 rows permitted per import' },
    });
  }

  // Column mapping (auto-detect or user provided)
  const phoneCol =
    req.body.phone_column ||
    parsedFile.headers.find((h) => /phone|mobile|whatsapp|contact|number/i.test(h)) ||
    parsedFile.headers[0];

  const nameCol =
    req.body.name_column ||
    parsedFile.headers.find((h) => /name|customer|full_name/i.test(h));

  const emailCol =
    req.body.email_column ||
    parsedFile.headers.find((h) => /email|mail/i.test(h));

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Create import record
    const importRes = await client.query(
      `INSERT INTO imports (org_id, filename, total, valid, invalid, duplicate)
       VALUES ($1, $2, $3, 0, 0, 0)
       RETURNING id`,
      [orgId, req.file.originalname, parsedFile.rows.length]
    );
    const importId = importRes.rows[0].id;

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    const seenNumbers = new Set<string>();

    for (const item of parsedFile.rows) {
      const rawRow = item.data;
      const rawPhone = String(rawRow[phoneCol] || '').trim();
      const rawName = nameCol ? String(rawRow[nameCol] || '').trim() : '';
      const rawEmail = emailCol ? String(rawRow[emailCol] || '').trim() : null;

      if (!rawPhone) {
        invalidCount++;
        await client.query(
          `INSERT INTO import_errors (import_id, row_number, reason, raw) VALUES ($1, $2, $3, $4)`,
          [importId, item.rowNumber, 'Missing phone number', JSON.stringify(rawRow)]
        );
        continue;
      }

      const norm = normalisePhoneNumber(rawPhone, 'IN');
      if (!norm.isValid || !norm.e164) {
        invalidCount++;
        await client.query(
          `INSERT INTO import_errors (import_id, row_number, reason, raw) VALUES ($1, $2, $3, $4)`,
          [importId, item.rowNumber, `Invalid phone number: ${rawPhone}`, JSON.stringify(rawRow)]
        );
        continue;
      }

      if (seenNumbers.has(norm.e164)) {
        duplicateCount++;
        continue;
      }
      seenNumbers.add(norm.e164);

      // Check existing status in DB
      const existing = await client.query(
        `SELECT id, status FROM contacts WHERE org_id = $1 AND whatsapp_e164 = $2`,
        [orgId, norm.e164]
      );

      if (existing.rows.length > 0 && existing.rows[0].status === 'opted_out') {
        duplicateCount++;
        await client.query(
          `INSERT INTO import_errors (import_id, row_number, reason, raw) VALUES ($1, $2, $3, $4)`,
          [importId, item.rowNumber, 'Contact previously opted out (STOP)', JSON.stringify(rawRow)]
        );
        continue;
      }

      const contactName = rawName || norm.e164;
      const insertContact = await client.query(
        `INSERT INTO contacts (
           org_id, name, whatsapp_e164, phone_raw, email, status, opt_in_confirmed_at, opt_in_source
         ) VALUES ($1, $2, $3, $4, $5, 'active', NOW(), $6)
         ON CONFLICT (org_id, whatsapp_e164) DO UPDATE SET
           name = CASE WHEN contacts.name = contacts.whatsapp_e164 THEN EXCLUDED.name ELSE contacts.name END,
           email = COALESCE(EXCLUDED.email, contacts.email),
           updated_at = NOW()
         RETURNING id`,
        [orgId, contactName, norm.e164, rawPhone, rawEmail, optInSource]
      );

      const contactId = insertContact.rows[0].id;
      validCount++;

      if (listId) {
        await client.query(
          `INSERT INTO list_members (list_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [listId, contactId]
        );
      }
    }

    // Update import summary
    await client.query(
      `UPDATE imports SET valid = $1, invalid = $2, duplicate = $3 WHERE id = $4`,
      [validCount, invalidCount, duplicateCount, importId]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      data: {
        import_id: importId,
        total: parsedFile.rows.length,
        valid: validCount,
        invalid: invalidCount,
        duplicate: duplicateCount,
      },
    });
  } catch (err: any) {
    if (client) await client.query('ROLLBACK');
    logger.error({ err: err.message }, 'Failed during contact bulk import transaction');
    return res.status(500).json({
      error: { code: 'IMPORT_FAILED', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/contacts/:id/opt-out ───────────────────────────────────────────
router.post('/:id/opt-out', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rowCount } = await client.query(
      `UPDATE contacts
       SET status = 'opted_out', opted_out_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    }

    // Cancel pending messages for this contact
    await client.query(
      `UPDATE messages SET status = 'skipped', error_code = 'OPTED_OUT'
       WHERE org_id = $1 AND contact_id = $2 AND status = 'queued'`,
      [orgId, req.params.id]
    );

    return res.json({ data: { opted_out: true } });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── DELETE /api/contacts/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rowCount } = await client.query(
      `DELETE FROM contacts WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Contact not found' },
      });
    }

    return res.json({ data: { deleted: true } });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── AUDIENCE LISTS: GET /api/contacts/lists ──────────────────────────────────
router.get('/lists/all', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT l.id, l.name, l.created_at, COUNT(lm.contact_id)::int as member_count
       FROM lists l
       LEFT JOIN list_members lm ON l.id = lm.list_id
       WHERE l.org_id = $1
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
      [orgId]
    );
    return res.json({ data: rows });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── AUDIENCE LISTS: POST /api/contacts/lists ─────────────────────────────────
router.post('/lists', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'List name is required' } });
  }

  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `INSERT INTO lists (org_id, name) VALUES ($1, $2) RETURNING *`,
      [orgId, name.trim()]
    );
    return res.status(201).json({ data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

export default router;
