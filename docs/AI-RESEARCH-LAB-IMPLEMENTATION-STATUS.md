# AI Research Lab — Implementation Status

Status: Branch implementation in progress; NOT production-ready.
Branch: `feature/ai-research-lab-spec`
Latest automated validation: 25 tests passed, 0 failed.

## Completed in this branch

- Product workflow and seven core capability specification.
- Five-table database design and review-only SQL migration draft.
- Owner-isolated RLS policies and least-privilege grants in the draft.
- Server-only per-test approval record design, bound to a SHA-256 plan hash.
- Fail-closed scope evaluator at `api/_lib/research-scope-gate.js`.
- Read-only server endpoint `api/research-scope-check.js` that loads authorization and approval records server-side and returns a decision only; it never contacts the target.
- Canonical SHA-256 test-plan fingerprinting at `api/_lib/research-plan-hash.js`.
- Unit tests for authorization status, exact HTTPS origin/path, allowed methods,
  explicitly allowed test categories, scope expiry, human approval, reviewer
  timestamp, and plan-hash matching.
- Static migration checks for table count, RLS coverage, and client write limits.
- GitHub Actions workflow runs the Node test suite on branch pushes and PRs to main.

## Explicitly not completed

- The migration has NOT been applied to Supabase.
- No staging database migration or two-user RLS test has been performed.
- The scope evaluator is connected only to a read-only decision endpoint; it is NOT
  connected to any endpoint that can initiate external testing. No active testing is enabled.
- The new Research Lab case UI is not yet integrated into the existing Research Workspace.
- Authorization evidence intake, reviewer identity/role management, and approval
  creation/revocation endpoints are not yet implemented.
- Research Lab user interface and report workflow are not yet integrated.
- Private Storage bucket and upload controls are intentionally deferred.
- No production deployment or merge to `main` has occurred.

## Safe release sequence

1. Complete backend case CRUD and audit as transactional server-side operations.
2. Add authorization evidence review and server-only approval/revocation workflow.
3. Apply the migration only to a disposable/staging Supabase project after owner approval.
4. Test with two separate accounts: read/write isolation, forbidden column updates,
   append-only notes/evidence, and server-only approval/audit writes.
5. Integrate the scope evaluator into every future active-test entry point.
6. Keep the product analysis-only until all gates above pass.
7. Review UI, reports, privacy/retention and legal terms before production rollout.

## Safety rule

No external target is tested merely because it is public or a domain is verified.
Missing, ambiguous, expired, or revoked permission means analysis-only. A separate
human approval is required for the exact test plan. This technical workflow is not
legal advice and cannot guarantee legality in every jurisdiction.
