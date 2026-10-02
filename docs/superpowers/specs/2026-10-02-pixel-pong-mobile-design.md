# Pixel Pong — mobile (design)

Approved 2026-10-02.

## Problems found on an emulated iPhone 13 (live site)
- **Menu cut off:** the overlay centred its panel with `align-items: center`, so the top of a panel taller than the screen couldn't be reached. On phones the title and the PING PONG / AIR HOCKEY switch were unreachable, and in landscape so was START MATCH.
- **Projects page scroll trap:** the inline game card nearly fills a phone screen and swallowed swipes, so the page couldn't be scrolled past it.
- **Mouse-only controls:** absolute pointer mapping put the finger on top of the paddle or mallet, and every touch start triggered a spin tap.
- **Small table in portrait:** the table used about a third of the screen.

## Design
- **Projects page:** `ProjectPlay` (client) uses `useSyncExternalStore` + `matchMedia('(pointer: coarse), (max-width: 767px)')`.
  - Phones and tablets get the preview image with a **▶ SPILA** link to `/verkefni/pixel-pong`.
  - Desktops get the inline game.
  - The server renders the light preview first; on phones the iframe never loads.
- **Game page:** slim one-line header on phones (back link + title); the game fills the rest of the screen.
- **Menu:** `.overlay` uses `align-items: flex-start` with `margin: auto` on the panel (centred when it fits, scrollable when it doesn't).
  - The menu goes compact at ≤ 600 px wide or ≤ 540 px tall: 5 small cards per row.
  - In short landscape, the YOU and OPPONENT rows sit side by side.
  - Touch wording replaces mouse wording (`.h-touch` / `.h-mouse`, `body.touch`).
- **Touch controls:** drag anywhere, relative to the finger's movement (gain 1.35).
  - **Ping Pong:** pixels are converted to table units at the paddle's depth.
  - **Air Hockey:** the finger's movement is projected onto the table, in both x and z, starting from where the mallet is.
  - The mouse stays absolute.
  - **Ping Pong spin:** a round **SPIN** button (bottom-right), or a second finger. Touch starts no longer trigger spin.
  - On touch screens, pause and sound sit under the scoreboard.
- **Camera:** wide screens (aspect ≥ 1.35) keep the classic view. Taller screens interpolate the camera's elevation from 24° to 56° and pick the closest distance at which the table corners, both characters and room for the scoreboard fit on screen. It re-fits on resize and rotation.
- **Polish:**
  - no overscroll, text selection or tap highlight
  - `touch-action: manipulation` on buttons
  - device pixel ratio capped at 1.5 on coarse pointers

## Testing — `tests/pixel-pong-mobile-browser.py` (iPhone 13 portrait + landscape, real touch events via CDP)
- **Menu:** touch detected, touch hints shown, every menu control tappable.
- **Ping Pong:**
  - the table is fully on screen, and in portrait it fills ≥ 45 % of the height
  - the SPIN button is shown and arms a spin
  - a drag with the finger far to the left still moves the paddle right
- **Air Hockey:** no SPIN button; a drag moves the mallet in x and z.
- **With SITE_URL:**
  - phones get SPILA and no iframe
  - swiping over the card scrolls the page
  - SPILA opens the game, which fills ≥ 80 % of the screen
  - desktop still embeds the game inline
