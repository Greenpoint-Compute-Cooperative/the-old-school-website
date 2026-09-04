import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const run = (command, args, options = {}) => execFileSync(command, args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  ...options
}).trim();

const deploymentOutput = run("vercel", ["deploy", "--target=staging", "--yes"]);
let deploymentUrl;
try {
  deploymentUrl = JSON.parse(deploymentOutput).deployment?.url;
} catch {
  deploymentUrl = deploymentOutput.split(/\s+/).find((item) => /^https:\/\/[^\s]+\.vercel\.app$/.test(item));
}
assert.ok(deploymentUrl, `Vercel did not return a staging deployment URL: ${deploymentOutput}`);

const health = JSON.parse(run("vercel", ["curl", "/api/health", "--deployment", deploymentUrl]));
assert.equal(health.status, "ok");
assert.equal(health.runtime?.environment, "staging", "The candidate was not built for the staging target.");
assert.equal(health.runtime?.platformEnvironment, "preview");
assert.equal(health.database, "reachable");
assert.equal(health.metrics?.configured, false, "Staging must not write production product metrics.");

const configuration = JSON.parse(run("vercel", ["curl", "/api/config", "--deployment", deploymentUrl]));
assert.equal(configuration.backend?.configured, true);

const catalog = JSON.parse(run("vercel", ["curl", "/api/catalog", "--deployment", deploymentUrl]));
assert.ok(Array.isArray(catalog.works) && catalog.works.length > 0, "Staging needs synthetic catalog records.");
for (const work of catalog.works) {
  assert.notEqual(work.chain, "ethereum-mainnet", `Staging work ${work.slug} points at mainnet.`);
  assert.match(`${work.title} ${work.description}`, /preview|rehearsal|synthetic/i,
    `Staging work ${work.slug} is not visibly synthetic.`);
}

run("vercel", ["alias", "set", deploymentUrl, "the-school-sepolia.vercel.app"]);
console.log(`Staging promoted: ${deploymentUrl} -> https://the-school-sepolia.vercel.app`);
