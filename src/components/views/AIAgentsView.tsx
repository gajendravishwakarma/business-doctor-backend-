import React, { useState, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Bot,
  Sparkles,
  TrendingUp,
  Package,
  Users,
  Calendar,
  Search,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Check,
  ShieldCheck,
  Zap,
  ArrowRight,
  Filter,
  Copy,
  AlertTriangle,
  Loader2,
  HelpCircle,
  BarChart3,
  RefreshCw,
  PhoneCall,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Database,
  Sliders,
  CheckSquare,
  Layers,
  FileText,
  Send,
  Sparkle,
} from 'lucide-react';
import { AgentActionItem, AgentId, AGENT_REGISTRY, SupportInquiryResponse, BIQueryResponse, ToolExecutionResult } from '../../types/agents';
import {
  generateGroundedAgentActions,
  answerCustomerSupportInquiry,
  answerBusinessIntelligenceQuery,
} from '../../lib/agents-engine';
import { AgentAction } from '../../types/database';
import { TOOL_DEFINITIONS } from '../../lib/agent-tool-registry';

export const AIAgentsView: React.FC = () => {
  const {
    business,
    metrics,
    customers,
    leads,
    products,
    services,
    orders,
    bookings,
    expenses,
    memory,
    agentActions,
    approveAgentAction,
    rejectAgentAction,
    failAgentAction,
    triggerNewAgentAction,
    runAgentExecutionLoop,
    isAgentLoopRunning,
    executingActionIds,
    executeAgentTool,
    showToast,
  } = useBusinessStore();

  const [activeViewMode, setActiveViewMode] = useState<'action_center' | 'agent_benches' | 'history' | 'tool_registry'>('action_center');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [isTriggering, setIsTriggering] = useState<string | null>(null);
  const [selectedActionForEvidence, setSelectedActionForEvidence] = useState<AgentAction | null>(null);

  // Tool Registry State
  const [selectedToolId, setSelectedToolId] = useState<string>('crm_search_leads');
  const [toolParamsInput, setToolParamsInput] = useState<string>(
    JSON.stringify({ query: 'Priya', status: 'new' }, null, 2)
  );
  const [toolExecutionResult, setToolExecutionResult] = useState<ToolExecutionResult | null>(null);
  const [isExecutingTool, setIsExecutingTool] = useState<boolean>(false);

  // Interactive Test Benches State
  const [activeBench, setActiveBench] = useState<AgentId>('customer_support');
  
  // Customer Support Simulator
  const [supportQuestion, setSupportQuestion] = useState<string>('What services do you offer and what are the consultation fees?');
  const [supportResponse, setSupportResponse] = useState<SupportInquiryResponse | null>(null);
  const [isAnsweringSupport, setIsAnsweringSupport] = useState<boolean>(false);

  // Business Intelligence Console
  const [biQuery, setBiQuery] = useState<string>('Which products have the highest sales volume and what is our current stock status?');
  const [biResponse, setBiResponse] = useState<BIQueryResponse | null>(null);
  const [isQueryingBI, setIsQueryingBI] = useState<boolean>(false);

  // Operational signals grounded in real data
  const hotLeadsCount = leads.filter((l) => (l.score || 0) >= 70 && l.status !== 'lost' && l.status !== 'converted').length;
  const dormantCustomersCount = customers.filter((c) => {
    if (!c.last_activity) return true;
    const diffDays = Math.floor((Date.now() - new Date(c.last_activity).getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 45;
  }).length;
  const lowStockCount = products.filter((p) => p.stock_quantity <= 15).length;
  const upcomingBookingsCount = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length;

  const agentSignalMap: Record<AgentId, string> = {
    lead_follow_up: `${hotLeadsCount} active qualified leads`,
    lead_followup: `${hotLeadsCount} active qualified leads`,
    customer_support: `${services.length} services & ${products.length} products verified`,
    business_assistant: `${services.length} services & ${products.length} products verified`,
    sales_conversion: `${leads.filter((l) => (l.score || 0) >= 80).length} high-intent conversion prospects`,
    sales: `${leads.filter((l) => (l.score || 0) >= 80).length} high-intent conversion prospects`,
    booking: `${upcomingBookingsCount} booked appointments tracked`,
    customer_reactivation: `${dormantCustomersCount} customers inactive >45 days`,
    customer_retention: `${dormantCustomersCount} customers inactive >45 days`,
    product_service_recommendation: `${products.length} catalog items for cross-selling`,
    marketing: `${products.length} catalog items for cross-selling`,
    business_intelligence: `${orders.length} orders & ${expenses.length} expense logs in memory`,
    business_analyst: `${orders.length} orders & ${expenses.length} expense logs in memory`,
  };

  const agentIconMap: Record<AgentId, any> = {
    lead_follow_up: TrendingUp,
    lead_followup: TrendingUp,
    customer_support: MessageSquare,
    business_assistant: MessageSquare,
    sales_conversion: Zap,
    sales: Zap,
    booking: Calendar,
    customer_reactivation: Users,
    customer_retention: Users,
    product_service_recommendation: ShoppingBag,
    marketing: ShoppingBag,
    business_intelligence: BarChart3,
    business_analyst: BarChart3,
  };

  const agentColorMap: Record<AgentId, string> = {
    lead_follow_up: 'from-blue-600 to-indigo-700 text-blue-400 bg-blue-950/60 border-blue-800',
    lead_followup: 'from-blue-600 to-indigo-700 text-blue-400 bg-blue-950/60 border-blue-800',
    customer_support: 'from-emerald-600 to-teal-700 text-emerald-400 bg-emerald-950/60 border-emerald-800',
    business_assistant: 'from-emerald-600 to-teal-700 text-emerald-400 bg-emerald-950/60 border-emerald-800',
    sales_conversion: 'from-amber-600 to-orange-700 text-amber-400 bg-amber-950/60 border-amber-800',
    sales: 'from-amber-600 to-orange-700 text-amber-400 bg-amber-950/60 border-amber-800',
    booking: 'from-purple-600 to-indigo-800 text-purple-400 bg-purple-950/60 border-purple-800',
    customer_reactivation: 'from-rose-600 to-pink-700 text-rose-400 bg-rose-950/60 border-rose-800',
    customer_retention: 'from-rose-600 to-pink-700 text-rose-400 bg-rose-950/60 border-rose-800',
    product_service_recommendation: 'from-cyan-600 to-blue-700 text-cyan-400 bg-cyan-950/60 border-cyan-800',
    marketing: 'from-cyan-600 to-blue-700 text-cyan-400 bg-cyan-950/60 border-cyan-800',
    business_intelligence: 'from-violet-600 to-purple-800 text-violet-400 bg-violet-950/60 border-violet-800',
    business_analyst: 'from-violet-600 to-purple-800 text-violet-400 bg-violet-950/60 border-violet-800',
  };

  // Group actions
  const pendingActions = useMemo(() => {
    return agentActions.filter((a) => a.status === 'PROPOSED' || a.status === 'pending_approval');
  }, [agentActions]);

  const historyActions = useMemo(() => {
    return agentActions.filter((a) => a.status !== 'PROPOSED' && a.status !== 'pending_approval');
  }, [agentActions]);

  // Filtered pending actions
  const filteredPendingActions = useMemo(() => {
    return pendingActions.filter((act) => {
      if (selectedAgentFilter !== 'all') {
        const filterLower = (selectedAgentFilter || '').toLowerCase();
        const matchesAgentId = act.agent_id === selectedAgentFilter;
        const matchesAgentName = (act.agent_name || '').toLowerCase().includes(filterLower);
        if (!matchesAgentId && !matchesAgentName) return false;
      }
      return true;
    });
  }, [pendingActions, selectedAgentFilter]);

  // Filtered history actions
  const filteredHistoryActions = useMemo(() => {
    return historyActions.filter((act) => {
      if (selectedStatusFilter !== 'all') {
        if ((act.status || '').toUpperCase() !== selectedStatusFilter.toUpperCase()) return false;
      }
      if (selectedAgentFilter !== 'all') {
        const filterLower = (selectedAgentFilter || '').toLowerCase();
        const matchesAgentId = act.agent_id === selectedAgentFilter;
        const matchesAgentName = (act.agent_name || '').toLowerCase().includes(filterLower);
        if (!matchesAgentId && !matchesAgentName) return false;
      }
      return true;
    });
  }, [historyActions, selectedStatusFilter, selectedAgentFilter]);

  const handleTriggerSingle = async (agentId: AgentId) => {
    setIsTriggering(agentId);
    await triggerNewAgentAction(agentId);
    setIsTriggering(null);
  };

  const handleCopyPayload = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('success', 'Copied to clipboard', 'Message payload ready to paste');
  };

  const handleRunSupportSimulator = () => {
    if (!supportQuestion.trim()) return;
    setIsAnsweringSupport(true);
    setTimeout(() => {
      const resp = answerCustomerSupportInquiry(supportQuestion, {
        business,
        metrics,
        customers,
        leads,
        products,
        services,
        orders,
        bookings,
        expenses,
        memory,
      });
      setSupportResponse(resp);
      setIsAnsweringSupport(false);
    }, 250);
  };

  const handleRunBIQuery = () => {
    if (!biQuery.trim()) return;
    setIsQueryingBI(true);
    setTimeout(() => {
      const resp = answerBusinessIntelligenceQuery(biQuery, {
        business,
        metrics,
        customers,
        leads,
        products,
        services,
        orders,
        bookings,
        expenses,
        memory,
      });
      setBiResponse(resp);
      setIsQueryingBI(false);
    }, 250);
  };

  const handleSelectTool = (toolId: string) => {
    setSelectedToolId(toolId);
    setToolExecutionResult(null);
    const def = TOOL_DEFINITIONS.find((t) => t.id === toolId);
    if (def && Array.isArray(def.parameters)) {
      const sample: Record<string, any> = {};
      def.parameters.forEach((param) => {
        if (param.name === 'businessId') sample[param.name] = business.id;
        else if (param.name === 'query') sample[param.name] = 'Ayurvedic';
        else if (param.name === 'status') sample[param.name] = 'new';
        else if (param.name === 'limit') sample[param.name] = 10;
        else if (param.name === 'action_type') sample[param.name] = 'send_whatsapp';
        else if (param.name === 'agent_id') sample[param.name] = 'lead_followup';
        else if (param.name === 'reason') sample[param.name] = 'Grounded follow-up based on inquiry';
        else if (param.type === 'string') sample[param.name] = 'Sample Value';
        else if (param.type === 'number') sample[param.name] = 1;
        else if (param.type === 'boolean') sample[param.name] = false;
        else if (param.type === 'array') sample[param.name] = [];
        else sample[param.name] = {};
      });
      setToolParamsInput(JSON.stringify(sample, null, 2));
    }
  };

  const handleRunToolExecution = async () => {
    setIsExecutingTool(true);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(toolParamsInput);
      } catch {
        showToast('error', 'Invalid Parameters', 'Parameters must be valid JSON');
        setIsExecutingTool(false);
        return;
      }
      const res = await executeAgentTool(selectedToolId, parsed);
      setToolExecutionResult(res);
      if (res.success) {
        showToast('success', 'Tool Executed', `Tool "${selectedToolId}" completed successfully.`);
      } else {
        showToast('error', 'Execution Denied / Failed', res.error || 'Tool execution encountered an error.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Execution failed');
    } finally {
      setIsExecutingTool(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Autonomous Execution Loop Controller */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              AI Agent Operating Engine
            </span>
            <span className="text-xs text-slate-400">
              7 Autonomous Operating Agents Grounded in Scoped Business Data
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Autonomous Business Agent Control Center
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Continuously reasons over verified leads, customers, bookings, catalog, and expenses for <strong>{business.name}</strong>. Proposes high-confidence business actions subject to mandatory human approval.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <button
            onClick={runAgentExecutionLoop}
            disabled={isAgentLoopRunning}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-amber-300 ${isAgentLoopRunning ? 'animate-spin' : 'animate-pulse'}`} />
            <span>{isAgentLoopRunning ? 'Evaluating All 7 Agents...' : 'Run Full Agent Audit'}</span>
          </button>
        </div>
      </div>

      {/* Safety & Multi-Tenant Governance Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">Human-in-the-Loop Safe Mode</div>
            <div className="text-[11px] text-slate-400">No communication or mutation runs without owner approval</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/70 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">Multi-Tenant Scoped</div>
            <div className="text-[11px] text-slate-400">Strictly isolated to business_id ({business.id})</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-950/70 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">Business Memory Ledger</div>
            <div className="text-[11px] text-slate-400">Records recommendations, approvals, and executions</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">Zero Hallucination Guard</div>
            <div className="text-[11px] text-slate-400">Uses verified database records only</div>
          </div>
        </div>
      </div>

      {/* 7 Operating Agents Overview Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            7 Grounded Operating Agents
          </h2>
          <span className="text-xs text-slate-400">
            All agents grounded in live database tables
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {AGENT_REGISTRY.map((agent) => {
            const Icon = agentIconMap[agent.id] || Bot;
            const agentPendingCount = pendingActions.filter((a) => a.agent_id === agent.id).length;
            const signalText = agentSignalMap[agent.id] || 'Grounded in active workspace data';
            const colorClass = agentColorMap[agent.id] || 'from-slate-700 to-slate-800 text-slate-300 bg-slate-900 border-slate-800';

            return (
              <div
                key={agent.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]} flex items-center justify-center text-white shadow-md`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {agentPendingCount > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold animate-pulse">
                        {agentPendingCount} Proposed
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                        Monitoring
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-xs text-slate-100">{agent.name}</h3>
                    <div className="text-[11px] text-indigo-400 font-medium mt-0.5">{agent.role}</div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{agent.description}</p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {agent.inputs.map((inp) => (
                      <span key={inp} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 font-mono">
                        {inp}
                      </span>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-300 font-medium flex items-center gap-1.5 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span className="truncate">{signalText}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => handleTriggerSingle(agent.id)}
                    disabled={isTriggering === agent.id || isAgentLoopRunning}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 border border-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>{isTriggering === agent.id ? 'Evaluating...' : 'Scan & Propose'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveBench(agent.id);
                      setActiveViewMode('agent_benches');
                    }}
                    className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
                    title="Open Interactive Bench"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Section Navigation: Action Center vs Interactive Agent Benches vs Audit History */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveViewMode('action_center')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeViewMode === 'action_center'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Agent Action Center ({pendingActions.length})</span>
            </button>
            <button
              onClick={() => setActiveViewMode('agent_benches')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeViewMode === 'agent_benches'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Interactive Agent Benches</span>
            </button>
            <button
              onClick={() => setActiveViewMode('history')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeViewMode === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Governance & Memory Ledger ({historyActions.length})</span>
            </button>
            <button
              onClick={() => setActiveViewMode('tool_registry')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeViewMode === 'tool_registry'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Tool Registry & Execution ({TOOL_DEFINITIONS.length})</span>
            </button>
          </div>

          {/* Filters */}
          {activeViewMode === 'action_center' && (
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Filter Agent:</span>
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All 7 Agents</option>
                <option value="lead_followup">Lead Follow-Up</option>
                <option value="customer_support">Customer Support</option>
                <option value="sales_conversion">Sales / Conversion</option>
                <option value="booking">Booking Agent</option>
                <option value="customer_reactivation">Customer Re-Activation</option>
                <option value="product_service_recommendation">Product / Service Recommendation</option>
                <option value="business_intelligence">Business Intelligence</option>
              </select>
            </div>
          )}

          {activeViewMode === 'history' && (
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Status:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="EXECUTED">EXECUTED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          )}
        </div>

        {/* VIEW MODE 1: AGENT ACTION CENTER */}
        {activeViewMode === 'action_center' && (
          <div className="space-y-4">
            {filteredPendingActions.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
                <h3 className="font-bold text-sm text-slate-200">No actions pending approval</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  All proposed operational tasks have been executed, rejected, or verified. Click <strong>"Run Full Agent Audit"</strong> or trigger an individual agent to formulate new verified proposals.
                </p>
                <button
                  onClick={runAgentExecutionLoop}
                  disabled={isAgentLoopRunning}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAgentLoopRunning ? 'animate-spin' : ''}`} />
                  <span>Scan Verified Database</span>
                </button>
              </div>
            ) : (
              filteredPendingActions.map((act) => (
                <div
                  key={act.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-800/60 shadow-sm flex flex-col lg:flex-row items-start justify-between gap-5 transition-all"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold uppercase">
                        {act.agent_name}
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          act.impact_level === 'high'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : act.impact_level === 'medium'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {act.impact_level} Impact
                      </span>

                      <span className="text-[10px] text-emerald-400 font-bold font-mono">
                        {act.confidence}% Confidence
                      </span>

                      <span className="text-[10px] text-slate-400">
                        Target: <strong className="text-slate-200">{act.target_entity}</strong>
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-slate-100">{act.action_type}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{act.reasoning}</p>

                    {/* Grounded Evidence List */}
                    {act.evidence && act.evidence.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Grounded Evidence & Source Signals:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {act.evidence.map((ev, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800 font-mono"
                            >
                              • {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Execution Payload Box */}
                    {((act.proposed_payload && Object.keys(act.proposed_payload).length > 0) || act.suggested_message) && (
                      <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            Proposed Dispatch Payload ({act.proposed_payload?.channel || 'Direct Communication'}):
                          </span>
                          {(act.suggested_message || act.proposed_payload?.message) && (
                            <button
                              onClick={() => handleCopyPayload(act.suggested_message || act.proposed_payload?.message)}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy Draft</span>
                            </button>
                          )}
                        </div>

                        <div className="font-mono text-[11px] text-indigo-200 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 leading-relaxed whitespace-pre-wrap">
                          {act.suggested_message || act.proposed_payload?.message || JSON.stringify(act.proposed_payload, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions & Decision buttons */}
                  <div className="w-full lg:w-48 shrink-0 flex flex-col justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="text-[11px] text-slate-400">
                      <div className="font-semibold text-slate-300">Human Approval Required</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Proposed {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => approveAgentAction(act.id)}
                        disabled={executingActionIds.includes(act.id)}
                        className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-70 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {executingActionIds.includes(act.id) ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Dispatching...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Run</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => rejectAgentAction(act.id)}
                        disabled={executingActionIds.includes(act.id)}
                        className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => setSelectedActionForEvidence(act)}
                        className="w-full py-1 px-2 rounded-lg text-[10px] text-slate-400 hover:text-indigo-300 hover:bg-slate-800/40 flex items-center justify-center gap-1"
                      >
                        <Search className="w-3 h-3" />
                        <span>Inspect Evidence</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VIEW MODE 2: INTERACTIVE AGENT BENCHES */}
        {activeViewMode === 'agent_benches' && (
          <div className="space-y-4">
            {/* Bench Selector Tabs */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-800">
              {AGENT_REGISTRY.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setActiveBench(agent.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeBench === agent.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {agent.name}
                </button>
              ))}
            </div>

            {/* BENCH 1: Customer Support Agent */}
            {activeBench === 'customer_support' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-base text-slate-100">Customer Support Agent Q&A Simulator</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Test how the Customer Support Agent answers customer inquiries using exclusively verified business information (operating hours, catalog pricing, service durations, and policies).
                  </p>
                </div>

                {/* Sample Prompt Chips */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Quick Test Questions:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'What are your consultation timings and address?',
                      'How much does a Prakriti Pulse Diagnosis session cost?',
                      'Do you sell Triphala or herbal products?',
                      'What is your cancellation and refund policy?',
                      'Do you offer neurosurgery or general anesthesia?',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setSupportQuestion(q);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-300 hover:bg-slate-700 border border-slate-700 text-left transition-colors cursor-pointer"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={supportQuestion}
                      onChange={(e) => setSupportQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunSupportSimulator()}
                      placeholder="Type a customer question..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                    />
                    <button
                      onClick={handleRunSupportSimulator}
                      disabled={isAnsweringSupport || !supportQuestion.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isAnsweringSupport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Evaluate</span>
                    </button>
                  </div>
                </div>

                {/* Response Display */}
                {supportResponse && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold uppercase">
                          Grounded Answer
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">
                          {supportResponse.confidence}% Confidence
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyPayload(supportResponse.answer)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Answer</span>
                      </button>
                    </div>

                    <div className="text-xs text-slate-200 font-sans leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      {supportResponse.answer}
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400">Verified Evidence Sources:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {supportResponse.evidence.map((ev, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            ✓ {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BENCH 2: Business Intelligence Agent */}
            {activeBench === 'business_intelligence' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-violet-400" />
                    <h3 className="font-bold text-base text-slate-100">Business Intelligence Analyst Console</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Query the BI Agent on revenue trends, customer dormancy, inventory velocity, and Day-0 memory baseline progression.
                  </p>
                </div>

                {/* Sample BI Queries */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Pre-Configured Analytical Queries:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Which products are selling and what is current stock?',
                      'Which customers are inactive over 45 days?',
                      'What is our total revenue and monthly burn rate?',
                      'What key operational changes occurred since Day-0 baseline?',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setBiQuery(q);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-violet-300 hover:bg-slate-700 border border-slate-700 text-left transition-colors cursor-pointer"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={biQuery}
                      onChange={(e) => setBiQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunBIQuery()}
                      placeholder="Ask any analytical business question..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-medium"
                    />
                    <button
                      onClick={handleRunBIQuery}
                      disabled={isQueryingBI || !biQuery.trim()}
                      className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isQueryingBI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
                      <span>Compute</span>
                    </button>
                  </div>
                </div>

                {/* BI Response Display */}
                {biResponse && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800 font-bold uppercase">
                          Mathematical BI Proof
                        </span>
                        <span className="text-[10px] text-violet-400 font-mono font-bold">
                          {biResponse.confidence}% Confidence
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Grounded in {orders.length} orders & {expenses.length} expense rows
                      </span>
                    </div>

                    <div className="text-xs text-slate-200 font-sans leading-relaxed bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                      {biResponse.answer}
                    </div>

                    {biResponse.data_points && biResponse.data_points.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400">Verified Data Points & Calculations:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {biResponse.data_points.map((dp, i) => (
                            <div key={i} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                              • {dp}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* BENCH 3: Lead Follow-Up Bench */}
            {activeBench === 'lead_followup' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                      Lead Follow-Up Agent Workspace
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Identifies verified leads with intent score ≥60 and generates WhatsApp / direct follow-up proposals.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTriggerSingle('lead_followup')}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Lead Scanner</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Verified Inbound Leads Queue ({leads.length} leads in database):</div>
                  {leads.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                      No leads recorded in workspace database.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {leads.map((l) => (
                        <div key={l.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200">{l.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                              Score: {l.score}/100
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Phone: {l.phone || 'N/A'} • Status: <strong className="text-slate-300">{l.status}</strong> • Source: {l.source}
                          </div>
                          {l.interested_in && (
                            <div className="text-[11px] text-indigo-300 bg-slate-900 p-2 rounded border border-slate-800/80">
                              Interest: {l.interested_in}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BENCH 4: Sales / Conversion Agent */}
            {activeBench === 'sales_conversion' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      Sales / Conversion Agent Workspace
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Identifies high-value conversion opportunities and VIP upsell packages grounded in verified customer transaction histories.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTriggerSingle('sales_conversion')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Conversion Scan</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400">VIP & High-LTV Accounts</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      {customers.filter((c) => c.status === 'vip' || (c.total_spend || 0) > 3000).length}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Avg Customer Value</div>
                    <div className="text-lg font-bold text-slate-200 mt-1">
                      {business.currency_symbol || '₹'}{metrics.avgOrderValue ? Math.round(metrics.avgOrderValue).toLocaleString() : '0'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Hot Inbound Conversion Queue</div>
                    <div className="text-lg font-bold text-indigo-400 mt-1">
                      {leads.filter((l) => (l.score || 0) >= 80).length} leads
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BENCH 5: Booking Agent */}
            {activeBench === 'booking' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-400" />
                      Booking & Slot Utilization Agent
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Checks calendar capacity, drafts appointment reminders, and handles schedule availability.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTriggerSingle('booking')}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Schedule Scan</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Live Scheduled Bookings ({bookings.length}):</div>
                  {bookings.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                      No active bookings in workspace.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bookings.map((b) => (
                        <div key={b.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200">{b.service_name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                              {b.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Customer: {b.customer_name} • Date: {b.booking_date} at {b.start_time}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Amount: {business.currency_symbol || '₹'}{b.amount} • Payment: {b.payment_status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BENCH 6: Customer Re-Activation Agent */}
            {activeBench === 'customer_reactivation' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                      <Users className="w-5 h-5 text-rose-400" />
                      Customer Re-Activation Agent Workspace
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Monitors repeat consumption cycles and drafts custom win-back messages for inactive customers.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTriggerSingle('customer_reactivation')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Dormancy Scan</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Dormant & At-Risk Customer Segments:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customers
                      .filter((c) => {
                        if (!c.last_activity) return true;
                        const diffDays = Math.floor((Date.now() - new Date(c.last_activity).getTime()) / (1000 * 60 * 60 * 24));
                        return diffDays >= 30;
                      })
                      .map((c) => (
                        <div key={c.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200">{c.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                              Inactive
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Total Spend: {business.currency_symbol || '₹'}{c.total_spend} • Orders: {c.total_orders}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Last Active: {c.last_activity || 'Unknown'} • Phone: {c.phone}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* BENCH 7: Product / Service Recommendation Agent */}
            {activeBench === 'product_service_recommendation' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-cyan-400" />
                      Product & Service Recommendation Engine
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Matches verified customer preferences and previous purchase history with catalog offerings for personalized cross-selling.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTriggerSingle('product_service_recommendation')}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Catalog Matcher</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Active Verified Catalog Items ({products.length} products, {services.length} services):</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {products.slice(0, 4).map((p) => (
                      <div key={p.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{p.name}</span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {business.currency_symbol || '₹'}{p.price}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Category: {p.category} • In Stock: {p.stock_quantity} units
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE 3: GOVERNANCE & MEMORY LEDGER */}
        {activeViewMode === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-200">
                Action Execution History & Business Memory Ledger
              </h3>
              <span className="text-xs text-slate-400">
                Permanent audit trail of all owner decisions
              </span>
            </div>

            {filteredHistoryActions.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-400">
                No history actions matching current filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistoryActions.map((act) => {
                  const isExecuted = act.status === 'EXECUTED' || act.status === 'executed';
                  const isRejected = act.status === 'REJECTED' || act.status === 'rejected';
                  const isFailed = act.status === 'FAILED' || act.status === 'failed';

                  return (
                    <div
                      key={act.id}
                      className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              isExecuted
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : isRejected
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : isFailed
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {act.status.toUpperCase()}
                          </span>

                          <span className="font-bold text-slate-200 text-sm">{act.action_type}</span>
                          <span className="text-[11px] text-indigo-300">({act.agent_name})</span>
                        </div>

                        <div className="text-slate-300 text-xs">{act.reasoning}</div>

                        <div className="text-[11px] text-slate-400">
                          Target: <strong className="text-slate-200">{act.target_entity}</strong>
                          {act.failure_reason && (
                            <span className="text-rose-400 ml-2 font-mono">Error: {act.failure_reason}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 shrink-0 space-y-1">
                        <div>
                          {act.executed_at
                            ? `Executed at ${new Date(act.executed_at).toLocaleTimeString()}`
                            : isRejected
                            ? 'Dismissed by Owner'
                            : 'Logged in Memory'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {act.id.slice(0, 16)}...
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tool Registry & Execution Explorer */}
        {activeViewMode === 'tool_registry' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Deterministic Agent Tool Registry ({TOOL_DEFINITIONS.length} Verified Tools)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect agent tool schemas, RBAC requirements, consequential flags, and test executions with tenant boundary isolation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Tools Directory */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-2">Available Agent Tools</div>
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                  {TOOL_DEFINITIONS.map((tool) => {
                    const isSelected = selectedToolId === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleSelectTool(tool.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-600 text-white'
                            : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold">{tool.id}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-400">
                            {tool.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">{tool.description}</p>
                        <div className="flex items-center gap-2 text-[10px] pt-1">
                          <span className="text-indigo-400 font-semibold">Role: {tool.requiredRole || 'staff'}</span>
                          {tool.isConsequential && (
                            <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              Consequential
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Tool Details & Test Runner */}
              <div className="lg:col-span-2 space-y-6">
                {(() => {
                  const activeTool = TOOL_DEFINITIONS.find((t) => t.id === selectedToolId);
                  if (!activeTool) return null;

                  return (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-base text-slate-100">{activeTool.id}</span>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                              {activeTool.category}
                            </span>
                            {activeTool.isConsequential ? (
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                HITL Governed
                              </span>
                            ) : (
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Read / Safe
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 mt-1.5">{activeTool.description}</p>
                        </div>
                      </div>

                      {/* Required Parameters Specification */}
                      <div>
                        <div className="text-xs font-semibold text-slate-300 mb-2">Required Parameters & Schema:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          {(activeTool.parameters || []).map((paramDef) => {
                            return (
                              <div key={paramDef.name} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-indigo-300">{paramDef.name}</span>
                                  <span className="text-[10px] text-slate-500">
                                    {paramDef.type} {paramDef.required ? '(required)' : '(optional)'}
                                  </span>
                                </div>
                                <div className="text-slate-400 font-sans mt-0.5 text-[10px]">{paramDef.description}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Live Parameter Editor */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                          <span>Execution Parameters (JSON):</span>
                          <span className="text-slate-500 text-[11px] font-mono">Tenant ID: {business.id}</span>
                        </div>
                        <textarea
                          rows={6}
                          value={toolParamsInput}
                          onChange={(e) => setToolParamsInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <button
                        onClick={handleRunToolExecution}
                        disabled={isExecutingTool}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-colors"
                      >
                        {isExecutingTool ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Executing Tool via Policy Guard...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-white" />
                            <span>Run Tool Safely</span>
                          </>
                        )}
                      </button>

                      {/* Output Section */}
                      {toolExecutionResult && (
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">Execution Result:</span>
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                toolExecutionResult.success
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {toolExecutionResult.success ? 'Success (200)' : 'Error / Guard Denied'}
                            </span>
                          </div>

                          {toolExecutionResult.error && (
                            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
                              {toolExecutionResult.error}
                            </div>
                          )}

                          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-64">
                            {JSON.stringify(toolExecutionResult.data || toolExecutionResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Evidence Inspection Drawer / Modal */}
      {selectedActionForEvidence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-100">Grounded Evidence Verification</h3>
              </div>
              <button
                onClick={() => setSelectedActionForEvidence(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Agent:</span>{' '}
                <strong className="text-indigo-300">{selectedActionForEvidence.agent_name}</strong>
              </div>

              <div>
                <span className="text-slate-400">Action:</span>{' '}
                <strong className="text-slate-200">{selectedActionForEvidence.action_type}</strong>
              </div>

              <div>
                <span className="text-slate-400">Target Entity:</span>{' '}
                <strong className="text-slate-200">{selectedActionForEvidence.target_entity}</strong>
              </div>

              <div>
                <span className="text-slate-400">Confidence Score:</span>{' '}
                <strong className="text-emerald-400 font-mono">{selectedActionForEvidence.confidence}%</strong>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="font-semibold text-slate-300">Verified Evidence Trail:</div>
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300">
                  {selectedActionForEvidence.evidence && selectedActionForEvidence.evidence.length > 0 ? (
                    selectedActionForEvidence.evidence.map((ev, i) => (
                      <div key={i} className="leading-relaxed">
                        • {ev}
                      </div>
                    ))
                  ) : (
                    <div>• Grounded in verified operational record ID: {selectedActionForEvidence.entity_id || 'System scoped'}</div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-slate-300">Multi-Tenant Scoping:</div>
                <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  Scoped strictly to business_id: <code className="text-indigo-300 font-mono">{business.id}</code>. No cross-tenant access allowed.
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedActionForEvidence(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
