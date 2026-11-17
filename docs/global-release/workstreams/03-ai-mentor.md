# 03 — AI Security Mentor Quality and Safety

**Status:** Not verified · **Priority:** High · **Release gate:** Yes

## Objective
Make advice accurate, evidence-grounded, safe and clear; prevent fabricated vulnerability claims or data leakage.

## Tasks
- [ ] **AIM-01 Grounding:** verify advice only describes supplied scan evidence and clearly labels uncertainty.
- [ ] **AIM-02 CVSS display:** reproduce and fix the previously observed malformed CVSS formatting; add regression tests.
- [ ] **AIM-03 CVE validation:** reject malformed/unknown identifiers and distinguish lookup failure from “not vulnerable”.
- [ ] **AIM-04 Remediation:** review commands and recommendations for safety, priority and user comprehension.
- [ ] **AIM-05 Provider failure:** test timeout, quota, malformed response and unavailable-provider fallback.
- [ ] **AIM-06 Privacy:** ensure prompts, credentials, tokens and another user's scan data never leak into responses or logs.
- [ ] **AIM-07 Evaluation:** build a curated set of findings with expected safe answers and human-review notes.

## Evidence required
Evaluation cases and expected results; test output; examples of corrected CVSS display; human review of security advice; privacy checks.

## Pass criteria
No unsupported critical claims in the evaluation set; invalid inputs safely rejected; fallback is useful; no secret or cross-user data exposure.

## Known starting points
`api/assistant.js`, `api/_lib/mentor-validation.js`, `test/assistant-api.test.js`, `test/mentor-validation.test.js`.

## Completion record
- Evaluation-set version:
- Test commit:
- Human reviewer:
- Open issues:
- Decision: NOT RUN / BLOCKED / PASS / FAIL
