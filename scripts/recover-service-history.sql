-- Run only as a reviewed database maintenance action, after taking a private snapshot.
-- Restore original referenced IDs, not guessed mappings to similarly named current services.
BEGIN;
WITH references_to_restore AS (
  SELECT service_id, service_name FROM public.attendance
  UNION ALL SELECT service_id, service_name FROM public.headcounts
  UNION ALL SELECT service_id, service_name FROM public.roster_assignments
), unambiguous AS (
  SELECT service_id, min(trim(service_name)) AS name
  FROM references_to_restore r
  WHERE NULLIF(trim(service_id),'') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id=r.service_id)
  GROUP BY service_id
  HAVING count(DISTINCT lower(trim(service_name)))=1
    AND bool_and(NULLIF(trim(service_name),'') IS NOT NULL)
), recovered AS (
  INSERT INTO public.services(id,name,type,day_of_week,start_time,end_time,venue,expected_attendance,is_active,description)
  SELECT service_id,name,'special','','','','',NULL,false,
    'Recovered historical service reference. Original schedule and mapping to a current service are unverified. Original record IDs and dates are preserved.'
  FROM unambiguous
  ON CONFLICT(id) DO NOTHING
  RETURNING id
)
INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details)
SELECT gen_random_uuid()::text,auth.uid(),'Reviewed database maintenance','system','RESTORE_SERVICE_REFERENCES',
  'Services','service-history-recovery',
  'Restored ' || count(*) || ' archived historical service reference(s) under their original IDs. Attendance, headcounts, rosters and financial records were not reassigned.'
FROM recovered HAVING count(*)>0;
COMMIT;
