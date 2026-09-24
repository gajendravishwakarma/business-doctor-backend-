import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  CheckCircle2,
  Play,
  Copy,
  Trash2,
  Calendar,
  MessageSquare,
  TrendingUp,
  Tag,
  Radio,
  Clock,
  ShieldAlert,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { Campaign, CampaignStatus, CampaignChannel, Business } from '../../types/database';
import { formatCurrency } from '../../lib/crm-engine';

interface CampaignsTableProps {
  campaigns: Campaign[];
  business: Business;
  onOpenBuilder: () => void;
  onApproveCampaign: (id: string) => void;
  onExecuteCampaign: (id: string) => void;
  onDeleteCampaign: (id: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CampaignsTable: React.FC<CampaignsTableProps> = ({
  campaigns,
  business,
  onOpenBuilder,
  onApproveCampaign,
  onExecuteCampaign,
  onDeleteCampaign,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const currSym = business.currency_symbol || '₹';

  const filtered = campaigns.filter((camp) => {
    if (statusFilter !== 'all' && camp.status !== statusFilter) return false;
    if (channelFilter !== 'all' && camp.channel !== channelFilter) return false;
    if (searchQuery) {
      const q = (searchQuery || '').toLowerCase();
      const matchName = (camp.name || '').toLowerCase().includes(q);
      const matchOffer = (camp.offer || '').toLowerCase().includes(q);
      const matchSegment = (camp.target_segment || '').toLowerCase().includes(q);
      const matchChannel = (camp.channel || '').toLowerCase().includes(q);
      if (!matchName && !matchOffer && !matchSegment && !matchChannel) return false;
    }
    return true;
  });

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Draft
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Approved
          </span>
        );
      case 'executed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Play className="w-3 h-3 text-emerald-600" />
            Executed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <CheckCircle2 className="w-3 h-3 text-purple-600" />
            Completed
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            Paused
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <ShieldAlert className="w-3 h-3 text-slate-400" />
            Archived
          </span>
        );
      default:
        return null;
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

  const handleCopyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    onShowToast('success', 'Campaign message copied to clipboard');
  };

  return (
    <div id="campaigns-ledger-section" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            Campaigns Ledger ({campaigns.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage multi-channel campaigns, human governance approvals, and verified attribution metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-open-campaign-builder-header"
            type="button"
            onClick={onOpenBuilder}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-campaigns"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns, offers, segments..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Status:</span>
            <select
              id="select-filter-campaign-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="executed">Executed</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Channel Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Channel:</span>
            <select
              id="select-filter-campaign-channel"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium capitalize"
            >
              <option value="all">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 px-4">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-700">No Campaigns Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {campaigns.length === 0
              ? 'Get started by creating your first grounded marketing campaign or adopting an AI opportunity above.'
              : 'No campaigns match the current filter criteria.'}
          </p>
          {campaigns.length === 0 && (
            <button
              type="button"
              onClick={onOpenBuilder}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Campaign</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((camp) => {
            const hasAttribution = camp.metrics?.is_attribution_available;
            return (
              <div
                key={camp.id}
                id={`campaign-row-${camp.id}`}
                className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Info */}
                <div className="space-y-2 flex-1 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${getChannelBadge(
                        camp.channel
                      )}`}
                    >
                      {camp.channel}
                    </span>
                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      Target: <strong className="text-slate-800 capitalize">{camp.target_segment.replace('_', ' ')}</strong>
                    </span>
                    {getStatusBadge(camp.status)}
                    {camp.product_or_service_name && (
                      <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {camp.product_or_service_name}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900">{camp.name}</h4>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px] leading-relaxed">
                    "{camp.message_content}"
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="font-medium text-slate-700">
                      Offer: <strong className="text-slate-900">{camp.offer}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      CTA: <strong className="text-slate-700">{camp.call_to_action}</strong>
                    </span>
                    {camp.start_date && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {camp.start_date} {camp.end_date ? `to ${camp.end_date}` : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Attribution Metrics & Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0">
                  {/* Metrics Box */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-right min-w-[170px]">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                      Attribution Performance
                    </div>
                    {hasAttribution && camp.metrics ? (
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-900">
                          {formatCurrency(camp.metrics.revenue_attributed, currSym)} Revenue
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {camp.metrics.leads_generated} leads • {camp.metrics.conversions} conversions
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">
                        {camp.status === 'executed'
                          ? 'Tracking in progress'
                          : 'Attribution pending execution'}
                      </div>
                    )}
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex items-center gap-2">
                    {camp.status === 'draft' && (
                      <button
                        id={`btn-approve-camp-${camp.id}`}
                        type="button"
                        onClick={() => onApproveCampaign(camp.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer"
                        title="Approve for scheduled dispatch"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}

                    {camp.status === 'approved' && (
                      <button
                        id={`btn-execute-camp-${camp.id}`}
                        type="button"
                        onClick={() => onExecuteCampaign(camp.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
                        title="Mark as executed"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Mark Executed</span>
                      </button>
                    )}

                    <button
                      id={`btn-copy-camp-${camp.id}`}
                      type="button"
                      onClick={() => handleCopyMessage(camp.message_content)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Copy Message Text"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`btn-delete-camp-${camp.id}`}
                      type="button"
                      onClick={() => onDeleteCampaign(camp.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
