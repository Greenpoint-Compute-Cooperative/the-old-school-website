import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const target = process.argv[2];
assert.ok(["staging", "production"].includes(target), "Choose staging or production.");

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const head = git("rev-parse", "HEAD");
const branch = git("branch", "--show-current");
const expectedBranch = target === "production" ? "main" : "codex/live-marketplace";

assert.equal(branch, expectedBranch, `${target} deploys must come from ${expectedBranch}; found ${branch || "detached HEAD"}.`);
assert.equal(git("status", "--porcelain"), "", `${target} deploys require a clean working tree.`);

if (target === "production") {
  const releaseTags = git("tag", "--points-at", "HEAD").split("\n").filter((tag) => /^v\d+\.\d+\.\d+(?:[-+].+)?$/.test(tag));
  assert.ok(releaseTags.length > 0, "Production candidates require a version tag on HEAD.");
  assert.equal(process.env.GROVE_PRODUCTION_APPROVED_SHA, head,
    "Set GROVE_PRODUCTION_APPROVED_SHA to the reviewed, staging-tested commit SHA.");
}

console.log(`Deployment guard passed for ${target}: ${head} (${branch}).`);
