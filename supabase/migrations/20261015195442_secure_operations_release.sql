-- Production security and persistence. Apply after the earlier migrations.
-- Existing role assignments must be reviewed by the database owner before rollout.

-- Some existing installations were set up with SQL Editor and have no migration
-- history. Add the missing welfare relations without replaying old open policies.
CREATE TABLE IF NOT EXISTS public.welfare_events (
  id varchar(100) PRIMARY KEY, title varchar(255) NOT NULL, category varchar(100) NOT NULL,
  category_custom varchar(255), member_id varchar(100) NOT NULL, member_name varchar(150) NOT NULL,
  beneficiary_family_name varchar(200), description text NOT NULL, pastoral_notes text,
  start_date date NOT NULL DEFAULT CURRENT_DATE, end_date date NOT NULL,
  target_amount numeric(12,2), minimum_contribution numeric(10,2) NOT NULL DEFAULT 20 CHECK(minimum_contribution>=20),
  status varchar(50) NOT NULL DEFAULT 'open', created_by varchar(150) NOT NULL,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.welfare_event_contributions (
  id varchar(100) PRIMARY KEY, event_id varchar(100) NOT NULL REFERENCES public.welfare_events(id) ON DELETE CASCADE,
  member_id varchar(100) NOT NULL, contributor_name varchar(150) NOT NULL, contributor_phone varchar(50),
  tithe_number varchar(50), amount numeric(12,2) NOT NULL CHECK(amount>=20),
  payment_date date NOT NULL DEFAULT CURRENT_DATE, payment_method varchar(50) NOT NULL DEFAULT 'mobile_money',
  payment_channel varchar(100), reference_no varchar(100), notes text,
  payment_status varchar(50) NOT NULL DEFAULT 'confirmed', recorded_by varchar(150) NOT NULL,
  corrected_by varchar(150), finance_transaction_id varchar(100),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_welfare_events_status ON public.welfare_events(status);
CREATE INDEX IF NOT EXISTS idx_wec_event_id ON public.welfare_event_contributions(event_id);
CREATE INDEX IF NOT EXISTS idx_wec_member_id ON public.welfare_event_contributions(member_id);

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS authorization_reviewed_at timestamptz;
UPDATE public.profiles SET first_name=COALESCE(first_name,'Member'),last_name=COALESCE(last_name,'');
ALTER TABLE public.profiles ALTER COLUMN first_name SET DEFAULT 'Member';
ALTER TABLE public.profiles ALTER COLUMN last_name SET DEFAULT '';
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_login_account boolean NOT NULL DEFAULT true;
-- Preserve legacy directory IDs and contact emails. An email match never copies
-- their role to an Auth account or turns a directory row into a login identity.
UPDATE public.profiles p SET has_login_account=false
  WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id::text=p.id);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
UPDATE public.profiles p SET email=u.email FROM auth.users u WHERE p.id=u.id::text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_email_unique ON public.profiles(lower(email))
  WHERE has_login_account AND NULLIF(email,'') IS NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS members_auth_user_id_unique ON public.members(auth_user_id) WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS voided_by text;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.church_finances ADD COLUMN IF NOT EXISTS to_account_id text;
ALTER TABLE public.church_finances ADD COLUMN IF NOT EXISTS to_account_name text;
ALTER TABLE public.church_finances ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.church_finances ADD COLUMN IF NOT EXISTS voided_by text;
ALTER TABLE public.church_accounts ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2);
-- Preserve the existing balance as a migration baseline; do not rewrite historical money.
UPDATE public.church_accounts SET opening_balance = current_balance WHERE opening_balance IS NULL;
ALTER TABLE public.church_accounts ALTER COLUMN opening_balance SET DEFAULT 0;
ALTER TABLE public.church_accounts ALTER COLUMN opening_balance SET NOT NULL;
ALTER TABLE public.welfare_claims DROP CONSTRAINT IF EXISTS welfare_claims_category_check;
ALTER TABLE public.welfare_claims DROP CONSTRAINT IF EXISTS welfare_claims_status_check;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS beneficiary_type text DEFAULT 'member';
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS beneficiary_community text;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS contact_address text;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS amount_disbursed numeric(14,2) DEFAULT 0;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS case_owner text;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS confidential_pastoral_notes text;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS finance_account_id text;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS finance_account_name text;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS disbursements jsonb DEFAULT '[]';
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS legacy_disbursed_amount numeric(14,2);
-- Previously paid claims must not become payable again after adding payment tracking.
UPDATE public.welfare_claims w SET amount_disbursed=GREATEST(COALESCE(amount_disbursed,0),
  CASE WHEN status='disbursed' THEN COALESCE(amount_approved,0) ELSE 0 END,
  COALESCE((SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(COALESCE(w.disbursements,'[]')) d),0))
  WHERE legacy_disbursed_amount IS NULL;
UPDATE public.welfare_claims w SET legacy_disbursed_amount=GREATEST(0,COALESCE(amount_disbursed,0)-
  COALESCE((SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(COALESCE(w.disbursements,'[]')) d),0))
  WHERE legacy_disbursed_amount IS NULL;
