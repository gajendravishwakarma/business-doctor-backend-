import { describe, it, expect } from 'vitest';
import {
  generateOrderNumber,
  calculateOrderTotals,
  applyOrderInventoryDeduction,
  applyOrderInventoryRestoration,
  recordStockAdjustment,
  calculateInventoryValuation,
  calculateServiceMetrics,
  calculateProfitAndLoss,
  calculateSalesAnalytics,
  generateProfitAndLossReport,
} from '../../src/lib/sales-ops-engine';
import {
  Order,
  OrderItem,
  Product,
  Booking,
  Expense,
  InventoryMovement,
} from '../../src/types/database';

describe('Phase 3: Sales & Operations Engine — Integrity, P&L, Inventory', () => {
  const TENANT_A = '11111111-1111-4111-8111-111111111111';
  const TENANT_B = '22222222-2222-4222-8222-222222222222';

  const sampleProducts: Product[] = [
    {
      id: 'prod_1',
      business_id: TENANT_A,
      name: 'Organic Honey 500g',
      sku: 'HON-500',
      category: 'Food',
      price: 500,
      cost: 250,
      stock_quantity: 50,
      total_sold: 0,
      margin_pct: 50,
      status: 'active',
      created_at: '2026-09-01T00:00:00Z',
    },
    {
      id: 'prod_2',
      business_id: TENANT_A,
      name: 'Wildflower Bee Pollen 250g',
      sku: 'POL-250',
      category: 'Health',
      price: 800,
      cost: 400,
      stock_quantity: 8, // Low stock (<= 10)
      total_sold: 0,
      margin_pct: 50,
      status: 'low_stock',
      created_at: '2026-09-01T00:00:00Z',
    },
    {
      id: 'prod_3',
      business_id: TENANT_A,
      name: 'Royal Jelly Extract',
      sku: 'RJL-100',
      category: 'Supplements',
      price: 1500,
      cost: 600,
      stock_quantity: 0, // Out of stock
      total_sold: 0,
      margin_pct: 60,
      status: 'out_of_stock',
      created_at: '2026-09-01T00:00:00Z',
    },
  ];

  describe('1. Collision-Safe Order Number Generator', () => {
    it('generates sequential order numbers scoped to business and date', () => {
      const existingOrders: Order[] = [];
      const num1 = generateOrderNumber(TENANT_A, existingOrders);
      expect(num1).toMatch(/^ORD-\d{8}-0001$/);

      const mockOrder1: Order = {
        id: 'ord_1',
        business_id: TENANT_A,
        order_number: num1,
        customer_id: null,
        customer_name: 'Aditi Rao',
        items: [],
        total_amount: 1000,
        tax_amount: 0,
        discount_amount: 0,
        payment_status: 'paid',
        payment_method: 'upi',
        order_status: 'completed',
        order_date: new Date().toISOString(),
        notes: '',
      };

      const num2 = generateOrderNumber(TENANT_A, [mockOrder1]);
      expect(num2).toMatch(/^ORD-\d{8}-0002$/);
    });

    it('isolates order numbers across different tenants', () => {
      const orderTenantB: Order = {
        id: 'ord_b',
        business_id: TENANT_B,
        order_number: 'ORD-20260908-0005',
        customer_id: null,
        customer_name: 'Tenant B User',
        items: [],
        total_amount: 500,
        tax_amount: 0,
        discount_amount: 0,
        payment_status: 'paid',
        payment_method: 'card',
        order_status: 'completed',
        order_date: new Date().toISOString(),
        notes: '',
      };

      // Generating for Tenant A should start at 0001 despite Tenant B having 0005
      const numA = generateOrderNumber(TENANT_A, [orderTenantB]);
      expect(numA).toMatch(/^ORD-\d{8}-0001$/);
    });
  });

  describe('2. Order Financial Totals Calculation', () => {
    it('accurately computes subtotal, flat discount, and tax rate', () => {
      const items: OrderItem[] = [
        { id: 'item_1', product_id: 'prod_1', name: 'Organic Honey', quantity: 2, unit_price: 500, unit_cost: 250, total: 1000 },
        { id: 'item_2', product_id: 'prod_2', name: 'Wildflower Pollen', quantity: 1, unit_price: 800, unit_cost: 400, total: 800 },
      ];

      const totals = calculateOrderTotals(items, 200, 0.10); // Subtotal: 1800, Discount: 200 => Taxable: 1600, Tax 10%: 160 => Total: 1760
      expect(totals.subtotal).toBe(1800);
      expect(totals.discountAmount).toBe(200);
      expect(totals.taxAmount).toBe(160);
      expect(totals.totalAmount).toBe(1760);
    });

    it('accurately supports explicit tax override', () => {
      const items: OrderItem[] = [
        { id: 'item_1', product_id: 'prod_1', name: 'Organic Honey', quantity: 2, unit_price: 500, unit_cost: 250, total: 1000 },
      ];

      const totals = calculateOrderTotals(items, 100, null, 162); // Subtotal: 1000, disc: 100 => 900. Tax override: 162 => Total: 1062
      expect(totals.subtotal).toBe(1000);
      expect(totals.discountAmount).toBe(100);
      expect(totals.taxAmount).toBe(162);
      expect(totals.totalAmount).toBe(1062);
    });
  });

  describe('3. Idempotent Inventory Deduction & Reversion', () => {
    it('deducts inventory once, logs movement, and adjusts product status', () => {
      const order: Order = {
        id: 'ord_100',
        business_id: TENANT_A,
        order_number: 'ORD-20260908-0001',
        customer_id: null,
        customer_name: 'Vikram',
        items: [
          { id: 'item_1', product_id: 'prod_1', name: 'Organic Honey 500g', quantity: 45, unit_price: 500, unit_cost: 250, total: 22500 },
        ],
        total_amount: 22500,
        tax_amount: 0,
        discount_amount: 0,
        payment_status: 'paid',
        payment_method: 'upi',
        order_status: 'completed',
        order_date: new Date().toISOString(),
        inventory_decremented: false,
        notes: '',
      };

      const result = applyOrderInventoryDeduction(order, sampleProducts, TENANT_A);
      expect(result.wasApplied).toBe(true);
      expect(result.movements.length).toBe(1);
      expect(result.movements[0].quantity_change).toBe(-45);
      expect(result.movements[0].balance_after).toBe(5);

      const updatedProd1 = result.updatedProducts.find((p) => p.id === 'prod_1')!;
      expect(updatedProd1.stock_quantity).toBe(5);
      // Status transitioned to low_stock (<= 10)
      expect(updatedProd1.status).toBe('low_stock');
    });

    it('enforces idempotency: does not deduct stock twice if already decremented', () => {
      const orderAlreadyDeducted: Order = {
        id: 'ord_101',
        business_id: TENANT_A,
        order_number: 'ORD-20260908-0002',
        customer_id: null,
        customer_name: 'Vikram',
        items: [
          { id: 'item_1', product_id: 'prod_1', name: 'Organic Honey 500g', quantity: 10, unit_price: 500, unit_cost: 250, total: 5000 },
        ],
        total_amount: 5000,
        tax_amount: 0,
        discount_amount: 0,
        payment_status: 'paid',
        payment_method: 'upi',
        order_status: 'completed',
        order_date: new Date().toISOString(),
        inventory_decremented: true, // Already decremented!
        notes: '',
      };

      const result = applyOrderInventoryDeduction(orderAlreadyDeducted, sampleProducts, TENANT_A);
      expect(result.wasApplied).toBe(false);
      expect(result.movements.length).toBe(0);
      const prod1 = result.updatedProducts.find((p) => p.id === 'prod_1')!;
      expect(prod1.stock_quantity).toBe(50); // Untouched
    });

    it('restores stock when order is cancelled/refunded', () => {
      const orderToRevert: Order = {
        id: 'ord_102',
        business_id: TENANT_A,
        order_number: 'ORD-20260908-0003',
        customer_id: null,
        customer_name: 'Pooja',
        items: [
          { id: 'item_2', product_id: 'prod_2', name: 'Wildflower Bee Pollen 250g', quantity: 5, unit_price: 800, unit_cost: 400, total: 4000 },
        ],
        total_amount: 4000,
        tax_amount: 0,
        discount_amount: 0,
        payment_status: 'refunded',
        payment_method: 'upi',
        order_status: 'cancelled',
        order_date: new Date().toISOString(),
        inventory_decremented: true,
        notes: '',
      };

      const result = applyOrderInventoryRestoration(orderToRevert, sampleProducts, 'admin');
      expect(result.wasApplied).toBe(true);
      expect(result.movements.length).toBe(1);
      expect(result.movements[0].quantity_change).toBe(5);
      expect(result.movements[0].movement_type).toBe('return_damage');

      const updatedProd2 = result.updatedProducts.find((p) => p.id === 'prod_2')!;
      expect(updatedProd2.stock_quantity).toBe(13); // 8 + 5
      expect(updatedProd2.status).toBe('active'); // > 10 is active
    });
  });

  describe('4. Stock Adjustment & Inventory Valuation', () => {
    it('records stock adjustment with auditable reason and non-negative bounds', () => {
      const prod = sampleProducts[0]; // stock = 50
      const { updatedProduct, movement } = recordStockAdjustment(
        prod,
        75,
        'purchase_restock',
        'PO-2026-90 Restock received from farm',
        'Store Manager',
        TENANT_A
      );

      expect(updatedProduct.stock_quantity).toBe(75);
      expect(movement.quantity_change).toBe(25);
      expect(movement.balance_after).toBe(75);
      expect(movement.movement_type).toBe('purchase_restock');
      expect(movement.reason).toBe('PO-2026-90 Restock received from farm');
      expect(movement.created_by).toBe('Store Manager');
    });

    it('calculates inventory valuation metrics correctly', () => {
      const valuation = calculateInventoryValuation(sampleProducts);
      // prod_1: 50 * 250 = 12500 cost, 50 * 500 = 25000 retail
      // prod_2: 8 * 400 = 3200 cost, 8 * 800 = 6400 retail
      // prod_3: 0 * 600 = 0 cost, 0 * 1500 = 0 retail
      expect(valuation.totalSkus).toBe(3);
      expect(valuation.totalUnits).toBe(58);
      expect(valuation.costValuation).toBe(15700);
      expect(valuation.retailValuation).toBe(31400);
      expect(valuation.potentialGrossProfit).toBe(15700);
      expect(valuation.lowStockCount).toBe(1);
      expect(valuation.outOfStockCount).toBe(1);
    });
  });

  describe('5. Grounded P&L Calculation & Analytics', () => {
    const orders: Order[] = [
      {
        id: 'ord_1',
        business_id: TENANT_A,
        customer_id: null,
        customer_name: 'Customer 1',
        items: [
          { id: 'item_1', product_id: 'prod_1', name: 'Organic Honey 500g', quantity: 10, unit_price: 500, unit_cost: 250, total: 5000 },
        ],
        total_amount: 5000,
        tax_amount: 0,
        discount_amount: 0,
        payment_status: 'paid',
        payment_method: 'upi',
        order_status: 'completed',
        order_date: '2026-09-08T10:00:00Z',
        source: 'walk_in',
        notes: '',
      },
    ];

    const bookings: Booking[] = [
      {
        id: 'bk_1',
        business_id: TENANT_A,
        customer_id: null,
        customer_name: 'Customer 2',
        service_name: 'Apiary Tour & Tasting',
        booking_date: '2026-09-08',
        amount: 2000,
        status: 'completed',
        payment_status: 'paid',
        notes: '',
        created_at: '2026-09-08T10:00:00Z',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'exp_1',
        business_id: TENANT_A,
        category: 'rent',
        amount: 1500,
        description: 'Facility Rent',
        payment_method: 'bank_transfer',
        is_recurring: false,
        expense_date: '2026-09-01',
        created_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'exp_2',
        business_id: TENANT_A,
        category: 'marketing',
        amount: 500,
        description: 'Instagram Ad campaign',
        payment_method: 'upi',
        is_recurring: false,
        expense_date: '2026-09-02',
        created_at: '2026-09-02T00:00:00Z',
      },
    ];

    it('computes grounded P&L with COGS, gross margin, OpEx, and net margin', () => {
      const pnl = calculateProfitAndLoss(orders, bookings, expenses, sampleProducts);

      // Revenue: Orders (5000) + Bookings (2000) = 7000
      expect(pnl.grossRevenue).toBe(7000);
      expect(pnl.ordersRevenue).toBe(5000);
      expect(pnl.bookingsRevenue).toBe(2000);

      // COGS: 10 * 250 = 2500
      expect(pnl.cogs).toBe(2500);

      // Gross Profit: 7000 - 2500 = 4500 (64.3% margin)
      expect(pnl.grossProfit).toBe(4500);
      expect(pnl.grossMarginPct).toBe(64.3);

      // OpEx: 1500 + 500 = 2000
      expect(pnl.operatingExpenses).toBe(2000);
      expect(pnl.expensesByCategory.rent).toBe(1500);
      expect(pnl.expensesByCategory.marketing).toBe(500);

      // Net Operating Profit: 4500 - 2000 = 2500 (35.7% net margin)
      expect(pnl.netOperatingProfit).toBe(2500);
      expect(pnl.netMarginPct).toBe(35.7);
      expect(pnl.evidenceState).toBe('calculated');
    });

    it('returns insufficient_data flag when no operational data exists', () => {
      const emptyPnl = calculateProfitAndLoss([], [], [], []);
      expect(emptyPnl.evidenceState).toBe('insufficient_data');
      expect(emptyPnl.grossRevenue).toBe(0);
      expect(emptyPnl.netOperatingProfit).toBe(0);
    });

    it('generates a printable text P&L statement report', () => {
      const pnl = calculateProfitAndLoss(orders, bookings, expenses, sampleProducts);
      const report = generateProfitAndLossReport(pnl, 'Honey Farm Ltd', '₹');
      expect(report).toContain('PROFIT & LOSS STATEMENT');
      expect(report).toContain('Honey Farm Ltd');
      expect(report).toContain('GROSS REVENUE:               ₹7,000');
      expect(report).toContain('NET OPERATING PROFIT (EBIT):    ₹2,500');
    });

    it('computes sales analytics with breakdown by source and top products', () => {
      const analytics = calculateSalesAnalytics(orders, bookings, sampleProducts, expenses);
      expect(analytics.totalRevenue).toBe(5000);
      expect(analytics.totalOrders).toBe(1);
      expect(analytics.paidOrdersCount).toBe(1);
      expect(analytics.topProductsByRevenue.length).toBe(1);
      expect(analytics.topProductsByRevenue[0].name).toBe('Organic Honey 500g');
      expect(analytics.ordersBySource['walk_in'].count).toBe(1);
    });
  });
});
