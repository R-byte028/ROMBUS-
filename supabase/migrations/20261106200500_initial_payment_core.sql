-- ROMBUS initial payment core
-- Applied to Supabase project qryajuwvvlpqcxeyhegf on 2026-11-06.

create table public.merchant_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  business_name text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  amount_atomic numeric(78,0) not null check (amount_atomic > 0),
  destination_asset_id text not null check (char_length(destination_asset_id) between 1 and 300),
  destination_symbol text check (destination_symbol is null or char_length(destination_symbol) <= 32),
  destination_chain text check (destination_chain is null or char_length(destination_chain) <= 80),
  recipient_address text not null check (char_length(recipient_address) between 2 and 200),
  status text not null default 'open'
    check (status in ('open', 'paid', 'cancelled', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_request_expiry_future check (expires_at is null or expires_at > created_at)
);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests(id) on delete restrict,
  payer_wallet_address text check (payer_wallet_address is null or char_length(payer_wallet_address) <= 200),
  source_asset_id text not null check (char_length(source_asset_id) between 1 and 300),
  source_amount_atomic numeric(78,0) check (source_amount_atomic is null or source_amount_atomic > 0),
  destination_asset_id text not null check (char_length(destination_asset_id) between 1 and 300),
  destination_amount_atomic numeric(78,0) check (destination_amount_atomic is null or destination_amount_atomic > 0),
  provider_quote_id text unique,
  provider_status text,
  status text not null default 'pending'
    check (status in ('pending', 'pending_deposit', 'known_deposit_tx', 'processing', 'completed', 'incomplete_deposit', 'expired', 'failed', 'refunded')),
  deposit_address text,
  deposit_memo text,
  refund_address text,
  provider_deadline timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_request_id uuid not null references public.payment_requests(id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  event_type text not null check (char_length(event_type) between 1 and 80),
  provider_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index payment_requests_merchant_created_idx on public.payment_requests (merchant_id, created_at desc);
create index payment_requests_status_expiry_idx on public.payment_requests (status, expires_at);
create index payment_attempts_request_created_idx on public.payment_attempts (payment_request_id, created_at desc);
create index payment_attempts_status_idx on public.payment_attempts (status, updated_at desc);
create index payment_events_request_created_idx on public.payment_events (payment_request_id, created_at desc);
create index payment_events_attempt_idx on public.payment_events (payment_attempt_id);

alter table public.merchant_profiles enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;

create policy "Merchants can read their own profile" on public.merchant_profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Merchants can create their own profile" on public.merchant_profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Merchants can update their own profile" on public.merchant_profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Merchants can read their own payment requests" on public.payment_requests
  for select to authenticated using ((select auth.uid()) = merchant_id);
create policy "Merchants can create open payment requests" on public.payment_requests
  for insert to authenticated with check ((select auth.uid()) = merchant_id and status = 'open');

create policy "Merchants can read attempts for their payment requests" on public.payment_attempts
  for select to authenticated using (
    exists (select 1 from public.payment_requests r
      where r.id = payment_request_id and r.merchant_id = (select auth.uid()))
  );
create policy "Merchants can read events for their payment requests" on public.payment_events
  for select to authenticated using (
    exists (select 1 from public.payment_requests r
      where r.id = payment_request_id and r.merchant_id = (select auth.uid()))
  );

grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.merchant_profiles to authenticated;
grant select, insert on public.payment_requests to authenticated;
grant select on public.payment_attempts, public.payment_events to authenticated;
grant all on public.merchant_profiles, public.payment_requests, public.payment_attempts, public.payment_events to service_role;
grant usage, select on sequence public.payment_events_id_seq to service_role;
