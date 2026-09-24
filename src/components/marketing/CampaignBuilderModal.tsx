import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Package,
  Calendar,
  Layers,
  Radio,
  Tag,
  MessageSquare,
  Shield,
  Loader2,
} from 'lucide-react';
import {
  Business,
  Campaign,
  CampaignChannel,
  CampaignObjective,
  Product,
  ServiceItem,
  Customer,
  Lead,
} from '../../types/database';
import { MarketingRecommendation } from '../../types/marketing';
import { generateDeterministicMarketingCopy } from '../../lib/marketing-engine';
import { useBusinessStore } from '../../lib/store';

interface CampaignBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business;
  products: Product[];
  services: ServiceItem[];
  customers: Customer[];
  leads: Lead[];
  initialRecommendation?: MarketingRecommendation | null;
  initialSegment?: { type: string; name: string } | null;
  onSaveCampaign: (campaign: Omit<Campaign, 'id' | 'business_id' | 'created_at'>, approveImmediately?: boolean) => void;
}

export const CampaignBuilderModal: React.FC<CampaignBuilderModalProps> = ({
  isOpen,
  onClose,
  business,
  products,
  services,
  customers,
  leads,
  initialRecommendation,
  initialSegment,
  onSaveCampaign,
}) => {
  const { user } = useBusinessStore();
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<CampaignObjective>('increase_sales');
  const [targetSegment, setTargetSegment] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [offer, setOffer] = useState('');
  const [channel, setChannel] = useState<CampaignChannel>('whatsapp');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize or reset form when opened
  useEffect(() => {
    if (!isOpen) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (initialRecommendation) {
      setName(initialRecommendation.title);
      setObjective(initialRecommendation.objective);
      setTargetSegment(initialRecommendation.targetSegment);
      setChannel(initialRecommendation.suggestedChannel);
      setOffer(initialRecommendation.draftOffer);
      setMessageContent(initialRecommendation.draftMessage);
      setCallToAction(initialRecommendation.suggestedCTA);
      setSelectedProductId(initialRecommendation.relatedProductId || '');
      setStartDate(todayStr);
      setEndDate(twoWeeksLater);
    } else if (initialSegment) {
      setName(`${initialSegment.name} Targeted Outreach`);
      setObjective(initialSegment.type === 'dormant' ? 'reactivate_customers' : initialSegment.type === 'recent_leads' ? 'generate_leads' : 'increase_sales');
      setTargetSegment(initialSegment.type);
      setChannel('whatsapp');
      setOffer(`Exclusive ${business.currency_symbol || '₹'}300 Privilege for ${initialSegment.name}`);
      setMessageContent(`Namaste {{name}}! A special update and exclusive privilege from ${business.name} in ${business.location}.`);
      setCallToAction('Reply to this message to claim your privilege.');
      setSelectedProductId(products[0]?.id || '');
      setStartDate(todayStr);
      setEndDate(twoWeeksLater);
    } else {
      setName('');
      setObjective('increase_sales');
      setTargetSegment('all');
      setSelectedProductId(products[0]?.id || '');
      setOffer('');
      setChannel('whatsapp');
      setStartDate(todayStr);
      setEndDate(twoWeeksLater);
      setMessageContent('');
      setCallToAction('');
    }
    setValidationError(null);
  }, [isOpen, initialRecommendation, initialSegment, business, products]);

  if (!isOpen) return null;

  const handleGenerateCopy = async () => {
    setIsGeneratingCopy(true);
    try {
      const selectedProd = products.find((p) => p.id === selectedProductId);
      const selectedSrv = services.find((s) => s.id === selectedProductId);
      const itemTitle = selectedProd?.name || selectedSrv?.name || products[0]?.name || 'Signature Offering';
      const itemPrice = selectedProd?.price || selectedSrv?.price || undefined;

      // First try Gemini server endpoint
      try {
        const authHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (user?.access_token) {
          authHeaders['Authorization'] = `Bearer ${user.access_token}`;
        }
        if (business?.id) {
          authHeaders['x-business-id'] = business.id;
        }

        const res = await fetch('/api/ai/marketing-content', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            business,
            campaignType: channel,
            contentType: channel === 'whatsapp' ? 'whatsapp_campaign' : channel === 'instagram' ? 'instagram_post' : 'facebook_post',
            goal: objective,
            targetAudience: targetSegment,
            productOrServiceName: itemTitle,
            price: itemPrice,
            offerDetails: offer || `Special privilege from ${business.name}`,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.whatsappTemplates && data.whatsappTemplates.length > 0 && channel === 'whatsapp') {
            setMessageContent(data.whatsappTemplates[0].message);
            if (!callToAction) setCallToAction('Reply to this WhatsApp message to confirm');
            return;
          }
          if (data.singleDraft && data.singleDraft.body) {
            setMessageContent(data.singleDraft.body);
            if (data.singleDraft.callToAction) setCallToAction(data.singleDraft.callToAction);
            return;
          }
        }
      } catch (e) {
        // Continue to deterministic fallback
      }

      // Deterministic fallback
      const copy = generateDeterministicMarketingCopy({
        business,
        contentType: channel === 'whatsapp' ? 'whatsapp_campaign' : channel === 'instagram' ? 'instagram_post' : 'promotional_copy',
        productOrServiceName: itemTitle,
        price: itemPrice,
        offerDetails: offer || `Special privilege on ${itemTitle}`,
        targetAudience: targetSegment,
      });

      setMessageContent(copy.body);
      if (copy.callToAction) {
        setCallToAction(copy.callToAction);
      }
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleSave = (approveImmediately = false) => {
    if (!name.trim()) {
      setValidationError('Please enter a campaign name');
      return;
    }
    if (!offer.trim()) {
      setValidationError('Please describe the promotional offer or value proposition');
      return;
    }
    if (!messageContent.trim()) {
      setValidationError('Please write the campaign message content or click "Draft AI Copy"');
      return;
    }
    if (!callToAction.trim()) {
      setValidationError('Please specify a call to action');
      return;
    }

    const selectedProd = products.find((p) => p.id === selectedProductId);
    const selectedSrv = services.find((s) => s.id === selectedProductId);

    onSaveCampaign(
      {
        name: name.trim(),
        objective,
        target_segment: targetSegment,
        product_or_service_id: selectedProductId || null,
        product_or_service_name: selectedProd?.name || selectedSrv?.name || undefined,
        offer: offer.trim(),
        channel,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        message_content: messageContent.trim(),
        call_to_action: callToAction.trim(),
        status: approveImmediately ? 'approved' : 'draft',
        approved_at: approveImmediately ? new Date().toISOString() : null,
      },
      approveImmediately
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="campaign-builder-modal"
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Campaign Builder
              </span>
              <span className="text-xs text-slate-500">• Real-Data Grounded</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Design Multi-Channel Marketing Campaign</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {validationError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. Name & Objective */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Campaign Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-campaign-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monsoon Immunity & Sleep Reset WhatsApp Broadcast"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Campaign Objective <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-campaign-objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value as CampaignObjective)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              >
                <option value="increase_sales">Increase Sales & Order Volume</option>
                <option value="reactivate_customers">Reactivate Dormant Customers (90+ Days)</option>
                <option value="increase_repeat_purchases">Boost Repeat Purchases (30-Day Cycle)</option>
                <option value="generate_leads">Generate New Inbound Inquiries</option>
                <option value="promote_product">Scale Hero / High-Margin Product</option>
                <option value="appointment_generation">Fill Mid-Week Service Bookings</option>
              </select>
            </div>
          </div>

          {/* 2. Target Segment & Channel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target CRM Audience Segment
              </label>
              <select
                id="select-campaign-segment"
                value={targetSegment}
                onChange={(e) => setTargetSegment(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              >
                <option value="all">All Verified Customers ({customers.length} records)</option>
                <option value="high_value">VIP / Top Spenders</option>
                <option value="dormant">Dormant Clients (90+ Days Inactive)</option>
                <option value="new_customers">First-Time Buyers (1 Order)</option>
                <option value="at_risk">At-Risk Accounts</option>
                <option value="recent_leads">Active Inbound Leads ({leads.length} leads)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Communication Channel <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-campaign-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as CampaignChannel)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white capitalize"
              >
                <option value="whatsapp">WhatsApp Broadcast / Direct</option>
                <option value="instagram">Instagram Feed / Story</option>
                <option value="facebook">Facebook Post / Community</option>
                <option value="email">Direct Email Newsletter</option>
                <option value="sms">SMS Text Alert</option>
              </select>
            </div>
          </div>

          {/* 3. Catalog Offering & Offer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Linked Product / Service Offering
              </label>
              <select
                id="select-campaign-product"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              >
                <option value="">General Brand Offering</option>
                {products.length > 0 && (
                  <optgroup label="Products">
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({business.currency_symbol || '₹'}{p.price})
                      </option>
                    ))}
                  </optgroup>
                )}
                {services.length > 0 && (
                  <optgroup label="Services">
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({business.currency_symbol || '₹'}{s.price})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Promotional Offer / Privilege <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-campaign-offer"
                type="text"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="e.g. Buy 2 & Get Complimentary Triphala Detox (₹450 value)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          {/* 4. Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Start Date
              </label>
              <input
                id="input-campaign-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                End Date
              </label>
              <input
                id="input-campaign-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              />
            </div>
          </div>

          {/* 5. Message Content with AI Draft Copywriter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Message & Copy Content <span className="text-rose-500">*</span>
              </label>
              <button
                id="btn-draft-ai-copy"
                type="button"
                onClick={handleGenerateCopy}
                disabled={isGeneratingCopy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 transition-colors cursor-pointer"
              >
                {isGeneratingCopy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>{isGeneratingCopy ? 'Drafting...' : '✨ Draft Grounded Copy'}</span>
              </button>
            </div>
            <textarea
              id="textarea-campaign-content"
              rows={4}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Write your campaign message here. Supports {{name}} variable tokens for personalized WhatsApp outreach."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-xs leading-relaxed"
            />
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Token: {'{{name}}'} will be dynamically replaced with the recipient's name.</span>
              <span>{messageContent.length} characters</span>
            </div>
          </div>

          {/* 6. Call to Action */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Call to Action (CTA) <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-campaign-cta"
              type="text"
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              placeholder="e.g. Reply 'ELIXIR' to confirm your order with free delivery in Bengaluru"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          {/* Safety & Human Approval Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Human Governance & Safety Assurance</div>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Campaigns default to <strong>Draft</strong> status. No automated outbound messages are sent without explicit owner approval. External marketing APIs are simulated safely in this workspace.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2.5">
            <button
              id="btn-save-campaign-draft"
              type="button"
              onClick={() => handleSave(false)}
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 active:bg-slate-200 transition-colors shadow-xs cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              id="btn-save-and-approve-campaign"
              type="button"
              onClick={() => handleSave(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Save & Approve Campaign</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
