-- ==============================================================================
-- BUSINESS DOCTOR AI — PRODUCTION POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- Enforces:
-- 1. Strict multi-tenant isolation via business_id.
-- 2. User authentication verification via auth.uid().
-- 3. Role-based access control (owner, manager, staff).
-- 4. RLS enabled on all operational tables:
--    - leads
--    - customers
--    - orders
--    - bookings
--    - products
--    - services
--    - expenses
--    - business_memory
--    - agent_actions
--    - businesses
--    - business_members
--    - automations
--    - ai_diagnoses
--    - data_sources
--    - audit_logs
--    - campaigncampaignss
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. BUSINESSES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    business_type TEXT NOT NULL DEFAULT 'hybrid',
    industry TEXT NOT NULL DEFAULT 'General',
    location TEXT NOT NULL DEFAULT 'India',
    country TEXT NOT NULL DEFAULT 'India',
    currency TEXT NOT NULL DEFAULT 'INR',
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    business_age_stage TEXT NOT NULL DEFAULT 'growing',
    data_maturity_mode TEXT NOT NULL DEFAULT 'existing_partial',
    target_customers TEXT DEFAULT '',
    business_goals JSONB DEFAULT '[]'::jsonb,
    monthly_revenue_target NUMERIC NOT NULL DEFAULT 500000,
    monthly_revenue NUMERIC DEFAULT 0,
    target_gross_margin NUMERIC DEFAULT 60,
    website TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    contact_email TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. BUSINESS MEMBERS TABLE (Multi-Tenant RBAC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_members (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references auth.users(id)
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'admin', 'viewer')),
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, user_id)
);

-- ------------------------------------------------------------------------------
-- RLS HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Function to get the role of the current authenticated user in a business
CREATE OR REPLACE FUNCTION public.get_auth_user_business_role(target_business_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.business_members
    WHERE business_id = target_business_id
      AND user_id = auth.uid()
    LIMIT 1;
$$;

-- Function to verify if the authenticated user is an authorized member of the business with specified roles
CREATE OR REPLACE FUNCTION public.is_authorized_business_member(target_business_id TEXT, required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = target_business_id
          AND user_id = auth.uid()
          AND (required_roles IS NULL OR role = ANY(required_roles))
    );
$$;

-- ------------------------------------------------------------------------------
-- 3. LEADS TABLE (CRM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    source TEXT NOT NULL DEFAULT 'website',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
    score INTEGER NOT NULL DEFAULT 50,
    budget NUMERIC DEFAULT 0,
    interest_product_or_service TEXT DEFAULT '',
    last_follow_up TIMESTAMPTZ,
    next_follow_up TIMESTAMPTZ,
    notes TEXT DEFAULT '',
    converted_to_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. CUSTOMERS TABLE (CRM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    city TEXT DEFAULT '',
    source TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repeat', 'dormant', 'churn_risk', 'vip', 'inactive')),
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_spend NUMERIC NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. ORDERS TABLE (Sales)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'refunded', 'failed')),
    payment_method TEXT NOT NULL DEFAULT 'upi',
    order_status TEXT NOT NULL DEFAULT 'completed' CHECK (order_status IN ('completed', 'processing', 'cancelled')),
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT DEFAULT ''
);

