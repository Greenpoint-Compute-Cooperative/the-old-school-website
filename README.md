# The Old School Website

Preserved standalone website for **The School**, 29 Nassau Avenue in Williamsburg, Brooklyn. The page combines a full-screen Three.js scene of the building with a small semantic HTML overlay for the identity, tagline, and four destination links.

This repository is intentionally small: there is no framework, package manager, or build step. The complete page lives in [`index.html`](index.html), and the baked building scan lives in [`public/school.glb`](public/school.glb).

## Project status

This is the published source for the preserved legacy School experience, separated from the newer Grove Marketplace codebase. The Space, Technology Philanthropy, and Join the Neighborhood cards link to their live destinations; Art Philanthropy remains intentionally inactive until its final URL is chosen. The current model uses Google Earth-derived imagery and carries a visible source disclosure on the page.

![Desktop view of The School website](docs/screenshot-desktop.jpg)

<img src="docs/screenshot-phone.jpg" alt="Mobile view of The School website" width="300">

## Run it locally

You need Python 3 and a modern browser with WebGL support. From the repository root:

```sh
python3 -m http.server 8013
```

Then open [http://localhost:8013](http://localhost:8013).

Use a local HTTP server rather than opening `index.html` as a `file://` URL. The page loads an ES module graph and a local GLB asset, both of which are more reliably served over HTTP. The pinned Three.js runtime is vendored in the repository, so the page has no production CDN dependency.

There is nothing to install and nothing to compile.

## Repository map

| Path | Purpose |
| --- | --- |
| [`index.html`](index.html) | All markup, styles, shaders, Three.js scene setup, animation, and responsive behavior. |
| [`public/school.glb`](public/school.glb) | Baked building and neighboring street geometry used by the 3D scene. |
| [`public/vendor/three/`](public/vendor/three/) | Minimal vendored dependency graph from the official `three@0.160.0` package, including its MIT license. |
| [`DESIGN.md`](DESIGN.md) | Visual thesis, lighting rules, rendering pipeline, and design decisions. |
| [`TODO.md`](TODO.md) | Deferred content and maintenance work. |
| [`docs/`](docs/) | Reference screenshots for desktop and phone layouts. |
| [`scripts/check-release.mjs`](scripts/check-release.mjs) | Dependency and Content Security Policy integrity check. |
| [`vercel.json`](vercel.json) | Zero-build Vercel configuration; the repository root is the output directory. |

## How the page works

The experience is split into two layers:

1. A fixed, full-viewport WebGL canvas renders the procedural chromatic field, clipped building island, contact shadow, bloom, tone mapping, vignette, grain, and subtle chromatic aberration.
2. A regular HTML layer renders the header, Brooklyn clock, tagline, and four accessible navigation links above the canvas.

One world-space key light drives the building shading, signal-mint rim, field highlight, bloom peak, and card specular position. The camera orbits the stationary model, slowing around the facade and accelerating across the back. On lower-power or coarse-pointer devices, the renderer reduces pixel ratio and bloom resolution, disables antialiasing and chromatic aberration, and keeps the same composition at a lower cost.

The implementation also respects `prefers-reduced-motion`: the orbit stops, animation transitions are removed, and the scene settles immediately into its lit state.

See [`DESIGN.md`](DESIGN.md) for the rationale behind the palette, door marks, island crop, and rejected effects.

## Common edits

Everything below is in [`index.html`](index.html):

- **Page title and description:** edit the `<title>` and description `<meta>` elements in `<head>`.
- **Identity and address:** edit the `#brand` header.
- **Tagline:** edit the paragraph inside `#copy`.
- **Destination labels and URLs:** edit the four anchors inside `#links`. Art Philanthropy currently uses `href="#"` to remain on this page until its final destination is chosen.
- **Palette and spacing:** edit the custom properties at the top of the `<style>` block.
- **Camera and lighting:** edit `FRONT`, `orbit`, `KEY`, and the `fit()` logic in the module script.
- **Island crop:** edit `ISLAND_R`; the framing and plinth are derived from it.

The page uses hashed inline CSS and scripts in both its CSP meta element and Vercel response header. After changing the `<style>`, import map, or module script, run `node scripts/check-release.mjs`. If the check reports a stale hash, recompute it and update both `index.html` and `vercel.json` before deployment.

Keep the site deliberately single-purpose. The visual system is built around “one light, one image,” so new animations, effects, and accents should be evaluated against that constraint rather than added independently.

## Replacing the 3D model

The current `public/school.glb` is a baked photogrammetry export with surrounding geometry already cut down. The loader expects meshes with usable UVs and texture maps; missing normals are generated at runtime.

If the model changes:

1. Export it as a binary glTF file at `public/school.glb`.
2. Keep the model near its authored world coordinates; the page derives its floor, rooftop centroid, target, and framing from the loaded bounds.
3. Check the circular crop and plinth edge at desktop and phone sizes.
4. Check the facade during both the slow front orbit and the fast back orbit.
5. Update the screenshots in `docs/` if the visible result changed materially.

The existing model was baked from a local prototype using Google Earth-derived imagery. Its source is disclosed in the page footer. If the model is replaced later, use owned or explicitly licensed capture and preserve any attribution required by the replacement source.

## Verification checklist

Before pushing a visual or content change:

1. Start the local server and load the page without console errors.
2. Confirm `public/school.glb` returns HTTP 200 and the building appears.
3. Check a wide desktop viewport and a narrow phone viewport.
4. Confirm the tagline and all four door labels remain readable without clipping.
5. Test keyboard focus on each door and verify any configured destination URLs.
6. Test with reduced motion enabled.
7. Run `node scripts/check-release.mjs` to validate vendored imports and CSP hashes.
8. Run `git diff --check` to catch whitespace errors.
9. Refresh once with the network cache disabled when changing shaders, imports, or the GLB asset.

There is currently no automated test suite. Browser verification is the source of truth for this graphics-heavy static page.

## Deployment

The site can be deployed to any static host that serves the repository root. For Vercel, [`vercel.json`](vercel.json) declares the root as the output directory, enables clean URLs, and sets CSP, framing, referrer, permissions, MIME-sniffing, cross-origin, and transport-security headers. No build command is required.

Other hosts should reproduce those response headers. The page also carries a matching CSP meta element so the core script and style restrictions remain active during ordinary static hosting.

## Deferred launch work

- Connect the intentionally inactive Art Philanthropy card once its final URL is known.
- Confirm the intended production domain and canonical metadata.
- Add an absolute social-sharing image URL once the production domain is known.
- Recheck the desktop and phone screenshots against the final copy and model.

## License and asset reuse

The project’s original source code is available under the [MIT License](LICENSE). Vendored dependencies retain their respective licenses; Three.js includes its own MIT license in [`public/vendor/three/LICENSE`](public/vendor/three/LICENSE). The MIT license does not relicense the GLB model, screenshots, branding, or other media assets.

## Design intent

The page is not a general site template. It is a focused portrait of a place: a fixed light, a moving point of view, a clipped photogrammetry island, and four doors into the larger project. Preserve that hierarchy when maintaining it—the building is the image, the light is the event, and the interface stays quiet.
