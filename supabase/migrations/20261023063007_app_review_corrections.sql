-- Shared giving instructions publish only explicitly approved account details.
-- Existing accounts, balances, receipts and document history are preserved.
CREATE OR REPLACE FUNCTION gwcc_private.giving_account_snapshot(p_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',id,'account_type',account_type,'account_number',btrim(account_number),
   'bank_or_provider',btrim(bank_or_provider),'currency',currency)
 FROM public.church_accounts WHERE id=p_id;
$$;
REVOKE ALL ON FUNCTION gwcc_private.giving_account_snapshot(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.giving_channels(p_manage boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r text:=public.current_user_role(); answer jsonb;
BEGIN
 IF r IN ('disabled','anon') OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Verified sign-in is required' USING ERRCODE='42501';END IF;
 IF p_manage AND r NOT IN ('super_admin','senior_pastor','finance_officer') THEN RAISE EXCEPTION 'Finance staff access is required' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(row_data ORDER BY row_data->>'bank_or_provider',row_data->>'id'),'[]') INTO answer FROM (
   SELECT gwcc_private.giving_account_snapshot(a.id)||jsonb_build_object('account_name',d.data->>'account_name')||
     CASE WHEN p_manage THEN jsonb_build_object('label',a.name,'is_active',a.is_active,
       'account_version',a.updated_at,'channel_version',d.data->>'updated_at',
       'enabled',coalesce((d.data->>'enabled')::boolean,false),
       'approved',coalesce((d.data->>'enabled')::boolean,false) AND d.data->>'fingerprint'=md5(gwcc_private.giving_account_snapshot(a.id)::text)) ELSE '{}'::jsonb END AS row_data
   FROM public.church_accounts a LEFT JOIN public.gwcc_documents d ON d.namespace='official_giving_channels' AND d.id=a.id
   WHERE a.account_type IN ('bank','momo') AND (p_manage OR
     (a.is_active AND nullif(btrim(a.account_number),'') IS NOT NULL AND (d.data->>'enabled')::boolean IS TRUE
      AND d.data->>'fingerprint'=md5(gwcc_private.giving_account_snapshot(a.id)::text)))
 ) published;
 RETURN answer;
END;
$$;

CREATE OR REPLACE FUNCTION gwcc_private.set_giving_channel(p_operation_id uuid,p_account_id text,p_account_version text,p_channel_version text,p_enabled boolean,p_account_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text:=public.current_user_role(); account public.church_accounts; previous jsonb; saved jsonb; receipt public.gwcc_applied_operations;
 checksum text:=md5(jsonb_build_object('kind','official_giving_channel','account',p_account_id,'account_version',p_account_version,'channel_version',p_channel_version,'enabled',p_enabled,'name',p_account_name)::text);
BEGIN
 IF auth.uid() IS NULL OR r NOT IN ('super_admin','senior_pastor','finance_officer') THEN RAISE EXCEPTION 'Finance staff access is required' USING ERRCODE='42501';END IF;
 IF p_operation_id IS NULL OR p_enabled IS NULL THEN RAISE EXCEPTION 'A complete publication request is required';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('giving-channel:'||auth.uid()::text||p_operation_id::text));
 SELECT * INTO receipt FROM public.gwcc_applied_operations WHERE user_id=auth.uid() AND operation_id=p_operation_id;
 IF FOUND THEN
   IF receipt.request_hash<>checksum THEN RAISE EXCEPTION 'Operation ID was reused with different data';END IF;
   RETURN receipt.result;
 END IF;
 SELECT * INTO account FROM public.church_accounts WHERE id=p_account_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Church account not found';END IF;
 IF p_account_version IS NULL OR account.updated_at IS DISTINCT FROM p_account_version::timestamptz THEN RAISE EXCEPTION 'The account changed. Refresh before approving its payment details' USING ERRCODE='40001';END IF;
 SELECT data INTO previous FROM public.gwcc_documents WHERE namespace='official_giving_channels' AND id=p_account_id FOR UPDATE;
 IF (previous->>'updated_at')::timestamptz IS DISTINCT FROM p_channel_version::timestamptz THEN RAISE EXCEPTION 'The giving channel changed. Refresh before retrying' USING ERRCODE='40001';END IF;
 IF p_enabled AND (NOT account.is_active OR account.account_type NOT IN ('bank','momo') OR nullif(btrim(account.account_number),'') IS NULL
   OR nullif(btrim(account.bank_or_provider),'') IS NULL OR nullif(btrim(p_account_name),'') IS NULL OR length(btrim(p_account_name))>160) THEN
   RAISE EXCEPTION 'Select an active bank or MoMo account with a number, provider and confirmed account holder name';
 END IF;
 saved:=jsonb_build_object('id',p_account_id,'account_id',p_account_id,'account_name',left(btrim(coalesce(p_account_name,'')),160),'enabled',p_enabled,
   'fingerprint',md5(gwcc_private.giving_account_snapshot(p_account_id)::text),'approved_by_id',auth.uid()::text,'updated_at',clock_timestamp());
 INSERT INTO public.gwcc_documents(namespace,id,data) VALUES('official_giving_channels',p_account_id,saved)
   ON CONFLICT(namespace,id) DO UPDATE SET data=excluded.data,updated_at=now();
 INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
   VALUES(gen_random_uuid()::text,auth.uid(),auth.uid()::text,r,CASE WHEN p_enabled THEN 'APPROVE_GIVING_CHANNEL' ELSE 'DISABLE_GIVING_CHANNEL' END,'Church Finance',p_account_id,'Official payment instructions updated by authorized finance staff');
 INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result) VALUES(auth.uid(),p_operation_id,checksum,saved);
 RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.gwcc_giving_channels() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.giving_channels(false)$$;
