import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Validates and retrieves the 32-byte key:
 * Supports 32-byte base64 string, 64-character hex, or 32-character utf-8.
 * Throws if the resolved key is not exactly 32 bytes.
 */
function getValidKey(keyInput: string): Buffer {
  if (!keyInput) {
    throw new Error('ENCRYPTION_KEY is required and cannot be empty');
  }
  const trimmed = keyInput.trim();

  // 1. Try 32-byte base64
  try {
    const key = Buffer.from(trimmed, 'base64');
    if (key.length === 32) return key;
  } catch {}

  // 2. Try 64-character hex
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  // 3. Try 32-byte raw utf-8 string
  const raw = Buffer.from(trimmed, 'utf8');
  if (raw.length === 32) return raw;

  throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (as base64, hex, or utf-8)');
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

/**
 * Decrypts an AES-256-GCM encrypted string.
 */
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

  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Invalid IV or auth tag length');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
