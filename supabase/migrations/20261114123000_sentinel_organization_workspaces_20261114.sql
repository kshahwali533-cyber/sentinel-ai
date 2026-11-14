create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','analyst')),
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  role text not null default 'member' check (role in ('admin','member','analyst')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.organization_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 80),
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members(user_id, organization_id);
create index organization_invitations_org_idx on public.organization_invitations(organization_id, created_at desc);
create index organization_invitations_expiry_idx on public.organization_invitations(expires_at) where accepted_at is null;
create index organization_audit_events_org_idx on public.organization_audit_events(organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_audit_events enable row level security;

revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_members from anon, authenticated;
revoke all on public.organization_invitations from anon, authenticated;
revoke all on public.organization_audit_events from anon, authenticated;
grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.organization_invitations to authenticated;
grant select on public.organization_audit_events to authenticated;
grant all on public.organizations to service_role;
grant all on public.organization_members to service_role;
grant all on public.organization_invitations to service_role;
grant all on public.organization_audit_events to service_role;

create policy "Members can view their organizations"
  on public.organizations for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = id and m.user_id = (select auth.uid())
  ));

create policy "Members can view organization membership"
  on public.organization_members for select to authenticated
  using (exists (
    select 1 from public.organization_members mine
    where mine.organization_id = organization_id
      and mine.user_id = (select auth.uid())
  ));

create policy "Invited users can view their invitations"
  on public.organization_invitations for select to authenticated
  using (lower(email) = lower((select auth.jwt() ->> 'email')));

create policy "Members can view organization audit events"
  on public.organization_audit_events for select to authenticated
  using (exists (
    select 1 from public.organization_members mine
    where mine.organization_id = organization_id
      and mine.user_id = (select auth.uid())
  ));
