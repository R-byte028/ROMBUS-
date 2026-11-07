revoke execute on function public.create_public_payment_attempt(uuid, text, text, text) from anon, authenticated;
revoke execute on function public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz) from anon, authenticated;
revoke execute on function public.fail_public_payment_attempt(uuid, text) from anon, authenticated;
revoke execute on function public.apply_public_payment_status(uuid, text) from anon, authenticated;

grant execute on function public.create_public_payment_attempt(uuid, text, text, text) to service_role;
grant execute on function public.store_public_payment_quote(uuid, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.fail_public_payment_attempt(uuid, text) to service_role;
grant execute on function public.apply_public_payment_status(uuid, text) to service_role;

revoke execute on function public.get_public_payment_request(uuid) from public;
grant execute on function public.get_public_payment_request(uuid) to anon, authenticated;
revoke execute on function public.get_public_payment_attempt(uuid) from public;
grant execute on function public.get_public_payment_attempt(uuid) to anon, authenticated;
