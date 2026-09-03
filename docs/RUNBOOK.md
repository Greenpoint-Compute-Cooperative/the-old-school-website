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

```sh
git submodule update --init --recursive
npm ci
npm run ci
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod --yes
```

After deployment, verify home, `/api/health`, `/api/config`, `/api/catalog`, rejected email auth, disabled providers, security headers, and Vercel error logs. Check the live page visually on desktop and phone.

Run `npm run live:check` against the stable alias. Do not tag a release until this passes.

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

## Acquisition incident

- Keep `GROVE_ACQUISITION_ENABLED=false` until wallet/card providers, signed webhooks, and authoritative inventory exist.
- For a future incident, stop new acquisitions first; do not invent confirmations, hashes, ownership, refunds, or inventory state.
- Reconcile provider, chain, database, and physical inventory records before resuming.

## Data or rights request

- Authenticate the requester and identify the exact private/public records in scope.
- Preserve legally required sale/provenance records only under an approved policy; otherwise delete the Supabase Auth user and verify cascaded curator data removal.
- A rights or takedown request pauses publication while ownership, media permission, edition, contract, and fulfillment records are reviewed.
