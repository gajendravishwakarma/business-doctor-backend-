import {
  Automation,
  AutomationTrigger,
  AutomationAction,
  AgentAction,
  Business,
  Customer,
  Lead,
  Product,
  Order,
  Booking,
} from '../types/database';
import { AutomationExecutionLog } from '../types/agents';

export interface AutomationTriggerEvent {
  type: AutomationTrigger;
  businessId: string;
  entityId?: string;
  entityType?: 'lead' | 'customer' | 'order' | 'booking' | 'product';
  payload: Record<string, any>;
  timestamp: string;
}

export interface AutomationContext {
  business: Business;
  customers: Customer[];
  leads: Lead[];
  products: Product[];
  orders: Order[];
  bookings: Booking[];
}

export interface AutomationEvaluationResult {
  ruleId: string;
  ruleName: string;
  triggerType: AutomationTrigger;
  actionType: AutomationAction;
  status: 'EXECUTED' | 'PROPOSED_FOR_APPROVAL' | 'SKIPPED' | 'FAILED';
  reason: string;
  generatedAction?: AgentAction;
  executionLog: AutomationExecutionLog;
}

/**
 * Evaluates whether an event satisfies the conditions defined in an automation rule.
 */
export function checkConditions(
  conditions: Record<string, any>,
  event: AutomationTriggerEvent,
  context: AutomationContext
): { matched: boolean; reason: string } {
  // If no specific conditions, default to true
  if (!conditions || Object.keys(conditions).length === 0) {
    return { matched: true, reason: 'No condition restrictions defined; triggered unconditionally.' };
  }

  // 1. Min Lead Score condition
  if (typeof conditions.minScore === 'number') {
    const leadScore = event.payload?.score ?? event.payload?.lead?.score;
    if (typeof leadScore === 'number' && leadScore < conditions.minScore) {
      return {
        matched: false,
        reason: `Lead score (${leadScore}) is lower than minimum required (${conditions.minScore}).`,
      };
    }
  }

  // 2. Stock Threshold condition
  if (typeof conditions.stockThreshold === 'number') {
    const stock = event.payload?.stock_quantity ?? event.payload?.product?.stock_quantity;
    if (typeof stock === 'number' && stock > conditions.stockThreshold) {
      return {
        matched: false,
        reason: `Product stock level (${stock}) is above alert threshold (${conditions.stockThreshold}).`,
      };
    }
  }

  // 3. Inactivity Days condition
  if (typeof conditions.inactivityDays === 'number') {
    const lastActivity = event.payload?.last_activity ?? event.payload?.customer?.last_activity;
    if (lastActivity) {
      const diffDays = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < conditions.inactivityDays) {
        return {
          matched: false,
          reason: `Customer inactive for ${diffDays} days, which is less than required ${conditions.inactivityDays} days.`,
        };
      }
    }
  }

  // 4. Min Order Value condition
  if (typeof conditions.minOrderValue === 'number') {
    const orderTotal = event.payload?.total_amount ?? event.payload?.order?.total_amount;
    if (typeof orderTotal === 'number' && orderTotal < conditions.minOrderValue) {
      return {
        matched: false,
        reason: `Order value (${orderTotal}) is below required minimum (${conditions.minOrderValue}).`,
      };
    }
  }

  return { matched: true, reason: 'All rule criteria satisfied.' };
}

/**
 * Builds the customized dispatch payload for an automation action.
 */
