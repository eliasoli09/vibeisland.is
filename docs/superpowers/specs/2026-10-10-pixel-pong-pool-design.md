# Pixel Pong: 8-ball pool

Fifth mode, **POOL**: 8-ball on a neon table, played 1 v 1 against an AI character. There's no 2 v 2 and no online play yet; the PLAY ONLINE button is hidden in this mode.

## Play
- **The rack:** 15 balls in a triangle on the foot spot, with the 8 in the middle and a solid and a stripe in the back corners. The cue ball starts on the head spot, and you break.
- **Groups:** the table is open until someone pots a ball without a foul. That ball's group (solids 1-7 or stripes 9-15) is theirs, and the other group goes to their rival.
- **Turns:** you keep shooting while you pot your own balls. Otherwise the table goes to your rival.
- **Fouls:** a scratch (the cue ball goes down), missing everything, or hitting the wrong ball first. The turn passes, and after a scratch the cue ball goes back on the head spot.
  - Simplified rules: there's no ball in hand.
  - A scratch gets the shooter slimed, and the AI taunts you when you foul.
- **The 8:** once your group is cleared, sink the 8 to win. Sinking it early, or scratching on it, loses. The 8 on the break wins.
- **Aiming and shooting:**
  - **Mouse:** move the mouse to aim (the cue follows). Press, pull back (the distance sets the power) and let go. A tiny pull does nothing.
  - **Touch:** a finger on the table aims; pull the **POWER** bar down and let go. The bar sits on the right on wide screens and under the table on tall ones.
  - **Keys:** ←/→ aim (Shift for fine aim), ↑/↓ set the power, Enter shoots.
- **The aim guide** shows the cue ball's path to a ghost ball where it makes contact. From there it shows where the object ball goes (in its colour) and where the cue ball glances off. The ghost ball turns red if that ball isn't yours.
- **HUD:** the score is how many balls of their group each player has potted. The line under it shows the groups and whose shot it is ("ON THE 8" once you're there), on phones too.

## How it works
- **Physics** (`plStep`):
  - 2D on the cloth: rolling friction plus drag, and substeps so no ball skips past another or a cushion.
  - Equal-mass ball collisions with restitution 0.95, and cushions as circle-vs-segment with restitution 0.78.
  - The cushions stop short of the pockets. A ball that crosses a cushion line can only be in a pocket's mouth, so it drops. A ball close to a corner drops too.
  - The break goes 35% faster than a full-power shot.
- **AI** (`plPlanStart` / `plPlanWork`, a couple of simulated shots per step so it never stalls a frame):
  - **Candidates:** for each legal ball and each pocket it aims at the ghost ball, at three powers, skipping cuts sharper than about 75°. It also tries 64 general shots for safeties.
  - **Scoring:** each shot runs with the same physics and is scored: own balls potted, fouls, the opponent's balls, and the leave. A good leave is clear shots at your own balls; on a miss it's leaving the rival nothing. The 8 is ±10000.
  - **Picking:** the best 5 are re-tried with small aim and power errors so the AI picks shots that still work. Then it adds error by difficulty: easy 0.03 rad / 15% (picks from its top 3), normal 0.014 / 10% (top 2), hard 0.006 / 6% (its best).
- **Measured (AI vs AI, pots per shot):** Easy ≈ 0.35, Normal ≈ 0.5, Hard ≈ 0.67. A rack is about 33 / 25 / 18 shots.
- **Camera:** looks down steeply from the long side on wide screens and from the end on tall ones, at the closest distance where the whole table fits next to the POWER bar.
- **Characters:** the shooter stands at the end of the cue and the other one watches from the far side. Nobody stands between the camera and the table, and both turn to face the camera.
- **Look:** a glowing blue cloth, cushions with light strips, a dark lacquered frame with LED edges and diamonds, and black pockets with glowing rims. The balls are numbered and roll as they move, and sink into the pockets. There is no bloom pass (unlike mini golf): it washed out the balls, and the neon trims glow enough without it.

## Tests
`tests/pool-browser.py`:
- the mode (1 v 1, no online) and the rack
- AI games on every difficulty: no ball gets through a cushion, overlaps another or goes NaN, every rack ends on the 8, and harder AIs pot more
- mouse aim and pull-back (a tiny pull doesn't shoot), keys, and on a phone a finger to aim and the POWER bar to shoot
- the rules: claiming a group, a wrong first ball, a scratch, the 8 too early, and winning on the 8
- the camera on wide and tall screens

Static checks are in `app/verkefni/verkefni.test.mjs`.
