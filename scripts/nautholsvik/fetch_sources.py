"""Download the open source data used for the Nauthólsvík reconstruction.

Plain Python 3.11+ (not Blender). Requires: requests pyarrow rasterio pyproj.
Writes into scripts/nautholsvik/cache/ (git-ignored). Run once; prepare_site.py
turns the cache into the small committed files in data/.

Sources
  * Overture Maps Foundation, release 2026-09-23.1 (ODbL, derived from
    OpenStreetMap contributors) - buildings, transportation, base, places.
  * ArcticDEM mosaic v4.1, 2 m, tile 14_52_2_1 (Polar Geospatial Center,
    CC-BY-4.0). A digital *surface* model: includes buildings and trees.
"""
import io, os, re, sys, time, threading, pathlib
from concurrent.futures import ThreadPoolExecutor
import requests, pyarrow as pa, pyarrow.parquet as pq

HERE = pathlib.Path(__file__).resolve().parent
CACHE = HERE / "cache"
OVERTURE = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com"
RELEASE = "release/2026-09-23.1"
THEMES = ["buildings/type=building", "transportation/type=segment", "base/type=water",
          "base/type=land", "base/type=land_use", "base/type=land_cover",
          "base/type=infrastructure", "places/type=place"]
# lon/lat window: Nauthólsvík, Reykjavík University, Öskjuhlíð slopes, Kársnes shore.
W, S, E, N = -21.945, 64.113, -21.900, 64.131
DEM = ("https://pgc-opendata-dems.s3.us-west-2.amazonaws.com/arcticdem/mosaics/v4.1/"
       "2m/14_52/14_52_2_1_2m_v4.1_dem.tif")
DEM_BOUNDS = (-21.950, 64.110, -21.895, 64.134)

_local = threading.local()


def get(url, **kw):
    for attempt in range(8):
        try:
            if not hasattr(_local, "s"):
                _local.s = requests.Session()
            r = _local.s.get(url, timeout=120, **kw)
            r.raise_for_status()
            return r
        except Exception:  # transient TLS resets through the proxy
            _local.s = requests.Session()
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"failed: {url}")


class RangeFile(io.RawIOBase):
    """Seekable HTTP file so pyarrow only downloads footers + matching row groups."""

    def __init__(self, url, size):
        self.url, self.size, self.pos = url, size, 0

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = {0: off, 1: self.pos + off, 2: self.size + off}[whence]
        return self.pos

    def read(self, n=-1):
        if n < 0:
            n = self.size - self.pos
        if n == 0:
            return b""
        data = get(self.url, headers={"Range": f"bytes={self.pos}-{self.pos + n - 1}"}).content
        self.pos += len(data)
        return data

    def readinto(self, b):
        d = self.read(len(b))
        b[:len(d)] = d
        return len(d)


def keys(prefix):
    xml = get(f"{OVERTURE}/?list-type=2&prefix={RELEASE}/theme={prefix}/").text
    return [(k, int(s)) for k, s in re.findall(r"<Key>([^<]+)</Key>.*?<Size>(\d+)</Size>", xml)]


def outside(b):
    return b["xmin"] > E or b["xmax"] < W or b["ymin"] > N or b["ymax"] < S


def scan(item):
    key, size = item
    f = pq.ParquetFile(RangeFile(f"{OVERTURE}/{key}", size))
    out = []
    for i in range(f.metadata.num_row_groups):
        rg = f.metadata.row_group(i)
        st = {rg.column(c).path_in_schema: rg.column(c).statistics for c in range(rg.num_columns)}
        try:
            if (st["bbox.xmin"].min > E or st["bbox.xmax"].max < W or
                    st["bbox.ymin"].min > N or st["bbox.ymax"].max < S):
                continue
        except (KeyError, AttributeError):
            pass
        t = f.read_row_group(i)
        keep = [j for j, b in enumerate(t.column("bbox").to_pylist()) if not outside(b)]
        if keep:
            out.append(t.take(keep))
    return out


def fetch_overture():
    for theme in THEMES:
        name = theme.split("=")[-1]
        dest = CACHE / f"{name}.parquet"
        if dest.exists():
            continue
        tables = []
        with ThreadPoolExecutor(8) as ex:
            for part in ex.map(scan, keys(theme)):
                tables += part
        pq.write_table(pa.concat_tables(tables, promote_options="permissive"), dest)
        print(theme, sum(t.num_rows for t in tables))


def fetch_dem():
    dest = CACHE / "arcticdem_dem.tif"
    if dest.exists():
        return
    os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
    import rasterio
    from rasterio.windows import from_bounds
    from pyproj import Transformer
    t = Transformer.from_crs(4326, 3413, always_xy=True)
    xs, ys = zip(*[t.transform(x, y) for x in DEM_BOUNDS[::2] for y in DEM_BOUNDS[1::2]])
    with rasterio.open("/vsicurl/" + DEM) as src:
        win = from_bounds(min(xs), min(ys), max(xs), max(ys), src.transform)
        win = win.round_offsets().round_lengths()
        a = src.read(1, window=win)
        prof = src.profile
        prof.update(width=a.shape[1], height=a.shape[0], transform=src.window_transform(win),
                    compress="deflate", tiled=False, blockxsize=None, blockysize=None)
    with rasterio.open(dest, "w", **prof) as o:
        o.write(a, 1)
    print("dem", a.shape)


if __name__ == "__main__":
    CACHE.mkdir(exist_ok=True)
    fetch_overture()
    fetch_dem()
    sys.exit(0)
