import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Phone,
  Mail,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Filter,
  Flame,
  Award,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useBusinessStore } from '../../lib/store';
import {
  calculateCRMMetrics,
  getLeadFunnelData,
  getCustomerSegments,
  deriveFollowUpsFromRecords,
  formatCurrency,
} from '../../lib/crm-engine';
import { EvidenceBadge } from './DashboardView';
import { CRMFollowUp } from '../../types/crm';
import { Customer360Drawer } from '../crm/Customer360Drawer';
import { LeadDetailDrawer } from '../crm/LeadDetailDrawer';
import { Customer, Lead } from '../../types/database';

interface CRMOverviewViewProps {
  onNavigate?: (routeKey: string) => void;
}

export const CRMOverviewView: React.FC<CRMOverviewViewProps> = ({ onNavigate }) => {
  const {
    business,
    leads,
    customers,
    orders,
    bookings,
    followups,
    addFollowUp,
    completeFollowUp,
    rescheduleFollowUp,
    setCurrentView,
  } = useBusinessStore();

  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      setCurrentView(route);
    }
  };

  // Selected entities for drawers
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Quick Follow-up modal state
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpTargetType, setFollowUpTargetType] = useState<'lead' | 'customer'>('lead');
  const [followUpTargetId, setFollowUpTargetId] = useState<string>('');
  const [followUpDueDate, setFollowUpDueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [followUpReason, setFollowUpReason] = useState<string>('');
  const [followUpNotes, setFollowUpNotes] = useState<string>('');

  // Reschedule state
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState<string>('');

  // Calculate grounded CRM metrics strictly from live store collections
  const crmMetrics = useMemo(() => {
    return calculateCRMMetrics(business, leads, customers, orders, bookings, followups);
  }, [business, leads, customers, orders, bookings, followups]);

  // Lead Funnel Stages
  const funnelStages = useMemo(() => {
    return getLeadFunnelData(leads);
  }, [leads]);

  // Customer Segments
  const { summaries: customerSegments } = useMemo(() => {
    return getCustomerSegments(
      customers,
      leads,
      orders,
      bookings,
      business.currency_symbol || '₹'
    );
  }, [customers, leads, orders, bookings, business.currency_symbol]);

  // All unified follow-ups sorted by urgency
  const allFollowUps = useMemo(() => {
    return deriveFollowUpsFromRecords(leads, customers, followups, business.timezone);
  }, [leads, customers, followups, business.timezone]);

  // Filter urgent follow-ups (overdue or due today)
  const urgentFollowUps = useMemo(() => {
    return allFollowUps.filter((f) => f.status === 'overdue' || (f.status === 'pending' && f.due_date.startsWith(new Date().toISOString().split('T')[0])));
  }, [allFollowUps]);

  const handleCreateFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpTargetId || !followUpDueDate || !followUpReason) return;

    let targetName = '';
    let targetPhone = '';
    let targetEmail = '';

    if (followUpTargetType === 'lead') {
      const l = leads.find((item) => item.id === followUpTargetId);
      if (l) {
        targetName = l.name;
        targetPhone = l.phone;
        targetEmail = l.email;
      }
    } else {
      const c = customers.find((item) => item.id === followUpTargetId);
      if (c) {
        targetName = c.name;
        targetPhone = c.phone;
        targetEmail = c.email;
      }
    }

    addFollowUp({
      target_type: followUpTargetType,
      target_id: followUpTargetId,
      target_name: targetName || 'Target Contact',
      contact_phone: targetPhone,
      contact_email: targetEmail,
      due_date: followUpDueDate,
      reason: followUpReason,
      notes: followUpNotes,
      status: 'pending',
    });

    setIsFollowUpModalOpen(false);
    setFollowUpReason('');
    setFollowUpNotes('');
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">CRM & Pipeline Overview</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
              Tenant Scoped
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Live relationship pipeline, conversion metrics, and contact health for{' '}
            <strong className="text-slate-200">{business.name}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsFollowUpModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Schedule Follow-up
          </button>
          <button
            onClick={() => handleNavigate('leads')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            Lead Funnel
          </button>
          <button
            onClick={() => handleNavigate('customers')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            Customer 360
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-start justify-between">
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <EvidenceBadge state="observed" />
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium text-slate-400">Total Leads</span>
            <div className="text-2xl font-bold text-white mt-0.5">{crmMetrics.totalLeads}</div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-amber-400 font-semibold">{crmMetrics.openLeads}</span> in active pipeline
            </p>
          </div>
        </div>

        {/* Lead Conversion Rate */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-start justify-between">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <EvidenceBadge state={crmMetrics.hasSufficientLeadData ? 'calculated' : 'insufficient_data'} />
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium text-slate-400">Lead Conversion Rate</span>
            <div className="text-2xl font-bold text-white mt-0.5">
              {crmMetrics.conversionRate !== null ? `${crmMetrics.conversionRate}%` : '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {crmMetrics.wonLeads} won of {crmMetrics.totalLeads} total leads
            </p>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-start justify-between">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <EvidenceBadge state="observed" />
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium text-slate-400">Total Customers</span>
            <div className="text-2xl font-bold text-white mt-0.5">{crmMetrics.totalCustomers}</div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">{crmMetrics.repeatCustomers}</span> repeat / VIP
            </p>
          </div>
        </div>

        {/* Actionable Follow-ups */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all">
          <div className="flex items-start justify-between">
            <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
              <Clock className="w-5 h-5" />
            </div>
            <EvidenceBadge state="calculated" />
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium text-slate-400">Due & Overdue Follow-ups</span>
            <div className="text-2xl font-bold text-white mt-0.5">
              {crmMetrics.followupsDueToday + crmMetrics.overdueFollowups}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-rose-400 font-semibold">{crmMetrics.overdueFollowups} overdue</span>,{' '}
              <span className="text-amber-400 font-semibold">{crmMetrics.followupsDueToday} today</span>
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Avg Lead Score</div>
            <div className="text-lg font-bold text-slate-200">
              {crmMetrics.avgLeadScore !== null ? `${crmMetrics.avgLeadScore} / 100` : 'Insufficient data'}
            </div>
          </div>
          <EvidenceBadge state={crmMetrics.hasSufficientLeadData ? 'calculated' : 'insufficient_data'} />
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Avg Customer Lifetime Spend</div>
            <div className="text-lg font-bold text-slate-200">
              {crmMetrics.avgCustomerSpend !== null ? formatCurrency(crmMetrics.avgCustomerSpend) : 'Insufficient data'}
            </div>
          </div>
          <EvidenceBadge state={crmMetrics.hasSufficientCustomerData ? 'calculated' : 'insufficient_data'} />
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Inactive / Churn Risk</div>
            <div className="text-lg font-bold text-slate-200">{crmMetrics.inactiveCustomers} accounts</div>
          </div>
          <EvidenceBadge state={crmMetrics.hasSufficientCustomerData ? 'calculated' : 'insufficient_data'} />
        </div>
      </div>

      {/* Insufficient Data Callout if workspace is fresh */}
      {!crmMetrics.hasSufficientLeadData && !crmMetrics.hasSufficientCustomerData && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">Fresh CRM Workspace Detected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No leads or customer records found for this business yet. CRM conversion calculations and health metrics will automatically generate as you record contacts or import business data.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleNavigate('leads')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            >
              Add First Lead
            </button>
            <button
              onClick={() => handleNavigate('customers')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Add First Customer
            </button>
            <button
              onClick={() => handleNavigate('data')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Import CSV Data
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Funnel Stages & Urgent Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Lead Pipeline Funnel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              Lead Pipeline Funnel
            </h2>
            <button
              onClick={() => handleNavigate('leads')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              View Full Pipeline Board <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {funnelStages.map((st) => (
              <div
                key={st.stage}
                onClick={() => handleNavigate('leads')}
                className="bg-slate-900/80 hover:bg-slate-800/80 p-4 rounded-xl border border-slate-800/80 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-300">{st.label}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-300">
                      {st.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{st.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Budget:</span>
                  <span className="font-semibold text-slate-200">
                    {st.totalBudget > 0 ? formatCurrency(st.totalBudget) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Customer Health Segmentation Preview */}
          <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400" />
                Customer Segments & Retention Health
              </h2>
              <button
                onClick={() => handleNavigate('customers')}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                View Customer Directory <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {customerSegments.slice(0, 6).map((seg) => (
                <div
                  key={seg.type}
                  onClick={() => handleNavigate('customers')}
                  className="bg-slate-900/60 hover:bg-slate-800/70 p-4 rounded-xl border border-slate-800 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200">{seg.label}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {seg.count}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{seg.description}</p>
                  </div>
                  <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
                    <span>Segment Value:</span>
                    <span className="font-semibold text-slate-300">{formatCurrency(seg.totalValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Priority Follow-ups Today & Overdue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-400" />
              Priority Follow-ups
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/60 font-medium">
              {urgentFollowUps.length} Urgent
            </span>
          </div>

          <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 divide-y divide-slate-800/80 max-h-[580px] overflow-y-auto">
            {urgentFollowUps.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">All caught up!</p>
                <p className="text-xs text-slate-500">
                  No overdue follow-ups or pending actions scheduled for today.
                </p>
                <button
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Schedule Next Follow-up
                </button>
              </div>
            ) : (
              urgentFollowUps.map((fu) => (
                <div key={fu.id} className="p-4 space-y-3 hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{fu.target_name}</span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            fu.target_type === 'lead'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                          }`}
                        >
                          {fu.target_type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{fu.reason}</p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        fu.status === 'overdue'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {fu.status === 'overdue' ? 'Overdue' : 'Due Today'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{fu.due_date}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {fu.contact_phone && (
                        <a
                          href={`tel:${fu.contact_phone}`}
                          title="Call contact"
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {fu.contact_phone && (
                        <a
                          href={`https://wa.me/${fu.contact_phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open WhatsApp"
                          className="p-1 rounded bg-slate-800 hover:bg-emerald-900/50 text-emerald-400 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                    {reschedulingId === fu.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="date"
                          value={newDueDate}
                          onChange={(e) => setNewDueDate(e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white flex-1"
                        />
                        <button
                          onClick={() => {
                            if (newDueDate) {
                              rescheduleFollowUp(fu.id, newDueDate);
                              setReschedulingId(null);
                              setNewDueDate('');
                            }
                          }}
                          className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setReschedulingId(null)}
                          className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setReschedulingId(fu.id);
                            setNewDueDate(fu.due_date);
                          }}
                          className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => completeFollowUp(fu.id)}
                          className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark Done
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Schedule Follow-up Modal */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Schedule CRM Follow-up</h3>
              <button
                onClick={() => setIsFollowUpModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFollowUpTargetType('lead');
                      setFollowUpTargetId('');
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      followUpTargetType === 'lead'
                        ? 'bg-amber-950 text-amber-300 border-amber-700'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700'
                    }`}
                  >
                    Lead ({leads.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFollowUpTargetType('customer');
                      setFollowUpTargetId('');
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      followUpTargetType === 'customer'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700'
                    }`}
                  >
                    Customer ({customers.length})
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Contact</label>
                <select
                  value={followUpTargetId}
                  onChange={(e) => setFollowUpTargetId(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose {followUpTargetType} --</option>
                  {followUpTargetType === 'lead'
                    ? leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.phone || l.email || l.status})
                        </option>
                      ))
                    : customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || c.email || c.status})
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={followUpDueDate}
                  onChange={(e) => setFollowUpDueDate(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                </input>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Task</label>
                <input
                  type="text"
                  placeholder="e.g. Discuss proposal pricing, check satisfaction..."
                  value={followUpReason}
                  onChange={(e) => setFollowUpReason(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Internal notes or context..."
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  Schedule Follow-up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawers */}
      {selectedCustomer && (
        <Customer360Drawer
          customer={selectedCustomer}
          isOpen={Boolean(selectedCustomer)}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          isOpen={Boolean(selectedLead)}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
};
export default CRMOverviewView;
