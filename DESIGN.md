# Design notes

Thesis: one light, one image. The building, the chromatic field, and the four doors all obey a single key
light (world dir `KEY` in index.html). The camera orbits; the light does not, so once per revolution
(~70 s) the building passes in front of the light and the signal-mint rim, bloom, field lobe and card
speculars lift together. That is the signature moment; nothing else on the page animates on its own.

Palette: schoolhouse black #111713, paper #f4f2ec, utility grey #afb6af, signal mint #7eff97,
cobalt #4e5bff, coral #ff6650, and amber #f2cd4f. The paper cards and black Join card borrow the
institutional clarity of the current theoldschool.nyc identity; the animated multi-pigment field is the
counterweight that keeps this experience from inheriting that site's flat concrete background.

The background is a slowly flowing architectural registration field. Warped contour lines make it feel
drawn rather than like a generic gradient, while the mint, cobalt, and coral channels literalize the
project's meeting of technology and art. Door registration stripes reuse those pigments as navigation
signals; Join is the one reversed card.

Why no numbering on the links: the four destinations are not a sequence. Each door carries a small
engraved mark instead: plan-with-door (a place), circle+line+dot and circle+stroke (two kinds of giving,
siblings), bare plus (the invitation).

Removed on purpose (Chanel rule): per-card colored pointer glows; the second background canvas and its
own vignette+grain (now one grade pass); drag/zoom interaction; the "drag to look around" hint.

Pipeline: field shader -> half-res RT -> scene.background -> RenderPass -> UnrealBloom (threshold .9, only
the rim and the field core cross it) -> OutputPass (ACES) -> grade (vignette, luminance-weighted grain,
tiny chromatic aberration, off on mobile). Contact shadow baked once at load from a depth render below.
Mobile (`LOW`): DPR 1.5, quarter-res bloom, no CA, no antialias.

Tried and rejected: wet-slate Reflector floor (fights the cut-out street geometry), depth of field
(double blur under the glass cards), fog (desaturates a fully-fit object).

## Island (added after the "still looks bad" pass)
The photogrammetry's ragged edges were the real problem, not the lighting. The model is now clipped in
the fragment shader to a disc of radius `ISLAND_R` (23 world units) around the centroid of the rooftops,
and to everything above street level; it sits on a charcoal plinth disc with a baked contact shadow confined
to the same disc. Because the island radius is known, the camera frames it exactly on any stage size
(`fit()`), which is what finally made it fill a phone screen without guessing.
