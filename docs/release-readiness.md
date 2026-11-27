# Sentinel AI Release Readiness

Status: **Reconciled release candidate; NOT yet approved for Production rollout.**

Candidate PR: #109 (draft, base `main`; GitHub currently reports mergeable)
Candidate branch: `reconcile/release-candidate-2026-11-27`
Latest Preview candidate checkpoint: `708fa4492b15bc168daad6696e6e8fe1da830dde` (2026-11-27). This head is Preview READY; its fresh CI runs are still in progress/queued.
Latest documentation-only candidate checkpoint: the current PR #109 head; use the PR's exact commit and attached status checks for traceability.
Current known-good Production deployment to preserve for rollback: `dpl_9eJzwsTPcCLcVLWJNXXHS7nge9ae` (Production target, `main`, commit `e8c0ae65d7b9f79291b3e2cdfb890af6b3ebd401`).

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

The following results are historical evidence for the earlier PR #90 candidate code commit `7bbc37e3154f676b4fb5990a7a653da56b570e80`:

- [x] Main Security Hardening: **283 passed, 0 failed**; dependency audit and API syntax steps completed successfully.
- [x] Research Scope Gate: **57 passed, 0 failed**.
- [x] Security API checks: **226 passed, 0 failed**; database isolation, pinned-DNS, response-header, and redirect-safety checks also passed.
- [x] CodeQL Security Analysis: **success**.
- [x] Vercel Preview: **success/READY**, Preview deployment only. No Production deployment was changed.
- [x] All seven check runs for this exact candidate code commit completed successfully.

For the reconciled PR #109 code checkpoint `79aad9eca09fac82ccf46c70121556b95c69f1c5`, Main Security Hardening, Research Scope Gate, Security API checks, and CodeQL all completed successfully. The latest documentation-only PR #109 head also received fresh successful runs for all four workflows and a READY Vercel Preview.

The monitoring tests use fake database and scan clients. They prove simulated worker control flow and failure isolation, not a live Supabase/customer-domain scan or real alert delivery.

The Security API job applies the candidate private-table RLS migration to its disposable CI PostgreSQL service. It has **not** been applied to live Supabase.

## Remaining release blockers

- [ ] **Protected Preview browser test:** the CI browser suite now runs desktop/tablet/mobile, keyboard navigation, and Axe WCAG checks against an isolated local Preview-safe build. It does not bypass Vercel SSO or claim an authenticated browser session against the protected hosted Preview. The hosted Preview's HTTP smoke is verified separately.
- [ ] **Domain ownership end-to-end test:** DNS TXT, HTTPS file, homepage meta-tag, and Smart Auto Verify logic have automated unit coverage. A full proof using a real domain controlled by the user remains unverified. Do not require the user to buy a domain; use a controlled test domain or isolated test harness where possible.
- [ ] **Authentication and user-data end-to-end test:** a local isolated Supabase Auth browser workflow now covers sign-up, sign-in, sign-out, recovery email, and password update. The first run exposed a test-only transient-status race, which was corrected; the next run must pass. Scan history, reports, and AI/account-data flows still require separate isolated integration coverage. Generic Preview database access remains intentionally blocked.
- [ ] **Monitoring alert end-to-end:** live read-only verification on 2026-11-27 found one active, verified owned project hostname (`project-3jyda.vercel.app`), 171 successful monitoring runs, and the latest 10 runs all 100/100 Low with no errors. The alert table is currently empty; no controlled alert was triggered, and external email/webhook delivery is not configured. Do not induce a Production regression merely to create an alert.
- [ ] **Supabase Auth hardening:** leaked-password protection is not included in the Supabase Free plan (current plan documentation). It cannot be treated as a setting we can simply enable on the current tier. Before public release, either obtain an eligible plan with separate user approval or document an explicit risk acceptance and compensating controls; do not attempt a paid upgrade.
- [x] **Private-table RLS defense-in-depth:** live migration history contains `20261125121456 enable_rls_private_scan_usage_reservations`. Read-only checks confirm RLS is enabled, there are no client-facing table grants or policies, and the three SECURITY DEFINER allowance functions are owned by `postgres`, executable by `service_role` only, and not executable by `anon` or `authenticated`. The Supabase advisor's INFO finding (RLS enabled/no policy) is expected for this private fail-closed table.
- [ ] **Backup readiness:** the Free-plan export/restore runbook is documented, but no Production export, checksum, encrypted off-site copy, or isolated restore has been performed.
- [ ] **Mobile/browser verification:** the local browser suite now covers 360/390/768/1280px widths, horizontal overflow, keyboard activation, password visibility, page errors, and critical WCAG violations. It must pass on the latest head. A real hosted protected-Preview browser session and additional cross-browser/device testing remain open.

