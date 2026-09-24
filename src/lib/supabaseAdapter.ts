import { SupabaseClient } from '@supabase/supabase-js';
import {
  Business,
  BusinessMember,
  BusinessMemory,
  Customer,
  Lead,
  Product,
  ServiceItem,
  Order,
  Booking,
  Expense,
  DataSource,
  Automation,
  AgentAction,
  AIDiagnosis,
  AuditLog,
  Campaign,
  BusinessIntegration,
} from '../types/database';

/**
 * Validates and converts any ID to a valid RFC-4122 v4-formatted UUID.
 * Preserves standard UUIDs untouched.
 * Deterministically maps string slugs (e.g. 'biz_01_health_bengaluru')
 * so relational integrity remains consistent across sessions.
 */
export function toValidUuid(id: string | null | undefined): string {
  if (!id) {
    return '00000000-0000-4000-8000-000000000000';
  }
  const str = String(id).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }

  // Deterministic FNV-1a 128-bit hash derivation for non-UUID strings
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let h3 = 0x811c9dc5;
  let h4 = 0x811c9dc5;

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + 31), 0x01000193);
    h3 = Math.imul(h3 ^ (c + 63), 0x01000193);
    h4 = Math.imul(h4 ^ (c + 97), 0x01000193);
  }

  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = ((h2 >>> 16) & 0xffff).toString(16).padStart(4, '0');
  const p3 = '4' + ((h2 >>> 4) & 0x0fff).toString(16).padStart(3, '0');
  const p4 = '8' + ((h3 >>> 4) & 0x0fff).toString(16).padStart(3, '0');
  const p5 = ((h3 >>> 0).toString(16).padStart(8, '0') + ((h4 >>> 16) & 0xffff).toString(16).padStart(4, '0')).slice(0, 12);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export function optionalUuid(id: string | null | undefined): string | null {
  if (!id) return null;
  return toValidUuid(id);
}

export function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return toValidUuid(`uid_${Date.now()}_${Math.random()}`);
}

// -----------------------------------------------------------------------------
// Mapping Functions
// -----------------------------------------------------------------------------

export function mapBusinessToDb(b: Business) {
  let ageMonths = b.business_age_months;
  if (ageMonths == null) {
    if (b.data_maturity_mode === 'new_no_data') {
      ageMonths = 0;
    } else if (b.data_maturity_mode === 'existing_no_data') {
      ageMonths = b.business_age_stage === 'established' ? 36 : b.business_age_stage === 'growing' ? 24 : 12;
    } else if (b.data_maturity_mode === 'existing_partial') {
      ageMonths = b.business_age_stage === 'established' ? 36 : b.business_age_stage === 'growing' ? 18 : 6;
    } else if (b.data_maturity_mode === 'existing_complete') {
      ageMonths = b.business_age_stage === 'established' ? 48 : b.business_age_stage === 'growing' ? 24 : 12;
    } else {
      ageMonths = b.business_age_stage === 'established' ? 36 : b.business_age_stage === 'growing' ? 18 : 6;
    }
  }

  return {
    id: toValidUuid(b.id),
    name: b.name,
    business_type: b.business_type || 'hybrid',
    description: b.target_customers || b.industry || 'Health and Wellness enterprise',
    website_url: b.website || null,
    phone: b.contact_phone || null,
    email: b.contact_email || null,
    country: b.country || 'India',
    timezone: b.timezone || 'Asia/Kolkata',
    currency: b.currency || 'INR',
    business_age_months: ageMonths,
    onboarding_mode: b.business_age_stage || 'growing',
    data_maturity: b.data_maturity_mode || 'existing_partial',
    status: 'active',
  };
}

export function mapCustomerToDb(c: Customer, bizId: string) {
  return {
    id: toValidUuid(c.id),
    business_id: toValidUuid(bizId),
    name: c.name,
    phone: c.phone || null,
    email: c.email || null,
    source: c.source || 'other',
    first_seen_at: c.first_seen || new Date().toISOString(),
    last_activity_at: c.last_activity || new Date().toISOString(),
    total_orders: c.total_orders || 0,
    total_spend: c.total_spend || 0,
    status: c.status || 'active',
  };
}

