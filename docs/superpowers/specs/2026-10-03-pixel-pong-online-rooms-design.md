# Pixel Pong: online 2 v 2 rooms (Duos part 2), spike balance, Air Hockey teamwork

## Online rooms for up to 4
- In 2 v 2, PLAY ONLINE opens a **room** with the usual QR code, code and link.
- **Joining:**
  - Up to 3 friends can join.
  - Each lands in the first free seat with a fighter nobody else has.
  - A fifth person is told the room is full.
- **The lobby:**
  - Two teams with two seats each.
  - Tap an empty seat to move there, and tap a fighter to switch (taken fighters are greyed out).
  - The host can **SHUFFLE TEAMS**: people are dealt alternately to the two teams, so a team is never only people against only AIs.
  - **START** works with 2 or more people, and empty seats are played by the AI.
- **During the match:**
  - Everyone sees it from their own team's end.
  - The host's team is always the near one on the host. On a friend's screen their own team is near, and they are the main near player.
  - If someone leaves, the AI takes over their player ("NAME LEFT - AI PLAYS"). If everyone leaves, the host is told.
  - If the host leaves, friends see "HOST LEFT".
- **Rematch:** restarts with the same seats.
- **1 v 1 online works as before:** join, pick a fighter, play.

## Netcode
- **Messages:** every message carries `f` (who sent it) and optionally `t` (an id, a list of ids, or everyone).
- **Host and peers:**
  - The host keeps one peer per friend: its own WebRTC connection (a `game` channel and a reliable `ctl` channel), with the Supabase relay as fallback.
  - The host's game, snapshots and events are the same for everyone. Players are numbered 0 = host, 1 = host's teammate, 2–3 = the other team.
  - Each friend gets `{ ent, flip, swap }`. **flip:** they're on the other team, so x and z are mirrored. **swap:** they're the second player of their team.
  - `localIdx` / `hostIdxOf` renumber players so that every client controls player 0 (P / MP / VP) locally. That way the existing control code works unchanged.
- **Remote players:**
  - A friend's paddle, mallet or player on the host is driven by `q.remote` (that peer's latest position).
  - Their SPIN / SPIKE taps arrive via the peer's `spinA`.
  - Lag-forgiving paddle reach uses a per-paddle history.
- **Rates:** 2 v 2 relays at 15 Hz (snapshots and inputs) to stay well inside the realtime limits. Direct connections run at 30 Hz.

## Spikes were overpowered (feedback)
**Measured with the realistic test player against Normal 1 v 1:** 21–0, and every point was a spike winner (75% of spikes won outright). The AI's own spikes dominated Hard and 2 v 2 the same way.

**Changes (spiking stays easy to *do*):**
- **Dig reach:**
  - Defenders can dig spikes much more easily: 0.8 / 1.0 / 1.2 m for Easy / Normal / Hard AIs (was 0.8 m for everyone), and 1.15 m for people.
  - "Spike speed" now counts from 11 instead of 12.
- **Speed:** spikes go 14 instead of 17. They still speed up with the rally.
- **Your spike aim:** roughly random when you stand still (no more auto-aim into the gap); running sideways still aims it.
- **AI spikes:** aiming error by difficulty, larger on the wide 2 v 2 court. An AI spikes off a teammate's set less often (+15% instead of +40%).

**Result (realistic player):**

| Mode | Spikes that win the point | Points won |
|---|---|---|
| 1 v 1 Easy | ~40% | 95% |
| 1 v 1 Normal | ~30% | 84–93% |
| 1 v 1 Hard | ~18% | 62% |
| 2 v 2 Easy | — | 100% |
| 2 v 2 Normal | — | 39% |
| 2 v 2 Hard | — | 33% |

## Air Hockey AI teamwork (feedback: "make the 2 v 2 AIs more like teammates")
- **One leader.** The teammate nearer the puck leads, with hysteresis: it only switches when the other is 1 m closer. With a person as teammate, the person can be the leader.
- **The supporter:**
  - It covers the goal when a shot is coming, on the other side if the leader is already in the way.
  - When we have the puck, it waits in an open spot on the other side for a pass or rebound.
  - When the puck is in their half, it hangs back as goalie.
- **Passes:**
  - From an awkward spot (by the wall, or deep in our half), the leader sometimes passes across and forward to a spot in front of its teammate: 20 / 40 / 55% on Easy / Normal / Hard.
  - A pass is a controlled touch at speed 11. The passer steps back and can't touch it again for 0.3 s.
  - The receiver waits on the spot and then leads.
  - "PASS!" pops up.
- **Measured:** teammates on top of each other 17% → ~7% of the time; passes 0 → several per match, with most reaching the teammate (e.g. 10 of 12); fewer shot-clock violations.

## Tests
- `tests/online-rooms-browser.py`:
  - **Volleyball with 4 browsers:** seats, fighters, full room, shuffle, everyone's view and controls, the ball, scoring, someone leaving.
  - **Ping Pong through the relay** with a friend as the host's teammate: moving seats, AI fill-in, unmirrored paddle, SPIN.
  - **Air Hockey** with 3 people.
- `tests/volleyball-browser.py`: spikes win some points but not all, and the AI digs a share back.
- `tests/duos-browser.py`: AI teammates rarely crowd each other, and they pass with most passes completed.
- `tests/online-browser.py`: 1 v 1 online is unchanged.
