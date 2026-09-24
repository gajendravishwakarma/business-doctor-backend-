import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Copy,
  Check,
  Send,
  Loader2,
  Package,
  Layers,
  Radio,
  FileText,
  Video,
  MessageSquare,
  Repeat,
  Calendar,
} from 'lucide-react';
import { Business, Product, ServiceItem } from '../../types/database';
import { MarketingContentType, MarketingGeneratedContent } from '../../types/marketing';
import { generateDeterministicMarketingCopy } from '../../lib/marketing-engine';
import { useBusinessStore } from '../../lib/store';

interface ContentGeneratorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business;
  products: Product[];
  services: ServiceItem[];
  onUseInCampaign: (content: MarketingGeneratedContent) => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ContentGeneratorDrawer: React.FC<ContentGeneratorDrawerProps> = ({
  isOpen,
  onClose,
  business,
  products,
  services,
  onUseInCampaign,
  onShowToast,
}) => {
  const { user } = useBusinessStore();
  const [contentType, setContentType] = useState<MarketingContentType>('whatsapp_campaign');
  const [selectedItemId, setSelectedItemId] = useState<string>(products[0]?.id || '');
  const [customAngle, setCustomAngle] = useState('');
  const [offerDetails, setOfferDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<MarketingGeneratedContent | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const selectedProd = products.find((p) => p.id === selectedItemId);
      const selectedSrv = services.find((s) => s.id === selectedItemId);
      const itemTitle = selectedProd?.name || selectedSrv?.name || products[0]?.name || 'Signature Offering';
      const itemPrice = selectedProd?.price || selectedSrv?.price || undefined;

      // Try server AI first
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
            contentType,
            productOrServiceName: itemTitle,
            price: itemPrice,
            offerDetails: offerDetails || undefined,
            topic: customAngle || undefined,
            targetAudience: business.target_customers || undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.singleDraft && data.singleDraft.body) {
            setGeneratedResult({
              type: contentType,
              title: data.singleDraft.title || `${itemTitle} - ${contentType.replace('_', ' ').toUpperCase()}`,
              hooks: data.singleDraft.hooks || [],
              body: data.singleDraft.body,
              callToAction: data.singleDraft.callToAction || 'Contact us today',
              hashtags: data.singleDraft.hashtags || [],
              suggestedVisual: data.singleDraft.suggestedVisual,
            });
            onShowToast('success', 'Generated verified marketing copy via Gemini');
            return;
          }
        }
      } catch (e) {
        // Fall back to deterministic engine
      }

      // Deterministic generation
      const deterministicCopy = generateDeterministicMarketingCopy({
        business,
        contentType,
        productOrServiceName: itemTitle,
        price: itemPrice,
        offerDetails: offerDetails || undefined,
        topic: customAngle || undefined,
      });

      setGeneratedResult(deterministicCopy);
      onShowToast('success', 'Generated grounded marketing copy');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onShowToast('success', 'Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div
        id="content-generator-drawer"
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Grounded Copy & Script Generator</h3>
              <p className="text-xs text-slate-500">
                Generate high-converting copy strictly grounded in verified {business.name} offerings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* 1. Format selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Marketing Format
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { type: 'whatsapp_campaign', label: 'WhatsApp Broadcast', icon: MessageSquare },
                { type: 'instagram_post', label: 'Instagram Caption', icon: FileText },
                { type: 'reel_script', label: '30s Reel Script', icon: Video },
                { type: 'promotional_copy', label: 'Promotional Offer', icon: Sparkles },
                { type: 'dormant_winback', label: 'Win-Back Script', icon: Repeat },
                { type: 'service_invitation', label: 'Booking Invitation', icon: Calendar },
              ].map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = contentType === fmt.type;
                return (
                  <button
                    key={fmt.type}
                    type="button"
                    onClick={() => setContentType(fmt.type as MarketingContentType)}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-2 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold leading-snug">{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Linked Offering */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Product or Service from Verified Catalog
            </label>
            <select
              id="select-generator-catalog-item"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            >
              <option value="">General Brand Overview ({business.name})</option>
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

          {/* 3. Optional Angle & Offer */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Special Offer / Incentive (Optional)
              </label>
              <input
                type="text"
                value={offerDetails}
                onChange={(e) => setOfferDetails(e.target.value)}
                placeholder="e.g. 15% Privilege on 2-Pack + Free Consultation"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Custom Angle or Theme (Optional)
              </label>
              <input
                type="text"
                value={customAngle}
                onChange={(e) => setCustomAngle(e.target.value)}
                placeholder="e.g. Monsoon Immunity, Stress Relief, Corporate Gifting"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            id="btn-trigger-content-generator"
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Grounded Copy...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Verified Copy</span>
              </>
            )}
          </button>

          {/* Generated Result Preview */}
          {generatedResult && (
            <div id="generator-result-preview" className="mt-5 p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                  {generatedResult.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(generatedResult.body, 'body')}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:text-indigo-800 cursor-pointer"
                >
                  {copiedKey === 'body' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'body' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {generatedResult.hooks && generatedResult.hooks.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Visual / Audio Hooks (0-3 Seconds)
                  </div>
                  <div className="space-y-1">
                    {generatedResult.hooks.map((h, i) => (
                      <div key={i} className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 font-medium">
                        "{h}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Body */}
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Primary Copy / Script
                </div>
                <div className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                  {generatedResult.body}
                </div>
              </div>

              {/* CTA & Visual */}
              {generatedResult.callToAction && (
                <div className="text-xs text-slate-700">
                  <strong className="text-slate-900">Call to Action:</strong> {generatedResult.callToAction}
                </div>
              )}

              {generatedResult.hashtags && generatedResult.hashtags.length > 0 && (
                <div className="text-xs text-indigo-600 font-mono text-[11px]">
                  {generatedResult.hashtags.join(' ')}
                </div>
              )}

              {/* Use in Campaign button */}
              <div className="pt-2">
                <button
                  id="btn-use-copy-in-campaign"
                  type="button"
                  onClick={() => {
                    onUseInCampaign(generatedResult);
                    onClose();
                  }}
                  className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Create Campaign with this Copy</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
