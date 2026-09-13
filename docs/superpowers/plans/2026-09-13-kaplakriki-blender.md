# Kaplakriki Blender model in Vallaeyjar

**Goal:** Replace the default Kaplakriki island model with the new Blender reconstruction, omitting surrounding roads, parking and vehicles.

**Architecture:** Export the saved Blender meshes into the existing portable `.stadium` format, using shared seat/tree meshes and merged static geometry. Keep the original Blender deliverable intact. Add a small renderer adapter for exported vertex normals, material colors and FH crest UVs, and load the default model from a separate local asset. Existing island import, storage, controls and routes remain in use.

**Tech stack:** Blender Python API, existing bundled Three.js, Next.js public assets, Node tests and Python Playwright.

- [x] Add asset acceptance checks and confirm the new asset is absent.
- [x] Export geometry in metres with Blender `(x,y,z)` mapped to viewer `(x,z,-y)`. Exclude collection 14, parked vehicles, parking lights and the rectangular site-ground slab; use the viewer's island terrain. Include both stands, individual seats, wave canopy, nets, signage, adjoining halls and planting. Merge static objects by viewer layer and material; retain repeated seats and trees as instances.
- [x] Add a readable renderer adapter, preserving normals, colors and embedded crest, with bounded optional-data validation. Load the new asset before viewer initialization and show a useful error on load failure. Keep the existing renderer for legacy/imported models.
- [x] Run asset tests, production build and lint. Run the existing browser regression, inspect desktop/mobile views and refresh the project preview from the running viewer.
- [ ] Record verification and publish through the site's existing deployment route if available; verify the live model asset before reporting publication.

The existing project is named Vallaeyjar. The user's singular reference is interpreted as that project's island, not a request to rename its route. The model is a photo/GIS reconstruction with documented estimated dimensions.
