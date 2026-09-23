/**
 * Strict validator for WhatsApp Cloud API entities, identifiers, and webhook payloads.
 * Protects against injection, spoofing, and malformed inputs.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

const IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;
const BUSINESS_ID_REGEX = /^[a-zA-Z0-9_-]{3,128}$/;
const EXTERNAL_MESSAGE_ID_REGEX = /^[a-zA-Z0-9._:-]{3,256}$/;
const PHONE_NUMBER_ID_REGEX = /^(\d{7,32}|phone_[a-zA-Z0-9_-]+)$/;

export function validateProvider(provider: unknown): ValidationResult {
  if (typeof provider !== 'string' || !provider) {
    return { valid: false, error: 'Provider is required and must be a string.', code: 'INVALID_PROVIDER' };
  }
  const clean = provider.trim().toLowerCase();
  if (clean !== 'whatsapp' && clean !== 'whatsapp_business') {
    return {
      valid: false,
      error: `Unsupported provider: "${provider}". Expected "whatsapp" or "whatsapp_business".`,
      code: 'UNSUPPORTED_PROVIDER',
    };
  }
  return { valid: true };
}

export function validateWabaId(wabaId: unknown): ValidationResult {
  if (typeof wabaId !== 'string' || !wabaId.trim()) {
    return { valid: false, error: 'WABA ID is required and must be a non-empty string.', code: 'INVALID_WABA_ID' };
  }
  const clean = wabaId.trim();
  if (!IDENTIFIER_REGEX.test(clean)) {
    return {
      valid: false,
      error: `Malformed WABA ID format: "${wabaId}". Must be 3-64 alphanumeric characters, hyphens, or underscores.`,
      code: 'MALFORMED_WABA_ID',
    };
  }
  return { valid: true };
}

export function validatePhoneNumberId(phoneNumberId: unknown): ValidationResult {
  if (typeof phoneNumberId !== 'string' || !phoneNumberId.trim()) {
    return {
      valid: false,
      error: 'Phone Number ID is required and must be a non-empty string.',
      code: 'INVALID_PHONE_NUMBER_ID',
    };
  }
  const clean = phoneNumberId.trim();
  if (!PHONE_NUMBER_ID_REGEX.test(clean)) {
    return {
      valid: false,
      error: `Malformed Phone Number ID format: "${phoneNumberId}". Must be numeric digits or standard test format.`,
      code: 'MALFORMED_PHONE_NUMBER_ID',
    };
  }
  return { valid: true };
}

export function validateBusinessId(businessId: unknown): ValidationResult {
  if (typeof businessId !== 'string' || !businessId.trim()) {
    return {
      valid: false,
      error: 'Business ID is required and must be a non-empty string.',
      code: 'INVALID_BUSINESS_ID',
    };
  }
  const clean = businessId.trim();
  if (!BUSINESS_ID_REGEX.test(clean)) {
    return {
      valid: false,
      error: `Malformed Business ID format: "${businessId}". Must be 3-128 alphanumeric characters, hyphens, or underscores.`,
      code: 'MALFORMED_BUSINESS_ID',
    };
  }
  return { valid: true };
}

export function validateExternalMessageId(messageId: unknown): ValidationResult {
  if (typeof messageId !== 'string' || !messageId.trim()) {
    return {
      valid: false,
      error: 'External Message ID is required and must be a non-empty string.',
      code: 'INVALID_MESSAGE_ID',
    };
  }
  const clean = messageId.trim();
  if (!EXTERNAL_MESSAGE_ID_REGEX.test(clean)) {
    return {
      valid: false,
      error: `Malformed External Message ID: "${messageId}". Must be 3-256 alphanumeric characters, dots, colons, or underscores.`,
      code: 'MALFORMED_MESSAGE_ID',
    };
  }
  return { valid: true };
}

export function validateWebhookPayload(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Webhook payload must be a valid JSON object.', code: 'INVALID_BODY' };
  }

  const payload = body as Record<string, any>;
  if (payload.object !== 'whatsapp_business_account') {
    return {
      valid: false,
      error: `Invalid webhook object: "${payload.object}". Expected "whatsapp_business_account".`,
      code: 'MALFORMED_PAYLOAD',
    };
  }

  if (!Array.isArray(payload.entry) || payload.entry.length === 0) {
    return {
      valid: false,
      error: 'Webhook payload missing "entry" array.',
      code: 'MALFORMED_PAYLOAD',
    };
  }

  for (const entry of payload.entry) {
    if (!entry || typeof entry !== 'object' || !entry.id) {
      return {
        valid: false,
        error: 'Each entry in webhook payload must contain a valid WABA ID.',
        code: 'MALFORMED_ENTRY',
      };
    }
  }

  return { valid: true };
}
