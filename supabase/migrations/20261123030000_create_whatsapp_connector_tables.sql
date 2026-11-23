-- WhatsApp connector persistence and tenant-safe webhook ledger.
-- business_id uses UUID to match the live businesses table.
CREATE TABLE IF NOT EXISTS public.business_integrations (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.connector_webhook_events (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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

ALTER TABLE public.business_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized members can view business integrations" ON public.business_integrations;
CREATE POLICY "Authorized members can view business integrations"
  ON public.business_integrations FOR SELECT
  USING (public.is_authorized_business_member(business_id, ARRAY['owner','manager','staff','admin']));

DROP POLICY IF EXISTS "Owners and managers can manage business integrations" ON public.business_integrations;
CREATE POLICY "Owners and managers can manage business integrations"
  ON public.business_integrations FOR ALL
  USING (public.is_authorized_business_member(business_id, ARRAY['owner','manager','admin']))
  WITH CHECK (public.is_authorized_business_member(business_id, ARRAY['owner','manager','admin']));

DROP POLICY IF EXISTS "Authorized members can view webhook events" ON public.connector_webhook_events;
CREATE POLICY "Authorized members can view webhook events"
  ON public.connector_webhook_events FOR SELECT
  USING (public.is_authorized_business_member(business_id, ARRAY['owner','manager','staff','admin']));

DROP POLICY IF EXISTS "Authorized members and service role can insert webhook events" ON public.connector_webhook_events;
CREATE POLICY "Authorized members and service role can insert webhook events"
  ON public.connector_webhook_events FOR INSERT
  WITH CHECK (public.is_authorized_business_member(business_id, ARRAY['owner','manager','admin']));

DROP POLICY IF EXISTS "Owners and managers can update webhook events" ON public.connector_webhook_events;
CREATE POLICY "Owners and managers can update webhook events"
  ON public.connector_webhook_events FOR UPDATE
  USING (public.is_authorized_business_member(business_id, ARRAY['owner','manager','admin']))
  WITH CHECK (public.is_authorized_business_member(business_id, ARRAY['owner','manager','admin']));

CREATE INDEX IF NOT EXISTS idx_business_integrations_tenant ON public.business_integrations(business_id, provider);
CREATE INDEX IF NOT EXISTS idx_business_integrations_status ON public.business_integrations(business_id, status);
CREATE INDEX IF NOT EXISTS idx_business_integrations_phone_lookup ON public.business_integrations(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_business_integrations_waba_lookup ON public.business_integrations(waba_id);
CREATE INDEX IF NOT EXISTS idx_connector_webhook_events_tenant ON public.connector_webhook_events(business_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_connector_webhook_events_lookup ON public.connector_webhook_events(business_id, provider, external_message_id);
