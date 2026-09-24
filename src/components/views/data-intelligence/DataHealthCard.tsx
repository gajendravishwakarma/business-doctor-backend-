import React from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Users,
  ShoppingBag,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { calculateDataHealthScore, DataHealthScore } from '../../../lib/data-importer';

interface DataHealthCardProps {
  customers: any[];
  leads: any[];
  orders: any[];
  products: any[];
  services: any[];
  expenses: any[];
  dataSources: any[];
  onActionClick?: (action: string) => void;
}

export const DataHealthCard: React.FC<DataHealthCardProps> = ({
  customers,
  leads,
  orders,
  products,
  services,
  expenses,
  dataSources,
  onActionClick,
}) => {
  const health: DataHealthScore = calculateDataHealthScore({
    customers,
    leads,
    orders,
    products,
    services,
    expenses,
    dataSources,
  });

  const getTierColor = (tier: DataHealthScore['tier']) => {
    switch (tier) {
      case 'Enterprise Grade':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
      case 'Strong':
        return 'text-indigo-400 bg-indigo-950/60 border-indigo-500/40';
      case 'Moderate':
        return 'text-amber-400 bg-amber-950/60 border-amber-500/40';
      case 'Low':
      default:
        return 'text-rose-400 bg-rose-950/60 border-rose-500/40';
    }
  };

  return (
    <div id="data-health-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              Business Data Maturity & Completeness Index
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getTierColor(health.tier)}`}>
                {health.tier}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Multi-dimensional evaluation of ingested customer records, offerings catalog, sales orders, and operating expenses.
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 self-start sm:self-center">
          <span className="text-3xl font-black text-slate-100">{health.score}</span>
          <span className="text-xs font-semibold text-slate-500">/ 100 PTS</span>
        </div>
      </div>

      {/* 4-Pillar Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Customer Base */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-400" />
              Customer Base
            </span>
            <span className="font-mono font-bold text-sky-400">{health.breakdown.customerScore}/25</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-500"
              style={{ width: `${(health.breakdown.customerScore / 25) * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>{customers.length} customers</span>
            <span>{leads.length} leads</span>
          </div>
        </div>

        {/* Pillar 2: Offerings Catalog */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-indigo-400" />
              Catalog & Menus
            </span>
            <span className="font-mono font-bold text-indigo-400">{health.breakdown.catalogScore}/25</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${(health.breakdown.catalogScore / 25) * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>{products.length} products</span>
            <span>{services.length} services</span>
          </div>
        </div>

        {/* Pillar 3: Sales Orders */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Sales Orders
            </span>
            <span className="font-mono font-bold text-emerald-400">{health.breakdown.salesScore}/25</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(health.breakdown.salesScore / 25) * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>{orders.length} orders recorded</span>
          </div>
        </div>

        {/* Pillar 4: Overhead & Expenses */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              Overhead & Costs
            </span>
            <span className="font-mono font-bold text-amber-400">{health.breakdown.overheadScore}/25</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${(health.breakdown.overheadScore / 25) * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>{expenses.length} operating expenses</span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          AI Diagnosis Readiness & Recommendations
        </h4>
        <div className="space-y-2">
          {health.recommendations.map((rec, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
              <div className="mt-0.5 shrink-0">
                {health.score >= 80 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-indigo-400" />
                )}
              </div>
              <span className="leading-relaxed">{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
