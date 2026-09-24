import React, { useState, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  TrendingDown,
  PieChart,
  Calendar,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { Expense } from '../../types/database';
import { calculateProfitAndLoss } from '../../lib/sales-ops-engine';

export const ExpensesView: React.FC = () => {
  const { business, expenses, orders, bookings, products, addExpense, deleteExpense } = useBusinessStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form
  const [category, setCategory] = useState<Expense['category']>('inventory');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(5000);
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [isRecurring, setIsRecurring] = useState(false);
  const [taxDeductible, setTaxDeductible] = useState(true);

  const currencySymbol = business.currency_symbol || '₹';

  // Real Grounded P&L
  const pnl = useMemo(() => {
    return calculateProfitAndLoss(orders, bookings, expenses, products);
  }, [orders, bookings, expenses, products]);

  const totalExpense = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (Number(e.amount) || 0);
    return acc;
  }, {} as Record<string, number>);

  const categoryDisplayNames: Record<string, string> = {
    rent: 'Rent & Facility',
    salaries: 'Staff Salaries & Wages',
    inventory: 'Inventory & Stock Acquisition',
    marketing: 'Marketing & Customer Acquisition',
    utilities: 'Utilities, Power & Telecom',
    software: 'Software & Technology Tools',
    other: 'General Administrative Overhead',
  };

  const filteredExpenses = expenses.filter((e) => {
    const term = (searchTerm || '').toLowerCase();
    const desc = (e.description || e.title || '').toLowerCase();
    const vendor = (e.vendor || '').toLowerCase();
    const matchesSearch = desc.includes(term) || vendor.includes(term);
    const matchesCat = selectedCat === 'all' || e.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = () => {
    setCategory('inventory');
    setDescription('');
    setAmount(5000);
    setVendor('');
    setPaymentMethod('UPI');
    setIsRecurring(false);
    setTaxDeductible(true);
    setIsAddModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    addExpense({
      category,
      amount: Number(amount) || 0,
      description: description.trim(),
      vendor: vendor.trim() || 'Vendor',
      payment_method: paymentMethod,
      expense_date: new Date().toISOString(),
      is_recurring: isRecurring,
      tax_deductible: taxDeductible,
    });

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-400" />
            Operating Expenses & Overhead Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            P&L cost categorization, supplier invoices, facilities, salaries, and tax-deductible expenses
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Total Operating Expenses</div>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
            {currencySymbol}{totalExpense.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Grounded across {expenses.length} records</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Gross Operating Profit</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
            {currencySymbol}{pnl.grossProfit.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Revenue - Product COGS</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Net Operating Margin</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${pnl.netMarginPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {pnl.netMarginPct}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Net Income: {currencySymbol}{pnl.netOperatingProfit.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Recurring Monthly Burn</div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {currencySymbol}
            {expenses
              .filter((e) => e.is_recurring)
              .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
              .toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Rent, salaries & subscriptions</div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search description, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All P&L Categories</option>
              <option value="salaries">Salaries & Wages</option>
              <option value="rent">Rent & Facility</option>
              <option value="inventory">Inventory & Materials</option>
              <option value="marketing">Marketing & Acquisition</option>
              <option value="utilities">Utilities & Telecom</option>
              <option value="software">Software & Subscriptions</option>
              <option value="other">Other Administrative</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Date & Description</th>
                <th className="py-3 px-4 font-semibold">P&L Category</th>
                <th className="py-3 px-4 font-semibold">Vendor / Payee</th>
                <th className="py-3 px-4 font-semibold text-right">Amount ({business.currency_symbol})</th>
                <th className="py-3 px-4 font-semibold">Payment Method</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No operating expenses found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100">{e.description}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(e.expense_date).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {categoryDisplayNames[e.category] || e.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {e.vendor || 'Counter Payee'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                      {business.currency_symbol}{Number(e.amount).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 uppercase font-mono text-[11px]">
                      {e.payment_method || 'UPI'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {e.is_recurring && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Recurring
                          </span>
                        )}
                        {e.tax_deductible && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Tax Deductible
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => deleteExpense(e.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 transition-colors"
                        title="Delete record"
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

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base">Record Operating Expense</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Expense Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Warehouse Rent or Meta Ads Campaign"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Amount ({business.currency_symbol}) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">P&L Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Expense['category'])}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="salaries">Salaries & Wages</option>
                    <option value="rent">Rent & Facilities</option>
                    <option value="inventory">Inventory & Materials</option>
                    <option value="marketing">Marketing & Ads</option>
                    <option value="utilities">Utilities & Telecom</option>
                    <option value="software">Software & SaaS</option>
                    <option value="other">Other Administrative</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Vendor / Payee</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Property Ltd"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="UPI">UPI Transfer</option>
                    <option value="NetBanking">NetBanking / NEFT</option>
                    <option value="Card">Corporate Credit Card</option>
                    <option value="Cash">Cash Voucher</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-slate-300">Recurring Monthly Expense</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxDeductible}
                    onChange={(e) => setTaxDeductible(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-slate-300">Tax Deductible</span>
                </label>
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
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
