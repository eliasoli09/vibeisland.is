# Pixel Pong — bucket slime (design)

Approved 2026-10-01. Replaces the falling-glob slime from `2026-10-01-pixel-pong-chaos-design.md`.

Unchanged: the loser of each point is slimed in the **winner's** colour; when you lose, slime also pours down your screen.

## Timeline (~2.0 s, finishes before the next serve)
1. **0–0.3 s:** a steel bucket (lathe body, rim, handle, slime surface inside) drops in above the loser's head with a small bounce; clank sound.
2. **0.3–0.55 s:** it tips ~115° toward the camera.
3. **0.42–0.95 s:** a smooth stream (32-sided tube) pours from the lip onto the head, wobbling and thinning; droplets splash off on impact (0.5 s, splat + glug).
4. **0.5–1.35 s:** a glossy coat flows **down over the whole character**. A lumpy ellipsoid shell (72×54 segments, ~4k vertices) fits the character's real size. A world-space clipping plane sweeps from above the head to the feet, so the goo is revealed top-down. Drips run just ahead of the flowing edge, then fall off.
5. **~1.1–1.45 s:** a puddle spreads at the feet.
6. **0.95–1.35 s:** the bucket swings off to the side and shrinks away. It never flies up over the table, where it could be mistaken for a ball.
7. **1.4–2.0 s:** everything fades and hides.

## Look
- MeshPhysicalMaterial goo: clearcoat, low roughness, slight emissive, ~84 % opacity so the character stays recognisable underneath.
- Bucket: brushed steel with low metalness (no environment map, so high metalness rendered black).
- Screen slime: generated SVG with many smooth drips, light-to-dark shading, a glossy highlight, bubbles and drip-tip glints.

## Testing
- `__pong.slime(who)`, `slimeStep(who, s)` (fixed 60 fps steps, independent of render speed: the headless test browser only renders ~6 fps) and `slimeInfo(who)`.
- `tests/pixel-pong-chaos-browser.py` checks, for both you and the AI:
  - a bucket appears and pours
  - the coat covers ≥ 95 % of the character's height
  - the coat has ≥ 3,000 vertices
  - everything is hidden and inactive afterwards
