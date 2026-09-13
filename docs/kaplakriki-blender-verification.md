# Kaplakriki Blender integration — 13 September 2026

The default island in `/verkefni/vallaeyjar` now uses the Blender reconstruction from `Kaplakrikavollur.blend`, exported by `scripts/export_kaplakriki.py`. The original Blender file is read without being saved or changed.

## Delivered geometry

- 105 × 68 metre playing area; 3,050 spectator seats and 28 team seats.
- Both stands, five-wave canopy, steel structure, goals/netting, signs, adjoining halls and trees.
- Roads, car parks, parked vehicles and the rectangular site slab are excluded. The existing island supplies the terrain.
- 3,957 source objects become 83 instanced batches, with 241,592 unique vertices and 1,247,794 rendered triangles.
- Seats retain their curved profiles with nearly coplanar faces dissolved. Repeated lettering shares geometry at different scales. 40% of leaf geometry is retained and subpixel drain grating bars are omitted.
- The public JSON is also a portable stadium-islands v1 package. The download button uses compact JSON so the result remains below the existing 25 MB import limit.

## Viewer integration

`blender-model.js` handles the exported meshes, per-material colors, recreated mowing stripes and embedded official FH crest. The original renderer and model template remain for existing parametric imports. Optional UV and image data are validated before rendering. Perspective clipping adapts to viewing distance so thin pitch and roof surfaces remain stable.

Geographic source attribution is included in the downloadable model metadata. Architectural heights and some details remain photographic estimates; this is not a surveyed as-built model.

## Verification

- Production build passed with TypeScript checking and all routes generated.
- ESLint and all 32 Node tests passed in the isolated deployment checkout.
- The full Chromium browser regression passed against the production server: navigation, reload, new-model metadata, 3,050 seats, no roads/parking, layer toggles, Top/Side, orbit tour, keyboard drone, zoom and all quality modes.
- The new model was downloaded and reimported successfully within the 25 MB limit; duplicate-island detection worked. Example import, export, IndexedDB persistence, clipboard, fullscreen and cached-route return passed.
- Mobile tests passed at 390×844, 768×1024 and 844×390, including touch orbit, pinch, drone controls, import and storage. No browser console errors occurred.
- Desktop and mobile screenshots were visually inspected. The project preview was captured from the actual running viewer.
- These were Chromium tests with emulated mobile viewports, not physical Safari/iOS tests.

The development server was run with the bundled Node 24.19.0 runtime after the system Node 26.3.0 process stalled during compilation. Publication is prepared from the existing remote main branch so older unpublished local commits are not included.
