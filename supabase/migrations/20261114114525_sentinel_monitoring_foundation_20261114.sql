create table public.monitoring_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null check (char_length(url) between 8 and 2048),
  hostname text not null check (char_length(hostname) between 1 and 253),
  verification_token text not null check (char_length(verification_token) between 32 and 128),
  verified_at timestamptz,
  status text not null default 'pending' check (status in ('pending','active','paused')),
  scan_interval_days smallint not null default 1 check (scan_interval_days = 1),
  next_scan_at timestamptz,
  last_scan_at timestamptz,
  last_score smallint check (last_score between 0 and 100),
  last_risk_level text,
  last_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, hostname)
);

create table public.monitoring_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.monitoring_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('running','succeeded','failed')),
  score smallint check (score between 0 and 100),
  risk_level text,
  result jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.monitoring_alerts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.monitoring_sites(id) on delete cascade,
  run_id uuid references public.monitoring_runs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null,
  severity text not null check (severity in ('info','low','medium','high','critical')),
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 2000),
  details jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index monitoring_sites_due_idx
  on public.monitoring_sites (next_scan_at)
  where status = 'active' and verified_at is not null;
create index monitoring_sites_owner_idx
  on public.monitoring_sites (user_id, created_at desc);
create index monitoring_runs_owner_idx
  on public.monitoring_runs (user_id, created_at desc);
create index monitoring_runs_site_idx
  on public.monitoring_runs (site_id, created_at desc);
create index monitoring_alerts_owner_idx
  on public.monitoring_alerts (user_id, is_read, created_at desc);

alter table public.monitoring_sites enable row level security;
alter table public.monitoring_runs enable row level security;
alter table public.monitoring_alerts enable row level security;

revoke all on public.monitoring_sites from anon, authenticated;
revoke all on public.monitoring_runs from anon, authenticated;
revoke all on public.monitoring_alerts from anon, authenticated;
grant select on public.monitoring_sites to authenticated;
grant select on public.monitoring_runs to authenticated;
grant select on public.monitoring_alerts to authenticated;
grant all on public.monitoring_sites to service_role;
grant all on public.monitoring_runs to service_role;
grant all on public.monitoring_alerts to service_role;

create policy "Owners can view monitored sites"
  on public.monitoring_sites for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Owners can view monitoring runs"
  on public.monitoring_runs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Owners can view monitoring alerts"
  on public.monitoring_alerts for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.claim_due_monitoring_sites(p_limit integer default 5)
returns table (
  site_id uuid,
  owner_id uuid,
  target_url text,
  prior_result jsonb,
  prior_score integer,
  prior_risk_level text
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  return query
  with due as (
    select s.id
    from public.monitoring_sites as s
    where s.status = 'active'
      and s.verified_at is not null
      and s.next_scan_at is not null
      and s.next_scan_at <= pg_catalog.now()
    order by s.next_scan_at asc
    limit least(greatest(coalesce(p_limit, 5), 1), 10)
    for update skip locked
  )
  update public.monitoring_sites as s
  set next_scan_at = pg_catalog.now() + interval '30 minutes',
      updated_at = pg_catalog.now()
  from due
  where s.id = due.id
  returning s.id, s.user_id, s.url, s.last_result,
            s.last_score::integer, s.last_risk_level;
end;
$function$;

revoke all on function public.claim_due_monitoring_sites(integer) from public, anon, authenticated;
grant execute on function public.claim_due_monitoring_sites(integer) to service_role;
