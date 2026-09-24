import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  CreditCard,
  QrCode,
  IndianRupee,
  Clock,
  AlertCircle,
  RotateCcw,
  Check,
  FileText,
  Boxes,
} from 'lucide-react';
import { Order, OrderItem, PaymentStatus, OrderStatus } from '../../types/database';
import { generateOrderNumber, calculateOrderTotals } from '../../lib/sales-ops-engine';

export const OrdersView: React.FC = () => {
  const {
    business,
    orders,
    customers,
    products,
    addOrder,
    updateOrder,
    deleteOrder,
    showToast,
  } = useBusinessStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineItems, setLineItems] = useState<OrderItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<Order['payment_method']>('upi');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('completed');
  const [orderNotes, setOrderNotes] = useState<string>('');

  const currencySymbol = business.currency_symbol || '₹';

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    const term = (searchTerm || '').toLowerCase();
    const customerName = (o.customer_name || '').toLowerCase();
    const orderId = (o.id || '').toLowerCase();
    const orderNum = (o.order_number || '').toLowerCase();

    const matchesSearch =
      customerName.includes(term) ||
      orderId.includes(term) ||
      orderNum.includes(term);

    const matchesPayment =
      selectedPaymentStatus === 'all' || o.payment_status === selectedPaymentStatus;
    const matchesStatus =
      selectedOrderStatus === 'all' || o.order_status === selectedOrderStatus;

    return matchesSearch && matchesPayment && matchesStatus;
  });

  // Derived Financial Stats
  const totalGross = orders.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);
  const totalPaid = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);
  const totalPending = orders
    .filter((o) => o.payment_status === 'pending')
    .reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);
  const aov = orders.length > 0 ? Math.round(totalGross / orders.length) : 0;

  // Open Create Modal
  const handleOpenAdd = () => {
    setEditingOrder(null);
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setDiscountAmount(0);
    setTaxAmount(0);
    setPaymentMethod('upi');
    setPaymentStatus('paid');
    setOrderStatus('completed');
    setOrderNotes('');

    // Default with one line item if products exist
    if (products.length > 0) {
      const p = products[0];
      setLineItems([
        {
          id: p.id,
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          quantity: 1,
          unit_price: p.price,
          unit_cost: p.cost,
          total: p.price,
        },
      ]);
      setTaxAmount(Math.round(p.price * 0.05));
    } else {
      setLineItems([]);
      setTaxAmount(0);
    }
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (o: Order) => {
    setEditingOrder(o);
    setSelectedCustomerId(o.customer_id || '');
    setCustomerName(o.customer_name);
    setCustomerEmail(o.customer_email || '');
    setCustomerPhone(o.customer_phone || '');
    setLineItems(o.items || []);
    setDiscountAmount(o.discount_amount || 0);
    setTaxAmount(o.tax_amount || 0);
    setPaymentMethod(o.payment_method || 'upi');
    setPaymentStatus(o.payment_status);
    setOrderStatus(o.order_status);
    setOrderNotes(o.notes || '');
    setIsAddModalOpen(true);
  };

  // Handle Customer Selection
  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerEmail(cust.email || '');
      setCustomerPhone(cust.phone || '');
    }
  };

  // Add line item
  const handleAddLineItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    const updated = [
      ...lineItems,
      {
        id: `item_${Date.now()}`,
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        quantity: 1,
        unit_price: p.price,
        unit_cost: p.cost,
        total: p.price,
      },
    ];
    setLineItems(updated);
    recalcTaxes(updated, discountAmount);
  };

  // Update line item
  const handleUpdateLineItem = (index: number, field: keyof OrderItem, val: any) => {
    const updated = [...lineItems];
    const current = { ...updated[index] };

    if (field === 'product_id') {
      const prod = products.find((p) => p.id === val);
      if (prod) {
        current.product_id = prod.id;
        current.sku = prod.sku;
        current.name = prod.name;
        current.unit_price = prod.price;
        current.unit_cost = prod.cost;
        current.total = prod.price * current.quantity;
      }
    } else if (field === 'quantity') {
      const qty = Math.max(1, parseInt(val) || 1);
      current.quantity = qty;
      current.total = current.unit_price * qty;
    } else if (field === 'unit_price') {
      const price = Math.max(0, Number(val) || 0);
      current.unit_price = price;
      current.total = price * current.quantity;
    }

    updated[index] = current;
    setLineItems(updated);
    recalcTaxes(updated, discountAmount);
  };

  const handleRemoveLineItem = (index: number) => {
    const updated = lineItems.filter((_, i) => i !== index);
    setLineItems(updated);
    recalcTaxes(updated, discountAmount);
  };

  const recalcTaxes = (items: OrderItem[], discount: number) => {
    const totals = calculateOrderTotals(items, discount, 0.05);
    setTaxAmount(totals.taxAmount);
  };

  // Calculated subtotal and total
  const totals = calculateOrderTotals(lineItems, discountAmount, 0.05, taxAmount);

  // Quick Action: Cancel / Refund Order (triggers stock restoration)
  const handleCancelOrder = (o: Order) => {
    if (confirm(`Cancel order ${o.order_number || o.id}? Any decremented stock will be restored.`)) {
      updateOrder(o.id, {
        order_status: 'cancelled',
        payment_status: 'refunded',
      });
      showToast('info', `Order ${o.order_number || o.id} marked cancelled; inventory restored`);
    }
  };

  const handleMarkPaid = (o: Order) => {
    updateOrder(o.id, {
      payment_status: 'paid',
      order_status: 'completed',
    });
    showToast('success', `Order ${o.order_number || o.id} settled as paid`);
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      showToast('error', 'Customer name is required');
      return;
    }

    if (lineItems.length === 0) {
      showToast('error', 'Order must have at least one line item');
      return;
    }

    if (editingOrder) {
      updateOrder(editingOrder.id, {
        customer_id: selectedCustomerId || null,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        items: totals.items,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        order_status: orderStatus,
        notes: orderNotes.trim() || undefined,
      });
    } else {
      addOrder({
        customer_id: selectedCustomerId || null,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        items: totals.items,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        order_status: orderStatus,
        order_date: new Date().toISOString(),
        notes: orderNotes.trim() || undefined,
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
            <ShoppingBag className="w-5 h-5 text-indigo-400" />
            Customer Orders & POS Terminal
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Collision-safe order generation, multi-item invoicing, idempotent stock deductions, and customer spend tracking
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Order</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Gross Sales Revenue</div>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
            {currencySymbol}{totalGross.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total across {orders.length} orders</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Settled / Collected</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {currencySymbol}{totalPaid.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Confirmed payments</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Pending Receivables</div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {currencySymbol}{totalPending.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting customer clearance</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="text-slate-400">Average Order Value (AOV)</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
            {currencySymbol}{aov.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Revenue per order basket</div>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by order #, customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={selectedOrderStatus}
              onChange={(e) => setSelectedOrderStatus(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Fulfillments</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Order Number & Date</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Items</th>
                <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                <th className="py-3 px-4 font-semibold">Payment</th>
                <th className="py-3 px-4 font-semibold">Fulfillment</th>
                <th className="py-3 px-4 font-semibold">Stock Decrement</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No customer orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const itemsCount = o.items ? o.items.reduce((acc, i) => acc + i.quantity, 0) : 0;
                  const isCancelled = o.order_status === 'cancelled' || o.payment_status === 'refunded';

                  return (
                    <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-100 font-mono">
                          {o.order_number || o.id}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(o.created_at || o.order_date).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{o.customer_name}</div>
                        {o.customer_phone && (
                          <div className="text-[11px] text-slate-400">{o.customer_phone}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-medium">
                          {o.items && o.items[0]?.name
                            ? `${o.items[0].name} ${o.items.length > 1 ? `+${o.items.length - 1} more` : ''}`
                            : `${itemsCount} item(s)`}
                        </div>
                        <div className="text-[11px] text-slate-400">{itemsCount} total units</div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                        {currencySymbol}{o.total_amount.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            o.payment_status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : o.payment_status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : o.payment_status === 'refunded'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {o.payment_status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase ${
                            o.order_status === 'completed'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : o.order_status === 'processing'
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                              : o.order_status === 'cancelled'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {o.order_status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {o.inventory_decremented ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" />
                            <span>Deducted</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {isCancelled ? 'Restored / Void' : 'Pending'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {o.payment_status === 'pending' && (
                            <button
                              onClick={() => handleMarkPaid(o)}
                              title="Mark as Paid"
                              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!isCancelled && (
                            <button
                              onClick={() => handleCancelOrder(o)}
                              title="Cancel / Refund Order"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-950/60 hover:text-amber-300 text-slate-400 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEdit(o)}
                            title="Edit Order"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => deleteOrder(o.id)}
                            title="Delete Order"
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

      {/* Add / Edit Order Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base">
                  {editingOrder ? `Edit Order (${editingOrder.order_number || editingOrder.id})` : 'Create New Order'}
                </h3>
                <p className="text-xs text-slate-400">Automated inventory deduction & customer ledger integration</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
              {/* Customer Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Select Existing Customer</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Direct / Walk-in Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Customer Phone</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Customer Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Line Items & Catalog Products</span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {lineItems.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-center text-slate-500">
                    No items added. Click "Add Item" to add products from catalog.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lineItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 items-center"
                      >
                        <div className="col-span-5">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Product</label>
                          <select
                            value={item.product_id || ''}
                            onChange={(e) => handleUpdateLineItem(idx, 'product_id', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({currencySymbol}{p.price})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateLineItem(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 font-mono text-right focus:outline-none"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Unit Price</label>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateLineItem(idx, 'unit_price', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 font-mono text-right focus:outline-none"
                          />
                        </div>

                        <div className="col-span-2 text-right">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Line Total</label>
                          <span className="font-mono font-bold text-slate-100 block py-1.5">
                            {currencySymbol}{(item.quantity * item.unit_price).toLocaleString()}
                          </span>
                        </div>

                        <div className="col-span-1 text-right pt-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="text-slate-400 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Calculations & Discounts */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {currencySymbol}{totals.subtotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Discount ({currencySymbol}):</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => {
                      const d = Math.max(0, Number(e.target.value) || 0);
                      setDiscountAmount(d);
                      recalcTaxes(lineItems, d);
                    }}
                    className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 font-mono text-right focus:outline-none"
                  />
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>Estimated GST / Tax (5%):</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {currencySymbol}{totals.taxAmount.toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-2 flex justify-between items-center font-bold text-sm">
                  <span className="text-slate-100">Grand Total:</span>
                  <span className="font-mono text-indigo-400 text-base">
                    {currencySymbol}{totals.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Status and Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as Order['payment_method'])}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  >
                    <option value="upi">UPI (Instant)</option>
                    <option value="card">Card / POS Terminal</option>
                    <option value="cash">Cash on Counter</option>
                    <option value="bank_transfer">NetBanking / Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  >
                    <option value="paid">Paid (Collected)</option>
                    <option value="pending">Pending (Unpaid)</option>
                    <option value="refunded">Refunded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Fulfillment Status</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  >
                    <option value="completed">Completed / Dispatched</option>
                    <option value="processing">Processing</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Order Notes / Delivery Details</label>
                <input
                  type="text"
                  placeholder="e.g. Counter pickup, gift packaging requested"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
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
                  {editingOrder ? 'Update Order' : 'Complete & Log Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
