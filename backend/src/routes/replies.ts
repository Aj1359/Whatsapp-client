import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { inMemoryReplies } from './webhooks.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { decryptToken } from '../lib/crypto.js';
import { inMemoryAccounts, ENCRYPTION_KEY } from './settings.js';

const router = Router();
const waClient = new WhatsAppClient();

// GET /api/replies — Returns all inbound customer messages
router.get('/', (_req: Request, res: Response) => {
  return res.json({
    data: inMemoryReplies,
    total: inMemoryReplies.length,
  });
});

// POST /api/replies/send — Dispatches direct text response to customer
const sendReplySchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  text: z.string().min(1),
  phone_number_id: z.string().optional(),
  token: z.string().optional(),
});

router.post('/send', async (req: Request, res: Response) => {
  const parsed = sendReplySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', issues: parsed.error.issues } });
  }

  const { to, text, phone_number_id: bodyPhoneId, token: bodyToken } = parsed.data;
  const acc = inMemoryAccounts['default'] || {};
  const phoneId = bodyPhoneId || acc.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || '974413665755017';
  const token =
    bodyToken ||
    acc.token_plain ||
    (acc.token_encrypted ? decryptToken(acc.token_encrypted, ENCRYPTION_KEY) : null) ||
    process.env.META_ACCESS_TOKEN;

  if (!phoneId || !token) {
    return res.status(400).json({ error: { message: 'WhatsApp credentials (phone_number_id or token) missing.' } });
  }

  const targets = Array.isArray(to) ? to : [to];
  const results: any[] = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const rawTo of targets) {
    const cleaned = String(rawTo).replace(/[^0-9]/g, '');
    if (!cleaned || cleaned.length < 8) {
      failedCount++;
      results.push({ to: rawTo, status: 'failed', error: 'Invalid phone number format' });
      continue;
    }

    try {
      const sendRes = await waClient.sendFreeForm(phoneId, token, cleaned, 'text', { text });
      if (sendRes.success) {
        sentCount++;
        results.push({ to: cleaned, status: 'sent', wa_message_id: sendRes.wa_message_id });
      } else {
        failedCount++;
        results.push({ to: cleaned, status: 'failed', error: 'Failed to send' });
      }
    } catch (err: any) {
      failedCount++;
      results.push({ to: cleaned, status: 'failed', error: err.message });
    }
  }

  return res.json({
    data: {
      sent: sentCount,
      failed: failedCount,
      results,
    },
  });
});

// POST /api/replies/test-seed — Allows testing/demoing inbound replies directly
router.post('/test-seed', (req: Request, res: Response) => {
  const sampleReply = {
    id: `reply_${Date.now()}`,
    from_e164: req.body.from_e164 || '+917439879074',
    from_name: req.body.from_name || 'Aditya Jha',
    body: req.body.body || 'Hi, received your broadcast! Thanks for the update.',
    is_stop: false,
    received_at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    timestamp: Date.now(),
  };
  inMemoryReplies.unshift(sampleReply);
  return res.json({ data: sampleReply });
});

export default router;