ALTER TABLE public.welfare_claims ALTER COLUMN legacy_disbursed_amount SET DEFAULT 0;
ALTER TABLE public.welfare_claims ALTER COLUMN legacy_disbursed_amount SET NOT NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.welfare_event_contributions ADD COLUMN IF NOT EXISTS finance_account_id text;
ALTER TABLE public.welfare_event_contributions ADD COLUMN IF NOT EXISTS finance_linked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.gwcc_documents (
  namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(namespace,id)
);
CREATE TABLE IF NOT EXISTS public.gwcc_applied_operations (
  user_id uuid NOT NULL, operation_id uuid NOT NULL, request_hash text NOT NULL,
  result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,operation_id)
);
CREATE TABLE IF NOT EXISTS public.gwcc_api_limits (
  user_id uuid NOT NULL, bucket text NOT NULL, window_start timestamptz NOT NULL,
  count integer NOT NULL, PRIMARY KEY(user_id,bucket,window_start)
);
CREATE TABLE IF NOT EXISTS public.roster_notifications (
  id text PRIMARY KEY, member_id text NOT NULL, duty_id text, type text NOT NULL,
  payload jsonb NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.child_check_ins (
  id text PRIMARY KEY, security_code text NOT NULL, child_name text NOT NULL,
  age_group text NOT NULL, class_room text NOT NULL, service_id text NOT NULL,
  service_name text NOT NULL, date date NOT NULL, check_in_time text NOT NULL,
  parent_name text NOT NULL, parent_phone text NOT NULL,
  alternate_pickup_name text, alternate_pickup_phone text, allergies_medical_notes text,
  has_allergy_alert boolean DEFAULT false, special_instructions text,
  checked_in_by text, status text NOT NULL DEFAULT 'checked_in',
  check_out_time text, checked_out_to_person text, verified_by_leader text,
  emergency_parent_called boolean DEFAULT false, emergency_call_notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS child_active_pickup_token_unique
  ON public.child_check_ins(security_code) WHERE status='checked_in';

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT p.role FROM public.profiles p JOIN auth.users u ON u.id::text=p.id
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
      AND p.is_active IS TRUE AND p.has_login_account IS TRUE
      AND (p.role='member' OR p.authorization_reviewed_at IS NOT NULL)), 'disabled');
$$;

