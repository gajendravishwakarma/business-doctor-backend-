import React, { useState, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  getAllConnectorSpecs,
  getConnectorAdapter,
  checkConnectorCapability,
} from '../../lib/connectors/registry';
import {
  ConnectorProviderId,
  ConnectorProviderSpec,
  ConnectorCategory,
  HealthCheckResult,
} from '../../types/connectors';
import { BusinessIntegration, ConnectorStatus } from '../../types/database';
import { LiveConnectionAssistant } from '../connectors/LiveConnectionAssistant';
import { WhatsAppEmbeddedOnboardingModal } from '../connectors/WhatsAppEmbeddedOnboardingModal';
import {
  MessageSquare,
  Facebook,
  Instagram,
  Youtube,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Key,
  Lock,
  RefreshCw,
  Sliders,
  ExternalLink,
  Eye,
  EyeOff,
  Activity,
  Check,
  Search,
  ArrowRight,
  Trash2,
  Sparkles,
  Info,
  Radio,
  Clock,
  Zap,
  Copy,
  Send,
  Smartphone,
  BookOpen,
  ChevronRight,
} from 'lucide-react';

interface ConnectorsViewProps {
  embeddedInSettings?: boolean;
}

export const ConnectorsView: React.FC<ConnectorsViewProps> = ({ embeddedInSettings = false }) => {
  const {
    business,
    integrations,
    connectIntegration,
    disconnectIntegration,
    checkIntegrationHealth,
    resetIntegration,
    showToast,
    user,
  } = useBusinessStore();

  const specs = useMemo(() => getAllConnectorSpecs(), []);

  // UI Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal states
  const [activeModalSpec, setActiveModalSpec] = useState<ConnectorProviderSpec | null>(null);
  const [disconnectModalSpec, setDisconnectModalSpec] = useState<ConnectorProviderSpec | null>(null);
  const [healthModalSpec, setHealthModalSpec] = useState<{ spec: ConnectorProviderSpec; result: HealthCheckResult } | null>(null);
  const [assistantProvider, setAssistantProvider] = useState<ConnectorProviderId | null>(null);
  const [viewWebhookEventsOpen, setViewWebhookEventsOpen] = useState<boolean>(false);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [webhookStatus, setWebhookStatus] = useState<any>(null);

  // Form states for connection modal
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [keyId, setKeyId] = useState<string>('');
  const [keySecret, setKeySecret] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [phoneNumberId, setPhoneNumberId] = useState<string>('');
  const [wabaId, setWabaId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [runningHealthId, setRunningHealthId] = useState<string | null>(null);
  const [isCheckingAll, setIsCheckingAll] = useState<boolean>(false);

  // Real WhatsApp dispatch and testing states
  const [testMessageModalOpen, setTestMessageModalOpen] = useState<boolean>(false);
  const [testRecipient, setTestRecipient] = useState<string>('+91 98765 43210');
  const [testMessage, setTestMessage] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);
  const [whatsappSetupTab, setWhatsappSetupTab] = useState<'credentials' | 'guide'>('credentials');

  // Helper to map provider to icon
  const getProviderIcon = (provider: ConnectorProviderId, className: string = 'w-5 h-5') => {
    switch (provider) {
      case 'whatsapp_business':
        return <MessageSquare className={className} />;
      case 'facebook':
        return <Facebook className={className} />;
      case 'instagram':
        return <Instagram className={className} />;
      case 'youtube':
        return <Youtube className={className} />;
      case 'razorpay':
        return <CreditCard className={className} />;
      default:
        return <Radio className={className} />;
    }
  };

  const getProviderColorClass = (provider: ConnectorProviderId) => {
    switch (provider) {
      case 'whatsapp_business':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
      case 'facebook':
        return 'text-blue-400 bg-blue-950/60 border-blue-800/60';
      case 'instagram':
        return 'text-pink-400 bg-pink-950/60 border-pink-800/60';
      case 'youtube':
        return 'text-rose-400 bg-rose-950/60 border-rose-800/60';
      case 'razorpay':
        return 'text-sky-400 bg-sky-950/60 border-sky-800/60';
      default:
        return 'text-indigo-400 bg-indigo-950/60 border-indigo-800/60';
    }
  };

  // Metrics summary
  const totalProviders = specs.length;
  const connectedCount = integrations.filter((i) => i.status === 'CONNECTED').length;
  const testModeCount = integrations.filter((i) => i.status === 'CONNECTED' && i.is_test_mode).length;
  const errorCount = integrations.filter((i) => i.status === 'ERROR' || i.status === 'ACTION_REQUIRED').length;

  // Filtered specs
  const filteredSpecs = useMemo(() => {
    return specs.filter((spec) => {
      // Category filter
      if (selectedCategory !== 'all' && spec.category !== selectedCategory) {
        return false;
      }

      // Integration status
      const targetInt = integrations.find((i) => i.provider === spec.id);
      const currentStatus: ConnectorStatus = targetInt ? targetInt.status : 'NOT_CONNECTED';

      // Status filter
      if (selectedStatus === 'connected' && currentStatus !== 'CONNECTED') return false;
      if (selectedStatus === 'not_connected' && currentStatus !== 'NOT_CONNECTED' && currentStatus !== 'DISCONNECTED') return false;
      if (selectedStatus === 'error' && currentStatus !== 'ERROR' && currentStatus !== 'ACTION_REQUIRED') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = spec.displayName.toLowerCase().includes(q);
        const matchesDesc = spec.shortDescription.toLowerCase().includes(q);
        const matchesCat = spec.category.toLowerCase().includes(q);
        const matchesCap = spec.defaultCapabilities.some((c) => c.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesCat && !matchesCap) {
          return false;
        }
      }

      return true;
    });
  }, [specs, integrations, selectedCategory, selectedStatus, searchQuery]);

  // Open Connect / Configure modal
  const handleOpenConnect = (spec: ConnectorProviderSpec) => {
    const existing = integrations.find((i) => i.provider === spec.id);
    setActiveModalSpec(spec);
    setIsTestMode(existing ? existing.is_test_mode : true);
    setKeyId(existing?.provider_account_id || '');
    setKeySecret('');
    setShowSecret(false);
    setPhoneNumberId(existing?.provider_account_id || '');
    setWabaId((existing?.metadata as any)?.waba_id || '');
  };

  // Submit Connect
  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalSpec) return;

    setIsSubmitting(true);
    try {
      const res = await connectIntegration({
        businessId: business.id,
        provider: activeModalSpec.id,
        isTestMode,
        keyId: keyId.trim() || undefined,
        keySecret: keySecret.trim() || undefined,
        accessToken: keySecret.trim() || undefined,
        phoneNumberId: phoneNumberId.trim() || undefined,
        wabaId: wabaId.trim() || undefined,
      });

      if (res.success) {
        // Register WhatsApp tenant mapping with backend server
        if (activeModalSpec.id === 'whatsapp_business' && phoneNumberId.trim()) {
          try {
            await fetch('/api/webhooks/whatsapp/register-tenant', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${user?.id || 'usr_founder'}:${business.id}:${user?.role || 'owner'}`,
                'x-business-id': business.id,
              },
              body: JSON.stringify({
                phoneNumberId: phoneNumberId.trim(),
                wabaId: wabaId.trim() || undefined,
                displayPhoneNumber: '+91 98765 43210',
                businessName: business.name,
              }),
            });
          } catch {
            // Non-blocking for offline fallback
          }
        }
        setActiveModalSpec(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dispatch a real test WhatsApp message
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim() || !testMessage.trim()) return;

    setIsSendingTest(true);
    setTestSendResult(null);
    try {
      const response = await fetch('/api/connectors/whatsapp/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-business-id': business.id,
        },
        body: JSON.stringify({
          to: testRecipient.trim(),
          message: testMessage.trim(),
          isHumanApproved: true,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTestSendResult({
          success: true,
          message: data.isSandbox
            ? 'Sandbox test message dispatched and logged successfully (Test Mode).'
            : `Live message dispatched to official Meta Cloud API! Message ID: ${data.messageId || 'wamid.xxx'}`,
          messageId: data.messageId,
        });
        showToast('success', 'WhatsApp Test Message Sent', 'Message dispatched successfully.');
      } else {
        setTestSendResult({
          success: false,
          message: data.message || 'Failed to dispatch test message via Meta API.',
        });
        showToast('error', 'Dispatch Failed', data.message || 'Could not send WhatsApp message.');
      }
    } catch (err: any) {
      setTestSendResult({
        success: false,
        message: err.message || 'Network error while contacting WhatsApp connector backend.',
      });
      showToast('error', 'Network Error', err.message);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Open Webhook Events Log modal
  const handleOpenWebhookEvents = async () => {
    setViewWebhookEventsOpen(true);
    setIsLoadingEvents(true);
    try {
      // 1. Fetch server webhook status
      const statusRes = await fetch('/api/webhooks/whatsapp/status');
      if (statusRes.ok) {
        const sData = await statusRes.json();
        setWebhookStatus(sData);
      }

      // 2. Fetch tenant events
      const res = await fetch('/api/webhooks/whatsapp/events', {
        headers: {
          Authorization: `Bearer ${user?.id || 'usr_founder'}:${business.id}:${user?.role || 'owner'}`,
          'x-business-id': business.id,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setWebhookEvents(data.events || []);
      }
    } catch (err) {
      console.warn('Could not fetch webhook events:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Execute single health check
  const handleRunHealthCheck = async (spec: ConnectorProviderSpec) => {
    setRunningHealthId(spec.id);
    try {
      const integration = integrations.find((i) => i.provider === spec.id);
      const isTest = integration ? integration.is_test_mode : true;
      const result = await checkIntegrationHealth(spec.id, isTest);
      setHealthModalSpec({ spec, result });
      showToast(
        result.status === 'healthy' ? 'success' : 'warning',
        `${spec.displayName} Health Check: ${result.status.toUpperCase()}`,
        result.message
      );
    } finally {
      setRunningHealthId(null);
    }
  };

  // Run all health checks
  const handleRunAllHealthChecks = async () => {
    setIsCheckingAll(true);
    try {
      let healthyCount = 0;
      for (const spec of specs) {
        const int = integrations.find((i) => i.provider === spec.id);
        const res = await checkIntegrationHealth(spec.id, int?.is_test_mode ?? true);
        if (res.status === 'healthy') healthyCount++;
      }
      showToast('success', 'Health Check Complete', `Verified ${healthyCount} of ${specs.length} connector adapters.`);
    } finally {
      setIsCheckingAll(false);
    }
  };

  // Confirm Disconnect
  const handleConfirmDisconnect = async () => {
    if (!disconnectModalSpec) return;
    setIsSubmitting(true);
    try {
      await disconnectIntegration({
        businessId: business.id,
        provider: disconnectModalSpec.id,
        revokeAtProvider: true,
      });
      setDisconnectModalSpec(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Radio className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-100">
              Connectors & Integrations Hub
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Phase 6 Architecture
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Enterprise channel connectors for WhatsApp Business, Facebook, Instagram, YouTube, and Razorpay Payments. 
            Isolated strictly by tenant with encrypted credential vaults and zero browser token exposure.
          </p>
        </div>

        {/* Action Header Button */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={handleOpenWebhookEvents}
            className="px-3.5 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 font-semibold text-xs flex items-center gap-2 border border-indigo-800/60 transition-colors"
            title="View inbound WhatsApp webhook events received by the backend for this business"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>WhatsApp Webhook Log</span>
          </button>

          <button
            onClick={handleRunAllHealthChecks}
            disabled={isCheckingAll}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
            title="Perform ping and diagnostic check across all registered channel adapters"
          >
            <Activity className={`w-3.5 h-3.5 text-emerald-400 ${isCheckingAll ? 'animate-pulse' : ''}`} />
            <span>{isCheckingAll ? 'Checking Adapters...' : 'Run All Health Checks'}</span>
          </button>
        </div>
      </div>

      {/* Security Architecture Guarantees Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Tenant-Scoped RLS</div>
            <div className="text-[11px] text-slate-400">Strictly isolated by business ID: <span className="font-mono text-emerald-400/90">{business.id.slice(0, 12)}</span></div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Zero-Token In Browser</div>
            <div className="text-[11px] text-slate-400">Credentials stay in secure encrypted vault; stripped on client</div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Developer Sandbox Ready</div>
            <div className="text-[11px] text-slate-400">Test automation flows safely without requiring live phone numbers</div>
          </div>
        </div>
      </div>

      {/* Metric Counters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Connectors</div>
          <div className="text-lg font-bold text-slate-100 mt-0.5">{totalProviders}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Channels</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">{connectedCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Sandbox Mode</div>
          <div className="text-lg font-bold text-amber-400 mt-0.5">{testModeCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Attention Needed</div>
          <div className={`text-lg font-bold mt-0.5 ${errorCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {errorCount}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search channels, capabilities, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
          >
            <option value="all">All Categories</option>
            <option value="messaging">Messaging & Outreach</option>
            <option value="social">Social Marketing</option>
            <option value="video">Video & Content</option>
            <option value="payments">Payments & Billing</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="connected">Connected</option>
            <option value="not_connected">Not Connected</option>
            <option value="error">Action Needed</option>
          </select>
        </div>
      </div>

      {/* Connector Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredSpecs.map((spec) => {
          const integration = integrations.find((i) => i.provider === spec.id);
          const status: ConnectorStatus = integration ? integration.status : 'NOT_CONNECTED';
          const isConnected = status === 'CONNECTED';
          const isError = status === 'ERROR' || status === 'ACTION_REQUIRED';
          const inTestMode = integration ? integration.is_test_mode : true;

          return (
            <div
              key={spec.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between ${
                isConnected
                  ? 'border-emerald-800/50 hover:border-emerald-700/60'
                  : isError
                  ? 'border-rose-800/50 hover:border-rose-700/60'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-4">
                {/* Top Row: Icon + Title + Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center border ${getProviderColorClass(
                        spec.id
                      )}`}
                    >
                      {getProviderIcon(spec.id, 'w-5 h-5')}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-slate-100">{spec.displayName}</h3>
                        {spec.isBeta && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            BETA
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 capitalize">
                        {spec.category} • {spec.authMethod.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Connected
                      </span>
                    ) : isError ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/80">
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        Action Needed
                      </span>
                    ) : status === 'DISCONNECTED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Disconnected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                        Not Connected
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed min-h-[38px]">
                  {spec.shortDescription}
                </p>

                {/* Account Details & Health (if connected or has error) */}
                {isConnected && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-[11px] text-slate-400">Account:</span>
                      <span className="font-mono text-emerald-400 text-[11px] truncate max-w-[170px]">
                        {integration?.provider_account_name || integration?.provider_account_id || 'Verified Channel'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-[11px] text-slate-400">Environment:</span>
                      <span
                        className={`text-[11px] font-semibold ${
                          inTestMode ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {inTestMode ? 'Sandbox / Test Mode' : 'Live Production'}
                      </span>
                    </div>
                    {integration?.last_health_status && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-[11px] text-slate-400">Health:</span>
                        <span
                          className={`text-[11px] font-semibold capitalize flex items-center gap-1 ${
                            integration.last_health_status === 'healthy'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {integration.last_health_status}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Notice */}
                {isError && integration?.last_error && (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-[11px] text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{integration.last_error}</span>
                  </div>
                )}

                {/* Capabilities pills */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Supported Capabilities
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {spec.defaultCapabilities.slice(0, 4).map((cap) => (
                      <span
                        key={cap}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                          isConnected
                            ? 'bg-slate-800/90 text-slate-300 border-slate-700/80'
                            : 'bg-slate-800/40 text-slate-400 border-slate-800'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        {cap.split('_').slice(1).join(' ')}
                      </span>
                    ))}
                    {spec.defaultCapabilities.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 text-slate-400 font-medium">
                        +{spec.defaultCapabilities.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Setup Progress & Live Assistant Prompt */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Setup Progress:</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        isConnected ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {isConnected ? '4/4 Completed' : '1/4 Ready'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssistantProvider(spec.id)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Need Help?</span>
                  </button>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {isConnected ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRunHealthCheck(spec)}
                        disabled={runningHealthId === spec.id}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50"
                        title="Run live health ping"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-slate-400 ${
                            runningHealthId === spec.id ? 'animate-spin' : ''
                          }`}
                        />
                        <span>Verify</span>
                      </button>

                      {spec.id === 'whatsapp_business' && (
                        <button
                          onClick={() => {
                            setTestRecipient('+91 98765 43210');
                            setTestMessage(`Hello from ${business.name}! Your WhatsApp Cloud API connection is active with Business Doctor AI.`);
                            setTestSendResult(null);
                            setTestMessageModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 border border-emerald-800/60 transition-colors"
                          title="Dispatch a real or sandbox WhatsApp test message"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Test Msg</span>
                        </button>
                      )}

                      <button
                        onClick={() => setAssistantProvider(spec.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 border border-indigo-800/60 transition-colors"
                        title="Open Live Connection Assistant"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Assistant</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenConnect(spec)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Configure</span>
                      </button>

                      <button
                        onClick={() => setDisconnectModalSpec(spec)}
                        className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors border border-transparent hover:border-rose-900/40"
                        title="Disconnect channel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <button
                      onClick={() => {
                        handleOpenConnect(spec);
                      }}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isError ? 'Retry Connection' : 'Connect Provider'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssistantProvider(spec.id)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                      title="Launch Live Connection Assistant"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isError ? 'Troubleshoot' : 'Assistant'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* WhatsApp Official Embedded Onboarding & State Machine Modal */}
      {activeModalSpec?.id === 'whatsapp_business' && (
        <WhatsAppEmbeddedOnboardingModal
          isOpen={true}
          onClose={() => setActiveModalSpec(null)}
          businessId={business.id}
          businessName={business.name}
          currentIntegration={integrations.find((i) => i.provider === 'whatsapp_business')}
          onConnected={async (integration) => {
            await connectIntegration({
              businessId: business.id,
              provider: 'whatsapp_business',
              isTestMode: integration.is_test_mode,
              authCode: 'embedded_signup_completed',
              phoneNumberId: integration.provider_account_id,
              wabaId: (integration.metadata as any)?.waba_id,
            });
            showToast(
              'success',
              'WhatsApp Connected ✓',
              `Authorized ${integration.provider_account_name || 'line'} with Meta Business Platform`
            );
          }}
          onDisconnect={async () => {
            await disconnectIntegration({
              businessId: business.id,
              provider: 'whatsapp_business',
              revokeAtProvider: true,
            });
            showToast('info', 'WhatsApp Disconnected', 'Channel removed from active routing.');
          }}
          onOpenTestMessageModal={() => {
            setTestRecipient('+91 98765 43210');
            setTestMessage(`Hello from ${business.name}! Your WhatsApp Cloud API connection is active with Business Doctor AI.`);
            setTestSendResult(null);
            setTestMessageModalOpen(true);
          }}
        />
      )}

      {/* Connection & Configuration Modal for Other Channels (Razorpay, FB, IG) */}
      {activeModalSpec && activeModalSpec.id !== 'whatsapp_business' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getProviderColorClass(
                    activeModalSpec.id
                  )}`}
                >
                  {getProviderIcon(activeModalSpec.id, 'w-5 h-5')}
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-100">
                    Connect {activeModalSpec.displayName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tenant Vault: <span className="font-mono text-indigo-400">{business.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalSpec(null)}
                className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveConnection} className="p-6 space-y-4 text-xs">
              {/* Environment Mode Switcher */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Deployment Environment Mode
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTestMode(true)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isTestMode
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Developer Sandbox</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTestMode(false)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      !isTestMode
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Live Production</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isTestMode
                    ? 'Sandbox mode simulates incoming webhooks and message dispatch without requiring real Meta/Google accounts.'
                    : 'Live Production connects to verified Cloud API endpoints using your official credentials.'}
                </p>
              </div>

              {/* Dynamic Inputs per Provider */}
              {activeModalSpec.id === 'razorpay' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Razorpay Key ID
                    </label>
                    <input
                      type="text"
                      placeholder={isTestMode ? 'rzp_test_...' : 'rzp_live_...'}
                      value={keyId}
                      onChange={(e) => setKeyId(e.target.value)}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Razorpay Key Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        placeholder="••••••••••••••••"
                        value={keySecret}
                        onChange={(e) => setKeySecret(e.target.value)}
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 pr-9 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(activeModalSpec.id === 'facebook' || activeModalSpec.id === 'instagram') && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      {activeModalSpec.id === 'facebook' ? 'Facebook Page ID' : 'Instagram Professional Account ID'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 109283748291029"
                      value={keyId}
                      onChange={(e) => setKeyId(e.target.value)}
                      required={!isTestMode}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Page Access Token
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        placeholder={isTestMode ? 'Leave blank for test token or paste token' : 'EAAG...'}
                        value={keySecret}
                        onChange={(e) => setKeySecret(e.target.value)}
                        required={!isTestMode}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 pr-9 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeModalSpec.id === 'youtube' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      YouTube Channel ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UCxxxxxxxxxxxxxxxxxxxxxx"
                      value={keyId}
                      onChange={(e) => setKeyId(e.target.value)}
                      required={!isTestMode}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      OAuth Access Token / API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        placeholder={isTestMode ? 'Leave blank for test token or paste token' : 'ya29...'}
                        value={keySecret}
                        onChange={(e) => setKeySecret(e.target.value)}
                        required={!isTestMode}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 pr-9 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Scopes to be activated */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Permissions Activated for Business Doctor AI:</span>
                </div>
                <div className="space-y-1">
                  {activeModalSpec.requiredScopes.map((scope) => (
                    <div key={scope.scope} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                      <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-300">{scope.title}:</strong> {scope.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Vault Assurance */}
              <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-[11px] text-indigo-300/90 leading-relaxed flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Client Exposure:</strong> Access tokens and API secrets are never returned to the frontend or stored unencrypted.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModalSpec(null)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isTestMode ? 'Verify & Connect Sandbox' : 'Save & Connect Live'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectModalSpec && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Disconnect {disconnectModalSpec.displayName}?
                </h3>
                <p className="text-[11px] text-slate-400">
                  Channel configuration will be deactivated
                </p>
              </div>
            </div>

            <p className="text-slate-300 leading-relaxed">
              Are you sure you want to disconnect <strong>{disconnectModalSpec.displayName}</strong> for <strong>{business.name}</strong>? 
              Automated workflows, AI agents, and speed-to-lead follow-ups using this channel will be paused until re-connected.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDisconnectModalSpec(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                Keep Connected
              </button>
              <button
                onClick={handleConfirmDisconnect}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Disconnecting...' : 'Disconnect Channel'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Health Check Details Modal */}
      {healthModalSpec && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">
                  Health Check: {healthModalSpec.spec.displayName}
                </h3>
              </div>
              <button
                onClick={() => setHealthModalSpec(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Diagnostic Status:</span>
                <span
                  className={`font-semibold capitalize flex items-center gap-1.5 ${
                    healthModalSpec.result.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {healthModalSpec.result.status}
                </span>
              </div>

              {healthModalSpec.result.latencyMs !== undefined && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Endpoint Ping Latency:</span>
                  <span className="font-mono font-semibold text-indigo-400">
                    {healthModalSpec.result.latencyMs} ms
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Timestamp:</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {new Date(healthModalSpec.result.checkedAt).toLocaleTimeString('en-IN')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 leading-relaxed">
                {healthModalSpec.result.message}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setHealthModalSpec(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Events Log Modal (Phase 6 Step 2) */}
      {viewWebhookEventsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Inbound WhatsApp Webhook Ledger</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Backend
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tenant-isolated log of Meta Cloud API incoming messages and delivery events.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewWebhookEventsOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Diagnostics Bar */}
            <div className="px-6 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-slate-400">Endpoint:</span>
                  <code className="text-slate-200 font-mono text-[11px]">/api/webhooks/whatsapp</code>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Verify Token:</span>
                  <span
                    className={`font-semibold ${
                      webhookStatus?.isVerifyTokenConfigured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {webhookStatus?.isVerifyTokenConfigured ? 'Configured' : 'Missing Env Var'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Tenant:</span>
                  <span className="text-indigo-300 font-mono text-[11px]">{business.id}</span>
                </div>
              </div>

              <button
                onClick={handleOpenWebhookEvents}
                disabled={isLoadingEvents}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Events List */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
              {isLoadingEvents ? (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  <span>Loading webhook ledger...</span>
                </div>
              ) : webhookEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-950/40 rounded-xl border border-slate-800/80 p-8">
                  <MessageSquare className="w-8 h-8 text-slate-600 mb-1" />
                  <p className="font-semibold text-slate-300">No Webhook Events Received Yet</p>
                  <p className="text-xs text-slate-500 max-w-md">
                    When Meta sends incoming messages or status callbacks to your webhook URL, they are securely parsed, validated, and recorded here for {business.name}.
                  </p>
                </div>
              ) : (
                webhookEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ev.message_type === 'status_update'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {ev.message_type === 'status_update' ? 'STATUS UPDATE' : 'INBOUND MESSAGE'}
                        </span>
                        <span className="font-semibold text-slate-200">
                          {ev.customer_name || ev.customer_phone || 'WhatsApp Sender'}
                        </span>
                        {ev.customer_phone && (
                          <span className="text-slate-500 font-mono text-[11px]">
                            ({ev.customer_phone})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(ev.received_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/70 font-mono text-[11px] leading-relaxed break-all">
                      {ev.message_payload?.text?.body ||
                        ev.message_payload?.interactive?.button_reply?.title ||
                        (ev.message_type === 'status_update'
                          ? `Delivery Status: ${ev.metadata?.status?.toUpperCase() || 'UPDATED'}`
                          : JSON.stringify(ev.message_payload))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>
                        Meta Message ID: <code className="text-indigo-400 font-mono">{ev.external_message_id}</code>
                      </span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Idempotently Processed</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Total tenant events: <strong className="text-slate-300">{webhookEvents.length}</strong>
              </span>
              <button
                onClick={() => setViewWebhookEventsOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Live Test Message Modal */}
      {testMessageModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Send WhatsApp Test Message</h3>
                  <p className="text-[11px] text-slate-400">Dispatch live or sandbox message via Meta Cloud API</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setTestMessageModalOpen(false);
                  setTestSendResult(null);
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestMessage} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Phone Number (with Country Code)
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  In Meta Developer Sandbox mode, this recipient phone number must be added to your <em>"To" phone numbers</em> in the Meta API Setup dashboard.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                />
              </div>

              {testSendResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    testSendResult.success
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                  }`}
                >
                  {testSendResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{testSendResult.success ? 'Message Dispatched' : 'Dispatch Failed'}</p>
                    <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{testSendResult.message}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setTestMessageModalOpen(false);
                    setTestSendResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors disabled:opacity-50"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Connection Assistant Modal */}
      {assistantProvider && (
        <LiveConnectionAssistant
          provider={assistantProvider}
          isOpen={!!assistantProvider}
          onClose={() => setAssistantProvider(null)}
          onOpenConnectModal={() => {
            const spec = specs.find((s) => s.id === assistantProvider);
            if (spec) {
              setAssistantProvider(null);
              handleOpenConnect(spec);
            }
          }}
        />
      )}
    </div>
  );
};
