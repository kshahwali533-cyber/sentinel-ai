# Sentinel AI — Candidate Patch Decisions (2026-11-23)

## Reviewed in detail

### Self-invitation guard — do not port
The candidate branch `fix/prevent-self-workspace-invites-v2-20261121` contains the same self-invitation guard and the same safety test already present in current `main`. It adds no distinct value for this fix. Decision: keep current main implementation; do not cherry-pick duplicate changes.

### Surface confidence — reject candidate as written
Current `main` confirms only the exact submitted scan target as a confirmed surface reference. The candidate changes this to also accept `html-link` references. A link in page markup does not establish that the destination route exists or is sensitive; this could promote unverified links into confirmed findings and increase false positives. Decision: do not adopt the candidate change. Preserve the stricter current-main behavior unless a later design introduces a separate, clearly labelled “linked candidate” evidence state with independent validation.

## Release safety
- No code was merged or cherry-picked in this review.
- No production deployment was changed.
- No Supabase schema, data, or secrets were changed.
- Next code integration candidate should be selected only after source and test review, with the exact patch rebuilt against the staging branch and preview-tested.


### Mobile accessibility branch — do not port the favicon change
The branch fix/mobile-accessibility-20261121 changes the favicon URL from /public/favicon.svg to /favicon.svg. Live HTTP checks show the current Vercel deployment returns 200 for /public/favicon.svg and 404 for /favicon.svg; adopting this change would break the favicon. Its accessibility label and link-contrast additions are already present in main. Decision: do not port this branch as-is.

### HTTPS file verification — test repair passed; manual ownership proof pending
PR #83 added one delegated UI action, but test/inline-actions.test.js still expected the old counts (51 total and 47 unique). Updated the test on the feature branch to expect 52 total and 48 unique and explicitly require verify-monitoring-file. The PR head now passes all 189 tests, Main Security Hardening, security API checks, Research Scope Gate Tests, and CodeQL. Preview is READY and key static assets return 200. Decision: keep PR #83 draft and unmerged until the HTTPS challenge is tested against a separately controlled domain.

### Production CORS deployment gap — prepare, do not deploy
Main commit df1764c5ac1ea95e5873e0c8900894c613ba476a adds an explicit same-origin Access-Control-Allow-Origin value and a CI assertion. The staging preview returns the expected origin, but the current production deployment is still at 0f9f61da9447c40320d91ef4a3f61ce53b84e744 and returns wildcard CORS on the homepage and static assets. Decision: retain the validated main change and prepare a production deployment only after explicit deployment approval; production remains unchanged during this audit.


### Multi-method domain ownership verification — validated in feature preview
PR #83 now supports DNS TXT, HTTPS well-known file, and HTML homepage meta-tag proofs, plus a Smart Auto Verify action that checks DNS first and then checks the two HTTPS proofs. HTTP proof requests remain HTTPS-only, exact-host, public-DNS-validated, IP-pinned, redirect-disabled, content-type constrained, and size bounded. The HTML parser rejects duplicate proof tags and duplicate attributes. Latest PR head passed 195/195 unit tests, Main Security Hardening, Sentinel AI security API checks, Research Scope Gate Tests, and CodeQL. Preview is READY. Decision: retain as a draft PR until a real end-to-end ownership test is performed against a separately controlled domain; do not merge or deploy to production yet.
