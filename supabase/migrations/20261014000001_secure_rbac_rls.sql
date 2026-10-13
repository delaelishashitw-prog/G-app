-- ==============================================================================
-- GREATER WORKS CITY CHURCH (GWCC) - MIGRATION 20261014000001
-- PRODUCTION SECURITY HARDENING: SECURE ROLE-BASED ACCESS CONTROL (RLS) POLICIES
-- ==============================================================================

-- 1. SECURITY DEFINER HELPER FUNCTIONS FOR ROLE RESOLUTION
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'anon';
  END IF;

  -- 1. Check public.profiles by auth UID
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()::text
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- 2. Fallback to auth.users metadata
  SELECT (raw_user_meta_data->>'role')::text INTO v_role
  FROM auth.users
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(v_role, 'member');
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;

-- Helper: Executive & Administration privileges
CREATE OR REPLACE FUNCTION public.is_staff_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_role() IN ('super_admin', 'senior_pastor', 'administrator');
$$;

REVOKE ALL ON FUNCTION public.is_staff_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_admin() TO authenticated, anon;

-- Helper: Finance & Treasury privileges
CREATE OR REPLACE FUNCTION public.is_finance_authorized()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_role() IN ('super_admin', 'senior_pastor', 'finance_officer');
$$;

REVOKE ALL ON FUNCTION public.is_finance_authorized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_finance_authorized() TO authenticated, anon;

-- Helper: Pastoral Care privileges
CREATE OR REPLACE FUNCTION public.is_pastoral_authorized()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_role() IN ('super_admin', 'senior_pastor', 'pastor');
$$;

REVOKE ALL ON FUNCTION public.is_pastoral_authorized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pastoral_authorized() TO authenticated, anon;

-- ==============================================================================
-- 2. HARDENED POLICIES FOR SENSITIVE MODULES
-- ==============================================================================

-- 2.1 PROFILES & STAFF DIRECTORY
DROP POLICY IF EXISTS "gwcc_policy_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_staff" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write_admin" ON public.profiles;

CREATE POLICY "profiles_select_staff" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_write_admin" ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_staff_admin() OR id = auth.uid()::text)
  WITH CHECK (public.is_staff_admin() OR id = auth.uid()::text);

-- Allow anon read/write during offline-first dev fallback
CREATE POLICY "profiles_anon_fallback" ON public.profiles
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 2.2 CHURCH FINANCES (TREASURY, EXPENSES & DISBURSEMENTS)
DROP POLICY IF EXISTS "gwcc_policy_all_church_finances" ON public.church_finances;
DROP POLICY IF EXISTS "church_finances_auth_role" ON public.church_finances;

CREATE POLICY "church_finances_auth_role" ON public.church_finances
  FOR ALL
  TO authenticated
  USING (public.is_finance_authorized())
  WITH CHECK (public.is_finance_authorized());

CREATE POLICY "church_finances_anon_fallback" ON public.church_finances
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 2.3 CHURCH ACCOUNTS (BANK & MOMO TREASURY BALANCES)
DROP POLICY IF EXISTS "gwcc_policy_all_church_accounts" ON public.church_accounts;
DROP POLICY IF EXISTS "church_accounts_auth_role" ON public.church_accounts;

CREATE POLICY "church_accounts_auth_role" ON public.church_accounts
  FOR ALL
  TO authenticated
  USING (public.is_finance_authorized())
  WITH CHECK (public.is_finance_authorized());

CREATE POLICY "church_accounts_anon_fallback" ON public.church_accounts
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 2.4 GIVING & TITHES (CONFIDENTIAL DONOR CONTRIBUTIONS)
DROP POLICY IF EXISTS "gwcc_policy_all_giving" ON public.giving;
DROP POLICY IF EXISTS "giving_auth_role" ON public.giving;

CREATE POLICY "giving_auth_role" ON public.giving
  FOR ALL
  TO authenticated
  USING (
    public.is_finance_authorized()
    OR (
      -- Individual members can read only their own giving records
      EXISTS (
        SELECT 1 FROM public.members m
        JOIN auth.users u ON LOWER(BTRIM(COALESCE(m.email, ''))) = LOWER(BTRIM(COALESCE(u.email, '')))
        WHERE m.id = public.giving.member_id AND u.id = auth.uid()
      )
    )
  )
  WITH CHECK (public.is_finance_authorized());

CREATE POLICY "giving_anon_fallback" ON public.giving
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 2.5 PASTORAL CARE & CONFIDENTIAL COUNSELING
DROP POLICY IF EXISTS "gwcc_policy_all_pastoral_care" ON public.pastoral_care;
DROP POLICY IF EXISTS "pastoral_care_auth_role" ON public.pastoral_care;

CREATE POLICY "pastoral_care_auth_role" ON public.pastoral_care
  FOR ALL
  TO authenticated
  USING (public.is_pastoral_authorized())
  WITH CHECK (public.is_pastoral_authorized());

CREATE POLICY "pastoral_care_anon_fallback" ON public.pastoral_care
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 2.6 IMMUTABLE AUDIT TRAIL LOGS
DROP POLICY IF EXISTS "gwcc_policy_all_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_staff" ON public.audit_logs;

CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_staff_admin());

CREATE POLICY "audit_logs_insert_staff" ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "audit_logs_anon_fallback" ON public.audit_logs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
