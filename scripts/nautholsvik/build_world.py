"""data/ -> build/world.npz + build/world.json: terrain mesh and placement data.

Plain Python. Requires: numpy scipy shapely rasterio triangle.
Everything is in the local metric frame of config.py (metres, Z = AMSL).

Terrain pipeline
  1. ArcticDEM surface model (2 m) -> 1 m grid.
  2. Bare-earth estimate: buildings removed and in-filled, tree canopy removed
     with a morphological opening inside mapped woodland.
  3. Water: synthetic seabed where the DEM has flattened water, lagoon bowl,
     submerged sill across the lagoon mouth.
  4. Road/parking/path surfaces smoothed with normalised convolution restricted
     to the paved mask, then blended into the verges (drivable, no DSM noise).
  5. Constrained Delaunay triangulation whose edges follow every surface
     boundary (road edges, sand line, coastline, footprints), so materials have
     crisp borders and building/pool footprints are cut out as holes.
"""
import json, math, pathlib
import numpy as np
import triangle
import shapely
from shapely.geometry import shape, box, Point, LineString, Polygon
from shapely.ops import unary_union, linemerge
from scipy import ndimage
from rasterio.features import rasterize
from rasterio.transform import Affine
from config import WORLD, BACKDROP, WATER_Z

HERE = pathlib.Path(__file__).resolve().parent
DATA, BUILD = HERE / "data", HERE / "build"
RNG = np.random.default_rng(20260925)

# Terrain surface classes (index = material slot in Blender).
SURFACES = ["seabed", "grass", "forest_floor", "sand", "rock", "gravel", "paving",
            "asphalt", "concrete", "sand_wet", "grass_worn"]
S = {n: i for i, n in enumerate(SURFACES)}
# Max triangle area per class (m^2); smaller = follows the DEM more closely.
MAX_AREA = {"seabed": 40, "grass": 9, "forest_floor": 16, "sand": 2.5, "rock": 3, "gravel": 5,
            "paving": 4, "asphalt": 6, "concrete": 3}

ROAD_WIDTH = {"primary": 8.0, "secondary": 7.5, "tertiary": 7.0, "residential": 6.0,
              "unclassified": 5.5, "living_street": 5.0, "service": 4.5, "track": 3.0,
              "cycleway": 2.6, "footway": 2.2, "path": 2.0, "steps": 1.8}
