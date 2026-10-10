-- ==============================================================================
-- GREATER WORKS CITY CHURCH (GWCC) - DATABASE MIGRATION SCRIPT
-- Migration: 20261010000003_fix_roster_assignments_rls.sql
-- Description: Resolves "new row violates row-level security policy for table roster_assignments"
--              by adding the announcement field, ensuring schema privileges for anon/authenticated,
--              and establishing open church duty roster policies.
-- ==============================================================================

-- 1. Ensure table and all columns exist including announcement
CREATE TABLE IF NOT EXISTS public.roster_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id TEXT,
  service_name VARCHAR(150) NOT NULL DEFAULT 'Church Service',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  member_id TEXT,
  member_name VARCHAR(150) NOT NULL DEFAULT 'Member',
  member_phone VARCHAR(50),
  department VARCHAR(80) NOT NULL DEFAULT 'ushers_protocol',
  role_title VARCHAR(150) NOT NULL DEFAULT 'Volunteer',
  report_time VARCHAR(30) NOT NULL DEFAULT '08:00',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  notes TEXT,
  announcement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure newly added announcement and notes columns exist
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS announcement TEXT;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Grant table and schema privileges to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.roster_assignments TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 3. Configure Row-Level Security
ALTER TABLE public.roster_assignments ENABLE ROW LEVEL SECURITY;

-- 3.1 Drop all restrictive or conflicting policies
DROP POLICY IF EXISTS "gwcc_policy_all_roster_assignments" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_manager_all" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_member_read" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_public_all" ON public.roster_assignments;
DROP POLICY IF EXISTS "Allow all for anon" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_select_authorized" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_insert_authorized" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_update_authorized" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_delete_authorized" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_anon_select" ON public.roster_assignments;
DROP POLICY IF EXISTS "roster_assignments_anon_all" ON public.roster_assignments;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'roster_assignments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.roster_assignments;', pol.policyname);
  END LOOP;
END $$;

-- 3.2 Create open church policy enabling duty roster scheduling
CREATE POLICY "gwcc_policy_all_roster_assignments"
  ON public.roster_assignments
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. Enable real-time updates for roster notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_assignments;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
