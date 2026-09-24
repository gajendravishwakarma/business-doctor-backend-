import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Building2,
  Database,
  Calendar,
  DollarSign,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShoppingBag,
  Scissors,
  Layers,
  Globe,
  X,
} from 'lucide-react';
import { BusinessAgeStage, BusinessType, DataMaturityMode } from '../../types/database';
import { WebsiteImportModal } from '../views/WebsiteImportModal';

interface OnboardingFlowProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isOpen = true,
  onClose,
  onComplete,
}) => {
  const { createBusiness, setIsOnboardingOpen, setCurrentView, business } = useBusinessStore();
  const [step, setStep] = useState<number>(1);
  const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('hybrid');
  const [industry, setIndustry] = useState('Health & Wellness');
  const [location, setLocation] = useState('Bengaluru, Karnataka');
  const [country, setCountry] = useState('India');
  const [currency, setCurrency] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [businessAgeStage, setBusinessAgeStage] = useState<BusinessAgeStage>('growing');
  const [dataMaturityMode, setDataMaturityMode] = useState<DataMaturityMode>('existing_partial');
  const [targetCustomers, setTargetCustomers] = useState('');
  const [monthlyRevenueTarget, setMonthlyRevenueTarget] = useState<number>(500000);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    'Increase monthly revenue & profit margins',
    'Automate WhatsApp lead response time',
  ]);

  const industries = [
    'Health & Wellness',
    'Retail & FMCG',
    'Fashion & Apparel',
    'Restaurant, Cafe & Cloud Kitchen',
    'Coaching, Education & EdTech',
    'IT, Agency & Digital Services',
    'Home Services & Maintenance',
    'Manufacturing, B2B & Distribution',
    'Beauty, Spa & Salon',
    'Jewelry & Luxury Goods',
  ];

  const maturityModes: Array<{
    id: DataMaturityMode;
    title: string;
    description: string;
    recommendedFor: string;
  }> = [
    {
      id: 'existing_complete',
      title: '1. Existing Business + Complete Historical Data',
      description: 'You have past sales records, Tally/POS exports, customer phone lists, or full CSV spreadsheets.',
      recommendedFor: 'Established businesses with >6 months of digital records',
    },
    {
      id: 'existing_partial',
      title: '2. Existing Business + Partial Historical Data',
      description: 'You have rough WhatsApp inquiries, bank statements, or some product catalogs.',
      recommendedFor: 'Businesses transitioning from manual books or hybrid offline operations',
    },
    {
      id: 'new_no_data',
      title: '3. New Business + No Historical Data (Day 0)',
      description: 'You are launching a fresh venture or brand. AI will establish Day 0 benchmarks and early validation plans.',
      recommendedFor: 'Startups, new store openings (0-3 months)',
    },
    {
      id: 'existing_no_data',
      title: '4. Existing Business + No Historical Data',
      description: 'You have been running for years with cash/informal ledger, starting clean digital tracking today.',
      recommendedFor: 'Traditional shops, local clinics wanting a fresh AI operating system',
    },
  ];

  const ageStages: Array<{
    id: BusinessAgeStage;
    label: string;
    range: string;
    focus: string;
  }> = [
    { id: 'new', label: 'New', range: '0–3 months', focus: 'Market validation & first 50 paying customers' },
    { id: 'early', label: 'Early', range: '3–12 months', focus: 'Product-market fit & repeatable lead channels' },
    { id: 'growing', label: 'Growing', range: '1–3 years', focus: 'Scale, margin optimization & WhatsApp automation' },
    { id: 'established', label: 'Established', range: '3+ years', focus: 'LTV expansion, team delegation & profit max' },
  ];

  const availableGoals = [
    'Increase monthly revenue & profit margins',
    'Automate WhatsApp lead response time (< 2 mins)',
    'Boost repeat customer retention and reorder frequency',
    'Fix idle capacity and off-peak appointments',
    'Launch and scale high-margin hero products',
    'Eliminate stockouts and supplier inventory delays',
  ];

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsOnboardingOpen(false);
    }
  };

  const handleFinish = () => {
    if (!name.trim()) return;

    let ageMonths = 0;
    if (dataMaturityMode === 'new_no_data') {
      ageMonths = 0;
    } else if (dataMaturityMode === 'existing_no_data') {
      ageMonths = businessAgeStage === 'established' ? 36 : businessAgeStage === 'growing' ? 24 : 12;
    } else if (dataMaturityMode === 'existing_partial') {
      ageMonths = businessAgeStage === 'established' ? 36 : businessAgeStage === 'growing' ? 18 : 6;
    } else if (dataMaturityMode === 'existing_complete') {
      ageMonths = businessAgeStage === 'established' ? 48 : businessAgeStage === 'growing' ? 24 : 12;
    }

    createBusiness({
      name: name.trim(),
      business_type: businessType,
      industry,
      location,
      country,
      currency,
      currency_symbol: currencySymbol,
      timezone,
      business_age_stage: businessAgeStage,
      data_maturity_mode: dataMaturityMode,
      business_age_months: ageMonths,
      target_customers: targetCustomers || 'Local and online consumers looking for quality offerings',
      business_goals: selectedGoals,
      monthly_revenue_target: Number(monthlyRevenueTarget) || 500000,
    });

    if (onComplete) {
      onComplete();
    } else {
      setIsOnboardingOpen(false);
      setCurrentView('trial');
    }

    if (onClose) {
      onClose();
    } else {
      setIsOnboardingOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base">Business Onboarding & Setup</div>
              <div className="text-xs text-slate-400">
                Step {step} of 4 • Strategy & Data Maturity Configuration
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-1">
          <div
            className="bg-indigo-500 h-1 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Core Business Identity */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-100">Tell us about your business</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Business Doctor AI will customize all analytics, prescriptions, and marketing formats to your industry.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWebsiteModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Auto-fill from Website</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Royal Chai Co., Indiranagar Wellness, PixelForge Tech"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Industry Sector
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Business Model Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBusinessType('product')}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                        businessType === 'product'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-semibold'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Product</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBusinessType('service')}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                        businessType === 'service'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-semibold'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Scissors className="w-4 h-4" />
                      <span>Service</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBusinessType('hybrid')}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                        businessType === 'hybrid'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-semibold'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Hybrid</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Location (City, State)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Indiranagar, Bengaluru"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Country & Currency
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-2/3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="w-1/3 flex items-center bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm font-semibold text-emerald-400">
                      {currencySymbol} {currency}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Business Age & Data Maturity */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h3 className="font-bold text-lg text-slate-100">Business Age & Data Maturity Mode</h3>
                <p className="text-xs text-slate-400 mt-1">
                  The strategy engine uses business age to calibrate aggressive growth vs. stabilization tactics.
                </p>
              </div>

              {/* Business Age Stage */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  Business Age Stage
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ageStages.map((stg) => (
                    <button
                      key={stg.id}
                      type="button"
                      onClick={() => setBusinessAgeStage(stg.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        businessAgeStage === stg.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold text-xs">{stg.label}</div>
                      <div className="text-[11px] text-slate-400">{stg.range}</div>
                      <div className="text-[10px] text-indigo-300/80 mt-1 line-clamp-2">{stg.focus}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Maturity Modes (4 Modes) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  Select Historical Data Availability
                </label>
                <div className="space-y-2">
                  {maturityModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setDataMaturityMode(mode.id)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-start justify-between gap-3 transition-all ${
                        dataMaturityMode === mode.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/40'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-slate-100">{mode.title}</div>
                        <div className="text-[11px] text-slate-400 leading-relaxed">{mode.description}</div>
                        <div className="text-[10px] text-emerald-400 font-medium pt-0.5">
                          ✓ Best for: {mode.recommendedFor}
                        </div>
                      </div>
                      {dataMaturityMode === mode.id && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Goals & Target Economics */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h3 className="font-bold text-lg text-slate-100">Target Customers & Financial Goals</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Define your monthly target revenue and primary operational objectives.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Monthly Gross Revenue Target ({currencySymbol})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">{currencySymbol}</span>
                  <input
                    type="number"
                    value={monthlyRevenueTarget}
                    onChange={(e) => setMonthlyRevenueTarget(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold text-emerald-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Customer Persona
                </label>
                <textarea
                  rows={2}
                  value={targetCustomers}
                  onChange={(e) => setTargetCustomers(e.target.value)}
                  placeholder="e.g. Working women (25-45) looking for non-toxic skincare; or corporate teams needing wellness packages."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Key Growth Priorities
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableGoals.map((g, idx) => {
                    const isSelected = selectedGoals.includes(g);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleGoal(g)}
                        className={`p-3 rounded-xl border text-xs text-left flex items-start gap-2.5 transition-all ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-medium'
                            : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-md border mt-0.5 flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span className="leading-tight">{g}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Initialize */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Ready to Activate Business Doctor AI
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Your customized AI operating system is ready to launch Day 1 of the 5-Day Business Transformation Trial.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Business Name</span>
                  <span className="font-semibold text-slate-200">{name || 'Unnamed Business'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Industry & Model</span>
                  <span className="font-medium text-slate-200">{industry} ({businessType})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Location</span>
                  <span className="font-medium text-slate-200">{location}, {country}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Business Age Stage</span>
                  <span className="font-medium text-indigo-300 uppercase">{businessAgeStage}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Data Maturity Mode</span>
                  <span className="font-medium text-emerald-400">{dataMaturityMode}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Monthly Revenue Goal</span>
                  <span className="font-bold text-emerald-400">{currencySymbol}{monthlyRevenueTarget.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Day 0 Baseline Memory will be initialized</strong>. Next, you can import past CSV/POS sales records in the Data tab or start logging orders immediately.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 1 && !name.trim()) return;
                setStep(step + 1);
              }}
              disabled={step === 1 && !name.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Launch Business Doctor AI</span>
            </button>
          )}
        </div>
      </div>

      {/* Website Import Modal */}
      <WebsiteImportModal
        isOpen={isWebsiteModalOpen}
        onClose={() => setIsWebsiteModalOpen(false)}
        onSuccess={() => {
          if (business.name && !name) setName(business.name);
          if (business.industry) setIndustry(business.industry);
          if (business.location) setLocation(business.location);
        }}
      />
    </div>
  );
};
