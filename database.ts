export type BusinessType = 'product' | 'service' | 'hybrid';

export type BusinessAgeStage = 'new' | 'early' | 'growing' | 'established';

export type DataMaturityMode =
  | 'existing_complete'
  | 'existing_partial'
  | 'new_no_data'
  | 'existing_no_data';

export interface Business {
  id: string;
  name: string;
  business_type: BusinessType;
  industry: string;
  location: string;
  country: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  business_age_stage: BusinessAgeStage;
  data_maturity_mode: DataMaturityMode;
  business_age_months?: number;
  target_customers: string;
  business_goals: string[];
  monthly_revenue_target: number;
  monthly_revenue?: number;
  target_gross_margin?: number;
  website?: string;
  contact_phone?: string;
  contact_email?: string;
  created_at: string;
  updated_at: string;
}

export type MemberRole = 'owner' | 'manager' | 'staff' | 'admin' | 'viewer';

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  user_email: string;
  user_name: string;
  created_at: string;
}

export type MemoryObservationType =
  | 'baseline'
  | 'metric_trend'
  | 'customer_behavior'
  | 'decision'
  | 'outcome'
  | 'market_context'
  | 'margin'
  | 'conversion'
  | 'retention'
  | 'seasonal'
  | 'milestone'
  | 'growth_insight'
  | 'action_outcome'
  | 'anomaly'
  | 'insight';

export type MemoryPeriod = 'day_0' | '30_day' | '90_day' | '6_month' | '1_year' | 'monthly' | 'quarterly';

export interface BusinessMemory {
  id: string;
  business_id: string;
  observation_type: MemoryObservationType;
  period: MemoryPeriod | string;
  title: string;
  content: string;
  metric_changes?: Record<string, any>;
  confidence_score: number;
  outcome_recorded: string | null;
  created_at: string;
  is_verified?: boolean;
  provenance?: {
    source_type: 'supabase_table' | 'live_event' | 'user_logged' | 'unverified_seed' | 'insufficient_data';
    source_table?: string;
    source_record_id?: string;
    evidence_summary?: string;
    has_sufficient_data?: boolean;
  };
}

export type CustomerSource =
  | 'whatsapp'
  | 'instagram'
  | 'referral'
  | 'google_search'
  | 'walk_in'
  | 'website'
  | 'other';

export type CustomerStatus = 'active' | 'repeat' | 'dormant' | 'churn_risk' | 'vip' | 'inactive';

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  source: CustomerSource;
  status: CustomerStatus;
  first_seen: string;
  last_activity: string;
  total_orders: number;
  total_spend: number;
  notes: string;
  tags: string[];
  created_at: string;
}

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'proposal_sent'
  | 'intent'
  | 'negotiation'
  | 'won'
  | 'converted'
  | 'lost'
  | 'dormant';

export interface Lead {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: LeadStatus;
  score: number;
  budget: number;
  interest_product_or_service: string;
  interested_in?: string;
  last_follow_up: string | null;
  next_follow_up: string | null;
  notes: string;
  converted_to_customer_id: string | null;
  created_at: string;
}

export type ProductStatus = 'active' | 'low_stock' | 'out_of_stock' | 'discontinued';

export interface Product {
  id: string;
  business_id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  margin_pct: number;
  stock_quantity: number;
  status: ProductStatus;
  total_sold: number;
  created_at: string;
}

export interface ServiceItem {
  id: string;
  business_id: string;
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
  status?: 'active' | 'inactive';
  bookings_count?: number;
  description?: string;
  is_active?: boolean;
  created_at: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  product_id?: string;
  service_id?: string;
  sku?: string;
  unit_cost?: number;
  type?: 'product' | 'service';
}

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded' | 'partially_paid';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'net_banking' | 'cod' | 'cash';
export type OrderStatus = 'completed' | 'processing' | 'delivered' | 'cancelled' | 'pending' | 'refunded';

export interface Order {
  id: string;
  business_id: string;
  order_number?: string;
  customer_id: string | null;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  items: OrderItem[];
  subtotal?: number;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  order_status: OrderStatus;
  order_date: string;
  source?: 'walk_in' | 'online' | 'pos' | 'website' | 'whatsapp' | 'phone' | 'other' | string;
  notes: string;
  inventory_decremented?: boolean;
  created_at?: string;
}

export type InventoryMovementType =
  | 'purchase_restock'
  | 'sale'
  | 'manual_adjustment'
  | 'return_damage'
  | 'wastage';

