-- GWCC: verified parent/guardian links and child pickup authorization.
-- Apply only after review in staging. This table intentionally does not infer
-- relationships from surnames, phone numbers, or addresses.
CREATE TABLE IF NOT EXISTS public.member_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_member_id TEXT NOT NULL,
  guardian_member_id TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('mother','father','legal_guardian','grandparent','relative','other')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  pickup_authorized BOOLEAN NOT NULL DEFAULT false,
  authorization_notes TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_guardians_not_self CHECK (child_member_id <> guardian_member_id),
  CONSTRAINT member_guardians_unique_pair UNIQUE (child_member_id, guardian_member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_guardians_child
  ON public.member_guardians (child_member_id);
CREATE INDEX IF NOT EXISTS idx_member_guardians_guardian
  ON public.member_guardians (guardian_member_id);

ALTER TABLE public.member_guardians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_guardians_read_authorized ON public.member_guardians;
CREATE POLICY member_guardians_read_authorized
  ON public.member_guardians FOR SELECT TO authenticated
  USING (public.is_staff_admin() OR public.is_pastoral_authorized());

DROP POLICY IF EXISTS member_guardians_write_admin ON public.member_guardians;
CREATE POLICY member_guardians_write_admin
  ON public.member_guardians FOR ALL TO authenticated
  USING (public.is_staff_admin())
  WITH CHECK (public.is_staff_admin());

REVOKE ALL ON public.member_guardians FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_guardians TO authenticated;

DROP TRIGGER IF EXISTS member_guardians_updated_at ON public.member_guardians;
CREATE TRIGGER member_guardians_updated_at
  BEFORE UPDATE ON public.member_guardians
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.member_guardians IS
  'Verified child-to-guardian links. Pickup authorization is explicit and separate from relationship status.';
COMMENT ON COLUMN public.member_guardians.pickup_authorized IS
  'Only true after the church has verified the adult identity and received guardian consent.';
