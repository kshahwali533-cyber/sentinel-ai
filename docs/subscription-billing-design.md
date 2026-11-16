# Sentinel AI — Subscription & Payments Design

Status: design only. No payment provider is connected, no paid plan is active, and no customer can be charged by this document.

## 1. Product goals

Build a secure, provider-independent subscription system for Sentinel AI. Keep the current beta experience working until a payment provider, prices, legal details, and launch approval are explicitly selected.

Core capabilities:
- Public plan comparison and monthly/yearly billing choice.
- Authenticated checkout initiation.
- Provider-hosted payment page; never collect or store card numbers or CVV in Sentinel.
- Verified payment webhooks and idempotent subscription updates.
- Server-enforced feature limits and usage allowances.
- Customer billing portal, invoices/receipts, cancellation and plan changes.
- Admin visibility into subscriptions, payment state, refunds/disputes and audit history.

## 2. Plan catalogue (prices intentionally unset)

| Plan | Intended audience | Entitlement direction |
| --- | --- | --- |
| Free / Beta | Individual evaluation | Limited monthly scans; basic reports; limited AI Mentor |
| Starter | Individual site owners | Higher scan allowance; reports; scheduled monitoring |
| Pro | Security practitioners | Larger scan allowance; CVE intelligence; research workspace; more monitoring targets |
| Business | Small teams | Shared workspace, seats, roles, team assets and pooled usage |
| Enterprise | Larger organizations | Custom limits, multiple teams, priority support and contract terms |

All prices, currencies, taxes, trial duration, usage quantities, seat counts and annual discounts remain TBD. Do not publish placeholder prices as real offers.

## 3. Main customer journey

1. User signs in and opens Pricing / Billing.
2. Server returns the published plan catalogue and current entitlement.
3. User selects a plan and billing interval.
4. Server validates the requested plan, account, currency and provider configuration.
5. Server creates a pending checkout session with an internal idempotency key and returns only the hosted checkout URL.
6. Provider collects payment details on its hosted page.
7. Browser return page displays “Payment processing” until a verified webhook confirms the result. A success redirect alone never activates paid access.
8. Webhook signature is verified against the raw request body; event ID is deduplicated and persisted.
9. Subscription and entitlement are updated transactionally from the verified provider event.
10. User sees the confirmed plan, renewal date, invoices and cancellation controls.

## 4. Backend architecture

- `api/billing/plans.js`: read-only public plan catalogue.
- `api/billing/checkout.js`: authenticated checkout creation; validates server-side price IDs and never trusts browser-supplied amounts.
- `api/billing/portal.js`: authenticated customer portal session.
- `api/billing/webhook.js`: raw-body signature verification, event deduplication, event-to-state mapping.
- `api/billing/subscription.js`: authenticated read-only subscription summary.
- `api/billing/cancel.js`: authenticated cancellation request; provider API call and audit event.
- Shared billing adapter isolates provider-specific APIs. Provider secrets remain server-side Vercel environment variables and are never returned to the browser.

All write operations must be authenticated, validated, rate-limited and audited. The browser must never be able to set its own plan, payment status, price, quota or subscription period.

## 5. Data model proposal (migration required later)

- `billing_customers`: user_id, provider, provider_customer_id, created_at.
- `billing_subscriptions`: user_id, provider, provider_subscription_id, provider_price_id, plan_code, status, interval, currency, current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at, updated_at.
- `billing_payment_events`: provider, provider_event_id (unique), event_type, received_at, processed_at, processing_status, safe_payload_metadata. Do not store card data or unnecessary personal/payment details.
- `billing_invoices`: user_id, provider_invoice_id, status, currency, amount_due, amount_paid, hosted_invoice_url, invoice_pdf_url, period dates, created_at.
- Existing `account_entitlements`: evolve the beta-only plan constraint into a controlled plan/status entitlement model. Preserve the current user_id ownership and service-role-only writes.

