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
  assert.equal(response.status, expectedStatus, `${path} returned ${response.status}; expected ${expectedStatus}`);
  checks.push({ path, status: response.status, duration_ms: durationMs });
  return response;
};

const home = await fetchChecked("/");
const homeText = await home.text();
assert.match(homeText, /Marketplace &amp; Auction House of Brooklyn New York/);
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
assert.equal(health.database, "reachable");
assert.equal(health.metrics?.configured, true);

const configuration = await (await fetchChecked("/api/config")).json();
assert.equal(configuration.backend?.configured, true);
assert.equal(configuration.providers?.instagram?.configured, false);
assert.equal(configuration.providers?.x?.configured, false);
assert.equal(configuration.acquisition?.configured, false);

await fetchChecked("/api/catalog");
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
