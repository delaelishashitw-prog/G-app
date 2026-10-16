-- Preserve legacy records while enforcing valid service links for future writes.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS announcements_minister text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS announcements text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$ DECLARE relation_name text; constraint_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['attendance','headcounts','roster_assignments','giving'] LOOP
    constraint_name := 'gwcc_' || relation_name || '_service_ref';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=format('public.%I',relation_name)::regclass AND conname=constraint_name) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(service_id) REFERENCES public.services(id) ON DELETE RESTRICT NOT VALID',relation_name,constraint_name);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.services'::regclass AND conname='gwcc_service_schedule_valid') THEN
    ALTER TABLE public.services ADD CONSTRAINT gwcc_service_schedule_valid CHECK (
      length(trim(name)) > 0 AND lower(trim(day_of_week)) IN ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')
      AND start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      AND end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      AND left(start_time,5) <> left(end_time,5)
      AND (expected_attendance IS NULL OR expected_attendance >= 0)
    ) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS gwcc_roster_service_idx ON public.roster_assignments(service_id);
CREATE INDEX IF NOT EXISTS gwcc_giving_service_idx ON public.giving(service_id);
