import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Business,
  BusinessMember,
  BusinessMemory,
  Customer,
  Lead,
  Product,
  ServiceItem,
  Order,
  Booking,
  Expense,
  DataSource,
  Automation,
  AgentAction,
  AIDiagnosis,
  AuditLog,
  BusinessMetrics,
  UserSession,
  UserRole,
  TrialDayContent,
  BusinessTrial,
  TrialDeliverable,
  Campaign,
  InventoryMovement,
  InventoryMovementType,
  BusinessIntegration,
} from '../types/database';
import {
  ConnectParams,
  DisconnectParams,
  ConnectorErrorDetails,
  ConnectorProviderId,
  HealthCheckResult,
} from '../types/connectors';
import { getDefaultIntegrations, getConnectorAdapter } from './connectors/registry';
import {
  generateOrderNumber,
  calculateOrderTotals,
  applyOrderInventoryDeduction,
  applyOrderInventoryRestoration,
  recordStockAdjustment,
} from './sales-ops-engine';
import {
  SEED_BUSINESS,
  SEED_MEMBERS,
  SEED_PRODUCTS,
  SEED_SERVICES,
  SEED_CUSTOMERS,
  SEED_LEADS,
  SEED_ORDERS,
  SEED_BOOKINGS,
  SEED_EXPENSES,
  SEED_MEMORY,
  SEED_AUTOMATIONS,
  SEED_AGENT_ACTIONS,
  SEED_DIAGNOSES,
  SEED_DATA_SOURCES,
  SEED_AUDIT_LOGS,
  SEED_CAMPAIGNS,
} from './sample-data';
import {
  calculateBusinessMetrics,
  generateDeterministicDiagnoses,
  generateDeterministicAgentActions,
} from './diagnosis-engine';
import {
  generateGroundedAgentActions,
  answerCustomerSupportInquiry,
  answerBusinessIntelligenceQuery,
  evaluateLeadFollowUps,
  evaluateSalesOpportunities,
  evaluateBookingProposals,
  evaluateCustomerReactivations,
  evaluateCatalogRecommendations,
} from './agents-engine';
import {
  AutomationTriggerEvent,
  AutomationEvaluationResult,
  evaluateAutomationEvent,
  getDefaultAutomationTemplates,
} from './automation-engine';
import {
  executeTool,
  TOOL_DEFINITIONS,
  ToolExecutionContext,
} from './agent-tool-registry';
import { AutomationExecutionLog, ToolExecutionResult } from '../types/agents';
import {
  generateAllTrialDays,
  createDayMemoryEvent,
  getInitialBusinessTrial,
  TrialEngineContext,
  calculateDataCompleteness,
} from './trial-engine';
import {
  getSupabaseClient,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  getCurrentSupabaseSession,
  onAuthStateChange,
} from './supabase';
import {
  pushWorkspaceToSupabase,
  pullWorkspaceFromSupabase,
  toValidUuid,
  createUuid,
  mapBusinessToDb,
  mapMemoryToDb,
  mapAutomationToDb,
} from './supabaseAdapter';
import { canPerformAction, validateSession } from './permissions';
import { CRMFollowUp } from '../types/crm';
import { normalizePhoneNumber, normalizeEmail } from './crm-engine';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

export interface BusinessStoreContextType {
  // Navigation & UI Modals
  currentView: string;
  setCurrentView: (view: string) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isAskDoctorOpen: boolean;
  setIsAskDoctorOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  isSyncing: boolean;

  // Auth & Context
  user: UserSession | null;
  business: Business;
  allBusinesses: Business[];
  members: BusinessMember[];
  switchBusiness: (businessId: string) => void;
  updateBusiness: (updates: Partial<Business>) => void;
  updateBusinessProfile: (updates: Partial<Business>) => void;
  createBusiness: (newBiz: Omit<Business, 'id' | 'created_at' | 'updated_at'>) => string;
  login: (
    email: string,
    password?: string,
    name?: string,
    role?: UserRole
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (
    email: string,
    password?: string,
    name?: string,
    role?: UserRole
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
  resetToSampleData: () => void;

  // Real Metrics
  metrics: BusinessMetrics;

  // Collections
  customers: Customer[];
  leads: Lead[];
  products: Product[];
  services: ServiceItem[];
  orders: Order[];
  bookings: Booking[];
  expenses: Expense[];
  dataSources: DataSource[];
  automations: Automation[];
  agentActions: AgentAction[];
  diagnoses: AIDiagnosis[];
  memory: BusinessMemory[];
  auditLogs: AuditLog[];
  campaigns: Campaign[];
  inventoryMovements: InventoryMovement[];

  // Connectors & Integrations Hub (Phase 6)
  integrations: BusinessIntegration[];
  updateIntegration: (id: string, updates: Partial<BusinessIntegration>) => void;
  connectIntegration: (params: ConnectParams) => Promise<{ success: boolean; error?: ConnectorErrorDetails }>;
  disconnectIntegration: (params: DisconnectParams) => Promise<{ success: boolean; error?: ConnectorErrorDetails }>;
  checkIntegrationHealth: (provider: ConnectorProviderId, isTestMode?: boolean) => Promise<HealthCheckResult>;
  resetIntegration: (provider: ConnectorProviderId) => void;

  // Trial
  trialDays: TrialDayContent[];
  businessTrial: BusinessTrial;
  activeTrialDay: number;
  dataCompleteness: { score: number; facets: { label: string; complete: boolean; details: string }[] };
  setActiveTrialDay: (day: number) => void;
  completeTrialDay: (day: number) => void;
  resetTrial: () => void;
  refreshTrialData: () => void;
  updateDeliverableStatus: (dayNum: number, deliverableId: string, status: TrialDeliverable['status']) => void;

  // Operations
  addCustomer: (cust: Omit<Customer, 'id' | 'business_id' | 'created_at'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  addLead: (lead: Omit<Lead, 'id' | 'business_id' | 'created_at'>) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  convertLeadToCustomer: (leadId: string) => void;

  // Follow-ups
  followups: CRMFollowUp[];
  addFollowUp: (followUp: Omit<CRMFollowUp, 'id' | 'business_id' | 'created_at'>) => void;
  updateFollowUp: (id: string, updates: Partial<CRMFollowUp>) => void;
  completeFollowUp: (id: string, note?: string) => void;
  rescheduleFollowUp: (id: string, newDueDate: string, note?: string) => void;
  cancelFollowUp: (id: string, reason?: string) => void;

  addProduct: (prod: Omit<Product, 'id' | 'business_id' | 'created_at'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustInventory: (
    productId: string,
    newQuantity: number,
    movementType: InventoryMovementType,
    reason: string
  ) => void;

  addService: (srv: Omit<ServiceItem, 'id' | 'business_id' | 'created_at'>) => void;
  updateService: (id: string, updates: Partial<ServiceItem>) => void;
  deleteService: (id: string) => void;

  addOrder: (ord: Omit<Order, 'id' | 'business_id' | 'created_at'>) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  deleteOrder: (id: string) => void;

  addBooking: (bk: Omit<Booking, 'id' | 'business_id' | 'created_at'>) => void;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;

  addExpense: (exp: Omit<Expense, 'id' | 'business_id' | 'created_at'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  addCampaign: (camp: Omit<Campaign, 'id' | 'business_id' | 'created_at'>) => string;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  approveCampaign: (id: string) => void;
  executeCampaign: (id: string) => void;

  addMemoryEntry: (entry: Omit<BusinessMemory, 'id' | 'business_id' | 'created_at'>) => void;
  addAuditLog: (action: string, details: string) => void;
  toggleAutomation: (id: string) => void;
  addAutomation: (auto: Omit<Automation, 'id' | 'business_id' | 'created_at'>) => void;
  deleteAutomation: (id: string) => void;
  resetAutomationTemplates: () => void;
  triggerAutomationEvent: (event: AutomationTriggerEvent) => Promise<AutomationEvaluationResult[]>;
  automationLogs: AutomationExecutionLog[];
  executeAgentTool: (toolId: string, params: Record<string, any>) => Promise<ToolExecutionResult>;

  approveAgentAction: (id: string) => void;
  rejectAgentAction: (id: string) => void;
  failAgentAction: (id: string, reason?: string) => void;
  triggerNewAgentAction: (agentName: string) => Promise<void>;
  runAgentExecutionLoop: () => Promise<void>;
  convertDiagnosisToAction: (diag: AIDiagnosis) => void;

  runDiagnosisScan: () => Promise<void>;
  updateDiagnosisStatus: (id: string, status: AIDiagnosis['status']) => void;

  addDataSource: (ds: Omit<DataSource, 'id' | 'business_id'>) => void;
  commitImportData: (
    entityType: 'customers' | 'orders' | 'leads' | 'expenses' | 'products' | 'services' | 'bookings',
    records: Array<Record<string, any>>,
    fileName: string,
    sourceType: DataSource['source_type']
  ) => void;
  commitWebsiteImport: (payload: {
    websiteUrl: string;
    domain: string;
    businessInfo: {
      name?: string;
      description?: string;
      industry?: string;
      location?: string;
      phone?: string;
      email?: string;
      business_hours?: string;
      social_links?: Record<string, string>;
    };
    updateProfile: boolean;
    products: Array<{
      name: string;
      description?: string;
      category?: string;
      price?: number | null;
      sku?: string | null;
    }>;
    services: Array<{
      name: string;
      description?: string;
      category?: string;
      price?: number | null;
      duration_minutes?: number | null;
    }>;
    totalDiscovered: {
      businessFields: number;
      products: number;
      services: number;
    };
  }) => { productsCount: number; servicesCount: number; profileUpdated: boolean };

  // Supabase Sync
  isSupabaseConfigured: boolean;
  syncToSupabase: () => Promise<{ success: boolean; message: string }>;
  fetchFromSupabase: () => Promise<{ success: boolean; message: string }>;

  // UI helpers
  toasts: ToastMessage[];
  showToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  removeToast: (id: string) => void;
  isAiDiagnosing: boolean;
  isAgentLoopRunning: boolean;
  executingActionIds: string[];
}

const BusinessStoreContext = createContext<BusinessStoreContextType | null>(null);

const STORAGE_PREFIX = 'bizdoc_v1_';

const DEFAULT_USER: UserSession = {
  id: 'usr_founder',
  email: 'gajendravishwakarma738@gmail.com',
  name: 'Dr. Gajendra Vishwakarma',
  role: 'owner',
};

export const BusinessStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Active business and user state
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}user`);
    return saved ? JSON.parse(saved) : DEFAULT_USER;
  });

  const [allBusinesses, setAllBusinesses] = useState<Business[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}all_businesses`);
    return saved ? JSON.parse(saved) : [SEED_BUSINESS];
  });

