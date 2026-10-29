-- Read-only activation snapshot. Auth account fields stay inside this guarded
-- private function; the response contains no passwords, tokens or Auth metadata.
CREATE OR REPLACE FUNCTION gwcc_private.member_activation_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE security jsonb:=gwcc_private.security_state(); result jsonb;
BEGIN
  IF auth.uid() IS NULL OR security->>'role' IS DISTINCT FROM 'super_admin'
    OR (security->>'satisfied')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'A reviewed super administrator with two-factor verification is required' USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM public.members WHERE is_archived IS NOT TRUE)>10000 THEN
    RAISE EXCEPTION 'The activation directory exceeds the supported limit';
  END IF;
  WITH accounts AS (
    SELECT m.id,m.member_id,m.first_name,m.last_name,m.status,m.auth_user_id,
      btrim(coalesce(m.email,'')) AS contact_email,
      u.id AS account_id,u.email AS login_email,u.email_confirmed_at,
      coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity'::timestamptz)>now() AS banned,
      p.id AS profile_id,p.role,p.is_active,p.has_login_account,p.member_id AS profile_member_id,
      CASE
        WHEN m.status IN ('deceased','transferred') THEN 'Review this member record before enabling access.'
        WHEN m.auth_user_id IS NULL AND btrim(coalesce(m.email,'')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN 'Add a valid email address belonging to this member.'
        WHEN m.auth_user_id IS NOT NULL AND u.id IS NULL THEN 'The linked authentication account needs review.'
        WHEN m.auth_user_id IS NULL AND (SELECT count(*) FROM auth.users x WHERE lower(x.email)=lower(btrim(m.email)))>1 THEN 'More than one authentication account matches this email.'
        WHEN u.id IS NOT NULL AND p.id IS NULL THEN 'The authentication account has no available member profile.'
        WHEN u.id IS NULL AND EXISTS(SELECT 1 FROM public.profiles q WHERE lower(q.email)=lower(btrim(m.email)) AND q.has_login_account IS TRUE) THEN 'The directory account has no available authentication account.'
        WHEN p.id IS NOT NULL AND p.role IS DISTINCT FROM 'member' THEN 'This email belongs to a staff account. Review the member email.'
        WHEN p.id IS NOT NULL AND (p.is_active IS DISTINCT FROM true OR p.has_login_account IS DISTINCT FROM true OR coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity'::timestamptz)>now()) THEN 'This login is disabled or suspended.'
        WHEN p.member_id IS NOT NULL AND p.member_id<>m.id THEN 'This account is assigned to another member.'
        WHEN u.id IS NOT NULL AND EXISTS(SELECT 1 FROM public.members other WHERE other.id<>m.id AND other.auth_user_id::text=u.id::text) THEN 'This account is linked to another member.'
      END AS review_reason
    FROM public.members m
    LEFT JOIN LATERAL (
      SELECT account.* FROM auth.users account
      WHERE (m.auth_user_id IS NOT NULL AND account.id::text=m.auth_user_id::text)
        OR (m.auth_user_id IS NULL AND lower(account.email)=lower(btrim(m.email)))
      ORDER BY account.id LIMIT 1
    ) u ON true
    LEFT JOIN public.profiles p ON p.id=u.id::text
    WHERE m.is_archived IS NOT TRUE
  ), classified AS (
    SELECT id,member_id,first_name,last_name,
      CASE WHEN auth_user_id IS NOT NULL THEN coalesce(login_email,contact_email) ELSE contact_email END AS email,
      CASE
        WHEN auth_user_id IS NULL AND contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND (status IS NULL OR status NOT IN ('deceased','transferred')) THEN 'needs_email'
        WHEN review_reason IS NOT NULL THEN 'review'
        WHEN account_id IS NULL THEN 'not_invited'
        WHEN auth_user_id IS NULL THEN 'needs_link'
        WHEN email_confirmed_at IS NULL THEN 'pending'
        ELSE 'ready'
      END AS state,
      review_reason
    FROM accounts
  ) SELECT jsonb_build_object('generated_at',now(),'members',coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'member_id',coalesce(member_id,''),'name',concat_ws(' ',first_name,last_name),'email',email,
      'state',state,'reason',review_reason) ORDER BY lower(last_name),lower(first_name),id),'[]'::jsonb)) INTO result
    FROM classified;
  RETURN result;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.member_activation_overview() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION gwcc_private.member_activation_overview() TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_member_activation_overview() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.member_activation_overview();$$;
REVOKE ALL ON FUNCTION public.gwcc_member_activation_overview() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.gwcc_member_activation_overview() TO authenticated;

-- Repair the previously identified missing completion flag using the already
-- recorded graduation. Certificates, student history and other member fields
-- are preserved. Re-running the migration does not duplicate the repair/audit.
DO $repair$
DECLARE repaired record;
BEGIN
  FOR repaired IN
    UPDATE public.members m SET membership_class_completed=true
    WHERE m.membership_class_completed IS NOT TRUE AND EXISTS(
      SELECT 1 FROM public.gwcc_documents d WHERE d.namespace='foundation_students'
        AND d.data->>'member_id'=m.id AND d.data->>'status'='graduated')
    RETURNING m.id
  LOOP
    INSERT INTO public.audit_logs(id,user_name,user_role,action,module,record_id,details)
      VALUES(gen_random_uuid()::text,'System migration','system','REPAIR_FOUNDATION_COMPLETION','Discipleship',repaired.id,
        'Restored member completion flag from an existing recorded Foundation School graduation; certificate and history preserved.');
  END LOOP;
END;
$repair$;
NOTIFY pgrst,'reload schema';
