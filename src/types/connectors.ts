import { BusinessIntegration, ConnectorProviderId, ConnectorStatus } from './database';

export type { ConnectorProviderId, ConnectorStatus, BusinessIntegration };

export type ConnectorCategory = 'messaging' | 'social' | 'video' | 'payments';

export type ConnectorCapability =
  // WhatsApp Business capabilities
  | 'whatsapp_receive_messages'
  | 'whatsapp_send_messages'
  | 'whatsapp_customer_support'
  | 'whatsapp_lead_capture'
  | 'whatsapp_lead_followup'
  | 'whatsapp_booking'
  | 'whatsapp_notifications'
  // Facebook capabilities
  | 'facebook_page_management'
  | 'facebook_publishing'
  | 'facebook_messaging'
  | 'facebook_lead_capture'
  // Instagram capabilities
  | 'instagram_publishing'
  | 'instagram_messaging'
  | 'instagram_lead_capture'
  // YouTube capabilities
  | 'youtube_channel_read'
  | 'youtube_analytics'
  | 'youtube_video_upload'
  | 'youtube_playlist_management'
  // Razorpay capabilities
  | 'razorpay_payments'
  | 'razorpay_payment_status'
  | 'razorpay_subscriptions'
  | 'razorpay_refunds';

export type ConnectorAuthMethod = 'embedded_signup' | 'oauth2' | 'api_key_secret';

export type ConnectorErrorCode =
  | 'provider_not_configured'
  | 'authorization_required'
  | 'authorization_denied'
  | 'token_expired'
  | 'insufficient_permissions'
  | 'provider_unavailable'
  | 'webhook_verification_failed'
  | 'tenant_access_denied'
  | 'connection_not_found'
  | 'rate_limited'
  | 'rate_limit_or_network'
  | 'invalid_parameters';

export interface ConnectorErrorDetails {
  code: ConnectorErrorCode;
  message: string;
  provider: ConnectorProviderId;
  statusCode?: number;
  retryable?: boolean;
  documentationUrl?: string;
  suggestedAction?: string;
}

export class ConnectorError extends Error {
  code: ConnectorErrorCode;
  provider: ConnectorProviderId;
  statusCode?: number;
  retryable?: boolean;
  documentationUrl?: string;
  suggestedAction?: string;

  constructor(details: ConnectorErrorDetails) {
    super(details.message);
    this.name = 'ConnectorError';
    this.code = details.code;
    this.provider = details.provider;
    this.statusCode = details.statusCode;
    this.retryable = details.retryable ?? false;
    this.documentationUrl = details.documentationUrl;
    this.suggestedAction = details.suggestedAction;
  }
}

export interface ConnectorScopeDefinition {
  scope: string;
  title: string;
  description: string;
  required: boolean;
}

export interface ConnectorProviderSpec {
  id: ConnectorProviderId;
  displayName: string;
  shortDescription: string;
  longDescription: string;
  category: ConnectorCategory;
  authMethod: ConnectorAuthMethod;
  webhookSupported: boolean;
  tokenLifecycleSupported: boolean;
  docsUrl: string;
  requiredScopes: ConnectorScopeDefinition[];
  defaultCapabilities: ConnectorCapability[];
  securityNotice: string;
  configurationNotes: string;
  isAvailableInProduction: boolean; // false if live credentials not configured
}

export interface HealthCheckResult {
  provider: ConnectorProviderId;
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectorStatus: ConnectorStatus;
  latencyMs?: number;
  checkedAt: string;
  message: string;
  details?: Record<string, any>;
}

export interface ConnectParams {
  businessId: string;
  provider?: ConnectorProviderId;
  authCode?: string;
  redirectUri?: string;
  // For Razorpay / API keys (never plaintext in store)
  keyId?: string;
  keySecret?: string;
  // For WhatsApp Embedded Signup & Meta Cloud API
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
  isTestMode?: boolean;
}

export interface DisconnectParams {
  businessId: string;
  provider?: ConnectorProviderId;
  revokeAtProvider?: boolean;
  isTestMode?: boolean;
}

export interface ConnectorAdapter {
  providerId: ConnectorProviderId;
  spec: ConnectorProviderSpec;

  connect(params: ConnectParams): Promise<{
    success: boolean;
    integration?: Partial<BusinessIntegration>;
    error?: ConnectorErrorDetails;
  }>;

