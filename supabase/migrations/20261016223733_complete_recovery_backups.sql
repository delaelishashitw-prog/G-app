-- Application recovery points are private, bounded copies in this database.
-- Independent encrypted downloads are needed for project-loss protection.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE IF NOT EXISTS gwcc_private.backup_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  source_id uuid NOT NULL DEFAULT gen_random_uuid()
);
INSERT INTO gwcc_private.backup_identity(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS gwcc_private.recovery_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL UNIQUE,
  kind text NOT NULL CHECK(kind IN ('daily','manual')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id uuid,
  payload_text text NOT NULL,
  digest text NOT NULL,
  counts jsonb NOT NULL,
  byte_count integer NOT NULL CHECK(byte_count BETWEEN 1 AND 41943040),
  media_count integer NOT NULL,
  rehearsed_at timestamptz
);
ALTER TABLE gwcc_private.backup_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE gwcc_private.recovery_points ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gwcc_private.backup_identity,gwcc_private.recovery_points FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION gwcc_private.backup_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT ARRAY[
  'gwcc_private.finance_reference_reservations','gwcc_private.sms_dispatches','gwcc_private.sync_recoveries',
  'public.attendance','public.audit_logs','public.child_check_ins','public.church_accounts','public.church_finances',
  'public.communications','public.events','public.expenses','public.giving','public.gwcc_api_limits',
  'public.gwcc_applied_operations','public.gwcc_documents','public.headcounts','public.members','public.ministries',
  'public.pastoral_care','public.pledge_campaigns','public.pledges','public.prayer_requests','public.profiles',
  'public.roster_assignments','public.roster_managers','public.roster_notifications','public.services','public.settings',
  'public.small_groups','public.visitors','public.welfare_claims','public.welfare_contributions',
  'public.welfare_event_contributions','public.welfare_events'
]::text[];$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_tables() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION gwcc_private.backup_media() RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name,
    'metadata',to_jsonb(o)->'metadata','updated_at',to_jsonb(o)->'updated_at') ORDER BY bucket_id,name),'[]') FROM storage.objects o;
