import { describe, it, expect, vi } from 'vitest';
import { verifyMetaSignature, verifyWebhookChallenge, isStopReply } from '../src/whatsapp/webhook.js';
import { normalisePhoneNumber, maskPhoneNumber } from '../src/lib/phone.js';
import { encryptToken, decryptToken } from '../src/lib/crypto.js';
import { classifyMetaError } from '../src/whatsapp/errors.js';
import { createHmac } from 'crypto';

describe('Stage 10: ReachFlow V2 Security, Webhook & Integrity Test Suite', () => {
  const TEST_KEY = Buffer.alloc(32, 'a').toString('base64');
  const APP_SECRET = 'meta_test_secret_key_12345';

  describe('1. Webhook Signature & Handshake Verification', () => {
    it('correctly validates hub handshake when verify_token matches', () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'my_secure_token',
        'hub.challenge': 'challenge_123456',
      };
      const res = verifyWebhookChallenge(query, 'my_secure_token');
      expect(res.isValid).toBe(true);
      expect(res.challenge).toBe('challenge_123456');
    });

    it('rejects handshake when verify_token does not match', () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'challenge_123456',
      };
      const res = verifyWebhookChallenge(query, 'my_secure_token');
      expect(res.isValid).toBe(false);
    });

    it('validates HMAC-SHA256 signature when correct', () => {
      const body = JSON.stringify({ object: 'whatsapp_business_account' });
      const hmac = createHmac('sha256', APP_SECRET).update(body).digest('hex');
      const signatureHeader = `sha256=${hmac}`;

      expect(verifyMetaSignature(body, signatureHeader, APP_SECRET)).toBe(true);
    });

    it('strictly rejects when signature header is missing or tampered', () => {
      const body = JSON.stringify({ object: 'whatsapp_business_account' });
      expect(verifyMetaSignature(body, undefined, APP_SECRET)).toBe(false);
      expect(verifyMetaSignature(body, 'sha256=invalid_hex_string', APP_SECRET)).toBe(false);
      expect(verifyMetaSignature(body, 'sha256=0000000000000000000000000000000000000000000000000000000000000000', APP_SECRET)).toBe(false);
    });
  });

  describe('2. STOP Opt-Out & Sensitivity', () => {
    it('recognises all standard STOP commands (case-insensitive & trimmed)', () => {
      expect(isStopReply('stop')).toBe(true);
      expect(isStopReply(' STOP ')).toBe(true);
      expect(isStopReply('unsubscribe')).toBe(true);
      expect(isStopReply('CANCEL')).toBe(true);
      expect(isStopReply('End')).toBe(true);
      expect(isStopReply('quit')).toBe(true);
    });

    it('does not trigger stop on standard conversational replies', () => {
      expect(isStopReply('Please stop by tomorrow')).toBe(false);
      expect(isStopReply('Non-stop service')).toBe(false);
      expect(isStopReply('Hello, what are your prices?')).toBe(false);
    });
  });

  describe('3. Phone Normalisation & Masking', () => {
    it('normalises 10-digit Indian numbers with default IN country to E.164', () => {
      const res = normalisePhoneNumber('9876543210', 'IN');
      expect(res.isValid).toBe(true);
      expect(res.e164).toBe('+919876543210');
    });

    it('rejects invalid or gibberish phone numbers', () => {
      const res = normalisePhoneNumber('12345', 'IN');
      expect(res.isValid).toBe(false);
    });

    it('masks phone numbers for privacy in logs', () => {
      expect(maskPhoneNumber('+919876543210')).toBe('+9198*****10');
    });
  });

  describe('4. AES-256-GCM Token Encryption', () => {
    it('encrypts and decrypts secret tokens losslessly with authenticated tag', () => {
      const plain = 'EAAG...MetaPermanentSystemUserToken';
      const encrypted = encryptToken(plain, TEST_KEY);
      expect(encrypted).toContain(':');
      const decrypted = decryptToken(encrypted, TEST_KEY);
      expect(decrypted).toBe(plain);
    });

    it('throws error when ciphertext format or key length is invalid', () => {
      expect(() => decryptToken('invalid:format', TEST_KEY)).toThrow();
      expect(() => encryptToken('secret', Buffer.alloc(16, 'a').toString('base64'))).toThrow();
    });
  });

  describe('5. Meta Cloud API Error Classification', () => {
    it('correctly classifies campaign-fatal codes (190, 131048)', () => {
      const err190 = classifyMetaError(190);
      expect(err190.isCampaignFatal).toBe(true);
      expect(err190.severity).toBe('campaign_fatal');

      const err131048 = classifyMetaError(131048);
      expect(err131048.isCampaignFatal).toBe(true);
    });

    it('classifies rate-limits and 5xx as retryable with backoff', () => {
      const rateLimit = classifyMetaError(130429);
      expect(rateLimit.isRetryable).toBe(true);

      const server500 = classifyMetaError(undefined, 500);
      expect(server500.isRetryable).toBe(true);
    });

    it('classifies undeliverable numbers as permanent failures', () => {
      const notOnWa = classifyMetaError(131026);
      expect(notOnWa.isRetryable).toBe(false);
      expect(notOnWa.isCampaignFatal).toBe(false);
    });
  });
});
