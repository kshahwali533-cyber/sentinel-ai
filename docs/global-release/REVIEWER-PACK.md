# Sentinel AI — Independent Security Reviewer Pack (Draft)

**Status:** Draft for review planning only · **Branch:** `feature/final-release-audit-20261117` · **Do not treat as authorization to test production**

## 1. Product and deployment scope

Sentinel AI is a Vercel-hosted cybersecurity scanning and security-guidance application backed by Supabase Auth/Postgres. Current code areas include:

- Browser application: `index.html`, `sentinel-app.js`, `sentinel-actions.js`, `sentinel-analytics.js`, `sentinel.css`.
- Server APIs: `/api/scan`, `/api/report`, `/api/assistant`, `/api/monitoring`, `/api/monitoring-run`, `/api/analytics`, `/api/intelligence`, `/api/research`, `/api/organizations`, `/api/organization-admin`, `/api/organization-assets`, `/api/usage`.
- Database: Supabase project `vceqmqwszvisvxxbgbfs`, region `ap-northeast-2`; migrations under `supabase/migrations/`.
- CI: GitHub Actions workflow `.github/workflows/security-api-checks.yml`; Preview branch `feature/final-release-audit-20261117`.

Production domain currently uses Vercel default domains; no custom brand domain is attached. Current Preview deployment region is `iad1`. The Preview branch does not yet have isolated branch-scoped Supabase/OpenAI runtime credentials, so authenticated end-to-end testing must wait for a safe staging configuration.

## 2. High-level data flows and trust boundaries

1. **Browser → Vercel API:** the browser uses public Supabase client configuration and sends user access tokens to server APIs. Privileged Supabase service-role and OpenAI credentials must remain server-side.
2. **Vercel API → Supabase:** server handlers validate access tokens with Supabase Auth, apply ownership/role checks, and perform privileged database operations. Public-schema tables have RLS enabled; direct client writes are limited.
3. **Scanner → target website:** scanner validates HTTP(S), resolves DNS, rejects non-public IPs, pins the validated address for the socket connection, manually validates every redirect and limits response size/time. Only explicitly authorized targets may be tested.
4. **Monitoring scheduler → worker:** Supabase Cron runs every 15 minutes and retrieves the worker secret from Vault. The worker claims due, DNS-verified sites and calls the existing scanner endpoint. Cron dispatch is live, but no verified active site currently exists, so a complete scheduled scan/alert cycle has not been demonstrated.
5. **AI Mentor → OpenAI Responses API:** server-side request uses `OPENAI_API_KEY`, a 12-second timeout and `store: false`; responses are normalized, bounded and escaped before display. Built-in defensive fallback is available.
6. **Team workspaces:** server APIs enforce membership/role checks. Only explicitly shared assets are visible to all members; unshared asset enumeration is restricted to owners/admins.

## 3. Controls already evidenced in the current Preview branch

- CI passes 167/167 unit tests, including scanner target identity, redirect safety, monitoring worker secret checks, RLS-related helpers, team asset visibility and report behavior.
- `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities in locked production dependencies at the recorded run.
- CI checks pinned DNS transport, manual redirect destination validation, response security headers and concurrent final-slot scan allowance.
- CI rejects privileged secret references in browser source: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`, `service_role`.
- Supabase read-only catalog review found all 21 public tables have RLS enabled; no `anon` table SELECT/INSERT grants were found. Owner/workspace-scoped policies and SECURITY DEFINER function grants were inspected.
- Supabase Cron job `sentinel-monitoring-every-15-minutes` is active; Vault secret presence is confirmed without reading its value; five recent worker dispatches returned HTTP 200.
- Vercel project SSO deployment protection is enabled for deployments (except custom domains); Vercel runtime error query found no error clusters in the last 24 hours.

## 4. Known gaps and launch blockers

- Supabase Security Advisor warns that Leaked Password Protection is disabled; this needs an owner-approved Auth configuration change and signup/reset regression tests.
- No isolated Preview Supabase/OpenAI credentials are configured. Production secrets must not be copied into Preview.
- Monitoring currently has one pending site, zero verified active sites, zero runs and zero alerts. An owner-controlled DNS TXT verification and end-to-end test are required.
- Email/webhook alert delivery is not configured; current alerts are in-app only.
- No custom domain is attached; regional latency, mobile/browser matrix, accessibility and load tests have not been measured.
- No custom Vercel firewall configuration exists; the default firewall applies. Custom WAF/managed-rule policy needs deliberate review before project-wide production changes.
- Supabase Free plan has no scheduled backups/PITR. Recovery/restore capability has not been exercised.
- No independent penetration test/application-security assessment has been commissioned or completed.

## 5. Proposed authorized assessment scope

After a dedicated staging environment and test accounts exist, the independent reviewer may assess:

- Authentication/session lifecycle, password recovery, authorization and role boundaries.
- API input validation, rate limits, abuse controls, error handling and information leakage.
- Scanner SSRF, DNS rebinding/pinning, redirects, response-size limits and target attribution using controlled fixtures.
- RLS, table grants, SECURITY DEFINER functions, cross-account isolation and team workspace permissions.
- Monitoring ownership verification, scheduler/worker secret boundary, queue claiming, pause/resume and alert lifecycle.
- AI Mentor prompt/data handling, provider failures, output validation and browser rendering.
- Reports/exports, security headers, CSP, dependency/supply-chain controls, deployment and recovery.

## 6. Explicit prohibitions and safety rules

- No testing of third-party domains, customer systems or production assets without written owner authorization and a defined scope.
- No destructive tests, data deletion, credential stuffing, denial-of-service, high-volume fuzzing, social engineering or persistence attempts unless separately approved in writing.
- No reading, printing, copying or rotating production secrets as part of the assessment.
- No production database migrations or firewall policy changes without separate written approval and a rollback plan.
- Use only reviewer-approved staging accounts and domains; retain minimal evidence and redact tokens, personal data and secret values.

## 7. Evidence and reporting requirements

The reviewer should provide assessment date, exact target scope, test accounts/roles, methods, exclusions, severity rationale, reproducible evidence, remediation guidance and retest results. The final release statement must name the assessor and tested scope and must not claim universal certification.

## 8. Release decision

**Current decision: NO-GO for Global Ready Release.** Code/CI improvements are progressing, but the blockers in Section 4 and the independent assessment in Section 5 remain unresolved.
