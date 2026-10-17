-- Historical receipts keep their status and balances. New outbound entries are
-- requests; only the protected action below can approve or record payment.
ALTER TABLE public.church_finances
  ADD COLUMN IF NOT EXISTS approval_state text,
  ADD COLUMN IF NOT EXISTS requested_by_id uuid,
  ADD COLUMN IF NOT EXISTS requested_by text,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_id uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by_id uuid,
  ADD COLUMN IF NOT EXISTS paid_by text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS approval_history jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS welfare_claim_id text;
CREATE INDEX IF NOT EXISTS gwcc_finance_approval_queue ON public.church_finances(approval_state,requested_at DESC) WHERE approval_state IS NOT NULL;

CREATE OR REPLACE FUNCTION gwcc_private.guard_finance_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.church_finances; actor uuid:=auth.uid(); actor_role text:=public.current_user_role(); actor_name text;
  decision text:=NULLIF(current_setting('gwcc.finance_action',true),''); protected_keys text[]:=ARRAY[
    'approval_state','requested_by_id','requested_by','requested_at','approved_by_id','approved_at','paid_by_id','paid_by','paid_at','payment_reference','approval_history'];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
  SELECT * INTO previous FROM public.church_finances WHERE id=NEW.id;
  IF NEW.transaction_type NOT IN ('expense','disbursement','transfer') AND previous.approval_state IS NULL AND (previous.id IS NULL OR previous.transaction_type NOT IN ('expense','disbursement','transfer')) THEN
    IF (to_jsonb(NEW)->'approval_state') IS DISTINCT FROM COALESCE(to_jsonb(previous)->'approval_state','null'::jsonb)
      OR NEW.requested_by_id IS NOT NULL OR NEW.approved_by_id IS NOT NULL OR NEW.paid_by_id IS NOT NULL
      OR NEW.requested_by IS NOT NULL OR NEW.requested_at IS NOT NULL OR NEW.approved_at IS NOT NULL
      OR NEW.paid_by IS NOT NULL OR NEW.paid_at IS NOT NULL OR NEW.payment_reference IS NOT NULL
      OR NEW.approval_history<>'[]'::jsonb OR NEW.welfare_claim_id IS NOT NULL THEN
      RAISE EXCEPTION 'Approval identity and history are maintained by the server';
    END IF;
    RETURN NEW;
  END IF;
  IF actor IS NULL OR actor_role NOT IN ('super_admin','senior_pastor','finance_officer') THEN
    RAISE EXCEPTION 'A verified finance account with two-factor authentication is required' USING ERRCODE='42501';
  END IF;
  SELECT COALESCE(NULLIF(btrim(concat_ws(' ',first_name,last_name)),''),actor::text) INTO actor_name FROM public.profiles WHERE id=actor::text;
  IF previous.id IS NULL THEN
    NEW.approval_state:='requested';NEW.status:='pending';NEW.requested_by_id:=actor;NEW.requested_by:=actor_name;NEW.requested_at:=clock_timestamp();
    NEW.approved_by_id:=NULL;NEW.approved_by:=NULL;NEW.approved_at:=NULL;NEW.paid_by_id:=NULL;NEW.paid_by:=NULL;NEW.paid_at:=NULL;NEW.payment_reference:=NULL;
    NEW.void_reason:=NULL;NEW.voided_by:=NULL;NEW.recorded_by:=actor_name;
    NEW.approval_history:=jsonb_build_array(jsonb_build_object('action','requested','actor_id',actor,'actor_name',actor_name,'at',NEW.requested_at,'amount',NEW.amount,'account_id',NEW.account_id));
  ELSIF previous.approval_state IS NULL THEN
    -- A historical payment is not evidence of an authenticated approval.
    IF NEW.status IS DISTINCT FROM 'voided' OR previous.status IS DISTINCT FROM 'completed'
      OR length(btrim(COALESCE(NEW.void_reason,'')))<3
      OR (to_jsonb(NEW)-ARRAY['status','void_reason','voided_by','updated_at']) IS DISTINCT FROM
         (to_jsonb(previous)-ARRAY['status','void_reason','voided_by','updated_at']) THEN
      RAISE EXCEPTION 'Historical payments are preserved. Void with a reason and submit a new request to correct a payment';
    END IF;
    NEW.voided_by:=actor_name;
  ELSIF decision IS NOT NULL THEN
    -- The private action sets all workflow fields. Generic writes cannot reach this path.
    IF (to_jsonb(NEW)-protected_keys-ARRAY['approved_by','status','updated_at','void_reason','voided_by']) IS DISTINCT FROM
       (to_jsonb(previous)-protected_keys-ARRAY['approved_by','status','updated_at','void_reason','voided_by']) THEN
      RAISE EXCEPTION 'Payment terms cannot change during an approval action';
    END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['updated_at']) IS NOT DISTINCT FROM (to_jsonb(previous)-ARRAY['updated_at']) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Saved payment requests cannot be edited. Cancel and submit a replacement request';
  END IF;
  IF NEW.approval_state IN ('requested','approved','paid') THEN
    IF NEW.account_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.church_accounts WHERE id=NEW.account_id AND is_active AND currency=NEW.currency) THEN RAISE EXCEPTION 'Select an active holding account with matching currency';END IF;
    IF NEW.transaction_type='transfer' AND (NEW.to_account_id IS NULL OR NEW.to_account_id=NEW.account_id OR NOT EXISTS(SELECT 1 FROM public.church_accounts WHERE id=NEW.to_account_id AND is_active AND currency=NEW.currency)) THEN RAISE EXCEPTION 'Select two different active accounts with matching currency';END IF;
    IF NEW.welfare_claim_id IS NOT NULL AND (NEW.transaction_type<>'disbursement' OR NOT EXISTS(SELECT 1 FROM public.welfare_claims WHERE id=NEW.welfare_claim_id AND status IN ('approved','disbursed') AND amount_approved-COALESCE(amount_disbursed,0)>=NEW.amount)) THEN RAISE EXCEPTION 'This welfare payment exceeds the remaining approved claim amount';END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.guard_finance_approval() FROM PUBLIC,anon,authenticated;
