import React from 'react';
import {
  Download,
  Database,
  CheckCircle2,
  Users,
  Sparkles,
  ShoppingBag,
  Receipt,
  Layers,
  Calendar,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { exportToCSV } from '../../../lib/data-importer';
import { DataSource } from '../../../types/database';

interface DataExportAndHistoryProps {
  businessId: string;
  dataSources: DataSource[];
  customers: any[];
  leads: any[];
  orders: any[];
  products: any[];
  services: any[];
  bookings: any[];
  expenses: any[];
  showToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const DataExportAndHistory: React.FC<DataExportAndHistoryProps> = ({
  businessId,
  dataSources,
  customers,
  leads,
  orders,
  products,
  services,
  bookings,
  expenses,
  showToast,
}) => {
  const handleExport = (collectionName: string, data: any[], filename: string) => {
    if (!data || data.length === 0) {
      showToast('warning', 'Empty Collection', `No ${collectionName} records available to export.`);
      return;
    }
    try {
      exportToCSV(data, filename);
      showToast('success', 'Export Completed', `Exported ${data.length} ${collectionName} records to ${filename}.`);
    } catch (err: any) {
      showToast('error', 'Export Failed', err.message);
    }
  };

  const exportEntities = [
    { name: 'Customers', count: customers.length, data: customers, icon: Users, filename: `customers_${businessId}.csv` },
    { name: 'Leads', count: leads.length, data: leads, icon: Sparkles, filename: `leads_${businessId}.csv` },
    { name: 'Sales Orders', count: orders.length, data: orders, icon: Receipt, filename: `orders_${businessId}.csv` },
    { name: 'Product SKUs', count: products.length, data: products, icon: ShoppingBag, filename: `products_${businessId}.csv` },
    { name: 'Services Menu', count: services.length, data: services, icon: Layers, filename: `services_${businessId}.csv` },
    { name: 'Bookings', count: bookings.length, data: bookings, icon: Calendar, filename: `bookings_${businessId}.csv` },
    { name: 'Operating Expenses', count: expenses.length, data: expenses, icon: Clock, filename: `expenses_${businessId}.csv` },
  ];

  return (
    <div id="data-export-and-history" className="space-y-6">
      {/* 1-Click CSV Export Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-400" />
              1-Click Clean CSV Data Export
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Export multi-tenant isolated database tables to standardized RFC-4180 CSV files at any time.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">Tenant: {businessId}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {exportEntities.map((ent) => {
            const Icon = ent.icon;
            return (
              <div
                key={ent.name}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-200 truncate">{ent.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{ent.count} records</div>
                  </div>
                </div>

                <button
                  onClick={() => handleExport(ent.name, ent.data, ent.filename)}
                  disabled={ent.count === 0}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-slate-700 shrink-0"
                  title={`Export ${ent.name}`}
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>CSV</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical Ingestion Audit Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            Historical Ingestion Audit Log ({dataSources.length} sources)
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Isolated for {businessId}</span>
        </div>

        {dataSources.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-600" />
            No external datasets or websites ingested yet. Use the Data Ingestion tab to import your first records.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {dataSources.map((ds) => (
              <div
                key={ds.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-200">{ds.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Type: <span className="uppercase text-slate-400">{ds.source_type}</span> • ID: {ds.id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="font-mono text-slate-300 font-bold">
                    {ds.record_count || ds.records_count || 0} records
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold uppercase">
                    {ds.status || 'Synced'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
