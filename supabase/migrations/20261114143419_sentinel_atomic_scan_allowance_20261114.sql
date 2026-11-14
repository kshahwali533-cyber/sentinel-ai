-- Reserve monthly scan allowance atomically so concurrent requests cannot exceed the beta limit.
-- Reservations expire after 15 minutes if a serverless invocation is interrupted.

create table if not exists private.scan_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.scan_usage_reservations from public, anon, authenticated, service_role;

create index if not exists scan_usage_reservations_user_created_idx
  on private.scan_usage_reservations (user_id, created_at desc);

create or replace function public.reserve_scan_allowance(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_limit integer;
  v_status text;
  v_used bigint;
  v_reserved bigint;
  v_reservation_id uuid;
  v_month_start timestamptz;
begin
  if p_user_id is null then
    return null;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select e.monthly_scan_limit, e.status
    into v_limit, v_status
    from public.account_entitlements e
    where e.user_id = p_user_id;

  if not found then
    v_limit := 100;
    v_status := 'active';
  end if;

  if v_status <> 'active' then
    return null;
  end if;

  v_month_start :=
    pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'utc')
    at time zone 'utc';

  delete from private.scan_usage_reservations r
    where r.user_id = p_user_id
      and r.created_at < pg_catalog.now() - interval '15 minutes';

  select count(*) into v_used
    from public.usage_events e
    where e.user_id = p_user_id
      and e.event_type = 'scan.completed'
      and e.occurred_at >= v_month_start;

  select count(*) into v_reserved
    from private.scan_usage_reservations r
    where r.user_id = p_user_id
      and r.created_at >= pg_catalog.now() - interval '15 minutes';

  if v_used + v_reserved >= v_limit then
    return null;
  end if;

  insert into private.scan_usage_reservations (user_id)
    values (p_user_id)
    returning id into v_reservation_id;

  return v_reservation_id;
end;
$function$;

create or replace function public.complete_scan_allowance(
  p_reservation_id uuid,
  p_resource_host text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
begin
  select r.user_id into v_user_id
    from private.scan_usage_reservations r
    where r.id = p_reservation_id;

  if v_user_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  delete from private.scan_usage_reservations r
    where r.id = p_reservation_id
    returning r.user_id into v_user_id;

  if v_user_id is null then
    return false;
  end if;

  insert into public.usage_events (
    user_id, event_type, resource_host, metadata
  ) values (
    v_user_id,
    'scan.completed',
    pg_catalog.left(p_resource_host, 253),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return true;
end;
$function$;

create or replace function public.cancel_scan_allowance(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
begin
  select r.user_id into v_user_id
    from private.scan_usage_reservations r
    where r.id = p_reservation_id;

  if v_user_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  delete from private.scan_usage_reservations r
    where r.id = p_reservation_id;

  return true;
end;
$function$;

revoke all on function public.reserve_scan_allowance(uuid) from public, anon, authenticated;
revoke all on function public.complete_scan_allowance(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.cancel_scan_allowance(uuid) from public, anon, authenticated;

grant execute on function public.reserve_scan_allowance(uuid) to service_role;
grant execute on function public.complete_scan_allowance(uuid, text, jsonb) to service_role;
grant execute on function public.cancel_scan_allowance(uuid) to service_role;
