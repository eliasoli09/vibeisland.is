# Kaplakriki seat views — 19 September 2026

Clicking any of the 3,050 spectator seat instances enters a fixed seated viewpoint. The camera uses the instance's complete world transform, with eyes 1.15 m above the terrace (0.72 m above the model's seat pan), looking toward the pitch. Seat and row numbers identify this reconstruction and do not claim to reproduce the venue's ticket numbering.

“Velja sæti” frames both stands from above and temporarily hides the roof. Entering a seat or changing views restores the previous roof visibility. The nearest visible raycast hit must be a seat, so walls, stairs and the pitch cannot accidentally become seats. Team benches are excluded.

Drag or use arrow keys to look around; scrolling adjusts the field of view. Movement keys do not move a seated camera. Escape, “Snúa” or “Til baka í yfirlit” returns to the overview. Presets, world navigation, drone and tour modes clear seated state.

Validation:

- 35 Node tests passed, including exact spectator counts, unique model seat labels across material batches, north/south camera transforms and invalid hit rejection.
- Production build (`next build --webpack`) passed; full ESLint and `git diff --check` passed.
- `tests/vallaeyjar-seats-browser.py` passed with actual canvas raycasts: both stands, black seats, north end short rows, desktop click/drag, mobile tap/drag, fixed position, arrow keys, Escape, return button, mobile view label, roof restoration and non-seat clicks. No browser console errors.
- Existing `tests/vallaeyjar-browser.py` passed against the production server: site navigation, model import/export, persistence, layer controls, camera modes, quality modes, clipboard, fullscreen, iframe shutdown and mobile layouts at 390×844, 768×1024 and 844×390. No browser console errors.
- Desktop and mobile screenshots visually inspected for both stands.

Run the seat browser test with `VALLAEYJAR_URL=http://localhost:3014 python3 tests/vallaeyjar-seats-browser.py` against a production server. Node tests use the bundled Node 24 runtime.
