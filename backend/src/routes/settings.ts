import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=';

// In-memory store for WhatsApp credentials (preserves credentials even when Postgres is cold/restarting)
const inMemoryAccounts: Record<string, any> = {};

// Helper to get org_id from request headers or default
function getOrgId(req: Request): string {
  return (req.headers['x-org-id'] as string) || '00000000-0000-0000-0000-000000000001';
}

// ── GET /api/settings/whatsapp ──────────────────────────────────────────────
router.get('/whatsapp', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT org_id, phone_number_id, waba_id, graph_version, display_phone, verified_name, quality_rating, updated_at
       FROM whatsapp_accounts
       WHERE org_id = $1`,
      [orgId]
    );

    if (rows.length > 0) {
      const row = rows[0];
      return res.json({
        data: {
          is_connected: true,
          phone_number_id: row.phone_number_id,
          waba_id: row.waba_id,
          graph_version: row.graph_version,
          display_phone: row.display_phone,
          verified_name: row.verified_name,
          quality_rating: row.quality_rating,
          updated_at: row.updated_at,
          token_configured: true,
        },
      });
    }
  } catch (err: any) {
    console.warn('GET /settings/whatsapp DB warning:', err.message);
  } finally {
    if (client) client.release();
  }

  // Check in-memory store fallback
  if (inMemoryAccounts[orgId] || inMemoryAccounts['default']) {
    const acc = inMemoryAccounts[orgId] || inMemoryAccounts['default'];
    return res.json({
      data: {
        is_connected: true,
        phone_number_id: acc.phone_number_id,
        waba_id: acc.waba_id,
        display_phone: acc.display_phone,
        verified_name: acc.verified_name,
        quality_rating: acc.quality_rating,
        updated_at: acc.updated_at,
        token_configured: true,
      },
    });
  }

  return res.json({
    data: {
      is_connected: false,
      phone_number_id: null,
      waba_id: null,
      display_phone: null,
      verified_name: null,
      quality_rating: null,
    },
  });
});

// ── PUT /api/settings/whatsapp (Save WhatsApp credentials) ──────────────────
const saveSchema = z.object({
  phone_number_id: z.string().min(5),
  waba_id: z.string().min(5),
  token: z.string().min(10),
  app_secret: z.string().optional(),
});

router.put('/whatsapp', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', issues: parsed.error.issues } });
    }

    const { phone_number_id, waba_id, token, app_secret } = parsed.data;
    const tokenEncrypted = encryptToken(token, ENCRYPTION_KEY);
    const secretEncrypted = app_secret ? encryptToken(app_secret, ENCRYPTION_KEY) : null;

    // 1. Verify connection with Meta first
    const waClient = new WhatsAppClient();
    let displayPhone: string | null = null;
    let verifiedName: string | null = null;
    let qualityRating: string | null = null;

    try {
      const metaInfo = await waClient.testConnection(phone_number_id, token);
      displayPhone = metaInfo.display_phone_number || null;
      verifiedName = metaInfo.verified_name || null;
      qualityRating = metaInfo.quality_rating || 'GREEN';

      // Subscribe webhook to WABA
      await waClient.subscribeApp(waba_id, token).catch((e) => {
        console.warn('WABA subscribeApp warning:', e.message);
      });
    } catch (metaErr: any) {
      return res.status(400).json({
        error: {
          code: 'META_AUTH_FAILED',
          message: `Meta verification failed: ${metaErr.message}. Please verify Phone Number ID and Access Token.`,
        },
      });
    }

    // 2. Cache in-memory so credentials persist across sessions
    const savedAccount = {
      is_connected: true,
      org_id: orgId,
      phone_number_id,
      waba_id,
      display_phone: displayPhone,
      verified_name: verifiedName,
      quality_rating: qualityRating,
      token_encrypted: tokenEncrypted,
      token_plain: token,
      updated_at: new Date().toISOString(),
    };
    inMemoryAccounts[orgId] = savedAccount;
    inMemoryAccounts['default'] = savedAccount;

    // 3. Persist to Postgres database if available
    let client;
    try {
      client = await pool.connect();
      await client.query(
        `INSERT INTO organizations (id, name) VALUES ($1, 'User Organization') ON CONFLICT (id) DO NOTHING`,
        [orgId]
      );

      const { rows } = await client.query(
        `INSERT INTO whatsapp_accounts (
          org_id, phone_number_id, waba_id, token_encrypted, app_secret_encrypted,
          display_phone, verified_name, quality_rating, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
        ON CONFLICT (org_id) DO UPDATE SET
          phone_number_id = EXCLUDED.phone_number_id,
          waba_id = EXCLUDED.waba_id,
          token_encrypted = EXCLUDED.token_encrypted,
          app_secret_encrypted = EXCLUDED.app_secret_encrypted,
          display_phone = EXCLUDED.display_phone,
          verified_name = EXCLUDED.verified_name,
          quality_rating = EXCLUDED.quality_rating,
          updated_at = now()
        RETURNING org_id, phone_number_id, waba_id, display_phone, verified_name, quality_rating`,
        [orgId, phone_number_id, waba_id, tokenEncrypted, secretEncrypted, displayPhone, verifiedName, qualityRating]
      );

      return res.json({
        data: {
          is_connected: true,
          ...rows[0],
        },
      });
    } catch (dbErr: any) {
      console.warn('Postgres save warning (proceeding with verified credentials):', dbErr.message);
      // Return verified payload even if database table is initializing
      return res.json({
        data: {
          is_connected: true,
          org_id: orgId,
          phone_number_id,
          waba_id,
          display_phone: displayPhone,
          verified_name: verifiedName,
          quality_rating: qualityRating,
        },
      });
    } finally {
      if (client) client.release();
    }
  } catch (err: any) {
    console.error('Unhandled PUT /whatsapp error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Server error occurred' } });
  }
});

// ── POST /api/settings/whatsapp/test (Test live Meta connection) ─────────────
const testSchema = z.object({
  phone_number_id: z.string().min(5),
  token: z.string().min(10),
});

router.post('/whatsapp/test', async (req: Request, res: Response) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', issues: parsed.error.issues } });
  }

  const { phone_number_id, token } = parsed.data;
  const waClient = new WhatsAppClient();

  try {
    const metaInfo = await waClient.testConnection(phone_number_id, token);
    return res.json({
      data: {
        success: true,
        display_phone_number: metaInfo.display_phone_number,
        verified_name: metaInfo.verified_name,
        quality_rating: metaInfo.quality_rating,
      },
    });
  } catch (err: any) {
    return res.status(400).json({
      error: {
        code: 'META_TEST_FAILED',
        message: err.message || 'Could not connect to WhatsApp Business Cloud API',
      },
    });
  }
});

// ── GET /api/settings/whatsapp/templates (List Meta Message Templates) ────────
router.get('/whatsapp/templates', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const wabaIdQuery = req.query.waba_id as string;
  const tokenQuery = req.query.token as string;

  const acc = inMemoryAccounts[orgId] || inMemoryAccounts['default'] || {};
  const wabaId = wabaIdQuery || acc.waba_id;
  const token = tokenQuery || acc.token_plain || (acc.token_encrypted ? decryptToken(acc.token_encrypted, ENCRYPTION_KEY) : null);

  if (!wabaId || !token) {
    return res.status(400).json({ error: { message: 'Missing WABA ID or Access Token. Please configure in Profile Connector.' } });
  }

  try {
    const waClient = new WhatsAppClient();
    const templates = await waClient.listTemplates(wabaId, token);
    return res.json({ data: templates });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || 'Failed to list templates from Meta' } });
  }
});

// ── POST /api/settings/whatsapp/send-template (Single template test / message) ─
const sendTemplateSchema = z.object({
  to: z.string().min(8),
  template_name: z.string().min(1),
  language_code: z.string().default('en'),
  components: z.array(z.any()).optional().default([]),
  phone_number_id: z.string().optional(),
  token: z.string().optional(),
});

router.post('/whatsapp/send-template', async (req: Request, res: Response) => {
  const parsed = sendTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', issues: parsed.error.issues } });
  }

  const { to, template_name, language_code, components, phone_number_id: bodyPhoneId, token: bodyToken } = parsed.data;
  const orgId = getOrgId(req);
  const acc = inMemoryAccounts[orgId] || inMemoryAccounts['default'] || {};
  const phoneId = bodyPhoneId || acc.phone_number_id;
  const token = bodyToken || acc.token_plain || (acc.token_encrypted ? decryptToken(acc.token_encrypted, ENCRYPTION_KEY) : null);

  if (!phoneId || !token) {
    return res.status(400).json({ error: { message: 'Missing Phone Number ID or Access Token.' } });
  }

  const waClient = new WhatsAppClient();
  const cleanedTo = to.replace(/[^0-9]/g, '');
  const result = await waClient.sendTemplate(phoneId, token, cleanedTo, template_name, language_code, components);

  if (!result.success) {
    return res.status(400).json({ error: result.error || { message: 'Failed to send template message' } });
  }

  return res.json({ data: result });
});

// ── POST /api/settings/whatsapp/broadcast-template (Send template to contacts) ─
const broadcastTemplateSchema = z.object({
  recipients: z.array(z.object({
    mobile: z.string(),
    name: z.string().optional(),
  })),
  template_name: z.string().min(1),
  language_code: z.string().default('en'),
  header_image_url: z.string().optional(),
  phone_number_id: z.string().optional(),
  token: z.string().optional(),
});

router.post('/whatsapp/broadcast-template', async (req: Request, res: Response) => {
  const parsed = broadcastTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', issues: parsed.error.issues } });
  }

  const { recipients, template_name, language_code, header_image_url, phone_number_id: bodyPhoneId, token: bodyToken } = parsed.data;
  const orgId = getOrgId(req);
  const acc = inMemoryAccounts[orgId] || inMemoryAccounts['default'] || {};
  const phoneId = bodyPhoneId || acc.phone_number_id;
  const token = bodyToken || acc.token_plain || (acc.token_encrypted ? decryptToken(acc.token_encrypted, ENCRYPTION_KEY) : null);

  if (!phoneId || !token) {
    return res.status(400).json({ error: { message: 'Missing Phone Number ID or Access Token.' } });
  }

  const waClient = new WhatsAppClient();
  let sentCount = 0;
  let failedCount = 0;
  const details: any[] = [];

  for (const r of recipients) {
    const cleanedTo = r.mobile.replace(/[^0-9]/g, '');
    if (!cleanedTo || cleanedTo.length < 8) continue;

    const components: any[] = [];
    if (header_image_url) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: header_image_url } }],
      });
    }
    if (r.name) {
      components.push({
        type: 'body',
        parameters: [{ type: 'text', text: r.name }],
      });
    }

    try {
      const resSend = await waClient.sendTemplate(phoneId, token, cleanedTo, template_name, language_code, components);
      if (resSend.success) {
        sentCount++;
        details.push({ mobile: cleanedTo, name: r.name, status: 'sent', messageId: resSend.wa_message_id });
      } else {
        failedCount++;
        details.push({ mobile: cleanedTo, name: r.name, status: 'failed', error: resSend.error?.message });
      }
    } catch (sendErr: any) {
      failedCount++;
      details.push({ mobile: cleanedTo, name: r.name, status: 'failed', error: sendErr.message });
    }

    // Small delay between calls to respect rate limit
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  return res.json({
    data: {
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      template_name,
      details,
    },
  });
});

export default router;

