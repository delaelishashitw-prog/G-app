-- Preserve historical money; receipt-backed totals begin with the next checked write.
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS payments jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS legacy_paid_amount numeric;
ALTER TABLE public.pledge_campaigns ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS pledge_id text;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS pledge_campaign_name text;
CREATE INDEX IF NOT EXISTS giving_pledge_id_idx ON public.giving(pledge_id) WHERE pledge_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_pledge_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.amount_paid<0 OR NEW.amount_paid>NEW.amount_pledged THEN RAISE EXCEPTION 'Pledge payments cannot exceed the commitment';END IF;
  NEW.balance:=NEW.amount_pledged-NEW.amount_paid;
  NEW.status:=CASE WHEN NEW.balance=0 THEN 'completed' WHEN NEW.status='cancelled' THEN 'cancelled'
    WHEN NEW.amount_paid>0 THEN 'partially_paid' ELSE 'active' END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION gwcc_private.prepare_pledge_campaign(p_doc jsonb,p_old jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d jsonb:=coalesce(p_old,'{}')||p_doc;n numeric;
BEGIN
  IF coalesce(length(btrim(d->>'name')),0) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Enter a campaign name of up to 300 characters';END IF;
  IF jsonb_typeof(d->'target_amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter a positive campaign target with up to two decimals';END IF;
  n:=(d->>'target_amount')::numeric;
  IF n<=0 OR n>1000000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'Enter a positive campaign target with up to two decimals';END IF;
  IF coalesce(d->>'start_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(d->>'end_date','') !~ '^\d{4}-\d{2}-\d{2}$'
    OR (d->>'end_date')::date<(d->>'start_date')::date THEN RAISE EXCEPTION 'Campaign end date must be on or after its start';END IF;
  IF jsonb_typeof(d->'is_active') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Choose the campaign active status';END IF;
  RETURN d||jsonb_build_object('name',btrim(d->>'name'),'created_at',coalesce(p_old->'created_at',to_jsonb(clock_timestamp())));
END;
$$;

CREATE OR REPLACE FUNCTION gwcc_private.prepare_pledge(p_doc jsonb,p_old jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d jsonb:=coalesce(p_old,'{}')||p_doc; receipt jsonb; prior jsonb; canonical jsonb:='[]'; ids text[]:='{}'; giving_ids text[]:='{}';
  base numeric; paid numeric; pledged numeric; n numeric; m public.members; campaign public.pledge_campaigns; actor text;
  ignored text[]:=ARRAY['status','void_reason','voided_at','voided_by','voided_by_id'];
BEGIN
  SELECT concat_ws(' ',first_name,last_name) INTO actor FROM public.profiles WHERE id=auth.uid()::text;
  IF jsonb_typeof(d->'amount_pledged') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter a positive pledge amount with up to two decimals';END IF;
  pledged:=(d->>'amount_pledged')::numeric;
  IF pledged<=0 OR pledged>1000000000 OR pledged<>round(pledged,2) THEN RAISE EXCEPTION 'Enter a positive pledge amount with up to two decimals';END IF;
  IF p_doc ? 'amount_paid' AND (p_doc->>'amount_paid')::numeric IS DISTINCT FROM coalesce((p_old->>'amount_paid')::numeric,0) THEN RAISE EXCEPTION 'Use payment receipts to change the amount collected';END IF;
  IF coalesce(d->>'start_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(d->>'due_date','') !~ '^\d{4}-\d{2}-\d{2}$'
    OR (d->>'due_date')::date<(d->>'start_date')::date THEN RAISE EXCEPTION 'Pledge due date must be on or after its start';END IF;
  IF coalesce(d->>'status','active') NOT IN ('active','partially_paid','completed','overdue','cancelled') THEN RAISE EXCEPTION 'Choose a valid pledge status';END IF;
  base:=CASE WHEN p_old IS NULL THEN 0 ELSE coalesce((p_old->>'legacy_paid_amount')::numeric,(p_old->>'amount_paid')::numeric,0) END;paid:=base;
  IF p_old IS NOT NULL AND (coalesce((p_old->>'amount_paid')::numeric,0)>0 OR jsonb_array_length(coalesce(p_old->'payments','[]'))>0)
    AND (d->>'member_id' IS DISTINCT FROM p_old->>'member_id' OR d->>'campaign_id' IS DISTINCT FROM p_old->>'campaign_id') THEN RAISE EXCEPTION 'A pledge with payment history cannot be assigned to another member or campaign';END IF;
  IF p_old IS NULL OR d->>'member_id' IS DISTINCT FROM p_old->>'member_id' THEN
    SELECT * INTO m FROM public.members WHERE id=d->>'member_id';
    IF NOT FOUND OR coalesce(m.is_archived,false) OR coalesce(m.status,'active') IN ('deceased','transferred') THEN RAISE EXCEPTION 'Select an active saved member';END IF;
    d:=d||jsonb_build_object('member_id',m.id,'member_name',concat_ws(' ',m.first_name,m.last_name),'member_phone',m.phone);
  ELSE d:=d||jsonb_build_object('member_name',p_old->'member_name','member_phone',p_old->'member_phone');END IF;
  IF p_old IS NULL OR d->>'campaign_id' IS DISTINCT FROM p_old->>'campaign_id' THEN
    SELECT * INTO campaign FROM public.pledge_campaigns WHERE id=d->>'campaign_id';
    IF NOT FOUND OR NOT campaign.is_active THEN RAISE EXCEPTION 'Select an active saved campaign';END IF;
    d:=d||jsonb_build_object('campaign_name',campaign.name);
  ELSE d:=d||jsonb_build_object('campaign_name',p_old->'campaign_name');END IF;
  IF jsonb_typeof(coalesce(d->'payments','[]')) IS DISTINCT FROM 'array' OR jsonb_array_length(coalesce(d->'payments','[]'))>10000 THEN RAISE EXCEPTION 'Invalid pledge payment history';END IF;
  FOR receipt IN SELECT value FROM jsonb_array_elements(coalesce(d->'payments','[]')) LOOP
    IF jsonb_typeof(receipt)<>'object' OR coalesce(receipt->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR receipt->>'id'=ANY(ids) THEN RAISE EXCEPTION 'Each pledge payment needs a unique receipt ID';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(receipt) field WHERE field<>ALL(ARRAY['id','amount','date','payment_method','payment_channel','transaction_reference','notes','sync_with_giving','giving_id','status','receipt_no','recorded_at','recorded_by_id','recorded_by','void_reason','voided_at','voided_by_id','voided_by'])) THEN RAISE EXCEPTION 'Unknown payment receipt field';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(receipt) e WHERE e.key IN ('payment_channel','transaction_reference','notes') AND jsonb_typeof(e.value)<>'string') THEN RAISE EXCEPTION 'Payment reference, channel and notes must be text';END IF;
    ids:=array_append(ids,receipt->>'id');
    SELECT value INTO prior FROM jsonb_array_elements(coalesce(p_old->'payments','[]')) WHERE value->>'id'=receipt->>'id';
    IF prior IS NOT NULL THEN
      IF (receipt-ignored) IS DISTINCT FROM (prior-ignored) THEN RAISE EXCEPTION 'Saved payment receipts cannot be rewritten';END IF;
      IF receipt->>'status' IS DISTINCT FROM prior->>'status' THEN
        IF prior->>'status'<>'completed' OR receipt->>'status' IS DISTINCT FROM 'voided' THEN RAISE EXCEPTION 'A voided payment cannot be reopened';END IF;
        IF coalesce(length(btrim(receipt->>'void_reason')),0) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Enter a void reason in 5-1000 characters';END IF;
        receipt:=prior||jsonb_build_object('status','voided','void_reason',btrim(receipt->>'void_reason'),'voided_at',clock_timestamp(),'voided_by_id',auth.uid()::text,'voided_by',actor);
        INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details) VALUES(gen_random_uuid()::text,auth.uid(),actor,public.current_user_role(),'VOID_PLEDGE_PAYMENT','Pledges',d->>'id',receipt::text);
      ELSE receipt:=prior;END IF;
    ELSE
      IF p_old->>'status'='cancelled' OR d->>'status'='cancelled' THEN RAISE EXCEPTION 'Payments are closed for a cancelled pledge';END IF;
      IF EXISTS(SELECT 1 FROM public.pledges p CROSS JOIN LATERAL jsonb_array_elements(p.payments) r WHERE p.id<>d->>'id' AND r->>'id'=receipt->>'id') THEN RAISE EXCEPTION 'Payment receipt ID is already in use';END IF;
      IF receipt->>'status' IS DISTINCT FROM 'completed' OR receipt ?| ARRAY['void_reason','voided_at','voided_by','voided_by_id'] THEN RAISE EXCEPTION 'New payment receipts must be completed';END IF;
      IF jsonb_typeof(receipt->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter a positive payment with up to two decimals';END IF;
      n:=(receipt->>'amount')::numeric;
      IF n<=0 OR n>1000000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'Enter a positive payment with up to two decimals';END IF;
      IF coalesce(receipt->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' OR (receipt->>'date')::date>(clock_timestamp() AT TIME ZONE 'Africa/Accra')::date OR (receipt->>'date')::date<(d->>'start_date')::date THEN RAISE EXCEPTION 'Payment date must be between the pledge start and today';END IF;
      IF coalesce(receipt->>'payment_method','') NOT IN ('cash','mobile_money','bank_transfer','card','cheque','other') THEN RAISE EXCEPTION 'Choose a valid payment method';END IF;
      IF jsonb_typeof(receipt->'sync_with_giving') IS DISTINCT FROM 'boolean' OR ((receipt->>'sync_with_giving')::boolean IS DISTINCT FROM (nullif(receipt->>'giving_id','') IS NOT NULL)) THEN RAISE EXCEPTION 'Choose whether this payment is included in Giving';END IF;
      IF coalesce(length(receipt->>'notes'),0)>1000 OR coalesce(length(receipt->>'transaction_reference'),0)>200 OR coalesce(length(receipt->>'payment_channel'),0)>200 OR coalesce(length(receipt->>'giving_id'),0)>100 THEN RAISE EXCEPTION 'Payment reference, channel or notes are too long';END IF;
      receipt:=(receipt-ARRAY['recorded_at','recorded_by','recorded_by_id','receipt_no'])||jsonb_build_object('recorded_at',clock_timestamp(),'recorded_by_id',auth.uid()::text,'recorded_by',actor,'receipt_no','PLG-'||(receipt->>'id'));
      INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details) VALUES(gen_random_uuid()::text,auth.uid(),actor,public.current_user_role(),'PLEDGE_PAYMENT','Pledges',d->>'id',receipt::text);
    END IF;
    IF receipt->>'giving_id' IS NOT NULL THEN
      IF receipt->>'giving_id'=ANY(giving_ids) OR EXISTS(SELECT 1 FROM public.pledges p CROSS JOIN LATERAL jsonb_array_elements(p.payments) r WHERE p.id<>d->>'id' AND r->>'giving_id'=receipt->>'giving_id') THEN RAISE EXCEPTION 'A Giving receipt cannot pay more than one pledge installment';END IF;
      giving_ids:=array_append(giving_ids,receipt->>'giving_id');
    END IF;
    IF receipt->>'status'='completed' THEN paid:=paid+(receipt->>'amount')::numeric;END IF;
    canonical:=canonical||jsonb_build_array(receipt);
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(p_old->'payments','[]')) r WHERE NOT (r->>'id'=ANY(ids))) THEN RAISE EXCEPTION 'Payment history cannot be removed. Void an incorrect receipt with a reason';END IF;
  IF paid>pledged THEN RAISE EXCEPTION 'Payment exceeds the remaining pledge balance';END IF;
  RETURN d||jsonb_build_object('payments',canonical,'legacy_paid_amount',base,'amount_paid',paid,'balance',pledged-paid,'created_at',coalesce(p_old->'created_at',to_jsonb(clock_timestamp())));
END;
$$;

CREATE OR REPLACE FUNCTION gwcc_private.prepare_pledge_giving(p_doc jsonb,p_old jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d jsonb:=coalesce(p_old,'{}')||p_doc;p public.pledges;
BEGIN
  IF p_old IS NOT NULL AND d->>'pledge_id' IS DISTINCT FROM p_old->>'pledge_id' THEN RAISE EXCEPTION 'A saved Giving receipt cannot be reassigned to a pledge';END IF;
  IF nullif(d->>'pledge_id','') IS NULL THEN RETURN d||jsonb_build_object('pledge_id',NULL,'pledge_campaign_name',NULL);END IF;
  IF p_old IS NOT NULL AND (d-ARRAY['status','void_reason','voided_by','updated_at','_expected_updated_at','_sync_status']) IS DISTINCT FROM (p_old-ARRAY['status','void_reason','voided_by','updated_at','_expected_updated_at','_sync_status']) THEN RAISE EXCEPTION 'Correct linked payments through the pledge payment history';END IF;
  IF p_old IS NOT NULL THEN
    IF d->>'status' IS NOT DISTINCT FROM p_old->>'status' THEN RETURN p_old;END IF;
    IF p_old->>'status'<>'completed' OR d->>'status' IS DISTINCT FROM 'voided' THEN RAISE EXCEPTION 'A voided Giving receipt cannot be reopened';END IF;
    IF coalesce(length(btrim(d->>'void_reason')),0) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Enter a void reason in 5-1000 characters';END IF;
    d:=d||jsonb_build_object('void_reason',btrim(d->>'void_reason'),'voided_by',auth.uid()::text);
  END IF;
  SELECT * INTO p FROM public.pledges WHERE id=d->>'pledge_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'The linked pledge was not found';END IF;
  IF p_old IS NULL THEN d:=d||jsonb_build_object('member_id',p.member_id,'member_name',p.member_name,'donor_name',p.member_name,'pledge_campaign_name',p.campaign_name,'category','Building Fund','recorded_by',auth.uid()::text,'created_at',clock_timestamp());END IF;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION gwcc_private.check_pledge_links(p_changes jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb;p public.pledges;r jsonb;g public.giving;
BEGIN
  FOR c IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    IF c->>'table'='pledges' AND c->>'operation'='upsert' THEN
      SELECT * INTO p FROM public.pledges WHERE id=c->>'id';
      FOR r IN SELECT value FROM jsonb_array_elements(p.payments) WHERE value->>'giving_id' IS NOT NULL LOOP
        SELECT * INTO g FROM public.giving WHERE id=r->>'giving_id';
        IF NOT FOUND OR g.pledge_id IS DISTINCT FROM p.id OR g.member_id IS DISTINCT FROM p.member_id OR g.amount IS DISTINCT FROM (r->>'amount')::numeric OR g.currency IS DISTINCT FROM 'GHS' OR g.date IS DISTINCT FROM (r->>'date')::date OR g.payment_method::text IS DISTINCT FROM r->>'payment_method' OR coalesce(g.payment_channel,'') IS DISTINCT FROM coalesce(r->>'payment_channel','') OR coalesce(g.reference_number,'') IS DISTINCT FROM coalesce(r->>'transaction_reference','') OR g.status IS DISTINCT FROM r->>'status' OR (r->>'status'='voided' AND coalesce(g.void_reason,'') IS DISTINCT FROM coalesce(r->>'void_reason','')) THEN RAISE EXCEPTION 'Pledge payment and Giving receipt must be saved together with matching details';END IF;
      END LOOP;
    ELSIF c->>'table'='giving' AND c->>'operation'='upsert' THEN
      SELECT * INTO g FROM public.giving WHERE id=c->>'id';
      IF g.pledge_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.pledges parent CROSS JOIN LATERAL jsonb_array_elements(parent.payments) entry WHERE parent.id=g.pledge_id AND entry->>'giving_id'=g.id AND (entry->>'amount')::numeric=g.amount AND entry->>'status'=g.status) THEN RAISE EXCEPTION 'Correct or void the linked pledge payment together with its Giving receipt';END IF;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.prepare_pledge_campaign(jsonb,jsonb),gwcc_private.prepare_pledge(jsonb,jsonb),gwcc_private.prepare_pledge_giving(jsonb,jsonb),gwcc_private.check_pledge_links(jsonb) FROM PUBLIC,anon,authenticated;

DO $migration$
DECLARE definition text;previous text;
BEGIN
  SELECT pg_get_functiondef('public.gwcc_apply_mutations(uuid,jsonb)'::regprocedure) INTO definition;previous:=definition;
  definition:=replace(definition,'    IF op=''delete'' THEN',$patch$
    IF t IN ('pledges','pledge_campaigns') THEN
      IF old_doc IS NOT NULL AND (expected IS NULL OR real_version IS NULL) THEN RAISE EXCEPTION 'A pledge or campaign version is required. Refresh before retrying; older pending changes need review' USING ERRCODE='40001';END IF;
      IF old_doc IS NULL AND expected IS NOT NULL THEN RAISE EXCEPTION 'This pledge or campaign was removed. Refresh before retrying' USING ERRCODE='40001';END IF;
    END IF;
    IF t='giving' AND old_doc->>'pledge_id' IS NOT NULL AND expected IS NULL THEN RAISE EXCEPTION 'A linked receipt version is required';END IF;
    IF op='delete' THEN
      IF t='pledges' AND (coalesce((old_doc->>'amount_paid')::numeric,0)>0 OR jsonb_array_length(coalesce(old_doc->'payments','[]'))>0 OR EXISTS(SELECT 1 FROM public.giving WHERE pledge_id=ident)) THEN RAISE EXCEPTION 'A pledge with payment history cannot be deleted';END IF;
      IF t='pledge_campaigns' AND EXISTS(SELECT 1 FROM public.pledges WHERE campaign_id=ident) THEN RAISE EXCEPTION 'A campaign with pledges must be archived, not deleted';END IF;
      IF t='members' AND EXISTS(SELECT 1 FROM public.pledges WHERE member_id=ident) THEN RAISE EXCEPTION 'A member with pledge history must be archived';END IF;
$patch$);
  definition:=replace(definition,'    IF t=''members'' THEN',$patch$
    IF t='pledge_campaigns' THEN doc:=gwcc_private.prepare_pledge_campaign(doc,old_doc);END IF;
    IF t='pledges' THEN doc:=gwcc_private.prepare_pledge(doc,old_doc);END IF;
    IF t='giving' THEN doc:=gwcc_private.prepare_pledge_giving(doc,old_doc);END IF;
    IF t='members' THEN$patch$);
  definition:=replace(definition,'  INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result)',E'  PERFORM gwcc_private.check_pledge_links(p_changes);\n  INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result)');
  IF definition=previous OR position('prepare_pledge(doc,old_doc)' IN definition)=0 OR position('check_pledge_links(p_changes)' IN definition)=0 OR position('A pledge or campaign version is required' IN definition)=0 THEN RAISE EXCEPTION 'Pledge mutation patch did not match';END IF;
  EXECUTE definition;
END;
$migration$;
NOTIFY pgrst,'reload schema';
