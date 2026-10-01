# Pixel Pong — fitted slime & per-rally pins (design)

Approved 2026-10-01. Amends `2026-10-01-pixel-pong-bucket-slime-design.md` and the pin rules in `2026-10-01-pixel-pong-chaos-design.md`.

## Slime fits every character
- The coat is built from the loser's own pixel grid: one goo blob per filled pixel. A blob is a nearly-flat superellipsoid (exponent 0.04), sized 0.66 of a pixel each way and the pixel's own depth + a thin layer. Neighbours overlap and merge into one sheet that follows the exact outline: the crab's legs, Clawd's antennae and mittens, Grok's sphere. Gaps between legs stay empty.
- Coats are built once per character per side (instanced meshes) and cached.
- Two passes so overlapping blobs read as a single, even, see-through layer: a depth-only pre-pass, then the glossy colour pass with `polygonOffset` and no depth writes. The coat is ~76 % opaque, so the character stays recognisable.
- The stream lands on the actual top of the head nearest the middle. Clawd's lands between the antennae.
- Drips run down real columns of the body, just ahead of the flowing edge. They only show where there's body to run down, then fall off.
- The coat has ~25–33k vertices (e.g. 148 blobs × 221 vertices).

## Pins after every point
- Pins now belong to a rally: the round-trip counter resets and all pins sink back into the table (0.4 s) whenever a point ends. Every rally starts clean.
- Rule within a rally is unchanged: 2 pins after 5 round trips, +1 every 3, max 6.
- Pins are now much rarer. In simulated Normal-vs-Normal play only ~4 % of rallies reach 5 round trips; on Hard, long rallies grow up to 6.
- Found in testing: the sink animation only advances when frames are drawn, so sinking pins could use up all 6 pin slots. If no slot is free, the oldest sinking pin is now reused.

## Testing (`tests/pixel-pong-chaos-browser.py`)
- Pins follow the rule; no pins at any serve; a Hard-difficulty run grows them to ≥ 3 with no invalid ball states.
- For you and the AI: blob count equals the character's pixel count, ≥ 3,000 vertices, ≥ 95 % coverage, full cleanup.
- All five characters checked for fit and coverage.
