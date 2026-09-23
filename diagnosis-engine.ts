import {
  Business,
  BusinessMetrics,
  AIDiagnosis,
  Order,
  Expense,
  Customer,
  Lead,
  Product,
  Booking,
  MetricEvidenceInfo,
} from '../types/database';
import {
  isTodayInTimezone,
  isCurrentMonthInTimezone,
  isPreviousMonthInTimezone,
  getDaysElapsedInCurrentMonth,
} from './period-safety';

export function calculateBusinessMetrics(
  business: Business,
  orders: Order[],
  expenses: Expense[],
  customers: Customer[],
  leads: Lead[],
  bookings: Booking[],
  products: Product[]
): BusinessMetrics {
  const timezone = business.timezone || 'Asia/Kolkata';
  const currencySymbol = business.currency_symbol || '₹';

  // 1. ORDERS & REVENUE AUDIT
  const paidOrders = orders.filter((o) => o.payment_status === 'paid');
  const paidOrdersTotal = paidOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  const paidBookings = bookings.filter((b) => b.payment_status === 'paid' || b.status === 'confirmed');
  const paidBookingsTotal = paidBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const totalRevenue = paidOrdersTotal + paidBookingsTotal;
  const totalOrders = orders.length;
  const totalBookings = bookings.length;
  const totalTransactionsCount = paidOrders.length + paidBookings.length;
  const hasTransactions = totalOrders > 0 || totalBookings > 0;
  const hasSufficientRevenueData = hasTransactions && totalRevenue > 0;

  // 2. EXPENSES & OPERATING PROFIT
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const hasSufficientExpenseData = expenses.length > 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
  const netProfitMargin = Math.round(profitMargin * 10) / 10;
  const hasSufficientProfitData = hasSufficientRevenueData;

  // 3. PERIOD & TIMEZONE SAFETY AUDIT
  const todayOrders = paidOrders.filter((o) => isTodayInTimezone(o.order_date || o.created_at || '', timezone));
  const todayBookings = paidBookings.filter((b) => isTodayInTimezone(b.booking_date || b.created_at || '', timezone));
  const todayRevenue =
    todayOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) +
    todayBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const todayOrdersCount = todayOrders.length + todayBookings.length;

  const currentMonthOrders = paidOrders.filter((o) =>
    isCurrentMonthInTimezone(o.order_date || o.created_at || '', timezone)
  );
  const currentMonthBookings = paidBookings.filter((b) =>
    isCurrentMonthInTimezone(b.booking_date || b.created_at || '', timezone)
  );
  const currentMonthRevenue =
    currentMonthOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) +
    currentMonthBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const currentMonthOrdersCount = currentMonthOrders.length + currentMonthBookings.length;

  const currentMonthExpensesList = expenses.filter((e) =>
    isCurrentMonthInTimezone(e.expense_date || e.created_at || '', timezone)
  );
  const currentMonthExpenses = currentMonthExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const currentMonthNetProfit = currentMonthRevenue - currentMonthExpenses;

  const previousMonthOrders = paidOrders.filter((o) =>
    isPreviousMonthInTimezone(o.order_date || o.created_at || '', timezone)
  );
  const previousMonthBookings = paidBookings.filter((b) =>
    isPreviousMonthInTimezone(b.booking_date || b.created_at || '', timezone)
  );
  const previousMonthRevenue =
    previousMonthOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) +
    previousMonthBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // 4. MONTHLY RUN-RATE PROJECTION
  const { elapsed: daysElapsed, total: daysInMonth } = getDaysElapsedInCurrentMonth(timezone);
  let currentRunRate = 0;
  let targetMonthlyRunRateProgress: number | null = null;
  let hasSufficientRunRateData = false;

  if (currentMonthRevenue > 0 && daysElapsed > 0) {
    currentRunRate = Math.round((currentMonthRevenue / daysElapsed) * daysInMonth);
    hasSufficientRunRateData = true;
    if (business.monthly_revenue_target && business.monthly_revenue_target > 0) {
      targetMonthlyRunRateProgress = Math.min(100, Math.round((currentRunRate / business.monthly_revenue_target) * 100));
    }
  } else if (totalRevenue > 0) {
    // If no transactions in current month yet, but historical transactions exist
    currentRunRate = currentMonthRevenue;
    hasSufficientRunRateData = true;
    if (business.monthly_revenue_target && business.monthly_revenue_target > 0) {
      targetMonthlyRunRateProgress = 0;
    }
  }

  // 5. CUSTOMERS & RETENTION COHORTS
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(
    (c) => c.status === 'active' || c.status === 'vip' || c.status === 'repeat'
  ).length;

  // Check customer records and multi-order matches
  const customerOrderCounts = new Map<string, number>();
  orders.forEach((o) => {
    if (o.customer_id) {
      customerOrderCounts.set(o.customer_id, (customerOrderCounts.get(o.customer_id) || 0) + 1);
    }
  });

  const repeatCustomers = customers.filter(
    (c) =>
      c.status === 'repeat' ||
      c.status === 'vip' ||
      (Number(c.total_orders) || 0) > 1 ||
      (customerOrderCounts.get(c.id) || 0) > 1
  ).length;

  const hasSufficientRepeatData = totalCustomers > 0 && hasTransactions;
  const repeatCustomerRate = hasSufficientRepeatData
    ? Math.round((repeatCustomers / totalCustomers) * 100)
    : 0;

  // 6. LEADS & CONVERSION
  const totalLeads = leads.length;
  const convertedLeads = leads.filter(
    (l) => l.status === 'converted' || l.converted_to_customer_id != null
  ).length;
  const hasSufficientLeadData = totalLeads > 0;
  const leadConversionRate = hasSufficientLeadData
    ? Math.round((convertedLeads / totalLeads) * 100)
    : 0;

  // 7. AVERAGE ORDER VALUE (AOV)
  const hasSufficientAovData = totalTransactionsCount > 0;
  const avgOrderValue = hasSufficientAovData ? Math.round(totalRevenue / totalTransactionsCount) : 0;
  const averageOrderValue = avgOrderValue;

  // 8. GROSS MARGIN
  const productsWithMargin = products.filter(
    (p) =>
      (p.margin_pct != null && !isNaN(Number(p.margin_pct))) ||
      (p.price != null && p.cost != null && Number(p.price) > 0)
  );
  const hasSufficientMarginData = productsWithMargin.length > 0;
  const grossMargin = hasSufficientMarginData
    ? Math.round(
        productsWithMargin.reduce((acc, p) => {
          if (p.margin_pct != null && !isNaN(Number(p.margin_pct))) return acc + Number(p.margin_pct);
          if (p.price && p.cost && Number(p.price) > 0) {
            return acc + ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100;
          }
          return acc;
        }, 0) / productsWithMargin.length
      )
    : null;

  // 9. HEALTH SCORE (GROUNDED AUDIT ONLY — NO FAKE DEFAULT 50)
  let healthScore: number | null = null;
  let healthBand: string = 'Insufficient Data';
  const hasSufficientHealthData = hasTransactions;

  if (hasSufficientHealthData) {
    let score = 50;
    if (profitMargin > 30) score += 15;
    else if (profitMargin > 15) score += 10;
    else if (profitMargin < 0) score -= 15;

    if (hasSufficientRepeatData) {
      if (repeatCustomerRate >= 40) score += 15;
      else if (repeatCustomerRate >= 20) score += 10;
    }

    if (hasSufficientLeadData) {
      if (leadConversionRate >= 30) score += 10;
      else if (leadConversionRate >= 15) score += 5;
    }

    if (products.length > 0 && products.some((p) => p.stock_quantity === 0)) score -= 10;
    if (leads.some((l) => l.status === 'new' && (Number(l.score) || 0) >= 80)) score -= 5;

    healthScore = Math.min(100, Math.max(10, score));
    healthBand =
      healthScore >= 80 ? 'Excellent' : healthScore >= 65 ? 'Good' : healthScore >= 45 ? 'Needs Attention' : 'Critical';
  }

  // 10. MISSING DATA REASONS
  const missingDataReasons: string[] = [];
  if (!hasTransactions) {
    missingDataReasons.push('Zero sales orders or service bookings recorded in tenant database.');
  }
  if (!hasSufficientExpenseData) {
    missingDataReasons.push('Zero expense records logged to compute true net operating margins.');
  }
  if (totalCustomers === 0) {
    missingDataReasons.push('Zero customer records found to calculate cohort retention.');
  }
  if (!hasSufficientLeadData) {
    missingDataReasons.push('Zero inbound leads logged to calculate sales funnel conversion velocity.');
  }
  if (!hasSufficientMarginData) {
    missingDataReasons.push('Catalog products lack cost and pricing data to audit gross margins.');
  }

  // 11. AUDIT PROVENANCE & EVIDENCE TRACE
  const metricsEvidence: Record<string, MetricEvidenceInfo> = {
    totalRevenue: {
      state: hasSufficientRevenueData ? 'calculated' : 'insufficient_data',
      source: 'orders (total_amount where payment_status = paid) + bookings (amount)',
      details: hasSufficientRevenueData
        ? `${paidOrders.length} paid order(s) (${currencySymbol}${paidOrdersTotal.toLocaleString('en-IN')}) + ${paidBookings.length} paid booking(s) (${currencySymbol}${paidBookingsTotal.toLocaleString('en-IN')})`
        : '0 paid orders or bookings recorded in database.',
    },
    netProfit: {
      state: hasSufficientProfitData ? 'calculated' : 'insufficient_data',
      source: 'orders, bookings, expenses (tables)',
      details: hasSufficientProfitData
        ? `Revenue (${currencySymbol}${totalRevenue.toLocaleString('en-IN')}) - Expenses (${currencySymbol}${totalExpenses.toLocaleString('en-IN')})`
        : 'Requires verified sales transactions to calculate operating profit.',
    },
    expenses: {
      state: hasSufficientExpenseData ? 'observed' : 'observed',
      source: 'expenses (table: amount where business_id = business.id)',
      details: hasSufficientExpenseData
        ? `${expenses.length} expense record(s) audited (${currencySymbol}${totalExpenses.toLocaleString('en-IN')} total).`
        : '0 expense records logged for this tenant.',
    },
    grossMargin: {
      state: hasSufficientMarginData ? 'calculated' : 'insufficient_data',
      source: 'products (table: price, cost, margin_pct)',
      details: hasSufficientMarginData
        ? `Averaged across ${productsWithMargin.length} catalog SKU(s) with recorded margin/cost data.`
        : 'No products in catalog have cost/price margin data recorded.',
    },
    totalOrders: {
      state: 'observed',
      source: 'orders (table: count where business_id = business.id)',
      details: `${orders.length} order record(s) in active database (${paidOrders.length} paid).`,
    },
    totalCustomers: {
      state: 'observed',
      source: 'customers (table: count where business_id = business.id)',
      details: `${customers.length} customer record(s) in CRM directory.`,
    },
    repeatCustomerRate: {
      state: hasSufficientRepeatData ? 'calculated' : 'insufficient_data',
      source: 'customers (total_orders > 1 or status = repeat/vip) + orders (by customer_id)',
      details: hasSufficientRepeatData
        ? `${repeatCustomers} repeat customer(s) out of ${totalCustomers} total customer(s).`
        : 'Requires active customer directory and transaction history.',
    },
    avgOrderValue: {
      state: hasSufficientAovData ? 'calculated' : 'insufficient_data',
      source: 'orders, bookings (tables: total_amount / transaction count)',
      details: hasSufficientAovData
        ? `${currencySymbol}${totalRevenue.toLocaleString('en-IN')} total revenue / ${totalTransactionsCount} paid transaction(s).`
        : 'No verified transactions recorded.',
    },
    totalLeads: {
      state: 'observed',
      source: 'leads (table: count where business_id = business.id)',
      details: `${leads.length} inbound lead record(s) recorded in CRM.`,
    },
    totalBookings: {
      state: 'observed',
      source: 'bookings (table: count where business_id = business.id)',
      details: `${bookings.length} service booking record(s) audited.`,
    },
    leadConversionRate: {
      state: hasSufficientLeadData ? 'calculated' : 'insufficient_data',
      source: 'leads (table: status = converted or converted_to_customer_id)',
      details: hasSufficientLeadData
        ? `${convertedLeads} converted lead(s) out of ${totalLeads} total lead(s).`
        : 'No leads logged in CRM.',
    },
    healthScore: {
      state: hasSufficientHealthData ? 'calculated' : 'insufficient_data',
      source: 'orders, bookings, expenses, customers, leads, products (composite audit)',
      details: hasSufficientHealthData
        ? `Algorithmic score evaluated across verified margins, repeat rate, conversion, and inventory availability.`
        : 'Requires sales transaction data to establish a business health baseline.',
    },
    targetMonthlyRunRate: {
      state: hasSufficientRunRateData ? 'calculated' : 'insufficient_data',
      source: 'orders, bookings (current month in business timezone) / days elapsed * days in month',
      details: hasSufficientRunRateData
        ? `Projected pace of ${currencySymbol}${currentRunRate.toLocaleString('en-IN')} based on ${daysElapsed} day(s) elapsed in current month.`
        : 'No revenue records in current period to calculate monthly run rate.',
    },
  };

  const hasSufficientData = hasTransactions;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin: netProfitMargin,
    netProfitMargin,
    grossMargin,
    currentRunRate,
    healthScore,
    healthBand,
    totalOrders,
    totalBookings,
    totalCustomers,
    activeCustomers,
    repeatCustomers,
    repeatCustomerRate,
    totalLeads,
    convertedLeads,
    leadConversionRate,
    avgOrderValue,
    averageOrderValue,
    hasSufficientData,
    missingDataReasons,

    hasSufficientRevenueData,
    hasSufficientProfitData,
    hasSufficientExpenseData,
    hasSufficientMarginData,
    hasSufficientRepeatData,
    hasSufficientLeadData,
    hasSufficientBookingData: totalBookings > 0,
    hasSufficientHealthData,
    hasSufficientAovData,
    hasSufficientRunRateData,

    todayRevenue,
    todayOrdersCount,
    currentMonthRevenue,
    currentMonthExpenses,
    currentMonthNetProfit,
    currentMonthOrdersCount,
    previousMonthRevenue,
    targetMonthlyRunRateProgress,

    metricsEvidence,
  };
}

