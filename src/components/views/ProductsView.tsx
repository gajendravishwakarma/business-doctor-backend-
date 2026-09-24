import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  TrendingUp,
  Percent,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  Boxes,
  History,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { Product, InventoryMovementType } from '../../types/database';

export const ProductsView: React.FC = () => {
  const {
    business,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustInventory,
    inventoryMovements,
  } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<'catalog' | 'movements'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Stock Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockQty, setNewStockQty] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<InventoryMovementType>('purchase_restock');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  // Form State
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('General Products');
  const [price, setPrice] = useState<number>(1000);
  const [cost, setCost] = useState<number>(350);
  const [stockQuantity, setStockQuantity] = useState<number>(50);

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const term = (searchTerm || '').toLowerCase();
    const pName = (p.name || '').toLowerCase();
    const pSku = (p.sku || '').toLowerCase();
    const matchesSearch = pName.includes(term) || pSku.includes(term);
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const lowStockCount = products.filter((p) => p.stock_quantity <= 10).length;
  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock_quantity) || 0), 0);
  const avgMargin =
    products.length > 0
      ? Math.round(products.reduce((acc, p) => acc + (Number(p.margin_pct) || 0), 0) / products.length)
      : 0;

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setSku(`SKU-${products.length + 1}`);
    setCategory(categories[1] || 'General Products');
    setPrice(1000);
    setCost(350);
    setStockQuantity(50);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku);
    setCategory(p.category);
    setPrice(p.price);
    setCost(p.cost);
    setStockQuantity(p.stock_quantity);
    setIsAddModalOpen(true);
  };

  const handleOpenAdjust = (p: Product) => {
    setAdjustingProduct(p);
    setNewStockQty(p.stock_quantity);
    setAdjustmentType('purchase_restock');
    setAdjustmentReason('');
  };

  const handleSaveAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    adjustInventory(
      adjustingProduct.id,
      Math.max(0, Number(newStockQty) || 0),
      adjustmentType,
      adjustmentReason.trim() || 'Manual stock level adjustment'
    );
    setAdjustingProduct(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const numPrice = Number(price) || 0;
    const numCost = Number(cost) || 0;
    const margin = numPrice > 0 ? Math.round(((numPrice - numCost) / numPrice) * 100) : 0;
    const stock = Number(stockQuantity) || 0;
    const status = stock === 0 ? 'out_of_stock' : stock <= 10 ? 'low_stock' : 'active';

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name,
        sku,
        category,
        price: numPrice,
        cost: numCost,
        margin_pct: margin,
        stock_quantity: stock,
        status,
      });
    } else {
      addProduct({
        name,
        sku,
        category,
        price: numPrice,
        cost: numCost,
        margin_pct: margin,
        stock_quantity: stock,
        status,
        total_sold: 0,
      });
    }

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            Product Catalog & Inventory Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Unit economics, stock levels, idempotent inventory decrements, and re-order thresholds
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'catalog'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>SKU Catalog ({products.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'movements'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Stock Movements ({inventoryMovements.length})</span>
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product SKU</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Total Active SKUs</div>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">{products.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Grounded in database</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Units in Stock</div>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">{totalStockUnits.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Available across catalog</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Average Gross Margin</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{avgMargin}%</div>
          <div className="text-[11px] text-slate-400 mt-1">Calculated as (Price - Cost) / Price</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Low Stock Re-order Alerts</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
            {lowStockCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {lowStockCount > 0 ? 'Threshold: ≤10 units remaining' : 'All stock levels healthy'}
          </div>
        </div>
      </div>

      {/* TAB 1: SKU Catalog Table */}
      {activeTab === 'catalog' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search SKU code, name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">SKU & Product</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold text-right">Price ({business.currency_symbol})</th>
                  <th className="py-3 px-4 font-semibold text-right">COGS ({business.currency_symbol})</th>
                  <th className="py-3 px-4 font-semibold text-right">Margin %</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock Level</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No product SKUs found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isLowStock = p.stock_quantity <= 10 && p.stock_quantity > 0;
                    const isOutOfStock = p.stock_quantity === 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-100">{p.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{p.sku}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{p.category}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-100">
                          {business.currency_symbol}{p.price.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                          {business.currency_symbol}{p.cost.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                              p.margin_pct >= 50
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : p.margin_pct >= 30
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {p.margin_pct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">
                          {p.stock_quantity}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase font-mono ${
                              isOutOfStock
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : isLowStock
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenAdjust(p)}
                              title="Adjust Stock"
                              className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-colors"
                            >
                              Adjust
                            </button>
                            <button
                              onClick={() => handleOpenEdit(p)}
                              title="Edit SKU"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteProduct(p.id)}
                              title="Delete SKU"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Stock Movements Audit Ledger */}
      {activeTab === 'movements' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Inventory Stock Audit Ledger</h2>
              <p className="text-xs text-slate-400">Timestamped record of all restocks, sales deductions, audits, and damage adjustments</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total Recorded: <strong className="text-slate-200">{inventoryMovements.length}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Product SKU</th>
                  <th className="py-3 px-4 font-semibold">Movement Type</th>
                  <th className="py-3 px-4 font-semibold text-right">Quantity Delta</th>
                  <th className="py-3 px-4 font-semibold text-right">Balance After</th>
                  <th className="py-3 px-4 font-semibold">Reason / Audit Trail</th>
                  <th className="py-3 px-4 font-semibold">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {inventoryMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No inventory movements recorded yet. Stock adjustments will appear here.
                    </td>
                  </tr>
                ) : (
                  inventoryMovements.map((mov) => {
                    const isPositive = mov.quantity_change > 0;
                    return (
                      <tr key={mov.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                          {new Date(mov.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-200">
                          {mov.product_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                            mov.movement_type === 'purchase_restock'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : mov.movement_type === 'sale'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : mov.movement_type === 'wastage'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : mov.movement_type === 'return_damage'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {mov.movement_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                            {isPositive ? `+${mov.quantity_change}` : mov.quantity_change}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-200 font-bold">
                          {mov.balance_after}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {mov.reason}
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-400 font-mono">
                          {mov.created_by || 'system'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base">Adjust Stock Level</h3>
                <p className="text-xs text-slate-400">{adjustingProduct.name} ({adjustingProduct.sku})</p>
              </div>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Current Stock in System:</span>
                <span className="font-bold text-lg font-mono text-slate-100">{adjustingProduct.stock_quantity} units</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">New Target Stock Count *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newStockQty}
                  onChange={(e) => setNewStockQty(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Delta adjustment: {newStockQty - adjustingProduct.stock_quantity >= 0 ? '+' : ''}
                  {newStockQty - adjustingProduct.stock_quantity} units
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Movement Type</label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as InventoryMovementType)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="purchase_restock">Purchase Restock (New Inventory Shipment)</option>
                  <option value="manual_adjustment">Manual Adjustment / Cycle Count Reconciliation</option>
                  <option value="wastage">Wastage / Damaged / Expired Goods</option>
                  <option value="return_damage">Customer Return to Stock</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Reason / Invoice Memo</label>
                <input
                  type="text"
                  placeholder="e.g. PO-9812 Restock from supplier ABC"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
                >
                  Record Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit SKU Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base">{editingProduct ? 'Edit SKU' : 'Add Product SKU'}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Organic Triphala Tablets (60ct)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Price ({business.currency_symbol})</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">COGS ({business.currency_symbol})</label>
                  <input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Stock Units</label>
                  <input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 flex justify-between items-center">
                <span>Calculated Margin:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {price > 0 ? Math.round(((price - cost) / price) * 100) : 0}%
                </span>
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
                  Save SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
