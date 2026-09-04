import assert from "node:assert/strict";

const siteUrl = String(process.env.GROVE_SITE_URL || "https://the-school-omega.vercel.app").replace(/\/$/, "");
const checks = [];

const fetchChecked = async (path, options = {}, expectedStatus = 200) => {
  const startedAt = performance.now();
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      "User-Agent": "brooklyn-marketplace-production-check/1.0",
      ...options.headers
    },
    signal: AbortSignal.timeout(8_000)
  });
  const durationMs = Math.round(performance.now() - startedAt);
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  assert.ok(expectedStatuses.includes(response.status),
    `${path} returned ${response.status}; expected ${expectedStatuses.join(" or ")}`);
  checks.push({ path, status: response.status, duration_ms: durationMs });
  return response;
};

const home = await fetchChecked("/");
const homeText = await home.text();
assert.match(homeText, /Marketplace &amp; Auction House of Brooklyn/);
assert.doesNotMatch(homeText, /Marketplace &amp; Auction House of Brooklyn New York/);
for (const header of [
  "content-security-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "permissions-policy",
  "referrer-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options"
]) assert.ok(home.headers.get(header), `Missing live security header: ${header}`);

const health = await (await fetchChecked("/api/health")).json();
assert.equal(health.status, "ok");
assert.equal(health.runtime?.environment, "production", "The production check must never validate a staging target.");
assert.equal(health.database, "reachable");
assert.equal(health.metrics?.configured, true);

const configuration = await (await fetchChecked("/api/config")).json();
assert.equal(configuration.backend?.configured, true);
assert.equal(configuration.providers?.instagram?.configured, false);
assert.equal(configuration.providers?.x?.configured, false);
assert.equal(configuration.acquisition?.configured, false);
assert.equal(configuration.wallet?.configured ?? false, false);
assert.equal(configuration.auctions?.configured ?? false, false);
assert.equal(configuration.secondary?.configured ?? false, false);
assert.equal(configuration.openSea?.configured ?? false, false);
if (Object.hasOwn(configuration.wallet || {}, "ownerExit")) {
  assert.equal(configuration.wallet.ownerExit?.configured, false, "Production owner exit must remain fail-closed.");
}

await fetchChecked("/api/catalog");
// During a staging-only rollout the active Production deployment legitimately
// predates this route. As soon as the route exists, its mainnet semantics are
// mandatory; an arbitrary non-200 response is never accepted.
const marketStatsResponse = await fetchChecked("/api/market-stats", {}, [200, 404]);
if (marketStatsResponse.status === 200) {
  const marketStats = await marketStatsResponse.json();
  assert.ok(["disabled", "ready", "syncing"].includes(marketStats.status));
  if (marketStats.status === "ready") assert.equal(marketStats.network, "ethereum-mainnet");
}
// Keep the monitor compatible with the still-active pre-secondary Production
// release during a staging-only rollout. Once Production exposes the capability
// object, the resale route becomes part of the required fail-closed contract.
if (Object.hasOwn(configuration, "secondary")) {
  const resales = await (await fetchChecked("/api/resales")).json();
  assert.deepEqual(resales.orders, [], "Production cannot expose secondary listings before mainnet activation.");
}
await fetchChecked("/manifest.webmanifest");
await fetchChecked("/robots.txt", { headers: { Accept: "text/plain" } });
await fetchChecked("/api/metrics", {}, 401);
await fetchChecked("/api/events", {
  method: "POST",
  headers: { Origin: "https://example.invalid", "Content-Type": "application/json" },
  body: JSON.stringify({ event_name: "page_view" })
}, 403);

console.table(checks);
console.log(`Live production checks passed for ${siteUrl}.`);