CREATE OR REPLACE FUNCTION public.gwcc_owns_member(p_member_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.members m
    WHERE m.id=p_member_id AND m.auth_user_id=auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.gwcc_can_read(p_table text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text := public.current_user_role();
BEGIN
  IF r IN ('disabled','anon') THEN RETURN false; END IF;
  IF r IN ('super_admin','senior_pastor') THEN RETURN true; END IF;
  IF p_table IN ('church_accounts','church_finances','giving','pledges','pledge_campaigns','expenses','department_budgets') THEN RETURN r='finance_officer'; END IF;
  IF p_table IN ('pastoral_care','pastoral_visitations','counseling_sessions','intercessory_slots','prayer_requests') THEN RETURN r='pastor'; END IF;
  IF p_table IN ('welfare_events','welfare_event_contributions','welfare_contributions','welfare_claims') THEN RETURN r IN ('administrator','finance_officer','pastor'); END IF;
  IF p_table IN ('profiles','audit_logs','settings','assets','asset_maintenance_logs') THEN RETURN r='administrator'; END IF;
  IF p_table IN ('services','events') THEN RETURN true; END IF;
  IF p_table IN ('attendance','headcounts','child_check_ins') THEN RETURN r IN ('administrator','pastor','ministry_leader','attendance_officer','data_entry'); END IF;
  IF p_table IN ('members','visitors','ministries','small_groups','foundation_cohorts','foundation_students','roster_assignments','communications') THEN RETURN r IN ('administrator','pastor','ministry_leader','attendance_officer','data_entry') OR (p_table='members' AND r='finance_officer'); END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.gwcc_can_write(p_table text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text := public.current_user_role();
BEGIN
  IF r IN ('super_admin','senior_pastor') THEN RETURN true; END IF;
  IF p_table IN ('church_accounts','church_finances','giving','pledges','pledge_campaigns','expenses','department_budgets','welfare_event_contributions','welfare_contributions') THEN RETURN r='finance_officer'; END IF;
  IF p_table IN ('pastoral_care','pastoral_visitations','counseling_sessions','intercessory_slots','prayer_requests') THEN RETURN r='pastor'; END IF;
  IF p_table='welfare_claims' THEN RETURN r IN ('administrator','finance_officer','pastor'); END IF;
  IF p_table='welfare_events' THEN RETURN r IN ('administrator','finance_officer','pastor'); END IF;
  IF p_table IN ('profiles','audit_logs') THEN RETURN false; END IF;
  IF p_table IN ('settings','assets','asset_maintenance_logs') THEN RETURN r='administrator'; END IF;
  IF p_table IN ('attendance','headcounts','child_check_ins') THEN RETURN r IN ('administrator','pastor','ministry_leader','attendance_officer','data_entry'); END IF;
  IF p_table IN ('members','visitors','ministries','small_groups','foundation_cohorts','foundation_students') THEN RETURN r IN ('administrator','pastor','data_entry'); END IF;
  IF p_table IN ('services','events','roster_assignments','communications') THEN RETURN r IN ('administrator','pastor','ministry_leader'); END IF;
  RETURN false;
END;
$$;

-- Every exposed relation is deny-by-default. All mutations go through the checked RPC.
DO $$ DECLARE t text; p record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    IF t NOT IN ('gwcc_applied_operations','gwcc_api_limits','roster_managers') THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',t);
      EXECUTE format('CREATE POLICY gwcc_staff_read ON public.%I FOR SELECT TO authenticated USING (public.gwcc_can_read(%L))',t,t);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated, PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated;
-- Existing trigger helpers use built-ins and NEW fields only.
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['handle_updated_at','handle_member_date_sync','handle_pledge_balance'] LOOP
    IF to_regprocedure(format('public.%I()',f)) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION public.%I() SET search_path = %L',f,'');
    END IF;
  END LOOP;
END $$;

CREATE POLICY gwcc_profile_self_read ON public.profiles FOR SELECT TO authenticated
  USING(id=auth.uid()::text AND is_active IS TRUE);
CREATE POLICY gwcc_member_self_read ON public.members FOR SELECT TO authenticated
  USING(public.current_user_role()='member' AND auth_user_id=auth.uid());
CREATE POLICY gwcc_giving_self_read ON public.giving FOR SELECT TO authenticated
  USING(public.current_user_role()='member' AND public.gwcc_owns_member(member_id));
CREATE POLICY gwcc_pledge_self_read ON public.pledges FOR SELECT TO authenticated
  USING(public.current_user_role()='member' AND public.gwcc_owns_member(member_id));
CREATE POLICY gwcc_welfare_receipt_self_read ON public.welfare_event_contributions FOR SELECT TO authenticated
  USING(public.current_user_role()='member' AND public.gwcc_owns_member(member_id));
CREATE POLICY gwcc_welfare_dues_self_read ON public.welfare_contributions FOR SELECT TO authenticated
  USING(public.current_user_role()='member' AND public.gwcc_owns_member(member_id));
CREATE POLICY gwcc_roster_self_read ON public.roster_assignments FOR SELECT TO authenticated
  USING(public.current_user_role()='member' AND public.gwcc_owns_member(member_id));
CREATE POLICY gwcc_notification_read ON public.roster_notifications FOR SELECT TO authenticated
  USING(public.current_user_role() NOT IN ('disabled','anon') AND (public.gwcc_owns_member(member_id) OR public.gwcc_can_write('roster_assignments')));
CREATE POLICY gwcc_document_read ON public.gwcc_documents FOR SELECT TO authenticated
  USING(public.gwcc_can_read(namespace));

-- Views must respect the caller's table privileges and policies.
DO $$ DECLARE v text; BEGIN
  FOR v IN SELECT viewname FROM pg_views WHERE schemaname='public' LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',v);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',v);
  END LOOP;
END $$;

-- Untrusted signup metadata supplies display fields only. Roles always start as member.
CREATE OR REPLACE FUNCTION public.gwcc_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id,email,first_name,last_name,role,is_active,has_login_account)
    VALUES(NEW.id::text,NEW.email,left(COALESCE(NEW.raw_user_meta_data->>'first_name','Member'),100),
      left(COALESCE(NEW.raw_user_meta_data->>'last_name',''),100),'member',true,true)
    ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS gwcc_auth_user_created ON auth.users;
CREATE TRIGGER gwcc_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.gwcc_new_auth_user();
-- Existing Auth accounts get safe member profiles. Legacy staff roles are not auto-promoted.
INSERT INTO public.profiles(id,email,first_name,last_name,role,is_active,has_login_account)
  SELECT id::text,email,'Member','','member',true,true FROM auth.users ON CONFLICT(id) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS public.gwcc_member_number;
CREATE SEQUENCE IF NOT EXISTS public.gwcc_tithe_number;
SELECT setval('public.gwcc_member_number',GREATEST(COALESCE((SELECT max((substring(member_id FROM '(?i)^GWCC-([0-9]+)$'))::bigint) FROM public.members),0),(SELECT last_value FROM public.gwcc_member_number),1),
  EXISTS(SELECT 1 FROM public.members WHERE member_id ~* '^GWCC-[0-9]+$') OR (SELECT is_called FROM public.gwcc_member_number));
SELECT setval('public.gwcc_tithe_number',GREATEST(COALESCE((SELECT max((substring(tithe_number FROM '(?i)^T-([0-9]+)$'))::bigint) FROM public.members),1000),(SELECT last_value FROM public.gwcc_tithe_number),1000),true);

-- Role management is serialized and cannot demote/suspend the last active administrator.
CREATE OR REPLACE FUNCTION public.gwcc_manage_profile(p_id text,p_updates jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old public.profiles; result public.profiles; r text := public.current_user_role(); allowed jsonb;
BEGIN
  IF r<>'super_admin' THEN RAISE EXCEPTION 'Only a super administrator may manage staff accounts' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-profile-management'));
  SELECT * INTO old FROM public.profiles WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff account not found'; END IF;
  IF p_id=auth.uid()::text AND ((p_updates->>'is_active')::boolean IS FALSE OR (p_updates->>'has_login_account')::boolean IS FALSE) THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;
  IF p_updates ? 'role' AND p_updates->>'role' NOT IN ('super_admin','senior_pastor','administrator','finance_officer','pastor','ministry_leader','attendance_officer','data_entry','member') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF old.role='super_admin' AND old.is_active AND (COALESCE(p_updates->>'role',old.role)<>'super_admin' OR COALESCE((p_updates->>'is_active')::boolean,true)=false OR COALESCE((p_updates->>'has_login_account')::boolean,true)=false)
    AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>p_id AND role='super_admin' AND is_active AND has_login_account AND authorization_reviewed_at IS NOT NULL) THEN RAISE EXCEPTION 'The last active super administrator is protected'; END IF;
  allowed := p_updates - ARRAY['id','created_at','email'];
  result := jsonb_populate_record(old,allowed || jsonb_build_object('updated_at',now()));
  IF result.has_login_account AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id::text=p_id) THEN
    RAISE EXCEPTION 'A directory record cannot become a login. Review the exact Supabase Auth account instead';
  END IF;
  UPDATE public.profiles SET first_name=result.first_name,last_name=result.last_name,phone=result.phone,
    department=result.department,job_title=result.job_title,employment_type=result.employment_type,
    avatar_url=result.avatar_url,role=result.role,is_active=result.is_active,has_login_account=result.has_login_account,
    member_id=result.member_id,authorization_reviewed_at=now(),updated_at=now() WHERE id=p_id RETURNING * INTO result;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,auth.uid(),auth.uid()::text,r,'MANAGE_STAFF','Users & Roles',p_id,allowed::text);
  RETURN to_jsonb(result);
END;
$$;

-- Consistent ledger effects. Mutations run in one transaction, under a shared money lock.
CREATE OR REPLACE FUNCTION public.gwcc_finance_effect(p_record jsonb,p_account text) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_record IS NULL OR COALESCE(p_record->>'status','completed') IN ('voided','pending','cancelled','failed') THEN 0
    WHEN p_record->>'transaction_type'='transfer' THEN
      (CASE WHEN p_record->>'to_account_id'=p_account THEN COALESCE((p_record->>'amount')::numeric,0) ELSE 0 END)
      -(CASE WHEN p_record->>'account_id'=p_account THEN COALESCE((p_record->>'amount')::numeric,0) ELSE 0 END)
    WHEN p_record->>'account_id'<>p_account THEN 0
    WHEN p_record->>'transaction_type' IN ('income','grant') THEN COALESCE((p_record->>'amount')::numeric,0)
    ELSE -COALESCE((p_record->>'amount')::numeric,0) END;
