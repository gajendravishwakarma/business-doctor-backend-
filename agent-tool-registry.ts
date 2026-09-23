import {
  Business,
  Customer,
  Lead,
  Product,
  ServiceItem,
  Order,
  Booking,
  Expense,
  BusinessMemory,
  AgentAction,
  Automation,
  UserRole,
  BusinessIntegration,
} from '../types/database';
import {
  AgentToolDefinition,
  ToolExecutionResult,
  GroundedEvidenceItem,
} from '../types/agents';
import { checkConnectorCapability } from './connectors/registry';
import { ConnectorCapability, ConnectorProviderId } from '../types/connectors';

export interface ToolDatabaseContext {
  business: Business;
  customers: Customer[];
  leads: Lead[];
  products: Product[];
  services: ServiceItem[];
  orders: Order[];
  bookings: Booking[];
  expenses: Expense[];
  memory: BusinessMemory[];
  automations?: Automation[];
  agentActions?: AgentAction[];
  integrations?: BusinessIntegration[];
}

export interface ToolExecutionContext {
  businessId: string;
  userRole?: UserRole;
  userId?: string;
  database: ToolDatabaseContext;
}

export const TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    id: 'crm_search_leads',
    name: 'Search Leads',
    category: 'crm',
    description: 'Searches verified leads by status, score threshold, or search text.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'query', type: 'string', description: 'Search term for name or phone', required: false },
      { name: 'status', type: 'string', description: 'Filter by lead status (e.g. new, contacted, qualified)', required: false },
      { name: 'minScore', type: 'number', description: 'Minimum qualification score (0-100)', required: false },
    ],
  },
  {
    id: 'crm_get_customer_profile',
    name: 'Get Customer Profile',
    category: 'crm',
    description: 'Retrieves verified customer profile with past order history, total spend, and activity dates.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'customerId', type: 'string', description: 'Customer ID', required: true },
    ],
  },
  {
    id: 'crm_update_lead_status',
    name: 'Update Lead Status',
    category: 'crm',
    description: 'Updates the lifecycle status of an inbound lead (Consequential mutation).',
    isConsequential: true,
    requiresApproval: true,
    requiredRole: 'manager',
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'leadId', type: 'string', description: 'Lead ID', required: true },
      { name: 'newStatus', type: 'string', description: 'New status (contacted, qualified, won, lost)', required: true },
      { name: 'notes', type: 'string', description: 'Reason or context for update', required: false },
    ],
  },
  {
    id: 'catalog_search_products',
    name: 'Search Products Catalog',
    category: 'catalog',
    description: 'Searches active products, prices, margins, and stock levels.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'query', type: 'string', description: 'Product name or SKU substring', required: false },
      { name: 'category', type: 'string', description: 'Filter by product category', required: false },
    ],
  },
  {
    id: 'catalog_get_services',
    name: 'Get Services Catalog',
    category: 'catalog',
    description: 'Lists active bookable services with official duration and pricing.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'category', type: 'string', description: 'Filter by category', required: false },
    ],
  },
  {
    id: 'catalog_check_stock',
    name: 'Check Inventory Stock Health',
    category: 'catalog',
    description: 'Evaluates inventory stock levels and identifies low-stock items requiring replenishment.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'threshold', type: 'number', description: 'Low stock cutoff threshold (defaults to 15)', required: false },
    ],
  },
  {
    id: 'booking_check_availability',
    name: 'Check Booking Availability',
    category: 'booking',
    description: 'Verifies calendar availability for a given date and time slot to prevent double-booking.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'date', type: 'string', description: 'Date in YYYY-MM-DD format', required: true },
      { name: 'timeSlot', type: 'string', description: 'Time slot e.g. 10:00 AM - 11:00 AM', required: true },
    ],
  },
  {
    id: 'booking_get_upcoming',
    name: 'Get Upcoming Bookings',
    category: 'booking',
    description: 'Fetches scheduled appointments within a date range for confirmation and reminders.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'startDate', type: 'string', description: 'Start date (YYYY-MM-DD)', required: false },
      { name: 'endDate', type: 'string', description: 'End date (YYYY-MM-DD)', required: false },
    ],
  },
  {
    id: 'analytics_get_revenue_summary',
    name: 'Get Verified Revenue Summary',
    category: 'analytics',
    description: 'Computes total revenue, orders count, and AOV from verified orders table.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
    ],
  },
  {
    id: 'analytics_get_pnl_summary',
    name: 'Get Profit & Loss Summary',
    category: 'analytics',
    description: 'Computes verified revenue, operating expenses, net profit, and margin percentages.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
    ],
  },
  {
    id: 'analytics_get_churn_risk',
    name: 'Get Churn Risk & Inactive Customers',
    category: 'analytics',
    description: 'Identifies customers with no orders or interactions beyond the dormancy threshold.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'dormancyDays', type: 'number', description: 'Inactivity threshold in days (default: 45)', required: false },
    ],
  },
  {
    id: 'memory_get_observations',
    name: 'Get Business Memory Observations',
    category: 'memory',
    description: 'Reads verified historical observations and audit progression records.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'type', type: 'string', description: 'Filter by observation type', required: false },
    ],
  },
  {
    id: 'action_propose_action',
    name: 'Propose Agent Action',
    category: 'action',
    description: 'Enqueues a consequential action into the Human-in-the-Loop approval queue.',
    isConsequential: true,
    requiresApproval: true,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'agentName', type: 'string', description: 'Proposing agent name', required: true },
      { name: 'actionType', type: 'string', description: 'Type of proposed action', required: true },
      { name: 'targetEntity', type: 'string', description: 'Target entity description', required: true },
      { name: 'proposedPayload', type: 'object', description: 'Payload details including message/channel', required: true },
      { name: 'reasoning', type: 'string', description: 'Mathematical or operational rationale', required: true },
      { name: 'confidence', type: 'number', description: 'Confidence score (0-100)', required: true },
    ],
  },
  {
    id: 'action_execute_approved_action',
    name: 'Execute Approved Agent Action',
    category: 'action',
    description: 'Dispatches an action that has ALREADY received human approval (enforces strict HITL gate).',
    isConsequential: true,
    requiresApproval: false,
    requiredRole: 'manager',
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'actionId', type: 'string', description: 'Action ID to execute', required: true },
    ],
  },
  {
    id: 'connector_check_capability',
    name: 'Check Connector Capability',
    category: 'connector',
    description: 'Verifies whether a specific channel connector (WhatsApp, Facebook, Instagram, YouTube, Razorpay) is connected and authorized for a requested capability for the tenant business.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
      { name: 'provider', type: 'string', description: 'Connector provider ID (e.g. whatsapp_business, facebook, instagram, youtube, razorpay)', required: true },
      { name: 'capability', type: 'string', description: 'Capability to verify (e.g. whatsapp_send_messages, whatsapp_customer_support, etc.)', required: true },
    ],
  },
  {
    id: 'connector_list_active',
    name: 'List Active Connectors',
    category: 'connector',
    description: 'Lists all connected integrations, health status, and active channels for the tenant business.',
    isConsequential: false,
    requiresApproval: false,
    parameters: [
      { name: 'businessId', type: 'string', description: 'Tenant Business ID', required: true },
    ],
  },
];

