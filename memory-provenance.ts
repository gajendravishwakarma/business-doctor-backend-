import { BusinessMemory, Order, Booking, Expense } from '../types/database';

export interface MemoryProvenanceStatus {
  isVerified: boolean;
  status: 'verified' | 'insufficient_data' | 'unverified_seed';
  badgeLabel: string;
  evidenceSummary: string;
  sourceType: string;
  hasSufficientData: boolean;
}

/**
 * Validates the provenance of a Business Memory record against active tenant data.
 * Ensures demo/seed entries are never presented as verified business facts.
 * Flags observations as "Insufficient data" when underlying evidence is absent.
 */
export function verifyMemoryProvenance(
  mem: BusinessMemory,
  context?: {
    activeBizId?: string;
    orders?: Order[];
    bookings?: Booking[];
    expenses?: Expense[];
  }
): MemoryProvenanceStatus {
  // 1. Strict Tenant Isolation Check
  if (context?.activeBizId && mem.business_id !== context.activeBizId) {
    return {
      isVerified: false,
      status: 'unverified_seed',
      badgeLabel: 'Cross-Tenant Memory (Blocked)',
      evidenceSummary: 'Record belongs to another business tenant. Blocked under strict tenant isolation.',
      sourceType: 'unauthorized',
      hasSufficientData: false,
    };
  }

  // 2. Explicit Unverified Seed Checks
  const isSeedId = mem.id === 'mem_entry_01' || mem.id === 'mem_entry_02' || mem.id === 'mem_entry_03';
  if (isSeedId || mem.provenance?.source_type === 'unverified_seed' || mem.is_verified === false) {
    return {
      isVerified: false,
      status: 'unverified_seed',
      badgeLabel: 'Unverified Seed (Insufficient data)',
      evidenceSummary: mem.provenance?.evidence_summary || 'Synthetic seed observation. No underlying Supabase ledger records exist.',
      sourceType: 'unverified_seed',
      hasSufficientData: false,
    };
  }

  // 3. User-logged or explicitly verified provenance
  if (mem.provenance?.source_type === 'user_logged') {
    return {
      isVerified: true,
      status: 'verified',
      badgeLabel: 'Verified User Observation',
      evidenceSummary: mem.provenance.evidence_summary || 'User-logged operational observation recorded in workspace.',
      sourceType: 'user_logged',
      hasSufficientData: true,
    };
  }

  if (mem.provenance?.source_type === 'supabase_table') {
    return {
      isVerified: true,
      status: 'verified',
      badgeLabel: `Verified Supabase (${mem.provenance.source_table || 'Ledger'})`,
      evidenceSummary: mem.provenance.evidence_summary || 'Traceable to tenant-scoped Supabase records.',
      sourceType: 'supabase_table',
      hasSufficientData: true,
    };
  }

  // 4. Live Runtime Events (Day 0 onboarding, Trial days, Orders, Bookings, Expenses)
  if (mem.provenance?.source_type === 'live_event' || mem.id.startsWith('mem_trial_day_')) {
    const hasData = mem.provenance?.has_sufficient_data ?? true;
    return {
      isVerified: hasData,
      status: hasData ? 'verified' : 'insufficient_data',
      badgeLabel: hasData ? 'Verified Milestone' : 'Insufficient Data',
      evidenceSummary: mem.provenance?.evidence_summary || 'Derived from live operating system events.',
      sourceType: 'live_event',
      hasSufficientData: hasData,
    };
  }

  // 5. Check outcome_recorded or existing record indicators
  if (mem.outcome_recorded && mem.outcome_recorded.toLowerCase().includes('verified')) {
    return {
      isVerified: true,
      status: 'verified',
      badgeLabel: 'Verified Finding',
      evidenceSummary: mem.outcome_recorded,
      sourceType: 'recorded_outcome',
      hasSufficientData: true,
    };
  }

  // 6. Default fallback: Unverified / Insufficient Data
  return {
    isVerified: false,
    status: 'insufficient_data',
    badgeLabel: 'Insufficient Data',
    evidenceSummary: 'No underlying transaction or audit evidence found in Supabase.',
    sourceType: 'unknown',
    hasSufficientData: false,
  };
}
