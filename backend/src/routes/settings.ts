import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=';

// Helper to get org_id from request headers or default
function getOrgId(req: Request): string {
  return (req.headers['x-org-id'] as string) || '00000000-0000-0000-0000-000000000001';
}

// ── GET /api/settings/whatsapp ──────────────────────────────────────────────
router.get('/whatsapp', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT org_id, phone_number_id, waba_id, graph_version, display_phone, verified_name, quality_rating, updated_at
       FROM whatsapp_accounts
       WHERE org_id = $1`,
      [orgId]
    );

    if (rows.length === 0) {
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
    }

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
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'DB_ERROR', message: err.message } });
  } finally {
    client.release();
  }
});

// ── PUT /api/settings/whatsapp (Save WhatsApp credentials) ──────────────────
const saveSchema = z.object({
  phone_number_id: z.string().min(5),
  waba_id: z.string().min(5),
  token: z.string().min(10),
  app_secret: z.string().optional(),
});

router.put('/whatsapp', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', issues: parsed.error.issues } });
  }

  const { phone_number_id, waba_id, token, app_secret } = parsed.data;
  const tokenEncrypted = encryptToken(token, ENCRYPTION_KEY);
  const secretEncrypted = app_secret ? encryptToken(app_secret, ENCRYPTION_KEY) : null;

  const client = await pool.connect();
  try {
    // 1. Verify connection with Meta first
    const waClient = new WhatsAppClient();
    let displayPhone = null;
    let verifiedName = null;
    let qualityRating = null;

    try {
      const metaInfo = await waClient.testConnection(phone_number_id, token);
      displayPhone = metaInfo.display_phone_number;
      verifiedName = metaInfo.verified_name;
      qualityRating = metaInfo.quality_rating;

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

    // 2. Ensure organization exists in organizations table
    await client.query(
      `INSERT INTO organizations (id, name) VALUES ($1, 'User Organization') ON CONFLICT (id) DO NOTHING`,
      [orgId]
    );

    // 3. Upsert whatsapp_accounts
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
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  } finally {
    client.release();
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

export default router;

