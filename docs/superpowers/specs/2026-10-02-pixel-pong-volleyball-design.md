# Pixel Pong: Volleyball mode

Third game mode next to Ping Pong and Air Hockey. (Duos / 2v2 comes next as its own design.)

## Play
- **VOLLEYBALL** button in the mode row. Same behind-the-court 3D camera (a little higher on wide screens so the far court shows).
- The character **is** the player: it runs around its own half (it can't cross the net). Mouse points where to run, touch drags relatively, A / D also work.
- The ball flies in real 3D arcs with gravity, with a shadow and a glowing **landing ring** in the colour of the side it will land on.
- **Auto-bump:** get under a falling ball and you hit it back over the net. Running left/right while you hit aims it.
- **Spike:** click / tap (SPIKE button on phones, Shift on keyboards) to jump. If the ball is high, close to you and you're near the net within 0.22 s, you smash it down fast. Spikes can only be dug back if they come almost straight at the defender.
- Auto serve from the server's baseline; **the side that lost the point serves**.
- Ball lands in a court → point to the other side. Out → point against whoever touched it last. Into the net → it drops back on the hitter's side.
- First to 7. The point loser gets slimed in the winner's colour. No boosts or pins in v1.

## AI
Per difficulty: run speed, reaction time, how badly it misjudges the landing spot, bump aim error, how deep it plays, and how often it goes for spikes (easy 15 %, normal 35 %, hard 60 %). AI spikes aim away from the defender.

## Online
Works with the existing QR / link flow. The host runs the game; the friend sends their position `[x, z]` and their SPIKE taps (the reliable 'spin' message, with 0.15 s extra lag allowance). Snapshots carry the ball, both players (with jump height), the last toucher and the server; the friend mirrors x and z.

Also fixed: the friend's SPIN taps in online Ping Pong never reached the host.

## Code
All in `public/projects/pixel-pong/game.html`, in a `VOLLEYBALL` section after Air Hockey:
`VB` / `VDIFF` constants, the `court` and `landRing` meshes, `vbIntegrate` (gravity + net), `vbLaunch` (ballistic arc that clears the net), `vbSpikeLaunch`, `vbBump` / `vbTrySpike`, `vbAI`, `vbMovePlayer`, `vbResetServe` / `vbStep` / `vbRender`. `setGameMode` now handles three modes (`MODES`).

## Tests
- `tests/volleyball-browser.py`:
  - AI-vs-AI matches on all difficulties: valid states, nobody crossing the net, every ball clearing the net, accurate landing ring, matches finishing.
  - Every point checked against the rules.
  - Scripted in / out / wide / net drops, with the loser serving from the baseline.
  - A scripted bumper, a scripted spiker, an idle player losing 0–7.
  - Real mouse and click input.
- `tests/online-browser.py`: volleyball over p2p and relay, plus the friend's SPIN / SPIKE taps reaching the host.
- `tests/pixel-pong-mobile-browser.py`: court on screen, SPIKE button, drag to run, tap to jump.
- `app/verkefni/verkefni.test.mjs`: static checks.
