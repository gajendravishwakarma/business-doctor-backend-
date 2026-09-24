import { Customer, Lead, Order, Booking, Product, ServiceItem } from './database';

export type LeadFunnelStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'dormant';

export type CustomerSegmentType =
  | 'all'
  | 'new_customers'
  | 'repeat_customers'
  | 'high_value'
  | 'at_risk'
  | 'dormant'
  | 'recent_leads'
  | 'high_intent_leads';

export interface CRMActivityTimelineEvent {
  id: string;
  type:
    | 'lead_created'
    | 'lead_contacted'
    | 'lead_qualified'
    | 'lead_stage_changed'
    | 'lead_won'
    | 'lead_lost'
    | 'order_placed'
    | 'order_delivered'
    | 'order_cancelled'
    | 'booking_scheduled'
    | 'booking_completed'
    | 'booking_cancelled'
    | 'customer_created'
    | 'note_logged'
    | 'status_changed'
    | 'recommendation_dispatched'
    | 'memory_milestone';
  title: string;
  description: string;
  timestamp: string;
  source: string;
  amount?: number;
  badgeColor?: string;
  metadata?: Record<string, any>;
}

export interface LeadScoreFactor {
  factor: string;
  points: number;
  maxPoints: number;
  reason: string;
  status: 'positive' | 'neutral' | 'penalty';
}

export interface LeadScoreBreakdown {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  factors: LeadScoreFactor[];
  evidence: string[];
  missingWarnings: string[];
  isInsufficientData: boolean;
  qualificationTier: 'Hot' | 'Warm' | 'Moderate' | 'Cold' | 'Unqualified';
  summary: string;
}

export interface CustomerRepeatPurchaseInfo {
  isRepeat: boolean;
  totalOrders: number;
  totalBookings: number;
  totalTransactions: number;
  daysBetweenFirstAndLast: number | null;
  avgOrderIntervalDays: number | null;
  favoriteProducts: { name: string; quantity: number; totalSpent: number }[];
  favoriteServices: { name: string; bookingsCount: number; totalSpent: number }[];
}

export interface CustomerDataCompleteness {
  score: number;
  verifiedFields: string[];
  missingFields: string[];
  notesAudit: boolean;
  hasDirectContact: boolean;
}

export interface Customer360Profile {
  customer: Customer;
  orders: Order[];
  bookings: Booking[];
  leads: Lead[];
  totalOrders: number;
  totalBookings: number;
  totalRevenue: number;
  totalProductSpend: number;
  totalServiceSpend: number;
  avgOrderValue: number;
  firstInteraction: string | null;
  latestInteraction: string | null;
  repeatPurchaseInfo: CustomerRepeatPurchaseInfo;
  verifiedSources: string[];
  dataCompleteness: CustomerDataCompleteness;
  timeline: CRMActivityTimelineEvent[];
  recommendations: CRMRecommendation[];
}

export interface CRMRecommendation {
  id: string;
  targetType: 'customer' | 'lead';
  targetId: string;
  targetName: string;
  targetPhone: string;
  targetEmail?: string;
  actionType:
    | 'replenishment'
    | 'speed_to_lead'
    | 'vip_appreciation'
    | 'appointment_reminder'
    | 'win_back'
    | 'proposal_followup'
    | 'cross_sell';
  title: string;
  recommendedAction: string;
  reason: string;
  supportingEvidence: string[];
  confidence: number;
  businessObjective: string;
  draftMessage: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'phone';
  requiresHumanApproval: boolean;
  status: 'pending_approval' | 'approved' | 'rejected' | 'dispatched';
  createdAt: string;
}

export interface SegmentSummary {
  type: CustomerSegmentType;
  label: string;
  description: string;
  count: number;
  totalValue: number;
  badgeColor: string;
}

export interface LeadFunnelStageData {
  stage: LeadFunnelStage;
  label: string;
  description: string;
  color: string;
  leads: Lead[];
  count: number;
  totalBudget: number;
  conversionRateFromStart: number;
}

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled' | 'overdue';

export interface CRMFollowUp {
  id: string;
  business_id: string;
  target_type: 'lead' | 'customer';
  target_id: string;
  target_name: string;
  contact_phone?: string;
  contact_email?: string;
  due_date: string; // ISO string or YYYY-MM-DD
  reason: string;
  notes?: string;
  status: FollowUpStatus;
  assigned_to?: string;
  completed_at?: string;
  created_at: string;
}

export interface MetricEvidenceInfo {
  state: 'observed' | 'calculated' | 'insufficient_data' | 'ai_recommendation';
  label: string;
  source: string;
  explanation?: string;
}

export interface CRMMetrics {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  lostLeads: number;
  openLeads: number;
  conversionRate: number | null; // null if insufficient data
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  inactiveCustomers: number;
  followupsDueToday: number;
  overdueFollowups: number;
  upcomingFollowups: number;
  completedFollowups: number;
  avgLeadScore: number | null; // null if insufficient data
  avgCustomerSpend: number | null; // null if insufficient data
  metricsEvidence: Record<string, MetricEvidenceInfo>;
  hasSufficientLeadData: boolean;
  hasSufficientCustomerData: boolean;
}
