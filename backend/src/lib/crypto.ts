import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Validates and retrieves the 32-byte key from base64 representation.
 * Throws if the key is not exactly 32 bytes.
 */
function getValidKey(base64Key: string): Buffer {
  if (!base64Key) {
    throw new Error('ENCRYPTION_KEY is required and cannot be empty');
  }
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes when base64-decoded');
  }
  return key;
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