$$;
CREATE OR REPLACE FUNCTION public.gwcc_apply_finance_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE before_doc jsonb; after_doc jsonb; acc text; delta numeric; balance numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
  IF TG_OP<>'INSERT' THEN before_doc:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN
    after_doc:=to_jsonb(NEW);
    IF NEW.account_id IS NULL OR NEW.account_id='' THEN RAISE EXCEPTION 'An account is required'; END IF;
    IF NEW.status NOT IN ('completed','voided','pending','cancelled','failed') THEN RAISE EXCEPTION 'Invalid receipt status'; END IF;
    IF NEW.amount<=0 OR NEW.amount<>round(NEW.amount,2) THEN RAISE EXCEPTION 'Amount must be positive with at most two decimal places'; END IF;
    IF NEW.transaction_type NOT IN ('expense','disbursement','income','grant','transfer') THEN RAISE EXCEPTION 'Invalid transaction type'; END IF;
    IF NEW.transaction_type='transfer' AND (NEW.account_id IS NULL OR NEW.to_account_id IS NULL OR NEW.account_id=NEW.to_account_id) THEN RAISE EXCEPTION 'A transfer needs two different accounts'; END IF;
  END IF;
  FOR acc IN SELECT DISTINCT x FROM unnest(ARRAY[before_doc->>'account_id',before_doc->>'to_account_id',after_doc->>'account_id',after_doc->>'to_account_id']) x WHERE x IS NOT NULL ORDER BY x LOOP
    delta:=public.gwcc_finance_effect(after_doc,acc)-public.gwcc_finance_effect(before_doc,acc);
    IF delta<>0 THEN
      IF EXISTS(SELECT 1 FROM public.church_accounts WHERE id=acc AND currency<>COALESCE(after_doc->>'currency',before_doc->>'currency')) THEN RAISE EXCEPTION 'Receipt and account currencies must match'; END IF;
      SELECT current_balance INTO balance FROM public.church_accounts WHERE id=acc AND is_active FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Account % is missing or inactive',acc; END IF;
      IF balance+delta<0 THEN RAISE EXCEPTION 'Insufficient balance in account %',acc; END IF;
      UPDATE public.church_accounts SET current_balance=current_balance+delta,updated_at=now() WHERE id=acc;
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS gwcc_finance_balance ON public.church_finances;
CREATE TRIGGER gwcc_finance_balance AFTER INSERT OR UPDATE OR DELETE ON public.church_finances
  FOR EACH ROW EXECUTE FUNCTION public.gwcc_apply_finance_balance();

