-- Keep merchant wallet identity server-managed.
-- Authenticated merchants may edit ordinary profile fields, but cannot insert/update
-- wallet_address or wallet_chain_id without completing the server-side SIWE flow.

revoke insert, update on table public.merchant_profiles
  from public, anon, authenticated;

grant insert (id, display_name, business_name, website_url)
  on table public.merchant_profiles to authenticated;

grant update (display_name, business_name, website_url, updated_at)
  on table public.merchant_profiles to authenticated;

-- Explicitly document that wallet identity columns remain unavailable to client roles.
revoke insert (wallet_address, wallet_chain_id),
       update (wallet_address, wallet_chain_id)
  on table public.merchant_profiles
  from public, anon, authenticated;
