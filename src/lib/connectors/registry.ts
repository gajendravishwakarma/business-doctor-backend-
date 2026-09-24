import {
  ConnectorAdapter,
  ConnectorCapability,
  ConnectorProviderId,
  ConnectorProviderSpec,
  ClientSafeIntegration,
} from '../../types/connectors';
import { BusinessIntegration, ConnectorStatus } from '../../types/database';
import { WhatsAppBusinessAdapter, WHATSAPP_SPEC } from './adapters/whatsapp-adapter';
import { FacebookAdapter, FACEBOOK_SPEC } from './adapters/facebook-adapter';
import { InstagramAdapter, INSTAGRAM_SPEC } from './adapters/instagram-adapter';
import { YouTubeAdapter, YOUTUBE_SPEC } from './adapters/youtube-adapter';
import { RazorpayAdapter, RAZORPAY_SPEC } from './adapters/razorpay-adapter';

// Singleton instance registry
const whatsappAdapter = new WhatsAppBusinessAdapter();
const facebookAdapter = new FacebookAdapter();
const instagramAdapter = new InstagramAdapter();
const youtubeAdapter = new YouTubeAdapter();
const razorpayAdapter = new RazorpayAdapter();

export const CONNECTOR_ADAPTERS: Record<ConnectorProviderId, ConnectorAdapter> = {
  whatsapp_business: whatsappAdapter,
  facebook: facebookAdapter,
  instagram: instagramAdapter,
  youtube: youtubeAdapter,
  razorpay: razorpayAdapter,
};

export const CONNECTOR_SPECS: Record<ConnectorProviderId, ConnectorProviderSpec> = {
  whatsapp_business: WHATSAPP_SPEC,
  facebook: FACEBOOK_SPEC,
  instagram: INSTAGRAM_SPEC,
  youtube: YOUTUBE_SPEC,
  razorpay: RAZORPAY_SPEC,
};

/**
 * Returns all available connector specifications in display priority order
 */
export function getAllConnectorSpecs(): ConnectorProviderSpec[] {
  return [
    WHATSAPP_SPEC,
    FACEBOOK_SPEC,
    INSTAGRAM_SPEC,
    YOUTUBE_SPEC,
    RAZORPAY_SPEC,
  ];
}

/**
 * Returns a specific connector specification by provider ID
 */
export function getConnectorSpec(providerId: ConnectorProviderId): ConnectorProviderSpec {
  const spec = CONNECTOR_SPECS[providerId];
  if (!spec) {
    throw new Error(`Unknown connector provider: "${providerId}"`);
  }
  return spec;
}

/**
 * Returns the typed adapter instance for a provider
 */
export function getConnectorAdapter(providerId: ConnectorProviderId): ConnectorAdapter {
  const adapter = CONNECTOR_ADAPTERS[providerId];
  if (!adapter) {
    throw new Error(`No adapter registered for connector provider: "${providerId}"`);
  }
  return adapter;
}

/**
 * Checks if a specific capability is authorized for a tenant business
 * Verifies that the provider is actively connected, tenant matches, and capability is supported.
 */
export function checkConnectorCapability(
  businessId: string,
  provider: ConnectorProviderId,
  capability: ConnectorCapability,
  currentIntegrations: BusinessIntegration[]
): {
  allowed: boolean;
  reason?: string;
  status: ConnectorStatus;
} {
  if (!businessId) {
    return {
      allowed: false,
      reason: 'Tenant business ID is required.',
      status: 'NOT_CONNECTED',
    };
  }

  // Find integration record for this tenant and provider
  const integration = currentIntegrations.find(
    (i) => i.business_id === businessId && i.provider === provider
  );

  if (!integration) {
    return {
      allowed: false,
      reason: `Connector for "${provider}" has not been initialized for this business.`,
      status: 'NOT_CONNECTED',
    };
  }

  if (integration.status !== 'CONNECTED') {
    return {
      allowed: false,
      reason: `Connector "${provider}" is currently in "${integration.status}" status (must be CONNECTED).`,
      status: integration.status,
    };
  }

  // Verify adapter capability
  const adapter = getConnectorAdapter(provider);
  const supported = adapter.getCapabilities();
  if (!supported.includes(capability)) {
    return {
      allowed: false,
      reason: `Capability "${capability}" is not supported by connector "${provider}".`,
      status: 'CONNECTED',
    };
  }

  return {
    allowed: true,
    status: 'CONNECTED',
  };
}

/**
 * Client-Safe Sanitization: Strips all internal tokens, secrets, or secure vault refs
 * Guarantees that sensitive secrets never leak to the client/browser bundle.
 */
export function sanitizeIntegrationForClient(
  integration: BusinessIntegration
): ClientSafeIntegration {
  return {
    id: integration.id,
    business_id: integration.business_id,
    provider: integration.provider,
    provider_account_id: integration.provider_account_id,
    provider_account_name: integration.provider_account_name,
    status: integration.status,
    scopes: integration.scopes || [],
    connected_at: integration.connected_at,
    disconnected_at: integration.disconnected_at,
    last_health_check_at: integration.last_health_check_at,
    last_health_status: integration.last_health_status,
    last_error: integration.last_error,
    is_test_mode: Boolean(integration.is_test_mode),
    created_at: integration.created_at,
    updated_at: integration.updated_at,
    has_valid_credentials: Boolean(
      integration.status === 'CONNECTED' &&
        (integration.encrypted_credential_ref || integration.is_test_mode)
    ),
    key_id_preview: integration.token_metadata?.key_id_preview,
  };
}

/**
 * Generates default unconfigured integration models for a business.
 * Initial state is strictly 'NOT_CONNECTED'.
 */
export function getDefaultIntegrations(businessId: string): BusinessIntegration[] {
  const now = new Date().toISOString();
  const providers: ConnectorProviderId[] = [
    'whatsapp_business',
    'facebook',
    'instagram',
    'youtube',
    'razorpay',
  ];

  return providers.map((provider) => ({
    id: `int_${provider}_${businessId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
    business_id: businessId,
    provider,
    provider_account_id: null,
    provider_account_name: null,
    status: 'NOT_CONNECTED',
    scopes: [],
    token_metadata: {},
    encrypted_credential_ref: null,
    connected_at: null,
    disconnected_at: null,
    last_health_check_at: null,
    last_health_status: undefined,
    last_error: null,
    metadata: {},
    is_test_mode: false,
    created_at: now,
    updated_at: now,
  }));
}
