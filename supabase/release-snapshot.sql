-- Run as database owner in the SAME transaction as the production upgrade.
-- This is a private logical recovery snapshot, not a physical/PITR backup.
-- The fixed release name makes retries preserve the original snapshot.
CREATE SCHEMA IF NOT EXISTS gwcc_release_backup_20261015;
REVOKE ALL ON SCHEMA gwcc_release_backup_20261015 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE IF NOT EXISTS gwcc_release_backup_20261015.snapshots (
  name text PRIMARY KEY, captured_at timestamptz NOT NULL DEFAULT now(),
  row_count bigint NOT NULL, content jsonb NOT NULL, checksum text NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA gwcc_release_backup_20261015 FROM PUBLIC,anon,authenticated,service_role;

DO $$
DECLARE relation record; content jsonb;
BEGIN
  IF EXISTS(SELECT 1 FROM gwcc_release_backup_20261015.snapshots WHERE name='manifest') THEN RETURN; END IF;
  -- Block legacy app writes while taking the snapshot and changing permissions.
  -- These transaction-scoped locks remain held through the security upgrade.
  FOR relation IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE MODE',relation.relname);
  END LOOP;
  FOR relation IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname LOOP
    EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM public.%I t',relation.relname) INTO content;
    INSERT INTO gwcc_release_backup_20261015.snapshots(name,row_count,content,checksum)
      VALUES('public.'||relation.relname,jsonb_array_length(content),content,md5(content::text));
  END LOOP;
  SELECT jsonb_build_object(
    'columns',(SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public'),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'),
    'indexes',(SELECT jsonb_agg(to_jsonb(i)) FROM pg_indexes i WHERE schemaname='public'),
    'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname IN ('public','storage')),
    'grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_table_grants g WHERE table_schema IN ('public','storage')),
    'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'acl',p.proacl,'definition',pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')),
    'views',(SELECT jsonb_agg(to_jsonb(v)) FROM pg_views v WHERE schemaname='public'),
    'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'definition',pg_get_triggerdef(t.oid))) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users'))),
    'relations',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'acl',c.relacl,'rls',c.relrowsecurity,'options',c.reloptions)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
    'default_acl',(SELECT jsonb_agg(to_jsonb(d)) FROM pg_default_acl d),
    'storage_buckets',(SELECT jsonb_agg(to_jsonb(b)) FROM storage.buckets b),
    'storage_objects',(SELECT jsonb_agg(to_jsonb(o)) FROM storage.objects o)
  ) INTO content;
  INSERT INTO gwcc_release_backup_20261015.snapshots(name,row_count,content,checksum) VALUES('schema',1,content,md5(content::text));
  content:=jsonb_build_object('release','20261015','captured_at',now(),'scope','public table rows, public schema/security definitions and storage metadata','physical_backup',false);
  INSERT INTO gwcc_release_backup_20261015.snapshots(name,row_count,content,checksum) VALUES('manifest',1,content,md5(content::text));
END $$;
