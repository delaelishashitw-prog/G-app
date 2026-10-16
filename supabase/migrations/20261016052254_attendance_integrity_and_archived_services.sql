BEGIN;

-- Inactive historical references retain their original identity without inventing a schedule.
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS gwcc_service_schedule_valid;
ALTER TABLE public.services ADD CONSTRAINT gwcc_service_schedule_valid CHECK (
  length(trim(name)) > 0 AND (expected_attendance IS NULL OR expected_attendance >= 0)
  AND (
    (is_active IS FALSE AND day_of_week = '' AND start_time = '' AND end_time = '')
    OR (
      lower(trim(day_of_week)) IN ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')
      AND start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      AND end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      AND left(start_time,5) <> left(end_time,5)
    )
  )
) NOT VALID;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.headcounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.gwcc_attendance_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NULLIF(trim(NEW.member_id),'') IS NOT NULL AND NEW.visitor_id IS NULL THEN
    NEW.person_type := 'member';
  ELSIF NULLIF(trim(NEW.visitor_id),'') IS NOT NULL AND NEW.member_id IS NULL THEN
    NEW.person_type := 'visitor';
  ELSE
    RAISE EXCEPTION 'Attendance requires exactly one member or visitor' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gwcc_attendance_identity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS gwcc_attendance_identity_trigger ON public.attendance;
CREATE TRIGGER gwcc_attendance_identity_trigger BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.gwcc_attendance_identity();

-- This metadata correction derives only from the retained IDs; dates and people are not reassigned.
UPDATE public.attendance SET person_type = CASE WHEN member_id IS NOT NULL THEN 'member' ELSE 'visitor' END
WHERE ((member_id IS NOT NULL AND visitor_id IS NULL) OR (visitor_id IS NOT NULL AND member_id IS NULL))
  AND person_type IS DISTINCT FROM CASE WHEN member_id IS NOT NULL THEN 'member' ELSE 'visitor' END;

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS gwcc_attendance_valid;
ALTER TABLE public.attendance ADD CONSTRAINT gwcc_attendance_valid CHECK (
  service_id IS NOT NULL AND length(trim(service_id)) > 0
  AND date IS NOT NULL AND date <= CURRENT_DATE
  AND status IS NOT NULL AND status IN ('present','absent','excused')
  AND person_type IS NOT NULL
  AND ((member_id IS NOT NULL AND length(trim(member_id)) > 0 AND visitor_id IS NULL AND person_type='member')
    OR (visitor_id IS NOT NULL AND length(trim(visitor_id)) > 0 AND member_id IS NULL AND person_type='visitor'))
) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS gwcc_attendance_member_session_unique
  ON public.attendance(service_id,date,member_id) WHERE member_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS gwcc_attendance_visitor_session_unique
  ON public.attendance(service_id,date,visitor_id) WHERE visitor_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS gwcc_headcounts_session_unique ON public.headcounts(service_id,date);

ALTER TABLE public.headcounts DROP CONSTRAINT IF EXISTS gwcc_headcounts_valid;
ALTER TABLE public.headcounts ADD CONSTRAINT gwcc_headcounts_valid CHECK (
  service_id IS NOT NULL AND length(trim(service_id)) > 0
  AND date IS NOT NULL AND date <= CURRENT_DATE
  AND COALESCE(men,-1) BETWEEN 0 AND 1000000 AND COALESCE(women,-1) BETWEEN 0 AND 1000000
  AND COALESCE(youth,-1) BETWEEN 0 AND 1000000 AND COALESCE(children,-1) BETWEEN 0 AND 1000000
  AND COALESCE(visitors,-1) BETWEEN 0 AND 1000000 AND COALESCE(ushers_protocol,-1) BETWEEN 0 AND 1000000
  AND COALESCE(online_viewers,-1) BETWEEN 0 AND 1000000
  AND total_auditorium IS NOT NULL AND total_auditorium=men+women+youth+children+visitors+ushers_protocol
) NOT VALID;

COMMIT;
