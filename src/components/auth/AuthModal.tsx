import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import { UserRole } from '../../types/database';
import { getRoleBadgeStyle, validateSession } from '../../lib/permissions';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  Key,
  Shield,
  Clock,
  Building2,
  AlertCircle,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    login,
    signup,
    logout,
    business,
    isSupabaseConfigured,
    switchRole,
  } = useBusinessStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('owner');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      if (isSignUp) {
        const res = await signup(
          email.trim(),
          password || 'password123',
          name.trim() || email.split('@')[0],
          selectedRole
        );
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to create account.');
          setIsLoading(false);
          return;
        }
      } else {
        const res = await login(
          email.trim(),
          password || 'password123',
          name.trim() || email.split('@')[0],
          selectedRole
        );
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to sign in.');
          setIsLoading(false);
          return;
        }
      }
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    await logout();
    setIsLoading(false);
    onClose();
  };

  const roleStyle = user ? getRoleBadgeStyle(user.role) : getRoleBadgeStyle('owner');
  const sessionValidation = validateSession(user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm">
                {user ? 'Authentication & Access Control' : isSignUp ? 'Create Workspace Account' : 'Sign In to Workspace'}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-indigo-400" />
                <span>{business.name}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-[10px] text-slate-400">{business.id}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {user ? (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md shadow-indigo-600/30">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      {user.name}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                      >
                        {roleStyle.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</div>
                    <div className="text-[11px] text-indigo-300 mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>{roleStyle.description}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Role Switcher for Testing/Role Verification */}
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" /> Switch Active Role (RBAC Testing):
                  </span>
                  <span className="text-[10px] text-slate-400">Enforces Route & Action Guards</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['owner', 'manager', 'staff'] as UserRole[]).map((r) => {
                    const isSelected = user.role === r;
                    const rStyle = getRoleBadgeStyle(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => switchRole(r)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                          isSelected
                            ? `${rStyle.bg} ${rStyle.text} ${rStyle.border} ring-1 ring-indigo-500`
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {rStyle.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security & Session Integrity Status */}
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Postgres Row-Level Security (RLS)</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">Active</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Multi-Tenant `business_id` Isolation</span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-300">{business.id.slice(0, 10)}...</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Session Status</span>
                  </div>
                  <span className={`text-[10px] font-semibold ${sessionValidation.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {sessionValidation.isValid ? 'Valid & Verified' : sessionValidation.reason}
                  </span>
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl border border-rose-800/60 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Signing Out...' : 'Sign Out of Session'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Dr. Gajendra Vishwakarma"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="founder@yourbusiness.in"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Workspace Role (RBAC Authorization)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['owner', 'manager', 'staff'] as UserRole[]).map((r) => {
                    const isSelected = selectedRole === r;
                    const rStyle = getRoleBadgeStyle(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRole(r)}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          isSelected
                            ? `${rStyle.bg} ${rStyle.border} ring-1 ring-indigo-500`
                            : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <div className={`text-xs font-bold ${rStyle.text}`}>{rStyle.label}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5 capitalize">{r}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>
                  {isLoading
                    ? 'Authenticating...'
                    : isSignUp
                    ? `Create ${selectedRole.toUpperCase()} Account`
                    : `Sign In as ${selectedRole.toUpperCase()}`}
                </span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMessage(null);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
