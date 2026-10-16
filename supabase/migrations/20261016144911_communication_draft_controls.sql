-- Add draft metadata without rewriting historical messages or member contacts.
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS recipient_group_id text;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS recipient_group_name text;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS recipient_ids text[];
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.communications ALTER COLUMN status SET DEFAULT 'draft';

-- Match database visibility to the Communication module's reviewed staff roles.
CREATE OR REPLACE FUNCTION public.gwcc_can_read(p_table text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r text:=public.current_user_role();
BEGIN
  IF r IN ('disabled','anon') THEN RETURN false;END IF;
  IF r IN ('super_admin','senior_pastor') THEN RETURN true;END IF;
  IF p_table='communications' THEN RETURN r IN ('administrator','pastor','ministry_leader');END IF;
  IF p_table IN ('church_accounts','church_finances','giving','pledges','pledge_campaigns','expenses','department_budgets') THEN RETURN r='finance_officer';END IF;
  IF p_table IN ('pastoral_care','pastoral_visitations','counseling_sessions','intercessory_slots','prayer_requests') THEN RETURN r='pastor';END IF;
  IF p_table IN ('welfare_events','welfare_event_contributions','welfare_contributions','welfare_claims') THEN RETURN r IN ('administrator','finance_officer','pastor');END IF;
  IF p_table IN ('profiles','audit_logs','settings','assets','asset_maintenance_logs') THEN RETURN r='administrator';END IF;
  IF p_table IN ('services','events') THEN RETURN true;END IF;
  IF p_table IN ('attendance','headcounts','child_check_ins') THEN RETURN r IN ('administrator','pastor','ministry_leader','attendance_officer','data_entry');END IF;
  IF p_table IN ('members','visitors','ministries','small_groups','foundation_cohorts','foundation_students','roster_assignments') THEN RETURN r IN ('administrator','pastor','ministry_leader','attendance_officer','data_entry') OR (p_table='members' AND r='finance_officer');END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.gwcc_can_read(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_can_read(text) TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.communication_phone(p_phone text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE digits text:=btrim(COALESCE(p_phone,''));
BEGIN
  IF digits='' OR digits !~ '^(\+|00)?[0-9 ()-]+$' THEN RETURN NULL;END IF;
  digits:=regexp_replace(digits,'[ ()-]','','g');
  IF left(digits,1)='+' THEN digits:=substring(digits FROM 2);
  ELSIF left(digits,2)='00' THEN digits:=substring(digits FROM 3);
  ELSIF digits ~ '^0[235][0-9]{8}$' THEN digits:='233'||substring(digits FROM 2);
  ELSIF digits ~ '^[235][0-9]{8}$' THEN digits:='233'||digits;
  END IF;
  IF digits !~ '^[1-9][0-9]{7,14}$' OR (left(digits,3)='233' AND digits !~ '^233[235][0-9]{8}$')
    OR (left(digits,1)='1' AND length(digits)<>11) THEN RETURN NULL;END IF;
  RETURN digits;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.communication_phone(text) FROM PUBLIC,anon,authenticated;

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
  IF NEW.recipient_type IS NULL OR NEW.recipient_type NOT IN ('all_members','visitors','leaders','ministry','small_group','custom') THEN RAISE EXCEPTION 'Choose a supported recipient audience';END IF;
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
  ELSIF NEW.recipient_type='custom' THEN
    IF NEW.recipient_ids IS NOT NULL THEN RAISE EXCEPTION 'Choose a supported audience for this older draft';END IF;
    NEW.recipient_group_id:=NULL;NEW.recipient_group_name:=NULL;RETURN NEW;
  ELSE NEW.recipient_group_id:=NULL;NEW.recipient_group_name:=NULL;
  END IF;
  WITH people AS (
    SELECT id,gwcc_private.communication_phone(phone) AS phone FROM public.members
      WHERE NEW.recipient_type<>'visitors' AND is_archived IS NOT TRUE AND status IN ('active','leader','new_member','new_convert')
      AND (NEW.recipient_type='all_members' OR (NEW.recipient_type='leaders' AND (status='leader' OR NULLIF(btrim(leadership_position),'') IS NOT NULL))
        OR (NEW.recipient_type='ministry' AND ministry_id=NEW.recipient_group_id) OR (NEW.recipient_type='small_group' AND small_group_id=NEW.recipient_group_id))
    UNION ALL SELECT id,gwcc_private.communication_phone(phone) FROM public.visitors WHERE NEW.recipient_type='visitors' AND COALESCE(follow_up_status,'new') NOT IN ('closed','converted_to_member')
  ), unique_phones AS (SELECT DISTINCT ON (phone) id FROM people WHERE phone IS NOT NULL ORDER BY phone,id COLLATE "C")
  SELECT COALESCE(array_agg(id ORDER BY id COLLATE "C"),'{}'::text[]) INTO NEW.recipient_ids FROM unique_phones;
  NEW.recipient_count:=cardinality(NEW.recipient_ids);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.prepare_communication_draft() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS gwcc_prepare_communication_draft ON public.communications;
CREATE TRIGGER gwcc_prepare_communication_draft BEFORE INSERT OR UPDATE ON public.communications FOR EACH ROW EXECUTE FUNCTION gwcc_private.prepare_communication_draft();

-- The existing RPC already checks supplied versions. Require one for saved drafts
-- once a server version exists, so a stale tab cannot overwrite a newer edit.
DO $$
DECLARE definition text; anchor text:='IF t=''church_finances'' AND old_doc IS NOT NULL AND expected IS NULL THEN RAISE EXCEPTION ''A transaction version is required to change a saved receipt''; END IF;';
BEGIN
  SELECT pg_get_functiondef('public.gwcc_apply_mutations(uuid,jsonb)'::regprocedure) INTO definition;
  IF position('A draft version is required' IN definition)=0 THEN
    IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Mutation version guard changed; review the communication migration before applying';END IF;
    definition:=replace(definition,anchor,anchor||E'\n    IF t=''communications'' AND old_doc->>''updated_at'' IS NOT NULL AND expected IS NULL THEN RAISE EXCEPTION ''A draft version is required to change a saved message'';END IF;');
    EXECUTE definition;
  END IF;
END $$;
