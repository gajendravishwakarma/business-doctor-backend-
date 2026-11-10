import { BusinessIntegration } from '../../src/types/database';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  WhatsAppConnectionRecord,
  WhatsAppConnectorStatus,
  WhatsAppWebhookHealthDashboard,
} from '../../src/types/whatsapp-onboarding';
import { getServerSupabaseClient } from '../auth';

export interface WhatsAppBusinessCredentials {
  businessId: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  codeVerificationStatus?: string;
  messagingLimitTier?: string;
  webhookSubscribed?: boolean;
  connectedAt: string;
  lastHealthCheckAt?: string;
  lastHealthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  isTestMode?: boolean;
  connectionStatus?: WhatsAppConnectorStatus;
  lastWebhookReceivedAt?: string | null;
  lastSuccessfulOutboundAt?: string | null;
  lastError?: string | null;
  errorCount?: number;
}

// Runtime cache is restored from the encrypted database vault on every boot.
const credentialsVault = new Map<string, WhatsAppBusinessCredentials>();
function encryptionKey(): Buffer {
  const key = Buffer.from(process.env.OAUTH_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}
function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
function decryptToken(payload: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported encrypted WhatsApp token format.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
export async function initializeWhatsAppVault(): Promise<void> {
  const supabase = getServerSupabaseClient();
  if (!supabase) throw new Error('Supabase service-role client is required to restore WhatsApp credentials.');
  encryptionKey();
  const { data, error } = await supabase.from('oauth_token_vault')
    .select('business_id, encrypted_access_token, provider_account_id, provider_account_name, metadata, created_at')
    .eq('provider', 'whatsapp_business');
  if (error) throw new Error('Could not restore WhatsApp credentials: ' + error.message);
  for (const row of data || []) {
    try {
      const m = row.metadata || {};
      credentialsVault.set(row.business_id, {
        businessId: row.business_id, phoneNumberId: row.provider_account_id || '',
        wabaId: m.waba_id || '', accessToken: decryptToken(row.encrypted_access_token),
        displayPhoneNumber: m.display_phone_number || undefined,
        verifiedName: row.provider_account_name || undefined,
        qualityRating: m.quality_rating || undefined,
        codeVerificationStatus: m.code_verification_status || undefined,
        messagingLimitTier: m.messaging_limit_tier || undefined,
        webhookSubscribed: Boolean(m.webhook_subscribed), connectedAt: row.created_at,
        lastHealthCheckAt: m.last_health_check_at || undefined,
        lastHealthStatus: m.last_health_status || 'healthy',
        isTestMode: Boolean(m.is_test_mode), connectionStatus: m.connection_status || 'CONNECTED',
        lastWebhookReceivedAt: m.last_webhook_received_at || null,
        lastSuccessfulOutboundAt: m.last_successful_outbound_at || null,
        lastError: m.last_error || null, errorCount: Number(m.error_count || 0),
      });
    } catch (err) {
      console.error('WhatsApp token restore failed for one business; reconnect required.', err);
    }
  }
}

// Seed fake credentials only in automated test environments; never in production.
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  credentialsVault.set('biz_01_health_bengaluru', {
    businessId: 'biz_01_health_bengaluru',
    phoneNumberId: '109283746501928',
    wabaId: 'waba_veda_bengaluru_01',
    accessToken: 'EAAG_test_system_user_token_veda_health_998877',
    displayPhoneNumber: '+91 98765 43210',
    verifiedName: 'VedaVeda Ayurveda & Wellness',
    qualityRating: 'GREEN',
    codeVerificationStatus: 'VERIFIED',
    messagingLimitTier: 'TIER_1K',
    webhookSubscribed: true,
    connectedAt: new Date().toISOString(),
    lastHealthCheckAt: new Date().toISOString(),
    lastHealthStatus: 'healthy',
    isTestMode: false,
    connectionStatus: 'CONNECTED',
    lastWebhookReceivedAt: new Date().toISOString(),
    lastSuccessfulOutboundAt: null,
    lastError: null,
    errorCount: 0,
  });
}

export async function storeWhatsAppCredentials(
  businessId: string,
  credentials: WhatsAppBusinessCredentials
): Promise<void> {
  if (!businessId || !credentials.phoneNumberId || !credentials.accessToken) {
    throw new Error('businessId, phoneNumberId, and accessToken are required to store WhatsApp credentials.');
  }

  const existing = credentialsVault.get(businessId);
  const now = new Date().toISOString();

  credentialsVault.set(businessId, {
    ...credentials,
    businessId,
    connectionStatus: credentials.connectionStatus || 'CONNECTED',
    lastWebhookReceivedAt: credentials.lastWebhookReceivedAt ?? existing?.lastWebhookReceivedAt ?? null,
    lastSuccessfulOutboundAt: credentials.lastSuccessfulOutboundAt ?? existing?.lastSuccessfulOutboundAt ?? null,
    lastError: credentials.lastError ?? null,
    errorCount: credentials.errorCount ?? existing?.errorCount ?? 0,
  });

  const supabase = getServerSupabaseClient();
  if (!supabase) throw new Error('Supabase service-role client unavailable; refusing memory-only token storage.');
  const saved = credentialsVault.get(businessId)!;
  const { error: vaultError } = await supabase.from('oauth_token_vault').upsert({
    id: `${businessId}:whatsapp_business`, business_id: businessId, provider: 'whatsapp_business',
    encrypted_access_token: encryptToken(credentials.accessToken), encrypted_refresh_token: null,
    token_type: 'bearer', scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    expires_at: null, provider_account_id: credentials.phoneNumberId,
    provider_account_name: credentials.verifiedName || credentials.displayPhoneNumber || 'WhatsApp Business',
    metadata: {
      waba_id: credentials.wabaId, display_phone_number: credentials.displayPhoneNumber,
      quality_rating: credentials.qualityRating, code_verification_status: credentials.codeVerificationStatus,
      messaging_limit_tier: credentials.messagingLimitTier, webhook_subscribed: credentials.webhookSubscribed,
      connection_status: saved.connectionStatus, last_health_check_at: saved.lastHealthCheckAt,
      last_health_status: saved.lastHealthStatus, is_test_mode: Boolean(saved.isTestMode),
      last_webhook_received_at: saved.lastWebhookReceivedAt,
      last_successful_outbound_at: saved.lastSuccessfulOutboundAt, last_error: saved.lastError,
      error_count: saved.errorCount,
    }, updated_at: now,
  }, { onConflict: 'business_id,provider' });
  if (vaultError) throw new Error('Could not securely save WhatsApp token: ' + vaultError.message);

  const { error: integrationError } = await supabase.from('business_integrations').upsert({
    business_id: businessId, provider: 'whatsapp_business',
    provider_account_id: credentials.phoneNumberId,
    provider_account_name: credentials.verifiedName || credentials.displayPhoneNumber || 'WhatsApp Business',
    status: 'CONNECTED', is_test_mode: Boolean(credentials.isTestMode),
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    connected_at: credentials.connectedAt,
    last_health_check_at: credentials.lastHealthCheckAt || credentials.connectedAt,
    last_health_status: credentials.lastHealthStatus || 'healthy',
    metadata: {
      waba_id: credentials.wabaId, display_phone_number: credentials.displayPhoneNumber,
      quality_rating: credentials.qualityRating, code_verification_status: credentials.codeVerificationStatus,
      messaging_limit_tier: credentials.messagingLimitTier, webhook_subscribed: credentials.webhookSubscribed,
      connection_status: 'CONNECTED',
    }, updated_at: now,
  });
  if (integrationError) throw new Error('Could not persist WhatsApp integration metadata: ' + integrationError.message);
}

export function getWhatsAppCredentials(businessId: string): WhatsAppBusinessCredentials | null {
  if (!businessId) return null;
  return credentialsVault.get(businessId) || null;
}

export async function deleteWhatsAppCredentials(businessId: string): Promise<boolean> {
  if (!businessId) return false;
  const existed = credentialsVault.delete(businessId);

  const supabase = getServerSupabaseClient();
  if (!supabase) throw new Error('Supabase service-role client unavailable; cannot disconnect WhatsApp securely.');
  const { error: vaultError } = await supabase.from('oauth_token_vault').delete().eq('business_id', businessId).eq('provider', 'whatsapp_business');
  if (vaultError) throw new Error('Could not delete encrypted WhatsApp token: ' + vaultError.message);
  const { error: integrationError } = await supabase.from('business_integrations')
    .update({ status: 'DISCONNECTED', disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('business_id', businessId).eq('provider', 'whatsapp_business');
  if (integrationError) throw new Error('Could not update WhatsApp integration: ' + integrationError.message);

  return existed;
}

export function hasValidWhatsAppCredentials(businessId: string): boolean {
  const creds = getWhatsAppCredentials(businessId);
  return Boolean(creds && creds.accessToken && creds.phoneNumberId);
}

/**
 * Returns safe metadata for the client UI. Strictly masks or omits access tokens.
 */
export function getMaskedWhatsAppCredentials(businessId: string): Omit<WhatsAppBusinessCredentials, 'accessToken'> | null {
  const creds = getWhatsAppCredentials(businessId);
  if (!creds) return null;

  const { accessToken: _, ...safeCreds } = creds;
  return safeCreds;
}

/**
 * Retrieves the tenant-safe WhatsApp connection record
 */
export function getWhatsAppConnectionRecord(businessId: string): WhatsAppConnectionRecord {
  const creds = getWhatsAppCredentials(businessId);
  const now = new Date().toISOString();

  if (!creds) {
    return {
      business_id: businessId,
      provider: 'whatsapp_business',
      waba_id: '',
      phone_number_id: '',
      display_phone_number: '',
      verified_name: '',
      connection_status: 'DISCONNECTED',
      capabilities: [],
      last_health_check: null,
      last_webhook_received_at: null,
      created_at: now,
      updated_at: now,
    };
  }

  return {
    business_id: businessId,
    provider: 'whatsapp_business',
    waba_id: creds.wabaId,
    phone_number_id: creds.phoneNumberId,
    display_phone_number: creds.displayPhoneNumber || creds.phoneNumberId,
    verified_name: creds.verifiedName || 'WhatsApp Account',
    connection_status: creds.connectionStatus || 'CONNECTED',
    capabilities: [
      'inbound_messaging',
      'outbound_messaging',
      'template_messaging',
      'inbound_webhooks',
      'human_in_the_loop_approvals',
    ],
    last_health_check: creds.lastHealthCheckAt || null,
    last_webhook_received_at: creds.lastWebhookReceivedAt || null,
    created_at: creds.connectedAt || now,
    updated_at: creds.lastHealthCheckAt || now,
  };
}

/**
 * Updates connection status in the state machine:
 * DISCONNECTED | CONNECTING | CONNECTED | DEGRADED | ERROR | DISCONNECTING
 */
export function updateWhatsAppConnectionStatus(
  businessId: string,
  status: WhatsAppConnectorStatus,
  error?: string
): void {
  const creds = getWhatsAppCredentials(businessId);
  if (creds) {
    creds.connectionStatus = status;
    if (error) {
      creds.lastError = error;
      creds.errorCount = (creds.errorCount || 0) + 1;
    }
  }
}

/**
 * Updates last_webhook_received_at timestamp for the tenant
 */
export function recordWhatsAppWebhookReceived(businessId: string, timestamp?: string): void {
  const creds = getWhatsAppCredentials(businessId);
  if (creds) {
    creds.lastWebhookReceivedAt = timestamp || new Date().toISOString();
    if (creds.connectionStatus === 'ERROR' || creds.connectionStatus === 'DEGRADED') {
      creds.connectionStatus = 'CONNECTED';
    }
  }
}

/**
 * Updates health check diagnostics for the tenant
 */
export function recordWhatsAppHealthCheck(
  businessId: string,
  status: 'healthy' | 'degraded' | 'unhealthy',
  error?: string
): void {
  const creds = getWhatsAppCredentials(businessId);
  if (creds) {
    creds.lastHealthCheckAt = new Date().toISOString();
    creds.lastHealthStatus = status;
    if (status === 'unhealthy') {
      creds.connectionStatus = 'ERROR';
    } else if (status === 'degraded') {
      creds.connectionStatus = 'DEGRADED';
    } else {
      creds.connectionStatus = 'CONNECTED';
    }
    if (error) {
      creds.lastError = error;
      creds.errorCount = (creds.errorCount || 0) + 1;
    }
  }
}

/**
 * Updates outbound metrics
 */
export function recordWhatsAppOutboundSuccess(businessId: string): void {
  const creds = getWhatsAppCredentials(businessId);
  if (creds) {
    creds.lastSuccessfulOutboundAt = new Date().toISOString();
  }
}

export function recordWhatsAppOutboundFailure(businessId: string, error: string): void {
  const creds = getWhatsAppCredentials(businessId);
  if (creds) {
    creds.lastError = error;
    creds.errorCount = (creds.errorCount || 0) + 1;
  }
}

/**
 * Returns comprehensive Webhook Health Dashboard metrics for tenant
 */
export function getWhatsAppWebhookDashboardHealth(
  businessId: string,
  isWebhookVerified = true
): WhatsAppWebhookHealthDashboard {
  const creds = getWhatsAppCredentials(businessId);
  const now = new Date().toISOString();

  if (!creds) {
    const disconnectedRecord = getWhatsAppConnectionRecord(businessId);
    return {
      connected: false,
      webhook_verified: false,
      last_webhook: null,
      last_successful_outbound: null,
      last_error: 'Connector is not configured or connected for this business.',
      error_count: 0,
      tenant: businessId,
      waba: 'unconfigured',
      WABA: 'unconfigured',
      phone_number: 'unconfigured',
      status: 'DISCONNECTED',
      connection_record: disconnectedRecord,
      timestamp: now,
    };
  }

  const record = getWhatsAppConnectionRecord(businessId);

  return {
    connected: creds.connectionStatus === 'CONNECTED' || creds.connectionStatus === 'DEGRADED',
    webhook_verified: isWebhookVerified && Boolean(creds.webhookSubscribed),
    last_webhook: creds.lastWebhookReceivedAt || null,
    last_successful_outbound: creds.lastSuccessfulOutboundAt || null,
    last_error: creds.lastError || null,
    error_count: creds.errorCount || 0,
    tenant: businessId,
    waba: creds.wabaId,
    WABA: creds.wabaId,
    phone_number: creds.displayPhoneNumber || creds.phoneNumberId,
    phone_number_id: creds.phoneNumberId,
    status: creds.connectionStatus || 'CONNECTED',
    connection_record: record,
    timestamp: now,
  };
}

export const whatsAppVault = {
  storeCredential: (creds: { businessId: string; phoneNumberId: string; accessToken: string; wabaId?: string; isTestMode?: boolean }) => {
    storeWhatsAppCredentials(creds.businessId, {
      businessId: creds.businessId,
      phoneNumberId: creds.phoneNumberId,
      accessToken: creds.accessToken,
      wabaId: creds.wabaId || 'waba_default',
      connectedAt: new Date().toISOString(),
      isTestMode: creds.isTestMode,
    });
  },
  getCredential: (businessId: string) => getWhatsAppCredentials(businessId),
  deleteCredential: (businessId: string) => deleteWhatsAppCredentials(businessId),
  hasCredential: (businessId: string) => hasValidWhatsAppCredentials(businessId),
  getMasked: (businessId: string) => getMaskedWhatsAppCredentials(businessId),
  getConnectionRecord: (businessId: string) => getWhatsAppConnectionRecord(businessId),
  getDashboardHealth: (businessId: string) => getWhatsAppWebhookDashboardHealth(businessId),
  reset: () => resetVaultTestState(),
};

/**
 * Test helper to reset vault state between test suites
 */
export function resetVaultTestState(): void {
  credentialsVault.clear();

  // Re-seed default test credentials only for automated tests
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) return;
  credentialsVault.set('biz_01_health_bengaluru', {
    businessId: 'biz_01_health_bengaluru',
    phoneNumberId: '109283746501928',
    wabaId: 'waba_veda_bengaluru_01',
    accessToken: 'EAAG_test_system_user_token_veda_health_998877',
    displayPhoneNumber: '+91 98765 43210',
    verifiedName: 'VedaVeda Ayurveda & Wellness',
    qualityRating: 'GREEN',
    codeVerificationStatus: 'VERIFIED',
    messagingLimitTier: 'TIER_1K',
    webhookSubscribed: true,
    connectedAt: new Date().toISOString(),
    lastHealthCheckAt: new Date().toISOString(),
    lastHealthStatus: 'healthy',
    isTestMode: false,
    connectionStatus: 'CONNECTED',
    lastWebhookReceivedAt: new Date().toISOString(),
    lastSuccessfulOutboundAt: null,
    lastError: null,
    errorCount: 0,
  });
}
