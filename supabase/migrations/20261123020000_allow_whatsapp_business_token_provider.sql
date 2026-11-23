-- Allow the encrypted OAuth token vault to store WhatsApp Business credentials.
-- The WhatsApp vault already reads/writes provider='whatsapp_business'; without this
-- provider value the live database rejects every credential upsert with a CHECK violation.
ALTER TABLE public.oauth_token_vault
  DROP CONSTRAINT IF EXISTS oauth_token_vault_provider_check;

ALTER TABLE public.oauth_token_vault
  ADD CONSTRAINT oauth_token_vault_provider_check
  CHECK (provider = ANY (ARRAY['meta'::text, 'facebook'::text, 'instagram'::text, 'youtube'::text, 'whatsapp_business'::text]));
