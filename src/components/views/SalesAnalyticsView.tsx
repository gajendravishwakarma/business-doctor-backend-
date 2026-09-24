import React, { useState, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  Receipt,
  PieChart,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  calculateProfitAndLoss,
  calculateSalesAnalytics,
  generateProfitAndLossReport,
} from '../../lib/sales-ops-engine';

interface SalesAnalyticsViewProps {
  onNavigate?: (moduleKey: string) => void;
}

export const SalesAnalyticsView: React.FC<SalesAnalyticsViewProps> = ({ onNavigate }) => {
  const { business, orders, bookings, products, expenses, addAuditLog, showToast } = useBusinessStore();
  const [periodFilter, setPeriodFilter] = useState<'all' | '30d' | '7d'>('all');
  const [activeTab, setActiveTab] = useState<'pnl' | 'products' | 'expenses'>('pnl');

  const currencySymbol = business.currency_symbol || '₹';
  const currencyCode = business.currency || 'INR';

  // Compute live analytics grounded in real data
  const pnl = useMemo(() => {
    return calculateProfitAndLoss(orders, bookings, expenses, products);
  }, [orders, bookings, expenses, products]);

  const analytics = useMemo(() => {
    return calculateSalesAnalytics(orders, bookings, products, expenses);
  }, [orders, bookings, products, expenses]);

  const hasOrdersData = orders.length > 0;
  const hasExpensesData = expenses.length > 0;

  const handleExportReport = () => {
    const reportText = generateProfitAndLossReport(pnl, business.name, currencySymbol);
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PnL_Report_${business.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addAuditLog('EXPORT_PNL_REPORT', `Exported P&L text report for ${business.name}`);
    showToast('success', 'P&L Statement exported');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Sales & Operations Analytics
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Supabase Grounded
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time profit & loss statement, inventory margin analytics, and operational health metrics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            {(['all', '30d', '7d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  periodFilter === p
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === 'all' ? 'All-Time' : p === '30d' ? 'Past 30 Days' : 'Past 7 Days'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportReport}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export Statement</span>
          </button>
        </div>
      </div>

      {/* Top 4 Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Gross Revenue</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-slate-100">
              {hasOrdersData ? (
                `${currencySymbol}${pnl.grossRevenue.toLocaleString()}`
              ) : (
                <span className="text-sm font-normal text-slate-500">Insufficient data</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
              <span>Grounding:</span>
              <strong className="text-slate-300 font-mono">{orders.length} orders</strong>
              <span>({currencyCode})</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span>Orders: {currencySymbol}{pnl.ordersRevenue.toLocaleString()}</span>
            <span>Bookings: {currencySymbol}{pnl.bookingsRevenue.toLocaleString()}</span>
          </div>
        </div>

        {/* Cost of Goods Sold & Gross Profit */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Gross Profit & Margin</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-indigo-400">
              {hasOrdersData ? (
                `${currencySymbol}${pnl.grossProfit.toLocaleString()}`
              ) : (
                <span className="text-sm font-normal text-slate-500">Insufficient data</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
              <span>Gross Margin:</span>
              <strong className="text-emerald-400 font-bold">{pnl.grossMarginPct}%</strong>
              <span className="text-slate-500">| COGS: {currencySymbol}{pnl.cogs.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">
            Inventory unit acquisition cost deducted
          </div>
        </div>

        {/* Total Operating Expenses */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total OpEx</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-slate-100">
              {hasExpensesData ? (
                `${currencySymbol}${pnl.operatingExpenses.toLocaleString()}`
              ) : (
                <span className="text-sm font-normal text-slate-500">Insufficient data</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
              <span>Grounding:</span>
              <strong className="text-slate-300 font-mono">{expenses.length} expenses</strong>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span>Rent/Salaries: {currencySymbol}{(pnl.expensesByCategory.rent + pnl.expensesByCategory.salaries).toLocaleString()}</span>
            <span>Mktg: {currencySymbol}{pnl.expensesByCategory.marketing.toLocaleString()}</span>
          </div>
        </div>

        {/* Net Operating Income */}
        <div className={`border rounded-2xl p-4 flex flex-col justify-between ${
          pnl.netOperatingProfit >= 0
            ? 'bg-slate-900/90 border-emerald-500/30'
            : 'bg-slate-900/90 border-rose-500/30'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Net Operating Income</span>
            <div className={`p-1.5 rounded-lg ${
              pnl.netOperatingProfit >= 0
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {pnl.netOperatingProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          </div>
          <div className="my-3">
            <div className={`text-2xl font-bold ${
              pnl.netOperatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {hasOrdersData || hasExpensesData ? (
                `${currencySymbol}${pnl.netOperatingProfit.toLocaleString()}`
              ) : (
                <span className="text-sm font-normal text-slate-500">Insufficient data</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
              <span>Net Margin:</span>
              <strong className={`font-bold ${pnl.netMarginPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pnl.netMarginPct}%
              </strong>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Strict GAAP P&L formula enforced</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold gap-2">
        <button
          onClick={() => setActiveTab('pnl')}
          className={`pb-3 px-3 transition-colors flex items-center gap-1.5 border-b-2 ${
            activeTab === 'pnl'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>P&L Statement</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 px-3 transition-colors flex items-center gap-1.5 border-b-2 ${
            activeTab === 'products'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product Margins & Bestsellers</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 px-3 transition-colors flex items-center gap-1.5 border-b-2 ${
            activeTab === 'expenses'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>OpEx Breakdown</span>
        </button>
      </div>

      {/* TAB 1: P&L Statement Details */}
      {activeTab === 'pnl' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-100">Profit & Loss Statement (Income Statement)</h2>
                <p className="text-xs text-slate-400">Generated from {business.name} operational database</p>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                Currency: {currencyCode}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80 text-xs">
              {/* Revenue section */}
              <div className="py-2.5 flex justify-between items-center font-medium">
                <span className="text-slate-300 font-semibold">1. Gross Revenue</span>
                <span className="text-slate-100 font-mono font-bold text-sm">
                  {currencySymbol}{pnl.grossRevenue.toLocaleString()}
                </span>
              </div>
              <div className="py-1.5 pl-4 flex justify-between items-center text-slate-400">
                <span>Orders Product Revenue</span>
                <span className="font-mono text-emerald-400">+{currencySymbol}{pnl.ordersRevenue.toLocaleString()}</span>
              </div>
              <div className="py-1.5 pl-4 flex justify-between items-center text-slate-400">
                <span>Bookings Service Revenue</span>
                <span className="font-mono text-emerald-400">+{currencySymbol}{pnl.bookingsRevenue.toLocaleString()}</span>
              </div>

              {/* COGS */}
              <div className="py-2.5 flex justify-between items-center font-medium">
                <span className="text-slate-300 font-semibold">2. Cost of Goods Sold (COGS)</span>
                <span className="text-rose-400 font-mono font-bold text-sm">
                  -{currencySymbol}{pnl.cogs.toLocaleString()}
                </span>
              </div>

              {/* Gross Profit */}
              <div className="py-3 flex justify-between items-center font-bold bg-slate-800/30 px-3 rounded-lg my-1">
                <span className="text-indigo-300">GROSS PROFIT (Revenue - COGS)</span>
                <span className="text-indigo-400 font-mono text-sm">
                  {currencySymbol}{pnl.grossProfit.toLocaleString()} ({pnl.grossMarginPct}%)
                </span>
              </div>

              {/* Operating Expenses */}
              <div className="py-2.5 flex justify-between items-center font-medium">
                <span className="text-slate-300 font-semibold">3. Operating Expenses (OpEx)</span>
                <span className="text-rose-400 font-mono font-bold text-sm">
                  -{currencySymbol}{pnl.operatingExpenses.toLocaleString()}
                </span>
              </div>
              <div className="py-1 pl-4 flex justify-between items-center text-slate-400">
                <span>Salaries & Wages</span>
                <span className="font-mono">-{currencySymbol}{pnl.expensesByCategory.salaries.toLocaleString()}</span>
              </div>
              <div className="py-1 pl-4 flex justify-between items-center text-slate-400">
                <span>Rent & Space</span>
                <span className="font-mono">-{currencySymbol}{pnl.expensesByCategory.rent.toLocaleString()}</span>
              </div>
              <div className="py-1 pl-4 flex justify-between items-center text-slate-400">
                <span>Marketing & Ads</span>
                <span className="font-mono">-{currencySymbol}{pnl.expensesByCategory.marketing.toLocaleString()}</span>
              </div>
              <div className="py-1 pl-4 flex justify-between items-center text-slate-400">
                <span>Inventory Overhead & Storage</span>
                <span className="font-mono">-{currencySymbol}{pnl.expensesByCategory.inventory.toLocaleString()}</span>
              </div>
              <div className="py-1 pl-4 flex justify-between items-center text-slate-400">
                <span>Utilities & Bills</span>
                <span className="font-mono">-{currencySymbol}{pnl.expensesByCategory.utilities.toLocaleString()}</span>
              </div>
              <div className="py-1 pl-4 flex justify-between items-center text-slate-400">
                <span>Software & Tools</span>
                <span className="font-mono">-{currencySymbol}{pnl.expensesByCategory.software.toLocaleString()}</span>
              </div>
              <div className="py-1 pl-4 flex justify-between items-center text-slate-400">
                <span>Logistics & Shipping</span>
                <span className="font-mono">-{currencySymbol}{pnl.expensesByCategory.logistics.toLocaleString()}</span>
              </div>
              <div className="py-1 pl-4 flex justify-between items-center text-slate-400">
                <span>Other Administrative</span>
                <span className="font-mono">-{currencySymbol}{pnl.expensesByCategory.other.toLocaleString()}</span>
              </div>

              {/* Net Operating Income */}
              <div className={`py-3.5 flex justify-between items-center font-bold px-3 rounded-xl mt-2 ${
                pnl.netOperatingProfit >= 0 ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20' : 'bg-rose-950/40 text-rose-300 border border-rose-500/20'
              }`}>
                <span className="text-sm">NET OPERATING PROFIT (EBIT)</span>
                <span className="font-mono text-base">
                  {currencySymbol}{pnl.netOperatingProfit.toLocaleString()} ({pnl.netMarginPct}%)
                </span>
              </div>
            </div>
          </div>

          {/* AI Financial Diagnosis & Operational Health */}
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Financial Doctor Observations</h3>
              </div>

              <div className="space-y-3 text-xs">
                {pnl.grossMarginPct < 40 ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    <strong className="block mb-1">Low Gross Margin Alert ({pnl.grossMarginPct}%)</strong>
                    Unit acquisition costs are cutting into gross profitability. Review supplier catalog pricing or increase selling price.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    <strong className="block mb-1">Healthy Gross Margin ({pnl.grossMarginPct}%)</strong>
                    Product markup is structured sustainably above 40%.
                  </div>
                )}

                {pnl.netMarginPct < 15 ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                    <strong className="block mb-1">Thin Net Operating Buffer ({pnl.netMarginPct}%)</strong>
                    Overhead expenses consume {100 - pnl.netMarginPct}% of gross revenue. Audit fixed recurring expenses.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                    <strong className="block mb-1">Solid Net Operating Buffer ({pnl.netMarginPct}%)</strong>
                    Net income retains healthy buffer to re-invest in growth and staffing.
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 space-y-1">
                  <div className="font-semibold text-slate-200">Provenance Evidence</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Orders: {orders.length} | Bookings: {bookings.length} | Expenses: {expenses.length} | Products: {products.length}
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1">
                    Isolated to tenant ID: {business.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
              <button
                onClick={() => onNavigate && onNavigate('orders')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span>Manage Customer Orders</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate && onNavigate('products')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span>Stock Adjustments & Restock</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate && onNavigate('expenses')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span>Record New Operating Expense</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Products Margins & Bestsellers */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-100">Top Performing Products by Revenue</h2>
                <p className="text-xs text-slate-400">Ranked by actual fulfilled customer order line items</p>
              </div>
              <span className="text-xs text-slate-400">
                Total Products: <strong className="text-slate-200 font-mono">{products.length}</strong>
              </span>
            </div>

            {analytics.topProductsByRevenue.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Insufficient data: No product orders recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 text-xs mt-2">
                <div className="grid grid-cols-12 py-2.5 font-semibold text-slate-400">
                  <div className="col-span-5">Product Name</div>
                  <div className="col-span-2 text-right">Units Sold</div>
                  <div className="col-span-2 text-right">Revenue</div>
                  <div className="col-span-3 text-right">Estimated Gross Margin</div>
                </div>

                {analytics.topProductsByRevenue.map((tp, idx) => {
                  const prod = products.find((p) => p.name === tp.name);
                  const marginPct = prod ? prod.margin_pct : 50;
                  return (
                    <div key={idx} className="grid grid-cols-12 py-3 items-center hover:bg-slate-800/20">
                      <div className="col-span-5 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-200">{tp.name}</span>
                      </div>
                      <div className="col-span-2 text-right font-mono text-slate-300">
                        {tp.quantity} units
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-100">
                        {currencySymbol}{tp.revenue.toLocaleString()}
                      </div>
                      <div className="col-span-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          marginPct >= 50
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : marginPct >= 30
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {marginPct}% Margin
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stock Runout & Re-order Alerts */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-slate-100 mb-1">Inventory Re-order & Low Stock Radar</h2>
            <p className="text-xs text-slate-400 mb-4">SKUs requiring immediate supplier purchase orders</p>

            {products.filter((p) => p.stock_quantity <= 10).length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>All product inventory levels are safely above low-stock threshold (&gt;10 units).</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {products
                  .filter((p) => p.stock_quantity <= 10)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl bg-slate-800/40 border border-amber-500/30 flex flex-col justify-between text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-200">{p.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">SKU: {p.sku}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                          p.stock_quantity === 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {p.stock_quantity === 0 ? 'OUT OF STOCK' : `${p.stock_quantity} left`}
                        </span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Unit Cost: {currencySymbol}{p.cost}</span>
                        <button
                          onClick={() => onNavigate && onNavigate('products')}
                          className="text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          Restock →
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Operating Expense Breakdown */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Operating Expenses by Functional Category</h2>
              <p className="text-xs text-slate-400">Analysis of overhead cost drivers and distribution</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-200">
              Total: {currencySymbol}{pnl.operatingExpenses.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Salaries & Staff Wages', amount: pnl.expensesByCategory.salaries, color: 'text-indigo-400' },
              { label: 'Facility Rent & Real Estate', amount: pnl.expensesByCategory.rent, color: 'text-emerald-400' },
              { label: 'Marketing & Customer Acquisition', amount: pnl.expensesByCategory.marketing, color: 'text-amber-400' },
              { label: 'Inventory Holding & Storage', amount: pnl.expensesByCategory.inventory, color: 'text-rose-400' },
              { label: 'Utilities, Power & Internet', amount: pnl.expensesByCategory.utilities, color: 'text-cyan-400' },
              { label: 'Software, SaaS & Subscriptions', amount: pnl.expensesByCategory.software, color: 'text-purple-400' },
              { label: 'Logistics & Shipping', amount: pnl.expensesByCategory.logistics, color: 'text-blue-400' },
              { label: 'Other Administrative Overhead', amount: pnl.expensesByCategory.other, color: 'text-slate-400' },
            ].map((cat, idx) => {
              const pct = pnl.operatingExpenses > 0
                ? Math.round((cat.amount / pnl.operatingExpenses) * 100)
                : 0;
              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span>{cat.label}</span>
                    <span className="font-mono font-bold text-slate-300">{pct}%</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-100 mt-1">
                    {currencySymbol}{cat.amount.toLocaleString()}
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
