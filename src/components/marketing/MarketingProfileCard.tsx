import React from 'react';
import {
  Building2,
  MapPin,
  Target,
  BadgePercent,
  Globe,
  Phone,
  Mail,
  CheckCircle,
  HelpCircle,
  Tag,
} from 'lucide-react';
import { Business, Product, ServiceItem, Customer } from '../../types/database';
import { getBusinessMarketingProfile } from '../../lib/marketing-engine';

interface MarketingProfileCardProps {
  business: Business;
  products: Product[];
  services: ServiceItem[];
  customers: Customer[];
}

export const MarketingProfileCard: React.FC<MarketingProfileCardProps> = ({
  business,
  products,
  services,
  customers,
}) => {
  const profile = getBusinessMarketingProfile(business, products, services, customers);
  const currSym = business.currency_symbol || '₹';

  return (
    <div
      id="marketing-profile-card"
      className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">{profile.name}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{profile.industry}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {profile.location}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            {business.business_age_stage} Stage
          </span>
        </div>

        {/* Audience & Positioning */}
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-600" />
              Target Audience (ICP)
            </div>
            <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed font-medium">
              {profile.targetAudience}
            </p>
          </div>

          {/* Pricing Band */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <BadgePercent className="w-3.5 h-3.5 text-emerald-600" />
              Verified Catalog Pricing Band
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-medium">Min Price</div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {profile.minPrice !== null ? `${currSym}${profile.minPrice.toLocaleString('en-IN')}` : 'Unset'}
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-medium">Avg Ticket</div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {profile.avgPrice !== null ? `${currSym}${profile.avgPrice.toLocaleString('en-IN')}` : 'Unset'}
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-medium">Max Price</div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {profile.maxPrice !== null ? `${currSym}${profile.maxPrice.toLocaleString('en-IN')}` : 'Unset'}
                </div>
              </div>
            </div>
          </div>

          {/* Reachability & Channels */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Verified Marketing & Outreach Channels
            </div>
            <div className="space-y-1.5">
              {profile.channels.map((ch, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70 border border-slate-100 text-xs"
                >
                  <span className="font-semibold text-slate-800">{ch.name}</span>
                  <span className="text-slate-500 text-[11px] truncate max-w-[160px]">{ch.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Business Goal Tag */}
      {profile.goals.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-600">
          <Tag className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="truncate">
            <strong className="text-slate-700">Primary Goal:</strong> {profile.goals[0]}
          </span>
        </div>
      )}
    </div>
  );
};