export function mapProductToDb(p: Product, bizId: string) {
  return {
    id: toValidUuid(p.id),
    business_id: toValidUuid(bizId),
    name: p.name,
    description: p.category || '',
    sku: p.sku || `SKU-${toValidUuid(p.id).slice(0, 8)}`,
    category: p.category || 'General',
    selling_price: p.price || 0,
    cost_price: p.cost || 0,
    stock_quantity: p.stock_quantity || 0,
    status: p.status || 'active',
    source: 'catalog',
  };
}

export function mapServiceToDb(s: ServiceItem, bizId: string) {
  return {
    id: toValidUuid(s.id),
    business_id: toValidUuid(bizId),
    name: s.name,
    description: s.description || '',
    category: s.category || 'Consultation',
    price: s.price || 0,
    duration_minutes: s.duration_minutes || 45,
    capacity: 1,
    status: s.status || (s.is_active ? 'active' : 'inactive'),
    source: 'catalog',
  };
}

export function mapLeadToDb(l: Lead, bizId: string) {
  return {
    id: toValidUuid(l.id),
    business_id: toValidUuid(bizId),
    customer_id: optionalUuid(l.converted_to_customer_id),
    name: l.name,
    phone: l.phone || null,
    email: l.email || null,
    source: l.source || 'whatsapp',
    campaign: l.interest_product_or_service || 'general',
    intent: l.notes || l.interest_product_or_service || 'Inquiry',
    lead_score: l.score || 50,
    status: l.status || 'new',
    last_contact_at: l.last_follow_up ? new Date(l.last_follow_up).toISOString() : new Date().toISOString(),
    next_followup_at: l.next_follow_up ? new Date(l.next_follow_up).toISOString() : null,
  };
}

export function mapOrderToDb(o: Order, bizId: string) {
  return {
    id: toValidUuid(o.id),
    business_id: toValidUuid(bizId),
    customer_id: optionalUuid(o.customer_id),
    order_number: `ORD-${toValidUuid(o.id).slice(0, 6)}`,
    subtotal: (o.total_amount || 0) + (o.discount_amount || 0) - (o.tax_amount || 0),
    discount: o.discount_amount || 0,
    tax: o.tax_amount || 0,
    total: o.total_amount || 0,
    payment_status: o.payment_status || 'paid',
    order_status: o.order_status || 'completed',
    source: o.payment_method || 'store',
    ordered_at: o.order_date || o.created_at || new Date().toISOString(),
  };
}

export function mapBookingToDb(b: Booking, bizId: string) {
  const startIso = b.booking_date
    ? new Date(`${b.booking_date}T${b.time_slot || b.booking_time || '10:00'}:00`).toISOString()
    : new Date().toISOString();
  return {
    id: toValidUuid(b.id),
    business_id: toValidUuid(bizId),
    customer_id: optionalUuid(b.customer_id),
    service_id: optionalUuid(b.service_id),
    booking_start: startIso,
    booking_end: new Date(new Date(startIso).getTime() + 45 * 60000).toISOString(),
    status: b.status || 'confirmed',
    source: 'website',
    notes: b.notes || null,
  };
}

export function mapExpenseToDb(e: Expense, bizId: string) {
  return {
    id: toValidUuid(e.id),
    business_id: toValidUuid(bizId),
    category: e.category || 'other',
    description: e.description || e.title || '',
    amount: e.amount || 0,
    expense_date: e.expense_date || new Date().toISOString().split('T')[0],
    source: e.payment_method || 'bank_transfer',
  };
}

export function mapMemoryToDb(m: BusinessMemory, bizId: string) {
  return {
    id: toValidUuid(m.id),
    business_id: toValidUuid(bizId),
    memory_type: m.observation_type || 'insight',
    title: m.title || 'Operational Observation',
    content: m.content || '',
    source_type: m.period || 'system',
    confidence: m.confidence_score || 85,
    verified: true,
  };
}

export function mapActionToDb(a: AgentAction, bizId: string) {
  return {
    id: toValidUuid(a.id),
    business_id: toValidUuid(bizId),
    agent_name: a.agent_name || 'Business Doctor AI',
    action_type: a.action_type || 'general_recommendation',
    input_data: {
      target_entity: a.target_entity,
      entity_id: a.entity_id,
      proposed_payload: a.proposed_payload,
      reasoning: a.reasoning,
      impact_level: a.impact_level,
      confidence: a.confidence,
    },
    output_data: {},
    status: a.status || 'pending_approval',
    approval_required: true,
    executed_at: a.executed_at || null,
  };
}