-- Runs before existing receipt validation, including both halves of an upsert.
DROP TRIGGER IF EXISTS gwcc_approval_guard ON public.church_finances;
CREATE TRIGGER gwcc_approval_guard BEFORE INSERT OR UPDATE ON public.church_finances FOR EACH ROW EXECUTE FUNCTION gwcc_private.guard_finance_approval();

CREATE OR REPLACE FUNCTION gwcc_private.finance_approval_action(p_operation_id uuid,p_finance_id text,p_expected_updated_at timestamptz,p_action text,p_reason text,p_payment_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.church_finances; actor uuid:=auth.uid(); actor_role text:=public.current_user_role(); actor_name text; stamp timestamptz:=clock_timestamp();
  previous public.gwcc_applied_operations; saved jsonb; checksum text; old_action text:=current_setting('gwcc.finance_action',true); claim public.welfare_claims; payment jsonb;
BEGIN
  IF actor IS NULL OR actor_role NOT IN ('super_admin','senior_pastor','finance_officer') THEN RAISE EXCEPTION 'A verified finance account with two-factor authentication is required' USING ERRCODE='42501';END IF;
  IF p_operation_id IS NULL OR p_finance_id IS NULL OR p_expected_updated_at IS NULL OR p_action IS NULL OR p_action NOT IN ('approve','reject','cancel','paid','void') THEN RAISE EXCEPTION 'Choose a valid action on a cloud-confirmed request';END IF;
  IF length(COALESCE(p_reason,''))>2000 OR length(COALESCE(p_payment_reference,''))>200 THEN RAISE EXCEPTION 'The payment reference or reason is too long';END IF;
  checksum:=md5(jsonb_build_object('kind','finance_approval','id',p_finance_id,'version',p_expected_updated_at,'action',p_action,'reason',p_reason,'payment_reference',p_payment_reference)::text);
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
  SELECT * INTO previous FROM public.gwcc_applied_operations WHERE user_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN IF previous.request_hash<>checksum THEN RAISE EXCEPTION 'Operation ID was reused with different data';END IF;RETURN previous.result;END IF;
  SELECT * INTO r FROM public.church_finances WHERE id=p_finance_id FOR UPDATE;
  IF NOT FOUND OR r.approval_state IS NULL THEN RAISE EXCEPTION 'This is not a payment request';END IF;
  IF r.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'This request changed. Refresh and review its latest details' USING ERRCODE='40001';END IF;
  SELECT COALESCE(NULLIF(btrim(concat_ws(' ',first_name,last_name)),''),actor::text) INTO actor_name FROM public.profiles WHERE id=actor::text;
  IF p_action IN ('approve','reject') THEN
    IF r.approval_state<>'requested' THEN RAISE EXCEPTION 'Only awaiting requests can be reviewed';END IF;
    IF r.requested_by_id=actor THEN RAISE EXCEPTION 'A different finance staff member must review your request' USING ERRCODE='42501';END IF;
    IF p_action='approve' THEN r.approval_state:='approved';r.approved_by_id:=actor;r.approved_by:=actor_name;r.approved_at:=stamp;
    ELSE IF length(btrim(COALESCE(p_reason,'')))<3 THEN RAISE EXCEPTION 'Enter a reason for rejecting this request';END IF;r.approval_state:='rejected';r.status:='cancelled';END IF;
  ELSIF p_action='cancel' THEN
    IF r.approval_state NOT IN ('requested','approved') THEN RAISE EXCEPTION 'Only unpaid open requests can be cancelled';END IF;
    IF actor<>r.requested_by_id AND actor_role NOT IN ('super_admin','senior_pastor') THEN RAISE EXCEPTION 'Only the requester or senior administrator may cancel this request' USING ERRCODE='42501';END IF;
    IF length(btrim(COALESCE(p_reason,'')))<3 THEN RAISE EXCEPTION 'Enter a reason for cancelling this request';END IF;
    r.approval_state:='cancelled';r.status:='cancelled';
  ELSIF p_action='paid' THEN
    IF r.approval_state<>'approved' OR r.approved_by_id IS NULL OR r.approved_by_id=r.requested_by_id THEN RAISE EXCEPTION 'An independent approval is required before recording payment';END IF;
    IF length(btrim(COALESCE(p_payment_reference,'')))<3 THEN RAISE EXCEPTION 'Enter the bank, MoMo or signed cash payment reference';END IF;
    IF r.date>(now() AT TIME ZONE 'Africa/Accra')::date THEN RAISE EXCEPTION 'The payment date cannot be in the future';END IF;
    r.approval_state:='paid';r.status:='completed';r.paid_by_id:=actor;r.paid_by:=actor_name;r.paid_at:=stamp;r.payment_reference:=btrim(p_payment_reference);
  ELSE
    IF r.approval_state<>'paid' OR actor_role NOT IN ('super_admin','senior_pastor') THEN RAISE EXCEPTION 'Only a senior administrator may void a paid request' USING ERRCODE='42501';END IF;
    IF r.welfare_claim_id IS NOT NULL THEN RAISE EXCEPTION 'A linked welfare payment needs a coordinated claim correction';END IF;
    IF length(btrim(COALESCE(p_reason,'')))<3 THEN RAISE EXCEPTION 'Enter a reason for voiding this payment';END IF;
    r.approval_state:='voided';r.status:='voided';r.void_reason:=btrim(p_reason);r.voided_by:=actor_name;
  END IF;
  r.updated_at:=stamp;
  r.approval_history:=r.approval_history||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('action',p_action,'actor_id',actor,'actor_name',actor_name,'at',stamp,'reason',NULLIF(btrim(p_reason),''),'payment_reference',CASE WHEN p_action='paid' THEN r.payment_reference END)));
  PERFORM set_config('gwcc.finance_action',p_action,true);
  UPDATE public.church_finances SET approval_state=r.approval_state,status=r.status,approved_by_id=r.approved_by_id,approved_by=r.approved_by,approved_at=r.approved_at,
    paid_by_id=r.paid_by_id,paid_by=r.paid_by,paid_at=r.paid_at,payment_reference=r.payment_reference,void_reason=r.void_reason,voided_by=r.voided_by,
    approval_history=r.approval_history,updated_at=r.updated_at WHERE id=r.id RETURNING to_jsonb(church_finances.*) INTO saved;
  PERFORM set_config('gwcc.finance_action',COALESCE(old_action,''),true);
  IF p_action='paid' AND r.welfare_claim_id IS NOT NULL THEN
    SELECT * INTO claim FROM public.welfare_claims WHERE id=r.welfare_claim_id FOR UPDATE;
    IF NOT FOUND OR claim.status NOT IN ('approved','disbursed') OR COALESCE(claim.amount_disbursed,0)+r.amount>claim.amount_approved THEN RAISE EXCEPTION 'Payment exceeds the remaining approved welfare claim';END IF;
    payment:=jsonb_build_object('id',gen_random_uuid(),'claim_id',claim.id,'amount',r.amount,'date',r.date,'payment_method',r.payment_method,'voucher_no',r.reference_no,'disbursed_by',actor_name,'finance_account_id',r.account_id,'finance_account_name',r.account_name,'finance_transaction_id',r.id,'created_at',stamp);
    UPDATE public.welfare_claims SET amount_disbursed=COALESCE(amount_disbursed,0)+r.amount,
      status=CASE WHEN COALESCE(amount_disbursed,0)+r.amount>=amount_approved THEN 'disbursed' ELSE 'approved' END,
      disbursement_date=r.date,disbursement_method=r.payment_method,disbursement_voucher_no=r.reference_no,finance_account_id=r.account_id,finance_account_name=r.account_name,
      disbursements=COALESCE(disbursements,'[]')||jsonb_build_array(payment),updated_at=stamp WHERE id=claim.id;
  END IF;
  INSERT INTO public.audit_logs(id,actor_id,user_name,user_role,action,module,record_id,details,timestamp)
    VALUES(gen_random_uuid()::text,actor,actor_name,actor_role,'FINANCE_'||upper(p_action),'Church Finance',r.id,'Authenticated payment workflow: '||p_action,stamp);
  INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result) VALUES(actor,p_operation_id,checksum,saved);
  RETURN saved;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.finance_approval_action(uuid,text,timestamptz,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION gwcc_private.finance_approval_action(uuid,text,timestamptz,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.gwcc_finance_approval_action(p_operation_id uuid,p_finance_id text,p_expected_updated_at timestamptz,p_action text,p_reason text DEFAULT '',p_payment_reference text DEFAULT '') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT gwcc_private.finance_approval_action(p_operation_id,p_finance_id,p_expected_updated_at,p_action,p_reason,p_payment_reference) $$;
REVOKE ALL ON FUNCTION public.gwcc_finance_approval_action(uuid,text,timestamptz,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gwcc_finance_approval_action(uuid,text,timestamptz,text,text,text) TO authenticated;

-- The old unlinked expense book remains readable history; it must not bypass the treasury.
CREATE OR REPLACE FUNCTION gwcc_private.preserve_legacy_expenses() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Legacy expense history is read-only. Submit a payment request in Church Finance';END;$$;
REVOKE ALL ON FUNCTION gwcc_private.preserve_legacy_expenses() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS gwcc_preserve_expenses ON public.expenses;
CREATE TRIGGER gwcc_preserve_expenses BEFORE INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION gwcc_private.preserve_legacy_expenses();
