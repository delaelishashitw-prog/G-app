-- Bootstrap only the caller's security state. No records, factor secrets or account lists.
CREATE OR REPLACE FUNCTION gwcc_private.security_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); actor_role text; factor_count integer; required boolean; passed boolean;
BEGIN
  SELECT p.role INTO actor_role FROM public.profiles p JOIN auth.users u ON u.id::text=p.id
    WHERE u.id=actor AND u.email_confirmed_at IS NOT NULL AND p.is_active IS TRUE
      AND p.has_login_account IS TRUE AND (p.role='member' OR p.authorization_reviewed_at IS NOT NULL)
      AND COALESCE((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity'::timestamptz)<=now();
  IF actor_role IS NULL THEN
    RETURN jsonb_build_object('role','disabled','required',false,'verified_factors',0,'satisfied',false);
  END IF;
  SELECT count(*)::integer INTO factor_count FROM auth.mfa_factors WHERE user_id=actor AND status='verified';
  required:=actor_role IN ('super_admin','senior_pastor','administrator','finance_officer') OR factor_count>0;
  -- Check the signed JWT AND the live session: removing a factor, signing out or
  -- revoking a session must not leave an old AAL2 bearer token usable for records.
  passed:=NOT required OR (factor_count>0 AND auth.jwt()->>'aal'='aal2' AND EXISTS(
    SELECT 1 FROM auth.sessions s JOIN auth.mfa_factors f ON f.id=s.factor_id AND f.user_id=s.user_id AND f.status='verified'
    WHERE s.user_id=actor AND s.id::text=auth.jwt()->>'session_id' AND s.aal='aal2'
      AND (s.not_after IS NULL OR s.not_after>now())));
  RETURN jsonb_build_object('role',actor_role,'required',required,'verified_factors',factor_count,'satisfied',COALESCE(passed,false));
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.security_state() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION gwcc_private.security_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.gwcc_security_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.security_state();$$;
REVOKE ALL ON FUNCTION public.gwcc_security_status() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.gwcc_security_status() TO authenticated;

NOTIFY pgrst,'reload schema';
