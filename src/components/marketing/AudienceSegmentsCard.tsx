import React from 'react';
import { Users, ArrowRight, UserCheck, ShieldAlert, Sparkles, UserPlus, ShoppingBag, Clock } from 'lucide-react';
import { Customer, Lead, Order, Booking, Business } from '../../types/database';
import { getCustomerSegments, formatCurrency } from '../../lib/crm-engine';
import { CustomerSegmentType } from '../../types/crm';

interface AudienceSegmentsCardProps {
  business: Business;
  customers: Customer[];
  leads: Lead[];
  orders?: Order[];
  bookings?: Booking[];
  onSelectSegmentForCampaign: (segmentType: CustomerSegmentType, segmentName: string) => void;
}

export const AudienceSegmentsCard: React.FC<AudienceSegmentsCardProps> = ({
  business,
  customers,
  leads,
  orders = [],
  bookings = [],
  onSelectSegmentForCampaign,
}) => {
  const currSym = business.currency_symbol || '₹';
  const { summaries } = getCustomerSegments(customers, leads, orders, bookings, currSym);

  const getSegmentIcon = (type: CustomerSegmentType) => {
    switch (type) {
      case 'high_value':
        return <Sparkles className="w-4 h-4 text-amber-600" />;
      case 'repeat_customers':
        return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
      case 'new_customers':
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'dormant':
        return <Clock className="w-4 h-4 text-purple-600" />;
      case 'at_risk':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'recent_leads':
      case 'high_intent_leads':
        return <UserPlus className="w-4 h-4 text-indigo-600" />;
      default:
        return <Users className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div id="marketing-audience-segments-card" className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            CRM Audience Segments
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Targeting cohorts computed deterministically from {customers.length} customer profiles and {leads.length} leads.
          </p>
        </div>
      </div>

      {customers.length === 0 && leads.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-700">No Customer Segments Available</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Ingest customer profiles or log inbound leads to automatically unlock targeted audience segmentation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {summaries.map((seg) => {
            const hasMembers = seg.count > 0;
            return (
              <div
                key={seg.type}
                id={`audience-segment-${seg.type}`}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  hasMembers
                    ? 'bg-slate-50/70 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-xs'
                    : 'bg-slate-50/30 border-slate-100 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-xs">
                        {getSegmentIcon(seg.type)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{seg.label}</h4>
                        <span className="text-[10px] text-slate-500">
                          {seg.count} {seg.count === 1 ? 'record' : 'records'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {seg.count}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                    {seg.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    {seg.totalValue > 0 ? (
                      <span>
                        Vol: <strong className="text-slate-800">{formatCurrency(seg.totalValue, currSym)}</strong>
                      </span>
                    ) : (
                      <span>Pipeline Segment</span>
                    )}
                  </div>

                  <button
                    id={`btn-target-segment-${seg.type}`}
                    type="button"
                    onClick={() => onSelectSegmentForCampaign(seg.type, seg.label)}
                    disabled={!hasMembers}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                      hasMembers
                        ? 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer'
                        : 'text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Target</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
