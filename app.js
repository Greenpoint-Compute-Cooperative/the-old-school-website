import {
  bazaar,
  curators,
  discoveries,
  exhibitions,
  getCurator,
  getExhibition,
  getWork,
  works,
  worksForCurator
} from "./catalog.js";
import { track, trackClientErrors } from "./analytics.js";

const BRAND_NAME = "Marketplace & Auction House of Brooklyn";
const app = document.querySelector("#app");
const collectDialog = document.querySelector("#collect-dialog");
const collectContent = document.querySelector("#collect-content");
const toast = document.querySelector("#toast");

const discoveryState = new Map(discoveries.map((item) => [item.id, item.status]));
let discoveryFilter = "new";
let marketFilter = "all";
let selectedDiscovery = null;
let draftLink = "";
let toastTimer;
let authConfiguration;
let authConfigurationRequest;

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const route = () => {
  const clean = (location.hash || "#home").slice(1).replace(/^\/+|\/+$/g, "");
  return clean ? clean.split("/") : ["home"];
};

const routeName = () => {
  const name = route().join("/").toLowerCase();
  return /^[a-z0-9][a-z0-9/_-]{0,119}$/.test(name) ? name : "not-found";
};

const showToast = (message) => {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
};

const visualStyle = (work) => {
  const sheet = work.sheet === "digital" ? "digital" : "physical";
  return `--art:url('public/assets/${sheet}-works.jpg');--x:${work.x};--y:${work.y}`;
};

const art = (work, className = "") => `
  <div class="art ${className}" style="${visualStyle(work)}" role="img" aria-label="${escapeHtml(work.alt)}"></div>
`;

const typeLabel = (type) => ({ physical: "Physical", digital: "Digital", paired: "Physical + NFT" }[type]);

const curatorPill = (curator) => `
  <a class="curator-pill" href="#curator/${curator.id}">
    <span>${escapeHtml(curator.initials)}</span>${escapeHtml(curator.name)}
  </a>
`;

const workTile = (work) => {
  const curator = getCurator(work.curatorId);
  return `
    <article class="work-tile">
      <a href="#work/${work.slug}" class="work-tile__main">
        <div class="work-tile__media">
          ${art(work)}
          <span class="tag">${typeLabel(work.type)}</span>
        </div>
        <div class="work-tile__line">
          <span><strong>${escapeHtml(work.title)}</strong><small>${escapeHtml(work.artist)}</small></span>
          <span class="tile-price">${escapeHtml(work.cryptoPrice)}</span>
        </div>
      </a>
      ${curatorPill(curator)}
    </article>
  `;
};

const discoveryItem = (item) => {
  const work = getWork(item.workSlug);
  const state = discoveryState.get(item.id);
  return `
    <article class="discovery-card" data-discovery-id="${item.id}">
      <a href="#work/${work.slug}" class="discovery-card__image">
        ${art(work)}
        <span class="source-chip">${escapeHtml(item.source)}</span>
      </a>
      <div class="discovery-card__meta">
        <span><strong>${escapeHtml(work.title)}</strong><small>${escapeHtml(work.artist)}</small></span>
        <span class="sent-by">${escapeHtml(item.from)} · ${escapeHtml(item.when)}</span>
      </div>
      <div class="discovery-card__actions">
        <button type="button" data-save-discovery="${item.id}" aria-pressed="${state === "saved"}">${state === "saved" ? "Saved" : "Save"}</button>
        <button class="sponsor-action" type="button" data-sponsor-discovery="${item.id}">${state === "sponsored" ? "Sponsored" : "Sponsor"}</button>
      </div>
    </article>
  `;
};

const visibleDiscoveries = () => discoveries.filter((item) => discoveryState.get(item.id) === discoveryFilter);

const discoveryFilters = () => ["new", "saved", "sponsored"].map((state) => {
  const count = discoveries.filter((item) => discoveryState.get(item.id) === state).length;
  return `<button type="button" data-discovery-filter="${state}" aria-pressed="${discoveryFilter === state}">${state[0].toUpperCase() + state.slice(1)} <span>${count}</span></button>`;
}).join("");

