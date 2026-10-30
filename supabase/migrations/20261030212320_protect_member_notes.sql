-- Keep existing notes in place; restrict both direct reads and RPC responses.
REVOKE SELECT ON public.members FROM PUBLIC,anon,authenticated;
REVOKE SELECT(notes) ON public.members FROM PUBLIC,anon,authenticated;
DO $$ DECLARE columns text; BEGIN
  SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO columns
  FROM pg_attribute WHERE attrelid='public.members'::regclass AND attnum>0 AND NOT attisdropped AND attname<>'notes';
  EXECUTE 'GRANT SELECT ('||columns||') ON public.members TO authenticated';
END $$;

CREATE OR REPLACE FUNCTION gwcc_private.member_notes() RETURNS TABLE(id text,notes text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() NOT IN ('super_admin','senior_pastor','pastor') THEN
    RAISE EXCEPTION 'Pastoral authorization is required for confidential member notes' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT m.id,m.notes FROM public.members m;
END $$;
REVOKE ALL ON FUNCTION gwcc_private.member_notes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION gwcc_private.member_notes() TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_member_notes() RETURNS TABLE(id text,notes text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM gwcc_private.member_notes(); $$;
REVOKE ALL ON FUNCTION public.gwcc_member_notes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_member_notes() TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.protect_member_notes() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- Maintenance/service SQL is trusted; browser mutations already require a verified user.
  IF auth.uid() IS NOT NULL AND public.current_user_role() NOT IN ('super_admin','senior_pastor','pastor') THEN
    IF TG_OP='INSERT' THEN
      IF nullif(btrim(NEW.notes),'') IS NOT NULL THEN RAISE EXCEPTION 'Pastoral authorization is required to write confidential notes' USING ERRCODE='42501';END IF;
      NEW.notes:=NULL;
    ELSE
      IF nullif(btrim(NEW.notes),'') IS NOT NULL AND NEW.notes IS DISTINCT FROM OLD.notes THEN
        RAISE EXCEPTION 'Pastoral authorization is required to write confidential notes' USING ERRCODE='42501';
      END IF;
      -- A directory edit from an older client must not erase existing private notes.
      NEW.notes:=OLD.notes;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION gwcc_private.protect_member_notes() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS gwcc_protect_member_notes ON public.members;
CREATE TRIGGER gwcc_protect_member_notes BEFORE INSERT OR UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION gwcc_private.protect_member_notes();

CREATE OR REPLACE FUNCTION gwcc_private.project_member_notes_result(p_result jsonb) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT CASE WHEN public.current_user_role() IN ('super_admin','senior_pastor','pastor') THEN p_result ELSE
    COALESCE((SELECT jsonb_agg(CASE WHEN item->>'table'='members' AND jsonb_typeof(item->'record')='object'
      THEN jsonb_set(item,'{record}',(item->'record')-'notes') ELSE item END ORDER BY ordinal)
      FROM jsonb_array_elements(p_result) WITH ORDINALITY AS rows(item,ordinal)),'[]'::jsonb) END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.project_member_notes_result(jsonb) FROM PUBLIC,anon,authenticated;

-- Redact fresh acknowledgments and old idempotency receipts without rewriting their hashes.
DO $migration$ DECLARE definition text; previous text; target regprocedure; BEGIN
  target:='public.gwcc_apply_mutations(uuid,jsonb)'::regprocedure;
  SELECT pg_get_functiondef(target) INTO definition;previous:=definition;
  IF position('project_member_notes_result' IN definition)=0 THEN
  definition:=replace(definition,'RETURN previous.result;','RETURN gwcc_private.project_member_notes_result(previous.result);');
  definition:=replace(definition,'RETURN result;','RETURN gwcc_private.project_member_notes_result(result);');
  IF definition=previous THEN RAISE EXCEPTION 'Member mutation response protection did not match';END IF;EXECUTE definition;END IF;
  target:='gwcc_private.reconcile_sync_operation(uuid,uuid,jsonb)'::regprocedure;
  SELECT pg_get_functiondef(target) INTO definition;previous:=definition;
  IF position('project_member_notes_result' IN definition)=0 THEN
  definition:=replace(definition,'RETURN recovered.result;','RETURN gwcc_private.project_member_notes_result(recovered.result);');
  definition:=replace(definition,'RETURN result;','RETURN gwcc_private.project_member_notes_result(result);');
  IF definition=previous THEN RAISE EXCEPTION 'Member recovery response protection did not match';END IF;EXECUTE definition;END IF;
  target:='public.gwcc_member_action(text,text,jsonb)'::regprocedure;
  SELECT pg_get_functiondef(target) INTO definition;previous:=definition;
  IF position('saved:=saved-''notes''' IN definition)=0 THEN
  definition:=replace(definition,'RETURN saved;',E'IF p_action=''profile'' AND r NOT IN (''super_admin'',''senior_pastor'',''pastor'') THEN saved:=saved-''notes'';END IF;\n  RETURN saved;');
  IF definition=previous THEN RAISE EXCEPTION 'Member profile response protection did not match';END IF;EXECUTE definition;END IF;
END $migration$;
NOTIFY pgrst,'reload schema';
