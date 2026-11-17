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
