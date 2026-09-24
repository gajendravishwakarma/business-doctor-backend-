import { describe, it, expect, beforeEach } from 'vitest';
import { verifyMemoryProvenance } from '../../src/lib/memory-provenance';
import { BusinessMemory, Customer, Order, Booking, Expense } from '../../src/types/database';
import { SEED_MEMORY, SEED_BUSINESS, SEED_CUSTOMERS } from '../../src/lib/sample-data';

describe('SECURITY & AUDIT: Business Memory Provenance & Tenant Isolation', () => {
  const liveTenantId = 'b1111111-1111-4111-8111-111111111111';
  const otherTenantId = 'b2222222-2222-4222-8222-222222222222';

  it('RULE 1: Seed memory is NEVER presented as verified business fact', () => {
    SEED_MEMORY.forEach((mem) => {
      const status = verifyMemoryProvenance(mem, { activeBizId: mem.business_id });
      expect(status.isVerified).toBe(false);
      expect(status.status).toBe('unverified_seed');
      expect(status.badgeLabel).toContain('Unverified Seed');
      expect(status.hasSufficientData).toBe(false);
      expect(status.evidenceSummary).toMatch(/unverified|insufficient/i);
    });
  });

  it('RULE 2: Cross-tenant memory access is strictly blocked', () => {
    const crossTenantMem: BusinessMemory = {
      id: 'mem_cross_01',
      business_id: otherTenantId,
      observation_type: 'margin',
      period: 'monthly',
      title: 'Confidential Margin Data',
      content: 'Other tenant secret margin data',
      confidence_score: 95,
      outcome_recorded: 'Verified',
      created_at: new Date().toISOString(),
      is_verified: true,
      provenance: {
        source_type: 'supabase_table',
        source_table: 'orders',
        has_sufficient_data: true,
      },
    };

    const status = verifyMemoryProvenance(crossTenantMem, { activeBizId: liveTenantId });
    expect(status.isVerified).toBe(false);
    expect(status.badgeLabel).toContain('Cross-Tenant Memory (Blocked)');
    expect(status.hasSufficientData).toBe(false);
  });

  it('RULE 3: Missing provenance or evidence flags "Insufficient data"', () => {
    const memoryWithoutEvidence: BusinessMemory = {
      id: 'mem_unverified_trend_01',
      business_id: liveTenantId,
      observation_type: 'customer_behavior',
      period: '90_day',
      title: 'Unproven Surge Claim',
      content: 'Fabricated 90-day booking pattern without underlying Supabase records',
      confidence_score: 85,
      outcome_recorded: null,
      created_at: new Date().toISOString(),
    };

    const status = verifyMemoryProvenance(memoryWithoutEvidence, {
      activeBizId: liveTenantId,
      orders: [],
      bookings: [],
      expenses: [],
    });

    expect(status.isVerified).toBe(false);
    expect(status.status).toBe('insufficient_data');
    expect(status.badgeLabel).toBe('Insufficient Data');
    expect(status.hasSufficientData).toBe(false);
    expect(status.evidenceSummary).toContain('No underlying transaction or audit evidence');
  });

  it('RULE 4: Verified memory requires real source evidence and provenance', () => {
    const verifiedOrderMem: BusinessMemory = {
      id: 'mem_verified_order_01',
      business_id: liveTenantId,
      observation_type: 'margin',
      period: 'monthly',
      title: 'Sales Order Ledger Event',
      content: 'Verified ₹4,500 order transaction',
      confidence_score: 100,
      outcome_recorded: 'Logged to Supabase ledger',
      created_at: new Date().toISOString(),
      is_verified: true,
      provenance: {
        source_type: 'supabase_table',
        source_table: 'orders',
        source_record_id: 'ord_123',
        evidence_summary: 'Verified transaction of ₹4,500 traceable to Supabase orders table.',
        has_sufficient_data: true,
      },
    };

    const status = verifyMemoryProvenance(verifiedOrderMem, {
      activeBizId: liveTenantId,
      orders: [{ id: 'ord_123' } as Order],
    });

    expect(status.isVerified).toBe(true);
    expect(status.status).toBe('verified');
    expect(status.badgeLabel).toBe('Verified Supabase (orders)');
    expect(status.hasSufficientData).toBe(true);
  });

  it('RULE 5: 3 Imported customer records remain intact without creating unsupported historical trends', () => {
    // 3 imported customers
    const importedCustomers: Customer[] = [
      {
        id: 'cust_imp_01',
        business_id: liveTenantId,
        name: 'Aarav Sharma',
        email: 'aarav@example.com',
        phone: '+91 98888 11111',
        city: 'Bengaluru',
        source: 'walk_in',
        status: 'active',
        first_seen: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        total_orders: 0,
        total_spend: 0,
        notes: 'Recently imported customer record',
        tags: ['imported'],
        created_at: new Date().toISOString(),
      },
      {
        id: 'cust_imp_02',
        business_id: liveTenantId,
        name: 'Priya Iyer',
        email: 'priya@example.com',
        phone: '+91 98888 22222',
        city: 'Bengaluru',
        source: 'whatsapp',
        status: 'active',
        first_seen: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        total_orders: 0,
        total_spend: 0,
        notes: 'Recently imported customer record',
        tags: ['imported'],
        created_at: new Date().toISOString(),
      },
      {
        id: 'cust_imp_03',
        business_id: liveTenantId,
        name: 'Karan Patel',
        email: 'karan@example.com',
        phone: '+91 98888 33333',
        city: 'Mumbai',
        source: 'referral',
        status: 'active',
        first_seen: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        total_orders: 0,
        total_spend: 0,
        notes: 'Recently imported customer record',
        tags: ['imported'],
        created_at: new Date().toISOString(),
      },
    ];

    expect(importedCustomers.length).toBe(3);
    importedCustomers.forEach((c) => {
      expect(c.id).toBeDefined();
      expect(c.business_id).toBe(liveTenantId);
      expect(c.name).toBeDefined();
    });

    // An ungrounded historical trend claiming "82% repeat booking velocity spike in 2025"
    // must be marked as Insufficient Data because orders.length === 0
    const unsupportedTrendMem: BusinessMemory = {
      id: 'mem_fabricated_trend',
      business_id: liveTenantId,
      observation_type: 'customer_behavior',
      period: '1_year',
      title: 'Historical 2025 Repeat Booking Surge',
      content: '82% of clients rebooked within 14 days in 2025',
      confidence_score: 95,
      outcome_recorded: null,
      created_at: '2025-06-01T00:00:00.000Z',
    };

    const trendCheck = verifyMemoryProvenance(unsupportedTrendMem, {
      activeBizId: liveTenantId,
      orders: [],
      bookings: [],
    });

    expect(trendCheck.isVerified).toBe(false);
    expect(trendCheck.status).toBe('insufficient_data');
    expect(trendCheck.badgeLabel).toBe('Insufficient Data');
    expect(trendCheck.hasSufficientData).toBe(false);
  });
});
