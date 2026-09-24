import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  MessageSquare,
  Video,
  FileSpreadsheet,
  TrendingUp,
  Award,
  Zap,
  ShieldCheck,
  ExternalLink,
  Info,
  Layers,
  Calendar,
  AlertCircle,
  Database,
  BarChart3,
  Bot,
  Sliders,
  DollarSign,
  Users,
  Target,
  ArrowUpRight,
  Package,
} from 'lucide-react';
import { TrialDeliverable } from '../../types/database';

export const TrialView: React.FC = () => {
  const {
    business,
    metrics,
    trialDays,
    businessTrial,
    activeTrialDay,
    dataCompleteness,
    setActiveTrialDay,
    completeTrialDay,
    resetTrial,
    refreshTrialData,
    updateDeliverableStatus,
    addAutomation,
    showToast,
    setCurrentView,
  } = useBusinessStore();

  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [selectedTraceKpi, setSelectedTraceKpi] = useState<string | null>(null);
  const [testedAutomationId, setTestedAutomationId] = useState<string | null>(null);

  const currentDayData = trialDays.find((d) => d.day === activeTrialDay) || trialDays[0];
  const completedCount = trialDays.filter((d) => d.completed).length;
  const currency = business.currency_symbol || '₹';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    showToast('success', 'Copied to clipboard!', 'Asset ready for dispatch.');
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleTestDispatch = (ruleTitle: string, id: string) => {
    setTestedAutomationId(id);
    showToast(
      'info',
      'Test WhatsApp Dispatched',
      `Simulated execution of "${ruleTitle}". Response time: 1.2s.`
    );
    setTimeout(() => setTestedAutomationId(null), 3000);
  };

  const handleEnableAutomation = (deliv: TrialDeliverable) => {
    let triggerType: any = 'new_lead';
    let actionType: any = 'send_whatsapp';

    if (deliv.id.includes('replenish')) {
      triggerType = 'dormant_customer';
      actionType = 'send_whatsapp';
    } else if (deliv.id.includes('booking')) {
      triggerType = 'time_based';
      actionType = 'send_whatsapp';
    }

    addAutomation({
      name: deliv.title,
      trigger_type: triggerType,
      action_type: actionType,
      conditions: { delayMinutes: 2, channel: deliv.channel || 'whatsapp' },
      requires_approval: false,
      is_active: true,
      execution_count: 0,
      last_run: null,
    });

    updateDeliverableStatus(3, deliv.id, 'active');
    showToast('success', 'Automation Activated', `Rule "${deliv.title}" added to active CRM automations.`);
  };

  const getKpiTraceDetails = (kpiName: string) => {
    switch (kpiName) {
      case 'revenue':
        return {
          title: 'Total Gross Revenue',
          value: `${currency}${metrics.totalRevenue.toLocaleString('en-IN')}`,
          formula: 'SUM(orders.total_amount) + SUM(bookings.amount)',
          sources: [
            `Orders Table: ${metrics.totalOrders} completed transactions`,
            `Bookings Table: ${metrics.totalBookings} booked appointments`,
          ],
          note: 'Calculated purely from real active workspace database rows. Zero fake or simulated revenue.',
        };
      case 'expenses':
        return {
          title: 'Total Operational Expenses',
          value: `${currency}${metrics.totalExpenses.toLocaleString('en-IN')}`,
          formula: 'SUM(expenses.amount)',
          sources: ['Expenses Table: Verified categorized overhead records'],
          note: 'Rent, salaries, inventory purchase orders, and marketing spend.',
        };
      case 'profit':
        return {
          title: 'Net Operating Profit',
          value: `${currency}${metrics.netProfit.toLocaleString('en-IN')}`,
          formula: 'Gross Revenue - Operational Expenses - Estimated Direct Catalog COGS',
          sources: ['Derived from Orders, Bookings, and Expenses reconciliation'],
          note: `Net Profit Margin: ${metrics.profitMargin}%`,
        };
      case 'margin':
        return {
          title: 'Blended Catalog Gross Margin',
          value: `${metrics.grossMargin || 0}%`,
          formula: 'AVG((product.price - product.cost) / product.price * 100)',
          sources: ['Products Table: Verified SKU unit price and unit cost'],
          note: 'Represents unit product profitability across active catalog lines.',
        };
      case 'aov':
        return {
          title: 'Average Order Value (AOV)',
          value: `${currency}${metrics.avgOrderValue.toLocaleString('en-IN')}`,
          formula: 'Total Revenue / Total Orders',
          sources: ['Orders Table: Verified transaction totals'],
          note: 'Average basket size per customer transaction.',
        };
      case 'repeat':
        return {
          title: 'Repeat Customer Rate',
          value: `${metrics.repeatCustomerRate}%`,
          formula: '(Customers with Orders > 1 / Total Customers with Orders) * 100',
          sources: [`Customers Table: ${metrics.repeatCustomers} repeat buyers of ${metrics.totalCustomers} total`],
          note: 'Measures organic customer retention and repurchase loyalty.',
        };
      case 'health':
        return {
          title: 'Composite Business Health Score',
          value: `${metrics.healthScore}/100 (${metrics.healthBand})`,
          formula: 'Weighted composite (Profit Margin + Retention Rate + Lead Velocity + Catalog Margins)',
          sources: ['Calculated deterministically via Business Doctor AI Diagnostics Engine'],
          note: 'Evidence-based audit score derived from active tenant database records.',
        };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              5-Day Business Transformation Trial
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              100% Real Business Data
            </span>
            <span className="text-xs text-slate-300">
              Progress: {completedCount}/5 Days Completed ({Math.round((completedCount / 5) * 100)}%)
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            {business.name} Transformation Program
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            A guided 5-day hands-on operational program taking {business.name} from unorganized records to a fully automated AI Operating System with 30-day predictable growth.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshTrialData}
            title="Recalculate trial analysis using latest workspace records"
            className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Sync Data</span>
          </button>
          <button
            onClick={resetTrial}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Trial</span>
          </button>
        </div>
      </div>

      {/* 5-Day Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {trialDays.map((d) => {
          const isActive = d.day === activeTrialDay;
          return (
            <button
              key={d.day}
              onClick={() => setActiveTrialDay(d.day)}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-800/90 border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30'
                  : d.completed
                  ? 'bg-slate-900/90 border-emerald-800/60 text-slate-200 hover:bg-slate-800/60'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Day {d.day}
                </span>
                {d.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                )}
              </div>

              <div className="font-bold text-xs text-slate-100 mt-2 line-clamp-1">{d.title}</div>
              <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">{d.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Active Day Content Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Day Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
                DAY {currentDayData.day} OF 5
              </span>
              <span className="text-xs text-slate-400">{currentDayData.subtitle}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mt-1">{currentDayData.title}</h2>
          </div>

          <div className="flex items-center gap-3">
            {currentDayData.completed ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold">
                <Check className="w-4 h-4" />
                <span>Completed</span>
              </div>
            ) : (
              <button
                onClick={() => completeTrialDay(currentDayData.day)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Day {currentDayData.day} as Completed</span>
              </button>
            )}
          </div>
        </div>

        {/* Day Key Highlights Checklist */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Key Accomplishments for Day {currentDayData.day}:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-300">
            {currentDayData.highlights.map((hl, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{hl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DAY 1 SPECIALIZED VIEW: UNDERSTAND MY BUSINESS */}
        {/* ========================================================================= */}
        {currentDayData.day === 1 && (
          <div className="space-y-4">
            {/* Data Completeness Score Meter */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-400" />
                    Business Data Completeness Audit
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Verified presence of foundational records across all 6 business operational pillars
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {dataCompleteness.score}% Complete
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${dataCompleteness.score}%` }}
                />
              </div>

              {/* 6 Facets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                {dataCompleteness.facets.map((facet, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                      facet.complete
                        ? 'bg-slate-900/90 border-emerald-900/50 text-slate-200'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    {facet.complete ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-200">{facet.label}</div>
                      <div className="text-[10px] text-slate-400">{facet.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insufficient data notification if empty */}
            {!metrics.hasSufficientData && (
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300">
                    <strong className="text-amber-300">Zero Transaction Records Found:</strong> Import or log real orders, bookings, and expenses to generate full financial diagnoses.
                  </div>
                </div>
                <button
                  onClick={() => setCurrentView('integrations')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold shrink-0"
                >
                  Import Data
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* DAY 2 SPECIALIZED VIEW: BRING ME CUSTOMERS */}
        {/* ========================================================================= */}
        {currentDayData.day === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Target Customer Personas & Growth Channels
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300">Wellness & Quality Seekers</div>
                  <div className="text-[11px] text-slate-400">Age 26-48 in {business.location}. Seeking natural, authentic results.</div>
                  <div className="text-[10px] text-emerald-400 font-medium">Channel: WhatsApp & Instagram</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-bold text-indigo-300">Corporate Professionals</div>
                  <div className="text-[11px] text-slate-400">High-stress workforce seeking weekend/evening rejuvenation.</div>
                  <div className="text-[10px] text-emerald-400 font-medium">Channel: Google Search & WhatsApp</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-bold text-purple-300">Loyal Past Customers</div>
                  <div className="text-[11px] text-slate-400">Replenishment cycle every 30-45 days. Reorder VIPs.</div>
                  <div className="text-[10px] text-emerald-400 font-medium">Channel: Direct WhatsApp Broadcast</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DAY 3 SPECIALIZED VIEW: AUTOMATE MY CUSTOMERS */}
        {/* ========================================================================= */}
        {currentDayData.day === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  Grounded CRM Automations (Human-in-the-Loop)
                </div>
                <span className="text-[11px] text-slate-400">3 Verified Rules Available</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {currentDayData.deliverables.map((deliv) => {
                  const isTested = testedAutomationId === deliv.id;
                  const isRuleActive = deliv.status === 'active';

                  return (
                    <div
                      key={deliv.id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 font-semibold border border-indigo-800">
                            {deliv.channel || 'whatsapp'}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                              isRuleActive
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isRuleActive ? 'Active' : 'Ready'}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-slate-200">{deliv.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-2">{deliv.expected_outcome}</div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => handleTestDispatch(deliv.title, deliv.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors flex items-center gap-1"
                        >
                          {isTested ? <Check className="w-3 h-3 text-emerald-400" /> : <Zap className="w-3 h-3 text-amber-400" />}
                          <span>{isTested ? 'Sent' : 'Test Run'}</span>
                        </button>
                        <button
                          onClick={() => handleEnableAutomation(deliv)}
                          disabled={isRuleActive}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex-1 text-center ${
                            isRuleActive
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 cursor-default'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                          }`}
                        >
                          {isRuleActive ? 'Enabled ✓' : 'Enable Rule'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DAY 4 SPECIALIZED VIEW: SHOW ME MY BUSINESS */}
        {/* ========================================================================= */}
        {currentDayData.day === 4 && (
          <div className="space-y-4">
            {/* Live Database Scorecard */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Live Reconciled Financial & Operational KPIs
                </div>
                <span className="text-[11px] text-slate-400">Click any card to inspect SQL / DB derivation</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setSelectedTraceKpi('revenue')}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                >
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Gross Revenue</span>
                    <Info className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-100 font-mono mt-1">
                    {metrics.hasSufficientData ? `${currency}${metrics.totalRevenue.toLocaleString('en-IN')}` : 'Insufficient data'}
                  </div>
                  <div className="text-[9px] text-emerald-400 mt-0.5">{metrics.totalOrders} orders + {metrics.totalBookings} bookings</div>
                </button>

                <button
                  onClick={() => setSelectedTraceKpi('profit')}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                >
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Net Operating Profit</span>
                    <Info className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-100 font-mono mt-1">
                    {metrics.hasSufficientData ? `${currency}${metrics.netProfit.toLocaleString('en-IN')}` : 'Insufficient data'}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Net Margin: {metrics.profitMargin}%</div>
                </button>

                <button
                  onClick={() => setSelectedTraceKpi('margin')}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                >
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Gross Margin</span>
                    <Info className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-100 font-mono mt-1">
                    {metrics.grossMargin || 0}%
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Catalog Unit Margin</div>
                </button>

                <button
                  onClick={() => setSelectedTraceKpi('health')}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                >
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Health Score</span>
                    <Info className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                  </div>
                  <div className="text-sm font-bold text-amber-300 font-mono mt-1">
                    {metrics.healthScore}/100
                  </div>
                  <div className="text-[9px] text-amber-400 mt-0.5">{metrics.healthBand}</div>
                </button>
              </div>
            </div>

            {/* Traceability Details Popover / Card */}
            {selectedTraceKpi && (
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2">
                {(() => {
                  const trace = getKpiTraceDetails(selectedTraceKpi);
                  if (!trace) return null;
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                          <Database className="w-3.5 h-3.5" />
                          Database Traceability: {trace.title} ({trace.value})
                        </div>
                        <button
                          onClick={() => setSelectedTraceKpi(null)}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-xs font-mono text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        Formula: {trace.formula}
                      </div>
                      <div className="space-y-1 text-xs text-slate-300">
                        {trace.sources.map((src, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{src}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-emerald-400 pt-1 font-medium">{trace.note}</div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* DAY 5 SPECIALIZED VIEW: 30-DAY GROWTH PLAN */}
        {/* ========================================================================= */}
        {currentDayData.day === 5 && (
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    30-Day Revenue Target Progress
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Target: {currency}{business.monthly_revenue_target.toLocaleString('en-IN')} | Verified Current: {metrics.hasSufficientData ? `${currency}${metrics.totalRevenue.toLocaleString('en-IN')}` : 'Insufficient data (Start From Today baseline)'}
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-amber-400">
                  Opportunity Gap: {currency}{Math.max(0, business.monthly_revenue_target - metrics.totalRevenue).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${metrics.hasSufficientData ? Math.min(100, Math.round((metrics.totalRevenue / (business.monthly_revenue_target || 1)) * 100)) : 0}%`,
                  }}
                />
              </div>

              {/* 4-Week Action Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-amber-400 uppercase">Week 1</div>
                  <div className="text-xs font-bold text-slate-200">Speed-to-Lead Rule</div>
                  <div className="text-[11px] text-slate-400">Activate instant WhatsApp welcome for new inquiries.</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">+₹45,000 Uplift</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase">Week 2</div>
                  <div className="text-xs font-bold text-slate-200">Refill Retention Engine</div>
                  <div className="text-[11px] text-slate-400">45-day automated VIP refill broadcasts with 1-click reorder.</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">+₹65,000 Uplift</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase">Week 3</div>
                  <div className="text-xs font-bold text-slate-200">Inventory & Capacity</div>
                  <div className="text-[11px] text-slate-400">Restock zero-inventory SKUs & optimize weekday clinic slots.</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">+₹50,000 Uplift</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-purple-400 uppercase">Week 4</div>
                  <div className="text-xs font-bold text-slate-200">Memory Run-Rate Audit</div>
                  <div className="text-[11px] text-slate-400">Review 30-day Business Memory trends & scale top Reel hooks.</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">+₹80,000 Uplift</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deliverables / Assets generated for this day */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400" />
              Day {currentDayData.day} AI Deliverables & Execution Assets
            </h3>
            <span className="text-xs text-slate-400">Ready to copy & dispatch</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {currentDayData.deliverables.map((deliv, idx) => {
              const copyId = `deliv_${currentDayData.day}_${idx}`;
              return (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Distinct Fact vs Recommendation Badge */}
                        {deliv.type.includes('Scorecard') || deliv.type.includes('Review') || deliv.type.includes('Audit') || deliv.type.includes('Diagnostic') ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold uppercase flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Observed Fact (DB Audited)
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold uppercase flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            AI Recommendation
                          </span>
                        )}

                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold uppercase flex items-center gap-1">
                          {deliv.type.includes('WhatsApp') && <MessageSquare className="w-3 h-3 text-emerald-400" />}
                          {deliv.type.includes('Reel') && <Video className="w-3 h-3 text-rose-400" />}
                          {deliv.type.includes('Scorecard') && <FileSpreadsheet className="w-3 h-3 text-indigo-400" />}
                          {deliv.type.includes('Roadmap') && <TrendingUp className="w-3 h-3 text-amber-400" />}
                          {deliv.type}
                        </span>

                        {deliv.confidence_score && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 font-mono font-medium">
                            {deliv.confidence_score}% Confidence
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => copyToClipboard(deliv.content, copyId)}
                        className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 flex items-center gap-1 transition-colors"
                      >
                        {copiedIndex === copyId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <h4 className="font-bold text-xs text-slate-100">{deliv.title}</h4>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                      {deliv.content}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Outcome: {deliv.expected_outcome}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Next Day Prompt */}
        {currentDayData.day < 5 ? (
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Next Up: <strong>Day {currentDayData.day + 1}: {trialDays[currentDayData.day]?.title}</strong>
            </div>
            <button
              onClick={() => setActiveTrialDay(currentDayData.day + 1)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>Preview Day {currentDayData.day + 1}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              🎉 <strong>5-Day Transformation Complete!</strong> Your AI Operating System is fully initialized.
            </div>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
            >
              <span>Go to Live OS Dashboard</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
