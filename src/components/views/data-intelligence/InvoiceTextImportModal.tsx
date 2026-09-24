import React, { useState } from 'react';
import {
  FileText,
  Receipt,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { parsePDFInvoiceText, ParsedInvoiceData, cleanNumeric } from '../../../lib/data-importer';

interface InvoiceTextImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportExtractedRows: (rows: Array<Record<string, any>>, type: 'orders' | 'expenses') => void;
}

export const InvoiceTextImportModal: React.FC<InvoiceTextImportModalProps> = ({
  isOpen,
  onClose,
  onImportExtractedRows,
}) => {
  const [invoiceText, setInvoiceText] = useState('');
  const [targetType, setTargetType] = useState<'orders' | 'expenses'>('orders');
  const [parsedData, setParsedData] = useState<ParsedInvoiceData | null>(null);

  if (!isOpen) return null;

  const handleParse = () => {
    if (!invoiceText.trim()) return;
    const res = parsePDFInvoiceText(invoiceText);
    setParsedData(res);
  };

  const handleApply = () => {
    if (!parsedData) return;

    if (targetType === 'orders') {
      const rows =
        parsedData.lineItems.length > 0
          ? parsedData.lineItems.map((item, idx) => ({
              customer_name: parsedData.partyName || 'Invoice Customer',
              item_name: item.description || `Item #${idx + 1}`,
              quantity: item.quantity || 1,
              total_amount: item.amount || item.unitPrice * (item.quantity || 1),
              tax_amount: parsedData.taxAmount ? Math.round(parsedData.taxAmount / parsedData.lineItems.length) : 0,
              payment_method: 'UPI/Online',
              payment_status: 'paid',
              order_status: 'delivered',
              order_date: parsedData.date || new Date().toISOString().split('T')[0],
            }))
          : [
              {
                customer_name: parsedData.partyName || 'Invoice Customer',
                item_name: parsedData.invoiceNumber ? `Invoice #${parsedData.invoiceNumber}` : 'General Order',
                quantity: 1,
                total_amount: parsedData.totalAmount || 0,
                tax_amount: parsedData.taxAmount || 0,
                payment_method: 'UPI/Online',
                payment_status: 'paid',
                order_status: 'delivered',
                order_date: parsedData.date || new Date().toISOString().split('T')[0],
              },
            ];
      onImportExtractedRows(rows, 'orders');
    } else {
      // Expenses
      const rows =
        parsedData.lineItems.length > 0
          ? parsedData.lineItems.map((item) => ({
              title: item.description || `Invoice Expense`,
              amount: item.amount || item.unitPrice * (item.quantity || 1),
              category: 'inventory',
              vendor: parsedData.partyName || 'Vendor Supply',
              payment_method: 'Bank Transfer',
              expense_date: parsedData.date || new Date().toISOString().split('T')[0],
              is_recurring: false,
            }))
          : [
              {
                title: parsedData.invoiceNumber ? `Invoice Bill #${parsedData.invoiceNumber}` : 'Vendor Expense',
                amount: parsedData.totalAmount || 0,
                category: 'inventory',
                vendor: parsedData.partyName || 'Supplier',
                payment_method: 'Bank Transfer',
                expense_date: parsedData.date || new Date().toISOString().split('T')[0],
                is_recurring: false,
              },
            ];
      onImportExtractedRows(rows, 'expenses');
    }

    onClose();
  };

  const sampleInvoice = `INVOICE #INV-2026-8891
Date: 2026-08-25
Bill To: Priya Nair, Indiranagar Clinic
Vendor: AyurSupply Herbals Ltd, Bangalore

Description            Qty   Unit Price   Total
Herbal Massage Oil 5L   2      1,400      2,800
Ayurvedic Scrub 1kg     4        450      1,800
Brass Steam Pot         1      3,200      3,200

Subtotal: 7,800
GST 18%: 1,404
Total Amount Payable: 9,204`;

  return (
    <div id="invoice-text-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Paste Digital Invoice or Receipt Text</h3>
              <p className="text-xs text-slate-400">
                Extract invoice numbers, totals, tax, line items, and vendor/customer info directly into your ledger.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Ingestion Record</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="orders">Sales Orders (Customer Invoices)</option>
              <option value="expenses">Operating Expenses (Vendor Bills & Supplies)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setInvoiceText(sampleInvoice);
                setParsedData(parsePDFInvoiceText(sampleInvoice));
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Sample Invoice Text</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Raw Text (Copy/pasted from PDF, Email, or WhatsApp invoice)
          </label>
          <textarea
            rows={6}
            value={invoiceText}
            onChange={(e) => {
              setInvoiceText(e.target.value);
              if (e.target.value.trim()) {
                setParsedData(parsePDFInvoiceText(e.target.value));
              } else {
                setParsedData(null);
              }
            }}
            placeholder="Paste text here..."
            className="w-full font-mono text-xs bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Parsed Preview */}
        {parsedData && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            <h4 className="font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Detected Invoice Metadata
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Invoice #</span>
                <span className="font-mono font-semibold text-slate-200">{parsedData.invoiceNumber || 'Not specified'}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Date</span>
                <span className="font-mono font-semibold text-slate-200">{parsedData.date || 'Today'}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Party / Vendor</span>
                <span className="font-semibold text-slate-200 truncate block">{parsedData.partyName || 'General'}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Total Amount</span>
                <span className="font-mono font-bold text-emerald-400">₹{parsedData.totalAmount || 0}</span>
              </div>
            </div>

            {parsedData.lineItems.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-800/80">
                <span className="text-slate-400 font-semibold block text-[11px]">
                  Extracted Line Items ({parsedData.lineItems.length})
                </span>
                <div className="space-y-1">
                  {parsedData.lineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 text-slate-300 font-mono text-[11px]"
                    >
                      <span>{item.description} (x{item.quantity})</span>
                      <span className="text-emerald-400 font-bold">₹{item.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!parsedData}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply to Ingestion Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