export interface InventoryMovement {
  id: string;
  business_id: string;
  product_id: string;
  product_name: string;
  movement_type: InventoryMovementType;
  quantity_change: number;
  balance_after: number;
  reference_id?: string;
  reason: string;
  created_by?: string;
  created_at: string;
}

export interface ProfitAndLossStatement {
  grossRevenue: number;
  ordersRevenue: number;
  bookingsRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  expensesByCategory: Record<string, number>;
  netOperatingProfit: number;
  netMarginPct: number;
  hasSufficientRevenueData: boolean;
  hasSufficientExpenseData: boolean;
  evidenceState: 'observed' | 'calculated' | 'insufficient_data';
}

export interface SalesAnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  ordersByPaymentMethod: Record<string, { count: number; total: number }>;
  ordersBySource: Record<string, { count: number; total: number }>;
  topProductsByRevenue: Array<{ id: string; name: string; quantity: number; revenue: number; grossProfit: number }>;
  topProductsByUnits: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  hasSufficientData: boolean;
  evidenceState: 'observed' | 'calculated' | 'insufficient_data';
}

export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'pending';
export type BookingPaymentStatus = 'paid' | 'pending' | 'pay_at_venue';

export interface Booking {
  id: string;
  business_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone?: string;
  service_id?: string | null;
  service_name: string;
  booking_date: string;
  time_slot?: string;
  booking_time?: string;
  start_time?: string;
  practitioner_name?: string;
  status: BookingStatus;
  amount: number;
  payment_status?: BookingPaymentStatus;
  notes: string;
  created_at: string;
}

export type ExpenseCategory =
  | 'rent'
  | 'marketing'
  | 'salaries'
  | 'inventory'
  | 'software_tools'
  | 'software'
  | 'logistics'
  | 'utilities'
  | 'other';

export interface Expense {
  id: string;
  business_id: string;
  category: ExpenseCategory;
  title?: string;
  description?: string;
  amount: number;
  expense_date: string;
  vendor?: string;
  payment_method: string;
  receipt_url?: string | null;
  is_recurring: boolean;
  tax_deductible?: boolean;
  created_at: string;
}

export type DataSourceType =
  | 'csv'
  | 'excel'
  | 'pdf_invoice'
  | 'pos_export'
  | 'manual_entry'
  | 'api_sync'
  | 'website';

export interface DataSource {
  id: string;
  business_id: string;
  name: string;
  source_type: DataSourceType;
  status: 'parsed' | 'importing' | 'completed' | 'failed' | 'synced';
  record_count?: number;
  records_count?: number;
  file_name?: string;
  mapped_fields?: Record<string, string>;
  last_synced?: string;
  error_message?: string | null;
  imported_at?: string;
}

export type AutomationTrigger =
  | 'new_lead'
  | 'abandoned_lead'
  | 'booking_reminder'
  | 'post_purchase_review'
  | 'customer_reactivation_45d'
  | 'low_stock_alert'
  | 'order_created'
  | 'booking_completed'
  | 'replenishment_due'
  | 'churn_risk_detected';

export type AutomationAction =
  | 'send_whatsapp'
  | 'send_email'
  | 'create_task'
  | 'alert_owner'
  | 'apply_discount_tag';

export interface Automation {
  id: string;
  business_id: string;
  name: string;
  trigger_type: AutomationTrigger;
  action_type: AutomationAction;
  conditions: Record<string, any>;
  requires_approval: boolean;
  is_active: boolean;
  execution_count: number;
  last_run: string | null;
  created_at?: string;
}

export type AIAgentType =
  | 'growth_agent'
  | 'retention_agent'
  | 'operations_agent'
  | 'financial_auditor';

export type AgentName =
  | 'Customer Assistant'
  | 'Lead Follow-Up Agent'
  | 'Marketing Strategist'
  | 'Business Analyst'
  | 'Booking Assistant'
  | 'Growth & Inbound Agent'
  | 'Retention & LTV Agent'
  | 'Operations & Inventory Agent'
  | 'Financial Auditor Agent';

export type AgentActionStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'EXECUTED'
  | 'REJECTED'
  | 'FAILED'
  | 'pending_approval'
  | 'approved'
  | 'executed'
  | 'rejected'
  | 'failed';

