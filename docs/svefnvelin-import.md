# Svefnvélin web import

Source: https://github.com/eliasoli09/svefnvelin

Source commit: `ea29f08f01d512ddd3986d392cca27dcac5c4715`.

`public/projects/svefnvelin/` contains the current `vefur/` app, with its HTML,
CSS, JavaScript, data, images, videos, and models copied without modification.
The only omitted file inside `vefur/` is the macOS Finder alias `Macintosh HD`.
The desktop launcher and `eldri-utgafa/` are not part of the web deployment.
`preview.png` is a browser screenshot added for the project gallery.

`/verkefni/svefnvelin` uses the existing `ProjectEmbed` component at full viewport
size, preserving the original app styling and controls. The original document
is also available at `/projects/svefnvelin/index.html`.

To update, copy the current `vefur/` contents again, excluding OS files, retain
or refresh the gallery screenshot, and record the new source commit here.
Verify copied files against the source and check all seven navigation sections,
episode/transcript search, video playback, anatomy model loading, text density,
and the mobile viewport before deploying. Keep upstream attribution intact.
