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

const waClient = new WhatsAppClient();

/**
 * Sync templates for a given organization from Meta Graph API into Postgres
 */
export async function syncTemplatesForOrg(orgId: string): Promise<{ synced: number }> {
  let client;
  try {
    client = await pool.connect();
    const { rows: accRows } = await client.query(
      `SELECT waba_id, token_encrypted FROM whatsapp_accounts WHERE org_id = $1`,
      [orgId]
    );

    if (accRows.length === 0) {
      throw new Error('WhatsApp account not configured for this organization');
    }

    const { waba_id, token_encrypted } = accRows[0];
    const plainToken = decryptToken(token_encrypted, env.ENCRYPTION_KEY);

    const metaTemplates = await waClient.listTemplates(waba_id, plainToken);
    let count = 0;

    for (const mt of metaTemplates) {
      const name = mt.name;
      const language = mt.language || 'en';
      const category = (mt.category || 'marketing').toLowerCase();
      const status = (mt.status || 'draft').toLowerCase();
      const rejectionReason = mt.rejected_reason || null;
      const components = mt.components || [];

      let bodyText = '';
      let headerType: 'image' | 'video' | 'document' | 'text' | 'none' = 'none';
      let headerFormat: string | null = null;
      let footerText: string | null = null;

      for (const comp of components) {
        if (comp.type === 'BODY') {
          bodyText = comp.text || '';
        } else if (comp.type === 'HEADER') {
          const format = (comp.format || '').toLowerCase();
          headerFormat = format;
          if (format === 'image') headerType = 'image';
          else if (format === 'video') headerType = 'video';
          else if (format === 'document') headerType = 'document';
          else if (format === 'text') headerType = 'text';
          else headerType = 'none';
        } else if (comp.type === 'FOOTER') {
          footerText = comp.text || null;
        }
      }

      // Extract {{1}}, {{2}} variable count and names
      const varMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const variableNames = Array.from(new Set(varMatches));

      await client.query(
        `INSERT INTO templates (
           org_id, name, language, category, header_type, header_format, body,
           variable_names, footer, meta_template_id, status, rejection_reason,
           components, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         ON CONFLICT (org_id, name, language) DO UPDATE SET
           category = EXCLUDED.category,
           header_type = EXCLUDED.header_type,
           header_format = EXCLUDED.header_format,
           body = EXCLUDED.body,
           variable_names = EXCLUDED.variable_names,
           footer = EXCLUDED.footer,
           meta_template_id = COALESCE(EXCLUDED.meta_template_id, templates.meta_template_id),
           status = EXCLUDED.status,
           rejection_reason = EXCLUDED.rejection_reason,
           components = EXCLUDED.components,
           updated_at = NOW()`,
        [
          orgId,
          name,
          language,
          category,
          headerType,
          headerFormat,
          bodyText,
          variableNames,
          footerText,
          mt.id || null,
          status,
          rejectionReason,
          JSON.stringify(components),
        ]
      );
      count++;
    }

    return { synced: count };
  } finally {
    if (client) client.release();
  }
}

// ── POST /api/templates/sync ────────────────────────────────────────────────
router.post('/sync', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  try {
    const result = await syncTemplatesForOrg(orgId);
    return res.json({
      data: {
        success: true,
        synced: result.synced,
        synced_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed syncing templates from Meta');
    return res.status(500).json({
      error: { code: 'SYNC_FAILED', message: err.message },
    });
  }
});

// ── GET /api/templates ──────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT id, org_id, name, language, category, header_type, header_format,
              body, variable_names, footer, meta_template_id, status,
              rejection_reason, components, created_at, updated_at
       FROM templates
       WHERE org_id = $1
       ORDER BY name ASC, language ASC`,
      [orgId]
    );

    return res.json({
      data: rows,
      total: rows.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  } finally {
    if (client) client.release();
  }
});

export default router;

