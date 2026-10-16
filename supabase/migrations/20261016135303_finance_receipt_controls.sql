-- Add controls for future writes. Historical receipts, references, opening balances
-- and current balances are preserved and reviewed through the reconciliation screen.
CREATE SCHEMA IF NOT EXISTS gwcc_private;
REVOKE ALL ON SCHEMA gwcc_private FROM PUBLIC, anon;

ALTER TABLE public.church_finances ADD COLUMN IF NOT EXISTS cash_count_service_id text;
ALTER TABLE public.church_finances ADD COLUMN IF NOT EXISTS cash_count_key text;
ALTER TABLE public.church_finances ADD COLUMN IF NOT EXISTS cash_count_details jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS gwcc_one_cash_count_per_service_date
  ON public.church_finances(cash_count_key)
  WHERE cash_count_key IS NOT NULL AND COALESCE(status,'completed') NOT IN ('voided','cancelled','failed');

CREATE SEQUENCE IF NOT EXISTS gwcc_private.finance_reference_number;
REVOKE ALL ON SEQUENCE gwcc_private.finance_reference_number FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS gwcc_private.finance_reference_reservations (
  reference_key text PRIMARY KEY,
  finance_id text
);
ALTER TABLE gwcc_private.finance_reference_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gwcc_private.finance_reference_reservations FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS deny_direct_access ON gwcc_private.finance_reference_reservations;
CREATE POLICY deny_direct_access ON gwcc_private.finance_reference_reservations USING(false) WITH CHECK(false);
-- Reserve ambiguous historical references without renumbering either receipt.
INSERT INTO gwcc_private.finance_reference_reservations(reference_key,finance_id)
  SELECT upper(btrim(reference_no)),CASE WHEN count(*)=1 THEN min(id) ELSE NULL END
  FROM public.church_finances WHERE NULLIF(btrim(reference_no),'') IS NOT NULL
  GROUP BY upper(btrim(reference_no)) ON CONFLICT(reference_key) DO NOTHING;

