# Custom Domain Readiness — Sentinel AI

Status: **CORE HOST-DETECTION AND CORS BLOCKERS IMPLEMENTED ON PREVIEW; DOMAIN CUTOVER NOT YET READY.**
Candidate PR: #109 (draft; open; unmerged).
Latest reconciled documentation checkpoint: `c0e8fbfd09399ffb4f10670c89d28073fa686c59`.

## Safety boundary

All work so far is limited to the PR #109 reconciliation branch and protected Preview deployments. No Vercel Production settings, DNS records, Production deployment, Supabase settings/data/schema, or live website were changed. Do not merge, deploy, or alter live services without explicit user approval.

## Original findings

1. The frontend previously inferred Production solely from a hard-coded hostname allowlist. A future custom domain would not be recognized and would incorrectly enter Preview Safe Mode.
2. `vercel.json` previously granted cross-origin access only to the old `project-3jyda.vercel.app` hostname, making the configuration non-portable.
3. `robots.txt`, `sitemap.xml`, and `.well-known/security.txt` contain absolute URLs using `project-3jyda.vercel.app`.
4. Password reset uses `window.location.origin`, but Supabase Auth still needs the eventual Production Site URL and exact allowed redirect URLs.
5. The Supabase API URL is independent of the frontend hostname; a Vercel frontend custom domain does not by itself require changing the Supabase API URL or purchasing a Supabase custom-domain add-on.

## Implemented on the candidate branch

- Added `api/_lib/runtime-config.js` to normalize request hostnames and fail closed unless `VERCEL_ENV === "production"` and the request host exactly matches an approved production hostname.
- The approved host list includes the existing legacy Production aliases, Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, and future exact hostnames supplied through the Production-only `SENTINEL_PRODUCTION_HOSTNAMES` environment variable.
- The browser no longer trusts its own `window.location.hostname` to decide whether account/database features may run. It consumes a server-issued runtime configuration before the app script loads. Missing or invalid configuration keeps Preview Safe Mode active.
- To respect the Vercel Hobby limit of 12 Serverless Functions, the runtime configuration response is served through the existing `api/scan.js` function at `/api/scan?runtime_config=1`. No additional API function is retained.
- Removed the stale global `Access-Control-Allow-Origin` header. Browser API calls are same-origin, so a global cross-origin grant is unnecessary; wildcard CORS is not used.
- Updated the security workflow to enforce the same-origin CORS policy.
- Added tests for hostname normalization, existing Production aliases, configured future hostnames, Preview spoof attempts, unknown hosts, missing deployment environment, and the no-extra-function constraint.

## Verification snapshot

On PR #109 code checkpoint `79aad9eca09fac82ccf46c70121556b95c69f1c5`, all four CI workflows (Main Security Hardening, Research Scope Gate, Security API checks, and CodeQL) passed and Vercel Preview reached READY. The documentation-only checkpoint `c0e8fbfd09399ffb4f10670c89d28073fa686c59` also passed all four workflows and reached READY.

## Remaining work before calling custom-domain support ready

- Re-run all four checks and Preview validation after each subsequent code or documentation update.
- Extend the canonical public origin configuration to every generated absolute link and email link; the three public security metadata endpoints are now configurable through `SENTINEL_CANONICAL_HOSTNAME`. Verify all output without changing Production now.
- Review the complete signup, login, password recovery, sign-out, scanner, reports, monitoring, and browser security-header flows on protected Preview. Preview must remain isolated from Production Supabase.
- Confirm the exact Vercel system environment variables available to this project and ensure the future custom-host allowlist is set only in the Production environment.

## Future cutover sequence (not authorized by this document)

