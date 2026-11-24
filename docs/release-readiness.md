# Sentinel AI Release Readiness

Status: **Prepared release candidate; NOT ready for production merge/deployment.**

Candidate PR: #90 (draft, base `main`)
Candidate branch: `fix/api-request-size-limits-2026-11-24`
Current candidate code commit: `4ae7e7cadda8463e6845c156935d8bbdce30027f` (latest follow-up documentation commit: `f97db20f13a6b3402a873c2c85cc4c0594530974`).
Current production deployment to preserve for rollback: `dpl_EMgCFrnCnwDuk9NPdzQWTJj2rjW8` (main deployment, commit `0f9f61da9447c40320d91ef4a3f61ce53b84e744`).

## Included development work

- Consolidated the PR #83/#84/#85 workstream and PR #90 additions into one release candidate based on current `main`.
- Website ownership verification: DNS TXT, HTTPS verification file, homepage meta tag, and Smart Auto Verify.
- HTML5-based link discovery and HTTP/HTTPS-only scanner URL parsing.
- Request payload size checks for Scan, AI Mentor, and Reports.
- More conservative security-header analysis and scoring; explicit HSTS response header added.
- Existing account, monitoring, research, team, report, and usage capabilities from the current main baseline and integrated history.
- Preview database isolation across all 12 database-backed API routes; Preview cannot obtain a service-role Supabase client.
- Migration parity and public-schema RLS checks are covered by the existing repository validation.

## Latest verified CI evidence for current candidate commit

All four PR-triggered workflows below completed successfully on the latest candidate commit `b8aa25f4efd3a75d49631b03bdff3c4b4521a523` (2026-11-24). This commit changes release-readiness documentation only; the underlying code was last changed in `4ae7e7cadda8463e6845c156935d8bbdce30027f`.

- [x] Main Security Hardening workflow: **275 passed, 0 failed**.
- [x] Research Scope Gate workflow: **57 passed, 0 failed**.
- [x] Production dependency audit: **0 vulnerabilities** reported by npm audit at the configured production dependency threshold.
- [x] Security API checks: concurrent monthly scan quota, two-user Research Lab isolation, pinned DNS transport, Vercel security response headers including HSTS, redirect safety, and the private scan-usage reservation RLS migration test all passed.
- [x] CodeQL Security Analysis workflow completed successfully.
- [x] Vercel Preview deployment for the latest candidate commit `f97db20f13a6b3402a873c2c85cc4c0594530974`: **READY**, URL: https://project-3jyda-6pqvribhh-sentinel-ai14.vercel.app
- [x] Preview database isolation tests cover all 12 database-backed API routes.
- [x] The private-table RLS migration is tested in local CI only; it has **not** been applied to live Supabase.

The Security API job applied the candidate private-table RLS migration to its disposable PostgreSQL CI service and passed the quota-concurrency check. These CI results validate automated checks, not the complete real-user product experience.

## Remaining release blockers

- [ ] **Protected Preview browser test:** Vercel SSO protection prevents a complete browser interaction test until an authorized preview session is available.
- [ ] **Domain ownership end-to-end test:** the DNS TXT, HTTPS file, homepage meta-tag, and Smart Auto Verify logic have automated unit coverage. A full proof using a real domain controlled by the user remains unverified. Do not require the user to buy a domain; use a controlled test domain or an isolated test harness where possible.
- [ ] **Authentication and user-data end-to-end test:** verify sign-up, sign-in, recovery, session, scan history, reports, and AI flows against a dedicated isolated Supabase test project. Generic Preview database access is intentionally blocked because its environment currently contains the production Supabase URL.
- [ ] **Monitoring end-to-end:** scheduler is active every 15 minutes and recent dispatches returned HTTP 200. However, there are no verified active monitoring sites and no monitoring run records. Real customer-site scan and alert creation are therefore not proven. Alerts are currently in-app only; email/webhook delivery is not configured.
- [ ] **Supabase Auth hardening:** leaked-password protection is reported disabled by the security advisor. Enable and verify it before public release; this requires explicit approval for a live setting change.
- [ ] **Private-table RLS defense-in-depth:** CI now tests the candidate migration enabling RLS on `private.scan_usage_reservations`. It is not applied to live Supabase and must be reviewed/approved before rollout.
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
- Do not merge, deploy to Production, change Supabase, or delete branches/files/deployments without explicit approval.

Passing CI and a successful Preview build do not by themselves satisfy the remaining end-to-end release gates above.