CREATE OR REPLACE FUNCTION gwcc_private.prepare_finance_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.church_finances; owner_id text; requested text; reference_key text;
  sequence_number text; prefix text; denomination text; quantity jsonb; counted numeric:=0; names text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
  IF NEW.date IS NULL THEN RAISE EXCEPTION 'Enter a transaction date'; END IF;
  IF NEW.status IS NULL OR NEW.status NOT IN ('completed','voided','pending','cancelled','failed') THEN RAISE EXCEPTION 'Enter a valid receipt status';END IF;
  IF NEW.transaction_type IS NULL OR NEW.transaction_type NOT IN ('income','grant','expense','disbursement','transfer') THEN RAISE EXCEPTION 'Enter a valid transaction type';END IF;
  IF NEW.currency IS NULL OR NEW.currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Enter a valid currency';END IF;
  IF NEW.amount IS NULL OR NEW.amount IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) THEN
    RAISE EXCEPTION 'Enter a finite positive monetary amount';
  END IF;
  -- INSERT ... ON CONFLICT also invokes the INSERT trigger for an existing ID.
  SELECT * INTO previous FROM public.church_finances WHERE id=NEW.id;
  IF previous.cash_count_key IS NOT NULL THEN
    IF NEW.cash_count_service_id IS DISTINCT FROM previous.cash_count_service_id
      OR NEW.cash_count_details IS DISTINCT FROM previous.cash_count_details
      OR NEW.account_id IS DISTINCT FROM previous.account_id OR NEW.date IS DISTINCT FROM previous.date
      OR NEW.amount IS DISTINCT FROM previous.amount OR NEW.transaction_type IS DISTINCT FROM previous.transaction_type
      OR NEW.payment_method IS DISTINCT FROM previous.payment_method THEN
      RAISE EXCEPTION 'Void this cash count and post a replacement to correct its date, account or denomination totals';
    END IF;
    NEW.cash_count_key:=previous.cash_count_key;
  ELSIF NEW.cash_count_service_id IS NOT NULL OR NEW.cash_count_details IS NOT NULL OR NEW.cash_count_key IS NOT NULL THEN
    IF NEW.transaction_type IS DISTINCT FROM 'income' OR NEW.payment_method IS DISTINCT FROM 'cash'
      OR NEW.cash_count_service_id IS NULL OR jsonb_typeof(NEW.cash_count_details) IS DISTINCT FROM 'object'
      OR jsonb_typeof(NEW.cash_count_details->'denominations') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'A cash count needs a service, denomination sheet and cash income receipt';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.church_accounts WHERE id=NEW.account_id AND is_active
      AND currency='GHS' AND account_type IN ('cash_petty','cash')) OR NEW.currency<>'GHS' THEN
      RAISE EXCEPTION 'Select an active GHS cash account. Bank and MoMo accounts cannot receive a physical cash count';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=NEW.cash_count_service_id AND is_active) THEN
      RAISE EXCEPTION 'Select an active service for this cash count';
    END IF;
    IF NEW.date>(now() AT TIME ZONE 'Africa/Accra')::date THEN RAISE EXCEPTION 'A cash-count date cannot be in the future'; END IF;
    names:=ARRAY[btrim(NEW.cash_count_details->>'counter1'),btrim(NEW.cash_count_details->>'counter2'),btrim(NEW.cash_count_details->>'supervisor')];
    IF jsonb_typeof(NEW.cash_count_details->'counter1') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.cash_count_details->'counter2') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.cash_count_details->'supervisor') IS DISTINCT FROM 'string'
      OR EXISTS(SELECT 1 FROM unnest(names) n WHERE n IS NULL OR length(n) NOT BETWEEN 2 AND 150)
      OR lower(names[1])=lower(names[2]) THEN
      RAISE EXCEPTION 'Enter two different counter names and a supervisor name';
    END IF;
    FOR denomination,quantity IN SELECT key,value FROM jsonb_each(NEW.cash_count_details->'denominations') LOOP
      IF denomination NOT IN ('200','100','50','20','10','5','2','1','0.5','0.2','0.1')
        OR jsonb_typeof(quantity)<>'number' OR quantity::text !~ '^\d+$'
        OR quantity::numeric>1000000 THEN
        RAISE EXCEPTION 'Enter whole, non-negative quantities for the listed denominations';
      END IF;
      counted:=counted+denomination::numeric*quantity::numeric;
    END LOOP;
    IF counted<=0 OR counted<>NEW.amount THEN RAISE EXCEPTION 'The receipt amount must match its counted denominations'; END IF;
    NEW.cash_count_key:=NEW.cash_count_service_id||':'||NEW.date::text;
    NEW.cash_count_details:=NEW.cash_count_details||jsonb_build_object('counter1',names[1],'counter2',names[2],'supervisor',names[3],'recorded_by_user_id',auth.uid());
  END IF;
  IF NEW.cash_count_key IS NOT NULL AND NEW.status NOT IN ('voided','cancelled','failed') AND EXISTS(
    SELECT 1 FROM public.church_finances WHERE cash_count_key=NEW.cash_count_key AND id<>NEW.id AND COALESCE(status,'completed') NOT IN ('voided','cancelled','failed')) THEN
    RAISE EXCEPTION 'A cash count for this service and date is already recorded. Review or void it before posting a replacement';
  END IF;
  requested:=NULLIF(btrim(NEW.reference_no),'');
  IF previous.id IS NOT NULL AND requested IS NOT NULL AND requested NOT LIKE 'PENDING-%'
    AND requested IS NOT DISTINCT FROM NULLIF(btrim(previous.reference_no),'') THEN RETURN NEW; END IF;
  IF requested IS NULL OR requested LIKE 'PENDING-%' THEN
    prefix:=CASE WHEN NEW.cash_count_key IS NOT NULL THEN 'CASH'
      WHEN NEW.transaction_type IN ('income','grant') THEN 'INC' WHEN NEW.transaction_type='transfer' THEN 'TRF' ELSE 'VCH' END;
    LOOP
      sequence_number:=nextval('gwcc_private.finance_reference_number')::text;
      requested:=prefix||'-'||extract(year FROM NEW.date)::text||'-'||lpad(sequence_number,GREATEST(6,length(sequence_number)),'0');
      INSERT INTO gwcc_private.finance_reference_reservations(reference_key,finance_id) VALUES(upper(requested),NEW.id)
        ON CONFLICT DO NOTHING;
      EXIT WHEN FOUND;
    END LOOP;
  ELSE
    reference_key:=upper(requested);
    INSERT INTO gwcc_private.finance_reference_reservations(reference_key,finance_id) VALUES(reference_key,NEW.id) ON CONFLICT DO NOTHING;
    SELECT r.finance_id INTO owner_id FROM gwcc_private.finance_reference_reservations r WHERE r.reference_key=upper(requested);
    IF owner_id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'This receipt reference is already in use. Leave it blank for a new number' USING ERRCODE='23505'; END IF;
  END IF;
  NEW.reference_no:=requested;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.prepare_finance_receipt() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS gwcc_prepare_finance_receipt ON public.church_finances;