## Verified environment configuration (2026-11-26)

- Vercel environment-variable names and targets were inspected with decryption disabled; no secret values were read or exposed.
- `CRON_SECRET` is present for the **Production** target and also has Preview-target entries.
- This supersedes the older note in GitHub issue #22 that Production did not have `CRON_SECRET`.
- Presence of the variable does **not** prove that the production scheduler successfully invokes the worker or that a live monitoring run and alert complete. Those end-to-end checks remain open.
- Do not copy, reveal, rotate, or change secret values as part of this documentation update.

## Rollout and rollback plan

1. Keep PR #109 as a draft until every release blocker above is resolved or explicitly accepted with documented risk.
2. The user has authorized merge to `main` and Production deployment once all release gates are satisfied. Do not bypass an open gate; live Supabase schema, data, or Auth-setting changes still require separate explicit approval.
3. Before an approved rollout, capture a verified database backup/export and confirm production environment variables.
4. Deploy only after approval, then verify homepage, scanner, auth, reports, monitoring, and alert delivery.
5. If release verification fails, restore the previous known-good Vercel Production deployment `dpl_9eJzwsTPcCLcVLWJNXXHS7nge9ae` and investigate before retrying.

## Safety boundaries

- Preparation changes are confined to `reconcile/release-candidate-2026-11-27` and protected Preview deployments.
- Production deployment and live Supabase schema/data/settings have not been changed by this readiness update.
- No branches, files, or deployments have been deleted.
- Merge and Production deployment are authorized only after every required release gate is passed. Live Supabase schema, data, and Auth-setting changes still require separate explicit approval. Never delete branches, files, or deployments.

Passing CI and a successful Preview build do not by themselves satisfy the remaining end-to-end release gates above.

## Request parser ingress limits (2026-11-25)

- Added Vercel API body-parser limits before the handler receives `req.body`: Scan 32 KiB, AI Mentor 64 KiB, Reports 1 MiB.
- Retained application-level JSON byte limits: Scan 32 KiB, AI Mentor 32 KiB, Reports 512 KiB.
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


## Live production scheduler verification (2026-11-26)

- Read-only Supabase inspection confirms the job `sentinel-monitoring-every-15-minutes` is present and active with schedule `*/15 * * * *`.
- The 10 most recent `cron.job_run_details` entries all report `succeeded`.
- The latest retained `pg_net` HTTP response for the worker endpoint is HTTP **200**, with `ok: true`, `claimed: 1`, `succeeded: 1`, `failed: 0`, `alerts: 0`, and `retries: 0`.
- This confirms the scheduler, authenticated worker invocation, and one real production monitoring batch succeeded. It does not prove email/webhook delivery; alerts remain in-app. Zero alerts means no alert condition was raised in that run, not that alert delivery was tested.
- Secret values were not queried or exposed. No database writes or configuration changes were made during this verification.


## Reconciliation progress — 2026-11-27

