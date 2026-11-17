# Sentinel AI — Global Release Readiness

**Scope:** Preview branch only  
**Overall state:** Planning organized · execution and release gates not yet verified  
**Production:** No production code, database or settings changed by this documentation work.

This folder is the single working plan for Sentinel AI's next **Global Ready Release**. Use the eight workstream documents below as the source of truth. A checklist item is not complete until its test/evidence is linked and reviewed.

## Workstreams

| # | Workstream | Priority | Current status | Detailed plan |
|---|---|---|---|---|
| 1 | Seven defensive security layers | Critical | Not audited | [01 — Security layers](workstreams/01-security-layers.md) |
| 2 | Scanner accuracy, safety and evidence | Critical | Not verified | [02 — Scanner accuracy](workstreams/02-scanner-accuracy.md) |
| 3 | AI Security Mentor quality and safety | High | Not verified | [03 — AI Mentor](workstreams/03-ai-mentor.md) |
| 4 | Continuous monitoring and alerts | Critical | Code exists; live operation unverified | [04 — Monitoring](workstreams/04-continuous-monitoring.md) |
| 5 | Reports and exports | High | Code/tests exist; acceptance unverified | [05 — Reports](workstreams/05-reports.md) |
| 6 | Accounts, permissions and data | Critical | Existing foundation; full audit unverified | [06 — Accounts and data](workstreams/06-accounts-and-data.md) |
| 7 | Global readiness, performance and mobile | High | Not measured | [07 — Global performance/mobile](workstreams/07-global-performance-mobile.md) |
| 8 | Independent security assessment and launch | Final gate | Not started | [08 — Independent audit and launch](workstreams/08-independent-audit-and-launch.md) |

## Execution order

1. Establish the Preview baseline and run the repository's existing automated checks.
2. Fix reproducible failures before adding new behavior.
3. Work through security layers and scanner accuracy first.
4. Verify monitoring end to end in an isolated authorized test environment.
5. Validate Mentor, reports, accounts, permissions and team workflows.
6. Measure global performance, mobile usability and accessibility.
7. Commission independent testing, remediate findings and make a documented go/no-go decision.

## Working rules

- Work on `feature/final-release-audit-20261117` and Preview deployments only.
- Do not merge to `main`, alter production settings, run migrations, change secrets or touch live user data without separate review and explicit approval.
- Scan only systems the owner has authorized.
- Mark each item NOT RUN, BLOCKED, PASS or FAIL; attach commit/test evidence and reviewer/date.
- A passing CI build does not mean the product is 100% complete or independently certified.
- Do not promise email/webhook alerts, live monitoring or global certification unless implemented and verified.

## First execution target

**Start with Workstream 1 + Workstream 2 baseline checks.** Confirm the current Preview test suite, capture exact failures, then fix one reproducible issue at a time. See the detailed acceptance criteria in each linked workstream.

## Definition of Global Ready

The product is ready for a release decision only when all required workstreams have evidence, no unresolved critical/high security findings remain, operational recovery is documented, and the independent assessment scope and result are disclosed accurately.

**Last organized:** Preview documentation commit series beginning at `e55d206`.  
**Current document status:** organized work plan only; implementation is still pending.
