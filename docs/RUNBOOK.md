# Operations runbook

## First response

1. Check `https://the-school-omega.vercel.app/api/health`.
2. Inspect the active deployment and aliases: `vercel inspect https://the-school-omega.vercel.app`.
3. Read production errors: `vercel logs --environment production --level error --since 1h --no-branch`.
4. Confirm variable names and scopes with `vercel env ls`; never print values into chat, issues, or CI.
5. Check Supabase project health, migration history, and schema lint.

The hourly `Production health` workflow runs `npm run live:check`. A failure opens or updates one `ops:incident` issue; a clean recovery run closes it. Use the workflow run as the first shared evidence record.

Severity guide:

- **SEV-1:** credential exposure, unauthorized private data, false payment/mint/ownership, duplicate supply, or double-sold physical inventory. Disable the affected flag/path immediately and preserve evidence.
- **SEV-2:** sign-in, curator writes, catalog, or acquisition state unavailable for many users. Fail closed and communicate the boundary.
- **SEV-3:** degraded images, isolated browser bug, inaccurate aggregate telemetry, or non-blocking bazaar issue.

## Deploy

### Staging

```sh
vercel target ls
vercel pull --yes --environment=staging
npm run deploy:staging
npm run staging:check
```

The deployment guard requires a clean `codex/live-marketplace` working tree. The deploy script checks the immutable candidate with authenticated `vercel curl` before moving the stable staging alias; the separate staging check then verifies that alias. Also verify function logs, synthetic Supabase data, and Sepolia receipts. Vercel does not schedule custom-environment cron jobs; use only a separately authenticated staging scheduler. The staging-health GitHub schedule becomes active only after its workflow is present on the repository default branch.

For secondary-sale staging, set the repository secret `GROVE_STAGING_CRON_SECRET` to the same independently generated value as staging's `CRON_SECRET`. The `staging-resale-index` workflow always calls `/api/cron/resale-index`; it never receives a Supabase key, RPC URL, wallet key, or OpenSea credential. Keep the repository variable `GROVE_STAGING_SPONSOR_RECONCILE_ENABLED` absent or `false` while `sponsorExecutionReady` is false. Only after the reviewed Sepolia UserOperation E2E and code attestation may an operator set that variable to `true`, which adds the authenticated `/api/cron/sponsorship-reconcile` call on the same five-minute schedule. A `submission-pending` result is durable outbox evidence, not chain finality; use the receipt endpoint or reconciler result and canonical finalized EntryPoint event before reporting completion.

Owner exit uses that same reconciler but has an independent submission switch,
`GROVE_OWNER_EXIT_ENABLED`. Disable it to stop new transfer preparations while
leaving sponsorship and ownership reconciliation running. Do not disable the
reconciler for already submitted exits. An exit is complete only after finalized
EntryPoint success, the exact ERC-721 Transfer event, and the ownership indexer;
see `docs/OWNER_EXIT.md` for release gates and incident invariants.

### Production candidate

```sh
git submodule update --init --recursive
npm ci
npm run ci
vercel pull --yes --environment=production
GROVE_PRODUCTION_APPROVED_SHA="$(git rev-parse HEAD)" npm run deploy:production:candidate
```

The deployment guard requires a clean, version-tagged `main` commit and an exact approved SHA. The candidate uses Production variables but `--skip-domain`, so it does not receive public Production traffic. Run `npm run production:check` against the candidate through the protected-deployment tooling, then promote that exact deployment deliberately.

After deployment, verify home, `/api/health`, `/api/config`, `/api/catalog`, rejected email auth, disabled providers, security headers, and Vercel error logs. Check the live page visually on desktop and phone.
Also fetch a known local asset through `/_vercel/image` with an allowed width/quality
and AVIF/WebP `Accept` header. `GET /api/market-stats` must be `ready`, `syncing`,
or deliberately `disabled`; only `ready` may contain public figures.

After promotion, run `npm run production:check` against the stable alias. Do not announce a release until this passes.

## Roll back

- Code/runtime: inspect recent deployments, then promote the last known-good deployment from Vercel. Verify the stable alias and health route.
- Feature integration: set the affected `GROVE_*_ENABLED` flag false and redeploy. Disabled is the safe state.
- Database: prefer a forward corrective migration. Never delete a production project or rewrite applied migration history. Destructive data rollback requires a scoped backup/restore decision.

