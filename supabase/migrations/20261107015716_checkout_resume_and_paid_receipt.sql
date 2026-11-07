create or replace function public.get_public_payment_request(p_public_id uuid)
returns table (
  public_id uuid,
  title text,
  description text,
  amount_atomic text,
  destination_asset_id text,
  destination_symbol text,
  destination_chain text,
  recipient_address text,
  merchant_name text,
  status text,
  expires_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    r.public_id,
    r.title,
    r.description,
    r.amount_atomic::text,
    r.destination_asset_id,
    r.destination_symbol,
    r.destination_chain,
    r.recipient_address,
    coalesce(nullif(mp.business_name, ''), nullif(mp.display_name, ''), 'ROMBUS merchant'),
    case when r.status = 'open' and r.expires_at is not null and r.expires_at <= now() then 'expired' else r.status end,
    r.expires_at
  from public.payment_requests r
  left join public.merchant_profiles mp on mp.id = r.merchant_id
  where r.public_id = p_public_id
    and r.status in ('open', 'paid')
  limit 1;
$$;

create or replace function public.get_active_public_payment_attempt(p_public_id uuid)
returns table (
  id uuid,
  status text,
  provider_status text,
  source_asset_id text,
  source_amount_atomic text,
  destination_amount_atomic text,
  deposit_address text,
  deposit_memo text,
  provider_deadline timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    a.id,
    a.status,
    a.provider_status,
    a.source_asset_id,
    a.source_amount_atomic::text,
    a.destination_amount_atomic::text,
    a.deposit_address,
    a.deposit_memo,
    a.provider_deadline
  from public.payment_attempts a
  join public.payment_requests r on r.id = a.payment_request_id
  where r.public_id = p_public_id
    and r.status = 'open'
    and (r.expires_at is null or r.expires_at > now())
    and a.status in ('pending_deposit', 'known_deposit_tx', 'processing')
    and a.deposit_address is not null
    and a.provider_deadline > now()
  order by a.created_at desc
  limit 1;
$$;

revoke all on function public.get_public_payment_request(uuid) from public;
revoke all on function public.get_active_public_payment_attempt(uuid) from public;
grant execute on function public.get_public_payment_request(uuid) to anon, authenticated;
grant execute on function public.get_active_public_payment_attempt(uuid) to anon, authenticated;
