# Supabase Production Database Migration Guide — Business Doctor AI

This guide provides the exact, production-ready steps to execute the database schema migration and configure Row Level Security (RLS) for Business Doctor AI.

---

## 1. Prerequisites

Before starting the migration, ensure you have:
1. A **Supabase Project** created at [supabase.com](https://supabase.com).
2. Your project's **Project URL** (e.g. `https://<project-ref>.supabase.co`).
3. Your project's **anon public key** (`VITE_SUPABASE_ANON_KEY`).
4. Your project's **service_role secret key** (`SUPABASE_SERVICE_ROLE_KEY`) for server-side operations.

---

## 2. Migration Execution Options

### Option A: Supabase Dashboard SQL Editor (Recommended & Fastest)

1. Open your Supabase Dashboard: `https://supabase.com/dashboard/project/<your-project-ref>`.
2. In the left navigation, click on **SQL Editor**.
3. Click **New Query**.
4. Open the migration file in this repository: [`supabase/schema.sql`](./schema.sql).
5. Copy the entire content of `supabase/schema.sql` and paste it into the SQL Editor.
6. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
7. Confirm that the query completes with status `Success: No rows returned` or green checkmark.

### Option B: Supabase CLI

If using the Supabase CLI locally:

```bash
# 1. Login to Supabase CLI
npx supabase login

# 2. Link your local repository to your remote project
npx supabase link --project-ref <your-project-ref>

# 3. Apply schema migration
npx supabase db execute --file supabase/schema.sql
```

---

## 3. Verification & Health Check Queries

After executing the migration, run these verification queries in the Supabase SQL Editor:

### A. Verify All 16 Core Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'businesses', 'business_members', 'leads', 'customers', 'orders',
    'bookings', 'products', 'services', 'expenses', 'business_memory',
    'agent_actions', 'automations', 'ai_diagnoses', 'data_sources',
    'campaigns', 'audit_logs'
  )
ORDER BY table_name;
```
*Expected: 16 rows returned.*

### B. Verify Row Level Security (RLS) is Enabled on All Tables
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```
*Expected: `rowsecurity` is `true` for all public tables.*

### C. Verify Security Functions
```sql
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_auth_user_business_role', 'is_authorized_business_member');
```
*Expected: 2 functions found with `SECURITY DEFINER`.*

### D. Verify Performance Indexes
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

---

## 4. Bootstrapping Your First Business & Owner Membership

When you create your account via the app's Supabase Auth sign-up, your user is registered in `auth.users`. 

To associate your authenticated user as the `owner` of your first business:

```sql
-- Step 1: Replace with your Supabase Auth user email and target business details
DO $$
DECLARE
    v_user_id UUID;
    v_business_id TEXT := 'biz_ayurvedic_01';
    v_user_email TEXT := 'gajendravishwakarma738@gmail.com';
    v_user_name TEXT := 'Dr. Gajendra Vishwakarma';
BEGIN
    -- Find the auth user ID from Supabase Auth
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Insert Business
        INSERT INTO public.businesses (id, name, business_type, industry, location, monthly_revenue_target)
        VALUES (v_business_id, 'Ayurvedic Remedies & Wellness', 'hybrid', 'Health & Wellness', 'Bengaluru, India', 500000)
        ON CONFLICT (id) DO NOTHING;

        -- Insert Owner Membership
        INSERT INTO public.business_members (id, business_id, user_id, role, user_email, user_name)
        VALUES (v_business_id || ':' || v_user_id, v_business_id, v_user_id, 'owner', v_user_email, v_user_name)
        ON CONFLICT (business_id, user_id) DO UPDATE SET role = 'owner';

        RAISE NOTICE 'Successfully bootstrapped owner membership for %', v_user_email;
    ELSE
        RAISE NOTICE 'User % has not signed up in Supabase Auth yet. Sign up first through the app.', v_user_email;
    END IF;
END $$;
```

---

## 5. Next Steps

1. Configure your environment variables in `.env` (or your hosting platform secrets):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
2. Start the application and sign in with your Supabase account.
3. Use the app settings to test live database connection and synchronization.
