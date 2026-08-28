# The Old School Website

Preserved standalone website for **The School**, 29 Nassau Avenue in Williamsburg, Brooklyn. The page combines a full-screen Three.js scene of the building with a small semantic HTML overlay for the identity, tagline, and four destination links.

This repository is intentionally small: there is no framework, package manager, or build step. The complete page lives in [`index.html`](index.html), and the baked building scan lives in [`public/school.glb`](public/school.glb).

## Project status

This is the preserved legacy School experience, separated from the newer Grove Marketplace codebase. It is useful as a working visual prototype and historical implementation, but it is not ready for a public launch: the four destinations are not connected and the model attribution remains unresolved.

![Desktop view of The School website](docs/screenshot-desktop.jpg)

<img src="docs/screenshot-phone.jpg" alt="Mobile view of The School website" width="300">

## Run it locally

You need Python 3 and a modern browser with WebGL support. From the repository root:

```sh
python3 -m http.server 8013
```

Then open [http://localhost:8013](http://localhost:8013).

Use a local HTTP server rather than opening `index.html` as a `file://` URL. The page loads an ES module graph and a local GLB asset, both of which are more reliably served over HTTP. Three.js `0.160.0` and its example modules are loaded from jsDelivr at runtime, so the first page load also requires an internet connection.

There is nothing to install and nothing to compile.

## Repository map

| Path | Purpose |
| --- | --- |
| [`index.html`](index.html) | All markup, styles, shaders, Three.js scene setup, animation, and responsive behavior. |
| [`public/school.glb`](public/school.glb) | Baked building and neighboring street geometry used by the 3D scene. |
| [`DESIGN.md`](DESIGN.md) | Visual thesis, lighting rules, rendering pipeline, and design decisions. |
| [`TODO.md`](TODO.md) | Remaining work that must be resolved before public release. |
| [`docs/`](docs/) | Reference screenshots for desktop and phone layouts. |
| [`vercel.json`](vercel.json) | Zero-build Vercel configuration; the repository root is the output directory. |

## How the page works

The experience is split into two layers:

1. A fixed, full-viewport WebGL canvas renders the procedural ink field, clipped building island, contact shadow, bloom, tone mapping, vignette, grain, and subtle chromatic aberration.
2. A regular HTML layer renders the header, Brooklyn clock, tagline, and four accessible navigation links above the canvas.

One world-space key light drives the building shading, brass rim, ink highlight, bloom peak, and card specular position. The camera orbits the stationary model, slowing around the facade and accelerating across the back. On lower-power or coarse-pointer devices, the renderer reduces pixel ratio and bloom resolution, disables antialiasing and chromatic aberration, and keeps the same composition at a lower cost.

The implementation also respects `prefers-reduced-motion`: the orbit stops, animation transitions are removed, and the scene settles immediately into its lit state.

See [`DESIGN.md`](DESIGN.md) for the rationale behind the palette, door marks, island crop, and rejected effects.

## Common edits

Everything below is in [`index.html`](index.html):

- **Page title and description:** edit the `<title>` and description `<meta>` elements in `<head>`.
- **Identity and address:** edit the `#brand` header.
- **Tagline:** edit the paragraph inside `#copy`.
- **Destination labels and URLs:** edit the four anchors inside `#links`. Their current `href="#"` values are placeholders and must be replaced before launch.
- **Palette and spacing:** edit the custom properties at the top of the `<style>` block.
- **Camera and lighting:** edit `FRONT`, `orbit`, `KEY`, and the `fit()` logic in the module script.
- **Island crop:** edit `ISLAND_R`; the framing and plinth are derived from it.

Keep the site deliberately single-purpose. The visual system is built around “one light, one image,” so new animations, effects, and accents should be evaluated against that constraint rather than added independently.

## Replacing the 3D model

The current `public/school.glb` is a baked photogrammetry export with surrounding geometry already cut down. The loader expects meshes with usable UVs and texture maps; missing normals are generated at runtime.

If the model changes:

1. Export it as a binary glTF file at `public/school.glb`.
2. Keep the model near its authored world coordinates; the page derives its floor, rooftop centroid, target, and framing from the loaded bounds.
3. Check the circular crop and plinth edge at desktop and phone sizes.
4. Check the facade during both the slow front orbit and the fast back orbit.
5. Update the screenshots in `docs/` if the visible result changed materially.

The existing model was baked from a local source at `~/29-dobbin-content/site/building.html`. Its Google Earth tile-data attribution or replacement must be resolved before public release; see [`TODO.md`](TODO.md). Do not assume the asset is cleared for redistribution merely because it is present in this private repository.

## Verification checklist

Before pushing a visual or content change:

1. Start the local server and load the page without console errors.
2. Confirm `public/school.glb` returns HTTP 200 and the building appears.
3. Check a wide desktop viewport and a narrow phone viewport.
4. Confirm the tagline and all four door labels remain readable without clipping.
5. Test keyboard focus on each door and verify every real destination URL.
6. Test with reduced motion enabled.
7. Run `git diff --check` to catch whitespace errors.
8. Refresh once with the network cache disabled when changing shaders, imports, or the GLB asset.

There is currently no automated test suite. Browser verification is the source of truth for this graphics-heavy static page.

## Deployment

The site can be deployed to any static host that serves the repository root. For Vercel, [`vercel.json`](vercel.json) declares the root as the output directory and enables clean URLs; no build command is required.

The browser must be able to reach jsDelivr in production because Three.js is imported from the CDN. If the site needs to work offline or under a restrictive Content Security Policy, vendor the pinned Three.js modules locally and update the import map before deployment.

## Before a public launch

- Replace all four placeholder `href="#"` destinations.
- Resolve and document the GLB imagery attribution noted in [`TODO.md`](TODO.md).
- Confirm the intended production domain and canonical metadata.
- Add a favicon and social-sharing image if the page will be shared publicly.
- Recheck the desktop and phone screenshots against the final copy and model.

## License and asset reuse

No open-source license is currently included. Do not treat the source or bundled media as licensed for reuse outside this project. The GLB’s imagery provenance and attribution requirements must be resolved separately before redistribution or public deployment.

## Design intent

The page is not a general site template. It is a focused portrait of a place: a fixed light, a moving point of view, a clipped photogrammetry island, and four doors into the larger project. Preserve that hierarchy when maintaining it—the building is the image, the light is the event, and the interface stays quiet.
