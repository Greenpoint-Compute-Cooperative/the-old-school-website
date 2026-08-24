# Production backlog

This is the shortest path from the current invited-pilot build to a trustworthy marketplace. `P0` blocks an invited curator pilot; `P1` blocks real acquisition or public launch; `P2` compounds a working product.

## Already in place

- Dedicated Vercel production deployment and Supabase US East project.
- RLS-first marketplace schema, social-only OAuth boundary, server-only secrets, fail-closed integrations, health/config endpoints, and reversible feature flags.
- Privacy-safe first-party telemetry, protected aggregate reporting, 180-day retention, and daily health/retention jobs.
- Deterministic Node 24 CI, dependency updates, ownership, issue forms, PR template, security policy, runbook, architecture map, and visual/browser smoke checks.
- MIT license, pinned official GitHub Actions, checksummed tagged releases, hourly full-story live monitoring with incident lifecycle, and private scheduled product reports.

## P0 — invited curator pilot

- Replace prototype records with rights-cleared curator/artist/work data. Record seller authority, media permission, edition/supply, display location, pricing, and fulfillment owner before publish.
- Choose the public domain and publish owner-approved privacy, terms, data-deletion, copyright/takedown, seller, refund, and physical-fulfillment policies.
- Create provider-owned Instagram and X apps; pass consent, cancellation, revocation, deletion, avatar/name/handle import, and least-scope tests before enabling either flag.
- Add a separate preview Supabase project with synthetic data. Never point pull-request deployments at production writes.
- Add hosted error monitoring with source maps and secret scrubbing; alert on health failure, elevated function errors, database exhaustion, OAuth failure, and retention-job failure.
- Enable Supabase backups/PITR appropriate to the paid plan, document a restore drill, and name an incident/data-request owner.
- Wire Discover → Save → Sponsor → Review to the database and add a minimal internal editorial queue with rights/status gates and audit history.
- Turn on GitHub required reviews and required `CI` checks for `main`; keep deployment credentials in protected Vercel environments. Decide a license before accepting outside contributions.

## P1 — real marketplace and bazaar

- Build one audited crypto acquisition path and one hosted card checkout. Require signed webhooks, idempotency keys, server-authoritative prices, chain/network validation, inventory or edition locks, and reconciliation.
- Model reservations, expiration, refunds, chargebacks, fulfillment, provenance, mint state, and physical/digital pairing without letting button clicks imply ownership or revenue.
- Add an operator console for publishing, rights review, takedowns, catalog/media repair, inventory, acquisition reconciliation, refunds, and account deletion.
- Move media to managed storage with malware/type checks, transformations, immutable originals, alt text, rights metadata, and a replacement/retention policy.
- Add invite/sponsorship provenance, curator notifications, artist acceptance, seller onboarding, and role separation for curator, artist/seller, editor, finance, and administrator.
- Add bazaar RSVP, capacity, exhibitor roster, QR work links, check-in, accessibility details, calendar updates, and post-event reconciliation.
- Create the Instagram chat intake only through approved platform APIs and explicit user action. Store the submitted link as a private draft; retrieve only permitted fields; provide delete/revoke controls; never scrape.
- Run accessibility, keyboard, reduced-motion, image-weight, Core Web Vitals, failure-state, and low-bandwidth audits against a representative catalog.

## P2 — growth and intelligence

- Curator cohorts: first save/sponsor/review within 1/7/30 days, weekly active curators, time to first sponsorship, repeat sponsorship, editorial acceptance, and cohort retention. Use authenticated curator IDs only; do not create cross-session anonymous identities.
- Marketplace quality: work-detail and acquisition-intent rates by format, curator, price band, exhibition, acquisition method, and traffic campaign; search/filter demand; zero-result searches; saves and return-to-work behavior.
- Trust and operations: rights-clearance time, incomplete provenance, contract verification, support/takedown resolution, fulfillment time, refund/chargeback rate, webhook retry depth, and inventory/supply incidents.
- Bazaar: RSVP-to-check-in, QR-to-work, calendar-to-attendance, exhibitor conversion, attributed reconciled purchases/mints, repeat attendance, and curator/artist participation.
- Recommendations and search only after enough consented first-party signal exists. Prefer editorial context and transparent controls over opaque behavioral ranking.
- Add a small operator dashboard on top of the protected metrics API, scheduled weekly summaries, anomaly alerts, and documented experiment guardrails. Never expose small curator cohorts publicly.

## Reliability targets

- Public read availability: 99.9% monthly; authenticated curator writes: 99.5% during the pilot.
- Zero leaked credentials, false payment/mint confirmations, duplicate token supply, or double-sold physical inventory.
- Health alert acknowledged within 15 minutes during a live bazaar; SEV-1 acquisition paths disabled immediately.
- Every deploy is reproducible from a reviewed commit, every schema change is forward-migrated, and every production integration has a kill switch.

## Owner decisions

1. Public/custom domain and legal/policy owner.
2. Open-source license and whether the GitHub repository should be renamed from `school-website` to `grove-marketplace`.
3. Instagram/X app-owning organizations, legal contact, and review metadata.
4. Crypto chain/contract model, card provider, seller-of-record, custody, tax, and refund model.
5. Pilot curator cohort, editorial approver, launch catalog, and first bazaar date/capacity.
6. Monitoring provider, on-call owner, backup/PITR tier, and acceptable retention windows.
