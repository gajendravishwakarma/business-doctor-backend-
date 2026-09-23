import { Business, Customer, Lead, Product, ServiceItem, Order, Booking, BusinessMemory } from './database';

export type OperatingAgentId =
  | 'business_analyst'
  | 'business_intelligence'
  | 'lead_follow_up'
  | 'lead_followup'
  | 'customer_retention'
  | 'customer_reactivation'
  | 'sales'
  | 'sales_conversion'
  | 'marketing'
  | 'product_service_recommendation'
  | 'booking'
  | 'customer_support'
  | 'business_assistant';

export type OperatingAgentName =
  | 'Business Analyst Agent'
  | 'Lead Follow-Up Agent'
  | 'Customer Retention Agent'
  | 'Sales Agent'
  | 'Marketing Agent'
  | 'Booking Agent'
  | 'Customer Support Agent'
  | 'Sales / Conversion Agent'
  | 'Customer Re-Activation Agent'
  | 'Product / Service Recommendation Agent'
  | 'Business Intelligence Agent'
  | 'Business Assistant Agent';

export type AgentActionGovernanceStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'pending_approval'
  | 'approved'
  | 'executed'
  | 'rejected'
  | 'failed';

export interface GroundedEvidenceItem {
  table: 'leads' | 'customers' | 'orders' | 'products' | 'services' | 'bookings' | 'expenses' | 'business_memory' | 'businesses';
  recordId?: string;
  field: string;
  value: string | number | boolean | null;
  description: string;
}

export interface AgentActionItem {
  id: string;
  agent_id: OperatingAgentId | string;
  agent_name: string;
  business_id: string;
  action_type: string;
  target_entity: string;
  entity_id: string | null;
  target_customer_or_lead_name?: string;
  target_contact?: string;
  reason: string;
  evidence: string[];
  grounded_evidence_items?: GroundedEvidenceItem[];
  confidence: number;
  proposed_action: string;
  suggested_message?: string;
  proposed_payload: Record<string, any>;
  status: AgentActionGovernanceStatus;
  impact_level: 'low' | 'medium' | 'high';
  created_at: string;
  executed_at: string | null;
  failure_reason?: string;
}

// 1. Lead Follow-Up Agent Output
export interface LeadFollowUpProposal {
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadStatus: string;
  leadScore: number;
  source: string;
  interest: string;
  reasonForFollowUp: string;
  evidence: string[];
  confidence: number;
  recommendedNextAction: string;
  suggestedMessage: string;
}

// 2. Customer Support Agent Output
export interface SupportAnswerResult {
  question: string;
  answer: string;
  isAvailableInVerifiedData: boolean;
  groundedSources: string[];
  supportingRecords?: {
    matchedProducts?: Product[];
    matchedServices?: ServiceItem[];
    businessPolicies?: string[];
  };
  confidence: number;
}

// 3. Sales / Conversion Agent Output
export interface SalesOpportunityProposal {
  entityType: 'lead' | 'customer';
  entityId: string;
  entityName: string;
  contact: string;
  crmSegment: string;
  opportunityTitle: string;
  reason: string;
  evidence: string[];
  confidence: number;
  recommendedAction: string;
  suggestedMessage: string;
  targetOffer?: string;
  potentialRevenue?: number;
}

// 4. Booking Agent Output
export interface BookingAvailabilitySlot {
  date: string;
  timeSlot: string;
  isAvailable: boolean;
  serviceId?: string;
  serviceName?: string;
  practitioner?: string;
  existingBookingId?: string;
}

export interface BookingAgentActionProposal {
  bookingId?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  serviceId?: string;
  serviceName: string;
  requestedDate: string;
  requestedTimeSlot?: string;
  actionType: 'appointment_inquiry' | 'booking_request' | 'reminder_recommendation' | 'cancellation_reschedule';
  reason: string;
  evidence: string[];
  isSlotAvailableInDatabase: boolean;
  confidence: number;
  recommendedAction: string;
  suggestedMessage: string;
}

// 5. Customer Re-Activation Agent Output
export interface ReactivationTargetProposal {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  status: 'dormant' | 'at_risk' | 'high_value_inactive';
  lastOrderDate: string | null;
  daysSinceLastInteraction: number;
  totalOrders: number;
  totalSpend: number;
  evidence: string[];
  confidence: number;
  reactivationAngle: string;
  suggestedOffer: string;
  suggestedMessage: string;
}

// 6. Product / Service Recommendation Agent Output
export interface ProductRecommendationProposal {
  customerId: string;
  customerName: string;
  customerSegment: string;
  purchaseHistorySummary: string;
  recommendedItemType: 'product' | 'service';
  recommendedItemId: string;
  recommendedItemName: string;
  itemPrice: number;
  itemStockOrAvailability: string;
  reason: string;
  evidence: string[];
  confidence: number;
  recommendedAction: string;
  suggestedMessage: string;
}