export async function executeTool(
  toolId: string,
  params: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool = TOOL_DEFINITIONS.find((t) => t.id === toolId);
  if (!tool) {
    return {
      toolId,
      success: false,
      error: `Tool "${toolId}" is not registered in the agent tool registry.`,
    };
  }

  // 1. Strict Tenant Isolation Guard
  if (!params.businessId) {
    return {
      toolId,
      success: false,
      error: 'Security Error: businessId parameter is strictly required.',
    };
  }

  if (params.businessId !== context.businessId) {
    return {
      toolId,
      success: false,
      error: `Security Violation: Cross-tenant access denied. Caller businessId "${context.businessId}" does not match target "${params.businessId}".`,
    };
  }

  // 2. Role-Based Access Control Guard
  if (tool.requiredRole && context.userRole) {
    const roleLevels: Record<UserRole, number> = { owner: 3, admin: 3, manager: 2, marketing: 2, staff: 1, viewer: 0 };
    const requiredLevel = roleLevels[tool.requiredRole] || 1;
    const userLevel = roleLevels[context.userRole] || 1;

    if (userLevel < requiredLevel) {
      return {
        toolId,
        success: false,
        error: `Permission Denied: User with role "${context.userRole}" cannot execute consequential tool "${toolId}". Requires "${tool.requiredRole}" or higher.`,
      };
    }
  }

  const { database } = context;

  // 3. Tool Implementation Handlers
  try {
    switch (toolId) {
      case 'crm_search_leads': {
        const query = (params.query || '').toLowerCase().trim();
        const status = params.status;
        const minScore = typeof params.minScore === 'number' ? params.minScore : 0;

        const results = database.leads.filter((l) => {
          if (status && l.status !== status) return false;
          if (l.score < minScore) return false;
          if (query) {
            const nameMatch = l.name.toLowerCase().includes(query);
            const phoneMatch = l.phone && l.phone.includes(query);
            const interestMatch = l.interest_product_or_service?.toLowerCase().includes(query);
            return nameMatch || phoneMatch || interestMatch;
          }
          return true;
        });

        const evidence: GroundedEvidenceItem[] = results.slice(0, 5).map((l) => ({
          table: 'leads',
          recordId: l.id,
          field: 'score',
          value: l.score,
          description: `Lead: ${l.name} (${l.status}) with score ${l.score}`,
        }));

        return {
          toolId,
          success: true,
          data: {
            totalFound: results.length,
            leads: results,
          },
          groundedEvidence: evidence,
          insufficientData: database.leads.length === 0,
          insufficientDataReason: database.leads.length === 0 ? 'No lead records found in database.' : undefined,
        };
      }

      case 'crm_get_customer_profile': {
        const customer = database.customers.find((c) => c.id === params.customerId);
        if (!customer) {
          return {
            toolId,
            success: false,
            error: `Customer not found with ID: ${params.customerId}`,
          };
        }

        const customerOrders = database.orders.filter((o) => o.customer_id === customer.id || o.customer_name === customer.name);

        const evidence: GroundedEvidenceItem[] = [
          {
            table: 'customers',
            recordId: customer.id,
            field: 'total_spend',
            value: customer.total_spend,
            description: `Verified spend: ${database.business.currency_symbol || '₹'}${customer.total_spend}`,
          },
          {
            table: 'customers',
            recordId: customer.id,
            field: 'total_orders',
            value: customer.total_orders,
            description: `Verified orders: ${customer.total_orders}`,
          },
        ];

        return {
          toolId,
          success: true,
          data: {
            customer,
            ordersCount: customerOrders.length,
            orders: customerOrders,
          },
          groundedEvidence: evidence,
        };
      }

      case 'crm_update_lead_status': {
        const lead = database.leads.find((l) => l.id === params.leadId);
        if (!lead) {
          return {
            toolId,
            success: false,
            error: `Lead with ID ${params.leadId} not found.`,
          };
        }

        return {
          toolId,
          success: true,
          data: {
            leadId: lead.id,
            previousStatus: lead.status,
            newStatus: params.newStatus,
            notes: params.notes || '',
            updatedAt: new Date().toISOString(),
          },
          groundedEvidence: [
            {
              table: 'leads',
              recordId: lead.id,
              field: 'status',
              value: params.newStatus,
              description: `Lead status transitioned from ${lead.status} to ${params.newStatus}`,
            },
          ],
        };
      }

      case 'catalog_search_products': {
        const q = (params.query || '').toLowerCase().trim();
        const cat = (params.category || '').toLowerCase().trim();

        const products = database.products.filter((p) => {
          if (cat && (!p.category || !p.category.toLowerCase().includes(cat))) return false;
          if (q) {
            const nameMatch = p.name.toLowerCase().includes(q);
            const skuMatch = p.sku && p.sku.toLowerCase().includes(q);
            return nameMatch || skuMatch;
          }
          return true;
        });

        const evidence: GroundedEvidenceItem[] = products.slice(0, 5).map((p) => ({
          table: 'products',
          recordId: p.id,
          field: 'stock_quantity',
          value: p.stock_quantity,
          description: `Product: ${p.name} (Stock: ${p.stock_quantity}, Price: ${database.business.currency_symbol || '₹'}${p.price})`,
        }));

        return {
          toolId,
          success: true,
          data: {
            totalFound: products.length,
            products,
          },
          groundedEvidence: evidence,
          insufficientData: database.products.length === 0,
          insufficientDataReason: database.products.length === 0 ? 'No products in verified catalog.' : undefined,
        };
      }

      case 'catalog_get_services': {
        const cat = (params.category || '').toLowerCase().trim();
        const services = database.services.filter((s) => {
          if (cat && (!s.category || !s.category.toLowerCase().includes(cat))) return false;
          return s.is_active !== false;
        });

        const evidence: GroundedEvidenceItem[] = services.slice(0, 5).map((s) => ({
          table: 'services',
          recordId: s.id,
          field: 'price',
          value: s.price,
          description: `Service: ${s.name} (Duration: ${s.duration_minutes}m, Price: ${database.business.currency_symbol || '₹'}${s.price})`,
        }));

        return {
          toolId,
          success: true,
          data: {
            totalFound: services.length,
            services,
          },
          groundedEvidence: evidence,
          insufficientData: database.services.length === 0,
          insufficientDataReason: database.services.length === 0 ? 'No services in verified catalog.' : undefined,
        };
      }

      case 'catalog_check_stock': {
        const threshold = typeof params.threshold === 'number' ? params.threshold : 15;
        const lowStock = database.products.filter((p) => p.stock_quantity <= threshold);

        const evidence: GroundedEvidenceItem[] = lowStock.map((p) => ({
          table: 'products',
          recordId: p.id,
          field: 'stock_quantity',
          value: p.stock_quantity,
          description: `Low stock alert: ${p.name} has only ${p.stock_quantity} units remaining (Threshold: ${threshold})`,
        }));

        return {
          toolId,
          success: true,
          data: {
            threshold,
            totalProducts: database.products.length,
            lowStockCount: lowStock.length,
            lowStockProducts: lowStock,
          },
          groundedEvidence: evidence,
          insufficientData: database.products.length === 0,
          insufficientDataReason: database.products.length === 0 ? 'No inventory products recorded.' : undefined,
        };
      }

      case 'booking_check_availability': {
        const date = params.date;
        const timeSlot = params.timeSlot;

        const existing = database.bookings.filter(
          (b) =>
            b.booking_date === date &&
            (b.time_slot === timeSlot || b.booking_time === timeSlot) &&
            b.status !== 'cancelled'
        );

        const isAvailable = existing.length === 0;

        return {
          toolId,
          success: true,
          data: {
            date,
            timeSlot,
            isAvailable,
            conflictingBookingsCount: existing.length,
            conflicts: existing.map((b) => ({
              id: b.id,
              serviceName: b.service_name,
              customerName: b.customer_name,
            })),
          },
          groundedEvidence: existing.map((b) => ({
            table: 'bookings',
            recordId: b.id,
            field: 'status',
            value: b.status,
            description: `Booked slot on ${date} ${timeSlot} for ${b.customer_name}`,
          })),
        };
      }

      case 'booking_get_upcoming': {
        const bookings = database.bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending');

        return {
          toolId,
          success: true,
          data: {
            count: bookings.length,
            bookings,
          },
          groundedEvidence: bookings.slice(0, 5).map((b) => ({
            table: 'bookings',
            recordId: b.id,
            field: 'booking_date',
            value: b.booking_date,
            description: `Upcoming booking on ${b.booking_date} for ${b.customer_name} (${b.service_name})`,
          })),
          insufficientData: database.bookings.length === 0,
          insufficientDataReason: database.bookings.length === 0 ? 'No bookings scheduled.' : undefined,
        };
      }

      case 'analytics_get_revenue_summary': {
        const orders = database.orders;
        if (orders.length === 0) {
          return {
            toolId,
            success: true,
            data: {
              totalRevenue: 0,
              totalOrders: 0,
              averageOrderValue: 0,
              paidOrdersCount: 0,
            },
            insufficientData: true,
            insufficientDataReason: 'Insufficient data: No order records exist in database.',
          };
        }

        const paidOrders = orders.filter((o) => o.payment_status === 'paid');
        const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const aov = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

        return {
          toolId,
          success: true,
          data: {
            totalRevenue,
            totalOrders: orders.length,
            paidOrdersCount: paidOrders.length,
            averageOrderValue: aov,
          },
          groundedEvidence: [
            {
              table: 'orders',
              field: 'total_amount',
              value: totalRevenue,
              description: `Calculated from ${paidOrders.length} verified paid orders`,
            },
          ],
        };
      }

      case 'analytics_get_pnl_summary': {
        const orders = database.orders.filter((o) => o.payment_status === 'paid');
        const expenses = database.expenses;

        const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const netOperatingProfit = totalRevenue - totalExpenses;
        const netMarginPct = totalRevenue > 0 ? Math.round((netOperatingProfit / totalRevenue) * 100) : 0;

        const insufficientRevenue = orders.length === 0;
        const insufficientExpense = expenses.length === 0;

        return {
          toolId,
          success: true,
          data: {
            totalRevenue,
            totalExpenses,
            netOperatingProfit,
            netMarginPct,
            ordersCount: orders.length,
            expensesCount: expenses.length,
          },
          groundedEvidence: [
            {
              table: 'orders',
              field: 'total_amount',
              value: totalRevenue,
              description: `Total revenue: ${database.business.currency_symbol || '₹'}${totalRevenue}`,
            },
            {
              table: 'expenses',
              field: 'amount',
              value: totalExpenses,
              description: `Total expenses: ${database.business.currency_symbol || '₹'}${totalExpenses}`,
            },
          ],
          insufficientData: insufficientRevenue && insufficientExpense,
          insufficientDataReason:
            insufficientRevenue && insufficientExpense
              ? 'Insufficient data: No revenue or expense transactions recorded in database.'
              : undefined,
        };
      }

      case 'analytics_get_churn_risk': {
        const thresholdDays = typeof params.dormancyDays === 'number' ? params.dormancyDays : 45;
        const now = Date.now();

        const dormantCustomers = database.customers.filter((c) => {
          if (!c.last_activity) return true;
          const diffDays = Math.floor((now - new Date(c.last_activity).getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= thresholdDays;
        });

        return {
          toolId,
          success: true,
          data: {
            thresholdDays,
            totalCustomers: database.customers.length,
            dormantCount: dormantCustomers.length,
            dormantCustomers: dormantCustomers.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              totalSpend: c.total_spend,
              lastActivity: c.last_activity,
            })),
          },
          groundedEvidence: dormantCustomers.slice(0, 5).map((c) => ({
            table: 'customers',
            recordId: c.id,
            field: 'last_activity',
            value: c.last_activity,
            description: `Dormant customer ${c.name} with last activity on ${c.last_activity || 'Unknown'}`,
          })),
          insufficientData: database.customers.length === 0,
          insufficientDataReason: database.customers.length === 0 ? 'No customer records in database.' : undefined,
        };
      }

      case 'memory_get_observations': {
        const type = params.type;
        const memory = database.memory.filter((m) => {
          if (type && m.observation_type !== type) return false;
          return true;
        });

        return {
          toolId,
          success: true,
          data: {
            count: memory.length,
            observations: memory,
          },
          groundedEvidence: memory.slice(0, 5).map((m) => ({
            table: 'business_memory',
            recordId: m.id,
            field: 'title',
            value: m.title,
            description: `Memory event: ${m.title} (${m.observation_type})`,
          })),
        };
      }

      case 'action_propose_action': {
        const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const proposedAction: AgentAction = {
          id: actionId,
          business_id: context.businessId,
          agent_name: params.agentName || 'Business Doctor AI',
          action_type: params.actionType,
          target_entity: params.targetEntity,
          entity_id: params.entityId || null,
          proposed_payload: params.proposedPayload || {},
          status: 'PROPOSED',
          impact_level: params.impactLevel || 'medium',
          confidence: params.confidence || 85,
          reasoning: params.reasoning,
          evidence: params.evidence || ['Derived from verified database records'],
          created_at: new Date().toISOString(),
          executed_at: null,
        };

        return {
          toolId,
          success: true,
          data: {
            action: proposedAction,
            status: 'PROPOSED',
            message: 'Action successfully registered in Human-in-the-Loop pending queue.',
          },
        };
      }

      case 'action_execute_approved_action': {
        const actionId = params.actionId;
        const action = database.agentActions?.find((a) => a.id === actionId);

        if (!action) {
          return {
            toolId,
            success: false,
            error: `Action with ID "${actionId}" was not found.`,
          };
        }

        const isApproved = action.status === 'APPROVED' || action.status === 'approved';
        if (!isApproved) {
          return {
            toolId,
            success: false,
            error: `Security Violation: Action must be in 'APPROVED' state before execution. Current state: '${action.status}'. Execution blocked.`,
          };
        }

        return {
          toolId,
          success: true,
          data: {
            actionId,
            status: 'EXECUTED',
            executedAt: new Date().toISOString(),
            executedBy: context.userId || 'system',
            targetEntity: action.target_entity,
            actionType: action.action_type,
          },
        };
      }

      case 'connector_check_capability': {
        const { provider, capability } = params;
        if (!provider || !capability) {
          return {
            toolId,
            success: false,
            error: 'Parameters "provider" and "capability" are required.',
          };
        }

        const integrations = context.database.integrations || [];
        const result = checkConnectorCapability(
          params.businessId,
          provider as ConnectorProviderId,
          capability as ConnectorCapability,
          integrations
        );

        return {
          toolId,
          success: true,
          data: {
            businessId: params.businessId,
            provider,
            capability,
            allowed: result.allowed,
            connectorStatus: result.status,
            reason: result.reason || (result.allowed ? 'Authorized and connected.' : 'Not authorized or disconnected.'),
          },
        };
      }

      case 'connector_list_active': {
        const integrations = context.database.integrations || [];
        const tenantIntegrations = integrations.filter(
          (i) => i.business_id === params.businessId
        );

        const activeConnectors = tenantIntegrations.map((i) => ({
          provider: i.provider,
          status: i.status,
          provider_account_name: i.provider_account_name,
          connected_at: i.connected_at,
          last_health_status: i.last_health_status,
          is_test_mode: Boolean(i.is_test_mode),
        }));

        return {
          toolId,
          success: true,
          data: {
            businessId: params.businessId,
            totalIntegrations: tenantIntegrations.length,
            connectedCount: tenantIntegrations.filter((i) => i.status === 'CONNECTED').length,
            connectors: activeConnectors,
          },
        };
      }

      default:
        return {
          toolId,
          success: false,
          error: `Unhandled tool ID: ${toolId}`,
        };
    }
  } catch (err: any) {
    return {
      toolId,
      success: false,
      error: `Execution error in tool ${toolId}: ${err.message || 'Unknown error'}`,
    };
  }
}
