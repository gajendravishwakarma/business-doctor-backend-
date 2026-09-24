import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Stethoscope,
  Sparkles,
  ArrowRight,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Package,
  Clock,
  Zap,
  Database,
  UploadCloud,
  Calculator,
  ShieldCheck,
  Percent,
  Receipt,
  Target,
  Info,
} from 'lucide-react';
import { MetricEvidenceState } from '../../types/database';

interface DashboardViewProps {
  onNavigate: (moduleKey: string) => void;
}

export const EvidenceBadge: React.FC<{ state: MetricEvidenceState }> = ({ state }) => {
  switch (state) {
    case 'observed':
      return (
        <span
          title="Directly verified from live tenant database records"
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/70 flex items-center gap-1 tracking-tight"
        >
          <Database className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
          Observed / DB Audited
        </span>
      );
    case 'calculated':
      return (
        <span
          title="Mathematically derived from verified database records"
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/70 flex items-center gap-1 tracking-tight"
        >
          <Calculator className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
          Calculated from observed DB data
        </span>
      );
    case 'ai_recommendation':
      return (
        <span
          title="Derived by AI operating models based on verified data"
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/70 flex items-center gap-1 tracking-tight"
        >
          <Sparkles className="w-2.5 h-2.5 text-purple-400 shrink-0" />
          AI Recommendation
        </span>
      );
    case 'insufficient_data':
    default:
      return (
        <span
          title="Insufficient transaction records in database to calculate"
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/70 flex items-center gap-1 tracking-tight"
        >
          <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
          Insufficient data
        </span>
      );
  }
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    business,
    metrics,
    orders,
    customers,
    leads,
    products,
    bookings,
    expenses,
    diagnoses,
    agentActions,
    memory,
    trialDays,
    approveAgentAction,
    rejectAgentAction,
    runDiagnosisScan,
    isAiDiagnosing,
  } = useBusinessStore();

  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'today'>('all');

  const pendingActions = agentActions.filter((a) => a.status === 'pending_approval');
  const criticalDiagnoses = diagnoses.filter((d) => d.status === 'open');
  const lowStock = products.filter((p) => p.stock_quantity <= 10);
  const completedTrialDays = trialDays.filter((d) => d.completed).length;

  const currencySymbol = business.currency_symbol || '₹';
  const timezone = business.timezone || 'Asia/Kolkata';

  // Display values based on active period filter
  const displayedRevenue =
    periodFilter === 'today'
      ? metrics.todayRevenue
      : periodFilter === 'month'
      ? metrics.currentMonthRevenue
      : metrics.totalRevenue;

  const displayedOrdersCount =
    periodFilter === 'today'
      ? metrics.todayOrdersCount
      : periodFilter === 'month'
      ? metrics.currentMonthOrdersCount
      : metrics.totalOrders + metrics.totalBookings;

  return (
    <div className="space-y-6">
      {/* Business Header & Timezone Audit Context */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-sm">{business.name}</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono">
                {business.industry}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Timezone: <strong className="text-slate-300 font-mono">{timezone}</strong></span>
              <span>•</span>
              <span>Currency: <strong className="text-slate-300">{currencySymbol} ({business.currency || 'INR'})</strong></span>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80 shrink-0">
          <button
            onClick={() => setPeriodFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              periodFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All-Time Audited
          </button>
          <button
            onClick={() => setPeriodFilter('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              periodFilter === 'month'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriodFilter('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              periodFilter === 'today'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Today
          </button>
        </div>
      </div>

      {/* 5-Day Business Transformation Trial Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              5-Day Business Transformation Trial
            </span>
            <span className="text-xs text-indigo-200">
              Day {completedTrialDays + 1} of 5 In Progress
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">
            Transform {business.name} into an Autonomous AI Operating System
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Progress through the guided 5-day trial to audit unit economics, launch automated WhatsApp campaigns, and unlock your 30-day growth roadmap.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 z-10 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1.5">
            {trialDays.map((d) => (
              <div
                key={d.day}
                title={`Day ${d.day}: ${d.title}`}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  d.completed
                    ? 'bg-emerald-600 text-white'
                    : d.day === completedTrialDays + 1
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/40 font-extrabold'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {d.completed ? '✓' : d.day}
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigate('trial')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-colors"
          >
            <span>Open Day {completedTrialDays + 1}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Day 0 / Insufficient Data Verification Banner */}
      {!metrics.hasSufficientData && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-amber-200 font-semibold">Insufficient Data for Operational Baseline</strong>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                Zero sales orders or completed bookings recorded in the active tenant database. Business Doctor AI refuses to invent fake metrics. Import real sales orders, CSV catalogs, or appointments to begin evidence-based diagnosis.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('integrations')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-md shadow-indigo-600/20 transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import Real Data</span>
          </button>
        </div>
      )}

      {/* Primary KPI Scorecard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Revenue Card */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-slate-300 font-medium">Total Gross Revenue</span>
              <EvidenceBadge
                state={metrics.hasSufficientRevenueData ? 'calculated' : 'insufficient_data'}
              />
            </div>

            <div className="mt-1">
              {metrics.hasSufficientRevenueData ? (
                <div className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
                  {currencySymbol}
                  {displayedRevenue.toLocaleString('en-IN')}
                </div>
              ) : (
                <div className="text-sm font-semibold text-amber-400/90 italic flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Insufficient data</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Period:</span>
              <strong className="text-slate-200 capitalize">{periodFilter === 'all' ? 'All-Time' : periodFilter}</strong>
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.totalRevenue.details}>
              Trace: {metrics.metricsEvidence.totalRevenue.details}
            </div>
          </div>
        </div>

        {/* 2. Net Operating Profit */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-slate-300 font-medium">Net Operating Profit</span>
              <EvidenceBadge
                state={metrics.hasSufficientProfitData ? 'calculated' : 'insufficient_data'}
              />
            </div>

            <div className="mt-1">
              {metrics.hasSufficientProfitData ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
                    {currencySymbol}
                    {metrics.netProfit.toLocaleString('en-IN')}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    ({metrics.netProfitMargin}%)
                  </span>
                </div>
              ) : (
                <div className="text-sm font-semibold text-amber-400/90 italic flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Insufficient data</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Recorded Expenses:</span>
              <strong className="text-rose-400">
                {currencySymbol}
                {metrics.totalExpenses.toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.netProfit.details}>
              Trace: {metrics.metricsEvidence.netProfit.details}
            </div>
          </div>
        </div>

        {/* 3. Business Health Score */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-slate-300 font-medium">Business Health Score</span>
              <EvidenceBadge
                state={metrics.hasSufficientHealthData ? 'calculated' : 'insufficient_data'}
              />
            </div>

            <div className="mt-1">
              {metrics.hasSufficientHealthData && metrics.healthScore != null ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">
                    {metrics.healthScore}
                  </span>
                  <span className="text-xs text-slate-400">/ 100</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold uppercase">
                    {metrics.healthBand}
                  </span>
                </div>
              ) : (
                <div className="text-sm font-semibold text-amber-400/90 italic flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Insufficient data</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <strong className="text-slate-200">
                {metrics.hasSufficientHealthData ? metrics.healthBand : 'Awaiting Transaction Ingest'}
              </strong>
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.healthScore.details}>
              Trace: {metrics.metricsEvidence.healthScore.details}
            </div>
          </div>
        </div>

        {/* 4. Target Monthly Run-Rate */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-slate-300 font-medium">Target Monthly Run-Rate</span>
              <EvidenceBadge
                state={metrics.hasSufficientRunRateData ? 'calculated' : 'insufficient_data'}
              />
            </div>

            <div className="mt-1">
              {metrics.hasSufficientRunRateData && metrics.targetMonthlyRunRateProgress != null ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
                    {metrics.targetMonthlyRunRateProgress}%
                  </span>
                  <span className="text-xs text-slate-400">
                    of {currencySymbol}{business.monthly_revenue_target?.toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <div className="text-sm font-semibold text-amber-400/90 italic flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Insufficient data</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    metrics.hasSufficientRunRateData && metrics.targetMonthlyRunRateProgress != null
                      ? metrics.targetMonthlyRunRateProgress
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Projected Run-Rate:</span>
              <strong className="text-slate-200">
                {metrics.hasSufficientRunRateData
                  ? `${currencySymbol}${metrics.currentRunRate.toLocaleString('en-IN')}`
                  : 'Insufficient data'}
              </strong>
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.targetMonthlyRunRate.details}>
              Trace: {metrics.metricsEvidence.targetMonthlyRunRate.details}
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Operational & Conversion Metrics Grid */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Operational Metrics & Evidence Ledger</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Every displayed metric is mapped to its underlying database table and columns with tenant isolation.
            </p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono">
            Active Tenant: {business.id.slice(0, 12)}...
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Orders */}
          <div
            onClick={() => onNavigate('orders')}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Orders (Sales)</span>
              <EvidenceBadge state="observed" />
            </div>
            <div className="text-xl font-bold text-slate-100 font-mono">{orders.length}</div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.totalOrders.details}>
              {metrics.metricsEvidence.totalOrders.details}
            </div>
          </div>

          {/* Total Bookings */}
          <div
            onClick={() => onNavigate('bookings')}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Bookings (Appointments)</span>
              <EvidenceBadge state="observed" />
            </div>
            <div className="text-xl font-bold text-slate-100 font-mono">{bookings.length}</div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.totalBookings.details}>
              {metrics.metricsEvidence.totalBookings.details}
            </div>
          </div>

          {/* Customers & Repeat Rate */}
          <div
            onClick={() => onNavigate('customers')}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Customers & Repeat Rate</span>
              <EvidenceBadge state={metrics.hasSufficientRepeatData ? 'calculated' : 'insufficient_data'} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-100 font-mono">{customers.length}</span>
              <span className="text-xs text-slate-400">
                ({metrics.hasSufficientRepeatData ? `${metrics.repeatCustomerRate}% repeat` : 'Insufficient data'})
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.repeatCustomerRate.details}>
              {metrics.metricsEvidence.repeatCustomerRate.details}
            </div>
          </div>

          {/* Average Order Value */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Average Order Value (AOV)</span>
              <EvidenceBadge state={metrics.hasSufficientAovData ? 'calculated' : 'insufficient_data'} />
            </div>
            <div className="text-xl font-bold text-slate-100 font-mono">
              {metrics.hasSufficientAovData ? `${currencySymbol}${metrics.avgOrderValue.toLocaleString('en-IN')}` : 'Insufficient data'}
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.avgOrderValue.details}>
              {metrics.metricsEvidence.avgOrderValue.details}
            </div>
          </div>

          {/* CRM Leads */}
          <div
            onClick={() => onNavigate('leads')}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Leads (CRM)</span>
              <EvidenceBadge state="observed" />
            </div>
            <div className="text-xl font-bold text-slate-100 font-mono">{leads.length}</div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.totalLeads.details}>
              {metrics.metricsEvidence.totalLeads.details}
            </div>
          </div>

          {/* Lead Conversion Rate */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Lead Conversion Rate</span>
              <EvidenceBadge state={metrics.hasSufficientLeadData ? 'calculated' : 'insufficient_data'} />
            </div>
            <div className="text-xl font-bold text-slate-100 font-mono">
              {metrics.hasSufficientLeadData ? `${metrics.leadConversionRate}%` : 'Insufficient data'}
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.leadConversionRate.details}>
              {metrics.metricsEvidence.leadConversionRate.details}
            </div>
          </div>

          {/* Gross Margin */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Catalog Gross Margin</span>
              <EvidenceBadge state={metrics.hasSufficientMarginData ? 'calculated' : 'insufficient_data'} />
            </div>
            <div className="text-xl font-bold text-slate-100 font-mono">
              {metrics.hasSufficientMarginData && metrics.grossMargin != null ? `${metrics.grossMargin}%` : 'Insufficient data'}
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.grossMargin.details}>
              {metrics.metricsEvidence.grossMargin.details}
            </div>
          </div>

          {/* Operating Expenses */}
          <div
            onClick={() => onNavigate('expenses')}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Expenses Audited</span>
              <EvidenceBadge state="observed" />
            </div>
            <div className="text-xl font-bold text-slate-100 font-mono">
              {currencySymbol}{metrics.totalExpenses.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500 truncate" title={metrics.metricsEvidence.expenses.details}>
              {metrics.metricsEvidence.expenses.details}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Agent Approvals & AI Diagnoses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Autonomous Agent Action Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    Autonomous Agent Actions
                  </h3>
                  <p className="text-xs text-slate-400">
                    Human-in-the-Loop review required before automated execution
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('ai_agents')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <span>View All Agents</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {pendingActions.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800/80">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1.5 opacity-80" />
                  <div>No pending agent actions waiting for approval.</div>
                </div>
              ) : (
                pendingActions.slice(0, 3).map((act) => (
                  <div
                    key={act.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
                          {act.agent_name}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          {act.confidence}% Confidence
                        </span>
                      </div>
                      <div className="font-semibold text-xs text-slate-200">{act.action_type}</div>
                      <div className="text-xs text-slate-400 leading-relaxed">{act.reasoning}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => rejectAgentAction(act.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => approveAgentAction(act.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
                      >
                        Approve & Run
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Doctor AI Diagnosis */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-100">Doctor AI Diagnosis</h3>
              </div>
              <button
                onClick={runDiagnosisScan}
                disabled={isAiDiagnosing}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/30 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>{isAiDiagnosing ? 'Scanning...' : 'Run Scan'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {criticalDiagnoses.slice(0, 3).map((diag) => (
                <div
                  key={diag.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    diag.severity === 'critical'
                      ? 'bg-rose-950/20 border-rose-800/40 text-rose-100'
                      : diag.severity === 'warning'
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-100'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-100 truncate">{diag.problem_title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase shrink-0 ${
                        diag.severity === 'critical'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : diag.severity === 'warning'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {diag.severity}
                    </span>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-2">
                    {diag.problem_description}
                  </p>

                  <div className="pt-1 text-[11px] text-emerald-300 flex items-center justify-between">
                    <span className="truncate">Uplift: {diag.expected_kpi}</span>
                    <button
                      onClick={() => onNavigate('ai_diagnosis')}
                      className="font-semibold text-indigo-400 hover:text-indigo-300 shrink-0 ml-2"
                    >
                      Solve →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => onNavigate('ai_diagnosis')}
              className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Explore Full Diagnostic Suite</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Persistent Business Memory Highlight */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Persistent Business Memory
              </span>
              <button
                onClick={() => onNavigate('business_memory')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                View Ledger
              </button>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
              {memory.length > 0 ? (
                <div>
                  <div className="font-semibold text-slate-200 mb-0.5">{memory[0].title}</div>
                  <p className="text-slate-400 text-[11px] line-clamp-3">{memory[0].content}</p>
                </div>
              ) : (
                <div className="text-slate-500 italic text-[11px]">
                  Day 0 baseline observation will automatically record when you onboard or import business datasets.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
