import React, { useState } from 'react';
import { Customer, Order, Booking, Lead, Business } from '../../types/database';
import { buildCustomer360, normalizePhoneNumber } from '../../lib/crm-engine';
import { useBusinessStore } from '../../lib/store';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  ShoppingBag,
  Clock,
  Sparkles,
  TrendingUp,
  Tag,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Copy,
  Check,
  Send,
  ShieldCheck,
  Award,
  FileText,
  Activity,
  ArrowRight,
  ExternalLink,
  Edit2,
  Trash2,
  ChevronRight,
  Package,
  Layers,
} from 'lucide-react';
import { CRMRecommendation, CRMActivityTimelineEvent } from '../../types/crm';

interface Customer360DrawerProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (c: Customer) => void;
}

export const Customer360Drawer: React.FC<Customer360DrawerProps> = ({
  customer,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { business, orders, bookings, leads, updateCustomer, showToast, addAuditLog } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'orders' | 'recommendations' | 'notes'>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(customer.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  if (!isOpen) return null;

  const profile = buildCustomer360(customer, orders, bookings, leads, business);
  const currency = business.currency_symbol || '₹';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('success', 'Copied to clipboard!', 'Message draft ready to dispatch.');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSaveNotes = () => {
    setIsSavingNotes(true);
    updateCustomer(customer.id, { notes: editingNotes });
    addAuditLog('CUSTOMER_UPDATED', `Updated notes for customer: ${customer.name}`);
    setTimeout(() => {
      setIsSavingNotes(false);
      showToast('success', 'Notes Saved', 'Customer clinical & preference notes updated.');
    }, 300);
  };

  const handleUpdateStatus = (newStatus: Customer['status']) => {
    updateCustomer(customer.id, { status: newStatus });
    addAuditLog('CUSTOMER_STATUS_CHANGED', `Customer ${customer.name} status updated to ${newStatus}`);
    showToast('info', 'Customer Status Updated', `Status changed to "${newStatus.replace('_', ' ')}".`);
  };

  const handleOpenWhatsApp = (phone: string, text?: string) => {
    const cleanPhone = normalizePhoneNumber(phone);
    const msg = encodeURIComponent(
      text || `Hello ${customer.name}! Greetings from ${business.name}. How can we assist with your wellness routine today?`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/90 flex flex-col space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-indigo-600/30">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-100">{customer.name}</h2>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      customer.status === 'vip'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : customer.status === 'active' || customer.status === 'repeat'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : customer.status === 'churn_risk'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {customer.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  {customer.phone ? (
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {customer.phone}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">No phone verified</span>
                  )}
                  {customer.email ? (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Mail className="w-3 h-3 text-slate-500" />
                      {customer.email}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">No email</span>
                  )}
                  {customer.city && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {customer.city}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenWhatsApp(customer.phone)}
                title="Direct WhatsApp"
                className="p-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(customer)}
                  title="Edit Customer"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 4-Metric Grounded Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Total Verified Spend</div>
              <div className="text-sm font-bold text-slate-100 font-mono mt-0.5">
                {currency}{profile.totalRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[9px] text-emerald-400">
                {profile.totalOrders} ord • {profile.totalBookings} bk
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Average Order Value</div>
              <div className="text-sm font-bold text-slate-100 font-mono mt-0.5">
                {currency}{profile.avgOrderValue.toLocaleString('en-IN')}
              </div>
              <div className="text-[9px] text-slate-400">per transaction</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">First Interaction</div>
              <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
                {profile.firstInteraction ? new Date(profile.firstInteraction).toLocaleDateString('en-IN') : 'N/A'}
              </div>
              <div className="text-[9px] text-slate-400 capitalize truncate">
                via {customer.source?.replace('_', ' ') || 'Direct'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Latest Activity</div>
              <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
                {profile.latestInteraction ? new Date(profile.latestInteraction).toLocaleDateString('en-IN') : 'N/A'}
              </div>
              <div className="text-[9px] text-amber-400 truncate">
                {customer.tags?.[0] || 'Registered'}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-t border-slate-800/80 pt-3 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Overview & 360
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Timeline ({profile.timeline.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Orders & Bookings ({profile.totalOrders + profile.totalBookings})</span>
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'recommendations'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Actions ({profile.recommendations.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'notes'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes & Status</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW & 360 SUMMARY */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Repeat Purchase & Retention Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Repeat Purchase & Retention Behaviour
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      profile.repeatPurchaseInfo.isRepeat
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {profile.repeatPurchaseInfo.isRepeat ? 'Repeat Customer' : 'Single-Order Buyer'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Total Transactions</div>
                    <div className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
                      {profile.repeatPurchaseInfo.totalTransactions}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Order Span (Days)</div>
                    <div className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
                      {profile.repeatPurchaseInfo.daysBetweenFirstAndLast !== null
                        ? `${profile.repeatPurchaseInfo.daysBetweenFirstAndLast}d`
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Avg Repurchase Cycle</div>
                    <div className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
                      {profile.repeatPurchaseInfo.avgOrderIntervalDays !== null
                        ? `${profile.repeatPurchaseInfo.avgOrderIntervalDays}d`
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Favorite Products */}
                {profile.repeatPurchaseInfo.favoriteProducts.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-300">Top Purchased Products:</div>
                    <div className="space-y-1">
                      {profile.repeatPurchaseInfo.favoriteProducts.slice(0, 3).map((prod, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/60 border border-slate-800/80"
                        >
                          <div className="font-medium text-slate-200 truncate">{prod.name}</div>
                          <div className="text-slate-400 shrink-0 ml-2 font-mono text-[11px]">
                            {prod.quantity} purchased • {currency}{prod.totalSpent.toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Favorite Services */}
                {profile.repeatPurchaseInfo.favoriteServices.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-300">Clinic Services Booked:</div>
                    <div className="space-y-1">
                      {profile.repeatPurchaseInfo.favoriteServices.slice(0, 3).map((serv, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/60 border border-slate-800/80"
                        >
                          <div className="font-medium text-slate-200 truncate">{serv.name}</div>
                          <div className="text-slate-400 shrink-0 ml-2 font-mono text-[11px]">
                            {serv.bookingsCount} sessions • {currency}{serv.totalSpent.toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Data Completeness & Verification Audit */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    Profile Completeness & Verified Fields
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {profile.dataCompleteness.score}% Verified
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${profile.dataCompleteness.score}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-emerald-400">Verified On File:</div>
                    {profile.dataCompleteness.verifiedFields.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-amber-400">Missing / Unverified:</div>
                    {profile.dataCompleteness.missingFields.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic">None - Complete Profile!</div>
                    ) : (
                      profile.dataCompleteness.missingFields.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Acquisition Channels Verified */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-400" />
                  Verified Touchpoints & Acquisition Channels
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {profile.verifiedSources.map((src, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHRONOLOGICAL ACTIVITY TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Verified Chronological History
                </h3>
                <span className="text-[11px] text-slate-400">{profile.timeline.length} recorded events</span>
              </div>

              {profile.timeline.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  No activity events recorded yet for this customer.
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 my-2">
                  {profile.timeline.map((evt) => (
                    <div key={evt.id} className="relative group">
                      {/* Timeline dot */}
                      <span
                        className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                          evt.badgeColor || 'bg-indigo-500'
                        }`}
                      />

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-slate-700 transition-colors space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-200">{evt.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(evt.timestamp).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{evt.description}</p>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                          <span>Source: {evt.source}</span>
                          {evt.amount && (
                            <span className="font-mono text-emerald-400 font-semibold">
                              {currency}{Number(evt.amount).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ORDERS & BOOKINGS HISTORY */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Orders section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  Product Orders ({profile.orders.length})
                </h3>

                {profile.orders.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                    No physical product orders logged for this customer.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-200">
                              #{ord.id.replace('ord_', '')}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              {ord.order_status}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {ord.payment_method?.toUpperCase()}
                            </span>
                          </div>
                          <div className="font-bold text-xs font-mono text-slate-100">
                            {currency}{Number(ord.total_amount).toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div className="text-xs text-slate-300 space-y-0.5">
                          {ord.items?.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>
                                {it.quantity}x {it.name}
                              </span>
                              <span className="font-mono">{currency}{Number(it.total || it.unit_price * it.quantity).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>

                        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800 flex items-center justify-between">
                          <span>Date: {new Date(ord.order_date).toLocaleDateString('en-IN')}</span>
                          {ord.notes && <span className="truncate max-w-xs italic">{ord.notes}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bookings section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  Clinic Bookings & Consultations ({profile.bookings.length})
                </h3>

                {profile.bookings.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                    No clinical appointments or therapy sessions scheduled.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.bookings.map((bk) => (
                      <div
                        key={bk.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs text-slate-200">{bk.service_name}</div>
                          <span className="font-bold text-xs font-mono text-slate-100">
                            {currency}{Number(bk.amount).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span>Date: {new Date(bk.booking_date).toLocaleDateString('en-IN')}</span>
                          {bk.time_slot && <span>Slot: {bk.time_slot}</span>}
                          {bk.practitioner_name && <span>With: {bk.practitioner_name}</span>}
                        </div>

                        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800 flex items-center justify-between">
                          <span className="capitalize">Status: {bk.status}</span>
                          {bk.notes && <span className="truncate max-w-xs italic">{bk.notes}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GROUNDED AI FOLLOW-UP RECOMMENDATIONS (HUMAN-IN-THE-LOOP) */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Human-in-the-Loop Follow-up Actions
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Grounded recommendations generated strictly from verified purchase intervals and spend records.
                  </p>
                </div>
              </div>

              {profile.recommendations.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  No pending follow-up triggers for {customer.name} at this time.
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.recommendations.map((rec) => {
                    const copyKey = `rec_${rec.id}`;
                    return (
                      <div
                        key={rec.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-semibold uppercase">
                            {rec.actionType.replace('_', ' ')} • {rec.confidence}% Confidence
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 font-semibold border border-indigo-800">
                            Human Approval Required
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-slate-100">{rec.title}</h4>
                          <p className="text-xs text-slate-300">{rec.reason}</p>
                        </div>

                        {/* Evidence */}
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Supporting Verified Evidence:</div>
                          {rec.supportingEvidence.map((ev, i) => (
                            <div key={i} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                              <span>{ev}</span>
                            </div>
                          ))}
                        </div>

                        {/* Pre-drafted WhatsApp message */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-slate-400">Pre-drafted WhatsApp Message:</div>
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {rec.draftMessage}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => copyToClipboard(rec.draftMessage, copyKey)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            {copiedId === copyKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === copyKey ? 'Copied!' : 'Copy Draft'}</span>
                          </button>

                          <button
                            onClick={() => handleOpenWhatsApp(customer.phone, rec.draftMessage)}
                            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Approve & Dispatch WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: NOTES & STATUS MANAGEMENT */}
          {activeTab === 'notes' && (
            <div className="space-y-5">
              {/* Status Selector */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-200">Update Customer Cohort Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['active', 'vip', 'repeat', 'churn_risk', 'dormant'] as Customer['status'][]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(st)}
                      className={`p-2 rounded-lg text-xs font-semibold capitalize border transition-all ${
                        customer.status === st
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-200">Customer Tags & Attributes</label>
                <div className="flex flex-wrap gap-1.5">
                  {customer.tags?.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Clinical / Staff Notes */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-200">Doctor & Staff Clinical Notes</label>
                <textarea
                  rows={4}
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Record customer preferences, treatment history notes, or delivery instructions..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
