-- Keep role and ownership predicates intact while caching auth.uid() once per statement.
-- Validated in GWCC staging on 30 October 2026. No data or grants are changed.
ALTER POLICY gwcc_profile_self_read ON public.profiles
  USING (id = (SELECT auth.uid())::text AND is_active IS TRUE);

ALTER POLICY gwcc_member_self_read ON public.members
  USING (public.current_user_role() = 'member' AND auth_user_id = (SELECT auth.uid()));
