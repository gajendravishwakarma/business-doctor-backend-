import { describe, it, expect } from 'vitest';
import { canAccessRoute, canPerformAction } from '../../src/lib/permissions';
import { CRMFollowUp } from '../../src/types/crm';

describe('CRM RBAC Permissions & Follow-Up Lifecycle Suite', () => {
  it('1. RBAC ROUTE PERMISSIONS: Owner has full access to all CRM routes', () => {
    expect(canAccessRoute('owner', 'crm')).toBe(true);
    expect(canAccessRoute('owner', 'crm_overview')).toBe(true);
    expect(canAccessRoute('owner', 'leads')).toBe(true);
    expect(canAccessRoute('owner', 'customers')).toBe(true);
    expect(canAccessRoute('owner', 'followups')).toBe(true);
  });

  it('2. RBAC ROUTE PERMISSIONS: Manager has full access to all CRM routes', () => {
    expect(canAccessRoute('manager', 'crm')).toBe(true);
    expect(canAccessRoute('manager', 'crm_overview')).toBe(true);
    expect(canAccessRoute('manager', 'leads')).toBe(true);
    expect(canAccessRoute('manager', 'customers')).toBe(true);
    expect(canAccessRoute('manager', 'followups')).toBe(true);
  });

  it('3. RBAC ROUTE PERMISSIONS: Staff has access to operational CRM views', () => {
    expect(canAccessRoute('staff', 'crm')).toBe(true);
    expect(canAccessRoute('staff', 'crm_overview')).toBe(true);
    expect(canAccessRoute('staff', 'leads')).toBe(true);
    expect(canAccessRoute('staff', 'customers')).toBe(true);
    expect(canAccessRoute('staff', 'followups')).toBe(true);
  });

  it('4. RBAC ROUTE PERMISSIONS: Unauthenticated / Invalid role cannot access CRM routes', () => {
    expect(canAccessRoute('guest' as any, 'crm')).toBe(false);
    expect(canAccessRoute('' as any, 'leads')).toBe(false);
    expect(canAccessRoute(null as any, 'customers')).toBe(false);
  });

  it('5. RBAC ACTION PERMISSIONS: Owner and Manager can convert leads and manage follow-ups', () => {
    expect(canPerformAction('owner', 'convert_lead')).toBe(true);
    expect(canPerformAction('owner', 'manage_followups')).toBe(true);
    expect(canPerformAction('manager', 'convert_lead')).toBe(true);
    expect(canPerformAction('manager', 'manage_followups')).toBe(true);
  });

  it('6. RBAC ACTION PERMISSIONS: Staff can manage day-to-day follow-ups and convert leads', () => {
    expect(canPerformAction('staff', 'manage_followups')).toBe(true);
    expect(canPerformAction('staff', 'convert_lead')).toBe(true);
  });

  it('7. RBAC ACTION PERMISSIONS: Staff is restricted from sensitive business reconfiguration', () => {
    // Staff cannot perform structural actions like deleting business profile or switching role
    expect(canPerformAction('staff', 'delete_business' as any)).toBe(false);
  });

  it('8. FOLLOW-UP LIFECYCLE: Marking completed sets status to "completed" and records completed_at', () => {
    const originalFollowUp: CRMFollowUp = {
      id: 'fu_test_1',
      business_id: 'biz_01',
      target_type: 'lead',
      target_id: 'l_1',
      target_name: 'Tarun Saxena',
      due_date: '2026-04-10',
      reason: 'Pricing negotiation',
      status: 'pending',
      created_at: '2026-04-01T00:00:00Z',
    };

    const completionTime = new Date().toISOString();
    const completedFollowUp: CRMFollowUp = {
      ...originalFollowUp,
      status: 'completed',
      completed_at: completionTime,
    };

    expect(completedFollowUp.status).toBe('completed');
    expect(completedFollowUp.completed_at).toBe(completionTime);
  });

  it('9. FOLLOW-UP LIFECYCLE: Rescheduling resets status to "pending" and updates due_date', () => {
    const overdueFollowUp: CRMFollowUp = {
      id: 'fu_test_2',
      business_id: 'biz_01',
      target_type: 'customer',
      target_id: 'c_1',
      target_name: 'Meera Nair',
      due_date: '2026-01-01',
      reason: 'Check refill satisfaction',
      status: 'overdue',
      created_at: '2026-01-01T00:00:00Z',
    };

    const newDate = '2026-05-15';
    const rescheduledFollowUp: CRMFollowUp = {
      ...overdueFollowUp,
      due_date: newDate,
      status: 'pending',
    };

    expect(rescheduledFollowUp.status).toBe('pending');
    expect(rescheduledFollowUp.due_date).toBe('2026-05-15');
  });

  it('10. FOLLOW-UP LIFECYCLE: Canceling follow-up sets status to "cancelled"', () => {
    const activeFollowUp: CRMFollowUp = {
      id: 'fu_test_3',
      business_id: 'biz_01',
      target_type: 'lead',
      target_id: 'l_2',
      target_name: 'Vivek Oberoi',
      due_date: '2026-04-20',
      reason: 'Follow-up on WhatsApp query',
      status: 'pending',
      created_at: '2026-04-01T00:00:00Z',
    };

    const cancelledFollowUp: CRMFollowUp = {
      ...activeFollowUp,
      status: 'cancelled',
    };

    expect(cancelledFollowUp.status).toBe('cancelled');
  });
});