export function generateDeterministicDiagnoses(
  business: Business,
  metrics: BusinessMetrics,
  orders: Order[],
  expenses: Expense[],
  customers: Customer[],
  leads: Lead[],
  products: Product[],
  bookings: Booking[]
): AIDiagnosis[] {
  const diagnoses: AIDiagnosis[] = [];
  const currencySymbol = business.currency_symbol || '₹';

  // 1. Critical Stockouts on Catalog SKUs
  const stockoutProds = products.filter((p) => p.status === 'out_of_stock' || p.stock_quantity === 0);
  if (stockoutProds.length > 0) {
    const names = stockoutProds.map((p) => p.name).join(', ');
    diagnoses.push({
      id: `diag_stockout_${Date.now()}`,
      business_id: business.id,
      problem_title: `Critical Stockout on ${stockoutProds.length} Catalog SKU(s)`,
      problem_description: `Items currently at zero inventory: ${names}. This directly halts order fulfillment and customer reorders.`,
      category: 'operational',
      evidence: `Stock level = 0 units recorded in products table for ${stockoutProds.length} item(s): ${names}.`,
      affected_metric: 'Catalog Availability & Revenue Capacity',
      source_data: 'products (table: stock_quantity = 0)',
      confidence: 98,
      severity: 'critical',
      recommended_action: `Issue restock purchase order for buffer stock on out-of-stock items.`,
      requires_human_approval: true,
      expected_kpi: `Restore catalog availability and capture repeat demand`,
      effort: 'quick_win',
      status: 'open',
      created_at: new Date().toISOString(),
    });
  }

  // 2. High-Intent Inbound Leads Pending Follow-Up
  const hotLeads = leads.filter((l) => (Number(l.score) || 0) >= 80 && (l.status === 'new' || l.status === 'contacted'));
  if (hotLeads.length > 0) {
    const totalEstValue = hotLeads.reduce((sum, l) => sum + (Number(l.budget) || 2000), 0);
    diagnoses.push({
      id: `diag_hot_leads_${Date.now()}`,
      business_id: business.id,
      problem_title: `${hotLeads.length} High-Intent Inbound Lead(s) Awaiting Follow-Up`,
      problem_description: `Prospective clients registered high purchase interest but have not yet received priority follow-up.`,
      category: 'growth',
      evidence: `${hotLeads.length} lead(s) with AI score >= 80 in new/contacted status. Pipeline volume: ${currencySymbol}${totalEstValue.toLocaleString('en-IN')}.`,
      affected_metric: 'Lead Conversion Rate',
      source_data: 'leads (table: score >= 80 and status in (new, contacted))',
      confidence: 94,
      severity: 'warning',
      recommended_action: `Trigger automated WhatsApp outreach with booking calendar link.`,
      requires_human_approval: true,
      expected_kpi: `Convert estimated ${Math.ceil(hotLeads.length * 0.5)} new client(s) (+${currencySymbol}${Math.ceil(totalEstValue * 0.5).toLocaleString('en-IN')})`,
      effort: 'quick_win',
      status: 'open',
      created_at: new Date().toISOString(),
    });
  }

  // 3. Repeat Customer Cohort Retention (STRICT: Requires >= 3 customers AND >= 3 orders)
  if (metrics.hasSufficientRepeatData && metrics.totalCustomers >= 3 && metrics.totalOrders >= 3 && metrics.repeatCustomerRate < 35) {
    diagnoses.push({
      id: `diag_replenish_${Date.now()}`,
      business_id: business.id,
      problem_title: `Sub-Optimal Repeat Customer Rate (${metrics.repeatCustomerRate}%)`,
      problem_description: `Observed customer transaction history indicates low repurchase frequency. Systematic re-engagement can reactivate past buyers.`,
      category: 'retention',
      evidence: `Only ${metrics.repeatCustomers} of ${metrics.totalCustomers} registered customers have placed multiple orders across ${metrics.totalOrders} total recorded orders.`,
      affected_metric: 'Repeat Customer Retention Rate',
      source_data: 'customers & orders (tables: total_orders and order history)',
      confidence: 91,
      severity: 'opportunity',
      recommended_action: `Activate automated refill reminder notification with a 1-click reorder privilege.`,
      requires_human_approval: true,
      expected_kpi: `Lift repeat customer rate towards 40%+ industry benchmark`,
      effort: 'medium',
      status: 'open',
      created_at: new Date().toISOString(),
    });
  }

  // 4. Fixed Overhead vs Service Schedule (STRICT: Requires rent expense AND >= 3 bookings)
  const rentExpense = expenses.find((e) => e.category === 'rent');
  if (rentExpense && bookings.length >= 3) {
    const weekdayBookings = bookings.filter((b) => {
      const day = new Date(b.booking_date || b.created_at).getDay();
      return day >= 1 && day <= 5;
    }).length;
    const weekendBookings = bookings.filter((b) => {
      const day = new Date(b.booking_date || b.created_at).getDay();
      return day === 0 || day === 6;
    }).length;

    diagnoses.push({
      id: `diag_room_occupancy_${Date.now()}`,
      business_id: business.id,
      problem_title: `Weekday vs Weekend Service Capacity Imbalance`,
      problem_description: `Facility rent is ${currencySymbol}${Number(rentExpense.amount).toLocaleString('en-IN')}/mo. Ingested booking records show ${weekdayBookings} weekday sessions vs ${weekendBookings} weekend sessions.`,
      category: 'operational',
      evidence: `Fixed rent overhead = ${currencySymbol}${Number(rentExpense.amount).toLocaleString('en-IN')}. Recorded appointments: ${weekdayBookings} weekdays vs ${weekendBookings} weekends.`,
      affected_metric: 'Net Operating Margin & Capacity Utilization',
      source_data: 'expenses & bookings (tables: rent category + booking_date schedule)',
      confidence: 88,
      severity: 'opportunity',
      recommended_action: `Introduce off-peak weekday packages to monetize open service slots.`,
      requires_human_approval: true,
      expected_kpi: `Increase weekday facility utilization without raising lease cost`,
      effort: 'medium',
      status: 'open',
      created_at: new Date().toISOString(),
    });
  }

  // 5. INSUFFICIENT DATA DIAGNOSIS (If database lacks operational history or findings)
  if (diagnoses.length === 0 || !metrics.hasSufficientData) {
    diagnoses.push({
      id: `diag_insufficient_data_${Date.now()}`,
      business_id: business.id,
      problem_title: 'Insufficient Data for Comprehensive Operational Audit',
      problem_description: 'Active database records are currently insufficient to evaluate historical trends, sales velocity, or retention cohorts. Business Doctor AI refuses to invent fake metrics or trends.',
      category: 'operational',
      evidence: `Database state: ${orders.length} order(s), ${bookings.length} booking(s), ${customers.length} customer(s), ${leads.length} lead(s), ${expenses.length} expense(s). Minimum verified transaction history required.`,
      affected_metric: 'Full Operational Baseline',
      source_data: 'orders, bookings, customers, leads, expenses (tenant database)',
      confidence: 100,
      severity: 'info',
      recommended_action: 'Import verified historical order/booking records or connect active POS sources to establish a reliable baseline.',
      requires_human_approval: false,
      expected_kpi: 'Establish verified Day 1 baseline for algorithmic diagnosis',
      effort: 'quick_win',
      status: 'open',
      created_at: new Date().toISOString(),
    });
  }

  return diagnoses;
}

