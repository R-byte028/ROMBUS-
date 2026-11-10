-- Bind wallet-link challenges to the merchant session that requested them.
alter table public.wallet_auth_challenges
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wallet_auth_challenges_purpose_user_consistency'
      and conrelid = 'public.wallet_auth_challenges'::regclass
  ) then
    alter table public.wallet_auth_challenges
      add constraint wallet_auth_challenges_purpose_user_consistency
      check (
        (purpose = 'login' and user_id is null)
        or (purpose = 'link' and user_id is not null)
      );
  end if;
end $$;
