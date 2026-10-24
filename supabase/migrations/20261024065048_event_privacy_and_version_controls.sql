-- Validate every event write at the authenticated API, with versions required for
-- existing rows. Old queued snapshots remain reviewable rather than overwriting RSVPs.
CREATE OR REPLACE FUNCTION gwcc_private.prepare_event(p_doc jsonb,p_old jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d jsonb:=coalesce(p_old,'{}')||p_doc; people jsonb; person jsonb; previous jsonb; canonical jsonb:='[]';
  actor_name text; m public.members; starts timestamp; ends timestamp; n numeric; seen_ids text[]:='{}'; seen_members text[]:='{}'; member_key text;
BEGIN
  SELECT concat_ws(' ',first_name,last_name) INTO actor_name FROM public.profiles WHERE id=auth.uid()::text;
  IF coalesce(length(btrim(d->>'title')),0) NOT BETWEEN 1 AND 300 OR coalesce(length(btrim(d->>'venue')),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Enter an event title and venue';END IF;
  IF coalesce(d->>'status','') NOT IN ('draft','upcoming','ongoing','completed','cancelled') THEN RAISE EXCEPTION 'Choose a valid event status';END IF;
  IF coalesce(d->>'event_type','') NOT IN ('church_service','prayer_vigil','conference','youth','outreach','special','revival','all_night','community_outreach','leadership','fasting','banquet') THEN RAISE EXCEPTION 'Choose a valid event category';END IF;
  IF coalesce(d->>'start_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(d->>'end_date','') !~ '^\d{4}-\d{2}-\d{2}$'
    OR coalesce(d->>'start_time','') !~ '^([01]\d|2[0-3]):[0-5]\d(:00)?$' OR coalesce(d->>'end_time','') !~ '^([01]\d|2[0-3]):[0-5]\d(:00)?$' THEN RAISE EXCEPTION 'Enter valid event dates and times';END IF;
  starts:=(d->>'start_date')::date+(d->>'start_time')::time; ends:=(d->>'end_date')::date+(d->>'end_time')::time;
  IF ends<=starts THEN RAISE EXCEPTION 'The event must end after it starts';END IF;
  IF d->>'expected_attendance' IS NOT NULL THEN
    IF jsonb_typeof(d->'expected_attendance')<>'number' THEN RAISE EXCEPTION 'Expected attendance must be a non-negative whole number';END IF;
    n:=(d->>'expected_attendance')::numeric;
    IF n<0 OR n>1000000 OR n<>trunc(n) THEN RAISE EXCEPTION 'Expected attendance must be a non-negative whole number';END IF;
  END IF;
  IF d->>'budget' IS NOT NULL THEN
    IF jsonb_typeof(d->'budget')<>'number' THEN RAISE EXCEPTION 'Enter a non-negative budget with up to two decimal places';END IF;
    n:=(d->>'budget')::numeric;
    IF n<0 OR n>1000000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'Enter a non-negative budget with up to two decimal places';END IF;
  END IF;
  IF d->>'requires_registration' IS NOT NULL AND jsonb_typeof(d->'requires_registration')<>'boolean' THEN RAISE EXCEPTION 'Choose whether member RSVP is enabled';END IF;
  people:=coalesce(d->'attendees','[]');
  IF jsonb_typeof(people)<>'array' OR jsonb_array_length(people)>100000 THEN RAISE EXCEPTION 'Invalid attendee list';END IF;
  FOR person IN SELECT value FROM jsonb_array_elements(people) LOOP
    IF jsonb_typeof(person)<>'object' OR coalesce(length(person->>'id'),0) NOT BETWEEN 1 AND 200 OR person->>'id'=ANY(seen_ids)
      OR coalesce(length(btrim(person->>'name')),0) NOT BETWEEN 1 AND 300 OR coalesce(length(person->>'role'),0)>100
      OR coalesce(length(person->>'phone'),0)>100 OR coalesce(length(person->>'email'),0)>320
      OR jsonb_typeof(person->'checked_in') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid or duplicate attendee';END IF;
    seen_ids:=array_append(seen_ids,person->>'id');
    SELECT value INTO previous FROM jsonb_array_elements(coalesce(p_old->'attendees','[]')) WHERE value->>'id'=person->>'id';
    member_key:=nullif(person->>'member_id','');
    IF previous IS NOT NULL THEN
      IF (person-ARRAY['checked_in','role']) IS DISTINCT FROM (previous-ARRAY['checked_in','role']) THEN RAISE EXCEPTION 'Saved attendee identity and registration date cannot be replaced';END IF;
    ELSE
      IF d->>'status' IN ('completed','cancelled') THEN RAISE EXCEPTION 'Registration is closed for this event';END IF;
      IF coalesce((person->>'checked_in')::boolean,false) THEN RAISE EXCEPTION 'Register a person before checking them in';END IF;
      IF member_key IS NOT NULL THEN
        SELECT * INTO m FROM public.members WHERE id=member_key OR member_id=member_key ORDER BY (id=member_key) DESC LIMIT 1;
        IF NOT FOUND OR coalesce(m.is_archived,false) OR coalesce(m.status,'active') IN ('deceased','transferred') THEN RAISE EXCEPTION 'Select an active saved member';END IF;
        member_key:=m.id;
        person:=person||jsonb_build_object('member_id',m.id,'name',concat_ws(' ',m.first_name,m.last_name),'phone',m.phone,'email',m.email);
      END IF;
      person:=person||jsonb_build_object('registered_at',clock_timestamp(),'checked_in',false);
    END IF;
    -- Resolve legacy membership codes as well as internal IDs when checking duplicates.
    IF member_key IS NOT NULL THEN
      SELECT id INTO member_key FROM public.members WHERE id=member_key OR member_id=member_key ORDER BY (id=member_key) DESC LIMIT 1;
      member_key:=coalesce(member_key,person->>'member_id');
      IF member_key=ANY(seen_members) THEN RAISE EXCEPTION 'This member is already registered';END IF;
      seen_members:=array_append(seen_members,member_key);
    END IF;
    IF d->>'status'='cancelled' AND coalesce((person->>'checked_in')::boolean,false) AND NOT coalesce((previous->>'checked_in')::boolean,false) THEN RAISE EXCEPTION 'Check-in is closed for a cancelled event';END IF;
    IF previous IS NOT NULL AND person->'checked_in' IS DISTINCT FROM previous->'checked_in' THEN
      INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
        VALUES(gen_random_uuid()::text,auth.uid(),actor_name,public.current_user_role(),'EVENT_CHECKIN_CHANGED','Events',d->>'id',
          jsonb_build_object('attendee_id',person->>'id','name',person->>'name','before',previous->'checked_in','after',person->'checked_in')::text);
    END IF;
    canonical:=canonical||jsonb_build_array(person);
  END LOOP;
  FOR previous IN SELECT value FROM jsonb_array_elements(coalesce(p_old->'attendees','[]')) LOOP
    IF NOT previous->>'id'=ANY(seen_ids) THEN
      IF coalesce((previous->>'checked_in')::boolean,false) THEN RAISE EXCEPTION 'A checked-in person cannot be removed. Correct the check-in first if it was entered in error';END IF;
      INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
        VALUES(gen_random_uuid()::text,auth.uid(),actor_name,public.current_user_role(),'REMOVE_EVENT_ATTENDEE','Events',d->>'id',previous::text);
    END IF;
  END LOOP;
  RETURN d||jsonb_build_object('title',btrim(d->>'title'),'venue',btrim(d->>'venue'),'attendees',canonical,'registration_count',jsonb_array_length(canonical));
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.prepare_event(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

DO $migration$
DECLARE definition text; previous text;
BEGIN
  SELECT pg_get_functiondef('public.gwcc_apply_mutations(uuid,jsonb)'::regprocedure) INTO definition; previous:=definition;
  definition:=replace(definition,'    IF op=''delete'' THEN',E'    IF t=''events'' AND op=''delete'' THEN RAISE EXCEPTION ''Events must be cancelled, not deleted'';END IF;\n    IF t=''events'' AND old_doc IS NOT NULL THEN\n      IF expected IS NULL OR real_version IS NULL THEN RAISE EXCEPTION ''An event version is required. Refresh before retrying; older pending changes need review'' USING ERRCODE=''40001'';END IF;\n    END IF;\n    IF t=''events'' AND old_doc IS NULL AND expected IS NOT NULL THEN RAISE EXCEPTION ''This event was removed. Refresh before retrying'' USING ERRCODE=''40001'';END IF;\n    IF op=''delete'' THEN');
  definition:=replace(definition,'    IF t=''members'' THEN',E'    IF t=''events'' THEN doc:=gwcc_private.prepare_event(doc,old_doc);END IF;\n    IF t=''members'' THEN');
  IF definition=previous OR position('prepare_event(doc,old_doc)' IN definition)=0 OR position('An event version is required' IN definition)=0 THEN RAISE EXCEPTION 'Event mutation patch did not match';END IF;EXECUTE definition;
  SELECT pg_get_functiondef('gwcc_private.member_events()'::regprocedure) INTO definition; previous:=definition;
  definition:=replace(definition,'INTO result FROM public.events e;','INTO result FROM public.events e WHERE e.status IN (''upcoming'',''ongoing'',''completed'',''cancelled'');');
  IF definition=previous THEN RAISE EXCEPTION 'Member event visibility patch did not match';END IF;EXECUTE definition;
  SELECT pg_get_functiondef('gwcc_private.member_rsvp(text)'::regprocedure) INTO definition;previous:=definition;
  -- A hidden draft must not be returned even when an older registration exists.
  definition:=replace(definition,'  people:=CASE',E'  IF e.status NOT IN (''upcoming'',''ongoing'',''completed'',''cancelled'') OR e.status IS NULL THEN RAISE EXCEPTION ''This event is no longer available'';END IF;\n  people:=CASE');
  definition:=replace(definition,'IF COALESCE(e.status,''upcoming'') IN (''cancelled'',''completed'') OR COALESCE(e.end_date,e.start_date)<current_date THEN',E'IF e.status NOT IN (''upcoming'',''ongoing'') OR NOT coalesce(e.requires_registration,false)\n    OR (coalesce(e.end_date,e.start_date)+e.end_time::time) <= (clock_timestamp() AT TIME ZONE ''Africa/Accra'') THEN');
  IF definition=previous OR position('NOT coalesce(e.requires_registration,false)' IN definition)=0 OR position('IF e.status NOT IN' IN definition)=0 THEN RAISE EXCEPTION 'Member RSVP patch did not match';END IF;EXECUTE definition;
END;
$migration$;
NOTIFY pgrst,'reload schema';
