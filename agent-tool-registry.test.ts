import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS, executeTool, ToolExecutionContext } from '../../src/lib/agent-tool-registry';
import { Business, Customer, Lead, Product, Order, AgentAction } from '../../src/types/database';

describe('PHASE 5: Agent Tool Registry & RBAC Isolation', () => {
  const mockBusiness: Business = {
    id: 'biz_ayurvedic_01',
    name: 'Ayurvedic Remedies & Wellness Clinic',
    business_type: 'product',
    industry: 'Wellness & Ayurveda',
    location: 'Varanasi',
    country: 'India',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    business_age_stage: 'growing',
    data_maturity_mode: 'existing_complete',
    target_customers: 'Ayurvedic Wellness Enthusiasts',
    business_goals: ['Scale direct orders'],
    monthly_revenue_target: 500000,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockLeads: Lead[] = [
    {
      id: 'lead_01',
      business_id: 'biz_ayurvedic_01',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '+91 98765 43210',
      status: 'new',
      score: 85,
      budget: 5000,
      interest_product_or_service: 'Digestive Health',
      source: 'website',
      last_follow_up: null,
      next_follow_up: null,
      notes: 'New inquiry',
      converted_to_customer_id: null,
      created_at: '2025-01-10T00:00:00Z',
    },
    {
      id: 'lead_02',
      business_id: 'biz_ayurvedic_01',
      name: 'Rohan Gupta',
      email: 'rohan@example.com',
      phone: '+91 91234 56789',
      status: 'contacted',
      score: 40,
      budget: 1500,
      interest_product_or_service: 'Skin Care',
      source: 'referral',
      last_follow_up: null,
      next_follow_up: null,
      notes: 'Contacted',
      converted_to_customer_id: null,
      created_at: '2025-01-11T00:00:00Z',
    },
  ];

  const mockCustomers: Customer[] = [
    {
      id: 'cust_01',
      business_id: 'biz_ayurvedic_01',
      name: 'Ananya Verma',
      email: 'ananya@example.com',
      phone: '+91 99887 76655',
      city: 'Varanasi',
      source: 'website',
      status: 'vip',
      first_seen: '2024-11-01T00:00:00Z',
      last_activity: '2025-01-05T00:00:00Z',
      total_orders: 5,
      total_spend: 12500,
      notes: 'VIP customer',
      tags: ['vip', 'regular'],
      created_at: '2024-11-01T00:00:00Z',
    },
  ];

  const mockProducts: Product[] = [
    {
      id: 'prod_01',
      business_id: 'biz_ayurvedic_01',
      name: 'Digestive Churna',
      sku: 'DIG-01',
      category: 'Herbal Formulation',
      price: 450,
      cost: 150,
      margin_pct: 66,
      stock_quantity: 4,
      status: 'low_stock',
      total_sold: 45,
      created_at: '2025-01-01T00:00:00Z',
    },
  ];

  const mockOrders: Order[] = [
    {
      id: 'ord_01',
      business_id: 'biz_ayurvedic_01',
      customer_id: 'cust_01',
      customer_name: 'Ananya Verma',
      items: [],
      total_amount: 1500,
      tax_amount: 0,
      discount_amount: 0,
      payment_status: 'paid',
      payment_method: 'upi',
      order_status: 'delivered',
      order_date: '2025-01-05T00:00:00Z',
      notes: 'Completed order',
      created_at: '2025-01-05T00:00:00Z',
    },
  ];

  const mockActions: AgentAction[] = [
    {
      id: 'act_pending_01',
      business_id: 'biz_ayurvedic_01',
      agent_id: 'lead_followup',
      agent_name: 'Lead Follow-Up Agent',
      action_type: 'send_whatsapp',
      target_entity: 'lead',
      entity_id: 'lead_01',
      proposed_payload: { message: 'Hello Priya' },
      reasoning: 'Grounded lead qualification',
      confidence: 95,
      impact_level: 'medium',
      status: 'PROPOSED',
      created_at: '2025-01-12T00:00:00Z',
      executed_at: null,
    },
    {
      id: 'act_approved_01',
      business_id: 'biz_ayurvedic_01',
      agent_id: 'inventory_agent',
      agent_name: 'Inventory Agent',
      action_type: 'reorder_stock',
      target_entity: 'product',
      entity_id: 'prod_01',
      proposed_payload: { quantity: 20 },
      reasoning: 'Stock critically low',
      confidence: 98,
      impact_level: 'high',
      status: 'APPROVED',
      created_at: '2025-01-12T00:00:00Z',
      executed_at: null,
    },
  ];

  const createContext = (role: 'owner' | 'manager' | 'staff' | 'viewer', businessId = 'biz_ayurvedic_01'): ToolExecutionContext => ({
    businessId,
    userRole: role,
    userId: 'usr_tester',
    database: {
      business: mockBusiness,
      customers: mockCustomers,
      leads: mockLeads,
      products: mockProducts,
      services: [],
      orders: mockOrders,
      bookings: [],
      expenses: [],
      memory: [],
      agentActions: mockActions,
    },
  });

  it('Tool Registry defines all registered tools with parameter schemas', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(13);
    const toolIds = TOOL_DEFINITIONS.map((t) => t.id);
    expect(toolIds).toContain('crm_search_leads');
    expect(toolIds).toContain('crm_get_customer_profile');
    expect(toolIds).toContain('crm_update_lead_status');
    expect(toolIds).toContain('catalog_search_products');
    expect(toolIds).toContain('catalog_check_stock');
    expect(toolIds).toContain('booking_check_availability');
    expect(toolIds).toContain('booking_get_upcoming');
    expect(toolIds).toContain('analytics_get_revenue_summary');
    expect(toolIds).toContain('analytics_get_pnl_summary');
    expect(toolIds).toContain('analytics_get_churn_risk');
    expect(toolIds).toContain('memory_get_observations');
    expect(toolIds).toContain('action_propose_action');
    expect(toolIds).toContain('action_execute_approved_action');
  });

  it('STRICT TENANT ISOLATION: Rejects tool execution if businessId does not match context', async () => {
    const context = createContext('owner', 'biz_ayurvedic_01');
    const result = await executeTool(
      'crm_search_leads',
      { businessId: 'biz_tenant_b_attacker', query: 'Priya' },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cross-tenant access denied');
  });

  it('RBAC RESTRICTION: Denies low-privilege staff from executing manager-only tools', async () => {
    const context = createContext('staff');
    // crm_update_lead_status requires manager role
    const result = await executeTool(
      'crm_update_lead_status',
      {
        businessId: 'biz_ayurvedic_01',
        leadId: 'lead_01',
        newStatus: 'contacted',
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission Denied');
  });

  it('RBAC PERMISSION: Allows manager or owner to execute privileged updates', async () => {
    const context = createContext('manager');
    const result = await executeTool(
      'crm_update_lead_status',
      {
        businessId: 'biz_ayurvedic_01',
        leadId: 'lead_01',
        newStatus: 'qualified',
        notes: 'Follow-up done via phone',
      },
      context
    );

    expect(result.success).toBe(true);
    expect(result.data.newStatus).toBe('qualified');
    expect(result.data.leadId).toBe('lead_01');
  });

  it('READ TOOL EXECUTION: Successfully executes crm_search_leads with grounding', async () => {
    const context = createContext('staff');
    const result = await executeTool(
      'crm_search_leads',
      {
        businessId: 'biz_ayurvedic_01',
        query: 'Priya',
      },
      context
    );

    expect(result.success).toBe(true);
    expect(result.data.totalFound).toBe(1);
    expect(result.data.leads[0].name).toBe('Priya Sharma');
    expect(result.groundedEvidence?.length).toBeGreaterThan(0);
  });

  it('HITL SAFETY: Prevents execution of unapproved actions via action_execute_approved_action', async () => {
    const context = createContext('owner');
    const result = await executeTool(
      'action_execute_approved_action',
      {
        businessId: 'biz_ayurvedic_01',
        actionId: 'act_pending_01', // Status is PROPOSED, not APPROVED
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Action must be in 'APPROVED' state before execution");
  });

  it('HITL SAFETY: Successfully executes approved action with audit trace', async () => {
    const context = createContext('owner');
    const result = await executeTool(
      'action_execute_approved_action',
      {
        businessId: 'biz_ayurvedic_01',
        actionId: 'act_approved_01', // Status is APPROVED
      },
      context
    );

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('EXECUTED');
    expect(result.data.executedBy).toBe('usr_tester');
  });
});
