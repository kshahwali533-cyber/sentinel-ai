# AI Research Lab — Database and RLS Design
Status: Proposed only — NOT applied to Supabase
Target project: Sentinel AI
Git branch: feature/ai-research-lab-spec

## Design goals
- Keep every research case private to its owner in the MVP.
- Allow a case to exist before any scan or external testing.
- Separate authorization/scope, research notes, evidence, conclusions, and audit events.
- Keep notes and evidence append-only for client roles; corrections are new records. Any trusted-server redaction must be separately audited.
- Never store passwords, API keys, session cookies, private keys, or raw authentication tokens.
- No active testing is initiated by a database insert or case creation.

## Proposed tables

### public.research_cases
- id uuid primary key default gen_random_uuid()
- owner_user_id uuid not null references auth.users(id) on delete cascade
- title text not null, length 1..160
- challenge_type text not null; allowed: ctf, bug_bounty, defensive_assessment, code_review, other
- description text not null default '', bounded to 10000 chars
- source_urls jsonb not null default '[]', must be an array
- authorization_status text not null default 'not_provided'; allowed: not_provided, pending_review, authorized, denied, expired
- authorized_assets jsonb not null default '[]', must be an array
- allowed_methods jsonb not null default '[]', must be an array
- allowed_test_categories jsonb not null default '[]', must be an array; only explicitly listed safe test categories can be considered
- excluded_methods jsonb not null default '[]', must be an array
- scope_starts_at and scope_expires_at timestamptz null
- result_state text not null default 'inconclusive'; allowed: verified, refuted, inconclusive, solved
- confidence text not null default 'low'; allowed: low, medium, high
- limitations and remediation text not null default ''
- archived_at timestamptz null
- created_at timestamptz not null default now(); cases are archived rather than client-side hard-deleted
- constraints: scope expiry must be after scope start when both exist; JSON fields must be arrays.

### public.research_case_notes
- id uuid primary key default gen_random_uuid()
- case_id uuid not null; owner_user_id uuid not null
- composite foreign key (case_id, owner_user_id) references research_cases(id, owner_user_id) on delete cascade
- owner_user_id references auth.users(id) on delete cascade
- note_type text not null default 'observation'; allowed: observation, hypothesis, test_plan, conclusion, remediation
- content text not null, length 1..10000
- source_reference text null, max 2048
- created_at timestamptz not null default now()
- Composite foreign key and RLS both enforce parent/owner consistency.

### public.research_case_evidence
- id uuid primary key default gen_random_uuid()
- case_id uuid not null; owner_user_id uuid not null
- composite foreign key (case_id, owner_user_id) references research_cases(id, owner_user_id) on delete cascade
- owner_user_id references auth.users(id) on delete cascade
- evidence_type text not null; allowed: text_excerpt, file_reference, hash, screenshot_reference, request_response_excerpt, log_excerpt, reproduction_step
- title text not null, length 1..160
- description text not null default '', max 5000
- content_reference text null, max 512; private Storage object key only, not a URL
- Client roles receive SELECT/INSERT only; no client UPDATE/DELETE
- sha256 text null, exactly 64 hexadecimal characters when present
- captured_at timestamptz not null default now()
- redacted boolean not null default false
- created_at timestamptz not null default now()
- Do not store secret material or unrelated personal data in content/description.

### public.research_case_approvals
- id uuid primary key default gen_random_uuid()
- case_id uuid and case_owner_user_id uuid; composite foreign key to research_cases(id, owner_user_id)
- plan_hash text not null, exactly 64 hexadecimal characters; unique per case
- target_origin text not null; HTTPS origin only
- target_path text not null; exact approved path
- method text not null; MVP permits GET, HEAD, OPTIONS only
- test_category text not null; must also appear in the case's allowed_test_categories
- status text not null; approved, rejected, revoked
- reviewer_user_id uuid null references auth.users(id); required for approved decisions
- approved_at, expires_at, revoked_at, created_at timestamps
- RLS enabled; owner can SELECT; no client INSERT/UPDATE/DELETE. A trusted server-side review workflow creates and revokes approval records.

