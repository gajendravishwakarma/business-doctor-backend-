import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  Stethoscope,
  Sparkles,
  Brain,
  FileText,
  UserPlus,
  Users,
  Contact,
  Megaphone,
  Bot,
  Zap,
  ShoppingBag,
  CalendarDays,
  Package,
  Scissors,
  Receipt,
  BarChart3,
  FileSpreadsheet,
  Building2,
  Settings,
  Lock,
  Radio,
} from 'lucide-react';
import { useBusinessStore } from '../../lib/store';
import { canAccessRoute } from '../../lib/permissions';
import { deriveFollowUpsFromRecords } from '../../lib/crm-engine';

interface SidebarProps {
  currentModule?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onNavigate }) => {
  const { business, agentActions, diagnoses, leads, customers, followups, currentView, setCurrentView, user } =
    useBusinessStore();

  const activeKey = currentModule || currentView;
  const navigate = onNavigate || setCurrentView;
  const userRole = user?.role || 'owner';

  const pendingActionsCount = agentActions.filter((a) => a.status === 'pending_approval').length;
  const criticalDiagsCount = diagnoses.filter((d) => d.status === 'open' && d.severity === 'critical').length;
  const overdueFollowupsCount = useMemo(() => {
    const list = deriveFollowUpsFromRecords(leads, customers, followups, business.timezone);
    return list.filter((f) => f.status === 'overdue').length;
  }, [leads, customers, followups, business.timezone]);

  const navGroups = [
    {
      group: 'Intelligence & Strategy',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        {
          key: 'ai_diagnosis',
          label: 'AI Diagnosis',
          icon: Stethoscope,
          badge: criticalDiagsCount > 0 ? `${criticalDiagsCount} Alert` : undefined,
          badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
        },
        {
          key: 'trial',
          label: '5-Day Trial',
          icon: Sparkles,
          badge: 'AI OS',
          badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
        },
        { key: 'business_memory', label: 'Business Memory', icon: Brain },
        { key: 'reports', label: 'Reports & Plan', icon: FileText },
      ],
    },
    {
      group: 'Growth & CRM',
      items: [
        {
          key: 'crm',
          label: 'CRM Overview',
          icon: Users,
          badge: overdueFollowupsCount > 0 ? `${overdueFollowupsCount} Due` : undefined,
          badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
        },
        { key: 'leads', label: 'Leads & Funnel', icon: UserPlus },
        { key: 'customers', label: 'Customers 360', icon: Contact },
        { key: 'marketing', label: 'Marketing Hub', icon: Megaphone },
        {
          key: 'ai_agents',
          label: 'AI Agents',
          icon: Bot,
          badge: pendingActionsCount > 0 ? `${pendingActionsCount} Pending` : undefined,
          badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
        },
        { key: 'automations', label: 'Automations', icon: Zap },
      ],
    },
    {
      group: 'Sales & Operations',
      items: [
        { key: 'orders', label: 'Orders', icon: ShoppingBag },
        { key: 'bookings', label: 'Bookings', icon: CalendarDays },
        { key: 'products', label: 'Products', icon: Package },
        { key: 'services', label: 'Services', icon: Scissors },
        { key: 'expenses', label: 'Expenses (P&L)', icon: Receipt },
        { key: 'sales_analytics', label: 'Sales & P&L Analytics', icon: BarChart3 },
      ],
    },
    {
      group: 'Data & Foundation',
      items: [
        { key: 'data', label: 'Data Import', icon: FileSpreadsheet },
        {
          key: 'connectors',
          label: 'Connectors Hub',
          icon: Radio,
          badge: 'Phase 6',
          badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
        },
        { key: 'business', label: 'Business Profile', icon: Building2 },
        { key: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col shrink-0 h-full select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div className="overflow-hidden">
          <div className="font-bold text-sm text-slate-100 tracking-tight flex items-center gap-1.5">
            Business Doctor
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              AI
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {business.name}
          </div>
        </div>
      </div>

      {/* Nav Link Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {navGroups.map((grp, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 pb-1">
              {grp.group}
            </div>
            {grp.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeKey === item.key;
              const hasAccess = canAccessRoute(userRole, item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                      : hasAccess
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      : 'text-slate-500 hover:text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : hasAccess ? 'text-slate-400' : 'text-slate-600'}`} />
                    <span className={!hasAccess ? 'text-slate-400' : ''}>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!hasAccess && (
                      <Lock className="w-3 h-3 text-slate-500" title="Restricted to Manager / Owner" />
                    )}
                    {item.badge && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isActive
                            ? 'bg-indigo-700/80 text-indigo-100 border-indigo-500/40'
                            : item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Workspace Footer Badge */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-xs">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px]">Country: {business.country}</span>
          <span className="text-[11px] font-mono text-emerald-400 font-semibold">
            {business.currency} ({business.currency_symbol})
          </span>
        </div>
      </div>
    </aside>
  );
};
