-- Explicit allocation only. Existing receipts, balances and budgets are not backfilled.
ALTER TABLE public.church_finances ADD COLUMN IF NOT EXISTS giving_deposit_amount numeric(14,2) NOT NULL DEFAULT 0;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='gwcc_giving_deposit_amount' AND conrelid='public.church_finances'::regclass) THEN
  ALTER TABLE public.church_finances ADD CONSTRAINT gwcc_giving_deposit_amount CHECK(giving_deposit_amount>=0 AND giving_deposit_amount<=amount AND giving_deposit_amount NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)) NOT VALID;
 END IF;
END$$;
CREATE INDEX IF NOT EXISTS gwcc_giving_deposit_receipt ON public.gwcc_documents((data->>'giving_id')) WHERE namespace='giving_deposit_links';
CREATE INDEX IF NOT EXISTS gwcc_giving_deposit_finance ON public.gwcc_documents((data->>'finance_id')) WHERE namespace='giving_deposit_links';

CREATE OR REPLACE FUNCTION gwcc_private.guard_giving_deposit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.church_finances;
BEGIN
 IF TG_TABLE_NAME='gwcc_documents' THEN
  IF COALESCE(NEW.namespace,'')<>'giving_deposit_links' AND COALESCE(OLD.namespace,'')<>'giving_deposit_links' THEN
   IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
  END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
 IF TG_TABLE_NAME='gwcc_documents' THEN
  IF (NEW.namespace='giving_deposit_links' OR OLD.namespace='giving_deposit_links') AND COALESCE(current_setting('gwcc.giving_deposit',true),'')<>'link' THEN
   RAISE EXCEPTION 'Giving deposit links are maintained by the finance deposit action';
  END IF;
 ELSIF TG_TABLE_NAME='giving' THEN
  IF EXISTS(SELECT 1 FROM public.gwcc_documents d JOIN public.church_finances f ON f.id=d.data->>'finance_id'
    WHERE d.namespace='giving_deposit_links' AND d.data->>'giving_id'=OLD.id AND f.status='completed')
   AND (TG_OP='DELETE' OR (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at')) THEN
   RAISE EXCEPTION 'Void the linked treasury income before correcting this Giving receipt';
  END IF;
 ELSE
  SELECT * INTO previous FROM public.church_finances WHERE id=NEW.id;
  IF NEW.giving_deposit_amount IS DISTINCT FROM COALESCE(previous.giving_deposit_amount,0)
    AND COALESCE(current_setting('gwcc.giving_deposit',true),'')<>'link' THEN
   RAISE EXCEPTION 'Giving deposit totals are maintained by the finance deposit action';
  END IF;
  IF EXISTS(SELECT 1 FROM public.gwcc_documents d WHERE d.namespace='giving_deposit_links' AND d.data->>'finance_id'=previous.id)
   AND (NEW.amount IS DISTINCT FROM previous.amount OR NEW.account_id IS DISTINCT FROM previous.account_id OR NEW.currency IS DISTINCT FROM previous.currency
     OR NEW.date IS DISTINCT FROM previous.date OR NEW.transaction_type IS DISTINCT FROM previous.transaction_type OR NEW.payment_method IS DISTINCT FROM previous.payment_method) THEN
   RAISE EXCEPTION 'Void this linked treasury income before changing its financial details';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.guard_giving_deposit() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS gwcc_giving_deposit_document ON public.gwcc_documents;
CREATE TRIGGER gwcc_giving_deposit_document BEFORE INSERT OR UPDATE OR DELETE ON public.gwcc_documents FOR EACH ROW EXECUTE FUNCTION gwcc_private.guard_giving_deposit();
DROP TRIGGER IF EXISTS gwcc_giving_deposit_receipt_guard ON public.giving;
CREATE TRIGGER gwcc_giving_deposit_receipt_guard BEFORE UPDATE OR DELETE ON public.giving FOR EACH ROW EXECUTE FUNCTION gwcc_private.guard_giving_deposit();
DROP TRIGGER IF EXISTS gwcc_giving_deposit_finance_guard ON public.church_finances;
CREATE TRIGGER gwcc_giving_deposit_finance_guard BEFORE INSERT OR UPDATE ON public.church_finances FOR EACH ROW EXECUTE FUNCTION gwcc_private.guard_giving_deposit();

CREATE OR REPLACE FUNCTION gwcc_private.giving_deposit_links() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_user_role() NOT IN ('super_admin','senior_pastor','finance_officer') THEN RAISE EXCEPTION 'Verified finance authorization is required' USING ERRCODE='42501';END IF;
 RETURN COALESCE((SELECT jsonb_agg(d.data||jsonb_build_object('active',f.status='completed') ORDER BY d.updated_at DESC)
  FROM public.gwcc_documents d JOIN public.church_finances f ON f.id=d.data->>'finance_id' WHERE d.namespace='giving_deposit_links'),'[]');
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.giving_deposit_links() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION gwcc_private.giving_deposit_links() TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_giving_deposit_links() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.giving_deposit_links();$$;
REVOKE ALL ON FUNCTION public.gwcc_giving_deposit_links() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.gwcc_giving_deposit_links() TO authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.post_giving_deposit(p_operation_id uuid,p_receipts jsonb,p_account_id text,p_date date,p_payment_method text,p_reference text,p_existing_finance_id text,p_expected_updated_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();role_name text:=public.current_user_role();actor_name text;previous public.gwcc_applied_operations;
 checksum text;receipt jsonb;g public.giving;a public.church_accounts;f public.church_finances;total numeric:=0;ids text[]:='{}';giving_id text;saved jsonb;old_flag text:=current_setting('gwcc.giving_deposit',true);
BEGIN
 IF actor IS NULL OR role_name NOT IN ('super_admin','senior_pastor','finance_officer') THEN RAISE EXCEPTION 'Verified finance authorization is required' USING ERRCODE='42501';END IF;
 IF p_operation_id IS NULL OR jsonb_typeof(p_receipts) IS DISTINCT FROM 'array' OR jsonb_array_length(p_receipts) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Select between 1 and 100 confirmed Giving receipts';END IF;
 checksum:=md5(jsonb_build_object('kind','giving_deposit','receipts',p_receipts,'account',p_account_id,'date',p_date,'method',p_payment_method,'reference',p_reference,'existing',p_existing_finance_id,'version',p_expected_updated_at)::text);
 PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
 SELECT * INTO previous FROM public.gwcc_applied_operations WHERE user_id=actor AND operation_id=p_operation_id;
 IF FOUND THEN IF previous.request_hash<>checksum THEN RAISE EXCEPTION 'Operation ID was reused with different data';END IF;RETURN previous.result;END IF;
 IF p_date IS NULL OR p_date>(now() AT TIME ZONE 'Africa/Accra')::date OR p_payment_method NOT IN ('cash','mobile_money','bank_transfer','card','cheque','other') OR p_payment_method IS NULL OR length(COALESCE(p_reference,''))>200 THEN RAISE EXCEPTION 'Choose a valid deposit date, method and reference';END IF;
 SELECT * INTO a FROM public.church_accounts WHERE id=p_account_id AND is_active AND currency='GHS' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select an active GHS holding account';END IF;
 SELECT btrim(concat_ws(' ',first_name,last_name)) INTO actor_name FROM public.profiles WHERE id=actor::text;
 IF NULLIF(p_existing_finance_id,'') IS NOT NULL THEN
  SELECT * INTO f FROM public.church_finances WHERE id=p_existing_finance_id FOR UPDATE;
  IF NOT FOUND OR f.status IS DISTINCT FROM 'completed' OR f.transaction_type NOT IN ('income','grant') OR f.account_id<>a.id OR f.currency IS DISTINCT FROM 'GHS' THEN RAISE EXCEPTION 'Select a confirmed income receipt for this account';END IF;
  IF p_expected_updated_at IS NULL OR f.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'The income receipt changed. Refresh and review it again';END IF;
  IF f.date<>p_date OR f.payment_method<>p_payment_method THEN RAISE EXCEPTION 'Use the existing income receipt date and method';END IF;
 END IF;
 FOR receipt IN SELECT value FROM jsonb_array_elements(p_receipts) LOOP
  IF jsonb_typeof(receipt) IS DISTINCT FROM 'object' OR receipt->>'id' IS NULL OR receipt->>'updated_at' IS NULL OR receipt->>'id'=ANY(ids) THEN RAISE EXCEPTION 'Select distinct confirmed Giving receipts';END IF;
  SELECT * INTO g FROM public.giving WHERE id=receipt->>'id' FOR UPDATE;
  IF NOT FOUND OR COALESCE(g.status,'completed')<>'completed' OR g.currency IS DISTINCT FROM 'GHS' OR g.amount IS NULL OR g.amount<=0 OR g.amount IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) OR g.updated_at IS DISTINCT FROM (receipt->>'updated_at')::timestamptz THEN RAISE EXCEPTION 'A Giving receipt changed or is unavailable. Refresh before posting';END IF;
  IF g.date IS NULL OR g.date>p_date THEN RAISE EXCEPTION 'A deposit date cannot precede its Giving receipts';END IF;
  IF EXISTS(SELECT 1 FROM public.gwcc_documents d JOIN public.church_finances linked ON linked.id=d.data->>'finance_id'
   WHERE d.namespace='giving_deposit_links' AND d.data->>'giving_id'=g.id AND linked.status='completed') THEN RAISE EXCEPTION 'A selected Giving receipt is already allocated to treasury';END IF;
  IF f.cash_count_key IS NOT NULL AND (g.payment_method<>'cash' OR g.date<>f.date OR (g.service_id IS NOT NULL AND g.service_id<>f.cash_count_service_id)) THEN RAISE EXCEPTION 'Only matching cash receipts can link to this service cash count';END IF;
  ids:=array_append(ids,g.id);total:=total+g.amount;
 END LOOP;
 IF f.id IS NULL THEN
  IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'Choose an existing income receipt or create a new deposit';END IF;
  INSERT INTO public.church_finances(id,transaction_type,account_id,account_name,category,title,recipient_or_vendor,amount,currency,date,payment_method,reference_no,department,recorded_by,status)
   VALUES(gen_random_uuid()::text,'income',a.id,a.name,'Member Giving Deposit','Member Giving treasury deposit','Member Giving receipts',total,'GHS',p_date,p_payment_method,NULLIF(btrim(p_reference),''),'Treasury & Accounts',actor_name,'completed') RETURNING * INTO f;
 ELSE
  IF total+f.giving_deposit_amount>f.amount THEN RAISE EXCEPTION 'Selected Giving exceeds the unallocated amount on this income receipt';END IF;
 END IF;
 PERFORM set_config('gwcc.giving_deposit','link',true);
 FOREACH giving_id IN ARRAY ids LOOP
  SELECT * INTO g FROM public.giving WHERE id=giving_id;
  INSERT INTO public.gwcc_documents(namespace,id,data) VALUES('giving_deposit_links',g.id||':'||f.id,
   jsonb_build_object('giving_id',g.id,'finance_id',f.id,'amount',g.amount,'giving_version',g.updated_at,'linked_by',actor::text,'linked_by_name',actor_name,'linked_at',clock_timestamp()));
 END LOOP;
 UPDATE public.church_finances SET giving_deposit_amount=giving_deposit_amount+total,updated_at=clock_timestamp() WHERE id=f.id RETURNING to_jsonb(church_finances.*) INTO saved;
 PERFORM set_config('gwcc.giving_deposit',COALESCE(old_flag,''),true);
 INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details,timestamp)
  VALUES(gen_random_uuid()::text,actor,actor_name,role_name,'ALLOCATE_GIVING_DEPOSIT','Church Finance',f.id,'Linked '||array_length(ids,1)||' Giving receipts totalling GHS '||total,clock_timestamp());
 INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result) VALUES(actor,p_operation_id,checksum,saved);
 RETURN saved;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.post_giving_deposit(uuid,jsonb,text,date,text,text,text,timestamptz) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION gwcc_private.post_giving_deposit(uuid,jsonb,text,date,text,text,text,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_post_giving_deposit(p_operation_id uuid,p_receipts jsonb,p_account_id text,p_date date,p_payment_method text,p_reference text DEFAULT '',p_existing_finance_id text DEFAULT NULL,p_expected_updated_at timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT gwcc_private.post_giving_deposit(p_operation_id,p_receipts,p_account_id,p_date,p_payment_method,p_reference,p_existing_finance_id,p_expected_updated_at);$$;
REVOKE ALL ON FUNCTION public.gwcc_post_giving_deposit(uuid,jsonb,text,date,text,text,text,timestamptz) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.gwcc_post_giving_deposit(uuid,jsonb,text,date,text,text,text,timestamptz) TO authenticated;

-- Optional caps are enforced at posting, including concurrent and direct RPC writes.
CREATE OR REPLACE FUNCTION gwcc_private.enforce_budget_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record;usage numeric;budget_range daterange;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
 IF TG_TABLE_NAME='gwcc_documents' THEN
  IF NEW.namespace<>'department_budgets' THEN RETURN NEW;END IF;
  IF NEW.data ? 'enforce_limit' AND jsonb_typeof(NEW.data->'enforce_limit') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Choose whether to enforce this budget limit';END IF;
  IF NEW.data->>'enforce_limit' IS DISTINCT FROM 'true' THEN RETURN NEW;END IF;
  budget_range:=gwcc_private.budget_period_range(NEW.data->>'period');
  SELECT COALESCE(sum(f.amount),0) INTO usage FROM public.church_finances f WHERE f.status='completed' AND f.transaction_type IN ('expense','disbursement')
   AND f.currency=NEW.data->>'currency' AND f.date<@budget_range AND (f.budget_id=NEW.id OR lower(btrim(f.department))=lower(btrim(NEW.data->>'department')));
  IF usage>(NEW.data->>'allocated_amount')::numeric THEN RAISE EXCEPTION 'Budget limit is below already posted spending. Increase the allocation before enforcing it';END IF;
 ELSE
  IF NEW.status<>'completed' OR NEW.transaction_type NOT IN ('expense','disbursement') THEN RETURN NEW;END IF;
  FOR b IN SELECT id,data FROM public.gwcc_documents WHERE namespace='department_budgets' AND data->>'enforce_limit'='true'
    AND data->>'currency'=NEW.currency AND NEW.date<@gwcc_private.budget_period_range(data->>'period')
    AND (NEW.budget_id=id OR lower(btrim(NEW.department))=lower(btrim(data->>'department'))) LOOP
   SELECT COALESCE(sum(f.amount),0)+NEW.amount INTO usage FROM public.church_finances f WHERE f.id<>NEW.id AND f.status='completed' AND f.transaction_type IN ('expense','disbursement')
    AND f.currency=b.data->>'currency' AND f.date<@gwcc_private.budget_period_range(b.data->>'period') AND (f.budget_id=b.id OR lower(btrim(f.department))=lower(btrim(b.data->>'department')));
   IF usage>(b.data->>'allocated_amount')::numeric THEN RAISE EXCEPTION 'Budget limit exceeded for %. Increase the department allocation before posting this payment',b.data->>'department';END IF;
  END LOOP;
 END IF;RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION gwcc_private.enforce_budget_limit() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS gwcc_budget_limit ON public.church_finances;
CREATE TRIGGER gwcc_budget_limit BEFORE INSERT OR UPDATE ON public.church_finances FOR EACH ROW EXECUTE FUNCTION gwcc_private.enforce_budget_limit();
DROP TRIGGER IF EXISTS gwcc_budget_limit_document ON public.gwcc_documents;
CREATE TRIGGER gwcc_budget_limit_document BEFORE INSERT OR UPDATE ON public.gwcc_documents FOR EACH ROW
 WHEN (NEW.namespace='department_budgets') EXECUTE FUNCTION gwcc_private.enforce_budget_limit();
NOTIFY pgrst,'reload schema';
