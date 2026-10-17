-- Follow-up tasks use the established gwcc_documents module store. Its complete
-- rows, including immutable task/interaction history, are already backed up.
CREATE OR REPLACE FUNCTION gwcc_private.task_kind_allowed(p_kind text,p_role text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT COALESCE(p_role IN ('super_admin','senior_pastor','administrator','finance_officer','pastor','ministry_leader','attendance_officer','data_entry')
    AND CASE p_kind WHEN 'pastoral' THEN p_role IN ('super_admin','senior_pastor','pastor') WHEN 'visitor' THEN p_role<>'finance_officer' WHEN 'general' THEN true ELSE false END,false)
$$;
CREATE OR REPLACE FUNCTION gwcc_private.task_visible(p_task jsonb,p_actor uuid,p_role text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT gwcc_private.task_kind_allowed(p_task->>'kind',p_role) AND
    (p_role IN ('super_admin','senior_pastor') OR (p_role='administrator' AND p_task->>'kind'<>'pastoral')
      OR p_task->>'assigned_to_id'=p_actor::text OR p_task->>'created_by_id'=p_actor::text)
$$;
REVOKE ALL ON FUNCTION gwcc_private.task_kind_allowed(text,text),gwcc_private.task_visible(jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS gwcc_follow_up_owner_due ON public.gwcc_documents(namespace,(data->>'assigned_to_id'),(data->>'due_date')) WHERE namespace='follow_up_tasks';

CREATE OR REPLACE FUNCTION gwcc_private.follow_up_list() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); r text:=public.current_user_role(); result jsonb;
BEGIN
  IF actor IS NULL OR NOT gwcc_private.task_kind_allowed('general',r) THEN RAISE EXCEPTION 'An active reviewed staff account is required' USING ERRCODE='42501';END IF;
  SELECT COALESCE(jsonb_agg(d.data||jsonb_build_object('assignee_available',EXISTS(
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id::text=p.id WHERE p.id=d.data->>'assigned_to_id' AND p.is_active AND p.has_login_account
      AND p.authorization_reviewed_at IS NOT NULL AND u.email_confirmed_at IS NOT NULL
      AND COALESCE((to_jsonb(u)->>'banned_until')::timestamptz>now(),false)=false
      AND gwcc_private.task_kind_allowed(d.data->>'kind',p.role))) ORDER BY d.id),'[]') INTO result
    FROM public.gwcc_documents d WHERE d.namespace='follow_up_tasks' AND gwcc_private.task_visible(d.data,actor,r);
  RETURN result;
END;$$;
CREATE OR REPLACE FUNCTION gwcc_private.follow_up_people(p_kind text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();r text:=public.current_user_role();delegate boolean;
BEGIN
  IF actor IS NULL OR NOT gwcc_private.task_kind_allowed(p_kind,r) THEN RAISE EXCEPTION 'This task category is outside your staff access' USING ERRCODE='42501';END IF;
  delegate:=r IN ('super_admin','senior_pastor','administrator') OR (r='pastor' AND p_kind='pastoral');
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'name',btrim(concat_ws(' ',p.first_name,p.last_name)),'role',p.role) ORDER BY p.first_name,p.last_name,p.id),'[]')
    FROM public.profiles p JOIN auth.users u ON u.id::text=p.id WHERE (delegate OR p.id=actor::text) AND p.is_active AND p.has_login_account
      AND p.authorization_reviewed_at IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND gwcc_private.task_kind_allowed(p_kind,p.role)
      AND COALESCE((to_jsonb(u)->>'banned_until')::timestamptz>now(),false)=false);
END;$$;

