-- GWCC: verified parent/guardian links and child pickup authorization.
-- This table intentionally does not infer relationships from surnames,
-- phone numbers, or addresses. Writes are available only through checked RPCs.
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

CREATE INDEX IF NOT EXISTS idx_member_guardians_child ON public.member_guardians (child_member_id);
CREATE INDEX IF NOT EXISTS idx_member_guardians_guardian ON public.member_guardians (guardian_member_id);

ALTER TABLE public.member_guardians ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_guardians_read_authorized ON public.member_guardians;
CREATE POLICY member_guardians_read_authorized
  ON public.member_guardians FOR SELECT TO authenticated
  USING (public.is_staff_admin() OR public.is_pastoral_authorized());

DROP POLICY IF EXISTS member_guardians_write_admin ON public.member_guardians;
DROP POLICY IF EXISTS member_guardians_insert_admin ON public.member_guardians;
DROP POLICY IF EXISTS member_guardians_update_admin ON public.member_guardians;
DROP POLICY IF EXISTS member_guardians_delete_admin ON public.member_guardians;

REVOKE ALL ON public.member_guardians FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.member_guardians FROM authenticated;
GRANT SELECT ON public.member_guardians TO authenticated;

CREATE OR REPLACE FUNCTION public.gwcc_save_member_guardian(
  p_child_member_id text,
  p_guardian_member_id text,
  p_relationship text,
  p_is_primary boolean DEFAULT false,
  p_pickup_authorized boolean DEFAULT false,
  p_authorization_notes text DEFAULT NULL,
  p_confirmed boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() NOT IN ('super_admin','senior_pastor','administrator') THEN
    RAISE EXCEPTION 'Only an authorized church administrator may manage guardian records';
  END IF;
  IF NOT COALESCE(p_confirmed,false) THEN
    RAISE EXCEPTION 'Confirm that the relationship and required consent were checked';
  END IF;
  IF p_child_member_id IS NULL OR p_guardian_member_id IS NULL OR p_child_member_id = p_guardian_member_id THEN
    RAISE EXCEPTION 'Select a child and a different guardian';
  END IF;
  IF p_relationship NOT IN ('mother','father','legal_guardian','grandparent','relative','other') THEN
    RAISE EXCEPTION 'Invalid guardian relationship';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id=p_child_member_id AND COALESCE(m.is_archived,false)=false
      AND (m.age_group='child' OR (m.date_of_birth IS NOT NULL AND m.date_of_birth > CURRENT_DATE - INTERVAL '18 years'))) THEN
    RAISE EXCEPTION 'The selected child is not an active child member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id=p_guardian_member_id AND COALESCE(m.is_archived,false)=false
      AND (m.age_group IN ('adult','senior') OR (m.date_of_birth IS NOT NULL AND m.date_of_birth <= CURRENT_DATE - INTERVAL '18 years'))) THEN
    RAISE EXCEPTION 'The selected guardian must be an active adult member';
  END IF;
  IF COALESCE(p_pickup_authorized,false) AND NULLIF(btrim(p_authorization_notes),'') IS NULL THEN
    RAISE EXCEPTION 'Record how identity and pickup consent were verified before authorizing pickup';
  END IF;

  INSERT INTO public.member_guardians (
    child_member_id, guardian_member_id, relationship, is_primary,
    pickup_authorized, authorization_notes, verified_by, verified_at
  ) VALUES (
    p_child_member_id, p_guardian_member_id, p_relationship, COALESCE(p_is_primary,false),
    COALESCE(p_pickup_authorized,false), NULLIF(btrim(p_authorization_notes),''),
    auth.uid()::text, now()
  )
  ON CONFLICT (child_member_id, guardian_member_id) DO UPDATE SET
    relationship=EXCLUDED.relationship, is_primary=EXCLUDED.is_primary,
    pickup_authorized=EXCLUDED.pickup_authorized,
    authorization_notes=EXCLUDED.authorization_notes,
    verified_by=EXCLUDED.verified_by, verified_at=EXCLUDED.verified_at
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gwcc_delete_member_guardian(p_guardian_link_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() NOT IN ('super_admin','senior_pastor','administrator') THEN
    RAISE EXCEPTION 'Only an authorized church administrator may manage guardian records';
  END IF;
  DELETE FROM public.member_guardians WHERE id=p_guardian_link_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.gwcc_save_member_guardian(text,text,text,boolean,boolean,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gwcc_delete_member_guardian(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_save_member_guardian(text,text,text,boolean,boolean,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gwcc_delete_member_guardian(uuid) TO authenticated;

DROP TRIGGER IF EXISTS member_guardians_updated_at ON public.member_guardians;
CREATE TRIGGER member_guardians_updated_at
  BEFORE UPDATE ON public.member_guardians
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.member_guardians IS
  'Verified child-to-guardian links. Pickup authorization is explicit and separate from relationship status.';
COMMENT ON COLUMN public.member_guardians.pickup_authorized IS
  'Only true after the church has verified the adult identity and received guardian consent.';
