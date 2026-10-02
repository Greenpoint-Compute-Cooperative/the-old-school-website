// End-to-end checks for The School's public pages.
//
//   npm test                        live: theschool.nyc, sheet.theschool.nyc, form.theschool.nyc
//   npm run test:local              against `wrangler dev` on :8787 (run it from the repo root first)
//
// Nothing here creates a real submission: the founding-member POST and the Stripe hand-off are
// intercepted in the browser, and the event-inquiry check only submits an empty form (rejected
// before anything is stored or posted to Slack).
import { chromium, devices } from "playwright";

const SITE = (process.env.SITE || "https://theschool.nyc").replace(/\/+$/, "");
const SHEET = (process.env.SHEET || "https://sheet.theschool.nyc").replace(/\/+$/, "");
const FORMS = (process.env.FORMS || "https://form.theschool.nyc").replace(/\/+$/, "");
const LOCAL = !SITE.startsWith("https://theschool.nyc");
const EVENT_FORM = "https://form.theschool.nyc/f/event-inquiry";
const OLD_COPY = /old school|greenpoint(?!-compute)/i;

/** Absolute theschool.nyc URLs in tags point at production; locally, read them from SITE. */
const local = (u) => (LOCAL ? u.replace("https://theschool.nyc", SITE) : u);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const results = [];

function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function status(ctx, url, method = "GET") {
  const r = await ctx.request.fetch(url, { method, maxRedirects: 5, failOnStatusCode: false });
  return { code: r.status(), type: r.headers()["content-type"] || "", res: r };
}

async function test(name, fn, opts = {}) {
  const ctx = await browser.newContext(opts.device ? { ...devices[opts.device] } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    // Turnstile refuses hostnames outside its widget's list (localhost): expected only in local runs.
    if (LOCAL && /Turnstile\] Error: 110200/.test(e.message)) return;
    errors.push(e.message);
  });
  const t0 = Date.now();
  try {
    await fn({ page, ctx, errors });
    check(errors.length === 0, `page errors: ${errors.join(" | ")}`);
    results.push({ name, ok: true, ms: Date.now() - t0 });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, err: e.message.split("\n")[0] });
  } finally {
    await ctx.close();
  }
}

/** Title, no old copy, favicon and link-preview image resolve. */
async function pageBasics(page, ctx, url, title, { og = true } = {}) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  check(res.status() === 200, `${url} -> ${res.status()}`);
  check((await page.title()) === title, `title was "${await page.title()}"`);
  const text = await page.locator("body").innerText();
  const old = text.match(OLD_COPY);
  check(!old, `old copy on ${url}: ${old && old[0]}`);
  const icon = await page.locator('link[rel="icon"]').first().getAttribute("href");
  check(icon, "no favicon link");
  const ic = await status(ctx, new URL(icon, url).href);
  check(ic.code === 200 && /image/.test(ic.type), `favicon ${icon} -> ${ic.code} ${ic.type}`);
  if (og) {
    const img = await page.locator('meta[property="og:image"]').getAttribute("content");
    check(img && img.startsWith("https://"), "og:image missing or relative");
    const oi = await status(ctx, local(img));
    check(oi.code === 200 && /image/.test(oi.type), `og:image ${img} -> ${oi.code}`);
  }
}

/** Every same-site link and asset on the page answers below 400. */
async function linksResolve(page, ctx) {
  const urls = await page.evaluate(() =>
    [...document.querySelectorAll("a[href], img[src], script[src], link[href]")]
      .map((el) => el.href || el.src)
      .filter((u) => u && /^https?:/.test(u)),
  );
  const mine = [...new Set(urls)].filter((u) => {
    const h = new URL(u).host;
    return h === new URL(SITE).host || h.endsWith("theschool.nyc");
  });
  for (const u of mine) {
    const { code } = await status(ctx, local(u.split("#")[0]));
    check(code < 400, `${u} -> ${code}`);
  }
  return mine.length;
}

