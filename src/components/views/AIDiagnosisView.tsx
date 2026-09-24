import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Stethoscope,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Filter,
  Check,
  Zap,
  ShieldAlert,
  RotateCcw,
  Bot,
  Database,
  Lock,
} from 'lucide-react';
import { AIDiagnosis } from '../../types/database';

export const AIDiagnosisView: React.FC = () => {
  const {
    business,
    metrics,
    diagnoses,
    runDiagnosisScan,
    runAgentExecutionLoop,
    convertDiagnosisToAction,
    updateDiagnosisStatus,
    isAiDiagnosing,
    isAgentLoopRunning,
    showToast,
  } = useBusinessStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const categories = [
    { key: 'all', label: 'All Categories' },
    { key: 'growth', label: 'Revenue & Growth' },
    { key: 'retention', label: 'Customer Retention' },
    { key: 'operational', label: 'Operations & Capacity' },
    { key: 'expense', label: 'Cost & Profitability' },
  ];

  const filteredDiagnoses = diagnoses.filter((d) => {
    if (selectedCategory !== 'all' && d.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && d.severity !== selectedSeverity) return false;
    return true;
  });

  const activeCount = diagnoses.filter((d) => d.status === 'open').length;
  const inProgressCount = diagnoses.filter((d) => d.status === 'in_progress').length;
  const resolvedCount = diagnoses.filter((d) => d.status === 'resolved').length;

  const handleDelegateToAgent = (diag: AIDiagnosis) => {
    convertDiagnosisToAction(diag);
  };

  const handleResolve = (diag: AIDiagnosis) => {
    updateDiagnosisStatus(diag.id, 'resolved');
    showToast('success', `Marked "${diag.problem_title}" as resolved!`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
              Evidence-Based Business Doctor
            </span>
            <span className="text-xs text-slate-400">
              Grounded in {metrics.totalOrders} Orders, {metrics.totalBookings} Bookings & {business.industry} Benchmarks
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Operational Audit & Prescription Engine
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Extracts mathematical bottlenecks from your live database records and converts actionable findings into human-in-the-loop Agent proposals.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <button
            onClick={runAgentExecutionLoop}
            disabled={isAgentLoopRunning || isAiDiagnosing}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <Bot className="w-4 h-4 text-indigo-300" />
            <span>{isAgentLoopRunning ? 'Running Crew Loop...' : 'Run Autonomous Loop'}</span>
          </button>

          <button
            onClick={runDiagnosisScan}
            disabled={isAiDiagnosing || isAgentLoopRunning}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>{isAiDiagnosing ? 'Scanning...' : 'Diagnose Only'}</span>
          </button>
        </div>
      </div>

      {/* Insufficient Data Notice if baseline unverified */}
      {!metrics.hasSufficientData && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-amber-200 font-semibold">Insufficient Operational History Recorded</strong>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Business Doctor AI strictly refuses to invent historical facts or fabricate fake customer behaviors. To unlock deeper cohort and pricing audits, import real orders or booking records.
            </p>
          </div>
        </div>
      )}

      {/* Summary Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400">Total Audit Findings</div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{diagnoses.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">{activeCount} open issues requiring action</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400">Critical Bottlenecks</div>
          <div className="text-2xl font-bold text-rose-400 mt-1 font-mono">
            {diagnoses.filter((d) => d.severity === 'critical' && d.status === 'open').length}
          </div>
          <div className="text-[11px] text-rose-300 mt-1">High revenue or margin leakage</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400">Actions in Progress</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{inProgressCount}</div>
          <div className="text-[11px] text-amber-300 mt-1">Automations or campaigns running</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400">Resolved Prescriptions</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{resolvedCount}</div>
          <div className="text-[11px] text-emerald-300 mt-1">Fixes applied to store operations</div>
        </div>
      </div>

      {/* Filter Tabs & Severity Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
        {/* Category tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-2 shrink-0 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Severity:</span>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warnings</option>
            <option value="opportunity">Opportunities</option>
            <option value="info">Info / Baseline</option>
          </select>
        </div>
      </div>

      {/* Diagnoses List */}
      <div className="space-y-4">
        {filteredDiagnoses.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
            <h3 className="font-bold text-sm text-slate-200">No matching diagnostic findings</h3>
            <p className="text-xs text-slate-400 mt-1">Try switching category filters or run a fresh scan.</p>
          </div>
        ) : (
          filteredDiagnoses.map((diag) => (
            <div
              key={diag.id}
              className={`p-5 rounded-2xl border transition-all ${
                diag.status === 'resolved'
                  ? 'bg-slate-900/40 border-slate-800 opacity-75'
                  : diag.severity === 'critical'
                  ? 'bg-slate-900 border-rose-900/40 hover:border-rose-700/60 shadow-lg shadow-rose-950/10'
                  : diag.severity === 'warning'
                  ? 'bg-slate-900 border-amber-900/40 hover:border-amber-700/60 shadow-lg shadow-amber-950/10'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm'
              }`}
            >
              <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                {/* Left Side: Finding & Evidence */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Severity Pill */}
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border flex items-center gap-1 ${
                        diag.severity === 'critical'
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : diag.severity === 'warning'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                      }`}
                    >
                      {diag.severity === 'critical' && <ShieldAlert className="w-3 h-3 text-rose-400" />}
                      {diag.severity === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                      {diag.severity}
                    </span>

                    {/* Category */}
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                      {diag.category.toUpperCase()}
                    </span>

                    {/* Confidence */}
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      {diag.confidence}% Confidence
                    </span>

                    {/* Status badge */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                        diag.status === 'resolved'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : diag.status === 'in_progress'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {diag.status.replace('_', ' ').toUpperCase()}
                    </span>

                    {/* HITL Review Badge */}
                    {diag.requires_human_approval && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/70 font-semibold flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-amber-400" />
                        HITL Approval Required
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-100">{diag.problem_title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{diag.problem_description}</p>

                  {/* Mathematical Evidence Card */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-1.5">
                    <div className="font-semibold text-slate-300 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Grounded Mathematical Evidence:</span>
                      </div>
                      {diag.affected_metric && (
                        <span className="text-[10px] text-indigo-400 font-mono">
                          Metric: {diag.affected_metric}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-slate-400 text-[11px] leading-relaxed">
                      {diag.evidence}
                    </div>
                    {diag.source_data && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-800/50">
                        <Database className="w-3 h-3 text-cyan-400" />
                        <span>Source: {diag.source_data}</span>
                      </div>
                    )}
                  </div>

                  {/* Recommended Prescription */}
                  <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs space-y-1">
                    <div className="font-bold text-indigo-200 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
                      Prescribed Action:
                    </div>
                    <div className="text-slate-200 leading-relaxed font-medium">
                      {diag.recommended_action}
                    </div>
                  </div>
                </div>

                {/* Right Side: Expected KPI & Execution Actions */}
                <div className="w-full lg:w-64 shrink-0 flex flex-col justify-between p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-4">
                  <div>
                    <div className="text-[11px] text-slate-400">Expected Outcome Uplift:</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{diag.expected_kpi}</span>
                    </div>

                    <div className="mt-3 text-[11px] text-slate-400">Effort Level:</div>
                    <div className="text-xs font-medium text-slate-300 capitalize">
                      {diag.effort.replace('_', ' ')}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    {diag.status !== 'resolved' ? (
                      <>
                        <button
                          onClick={() => handleDelegateToAgent(diag)}
                          className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Delegate to AI Agent</span>
                        </button>
                        <button
                          onClick={() => handleResolve(diag)}
                          className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark Resolved</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => updateDiagnosisStatus(diag.id, 'open')}
                        className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Re-open Finding</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