export function generateDeterministicAgentActions(
  business: Business,
  metrics: BusinessMetrics,
  customers: Customer[],
  leads: Lead[],
  products: Product[],
  bookings: Booking[],
  expenses: Expense[],
  existingActions: Array<{ action_type: string; target_entity: string; entity_id: string | null }>
): Array<{
  agent_name: string;
  action_type: string;
  target_entity: string;
  entity_id: string | null;
  proposed_payload: Record<string, any>;
  impact_level: 'low' | 'medium' | 'high';
  confidence: number;
  reasoning: string;
}> {
  const actions: Array<{
    agent_name: string;
    action_type: string;
    target_entity: string;
    entity_id: string | null;
    proposed_payload: Record<string, any>;
    impact_level: 'low' | 'medium' | 'high';
    confidence: number;
    reasoning: string;
  }> = [];

  const isDuplicate = (actionType: string, target: string, entityId: string | null) => {
    return existingActions.some(
      (a) =>
        (entityId && a.entity_id === entityId && a.action_type === actionType) ||
        (a.action_type === actionType && a.target_entity === target)
    );
  };

  // 1. Growth & Inbound Agent: Hot leads awaiting outreach
  const hotLeads = leads.filter((l) => (Number(l.score) || 0) >= 80 && (l.status === 'new' || l.status === 'contacted'));
  for (const lead of hotLeads.slice(0, 2)) {
    const actionType = 'Speed-to-Lead WhatsApp Outreach';
    const target = `Lead: ${lead.name} (${lead.phone || 'Phone'})`;
    if (!isDuplicate(actionType, target, lead.id)) {
      actions.push({
        agent_name: 'Growth & Inbound Agent',
        action_type: actionType,
        target_entity: target,
        entity_id: lead.id,
        proposed_payload: {
          channel: 'WhatsApp',
          recipient: lead.phone || '+91 98765 43210',
          message: `Namaste ${lead.name.split(' ')[0]}! We noticed your inquiry regarding ${lead.notes || 'our services'}. Would you like to reserve a 15-min priority consultation today? Reply 'YES' to confirm.`,
          trigger_reason: `Inbound lead has score ${lead.score}/100 in new/contacted status.`,
        },
        impact_level: 'high',
        confidence: 96,
        reasoning: `Contacting inbound leads quickly increases appointment conversion rates significantly without additional ad spend.`,
      });
    }
  }

  // 2. Operations & Inventory Agent: Low stock / stockouts
  const criticalProducts = products.filter((p) => p.status === 'out_of_stock' || p.stock_quantity <= 10);
  for (const prod of criticalProducts.slice(0, 2)) {
    const actionType = prod.stock_quantity === 0 ? 'Emergency Purchase Order Dispatch' : 'Buffer Stock Restock Alert';
    const target = `SKU: ${prod.name} (Stock: ${prod.stock_quantity})`;
    if (!isDuplicate(actionType, target, prod.id)) {
      actions.push({
        agent_name: 'Operations & Inventory Agent',
        action_type: actionType,
        target_entity: target,
        entity_id: prod.id,
        proposed_payload: {
          channel: 'Supplier PO',
          supplier: 'Primary Supplier',
          sku: prod.sku || prod.name,
          quantity: 100,
          estimated_cost: prod.cost ? prod.cost * 100 : prod.price * 0.4 * 100,
          message: `Generate purchase order PO-${Date.now().toString().slice(-4)} for 100 units of ${prod.name}.`,
          trigger_reason: `Inventory at ${prod.stock_quantity} units is below reorder threshold.`,
        },
        impact_level: 'high',
        confidence: 98,
        reasoning: `Stockout on ${prod.name} risks lost sales revenue from active customer demand.`,
      });
    }
  }

  // 3. Retention & LTV Agent: VIP or Repeat Customer Re-engagement (Requires actual customer data)
  const vipCustomers = customers.filter((c) => c.status === 'vip' || c.status === 'repeat' || (Number(c.total_orders) || 0) > 1);
  if (vipCustomers.length > 0) {
    const vip = vipCustomers[0];
    const actionType = 'VIP Privilege & Refill Follow-up';
    const target = `VIP Customer: ${vip.name}`;
    if (!isDuplicate(actionType, target, vip.id)) {
      actions.push({
        agent_name: 'Retention & LTV Agent',
        action_type: actionType,
        target_entity: target,
        entity_id: vip.id,
        proposed_payload: {
          channel: 'WhatsApp',
          recipient: vip.phone,
          message: `Namaste ${vip.name.split(' ')[0]} ji! As our valued patron, claim your 15% VIP discount code VIP15 on your next order this week!`,
          trigger_reason: `Customer ${vip.name} has recorded lifetime spend of ${business.currency_symbol || '₹'}${vip.total_spend}.`,
        },
        impact_level: 'medium',
        confidence: 92,
        reasoning: `Proactive retention outreach retains high-value customers with zero customer reacquisition cost.`,
      });
    }
  }

  // 4. Financial Auditor Agent: Margin & Expense Checks
  if (expenses.some((e) => e.category === 'marketing' || e.category === 'software_tools') && metrics.hasSufficientRevenueData) {
    const actionType = 'Marketing CAC vs Operating Margin Audit';
    const target = `Financial Allocation: Marketing & Software Overheads`;
    if (!isDuplicate(actionType, target, null)) {
      actions.push({
        agent_name: 'Financial Auditor Agent',
        action_type: actionType,
        target_entity: target,
        entity_id: null,
        proposed_payload: {
          channel: 'Internal Task',
          message: `Review marketing allocation. Total recorded expenses are ${business.currency_symbol || '₹'}${metrics.totalExpenses.toLocaleString('en-IN')} against gross revenue of ${business.currency_symbol || '₹'}${metrics.totalRevenue.toLocaleString('en-IN')}.`,
          trigger_reason: `Expense to revenue ratio is ${metrics.totalRevenue > 0 ? Math.round((metrics.totalExpenses / metrics.totalRevenue) * 100) : 100}%.`,
        },
        impact_level: 'medium',
        confidence: 88,
        reasoning: `Maintaining operating profitability requires regular reconciliation of marketing spend against actual collections.`,
      });
    }
  }

  return actions;
}
