# Beta usage metering

## Current application behavior

- New accounts receive a beta entitlement; existing accounts are backfilled by the entitlement migration.
- The beta allowance is 100 authenticated scans per UTC calendar month.
- Authenticated scans use the user's Supabase bearer token. Anonymous scans continue to use the existing IP-based rate limit.
- Authenticated scan completion records the hostname, score, risk level and check count. Full URL paths and query strings are not stored in usage events.
- Authenticated report generation and Security Mentor requests record usage events.
- The Usage dashboard shows the current beta plan, scan allowance, reports and Mentor sessions.
- Usage and entitlement tables use row-level security. Users can read only their own records; browser clients cannot write usage or entitlement data.

## Scan quota reservation

The scanner now calls three server-only database RPC functions:

- `reserve_scan_allowance` atomically reserves one monthly scan slot before processing.
- `complete_scan_allowance` consumes the reservation and writes the completed scan usage event.
- `cancel_scan_allowance` releases a reservation when a scan does not complete.
- Reservations expire after 15 minutes to recover from interrupted serverless requests.
- A per-user PostgreSQL advisory transaction lock prevents concurrent requests from exceeding the monthly allowance.
- The functions are executable only by `service_role`; the reservation table is in the private schema.

**Deployment gate:** the migration `20261114143419_sentinel_atomic_scan_allowance_20261114.sql` must be applied to the target Supabase project before the deployed scanner can use these RPCs. The migration file being present in Git does not prove that it has been applied. Do not apply it without the owner's explicit approval.

## Billing and pricing

- This is beta metering and entitlement enforcement only.
- No payment provider is connected.
- No paid plan, price, subscription, checkout or recurring charge is active.
- No public pricing is defined.
- Billing integration requires the product owner's explicit approval, approved seller onboarding, provider credentials and a separately reviewed database migration.

## Limitations and verification gates

- Anonymous usage remains protected by IP rate limits and is not associated with an account.
- Report and Mentor usage-event writes are best-effort after successful feature completion; transient telemetry failure does not fail the feature response.
- Paid-tier entitlements, invoice lifecycle, checkout, customer portal, refunds and subscription webhooks are not implemented.
- Before release, verify the entitlement and atomic-reservation migrations are applied in the intended Supabase environment, then run concurrency, expiry, completion and cancellation tests against a non-production project.
- Confirm the live database schema and function permissions independently; repository migrations alone are not proof of production database state.
