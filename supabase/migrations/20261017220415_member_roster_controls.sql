-- Requests and link-review history use the existing, backed-up document store.
BEGIN;
CREATE OR REPLACE FUNCTION gwcc_private.roster_requests() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r text:=public.current_user_role();
BEGIN
 IF auth.uid() IS NULL OR r IN ('disabled','anon') THEN RAISE EXCEPTION 'Verified sign-in is required' USING ERRCODE='42501';END IF;
 RETURN (SELECT COALESCE(jsonb_agg(d.data ORDER BY d.updated_at DESC,d.id),'[]') FROM public.gwcc_documents d
   WHERE d.namespace='roster_substitute_requests' AND (public.gwcc_can_write('roster_assignments') OR (r='member' AND public.gwcc_owns_member(d.data->>'member_id'))));
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.roster_requests() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.roster_requests() TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_roster_requests() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.roster_requests(); $$;
REVOKE ALL ON FUNCTION public.gwcc_roster_requests() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_roster_requests() TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.member_roster_response(p_id text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.roster_assignments;m public.members;doc jsonb;stamp timestamptz:=clock_timestamp();kind text:=p_data->>'status';
 reason text:=btrim(COALESCE(p_data->>'reason',''));note text:=btrim(COALESCE(p_data->>'notes',''));suggestion text:=btrim(COALESCE(p_data->>'suggestion',''));
 token uuid;checksum text;ident text;
BEGIN
 IF auth.uid() IS NULL OR public.current_user_role()<>'member' THEN RAISE EXCEPTION 'Use your verified member account to respond to a duty' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM public.roster_assignments WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.gwcc_owns_member(a.member_id) THEN RAISE EXCEPTION 'This is not your duty assignment' USING ERRCODE='42501';END IF;
 SELECT * INTO m FROM public.members WHERE id=a.member_id AND NOT COALESCE(is_archived,false) AND COALESCE(status,'active') NOT IN ('deceased','transferred');
 IF NOT FOUND THEN RAISE EXCEPTION 'This member record is no longer active' USING ERRCODE='42501';END IF;
 IF kind IS NULL OR kind NOT IN ('confirmed','substitute_requested','substituted') THEN RAISE EXCEPTION 'Invalid duty response';END IF;
 SELECT data INTO doc FROM public.gwcc_documents WHERE namespace='roster_substitute_requests' AND id=a.id;
 IF kind='confirmed' AND a.status='confirmed' THEN RETURN to_jsonb(a);END IF;
 IF kind IN ('substitute_requested','substituted') THEN
   token:=NULLIF(p_data->>'request_id','')::uuid;
   IF token IS NULL THEN RAISE EXCEPTION 'Refresh the roster and submit a reviewed substitute request';END IF;
   IF reason='' OR length(reason)>150 OR length(note)>2000 OR length(suggestion)>200 THEN RAISE EXCEPTION 'Enter a reason of up to 150 characters, notes up to 2000 and a suggestion up to 200';END IF;
   checksum:=md5(jsonb_build_object('reason',reason,'notes',note,'suggestion',suggestion)::text);
   IF doc IS NOT NULL THEN
     IF doc->>'request_id'=token::text AND doc->>'checksum'<>checksum THEN RAISE EXCEPTION 'This request ID was reused with different data. Reopen the request form';END IF;
     IF doc->>'checksum'=checksum AND (doc->>'request_id'=token::text OR doc->>'status'='pending') THEN RETURN doc;END IF;
     RAISE EXCEPTION 'A substitute request already exists for this duty. Contact the coordinator to change it';
   END IF;
 END IF;
 IF a.date<(now() AT TIME ZONE 'Africa/Accra')::date THEN RAISE EXCEPTION 'Past duties are read-only. Contact the church office for a historical correction';END IF;
 IF a.status IN ('substituted','declined') THEN RAISE EXCEPTION 'This duty is no longer awaiting your response. Refresh the roster';END IF;
 IF NULLIF(p_data->>'expected_updated_at','') IS NULL OR a.updated_at IS DISTINCT FROM (p_data->>'expected_updated_at')::timestamptz THEN
   RAISE EXCEPTION 'This duty changed. Refresh the roster before responding' USING ERRCODE='40001';END IF;
 IF kind='confirmed' THEN
   IF doc->>'status'='pending' THEN RAISE EXCEPTION 'Your substitute request is awaiting coordinator review';END IF;
   UPDATE public.roster_assignments SET status='confirmed',updated_at=stamp WHERE id=a.id RETURNING * INTO a;
   INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
     VALUES(gen_random_uuid()::text,auth.uid(),concat_ws(' ',m.first_name,m.last_name),'member','MEMBER_ROSTER_CONFIRM','Member Portal',a.id,'Verified duty confirmation');
   RETURN to_jsonb(a);
 END IF;
 IF NOT public.gwcc_consume_api_limit('member_requests') THEN RAISE EXCEPTION 'Too many requests. Try again in a minute.';END IF;
 doc:=jsonb_build_object('id',a.id,'assignment_id',a.id,'member_id',m.id,'member_name',concat_ws(' ',m.first_name,m.last_name),
   'service_id',a.service_id,'service_name',a.service_name,'date',a.date,'role_title',a.role_title,
   'status','pending','reason',reason,'notes',note,'suggestion',suggestion,'request_id',token,'checksum',checksum,
   'created_by',auth.uid(),'created_at',stamp,'updated_at',stamp,
   'history',jsonb_build_array(jsonb_build_object('action','submitted','actor_id',auth.uid(),'at',stamp)));
 INSERT INTO public.gwcc_documents(namespace,id,data,updated_at) VALUES('roster_substitute_requests',a.id,doc,stamp);
 INSERT INTO public.roster_notifications(id,member_id,duty_id,type,payload)
   VALUES(gen_random_uuid()::text,m.id,a.id,'ROSTER_UPDATED',jsonb_build_object('memberName',doc->>'member_name','serviceName',a.service_name,'date',a.date,'roleTitle',a.role_title,'department',a.department,'reportTime',a.report_time,'message','Substitute request saved; awaiting coordinator review.'));
 INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
   VALUES(gen_random_uuid()::text,auth.uid(),doc->>'member_name','member','MEMBER_ROSTER_SUBSTITUTE_REQUEST','Member Portal',a.id,'Substitute request awaiting coordinator review');
 RETURN doc;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.member_roster_response(text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.review_roster_request(p_id text,p_version text,p_assignment_version text,p_action text,p_replacement_id text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.roster_assignments;replacement public.members;doc jsonb;stamp timestamptz:=clock_timestamp();actor_name text;new_id text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.gwcc_can_write('roster_assignments') THEN RAISE EXCEPTION 'Roster coordinator authorization is required' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM public.roster_assignments WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This assignment is no longer available';END IF;
 SELECT data INTO doc FROM public.gwcc_documents WHERE namespace='roster_substitute_requests' AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This request is no longer available';END IF;
 IF p_action IS NULL OR p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Choose approval or rejection';END IF;
 IF (doc->>'status'='approved' AND p_action='approve' AND doc->>'replacement_member_id'=p_replacement_id)
   OR (doc->>'status'='rejected' AND p_action='reject' AND doc->>'review_reason'=btrim(COALESCE(p_reason,''))) THEN RETURN doc;END IF;
 IF doc->>'status'<>'pending' THEN RAISE EXCEPTION 'This request has already been reviewed';END IF;
 IF p_version IS NULL OR (doc->>'updated_at')::timestamptz IS DISTINCT FROM p_version::timestamptz THEN RAISE EXCEPTION 'The request changed. Refresh before reviewing' USING ERRCODE='40001';END IF;
 IF p_action='reject' AND btrim(COALESCE(p_reason,''))='' OR length(COALESCE(p_reason,''))>2000 THEN RAISE EXCEPTION 'Enter a review reason of up to 2000 characters';END IF;
 SELECT concat_ws(' ',first_name,last_name) INTO actor_name FROM public.profiles WHERE id=auth.uid()::text;
 IF p_action='approve' THEN
   IF a.date<(now() AT TIME ZONE 'Africa/Accra')::date THEN RAISE EXCEPTION 'A past duty cannot receive a new replacement. Reject the request with an explanation';END IF;
   IF p_assignment_version IS NULL OR a.updated_at IS DISTINCT FROM p_assignment_version::timestamptz THEN RAISE EXCEPTION 'The assignment changed. Refresh before selecting a replacement' USING ERRCODE='40001';END IF;
   IF a.member_id IS DISTINCT FROM doc->>'member_id' OR a.service_id IS DISTINCT FROM doc->>'service_id' OR a.date IS DISTINCT FROM (doc->>'date')::date OR a.status IN ('substituted','declined') THEN RAISE EXCEPTION 'The original duty changed. Review the roster and reject this outdated request';END IF;
   SELECT * INTO replacement FROM public.members WHERE id=p_replacement_id AND NOT COALESCE(is_archived,false) AND COALESCE(status,'active') NOT IN ('inactive','visitor','deceased','transferred');
   IF NOT FOUND OR replacement.id=a.member_id THEN RAISE EXCEPTION 'Choose a different active member as replacement';END IF;
   PERFORM pg_advisory_xact_lock(hashtext('gwcc-roster-replacement:'||a.service_id||':'||a.date::text||':'||replacement.id));
   IF EXISTS(SELECT 1 FROM public.roster_assignments WHERE service_id=a.service_id AND date=a.date AND member_id=replacement.id AND status NOT IN ('declined','substituted')) THEN RAISE EXCEPTION 'This member is already assigned to this service and date';END IF;
   new_id:='replacement-'||md5(a.id);
   INSERT INTO public.roster_assignments(id,service_id,service_name,date,member_id,member_name,member_phone,department,role_title,report_time,status,notes,announcement,created_at,updated_at)
     VALUES(new_id,a.service_id,a.service_name,a.date,replacement.id,concat_ws(' ',replacement.first_name,replacement.last_name),replacement.phone,a.department,a.role_title,a.report_time,'pending',a.notes,a.announcement,stamp,stamp);
   doc:=doc||jsonb_build_object('status','approved','replacement_member_id',replacement.id,'replacement_member_name',concat_ws(' ',replacement.first_name,replacement.last_name),'replacement_assignment_id',new_id);
 ELSE doc:=doc||jsonb_build_object('status','rejected');END IF;
 doc:=doc||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_by_name',actor_name,'reviewed_at',stamp,'review_reason',btrim(COALESCE(p_reason,'')),'updated_at',stamp,
   'history',(doc->'history')||jsonb_build_array(jsonb_build_object('action',p_action,'actor_id',auth.uid(),'at',stamp)));
 UPDATE public.gwcc_documents SET data=doc,updated_at=stamp WHERE namespace='roster_substitute_requests' AND id=p_id;
 IF p_action='approve' THEN UPDATE public.roster_assignments SET status='substituted',updated_at=stamp WHERE id=a.id;END IF;
 INSERT INTO public.roster_notifications(id,member_id,duty_id,type,payload)
   VALUES(gen_random_uuid()::text,a.member_id,a.id,'ROSTER_UPDATED',jsonb_build_object('serviceName',a.service_name,'date',a.date,'roleTitle',a.role_title,'department',a.department,'reportTime',a.report_time,'message','Your substitute request was '||(doc->>'status')||'. Open My Duty Roster for details.'));
 INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
   VALUES(gen_random_uuid()::text,auth.uid(),actor_name,public.current_user_role(),'REVIEW_ROSTER_SUBSTITUTE','Services',a.id,'Coordinator reviewed a substitute request');
 RETURN doc;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.review_roster_request(text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.review_roster_request(text,text,text,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_review_roster_request(p_id text,p_version text,p_assignment_version text,p_action text,p_replacement_id text DEFAULT NULL,p_reason text DEFAULT '') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.review_roster_request(p_id,p_version,p_assignment_version,p_action,p_replacement_id,p_reason); $$;
REVOKE ALL ON FUNCTION public.gwcc_review_roster_request(text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_review_roster_request(text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.link_historical_roster(p_id text,p_version text,p_member_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.roster_assignments;m public.members;previous jsonb;stamp timestamptz:=clock_timestamp();
BEGIN
 IF auth.uid() IS NULL OR NOT public.gwcc_can_write('roster_assignments') THEN RAISE EXCEPTION 'Roster coordinator authorization is required' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM public.roster_assignments WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.date>=(now() AT TIME ZONE 'Africa/Accra')::date THEN RAISE EXCEPTION 'Choose an unlinked historical assignment';END IF;
 IF EXISTS(SELECT 1 FROM public.members WHERE id=a.member_id OR member_id=a.member_id) THEN
   IF a.member_id=p_member_id AND EXISTS(SELECT 1 FROM public.gwcc_documents WHERE namespace='roster_link_reviews' AND id=p_id AND data->>'member_id'=p_member_id) THEN RETURN to_jsonb(a);END IF;
   RAISE EXCEPTION 'This assignment already has a member link';END IF;
 IF p_version IS NULL OR a.updated_at IS DISTINCT FROM p_version::timestamptz THEN RAISE EXCEPTION 'This historical assignment changed. Refresh before linking' USING ERRCODE='40001';END IF;
 SELECT * INTO m FROM public.members WHERE id=p_member_id AND NOT COALESCE(is_archived,false) AND COALESCE(status,'active') NOT IN ('deceased','transferred');
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active member after reviewing the historical name';END IF;
 previous:=to_jsonb(a);
 UPDATE public.roster_assignments SET member_id=m.id,member_name=concat_ws(' ',m.first_name,m.last_name),member_phone=m.phone,updated_at=stamp WHERE id=p_id RETURNING * INTO a;
 INSERT INTO public.gwcc_documents(namespace,id,data,updated_at) VALUES('roster_link_reviews',p_id,jsonb_build_object('id',p_id,'member_id',m.id,'previous',previous,'reviewed_by',auth.uid(),'reviewed_at',stamp),stamp);
 INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
   VALUES(gen_random_uuid()::text,auth.uid(),auth.uid()::text,public.current_user_role(),'LINK_HISTORICAL_ROSTER','Services',p_id,'Reviewed historical member link; original record retained in protected history');
 RETURN to_jsonb(a);
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.link_historical_roster(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.link_historical_roster(text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_link_historical_roster(p_id text,p_version text,p_member_id text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.link_historical_roster(p_id,p_version,p_member_id); $$;
REVOKE ALL ON FUNCTION public.gwcc_link_historical_roster(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_link_historical_roster(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.guard_pending_roster_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.gwcc_documents WHERE namespace='roster_substitute_requests' AND id=OLD.id AND data->>'status'='pending') THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Review the pending substitute request before deleting this duty';END IF;
   IF NEW.member_id IS DISTINCT FROM OLD.member_id OR NEW.service_id IS DISTINCT FROM OLD.service_id OR NEW.date IS DISTINCT FROM OLD.date OR NEW.status IS DISTINCT FROM OLD.status THEN
     RAISE EXCEPTION 'Review the pending substitute request before changing this duty';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.guard_pending_roster_request() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS gwcc_guard_pending_roster_request ON public.roster_assignments;
CREATE TRIGGER gwcc_guard_pending_roster_request BEFORE UPDATE OR DELETE ON public.roster_assignments FOR EACH ROW EXECUTE FUNCTION gwcc_private.guard_pending_roster_request();

CREATE OR REPLACE FUNCTION public.gwcc_member_action(p_action text,p_id text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved jsonb; old_row public.roster_assignments; m public.members; cohort jsonb; new_id text:=gen_random_uuid()::text; r text:=public.current_user_role();
BEGIN
  IF r IN ('disabled','anon') THEN RAISE EXCEPTION 'Sign-in is required' USING ERRCODE='42501'; END IF;
  IF p_action IN ('prayer','counseling','welfare','foundation') THEN
    IF NOT public.gwcc_owns_member(p_id) THEN RAISE EXCEPTION 'This is not your member account' USING ERRCODE='42501'; END IF;
    IF NOT public.gwcc_consume_api_limit('member_requests') THEN RAISE EXCEPTION 'Too many requests. Try again in a minute.'; END IF;
    SELECT * INTO m FROM public.members WHERE id=p_id;
    IF p_action='prayer' THEN
      IF length(trim(COALESCE(p_data->>'request',''))) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Enter a prayer request (up to 5000 characters)'; END IF;
      INSERT INTO public.prayer_requests(id,member_id,requester_name,requester_phone,category,request,date_submitted,status,is_confidential)
        VALUES(new_id,m.id,m.first_name||' '||m.last_name,m.phone,left(COALESCE(p_data->>'category','general'),100),p_data->>'request',current_date,'new',true)
        RETURNING to_jsonb(prayer_requests.*) INTO saved;
    ELSIF p_action='counseling' THEN
      IF length(trim(COALESCE(p_data->>'notes',''))) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Enter your counseling request (up to 5000 characters)'; END IF;
      INSERT INTO public.pastoral_care(id,member_id,member_name,member_phone,date,care_type,notes,is_confidential)
        VALUES(new_id,m.id,m.first_name||' '||m.last_name,m.phone,COALESCE((p_data->>'date')::date,current_date),'counseling',p_data->>'notes',true)
        RETURNING to_jsonb(pastoral_care.*) INTO saved;
    ELSIF p_action='welfare' THEN
      IF NOT ((p_data->>'amount_requested')::numeric>0 AND (p_data->>'amount_requested')::numeric<1000000000)
        OR length(trim(COALESCE(p_data->>'title','')))=0 OR length(trim(COALESCE(p_data->>'description','')))=0 THEN RAISE EXCEPTION 'Enter a title, description and positive requested amount'; END IF;
      INSERT INTO public.welfare_claims(id,claim_number,beneficiary_type,member_id,member_name,member_phone,category,title,description,amount_requested,status,emergency_level,date_submitted)
        VALUES(new_id,'BEN-'||upper(substr(new_id,1,8)),'member',m.id,m.first_name||' '||m.last_name,m.phone,
          p_data->>'category',left(p_data->>'title',200),left(p_data->>'description',5000),(p_data->>'amount_requested')::numeric,'pending',COALESCE(p_data->>'emergency_level','normal'),current_date)
        RETURNING to_jsonb(welfare_claims.*) INTO saved;
    ELSE
      SELECT data INTO cohort FROM public.gwcc_documents WHERE namespace='foundation_cohorts' AND id=p_data->>'cohort_id' AND data->>'status'='active';
      IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active foundation school cohort'; END IF;
      new_id:='enrollment-'||md5(m.id||':'||(cohort->>'id'));
      saved:=jsonb_build_object('id',new_id,'cohort_id',cohort->>'id','cohort_name',cohort->>'name','member_id',m.id,'member_name',m.first_name||' '||m.last_name,'member_phone',m.phone,'enrollment_date',current_date,'completed_modules','[]'::jsonb,'status','in_progress','created_at',now(),'updated_at',now());
      INSERT INTO public.gwcc_documents(namespace,id,data) VALUES('foundation_students',new_id,saved) ON CONFLICT(namespace,id) DO NOTHING;
    END IF;
  ELSIF p_action='profile' THEN
    IF NOT public.gwcc_owns_member(p_id) THEN RAISE EXCEPTION 'This is not your member profile' USING ERRCODE='42501'; END IF;
    UPDATE public.members SET phone=COALESCE(NULLIF(trim(p_data->>'phone'),''),phone),
      residential_address=COALESCE(p_data->>'residential_address',residential_address),
      gps_address=COALESCE(p_data->>'gps_address',gps_address),
      emergency_name=COALESCE(p_data->>'emergency_name',emergency_name),
      emergency_phone=COALESCE(p_data->>'emergency_phone',emergency_phone),updated_at=now()
      WHERE id=p_id RETURNING to_jsonb(members.*) INTO saved;
  ELSIF p_action='roster' THEN
    RETURN gwcc_private.member_roster_response(p_id,p_data);
  ELSIF p_action='notification_read' THEN
    UPDATE public.roster_notifications SET read_at=now()
      WHERE (id=p_id OR p_id='all') AND read_at IS NULL AND public.gwcc_owns_member(member_id);
    RETURN '{"success":true}'::jsonb;
  ELSE RAISE EXCEPTION 'Unknown member action'; END IF;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,auth.uid(),auth.uid()::text,r,'MEMBER_'||upper(p_action),'Member Portal',p_id,'Verified member action');
  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.gwcc_member_action(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_member_action(text,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
