-- Store the exact server-issued SIWE payload so verification is against the
-- original, host-bound challenge rather than client-reconstructed fields.
alter table public.wallet_auth_challenges
  add column if not exists message text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wallet_auth_challenges_message_length'
      and conrelid = 'public.wallet_auth_challenges'::regclass
  ) then
    alter table public.wallet_auth_challenges
      add constraint wallet_auth_challenges_message_length
      check (char_length(message) between 1 and 4000);
  end if;
end $$;

-- Used to bind wallet-link challenges to an existing merchant session.
create index if not exists wallet_auth_challenges_user_id_idx
  on public.wallet_auth_challenges (user_id)
  where user_id is not null;
