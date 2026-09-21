# Laugardalsvöllur island

Public URL: https://www.vibeisland.is/verkefni/vallaeyjar?eyja=laugardalsvollur

The delivered Laugardalsvollur.blend is the source. Run Blender in background with that file and `--python scripts/export_laugardalsvollur.py`. The exporter does not save or change the source blend. Its SHA-256 is embedded in the package metadata. Original XYZ becomes browser YZX (pitch length, height, width), preserving metres and handedness. The pitch centre is eight metres west of the former centre.

All 9,636 model seats retain original positions, block/row/seat IDs and 1.15 m eye offsets. There are 6,136 west seats and 3,500 east seats. Target offsets are calculated relative to each seat's source transform, so both stands and rotated islands face the shifted pitch. Only the first material partition owns a seat record, avoiding duplicate IDs. Chair geometry is decimated to 32%; static geometry is merged by group/material. Outlying site objects are excluded from the floating island.

Export: 9.4 MB, 32 batches, 114,673 base vertices, 1,470,936 instantiated triangles. The source is a photo-referenced metric approximation, not a surveyed reconstruction. Source information and limitations are public in `laugardalsvollur-sources.html` and the viewer's assumptions panel.

Validation: `node --test tests/*.test.mjs`; `python3 tests/laugardalsvollur-browser.py` against a static server on port 8784 (override with VALLAEYJAR_URL); targeted ESLint; `npm run build`. Browser coverage includes actual seat clicks in both stands, fixed-position head rotation, roof restoration, existing island cards, direct links and mobile layout. Screenshots go to /tmp/laugardalsvollur-browser, overridable with VALLAEYJAR_ARTIFACTS.
