-- Run as the database owner AFTER the migrations, in the intended project.
-- First create/confirm the administrator in Supabase Auth.
-- Replace NULL with that verified account's UUID, e.g. '...'::uuid.
-- Never select an account by display name or grant every account this role.
BEGIN;
DO $$
DECLARE chosen_user uuid := NULL;
BEGIN
  IF chosen_user IS NULL THEN RAISE EXCEPTION 'Set chosen_user to the verified administrator Auth UUID before running this script'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=chosen_user AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'The chosen account must exist and have a verified email';
  END IF;
  UPDATE public.profiles SET role='super_admin',is_active=true,has_login_account=true,
    authorization_reviewed_at=now(),updated_at=now() WHERE id=chosen_user::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'A matching protected profile is missing. Apply the security migration first'; END IF;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,chosen_user,'Database owner','super_admin','BOOTSTRAP_ADMIN','Security',chosen_user::text,'Database owner reviewed and activated the initial administrator');
END $$;
COMMIT;