### public.research_case_audit
- id bigint generated always as identity primary key
- case_id uuid not null; case_owner_user_id uuid not null
- composite foreign key (case_id, case_owner_user_id) references research_cases(id, owner_user_id) on delete cascade
- actor_user_id uuid null references auth.users(id) on delete set null
- event_type text not null, max 80
- details jsonb not null default '{}'; must be an object and contain no credentials/secrets
- created_at timestamptz not null default now()
- Client roles get SELECT only for cases they own. INSERT should be performed by trusted server-side code after validating the actor and case. No client UPDATE or DELETE.

## RLS policy model

Enable RLS on every table.

### research_cases
- SELECT: authenticated, (select auth.uid()) = owner_user_id
- INSERT: authenticated, WITH CHECK ((select auth.uid()) = owner_user_id)
- UPDATE: authenticated, USING ((select auth.uid()) = owner_user_id), WITH CHECK ((select auth.uid()) = owner_user_id)
- No client DELETE policy; archive cases instead.
- Column-level grants restrict client UPDATE to descriptive/remediation fields. Authorization, scope, result and confidence fields are not client-writable; a trusted server workflow must approve them.

### research_case_notes and research_case_evidence
- SELECT: authenticated and owner_user_id = (select auth.uid()) and an EXISTS check that the parent research_cases row has the same id and owner_user_id.
- INSERT: same ownership predicate in WITH CHECK.
- No client UPDATE/DELETE policies; notes and evidence are append-only for client roles. Corrections are new records; redaction must use a trusted, audited server workflow.

### research_case_approvals
- SELECT: authenticated owner of parent case only.
- No client INSERT/UPDATE/DELETE policies or grants; trusted server only.

### research_case_audit
- SELECT: authenticated with EXISTS on parent case owned by auth.uid().
- No INSERT/UPDATE/DELETE policies or grants for anon/authenticated. Trusted server code uses service-role credentials only on the server and records actor identity explicitly after verifying the user token.
- Case/account deletion cascades remove associated child and audit rows under the MVP retention model.

## Important implementation cautions
- TO authenticated alone is not sufficient; every policy must enforce ownership.
- UPDATE policies require both USING and WITH CHECK.
- Do not use user-editable user_metadata for authorization.
- Never expose the Supabase service-role key to the browser.
- Check Data API exposure and explicit grants for newly created public tables before client access; grants do not replace RLS.
- Avoid SECURITY DEFINER functions unless strictly necessary; if used, restrict execution and validate auth.uid() inside.
- Add indexes on owner_user_id, case_id, created_at, and common filters after reviewing query patterns.
- Grant only required Data API table/column privileges; anon receives no access. Grants do not replace RLS.
- File upload is excluded from the initial migration until private Storage bucket policies, size/type limits, malware handling and retention are separately reviewed.
- Keep case creation separate from target scanning. A case may be created in analysis-only mode with no authorization evidence.
- External active tests require a separate application-level scope gate, explicit human approval, allowlist, method restrictions, rate budget, expiry, and emergency stop. RLS is not a substitute for these controls.

## Existing database observations (read-only review)
- Existing research_projects, research_findings, and research_notes have RLS enabled.
- Current policies inspected for these three tables were SELECT-only and targeted authenticated.
- Existing monitoring and research workspace tables already provide a foundation, but a challenge case is a distinct record and should not be overloaded into research_findings.
- Security advisor warning: Supabase Auth leaked-password protection is disabled. This is an account-level hardening recommendation, not a blocker for drafting this schema.
- No database objects were created or modified during this review.

## Review gates before any migration
1. Review exact DDL, policy expressions, indexes, and foreign-key behavior.
2. Confirm how owner approval of authorization scope is represented and audited.
3. Keep uploads disabled until Storage bucket privacy and evidence upload limits are separately reviewed.
4. Run security advisors after staging migration and test cross-user SELECT/INSERT/UPDATE/DELETE isolation with two test users, including prohibited column updates and append-only behavior.
5. Do not deploy the feature until all tests pass.
