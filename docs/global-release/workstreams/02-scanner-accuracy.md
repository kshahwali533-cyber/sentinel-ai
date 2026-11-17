# 02 — Scanner Accuracy, Safety and Evidence

**Status:** Not verified · **Priority:** Critical · **Release gate:** Yes

## Objective
Ensure the scanner tests the authorized target, reports only evidence-backed findings and distinguishes target behavior from upstream/network failures.

## Tasks
- [ ] **SCN-01 Target identity:** preserve the originally requested host throughout redirects, scan history and reports.
- [ ] **SCN-02 429/challenge case:** reproduce the known Google 429/challenge-page attribution issue using a controlled fixture; never treat Google's response as the target site's finding.
- [ ] **SCN-03 Redirect safety:** revalidate every redirect destination and block private, local or otherwise disallowed addresses.
- [ ] **SCN-04 Failure semantics:** distinguish timeout, blocked request, upstream error, incomplete scan and actual target response.
- [ ] **SCN-05 Evidence quality:** verify each finding has source evidence, correct severity and reproducible explanation.
- [ ] **SCN-06 Scoring:** test score arithmetic, PASS/WARN/INFO behavior and severity mapping.
- [ ] **SCN-07 Coverage:** test representative authorized sites and controlled fixtures across HTTP status codes, headers and common technology stacks.
- [ ] **SCN-08 Limits:** test DNS pinning, response-size caps, timeouts, redirect count and resource limits.

## Evidence required
Fixture set; before/after reproduction for redirect/429 bug; scan output; scan-history target comparison; false-positive review; test logs.

## Pass criteria
Original target remains authoritative; upstream errors are not attributed to target; findings are evidence-backed; safety guards and regression tests pass.

## Known starting points
`api/scan.js`, `api/_lib/safe-fetch.js`, `api/_lib/security-header-analysis.js`, `api/_lib/security-evidence.js`, `api/_lib/scan-score.js`, `api/_lib/finding-validation.js`, `test/safe-fetch.test.js`, `test/scan-score.test.js`, `test/security-evidence.test.js`.

## Safety boundary
Only scan systems the account owner explicitly owns or is authorized to test. Use local fixtures for adversarial redirect and error cases.

## Completion record
- Test commit:
- Fixture/results:
- Open false positives:
- Decision: NOT RUN / BLOCKED / PASS / FAIL

## Verified remediation evidence — 2026-11-18

- [x] **SCN-01/02 partial:** the previously identified cross-domain redirect attribution path is now stopped before scoring. The scanner compares the originally submitted hostname with the final response hostname and returns `422 TARGET_REDIRECTED_OFF_SITE` for unrelated domains, cancelling the response body. The exact host and its `www`/non-`www` pair remain accepted.
- [x] **Regression coverage:** `test/scan-target-identity.test.js` covers exact host, canonical www pair, unrelated host rejection, case/trailing-dot/IPv6 normalization, and missing host input.
- [x] **CI:** commit `0086e4dde9aec90d40264a18c7ac12c66185bd8d`, workflow run `44190045489` passed all 162 tests and all subsequent database quota, DNS pinning, security-header and redirect-guard workflow steps. Vercel Preview deployment is READY.
- [ ] **SCN-02 full reproduction:** the original Google challenge case still needs a controlled fixture that demonstrates the request and stored history behavior end to end; this code guard prevents unrelated final-host scoring but does not yet prove every history/report path.
- [ ] **Preview runtime verification:** the current Preview branch has no branch-scoped Vercel environment variables. Do not copy production secrets into Preview. Isolated Preview credentials/configuration are required before authenticated scanner and account-backed runtime tests.
- [ ] **SCN-04/05/07:** failure semantics, evidence correctness and representative authorized-site coverage remain open.

**Decision:** PARTIAL PASS for the cross-domain attribution guard and its CI regression tests; the full scanner accuracy workstream remains NOT COMPLETE.
- [x] **SCN-04 partial failure semantics:** scanner now returns explicit non-scoring errors for target HTTP 429, target HTTP 5xx and 3xx responses without a Location header; response bodies are cancelled. Regression assertions were added to `test/restricted-target.test.js`. Full fixture-based runtime coverage remains open.
- [x] **SCN-04 additional failure guard:** target HTTP 408 now returns `504 TARGET_TIMEOUT` without calculating a score; regression assertion added.
