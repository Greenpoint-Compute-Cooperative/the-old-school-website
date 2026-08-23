# The School

Home page for The School, 29 Nassau Avenue, Williamsburg, Brooklyn. Destined for convent.lol.

![The School home page](docs/screenshot-desktop.jpg)

<img src="docs/screenshot-phone.jpg" alt="The School on a phone" width="300">

Static site: `index.html` + `public/school.glb`. No build step.

```
python3 -m http.server 8013   # then open http://localhost:8013
```

`public/school.glb` is the building mesh with the neighbouring structures already cut out
(baked from `~/29-dobbin-content/site/building.html`). Design rationale lives in `DESIGN.md`.
