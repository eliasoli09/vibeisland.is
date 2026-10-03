# Pixel Pong: 2 v 2 (Duos), part 1 — offline teams

Part 1 of Duos: every mode can be played two against two, with you and an AI teammate against two AIs. Part 2 adds online rooms for up to 4 people. In that room, players pick or shuffle teams, and AI fills any empty slots.

## Menu
- A **1 V 1 / 2 V 2** switch under the mode buttons. The choice is remembered.
- In 2 v 2 you still pick your fighter and the main opponent. Your teammate and the second opponent are random, and all four fighters are always different.
- PLAY ONLINE is hidden in 2 v 2 until part 2.

## The bigger playing area
- The table, rink and court are **twice as wide** (`HW` and `VB.CW` go from 5 to 10). The static parts are built 10 wide inside a `wide` group, which is stretched sideways.
  - The round hockey markings are not stretched.
  - The hockey end rails are rebuilt for the new width.
  - The net textures are re-tiled so the net mesh stays square.
- The Air Hockey goals are twice as wide too. They start at a half-width of 3 and still grow every crossing, capped at 8.
- The camera always uses the fit-to-screen search in 2 v 2, at a 36° minimum elevation.

## Teams
- Each mode has a second player per side: `P2` / `A2` (paddles), `MP2` / `MA2` (mallets) and `VP2` / `VA2` (volleyball players). Each has its own character rig (`nearRig2`, `farRig2`) and slime.
- Every player knows its `rig`, its `mate`, a `lane` (−1 or +1) and a `slot` (0–3).
- **Ping Pong:**
  - Teammates' paddles share the hit plane and can pass through each other. The closest paddle in reach plays the ball.
  - The AI takes a ball only if it is closer to where the ball is going than its teammate; otherwise it covers the other half.
  - Boosts and the spin streak belong to the team.
- **Air Hockey:**
  - Mallets on the same team pass through each other.
  - The AI nearer the puck plays it, and the other guards the goal mouth.
- **Volleyball:**
  - Up to 2 touches per side, and nobody touches twice in a row. A third touch is only possible if the ball comes back off the net.
  - The first touch on your side is an automatic **set**: high, near the net, toward your teammate, who can spike it or bump it over.
  - The AI teammate nearer the landing spot takes the ball, and the other moves up to the net for the set.
  - Teammates take turns serving.
- Scoring is first to 7 per team. The whole losing team gets slimed, and the scoreboard and end screen show both characters.

## Volleyball speeds up
- Every touch makes the rally 5% faster, up to 2×. The arcs stay the same and just play out faster: `ball.k` scales time in `vbIntegrate`.
- Every point played starts the next rally 3% faster, up to 1.4×.
- The ball warms from white to orange as it speeds up.
- Online snapshots carry `k`.

## Spiking fix (feedback: "spiking doesn't work / far too hard, especially on a phone")
**The cause.** The ring shows where the ball *lands*. At spike height, a ball you are standing on the ring for is still about 2 m away. The old rule needed it within 1.3 m, and also required you to be near the net and to tap within 0.22 s. A realistic player standing on the ring spiked **0 of 16** taps.

**The fix, for people only (AI spikes are unchanged):**
- You can spike when the ball is on your side, between 1.4 and 6.5 high, and either:
  - within 2.4 m of you, or
  - about to land within 2 m of you (you're on the ring).
- The tap stays armed for 0.5 s (0.65 s online).
- You can spike from anywhere in your half. If a downward smash can't clear the net from there, you hit a hard, flat drive over it instead.
- **Aim:** run sideways to aim the spike that way. Standing still sends it into the biggest gap between the defenders.
- **Cue:** an orange ring lights up under you, and the SPIKE button glows and pulses, whenever a tap would spike.

**Results (realistic test player):**
- 1 v 1 Normal: 19 of 19 taps spike in the test suite, and 93–96 % across longer sim runs.
- About half of those spikes are dug back, against 77 % before the aim change.
- Points are about even with, or ahead of, the Normal AI.

## Tests
- `tests/duos-browser.py`:
  - the menu switch, the widths, four distinct fighters, the scoreboard
  - all three modes AI-vs-AI in 2 v 2, with all four players taking part
  - team slime, wider goals
  - Volleyball rules: sets, max 2 touches, no double touches, points to the right team
  - the speed ramp
- `tests/volleyball-browser.py`: the realistic ring-standing spiker (≥ 80 % of taps spike, ≤ 70 % of spikes dug).
- `tests/pixel-pong-mobile-browser.py`: the 2 v 2 tables fit the phone screen; the SPIKE button glows while the ball is in reach; a tap as the ball comes over spikes.
- All earlier suites still pass for 1 v 1.
