# Environments

The marketplace separates public production data from pull-request and local-development writes. Project references are identifiers, not credentials; keys remain in Supabase, Vercel, GitHub Actions secrets, or the operator password manager.

| Surface | Vercel scope | Supabase project | Data | Metrics | Integrations |
|---|---|---|---|---|---|
| Production | Production | `xscysuvqragqwhxuhivv` · US East | Real, approved records only | Enabled; 180-day retention | Fail closed until approved |
| Pull requests | Preview | `nlvxepkzrctbjafcgffk` · US East | Synthetic records only | Disabled | Disabled |
| Local API work | Development | Same `nlvxepkzrctbjafcgffk` preview project | Synthetic records only | Disabled | Disabled |
| Static local UI | None | None | Bundled prototype catalog | Disabled | Disabled |

## Safe setup order

1. Link the Vercel project and pull the intended environment.
2. Confirm variable names and target scope; never print values.
3. Link Supabase to preview for normal development.
4. Dry-run and apply new migrations to preview, seed synthetic data, then run CI.
5. Apply the reviewed migration to production immediately before the production deployment.

```sh
vercel pull --yes --environment=preview
supabase migration list --linked
supabase db push --dry-run --linked
supabase db push --linked --yes
npm run ci
```

`npm run seed:preview` has three independent guards: `GROVE_SEED_TARGET=preview`, a URL/project-ref match, and a production-runtime refusal. It must be supplied a preview server key through the operator environment and never through source control.

The optional `npm run seed:sepolia-auction` path applies the same guards and creates exactly one card-settlement rehearsal lot. It additionally refuses to write until the supplied Sepolia deployment and mint receipts are successful and finalized, the collection runtime code hash matches, the token's registered work ID matches, and finalized ERC-721 ownership or ERC-1155 balance is held by the declared inventory Safe. The operator supplies the public chain evidence and auction window through the `GROVE_PREVIEW_NFT_*` and `GROVE_PREVIEW_AUCTION_*` variables listed in `.env.example`; reruns validate existing immutable identity instead of replacing it.

## Verification

- Preview: database health is reachable and the catalog returns only synthetic database records. Wallet and auction UI advertise readiness only when the full gated stack is configured on Sepolia; the seeded rehearsal still requires an active OAuth member with an already deployed, recovery-ready Safe whose discoverable passkey was created for the preview relying-party origin. A browser bid proves authentication, Safe/WebAuthn signing, ERC-1271 verification, and transactional bid acceptance. It does not prove account provisioning, winner charging, or NFT delivery.
- Production: `npm run live:check` walks the public page, security headers, database health, integration flags, catalog, manifest, robots, protected metrics, and cross-origin event rejection. Wallet and auction flags stay false until the master-plan gates pass.
- Monitoring: GitHub runs the production check hourly and maintains one `ops:incident` issue while unhealthy. A private weekly workflow produces the 7/30/90-day aggregate product report.

Never copy production rows into preview. Recreate representative states with synthetic records that are visibly labeled as preview data.
