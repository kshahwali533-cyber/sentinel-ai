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
