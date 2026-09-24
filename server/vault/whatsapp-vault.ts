import { BusinessIntegration } from '../../src/types/database';
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

// In-memory server-side secure credentials vault.
// NEVER serialize accessToken in public or client responses.
const credentialsVault = new Map<string, WhatsAppBusinessCredentials>();

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

export function storeWhatsAppCredentials(
  businessId: string,
  credentials: WhatsAppBusinessCredentials
): void {
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

  // Attempt to persist metadata in Supabase business_integrations table (excluding raw token)
  const supabase = getServerSupabaseClient();
  if (supabase) {
    supabase
      .from('business_integrations')
      .upsert({
        business_id: businessId,
        provider: 'whatsapp_business',
        provider_account_id: credentials.phoneNumberId,
        provider_account_name: credentials.verifiedName || credentials.displayPhoneNumber || 'WhatsApp Business',
        status: 'CONNECTED',
        is_test_mode: Boolean(credentials.isTestMode),
        scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
        connected_at: credentials.connectedAt,
        last_health_check_at: credentials.lastHealthCheckAt || credentials.connectedAt,
        last_health_status: credentials.lastHealthStatus || 'healthy',
        metadata: {
          waba_id: credentials.wabaId,
          display_phone_number: credentials.displayPhoneNumber,
          quality_rating: credentials.qualityRating,
          code_verification_status: credentials.codeVerificationStatus,
          messaging_limit_tier: credentials.messagingLimitTier,
          webhook_subscribed: credentials.webhookSubscribed,
          connection_status: 'CONNECTED',
        },
        updated_at: now,
      })
      .then(
        () => {},
        (err) => {
          console.warn('Could not persist integration to Supabase:', err);
        }
      );
  }
}

export function getWhatsAppCredentials(businessId: string): WhatsAppBusinessCredentials | null {
  if (!businessId) return null;
  return credentialsVault.get(businessId) || null;
}

export function deleteWhatsAppCredentials(businessId: string): boolean {
  if (!businessId) return false;
  const existed = credentialsVault.delete(businessId);

  // Update Supabase integration status if available
  const supabase = getServerSupabaseClient();
  if (supabase) {
    supabase
      .from('business_integrations')
      .update({
        status: 'DISCONNECTED',
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', businessId)
      .eq('provider', 'whatsapp_business')
      .then(
        () => {},
        () => {}
      );
  }

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