-- ------------------------------------------------------------------------------
-- 6. BOOKINGS TABLE (Appointments / Capacity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT DEFAULT '',
    service_name TEXT NOT NULL,
    booking_date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'pending', 'no_show')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'refunded')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. PRODUCTS TABLE (Inventory / Catalog)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General',
    price NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    margin_pct NUMERIC NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'low_stock', 'out_of_stock', 'discontinued')),
    total_sold INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. SERVICES TABLE (Catalog)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    price NUMERIC NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. EXPENSES TABLE (P&L Financials)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'other',
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    expense_date DATE NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
    receipt_url TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. BUSINESS MEMORY TABLE (Audit & Long-Term Intelligence)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_memory (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    observation_type TEXT NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metric_changes JSONB DEFAULT '{}'::jsonb,
    confidence_score INTEGER NOT NULL DEFAULT 90,
    outcome_recorded TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. AGENT ACTIONS TABLE (AI Autonomous Operating Agents & Human Approval)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_actions (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    agent_id TEXT,
    agent_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    entity_id TEXT,
    evidence TEXT,
    proposed_action TEXT,
    proposed_payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'pending_approval', 'APPROVED', 'approved', 'REJECTED', 'rejected', 'EXECUTED', 'executed', 'FAILED', 'failed')),
    impact_level TEXT NOT NULL DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
    confidence INTEGER NOT NULL DEFAULT 90,
    reasoning TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 12. AUTOMATIONS, DIAGNOSES, DATA SOURCES, CAMPAIGNS, AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automations (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    action_type TEXT NOT NULL,
    conditions JSONB DEFAULT '{}'::jsonb,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_diagnoses (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    problem_title TEXT NOT NULL,
    problem_description TEXT NOT NULL,
    category TEXT NOT NULL,
    evidence TEXT NOT NULL,
    confidence INTEGER NOT NULL DEFAULT 90,
    severity TEXT NOT NULL DEFAULT 'warning',
    recommended_action TEXT NOT NULL,
    expected_kpi TEXT NOT NULL,
    effort TEXT NOT NULL DEFAULT 'quick_win',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_sources (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'synced',
    record_count INTEGER NOT NULL DEFAULT 0,
    records_count INTEGER NOT NULL DEFAULT 0,
    file_name TEXT,
    mapped_fields JSONB DEFAULT '{}'::jsonb,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaigns (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    objective TEXT NOT NULL,
    target_segment TEXT NOT NULL,
    product_or_service_id TEXT,
    product_or_service_name TEXT,
    offer TEXT NOT NULL,
    channel TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    message_content TEXT NOT NULL,
    call_to_action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    metrics JSONB DEFAULT '{}'::jsonb,
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 17. BUSINESS INTEGRATIONS TABLE (Phase 6 Connector Hub Foundation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_integrations (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('whatsapp_business', 'facebook', 'instagram', 'youtube', 'razorpay')),
    provider_account_id TEXT,
    provider_account_name TEXT,
    status TEXT NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (status IN ('NOT_CONNECTED', 'CONNECTING', 'CONNECTED', 'ACTION_REQUIRED', 'EXPIRED', 'ERROR', 'DISCONNECTED')),
    scopes JSONB DEFAULT '[]'::jsonb,
    token_metadata JSONB DEFAULT '{}'::jsonb,
    encrypted_credential_ref TEXT,
    phone_number_id TEXT,
    waba_id TEXT,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    last_health_check_at TIMESTAMPTZ,
    last_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_test_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, provider, is_test_mode)
);

-- ------------------------------------------------------------------------------
-- 18. CONNECTOR WEBHOOK EVENTS TABLE (Phase 6 Step 2: Idempotent Webhook Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connector_webhook_events (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'whatsapp',
    external_message_id TEXT,
    customer_phone TEXT,
    customer_name TEXT,
    message_type TEXT,
    message_payload JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'duplicate', 'ignored', 'failed')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, provider, external_message_id)
);

-- ------------------------------------------------------------------------------
-- 19. CONNECTION ASSISTANCE SESSIONS TABLE (Phase 6 Step 3: Live Connection Assistant)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connection_assistance_sessions (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('whatsapp_business', 'facebook', 'instagram', 'youtube', 'razorpay')),
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed', 'abandoned')),
    current_step_id TEXT NOT NULL DEFAULT 'account_check',
    account_status TEXT NOT NULL DEFAULT 'unknown' CHECK (account_status IN ('has_account', 'needs_account', 'unknown')),
    language TEXT NOT NULL DEFAULT 'hinglish' CHECK (language IN ('en', 'hi', 'hinglish')),
    completed_step_ids JSONB DEFAULT '[]'::jsonb,
    last_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_assistance_sessions ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- RLS POLICIES (VALIDATING auth.uid() AND business_id FOR OWNER, MANAGER, STAFF)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- BUSINESSES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view their businesses" ON public.businesses;
CREATE POLICY "Members can view their businesses"
    ON public.businesses
    FOR SELECT
    USING (
        public.is_authorized_business_member(id, ARRAY['owner', 'manager', 'staff', 'admin', 'viewer'])
    );

DROP POLICY IF EXISTS "Owners can update their business profile" ON public.businesses;
CREATE POLICY "Owners can update their business profile"
    ON public.businesses
    FOR UPDATE
    USING (
        public.is_authorized_business_member(id, ARRAY['owner', 'admin'])
    );

DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;
CREATE POLICY "Authenticated users can create businesses"
    ON public.businesses
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners can delete their business" ON public.businesses;
CREATE POLICY "Owners can delete their business"
    ON public.businesses
    FOR DELETE
    USING (
        public.is_authorized_business_member(id, ARRAY['owner'])
    );

-- ------------------------------------------------------------------------------
-- BUSINESS MEMBERS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view workspace team" ON public.business_members;
CREATE POLICY "Members can view workspace team"
    ON public.business_members
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin', 'viewer'])
    );

DROP POLICY IF EXISTS "Owners can manage workspace members" ON public.business_members;
CREATE POLICY "Owners can manage workspace members"
    ON public.business_members
    FOR ALL
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- LEADS POLICIES (Owner, Manager, Staff)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view leads" ON public.leads;
CREATE POLICY "Authorized members can view leads"
    ON public.leads
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can insert leads" ON public.leads;
CREATE POLICY "Authorized members can insert leads"
    ON public.leads
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can update leads" ON public.leads;
CREATE POLICY "Authorized members can update leads"
    ON public.leads
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can delete leads" ON public.leads;
CREATE POLICY "Owners and managers can delete leads"
    ON public.leads
    FOR DELETE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- CUSTOMERS POLICIES (Owner, Manager, Staff)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view customers" ON public.customers;
CREATE POLICY "Authorized members can view customers"
    ON public.customers
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can insert customers" ON public.customers;
CREATE POLICY "Authorized members can insert customers"
    ON public.customers
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can update customers" ON public.customers;
CREATE POLICY "Authorized members can update customers"
    ON public.customers
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can delete customers" ON public.customers;
CREATE POLICY "Owners and managers can delete customers"
    ON public.customers
    FOR DELETE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- ORDERS POLICIES (Owner, Manager, Staff)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view orders" ON public.orders;
CREATE POLICY "Authorized members can view orders"
    ON public.orders
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can insert orders" ON public.orders;
CREATE POLICY "Authorized members can insert orders"
    ON public.orders
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can update orders" ON public.orders;
CREATE POLICY "Authorized members can update orders"
    ON public.orders
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can delete orders" ON public.orders;
CREATE POLICY "Owners and managers can delete orders"
    ON public.orders
    FOR DELETE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- BOOKINGS POLICIES (Owner, Manager, Staff)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view bookings" ON public.bookings;
CREATE POLICY "Authorized members can view bookings"
    ON public.bookings
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can insert bookings" ON public.bookings;
CREATE POLICY "Authorized members can insert bookings"
    ON public.bookings
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can update bookings" ON public.bookings;
CREATE POLICY "Authorized members can update bookings"
    ON public.bookings
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can delete bookings" ON public.bookings;
CREATE POLICY "Owners and managers can delete bookings"
    ON public.bookings
    FOR DELETE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- PRODUCTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view products" ON public.products;
CREATE POLICY "Authorized members can view products"
    ON public.products
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can insert products" ON public.products;
CREATE POLICY "Owners and managers can insert products"
    ON public.products
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can update products" ON public.products;
CREATE POLICY "Owners and managers can update products"
    ON public.products
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners can delete products" ON public.products;
CREATE POLICY "Owners can delete products"
    ON public.products
    FOR DELETE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- SERVICES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view services" ON public.services;
CREATE POLICY "Authorized members can view services"
    ON public.services
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can insert services" ON public.services;
CREATE POLICY "Owners and managers can insert services"
    ON public.services
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can update services" ON public.services;
CREATE POLICY "Owners and managers can update services"
    ON public.services
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners can delete services" ON public.services;
CREATE POLICY "Owners can delete services"
    ON public.services
    FOR DELETE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- EXPENSES POLICIES (Restricted to Owner and Manager)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners and managers can view expenses" ON public.expenses;
CREATE POLICY "Owners and managers can view expenses"
    ON public.expenses
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can insert expenses" ON public.expenses;
CREATE POLICY "Owners and managers can insert expenses"
    ON public.expenses
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can update expenses" ON public.expenses;
CREATE POLICY "Owners and managers can update expenses"
    ON public.expenses
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners can delete expenses" ON public.expenses;
CREATE POLICY "Owners can delete expenses"
    ON public.expenses
    FOR DELETE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- BUSINESS MEMORY POLICIES (Immutable Audit & Intelligence Ledger)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners and managers can view business memory" ON public.business_memory;
CREATE POLICY "Owners and managers can view business memory"
    ON public.business_memory
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can append business memory" ON public.business_memory;
CREATE POLICY "Authorized members can append business memory"
    ON public.business_memory
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- AGENT ACTIONS POLICIES (Human-in-the-Loop Approval & Execution Gating)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view agent actions" ON public.agent_actions;
CREATE POLICY "Authorized members can view agent actions"
    ON public.agent_actions
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can propose agent actions" ON public.agent_actions;
CREATE POLICY "Authorized members can propose agent actions"
    ON public.agent_actions
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can approve or execute agent actions" ON public.agent_actions;
CREATE POLICY "Owners and managers can approve or execute agent actions"
    ON public.agent_actions
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners can delete agent actions" ON public.agent_actions;
CREATE POLICY "Owners can delete agent actions"
    ON public.agent_actions
    FOR DELETE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- AUTOMATIONS, DIAGNOSES, DATA SOURCES, CAMPAIGNS, AUDIT LOGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners and managers can manage automations" ON public.automations;
CREATE POLICY "Owners and managers can manage automations"
    ON public.automations
    FOR ALL
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can manage diagnoses" ON public.ai_diagnoses;
CREATE POLICY "Owners and managers can manage diagnoses"
    ON public.ai_diagnoses
    FOR ALL
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can manage data sources" ON public.data_sources;
CREATE POLICY "Owners and managers can manage data sources"
    ON public.data_sources
    FOR ALL
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can manage campaigns" ON public.campaigns;
CREATE POLICY "Owners and managers can manage campaigns"
    ON public.campaigns
    FOR ALL
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Members can view audit logs" ON public.audit_logs;
CREATE POLICY "Members can view audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Members can append audit logs" ON public.audit_logs;
CREATE POLICY "Members can append audit logs"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can view business integrations" ON public.business_integrations;
CREATE POLICY "Authorized members can view business integrations"
    ON public.business_integrations
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can manage business integrations" ON public.business_integrations;
CREATE POLICY "Owners and managers can manage business integrations"
    ON public.business_integrations
    FOR ALL
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- CONNECTOR WEBHOOK EVENTS POLICIES (Phase 6 Step 2 Multi-Tenant Inbound Webhooks)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view webhook events" ON public.connector_webhook_events;
CREATE POLICY "Authorized members can view webhook events"
    ON public.connector_webhook_events
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members and service role can insert webhook events" ON public.connector_webhook_events;
CREATE POLICY "Authorized members and service role can insert webhook events"
    ON public.connector_webhook_events
    FOR INSERT
    WITH CHECK (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

DROP POLICY IF EXISTS "Owners and managers can update webhook events" ON public.connector_webhook_events;
CREATE POLICY "Owners and managers can update webhook events"
    ON public.connector_webhook_events
    FOR UPDATE
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

-- ------------------------------------------------------------------------------
-- CONNECTION ASSISTANCE SESSIONS POLICIES (Phase 6 Step 3 Live Connection Assistant)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized members can view assistance sessions" ON public.connection_assistance_sessions;
CREATE POLICY "Authorized members can view assistance sessions"
    ON public.connection_assistance_sessions
    FOR SELECT
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'staff', 'admin'])
    );

