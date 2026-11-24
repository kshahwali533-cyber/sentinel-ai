# Sentinel AI Release Readiness

Status: Draft release candidate — not approved for production.

Candidate branch: `fix/api-request-size-limits-2026-11-24`
Candidate base: `main`
Candidate head before this checklist: `7a4a6ce2741ee191537e856e6c66a26ae0619bdb`

## Included development work

- Integrated domain verification and scanner discovery hardening from the PR #83/#84/#85 workstream.
- HTML5-based link discovery and HTTP(S)-only scanner URL parsing.
- DNS TXT, HTTPS verification-file, homepage meta-tag, and Smart Auto Verify paths.
- Request payload size limits for scan, AI Mentor, and report APIs.
- More conservative security-header analysis and scoring.
- Existing monitoring, researcher, team, report, and account capabilities inherited from the current main baseline and integration history.

## Required release gates

- [ ] Run the complete security/API test workflows on this exact consolidated candidate.
- [ ] Confirm CodeQL and dependency audit results on this exact candidate.
- [ ] Complete a safe preview smoke test for the public scanner and core UI.
- [ ] Test domain ownership proof against a separately controlled custom domain.
- [ ] Test authenticated account, scan-history, report, and AI Mentor flows in a dedicated safe test environment.
- [ ] Verify scheduled monitoring end-to-end using an authorized test website and confirm alert delivery.
- [ ] Review Supabase RLS, grants, migrations, and required environment variables read-only; obtain explicit approval before any live changes.
- [ ] Review mobile accessibility/performance and cross-browser behavior.
- [ ] Prepare a production rollout and rollback plan.

## Safety boundaries

- This branch and its previews are preparation only.
- Do not merge this pull request without explicit user approval.
- Do not deploy this candidate to Production during preparation.
- Do not change Supabase schema, live data, or environment settings during preparation.
- Do not delete existing branches, files, or deployments.

A passing CI suite alone does not satisfy the end-to-end release gates above.