-- A durable, idempotent batch is the only browser write entry point.
CREATE OR REPLACE FUNCTION public.gwcc_apply_mutations(p_operation_id uuid,p_changes jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c jsonb; doc jsonb; old_doc jsonb; result jsonb:='[]'; previous public.gwcc_applied_operations;
  t text; k text; ident text; op text; cols text; vals text; assignments text; saved jsonb; role_name text:=public.current_user_role();
  expected text; real_version text; namespace_name text; next_number text; checksum text:=md5(p_changes::text);
BEGIN
  IF role_name IN ('disabled','anon','member') THEN RAISE EXCEPTION 'Staff authorization is required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_changes)<>'array' OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
  SELECT * INTO previous FROM public.gwcc_applied_operations WHERE user_id=auth.uid() AND operation_id=p_operation_id;
  IF FOUND THEN
    IF previous.request_hash<>checksum THEN RAISE EXCEPTION 'Operation ID was reused with different data'; END IF;
    RETURN previous.result;
  END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    t:=c->>'table'; op:=c->>'operation'; doc:=c->'record'; ident:=COALESCE(c->>'id',doc->>'id'); saved:=NULL;
    IF t NOT IN ('settings','members','visitors','services','attendance','headcounts','giving','pledges','pledge_campaigns','expenses','ministries','small_groups','events','pastoral_care','prayer_requests','communications','audit_logs','welfare_contributions','welfare_claims','welfare_events','welfare_event_contributions','church_accounts','church_finances','roster_assignments','child_check_ins','department_budgets','assets','asset_maintenance_logs','foundation_cohorts','foundation_students','pastoral_visitations','counseling_sessions','intercessory_slots') THEN RAISE EXCEPTION 'Unknown table'; END IF;
    IF t='audit_logs' THEN
      IF op<>'upsert' THEN RAISE EXCEPTION 'Audit entries cannot be changed or deleted'; END IF;
      INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details,timestamp)
        VALUES(ident,auth.uid(),auth.uid()::text,role_name,COALESCE(doc->>'action','CLIENT_ACTION'),COALESCE(doc->>'module','System'),doc->>'record_id',left(COALESCE(doc->>'details',''),5000),now()) ON CONFLICT(id) DO NOTHING;
      CONTINUE;
    END IF;
    IF NOT public.gwcc_can_write(t) THEN RAISE EXCEPTION 'Not authorized to change %',t USING ERRCODE='42501'; END IF;
    IF ident IS NULL OR length(ident)>100 OR op NOT IN ('upsert','delete') THEN RAISE EXCEPTION 'Invalid mutation'; END IF;
    namespace_name:=NULL;
    IF t IN ('department_budgets','assets','asset_maintenance_logs','foundation_cohorts','foundation_students','pastoral_visitations','counseling_sessions','intercessory_slots') THEN
      namespace_name:=t;
      SELECT data INTO old_doc FROM public.gwcc_documents WHERE namespace=t AND id=ident FOR UPDATE;
    ELSE EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 FOR UPDATE',t) INTO old_doc USING ident; END IF;
    expected:=c->>'expected_updated_at'; real_version:=old_doc->>'updated_at';
    IF expected IS NOT NULL AND real_version IS NOT NULL AND expected::timestamptz<>real_version::timestamptz THEN RAISE EXCEPTION 'Record changed on another device. Refresh before retrying.' USING ERRCODE='40001'; END IF;
    IF op='delete' THEN
      IF t IN ('giving','church_finances','welfare_event_contributions') THEN RAISE EXCEPTION 'Financial records must be voided, not deleted'; END IF;
      IF t='church_accounts' AND EXISTS(SELECT 1 FROM public.church_finances WHERE account_id=ident OR to_account_id=ident) THEN RAISE EXCEPTION 'An account with ledger history cannot be deleted'; END IF;
      IF t IN ('members','services') AND EXISTS(SELECT 1 FROM public.giving WHERE member_id=ident OR service_id=ident) THEN RAISE EXCEPTION 'A record with giving history must be archived'; END IF;
      IF t='welfare_claims' AND COALESCE((old_doc->>'amount_disbursed')::numeric,0)>0 THEN RAISE EXCEPTION 'A disbursed claim cannot be deleted'; END IF;
      IF t='child_check_ins' THEN RAISE EXCEPTION 'Child check-in records must be preserved'; END IF;
      IF t='welfare_events' AND EXISTS(SELECT 1 FROM public.welfare_event_contributions WHERE event_id=ident) THEN RAISE EXCEPTION 'An event with receipts must be closed, not deleted'; END IF;
      IF namespace_name IS NOT NULL THEN DELETE FROM public.gwcc_documents WHERE namespace=t AND id=ident;
      ELSE EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING ident; END IF;
      result:=result||jsonb_build_array(jsonb_build_object('table',t,'id',ident,'deleted',true)); CONTINUE;
    END IF;
    IF jsonb_typeof(doc)<>'object' OR doc->>'id'<>ident THEN RAISE EXCEPTION 'Invalid record'; END IF;
    IF t='members' THEN
      IF old_doc IS NULL THEN
        next_number:=nextval('public.gwcc_member_number')::text;
        doc:=doc||jsonb_build_object('member_id','GWCC-'||lpad(next_number,GREATEST(6,length(next_number)),'0'));
        IF COALESCE(doc->>'tithe_number','')='' OR doc->>'tithe_number' LIKE 'PENDING-%' THEN
          LOOP next_number:='T-'||nextval('public.gwcc_tithe_number')::text;EXIT WHEN NOT EXISTS(SELECT 1 FROM public.members WHERE lower(tithe_number)=lower(next_number));END LOOP;
          doc:=doc||jsonb_build_object('tithe_number',next_number);
        END IF;
      ELSE doc:=doc||jsonb_build_object('member_id',old_doc->>'member_id'); END IF;
      IF COALESCE(doc->>'tithe_number','')<>'' AND EXISTS(SELECT 1 FROM public.members WHERE id<>ident AND lower(tithe_number)=lower(doc->>'tithe_number')) THEN RAISE EXCEPTION 'Tithe number is already assigned'; END IF;
      IF doc ? 'auth_user_id' AND role_name<>'super_admin' AND COALESCE(doc->>'auth_user_id','')<>COALESCE(old_doc->>'auth_user_id','') THEN RAISE EXCEPTION 'Only a super administrator may link a login account'; END IF;
    END IF;
    IF t IN ('giving','church_finances','welfare_event_contributions') AND (doc->>'amount' IN ('NaN','Infinity','-Infinity') OR (doc->>'amount')::numeric<=0) THEN RAISE EXCEPTION 'Enter a finite positive amount'; END IF;
    IF t='welfare_claims' THEN doc:=doc||jsonb_build_object('legacy_disbursed_amount',COALESCE(old_doc->'legacy_disbursed_amount','0')); END IF;
    IF t='church_accounts' THEN
      IF old_doc IS NOT NULL THEN doc:=doc||jsonb_build_object('current_balance',old_doc->'current_balance','opening_balance',old_doc->'opening_balance');
      ELSE doc:=doc||jsonb_build_object('opening_balance',COALESCE((doc->>'current_balance')::numeric,0)); END IF;
    END IF;
    IF t='church_finances' AND old_doc IS NOT NULL AND expected IS NULL THEN RAISE EXCEPTION 'A transaction version is required to change a saved receipt'; END IF;
    IF t='welfare_event_contributions' THEN
      IF (doc->>'amount')::numeric < COALESCE((SELECT GREATEST(20,minimum_contribution) FROM public.welfare_events WHERE id=doc->>'event_id'),20) THEN RAISE EXCEPTION 'Minimum welfare contribution is GHc20'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.welfare_events WHERE id=doc->>'event_id') THEN RAISE EXCEPTION 'Welfare event not found'; END IF;
      IF old_doc IS NULL AND NOT EXISTS(SELECT 1 FROM public.welfare_events WHERE id=doc->>'event_id' AND status='open') THEN RAISE EXCEPTION 'This welfare event is closed'; END IF;
    END IF;
    IF t='communications' THEN
      -- Delivery state belongs to a real provider adapter, never the browser.
      doc:=doc||jsonb_build_object('status','draft','cost',0);
    END IF;
    IF t='child_check_ins' THEN
      IF old_doc IS NULL THEN
        IF doc->>'status'<>'checked_in' OR doc->>'security_code' !~ '^GWCC-[A-F0-9]{12}$' THEN RAISE EXCEPTION 'Invalid check-in token'; END IF;
        doc:=doc||jsonb_build_object('checked_in_by',auth.uid()::text);
      ELSE
        IF (doc ? 'parent_name' AND doc->>'parent_name' IS DISTINCT FROM old_doc->>'parent_name') OR (doc ? 'alternate_pickup_name' AND doc->>'alternate_pickup_name' IS DISTINCT FROM old_doc->>'alternate_pickup_name') THEN RAISE EXCEPTION 'Guardian details cannot be changed after check-in'; END IF;
        IF doc->>'security_code' IS DISTINCT FROM old_doc->>'security_code' THEN RAISE EXCEPTION 'A pickup token cannot be changed'; END IF;
        IF old_doc->>'status'='checked_out' THEN RAISE EXCEPTION 'This child has already been checked out'; END IF;
        IF doc->>'status'='checked_out' THEN
          IF lower(trim(COALESCE(doc->>'checked_out_to_person',''))) NOT IN
            (lower(trim(old_doc->>'parent_name')),lower(trim(COALESCE(old_doc->>'alternate_pickup_name',''))))
            OR trim(COALESCE(doc->>'checked_out_to_person',''))='' THEN RAISE EXCEPTION 'Collector must match an authorized guardian'; END IF;
          doc:=doc||jsonb_build_object('verified_by_leader',auth.uid()::text,'check_out_time',to_char(now(),'HH24:MI'));
        END IF;
      END IF;
    END IF;
    doc:=(COALESCE(old_doc,'{}')||doc)-ARRAY['_expected_updated_at','_sync_status'];
    IF namespace_name IS NOT NULL THEN
      doc:=doc||jsonb_build_object('updated_at',now());
      INSERT INTO public.gwcc_documents(namespace,id,data) VALUES(t,ident,doc) ON CONFLICT(namespace,id) DO UPDATE SET data=excluded.data,updated_at=now(); saved:=doc;
    ELSE
      IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='updated_at') THEN doc:=doc||jsonb_build_object('updated_at',clock_timestamp()); END IF;
      SELECT string_agg(format('%I',key),',' ORDER BY key),string_agg(format('r.%I',key),',' ORDER BY key),string_agg(format('%I=EXCLUDED.%I',key,key),',' ORDER BY key) FILTER(WHERE key<>'id')
        INTO cols,vals,assignments FROM jsonb_object_keys(doc) key JOIN information_schema.columns co ON co.table_schema='public' AND co.table_name=t AND co.column_name=key;
      EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r ON CONFLICT(id) DO UPDATE SET %s RETURNING to_jsonb(%I.*)',t,cols,vals,t,assignments,t) INTO saved USING doc;
    END IF;
    result:=result||jsonb_build_array(jsonb_build_object('table',t,'record',saved));
    INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
      VALUES(gen_random_uuid()::text,auth.uid(),auth.uid()::text,role_name,upper(op),t,ident,'Authorized record mutation');
  END LOOP;
  FOR c IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    IF c->>'table'='church_finances' AND c->>'operation'='upsert' THEN
      IF EXISTS(SELECT 1 FROM public.welfare_event_contributions w JOIN public.church_finances f ON f.id=w.finance_transaction_id
        WHERE f.id=c->>'id' AND (f.amount<>w.amount OR (w.payment_status='confirmed' AND f.status<>'completed') OR (w.payment_status<>'confirmed' AND f.status<>'voided'))) THEN
        RAISE EXCEPTION 'Correct or void the linked welfare contribution together with its treasury receipt';
      END IF;
      IF EXISTS(SELECT 1 FROM public.welfare_claims w CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.disbursements,'[]')) d
        JOIN public.church_finances f ON f.id=d->>'finance_transaction_id' WHERE f.id=c->>'id' AND (f.amount<>(d->>'amount')::numeric OR f.status<>'completed')) THEN
        RAISE EXCEPTION 'A linked disbursement must be reconciled through the welfare claim';
      END IF;
    END IF;
    IF c->>'table'='welfare_event_contributions' AND c->>'operation'='upsert' THEN
      SELECT to_jsonb(w) INTO doc FROM public.welfare_event_contributions w WHERE id=c->>'id';
      IF COALESCE((doc->>'finance_linked')::boolean,false) OR doc->>'finance_transaction_id' IS NOT NULL THEN
        IF NOT EXISTS(SELECT 1 FROM public.church_finances f WHERE f.id=doc->>'finance_transaction_id'
          AND f.transaction_type='income' AND f.amount=(doc->>'amount')::numeric
          AND (CASE WHEN doc->>'payment_status'='confirmed' THEN f.status='completed' ELSE f.status='voided' END)) THEN
          RAISE EXCEPTION 'Welfare receipt and treasury entry must be saved together';
        END IF;
      END IF;
    END IF;
    IF c->>'table'='welfare_claims' AND c->>'operation'='upsert' THEN
      SELECT to_jsonb(w) INTO doc FROM public.welfare_claims w WHERE id=c->>'id';
      IF COALESCE((doc->>'amount_disbursed')::numeric,0)>COALESCE((doc->>'amount_approved')::numeric,0) THEN RAISE EXCEPTION 'Disbursement exceeds approved amount'; END IF;
      IF COALESCE((doc->>'amount_disbursed')::numeric,0)<>COALESCE((doc->>'legacy_disbursed_amount')::numeric,0)+COALESCE((SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(COALESCE(doc->'disbursements','[]')) d),0) THEN RAISE EXCEPTION 'Disbursement total does not match its payment receipts'; END IF;
      IF (SELECT count(*) FROM jsonb_array_elements(COALESCE(doc->'disbursements','[]')))<>(SELECT count(DISTINCT d->>'finance_transaction_id') FROM jsonb_array_elements(COALESCE(doc->'disbursements','[]')) d) THEN RAISE EXCEPTION 'Each payment needs a distinct treasury receipt'; END IF;
      FOR old_doc IN SELECT value FROM jsonb_array_elements(COALESCE(doc->'disbursements','[]')) LOOP
        IF EXISTS(SELECT 1 FROM public.welfare_claims w CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.disbursements,'[]')) d WHERE w.id<>doc->>'id' AND d->>'finance_transaction_id'=old_doc->>'finance_transaction_id') THEN RAISE EXCEPTION 'This receipt is already assigned to another claim'; END IF;
        IF NOT EXISTS(SELECT 1 FROM public.church_finances f WHERE f.id=old_doc->>'finance_transaction_id' AND f.transaction_type='disbursement' AND f.amount=(old_doc->>'amount')::numeric AND f.status='completed') THEN RAISE EXCEPTION 'Each disbursement needs its treasury receipt'; END IF;
      END LOOP;
    END IF;
  END LOOP;
  INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result) VALUES(auth.uid(),p_operation_id,checksum,result);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gwcc_consume_api_limit(p_bucket text,p_limit integer DEFAULT 20) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE used integer; start_at timestamptz:=date_trunc('minute',now()); max_allowed integer;
