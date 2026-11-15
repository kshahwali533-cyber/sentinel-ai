drop policy if exists "Invited users can view their invitations" on public.organization_invitations;
create policy "Invited users can view their invitations"
  on public.organization_invitations for select to authenticated
  using (lower(email) = lower(((select auth.jwt()) ->> 'email')));