## Database change

```sh
supabase db push --dry-run --linked
supabase db push --linked --yes
supabase migration list --linked
supabase db lint --linked --level warning
```

Confirm RLS, grants, indexes, retention, and least-privilege access before deployment. Metrics data is writable only through server-side RPCs using the secret key.

## Metrics

- Public event ingestion: `POST /api/events`; same-origin, allowlisted, capped, and rate-limited.
- Operator summary: `npm run metrics -- --days=30` after pulling production variables.
- Retention: Vercel Cron calls `/api/cron/metrics-retention` daily with `CRON_SECRET` and deletes events older than 180 days.
- If ingestion is abused or inaccurate, set `GROVE_METRICS_ENABLED=false`, redeploy, and preserve the raw table for scoped review. Never infer sales from acquisition-preview events.

## Rotate a server secret

1. Create the replacement in the provider.
2. Update the narrowly scoped Vercel environment through stdin or the dashboard; do not put the value in shell history.
3. Re-pull ignored local variables if necessary, build, deploy, and verify.
4. Revoke the old credential only after the new deployment is healthy.
5. If exposure is suspected, rotate first, then investigate logs and affected data.

## Provider outage

- Turn off the matching Instagram/X flag. The UI will show **Not configured** and no OAuth attempt will be made.
- Do not substitute password collection, scraping, or a different identity provider.
- Verify cancel, failure, callback, profile initialization, sign-out, revocation, and deletion before re-enabling.

Instagram OAuth and Instagram bot intake have independent switches. During a bot
incident, set `GROVE_INSTAGRAM_BOT_ENABLED=false` without disabling sign-in,
preserve the private inbox, and rotate the app secret if signature integrity is
in doubt. Never replay an event by copying its raw message into logs or chat.

## Media or index-quality incident

- Remove the affected media record from `published` while preserving its content
  hash and rights evidence. Never replace immutable NFT/IPFS metadata in place.
- Do not expand the optimizer host/path allowlist to work around a failed import.
- Keep `GROVE_SECONDARY_ENABLED=false` if new activity must stop, but keep the
  finalized ownership reconciler running for existing orders and owner exits.
- A stale/incomplete stats snapshot must return `syncing` with no figures. Check
  the latest `indexer_worker_runs`, checkpoint continuity, registered/projected
  token coverage, and the external staging scheduler before restoring `ready`.

## Acquisition incident

- Keep `GROVE_ACQUISITION_ENABLED=false`, `GROVE_WALLET_ENABLED=false`, and `GROVE_AUCTIONS_ENABLED=false` until their independent gates pass.
- For an auction incident, stop new payment setup, bids, closes, charges, sponsorship, and NFT release while leaving signed-event and chain reconciliation active.
- Never invent confirmations, signatures, hashes, ownership, refunds, gas sponsorship, or inventory state.
- Reconcile provider, chain, database, and physical inventory records before resuming.

Use the dedicated [auction commerce runbook](COMMERCE_RUNBOOK.md) for close, Apple Pay/card, paymaster, Safe, reorg, and post-mint dispute response.

## Secondary-sale incident

- Set `GROVE_SECONDARY_ENABLED=false` to stop new listing and fulfillment contexts; keep ownership, fill, cancellation, and reorg reconciliation running against already signed orders.
- A disabled UI does not cancel a Seaport order. Sponsor only the exact order cancellation or counter increment after verifying the seller Safe and current counter.
- Pause OpenSea publication independently with `GROVE_OPENSEA_ENABLED=false`. Never treat a successful OpenSea response as a fill or NFT ownership event.
- Reconcile the canonical Seaport status, ERC-721 owner, exact approval, USDC transfers, receipt, block hash, and finality before resolving an incident.

## Data or rights request

- Authenticate the requester and identify the exact private/public records in scope.
- Preserve legally required sale/provenance records only under an approved policy; otherwise delete the Supabase Auth user and verify cascaded curator data removal.
- A rights or takedown request pauses publication while ownership, media permission, edition, contract, and fulfillment records are reviewed.
