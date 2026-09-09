# Vallaeyjar verification, 2026-09-09

Routes: `/verkefni`, `/verkefni/vallaeyjar`.
Static viewer: `/projects/vallaeyjar/viewer.html`.

## Results

- Production build and ESLint passed. All 34 local Node tests passed.
- `python3 tests/vallaeyjar-browser.py` passed against both development and production servers in Chromium.
- Tested desktop 1440x1000, phone 390x844, tablet 768x1024 and landscape 844x390.
- Menu navigation, index reload, direct project entry, project reload and cached-route return passed.
- Initial island chooser, Kaplakriki, Top, Side, orbit tour start/stop, keyboard drone flight, wheel zoom and all quality settings passed.
- Native file chooser opened; downloaded example was imported, exported unchanged and restored after page reload.
- Clipboard text matched the creator prompt; stadium and prompt downloads were verified.
- Fullscreen entry/exit passed inside the iframe. Canvas screenshot pixel checks confirmed visible pitch geometry after resizing.
- Phone touch drone controls, one-finger orbit, two-finger pinch, prompt copy, stadium import and reload persistence passed.
- Leaving the project blanks/removes the iframe. Returning starts a new viewer document and restores saved islands.
- No browser console errors or uncaught exceptions. A Next.js development warning about the existing smooth-scroll setting was observed.

The original viewer's inline JavaScript is unchanged, including geometry, branding, import validation, IndexedDB storage and controls. Its SHA-256 is `68ea02f481291e7b114779752abbd064963bcdc127515203455cb6c27e047be6`. The only HTML addition is a relative stylesheet link that keeps controls reachable on narrow screens.

These are Chromium browser tests with emulated viewport/touch settings, not physical-device Safari or Firefox tests. Private browsing, denied clipboard/fullscreen permissions or unavailable storage remain subject to the viewer's existing fallback messages.

## Maintenance

Add project metadata to `app/verkefni/projects.ts` and its page under `app/verkefni/`. The index maps the registry automatically. Keep HTML viewers and their assets in `public/projects/<slug>/`.

Run browser tests against an already running site; `VALLAEYJAR_URL` overrides localhost:3000. Tests create temporary browser contexts and downloaded files, so test islands never enter a visitor's saved collection. Set `CAPTURE_PREVIEW=1` only when intentionally refreshing the project-card screenshot.

Islands are private to each browser/origin. Users share them by downloading and sending `.stadium` files; opening the local file, localhost and the live domain each uses its own storage.
