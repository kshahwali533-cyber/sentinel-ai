# Sentinel AI Continuous Monitoring (Beta)

## Current beta behavior

- Only authenticated users can manage monitoring.
- Add only a public HTTPS domain that you own or are authorized to manage.
- Ownership is verified with a DNS TXT record at `_sentinel-ai-verification.<domain>`.
- The beta currently allows up to five monitored domains per account.
- Verified domains are scheduled for a security scan every 15 minutes, aligned to UTC quarter-hour boundaries to avoid scheduler drift.
- Supabase Cron invokes the production monitoring worker every 15 minutes. The worker claims at most three due sites per run and invokes the existing SSRF-safe `/api/scan` endpoint.
- The worker targets `VERCEL_PROJECT_PRODUCTION_URL` so internal scan requests use the stable production domain, not a deployment-specific preview URL.
- The first successful scan establishes a baseline. Later scans create an in-app alert when a new warning appears, the risk level worsens, or the score drops by at least ten points.
- Users can pause, resume, remove monitored domains, and mark alerts as read.
- Scan runs and alerts are visible only to their owner through RLS-protected reads.
- This is periodic monitoring, not instantaneous real-time detection. A site is checked on its next scheduled run.

## Required server configuration

Set the following variables in Vercel without exposing their values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose in browser code)
- `CRON_SECRET` (sensitive; authorizes the scheduled worker)

The monitoring scheduler is managed by Supabase Cron using `pg_cron` and `pg_net`. The matching `CRON_SECRET` is stored in Supabase Vault as `sentinel_monitoring_cron_secret`; it must never be committed to Git or returned to a browser. The old Vercel daily cron is intentionally removed so there is only one scheduler.

## Operational verification checklist

1. Confirm the Supabase Cron job `sentinel-monitoring-every-15-minutes` is active with schedule `*/15 * * * *`.
2. Confirm cron history shows successful dispatches and `net._http_response` shows HTTP 200 responses.
3. Add a domain you control and confirm the pending state is shown.
4. Publish the exact DNS TXT name and value shown by the dashboard.
5. Verify the TXT record; confirm the site becomes active and shows a 15-minute interval.
6. Pause and resume the site; confirm status and next scan time update.
7. Remove a test site; confirm its runs and alerts cascade-delete.
8. Call the worker without the bearer secret and confirm it returns 401.
9. In a protected test environment, invoke the worker with the configured secret and confirm a run is recorded.
10. Confirm another account cannot read the site's runs or alerts.

## Safety and launch notes

- Never bypass the existing scanner's DNS pinning or public-IP checks.
- The database claim function is executable only by `service_role`.
- Browser roles have SELECT only; writes go through authenticated server APIs.
- Alerts are in-app only. Email and webhook delivery are not configured.
- The worker processes at most three websites per invocation to stay within its function-duration budget; higher volume needs queueing or a dedicated worker.
- Do not describe the full product as launch-ready until end-to-end tests, alert delivery decisions, recovery/backup strategy, domain/email configuration, and the remaining launch gates are complete.
