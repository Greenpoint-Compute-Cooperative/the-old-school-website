import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFile(join(root, path), "utf8");
const required = [
  ".editorconfig",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/dependabot.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/product-metrics.yml",
  ".github/workflows/release.yml",
  ".github/workflows/staging-health.yml",
  ".github/workflows/staging-resale-index.yml",
  ".github/workflows/uptime.yml",
  "CONTRIBUTING.md",
  "LICENSE",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "docs/ENVIRONMENTS.md",
  "docs/METRICS.md",
  "docs/OWNER_EXIT.md",
  "docs/RUNBOOK.md",
  "docs/SECONDARY_MARKET.md",
  "third_party_licenses/opensea-seaport-js.LICENSE",
  "third_party_licenses/permissionless.LICENSE",
  "third_party_licenses/README.md"
];

await Promise.all(required.map(async (path) => assert.ok((await read(path)).trim(), `${path} is required`)));

const [environment, vercel, analytics, metricsMigration, uptime, stagingUptime, stagingResaleIndex, metricsWorkflow, releaseWorkflow, ciWorkflow, previewSeed, sepoliaAuctionSeed, environments, stagingCheck, stagingDeploy, productionCheck, resaleMigration, ownerExitMigration, resaleApi, openSeaLeaseMigration, openSeaWorker, secondaryDocs, ownerExitDocs] = await Promise.all([
  read(".env.example"),
  read("vercel.json"),
  read("analytics.js"),
  read("supabase/migrations/20260824010000_product_observability.sql"),
  read(".github/workflows/uptime.yml"),
  read(".github/workflows/staging-health.yml"),
  read(".github/workflows/staging-resale-index.yml"),
  read(".github/workflows/product-metrics.yml"),
  read(".github/workflows/release.yml"),
  read(".github/workflows/ci.yml"),
  read("scripts/seed-preview.mjs"),
  read("scripts/seed-sepolia-auction.mjs"),
  read("docs/ENVIRONMENTS.md"),
  read("scripts/check-staging.mjs"),
  read("scripts/deploy-staging.mjs"),
  read("scripts/check-live.mjs"),
  read("supabase/migrations/20260908000000_secondary_market.sql"),
  read("supabase/migrations/20260910000000_owner_exit_sponsorship.sql"),
  read("api/resales.js"),
  read("supabase/migrations/20260908020000_opensea_publication_leases.sql"),
  read("api/cron/opensea-publish.js"),
  read("docs/SECONDARY_MARKET.md"),
  read("docs/OWNER_EXIT.md")
]);

