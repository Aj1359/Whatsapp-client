import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Ensures key is always exactly 32 bytes for AES-256-GCM.
 */
function getValidKey(rawKey: string): Buffer {
  if (!rawKey) rawKey = 'reachflow-default-secret-encryption-key-2026';
  try {
    const b64 = Buffer.from(rawKey, 'base64');
    if (b64.length === 32) return b64;
  } catch {}
  return createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a string using AES-256-GCM.
 */
export function encryptToken(plaintext: string, base64Key: string): string {
  const key = getValidKey(base64Key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

export function decryptToken(ciphertext: string, base64Key: string): string {
  const key = getValidKey(base64Key);
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivB64, encB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

