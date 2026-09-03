# Fixed-price commerce runbook

The live card path is disabled by default and is intended for Stripe-hosted Checkout. Hosted Checkout can present Apple
Pay on eligible Apple devices without a custom Apple Pay UI. Provider approval, tax registration, rights-cleared catalog
data, and production rehearsals remain mandatory.

## Required production configuration

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
GROVE_SITE_URL
GROVE_ACQUISITION_ENABLED=true
GROVE_SELLER_TERMS_VERSION=2026-09
GROVE_BUYER_TERMS_URL=https://marketplace.example/terms
GROVE_BUYER_TERMS_VERSION=2026-09
GROVE_MAX_ITEM_PRICE_MINOR=1000000
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GROVE_STRIPE_AUTOMATIC_TAX=true
GROVE_CHECKOUT_RESERVATION_MINUTES=35
CRON_SECRET=<at-least-32-random-bytes>
```

Use distinct Stripe and Supabase resources for production and preview. Never enable acquisition on a pull-request
preview or seed production with prototype records. `GROVE_MAX_ITEM_PRICE_MINOR` caps the work subtotal before tax and
shipping; set shipping rates and Stripe's account/payment-method limits so the resulting gross charge remains supported.

## Enablement sequence

1. Obtain written Stripe approval for the exact art/NFT, value, refund, and merchant model.
2. Register and configure tax, product tax codes, supported shipping countries, receipts, statement descriptor, support
   contacts, refund policy, and Apple Pay in Stripe. Configure Stripe Checkout's account terms URL to exactly
   `GROVE_BUYER_TERMS_URL`; that version must incorporate each work's linked license.
3. Apply `20260903000000_live_commerce_foundation.sql` to the isolated preview project, rehearse, then production.
4. Insert the seller, accepted terms, and required cleared rights assertions for each real work.
5. Set accurate inventory, shipping requirement/rate, tax code, price, currency, HTTPS buyer-terms URL/version, durable
   license URI, and finally `sale_enabled = true` on approved fixed-price physical works. Prototype data must stay disabled.
6. Register `POST /api/stripe/webhook` and subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `refund.created`
   - `refund.updated`
   - `refund.failed`
   - `charge.dispute.created`
   - `charge.dispute.closed`
7. Replay duplicates and out-of-order sandbox events. Verify one reservation decrement, one state transition, and one
   outbox record.
8. Verify `/api/cron/commerce-reconcile` runs every ten minutes with `CRON_SECRET`; it expires a provider Session still
   open five minutes after the database hold, and returns 503 on any item error or unresolved stale state. Alert on every
   failed run. Run expiry, refund, dispute, provider-timeout, database-timeout, sold-out, and concurrent-checkout rehearsals.
9. Enable the environment flag for invited users only, then monitor reservations, provider events, paid orders, outbox,
   fulfillment, and support.

## Incident actions

- **Inventory mismatch, false status, tax/config error, or webhook disagreement:** set
  `GROVE_ACQUISITION_ENABLED=false`, then enumerate every `checkout-pending` acquisition with an attached provider
  Session. Expire each open Session through Stripe, verify the provider reports it expired, and only then release the
  matching reservation. Keep the flag off, preserve evidence, and reconcile all pending rows before re-enabling.
- **Checkout session exists but database attachment failed:** do not release inventory until the provider session is
  confirmed expired. The endpoint preserves the reservation when expiry cannot be proven.
- **Webhook delivery fails:** Stripe retries. Fix the receiver, then replay events; unique event IDs prevent duplicate
  business effects. Keep `STRIPE_*` and the Supabase server configuration present even while
  `GROVE_ACQUISITION_ENABLED=false`; the sales kill switch must not disable event ingestion.
- **Paid but not fulfilled:** do not refund or mint ad hoc. Use the operator workflow and append reason/evidence to the
  ledger/audit log.
- **Contract or chain disagreement:** pause mint delivery only. Collector transfers remain live.

Browser success URLs never authorize fulfillment. A signed paid webhook plus the authoritative database state is the
minimum card-payment evidence.
