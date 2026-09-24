import React, { useState, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Brain,
  Plus,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Database,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { BusinessMemory } from '../../types/database';
import { verifyMemoryProvenance } from '../../lib/memory-provenance';

export const BusinessMemoryView: React.FC = () => {
  const { business, memory, orders, bookings, expenses, customers, addMemoryEntry } = useBusinessStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [observationType, setObservationType] = useState<BusinessMemory['observation_type']>('margin');
  const [period, setPeriod] = useState('monthly');
  const [content, setContent] = useState('');
  const [confidence, setConfidence] = useState(90);
  const [outcome, setOutcome] = useState('');

  // Provenance metrics
  const { verifiedCount, unverifiedCount, provenanceMap } = useMemo(() => {
    let verified = 0;
    let unverified = 0;
    const map = new Map<string, ReturnType<typeof verifyMemoryProvenance>>();

    memory.forEach((mem) => {
      const status = verifyMemoryProvenance(mem, {
        activeBizId: business.id,
        orders,
        bookings,
        expenses,
      });
      map.set(mem.id, status);
      if (status.isVerified) verified++;
      else unverified++;
    });

    return { verifiedCount: verified, unverifiedCount: unverified, provenanceMap: map };
  }, [memory, business.id, orders, bookings, expenses]);

  const hasCustomerRecordsWithoutTransactions =
    customers.length > 0 && orders.length === 0 && bookings.length === 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    addMemoryEntry({
      observation_type: observationType,
      period,
      title: title.trim(),
      content: content.trim(),
      confidence_score: Number(confidence) || 90,
      outcome_recorded: outcome.trim() || 'Logged to persistent memory ledger by user.',
      is_verified: true,
      provenance: {
        source_type: 'user_logged',
        source_table: 'business_memory',
        evidence_summary: 'User-logged operational observation recorded in workspace.',
        has_sufficient_data: true,
      },
    });

    setIsAddModalOpen(false);
    setTitle('');
    setContent('');
    setOutcome('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            Persistent Business Memory Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Evidence-first intelligence store tracking verified baselines, transactions, and auditable learning outcomes
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Log Memory Observation</span>
        </button>
      </div>

      {/* Provenance Audit Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Total Memory Records</div>
            <div className="text-xl font-bold text-slate-100 mt-0.5">{memory.length}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
            <Database className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-emerald-400/90 font-medium uppercase tracking-wider">Valid Provenance (Verified)</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{verifiedCount}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-amber-400/90 font-medium uppercase tracking-wider">Insufficient Data / Unverified</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{unverifiedCount}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Warning Banner for Imported Customers without Orders */}
      {hasCustomerRecordsWithoutTransactions && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3.5 text-xs text-amber-200 flex items-start gap-3">
          <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <div className="font-semibold text-amber-300">
              Customer Ledger Preserved ({customers.length} imported records) — Insufficient Transaction History
            </div>
            <p className="text-amber-200/90 text-[11px]">
              Customer profiles are intact, but no historical sales orders or booking appointments exist yet in Supabase.
              Historical trends, booking velocity, and retention metrics are marked as &quot;Insufficient data&quot; rather than fabricating business facts.
            </p>
          </div>
        </div>
      )}

      {/* Memory Timeline List */}
      <div className="space-y-4">
        {memory.length === 0 ? (
          <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 space-y-2">
            <Brain className="w-10 h-10 text-indigo-400 mx-auto opacity-50 mb-2" />
            <div className="font-bold text-slate-200 text-sm">No Memory Ledger Entries Yet</div>
            <p className="max-w-md mx-auto text-slate-400">
              When you onboard a business, import verified datasets, or complete operational milestones, permanent observations with verified provenance are recorded here.
            </p>
          </div>
        ) : (
          memory.map((mem) => {
            const provenance = provenanceMap.get(mem.id) || verifyMemoryProvenance(mem, {
              activeBizId: business.id,
              orders,
              bookings,
              expenses,
            });

            return (
              <div
                key={mem.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold uppercase">
                      {mem.observation_type}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Period: {mem.period}</span>

                    {/* Provenance Badge */}
                    {provenance.isVerified ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        {provenance.badgeLabel}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        {provenance.badgeLabel}
                      </span>
                    )}

                    {/* Confidence Score */}
                    {provenance.isVerified ? (
                      <span className="text-xs text-emerald-400 font-bold font-mono">
                        {mem.confidence_score}% Confidence (Verified)
                      </span>
                    ) : (
                      <span className="text-xs text-amber-400/80 font-mono">
                        Unverified ({mem.confidence_score}% theoretical)
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(mem.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-slate-100">{mem.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  {mem.content}
                </p>

                {/* Evidence or Insufficient Data State */}
                {!provenance.isVerified && (
                  <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-900/50 p-2.5 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-semibold text-amber-300">Insufficient data:</span>{' '}
                      <span className="text-amber-200/90">{provenance.evidenceSummary}</span>
                    </div>
                  </div>
                )}

                {provenance.isVerified && (mem.outcome_recorded || provenance.evidenceSummary) && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Provenance: {mem.outcome_recorded || provenance.evidenceSummary}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base">Log Memory Observation</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Verified Formulation Shift Observation"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={observationType}
                    onChange={(e) => setObservationType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="baseline">Day 0 / Baseline</option>
                    <option value="margin">Margin & Pricing</option>
                    <option value="conversion">Conversion Funnel</option>
                    <option value="retention">Retention & Cohort</option>
                    <option value="seasonal">Seasonal Shift</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Confidence Score (0-100)</label>
                  <input
                    type="number"
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Observation Content *</label>
                <textarea
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Detailed quantitative observation backed by real customer or ledger events..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Outcome / Source Evidence</label>
                <input
                  type="text"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="e.g. Backed by verified customer consultation ledger"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
                >
                  Record to Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
