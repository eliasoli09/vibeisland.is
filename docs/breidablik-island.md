# Eyja G — Kópavogsvöllur / Breiðablik

Adds the source Blender reconstruction as a public island labelled **EYJA G**. The direct URL is `/verkefni/vallaeyjar?eyja=G`; `?eyja=breidablik` also works. The same evaluated Blender geometry is converted from Z-up to Y-up with individual eye and target offsets for 1,733 seats (1,364 west, 369 east). The local .blend contains the wider mapped context; the floating island omits that context, cars and parking.

This is explicitly a photographic and map-based reconstruction, not surveyed 1:1 geometry or official ticket numbering. Sources and assumptions are published at `/projects/vallaeyjar/breidablik-sources.html`, with a downloadable editable Blender file.

Regenerate: `python3 scripts/export_breidablik.py /path/to/Breidablik_Blender`.

Validation: `node --test tests/*.test.mjs`, `python3 tests/breidablik-browser.py` against a static server on port 8780 (override VALLAEYJAR_URL), and `npm run build`. Browser tests click real seats in both stands, check fixed eye rotation, roof restoration, public card, direct link and 390-pixel layout. The source Blender file was reopened and its metric scale and native seat operator verified separately.
