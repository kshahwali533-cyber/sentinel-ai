-- SENTINEL AI — AI RESEARCH LAB DATABASE MIGRATION DRAFT
-- STATUS: REVIEW ONLY — NOT APPLIED. DO NOT RUN AGAINST PRODUCTION.
-- Five private tables. Analysis-only by default. No scan is triggered by a write.
-- External testing requires separately verified permission and per-plan approval.
-- File uploads are intentionally deferred until private Storage policies are reviewed.

begin;

create table public.research_cases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  challenge_type text not null check (challenge_type in ('ctf','bug_bounty','defensive_assessment','code_review','other')),
  description text not null default '' check (char_length(description) <= 10000),
  source_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(source_urls) = 'array'),
  authorization_status text not null default 'not_provided'
    check (authorization_status in ('not_provided','pending_review','authorized','denied','expired','revoked')),
  authorized_assets jsonb not null default '[]'::jsonb check (jsonb_typeof(authorized_assets) = 'array'),
  allowed_methods jsonb not null default '[]'::jsonb check (jsonb_typeof(allowed_methods) = 'array'),
  allowed_test_categories jsonb not null default '[]'::jsonb check (jsonb_typeof(allowed_test_categories) = 'array'),
  excluded_methods jsonb not null default '[]'::jsonb check (jsonb_typeof(excluded_methods) = 'array'),
  scope_starts_at timestamptz,
  scope_expires_at timestamptz,
  result_state text not null default 'inconclusive'
    check (result_state in ('verified','refuted','inconclusive','solved')),
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  limitations text not null default '',
  remediation text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint research_cases_scope_window_check check (
    scope_starts_at is null or scope_expires_at is null or scope_expires_at > scope_starts_at
  ),
  constraint research_cases_id_owner_unique unique (id, owner_user_id)
);

create table public.research_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  note_type text not null default 'observation'
    check (note_type in ('observation','hypothesis','test_plan','conclusion','remediation')),
  content text not null check (char_length(content) between 1 and 10000),
  source_reference text check (source_reference is null or char_length(source_reference) <= 2048),
  created_at timestamptz not null default now(),
  constraint research_case_notes_case_owner_fk
    foreign key (case_id, owner_user_id)
    references public.research_cases(id, owner_user_id) on delete cascade
);

create table public.research_case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  evidence_type text not null check (
    evidence_type in ('text_excerpt','file_reference','hash','screenshot_reference','request_response_excerpt','log_excerpt','reproduction_step')
  ),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  content_reference text check (
    content_reference is null or
    (char_length(content_reference) <= 512 and content_reference !~ '^https?://')
  ),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9A-Fa-f]{64}$'),
  captured_at timestamptz not null default now(),
  redacted boolean not null default false,
  created_at timestamptz not null default now(),
  constraint research_case_evidence_case_owner_fk
    foreign key (case_id, owner_user_id)
    references public.research_cases(id, owner_user_id) on delete cascade
);

-- Trusted server-side human review only. The approval binds one exact plan hash.
create table public.research_case_approvals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  case_owner_user_id uuid not null,
  plan_hash text not null check (plan_hash ~ '^[0-9A-Fa-f]{64}$'),
  target_origin text not null check (target_origin ~ '^https://[^/]+(:443)?$'),
  target_path text not null check (target_path like '/%' and target_path not like '//%'),
  method text not null check (method in ('GET','HEAD','OPTIONS')),
  test_category text not null check (char_length(btrim(test_category)) between 1 and 80),
  status text not null check (status in ('approved','rejected','revoked')),
  reviewer_user_id uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint research_case_approvals_case_owner_fk
    foreign key (case_id, case_owner_user_id)
    references public.research_cases(id, owner_user_id) on delete cascade,
  constraint research_case_approvals_expiry_check check (expires_at > created_at),
  constraint research_case_approvals_approved_fields_check check (
    status <> 'approved' or (reviewer_user_id is not null and approved_at is not null)
  ),
  constraint research_case_approvals_revoked_fields_check check (
    status <> 'revoked' or revoked_at is not null
  ),
  constraint research_case_approvals_plan_unique unique (case_id, plan_hash)
);

