create or replace function private.create_default_organization_policy()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  insert into public.organization_policies (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$function$;

revoke all on function private.create_default_organization_policy() from public, anon, authenticated;

drop trigger if exists create_default_organization_policy on public.organizations;
create trigger create_default_organization_policy
after insert on public.organizations
for each row execute function private.create_default_organization_policy();

create index if not exists organization_policies_updated_by_idx
  on public.organization_policies(updated_by);
