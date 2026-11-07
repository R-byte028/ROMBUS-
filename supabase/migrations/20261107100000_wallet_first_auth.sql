-- ROMBUS wallet-first merchant authentication foundation.
-- Adds a short-lived, single-use SIWE challenge store and wallet identity fields.
-- No existing auth users or payment records are deleted or rewritten.

alter table public.merchant_profiles
  add column if not exists wallet_address text,
  add column if not exists wallet_chain_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'merchant_profiles_wallet_address_format'
      and conrelid = 'public.merchant_profiles'::regclass
  ) then
    alter table public.merchant_profiles
      add constraint merchant_profiles_wallet_address_format
      check (wallet_address is null or wallet_address ~ '^0x[a-fA-F0-9]{40}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'merchant_profiles_wallet_chain_id_positive'
      and conrelid = 'public.merchant_profiles'::regclass
  ) then
    alter table public.merchant_profiles
      add constraint merchant_profiles_wallet_chain_id_positive
      check (wallet_chain_id is null or wallet_chain_id > 0);
  end if;
end $$;

create unique index if not exists merchant_profiles_wallet_address_unique_idx
  on public.merchant_profiles (lower(wallet_address))
  where wallet_address is not null;

create table if not exists public.wallet_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null check (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
  chain_id bigint not null check (chain_id > 0),
  nonce text not null unique check (char_length(nonce) between 16 and 64),
  domain text not null check (char_length(domain) between 1 and 255),
  uri text not null check (char_length(uri) between 1 and 500),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wallet_auth_challenges_expiry_idx
  on public.wallet_auth_challenges (expires_at);

alter table public.wallet_auth_challenges enable row level security;
revoke all on public.wallet_auth_challenges from public, anon, authenticated;
grant all on public.wallet_auth_challenges to service_role;
