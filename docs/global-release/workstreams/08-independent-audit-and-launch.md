# 08 — Independent Security Assessment and Launch Gate

**Status:** Not started · **Priority:** Final gate · **Release gate:** Yes

## Objective
Obtain an independent, scoped security assessment, remediate findings and make an evidence-based release decision.

## Tasks
- [ ] **AUD-01 Scope:** define allowed domains, APIs, test accounts, hours and prohibited actions.
- [ ] **AUD-02 Reviewer pack:** prepare architecture, data-flow, threat model, API documentation and test environment.
- [ ] **AUD-03 Vendor selection:** shortlist qualified independent application-security/penetration-testing providers and confirm scope, price and authorization terms.
- [ ] **AUD-04 Assessment:** commission the review only after written scope and explicit authorization.
- [ ] **AUD-05 Remediation:** track every finding by severity, owner, fix commit and retest evidence.
- [ ] **AUD-06 Retest:** obtain evidence that critical/high findings are fixed or formally dispositioned before launch.
- [ ] **AUD-07 Release decision:** publish an accurate scope statement, report date, assessor and exclusions. Never claim universal certification.

## Evidence required
Written scope/authorization; independent report; remediation register; retest report; final go/no-go decision.

## Pass criteria
No unresolved critical/high findings; all material findings have documented disposition; independent report clearly states what was and was not tested.

## Release decision
- [ ] GO — all required gates passed and evidence linked.
- [ ] NO-GO — any critical/high issue, missing evidence or unverified release dependency remains.

## Completion record
- Assessor:
- Scope/date:
- Report reference:
- Open findings:
- Retest:
- Decision: NOT STARTED / IN PROGRESS / PASS / FAIL

## Preparation update — 2026-11-18

- [x] **AUD-01 draft scope:** `docs/global-release/REVIEWER-PACK.md` defines proposed assessment boundaries, in-scope components, prohibited activities and required evidence. This is a draft scope, not signed authorization.
- [x] **AUD-02 reviewer pack draft:** the same document records architecture/data flows, currently evidenced controls, known gaps and release decision.
- [ ] **AUD-03 to AUD-06:** no assessor has been selected or commissioned; no independent assessment or retest has occurred.
- [ ] **AUD-07:** current decision remains **NO-GO** for Global Ready Release until all critical gaps are closed and independent assessment is completed.
- [ ] **Commercial readiness:** subscription/payment system is design-only; no provider is connected, no paid plans are active, and seller onboarding/payout verification must be completed by the owner before implementing or enabling live billing. See `docs/subscription-billing-design.md`.
