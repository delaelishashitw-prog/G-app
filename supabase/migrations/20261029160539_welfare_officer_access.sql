-- Welfare work is a separate, reviewed staff role. It never inherits treasury,
-- pastoral case, staff administration or general member editing permissions.
CREATE OR REPLACE FUNCTION gwcc_private.prepare_welfare_officer_mutation(
  p_table text,p_operation text,p_document jsonb,p_previous jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE next_doc jsonb:=coalesce(p_previous,'{}'::jsonb)||p_document; key text; actor_name text;
BEGIN
  IF public.current_user_role()<>'welfare_officer' THEN RETURN p_document;END IF;
  IF p_operation='delete' THEN
    RAISE EXCEPTION 'Welfare officers preserve records; close appeals or decline claims instead of deleting history' USING ERRCODE='42501';
  END IF;
  SELECT btrim(concat_ws(' ',first_name,last_name)) INTO actor_name FROM public.profiles WHERE id=auth.uid()::text;
  IF p_table='welfare_contributions' THEN
    IF coalesce(next_doc->>'amount','') IN ('','NaN','Infinity','-Infinity')
      OR (next_doc->>'amount')::numeric<=0 OR (next_doc->>'amount')::numeric>1000000000
      OR round((next_doc->>'amount')::numeric,2)<>(next_doc->>'amount')::numeric THEN
      RAISE EXCEPTION 'Enter a finite positive welfare amount in cedis and pesewas';END IF;
    IF coalesce(next_doc->>'month','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Choose a valid dues month';END IF;
    IF NOT EXISTS(SELECT 1 FROM public.members m WHERE m.id=next_doc->>'member_id' AND m.is_archived IS NOT TRUE AND m.status NOT IN ('deceased','transferred')) THEN
      RAISE EXCEPTION 'Choose an active, available member for these dues';END IF;
    RETURN p_document||jsonb_build_object('recorded_by',coalesce(p_previous->>'recorded_by',actor_name),
      'created_at',coalesce(p_previous->'created_at',to_jsonb(now())));
  ELSIF p_table='welfare_claims' THEN
    FOREACH key IN ARRAY ARRAY['amount_requested','amount_approved'] LOOP
      IF coalesce(next_doc->>key,'0') IN ('NaN','Infinity','-Infinity') OR coalesce((next_doc->>key)::numeric,0)<0
        OR coalesce((next_doc->>key)::numeric,0)>1000000000 OR round(coalesce((next_doc->>key)::numeric,0),2)<>coalesce((next_doc->>key)::numeric,0) THEN
        RAISE EXCEPTION 'Enter a finite relief amount in cedis and pesewas';END IF;
    END LOOP;
    IF coalesce((next_doc->>'amount_disbursed')::numeric,0)<>coalesce((p_previous->>'amount_disbursed')::numeric,0)
      OR coalesce((next_doc->>'legacy_disbursed_amount')::numeric,0)<>coalesce((p_previous->>'legacy_disbursed_amount')::numeric,0)
      OR coalesce(nullif(next_doc->'disbursements','null'::jsonb),'[]'::jsonb)<>coalesce(nullif(p_previous->'disbursements','null'::jsonb),'[]'::jsonb) THEN
      RAISE EXCEPTION 'Only the finance payment workflow may change relief payout history' USING ERRCODE='42501';END IF;
    FOREACH key IN ARRAY ARRAY['disbursement_date','disbursement_method','disbursement_channel','disbursement_voucher_no','finance_account_id','finance_account_name','finance_transaction_id'] LOOP
      IF nullif(next_doc->>key,'') IS DISTINCT FROM nullif(p_previous->>key,'') THEN
        RAISE EXCEPTION 'Only finance staff may change relief payment details' USING ERRCODE='42501';END IF;
    END LOOP;
    IF (next_doc->>'status'='disbursed' AND p_previous->>'status' IS DISTINCT FROM 'disbursed')
      OR (p_previous->>'status'='disbursed' AND next_doc->>'status' IS DISTINCT FROM 'disbursed') THEN
      RAISE EXCEPTION 'Relief payment status is maintained by the finance payment workflow' USING ERRCODE='42501';END IF;
    IF coalesce((p_previous->>'amount_disbursed')::numeric,0)>0 AND
      (next_doc->>'member_id' IS DISTINCT FROM p_previous->>'member_id' OR next_doc->>'beneficiary_type' IS DISTINCT FROM p_previous->>'beneficiary_type') THEN
      RAISE EXCEPTION 'The beneficiary of a paid claim cannot be changed';END IF;
    IF next_doc->>'status' NOT IN ('pending','under_review','approved','declined','disbursed') THEN RAISE EXCEPTION 'Choose a valid relief review status';END IF;
    IF next_doc->>'status'='approved' AND coalesce((next_doc->>'amount_approved')::numeric,0)<=0 THEN RAISE EXCEPTION 'Enter the committee-approved relief amount';END IF;
    IF p_document ? 'reviewed_by' OR p_document ? 'date_reviewed' THEN
      RETURN p_document||jsonb_build_object('reviewed_by',actor_name,'date_reviewed',current_date);
    END IF;
  ELSIF p_table='welfare_event_contributions' THEN
    IF coalesce((next_doc->>'finance_linked')::boolean,false) OR nullif(next_doc->>'finance_transaction_id','') IS NOT NULL
      OR coalesce((p_previous->>'finance_linked')::boolean,false) OR nullif(p_previous->>'finance_transaction_id','') IS NOT NULL
      OR nullif(next_doc->>'finance_account_id','') IS NOT NULL THEN
      RAISE EXCEPTION 'Finance staff must post or correct contributions linked to the treasury' USING ERRCODE='42501';END IF;
    RETURN p_document||jsonb_build_object('recorded_by',coalesce(p_previous->>'recorded_by',actor_name),
      'created_at',coalesce(p_previous->'created_at',to_jsonb(now())));
  END IF;
  RETURN p_document;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.prepare_welfare_officer_mutation(text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE definition text; previous text; target regprocedure;
BEGIN
  target:='public.gwcc_can_read(text)'::regprocedure;
  SELECT pg_get_functiondef(target) INTO definition;previous:=definition;
  IF position('IF r=''welfare_officer''' IN definition)=0 THEN
    definition:=replace(definition,E'BEGIN\n',E'BEGIN\n  IF r=''welfare_officer'' THEN RETURN p_table IN (''members'',''welfare_contributions'',''welfare_claims'',''welfare_events'',''welfare_event_contributions'',''welfare_fund_receipts'');END IF;\n');
    IF definition=previous THEN RAISE EXCEPTION 'Welfare read permission patch did not match';END IF;EXECUTE definition;
  END IF;
  target:='public.gwcc_can_write(text)'::regprocedure;
  SELECT pg_get_functiondef(target) INTO definition;previous:=definition;
  IF position('IF r=''welfare_officer''' IN definition)=0 THEN
    definition:=replace(definition,E'BEGIN\n',E'BEGIN\n  IF r=''welfare_officer'' THEN RETURN p_table IN (''welfare_contributions'',''welfare_claims'',''welfare_events'',''welfare_event_contributions'');END IF;\n');
    IF definition=previous THEN RAISE EXCEPTION 'Welfare write permission patch did not match';END IF;EXECUTE definition;
  END IF;
  target:='public.gwcc_manage_profile(text,jsonb)'::regprocedure;
  SELECT pg_get_functiondef(target) INTO definition;previous:=definition;
  IF position('''welfare_officer''' IN definition)=0 THEN
    definition:=replace(definition,'''data_entry'',''member''','''data_entry'',''welfare_officer'',''member''');
    IF definition=previous THEN RAISE EXCEPTION 'Welfare profile role patch did not match';END IF;EXECUTE definition;
  END IF;
  target:='gwcc_private.security_state()'::regprocedure;
  SELECT pg_get_functiondef(target) INTO definition;previous:=definition;
  IF position('''welfare_officer''' IN definition)=0 THEN
    definition:=replace(definition,'''administrator'',''finance_officer''','''administrator'',''finance_officer'',''welfare_officer''');
    IF definition=previous THEN RAISE EXCEPTION 'Welfare two-factor policy patch did not match';END IF;EXECUTE definition;
  END IF;
  target:='public.gwcc_apply_mutations(uuid,jsonb)'::regprocedure;
  SELECT pg_get_functiondef(target) INTO definition;previous:=definition;
  IF position('prepare_welfare_officer_mutation' IN definition)=0 THEN
    definition:=replace(definition,'    IF op=''delete'' THEN',E'    doc:=gwcc_private.prepare_welfare_officer_mutation(t,op,doc,old_doc);\n    IF op=''delete'' THEN');
    IF definition=previous THEN RAISE EXCEPTION 'Welfare mutation guard patch did not match';END IF;EXECUTE definition;
  END IF;
END;
$migration$;
NOTIFY pgrst,'reload schema';
