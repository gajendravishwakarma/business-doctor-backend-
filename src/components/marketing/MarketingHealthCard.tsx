import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  Target,
  Package,
  Users,
  MessageSquare,
  Repeat,
  Radio,
} from 'lucide-react';
import { MarketingHealthScore, MarketingHealthFactor } from '../../types/marketing';

interface MarketingHealthCardProps {
  healthScore: MarketingHealthScore;
  onOpenCampaignBuilder?: () => void;
}

export const MarketingHealthCard: React.FC<MarketingHealthCardProps> = ({
  healthScore,
  onOpenCampaignBuilder,
}) => {
  const getCategoryIcon = (category: MarketingHealthFactor['category']) => {
    switch (category) {
      case 'audience':
        return <Target className="w-4 h-4 text-indigo-600" />;
      case 'catalog':
      case 'offer':
        return <Package className="w-4 h-4 text-emerald-600" />;
      case 'customer_data':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'leads':
        return <TrendingUp className="w-4 h-4 text-amber-600" />;
      case 'retention':
        return <Repeat className="w-4 h-4 text-purple-600" />;
      case 'campaigns':
        return <MessageSquare className="w-4 h-4 text-rose-600" />;
      case 'channels':
        return <Radio className="w-4 h-4 text-teal-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-slate-600" />;
    }
  };

  const getGradeBadge = (grade: string) => {
    if (grade === 'A+' || grade === 'A') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (grade === 'B') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (grade === 'C') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (grade === 'D') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div id="marketing-health-overview-card" className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Verified Marketing Intelligence
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
              Real-Data Grounded
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Marketing & Campaign Health</h2>
          <p className="text-sm text-slate-600 mt-0.5">{healthScore.summary}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium">Health Score</div>
              <div className="text-2xl font-black text-slate-900">
                {healthScore.hasSufficientData ? `${healthScore.overallScore}/100` : 'N/A'}
              </div>
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg border text-sm font-bold tracking-wide ${getGradeBadge(
                healthScore.grade
              )}`}
            >
              Grade {healthScore.grade}
            </div>
          </div>
        </div>
      </div>

      {/* Factors Breakdown */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Readiness & Deterministic Audit Factors ({healthScore.factors.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {healthScore.factors.map((factor) => {
            const isOptimal = factor.status === 'optimal';
            const isNeedsAttn = factor.status === 'needs_attention';
            const isInsufficient = factor.status === 'insufficient_data';

            return (
              <div
                key={factor.id}
                id={`health-factor-${factor.id}`}
                className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(factor.category)}
                      <span className="text-xs font-bold text-slate-900">{factor.name}</span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                        isOptimal
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isNeedsAttn
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : isInsufficient
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {isInsufficient ? 'No Data' : `${factor.score}%`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{factor.evidence}</p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{factor.details}</span>
                  {isOptimal ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : isNeedsAttn ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ) : (
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
