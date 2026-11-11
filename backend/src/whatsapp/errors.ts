/**
 * Meta WhatsApp Cloud API Error Code Mappings
 * Reference: Meta Graph API Error Codes & PRD Page 18
 */

export const RETRYABLE_CODES = new Set([
  130429, // Rate limit hit
  131056, // Too many requests per second
]);

export const CAMPAIGN_FATAL_CODES = new Set([
  190,    // Access token expired or invalid
  131048, // Spam rate limit reached
]);

export const PERMANENT_FAILURE_CODES = new Set([
  131026, // Message undeliverable or not registered on WhatsApp
  131049, // Meta chose not to deliver a marketing message (frequency cap / user fatigue)
  132000, // Template does not exist
  132001, // Template parameter count mismatch
  132012, // Template component format invalid
  // TODO: Confirm any regional WhatsApp Cloud API error codes against Meta developer changelog
]);

export type ErrorSeverity = 'retryable' | 'campaign_fatal' | 'permanent';

export function classifyMetaError(code: number | undefined, httpStatus?: number): {
  severity: ErrorSeverity;
  isRetryable: boolean;
  isCampaignFatal: boolean;
  message: string;
} {
  if (httpStatus && httpStatus >= 500) {
    return {
      severity: 'retryable',
      isRetryable: true,
      isCampaignFatal: false,
      message: `Meta 5xx Server Error (${httpStatus})`,
    };
  }

  if (code && CAMPAIGN_FATAL_CODES.has(code)) {
    return {
      severity: 'campaign_fatal',
      isRetryable: false,
      isCampaignFatal: true,
      message: code === 190 ? 'WhatsApp Access Token expired or invalid' : 'Meta spam rate limit reached',
    };
  }

  if (code && RETRYABLE_CODES.has(code)) {
    return {
      severity: 'retryable',
      isRetryable: true,
      isCampaignFatal: false,
      message: `Meta rate limit hit (${code})`,
    };
  }

  if (code && PERMANENT_FAILURE_CODES.has(code)) {
    return {
      severity: 'permanent',
      isRetryable: false,
      isCampaignFatal: false,
      message: `Permanent delivery error (${code})`,
    };
  }

  // Unknown codes default to permanent failure per PRD page 18
  return {
    severity: 'permanent',
    isRetryable: false,
    isCampaignFatal: false,
    message: code ? `Meta error code ${code}` : 'Unknown Meta API error',
  };
}