export function buildActionPayload(
  rule: Automation,
  event: AutomationTriggerEvent,
  context: AutomationContext
): { title: string; message: string; targetEntity: string; recipientContact?: string; metadata: Record<string, any> } {
  const { business } = context;
  const p = event.payload || {};

  switch (rule.trigger_type) {
    case 'new_lead': {
      const leadName = p.name || p.lead?.name || 'Valued Customer';
      const leadPhone = p.phone || p.lead?.phone || '';
      const interest = p.interest_product_or_service || p.lead?.interest_product_or_service || 'our offerings';

      return {
        title: `Instant Speed-to-Lead Follow-up: ${leadName}`,
        targetEntity: `Lead: ${leadName} (${leadPhone || 'Web Inbound'})`,
        recipientContact: leadPhone,
        message: `Namaste ${leadName}! Thank you for your interest in ${interest} at ${business.name}. We are delighted to connect with you. Would morning or afternoon suit you best for a quick consultation?`,
        metadata: { channel: 'WhatsApp', leadId: event.entityId, source: p.source || 'Website' },
      };
    }

    case 'abandoned_lead': {
      const leadName = p.name || p.lead?.name || 'Prospect';
      const leadPhone = p.phone || p.lead?.phone || '';

      return {
        title: `24-Hour Abandoned Lead Check-in: ${leadName}`,
        targetEntity: `Lead: ${leadName}`,
        recipientContact: leadPhone,
        message: `Hello ${leadName}, following up from ${business.name}. We wanted to check if you still have any questions regarding your inquiry? Feel free to reply directly to this message.`,
        metadata: { channel: 'WhatsApp', leadId: event.entityId },
      };
    }

    case 'booking_reminder': {
      const customerName = p.customer_name || p.booking?.customer_name || 'Client';
      const serviceName = p.service_name || p.booking?.service_name || 'Appointment';
      const date = p.booking_date || p.booking?.booking_date || 'tomorrow';
      const time = p.time_slot || p.booking?.time_slot || '';

      return {
        title: `Appointment Reminder: ${customerName}`,
        targetEntity: `Booking: ${serviceName} on ${date}`,
        recipientContact: p.customer_phone || p.booking?.customer_phone,
        message: `Namaste ${customerName}, this is a friendly reminder for your upcoming ${serviceName} appointment at ${business.name} on ${date} at ${time}. Looking forward to serving you!`,
        metadata: { channel: 'WhatsApp', bookingId: event.entityId },
      };
    }

    case 'booking_completed':
    case 'post_purchase_review': {
      const name = p.customer_name || p.customer?.name || 'Valued Customer';
      const serviceOrProduct = p.service_name || p.product_name || 'your recent visit';

      return {
        title: `Review & Feedback Invitation: ${name}`,
        targetEntity: `Customer: ${name}`,
        recipientContact: p.customer_phone || p.phone,
        message: `Thank you for choosing ${business.name} for ${serviceOrProduct}! Your feedback means everything to us. Could you take 30 seconds to rate your experience?`,
        metadata: { channel: 'WhatsApp', customerId: event.entityId },
      };
    }

    case 'customer_reactivation_45d':
    case 'churn_risk_detected': {
      const customerName = p.name || p.customer?.name || 'Valued Customer';
      const currSym = business.currency_symbol || '₹';

      return {
        title: `45-Day Win-Back Re-Engagement: ${customerName}`,
        targetEntity: `Customer: ${customerName}`,
        recipientContact: p.phone || p.customer?.phone,
        message: `Namaste ${customerName}, we've missed you at ${business.name}! To welcome you back, enjoy an exclusive 15% VIP appreciation courtesy on your next replenishment or service booking this month.`,
        metadata: { channel: 'WhatsApp', customerId: event.entityId, offerDiscount: '15%' },
      };
    }

    case 'low_stock_alert': {
      const prodName = p.name || p.product?.name || 'Inventory SKU';
      const stock = p.stock_quantity ?? p.product?.stock_quantity ?? 0;

      return {
        title: `Urgent Reorder Buffer Alert: ${prodName}`,
        targetEntity: `SKU: ${prodName} (Stock: ${stock} units)`,
        message: `Stock level for "${prodName}" is critical (${stock} units remaining). Draft supplier purchase reorder to prevent sales stockouts.`,
        metadata: { channel: 'Internal Alert', productId: event.entityId, stockLevel: stock },
      };
    }

    case 'replenishment_due': {
      const name = p.customer_name || p.customer?.name || 'Customer';
      const prod = p.product_name || 'herbal regimen';

      return {
        title: `Consumables Replenishment Due: ${name}`,
        targetEntity: `Customer: ${name}`,
        recipientContact: p.customer_phone || p.phone,
        message: `Hi ${name}, based on standard 30-day usage, your supply of ${prod} may be running low. Reply 'REFILL' to reorder with 1-click free doorstep delivery!`,
        metadata: { channel: 'WhatsApp', customerId: event.entityId },
      };
    }

    default:
      return {
        title: `Automation Task: ${rule.name}`,
        targetEntity: `Trigger: ${rule.trigger_type}`,
        message: `Event ${rule.trigger_type} triggered for business ${business.name}.`,
        metadata: { channel: 'System' },
      };
  }
}

/**
 * Core event dispatcher evaluating all matching automation rules for an incoming event.
 */
