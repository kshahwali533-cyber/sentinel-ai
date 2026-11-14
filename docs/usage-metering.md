# Beta usage metering

## Included

- A beta-only entitlement record is created automatically for new accounts and backfilled for existing accounts.
- The current beta allowance is 100 authenticated scans per UTC calendar month.
- Authenticated scan requests include the user's Supabase bearer token; anonymous scans continue to use the existing IP-based rate limit.
- Completed authenticated scans record the domain hostname, score, risk level and check count. Full URL paths and query strings are not stored in usage events.
- Authenticated report generation and Security Mentor requests record usage events.
- The Usage dashboard shows the current beta plan, scan allowance, reports and mentor sessions.
- Usage and entitlement tables have RLS; users can read only their own records. Browser clients cannot write usage or entitlement data.

## Billing and pricing

- This is metering and a beta entitlement only.
- No Stripe/PayPal or other payment provider is connected.
- No paid plan, price, subscription, checkout or recurring charge is active.
- No public pricing is defined in this implementation.
- Billing integration requires the product owner's explicit approval and provider credentials.

## Limitations

- Anonymous usage remains protected by IP rate limits and is not associated with an account.
- Usage event writes are best-effort after successful feature completion; transient telemetry failure does not fail the scan/report/mentor response.
- The scan quota check uses a pre-scan count and is not a transactional reservation under simultaneous requests. Existing IP rate limits reduce but do not eliminate concurrent boundary races.
- Plan entitlements are beta-only; paid tiers and invoice lifecycle are not implemented.
