# Sentinel AI — Branch Integration Audit (2026-11-23)

## Release staging
- Staging branch: `release/staging-mainline-20261123`
- Created from current `main`.
- This branch is an integration workspace only. No production deployment or database change is authorized by this audit.

## Integration rules
1. Compare each candidate against current `main`.
2. Inspect changed source and tests; do not merge whole divergent branches.
3. Rebuild or cherry-pick only isolated, compatible changes onto staging.
4. Run the repository test suite and relevant security tests.
5. Deploy a preview and verify behavior before opening a PR to `main`.
6. Never merge an untested change or change production without explicit approval.

## Candidate review

| Candidate branch | Difference from main | Initial assessment |
|---|---:|---|
| `fix/scan-surface-confidence-20261121` | 4 ahead / 15 behind | High-value false-positive reduction. Helper and focused tests look sensible; inspect full scan integration and run tests before porting. |
| `fix/prevent-self-workspace-invites-v2-20261121` | 2 ahead / 7 behind | Focused self-invitation guard plus tests. Port only after confirming the surrounding organization API and migration assumptions against current main. |
| `feat/mentor-diagnostics-mobile-checks-20261121` | 3 ahead / 9 behind | Mentor API and mobile tests. Needs full test review; source contains model/usage metadata that must be checked for correctness before adoption. |
| `security/restrict-static-cors-20261121` | 2 ahead / 1 behind | `vercel.json` appears materially the same as main in inspected content; workflow branch triggers need review. Do not port blindly. |
| `security/dependency-audit-20261121` | 4 ahead / 8 behind | Adds CodeQL and Lighthouse/security workflows. Review action versions, permissions, and workflow scope before adoption. |
| `ci/production-scanner-smoke-20261121` | 4 ahead / 3 behind | Adds production smoke workflow. Requires careful review to ensure tests are passive, authorized, and cannot mutate production. |
| `feat/research-lab-case-workflow-ui-20261121` | 33 ahead / 14 behind | Large, divergent feature set. Do not merge wholesale; split into small reviewed changes. |
| `fix/mentor-response-accuracy-20261121` | 7 ahead / 12 behind | Overlaps mentor work; compare against the other mentor branch and select one coherent patch set. |
| `fix/mobile-accessibility-20261121` | 4 ahead / 6 behind | UI/CSS and mobile tests; requires visual preview and accessibility test review. |
| `fix/report-same-origin-assets-20261121` | 5 ahead / 4 behind | Report asset/UI changes; verify same-origin loading and report tests. |
| `fix/surface-link-confidence-20261121` | 3 ahead / 12 behind | Overlaps surface-confidence branch; consolidate both reviews before selecting one implementation. |
| `security/supabase-cdn-sri-20261121` | 14 ahead / 7 behind | Divergent security/header and integrity changes; inspect dependencies and CSP compatibility before porting. |
| `feat/http-file-domain-verification-20261122` | 6 ahead / 0 behind | Isolated feature already has a READY preview and draft PR #83. End-to-end ownership verification remains untested; keep draft and do not merge yet. |

## Current decision
- No candidate is approved for merge based on this audit alone.
- First review queue: surface-confidence false-positive fix, self-invitation guard, and security/CI workflow improvements.
- Mentor branches should be reconciled together to avoid conflicting implementations.
- Large research/integration/release branches remain quarantined until decomposed.
- Draft PR #83 remains open and unmerged pending end-to-end verification.


## Follow-up validation (2026-11-23)
- Draft PR #83 (feat/http-file-domain-verification-20261122) was rechecked after updating stale delegated-action test counts from 51 to 52 and unique actions from 47 to 48.
- On PR head c031f85703059efabb2f6bcceb103a8845782554, the 189-test suite passed; Main Security Hardening, Sentinel AI security API checks, Research Scope Gate Tests, and CodeQL all passed.
- Its Vercel preview is READY. The homepage and sentinel-app.js / sentinel-actions.js returned HTTP 200. Authenticated ownership verification against a separately controlled domain remains untested, so PR #83 stays draft and unmerged.
- The mobile-accessibility candidate is not safe to port as-is: its favicon change points to /favicon.svg, but the live deployment returns 404 for that path and 200 for /public/favicon.svg. The label and link-contrast changes are already present in main.
- Production deployment is one commit behind main: production is on 0f9f61da9447c40320d91ef4a3f61ce53b84e744, while main is df1764c5ac1ea95e5873e0c8900894c613ba476a. The newer main commit adds a restrictive CORS response header. Preview confirms Access-Control-Allow-Origin: https://project-3jyda.vercel.app; production currently returns Access-Control-Allow-Origin: * on the homepage and static assets. No production deployment was made.
