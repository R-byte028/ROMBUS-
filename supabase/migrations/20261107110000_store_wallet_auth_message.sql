-- Store the exact server-issued SIWE payload so verification is against the
-- original, host-bound challenge rather than client-reconstructed fields.
alter table public.wallet_auth_challenges
  add column if not exists message text not null default '';

alter table public.wallet_auth_challenges
  add constraint wallet_auth_challenges_message_length
  check (char_length(message) between 1 and 4000);