const home = () => {
  const featuredDiscoveries = discoveries.slice(0, 3);
  const featuredWorks = [getWork("blue-hour-nassau"), getWork("cloud-protocol-i"), getWork("stairwell-for-nobody")];
  return `
    <div class="page home-page">
      <section class="hero" aria-label="${BRAND_NAME}">
        <div class="hero__identity">
          <h1>Marketplace &amp;<br>Auction House<br>of Brooklyn</h1>
          <a class="hero__action" href="#discover">Open discoveries <span aria-hidden="true">→</span></a>
        </div>
        <figure class="hero__mark">
          <img src="public/assets/school-seed.jpg" alt="A glowing ornate school floating in pale-blue clouds">
        </figure>
        <div class="hero__place">
          <span>29 Nassau</span>
          <span>Brooklyn</span>
        </div>
      </section>

      <section class="section" aria-labelledby="home-discoveries-title">
        <div class="section-head">
          <h2 id="home-discoveries-title">Discoveries</h2>
          <a href="#discover">View inbox →</a>
        </div>
        <div class="discovery-grid discovery-grid--home" id="home-discovery-grid">
          ${featuredDiscoveries.map(discoveryItem).join("")}
        </div>
      </section>

      <section class="section" aria-labelledby="home-market-title">
        <div class="section-head">
          <h2 id="home-market-title">At 29 Nassau</h2>
          <a href="#market">View marketplace →</a>
        </div>
        <div class="work-grid">${featuredWorks.map(workTile).join("")}</div>
      </section>

      <section class="bazaar-card" aria-labelledby="home-bazaar-title">
        <div class="bazaar-card__date"><strong>12</strong><span>SEP</span></div>
        <div><h2 id="home-bazaar-title">Assembly of Light</h2></div>
        <a class="round-arrow" href="#bazaar" aria-label="Open bazaar">→</a>
      </section>
    </div>
  `;
};

const discoverPage = () => {
  const items = visibleDiscoveries();
  return `
    <div class="page">
      <header class="page-title">
        <h1>Discoveries</h1>
        <a class="button button--dark" href="#join">Join as curator</a>
      </header>

      <form class="link-capture" id="link-capture">
        <img src="public/assets/school-mark.jpg" alt="" width="64" height="64">
        <label for="discovery-link">Add a public link</label>
        <input id="discovery-link" name="link" type="url" placeholder="https://" value="${escapeHtml(draftLink)}" required>
        <button type="submit">Start draft →</button>
        <small>No fetch in preview</small>
      </form>

      <div class="filter-bar" aria-label="Discovery status">${discoveryFilters()}</div>
      <section class="discovery-grid" id="discovery-grid" aria-live="polite">
        ${items.length ? items.map(discoveryItem).join("") : `<div class="empty"><strong>Nothing here yet.</strong><span>Save a discovery to move it here.</span></div>`}
      </section>
    </div>
  `;
};

const marketPage = (initial = "all") => {
  if (["all", "physical", "digital", "paired"].includes(initial)) marketFilter = initial;
  const filtered = marketFilter === "all" ? works : works.filter((work) => work.type === marketFilter);
  return `
    <div class="page">
      <header class="page-title page-title--simple">
        <h1>Works</h1>
      </header>
      <div class="filter-bar" aria-label="Work format">
        ${[["all", "All"], ["physical", "Physical"], ["digital", "Digital"], ["paired", "Paired"]].map(([value, label]) => `<button type="button" data-market-filter="${value}" aria-pressed="${marketFilter === value}">${label}</button>`).join("")}
      </div>
      <section class="work-grid" id="market-grid">${filtered.map(workTile).join("")}</section>
    </div>
  `;
};

const exhibitionPage = (exhibition) => {
  const curator = getCurator(exhibition.curatorId);
  const selected = exhibition.workSlugs.map(getWork).filter(Boolean);
  return `
    <div class="page">
      <a class="back-link" href="#market">← Marketplace</a>
      <header class="page-title">
        <h1>${escapeHtml(exhibition.title)}</h1>
        ${curatorPill(curator)}
      </header>
      <section class="work-grid">${selected.map(workTile).join("")}</section>
    </div>
  `;
};