export interface AgentAction {
  id: string;
  business_id: string;
  agent_id?: string;
  agent_name: AgentName | string;
  action_type: string;
  target_entity: string;
  entity_id: string | null;
  evidence?: string | string[];
  proposed_action?: string;
  proposed_payload: Record<string, any>;
  status: AgentActionStatus;
  impact_level: 'low' | 'medium' | 'high';
  confidence: number;
  reasoning: string;
  failure_reason?: string;
  created_at: string;
  executed_at: string | null;
}

export type DiagnosisCategory =
  | 'revenue'
  | 'sales'
  | 'retention'
  | 'marketing'
  | 'pricing'
  | 'product_service'
  | 'expense'
  | 'conversion'
  | 'operational'
  | 'growth';

export type DiagnosisSeverity = 'critical' | 'warning' | 'opportunity' | 'info';
export type DiagnosisStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export interface AIDiagnosis {
  id: string;
  business_id: string;
  problem_title: string;
  problem_description: string;
  category: DiagnosisCategory;
  evidence: string;
  confidence: number;
  severity: DiagnosisSeverity;
  recommended_action: string;
  expected_kpi: string;
  effort: 'quick_win' | 'medium' | 'high_effort';
  status: DiagnosisStatus;
  created_at: string;
  affected_metric?: string;
  source_data?: string;
  requires_human_approval?: boolean;
}

export interface AuditLog {
  id: string;
  business_id: string;
  user_id: string;
  action: string;
  details: string;
  entity_type?: string;
  ip_address: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  business_id: string;
  rating: number;
  comment: string;
  diagnosis_id: string | null;
  created_at: string;
}

export type MetricEvidenceState = 'observed' | 'calculated' | 'ai_recommendation' | 'insufficient_data';

export interface MetricEvidenceInfo {
  state: MetricEvidenceState;
  source: string;
  details: string;
}

export interface BusinessMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  grossMargin?: number | null;
  netProfitMargin?: number;
  currentRunRate: number;
  healthScore?: number | null;
  healthBand?: string;
  totalOrders: number;
  totalBookings: number;
  totalCustomers: number;
  activeCustomers: number;
  repeatCustomers: number;
  repeatCustomerRate: number;
  totalLeads: number;
  convertedLeads: number;
  leadConversionRate: number;
  avgOrderValue: number;
  averageOrderValue: number;
  hasSufficientData: boolean;
  missingDataReasons: string[];

  // Metric-specific sufficiency flags
  hasSufficientRevenueData: boolean;
  hasSufficientProfitData: boolean;
  hasSufficientExpenseData: boolean;
  hasSufficientMarginData: boolean;
  hasSufficientRepeatData: boolean;
  hasSufficientLeadData: boolean;
  hasSufficientBookingData: boolean;
  hasSufficientHealthData: boolean;
  hasSufficientAovData: boolean;
  hasSufficientRunRateData: boolean;

  // Timezone & Period-aware metrics
  todayRevenue: number;
  todayOrdersCount: number;
  currentMonthRevenue: number;
  currentMonthExpenses: number;
  currentMonthNetProfit: number;
  currentMonthOrdersCount: number;
  previousMonthRevenue: number;
  targetMonthlyRunRateProgress: number | null;

  // Audit Provenance & Evidence Trace
  metricsEvidence: Record<string, MetricEvidenceInfo>;
}

export type TrialStatus = 'not_started' | 'active' | 'completed' | 'expired';
export type TrialDayStatus = 'pending' | 'in_progress' | 'completed' | 'locked' | 'failed';

export interface TrialDeliverable {
  id?: string;
  type: string;
  title: string;
  content: string;
  expected_outcome: string;
  status?: 'draft' | 'approved' | 'scheduled' | 'sent' | 'executed' | 'rejected' | 'active';
  channel?: 'whatsapp' | 'sms' | 'email' | 'social' | 'system';
  target_entity?: string;
  confidence_score?: number;
  effort_level?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

export interface TrialDayGroundedData {
  summary?: Record<string, any>;
  sources?: string[];
  has_sufficient_data?: boolean;
  missing_data_reasons?: string[];
  metrics_snapshot?: Partial<BusinessMetrics>;
}

export interface TrialDayContent {
  day: number;
  title: string;
  subtitle: string;
  completed: boolean;
  completedAt: string | null;
  status?: TrialDayStatus;
  highlights: string[];
  deliverables: TrialDeliverable[];
  grounded_data?: TrialDayGroundedData;
}

export interface BusinessTrial {
  id: string;
  business_id: string;
  trial_start_at: string;
  trial_end_at: string;
  current_day: number;
  completed_days: number[];
  trial_status: TrialStatus;
  day_status: Record<number, TrialDayStatus>;
  created_at: string;
  updated_at: string;
  days?: TrialDayContent[];
}

export type UserRole = 'owner' | 'manager' | 'staff' | 'marketing' | 'admin' | 'viewer';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  access_token?: string;
  expires_at?: number;
  last_sign_in_at?: string;
  is_demo?: boolean;
  business_id?: string;
}

