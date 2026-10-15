-- Run after release-snapshot.sql and the upgrade, before committing cutover.
-- SET LOCAL gwcc.release_administrator to the confirmed verified Auth UUID.
DO $$
DECLARE snapshot record; missing bigint; expression text;
  expected_admin text:=current_setting('gwcc.release_administrator');
  previous_subject text:=current_setting('request.jwt.claim.sub',true);
BEGIN
  FOR snapshot IN SELECT name,content FROM gwcc_release_backup_20261015.snapshots WHERE name LIKE 'public.%' LOOP
    IF snapshot.name='public.profiles' THEN
      SELECT count(*) INTO missing FROM jsonb_array_elements(snapshot.content) old
        WHERE NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=old->>'id' AND p.role=old->>'role');
    ELSE
      expression:=CASE snapshot.name
        WHEN 'public.church_accounts' THEN 'old - ''updated_at'' - ''opening_balance'''
        WHEN 'public.welfare_claims' THEN 'old - ''updated_at'' - ''amount_disbursed'' - ''legacy_disbursed_amount'''
        ELSE 'old' END;
      EXECUTE format('SELECT count(*) FROM jsonb_array_elements($1) old WHERE NOT EXISTS(SELECT 1 FROM %s t WHERE to_jsonb(t) @> (%s))',snapshot.name::regclass,expression)
        INTO missing USING snapshot.content;
    END IF;
    IF missing<>0 THEN RAISE EXCEPTION 'Release changed or lost % original rows in %',missing,snapshot.name; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')
      AND has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Anonymous public relation privileges remain';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Unchecked authenticated table writes remain';
  END IF;
  IF has_schema_privilege('authenticated','gwcc_release_backup_20261015','USAGE') OR has_schema_privilege('anon','gwcc_release_backup_20261015','USAGE') THEN
    RAISE EXCEPTION 'Recovery snapshot is exposed';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',expected_admin,true);
  IF public.current_user_role()<>'super_admin' THEN RAISE EXCEPTION 'Confirmed administrator is not authorized'; END IF;
  IF public.gwcc_release_status()->>'migration'<>'20261015000001' THEN RAISE EXCEPTION 'Release marker is missing'; END IF;
  PERFORM set_config('request.jwt.claim.sub',COALESCE(previous_subject,''),true);
END $$;
