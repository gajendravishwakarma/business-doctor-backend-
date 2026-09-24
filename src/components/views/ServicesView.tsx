import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import { Scissors, Plus, Clock, Trash2, Edit2, X } from 'lucide-react';
import { ServiceItem } from '../../types/database';

export const ServicesView: React.FC = () => {
  const { business, services, addService, updateService, deleteService } = useBusinessStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Consultations');
  const [price, setPrice] = useState<number>(1200);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [description, setDescription] = useState('');

  const handleOpenAdd = () => {
    setEditingService(null);
    setName('');
    setCategory('Consultations');
    setPrice(1200);
    setDurationMinutes(45);
    setDescription('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (s: ServiceItem) => {
    setEditingService(s);
    setName(s.name);
    setCategory(s.category);
    setPrice(s.price);
    setDurationMinutes(s.duration_minutes);
    setDescription(s.description);
    setIsAddModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingService) {
      updateService(editingService.id, {
        name,
        category,
        price: Number(price) || 0,
        duration_minutes: Number(durationMinutes) || 45,
        description,
      });
    } else {
      addService({
        name,
        category,
        price: Number(price) || 0,
        duration_minutes: Number(durationMinutes) || 45,
        description,
        is_active: true,
      });
    }

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Scissors className="w-5 h-5 text-indigo-400" />
            Service & Consultation Offerings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Doctor consultations, holistic therapies, session pricing, and slot durations
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Service Offering</span>
        </button>
      </div>

      {/* Services Grid */}
      {services.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
          <Scissors className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-80" />
          <div className="font-semibold text-slate-300">No services or session offerings defined yet.</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Add service packages using the button above or import from your public website.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
                    {s.category}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{s.duration_minutes} mins</span>
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-100">{s.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{s.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div className="font-mono font-bold text-base text-emerald-400">
                  {business.currency_symbol}
                  {s.price.toLocaleString('en-IN')}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(s)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteService(s.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base">{editingService ? 'Edit Service' : 'Add Service Offering'}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Service / Session Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Abhyanga Full-Body Warm Herbal Oil Therapy"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Fee ({business.currency_symbol})</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Clinical benefits, practitioner requirements, etc."
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
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
