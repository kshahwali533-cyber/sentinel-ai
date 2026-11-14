# Sentinel AI Continuous Monitoring (Beta)

## Current beta behavior

- Only authenticated users can manage monitoring.
- Add only a public HTTPS domain that you own or are authorized to manage.
- Ownership is verified with a DNS TXT record at `_sentinel-ai-verification.<domain>`.
- The beta currently allows up to five monitored domains per account.
- Verified domains are scheduled for one scan per day.
- The scheduled worker claims at most three due sites per run and invokes the existing SSRF-safe `/api/scan` endpoint.
- The first successful scan establishes a baseline. Later scans create an in-app alert when a new warning appears, the risk level worsens, or the score drops by at least ten points.
- Users can pause, resume, remove monitored domains, and mark alerts as read.
- Scan runs and alerts are visible only to their owner through RLS-protected reads.

## Required server configuration

Set the following variables in Vercel without exposing their values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose in browser code)
- `CRON_SECRET` (sensitive; authorizes the scheduled worker)

The daily cron is declared in `vercel.json` at `0 2 * * *` UTC. Vercel Hobby runs cron jobs once per day with hour-level scheduling precision. Cron activation requires a production deployment; preview deployments do not activate the production schedule.

## Manual verification checklist

1. Sign in to a preview deployment.
2. Add a domain you control and confirm the pending state is shown.
3. Publish the exact DNS TXT name and value shown by the dashboard.
4. Verify the TXT record; confirm the site becomes active.
5. Pause and resume the site; confirm status and next scan time update.
6. Remove a test site; confirm its runs and alerts cascade-delete.
7. Call the worker without the bearer secret and confirm it returns 401.
8. In a protected test environment, invoke the worker with the configured secret and confirm a run is recorded.
9. Confirm another account cannot read the site's runs or alerts.

## Safety and launch notes

- Never bypass the existing scanner's DNS pinning or public-IP checks.
- The database claim function is executable only by `service_role`.
- Browser roles have SELECT only; writes go through authenticated server APIs.
- Alerts are in-app only. Email and webhook delivery are not configured.
- Do not describe the full product as launch-ready until end-to-end tests, alert delivery decisions, recovery/backup strategy, domain/email configuration, and the remaining launch gates are complete.
