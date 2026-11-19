# Sentinel AI — AI Research Lab
## Product specification (design-first, non-production)

Status: Proposed specification
Branch: feature/ai-research-lab-spec
Scope: Research assistance for authorized security challenges, CTFs, bug-bounty programs, and defensive assessments.

## Mission

Help a researcher understand a security challenge, investigate the claim, evaluate evidence, and produce a reproducible conclusion. The system must not promise that every challenge can be solved. It must distinguish verified findings, refuted claims, and inconclusive investigations.

## Seven core capabilities

1. **Challenge Analyzer** — Parse the challenge statement, identify the requested outcome, assets, rules of engagement, exclusions, deadlines, and evidence requirements. Ask for missing scope before any target testing.
2. **Research Assistant** — Review user-provided source code, binaries only where safe tooling is available, technical documents, logs, and references. Keep source provenance and distinguish facts from hypotheses.
3. **Vulnerability Verification** — Build a minimal, reproducible validation plan. Prefer static analysis and isolated labs. Active testing is permitted only against an explicitly authorized target and within the recorded scope and rate limits.
4. **False Claim Detection** — Test the stated claim against the available evidence. A claim may be marked refuted only when contradictory evidence is reproducible and the test conditions are documented; absence of evidence is not proof of absence.
5. **Evidence Collector** — Preserve timestamps, source references, hashes where applicable, sanitized request/response excerpts, environment details, steps to reproduce, and chain-of-custody notes. Never collect credentials, session tokens, private keys, or unrelated personal data.
6. **Solution Assistant** — Suggest safe next steps, mitigations, responsible disclosure guidance, and remediation. Do not autonomously exploit, persist, exfiltrate, or alter a target.
7. **Professional Report Generator** — Produce a clear report with scope, methodology, findings, evidence, impact, confidence, limitations, remediation, and disclosure notes.

## Standard workflow

1. Intake: receive challenge text, links, files, and expected outcome.
2. Scope gate: record owner/program, permitted assets, allowed methods, exclusions, time window, and authorization evidence. If scope is missing or ambiguous, remain in analysis-only mode.
3. Triage: classify the challenge (CTF, bug bounty, defensive assessment, code review, or other) and extract claims and assumptions.
4. Research: inspect supplied code and documents; record sources and hypotheses.
5. Validation plan: propose the least-invasive reproducible test. Require explicit approval before any active external test.
6. Verification: run only approved checks; retain sanitized evidence and exact conditions.
7. Adjudication: assign one of the result states below and explain why.
8. Remediation / rebuttal: provide a fix, next research steps, or an evidence-based response to an unsupported claim.
9. Report: generate a report and preserve an audit trail.

## Result states

- **VERIFIED** — The reported issue was reproduced under documented, authorized conditions.
- **REFUTED** — The specific claim was contradicted by reproducible evidence under conditions that adequately test it.
- **INCONCLUSIVE** — Evidence or access is insufficient to decide.
- **SOLVED** — The challenge's stated acceptance criteria were met and independently checked. This is separate from vulnerability verification.

Do not use PASS/FAIL as a substitute for these distinctions. A challenge can be solved without a vulnerability, and a vulnerability can be verified without solving the full challenge.

## Mandatory safety and governance controls

- Authorization and scope are required before active testing.
- Default to offline/static review and isolated CTF sandboxes.
- Enforce target allowlists, method restrictions, request budgets, timeouts, and emergency stop.
- Block destructive actions, persistence, credential theft, data exfiltration, denial-of-service, and tests outside scope.
- Keep an immutable audit record of approvals, tool actions, inputs, outputs, and evidence references.
- Redact secrets and personal data from logs and reports.
- Human approval is required for external active testing, disclosure, and any remediation that changes a live system.
- Clearly label AI-generated hypotheses; never present them as verified facts.

## Initial release boundary (MVP)

Include:
- Challenge intake form and private case record.
- Authorization/scope checklist and analysis-only mode.
- Text, code, and document analysis of user-supplied material.
- Research notes, hypothesis tracking, evidence register, and result-state adjudication.
- Report generation with evidence links and limitations.
- Audit log for case activity.

Defer:
- Autonomous internet-wide discovery or scanning.
- Unattended exploit execution.
- Automated submission to bounty platforms.
- Claims of guaranteed challenge completion.
- Any testing mode without enforceable authorization and scope controls.

## Proposed case record

- case_id, owner_user_id, title, challenge_type, description
- source_urls, supplied_file_references
- authorization_status, authorized_assets, allowed_methods, excluded_methods, scope_expiry
- hypotheses, research_notes, evidence_items
- result_state, confidence, limitations, remediation
- report_reference, created_at, updated_at

Store secrets separately from case records; do not store passwords, API keys, session cookies, or private keys in evidence fields.

## Acceptance criteria for the first milestone

1. A user can create a private challenge case without starting a scan.
2. The system refuses active testing when authorization or scope is missing.
3. The assistant separates observed facts, hypotheses, and conclusions.
4. Every VERIFIED or REFUTED result cites reproducible evidence and limitations.
5. INCONCLUSIVE is available and used when evidence is insufficient.
6. A report can be generated without exposing secrets or unrelated data.
7. Existing scanner, authentication, research workspace, and production deployment remain unchanged.

## Implementation sequence

1. Review current authentication, research workspace, API conventions, and database policies.
2. Design the case schema and RLS policies; review before applying any migration.
3. Build a non-invasive challenge intake and case UI.
4. Add analysis and evidence workflows.
5. Add report generation and audit events.
6. Test authorization gates and tenant isolation.
7. Integrate with the existing product only after isolated tests pass.


## Security implementation references

- [Database and RLS design](./AI-RESEARCH-LAB-DATABASE-DESIGN.md) — proposed ownership model, table permissions, and append-only records.
- [SQL migration draft](./AI-RESEARCH-LAB-MIGRATION-DRAFT.sql) — review-only SQL; not applied to Supabase.
- [Authorization and scope gate](./AI-RESEARCH-LAB-AUTHORIZATION-GATE.md) — analysis-only defaults, evidence requirements, human approval, and active-test safety limits.

These documents are design artifacts on the feature branch. They do not authorize external testing and have not been deployed to the production database or application.
