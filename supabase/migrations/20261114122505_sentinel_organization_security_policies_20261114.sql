create table public.organization_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  allow_member_invites boolean not null default true,
  allow_asset_sharing boolean not null default true,
  audit_export_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.organization_policies enable row level security;
revoke all on public.organization_policies from anon, authenticated;
grant select on public.organization_policies to authenticated;
grant all on public.organization_policies to service_role;

create policy "Organization members can view workspace policies"
  on public.organization_policies for select to authenticated
  using (private.is_organization_member(organization_id));

insert into public.organization_policies (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;
