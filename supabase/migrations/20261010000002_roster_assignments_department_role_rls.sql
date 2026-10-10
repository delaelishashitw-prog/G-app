-- ==============================================================================
-- GREATER WORKS CITY CHURCH (GWCC) - DATABASE MIGRATION SCRIPT
-- Migration: 20261010000002_roster_assignments_department_role_rls.sql
-- Description: Department and Role-based Row Level Security (RLS) policies
--              for public.roster_assignments.
--
-- Authorization Rules:
-- 1. Global Leadership (super_admin, senior_pastor, administrator, pastor,
--    roster_managers, @greaterworkscitychurch.org):
--    -> Full access (SELECT, INSERT, UPDATE, DELETE) across all departments.
-- 2. Department & Ministry Leaders (ministry_leader, department head):
--    -> Manage (SELECT, INSERT, UPDATE, DELETE) records for their authorized department.
-- 3. Individual Members & Volunteers (member, active congregants):
--    -> View (SELECT) only duty shifts assigned to them.
--    -> Update (UPDATE) duty status (confirmed, declined, substituted) for their own shift.
-- 4. Public Kiosk / Anonymous Bulletin:
--    -> Read-only (SELECT) for worship service rosters without write permissions.
-- ==============================================================================

-- 1. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_roster_assignments_department
  ON public.roster_assignments (department);

CREATE INDEX IF NOT EXISTS idx_roster_assignments_member_id
  ON public.roster_assignments (member_id);

CREATE INDEX IF NOT EXISTS idx_roster_assignments_date_dept
  ON public.roster_assignments (date, department);

CREATE INDEX IF NOT EXISTS idx_profiles_role_dept
  ON public.profiles (role, department);

-- 2. HELPER FUNCTIONS FOR ROLE AND DEPARTMENT RESOLUTION