CREATE OR REPLACE FUNCTION public.gwcc_giving_channel_accounts() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.giving_channels(true)$$;
CREATE OR REPLACE FUNCTION public.gwcc_set_giving_channel(p_operation_id uuid,p_account_id text,p_account_version text,p_channel_version text,p_enabled boolean,p_account_name text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.set_giving_channel(p_operation_id,p_account_id,p_account_version,p_channel_version,p_enabled,p_account_name)$$;
REVOKE ALL ON FUNCTION gwcc_private.giving_channels(boolean),gwcc_private.set_giving_channel(uuid,text,text,text,boolean,text),public.gwcc_giving_channels(),public.gwcc_giving_channel_accounts(),public.gwcc_set_giving_channel(uuid,text,text,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.giving_channels(boolean),gwcc_private.set_giving_channel(uuid,text,text,text,boolean,text),public.gwcc_giving_channels(),public.gwcc_giving_channel_accounts(),public.gwcc_set_giving_channel(uuid,text,text,text,boolean,text) TO authenticated;

-- Cell meeting reports use the existing protected document store and durable sync.
CREATE OR REPLACE FUNCTION gwcc_private.prepare_cell_report(p_doc jsonb,p_old jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE field text; n numeric; total integer:=0; g public.small_groups; result jsonb:=p_doc;
BEGIN
 IF auth.uid() IS NULL OR public.current_user_role() NOT IN ('super_admin','senior_pastor','administrator','pastor') THEN RAISE EXCEPTION 'Cell reporting staff access is required' USING ERRCODE='42501';END IF;
 IF p_old IS NOT NULL THEN
   IF (p_old-'updated_at') IS NOT DISTINCT FROM (p_doc-'updated_at') THEN RETURN p_old;END IF;
   RAISE EXCEPTION 'Saved cell reports are preserved. Contact the church office to correct a report';
 END IF;
 SELECT * INTO g FROM public.small_groups WHERE id=p_doc->>'group_id';
 IF NOT FOUND THEN RAISE EXCEPTION 'Select a saved cell group before recording a report';END IF;
 IF coalesce(p_doc->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' OR (p_doc->>'date')::date>(now() AT TIME ZONE 'Africa/Accra')::date THEN RAISE EXCEPTION 'Enter a valid meeting date that is not in the future';END IF;
 IF nullif(btrim(p_doc->>'topic'),'') IS NULL OR length(p_doc->>'topic')>200 OR length(coalesce(p_doc->>'scripture',''))>250
   OR length(coalesce(p_doc->>'prayer_requests',''))>5000 OR length(coalesce(p_doc->>'testimonies',''))>5000 THEN RAISE EXCEPTION 'Enter a meeting topic and keep report text within its limits';END IF;
 FOREACH field IN ARRAY ARRAY['attendance_men','attendance_women','attendance_children','attendance_visitors','offering_amount'] LOOP
   IF coalesce(p_doc->>field,'') IN ('','NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter finite non-negative attendance and offering figures';END IF;
   n:=(p_doc->>field)::numeric;
   IF n<0 OR n>1000000000 OR (field<>'offering_amount' AND (n<>trunc(n) OR n>100000)) OR (field='offering_amount' AND n<>round(n,2)) THEN RAISE EXCEPTION 'Enter whole non-negative attendance counts and an offering amount with at most two decimals';END IF;
   result:=jsonb_set(result,ARRAY[field],to_jsonb(n));
   IF field<>'offering_amount' THEN total:=total+n::integer;END IF;
 END LOOP;
 RETURN (result-ARRAY['recorded_by','recorded_by_id','created_at','updated_at','total_attendance'])||jsonb_build_object(
   'group_name',g.name,'leader_name',g.leader_name,'total_attendance',total,'recorded_by_id',auth.uid()::text,
   'recorded_by',(SELECT concat_ws(' ',first_name,last_name) FROM public.profiles WHERE id=auth.uid()::text),'created_at',clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.prepare_cell_report(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

-- Patch the latest checked implementations, retaining every prior finance guard.
DO $migration$
DECLARE definition text; previous text;
BEGIN
 SELECT pg_get_functiondef('public.gwcc_can_read(text)'::regprocedure) INTO definition;
 previous:=definition;definition:=replace(definition,'  IF p_table=''communications''',E'  IF p_table=''cell_meeting_reports'' THEN RETURN r IN (''administrator'',''pastor'');END IF;\n  IF p_table=''communications''');
 IF definition=previous THEN RAISE EXCEPTION 'Cell report read permission patch did not match';END IF;EXECUTE definition;
 SELECT pg_get_functiondef('public.gwcc_can_write(text)'::regprocedure) INTO definition;
 previous:=definition;definition:=replace(definition,'  IF p_table IN (''church_accounts''',E'  IF p_table=''cell_meeting_reports'' THEN RETURN r IN (''administrator'',''pastor'');END IF;\n  IF p_table IN (''church_accounts''');
 IF definition=previous THEN RAISE EXCEPTION 'Cell report write permission patch did not match';END IF;EXECUTE definition;
 SELECT pg_get_functiondef('public.gwcc_apply_mutations(uuid,jsonb)'::regprocedure) INTO definition;
 previous:=definition;
 definition:=replace(definition,'''counseling_sessions'',''intercessory_slots'')','''counseling_sessions'',''intercessory_slots'',''cell_meeting_reports'')');
 definition:=replace(definition,'    IF t NOT IN (',E'    IF t=''pastoral_counseling'' THEN t:=''counseling_sessions'';END IF;\n    IF t NOT IN (');
 definition:=replace(definition,'    IF op=''delete'' THEN',E'    IF t=''cell_meeting_reports'' AND op=''delete'' THEN RAISE EXCEPTION ''Cell meeting reports must be preserved'';END IF;\n    IF op=''delete'' THEN');
 definition:=replace(definition,'    IF t=''members'' THEN',E'    IF t=''cell_meeting_reports'' THEN doc:=gwcc_private.prepare_cell_report(doc,old_doc);END IF;\n    IF t=''members'' THEN');
 definition:=replace(definition,'''table'',t,''id'',ident,''deleted'',true','''table'',c->>''table'',''canonical_table'',t,''id'',ident,''deleted'',true');
 definition:=replace(definition,'''table'',t,''record'',saved','''table'',c->>''table'',''canonical_table'',t,''record'',saved');
 IF definition=previous OR position('prepare_cell_report(doc,old_doc)' IN definition)=0 OR position('''cell_meeting_reports'')' IN definition)=0 THEN RAISE EXCEPTION 'Checked mutation patch did not match';END IF;
 EXECUTE definition;
END;
$migration$;
