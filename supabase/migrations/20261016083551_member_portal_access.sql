-- Linking is atomic and always uses the exact Auth UUID. No email/name fallback grants access.
CREATE SCHEMA IF NOT EXISTS gwcc_private;
REVOKE ALL ON SCHEMA gwcc_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA gwcc_private TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.link_member_login(p_member_id text, p_auth_user_id uuid, p_expected_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.members; p public.profiles; account_email text;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Only a super administrator may link member logins' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-profile-management'));
  SELECT * INTO m FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member record not found'; END IF;
  IF m.is_archived IS TRUE OR m.status IN ('deceased','transferred') THEN RAISE EXCEPTION 'Review and restore this member before linking a login'; END IF;
  IF m.auth_user_id IS NOT NULL AND m.auth_user_id <> p_auth_user_id THEN RAISE EXCEPTION 'This member already has a different login'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = p_auth_user_id::text FOR UPDATE;
  IF NOT FOUND OR p.role <> 'member' OR p.is_active IS NOT TRUE OR p.has_login_account IS NOT TRUE THEN
    RAISE EXCEPTION 'Choose an active member account; staff accounts cannot be linked';
  END IF;
  SELECT lower(trim(email)) INTO account_email FROM auth.users WHERE id = p_auth_user_id;
  IF account_email IS NULL OR account_email = '' OR account_email IS DISTINCT FROM lower(trim(p_expected_email))
    OR lower(trim(p.email)) IS DISTINCT FROM account_email THEN RAISE EXCEPTION 'The authentication email changed; check the account again'; END IF;
  IF (NULLIF(p.member_id,'') IS NOT NULL AND p.member_id <> m.id)
    OR EXISTS(SELECT 1 FROM public.members WHERE auth_user_id = p_auth_user_id AND id <> m.id) THEN
    RAISE EXCEPTION 'This login is already assigned to another member';
  END IF;
  UPDATE public.members SET auth_user_id = p_auth_user_id, updated_at = now() WHERE id = m.id;
  UPDATE public.profiles SET member_id = m.id, updated_at = now() WHERE id = p.id;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
    VALUES(gen_random_uuid()::text,auth.uid(),auth.uid()::text,'super_admin','LINK_MEMBER_LOGIN','Member Portal',m.id,
      jsonb_build_object('auth_user_id',p_auth_user_id,'member_id',m.id)::text);
  RETURN jsonb_build_object('member_id',m.id,'auth_user_id',p_auth_user_id);
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.link_member_login(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION gwcc_private.link_member_login(text,uuid,text) TO authenticated;

-- Only the guarded implementation runs with owner privileges; the Data API wrapper does not.
CREATE OR REPLACE FUNCTION public.gwcc_link_member_login(p_member_id text, p_auth_user_id uuid, p_expected_email text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT gwcc_private.link_member_login(p_member_id, p_auth_user_id, p_expected_email);
$$;
REVOKE ALL ON FUNCTION public.gwcc_link_member_login(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gwcc_link_member_login(text,uuid,text) TO authenticated;
