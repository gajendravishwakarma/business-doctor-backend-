-- Atomic first-business onboarding. Re-run this migration when upgrading the RPC signature.
-- Privileged execution is restricted to service_role; the API verifies the Supabase JWT first.
DROP FUNCTION IF EXISTS public.create_business_with_owner(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_business_with_owner(
  p_business_id TEXT,
  p_user_id UUID,
  p_name TEXT,
  p_business_type TEXT DEFAULT 'hybrid',
  p_website TEXT DEFAULT '',
  p_phone TEXT DEFAULT '',
  p_email TEXT DEFAULT '',
  p_user_name TEXT DEFAULT '',
  p_business_age_stage TEXT DEFAULT 'new',
  p_data_maturity_mode TEXT DEFAULT 'new_business',
  p_industry TEXT DEFAULT '',
  p_location TEXT DEFAULT '',
  p_country TEXT DEFAULT 'India',
  p_currency TEXT DEFAULT 'INR',
  p_currency_symbol TEXT DEFAULT '₹',
  p_timezone TEXT DEFAULT 'Asia/Kolkata',
  p_description TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business public.businesses%ROWTYPE;
BEGIN
  IF p_business_id IS NULL OR length(trim(p_business_id)) < 8 THEN
    RAISE EXCEPTION 'Invalid business id';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 OR length(trim(p_name)) > 120 THEN
    RAISE EXCEPTION 'Business name must be 2 to 120 characters';
  END IF;
  IF p_business_type NOT IN ('retail','service','restaurant','salon','hybrid','other') THEN
    RAISE EXCEPTION 'Invalid business type';
  END IF;
  IF p_business_age_stage NOT IN ('new','early','growing','established') THEN
    RAISE EXCEPTION 'Invalid business age stage';
  END IF;
  IF p_data_maturity_mode NOT IN ('existing_complete','existing_partial','new_business','existing_no_history') THEN
    RAISE EXCEPTION 'Invalid data maturity mode';
  END IF;

  INSERT INTO public.businesses (
    id, name, business_type, industry, location, country, currency,
    currency_symbol, timezone, business_age_stage, data_maturity_mode,
    website, contact_phone, contact_email, description
  ) VALUES (
    p_business_id, trim(p_name), p_business_type,
    COALESCE(NULLIF(trim(p_industry), ''), initcap(p_business_type)),
    COALESCE(NULLIF(trim(p_location), ''), 'India'),
    COALESCE(NULLIF(trim(p_country), ''), 'India'),
    COALESCE(NULLIF(trim(p_currency), ''), 'INR'),
    COALESCE(NULLIF(trim(p_currency_symbol), ''), '₹'),
    COALESCE(NULLIF(trim(p_timezone), ''), 'Asia/Kolkata'),
    p_business_age_stage, p_data_maturity_mode,
    COALESCE(NULLIF(trim(p_website), ''), ''),
    COALESCE(NULLIF(trim(p_phone), ''), ''),
    COALESCE(NULLIF(trim(p_email), ''), ''),
    COALESCE(NULLIF(trim(p_description), ''), '')
  )
  RETURNING * INTO v_business;

  INSERT INTO public.business_members (
    id, business_id, user_id, role, user_email, user_name
  ) VALUES (
    'mem_' || replace(gen_random_uuid()::text, '-', ''),
    p_business_id, p_user_id, 'owner',
    COALESCE(NULLIF(trim(p_email), ''), ''),
    COALESCE(NULLIF(trim(p_user_name), ''), 'Business Owner')
  );

  RETURN jsonb_build_object(
    'business_id', v_business.id,
    'name', v_business.name,
    'role', 'owner',
    'status', 'created'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_business_with_owner(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_business_with_owner(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_with_owner(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
