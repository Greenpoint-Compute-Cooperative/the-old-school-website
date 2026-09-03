import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GET as getConfig } from "../api/config.js";
import { GET as getHealth } from "../api/health.js";
import { GET as startAuth } from "../api/auth/start.js";
import { POST as createAcquisition } from "../api/acquisitions.js";
import { effectiveDisputeEventType, POST as receiveStripeWebhook } from "../api/stripe/webhook.js";
import { POST as recordEvent } from "../api/events.js";
import { GET as getMetrics } from "../api/metrics.js";
import { buildCheckoutSessionParameters } from "../lib/server/commerce.js";

const envNames = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "GROVE_INSTAGRAM_OAUTH_ENABLED",
  "GROVE_X_OAUTH_ENABLED",
  "GROVE_ACQUISITION_ENABLED",
  "GROVE_SELLER_TERMS_VERSION",
  "GROVE_BUYER_TERMS_URL",
  "GROVE_BUYER_TERMS_VERSION",
  "GROVE_MAX_ITEM_PRICE_MINOR",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GROVE_STRIPE_AUTOMATIC_TAX",
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
assert.equal(config.acquisition.applePay.configured, false);

const invalidProvider = await startAuth(new Request("https://marketplace.example/api/auth/start?provider=email"));
assert.equal(invalidProvider.status, 400, "email is not accepted as a join path");

const unavailableProvider = await startAuth(new Request("https://marketplace.example/api/auth/start?provider=instagram"));
assert.equal(unavailableProvider.status, 503, "unconfigured OAuth cannot claim success");

const unavailableHealth = await getHealth(new Request("https://marketplace.example/api/health"));
assert.equal(unavailableHealth.status, 503, "health cannot claim a configured backend without credentials");

const acquisition = await createAcquisition();
assert.equal(acquisition.status, 503, "checkout stays disabled without a provider");
assert.match(JSON.stringify(await acquisition.json()), /No order was created/);

const checkoutParameters = buildCheckoutSessionParameters({
  acquisition_id: "00000000-0000-4000-8000-000000000001",
  work_id: "00000000-0000-4000-8000-000000000002",
  slug: "blue-hour-nassau",
  title: "Blue Hour, Nassau",
  artist_name: "A. Artist",
  format: "physical",
  amount_minor: 480000,
  currency: "USD",
  requires_shipping: true,
  stripe_tax_code: "txcd_99999999",
  stripe_shipping_rate_id: "shr_test_domestic",
  buyer_terms_version: "work-terms-v1",
  reservation_expires_at: new Date(Date.now() + 35 * 60_000).toISOString()
}, {
  siteUrl: "https://marketplace.example",
  commerce: { automaticTax: true }
});
assert.equal(checkoutParameters.mode, "payment");
assert.deepEqual(checkoutParameters.payment_method_types, ["card"]);
assert.equal(checkoutParameters.consent_collection.terms_of_service, "required");
assert.equal(checkoutParameters.automatic_tax.enabled, true);
assert.deepEqual(checkoutParameters.shipping_address_collection.allowed_countries, ["US"]);
assert.deepEqual(checkoutParameters.shipping_options, [{ shipping_rate: "shr_test_domestic" }]);
assert.match(checkoutParameters.success_url, /\{CHECKOUT_SESSION_ID\}/);
assert.equal(checkoutParameters.line_items[0].price_data.unit_amount, 480000);
assert.equal(checkoutParameters.line_items[0].price_data.product_data.tax_code, "txcd_99999999");
assert.equal(effectiveDisputeEventType("warning_needs_response"), "charge.dispute.created");
assert.equal(effectiveDisputeEventType("warning_closed"), "charge.dispute.closed");
assert.equal(effectiveDisputeEventType("prevented"), "charge.dispute.closed");
assert.equal(effectiveDisputeEventType("won"), "charge.dispute.closed");

