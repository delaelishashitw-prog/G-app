-- Add individual audiences without rewriting existing drafts, dispatches or contacts.
-- One canonical resolver is shared by draft saving and SMS preview/claim.
CREATE OR REPLACE FUNCTION gwcc_private.communication_audience(p_type text,p_target text)
RETURNS TABLE(id text,name text,phone text) LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT m.id,concat_ws(' ',m.first_name,m.last_name),gwcc_private.communication_phone(m.phone)
  FROM public.members m WHERE m.is_archived IS NOT TRUE AND m.status IN ('active','leader','new_member','new_convert')
    AND (p_type='all_members' OR (p_type='leaders' AND (m.status='leader' OR NULLIF(btrim(m.leadership_position),'') IS NOT NULL))
      OR (p_type='ministry' AND m.ministry_id=p_target) OR (p_type='small_group' AND m.small_group_id=p_target)
      OR (p_type='individual_member' AND m.id=p_target))
  UNION ALL SELECT v.id,v.full_name,gwcc_private.communication_phone(v.phone)
  FROM public.visitors v WHERE COALESCE(v.follow_up_status,'new') NOT IN ('closed','converted_to_member')
    AND (p_type='visitors' OR (p_type='individual_visitor' AND v.id=p_target));
$$;
REVOKE ALL ON FUNCTION gwcc_private.communication_audience(text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION gwcc_private.prepare_communication_draft() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.communications; group_name text; saving_archive boolean;
BEGIN
  SELECT * INTO previous FROM public.communications WHERE id=NEW.id;
  IF previous.id IS NOT NULL AND previous.status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Copy this historical message to a new draft instead of changing its record';END IF;
  IF NULLIF(btrim(NEW.title),'') IS NULL OR length(btrim(NEW.title))>200 THEN RAISE EXCEPTION 'Enter a title with 1-200 characters';END IF;
  IF NULLIF(btrim(NEW.message),'') IS NULL OR length(btrim(NEW.message))>5000 THEN RAISE EXCEPTION 'Enter a message with 1-5000 characters';END IF;
  IF NEW.recipient_count IS NULL OR NEW.recipient_count<0 THEN RAISE EXCEPTION 'Recipient count must be non-negative';END IF;
  IF NEW.channel IS NULL OR NEW.channel NOT IN ('sms','whatsapp','announcement') THEN RAISE EXCEPTION 'Choose a supported message channel';END IF;
  IF NEW.recipient_type IS NULL OR NEW.recipient_type NOT IN ('all_members','visitors','leaders','ministry','small_group','individual_member','individual_visitor','custom') THEN RAISE EXCEPTION 'Choose a supported recipient audience';END IF;
  IF NEW.sender_id IS NULL OR btrim(NEW.sender_id) !~ '^[A-Za-z0-9 -]{1,11}$' THEN RAISE EXCEPTION 'Sender ID must use 1-11 letters, numbers, spaces or hyphens';END IF;
  NEW.title:=btrim(NEW.title);NEW.message:=btrim(NEW.message);NEW.sender_id:=btrim(NEW.sender_id);NEW.status:='draft';
  NEW.created_by:=CASE WHEN previous.id IS NULL THEN auth.uid()::text ELSE previous.created_by END;
  NEW.created_at:=COALESCE(previous.created_at,previous.sent_at,now());
  NEW.sent_at:=COALESCE(previous.sent_at,NEW.created_at);NEW.updated_by:=auth.uid()::text;NEW.updated_at:=clock_timestamp();
  saving_archive:=previous.id IS NOT NULL AND NEW.archived_at IS DISTINCT FROM previous.archived_at;
  IF previous.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL AND NOT saving_archive THEN RAISE EXCEPTION 'Restore this archived draft before editing';END IF;
  IF saving_archive THEN
    IF NEW.title IS DISTINCT FROM previous.title OR NEW.message IS DISTINCT FROM previous.message OR NEW.recipient_type IS DISTINCT FROM previous.recipient_type
      OR NEW.channel IS DISTINCT FROM previous.channel OR NEW.sender_id IS DISTINCT FROM previous.sender_id
      OR NEW.recipient_group_id IS DISTINCT FROM previous.recipient_group_id OR NEW.recipient_ids IS DISTINCT FROM previous.recipient_ids THEN
      RAISE EXCEPTION 'Archive or restore a draft separately from editing its contents';END IF;
    NEW.recipient_ids:=previous.recipient_ids;NEW.recipient_group_name:=previous.recipient_group_name;NEW.recipient_count:=previous.recipient_count;
    IF NEW.archived_at IS NOT NULL THEN NEW.archived_at:=clock_timestamp();END IF;
    RETURN NEW;
  END IF;
  IF NEW.recipient_type IN ('ministry','small_group') THEN
    IF NULLIF(NEW.recipient_group_id,'') IS NULL THEN
      IF NEW.recipient_ids IS NOT NULL THEN RAISE EXCEPTION 'Choose a ministry or small group';END IF;
      -- Older clients saved only a count. Retain that draft for explicit audience review.
      NEW.recipient_group_name:=NULL;RETURN NEW;
    END IF;
    IF NEW.recipient_type='ministry' THEN SELECT name INTO group_name FROM public.ministries WHERE id=NEW.recipient_group_id;
    ELSE SELECT name INTO group_name FROM public.small_groups WHERE id=NEW.recipient_group_id;END IF;
    IF group_name IS NULL THEN RAISE EXCEPTION 'This recipient group is no longer available. Choose another group';END IF;
    NEW.recipient_group_name:=group_name;
  ELSIF NEW.recipient_type IN ('individual_member','individual_visitor') THEN
    SELECT a.name INTO group_name FROM gwcc_private.communication_audience(NEW.recipient_type,NEW.recipient_group_id) a;
    IF NULLIF(NEW.recipient_group_id,'') IS NULL OR group_name IS NULL THEN
      RAISE EXCEPTION 'Choose one current member or visitor for this personal draft';
    END IF;
    NEW.recipient_group_name:=group_name;
  ELSIF NEW.recipient_type='custom' THEN
    IF NEW.recipient_ids IS NOT NULL THEN RAISE EXCEPTION 'Choose a supported audience for this older draft';END IF;
    NEW.recipient_group_id:=NULL;NEW.recipient_group_name:=NULL;RETURN NEW;
  ELSE NEW.recipient_group_id:=NULL;NEW.recipient_group_name:=NULL;
  END IF;
  WITH people AS (SELECT id,phone FROM gwcc_private.communication_audience(NEW.recipient_type,NEW.recipient_group_id)),
  unique_phones AS (SELECT DISTINCT ON (phone) id FROM people WHERE phone IS NOT NULL ORDER BY phone,id COLLATE "C")
  SELECT COALESCE(array_agg(id ORDER BY id COLLATE "C"),'{}'::text[]) INTO NEW.recipient_ids FROM unique_phones;
  IF NEW.recipient_type IN ('individual_member','individual_visitor') AND cardinality(NEW.recipient_ids)<>1 THEN
    RAISE EXCEPTION 'Choose one current contact with a complete valid phone number';
  END IF;
  NEW.recipient_count:=cardinality(NEW.recipient_ids);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.prepare_communication_draft() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS gwcc_prepare_communication_draft ON public.communications;
CREATE TRIGGER gwcc_prepare_communication_draft BEFORE INSERT OR UPDATE ON public.communications FOR EACH ROW EXECUTE FUNCTION gwcc_private.prepare_communication_draft();


CREATE OR REPLACE FUNCTION gwcc_private.sms_snapshot(p_actor uuid,p_draft_id text,p_version text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.communications; people jsonb; recipients jsonb; excluded jsonb; current_ids text[]; doc jsonb;
BEGIN
  IF gwcc_private.sms_actor(p_actor,true) IS NULL THEN RAISE EXCEPTION 'Your role cannot send SMS' USING ERRCODE='42501';END IF;
  SELECT * INTO d FROM public.communications WHERE id=p_draft_id;
  IF NOT FOUND OR d.status IS DISTINCT FROM 'draft' OR d.channel IS DISTINCT FROM 'sms' OR d.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Choose an active SMS draft';END IF;
  IF p_version IS NULL OR d.updated_at IS NULL OR d.updated_at IS DISTINCT FROM p_version::timestamptz THEN RAISE EXCEPTION 'Save this draft and wait for cloud confirmation before reviewing SMS';END IF;
  IF d.message ILIKE '%[First Name]%' THEN RAISE EXCEPTION 'Replace the first-name placeholder before reviewing SMS';END IF;
  IF d.recipient_type IN ('individual_member','individual_visitor') AND (d.recipient_group_id IS NULL OR cardinality(d.recipient_ids) IS DISTINCT FROM 1 OR d.recipient_ids[1] IS DISTINCT FROM d.recipient_group_id) THEN
    RAISE EXCEPTION 'Review and save the single contact for this personal draft';
  END IF;
  IF d.recipient_ids IS NULL OR d.recipient_type='custom' THEN RAISE EXCEPTION 'Review and save this older draft audience first';END IF;
  IF d.recipient_type='ministry' AND NOT EXISTS(SELECT 1 FROM public.ministries WHERE id=d.recipient_group_id)
    OR d.recipient_type='small_group' AND NOT EXISTS(SELECT 1 FROM public.small_groups WHERE id=d.recipient_group_id) THEN RAISE EXCEPTION 'This recipient group is no longer available';END IF;
  WITH candidates AS (
    SELECT * FROM gwcc_private.communication_audience(d.recipient_type,d.recipient_group_id)
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

NOTIFY pgrst,'reload schema';