export type CampaignObjective =
  | 'generate_leads'
  | 'increase_sales'
  | 'reactivate_customers'
  | 'increase_repeat_purchases'
  | 'promote_product'
  | 'promote_service'
  | 'appointment_generation';

export type CampaignChannel = 'whatsapp' | 'instagram' | 'facebook' | 'email' | 'sms';

export type CampaignStatus =
  | 'draft'
  | 'approved'
  | 'scheduled'
  | 'executed'
  | 'completed'
  | 'paused'
  | 'archived';

export interface CampaignMetrics {
  leads_generated?: number;
  conversions?: number;
  customers_acquired?: number;
  revenue_attributed?: number;
  repeat_purchases?: number;
  reactivation_results?: number;
  is_attribution_available?: boolean;
}

export interface Campaign {
  id: string;
  business_id: string;
  name: string;
  objective: CampaignObjective;
  target_segment: string;
  product_or_service_id?: string | null;
  product_or_service_name?: string;
  offer: string;
  channel: CampaignChannel;
  start_date?: string;
  end_date?: string;
  message_content: string;
  call_to_action: string;
  status: CampaignStatus;
  metrics?: CampaignMetrics;
  approved_at?: string | null;
  executed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

// -----------------------------------------------------------------------------
// CONNECTOR & INTEGRATION TYPES (PHASE 6 STEP 1)
// -----------------------------------------------------------------------------
export type ConnectorProviderId =
  | 'whatsapp_business'
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'razorpay';

export type ConnectorStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ACTION_REQUIRED'
  | 'EXPIRED'
  | 'ERROR'
  | 'DISCONNECTED';

export interface BusinessIntegration {
  id: string;
  business_id: string;
  provider: ConnectorProviderId;
  provider_account_id?: string | null;
  provider_account_name?: string | null;
  status: ConnectorStatus;
  scopes: string[];
  token_metadata?: {
    token_type?: string;
    expires_at?: string | number | null;
    refresh_token_expires_at?: string | number | null;
    granted_at?: string;
    has_refresh_token?: boolean;
    key_id_preview?: string; // e.g. "rzp_live_***1234"
  };
  encrypted_credential_ref?: string | null; // Pointer to secure vault or server secret reference - never plaintext tokens
  phone_number_id?: string | null;
  waba_id?: string | null;
  connected_at?: string | null;
  disconnected_at?: string | null;
  last_health_check_at?: string | null;
  last_health_status?: 'healthy' | 'degraded' | 'unhealthy';
  last_error?: string | null;
  metadata?: Record<string, any>;
  is_test_mode?: boolean;
  created_at: string;
  updated_at: string;
}

export type WebhookProcessingStatus =
  | 'received'
  | 'processed'
  | 'duplicate'
  | 'ignored'
  | 'failed';

export interface ConnectorWebhookEvent {
  id: string;
  business_id: string;
  provider: ConnectorProviderId | string;
  external_message_id?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  message_type?: string | null;
  message_payload?: Record<string, any>;
  metadata?: Record<string, any>;
  processing_status: WebhookProcessingStatus;
  received_at: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// LIVE CONNECTION ASSISTANT TYPES (PHASE 6 STEP 3)
// -----------------------------------------------------------------------------
export type AssistanceSessionStatus = 'active' | 'paused' | 'completed' | 'failed' | 'abandoned';
export type AssistanceAccountStatus = 'has_account' | 'needs_account' | 'unknown';
export type AssistanceLanguage = 'en' | 'hi' | 'hinglish';

export interface ConnectionAssistanceSession {
  id: string;
  business_id: string;
  provider: ConnectorProviderId;
  user_id?: string | null;
  status: AssistanceSessionStatus;
  current_step_id: string;
  account_status: AssistanceAccountStatus;
  language: AssistanceLanguage;
  completed_step_ids: string[];
  last_error?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

