-- A single SELECT supplies one MVCC snapshot across all covered tables.
-- Streaming JSON avoids repeatedly rebuilding large binary JSON photo/receipt trees.
CREATE OR REPLACE FUNCTION gwcc_private.backup_capture(p_kind text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE tables text[]:=gwcc_private.backup_tables(); rel text; key_order text; query_parts text[]:='{}'; records json; totals jsonb;
  payload json; raw text; point_id uuid; slot_name text; media jsonb; source uuid; revision text; now_at timestamptz:=clock_timestamp();
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
  FOREACH rel IN ARRAY tables LOOP
    SELECT string_agg(format('r.%I',a.attname),',' ORDER BY k.ord) INTO key_order
      FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ord)
      JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
      WHERE i.indrelid=rel::regclass AND i.indisprimary;
    IF key_order IS NULL THEN RAISE EXCEPTION 'A backup table needs a primary key: %',rel; END IF;
    query_parts:=array_append(query_parts,format('SELECT %L AS name,COALESCE(json_agg(row_to_json(r) ORDER BY %s),''[]''::json) AS rows,count(*)::integer AS row_count FROM %s r',rel,key_order,rel::regclass));
  END LOOP;
  -- Assemble large JSON documents once, without sorting full photo/receipt payloads
  -- or repeatedly copying all previously collected modules.
  EXECUTE 'SELECT json_object_agg(name,rows),jsonb_object_agg(name,row_count),gwcc_private.backup_media() FROM ('||array_to_string(query_parts,' UNION ALL ')||') covered'
    INTO records,totals,media;
  SELECT source_id INTO source FROM gwcc_private.backup_identity WHERE singleton;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT max(version) FROM supabase_migrations.schema_migrations' INTO revision;
  END IF;
  payload:=json_build_object('format','gwcc-records-v1','source_id',source,'created_at',now_at,
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

CREATE OR REPLACE FUNCTION gwcc_private.backup_authorize() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'super_admin'
    OR EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND (to_jsonb(u)->>'banned_until')::timestamptz>now()) THEN
    RAISE EXCEPTION 'Only the reviewed super administrator can manage church recovery files' USING ERRCODE='42501';
  END IF;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.backup_authorize() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst, 'reload schema';