const workPage = (work) => {
  const curator = getCurator(work.curatorId);
  const related = works.filter((item) => item.slug !== work.slug && (item.curatorId === work.curatorId || item.type === work.type)).slice(0, 3);
  const verb = work.type === "digital" ? "Collect" : work.type === "paired" ? "Acquire pair" : "Buy work";
  return `
    <div class="work-page">
      <a class="back-link work-page__back" href="#market">← Marketplace</a>
      <div class="work-view">
        <div class="work-view__art">${art(work)}</div>
        <aside class="work-panel">
          <span class="tag tag--static">${typeLabel(work.type)}</span>
          <h1>${escapeHtml(work.title)}</h1>
          <span class="artist-name">${escapeHtml(work.artist)}, ${work.year}</span>
          ${curatorPill(curator)}
          <div class="work-price"><strong>${escapeHtml(work.cryptoPrice)}</strong><span>${escapeHtml(work.price)} card</span></div>
          <button class="button button--blue" type="button" data-collect="${work.slug}" data-method="crypto">${verb}</button>
          <button class="text-button" type="button" data-collect="${work.slug}" data-method="card">Use card</button>
          <details class="work-details">
            <summary>Details</summary>
            <dl>
              <div><dt>Medium</dt><dd>${escapeHtml(work.medium)}</dd></div>
              <div><dt>Edition</dt><dd>${escapeHtml(work.edition)}</dd></div>
              <div><dt>Location</dt><dd>${escapeHtml(work.location)}</dd></div>
              ${work.chain ? `<div><dt>Network</dt><dd>${escapeHtml(work.chain)}</dd></div>` : ""}
            </dl>
          </details>
        </aside>
      </div>
      <section class="page section related" aria-labelledby="related-title">
        <div class="section-head"><h2 id="related-title">More works</h2></div>
        <div class="work-grid">${related.map(workTile).join("")}</div>
      </section>
    </div>
  `;
};

const curatorsPage = () => `
  <div class="page">
    <header class="page-title">
      <h1>Curators</h1>
      <a class="button button--dark" href="#join">Join as curator</a>
    </header>
    <section class="curator-grid">
      ${curators.map((curator) => {
        const count = worksForCurator(curator.id).length;
        return `<a class="curator-card" href="#curator/${curator.id}"><img src="public/assets/school-mark.jpg" alt=""><span class="curator-card__initials">${escapeHtml(curator.initials)}</span><h2>${escapeHtml(curator.name)}</h2><small>${escapeHtml(curator.role.split(" · ")[0])}</small><strong>${count} works →</strong></a>`;
      }).join("")}
    </section>
  </div>
`;

const curatorPage = (curator) => {
  const selected = worksForCurator(curator.id);
  return `
    <div class="page">
      <a class="back-link" href="#curators">← Curators</a>
      <header class="curator-profile">
        <div class="curator-profile__mark"><img src="public/assets/school-mark.jpg" alt=""><span>${escapeHtml(curator.initials)}</span></div>
        <div><span class="curator-role">${escapeHtml(curator.role.split(" · ")[0])}</span><h1>${escapeHtml(curator.name)}</h1><div class="action-row"><a class="button button--dark" href="#sponsor">Add a piece</a><a class="button button--soft" href="#discover">Discover</a></div></div>
      </header>
      <section class="section"><div class="section-head"><h2>Sponsored</h2><span>${selected.length}</span></div><div class="work-grid">${selected.map(workTile).join("")}</div></section>
    </div>
  `;
};

