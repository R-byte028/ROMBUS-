-- Bind provider status updates to the original 1Click quote embedded in the status response.
-- The status envelope has its own correlationId; quoteResponse.correlationId identifies the
-- original quote and is the value persisted as payment_attempts.provider_quote_id.
create or replace function public.apply_public_payment_status(
  p_attempt_id uuid,
  p_provider_status text,
  p_provider_response jsonb
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id uuid;
  v_provider_quote_id text;
  v_current_status text;
  v_next_status text;
  v_current_rank integer;
  v_next_rank integer;
begin
  v_next_status := case p_provider_status
    when 'PENDING_DEPOSIT' then 'pending_deposit'
    when 'KNOWN_DEPOSIT_TX' then 'known_deposit_tx'
    when 'PROCESSING' then 'processing'
    when 'SUCCESS' then 'completed'
    when 'INCOMPLETE_DEPOSIT' then 'incomplete_deposit'
    when 'REFUNDED' then 'refunded'
    when 'FAILED' then 'failed'
    when 'EXPIRED' then 'expired'
    else null
  end;

  if v_next_status is null then
    raise exception 'unsupported_provider_status';
  end if;

  if p_provider_response is null
    or jsonb_typeof(p_provider_response) <> 'object'
    or p_provider_response->>'status' is distinct from p_provider_status
    or jsonb_typeof(p_provider_response->'quoteResponse') <> 'object'
    or coalesce(p_provider_response #>> '{quoteResponse,correlationId}', '') = ''
    or pg_column_size(p_provider_response) > 32768 then
    raise exception 'invalid_provider_status_response';
  end if;

  select a.payment_request_id, a.provider_quote_id, a.status
    into v_request_id, v_provider_quote_id, v_current_status
  from public.payment_attempts a
  where a.id = p_attempt_id
  for update;

  if not found then
    raise exception 'payment_attempt_not_found';
  end if;

  if v_provider_quote_id is null
    or (p_provider_response #>> '{quoteResponse,correlationId}') is distinct from v_provider_quote_id then
    raise exception 'provider_correlation_id_mismatch';
  end if;

  if v_current_status in ('completed', 'incomplete_deposit', 'expired', 'failed', 'refunded') then
    return v_current_status;
  end if;

  v_current_rank := case v_current_status
    when 'pending' then 0
    when 'pending_deposit' then 1
    when 'known_deposit_tx' then 2
    when 'processing' then 3
    else 4
  end;
  v_next_rank := case v_next_status
    when 'pending_deposit' then 1
    when 'known_deposit_tx' then 2
    when 'processing' then 3
    else 4
  end;

  if v_next_rank < v_current_rank then
    return v_current_status;
  end if;

  if v_next_rank = v_current_rank and v_next_status = v_current_status then
    update public.payment_attempts
    set provider_status_response = p_provider_response,
        updated_at = now()
    where id = p_attempt_id;
    return v_current_status;
  end if;

  update public.payment_attempts
  set status = v_next_status,
      provider_status = p_provider_status,
      provider_status_response = p_provider_response,
      completed_at = case when v_next_rank = 4 then now() else completed_at end,
      updated_at = now()
  where id = p_attempt_id;

  insert into public.payment_events (
    payment_request_id, payment_attempt_id, event_type, provider_status, details
  )
  values (
    v_request_id, p_attempt_id, 'provider_status_updated', p_provider_status,
    jsonb_build_object('quoteCorrelationId', p_provider_response #>> '{quoteResponse,correlationId}')
  );

  if p_provider_status = 'SUCCESS' then
    update public.payment_requests
    set status = 'paid'
    where id = v_request_id;
  end if;

  return v_next_status;
end;
$$;

revoke all on function public.apply_public_payment_status(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_public_payment_status(uuid, text, jsonb) to service_role;
