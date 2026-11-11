import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Normalise a phone number to standard E.164 (+919876543210).
 * Uses organization's default country (defaults to 'IN').
 */
export function normalisePhoneNumber(input: string, defaultCountry = 'IN'): {
  isValid: boolean;
  e164?: string;
  raw: string;
} {
  const cleaned = input.trim();
  try {
    const parsed = parsePhoneNumber(cleaned, defaultCountry as any);
    if (parsed && parsed.isValid()) {
      return {
        isValid: true,
        e164: parsed.format('E.164'),
        raw: cleaned,
      };
    }
  } catch {
    // parse failed
  }

  return { isValid: false, raw: cleaned };
}

/**
 * Masks phone numbers for logging per PRD requirement:
 * "+9198*****10 and never include tokens"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  const start = phone.slice(0, 5);
  const end = phone.slice(-2);
  return `${start}*****${end}`;
}

