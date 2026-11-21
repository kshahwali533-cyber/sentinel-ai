-- Add covering indexes for foreign keys identified by Supabase performance advisors.
-- These indexes are additive and do not alter existing rows or access policies.

create index if not exists research_case_approvals_reviewer_fk_idx
  on public.research_case_approvals (case_id, reviewer_user_id);

create index if not exists research_case_events_actor_user_fk_idx
  on public.research_case_events (actor_user_id);

create index if not exists research_case_reviewers_assigned_by_fk_idx
  on public.research_case_reviewers (assigned_by);
