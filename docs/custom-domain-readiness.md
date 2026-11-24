# Custom Domain Readiness — Sentinel AI

Status: **AUDIT COMPLETE; NOT YET READY FOR A ONE-SETTING DOMAIN SWITCH.**
Candidate PR: #90 (draft; do not merge or deploy).
Audited candidate commit: 3657f0560c2f7092b8315f917062a4f6588968c0.

## Safety boundary

This document records preparation only. No Vercel project settings, DNS records, Production deployment, Supabase settings/data/schema, or live website were changed. Do not merge, deploy, or alter live services without explicit user approval.

## Verified findings

1. `sentinel-app.js` has a hard-coded `PRODUCTION_HOSTNAMES` allowlist. `IS_PREVIEW_SAFE_MODE` is derived from that list. A future custom domain is not currently in the list, so the frontend would classify it as Preview and disable account/database-backed functionality. This is a release blocker for custom-domain activation.
2. `vercel.json` sets `Access-Control-Allow-Origin` to the old `https://project-3jyda.vercel.app` hostname. This is not portable to a new hostname. Do not replace it with a wildcard. Review whether this global CORS header is needed at all; same-origin browser requests do not need it. If cross-origin access is required, implement an explicit server-side allowlist and test it.
3. `robots.txt`, `sitemap.xml`, and `.well-known/security.txt` contain absolute URLs using `project-3jyda.vercel.app`. They must be updated to the chosen canonical domain during the approved cutover.
4. Password reset currently uses `window.location.origin` as its redirect target, which is origin-aware. Supabase Auth still requires the eventual production Site URL and exact allowed redirect URLs to be configured before activation.
5. The app's Supabase project URL is the project endpoint, not the frontend hostname. A Vercel frontend custom domain does not by itself require changing the Supabase API URL or purchasing a Supabase custom-domain add-on.

## Required engineering work before a domain can be called plug-and-play

- Replace the frontend hostname-only production detection with a fail-closed, server-issued runtime environment configuration. It must identify the actual Production deployment and validate the incoming host against an explicit configured production-host allowlist; Preview must remain safe even if a Preview hostname is supplied or spoofed.
- Add automated tests proving: the approved custom production hostname is recognized; unknown hosts and all Preview deployments remain in safe mode; a request cannot self-authorize by changing its Host header; and no Preview can access the production Supabase client.
- Remove the fixed old-host CORS response header if not required, or replace it with a tested exact-origin policy. Never use `*` for authenticated APIs.
- Make the canonical public origin configurable for generated metadata (sitemap, robots, security.txt) and verify all absolute links, password reset links, and email links.
- Add the custom domain to the Vercel project, inspect the exact DNS records Vercel returns, configure those records at the registrar, verify DNS propagation and SSL, and choose one canonical host (apex or www) with an explicit redirect.
- Add the chosen exact HTTPS origin to Supabase Auth Site URL and allowed redirect URLs. Keep the existing Supabase project URL unchanged unless a separate, explicitly approved Supabase API custom-domain project is undertaken.
- Test signup, login, password recovery, sign-out, scanner, reports, monitoring, and browser security headers on a protected Preview using an isolated test backend before Production activation.

## Future cutover sequence (not authorized yet)

1. User purchases and controls the domain; no purchase is implied by this document.
2. Record the exact chosen hostname(s), preferred canonical host, and registrar.
3. Configure the allowlist and canonical-origin setting in Vercel Production environment only, after reviewing Preview/Production separation.
4. Add the domain to the Vercel project and apply only the exact DNS records Vercel requests. Preserve existing MX/TXT/email records.
5. Verify DNS and automatic SSL certificate issuance.
6. Configure Supabase Auth Site URL and exact redirect allowlist; do not alter database schema or user data.
7. Run the full approved smoke-test checklist, then request explicit user approval before any Production cutover.
8. Keep the existing `vercel.app` hostname available as a rollback route unless there is a deliberate, tested reason to change it.

## Expected outcome

The target is a controlled, repeatable cutover with no broad code rewrite. It is **not honest or safe to promise that future setup will be only typing a domain name**: DNS ownership, SSL, Vercel project assignment, and Auth redirect configuration remain required. Once the engineering blockers and tests above are completed, the future domain change should be limited mainly to approved configuration and DNS steps.

## Current decision

**Do not add a real domain now. Do not change Production or live Supabase.** Implement and test the runtime-host and CORS fixes on the existing PR #90 candidate branch first.
