import crypto from 'node:crypto';
import { WhatsAppAuditAction, WhatsAppAuditRecord } from '../../src/types/whatsapp-onboarding';
import { getServerSupabaseClient } from '../auth';

// In-memory tenant audit event store
export const inMemoryWhatsAppAuditLogs: WhatsAppAuditRecord[] = [];

/**
 * Records an immutable audit log entry for WhatsApp operations.
 * Enforces business_id isolation and audit action categorization.
 */
export function recordWhatsAppAudit(
  entry: Omit<WhatsAppAuditRecord, 'id' | 'created_at'>
): WhatsAppAuditRecord {
  const now = new Date().toISOString();
  const auditRecord: WhatsAppAuditRecord = {
    id: `aud_wa_${crypto.randomUUID()}`,
    business_id: entry.business_id,
    action: entry.action,
    details: entry.details,
    entity_type: entry.entity_type,
    metadata: entry.metadata || {},
    created_at: now,
  };

  inMemoryWhatsAppAuditLogs.push(auditRecord);

  // Asynchronously attempt to mirror to Supabase audit_logs table
  const supabase = getServerSupabaseClient();
  if (supabase) {
    try {
      supabase
        .from('audit_logs')
        .insert({
          id: auditRecord.id,
          business_id: entry.business_id,
          action: `WHATSAPP_${entry.action.toUpperCase()}`,
          details: entry.details,
          entity_type: entry.entity_type,
          user_id: entry.metadata?.userId || entry.metadata?.approved_by || 'system_whatsapp',
          ip_address: entry.metadata?.ipAddress || '127.0.0.1',
          created_at: now,
        })
        .then(
          () => {},
          () => {} // Non-blocking mirror
        );
    } catch {
      // Ignore background sync errors in dev/test
    }
  }

  return auditRecord;
}

/**
 * Returns audit history strictly filtered for the authenticated business_id.
 */
export function getWhatsAppAuditLogs(businessId: string): WhatsAppAuditRecord[] {
  if (!businessId) return [];
  return inMemoryWhatsAppAuditLogs
    .filter((log) => log.business_id === businessId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Test helper to reset audit store
 */
export function resetWhatsAppAuditTestState(): void {
  inMemoryWhatsAppAuditLogs.length = 0;
}
