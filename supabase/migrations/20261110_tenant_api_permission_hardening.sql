-- Restrict anonymous access to tenant data and sensitive integration tables.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Business creation is server-mediated through the verified service-role RPC.
DROP POLICY IF EXISTS "authenticated users can create businesses" ON public.businesses;
REVOKE INSERT ON public.businesses FROM authenticated;

-- Integration credentials and publishing jobs require an authenticated tenant member.
DROP POLICY IF EXISTS oauth_token_vault_tenant_isolation ON public.oauth_token_vault;
CREATE POLICY oauth_token_vault_tenant_isolation
ON public.oauth_token_vault
FOR ALL
TO authenticated
USING (public.is_authorized_business_member(business_id, ARRAY['owner','admin']))
WITH CHECK (public.is_authorized_business_member(business_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS social_publishing_jobs_tenant_isolation ON public.social_publishing_jobs;
CREATE POLICY social_publishing_jobs_tenant_isolation
ON public.social_publishing_jobs
FOR ALL
TO authenticated
USING (public.is_authorized_business_member(business_id, ARRAY['owner','manager','admin','marketing']))
WITH CHECK (public.is_authorized_business_member(business_id, ARRAY['owner','manager','admin','marketing']));