BEGIN
  IF public.current_user_role() IN ('disabled','anon') OR (public.current_user_role()='member' AND p_bucket<>'member_requests') THEN RETURN false; END IF;
  IF p_bucket NOT IN ('ai','staff','notifications','member_requests') THEN RAISE EXCEPTION 'Unknown rate limit bucket'; END IF;
  max_allowed:=CASE p_bucket WHEN 'ai' THEN 10 WHEN 'staff' THEN 10 WHEN 'notifications' THEN 30 ELSE 10 END;
  INSERT INTO public.gwcc_api_limits(user_id,bucket,window_start,count) VALUES(auth.uid(),p_bucket,start_at,1)
    ON CONFLICT(user_id,bucket,window_start) DO UPDATE SET count=gwcc_api_limits.count+1 RETURNING count INTO used;
  DELETE FROM public.gwcc_api_limits WHERE window_start<now()-interval '1 day';
  RETURN used<=max_allowed;
END;
$$;

-- Persistent notifications are derived from saved duties, never unauthenticated messages.
CREATE OR REPLACE FUNCTION public.gwcc_roster_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind text;
BEGIN
  IF NEW.member_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN kind:='ROSTER_ASSIGNED';
  ELSIF to_jsonb(NEW)-'updated_at'=to_jsonb(OLD)-'updated_at' THEN RETURN NEW;
  ELSE kind:=CASE NEW.status WHEN 'confirmed' THEN 'ROSTER_CONFIRMED' WHEN 'substituted' THEN 'ROSTER_SUBSTITUTED' ELSE 'ROSTER_UPDATED' END; END IF;
  INSERT INTO public.roster_notifications(id,member_id,duty_id,type,payload)
    VALUES(gen_random_uuid()::text,NEW.member_id,NEW.id,kind,
      jsonb_build_object('memberName',NEW.member_name,'serviceName',NEW.service_name,'date',NEW.date,
        'department',NEW.department,'roleTitle',NEW.role_title,'reportTime',NEW.report_time,'notes',NEW.notes,
        'message',NEW.service_name||': '||NEW.role_title||' on '||NEW.date::text||' ('||NEW.status||')'));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS gwcc_saved_roster_notification ON public.roster_assignments;
