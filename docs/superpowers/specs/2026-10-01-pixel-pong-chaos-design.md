# Pixel Pong — round 3: roster, boosts, pins, slime (design)

Approved 2026-10-01. Builds on the spin design (`2026-09-27-pixel-pong-spin-design.md`).

## Characters (5)
- Claude, Codex, plus **Muse** (fluffy beige creature, face with blush), **Grok** (white sphere, two tall oval eyes) and **Clawd** (round red body, antennae, cyan eyes, mitten arms) — voxel models from pixel grids.
- Optional per-cell depth (`depthAt`) makes Grok a real voxel sphere and gives Clawd a rounded body, so they don't look like flat slabs when they spin.
- Menu: a **YOU** row and an **OPPONENT (AI)** row of 5 cards each. Your own fighter is disabled in the opponent row; picking the current opponent as yourself swaps them. Both picks are remembered.

## Boosts (earned every 3rd spin shot in a row, random of 4)
- BIG PADDLE (8 s), SLOW-MO (5 s) — unchanged.
- **TRIPLE BALL** (shot boost) — your next hit splits into the real ball + 2 identical fakes, fanned ±0.42 rad. Fakes share the ball's materials (same colour/glow/trail), use the shared integrator (rails, pins, spin), ignore paddles, never score, and pop at the far paddle plane (or after 3 s / when the point ends). The AI first chases the real ball only 34 / 45 / 60 % of the time (Easy / Normal / Hard) and switches when it "notices" (same notice point as spin).
- **FIREBALL** (shot boost) — your next hit flies 1.6× faster (capped at 1.5× the difficulty's max speed), orange with a flame-spark trail.
- Shot boosts start on the hit *after* the one that earned them; the HUD chip reads "… - NEXT HIT".

## Pins
- Count round trips over the whole match (2 paddle hits = 1). After **5 round trips** 2 pins rise; **+1 every 3 round trips**, max 6. They stay until the match ends (menu demo uses the same rule).
- Placement: |x| ≤ 3.2, |z| ≤ 3.6, ≥ 1.5 from the serve spot, clear of the net, ≥ 2 apart, not under the ball or a fake.
- Collision lives in the shared `integrate()`, so the game, the fakes and the AI's prediction agree. Reflection keeps speed; **pins bend the ball sideways but never send it back toward the hitter** (found in testing: two pins could otherwise trap the ball in a ping-pong loop), and |vz| stays ≥ 0.6·speed.
- Pins glow mint (Vibe Ísland green), rise with an ease-out-back, flash and ping when hit.

## Slime
- When a point ends, the loser gets slimed in the **winner's** colour: a glob falls onto the character, splats into a wobbling dome, drips run down, everything fades by 1.6 s.
- When **you** lose a point, slime also pours down your screen (SVG drips, CSS animation, shorter with reduced motion).

## Testing
- `tests/pixel-pong-chaos-browser.py` (Playwright via `?debug` / `window.__pong`): all 20 you/opponent pairings, nobody faces itself, disabled own card; 15 simulated minutes with pins — no invalid ball states, longest flight < 3 s, pins at trips 5/8/11, cap 6; TRIPLE BALL spawns exactly 2 fakes per shot and every fake pops; FIREBALL ≥ 1.4× faster; slime goes to the loser in the winner's colour, both ways.
- `tests/pixel-pong-spin-browser.py` still passes; static checks in `app/verkefni/verkefni.test.mjs`.