DROP POLICY IF EXISTS "Authorized members can manage assistance sessions" ON public.connection_assistance_sessions;
CREATE POLICY "Authorized members can manage assistance sessions"
    ON public.connection_assistance_sessions
    FOR ALL
    USING (
        public.is_authorized_business_member(business_id, ARRAY['owner', 'manager', 'admin'])
    );

-- ==============================================================================
-- PERFORMANCE INDEXES (FOR TENANT ISOLATION & QUERY OPTIMIZATION)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_business_members_lookup ON public.business_members(business_id, user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON public.leads(business_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON public.leads(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_status ON public.customers(business_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_last_activity ON public.customers(business_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_date ON public.orders(business_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON public.orders(business_id, payment_status, order_status);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_date ON public.bookings(business_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status ON public.bookings(business_id, status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON public.products(business_id, status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_stock ON public.products(business_id, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_services_tenant_status ON public.services(business_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON public.expenses(business_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_business_memory_tenant ON public.business_memory(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_tenant_status ON public.agent_actions(business_id, status);
CREATE INDEX IF NOT EXISTS idx_automations_tenant_active ON public.automations(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_tenant_status ON public.ai_diagnoses(business_id, status);
CREATE INDEX IF NOT EXISTS idx_data_sources_tenant ON public.data_sources(business_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON public.campaigns(business_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_integrations_tenant ON public.business_integrations(business_id, provider);
CREATE INDEX IF NOT EXISTS idx_business_integrations_status ON public.business_integrations(business_id, status);
CREATE INDEX IF NOT EXISTS idx_business_integrations_phone_lookup ON public.business_integrations(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_business_integrations_waba_lookup ON public.business_integrations(waba_id);
CREATE INDEX IF NOT EXISTS idx_connector_webhook_events_tenant ON public.connector_webhook_events(business_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_connector_webhook_events_lookup ON public.connector_webhook_events(business_id, provider, external_message_id);
CREATE INDEX IF NOT EXISTS idx_assistance_sessions_tenant ON public.connection_assistance_sessions(business_id, provider);
CREATE INDEX IF NOT EXISTS idx_assistance_sessions_status ON public.connection_assistance_sessions(business_id, status);


