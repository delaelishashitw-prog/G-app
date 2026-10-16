-- A legacy device could extend an already committed request after localStorage failed.
-- Keep the original hash guard. Reconcile a narrow, non-financial batch under a new,
-- durable request ID and compare records while holding the normal mutation lock.
CREATE SCHEMA IF NOT EXISTS gwcc_private;
REVOKE ALL ON SCHEMA gwcc_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA gwcc_private TO authenticated;

CREATE TABLE IF NOT EXISTS gwcc_private.sync_recoveries (
  user_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  original_operation_id uuid NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,operation_id)
);
ALTER TABLE gwcc_private.sync_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gwcc_private.sync_recoveries FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS deny_direct_access ON gwcc_private.sync_recoveries;
CREATE POLICY deny_direct_access ON gwcc_private.sync_recoveries USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION gwcc_private.reconcile_sync_operation(
  p_original_operation_id uuid, p_recovery_operation_id uuid, p_changes jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  original public.gwcc_applied_operations;
  recovered gwcc_private.sync_recoveries;
  checksum text := md5(jsonb_build_object('original',p_original_operation_id,'changes',p_changes)::text);
  c jsonb; doc jsonb; canonical jsonb; current_doc jsonb; receipt jsonb;
  t text; ident text; expected text; role_name text := public.current_user_role();
  matches_current boolean; matches_receipt boolean;
  remaining jsonb := '[]'; result jsonb := '[]';
BEGIN
  IF auth.uid() IS NULL OR role_name IS NULL OR role_name IN ('disabled','anon','member') THEN
    RAISE EXCEPTION 'Staff authorization is required' USING ERRCODE='42501';
  END IF;
  IF p_original_operation_id IS NULL OR p_recovery_operation_id IS NULL
    OR p_original_operation_id=p_recovery_operation_id
    OR jsonb_typeof(p_changes) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid recovery request';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_changes) pending(change)
    WHERE pending.change->>'table' IS NULL OR pending.change->>'table' NOT IN ('members','settings')
      OR pending.change->>'operation' IS DISTINCT FROM 'upsert'
      OR pending.change->>'id' IS NULL OR length(pending.change->>'id') NOT BETWEEN 1 AND 100
      OR jsonb_typeof(pending.change->'record') IS DISTINCT FROM 'object'
      OR pending.change->'record'->>'id' IS DISTINCT FROM pending.change->>'id') THEN
    RAISE EXCEPTION 'Automatic recovery supports member and settings saves only. Export this pending batch for review; financial and other changes have been retained.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_changes) pending(change) GROUP BY pending.change->>'table',pending.change->>'id' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Duplicate records in recovery request';
  END IF;
  -- Check current permissions even when returning a previously committed recovery.
  FOR t IN SELECT DISTINCT value->>'table' FROM jsonb_array_elements(p_changes) LOOP
    IF NOT public.gwcc_can_write(t) THEN
      RAISE EXCEPTION 'Not authorized to change %',t USING ERRCODE='42501';
    END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('gwcc-money'));
  SELECT * INTO recovered FROM gwcc_private.sync_recoveries
    WHERE user_id=auth.uid() AND operation_id=p_recovery_operation_id;
  IF FOUND THEN
    IF recovered.request_hash<>checksum OR recovered.original_operation_id<>p_original_operation_id THEN
      RAISE EXCEPTION 'Recovery request ID was reused with different data';
    END IF;
    RETURN recovered.result;
  END IF;
  IF EXISTS (SELECT 1 FROM public.gwcc_applied_operations WHERE user_id=auth.uid() AND operation_id=p_recovery_operation_id) THEN
    RAISE EXCEPTION 'Recovery request ID is already in use';
  END IF;
  SELECT * INTO original FROM public.gwcc_applied_operations
    WHERE user_id=auth.uid() AND operation_id=p_original_operation_id;
  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(original.result) r
      WHERE r->>'table' NOT IN ('members','settings') OR r->>'deleted'='true')
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(original.result) r
        JOIN jsonb_array_elements(p_changes) pending(change) ON r->>'table'=pending.change->>'table' AND r->'record'->>'id'=pending.change->>'id') THEN
      RAISE EXCEPTION 'The saved cloud request does not match this recovery. Export pending changes for review.';
    END IF;
  END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    t:=c->>'table'; ident:=c->>'id'; doc:=c->'record'; expected:=c->>'expected_updated_at';
    EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 FOR UPDATE',t) INTO current_doc USING ident;
    SELECT value->'record' INTO receipt FROM jsonb_array_elements(COALESCE(original.result,'[]'))
      WHERE value->>'table'=t AND value->'record'->>'id'=ident;
    -- Match only supplied, persisted fields, after the same PostgreSQL type conversion
    -- as an ordinary save. updated_at and member_id belong to the server.
    EXECUTE format('SELECT to_jsonb(jsonb_populate_record(NULL::public.%I,$1))',t) INTO canonical USING doc;
    SELECT COALESCE(bool_and(current_doc->k.key IS NOT DISTINCT FROM canonical->k.key),true),
      COALESCE(bool_and(receipt->k.key IS NOT DISTINCT FROM canonical->k.key),true)
      INTO matches_current,matches_receipt
      FROM jsonb_object_keys(doc) k(key)
      JOIN information_schema.columns co ON co.table_schema='public' AND co.table_name=t AND co.column_name=k.key
      WHERE k.key<>'updated_at' AND (t<>'members' OR k.key<>'member_id');
    IF (current_doc IS NOT NULL AND matches_current) OR (receipt IS NOT NULL AND matches_receipt) THEN
      -- A confirmed change is never replayed, including when another device has since
      -- edited or deleted it. Return current state so the page cannot resurrect it.
      result:=result||jsonb_build_array(CASE WHEN current_doc IS NULL THEN
        jsonb_build_object('table',t,'id',ident,'deleted',true)
        ELSE jsonb_build_object('table',t,'record',current_doc) END);
      CONTINUE;
    END IF;
    IF current_doc IS NULL THEN
      IF receipt IS NOT NULL OR expected IS NOT NULL THEN
        RAISE EXCEPTION 'Sync conflict: % record % was removed. Pending changes were retained; export them for review.',t,ident USING ERRCODE='40001';
      END IF;
    ELSIF expected IS NULL OR expected::timestamptz IS DISTINCT FROM (current_doc->>'updated_at')::timestamptz THEN
      RAISE EXCEPTION 'Sync conflict: % record % differs from the cloud. Pending changes were retained; export them for review.',t,ident USING ERRCODE='40001';
    END IF;
    remaining:=remaining||jsonb_build_array(c);
  END LOOP;
  IF jsonb_array_length(remaining)>0 THEN
    -- Keep all outstanding changes atomic and retain the ordinary validation/audit path.
    result:=result||public.gwcc_apply_mutations(p_recovery_operation_id,remaining);
  ELSE
    INSERT INTO public.gwcc_applied_operations(user_id,operation_id,request_hash,result)
      VALUES(auth.uid(),p_recovery_operation_id,md5(p_changes::text),result);
  END IF;
  INSERT INTO gwcc_private.sync_recoveries(user_id,operation_id,original_operation_id,request_hash,result)
    VALUES(auth.uid(),p_recovery_operation_id,p_original_operation_id,checksum,result);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION gwcc_private.reconcile_sync_operation(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION gwcc_private.reconcile_sync_operation(uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.gwcc_reconcile_sync_operation(
  p_original_operation_id uuid, p_recovery_operation_id uuid, p_changes jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT gwcc_private.reconcile_sync_operation(p_original_operation_id,p_recovery_operation_id,p_changes);
$$;
REVOKE ALL ON FUNCTION public.gwcc_reconcile_sync_operation(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gwcc_reconcile_sync_operation(uuid,uuid,jsonb) TO authenticated;
