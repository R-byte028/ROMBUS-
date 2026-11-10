-- Shared, atomic API rate limits. Only hashed caller keys are stored.
create table if not exists public.api_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_started timestamptz;
  v_count integer;
  v_retry integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
    or p_limit < 1 or p_limit > 10000
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid_rate_limit_arguments';
  end if;

  insert into public.api_rate_limits (key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update
    set window_started_at = case
          when public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
            then v_now
          else public.api_rate_limits.window_started_at
        end,
        request_count = case
          when public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
            then 1
          else public.api_rate_limits.request_count + 1
        end,
        updated_at = v_now
  returning public.api_rate_limits.window_started_at, public.api_rate_limits.request_count
    into v_started, v_count;

  v_retry := greatest(1, ceil(extract(epoch from (v_started + make_interval(secs => p_window_seconds) - v_now)))::integer);
  return query select v_count <= p_limit, greatest(0, p_limit - v_count), v_retry;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
