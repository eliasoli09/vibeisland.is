# Pixel Pong: 9-hole neon mini golf

Fourth mode, **MINI GOLF**, played 1 v 1 against an AI character (no 2 v 2, no online yet). The inspiration was a blacklight neon course with a windmill and a loop, a giant clown mouth, and a winding outdoor course.

## Play
- **Turns:** on each hole you putt first; when you hole out (or reach 6 strokes, which scores 7), the AI plays the hole while you watch. Fewest strokes over the 9 holes wins.
- **After each hole:** the loser gets slimed in the winner's colour, and when the AI wins a hole it trash talks.
- **Slide aim:**
  - Press anywhere and drag back like a slingshot. The drag direction aims; its length (on screen, up to about 38% of the screen) sets the power.
  - A dotted line and a ring show the shot, going from green to red as the power rises. Letting go putts; a tiny drag does nothing.
  - Works with a mouse, a finger, or the arrow keys (aim / power) plus Enter.
- **Feedback:** HOLE IN ONE / BIRDIE / PAR / BOGEY pops up; the HUD shows the hole, par and whose shot it is; the end screen shows a full scorecard (hole, par, you, AI, totals, ± par).

## The course (par 27)
| # | Hole | Par | What's special |
|---|------|-----|----------------|
| 1 | Dogleg | 2 | An L-shaped lane with a bank wall in the corner. |
| 2 | Windmill | 3 | Go through the tunnel under the windmill; a blade pointing down blocks the entrance (time it). |
| 3 | Loop | 3 | A narrow chute through a pink loop-de-loop. Too soft and the ball rolls back. |
| 4 | Clown | 3 | Roll up the tongue into the clown's mouth (it chomps open and shut) and come out by the cup, or go the long way round. |
| 5 | Pinball | 3 | Nine neon bumpers that kick the ball, plus angled walls. |
| 6 | Gates | 3 | Three gates sliding sideways at different speeds. |
| 7 | Volcano | 3 | The cup sits just past the top of a hill; too soft rolls back, too hard rolls over. |
| 8 | Bridge | 3 | A narrow bridge over glowing water (falling in costs +1 and you replay from the same spot), or a long walled path round. |
| 9 | Robot | 4 | A spinning giant Codex robot sweeps a neon arm across the corner. A tunnel is a shortcut. |

## How it works
- **Course data:** all 9 holes are built once and laid out 3×3; the camera glides to the current hole and frames it (looking down steeply, fitting tall features and the players).
- **Holes:** each hole is data (outline, walls, tee, cup, bumpers, features) in local coordinates.
- **Physics** (`gfStepBall`):
  - 2D rolling: friction and drag, substeps so the ball never skips a wall, and walls/bumpers as circle-vs-segment/circle collisions.
  - Moving segments: windmill, gates and teeth are segments; the robot arm is a spinning segment.
  - Slopes: the hill and the tongue push the ball. The cup takes a slow ball, and its lip pulls a slow ball the last bit.
  - Special zones: loop, mouth, tunnel and water. Moving parts are pure functions of the hole's clock.
- **AI:**
  - A walking-distance map per hole (a grid around the walls, with the mouth and tunnel as shortcuts).
  - It tries about 425 shots with the same physics (chunked so it never stalls a frame), refines around the best, then adds aim and power error by difficulty: easy 0.2 rad / 30% (picks from its top 6), normal 0.12 / 19% (top 4), hard 0.07 / 12% (top 2).
- **Measured (AI vs AI):** Easy ≈ 37, Normal ≈ 28 (about par), Hard ≈ 22 strokes.

## Tests
`tests/minigolf-browser.py`:
- the mode and course
- AI rounds on every difficulty: the ball never escapes a wall, every hole ends in 1–7 strokes, every feature is used, and harder AIs score better
- slide aim with mouse and touch; a tiny drag doesn't putt; keys + Enter
- the loop (hard vs soft putt), the water penalty, turns, and a full match ending with the scorecard

Static checks are in `app/verkefni/verkefni.test.mjs`.
