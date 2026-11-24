# Custom Domain Readiness — Sentinel AI

Status: **CORE HOST-DETECTION AND CORS BLOCKERS IMPLEMENTED ON PREVIEW; DOMAIN CUTOVER NOT YET READY.**
Candidate PR: #90 (draft; open; unmerged).
Latest audited implementation: `67a6b72180b98843a5242eba7ad30a6e2947a64c`.

## Safety boundary

All work so far is limited to the PR #90 candidate branch and protected Preview deployments. No Vercel Production settings, DNS records, Production deployment, Supabase settings/data/schema, or live website were changed. Do not merge, deploy, or alter live services without explicit user approval.

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

At commit `0c2e6c3a3715c91c4a174408720b686e74607de6`, Vercel Preview was READY, Main Security Hardening passed, Research Scope Gate passed, and Sentinel AI security API checks passed. CodeQL was still running at the time of that snapshot.

The follow-up no-extra-function regression test was added in commit `67a6b72180b98843a5242eba7ad30a6e2947a64c`; its Preview deployment reached READY. Its CI checks were still running at the time this document was updated. Do not treat pending checks as passed.

## Remaining work before calling custom-domain support ready

- Complete the latest CI run, including CodeQL, and inspect any failures.
- Add a focused integration test for the runtime-config GET response through the existing scan API handler, including a Preview request and a Production allowlisted-host request.
- Make the canonical public origin configurable for `robots.txt`, `sitemap.xml`, `.well-known/security.txt`, generated absolute links, and email links; verify the result without changing Production now.
- Review the complete signup, login, password recovery, sign-out, scanner, reports, monitoring, and browser security-header flows on protected Preview. Preview must remain isolated from Production Supabase.
- Confirm the exact Vercel system environment variables available to this project and ensure the future custom-host allowlist is set only in the Production environment.

## Future cutover sequence (not authorized by this document)

1. User purchases and controls the domain; no purchase is implied by this document.
2. Record the exact chosen hostname(s), preferred canonical host, and registrar.
3. Configure `SENTINEL_PRODUCTION_HOSTNAMES` and canonical-origin settings in Vercel Production only, after verifying Preview/Production separation.
4. Add the domain to the Vercel project and apply only the exact DNS records Vercel requests. Preserve existing MX/TXT/email records.
5. Verify DNS propagation and automatic SSL certificate issuance.
6. Configure Supabase Auth Site URL and exact redirect allowlist; leave the Supabase project API URL unchanged.
7. Run the full approved smoke-test checklist, then obtain explicit user approval before any Production cutover.
8. Keep the existing `vercel.app` hostname available for rollback unless a deliberate, tested reason requires otherwise.

## Expected outcome

The goal is a controlled cutover without a broad code rewrite. It is not honest or safe to promise that setup will consist only of typing a domain name: domain ownership, DNS, SSL, Vercel assignment, canonical URL configuration, and Auth redirect configuration remain necessary.

## Current decision

**Do not add a real domain now. Do not change Production or live Supabase.** Finish the Preview integration tests, canonical-origin preparation, and all CI checks on PR #90 first.
