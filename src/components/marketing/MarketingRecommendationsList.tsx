import React from 'react';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Package,
  Clock,
  Send,
} from 'lucide-react';
import { MarketingRecommendation } from '../../types/marketing';
import { CampaignChannel, CampaignObjective } from '../../types/database';

interface MarketingRecommendationsListProps {
  recommendations: MarketingRecommendation[];
  onApplyRecommendation: (rec: MarketingRecommendation) => void;
}

export const MarketingRecommendationsList: React.FC<MarketingRecommendationsListProps> = ({
  recommendations,
  onApplyRecommendation,
}) => {
  const getObjectiveLabel = (obj: CampaignObjective) => {
    switch (obj) {
      case 'reactivate_customers':
        return 'Customer Reactivation';
      case 'increase_repeat_purchases':
        return 'Repeat Retention';
      case 'increase_sales':
        return 'VIP Growth';
      case 'promote_product':
        return 'Product Scale';
      case 'promote_service':
      case 'appointment_generation':
        return 'Service Bookings';
      case 'generate_leads':
        return 'Lead Acquisition';
      default:
        return 'Growth Campaign';
    }
  };

  const getChannelBadge = (ch: CampaignChannel) => {
    switch (ch) {
      case 'whatsapp':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'instagram':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'facebook':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'email':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div id="marketing-recommendations-section" className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            AI Campaign Recommendations & Opportunities
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Prescriptive campaign recommendations derived deterministically from verified transactions and inventory margins.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
          {recommendations.length} Active Opportunities
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200 p-6">
          <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-700">All Core Opportunities Addressed</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No critical campaign gaps detected. As new orders, leads, or dormant periods accumulate, intelligent opportunities will populate here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              id={`rec-card-${rec.id}`}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-sm hover:border-indigo-200 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                        {getObjectiveLabel(rec.objective)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border uppercase tracking-wider ${getChannelBadge(
                          rec.suggestedChannel
                        )}`}
                      >
                        {rec.suggestedChannel}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        {rec.confidence}% confidence
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{rec.title}</h4>
                  </div>
                </div>

                {/* Reason & Grounding */}
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{rec.reason}</p>

                {/* Supporting Verified Data */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Verified Evidence
                  </div>
                  {rec.supportingVerifiedData.map((dataPt, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{dataPt}</span>
                    </div>
                  ))}
                </div>

                {/* Business Impact */}
                <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900 mb-4">
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    Expected Business Impact
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">{rec.expectedBusinessImpact}</p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                  Targeting: <strong className="text-slate-700 capitalize">{rec.targetSegment.replace('_', ' ')}</strong>
                </div>
                <button
                  id={`btn-apply-rec-${rec.id}`}
                  type="button"
                  onClick={() => onApplyRecommendation(rec)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Load into Campaign Builder</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