const unavailableEvent = await recordEvent(new Request("https://marketplace.example/api/events", { method: "POST", body: "{}" }));
assert.equal(unavailableEvent.status, 503, "events fail closed without the server-only metrics boundary");

const unavailableMetrics = await getMetrics(new Request("https://marketplace.example/api/metrics"));
assert.equal(unavailableMetrics.status, 503, "operator metrics fail closed without server secrets");

Object.assign(process.env, {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
  GROVE_SITE_URL: "https://marketplace.example",
  GROVE_ACQUISITION_ENABLED: "true",
  GROVE_SELLER_TERMS_VERSION: "2026-09",
  GROVE_BUYER_TERMS_URL: "https://marketplace.example/terms",
  GROVE_BUYER_TERMS_VERSION: "2026-09",
  GROVE_MAX_ITEM_PRICE_MINOR: "1000000",
  GROVE_STRIPE_AUTOMATIC_TAX: "true",
  STRIPE_SECRET_KEY: "sk_test_placeholder",
  STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
  CRON_SECRET: "test-cron-secret-0000000000000000"
});
const configuredCheckout = await getConfig();
assert.equal((await configuredCheckout.json()).acquisition.applePay.configured, true, "Apple Pay readiness requires every commerce gate");

const crossOriginCheckout = await createAcquisition(new Request("https://marketplace.example/api/acquisitions", {
  method: "POST",
  headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
  body: JSON.stringify({ work_slug: "blue-hour-nassau", method: "card" })
}));
assert.equal(crossOriginCheckout.status, 403, "checkout creation rejects cross-origin reservation attempts");

delete process.env.GROVE_ACQUISITION_ENABLED;
assert.equal((await (await getConfig()).json()).acquisition.card.configured, false, "the kill switch stops new checkout");
const invalidWebhook = await receiveStripeWebhook(new Request("https://marketplace.example/api/stripe/webhook", {
  method: "POST",
  headers: { "Stripe-Signature": "invalid", "Content-Type": "application/json" },
  body: "{}"
}));
assert.equal(invalidWebhook.status, 400, "signed-event ingestion stays active behind the sales kill switch");

for (const name of [
  "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "GROVE_SITE_URL",
  "GROVE_ACQUISITION_ENABLED", "GROVE_SELLER_TERMS_VERSION", "GROVE_BUYER_TERMS_URL",
  "GROVE_BUYER_TERMS_VERSION", "GROVE_MAX_ITEM_PRICE_MINOR", "GROVE_STRIPE_AUTOMATIC_TAX",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"
]) delete process.env[name];

const migration = await readFile(new URL("../supabase/migrations/20260824000000_grove_marketplace_foundation.sql", import.meta.url), "utf8");
for (const table of ["curators", "discoveries", "sponsorships", "works", "bazaar_events", "acquisitions"]) {
  assert.match(migration, new RegExp(`create table public\\.${table}`), `${table} is represented in the schema`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS`);
}

const commerceMigration = await readFile(new URL("../supabase/migrations/20260903000000_live_commerce_foundation.sql", import.meta.url), "utf8");
for (const table of ["sellers", "rights_assertions", "provider_events", "payment_ledger_entries", "fulfillments", "commerce_outbox", "commerce_audit_log"]) {
  assert.match(commerceMigration, new RegExp(`create table public\\.${table}`), `${table} is represented in the commerce schema`);
  assert.match(commerceMigration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS`);
}
for (const boundary of ["reserve_card_checkout", "attach_card_checkout", "release_card_reservation", "apply_stripe_checkout_event", "apply_stripe_financial_event"]) {
  assert.match(commerceMigration, new RegExp(boundary), `${boundary} is defined transactionally`);
}
assert.match(commerceMigration, /auth\.users where id = buyer_uuid for update/, "buyer reservation limits are serialized");
assert.match(commerceMigration, /warning_closed/, "terminal dispute inquiries cannot remain stuck open");
assert.match(commerceMigration, /prevented/, "prevented disputes cannot remain stuck open");
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