STEP_W, N_STEPS = 0.45, 3
DRIVE = {"primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "service", "track"}


# ----------------------------------------------------------------------------- data
BLDS = []
LAGOON = []


LOADED_F = []


def load_features():
    fc = json.loads((DATA / "features.geojson").read_text())
    out = LOADED_F
    for f in fc["features"]:
        p = f["properties"]
        p["g"] = shape(f["geometry"])
        out.append(p)
    return out


def pick(feats, layer=None, cls=None, geom=None):
    cls = {cls} if isinstance(cls, str) else cls
    return [f for f in feats if (layer is None or f["layer"] == layer)
            and (cls is None or f.get("class") in cls)
            and (geom is None or f["g"].geom_type in geom)]


def polys(g):
    if g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    if hasattr(g, "geoms"):
        return [p for x in g.geoms for p in polys(x)]
    return []


def clean(g, grid=0.02):
    g = shapely.set_precision(shapely.make_valid(g), grid)
    return unary_union(polys(g)) if not g.is_empty else g


# ----------------------------------------------------------------------------- grid
class Grid:
    def __init__(self, ext, res):
        self.x0, self.y0, self.x1, self.y1 = ext
        self.res = res
        self.nx = int(round((self.x1 - self.x0) / res)) + 1
        self.ny = int(round((self.y1 - self.y0) / res)) + 1
        self.T = Affine(res, 0, self.x0 - res / 2, 0, res, self.y0 - res / 2)

    def xy(self):
        return np.meshgrid(self.x0 + np.arange(self.nx) * self.res, self.y0 + np.arange(self.ny) * self.res)

    def mask(self, geoms, all_touched=False):
        geoms = [g for g in geoms if not g.is_empty]
        if not geoms:
            return np.zeros((self.ny, self.nx), bool)
        return rasterize([(g, 1) for g in geoms], out_shape=(self.ny, self.nx), transform=self.T,
                         all_touched=all_touched, dtype="uint8").astype(bool)

    def sample(self, Z, x, y):
        c = (np.asarray(x) - self.x0) / self.res
        r = (np.asarray(y) - self.y0) / self.res
        c = np.clip(c, 0, self.nx - 1.001)
        r = np.clip(r, 0, self.ny - 1.001)
        c0, r0 = np.floor(c).astype(int), np.floor(r).astype(int)
        fc, fr = c - c0, r - r0
        return ((1 - fr) * ((1 - fc) * Z[r0, c0] + fc * Z[r0, c0 + 1]) +
                fr * ((1 - fc) * Z[r0 + 1, c0] + fc * Z[r0 + 1, c0 + 1]))


def load_dsm():
    d = np.load(DATA / "dsm.npz")
    z = d["z_cm"].astype(np.float64) / 100.0
    z[d["z_cm"] == -32768] = np.nan
    g = Grid((float(d["x0"]), float(d["y0"]), float(d["x0"]) + (z.shape[1] - 1) * float(d["step"]),
              float(d["y0"]) + (z.shape[0] - 1) * float(d["step"])), float(d["step"]))
    return g, z


def resample(src_grid, Z, dst_grid):
    X, Y = dst_grid.xy()
    valid = np.isfinite(Z)
    zf = np.where(valid, Z, 0.0)
    num = src_grid.sample(zf, X, Y)
    den = src_grid.sample(valid.astype(float), X, Y)
    out = np.where(den > 0.99, num / np.maximum(den, 1e-9), np.nan)
    return out


def fill_nan(Z, max_sigma=64):
    """Normalised-convolution in-fill of NaNs at increasing scales."""
    Z = Z.copy()
    s = 1.0
    while np.isnan(Z).any() and s <= max_sigma:
        valid = np.isfinite(Z)
        num = ndimage.gaussian_filter(np.where(valid, Z, 0.0), s)
        den = ndimage.gaussian_filter(valid.astype(float), s)
        fill = (~valid) & (den > 0.05)
        Z[fill] = num[fill] / den[fill]
        s *= 1.6
    Z[np.isnan(Z)] = np.nanmedian(Z)
    return Z


def masked_smooth(Z, M, sigma):
    num = ndimage.gaussian_filter(np.where(M, Z, 0.0), sigma)
    den = ndimage.gaussian_filter(M.astype(float), sigma)
    return num / np.maximum(den, 1e-6), den


def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------- layout
def build_layout(F):
    W = box(*WORLD)
    L = {}
    island = [f["g"] for f in pick(F, "land", {"island", "land"}) if f.get("name") == "Ísland"]
    land = clean(unary_union(island).intersection(W))
    L["land"] = land
    L["sea"] = clean(W.difference(land))

    beach = [f for f in pick(F, "land", "beach")]
    L["beach_main"] = next(f["g"] for f in beach if f.get("name") == "Ylströndin í Nauthólsvík")
    sand = unary_union([f["g"] for f in beach])
    # The lagoon: sea enclosed by the beach, the pier causeway and the mouth sill
    # (the mapped breakwater line). The coastline follows the high-tide line.
    breakwater = pick(F, "infrastructure", "breakwater")[0]["g"]
    cap = Polygon(list(breakwater.coords) + [(14, -42), (30, -38), (30, 20), (-45, 20), (-45, -52)])
    lagoon = max(polys(L["sea"].intersection(cap)), key=lambda p: p.area)
    L["lagoon"] = clean(lagoon)
    L["sill"] = breakwater

    # --- paved network ---------------------------------------------------------
    roads, paths = [], []
    for f in pick(F, "segment"):
        flags = set(f.get("flags") or [])
        if flags & {"is_under_construction", "is_bridge", "is_tunnel"}:
            continue
        g = f["g"]
        if not g.intersects(W.buffer(20)):
            continue
        cls, sub = f.get("class"), f.get("subclass")
        w = ROAD_WIDTH.get(cls, 2.0)
        if sub == "parking_aisle":
            w = 6.0
        if f.get("width") and f["width"] < 12:
            w = float(f["width"])
        surf = f.get("surface") or ("asphalt" if cls in DRIVE or cls in ("cycleway",) else None)
        if surf in (None, "paved", "asphalt", "concrete"):
            mat = "asphalt"
        elif surf in ("paving_stones", "sett", "concrete:plates"):
            mat = "paving"
        else:
            mat = "gravel"
        if cls == "footway" and surf is None:
            mat = "asphalt"
        rec = {"g": g, "width": w, "class": cls, "sub": sub, "mat": mat, "name": f.get("name"),
               "drive": cls in DRIVE}
        (roads if cls in DRIVE else paths).append(rec)
    L["roads"], L["paths"] = roads, paths

    parking = []
    for f in pick(F, "infrastructure", "parking", geom=("Polygon", "MultiPolygon")):
        if f["g"].intersects(W):
            surf = f.get("surface") or (f.get("tags") or {}).get("surface")
            parking.append({"g": clean(f["g"]), "mat": "gravel" if surf in ("gravel", "pebblestone", "unpaved", "fine_gravel") else "asphalt"})
    L["parking"] = parking
    air = []
    for f in pick(F, "infrastructure", {"runway", "taxiway", "taxilane"}):
        w = float((f.get("tags") or {}).get("width", 45 if f["class"] == "runway" else 15))
        air.append(f["g"].buffer(w / 2, cap_style="flat", quad_segs=3))
    air += [f["g"] for f in pick(F, "infrastructure", "apron")]
    L["airfield"] = clean(unary_union(air).intersection(W)) if air else Polygon()

    L["pedestrian"] = clean(unary_union([f["g"] for f in pick(F, "land_use", "pedestrian")]).intersection(W))
    piers = pick(F, "infrastructure", "pier", geom=("Polygon",))
    L["slipway"] = clean(next(f["g"] for f in piers if (f.get("surface") == "concrete")))
    L["boardwalk"] = clean(next(f["g"] for f in piers if f.get("surface") != "concrete" and f["g"].distance(Point(22, -51)) < 2))

    # --- natural cover ---------------------------------------------------------
    L["wood"] = clean(unary_union([f["g"] for f in pick(F, "land", {"wood", "forest"})]).intersection(W))
    L["scrub"] = clean(unary_union([f["g"] for f in pick(F, "land", {"scrub", "heath"})]).intersection(W))
    L["bare_rock"] = clean(unary_union([f["g"] for f in pick(F, "land", "bare_rock")]).intersection(W))
    L["sand"] = clean(sand.intersection(W))

    # --- structures ------------------------------------------------------------
    L["pools"] = [f["g"] for f in pick(F, "water", "swimming_pool")]
    blds = []
    for f in pick(F, "building"):
        g = f["g"]
        g = max(polys(g), key=lambda p: p.area) if polys(g) else g
        if g.geom_type != "Polygon" or not g.intersects(box(*BACKDROP)):
            continue
        blds.append({"g": clean(g), "class": f.get("class"), "height": f.get("height"),
                     "floors": f.get("floors"), "name": f.get("name"), "min_height": f.get("min_height")})
    L["buildings"] = blds
    # Service centre (Arkibúllan, 2001): the two-storey footprint by the pool.
    L["service"] = next(b for b in blds if b["g"].distance(Point(50, 40)) < 1 and b["g"].area > 400)
    # Pool terrace in front of the service centre: from the SW facade to 3 m past
    # the long hot pool, and along the west face of the SE wing (photos 1, 4, 5).
    fa, fb = np.array([34.1, 47.6]), np.array([60.9, 35.2])
    u = (fb - fa) / np.linalg.norm(fb - fa)
    n = np.array([u[1], -u[0]])  # points south-west, towards the beach
    pool = max(L["pools"], key=lambda p: p.length)
    L["long_pool"] = pool
    L["ring_pool"] = min(L["pools"], key=lambda p: p.length)
    depth = max(float(np.dot(np.array(c) - fa, n)) for c in pool.exterior.coords) + 3.0
    terrace = Polygon([tuple(fa - u * 1.5), tuple(fb), (55.9, 24.4), (61.9, 21.6),
                       tuple(np.array([61.9, 21.6]) + n * 2.5 - u * 1.0),
                       tuple(fb + n * depth - u * 3.0), tuple(fa + n * depth - u * 1.5)])
    L["terrace"] = clean(terrace.difference(L["service"]["g"]))
    return L


# ----------------------------------------------------------------------------- terrain
def build_heights(F, L, G):
    src_grid, dsm = load_dsm()
    Z = resample(src_grid, dsm, G)
    X, Y = G.xy()
    raw = Z.copy()

    world_blds = [b for b in L["buildings"] if b["g"].intersects(box(*WORLD).buffer(10))]
    trees = [f["g"].buffer(3.5) for f in pick(F, "land", "tree")]
    trees += [f["g"].buffer(3.5) for f in pick(F, "land", "tree_row")]
    canopy = G.mask([L["wood"], L["scrub"].buffer(1.0)] + trees, all_touched=True)
    bmask = G.mask([b["g"].buffer(2.5) for b in world_blds], all_touched=True)
    # Car roofs and bushes in parking lots also bias the DSM; the road smoothing handles them.

    # Canopy -> ground: opening removes objects narrower than ~15 m, smoothing hides steps.
    zf = fill_nan(np.where(bmask, np.nan, Z))
    # Öskjuhlíð's planted forest is a closed canopy, so the window must be wider
    # than the stands; a flat structuring element preserves planar slopes.
    opened = ndimage.grey_opening(zf, size=(31, 31))
    opened = ndimage.gaussian_filter(opened, 4.0)
    ground = np.where(canopy, np.minimum(zf, opened + 0.3), zf)
    ground[bmask] = np.nan
    ground = fill_nan(ground)
    land = G.mask([L["land"]])
    ground = np.where(land, ndimage.gaussian_filter(ground, 1.0), ground)

    # --- water ----------------------------------------------------------------
    sea = ~land
    d_sea = ndimage.distance_transform_edt(sea) * G.res
    measured = np.isfinite(raw) & sea & (d_sea < 40)  # intertidal flats only
    synth = np.minimum(1.3 - 0.10 * np.minimum(d_sea, 20) - 0.05 * np.maximum(d_sea - 20, 0), 1.3)
    synth = np.maximum(synth, -9.0)
    seabed = np.where(measured, np.minimum(ground, synth + 1.2), synth)
    seabed = ndimage.gaussian_filter(seabed, 2.0)
    seabed = np.minimum(seabed, WATER_Z - 0.25 - 0.02 * np.minimum(d_sea, 30))
    Z = np.where(sea, seabed, ground)

    # Lagoon bowl: shallow at the edge, ~1.4 m deep in the middle at WATER_Z.
    lag = G.mask([L["lagoon"]])
    d_lag = ndimage.distance_transform_edt(lag) * G.res
    bowl = WATER_Z - 0.12 - 0.07 * d_lag
    Z = np.where(lag, np.maximum(np.minimum(np.minimum(ground, WATER_Z - 0.1), bowl), WATER_Z - 1.45), Z)
    # Lagoon mouth: submerged rock sill along the mapped breakwater line (buoyed).
    sill_px = G.mask([L["sill"].buffer(0.6)], all_touched=True)
    d_sill = ndimage.distance_transform_edt(~sill_px) * G.res
    sill_z = WATER_Z - 0.45 - 0.35 * np.clip(d_sill - 1.5, 0, 6)
    Z = np.where(d_sill < 8, np.maximum(Z, sill_z), Z)
    # Blend ~3 m across the high-tide line so the beach meets the water smoothly.
    near = (d_sea < 3) & sea
    Z = np.where(near, np.minimum(Z, ground), Z)
    Z = np.where(sea | (ndimage.distance_transform_edt(~sea) * G.res < 2), ndimage.gaussian_filter(Z, 1.0), Z)

    # --- paved surfaces ---------------------------------------------------------
    road_polys = [r["g"].buffer(r["width"] / 2, quad_segs=4) for r in L["roads"]]
    road_polys += [p["g"] for p in L["parking"]] + [L["airfield"]]
    Mr = G.mask(road_polys) & land
    path_polys = [p["g"].buffer(p["width"] / 2, quad_segs=3) for p in L["paths"]] + [L["pedestrian"]]
    Mp = G.mask(path_polys) & land & ~Mr

    R1, _ = masked_smooth(Z, Mr, 3.0)
    R2, _ = masked_smooth(np.where(Mr, R1, Z), Mr, 3.0)
    Rext, den = masked_smooth(np.where(Mr, R2, Z), Mr, 5.0)
    d_out = ndimage.distance_transform_edt(~Mr) * G.res
    w = smoothstep(d_out / 3.0)
    road_z = np.where(Mr, R2, np.where(den > 0.02, Rext, Z))
    Z = np.where(d_out < 3.0, road_z * (1 - w) + Z * w, Z)

    P1, pden = masked_smooth(Z, Mp, 1.5)
    d_pout = ndimage.distance_transform_edt(~Mp) * G.res
    wp = smoothstep(d_pout / 1.5)
    path_z = np.where(Mp, P1, np.where(pden > 0.02, P1, Z))
    Z = np.where((d_pout < 1.5) & ~Mr, path_z * (1 - wp) + Z * wp, Z)
    return Z, raw, ground, Mr


def building_heights(L, G, Z):
    """Base from terrain at the footprint edge; height from DSM roof minus base."""
    dg, dsm = load_dsm()
    out = []
    for b in L["buildings"]:
        g = b["g"]
        pts = np.array([g.exterior.interpolate(t, normalized=True).coords[0] for t in np.linspace(0, 1, 40)])
        inside_world = box(*WORLD).buffer(-2).contains(g)
        zs = G.sample(Z, pts[:, 0], pts[:, 1]) if inside_world else dg.sample(np.nan_to_num(dsm, nan=0), pts[:, 0], pts[:, 1])
        base_lo, base_hi = float(np.percentile(zs, 5)), float(np.percentile(zs, 95))
        # Roof: 90th percentile of DSM inside the footprint shrunk by 1 m.
        inner = g.buffer(-1.0)
        if inner.is_empty:
            inner = g.buffer(-0.3)
        minx, miny, maxx, maxy = g.bounds
        xs = np.arange(minx, maxx, 1.0)
        ys = np.arange(miny, maxy, 1.0)
        roof = None
        if len(xs) and len(ys) and not inner.is_empty:
            PX, PY = np.meshgrid(xs, ys)
            m = shapely.contains_xy(inner, PX, PY)
            if m.sum() >= 3:
                v = dg.sample(np.nan_to_num(dsm, nan=-99), PX[m], PY[m])
                v = v[v > -50]
                if len(v) >= 3:
                    roof = float(np.percentile(v, 90))
        h_osm = b["height"] or (b["floors"] * 3.2 + 0.6 if b["floors"] else None)
        h_dsm = roof - base_lo if roof is not None else None
        if h_dsm is not None and 2.2 < h_dsm < 45 and (g.area > 80 or h_dsm < 5):
            h = h_dsm
            src_h = "dsm"
        elif h_osm:
            h, src_h = float(h_osm), "osm"
        else:
            # ArcticDEM misses some buildings (acquisition dates 2008-2021, mosaic
            # filtering), so fall back to class/size typical heights.
            a = g.area
            h = {"garage": 2.8, "garages": 2.8, "shed": 2.5, "carport": 2.6, "hangar": 9.0}.get(b["class"])
            if h is None:
                h = 2.6 if a < 20 else 3.2 if a < 60 else 4.0 if a < 150 else 7.0 if a < 1000 else 8.0
            src_h = "default"
        out.append({"poly": [list(map(lambda v: round(v, 3), c)) for c in g.exterior.coords],
                     "holes": [[list(map(lambda v: round(v, 3), c)) for c in h_.coords] for h_ in g.interiors],
                     "base": round(base_lo - 0.6, 3), "ground_hi": round(base_hi, 3),
                     "top": round(max(base_lo, base_hi - 1.0) + h if src_h != "dsm" else roof, 3),
                     "height_source": src_h, "class": b["class"], "name": b["name"],
                     "world": bool(inside_world)})
    return out


# ----------------------------------------------------------------------------- triangulation
def region_partition(L):
    """Non-overlapping surface regions, highest priority first; holes separately."""
    W = box(*WORLD)
    holes = []
    for b in L["buildings"]:
        if W.buffer(-1).contains(b["g"]):
            holes.append(b["g"])
    holes.append(L["ring_pool"].buffer(0.35))  # wall ring is part of the pool mesh
    holes.append(L["terrace"].buffer(STEP_W * N_STEPS, join_style="mitre"))  # slab + steps
    hole_u = clean(unary_union(holes))

    roads_asph = [r["g"].buffer(r["width"] / 2, quad_segs=4) for r in L["roads"] if r["mat"] == "asphalt"]
    roads_grav = [r["g"].buffer(r["width"] / 2, quad_segs=4) for r in L["roads"] if r["mat"] != "asphalt"]
    park_asph = [p["g"] for p in L["parking"] if p["mat"] == "asphalt"]
    park_grav = [p["g"] for p in L["parking"] if p["mat"] != "asphalt"]
    path_by = {"asphalt": [], "paving": [], "gravel": []}
    for p in L["paths"]:
        path_by[p["mat"]].append(p["g"].buffer(p["width"] / 2, quad_segs=3))

    order = [
        ("concrete", [L["slipway"], L["boardwalk"].buffer(0.3)]),
        ("asphalt", roads_asph + park_asph + [L["airfield"]]),
        ("gravel", roads_grav + park_grav),
        ("paving", path_by["paving"] + [L["pedestrian"]]),
        ("asphalt", path_by["asphalt"]),
        ("gravel", path_by["gravel"]),
        ("sand", [L["sand"]]),
        ("rock", [L["bare_rock"]]),
        ("forest_floor", [L["wood"]]),
    ]
    covered = hole_u
    regions = []
    land = L["land"]
    for name, gs in order:
        g = clean(unary_union([x for x in gs if not x.is_empty]).intersection(W))
        if name in ("sand", "rock", "forest_floor"):
            g = g.intersection(land)
        g = clean(g.difference(covered))
        if not g.is_empty:
            regions.append((name, g))
            covered = clean(unary_union([covered, g]))
    # Rock armour: remaining land strips along the beach seawall, causeway and platform.
    armour_zone = clean(Polygon([(-160, -70), (70, -70), (70, 15), (40, 15), (26, -38), (-40, -44), (-160, -44)]))
    armour = clean(land.intersection(armour_zone).difference(covered))
    armour = unary_union([p for p in polys(armour) if p.area > 2])
    if not armour.is_empty:
        regions.append(("rock", armour))
        covered = clean(unary_union([covered, armour]))
    grass = clean(land.difference(covered))
    regions.append(("grass", grass))
    covered = clean(unary_union([covered, grass]))
    sea = clean(W.difference(covered))
    regions.append(("seabed", sea))
    return regions, hole_u


def triangulate(regions, holes, Z, G):
    W = box(*WORLD)
    geoms = [g for _, g in regions] + [holes]
    lines = []
    for g in geoms:
        for p in polys(g):
            if p.area < 0.3:
                continue
            p = p.simplify(0.1, preserve_topology=True)
            lines.append(p.exterior)
            lines.extend(p.interiors)
    lines.append(W.exterior)
    noded = unary_union([shapely.set_precision(LineString(l.coords), 0.02) for l in lines])
    verts, index, segs = [], {}, set()

    def vid(x, y):
        k = (round(x * 50), round(y * 50))
        if k not in index:
            index[k] = len(verts)
            verts.append((k[0] / 50, k[1] / 50))
        return index[k]

    for ln in getattr(noded, "geoms", [noded]):
        cs = list(ln.coords)
        for a, b in zip(cs[:-1], cs[1:]):
            i, j = vid(*a), vid(*b)
            if i != j:
                segs.add((min(i, j), max(i, j)))
    # Steiner points: 1.6 m in the core (beach, service centre, car parks) and
    # 3 m over the rest of the land, so the surface follows the 1 m height grid.
    # (Triangle's angle-quality switch is not used: with thousands of short map
    # edges it over-refines; area limits + these points give even triangles.)
    land_g = shapely.set_precision(unary_union([g for n, g in regions if n != "seabed"]), 0.02)
    seg_lines = noded
    blocker = holes.buffer(0.3)
    for bx, spacing in ((box(-230, -100, 210, 180), 1.6), (W, 3.0)):
        xs = np.arange(bx.bounds[0], bx.bounds[2], spacing)
        ys = np.arange(bx.bounds[1], bx.bounds[3], spacing)
        PX, PY = np.meshgrid(xs, ys)
        PX = (PX + RNG.uniform(-0.25, 0.25, PX.shape) * spacing).ravel()
        PY = (PY + RNG.uniform(-0.25, 0.25, PY.shape) * spacing).ravel()
        if spacing > 2:
            outside_core = ~((PX > -230) & (PX < 210) & (PY > -100) & (PY < 180))
            PX, PY = PX[outside_core], PY[outside_core]
        keep = shapely.contains_xy(land_g, PX, PY) & ~shapely.contains_xy(blocker, PX, PY)
        PX, PY = PX[keep], PY[keep]
        keep = shapely.distance(shapely.points(PX, PY), seg_lines) > 0.45 * spacing
        for x, y in zip(PX[keep], PY[keep]):
            vid(float(x), float(y))

    region_seeds = []
    for ri, (name, g) in enumerate(regions):
        for p in polys(g):
            if p.area < 0.05:
                continue
            rp = p.representative_point()
            region_seeds.append([rp.x, rp.y, S[name], MAX_AREA.get(name, 9)])
    hole_seeds = [list(p.representative_point().coords[0]) for p in polys(holes) if p.area > 0.05]
    tri_in = {"vertices": np.array(verts), "segments": np.array(sorted(segs)),
              "regions": np.array(region_seeds)}
    if hole_seeds:
        tri_in["holes"] = np.array(hole_seeds)
    t = triangle.triangulate(tri_in, "pAa")
    V2, T = t["vertices"], t["triangles"]
    # Classify by centroid (robust for any region that did not receive a seed).
    C = V2[T].mean(axis=1)
    mat = np.full(len(T), S["grass"], int)
    for name, g in reversed(regions):
        m = shapely.contains_xy(g, C[:, 0], C[:, 1])
        mat[m] = S[name]
    inhole = shapely.contains_xy(holes, C[:, 0], C[:, 1])
    T, mat, C = T[~inhole], mat[~inhole], C[~inhole]
    z = G.sample(Z, V2[:, 0], V2[:, 1])
    # Wet sand / worn grass by height.
    zc = z[T].mean(axis=1)
    mat[(mat == S["sand"]) & (zc < WATER_Z + 0.25)] = S["sand_wet"]
    # The lagoon floor is the imported shell sand, not natural seabed.
    in_lagoon = shapely.contains_xy(LAGOON[0].buffer(0.5), C[:, 0], C[:, 1])
    mat[in_lagoon & (mat == S["seabed"])] = S["sand_wet"]
    return np.column_stack([V2, z]).astype(np.float32), T.astype(np.int32), mat.astype(np.uint8)


def backdrop_mesh(Z_world, G, land_all):
    """8 m grid of the surrounding area (Kársnes, Öskjuhlíð, airport) - visual only."""
    dg, dsm = load_dsm()
    Gb = Grid(BACKDROP, 8.0)
    Zb = resample(dg, dsm, Gb)
    land = Gb.mask([land_all])
    d_sea = ndimage.distance_transform_edt(~land) * Gb.res
    Zb = np.where(land, Zb, np.nan)
    Zb = fill_nan(Zb)
    # Remove buildings/trees crudely with an opening; they are modelled separately.
    Zb = ndimage.gaussian_filter(ndimage.grey_opening(Zb, size=(5, 5)), 0.8)
    Zb = np.where(land, np.maximum(Zb, WATER_Z + 0.3), np.maximum(-1.0 - 0.04 * d_sea, -10.0))
    X, Y = Gb.xy()
    W = WORLD
    inside = (X > W[0] + 8) & (X < W[2] - 8) & (Y > W[1] + 8) & (Y < W[3] - 8)
    border = (X >= W[0] - 1) & (X <= W[2] + 1) & (Y >= W[1] - 1) & (Y <= W[3] + 1)
    Zb = np.where(border, G.sample(Z_world, np.clip(X, W[0], W[2]), np.clip(Y, W[1], W[3])) - 0.08, Zb)
    return Gb, X, Y, Zb, inside


def main():
    F = load_features()
    L = build_layout(F)
    G = Grid(WORLD, 1.0)
    Z, raw, ground, Mr = build_heights(F, L, G)
    regions, holes = region_partition(L)
    LAGOON[:] = [L["lagoon"]]
    V, T, M = triangulate(regions, holes, Z, G)
    print("terrain", V.shape, T.shape, np.bincount(M, minlength=len(SURFACES)))
    blds = building_heights(L, G, Z)
    BLDS[:] = blds
    land_all = unary_union([f["g"] for f in pick(F, "land", {"island", "land"}) if f.get("name") == "Ísland"])
    Gb, BX, BY, BZ, inside = backdrop_mesh(Z, G, land_all)
    BUILD.mkdir(exist_ok=True)
    np.savez_compressed(BUILD / "world.npz", V=V, T=T, M=M, Z=Z.astype(np.float32),
                        grid=np.array([G.x0, G.y0, G.res, G.nx, G.ny]),
                        BZ=BZ.astype(np.float32), Binside=inside,
                        bgrid=np.array([Gb.x0, Gb.y0, Gb.res, Gb.nx, Gb.ny]),
                        ground=ground.astype(np.float32), raw=np.nan_to_num(raw, nan=-99).astype(np.float32))
    placements = place_objects(F, L, G, Z, raw, ground)
    world = {"surfaces": SURFACES, "water_z": WATER_Z, "world": WORLD, "backdrop": BACKDROP,
             "buildings": blds, **placements, **features_for_blender(L, G, Z, regions)}
    (BUILD / "world.json").write_text(json.dumps(world, ensure_ascii=False))
    print("buildings", len(blds), {k: len(v) for k, v in placements.items() if isinstance(v, list)})


# ----------------------------------------------------------------------------- placements
def poisson(poly, spacing, rng, limit=20000):
    """Blue-noise-ish scatter: jittered grid inside a polygon."""
    minx, miny, maxx, maxy = poly.bounds
    xs = np.arange(minx, maxx, spacing)
    ys = np.arange(miny, maxy, spacing)
    PX, PY = np.meshgrid(xs, ys)
    PX = PX + rng.uniform(-0.45, 0.45, PX.shape) * spacing
    PY = PY + rng.uniform(-0.45, 0.45, PY.shape) * spacing
    m = shapely.contains_xy(poly, PX, PY)
    return np.column_stack([PX[m], PY[m]])[:limit]


def place_objects(F, L, G, Z, raw, ground):
    W = box(*WORLD)
    inside = lambda x, y: W.contains(Point(x, y))
    out = {}
    zs = lambda x, y: float(G.sample(Z, x, y))
    chm = np.nan_to_num(raw, nan=0) - ground  # canopy height model

    def pts(cls, layer="infrastructure"):
        return [f for f in pick(F, layer, cls, geom=("Point",)) if inside(f["g"].x, f["g"].y)]

    road_union = unary_union([r["g"] for r in L["roads"] + L["paths"]])

    def face_road(x, y):
        p = Point(x, y)
        q = road_union.interpolate(road_union.project(p)) if road_union.geom_type == "LineString" else None
        if q is None:
            near = shapely.ops.nearest_points(road_union, p)[0]
            q = near
        return math.atan2(q.y - y, q.x - x), p.distance(q)

    out["street_lamps"] = []
    for f in pts("street_lamp"):
        x, y = f["g"].x, f["g"].y
        hd, d = face_road(x, y)
        out["street_lamps"].append([round(x, 2), round(y, 2), round(zs(x, y), 2), round(hd, 3)])
    for key, cls in (("benches", "bench"), ("waste_baskets", "waste_basket"), ("bike_racks", "bicycle_parking"),
                     ("info_boards", "information"), ("bollards", "block"), ("hydrants", "fire_hydrant")):
        out[key] = []
        for f in pts(cls):
            x, y = f["g"].x, f["g"].y
            hd, _ = face_road(x, y)
            out[key].append([round(x, 2), round(y, 2), round(zs(x, y), 2), round(hd, 3)])

    # Trees: mapped single trees and tree rows, plus woodland scatter guided by
    # the canopy height model (skips clearings, sets plausible heights).
    trees = []
    for f in pick(F, "land", "tree", geom=("Point",)):
        x, y = f["g"].x, f["g"].y
        if inside(x, y):
            h = float(np.clip(G.sample(chm, x, y), 3, 14))
            trees.append([x, y, zs(x, y), h, 0])
    for f in pick(F, "land", "tree_row"):
        g = f["g"].intersection(W)
        if g.is_empty:
            continue
        h0 = float((f.get("tags") or {}).get("height", 5) or 5)
        for ln in getattr(g, "geoms", [g]):
            n = max(1, int(ln.length / 3.5))
            for t in np.linspace(0, 1, n):
                q = ln.interpolate(t, normalized=True)
                trees.append([q.x, q.y, zs(q.x, q.y), h0 * RNG.uniform(0.85, 1.15), 1])
    rng = np.random.default_rng(7)
    paved = unary_union([r["g"].buffer(r["width"] / 2 + 1.5) for r in L["roads"] + L["paths"]] + [p["g"] for p in L["parking"]])
    blocked = unary_union([paved] + [b["g"].buffer(2) for b in L["buildings"]])
    for poly in polys(L["wood"]):
        for x, y in poisson(poly, 4.2, rng):
            if blocked.contains(Point(x, y)):
                continue
            # ArcticDEM barely resolves this canopy (median CHM < 0.5 m), so the
            # height model only overrides the typical stand heights when clear.
            kind = 2 if rng.random() < 0.6 else 0  # planted spruce/pine + birch/willow
            h = float(G.sample(chm, x, y))
            if h < 3.0:
                h = rng.uniform(7, 14) if kind == 2 else rng.uniform(4, 8)
            trees.append([x, y, zs(x, y), float(np.clip(h, 2.5, 16)), kind])
    for poly in polys(L["scrub"]):
        for x, y in poisson(poly, 3.0, rng):
            if not blocked.contains(Point(x, y)):
                trees.append([x, y, zs(x, y), float(rng.uniform(1.0, 2.4)), 3])
    out["trees"] = [[round(v, 2) for v in t[:4]] + [int(t[4])] for t in trees]

    lines = {}
    for key, cls in (("fences", "fence"), ("walls", "wall"), ("hedges", "hedge"), ("guard_rails", "guard_rail")):
        lines[key] = []
        for f in pick(F, "infrastructure", cls):
            g = f["g"]
            g = g.exterior if g.geom_type == "Polygon" else g
            g = g.intersection(W)
            for ln in getattr(g, "geoms", [g]):
                if ln.is_empty or ln.length < 1 or ln.geom_type != "LineString":
                    continue
                ln = ln.segmentize(1.5)
                cs = [[round(x, 2), round(y, 2), round(zs(x, y), 2)] for x, y in ln.coords]
                h = (f.get("tags") or {}).get("height")
                lines[key].append({"pts": cs, "height": float(h) if h else None})
    out.update(lines)
    return out


def tri2d(g, max_area=None):
    """Triangulate polygon(s) with holes -> (xy list, tri list)."""
    V, T = [], []
    for p in polys(g):
        if p.area < 0.01:
            continue
        p = shapely.set_precision(p, 0.005)
        for q in polys(p):
            rings = [q.exterior] + list(q.interiors)
            verts, segs, holes = [], [], []
            for ring in rings:
                cs = list(ring.coords)[:-1]
                b = len(verts)
                verts += cs
                segs += [(b + i, b + (i + 1) % len(cs)) for i in range(len(cs))]
            for h in q.interiors:
                holes.append(Polygon(h).representative_point().coords[0])
            d = {"vertices": np.array(verts), "segments": np.array(segs)}
            if holes:
                d["holes"] = np.array(holes)
            t = triangle.triangulate(d, "p" + (f"a{max_area}" if max_area else ""))
            b = len(V)
            V += [[round(float(x), 3), round(float(y), 3)] for x, y in t["vertices"]]
            T += [[int(i) + b for i in tr] for tr in t["triangles"]]
    return {"v": V, "t": T}


def features_for_blender(L, G, Z, regions):
    zs = lambda x, y: round(float(G.sample(Z, x, y)), 3)
    road_lines = []
    for r in L["roads"]:
        g = r["g"].intersection(box(*WORLD))
        for ln in getattr(g, "geoms", [g]):
            if ln.is_empty or ln.geom_type != "LineString":
                continue
            ln = ln.segmentize(2.0)
            road_lines.append({"class": r["class"], "sub": r["sub"], "width": r["width"], "name": r["name"],
                               "pts": [[round(x, 2), round(y, 2), zs(x, y)] for x, y in ln.coords]})
    rock = unary_union([g for n, g in regions if n == "rock"]).buffer(1.5)
    armour = L["land"].boundary.intersection(box(-170, -75, 70, 20)).intersection(rock)
    armour = linemerge(armour) if armour.geom_type == "MultiLineString" else armour
    armour_lines = [[[round(x, 2), round(y, 2)] for x, y in ln.segmentize(0.8).coords]
                    for ln in getattr(armour, "geoms", [armour]) if ln.length > 3]
    # Crossings: zebra markings across the nearest drivable road.
    cross = []
    for f in [f for f in LOADED_F if f["layer"] == "infrastructure" and f.get("class") == "crossing"]:
        p = f["g"]
        if not box(*WORLD).buffer(-5).contains(p):
            continue
        best = min(L["roads"], key=lambda r: r["g"].distance(p))
        if best["g"].distance(p) > 2.0:
            continue
        t = best["g"].project(p)
        a = best["g"].interpolate(max(t - 1, 0))
        b = best["g"].interpolate(min(t + 1, best["g"].length))
        cross.append([round(p.x, 2), round(p.y, 2), zs(p.x, p.y), round(math.atan2(b.y - a.y, b.x - a.x), 3), best["width"]])
    tz = [float(G.sample(Z, x, y)) for x, y in poisson(L["terrace"], 1.0, np.random.default_rng(1))]
    back = LineString([(73.1, 41.1), (37.5, 54.8)])
    bz = [float(G.sample(Z, *back.parallel_offset(3.0, "left").interpolate(t, normalized=True).coords[0]))
          for t in np.linspace(0.1, 0.9, 9)]
    sea_poly = box(-6000, -6000, 6000, 6000).difference(L["lagoon"])
    # Kerbs: edges of the drivable surface (roads + car parks) that face verges,
    # interrupted where footpaths or other paved surfaces meet them.
    drive = unary_union([r["g"].buffer(r["width"] / 2, quad_segs=4) for r in L["roads"] if r["mat"] == "asphalt"] +
                        [p["g"] for p in L["parking"] if p["mat"] == "asphalt"])
    gaps = unary_union([p["g"].buffer(p["width"] / 2 + 0.6) for p in L["paths"]] +
                       [r["g"].buffer(r["width"] / 2 + 0.6) for r in L["roads"] if r["mat"] != "asphalt"] +
                       [L["airfield"].buffer(1.0), L["pedestrian"].buffer(0.6)] + [b["g"].buffer(1.0) for b in L["buildings"]])
    kerb = drive.boundary.intersection(box(*WORLD).buffer(-2)).difference(gaps)
    kerb = linemerge(kerb) if kerb.geom_type == "MultiLineString" else kerb
    kerbs = []
    for ln in getattr(kerb, "geoms", [kerb]):
        if ln.geom_type != "LineString" or ln.length < 2.0:
            continue
        ln = ln.simplify(0.05).segmentize(1.5)
        kerbs.append([[round(x, 2), round(y, 2), zs(x, y)] for x, y in ln.coords])
    return {
        "armour_lines": armour_lines,
        "kerbs": kerbs,
        "crossings": cross,
        "terrace_z": round(float(np.percentile(tz, 20)), 3),  # DEM mixes in the facade/roof edge
        "roof_path_z": round(float(np.median(bz)), 3),
        "sea_tri": tri2d(sea_poly),
        "lagoon_tri": tri2d(L["lagoon"]),
        "roads": road_lines,
        "parking": [{"mat": p["mat"], "poly": [[round(x, 2), round(y, 2)] for x, y in polys(p["g"])[0].exterior.coords]} for p in L["parking"] if polys(p["g"])],
        "sill": [[round(x, 2), round(y, 2)] for x, y in L["sill"].coords],
        "boardwalk": [[round(x, 2), round(y, 2)] for x, y in L["boardwalk"].exterior.coords],
        "slipway": [[round(x, 2), round(y, 2)] for x, y in L["slipway"].exterior.coords],
        "service": [[round(x, 2), round(y, 2)] for x, y in L["service"]["g"].exterior.coords],
        "terrace": [[round(x, 2), round(y, 2)] for x, y in L["terrace"].exterior.coords],
        "terrace_top": tri2d(L["terrace"].difference(L["long_pool"].buffer(0.35, join_style="mitre"))),
        "terrace_steps": [tri2d(L["terrace"].buffer(STEP_W * (k + 1), join_style="mitre").difference(
            L["terrace"].buffer(STEP_W * k, join_style="mitre")).difference(L["service"]["g"])) for k in range(N_STEPS)],
        "long_pool": [[round(x, 3), round(y, 3)] for x, y in L["long_pool"].exterior.coords],
        "ring_pool": [[round(x, 3), round(y, 3)] for x, y in L["ring_pool"].exterior.coords],
        "roofs": [tri2d(Polygon(b["poly"], b["holes"])) for b in BLDS],
    }


if __name__ == "__main__":
    main()