- Created PR #109 from the exact current Production `main` commit `e8c0ae65d7b9f79291b3e2cdfb890af6b3ebd401`; the branch is separate from Production.
- Reviewed all 22 paths that had diverged between the old PR #90 candidate and current `main`. Newer main-side protections were retained where they superseded older candidate code; missing monitoring response validation, test coverage, and worker testability were integrated into the reconciliation branch.
- Added dependency-injected monitoring worker handler tests for successful runs, failures, retries, batch isolation, and persistence failures. Added rejection tests for invalid successful scan responses.
- Corrected browser password recovery to use Supabase's email recovery link; removed OTP code that had no matching OTP inputs in the HTML.
- Kept auth-state callbacks synchronous, deferred account UI refreshes, and cleared the session timeout.
- Removed the fixed-origin CORS grant and set HSTS to `max-age=31536000; includeSubDomains`; added an accessible Preview Safe Mode scanner notice.
- Updated parser-limit and URL-scheme regression tests to match the current `main` implementation.
- At checkpoint `79aad9eca09fac82ccf46c70121556b95c69f1c5`, GitHub reported PR #109 mergeable, Main Security Hardening passed, Research Scope Gate passed, Security API checks passed, and Vercel Preview reached READY. CodeQL was still running.
- No Production deployment, `main` update, or live Supabase migration/settings/data change was performed.


## Protected Preview smoke check — 2026-11-27

For the latest verified PR #109 Preview checkpoint, the protected Preview was fetched through Vercel's authenticated share mechanism:

