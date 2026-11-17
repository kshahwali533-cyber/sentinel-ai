# Sentinel AI — Global Release Readiness

> Status: **Scaffold only — implementation and release gates are not yet verified.**
> Scope: Preview branch only. Do not merge to `main` or change production/Supabase settings from this checklist.

This work plan defines the eight workstreams required before Sentinel AI can be called a Global Ready Release. Existing code and tests are starting points, not proof that a capability is production-ready.

## Release rules

- Work in the Preview branch and use Preview deployments for validation.
- Do not run scans against domains or systems without explicit authorization.
- Do not apply database migrations, change secrets, or alter production settings without a separately reviewed and approved change.
- A workstream is complete only when its acceptance criteria pass and the evidence is recorded.
- A passing automated test suite is necessary but does not replace independent security testing.
- Do not describe the platform as globally certified or 100% complete based only on internal tests.

## Workstream 1 — Seven defensive security layers

**Existing starting points:** `api/_lib/pinned-lookup.js`, `api/_lib/pinned-request.js`, `api/_lib/public-ip.js`, `api/_lib/safe-fetch.js`, `api/_lib/finding-validation.js`, `api/_lib/client-ip.js`, `supabase/migrations/`, `.github/workflows/`.

- [ ] Edge, abuse and rate-limit protections reviewed.
- [ ] Server/network boundaries and outbound-request controls reviewed.
- [ ] Application/API input validation, authorization and error handling reviewed.
- [ ] Identity, sessions and role boundaries tested.
- [ ] Database RLS, grants, service-role isolation and secret handling independently reviewed.
- [ ] Monitoring, alerting, incident response and recovery procedures exercised.
- [ ] Dependency, workflow, repository and deployment supply-chain controls reviewed.

**Acceptance evidence:** documented threat model; negative authorization tests; SSRF/private-network and redirect tests; dependency/workflow review; RLS policy tests; recovery exercise; no unresolved critical/high findings.

## Workstream 2 — Scanner accuracy and evidence

**Existing starting points:** `api/scan.js`, `api/_lib/safe-fetch.js`, `api/_lib/security-header-analysis.js`, `api/_lib/security-evidence.js`, `api/_lib/scan-score.js`, `api/_lib/finding-validation.js`, `test/safe-fetch.test.js`, `test/scan-score.test.js`, `test/security-evidence.test.js`.

- [ ] Confirm the scanner reports the originally requested host and records redirects safely.
- [ ] Reproduce and resolve the Google 429/challenge-page attribution case.
- [ ] Verify that upstream errors, blocked requests and incomplete scans are not scored as target-site findings.
- [ ] Check finding evidence, severity, score calculation and false-positive behavior against controlled fixtures.
- [ ] Verify timeouts, response-size limits, DNS pinning and redirect re-validation.
- [ ] Test representative authorized sites with different stacks and response behaviors.

**Acceptance evidence:** reproducible fixture tests; original target preserved; upstream failures clearly distinguished; every reported finding has traceable evidence; documented false-positive review.

## Workstream 3 — AI Security Mentor

**Existing starting points:** `api/assistant.js`, `api/_lib/mentor-validation.js`, `test/assistant-api.test.js`, `test/mentor-validation.test.js`.

- [ ] Verify advice is grounded in the supplied finding and does not invent vulnerabilities.
- [ ] Test safe fallback behavior when the AI provider is unavailable.
- [ ] Correct and regression-test CVSS formatting (including the previously observed malformed display).
- [ ] Test invalid CVE identifiers, unsupported claims and uncertain evidence.
- [ ] Ensure remediation steps are safe, prioritized and understandable.
- [ ] Verify secrets, prompts and private scan data are not exposed in client responses or logs.

**Acceptance evidence:** curated evaluation set with expected outcomes; malformed/invalid-input tests; fallback tests; human review of security advice; no unsupported critical claims in the evaluation set.

## Workstream 4 — Continuous monitoring and alerts

**Existing starting points:** `api/monitoring.js`, `api/monitoring-run.js`, `api/_lib/monitoring.js`, `docs/monitoring.md`, `test/monitoring.test.js`, `test/monitoring-run-api.test.js`, `supabase/migrations/20261115231717_sentinel_monitoring_15m_scheduler.sql`.

- [ ] Verify domain ownership and authorization before activation.
- [ ] Verify the 15-minute scheduler is actually active in the intended environment.
- [ ] Verify Vault secret configuration and successful authenticated worker dispatches.
- [ ] Exercise baseline creation, changed-posture alerts, retries and failure recovery.
- [ ] Test pause, resume, removal and per-user isolation.
- [ ] Decide and implement alert delivery expectations (in-app, email and/or webhook) before promising them.
- [ ] Load-test worker limits and define queueing/scaling behavior.

