# Sentinel AI Release Readiness

Status: **Prepared release candidate; NOT ready for production merge/deployment.**

Candidate PR: #90 (draft, base `main`)
Candidate branch: `fix/api-request-size-limits-2026-11-24`
Code validation commit: `a2340070c699de9dd2a8cedb30edfac24babef66`
Current production deployment to preserve for rollback: `dpl_EMgCFrnCnwDuk9NPdzQWTJj2rjW8` (main deployment, commit `0f9f61da9447c40320d91ef4a3f61ce53b84e744`).

## Included development work

- Consolidated the PR #83/#84/#85 workstream and PR #90 additions into one release candidate based on current `main`.
- Website ownership verification: DNS TXT, HTTPS verification file, homepage meta tag, and Smart Auto Verify.
- HTML5-based link discovery and HTTP/HTTPS-only scanner URL parsing.
- Request payload size checks for Scan, AI Mentor, and Reports.
- More conservative security-header analysis and scoring; explicit HSTS response header added.
- Existing account, monitoring, research, team, report, and usage capabilities from the current main baseline and integrated history.
- Historical drafts #40, #39, and #12 were checked: their work is marked superseded by the PR #41 reconciliation and is present in the current main/candidate line.

## Verified candidate checks

- [x] Security regression suite: 218 passed, 0 failed, 0 skipped.
- [x] Main security hardening suite: 275 passed, 0 failed, 0 skipped.
- [x] Research scope gate suite: 57 passed, 0 failed, 0 skipped.
- [x] Production dependency audit: 0 vulnerabilities reported at the configured high-severity threshold.
- [x] Security API checks: concurrent scan allowance, two-user Research Lab isolation, pinned DNS transport, response headers including HSTS, and redirect safety passed.
- [x] CodeQL: successful; no new alerts in code changed by this pull request.
- [x] Vercel Preview build: READY on the candidate branch.
- [x] Preview database isolation: all 12 database-backed API routes use the shared client guard; Vercel Preview returns no service-role Supabase client. Browser Preview Safe Mode points the client at a non-routable placeholder and clearly explains disabled preview features.
- [x] Production host allowlist: all three current Vercel Production aliases are recognized; other deployment hostnames remain in Preview Safe Mode.
- [x] Supabase migration parity: 20 repository migrations and 20 applied migrations; no mismatch found.
- [x] Public-schema RLS review: no public tables found with RLS disabled; owner/member policies are present. Public SECURITY DEFINER functions are restricted to postgres/service_role execution.

## Remaining release blockers

- [ ] **Browser-level Preview test:** Vercel SSO protection is enabled for Preview deployments. The build is READY, but a full browser interaction test could not be completed through the available protected-preview access.
- [ ] **Domain ownership test:** prove DNS/file/meta verification end-to-end on a separate domain controlled by the user.
- [ ] **Authentication test:** verify sign-up, sign-in, recovery, session, scan history, and report/AI flows against a dedicated isolated Supabase test project. Preview database access is intentionally blocked because the generic Preview environment currently carries the production Supabase URL.
- [ ] **Monitoring end-to-end:** scheduler is active every 15 minutes; 96 scheduler runs succeeded in the last 24 hours and 24 HTTP responses were 200. However, there are 0 verified active monitoring sites, 1 pending site, and 0 monitoring run records. Real scan-and-alert delivery is therefore not proven.
- [ ] **Supabase Auth hardening:** the security advisor reports leaked-password protection is disabled. Enable and verify it before public release.
- [ ] **RLS defense-in-depth review:** the advisor flags `private.scan_usage_reservations` because RLS is disabled. Read-only SQL showed no direct table privileges for anon/authenticated and the table ACL is restricted to postgres, but the RLS warning remains open. Do not auto-apply a database change; review the migration and approve it explicitly.
- [ ] **Backup readiness:** the Supabase organization is on the Free plan, which does not provide scheduled database backups. Arrange an approved backup/restore method before production release.
- [ ] **Request ingress limit:** the current JSON size checks run after Vercel has decoded `req.body`; they cap downstream processing but are not a pre-parser streaming/memory limit. Decide whether a raw-body streaming limit is required before launch.
- [ ] **Mobile/browser verification:** complete real mobile accessibility, layout, and cross-browser checks against the candidate.

## Rollout and rollback plan

1. Keep PR #90 as a draft until every release blocker above is resolved.
2. Do not merge to `main` or deploy to Production without explicit user approval.
3. Before an approved rollout, capture a verified database backup/export and confirm the production environment variables.
4. Deploy only after approval, then verify homepage, scanner, auth, reports, monitoring, and alert delivery.
5. If release verification fails, restore the previous known-good Vercel Production deployment `dpl_EMgCFrnCnwDuk9NPdzQWTJj2rjW8` and investigate before retrying.

## Safety boundaries

- Preparation changes are confined to this candidate branch.
- Production deployment and live Supabase schema/data/settings have not been changed.
- Do not merge, deploy to Production, change Supabase, or delete branches/files/deployments without explicit approval.

Passing CI and a successful Preview build do not by themselves satisfy the remaining end-to-end release gates above.
