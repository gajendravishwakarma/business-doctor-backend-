import { describe, it, expect } from 'vitest';
import { mapBusinessToDb } from '../../src/lib/supabaseAdapter';
import { calculateBusinessMetrics } from '../../src/lib/diagnosis-engine';
import {
  generateDay1Content,
  generateDay2Content,
  generateDay3Content,
  generateDay4Content,
  generateDay5Content,
  generateAllTrialDays,
} from '../../src/lib/trial-engine';
import { Business, Product, Order, Expense, Customer, Lead, Booking } from '../../src/types/database';

describe('PRODUCT WORKFLOW: Business Onboarding & 4 Data-Maturity Modes', () => {
  const baseBiz: Business = {
    id: 'b1111111-1111-4111-8111-111111111111',
    name: 'Apollo Wellness Clinic',
    business_type: 'service',
    industry: 'Healthcare & Wellness',
    location: 'Indiranagar, Bangalore',
    country: 'India',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    target_customers: 'Indiranagar urban families',
    business_goals: ['revenue_growth'],
    monthly_revenue_target: 600000,
    data_maturity_mode: 'existing_complete',
    business_age_stage: 'established',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('Mode 1: Existing Business + Complete Historical Data assigns appropriate operational age', () => {
    const biz: Business = {
      ...baseBiz,
      data_maturity_mode: 'existing_complete',
      business_age_stage: 'established',
    };
    const dbRow = mapBusinessToDb(biz);
    expect(dbRow.data_maturity).toBe('existing_complete');
    expect(dbRow.onboarding_mode).toBe('established');
    expect(dbRow.business_age_months).toBe(48);
  });

  it('Mode 2: Existing Business + Partial Historical Data sets partial mode and calculated age', () => {
    const biz: Business = {
      ...baseBiz,
      data_maturity_mode: 'existing_partial',
      business_age_stage: 'early',
    };
    const dbRow = mapBusinessToDb(biz);
    expect(dbRow.data_maturity).toBe('existing_partial');
    expect(dbRow.onboarding_mode).toBe('early');
    expect(dbRow.business_age_months).toBe(6);
  });

  it('Mode 3: New Business + No Historical Data initializes Day 0 baseline', () => {
    const biz: Business = {
      ...baseBiz,
      data_maturity_mode: 'new_no_data',
      business_age_stage: 'early',
    };
    const dbRow = mapBusinessToDb(biz);
    expect(dbRow.data_maturity).toBe('new_no_data');
    expect(dbRow.business_age_months).toBe(0);
  });

  it('Mode 4: Existing Business + No Historical Data initializes Start-From-Today baseline with true operational age', () => {
    const biz: Business = {
      ...baseBiz,
      data_maturity_mode: 'existing_no_data',
      business_age_stage: 'growing',
    };
    const dbRow = mapBusinessToDb(biz);
    expect(dbRow.data_maturity).toBe('existing_no_data');
    expect(dbRow.onboarding_mode).toBe('growing');
    expect(dbRow.business_age_months).toBe(24);
  });
});

describe('PRODUCT WORKFLOW: 5-Day Business Transformation Trial', () => {
  const business: Business = {
    id: 'b2222222-2222-4222-8222-222222222222',
    name: 'Kavita Organics',
    business_type: 'product',
    industry: 'Ayurvedic Beauty & Wellness',
    location: 'Koramangala, Bangalore',
    country: 'India',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    target_customers: 'Health conscious urban women',
    business_goals: ['revenue_growth'],
    monthly_revenue_target: 500000,
    data_maturity_mode: 'existing_complete',
    business_age_stage: 'growing',
    business_age_months: 18,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const products: Product[] = [
    {
      id: 'prod-1',
      business_id: business.id,
      name: 'Kumkumadi Radiance Elixir',
      sku: 'KUM-001',
      category: 'Facial Serums',
      price: 2499,
      cost: 750,
      margin_pct: 70,
      stock_quantity: 45,
      status: 'active',
      total_sold: 10,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-2',
      business_id: business.id,
      name: 'Brahmi Scalp Therapy Oil',
      sku: 'BRH-002',
      category: 'Haircare',
      price: 1299,
      cost: 400,
      margin_pct: 69,
      stock_quantity: 0,
      status: 'out_of_stock',
      total_sold: 5,
      created_at: new Date().toISOString(),
    },
  ];

  const customers: Customer[] = [
    {
      id: 'cust-1',
      business_id: business.id,
      name: 'Ananya Sharma',
      email: 'ananya@example.com',
      phone: '+919876543210',
      city: 'Bangalore',
      source: 'whatsapp',
      status: 'active',
      first_seen: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      total_spend: 7497,
      total_orders: 3,
      notes: '',
      tags: ['vip', 'repeat'],
      created_at: new Date().toISOString(),
    },
    {
      id: 'cust-2',
      business_id: business.id,
      name: 'Rohit Verma',
      email: 'rohit@example.com',
      phone: '+919876543211',
      city: 'Bangalore',
      source: 'instagram',
      status: 'active',
      first_seen: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      total_spend: 2499,
      total_orders: 1,
      notes: '',
      tags: ['new'],
      created_at: new Date().toISOString(),
    },
  ];

  const orders: Order[] = [
    {
      id: 'ord-1',
      business_id: business.id,
      customer_id: 'cust-1',
      customer_name: 'Ananya Sharma',
      items: [],
      total_amount: 4998,
      tax_amount: 0,
      discount_amount: 0,
      payment_status: 'paid',
      payment_method: 'upi',
      order_status: 'delivered',
      order_date: new Date().toISOString(),
      notes: '',
      created_at: new Date().toISOString(),
    },
    {
      id: 'ord-2',
      business_id: business.id,
      customer_id: 'cust-2',
      customer_name: 'Rohit Verma',
      items: [],
      total_amount: 2499,
      tax_amount: 0,
      discount_amount: 0,
      payment_status: 'paid',
      payment_method: 'upi',
      order_status: 'delivered',
      order_date: new Date().toISOString(),
      notes: '',
      created_at: new Date().toISOString(),
    },
  ];

  const expenses: Expense[] = [
    {
      id: 'exp-1',
      business_id: business.id,
      category: 'rent',
      description: 'Store Rental',
      amount: 45000,
      payment_method: 'bank_transfer',
      expense_date: new Date().toISOString(),
      is_recurring: true,
      created_at: new Date().toISOString(),
    },
  ];

  const context = {
    products,
    services: [],
    customers,
    orders,
    bookings: [] as Booking[],
    expenses,
    leads: [] as Lead[],
    dataSources: [],
    memory: [],
    diagnoses: [],
    automations: [],
  };

  it('Calculates truthful database metrics with evidence for businesses with records', () => {
    const metrics = calculateBusinessMetrics(business, orders, expenses, customers, [] as Lead[], [] as Booking[], products);
    expect(metrics.hasSufficientData).toBe(true);
    expect(metrics.totalRevenue).toBe(7497);
    expect(metrics.totalOrders).toBe(2);
    expect(metrics.repeatCustomers).toBe(1);
    expect(metrics.repeatCustomerRate).toBe(50);
    expect(metrics.grossMargin).toBeGreaterThan(60);
  });

  it('Day 1: Generates Understand My Business with truthful audit facts and data completeness', () => {
    const metrics = calculateBusinessMetrics(business, orders, expenses, customers, [] as Lead[], [] as Booking[], products);
    const day1 = generateDay1Content(business, metrics, context);

    expect(day1.day).toBe(1);
    expect(day1.title).toBe('Understand My Business');
    expect(day1.deliverables.length).toBeGreaterThanOrEqual(2);
    // Verified deliverables contain real business metrics
    const auditDeliv = day1.deliverables.find((d) => d.id === 'deliv_1_audit');
    expect(auditDeliv).toBeDefined();
    expect(auditDeliv?.content).toContain(business.name);
    expect(auditDeliv?.content).toContain('7,497');
  });

  it('Day 2: Generates Bring Me Customers with tailored personas, reels, and WhatsApp copy', () => {
    const metrics = calculateBusinessMetrics(business, orders, expenses, customers, [] as Lead[], [] as Booking[], products);
    const day2 = generateDay2Content(business, metrics, context);

    expect(day2.day).toBe(2);
    expect(day2.title).toBe('Bring Me Customers');
    expect(day2.deliverables.length).toBeGreaterThanOrEqual(4);
    // WhatsApp copy
    const wa = day2.deliverables.find((d) => d.type.includes('WhatsApp'));
    expect(wa).toBeDefined();
    expect(wa?.content).toContain(business.name);
    // Reel script
    const reel = day2.deliverables.find((d) => d.type.includes('Reel'));
    expect(reel).toBeDefined();
    expect(reel?.content).toContain(products[0].name);
  });

  it('Day 3: Generates Automate My Customers with CRM and speed-to-lead automation rules', () => {
    const metrics = calculateBusinessMetrics(business, orders, expenses, customers, [] as Lead[], [] as Booking[], products);
    const day3 = generateDay3Content(business, metrics, context);

    expect(day3.day).toBe(3);
    expect(day3.title).toBe('Automate My Customers');
    expect(day3.deliverables.length).toBe(3);
    const speedToLead = day3.deliverables.find((d) => d.id === 'deliv_3_lead_flow');
    expect(speedToLead).toBeDefined();
    expect(speedToLead?.channel).toBe('whatsapp');
  });

  it('Day 4: Generates Show Me My Business with reconciled P&L scorecard derived from database', () => {
    const metrics = calculateBusinessMetrics(business, orders, expenses, customers, [] as Lead[], [] as Booking[], products);
    const day4 = generateDay4Content(business, metrics, context);

    expect(day4.day).toBe(4);
    expect(day4.title).toBe('Show Me My Business');
    const pnl = day4.deliverables.find((d) => d.id === 'deliv_4_pnl');
    expect(pnl).toBeDefined();
    expect(pnl?.content).toContain('REAL DATABASE P&L');
    expect(pnl?.content).toContain('7,497');
  });

  it('Day 5: Generates 30-Day Growth Plan with milestone execution matrix', () => {
    const metrics = calculateBusinessMetrics(business, orders, expenses, customers, [] as Lead[], [] as Booking[], products);
    const day5 = generateDay5Content(business, metrics, context);

    expect(day5.day).toBe(5);
    expect(day5.title).toBe('Your 30-Day Growth Plan');
    const plan = day5.deliverables.find((d) => d.id === 'deliv_5_roadmap');
    expect(plan).toBeDefined();
    expect(plan?.content).toContain('WEEK 1:');
    expect(plan?.content).toContain('WEEK 2:');
    expect(plan?.content).toContain('WEEK 3:');
    expect(plan?.content).toContain('WEEK 4:');
  });

  it('Gracefully flags Insufficient Data when a new business has zero transaction records', () => {
    const emptyContext = {
      products: [],
      services: [],
      customers: [],
      orders: [],
      bookings: [],
      expenses: [],
      leads: [],
      dataSources: [],
      memory: [],
      diagnoses: [],
      automations: [],
    };
    const emptyMetrics = calculateBusinessMetrics(business, [], [], [], [], [], []);
    expect(emptyMetrics.hasSufficientData).toBe(false);
    expect(emptyMetrics.totalRevenue).toBe(0);
    expect(emptyMetrics.missingDataReasons.length).toBeGreaterThan(0);

    const day4Empty = generateDay4Content(business, emptyMetrics, emptyContext);
    expect(day4Empty.grounded_data?.has_sufficient_data).toBe(false);
    expect(day4Empty.deliverables[0].content).toContain('Sales Orders Revenue (0 orders)');
  });

  it('generateAllTrialDays preserves completed states across recalculations', () => {
    const metrics = calculateBusinessMetrics(business, orders, expenses, customers, [] as Lead[], [] as Booking[], products);
    const initialDays = generateAllTrialDays(business, metrics, context);
    expect(initialDays.length).toBe(5);
    expect(initialDays[0].completed).toBe(false);

    // Complete Day 1
    const updatedInitial = initialDays.map((d) => (d.day === 1 ? { ...d, completed: true, status: 'completed' as const } : d));
    const regenerated = generateAllTrialDays(business, metrics, context, updatedInitial);
    expect(regenerated[0].completed).toBe(true);
    expect(regenerated[1].completed).toBe(false);
  });
});
