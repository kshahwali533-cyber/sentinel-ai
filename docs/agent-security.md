# AI Agent Security — first implementation slice

Status: **Static assessment engine and API implemented; UI and runtime verification remain open.**

## Scope

The first slice provides a deterministic, defensive review of a user-supplied AI-agent capability and control inventory.

Endpoint: `POST /api/agent-security`

The endpoint:
- accepts a JSON configuration only;
- enforces a 16 KiB serialized request limit after platform parsing;
- evaluates declared tool capabilities against explicit safeguards;
- returns prioritized findings, remediation guidance, and an incomplete-assessment state when declarations are missing;
- sends no request to an external AI provider;
- does not execute tools, scan third-party systems, or persist submitted configuration;
- returns `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

## Capability inventory

- Network access
- Shell execution
- File writes
- Secret access
- Database writes
- External messaging
- Browser automation

## Control inventory

- Human approval
- Tool allowlist
- Sandboxed execution
- Scoped secrets
- Output validation
- Audit logging
- Prompt-injection testing
- Data-exfiltration controls

Missing or non-boolean declarations are treated as **unknown**, never as a disabled capability or a working safeguard. An incomplete assessment does not receive a Low/Medium/High/Critical final risk label.

## Important limitations

This is a static configuration review, not a runtime agent monitor, source-code audit, penetration test, or guarantee of security. The UI, authenticated storage, policy enforcement hooks, and end-to-end tests against a dedicated isolated environment are separate work items.

## Tests

- deterministic risk rules and severity ordering;
- critical/high-risk capability-control combinations;
- unknown and malformed declarations;
- refusal of non-object payloads;
- HTTP method, payload-size, cache, and response-header behavior;
- no interpretation or execution of untrusted prompt text.
