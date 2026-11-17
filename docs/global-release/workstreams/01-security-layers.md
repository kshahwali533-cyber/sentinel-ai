# 01 — Seven Defensive Security Layers

**Status:** Not audited · **Priority:** Critical · **Release gate:** Yes  
**Rule:** Preview/test environment only. No production changes or secret rotation without explicit review and approval.

## Objective
Prove that Sentinel AI itself is protected across all seven defensive layers.

## Tasks
- [ ] **SEC-01 Edge / abuse:** inspect edge protections, rate limits, request-size limits and abuse controls.
- [ ] **SEC-02 Server / network:** inspect outbound networking, DNS pinning, SSRF controls, redirect validation and timeouts.
- [ ] **SEC-03 Application / API:** test input validation, authentication/authorization boundaries, error handling and API rate limits.
- [ ] **SEC-04 Identity / access:** test sessions, expiry, recovery, roles and least privilege.
- [ ] **SEC-05 Database / secrets:** review RLS, Data API grants, function privileges, service-role isolation and secret exposure.
- [ ] **SEC-06 Monitoring / response:** exercise alerting, operational logging, incident response and restore procedures.
- [ ] **SEC-07 Code / supply chain:** review dependencies, lockfile, GitHub Actions permissions, build/deploy provenance and rollback.

## Evidence required
Threat model; test cases and results; RLS/privilege review; dependency/workflow review; incident/restore exercise; finding register with severity and remediation.

## Pass criteria
No unresolved critical/high findings; negative authorization and SSRF tests pass; secrets remain server-side; recovery steps are documented and exercised.

## Known starting points
`api/_lib/pinned-lookup.js`, `api/_lib/pinned-request.js`, `api/_lib/public-ip.js`, `api/_lib/safe-fetch.js`, `api/_lib/finding-validation.js`, `api/_lib/client-ip.js`, `supabase/migrations/`, `.github/workflows/`.

## Completion record
- Test commit:
- Evidence/report:
- Open findings:
- Reviewer/date:
- Decision: NOT RUN / BLOCKED / PASS / FAIL

## Read-only baseline findings — 2026-11-18

- [x] **SEC-02 Network / SSRF baseline:** scanner uses validated DNS addresses and a pinned request transport; current CI includes pinned-DNS and manual-redirect guard checks. The scanner now rejects unrelated cross-domain final redirects before scoring (see Workstream 02).
- [x] **SEC-05 Database baseline:** monitoring tables `monitoring_sites`, `monitoring_runs`, and `monitoring_alerts` all have RLS enabled with owner-scoped authenticated SELECT policies. `claim_due_monitoring_sites` is SECURITY DEFINER with `search_path=pg_catalog`; only `service_role` can execute it, not `anon` or `authenticated`.
- [x] **SEC-07 CI least privilege:** workflow token is restricted to `contents: read`; GitHub Actions reports token permissions as Contents: read and Metadata: read.
- [ ] **SEC-04 Identity / Auth warning:** Supabase Security Advisor reports **Leaked Password Protection Disabled**. Remediation is to enable compromised-password checks in Supabase Auth after reviewing the plan/availability and validating the signup/password-reset UX. It has not been changed during this read-only audit. [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- [ ] **Preview isolation blocker:** Vercel environment-variable inventory returned no variables scoped to branch `feature/final-release-audit-20261117`. Do not copy Production secrets into Preview. Provision isolated Preview credentials/configuration before end-to-end runtime testing.
- [ ] **SEC-01/03/04/06/07 full review:** edge/WAF rules, complete API authorization, session lifecycle, incident response/recovery, dependency risk and rollback exercises remain unverified.

**Decision:** PARTIAL PASS for the inspected SSRF/redirect controls, monitoring RLS/RPC privileges and CI token scope. Overall seven-layer audit remains NOT COMPLETE; the Auth Advisor warning and Preview isolation are open.
- [x] **SEC-01 Edge / Vercel baseline:** project-level SSO deployment protection is enabled (all except custom domains); trusted-IP and password protection are disabled. No custom firewall configuration is present, so Vercel's default firewall applies. The last-day active-attack query returned no anomalies; this is not proof that no attacks ever occur. Custom WAF/managed-rule posture still requires a deliberate policy review before any project-wide production change.

### Expanded Supabase access review — 2026-11-18

- [x] All 21 ordinary tables in the `public` schema currently have RLS enabled; no table was found with RLS disabled.
- [x] No `anon` role has SELECT/INSERT privileges on those 21 tables. `authenticated` has SELECT only where intended, with INSERT/DELETE on `scan_history` and UPDATE on `profiles`; the related policies constrain rows to the owner or workspace membership. Client writes to monitoring, team, research and usage tables are not directly granted.
- [x] Private helper `private.is_organization_member(uuid)` uses `SECURITY DEFINER`, `search_path=pg_catalog`, checks `auth.uid()` against organization membership, and is not executable by `anon`.
- [x] Public SECURITY DEFINER functions reviewed in catalog are not executable by `anon` or `authenticated`, except the private membership helper is authenticated-executable; trigger functions are not client-executable. The `handle_new_user` trigger function writes only to fully-qualified `public.profiles`; public schema CREATE is denied to anon/authenticated.
- [ ] This is a catalog/privilege review, not a live cross-account penetration test. Test two separate accounts against scan history, organizations, invitations, research, monitoring and reports before marking authorization PASS.
- [x] **SEC-03 Application / data privacy remediation:** identified and closed a team-assets API disclosure path: unshared verified member domains were enumerated for every workspace role. Preview now restricts unshared asset enumeration to owners/admins and has role/wiring regression tests. Live two-account verification is still required.
- [x] **SEC-07 dependency gate:** Preview CI now runs `npm audit --omit=dev --audit-level=high`; the latest run found **0 vulnerabilities** in locked production dependencies. The complete workflow passed 167/167 tests plus quota, DNS pinning, response-header and redirect-safety checks.
- [x] **SEC-06 runtime baseline:** Vercel reported no runtime error clusters in the last 24 hours. This is a bounded observation, not proof of zero incidents.
- [x] **SEC-05/07 browser-secret regression gate:** CI now fails if browser source references `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET` or `service_role`. The latest run passed this check, `npm audit` found 0 vulnerabilities, and all 167 unit tests passed.
