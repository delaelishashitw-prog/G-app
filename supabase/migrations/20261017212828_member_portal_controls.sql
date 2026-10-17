-- Member events expose only public event information and the caller's own RSVP.
-- Existing event rows and attendee lists are preserved.
BEGIN;
ALTER POLICY gwcc_staff_read ON public.events
  USING (public.gwcc_can_read('events') AND public.current_user_role()<>'member');

CREATE OR REPLACE FUNCTION gwcc_private.member_event(p_event public.events,p_member_id text,p_member_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'id',p_event.id,'title',p_event.title,'description',p_event.description,
    'theme',p_event.theme,'theme_scripture',p_event.theme_scripture,'event_type',p_event.event_type,
    'start_date',p_event.start_date,'end_date',p_event.end_date,'start_time',p_event.start_time,'end_time',p_event.end_time,
    'venue',p_event.venue,'speaker',p_event.speaker,'status',p_event.status,
    'requires_registration',p_event.requires_registration,'registration_count',p_event.registration_count,
    'banner_color',p_event.banner_color,'created_at',p_event.created_at,'updated_at',p_event.updated_at,
    'attendees',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a->>'id','member_id',a->>'member_id',
       'registered_at',a->>'registered_at','checked_in',a->'checked_in'))
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_event.attendees)='array' THEN p_event.attendees ELSE '[]'::jsonb END) a
      WHERE a->>'member_id'=p_member_id OR (NULLIF(p_member_code,'') IS NOT NULL AND a->>'member_id'=p_member_code)),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION gwcc_private.member_event(public.events,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.member_events() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.members;result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role()<>'member' THEN
    RAISE EXCEPTION 'An active verified member sign-in is required' USING ERRCODE='42501';END IF;
  SELECT * INTO m FROM public.members WHERE auth_user_id=auth.uid() AND NOT COALESCE(is_archived,false)
    AND COALESCE(status,'active') NOT IN ('deceased','transferred');
  IF NOT FOUND THEN RAISE EXCEPTION 'Your login is not linked to an active member record' USING ERRCODE='42501';END IF;
  SELECT COALESCE(jsonb_agg(gwcc_private.member_event(e,m.id,m.member_id) ORDER BY e.start_date,e.id),'[]'::jsonb)
    INTO result FROM public.events e;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.member_events() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.member_events() TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_member_events() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.member_events(); $$;
REVOKE ALL ON FUNCTION public.gwcc_member_events() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_member_events() TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.member_rsvp(p_event_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.members;e public.events;people jsonb;entry jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role()<>'member' THEN
    RAISE EXCEPTION 'An active verified member sign-in is required' USING ERRCODE='42501';END IF;
  SELECT * INTO m FROM public.members WHERE auth_user_id=auth.uid() AND NOT COALESCE(is_archived,false)
    AND COALESCE(status,'active') NOT IN ('deceased','transferred');
  IF NOT FOUND THEN RAISE EXCEPTION 'Your login is not linked to an active member record' USING ERRCODE='42501';END IF;
  SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This event is no longer available';END IF;
  people:=CASE WHEN jsonb_typeof(e.attendees)='array' THEN e.attendees ELSE '[]'::jsonb END;
  -- A retry after a lost response returns the saved registration without appending again.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(people) a WHERE a->>'member_id'=m.id OR a->>'member_id'=NULLIF(m.member_id,'')) THEN
    RETURN gwcc_private.member_event(e,m.id,m.member_id);END IF;
  IF COALESCE(e.status,'upcoming') IN ('cancelled','completed') OR COALESCE(e.end_date,e.start_date)<current_date THEN
    RAISE EXCEPTION 'Registration is closed for this event';END IF;
  IF NOT public.gwcc_consume_api_limit('member_requests') THEN RAISE EXCEPTION 'Too many requests. Try again in a minute.';END IF;
  entry:=jsonb_build_object('id',gen_random_uuid()::text,'member_id',m.id,'name',concat_ws(' ',m.first_name,m.last_name),
    'phone',m.phone,'email',m.email,'role','Member','registered_at',clock_timestamp(),'checked_in',false);
  people:=people||jsonb_build_array(entry);
  UPDATE public.events SET attendees=people,registration_count=jsonb_array_length(people),updated_at=clock_timestamp()
    WHERE id=e.id RETURNING * INTO e;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,auth.uid(),concat_ws(' ',m.first_name,m.last_name),'member','MEMBER_EVENT_RSVP','Member Portal',e.id,'Verified member event registration');
  RETURN gwcc_private.member_event(e,m.id,m.member_id);
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.member_rsvp(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.member_rsvp(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_member_rsvp(p_event_id text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.member_rsvp(p_event_id); $$;
REVOKE ALL ON FUNCTION public.gwcc_member_rsvp(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_member_rsvp(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
