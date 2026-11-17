# 06 — Accounts, Permissions and Data

**Status:** Existing auth/database work; full audit unverified · **Priority:** Critical · **Release gate:** Yes

## Objective
Prove authentication, organization roles and stored security data are isolated and least-privileged.

## Tasks
- [ ] **IAM-01 Auth lifecycle:** test signup, login, logout, recovery, expiry and revoked sessions.
- [ ] **IAM-02 Profiles:** review profile read/update permissions and least-privilege fields.
- [ ] **IAM-03 Ownership:** test cross-user denial for scans, reports, monitoring sites, runs and alerts.
- [ ] **IAM-04 Teams:** test invitation, acceptance, revocation, role changes and separate-account behavior.
- [ ] **IAM-05 RLS/grants:** review RLS policies, Data API grants, function execution privileges and security-definer functions.
- [ ] **IAM-06 Secrets:** verify service-role keys and privileged operations stay server-side.
- [ ] **IAM-07 Recovery:** document backup and restore limits for the current plan; perform a safe restore drill where supported.

## Evidence required
Role/ownership matrix; negative-access test results; reviewed migration SQL; invitation test results; backup/restore limitations and recovery notes.

## Pass criteria
All unauthorized cross-account attempts are denied; roles match intended permissions; no privileged key reaches the browser; recovery limitations are documented.

## Known starting points
`supabase/migrations/`, `api/organizations.js`, `api/organization-admin.js`, `api/organization-assets.js`, `api/_lib/organizations.js`, `api/_lib/organization-policies.js`, `test/organizations.test.js`, `test/organization-policies.test.js`.

## Safety boundary
Read-only review first. Do not modify live RLS, grants, users or data without a separately reviewed migration and explicit approval.

## Completion record
- Environment tested:
- Role matrix:
- Test commit:
- Open issues:
- Decision: NOT RUN / BLOCKED / PASS / FAIL

## Read-only code review finding and remediation — 2026-11-18

- [x] **IAM-05 baseline:** all 21 public tables have RLS enabled; anon has no table SELECT/INSERT grants; ownership and workspace membership policies were reviewed. See Workstream 01 for catalog evidence.
- [x] **IAM-04 privacy fix:** the team-assets GET endpoint previously returned a list of every verified member-owned but unshared monitoring site to all workspace roles. This exposed private hostnames and scan posture before an owner/admin explicitly shared the asset.
- [x] The Preview code now limits enumeration of unshared assets to workspace owners/admins. Ordinary members still receive explicitly shared assets, but `available_assets` is empty for non-admin roles. Added role-helper and API-wiring regression tests in `test/team-assets.test.js`.
- [ ] Two-account live negative tests for invitations, role changes, scan history, monitoring and shared assets remain outstanding; Preview branch currently has no isolated Supabase credentials.
- [ ] Auth lifecycle, session revocation/expiry and restore drill remain NOT RUN.

**Decision:** PARTIAL PASS for static RLS/grant review and the team-asset privacy remediation; complete identity/data workstream remains NOT COMPLETE.
- [x] **IAM-04 regression verification:** Preview commit `d7276d010fd0181e93925730d14fc8a184732d25` passed the team-asset role/wiring tests and the full CI workflow; the subsequent CI hardening run also passed. Vercel deployment for the branch is READY. The endpoint still needs an isolated live two-account test before the full IAM workstream can pass.
