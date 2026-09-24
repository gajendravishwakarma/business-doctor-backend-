/**
 * Types and state definitions for the official Meta WhatsApp Business Platform
 * Embedded Signup and Tech Provider onboarding architecture.
 */

export type WhatsAppConnectorStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'ERROR'
  | 'DISCONNECTING';

export type WhatsAppConnectorStateMachine =
  | WhatsAppConnectorStatus
  | 'NOT_CONNECTED'
  | 'AUTHORIZING'
  | 'AUTHORIZED'
  | 'ASSET_SELECTION' // represents ASSET_SELECTION/ONBOARDING
  | 'HEALTHY';

export interface WhatsAppConnectionRecord {
  business_id: string;
  provider: 'whatsapp_business';
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  connection_status: WhatsAppConnectorStatus;
  capabilities: string[];
  last_health_check: string | null;
  last_webhook_received_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WhatsAppAuditAction =
  | 'connection_started'
  | 'connection_completed'
  | 'connection_failed'
  | 'webhook_received'
  | 'webhook_rejected'
  | 'message_proposed'
  | 'message_approved'
  | 'message_sent'
  | 'message_failed'
  | 'connection_disconnected';

export interface WhatsAppAuditRecord {
  id: string;
  business_id: string;
  action: WhatsAppAuditAction;
  details: string;
  entity_type?: 'whatsapp_connection' | 'whatsapp_webhook' | 'whatsapp_message';
  metadata?: Record<string, any>;
  created_at: string;
}

export type OutboundMessageStatus =
  | 'proposed'
  | 'approved'
  | 'executing'
  | 'sent'
  | 'failed'
  | 'permanently_failed';

export interface WhatsAppOutboundJob {
  id: string;
  business_id: string;
  action_id?: string;
  recipient_phone: string;
  message_text: string;
  template_name?: string;
  status: OutboundMessageStatus;
  requires_human_approval: boolean;
  is_human_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  attempt_count: number;
  max_retries: number;
  last_attempt_at?: string;
  next_retry_at?: string;
  last_error?: string;
  is_transient_error?: boolean;
  external_message_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppWebhookHealthDashboard {
  connected: boolean;
  webhook_verified: boolean;
  last_webhook: string | null;
  last_successful_outbound: string | null;
  last_error: string | null;
  error_count: number;
  tenant: string;
  waba: string;
  WABA?: string;
  phone_number: string;
  phone_number_id?: string;
  status: WhatsAppConnectorStatus;
  connection_record?: WhatsAppConnectionRecord | null;
  timestamp: string;
}

export interface WhatsAppEligibleAsset {
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  codeVerificationStatus: 'VERIFIED' | 'NOT_VERIFIED' | 'EXPIRED';
  messagingLimitTier?: string;
  wabaId: string;
  wabaName?: string;
}

export interface WhatsAppEmbeddedSignupConfig {
  appId: string;
  configId: string;
  isConfigured: boolean;
  graphVersion: string;
  callbackUrl: string;
  mode: 'production' | 'sandbox';
}

export interface WhatsAppSafeConnectionMetadata {
  businessId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  codeVerificationStatus?: string;
  messagingLimitTier?: string;
  wabaId?: string;
  wabaName?: string;
  webhookSubscribed: boolean;
  isTestMode: boolean;
  connectedAt: string;
}

export interface WhatsAppStateResponse {
  state: WhatsAppConnectorStateMachine;
  connection?: WhatsAppSafeConnectionMetadata | null;
  health?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checkedAt: string;
    message: string;
    latencyMs?: number;
  };
  pendingAssets?: WhatsAppEligibleAsset[];
  error?: {
    code: string;
    message: string;
    suggestedAction?: string;
  };
}