CREATE TRIGGER gwcc_prepare_finance_receipt BEFORE INSERT OR UPDATE ON public.church_finances
  FOR EACH ROW EXECUTE FUNCTION gwcc_private.prepare_finance_receipt();

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.church_accounts'::regclass AND conname='gwcc_finite_account_balances') THEN
    ALTER TABLE public.church_accounts ADD CONSTRAINT gwcc_finite_account_balances CHECK(
      current_balance IS NOT NULL AND opening_balance IS NOT NULL AND currency IS NOT NULL AND currency ~ '^[A-Z]{3}$'
      AND current_balance NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND current_balance>=0
      AND opening_balance NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION gwcc_private.budget_period_range(p_period text) RETURNS daterange
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE parts text[]; first_day date;
BEGIN
  parts:=regexp_match(btrim(p_period),'(?i)^([0-9]{4})( Annual)?$');
  IF parts IS NOT NULL THEN first_day:=make_date(parts[1]::int,1,1);RETURN daterange(first_day,(first_day+interval '1 year')::date,'[)');END IF;
  parts:=regexp_match(btrim(p_period),'(?i)^Q([1-4])[- ]([0-9]{4})$');
  IF parts IS NOT NULL THEN first_day:=make_date(parts[2]::int,parts[1]::int*3-2,1);RETURN daterange(first_day,(first_day+interval '3 months')::date,'[)');END IF;
  parts:=regexp_match(btrim(p_period),'^([0-9]{4})-(0[1-9]|1[0-2])$');
  IF parts IS NOT NULL THEN first_day:=make_date(parts[1]::int,parts[2]::int,1);RETURN daterange(first_day,(first_day+interval '1 month')::date,'[)');END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.budget_period_range(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION gwcc_private.validate_budget_document() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE budget_range daterange; allocation numeric;
BEGIN
  IF NEW.namespace<>'department_budgets' THEN RETURN NEW;END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
  IF jsonb_typeof(NEW.data->'department') IS DISTINCT FROM 'string' OR NULLIF(btrim(NEW.data->>'department'),'') IS NULL
    OR jsonb_typeof(NEW.data->'period') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW.data->'allocated_amount') IS DISTINCT FROM 'number'
    OR COALESCE(NEW.data->>'currency','') !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Enter a department, supported budget period, currency and finite positive allocation';
  END IF;
  budget_range:=gwcc_private.budget_period_range(NEW.data->>'period');
  allocation:=(NEW.data->>'allocated_amount')::numeric;
  IF budget_range IS NULL OR allocation<=0 OR allocation<>round(allocation,2)
    OR allocation IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) THEN
    RAISE EXCEPTION 'Enter a supported budget period and finite positive allocation with at most two decimal places';
  END IF;
  IF EXISTS(SELECT 1 FROM public.gwcc_documents d WHERE d.namespace='department_budgets' AND d.id<>NEW.id
    AND lower(btrim(d.data->>'department'))=lower(btrim(NEW.data->>'department')) AND d.data->>'currency'=NEW.data->>'currency'
    AND (gwcc_private.budget_period_range(d.data->>'period') IS NULL OR gwcc_private.budget_period_range(d.data->>'period') && budget_range)) THEN
    RAISE EXCEPTION 'This department already has a budget in an overlapping period. Edit that budget or choose a different period';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.validate_budget_document() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS gwcc_validate_budget_document ON public.gwcc_documents;
CREATE TRIGGER gwcc_validate_budget_document BEFORE INSERT OR UPDATE ON public.gwcc_documents
  FOR EACH ROW WHEN (NEW.namespace='department_budgets') EXECUTE FUNCTION gwcc_private.validate_budget_document();