CREATE TRIGGER gwcc_saved_roster_notification AFTER INSERT OR UPDATE ON public.roster_assignments
  FOR EACH ROW EXECUTE FUNCTION public.gwcc_roster_changed();

CREATE OR REPLACE FUNCTION public.gwcc_member_action(p_action text,p_id text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved jsonb; old_row public.roster_assignments; m public.members; cohort jsonb; new_id text:=gen_random_uuid()::text; r text:=public.current_user_role();
BEGIN
  IF r IN ('disabled','anon') THEN RAISE EXCEPTION 'Sign-in is required' USING ERRCODE='42501'; END IF;
  IF p_action IN ('prayer','counseling','welfare','foundation') THEN
    IF NOT public.gwcc_owns_member(p_id) THEN RAISE EXCEPTION 'This is not your member account' USING ERRCODE='42501'; END IF;
    IF NOT public.gwcc_consume_api_limit('member_requests') THEN RAISE EXCEPTION 'Too many requests. Try again in a minute.'; END IF;
    SELECT * INTO m FROM public.members WHERE id=p_id;
    IF p_action='prayer' THEN
      IF length(trim(COALESCE(p_data->>'request',''))) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Enter a prayer request (up to 5000 characters)'; END IF;
      INSERT INTO public.prayer_requests(id,member_id,requester_name,requester_phone,category,request,date_submitted,status,is_confidential)
        VALUES(new_id,m.id,m.first_name||' '||m.last_name,m.phone,left(COALESCE(p_data->>'category','general'),100),p_data->>'request',current_date,'new',true)
        RETURNING to_jsonb(prayer_requests.*) INTO saved;
    ELSIF p_action='counseling' THEN
      IF length(trim(COALESCE(p_data->>'notes',''))) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Enter your counseling request (up to 5000 characters)'; END IF;
      INSERT INTO public.pastoral_care(id,member_id,member_name,member_phone,date,care_type,notes,is_confidential)
        VALUES(new_id,m.id,m.first_name||' '||m.last_name,m.phone,COALESCE((p_data->>'date')::date,current_date),'counseling',p_data->>'notes',true)
        RETURNING to_jsonb(pastoral_care.*) INTO saved;
    ELSIF p_action='welfare' THEN
      IF NOT ((p_data->>'amount_requested')::numeric>0 AND (p_data->>'amount_requested')::numeric<1000000000)
        OR length(trim(COALESCE(p_data->>'title','')))=0 OR length(trim(COALESCE(p_data->>'description','')))=0 THEN RAISE EXCEPTION 'Enter a title, description and positive requested amount'; END IF;
      INSERT INTO public.welfare_claims(id,claim_number,beneficiary_type,member_id,member_name,member_phone,category,title,description,amount_requested,status,emergency_level,date_submitted)
        VALUES(new_id,'BEN-'||upper(substr(new_id,1,8)),'member',m.id,m.first_name||' '||m.last_name,m.phone,
          p_data->>'category',left(p_data->>'title',200),left(p_data->>'description',5000),(p_data->>'amount_requested')::numeric,'pending',COALESCE(p_data->>'emergency_level','normal'),current_date)
        RETURNING to_jsonb(welfare_claims.*) INTO saved;
    ELSE
      SELECT data INTO cohort FROM public.gwcc_documents WHERE namespace='foundation_cohorts' AND id=p_data->>'cohort_id' AND data->>'status'='active';
      IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active foundation school cohort'; END IF;
      new_id:='enrollment-'||md5(m.id||':'||(cohort->>'id'));
      saved:=jsonb_build_object('id',new_id,'cohort_id',cohort->>'id','cohort_name',cohort->>'name','member_id',m.id,'member_name',m.first_name||' '||m.last_name,'member_phone',m.phone,'enrollment_date',current_date,'completed_modules','[]'::jsonb,'status','in_progress','created_at',now(),'updated_at',now());
      INSERT INTO public.gwcc_documents(namespace,id,data) VALUES('foundation_students',new_id,saved) ON CONFLICT(namespace,id) DO NOTHING;
    END IF;
  ELSIF p_action='profile' THEN
    IF NOT public.gwcc_owns_member(p_id) THEN RAISE EXCEPTION 'This is not your member profile' USING ERRCODE='42501'; END IF;
    UPDATE public.members SET phone=COALESCE(NULLIF(trim(p_data->>'phone'),''),phone),
      residential_address=COALESCE(p_data->>'residential_address',residential_address),
      gps_address=COALESCE(p_data->>'gps_address',gps_address),
      emergency_name=COALESCE(p_data->>'emergency_name',emergency_name),
      emergency_phone=COALESCE(p_data->>'emergency_phone',emergency_phone),updated_at=now()
      WHERE id=p_id RETURNING to_jsonb(members.*) INTO saved;
  ELSIF p_action='roster' THEN
    SELECT * INTO old_row FROM public.roster_assignments WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR NOT public.gwcc_owns_member(old_row.member_id) THEN RAISE EXCEPTION 'This is not your duty assignment' USING ERRCODE='42501'; END IF;
    IF p_data->>'status' NOT IN ('confirmed','substituted') THEN RAISE EXCEPTION 'Invalid duty response'; END IF;
    UPDATE public.roster_assignments SET status=p_data->>'status',notes=COALESCE(p_data->>'notes',notes),updated_at=now()
      WHERE id=p_id RETURNING to_jsonb(roster_assignments.*) INTO saved;
  ELSIF p_action='notification_read' THEN
    UPDATE public.roster_notifications SET read_at=now()
      WHERE (id=p_id OR p_id='all') AND read_at IS NULL AND public.gwcc_owns_member(member_id);
    RETURN '{"success":true}'::jsonb;
  ELSE RAISE EXCEPTION 'Unknown member action'; END IF;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,auth.uid(),auth.uid()::text,r,'MEMBER_'||upper(p_action),'Member Portal',p_id,'Verified member action');
  RETURN saved;