Use database constraints and unique provider identifiers to prevent duplicate customer/subscription/event records. Add indexes for user_id, provider IDs, status and period end. Enable RLS on every billing table; users may read only their own safe billing summaries. Only trusted server-side service-role code may write billing records.

## 6. Subscription state rules

- `incomplete`: checkout created, payment not yet confirmed; paid features remain disabled.
- `trialing`: enabled only if an approved trial policy exists.
- `active`: paid features enabled within the paid period.
- `past_due`: apply a documented grace policy; never silently grant unlimited access.
- `canceled`: access follows the verified paid-through date and cancellation policy.
- `unpaid` / `suspended`: paid features disabled according to published terms.
- Refunds and disputes: reconcile from provider events and record an audit trail.

Webhook processing must tolerate retries, duplicates, delayed events and out-of-order delivery. Re-fetch canonical subscription state from the provider when event ordering is ambiguous.

## 7. Security and reliability requirements

- Hosted checkout and hosted customer portal; Sentinel never handles raw card details.
- Verify webhook signatures using the exact raw request bytes.
- Deduplicate provider events with a unique constraint and idempotent processing.
- Never trust query parameters such as `?success=true` as payment evidence.
- Do not accept amount, currency, plan limits or provider price IDs directly from an untrusted client.
- Keep provider API keys and webhook secrets in server-side environment variables only.
- Use least-privilege service-role access; no service-role key in frontend code.
- Add rate limits, audit logs, safe error messages and reconciliation for missed webhooks.
- Test failed payments, duplicate events, refunds, disputes, cancellation, renewal, expired cards and webhook replay before launch.

## 8. Payment provider selection

Provider is deliberately undecided. Before implementation, compare providers for:
- Pakistani business/individual eligibility and settlement to the owner's bank account.
- International card acceptance and supported customer countries.
- Recurring subscriptions, hosted checkout, customer portal and signed webhooks.
- Refunds, disputes, taxes, invoice support, fees and payout timing.
- Required business registration, KYC and compliance documentation.

Do not assume Stripe availability or create an account on the owner's behalf. Do not connect a provider, enter credentials, or enable live mode without explicit approval.

## 9. UI surfaces

- Pricing: plan cards, monthly/yearly toggle, feature comparison and clear limits.
- Checkout handoff: selected plan, interval, currency and secure provider redirect.
- Billing overview: current plan, status, renewal/end date, usage, invoices and payment method management link.
- Subscription controls: upgrade/downgrade, cancel-at-period-end, resume where supported.
- Payment result: pending, confirmed, failed or canceled states with clear next steps.
- Admin billing: searchable customer/subscription status, event processing health and audit history; sensitive payment details remain with the provider.

## 10. Delivery phases and acceptance gates

1. Confirm product plans, prices, limits, currency, tax policy and target markets.
2. Select a provider that can onboard the owner and settle funds in Pakistan.
3. Approve provider connection and create test-mode credentials outside chat.
4. Add schema migration and RLS; review before applying to Supabase.
5. Implement provider adapter, checkout, webhook and subscription APIs on a feature branch.
6. Add server-side entitlement checks to scans, reports, AI Mentor, monitoring, intelligence and team features.
7. Build Pricing and Billing UI.
8. Run provider sandbox tests and security tests; verify duplicate/replayed webhook handling.
9. Review legal terms, privacy, cancellation/refund policy and tax obligations.
10. Obtain separate approval before live payment mode, public pricing, production migration or production deployment.

## 11. Current verified baseline

The current application has beta-only metering: 100 authenticated scans per UTC month, usage event tracking and a usage dashboard. Existing entitlement records are constrained to the `beta` plan, and the usage API explicitly reports that billing is not connected. No paid plan, checkout, recurring charge or payment provider is active. The first implementation step must therefore be a reviewed migration and billing backend—not a cosmetic “Upgrade” button.
