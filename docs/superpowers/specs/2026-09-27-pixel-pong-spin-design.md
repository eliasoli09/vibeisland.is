# Pixel Pong — spin shots & power-ups (design)

Approved 2026-09-27. Builds on `2026-09-26-pixel-pong-design.md`.

## Player spin (timed tap)
- Input: `pointerdown` on the game canvas (mouse click, trackpad tap, touch) or `Shift`. HUD buttons don't count.
- A tap is remembered with the sim clock. When the ball reaches the player's paddle, the hit is a **spin shot** if the tap happened within the last **0.33 s**. Otherwise it's a normal hit.
- Curve direction: the paddle's movement direction at contact; if the paddle is still, away from the opponent's paddle.
- Feedback: "SPIN!" / "SPIN x2/x3" pop, whoosh sound, paddle flashes on every tap, ball + trail tinted by level (cyan → purple → pink).

## Spin levels & streak
- Each consecutive player spin shot raises the streak; spin level = min(streak, 3). Curve strength per level: 5.5 / 8 / 11 units/s² sideways.
- A normal (untimed) return or losing a point resets the streak.
- Every 3rd consecutive spin shot (3, 6, 9 …) awards a random power-up (one active at a time, a new one replaces the old):
  - **BIG PADDLE** — player paddle 1.5× wider for 8 s.
  - **SLOW-MO** — balls travelling toward the player move at 65 % speed for 5 s.
- HUD (bottom-left): 3 pips showing progress to the next power-up, coloured by spin level; power-up chip with a countdown bar.

## Physics (glitch-resistant)
- One shared integrator `integrate(state, dt)` used by the game **and** the AI's prediction, so they can never disagree.
- Curve = constant sideways acceleration; speed is preserved; |vx| ≤ 0.8·speed so |vz| ≥ 0.6·speed (no stalled rallies).
- Rail bounce flips and halves the curve so the ball can't hug a rail.
- Curve clears on every paddle hit (replaced by the new shot's spin) and on every serve.

## AI
- Prediction simulates forward with `integrate`. Until the AI *notices* the spin it commits to the straight path it saw leave the paddle (the launch state), not the ball's current bending direction. It notices after a share of the flight: Easy 80 %, Normal 68 %, Hard 58 %; then it predicts the true curve and can often still recover — harder, not impossible.
- Measured (AI return rate, plain → level 3): Normal ≈ 0.92 → 0.70, Hard ≈ 0.97 → 0.83, Easy ≈ 0.80 → ~0.55–0.7.
- Extra aim error ±0.25 × spin level when receiving spin.
- AI hits spin shots too: Easy 0 %, Normal 20 %, Hard 40 % of hits, level 1–2. The player sees an "INCOMING SPIN" pop.

## Visual fix found during testing
- The table top was glossy enough to mirror the far character's point light as a bright blob at the net that looked like a second ball. The table is now matte (roughness 0.7).

## Testing
- `?debug` exposes `window.__pong`:
  - `sim(seconds, opts)` — headless AI-vs-AI run; returns invariant violations (`bad`: non-finite or off-table ball), longest rally, points, and return/miss counts per spin level.
  - `simPlayer(seconds, opts)` — scripted player that tracks the ball and taps `opts.tapAt` seconds before contact; returns spin shots, max streak, power-ups awarded (`keep: true` leaves the match running).
  - `set({ spinP, forceLevel, autoPlayer })` — live overrides for visual checks.
- `tests/pixel-pong-spin-browser.py` (Playwright) asserts: no invariant violations, rallies always end, timed taps build streaks and award power-ups, early taps don't spin, and spin measurably lowers the AI's return rate without making it zero.
- Static checks in `app/verkefni/verkefni.test.mjs`.
