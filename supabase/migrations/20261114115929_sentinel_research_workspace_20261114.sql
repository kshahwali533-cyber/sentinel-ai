create table public.research_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.research_findings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  site_id uuid references public.monitoring_sites(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_hostname text not null check (char_length(asset_hostname) between 1 and 253),
  asset_url text not null check (char_length(asset_url) between 8 and 2048),
  title text not null check (char_length(title) between 1 and 160),
  severity text not null check (severity in ('critical','high','medium','low','info')),
  status text not null default 'new' check (status in ('new','triaged','accepted','remediating','resolved','false_positive')),
  endpoint_path text not null check (
    char_length(endpoint_path) between 1 and 1024
    and endpoint_path like '/%'
    and endpoint_path not like '//%'
  ),
  description text not null check (char_length(description) between 1 and 5000),
  impact text not null default '' check (char_length(impact) <= 3000),
  remediation text not null default '' check (char_length(remediation) <= 3000),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.research_notes (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.research_findings(id) on delete cascade,
  project_id uuid not null references public.research_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index research_projects_owner_idx
  on public.research_projects (user_id, created_at desc);
create index research_findings_project_idx
  on public.research_findings (project_id, created_at desc);
create index research_findings_owner_status_idx
  on public.research_findings (user_id, status, severity);
create index research_findings_site_idx
  on public.research_findings (site_id)
  where site_id is not null;
create index research_notes_finding_idx
  on public.research_notes (finding_id, created_at desc);
create index research_notes_project_idx
  on public.research_notes (project_id, created_at desc);

alter table public.research_projects enable row level security;
alter table public.research_findings enable row level security;
alter table public.research_notes enable row level security;

revoke all on public.research_projects from anon, authenticated;
revoke all on public.research_findings from anon, authenticated;
revoke all on public.research_notes from anon, authenticated;
grant select on public.research_projects to authenticated;
grant select on public.research_findings to authenticated;
grant select on public.research_notes to authenticated;
grant all on public.research_projects to service_role;
grant all on public.research_findings to service_role;
grant all on public.research_notes to service_role;

create policy "Owners can view research projects"
  on public.research_projects for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners can view research findings"
  on public.research_findings for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.research_projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "Owners can view research notes"
  on public.research_notes for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.research_findings f
      where f.id = finding_id and f.user_id = (select auth.uid())
    )
  );
