# Marketplace media, indexing, and Instagram research source

Audience: Grove product and engineering  
Date: 2026-09-04  
Decision: smallest production-shaped slice that can be exercised safely on Sepolia

## Scope and assumptions

This review covers responsive NFT media delivery, the need for a chain indexer, public aggregate statistics, and an eventual Instagram bot. It assumes Ethereum mainnet is the production chain, Sepolia is rehearsal only, Supabase remains the operational read-model store, Vercel remains the web/API runtime, and Grove initially indexes its own ERC-721 collection and its own Seaport orders rather than every marketplace.

## Executive answer

Ship Vercel's native image optimizer now, but allow only known local raster files and content-addressed objects in Grove's two Supabase Storage projects. Keep `ipfs://` URIs as canonical NFT metadata/media references and treat optimized HTTP derivatives as presentation data. Keep the existing finalized-block Ethereum/Seaport indexer rather than adding Ponder or a commercial indexer until collection or marketplace coverage expands. Publish statistics only from a fresh, complete indexer snapshot; return `syncing` instead of misleading zeroes when coverage is incomplete. Accept Instagram data only through Meta's signed webhook into a private, idempotent inbox, and leave the feature disabled until credentials, user pairing, rights review, and a worker exist.

## Evidence reconciliation

### Media delivery

Vercel exposes `/_vercel/image` for custom/static frameworks when an `images` configuration is present. Widths, qualities, local patterns, remote patterns, formats, and a minimum cache TTL are configurable; `domains` is required and can be empty when exact remote patterns carry the allowlist. The optimizer resizes, transcodes to negotiated modern formats, and caches transformed responses on Vercel's CDN. Vercel also recommends constraining widths, qualities, and patterns to control transformations and cost.

IPFS guidance distinguishes canonical, content-addressed `ipfs://` identifiers from provider-specific HTTP gateway URLs. Therefore token metadata should not point at a mutable Vercel or storage URL. A managed HTTP raster can be used for storefront performance so long as its source path is content-addressed and the canonical URI/hash remains stored separately.

### Indexing and aggregate statistics

Ethereum JSON-RPC defines a `finalized` block tag. ERC-721 ownership changes are evidenced by `Transfer` events, and Seaport exposes `OrderFulfilled`, `OrderCancelled`, and `CounterIncremented` events for order state. Those sources are sufficient for Grove's bounded launch catalog and its own listings.

The repository's indexer already leases work, validates runtime code, scans finalized blocks, checkpoints block hashes, stores append-only event evidence, projects ownership, and reconciles Grove Seaport orders. The important missing layer was a durable worker-run record plus an atomic, coverage-checked public snapshot. A generic third-party indexer would add operational surface without fixing data-definition errors. The public API must label its scope as Grove activity and must not claim collection-wide OpenSea volume.

### Instagram

Meta signs webhook event notifications with a SHA-256 signature in `X-Hub-Signature-256`, can batch up to 1,000 updates, and retries failed delivery for up to roughly 36 hours. That requires raw-body verification, durable deduplication, bounded normalization, and a quick acknowledgement. Instagram API access is for authorized professional accounts and its permissions are distinct from Grove's basic social sign-in.

An inbound message or post URL is provenance, not permission to reproduce or mint media. The safe adapter retains only an explicit command and normalized link, starts rights state as unverified, and never acquires wallet or payment authority. Provider media must pass through the same rights/moderation/content-addressing pipeline before publication.

## Limitations and release gates

- A complete media ingestion/derivative worker is not part of this slice. Until it lands, arbitrary remote artwork and OAuth avatars fail closed to local editorial art.
- Public statistics remain `syncing` until the finalized indexer has run through the chain head and its ownership projection covers every registered tracked token.
- The current order indexer measures Grove listings and fills, not every external OpenSea order or collection-wide sale.
- Instagram delivery remains disabled until separate staging/production Meta apps, verified credentials, explicit sender pairing, rights/moderation review, and the processing worker are implemented.
- Mainnet NFT metadata should not launch until canonical media and metadata use persisted `ipfs://` CIDs.

## Recommendation

Release the fail-closed Sepolia slice now. Next, build one media ingestion worker, activate the scheduled finalized-chain reconciliation after the branch reaches the default branch, and add the explicit Instagram sender-pairing/rights-review UI. Reconsider Ponder or Envio only when Grove needs arbitrary external collections or genuinely collection-wide multi-market data.

## Claim-to-source ledger

| Claim | Source | Publisher/update | URL | Confidence / notes |
| --- | --- | --- | --- | --- |
| Native Image Optimization supports explicit sizes, domains, patterns, qualities, formats, TTL, and SVG controls | Build Output Configuration | Vercel, accessed 2026-09-04 | https://vercel.com/docs/build-output-api/configuration | High; exact configuration contract |
| Optimized images are resized/transcoded/cached and sources are checked against patterns | Image Optimization with Vercel | Vercel, updated 2025-12-18 | https://vercel.com/docs/image-optimization | High |
| Finite TTL, formats, patterns, qualities, and sizes bound optimization usage | Managing Usage & Costs | Vercel, updated 2026-01-08 | https://vercel.com/docs/image-optimization/managing-image-optimization-costs | High |
| NFT metadata should use canonical `ipfs://` URIs and derive HTTP gateway URLs for presentation | Best Practices for Storing NFT Data using IPFS | IPFS Docs, accessed 2026-09-04 | https://docs.ipfs.tech/how-to/best-practices-for-nft-data/ | High |
| Supabase Storage uses RLS; service credentials bypass RLS and must remain server-side | Storage Access Control | Supabase, accessed 2026-09-04 | https://supabase.com/docs/guides/storage/security/access-control | High |
| Ethereum JSON-RPC supports the `finalized` block tag | JSON-RPC API | ethereum.org, accessed 2026-09-04 | https://ethereum.org/developers/docs/apis/json-rpc/ | High |
| ERC-721 transfers emit `Transfer` and `ownerOf` exposes current ownership | ERC721 API | OpenZeppelin, accessed 2026-09-04 | https://docs.openzeppelin.com/contracts/5.x/api/token/erc721 | High |
| Seaport exposes fulfillment, cancellation, and counter-increment events | Events and errors | OpenSea, accessed 2026-09-04 | https://docs.opensea.io/docs/seaport-events-and-errors | High |
| Meta signs notifications with SHA-256, batches up to 1,000 updates, and retries failures for roughly 36 hours | Instagram Platform Webhooks | Meta, accessed 2026-09-04 | https://developers.facebook.com/documentation/instagram-platform/webhooks | High; verified against current official page source |
| Instagram Login API targets Instagram professional accounts and uses separate permissions such as `instagram_business_basic` | Instagram API with Instagram Login | Meta, accessed 2026-09-04 | https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login | High; verified against current official page source |
