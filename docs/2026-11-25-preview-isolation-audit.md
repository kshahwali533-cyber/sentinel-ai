# Sentinel AI — Preview Isolation and External Release Gates
Date: 2026-11-25
Candidate branch: `fix/api-request-size-limits-2026-11-24`
Verified candidate commit before this audit note: `ea74b36d8453dacc0da4d0b21238c00e7998ee36`

## Verified automatically

- GitHub Actions on the candidate commit: Security API checks, Research Scope Gate Tests, Main Security Hardening, and CodeQL Security Analysis all completed successfully.
- The security API workflow verified JavaScript syntax/unit tests, concurrent scan quota behavior, two-user Research Lab isolation, pinned DNS connections, security response headers, and manual redirect safety.
- The candidate Vercel Preview deployment for the exact commit reached READY.
- Automated tests cover IPv4/IPv6 public-IP classification, pinned lookup behavior, real local HTTP socket transport, relative redirects, rejection of private redirect targets, redirect limits, response body byte limits/timeouts, AI Mentor input/output validation and safe fallback, report input validation and score recalculation, domain proof parsing, runtime host allowlisting, and Preview database isolation.
- The user's browser-provided Preview page text confirmed that Preview Safe Mode is visible and account/database-backed features are intentionally disabled.

## Environment inspection (metadata only)

- The connected Vercel project has Production-only `OPENAI_API_KEY`; no Preview AI key is configured.
- Preview environment metadata contains Supabase variable names, including a Preview service-role key and URL, but secret values were not decrypted or read.
- The current candidate branch has no branch-specific Preview environment variables.
- Code-level guard `createSupabaseAdmin()` returns null in every Vercel Preview runtime. Automated tests cover this guard and all 12 database-backed API routes use the shared helper.
- The connected Supabase account currently lists only the existing `Sentinel AI` project. No separate isolated test project or development branch exists.
- The live Supabase project is ACTIVE_HEALTHY. Its current Security Advisor still reports `Leaked Password Protection Disabled`. No live setting was changed.

## Still not honestly verifiable without separate authorization/resources

1. **Real browser end-to-end flows behind Preview protection:** the user's page text confirms rendering and Safe Mode, not sign-up/login/recovery, scans, reports, or AI calls. No protected-session bypass link was created.
2. **Real isolated Auth/data flows:** no separate Supabase test project exists. Do not point Preview at the current production database. Creating a new project/branch may incur cost and requires choosing the organization and reviewing the quoted cost.
3. **Live AI Mentor call:** no Preview OpenAI API key is configured; the production key was not read. Unit tests verify fallback and response validation, not a paid provider call.
4. **Live monitoring scan and alert:** automated tests use fake database/scan clients. No real test site/run/alert was created, and email/webhook delivery is not configured.
5. **Real domain ownership proof and custom-domain cutover:** unit tests verify DNS/file/meta proof logic. No user-controlled test domain has been supplied; no DNS or Vercel domain settings were changed.
6. **Backup/restore proof and live Auth hardening:** scheduled backups are not available on the current Free plan; a verified export/restore has not been performed. Leaked-password protection remains disabled and needs explicit approval before changing the live Auth setting.
7. **Mobile/cross-browser verification:** the Preview page text confirms visible layout only; no device/browser matrix has been executed.
8. **Pre-parser request ingress cap:** API-level byte checks occur after Vercel has decoded `req.body`; they bound downstream work, not ingress memory consumption.

## Safety and deployment status

- PR #90 remains Draft and unmerged.
- No `main` changes, Production deployments, live Supabase schema/data/settings changes, DNS changes, or deletions were performed.
- Secret values were not decrypted or copied into this report.
- The latest Preview deployment is a Preview deployment only; its READY status is not evidence that live customer flows work.
- Do not merge, promote, deploy to Production, alter live Supabase, or delete resources without explicit user approval.

## Decision

Automated code-level security checks and Preview build verification are green. Sentinel AI is **not yet end-to-end release-ready**. The remaining items above are external integration and operational gates, not failures that can honestly be marked complete from CI alone.


## Follow-up verification of the five practical release checks (2026-11-25)

### 1. CVE intelligence
- A live NIST NVD API 2.0 record was retrieved for `CVE-2021-44228`.
- NVD reports Apache Log4j2 remote-code-execution exposure, CVSS 3.1 **10.0 / CRITICAL**, and affected Log4j2 version ranges.
- NVD's response identifies CISA KEV membership, date added `2021-12-10`, and due date `2021-12-24`. The NVD detail page independently displays the CISA KEV notice.
- Sentinel's CVE normalization, KEV exact-match, missing-record, and unavailable-feed behavior have automated test coverage. The authenticated Sentinel API route itself was not called against Production; Preview Safe Mode intentionally has no database client.

### 2. Professional security report
- Report API validation, score recalculation, evidence normalization, executive summary, prioritization, and print/UI regression tests are included in the passing CI suite.
- No live customer report was created or stored. Preview report actions remain disabled in Safe Mode, and Production was not used for a test.

### 3. AI Security Mentor
- Automated tests cover input validation, evidence limits, safe fallback guidance, response schema validation, preservation of scanner severity/status, and rejection of unsafe instructions.
- The OpenAI API key exists only in Vercel Production metadata; no Preview AI key is configured. Secret values were not read.
- No real paid OpenAI call was made. A real AI-powered session remains unverified; the passing tests prove the fallback and validation logic, not provider availability or live billing.

### 4. Domain ownership and 15-minute monitoring
- Live Supabase read-only checks confirm the cron job `sentinel-monitoring-every-15-minutes` is active with schedule `*/15 * * * *`.
- The last 12 cron dispatches each completed successfully; the corresponding last 12 `net._http_response` records were HTTP **200**, with no timeout or error.
- The database currently has one monitoring site in `pending` status, zero verified sites, zero monitoring runs in the last 24 hours, and zero alerts in the last 24 hours.
- Therefore the scheduler/dispatch path is verified, but a real owned-domain DNS TXT verification and customer-site scan/alert are not. No user-controlled test domain was supplied and no DNS was changed.

### 5. Research Workspace and Team Workspaces
- CI confirms Research Scope Gate tests and two-user Research Lab database isolation pass. Team/organization invitation-safety, policy, and workspace API tests are part of the passing automated suite.
- Read-only production aggregates show zero research projects and zero research findings; one organization and one member exist, with two invitation records. No production records were created or modified for testing.
- A real end-to-end project/finding workflow and a real team invitation acceptance workflow remain unverified because Preview has no isolated Supabase project and all database-backed Preview routes are intentionally blocked.

### Follow-up hardening completed after the initial audit
- Added Vercel pre-handler body-parser limits: Scan 32 KiB, AI Mentor 64 KiB, Reports 1 MiB. The stricter in-handler limits remain 16 KiB, 32 KiB, and 512 KiB respectively.
- Added a regression test that checks both parser and application-level limits.
- Exact candidate commit `3ae3ab18acee322edf378b24a030031e324793b1` passed Main Security Hardening, Security API checks, Research Scope Gate Tests, CodeQL, and Vercel Preview READY.
- PR #90 remains Draft/unmerged. No Production deployment, `main`, live Supabase setting/schema/data, DNS, or resource deletion was performed.

## Final result of this audit

The automated security/build checks, NVD data retrieval, and real 15-minute scheduler dispatch are verified. The five practical release checks are **not all complete**: live report creation, live AI Mentor, DNS proof plus monitored-site execution, and Research/Team end-to-end workflows still require isolated test resources or an authorized user-controlled domain. It would be misleading to mark Sentinel AI fully end-to-end release-ready.
