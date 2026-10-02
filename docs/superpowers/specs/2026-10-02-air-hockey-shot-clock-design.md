# Air Hockey — growing goals & shot clock, no bumpers (design)

Approved 2026-10-02. Amends `2026-10-02-air-hockey-design.md`. Air Hockey only; Ping Pong keeps its pins.

## Bumpers removed
- Air Hockey never grows pins. The hockey physics, the mallet clamps and the AI no longer handle bumpers. The menu hint no longer mentions them.

## Growing goals
- `hk.crossings` counts centre-line crossings in the current point. The puck's half changes only past z = ±0.25 (hysteresis), so a puck wobbling on the line counts once.
- Goal half-width for both goals = `min(4, 1.5 × (1 + 0.08 × crossings))`. WIDE GOAL multiplies the AI's goal by 1.6 within the same cap.
- Rails, goal mouths and pits resize every frame. The mouths flash white when the goals grow.
- After a goal, crossings reset to 0, so both goals snap back to 1.5.

## Shot clock
- The side whose half the puck is in has the clock: `max(2, 7 − 0.5 × crossings)` seconds, restarted on every crossing and at every drop.
- It ticks only during play. When it runs out, the buzzer and "SHOT CLOCK!" banner fire, and the **same puck drops on the other side** (`hkResetServe(true)`). There's no goal, no score change, and the goal size and crossing count are kept.
- HUD: a "SHOT CLOCK n.n" box at the bottom centre, bordered in the colour of the side holding the puck. It flashes red under 2 s and is lifted above the SMASH dots on phones.
- AI: when its own clock is under 1.3 s and the puck is in its half, it attacks immediately.
- The old 4 s anti-stall face-off becomes a 9 s backup, and the clock normally ends stalls first.

## Effect (AI vs AI, 15 min)
- Normal: ~49 goals (was ~30), ~40 shot clock turnovers.
- Hard: ~34 goals (was ~11).

## Testing — `tests/air-hockey-browser.py`
- No bumpers ever appear.
- Every crossing logs the goal size (8 % per crossing, cap 4) and the clock (7 − 0.5 per crossing, min 2).
- Goals are back to 1.5 at every serve after a goal.
- An idle player's clock runs out: the puck drops on the other side and the score is unchanged.
- WIDE GOAL is checked as a 1.6× ratio of the AI's goal to yours, since both goals now grow anyway.
