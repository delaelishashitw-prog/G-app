-- Prepare protected review fields independently of the coordinated app upgrade.
-- An administrator is selected separately by exact verified Auth UUID using
-- bootstrap-super-admin.sql; this migration grants no account a role.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS authorization_reviewed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_login_account boolean NOT NULL DEFAULT true;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.profiles FROM PUBLIC,anon,authenticated;
