import {
  Business,
  Campaign,
  CampaignChannel,
  CampaignObjective,
  CampaignStatus,
  Customer,
  Lead,
  Product,
  ServiceItem,
} from './database';

export interface MarketingHealthFactor {
  id: string;
  name: string;
  category: 'audience' | 'offer' | 'catalog' | 'customer_data' | 'leads' | 'retention' | 'campaigns' | 'channels';
  score: number; // 0 - 100
  weight: number;
  status: 'optimal' | 'adequate' | 'needs_attention' | 'insufficient_data';
  evidence: string;
  details: string;
  isDataSufficient: boolean;
}

export interface MarketingHealthScore {
  overallScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'Insufficient Data';
  hasSufficientData: boolean;
  insufficientDataReason?: string;
  factors: MarketingHealthFactor[];
  strengths: string[];
  gaps: string[];
  summary: string;
}

export interface MarketingRecommendation {
  id: string;
  title: string;
  objective: CampaignObjective;
  suggestedChannel: CampaignChannel;
  targetSegment: string;
  reason: string;
  supportingVerifiedData: string[];
  confidence: number; // e.g. 88
  expectedBusinessImpact: string;
  recommendedAction: string;
  draftOffer: string;
  draftMessage: string;
  suggestedCTA: string;
  relatedProductId?: string;
  relatedServiceName?: string;
}

export type MarketingContentType =
  | 'instagram_post'
  | 'facebook_post'
  | 'reel_script'
  | 'short_video_hook'
  | 'whatsapp_campaign'
  | 'promotional_copy'
  | 'customer_reactivation';

export interface MarketingContentPrompt {
  business: Business;
  contentType: MarketingContentType;
  topic?: string;
  targetAudience?: string;
  productOrServiceName?: string;
  price?: number | string;
  offerDetails?: string;
  goal?: string;
  channel?: CampaignChannel;
}

export interface MarketingGeneratedContent {
  contentType: MarketingContentType;
  title: string;
  hooks: string[];
  body: string;
  callToAction: string;
  hashtags?: string[];
  suggestedVisual?: string;
  videoScript?: Array<{ timestamp: string; visual: string; audio: string }>;
  timingRecommendation?: string;
  groundedIn: {
    businessName: string;
    productOrService?: string;
    price?: number | string;
    offer?: string;
    targetAudience?: string;
  };
}

export interface MarketingPerformanceSummary {
  totalCampaigns: number;
  draftCampaigns: number;
  approvedCampaigns: number;
  executedCampaigns: number;
  leadsGenerated: number;
  conversions: number;
  customersAcquired: number;
  totalRevenueAttributed: number;
  repeatPurchasesGenerated: number;
  reactivatedCustomers: number;
  hasAttributionData: boolean;
  attributionNote: string;
}
