# Nauthólsvík – 1:1 Blender base for a drift game

A real-scale reconstruction of Ylströndin í Nauthólsvík (Reykjavík's geothermal
beach) and the surrounding roads, car parks, Reykjavík University campus,
Öskjuhlíð slopes and the east edge of Reykjavík Airport. It is built from open
map and elevation data by a reproducible script pipeline.

| File | What it is |
| --- | --- |
| `nautholsvik.blend` | Blender scene (4.2+, built with 5.0.1). Textures packed. |
| `nautholsvik.glb` | Game-ready glTF 2.0 export (Y-up, metres). |
| `minimap_0.5m_per_px.jpg` | Orthographic top view of the drivable world, 1 px = 0.5 m. North up; top-left pixel is (x = −450, y = 500). |
| `preview_*.jpg` | Cycles renders, framed like the reference photos. |

## Coordinate frame

* **1 Blender unit = 1 metre.** Transverse Mercator, scale factor 1.0, centred on
  the lagoon: `+proj=tmerc +lat_0=64.1213 +lon_0=-21.93 +k=1 +x_0=0 +y_0=0 +ellps=WGS84`.
  Scale distortion is under 1 mm per km inside the model.
* Blender: +X east, +Y true north, +Z up. In the GLB: +X east, +Y up, −Z north (standard glTF).
* Heights are **metres above mean sea level**. The ArcticDEM ellipsoidal heights
  minus 65.10 m. That offset makes the highest runway point match the published
  aerodrome elevation of Reykjavík Airport (14 m).
* Water surface is at **z = 1.20 m**, a mid-to-high tide with the lagoon full and
  the mouth sill submerged. Reykjavík's spring tidal range is about 4 m, so this
  is a chosen state, not a constant.

## Drivable world (x −450…450, y −350…500 m)

* **Terrain**: 36 tiles (150 m), 168 k triangles. Edges follow every surface
  boundary, so asphalt, sand and grass have crisp borders. Road and car-park
  surfaces are smoothed and have no DEM noise or parked-car bumps. Building,
  pool and terrace footprints are cut out.
* **Surfaces**: material slot per face, also stored as the integer face
  attribute `surface_id`. Use these for tyre grip and effects:

  | id | surface | suggested grip |
  | --- | --- | --- |
  | 0 | seabed | – (under water) |
  | 1 | grass | 0.55 |
  | 2 | forest_floor | 0.5 |
  | 3 | sand | 0.4 |
  | 4 | rock | 0.8 |
  | 5 | gravel | 0.6 |
  | 6 | paving | 0.9 |
  | 7 | asphalt | 1.0 |
  | 8 | concrete | 0.95 |
  | 9 | sand_wet | 0.45 |

* **Roads**: Nauthólsvegur, Menntavegur/Menntasveigur, the service roads, 23 car
  parks, the coastal paths (Sólarleið/Bæjarleið) and the airport taxiways and
  runways. It also has dashed centre lines on the public roads and 12 cm
  concrete kerbs, cut open where paths meet the road.
* **Spawn points**: `SPAWN_*` empties are placed in the three largest paved car
  parks and on Nauthólsvegur. The empty's local X axis is the heading.
* **World bounds**: `COL_WorldBounds` is four invisible walls around the world
  edge.

### Custom properties (exported as glTF `extras`)

* `collider`: `trimesh` (static mesh collider), `box`, `water` (trigger or
  reset volume at `water_level`), or `none` (visual only: trees, backdrop,
  markings).
* `surface`: `terrain`, `rock`, `kerb` or `backdrop`.
* `spawn`: true on spawn empties.

Trees are linked duplicates of 12 low-poly meshes. They are exported with
`EXT_mesh_gpu_instancing`, which three.js, Babylon.js and Unity glTFast draw as
instances. An engine without that extension shows only one tree per mesh.

## The beach (detail zone)

* **Lagoon**: shoreline from the OSM survey (taken at high tide), a bowl of
  golden shell sand about 1.4 m deep at the chosen water level, and a submerged
  rock sill along the mapped breakwater with a yellow buoy line across the mouth.
