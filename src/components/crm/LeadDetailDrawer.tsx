import React, { useState } from 'react';
import { Lead, Customer, Order, Booking, Business } from '../../types/database';
import {
  calculateDeterministicLeadScore,
  buildLeadTimeline,
  normalizePhoneNumber,
} from '../../lib/crm-engine';
import { useBusinessStore } from '../../lib/store';
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  Sparkles,
  TrendingUp,
  Tag,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Copy,
  Check,
  Send,
  ShieldCheck,
  Activity,
  ArrowRight,
  UserCheck,
  Clock,
  DollarSign,
  AlertTriangle,
  Flame,
  Award,
} from 'lucide-react';
import { LeadFunnelStage } from '../../types/crm';

interface LeadDetailDrawerProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (l: Lead) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  isOpen,
  onClose,
  onEdit,
}) => {
  const {
    business,
    customers,
    orders,
    bookings,
    updateLead,
    convertLeadToCustomer,
    showToast,
    addAuditLog,
    addMemoryEntry,
  } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'scoring' | 'timeline' | 'action'>('scoring');
  const [copied, setCopied] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');

  if (!isOpen) return null;

  const scoreBreakdown = calculateDeterministicLeadScore(lead, customers, orders);
  const matchedCustomer = customers.find(
    (c) =>
      c.id === lead.converted_to_customer_id ||
      (c.phone && normalizePhoneNumber(c.phone) === normalizePhoneNumber(lead.phone))
  );
  const timeline = buildLeadTimeline(lead, matchedCustomer, orders, bookings);
  const currency = business.currency_symbol || '₹';

  const handleStageChange = (newStatus: any) => {
    updateLead(lead.id, {
      status: newStatus,
      last_follow_up: new Date().toISOString(),
    });
    addAuditLog('LEAD_STATUS_CHANGED', `Lead ${lead.name} moved to stage "${newStatus}"`);
    showToast('info', 'Stage Updated', `Lead status updated to ${newStatus}.`);
  };

  const handleConvert = () => {
    convertLeadToCustomer(lead.id);
    // Add memory milestone
    addMemoryEntry({
      observation_type: 'milestone',
      period: 'monthly',
      title: `Inbound Lead Converted: ${lead.name}`,
      content: `Converted lead from source "${lead.source}" for interest "${lead.interest_product_or_service}" with estimated transaction value ${currency}${(Number(lead.budget) || 1500).toLocaleString('en-IN')}.`,
      confidence_score: 95,
      outcome_recorded: `Added to registered customer database with initial spend ${currency}${(Number(lead.budget) || 1500).toLocaleString('en-IN')}.`,
    });
    onClose();
  };

  const handleLogFollowUp = () => {
    if (!followUpNote.trim()) return;
    const updatedNotes = lead.notes ? `${lead.notes}\n• [${new Date().toLocaleDateString('en-IN')}] ${followUpNote}` : `• [${new Date().toLocaleDateString('en-IN')}] ${followUpNote}`;
    updateLead(lead.id, {
      notes: updatedNotes,
      last_follow_up: new Date().toISOString(),
    });
    setFollowUpNote('');
    addAuditLog('LEAD_FOLLOW_UP', `Logged follow-up for lead: ${lead.name}`);
    showToast('success', 'Follow-up Logged', 'Updated interaction timestamp and notes.');
  };

  const copyDraft = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('success', 'Copied message draft!');
    setTimeout(() => setCopied(false), 2500);
  };

  const openWhatsApp = (msg?: string) => {
    const cleanPhone = normalizePhoneNumber(lead.phone);
    const defaultMsg = `Namaste ${lead.name} Ji! 🙏 Greetings from ${business.name}. We received your inquiry regarding ${lead.interest_product_or_service}. We would be glad to help answer any questions or arrange a consultation slot.`;
    const finalMsg = encodeURIComponent(msg || defaultMsg);
    window.open(`https://wa.me/${cleanPhone}?text=${finalMsg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/90 flex flex-col space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-indigo-600/30">
                {lead.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-100">{lead.name}</h2>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      lead.status === 'converted' || lead.status === 'won'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : lead.status === 'qualified'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : lead.status === 'contacted'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : lead.status === 'lost'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    }`}
                  >
                    {lead.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  {lead.phone ? (
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {lead.phone}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">No phone</span>
                  )}
                  {lead.email && (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Mail className="w-3 h-3 text-slate-500" />
                      {lead.email}
                    </span>
                  )}
                  <span className="text-slate-400">Source: {lead.source}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openWhatsApp()}
                title="Direct WhatsApp"
                className="p-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Deterministic Score</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold font-mono text-amber-400">
                  {scoreBreakdown.score}/100
                </span>
                <span className="text-[10px] font-semibold text-slate-300">
                  ({scoreBreakdown.qualificationTier})
                </span>
              </div>
              <div className="text-[9px] text-slate-400 capitalize">
                {scoreBreakdown.confidence} Confidence
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Stated Budget</div>
              <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">
                {lead.budget > 0 ? `${currency}${Number(lead.budget).toLocaleString('en-IN')}` : 'Not Stated'}
              </div>
              <div className="text-[9px] text-slate-400">Expected Spend</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Inquiry Received</div>
              <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
                {new Date(lead.created_at).toLocaleDateString('en-IN')}
              </div>
              <div className="text-[9px] text-slate-400 truncate">
                {lead.interest_product_or_service || 'Consultation'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Last Follow-up</div>
              <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
                {lead.last_follow_up ? new Date(lead.last_follow_up).toLocaleDateString('en-IN') : 'None logged'}
              </div>
              <div className="text-[9px] text-indigo-400 truncate">
                {lead.next_follow_up ? `Next: ${new Date(lead.next_follow_up).toLocaleDateString('en-IN')}` : 'No follow-up set'}
              </div>
            </div>
          </div>

          {/* Funnel Stage Progression Bar */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Pipeline Stage Progression:</span>
              {lead.status !== 'converted' && lead.status !== 'won' && (
                <button
                  onClick={handleConvert}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Convert to Customer</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {(['new', 'contacted', 'qualified', 'proposal', 'won'] as any[]).map((stage) => {
                const isCurrent = lead.status === stage || (stage === 'won' && lead.status === 'converted') || (stage === 'proposal' && lead.status === 'proposal_sent');
                return (
                  <button
                    key={stage}
                    onClick={() => handleStageChange(stage === 'won' ? 'converted' : stage)}
                    className={`py-1.5 px-2 rounded-lg font-bold capitalize transition-all border ${
                      isCurrent
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {stage === 'proposal' ? 'Proposal' : stage === 'won' ? 'Won / Conv' : stage}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-t border-slate-800/80 pt-3 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveTab('scoring')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'scoring'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Score Breakdown ({scoreBreakdown.score}/100)</span>
            </button>
            <button
              onClick={() => setActiveTab('action')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'action'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Follow-up Action Draft</span>
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Activity History ({timeline.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Notes & History
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: DETERMINISTIC SCORE INSPECTOR */}
          {activeTab === 'scoring' && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-100">
                        Deterministic Lead Qualification Audit
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Mathematical qualification score grounded entirely in verified data fields.
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold font-mono text-amber-400">
                      {scoreBreakdown.score}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/100</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  {scoreBreakdown.summary}
                </div>
              </div>

              {/* Factor Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Score Factors & Mathematical Contribution
                </h4>

                <div className="space-y-2">
                  {scoreBreakdown.factors.map((fact, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              fact.status === 'positive'
                                ? 'bg-emerald-400'
                                : fact.status === 'penalty'
                                ? 'bg-rose-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className="font-bold text-slate-200">{fact.factor}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{fact.reason}</p>
                      </div>

                      <span
                        className={`font-mono font-bold text-xs shrink-0 px-2 py-0.5 rounded-md ${
                          fact.points > 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : fact.points < 0
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {fact.points > 0 ? `+${fact.points}` : fact.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified Evidence & Missing Warnings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Evidence
                  </div>
                  <div className="space-y-1">
                    {scoreBreakdown.evidence.map((ev, i) => (
                      <div key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Missing Data Warnings
                  </div>
                  <div className="space-y-1">
                    {scoreBreakdown.missingWarnings.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">No missing critical fields.</div>
                    ) : (
                      scoreBreakdown.missingWarnings.map((warn, i) => (
                        <div key={i} className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                          <span>{warn}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FOLLOW-UP ACTION DRAFT */}
          {activeTab === 'action' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold uppercase">
                    Speed-to-Lead Response Draft
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 font-semibold border border-indigo-800">
                    Human Review Required
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-slate-100">
                    Inquiry Engagement for {lead.interest_product_or_service || 'Consultation'}
                  </h4>
                  <p className="text-xs text-slate-300">
                    Pre-drafted, personalized WhatsApp response tailored to lead inquiry source and budget.
                  </p>
                </div>

                {/* Draft Box */}
                {(() => {
                  const draftText = `Namaste ${lead.name} Ji! 🙏 Greetings from ${business.name}.\n\nThank you for connecting with us regarding ${lead.interest_product_or_service || 'holistic wellness'}. We have specialized doctors available this week for personalized consultation and formulation regimens.\n\nWould you like us to reserve a convenient 15-minute slot for you today?`;
                  return (
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {draftText}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => copyDraft(draftText)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copied ? 'Copied!' : 'Copy Draft'}</span>
                        </button>

                        <button
                          onClick={() => openWhatsApp(draftText)}
                          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Approve & Dispatch WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Log Follow-up interaction */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200">Log Customer Outreach / Notes</h4>
                <textarea
                  rows={3}
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder="Record conversation outcome, requested time slot, or next steps..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleLogFollowUp}
                    disabled={!followUpNote.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    Log Interaction
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVITY HISTORY */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Lead Interaction History
                </h3>
                <span className="text-[11px] text-slate-400">{timeline.length} events logged</span>
              </div>

              <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 my-2">
                {timeline.map((evt) => (
                  <div key={evt.id} className="relative group">
                    <span
                      className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                        evt.badgeColor || 'bg-indigo-500'
                      }`}
                    />
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-slate-700 transition-colors space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-200">{evt.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(evt.timestamp).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{evt.description}</p>
                      <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between">
                        <span>Source: {evt.source}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: NOTES & CONVERSION */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200">Notes & Requirements</div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {lead.notes || 'No custom notes logged.'}
                </p>
              </div>

              {matchedCustomer && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Converted Customer Profile Linked
                  </div>
                  <p className="text-xs text-slate-300">
                    Matched with active customer record: <strong>{matchedCustomer.name}</strong> ({matchedCustomer.phone}).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
