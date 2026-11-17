# 04 — Continuous Monitoring and Alerts

**Status:** Code exists; live scheduler/dispatch unverified · **Priority:** Critical · **Release gate:** Yes

## Objective
Prove authorized, scheduled monitoring works end to end and alerts the correct account. A migration file or UI alone is not proof of an active service.

## Tasks
- [ ] **MON-01 Authorization:** verify ownership proof and account authorization before a domain can be monitored.
- [ ] **MON-02 Scheduler:** verify the intended Supabase Cron job is installed, enabled and running every 15 minutes.
- [ ] **MON-03 Secrets:** verify required server-side configuration and Vault secret exist without displaying secret values.
- [ ] **MON-04 Dispatch:** verify Cron history and worker HTTP responses, including unauthorized calls returning 401.
- [ ] **MON-05 Lifecycle:** test baseline, later changes, pause, resume, removal and retry behavior on an authorized test domain.
- [ ] **MON-06 Isolation:** prove one account cannot view or modify another account's monitored sites, runs or alerts.
- [ ] **MON-07 Alerts:** verify current in-app alerts. Email/webhook delivery is not configured; do not promise it until implemented and tested.
- [ ] **MON-08 Scale:** verify worker limits, failure recovery and queue/scaling plan beyond the current small batch.

## Evidence required
Cron job status/history; successful worker dispatch; test-domain run records; alert evidence; cross-account denial tests; pause/resume/remove results.

## Pass criteria
End-to-end scheduled scan works for an authorized test domain; unauthorized requests are rejected; account isolation passes; failures are observable and recoverable.

## Known starting points
`api/monitoring.js`, `api/monitoring-run.js`, `api/_lib/monitoring.js`, `docs/monitoring.md`, `test/monitoring.test.js`, `test/monitoring-run-api.test.js`, `supabase/migrations/20261115231717_sentinel_monitoring_15m_scheduler.sql`.

## Safety boundary
Do not apply migrations, change Vault values or production environment variables during this workstream without explicit owner approval. Verify configuration read-only first.

## Completion record
- Environment tested:
- Cron/dispatch evidence:
- Test domain (authorized):
- Open issues:
- Decision: NOT RUN / BLOCKED / PASS / FAIL
