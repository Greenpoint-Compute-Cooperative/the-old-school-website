# Marketplace & Auction House of Brooklyn New York · design notes

## Identity

The user-supplied floating school is the primary mark, not mood-board material. The full square image anchors the home and join pages; a centered crop serves as the compact logo. The visible identity is **Marketplace & Auction House of Brooklyn New York**.

## Visual thesis

The experience is a celestial curator desk:

- pale-blue cloud light and icy white highlights;
- art at the largest practical scale;
- rounded gallery cards that lift from the page;
- translucent stacked surfaces, soft shadows, and tactile controls;
- serif display type with quiet sans-serif utility text;
- very little copy.

The former Foundation marketplace influences the confident artwork scale, rounded pop-out objects, editorial calm, and clear acquisition focus. This experience combines that sensibility with its own pixelated school and luminous-blue atmosphere rather than reproducing Foundation’s branding or layouts.

## Product hierarchy

1. **Discover** — a curator receives, saves, or sponsors a piece.
2. **Add a piece** — a discovery or public link becomes an unlisted draft.
3. **Join** — a curator authorizes Instagram or X and imports only granted name/photo/handle data.
4. **Marketplace** — collectors explore physical, digital / NFT, and paired work.
5. **Bazaar** — the marketplace coordinates a monthly physical gathering.

The interface exposes only the state needed for the current decision. Detail, edition, network, and fulfillment metadata stay collapsed or on the work page.

## System

- **Sky** `#dceefa`
- **Ice** `#f8fcff`
- **Ink** `#17202c`
- **Cobalt** `#3157e8`
- **Display** Instrument Serif
- **Body** DM Sans
- **Utility** IBM Plex Mono
- **Cards** 18–34px radii with pale borders and blue-gray elevation

Controls state exactly what happens. Missing credentials and contracts are represented by disabled acquisition actions and short preview labels. No state claims a fetch, submission, wallet connection, mint, payment, or inventory hold.

## Responsive behavior

Desktop uses three-column art grids and paired detail surfaces. Phone layouts collapse to one column, retain the full identity in a compact two-line lockup, keep curator actions prominent, and move the three primary destinations into a thumb-reachable floating navigation. Visible first-viewport targets are at least 44px, horizontal overflow is suppressed and tested, and motion respects `prefers-reduced-motion`.

## Assets

- `public/assets/school-seed.jpg` — exact supplied 1254×1254 image.
- `public/assets/school-mark.jpg` — deterministic center crop of the supplied image.
- `physical-works.jpg` / `digital-works.jpg` — generated fictional prototype contact sheets.

`public/school.glb` remains archival and is not loaded.
