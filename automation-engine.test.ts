import { describe, it, expect } from 'vitest';
import {
  checkConditions,
  evaluateAutomationEvent,
  getDefaultAutomationTemplates,
  AutomationContext,
  AutomationTriggerEvent,
} from '../../src/lib/automation-engine';
import { Business, Customer, Lead, Automation } from '../../src/types/database';

describe('PHASE 5: Automation Engine & Event Triggers', () => {
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
      id: 'lead_101',
      business_id: 'biz_ayurvedic_01',
      name: 'Sunita Rao',
      email: 'sunita@example.com',
      phone: '+91 98765 11223',
      status: 'new',
      score: 75,
      budget: 3500,
      interest_product_or_service: 'Consultation',
      source: 'website',
      last_follow_up: null,
      next_follow_up: null,
      notes: 'Website lead',
      converted_to_customer_id: null,
      created_at: '2025-01-10T00:00:00Z',
    },
    {
      id: 'lead_102',
      business_id: 'biz_ayurvedic_01',
      name: 'Vikram Singh',
      email: 'vikram@example.com',
      phone: '+91 98765 99887',
      status: 'new',
      score: 35,
      budget: 1000,
      interest_product_or_service: 'General',
      source: 'walk_in',
      last_follow_up: null,
      next_follow_up: null,
      notes: 'Walk-in lead',
      converted_to_customer_id: null,
      created_at: '2025-01-10T00:00:00Z',
    },
  ];

  const mockCustomers: Customer[] = [
    {
      id: 'cust_201',
      business_id: 'biz_ayurvedic_01',
      name: 'Rajesh Sharma',
      email: 'rajesh@example.com',
      phone: '+91 99112 23344',
      city: 'Varanasi',
      source: 'website',
      status: 'vip',
      first_seen: '2024-11-01T00:00:00Z',
      last_activity: '2024-11-20T00:00:00Z',
      tags: ['vip'],
      total_spend: 8500,
      total_orders: 3,
      notes: 'VIP customer',
      created_at: '2024-11-01T00:00:00Z',
    },
  ];

  const mockContext: AutomationContext = {
    business: mockBusiness,
    customers: mockCustomers,
    leads: mockLeads,
    products: [],
    orders: [],
    bookings: [],
  };

  it('getDefaultAutomationTemplates provides pre-configured verified automation recipes', () => {
    const templates = getDefaultAutomationTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(6);
    const triggers = templates.map((a) => a.trigger_type);
    expect(triggers).toContain('new_lead');
    expect(triggers).toContain('replenishment_due');
    expect(triggers).toContain('abandoned_lead');
    expect(triggers).toContain('customer_reactivation_45d');
  });

  it('CONDITION EVALUATION: Correctly filters events by minimum score condition', () => {
    const highEvent: AutomationTriggerEvent = {
      type: 'new_lead',
      businessId: 'biz_ayurvedic_01',
      entityId: 'lead_101',
      payload: { lead: mockLeads[0], score: 75 },
      timestamp: new Date().toISOString(),
    };

    const lowEvent: AutomationTriggerEvent = {
      type: 'new_lead',
      businessId: 'biz_ayurvedic_01',
      entityId: 'lead_102',
      payload: { lead: mockLeads[1], score: 35 },
      timestamp: new Date().toISOString(),
    };

    const condition = { minScore: 50 };
    expect(checkConditions(condition, highEvent, mockContext).matched).toBe(true);
    expect(checkConditions(condition, lowEvent, mockContext).matched).toBe(false);
  });

  it('RULE EVALUATION: Evaluates automation event and creates proposed action when approval required', () => {
    const automations: Automation[] = [
      {
        id: 'auto_hitl_01',
        business_id: 'biz_ayurvedic_01',
        name: 'Speed-to-Lead Follow-Up with Approval',
        trigger_type: 'new_lead',
        action_type: 'send_whatsapp',
        conditions: { minScore: 60 },
        requires_approval: true,
        is_active: true,
        execution_count: 0,
        last_run: null,
        created_at: new Date().toISOString(),
      },
    ];

    const event: AutomationTriggerEvent = {
      type: 'new_lead',
      businessId: 'biz_ayurvedic_01',
      entityId: 'lead_101',
      payload: {
        lead_id: 'lead_101',
        lead_name: 'Sunita Rao',
        lead_phone: '+91 98765 11223',
        lead_interest: 'Ayurvedic Consultation',
        score: 75,
      },
      timestamp: new Date().toISOString(),
    };

    const results = evaluateAutomationEvent(event, automations, mockContext);
    expect(results.length).toBe(1);
    expect(results[0].ruleId).toBe('auto_hitl_01');
    expect(results[0].status).toBe('PROPOSED_FOR_APPROVAL');
    expect(results[0].generatedAction).toBeDefined();
    expect(results[0].generatedAction?.agent_name).toBe('Lead Follow-Up Agent');
    expect(results[0].executionLog.status).toBe('PROPOSED_FOR_APPROVAL');
  });

  it('MULTI-RULE EVENT PROCESSING: Runs all matching rules and produces audit logs', () => {
    const rules: Automation[] = [
      {
        id: 'auto_test_01',
        business_id: 'biz_ayurvedic_01',
        name: 'Auto WhatsApp for High Score Leads',
        trigger_type: 'new_lead',
        action_type: 'send_whatsapp',
        conditions: { minScore: 60 },
        is_active: true,
        requires_approval: true,
        execution_count: 0,
        last_run: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'auto_test_02',
        business_id: 'biz_ayurvedic_01',
        name: 'Unconditional Lead Alert',
        trigger_type: 'new_lead',
        action_type: 'alert_owner',
        conditions: {},
        is_active: true,
        requires_approval: false,
        execution_count: 0,
        last_run: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'auto_inactive',
        business_id: 'biz_ayurvedic_01',
        name: 'Inactive Rule',
        trigger_type: 'new_lead',
        action_type: 'send_whatsapp',
        conditions: {},
        is_active: false,
        requires_approval: false,
        execution_count: 0,
        last_run: null,
        created_at: new Date().toISOString(),
      },
    ];

    const event: AutomationTriggerEvent = {
      type: 'new_lead',
      businessId: 'biz_ayurvedic_01',
      entityId: 'lead_101',
      payload: { score: 80, lead_name: 'Sunita Rao' },
      timestamp: new Date().toISOString(),
    };

    const results = evaluateAutomationEvent(event, rules, mockContext);
    // Inactive rule is filtered out; 2 active rules evaluated
    expect(results.length).toBe(2);

    const hitlResult = results.find((r) => r.ruleId === 'auto_test_01')!;
    expect(hitlResult.status).toBe('PROPOSED_FOR_APPROVAL');
    expect(hitlResult.generatedAction).toBeDefined();

    const directResult = results.find((r) => r.ruleId === 'auto_test_02')!;
    expect(directResult.status).toBe('EXECUTED');
  });

  it('TENANT BOUNDARY: Blocks event if caller tenant does not match context business', () => {
    const automations: Automation[] = [
      {
        id: 'auto_sec_01',
        business_id: 'biz_ayurvedic_01',
        name: 'Security Test Rule',
        trigger_type: 'new_lead',
        action_type: 'send_whatsapp',
        conditions: {},
        is_active: true,
        requires_approval: false,
        execution_count: 0,
        last_run: null,
        created_at: new Date().toISOString(),
      },
    ];

    const rogueEvent: AutomationTriggerEvent = {
      type: 'new_lead',
      businessId: 'biz_tenant_b_attacker', // Mismatch!
      payload: { score: 99 },
      timestamp: new Date().toISOString(),
    };

    const results = evaluateAutomationEvent(rogueEvent, automations, mockContext);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('FAILED');
    expect(results[0].reason).toContain('Cross-tenant automation blocked');
  });
});
