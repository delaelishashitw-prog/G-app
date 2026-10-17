-- Every existing record RLS rule and privileged RPC uses this canonical role.
-- Own-profile SELECT remains available for sign-in/enrollment; other profiles do not.
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT CASE WHEN (s->>'satisfied')::boolean THEN s->>'role' ELSE 'disabled' END
    FROM (SELECT gwcc_private.security_state() s) state;
$$;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Authenticated SMS previews/history must use the session's canonical role.
-- Service-only send bookkeeping uses the protected actor profile after the API
-- has checked the caller's security state; the service credential has no user JWT.
CREATE OR REPLACE FUNCTION gwcc_private.sms_actor(p_actor uuid,p_send boolean) RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT p.role FROM public.profiles p JOIN auth.users u ON u.id::text=p.id
  WHERE u.id=p_actor AND u.email_confirmed_at IS NOT NULL AND p.is_active IS TRUE
    AND p.has_login_account IS TRUE AND p.authorization_reviewed_at IS NOT NULL
    AND COALESCE((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity'::timestamptz)<=now()
    AND ((auth.jwt()->>'role'='service_role' AND auth.uid() IS NULL)
      OR (p_actor=auth.uid() AND public.current_user_role()=p.role))
    AND (p.role IN ('super_admin','senior_pastor','administrator') OR (NOT p_send AND p.role IN ('pastor','ministry_leader')));
$$;
REVOKE ALL ON FUNCTION gwcc_private.sms_actor(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