for (const name of ["SUPABASE_SECRET_KEY", "GROVE_METRICS_ENABLED", "GROVE_METRICS_READ_TOKEN", "CRON_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
  assert.match(environment, new RegExp(`^${name}=`, "m"), `${name} is documented`);
}
for (const name of ["GROVE_SECONDARY_ENABLED", "GROVE_SEAPORT_ADDRESS", "GROVE_SEAPORT_CODE_HASH", "GROVE_USDC_ADDRESS", "GROVE_USDC_CODE_HASH", "GROVE_OPENSEA_ENABLED", "OPENSEA_API_KEY"]) {
  assert.match(environment, new RegExp(`^${name}=`, "m"), `${name} is documented`);
}
assert.match(environment, /^GROVE_OWNER_EXIT_ENABLED=false$/m, "owner exit is documented fail-closed");
assert.match(vercel, /Content-Security-Policy/, "CSP is configured");
assert.match(vercel, /metrics-retention/, "metrics retention is scheduled");
assert.match(vercel, /auction-close/, "auction close is scheduled");
assert.match(vercel, /auction-settle/, "auction settlement is scheduled");
assert.match(vercel, /opensea-publish/, "OpenSea publication outbox is scheduled");
assert.match(vercel, /resale-index/, "secondary ownership reconciliation is scheduled");
assert.match(openSeaLeaseMigration, /for update skip locked/i, "OpenSea outbox claims are concurrency-safe");
assert.match(openSeaLeaseMigration, /lease_expires_at/, "OpenSea outbox claims recover after a bounded lease");
assert.match(openSeaWorker, /verifyPublishableResaleOrder/, "OpenSea orders are revalidated immediately before publication");
assert.match(openSeaWorker, /claim_opensea_publications/, "OpenSea workers atomically claim queue rows");
assert.match(analytics, /sessionStorage/, "analytics is session-scoped");
assert.doesNotMatch(analytics, /localStorage|fingerprint|document\.cookie/, "analytics avoids persistent browser identity");
assert.match(metricsMigration, /enable row level security/, "metrics data has RLS");
assert.match(metricsMigration, /revoke all on public\.product_events/, "metrics data is not public");
assert.match(uptime, /scripts\/check-live\.mjs/, "live monitoring uses the full-story check");
assert.match(uptime, /ops:incident/, "live monitoring manages one incident label");
assert.match(stagingUptime, /npm run staging:check/, "staging monitoring uses the isolated environment check");
assert.match(stagingResaleIndex, /api\/cron\/resale-index/, "staging has an external ownership-index schedule");
assert.match(metricsWorkflow, /secrets\.GROVE_METRICS_READ_TOKEN/, "scheduled metrics use a GitHub secret");
assert.match(releaseWorkflow, /SHA256SUMS\.txt/, "tagged releases include a checksum");
for (const workflow of [uptime, stagingUptime, stagingResaleIndex, metricsWorkflow, releaseWorkflow, ciWorkflow]) {
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@(v\d+|main|master)\b/, "GitHub Actions are pinned to immutable commits");
}
assert.match(previewSeed, /GROVE_SEED_TARGET/, "preview seeding requires an explicit target");
assert.match(previewSeed, /VERCEL_TARGET_ENV/, "preview seeding refuses the Production target as well as runtime");
assert.match(previewSeed, /assert\.notEqual\(process\.env\.VERCEL_ENV, "production"/, "preview seeding refuses production");
assert.match(sepoliaAuctionSeed, /getTransactionReceipt/, "Sepolia auction seeding verifies chain receipts");
assert.match(sepoliaAuctionSeed, /blockTag: "finalized"/, "Sepolia auction seeding requires finality");
assert.match(sepoliaAuctionSeed, /verifyFinalizedInventoryCustody/, "Sepolia auction seeding verifies inventory custody");
assert.doesNotMatch(sepoliaAuctionSeed, /privateKey|SECRET_KEY\s*=/i, "Sepolia auction seed contains no signing key material");
assert.match(environments, /nlvxepkzrctbjafcgffk/, "the isolated preview project is documented");
assert.match(environments, /xscysuvqragqwhxuhivv/, "the isolated production project is documented");
assert.match(environments, /VERCEL_TARGET_ENV/, "the custom staging target authority is documented");
assert.match(stagingCheck, /runtime\?\.environment, "staging"/, "the staging check rejects a non-staging alias");
assert.match(stagingDeploy, /vercel.*curl[\s\S]*vercel.*alias/s, "staging is verified before its stable alias moves");
assert.match(stagingDeploy, /ownerExit\?\.configured, false/, "staging promotion verifies owner exit is fail-closed");
assert.match(productionCheck, /runtime\?\.environment, "production"/, "the production check rejects a non-production alias");
assert.match(resaleMigration, /create table public\.resale_orders/, "secondary orders have a durable ledger");
assert.match(resaleMigration, /create table public\.resale_order_publications/, "OpenSea publication uses a durable outbox");
assert.match(resaleMigration, /create table public\.chain_event_inbox/, "secondary settlement has an append-only event inbox");
assert.match(resaleMigration, /create view public\.public_resale_orders/, "buyers receive independently verifiable Seaport data");
assert.match(resaleApi, /verifyPublishableResaleOrder/, "resale publication verifies chain state and ERC-1271 authorization");
assert.match(openSeaWorker, /productionDeployment/, "OpenSea publication refuses non-production targets");
assert.match(secondaryDocs, /July 23, 2025/, "secondary docs record the OpenSea testnet shutdown date");
assert.match(ownerExitMigration, /reject_resale_listing_during_owner_exit/, "owner exit and resale listing publication are serialized");
assert.match(ownerExitMigration, /sponsorship_active_token_action_duplicate/, "owner-exit migration preflights active token locks");
assert.match(ownerExitDocs, /The School must not custody/, "owner exit documents the noncustodial boundary");

console.log(`Repository checks passed: ${required.length} contributor and operations files.`);
