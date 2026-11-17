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
