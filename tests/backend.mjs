import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GET as getConfig } from "../api/config.js";
import { GET as getHealth } from "../api/health.js";
import { GET as startAuth } from "../api/auth/start.js";
import { POST as createAcquisition } from "../api/acquisitions.js";
import { POST as recordEvent } from "../api/events.js";
import { GET as getMetrics } from "../api/metrics.js";

const envNames = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "GROVE_INSTAGRAM_OAUTH_ENABLED",
  "GROVE_X_OAUTH_ENABLED",
  "GROVE_ACQUISITION_ENABLED",
  "GROVE_METRICS_ENABLED",
  "GROVE_METRICS_READ_TOKEN",
  "CRON_SECRET"
];
const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
for (const name of envNames) delete process.env[name];

const configResponse = await getConfig();
assert.equal(configResponse.status, 200);
const config = await configResponse.json();
assert.deepEqual(config.profile.imported, ["display name", "profile photo", "handle"]);
assert.equal(config.providers.instagram.configured, false);
assert.equal(config.providers.x.configured, false);
assert.equal(config.metrics.configured, false);

const invalidProvider = await startAuth(new Request("https://grove.example/api/auth/start?provider=email"));
assert.equal(invalidProvider.status, 400, "email is not accepted as a join path");

const unavailableProvider = await startAuth(new Request("https://grove.example/api/auth/start?provider=instagram"));
assert.equal(unavailableProvider.status, 503, "unconfigured OAuth cannot claim success");

const unavailableHealth = await getHealth(new Request("https://grove.example/api/health"));
assert.equal(unavailableHealth.status, 503, "health cannot claim a configured backend without credentials");

const acquisition = await createAcquisition();
assert.equal(acquisition.status, 503, "checkout stays disabled without a provider");
assert.match(JSON.stringify(await acquisition.json()), /No order was created/);

const unavailableEvent = await recordEvent(new Request("https://grove.example/api/events", { method: "POST", body: "{}" }));
assert.equal(unavailableEvent.status, 503, "events fail closed without the server-only metrics boundary");

const unavailableMetrics = await getMetrics(new Request("https://grove.example/api/metrics"));
assert.equal(unavailableMetrics.status, 503, "operator metrics fail closed without server secrets");

const migration = await readFile(new URL("../supabase/migrations/20260824000000_grove_marketplace_foundation.sql", import.meta.url), "utf8");
for (const table of ["curators", "discoveries", "sponsorships", "works", "bazaar_events", "acquisitions"]) {
  assert.match(migration, new RegExp(`create table public\\.${table}`), `${table} is represented in the schema`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS`);
}
assert.match(migration, /initialize_curator_profile/);
assert.match(migration, /Email, phone, tokens, and credentials are deliberately not copied/);
assert.match(migration, /source_provider in \('instagram', 'x', 'web', 'direct'\)/);

const metricsMigration = await readFile(new URL("../supabase/migrations/20260824010000_product_observability.sql", import.meta.url), "utf8");
assert.match(metricsMigration, /create table public\.product_events/);
assert.match(metricsMigration, /alter table public\.product_events enable row level security/);
assert.match(metricsMigration, /revoke all on public\.product_events from anon, authenticated/);
assert.match(metricsMigration, /record_product_event/);
assert.match(metricsMigration, /product_metrics_summary/);
assert.match(metricsMigration, /prune_product_events/);

const dashboardMigration = await readFile(new URL("../supabase/migrations/20260824020000_metrics_dashboard.sql", import.meta.url), "utf8");
assert.match(dashboardMigration, /'funnels'/);
assert.match(dashboardMigration, /'breakdowns'/);
assert.match(dashboardMigration, /'operations'/);
assert.match(dashboardMigration, /security definer/);

for (const [name, value] of Object.entries(previous)) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

console.log("Backend boundary checks passed.");
