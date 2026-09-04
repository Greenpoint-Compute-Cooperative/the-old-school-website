import assert from "node:assert/strict";

const siteUrl = String(process.env.GROVE_SITE_URL || "https://the-school-sepolia.vercel.app").replace(/\/$/, "");
const checks = [];

const fetchChecked = async (path, options = {}, expectedStatus = 200) => {
  const startedAt = performance.now();
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      "User-Agent": "brooklyn-marketplace-staging-check/1.0",
      ...options.headers
    },
    signal: AbortSignal.timeout(8_000)
  });
  checks.push({ path, status: response.status, duration_ms: Math.round(performance.now() - startedAt) });
  assert.equal(response.status, expectedStatus, `${path} returned ${response.status}; expected ${expectedStatus}`);
  return response;
};

const home = await fetchChecked("/");
const homeText = await home.text();
assert.match(homeText, /Marketplace &amp; Auction House of Brooklyn/);
for (const header of [
  "content-security-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "permissions-policy",
  "referrer-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options"
]) assert.ok(home.headers.get(header), `Missing staging security header: ${header}`);

const health = await (await fetchChecked("/api/health")).json();
assert.equal(health.status, "ok");
assert.equal(health.runtime?.environment, "staging", "The staging alias must resolve to the staging target.");
assert.equal(health.runtime?.platformEnvironment, "preview");
assert.equal(health.database, "reachable");
assert.equal(health.metrics?.configured, false, "Staging must not write production product metrics.");

const configuration = await (await fetchChecked("/api/config")).json();
assert.equal(configuration.backend?.configured, true);

const catalog = await (await fetchChecked("/api/catalog")).json();
assert.ok(Array.isArray(catalog.works) && catalog.works.length > 0, "Staging needs synthetic catalog records.");
for (const work of catalog.works) {
  assert.notEqual(work.chain, "ethereum-mainnet", `Staging work ${work.slug} points at mainnet.`);
  assert.match(`${work.title} ${work.description}`, /preview|rehearsal|synthetic/i,
    `Staging work ${work.slug} is not visibly synthetic.`);
}

const metricsResponse = await fetchChecked("/api/metrics", {}, 503);
assert.equal((await metricsResponse.json()).error?.code, "metrics_not_configured");
const eventsResponse = await fetchChecked("/api/events", {
  method: "POST",
  headers: { Origin: "https://example.invalid", "Content-Type": "application/json" },
  body: JSON.stringify({ event_name: "page_view" })
}, 503);
assert.equal((await eventsResponse.json()).error?.code, "metrics_not_configured");

console.table(checks);
console.log(`Staging checks passed for ${siteUrl}.`);
