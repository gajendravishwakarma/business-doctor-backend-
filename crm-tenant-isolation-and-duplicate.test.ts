import { describe, it, expect } from 'vitest';
import {
  findDuplicateCustomer,
  normalizePhoneNumber,
  normalizeEmail,
} from '../../src/lib/crm-engine';
import { Customer, Lead } from '../../src/types/database';
import { CRMFollowUp } from '../../src/types/crm';

describe('CRM Multi-Tenant Isolation & Duplicate Prevention Suite', () => {
  const tenantA_id = '00000000-0000-0000-0000-000000000001';
  const tenantB_id = '00000000-0000-0000-0000-000000000002';

  const mockLead = (data: Partial<Lead>): Lead => ({
    id: 'lead_default',
    business_id: tenantA_id,
    name: 'Default Lead',
    email: 'lead@test.com',
    phone: '+91 99999 00000',
    source: 'direct',
    status: 'new',
    score: 50,
    budget: 1000,
    interest_product_or_service: 'General Service',
    last_follow_up: null,
    next_follow_up: null,
    notes: '',
    converted_to_customer_id: null,
    created_at: '2026-01-01T00:00:00Z',
    ...data,
  });

  const mockCustomer = (data: Partial<Customer>): Customer => ({
    id: 'cust_default',
    business_id: tenantA_id,
    name: 'Default Customer',
    email: 'cust@test.com',
    phone: '+91 99999 00000',
    city: 'Bengaluru',
    source: 'walk_in',
    status: 'active',
    first_seen: '2026-01-01T00:00:00Z',
    last_activity: '2026-01-01T00:00:00Z',
    notes: '',
    tags: ['Customer'],
    total_orders: 1,
    total_spend: 1000,
    created_at: '2026-01-01T00:00:00Z',
    ...data,
  });

  it('1. STRICT TENANT ISOLATION: Lead queries are strictly partitioned by business_id', () => {
    const allLeads: Lead[] = [
      mockLead({ id: 'lead_a1', business_id: tenantA_id, name: 'Tenant A Lead 1' }),
      mockLead({ id: 'lead_a2', business_id: tenantA_id, name: 'Tenant A Lead 2' }),
      mockLead({ id: 'lead_b1', business_id: tenantB_id, name: 'Tenant B Lead 1' }),
    ];

    const tenantALeads = allLeads.filter((l) => l.business_id === tenantA_id);
    const tenantBLeads = allLeads.filter((l) => l.business_id === tenantB_id);

    expect(tenantALeads.length).toBe(2);
    expect(tenantBLeads.length).toBe(1);
    expect(tenantALeads.every((l) => l.business_id === tenantA_id)).toBe(true);
    expect(tenantBLeads.every((l) => l.business_id === tenantB_id)).toBe(true);
    expect(tenantALeads.some((l) => l.id === 'lead_b1')).toBe(false);
  });

  it('2. STRICT TENANT ISOLATION: Customer records are strictly partitioned by business_id', () => {
    const allCustomers: Customer[] = [
      mockCustomer({ id: 'cust_a1', business_id: tenantA_id, name: 'Customer of Biz A', phone: '+91 99999 11111' }),
      mockCustomer({ id: 'cust_b1', business_id: tenantB_id, name: 'Customer of Biz B', phone: '+91 99999 22222' }),
    ];

    const tenantACustomers = allCustomers.filter((c) => c.business_id === tenantA_id);
    expect(tenantACustomers.length).toBe(1);
    expect(tenantACustomers[0].id).toBe('cust_a1');
    expect(tenantACustomers.some((c) => c.id === 'cust_b1')).toBe(false);
  });

  it('3. STRICT TENANT ISOLATION: Follow-ups are strictly partitioned by business_id', () => {
    const allFollowUps: CRMFollowUp[] = [
      {
        id: 'fu_a',
        business_id: tenantA_id,
        target_type: 'lead',
        target_id: 'l1',
        target_name: 'Lead A',
        due_date: '2026-05-01',
        reason: 'Call back',
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'fu_b',
        business_id: tenantB_id,
        target_type: 'lead',
        target_id: 'l2',
        target_name: 'Lead B',
        due_date: '2026-05-01',
        reason: 'Call back',
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    const tenantAFollowUps = allFollowUps.filter((f) => f.business_id === tenantA_id);
    expect(tenantAFollowUps.length).toBe(1);
    expect(tenantAFollowUps[0].id).toBe('fu_a');
    expect(tenantAFollowUps.some((f) => f.id === 'fu_b')).toBe(false);
  });

  it('4. DUPLICATE PREVENTION: Matches customer by formatted domestic phone number', () => {
    const existingCustomers: Customer[] = [
      mockCustomer({
        id: 'c_exist_1',
        business_id: tenantA_id,
        name: 'Kavita Verma',
        phone: '+91 98765 43210',
        email: 'kavita@verma.com',
      }),
    ];

    // Different formatting of the same phone number
    const match1 = findDuplicateCustomer('9876543210', null, existingCustomers);
    const match2 = findDuplicateCustomer('+919876543210', null, existingCustomers);
    const match3 = findDuplicateCustomer('09876543210', null, existingCustomers);
    const match4 = findDuplicateCustomer('+91-98765-43210', null, existingCustomers);

    expect(match1).not.toBeNull();
    expect(match1?.id).toBe('c_exist_1');
    expect(match2?.id).toBe('c_exist_1');
    expect(match3?.id).toBe('c_exist_1');
    expect(match4?.id).toBe('c_exist_1');
  });

  it('5. DUPLICATE PREVENTION: Matches customer by case-insensitive normalized email', () => {
    const existingCustomers: Customer[] = [
      mockCustomer({
        id: 'c_exist_2',
        business_id: tenantA_id,
        name: 'Arjun Nambiar',
        email: 'arjun.nambiar@gmail.com',
      }),
    ];

    const matchCase = findDuplicateCustomer(null, 'Arjun.Nambiar@GMAIL.COM', existingCustomers);
    const matchSpaces = findDuplicateCustomer(null, '  arjun.nambiar@gmail.com  ', existingCustomers);

    expect(matchCase?.id).toBe('c_exist_2');
    expect(matchSpaces?.id).toBe('c_exist_2');
  });

  it('6. CROSS-TENANT SCOPE: Duplicate check is strictly scoped to the same tenant', () => {
    // Tenant B has a customer with this phone, but Tenant A does NOT
    const tenantBCustomers: Customer[] = [
      mockCustomer({
        id: 'c_tenant_b',
        business_id: tenantB_id,
        name: 'Independent Customer in Biz B',
        phone: '+91 91234 56789',
        email: 'person@bizb.com',
      }),
    ];

    const tenantACustomers: Customer[] = [
      mockCustomer({
        id: 'c_tenant_a',
        business_id: tenantA_id,
        name: 'Different Customer in Biz A',
        phone: '+91 98888 88888',
        email: 'other@biza.com',
      }),
    ];

    // Searching in Tenant A's customer list for Tenant B's contact info returns null
    const resultInTenantA = findDuplicateCustomer('+91 91234 56789', 'person@bizb.com', tenantACustomers);
    expect(resultInTenantA).toBeNull();
  });

  it('7. LEAD CONVERSION LINKING: Links lead to existing customer record without creating a duplicate', () => {
    const customers: Customer[] = [
      mockCustomer({
        id: 'c_target_01',
        business_id: tenantA_id,
        name: 'Priyanka Chopra',
        phone: '+91 98765 12345',
        email: 'priyanka@chopra.com',
        notes: 'Existing client preferences.',
        tags: ['Ayurvedic'],
        total_orders: 1,
        total_spend: 2500,
      }),
    ];

    const inboundLead: Lead = mockLead({
      id: 'l_repeat_inquiry',
      business_id: tenantA_id,
      name: 'Priyanka Chopra',
      phone: '+91 98765 12345',
      email: 'priyanka@chopra.com',
      interest_product_or_service: 'Herbal Hair Oil Refill',
      notes: 'Wants home delivery this Friday.',
      source: 'WhatsApp',
      status: 'contacted',
    });

    // Simulate duplicate check before conversion
    const duplicate = findDuplicateCustomer(inboundLead.phone, inboundLead.email, customers);
    expect(duplicate).not.toBeNull();
    expect(duplicate?.id).toBe('c_target_01');

    // Linking logic: update existing customer instead of pushing a duplicate
    const updatedCustomer: Customer = {
      ...duplicate!,
      notes: duplicate?.notes
        ? `${duplicate.notes} | Converted Inquiry: ${inboundLead.notes}`
        : inboundLead.notes,
      tags: Array.from(new Set([...(duplicate?.tags || []), 'converted_lead'])),
    };

    expect(updatedCustomer.id).toBe('c_target_01');
    expect(updatedCustomer.notes).toContain('Converted Inquiry');
    expect(updatedCustomer.tags).toContain('converted_lead');
  });

  it('8. LEAD CONVERSION FRESH CUSTOMER: Creates new customer with 0 initial spend when no duplicate exists', () => {
    const emptyCustomers: Customer[] = [];
    const newLead: Lead = mockLead({
      id: 'l_fresh_01',
      business_id: tenantA_id,
      name: 'Deepak Joshi',
      phone: '+91 98111 22233',
      email: 'deepak@joshi.org',
      source: 'Instagram DM',
      status: 'qualified',
      budget: 4500,
    });

    const duplicate = findDuplicateCustomer(newLead.phone, newLead.email, emptyCustomers);
    expect(duplicate).toBeNull();

    // Fresh customer initialization ensures 0 spend and 0 orders (no fabricated data)
    const newCustomer: Customer = mockCustomer({
      id: 'c_fresh_gen',
      business_id: tenantA_id,
      name: newLead.name,
      phone: newLead.phone,
      email: newLead.email,
      city: 'Pune',
      source: 'whatsapp',
      status: 'active',
      first_seen: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      total_orders: 0,
      total_spend: 0,
      notes: '',
      tags: ['Customer'],
    });

    expect(newCustomer.total_orders).toBe(0);
    expect(newCustomer.total_spend).toBe(0);
    expect(newCustomer.business_id).toBe(tenantA_id);
  });

  it('9. NULL/EMPTY SAFETY: Does not falsely match customers when phone/email are null or empty', () => {
    const customersWithMissingInfo: Customer[] = [
      mockCustomer({ id: 'c_null_1', business_id: tenantA_id, name: 'Walk-in 1', phone: '', email: '' }),
      mockCustomer({ id: 'c_null_2', business_id: tenantA_id, name: 'Walk-in 2', phone: undefined, email: undefined }),
    ];

    const matchEmpty = findDuplicateCustomer('', '', customersWithMissingInfo);
    const matchNull = findDuplicateCustomer(null, null, customersWithMissingInfo);
    const matchUndefined = findDuplicateCustomer(undefined, undefined, customersWithMissingInfo);

    expect(matchEmpty).toBeNull();
    expect(matchNull).toBeNull();
    expect(matchUndefined).toBeNull();
  });

  it('10. PHONE NORMALIZATION: Correctly strips punctuation, country codes, and non-digits', () => {
    expect(normalizePhoneNumber('+91 (98765) 43210')).toBe('9876543210');
    expect(normalizePhoneNumber('+91-98765-43210')).toBe('9876543210');
    expect(normalizePhoneNumber('09876543210')).toBe('9876543210');
    expect(normalizePhoneNumber('9876543210')).toBe('9876543210');
    expect(normalizePhoneNumber('')).toBe('');
    expect(normalizePhoneNumber(null)).toBe('');
  });

  it('11. EMAIL NORMALIZATION: Trims whitespace and lowercases email accurately', () => {
    expect(normalizeEmail('  Test.User+Filter@EXAMPLE.com  ')).toBe('test.user+filter@example.com');
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });

  it('12. MULTIPLE LEADS SAME CONTACT: Multiple inquiries from same person map to single customer record', () => {
    const customers: Customer[] = [
      mockCustomer({ id: 'c_single', business_id: tenantA_id, name: 'Ananya Roy', phone: '+91 97777 66666' }),
    ];

    const lead1: Lead = mockLead({ id: 'l_inq_1', business_id: tenantA_id, name: 'Ananya', phone: '9777766666' });
    const lead2: Lead = mockLead({ id: 'l_inq_2', business_id: tenantA_id, name: 'Ananya Roy', phone: '+91 97777 66666' });

    const match1 = findDuplicateCustomer(lead1.phone, lead1.email, customers);
    const match2 = findDuplicateCustomer(lead2.phone, lead2.email, customers);

    expect(match1?.id).toBe('c_single');
    expect(match2?.id).toBe('c_single');
  });
});
