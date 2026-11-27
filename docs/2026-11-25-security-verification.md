# Sentinel AI — Security Verification Snapshot (2026-11-25)

Scope: read-only review of candidate branch `fix/api-request-size-limits-2026-11-24`, PR #90, GitHub Actions, and its Vercel Preview. This document records evidence only; it does not authorize release.

## Verified source controls

- Scanner resolves hostnames with `dns.lookup(..., { all: true, verbatim: true })` and rejects the hostname if any returned address fails `isPublicIP`.
- Direct IPv4/IPv6 destinations are checked by the same public-IP policy.
- `createPinnedRequest` validates the selected address and supplies a pinned DNS lookup callback to the HTTP(S) transport; it does not ask the transport to resolve the hostname again.
- Redirects are handled manually. Each destination is revalidated before a pinned request; redirect bodies are cancelled; the maximum is five redirects.
- IPv4 and IPv6 ranges are explicitly handled in `api/_lib/public-ip.js`; non-global IPv6 outside `2000::/3` is rejected.
- Scanner response readers enforce byte and elapsed-time limits; the main HTML body is capped at 5 MiB.
- Request JSON checks currently cap downstream processing at 16 KiB (Scan), 32 KiB (AI Mentor), and 512 KiB (Reports). These checks run after Vercel has parsed `req.body`; they are not pre-parser ingress or memory limits.
- AI Mentor input is normalized and bounded; model output is schema/length checked and filtered for unsafe action patterns. Upstream response reading is capped at 256 KiB and 10 seconds, with a built-in fallback.
- Report input validates URL, score range, checks array/count, text/evidence field sizes, and recalculates score/risk server-side instead of trusting browser-supplied score.

## Current CI evidence

For candidate head `ee6501637706160f2b602a2a5687a884464b003d`, GitHub Actions workflow runs were completed successfully:
- Main Security Hardening — run 259; all job steps successful. The live scanner smoke-test step was skipped (it is restricted to PR #80).
- Security API checks — run 523; syntax/unit tests, pinned-DNS guard, security headers, and manual redirect safety steps successful.
- Research Scope Gate Tests — run 193; successful.
- CodeQL Security Analysis — run 114; successful.

The test job uses its CI fixtures/disposable services. Passing tests are not proof of a live external attack simulation or a real customer-domain scan.

## Vercel Preview evidence

- Deployment: `dpl_617a4UoFHxnsRFBrs9gApcdxWkLG`
- Exact source commit: `ee6501637706160f2b602a2a5687a884464b003d`
- State: READY
- Preview URL: https://project-3jyda-16xep8ay3-sentinel-ai14.vercel.app
- Preview alias: https://project-3jyda-git-fix-api-request-size-lim-2feedd-sentinel-ai14.vercel.app

READY confirms the deployment build state, not authenticated browser workflows or production readiness.

## Open verification gaps

1. Protected Preview browser session is still needed for real UI/auth workflows.
2. No external DNS-rebinding attack simulation or real customer-domain scan was performed in this review.
3. No pre-parser raw request-body streaming limit is configured/verified; current guards run after parsing.
4. Preview AI provider behavior is not proven end-to-end; Preview may not have an AI provider key. The model identifier in source also requires a real provider call to verify.
5. Monitoring CI uses fake database/scan clients; a real authorized domain scan, alert, and persistence cycle remains unverified.
6. Mobile/browser accessibility and cross-browser review remain pending.

## Release boundaries

PR #90 remains Draft and unmerged. No merge to `main`, Production deployment, Supabase data/schema/environment change, or deletion of any file/branch/deployment was performed for this audit.
