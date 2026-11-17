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
