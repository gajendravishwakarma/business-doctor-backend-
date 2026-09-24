import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  ShoppingBag,
  Scissors,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  X,
  ExternalLink,
  Info,
  Layers,
  Phone,
  Mail,
  MapPin,
  Clock,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  MessageCircle,
} from 'lucide-react';

interface WebsiteImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialUrl?: string;
}

interface DiscoveredProduct {
  id: string;
  selected: boolean;
  name: string;
  category: string;
  price: number | string;
  sku: string;
  description: string;
  product_url?: string;
}

interface DiscoveredService {
  id: string;
  selected: boolean;
  name: string;
  category: string;
  price: number | string;
  duration_minutes: number | string;
  description: string;
}

export const WebsiteImportModal: React.FC<WebsiteImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialUrl = '',
}) => {
  const { business, commitWebsiteImport, showToast, user } = useBusinessStore();

  const [urlInput, setUrlInput] = useState(initialUrl);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Analyzed Results State
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [analyzedUrl, setAnalyzedUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [pagesAnalyzed, setPagesAnalyzed] = useState(1);
  const [confidence, setConfidence] = useState(85);
  const [unverifiedFields, setUnverifiedFields] = useState<string[]>([]);

  // Editable Review State
  const [updateProfile, setUpdateProfile] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const [productsList, setProductsList] = useState<DiscoveredProduct[]>([]);
  const [servicesList, setServicesList] = useState<DiscoveredService[]>([]);

  const [reviewTab, setReviewTab] = useState<'profile' | 'products' | 'services' | 'verification'>('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAnalyze = async (targetUrlToUse?: string) => {
    const rawUrl = (targetUrlToUse || urlInput).trim();
    if (!rawUrl) {
      setError('Please enter a website URL.');
      return;
    }

    // Basic client check
    let formattedUrl = rawUrl;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      const parsed = new URL(formattedUrl);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.endsWith('.local')
      ) {
        setError('Access to local or private network addresses is restricted.');
        return;
      }
    } catch {
      setError('Please enter a valid website address (e.g. example.com or https://example.com).');
      return;
    }

    setError(null);
    setAnalyzing(true);
    setAnalyzeStep('Resolving domain & checking safety protocols...');

    try {
      setTimeout(() => setAnalyzeStep('Fetching homepage and discovering public subpages...'), 800);
      setTimeout(() => setAnalyzeStep('Analyzing catalog offerings, services & brand metadata with Gemini AI...'), 2400);

      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user?.access_token) {
        authHeaders['Authorization'] = `Bearer ${user.access_token}`;
      }
      if (business?.id) {
        authHeaders['x-business-id'] = business.id;
      }

      const res = await fetch('/api/website/analyze', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ url: formattedUrl }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze website.');
      }

      setAnalyzedUrl(data.url);
      setDomain(data.domain);
      setPagesAnalyzed(data.pagesAnalyzed || 1);
      setConfidence(data.confidence || 85);
      setUnverifiedFields(data.unverifiedFields || []);

      // Populate Business Info
      setBusinessName(data.businessInfo?.name || '');
      setIndustry(data.businessInfo?.industry || business.industry || 'Retail & Services');
      setLocation(data.businessInfo?.location || business.location || '');
      setDescription(data.businessInfo?.description || '');
      setPhone(data.businessInfo?.phone || '');
      setEmail(data.businessInfo?.email || '');
      setBusinessHours(data.businessInfo?.business_hours || '');
      setSocialLinks(data.businessInfo?.social_links || {});

      // Populate Products
      const mappedProducts: DiscoveredProduct[] = (data.products || []).map((p: any, idx: number) => ({
        id: `p_${idx}_${Date.now()}`,
        selected: true,
        name: p.name || 'Discovered Product',
        category: p.category || 'Catalog',
        price: p.price !== null && p.price !== undefined ? p.price : 0,
        sku: p.sku || `SKU-WEB-${idx + 1}`,
        description: p.description || '',
        product_url: p.product_url || '',
      }));
      setProductsList(mappedProducts);

      // Populate Services
      const mappedServices: DiscoveredService[] = (data.services || []).map((s: any, idx: number) => ({
        id: `s_${idx}_${Date.now()}`,
        selected: true,
        name: s.name || 'Discovered Service',
        category: s.category || 'Services',
        price: s.price !== null && s.price !== undefined ? s.price : 0,
        duration_minutes: s.duration_minutes || 45,
        description: s.description || '',
      }));
      setServicesList(mappedServices);

      // Determine starting review tab based on discovered offerings
      if (mappedProducts.length > 0) {
        setReviewTab('products');
      } else if (mappedServices.length > 0) {
        setReviewTab('services');
      } else {
        setReviewTab('profile');
      }

      setAnalysisCompleted(true);
    } catch (err: any) {
      setError(err.message || 'Unable to analyze website. Please verify the URL and try again.');
    } finally {
      setAnalyzing(false);
      setAnalyzeStep('');
    }
  };

  const handleProductToggle = (id: string) => {
    setProductsList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleProductChange = (id: string, field: keyof DiscoveredProduct, val: any) => {
    setProductsList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const handleRemoveProduct = (id: string) => {
    setProductsList((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddCustomProduct = () => {
    const newP: DiscoveredProduct = {
      id: `p_new_${Date.now()}`,
      selected: true,
      name: 'New Product Item',
      category: 'General',
      price: 499,
      sku: `SKU-${productsList.length + 1}`,
      description: 'Added during review',
    };
    setProductsList((prev) => [newP, ...prev]);
  };

  const handleServiceToggle = (id: string) => {
    setServicesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleServiceChange = (id: string, field: keyof DiscoveredService, val: any) => {
    setServicesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleRemoveService = (id: string) => {
    setServicesList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddCustomService = () => {
    const newS: DiscoveredService = {
      id: `s_new_${Date.now()}`,
      selected: true,
      name: 'New Service Session',
      category: 'Services',
      price: 999,
      duration_minutes: 60,
      description: 'Added during review',
    };
    setServicesList((prev) => [newS, ...prev]);
  };

  const selectedProductsCount = productsList.filter((p) => p.selected).length;
  const selectedServicesCount = servicesList.filter((s) => s.selected).length;

  const handleConfirmImport = () => {
    setIsSubmitting(true);
    try {
      const chosenProducts = productsList
        .filter((p) => p.selected && p.name.trim().length > 0)
        .map((p) => ({
          name: p.name.trim(),
          category: p.category.trim() || 'Website Catalog',
          price: Number(p.price) || 0,
          sku: p.sku.trim() || undefined,
          description: p.description.trim(),
        }));

      const chosenServices = servicesList
        .filter((s) => s.selected && s.name.trim().length > 0)
        .map((s) => ({
          name: s.name.trim(),
          category: s.category.trim() || 'Services',
          price: Number(s.price) || 0,
          duration_minutes: Number(s.duration_minutes) || 45,
          description: s.description.trim(),
        }));

      commitWebsiteImport({
        websiteUrl: analyzedUrl || urlInput,
        domain: domain || 'Business Website',
        businessInfo: {
          name: businessName,
          industry,
          location,
          description,
          phone,
          email,
          business_hours: businessHours,
          social_links: socialLinks,
        },
        updateProfile,
        products: chosenProducts,
        services: chosenServices,
        totalDiscovered: {
          businessFields: [businessName, industry, location, description, phone, email].filter(Boolean).length,
          products: productsList.length,
          services: servicesList.length,
        },
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast('error', 'Import Failed', err.message || 'Failed to save website data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                Import from Business Website
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI Extractor
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Safely extract catalog products, service menus, and brand info into your workspace.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!analysisCompleted ? (
            /* STEP 1: Enter URL & Initiate Scan */
            <div className="space-y-6 max-w-2xl mx-auto py-4">
              <div className="space-y-2 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                  <Globe className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">Enter your official business website</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Business Doctor AI will scan your public homepage, about, products, and services pages to automatically structure your catalog taxonomy.
                </p>
              </div>

              {/* URL Input Form */}
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !analyzing) handleAnalyze();
                    }}
                    placeholder="https://yourbusiness.com"
                    disabled={analyzing}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={() => handleAnalyze()}
                  disabled={analyzing || !urlInput.trim()}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
                      <span>{analyzeStep || 'Analyzing Website...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Scan & Extract Business Data</span>
                    </>
                  )}
                </button>
              </div>

              {/* Verified Sample Presets */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Or test with sample verified public domains:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('https://blue-tokai-coffee.example.com');
                      handleAnalyze('https://en.wikipedia.org/wiki/Specialty_coffee');
                    }}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-left text-slate-300 transition-colors"
                  >
                    <div className="font-semibold text-indigo-300">Specialty Cafe & Roastery</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">Beverages, Beans, Equipment</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('https://indiranagar-wellness.example.com');
                      handleAnalyze('https://en.wikipedia.org/wiki/Ayurveda');
                    }}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-left text-slate-300 transition-colors"
                  >
                    <div className="font-semibold text-emerald-300">Wellness & Spa Center</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">Therapies, Packages, Skincare</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('https://pixelforge-studios.example.com');
                      handleAnalyze('https://en.wikipedia.org/wiki/Digital_agency');
                    }}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-left text-slate-300 transition-colors"
                  >
                    <div className="font-semibold text-amber-300">Digital Tech & Design Agency</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">Web Dev, UI/UX, Retainers</div>
                  </button>
                </div>
              </div>

              {/* Safety & SSRF Disclosure */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-slate-300">Safe Server-Side Extraction:</strong> Only public HTML and metadata from your domain are analyzed. Business Doctor AI does not bypass paywalls, private databases, or captchas, and will never fake historical sales revenue.
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: Review & Edit Discovered Data */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Top Overview Banner */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <span>{domain}</span>
                      <a
                        href={analyzedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-300 text-xs inline-flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-xs text-slate-400">
                      Analyzed {pagesAnalyzed} public pages • Extraction Confidence: {confidence}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAnalysisCompleted(false);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                  >
                    Change URL
                  </button>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex border-b border-slate-800 gap-2">
                <button
                  onClick={() => setReviewTab('profile')}
                  className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
                    reviewTab === 'profile'
                      ? 'border-indigo-500 text-indigo-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Business Profile</span>
                </button>

                <button
                  onClick={() => setReviewTab('products')}
                  className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
                    reviewTab === 'products'
                      ? 'border-indigo-500 text-indigo-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Products Catalog ({productsList.length})</span>
                  {selectedProductsCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px]">
                      {selectedProductsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setReviewTab('services')}
                  className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
                    reviewTab === 'services'
                      ? 'border-indigo-500 text-indigo-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Services Menu ({servicesList.length})</span>
                  {selectedServicesCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                      {selectedServicesCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setReviewTab('verification')}
                  className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
                    reviewTab === 'verification'
                      ? 'border-indigo-500 text-indigo-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Data Integrity Status</span>
                </button>
              </div>

              {/* TAB 1: Business Profile Review */}
              {reviewTab === 'profile' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="update_profile_toggle"
                        checked={updateProfile}
                        onChange={(e) => setUpdateProfile(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800"
                      />
                      <label htmlFor="update_profile_toggle" className="text-xs font-semibold text-indigo-200 cursor-pointer">
                        Update Business Workspace Profile with these extracted brand details
                      </label>
                    </div>
                    <span className="text-[11px] text-indigo-400 font-medium">
                      {updateProfile ? 'Will update' : 'Keep existing'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Business Name</label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Royal Chai Co."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Industry Sector</label>
                      <input
                        type="text"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="e.g. Health & Wellness"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Location
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Indiranagar, Bengaluru"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        Phone
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        Official Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. contact@domain.com"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Business Description & Value Proposition
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Extracted brand summary..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {businessHours && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Operating Hours
                      </label>
                      <input
                        type="text"
                        value={businessHours}
                        onChange={(e) => setBusinessHours(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {/* Social links discovered */}
                  {Object.keys(socialLinks).length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Discovered Social Channels
                      </label>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {socialLinks.instagram && (
                          <a
                            href={socialLinks.instagram}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-300 flex items-center gap-1.5 hover:bg-pink-500/20"
                          >
                            <Instagram className="w-3 h-3" />
                            <span>Instagram</span>
                          </a>
                        )}
                        {socialLinks.facebook && (
                          <a
                            href={socialLinks.facebook}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center gap-1.5 hover:bg-blue-500/20"
                          >
                            <Facebook className="w-3 h-3" />
                            <span>Facebook</span>
                          </a>
                        )}
                        {socialLinks.linkedin && (
                          <a
                            href={socialLinks.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 flex items-center gap-1.5 hover:bg-sky-500/20"
                          >
                            <Linkedin className="w-3 h-3" />
                            <span>LinkedIn</span>
                          </a>
                        )}
                        {socialLinks.whatsapp && (
                          <a
                            href={socialLinks.whatsapp}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 hover:bg-emerald-500/20"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Products Catalog Review */}
              {reviewTab === 'products' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">
                        Discovered Products ({productsList.length})
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Select which products to import into your workspace catalog. Edit names, prices, or categories.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = productsList.every((p) => p.selected);
                          setProductsList((prev) => prev.map((p) => ({ ...p, selected: !allSelected })));
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      >
                        {productsList.every((p) => p.selected) ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomProduct}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Product</span>
                      </button>
                    </div>
                  </div>

                  {productsList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
                      <ShoppingBag className="w-6 h-6 text-slate-500 mx-auto" />
                      <div>No public product items discovered on the website.</div>
                      <button
                        onClick={handleAddCustomProduct}
                        className="text-indigo-400 hover:underline font-semibold text-xs inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add a product item manually
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {productsList.map((prod) => (
                        <div
                          key={prod.id}
                          className={`p-3 rounded-xl border transition-all ${
                            prod.selected
                              ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                              : 'bg-slate-900/40 border-slate-800/60 opacity-60 text-slate-400'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={prod.selected}
                              onChange={() => handleProductToggle(prod.id)}
                              className="w-4 h-4 rounded mt-1 text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800"
                            />

                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                              <div className="sm:col-span-5">
                                <label className="block text-[10px] text-slate-400 mb-0.5">Product Name</label>
                                <input
                                  type="text"
                                  value={prod.name}
                                  onChange={(e) => handleProductChange(prod.id, 'name', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <label className="block text-[10px] text-slate-400 mb-0.5">Category</label>
                                <input
                                  type="text"
                                  value={prod.category}
                                  onChange={(e) => handleProductChange(prod.id, 'category', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-400 mb-0.5">Price ({business.currency_symbol})</label>
                                <input
                                  type="number"
                                  value={prod.price}
                                  onChange={(e) => handleProductChange(prod.id, 'price', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-indigo-500"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-400 mb-0.5">SKU</label>
                                <input
                                  type="text"
                                  value={prod.sku}
                                  onChange={(e) => handleProductChange(prod.id, 'sku', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 uppercase"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(prod.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors mt-4"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Services Menu Review */}
              {reviewTab === 'services' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">
                        Discovered Services & Packages ({servicesList.length})
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Select which services and treatment sessions to import into your workspace catalog.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = servicesList.every((s) => s.selected);
                          setServicesList((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      >
                        {servicesList.every((s) => s.selected) ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomService}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Service</span>
                      </button>
                    </div>
                  </div>

                  {servicesList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
                      <Scissors className="w-6 h-6 text-slate-500 mx-auto" />
                      <div>No public services or consultation menus discovered on the website.</div>
                      <button
                        onClick={handleAddCustomService}
                        className="text-emerald-400 hover:underline font-semibold text-xs inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add a service item manually
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {servicesList.map((srv) => (
                        <div
                          key={srv.id}
                          className={`p-3 rounded-xl border transition-all ${
                            srv.selected
                              ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                              : 'bg-slate-900/40 border-slate-800/60 opacity-60 text-slate-400'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={srv.selected}
                              onChange={() => handleServiceToggle(srv.id)}
                              className="w-4 h-4 rounded mt-1 text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-800"
                            />

                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                              <div className="sm:col-span-5">
                                <label className="block text-[10px] text-slate-400 mb-0.5">Service Name</label>
                                <input
                                  type="text"
                                  value={srv.name}
                                  onChange={(e) => handleServiceChange(srv.id, 'name', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <label className="block text-[10px] text-slate-400 mb-0.5">Category</label>
                                <input
                                  type="text"
                                  value={srv.category}
                                  onChange={(e) => handleServiceChange(srv.id, 'category', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-400 mb-0.5">Price ({business.currency_symbol})</label>
                                <input
                                  type="number"
                                  value={srv.price}
                                  onChange={(e) => handleServiceChange(srv.id, 'price', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-indigo-500"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-400 mb-0.5">Duration (mins)</label>
                                <input
                                  type="number"
                                  value={srv.duration_minutes}
                                  onChange={(e) => handleServiceChange(srv.id, 'duration_minutes', e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveService(srv.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors mt-4"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Data Integrity Status */}
              {reviewTab === 'verification' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 text-xs">
                    <h4 className="font-bold text-slate-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Verification & Ingestion Summary
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Selected Products</div>
                        <div className="text-base font-bold text-indigo-300 mt-1">{selectedProductsCount}</div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Selected Services</div>
                        <div className="text-base font-bold text-emerald-300 mt-1">{selectedServicesCount}</div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Profile Updates</div>
                        <div className="text-base font-bold text-slate-200 mt-1">{updateProfile ? 'Enabled' : 'Disabled'}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-[11px] font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Unverified Data (Not Ingested from Public Website)
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        The public website provides your catalog offering structure. The following internal operational metrics remain at Day-0 baseline until real CSV/POS files or live sales orders are imported:
                      </p>
                      <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
                        {unverifiedFields.map((field, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                            <span>{field}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancel
          </button>

          {analysisCompleted && (
            <button
              onClick={handleConfirmImport}
              disabled={isSubmitting || (selectedProductsCount === 0 && selectedServicesCount === 0 && !updateProfile)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Ingesting Data...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>
                    Confirm & Ingest ({selectedProductsCount + selectedServicesCount} Offerings)
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
