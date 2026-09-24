import {
  Order,
  OrderItem,
  Product,
  ProductStatus,
  ServiceItem,
  Booking,
  Expense,
  InventoryMovement,
  InventoryMovementType,
  ProfitAndLossStatement,
  SalesAnalyticsSummary,
} from '../types/database';

/**
 * Generate a collision-safe, deterministic order number scoped to business.
 * Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20260908-0001)
 */
export function generateOrderNumber(businessId: string, existingOrders: Order[]): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `ORD-${year}${month}${day}`;

  // Find all orders for this business on this day
  const matchingOrders = existingOrders.filter((o) => {
    if (o.business_id !== businessId) return false;
    const num = o.order_number || '';
    return num.startsWith(datePrefix);
  });

  let maxSequence = 0;
  for (const ord of matchingOrders) {
    const num = ord.order_number || '';
    const parts = num.split('-');
    if (parts.length === 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSequence) {
        maxSequence = seq;
      }
    }
  }

  let nextSeq = maxSequence + 1;
  let candidate = `${datePrefix}-${String(nextSeq).padStart(4, '0')}`;

  // Guarantee collision safety in case of non-sequential IDs
  const existingNumbers = new Set(existingOrders.map((o) => o.order_number).filter(Boolean));
  while (existingNumbers.has(candidate)) {
    nextSeq++;
    candidate = `${datePrefix}-${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
}

/**
 * Calculate line item totals, subtotal, discount, tax, and final amount deterministically.
 */
export function calculateOrderTotals(
  items: OrderItem[],
  discountAmount: number = 0,
  taxRate: number | null = 0.05,
  taxAmountOverride?: number | null
): {
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
} {
  const normalizedItems = (items || []).map((item) => {
    const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
    const price = Math.max(0, Number(item.unit_price) || 0);
    const lineTotal = Math.round(qty * price * 100) / 100;
    return {
      ...item,
      quantity: qty,
      unit_price: price,
      total: lineTotal,
    };
  });

  const subtotal = Math.round(normalizedItems.reduce((acc, it) => acc + it.total, 0) * 100) / 100;
  const boundedDiscount = Math.max(0, Math.min(Math.round(Number(discountAmount || 0) * 100) / 100, subtotal));

  let taxAmount = 0;
  if (taxAmountOverride !== undefined && taxAmountOverride !== null) {
    taxAmount = Math.max(0, Math.round(Number(taxAmountOverride) * 100) / 100);
  } else {
    const effectiveTaxRate = taxRate !== null ? Math.max(0, Number(taxRate)) : 0;
    taxAmount = Math.round((subtotal - boundedDiscount) * effectiveTaxRate * 100) / 100;
  }

  const totalAmount = Math.max(0, Math.round((subtotal - boundedDiscount + taxAmount) * 100) / 100);

  return {
    items: normalizedItems,
    subtotal,
    discountAmount: boundedDiscount,
    taxAmount,
    totalAmount,
  };
}

/**
 * Idempotently decrement inventory when an order is completed or paid.
 * Returns updated products and new movement records.
 */
export function applyOrderInventoryDeduction(
  order: Order,
  products: Product[],
  actor?: string
): {
  updatedProducts: Product[];
  movements: InventoryMovement[];
  wasApplied: boolean;
} {
  // Idempotency check: if order was already decremented, do nothing
  if (order.inventory_decremented) {
    return {
      updatedProducts: products,
      movements: [],
      wasApplied: false,
    };
  }

  // Only apply to orders with items
  if (!order.items || order.items.length === 0) {
    return {
      updatedProducts: products,
      movements: [],
      wasApplied: false,
    };
  }

  const movements: InventoryMovement[] = [];
  const nowIso = new Date().toISOString();

  const updatedProducts = products.map((prod) => {
    // Find matching item in order
    const match = order.items.find((item) => {
      if (item.product_id && item.product_id === prod.id) return true;
      if (item.id === prod.id) return true;
      const itemSku = (item.sku || '').trim().toLowerCase();
      const prodSku = (prod.sku || '').trim().toLowerCase();
      if (itemSku && prodSku && itemSku === prodSku) return true;
      const itemName = (item.name || '').trim().toLowerCase();
      const prodName = (prod.name || '').trim().toLowerCase();
      return Boolean(itemName && prodName && itemName === prodName);
    });

    if (!match) return prod;

    const qtyToDeduct = Math.max(1, Number(match.quantity) || 1);
    const newStock = Math.max(0, prod.stock_quantity - qtyToDeduct);
    const newTotalSold = (prod.total_sold || 0) + qtyToDeduct;
    const newStatus: ProductStatus =
      newStock === 0 ? 'out_of_stock' : newStock <= 10 ? 'low_stock' : 'active';

    const movement: InventoryMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      business_id: order.business_id,
      product_id: prod.id,
      product_name: prod.name,
      movement_type: 'sale',
      quantity_change: -qtyToDeduct,
      balance_after: newStock,
      reference_id: order.id,
      reason: `Sale via Order ${order.order_number || order.id}`,
      created_by: actor || 'system',
      created_at: nowIso,
    };
    movements.push(movement);

    return {
      ...prod,
      stock_quantity: newStock,
      total_sold: newTotalSold,
      status: newStatus,
    };
  });

  return {
    updatedProducts,
    movements,
    wasApplied: movements.length > 0,
  };
}

/**
 * Idempotently restore inventory when an order is cancelled or refunded.
 */
export function applyOrderInventoryRestoration(
  order: Order,
  products: Product[],
  actor?: string
): {
  updatedProducts: Product[];
  movements: InventoryMovement[];
  wasApplied: boolean;
} {
  // Idempotency check: only restore if it was previously decremented
  if (!order.inventory_decremented) {
    return {
      updatedProducts: products,
      movements: [],
      wasApplied: false,
    };
  }

  if (!order.items || order.items.length === 0) {
    return {
      updatedProducts: products,
      movements: [],
      wasApplied: false,
    };
  }

  const movements: InventoryMovement[] = [];
  const nowIso = new Date().toISOString();

  const updatedProducts = products.map((prod) => {
    const match = order.items.find((item) => {
      if (item.product_id && item.product_id === prod.id) return true;
      if (item.id === prod.id) return true;
      const itemSku = (item.sku || '').trim().toLowerCase();
      const prodSku = (prod.sku || '').trim().toLowerCase();
      if (itemSku && prodSku && itemSku === prodSku) return true;
      const itemName = (item.name || '').trim().toLowerCase();
      const prodName = (prod.name || '').trim().toLowerCase();
      return Boolean(itemName && prodName && itemName === prodName);
    });

    if (!match) return prod;

    const qtyToRestore = Math.max(1, Number(match.quantity) || 1);
    const newStock = prod.stock_quantity + qtyToRestore;
    const newTotalSold = Math.max(0, (prod.total_sold || 0) - qtyToRestore);
    const newStatus: ProductStatus =
      newStock === 0 ? 'out_of_stock' : newStock <= 10 ? 'low_stock' : 'active';

    const movement: InventoryMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      business_id: order.business_id,
      product_id: prod.id,
      product_name: prod.name,
      movement_type: 'return_damage',
      quantity_change: qtyToRestore,
      balance_after: newStock,
      reference_id: order.id,
      reason: `Stock restoration for cancelled/refunded Order ${order.order_number || order.id}`,
      created_by: actor || 'system',
      created_at: nowIso,
    };
    movements.push(movement);

    return {
      ...prod,
      stock_quantity: newStock,
      total_sold: newTotalSold,
      status: newStatus,
    };
  });

  return {
    updatedProducts,
    movements,
    wasApplied: movements.length > 0,
  };
}

/**
 * Record a manual or administrative stock adjustment with an auditable movement record.
 */
export function recordStockAdjustment(
  product: Product,
  newQuantity: number,
  movementType: InventoryMovementType,
  reason: string,
  actor?: string,
  businessId?: string
): {
  updatedProduct: Product;
  movement: InventoryMovement;
} {
  const boundedQuantity = Math.max(0, Math.round(Number(newQuantity) || 0));
  const qtyChange = boundedQuantity - product.stock_quantity;
  const newStatus: ProductStatus =
    boundedQuantity === 0 ? 'out_of_stock' : boundedQuantity <= 10 ? 'low_stock' : 'active';

  const updatedProduct: Product = {
    ...product,
    stock_quantity: boundedQuantity,
    status: newStatus,
  };

  const movement: InventoryMovement = {
    id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    business_id: businessId || product.business_id,
    product_id: product.id,
    product_name: product.name,
    movement_type: movementType,
    quantity_change: qtyChange,
    balance_after: boundedQuantity,
    reason: reason.trim() || 'Manual stock reconciliation',
    created_by: actor || 'staff',
    created_at: new Date().toISOString(),
  };

  return {
    updatedProduct,
    movement,
  };
}

/**
 * Calculate inventory valuation and health summary.
 */
export function calculateInventoryValuation(products: Product[]): {
  totalSkus: number;
  totalUnits: number;
  costValuation: number;
  retailValuation: number;
  potentialGrossProfit: number;
  averageGrossMargin: number;
  lowStockCount: number;
  outOfStockCount: number;
  activeCount: number;
} {
  if (!products || products.length === 0) {
    return {
      totalSkus: 0,
      totalUnits: 0,
      costValuation: 0,
      retailValuation: 0,
      potentialGrossProfit: 0,
      averageGrossMargin: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      activeCount: 0,
    };
  }

  let totalUnits = 0;
  let costValuation = 0;
  let retailValuation = 0;
  let marginSum = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let activeCount = 0;

  for (const p of products) {
    const stock = Math.max(0, p.stock_quantity || 0);
    const cost = Math.max(0, p.cost || 0);
    const price = Math.max(0, p.price || 0);

    totalUnits += stock;
    costValuation += stock * cost;
    retailValuation += stock * price;
    marginSum += p.margin_pct || 0;

    if (stock === 0) {
      outOfStockCount++;
    } else if (stock <= 10) {
      lowStockCount++;
      activeCount++;
    } else {
      activeCount++;
    }
  }

  const potentialGrossProfit = Math.max(0, retailValuation - costValuation);
  const averageGrossMargin = products.length > 0 ? Math.round(marginSum / products.length) : 0;

  return {
    totalSkus: products.length,
    totalUnits,
    costValuation: Math.round(costValuation * 100) / 100,
    retailValuation: Math.round(retailValuation * 100) / 100,
    potentialGrossProfit: Math.round(potentialGrossProfit * 100) / 100,
    averageGrossMargin,
    lowStockCount,
    outOfStockCount,
    activeCount,
  };
}

/**
 * Calculate service catalog performance and booking integration metrics.
 */
export function calculateServiceMetrics(
  services: ServiceItem[],
  bookings: Booking[]
): {
  serviceStats: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    durationMinutes: number;
    bookingsCount: number;
    completedCount: number;
    totalRevenue: number;
    isActive: boolean;
  }>;
  totalBookings: number;
  totalServiceRevenue: number;
  topService: { name: string; revenue: number } | null;
} {
  const statsMap: Record<
    string,
    {
      id: string;
      name: string;
      category: string;
      price: number;
      durationMinutes: number;
      bookingsCount: number;
      completedCount: number;
      totalRevenue: number;
      isActive: boolean;
    }
  > = {};

  for (const srv of services) {
    statsMap[srv.id] = {
      id: srv.id,
      name: srv.name,
      category: srv.category || 'General',
      price: Number(srv.price) || 0,
      durationMinutes: Number(srv.duration_minutes) || 45,
      bookingsCount: 0,
      completedCount: 0,
      totalRevenue: 0,
      isActive: srv.is_active !== false && srv.status !== 'inactive',
    };
  }

  let totalBookings = 0;
  let totalServiceRevenue = 0;

  for (const bk of bookings) {
    if (bk.status === 'cancelled') continue;
    totalBookings++;

    const isRevenueEligible =
      bk.payment_status === 'paid' || bk.status === 'completed' || bk.status === 'confirmed';

    const amt = Number(bk.amount) || 0;
    if (isRevenueEligible) {
      totalServiceRevenue += amt;
    }

    // Match service by ID or name
    let matchedId = bk.service_id;
    if (!matchedId || !statsMap[matchedId]) {
      const bkService = (bk.service_name || '').trim().toLowerCase();
      const matchByName = services.find(
        (s) => bkService && (s.name || '').trim().toLowerCase() === bkService
      );
      if (matchByName) matchedId = matchByName.id;
    }

    if (matchedId && statsMap[matchedId]) {
      statsMap[matchedId].bookingsCount++;
      if (bk.status === 'completed') {
        statsMap[matchedId].completedCount++;
      }
      if (isRevenueEligible) {
        statsMap[matchedId].totalRevenue += amt;
      }
    }
  }

  const serviceStats = Object.values(statsMap);
  serviceStats.sort((a, b) => b.totalRevenue - a.totalRevenue);

  const topService =
    serviceStats.length > 0 && serviceStats[0].totalRevenue > 0
      ? { name: serviceStats[0].name, revenue: serviceStats[0].totalRevenue }
      : null;

  return {
    serviceStats,
    totalBookings,
    totalServiceRevenue: Math.round(totalServiceRevenue * 100) / 100,
    topService,
  };
}

/**
 * Calculate Grounded Profit and Loss (P&L) Statement.
 * Gross Revenue = Orders Revenue + Bookings Revenue
 * COGS = Product unit cost * sold items in completed orders
 * Gross Profit = Gross Revenue - COGS
 * Operating Expenses = Sum of expense records
 * Net Operating Profit = Gross Profit - Operating Expenses
 * Zero fake data: if no data exists, evidence state is flagged as 'insufficient_data'.
 */
export function calculateProfitAndLoss(
  orders: Order[],
  bookings: Booking[],
  expenses: Expense[],
  products: Product[]
): ProfitAndLossStatement {
  // Build lookup map for product unit costs
  const productCostMap: Record<string, number> = {};
  const productNameCostMap: Record<string, number> = {};
  for (const p of products) {
    productCostMap[p.id] = Number(p.cost) || 0;
    if (p.name) {
      productNameCostMap[p.name.trim().toLowerCase()] = Number(p.cost) || 0;
    }
  }

  // Calculate Orders Revenue & COGS
  let ordersRevenue = 0;
  let cogs = 0;
  let eligibleOrdersCount = 0;

  for (const ord of orders) {
    if (ord.order_status === 'cancelled' || ord.payment_status === 'refunded') continue;

    const isRevenueEligible =
      ord.payment_status === 'paid' ||
      ord.order_status === 'completed' ||
      ord.order_status === 'delivered';

    if (isRevenueEligible) {
      eligibleOrdersCount++;
      ordersRevenue += Number(ord.total_amount) || 0;

      // Calculate COGS from line items
      if (ord.items && ord.items.length > 0) {
        for (const item of ord.items) {
          const qty = Number(item.quantity) || 1;
          let unitCost = item.unit_cost;
          if (unitCost === undefined || unitCost === null) {
            const itemNameKey = (item.name || '').trim().toLowerCase();
            if (item.product_id && productCostMap[item.product_id] !== undefined) {
              unitCost = productCostMap[item.product_id];
            } else if (item.id && productCostMap[item.id] !== undefined) {
              unitCost = productCostMap[item.id];
            } else if (itemNameKey && productNameCostMap[itemNameKey] !== undefined) {
              unitCost = productNameCostMap[itemNameKey];
            } else {
              unitCost = 0;
            }
          }
          cogs += qty * unitCost;
        }
      }
    }
  }

  // Calculate Bookings Revenue
  let bookingsRevenue = 0;
  let eligibleBookingsCount = 0;

  for (const bk of bookings) {
    if (bk.status === 'cancelled') continue;
    const isRevenueEligible =
      bk.payment_status === 'paid' || bk.status === 'completed' || bk.status === 'confirmed';

    if (isRevenueEligible) {
      eligibleBookingsCount++;
      bookingsRevenue += Number(bk.amount) || 0;
    }
  }

  const grossRevenue = Math.round((ordersRevenue + bookingsRevenue) * 100) / 100;
  const roundedCogs = Math.round(cogs * 100) / 100;
  const grossProfit = Math.round((grossRevenue - roundedCogs) * 100) / 100;
  const grossMarginPct =
    grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 1000) / 10 : 0;

  // Operating Expenses by Category
  const expensesByCategory: Record<string, number> = {
    rent: 0,
    salaries: 0,
    inventory: 0,
    marketing: 0,
    software: 0,
    utilities: 0,
    logistics: 0,
    other: 0,
  };

  let totalOpex = 0;
  for (const exp of expenses) {
    const amt = Number(exp.amount) || 0;
    totalOpex += amt;

    const cat = (exp.category || 'other').toLowerCase();
    if (cat.includes('rent')) expensesByCategory.rent += amt;
    else if (cat.includes('salar') || cat.includes('payroll')) expensesByCategory.salaries += amt;
    else if (cat.includes('inv') || cat.includes('material')) expensesByCategory.inventory += amt;
    else if (cat.includes('mark') || cat.includes('ad')) expensesByCategory.marketing += amt;
    else if (cat.includes('soft') || cat.includes('tool')) expensesByCategory.software += amt;
    else if (cat.includes('util') || cat.includes('bill')) expensesByCategory.utilities += amt;
    else if (cat.includes('logis') || cat.includes('ship')) expensesByCategory.logistics += amt;
    else expensesByCategory.other += amt;
  }

  const operatingExpenses = Math.round(totalOpex * 100) / 100;
  const netOperatingProfit = Math.round((grossProfit - operatingExpenses) * 100) / 100;
  const netMarginPct =
    grossRevenue > 0 ? Math.round((netOperatingProfit / grossRevenue) * 1000) / 10 : 0;

  const hasSufficientRevenueData = eligibleOrdersCount > 0 || eligibleBookingsCount > 0;
  const hasSufficientExpenseData = expenses.length > 0;

  let evidenceState: 'observed' | 'calculated' | 'insufficient_data' = 'insufficient_data';
  if (hasSufficientRevenueData && hasSufficientExpenseData) {
    evidenceState = 'calculated';
  } else if (hasSufficientRevenueData || hasSufficientExpenseData) {
    evidenceState = 'observed';
  }

  return {
    grossRevenue,
    ordersRevenue: Math.round(ordersRevenue * 100) / 100,
    bookingsRevenue: Math.round(bookingsRevenue * 100) / 100,
    cogs: roundedCogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses,
    expensesByCategory,
    netOperatingProfit,
    netMarginPct,
    hasSufficientRevenueData,
    hasSufficientExpenseData,
    evidenceState,
  };
}

/**
 * Calculate comprehensive Sales & Operational Analytics.
 */
export function calculateSalesAnalytics(
  orders: Order[],
  bookings: Booking[],
  products: Product[],
  expenses: Expense[]
): SalesAnalyticsSummary {
  if (!orders || orders.length === 0) {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      paidOrdersCount: 0,
      pendingOrdersCount: 0,
      cancelledOrdersCount: 0,
      ordersByPaymentMethod: {},
      ordersBySource: {},
      topProductsByRevenue: [],
      topProductsByUnits: [],
      hasSufficientData: false,
      evidenceState: 'insufficient_data',
    };
  }

  let totalRevenue = 0;
  let paidOrdersCount = 0;
  let pendingOrdersCount = 0;
  let cancelledOrdersCount = 0;
  const ordersByPaymentMethod: Record<string, { count: number; total: number }> = {};
  const ordersBySource: Record<string, { count: number; total: number }> = {};

  const productRevMap: Record<
    string,
    { id: string; name: string; quantity: number; revenue: number; grossProfit: number }
  > = {};

  // Build product cost lookup
  const costLookup: Record<string, number> = {};
  for (const p of products) {
    costLookup[p.id] = Number(p.cost) || 0;
    if (p.name) {
      costLookup[p.name.trim().toLowerCase()] = Number(p.cost) || 0;
    }
  }

  for (const ord of orders) {
    if (ord.order_status === 'cancelled') {
      cancelledOrdersCount++;
      continue;
    }

    const isPaid = ord.payment_status === 'paid' || ord.order_status === 'completed';
    if (isPaid) {
      paidOrdersCount++;
      const amt = Number(ord.total_amount) || 0;
      totalRevenue += amt;

      // Group by payment method
      const pm = ord.payment_method || 'other';
      if (!ordersByPaymentMethod[pm]) ordersByPaymentMethod[pm] = { count: 0, total: 0 };
      ordersByPaymentMethod[pm].count++;
      ordersByPaymentMethod[pm].total += amt;

      // Group by source
      const src = ord.source || 'direct';
      if (!ordersBySource[src]) ordersBySource[src] = { count: 0, total: 0 };
      ordersBySource[src].count++;
      ordersBySource[src].total += amt;

      // Track item sales
      if (ord.items && ord.items.length > 0) {
        for (const item of ord.items) {
          const itemKey = item.product_id || item.id || item.name;
          const qty = Number(item.quantity) || 1;
          const itemTotal = Number(item.total) || qty * (Number(item.unit_price) || 0);
          const itemNameKey = (item.name || '').trim().toLowerCase();
          const unitCost =
            item.unit_cost !== undefined
              ? item.unit_cost
              : costLookup[item.product_id || ''] || (itemNameKey ? costLookup[itemNameKey] : 0) || 0;
          const profit = itemTotal - qty * unitCost;

          if (!productRevMap[itemKey]) {
            productRevMap[itemKey] = {
              id: itemKey,
              name: item.name,
              quantity: 0,
              revenue: 0,
              grossProfit: 0,
            };
          }
          productRevMap[itemKey].quantity += qty;
          productRevMap[itemKey].revenue += itemTotal;
          productRevMap[itemKey].grossProfit += profit;
        }
      }
    } else {
      pendingOrdersCount++;
    }
  }

  const eligibleOrdersCount = paidOrdersCount;
  const averageOrderValue =
    eligibleOrdersCount > 0 ? Math.round(totalRevenue / eligibleOrdersCount) : 0;

  const productSales = Object.values(productRevMap);
  const topProductsByRevenue = [...productSales].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topProductsByUnits = [...productSales].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders: orders.length,
    averageOrderValue,
    paidOrdersCount,
    pendingOrdersCount,
    cancelledOrdersCount,
    ordersByPaymentMethod,
    ordersBySource,
    topProductsByRevenue,
    topProductsByUnits,
    hasSufficientData: eligibleOrdersCount > 0,
    evidenceState: eligibleOrdersCount > 0 ? 'calculated' : 'insufficient_data',
  };
}

/**
 * Format currency with locale and symbol.
 */
export function formatCurrency(amount: number, currencySymbol: string = '₹'): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `${currencySymbol}${Math.round(safeAmount).toLocaleString('en-IN')}`;
}

/**
 * Generate a printable text P&L statement.
 */
export function generateProfitAndLossReport(
  pnl: ProfitAndLossStatement,
  businessName: string,
  currencySymbol: string = '₹'
): string {
  const dateStr = new Date().toISOString().split('T')[0];
  return `============================================================
PROFIT & LOSS STATEMENT (INCOME STATEMENT)
Business: ${businessName}
Generated Date: ${dateStr}
Evidence State: ${pnl.evidenceState.toUpperCase()}
============================================================

1. OPERATING REVENUE
   - Orders Revenue:            ${currencySymbol}${pnl.ordersRevenue.toLocaleString()}
   - Bookings Revenue:          ${currencySymbol}${pnl.bookingsRevenue.toLocaleString()}
   ------------------------------------------------------------
   GROSS REVENUE:               ${currencySymbol}${pnl.grossRevenue.toLocaleString()}

2. COST OF GOODS SOLD (COGS)
   - Product Unit Acquisition:  ${currencySymbol}${pnl.cogs.toLocaleString()}
   ------------------------------------------------------------
   GROSS PROFIT:                ${currencySymbol}${pnl.grossProfit.toLocaleString()} (${pnl.grossMarginPct}%)

3. OPERATING EXPENSES (OpEx)
   - Rent & Facilities:         ${currencySymbol}${pnl.expensesByCategory.rent.toLocaleString()}
   - Salaries & Staff:          ${currencySymbol}${pnl.expensesByCategory.salaries.toLocaleString()}
   - Inventory & Storage:       ${currencySymbol}${pnl.expensesByCategory.inventory.toLocaleString()}
   - Marketing & Ads:           ${currencySymbol}${pnl.expensesByCategory.marketing.toLocaleString()}
   - Software & Tools:          ${currencySymbol}${pnl.expensesByCategory.software.toLocaleString()}
   - Utilities & Bills:         ${currencySymbol}${pnl.expensesByCategory.utilities.toLocaleString()}
   - Logistics & Shipping:      ${currencySymbol}${pnl.expensesByCategory.logistics.toLocaleString()}
   - Other General Overhead:    ${currencySymbol}${pnl.expensesByCategory.other.toLocaleString()}
   ------------------------------------------------------------
   TOTAL OPERATING EXPENSES:    ${currencySymbol}${pnl.operatingExpenses.toLocaleString()}

============================================================
NET OPERATING PROFIT (EBIT):    ${currencySymbol}${pnl.netOperatingProfit.toLocaleString()} (${pnl.netMarginPct}%)
============================================================
`;
}
