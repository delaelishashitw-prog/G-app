-- SMS credentials stay in Edge Function secrets. No existing draft/contact is rewritten.
CREATE TABLE IF NOT EXISTS gwcc_private.sms_dispatches (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  draft_id text REFERENCES public.communications(id) ON DELETE RESTRICT,
  request_hash text NOT NULL,
  fingerprint text,
  snapshot jsonb NOT NULL,
  estimated_units integer NOT NULL CHECK (estimated_units BETWEEN 1 AND 500),
  state text NOT NULL DEFAULT 'started' CHECK (state IN ('started','submitted','rejected','unknown')),
  outcomes jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS sms_dispatch_fingerprint ON gwcc_private.sms_dispatches(fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_dispatch_created ON gwcc_private.sms_dispatches(created_at DESC);
CREATE INDEX IF NOT EXISTS sms_dispatch_draft ON gwcc_private.sms_dispatches(draft_id);
ALTER TABLE gwcc_private.sms_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gwcc_private.sms_dispatches FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS sms_service_only ON gwcc_private.sms_dispatches;
CREATE POLICY sms_service_only ON gwcc_private.sms_dispatches TO service_role USING(true) WITH CHECK(true);
GRANT USAGE ON SCHEMA gwcc_private TO service_role;

CREATE OR REPLACE FUNCTION gwcc_private.sms_actor(p_actor uuid,p_send boolean) RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT p.role FROM public.profiles p JOIN auth.users u ON u.id::text=p.id
  WHERE u.id=p_actor AND u.email_confirmed_at IS NOT NULL AND p.is_active IS TRUE
    AND p.has_login_account IS TRUE AND p.authorization_reviewed_at IS NOT NULL
    AND (p.role IN ('super_admin','senior_pastor','administrator') OR (NOT p_send AND p.role IN ('pastor','ministry_leader')));
$$;
REVOKE ALL ON FUNCTION gwcc_private.sms_actor(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION gwcc_private.sms_snapshot(p_actor uuid,p_draft_id text,p_version text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.communications; people jsonb; recipients jsonb; excluded jsonb; current_ids text[]; doc jsonb;
BEGIN
  IF gwcc_private.sms_actor(p_actor,true) IS NULL THEN RAISE EXCEPTION 'Your role cannot send SMS' USING ERRCODE='42501';END IF;
  SELECT * INTO d FROM public.communications WHERE id=p_draft_id;
  IF NOT FOUND OR d.status IS DISTINCT FROM 'draft' OR d.channel IS DISTINCT FROM 'sms' OR d.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Choose an active SMS draft';END IF;
  IF p_version IS NULL OR d.updated_at IS NULL OR d.updated_at IS DISTINCT FROM p_version::timestamptz THEN RAISE EXCEPTION 'Save this draft and wait for cloud confirmation before reviewing SMS';END IF;
  IF d.recipient_ids IS NULL OR d.recipient_type='custom' THEN RAISE EXCEPTION 'Review and save this older draft audience first';END IF;
  IF d.recipient_type='ministry' AND NOT EXISTS(SELECT 1 FROM public.ministries WHERE id=d.recipient_group_id)
    OR d.recipient_type='small_group' AND NOT EXISTS(SELECT 1 FROM public.small_groups WHERE id=d.recipient_group_id) THEN RAISE EXCEPTION 'This recipient group is no longer available';END IF;
  WITH candidates AS (
    SELECT id,concat_ws(' ',first_name,last_name) AS name,gwcc_private.communication_phone(phone) AS phone FROM public.members
    WHERE d.recipient_type<>'visitors' AND is_archived IS NOT TRUE AND status IN ('active','leader','new_member','new_convert')
      AND (d.recipient_type='all_members' OR (d.recipient_type='leaders' AND (status='leader' OR NULLIF(btrim(leadership_position),'') IS NOT NULL))
        OR (d.recipient_type='ministry' AND ministry_id=d.recipient_group_id) OR (d.recipient_type='small_group' AND small_group_id=d.recipient_group_id))
    UNION ALL SELECT id,full_name,gwcc_private.communication_phone(phone) FROM public.visitors
    WHERE d.recipient_type='visitors' AND COALESCE(follow_up_status,'new') NOT IN ('closed','converted_to_member')
  ), unique_phones AS (SELECT DISTINCT ON (phone) id,name,phone FROM candidates WHERE phone IS NOT NULL ORDER BY phone,id COLLATE "C")
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone) ORDER BY id COLLATE "C"),'[]'),
    COALESCE(array_agg(id ORDER BY id COLLATE "C"),'{}') INTO people,current_ids FROM unique_phones;
  IF current_ids IS DISTINCT FROM (SELECT COALESCE(array_agg(x ORDER BY x COLLATE "C"),'{}') FROM unnest(d.recipient_ids) x) THEN
    RAISE EXCEPTION 'The audience changed. Refresh the directory, save the draft and review recipients again';END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'id'),'[]') INTO recipients FROM jsonb_array_elements(people) x WHERE x->>'phone' ~ '^233[25][0-9]{8}$';
  SELECT COALESCE(jsonb_agg(x||jsonb_build_object('reason','Ghana mobile numbers only for this connection') ORDER BY x->>'id'),'[]') INTO excluded FROM jsonb_array_elements(people) x WHERE x->>'phone' !~ '^233[25][0-9]{8}$';
  IF jsonb_array_length(recipients)=0 THEN RAISE EXCEPTION 'No eligible Ghana mobile numbers. Review directory contacts';END IF;
  IF jsonb_array_length(recipients)>200 THEN RAISE EXCEPTION 'Choose an audience with at most 200 SMS recipients';END IF;
  doc:=jsonb_build_object('draft_id',d.id,'version',d.updated_at,'title',d.title,'message',d.message,'sender',d.sender_id,'recipients',recipients,'excluded',excluded,'is_test',false);
  RETURN doc||jsonb_build_object('digest',md5(doc::text));
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.sms_snapshot(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION gwcc_private.sms_preview(p_draft_id text,p_version text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT gwcc_private.sms_snapshot(auth.uid(),p_draft_id,p_version);$$;
REVOKE ALL ON FUNCTION gwcc_private.sms_preview(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.sms_preview(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_sms_preview(p_draft_id text,p_version text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.sms_preview(p_draft_id,p_version);$$;
REVOKE ALL ON FUNCTION public.gwcc_sms_preview(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_sms_preview(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.sms_history() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF gwcc_private.sms_actor(auth.uid(),false) IS NULL THEN RAISE EXCEPTION 'Your role cannot read SMS history' USING ERRCODE='42501';END IF;
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(d)-'request_hash'-'fingerprint' ORDER BY created_at DESC),'[]') FROM
    (SELECT * FROM gwcc_private.sms_dispatches ORDER BY created_at DESC LIMIT 30) d);
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.sms_history() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.sms_history() TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_sms_history() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.sms_history();$$;
REVOKE ALL ON FUNCTION public.gwcc_sms_history() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_sms_history() TO authenticated;

-- Only the authenticated backend can claim a send, before the external HTTP call.
-- An ambiguous network outcome is held for review; it is never automatically sent again.
CREATE OR REPLACE FUNCTION gwcc_private.sms_claim(p_actor uuid,p_id uuid,p_draft_id text,p_version text,p_digest text,p_sender text,p_test_phone text,p_segments integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous gwcc_private.sms_dispatches; doc jsonb; checksum text; new_fingerprint text; phone text; units integer; actor_role text;
BEGIN
  actor_role:=gwcc_private.sms_actor(p_actor,true);
  IF actor_role IS NULL THEN RAISE EXCEPTION 'Your role cannot send SMS' USING ERRCODE='42501';END IF;
  IF p_id IS NULL OR p_sender IS NULL OR p_sender !~ '^[A-Za-z0-9 -]{1,11}$' OR p_segments IS NULL OR p_segments NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid SMS request';END IF;
  checksum:=md5(jsonb_build_array(p_actor,p_draft_id,p_version,p_digest,p_sender,p_test_phone,p_segments)::text);
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-sms-claims'));
  SELECT * INTO previous FROM gwcc_private.sms_dispatches WHERE id=p_id;
  IF FOUND THEN
    IF previous.actor_id<>p_actor OR previous.request_hash<>checksum THEN RAISE EXCEPTION 'This SMS operation ID was reused with different data';END IF;
    RETURN jsonb_build_object('created',false,'dispatch',to_jsonb(previous)-'request_hash'-'fingerprint');
  END IF;
  IF p_test_phone IS NOT NULL THEN
    phone:=gwcc_private.communication_phone(p_test_phone);
    IF phone IS NULL OR phone !~ '^233[25][0-9]{8}$' OR p_draft_id IS NOT NULL OR p_segments<>1 THEN RAISE EXCEPTION 'Enter one valid Ghana mobile number for the test';END IF;
    IF (SELECT count(*) FROM gwcc_private.sms_dispatches WHERE snapshot->>'is_test'='true' AND snapshot->'recipients'->0->>'phone'=phone AND created_at>now()-interval '24 hours')>=3 THEN RAISE EXCEPTION 'This test number has reached the three-test daily limit';END IF;
    doc:=jsonb_build_object('title','SMS connection test','sender',p_sender,'message','GWCC SMS connection test. Your church app is connected to Arkesel.',
      'recipients',jsonb_build_array(jsonb_build_object('id','test','name','Test recipient','phone',phone)),'excluded','[]'::jsonb,'is_test',true);
  ELSE
    doc:=gwcc_private.sms_snapshot(p_actor,p_draft_id,p_version);
    IF p_digest IS NULL OR doc->>'digest' IS DISTINCT FROM p_digest THEN RAISE EXCEPTION 'The message or phone numbers changed. Review SMS again';END IF;
    IF doc->>'sender' IS DISTINCT FROM p_sender THEN RAISE EXCEPTION 'The draft sender must match the approved configured sender ID';END IF;
    new_fingerprint:=md5(jsonb_build_array(p_draft_id,p_sender,doc->>'message',(SELECT jsonb_agg(x->>'phone' ORDER BY x->>'phone') FROM jsonb_array_elements(doc->'recipients') x))::text);
    SELECT * INTO previous FROM gwcc_private.sms_dispatches s WHERE s.fingerprint=new_fingerprint;
    IF FOUND THEN RETURN jsonb_build_object('created',false,'dispatch',to_jsonb(previous)-'request_hash'-'fingerprint');END IF;
  END IF;
  units:=jsonb_array_length(doc->'recipients')*p_segments;
  IF units>500 THEN RAISE EXCEPTION 'This submission exceeds the 500-segment limit. Shorten the message or choose a smaller audience';END IF;
  IF (SELECT COALESCE(sum(estimated_units),0) FROM gwcc_private.sms_dispatches WHERE created_at>now()-interval '24 hours')+units>1000 THEN RAISE EXCEPTION 'The church has reached its 1,000-segment daily safety limit';END IF;
  IF (SELECT count(*) FROM gwcc_private.sms_dispatches WHERE created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Too many SMS submissions. Try again in a minute';END IF;
  INSERT INTO gwcc_private.sms_dispatches(id,actor_id,draft_id,request_hash,fingerprint,snapshot,estimated_units)
    VALUES(p_id,p_actor,p_draft_id,checksum,new_fingerprint,doc,units) RETURNING * INTO previous;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,p_actor,p_actor::text,actor_role,'SMS_SUBMISSION_STARTED','Communication',p_id::text,
      jsonb_build_object('draft_id',p_draft_id,'recipients',jsonb_array_length(doc->'recipients'),'estimated_segments',units,'is_test',p_test_phone IS NOT NULL)::text);
  RETURN jsonb_build_object('created',true,'dispatch',to_jsonb(previous)-'request_hash'-'fingerprint');
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.sms_claim(uuid,uuid,text,text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION gwcc_private.sms_claim(uuid,uuid,text,text,text,text,text,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.gwcc_sms_claim(p_actor uuid,p_id uuid,p_draft_id text,p_version text,p_digest text,p_sender text,p_test_phone text,p_segments integer) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.sms_claim(p_actor,p_id,p_draft_id,p_version,p_digest,p_sender,p_test_phone,p_segments);$$;
REVOKE ALL ON FUNCTION public.gwcc_sms_claim(uuid,uuid,text,text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_sms_claim(uuid,uuid,text,text,text,text,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION gwcc_private.sms_finish(p_id uuid,p_state text,p_outcomes jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d gwcc_private.sms_dispatches;
BEGIN
  SELECT * INTO d FROM gwcc_private.sms_dispatches WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SMS submission not found';END IF;
  IF d.state<>'started' THEN RETURN to_jsonb(d)-'request_hash'-'fingerprint';END IF;
  IF p_state IS NULL OR p_state NOT IN ('submitted','rejected','unknown') OR jsonb_typeof(p_outcomes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid SMS outcome';END IF;
  IF jsonb_array_length(p_outcomes)<>jsonb_array_length(d.snapshot->'recipients') OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(d.snapshot->'recipients') r WHERE (SELECT count(*) FROM jsonb_array_elements(p_outcomes) o WHERE o->>'phone'=r->>'phone' AND o->>'status' IN ('accepted','rejected','unknown'))<>1
  ) THEN RAISE EXCEPTION 'Incomplete SMS outcomes';END IF;
  UPDATE gwcc_private.sms_dispatches SET state=p_state,outcomes=p_outcomes,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO d;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,d.actor_id,d.actor_id::text,'system','SMS_SUBMISSION_RECORDED','Communication',d.id::text,jsonb_build_object('state',p_state,'recipients',jsonb_array_length(p_outcomes))::text);
  RETURN to_jsonb(d)-'request_hash'-'fingerprint';
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.sms_finish(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION gwcc_private.sms_finish(uuid,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.gwcc_sms_finish(p_id uuid,p_state text,p_outcomes jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.sms_finish(p_id,p_state,p_outcomes);$$;
REVOKE ALL ON FUNCTION public.gwcc_sms_finish(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_sms_finish(uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION gwcc_private.sms_reports(p_actor uuid,p_id uuid,p_reports jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d gwcc_private.sms_dispatches; results jsonb;
BEGIN
  IF gwcc_private.sms_actor(p_actor,false) IS NULL THEN RAISE EXCEPTION 'Your role cannot read SMS history' USING ERRCODE='42501';END IF;
  SELECT * INTO d FROM gwcc_private.sms_dispatches WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SMS submission not found';END IF;
  IF p_reports IS NOT NULL THEN
    IF jsonb_typeof(p_reports) IS DISTINCT FROM 'array' OR jsonb_array_length(p_reports)>200 THEN RAISE EXCEPTION 'Invalid delivery report';END IF;
    SELECT COALESCE(jsonb_agg(CASE WHEN o->>'status' IN ('delivered','failed','rejected') THEN o ELSE
      COALESCE((SELECT o||jsonb_build_object('status',r->>'status') FROM jsonb_array_elements(p_reports) r
        WHERE r->>'provider_id'=o->>'provider_id' AND r->>'phone'=o->>'phone' AND r->>'status' IN ('accepted','delivered','failed') LIMIT 1),o) END),'[]') INTO results
      FROM jsonb_array_elements(d.outcomes) o;
    UPDATE gwcc_private.sms_dispatches SET outcomes=results,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO d;
  END IF;
  RETURN to_jsonb(d)-'request_hash'-'fingerprint';
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.sms_reports(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION gwcc_private.sms_reports(uuid,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.gwcc_sms_reports(p_actor uuid,p_id uuid,p_reports jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.sms_reports(p_actor,p_id,p_reports);$$;
REVOKE ALL ON FUNCTION public.gwcc_sms_reports(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_sms_reports(uuid,uuid,jsonb) TO service_role;
