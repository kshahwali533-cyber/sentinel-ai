create table public.organization_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  monitoring_site_id uuid not null references public.monitoring_sites(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, monitoring_site_id)
);

create index organization_assets_site_idx
  on public.organization_assets(monitoring_site_id);
create index organization_assets_org_created_idx
  on public.organization_assets(organization_id, created_at desc);

alter table public.organization_assets enable row level security;
revoke all on public.organization_assets from anon, authenticated;
grant select on public.organization_assets to authenticated;
grant all on public.organization_assets to service_role;

create policy "Organization members can view shared assets"
  on public.organization_assets for select to authenticated
  using (private.is_organization_member(organization_id));
