# Sentinel AI Release Readiness

Status: **Prepared release candidate; NOT ready for production merge/deployment.**

Candidate PR: #90 (draft, base `main`)
Candidate branch: `fix/api-request-size-limits-2026-11-24`
Latest candidate code/test commit verified in this readiness update: `7bbc37e3154f676b4fb5990a7a653da56b570e80`.
Latest documentation-only candidate head: `f04ad93f0d11d4d85f70b522db8e8c95da8a27b6`.
Previous known-good production deployment to preserve for rollback: `dpl_EMgCFrnCnwDuk9NPdzQWTJj2rjW8` (main deployment, commit `0f9f61da9447c40320d91ef4a3f61ce53b84e744`).

## Included development work

- Consolidated the PR #83/#84/#85 workstream and PR #90 additions into one release candidate based on current `main`.
- Website ownership verification: DNS TXT, HTTPS verification file, homepage meta tag, and Smart Auto Verify.
- HTML5-based link discovery and HTTP/HTTPS-only scanner URL parsing.
- Request payload size checks for Scan, AI Mentor, and Reports.
- More conservative security-header analysis and scoring; explicit HSTS response header added.
- Existing account, monitoring, research, team, report, and usage capabilities from the current main baseline and integrated history.
- Preview database isolation across all 12 database-backed API routes; Preview cannot obtain a service-role Supabase client.
- Migration parity and public-schema RLS checks are covered by repository validation.
- Monitoring worker refactored for dependency injection so its full successful path can be tested without live Supabase credentials.
- New successful-path monitoring test covers due-site claim, run creation, internal scan request, security-change alert insertion, site snapshot/next-scan update, and successful run completion.

## Latest verified CI evidence for candidate code commit

The following PR-triggered checks completed successfully on candidate code commit `7bbc37e3154f676b4fb5990a7a653da56b570e80`:

- [x] Main Security Hardening: **283 passed, 0 failed**; dependency audit and API syntax steps completed successfully.
- [x] Research Scope Gate: **57 passed, 0 failed**.
- [x] Security API checks: **226 passed, 0 failed**; database isolation, pinned-DNS, response-header, and redirect-safety checks also passed.
- [x] CodeQL Security Analysis: **success**.
- [x] Vercel Preview: **success/READY**, Preview deployment only. No Production deployment was changed.
- [x] All seven check runs for this exact candidate code commit completed successfully.

The latest documentation-only head `f04ad93f0d11d4d85f70b522db8e8c95da8a27b6` also has successful CodeQL, security, scope-gate, syntax/SSRF, and Vercel Preview checks. Its exact Preview deployment is READY. This is not a Production deployment.

The monitoring tests use fake database and scan clients. They prove simulated worker control flow and failure isolation, not a live Supabase/customer-domain scan or real alert delivery.

The Security API job applies the candidate private-table RLS migration to its disposable CI PostgreSQL service. It has **not** been applied to live Supabase.

## Remaining release blockers

- [ ] **Protected Preview browser test:** Vercel SSO protection prevents a complete browser interaction test until an authorized preview session is available.
- [ ] **Domain ownership end-to-end test:** DNS TXT, HTTPS file, homepage meta-tag, and Smart Auto Verify logic have automated unit coverage. A full proof using a real domain controlled by the user remains unverified. Do not require the user to buy a domain; use a controlled test domain or isolated test harness where possible.
- [ ] **Authentication and user-data end-to-end test:** verify sign-up, sign-in, recovery, session, scan history, reports, and AI flows against a dedicated isolated Supabase test project. Generic Preview database access is intentionally blocked because its environment currently contains the production Supabase URL.
- [ ] **Monitoring live end-to-end:** the worker's simulated successful path now passes. However, there are no verified active monitoring sites and no real monitoring run records. A real customer-site scan and alert are therefore not proven. Alerts are currently in-app only; email/webhook delivery is not configured.
- [ ] **Supabase Auth hardening:** leaked-password protection is reported disabled by the security advisor. Enable and verify it before public release; this requires explicit approval for a live setting change.
- [ ] **Private-table RLS defense-in-depth:** CI tests the candidate migration enabling RLS on `private.scan_usage_reservations`. It is not applied to live Supabase and must be reviewed/approved before rollout.
- [ ] **Backup readiness:** Supabase Free does not provide scheduled database backups. A verified export and restore procedure is needed before production release.
- [ ] **Mobile/browser verification:** complete real mobile accessibility, layout, and cross-browser checks against the candidate.

## Verified environment configuration (2026-11-26)

- Vercel environment-variable names and targets were inspected with decryption disabled; no secret values were read or exposed.
- `CRON_SECRET` is present for the **Production** target and also has Preview-target entries.
- This supersedes the older note in GitHub issue #22 that Production did not have `CRON_SECRET`.
- Presence of the variable does **not** prove that the production scheduler successfully invokes the worker or that a live monitoring run and alert complete. Those end-to-end checks remain open.
- Do not copy, reveal, rotate, or change secret values as part of this documentation update.

## Rollout and rollback plan

1. Keep PR #90 as a draft until every release blocker above is resolved or explicitly accepted with documented risk.
2. Do not merge to `main` or deploy to Production without explicit user approval.
3. Before an approved rollout, capture a verified database backup/export and confirm production environment variables.
4. Deploy only after approval, then verify homepage, scanner, auth, reports, monitoring, and alert delivery.
5. If release verification fails, restore the previous known-good Vercel Production deployment `dpl_EMgCFrnCnwDuk9NPdzQWTJj2rjW8` and investigate before retrying.

## Safety boundaries

- Preparation changes are confined to this candidate branch.
- Production deployment and live Supabase schema/data/settings have not been changed by this readiness update.
- No branches, files, or deployments have been deleted.
- Do not merge, deploy to Production, change Supabase, or delete branches/files/deployments without explicit approval.

Passing CI and a successful Preview build do not by themselves satisfy the remaining end-to-end release gates above.

## Request parser ingress limits (2026-11-25)

- Added Vercel API body-parser limits before the handler receives `req.body`: Scan 32 KiB, AI Mentor 64 KiB, Reports 1 MiB.
- Retained tighter application-level JSON byte limits: Scan 16 KiB, AI Mentor 32 KiB, Reports 512 KiB.
- Added `test/request-parser-limits.test.js` to prevent accidental removal or widening of these parser/application limits.
- A real oversized-request HTTP test against Preview remains desirable to confirm platform behavior.
- No Production deployment, `main`, or live Supabase changes were made.

## Monitoring failure persistence visibility (2026-11-25)

- Monitoring worker now checks the database result when recording a failed run and when rescheduling the monitored site after a failure.
- If either persistence write fails or throws, the worker logs the secondary failure, returns `ok: false`, and reports a `persistenceFailures` count instead of silently presenting the failure path as fully handled.
- Added a regression test simulating both failure-record writes failing; the test verifies both attempts and the explicit degraded response.
- Candidate code head: `7bbc37e3154f676b4fb5990a7a653da56b570e80`.
- Main Security Hardening, Research Scope Gate, Security API checks, CodeQL, and Vercel Preview all passed for this exact commit.
- These are simulated CI tests using fake database and scan clients; no live Supabase writes or customer scans were performed.
- PR #90 remains Draft and unmerged. No `main`, Production, or live Supabase changes were made.