// 7. Business Intelligence Agent Output
export interface BIQueryResult {
  query: string;
  result: string;
  structuredData?: Record<string, any>;
  evidenceSources: string[];
  calculationBreakdown?: string;
  confidence: number;
  dataFreshness: string;
  isHistoricalDataAvailable: boolean;
  groundedMetrics: {
    totalRecordsQueried: number;
    verifiedRevenueRecorded?: number;
    activeCatalogCount?: number;
  };
}

export type AgentId = OperatingAgentId;

export interface SupportInquiryResponse {
  answer: string;
  evidence: string[];
  confidence: number;
  isAvailableInVerifiedData: boolean;
}

export interface BIQueryResponse {
  answer: string;
  evidence: string[];
  confidence: number;
  data_points?: string[];
}

export const AGENT_REGISTRY: Array<{
  id: AgentId;
  name: OperatingAgentName;
  role: string;
  description: string;
  inputs: string[];
}> = [
  {
    id: 'lead_followup',
    name: 'Lead Follow-Up Agent',
    role: 'Speed-to-Lead & Direct Response',
    description: 'Identifies verified inbound leads requiring follow-up, evaluates qualification score and contact channel, and drafts personalized outreach.',
    inputs: ['leads', 'business_memory', 'businesses'],
  },
  {
    id: 'customer_support',
    name: 'Customer Support Agent',
    role: 'Verified Business FAQ & Service Details',
    description: 'Answers customer inquiries on pricing, location, operating hours, and service durations using only verified database records.',
    inputs: ['services', 'products', 'businesses', 'bookings'],
  },
  {
    id: 'sales_conversion',
    name: 'Sales / Conversion Agent',
    role: 'High-Intent Prospects & VIP Upsells',
    description: 'Identifies high-score leads and VIP accounts with cart or repeat potential, drafting targeted conversion recommendations.',
    inputs: ['leads', 'customers', 'orders', 'services'],
  },
  {
    id: 'booking',
    name: 'Booking Agent',
    role: 'Schedule Capacity & Reminders',
    description: 'Checks practitioner calendar, prevents double-booking, and drafts WhatsApp confirmation and reminder notices.',
    inputs: ['bookings', 'services', 'customers'],
  },
  {
    id: 'customer_reactivation',
    name: 'Customer Re-Activation Agent',
    role: 'Dormant Customer Win-Back',
    description: 'Detects accounts inactive over 30–45 days, analyzes past purchase history, and formulates customized re-engagement offers.',
    inputs: ['customers', 'orders', 'business_memory'],
  },
  {
    id: 'product_service_recommendation',
    name: 'Product / Service Recommendation Agent',
    role: 'Personalized Catalog Matching',
    description: 'Cross-sells complementary herbal formulations, therapy packages, and add-ons grounded in past customer preferences.',
    inputs: ['customers', 'products', 'services', 'orders'],
  },
  {
    id: 'business_intelligence',
    name: 'Business Intelligence Agent',
    role: 'Operational Audit & Ledger Reasoning',
    description: 'Performs mathematical queries over revenue, expenses, stock velocities, and Day-0 memory baseline progression.',
    inputs: ['orders', 'expenses', 'products', 'business_memory', 'businesses'],
  },
];

export interface AgentMetadata {
  id: OperatingAgentId;
  name: OperatingAgentName;
  role: string;
  purpose: string;
  iconName: string;
  badgeColor: string;
  primaryColor: string;
  verifiedDataSources: string[];
  capabilities: string[];
  allowedTools: string[];
  requiredPermissions: string[];
  executionPolicy: 'autonomous_read' | 'consequential_approval_required';
  approvalPolicy: 'owner_or_manager' | 'auto';
}

export type ToolCategory = 'crm' | 'catalog' | 'booking' | 'analytics' | 'memory' | 'action' | 'connector';

export interface ToolParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
}

export interface AgentToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  isConsequential: boolean;
  requiresApproval: boolean;
  requiredRole?: 'owner' | 'manager' | 'staff';
  parameters: ToolParameterDefinition[];
}

export interface ToolExecutionResult {
  toolId: string;
  success: boolean;
  data?: any;
  error?: string;
  groundedEvidence?: GroundedEvidenceItem[];
  insufficientData?: boolean;
  insufficientDataReason?: string;
}

export interface AutomationExecutionLog {
  id: string;
  automation_id: string;
  automation_name: string;
  trigger_type: string;
  action_type: string;
  entity_id?: string | null;
  status: 'EXECUTED' | 'PROPOSED_FOR_APPROVAL' | 'FAILED' | 'SKIPPED';
  reason?: string;
  payload?: Record<string, any>;
  created_at: string;
}