export function evaluateAutomationEvent(
  event: AutomationTriggerEvent,
  automations: Automation[],
  context: AutomationContext
): AutomationEvaluationResult[] {
  const results: AutomationEvaluationResult[] = [];

  // 1. Tenant Security Check
  if (event.businessId !== context.business.id) {
    return [
      {
        ruleId: 'security_violation',
        ruleName: 'Cross-Tenant Guard',
        triggerType: event.type,
        actionType: 'alert_owner',
        status: 'FAILED',
        reason: `Cross-tenant automation blocked: event tenant "${event.businessId}" does not match workspace "${context.business.id}".`,
        executionLog: {
          id: `log_sec_${Date.now()}`,
          automation_id: 'security_guard',
          automation_name: 'Cross-Tenant Guard',
          trigger_type: event.type,
          action_type: 'alert_owner',
          status: 'FAILED',
          reason: 'Cross-tenant violation prevented.',
          created_at: new Date().toISOString(),
        },
      },
    ];
  }

  // 2. Filter active rules matching the trigger type
  const matchingRules = automations.filter(
    (rule) => rule.business_id === event.businessId && rule.is_active && rule.trigger_type === event.type
  );

  for (const rule of matchingRules) {
    const conditionCheck = checkConditions(rule.conditions, event, context);

    if (!conditionCheck.matched) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggerType: rule.trigger_type,
        actionType: rule.action_type,
        status: 'SKIPPED',
        reason: conditionCheck.reason,
        executionLog: {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          automation_id: rule.id,
          automation_name: rule.name,
          trigger_type: rule.trigger_type,
          action_type: rule.action_type,
          entity_id: event.entityId || null,
          status: 'SKIPPED',
          reason: conditionCheck.reason,
          created_at: new Date().toISOString(),
        },
      });
      continue;
    }

    const payload = buildActionPayload(rule, event, context);

    // 3. Human-In-The-Loop Approval Branch vs Immediate Execution Branch
    if (rule.requires_approval) {
      const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const proposedAction: AgentAction = {
        id: actionId,
        business_id: event.businessId,
        agent_name: 'Lead Follow-Up Agent',
        action_type: payload.title,
        target_entity: payload.targetEntity,
        entity_id: event.entityId || null,
        evidence: [
          `Event Trigger: ${rule.trigger_type.replace(/_/g, ' ').toUpperCase()}`,
          `Rule: ${rule.name}`,
          conditionCheck.reason,
        ],
        proposed_action: payload.title,
        proposed_payload: {
          channel: payload.metadata.channel,
          recipientContact: payload.recipientContact,
          message: payload.message,
          ruleId: rule.id,
          metadata: payload.metadata,
        },
        status: 'PROPOSED',
        impact_level: rule.trigger_type === 'low_stock_alert' ? 'high' : 'medium',
        confidence: 95,
        reasoning: `Automation rule "${rule.name}" requires human verification before external dispatch.`,
        created_at: new Date().toISOString(),
        executed_at: null,
      };

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggerType: rule.trigger_type,
        actionType: rule.action_type,
        status: 'PROPOSED_FOR_APPROVAL',
        reason: 'Action successfully enqueued for human owner/manager approval.',
        generatedAction: proposedAction,
        executionLog: {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          automation_id: rule.id,
          automation_name: rule.name,
          trigger_type: rule.trigger_type,
          action_type: rule.action_type,
          entity_id: event.entityId || null,
          status: 'PROPOSED_FOR_APPROVAL',
          reason: 'Enqueued for human authorization.',
          payload: proposedAction.proposed_payload,
          created_at: new Date().toISOString(),
        },
      });
    } else {
      // Immediate execution path
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggerType: rule.trigger_type,
        actionType: rule.action_type,
        status: 'EXECUTED',
        reason: `Executed immediately via ${payload.metadata.channel}.`,
        executionLog: {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          automation_id: rule.id,
          automation_name: rule.name,
          trigger_type: rule.trigger_type,
          action_type: rule.action_type,
          entity_id: event.entityId || null,
          status: 'EXECUTED',
          reason: `Auto-dispatched via ${payload.metadata.channel}`,
          payload: {
            channel: payload.metadata.channel,
            recipient: payload.recipientContact,
            message: payload.message,
          },
          created_at: new Date().toISOString(),
        },
      });
    }
  }

  return results;
}

/**
 * Standard SMB Automation Rule Presets for Instant Setup
 */
export function getDefaultAutomationTemplates(): Omit<Automation, 'id' | 'business_id' | 'created_at'>[] {
  return [
    {
      name: 'Instant Speed-to-Lead WhatsApp Follow-Up',
      trigger_type: 'new_lead',
      action_type: 'send_whatsapp',
      conditions: { minScore: 60 },
      requires_approval: false,
      is_active: true,
      execution_count: 0,
      last_run: null,
    },
    {
      name: '24-Hour Abandoned Lead Re-engagement',
      trigger_type: 'abandoned_lead',
      action_type: 'send_whatsapp',
      conditions: {},
      requires_approval: true,
      is_active: true,
      execution_count: 0,
      last_run: null,
    },
    {
      name: '24-Hour Booking Appointment Reminder',
      trigger_type: 'booking_reminder',
      action_type: 'send_whatsapp',
      conditions: {},
      requires_approval: false,
      is_active: true,
      execution_count: 0,
      last_run: null,
    },
    {
      name: 'Post-Purchase Google Review & Feedback Prompt',
      trigger_type: 'post_purchase_review',
      action_type: 'send_whatsapp',
      conditions: {},
      requires_approval: false,
      is_active: true,
      execution_count: 0,
      last_run: null,
    },
    {
      name: '45-Day Dormant Customer VIP Win-Back Offer',
      trigger_type: 'customer_reactivation_45d',
      action_type: 'send_whatsapp',
      conditions: { inactivityDays: 45 },
      requires_approval: true,
      is_active: true,
      execution_count: 0,
      last_run: null,
    },
    {
      name: 'Emergency Low Stock Buffer Restock Alert',
      trigger_type: 'low_stock_alert',
      action_type: 'alert_owner',
      conditions: { stockThreshold: 15 },
      requires_approval: true,
      is_active: true,
      execution_count: 0,
      last_run: null,
    },
    {
      name: 'Consumables 30-Day Replenishment Due Check',
      trigger_type: 'replenishment_due',
      action_type: 'send_whatsapp',
      conditions: {},
      requires_approval: true,
      is_active: true,
      execution_count: 0,
      last_run: null,
    },
  ];
}