const sponsorPage = () => {
  const discovery = selectedDiscovery ? discoveries.find((item) => item.id === selectedDiscovery) : null;
  const work = discovery ? getWork(discovery.workSlug) : null;
  return `
    <div class="page form-page">
      <header class="page-title page-title--form">
        <h1>Add a piece</h1>
      </header>
      ${work ? `<div class="selected-discovery"><div>${art(work)}</div><span><small>From discoveries</small><strong>${escapeHtml(work.title)}</strong><i>${escapeHtml(work.artist)}</i></span></div>` : ""}
      <form class="minimal-form" id="piece-form">
        <label>Public link<input name="link" type="url" placeholder="https://" value="${escapeHtml(draftLink)}" required></label>
        <div class="form-pair">
          <label>Artist<input name="artist" value="${escapeHtml(work?.artist || "")}" required></label>
          <label>Work<input name="title" value="${escapeHtml(work?.title || "")}" required></label>
        </div>
        <div class="form-pair">
          <label>Format<select name="format" required><option value="">Choose</option><option ${work?.type === "physical" ? "selected" : ""}>Physical</option><option ${work?.type === "digital" ? "selected" : ""}>Digital / NFT</option><option ${work?.type === "paired" ? "selected" : ""}>Physical + NFT</option></select></label>
          <label>Sponsor<select name="curator" required><option value="">Choose</option>${curators.map((curator) => `<option>${escapeHtml(curator.name)}</option>`).join("")}</select></label>
        </div>
        <label>Why this work?<textarea name="note" rows="3"></textarea></label>
        <button class="button button--dark" type="submit">Review draft</button>
        <small class="form-note">Preview only · nothing is submitted</small>
        <div class="draft-result" id="piece-result" aria-live="polite"></div>
      </form>
    </div>
  `;
};

const providerState = (provider) => authConfiguration?.providers?.[provider]?.configured ? "Available" : authConfiguration ? "Not configured" : "Checking";

const joinPage = () => `
  <div class="page join-page">
    <div class="join-image"><img src="public/assets/school-seed.jpg" alt="A glowing school floating in clouds"></div>
    <div class="join-panel">
      <h1>Join.</h1>
      <div class="social-join" aria-label="Join as curator">
        <button type="button" data-auth-provider="instagram">
          <span class="social-mark" aria-hidden="true">◎</span>
          <span><strong>Instagram</strong><small>Name · photo · handle</small></span>
          <i data-provider-state="instagram">${providerState("instagram")}</i>
        </button>
        <button type="button" data-auth-provider="x">
          <span class="social-mark social-mark--x" aria-hidden="true">X</span>
          <span><strong>X</strong><small>Name · photo · handle</small></span>
          <i data-provider-state="x">${providerState("x")}</i>
        </button>
      </div>
      <p class="join-note">Provider consent only. We never ask for your password.</p>
      <div class="join-result" id="join-result" aria-live="polite"></div>
    </div>
  </div>
`;

const bazaarPage = () => {
  const featured = [getWork("aperture-vessel"), getWork("grid-chorus"), getWork("orbit-32")];
  return `
    <div class="page bazaar-page">
      <section class="bazaar-hero">
        <div class="bazaar-hero__image">${art(getWork("portal-study"))}</div>
        <div class="bazaar-hero__copy"><span class="bazaar-meta">Sep 12 · 12–7 PM</span><h1>${escapeHtml(bazaar.title)}</h1><button class="button button--light" type="button" data-calendar>Save the date</button></div>
      </section>
      <section class="schedule" aria-label="Bazaar schedule">
        ${bazaar.schedule.slice(0, 3).map((item) => `<div><time>${escapeHtml(item.time)}</time><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.note)}</span></div>`).join("")}
      </section>
      <section class="section"><div class="section-head"><h2>At the bazaar</h2></div><div class="work-grid">${featured.map(workTile).join("")}</div></section>
    </div>
  `;
};

const notFound = () => `<div class="page"><header class="page-title"><h1>Not found.</h1><a class="button button--dark" href="#home">Go home</a></header></div>`;

const collectTemplate = (work, method) => `
  <div class="collect-work"><div>${art(work)}</div><span><small>Preview</small><h2 id="collect-title">${escapeHtml(work.title)}</h2><i>${escapeHtml(work.artist)}</i></span></div>
  <div class="collect-price"><strong>${escapeHtml(work.cryptoPrice)}</strong><span>${escapeHtml(work.price)} card</span></div>
  <div class="method-tabs" role="tablist" aria-label="Payment method">
    <button type="button" role="tab" data-method="crypto" aria-selected="${method !== "card"}">Crypto</button>
    <button type="button" role="tab" data-method="card" aria-selected="${method === "card"}">Card</button>
  </div>
  <div class="method-panel" data-panel="crypto" ${method === "card" ? "hidden" : ""}><span>${work.chain ? `${escapeHtml(work.chain)} · ${escapeHtml(work.edition)}` : "USDC · inventory hold"}</span><button class="button button--dark" disabled>Connect wallet</button></div>
  <div class="method-panel" data-panel="card" ${method !== "card" ? "hidden" : ""}><span>Hosted checkout</span><button class="button button--dark" disabled>Continue by card</button></div>
  <small class="pending-note">Preview only · checkout is not connected</small>
`;

