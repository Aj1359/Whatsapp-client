import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Apply auth to all settings routes
router.use(requireAuth);

// Helper to get verified org_id from authenticated context
export function getOrgId(req: Request): string {
  if (req.auth?.orgId) return req.auth.orgId;
  throw new Error('Authentication context missing orgId');
}

// ── GET /api/settings/whatsapp ──────────────────────────────────────────────
router.get('/whatsapp', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT org_id, phone_number_id, waba_id, graph_version, display_phone, verified_name, quality_rating,
              forward_enabled, forward_to_e164, forward_template_name, forward_template_language, updated_at
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
          forward_enabled: row.forward_enabled,
          forward_to_e164: row.forward_to_e164,
          forward_template_name: row.forward_template_name,
          forward_template_language: row.forward_template_language,
          updated_at: row.updated_at,
          token_configured: true,
        },
      });
    }

    return res.json({
      data: {
        is_connected: false,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/settings/whatsapp ─────────────────────────────────────────────
const saveCredentialsSchema = z.object({
  phone_number_id: z.string().min(1, 'Phone Number ID is required'),
  waba_id: z.string().min(1, 'WABA ID is required'),
  token: z.string().min(1, 'Permanent Access Token is required'),
  app_secret: z.string().optional(),
  forward_enabled: z.boolean().optional(),
  forward_to_e164: z.string().optional(),
  forward_template_name: z.string().optional(),
  forward_template_language: z.string().optional(),
});

const saveWhatsAppHandler = async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const parsed = saveCredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid credential payload',
        issues: parsed.error.issues,
      },
    });
  }

  const {
    phone_number_id,
    waba_id,
    token,
    app_secret,
    forward_enabled = false,
    forward_to_e164 = null,
    forward_template_name = null,
    forward_template_language = 'en',
  } = parsed.data;

  // 1. Verify with Meta Graph API
  const waClient = new WhatsAppClient();
  let metaInfo: any;
  try {
    metaInfo = await waClient.testConnection(phone_number_id, token);
  } catch (err: any) {
    return res.status(400).json({
      error: {
        code: 'META_CONNECTION_FAILED',
        message: err.message || 'Meta connection test failed with provided credentials',
      },
    });
  }

  // 2. Encrypt token using server ENCRYPTION_KEY
  const tokenEncrypted = encryptToken(token, env.ENCRYPTION_KEY);
  const appSecretEncrypted = app_secret ? encryptToken(app_secret, env.ENCRYPTION_KEY) : null;

  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO whatsapp_accounts (
        org_id, phone_number_id, waba_id, token_encrypted, app_secret_encrypted,
        graph_version, display_phone, verified_name, quality_rating,
        forward_enabled, forward_to_e164, forward_template_name, forward_template_language,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'v21.0', $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (org_id) DO UPDATE SET
        phone_number_id = EXCLUDED.phone_number_id,
        waba_id = EXCLUDED.waba_id,
        token_encrypted = EXCLUDED.token_encrypted,
        app_secret_encrypted = COALESCE(EXCLUDED.app_secret_encrypted, whatsapp_accounts.app_secret_encrypted),
        display_phone = EXCLUDED.display_phone,
        verified_name = EXCLUDED.verified_name,
        quality_rating = EXCLUDED.quality_rating,
        forward_enabled = EXCLUDED.forward_enabled,
        forward_to_e164 = EXCLUDED.forward_to_e164,
        forward_template_name = EXCLUDED.forward_template_name,
        forward_template_language = EXCLUDED.forward_template_language,
        updated_at = NOW()`,
      [
        orgId,
        phone_number_id,
        waba_id,
        tokenEncrypted,
        appSecretEncrypted,
        metaInfo.display_phone_number || null,
        metaInfo.verified_name || null,
        metaInfo.quality_rating || 'UNKNOWN',
        forward_enabled,
        forward_to_e164,
        forward_template_name,
        forward_template_language,
      ]
    );

    // Auto-subscribe WABA to webhook
    try {
      await waClient.subscribeApp(waba_id, token);
    } catch (subErr: any) {
      console.warn('Auto-subscribe app to WABA warning:', subErr.message);
    }

    return res.json({
      data: {
        is_connected: true,
        phone_number_id,
        waba_id,
        display_phone: metaInfo.display_phone_number,
        verified_name: metaInfo.verified_name,
        quality_rating: metaInfo.quality_rating,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
};

router.post('/whatsapp', saveWhatsAppHandler);
router.put('/whatsapp', saveWhatsAppHandler);

// ── DELETE /api/settings/whatsapp (Disconnect) ──────────────────────────────
router.delete('/whatsapp', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    await client.query(`DELETE FROM whatsapp_accounts WHERE org_id = $1`, [orgId]);
    return res.json({ data: { disconnected: true } });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/settings/whatsapp/test ────────────────────────────────────────
const testConnectionSchema = z.object({
  phone_number_id: z.string().optional(),
  token: z.string().optional(),
});

router.post('/whatsapp/test', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const parsed = testConnectionSchema.safeParse(req.body || {});
  const bodyPhoneId = parsed.success ? parsed.data.phone_number_id?.trim() : undefined;
  const bodyToken = parsed.success ? parsed.data.token?.trim() : undefined;

  let targetPhoneId = bodyPhoneId;
  let targetToken = bodyToken;

  let client;
  try {
    client = await pool.connect();

    if (!targetPhoneId || !targetToken) {
      const { rows } = await client.query(
        `SELECT phone_number_id, token_encrypted FROM whatsapp_accounts WHERE org_id = $1`,
        [orgId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'No WhatsApp account configured. Please provide phone_number_id and token to test.',
          },
        });
      }

      targetPhoneId = rows[0].phone_number_id;
      targetToken = decryptToken(rows[0].token_encrypted, env.ENCRYPTION_KEY);
    }

    const waClient = new WhatsAppClient();
    const metaInfo = await waClient.testConnection(targetPhoneId!, targetToken!);

    // If an account is already linked in DB for this org, update verified details
    await client.query(
      `UPDATE whatsapp_accounts SET
        display_phone = $1, verified_name = $2, quality_rating = $3, updated_at = NOW()
       WHERE org_id = $4`,
      [metaInfo.display_phone_number || null, metaInfo.verified_name || null, metaInfo.quality_rating || 'UNKNOWN', orgId]
    );

    return res.json({ data: metaInfo });
  } catch (err: any) {
    return res.status(400).json({
      error: { code: 'TEST_CONNECTION_FAILED', message: err.message || 'Meta connection test failed' },
    });
  } finally {
    if (client) client.release();
  }
});

// ── GET /api/settings/whatsapp/templates ────────────────────────────────────
router.get('/whatsapp/templates', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT waba_id, token_encrypted FROM whatsapp_accounts WHERE org_id = $1`,
      [orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_CONFIGURED', message: 'WhatsApp account not configured' },
      });
    }

    const { waba_id, token_encrypted } = rows[0];
    const plainToken = decryptToken(token_encrypted, env.ENCRYPTION_KEY);
    const waClient = new WhatsAppClient();
    const metaTemplates = await waClient.listTemplates(waba_id, plainToken);

    return res.json({ data: metaTemplates });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'META_API_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

// ── POST /api/settings/whatsapp/subscribe-waba ──────────────────────────────
router.post('/whatsapp/subscribe-waba', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT waba_id, token_encrypted FROM whatsapp_accounts WHERE org_id = $1`,
      [orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_CONFIGURED', message: 'WhatsApp account not configured' },
      });
    }

    const { waba_id, token_encrypted } = rows[0];
    const plainToken = decryptToken(token_encrypted, env.ENCRYPTION_KEY);
    const waClient = new WhatsAppClient();
    const data = await waClient.subscribeApp(waba_id, plainToken);

    return res.json({ data: { success: true, message: 'App subscribed to WABA webhook successfully!', meta_response: data } });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'SUBSCRIBE_FAILED', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

export default router;
