-- Additive Researcher authorization foundation.
-- Existing tables and records are not altered.
create table public.research_cases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  authorization_status text not null default 'draft'
    check (authorization_status in ('draft','pending_review','authorized','rejected','revoked','expired')),
  authorization_reference text,
  authorization_evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(authorization_evidence) = 'array'),
  authorized_assets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(authorized_assets) = 'array'),
  allowed_methods text[] not null default '{}',
  allowed_test_categories text[] not null default '{}',
  excluded_methods text[] not null default '{}',
  scope_starts_at timestamptz,
  scope_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    authorization_status <> 'authorized'
    or (
      authorization_reference is not null
      and char_length(trim(authorization_reference)) between 1 and 500
      and jsonb_array_length(authorization_evidence) > 0
      and jsonb_array_length(authorized_assets) > 0
      and cardinality(allowed_methods) > 0
      and cardinality(allowed_test_categories) > 0
      and scope_starts_at is not null
      and scope_expires_at is not null
      and scope_expires_at > scope_starts_at
    )
  )
);

create table public.research_case_reviewers (
  case_id uuid not null references public.research_cases(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active','revoked')),
  assigned_at timestamptz not null default now(),
  primary key (case_id, reviewer_user_id)
);

create table public.research_case_approvals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.research_cases(id) on delete cascade,
  plan_hash text not null check (plan_hash ~ '^[0-9a-f]{64}$'),
  target_origin text not null check (target_origin ~ '^https://'),
  target_path text not null check (target_path like '/%' and target_path not like '//%'),
  method text not null check (method in ('GET','HEAD','OPTIONS')),
  test_category text not null check (char_length(trim(test_category)) between 1 and 80),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','revoked')),
  reviewer_user_id uuid not null,
  reviewer_notes text not null default '' check (char_length(reviewer_notes) <= 3000),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz,
  unique (case_id, plan_hash),
  foreign key (case_id, reviewer_user_id)
    references public.research_case_reviewers(case_id, reviewer_user_id) on delete restrict,
  check (
    status <> 'approved'
    or (approved_at is not null and expires_at is not null and expires_at > approved_at)
  )
);

create table public.research_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.research_cases(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 80),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index research_cases_owner_idx
  on public.research_cases(owner_user_id, created_at desc);
create index research_case_reviewers_user_idx
  on public.research_case_reviewers(reviewer_user_id, status, case_id);
create index research_case_approvals_lookup_idx
  on public.research_case_approvals(case_id, plan_hash, status);
create index research_case_events_case_idx
  on public.research_case_events(case_id, created_at desc);

alter table public.research_cases enable row level security;
alter table public.research_case_reviewers enable row level security;
alter table public.research_case_approvals enable row level security;
alter table public.research_case_events enable row level security;

-- All writes and reads go through the authenticated server API, which checks
-- the caller's identity and case/reviewer relationship before using service_role.
revoke all on public.research_cases from anon, authenticated;
revoke all on public.research_case_reviewers from anon, authenticated;
revoke all on public.research_case_approvals from anon, authenticated;
revoke all on public.research_case_events from anon, authenticated;
grant all on public.research_cases to service_role;
grant all on public.research_case_reviewers to service_role;
grant all on public.research_case_approvals to service_role;
grant all on public.research_case_events to service_role;