const openCollect = (slug, method) => {
  const work = getWork(slug);
  if (!work) return;
  collectDialog.dataset.workSlug = slug;
  collectContent.innerHTML = collectTemplate(work, method);
  collectDialog.showModal();
};

const updateDiscoveryView = () => {
  const grid = document.querySelector("#discovery-grid");
  if (grid) {
    const items = visibleDiscoveries();
    grid.innerHTML = items.length ? items.map(discoveryItem).join("") : `<div class="empty"><strong>Nothing here yet.</strong><span>Save a discovery to move it here.</span></div>`;
  }
  document.querySelectorAll("[data-discovery-filter]").forEach((button) => {
    const state = button.dataset.discoveryFilter;
    const count = discoveries.filter((item) => discoveryState.get(item.id) === state).length;
    button.setAttribute("aria-pressed", String(state === discoveryFilter));
    button.querySelector("span").textContent = count;
  });
};

const setActiveNav = (root) => {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const active = link.dataset.nav === root || (["work", "exhibition"].includes(root) && link.dataset.nav === "market");
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
};

const loadAuthConfiguration = async () => {
  if (authConfiguration) return authConfiguration;
  if (!authConfigurationRequest) {
    authConfigurationRequest = fetch("/api/config", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("UNAVAILABLE");
        return response.json();
      })
      .catch(() => ({
        backend: { configured: false },
        providers: { instagram: { configured: false }, x: { configured: false } }
      }));
  }
  authConfiguration = await authConfigurationRequest;
  return authConfiguration;
};

const setJoinResult = (headline, detail, profile) => {
  const result = document.querySelector("#join-result");
  if (!result) return;
  const image = profile?.avatar_url && /^https:\/\//i.test(profile.avatar_url) ? profile.avatar_url : "public/assets/school-mark.jpg";
  result.innerHTML = profile ? `
    <img src="${escapeHtml(image)}" alt="">
    <span><strong>${escapeHtml(profile.display_name)}</strong><small>${profile.handle ? `@${escapeHtml(profile.handle)} · ` : ""}${profile.provider === "x" ? "X" : "Instagram"}</small></span>
    <button type="button" data-signout>Sign out</button>
  ` : `<strong>${escapeHtml(headline)}</strong><span>${escapeHtml(detail)}</span>`;
  result.classList.add("is-visible");
};

const hydrateJoin = async () => {
  const configuration = await loadAuthConfiguration();
  if (!document.querySelector(".join-page")) return;

  for (const provider of ["instagram", "x"]) {
    const configured = Boolean(configuration.providers?.[provider]?.configured);
    const state = document.querySelector(`[data-provider-state="${provider}"]`);
    const button = document.querySelector(`[data-auth-provider="${provider}"]`);
    if (state) state.textContent = configured ? "Available" : "Not configured";
    if (button) button.classList.toggle("is-unconfigured", !configured);
  }

  const authState = new URLSearchParams(location.search).get("auth");
  if (!authState) return;

  if (authState === "connected") {
    try {
      const response = await fetch("/api/me", { headers: { Accept: "application/json" } });
      const body = await response.json();
      if (response.ok && body.curator) {
        setJoinResult("", "", body.curator);
        void track("join_completed", { route: routeName(), entityType: "provider", entityId: body.curator.provider, properties: { state: "connected" } });
      } else setJoinResult("Profile unavailable", "No profile data was imported.");
    } catch {
      setJoinResult("Profile unavailable", "No profile data was imported.");
    }
  } else if (authState === "cancelled") {
    setJoinResult("Join cancelled", "No account was opened or imported.");
    void track("join_cancelled", { route: routeName(), properties: { state: "cancelled" } });
  } else if (authState === "not-configured") {
    setJoinResult("OAuth not configured", "No account was opened or imported.");
    void track("join_unavailable", { route: routeName(), properties: { state: "not-configured" } });
  } else {
    setJoinResult("Join incomplete", "No profile data was imported.");
    void track("join_cancelled", { route: routeName(), properties: { state: "incomplete" } });
  }

  history.replaceState(null, "", `${location.pathname}${location.hash}`);
};

