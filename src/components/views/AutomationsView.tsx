import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import {
  Zap,
  Plus,
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  X,
  Trash2,
  RotateCcw,
  Activity,
  ArrowRight,
  ShieldCheck,
  Send,
  Calendar,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';
import { Automation } from '../../types/database';
import { AutomationTriggerEvent } from '../../lib/automation-engine';

export const AutomationsView: React.FC = () => {
  const {
    business,
    automations,
    toggleAutomation,
    addAutomation,
    deleteAutomation,
    resetAutomationTemplates,
    triggerAutomationEvent,
    automationLogs,
    showToast,
  } = useBusinessStore();

  const [activeTab, setActiveTab] = useState<'rules' | 'logs' | 'simulator'>('rules');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  // Modal form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<Automation['trigger_type']>('new_lead');
  const [actionType, setActionType] = useState<Automation['action_type']>('send_whatsapp');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [minScore, setMinScore] = useState(60);

  // Simulator state
  const [simTriggerType, setSimTriggerType] = useState<AutomationTriggerEvent['type']>('new_lead');
  const [simPayload, setSimPayload] = useState(
    JSON.stringify(
      {
        lead_name: 'Priya Sharma',
        lead_phone: '+91 98765 43210',
        score: 78,
        inquiry_service: 'Consultation & Treatment Plan',
      },
      null,
      2
    )
  );
  const [simResults, setSimResults] = useState<any[] | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addAutomation({
      name: name.trim(),
      trigger_type: triggerType,
      action_type: actionType,
      conditions: { min_score: minScore },
      requires_approval: requiresApproval,
      is_active: true,
      execution_count: 0,
      last_run: null,
    });

    setIsAddModalOpen(false);
    setName('');
    setMinScore(60);
    setRequiresApproval(false);
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimResults(null);
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(simPayload);
      } catch {
        showToast('error', 'Invalid JSON', 'Simulation payload must be valid JSON');
        setIsSimulating(false);
        return;
      }

      const results = await triggerAutomationEvent({
        type: simTriggerType,
        businessId: business.id,
        timestamp: new Date().toISOString(),
        payload: parsedPayload,
      });

      setSimResults(results);
    } catch (err: any) {
      showToast('error', 'Simulation Error', err.message || 'Failed to simulate event');
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePresetSimulation = (type: AutomationTriggerEvent['type']) => {
    setSimTriggerType(type);
    if (type === 'new_lead') {
      setSimPayload(
        JSON.stringify(
          {
            lead_name: 'Rohan Verma',
            lead_phone: '+91 98111 22334',
            score: 82,
            inquiry_service: 'Premium Herbal Package',
          },
          null,
          2
        )
      );
    } else if (type === 'booking_reminder') {
      setSimPayload(
        JSON.stringify(
          {
            customer_name: 'Anjali Gupta',
            service_name: 'Ayurvedic Consultation',
            scheduled_time: new Date(Date.now() + 86400000).toLocaleString(),
          },
          null,
          2
        )
      );
    } else if (type === 'replenishment_due') {
      setSimPayload(
        JSON.stringify(
          {
            customer_name: 'Vikram Singh',
            product_name: 'Digestive Detox Herbal Tea',
            days_since_last_order: 48,
          },
          null,
          2
        )
      );
    } else if (type === 'abandoned_lead') {
      setSimPayload(
        JSON.stringify(
          {
            lead_name: 'Meera Patel',
            lead_phone: '+91 98123 45678',
            abandoned_items: ['Immunity Booster Kadha', 'Triphala Tablets'],
            abandoned_value: 1250,
          },
          null,
          2
        )
      );
    } else if (type === 'churn_risk_detected') {
      setSimPayload(
        JSON.stringify(
          {
            customer_name: 'Suresh Menon',
            days_inactive: 65,
            lifetime_orders: 4,
          },
          null,
          2
        )
      );
    }
  };

  const filteredAutomations = automations.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.trigger_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.action_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            Automation Engine & Trigger Rules
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time event triggers for speed-to-lead follow-ups, appointment reminders, and automated customer retention
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={resetAutomationTemplates}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load Default Workflows</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Automation Rule</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Active Rules ({automations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Execution Audit Trail ({automationLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Event Trigger Simulator</span>
          </button>
        </div>

        {activeTab === 'rules' && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search rules or triggers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <>
          {filteredAutomations.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-80" />
              <div className="font-semibold text-slate-300">No automation rules match your filter.</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Click "Load Default Workflows" above to install verified high-converting templates.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAutomations.map((rule) => (
                <div
                  key={rule.id}
                  className={`bg-slate-900 border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between space-y-4 ${
                    rule.is_active ? 'border-slate-800' : 'border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold uppercase">
                        {rule.trigger_type.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleAutomation(rule.id)}
                          className="text-slate-400 hover:text-white transition-colors"
                          title={rule.is_active ? 'Pause automation' : 'Activate automation'}
                        >
                          {rule.is_active ? (
                            <ToggleRight className="w-7 h-7 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-7 h-7 text-slate-500" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteAutomation(rule.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete automation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-slate-100">{rule.name}</h3>
                      <div className="text-xs text-slate-400 mt-1.5 flex flex-wrap items-center gap-2">
                        <span>
                          Action: <strong className="text-slate-200 capitalize">{rule.action_type.replace(/_/g, ' ')}</strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[11px]">
                          {rule.requires_approval ? (
                            <>
                              <ShieldCheck className="w-3 h-3 text-amber-400" />
                              <span className="text-amber-400">HITL Approval</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Instant Execution</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <div className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{rule.execution_count || 0} runs</span>
                    </div>

                    <button
                      onClick={() => {
                        handlePresetSimulation(rule.trigger_type as any);
                        setActiveTab('simulator');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>Simulate Trigger</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Execution Audit Trail Tab */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Event Execution & Governance Logs
            </h3>
            <span className="text-xs text-slate-400">Chronological history of evaluated automation events</span>
          </div>

          {automationLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No executions logged yet. Use the Simulator tab to dispatch a test trigger event.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {automationLogs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs hover:bg-slate-800/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{log.automation_name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          log.status === 'EXECUTED'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : log.status === 'PROPOSED_FOR_APPROVAL'
                            ? 'bg-amber-950 text-amber-400 border-amber-800'
                            : log.status === 'FAILED'
                            ? 'bg-rose-950 text-rose-400 border-rose-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] flex items-center gap-2">
                      <span>Trigger: <strong>{log.trigger_type}</strong></span>
                      <span>•</span>
                      <span>Action: <strong>{log.action_type}</strong></span>
                      {log.reason && (
                        <>
                          <span>•</span>
                          <span>{log.reason}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 shrink-0 font-mono">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event Trigger Simulator Tab */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                Dispatch Test Event
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Simulate inbound real-world triggers to verify active automation conditions and Human-in-the-Loop gating.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Preset Scenarios</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handlePresetSimulation('new_lead')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      simTriggerType === 'new_lead' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    New Lead Inbound
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSimulation('booking_reminder')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      simTriggerType === 'booking_reminder' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Booking 24h Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSimulation('replenishment_due')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      simTriggerType === 'replenishment_due' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    45d Refill Due
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSimulation('abandoned_lead')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      simTriggerType === 'abandoned_lead' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Abandoned Lead
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSimulation('churn_risk_detected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      simTriggerType === 'churn_risk_detected' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Churn Risk
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Event Payload (JSON)</label>
                <textarea
                  rows={8}
                  value={simPayload}
                  onChange={(e) => setSimPayload(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-colors"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isSimulating ? 'Evaluating Rules...' : 'Fire Event Through Engine'}</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Evaluation Results
            </h3>

            {!simResults ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                Fire an event using the simulator on the left to see rule evaluations and resulting actions here.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Evaluated {automations.length} total active automation rules:
                </div>

                {simResults.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                    No active automation rules matched the event type "{simTriggerType}".
                  </div>
                ) : (
                  simResults.map((res, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border text-xs space-y-2 ${
                        res.status === 'EXECUTED'
                          ? 'bg-emerald-950/40 border-emerald-800/60'
                          : res.status === 'PROPOSED_FOR_APPROVAL'
                          ? 'bg-amber-950/40 border-amber-800/60'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{res.ruleName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            res.status === 'EXECUTED'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : res.status === 'PROPOSED_FOR_APPROVAL'
                              ? 'bg-amber-950 text-amber-400 border-amber-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {res.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300">
                        {res.executionLog?.reason || 'Evaluation completed'}
                      </div>

                      {res.generatedAction && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                          <div className="font-semibold text-indigo-300">Generated Action:</div>
                          <div>{res.generatedAction.action_type} &bull; {res.generatedAction.description}</div>
                          <div className="text-slate-400">Target: {res.generatedAction.target_entity_id}</div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Rule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base">Create Automation Rule</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 45-Day Herbal Refill WhatsApp Prompt"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Trigger Event</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="new_lead">When New Lead Inquires</option>
                  <option value="order_created">When Order is Placed</option>
                  <option value="booking_completed">When Booking / Therapy is Completed</option>
                  <option value="replenishment_due">When 45-Day Refill is Due</option>
                  <option value="churn_risk_detected">When Customer is Inactive &gt;60 Days</option>
                  <option value="booking_reminder">When Booking Reminder is Scheduled</option>
                  <option value="abandoned_lead">When Lead Abandons Checkout / Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Execution Action</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="send_whatsapp">Send WhatsApp Message Template</option>
                  <option value="create_task">Create Staff Task in CRM</option>
                  <option value="alert_owner">Send Alert Notification to Founder</option>
                  <option value="send_email">Send Email Follow-Up</option>
                  <option value="update_crm">Update CRM Status</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Minimum Lead Score Condition (Optional)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reqApp"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="reqApp" className="text-slate-300 font-medium">
                  Require human approval before sending message (HITL)
                </label>
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
                  Activate Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