export function mapAutomationToDb(a: Automation, bizId: string) {
  return {
    id: toValidUuid(a.id),
    business_id: toValidUuid(bizId),
    name: a.name,
    trigger_type: a.trigger_type || 'new_lead',
    action_type: a.action_type || 'send_whatsapp',
    configuration: {
      conditions: a.conditions || {},
      execution_count: a.execution_count || 0,
      last_run: a.last_run || null,
    },
    enabled: a.is_active ?? true,
    requires_approval: a.requires_approval ?? false,
  };
}

export function mapDiagnosisToDb(d: AIDiagnosis, bizId: string) {
  return {
    id: toValidUuid(d.id),
    business_id: toValidUuid(bizId),
    problem_title: d.problem_title,
    problem_description: d.problem_description || '',
    evidence: {
      text: d.evidence || '',
      category: d.category || 'growth',
      effort: d.effort || 'quick_win',
    },
    confidence: d.confidence || 85,
    severity: d.severity || 'warning',
    recommended_action: d.recommended_action || '',
    expected_kpi: d.expected_kpi || '',
    status: d.status || 'open',
  };
}

export function mapCampaignToDb(c: Campaign, bizId: string) {
  return {
    id: toValidUuid(c.id),
    business_id: toValidUuid(bizId),
    name: c.name,
    objective: c.objective || 'increase_sales',
    target_segment: c.target_segment || 'All Customers',
    offer: c.offer || '',
    channel: c.channel || 'whatsapp',
    start_date: c.start_date || new Date().toISOString().split('T')[0],
    end_date: c.end_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    message_content: c.message_content || '',
    call_to_action: c.call_to_action || 'Reply to Claim',
    status: c.status || 'draft',
    metrics: c.metrics || {},
  };
}

export function mapDataSourceToDb(ds: DataSource, bizId: string) {
  return {
    id: toValidUuid(ds.id),
    business_id: toValidUuid(bizId),
    source_type: ds.source_type || 'website',
    source_name: ds.name || 'External Catalog',
    source_url: null,
    connection_status: ds.status === 'completed' || ds.status === 'synced' ? 'active' : 'pending',
    last_synced_at: ds.last_synced || ds.imported_at || new Date().toISOString(),
  };
}

export function mapAuditLogToDb(l: AuditLog, bizId: string, userId?: string | null) {
  return {
    id: toValidUuid(l.id),
    business_id: toValidUuid(bizId),
    user_id: optionalUuid(userId),
    actor_type: 'user',
    action: l.action,
    resource_type: 'system',
    resource_id: null,
    metadata: { details: l.details },
  };
}

export function mapIntegrationToDb(i: BusinessIntegration, bizId: string) {
  return {
    id: toValidUuid(i.id),
    business_id: toValidUuid(bizId),
    provider: i.provider,
    provider_account_id: i.provider_account_id || null,
    provider_account_name: i.provider_account_name || null,
    status: i.status || 'NOT_CONNECTED',
    scopes: i.scopes || [],
    token_metadata: i.token_metadata || {},
    encrypted_credential_ref: i.encrypted_credential_ref || null,
    connected_at: i.connected_at || null,
    disconnected_at: i.disconnected_at || null,
    last_health_check_at: i.last_health_check_at || null,
    last_error: i.last_error || null,
    metadata: i.metadata || {},
    is_test_mode: Boolean(i.is_test_mode),
  };
}

// -----------------------------------------------------------------------------
// High-Level Synchronization Helpers (Tenant Scoped by business_id)
// -----------------------------------------------------------------------------

export interface SyncPayload {
  business: Business;
  members: BusinessMember[];
  customers: Customer[];
  leads: Lead[];
  products: Product[];
  services: ServiceItem[];
  orders: Order[];
  bookings: Booking[];
  expenses: Expense[];
  memory: BusinessMemory[];
  agentActions: AgentAction[];
  automations: Automation[];
  diagnoses: AIDiagnosis[];
  campaigns: Campaign[];
  dataSources: DataSource[];
  auditLogs: AuditLog[];
  integrations?: BusinessIntegration[];
  userId?: string | null;
}