$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_media() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION gwcc_private.backup_authorize() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only the reviewed super administrator can manage church recovery files' USING ERRCODE='42501';
  END IF;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_authorize() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION gwcc_private.backup_capture(p_kind text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE tables text[]:=gwcc_private.backup_tables(); rel text; rows jsonb; records jsonb:='{}'; totals jsonb:='{}';
  payload jsonb; raw text; point_id uuid; slot_name text; media jsonb; source uuid; revision text; now_at timestamptz:=clock_timestamp();
BEGIN
  IF p_kind='manual' THEN
    PERFORM gwcc_private.backup_authorize();
  ELSIF p_kind IS DISTINCT FROM 'daily' OR auth.uid() IS NOT NULL OR session_user NOT IN ('postgres','supabase_admin') THEN
    RAISE EXCEPTION 'The daily recovery job is administrator-managed' USING ERRCODE='42501';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('gwcc-record-backup',0)) THEN
    RAISE EXCEPTION 'A recovery point is being created. Try again shortly';
  END IF;
  slot_name:=CASE WHEN p_kind='daily' THEN 'daily-'||to_char(now_at AT TIME ZONE 'UTC','YYYY-MM-DD') ELSE gen_random_uuid()::text END;
  SELECT id INTO point_id FROM gwcc_private.recovery_points WHERE slot=slot_name;
  IF point_id IS NOT NULL THEN RETURN point_id; END IF;
  IF p_kind='manual' AND (SELECT count(*) FROM gwcc_private.recovery_points WHERE kind='manual' AND created_at>now_at-interval '10 minutes')>=2 THEN
    RAISE EXCEPTION 'Two recent manual recovery points are available. Download an existing point or wait ten minutes';
  END IF;
  -- Fail visibly when a future module is absent from the coverage manifest.
  IF EXISTS(SELECT 1 FROM information_schema.tables t WHERE t.table_schema IN ('public','gwcc_private')
    AND t.table_type='BASE TABLE' AND t.table_schema||'.'||t.table_name<>ALL(tables)
    AND t.table_schema||'.'||t.table_name NOT IN ('gwcc_private.backup_identity','gwcc_private.recovery_points')) THEN
    RAISE EXCEPTION 'A new church table needs to be added to backup coverage';
  END IF;
  -- Hold a consistent record set while copying related tables; readers stay available.
  FOREACH rel IN ARRAY tables LOOP EXECUTE format('LOCK TABLE %s IN SHARE MODE NOWAIT',rel::regclass); END LOOP;
  FOREACH rel IN ARRAY tables LOOP
    EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %s r',rel::regclass) INTO rows;
    records:=records||jsonb_build_object(rel,rows);
    totals:=totals||jsonb_build_object(rel,jsonb_array_length(rows));
  END LOOP;
  media:=gwcc_private.backup_media();
  SELECT source_id INTO source FROM gwcc_private.backup_identity WHERE singleton;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT max(version) FROM supabase_migrations.schema_migrations' INTO revision;
  END IF;
  payload:=jsonb_build_object('format','gwcc-records-v1','source_id',source,'created_at',now_at,
    'schema_revision',revision,'tables',records,'counts',totals,'storage_objects',media,
    'exclusions',jsonb_build_array('Supabase Auth accounts and sessions','Provider secrets and project configuration','Storage file bytes','Other devices pending changes'));
  raw:=payload::text;
  IF octet_length(raw)>41943040 THEN RAISE EXCEPTION 'Recovery point exceeds 40 MB. Arrange an administrator database backup'; END IF;
  INSERT INTO gwcc_private.recovery_points(slot,kind,actor_id,payload_text,digest,counts,byte_count,media_count)
    VALUES(slot_name,p_kind,auth.uid(),raw,encode(sha256(convert_to(raw,'UTF8')),'hex'),totals,octet_length(raw),jsonb_array_length(media)) RETURNING id INTO point_id;
  DELETE FROM gwcc_private.recovery_points p WHERE p.id IN
    (SELECT id FROM gwcc_private.recovery_points WHERE kind='daily' ORDER BY created_at DESC OFFSET 7)
    OR p.id IN (SELECT id FROM gwcc_private.recovery_points WHERE kind='manual' ORDER BY created_at DESC OFFSET 2);
  RETURN point_id;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_capture(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION gwcc_private.backup_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scheduled boolean:=false; points jsonb; source uuid; run jsonb;
BEGIN
  PERFORM gwcc_private.backup_authorize();
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname=''gwcc-daily-record-recovery'' AND active AND schedule=''0 3 * * *'')' INTO scheduled;
    EXECUTE 'SELECT jsonb_build_object(''status'',r.status,''ended_at'',r.end_time) FROM cron.job_run_details r JOIN cron.job j USING(jobid) WHERE j.jobname=''gwcc-daily-record-recovery'' ORDER BY r.start_time DESC LIMIT 1' INTO run;
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(p)-'payload_text'-'actor_id'-'slot' ORDER BY p.created_at DESC),'[]') INTO points FROM gwcc_private.recovery_points p;
  SELECT source_id INTO source FROM gwcc_private.backup_identity WHERE singleton;
  RETURN jsonb_build_object('source_id',source,'daily_enabled',scheduled,'daily_time_utc','03:00','retention_daily',7,'retention_manual',2,
    'last_run',run,'points',points,'tables',gwcc_private.backup_tables());
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.backup_status() TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_backup_status() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.backup_status();$$;
REVOKE ALL ON FUNCTION public.gwcc_backup_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_backup_status() TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.backup_create() RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT gwcc_private.backup_capture('manual');$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_create() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.backup_create() TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_backup_create() RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.backup_create();$$;
REVOKE ALL ON FUNCTION public.gwcc_backup_create() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_backup_create() TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.backup_export(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p gwcc_private.recovery_points;
BEGIN
  PERFORM gwcc_private.backup_authorize();
  SELECT * INTO p FROM gwcc_private.recovery_points WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This recovery point is no longer available. Reload recovery points'; END IF;
  IF p.digest IS DISTINCT FROM encode(sha256(convert_to(p.payload_text,'UTF8')),'hex') THEN RAISE EXCEPTION 'Recovery point checksum failed'; END IF;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,auth.uid(),auth.uid()::text,'super_admin','EXPORT_RECOVERY_FILE','Backup & Recovery',p.id::text,'Recovery records requested for encrypted download; file saving is confirmed on the device.');
  RETURN jsonb_build_object('id',p.id,'payload_text',p.payload_text,'digest',p.digest);
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_export(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.backup_export(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_backup_export(p_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.backup_export(p_id);$$;
REVOKE ALL ON FUNCTION public.gwcc_backup_export(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_backup_export(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.backup_media_check(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved jsonb;
BEGIN
  PERFORM gwcc_private.backup_authorize();
  SELECT payload_text::jsonb->'storage_objects' INTO saved FROM gwcc_private.recovery_points WHERE id=p_id;
  IF saved IS NULL OR saved IS DISTINCT FROM gwcc_private.backup_media() THEN
    RAISE EXCEPTION 'Storage files changed after this recovery point. Create a fresh point before downloading a complete file';
  END IF;
  RETURN true;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_media_check(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.backup_media_check(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_backup_media_check(p_id uuid) RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.backup_media_check(p_id);$$;
REVOKE ALL ON FUNCTION public.gwcc_backup_media_check(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_backup_media_check(uuid) TO authenticated;

-- A rehearsal reconstructs each table separately without triggers or live writes.
-- Auth restoration and cross-table/business reconciliation remain an operator procedure.
CREATE OR REPLACE FUNCTION gwcc_private.backup_rehearse(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p gwcc_private.recovery_points; doc jsonb; rel text; copied jsonb; expected jsonb; checked integer:=0;
BEGIN
  PERFORM gwcc_private.backup_authorize();
  SELECT * INTO p FROM gwcc_private.recovery_points WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This recovery point is no longer available'; END IF;
  IF p.digest IS DISTINCT FROM encode(sha256(convert_to(p.payload_text,'UTF8')),'hex') THEN RAISE EXCEPTION 'Recovery point checksum failed'; END IF;
  doc:=p.payload_text::jsonb;
  FOREACH rel IN ARRAY gwcc_private.backup_tables() LOOP
    IF jsonb_typeof(doc->'tables'->rel) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing backup table: %',rel; END IF;
    DROP TABLE IF EXISTS pg_temp.gwcc_record_rehearsal;
    EXECUTE format('CREATE TEMP TABLE gwcc_record_rehearsal (LIKE %s INCLUDING ALL) ON COMMIT DROP',rel::regclass);
    EXECUTE format('INSERT INTO pg_temp.gwcc_record_rehearsal SELECT * FROM jsonb_populate_recordset(NULL::%s,$1)',rel::regclass) USING doc->'tables'->rel;
    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') INTO copied FROM pg_temp.gwcc_record_rehearsal r;
    SELECT COALESCE(jsonb_agg(x ORDER BY x::text),'[]') INTO expected FROM jsonb_array_elements(doc->'tables'->rel) x;
    IF copied IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Recovery values differ for %',rel; END IF;
    checked:=checked+1;
  END LOOP;
  DROP TABLE IF EXISTS pg_temp.gwcc_record_rehearsal;
  UPDATE gwcc_private.recovery_points SET rehearsed_at=clock_timestamp() WHERE id=p.id;
  RETURN jsonb_build_object('tables_checked',checked,'rehearsed_at',clock_timestamp());
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_rehearse(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.backup_rehearse(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_backup_rehearse(p_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.backup_rehearse(p_id);$$;
REVOKE ALL ON FUNCTION public.gwcc_backup_rehearse(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_backup_rehearse(uuid) TO authenticated;

-- pg_cron is absent in local WASM tests; production installs it above.
DO $schedule$ BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.schedule('gwcc-daily-record-recovery','0 3 * * *',
      $job$SELECT gwcc_private.backup_capture('daily'); DELETE FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='gwcc-daily-record-recovery') AND end_time<now()-interval '14 days';$job$);
  END IF;
END;$schedule$;
