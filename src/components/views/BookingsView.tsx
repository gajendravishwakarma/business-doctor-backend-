import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  CalendarDays,
  Plus,
  Search,
  Clock,
  Phone,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  User,
} from 'lucide-react';
import { Booking } from '../../types/database';

export const BookingsView: React.FC = () => {
  const { business, user, members, bookings, services, addBooking, updateBooking, deleteBooking } = useBusinessStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91 ');
  const [serviceName, setServiceName] = useState(services[0]?.name || 'Consultation');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('11:00 AM');
  const [amount, setAmount] = useState<number>(services[0]?.price || 1000);
  const [practitionerName, setPractitionerName] = useState(user?.name || members[0]?.user_name || 'Practitioner');

  const filteredBookings = bookings.filter((b) => {
    const term = (searchTerm || '').toLowerCase();
    const cName = (b.customer_name || '').toLowerCase();
    const sName = (b.service_name || '').toLowerCase();
    return cName.includes(term) || sName.includes(term);
  });

  const handleOpenAdd = () => {
    setCustomerName('');
    setCustomerPhone('+91 ');
    setServiceName(services[0]?.name || 'Consultation');
    setBookingDate(new Date().toISOString().split('T')[0]);
    setBookingTime('11:00 AM');
    setAmount(services[0]?.price || 1000);
    setPractitionerName(user?.name || members[0]?.user_name || 'Practitioner');
    setIsAddModalOpen(true);
  };

  const handleServiceChange = (name: string) => {
    setServiceName(name);
    const srv = services.find((s) => s.name === name);
    if (srv) setAmount(srv.price);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    addBooking({
      customer_id: null,
      customer_name: customerName,
      customer_phone: customerPhone,
      service_name: serviceName,
      practitioner_name: practitionerName.trim() || user?.name || 'Practitioner',
      booking_date: bookingDate,
      booking_time: bookingTime,
      status: 'confirmed',
      amount: Number(amount) || 0,
      notes: 'Consultation scheduled via operating system',
    });

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-400" />
            Appointments & Consultation Bookings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Doctor sessions, holistic therapy room slots, and patient schedules
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Book Appointment</span>
        </button>
      </div>

      {/* Bookings List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Patient / Customer</th>
                <th className="py-3.5 px-4">Service Session</th>
                <th className="py-3.5 px-4">Scheduled Slot</th>
                <th className="py-3.5 px-4">Practitioner</th>
                <th className="py-3.5 px-4">Fee</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-slate-400 text-xs">
                    <CalendarDays className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-80" />
                    <div className="font-semibold text-slate-300">No appointments or bookings recorded yet.</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Schedule a client booking above or import past booking schedules.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100">{b.customer_name}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{b.customer_phone}</div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-200">{b.service_name}</td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{b.booking_date}</div>
                      <div className="text-[11px] text-indigo-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{b.booking_time}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">{b.practitioner_name}</td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-100">
                      {business.currency_symbol}
                      {b.amount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : b.status === 'completed'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => deleteBooking(b.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Booking Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base">Schedule Appointment</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Customer / Patient Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Anand Mahindra"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Consultation / Therapy</label>
                <select
                  value={serviceName}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({business.currency_symbol}{s.price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Time Slot</label>
                  <input
                    type="text"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    placeholder="11:30 AM"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
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
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