  disconnect(params: DisconnectParams): Promise<{
    success: boolean;
    error?: ConnectorErrorDetails;
  }>;

  getConnectionStatus(
    businessId: string,
    existingIntegration?: BusinessIntegration | null
  ): Promise<{
    status: ConnectorStatus;
    integration?: BusinessIntegration;
  }>;

  refreshCredentials(
    businessId: string,
    existingIntegration: BusinessIntegration
  ): Promise<{
    success: boolean;
    integration?: Partial<BusinessIntegration>;
    error?: ConnectorErrorDetails;
  }>;

  healthCheck(
    businessId: string,
    existingIntegration?: BusinessIntegration | null,
    isTestMode?: boolean
  ): Promise<HealthCheckResult>;

  getCapabilities(): ConnectorCapability[];

  validateWebhookPayload?(
    rawPayload: string,
    signature: string,
    secret: string
  ): boolean;
}

/**
 * Sanitized client-safe integration view that guarantees no internal secrets or tokens are exposed
 */
export interface ClientSafeIntegration {
  id: string;
  business_id: string;
  provider: ConnectorProviderId;
  provider_account_id?: string | null;
  provider_account_name?: string | null;
  status: ConnectorStatus;
  scopes: string[];
  connected_at?: string | null;
  disconnected_at?: string | null;
  last_health_check_at?: string | null;
  last_health_status?: 'healthy' | 'degraded' | 'unhealthy';
  last_error?: string | null;
  is_test_mode?: boolean;
  created_at: string;
  updated_at: string;
  has_valid_credentials: boolean;
  key_id_preview?: string;
}

// -----------------------------------------------------------------------------
// LIVE CONNECTION ASSISTANT SPECIFICATIONS & TYPES
// -----------------------------------------------------------------------------
export type AssistanceLanguage = 'en' | 'hi' | 'hinglish';
export type AssistanceAccountStatus = 'has_account' | 'needs_account' | 'unknown';
export type AssistanceSessionStatus = 'active' | 'paused' | 'completed' | 'failed' | 'abandoned';

export interface AssistanceStep {
  id: string;
  index: number;
  title: string;
  titleHinglish: string;
  titleHindi: string;
  description: string;
  descriptionHinglish: string;
  descriptionHindi: string;
  actionRequired: string;
  actionRequiredHinglish: string;
  officialUrl?: string;
  prerequisites?: string[];
  estimatedMinutes: number;
  isCompleted?: boolean;
  isCurrent?: boolean;
}

export interface ScreenAnalysisResult {
  identifiedScreen: string;
  screenCategory: 'provider_console' | 'login_screen' | 'permission_consent' | 'api_key_page' | 'settings' | 'unknown';
  confidence: 'high' | 'medium' | 'low' | 'unclear';
  visibleOptions: string[];
  visibleButtons: string[];
  detectedErrors: string[];
  detectedSensitiveFields: string[]; // Sensitive values flagged and redacted
  nextStepGuidance: string;
  nextStepGuidanceHinglish: string;
  needsNewScreenshot: boolean;
  clarificationMessage?: string;
  disclaimer: string;
  analyzedAt: string;
}

export interface ConnectorCapabilityModel {
  provider: ConnectorProviderId;
  displayName: string;
  isConnected: boolean;
  isAuthorized: boolean;
  availableCapabilities: ConnectorCapability[];
  authorizedScopes: string[];
  connectionHealth: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastSuccessfulSyncAt: string | null;
  approvalRequired: boolean;
  consequentialActions: string[];
  notes?: string;
}

export interface AssistanceMessage {
  id: string;
  sender: 'assistant' | 'user' | 'system';
  text: string;
  textHinglish?: string;
  textHindi?: string;
  timestamp: string;
  stepId?: string;
  actionType?:
    | 'next_step'
    | 'what_to_do'
    | 'troubleshoot'
    | 'account_create'
    | 'account_existing'
    | 'screen_analyzed'
    | 'sensitive_warning'
    | 'verified';
  sensitiveDetected?: boolean;
}

export interface TroubleshootingSymptom {
  id: string;
  title: string;
  titleHinglish: string;
  description: string;
  descriptionHinglish: string;
  possibleCauses: string[];
  resolutionSteps: string[];
  resolutionStepsHinglish: string[];
  requiresProviderReauth?: boolean;
}