- Homepage returned HTTP 200.
- `/api/scan?runtime_config=1` returned HTTP 200 and explicitly set `isProduction: false`; Preview Safe Mode therefore remains active.
- The homepage response included CSP, HSTS (`max-age=31536000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, and a restrictive Permissions-Policy.
- `robots.txt`, `sitemap.xml`, and `.well-known/security.txt` returned HTTP 200. Their canonical references still use the current `project-3jyda.vercel.app` origin; configurable canonical-origin support remains open before any future custom-domain cutover.
- No Preview runtime logs were recorded in the inspected 30-minute window.

This was an authenticated HTTP smoke check, not a full interactive browser test. It did not sign in, access user data, submit a scan, call live Supabase, or prove domain ownership.


## Mobile audit scope clarification

The existing `.github/workflows/mobile-lighthouse.yml` runs on pushes to `main`, weekly schedule, or manual dispatch, and its target is the Production URL. It does not automatically audit this protected Preview. No candidate-specific Lighthouse score is claimed here; mobile and cross-browser verification remains open.


## Latest candidate verification and monitoring-origin hardening — 2026-11-27

Exact candidate head: `dd84d560b68cca1d5c18b4b9e55b12a28137aea7`.

- Main Security Hardening: **317 passed, 0 failed**.
- Security API checks: **260 passed, 0 failed**.
- Research Scope Gate: **57 passed, 0 failed**.
- CodeQL Security Analysis: **success**.
- Vercel Preview for this exact commit: **READY**; Vercel commit status: success.
- Authenticated Preview HTTP smoke: homepage 200; `/api/scan?runtime_config=1` returned `isProduction: false` and `Cache-Control: no-store`.
- Preview response headers include CSP, HSTS, nosniff, frame denial, Referrer-Policy, and Permissions-Policy.
- `robots.txt`, `sitemap.xml`, and `.well-known/security.txt` each returned HTTP 200. Their canonical references still point to `https://project-3jyda.vercel.app`; replace these references as part of a future authorized custom-domain cutover.
- Preview runtime logs: no entries in the inspected 30-minute window.
- A production-specific monitoring-origin guard was added: when `VERCEL_ENV=production`, the worker derives its origin only from `VERCEL_PROJECT_PRODUCTION_URL` and does not trust request Host / Forwarded-Host. If the configured Production host is missing or invalid, it fails closed before queue processing, database access, or outbound requests.
- Regression test confirms that missing Production canonical host results in zero Supabase calls and zero outbound fetches. The test passed in Main Security Hardening (317) and Security API checks (260).
- Source inspection of Preview JavaScript found no use of `eval()` or `new Function()`; inspected dynamic HTML render paths escape database/API-provided values with `escapeHTML`. This is a focused source review, not a complete browser XSS assessment.
- The Vercel GUI sandbox was not used because it is billable. Therefore full interactive browser/mobile accessibility verification remains open; no Lighthouse score is claimed for this candidate.
- No Production deployment, `main` merge, live Supabase schema/data/Auth-setting change, DNS change, or custom-domain change was made.


## Authoritative corrections and backup runbook — 2026-11-27

- The authoritative latest application-code verification is commit `dd84d560b68cca1d5c18b4b9e55b12a28137aea7`: Main Security Hardening 317/317, Security API 260/260, Research Scope Gate 57/57, and CodeQL success.
- The later PR head `f9245e1a6ac0382f6d74645040a7141caa353d3d` was documentation-only. The four successful workflow runs are associated with the tested application-code commit, not fresh executions on the documentation-only commit. Any older statement in this document claiming that all four workflows ran freshly on the docs-only head is superseded by this clarification.
- Supabase's current Free-plan documentation says automatic backups are not included and leaked-password protection is not included. The earlier wording that implied leaked-password protection could simply be enabled on the existing Free tier is corrected above. No plan upgrade or Auth setting was changed.
- Added `docs/free-plan-backup-restore-runbook.md` with a non-destructive CLI logical-export and isolated-restore procedure. It is documentation only: no Production export, credential access, backup creation, or restore was performed. The backup/restore release gate remains open until an actual isolated restore is verified.
- The CLI logical dump excludes Supabase-managed `auth` and `storage` schemas and Storage file objects; Auth configuration, Storage objects, Edge Functions, Realtime and project settings need separate recovery steps. A SQL dump alone is not a complete Supabase project backup.
- Sources checked: Supabase [Database Backups](https://supabase.com/docs/guides/platform/backups), [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), and [Free-plan pricing](https://supabase.com/pricing). 
- These documentation corrections do not close the browser/mobile, isolated Auth E2E, live monitoring-alert E2E, Auth plan-capability, or backup/restore verification gates.


## Preview verification checkpoint — 2026-11-27 12:41 UTC

For documentation head `1cd997dbef813e0b9a62fd568499ea233e8dedaf` (application code remains unchanged from the tested `dd84d560...`):

- Vercel Preview deployment `dpl_FcJkkRCdA4hv6XNkVXgnSKrPNJJK` reached **READY** and its Vercel commit status is success.
- Homepage returned HTTP 200. Runtime config returned exactly `isProduction:false` with `Cache-Control:no-store`.
- `sentinel-app.js`, `sentinel-actions.js`, `sentinel-analytics.js`, `sentinel.css`, and the Researcher Preview guide all returned HTTP 200.
- CSP, HSTS (`max-age=31536000; includeSubDomains`), nosniff, X-Frame-Options DENY, Referrer-Policy, and Permissions-Policy were present.
- `robots.txt`, `sitemap.xml`, and `.well-known/security.txt` returned HTTP 200. Canonical URLs still point to the current Production Vercel origin; no custom-domain change is implied.
- Direct GET to `/api/scan` without the required method returned HTTP 405 with `Cache-Control:no-store`, as expected.
- No Preview runtime logs were found in the inspected 30-minute window.
- GitHub workflow jobs on this docs checkpoint: Main Security Hardening success; Security API checks success; Research Scope Gate success; CodeQL success. These checks do not replace interactive browser testing.
- Static mobile CSS review shows a max-width 650px layout adjustment, single-column summary/auth controls, responsive card/analytics grids, and wrapping research action controls. This is source inspection, not a device/browser accessibility audit.

The subsequent runbook-only commits correct the documented CLI flag to `--db-url` and add the official isolated `psql` restore pattern. No backup, restore, Production request, or live Supabase operation was performed. The newest documentation-only head must still receive its own Preview/CI confirmation.


## Reconciliation checkpoint — 2026-11-27 (latest documentation head before this note)

- Exact candidate head checked: `896d8cab2236d7874d06ab4ca70b10a3de157070`; PR #109 is open, Draft, and GitHub reports `mergeable: true`. This is not release approval.
- Four PR workflows on that exact head completed successfully: Main Security Hardening, Security API checks, Research Scope Gate, and CodeQL. The authoritative application-code test counts remain 317, 260, and 57 respectively on tested code commit `dd84d560b68cca1d5c18b4b9e55b12a28137aea7`; the latest docs-only head does not change application code.
- Vercel Preview `dpl_FEbiYzYq7ssfzVtZ5wW5N6yqaEQu` is READY for that exact docs head. The authenticated HTTP smoke and runbook delivery were previously verified; this does not constitute an interactive browser audit.
- The mobile Lighthouse workflow currently runs against Production on main push, weekly schedule, or manual dispatch. It does not test PR #109 Preview. No Preview Lighthouse score or interactive mobile/browser result is claimed. Protected Preview authentication cannot safely be bypassed or exposed to a public CI runner; the billable Vercel GUI browser sandbox was not used.
- The three static canonical assets (`robots.txt`, `sitemap.xml`, and `.well-known/security.txt`) still embed the current Vercel Production hostname. No custom domain is owned/configured. Do not add a runtime API function or alter the Vercel build/output pipeline merely to replace these static URLs without a separately tested implementation; Vercel Hobby has a 12-function ceiling and the current static deployment has no package build script.
- The isolated Supabase Auth/account E2E, owned-domain monitoring-alert E2E, actual backup/checksum/off-site/restore proof, live private-table RLS rollout, and Free-plan Auth risk decision remain open. They require an isolated test project, user-owned domain/asset registration approval, a secure workstation and isolated restore target, and/or explicit user risk acceptance. No Production or live Supabase changes were made.


## Authoritative live Supabase and monitoring verification — 2026-11-27

The following read-only checks were performed directly against the current Supabase Production project after the earlier readiness notes above. These results supersede the older statements that the private-table RLS migration and scheduler setup were not live.

- Migration `20261124120500_sentinel_scan_usage_reservations_rls` is present in the live migration history.
- Live catalog inspection confirms `private.scan_usage_reservations` has RLS enabled. `anon`, `authenticated`, and `service_role` have no direct SELECT/INSERT/UPDATE/DELETE privilege; PUBLIC has no such grant.
- The three reservation functions (`reserve_scan_allowance`, `complete_scan_allowance`, `cancel_scan_allowance`) are owned by `postgres`, run as SECURITY DEFINER with an empty search_path, deny EXECUTE to `anon` and `authenticated`, and grant EXECUTE only to `service_role`.
- Supabase's `rls_enabled_no_policy` advisory on this private table is expected for this design: clients have no table privileges and the server calls only the narrowly granted SECURITY DEFINER functions. Do not add a client policy or grant direct table access to silence the advisory.
- Production `cron.job` confirms the 15-minute monitoring job is active. The Production Vercel environment contains `CRON_SECRET`; the matching named secret exists in Supabase Vault. Secret values were not read.
- One user-owned verified asset, `https://project-3jyda.vercel.app/`, is active in monitoring. The live database contains 169 monitoring runs; the 12 most recent inspected runs succeeded with score 100 / Low. Total alerts currently equals zero. This proves recurring live scans, not an alert-delivery event; no alert was expected because the target remained clean.
- The private-table RLS rollout gate is therefore **closed and verified live**. The real 15-minute scheduler and recurring scan gate is **closed and verified live**. The real alert-trigger/delivery gate remains open because no real alert condition has been triggered and alerts are in-app only.

## Latest candidate implementation — 2026-11-27

- Added a Preview-only Playwright workflow with mobile/tablet/desktop viewport checks, keyboard interaction, password-visibility control, axe critical accessibility checks, and canonical metadata endpoint assertions. It uses the Vercel branch Preview alias and no Vercel/Supabase secrets. Its result must be checked on the latest PR head before claiming browser verification.
- Added canonical robots.txt and sitemap responses through the existing `api/scan.js` function, using the Vercel system Production hostname and explicit Preview noindex. This does not add a serverless function. The `.well-known/security.txt` file remains static and correctly points to the current Production hostname; update it as part of any future custom-domain cutover. The Vercel routes and Preview behavior must pass the latest Preview checks before release.
- Added CI assertions that the private scan reservation table has no direct client/service-role table grants and that only `service_role` can execute the tightly scoped reservation functions.
- Signup and password recovery UI now require a unique password of at least 12 characters. This is an application-side usability/security guard only; it does **not** replace Supabase's server-side leaked-password protection. Supabase documents leaked-password protection as Pro-and-above, so the Free-plan limitation remains explicit.
- No Production deployment, main merge, DNS/custom-domain change, or live Supabase schema/data/Auth-setting mutation was made by these candidate updates.

## Remaining blockers after latest live checks

- [ ] Latest Preview Playwright run must pass, including actual canonical route resolution and responsive/axe checks.
- [ ] Full authentication/account-data E2E still needs an isolated Supabase test environment. No test user was created in Production and no production user data was changed.
- [ ] A real alert event and delivery proof remains open; existing monitoring has 169 successful runs and no alerts because the monitored production asset is clean. Email/webhook delivery is not configured.
- [ ] Actual database export, checksum, off-site copy, and isolated restore are still not performed. The mobile-only workflow and missing secure workstation/database password prevent a trustworthy restore proof through the currently available access. No live data export was attempted.
- [ ] Supabase Free leaked-password protection remains unavailable. The UI 12-character guard is compensating only, not server-side enforcement. No paid plan change was made.
- [ ] `.well-known/security.txt` must be updated during any future custom-domain cutover; no custom domain is currently owned or configured.


## Release candidate scope and live operations refresh — 2026-11-27 15:00 UTC

- PR #109 contains exactly one database migration: `20261124120500_sentinel_scan_usage_reservations_rls.sql`. That migration is already recorded in the live Production migration history and its table/function grants were independently verified. There is no unapplied database migration in this candidate; merging this PR does not itself run SQL against Production.
- A fresh read-only Production check confirms cron job 1 is active on `*/15 * * * *`, Vercel Production has a `CRON_SECRET` environment variable, and Supabase Vault contains `sentinel_monitoring_cron_secret`. Secret values were not read.
- Monitoring now records 170 runs across one active verified asset. The latest 10 runs all succeeded with score 100 / Low. There are currently zero alert rows; no alert has been fabricated or forced against the live site.
- The protected Preview browser workflow completes safely but skips its Playwright step when Vercel redirects/blocks the public runner. The Preview remains protected; no bypass token is stored in GitHub or exposed in workflow logs. A narrowly scoped GitHub OIDC trusted-source rule is awaiting explicit user authorization before enabling CI access.
- Local Auth E2E now uses a temporary local Supabase stack and Mailpit; it does not connect to Production. The first run reached the real local Auth service but failed on a malformed recovery-link regex in the test itself. That test parser has been corrected; the next run must pass before marking Auth lifecycle E2E closed.
- Full Production backup/restore is still not verified. The current release candidate has no unapplied schema migration, so this remains an operational resilience gap rather than a pending database deployment step. Do not claim backup/restore completion.


## Read-only Production verification — 2026-11-27

- Supabase migration history includes `20261125121456 enable_rls_private_scan_usage_reservations`.
- `private.scan_usage_reservations` has RLS enabled; only the `postgres` role has direct table privileges; there are no policies. This is deliberate fail-closed behavior because the table is private and application access is through restricted SECURITY DEFINER functions.
- `reserve_scan_allowance`, `complete_scan_allowance`, and `cancel_scan_allowance` are SECURITY DEFINER functions owned by `postgres`; only `service_role` can execute them. `anon` and `authenticated` cannot execute them.
- Supabase Security Advisor reports one WARN: leaked-password protection disabled (not available on the current Free plan), plus one INFO for the private RLS/no-policy table (expected). Health Advisor reports no findings. Performance Advisor lists 16 unused indexes; they are not being dropped because the low-volume beta does not justify a speculative Production schema change.
- Monitoring database read-only checks: 1 active verified site; 171 monitoring runs, all succeeded; latest 10 consecutive runs each scored 100/100 Low; no monitoring alerts exist. This proves scheduler/scan persistence, not alert delivery.
- Candidate Preview head `708fa4492b15bc168daad6696e6e8fe1da830dde` reached Vercel READY. Homepage, runtime config, robots.txt, sitemap.xml, and .well-known/security.txt returned HTTP 200. Preview runtime config was `isProduction:false` with `Cache-Control:no-store`; all three metadata resources now render the configured canonical Production origin. The security.txt expiry is generated one year ahead.
- The browser CI workflow was changed to run the browser/accessibility suite against an isolated local Preview-safe server. It does not use a Vercel bypass token and does not claim direct browser access to the protected Preview.
- Latest CI runs for this candidate are queued/pending; do not mark this checkpoint fully verified until all required checks complete successfully.
