# Design notes

Thesis: one light, one image. The building, the ink field, and the four doors all obey a single key
light (world dir `KEY` in index.html). The camera orbits; the light does not, so once per revolution
(~70 s) the building passes in front of the light and the brass rim, bloom, ink lobe and card speculars
lift together. That is the signature moment; nothing else on the page animates on its own.

Palette: slate #0a0d12, chalk #ece6da, chalk-2 #9a948a, brass 214,178,110 (the only accent).
Door tints are the ink shader's own constants (verdigris / brass / oxblood); Join is the one lit door.

Why no numbering on the links: the four destinations are not a sequence. Each door carries a small
engraved mark instead: plan-with-door (a place), circle+line+dot and circle+stroke (two kinds of giving,
siblings), bare plus (the invitation).

Removed on purpose (Chanel rule): per-card colored pointer glows; the second background canvas and its
own vignette+grain (now one grade pass); drag/zoom interaction; the "drag to look around" hint.

Pipeline: ink shader -> half-res RT -> scene.background -> RenderPass -> UnrealBloom (threshold .9, only
the rim and the ink core cross it) -> OutputPass (ACES) -> grade (vignette, luminance-weighted grain,
tiny chromatic aberration, off on mobile). Contact shadow baked once at load from a depth render below.
Mobile (`LOW`): DPR 1.5, quarter-res bloom, no CA, no antialias.

Tried and rejected: wet-slate Reflector floor (fights the cut-out street geometry), depth of field
(double blur under the glass cards), fog (desaturates a fully-fit object).

## Island (added after the "still looks bad" pass)
The photogrammetry's ragged edges were the real problem, not the lighting. The model is now clipped in
the fragment shader to a disc of radius `ISLAND_R` (23 world units) around the centroid of the rooftops,
and to everything above street level; it sits on a slate plinth disc with a baked contact shadow confined
to the same disc. Because the island radius is known, the camera frames it exactly on any stage size
(`fit()`), which is what finally made it fill a phone screen without guessing.
