# Pixel Pong — design

Claude Code crab vs Codex cloud-bot ping pong. One human, one AI. Simple > complex.

## Decisions (approved)
- **Tech:** one self-contained `pixel-pong.html`, Three.js r128 (cdnjs UMD). No build step.
- **Look (from Higgsfield concepts):** dark navy neon arena, glossy blue table with glowing lines, net, side rails, grid floor fading into fog. Characters are 3D voxel models built from pixel grids (crab: orange `#D97757`; Codex: blue cloud with black screen and cyan `>_`). Pixel UI font (Press Start 2P + VT323).
- **Camera:** fixed behind the player's (near) end, looking down the table; small sway with the paddle, small shake on points.
- **Setup screen:** "PIXEL PONG", pick your fighter (the other becomes the AI), difficulty Easy / Normal / Hard, Start. Attract-mode AI-vs-AI rally runs behind the menu.
- **Controls:** mouse (or touch) x → paddle x via raycast onto the paddle plane (using an un-swayed reference camera so no feedback), smoothed. Arrow keys / A-D fallback. Space/P/Esc pause, M mute.

## Physics (glitch-resistant)
- Ball lives on the table plane (x, z); height is purely visual: `y = R + hop·|cos(πz/HL)|` → bounces at mid-half, clears the net.
- Fixed 120 Hz substeps, frame dt clamped to 50 ms.
- Paddle contact by plane-crossing test (prev z vs new z) + x at crossing → no tunneling.
- Side rails reflect x. Return angle = hit offset on paddle (±~52°) + a little paddle velocity; |vz| always ≥ ~54 % of speed so rallies never stall. Speed +4.5 % per hit, capped per difficulty.
- Point when ball passes a paddle plane by 0.5; 1.2 s flyout, then serve toward the player who lost the point.

## AI
- Re-predicts landing x (with wall folding) every `react` seconds; moves with capped speed toward prediction + aim offset. Occasional deliberate miss (`missP`).
- Easy / Normal / Hard tune speed, reaction, miss chance, serve & max ball speed.

## Game flow
First to 7. Scoreboard HUD, banners (READY / GO / POINT), scorer celebrates (jump + spin), loser shakes, pixel spark bursts on hits, WebAudio blips. Game-over overlay: Rematch / Change fighter. Auto-pause when the tab is hidden.

## Out of scope
Power-ups, multiplayer, spin physics, real 3D ball height.
