# Marketplace & Auction House of Brooklyn

[![CI](https://github.com/Greenpoint-Compute-Cooperative/grove-marketplace/actions/workflows/ci.yml/badge.svg)](https://github.com/Greenpoint-Compute-Cooperative/grove-marketplace/actions/workflows/ci.yml)
[![Production health](https://github.com/Greenpoint-Compute-Cooperative/grove-marketplace/actions/workflows/uptime.yml/badge.svg)](https://github.com/Greenpoint-Compute-Cooperative/grove-marketplace/actions/workflows/uptime.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6cff.svg)](LICENSE)

A curator-led marketplace for physical art in the School and born-digital work. The primary loop is discovery → save → sponsor → publish; the monthly auditorium bazaar brings the catalog into New York.

**Live:** [the-school-omega.vercel.app](https://the-school-omega.vercel.app)

![Marketplace & Auction House of Brooklyn home page](docs/screenshot-desktop.jpg)

![Born-digital work and acquisition preview](docs/screenshot-work.jpg)

<img src="docs/screenshot-phone.jpg" alt="Marketplace &amp; Auction House of Brooklyn on a phone" width="300">

## Architecture

- Vanilla HTML, CSS, and ES modules keep the editorial storefront fast; esbuild isolates the exact-pinned Ethereum bid-intent bundle.
- Vercel Functions in `api/` provide OAuth, session, profile, curator-workflow, catalog, and acquisition-state boundaries.
- Supabase provides Auth and Postgres. Migrations add social-linked Safe accounts, NFT custody, auctions, signed bids, payment mandates, settlements, and chain delivery behind row-level security.
- The gated production path pre-mints approved works as ERC-721/1155 inventory on Ethereum mainnet. Members will use passkey Safe accounts; Grove sponsorship is limited to allowlisted marketplace actions.
- Card lots use Stripe-hosted Apple Pay/card setup and signed offchain bids. Crypto lots are a separate, gated rail; a v1 auction never mixes reversible card and irreversible crypto settlement.
- First-party product events are session-scoped, server-validated, private by default, aggregated behind an operator token, and deleted after 180 days.
- The bundled catalog remains available when the backend is absent. OAuth and checkout never claim success without real configuration.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for trust boundaries and [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md) for production/preview isolation.

The repository uses dedicated production and preview Supabase projects in US East plus the `dmarzzzs-projects/the-school` Vercel project. Database migrations are applied independently, and Preview/Development receive synthetic data only. Instagram and X remain visibly disabled until their dedicated provider apps, policy URLs, and credentials are approved.

## Run the interface

```sh
git submodule update --init --recursive
npm ci
npm run dev
```

The full validation suite also requires Foundry `v1.3.2`.

Open [http://localhost:8013](http://localhost:8013). This static mode intentionally shows Instagram and X as not configured.

## Configure the backend

1. Create or choose a dedicated Supabase project, then inspect and apply the migration:

   ```sh
   supabase link --project-ref <project-ref>
   supabase db push --dry-run
   supabase db push
   ```

2. Configure Instagram and X in Supabase using [`docs/OAUTH_SETUP.md`](docs/OAUTH_SETUP.md). Keep both enable flags false until each consent/callback flow passes staging.
3. Copy `.env.example` to `.env.local` or pull the linked Vercel environment. The publishable key serves authenticated RLS requests. The Supabase secret, metrics token, and cron secret are server-only and must never enter static files or public-prefixed variables.
4. Add values to the correct Vercel environment scopes, then verify:

   ```sh
   npm run config:check
   npm run ci
   vercel build
   ```

5. Run `vercel dev` only after local variables are present. Deploy a preview, complete provider review and end-to-end OAuth checks, then promote deliberately.

## Validate

```sh
npm run ci
npm audit --omit=dev
npm run live:check
```

## Routes

- `#home` — seed image and discovery entry
- `#discover` — New, Saved, and Sponsored discoveries
- `#sponsor` — curator work draft
- `#join` — Instagram/X-only OAuth entry
- `#market` — physical, digital / NFT, and paired works
- `#work/:slug` — detail with honest crypto/card preview
- `#curators` / `#curator/:id` — sponsors and selections
- `#bazaar` — monthly auditorium program and calendar export
- `/api/health` — live database and integration readiness, without secrets
- `POST /api/events` — same-origin, allowlisted, session-scoped product events
- `GET /api/metrics?days=30` — bearer-protected aggregate operator feed
- `/api/cron/metrics-retention` — Vercel-authenticated 180-day cleanup
- `GET/POST /api/auctions/:id/bids` — privacy-safe feed and EIP-712/ERC-1271 bid acceptance
- `GET /api/auctions/:id/bid-context` — authenticated, server-canonical context for a pre-provisioned Safe passkey bid
- `POST /api/auctions/:id/payment-setup` — per-auction hosted Apple Pay/card mandate
- `POST /api/wallet/challenge` and `/api/wallet/link` — one-time, origin-bound ERC-1271 social-to-Safe link
- `POST /api/stripe/webhook` — signed fixed-price and auction payment events
- `/api/cron/auction-close` — close-time ERC-1271 revalidation and idempotent winner selection

## Product notes

- [`LAUNCH.md`](LAUNCH.md) — MVP, curator-first GTM, NFT launch path, and launch sequence
- [`DESIGN.md`](DESIGN.md) — identity and visual system
- [`docs/OAUTH_SETUP.md`](docs/OAUTH_SETUP.md) — provider, consent, privacy, and deletion checklist
- [`docs/METRICS.md`](docs/METRICS.md) — event dictionary, funnels, privacy, and interpretation
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — deploy, rollback, incident, secret, and provider operations
- [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md) — isolated production, preview, and local setup
- [`docs/PRODUCTION_BACKLOG.md`](docs/PRODUCTION_BACKLOG.md) — prioritized pilot, commerce, reliability, and growth work
- [`docs/LIVE_MARKETPLACE_MASTER_PLAN.md`](docs/LIVE_MARKETPLACE_MASTER_PLAN.md) — researched contracts, payments,
  Apple Pay, API, compliance, and staged launch plan
- [`docs/COMMERCE_RUNBOOK.md`](docs/COMMERCE_RUNBOOK.md) — fail-closed Apple Pay/card auction operations and incident actions
- [`contracts/README.md`](contracts/README.md) — inventory-mint ERC-721/ERC-1155 candidates and Ethereum gates
- [`docs/GENERATED_ASSETS.md`](docs/GENERATED_ASSETS.md) — source and generated-asset disclosure

## Contribute

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md). Pull requests run deterministic Node 24 CI, repository contract checks, tests, a production build, dependency audit, and retain a reviewable static artifact. Bug, product, and rights/provenance issue forms are available; vulnerabilities go through the private path in [`SECURITY.md`](SECURITY.md).

The code is available under the [MIT License](LICENSE). Tagged releases rebuild the app, rerun CI, and publish a checksummed static artifact.

The supplied floating-school image is the marketplace’s primary mark. Catalog records are fictional prototype content and cannot be sold. A fully configured Vercel Preview may expose one chain-verified synthetic Sepolia auction rehearsal for a pre-provisioned member Safe; production wallet, auction, Apple Pay/card, and mainnet contract paths remain disabled until the master-plan gates pass. No live wallet, checkout credential, paymaster submission path, or production NFT is claimed.
