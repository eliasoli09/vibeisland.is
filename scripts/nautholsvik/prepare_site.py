"""cache/ (raw Overture + ArcticDEM) -> data/ (small, committed, local metres).

Plain Python. Requires: numpy pyarrow shapely pyproj rasterio.
  data/features.geojson  all mapped features in the local frame (see site.py)
  data/dsm.npz           ArcticDEM surface model on a 2 m local grid, metres AMSL
"""
import json, pathlib
import numpy as np, pyarrow.parquet as pq, rasterio, shapely.wkb, shapely.ops
from shapely.geometry import box, mapping
from pyproj import Transformer
from config import PROJ, ELLIPSOID_TO_MSL, DEM_WATER_FLAT, BACKDROP

HERE = pathlib.Path(__file__).resolve().parent
CACHE, DATA = HERE / "cache", HERE / "data"
TO_LOCAL = Transformer.from_crs(4326, PROJ, always_xy=True)
CLIP = box(*BACKDROP)

KEEP_TAGS = {"width", "height", "barrier", "material", "surface", "layer", "man_made", "amenity",
             "leisure", "natural", "note", "bath:hot", "capacity", "bicycle_parking", "parking",
             "building:levels", "roof:shape", "tourism", "support", "lamp_mount", "highway"}


def local(g):
    g = shapely.ops.transform(lambda x, y, z=None: TO_LOCAL.transform(x, y), g)
    return shapely.set_precision(g, 0.01)


def rows(name):
    for r in pq.read_table(CACHE / f"{name}.parquet").to_pylist():
        g = local(shapely.wkb.loads(r["geometry"]))
        if not g.intersects(CLIP):
            continue
        if name != "land" or g.area < 1e7:  # the whole-island polygon is clipped, others kept whole
            yield r, g
        else:
            yield r, g.intersection(CLIP)


def props(layer, r, **extra):
    p = {"layer": layer, "subtype": r.get("subtype"), "class": r.get("class"),
         "name": (r.get("names") or {}).get("primary")}
    tags = {k: v for k, v in (r.get("source_tags") or []) if k in KEEP_TAGS}
    if tags:
        p["tags"] = tags
    p.update({k: v for k, v in extra.items() if v is not None})
    return {k: v for k, v in p.items() if v is not None}


def main():
    feats = []
    add = lambda g, p: feats.append({"type": "Feature", "properties": p, "geometry": mapping(g)})
    for name in ("water", "land", "land_use", "land_cover", "infrastructure"):
        for r, g in rows(name):
            if name == "land_cover" and r.get("subtype") in ("snow",):
                continue
            add(g, props(name, r, surface=r.get("surface"), height=r.get("height")))
    for r, g in rows("building"):
        add(g, props("building", r, height=r.get("height"), floors=r.get("num_floors"),
                     min_height=r.get("min_height"), roof_shape=r.get("roof_shape"),
                     underground=r.get("is_underground") or None))
    for r, g in rows("segment"):
        flags = sorted({v for f in (r.get("road_flags") or []) for v in f["values"]})
        widths = [w.get("value") for w in (r.get("width_rules") or []) if w.get("value")]
        surf = [s.get("value") for s in (r.get("road_surface") or []) if s.get("value")]
        add(g, props("segment", r, subclass=r.get("subclass"), flags=flags or None,
                     width=max(widths) if widths else None, surface=surf[0] if surf else None))
    for r, g in rows("place"):
        cat = (r.get("taxonomy") or {}).get("primary") if isinstance(r.get("taxonomy"), dict) else None
        add(g, props("place", r, category=cat or r.get("basic_category")))
    DATA.mkdir(exist_ok=True)
    meta = {"crs_proj4": PROJ, "extent": BACKDROP,
            "sources": ["Overture Maps Foundation release 2026-09-23.1 (ODbL; (c) OpenStreetMap contributors)"]}
    (DATA / "features.geojson").write_text(json.dumps(
        {"type": "FeatureCollection", "metadata": meta, "features": feats},
        ensure_ascii=False, separators=(",", ":")))
    print("features", len(feats))

    # DSM resampled (bilinear) onto the local 2 m grid, heights in cm AMSL.
    with rasterio.open(CACHE / "arcticdem_dem.tif") as src:
        dem = src.read(1).astype(np.float64)
        inv = ~src.transform
        nodata = src.nodata
    x0, y0, x1, y1 = BACKDROP
    xs, ys = np.arange(x0, x1 + 1e-6, 2.0), np.arange(y0, y1 + 1e-6, 2.0)
    X, Y = np.meshgrid(xs, ys)
    px, py = Transformer.from_crs(PROJ, 3413, always_xy=True).transform(X, Y)
    c, r = inv * (px, py)
    c, r = c - 0.5, r - 0.5  # pixel centres
    c0, r0 = np.floor(c).astype(int), np.floor(r).astype(int)
    fc, fr = c - c0, r - r0
    v = lambda rr, cc: dem[np.clip(rr, 0, dem.shape[0] - 1), np.clip(cc, 0, dem.shape[1] - 1)]
    corners = [v(r0, c0), v(r0, c0 + 1), v(r0 + 1, c0), v(r0 + 1, c0 + 1)]
    z = ((1 - fr) * ((1 - fc) * corners[0] + fc * corners[1]) + fr * ((1 - fc) * corners[2] + fc * corners[3]))
    invalid = np.zeros_like(z, bool)
    for k in corners:
        invalid |= (k == nodata) | (np.abs(k - DEM_WATER_FLAT) < 1e-3)
    zc = np.round((z - ELLIPSOID_TO_MSL) * 100).astype(np.int16)
    zc[invalid] = -32768  # nodata or ArcticDEM flattened water (not a measurement)
    np.savez_compressed(DATA / "dsm.npz", z_cm=zc, x0=x0, y0=y0, step=2.0,
                        note="ArcticDEM v4.1 2m mosaic (PGC, CC-BY-4.0); cm above MSL; -32768 = water/nodata")
    print("dsm", zc.shape, (zc == -32768).mean())


if __name__ == "__main__":
    main()