**Acceptance evidence:** scheduler history and successful dispatch responses; end-to-end authorized test-domain run; cross-account isolation tests; alert delivery evidence. A migration file alone is not proof that monitoring is live.

## Workstream 5 — Reports

**Existing starting points:** `api/report.js`, `sentinel-report.css`, `test/report-api.test.js`, `test/report-export.test.js`, `test/report-print.test.js`, `test/report-ui.test.js`.

- [ ] Verify report accuracy against the stored scan and its evidence.
- [ ] Test export, print and mobile layouts.
- [ ] Test empty, partial, failed and large reports.
- [ ] Ensure reports do not leak another user's scans or internal secrets.
- [ ] Verify timestamps, target identity, severity and remediation wording.

**Acceptance evidence:** report fixtures and export checks; mobile viewport review; authorization tests; no mismatches between scan data and report content.

## Workstream 6 — Accounts, permissions and data

**Existing starting points:** `supabase/migrations/`, `api/organizations.js`, `api/organization-admin.js`, `api/organization-assets.js`, `api/_lib/organizations.js`, `api/_lib/organization-policies.js`, `test/organizations.test.js`, `test/organization-policies.test.js`.

- [ ] Test signup, login, logout, recovery and session expiry.
- [ ] Review least-privilege access for profiles and organization/team roles.
- [ ] Test cross-user and cross-organization access denial for scans, reports, assets and monitoring.
- [ ] Review RLS policies, Data API grants, function privileges and service-role use.
- [ ] Review backup, restore and incident-recovery limitations for the selected plan.
- [ ] Test invitations, acceptance, revocation and role changes with separate accounts.

**Acceptance evidence:** role/ownership matrix; automated negative-access tests; reviewed migration SQL; documented backup/restore procedure and known plan limitations.

## Workstream 7 — Global readiness, performance and mobile

**Existing starting points:** `index.html`, `sentinel-app.js`, `sentinel.css`, `api/`, `.github/workflows/`.

- [ ] Test mobile layouts and primary workflows on small screens.
- [ ] Measure page and API latency from multiple geographic regions.
- [ ] Test concurrent users, scan limits, timeouts and graceful overload behavior.
- [ ] Check accessibility, keyboard navigation, readable errors and localization readiness.
- [ ] Verify production/preview environment separation and safe deployment rollback.
- [ ] Review domain, TLS, security headers, uptime monitoring and operational ownership.

**Acceptance evidence:** repeatable performance report with test locations and load profile; mobile/browser matrix; accessibility findings; rollback exercise; documented service limits.

## Workstream 8 — Independent security assessment and launch gate

- [ ] Prepare a scoped test environment, test accounts and authorized target list.
- [ ] Prepare architecture, data-flow, threat-model and API documentation for reviewers.
- [ ] Obtain an independent penetration test and application-security review.
- [ ] Track findings by severity, owner, fix commit and retest evidence.
- [ ] Resolve or formally accept all findings before release; no unresolved critical/high findings.
- [ ] Obtain a final written assessment and define exactly what was tested and what was out of scope.

**Acceptance evidence:** signed/dated independent report, remediation evidence and retest results. Do not claim a universal “global pass”; report the actual scope and assessor.

## Execution order

1. Establish a clean Preview baseline and run the existing CI/test suite.
2. Fix reproducible failures before adding new behavior.
3. Complete scanner accuracy and security-layer reviews.
4. Verify monitoring end-to-end in an isolated test environment.
5. Complete Mentor, reports, identity/data and team acceptance tests.
6. Run global performance/mobile/accessibility checks.
7. Commission independent assessment, remediate, retest and prepare release decision.

## Test commands already used by repository CI

```sh
node --check sentinel-app.js
find api test -type f -name '*.js' -print0 | while IFS= read -r -d '' file; do node --check "$file"; done
node --test test/*.test.js
```

The repository workflow also contains database concurrency and scanner safety checks. Review the current workflow output for the exact commit before marking CI as passed.

## Progress ledger

| Workstream | Status | Evidence / next action |
|---|---|---|
| 1. Seven security layers | Not yet audited | Threat model and layer-by-layer review |
| 2. Scanner accuracy | Not yet verified | Reproduce redirect / 429 attribution case |
| 3. AI Security Mentor | Not yet verified | CVSS formatting and evaluation set |
| 4. Continuous monitoring | Code and tests exist; live activation unverified | Verify Cron, Vault and end-to-end dispatch |
| 5. Reports | Code and tests exist; acceptance unverified | Export, accuracy and mobile checks |
| 6. Accounts and data | Migrations and tests exist; full audit unverified | RLS, grants and multi-account tests |
| 7. Global readiness | Not yet measured | Regional performance and device matrix |
| 8. Independent assessment | Not started | Prepare scope and reviewer package |

**Current document status:** planning scaffold committed to Preview only. This document does not mark any workstream as passed or change production behavior.
