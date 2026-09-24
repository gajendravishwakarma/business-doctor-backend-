import { describe, it, expect } from 'vitest';
import { calculateBusinessMetrics, generateDeterministicDiagnoses } from '../../src/lib/diagnosis-engine';
import {
  isTodayInTimezone,
  isCurrentMonthInTimezone,
  getDatePartsInTimezone,
  getDaysElapsedInCurrentMonth,
} from '../../src/lib/period-safety';
import {
  Business,
  Order,
  Expense,
  Customer,
  Lead,
  Booking,
  Product,
} from '../../src/types/database';

describe('Dashboard Metrics & Data Integrity Audit', () => {
  const mockBusiness: Business = {
    id: 'biz_test_uuid_001',
    name: 'AyurSutra Wellness Spa',
    business_type: 'hybrid',
    industry: 'wellness_spa',
    location: 'Bengaluru, India',
    country: 'India',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    business_age_stage: 'growing',
    data_maturity_mode: 'existing_complete',
    target_customers: 'Urban professionals seeking wellness',
    business_goals: ['Increase retention', 'Boost margin'],
    monthly_revenue_target: 300000,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const nowIso = new Date().toISOString();

  it('1. EMPTY / DAY-0 TENANT: Strictly enforces Insufficient Data states with zero hallucinations', () => {
    const metrics = calculateBusinessMetrics(
      mockBusiness,
      [], // orders
      [], // expenses
      [], // customers
      [], // leads
      [], // bookings
      []  // products
    );

    expect(metrics.hasSufficientData).toBe(false);
    expect(metrics.hasSufficientRevenueData).toBe(false);
    expect(metrics.hasSufficientProfitData).toBe(false);
    expect(metrics.hasSufficientMarginData).toBe(false);
    expect(metrics.hasSufficientRepeatData).toBe(false);
    expect(metrics.hasSufficientLeadData).toBe(false);
    expect(metrics.hasSufficientHealthData).toBe(false);
    expect(metrics.hasSufficientAovData).toBe(false);
    expect(metrics.hasSufficientRunRateData).toBe(false);

    // Business Health Score must NOT invent a default 50
    expect(metrics.healthScore).toBeNull();
    expect(metrics.healthBand).toBe('Insufficient Data');

    // Run rate progress must be null
    expect(metrics.targetMonthlyRunRateProgress).toBeNull();

    // Evidence ledger must report insufficient_data for derived metrics
    expect(metrics.metricsEvidence.totalRevenue.state).toBe('insufficient_data');
    expect(metrics.metricsEvidence.netProfit.state).toBe('insufficient_data');
    expect(metrics.metricsEvidence.grossMargin.state).toBe('insufficient_data');
    expect(metrics.metricsEvidence.repeatCustomerRate.state).toBe('insufficient_data');
    expect(metrics.metricsEvidence.healthScore.state).toBe('insufficient_data');
    expect(metrics.metricsEvidence.targetMonthlyRunRate.state).toBe('insufficient_data');
  });

  it('2. 3 RECENTLY IMPORTED CUSTOMERS (0 ORDERS): Never creates unsupported historical trends or repeat rates', () => {
    const importedCustomers: Customer[] = [
      {
        id: 'cust_imp_1',
        business_id: mockBusiness.id,
        name: 'Aarav Patel',
        email: 'aarav@example.com',
        phone: '+91 98765 11111',
        city: 'Bengaluru',
        source: 'walk_in',
        first_seen: nowIso,
        last_activity: nowIso,
        total_orders: 0,
        total_spend: 0,
        status: 'active',
        notes: '',
        tags: ['imported'],
        created_at: nowIso,
      },
      {
        id: 'cust_imp_2',
        business_id: mockBusiness.id,
        name: 'Priya Sharma',
        email: 'priya@example.com',
        phone: '+91 98765 22222',
        city: 'Mumbai',
        source: 'referral',
        first_seen: nowIso,
        last_activity: nowIso,
        total_orders: 0,
        total_spend: 0,
        status: 'active',
        notes: '',
        tags: ['imported'],
        created_at: nowIso,
      },
      {
        id: 'cust_imp_3',
        business_id: mockBusiness.id,
        name: 'Rohan Verma',
        email: 'rohan@example.com',
        phone: '+91 98765 33333',
        city: 'Delhi',
        source: 'instagram',
        first_seen: nowIso,
        last_activity: nowIso,
        total_orders: 0,
        total_spend: 0,
        status: 'active',
        notes: '',
        tags: ['imported'],
        created_at: nowIso,
      },
    ];

    const metrics = calculateBusinessMetrics(
      mockBusiness,
      [], // zero orders
      [], // zero expenses
      importedCustomers,
      [], // zero leads
      [], // zero bookings
      []  // zero products
    );

    expect(metrics.totalCustomers).toBe(3);
    // Because there are 0 recorded orders or bookings, repeatCustomerRate must be 0 and marked insufficient
    expect(metrics.repeatCustomerRate).toBe(0);
    expect(metrics.repeatCustomers).toBe(0);
    expect(metrics.hasSufficientRepeatData).toBe(false);
    expect(metrics.metricsEvidence.repeatCustomerRate.state).toBe('insufficient_data');

    // Deterministic diagnoses must NOT invent repeat retention problems when there are no transactions
    const diagnoses = generateDeterministicDiagnoses(
      mockBusiness,
      metrics,
      [],
      [],
      importedCustomers,
      [],
      [],
      []
    );

    const retentionDiag = diagnoses.find((d) => d.category === 'retention');
    expect(retentionDiag).toBeUndefined();

    // Must return the explicit Insufficient Data audit finding
    const insufficientDiag = diagnoses.find((d) => d.problem_title.includes('Insufficient Data'));
    expect(insufficientDiag).toBeDefined();
    expect(insufficientDiag?.affected_metric).toBe('Full Operational Baseline');
    expect(insufficientDiag?.source_data).toBeDefined();
  });

  it('3. FULL VERIFIED DATASET: Correctly calculates audited revenue, margin, AOV, and health score', () => {
    const orders: Order[] = [
      {
        id: 'ord_1',
        business_id: mockBusiness.id,
        customer_id: 'cust_1',
        customer_name: 'Aditi Rao',
        total_amount: 5000,
        tax_amount: 250,
        discount_amount: 0,
        order_status: 'delivered',
        payment_status: 'paid',
        payment_method: 'upi',
        order_date: nowIso,
        notes: '',
        items: [{ id: 'item_1', name: 'Herbal Oil', quantity: 2, unit_price: 2500, total: 5000 }],
        created_at: nowIso,
      },
      {
        id: 'ord_2',
        business_id: mockBusiness.id,
        customer_id: 'cust_1', // repeat purchase by cust_1
        customer_name: 'Aditi Rao',
        total_amount: 3000,
        tax_amount: 150,
        discount_amount: 0,
        order_status: 'delivered',
        payment_status: 'paid',
        payment_method: 'card',
        order_date: nowIso,
        notes: '',
        items: [{ id: 'item_2', name: 'Herbal Oil', quantity: 1, unit_price: 3000, total: 3000 }],
        created_at: nowIso,
      },
      {
        id: 'ord_3_unpaid',
        business_id: mockBusiness.id,
        customer_id: 'cust_2',
        customer_name: 'Vikram Singh',
        total_amount: 4000,
        tax_amount: 200,
        discount_amount: 0,
        order_status: 'processing',
        payment_status: 'pending', // UNPAID order must NOT inflate revenue
        payment_method: 'cod',
        order_date: nowIso,
        notes: '',
        items: [],
        created_at: nowIso,
      },
    ];

    const bookings: Booking[] = [
      {
        id: 'bk_1',
        business_id: mockBusiness.id,
        customer_id: 'cust_2',
        customer_name: 'Vikram Singh',
        customer_phone: '+91 98765 55555',
        service_id: 'srv_1',
        service_name: 'Ayurvedic Massage',
        booking_date: nowIso.split('T')[0],
        time_slot: '14:00',
        status: 'confirmed',
        amount: 2000,
        payment_status: 'paid',
        notes: '',
        created_at: nowIso,
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'exp_1',
        business_id: mockBusiness.id,
        category: 'rent',
        amount: 2500,
        expense_date: nowIso.split('T')[0],
        description: 'Facility lease',
        payment_method: 'bank_transfer',
        is_recurring: true,
        created_at: nowIso,
      },
      {
        id: 'exp_2',
        business_id: mockBusiness.id,
        category: 'inventory',
        amount: 1500,
        expense_date: nowIso.split('T')[0],
        description: 'Herbal herbs',
        payment_method: 'upi',
        is_recurring: false,
        created_at: nowIso,
      },
    ];

    const customers: Customer[] = [
      {
        id: 'cust_1',
        business_id: mockBusiness.id,
        name: 'Aditi Rao',
        email: 'aditi@example.com',
        phone: '+91 98765 44444',
        city: 'Bengaluru',
        source: 'referral',
        first_seen: nowIso,
        last_activity: nowIso,
        total_orders: 2,
        total_spend: 8000,
        status: 'repeat',
        notes: '',
        tags: ['vip'],
        created_at: nowIso,
      },
      {
        id: 'cust_2',
        business_id: mockBusiness.id,
        name: 'Vikram Singh',
        email: 'vikram@example.com',
        phone: '+91 98765 55555',
        city: 'Bengaluru',
        source: 'walk_in',
        first_seen: nowIso,
        last_activity: nowIso,
        total_orders: 1,
        total_spend: 2000,
        status: 'active',
        notes: '',
        tags: [],
        created_at: nowIso,
      },
    ];

    const leads: Lead[] = [
      {
        id: 'lead_1',
        business_id: mockBusiness.id,
        name: 'Kavita Roy',
        email: 'kavita@example.com',
        phone: '+91 98765 66666',
        source: 'whatsapp',
        status: 'converted',
        score: 90,
        budget: 5000,
        interest_product_or_service: 'Full Therapy',
        last_follow_up: nowIso,
        next_follow_up: null,
        notes: 'Interested in annual wellness package',
        converted_to_customer_id: 'cust_3',
        created_at: nowIso,
      },
      {
        id: 'lead_2',
        business_id: mockBusiness.id,
        name: 'Sameer Sen',
        email: 'sameer@example.com',
        phone: '+91 98765 77777',
        source: 'instagram',
        status: 'new',
        score: 85,
        budget: 3000,
        interest_product_or_service: 'Herbal Kit',
        last_follow_up: nowIso,
        next_follow_up: null,
        notes: 'Inquired about delivery',
        converted_to_customer_id: null,
        created_at: nowIso,
      },
    ];

    const products: Product[] = [
      {
        id: 'p1',
        business_id: mockBusiness.id,
        name: 'Herbal Oil 500ml',
        sku: 'OIL-500',
        price: 2500,
        cost: 1000,
        margin_pct: 60,
        stock_quantity: 40,
        status: 'active',
        category: 'Oils',
        total_sold: 12,
        created_at: nowIso,
      },
    ];

    const metrics = calculateBusinessMetrics(
      mockBusiness,
      orders,
      expenses,
      customers,
      leads,
      bookings,
      products
    );

    // Total Revenue = 5000 + 3000 (paid orders) + 2000 (paid booking) = 10000
    expect(metrics.totalRevenue).toBe(10000);
    expect(metrics.hasSufficientRevenueData).toBe(true);

    // Total Expenses = 2500 + 1500 = 4000
    expect(metrics.totalExpenses).toBe(4000);
    expect(metrics.hasSufficientExpenseData).toBe(true);

    // Net Profit = 10000 - 4000 = 6000
    expect(metrics.netProfit).toBe(6000);
    // Net Margin = (6000 / 10000) * 100 = 60%
    expect(metrics.profitMargin).toBe(60);

    // Repeat customers: cust_1 has 2 orders -> 1 of 2 = 50%
    expect(metrics.repeatCustomers).toBe(1);
    expect(metrics.repeatCustomerRate).toBe(50);
    expect(metrics.hasSufficientRepeatData).toBe(true);

    // AOV = 10000 / 3 paid transactions = 3333
    expect(metrics.avgOrderValue).toBe(3333);
    expect(metrics.hasSufficientAovData).toBe(true);

    // Leads = 2, Converted = 1 -> 50% conversion
    expect(metrics.totalLeads).toBe(2);
    expect(metrics.convertedLeads).toBe(1);
    expect(metrics.leadConversionRate).toBe(50);

    // Gross Margin from products table (60%)
    expect(metrics.grossMargin).toBe(60);
    expect(metrics.hasSufficientMarginData).toBe(true);

    // Health Score computed and valid
    expect(metrics.hasSufficientHealthData).toBe(true);
    expect(metrics.healthScore).toBeGreaterThan(60);
    expect(metrics.healthBand).toBeDefined();

    // Trace evidence verified
    expect(metrics.metricsEvidence.totalRevenue.state).toBe('calculated');
    expect(metrics.metricsEvidence.netProfit.state).toBe('calculated');
    expect(metrics.metricsEvidence.expenses.state).toBe('observed');
    expect(metrics.metricsEvidence.grossMargin.state).toBe('calculated');
  });

  it('4. DATE & TIMEZONE SAFETY: Correctly partitions today, current month, and run rates', () => {
    const tz = 'Asia/Kolkata';
    const nowParts = getDatePartsInTimezone(new Date(), tz);
    expect(nowParts.year).toBeGreaterThanOrEqual(2025);
    expect(nowParts.month).toBeGreaterThanOrEqual(1);
    expect(nowParts.month).toBeLessThanOrEqual(12);

    expect(isTodayInTimezone(new Date(), tz)).toBe(true);
    expect(isCurrentMonthInTimezone(new Date(), tz)).toBe(true);

    // Past date (e.g. 60 days ago) should not be current month
    const pastDate = new Date(Date.now() - 60 * 86400000);
    expect(isCurrentMonthInTimezone(pastDate, tz)).toBe(false);

    const { elapsed, total } = getDaysElapsedInCurrentMonth(tz);
    expect(elapsed).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThanOrEqual(28);
    expect(total).toBeLessThanOrEqual(31);
  });

  it('5. AI DIAGNOSIS METRIC & SOURCE GROUNDING: Guarantees affected_metric, source_data, and requires_human_approval', () => {
    const products: Product[] = [
      {
        id: 'p_stockout',
        business_id: mockBusiness.id,
        name: 'Ayurvedic Massage Balm',
        sku: 'BLM-01',
        stock_quantity: 0,
        status: 'out_of_stock',
        price: 1200,
        cost: 400,
        margin_pct: 66,
        category: 'Balms',
        total_sold: 50,
        created_at: nowIso,
      },
    ];

    const leads: Lead[] = [
      {
        id: 'lead_hot',
        business_id: mockBusiness.id,
        name: 'Siddharth Roy',
        email: 'siddharth@example.com',
        phone: '+91 99887 76655',
        source: 'whatsapp',
        status: 'new',
        score: 95,
        budget: 8000,
        interest_product_or_service: 'Full Wellness Retainer',
        last_follow_up: nowIso,
        next_follow_up: null,
        notes: 'Ready to book',
        converted_to_customer_id: null,
        created_at: nowIso,
      },
    ];

    const metrics = calculateBusinessMetrics(mockBusiness, [], [], [], leads, [], products);
    const diagnoses = generateDeterministicDiagnoses(
      mockBusiness,
      metrics,
      [],
      [],
      [],
      leads,
      products,
      []
    );

    expect(diagnoses.length).toBeGreaterThan(0);

    diagnoses.forEach((diag) => {
      // Every diagnosis must have an affected_metric and source_data trace
      expect(diag.affected_metric).toBeDefined();
      expect(diag.affected_metric?.length).toBeGreaterThan(3);
      expect(diag.source_data).toBeDefined();
      expect(diag.source_data?.length).toBeGreaterThan(3);
      expect(typeof diag.requires_human_approval).toBe('boolean');
    });

    // Stockout finding must reference products table
    const stockoutDiag = diagnoses.find((d) => d.id.includes('stockout'));
    expect(stockoutDiag).toBeDefined();
    expect(stockoutDiag?.source_data).toContain('products');
    expect(stockoutDiag?.affected_metric).toContain('Catalog Availability');

    // Hot lead finding must reference leads table
    const hotLeadDiag = diagnoses.find((d) => d.id.includes('hot_leads'));
    expect(hotLeadDiag).toBeDefined();
    expect(hotLeadDiag?.source_data).toContain('leads');
    expect(hotLeadDiag?.affected_metric).toContain('Lead Conversion');
  });
});
