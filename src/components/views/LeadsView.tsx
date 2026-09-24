import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  UserPlus,
  Plus,
  Search,
  MessageCircle,
  Phone,
  Flame,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  Clock,
  ArrowRight,
  ShieldCheck,
  LayoutGrid,
  List,
  Sparkles,
  DollarSign,
  TrendingUp,
  UserCheck,
  ChevronRight,
  Send,
  Layers,
} from 'lucide-react';
import { Lead } from '../../types/database';
import {
  calculateDeterministicLeadScore,
  getLeadFunnelData,
  normalizePhoneNumber,
} from '../../lib/crm-engine';
import { LeadDetailDrawer } from '../crm/LeadDetailDrawer';
import { LeadFunnelStage } from '../../types/crm';

export const LeadsView: React.FC = () => {
  const {
    business,
    leads,
    customers,
    orders,
    addLead,
    updateLead,
    deleteLead,
    convertLeadToCustomer,
    showToast,
    addMemoryEntry,
    addAuditLog,
  } = useBusinessStore();

  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedDetailLead, setSelectedDetailLead] = useState<Lead | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('Instagram DM');
  const [budget, setBudget] = useState(3000);
  const [interest, setInterest] = useState('Doctor Consultation');
  const [notes, setNotes] = useState('');

  const currency = business.currency_symbol || '₹';

  // Lead Funnel Calculation
  const funnelStages = getLeadFunnelData(leads);

  const filteredLeads = leads.filter((l) => {
    const term = (searchTerm || '').toLowerCase();
    const lName = (l.name || '').toLowerCase();
    const lEmail = (l.email || '').toLowerCase();
    const lInterest = (l.interest_product_or_service || '').toLowerCase();

    const matchesSearch =
      lName.includes(term) ||
      (l.phone && l.phone.includes(searchTerm)) ||
      lEmail.includes(term) ||
      lInterest.includes(term);

    const matchesStage =
      selectedStageFilter === 'all' ||
      (selectedStageFilter === 'new' && l.status === 'new') ||
      (selectedStageFilter === 'contacted' && l.status === 'contacted') ||
      (selectedStageFilter === 'qualified' && l.status === 'qualified') ||
      (selectedStageFilter === 'proposal' &&
        (l.status === 'proposal' || l.status === 'proposal_sent' || l.status === 'intent')) ||
      (selectedStageFilter === 'won' && (l.status === 'won' || l.status === 'converted')) ||
      (selectedStageFilter === 'lost' && l.status === 'lost') ||
      (selectedStageFilter === 'dormant' && l.status === 'dormant');

    return matchesSearch && matchesStage;
  });

  const hotLeads = leads.filter(
    (l) => l.score >= 75 && l.status !== 'converted' && l.status !== 'lost' && l.status !== 'won'
  );
  const convertedLeads = leads.filter((l) => l.status === 'converted' || l.status === 'won');
  const totalPipelineBudget = leads.reduce((sum, l) => sum + (Number(l.budget) || 0), 0);
  const conversionRate = leads.length > 0 ? Math.round((convertedLeads.length / leads.length) * 100) : 0;

  const handleOpenAdd = () => {
    setEditingLead(null);
    setName('');
    setEmail('');
    setPhone('+91 ');
    setSource('WhatsApp Inbound');
    setBudget(3500);
    setInterest('Ayurvedic Consultation');
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (l: Lead) => {
    setEditingLead(l);
    setName(l.name);
    setEmail(l.email || '');
    setPhone(l.phone || '+91 ');
    setSource(l.source || 'Instagram Ad');
    setBudget(Number(l.budget) || 0);
    setInterest(l.interest_product_or_service || '');
    setNotes(l.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Missing Name', 'Please provide a valid lead name.');
      return;
    }

    // Compute initial deterministic score
    const tempLead: Lead = {
      id: editingLead ? editingLead.id : 'temp',
      business_id: business.id,
      name,
      email,
      phone,
      source,
      status: editingLead ? editingLead.status : 'new',
      score: 0,
      budget: Number(budget) || 0,
      interest_product_or_service: interest,
      last_follow_up: editingLead ? editingLead.last_follow_up : null,
      next_follow_up: new Date(Date.now() + 86400000).toISOString(),
      notes,
      converted_to_customer_id: editingLead ? editingLead.converted_to_customer_id : null,
      created_at: editingLead ? editingLead.created_at : new Date().toISOString(),
    };

    const calculated = calculateDeterministicLeadScore(tempLead, customers, orders);

    if (editingLead) {
      updateLead(editingLead.id, {
        name,
        email,
        phone,
        source,
        score: calculated.score,
        budget: Number(budget) || 0,
        interest_product_or_service: interest,
        notes,
      });
      showToast('success', 'Lead Updated', `Lead ${name} updated with score ${calculated.score}/100.`);
    } else {
      addLead({
        name,
        email,
        phone,
        source,
        status: 'new',
        score: calculated.score,
        budget: Number(budget) || 3000,
        interest_product_or_service: interest,
        last_follow_up: null,
        next_follow_up: new Date(Date.now() + 86400000).toISOString(),
        notes,
        converted_to_customer_id: null,
      });
    }

    setIsAddModalOpen(false);
  };

  const handleQuickAdvanceStage = (lead: Lead, nextStage: any) => {
    updateLead(lead.id, {
      status: nextStage,
      last_follow_up: new Date().toISOString(),
    });
    addAuditLog('LEAD_STAGE_ADVANCED', `Lead ${lead.name} moved to stage "${nextStage}"`);
    showToast('info', 'Stage Updated', `${lead.name} moved to "${nextStage}".`);
  };

  const handleConvertLead = (l: Lead) => {
    convertLeadToCustomer(l.id);
    addMemoryEntry({
      observation_type: 'milestone',
      period: 'monthly',
      title: `Lead Converted: ${l.name}`,
      content: `Inbound lead from ${l.source} converted to registered customer for ${l.interest_product_or_service || 'services'}.${l.budget ? ` Budget inquiry: ${currency}${Number(l.budget).toLocaleString('en-IN')}.` : ''}`,
      confidence_score: 95,
      outcome_recorded: `Added to CRM active customer base.`,
    });
  };

  const sendWhatsApp = (phone: string, name: string, interest: string) => {
    const cleanPhone = normalizePhoneNumber(phone);
    const msg = encodeURIComponent(
      `Namaste ${name} Ji! 🙏 Thank you for reaching out to ${business.name} regarding ${interest}. We have consultation slots open today. Would you like to reserve a time?`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            Lead Funnel & Speed-to-Lead Engine
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-data pipeline stages, deterministic lead scoring & human-in-the-loop conversion
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'pipeline'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pipeline Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table View</span>
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Inbound Lead</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Real Data Grounded) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">Inbound Pipeline</div>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">{leads.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Total inquiries received</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">Verified Conversion Rate</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{conversionRate}%</div>
          <div className="text-[11px] text-emerald-300 mt-1">{convertedLeads.length} converted to customers</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">Hot Leads (Score ≥75)</div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">{hotLeads.length}</div>
          <div className="text-[11px] text-amber-300 mt-1">High purchase intent</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">Pipeline Budget Value</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
            {currency}{totalPipelineBudget.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Combined buyer budget</div>
        </div>
      </div>

      {/* Search and Stage Selector Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by lead name, phone, email, or product interest..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-slate-400 whitespace-nowrap">Filter Stage:</span>
          <select
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Stages ({leads.length})</option>
            <option value="new">New Inbound</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal / Intent</option>
            <option value="won">Won / Converted</option>
            <option value="lost">Lost</option>
            <option value="dormant">Dormant</option>
          </select>
        </div>
      </div>

      {/* PIPELINE KANBAN VIEW */}
      {viewMode === 'pipeline' && (
        <div className="space-y-3">
          {leads.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
              <UserPlus className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="font-semibold text-slate-300">No leads recorded in this workspace.</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Capture inbound inquiries from WhatsApp, Meta ads, Instagram DMs, or walk-ins to start your speed-to-lead pipeline.
              </p>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Inbound Lead</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-x-auto pb-4">
              {funnelStages.slice(0, 5).map((stage) => {
                const stageLeadsFiltered = stage.leads.filter((l) => {
                  const term = (searchTerm || '').toLowerCase();
                  const lName = (l.name || '').toLowerCase();
                  const lInterest = (l.interest_product_or_service || '').toLowerCase();
                  return (
                    lName.includes(term) ||
                    (l.phone && l.phone.includes(searchTerm)) ||
                    lInterest.includes(term)
                  );
                });

                return (
                  <div
                    key={stage.stage}
                    className="bg-slate-950/80 border border-slate-800/80 rounded-xl flex flex-col min-w-[240px] max-h-[700px]"
                  >
                    {/* Stage Header */}
                    <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 rounded-t-xl">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              stage.stage === 'new'
                                ? 'bg-indigo-400'
                                : stage.stage === 'contacted'
                                ? 'bg-blue-400'
                                : stage.stage === 'qualified'
                                ? 'bg-amber-400'
                                : stage.stage === 'proposal'
                                ? 'bg-purple-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                          <h3 className="font-bold text-xs text-slate-200">{stage.label}</h3>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {currency}{stage.totalBudget.toLocaleString('en-IN')} pipeline
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-xs">
                        {stageLeadsFiltered.length}
                      </span>
                    </div>

                    {/* Stage Cards Container */}
                    <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5">
                      {stageLeadsFiltered.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-slate-500 italic rounded-lg border border-dashed border-slate-800/60">
                          No leads in this stage
                        </div>
                      ) : (
                        stageLeadsFiltered.map((l) => {
                          const leadScore = calculateDeterministicLeadScore(l, customers, orders);
                          return (
                            <div
                              key={l.id}
                              onClick={() => setSelectedDetailLead(l)}
                              className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 transition-all cursor-pointer shadow-xs space-y-2 group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-xs text-slate-100 group-hover:text-indigo-300 transition-colors">
                                    {l.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                    {l.interest_product_or_service || 'Consultation'}
                                  </div>
                                </div>

                                <div
                                  title={`Deterministic Score: ${leadScore.score}/100 (${leadScore.qualificationTier})`}
                                  className={`px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] flex items-center gap-0.5 shrink-0 ${
                                    leadScore.score >= 75
                                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                      : leadScore.score >= 50
                                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  <Flame className="w-2.5 h-2.5" />
                                  <span>{leadScore.score}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                                <span className="font-mono text-slate-300 font-medium">
                                  {l.budget > 0 ? `${currency}${Number(l.budget).toLocaleString('en-IN')}` : 'Budget N/A'}
                                </span>
                                <span className="text-[10px] text-slate-500 truncate max-w-[90px]">
                                  {l.source}
                                </span>
                              </div>

                              {/* Stage Quick Advance Buttons */}
                              <div
                                className="flex items-center justify-between pt-1 border-t border-slate-800/40 text-[10px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => sendWhatsApp(l.phone, l.name, l.interest_product_or_service)}
                                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </button>

                                {stage.stage === 'new' && (
                                  <button
                                    onClick={() => handleQuickAdvanceStage(l, 'contacted')}
                                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-semibold"
                                  >
                                    <span>Contact</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}

                                {stage.stage === 'contacted' && (
                                  <button
                                    onClick={() => handleQuickAdvanceStage(l, 'qualified')}
                                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-semibold"
                                  >
                                    <span>Qualify</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}

                                {stage.stage === 'qualified' && (
                                  <button
                                    onClick={() => handleQuickAdvanceStage(l, 'proposal')}
                                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-semibold"
                                  >
                                    <span>Proposal</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}

                                {stage.stage === 'proposal' && (
                                  <button
                                    onClick={() => handleConvertLead(l)}
                                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 font-bold"
                                  >
                                    <span>Convert</span>
                                    <UserCheck className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Lead Name</th>
                  <th className="py-3.5 px-4">Interest & Source</th>
                  <th className="py-3.5 px-4">Deterministic Score</th>
                  <th className="py-3.5 px-4">Stated Budget</th>
                  <th className="py-3.5 px-4">Stage Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No leads found matching your search and stage filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((l) => {
                    const leadScore = calculateDeterministicLeadScore(l, customers, orders);
                    return (
                      <tr
                        key={l.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedDetailLead(l)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                            {l.name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <Phone className="w-3 h-3 opacity-60" />
                            <span>{l.phone || 'No phone'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">{l.interest_product_or_service}</div>
                          <div className="text-[11px] text-slate-400">{l.source}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                                leadScore.score >= 75
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : leadScore.score >= 50
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {leadScore.score}/100
                            </span>
                            <span className="text-[11px] text-slate-400">({leadScore.qualificationTier})</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                          {l.budget > 0 ? `${currency}${Number(l.budget).toLocaleString('en-IN')}` : 'N/A'}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                              l.status === 'converted' || l.status === 'won'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : l.status === 'qualified'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : l.status === 'contacted'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            }`}
                          >
                            {l.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedDetailLead(l)}
                              title="Lead Inspector & Scoring Details"
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                              <span>Score Audit</span>
                            </button>
                            <button
                              onClick={() => sendWhatsApp(l.phone, l.name, l.interest_product_or_service)}
                              title="WhatsApp Message"
                              className="p-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            {l.status !== 'converted' && l.status !== 'won' && (
                              <button
                                onClick={() => handleConvertLead(l)}
                                title="Convert to Registered Customer"
                                className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 transition-colors"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(l)}
                              title="Edit Lead"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteLead(l.id)}
                              title="Delete Lead"
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

      {/* Lead Detail & Score Inspector Drawer */}
      {selectedDetailLead && (
        <LeadDetailDrawer
          lead={selectedDetailLead}
          isOpen={Boolean(selectedDetailLead)}
          onClose={() => setSelectedDetailLead(null)}
          onEdit={(l) => {
            setSelectedDetailLead(null);
            handleOpenEdit(l);
          }}
        />
      )}

      {/* Add / Edit Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base">{editingLead ? 'Edit Inbound Lead' : 'Add Inbound Lead'}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kavita Sundaram"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Phone (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98200 45112"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kavita@biocon.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Inbound Channel</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="WhatsApp Inbound">WhatsApp Inbound</option>
                    <option value="Instagram Ad (Sleep Health)">Instagram Ad (Sleep Health)</option>
                    <option value="Google Search Local">Google Search Local</option>
                    <option value="Website Chat Widget">Website Chat Widget</option>
                    <option value="Clinic Walk-in">Clinic Walk-in</option>
                    <option value="Referral">Patient Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Expected Budget ({currency})</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    placeholder="5000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Interest / Product / Service</label>
                <input
                  type="text"
                  required
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  placeholder="e.g. Prakriti Consultation + Sleep Elixir"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Inbound Notes / Request Details</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Submitted inquiry asking for pulse diagnosis slots this weekend."
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
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
