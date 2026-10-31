-- Welfare appeal policy only. Existing appeal levies, receipts and monthly dues are preserved.
ALTER TABLE public.welfare_events ALTER COLUMN minimum_contribution SET DEFAULT 10.00;
ALTER TABLE public.welfare_events DROP CONSTRAINT IF EXISTS welfare_events_minimum_contribution_check;
ALTER TABLE public.welfare_events ADD CONSTRAINT welfare_events_minimum_contribution_check CHECK (minimum_contribution >= 10.00);
ALTER TABLE public.welfare_event_contributions DROP CONSTRAINT IF EXISTS welfare_event_contributions_amount_check;
ALTER TABLE public.welfare_event_contributions ADD CONSTRAINT welfare_event_contributions_amount_check CHECK (amount >= 10.00);

-- Retain the complete current mutation function, including authorization, idempotency,
-- privacy and version guards. Replace only this policy's amount check and error text.
DO $migration$
DECLARE definition text; old_guard text:='COALESCE((SELECT GREATEST(20,minimum_contribution) FROM public.welfare_events WHERE id=doc->>''event_id''),20)';
 new_guard text:='COALESCE((SELECT GREATEST(10,minimum_contribution) FROM public.welfare_events WHERE id=doc->>''event_id''),10)';
BEGIN
 SELECT pg_get_functiondef('public.gwcc_apply_mutations(uuid,jsonb)'::regprocedure) INTO definition;
 IF position(new_guard IN definition)=0 THEN
  IF length(definition)-length(replace(definition,old_guard,''))<>length(old_guard) THEN
   RAISE EXCEPTION 'The welfare appeal policy guard did not match exactly; review the current mutation function before changing it';
  END IF;
  definition:=replace(definition,old_guard,new_guard);
 END IF;
 definition:=replace(definition,'''Minimum welfare contribution is GHc20''','''Contribution is below the appeal minimum (at least GHc10)''');
 EXECUTE definition;
END $migration$;
NOTIFY pgrst,'reload schema';
