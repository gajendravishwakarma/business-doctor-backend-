import * as XLSX from 'xlsx';

export interface ParsedRawRow {
  [key: string]: any;
}

export type SupportedEntityType =
  | 'customers'
  | 'leads'
  | 'orders'
  | 'products'
  | 'services'
  | 'bookings'
  | 'expenses';

export interface CleanedRecord {
  isValid: boolean;
  isDuplicate: boolean;
  duplicateReason?: string;
  errors: string[];
  data: Record<string, any>;
  originalIndex: number;
}

export interface ImportPreviewResult {
  fileName: string;
  fileType: SupportedEntityType;
  rawCount: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  availableColumns: string[];
  records: CleanedRecord[];
  summaryErrors: string[];
}

/**
 * Universal text parser supporting CSV, TSV (Excel pasted tables), Semicolon, and Pipe delimited data.
 */
export function parseCSVText(rawText: string): { headers: string[]; rows: ParsedRawRow[] } {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter from first 3 lines (default to comma, check for tab, semicolon, pipe)
  const sample = lines.slice(0, 3).join('\n');
  let delimiter = ',';
  const tabCount = (sample.match(/\t/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const pipeCount = (sample.match(/\|/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (pipeCount > commaCount && pipeCount > tabCount) {
    delimiter = '|';
  }

  const parseLine = (line: string, delim: string): string[] => {
    if (delim === '\t') {
      return line.split('\t').map((c) => c.replace(/^["']|["']$/g, '').trim());
    }

    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delim && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));
    return values;
  };

  const headers = parseLine(lines[0], delimiter).map((h) => h.trim());
  const rows: ParsedRawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawValues = parseLine(lines[i], delimiter);
    if (rawValues.length === 0 || rawValues.every((v) => v === '')) continue;
    const row: ParsedRawRow = {};
    headers.forEach((h, idx) => {
      row[h] = rawValues[idx] !== undefined ? rawValues[idx] : '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

export function parseCSV(csvText: string): ParsedRawRow[] {
  const result = parseCSVText(csvText);
  return result.rows;
}

export function detectSchemaType(headers: string[]): SupportedEntityType {
  const lower = (headers || []).map((h) => String(h || '').toLowerCase());
  if (lower.some((h) => h.includes('lead') || h.includes('interest') || h.includes('score') || h.includes('budget'))) return 'leads';
  if (lower.some((h) => h.includes('order') || h.includes('order_date') || h.includes('item_name') || h.includes('tax'))) return 'orders';
  if (lower.some((h) => h.includes('service') || h.includes('duration') || h.includes('treatment'))) return 'services';
  if (lower.some((h) => h.includes('booking') || h.includes('slot') || h.includes('appointment'))) return 'bookings';
  if (lower.some((h) => h.includes('sku') || h.includes('cost') || h.includes('margin') || h.includes('stock'))) return 'products';
  if (lower.some((h) => h.includes('expense') || h.includes('vendor') || h.includes('overhead') || h.includes('receipt'))) return 'expenses';
  return 'customers';
}

export function cleanPhone(val: any): string {
  if (!val) return '';
  return String(val).replace(/[^0-9+]/g, '');
}

export function cleanNumeric(val: any, fallback = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const cleaned = String(val).replace(/[₹$,\s]/g, '').trim();
  const num = Number(cleaned);
  return isNaN(num) ? fallback : num;
}

export function cleanDate(val: any): string {
  if (!val) return new Date().toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Validates, cleans, and deduplicates imported rows against existing database records.
 */
export function cleanAndValidateImport(
  rows: ParsedRawRow[],
  targetEntityType: SupportedEntityType,
  fieldMappings: Record<string, string>,
  existingRecords: Array<any> = []
): ImportPreviewResult {
  const cleaned: CleanedRecord[] = [];
  const existingSet = new Set<string>();
  const internalBatchSet = new Set<string>();
  const summaryErrors: string[] = [];

  // Seed existing database keys for multi-tenant isolation and duplicate prevention
  existingRecords.forEach((item) => {
    if (targetEntityType === 'customers' || targetEntityType === 'leads') {
      if (item.phone) existingSet.add(`phone:${cleanPhone(item.phone)}`);
      if (item.email) existingSet.add(`email:${String(item.email).toLowerCase().trim()}`);
    } else if (targetEntityType === 'products') {
      if (item.sku) existingSet.add(`sku:${String(item.sku).toLowerCase().trim()}`);
      if (item.name) existingSet.add(`name:${String(item.name).toLowerCase().trim()}`);
    } else if (targetEntityType === 'services') {
      if (item.name) existingSet.add(`srv:${String(item.name).toLowerCase().trim()}`);
    } else if (targetEntityType === 'expenses') {
      if (item.title && item.expense_date) {
        existingSet.add(`exp:${String(item.title).toLowerCase().trim()}_${item.expense_date.split('T')[0]}`);
      }
    } else if (targetEntityType === 'orders') {
      if (item.id) existingSet.add(`ord:${item.id}`);
    } else if (targetEntityType === 'bookings') {
      if (item.customer_name && item.booking_date) {
        existingSet.add(`bk:${String(item.customer_name).toLowerCase()}_${item.booking_date}`);
      }
    }
  });

  rows.forEach((rawRow, idx) => {
    const errors: string[] = [];
    const mappedData: Record<string, any> = {};
    let isDuplicate = false;
    let duplicateReason = '';

    // Direct and mapped field extraction
    for (const [targetKey, sourceColumn] of Object.entries(fieldMappings)) {
      if (!sourceColumn) continue;
      const rawVal = rawRow[sourceColumn] !== undefined ? rawRow[sourceColumn] : rawRow[targetKey];
      mappedData[targetKey] = rawVal !== undefined ? rawVal : '';
    }

    // Default fallback mappings if fieldMappings was empty or incomplete
    if (Object.keys(fieldMappings).length === 0) {
      Object.entries(rawRow).forEach(([k, v]) => {
        mappedData[k.toLowerCase().replace(/\s+/g, '_')] = v;
      });
    }

    // Security: Multi-tenant safety - Never trust foreign business_id in uploaded files
    delete mappedData.business_id;

    // Entity-specific validations
    if (targetEntityType === 'customers') {
      const name = String(mappedData.name || rawRow.Name || rawRow.name || rawRow.customer_name || '').trim();
      const phone = cleanPhone(mappedData.phone || rawRow.Phone || rawRow.phone || '');
      const email = String(mappedData.email || rawRow.Email || rawRow.email || '').trim().toLowerCase();

      if (!name && !phone && !email) {
        errors.push('Row is missing essential customer identifier (Name, Phone, or Email)');
      }

      const phoneKey = phone ? `phone:${phone}` : '';
      const emailKey = email ? `email:${email}` : '';

      if (phoneKey && (existingSet.has(phoneKey) || internalBatchSet.has(phoneKey))) {
        isDuplicate = true;
        duplicateReason = internalBatchSet.has(phoneKey)
          ? `In-batch duplicate phone number: ${phone}`
          : `Duplicate phone number: ${phone}`;
      } else if (emailKey && (existingSet.has(emailKey) || internalBatchSet.has(emailKey))) {
        isDuplicate = true;
        duplicateReason = internalBatchSet.has(emailKey)
          ? `In-batch duplicate email address: ${email}`
          : `Duplicate email address: ${email}`;
      }

      if (phoneKey) internalBatchSet.add(phoneKey);
      if (emailKey) internalBatchSet.add(emailKey);

      mappedData.name = name || (phone ? `Customer (${phone})` : 'New Customer');
      mappedData.phone = phone;
      mappedData.email = email;
      mappedData.city = mappedData.city || rawRow.City || rawRow.city || 'Local';
      mappedData.source = mappedData.source || rawRow.Source || rawRow.source || 'other';
      mappedData.total_orders = cleanNumeric(mappedData.total_orders || rawRow.Orders || rawRow.orders, 1);
      mappedData.total_spend = cleanNumeric(mappedData.total_spend || rawRow.TotalSpend || rawRow.total_spend || rawRow.Amount || rawRow.amount, 0);
      mappedData.status = mappedData.status || (mappedData.total_orders > 1 ? 'repeat' : 'active');
    } else if (targetEntityType === 'leads') {
      const name = String(mappedData.name || rawRow.Name || rawRow.name || '').trim();
      const phone = cleanPhone(mappedData.phone || rawRow.Phone || rawRow.phone || '');
      const email = String(mappedData.email || rawRow.Email || rawRow.email || '').trim().toLowerCase();

      if (!name && !phone && !email) {
        errors.push('Lead requires at least a Name, Phone number, or Email');
      }

      const phoneKey = phone ? `phone:${phone}` : '';
      const emailKey = email ? `email:${email}` : '';

      if (phoneKey && (existingSet.has(phoneKey) || internalBatchSet.has(phoneKey))) {
        isDuplicate = true;
        duplicateReason = `Duplicate phone number: ${phone}`;
      } else if (emailKey && (existingSet.has(emailKey) || internalBatchSet.has(emailKey))) {
        isDuplicate = true;
        duplicateReason = `Duplicate email: ${email}`;
      }

      if (phoneKey) internalBatchSet.add(phoneKey);
      if (emailKey) internalBatchSet.add(emailKey);

      mappedData.name = name || (phone ? `Inbound Lead (${phone})` : 'Inbound Lead');
      mappedData.phone = phone;
      mappedData.email = email;
      mappedData.source = mappedData.source || rawRow.Source || rawRow.source || 'Website / Direct';
      mappedData.status = mappedData.status || 'new';
      mappedData.score = Math.min(100, Math.max(10, cleanNumeric(mappedData.score || rawRow.Score || rawRow.score, 75)));
      mappedData.budget = cleanNumeric(mappedData.budget || rawRow.Budget || rawRow.budget, 3000);
      mappedData.interest = mappedData.interest || rawRow.Interest || rawRow.interest || 'General Inquiry';
    } else if (targetEntityType === 'orders') {
      const customer = String(mappedData.customer_name || mappedData.customer || rawRow.Customer || rawRow.customer || rawRow.customer_name || 'Walk-in Customer').trim();
      const item = String(mappedData.item_name || mappedData.item || rawRow.Item || rawRow.item || 'Standard Product Package').trim();
      const amount = cleanNumeric(mappedData.total_amount || mappedData.amount || rawRow.Amount || rawRow.amount || rawRow.Total || rawRow.total, 0);

      if (amount <= 0) {
        errors.push('Order total amount must be a positive number (> 0)');
      }

      mappedData.customer_name = customer;
      mappedData.item_name = item;
      mappedData.quantity = cleanNumeric(mappedData.quantity || rawRow.Quantity || rawRow.quantity, 1);
      mappedData.total_amount = amount;
      mappedData.tax_amount = cleanNumeric(mappedData.tax_amount || rawRow.tax || 0, Math.round(amount * 0.05));
      mappedData.payment_status = (mappedData.payment_status || rawRow.Status || rawRow.status || 'paid').toLowerCase();
      mappedData.payment_method = (mappedData.payment_method || rawRow.Method || rawRow.payment_method || 'upi').toLowerCase();
      mappedData.order_status = (mappedData.order_status || 'completed').toLowerCase();
      mappedData.order_date = cleanDate(mappedData.order_date || rawRow.Date || rawRow.date || rawRow.order_date);
    } else if (targetEntityType === 'products') {
      const name = String(mappedData.name || rawRow.Name || rawRow.name || '').trim();
      const price = cleanNumeric(mappedData.price || rawRow.Price || rawRow.price, -1);
      const sku = String(mappedData.sku || rawRow.SKU || rawRow.sku || `SKU-IMP-${idx + 1}`).trim();

      if (!name) {
        errors.push('Product name is required');
      }
      if (price < 0) {
        errors.push('Product price must be a valid non-negative number');
      }

      const skuKey = `sku:${sku.toLowerCase()}`;
      if (existingSet.has(skuKey) || internalBatchSet.has(skuKey)) {
        isDuplicate = true;
        duplicateReason = `Duplicate SKU: ${sku}`;
      }
      internalBatchSet.add(skuKey);

      const cost = cleanNumeric(mappedData.cost || rawRow.Cost || rawRow.cost, Math.round(price * 0.4));
      const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 60;

      mappedData.name = name;
      mappedData.sku = sku;
      mappedData.category = String(mappedData.category || rawRow.Category || rawRow.category || 'General Formulations').trim();
      mappedData.price = Math.max(0, price);
      mappedData.cost = cost;
      mappedData.margin_pct = margin;
      mappedData.stock_quantity = cleanNumeric(mappedData.stock_quantity || rawRow.Stock || rawRow.stock || rawRow.quantity, 50);
      mappedData.status = mappedData.stock_quantity > 0 ? 'active' : 'out_of_stock';
    } else if (targetEntityType === 'services') {
      const name = String(mappedData.name || rawRow.Name || rawRow.name || rawRow.Service || rawRow.service || '').trim();
      const price = cleanNumeric(mappedData.price || rawRow.Price || rawRow.price, -1);

      if (!name) {
        errors.push('Service name is required');
      }
      if (price < 0) {
        errors.push('Service price must be a valid number');
      }

      const srvKey = `srv:${name.toLowerCase()}`;
      if (existingSet.has(srvKey) || internalBatchSet.has(srvKey)) {
        isDuplicate = true;
        duplicateReason = `Duplicate service: ${name}`;
      }
      internalBatchSet.add(srvKey);

      mappedData.name = name;
      mappedData.category = String(mappedData.category || rawRow.Category || rawRow.category || 'Therapy & Consultations').trim();
      mappedData.duration_minutes = cleanNumeric(mappedData.duration_minutes || rawRow.Duration || rawRow.duration, 45);
      mappedData.price = Math.max(0, price);
      mappedData.description = String(mappedData.description || rawRow.Description || rawRow.description || 'Verified service package').trim();
      mappedData.is_active = true;
    } else if (targetEntityType === 'bookings') {
      const customer = String(mappedData.customer_name || rawRow.Customer || rawRow.customer || rawRow.customer_name || 'Client').trim();
      const service = String(mappedData.service_name || rawRow.Service || rawRow.service || 'Consultation').trim();
      const amount = cleanNumeric(mappedData.amount || rawRow.Amount || rawRow.amount || rawRow.Price || rawRow.price, 0);

      if (!customer && !service) {
        errors.push('Booking requires at least customer name or service name');
      }
      if (amount <= 0) {
        errors.push('Booking fee / amount must be a positive number');
      }

      mappedData.customer_name = customer;
      mappedData.customer_phone = cleanPhone(mappedData.customer_phone || rawRow.Phone || rawRow.phone || '');
      mappedData.service_name = service;
      mappedData.booking_date = cleanDate(mappedData.booking_date || rawRow.Date || rawRow.date || rawRow.booking_date);
      mappedData.time_slot = String(mappedData.time_slot || rawRow.Time || rawRow.time || '10:00 AM').trim();
      mappedData.amount = amount;
      mappedData.status = (mappedData.status || rawRow.Status || rawRow.status || 'confirmed').toLowerCase();
      mappedData.payment_status = (mappedData.payment_status || 'paid').toLowerCase();
      mappedData.notes = String(mappedData.notes || rawRow.Notes || rawRow.notes || 'Imported booking record').trim();
    } else if (targetEntityType === 'expenses') {
      const title = String(mappedData.title || mappedData.description || rawRow.Title || rawRow.title || rawRow.Description || rawRow.description || '').trim();
      const amount = cleanNumeric(mappedData.amount || rawRow.Amount || rawRow.amount, 0);

      if (!title) {
        errors.push('Expense title or description is required');
      }
      if (amount <= 0) {
        errors.push('Expense amount must be a positive number (> 0)');
      }

      mappedData.title = title;
      mappedData.category = (mappedData.category || rawRow.Category || rawRow.category || 'other').toLowerCase();
      mappedData.amount = amount;
      mappedData.expense_date = cleanDate(mappedData.expense_date || rawRow.Date || rawRow.date || rawRow.expense_date).split('T')[0];
      mappedData.vendor = String(mappedData.vendor || rawRow.Vendor || rawRow.vendor || 'Operational Vendor').trim();
      mappedData.payment_method = String(mappedData.payment_method || rawRow.Method || rawRow.payment_method || 'Bank Transfer').trim();
      mappedData.is_recurring = Boolean(mappedData.is_recurring || rawRow.is_recurring || false);
    }

    if (errors.length > 0) {
      errors.forEach((err) => {
        if (!summaryErrors.includes(err)) summaryErrors.push(err);
      });
    }

    cleaned.push({
      isValid: errors.length === 0,
      isDuplicate,
      duplicateReason,
      errors,
      data: mappedData,
      originalIndex: idx + 1,
    });
  });

  return {
    fileName: 'Uploaded File',
    fileType: targetEntityType,
    rawCount: rows.length,
    validCount: cleaned.filter((c) => c.isValid && !c.isDuplicate).length,
    duplicateCount: cleaned.filter((c) => c.isDuplicate).length,
    errorCount: cleaned.filter((c) => !c.isValid).length,
    availableColumns: Object.keys(rows[0] || {}),
    records: cleaned,
    summaryErrors,
  };
}

export const SAMPLE_DATASETS: Record<SupportedEntityType, string> = {
  customers: `Name,Phone,Email,City,Source,Orders,TotalSpend
Vikramaditya Rathore,+919988776655,vikram@example.com,Bengaluru,whatsapp,3,7800
Ananya Deshmukh,+919876543210,ananya@example.com,Mumbai,instagram,2,4200
Rohit Sen,+919712345678,rohit@example.com,Delhi,google_search,1,1800
Pooja Hegde,+919822334455,pooja@example.com,Bengaluru,whatsapp,4,12400
Suresh Nair,+919633221100,suresh@example.com,Chennai,walk_in,1,950`,

  leads: `Name,Phone,Email,Source,Interest,Score,Budget
Karan Mehra,+919811223344,karan@example.com,Instagram DM,Hair Growth Tonic,85,3500
Shreya Iyer,+919722334455,shreya@example.com,WhatsApp,Doctor Pulse Consult,90,1200
Deepak Verma,+919633445566,deepak@example.com,Google Search,Stress Relief Kit,70,2500
Meera Kulkarni,+919544332211,meera@example.com,WhatsApp Inbound,Ayurvedic Detox Program,92,6000
Aditya Roy,+919455667788,aditya@example.com,Instagram Ad,Kumkumadi Facial Oil,78,2000`,

  orders: `Customer,Item,Quantity,Amount,Method,Status,Date
Vikramaditya Rathore,Kumkumadi Facial Oil,2,3600,upi,paid,2026-08-25
Ananya Deshmukh,Ashwagandha Churna,1,650,upi,paid,2026-08-26
Rohit Sen,Pulse Consultation,1,1200,card,paid,2026-08-26
Pooja Hegde,Organic Triphala Tablets,3,1770,upi,paid,2026-08-27
Suresh Nair,Digestive Herbal Infusion,1,850,upi,paid,2026-08-27`,

  products: `Name,SKU,Category,Price,Cost,Stock
Kumkumadi Tailam (30ml),VED-SKU-001,Skincare,1800,600,45
Organic Triphala Tablets (60s),VED-SKU-002,Digestion & Detox,590,170,120
Pure Brahmi Memory Elixir (200ml),VED-SKU-003,Cognitive Wellness,850,290,8
Ashwagandha Gold Capsules (60s),VED-SKU-004,Immunity & Stress,790,260,65
Pain Relief Herbal Potli,VED-SKU-005,Therapy Packs,1250,420,0`,

  services: `Name,Category,Duration,Price,Description
Doctor Pulse Consultation,Consultation,30,1200,In-depth Nadi Pariksha and personalized dosha balance diet chart.
Shirodhara Deep Relaxation,Therapy,60,2500,Warm medicated herbal oil continuous stream over forehead.
Abhyanga Full Body Massage,Therapy,60,2200,Traditional synchronized rhythmic massage using customized medicated oils.
Ayurvedic Detox Package,Treatment,90,3800,Comprehensive dosha cleanse with steam and herbal scrub.`,

  bookings: `Customer,Phone,Service,Date,Time,Amount,Status
Vikramaditya Rathore,+919988776655,Shirodhara Deep Relaxation,2026-08-28,11:00 AM,2500,confirmed
Ananya Deshmukh,+919876543210,Doctor Pulse Consultation,2026-08-29,03:30 PM,1200,confirmed
Pooja Hegde,+919822334455,Abhyanga Full Body Massage,2026-08-30,10:00 AM,2200,confirmed
Kavita Sharma,+919711002233,Ayurvedic Detox Package,2026-08-30,02:00 PM,3800,confirmed`,

  expenses: `Title,Category,Amount,Vendor,Method,Date,Recurring
Indiranagar Clinic Space Rent,rent,65000,Property Landlord,Bank Transfer,2026-08-01,true
Staff Salaries & Doctor Retainers,salaries,95000,Clinic Staff & Therapists,Bank Transfer,2026-08-05,true
Meta & Instagram Ads Budget,marketing,18500,Meta Platforms Inc,Credit Card,2026-08-15,false
Herbal Raw Materials & Packaging,inventory,32000,AyurSupply Herbals Ltd,UPI,2026-08-18,false
Electricity & Clinic Utilities,utilities,6200,BESCOM Karnataka,UPI,2026-08-20,true`,
};

/**
 * Universal Excel Parser supporting .xlsx and .xls binary buffers.
 */
export function parseExcelBuffer(
  buffer: ArrayBuffer | Uint8Array,
  sheetIndexOrName: string | number = 0
): {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: ParsedRawRow[];
} {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetNames = workbook.SheetNames || [];
    if (sheetNames.length === 0) {
      return { sheetNames: [], activeSheet: '', headers: [], rows: [] };
    }

    let sheetName = sheetNames[0];
    if (typeof sheetIndexOrName === 'string' && sheetNames.includes(sheetIndexOrName)) {
      sheetName = sheetIndexOrName;
    } else if (typeof sheetIndexOrName === 'number' && sheetNames[sheetIndexOrName]) {
      sheetName = sheetNames[sheetIndexOrName];
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return { sheetNames, activeSheet: sheetName, headers: [], rows: [] };
    }

    const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
    if (rawJson.length === 0) {
      return { sheetNames, activeSheet: sheetName, headers: [], rows: [] };
    }

    const headers = Object.keys(rawJson[0]);
    const rows: ParsedRawRow[] = rawJson.map((item) => ({ ...item }));

    return { sheetNames, activeSheet: sheetName, headers, rows };
  } catch {
    return { sheetNames: [], activeSheet: '', headers: [], rows: [] };
  }
}

export interface ParsedInvoiceData {
  invoiceNumber?: string;
  date?: string;
  partyName?: string;
  totalAmount?: number;
  taxAmount?: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

/**
 * Heuristic parser for PDF and digital text invoices/receipts.
 */
export function parsePDFInvoiceText(rawText: string): ParsedInvoiceData {
  const text = String(rawText || '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let invoiceNumber = '';
  const directInv = text.match(/\b(INV-[A-Z0-9\-_]+)\b/i);
  if (directInv) {
    invoiceNumber = directInv[1];
  } else {
    const invMatch = text.match(/(?:invoice|bill|inv)(?:[^\S\r\n]*(?:no\.?|number|#))?[^\S\r\n]*[:#][^\S\r\n]*([A-Z0-9\-_]+)/i);
    if (invMatch) invoiceNumber = invMatch[1];
  }

  let date = '';
  const dateMatch = text.match(/(?:date|dated|invoice\s*date)[\s:]*([0-9]{1,4}[/\-.][0-9]{1,2}[/\-.][0-9]{1,4})/i);
  if (dateMatch) date = dateMatch[1];

  let totalAmount = 0;
  const totalMatch = text.match(/(?:total\s*amount|grand\s*total|net\s*amount|amount\s*payable|final\s*total|total)[\s:]*(?:[₹$€]\s*)?([0-9,]+(?:\.[0-9]{2})?)/i);
  if (totalMatch) {
    totalAmount = cleanNumeric(totalMatch[1]);
  }

  let taxAmount = 0;
  const taxMatch = text.match(/(?:tax|gst|vat|cgst\s*\+\s*sgst)[^:\n\r]*:\s*(?:[₹$€]\s*)?([0-9,]+(?:\.[0-9]{2})?)/i) ||
                   text.match(/(?:tax|gst|vat|cgst\s*\+\s*sgst)[\s:]*(?:[₹$€]\s*)?([0-9,]+(?:\.[0-9]{2})?)/i);
  if (taxMatch) {
    taxAmount = cleanNumeric(taxMatch[1]);
  }

  let partyName = '';
  const partyMatch = text.match(/(?:bill\s*to|customer|client|buyer|vendor|supplier)[\s:]*([^\n\r,]+)/i);
  if (partyMatch) {
    partyName = partyMatch[1].trim();
  }

  const lineItems: ParsedInvoiceData['lineItems'] = [];
  for (const line of lines) {
    const itemMatch = line.match(/^([A-Za-z0-9\s\-_.()]+?)\s+(\d+)\s+(?:[₹$€]\s*)?([0-9,.]+)\s+(?:[₹$€]\s*)?([0-9,.]+)$/);
    if (itemMatch) {
      lineItems.push({
        description: itemMatch[1].trim(),
        quantity: cleanNumeric(itemMatch[2], 1),
        unitPrice: cleanNumeric(itemMatch[3], 0),
        amount: cleanNumeric(itemMatch[4], 0),
      });
    }
  }

  return {
    invoiceNumber: invoiceNumber || undefined,
    date: date || undefined,
    partyName: partyName || undefined,
    totalAmount: totalAmount || (lineItems.length > 0 ? lineItems.reduce((s, i) => s + i.amount, 0) : undefined),
    taxAmount: taxAmount || undefined,
    lineItems,
  };
}

/**
 * Intelligent Schema Mapping Suggester based on column header aliases.
 */
export function getSuggestedFieldMappings(
  targetType: SupportedEntityType,
  availableHeaders: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  const lowerHeaders = (availableHeaders || []).map((h) => ({
    original: h,
    normalized: String(h || '').toLowerCase().replace(/[\s\-_/\\|.]+/g, ''),
  }));

  const ALIASES: Record<SupportedEntityType, Record<string, string[]>> = {
    customers: {
      name: ['name', 'fullname', 'customer', 'customername', 'client', 'clientname', 'contactname', 'buyer'],
      phone: ['phone', 'mobile', 'cell', 'telephone', 'phonenumber', 'contactno', 'whatsapp', 'wanumber'],
      email: ['email', 'emailaddress', 'mail', 'emailid'],
      city: ['city', 'location', 'town', 'address', 'place', 'state'],
      source: ['source', 'channel', 'leadsource', 'acquisition', 'utmsource'],
      total_orders: ['orders', 'totalorders', 'ordercount', 'purchases'],
      total_spend: ['totalspend', 'spend', 'amount', 'total', 'revenue', 'ltv', 'value'],
      status: ['status', 'customerstatus'],
      notes: ['notes', 'remarks', 'comment'],
    },
    leads: {
      name: ['name', 'leadname', 'contactname', 'fullname', 'client'],
      phone: ['phone', 'mobile', 'whatsapp', 'cell', 'phonenumber', 'contact'],
      email: ['email', 'emailaddress', 'mail'],
      source: ['source', 'leadsource', 'channel', 'platform'],
      score: ['score', 'leadscore', 'priority', 'rating'],
      budget: ['budget', 'dealvalue', 'estimatedvalue', 'amount'],
      interest: ['interest', 'product', 'service', 'inquiry', 'requirement', 'lookingfor'],
      status: ['status', 'leadstatus'],
      notes: ['notes', 'remarks'],
    },
    orders: {
      customer_name: ['customer', 'customername', 'client', 'buyer', 'billedto', 'name'],
      item_name: ['item', 'itemname', 'product', 'productname', 'service', 'description', 'title'],
      quantity: ['quantity', 'qty', 'count', 'units'],
      total_amount: ['totalamount', 'amount', 'total', 'price', 'netamount', 'grandtotal', 'subtotal'],
      tax_amount: ['tax', 'taxamount', 'gst', 'vat'],
      payment_method: ['method', 'paymentmethod', 'paymenttype', 'mode'],
      payment_status: ['paymentstatus', 'status', 'paystatus'],
      order_status: ['orderstatus', 'fulfillmentstatus'],
      order_date: ['date', 'orderdate', 'createdat', 'invoicedate'],
    },
    products: {
      name: ['name', 'productname', 'title', 'item', 'itemname'],
      sku: ['sku', 'itemcode', 'productcode', 'barcode', 'skuid', 'id'],
      category: ['category', 'productcategory', 'type', 'group'],
      price: ['price', 'mrp', 'sellingprice', 'rate', 'unitprice'],
      cost: ['cost', 'costprice', 'buyingprice', 'cogs', 'unitcost'],
      stock_quantity: ['stock', 'stockquantity', 'inventory', 'quantity', 'qty', 'onhand'],
    },
    services: {
      name: ['name', 'servicename', 'therapy', 'package', 'treatment', 'title'],
      category: ['category', 'servicecategory', 'type', 'department'],
      duration_minutes: ['duration', 'durationminutes', 'minutes', 'time', 'length'],
      price: ['price', 'fee', 'rate', 'charge', 'cost'],
      description: ['description', 'details', 'summary', 'about'],
    },
    bookings: {
      customer_name: ['customer', 'customername', 'client', 'patient', 'name'],
      customer_phone: ['phone', 'mobile', 'contact', 'telephone'],
      service_name: ['service', 'servicename', 'therapy', 'appointment', 'treatment'],
      booking_date: ['date', 'bookingdate', 'appointmentdate'],
      time_slot: ['time', 'timeslot', 'slot', 'schedule'],
      amount: ['amount', 'fee', 'price', 'total', 'charge'],
      status: ['status', 'bookingstatus'],
    },
    expenses: {
      title: ['title', 'expense', 'description', 'purpose', 'item'],
      amount: ['amount', 'expenseamount', 'cost', 'total'],
      category: ['category', 'expensecategory', 'type'],
      expense_date: ['date', 'expensedate', 'paiddate', 'createdat'],
      vendor: ['vendor', 'supplier', 'payee', 'merchant', 'party'],
      payment_method: ['method', 'paymentmethod', 'mode'],
      is_recurring: ['recurring', 'isrecurring', 'monthly'],
    },
  };

  const targetAliases = ALIASES[targetType] || {};
  for (const [field, aliases] of Object.entries(targetAliases)) {
    // 1. First attempt exact match
    let match = lowerHeaders.find((h) => aliases.includes(h.normalized));
    // 2. If no exact match, attempt substring match with conflict safety
    if (!match) {
      match = lowerHeaders.find((h) => {
        if (field === 'city' && h.normalized.includes('email')) return false;
        if (field === 'name' && (h.normalized.includes('item') || h.normalized.includes('product'))) return false;
        return aliases.some((a) => a.length >= 3 && h.normalized.includes(a));
      });
    }
    if (match) {
      result[field] = match.original;
    }
  }

  return result;
}

export interface DataHealthScore {
  score: number; // 0 - 100
  tier: 'Low' | 'Moderate' | 'Strong' | 'Enterprise Grade';
  breakdown: {
    customerScore: number; // 0 - 25
    catalogScore: number; // 0 - 25
    salesScore: number; // 0 - 25
    overheadScore: number; // 0 - 25
  };
  metrics: {
    totalRecords: number;
    sourcesCount: number;
    duplicateCountTotal: number;
  };
  recommendations: string[];
}

/**
 * Calculates business data completeness and readiness for AI diagnostic and autonomous agents.
 */
export function calculateDataHealthScore(params: {
  customers: any[];
  leads: any[];
  orders: any[];
  products: any[];
  services: any[];
  expenses: any[];
  dataSources: any[];
}): DataHealthScore {
  const { customers = [], leads = [], orders = [], products = [], services = [], expenses = [], dataSources = [] } = params;

  // 1. Customer Base Coverage (max 25)
  const custCount = (customers || []).length;
  const leadCount = (leads || []).length;
  let customerScore = 0;
  if (custCount >= 20 || custCount + leadCount >= 30) customerScore = 25;
  else if (custCount >= 5 || custCount + leadCount >= 10) customerScore = 18;
  else if (custCount > 0 || leadCount > 0) customerScore = 10;

  // 2. Catalog & Offerings (max 25)
  const prodCount = (products || []).length;
  const srvCount = (services || []).length;
  let catalogScore = 0;
  if (prodCount + srvCount >= 10) catalogScore = 25;
  else if (prodCount + srvCount >= 4) catalogScore = 18;
  else if (prodCount + srvCount > 0) catalogScore = 10;

  // 3. Sales & Revenue Orders Ledger (max 25)
  const orderCount = (orders || []).length;
  let salesScore = 0;
  if (orderCount >= 25) salesScore = 25;
  else if (orderCount >= 8) salesScore = 18;
  else if (orderCount > 0) salesScore = 10;

  // 4. Overhead & Expense Margins (max 25)
  const expCount = (expenses || []).length;
  let overheadScore = 0;
  if (expCount >= 10) overheadScore = 25;
  else if (expCount >= 3) overheadScore = 18;
  else if (expCount > 0) overheadScore = 10;

  const score = Math.min(100, Math.max(0, customerScore + catalogScore + salesScore + overheadScore));

  let tier: DataHealthScore['tier'] = 'Low';
  if (score >= 85) tier = 'Enterprise Grade';
  else if (score >= 65) tier = 'Strong';
  else if (score >= 40) tier = 'Moderate';

  const recommendations: string[] = [];
  if (customerScore < 20) {
    recommendations.push('Import past customer contacts or leads from WhatsApp / CRM to build customer intelligence.');
  }
  if (catalogScore < 20) {
    recommendations.push('Import your product SKUs or service menu prices (or scan your website) to enable margin analysis.');
  }
  if (salesScore < 20) {
    recommendations.push('Upload past 30-90 days of sales order history to calculate true recurring revenue & repeat purchase rates.');
  }
  if (overheadScore < 20) {
    recommendations.push('Add operating expenses (rent, salaries, utility bills) to generate authentic Net P&L statements.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Data maturity is optimal. AI Diagnosis and autonomous business agents are operating with highest confidence.');
  }

  const totalRecords = custCount + leadCount + prodCount + srvCount + orderCount + expCount;

  return {
    score,
    tier,
    breakdown: {
      customerScore,
      catalogScore,
      salesScore,
      overheadScore,
    },
    metrics: {
      totalRecords,
      sourcesCount: (dataSources || []).length,
      duplicateCountTotal: 0,
    },
    recommendations,
  };
}

/**
 * Standard CSV Export Utility
 */
export function exportToCSV(data: Array<Record<string, any>>, filename = 'export.csv'): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);

  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeCell).join(',');
  const rows = data.map((row) => headers.map((h) => escapeCell(row[h])).join(','));
  const csvContent = [headerRow, ...rows].join('\n');

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore if document not attached
    }
  }

  return csvContent;
}
