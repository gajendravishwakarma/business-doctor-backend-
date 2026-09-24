import React, { useState, useEffect } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  getSupabaseClient,
} from '../../lib/supabase';
import {
  Settings,
  Building2,
  Database,
  Download,
  RotateCcw,
  Shield,
  CheckCircle2,
  Save,
  AlertTriangle,
  IndianRupee,
  RefreshCw,
  Key,
  Link,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Radio,
} from 'lucide-react';
import { ConnectorsView } from './ConnectorsView';

export const SettingsView: React.FC = () => {
  const {
    business,
    updateBusinessProfile,
    auditLogs,
    resetToSampleData,
    syncToSupabase,
    fetchFromSupabase,
    isSyncing,
    showToast,
    customers,
    orders,
    products,
    expenses,
    leads,
    integrations,
  } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'connectors' | 'supabase' | 'audit'>('profile');

  const [name, setName] = useState(business.name);
  const [industry, setIndustry] = useState(business.industry);
  const [location, setLocation] = useState(business.location);
  const [monthlyRevenue, setMonthlyRevenue] = useState(business.monthly_revenue);
  const [targetMargin, setTargetMargin] = useState(business.target_gross_margin);
  const [currencySymbol, setCurrencySymbol] = useState(business.currency_symbol);

  // Supabase connection state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tablesAccessible?: string[];
    authReady?: boolean;
  } | null>(null);

  useEffect(() => {
    const config = getStoredSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseAnonKey(config.anonKey);
    if (config.url && config.anonKey) {
      testSupabaseConnection(config.url, config.anonKey).then(setTestResult);
    }
  }, []);

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setIsTestingConnection(true);
    const res = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
    setIsTestingConnection(false);
    setTestResult(res);

    if (res.success) {
      showToast('success', 'Supabase credentials saved and verified!');
      fetchFromSupabase();
    } else {
      showToast('error', `Connection error: ${res.message}`);
    }
  };

  const handleTestOnly = async () => {
    setIsTestingConnection(true);
    const res = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
    setIsTestingConnection(false);
    setTestResult(res);
    if (res.success) {
      showToast('success', res.message);
    } else {
      showToast('error', res.message);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusinessProfile({
      name,
      industry,
      location,
      monthly_revenue: Number(monthlyRevenue) || 0,
      target_gross_margin: Number(targetMargin) || 55,
      currency_symbol: currencySymbol,
    });
    showToast('success', 'Business settings updated successfully!');
  };

  const handleExportJSON = () => {
    const fullBackup = {
      business,
      customers,
      leads,
      orders,
      products,
      expenses,
      export_date: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${business.name.replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('success', 'Backup exported successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Operating System Configuration & Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Enterprise profile, currency localization, Supabase database synchronization, and data backups
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchFromSupabase()}
            disabled={isSyncing}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition-colors shrink-0 disabled:opacity-50"
            title="Pull latest live records from Supabase"
          >
            <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
            <span>Pull Remote</span>
          </button>
          <button
            onClick={() => syncToSupabase()}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Push to Cloud Database'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'profile'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Organization Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('connectors')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'connectors'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Connectors & Integrations Hub</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
            5 Channels
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('supabase')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'supabase'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Cloud Database</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Audit Trail</span>
        </button>
      </div>

      {activeTab === 'connectors' ? (
        <ConnectorsView embeddedInSettings={true} />
      ) : (
        <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Business Profile Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 pb-3 border-b border-slate-800">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Business Organization Profile
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Company / Brand Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Industry Sector</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Location / Headquarters</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Monthly Revenue Target</label>
                  <input
                    type="number"
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Target Gross Margin %</label>
                  <input
                    type="number"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </form>
          </div>

          {/* Live Supabase Connection & Credentials */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                Supabase Live Database & Cloud Authentication
              </h3>
              {testResult?.success ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-medium flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Local Cache Active
                </span>
              )}
            </div>

            <form onSubmit={handleSaveSupabaseConfig} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-slate-400" />
                  Supabase Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="url"
                  placeholder="https://your-project.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  Supabase Anon / Publishable Key (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                  }`}
                >
                  <p className="font-semibold flex items-center gap-1.5">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                    {testResult.message}
                  </p>
                  {testResult.tablesAccessible && testResult.tablesAccessible.length > 0 && (
                    <div className="mt-2 text-[11px] text-slate-300 flex flex-wrap gap-1.5">
                      <span className="font-semibold text-slate-400">Verified Tables:</span>
                      {testResult.tablesAccessible.map((tbl) => (
                        <span key={tbl} className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 font-mono text-emerald-300">
                          {tbl}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleTestOnly}
                  disabled={isTestingConnection || !supabaseUrl || !supabaseAnonKey}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-40"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                  <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isTestingConnection}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save & Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Col: Database & Backups */}
        <div className="space-y-6">
          {/* Cloud Database Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Supabase Foundation Status
            </h3>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span>Database Sync Engine:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Row Level Security (RLS):</span>
                <span className="text-indigo-300 font-medium">Enforced per Business</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Multi-Tenant Partition:</span>
                <span className="text-emerald-400 font-mono text-[11px]">{business.id}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Local Offline Fallback:</span>
                <span className="text-emerald-400 font-medium">Ready</span>
              </div>
            </div>

            <button
              onClick={handleExportJSON}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Full JSON Backup</span>
            </button>
          </div>

          {/* Reset Action */}
          <div className="bg-slate-900 border border-rose-900/30 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Workspace Reset
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reset your business workspace to factory Indian SMB benchmark demo state (Dr. Vaidya’s Ayurveda).
            </p>
            <button
              onClick={resetToSampleData}
              className="w-full py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/60 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Sample Baseline Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-800">
          <Shield className="w-4 h-4 text-indigo-400" />
          System Security & Audit Trail
        </h3>

        <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
          {auditLogs.map((log) => (
            <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">{log.action}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-400 capitalize">{log.details}</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {new Date(log.created_at).toLocaleTimeString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
};
