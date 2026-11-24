# Sentinel AI Release Readiness

Status: **Prepared release candidate; NOT ready for production merge/deployment.**

Candidate PR: #90 (draft, base `main`)
Candidate branch: `fix/api-request-size-limits-2026-11-24`
Latest candidate code/test commit: `32a47bf8f16c3274c3926e903c300f6e95dd748d`.
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

The following PR-triggered checks completed successfully on code/test commit `32a47bf8f16c3274c3926e903c300f6e95dd748d`:

- [x] Main Security Hardening: **277 passed, 0 failed**; production dependency audit reported **0 vulnerabilities**.
- [x] Research Scope Gate: **57 passed, 0 failed**.
- [x] Security regression suite: **220 passed, 0 failed**. This includes simulated monitoring success and failure/retry/rescheduling tests.
- [x] Security API checks: **220 passed, 0 failed**, including syntax/SSRF guard, quota concurrency, two-user Research Lab isolation, pinned DNS, response headers, redirect safety, and private-table RLS migration checks.
- [ ] CodeQL Security Analysis: **completed successfully** on code/test commit `32a47bf8f16c3274c3926e903c300f6e95dd748d`. A docs-only follow-up commit is now triggering its own CI rerun.
- [x] Vercel Preview deployment for latest candidate code/test commit `32a47bf8f16c3274c3926e903c300f6e95dd748d`: **READY**, URL: https://project-3jyda-bspy7y0e6-sentinel-ai14.vercel.app. Preview deployments only; no Production deployment was changed.

The monitoring test uses a fake Supabase query client and fake scanner response. It proves the worker's successful control flow and persistence calls, but it is **not** proof of a real scan against a live customer domain or a real Supabase database.

The Security API job applies the candidate private-table RLS migration to its disposable CI PostgreSQL service. It has **not** been applied to live Supabase.

## Remaining release blockers

- [ ] **Protected Preview browser test:** Vercel SSO protection prevents a complete browser interaction test until an authorized preview session is available.
- [ ] **Domain ownership end-to-end test:** DNS TXT, HTTPS file, homepage meta-tag, and Smart Auto Verify logic have automated unit coverage. A full proof using a real domain controlled by the user remains unverified. Do not require the user to buy a domain; use a controlled test domain or isolated test harness where possible.
- [ ] **Authentication and user-data end-to-end test:** verify sign-up, sign-in, recovery, session, scan history, reports, and AI flows against a dedicated isolated Supabase test project. Generic Preview database access is intentionally blocked because its environment currently contains the production Supabase URL.
- [ ] **Monitoring live end-to-end:** the worker's simulated successful path now passes. However, there are no verified active monitoring sites and no real monitoring run records. A real customer-site scan and alert are therefore not proven. Alerts are currently in-app only; email/webhook delivery is not configured.
- [ ] **Supabase Auth hardening:** leaked-password protection is reported disabled by the security advisor. Enable and verify it before public release; this requires explicit approval for a live setting change.
- [ ] **Private-table RLS defense-in-depth:** CI tests the candidate migration enabling RLS on `private.scan_usage_reservations`. It is not applied to live Supabase and must be reviewed/approved before rollout.
- [ ] **Backup readiness:** Supabase Free does not provide scheduled database backups. A verified export and restore procedure is needed before production release.
- [ ] **Request ingress limit:** current JSON size checks run after Vercel has decoded `req.body`; they cap downstream processing but are not a pre-parser streaming/memory limit. Decide whether a raw-body streaming limit is required before launch.
- [ ] **Mobile/browser verification:** complete real mobile accessibility, layout, and cross-browser checks against the candidate.

## Rollout and rollback plan

1. Keep PR #90 as a draft until every release blocker above is resolved or explicitly accepted with documented risk.
2. Do not merge to `main` or deploy to Production without explicit user approval.
3. Before an approved rollout, capture a verified database backup/export and confirm production environment variables.
4. Deploy only after approval, then verify homepage, scanner, auth, reports, monitoring, and alert delivery.
5. If release verification fails, restore the previous known-good Vercel Production deployment `dpl_EMgCFrnCnwDuk9NPdzQWTJj2rjW8` and investigate before retrying.

## Safety boundaries

- Preparation changes are confined to this candidate branch.
- Production deployment and live Supabase schema/data/settings have not been changed.
- No branches, files, or deployments have been deleted.
- Do not merge, deploy to Production, change Supabase, or delete branches/files/deployments without explicit approval.

Passing CI and a successful Preview build do not by themselves satisfy the remaining end-to-end release gates above.
