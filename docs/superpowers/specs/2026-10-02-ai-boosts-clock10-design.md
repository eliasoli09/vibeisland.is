# Pixel Pong — AI boosts, 10 s shot clock (design)

Approved 2026-10-02 (step 1 of "10 s shot clock + online game + AI never gets power-ups").

## Shot clock
- Air Hockey shot clock starts at **10 s** (−0.5 s per centre-line crossing, min 2 s).
- The backup stall rule must outlast the longest clock: it was 9 s and kept re-dropping a still puck before a 10 s clock could expire. It's now `HK.CLOCK + 2` = 12 s.

## AI boosts (the AI never got any before)
- Boosts belong to a side. `power` (you) and `aiPower` (AI) are separate slots; `powerOf(owner)`, `awardPower(owner)`, `endPower(owner)` (no argument ends both) and `tickPowers(dt)`.
- **How the AI earns them** (real matches only; the menu's AI-vs-AI demo never uses boosts):
  - **Ping Pong:** every 3rd AI spin shot. The count carries over between points, because a weak AI concedes too often to ever finish a streak. AI spin chance: Easy 15 % (was 0), Normal 20 %, Hard 40 %.
  - **Air Hockey:** 3 AI smashes in a row (a real swing ≥ 5 that sends the puck ≥ 15), like yours.
- **Effects for the AI's side:**
  - **BIG PADDLE / BIG MALLET:** the AI's paddle or mallet × 1.5.
  - **SLOW-MO:** slows balls flying at the AI.
  - **FIREBALL:** on the AI's next hit ("INCOMING FIREBALL!").
  - **TRIPLE BALL / TRIPLE PUCK:** fakes fly at you ("INCOMING TRIPLE …").
  - **WIDE GOAL:** makes *your* goal 1.6× wider.
- **HUD:** an "AI: <BOOST>" chip with a countdown bar, top-right under the sound/pause buttons, lower on phones. A banner announces it ("GROK: FIREBALL").
- **Measured** (3 matches vs a scripted perfect player, AI boosts per match):
  - Ping Pong: Easy ≈ 0.7, Normal ≈ 1.7, Hard ≈ 6
  - Air Hockey: ≈ 1.5–2 for each side
- **Found in testing:**
  - With both sides able to triple, a second TRIPLE could overwrite fakes still in flight, so a fake vanished without popping. Earlier fakes now pop first.
  - The phone SPIN button stayed visible on the game-over screen; it now shows only while a match is running.

## Testing
- `tests/ai-boosts-browser.py`:
  - the AI earns boosts in pong on Easy and Normal
  - each of the 8 AI boosts works for its side
  - every fake pops
  - the AI chip shows and names the boost
  - the menu demo never boosts
- `tests/air-hockey-browser.py`: expects the 10 s clock.
- `tests/pixel-pong-chaos-browser.py`: counts only your fakes when checking 2 per TRIPLE.
