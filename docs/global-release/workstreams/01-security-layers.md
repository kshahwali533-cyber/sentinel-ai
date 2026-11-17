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