create table public.research_case_audit (
  id bigint generated always as identity primary key,
  case_id uuid not null,
  case_owner_user_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(btrim(event_type)) between 1 and 80),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 8192),
  created_at timestamptz not null default now(),
  constraint research_case_audit_case_owner_fk
    foreign key (case_id, case_owner_user_id)
    references public.research_cases(id, owner_user_id) on delete cascade
);

create index research_cases_owner_created_idx on public.research_cases(owner_user_id, created_at desc);
create index research_cases_owner_status_idx on public.research_cases(owner_user_id, authorization_status);
create index research_case_notes_case_created_idx on public.research_case_notes(case_id, created_at desc);
create index research_case_evidence_case_created_idx on public.research_case_evidence(case_id, created_at desc);
create index research_case_approvals_case_expiry_idx on public.research_case_approvals(case_id, expires_at desc);
create index research_case_audit_case_created_idx on public.research_case_audit(case_id, created_at desc);

alter table public.research_cases enable row level security;
alter table public.research_case_notes enable row level security;
alter table public.research_case_evidence enable row level security;
alter table public.research_case_approvals enable row level security;
alter table public.research_case_audit enable row level security;

create policy research_cases_select_own on public.research_cases
  for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy research_cases_insert_own on public.research_cases
  for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy research_cases_update_own on public.research_cases
  for update to authenticated using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);
-- No client DELETE policy: archive cases. Account deletion cascades owned data.

create policy research_case_notes_select_own on public.research_case_notes
  for select to authenticated using (
    owner_user_id = (select auth.uid()) and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );
create policy research_case_notes_insert_own on public.research_case_notes
  for insert to authenticated with check (
    owner_user_id = (select auth.uid()) and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );
-- Notes are append-only for client roles.

create policy research_case_evidence_select_own on public.research_case_evidence
  for select to authenticated using (
    owner_user_id = (select auth.uid()) and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );
create policy research_case_evidence_insert_own on public.research_case_evidence
  for insert to authenticated with check (
    owner_user_id = (select auth.uid()) and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );
-- Evidence is append-only for client roles.

create policy research_case_approvals_select_own on public.research_case_approvals
  for select to authenticated using (
    case_owner_user_id = (select auth.uid()) and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );
-- No client INSERT/UPDATE/DELETE policies or grants for approvals.

create policy research_case_audit_select_own on public.research_case_audit
  for select to authenticated using (
    case_owner_user_id = (select auth.uid()) and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );
-- No client INSERT/UPDATE/DELETE policies or grants for audit.

revoke all on table
  public.research_cases,
  public.research_case_notes,
  public.research_case_evidence,
  public.research_case_approvals,
  public.research_case_audit
from public, anon, authenticated;

grant select on public.research_cases to authenticated;
grant insert (owner_user_id, title, challenge_type, description, source_urls)
  on public.research_cases to authenticated;
grant update (title, challenge_type, description, source_urls, limitations, remediation, archived_at)
  on public.research_cases to authenticated;

grant select, insert on public.research_case_notes to authenticated;
grant select, insert on public.research_case_evidence to authenticated;
grant select on public.research_case_approvals to authenticated;
grant select on public.research_case_audit to authenticated;

grant all on table
  public.research_cases,
  public.research_case_notes,
  public.research_case_evidence,
  public.research_case_approvals,
  public.research_case_audit
to service_role;
grant usage, select on sequence public.research_case_audit_id_seq to service_role;

commit;

-- REQUIRED STAGING TESTS BEFORE ANY PRODUCTION DEPLOYMENT:
-- 1. RLS enabled on all five tables; cross-user SELECT/INSERT isolation with two accounts.
-- 2. Browser cannot set authorization_status, scope fields, outcome, confidence, or plan approvals.
-- 3. Notes/evidence are append-only for browser roles; audit is server-write only.
-- 4. Expired/revoked/mismatched plan approvals are denied; scope mismatch is denied.
-- 5. Anon has no table privileges; service_role is server-only and never bundled to clients.
-- 6. Inspect Data API exposure and run Supabase Security/Performance Advisors.
-- 7. Keep uploads disabled until private Storage policies, size/type limits, malware handling,
--    retention, and deletion behavior are separately reviewed.
-- 8. This migration does not grant legal permission to test any external system.
