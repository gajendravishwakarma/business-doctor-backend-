import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Stethoscope,
  ChevronDown,
  Plus,
  Bell,
  Sparkles,
  Cloud,
  Check,
  Building2,
  Menu,
  ShieldCheck,
} from 'lucide-react';
import { AskDoctorModal } from './AskDoctorModal';
import { NotificationsModal } from './NotificationsModal';

interface HeaderProps {
  currentModule: string;
  onNavigate: (module: string) => void;
  onOpenMobileMenu: () => void;
  onStartOnboarding: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onOpenMobileMenu,
  onStartOnboarding,
  onOpenAuthModal,
}) => {
  const {
    business,
    allBusinesses,
    switchBusiness,
    user,
    agentActions,
    products,
    customers,
    isSupabaseConfigured,
    trialDays,
  } = useBusinessStore();

  const [isBizDropdownOpen, setIsBizDropdownOpen] = useState(false);
  const [isAskDoctorOpen, setIsAskDoctorOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const pendingApprovals = agentActions.filter((a) => a.status === 'pending_approval').length;
  const lowStock = products.filter((p) => p.status === 'low_stock' || p.status === 'out_of_stock').length;
  const churnRisk = customers.filter((c) => c.status === 'churn_risk').length;
  const totalAlerts = pendingApprovals + lowStock + churnRisk;

  const completedDays = trialDays.filter((d) => d.completed).length;

  return (
    <header className="h-16 bg-slate-900/95 border-b border-slate-800/80 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between backdrop-blur-md">
      {/* Left side: Mobile menu toggle + Business Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Logo on Mobile */}
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex lg:hidden items-center gap-2 cursor-pointer mr-1"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-sm">
            <Stethoscope className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
            Business Doctor
          </span>
        </div>

        {/* Business Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsBizDropdownOpen(!isBizDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-sm font-medium transition-all"
          >
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="max-w-[140px] sm:max-w-[200px] truncate">{business.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/50 hidden md:inline uppercase">
              {business.business_age_stage}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isBizDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="text-[11px] font-semibold text-slate-400 px-3 py-1.5 uppercase tracking-wider">
                Select Business Workspace
              </div>
              <div className="space-y-1 my-1">
                {allBusinesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      switchBusiness(b.id);
                      setIsBizDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      b.id === business.id
                        ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-semibold text-slate-100">{b.name}</div>
                      <div className="text-[11px] text-slate-400">{b.industry} • {b.location}</div>
                    </div>
                    {b.id === business.id && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-800 mt-1">
                <button
                  onClick={() => {
                    setIsBizDropdownOpen(false);
                    onStartOnboarding();
                  }}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Onboard New Business</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5-Day Trial Pill on Header */}
        <button
          onClick={() => onNavigate('trial')}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:border-amber-400/50 transition-colors"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>5-Day Trial: {completedDays}/5 Days</span>
        </button>
      </div>

      {/* Right side: Ask Doctor AI + Notifications + Supabase Indicator + User */}
      <div className="flex items-center gap-2.5">
        {/* Ask Doctor AI Quick Button */}
        <button
          onClick={() => setIsAskDoctorOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          <span className="hidden md:inline">Ask Business Doctor</span>
          <span className="md:hidden">Doctor AI</span>
        </button>

        {/* Supabase Status Indicator */}
        <div
          onClick={() => onNavigate('settings')}
          title={isSupabaseConfigured ? 'Connected to Supabase' : 'Offline / Local Persistence Mode (Click to configure Supabase)'}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs cursor-pointer hover:bg-slate-800 transition-colors"
        >
          <Cloud className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className={isSupabaseConfigured ? 'text-emerald-300 font-medium' : 'text-slate-400'}>
            {isSupabaseConfigured ? 'Supabase Live' : 'Local Storage'}
          </span>
        </div>

        {/* Notifications Bell */}
        <button
          onClick={() => setIsNotificationsOpen(true)}
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {totalAlerts > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900">
              {totalAlerts}
            </span>
          )}
        </button>

        {/* User Profile Avatar / Login */}
        {user ? (
          <div
            onClick={onOpenAuthModal}
            className="flex items-center gap-2 pl-2 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden xl:block text-left text-xs">
              <div className="font-semibold text-slate-200 truncate max-w-[110px]">{user.name}</div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck
                  className={`w-2.5 h-2.5 ${
                    user.role === 'owner'
                      ? 'text-emerald-400'
                      : user.role === 'manager'
                      ? 'text-indigo-400'
                      : 'text-slate-400'
                  }`}
                />{' '}
                <span className="capitalize font-medium text-slate-300">{user.role || 'Owner'}</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            Sign In
          </button>
        )}
      </div>

      {/* Interactive Modals */}
      <AskDoctorModal isOpen={isAskDoctorOpen} onClose={() => setIsAskDoctorOpen(false)} />
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigate={onNavigate}
      />
    </header>
  );
};
