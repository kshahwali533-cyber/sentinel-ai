create table public.account_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null default 'beta' check (plan_code = 'beta'),
  status text not null default 'active' check (status in ('active','suspended')),
  monthly_scan_limit integer not null default 100 check (monthly_scan_limit between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('scan.completed','report.generated','mentor.used')),
  units smallint not null default 1 check (units between 1 and 100),
  resource_host text check (resource_host is null or char_length(resource_host) <= 253),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index usage_events_user_time_idx
  on public.usage_events(user_id, occurred_at desc);
create index usage_events_type_time_idx
  on public.usage_events(event_type, occurred_at desc);
create index account_entitlements_status_idx
  on public.account_entitlements(status);

alter table public.account_entitlements enable row level security;
alter table public.usage_events enable row level security;
revoke all on public.account_entitlements from anon, authenticated;
revoke all on public.usage_events from anon, authenticated;
grant select on public.account_entitlements to authenticated;
grant select on public.usage_events to authenticated;
grant all on public.account_entitlements to service_role;
grant all on public.usage_events to service_role;

create policy "Users can view own entitlement"
  on public.account_entitlements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can view own usage events"
  on public.usage_events for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.create_default_account_entitlement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  insert into public.account_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

revoke all on function private.create_default_account_entitlement() from public, anon, authenticated;

drop trigger if exists create_default_account_entitlement on auth.users;
create trigger create_default_account_entitlement
after insert on auth.users
for each row execute function private.create_default_account_entitlement();

insert into public.account_entitlements(user_id)
select id from auth.users
on conflict (user_id) do nothing;
