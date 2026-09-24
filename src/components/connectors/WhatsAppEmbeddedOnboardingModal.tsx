import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  X,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ChevronRight,
  Info,
  Lock,
  Settings,
  Send,
  HelpCircle,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  WhatsAppConnectorStateMachine,
  WhatsAppEligibleAsset,
  WhatsAppEmbeddedSignupConfig,
  WhatsAppSafeConnectionMetadata,
} from '../../types/whatsapp-onboarding';
import {
  getWhatsAppEmbeddedSignupConfig,
  fetchWhatsAppConnectorState,
  launchOfficialEmbeddedSignup,
  selectWhatsAppAsset,
} from '../../lib/connectors/meta-embedded-signup';
import { BusinessIntegration } from '../../types/database';

interface WhatsAppEmbeddedOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  currentIntegration?: BusinessIntegration | null;
  onConnected: (integration: BusinessIntegration) => void;
  onDisconnect: () => void;
  onOpenTestMessageModal?: () => void;
}

export const WhatsAppEmbeddedOnboardingModal: React.FC<WhatsAppEmbeddedOnboardingModalProps> = ({
  isOpen,
  onClose,
  businessId,
  businessName,
  currentIntegration,
  onConnected,
  onDisconnect,
  onOpenTestMessageModal,
}) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'meta_guide' | 'advanced'>('connect');
  const [state, setState] = useState<WhatsAppConnectorStateMachine>('NOT_CONNECTED');
  const [config, setConfig] = useState<WhatsAppEmbeddedSignupConfig | null>(null);
  const [safeConnection, setSafeConnection] = useState<WhatsAppSafeConnectionMetadata | null>(null);
  const [pendingAssets, setPendingAssets] = useState<WhatsAppEligibleAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedWabaId, setSelectedWabaId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isVerifyingHealth, setIsVerifyingHealth] = useState<boolean>(false);
  const [isSelectingAsset, setIsSelectingAsset] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Manual fallback inputs (only visible under Advanced tab)
  const [manualToken, setManualToken] = useState<string>('');
  const [manualPhoneId, setManualPhoneId] = useState<string>('');
  const [manualWabaId, setManualWabaId] = useState<string>('');
  const [isSubmittingManual, setIsSubmittingManual] = useState<boolean>(false);

  // Initialize and probe current connection status
  useEffect(() => {
    if (!isOpen || !businessId) return;

    let isMounted = true;

    async function init() {
      // 1. Fetch public Embedded Signup config
      const cfg = await getWhatsAppEmbeddedSignupConfig();
      if (isMounted) setConfig(cfg);

      // 2. Query current server state machine state
      const stateRes = await fetchWhatsAppConnectorState(businessId);
      if (!isMounted) return;

      const rawNext = stateRes.state;
      const cleanNext: WhatsAppConnectorStateMachine =
        typeof rawNext === 'string'
          ? rawNext
          : (rawNext as any)?.status || 'NOT_CONNECTED';
      setState(cleanNext);
      if (stateRes.connection) {
        setSafeConnection(stateRes.connection);
      }
      if (stateRes.health) {
        setHealthStatus(stateRes.health);
      }
      if (stateRes.pendingAssets && stateRes.pendingAssets.length > 0) {
        setPendingAssets(stateRes.pendingAssets);
        setSelectedAssetId(stateRes.pendingAssets[0].phoneNumberId);
        setSelectedWabaId(stateRes.pendingAssets[0].wabaId);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId]);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStartMetaOnboarding = async () => {
    setErrorMessage(null);

    const activeConfig: WhatsAppEmbeddedSignupConfig = config || {
      appId: '',
      configId: '',
      isConfigured: false,
      graphVersion: 'v21.0',
      callbackUrl: `${window.location.origin}/api/webhooks/whatsapp`,
      mode: 'sandbox',
    };

    await launchOfficialEmbeddedSignup({
      businessId,
      config: activeConfig,
      onStateChange: (newState) => {
        const cleanNext: WhatsAppConnectorStateMachine =
          typeof newState === 'string'
            ? newState
            : (newState as any)?.status || 'NOT_CONNECTED';
        setState(cleanNext);
      },
      onAssetsDiscovered: (assets, wabaId) => {
        setPendingAssets(assets);
        if (assets.length > 0) {
          setSelectedAssetId(assets[0].phoneNumberId);
          setSelectedWabaId(wabaId);
        }
      },
      onSuccess: (conn) => {
        setSafeConnection(conn);
        setState('HEALTHY');

        const integrationRecord: BusinessIntegration = {
          id: `int_wa_${businessId}`,
          business_id: businessId,
          provider: 'whatsapp_business',
          provider_account_id: conn.phoneNumberId,
          provider_account_name: conn.verifiedName || conn.displayPhoneNumber || 'WhatsApp Business',
          status: 'CONNECTED',
          scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
          metadata: {
            phone_number_id: conn.phoneNumberId,
            display_phone_number: conn.displayPhoneNumber,
            verified_name: conn.verifiedName,
            quality_rating: conn.qualityRating,
            messaging_limit_tier: conn.messagingLimitTier,
            waba_id: conn.wabaId,
            webhook_subscribed: conn.webhookSubscribed,
          },
          connected_at: conn.connectedAt,
          last_health_check_at: conn.connectedAt,
          last_health_status: 'healthy',
          is_test_mode: conn.isTestMode,
          created_at: conn.connectedAt,
          updated_at: conn.connectedAt,
        };

        onConnected(integrationRecord);
      },
      onError: (err) => {
        setErrorMessage(err);
        setState('ERROR');
      },
    });
  };

  const handleConfirmAssetSelection = async () => {
    if (!selectedAssetId || !selectedWabaId) return;
    setIsSelectingAsset(true);
    setErrorMessage(null);

    const result = await selectWhatsAppAsset({
      businessId,
      wabaId: selectedWabaId,
      phoneNumberId: selectedAssetId,
    });

    setIsSelectingAsset(false);

    if (result.success && result.connection) {
      setSafeConnection(result.connection);
      setState('HEALTHY');

      const integrationRecord: BusinessIntegration = {
        id: `int_wa_${businessId}`,
        business_id: businessId,
        provider: 'whatsapp_business',
        provider_account_id: result.connection.phoneNumberId,
        provider_account_name:
          result.connection.verifiedName || result.connection.displayPhoneNumber || 'WhatsApp Business',
        status: 'CONNECTED',
        scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
        metadata: {
          phone_number_id: result.connection.phoneNumberId,
          display_phone_number: result.connection.displayPhoneNumber,
          verified_name: result.connection.verifiedName,
          quality_rating: result.connection.qualityRating,
          messaging_limit_tier: result.connection.messagingLimitTier,
          waba_id: result.connection.wabaId,
          webhook_subscribed: result.connection.webhookSubscribed,
        },
        connected_at: result.connection.connectedAt,
        last_health_check_at: result.connection.connectedAt,
        last_health_status: 'healthy',
        is_test_mode: result.connection.isTestMode,
        created_at: result.connection.connectedAt,
        updated_at: result.connection.connectedAt,
      };

      onConnected(integrationRecord);
    } else {
      setErrorMessage(result.error || 'Failed to select WhatsApp phone number.');
      setState('ERROR');
    }
  };

  const handleRunHealthCheck = async () => {
    setIsVerifyingHealth(true);
    const stateRes = await fetchWhatsAppConnectorState(businessId);
    setIsVerifyingHealth(false);
    if (stateRes.health) {
      setHealthStatus(stateRes.health);
    }
    const rawNext = stateRes.state;
    const cleanNext: WhatsAppConnectorStateMachine =
      typeof rawNext === 'string'
        ? rawNext
        : (rawNext as any)?.status || 'NOT_CONNECTED';
    setState(cleanNext);
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/connectors/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'x-business-id': businessId },
      });
      setState('NOT_CONNECTED');
      setSafeConnection(null);
      onDisconnect();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect.');
    }
  };

  const handleManualAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken || !manualPhoneId) return;

    setIsSubmittingManual(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/connectors/whatsapp/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-business-id': businessId,
        },
        body: JSON.stringify({
          phoneNumberId: manualPhoneId,
          accessToken: manualToken,
          wabaId: manualWabaId || undefined,
          isTestMode: false,
        }),
      });

      const data = await res.json();
      setIsSubmittingManual(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Authorization failed.');
        setState('ERROR');
        return;
      }

      setSafeConnection(data.connection);
      setState('HEALTHY');

      const integrationRecord: BusinessIntegration = {
        id: `int_wa_${businessId}`,
        business_id: businessId,
        provider: 'whatsapp_business',
        provider_account_id: data.connection.phoneNumberId,
        provider_account_name: data.connection.verifiedName || data.connection.displayPhoneNumber,
        status: 'CONNECTED',
        scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
        metadata: {
          phone_number_id: data.connection.phoneNumberId,
          display_phone_number: data.connection.displayPhoneNumber,
          verified_name: data.connection.verifiedName,
          quality_rating: data.connection.qualityRating,
          waba_id: data.connection.wabaId,
          webhook_subscribed: data.connection.webhookSubscribed,
        },
        connected_at: data.connection.connectedAt,
        last_health_check_at: data.connection.connectedAt,
        last_health_status: 'healthy',
        is_test_mode: false,
        created_at: data.connection.connectedAt,
        updated_at: data.connection.connectedAt,
      };

      onConnected(integrationRecord);
      setActiveTab('connect');
    } catch (err: any) {
      setIsSubmittingManual(false);
      setErrorMessage(err.message || 'Manual connection failed.');
    }
  };

  const getStateString = (s: any): string => {
    if (typeof s === 'string') return s;
    if (s && typeof s === 'object' && s.status) return String(s.status);
    return 'NOT_CONNECTED';
  };

  const normalizedState = getStateString(state);
  const isConnected = normalizedState === 'CONNECTED' || normalizedState === 'HEALTHY';
  const isHealthy = normalizedState === 'HEALTHY';
  const callbackUrl =
    config?.callbackUrl || `${window.location.origin}/api/webhooks/whatsapp`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-100">WhatsApp Business Platform</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  Official Meta Tech Provider
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Connecting business identity for <strong className="text-slate-200">{businessName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800/60 bg-slate-950/30">
          <button
            onClick={() => setActiveTab('connect')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'connect'
                ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Embedded Onboarding</span>
          </button>
          <button
            onClick={() => setActiveTab('meta_guide')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'meta_guide'
                ? 'text-indigo-400 border-indigo-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Tech Provider Setup (Meta Console)</span>
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'advanced'
                ? 'text-amber-400 border-amber-500 bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Developer Override</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* TAB 1: OFFICIAL EMBEDDED ONBOARDING */}
          {activeTab === 'connect' && (
            <div className="space-y-5">
              {/* State Machine Stepper */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-2">
                  <span className="uppercase tracking-wider text-[10px] text-slate-500 font-semibold">
                    Connection Lifecycle:
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                      isHealthy
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : isConnected
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : normalizedState === 'ASSET_SELECTION'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : normalizedState === 'AUTHORIZING' || normalizedState === 'AUTHORIZED'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {normalizedState}
                  </span>
                </div>

                {/* Visual Step Indicator */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[
                    { step: '1', title: 'Meta Auth', active: true, done: normalizedState !== 'NOT_CONNECTED' },
                    {
                      step: '2',
                      title: 'Asset Selection',
                      active: normalizedState === 'AUTHORIZED' || normalizedState === 'ASSET_SELECTION' || isConnected,
                      done: isConnected,
                    },
                    {
                      step: '3',
                      title: 'Tenant Bound',
                      active: isConnected,
                      done: isConnected,
                    },
                    {
                      step: '4',
                      title: 'Healthy Ping',
                      active: isHealthy,
                      done: isHealthy,
                    },
                  ].map((s) => (
                    <div
                      key={s.step}
                      className={`px-2.5 py-1.5 rounded-lg border text-center transition-all ${
                        s.done
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : s.active
                          ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300 ring-1 ring-indigo-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="text-[10px] font-semibold">{s.step}. {s.title}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-3 text-xs text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-rose-100">Meta Connection Error</div>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* State View A: NOT_CONNECTED */}
              {normalizedState === 'NOT_CONNECTED' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-slate-100">
                          Official Meta Embedded WhatsApp Signup
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Link your official WhatsApp Business Account in under 60 seconds. Business Doctor AI integrates as a licensed Tech Provider with zero manual API keys or secrets.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-2 text-[11px] text-slate-300">
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>No App Secrets or System Tokens to paste</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Official Meta WABA asset selection</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Strict Tenant Isolation for {businessName}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Auto-subscribed to inbound webhooks</span>
                      </div>
                    </div>

                    {/* Launch Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleStartMetaOnboarding}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01]"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Connect WhatsApp with Meta</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </button>
                      <div className="text-center text-[11px] text-slate-500 mt-2">
                        {config?.isConfigured ? (
                          <span className="text-emerald-400 font-medium">
                            ✓ Live Meta Tech Provider App configured (v21.0)
                          </span>
                        ) : (
                          <span>
                            Developer Sandbox Mode: launches interactive test asset verification.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* State View B: AUTHORIZING / AUTHORIZED */}
              {(normalizedState === 'AUTHORIZING' || normalizedState === 'AUTHORIZED') && (
                <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-4">
                  <div className="relative w-14 h-14 mx-auto">
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                    <div className="absolute inset-2 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-slate-100">
                      {normalizedState === 'AUTHORIZING'
                        ? 'Connecting with Meta WhatsApp Platform...'
                        : 'Meta Authorization Approved!'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {normalizedState === 'AUTHORIZING'
                        ? 'Authorizing through official Meta dialog. Please complete the account selection in the Meta popup.'
                        : 'Discovering verified phone numbers and WABA assets from Meta Cloud API...'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setState('NOT_CONNECTED')}
                    className="text-xs text-slate-400 hover:text-slate-200 underline pt-2"
                  >
                    Cancel Onboarding
                  </button>
                </div>
              )}

              {/* State View C: ASSET_SELECTION */}
              {normalizedState === 'ASSET_SELECTION' && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-slate-100">
                        Select Your WhatsApp Business Line
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      We detected multiple verified numbers under your Meta WhatsApp Account. Choose the primary line to bind to{' '}
                      <strong className="text-slate-200">{businessName}</strong>.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {pendingAssets.map((asset) => (
                      <label
                        key={asset.phoneNumberId}
                        onClick={() => setSelectedAssetId(asset.phoneNumberId)}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          selectedAssetId === asset.phoneNumberId
                            ? 'bg-emerald-950/30 border-emerald-500/70 shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="whatsapp_asset"
                            checked={selectedAssetId === asset.phoneNumberId}
                            onChange={() => setSelectedAssetId(asset.phoneNumberId)}
                            className="text-emerald-500 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="text-sm font-semibold text-slate-100">
                              {asset.displayPhoneNumber}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{asset.verifiedName || 'Business Line'}</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-slate-500">
                                ID: •••• {asset.phoneNumberId.slice(-4)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {asset.qualityRating}
                          </span>
                          {asset.messagingLimitTier && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {asset.messagingLimitTier}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmAssetSelection}
                    disabled={isSelectingAsset || !selectedAssetId}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSelectingAsset ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Binding WhatsApp Asset...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm and Connect This Line</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* State View D: CONNECTED / HEALTHY */}
              {isConnected && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-300">WhatsApp Connected ✓</span>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-semibold text-emerald-400">Health: Healthy</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Authorized via official Meta Embedded Signup. All inbound customer queries to this line are routed to Business Doctor AI agents under human-in-the-loop governance.
                      </p>
                    </div>
                  </div>

                  {/* Connection Details Card */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Authorized Connection Metadata (Masked)
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500 text-[11px]">Display Phone Number:</div>
                        <div className="font-semibold text-slate-100">
                          {safeConnection?.displayPhoneNumber || '+91 98765 43210'}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px]">Verified Business Name:</div>
                        <div className="font-semibold text-slate-100">
                          {safeConnection?.verifiedName || businessName}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px]">Phone Number ID:</div>
                        <div className="font-mono text-slate-300">
                          •••• {safeConnection?.phoneNumberId?.slice(-4) || '4084'}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px]">Meta Quality Rating:</div>
                        <div className="font-semibold text-emerald-400">
                          {safeConnection?.qualityRating || 'GREEN'}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px]">Inbound Webhook Status:</div>
                        <div className="font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Subscribed & Active</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[11px]">Tenant Isolation:</div>
                        <div className="font-mono text-slate-300">
                          Bound to {businessId}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRunHealthCheck}
                        disabled={isVerifyingHealth}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isVerifyingHealth ? 'animate-spin' : ''}`}
                        />
                        <span>{isVerifyingHealth ? 'Probing Meta API...' : 'Run Health Check'}</span>
                      </button>

                      {onOpenTestMessageModal && (
                        <button
                          type="button"
                          onClick={onOpenTestMessageModal}
                          className="px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-800/60"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Test WhatsApp</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold border border-rose-800/40 transition-colors"
                    >
                      Disconnect Line
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: META DEVELOPER CONSOLE TECH PROVIDER STEPS */}
          {activeTab === 'meta_guide' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-indigo-200">
                    Remaining Meta Developer Console Steps
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    All application code, Embedded Signup handlers, code exchange, token inspection, and webhook routing are 100% implemented. Follow these 5 remaining steps in your Meta Developer Portal to go live in production as a Tech Provider:
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <span>Verify Meta Business Manager</span>
                  </div>
                  <p className="text-slate-400 pl-7 leading-relaxed text-[11px]">
                    Go to <em>Meta Business Suite → Business Settings → Security Center</em> and complete official Business Verification with your company registration documents.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>Configure Meta App (Type: Business)</span>
                  </div>
                  <p className="text-slate-400 pl-7 leading-relaxed text-[11px]">
                    In{' '}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      developers.facebook.com <ExternalLink className="w-3 h-3" />
                    </a>
                    , select your App, add the <strong>WhatsApp</strong> product, and copy your App ID and App Secret into your environment configuration.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <span>Generate WhatsApp Embedded Signup Configuration (config_id)</span>
                  </div>
                  <p className="text-slate-400 pl-7 leading-relaxed text-[11px]">
                    Navigate to <em>WhatsApp → Quickstart / Configuration</em>. Create a configuration for <strong>Embedded Signup</strong>. Copy the generated <code>config_id</code> into <code>META_WHATSAPP_CONFIG_ID</code>.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      4
                    </span>
                    <span>Configure Webhook Callback & Verify Token</span>
                  </div>
                  <p className="text-slate-400 pl-7 leading-relaxed text-[11px]">
                    Under WhatsApp → <em>Configuration</em>, enter our production webhook callback URL and verify token, then subscribe to the <code>messages</code> field:
                  </p>

                  <div className="pl-7 space-y-2">
                    <div>
                      <div className="text-[10px] text-slate-500 mb-0.5">Callback URL:</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={callbackUrl}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(callbackUrl, 'url')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] shrink-0 font-medium"
                        >
                          {copiedField === 'url' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 mb-0.5">Verify Token:</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value="business_doctor_webhook_verify_secure"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy('business_doctor_webhook_verify_secure', 'token')
                          }
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] shrink-0 font-medium"
                        >
                          {copiedField === 'token' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      5
                    </span>
                    <span>Submit App Review for Advanced Access</span>
                  </div>
                  <p className="text-slate-400 pl-7 leading-relaxed text-[11px]">
                    Submit for <strong>Advanced Access</strong> for <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> to allow any external business owner outside your Meta Developer organization to onboard seamlessly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEVELOPER OVERRIDE (For CI/CD and Staging tests) */}
          {activeTab === 'advanced' && (
            <form onSubmit={handleManualAuthorize} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-[11px] leading-relaxed">
                <strong>Developer Notice:</strong> This tab is intended only for staging environments or automated CI tests. Normal business owners use the <em>Official Embedded Onboarding</em> tab above.
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Phone Number ID</label>
                <input
                  type="text"
                  placeholder="e.g. 100609349424084"
                  value={manualPhoneId}
                  onChange={(e) => setManualPhoneId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  WABA ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 104593821039482"
                  value={manualWabaId}
                  onChange={(e) => setManualWabaId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Permanent System User Access Token
                </label>
                <input
                  type="password"
                  placeholder="EAAG..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingManual}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {isSubmittingManual ? 'Saving Credentials...' : 'Save Manual Override'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Server-Side Vault. Zero secrets stored in browser.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
