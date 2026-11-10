revoke execute on function public.get_public_payment_request(uuid) from authenticated;
revoke execute on function public.get_active_public_payment_attempt(uuid) from authenticated;

revoke execute on function public.get_public_payment_attempt(uuid) from public, anon, authenticated;
grant execute on function public.get_public_payment_attempt(uuid) to service_role;
