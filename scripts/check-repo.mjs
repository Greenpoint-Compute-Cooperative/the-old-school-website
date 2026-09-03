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
  ".github/workflows/uptime.yml",
  "CONTRIBUTING.md",
  "LICENSE",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "docs/ENVIRONMENTS.md",
  "docs/METRICS.md",
  "docs/RUNBOOK.md"
];

await Promise.all(required.map(async (path) => assert.ok((await read(path)).trim(), `${path} is required`)));

const [environment, vercel, analytics, metricsMigration, uptime, metricsWorkflow, releaseWorkflow, ciWorkflow, previewSeed, environments] = await Promise.all([
  read(".env.example"),
  read("vercel.json"),
  read("analytics.js"),
  read("supabase/migrations/20260824010000_product_observability.sql"),
  read(".github/workflows/uptime.yml"),
  read(".github/workflows/product-metrics.yml"),
  read(".github/workflows/release.yml"),
  read(".github/workflows/ci.yml"),
  read("scripts/seed-preview.mjs"),
  read("docs/ENVIRONMENTS.md")
]);

for (const name of ["SUPABASE_SECRET_KEY", "GROVE_METRICS_ENABLED", "GROVE_METRICS_READ_TOKEN", "CRON_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
  assert.match(environment, new RegExp(`^${name}=`, "m"), `${name} is documented`);
}
assert.match(vercel, /Content-Security-Policy/, "CSP is configured");
assert.match(vercel, /metrics-retention/, "metrics retention is scheduled");
assert.match(analytics, /sessionStorage/, "analytics is session-scoped");
assert.doesNotMatch(analytics, /localStorage|fingerprint|document\.cookie/, "analytics avoids persistent browser identity");
assert.match(metricsMigration, /enable row level security/, "metrics data has RLS");
assert.match(metricsMigration, /revoke all on public\.product_events/, "metrics data is not public");
assert.match(uptime, /scripts\/check-live\.mjs/, "live monitoring uses the full-story check");
assert.match(uptime, /ops:incident/, "live monitoring manages one incident label");
assert.match(metricsWorkflow, /secrets\.GROVE_METRICS_READ_TOKEN/, "scheduled metrics use a GitHub secret");
assert.match(releaseWorkflow, /SHA256SUMS\.txt/, "tagged releases include a checksum");
for (const workflow of [uptime, metricsWorkflow, releaseWorkflow, ciWorkflow]) {
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@(v\d+|main|master)\b/, "GitHub Actions are pinned to immutable commits");
}
assert.match(previewSeed, /GROVE_SEED_TARGET/, "preview seeding requires an explicit target");
assert.match(previewSeed, /assert\.notEqual\(process\.env\.VERCEL_ENV, "production"/, "preview seeding refuses production");
assert.match(environments, /nlvxepkzrctbjafcgffk/, "the isolated preview project is documented");

console.log(`Repository checks passed: ${required.length} contributor and operations files.`);
