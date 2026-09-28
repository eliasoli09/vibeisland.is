# Verification record

Run on 2026-09-28 against the local static site in Google Chrome using Playwright.

- Pure scenario tests: four passed; all 18 dose-duration combinations, bounded illustrative storage, plateau instead of indefinite extrapolation, persistent high-dose warning, no numeric cognitive or mass prediction, invalid input rejection.
- Browser journey: all 18 scenarios, all three anatomical views, all four muscle mechanisms and all four brain steps, rested/sleep context, dialog open/close, timeline playback, comparison, mobile viewport and reduced motion passed. Zero captured browser page/console errors.
- No horizontal document overflow at 1440px or 390px.
- Screenshots of body, cell, brain and mobile views visually inspected.
- WebMCP is progressively enhanced. Native document.modelContext is unavailable in the installed Chrome, so native WebMCP runtime validation is unavailable. This does not affect visible controls.
- Validation establishes software behavior only. It does not validate the illustrative storage curve, geometry deformation, anatomy, or individual medical outcomes.
- Pixel comparison confirms body and brain animations change while running and remain identical across captured frames when paused.
- Independent read-only review found no blocking causal/evidence or code issues. Minor camera-pause and brain-context focus observations were corrected.

## GitHub integration — 2026-09-28

The simulator is packaged at `vefur/kreatin/` in `eliasoli09/svefnvelin`. Browser tests reran against `/kreatin/` on the shared Svefnvélin server: all 18 scenarios, three views, mechanisms, dialogs, timeline, comparison, mobile layout and reduced motion passed with zero captured errors. Source asset SHA-256 hashes and decompressed geometry sizes matched the delivery manifest. Navigation in both directions and existing Svefnvélin section navigation were checked separately.

## Project 4 theme and production build — 2026-09-28

The simulator now uses Svefnvélin navy, gold and ice colors. Explicit `index.html` links support Next.js public-file serving. The scientific model and source asset files are unchanged.

- Scenario tests: 4 passed.
- Full simulator browser journey against the Next.js production server: all 18 scenarios and existing interaction checks passed.
- Actual Project 4 iframe journey: simulator navigation, return link and existing section navigation passed. Computed navy and gold theme values matched. No mobile overflow or captured page errors.
- Desktop, brain and mobile screenshots were visually inspected.
- Vibe Ísland production build and all 14 project tests passed.

Results and theme screenshots are stored in `docs/validation/project4-*`.
