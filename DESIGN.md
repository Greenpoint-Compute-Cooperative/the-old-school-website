# Marketplace & Auction House of Brooklyn · design notes

## Identity

The user-supplied floating school is the primary mark for **Marketplace & Auction House of Brooklyn**. A compact crop identifies the header; the exact square image fills the home page’s main celestial card.

## Visual thesis

The marketplace pairs auction-house discipline with a pale-blue, pixelated school in the clouds:

- measured editorial serif type and quiet sans-serif navigation;
- thin rules, truthful catalogue metadata, and deliberate spacing;
- a continuous celestial-blue field with restrained translucent surfaces;
- the v1.0.1 full-image hero with its dark lower veil and single white action;
- the supplied school image as the singular atmospheric signature;
- one concrete home action: **Open discoveries**.

The home composition is restored directly from release **v1.0.1** (`8e59181`): the supplied school image fills a card up to 720px tall on desktop and becomes a 660px / 620px portrait card on phone. The sticky header now floats inside a narrow reveal of the continuous celestial field. This isolated inset does not restore the later checker field, catalogue-sheet wrappers, compact square school plate, or hero identity column.

The current official [Sotheby’s](https://www.sothebys.com/en/) presentation informed the clear auction/exhibition hierarchy and concise date, location, format, estimate, and status patterns. The current official [Christie’s](https://www.christies.com/en) presentation informed the editorial scale, generous negative space, fine rules, and disciplined auction-calendar structure. The marketplace translates those traits into its own curator desk; it does not reproduce either company’s trade dress, content, or layouts.

## Product hierarchy

1. **Discover** — a curator receives, saves, or sponsors a piece.
2. **Add a piece** — a discovery or public link becomes an unlisted draft.
3. **Join** — a curator authorizes Instagram or X and imports only granted name/photo/handle data.
4. **Marketplace** — collectors explore physical, digital / NFT, and paired work.
5. **Bazaar** — the marketplace coordinates a monthly physical gathering.

The interface exposes only what the current decision needs. Edition, network, fulfillment, and acquisition detail remain on work pages or inside the honest preview boundary.

## System

- **Cloud Paper** `#f4f9fc`
- **Celestial Field** `#d5e8f3`
- **Archive Ink** `#15202a`
- **Slate** `#5e6a73`
- **Hairline Blue** `#afc7d5`
- **Signal Cobalt** `#2349c8`, reserved for action and focus
- **Display** Instrument Serif
- **Body** DM Sans
- **Catalogue utility** IBM Plex Mono
- **Surfaces** 4–16px radii, pale borders, translucent cloud paper, and shallow elevation

Controls state exactly what happens. Missing credentials and contracts appear as disabled acquisition actions and short preview labels. No state claims a fetch, submission, wallet connection, mint, payment, or inventory hold.

## Responsive behavior

Desktop uses the restored v1.0.1 main card at up to 720px tall, three-column catalogues, and paired work-detail surfaces. Tablet collapses primary navigation into a floating bottom surface while preserving two-column catalogues. Phone layouts use the historical 660px card (620px at 390px and below), one-column catalogues, a rounded inset sticky header, and thumb-reachable curator destinations. Interactive targets remain at least 44px even where the hero pill has a deliberately smaller visible face; horizontal overflow is suppressed and tested down to 320px, and motion respects `prefers-reduced-motion`.

## Assets

- `public/assets/school-seed.jpg` — exact supplied 1254×1254 image.
- `public/assets/school-mark.jpg` — deterministic center crop of the supplied image.
- `physical-works.jpg` / `digital-works.jpg` — generated fictional prototype contact sheets.

`public/school.glb` remains archival and is not loaded.