// ── theschool.nyc ────────────────────────────────────────────────────────────

await test("home: School copy, favicon, preview, links", async ({ page, ctx }) => {
  await pageBasics(page, ctx, `${SITE}/`, "The School · Founding member interest form");
  check((await page.locator(".wordmark").first().innerText()).trim().toLowerCase() === "the school", "wordmark");
  check((await linksResolve(page, ctx)) > 3, "too few links found");
});

await test("home: founding-member form posts to GPCC Forms (intercepted)", async ({ page }) => {
  let posted = null;
  await page.route("**/api/f/founding-member", async (route) => {
    posted = { url: route.request().url(), body: JSON.parse(route.request().postData() || "{}") };
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto(`${SITE}/`);
  await page.fill("#f-name", "Ada Lovelace");
  await page.fill("#f-email", "ada.lovelace@example.org");
  await page.fill("#f-phone", "555-0100");
  await page.fill("#f-do", "e2e test");
  await page.check('input[name="workspace_interest"][value="Hot desk"]', { force: true });
  await page.check('input[name="monthly_budget"][value="$300-$500/month"]', { force: true });
  await page.fill('textarea[name="ninja_skill"]', "e2e test");
  await page.fill('textarea[name="referral"]', "e2e test");
  await page.locator("#submit-btn").click();
  await page.locator("#success-card.show").waitFor({ timeout: 10000 });
  check(posted && posted.url === "https://form.theschool.nyc/api/f/founding-member", `posted to ${posted?.url}`);
  check(posted.body.email === "ada.lovelace@example.org" && posted.body.workspace_interest === "Hot desk", "payload fields");
  check(!posted.body.field_hp, "honeypot filled");
});

await test("join: copy, validation, Stripe hand-off (intercepted)", async ({ page, ctx }) => {
  await pageBasics(page, ctx, `${SITE}/join/`, "The School · Become a founding member");
  check((await page.locator("#f-joincode").getAttribute("placeholder")) === "THESCHOOL", "placeholder");
  await page.locator('form button[type="submit"]').first().click();
  await page.getByText("Enter your join code to continue.").waitFor({ timeout: 5000 });
  let stripe = null;
  await page.route("https://buy.stripe.com/**", (route) => {
    stripe = route.request().url();
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>stripe stub</title>" });
  });
  await page.fill("#f-joincode", "E2E-TEST");
  await page.fill("#f-email", "ada.lovelace@example.org");
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/buy\.stripe\.com/, { timeout: 10000 });
  check(stripe.includes("client_reference_id=E2E-TEST"), `stripe url ${stripe}`);
  check(stripe.includes("prefilled_email=ada.lovelace%40example.org"), `stripe url ${stripe}`);
});

await test("floorplan + rate sheet + rate card", async ({ page, ctx }) => {
  await pageBasics(page, ctx, `${SITE}/floorplan`, "The School — Interactive Floorplan", { og: false });
  check((await page.locator("body").innerText()).includes("Williamsburg"), "floorplan: Williamsburg");
  await linksResolve(page, ctx);
  await pageBasics(page, ctx, `${SITE}/rate-sheet`, "The School — Room Schedule A-002", { og: false });
  await linksResolve(page, ctx);
  const pdf = await status(ctx, `${SITE}/rate-card.pdf`);
  check(pdf.code === 200 && pdf.type.includes("pdf"), `rate-card.pdf ${pdf.code}`);
});

// ── the auditorium film ──────────────────────────────────────────────────────

await test("auditorium film: copy, media, CTA", async ({ page, ctx }) => {
  await pageBasics(page, ctx, `${SITE}/auditorium/`, "The Auditorium | The School");
  const html = await page.content();
  check(html.includes("THE SCHOOL") && html.includes("Williamsburg"), "film copy");
  check(!/theoldschool\.nyc/.test(html), "film still links theoldschool.nyc");
  const media = [...new Set([...html.matchAll(/'((?:still|vid)\/[^']+)'/g)].map((m) => m[1]))];
  check(media.length === 28, `expected 28 media files, found ${media.length}`);
  for (const m of media) {
    const { code } = await status(ctx, `${SITE}/auditorium/${m}`, "HEAD");
    check(code === 200, `${m} -> ${code}`);
  }
  await page.waitForFunction(() => [...document.querySelectorAll("video")].some((v) => v.readyState >= 1), null, { timeout: 20000 });
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(800);
  const ctas = await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.href));
  check(ctas.includes(EVENT_FORM), "no Inquire link to the event form");
  check(ctas.some((h) => h.endsWith("/floorplan")), "no floor plan link");
});

// ── the one-sheet ────────────────────────────────────────────────────────────

const sheetBases = LOCAL ? [`${SITE}/sheet`] : [SHEET, `${SITE}/sheet`];
for (const base of sheetBases) {
  await test(`sheet desktop (${base})`, async ({ page, ctx }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await pageBasics(page, ctx, `${base}/`, "The Auditorium | The School");
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    const box = await page.locator("#sheet").boundingBox();
    check(box.x >= -1 && box.y >= -1 && box.x + box.width <= 1921 && box.y + box.height <= 1081, `sheet off-canvas ${JSON.stringify(box)}`);
    const cta = page.locator("a.cta");
    check((await cta.innerText()).trim().toLowerCase() === "submit an inquiry", "cta label");
    check((await cta.getAttribute("href")) === EVENT_FORM, "cta href");
    for (const f of ["the-school-auditorium.pdf", "the-school-auditorium.png", "og.jpg"]) {
      const { code } = await status(ctx, `${base}/${f}`);
      check(code === 200, `${f} -> ${code}`);
    }
  });

  await test(`sheet phone (${base})`, async ({ page }) => {
    await page.goto(`${base}/`);
    await page.waitForLoadState("load");
    const m = await page.evaluate(() => ({ vw: innerWidth, sw: document.documentElement.scrollWidth }));
    check(m.sw <= m.vw, `horizontal scroll: ${m.sw} > ${m.vw}`);
    const cta = await page.locator("a.cta").boundingBox();
    check(cta && cta.width > m.vw * 0.8, "cta not full width on phone");
  }, { device: "iPhone 13" });
}

// ── forms ────────────────────────────────────────────────────────────────────

await test("forms: event inquiry renders with preview; empty submit is rejected", async ({ page, ctx }) => {
  const res = await page.goto(`${FORMS}/f/event-inquiry`);
  check(res.status() === 200, `event-inquiry ${res.status()}`);
  check((await page.title()) === "Submit Inquiry", "form title");
  const img = await page.locator('meta[property="og:image"]').getAttribute("content");
  check((await status(ctx, img)).code === 200, "form og:image");
  await page.locator('form button[type="submit"]').click();
  await page.waitForLoadState("load");
  const text = await page.locator("body").innerText();
  check(!/Thank you/.test(text), "empty submission was accepted");
});

await test("forms: founding member says Williamsburg", async ({ page }) => {
  const res = await page.goto(`${FORMS}/f/founding-member`);
  check(res.status() === 200, `founding-member ${res.status()}`);
  const text = await page.locator("body").innerText();
  check(text.includes("Williamsburg") && !OLD_COPY.test(text), "founding-member copy");
});

// ── hygiene ──────────────────────────────────────────────────────────────────

await test("plumbing is not served", async ({ ctx }) => {
  for (const p of ["/wrangler.toml", "/.git/HEAD", "/e2e/package.json", "/e2e/run.mjs", "/sheet/wrangler.toml", "/.assetsignore", "/CNAME"]) {
    const { code } = await status(ctx, `${SITE}${p}`);
    check(code === 404, `${p} -> ${code}`);
  }
});

await browser.close();

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name} (${r.ms} ms)${r.ok ? "" : `\n    ${r.err}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed against ${SITE}${LOCAL ? " (local)" : ""}`);
process.exit(failed.length ? 1 : 0);
