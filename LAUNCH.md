# Marketplace & Auction House of Brooklyn · launch plan

## Position

Marketplace & Auction House of Brooklyn is the curator-led market for physical work at 29 Nassau Avenue and born-digital work. A named curator sponsors every artist and piece. The monthly auditorium bazaar turns the catalog into a recurring in-person program.

The launch target represents every approved marketplace work by an NFT on Ethereum mainnet before its auction opens. Members join through social OAuth, control passkey-first Safe accounts, and pay no gas for the explicitly supported Grove actions. The first invited auction rail is offchain EIP-712 bidding with Stripe-hosted Apple Pay/card qualification and winner settlement. Crypto-only lots are a later, separate rail; v1 never mixes card and crypto bids in one auction.

## Launchable MVP

### Curator desk

- Join only through Instagram or X consent; initialize the curator’s granted display name, photo, and handle.
- Receive discoveries from direct links, studio visits, artist introductions, and the bazaar.
- Move discoveries through **New**, **Saved**, and **Sponsored** states.
- Turn a discovery or a pasted public link into an unlisted work draft.
- Require curator sponsorship before editorial review or publication.

The current interface labels the remaining boundaries honestly: links are not fetched, the bundled catalog is fictional, and no external discovery service is implied. The dedicated Supabase project, migration, redirect policy, Vercel API routes, and runtime values are configured. OAuth stays unavailable until dedicated provider apps, public policy/deletion URLs, and credentials are approved.

### Production foundation

- Vercel serves the static gallery and same-origin API routes.
- Supabase Auth runs PKCE consent/callbacks; provider secrets remain there, never in the browser.
- Postgres stores curators, private discoveries, sponsorships, public works, bazaars, and acquisition state behind row-level security.
- Only Instagram and X identities can initialize a curator profile. Email/password and anonymous signup are disabled.
- Checkout creation remains off until wallet/card providers, signed webhooks, and authoritative inventory are reviewed.

### Marketplace

- One art-led catalog for **physical**, **digital / NFT**, and **paired** work.
- Work pages with format, artist, sponsor, price, edition, medium, location, and network where relevant.
- NFT-first auctions with hosted Apple Pay/card qualification, signed offchain bids, and winner delivery to a member Safe.
- Curator profiles with the works they sponsor.

### NFT-connected acquisition

The production MVP uses Ethereum mainnet and audited, standard infrastructure:

- ERC-721 for one-of-one works and ERC-1155 for editions;
- read-only verification for existing tokens;
- source-verified immutable collections for new work, administered by a 2-of-3 Safe with a separate inventory Safe;
- durable media and metadata, explicit supply, rights, and preservation terms;
- authoritative transaction/indexer state before the UI claims a mint or ownership change.

The delivery branch now contains disabled-by-default auction/payment APIs, an EIP-712/ERC-1271 bid boundary, a signed Stripe event inbox, a row-locked auction ledger, and inventory-mint ERC-721/ERC-1155 contracts. Prototype works remain unsaleable and no provider, production address, paymaster, RPC, or real identity is invented. Wallet and auction paths stay disabled until their documented launch gates pass.

### Monthly bazaar

- One focused event page with date, schedule, featured works, and calendar export.
- QR/NFC links from installed physical work to its canonical listing.
- A projection salon for born-digital work.
- A staffed wallet/card desk that never handles seed phrases or private keys.
- Manual inventory fallback; pause minting if network or authoritative state is unavailable.

## Curator-first go-to-market

Recruit six founding curators before broad artist outreach: independent curators, artist-run-space organizers, educators, and digital-art specialists with distinct, trusted taste.

Each curator should:

- recommend two to four artists;
- sponsor an opening selection or room;
- confirm source/image rights, edition logic, price readiness, and presentation quality;
- host or program one bazaar moment.

Offer permanent sponsor attribution, a credited profile, early collector previews, and visible bazaar programming. Publish selection criteria and conflicts; rotate guest curators so the gate stays accountable.

Initial catalog target: 15 artists and 30 sale-ready works, including at least 10 born-digital and five paired works.

## Launch sequence

1. **Standards** — choose network, audited contract path, seller/payout model, token license, taxes, refunds, metadata storage, custody boundaries, and admin-key ownership.
2. **Identity** — create the dedicated Supabase project; review Instagram/X apps, scopes, consent, privacy, deletion, and retention; pass callback and revocation tests.
3. **Founding curators** — recruit six, agree selection criteria, and secure sponsorship for the seed catalog.
4. **Rights and records** — clear every media asset; record sponsor, format, price, supply/dimensions, rights, fulfillment/preservation, and provenance.
5. **Private preview** — run 12 moderated mobile sessions and 10 testnet transactions across mint, rejection, wrong-network, retry, edition, sold-out, and paired-hold cases.
6. **Operations rehearsal** — reconcile wallet, card, webhook, inventory, refund, delivery, and support states end to end.
7. **Bazaar launch** — open publicly with 10 exhibitors, 75 RSVPs, trained staff, and a canonical listing for every shown work.

Hard launch gates:

- no critical contract or security findings;
- zero duplicate mints, supply drift, or double-sold physical inventory in rehearsal;
- verified contract, chain, token identity, and metadata for every minted listing;
- explicit rights, fulfillment, and redemption language for every work;
- signed provider webhooks and one authoritative inventory/transaction ledger.

## Future: Instagram chat intake

A later, non-intrusive Instagram chat intake may let a curator send a link in a normal conversation and receive an unlisted marketplace draft. This is a convenience layer over the curator desk, not a surveillance or scraping system.

Required constraints:

- official Meta-approved APIs only; no scraping, private-page workarounds, or credential sharing;
- explicit curator invocation per link; the service does not watch ambient chats;
- retrieve only media and metadata the API permits from accessible public sources;
- minimal scopes, short retention, encryption, deletion/revocation controls, and an audit trail;
- no contact-graph harvesting, face analysis, ad targeting, model training, or reuse of conversation content;
- retain source URL and provenance; honor access removal and content deletion;
- keep every draft unlisted until curator review;
- require artist/rightsholder permission for media, metadata, sale, and minting before publication;
- platform-policy, privacy, security, abuse, and rights reviews before any pilot.

No bot, scraper, or chat integration is implemented in this repository.

## Phase two

Phase two adds controlled extensions:

- crypto-only lots through a pinned audited order protocol;
- creator-controlled contracts and richer edition mechanics;
- an independently audited onchain English-auction rail if demand justifies it;
- secondary-market aggregation without guaranteed-royalty claims;
- collector preservation/download tools;
- optional on-chain physical redemption with clear custody and recovery rules.

## Measures

- curator applications and acceptance quality;
- discoveries saved and sponsored;
- sponsor-to-published-work conversion;
- work-detail and acquisition-start rate by format;
- completed, reconciled sales/mints with zero supply or inventory incidents;
- repeat bazaar attendance and collector support resolution time.

## Prototype map

- `#home` — Marketplace & Auction House of Brooklyn identity, compact school mark, and one discovery action.
- `#discover` — discovery inbox, saved/sponsored states, and link-to-draft intake.
- `#sponsor` / `#join` — curator draft and configured/unconfigured Instagram/X consent boundary.
- `#market` / `#work/:slug` — mixed catalog and honest crypto/card preview.
- `#curators` / `#curator/:id` — sponsor exploration.
- `#bazaar` — monthly program and calendar export.

The hash-routed gallery and fail-closed server/database foundation build cleanly. Live identity, publishing, link retrieval, and transactions still require the documented provider credentials, missing workers, policy decisions, rehearsals, and reviews.
