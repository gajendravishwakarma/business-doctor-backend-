-- Align the authenticated onboarding API with the live businesses/business_members schema.
-- The legacy 14-argument function remains the atomic/idempotent insert implementation.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS currency_symbol text,
  ADD COLUMN IF NOT EXISTS business_age_stage text,
  ADD COLUMN IF NOT EXISTS data_maturity_mode text;

CREATE OR REPLACE FUNCTION public.create_business_with_owner(
  p_business_id uuid,
  p_user_id uuid,
  p_name text,
  p_business_type text DEFAULT 'hybrid',
  p_website_url text DEFAULT '',
  p_phone text DEFAULT '',
  p_email text DEFAULT '',
  p_business_age_stage text DEFAULT 'new',
  p_data_maturity_mode text DEFAULT 'new_business',
  p_industry text DEFAULT '',
  p_location text DEFAULT '',
  p_country text DEFAULT 'India',
  p_currency text DEFAULT 'INR',
  p_currency_symbol text DEFAULT '₹',
  p_timezone text DEFAULT 'Asia/Kolkata',
  p_description text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF p_business_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Business id and authenticated user id are required';
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
  IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid currency code';
  END IF;

  v_result := public.create_business_with_owner(
    p_business_id,
    p_user_id,
    p_name,
    p_business_type,
    coalesce(p_description, ''),
    nullif(trim(coalesce(p_website_url, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    coalesce(nullif(trim(p_country), ''), 'India'),
    coalesce(nullif(trim(p_timezone), ''), 'Asia/Kolkata'),
    p_currency,
    12,
    p_business_age_stage,
    p_data_maturity_mode
  );

  UPDATE public.businesses
  SET industry = nullif(trim(coalesce(p_industry, '')), ''),
      location = nullif(trim(coalesce(p_location, '')), ''),
      currency_symbol = coalesce(nullif(trim(p_currency_symbol), ''), '₹'),
      business_age_stage = p_business_age_stage,
      data_maturity_mode = p_data_maturity_mode,
      business_age_months = NULL,
      updated_at = now()
  WHERE id = p_business_id
    AND EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = p_business_id
        AND bm.user_id = p_user_id
        AND bm.role = 'owner'
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner membership verification failed after business onboarding';
  END IF;

  RETURN v_result;
END;
$function$;

DROP FUNCTION IF EXISTS public.create_business_with_owner(text, uuid, text, text, text, text, text, text, text, text);

REVOKE ALL ON FUNCTION public.create_business_with_owner(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_with_owner(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_business_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_business_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_authorized_business_member(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_user_business_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_authorized_business_member(uuid, text[]) TO authenticated, service_role;
