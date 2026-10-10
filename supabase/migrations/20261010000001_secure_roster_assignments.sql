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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS service_name VARCHAR(150) DEFAULT 'Church Service';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS member_name VARCHAR(150) DEFAULT 'Member';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS member_phone VARCHAR(50);
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS department VARCHAR(80) DEFAULT 'ushers_protocol';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS role_title VARCHAR(150) DEFAULT 'Volunteer';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS report_time VARCHAR(30) DEFAULT '08:00';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.roster_assignments
SET service_name = COALESCE(service_name, 'Church Service'),
    date = COALESCE(date, CURRENT_DATE),
    member_name = COALESCE(member_name, 'Member'),
    department = COALESCE(department, 'ushers_protocol'),
    role_title = COALESCE(role_title, 'Volunteer'),
    report_time = COALESCE(report_time, '08:00'),
    status = COALESCE(status, 'pending'),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW());

ALTER TABLE public.roster_assignments ALTER COLUMN service_name SET NOT NULL;
ALTER TABLE public.roster_assignments ALTER COLUMN date SET NOT NULL;
ALTER TABLE public.roster_assignments ALTER COLUMN member_name SET NOT NULL;
ALTER TABLE public.roster_assignments ALTER COLUMN department SET NOT NULL;
ALTER TABLE public.roster_assignments ALTER COLUMN role_title SET NOT NULL;
ALTER TABLE public.roster_assignments ALTER COLUMN report_time SET NOT NULL;
ALTER TABLE public.roster_assignments ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.roster_assignments ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.roster_assignments ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roster_assignments_member_date
  ON public.roster_assignments (member_id, date);

CREATE TABLE IF NOT EXISTS public.roster_managers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.roster_managers IS
  'Trusted Supabase Auth users authorized to manage all service roster assignments. Add or remove entries through the Supabase SQL editor using the auth.users UUID.';

ALTER TABLE public.roster_managers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.roster_managers FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_roster_manager()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roster_managers
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_roster_manager() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_roster_manager() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_roster_manager() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_roster_assignment(assignment_member_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members AS member
    JOIN auth.users AS auth_user
      ON LOWER(BTRIM(COALESCE(member.email, ''))) = LOWER(BTRIM(COALESCE(auth_user.email, '')))
    WHERE (member.id = assignment_member_id OR member.member_id = assignment_member_id)
      AND auth_user.id = auth.uid()
      AND auth_user.email_confirmed_at IS NOT NULL
      AND COALESCE(auth_user.email, '') <> ''
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_roster_assignment(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_roster_assignment(TEXT) TO authenticated;

ALTER TABLE public.roster_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.roster_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roster_assignments TO authenticated;

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
    EXECUTE format('DROP POLICY %I ON public.roster_assignments', existing_policy.policyname);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS roster_assignments_manager_all ON public.roster_assignments;
CREATE POLICY roster_assignments_manager_all
  ON public.roster_assignments
  FOR ALL
  TO authenticated
  USING (public.is_roster_manager())
  WITH CHECK (public.is_roster_manager());

DROP POLICY IF EXISTS roster_assignments_member_read ON public.roster_assignments;
CREATE POLICY roster_assignments_member_read
  ON public.roster_assignments
  FOR SELECT
  TO authenticated
  USING (public.can_read_roster_assignment(member_id));

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
