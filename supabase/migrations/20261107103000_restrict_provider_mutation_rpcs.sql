-- Keep provider-controlled payment mutations server-only.
revoke all on function public.apply_public_payment_status(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_public_payment_status(uuid, text, jsonb) to service_role;

revoke all on function public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz, jsonb) to service_role;
