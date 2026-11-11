import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Normalize a phone number to E.164 format.
 * Accepts inputs like "9876543210", "+91 98765 43210", "09876543210"
 * defaultCountry fallback: 'IN' (India)
 */
export function toE164(raw: string, defaultCountry = 'IN'): string | null {
  try {
    const cleaned = raw.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    if (!cleaned) return null;
    const phone = parsePhoneNumber(cleaned, defaultCountry as any);
    if (!phone || !phone.isValid()) return null;
    return phone.format('E.164');
  } catch {
    return null;
  }
}

export function isValidE164(num: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(num);
}

