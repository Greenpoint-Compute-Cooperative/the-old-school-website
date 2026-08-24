import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bazaar, curators, discoveries, exhibitions, works } from "../catalog.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFile(join(root, path), "utf8");

const [html, css, app, analytics, launch, oauth, manifest] = await Promise.all([
  read("index.html"),
  read("styles.css"),
  read("app.js"),
  read("analytics.js"),
  read("LAUNCH.md"),
  read("docs/OAUTH_SETUP.md"),
  read("manifest.webmanifest")
]);

assert.match(html, /id="app"/, "application mount exists");
assert.match(html, /id="collect-dialog"/, "collection dialog exists");
assert.match(html, /href="styles\.css"/, "stylesheet is linked");
assert.match(html, /src="app\.js"/, "application module is linked");
assert.match(html, /rel="manifest"/, "install metadata is linked");
assert.match(html, /rel="canonical"/, "canonical production URL is declared");
assert.match(html, /Grove Marketplace/, "Grove identity is visible in source");
assert.match(html, /Marketplace — New York/, "New York is visible in the compact brand");
assert.match(html, /public\/assets\/school-mark\.jpg/, "supplied school mark is the primary logo");
assert.doesNotMatch(html, /The School Art/, "retired product name is absent");
assert.doesNotMatch(html, /href="#"/, "no placeholder-only links remain");
assert.doesNotMatch(app, new RegExp(["Curate", "what enters"].join(" ")), "rejected opening slogan is absent");
assert.doesNotMatch(app, /desk-popout/, "decorative hero popout is absent");
assert.doesNotMatch(app, /join-form/, "manual signup form is absent");
assert.doesNotMatch(app, /type="email"/, "email signup is absent");
assert.match(app, /track\("work_viewed"/, "work engagement is measured");
assert.match(app, /track\("discovery_sponsored"/, "curator intent is measured");
assert.match(analytics, /sessionStorage/, "metrics use a browser-session identifier");
assert.match(analytics, /globalPrivacyControl/, "metrics honor Global Privacy Control");
assert.doesNotMatch(analytics, /localStorage|document\.cookie|fingerprint/, "metrics avoid persistent tracking");
assert.match(manifest, /Grove Marketplace — New York/, "manifest carries the Grove identity");

for (const route of ["home", "discoverPage", "marketPage", "exhibitionPage", "workPage", "curatorsPage", "curatorPage", "bazaarPage", "sponsorPage", "joinPage"]) {
  assert.match(app, new RegExp(`const ${route}`), `${route} is implemented`);
}

assert.match(app, /No fetch in preview/, "link intake does not imply scraping");
assert.match(app, /Preview only · checkout is not connected/, "acquisition boundary is explicit");
assert.match(app, /Preview only · nothing is submitted/, "draft forms do not fake delivery");
assert.match(app, /data-auth-provider="instagram"/, "Instagram is a join path");
assert.match(app, /data-auth-provider="x"/, "X is a join path");
assert.match(app, /No account was opened or imported/, "unconfigured OAuth is explicit");
assert.match(app, /Connect wallet/, "crypto path is present");
assert.match(app, /Continue by card/, "card path is present");
assert.match(css, /prefers-reduced-motion/, "reduced-motion behavior exists");
assert.match(css, /:focus-visible/, "keyboard focus treatment exists");
assert.match(css, /@media \(max-width: 760px\)/, "phone layout exists");
assert.match(css, /border-radius: 3[0-9]px/, "rounded gallery surfaces are part of the visual system");

assert.equal(new Set(works.map((work) => work.slug)).size, works.length, "work slugs are unique");
assert.equal(new Set(curators.map((curator) => curator.id)).size, curators.length, "curator IDs are unique");
assert.equal(new Set(discoveries.map((item) => item.id)).size, discoveries.length, "discovery IDs are unique");
assert.deepEqual(new Set(works.map((work) => work.type)), new Set(["physical", "digital", "paired"]), "all three launch formats exist");

for (const discovery of discoveries) {
  assert.ok(works.some((work) => work.slug === discovery.workSlug), `${discovery.id} references a real work`);
  assert.ok(["new", "saved", "sponsored"].includes(discovery.status), `${discovery.id} has a valid state`);
}

for (const work of works) {
  assert.ok(work.title && work.artist && work.medium, `${work.slug} has core catalog fields`);
  assert.ok(work.price && work.cryptoPrice, `${work.slug} has card and crypto display prices`);
  assert.ok(work.rights && work.fulfillment, `${work.slug} states rights and fulfillment`);
  assert.ok(curators.some((curator) => curator.id === work.curatorId), `${work.slug} has a valid curator sponsor`);
  assert.ok(["physical", "digital"].includes(work.sheet), `${work.slug} has a valid image sheet`);
  assert.ok([0, 1, 2].includes(work.x) && [0, 1].includes(work.y), `${work.slug} has a valid image crop`);
  if (work.type === "physical") {
    assert.equal(work.chain, null, `${work.slug} does not invent token metadata`);
  } else {
    assert.ok(work.chain && work.tokenStandard && work.contractStatus, `${work.slug} has launch NFT metadata and honest contract status`);
    assert.match(work.contractStatus, /pending/i, `${work.slug} contract is labeled pending`);
  }
}

for (const exhibition of exhibitions) {
  assert.ok(curators.some((curator) => curator.id === exhibition.curatorId), `${exhibition.id} has a curator`);
  for (const slug of exhibition.workSlugs) {
    assert.ok(works.some((work) => work.slug === slug), `${exhibition.id} references a real work`);
  }
}

assert.ok(Date.parse(bazaar.date), "bazaar date is machine-readable");
assert.ok(bazaar.schedule.length >= 4, "bazaar has a useful program");
assert.match(launch, /NFT acquisition is not deferred/, "roadmap keeps NFTs in launch scope");
assert.match(launch, /Curator-first go-to-market/, "roadmap includes curator-first GTM");
assert.match(launch, /Instagram chat intake/, "roadmap includes the constrained chat-intake concept");
assert.match(launch, /no scraping/i, "roadmap prohibits scraping");
assert.match(launch, /Grove Marketplace — New York/, "launch plan is grounded in New York");
assert.match(oauth, /email\/password form/, "social-only access is documented");
assert.match(oauth, /instagram_business_basic/, "Instagram scope boundary is documented");
assert.match(oauth, /users\.read/, "X profile scope boundary is documented");

for (const asset of ["public/assets/school-seed.jpg", "public/assets/school-mark.jpg", "public/assets/physical-works.jpg", "public/assets/digital-works.jpg"]) {
  const info = await stat(join(root, asset));
  assert.ok(info.size > 20_000, `${asset} is present and non-empty`);
}

console.log(`Smoke checks passed: ${works.length} works, ${discoveries.length} discoveries, ${curators.length} curators, 3 launch formats.`);
