# Global Release — Execution Tracker

Use this tracker as the day-to-day record. Update only after checking actual output.

## Current baseline
- [ ] Confirm Preview branch head and deployment URL.
- [ ] Record exact commit SHA under test.
- [ ] Run repository CI/test workflow for that commit.
- [ ] Capture failures and logs before editing code.

## Active queue
1. [ ] Workstream 1: seven security layers — read-only review and baseline tests.
2. [ ] Workstream 2: scanner accuracy — reproduce redirect/429 attribution issue.
3. [ ] Workstream 3: AI Mentor — CVSS formatting regression and evaluation cases.
4. [ ] Workstream 4: monitoring — read-only Cron/Vault/dispatch verification.
5. [ ] Workstream 5: reports — accuracy, export, print and mobile checks.
6. [ ] Workstream 6: accounts/data — multi-account authorization and RLS review.
7. [ ] Workstream 7: global performance/mobile/accessibility measurements.
8. [ ] Workstream 8: independent audit, remediation and go/no-go.

## Issue register
| ID | Severity | Description | Reproduction/evidence | Fix commit | Retest status |
|---|---|---|---|---|---|
| TBD | — | No issue is marked confirmed until reproduced | — | — | NOT RUN |

## Test run log
| Date (UTC) | Commit | Environment | Command/suite | Result | Evidence |
|---|---|---|---|---|---|
| — | — | Preview | Not yet run for organized plan commit | NOT RUN | — |

## Release blockers
- [ ] No unresolved critical security findings.
- [ ] No unresolved high security findings.
- [ ] Scanner target identity and upstream failure handling verified.
- [ ] Monitoring authorization, scheduling, dispatch and isolation verified.
- [ ] Authentication, RLS and cross-account isolation verified.
- [ ] Reports and exports verified.
- [ ] Mobile, browser, accessibility and regional performance evidence recorded.
- [ ] Recovery/rollback procedure exercised.
- [ ] Independent security assessment and retest completed.

## Status vocabulary
- **NOT RUN:** no test/evidence yet.
- **BLOCKED:** cannot test because a dependency or permission is missing.
- **FAIL:** tested and acceptance criteria not met.
- **PASS:** acceptance criteria passed and evidence is linked.

Never convert an estimate or code-presence check into PASS.
