-- SENTINEL AI — AI RESEARCH LAB DATABASE MIGRATION DRAFT
-- STATUS: REVIEW ONLY. NOT APPLIED. DO NOT RUN AGAINST PRODUCTION.
-- Target: Supabase PostgreSQL / public schema
--
-- Safety model:
--   * No active scanning is triggered by any database write.
--   * User-owned rows are isolated with RLS and composite ownership FKs.
--   * Client cannot set or change authorization/scope approval fields.
--   * Evidence and audit records are append-only for client roles.
--   * No secrets, credentials, session tokens, or raw request dumps are stored.
--   * File uploads are intentionally excluded until a private Storage bucket
--     and narrowly scoped Storage policies are separately reviewed.
--
-- Before execution: review this file, test on a disposable/staging project,
-- test with two unrelated users, inspect Data API exposure, and obtain explicit
-- project-owner approval. This draft does not establish legal authorization
-- for testing any external target.

begin;

-- 1) CASES
create table public.research_cases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  challenge_type text not null check (
    challenge_type in ('ctf','bug_bounty','defensive_assessment','code_review','other')
  ),
  description text not null default '' check (char_length(description) <= 10000),
  source_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_urls) = 'array'),
  -- Only a trusted server-side approval workflow may set these fields.
  authorization_status text not null default 'not_provided' check (
    authorization_status in ('not_provided','pending_review','authorized','denied','expired')
  ),
  authorized_assets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(authorized_assets) = 'array'),
  allowed_methods jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allowed_methods) = 'array'),
  excluded_methods jsonb not null default '[]'::jsonb
    check (jsonb_typeof(excluded_methods) = 'array'),
  scope_starts_at timestamptz,
  scope_expires_at timestamptz,
  result_state text not null default 'inconclusive' check (
    result_state in ('verified','refuted','inconclusive','solved')
  ),
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  limitations text not null default '',
  remediation text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint research_cases_scope_window_check check (
    scope_starts_at is null or scope_expires_at is null or scope_expires_at > scope_starts_at
  ),
  -- Composite key allows child rows to prove owner/case consistency.
  constraint research_cases_id_owner_unique unique (id, owner_user_id)
);

-- 2) NOTES — owner and parent are tied by a composite foreign key.
create table public.research_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  note_type text not null default 'observation' check (
    note_type in ('observation','hypothesis','test_plan','conclusion','remediation')
  ),
  content text not null check (char_length(content) between 1 and 10000),
  source_reference text check (source_reference is null or char_length(source_reference) <= 2048),
  created_at timestamptz not null default now(),
  constraint research_case_notes_case_owner_fk
    foreign key (case_id, owner_user_id)
    references public.research_cases(id, owner_user_id) on delete cascade
);

-- 3) EVIDENCE — append-only to client roles; store private object keys only.
create table public.research_case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  evidence_type text not null check (
    evidence_type in (
      'text_excerpt','file_reference','hash','screenshot_reference',
      'request_response_excerpt','log_excerpt','reproduction_step'
    )
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
    references public.research_cases(id, owner_user_id) on delete restrict
);

-- 4) AUDIT — clients may read their case history, but cannot write/change it.
-- case_owner_user_id is the owner of the parent case; actor_user_id records
-- who performed the event and may be null for system events.
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
    references public.research_cases(id, owner_user_id) on delete restrict
);

-- 5) INDEXES
create index research_cases_owner_created_idx
  on public.research_cases(owner_user_id, created_at desc);
create index research_cases_owner_status_idx
  on public.research_cases(owner_user_id, authorization_status);
create index research_case_notes_case_created_idx
  on public.research_case_notes(case_id, created_at desc);
create index research_case_evidence_case_created_idx
  on public.research_case_evidence(case_id, created_at desc);
create index research_case_audit_case_created_idx
  on public.research_case_audit(case_id, created_at desc);

-- 6) ROW LEVEL SECURITY
alter table public.research_cases enable row level security;
alter table public.research_case_notes enable row level security;
alter table public.research_case_evidence enable row level security;
alter table public.research_case_audit enable row level security;

create policy research_cases_select_own
  on public.research_cases for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy research_cases_insert_own
  on public.research_cases for insert to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy research_cases_update_own
  on public.research_cases for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

-- No client DELETE policy: cases are archived, not physically deleted.
-- Trusted account deletion cascades through cases and their child records,
-- including audit rows, to support account/data deletion requests.
-- Client UPDATE is additionally column-limited below.

create policy research_case_notes_select_own
  on public.research_case_notes for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );

create policy research_case_notes_insert_own
  on public.research_case_notes for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );

-- Notes are append-only for client roles. Corrections are new notes.

create policy research_case_evidence_select_own
  on public.research_case_evidence for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );

create policy research_case_evidence_insert_own
  on public.research_case_evidence for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
    )
  );

-- Evidence is append-only for client roles. Redaction must be a separately
-- audited trusted-server operation; do not silently overwrite original evidence.

create policy research_case_audit_select_own
  on public.research_case_audit for select to authenticated
  using (
    exists (
      select 1 from public.research_cases c
      where c.id = case_id and c.owner_user_id = (select auth.uid())
        and c.owner_user_id = case_owner_user_id
    )
  );

-- Deliberately no client INSERT/UPDATE/DELETE policies on audit.
-- Parent/account deletion cascades remove the associated audit rows; retain
-- audit only while the owning account/case remains active under this MVP model.

-- 7) LEAST-PRIVILEGE TABLE AND COLUMN GRANTS
revoke all on table
  public.research_cases,
  public.research_case_notes,
  public.research_case_evidence,
  public.research_case_audit
from public, anon, authenticated;

-- Cases: client may create/read/archive and edit descriptive fields only.
-- Authorization, scope, outcome and confidence are not client-writable.
grant select on public.research_cases to authenticated;
grant insert (owner_user_id, title, challenge_type, description, source_urls)
  on public.research_cases to authenticated;
grant update (title, challenge_type, description, source_urls, limitations, remediation, archived_at)
  on public.research_cases to authenticated;

-- Notes and evidence: read + append only.
grant select, insert on public.research_case_notes to authenticated;
grant select, insert on public.research_case_evidence to authenticated;

-- Audit: read only; server-side trusted code writes events.
grant select on public.research_case_audit to authenticated;

-- Server-side service role is privileged and MUST remain server-only.
grant all on table
  public.research_cases,
  public.research_case_notes,
  public.research_case_evidence,
  public.research_case_audit
to service_role;
grant usage, select on sequence public.research_case_audit_id_seq to service_role;

commit;

-- POST-DEPLOYMENT CHECKS (run only in a disposable/staging project first):
-- A. Confirm RLS is enabled on all four tables.
-- B. With user A and user B, prove A cannot read or attach rows to B's case.
-- C. Prove authenticated cannot set authorization_status='authorized',
--    change authorized_assets/allowed_methods/scope dates, or write audit rows.
-- D. Prove evidence/notes cannot be updated or deleted by authenticated.
-- E. Prove anon has no table privileges and service_role is never in browser code.
-- F. Inspect Data API exposure/grants separately; grants do not replace RLS.
-- G. Do not enable uploads until private Storage bucket policies, MIME/size
--    limits, malware handling, retention and deletion rules have been reviewed.
-- H. Run Supabase Security and Performance Advisors after staging deployment.
