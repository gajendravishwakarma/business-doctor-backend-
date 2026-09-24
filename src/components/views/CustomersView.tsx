import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Users,
  Plus,
  Search,
  MessageCircle,
  Phone,
  Mail,
  UserCheck,
  TrendingUp,
  Tag,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Award,
  Sparkles,
  Layers,
  ShoppingBag,
  Clock,
  Filter,
} from 'lucide-react';
import { Customer } from '../../types/database';
import { getCustomerSegments, normalizePhoneNumber, findDuplicateCustomer } from '../../lib/crm-engine';
import { CustomerSegmentType } from '../../types/crm';
import { Customer360Drawer } from '../crm/Customer360Drawer';

export const CustomersView: React.FC = () => {
  const { business, customers, orders, bookings, leads, addCustomer, updateCustomer, deleteCustomer, showToast } =
    useBusinessStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegmentType>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selected360Customer, setSelected360Customer] = useState<Customer | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState<Customer['source']>('whatsapp');
  const [tags, setTags] = useState('Customer');
  const [notes, setNotes] = useState('');

  const currency = business.currency_symbol || '₹';

  // Segmentation Engine
  const { summaries, filterBySegment } = getCustomerSegments(
    customers,
    leads,
    orders,
    bookings,
    currency
  );

  const { filteredCustomers: segmentCustomers } = filterBySegment(selectedSegment);

  const filteredCustomers = segmentCustomers.filter((c) => {
    const term = (searchTerm || '').toLowerCase();
    const cName = (c.name || '').toLowerCase();
    const cEmail = (c.email || '').toLowerCase();
    const cCity = (c.city || '').toLowerCase();
    const matchesSearch =
      cName.includes(term) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      cEmail.includes(term) ||
      cCity.includes(term);
    return matchesSearch;
  });

  const totalSpend = customers.reduce((acc, c) => acc + (Number(c.total_spend) || 0), 0);
  const repeatCount = customers.filter((c) => (c.total_orders && c.total_orders > 1) || c.status === 'repeat' || c.status === 'vip').length;
  const churnRiskCount = customers.filter((c) => c.status === 'churn_risk').length;
  const avgLtv = customers.length > 0 ? Math.round(totalSpend / customers.length) : 0;

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setEmail('');
    setPhone('+91 ');
    setCity(business.location ? business.location.split(',')[0].trim() : 'Bengaluru');
    setSource('whatsapp');
    setTags('Customer');
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setEmail(c.email || '');
    setPhone(c.phone || '+91 ');
    setCity(c.city || '');
    setSource(c.source || 'whatsapp');
    setTags(c.tags ? c.tags.join(', ') : '');
    setNotes(c.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Missing Name', 'Please provide a valid customer name.');
      return;
    }

    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        name,
        email,
        phone,
        city,
        source,
        tags: tagList,
        notes,
      });
      showToast('success', 'Customer Updated', `${name}'s profile has been updated.`);
    } else {
      const existing = findDuplicateCustomer(phone, email, customers);
      if (existing) {
        showToast(
          'error',
          'Customer Already Exists',
          `A record matching "${existing.name}" with this phone/email is already registered.`
        );
        return;
      }

      addCustomer({
        name,
        email,
        phone,
        city,
        source,
        status: 'active',
        first_seen: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        total_orders: 0,
        total_spend: 0,
        notes,
        tags: tagList,
      });
      showToast('success', 'Customer Created', `${name} has been added to customer directory.`);
    }

    setIsAddModalOpen(false);
  };

  const sendWhatsApp = (phone: string, name: string) => {
    const cleanPhone = normalizePhoneNumber(phone);
    const msg = encodeURIComponent(
      `Namaste ${name} Ji! 🙏 Greetings from ${business.name}. We are checking in to see how your personalized wellness regimen is progressing. Let us know if you need any refills or doctor guidance!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Customer Growth & CRM Engine
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Unified Customer 360 profiles, dynamic cohort segmentation & retention intelligence
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* KPI Cards (Grounded in Verified Store Data) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">Customer Database</div>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">{customers.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Verified workspace profiles</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">Repeat Retention Rate</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
            {customers.length > 0 ? Math.round((repeatCount / customers.length) * 100) : 0}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{repeatCount} repeat buyers (&gt;1 purchase)</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">Average Customer LTV</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {currency}{avgLtv.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total Spend: {currency}{totalSpend.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">Churn Risk Cohort</div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">{churnRiskCount}</div>
          <div className="text-[11px] text-amber-300 mt-1">&gt;60 days inactive</div>
        </div>
      </div>

      {/* Dynamic Segment Pills Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Dynamic CRM Cohort Segments
          </span>
          <span className="text-[11px] text-slate-400">
            {summaries.find((s) => s.type === selectedSegment)?.description}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {summaries.slice(0, 6).map((seg) => (
            <button
              key={seg.type}
              onClick={() => setSelectedSegment(seg.type)}
              className={`px-3 py-2 rounded-xl font-semibold whitespace-nowrap transition-all border flex items-center gap-2 ${
                selectedSegment === seg.type
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
              }`}
            >
              <span>{seg.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  selectedSegment === seg.type
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {seg.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer name, phone, email, or city..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Showing {filteredCustomers.length} of {customers.length} verified records</span>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Customer Profile</th>
                <th className="py-3.5 px-4">Phone & City</th>
                <th className="py-3.5 px-4">Channel Source</th>
                <th className="py-3.5 px-4">Verified Orders & LTV</th>
                <th className="py-3.5 px-4">Cohort Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 space-y-3">
                    <Users className="w-8 h-8 text-slate-600 mx-auto" />
                    <div className="font-semibold text-slate-300">No customer records in this workspace yet.</div>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Add customer profiles manually or convert inbound leads to unlock Customer 360 insights.
                    </p>
                    <button
                      onClick={handleOpenAdd}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First Customer</span>
                    </button>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 space-y-2">
                    <p>No customers found matching filter &quot;{selectedSegment}&quot; or search query.</p>
                    <button
                      onClick={() => {
                        setSelectedSegment('all');
                        setSearchTerm('');
                      }}
                      className="text-xs text-indigo-400 hover:underline font-medium"
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => setSelected360Customer(c)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-800/80 flex items-center justify-center font-bold text-xs text-indigo-300">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-100 group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                            <span>{c.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 opacity-60" />
                            <span>{c.email || 'No email provided'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono text-slate-200 font-medium flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.phone || 'No phone'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{c.city || 'Location not set'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 capitalize">
                        {c.source ? c.source.replace('_', ' ') : 'Direct'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100 font-mono">
                        {currency}{(Number(c.total_spend) || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-medium">
                        {c.total_orders || 0} {c.total_orders === 1 ? 'order' : 'orders'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            c.status === 'vip'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : c.status === 'active' || c.status === 'repeat'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : c.status === 'churn_risk'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                        {c.tags?.slice(0, 1).map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td
                      className="py-3.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelected360Customer(c)}
                          title="Open Customer 360 Profile"
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>360 View</span>
                        </button>
                        <button
                          onClick={() => sendWhatsApp(c.phone, c.name)}
                          title="Direct WhatsApp Message"
                          className="p-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          title="Edit Customer"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteCustomer(c.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer 360 Drawer */}
      {selected360Customer && (
        <Customer360Drawer
          customer={selected360Customer}
          isOpen={Boolean(selected360Customer)}
          onClose={() => setSelected360Customer(null)}
          onEdit={(c) => {
            setSelected360Customer(null);
            handleOpenEdit(c);
          }}
        />
      )}

      {/* Add / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base">
                {editingCustomer ? 'Edit Customer Profile' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Phone (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Acquisition Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="whatsapp">WhatsApp Inbound</option>
                    <option value="instagram">Instagram Campaign</option>
                    <option value="google_search">Google Search</option>
                    <option value="walk_in">Clinic Walk-in</option>
                    <option value="referral">Customer Referral</option>
                    <option value="website">Website / Store</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tags (Comma Separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="VIP, Consultation, Skincare"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Doctor / Staff Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prefers herbal tea before consultation. Regular buyer of Kumkumadi."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
