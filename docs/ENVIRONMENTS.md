# Environments

The marketplace separates public Production from a persistent staging release target, ephemeral pull-request previews, and local development. Project references are identifiers, not credentials; keys remain in Supabase, Vercel, GitHub Actions secrets, or the operator password manager.

| Surface | Vercel target | Source | Supabase project | Chain/data | Integrations |
|---|---|---|---|---|---|
| Production | `production` | `main`, version tag, explicit approved SHA | `xscysuvqragqwhxuhivv` · US East | Mainnet/real records only after approval | Independent live credentials; currently fail closed |
| Staging | `staging` | `codex/live-marketplace` | `nlvxepkzrctbjafcgffk` · US East | Sepolia/synthetic records only | Staging-only credentials; incomplete rails fail closed |
| Pull requests | `preview` | Other non-production branches | `nlvxepkzrctbjafcgffk` · US East | Synthetic records only | Disabled unless explicitly branch-scoped |
| Local API work | `development` | Working tree | `nlvxepkzrctbjafcgffk` · US East | Synthetic records only | Disabled by default |
| Static local UI | None | Working tree | None | Bundled prototype catalog | Disabled |

The persistent aliases are:

- Staging: `https://the-school-sepolia.vercel.app`
- Production: `https://the-school-omega.vercel.app`

`VERCEL_TARGET_ENV` is the application authority for the custom staging target. `VERCEL_ENV=production` remains an independent, fail-safe Production signal; either value identifying Production blocks Sepolia rehearsal behavior.

## Safe setup order

1. Link the Vercel project and pull the intended environment.
2. Confirm variable names and target scope; never print values.
3. Link Supabase to preview for normal development.
4. Dry-run and apply new migrations to preview, seed synthetic data, then run CI.
5. Apply the reviewed migration to production immediately before the production deployment.

```sh
vercel target ls
vercel pull --yes --environment=staging
supabase migration list --linked
supabase db push --dry-run --linked
supabase db push --linked --yes
npm run ci
npm run deploy:staging
npm run staging:check
```

`npm run seed:preview` has four independent guards: `GROVE_SEED_TARGET=preview`, a URL/project-ref match, a Production-target refusal, and a Production-runtime refusal. It must be supplied a staging server key through the operator environment and never through source control.

The optional `npm run seed:sepolia-auction` path applies the same guards and creates exactly one card-settlement rehearsal lot. It additionally refuses to write until the supplied Sepolia deployment and mint receipts are successful and finalized, the collection runtime code hash matches, the token's registered work ID matches, and finalized ERC-721 ownership or ERC-1155 balance is held by the declared inventory Safe. The operator supplies the public chain evidence and auction window through the `GROVE_PREVIEW_NFT_*` and `GROVE_PREVIEW_AUCTION_*` variables listed in `.env.example`; reruns validate existing immutable identity instead of replacing it.

## Verification

- Staging: `npm run staging:check` requires the stable alias to report the `staging` target, the Preview-class Vercel runtime, a reachable database, disabled product metrics, security headers, and visibly synthetic/non-mainnet catalog data. Wallet, auction, and secondary-sale UI advertise readiness only when their full gated stacks are configured on Sepolia. A browser bid proves authentication, Safe/WebAuthn signing, ERC-1271 verification, and transactional bid acceptance. It does not prove account provisioning, winner charging, NFT delivery, or a secondary fill.
- Production: `npm run production:check` requires the stable alias to report `production`, then walks the public page, security headers, database health, integration flags, catalog, manifest, robots, protected metrics, and cross-origin event rejection. Wallet and auction flags stay false until the master-plan gates pass.

Staging and Production deployments are deliberately separate builds because server and build-time variables differ. A staging-tested commit may become a Production candidate only from clean, version-tagged `main` with `GROVE_PRODUCTION_APPROVED_SHA` equal to the exact commit. The candidate deploy uses `--skip-domain`; a separate operator promotion is required to move Production traffic. Vercel Cron remains Production-only, so staging auction workers require an external authenticated scheduler.

`npm run deploy:staging` verifies the protected, immutable staging candidate through `vercel curl` before moving `the-school-sepolia.vercel.app`, then `npm run staging:check` verifies the stable alias. The branch matcher will also create staging candidates after `codex/live-marketplace` exists on the connected remote, but a candidate does not become the stable staging release until the explicit alias step succeeds. Vercel Cron runs only against Production, so `.github/workflows/staging-resale-index.yml` always calls the authenticated staging ownership reconciler and can add the sponsorship reconciler only after its explicit provider-E2E repository variable is enabled. The workflow remains fail-closed until the repository secret `GROVE_STAGING_CRON_SECRET` matches staging's `CRON_SECRET`; a missing secret fails the run.
- Monitoring: GitHub runs the production check hourly and maintains one `ops:incident` issue while unhealthy. A private weekly workflow produces the 7/30/90-day aggregate product report.

Never copy production rows into preview. Recreate representative states with synthetic records that are visibly labeled as preview data.
