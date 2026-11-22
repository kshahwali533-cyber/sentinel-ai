# Sentinel AI — Candidate Patch Decisions (2026-11-23)

## Reviewed in detail

### Self-invitation guard — do not port
The candidate branch `fix/prevent-self-workspace-invites-v2-20261121` contains the same self-invitation guard and the same safety test already present in current `main`. It adds no distinct value for this fix. Decision: keep current main implementation; do not cherry-pick duplicate changes.

### Surface confidence — reject candidate as written
Current `main` confirms only the exact submitted scan target as a confirmed surface reference. The candidate changes this to also accept `html-link` references. A link in page markup does not establish that the destination route exists or is sensitive; this could promote unverified links into confirmed findings and increase false positives. Decision: do not adopt the candidate change. Preserve the stricter current-main behavior unless a later design introduces a separate, clearly labelled “linked candidate” evidence state with independent validation.

## Release safety
- No code was merged or cherry-picked in this review.
- No production deployment was changed.
- No Supabase schema, data, or secrets were changed.
- Next code integration candidate should be selected only after source and test review, with the exact patch rebuilt against the staging branch and preview-tested.
