create schema if not exists private;
grant usage on schema private to authenticated, service_role;

alter function public.is_organization_member(uuid) set schema private;

revoke all on function private.is_organization_member(uuid) from public, anon;
grant execute on function private.is_organization_member(uuid) to authenticated, service_role;

drop policy if exists "Members can view their organizations" on public.organizations;
create policy "Members can view their organizations"
  on public.organizations for select to authenticated
  using (private.is_organization_member(id));

drop policy if exists "Members can view organization membership" on public.organization_members;
create policy "Members can view organization membership"
  on public.organization_members for select to authenticated
  using (private.is_organization_member(organization_id));

drop policy if exists "Members can view organization audit events" on public.organization_audit_events;
create policy "Members can view organization audit events"
  on public.organization_audit_events for select to authenticated
  using (private.is_organization_member(organization_id));

create index if not exists organizations_created_by_idx
  on public.organizations(created_by);
create index if not exists organization_invitations_invited_by_idx
  on public.organization_invitations(invited_by);
create index if not exists organization_audit_events_actor_idx
  on public.organization_audit_events(actor_user_id);
create index if not exists organization_audit_events_target_idx
  on public.organization_audit_events(target_user_id);
