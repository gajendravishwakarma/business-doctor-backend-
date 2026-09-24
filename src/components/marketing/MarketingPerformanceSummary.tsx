import React from 'react';
import {
  TrendingUp,
  MessageSquare,
  CheckCircle,
  Play,
  Users,
  DollarSign,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Campaign, Business } from '../../types/database';
import { calculateMarketingPerformance } from '../../lib/marketing-engine';
import { formatCurrency } from '../../lib/crm-engine';

interface MarketingPerformanceSummaryProps {
  campaigns: Campaign[];
  business: Business;
}

export const MarketingPerformanceSummary: React.FC<MarketingPerformanceSummaryProps> = ({
  campaigns,
  business,
}) => {
  const perf = calculateMarketingPerformance(campaigns);
  const currSym = business.currency_symbol || '₹';

  return (
    <div id="marketing-performance-summary" className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Campaigns */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Campaigns</span>
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{perf.totalCampaigns}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{perf.draftCampaigns} drafts pending</div>
        </div>

        {/* Approved */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Approved</span>
            <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{perf.approvedCampaigns}</div>
          <div className="text-[11px] text-blue-600 font-medium mt-0.5">Ready for dispatch</div>
        </div>

        {/* Executed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Executed</span>
            <Play className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{perf.executedCampaigns}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Active / tracked</div>
        </div>

        {/* Leads Generated */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Leads Attributed</span>
            <Users className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{perf.leadsGenerated}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{perf.conversions} conversions</div>
        </div>

        {/* Revenue Attributed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Attributed Revenue</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {formatCurrency(perf.totalRevenueAttributed, currSym)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {perf.hasAttributionData
              ? 'Direct campaign conversion value'
              : 'Attribution tracking initiates upon execution'}
          </div>
        </div>
      </div>

      {/* Attribution Disclaimer if no executed campaigns with attribution exist */}
      {!perf.hasAttributionData && campaigns.length > 0 && (
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Attribution Notice:</strong> Revenue attribution metrics reflect verified conversions linked directly to campaign response channels. No fabricated statistics are displayed.
          </span>
        </div>
      )}
    </div>
  );
};
