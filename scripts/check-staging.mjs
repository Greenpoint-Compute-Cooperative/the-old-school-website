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
assert.equal(configuration.openSea?.availability, "unsupported-on-testnets", "Sepolia must not claim OpenSea availability.");
assert.equal(configuration.openSea?.configured, false, "OpenSea publication is mainnet-only.");
assert.equal(configuration.secondary?.applePay?.configured, false, "Apple Pay is not a secondary NFT rail.");
assert.equal(configuration.wallet?.ownerExit?.configured, false,
  "Owner exit must remain hidden until its independent Sepolia attestation is enabled.");

const resales = await (await fetchChecked("/api/resales")).json();
assert.ok(Array.isArray(resales.orders), "The staging resale read model must respond safely.");
assert.notEqual(resales.open_sea, "mainnet", "Sepolia resale must not claim OpenSea publication.");
assert.doesNotMatch(JSON.stringify(resales), /opensea\.io\/assets\/sepolia/i, "No retired OpenSea testnet URL may be published.");

const catalog = await (await fetchChecked("/api/catalog")).json();
assert.ok(Array.isArray(catalog.works) && catalog.works.length > 0, "Staging needs synthetic catalog records.");
for (const work of catalog.works) {
  assert.notEqual(work.chain, "ethereum-mainnet", `Staging work ${work.slug} points at mainnet.`);
  assert.match(`${work.title} ${work.description}`, /preview|rehearsal|synthetic/i,
    `Staging work ${work.slug} is not visibly synthetic.`);
}

const marketStats = await (await fetchChecked("/api/market-stats")).json();
assert.ok(["ready", "syncing"].includes(marketStats.status), "Staging stats must report readiness honestly.");
assert.equal(marketStats.network, "ethereum-sepolia");
if (marketStats.status !== "ready") assert.equal(marketStats.stats, null, "Incomplete stats must not publish zeros.");

const optimizedImage = await fetchChecked(
  "/_vercel/image?url=%2Fpublic%2Fassets%2Fdigital-works.jpg&w=640&q=75",
  { headers: { Accept: "image/avif,image/webp,image/*;q=0.8" } }
);
assert.match(optimizedImage.headers.get("content-type") || "", /^image\/(avif|webp)$/);
assert.ok((await optimizedImage.arrayBuffer()).byteLength < 350_000,
  "The 640px optimized marketplace image exceeds the mobile transfer budget.");

const instagramWebhook = await fetchChecked("/api/webhooks/instagram", {}, 503);
assert.equal((await instagramWebhook.json()).error?.code, "instagram_bot_not_configured",
  "The bot must stay fail closed without separately reviewed Meta credentials.");

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
