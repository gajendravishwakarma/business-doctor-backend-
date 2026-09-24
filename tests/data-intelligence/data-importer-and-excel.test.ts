import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseCSVText,
  detectSchemaType,
  cleanAndValidateImport,
  cleanPhone,
  cleanNumeric,
  cleanDate,
  parseExcelBuffer,
  parsePDFInvoiceText,
  getSuggestedFieldMappings,
  calculateDataHealthScore,
  exportToCSV,
  SAMPLE_DATASETS,
} from '../../src/lib/data-importer';

describe('Phase 4: Data Intelligence - Importer, Excel & PDF Parsers', () => {
  describe('Delimiter & Format Handling', () => {
    it('parses standard comma-separated values (CSV)', () => {
      const csv = `Name,Phone,Email\nRahul Sharma,+919876543210,rahul@example.com\nAnita Roy,+919876543211,anita@example.com`;
      const result = parseCSVText(csv);
      expect(result.headers).toEqual(['Name', 'Phone', 'Email']);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0].Name).toBe('Rahul Sharma');
    });

    it('parses tab-separated values (TSV / Excel clipboard copy)', () => {
      const tsv = "Product\tPrice\tSKU\nAyurvedic Oil\t499\tSKU-101\nHerbal Tea\t250\tSKU-102";
      const result = parseCSVText(tsv);
      expect(result.headers).toEqual(['Product', 'Price', 'SKU']);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0].Product).toBe('Ayurvedic Oil');
      expect(result.rows[1].SKU).toBe('SKU-102');
    });

    it('parses semicolon and pipe delimited text', () => {
      const semi = `Title;Amount;Vendor\nRent;65000;Landlord\nSupplies;12000;AyurSupply`;
      const resSemi = parseCSVText(semi);
      expect(resSemi.headers).toEqual(['Title', 'Amount', 'Vendor']);
      expect(resSemi.rows.length).toBe(2);

      const pipe = `Lead|Phone|Source\nPooja|+919988776655|Instagram\nVikram|+919911223344|Google`;
      const resPipe = parseCSVText(pipe);
      expect(resPipe.headers).toEqual(['Lead', 'Phone', 'Source']);
      expect(resPipe.rows.length).toBe(2);
    });

    it('handles quoted fields with commas inside', () => {
      const quoted = `Name,Description,Price\n"Dr. Pulse Consultation","Comprehensive Nadi Pariksha, dosha check",1500`;
      const res = parseCSVText(quoted);
      expect(res.rows[0].Description).toBe('Comprehensive Nadi Pariksha, dosha check');
      expect(res.rows[0].Price).toBe('1500');
    });
  });

  describe('Schema Detection & Intelligent Field Mapping', () => {
    it('auto-detects entity collection type correctly based on headers', () => {
      expect(detectSchemaType(['lead_name', 'phone', 'interest', 'budget'])).toBe('leads');
      expect(detectSchemaType(['order_id', 'customer', 'item_name', 'total_amount'])).toBe('orders');
      expect(detectSchemaType(['product_name', 'sku', 'cost', 'price', 'stock'])).toBe('products');
      expect(detectSchemaType(['service_name', 'duration', 'therapy', 'price'])).toBe('services');
      expect(detectSchemaType(['patient', 'appointment_date', 'booking_slot'])).toBe('bookings');
      expect(detectSchemaType(['expense_title', 'amount', 'vendor', 'overhead'])).toBe('expenses');
      expect(detectSchemaType(['customer_name', 'phone', 'email', 'city'])).toBe('customers');
    });

    it('suggests standard field mappings for varied column header aliases', () => {
      const customerHeaders = ['Full Name', 'Contact No', 'Email Address', 'Location / City', 'LTV Spend'];
      const mappings = getSuggestedFieldMappings('customers', customerHeaders);
      expect(mappings.name).toBe('Full Name');
      expect(mappings.phone).toBe('Contact No');
      expect(mappings.email).toBe('Email Address');
      expect(mappings.city).toBe('Location / City');
      expect(mappings.total_spend).toBe('LTV Spend');

      const orderHeaders = ['Billed To', 'Product Name', 'Units', 'Grand Total', 'Invoice Date'];
      const orderMappings = getSuggestedFieldMappings('orders', orderHeaders);
      expect(orderMappings.customer_name).toBe('Billed To');
      expect(orderMappings.item_name).toBe('Product Name');
      expect(orderMappings.quantity).toBe('Units');
      expect(orderMappings.total_amount).toBe('Grand Total');
      expect(orderMappings.order_date).toBe('Invoice Date');
    });
  });

  describe('Data Sanitization & Normalization Helpers', () => {
    it('sanitizes phone numbers to pure digits and plus', () => {
      expect(cleanPhone('+91 (987) 654-3210')).toBe('+919876543210');
      expect(cleanPhone('09876543210')).toBe('09876543210');
      expect(cleanPhone('')).toBe('');
      expect(cleanPhone(null)).toBe('');
    });

    it('cleans currency symbols, commas, and whitespace from numbers', () => {
      expect(cleanNumeric('₹1,45,000.50')).toBe(145000.5);
      expect(cleanNumeric('$2,500')).toBe(2500);
      expect(cleanNumeric(' 350 ')).toBe(350);
      expect(cleanNumeric('invalid', 99)).toBe(99);
      expect(cleanNumeric(null, 0)).toBe(0);
    });

    it('cleans date strings into ISO format', () => {
      const iso = cleanDate('2026-08-15');
      expect(iso).toContain('2026-08-15');
      const fallback = cleanDate('invalid-date');
      expect(typeof fallback).toBe('string');
      expect(fallback.length).toBeGreaterThan(10);
    });
  });

  describe('Excel (.xlsx / .xls) Buffer Parsing', () => {
    it('parses multi-sheet Excel binary buffer accurately', () => {
      // Create a test workbook using xlsx
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Product', 'SKU', 'Price', 'Cost'],
        ['Ayur Shampoo', 'SKU-SH01', 350, 140],
        ['Herbal Balm', 'SKU-BL02', 180, 75],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const parsed = parseExcelBuffer(buf);

      expect(parsed.sheetNames).toEqual(['Inventory']);
      expect(parsed.activeSheet).toBe('Inventory');
      expect(parsed.headers).toContain('Product');
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0].Product).toBe('Ayur Shampoo');
      expect(Number(parsed.rows[0].Price)).toBe(350);
    });
  });

  describe('PDF & Digital Invoice Text Extraction', () => {
    it('heuristically extracts invoice details from unstructured digital receipt text', () => {
      const invoiceText = `
TAX INVOICE
Invoice No: INV-2026-904
Date: 2026-08-20
Bill To: Dr. Priya Nair, Indiranagar Clinic
Vendor: AyurSupply Herbals Ltd

Items:
Ksheerabala Thailam 1L 3 850 2550
Triphala Churna 500g 5 220 1100

Tax (GST 18%): 657
Total Amount: 4,307
      `;

      const parsed = parsePDFInvoiceText(invoiceText);
      expect(parsed.invoiceNumber).toBe('INV-2026-904');
      expect(parsed.date).toBe('2026-08-20');
      expect(parsed.partyName).toContain('Dr. Priya Nair');
      expect(parsed.totalAmount).toBe(4307);
      expect(parsed.taxAmount).toBe(657);
      expect(parsed.lineItems.length).toBe(2);
      expect(parsed.lineItems[0].description).toBe('Ksheerabala Thailam 1L');
      expect(parsed.lineItems[0].quantity).toBe(3);
    });
  });

  describe('Deduplication & Multi-tenant Protection', () => {
    it('detects duplicate records against existing tenant records', () => {
      const existingCustomers = [
        { id: 'c1', name: 'Existing Person', phone: '+919876543210', email: 'existing@example.com' },
      ];

      const newRows = [
        { name: 'Same Phone Person', phone: '+919876543210', email: 'different@example.com' },
        { name: 'Fresh Person', phone: '+919988776655', email: 'fresh@example.com' },
      ];

      const result = cleanAndValidateImport(newRows, 'customers', {}, existingCustomers);
      expect(result.rawCount).toBe(2);
      expect(result.validCount).toBe(1);
      expect(result.duplicateCount).toBe(1);
      expect(result.records[0].isDuplicate).toBe(true);
      expect(result.records[1].isDuplicate).toBe(false);
    });

    it('detects intra-batch duplicates within the same uploaded file', () => {
      const rowsWithDuplicates = [
        { name: 'Duplicate First', phone: '+919111222333', email: 'first@test.com' },
        { name: 'Duplicate Second', phone: '+919111222333', email: 'second@test.com' },
      ];

      const result = cleanAndValidateImport(rowsWithDuplicates, 'customers', {}, []);
      expect(result.rawCount).toBe(2);
      expect(result.validCount).toBe(1);
      expect(result.duplicateCount).toBe(1);
      expect(result.records[1].isDuplicate).toBe(true);
      expect(result.records[1].duplicateReason).toContain('In-batch duplicate');
    });

    it('strips or overrides any foreign business_id provided in raw data to prevent tenant spoofing', () => {
      const adversarialRows = [
        { name: 'Victim Customer', phone: '+919555444333', business_id: 'foreign-tenant-evil-id' },
      ];

      const result = cleanAndValidateImport(adversarialRows, 'customers', {}, []);
      expect(result.validCount).toBe(1);
      // cleanAndValidateImport does not attach business_id; store.commitImportData always injects authenticated business_id
      expect(result.records[0].data.business_id).toBeUndefined();
    });
  });

  describe('Data Maturity & Health Scoring', () => {
    it('calculates low score when data is sparse', () => {
      const health = calculateDataHealthScore({
        customers: [],
        leads: [],
        orders: [],
        products: [],
        services: [],
        expenses: [],
        dataSources: [],
      });
      expect(health.score).toBe(0);
      expect(health.tier).toBe('Low');
      expect(health.recommendations.length).toBeGreaterThan(0);
    });

    it('calculates enterprise grade score when all 4 business pillars are populated', () => {
      const health = calculateDataHealthScore({
        customers: new Array(25).fill({ id: 'c' }),
        leads: new Array(15).fill({ id: 'l' }),
        orders: new Array(30).fill({ id: 'o' }),
        products: new Array(12).fill({ id: 'p' }),
        services: new Array(8).fill({ id: 's' }),
        expenses: new Array(15).fill({ id: 'e' }),
        dataSources: [{ id: 'ds1' }],
      });
      expect(health.score).toBe(100);
      expect(health.tier).toBe('Enterprise Grade');
      expect(health.breakdown.customerScore).toBe(25);
      expect(health.breakdown.catalogScore).toBe(25);
      expect(health.breakdown.salesScore).toBe(25);
      expect(health.breakdown.overheadScore).toBe(25);
    });
  });

  describe('CSV Export Generation', () => {
    it('generates standard RFC-4180 CSV text with proper escaping', () => {
      const data = [
        { Name: 'Priya Nair', City: 'Bangalore', Notes: 'Prefers evening, VIP' },
        { Name: 'Vikram, Jr.', City: 'Mumbai', Notes: 'Quote: "Special"' },
      ];
      const csv = exportToCSV(data);
      expect(csv).toContain('Name,City,Notes');
      expect(csv).toContain('"Prefers evening, VIP"');
      expect(csv).toContain('"Vikram, Jr."');
      expect(csv).toContain('""Special""');
    });
  });
});
