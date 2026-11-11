/**
 * Broadcast sender service — sends messages to all PENDING recipients
 * in batches of 50, with per-message delivery tracking.
 */
import { supabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { decrypt } from '../utils/crypto.js';
import * as meta from './metaApi.js';

const BATCH_SIZE = 50;
const DELAY_MS = 1000; // 1 s between batches to respect rate limits

export async function sendBroadcast(broadcastId: string): Promise<void> {
  // 1. Load broadcast + credential
  const { data: bc, error: bcErr } = await supabase
    .from('broadcasts')
    .select('*, wa_credentials(*), templates(*)')
    .eq('id', broadcastId)
    .single();
  if (bcErr || !bc) throw new Error(`Broadcast not found: ${broadcastId}`);

  const cred = bc.wa_credentials as any;
  const token = decrypt(cred.access_token_enc);
  const phoneNumberId = cred.phone_number_id;

  // 2. Mark as SENDING
  await supabase.from('broadcasts').update({ status: 'SENDING', sent_at: new Date().toISOString() }).eq('id', broadcastId);

  // 3. Load all PENDING recipients
  const { data: recipients } = await supabase
    .from('broadcast_recipients')
    .select('id, mobile_number, display_name')
    .eq('broadcast_id', broadcastId)
    .eq('status', 'PENDING');

  const all = recipients ?? [];
  let sentCount = 0, failedCount = 0;

  // 4. Send in batches
  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (r: any) => {
        const result = await dispatchMessage(bc, cred, phoneNumberId, token, r.mobile_number);
        const isOk = 'messageId' in result;
        const patch: Record<string, unknown> = {
          status: isOk ? 'SENT' : 'FAILED',
          status_updated_at: new Date().toISOString(),
          sent_at: isOk ? new Date().toISOString() : null,
          wa_message_id: isOk ? result.messageId : null,
          error_code: !isOk ? result.code : null,
          error_message: !isOk ? result.error : null,
        };
        await supabase.from('broadcast_recipients').update(patch).eq('id', r.id);
        if (isOk) sentCount++; else failedCount++;
      })
    );
    if (i + BATCH_SIZE < all.length) await sleep(DELAY_MS);
  }

  // 5. Mark broadcast SENT
  await supabase.from('broadcasts').update({
    status: 'SENT',
    sent_count: sentCount,
    failed_count: failedCount,
    total_recipients: all.length,
  }).eq('id', broadcastId);

  logger.info({ broadcastId, sentCount, failedCount }, 'Broadcast complete');
}

async function dispatchMessage(
  bc: any, cred: any, phoneNumberId: string, token: string, to: string
): Promise<meta.SendResult> {
  try {
    if (bc.template_id && bc.templates) {
      const tmpl = bc.templates as any;
      return await meta.sendTemplate(phoneNumberId, token, {
        to,
        templateName: tmpl.name,
        languageCode: tmpl.language,
        components: bc.template_components ?? [],
      });
    }
    if (bc.media_url) {
      return await meta.sendMedia(phoneNumberId, token, {
        to,
        type: 'image',
        mediaUrl: bc.media_url,
        caption: bc.message_body ?? '',
      });
    }
    return await meta.sendText(phoneNumberId, token, { to, body: bc.message_body ?? '' });
  } catch (err: any) {
    return { error: err.message ?? 'Send failed' };
  }
}

/** Process follow-ups whose scheduled_at has passed */
export async function processFollowUps(): Promise<void> {
  const { data: followUps } = await supabase
    .from('follow_ups')
    .select('*, broadcasts(*, wa_credentials(*))')
    .eq('status', 'PENDING')
    .lte('scheduled_at', new Date().toISOString());

  for (const fu of followUps ?? []) {
    await processOneFollowUp(fu);
  }
}

async function processOneFollowUp(fu: any): Promise<void> {
  await supabase.from('follow_ups').update({ status: 'RUNNING' }).eq('id', fu.id);
  try {
    const bc = fu.broadcasts as any;
    const cred = bc.wa_credentials as any;
    const token = decrypt(cred.access_token_enc);
    const phoneNumberId = cred.phone_number_id;

    // Find recipients of the parent broadcast that match target_statuses
    const { data: eligible } = await supabase
      .from('broadcast_recipients')
      .select('mobile_number')
      .eq('broadcast_id', fu.broadcast_id)
      .in('status', fu.target_statuses ?? ['SENT', 'DELIVERED']);

    const numbers = (eligible ?? []).map((r: any) => r.mobile_number);

    // Insert follow_up_recipients
    if (numbers.length > 0) {
      await supabase.from('follow_up_recipients').upsert(
        numbers.map((m: string) => ({ follow_up_id: fu.id, mobile_number: m, status: 'PENDING' })),
        { onConflict: 'follow_up_id,mobile_number' }
      );

      // Send messages
      for (let i = 0; i < numbers.length; i += BATCH_SIZE) {
        const batch = numbers.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (mobile: string) => {
            const result = await dispatchMessage(fu, cred, phoneNumberId, token, mobile);
            const isOk = 'messageId' in result;
            await supabase
              .from('follow_up_recipients')
              .update({
                status: isOk ? 'SENT' : 'FAILED',
                status_updated_at: new Date().toISOString(),
                wa_message_id: isOk ? result.messageId : null,
                error_code: !isOk ? result.code : null,
                error_message: !isOk ? result.error : null,
                sent_at: isOk ? new Date().toISOString() : null,
              })
              .eq('follow_up_id', fu.id)
              .eq('mobile_number', mobile);
          })
        );
        if (i + BATCH_SIZE < numbers.length) await sleep(DELAY_MS);
      }
    }

    await supabase.from('follow_ups').update({ status: 'DONE', sent_at: new Date().toISOString() }).eq('id', fu.id);
  } catch (err) {
    logger.error({ err, followUpId: fu.id }, 'Follow-up failed');
    await supabase.from('follow_ups').update({ status: 'FAILED' }).eq('id', fu.id);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