-- 2.1 Get authenticated user's canonical church role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
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

  -- 1. Check public.profiles by auth.uid()
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()::text
  LIMIT 1;

  IF v_role IS NOT NULL AND BTRIM(v_role) <> '' THEN
    RETURN LOWER(BTRIM(v_role));
  END IF;

  -- 2. Check public.profiles by email matching auth.users
  SELECT p.role INTO v_role
  FROM public.profiles p
  JOIN auth.users u ON LOWER(BTRIM(COALESCE(p.email, ''))) = LOWER(BTRIM(COALESCE(u.email, '')))
  WHERE u.id = auth.uid()
  LIMIT 1;

  IF v_role IS NOT NULL AND BTRIM(v_role) <> '' THEN
    RETURN LOWER(BTRIM(v_role));
  END IF;

  -- 3. Check JWT claims
  v_role := COALESCE(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  RETURN LOWER(BTRIM(COALESCE(v_role, 'member')));
END;
$$;

-- 2.2 Get authenticated user's authorized department
CREATE OR REPLACE FUNCTION public.get_current_user_department()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dept TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '';
  END IF;

  -- 1. Check public.profiles by auth.uid()
  SELECT department INTO v_dept
  FROM public.profiles
  WHERE id = auth.uid()::text
  LIMIT 1;

  IF v_dept IS NOT NULL AND BTRIM(v_dept) <> '' THEN
    RETURN LOWER(BTRIM(v_dept));
  END IF;

  -- 2. Check public.profiles by email matching auth.users
  SELECT p.department INTO v_dept
  FROM public.profiles p
  JOIN auth.users u ON LOWER(BTRIM(COALESCE(p.email, ''))) = LOWER(BTRIM(COALESCE(u.email, '')))
  WHERE u.id = auth.uid()
  LIMIT 1;

  IF v_dept IS NOT NULL AND BTRIM(v_dept) <> '' THEN
    RETURN LOWER(BTRIM(v_dept));
  END IF;

  -- 3. Check JWT user_metadata
  v_dept := COALESCE(
    auth.jwt() ->> 'department',
    auth.jwt() -> 'user_metadata' ->> 'department',
    auth.jwt() -> 'app_metadata' ->> 'department'
  );

  RETURN LOWER(BTRIM(COALESCE(v_dept, '')));
END;
$$;

-- 2.3 Verify if user is Global Church Leadership (oversight of all departments)
CREATE OR REPLACE FUNCTION public.is_global_roster_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check roster_managers table
  IF EXISTS (
    SELECT 1 FROM public.roster_managers WHERE user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check official church staff email domain
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email IS NOT NULL
      AND LOWER(email) LIKE '%@greaterworkscitychurch.org'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check leadership roles
  v_role := public.get_current_user_role();
  IF v_role IN ('super_admin', 'senior_pastor', 'administrator', 'pastor') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2.4 Verify if user can manage a specific department's duty roster
CREATE OR REPLACE FUNCTION public.can_manage_roster_department(dept_name VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_dept TEXT;
  v_user_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Global leadership can manage any department
  IF public.is_global_roster_admin() THEN
    RETURN TRUE;
  END IF;

  v_user_role := public.get_current_user_role();
  v_user_dept := public.get_current_user_department();

  -- Department leader or officer matching the target department
  IF v_user_role IN ('ministry_leader', 'leader', 'administrator', 'pastor') AND v_user_dept <> '' THEN
    IF LOWER(REPLACE(v_user_dept, ' ', '_')) = LOWER(REPLACE(COALESCE(dept_name, ''), ' ', '_')) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Verify ministry leadership in public.ministries table
  IF EXISTS (
    SELECT 1
    FROM public.ministries m
    JOIN public.members mem ON (mem.id = m.leader_id OR mem.member_id = m.leader_id)
    JOIN auth.users au ON LOWER(BTRIM(COALESCE(mem.email, ''))) = LOWER(BTRIM(COALESCE(au.email, '')))
    WHERE au.id = auth.uid()
      AND (
        LOWER(REPLACE(m.name, ' ', '_')) LIKE '%' || LOWER(REPLACE(COALESCE(dept_name, ''), ' ', '_')) || '%'
        OR LOWER(REPLACE(COALESCE(dept_name, ''), ' ', '_')) LIKE '%' || LOWER(REPLACE(m.name, ' ', '_')) || '%'
      )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2.5 Verify if user can read a roster assignment based on department or personal assignment
CREATE OR REPLACE FUNCTION public.can_read_department_roster(dept_name VARCHAR, assignment_member_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 1. Global leadership can view all rosters
  IF public.is_global_roster_admin() THEN
    RETURN TRUE;
  END IF;

  -- 2. Department leaders and staff authorized for this department
  IF public.can_manage_roster_department(dept_name) THEN
    RETURN TRUE;
  END IF;

  -- 3. Individual members can view duties assigned to them
  IF public.can_read_roster_assignment(assignment_member_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 3. FUNCTION EXECUTION PRIVILEGES
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_department() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_global_roster_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_roster_department(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_department_roster(VARCHAR, TEXT) TO anon, authenticated;

-- 4. TABLE PERMISSIONS
ALTER TABLE public.roster_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roster_assignments TO authenticated;
GRANT SELECT ON TABLE public.roster_assignments TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 5. ATOMIC POLICY REPLACEMENT FOR public.roster_assignments
DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'roster_assignments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.roster_assignments', existing_policy.policyname);
  END LOOP;
END
$$;

-- Policy 1: SELECT - Department leaders, global leadership, and assigned members
CREATE POLICY roster_assignments_select_authorized
  ON public.roster_assignments
  FOR SELECT
  TO authenticated
  USING (
    public.can_read_department_roster(department, member_id)
  );

-- Policy 2: INSERT - Global leadership and department leaders for their authorized department
CREATE POLICY roster_assignments_insert_authorized
  ON public.roster_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_roster_department(department)
  );

-- Policy 3: UPDATE - Department leaders for their department, or assigned members confirming their shift
CREATE POLICY roster_assignments_update_authorized
  ON public.roster_assignments
  FOR UPDATE
  TO authenticated
  USING (
    public.can_manage_roster_department(department)
    OR public.can_read_roster_assignment(member_id)
  )
  WITH CHECK (
    public.can_manage_roster_department(department)
    OR (
      public.can_read_roster_assignment(member_id)
      AND status IN ('confirmed', 'declined', 'substituted', 'pending')
    )
  );

-- Policy 4: DELETE - Global leadership and department leaders for their authorized department
CREATE POLICY roster_assignments_delete_authorized
  ON public.roster_assignments
  FOR DELETE
  TO authenticated
  USING (
    public.can_manage_roster_department(department)
  );

-- Policy 5: ANON SELECT - Public service bulletin and kiosk duty view
CREATE POLICY roster_assignments_anon_select
  ON public.roster_assignments
  FOR SELECT
  TO anon
  USING (true);

-- 6. REALTIME REPLICATION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_assignments;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END
$$;
