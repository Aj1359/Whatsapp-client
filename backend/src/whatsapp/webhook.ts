import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookVerificationQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

export function verifyWebhookChallenge(
  query: WebhookVerificationQuery,
  expectedVerifyToken: string
): { isValid: boolean; challenge?: string } {
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === expectedVerifyToken) {
    return { isValid: true, challenge: query['hub.challenge'] };
  }
  return { isValid: false };
}

export function verifyMetaSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7);
  const hmac = createHmac('sha256', appSecret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const calculatedBuf = Buffer.from(calculatedSignature, 'hex');

  if (expectedBuf.length !== calculatedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, calculatedBuf);
}

export const STOP_WORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);

export function isStopReply(text: string): boolean {
  const trimmed = text.trim().toUpperCase();
  return STOP_WORDS.has(trimmed);
}

