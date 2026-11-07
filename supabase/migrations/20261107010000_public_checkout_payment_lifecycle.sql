-- Public checkout and server-controlled payment-attempt lifecycle.
-- Public identifiers are random UUID capabilities; no broad table SELECT policy is added.

create or replace function public.get_public_payment_request(p_public_id uuid)
returns table (
  public_id uuid, title text, description text, amount_atomic text,
  destination_asset_id text, destination_symbol text, destination_chain text,
  recipient_address text, merchant_name text, status text, expires_at timestamptz
)
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select r.public_id, r.title, r.description, r.amount_atomic::text,
    r.destination_asset_id, r.destination_symbol, r.destination_chain,
    r.recipient_address,
    coalesce(nullif(mp.business_name, ''), nullif(mp.display_name, ''), 'ROMBUS merchant'),
    r.status, r.expires_at
  from public.payment_requests r
  left join public.merchant_profiles mp on mp.id = r.merchant_id
  where r.public_id = p_public_id and r.status = 'open'
    and (r.expires_at is null or r.expires_at > now())
  limit 1;
end;
$$;

create or replace function public.create_public_payment_attempt(
  p_public_id uuid, p_source_asset_id text, p_refund_address text, p_payer_wallet_address text default null
)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.payment_requests%rowtype;
  v_attempt_id uuid;
begin
  if p_source_asset_id is null or char_length(p_source_asset_id) not between 1 and 300 then
    raise exception 'invalid_source_asset';
  end if;
  if p_refund_address is null or char_length(p_refund_address) not between 2 and 200 then
    raise exception 'invalid_refund_address';
  end if;
  if p_payer_wallet_address is not null and char_length(p_payer_wallet_address) > 200 then
    raise exception 'invalid_payer_wallet';
  end if;

  select * into v_request from public.payment_requests where public_id = p_public_id for update;
  if not found or v_request.status <> 'open' or (v_request.expires_at is not null and v_request.expires_at <= now()) then
    raise exception 'payment_request_unavailable';
  end if;

  if exists (
    select 1 from public.payment_attempts a
    where a.payment_request_id = v_request.id
      and a.status in ('pending', 'pending_deposit', 'known_deposit_tx', 'processing')
      and (a.provider_deadline > now() or (a.provider_deadline is null and a.created_at > now() - interval '5 minutes'))
  ) then
    raise exception 'payment_attempt_in_progress';
  end if;

  insert into public.payment_attempts (
    payment_request_id, payer_wallet_address, source_asset_id, destination_asset_id, refund_address, status
  ) values (
    v_request.id, p_payer_wallet_address, p_source_asset_id, v_request.destination_asset_id, p_refund_address, 'pending'
  ) returning id into v_attempt_id;

  insert into public.payment_events (payment_request_id, payment_attempt_id, event_type, details)
  values (v_request.id, v_attempt_id, 'attempt_created', jsonb_build_object('sourceAssetId', p_source_asset_id));
  return v_attempt_id;
end;
$$;

create or replace function public.store_public_payment_quote(
  p_attempt_id uuid, p_provider_quote_id text, p_source_amount_atomic text,
  p_destination_amount_atomic text, p_deposit_address text, p_deposit_memo text, p_provider_deadline timestamptz
)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id uuid;
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

  update public.payment_attempts a
  set provider_quote_id = p_provider_quote_id,
    source_amount_atomic = p_source_amount_atomic::numeric,
    destination_amount_atomic = p_destination_amount_atomic::numeric,
    deposit_address = p_deposit_address,
    deposit_memo = p_deposit_memo,
    provider_deadline = p_provider_deadline,
    provider_status = 'PENDING_DEPOSIT',
    status = 'pending_deposit',
    updated_at = now()
  where a.id = p_attempt_id and a.status = 'pending' and a.provider_quote_id is null
  returning a.payment_request_id into v_request_id;

  if v_request_id is null then return false; end if;
  insert into public.payment_events (payment_request_id, payment_attempt_id, event_type, provider_status)
  values (v_request_id, p_attempt_id, 'executable_quote_created', 'PENDING_DEPOSIT');
  return true;
end;
$$;

create or replace function public.fail_public_payment_attempt(p_attempt_id uuid, p_reason text default 'quote_failed')
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_request_id uuid;
begin
  update public.payment_attempts a
  set status = 'failed', provider_status = 'QUOTE_FAILED', updated_at = now()
  where a.id = p_attempt_id and a.status = 'pending' and a.provider_quote_id is null
  returning a.payment_request_id into v_request_id;
  if v_request_id is null then return false; end if;

  insert into public.payment_events (payment_request_id, payment_attempt_id, event_type, provider_status, details)
  values (v_request_id, p_attempt_id, 'quote_failed', 'QUOTE_FAILED',
    jsonb_build_object('reason', left(coalesce(p_reason, 'quote_failed'), 80)));
  return true;
end;
$$;

create or replace function public.get_public_payment_attempt(p_attempt_id uuid)
returns table (
  id uuid, status text, provider_status text, source_asset_id text,
  source_amount_atomic text, destination_amount_atomic text,
  deposit_address text, deposit_memo text, provider_deadline timestamptz,
  created_at timestamptz, completed_at timestamptz
)
language sql security definer
set search_path = pg_catalog, public
as $$
  select a.id, a.status, a.provider_status, a.source_asset_id,
    a.source_amount_atomic::text, a.destination_amount_atomic::text,
    a.deposit_address, a.deposit_memo, a.provider_deadline, a.created_at, a.completed_at
  from public.payment_attempts a where a.id = p_attempt_id limit 1;
$$;

create or replace function public.apply_public_payment_status(p_attempt_id uuid, p_provider_status text)
returns text
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id uuid;
  v_current_status text;
  v_next_status text;
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

  select a.payment_request_id, a.status into v_request_id, v_current_status
  from public.payment_attempts a where a.id = p_attempt_id for update;
  if not found then raise exception 'payment_attempt_not_found'; end if;
  if v_current_status in ('completed', 'incomplete_deposit', 'expired', 'failed', 'refunded') then
    return v_current_status;
  end if;

  update public.payment_attempts
  set status = v_next_status, provider_status = p_provider_status,
    completed_at = case when v_next_status in ('completed', 'incomplete_deposit', 'expired', 'failed', 'refunded') then now() else completed_at end,
    updated_at = now()
  where id = p_attempt_id;

  insert into public.payment_events (payment_request_id, payment_attempt_id, event_type, provider_status)
  values (v_request_id, p_attempt_id, 'provider_status_updated', p_provider_status);

  if p_provider_status = 'SUCCESS' then
    update public.payment_requests set status = 'paid' where id = v_request_id;
  end if;
  return v_next_status;
end;
$$;

revoke all on function public.get_public_payment_request(uuid) from public;
revoke all on function public.create_public_payment_attempt(uuid, text, text, text) from public;
revoke all on function public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz) from public;
revoke all on function public.fail_public_payment_attempt(uuid, text) from public;
revoke all on function public.get_public_payment_attempt(uuid) from public;
revoke all on function public.apply_public_payment_status(uuid, text) from public;

grant execute on function public.get_public_payment_request(uuid) to anon, authenticated;
grant execute on function public.create_public_payment_attempt(uuid, text, text, text) to anon, authenticated;
grant execute on function public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.fail_public_payment_attempt(uuid, text) to anon, authenticated;
grant execute on function public.get_public_payment_attempt(uuid) to anon, authenticated;
grant execute on function public.apply_public_payment_status(uuid, text) to anon, authenticated;
