-- Keep the new guardian relationship table inside the church recovery coverage.
-- The recovery manifest intentionally fails closed for any unlisted public table.
CREATE OR REPLACE FUNCTION gwcc_private.backup_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT ARRAY[
  'gwcc_private.finance_reference_reservations','gwcc_private.sms_dispatches','gwcc_private.sync_recoveries',
  'public.attendance','public.audit_logs','public.child_check_ins',
  'public.church_accounts','public.church_finances','public.communications','public.events','public.expenses',
  'public.giving','public.gwcc_api_limits','public.gwcc_applied_operations','public.gwcc_documents',
  'public.headcounts','public.member_guardians','public.members','public.ministries','public.pastoral_care',
  'public.pledge_campaigns','public.pledges','public.prayer_requests','public.profiles','public.roster_assignments',
  'public.roster_managers','public.roster_notifications','public.services','public.settings','public.small_groups',
  'public.visitors','public.welfare_claims','public.welfare_contributions','public.welfare_event_contributions',
  'public.welfare_events'
]::text[];$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_tables() FROM PUBLIC,anon,authenticated,service_role;
