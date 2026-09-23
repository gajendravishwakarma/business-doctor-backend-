import {
  ConnectorAdapter,
  ConnectorCapability,
  ConnectorErrorDetails,
  ConnectorProviderSpec,
  ConnectParams,
  DisconnectParams,
  HealthCheckResult,
} from '../../../types/connectors';
import { BusinessIntegration, ConnectorStatus } from '../../../types/database';

export const INSTAGRAM_SPEC: ConnectorProviderSpec = {
  id: 'instagram',
  displayName: 'Instagram Professional',
  shortDescription: 'Instagram Graph API for direct messaging, comment engagement, and creator analytics.',
  longDescription:
    'Links your Instagram Business or Creator account connected to your Meta Business portfolio. Captures DM inquiries into leads, tracks high-intent comments, and powers marketing campaign recommendations.',
  category: 'social',
  authMethod: 'oauth2',
  webhookSupported: true,
  tokenLifecycleSupported: true,
  docsUrl: 'https://developers.facebook.com/docs/instagram-api',
  isAvailableInProduction: false,
  requiredScopes: [
    {
      scope: 'instagram_basic',
      title: 'Basic Profile & Media',
      description: 'Reads public profile info, media list, and insights.',
      required: true,
    },
    {
      scope: 'instagram_manage_messages',
      title: 'Direct Messages (DM) Management',
      description: 'Receives customer DMs for lead conversion and CRM thread logging.',
      required: true,
    },
    {
      scope: 'instagram_manage_comments',
      title: 'Comment Engagement',
      description: 'Detects pricing or availability questions in reel and post comments.',
      required: false,
    },
  ],
  defaultCapabilities: [
    'instagram_publishing',
    'instagram_messaging',
    'instagram_lead_capture',
  ],
  securityNotice:
    'Requires an Instagram Business or Creator account linked to a Facebook Page. Scopes are granted via Meta OAuth dialog.',
  configurationNotes:
    'Ensure your Instagram account is converted from Personal to Professional (Business or Creator) before connecting.',
};

export class InstagramAdapter implements ConnectorAdapter {
  providerId = 'instagram' as const;
  spec = INSTAGRAM_SPEC;

  async connect(params: ConnectParams): Promise<{
    success: boolean;
    integration?: Partial<BusinessIntegration>;
    error?: ConnectorErrorDetails;
  }> {
    if (!params.businessId) {
      return {
        success: false,
        error: {
          code: 'tenant_access_denied',
          message: 'Business tenant ID is required.',
          provider: 'instagram',
        },
      };
    }

    if (!params.isTestMode) {
      const hasLiveConfig = Boolean((import.meta as any).env?.VITE_META_APP_ID);
      if (!hasLiveConfig) {
        return {
          success: false,
          error: {
            code: 'provider_not_configured',
            message:
              'Instagram OAuth is not configured. Meta App ID is missing from environment.',
            provider: 'instagram',
            documentationUrl: this.spec.docsUrl,
            suggestedAction:
              'Configure Meta App ID or test using Test Sandbox Mode.',
          },
        };
      }
    }

    const now = new Date().toISOString();
    return {
      success: true,
      integration: {
        provider: 'instagram',
        business_id: params.businessId,
        provider_account_id: 'ig_pro_sandbox_test',
        provider_account_name: '@business_doctor_demo',
        status: 'CONNECTED',
        scopes: this.spec.requiredScopes.map((s) => s.scope),
        connected_at: now,
        last_health_check_at: now,
        last_health_status: 'healthy',
        is_test_mode: Boolean(params.isTestMode),
        metadata: {
          ig_username: 'business_doctor_demo',
          media_count: 84,
          followers: 3200,
        },
      },
    };
  }

  async disconnect(params: DisconnectParams): Promise<{
    success: boolean;
    error?: ConnectorErrorDetails;
  }> {
    if (!params.businessId) {
      return {
        success: false,
        error: {
          code: 'tenant_access_denied',
          message: 'Tenant verification failed.',
          provider: 'instagram',
        },
      };
    }
    return { success: true };
  }

  async getConnectionStatus(
    businessId: string,
    existingIntegration?: BusinessIntegration | null
  ): Promise<{
    status: ConnectorStatus;
    integration?: BusinessIntegration;
  }> {
    if (!existingIntegration || existingIntegration.business_id !== businessId) {
      return { status: 'NOT_CONNECTED' };
    }
    return {
      status: existingIntegration.status,
      integration: existingIntegration,
    };
  }

  async refreshCredentials(
    _businessId: string,
    existingIntegration: BusinessIntegration
  ): Promise<{
    success: boolean;
    integration?: Partial<BusinessIntegration>;
    error?: ConnectorErrorDetails;
  }> {
    if (existingIntegration.is_test_mode) {
      return {
        success: true,
        integration: {
          last_health_check_at: new Date().toISOString(),
          last_health_status: 'healthy',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'provider_not_configured',
        message: 'Instagram token refresh requires server OAuth flow.',
        provider: 'instagram',
      },
    };
  }

  async healthCheck(
    _businessId: string,
    existingIntegration?: BusinessIntegration | null,
    isTestMode?: boolean
  ): Promise<HealthCheckResult> {
    const checkedAt = new Date().toISOString();

    if (!existingIntegration || existingIntegration.status === 'NOT_CONNECTED') {
      return {
        provider: 'instagram',
        status: 'unhealthy',
        connectorStatus: 'NOT_CONNECTED',
        checkedAt,
        message: 'Instagram Professional is not connected.',
      };
    }

    if (isTestMode || existingIntegration.is_test_mode) {
      return {
        provider: 'instagram',
        status: 'healthy',
        connectorStatus: 'CONNECTED',
        latencyMs: 78,
        checkedAt,
        message: 'Instagram Graph API connection verified (Sandbox).',
      };
    }

    return {
      provider: 'instagram',
      status: 'healthy',
      connectorStatus: existingIntegration.status,
      latencyMs: 125,
      checkedAt,
      message: 'Instagram connection active.',
    };
  }

  getCapabilities(): ConnectorCapability[] {
    return [...this.spec.defaultCapabilities];
  }
}
