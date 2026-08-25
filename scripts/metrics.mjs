import { execFileSync } from "node:child_process";

const daysArgument = process.argv.find((argument) => argument.startsWith("--days="));
const days = Number(daysArgument?.split("=")[1] || 30);
if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("Use --days=1 through --days=90.");

const siteUrl = String(process.env.GROVE_SITE_URL || "").replace(/\/$/, "");
const token = process.env.GROVE_METRICS_READ_TOKEN || (() => {
  if (process.platform !== "darwin") return "";
  for (const service of ["Marketplace & Auction House of Brooklyn", "Grove Marketplace", "Marketplace & Auction House"]) {
    try {
      return execFileSync("security", ["find-generic-password", "-s", service, "-a", "metrics-read-token", "-w"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim();
    } catch {
      // Continue through the legacy service name during the identity migration.
    }
  }
  return "";
})();
if (!siteUrl || !token) {
  throw new Error("Set GROVE_SITE_URL and provide GROVE_METRICS_READ_TOKEN via the environment or the Marketplace & Auction House of Brooklyn macOS Keychain entry.");
}

const response = await fetch(`${siteUrl}/api/metrics?days=${days}`, {
  headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
});
const body = await response.json();
if (!response.ok) throw new Error(body?.error?.message || `Metrics request failed with ${response.status}.`);

const events = body.events || {};
const percentage = (numerator, denominator) => {
  const total = Number(denominator || 0);
  return total > 0 ? `${((Number(numerator || 0) / total) * 100).toFixed(1)}%` : "—";
};
const routeViews = Object.fromEntries((body.top_routes || []).map((item) => [item.route, Number(item.views)]));

console.log(`Marketplace & Auction House of Brooklyn product metrics · ${body.range_days} days`);
console.table({
  events: Number(body.totals?.events || 0),
  sessions: Number(body.totals?.sessions || 0),
  signed_in_curators: Number(body.totals?.signed_in_curators || 0),
  engaged_sessions: Number(body.engagement?.engaged_sessions || 0),
  high_intent_sessions: Number(body.engagement?.high_intent_sessions || 0),
  error_sessions: Number(body.engagement?.error_sessions || 0),
  average_events_per_session: Number(body.engagement?.average_events_per_session || 0)
});
const funnels = body.funnels || {};
console.log("Curator funnel");
console.table(funnels.curator || {});
console.log("Member funnel");
console.table(funnels.membership || {});
console.log("Collection funnel");
console.table(funnels.collection || {});
console.log("Bazaar funnel");
console.table(funnels.bazaar || {});
console.log("Conversion signals");
console.table({
  discovery_to_sponsor: percentage(funnels.curator?.sponsor_sessions, funnels.curator?.discover_sessions || routeViews.discover),
  work_to_acquisition_preview: percentage(funnels.collection?.preview_sessions, funnels.collection?.work_sessions || events.work_viewed),
  join_start_rate: percentage(funnels.membership?.start_sessions, funnels.membership?.join_sessions || routeViews.join),
  join_completion_rate: percentage(funnels.membership?.complete_sessions, funnels.membership?.start_sessions || events.join_started),
  bazaar_calendar_rate: percentage(funnels.bazaar?.calendar_sessions, funnels.bazaar?.view_sessions || events.bazaar_viewed)
});
console.log("Events");
console.table(events);
console.log("Top works");
console.table(body.top_works || []);
console.log("Top routes");
console.table(body.top_routes || []);
console.log("Daily");
console.table(body.daily || []);
for (const [name, rows] of Object.entries(body.breakdowns || {})) {
  console.log(name.replaceAll("_", " "));
  console.table(rows);
}
console.log("Operational state");
console.table(Object.entries(body.operations || {}).flatMap(([area, states]) => {
  const entries = Object.entries(states || {});
  return entries.length ? entries.map(([state, count]) => ({ area, state, count: Number(count) })) : [{ area, state: "none", count: 0 }];
}));
