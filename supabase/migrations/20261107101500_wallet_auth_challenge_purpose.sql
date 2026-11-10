-- Distinguish wallet sign-in challenges from wallet-linking challenges.
alter table public.wallet_auth_challenges
  add column if not exists purpose text not null default 'login'
  check (purpose in ('login', 'link'));