alter table public.payment_attempts
  add column if not exists provider_signature text,
  add column if not exists provider_timestamp timestamptz,
  add column if not exists provider_response jsonb,
  add column if not exists provider_status_response jsonb;

drop function if exists public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz);
create function public.store_public_payment_quote(
  p_attempt_id uuid,
  p_provider_quote_id text,
  p_source_amount_atomic text,
  p_destination_amount_atomic text,
  p_deposit_address text,
  p_deposit_memo text,
  p_provider_deadline timestamptz,
  p_provider_response jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_request_id uuid;
begin
  if p_provider_quote_id is null or char_length(p_provider_quote_id) not between 1 and 200 then
    raise exception 'invalid_provider_quote_id';
  end if;
  if p_source_amount_atomic is null or p_source_amount_atomic !~ '^[0-9]+$'
    or p_destination_amount_atomic is null or p_destination_amount_atomic !~ '^[0-9]+$' then
    raise exception 'invalid_atomic_amount';
  end if;
  if p_deposit_address is null or char_length(p_deposit_address) not between 2 and 300 then
    raise exception 'invalid_deposit_address';
  end if;
  if p_deposit_memo is not null and char_length(p_deposit_memo) > 300 then
    raise exception 'invalid_deposit_memo';
  end if;
  if p_provider_deadline is null or p_provider_deadline <= now() then
    raise exception 'provider_quote_expired';
  end if;
  if p_provider_response is null
    or jsonb_typeof(p_provider_response) <> 'object'
    or p_provider_response->>'correlationId' <> p_provider_quote_id
    or coalesce(p_provider_response->>'signature', '') = ''
    or jsonb_typeof(p_provider_response->'quote') <> 'object'
    or pg_column_size(p_provider_response) > 32768 then
    raise exception 'invalid_provider_quote_response';
  end if;

  update public.payment_attempts a
  set provider_quote_id = p_provider_quote_id,
      provider_signature = p_provider_response->>'signature',
      provider_timestamp = nullif(p_provider_response->>'timestamp', '')::timestamptz,
      provider_response = p_provider_response,
      source_amount_atomic = p_source_amount_atomic::numeric,
      destination_amount_atomic = p_destination_amount_atomic::numeric,
      deposit_address = p_deposit_address,
      deposit_memo = p_deposit_memo,
      provider_deadline = p_provider_deadline,
      provider_status = 'PENDING_DEPOSIT',
      status = 'pending_deposit',
      updated_at = now()
  where a.id = p_attempt_id
    and a.status = 'pending'
    and a.provider_quote_id is null
    and exists (
      select 1 from public.payment_requests r
      where r.id = a.payment_request_id
        and r.status = 'open'
        and (r.expires_at is null or r.expires_at > now())
    )
  returning a.payment_request_id into v_request_id;

  if v_request_id is null then return false; end if;
  insert into public.payment_events (payment_request_id, payment_attempt_id, event_type, provider_status)
  values (v_request_id, p_attempt_id, 'executable_quote_created', 'PENDING_DEPOSIT');
  return true;
end;
$$;

drop function if exists public.apply_public_payment_status(uuid, text);
create function public.apply_public_payment_status(
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
  if v_next_status is null then raise exception 'unsupported_provider_status'; end if;
  if p_provider_response is null
    or jsonb_typeof(p_provider_response) <> 'object'
    or p_provider_response->>'status' <> p_provider_status
    or pg_column_size(p_provider_response) > 32768 then
    raise exception 'invalid_provider_status_response';
  end if;

  select a.payment_request_id, a.status into v_request_id, v_current_status
  from public.payment_attempts a where a.id = p_attempt_id for update;
  if not found then raise exception 'payment_attempt_not_found'; end if;
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
  if v_next_rank < v_current_rank then return v_current_status; end if;

  update public.payment_attempts
  set status = v_next_status,
      provider_status = p_provider_status,
      provider_status_response = p_provider_response,
      completed_at = case when v_next_rank = 4 then now() else completed_at end,
      updated_at = now()
  where id = p_attempt_id;

  insert into public.payment_events (payment_request_id, payment_attempt_id, event_type, provider_status, details)
  values (v_request_id, p_attempt_id, 'provider_status_updated', p_provider_status,
    jsonb_build_object('correlationId', p_provider_response->>'correlationId'));

  if p_provider_status = 'SUCCESS' then
    update public.payment_requests set status = 'paid' where id = v_request_id;
  end if;
  return v_next_status;
end;
$$;

revoke all on function public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz, jsonb) from public;
revoke all on function public.apply_public_payment_status(uuid, text, jsonb) from public;
grant execute on function public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz, jsonb) to service_role;
grant execute on function public.apply_public_payment_status(uuid, text, jsonb) to service_role;
