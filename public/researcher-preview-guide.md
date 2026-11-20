# Sentinel AI — Researcher Preview Guide

**Status:** Controlled evaluation preview, not a public bug-bounty program.

## Purpose

This preview lets an invited reviewer assess Sentinel AI's user-facing security features and, where the reviewer owns or has written authorization for an asset, record a finding against a verified HTTPS domain. The workspace supports private projects, findings, severity, remediation notes, evidence items, and finding status.

## What is currently available

- Account-authenticated, private research projects.
- Finding records linked to a domain verified in the same account's Monitoring workspace.
- Finding severity and lifecycle status.
- Evidence fields for source, signal, observed behavior, and expected behavior.
- Private notes attached to findings.
- Project export controls where shown in the application.

## What is not yet available

- A public bug-bounty program, reward terms, or public submission intake.
- Research-case and independent reviewer approval records are available in the private API foundation; the complete researcher-facing controls are still under development.
- An enabled active-testing engine. Scope checks are decision-only and do not authorize or send test traffic.
- Automated monitoring scheduling (15-minute jobs remain pending activation).
- A formal security certification or independent audit attestation.

The scope-check route is decision-only and must not be treated as permission to run a test. Until the case/approval data model and reviewer workflow are deployed and independently verified, treat active testing as disabled.

## Mandatory rules of engagement

1. Test Sentinel AI only within the exact written scope provided by its owner.
2. Do not scan, probe, or exploit third-party targets using Sentinel AI unless the third-party owner has separately authorized that activity in writing.
3. Use only dedicated test accounts and test data. Do not use real customer accounts or production personal data.
4. Do not perform denial-of-service, brute force, credential theft, phishing, social engineering, persistence, destructive writes, privilege escalation, or data exfiltration.
5. Do not bypass authentication or access controls beyond the approved test plan.
6. Stop immediately if the test exposes real personal data, credentials, secrets, or an out-of-scope asset.
7. Keep all findings confidential and send them only to the designated contact named in the written engagement.

## Minimum contents of a finding

- Finding title and affected asset/path.
- Date and time with timezone.
- Preconditions and test account role (never include passwords or tokens).
- Reproducible steps using non-destructive requests.
- Expected result and observed result.
- Redacted evidence (remove cookies, authorization headers, tokens, personal data, and secrets).
- Security impact and realistic attack preconditions.
- Suggested remediation.
- Severity rationale and whether the issue is reproducible.

## Evidence handling

Do not upload raw session cookies, API keys, passwords, private keys, personal data, or unredacted customer records. Keep evidence limited to the minimum necessary to demonstrate the issue. Store original evidence securely under the engagement agreement; only upload a redacted copy to this workspace.

## Completion and disclosure

A finding marked resolved or false positive in Sentinel AI is an internal workflow status, not proof that an independent retest passed. A formal retest result must be recorded by the reviewer with date, method, and evidence. No certificate, certification, or legal safe-harbor status is implied by using this workspace.

## Owner-provided engagement details

Before inviting external reviewers, the product owner must provide a separate signed engagement document specifying:
- exact preview hostname and allowed paths;
- start/end dates and time zone;
- allowed HTTP methods and test categories;
- excluded systems and prohibited techniques;
- test accounts and test-data boundaries;
- emergency stop/contact procedure;
- evidence retention and disclosure terms.

**If any of these details are missing, do not begin testing.**
