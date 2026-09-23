import { UserRole, UserSession } from '../types/database';

export type AppRoute =
  | 'dashboard'
  | 'ai_diagnosis'
  | 'diagnosis'
  | 'trial'
  | 'reports'
  | 'business_memory'
  | 'memory'
  | 'crm'
  | 'crm_overview'
  | 'leads'
  | 'customers'
  | 'followups'
  | 'customer_segments'
  | 'marketing'
  | 'ai_agents'
  | 'agents'
  | 'automations'
  | 'orders'
  | 'bookings'
  | 'products'
  | 'services'
  | 'expenses'
  | 'inventory'
  | 'sales_analytics'
  | 'data'
  | 'integrations'
  | 'connectors'
  | 'business'
  | 'settings';

export type AppAction =
  | 'approve_agent_action'
  | 'reject_agent_action'
  | 'manage_connectors'
  | 'modify_business_settings'
  | 'delete_business'
  | 'manage_members'
  | 'manage_expenses'
  | 'adjust_inventory'
  | 'edit_automations'
  | 'create_customer'
  | 'update_customer'
  | 'delete_customer'
  | 'create_lead'
  | 'update_lead'
  | 'delete_lead'
  | 'convert_lead'
  | 'manage_followups'
  | 'create_order'
  | 'update_order'
  | 'delete_order'
  | 'create_booking'
  | 'update_booking'
  | 'delete_booking'
  | 'create_product'
  | 'update_product'
  | 'delete_product'
  | 'create_service'
  | 'update_service'
  | 'delete_service'
  | 'import_data'
  | 'execute_campaign'
  | 'approve_campaign';

// Route Access Matrix
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  dashboard: ['owner', 'manager', 'staff'],
  ai_diagnosis: ['owner', 'manager'],
  diagnosis: ['owner', 'manager'],
  trial: ['owner', 'manager'],
  reports: ['owner', 'manager'],
  business_memory: ['owner', 'manager'],
  memory: ['owner', 'manager'],
  crm: ['owner', 'manager', 'staff'],
  crm_overview: ['owner', 'manager', 'staff'],
  leads: ['owner', 'manager', 'staff'],
  customers: ['owner', 'manager', 'staff'],
  followups: ['owner', 'manager', 'staff'],
  customer_segments: ['owner', 'manager', 'staff'],
  marketing: ['owner', 'manager'],
  ai_agents: ['owner', 'manager'],
  agents: ['owner', 'manager'],
  automations: ['owner', 'manager'],
  orders: ['owner', 'manager', 'staff'],
  bookings: ['owner', 'manager', 'staff'],
  products: ['owner', 'manager', 'staff'],
  services: ['owner', 'manager', 'staff'],
  expenses: ['owner', 'manager'],
  inventory: ['owner', 'manager', 'staff'],
  sales_analytics: ['owner', 'manager', 'staff'],
  data: ['owner', 'manager'],
  integrations: ['owner', 'manager'],
  connectors: ['owner', 'manager'],
  business: ['owner', 'manager'],
  settings: ['owner'],
};

// Action Authorization Matrix
export const ACTION_PERMISSIONS: Record<AppAction, UserRole[]> = {
  approve_agent_action: ['owner', 'manager'],
  reject_agent_action: ['owner', 'manager'],
  manage_connectors: ['owner', 'manager'],
  modify_business_settings: ['owner'],
  delete_business: ['owner'],
  manage_members: ['owner'],
  manage_expenses: ['owner', 'manager'],
  adjust_inventory: ['owner', 'manager'],
  edit_automations: ['owner', 'manager'],
  create_customer: ['owner', 'manager', 'staff'],
  update_customer: ['owner', 'manager', 'staff'],
  delete_customer: ['owner', 'manager'],
  create_lead: ['owner', 'manager', 'staff'],
  update_lead: ['owner', 'manager', 'staff'],
  delete_lead: ['owner', 'manager'],
  convert_lead: ['owner', 'manager', 'staff'],
  manage_followups: ['owner', 'manager', 'staff'],
  create_order: ['owner', 'manager', 'staff'],
  update_order: ['owner', 'manager', 'staff'],
  delete_order: ['owner', 'manager'],
  create_booking: ['owner', 'manager', 'staff'],
  update_booking: ['owner', 'manager', 'staff'],
  delete_booking: ['owner', 'manager'],
  create_product: ['owner', 'manager'],
  update_product: ['owner', 'manager'],
  delete_product: ['owner'],
  create_service: ['owner', 'manager'],
  update_service: ['owner', 'manager'],
  delete_service: ['owner'],
  import_data: ['owner', 'manager'],
  execute_campaign: ['owner', 'manager'],
  approve_campaign: ['owner', 'manager'],
};

/**
 * Check if a role can access a specific application route.
 */
export function canAccessRoute(role: UserRole, routeKey: string): boolean {
  const allowedRoles = ROUTE_PERMISSIONS[routeKey];
  if (!allowedRoles) {
    // By default, unknown routes require manager or owner
    return role === 'owner' || role === 'manager';
  }
  return allowedRoles.includes(role);
}

/**
 * Check if a role is authorized to perform a specific mutation or action.
 */
export function canPerformAction(role: UserRole, action: AppAction): boolean {
  const allowedRoles = ACTION_PERMISSIONS[action];
  if (!allowedRoles) {
    return role === 'owner';
  }
  return allowedRoles.includes(role);
}

/**
 * Validate a user session for expiration and token integrity.
 */
export function validateSession(session: UserSession | null): {
  isValid: boolean;
  reason?: string;
} {
  if (!session) {
    return { isValid: false, reason: 'No active user session' };
  }

  if (!session.id || !session.email) {
    return { isValid: false, reason: 'Invalid session profile' };
  }

  if (session.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at < now) {
      return { isValid: false, reason: 'Session expired. Please sign in again.' };
    }
  }

  return { isValid: true };
}

/**
 * Role badge styling helper for UI display.
 */
export function getRoleBadgeStyle(role: UserRole): {
  label: string;
  bg: string;
  text: string;
  border: string;
  description: string;
} {
  switch (role) {
    case 'owner':
      return {
        label: 'Owner',
        bg: 'bg-emerald-950/80',
        text: 'text-emerald-300',
        border: 'border-emerald-700/60',
        description: 'Full Administrative, Financial & RLS Control',
      };
    case 'manager':
      return {
        label: 'Manager',
        bg: 'bg-indigo-950/80',
        text: 'text-indigo-300',
        border: 'border-indigo-700/60',
        description: 'Growth, CRM, Marketing & Agent Approvals',
      };
    case 'staff':
      return {
        label: 'Staff',
        bg: 'bg-slate-800',
        text: 'text-slate-300',
        border: 'border-slate-700',
        description: 'Operational Bookings, Orders & Customer Service',
      };
    default:
      return {
        label: 'User',
        bg: 'bg-slate-800',
        text: 'text-slate-300',
        border: 'border-slate-700',
        description: 'Standard Workspace Member',
      };
  }
}