const startAuth = async (provider) => {
  const configuration = await loadAuthConfiguration();
  if (!configuration.providers?.[provider]?.configured) {
    setJoinResult(`${provider === "x" ? "X" : "Instagram"} is not configured`, "No account was opened or imported.");
    void track("join_unavailable", { route: routeName(), entityType: "provider", entityId: provider, properties: { provider } });
    return;
  }
  void track("join_started", { route: routeName(), entityType: "provider", entityId: provider, properties: { provider } });
  location.assign(`/api/auth/start?provider=${encodeURIComponent(provider)}`);
};

const signOut = async () => {
  try {
    const response = await fetch("/api/auth/signout", { method: "POST", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("SIGNOUT_FAILED");
    setJoinResult("Signed out", "This browser session is closed.");
  } catch {
    setJoinResult("Sign-out incomplete", "Try again when the service is available.");
  }
};

const render = () => {
  const [root, detail] = route();
  let html;
  let title;
  if (root === "home") { html = home(); title = BRAND_NAME; }
  else if (root === "discover") { html = discoverPage(); title = `Discoveries · ${BRAND_NAME}`; }
  else if (root === "market") { html = marketPage(detail || "all"); title = `Works · ${BRAND_NAME}`; }
  else if (root === "work" && getWork(detail)) { const work = getWork(detail); html = workPage(work); title = `${work.title} · ${BRAND_NAME}`; }
  else if (root === "exhibition" && getExhibition(detail)) { const exhibition = getExhibition(detail); html = exhibitionPage(exhibition); title = `${exhibition.title} · ${BRAND_NAME}`; }
  else if (root === "curators") { html = curatorsPage(); title = `Curators · ${BRAND_NAME}`; }
  else if (root === "curator" && getCurator(detail)) { const curator = getCurator(detail); html = curatorPage(curator); title = `${curator.name} · ${BRAND_NAME}`; }
  else if (root === "sponsor") { html = sponsorPage(); title = `Add a piece · ${BRAND_NAME}`; }
  else if (root === "join") { html = joinPage(); title = `Join · ${BRAND_NAME}`; }
  else if (root === "bazaar") { html = bazaarPage(); title = `Bazaar · ${BRAND_NAME}`; }
  else { html = notFound(); title = `Not found · ${BRAND_NAME}`; }

  app.innerHTML = html;
  document.title = title;
  setActiveNav(root);
  scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(() => app.focus({ preventScroll: true }));
  if (root === "join") void hydrateJoin();

  const viewedRoute = [root, detail].filter(Boolean).join("/");
  void track("page_view", { route: routeName() });
  if (root === "work" && detail) {
    void track("work_viewed", {
      route: viewedRoute,
      entityType: "work",
      entityId: detail,
      properties: { format: getWork(detail).type }
    });
  }
  if (root === "curator" && detail) void track("curator_viewed", { route: viewedRoute, entityType: "curator", entityId: detail });
  if (root === "exhibition" && detail) void track("exhibition_viewed", { route: viewedRoute, entityType: "exhibition", entityId: detail });
  if (root === "bazaar") void track("bazaar_viewed", { route: "bazaar", entityType: "bazaar", entityId: "assembly-of-light" });
};

document.addEventListener("click", (event) => {
  const authProvider = event.target.closest("[data-auth-provider]");
  if (authProvider) { void startAuth(authProvider.dataset.authProvider); return; }

  if (event.target.closest("[data-signout]")) { void signOut(); return; }

  const save = event.target.closest("[data-save-discovery]");
  if (save) {
    const id = save.dataset.saveDiscovery;
    discoveryState.set(id, discoveryState.get(id) === "saved" ? "new" : "saved");
    void track(discoveryState.get(id) === "saved" ? "discovery_saved" : "discovery_unsaved", { route: routeName(), entityType: "discovery", entityId: id, properties: { state: discoveryState.get(id) } });
    updateDiscoveryView();
    const card = document.querySelector(`[data-discovery-id="${id}"]`);
    if (card && !document.querySelector("#discovery-grid")) card.outerHTML = discoveryItem(discoveries.find((item) => item.id === id));
    showToast(discoveryState.get(id) === "saved" ? "Saved" : "Moved to new");
    return;
  }

  const sponsor = event.target.closest("[data-sponsor-discovery]");
  if (sponsor) {
    selectedDiscovery = sponsor.dataset.sponsorDiscovery;
    discoveryState.set(selectedDiscovery, "sponsored");
    void track("discovery_sponsored", { route: routeName(), entityType: "discovery", entityId: selectedDiscovery, properties: { state: "sponsored" } });
    location.hash = "#sponsor";
    return;
  }

  const discoveryTab = event.target.closest("[data-discovery-filter]");
  if (discoveryTab) {
    discoveryFilter = discoveryTab.dataset.discoveryFilter;
    void track("discovery_filter_changed", { route: routeName(), properties: { filter: discoveryFilter } });
    updateDiscoveryView();
    return;
  }

  const marketTab = event.target.closest("[data-market-filter]");
  if (marketTab) {
    marketFilter = marketTab.dataset.marketFilter;
    void track("work_filter_changed", { route: routeName(), properties: { filter: marketFilter } });
    const filtered = marketFilter === "all" ? works : works.filter((work) => work.type === marketFilter);
    document.querySelector("#market-grid").innerHTML = filtered.map(workTile).join("");
    document.querySelectorAll("[data-market-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.marketFilter === marketFilter)));
    return;
  }

  const collect = event.target.closest("[data-collect]");
  if (collect) {
    openCollect(collect.dataset.collect, collect.dataset.method);
    void track("acquisition_preview_opened", { route: routeName(), entityType: "work", entityId: collect.dataset.collect, properties: { method: collect.dataset.method } });
    return;
  }

  const method = event.target.closest("[data-method]");
  if (method) {
    collectDialog.querySelectorAll("[data-method]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.method === method.dataset.method)));
    collectDialog.querySelectorAll("[data-panel]").forEach((panel) => panel.hidden = panel.dataset.panel !== method.dataset.method);
    void track("acquisition_method_changed", { route: routeName(), entityType: "work", entityId: collectDialog.dataset.workSlug, properties: { method: method.dataset.method } });
    return;
  }

  if (event.target.closest("[data-close-dialog]")) { collectDialog.close(); return; }
  if (event.target.closest("[data-calendar]")) downloadCalendar();
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const data = new FormData(form);

  if (form.id === "link-capture") {
    draftLink = data.get("link");
    selectedDiscovery = null;
    void track("draft_started", { route: routeName(), properties: { source: "public-link" } });
    location.hash = "#sponsor";
  }

  if (form.id === "piece-form") {
    const result = document.querySelector("#piece-result");
    result.innerHTML = `<span>Draft ready · not submitted</span><strong>${escapeHtml(data.get("title"))}</strong><small>${escapeHtml(data.get("artist"))} · ${escapeHtml(data.get("format"))}</small>`;
    result.classList.add("is-visible");
    void track("draft_reviewed", { route: routeName(), properties: { format: String(data.get("format") || "").toLowerCase().replaceAll(" / ", "-").replaceAll(" + ", "-") } });
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

});

const downloadCalendar = () => {
  const file = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "DTSTART:20260912T160000Z", "DTEND:20260912T230000Z", `SUMMARY:${BRAND_NAME} · Assembly of Light`, "LOCATION:29 Nassau Avenue\\, Brooklyn\\, New York", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([file], { type: "text/calendar" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "marketplace-auction-house-of-brooklyn-bazaar.ics" });
  link.click();
  URL.revokeObjectURL(url);
  showToast("Calendar ready");
  void track("calendar_saved", { route: routeName(), entityType: "bazaar", entityId: "assembly-of-light" });
};

collectDialog.addEventListener("click", (event) => { if (event.target === collectDialog) collectDialog.close(); });
addEventListener("hashchange", render);
trackClientErrors(routeName);
render();