END;
$$;
CREATE OR REPLACE FUNCTION public.gwcc_member_records(p_table text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF public.current_user_role()<>'member' THEN RETURN '[]'::jsonb; END IF;
  IF p_table='welfare_claims' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(w)-ARRAY['pastoral_notes','confidential_pastoral_notes','reviewed_by','case_owner','disbursements','supporting_documents']),'[]') INTO result FROM public.welfare_claims w WHERE public.gwcc_owns_member(member_id);
  ELSIF p_table='pastoral_care' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'member_id',member_id,'member_name',member_name,'date',date,'care_type',care_type,'notes','Contact the pastoral office for appointment details.','is_confidential',true)),'[]') INTO result FROM public.pastoral_care WHERE public.gwcc_owns_member(member_id);
  ELSIF p_table='welfare_events' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(w)-'pastoral_notes'),'[]') INTO result FROM public.welfare_events w WHERE status='open';
  ELSIF p_table='foundation_cohorts' THEN
    SELECT COALESCE(jsonb_agg(data-'notes'),'[]') INTO result FROM public.gwcc_documents WHERE namespace=p_table AND data->>'status'='active';
  ELSIF p_table='foundation_students' THEN
    SELECT COALESCE(jsonb_agg(data-'notes'),'[]') INTO result FROM public.gwcc_documents WHERE namespace=p_table AND public.gwcc_owns_member(data->>'member_id');
  ELSE RAISE EXCEPTION 'Unknown member dataset'; END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.gwcc_member_records(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_member_records(text) TO authenticated;
CREATE POLICY gwcc_prayer_self_read ON public.prayer_requests FOR SELECT TO authenticated
  USING(public.current_user_role()='member' AND public.gwcc_owns_member(member_id));
CREATE POLICY gwcc_attendance_self_read ON public.attendance FOR SELECT TO authenticated
  USING(public.current_user_role()='member' AND public.gwcc_owns_member(member_id));

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='roster_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_notifications;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.gwcc_roster_changed() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gwcc_member_action(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_member_action(text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.gwcc_release_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF public.current_user_role()='disabled' THEN RAISE EXCEPTION 'A verified active account is required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('migration','20261015000001','role',public.current_user_role());
END;
$$;
REVOKE ALL ON FUNCTION public.gwcc_release_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_release_status() TO authenticated;

-- Grant only these deliberately exposed helpers; no blanket routine privileges.
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_owns_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_can_read(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_can_write(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_manage_profile(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_apply_mutations(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_consume_api_limit(text,integer) TO authenticated;

-- Remove every old bucket policy, including anonymous uploads and overwrites.
DO $$ DECLARE p record; BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'gwcc_%' LOOP
      EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname);
    END LOOP;
    CREATE POLICY gwcc_media_staff_read ON storage.objects FOR SELECT TO authenticated
      USING(bucket_id='gwcc-media' AND public.gwcc_can_read('members'));
    CREATE POLICY gwcc_media_staff_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK(bucket_id='gwcc-media' AND public.gwcc_can_write('members'));
    CREATE POLICY gwcc_media_staff_update ON storage.objects FOR UPDATE TO authenticated
      USING(bucket_id='gwcc-media' AND public.gwcc_can_write('members'))
      WITH CHECK(bucket_id='gwcc-media' AND public.gwcc_can_write('members'));
  END IF;
END $$;

UPDATE storage.buckets SET public=false WHERE id='gwcc-media';

-- New functions are private by default even on an owner with permissive defaults.
REVOKE ALL ON FUNCTION public.gwcc_new_auth_user(), public.gwcc_finance_effect(jsonb,text), public.gwcc_apply_finance_balance() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.current_user_role(),public.gwcc_owns_member(text),public.gwcc_can_read(text),public.gwcc_can_write(text),public.gwcc_manage_profile(text,jsonb),public.gwcc_apply_mutations(uuid,jsonb),public.gwcc_consume_api_limit(text,integer) FROM PUBLIC,anon;
