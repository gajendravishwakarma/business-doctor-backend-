import React from 'react';
import { useBusinessStore } from '../../lib/store';
import { Bell, AlertTriangle, UserCheck, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (moduleKey: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const { business, agentActions, products, customers } = useBusinessStore();

  const pendingActions = agentActions.filter((a) => a.status === 'pending_approval');
  const lowStock = products.filter((p) => p.status === 'low_stock' || p.status === 'out_of_stock');
  const churnRisk = customers.filter((c) => c.status === 'churn_risk');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 bg-black/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.98 }}
          className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm">Operational Alerts</div>
                <div className="text-xs text-slate-400">{business.name}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {pendingActions.length === 0 && lowStock.length === 0 && churnRisk.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                <div className="font-medium text-sm text-slate-300">All systems operating smoothly</div>
                <div className="text-xs mt-1">No urgent approval queues or critical inventory bottlenecks.</div>
              </div>
            )}

            {/* Pending Approvals */}
            {pendingActions.map((act) => (
              <div
                key={act.id}
                className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-indigo-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    Pending Agent Action ({act.agent_name})
                  </div>
                  <div className="text-slate-300 font-medium">{act.action_type}</div>
                  <div className="text-slate-400">{act.target_entity}</div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('ai_agents');
                  }}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1 transition-colors"
                >
                  <span>Review</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Low stock alerts */}
            {lowStock.map((prod) => (
              <div
                key={prod.id}
                className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    {prod.status === 'out_of_stock' ? 'Out of Stock' : 'Low Inventory Buffer'}
                  </div>
                  <div className="text-slate-200 font-medium">{prod.name}</div>
                  <div className="text-slate-400">
                    Remaining: <span className="text-rose-300 font-semibold">{prod.stock_quantity} units</span> | Reorder needed
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('products');
                  }}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-medium flex items-center gap-1 transition-colors border border-rose-700/50"
                >
                  <span>Restock</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Churn Risk */}
            {churnRisk.map((cust) => (
              <div
                key={cust.id}
                className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/40 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    Customer Churn Risk (&gt;60 days inactive)
                  </div>
                  <div className="text-slate-200 font-medium">{cust.name} ({cust.phone})</div>
                  <div className="text-slate-400">Past spend: {business.currency_symbol}{cust.total_spend}</div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('customers');
                  }}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-200 font-medium flex items-center gap-1 transition-colors border border-amber-700/50"
                >
                  <span>Winback</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