CREATE OR REPLACE FUNCTION gwcc_private.follow_up_action(p_operation_id uuid,p_task_id uuid,p_expected_updated_at timestamptz,p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();r text:=public.current_user_role();actor_name text;doc jsonb;old_doc jsonb;previous public.gwcc_applied_operations;stamp timestamptz:=clock_timestamp();
  checksum text;manager boolean;owner_id text;owner_name text;kind text;source_type text;source_id text;source_label text;outcome text;details text;title text;due date;priority text;event jsonb;
BEGIN
  IF actor IS NULL OR NOT gwcc_private.task_kind_allowed('general',r) THEN RAISE EXCEPTION 'An active reviewed staff account is required' USING ERRCODE='42501';END IF;
  IF p_operation_id IS NULL OR p_task_id IS NULL OR p_action IS NULL OR p_action NOT IN ('create','update','start','complete','cancel','reopen') OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>12000 THEN RAISE EXCEPTION 'Invalid follow-up action';END IF;
  checksum:=encode(sha256(convert_to(jsonb_build_object('kind','follow_up_task','id',p_task_id,'version',p_expected_updated_at,'action',p_action,'data',p_data)::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('gwcc-follow-up:'||p_task_id::text,0));
  SELECT data INTO old_doc FROM public.gwcc_documents WHERE namespace='follow_up_tasks' AND id=p_task_id::text FOR UPDATE;
  SELECT * INTO previous FROM public.gwcc_applied_operations WHERE user_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF previous.request_hash<>checksum THEN RAISE EXCEPTION 'Operation ID was reused with different data';END IF;
    IF old_doc IS NULL OR NOT gwcc_private.task_visible(old_doc,actor,r) THEN RAISE EXCEPTION 'Task not found or outside your access' USING ERRCODE='42501';END IF;
    RETURN old_doc;
  END IF;
  SELECT COALESCE(NULLIF(btrim(concat_ws(' ',first_name,last_name)),''),actor::text) INTO actor_name FROM public.profiles WHERE id=actor::text;
  IF p_action='create' THEN
    IF old_doc IS NOT NULL OR p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'This task already exists. Refresh before creating a replacement';END IF;
    kind:=p_data->>'kind';IF NOT gwcc_private.task_kind_allowed(kind,r) THEN RAISE EXCEPTION 'This task category is outside your staff access' USING ERRCODE='42501';END IF;
    source_type:=COALESCE(p_data->>'source_type','none');source_id:=NULLIF(p_data->>'source_id','');
    IF kind='general' AND (source_type<>'none' OR source_id IS NOT NULL) THEN RAISE EXCEPTION 'General tasks do not carry pastoral or visitor record links';END IF;
    IF kind='visitor' THEN
      IF source_type<>'visitor' OR source_id IS NULL OR NOT public.gwcc_can_read('visitors') THEN RAISE EXCEPTION 'Choose an accessible visitor record';END IF;
      SELECT full_name INTO source_label FROM public.visitors WHERE id=source_id AND follow_up_status NOT IN ('converted_to_member','closed');
      IF NOT FOUND THEN RAISE EXCEPTION 'This visitor is closed, converted or unavailable';END IF;
      PERFORM pg_advisory_xact_lock(hashtextextended('gwcc-follow-up-source:visitor:'||source_id,0));
      IF EXISTS(SELECT 1 FROM public.gwcc_documents WHERE namespace='follow_up_tasks' AND data->>'source_type'='visitor' AND data->>'source_id'=source_id AND data->>'status' IN ('open','in_progress')) THEN RAISE EXCEPTION 'An open task already exists for this visitor. Ask an administrator to review its assignment';END IF;
    ELSIF kind='pastoral' THEN
      IF source_type='pastoral_care' THEN SELECT member_name INTO source_label FROM public.pastoral_care WHERE id=source_id;
      ELSIF source_type='pastoral_visitation' THEN SELECT data->>'member_name' INTO source_label FROM public.gwcc_documents WHERE namespace='pastoral_visitations' AND id=source_id;
      ELSIF source_type='member' THEN SELECT concat_ws(' ',first_name,last_name) INTO source_label FROM public.members WHERE id=source_id AND NOT is_archived;
      ELSIF source_type='none' AND source_id IS NULL THEN source_label:=NULL;
      ELSE RAISE EXCEPTION 'Choose a supported pastoral record';END IF;
      IF source_type<>'none' AND source_label IS NULL THEN RAISE EXCEPTION 'The linked pastoral record is unavailable';END IF;
    END IF;
    doc:=jsonb_build_object('id',p_task_id,'kind',kind,'source_type',source_type,'source_id',source_id,'source_label',source_label,'status','open','created_by_id',actor,'created_by',actor_name,'created_at',stamp,'history','[]'::jsonb);
  ELSE
    IF old_doc IS NULL OR NOT gwcc_private.task_visible(old_doc,actor,r) THEN RAISE EXCEPTION 'Task not found or outside your access' USING ERRCODE='42501';END IF;
    IF p_expected_updated_at IS NULL OR (old_doc->>'updated_at')::timestamptz IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'This task changed on another device. Refresh before retrying' USING ERRCODE='40001';END IF;
    doc:=old_doc;kind:=doc->>'kind';
  END IF;
  manager:=r IN ('super_admin','senior_pastor') OR (r='administrator' AND kind<>'pastoral');
  IF p_action IN ('create','update') THEN
    IF p_action='update' AND doc->>'status' NOT IN ('open','in_progress') THEN RAISE EXCEPTION 'Reopen a closed task before editing it';END IF;
    IF p_action='update' AND NOT manager AND doc->>'assigned_to_id'<>actor::text AND doc->>'created_by_id'<>actor::text THEN RAISE EXCEPTION 'Only the owner, creator or administrator can edit this task' USING ERRCODE='42501';END IF;
    IF p_action='update' AND ((p_data ? 'kind' AND p_data->>'kind' IS DISTINCT FROM kind) OR (p_data ? 'source_type' AND p_data->>'source_type' IS DISTINCT FROM doc->>'source_type') OR (p_data ? 'source_id' AND p_data->>'source_id' IS DISTINCT FROM doc->>'source_id')) THEN RAISE EXCEPTION 'The task category and linked record are fixed. Cancel and replace this task';END IF;
    title:=btrim(COALESCE(p_data->>'title',doc->>'title',''));details:=btrim(COALESCE(p_data->>'description',doc->>'description',''));priority:=COALESCE(p_data->>'priority',doc->>'priority','normal');
    IF length(title) NOT BETWEEN 3 AND 180 OR length(details)>2000 OR priority NOT IN ('normal','high','urgent') OR COALESCE(p_data->>'due_date',doc->>'due_date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Enter a title, valid due date, priority and description up to 2000 characters';END IF;
    due:=COALESCE(p_data->>'due_date',doc->>'due_date')::date;
    owner_id:=COALESCE(p_data->>'assigned_to_id',doc->>'assigned_to_id',actor::text);
    IF owner_id<>actor::text AND NOT manager AND NOT (r='pastor' AND kind='pastoral') THEN RAISE EXCEPTION 'Only administrators may delegate this task to another staff member' USING ERRCODE='42501';END IF;
    SELECT btrim(concat_ws(' ',p.first_name,p.last_name)) INTO owner_name FROM public.profiles p JOIN auth.users u ON u.id::text=p.id
      WHERE p.id=owner_id AND p.is_active AND p.has_login_account AND p.authorization_reviewed_at IS NOT NULL AND u.email_confirmed_at IS NOT NULL
        AND gwcc_private.task_kind_allowed(kind,p.role) AND COALESCE((to_jsonb(u)->>'banned_until')::timestamptz>now(),false)=false;
    IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active reviewed staff login with access to this task category';END IF;
    doc:=doc||jsonb_build_object('title',title,'description',details,'priority',priority,'due_date',due,'assigned_to_id',owner_id,'assigned_to',owner_name);
  ELSE
    IF p_action<>'cancel' AND NOT manager AND doc->>'assigned_to_id'<>actor::text THEN RAISE EXCEPTION 'Only the assignee or administrator can change completion status' USING ERRCODE='42501';END IF;
    IF p_action='cancel' AND NOT manager AND doc->>'assigned_to_id'<>actor::text AND doc->>'created_by_id'<>actor::text THEN RAISE EXCEPTION 'Only the assignee, creator or administrator can cancel this task' USING ERRCODE='42501';END IF;
    IF p_action='start' THEN
      IF doc->>'status'<>'open' THEN RAISE EXCEPTION 'Only an open task can be started';END IF;doc:=doc||jsonb_build_object('status','in_progress');
    ELSE
      outcome:=btrim(COALESCE(p_data->>'outcome',''));
      IF length(outcome) NOT BETWEEN 3 AND 1500 THEN RAISE EXCEPTION 'Enter an outcome or reason between 3 and 1500 characters';END IF;
      IF p_action IN ('complete','cancel') AND doc->>'status' NOT IN ('open','in_progress') THEN RAISE EXCEPTION 'This task is already closed. Refresh its history';END IF;
      IF p_action='complete' THEN doc:=doc||jsonb_build_object('status','completed','completed_by_id',actor,'completed_by',actor_name,'completed_at',stamp,'outcome',outcome);
      ELSIF p_action='cancel' THEN doc:=doc||jsonb_build_object('status','cancelled');
      ELSE
        IF doc->>'status' NOT IN ('completed','cancelled') THEN RAISE EXCEPTION 'Only a closed task can be reopened';END IF;
        IF kind='visitor' THEN
          PERFORM pg_advisory_xact_lock(hashtextextended('gwcc-follow-up-source:visitor:'||(doc->>'source_id'),0));
          IF NOT EXISTS(SELECT 1 FROM public.visitors WHERE id=doc->>'source_id' AND follow_up_status NOT IN ('closed','converted_to_member')) OR EXISTS(SELECT 1 FROM public.gwcc_documents WHERE namespace='follow_up_tasks' AND id<>p_task_id::text AND data->>'source_type'='visitor' AND data->>'source_id'=doc->>'source_id' AND data->>'status' IN ('open','in_progress')) THEN RAISE EXCEPTION 'This visitor already has an open task or is no longer available for follow-up';END IF;
        END IF;
        doc:=(doc-ARRAY['completed_by_id','completed_by','completed_at','outcome'])||jsonb_build_object('status','open');
      END IF;
    END IF;
  END IF;
  event:=jsonb_strip_nulls(jsonb_build_object('action',p_action,'actor_id',actor,'actor_name',actor_name,'at',stamp,'outcome',outcome,
    'title',CASE WHEN p_action IN ('create','update') THEN doc->>'title' END,'due_date',CASE WHEN p_action IN ('create','update') THEN doc->>'due_date' END,
    'assigned_to_id',CASE WHEN p_action IN ('create','update') THEN doc->>'assigned_to_id' END,'assigned_to',CASE WHEN p_action IN ('create','update') THEN doc->>'assigned_to' END));
  doc:=doc||jsonb_build_object('updated_at',stamp,'history',COALESCE(doc->'history','[]')||jsonb_build_array(event));
  INSERT INTO public.gwcc_documents(namespace,id,data,updated_at) VALUES('follow_up_tasks',p_task_id::text,doc,stamp)
    ON CONFLICT(namespace,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details,timestamp)
    VALUES(gen_random_uuid()::text,actor,actor_name,r,'FOLLOW_UP_'||upper(p_action),'Task Centre',p_task_id::text,'Authenticated follow-up task action',stamp);
  INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result) VALUES(actor,p_operation_id,checksum,jsonb_build_object('kind','follow_up_task','task_id',p_task_id));
  RETURN doc;
END;$$;

CREATE OR REPLACE FUNCTION gwcc_private.log_visitor_follow_up(p_operation_id uuid,p_visitor_id text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();r text:=public.current_user_role();v public.visitors;prior public.gwcc_applied_operations;checksum text;stamp timestamptz:=clock_timestamp();
  actor_name text;channel text;summary text;next_status text;contact_date date;entry jsonb;result jsonb;ident text;
BEGIN
  IF actor IS NULL OR NOT public.gwcc_can_write('visitors') THEN RAISE EXCEPTION 'Visitor follow-up access is required' USING ERRCODE='42501';END IF;
  IF p_operation_id IS NULL OR p_visitor_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>8000 THEN RAISE EXCEPTION 'Invalid visitor interaction';END IF;
  checksum:=encode(sha256(convert_to(jsonb_build_object('kind','visitor_interaction','id',p_visitor_id,'data',p_data)::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('gwcc-visitor-interaction:'||p_visitor_id,0));
  SELECT * INTO prior FROM public.gwcc_applied_operations WHERE user_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF prior.request_hash<>checksum THEN RAISE EXCEPTION 'Operation ID was reused with different data';END IF;
    SELECT to_jsonb(visitors.*) INTO result FROM public.visitors WHERE id=p_visitor_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'This visitor is no longer available';END IF;RETURN result;
  END IF;
  SELECT * INTO v FROM public.visitors WHERE id=p_visitor_id FOR UPDATE;
  IF NOT FOUND OR v.follow_up_status='converted_to_member' THEN RAISE EXCEPTION 'This visitor is unavailable or already converted to a member';END IF;
  channel:=p_data->>'channel';summary:=btrim(COALESCE(p_data->>'summary',''));next_status:=p_data->>'status';
  IF channel IS NULL OR channel NOT IN ('phone_call','whatsapp','home_visit','in_person','prayer_call') OR length(summary) NOT BETWEEN 3 AND 3000
    OR next_status IS NULL OR next_status NOT IN ('contacted','follow_up_required','returning_visitor','closed') OR COALESCE(p_data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Enter a valid interaction date, channel, status and summary';END IF;
  contact_date:=(p_data->>'date')::date;IF contact_date>(stamp AT TIME ZONE 'Africa/Accra')::date THEN RAISE EXCEPTION 'An interaction cannot be dated in the future';END IF;
  SELECT btrim(concat_ws(' ',first_name,last_name)) INTO actor_name FROM public.profiles WHERE id=actor::text;
  ident:=gen_random_uuid()::text;entry:=jsonb_build_object('id',ident,'visitor_id',v.id,'channel',channel,'date',contact_date,'summary',summary,'status',next_status,'actor_id',actor,'actor_name',actor_name,'created_at',stamp);
  INSERT INTO public.gwcc_documents(namespace,id,data,updated_at) VALUES('visitor_interactions',ident,entry,stamp);
  -- Lock/append on the server preserves another caller's concurrent notes.
  UPDATE public.visitors SET notes='['||contact_date::text||' - '||replace(channel,'_',' ')||' logged by '||actor_name||']'||E'\n'||summary||CASE WHEN COALESCE(notes,'')='' THEN '' ELSE E'\n\n'||notes END,
    follow_up_status=next_status,updated_at=stamp WHERE id=v.id RETURNING to_jsonb(visitors.*) INTO result;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details,timestamp)
    VALUES(gen_random_uuid()::text,actor,actor_name,r,'LOG_VISITOR_FOLLOW_UP','Visitors',v.id,'Authenticated follow-up interaction',stamp);
  INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result) VALUES(actor,p_operation_id,checksum,jsonb_build_object('kind','visitor_interaction','visitor_id',v.id));
  RETURN result;
END;$$;
CREATE OR REPLACE FUNCTION gwcc_private.visitor_follow_up_history(p_visitor_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT public.gwcc_can_read('visitors') THEN RAISE EXCEPTION 'Visitor follow-up access is required' USING ERRCODE='42501';END IF;
  RETURN (SELECT COALESCE(jsonb_agg(data ORDER BY data->>'created_at',id),'[]') FROM public.gwcc_documents WHERE namespace='visitor_interactions' AND data->>'visitor_id'=p_visitor_id);
END;$$;

CREATE OR REPLACE FUNCTION public.gwcc_follow_up_list() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.follow_up_list() $$;
CREATE OR REPLACE FUNCTION public.gwcc_follow_up_people(p_kind text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.follow_up_people(p_kind) $$;
CREATE OR REPLACE FUNCTION public.gwcc_follow_up_action(p_operation_id uuid,p_task_id uuid,p_expected_updated_at timestamptz,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.follow_up_action(p_operation_id,p_task_id,p_expected_updated_at,p_action,p_data) $$;
CREATE OR REPLACE FUNCTION public.gwcc_log_visitor_follow_up(p_operation_id uuid,p_visitor_id text,p_data jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.log_visitor_follow_up(p_operation_id,p_visitor_id,p_data) $$;
CREATE OR REPLACE FUNCTION public.gwcc_visitor_follow_up_history(p_visitor_id text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.visitor_follow_up_history(p_visitor_id) $$;
REVOKE ALL ON FUNCTION public.gwcc_follow_up_list(),public.gwcc_follow_up_people(text),public.gwcc_follow_up_action(uuid,uuid,timestamptz,text,jsonb),public.gwcc_log_visitor_follow_up(uuid,text,jsonb),public.gwcc_visitor_follow_up_history(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION gwcc_private.follow_up_list(),gwcc_private.follow_up_people(text),gwcc_private.follow_up_action(uuid,uuid,timestamptz,text,jsonb),gwcc_private.log_visitor_follow_up(uuid,text,jsonb),gwcc_private.visitor_follow_up_history(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_follow_up_list(),public.gwcc_follow_up_people(text),public.gwcc_follow_up_action(uuid,uuid,timestamptz,text,jsonb),public.gwcc_log_visitor_follow_up(uuid,text,jsonb),public.gwcc_visitor_follow_up_history(text) TO authenticated;
GRANT EXECUTE ON FUNCTION gwcc_private.follow_up_list(),gwcc_private.follow_up_people(text),gwcc_private.follow_up_action(uuid,uuid,timestamptz,text,jsonb),gwcc_private.log_visitor_follow_up(uuid,text,jsonb),gwcc_private.visitor_follow_up_history(text) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Pipeline labels must not claim a membership record that does not exist.
CREATE OR REPLACE FUNCTION gwcc_private.guard_visitor_conversion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.visitors;
BEGIN
  SELECT * INTO previous FROM public.visitors WHERE id=NEW.id;
  IF previous.follow_up_status='converted_to_member' AND NEW.follow_up_status IS DISTINCT FROM 'converted_to_member'
    AND EXISTS(SELECT 1 FROM public.members WHERE id=previous.converted_to_member_id) THEN
    RAISE EXCEPTION 'This visitor is already enrolled. Manage membership through the Members page';
  END IF;
  IF NEW.follow_up_status='converted_to_member' AND (previous.id IS NULL OR previous.follow_up_status IS DISTINCT FROM 'converted_to_member' OR NEW.converted_to_member_id IS DISTINCT FROM previous.converted_to_member_id)
    AND (NEW.converted_to_member_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.members WHERE id=NEW.converted_to_member_id AND NOT is_archived)) THEN
    RAISE EXCEPTION 'Convert this visitor through the member enrollment flow before marking them converted';
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.guard_visitor_conversion() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS gwcc_visitor_conversion_guard ON public.visitors;
CREATE TRIGGER gwcc_visitor_conversion_guard BEFORE INSERT OR UPDATE ON public.visitors FOR EACH ROW EXECUTE FUNCTION gwcc_private.guard_visitor_conversion();
