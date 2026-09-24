import React, { useState, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Layers,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Calendar,
  DollarSign,
  UserCheck,
  ShoppingBag,
  Clock,
  ArrowRight,
  Filter,
  Globe,
  Sliders,
  TrendingUp,
  Download,
  Receipt,
  FileCode,
  Users,
} from 'lucide-react';
import {
  parseCSVText,
  detectSchemaType,
  cleanAndValidateImport,
  SupportedEntityType,
  ImportPreviewResult,
  SAMPLE_DATASETS,
  parseExcelBuffer,
  getSuggestedFieldMappings,
  exportToCSV,
} from '../../lib/data-importer';
import { WebsiteImportModal } from './WebsiteImportModal';
import { DataHealthCard } from './data-intelligence/DataHealthCard';
import { DataExportAndHistory } from './data-intelligence/DataExportAndHistory';
import { InvoiceTextImportModal } from './data-intelligence/InvoiceTextImportModal';

export const DataIntegrationView: React.FC = () => {
  const {
    business,
    dataSources,
    customers,
    leads,
    orders,
    products,
    services,
    bookings,
    expenses,
    commitImportData,
    syncToSupabase,
    isSyncing,
    showToast,
  } = useBusinessStore();

  const [activeSection, setActiveSection] = useState<'importer' | 'website' | 'health' | 'history'>('importer');
  const [rawText, setRawText] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<SupportedEntityType>('customers');
  const [fileName, setFileName] = useState('Pasted Data');
  const [activeTab, setActiveTab] = useState<'all' | 'valid' | 'duplicates' | 'errors'>('all');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [showMappingDrawer, setShowMappingDrawer] = useState(false);
  const [customMappings, setCustomMappings] = useState<Record<string, string>>({});

  // Get existing records for duplicate cross-referencing
  const existingRecords = useMemo(() => {
    switch (selectedTarget) {
      case 'customers':
        return customers;
      case 'leads':
        return leads;
      case 'orders':
        return orders;
      case 'products':
        return products;
      case 'services':
        return services;
      case 'bookings':
        return bookings;
      case 'expenses':
        return expenses;
      default:
        return [];
    }
  }, [selectedTarget, customers, leads, orders, products, services, bookings, expenses]);

  // Detected raw headers from current text
  const currentHeaders = useMemo(() => {
    if (!rawText.trim()) return [];
    const { headers } = parseCSVText(rawText);
    return headers;
  }, [rawText]);

  // Suggested field mappings based on target and detected headers
  const suggestedMappings = useMemo(() => {
    if (currentHeaders.length === 0) return {};
    return getSuggestedFieldMappings(selectedTarget, currentHeaders);
  }, [selectedTarget, currentHeaders]);

  // Active mappings combined
  const activeMappings = useMemo(() => {
    return { ...suggestedMappings, ...customMappings };
  }, [suggestedMappings, customMappings]);

  // Compute parsed & validated import preview
  const previewResult: ImportPreviewResult | null = useMemo(() => {
    if (!rawText.trim()) return null;
    const { rows } = parseCSVText(rawText);
    if (rows.length === 0) return null;

    const result = cleanAndValidateImport(rows, selectedTarget, activeMappings, existingRecords);
    result.fileName = fileName;
    return result;
  }, [rawText, selectedTarget, fileName, activeMappings, existingRecords]);

  const handleLoadSample = (type: SupportedEntityType) => {
    setSelectedTarget(type);
    setFileName(`Sample_${type}.csv`);
    setRawText(SAMPLE_DATASETS[type] || '');
    setCustomMappings({});
    setActiveTab('all');
    showToast('info', 'Loaded Sample Data', `Loaded verified sample dataset for ${type}.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const parsed = parseExcelBuffer(buffer);
          if (parsed.headers.length === 0 || parsed.rows.length === 0) {
            showToast('error', 'Empty Excel File', 'Excel file seems empty or could not be parsed.');
            return;
          }
          const csvString = exportToCSV(parsed.rows);
          setRawText(csvString);
          const detected = detectSchemaType(parsed.headers);
          setSelectedTarget(detected);
          setCustomMappings({});
          setActiveTab('all');
          showToast('info', 'Excel Loaded', `Loaded worksheet "${parsed.activeSheet}" with ${parsed.rows.length} rows. Detected: ${detected.toUpperCase()}`);
        } catch (err: any) {
          showToast('error', 'Excel Parse Error', err.message || 'Failed to read Excel workbook.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setRawText(content);
        const { headers } = parseCSVText(content);
        const detected = detectSchemaType(headers);
        setSelectedTarget(detected);
        setCustomMappings({});
        setActiveTab('all');
        showToast('info', 'File Loaded', `Loaded ${file.name}. Detected collection: ${detected.toUpperCase()}`);
      };
      reader.readAsText(file);
    }
  };

  const handleInvoiceExtractedRows = (rows: Array<Record<string, any>>, type: 'orders' | 'expenses') => {
    setSelectedTarget(type);
    setFileName(`Digital_Invoice_${type}.csv`);
    const csvContent = exportToCSV(rows);
    setRawText(csvContent);
    setCustomMappings({});
    setActiveTab('all');
    showToast('success', 'Invoice Extracted', `Loaded ${rows.length} records into ${type.toUpperCase()} ingestion pipeline.`);
  };

  const handleCommitImport = () => {
    if (!previewResult) {
      showToast('error', 'No Data Available', 'Please provide or upload data content first.');
      return;
    }

    const validRecordsToCommit = previewResult.records
      .filter((r) => r.isValid && !r.isDuplicate)
      .map((r) => r.data);

    if (validRecordsToCommit.length === 0) {
      showToast('error', 'No Valid Records', 'No valid non-duplicate records found to import.');
      return;
    }

    commitImportData(
      selectedTarget,
      validRecordsToCommit,
      fileName,
      fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ? 'excel' : 'csv'
    );

    setIsConfirming(false);
    setRawText('');
    setCustomMappings({});
    setFileName('Pasted Data');
    showToast('success', 'Import Succeeded', `Successfully ingested ${validRecordsToCommit.length} records into ${selectedTarget}.`);
  };

  const filteredRecords = useMemo(() => {
    if (!previewResult) return [];
    if (activeTab === 'valid') return previewResult.records.filter((r) => r.isValid && !r.isDuplicate);
    if (activeTab === 'duplicates') return previewResult.records.filter((r) => r.isDuplicate);
    if (activeTab === 'errors') return previewResult.records.filter((r) => !r.isValid);
    return previewResult.records;
  }, [previewResult, activeTab]);

  return (
    <div id="data-integration-view" className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            Data Intelligence & Website Intelligence Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingest and normalize historical business data (CSV/Excel/PDF) and scan live websites with multi-tenant isolation and Day-0 baselines.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsWebsiteModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all shrink-0"
          >
            <Globe className="w-4 h-4 text-amber-300" />
            <span>Scan Website</span>
          </button>

          <button
            onClick={syncToSupabase}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-400' : 'text-emerald-400'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync DB'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        <button
          onClick={() => setActiveSection('importer')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSection === 'importer'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Data Ingestion (CSV / Excel / PDF)</span>
        </button>

        <button
          onClick={() => setActiveSection('website')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSection === 'website'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Website Intelligence Scanner</span>
        </button>

        <button
          onClick={() => setActiveSection('health')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSection === 'health'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Data Maturity Index</span>
        </button>

        <button
          onClick={() => setActiveSection('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSection === 'history'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Ingestion Audit & CSV Export</span>
        </button>
      </div>

      {/* SECTION 1: IMPORTER */}
      {activeSection === 'importer' && (
        <div className="space-y-6">
          {/* 1-Click Starter Datasets & Quick Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong className="text-slate-100">1-Click Starter Datasets:</strong> Pre-validated real-world datasets across all business operations:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Paste Invoice Text</span>
                </button>
                <span className="text-[11px] text-slate-500 font-medium">Tenant ID: {business.id}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { type: 'customers', label: 'Customers', icon: UserCheck },
                  { type: 'leads', label: 'Inbound Leads', icon: Sparkles },
                  { type: 'orders', label: 'Sales Orders', icon: DollarSign },
                  { type: 'products', label: 'Product SKUs', icon: ShoppingBag },
                  { type: 'services', label: 'Service Items', icon: Layers },
                  { type: 'bookings', label: 'Bookings', icon: Calendar },
                  { type: 'expenses', label: 'Operating Expenses', icon: Clock },
                ] as const
              ).map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => handleLoadSample(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                    selectedTarget === type && rawText
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Ingestion Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Upload & Configuration (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                1. Configure & Provide Dataset
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Entity Collection
                </label>
                <select
                  value={selectedTarget}
                  onChange={(e) => {
                    setSelectedTarget(e.target.value as SupportedEntityType);
                    setCustomMappings({});
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="customers">Customers (CRM & Retention)</option>
                  <option value="leads">Leads (Speed-to-Lead Funnel)</option>
                  <option value="orders">Orders (Revenue & Sales Ledger)</option>
                  <option value="products">Products & SKUs (Inventory Catalog)</option>
                  <option value="services">Services (Packages & Treatment Menu)</option>
                  <option value="bookings">Bookings (Appointments & Sessions)</option>
                  <option value="expenses">Expenses (Operating P&L Overhead)</option>
                </select>
              </div>

              {/* Drag & Drop Box */}
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl p-5 text-center cursor-pointer transition-colors relative bg-slate-950/40">
                <input
                  type="file"
                  accept=".csv,.txt,.tsv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileSpreadsheet className="w-7 h-7 text-indigo-400 mx-auto mb-2" />
                <div className="font-semibold text-xs text-slate-200">
                  Browse or drop CSV, TSV, or Excel (.xlsx/.xls)
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Auto-detects delimiter, worksheet, and schema columns
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Or Paste Plaintext (CSV / Tab-Separated)
                  </label>
                  {rawText && (
                    <button
                      onClick={() => {
                        setRawText('');
                        setCustomMappings({});
                        setFileName('Pasted Data');
                      }}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste comma or tab-delimited text from Google Sheets, Excel, or POS export..."
                  className="w-full font-mono text-xs bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Column Mapping Toggle Drawer */}
              {currentHeaders.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      Column Mappings ({currentHeaders.length} headers detected)
                    </span>
                    <button
                      onClick={() => setShowMappingDrawer(!showMappingDrawer)}
                      className="text-xs text-indigo-400 hover:underline font-semibold"
                    >
                      {showMappingDrawer ? 'Hide Details' : 'Customize'}
                    </button>
                  </div>

                  {showMappingDrawer && (
                    <div className="space-y-2 pt-2 border-t border-slate-800 text-xs max-h-48 overflow-y-auto pr-1">
                      {currentHeaders.map((hdr) => (
                        <div key={hdr} className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 font-mono text-[11px] truncate">{hdr}</span>
                          <select
                            value={activeMappings[hdr] || hdr}
                            onChange={(e) => {
                              setCustomMappings((prev) => ({
                                ...prev,
                                [hdr]: e.target.value,
                              }));
                            }}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
                          >
                            <option value={hdr}>{hdr} (Direct)</option>
                            <option value="name">name</option>
                            <option value="phone">phone</option>
                            <option value="email">email</option>
                            <option value="city">city</option>
                            <option value="price">price</option>
                            <option value="amount">amount / total</option>
                            <option value="sku">sku</option>
                            <option value="category">category</option>
                            <option value="quantity">quantity</option>
                            <option value="date">date</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Import Action Button */}
              {previewResult && (
                <div className="pt-2">
                  <button
                    onClick={() => setIsConfirming(true)}
                    disabled={previewResult.validCount === 0}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>
                      Verify & Ingest {previewResult.validCount} Valid Record{previewResult.validCount === 1 ? '' : 's'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Validation Preview & Record Table (7 cols) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    2. Validation & Quality Inspection
                  </h3>
                  {previewResult && (
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                      {previewResult.rawCount} Total Rows Ingested
                    </span>
                  )}
                </div>

                {previewResult ? (
                  <div className="mt-4 space-y-4">
                    {/* Metric Badges */}
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setActiveTab('valid')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          activeTab === 'valid'
                            ? 'bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-emerald-950/20 border-emerald-800/40 hover:bg-emerald-950/40'
                        }`}
                      >
                        <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ready to Import</span>
                        </div>
                        <div className="text-lg font-bold text-emerald-300 mt-1">
                          {previewResult.validCount}
                        </div>
                      </button>

                      <button
                        onClick={() => setActiveTab('duplicates')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          activeTab === 'duplicates'
                            ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500'
                            : 'bg-amber-950/20 border-amber-800/40 hover:bg-amber-950/40'
                        }`}
                      >
                        <div className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Duplicates Skipped</span>
                        </div>
                        <div className="text-lg font-bold text-amber-300 mt-1">
                          {previewResult.duplicateCount}
                        </div>
                      </button>

                      <button
                        onClick={() => setActiveTab('errors')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          activeTab === 'errors'
                            ? 'bg-rose-950/60 border-rose-500 ring-1 ring-rose-500'
                            : 'bg-rose-950/20 border-rose-800/40 hover:bg-rose-950/40'
                        }`}
                      >
                        <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Invalid Rows</span>
                        </div>
                        <div className="text-lg font-bold text-rose-300 mt-1">
                          {previewResult.errorCount}
                        </div>
                      </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                      <span className="text-[11px] font-semibold text-slate-400">View:</span>
                      {(['all', 'valid', 'duplicates', 'errors'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors capitalize ${
                            activeTab === tab
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Record Table / Card List */}
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {filteredRecords.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-500">
                          No records match the current filter.
                        </div>
                      ) : (
                        filteredRecords.map((record) => (
                          <div
                            key={record.originalIndex}
                            className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                              !record.isValid
                                ? 'bg-rose-950/30 border-rose-800/60 text-slate-300'
                                : record.isDuplicate
                                ? 'bg-amber-950/30 border-amber-800/60 text-slate-300'
                                : 'bg-slate-950 border-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="space-y-1 truncate">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-slate-500">#{record.originalIndex}</span>
                                <span className="font-bold truncate">
                                  {record.data.name || record.data.title || record.data.customer_name || 'Unnamed Record'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate">
                                {Object.entries(record.data)
                                  .filter(([k]) => !['id', 'name', 'title', 'customer_name', 'business_id'].includes(k))
                                  .slice(0, 3)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(' • ')}
                              </div>
                              {record.isDuplicate && (
                                <div className="text-[10px] text-amber-400 font-medium">
                                  Duplicate skipped: {record.duplicateReason}
                                </div>
                              )}
                              {record.errors.length > 0 && (
                                <div className="text-[10px] text-rose-400 font-medium">
                                  Error: {record.errors.join('; ')}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0">
                              {!record.isValid ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                                  INVALID
                                </span>
                              ) : record.isDuplicate ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                                  DUPLICATE
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                  READY
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-400 text-xs">
                    <FileText className="w-9 h-9 mx-auto mb-2 opacity-40 text-slate-500" />
                    <div className="font-semibold text-slate-300">No Dataset Active</div>
                    <div className="text-slate-500 mt-1 max-w-sm mx-auto">
                      Select a 1-click starter dataset above or drop an Excel/CSV file to validate and map columns in real-time.
                    </div>
                  </div>
                )}
              </div>

              {/* Quick History Snapshot */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>{dataSources.length} source{dataSources.length === 1 ? '' : 's'} ingested</span>
                <button
                  onClick={() => setActiveSection('history')}
                  className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>View All Ingestions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: WEBSITE SCANNER */}
      {activeSection === 'website' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  Website Intelligence Engine
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    SSRF Protected
                  </span>
                </h3>
                <p className="text-xs text-slate-400 max-w-xl">
                  Automatically extracts public business identity, catalog offerings, prices, and contact details from any live website URL. All scans enforce server-side DNS resolution, private subnet blocking, and audit logging.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsWebsiteModalOpen(true)}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Launch Website Scanner</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Website Capabilities Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Anti-SSRF Armor</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prevents requests to 127.0.0.1, 10.0.0.0/8, 192.168.0.0/16, AWS/GCP metadata endpoints (169.254.169.254), and loopback IPv6 addresses.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <ShoppingBag className="w-4 h-4" />
                <span>Catalog Extraction</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Extracts products, treatments, menu prices, durations, and categorizations into your database with Day-0 Business Memory provenance.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Users className="w-4 h-4" />
                <span>Truthfulness & Grounding</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Flags unverified or synthetic pricing with clear caution tags. Preserves the authentic original domain and crawl timestamp in the audit trail.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DATA MATURITY & HEALTH */}
      {activeSection === 'health' && (
        <DataHealthCard
          customers={customers}
          leads={leads}
          orders={orders}
          products={products}
          services={services}
          expenses={expenses}
          dataSources={dataSources}
          onActionClick={() => setActiveSection('importer')}
        />
      )}

      {/* SECTION 4: AUDIT HISTORY & CSV EXPORT */}
      {activeSection === 'history' && (
        <DataExportAndHistory
          businessId={business.id}
          dataSources={dataSources}
          customers={customers}
          leads={leads}
          orders={orders}
          products={products}
          services={services}
          bookings={bookings}
          expenses={expenses}
          showToast={showToast}
        />
      )}

      {/* Confirmation Modal */}
      {isConfirming && previewResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Confirm Real Data Import</h3>
                <p className="text-xs text-slate-400">
                  Target: <strong className="text-indigo-300">{selectedTarget.toUpperCase()}</strong> collection
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Rows Detected:</span>
                <span className="font-mono font-bold text-slate-200">{previewResult.rawCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400 font-semibold">Valid Non-Duplicate Records:</span>
                <span className="font-mono font-bold text-emerald-300">{previewResult.validCount}</span>
              </div>
              {previewResult.duplicateCount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Duplicates to Skip:</span>
                  <span className="font-mono font-bold">{previewResult.duplicateCount}</span>
                </div>
              )}
              {previewResult.errorCount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Invalid Rows to Skip:</span>
                  <span className="font-mono font-bold">{previewResult.errorCount}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                <span>Multi-tenant Isolation:</span>
                <span className="font-mono text-indigo-400">{business.id}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Importing will persist these records, establish a Day-0 baseline in Business Memory, and automatically recalculate real operational metrics.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsConfirming(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitImport}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Ingest Records</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Website Import Modal */}
      <WebsiteImportModal
        isOpen={isWebsiteModalOpen}
        onClose={() => setIsWebsiteModalOpen(false)}
      />

      {/* Invoice Text Import Modal */}
      <InvoiceTextImportModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onImportExtractedRows={handleInvoiceExtractedRows}
      />
    </div>
  );
};