* **Pier**: rock-armoured causeway, grey board deck and a round platform (r ≈ 6.3 m)
  with a sand pit and a swim ladder at the seaward tip.
* **Rock armour**: about 2,600 basalt boulders along the western seawall,
  the pier causeway and the platform.
* **Service centre** (Arkibúllan, 2001): built into the bank, with the roof
  flush with the coastal path (+8.05 m). The beach-level facade has larch and
  dark-blue panels. The south end has a basalt-clad tower with rounded corners,
  a glass roof railing and stairs down at the north-west end.
* **Pool terrace** (+4.04 m): the long 38 °C hot pool (16.5 × 2.3 m, from OSM)
  with seat ledges, painted lines, three steps down to the sand, picnic tables
  and a lifeguard chair.
* **Round hot pool**: a concrete ring at the lagoon edge with four inlets.
* Old seaplane slipway (concrete ramp), beach-volleyball court, small football
  goals, the blue wind shelter and a flag pole with the Icelandic flag.

## Accuracy: what is measured and what is estimated

* **Plan positions** of roads, car parks, footprints, coastline, beach, pools,
  pier and trees come from OpenStreetMap via Overture Maps. Typical OSM accuracy
  here is 0.5–3 m, and the beach outline is tagged `fixme=resurvey` except at
  the waterline.
* **Heights** come from the ArcticDEM 2 m surface model. It includes the
  2008–2021 surface, is not a survey, and is only about ±1 m vertically.
  Buildings were removed and in-filled. Öskjuhlíð's canopy is only weakly
  visible in the DEM, so woodland trees use typical stand heights.
* **Seabed** outside the intertidal flats is synthetic (ArcticDEM flattens water).
* **Building heights** use DEM roofs where the DEM resolves them and class/size
  defaults otherwise. Most outlying buildings are plain extrusions.
* **Beach structure details** are modelled from the reference photos. These
  include panel layout, tower size, step count, terrace outline, sill crest
  height, pit radius, court and goal positions, and the table count.
  Proportions are right, but dimensions not given by OSM are estimates.
* Not modelled: people, cars, signage text, the Fossvogsbrú bridge (under
  construction, opening 2028) and parking-stall markings (their layout is unknown).

## Rebuild

```bash
pip install requests pyarrow rasterio pyproj shapely scipy triangle numpy bpy
python3 scripts/nautholsvik/fetch_sources.py   # downloads to scripts/nautholsvik/cache (git-ignored)
python3 scripts/nautholsvik/prepare_site.py    # -> scripts/nautholsvik/data (committed)
python3 scripts/nautholsvik/build_world.py     # -> scripts/nautholsvik/build (terrain mesh, layout)
python3 scripts/nautholsvik/build_blend.py     # -> this folder (.blend, .glb, previews)
#   or: blender -b --factory-startup -P scripts/nautholsvik/build_blend.py -- [--no-render] [--no-export]
```

Only `build_blend.py` needs Blender. The committed `data/` files make the last
two steps reproducible offline.

## Sources and licences

* © OpenStreetMap contributors, via **Overture Maps Foundation** release
  2026-09-23.1, ODbL 1.0. The `.blend`, `.glb` and images are Produced Works and
  need this attribution. `scripts/nautholsvik/data/features.geojson` is a
  derivative database under ODbL.
* **ArcticDEM** v4.1 mosaic, tile 14_52_2_1, 2 m. Porter, C. et al., 2023,
  *ArcticDEM – Mosaics, Version 4.1*, Harvard Dataverse. DEMs provided by the
  Polar Geospatial Center under NSF-OPP awards 1043681, 1559691, 1542736,
  1810976 and 2129685. CC-BY-4.0.
* Design facts: Reykjavíkurborg and nautholsvik.is (opened 2000; service centre
  June 2001; ~38 °C hot pool; seawalls enclosing the lagoon; imported golden
  shell sand). The service centre is by Arkibúllan (A arkitektar) and the
  landscape by Landmótun.
