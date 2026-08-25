# Marketplace & Auction House of Brooklyn · design notes

## Identity

The user-supplied floating school is the primary mark for **Marketplace & Auction House of Brooklyn**. A compact crop identifies the header; the exact square image appears on the home page as a restrained celestial catalogue plate rather than a full-bleed illustration.

## Visual thesis

The marketplace pairs auction-house discipline with a pale-blue, pixelated school in the clouds:

- measured editorial serif type and quiet sans-serif navigation;
- thin rules, truthful catalogue metadata, and deliberate spacing;
- disciplined white catalogue sheets with small radii and shallow elevation;
- a low-contrast bluish checker field that fades through asymmetric cloud-wash zones;
- the supplied school image as the singular atmospheric signature;
- one concrete home action: **Open discoveries**.

The inset sticky header leaves a narrow strip of the checker field visible above it. The pattern is strongest in margins and between route-level sheets, then nearly disappears beneath broad pale washes. It should read as a material field related to the pixel-school image, never as a transparency-grid effect. Individual work and discovery entries remain flatter mounts within a sheet so the composition does not become a dashboard.

The current official [Sotheby’s](https://www.sothebys.com/en/) presentation informed the clear auction/exhibition hierarchy and concise date, location, format, estimate, and status patterns. The current official [Christie’s](https://www.christies.com/en) presentation informed the editorial scale, generous negative space, fine rules, and disciplined auction-calendar structure. The marketplace translates those traits into its own curator desk; it does not reproduce either company’s trade dress, content, or layouts.

## Product hierarchy

1. **Discover** — a curator receives, saves, or sponsors a piece.
2. **Add a piece** — a discovery or public link becomes an unlisted draft.
3. **Join** — a curator authorizes Instagram or X and imports only granted name/photo/handle data.
4. **Marketplace** — collectors explore physical, digital / NFT, and paired work.
5. **Bazaar** — the marketplace coordinates a monthly physical gathering.

The interface exposes only what the current decision needs. Edition, network, fulfillment, and acquisition detail remain on work pages or inside the honest preview boundary.

## System

- **Cloud Ground** `#f5f9fc`
- **Tile Blue** `#e4eff5`
- **Sheet White** `#ffffff`
- **Archive Ink** `#15202a`
- **Catalogue Slate** `#5e6a73`
- **Signal Cobalt** `#2349c8`, reserved for action and focus
- **Display** Instrument Serif
- **Body** DM Sans
- **Catalogue utility** IBM Plex Mono
- **Surfaces** 4–10px radii, fine blue-gray rules, white sheets, and shallow elevation

Controls state exactly what happens. Missing credentials and contracts appear as disabled acquisition actions and short preview labels. No state claims a fetch, submission, wallet connection, mint, payment, or inventory hold.

## Responsive behavior

Desktop uses a 440px home plate with the school capped at 300px, three-column catalogues, and paired work-detail sheets. Tablet collapses primary navigation into a floating bottom sheet while preserving two-column catalogues. Phone layouts use a roughly 400px plate with a 150px school mark, one-column catalogues, a 6px checker strip above the sticky header, and thumb-reachable curator destinations. Visible targets are at least 44px, horizontal overflow is suppressed and tested down to 320px, and motion respects `prefers-reduced-motion`.

## Assets

- `public/assets/school-seed.jpg` — exact supplied 1254×1254 image.
- `public/assets/school-mark.jpg` — deterministic center crop of the supplied image.
- `physical-works.jpg` / `digital-works.jpg` — generated fictional prototype contact sheets.

`public/school.glb` remains archival and is not loaded.
