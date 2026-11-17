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

## Code-level baseline review — 2026-11-18

- [x] **AIM-01 grounding baseline:** request fields are normalized and bounded; evidence is reduced to supported descriptive fields; the model is instructed to treat website/finding values as untrusted data and not invent website facts.
- [x] **AIM-04 safety baseline:** model output must contain the required structured fields and 1–8 steps; scanner severity/status are imposed from the original input rather than trusted from the model. Frontend renders mentor text through `escapeHTML`.
- [x] **AIM-05 fallback baseline:** OpenAI calls have a 12-second timeout; invalid/unavailable responses fall back to built-in defensive guidance. Fallback tests cover PASS and INFO without overstating vulnerability claims.
- [x] **AIM-06 privacy baseline:** Responses API request sets `store: false`; mentor responses set `Cache-Control: no-store`; website URL is normalized to origin before prompt submission.
- [x] **Model configuration review:** code uses `gpt-6-luna`, a currently listed OpenAI API model ([official model/pricing page](https://platform.openai.com/pricing)). This validates the identifier only, not live API entitlement or successful inference.
- [ ] **AIM-02 CVSS display:** the previously reported display issue has not been reproduced in the current code path; a targeted UI regression test is still needed before closing it.
- [ ] **AIM-05 live provider test:** production has an OpenAI key configured, but this Preview branch has no branch-scoped environment variables. Do not copy the production key into Preview. A dedicated Preview key/test environment is required.
- [ ] **AIM-07 evaluation:** curated answer set and human review of model outputs remain outstanding.

**Decision:** PARTIAL PASS for code-level validation, safe fallback, output escaping and privacy defaults. Live provider behavior and human quality evaluation remain NOT RUN.
