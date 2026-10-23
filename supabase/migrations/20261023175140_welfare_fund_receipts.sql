-- Unnamed welfare receipts stay outside member dues and treasury account balances.
-- The existing document store is already RLS protected and included in backups.
CREATE UNIQUE INDEX IF NOT EXISTS gwcc_welfare_fund_reference
  ON public.gwcc_documents (lower(btrim(data->>'reference_no')))
  WHERE namespace='welfare_fund_receipts';

CREATE OR REPLACE FUNCTION gwcc_private.prepare_welfare_fund_receipt(p_doc jsonb,p_old jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  r text:=public.current_user_role(); n numeric; source_name text; receipt_date date;
  reference text:=btrim(p_doc->>'reference_no'); note text:=btrim(p_doc->>'notes');
  actor_name text; ignored text[]:=ARRAY['created_at','updated_at','recorded_by','recorded_by_id','voided_at','voided_by','voided_by_id','void_reason','status','_sync_status','_expected_updated_at'];
BEGIN
  IF auth.uid() IS NULL OR r NOT IN ('super_admin','senior_pastor','finance_officer') THEN
    RAISE EXCEPTION 'Finance staff access is required to add welfare funds' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_doc) field WHERE field<>ALL(ARRAY[
    'id','amount','date','source','reference_no','notes','status','created_at','updated_at','recorded_by','recorded_by_id',
    'voided_at','voided_by','voided_by_id','void_reason','_sync_status','_expected_updated_at'])) THEN
    RAISE EXCEPTION 'Unnamed fund receipts cannot contain member or treasury account fields';
  END IF;
  IF p_old IS NOT NULL THEN
    IF (p_doc-ignored) IS DISTINCT FROM (p_old-ignored) THEN
      RAISE EXCEPTION 'Saved fund receipts cannot be edited. Void the receipt with a reason and record a replacement';
    END IF;
    IF p_doc->>'status' IS NOT DISTINCT FROM p_old->>'status' AND p_doc->>'void_reason' IS NOT DISTINCT FROM p_old->>'void_reason' THEN RETURN p_old;END IF;
    IF p_old->>'status'<>'active' OR p_doc->>'status' IS DISTINCT FROM 'voided' THEN RAISE EXCEPTION 'A voided fund receipt cannot be reopened or changed';END IF;
    IF r NOT IN ('super_admin','senior_pastor') THEN RAISE EXCEPTION 'A senior pastor or super administrator must void welfare fund receipts' USING ERRCODE='42501';END IF;
    IF jsonb_typeof(p_doc->'void_reason') IS DISTINCT FROM 'string' OR length(btrim(p_doc->>'void_reason')) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Enter a void reason in 5-1000 characters';END IF;
    SELECT concat_ws(' ',first_name,last_name) INTO actor_name FROM public.profiles WHERE id=auth.uid()::text;
    RETURN p_old||jsonb_build_object('status','voided','void_reason',btrim(p_doc->>'void_reason'),'voided_by_id',auth.uid()::text,'voided_by',actor_name,'voided_at',clock_timestamp());
  END IF;
  IF p_doc->>'status' IS DISTINCT FROM 'active' OR p_doc ?| ARRAY['voided_at','voided_by','voided_by_id','void_reason'] THEN RAISE EXCEPTION 'New fund receipts must be active';END IF;
  IF jsonb_typeof(p_doc->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter a finite positive amount with at most two decimals';END IF;
  n:=(p_doc->>'amount')::numeric;
  IF n<=0 OR n>1000000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'Enter an amount above zero, up to GHc1000000000, with at most two decimals';END IF;
  IF coalesce(p_doc->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Enter a valid receipt date up to today';END IF;
  receipt_date:=(p_doc->>'date')::date;
  IF receipt_date>(now() AT TIME ZONE 'Africa/Accra')::date THEN RAISE EXCEPTION 'Enter a valid receipt date up to today';END IF;
  source_name:=p_doc->>'source';
  IF source_name IS NULL OR source_name NOT IN ('opening_balance','unallocated_dues','donation','other') THEN RAISE EXCEPTION 'Choose the source of these welfare funds';END IF;
  IF jsonb_typeof(p_doc->'reference_no') IS DISTINCT FROM 'string' OR coalesce(length(reference),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Enter a reference of up to 100 characters';END IF;
  IF jsonb_typeof(p_doc->'notes') IS DISTINCT FROM 'string' OR coalesce(length(note),0) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Explain the source of the money in 5-1000 characters';END IF;
  IF EXISTS(SELECT 1 FROM public.gwcc_documents WHERE namespace='welfare_fund_receipts' AND lower(btrim(data->>'reference_no'))=lower(reference)) THEN
    RAISE EXCEPTION 'This reference already has a receipt. Check Fund Receipts before adding it again';
  END IF;
  SELECT concat_ws(' ',first_name,last_name) INTO actor_name FROM public.profiles WHERE id=auth.uid()::text;
  RETURN jsonb_build_object('id',p_doc->>'id','amount',n,'date',receipt_date::text,'source',source_name,'reference_no',reference,'notes',note,
    'status','active','recorded_by_id',auth.uid()::text,'recorded_by',actor_name,'created_at',clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.prepare_welfare_fund_receipt(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

-- Extend the checked write API, preserving existing finance, approval and retry guards.
DO $migration$
DECLARE definition text; previous text;
BEGIN
  SELECT pg_get_functiondef('public.gwcc_can_read(text)'::regprocedure) INTO definition;
  previous:=definition;
  definition:=replace(definition,'  IF p_table=''cell_meeting_reports''',E'  IF p_table=''welfare_fund_receipts'' THEN RETURN r IN (''administrator'',''finance_officer'',''pastor'');END IF;\n  IF p_table=''cell_meeting_reports''');
  IF definition=previous THEN RAISE EXCEPTION 'Fund receipt read permission patch did not match';END IF;EXECUTE definition;
  SELECT pg_get_functiondef('public.gwcc_can_write(text)'::regprocedure) INTO definition;
  previous:=definition;
  definition:=replace(definition,'  IF p_table=''cell_meeting_reports''',E'  IF p_table=''welfare_fund_receipts'' THEN RETURN r=''finance_officer'';END IF;\n  IF p_table=''cell_meeting_reports''');
  IF definition=previous THEN RAISE EXCEPTION 'Fund receipt write permission patch did not match';END IF;EXECUTE definition;
  SELECT pg_get_functiondef('public.gwcc_apply_mutations(uuid,jsonb)'::regprocedure) INTO definition;
  previous:=definition;
  -- Both the table allowlist and the document namespace list have this checked suffix.
  definition:=replace(definition,'''intercessory_slots'',''cell_meeting_reports'')','''intercessory_slots'',''cell_meeting_reports'',''welfare_fund_receipts'')');
  definition:=replace(definition,'    IF op=''delete'' THEN',E'    IF t=''welfare_fund_receipts'' AND op=''delete'' THEN RAISE EXCEPTION ''Financial records must be voided, not deleted'';END IF;\n    IF op=''delete'' THEN');
  definition:=replace(definition,'    IF t=''members'' THEN',E'    IF t=''welfare_fund_receipts'' THEN\n      IF old_doc IS NOT NULL AND expected IS NULL THEN RAISE EXCEPTION ''A receipt version is required. Refresh before retrying'';END IF;\n      doc:=gwcc_private.prepare_welfare_fund_receipt(doc,old_doc);\n    END IF;\n    IF t=''members'' THEN');
  IF definition=previous OR position('prepare_welfare_fund_receipt(doc,old_doc)' IN definition)=0 OR position('''welfare_fund_receipts'')' IN definition)=0 THEN RAISE EXCEPTION 'Fund receipt mutation patch did not match';END IF;
  EXECUTE definition;
END;
$migration$;
