# AI Research Lab — Authorization and Scope Gate

Status: Required security design — NOT IMPLEMENTED
Branch: feature/ai-research-lab-spec
Applies to: AI Research Lab and any future active validation workflow

## 1. Default operating mode

- Every new case starts in `analysis_only`.
- Analysis-only work may summarize user-provided text/code and public documentation without sending test traffic to a target.
- Creating a case, uploading evidence, changing a note, or generating a report must never start a scan or external request.
- No active validation is available unless the server has a current, approved authorization record and a separate human approval for the specific test plan.
- Missing, ambiguous, expired, contradictory, or unverifiable permission means deny active testing and remain analysis-only.

## 2. Authorization evidence by case type

The system must not treat a verified domain as proof of permission for every security test.

- Owner-controlled defensive assessment: require a domain/control verification plus confirmation that the submitter is authorized to administer the asset.
- Bug bounty: require the official program URL, the exact in-scope asset entry, program rules, prohibited methods, and a dated record of the submitter's authorization to participate. Follow the program's current rules, not assumptions.
- CTF/lab: require the official challenge/lab source and its written rules; restrict activity to the supplied lab environment.
- Code review: require confirmation that the submitter owns the code or has permission to share and assess it.
- Other: no active testing until a human reviewer records the legal basis and exact scope.

A public website, public IP, search result, or successful domain verification alone is not authorization to test a third-party system.

## 3. Required scope record

Before approval, the server must validate and retain:

- Case ID and authenticated submitting user.
- Authorization basis and evidence reference (private object key or official program/challenge URL).
- Exact hostnames, IPs, ports and paths allowed; no implicit wildcard expansion.
- Explicitly allowed HTTP methods and test categories.
- Explicit exclusions and prohibited actions.
- Start time, expiry time, timezone, and reviewer identity.
- Rate limit, concurrency limit, total request budget, and maximum test duration.
- Approval status and a human-readable reason for approval or denial.

Scope must be machine-readable and versioned. Any change to assets, methods, expiry, or exclusions invalidates the prior test approval and requires review again.

## 4. Approval state machine

Allowed states:
- `not_provided`
- `pending_review`
- `authorized`
- `denied`
- `expired`
- `revoked`

Rules:
- Client/browser requests cannot set `authorized`, `revoked`, or reviewer identity.
- Approval is a trusted server-side action after checking evidence and policy.
- Authorization is time-bounded and rechecked immediately before every active test.
- Each active test also requires a separate human approval of its exact plan.
- Expiry, revocation, a scope mismatch, a failed authorization check, or an emergency stop blocks the test.
- A prior approval never authorizes a different target, method, or later test plan.

## 5. Active-test safety boundary

Initial MVP must be analysis-only. When active validation is later implemented, it must:

- Use a strict hostname/IP/port/path allowlist and validate every redirect destination.
- Resolve and re-check DNS immediately before connection; block loopback, link-local, private, reserved, and metadata-service destinations unless an explicitly approved isolated lab requires them.
- Reject URL credentials, unexpected ports, IP-literal targets unless explicitly approved, and ambiguous internationalized hostnames.
- Enforce low request rates, concurrency caps, total request budgets, short timeouts, response-size caps, and a global kill switch.
- Start with non-destructive checks only; prohibit denial of service, persistence, credential theft, privilege escalation, data exfiltration, destructive writes, and social engineering.
- Stop on any out-of-scope redirect, rate-limit response, unexpected authentication boundary, instability, or operator stop request.
- Never automatically follow links discovered during scanning as new targets.

## 6. Server and secret handling

- All authorization checks run server-side on every request; never trust client-supplied owner IDs, roles, approval states, or scope.
- Verify the Supabase access token with Supabase Auth before acting.
- Keep service-role credentials only in server-side environment variables; never return them to the browser or logs.
- Use least-privilege database grants and RLS as defense in depth.
- Do not store passwords, session cookies, API keys, private keys, bearer tokens, or raw authentication headers.
- Redact secrets and unrelated personal data from request/response excerpts before persistence.
- Audit authorization submissions, reviewer decisions, scope changes, approvals, denials, test starts/stops, budget exhaustion, and emergency stops.

## 7. Required denial behavior

Return a safe denial and perform no network activity when:
- Permission evidence is missing or cannot be verified.
- The asset is not an exact member of the approved scope.
- The requested method or test category is excluded.
- The approval has expired or been revoked.
- The plan has not received its own human approval.
- A rate, concurrency, duration, response-size, or request-budget limit would be exceeded.
- The target resolves to a blocked network range or a redirect leaves scope.
- The global or case-level emergency stop is active.

Do not reveal internal secrets, tokens, private network details, or other users' case data in denial messages.

## 8. Minimum test matrix before enabling active validation

Use two unrelated test accounts and a controlled staging target only.

1. Unauthenticated request: denied; zero outbound requests.
2. Authenticated user without permission evidence: analysis-only; zero outbound requests.
3. Verified domain but no explicit test authorization: active test denied.
4. Bug-bounty case with an out-of-scope asset: denied; zero outbound requests.
5. Allowed asset but excluded method: denied; zero outbound requests.
6. Expired/revoked approval: denied; zero outbound requests.
7. Changed scope after approval: prior approval invalidated.
8. Redirect to a different host or private/reserved IP: blocked.
9. Missing per-test human approval: denied; zero outbound requests.
10. Budget/timeout/emergency stop reached: test stops and audit event is written.
11. User A attempts to read or use User B's case: denied.
12. Audit records cannot be created or altered by browser/client roles.

## 9. Legal and product boundary

Sentinel AI is a technical assistance tool, not a legal authorization service and not a guarantee that a test is lawful. Users must obtain permission from the system owner or follow the exact written rules of the relevant program/lab and applicable law. The product must not encourage testing outside that scope. When permission is unclear, the safe outcome is analysis-only.

## 10. Implementation gate

Do not enable active testing until all of the following are complete:
- Database migration reviewed and applied to a disposable/staging project.
- Authorization evidence workflow and human review implemented.
- Server-side scope enforcement implemented on every active-test path.
- DNS, redirect, private-network, request-budget, timeout, and emergency-stop protections tested.
- Two-user isolation and audit immutability tests pass.
- Security Advisor checks reviewed and all high-risk findings resolved.
- Explicit product-owner approval recorded before production rollout.