/**
 * Pushes workspace data to Supabase while strictly respecting foreign key constraints
 * and ensuring tenant isolation by business_id.
 */
export async function pushWorkspaceToSupabase(
  client: SupabaseClient,
  payload: SyncPayload
): Promise<{ success: boolean; message: string; details?: Record<string, number> }> {
  const targetBizUuid = toValidUuid(payload.business.id);

  try {
    // 1. Business record (Parent)
    const bizRow = mapBusinessToDb(payload.business);
    const { error: bErr } = await client.from('businesses').upsert([bizRow]);
    if (bErr) throw new Error(`Failed to sync business: ${bErr.message}`);

    // 2. Memberships
    if (payload.userId) {
      const userUuid = toValidUuid(payload.userId);
      const memberRow = {
        id: toValidUuid(`${targetBizUuid}:${userUuid}`),
        business_id: targetBizUuid,
        user_id: userUuid,
        role: 'owner',
      };
      await client.from('business_members').upsert([memberRow]);
    }

    // 3. Products, Services, Customers (Required before Orders & Bookings)
    if (payload.products.length > 0) {
      const prodRows = payload.products.map((p) => mapProductToDb(p, targetBizUuid));
      const { error } = await client.from('products').upsert(prodRows);
      if (error) console.warn('Supabase products sync:', error.message);
    }

    if (payload.services.length > 0) {
      const srvRows = payload.services.map((s) => mapServiceToDb(s, targetBizUuid));
      const { error } = await client.from('services').upsert(srvRows);
      if (error) console.warn('Supabase services sync:', error.message);
    }

    if (payload.customers.length > 0) {
      const custRows = payload.customers.map((c) => mapCustomerToDb(c, targetBizUuid));
      const { error } = await client.from('customers').upsert(custRows);
      if (error) console.warn('Supabase customers sync:', error.message);
    }

    // 4. Leads, Orders, Bookings
    if (payload.leads.length > 0) {
      const leadRows = payload.leads.map((l) => mapLeadToDb(l, targetBizUuid));
      const { error } = await client.from('leads').upsert(leadRows);
      if (error) console.warn('Supabase leads sync:', error.message);
    }

    if (payload.orders.length > 0) {
      const orderRows = payload.orders.map((o) => mapOrderToDb(o, targetBizUuid));
      const { error } = await client.from('orders').upsert(orderRows);
      if (error) console.warn('Supabase orders sync:', error.message);
    }

    if (payload.bookings.length > 0) {
      const bkRows = payload.bookings.map((b) => mapBookingToDb(b, targetBizUuid));
      const { error } = await client.from('bookings').upsert(bkRows);
      if (error) console.warn('Supabase bookings sync:', error.message);
    }

    // 5. Expenses, Memory, Automations, Actions, Diagnoses, Campaigns, Sources
    if (payload.expenses.length > 0) {
      const expRows = payload.expenses.map((e) => mapExpenseToDb(e, targetBizUuid));
      const { error } = await client.from('expenses').upsert(expRows);
      if (error) console.warn('Supabase expenses sync:', error.message);
    }

    if (payload.memory.length > 0) {
      const memRows = payload.memory.map((m) => mapMemoryToDb(m, targetBizUuid));
      const { error } = await client.from('business_memory').upsert(memRows);
      if (error) console.warn('Supabase business_memory sync:', error.message);
    }

    if (payload.automations.length > 0) {
      const autoRows = payload.automations.map((a) => mapAutomationToDb(a, targetBizUuid));
      const { error } = await client.from('automations').upsert(autoRows);
      if (error) console.warn('Supabase automations sync:', error.message);
    }

    if (payload.agentActions.length > 0) {
      const actRows = payload.agentActions.map((a) => mapActionToDb(a, targetBizUuid));
      const { error } = await client.from('agent_actions').upsert(actRows);
      if (error) console.warn('Supabase agent_actions sync:', error.message);
    }

    if (payload.diagnoses.length > 0) {
      const diagRows = payload.diagnoses.map((d) => mapDiagnosisToDb(d, targetBizUuid));
      const { error } = await client.from('ai_diagnoses').upsert(diagRows);
      if (error) console.warn('Supabase ai_diagnoses sync:', error.message);
    }

    if (payload.campaigns.length > 0) {
      const campRows = payload.campaigns.map((c) => mapCampaignToDb(c, targetBizUuid));
      const { error } = await client.from('campaigns').upsert(campRows);
      if (error) console.warn('Supabase campaigns sync:', error.message);
    }

    if (payload.dataSources.length > 0) {
      const dsRows = payload.dataSources.map((ds) => mapDataSourceToDb(ds, targetBizUuid));
      const { error } = await client.from('data_sources').upsert(dsRows);
      if (error) console.warn('Supabase data_sources sync:', error.message);
    }

    if (payload.integrations && payload.integrations.length > 0) {
      const intRows = payload.integrations.map((i) => mapIntegrationToDb(i, targetBizUuid));
      const { error } = await client.from('business_integrations').upsert(intRows);
      if (error) console.warn('Supabase business_integrations sync:', error.message);
    }

    return {
      success: true,
      message: `Successfully synchronized business records to Supabase tables under tenant ID: ${targetBizUuid}`,
      details: {
        customers: payload.customers.length,
        products: payload.products.length,
        services: payload.services.length,
        orders: payload.orders.length,
        leads: payload.leads.length,
        diagnoses: payload.diagnoses.length,
        actions: payload.agentActions.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Push to Supabase failed',
    };
  }
}

/**
 * Loads all remote database records strictly scoped to the active business_id.
 */
export async function pullWorkspaceFromSupabase(
  client: SupabaseClient,
  rawBusinessId: string
): Promise<{
  success: boolean;
  business?: Partial<Business>;
  customers?: Customer[];
  leads?: Lead[];
  products?: Product[];
  services?: ServiceItem[];
  orders?: Order[];
  bookings?: Booking[];
  expenses?: Expense[];
  memory?: BusinessMemory[];
  agentActions?: AgentAction[];
  automations?: Automation[];
  diagnoses?: AIDiagnosis[];
  campaigns?: Campaign[];
  dataSources?: DataSource[];
  integrations?: BusinessIntegration[];
  error?: string;
}> {
  const targetBizUuid = toValidUuid(rawBusinessId);

  try {
    // 1. Fetch Business
    const { data: bizData } = await client
      .from('businesses')
      .select('*')
      .eq('id', targetBizUuid)
      .maybeSingle();

    // 2. Fetch all collections in parallel, strictly tenant-scoped
    const [
      { data: custRows },
      { data: leadRows },
      { data: prodRows },
      { data: srvRows },
      { data: orderRows },
      { data: bkRows },
      { data: expRows },
      { data: memRows },
      { data: actRows },
      { data: autoRows },
      { data: diagRows },
      { data: campRows },
      { data: dsRows },
      { data: intRows },
    ] = await Promise.all([
      client.from('customers').select('*').eq('business_id', targetBizUuid),
      client.from('leads').select('*').eq('business_id', targetBizUuid),
      client.from('products').select('*').eq('business_id', targetBizUuid),
      client.from('services').select('*').eq('business_id', targetBizUuid),
      client.from('orders').select('*').eq('business_id', targetBizUuid),
      client.from('bookings').select('*').eq('business_id', targetBizUuid),
      client.from('expenses').select('*').eq('business_id', targetBizUuid),
      client.from('business_memory').select('*').eq('business_id', targetBizUuid),
      client.from('agent_actions').select('*').eq('business_id', targetBizUuid),
      client.from('automations').select('*').eq('business_id', targetBizUuid),
      client.from('ai_diagnoses').select('*').eq('business_id', targetBizUuid),
      client.from('campaigns').select('*').eq('business_id', targetBizUuid),
      client.from('data_sources').select('*').eq('business_id', targetBizUuid),
      client.from('business_integrations').select('*').eq('business_id', targetBizUuid),
    ]);

    const result: any = { success: true };

    if (bizData) {
      result.business = {
        id: bizData.id,
        name: bizData.name,
        business_type: bizData.business_type,
        currency: bizData.currency || 'INR',
        country: bizData.country || 'India',
        timezone: bizData.timezone || 'Asia/Kolkata',
        target_customers: bizData.description || '',
        website: bizData.website_url || undefined,
        contact_phone: bizData.phone || undefined,
        contact_email: bizData.email || undefined,
        business_age_stage: (bizData.onboarding_mode as any) || 'growing',
        data_maturity_mode: (bizData.data_maturity as any) || 'existing_partial',
        business_age_months: bizData.business_age_months ?? undefined,
      };
    }

    if (custRows && custRows.length > 0) {
      result.customers = custRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        name: r.name,
        email: r.email || '',
        phone: r.phone || '',
        city: 'Bengaluru',
        source: r.source || 'other',
        status: r.status || 'active',
        first_seen: r.first_seen_at || r.created_at,
        last_activity: r.last_activity_at || r.created_at,
        total_orders: r.total_orders || 0,
        total_spend: Number(r.total_spend) || 0,
        tags: [],
        loyalty_tier: Number(r.total_spend) > 15000 ? 'gold' : Number(r.total_spend) > 5000 ? 'silver' : 'bronze',
        created_at: r.created_at,
      }));
    }

    if (prodRows && prodRows.length > 0) {
      result.products = prodRows.map((r: any) => {
        const price = Number(r.selling_price) || 0;
        const cost = Number(r.cost_price) || 0;
        const margin_pct = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
        return {
          id: r.id,
          business_id: r.business_id,
          name: r.name,
          sku: r.sku || `SKU-${r.id.slice(0, 6)}`,
          category: r.category || 'General',
          price,
          cost,
          margin_pct,
          stock_quantity: Number(r.stock_quantity) || 0,
          status: (r.status as any) || 'active',
          total_sold: 0,
          created_at: r.created_at,
        };
      });
    }

    if (srvRows && srvRows.length > 0) {
      result.services = srvRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        name: r.name,
        category: r.category || 'Consultation',
        price: Number(r.price) || 0,
        duration_minutes: r.duration_minutes || 45,
        status: (r.status as any) || 'active',
        is_active: r.status === 'active',
        description: r.description || '',
        created_at: r.created_at,
      }));
    }

    if (orderRows && orderRows.length > 0) {
      result.orders = orderRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        customer_id: r.customer_id,
        customer_name: 'Customer',
        items: [],
        total_amount: Number(r.total) || 0,
        tax_amount: Number(r.tax) || 0,
        discount_amount: Number(r.discount) || 0,
        payment_status: (r.payment_status as any) || 'paid',
        payment_method: (r.source as any) || 'upi',
        order_status: (r.order_status as any) || 'completed',
        order_date: r.ordered_at || r.created_at,
        notes: '',
        created_at: r.ordered_at || r.created_at,
      }));
    }

    if (leadRows && leadRows.length > 0) {
      result.leads = leadRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        converted_to_customer_id: r.customer_id,
        name: r.name,
        email: r.email || '',
        phone: r.phone || '',
        source: r.source || 'whatsapp',
        status: (r.status as any) || 'new',
        score: Number(r.lead_score) || 50,
        budget: 0,
        interest_product_or_service: r.campaign || 'general',
        last_follow_up: r.last_contact_at || r.created_at,
        next_follow_up: r.next_followup_at || null,
        notes: r.intent || '',
        created_at: r.created_at,
      }));
    }

    if (bkRows && bkRows.length > 0) {
      result.bookings = bkRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        customer_id: r.customer_id,
        customer_name: r.customer_name || 'Client',
        customer_phone: r.customer_phone || '',
        service_id: r.service_id,
        service_name: r.service_name || 'Consultation',
        booking_date: r.booking_date || (r.booking_start ? r.booking_start.split('T')[0] : new Date().toISOString().split('T')[0]),
        time_slot: r.time_slot || (r.booking_start ? r.booking_start.split('T')[1]?.slice(0, 5) : '10:00'),
        status: (r.status as any) || 'confirmed',
        amount: Number(r.amount) || 0,
        payment_status: (r.payment_status as any) || 'paid',
        notes: r.notes || '',
        created_at: r.created_at,
      }));
    }

    if (memRows && memRows.length > 0) {
      result.memory = memRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        observation_type: (r.memory_type as any) || 'insight',
        period: (r.source_type as any) || 'monthly',
        title: r.title,
        content: r.content,
        confidence_score: Number(r.confidence) || 85,
        outcome_recorded: r.verified ? 'Verified operational finding' : null,
        created_at: r.created_at,
      }));
    }

    if (diagRows && diagRows.length > 0) {
      result.diagnoses = diagRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        problem_title: r.problem_title,
        problem_description: r.problem_description || '',
        category: (r.evidence?.category as any) || 'growth',
        evidence: r.evidence?.text || (typeof r.evidence === 'string' ? r.evidence : 'System metric audit'),
        confidence: Number(r.confidence) || 85,
        severity: (r.severity as any) || 'warning',
        recommended_action: r.recommended_action || '',
        expected_kpi: r.expected_kpi || '',
        effort: (r.evidence?.effort as any) || 'quick_win',
        status: (r.status as any) || 'open',
        created_at: r.created_at,
      }));
    }

    if (actRows && actRows.length > 0) {
      result.agentActions = actRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        agent_name: r.agent_name || 'Business Doctor AI',
        action_type: r.action_type,
        target_entity: r.input_data?.target_entity || 'Business Account',
        entity_id: r.input_data?.entity_id || null,
        proposed_payload: r.input_data?.proposed_payload || {},
        status: (r.status as any) || 'pending_approval',
        impact_level: (r.input_data?.impact_level as any) || 'medium',
        confidence: Number(r.input_data?.confidence) || 85,
        reasoning: r.input_data?.reasoning || 'Derived from system performance metrics.',
        created_at: r.created_at,
        executed_at: r.executed_at,
      }));
    }

    if (autoRows && autoRows.length > 0) {
      result.automations = autoRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        name: r.name,
        trigger_type: (r.trigger_type as any) || 'new_lead',
        action_type: (r.action_type as any) || 'send_whatsapp',
        conditions: r.configuration?.conditions || {},
        requires_approval: r.requires_approval ?? false,
        is_active: r.enabled ?? true,
        execution_count: r.configuration?.execution_count || 0,
        last_run: r.configuration?.last_run || null,
        created_at: r.created_at,
      }));
    }

    if (campRows && campRows.length > 0) {
      result.campaigns = campRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        name: r.name,
        objective: (r.objective as any) || 'increase_sales',
        target_segment: r.target_segment || 'All Customers',
        offer: r.offer || '',
        channel: (r.channel as any) || 'whatsapp',
        start_date: r.start_date,
        end_date: r.end_date,
        message_content: r.message_content || '',
        call_to_action: r.call_to_action || 'Reply to Claim',
        status: (r.status as any) || 'draft',
        metrics: r.metrics || {},
        approved_at: r.approved_at,
        executed_at: r.executed_at,
        created_at: r.created_at,
      }));
    }

    if (dsRows && dsRows.length > 0) {
      result.dataSources = dsRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        name: r.source_name || 'Data Source',
        source_type: (r.source_type as any) || 'website',
        status: r.connection_status === 'active' ? 'synced' : 'parsed',
        last_synced: r.last_synced_at,
        imported_at: r.created_at,
      }));
    }

    if (expRows && expRows.length > 0) {
      result.expenses = expRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        category: (r.category as any) || 'other',
        amount: Number(r.amount) || 0,
        expense_date: r.expense_date || r.created_at?.split('T')[0],
        description: r.description || '',
        payment_method: r.source || 'bank_transfer',
        is_recurring: false,
        created_at: r.created_at,
      }));
    }

    if (intRows && intRows.length > 0) {
      result.integrations = intRows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id,
        provider: r.provider,
        provider_account_id: r.provider_account_id || null,
        provider_account_name: r.provider_account_name || null,
        status: r.status,
        scopes: Array.isArray(r.scopes) ? r.scopes : [],
        token_metadata: r.token_metadata || {},
        encrypted_credential_ref: r.encrypted_credential_ref || null,
        connected_at: r.connected_at || null,
        disconnected_at: r.disconnected_at || null,
        last_health_check_at: r.last_health_check_at || null,
        last_error: r.last_error || null,
        metadata: r.metadata || {},
        is_test_mode: Boolean(r.is_test_mode),
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    }

    return result;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to pull from Supabase' };
  }
}
