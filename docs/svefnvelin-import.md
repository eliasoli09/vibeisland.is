# Svefnvélin web import

Source: https://github.com/eliasoli09/svefnvelin

Source commit: `f92f24beecb09dd46c3560bc0ab171f5ff5d84b7`.

`public/projects/svefnvelin/` contains the tracked `vefur/` app: HTML, CSS,
JavaScript, research data, images, videos, models and the complete creatine
simulator. Files match this source commit byte for byte. The macOS Finder
alias `Macintosh HD` is omitted. The desktop launcher and `eldri-utgafa/`
are not part of the web deployment. `preview.png` is the retained gallery image.

`/verkefni/svefnvelin` uses `ProjectEmbed` at full viewport size. The main
static document is `/projects/svefnvelin/index.html`; its Kreatínhermir
navigation link opens `/projects/svefnvelin/kreatin/index.html` inside the
same iframe. The simulator return link opens the main static document.
Explicit index filenames are required by Next.js public-file serving.

The simulator shares Svefnvélin colors: navy `#080e1a`, gold `#e8b464` and
ice `#9fd0e8`. This theme affects controls, cell/brain graphics and Three.js
materials; the scientific model and source anatomical geometry are unchanged.

Validation on 2026-09-28:
- Production `npm run build` passed, including TypeScript and static generation.
- All 14 project route tests passed.
- All four scenario tests and the full browser journey across 18 simulator
  scenarios passed against the Next.js production server.
- The actual Project 4 iframe journey verified simulator navigation, return
  navigation, existing section navigation and computed theme values.
- No mobile horizontal overflow or captured page errors; desktop, brain and
  mobile screenshots were visually inspected.
- Detailed simulator evidence is in `kreatin/docs/VALIDATION.md` and
  `kreatin/docs/validation/project4-*` within the imported directory.

To update, copy tracked `vefur/` files from the source repository, excluding
OS files, retain or refresh the gallery screenshot, and record the source
commit here. Check navigation in both directions, simulator behavior, existing
Svefnvélin features and mobile layout. Keep upstream attribution intact.