1. User purchases and controls the domain; no purchase is implied by this document.
2. Record the exact chosen hostname(s), preferred canonical host, and registrar.
3. Configure `SENTINEL_PRODUCTION_HOSTNAMES` and `SENTINEL_CANONICAL_HOSTNAME` in Vercel Production only, after verifying Preview/Production separation. The canonical hostname must be the chosen verified domain; keep it unset until domain ownership and Vercel assignment are complete.
4. Add the domain to the Vercel project and apply only the exact DNS records Vercel requests. Preserve existing MX/TXT/email records.
5. Verify DNS propagation and automatic SSL certificate issuance.
6. Configure Supabase Auth Site URL and exact redirect allowlist; leave the Supabase project API URL unchanged.
7. Run the full approved smoke-test checklist, then obtain explicit user approval before any Production cutover.
8. Keep the existing `vercel.app` hostname available for rollback unless a deliberate, tested reason requires otherwise.

## Expected outcome

The goal is a controlled cutover without a broad code rewrite. It is not honest or safe to promise that setup will consist only of typing a domain name: domain ownership, DNS, SSL, Vercel assignment, canonical URL configuration, and Auth redirect configuration remain necessary.

## Current decision

**Do not add a real domain now. Do not change Production or live Supabase.** Finish the Preview integration tests, canonical-origin preparation, and all CI checks on PR #109 first.


## Reconciliation update — 2026-11-27

- The current reconciliation branch preserves the newer main-side runtime configuration, Preview isolation, API request guards, monitoring dashboard, and hardened URL handling.
- The fixed-origin `Access-Control-Allow-Origin` header is removed; same-origin API calls do not require a global CORS grant.
- HSTS now includes `includeSubDomains`.
- Supabase recovery is aligned with the email-link flow; the unused OTP-only UI code was removed.
- No Production domain settings, DNS records, Supabase configuration, or Production deployment were changed.


## Protected Preview HTTP smoke check — 2026-11-27

At documentation checkpoint `c0e8fbfd09399ffb4f10670c89d28073fa686c59`, the authenticated Preview homepage returned HTTP 200 and the server-issued runtime config returned `isProduction: false`. Security response headers included HSTS with `includeSubDomains`, CSP, `nosniff`, frame denial, Referrer-Policy, and Permissions-Policy. Static robots, sitemap, and security.txt endpoints returned HTTP 200 but still reference the existing Vercel production origin. This confirms Preview isolation at the runtime-config boundary and basic HTTP delivery only; it is not a full browser/authentication test.


## Latest checkpoint correction — 2026-11-27

- The active release candidate is PR #109, not PR #90. PR #109 remains Draft and unmerged.
- The mobile Lighthouse workflow currently targets Production only; it is not a Preview browser audit. No Preview Lighthouse score is claimed.
- The three static canonical assets still contain the Vercel Production origin. The current repository has no package build script, and adding a dynamic API route would consume the limited Vercel Hobby function budget. Do not change the static deployment/build architecture without a separate tested design.
- The remaining interactive browser, isolated Supabase Auth/data, live owned-domain monitoring-alert, backup/restore, and Auth-plan risk gates remain open. No Production, live Supabase, DNS, or custom-domain change is authorized by this documentation.


## Canonical metadata implementation update — 2026-11-27

- `robots.txt`, `sitemap.xml`, and `.well-known/security.txt` are routed to the existing `api/scan.js` function, which renders the canonical URL from `SENTINEL_CANONICAL_HOSTNAME` when explicitly configured, otherwise falling back to Vercel's `VERCEL_PROJECT_PRODUCTION_URL` system variable. Hostnames are validated before use; Preview responses carry `X-Robots-Tag: noindex`.
- This reuses the existing scanner function and does not add another Vercel Serverless Function. Security metadata unit tests cover the configurable hostname and rolling security.txt expiry. The latest Preview route smoke must pass before calling the change verified.
- Do not set `SENTINEL_CANONICAL_HOSTNAME` until a user-controlled domain has been assigned to Vercel and its DNS/SSL state is verified. No real domain is configured now.
- The current site remains on its Vercel Production domain; no custom domain is owned or configured, and no DNS or Production settings were changed.
- Supabase's private scan-reservation RLS migration is already present in live migration history and was verified read-only. This is not a custom-domain dependency.
