import { describe, it, expect } from 'vitest';
import {
  calculateCRMMetrics,
  calculateDeterministicLeadScore,
  getLeadFunnelData,
  getCustomerSegments,
  deriveFollowUpsFromRecords,
  buildCustomer360,
  formatCurrency,
} from '../../src/lib/crm-engine';
import { getNowInTimezone } from '../../src/lib/period-safety';
import { Business, Customer, Lead, Order, Booking } from '../../src/types/database';
import { CRMFollowUp } from '../../src/types/crm';

describe('CRM Engine & Metrics Integrity Suite (Grounding & Verification)', () => {
  const mockBusiness: Business = {
    id: 'biz_crm_test_001',
    name: 'AyurVeda Clinic & Apothecary',
    business_type: 'hybrid',
    industry: 'wellness_spa',
    location: 'Bengaluru, India',
    country: 'India',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    business_age_stage: 'growing',
    data_maturity_mode: 'existing_complete',
    target_customers: 'Ayurvedic wellness seekers',
    business_goals: ['Retention', 'Consultations'],
    monthly_revenue_target: 200000,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const mockLead = (data: Partial<Lead>): Lead => ({
    id: 'lead_default',
    business_id: mockBusiness.id,
    name: 'Mock Lead',
    email: 'mock@example.com',
    phone: '+91 98765 00000',
    source: 'direct',
    status: 'new',
    score: 50,
    budget: 1000,
    interest_product_or_service: 'General Consultation',
    last_follow_up: null,
    next_follow_up: null,
    notes: '',
    converted_to_customer_id: null,
    created_at: '2026-01-01T00:00:00Z',
    ...data,
  });

  const mockCustomer = (data: Partial<Customer>): Customer => ({
    id: 'cust_default',
    business_id: mockBusiness.id,
    name: 'Mock Customer',
    email: 'cust@example.com',
    phone: '+91 98765 99999',
    city: 'Bengaluru',
    source: 'walk_in',
    status: 'active',
    first_seen: '2026-01-01T00:00:00Z',
    last_activity: '2026-01-01T00:00:00Z',
    total_orders: 1,
    total_spend: 1000,
    notes: '',
    tags: ['Customer'],
    created_at: '2026-01-01T00:00:00Z',
    ...data,
  });

  it('1. Day-0 Workspace: Enforces Insufficient Data flags and produces zero fake metrics', () => {
    const metrics = calculateCRMMetrics(mockBusiness, [], [], [], [], []);

    expect(metrics.totalLeads).toBe(0);
    expect(metrics.openLeads).toBe(0);
    expect(metrics.wonLeads).toBe(0);
    expect(metrics.conversionRate).toBeNull();
    expect(metrics.hasSufficientLeadData).toBe(false);

    expect(metrics.totalCustomers).toBe(0);
    expect(metrics.repeatCustomers).toBe(0);
    expect(metrics.hasSufficientCustomerData).toBe(false);

    expect(metrics.avgLeadScore).toBeNull();
    expect(metrics.avgCustomerSpend).toBeNull();
    expect(metrics.followupsDueToday).toBe(0);
    expect(metrics.overdueFollowups).toBe(0);
  });

  it('2. Lead Conversion Rate: Accurately calculates integer percentage strictly from won/total ratio', () => {
    const leads: Lead[] = [
      mockLead({
        id: 'l1',
        name: 'Aarav Sharma',
        phone: '+91 98765 00001',
        status: 'won',
        source: 'WhatsApp',
        score: 85,
        created_at: '2026-02-01T00:00:00Z',
      }),
      mockLead({
        id: 'l2',
        name: 'Pooja Iyer',
        phone: '+91 98765 00002',
        status: 'won',
        source: 'Instagram DM',
        score: 90,
        created_at: '2026-02-02T00:00:00Z',
      }),
      mockLead({
        id: 'l3',
        name: 'Vikram Mehta',
        phone: '+91 98765 00003',
        status: 'contacted',
        source: 'Google Ads',
        score: 60,
        created_at: '2026-02-03T00:00:00Z',
      }),
      mockLead({
        id: 'l4',
        name: 'Rhea Sen',
        phone: '+91 98765 00004',
        status: 'lost',
        source: 'Website Form',
        score: 40,
        created_at: '2026-02-04T00:00:00Z',
      }),
    ];

    const metrics = calculateCRMMetrics(mockBusiness, leads, [], [], [], []);

    expect(metrics.totalLeads).toBe(4);
    expect(metrics.wonLeads).toBe(2);
    expect(metrics.hasSufficientLeadData).toBe(true);
    // 2 won out of 4 total = 50%
    expect(metrics.conversionRate).toBe(50);
  });

  it('3. Lead Funnel Reconciler: Accurately stages leads and accumulates stage budgets', () => {
    const leads: Lead[] = [
      mockLead({ id: 'l1', name: 'Lead 1', status: 'new', budget: 5000 }),
      mockLead({ id: 'l2', name: 'Lead 2', status: 'new', budget: 3500 }),
      mockLead({ id: 'l3', name: 'Lead 3', status: 'contacted', budget: 8000 }),
      mockLead({ id: 'l4', name: 'Lead 4', status: 'proposal', budget: 12000 }),
      mockLead({ id: 'l5', name: 'Lead 5', status: 'won', budget: 15000 }),
      mockLead({ id: 'l6', name: 'Lead 6', status: 'lost', budget: 2000 }),
    ];

    const stages = getLeadFunnelData(leads);

    const newStage = stages.find((s) => s.stage === 'new');
    expect(newStage?.count).toBe(2);
    expect(newStage?.totalBudget).toBe(8500);

    const contactedStage = stages.find((s) => s.stage === 'contacted');
    expect(contactedStage?.count).toBe(1);
    expect(contactedStage?.totalBudget).toBe(8000);

    const proposalStage = stages.find((s) => s.stage === 'proposal');
    expect(proposalStage?.count).toBe(1);
    expect(proposalStage?.totalBudget).toBe(12000);

    const wonStage = stages.find((s) => s.stage === 'won');
    expect(wonStage?.count).toBe(1);
    expect(wonStage?.totalBudget).toBe(15000);
  });

  it('4. Open Leads Counter: Excludes won, converted, and lost leads from open pipeline', () => {
    const leads: Lead[] = [
      mockLead({ id: 'l1', name: 'L1', status: 'new' }),
      mockLead({ id: 'l2', name: 'L2', status: 'contacted' }),
      mockLead({ id: 'l3', name: 'L3', status: 'qualified' }),
      mockLead({ id: 'l4', name: 'L4', status: 'won' }),
      mockLead({ id: 'l5', name: 'L5', status: 'lost' }),
    ];

    const metrics = calculateCRMMetrics(mockBusiness, leads, [], [], [], []);
    // 3 active (new, contacted, qualified) out of 5
    expect(metrics.openLeads).toBe(3);
  });

  it('5. Grounded Evidence Hierarchy: Distinguishes observed counts from calculated conversion rates', () => {
    const customers: Customer[] = [
      mockCustomer({ id: 'c1', name: 'C1', total_orders: 1, total_spend: 3000 }),
      mockCustomer({ id: 'c2', name: 'C2', total_orders: 2, total_spend: 6000 }),
    ];

    const metrics = calculateCRMMetrics(mockBusiness, [], customers, [], [], []);

    // Total customers is directly observed from database records
    expect(metrics.totalCustomers).toBe(2);
    expect(metrics.metricsEvidence.totalCustomers.state).toBe('observed');

    // Average customer spend is calculated from observed totals
    expect(metrics.avgCustomerSpend).toBe(4500);
    expect(metrics.metricsEvidence.avgCustomerSpend.state).toBe('calculated');

    // Conversion rate with 0 leads is insufficient_data, never observed
    expect(metrics.conversionRate).toBeNull();
    expect(metrics.metricsEvidence.conversionRate.state).toBe('insufficient_data');
  });

  it('6. Deterministic Lead Scoring: High budget (≥₹5000) provides top budget score component', () => {
    const highBudgetLead: Lead = mockLead({
      id: 'l_high',
      name: 'Dr. Rajesh Patel',
      phone: '+91 98765 11111',
      email: 'rajesh@patel.com',
      budget: 10000,
      source: 'WhatsApp',
      status: 'qualified',
    });

    const lowBudgetLead: Lead = mockLead({
      id: 'l_low',
      name: 'Rajesh Patel',
      budget: 500,
      source: 'Other',
      status: 'new',
    });

    const highScore = calculateDeterministicLeadScore(highBudgetLead);
    const lowScore = calculateDeterministicLeadScore(lowBudgetLead);

    const highBudgetFactor = highScore.factors.find((f) => f.factor.toLowerCase().includes('budget'));
    const lowBudgetFactor = lowScore.factors.find((f) => f.factor.toLowerCase().includes('budget'));

    expect(highBudgetFactor?.points).toBe(20);
    expect(lowBudgetFactor?.points).toBe(8);
    expect(highScore.score).toBeGreaterThan(lowScore.score);
  });

  it('7. Deterministic Lead Scoring: Contact details completeness adds up to 20 points', () => {
    const completeLead: Lead = mockLead({
      id: 'l_comp',
      name: 'Full Profile',
      phone: '+91 98765 22222',
      email: 'full@profile.com',
      interest_product_or_service: 'Panchakarma Detox 14-Day',
    });

    const incompleteLead: Lead = mockLead({
      id: 'l_incomp',
      name: 'Nameless Inquirer',
      phone: '',
      email: '',
    });

    const compScore = calculateDeterministicLeadScore(completeLead);
    const incompScore = calculateDeterministicLeadScore(incompleteLead);

    const compPhoneFactor = compScore.factors.find((f) => f.factor.toLowerCase().includes('phone'));
    const incompPhoneFactor = incompScore.factors.find((f) => f.factor.toLowerCase().includes('phone'));

    expect(compPhoneFactor?.points).toBe(20);
    expect(incompPhoneFactor?.points).toBe(0);
  });

  it('8. Deterministic Lead Scoring: Score boundaries are strictly clamped to [0, 100]', () => {
    const maxLead: Lead = mockLead({
      id: 'l_max',
      name: 'Executive VIP',
      phone: '+91 99999 99999',
      email: 'exec@vip.com',
      budget: 50000,
      source: 'Referral',
      status: 'proposal',
      interest_product_or_service: 'Full Rejuvenation Package',
      created_at: new Date().toISOString(),
    });

    const minLead: Lead = mockLead({
      id: 'l_min',
      name: 'Zero Info',
      phone: '',
      email: '',
      budget: 0,
    });

    const maxResult = calculateDeterministicLeadScore(maxLead);
    const minResult = calculateDeterministicLeadScore(minLead);

    expect(maxResult.score).toBeLessThanOrEqual(100);
    expect(maxResult.score).toBeGreaterThanOrEqual(0);
    expect(minResult.score).toBeGreaterThanOrEqual(0);
    expect(minResult.score).toBeLessThanOrEqual(100);
  });

  it('9. Timezone-Aware Follow-up Status: Overdue and Due Today evaluated in business timezone', () => {
    const today = getNowInTimezone(mockBusiness.timezone).dateStr;
    const pastDate = '2025-01-01';
    const futureDate = '2030-12-31';

    const followups: CRMFollowUp[] = [
      {
        id: 'fu_overdue',
        business_id: mockBusiness.id,
        target_type: 'lead',
        target_id: 'l1',
        target_name: 'Overdue Contact',
        due_date: pastDate,
        reason: 'Past due call',
        status: 'pending',
        created_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'fu_today',
        business_id: mockBusiness.id,
        target_type: 'customer',
        target_id: 'c1',
        target_name: 'Today Contact',
        due_date: today,
        reason: 'Check-in on treatment',
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'fu_upcoming',
        business_id: mockBusiness.id,
        target_type: 'customer',
        target_id: 'c2',
        target_name: 'Upcoming Contact',
        due_date: futureDate,
        reason: 'Quarterly review',
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    const unified = deriveFollowUpsFromRecords([], [], followups, mockBusiness.timezone);

    const overdue = unified.find((f) => f.id === 'fu_overdue');
    expect(overdue?.status).toBe('overdue');

    const dueToday = unified.find((f) => f.id === 'fu_today');
    expect(dueToday?.status).toBe('pending');
  });

  it('10. Follow-ups Derivation: Reconciles lead next_follow_up without duplicating explicit follow-ups', () => {
    const leads: Lead[] = [
      mockLead({
        id: 'l_fu_1',
        name: 'Siddharth Roy',
        phone: '+91 98765 33333',
        status: 'contacted',
        next_follow_up: '2026-06-15',
      }),
    ];

    const explicit: CRMFollowUp[] = [
      {
        id: 'fu_explicit_1',
        business_id: mockBusiness.id,
        target_type: 'lead',
        target_id: 'l_fu_1',
        target_name: 'Siddharth Roy',
        due_date: '2026-06-15',
        reason: 'Discuss consultation pricing',
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    const unified = deriveFollowUpsFromRecords(leads, [], explicit, mockBusiness.timezone);

    // Explicit follow-up overrides lead implicit follow-up, no duplicate entries created
    expect(unified.length).toBe(1);
    expect(unified[0].target_name).toBe('Siddharth Roy');
    expect(unified[0].reason).toBe('Discuss consultation pricing');
  });

  it('11. Customer Cohort Segmentation: Correctly identifies VIP / High Value based on real total_spend', () => {
    const customers: Customer[] = [
      mockCustomer({ id: 'c1', name: 'VIP Guest', total_spend: 25000, total_orders: 5 }),
      mockCustomer({ id: 'c2', name: 'Modest Guest', total_spend: 1500, total_orders: 1 }),
    ];

    const { summaries, filterBySegment } = getCustomerSegments(customers, [], [], [], '₹');

    const highValueSeg = summaries.find((s) => s.type === 'high_value');
    expect(highValueSeg?.count).toBe(1);

    const { filteredCustomers } = filterBySegment('high_value');
    expect(filteredCustomers.length).toBe(1);
    expect(filteredCustomers[0].name).toBe('VIP Guest');
  });

  it('12. Customer Cohort Segmentation: Identifies repeat buyers with total_orders > 1', () => {
    const customers: Customer[] = [
      mockCustomer({ id: 'c1', name: 'Single Buyer', total_orders: 1, total_spend: 2000 }),
      mockCustomer({ id: 'c2', name: 'Repeat Buyer A', total_orders: 2, total_spend: 4000 }),
      mockCustomer({ id: 'c3', name: 'Repeat Buyer B', total_orders: 4, total_spend: 8500 }),
    ];

    const { summaries } = getCustomerSegments(customers, [], [], [], '₹');
    const repeatSeg = summaries.find((s) => s.type === 'repeat_customers');

    expect(repeatSeg?.count).toBe(2);
    expect(repeatSeg?.totalValue).toBe(12500);
  });

  it('13. Customer Cohort Segmentation: Identifies at-risk customers inactive for > 60 days', () => {
    const sixtyFiveDaysAgo = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const customers: Customer[] = [
      mockCustomer({
        id: 'c_at_risk',
        name: 'Inactive Customer',
        last_activity: sixtyFiveDaysAgo,
        total_orders: 2,
        total_spend: 5000,
      }),
      mockCustomer({
        id: 'c_active',
        name: 'Recent Customer',
        last_activity: tenDaysAgo,
        total_orders: 1,
        total_spend: 2500,
      }),
    ];

    const { summaries } = getCustomerSegments(customers, [], [], [], '₹');
    const atRiskSeg = summaries.find((s) => s.type === 'at_risk');

    expect(atRiskSeg?.count).toBe(1);
  });

  it('14. Customer 360 Builder: Merges orders and bookings chronologically without fabricating events', () => {
    const customer: Customer = mockCustomer({
      id: 'c_360',
      name: 'Sunita Rao',
      email: 'sunita@rao.com',
      phone: '+91 98765 44444',
      first_seen: '2026-01-10T10:00:00Z',
    });

    const orders: Order[] = [
      {
        id: 'ord_1',
        business_id: mockBusiness.id,
        customer_id: 'c_360',
        customer_name: 'Sunita Rao',
        order_date: '2026-01-15T14:30:00Z',
        total_amount: 3200,
        tax_amount: 0,
        discount_amount: 0,
        payment_status: 'paid',
        payment_method: 'upi',
        order_status: 'delivered',
        notes: '',
        items: [{ id: 'p1', name: 'Kumkumadi Tailam 30ml', quantity: 1, unit_price: 3200, total: 3200 }],
      },
    ];

    const bookings: Booking[] = [
      {
        id: 'bk_1',
        business_id: mockBusiness.id,
        customer_id: 'c_360',
        customer_name: 'Sunita Rao',
        booking_date: '2026-02-01T11:00:00Z',
        amount: 4500,
        status: 'completed',
        service_name: 'Abhyanga Massage 60min',
        notes: '',
        created_at: '2026-02-01T11:00:00Z',
      },
    ];

    const profile = buildCustomer360(customer, orders, bookings, [], mockBusiness);

    expect(profile.customer.id).toBe('c_360');
    expect(profile.orders.length).toBe(1);
    expect(profile.bookings.length).toBe(1);
    expect(profile.totalRevenue).toBe(7700);
    // Chronological timeline contains customer created + order + booking
    expect(profile.timeline.length).toBeGreaterThanOrEqual(3);
  });

  it('15. Currency Formatter: Formats values cleanly according to symbol without floating point artifacts', () => {
    expect(formatCurrency(12500, '₹')).toContain('12,500');
    expect(formatCurrency(0, '₹')).toBe('₹0');
    expect(formatCurrency(1000, '$')).toContain('1,000');
    expect(formatCurrency(999.99, '$')).toContain('999.99');
  });
});
