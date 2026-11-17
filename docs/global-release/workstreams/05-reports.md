# 05 — Reports and Exports

**Status:** Code/tests exist; acceptance unverified · **Priority:** High · **Release gate:** Yes

## Objective
Ensure exported and printable reports faithfully represent the correct user's scan and work across mobile and desktop.

## Tasks
- [ ] **RPT-01 Accuracy:** compare report fields, score, target, timestamps and findings with the stored scan.
- [ ] **RPT-02 Authorization:** test that users cannot access another user's report by changing identifiers.
- [ ] **RPT-03 Export:** test export generation, filenames, encoding and large reports.
- [ ] **RPT-04 Print/mobile:** test print preview and narrow mobile layouts.
- [ ] **RPT-05 Edge cases:** test empty, partial, failed and older scan records.
- [ ] **RPT-06 Privacy:** check reports for secrets, internal prompts, tokens and unnecessary personal data.

## Evidence required
Representative report fixtures; export and print results; mobile screenshots/review notes; authorization test output.

## Pass criteria
No mismatch with source scan; access control passes; exports render consistently; edge cases fail gracefully.

## Known starting points
`api/report.js`, `sentinel-report.css`, `test/report-api.test.js`, `test/report-export.test.js`, `test/report-print.test.js`, `test/report-ui.test.js`.

## Completion record
- Test commit:
- Browsers/devices:
- Export/print evidence:
- Open issues:
- Decision: NOT RUN / BLOCKED / PASS / FAIL

## Code/test baseline review — 2026-11-18

- [x] **RPT-01 accuracy baseline:** report API recalculates score/risk from submitted check statuses instead of trusting browser-supplied score/risk labels; summary counts and priority findings are derived from those checks.
- [x] **RPT-03 input bounds:** report API limits checks to 200, validates URL scheme and score range, bounds text/evidence fields and normalizes evidence before inclusion.
- [x] **RPT-05/06 existing tests:** automated suite includes API validation/summary/evidence tests, CSV export escaping, print-dialog behavior and report UI tests. These are part of the 167-test CI suite.
- [ ] **RPT-02 authorization semantics:** report generation is stateless and accepts client-supplied scan data; it does not retrieve a stored report by ID. Confirm the UI never presents a generated report as a server-verified historical record. If persistent reports are added, enforce scan ownership on retrieval.
- [ ] **RPT-04 real-device acceptance:** print preview, PDF save, large reports and narrow mobile layouts still need real browser/device checks. Current automated print test only verifies the print-dialog action.

**Decision:** PARTIAL PASS for input validation, score recalculation and existing export/print tests; end-to-end report acceptance remains NOT COMPLETE.
