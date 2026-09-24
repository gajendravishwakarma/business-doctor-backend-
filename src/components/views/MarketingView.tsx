import React, { useState, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Megaphone,
  Sparkles,
  Plus,
  Target,
  Users,
  MessageSquare,
  Repeat,
  Radio,
  FileText,
  Video,
  Layers,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  calculateMarketingHealth,
  generateMarketingRecommendations,
} from '../../lib/marketing-engine';
import { MarketingHealthCard } from '../marketing/MarketingHealthCard';
import { MarketingProfileCard } from '../marketing/MarketingProfileCard';
import { AudienceSegmentsCard } from '../marketing/AudienceSegmentsCard';
import { MarketingRecommendationsList } from '../marketing/MarketingRecommendationsList';
import { CampaignsTable } from '../marketing/CampaignsTable';
import { MarketingPerformanceSummary } from '../marketing/MarketingPerformanceSummary';
import { CampaignBuilderModal } from '../marketing/CampaignBuilderModal';
import { ContentGeneratorDrawer } from '../marketing/ContentGeneratorDrawer';
import { MarketingRecommendation, MarketingGeneratedContent } from '../../types/marketing';
import { CustomerSegmentType } from '../../types/crm';
import { Campaign } from '../../types/database';

export const MarketingView: React.FC = () => {
  const {
    business,
    metrics,
    customers,
    leads,
    products,
    services,
    orders,
    bookings,
    campaigns,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    approveCampaign,
    executeCampaign,
    showToast,
  } = useBusinessStore();

  // Modals / Drawers State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<MarketingRecommendation | null>(null);
  const [selectedSegmentTarget, setSelectedSegmentTarget] = useState<{ type: CustomerSegmentType; name: string } | null>(null);

  // Computed Intelligence
  const healthScore = useMemo(() => {
    return calculateMarketingHealth(
      business,
      metrics,
      customers,
      leads,
      products,
      services,
      campaigns
    );
  }, [business, metrics, customers, leads, products, services, campaigns]);

  const recommendations = useMemo(() => {
    return generateMarketingRecommendations(
      business,
      metrics,
      customers,
      leads,
      products,
      services,
      orders,
      bookings,
      campaigns
    );
  }, [business, metrics, customers, leads, products, services, orders, bookings, campaigns]);

  // Handlers
  const handleOpenNewCampaign = () => {
    setSelectedRecommendation(null);
    setSelectedSegmentTarget(null);
    setIsBuilderOpen(true);
  };

  const handleApplyRecommendation = (rec: MarketingRecommendation) => {
    setSelectedRecommendation(rec);
    setSelectedSegmentTarget(null);
    setIsBuilderOpen(true);
  };

  const handleSelectSegmentForCampaign = (segmentType: CustomerSegmentType, segmentName: string) => {
    setSelectedSegmentTarget({ type: segmentType, name: segmentName });
    setSelectedRecommendation(null);
    setIsBuilderOpen(true);
  };

  const handleSaveCampaign = (
    camp: Omit<Campaign, 'id' | 'business_id' | 'created_at'>,
    approveImmediately = false
  ) => {
    const newId = addCampaign(camp);
    if (approveImmediately && camp.status !== 'approved') {
      approveCampaign(newId);
    }
  };

  const handleUseCopyInCampaign = (content: MarketingGeneratedContent) => {
    setSelectedRecommendation({
      id: `custom_copy_${Date.now()}`,
      objective: 'increase_sales',
      targetSegment: 'all',
      title: content.title,
      reason: 'Drafted in Grounded Copywriter Studio based on verified catalog products.',
      supportingVerifiedData: [`Verified offering: ${content.title}`],
      confidence: 90,
      suggestedChannel: content.contentType === 'whatsapp_campaign' ? 'whatsapp' : 'instagram',
      recommendedAction: 'Review offer and schedule campaign broadcast.',
      draftOffer: 'Special verified privilege',
      draftMessage: content.body,
      suggestedCTA: content.callToAction || 'Reply to learn more',
      expectedBusinessImpact: 'Direct customer engagement and conversion uplift.',
    });
    setSelectedSegmentTarget(null);
    setIsBuilderOpen(true);
  };

  return (
    <div id="marketing-hub-view" className="space-y-6 pb-12">
      {/* 1. View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Autonomous Marketing Hub
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Multi-tenant isolated for {business.name}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-indigo-600" />
            Marketing Hub & Campaign Intelligence
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Translate verified business memory, catalog pricing, and customer segments into high-converting campaigns with human approval governance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-open-copy-generator"
            type="button"
            onClick={() => setIsGeneratorOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Copywriter Studio</span>
          </button>

          <button
            id="btn-create-campaign-top"
            type="button"
            onClick={handleOpenNewCampaign}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* 2. Marketing Performance Summary KPIs */}
      <MarketingPerformanceSummary campaigns={campaigns} business={business} />

      {/* 3. Marketing Health & Business Positioning Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MarketingHealthCard
            healthScore={healthScore}
            onOpenCampaignBuilder={handleOpenNewCampaign}
          />
        </div>
        <div>
          <MarketingProfileCard
            business={business}
            products={products}
            services={services}
            customers={customers}
          />
        </div>
      </div>

      {/* 4. CRM Audience Cohorts */}
      <AudienceSegmentsCard
        business={business}
        customers={customers}
        leads={leads}
        orders={orders}
        bookings={bookings}
        onSelectSegmentForCampaign={handleSelectSegmentForCampaign}
      />

      {/* 5. Grounded Campaign Recommendations */}
      <MarketingRecommendationsList
        recommendations={recommendations}
        onApplyRecommendation={handleApplyRecommendation}
      />

      {/* 6. Campaigns Table & Management */}
      <CampaignsTable
        campaigns={campaigns}
        business={business}
        onOpenBuilder={handleOpenNewCampaign}
        onApproveCampaign={approveCampaign}
        onExecuteCampaign={executeCampaign}
        onDeleteCampaign={deleteCampaign}
        onShowToast={showToast}
      />

      {/* Modals & Drawers */}
      <CampaignBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        business={business}
        products={products}
        services={services}
        customers={customers}
        leads={leads}
        initialRecommendation={selectedRecommendation}
        initialSegment={selectedSegmentTarget}
        onSaveCampaign={handleSaveCampaign}
      />

      <ContentGeneratorDrawer
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        business={business}
        products={products}
        services={services}
        onUseInCampaign={handleUseCopyInCampaign}
        onShowToast={showToast}
      />
    </div>
  );
};
