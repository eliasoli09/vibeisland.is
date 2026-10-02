# Pixel Pong — Air Hockey mode (design)

Approved 2026-10-02. A second game mode inside `public/projects/pixel-pong/game.html`, sharing the scene, characters, menu, HUD, slime, pins and boost system with Ping Pong.

## Menu
- **PING PONG | AIR HOCKEY** switch at the top (remembered). Fighter, opponent and difficulty pickers are shared. The hint text follows the mode.

## Table (same neon table and semi-3D camera)
- Hockey parts shown only in this mode: end rails with a goal slot in each end, a centre line across the table, a centre circle and goal creases. The pong net and centre stripe are hidden.
- Goal mouth half-width 1.5 (WIDE GOAL: 2.4 for the AI's goal).

## Puck = a character
- After every goal a **random** character (different from the last one) drops from above onto a glowing disc as the new puck. It spins as it slides, faster the harder it's hit.
- Physics radius 0.45. Low friction (velocity × e^(−0.35·dt)). Rails bounce with restitution 0.9. Goal posts are round corners. Max speed 24 (34 for FIREBALL).

## Mallets
- A classic round mallet in the owner's colour (radius 0.55).
- **You:** the mallet follows the mouse anywhere in your half (raycast onto the table), at up to 30 units/s. A/D or ←/→ also slide it sideways.
- Mallets can't cross the centre line. Mallet–puck hits pass on the mallet's velocity (restitution 0.85).
- A pinned puck pushes the mallet back instead of being squeezed through a rail.
- Characters stand behind their goals and follow their mallet, as in pong.

## AI (Easy / Normal / Hard: speed 9 / 12 / 17, reaction 0.25 / 0.15 / 0.08 s, aim and defence error)
- Tuned by measurement so that AI-vs-AI scores about every 25–35 s on Normal and every ~70 s on Hard. Shots aim for the corners of the goal.
- **Defend:** stand on a line in front of the goal, at the x where the puck will cross it. This is predicted with the same physics, including rails and pins.
- **Attack:** when the puck is slow or moving away on its side, get behind it (on the goal side), then drive through it at the opponent's goal with some aim error. If it's on the wrong side of the puck, it goes around.

## Flow
- Shared `phase` (serve / play / point / over), score and first to 7.
- The side that concedes gets the next puck: it drops at z = ±2.2 on their side.
- Conceding = the bucket of slime in the winner's colour, as in pong.
- **Anti-stall:** if the puck moves slower than 1.2 for 4 s, it's re-dropped ("FACE-OFF").

## Pins (per goal)
- Puck hits since the last goal: 2 pins after 10 hits, +1 every 6, max 4.
- Placement avoids the goal areas (|z| > 5.4), the centre circle, other pins (≥ 2 apart), the puck and the mallets.
- The puck bounces off a pin with a 5 % kick. All pins sink when a goal is scored.

## Boosts (you only)
- **Earning:** a **smash** is a real swing (the mallet moving into the puck at ≥ 5) that sends the puck at ≥ 15. A puck bouncing off a still mallet is a block, not a smash. Three smashes in a row (a softer touch resets the streak) award a random boost. The HUD dots are labelled SMASH.
  - **BIG MALLET:** radius × 1.5 for 8 s.
  - **FIREBALL:** your next hit launches the puck at 1.5× the hit speed, but never below 28 and never above 34, even from a gentle touch. Flame trail.
  - **TRIPLE PUCK:** your next hit also launches 2 identical fake pucks at ±0.4 rad. Fakes bounce off rails and pins, ignore mallets, never score, and pop in a goal mouth or after 2.5 s. The AI chases the real puck only 34 / 45 / 60 % of the time and notices after 0.45 s.
  - **WIDE GOAL:** the AI's goal is 1.6× wider for 8 s.

## Testing — `tests/air-hockey-browser.py` (Playwright, `?debug`)
- Long AI-vs-AI runs:
  - no invalid or escaped puck
  - goals keep happening
  - no stall longer than ~4.5 s
  - no puck–mallet penetration after resolution
  - the puck character changes after goals
  - the loser gets slimed in the winner's colour
  - the pin rule holds; no pins at a face-off
- Scripted player:
  - smashes earn boosts
  - each boost works: BIG MALLET widens, FIREBALL is faster, every TRIPLE PUCK fake pops and none score, WIDE GOAL widens the AI's goal
- Mode switch: hockey parts are shown only in hockey, pong parts only in pong. Pong tests still pass.
