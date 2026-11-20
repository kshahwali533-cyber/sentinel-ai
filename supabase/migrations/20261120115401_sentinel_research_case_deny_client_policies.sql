create policy "No direct client access to research cases"
on public.research_cases for all to anon, authenticated
using (false) with check (false);
create policy "No direct client access to research case reviewers"
on public.research_case_reviewers for all to anon, authenticated
using (false) with check (false);
create policy "No direct client access to research case approvals"
on public.research_case_approvals for all to anon, authenticated
using (false) with check (false);
create policy "No direct client access to research case events"
on public.research_case_events for all to anon, authenticated
using (false) with check (false);