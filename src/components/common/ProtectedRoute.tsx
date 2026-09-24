import React from 'react';
import { useBusinessStore } from '../../lib/store';
import { canAccessRoute, getRoleBadgeStyle } from '../../lib/permissions';
import { ShieldAlert, LogIn, Lock, ArrowLeft, KeyRound } from 'lucide-react';

interface ProtectedRouteProps {
  routeKey: string;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ routeKey, children }) => {
  const { user, setIsAuthModalOpen, setCurrentView } = useBusinessStore();

  const userRole = user?.role || 'owner';
  const isAuthorized = canAccessRoute(userRole, routeKey);

  if (isAuthorized) {
    return <>{children}</>;
  }

  const roleStyle = getRoleBadgeStyle(userRole);

  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center p-6 bg-slate-950">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center mx-auto text-rose-400 shadow-lg shadow-rose-950/40">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-800/50">
            <Lock className="w-3 h-3" /> Access Denied
          </div>
          <h2 className="text-xl font-bold text-slate-100">Restricted Workspace View</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your current role does not have permission to view or manage the{' '}
            <span className="font-semibold text-slate-200 capitalize">
              {routeKey.replace('_', ' ')}
            </span>{' '}
            module.
          </p>
        </div>

        {/* Current Role Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Account:</span>
            <span className="text-xs text-slate-200 font-semibold">{user?.email || 'Anonymous'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Current Role:</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
            >
              {roleStyle.label}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
            {roleStyle.description}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </button>

          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <KeyRound className="w-4 h-4" /> Switch Role / Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
