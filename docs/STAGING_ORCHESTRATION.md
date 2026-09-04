# Staging marketplace orchestration

Staging uses GitHub Actions as an external scheduler because Vercel Cron invokes
Production deployments only. The workflow at
`.github/workflows/staging-resale-index.yml` calls the fixed
`https://the-school-sepolia.vercel.app` alias every five minutes, offset two
minutes from the hour. It also supports a manually selected worker for an
operator-controlled auction rehearsal.

## Authority boundary

The workflow has empty GitHub permissions, performs no source checkout, and
receives no Supabase, Stripe, RPC, bundler, paymaster, wallet, OpenSea, or Vercel
credentials. Its only secret is `GROVE_STAGING_CRON_SECRET`, which must match the
independently scoped `CRON_SECRET` on the Vercel `staging` environment. Each API
route remains responsible for constant-time bearer authentication, runtime
configuration validation, idempotency, durable state transitions, and
finality checks.

The origin is intentionally hard-coded. No workflow input or repository
variable can redirect these calls to Production.

## Workers and gates

Repository variables are deny-by-default: a worker is enabled only when its
exact variable value is `true`. Missing, empty, or any other value stays off.

| Order | Worker | Repository gate | Default | Effect |
|---|---|---|---|---|
| 1 | `auction-close` | `GROVE_STAGING_AUCTION_CLOSE_ENABLED` | Off | Closes eligible Sepolia auctions after rechecking signatures, account attestation, and finalized inventory custody. |
| 2 | `auction-settle` | `GROVE_STAGING_AUCTION_SETTLE_ENABLED` | Off | Creates or confirms idempotent Stripe test-mode winner payments and records observations. |
| 3 | `nft-delivery` | `GROVE_STAGING_NFT_DELIVERY_ENABLED` | Off | Prepares and reconciles authorized Safe NFT delivery evidence; the worker does not hold a signing key. |
| 4 | `resale-index` | None | On | Reads finalized Sepolia logs, advances leased checkpoints, reconciles ownership/orders, and refreshes safe aggregate statistics. |
| 5 | `sponsorship-reconcile` | `GROVE_STAGING_SPONSOR_RECONCILE_ENABLED` | Off | Reconciles already-submitted sponsored UserOperations against canonical finalized evidence. |

The scheduled run attempts every enabled lane in this order and reports a
failed job if any invocation fails. A failure does not prevent independent
later lanes from being attempted. Database leases and idempotency keys remain
authoritative if GitHub retries or overlaps a delivery.

Manual dispatch never overrides a gate. Selecting an explicitly disabled
worker fails without invoking it. `all-enabled` invokes the finalized indexer
plus only those guarded workers whose variables are already `true`.

## Full rehearsal gate sequence

Keep all four guarded repository variables absent or `false` during normal
staging. Before enabling any one of them, verify that the corresponding Vercel
staging configuration and provider test-mode credentials pass the readiness
checks documented in the commerce, delivery, secondary-market, and owner-exit
runbooks. Enable and rehearse one lane at a time in dependency order, inspect
the durable database/provider/chain evidence, then return the variable to
`false` after the exercise.

The workflow becomes schedulable only after its file exists on the repository
default branch. Activate it through a workflow-only operational change, not by
copying staging credentials or application data into `main`. If Vercel Git
deployments are attached to `main`, first ensure `.github/**`-only commits are
ignored so activating this scheduler does not create or promote a Production
deployment.
