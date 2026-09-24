import React from 'react';
import {
  LayoutDashboard,
  Stethoscope,
  Sparkles,
  Users,
  ShoppingBag,
  X,
  UserPlus,
  Megaphone,
  Bot,
  Zap,
  CalendarDays,
  Package,
  Receipt,
  FileSpreadsheet,
  Building2,
  Settings,
  Brain,
  FileText,
  Scissors,
  Radio,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useBusinessStore } from '../../lib/store';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentModule: string;
  onNavigate: (module: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentModule,
  onNavigate,
}) => {
  const { business } = useBusinessStore();

  const allModules = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'ai_diagnosis', label: 'AI Diagnosis', icon: Stethoscope },
    { key: 'trial', label: '5-Day Trial', icon: Sparkles },
    { key: 'business_memory', label: 'Business Memory', icon: Brain },
    { key: 'crm', label: 'CRM Overview', icon: Users },
    { key: 'leads', label: 'Leads & Funnel', icon: UserPlus },
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'orders', label: 'Orders', icon: ShoppingBag },
    { key: 'bookings', label: 'Bookings', icon: CalendarDays },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'services', label: 'Services', icon: Scissors },
    { key: 'expenses', label: 'Expenses (P&L)', icon: Receipt },
    { key: 'marketing', label: 'Marketing Hub', icon: Megaphone },
    { key: 'automations', label: 'Automations', icon: Zap },
    { key: 'ai_agents', label: 'AI Agents', icon: Bot },
    { key: 'reports', label: 'Reports & Plan', icon: FileText },
    { key: 'data', label: 'Data Import', icon: FileSpreadsheet },
    { key: 'connectors', label: 'Connectors Hub', icon: Radio },
    { key: 'business', label: 'Business Profile', icon: Building2 },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Bottom Floating Quick-Bar on Mobile */}
      <nav aria-label="Mobile Navigation Bar" className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 border-t border-slate-800 z-40 px-2 flex items-center justify-around backdrop-blur-md">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium ${
            currentModule === 'dashboard' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('ai_diagnosis')}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium ${
            currentModule === 'ai_diagnosis' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Stethoscope className="w-5 h-5" />
          <span>Doctor AI</span>
        </button>

        <button
          onClick={() => onNavigate('trial')}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium ${
            currentModule === 'trial' ? 'text-amber-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>5-Day Trial</span>
        </button>

        <button
          onClick={() => onNavigate('customers')}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium ${
            currentModule === 'customers' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>CRM</span>
        </button>

        <button
          onClick={() => onNavigate('orders')}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium ${
            currentModule === 'orders' ? 'text-indigo-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Orders</span>
        </button>
      </nav>

      {/* Slide-out Full Drawer for all 18 modules */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="w-72 bg-slate-900 border-r border-slate-800 h-full flex flex-col shadow-2xl"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100">Business Doctor AI</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{business.name}</div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {allModules.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentModule === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        onNavigate(item.key);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
            <div className="flex-1" onClick={onClose} />
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
