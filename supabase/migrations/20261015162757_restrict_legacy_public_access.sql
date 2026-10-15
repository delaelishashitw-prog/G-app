-- Standalone mitigation for a legacy installation awaiting the coordinated
-- application/checked-RPC upgrade. No church records or balances are rewritten.
-- Signed-in table grants are preserved except direct staff-profile mutations.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC,anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.profiles FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM PUBLIC,anon;

DO $$ DECLARE v text; f text; BEGIN
  FOR v IN SELECT viewname FROM pg_views WHERE schemaname='public' LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',v);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['handle_updated_at','handle_member_date_sync','handle_pledge_balance'] LOOP
    IF to_regprocedure(format('public.%I()',f)) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION public.%I() SET search_path = %L',f,'');
    END IF;
  END LOOP;
END $$;

-- These older policies admitted unsigned media reads, uploads and overwrites.
DROP POLICY IF EXISTS gwcc_storage_public_read ON storage.objects;
DROP POLICY IF EXISTS gwcc_storage_public_insert ON storage.objects;
DROP POLICY IF EXISTS gwcc_storage_public_update ON storage.objects;
UPDATE storage.buckets SET public=false WHERE id='gwcc-media';
NOTIFY pgrst, 'reload schema';