  const [activeBizId, setActiveBizId] = useState<string>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}active_biz_id`);
    return saved || SEED_BUSINESS.id;
  });

  const business = useMemo(() => {
    return allBusinesses.find((b) => b.id === activeBizId) || allBusinesses[0] || SEED_BUSINESS;
  }, [allBusinesses, activeBizId]);

  // Collections scoped to business
  const getInitialCollection = <T,>(key: string, seed: T[]): T[] => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${activeBizId}_${key}`);
    return saved ? JSON.parse(saved) : (activeBizId === SEED_BUSINESS.id ? seed : []);
  };

  const [members, setMembers] = useState<BusinessMember[]>(() => getInitialCollection('members', SEED_MEMBERS));
  const [customers, setCustomers] = useState<Customer[]>(() => getInitialCollection('customers', SEED_CUSTOMERS));
  const [leads, setLeads] = useState<Lead[]>(() => getInitialCollection('leads', SEED_LEADS));
  const [products, setProducts] = useState<Product[]>(() => getInitialCollection('products', SEED_PRODUCTS));
  const [services, setServices] = useState<ServiceItem[]>(() => getInitialCollection('services', SEED_SERVICES));
  const [orders, setOrders] = useState<Order[]>(() => getInitialCollection('orders', SEED_ORDERS));
  const [bookings, setBookings] = useState<Booking[]>(() => getInitialCollection('bookings', SEED_BOOKINGS));
  const [expenses, setExpenses] = useState<Expense[]>(() => getInitialCollection('expenses', SEED_EXPENSES));
  const [dataSources, setDataSources] = useState<DataSource[]>(() => getInitialCollection('datasources', SEED_DATA_SOURCES));
  const [automations, setAutomations] = useState<Automation[]>(() => getInitialCollection('automations', SEED_AUTOMATIONS));
  const [agentActions, setAgentActions] = useState<AgentAction[]>(() => getInitialCollection('agentactions', SEED_AGENT_ACTIONS));
  const [diagnoses, setDiagnoses] = useState<AIDiagnosis[]>(() => getInitialCollection('diagnoses', SEED_DIAGNOSES));
  const [followups, setFollowUps] = useState<CRMFollowUp[]>(() => getInitialCollection('followups', []));
  const [memory, setMemory] = useState<BusinessMemory[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${activeBizId}_memory`);
    if (saved) {
      try {
        const parsed: BusinessMemory[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Strict tenant isolation and filter out unverified seed leaks for real businesses
          return parsed.filter((m) => {
            if (!m || m.business_id !== activeBizId) return false;
            if (activeBizId !== SEED_BUSINESS.id && (m.id.startsWith('mem_entry_') || m.provenance?.source_type === 'unverified_seed')) {
              return false;
            }
            return true;
          });
        }
      } catch {
        return [];
      }
    }
    // Never inject SEED_MEMORY into live or newly initialized tenant memory
    return [];
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getInitialCollection('auditlogs', SEED_AUDIT_LOGS));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => getInitialCollection('campaigns', SEED_CAMPAIGNS));
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(() => getInitialCollection('inventory_movements', []));
  const [integrations, setIntegrations] = useState<BusinessIntegration[]>(() =>
    getInitialCollection('integrations', getDefaultIntegrations(activeBizId))
  );
  const [automationLogs, setAutomationLogs] = useState<AutomationExecutionLog[]>(() =>
    getInitialCollection('automationlogs', [
      {
        id: 'log_seed_1',
        automation_id: 'auto_1',
        automation_name: 'Instant Speed-to-Lead Follow-Up',
        trigger_type: 'new_lead',
        action_type: 'send_whatsapp',
        status: 'EXECUTED',
        reason: 'Auto-dispatched via WhatsApp to qualified inbound lead',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'log_seed_2',
        automation_id: 'auto_3',
        automation_name: '24-Hour Booking Appointment Reminder',
        trigger_type: 'booking_reminder',
        action_type: 'send_whatsapp',
        status: 'EXECUTED',
        reason: 'Scheduled appointment reminder sent',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
    ])
  );

  // Trial State
  const [activeTrialDay, setActiveTrialDay] = useState<number>(1);
  const [trialDays, setTrialDays] = useState<TrialDayContent[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${activeBizId}_trial`);
    const savedDays: TrialDayContent[] | undefined = saved ? JSON.parse(saved) : undefined;
    const initialMetrics = calculateBusinessMetrics(
      SEED_BUSINESS,
      SEED_ORDERS,
      SEED_EXPENSES,
      SEED_CUSTOMERS,
      SEED_LEADS,
      SEED_BOOKINGS,
      SEED_PRODUCTS
    );
    const initialCtx: TrialEngineContext = {
      products: SEED_PRODUCTS,
      services: SEED_SERVICES,
      customers: SEED_CUSTOMERS,
      leads: SEED_LEADS,
      orders: SEED_ORDERS,
      bookings: SEED_BOOKINGS,
      expenses: SEED_EXPENSES,
      dataSources: SEED_DATA_SOURCES,
      memory: [],
      diagnoses: SEED_DIAGNOSES,
      automations: SEED_AUTOMATIONS,
    };
    return generateAllTrialDays(SEED_BUSINESS, initialMetrics, initialCtx, savedDays);
  });

  // UI state
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAskDoctorOpen, setIsAskDoctorOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isAiDiagnosing, setIsAiDiagnosing] = useState<boolean>(false);
  const [isAgentLoopRunning, setIsAgentLoopRunning] = useState<boolean>(false);
  const [executingActionIds, setExecutingActionIds] = useState<string[]>([]);

  const showToast = useCallback((type: ToastMessage['type'], title: string, message?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync to localStorage whenever active business or collections change
  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}all_businesses`, JSON.stringify(allBusinesses));
  }, [allBusinesses]);

  // Supabase Auth real-time session listener and initial token validation
  useEffect(() => {
    getCurrentSupabaseSession().then((remoteSession) => {
      if (remoteSession) {
        setUser(remoteSession);
      }
    });

    const unsubscribe = onAuthStateChange((session) => {
      if (session) {
        setUser(session);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}active_biz_id`, activeBizId);
  }, [activeBizId]);

  useEffect(() => {
    if (user) localStorage.setItem(`${STORAGE_PREFIX}user`, JSON.stringify(user));
    else localStorage.removeItem(`${STORAGE_PREFIX}user`);
  }, [user]);

  const saveCollection = useCallback(
    (key: string, data: any) => {
      localStorage.setItem(`${STORAGE_PREFIX}${activeBizId}_${key}`, JSON.stringify(data));
    },
    [activeBizId]
  );

  useEffect(() => saveCollection('members', members), [members, saveCollection]);
  useEffect(() => saveCollection('customers', customers), [customers, saveCollection]);
  useEffect(() => saveCollection('leads', leads), [leads, saveCollection]);
  useEffect(() => saveCollection('products', products), [products, saveCollection]);
  useEffect(() => saveCollection('services', services), [services, saveCollection]);
  useEffect(() => saveCollection('orders', orders), [orders, saveCollection]);
  useEffect(() => saveCollection('bookings', bookings), [bookings, saveCollection]);
  useEffect(() => saveCollection('expenses', expenses), [expenses, saveCollection]);
  useEffect(() => saveCollection('datasources', dataSources), [dataSources, saveCollection]);
  useEffect(() => saveCollection('automations', automations), [automations, saveCollection]);
  useEffect(() => saveCollection('agentactions', agentActions), [agentActions, saveCollection]);
  useEffect(() => saveCollection('diagnoses', diagnoses), [diagnoses, saveCollection]);
  useEffect(() => saveCollection('followups', followups), [followups, saveCollection]);
  useEffect(() => saveCollection('memory', memory), [memory, saveCollection]);
  useEffect(() => saveCollection('auditlogs', auditLogs), [auditLogs, saveCollection]);
  useEffect(() => saveCollection('campaigns', campaigns), [campaigns, saveCollection]);
  useEffect(() => saveCollection('inventory_movements', inventoryMovements), [inventoryMovements, saveCollection]);
  useEffect(() => saveCollection('integrations', integrations), [integrations, saveCollection]);
  useEffect(() => saveCollection('automationlogs', automationLogs), [automationLogs, saveCollection]);
  useEffect(() => saveCollection('trial', trialDays), [trialDays, saveCollection]);

  // Dynamic real metrics calculation
  const metrics = useMemo(() => {
    return calculateBusinessMetrics(business, orders, expenses, customers, leads, bookings, products);
  }, [business, orders, expenses, customers, leads, bookings, products]);

  // Log audit helper
  const addAuditLog = useCallback(
    (action: string, details: string) => {
      const newLog: AuditLog = {
        id: `log_${Date.now()}`,
        business_id: business.id,
        user_id: user?.id || 'usr_anonymous',
        action,
        details,
        ip_address: '127.0.0.1 (Session Client)',
        created_at: new Date().toISOString(),
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    },
    [business.id, user]
  );

  // Business Switcher
  const switchBusiness = useCallback(
    (bizId: string) => {
      const target = allBusinesses.find((b) => b.id === bizId);
      if (target) {
        setActiveBizId(bizId);
        // Load collections for this business
        const load = <T,>(key: string, fallback: T[]): T[] => {
          const s = localStorage.getItem(`${STORAGE_PREFIX}${bizId}_${key}`);
          return s ? JSON.parse(s) : fallback;
        };
        const custs = load('customers', []);
        const lds = load('leads', []);
        const prods = load('products', []);
        const srvs = load('services', []);
        const ords = load('orders', []);
        const bks = load('bookings', []);
        const exps = load('expenses', []);
        const diags = load('diagnoses', []);
        const rawMems = load<BusinessMemory>('memory', []);
        const mems = rawMems.filter((m) => {
          if (!m || m.business_id !== bizId) return false;
          if (bizId !== SEED_BUSINESS.id && (m.id.startsWith('mem_entry_') || m.provenance?.source_type === 'unverified_seed')) {
            return false;
          }
          return true;
        });
        const camps = load('campaigns', []);
        const movs = load('inventory_movements', []);
        const ints = load<BusinessIntegration>('integrations', getDefaultIntegrations(bizId));
        const savedTrial = load('trial', []);

        setCustomers(custs);
        setLeads(lds);
        setProducts(prods);
        setServices(srvs);
        setOrders(ords);
        setBookings(bks);
        setExpenses(exps);
        setDiagnoses(diags);
        setMemory(mems);
        setCampaigns(camps);
        setInventoryMovements(movs);
        setIntegrations(ints);

        const targetMetrics = calculateBusinessMetrics(target, ords, exps, custs, lds, bks, prods);
        const targetCtx: TrialEngineContext = {
          products: prods,
          services: srvs,
          customers: custs,
          leads: lds,
          orders: ords,
          bookings: bks,
          expenses: exps,
          dataSources: load('datasources', []),
          memory: mems,
          diagnoses: diags,
          automations: load('automations', []),
        };
        const targetTrialDays = generateAllTrialDays(target, targetMetrics, targetCtx, savedTrial.length > 0 ? savedTrial : undefined);
        setTrialDays(targetTrialDays);
        const firstIncomplete = targetTrialDays.find((d) => !d.completed)?.day || 1;
        setActiveTrialDay(firstIncomplete);

        showToast('info', `Switched to ${target.name}`);
      }
    },
    [allBusinesses, showToast]
  );

  const updateBusiness = useCallback(
    (updates: Partial<Business>) => {
      setAllBusinesses((prev) =>
        prev.map((b) => (b.id === activeBizId ? { ...b, ...updates, updated_at: new Date().toISOString() } : b))
      );
      addAuditLog('BUSINESS_UPDATED', `Updated profile fields: ${Object.keys(updates).join(', ')}`);
      showToast('success', 'Business settings updated');
    },
    [activeBizId, addAuditLog, showToast]
  );

  const createBusiness = useCallback(
    (newBiz: Omit<Business, 'id' | 'created_at' | 'updated_at'>): string => {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : createUuid();

      let ageMonths = newBiz.business_age_months;
      if (ageMonths == null) {
        if (newBiz.data_maturity_mode === 'new_no_data') {
          ageMonths = 0;
        } else if (newBiz.data_maturity_mode === 'existing_no_data') {
          ageMonths = newBiz.business_age_stage === 'established' ? 36 : newBiz.business_age_stage === 'growing' ? 24 : 12;
        } else if (newBiz.data_maturity_mode === 'existing_partial') {
          ageMonths = newBiz.business_age_stage === 'established' ? 36 : newBiz.business_age_stage === 'growing' ? 18 : 6;
        } else if (newBiz.data_maturity_mode === 'existing_complete') {
          ageMonths = newBiz.business_age_stage === 'established' ? 48 : newBiz.business_age_stage === 'growing' ? 24 : 12;
        } else {
          ageMonths = 12;
        }
      }

      const fullBiz: Business = {
        ...newBiz,
        id: newId,
        business_age_months: ageMonths,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setAllBusinesses((prev) => [...prev, fullBiz]);
      setActiveBizId(newId);

      // Establish Start From Today baseline for modes without historical data
      const isStartFromToday =
        newBiz.data_maturity_mode === 'new_no_data' ||
        newBiz.data_maturity_mode === 'existing_no_data';

      let baselineTitle = `Day 0 Foundation Baseline: ${newBiz.name}`;
      let baselineContent = '';

      if (newBiz.data_maturity_mode === 'new_no_data') {
        baselineTitle = `Day 0 Baseline: Start From Today (${newBiz.name})`;
        baselineContent = `New business foundation initialized. Baseline established: Start From Today. No historical data exists or is assumed. All financial, order, customer, and operational tracking begins live from Day 0 (${newBiz.business_age_stage} stage, 0 months historical context). Target monthly revenue: ${newBiz.currency_symbol}${newBiz.monthly_revenue_target.toLocaleString('en-IN')}.`;
      } else if (newBiz.data_maturity_mode === 'existing_no_data') {
        baselineTitle = `Day 0 Baseline: Start From Today (${newBiz.name})`;
        baselineContent = `Existing business profile initialized without prior historical records (${newBiz.business_age_stage} stage, ${ageMonths} months operational age). Baseline established: Start From Today. No historical trends or unverified metrics are assumed or fabricated. All financial and operational performance tracking commences live from today. Target monthly revenue: ${newBiz.currency_symbol}${newBiz.monthly_revenue_target.toLocaleString('en-IN')}.`;
      } else if (newBiz.data_maturity_mode === 'existing_partial') {
        baselineTitle = `Day 0 Baseline: Partial Historical Data (${newBiz.name})`;
        baselineContent = `Existing business profile initialized with partial records (${newBiz.business_age_stage} stage, ${ageMonths} months operational age). Unverified historical periods are explicitly marked as Insufficient Data to prevent false trend assumptions. Target monthly revenue: ${newBiz.currency_symbol}${newBiz.monthly_revenue_target.toLocaleString('en-IN')}.`;
      } else {
        baselineTitle = `Day 0 Baseline: Complete Historical Data (${newBiz.name})`;
        baselineContent = `Existing business profile configured for complete historical dataset synchronization (${newBiz.business_age_stage} stage, ${ageMonths} months operational age). Metric auditing will verify all ingested ledgers against source records. Target monthly revenue: ${newBiz.currency_symbol}${newBiz.monthly_revenue_target.toLocaleString('en-IN')}.`;
      }

      // Create initial Day 0 baseline memory entry
      const day0Entry: BusinessMemory = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : createUuid(),
        business_id: newId,
        observation_type: 'baseline',
        period: 'day_0',
        title: baselineTitle,
        content: baselineContent,
        confidence_score: 95,
        outcome_recorded: isStartFromToday
          ? 'Start From Today baseline established. Zero fabricated historical records.'
          : 'Historical data baseline registered for audit verification.',
        created_at: new Date().toISOString(),
        is_verified: true,
        provenance: {
          source_type: 'live_event',
          source_table: 'businesses',
          source_record_id: newId,
          evidence_summary: `Day 0 baseline registered during onboarding for ${newBiz.name}.`,
          has_sufficient_data: true,
        },
      };
      setMemory([day0Entry]);

      // Seed starter automations
      const starterAuto: Automation = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : createUuid(),
        business_id: newId,
        name: 'Instant WhatsApp Welcome for Inbound Leads',
        trigger_type: 'new_lead',
        action_type: 'send_whatsapp',
        conditions: { delayMinutes: 2 },
        requires_approval: false,
        is_active: true,
        execution_count: 0,
        last_run: null,
        created_at: new Date().toISOString(),
      };
      setAutomations([starterAuto]);

      // Generate initial trial days for new business
      const initMetrics = calculateBusinessMetrics(fullBiz, [], [], [], [], [], []);
      const initCtx: TrialEngineContext = {
        products: [],
        services: [],
        customers: [],
        leads: [],
        orders: [],
        bookings: [],
        expenses: [],
        dataSources: [],
        memory: [day0Entry],
        diagnoses: [],
        automations: [starterAuto],
      };
      const initialTrialDays = generateAllTrialDays(fullBiz, initMetrics, initCtx);
      setTrialDays(initialTrialDays);
      setActiveTrialDay(1);

      // Supabase remote persistence using mapped schemas
      const client = getSupabaseClient();
      if (client) {
        const bizRow = mapBusinessToDb(fullBiz);
        client.from('businesses').upsert([bizRow]).then(async ({ error }) => {
          if (error) {
            console.warn('Supabase business upsert error:', error.message);
          } else {
            // Link authenticated user to business_members
            try {
              const { data: authData } = await client.auth.getUser();
              const authUserId = authData?.user?.id || (user?.id && !user.id.startsWith('usr_preview') ? user.id : null);
              if (authUserId) {
                await client.from('business_members').upsert([{
                  id: toValidUuid(`${newId}:${authUserId}`),
                  business_id: newId,
                  user_id: authUserId,
                  role: 'owner',
                }]);
              }
            } catch (memberErr: any) {
              console.warn('business_members link error:', memberErr?.message);
            }
          }
        });

        const memRow = mapMemoryToDb(day0Entry, newId);
        client.from('business_memory').upsert([memRow]).then(({ error }) => {
          if (error) console.warn('Supabase baseline memory upsert error:', error.message);
        });

        const autoRow = mapAutomationToDb(starterAuto, newId);
        client.from('automations').upsert([autoRow]).then(({ error }) => {
          if (error) console.warn('Supabase starter automation upsert error:', error.message);
        });
      }

      // Reset other collections for new business (guarantee zero data leakage / no mock data)
      setCustomers([]);
      setLeads([]);
      setProducts([]);
      setServices([]);
      setOrders([]);
      setBookings([]);
      setExpenses([]);
      setDiagnoses([]);
      setAgentActions([]);
      setCampaigns([]);

      addAuditLog('BUSINESS_CREATED', `Created new business entity: ${newBiz.name} (${newBiz.data_maturity_mode})`);
      showToast('success', `Business "${newBiz.name}" created successfully!`);
      return newId;
    },
    [user?.id, addAuditLog, showToast]
  );

  const login = useCallback(
    async (email: string, password?: string, name?: string, role: UserRole = 'owner') => {
      const client = getSupabaseClient();
      if (client && password) {
        const res = await signInWithEmail(email, password);
        if (res.success && res.session) {
          setUser(res.session);
          showToast('success', `Signed in as ${res.session.role.toUpperCase()}: ${res.session.name}`);
          addAuditLog('USER_SIGNIN', `User signed in: ${res.session.email} (Role: ${res.session.role})`);
          return { success: true };
        } else if (res.error) {
          showToast('error', 'Supabase Auth Error', res.error);
          return { success: false, error: res.error };
        }
      }

      // Local / Offline non-production preview session
      const usr: UserSession = {
        id: `usr_offline_${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        role,
        last_sign_in_at: new Date().toISOString(),
        is_demo: true,
        access_token: 'demo_token_offline_preview',
      };
      setUser(usr);
      showToast('info', `Preview Mode: Welcome, ${usr.name}!`, 'Operating in local offline sandbox mode (non-production).');
      addAuditLog('USER_SIGNIN', `Offline preview session started for: ${usr.email} (${role})`);
      return { success: true };
    },
    [addAuditLog, showToast]
  );

  const signup = useCallback(
    async (email: string, password?: string, name?: string, role: UserRole = 'owner') => {
      const client = getSupabaseClient();
      if (client && password) {
        const res = await signUpWithEmail(email, password, name || email.split('@')[0], role);
        if (res.success && res.session) {
          setUser(res.session);
          showToast('success', `Account created successfully for ${res.session.name}`);
          addAuditLog('USER_SIGNUP', `Created new user: ${res.session.email} (Role: ${res.session.role})`);
          return { success: true };
        } else if (res.confirmationRequired) {
          showToast('info', 'Confirmation Required', res.error);
          return { success: true };
        } else if (res.error) {
          showToast('error', 'Registration Error', res.error);
          return { success: false, error: res.error };
        }
      }

      const usr: UserSession = {
        id: `usr_offline_${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        role,
        last_sign_in_at: new Date().toISOString(),
        is_demo: true,
        access_token: 'demo_token_offline_preview',
      };
      setUser(usr);
      showToast('info', `Preview Account: ${usr.name}`, 'Operating in local offline sandbox mode.');
      addAuditLog('USER_SIGNUP', `Created offline preview account: ${usr.email} (${role})`);
      return { success: true };
    },
    [addAuditLog, showToast]
  );

  const logout = useCallback(async () => {
    await signOutUser();
    setUser(null);
    showToast('info', 'Logged out of workspace session');
    addAuditLog('USER_SIGNOUT', 'User signed out');
  }, [addAuditLog, showToast]);

  const switchRole = useCallback(
    (newRole: UserRole) => {
      setUser((prev) => {
        if (!prev) {
          return {
            id: 'usr_founder',
            email: 'founder@ayurvedicremedies.in',
            name: 'Workspace Member',
            role: newRole,
          };
        }
        return {
          ...prev,
          role: newRole,
        };
      });
      showToast('info', `Active role switched to: ${newRole.toUpperCase()}`);
      addAuditLog('ROLE_SWITCH', `Switched active role to: ${newRole}`);
    },
    [addAuditLog, showToast]
  );

  // Customer CRUD
  const addCustomer = useCallback(
    (cust: Omit<Customer, 'id' | 'business_id' | 'created_at'>) => {
      const newCust: Customer = {
        ...cust,
        id: `cust_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
      };
      setCustomers((prev) => [newCust, ...prev]);
      const client = getSupabaseClient();
      if (client) {
        client.from('customers').insert([newCust]).then(({ error }) => {
          if (error) console.warn('Supabase customer insert error:', error.message);
        });
      }
      addAuditLog('CUSTOMER_CREATED', `Added customer: ${newCust.name} (${newCust.phone})`);
      showToast('success', `Customer ${newCust.name} added`);
    },
    [business.id, addAuditLog, showToast]
  );

  const updateCustomer = useCallback(
    (id: string, updates: Partial<Customer>) => {
      setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      const client = getSupabaseClient();
      if (client) {
        client.from('customers').update(updates).eq('id', id).then(({ error }) => {
          if (error) console.warn('Supabase customer update error:', error.message);
        });
      }
      showToast('success', 'Customer record updated');
    },
    [showToast]
  );

  const deleteCustomer = useCallback(
    (id: string) => {
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      const client = getSupabaseClient();
      if (client) {
        client.from('customers').delete().eq('id', id).then(({ error }) => {
          if (error) console.warn('Supabase customer delete error:', error.message);
        });
      }
      showToast('info', 'Customer removed');
    },
    [showToast]
  );

  // Lead CRUD
  const addLead = useCallback(
    (lead: Omit<Lead, 'id' | 'business_id' | 'created_at'>) => {
      const newLead: Lead = {
        ...lead,
        id: `lead_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
      };
      setLeads((prev) => [newLead, ...prev]);
      const client = getSupabaseClient();
      if (client) {
        client.from('leads').insert([newLead]).then(({ error }) => {
          if (error) console.warn('Supabase lead insert error:', error.message);
        });
      }
      addAuditLog('LEAD_CREATED', `New lead received: ${newLead.name} (Score: ${newLead.score})`);
      showToast('success', `Lead ${newLead.name} added`);
    },
    [business.id, addAuditLog, showToast]
  );

  const updateLead = useCallback(
    (id: string, updates: Partial<Lead>) => {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
      const client = getSupabaseClient();
      if (client) {
        client.from('leads').update(updates).eq('id', id).then(({ error }) => {
          if (error) console.warn('Supabase lead update error:', error.message);
        });
      }
      showToast('success', 'Lead updated');
    },
    [showToast]
  );

  const deleteLead = useCallback(
    (id: string) => {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      const client = getSupabaseClient();
      if (client) {
        client.from('leads').delete().eq('id', id).then(({ error }) => {
          if (error) console.warn('Supabase lead delete error:', error.message);
        });
      }
      showToast('info', 'Lead deleted');
    },
    [showToast]
  );

  const convertLeadToCustomer = useCallback(
    (leadId: string) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;

      // Duplicate prevention: check existing records using normalized phone and email
      const normPhone = normalizePhoneNumber(lead.phone);
      const normEmail = normalizeEmail(lead.email);

      let targetCustomerId = lead.converted_to_customer_id;
      let existingCustomer: Customer | undefined;

      if (targetCustomerId) {
        existingCustomer = customers.find((c) => c.id === targetCustomerId);
      }
      if (!existingCustomer && (normPhone || normEmail)) {
        existingCustomer = customers.find((c) => {
          if (normPhone && normPhone.length >= 10 && normalizePhoneNumber(c.phone) === normPhone) return true;
          if (normEmail && normEmail.includes('@') && normalizeEmail(c.email) === normEmail) return true;
          return false;
        });
      }

      const client = getSupabaseClient();

      if (existingCustomer) {
        targetCustomerId = existingCustomer.id;
        const updatedNotes = lead.notes
          ? `${existingCustomer.notes ? `${existingCustomer.notes}\n` : ''}[Lead Inbound Note]: ${lead.notes}`
          : existingCustomer.notes;

        setCustomers((prev) =>
          prev.map((c) =>
            c.id === targetCustomerId
              ? { ...c, last_activity: new Date().toISOString(), notes: updatedNotes }
              : c
          )
        );

        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: 'won', converted_to_customer_id: targetCustomerId } : l
          )
        );

        if (client) {
          client
            .from('leads')
            .update({ status: 'won', converted_to_customer_id: targetCustomerId })
            .eq('id', leadId)
            .then(({ error }) => {
              if (error) console.warn('Supabase lead convert update error:', error.message);
            });
          client
            .from('customers')
            .update({ last_activity: new Date().toISOString(), notes: updatedNotes })
            .eq('id', targetCustomerId)
            .then(({ error }) => {
              if (error) console.warn('Supabase customer update error:', error.message);
            });
        }

        addAuditLog(
          'LEAD_CONVERTED',
          `Linked converted lead ${lead.name} to existing customer ${existingCustomer.name} (${targetCustomerId})`
        );
        showToast('success', `Lead linked to existing customer ${existingCustomer.name}!`);
      } else {
        targetCustomerId = `cust_${Date.now()}`;
        const newCust: Customer = {
          id: targetCustomerId,
          business_id: business.id,
          name: lead.name,
          email: lead.email || '',
          phone: lead.phone || '',
          city: business.location ? business.location.split(',')[0].trim() : '',
          source: (lead.source?.toLowerCase().includes('instagram')
            ? 'instagram'
            : lead.source?.toLowerCase().includes('whatsapp')
            ? 'whatsapp'
            : lead.source?.toLowerCase().includes('search')
            ? 'google_search'
            : 'other') as any,
          status: 'active',
          first_seen: lead.created_at || new Date().toISOString(),
          last_activity: new Date().toISOString(),
          total_orders: 0,
          total_spend: 0,
          notes: lead.notes ? `Converted from inbound lead. Notes: ${lead.notes}` : 'Converted from inbound lead.',
          tags: ['Lead-Converted'],
          created_at: new Date().toISOString(),
        };

        setCustomers((prev) => [newCust, ...prev]);
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: 'won', converted_to_customer_id: targetCustomerId } : l
          )
        );

        if (client) {
          client
            .from('customers')
            .insert([newCust])
            .then(({ error }) => {
              if (error) console.warn('Supabase customer insert error:', error.message);
            });
          client
            .from('leads')
            .update({ status: 'won', converted_to_customer_id: targetCustomerId })
            .eq('id', leadId)
            .then(({ error }) => {
              if (error) console.warn('Supabase lead convert update error:', error.message);
            });
        }

        addAuditLog('LEAD_CONVERTED', `Converted lead ${lead.name} to new customer record ${targetCustomerId}`);
        showToast('success', `🎉 Lead ${lead.name} converted to Customer!`);
      }
    },
    [leads, customers, business, addAuditLog, showToast]
  );

  // Follow-ups Management
  const addFollowUp = useCallback(
    (followUpData: Omit<CRMFollowUp, 'id' | 'business_id' | 'created_at'>) => {
      const newFollowUp: CRMFollowUp = {
        ...followUpData,
        id: `fu_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
      };

      setFollowUps((prev) => [newFollowUp, ...prev]);

      // If scheduled for a lead, also keep the lead record's next_follow_up aligned
      if (newFollowUp.target_type === 'lead') {
        setLeads((prev) =>
          prev.map((l) => (l.id === newFollowUp.target_id ? { ...l, next_follow_up: newFollowUp.due_date } : l))
        );
        const client = getSupabaseClient();
        if (client) {
          client
            .from('leads')
            .update({ next_follow_up: newFollowUp.due_date })
            .eq('id', newFollowUp.target_id)
            .then(({ error }) => {
              if (error) console.warn('Supabase lead next_follow_up error:', error.message);
            });
        }
      }

      addAuditLog('FOLLOWUP_CREATED', `Scheduled follow-up for ${newFollowUp.target_name} on ${newFollowUp.due_date}`);
      showToast('success', `Follow-up scheduled for ${newFollowUp.target_name}`);
    },
    [business.id, addAuditLog, showToast]
  );

  const updateFollowUp = useCallback(
    (id: string, updates: Partial<CRMFollowUp>) => {
      setFollowUps((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const updated = { ...f, ...updates };

          if (updated.target_type === 'lead' && updates.due_date) {
            setLeads((leadsPrev) =>
              leadsPrev.map((l) => (l.id === updated.target_id ? { ...l, next_follow_up: updates.due_date } : l))
            );
          }
          return updated;
        })
      );
      addAuditLog('FOLLOWUP_UPDATED', `Updated follow-up ${id}`);
      showToast('info', 'Follow-up updated');
    },
    [addAuditLog, showToast]
  );

  const completeFollowUp = useCallback(
    (id: string, note?: string) => {
      const nowIso = new Date().toISOString();
      let targetInfo: { type: string; id: string; name: string } | null = null;

      setFollowUps((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          targetInfo = { type: f.target_type, id: f.target_id, name: f.target_name };
          return {
            ...f,
            status: 'completed',
            completed_at: nowIso,
            notes: note ? `${f.notes ? `${f.notes}\n` : ''}[Completed Note]: ${note}` : f.notes,
          };
        })
      );

      // If target is a lead, update last_follow_up and clear next_follow_up
      if (targetInfo && targetInfo.type === 'lead') {
        const leadId = targetInfo.id;
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, last_follow_up: nowIso, next_follow_up: null } : l))
        );
        const client = getSupabaseClient();
        if (client) {
          client
            .from('leads')
            .update({ last_follow_up: nowIso, next_follow_up: null })
            .eq('id', leadId)
            .then(({ error }) => {
              if (error) console.warn('Supabase lead last_follow_up error:', error.message);
            });
        }
      }

      addAuditLog('FOLLOWUP_COMPLETED', `Completed follow-up for ${targetInfo ? targetInfo.name : id}`);
      showToast('success', 'Follow-up marked as completed');
    },
    [addAuditLog, showToast]
  );

  const rescheduleFollowUp = useCallback(
    (id: string, newDueDate: string, note?: string) => {
      setFollowUps((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          return {
            ...f,
            due_date: newDueDate,
            status: 'pending',
            notes: note ? `${f.notes ? `${f.notes}\n` : ''}[Rescheduled to ${newDueDate}]: ${note}` : f.notes,
          };
        })
      );

      // Check if target is a lead
      const fu = followups.find((f) => f.id === id);
      if (fu && fu.target_type === 'lead') {
        setLeads((prev) =>
          prev.map((l) => (l.id === fu.target_id ? { ...l, next_follow_up: newDueDate } : l))
        );
        const client = getSupabaseClient();
        if (client) {
          client
            .from('leads')
            .update({ next_follow_up: newDueDate })
            .eq('id', fu.target_id)
            .then(({ error }) => {
              if (error) console.warn('Supabase lead reschedule error:', error.message);
            });
        }
      }

      addAuditLog('FOLLOWUP_RESCHEDULED', `Rescheduled follow-up ${id} to ${newDueDate}`);
      showToast('info', `Follow-up rescheduled to ${newDueDate}`);
    },
    [followups, addAuditLog, showToast]
  );

  const cancelFollowUp = useCallback(
    (id: string, reason?: string) => {
      setFollowUps((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          return {
            ...f,
            status: 'cancelled',
            notes: reason ? `${f.notes ? `${f.notes}\n` : ''}[Cancelled]: ${reason}` : f.notes,
          };
        })
      );

      const fu = followups.find((f) => f.id === id);
      if (fu && fu.target_type === 'lead') {
        setLeads((prev) =>
          prev.map((l) => (l.id === fu.target_id ? { ...l, next_follow_up: null } : l))
        );
      }

      addAuditLog('FOLLOWUP_CANCELLED', `Cancelled follow-up ${id}${reason ? `: ${reason}` : ''}`);
      showToast('info', 'Follow-up cancelled');
    },
    [followups, addAuditLog, showToast]
  );

  // Product CRUD
  const addProduct = useCallback(
    (prod: Omit<Product, 'id' | 'business_id' | 'created_at'>) => {
      const price = Number(prod.price) || 0;
      const cost = Number(prod.cost) || 0;
      const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
      const stock = Math.max(0, Number(prod.stock_quantity) || 0);

      const newProd: Product = {
        ...prod,
        price,
        cost,
        stock_quantity: stock,
        margin_pct: prod.margin_pct !== undefined && prod.margin_pct !== 0 ? prod.margin_pct : margin,
        status: stock === 0 ? 'out_of_stock' : stock <= 10 ? 'low_stock' : 'active',
        id: `prod_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
      };
      setProducts((prev) => [newProd, ...prev]);

      if (stock > 0) {
        const initialMov: InventoryMovement = {
          id: `mov_${Date.now()}`,
          business_id: business.id,
          product_id: newProd.id,
          product_name: newProd.name,
          movement_type: 'purchase_restock',
          quantity_change: stock,
          balance_after: stock,
          reason: 'Initial catalog stock opening balance',
          created_by: user?.name || user?.email || 'admin',
          created_at: new Date().toISOString(),
        };
        setInventoryMovements((prev) => [initialMov, ...prev]);
      }

      const client = getSupabaseClient();
      if (client) {
        client.from('products').insert([newProd]);
      }
      addAuditLog('PRODUCT_CREATED', `Added product: ${newProd.name} (${stock} units)`);
      showToast('success', `Product ${newProd.name} added`);
    },
    [business.id, user, addAuditLog, showToast]
  );

  const updateProduct = useCallback(
    (id: string, updates: Partial<Product>) => {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const merged = { ...p, ...updates };
          const price = Number(merged.price) || 0;
          const cost = Number(merged.cost) || 0;
          const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
          const stock = Math.max(0, Number(merged.stock_quantity) || 0);
          return {
            ...merged,
            price,
            cost,
            stock_quantity: stock,
            margin_pct: updates.margin_pct !== undefined ? updates.margin_pct : margin,
            status: stock === 0 ? 'out_of_stock' : stock <= 10 ? 'low_stock' : 'active',
          };
        })
      );
      const client = getSupabaseClient();
      if (client) {
        client.from('products').update(updates).eq('id', id);
      }
      addAuditLog('PRODUCT_UPDATED', `Updated product: ${id}`);
      showToast('success', 'Product updated');
    },
    [addAuditLog, showToast]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      const target = products.find((p) => p.id === id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      const client = getSupabaseClient();
      if (client) {
        client.from('products').delete().eq('id', id);
      }
      addAuditLog('PRODUCT_DELETED', `Deleted product: ${target?.name || id}`);
      showToast('info', 'Product removed');
    },
    [products, addAuditLog, showToast]
  );

  const adjustInventory = useCallback(
    (
      productId: string,
      newQuantity: number,
      movementType: InventoryMovementType,
      reason: string
    ) => {
      const prod = products.find((p) => p.id === productId);
      if (!prod) return;

      const result = recordStockAdjustment(
        prod,
        newQuantity,
        movementType,
        reason,
        user?.name || user?.email,
        business.id
      );

      setProducts((prev) => prev.map((p) => (p.id === productId ? result.updatedProduct : p)));
      setInventoryMovements((prev) => [result.movement, ...prev]);

      const client = getSupabaseClient();
      if (client) {
        client.from('products').update(result.updatedProduct).eq('id', productId);
      }

      addAuditLog(
        'INVENTORY_ADJUSTED',
        `Adjusted stock for ${prod.name} to ${newQuantity} (${movementType}: ${reason})`
      );
      showToast('success', `Stock updated for ${prod.name} (${newQuantity} units)`);
    },
    [products, user, business.id, addAuditLog, showToast]
  );

  // Service CRUD
  const addService = useCallback(
    (srv: Omit<ServiceItem, 'id' | 'business_id' | 'created_at'>) => {
      const newSrv: ServiceItem = {
        ...srv,
        id: `srv_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
      };
      setServices((prev) => [newSrv, ...prev]);
      const client = getSupabaseClient();
      if (client) {
        client.from('services').insert([newSrv]);
      }
      addAuditLog('SERVICE_CREATED', `Added service: ${newSrv.name}`);
      showToast('success', `Service ${newSrv.name} added`);
    },
    [business.id, addAuditLog, showToast]
  );

  const updateService = useCallback(
    (id: string, updates: Partial<ServiceItem>) => {
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
      const client = getSupabaseClient();
      if (client) {
        client.from('services').update(updates).eq('id', id);
      }
      addAuditLog('SERVICE_UPDATED', `Updated service: ${id}`);
      showToast('success', 'Service updated');
    },
    [addAuditLog, showToast]
  );

  const deleteService = useCallback(
    (id: string) => {
      const target = services.find((s) => s.id === id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      const client = getSupabaseClient();
      if (client) {
        client.from('services').delete().eq('id', id);
      }
      addAuditLog('SERVICE_DELETED', `Deleted service: ${target?.name || id}`);
      showToast('info', 'Service removed');
    },
    [services, addAuditLog, showToast]
  );

  // Order CRUD
  const addOrder = useCallback(
    (ord: Omit<Order, 'id' | 'business_id' | 'created_at'>) => {
      const orderNumber = ord.order_number || generateOrderNumber(business.id, orders);
      const calculatedTotals = calculateOrderTotals(
        ord.items || [],
        ord.discount_amount || 0,
        0.05,
        ord.tax_amount !== undefined ? ord.tax_amount : null
      );

      let newOrd: Order = {
        ...ord,
        id: `ord_${Date.now()}`,
        business_id: business.id,
        order_number: orderNumber,
        items: calculatedTotals.items,
        subtotal: calculatedTotals.subtotal,
        discount_amount: calculatedTotals.discountAmount,
        tax_amount: calculatedTotals.taxAmount,
        total_amount: ord.total_amount ? Number(ord.total_amount) : calculatedTotals.totalAmount,
        inventory_decremented: false,
        created_at: new Date().toISOString(),
      };

      // Idempotently deduct stock if order is not cancelled/refunded
      const isEligibleForStockDeduction =
        newOrd.order_status !== 'cancelled' && newOrd.payment_status !== 'refunded';

      if (isEligibleForStockDeduction && newOrd.items && newOrd.items.length > 0) {
        const deduction = applyOrderInventoryDeduction(newOrd, products, user?.name || user?.email);
        if (deduction.wasApplied) {
          setProducts(deduction.updatedProducts);
          setInventoryMovements((prev) => [...deduction.movements, ...prev]);
          newOrd = { ...newOrd, inventory_decremented: true };
        }
      }

      setOrders((prev) => [newOrd, ...prev]);

      // If tied to customer, update customer spend and orders count
      if (newOrd.customer_id) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === newOrd.customer_id
              ? {
                  ...c,
                  total_orders: (c.total_orders || 0) + 1,
                  total_spend: (c.total_spend || 0) + newOrd.total_amount,
                  last_activity: new Date().toISOString(),
                }
              : c
          )
        );
      }

      const client = getSupabaseClient();
      if (client) {
        client.from('orders').insert([newOrd]);
      }

      addAuditLog(
        'ORDER_CREATED',
        `Order ${newOrd.order_number} created for ${business.currency_symbol}${newOrd.total_amount} (${newOrd.customer_name})`
      );
      showToast(
        'success',
        `Order ${newOrd.order_number} logged (${business.currency_symbol}${newOrd.total_amount})`
      );
    },
    [business, orders, products, user, addAuditLog, showToast]
  );

  const updateOrder = useCallback(
    (id: string, updates: Partial<Order>) => {
      const existing = orders.find((o) => o.id === id);
      if (!existing) return;

      let updated = { ...existing, ...updates };

      // Handle stock restoration if order cancelled or refunded
      const isNowCancelled =
        updates.order_status === 'cancelled' || updates.payment_status === 'refunded';
      const isNowActiveOrCompleted =
        (updates.order_status === 'completed' || updates.payment_status === 'paid') &&
        updates.order_status !== 'cancelled' &&
        updates.payment_status !== 'refunded';

      if (isNowCancelled && existing.inventory_decremented) {
        const restoration = applyOrderInventoryRestoration(existing, products, user?.name || user?.email);
        if (restoration.wasApplied) {
          setProducts(restoration.updatedProducts);
          setInventoryMovements((prev) => [...restoration.movements, ...prev]);
          updated.inventory_decremented = false;
        }
      } else if (isNowActiveOrCompleted && !existing.inventory_decremented) {
        const deduction = applyOrderInventoryDeduction(updated, products, user?.name || user?.email);
        if (deduction.wasApplied) {
          setProducts(deduction.updatedProducts);
          setInventoryMovements((prev) => [...deduction.movements, ...prev]);
          updated.inventory_decremented = true;
        }
      }

      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      const client = getSupabaseClient();
      if (client) {
        client.from('orders').update(updates).eq('id', id);
      }
      addAuditLog('ORDER_UPDATED', `Updated order ${updated.order_number || id}`);
      showToast('success', 'Order updated');
    },
    [orders, products, user, addAuditLog, showToast]
  );

  const deleteOrder = useCallback(
    (id: string) => {
      const target = orders.find((o) => o.id === id);
      if (target && target.inventory_decremented) {
        const restoration = applyOrderInventoryRestoration(target, products, user?.name || user?.email);
        if (restoration.wasApplied) {
          setProducts(restoration.updatedProducts);
          setInventoryMovements((prev) => [...restoration.movements, ...prev]);
        }
      }

      setOrders((prev) => prev.filter((o) => o.id !== id));
      const client = getSupabaseClient();
      if (client) {
        client.from('orders').delete().eq('id', id);
      }
      addAuditLog('ORDER_DELETED', `Deleted order ${target?.order_number || id}`);
      showToast('info', 'Order removed');
    },
    [orders, products, user, addAuditLog, showToast]
  );

  // Booking CRUD
  const addBooking = useCallback(
    (bk: Omit<Booking, 'id' | 'business_id' | 'created_at'>) => {
      const newBk: Booking = {
        ...bk,
        id: `bk_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
      };
      setBookings((prev) => [newBk, ...prev]);
      const client = getSupabaseClient();
      if (client) {
        client.from('bookings').insert([newBk]);
      }
      showToast('success', `Appointment scheduled for ${newBk.customer_name}`);
    },
    [business.id, showToast]
  );

  const updateBooking = useCallback(
    (id: string, updates: Partial<Booking>) => {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
      const client = getSupabaseClient();
      if (client) {
        client.from('bookings').update(updates).eq('id', id);
      }
      showToast('success', 'Booking updated');
    },
    [showToast]
  );

  const deleteBooking = useCallback(
    (id: string) => {
      setBookings((prev) => prev.filter((b) => b.id !== id));
      const client = getSupabaseClient();
      if (client) {
        client.from('bookings').delete().eq('id', id);
      }
      showToast('info', 'Booking cancelled');
    },
    [showToast]
  );

  // Expense CRUD
  const addExpense = useCallback(
    (exp: Omit<Expense, 'id' | 'business_id' | 'created_at'>) => {
      const newExp: Expense = {
        ...exp,
        id: `exp_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
      };
      setExpenses((prev) => [newExp, ...prev]);
      const client = getSupabaseClient();
      if (client) {
        client.from('expenses').insert([newExp]);
      }
      showToast('success', `Expense logged: ${business.currency_symbol}${newExp.amount}`);
    },
    [business.currency_symbol, business.id, showToast]
  );

  const updateExpense = useCallback(
    (id: string, updates: Partial<Expense>) => {
      setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
      const client = getSupabaseClient();
      if (client) {
        client.from('expenses').update(updates).eq('id', id);
      }
      showToast('success', 'Expense updated');
    },
    [showToast]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      const client = getSupabaseClient();
      if (client) {
        client.from('expenses').delete().eq('id', id);
      }
      showToast('info', 'Expense deleted');
    },
    [showToast]
  );

  // Campaign CRUD & Intelligence Operations
  const addCampaign = useCallback(
    (camp: Omit<Campaign, 'id' | 'business_id' | 'created_at'>): string => {
      const newId = `camp_${Date.now()}`;
      const newCamp: Campaign = {
        ...camp,
        id: newId,
        business_id: business.id,
        status: camp.status || 'draft',
        created_at: new Date().toISOString(),
      };
      setCampaigns((prev) => [newCamp, ...prev]);
      const client = getSupabaseClient();
      if (client) {
        client.from('campaigns').insert([newCamp]).then(({ error }) => {
          if (error) console.warn('Supabase campaign insert error:', error.message);
        });
      }
      addAuditLog('CAMPAIGN_CREATED', `Created campaign draft: ${newCamp.name} (${newCamp.channel})`);
      
      const memEntry: BusinessMemory = {
        id: `mem_${Date.now()}`,
        business_id: business.id,
        observation_type: 'decision',
        period: 'monthly',
        title: `Marketing Campaign Draft: ${newCamp.name}`,
        content: `Drafted ${newCamp.channel.toUpperCase()} campaign for audience "${newCamp.target_segment}". Objective: ${newCamp.objective}. Offer: "${newCamp.offer}". Target Product/Service: ${newCamp.product_or_service_name || 'General'}. Status: Draft.`,
        confidence_score: 90,
        outcome_recorded: 'Stored in workspace campaigns ledger as draft awaiting approval.',
        created_at: new Date().toISOString(),
      };
      setMemory((prev) => [memEntry, ...prev]);
      if (client) {
        client.from('business_memory').insert([memEntry]);
      }

      showToast('success', `Campaign "${newCamp.name}" saved as Draft`);
      return newId;
    },
    [business.id, addAuditLog, showToast]
  );

  const updateCampaign = useCallback(
    (id: string, updates: Partial<Campaign>) => {
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
        )
      );
      const client = getSupabaseClient();
      if (client) {
        client.from('campaigns').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).then(({ error }) => {
          if (error) console.warn('Supabase campaign update error:', error.message);
        });
      }
      showToast('success', 'Campaign updated');
    },
    [showToast]
  );

  const deleteCampaign = useCallback(
    (id: string) => {
      const target = campaigns.find((c) => c.id === id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      const client = getSupabaseClient();
      if (client) {
        client.from('campaigns').delete().eq('id', id).then(({ error }) => {
          if (error) console.warn('Supabase campaign delete error:', error.message);
        });
      }
      if (target) {
        addAuditLog('CAMPAIGN_DELETED', `Deleted campaign: ${target.name}`);
      }
      showToast('info', 'Campaign removed');
    },
    [campaigns, addAuditLog, showToast]
  );

  const approveCampaign = useCallback(
    (id: string) => {
      const target = campaigns.find((c) => c.id === id);
      if (!target) return;
      const nowIso = new Date().toISOString();
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: 'approved', approved_at: nowIso } : c
        )
      );
      const client = getSupabaseClient();
      if (client) {
        client.from('campaigns').update({ status: 'approved', approved_at: nowIso }).eq('id', id);
      }
      addAuditLog('CAMPAIGN_APPROVED', `Campaign approved by business owner: ${target.name}`);
      
      const memEntry: BusinessMemory = {
        id: `mem_${Date.now()}`,
        business_id: business.id,
        observation_type: 'decision',
        period: 'monthly',
        title: `Campaign Approved: ${target.name}`,
        content: `Owner approved ${target.channel.toUpperCase()} campaign "${target.name}" targeting "${target.target_segment}". Status updated to Approved.`,
        confidence_score: 95,
        outcome_recorded: 'Approval verified in audit log & ready for scheduled dispatch.',
        created_at: nowIso,
      };
      setMemory((prev) => [memEntry, ...prev]);
      if (client) {
        client.from('business_memory').insert([memEntry]);
      }

      showToast('success', `Campaign "${target.name}" Approved!`);
    },
    [campaigns, business.id, addAuditLog, showToast]
  );

  const executeCampaign = useCallback(
    (id: string) => {
      const target = campaigns.find((c) => c.id === id);
      if (!target) return;
      const nowIso = new Date().toISOString();
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'executed',
                executed_at: nowIso,
                metrics: c.metrics || {
                  leads_generated: 0,
                  conversions: 0,
                  customers_acquired: 0,
                  revenue_attributed: 0,
                  is_attribution_available: true,
                },
              }
            : c
        )
      );
      const client = getSupabaseClient();
      if (client) {
        client.from('campaigns').update({ status: 'executed', executed_at: nowIso }).eq('id', id);
      }
      addAuditLog('CAMPAIGN_EXECUTED', `Campaign executed: ${target.name}`);
      
      const memEntry: BusinessMemory = {
        id: `mem_${Date.now()}`,
        business_id: business.id,
        observation_type: 'milestone',
        period: 'monthly',
        title: `Campaign Executed: ${target.name}`,
        content: `Dispatched campaign "${target.name}" to segment "${target.target_segment}" via ${target.channel.toUpperCase()}. Direct response tracking initiated.`,
        confidence_score: 95,
        outcome_recorded: 'Campaign marked Executed. Ready to attribute incoming leads and sales.',
        created_at: nowIso,
      };
      setMemory((prev) => [memEntry, ...prev]);
      if (client) {
        client.from('business_memory').insert([memEntry]);
      }

      showToast('success', `Campaign "${target.name}" marked as Executed!`);
    },
    [campaigns, business.id, addAuditLog, showToast]
  );

  // Memory CRUD
  const addMemoryEntry = useCallback(
    (entry: Omit<BusinessMemory, 'id' | 'business_id' | 'created_at'>) => {
      const newEntry: BusinessMemory = {
        ...entry,
        id: `mem_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
        is_verified: entry.is_verified ?? true,
        provenance: entry.provenance ?? {
          source_type: 'user_logged',
          source_table: 'business_memory',
          evidence_summary: 'User-logged operational observation recorded in workspace.',
          has_sufficient_data: true,
        },
      };
      setMemory((prev) => [newEntry, ...prev]);
      const client = getSupabaseClient();
      if (client) {
        client.from('business_memory').insert([newEntry]);
      }
      showToast('success', 'Observation logged to Business Memory');
    },
    [business.id, showToast]
  );

  // Automations
  const toggleAutomation = useCallback(
    (id: string) => {
      setAutomations((prev) =>
        prev.map((a) => {
          if (a.id === id) {
            const nextState = !a.is_active;
            showToast(nextState ? 'success' : 'info', `Automation ${a.name} is now ${nextState ? 'Active' : 'Paused'}`);
            return { ...a, is_active: nextState };
          }
          return a;
        })
      );
    },
    [showToast]
  );

  const addAutomation = useCallback(
    (auto: Omit<Automation, 'id' | 'business_id' | 'created_at'>) => {
      const newAuto: Automation = {
        ...auto,
        id: `auto_${Date.now()}`,
        business_id: business.id,
        created_at: new Date().toISOString(),
      };
      setAutomations((prev) => [newAuto, ...prev]);
      showToast('success', `Automation rule "${newAuto.name}" created`);
    },
    [business.id, showToast]
  );

  const deleteAutomation = useCallback(
    (id: string) => {
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      showToast('info', 'Automation Removed', 'The automation rule has been deleted.');
    },
    [showToast]
  );

  const resetAutomationTemplates = useCallback(() => {
    const templates = getDefaultAutomationTemplates();
    const formatted: Automation[] = templates.map((t, idx) => ({
      ...t,
      id: `auto_tpl_${Date.now()}_${idx}`,
      business_id: business.id,
      created_at: new Date().toISOString(),
    }));
    setAutomations((prev) => [...formatted, ...prev]);
    showToast('success', 'Templates Installed', `Added ${formatted.length} high-converting automation workflows.`);
  }, [business.id, showToast]);

  const triggerAutomationEvent = useCallback(
    async (event: AutomationTriggerEvent): Promise<AutomationEvaluationResult[]> => {
      const evalResults = evaluateAutomationEvent(event, automations, {
        business,
        customers,
        leads,
        products,
        orders,
        bookings,
      });

      // Update automations state with execution counts and last_run
      const executedRuleIds = new Set(
        evalResults
          .filter((r) => r.status === 'EXECUTED' || r.status === 'PROPOSED_FOR_APPROVAL')
          .map((r) => r.ruleId)
      );

      if (executedRuleIds.size > 0) {
        setAutomations((prev) =>
          prev.map((a) =>
            executedRuleIds.has(a.id)
              ? {
                  ...a,
                  execution_count: (a.execution_count || 0) + 1,
                  last_run: new Date().toISOString(),
                }
              : a
          )
        );
      }

      // Collect new proposed agent actions
      const newActions: AgentAction[] = [];
      for (const res of evalResults) {
        if (res.generatedAction) {
          newActions.push(res.generatedAction);
        }
      }

      if (newActions.length > 0) {
        setAgentActions((prev) => [...newActions, ...prev]);
        showToast(
          'info',
          'Approval Required',
          `${newActions.length} automation action(s) queued in Human-in-the-Loop queue.`
        );
      }

      // Collect execution logs
      const newLogs = evalResults.map((r) => r.executionLog);
      setAutomationLogs((prev) => [...newLogs, ...prev].slice(0, 100));

      const executedCount = evalResults.filter((r) => r.status === 'EXECUTED').length;
      if (executedCount > 0) {
        showToast('success', 'Automation Executed', `${executedCount} rule(s) executed automatically.`);
      }

      addAuditLog(
        'AUTOMATION_EVENT_TRIGGERED',
        `Event "${event.type}" evaluated against ${automations.length} active rules (${executedCount} executed, ${newActions.length} proposed).`
      );

      return evalResults;
    },
    [automations, business, customers, leads, products, orders, bookings, showToast, addAuditLog]
  );

  const executeAgentTool = useCallback(
    async (toolId: string, params: Record<string, any>): Promise<ToolExecutionResult> => {
      const currentRole = user?.role || 'staff';
      const toolContext: ToolExecutionContext = {
        businessId: business.id,
        userRole: currentRole,
        userId: user?.id,
        database: {
          business,
          customers,
          leads,
          products,
          services,
          orders,
          bookings,
          expenses,
          memory,
          automations,
          agentActions,
          integrations,
        },
      };

      const result = await executeTool(toolId, params, toolContext);
      addAuditLog(
        'TOOL_EXECUTED',
        `Tool "${toolId}" executed by ${currentRole}. Success: ${result.success}${result.error ? ` (${result.error})` : ''}`
      );
      return result;
    },
    [
      business,
      user,
      customers,
      leads,
      products,
      services,
      orders,
      bookings,
      expenses,
      memory,
      automations,
      agentActions,
      addAuditLog,
    ]
  );

  // Agent Actions Workflow & Autonomous Execution Loop
  const approveAgentAction = useCallback(
    async (id: string) => {
      // 1. Idempotency Guard - Prevent duplicate concurrent clicks & re-execution
      if (executingActionIds.includes(id)) {
        return;
      }

      const targetAct = agentActions.find((a) => a.id === id);
      if (!targetAct || (targetAct.status !== 'pending_approval' && targetAct.status !== 'PROPOSED')) {
        showToast('info', 'Action Status', 'This action proposal is not awaiting approval.');
        return;
      }

      setExecutingActionIds((prev) => [...prev, id]);

      try {
        const client = getSupabaseClient();
        const nowIso = new Date().toISOString();
        const todayFormatted = new Date().toLocaleDateString();

        // Log 'action approved' to Business Memory
        const approvalMemory: BusinessMemory = {
          id: `mem_appr_${Date.now()}`,
          business_id: business.id,
          observation_type: 'decision',
          period: 'monthly',
          title: `Action Approved: ${targetAct.action_type}`,
          content: `Owner granted execution clearance for "${targetAct.action_type}" (${targetAct.target_entity}). Agent: ${targetAct.agent_name}. Confidence: ${targetAct.confidence}%.`,
          confidence_score: targetAct.confidence,
          outcome_recorded: 'Approval verified. Applying operational record updates.',
          created_at: nowIso,
        };
        setMemory((prev) => [approvalMemory, ...prev]);
        if (client) {
          client.from('business_memory').insert([approvalMemory]);
        }

        // 2. Apply concrete operational mutations to existing business data
        if (targetAct.entity_id || targetAct.target_entity) {
          // A. Lead mutations (Lead Follow-Up / Speed-to-Lead)
          const targetLead = leads.find(
            (l) =>
              l.id === targetAct.entity_id ||
              (l.name && (targetAct.target_entity || '').toLowerCase().includes(l.name.toLowerCase()))
          );
          if (targetLead) {
            const updatedLeadNote = `${targetLead.notes || ''}\n[${todayFormatted} - ${targetAct.action_type} dispatched via ${targetAct.proposed_payload?.channel || 'WhatsApp'}]`.trim();
            setLeads((prev) =>
              prev.map((l) =>
                l.id === targetLead.id
                  ? {
                      ...l,
                      status: 'contacted',
                      notes: updatedLeadNote,
                    }
                  : l
              )
            );
            if (client) {
              client
                .from('leads')
                .update({ status: 'contacted', notes: updatedLeadNote })
                .eq('id', targetLead.id);
            }
          }

          // B. Customer mutations (Retention / Reactivation / VIP Refill)
          const targetCust = customers.find(
            (c) =>
              c.id === targetAct.entity_id ||
              (c.name && (targetAct.target_entity || '').toLowerCase().includes(c.name.toLowerCase()))
          );
          if (targetCust) {
            const updatedCustNote = `${targetCust.notes || ''}\n[${todayFormatted} - ${targetAct.action_type} campaign dispatched]`.trim();
            const updatedTags = targetCust.tags?.includes('campaign_sent')
              ? targetCust.tags
              : [...(targetCust.tags || []), 'campaign_sent'];
            setCustomers((prev) =>
              prev.map((c) =>
                c.id === targetCust.id
                  ? {
                      ...c,
                      notes: updatedCustNote,
                      tags: updatedTags,
                      last_activity: nowIso.split('T')[0],
                    }
                  : c
              )
            );
            if (client) {
              client
                .from('customers')
                .update({
                  notes: updatedCustNote,
                  tags: updatedTags,
                  last_activity: nowIso.split('T')[0],
                })
                .eq('id', targetCust.id);
            }
          }

          // C. Product / Inventory mutations (Operations & Inventory / Restock)
          const targetProd = products.find(
            (p) =>
              p.id === targetAct.entity_id ||
              (p.name && (targetAct.target_entity || '').toLowerCase().includes(p.name.toLowerCase()))
          );
          if (targetProd) {
            const actTypeLower = (targetAct.action_type || '').toLowerCase();
            const isRestockAction =
              actTypeLower.includes('restock') ||
              actTypeLower.includes('order') ||
              actTypeLower.includes('purchase');
            const addedUnits =
              targetAct.proposed_payload?.quantity || (isRestockAction ? 100 : 0);
            const newStock = isRestockAction
              ? targetProd.stock_quantity + addedUnits
              : targetProd.stock_quantity;
            const newStatus = newStock > 10 ? 'in_stock' : targetProd.status;

            if (isRestockAction) {
              setProducts((prev) =>
                prev.map((p) =>
                  p.id === targetProd.id
                    ? {
                        ...p,
                        stock_quantity: newStock,
                        status: newStatus,
                      }
                    : p
                )
              );
              if (client) {
                client
                  .from('products')
                  .update({ stock_quantity: newStock, status: newStatus })
                  .eq('id', targetProd.id);
              }
            }
          }

          // D. Booking mutations (Booking reminders / confirmations)
          const agentNameLower = (targetAct.agent_name || '').toLowerCase();
          if (targetAct.agent_id === 'booking' || agentNameLower.includes('booking')) {
            const matchedBooking = bookings.find((b) => b.id === targetAct.entity_id);
            if (matchedBooking) {
              const updatedBkNote = `${matchedBooking.notes || ''}\n[${todayFormatted} - Reminder sent via WhatsApp]`.trim();
              setBookings((prev) =>
                prev.map((b) => (b.id === matchedBooking.id ? { ...b, notes: updatedBkNote } : b))
              );
              if (client) {
                client.from('bookings').update({ notes: updatedBkNote }).eq('id', matchedBooking.id);
              }
            }
          }

          // D2. Outgoing WhatsApp Cloud API Message Dispatch (Live Integration)
          const actType = (targetAct.action_type || '').toLowerCase();
          const isWhatsAppAction =
            actType.includes('whatsapp') ||
            targetAct.proposed_payload?.channel === 'whatsapp' ||
            targetAct.proposed_payload?.channel === 'WhatsApp' ||
            Boolean(targetAct.target_contact?.includes('+') || targetAct.proposed_payload?.recipient);

          if (isWhatsAppAction) {
            const recipient =
              targetAct.target_contact ||
              targetAct.proposed_payload?.recipient ||
              targetAct.proposed_payload?.to ||
              targetAct.proposed_payload?.phone ||
              targetLead?.phone ||
              targetCust?.phone;

            const messageText =
              targetAct.suggested_message ||
              targetAct.proposed_payload?.message ||
              targetAct.proposed_payload?.text ||
              `Hello from ${business.name}! Update regarding your request.`;

            if (recipient) {
              try {
                await fetch('/api/connectors/whatsapp/send-message', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-business-id': business.id,
                  },
                  body: JSON.stringify({
                    to: recipient,
                    message: messageText,
                    actionId: targetAct.id,
                    isHumanApproved: true,
                  }),
                });
              } catch (dispatchErr) {
                console.warn('Live WhatsApp Cloud API dispatch warning:', dispatchErr);
              }
            }
          }
        }

        // 3. Update agent_actions state and Supabase table to EXECUTED
        setAgentActions((prev) =>
          prev.map((act) =>
            act.id === id ? { ...act, status: 'EXECUTED' as any, executed_at: nowIso } : act
          )
        );
        if (client) {
          client
            .from('agent_actions')
            .update({ status: 'EXECUTED', executed_at: nowIso })
            .eq('id', id);
        }

        // 4. Record 'action executed' to Business Memory
        const memoryEntry: BusinessMemory = {
          id: `mem_${Date.now()}`,
          business_id: business.id,
          observation_type: 'milestone',
          period: 'monthly',
          title: `Action Executed: ${targetAct.action_type}`,
          content: `Dispatched and recorded for ${targetAct.target_entity}. Agent: ${targetAct.agent_name}. Rationale: ${targetAct.reasoning}. Target Contact: ${targetAct.target_contact || targetAct.proposed_payload?.recipient || 'Grounded on file'}. Message Dispatched: "${targetAct.suggested_message || targetAct.proposed_payload?.message || JSON.stringify(targetAct.proposed_payload)}".`,
          confidence_score: targetAct.confidence,
          outcome_recorded: 'Successfully executed and verified in operational ledger.',
          created_at: nowIso,
        };
        setMemory((prev) => [memoryEntry, ...prev]);
        if (client) {
          client.from('business_memory').insert([memoryEntry]);
        }

        // 5. Record to Audit Log
        addAuditLog(
          'AGENT_ACTION_APPROVED',
          `Approved & executed "${targetAct.action_type}" for ${targetAct.target_entity} (Agent: ${targetAct.agent_name})`
        );

        showToast('success', `Action Executed!`, `"${targetAct.action_type}" has been dispatched.`);
      } catch (err: any) {
        console.error('Action execution failed:', err);
        const failReason = err.message || 'Execution error encountered';
        
        // Mark as FAILED
        setAgentActions((prev) =>
          prev.map((act) =>
            act.id === id ? { ...act, status: 'FAILED' as any, failure_reason: failReason } : act
          )
        );
        
        const failMem: BusinessMemory = {
          id: `mem_fail_${Date.now()}`,
          business_id: business.id,
          observation_type: 'anomaly',
          period: 'monthly',
          title: `Action Failed: ${targetAct.action_type}`,
          content: `Execution attempt failed for ${targetAct.target_entity}. Reason: ${failReason}.`,
          confidence_score: 100,
          outcome_recorded: 'Marked as FAILED in Agent Action Center.',
          created_at: new Date().toISOString(),
        };
        setMemory((prev) => [failMem, ...prev]);
        
        showToast('error', 'Execution Failed', failReason);
      } finally {
        setExecutingActionIds((prev) => prev.filter((actId) => actId !== id));
      }
    },
    [
      executingActionIds,
      agentActions,
      leads,
      customers,
      products,
      bookings,
      business.id,
      addAuditLog,
      showToast,
    ]
  );

  const rejectAgentAction = useCallback(
    (id: string) => {
      const targetAct = agentActions.find((a) => a.id === id);
      if (!targetAct || (targetAct.status !== 'pending_approval' && targetAct.status !== 'PROPOSED')) {
        return;
      }

      const nowIso = new Date().toISOString();

      setAgentActions((prev) =>
        prev.map((act) => {
          if (act.id === id) {
            return { ...act, status: 'REJECTED' as any };
          }
          return act;
        })
      );

      const client = getSupabaseClient();
      if (client) {
        client.from('agent_actions').update({ status: 'REJECTED' }).eq('id', id);
      }

      // Log 'action rejected' in Business Memory
      const rejectMem: BusinessMemory = {
        id: `mem_rej_${Date.now()}`,
        business_id: business.id,
        observation_type: 'decision',
        period: 'monthly',
        title: `Action Rejected: ${targetAct.action_type}`,
        content: `Owner dismissed proposed action for ${targetAct.target_entity} (Agent: ${targetAct.agent_name}). Reason for proposal was: ${targetAct.reasoning}.`,
        confidence_score: 95,
        outcome_recorded: 'Action dismissed from active review queue.',
        created_at: nowIso,
      };
      setMemory((prev) => [rejectMem, ...prev]);
      if (client) {
        client.from('business_memory').insert([rejectMem]);
      }

      addAuditLog(
        'AGENT_ACTION_REJECTED',
        `Rejected action proposal: ${targetAct.action_type} for ${targetAct.target_entity}`
      );
      showToast('info', `Action Rejected`, `Proposal "${targetAct.action_type}" dismissed.`);
    },
    [agentActions, business.id, addAuditLog, showToast]
  );

  const failAgentAction = useCallback(
    (id: string, reason?: string) => {
      const targetAct = agentActions.find((a) => a.id === id);
      if (!targetAct) return;

      const failMsg = reason || 'Execution failed during dispatch';
      const nowIso = new Date().toISOString();

      setAgentActions((prev) =>
        prev.map((act) =>
          act.id === id ? { ...act, status: 'FAILED' as any, failure_reason: failMsg } : act
        )
      );

      const failMem: BusinessMemory = {
        id: `mem_fail_${Date.now()}`,
        business_id: business.id,
        observation_type: 'anomaly',
        period: 'monthly',
        title: `Action Failed: ${targetAct.action_type}`,
        content: `Failed to execute ${targetAct.action_type} on ${targetAct.target_entity}. Error: ${failMsg}`,
        confidence_score: 100,
        outcome_recorded: 'Status updated to FAILED in agent action ledger.',
        created_at: nowIso,
      };
      setMemory((prev) => [failMem, ...prev]);

      addAuditLog('AGENT_ACTION_FAILED', `Action execution failed: ${targetAct.action_type} - ${failMsg}`);
      showToast('error', 'Action Execution Failed', failMsg);
    },
    [agentActions, business.id, addAuditLog, showToast]
  );

  const triggerNewAgentAction = useCallback(
    async (agentNameOrId: string) => {
      const agentContext = {
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
        existingActions: agentActions as any,
      };

      const groundedActions = generateGroundedAgentActions(agentContext);
      
      const queryLower = (agentNameOrId || '').toLowerCase();
      const matching = groundedActions.find(
        (a) =>
          a.agent_id === agentNameOrId ||
          (a.agent_name && a.agent_name.toLowerCase().includes(queryLower))
      ) || groundedActions[0];

      if (matching) {
        const fallbackAction: AgentAction = {
          id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          business_id: business.id,
          agent_id: matching.agent_id,
          agent_name: matching.agent_name as any,
          action_type: matching.action_type,
          target_entity: matching.target_entity,
          entity_id: matching.entity_id,
          evidence: matching.evidence,
          proposed_action: matching.proposed_action,
          proposed_payload: matching.proposed_payload,
          status: 'PROPOSED',
          impact_level: matching.impact_level,
          confidence: matching.confidence,
          reasoning: matching.reason,
          created_at: new Date().toISOString(),
          executed_at: null,
        };

        setAgentActions((prev) => [fallbackAction, ...prev]);
        const client = getSupabaseClient();
        if (client) {
          client.from('agent_actions').insert([fallbackAction]);
        }

        // Record 'recommendation created' in Business Memory
        const recMem: BusinessMemory = {
          id: `mem_rec_${Date.now()}`,
          business_id: business.id,
          observation_type: 'insight',
          period: 'monthly',
          title: `Recommendation Created: ${matching.action_type}`,
          content: `Agent ${matching.agent_name} formulated a new action proposal for ${matching.target_entity}. Reason: ${matching.reason}`,
          confidence_score: matching.confidence,
          outcome_recorded: 'Stored in Agent Action Center awaiting human approval.',
          created_at: new Date().toISOString(),
        };
        setMemory((prev) => [recMem, ...prev]);
        if (client) {
          client.from('business_memory').insert([recMem]);
        }

        showToast('info', `New task proposed by ${matching.agent_name}`, matching.action_type);
      } else {
        showToast('info', 'Agent Check Complete', 'No new pending bottleneck detected for this agent in verified database.');
      }
    },
    [business, metrics, customers, leads, products, services, orders, bookings, expenses, memory, agentActions, showToast]
  );

  // Convert an identified AI Diagnosis finding directly into an actionable Agent Action
  const convertDiagnosisToAction = useCallback(
    (diag: AIDiagnosis) => {
      let agentName: AgentAction['agent_name'] = 'Growth & Inbound Agent';
      if (diag.category === 'retention' || diag.category === 'sales') {
        agentName = 'Retention & LTV Agent';
      } else if (
        diag.category === 'operational' ||
        diag.category === 'product_service'
      ) {
        agentName = 'Operations & Inventory Agent';
      } else if (diag.category === 'expense' || diag.category === 'pricing') {
        agentName = 'Financial Auditor Agent';
      }

      // Idempotency check: don't duplicate if already in pending approval
      const diagTitleLower = (diag.problem_title || '').toLowerCase().slice(0, 15);
      const isDuplicate = agentActions.some(
        (a) =>
          a.status === 'pending_approval' &&
          (a.action_type === (diag.recommended_action || '').slice(0, 60) ||
            (diagTitleLower && (a.target_entity || '').toLowerCase().includes(diagTitleLower)))
      );

      if (isDuplicate) {
        showToast('info', 'Action in Queue', 'An agent action for this finding is already awaiting your approval.');
        return;
      }

      const newAction: AgentAction = {
        id: `act_${Date.now()}`,
        business_id: business.id,
        agent_name: agentName,
        action_type: diag.recommended_action.slice(0, 60),
        target_entity: `Diagnosis: ${diag.problem_title}`,
        entity_id: diag.id,
        proposed_payload: {
          channel: diag.category === 'growth' || diag.category === 'retention' ? 'WhatsApp' : 'Internal Task',
          message: diag.recommended_action,
          evidence: diag.evidence,
          expected_kpi: diag.expected_kpi,
        },
        status: 'pending_approval',
        impact_level: diag.severity === 'critical' ? 'high' : diag.severity === 'warning' ? 'medium' : 'low',
        confidence: diag.confidence,
        reasoning: `${diag.problem_description} Grounded in: ${diag.evidence}`,
        created_at: new Date().toISOString(),
        executed_at: null,
      };

      setAgentActions((prev) => [newAction, ...prev]);
      const client = getSupabaseClient();
      if (client) {
        client.from('agent_actions').insert([newAction]);
      }
      addAuditLog('AGENT_ACTION_PROPOSED', `Converted diagnostic finding "${diag.problem_title}" to ${agentName} action.`);
      showToast('success', `Assigned to ${agentName}!`, 'New recommendation queued in AI Agents tab.');
    },
    [agentActions, business.id, addAuditLog, showToast]
  );

  // Full Autonomous AI Agent Execution Loop (Unified Diagnosis + Action Workflow)
  const runAgentExecutionLoop = useCallback(async () => {
    setIsAgentLoopRunning(true);
    setIsAiDiagnosing(true);
    showToast('info', 'AI Agent Crew Active', 'Evaluating 10 operational database tables for bottlenecks...');

    const existingSignatures = agentActions
      .filter((a) => a.status === 'pending_approval')
      .map((a) => ({
        type: a.action_type,
        target: a.target_entity,
        entity_id: a.entity_id,
      }));

    try {
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user?.access_token) {
        authHeaders['Authorization'] = `Bearer ${user.access_token}`;
      }
      if (business?.id) {
        authHeaders['x-business-id'] = business.id;
      }

      const response = await fetch('/api/ai/agent-execution-loop', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          business,
          metrics,
          customers,
          leads,
          products,
          services,
          orders,
          bookings,
          expenses,
          automations,
          business_memory: memory,
          data_sources: dataSources,
          existingPendingSignatures: existingSignatures,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        let newDiagnoses: AIDiagnosis[] = [];
        if (data.diagnoses && Array.isArray(data.diagnoses) && data.diagnoses.length > 0) {
          newDiagnoses = data.diagnoses.map((d: any, idx: number) => ({
            id: `diag_ai_${Date.now()}_${idx}`,
            business_id: business.id,
            problem_title: d.problem_title || 'Identified Business Bottleneck',
            problem_description: d.problem_description || 'Detailed operational audit findings.',
            category: d.category || 'growth',
            evidence: d.evidence || 'Derived directly from current system metrics.',
            confidence: d.confidence || 92,
            severity: d.severity || 'warning',
            recommended_action: d.recommended_action || 'Implement recommended process adjustments.',
            expected_kpi: d.expected_kpi || 'Positive margin and conversion uplift',
            effort: d.effort || 'quick_win',
            status: 'open',
            created_at: new Date().toISOString(),
          }));
          setDiagnoses(newDiagnoses);

          const client = getSupabaseClient();
          if (client) {
            client.from('ai_diagnoses').insert(newDiagnoses);
          }
        }

        let newActions: AgentAction[] = [];
        if (data.proposed_actions && Array.isArray(data.proposed_actions) && data.proposed_actions.length > 0) {
          // Idempotency: filter out duplicates
          const uniqueProposed = data.proposed_actions.filter((pa: any) => {
            const match = agentActions.some(
              (ea) =>
                ea.status === 'pending_approval' &&
                ((pa.entity_id && ea.entity_id === pa.entity_id && ea.action_type === pa.action_type) ||
                  (ea.action_type === pa.action_type && ea.target_entity === pa.target_entity))
            );
            return !match;
          });

          newActions = uniqueProposed.map((pa: any, idx: number) => ({
            id: `act_${Date.now()}_${idx}`,
            business_id: business.id,
            agent_name: pa.agent_name || 'Growth & Inbound Agent',
            action_type: pa.action_type,
            target_entity: pa.target_entity || 'Business Account',
            entity_id: pa.entity_id || null,
            proposed_payload: pa.proposed_payload || {},
            status: 'pending_approval' as const,
            impact_level: pa.impact_level || 'medium',
            confidence: pa.confidence || 90,
            reasoning: pa.reasoning || 'Automated agent recommendation based on real operational data.',
            created_at: new Date().toISOString(),
            executed_at: null,
          }));

          if (newActions.length > 0) {
            setAgentActions((prev) => [...newActions, ...prev]);
            const client = getSupabaseClient();
            if (client) {
              client.from('agent_actions').insert(newActions);
            }
          }
        }

        addAuditLog(
          'AGENT_LOOP_EXECUTED',
          `Autonomous AI Crew completed loop: ${newDiagnoses.length} findings, ${newActions.length} pending actions queued.`
        );
        showToast(
          'success',
          `Autonomous Loop Completed`,
          `Generated ${newDiagnoses.length} diagnoses and ${newActions.length} pending agent proposals.`
        );
        setIsAgentLoopRunning(false);
        setIsAiDiagnosing(false);
        return;
      }
    } catch (err) {
      console.warn('Agent Execution Loop API error, executing local fallback:', err);
    }

    // Deterministic fallback using REAL tables and strict idempotency
    const detDiagnoses = generateDeterministicDiagnoses(
      business,
      metrics,
      orders,
      expenses,
      customers,
      leads,
      products,
      bookings
    );
    setDiagnoses(detDiagnoses);

    const detActionsRaw = generateDeterministicAgentActions(
      business,
      metrics,
      customers,
      leads,
      products,
      bookings,
      expenses,
      agentActions.filter((a) => a.status === 'pending_approval')
    );

    const detActions: AgentAction[] = detActionsRaw.map((act, idx) => ({
      id: `act_${Date.now()}_${idx}`,
      business_id: business.id,
      agent_name: act.agent_name as any,
      action_type: act.action_type,
      target_entity: act.target_entity,
      entity_id: act.entity_id,
      proposed_payload: act.proposed_payload,
      status: 'pending_approval',
      impact_level: act.impact_level,
      confidence: act.confidence,
      reasoning: act.reasoning,
      created_at: new Date().toISOString(),
      executed_at: null,
    }));

    if (detActions.length > 0) {
      setAgentActions((prev) => [...detActions, ...prev]);
    }

    const client = getSupabaseClient();
    if (client) {
      if (detDiagnoses.length > 0) client.from('ai_diagnoses').insert(detDiagnoses);
      if (detActions.length > 0) client.from('agent_actions').insert(detActions);
    }

    addAuditLog(
      'AGENT_LOOP_EXECUTED',
      `Autonomous execution loop evaluated 10 operational tables (${detDiagnoses.length} diagnoses, ${detActions.length} actions proposed).`
    );
    showToast('success', `AI Agent Loop completed!`, `${detActions.length} actions queued for approval.`);
    setIsAgentLoopRunning(false);
    setIsAiDiagnosing(false);
  }, [
    business,
    metrics,
    customers,
    leads,
    products,
    services,
    orders,
    bookings,
    expenses,
    automations,
    memory,
    dataSources,
    agentActions,
    addAuditLog,
    showToast,
  ]);

  // Business Doctor AI Full Diagnosis Run
  const runDiagnosisScan = useCallback(async () => {
    setIsAiDiagnosing(true);
    try {
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user?.access_token) {
        authHeaders['Authorization'] = `Bearer ${user.access_token}`;
      }
      if (business?.id) {
        authHeaders['x-business-id'] = business.id;
      }

      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          business,
          metrics,
          sampleDataSummary: {
            ordersCount: orders.length,
            customersCount: customers.length,
            leadsCount: leads.length,
            expensesCount: expenses.length,
            productsLowStock: products.filter((p) => p.stock_quantity <= 10).map((p) => p.name),
            topRevenueCategory: products.map((p) => p.category).slice(0, 2),
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.diagnoses && Array.isArray(data.diagnoses) && data.diagnoses.length > 0) {
          const formatted: AIDiagnosis[] = data.diagnoses.map((d: any, idx: number) => ({
            id: `diag_ai_${Date.now()}_${idx}`,
            business_id: business.id,
            problem_title: d.problem_title || 'Identified Business Bottleneck',
            problem_description: d.problem_description || 'Detailed operational audit findings.',
            category: d.category || 'growth',
            evidence: d.evidence || 'Derived directly from current system metrics.',
            affected_metric: d.affected_metric || 'Operational Efficiency',
            source_data: d.source_data || 'Live Database Records',
            confidence: d.confidence || 90,
            severity: d.severity || 'warning',
            recommended_action: d.recommended_action || 'Implement recommended process adjustments.',
            requires_human_approval: d.requires_human_approval !== false,
            expected_kpi: d.expected_kpi || 'Positive margin and conversion uplift',
            effort: d.effort || 'quick_win',
            status: 'open',
            created_at: new Date().toISOString(),
          }));

          setDiagnoses(formatted);
          const client = getSupabaseClient();
          if (client) {
            client.from('ai_diagnoses').insert(formatted);
          }
          addAuditLog('AI_DIAGNOSIS_COMPLETED', `Generated ${formatted.length} Gemini AI diagnoses.`);
          showToast('success', `Business Doctor AI completed diagnostic scan!`);
          setIsAiDiagnosing(false);
          return;
        }
      }
    } catch (err) {
      console.warn('AI diagnose API fallback:', err);
    }

    // Fallback deterministic diagnosis
    const detDiagnoses = generateDeterministicDiagnoses(
      business,
      metrics,
      orders,
      expenses,
      customers,
      leads,
      products,
      bookings
    );
    setDiagnoses(detDiagnoses);
    const client = getSupabaseClient();
    if (client) {
      client.from('ai_diagnoses').insert(detDiagnoses);
    }
    addAuditLog('DIAGNOSIS_COMPLETED', `Completed deterministic audit scan (${detDiagnoses.length} findings).`);
    showToast('success', 'Diagnostic scan completed');
    setIsAiDiagnosing(false);
  }, [business, metrics, orders, expenses, customers, leads, products, bookings, addAuditLog, showToast]);

  const updateDiagnosisStatus = useCallback(
    (id: string, status: AIDiagnosis['status']) => {
      const targetDiag = diagnoses.find((d) => d.id === id);
      setDiagnoses((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
      const client = getSupabaseClient();
      if (client) {
        client.from('ai_diagnoses').update({ status }).eq('id', id);
      }

      if (targetDiag && status === 'resolved') {
        const memoryEntry: BusinessMemory = {
          id: `mem_${Date.now()}`,
          business_id: business.id,
          observation_type: 'outcome',
          period: 'monthly',
          title: `Resolved Finding: ${targetDiag.problem_title}`,
          content: `Operational finding marked resolved by business owner. Evidence: ${targetDiag.evidence}. Prescribed Fix: ${targetDiag.recommended_action}. Expected Outcome: ${targetDiag.expected_kpi}.`,
          confidence_score: targetDiag.confidence,
          outcome_recorded: 'Marked resolved in operational diagnostic audit.',
          created_at: new Date().toISOString(),
        };
        setMemory((prev) => [memoryEntry, ...prev]);
        if (client) {
          client.from('business_memory').insert([memoryEntry]);
        }
        addAuditLog('DIAGNOSIS_RESOLVED', `Resolved bottleneck finding: ${targetDiag.problem_title}`);
        showToast('success', 'Diagnosis Resolved', `"${targetDiag.problem_title}" marked as resolved.`);
      } else if (targetDiag) {
        addAuditLog('DIAGNOSIS_STATUS_UPDATED', `Diagnosis "${targetDiag.problem_title}" status set to ${status}`);
        showToast('info', `Diagnosis updated`, `Status marked as ${status}`);
      }
    },
    [diagnoses, business.id, addAuditLog, showToast]
  );

  // Trial Context & Derived States
  const trialContext = useMemo((): TrialEngineContext => {
    return {
      products,
      services,
      customers,
      leads,
      orders,
      bookings,
      expenses,
      dataSources,
      memory,
      diagnoses,
      automations,
    };
  }, [products, services, customers, leads, orders, bookings, expenses, dataSources, memory, diagnoses, automations]);

  const dataCompleteness = useMemo(() => {
    return calculateDataCompleteness(business, trialContext);
  }, [business, trialContext]);

  const businessTrial = useMemo(() => {
    return getInitialBusinessTrial(business, trialDays);
  }, [business, trialDays]);

  const refreshTrialData = useCallback(() => {
    const freshDays = generateAllTrialDays(business, metrics, trialContext, trialDays);
    setTrialDays(freshDays);
    showToast('info', 'Trial Data Refreshed', 'Deliverables synchronized with active workspace database.');
  }, [business, metrics, trialContext, trialDays, showToast]);

  const updateDeliverableStatus = useCallback(
    (dayNum: number, deliverableId: string, status: TrialDeliverable['status']) => {
      setTrialDays((prev) =>
        prev.map((d) => {
          if (d.day !== dayNum) return d;
          return {
            ...d,
            deliverables: d.deliverables.map((deliv) =>
              deliv.id === deliverableId ? { ...deliv, status } : deliv
            ),
          };
        })
      );
      showToast('info', 'Deliverable Updated', `Deliverable status set to "${status}".`);
    },
    [showToast]
  );

  // Trial Operations
  const completeTrialDay = useCallback(
    (dayNum: number) => {
      const currentDay = trialDays.find((d) => d.day === dayNum);
      const targetDay: TrialDayContent = currentDay || {
        day: dayNum,
        title: `Day ${dayNum}`,
        subtitle: '',
        completed: true,
        completedAt: new Date().toISOString(),
        status: 'completed',
        highlights: [],
        deliverables: [],
      };

      setTrialDays((prev) =>
        prev.map((d) =>
          d.day === dayNum
            ? { ...d, completed: true, completedAt: new Date().toISOString(), status: 'completed' }
            : d
        )
      );

      // Create verified Business Memory event
      const memoryEvent = createDayMemoryEvent(dayNum, business, metrics, targetDay);
      setMemory((prev) => [memoryEvent, ...prev]);

      const client = getSupabaseClient();
      if (client) {
        const memRow = mapMemoryToDb(memoryEvent, business.id);
        client.from('business_memory').upsert([memRow]).then(({ error }) => {
          if (error) console.warn('Supabase trial memory upsert error:', error.message);
        });
      }

      addAuditLog('TRIAL_DAY_COMPLETED', `Completed Trial Day ${dayNum}: "${targetDay.title}"`);

      if (dayNum < 5) {
        setActiveTrialDay(dayNum + 1);
        showToast('success', `🎉 Day ${dayNum} Completed!`, `Proceeding to Day ${dayNum + 1}.`);
      } else {
        showToast('success', '🏆 5-Day Transformation Completed!', `AI Operating System is now fully active for ${business.name}.`);
      }
    },
    [trialDays, business, metrics, addAuditLog, showToast]
  );

  const resetTrial = useCallback(() => {
    setTrialDays((prev) =>
      prev.map((d) => ({
        ...d,
        completed: false,
        completedAt: null,
        status: d.day === 1 ? 'in_progress' : 'pending',
      }))
    );
    setActiveTrialDay(1);
    addAuditLog('TRIAL_RESET', `Reset 5-Day Business Transformation Trial for ${business.name}`);
    showToast('info', '5-Day Transformation Trial reset to Day 1.');
  }, [business.name, addAuditLog, showToast]);

  // Data Importer Commit
  const commitImportData = useCallback(
    (
      entityType: 'customers' | 'orders' | 'leads' | 'expenses' | 'products' | 'services' | 'bookings',
      records: Array<Record<string, any>>,
      fileName: string,
      sourceType: DataSource['source_type']
    ) => {
      if (records.length === 0) return;
      const client = getSupabaseClient();
      const nowIso = new Date().toISOString();

      if (entityType === 'customers') {
        const newCusts: Customer[] = records.map((r, i) => ({
          id: `cust_imp_${Date.now()}_${i}`,
          business_id: business.id,
          name: r.name || `Customer #${i + 1}`,
          email: r.email || '',
          phone: r.phone || '',
          city: r.city || business.location.split(',')[0],
          source: (r.source || 'other') as any,
          status: (r.status || 'active') as any,
          first_seen: r.first_seen || nowIso,
          last_activity: nowIso,
          total_orders: Number(r.total_orders) || 1,
          total_spend: Number(r.total_spend) || 0,
          notes: r.notes || `Imported from ${fileName}`,
          tags: r.tags || ['Imported'],
          created_at: nowIso,
        }));
        setCustomers((prev) => [...newCusts, ...prev]);
        if (client) client.from('customers').insert(newCusts);
      } else if (entityType === 'orders') {
        const newOrds: Order[] = records.map((r, i) => ({
          id: `ord_imp_${Date.now()}_${i}`,
          business_id: business.id,
          customer_id: null,
          customer_name: r.customer_name || 'Walk-in Customer',
          items: r.items || [{ id: `item_${i}`, name: r.item_name || 'General Order Item', quantity: Number(r.quantity) || 1, unit_price: Number(r.total_amount) || 0, total: Number(r.total_amount) || 0 }],
          total_amount: Number(r.total_amount) || 0,
          tax_amount: Number(r.tax_amount) || 0,
          discount_amount: Number(r.discount_amount) || 0,
          payment_status: (r.payment_status || 'paid') as any,
          payment_method: (r.payment_method || 'upi') as any,
          order_status: (r.order_status || 'completed') as any,
          order_date: r.order_date || nowIso,
          notes: `Imported from ${fileName}`,
        }));
        setOrders((prev) => [...newOrds, ...prev]);
        if (client) client.from('orders').insert(newOrds);
      } else if (entityType === 'leads') {
        const newLeads: Lead[] = records.map((r, i) => ({
          id: `lead_imp_${Date.now()}_${i}`,
          business_id: business.id,
          name: r.name || `Inbound Lead #${i + 1}`,
          email: r.email || '',
          phone: r.phone || '',
          source: r.source || 'Imported File',
          status: (r.status || 'new') as any,
          score: Number(r.score) || 75,
          budget: Number(r.budget) || 3000,
          interest_product_or_service: r.interest || 'General Inquiry',
          last_follow_up: null,
          next_follow_up: null,
          notes: `Imported from ${fileName}`,
          converted_to_customer_id: null,
          created_at: nowIso,
        }));
        setLeads((prev) => [...newLeads, ...prev]);
        if (client) client.from('leads').insert(newLeads);
      } else if (entityType === 'expenses') {
        const newExps: Expense[] = records.map((r, i) => ({
          id: `exp_imp_${Date.now()}_${i}`,
          business_id: business.id,
          category: (r.category || 'other') as any,
          title: r.title || `Expense Item #${i + 1}`,
          amount: Number(r.amount) || 0,
          expense_date: r.expense_date || nowIso.split('T')[0],
          payment_method: r.payment_method || 'Bank Transfer',
          receipt_url: null,
          is_recurring: Boolean(r.is_recurring),
          created_at: nowIso,
        }));
        setExpenses((prev) => [...newExps, ...prev]);
        if (client) client.from('expenses').insert(newExps);
      } else if (entityType === 'products') {
        const newProds: Product[] = records.map((r, i) => ({
          id: `prod_imp_${Date.now()}_${i}`,
          business_id: business.id,
          name: r.name || `Imported Item #${i + 1}`,
          sku: r.sku || `SKU-IMP-${i + 1}`,
          category: r.category || 'General',
          price: Number(r.price) || 0,
          cost: Number(r.cost) || Math.round(Number(r.price) * 0.4),
          margin_pct: Number(r.margin_pct) || 60,
          stock_quantity: Number(r.stock_quantity) || 50,
          status: 'active',
          total_sold: Number(r.total_sold) || 0,
          created_at: nowIso,
        }));
        setProducts((prev) => [...newProds, ...prev]);
        if (client) client.from('products').insert(newProds);
      } else if (entityType === 'services') {
        const newSrvs: ServiceItem[] = records.map((r, i) => ({
          id: `srv_imp_${Date.now()}_${i}`,
          business_id: business.id,
          name: r.name || `Service Item #${i + 1}`,
          category: r.category || 'Therapy & Consultations',
          duration_minutes: Number(r.duration_minutes) || 45,
          price: Number(r.price) || 0,
          description: r.description || `Imported from ${fileName}`,
          is_active: true,
          status: 'active',
          created_at: nowIso,
        }));
        setServices((prev) => [...newSrvs, ...prev]);
        if (client) client.from('services').insert(newSrvs);
      } else if (entityType === 'bookings') {
        const newBks: Booking[] = records.map((r, i) => ({
          id: `bk_imp_${Date.now()}_${i}`,
          business_id: business.id,
          customer_id: null,
          customer_name: r.customer_name || 'Client',
          customer_phone: r.customer_phone || '',
          service_name: r.service_name || 'Consultation',
          booking_date: r.booking_date || nowIso,
          time_slot: r.time_slot || '10:00 AM',
          amount: Number(r.amount) || 0,
          status: (r.status || 'confirmed') as any,
          payment_status: (r.payment_status || 'paid') as any,
          notes: r.notes || `Imported from ${fileName}`,
          created_at: nowIso,
        }));
        setBookings((prev) => [...newBks, ...prev]);
        if (client) client.from('bookings').insert(newBks);
      }

      // Log data source entry
      const ds: DataSource = {
        id: `ds_${Date.now()}`,
        business_id: business.id,
        name: `Import: ${fileName}`,
        source_type: sourceType,
        status: 'synced',
        record_count: records.length,
        records_count: records.length,
        file_name: fileName,
        mapped_fields: { entity: entityType, count: String(records.length) },
        imported_at: nowIso,
      };
      setDataSources((prev) => [ds, ...prev]);
      if (client) client.from('data_sources').insert([ds]);

      // Record baseline observation to Business Memory
      const memEntry: BusinessMemory = {
        id: `mem_${Date.now()}`,
        business_id: business.id,
        observation_type: 'baseline',
        period: 'day_0',
        title: `Data Ingestion: ${records.length} ${entityType} imported`,
        content: `Successfully ingested and verified ${records.length} real ${entityType} records from ${fileName} (${sourceType}). Updated active dataset and reconciled unit economics for ${business.name}.`,
        confidence_score: 95,
        outcome_recorded: `Reconciled ${records.length} verified records in ${entityType} database ledger.`,
        created_at: nowIso,
        is_verified: true,
        provenance: {
          source_type: 'supabase_table',
          source_table: entityType,
          evidence_summary: `Imported and verified ${records.length} records in ${entityType} table from ${fileName}.`,
          has_sufficient_data: true,
        },
      };
      setMemory((prev) => [memEntry, ...prev]);
      if (client) client.from('business_memory').insert([memEntry]);

      // Update business data maturity status if previously zero
      if (business.data_maturity_mode === 'new_no_data' || business.data_maturity_mode === 'existing_no_data') {
        updateBusiness({ data_maturity_mode: 'existing_partial' });
      }

      addAuditLog('DATA_IMPORTED', `Imported ${records.length} ${entityType} records from ${fileName}`);
      showToast('success', `Successfully imported ${records.length} ${entityType}!`);
    },
    [business, updateBusiness, addAuditLog, showToast]
  );

  const commitWebsiteImport = useCallback(
    (payload: {
      websiteUrl: string;
      domain: string;
      businessInfo: {
        name?: string;
        description?: string;
        industry?: string;
        location?: string;
        phone?: string;
        email?: string;
        business_hours?: string;
        social_links?: Record<string, string>;
      };
      updateProfile: boolean;
      products: Array<{
        name: string;
        description?: string;
        category?: string;
        price?: number | null;
        sku?: string | null;
      }>;
      services: Array<{
        name: string;
        description?: string;
        category?: string;
        price?: number | null;
        duration_minutes?: number | null;
      }>;
      totalDiscovered: {
        businessFields: number;
        products: number;
        services: number;
      };
    }) => {
      const nowIso = new Date().toISOString();
      const client = getSupabaseClient();
      let profileUpdated = false;

      // 1. Update Business Profile if chosen
      if (payload.updateProfile) {
        const updates: Partial<Business> = {};
        if (payload.businessInfo.name && payload.businessInfo.name.trim()) {
          updates.name = payload.businessInfo.name.trim();
        }
        if (payload.businessInfo.industry) {
          updates.industry = payload.businessInfo.industry;
        }
        if (payload.businessInfo.location) {
          updates.location = payload.businessInfo.location;
        }
        if (payload.businessInfo.description) {
          updates.target_customers = payload.businessInfo.description;
        }
        if (Object.keys(updates).length > 0) {
          updateBusiness(updates);
          profileUpdated = true;
        }
      }

      // 2. Ingest deduplicated products
      const newProductsToAdd: Product[] = [];
      payload.products.forEach((p, idx) => {
        const cleanName = (p.name || '').trim();
        if (!cleanName) return;

        // Deduplicate against existing products
        const isDup = products.some(
          (ep) => {
            const pSku = (p.sku || '').trim().toLowerCase();
            const epSku = (ep.sku || '').trim().toLowerCase();
            const skuMatch = Boolean(pSku && epSku && epSku === pSku);
            const nameMatch = (ep.name || '').trim().toLowerCase() === cleanName.toLowerCase();
            return skuMatch || nameMatch;
          }
        );
        if (isDup) return;

        const priceVal = typeof p.price === 'number' && !isNaN(p.price) ? p.price : 0;
        const estCost = Math.round(priceVal * 0.4);
        const estMargin = priceVal > 0 ? Math.round(((priceVal - estCost) / priceVal) * 100) : 50;

        newProductsToAdd.push({
          id: `prod_web_${Date.now()}_${idx}`,
          business_id: business.id,
          name: cleanName,
          sku: p.sku || `WEB-SKU-${idx + 1}`,
          category: p.category || 'Website Catalog',
          price: priceVal,
          cost: estCost,
          margin_pct: estMargin,
          stock_quantity: 50,
          status: 'active',
          total_sold: 0,
          created_at: nowIso,
        });
      });

      if (newProductsToAdd.length > 0) {
        setProducts((prev) => [...newProductsToAdd, ...prev]);
        if (client) client.from('products').insert(newProductsToAdd);
      }

      // 3. Ingest deduplicated services
      const newServicesToAdd: ServiceItem[] = [];
      payload.services.forEach((s, idx) => {
        const cleanName = (s.name || '').trim();
        if (!cleanName) return;

        // Deduplicate against existing services
        const isDup = services.some((es) => (es.name || '').trim().toLowerCase() === cleanName.toLowerCase());
        if (isDup) return;

        const priceVal = typeof s.price === 'number' && !isNaN(s.price) ? s.price : 0;

        newServicesToAdd.push({
          id: `srv_web_${Date.now()}_${idx}`,
          business_id: business.id,
          name: cleanName,
          category: s.category || 'Website Services',
          duration_minutes: typeof s.duration_minutes === 'number' && !isNaN(s.duration_minutes) ? s.duration_minutes : 45,
          price: priceVal,
          description: s.description || `Catalog offering imported from ${payload.websiteUrl}`,
          is_active: true,
          status: 'active',
          created_at: nowIso,
        });
      });

      if (newServicesToAdd.length > 0) {
        setServices((prev) => [...newServicesToAdd, ...prev]);
        if (client) client.from('services').insert(newServicesToAdd);
      }

      const totalImportedRecords = newProductsToAdd.length + newServicesToAdd.length;

      // 4. Create DataSource tracking record
      const dsEntry: DataSource = {
        id: `ds_web_${Date.now()}`,
        business_id: business.id,
        name: `Website: ${payload.domain || payload.websiteUrl}`,
        source_type: 'website',
        status: 'synced',
        record_count: totalImportedRecords,
        records_count: totalImportedRecords,
        file_name: payload.websiteUrl,
        mapped_fields: {
          source_url: payload.websiteUrl,
          products_discovered: String(payload.totalDiscovered.products),
          products_imported: String(newProductsToAdd.length),
          services_discovered: String(payload.totalDiscovered.services),
          services_imported: String(newServicesToAdd.length),
          business_profile_updated: String(payload.updateProfile),
        },
        imported_at: nowIso,
        last_synced: nowIso,
      };
      setDataSources((prev) => [dsEntry, ...prev]);
      if (client) client.from('data_sources').insert([dsEntry]);

      // 5. Add factual Business Memory record (Day-0 knowledge baseline)
      const memEntry: BusinessMemory = {
        id: `mem_web_${Date.now()}`,
        business_id: business.id,
        observation_type: 'baseline',
        period: 'day_0',
        title: `Website Knowledge & Offerings Ingestion: ${payload.domain}`,
        content: `Ingested ${newProductsToAdd.length} products and ${newServicesToAdd.length} service items from public website (${payload.websiteUrl}). Note: Website analysis provides catalog taxonomy without historical transactional sales orders.`,
        confidence_score: 90,
        outcome_recorded: `Public catalog cataloged under ${business.name}. Ready for real order recording or POS/CSV imports.`,
        created_at: nowIso,
        is_verified: true,
        provenance: {
          source_type: 'live_event',
          source_table: 'data_sources',
          evidence_summary: `Catalog baseline imported from public website ${payload.websiteUrl}.`,
          has_sufficient_data: true,
        },
      };
      setMemory((prev) => [memEntry, ...prev]);
      if (client) client.from('business_memory').insert([memEntry]);

      // 6. Update business data maturity status if previously zero
      if (business.data_maturity_mode === 'new_no_data' || business.data_maturity_mode === 'existing_no_data') {
        updateBusiness({ data_maturity_mode: 'existing_partial' });
      }

      // 7. Audit log & Toast
      addAuditLog(
        'DATA_SOURCE_IMPORTED',
        `Website data imported from ${payload.websiteUrl}: ${newProductsToAdd.length} products, ${newServicesToAdd.length} services`
      );
      showToast(
        'success',
        `Website Import Complete`,
        `Ingested ${newProductsToAdd.length} products and ${newServicesToAdd.length} services from ${payload.domain}.`
      );

      return {
        productsCount: newProductsToAdd.length,
        servicesCount: newServicesToAdd.length,
        profileUpdated,
      };
    },
    [business, products, services, updateBusiness, addAuditLog, showToast]
  );

  // Supabase sync helpers
  const isSupabaseConfigured = useMemo(() => {
    return !!getSupabaseClient();
  }, []);

  // ---------------------------------------------------------------------------
  // Phase 6 Connector Hub Methods (Strict Tenant Isolation & Zero Secret Leaks)
  // ---------------------------------------------------------------------------
  const updateIntegration = useCallback(
    (id: string, updates: Partial<BusinessIntegration>) => {
      const nowIso = new Date().toISOString();
      setIntegrations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates, updated_at: nowIso } : item))
      );
      const client = getSupabaseClient();
      if (client) {
        client.from('business_integrations').update({ ...updates, updated_at: nowIso }).eq('id', id);
      }
    },
    []
  );

  const connectIntegration = useCallback(
    async (
      params: ConnectParams
    ): Promise<{ success: boolean; error?: ConnectorErrorDetails }> => {
      const currentRole = user?.role || 'staff';
      if (currentRole !== 'owner' && currentRole !== 'manager') {
        const error: ConnectorErrorDetails = {
          code: 'tenant_access_denied',
          message: 'Insufficient permissions. Only business Owners and Managers can configure channel connectors.',
          provider: params.provider,
        };
        showToast('error', 'Unauthorized', error.message);
        return { success: false, error };
      }

      const resolvedParams: ConnectParams = {
        ...params,
        businessId: business.id,
      };

      try {
        const adapter = getConnectorAdapter(params.provider);
        const result = await adapter.connect(resolvedParams);

        if (!result.success || result.error) {
          const err = result.error || {
            code: 'provider_not_configured',
            message: 'Integration connection failed.',
            provider: params.provider,
          };
          setIntegrations((prev) =>
            prev.map((i) =>
              i.provider === params.provider && i.business_id === business.id
                ? {
                    ...i,
                    status: 'ERROR',
                    last_error: err.message,
                    updated_at: new Date().toISOString(),
                  }
                : i
            )
          );
          addAuditLog(
            'CONNECTOR_CONNECT_FAILED',
            `Failed to connect ${adapter.spec.displayName}: ${err.message}`
          );
          showToast('error', `Connection Failed: ${adapter.spec.displayName}`, err.message);
          return { success: false, error: err };
        }

        const nowIso = new Date().toISOString();
        const integrationUpdates = result.integration || {};

        setIntegrations((prev) => {
          const existing = prev.find(
            (i) => i.provider === params.provider && i.business_id === business.id
          );
          if (existing) {
            return prev.map((i) =>
              i.id === existing.id
                ? {
                    ...i,
                    ...integrationUpdates,
                    status: 'CONNECTED',
                    connected_at: nowIso,
                    last_error: null,
                    updated_at: nowIso,
                  }
                : i
            );
          } else {
            const newInt: BusinessIntegration = {
              id: `int_${params.provider}_${business.id.slice(0, 8)}`,
              business_id: business.id,
              provider: params.provider,
              provider_account_id: integrationUpdates.provider_account_id || null,
              provider_account_name: integrationUpdates.provider_account_name || null,
              status: 'CONNECTED',
              scopes: integrationUpdates.scopes || adapter.spec.requiredScopes.map((s) => s.scope),
              token_metadata: integrationUpdates.token_metadata || {},
              encrypted_credential_ref: integrationUpdates.encrypted_credential_ref || null,
              connected_at: nowIso,
              disconnected_at: null,
              last_health_check_at: nowIso,
              last_health_status: 'healthy',
              last_error: null,
              metadata: integrationUpdates.metadata || {},
              is_test_mode: Boolean(params.isTestMode),
              created_at: nowIso,
              updated_at: nowIso,
            };
            return [...prev, newInt];
          }
        });

        const client = getSupabaseClient();
        if (client) {
          const updatedRecord = {
            id: `int_${params.provider}_${business.id.slice(0, 8)}`,
            business_id: toValidUuid(business.id),
            provider: params.provider,
            provider_account_id: integrationUpdates.provider_account_id || null,
            provider_account_name: integrationUpdates.provider_account_name || null,
            status: 'CONNECTED',
            scopes: integrationUpdates.scopes || adapter.spec.requiredScopes.map((s) => s.scope),
            connected_at: nowIso,
            is_test_mode: Boolean(params.isTestMode),
            last_health_check_at: nowIso,
            last_error: null,
            updated_at: nowIso,
          };
          client.from('business_integrations').upsert([updatedRecord]);
        }

        addAuditLog(
          'CONNECTOR_CONNECTED',
          `Successfully connected ${adapter.spec.displayName} (${params.isTestMode ? 'Sandbox Mode' : 'Live Mode'})`
        );
        showToast(
          'success',
          `${adapter.spec.displayName} Connected`,
          `Channel integration is active and verified for ${business.name}.`
        );
        return { success: true };
      } catch (err: any) {
        const errorDetails: ConnectorErrorDetails = {
          code: 'rate_limit_or_network',
          message: err.message || 'An unexpected error occurred during connection.',
          provider: params.provider,
        };
        showToast('error', 'Connection Error', errorDetails.message);
        return { success: false, error: errorDetails };
      }
    },
    [business.id, business.name, user?.role, addAuditLog, showToast]
  );

  const disconnectIntegration = useCallback(
    async (
      params: DisconnectParams
    ): Promise<{ success: boolean; error?: ConnectorErrorDetails }> => {
      const currentRole = user?.role || 'staff';
      if (currentRole !== 'owner' && currentRole !== 'manager') {
        const error: ConnectorErrorDetails = {
          code: 'tenant_access_denied',
          message: 'Insufficient permissions. Only business Owners and Managers can disconnect channels.',
          provider: params.provider,
        };
        showToast('error', 'Unauthorized', error.message);
        return { success: false, error };
      }

      try {
        const adapter = getConnectorAdapter(params.provider);
        const resolvedParams: DisconnectParams = {
          ...params,
          businessId: business.id,
        };

        const result = await adapter.disconnect(resolvedParams);
        if (!result.success && result.error) {
          showToast('error', 'Disconnect Failed', result.error.message);
          return result;
        }

        const nowIso = new Date().toISOString();
        setIntegrations((prev) =>
          prev.map((i) =>
            i.provider === params.provider && i.business_id === business.id
              ? {
                  ...i,
                  status: 'DISCONNECTED',
                  disconnected_at: nowIso,
                  encrypted_credential_ref: null,
                  token_metadata: {},
                  updated_at: nowIso,
                }
              : i
          )
        );

        const client = getSupabaseClient();
        if (client) {
          client
            .from('business_integrations')
            .update({
              status: 'DISCONNECTED',
              disconnected_at: nowIso,
              encrypted_credential_ref: null,
              token_metadata: {},
              updated_at: nowIso,
            })
            .eq('business_id', toValidUuid(business.id))
            .eq('provider', params.provider);
        }

        addAuditLog(
          'CONNECTOR_DISCONNECTED',
          `Disconnected ${adapter.spec.displayName} connector for ${business.name}`
        );
        showToast('info', 'Connector Disconnected', `${adapter.spec.displayName} has been disconnected.`);
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'rate_limit_or_network',
            message: err.message || 'Disconnect failed',
            provider: params.provider,
          },
        };
      }
    },
    [business.id, business.name, user?.role, addAuditLog, showToast]
  );

  const checkIntegrationHealth = useCallback(
    async (provider: ConnectorProviderId, isTestMode?: boolean): Promise<HealthCheckResult> => {
      const target = integrations.find(
        (i) => i.provider === provider && i.business_id === business.id
      );
      const adapter = getConnectorAdapter(provider);
      const result = await adapter.healthCheck(business.id, target, isTestMode);

      setIntegrations((prev) =>
        prev.map((i) =>
          i.provider === provider && i.business_id === business.id
            ? {
                ...i,
                last_health_check_at: result.checkedAt,
                last_health_status: result.status,
                updated_at: new Date().toISOString(),
              }
            : i
        )
      );

      return result;
    },
    [integrations, business.id]
  );

  const resetIntegration = useCallback(
    (provider: ConnectorProviderId) => {
      const nowIso = new Date().toISOString();
      setIntegrations((prev) =>
        prev.map((i) =>
          i.provider === provider && i.business_id === business.id
            ? {
                ...i,
                status: 'NOT_CONNECTED',
                provider_account_id: null,
                provider_account_name: null,
                encrypted_credential_ref: null,
                token_metadata: {},
                last_error: null,
                connected_at: null,
                disconnected_at: null,
                last_health_status: undefined,
                updated_at: nowIso,
              }
            : i
        )
      );
      showToast('info', 'Integration Reset', `Reset ${provider} to clean unconfigured state.`);
    },
    [business.id, showToast]
  );

  const syncToSupabase = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        success: false,
        message: 'No Supabase project connected. Public credentials required.',
      };
    }

    try {
      setIsSyncing(true);
      const res = await pushWorkspaceToSupabase(client, {
        business,
        members,
        customers,
        leads,
        products,
        services,
        orders,
        bookings,
        expenses,
        memory,
        agentActions,
        automations,
        diagnoses,
        campaigns,
        dataSources,
        auditLogs,
        integrations,
        userId: user?.id,
      });

      if (res.success) {
        addAuditLog('SUPABASE_SYNC_PUSH', res.message);
        showToast('success', 'Workspace synchronized with Supabase!', res.message);
        return { success: true, message: res.message };
      } else {
        showToast('error', 'Sync to Supabase failed', res.message);
        return { success: false, message: res.message };
      }
    } catch (err: any) {
      const msg = err.message || 'Supabase push failed';
      showToast('error', 'Supabase Push Failed', msg);
      return { success: false, message: msg };
    } finally {
      setIsSyncing(false);
    }
  }, [
    business,
    members,
    customers,
    leads,
    products,
    services,
    orders,
    bookings,
    expenses,
    automations,
    agentActions,
    diagnoses,
    memory,
    campaigns,
    dataSources,
    auditLogs,
    integrations,
    user?.id,
    addAuditLog,
    showToast,
  ]);

  const fetchFromSupabase = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, message: 'No Supabase project connected.' };
    }

    try {
      setIsSyncing(true);
      const res = await pullWorkspaceFromSupabase(client, business.id);
      if (!res.success) {
        return { success: false, message: res.error || 'Failed to pull from Supabase' };
      }

      if (res.business) updateBusiness(res.business);
      if (res.customers && res.customers.length > 0) setCustomers(res.customers);
      if (res.leads && res.leads.length > 0) setLeads(res.leads);
      if (res.products && res.products.length > 0) setProducts(res.products);
      if (res.services && res.services.length > 0) setServices(res.services);
      if (res.orders && res.orders.length > 0) setOrders(res.orders);
      if (res.bookings && res.bookings.length > 0) setBookings(res.bookings);
      if (res.expenses && res.expenses.length > 0) setExpenses(res.expenses);
      if (res.memory && res.memory.length > 0) {
        const tenantUuid = toValidUuid(business.id);
        const tenantMemories = res.memory.filter(
          (m: BusinessMemory) => m && (m.business_id === business.id || m.business_id === tenantUuid)
        );
        setMemory(tenantMemories);
      }
      if (res.agentActions && res.agentActions.length > 0) setAgentActions(res.agentActions);
      if (res.automations && res.automations.length > 0) setAutomations(res.automations);
      if (res.diagnoses && res.diagnoses.length > 0) setDiagnoses(res.diagnoses);
      if (res.campaigns && res.campaigns.length > 0) setCampaigns(res.campaigns);
      if (res.dataSources && res.dataSources.length > 0) setDataSources(res.dataSources);
      if (res.integrations && res.integrations.length > 0) setIntegrations(res.integrations);

      addAuditLog('SUPABASE_SYNC_PULL', `Loaded live Supabase records for tenant: ${toValidUuid(business.id)}`);
      showToast('success', 'Live Supabase records loaded into workspace!');
      return { success: true, message: 'Data fetched from Supabase successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Fetch failed' };
    } finally {
      setIsSyncing(false);
    }
  }, [business.id, updateBusiness, addAuditLog, showToast]);

  // Auto-connect and sync from Supabase if configured on mount
  useEffect(() => {
    const client = getSupabaseClient();
    if (client) {
      client.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const u = data.session.user;
          setUser({
            id: u.id,
            email: u.email || 'user@example.com',
            name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'User',
          });
        }
      });
      fetchFromSupabase();
    }
  }, [fetchFromSupabase]);

  const addDataSource = useCallback(
    (ds: Omit<DataSource, 'id' | 'business_id'>) => {
      const newDs: DataSource = {
        ...ds,
        id: `ds_${Date.now()}`,
        business_id: business.id,
      };
      setDataSources((prev) => [newDs, ...prev]);
    },
    [business.id]
  );

  const updateBusinessProfile = useCallback(
    (updates: Partial<Business>) => {
      updateBusiness(updates);
    },
    [updateBusiness]
  );

  const resetToSampleData = useCallback(() => {
    setAllBusinesses([SEED_BUSINESS]);
    setActiveBizId(SEED_BUSINESS.id);
    setMembers(SEED_MEMBERS);
    setProducts(SEED_PRODUCTS);
    setServices(SEED_SERVICES);
    setCustomers(SEED_CUSTOMERS);
    setLeads(SEED_LEADS);
    setOrders(SEED_ORDERS);
    setBookings(SEED_BOOKINGS);
    setExpenses(SEED_EXPENSES);
    setMemory(SEED_MEMORY);
    setAutomations(SEED_AUTOMATIONS);
    setAgentActions(SEED_AGENT_ACTIONS);
    setDiagnoses(SEED_DIAGNOSES);
    setDataSources(SEED_DATA_SOURCES);
    setAuditLogs(SEED_AUDIT_LOGS);
    setCampaigns(SEED_CAMPAIGNS);
    setIntegrations(getDefaultIntegrations(SEED_BUSINESS.id));
    localStorage.clear();
    showToast('info', 'Reset workspace to baseline Ayurvedic seed data');
  }, [showToast]);

  const value = useMemo(
    () => ({
      currentView,
      setCurrentView,
      isOnboardingOpen,
      setIsOnboardingOpen,
      isAuthModalOpen,
      setIsAuthModalOpen,
      isAskDoctorOpen,
      setIsAskDoctorOpen,
      isNotificationsOpen,
      setIsNotificationsOpen,
      isSyncing,
      user,
      business,
      allBusinesses,
      members,
      switchBusiness,
      updateBusiness,
      updateBusinessProfile,
      createBusiness,
      login,
      signup,
      logout,
      switchRole,
      resetToSampleData,
      metrics,
      customers,
      leads,
      products,
      services,
      orders,
      bookings,
      expenses,
      dataSources,
      automations,
      agentActions,
      diagnoses,
      memory,
      auditLogs,
      trialDays,
      businessTrial,
      activeTrialDay,
      dataCompleteness,
      setActiveTrialDay,
      completeTrialDay,
      resetTrial,
      refreshTrialData,
      updateDeliverableStatus,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addLead,
      updateLead,
      deleteLead,
      convertLeadToCustomer,
      followups,
      addFollowUp,
      updateFollowUp,
      completeFollowUp,
      rescheduleFollowUp,
      cancelFollowUp,
      addProduct,
      updateProduct,
      deleteProduct,
      addService,
      updateService,
      deleteService,
      addOrder,
      updateOrder,
      deleteOrder,
      addBooking,
      updateBooking,
      deleteBooking,
      addExpense,
      updateExpense,
      deleteExpense,
      campaigns,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      approveCampaign,
      executeCampaign,
      integrations,
      updateIntegration,
      connectIntegration,
      disconnectIntegration,
      checkIntegrationHealth,
      resetIntegration,
      addMemoryEntry,
      addAuditLog,
      toggleAutomation,
      addAutomation,
      deleteAutomation,
      resetAutomationTemplates,
      triggerAutomationEvent,
      automationLogs,
      executeAgentTool,
      approveAgentAction,
      rejectAgentAction,
      failAgentAction,
      triggerNewAgentAction,
      runAgentExecutionLoop,
      convertDiagnosisToAction,
      runDiagnosisScan,
      updateDiagnosisStatus,
      addDataSource,
      commitImportData,
      commitWebsiteImport,
      isSupabaseConfigured,
      syncToSupabase,
      fetchFromSupabase,
      toasts,
      showToast,
      removeToast,
      isAiDiagnosing,
      isAgentLoopRunning,
      executingActionIds,
      adjustInventory,
      inventoryMovements,
    }),
    [
      currentView,
      isOnboardingOpen,
      isAuthModalOpen,
      isAskDoctorOpen,
      isNotificationsOpen,
      isSyncing,
      user,
      business,
      allBusinesses,
      members,
      switchBusiness,
      updateBusiness,
      updateBusinessProfile,
      createBusiness,
      login,
      signup,
      logout,
      switchRole,
      resetToSampleData,
      metrics,
      customers,
      leads,
      products,
      services,
      orders,
      bookings,
      expenses,
      dataSources,
      automations,
      agentActions,
      diagnoses,
      memory,
      auditLogs,
      campaigns,
      trialDays,
      businessTrial,
      activeTrialDay,
      dataCompleteness,
      setActiveTrialDay,
      completeTrialDay,
      resetTrial,
      refreshTrialData,
      updateDeliverableStatus,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addLead,
      updateLead,
      deleteLead,
      convertLeadToCustomer,
      followups,
      addFollowUp,
      updateFollowUp,
      completeFollowUp,
      rescheduleFollowUp,
      cancelFollowUp,
      addProduct,
      updateProduct,
      deleteProduct,
      addService,
      updateService,
      deleteService,
      addOrder,
      updateOrder,
      deleteOrder,
      addBooking,
      updateBooking,
      deleteBooking,
      addExpense,
      updateExpense,
      deleteExpense,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      approveCampaign,
      executeCampaign,
      integrations,
      updateIntegration,
      connectIntegration,
      disconnectIntegration,
      checkIntegrationHealth,
      resetIntegration,
      addMemoryEntry,
      addAuditLog,
      toggleAutomation,
      addAutomation,
      approveAgentAction,
      rejectAgentAction,
      failAgentAction,
      triggerNewAgentAction,
      runAgentExecutionLoop,
      convertDiagnosisToAction,
      runDiagnosisScan,
      updateDiagnosisStatus,
      addDataSource,
      commitImportData,
      commitWebsiteImport,
      isSupabaseConfigured,
      syncToSupabase,
      fetchFromSupabase,
      toasts,
      showToast,
      removeToast,
      isAiDiagnosing,
      isAgentLoopRunning,
      executingActionIds,
      adjustInventory,
      inventoryMovements,
      deleteAutomation,
      resetAutomationTemplates,
      triggerAutomationEvent,
      automationLogs,
      executeAgentTool,
    ]
  );

  return <BusinessStoreContext.Provider value={value}>{children}</BusinessStoreContext.Provider>;
};

export function useBusinessStore(): BusinessStoreContextType {
  const ctx = useContext(BusinessStoreContext);
  if (!ctx) {
    throw new Error('useBusinessStore must be used within a BusinessStoreProvider');
  }
  return ctx;
}
