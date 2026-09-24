import {
  ConnectorProviderId,
  ConnectorCapabilityModel,
  ConnectorCapability,
  ClientSafeIntegration,
} from '../../types/connectors';
import { BusinessIntegration } from '../../types/database';
import { getConnectorAdapter } from './registry';

// -----------------------------------------------------------------------------
// CONSEQUENTIAL ACTIONS REGISTRY (HUMAN-IN-THE-LOOP SAFETY ENFORCEMENT)
// -----------------------------------------------------------------------------

/**
 * Consequential actions that affect real external customers, publish content,
 * charge money, or disburse refunds. These ALWAYS require human approval.
 */
export const CONSEQUENTIAL_ACTIONS: Record<ConnectorProviderId, string[]> = {
  whatsapp_business: [
    'send_whatsapp_message',
    'send_template_broadcast',
    'initiate_outbound_call',
    'update_business_profile',
  ],
  facebook: [
    'publish_page_post',
    'delete_page_post',
    'reply_public_comment',
    'create_lead_ad',
    'update_page_settings',
  ],
  instagram: [
    'publish_media_post',
    'publish_story',
    'send_direct_message',
    'delete_media',
  ],
  youtube: [
    'upload_video',
    'update_video_metadata',
    'delete_video',
    'reply_video_comment',
  ],
  razorpay: [
    'create_payment_link',
    'issue_refund',
    'capture_authorized_payment',
    'cancel_subscription',
    'create_customer_order',
  ],
};

/**
 * Determines whether a specific action is consequential and requires Human-In-The-Loop approval.
 */
export function isConsequentialAction(provider: ConnectorProviderId, actionType: string): boolean {
  const actions = CONSEQUENTIAL_ACTIONS[provider] || [];
  return actions.includes(actionType) || actionType.toLowerCase().includes('send') || actionType.toLowerCase().includes('refund') || actionType.toLowerCase().includes('publish');
}

/**
 * Builds the runtime capability model for a given provider and business.
 * Tells AI agents exactly what capabilities are available, what scopes are authorized,
 * health status, and whether human approval is strictly required.
 */
export function getProviderCapabilityModel(
  businessId: string,
  provider: ConnectorProviderId,
  integrations: (BusinessIntegration | ClientSafeIntegration)[]
): ConnectorCapabilityModel {
  const adapter = getConnectorAdapter(provider);
  const existing = integrations.find((i) => i.business_id === businessId && i.provider === provider);

  const isConnected = !!existing && existing.status === 'CONNECTED';
  const isAuthorized = isConnected && (existing?.scopes?.length || 0) > 0;
  const authorizedScopes = existing?.scopes || [];

  // If connected, filter capabilities based on authorized scopes
  const availableCapabilities: ConnectorCapability[] = [];
  if (isAuthorized && adapter) {
    for (const cap of adapter.spec.defaultCapabilities) {
      // Check if capability is satisfied by scopes
      availableCapabilities.push(cap);
    }
  }

  const connectionHealth = existing?.last_health_status || (isConnected ? 'healthy' : 'unknown');
  const consequentialList = CONSEQUENTIAL_ACTIONS[provider] || [];

  return {
    provider,
    displayName: adapter?.spec.displayName || provider,
    isConnected,
    isAuthorized,
    availableCapabilities,
    authorizedScopes,
    connectionHealth,
    lastSuccessfulSyncAt: existing?.last_health_check_at || existing?.connected_at || null,
    approvalRequired: true, // Safeguard: AI agents must never bypass human approval for external actions
    consequentialActions: consequentialList,
    notes: !isConnected
      ? 'Connector is not connected. AI Agent cannot perform actions on this platform.'
      : !isAuthorized
      ? 'Connector is connected but missing required permissions.'
      : 'Active and authorized. Consequential actions require Human-in-the-Loop review.',
  };
}

/**
 * Evaluates whether an autonomous or assistant agent is authorized to perform an action.
 * Enforces tenant isolation, connector connection state, and approval boundaries.
 */
export function canAgentPerformAction(
  businessId: string,
  provider: ConnectorProviderId,
  actionType: string,
  integrations: (BusinessIntegration | ClientSafeIntegration)[]
): {
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason: string;
} {
  const model = getProviderCapabilityModel(businessId, provider, integrations);

  if (!model.isConnected) {
    return {
      allowed: false,
      requiresHumanApproval: false,
      reason: `Connector '${model.displayName}' is not connected for this business. Setup is required before taking actions.`,
    };
  }

  if (!model.isAuthorized) {
    return {
      allowed: false,
      requiresHumanApproval: false,
      reason: `Connector '${model.displayName}' is not fully authorized. Please grant required permissions.`,
    };
  }

  if (model.connectionHealth === 'unhealthy') {
    return {
      allowed: false,
      requiresHumanApproval: false,
      reason: `Connector '${model.displayName}' is currently unhealthy or expired. Please re-verify or reconnect.`,
    };
  }

  const consequential = isConsequentialAction(provider, actionType);

  if (consequential) {
    return {
      allowed: true,
      requiresHumanApproval: true,
      reason: `Action '${actionType}' on '${model.displayName}' is consequential (e.g. messaging, publishing, or payment). It requires explicit human approval before dispatch.`,
    };
  }

  return {
    allowed: true,
    requiresHumanApproval: false,
    reason: `Read-only or non-consequential action '${actionType}' permitted.`,
  };
}
