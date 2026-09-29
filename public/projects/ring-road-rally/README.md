# Ring Road Rally 3D

A browser rally game around an Iceland-inspired Ring Road (Hringvegurinn), in
three.js, with every model built in Blender. The look and feel take their cue
from open-world festival racers: chase camera with speed FOV, drift / air /
near-miss skill chains, a speed trap, jumps and a festival at the start line.

Live build (multiplayer rooms + leaderboard): https://ring-road-rally.higgsfield.app

## What's on the map

| Zone | Pattern it teaches |
| --- | --- |
| Reykjavík | Festival arch, Hallgrímskirkja, coloured roofs, geothermal boost pads |
| Þingvellir · Almannagjá | Narrow rift between basalt cliffs — hard walls |
| Geysir | Strokkur erupts on a 7 s cycle (orange ring warns first) and throws you |
| Gullfoss | Two-step falls; the gorge is on the right — fall in and you respawn |
| Eyjafjallajökull | Three lava streams from a smoking volcano pulse across the road |
| Reynisfjara | Loose black sand, lava rocks on the road, sea stacks offshore |
| Jökulsárlón | Glare ice, icebergs on the road and floating in the lagoon |
| Austfirðir | Gravel hairpins |
| Hálendið | Sheep crossing, and a crest that launches you |
| Vesturland | Speed trap, second jump, lighthouse, run home |

## Files

- `index.html` — UI and HUD (Icelandic).
- `js/track.js` — the loop in metres, zones, hazards, obstacles.
- `js/world.js` — the island height grid shared by renderer and physics (no three.js).
- `js/scene.js` — sky, sea, terrain, road, and placement of the Blender kit.
- `js/main.js` — input, 120 Hz physics, skills, race, camera, HUD, audio, net.
- `models/kit.glb` — the Blender asset kit (car, church, houses, sheep, icebergs,
  sea stacks, rocks, geyser, festival arch, checkpoints, posts, lighthouse, tents,
  lupines, speed camera, basalt cliff), built with Python in Blender 5.2.
- `vendor/` — three.js r186 (MIT).

## Running

Any static server: `python3 -m http.server` in this folder, then open
`http://localhost:8000/`. Without the game server the leaderboard is offline;
everything else works. Debug helpers: `?debug=1`, `?debug=1&autopilot=1&sim=4`.
