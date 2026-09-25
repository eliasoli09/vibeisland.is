"""build/world.* -> Nauthólsvík .blend + .glb (+ preview renders).

Run with Blender 4.2+ (tested 5.0.1):
    blender -b --factory-startup -P scripts/nautholsvik/build_blend.py [-- --no-render]
or with the `bpy` wheel:  python3 scripts/nautholsvik/build_blend.py

Units: 1 BU = 1 m. +X east, +Y north, +Z up (m above mean sea level).
The glTF export is Y-up (standard); the local frame is described in
public/projects/nautholsvik/README.md.
"""
import bpy, bmesh, json, math, pathlib, sys, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon

HERE = pathlib.Path(__file__).resolve().parent
BUILD = HERE / "build"
OUT = HERE.parents[1] / "public" / "projects" / "nautholsvik"
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = "--no-render" not in ARGS
EXPORT = "--no-export" not in ARGS

W = json.loads((BUILD / "world.json").read_text())
D = np.load(BUILD / "world.npz")
WATER_Z = W["water_z"]
rng = random.Random(64)
nrng = np.random.default_rng(64)


# ============================================================================ helpers
class HeightGrid:
    def __init__(self, Z, g):
        self.Z, self.x0, self.y0, self.res, self.nx, self.ny = Z, g[0], g[1], g[2], int(g[3]), int(g[4])

    def __call__(self, x, y):
        c = min(max((x - self.x0) / self.res, 0), self.nx - 1.001)
        r = min(max((y - self.y0) / self.res, 0), self.ny - 1.001)
        c0, r0 = int(c), int(r)
        fc, fr = c - c0, r - r0
        Z = self.Z
        return float((1 - fr) * ((1 - fc) * Z[r0, c0] + fc * Z[r0, c0 + 1]) +
                     fr * ((1 - fc) * Z[r0 + 1, c0] + fc * Z[r0 + 1, c0 + 1]))


HZ = HeightGrid(D["Z"], D["grid"])
BZ = HeightGrid(D["BZ"], D["bgrid"])


def ground(x, y):
    w = W["world"]
    if w[0] <= x <= w[2] and w[1] <= y <= w[3]:
        return HZ(x, y)
    return BZ(x, y)


def collection(name, parent=None, hide_render=False):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    c.hide_render = hide_render
    return c


def mesh_object(name, verts, faces, coll, mats=(), mat_idx=None, uv=None, smooth=False, props=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(map(int, f)) for f in faces])
    me.validate(clean_customdata=False)
    for m in mats:
        me.materials.append(m)
    if mat_idx is not None and len(me.polygons):
        me.polygons.foreach_set("material_index", np.asarray(mat_idx, dtype=np.int32))
    if uv is not None and len(me.polygons):
        layer = me.uv_layers.new(name="UVMap")
        li = np.zeros(len(me.loops), dtype=np.int32)
        me.loops.foreach_get("vertex_index", li)
        uvv = np.asarray(uv, dtype=np.float32)[li]
        layer.data.foreach_set("uv", uvv.ravel())
    if smooth:
        me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), dtype=bool))
    me.update()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    for k, v in (props or {}).items():
        ob[k] = v
    return ob


class MeshBuilder:
    """Accumulates geometry (verts, faces, per-face material, per-vertex UV)."""

    def __init__(self):
        self.v, self.f, self.m, self.uv = [], [], [], []

    def add(self, verts, faces, mat=0, uv=None):
        b = len(self.v)
        self.v += [tuple(v) for v in verts]
        self.f += [tuple(i + b for i in f) for f in faces]
        self.m += [mat] * len(faces)
        self.uv += list(uv) if uv is not None else [(v[0], v[1]) for v in verts]

    def add_mesh(self, me_data, matrix, mat=0, uv_scale=1.0):
        verts, faces = me_data
        vs = [matrix @ Vector(v) for v in verts]
        self.add([tuple(v) for v in vs], faces, mat, uv=[(v.x * uv_scale + v.z * 0.37 * uv_scale, v.y * uv_scale + v.z * uv_scale) for v in vs])

    def box(self, center, size, rot=0.0, mat=0, uv_scale=1.0):
        cx, cy, cz = center
        sx, sy, sz = (s / 2 for s in size)
        c, s = math.cos(rot), math.sin(rot)
        pts = []
        for z in (-sz, sz):
            for x, y in ((-sx, -sy), (sx, -sy), (sx, sy), (-sx, sy)):
                pts.append((cx + x * c - y * s, cy + x * s + y * c, cz + z))
        faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        # Per-face UVs need split verts: emit each face separately.
        for f in faces:
            vs = [pts[i] for i in f]
            e1 = Vector(vs[1]) - Vector(vs[0])
            e2 = Vector(vs[3]) - Vector(vs[0])
            u = [((Vector(p) - Vector(vs[0])).dot(e1.normalized()) * uv_scale,
                  (Vector(p) - Vector(vs[0])).dot(e2.normalized()) * uv_scale) for p in vs]
            self.add(vs, [(0, 1, 2, 3)], mat, uv=u)

    def cylinder(self, base, radius, height, seg=12, mat=0, cap=True, r_top=None):
        x, y, z = base
        r_top = radius if r_top is None else r_top
        ring0 = [(x + radius * math.cos(2 * math.pi * i / seg), y + radius * math.sin(2 * math.pi * i / seg), z) for i in range(seg)]
        ring1 = [(x + r_top * math.cos(2 * math.pi * i / seg), y + r_top * math.sin(2 * math.pi * i / seg), z + height) for i in range(seg)]
        verts = ring0 + ring1
        faces = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
        if cap:
            faces.append(tuple(range(seg, 2 * seg)))
            faces.append(tuple(reversed(range(seg))))
        uv = [(i / seg * 2 * math.pi * radius, 0) for i in range(seg)] + [(i / seg * 2 * math.pi * radius, height) for i in range(seg)]
        self.add(verts, faces, mat, uv)

    def object(self, name, coll, mats, smooth=False, props=None):
        return mesh_object(name, self.v, self.f, coll, mats, self.m, self.uv, smooth, props)


def polygon_faces(outer, holes=()):
    """Triangulate a 2D ring with holes (mathutils scanfill). Returns (pts2d, tris)."""
    rings = [list(outer)] + [list(h) for h in holes]
    pts = [p for r in rings for p in r]
    tris = tessellate_polygon([[Vector((p[0], p[1], 0)) for p in r] for r in rings])
    return pts, [tuple(t) for t in tris]


def ring_area(r):
    return 0.5 * sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))


def ccw(r):
    r = [tuple(p[:2]) for p in r]
    if r[0] == r[-1]:
        r = r[:-1]
    return r if ring_area(r) > 0 else r[::-1]


def offset_ring(r, d):
    """Mitred offset of a CCW ring (positive d = outward)."""
    n = len(r)
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(r[i - 1]), Vector(r[i]), Vector(r[(i + 1) % n])
        e0 = (p1 - p0).normalized()
        e1 = (p2 - p1).normalized()
        n0 = Vector((e0.y, -e0.x))
        n1 = Vector((e1.y, -e1.x))
        bis = (n0 + n1)
        if bis.length < 1e-6:
            bis = n0
        bis.normalize()
        k = d / max(bis.dot(n0), 0.3)
        q = p1 + bis * k
        out.append((q.x, q.y))
    return out


# ============================================================================ textures
TEX_N = 512


def tileable_noise(n, beta, seed):
    r = np.random.default_rng(seed)
    F = np.fft.fft2(r.normal(size=(n, n)))
    f = np.fft.fftfreq(n)
    k = np.sqrt(f[:, None] ** 2 + f[None, :] ** 2)
    k[0, 0] = 1
    F = F / k ** beta
    F[0, 0] = 0
    img = np.real(np.fft.ifft2(F))
    return (img - img.min()) / (img.max() - img.min())


def image(name, rgb, non_color=False):
    n = rgb.shape[0]
    rgb = np.clip(rgb, 0, 1)
    if not non_color:  # colours are authored in linear space; byte images store sRGB
        rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * rgb ** (1 / 2.4) - 0.055)
    rgba = np.concatenate([rgb, np.ones((n, n, 1))], axis=2).astype(np.float32)
    tmp = bpy.data.images.new(name + "_tmp", n, n, alpha=False, float_buffer=False)
    if not non_color:
        tmp.colorspace_settings.name = "sRGB"
    tmp.pixels.foreach_set(rgba.ravel())
    path = BUILD / "textures" / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp.filepath_raw = str(path)
    tmp.file_format = "PNG"
    tmp.save()
    bpy.data.images.remove(tmp)
    img = bpy.data.images.load(str(path))
    img.name = name
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    img.pack()
    return img


def normal_from_height(h, strength):
    gy, gx = np.gradient(h)
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nrm = np.dstack([-gx * strength, -gy * strength, np.ones_like(h)])
    nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    return nrm * 0.5 + 0.5


def srgb_to_lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def hexc(h):
    return srgb_to_lin([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def tex_mix(c0, c1, t):
    return c0[None, None, :] * (1 - t[..., None]) + c1[None, None, :] * t[..., None]


def make_textures():
    n = TEX_N
    T = {}
    big, mid, fine = tileable_noise(n, 1.6, 1), tileable_noise(n, 1.0, 2), tileable_noise(n, 0.4, 3)
    grain = np.random.default_rng(4).random((n, n))
    # Golden shell sand imported to the beach (photos: warm yellow-beige).
    t = 0.3 * big + 0.45 * mid + 0.25 * fine
    sand = tex_mix(hexc("#b99a62"), hexc("#d8bb84"), t) * (0.9 + 0.2 * grain[..., None])
    T["sand"] = (sand, normal_from_height(0.5 * mid + 0.5 * fine, 2.0))
    wet = tex_mix(hexc("#7a5a2e"), hexc("#94744a"), t) * (0.9 + 0.15 * grain[..., None])
    T["sand_wet"] = (wet, normal_from_height(0.3 * mid + 0.7 * fine, 1.5))
    seabed = tex_mix(hexc("#5e5236"), hexc("#7a6c4a"), big) * (0.85 + 0.2 * grain[..., None])
    T["seabed"] = (seabed, normal_from_height(mid, 2.0))
    blades = tileable_noise(n, 0.2, 5)
    g = tex_mix(hexc("#4a6e28"), hexc("#6f8f3a"), 0.3 * big + 0.3 * mid + 0.4 * blades)
    g *= (0.85 + 0.25 * mid[..., None])
    T["grass"] = (g, normal_from_height(blades, 3.0))
    ff = tex_mix(hexc("#3b3f22"), hexc("#6a5a36"), 0.5 * big + 0.5 * fine)
    T["forest_floor"] = (ff, normal_from_height(fine, 3.0))
    # Icelandic basalt: dark grey with slight blue/brown variation and vesicles.
    vesic = (tileable_noise(n, 0.1, 6) > 0.72).astype(float)
    rock = tex_mix(hexc("#3c3c3e"), hexc("#5d5a57"), 0.6 * big + 0.4 * mid) * (1 - 0.35 * vesic[..., None])
    T["rock"] = (rock, normal_from_height(0.6 * mid + 0.4 * fine - 0.3 * vesic, 4.0))
    pebbles = tileable_noise(n, 0.6, 7)
    gravel = tex_mix(hexc("#6d6558"), hexc("#a39886"), pebbles) * (0.85 + 0.3 * grain[..., None])
    T["gravel"] = (gravel, normal_from_height(pebbles, 5.0))
    agg = (grain > 0.93).astype(float) * 0.25
    asph = tex_mix(hexc("#2e2f31"), hexc("#46474a"), 0.5 * big + 0.5 * fine) + agg[..., None] * 0.08
    T["asphalt"] = (asph, normal_from_height(fine + agg, 1.5))
    conc = tex_mix(hexc("#a9a7a1"), hexc("#c4c1ba"), 0.6 * big + 0.4 * fine) * (0.95 + 0.1 * grain[..., None])
    T["concrete"] = (conc, normal_from_height(fine, 0.8))
    T["concrete_dark"] = (conc * 0.62, normal_from_height(0.7 * fine + 0.3 * mid, 1.2))
    # 0.4 x 0.2 m pavers (texture tile = 2 m).
    yy, xx = np.mgrid[0:n, 0:n] / n
    row = np.floor(yy * 10)
    joint = ((np.abs(((xx * 5 + 0.5 * (row % 2)) % 1) - 0.5) > 0.47) | (np.abs((yy * 10 % 1) - 0.5) > 0.44)).astype(float)
    pav = tex_mix(hexc("#8f8b84"), hexc("#b3aea5"), 0.5 * big + 0.5 * tileable_noise(n, 0.3, 8))
    pav = pav * (1 - 0.45 * joint[..., None])
    T["paving"] = (pav, normal_from_height(-joint * 0.6 + 0.1 * fine, 2.0))
    # Weathered grey boardwalk planks (0.15 m boards, tile = 2 m).
    plank = np.floor(xx * 13.33)
    shade = np.random.default_rng(9).random(64)[plank.astype(int) % 64]
    gaps = (np.abs((xx * 13.33 % 1) - 0.5) > 0.46).astype(float)
    streak = tileable_noise(n, 0.8, 10)
    wood_g = tex_mix(hexc("#5c5953"), hexc("#817d75"), 0.5 * shade + 0.5 * streak) * (1 - 0.6 * gaps[..., None])
    T["deck"] = (wood_g, normal_from_height(-gaps * 0.8 + streak * 0.2, 2.0))
    # Larch shutter boards (vertical, warm orange-brown).
    larch = tex_mix(hexc("#9b5a2e"), hexc("#c98a52"), 0.5 * shade.T + 0.5 * tileable_noise(n, 1.2, 11).T)
    T["larch"] = (larch * (1 - 0.5 * gaps.T[..., None]), normal_from_height(-gaps.T * 0.5, 2.0))
    # Horizontal-coursed basalt cladding (service centre tower).
    course = np.floor(yy * 12)
    stone = np.random.default_rng(12).random(16)[(course % 16).astype(int)]
    cj = ((np.abs((yy * 12 % 1) - 0.5) > 0.45) | (np.abs(((xx * 3 + course * 0.37) % 1) - 0.5) > 0.48)).astype(float)
    clad = tex_mix(hexc("#4a4b4d"), hexc("#6e6d6a"), 0.5 * stone + 0.5 * mid) * (1 - 0.4 * cj[..., None])
    T["stone_clad"] = (clad, normal_from_height(-cj * 0.8 + 0.2 * fine, 2.5))
    # Generic facade: 3 m bays x 3.2 m floors with windows (tile 6 m x 6.4 m).
    wx = ((xx * 2) % 1)
    wy = ((yy * 2) % 1)
    win = (wx > 0.2) & (wx < 0.8) & (wy > 0.3) & (wy < 0.8)
    fac = np.where(win[..., None], hexc("#20262c") + 0.08 * big[..., None], hexc("#d6d3cc") * (0.93 + 0.1 * fine[..., None]))
    T["facade"] = (fac, normal_from_height(win.astype(float) * -0.5, 2.0))
    ribs = 0.5 + 0.5 * np.cos(xx * 2 * np.pi * 20)
    T["metal"] = (tex_mix(hexc("#9ea3a6"), hexc("#c3c7c9"), ribs * 0.6 + 0.4 * big), normal_from_height(ribs, 1.5))
    tiles = ((np.abs((xx * 16 % 1) - 0.5) > 0.46) | (np.abs((yy * 16 % 1) - 0.5) > 0.46)).astype(float)
    T["blue_tile"] = (hexc("#1d2d4f") * (1 - 0.3 * tiles[..., None]) * (0.9 + 0.2 * fine[..., None]), normal_from_height(-tiles * 0.5, 2.0))
    T["roof"] = (tex_mix(hexc("#3a3c3f"), hexc("#55585b"), big), normal_from_height(fine, 0.5))
    return {k: (image(f"T_{k}", c), image(f"N_{k}", nn, True)) for k, (c, nn) in T.items()}


# ============================================================================ materials
MATS = {}


def material(name, color=(0.5, 0.5, 0.5), rough=0.8, metal=0.0, tex=None, tile=1.0, alpha=1.0,
             emission=None, normal_strength=0.6, transmission=0.0, ior=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Base Color"].default_value = (*color[:3], 1.0)
    if tex:
        col, nrm = TEX[tex]
        uvn = nt.nodes.new("ShaderNodeUVMap")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1 / tile, 1 / tile, 1)
        nt.links.new(uvn.outputs["UV"], mp.inputs["Vector"])
        ti = nt.nodes.new("ShaderNodeTexImage")
        ti.image = col
        nt.links.new(mp.outputs["Vector"], ti.inputs["Vector"])
        nt.links.new(ti.outputs["Color"], bsdf.inputs["Base Color"])
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = nrm
        nt.links.new(mp.outputs["Vector"], tn.inputs["Vector"])
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    if transmission:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if ior:
        bsdf.inputs["IOR"].default_value = ior
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission[:3], 1)
        bsdf.inputs["Emission Strength"].default_value = emission[3]
    m.diffuse_color = (*color[:3], alpha)
    MATS[name] = m
    return m


def make_materials():
    g = lambda h: tuple(hexc(h))
    surf = {
        "seabed": material("Seabed", g("#6a5d40"), 0.9, tex="seabed", tile=6),
        "grass": material("Grass", g("#6f8f3e"), 0.95, tex="grass", tile=5),
        "forest_floor": material("ForestFloor", g("#4a4a2a"), 0.95, tex="forest_floor", tile=5),
        "sand": material("Sand_Golden", g("#d8b77a"), 0.95, tex="sand", tile=3),
        "rock": material("Basalt", g("#4a4a4b"), 0.85, tex="rock", tile=3, normal_strength=1.0),
        "gravel": material("Gravel", g("#8a8171"), 0.95, tex="gravel", tile=2.5),
        "paving": material("Pavers", g("#a19c93"), 0.85, tex="paving", tile=2),
        "asphalt": material("Asphalt", g("#3a3b3d"), 0.75, tex="asphalt", tile=4),
        "concrete": material("Concrete", g("#b8b5ae"), 0.8, tex="concrete", tile=4),
        "sand_wet": material("Sand_Wet", g("#9a7b4c"), 0.35, tex="sand_wet", tile=3),
        "grass_worn": material("GrassWorn", g("#8a8a50"), 0.95, tex="grass", tile=5),
    }
    # Water: glass-like (transmission, IOR 1.333) tinted by the base colour; exports
    # as KHR_materials_transmission. Engines normally swap in their own water shader.
    material("Water_Sea", g("#17486a"), 0.03, transmission=0.72, ior=1.333)
    material("Water_Lagoon", g("#2f7f86"), 0.03, transmission=0.8, ior=1.333)
    material("Water_HotPool", g("#8fcfc4"), 0.02, transmission=1.0, ior=1.333)
    material("Deck_Wood", g("#96928a"), 0.8, tex="deck", tile=2)
    material("Larch", g("#b3743f"), 0.7, tex="larch", tile=2)
    material("BlueTile", g("#1d2d4f"), 0.35, tex="blue_tile", tile=1)
    material("StoneClad", g("#5a5a5a"), 0.85, tex="stone_clad", tile=3)
    material("ConcreteDark", g("#7d7b76"), 0.85, tex="concrete_dark", tile=3)
    material("PoolWhite", g("#e8e8e4"), 0.5)
    material("PoolFloor", g("#8fb3b0"), 0.6)
    material("Facade", g("#d6d3cc"), 0.8, tex="facade", tile=6)
    material("Facade_Glass", g("#5b7285"), 0.15, metal=0.3)
    material("Metal_Clad", g("#b3b8ba"), 0.45, metal=0.6, tex="metal", tile=4)
    material("Roof", g("#46484b"), 0.85, tex="roof", tile=5)
    material("Glass", g("#9fb6bf"), 0.05, alpha=0.3)
    material("Steel", g("#8e9295"), 0.35, metal=1.0)
    material("PaintWhite", g("#f0f0ec"), 0.5)
    material("PaintYellow", g("#f2c230"), 0.5)
    material("PaintBlue", g("#1f5fae"), 0.5)
    material("PaintRed", g("#b8322a"), 0.5)
    material("Buoy_Yellow", g("#f4c518"), 0.4)
    material("Rope", g("#d8d2b8"), 0.9)
    material("Bark", g("#4b3b2c"), 0.9)
    material("Bark_Birch", g("#cfc8bb"), 0.8)
    material("Leaves_Birch", g("#6f9a3a"), 0.8)
    material("Leaves_Spruce", g("#27402a"), 0.85)
    material("Leaves_Poplar", g("#5a8435"), 0.8)
    material("Shrub", g("#4f6d2e"), 0.9)
    material("Lamp_Head", g("#303235"), 0.5, metal=0.5, emission=(1.0, 0.85, 0.6, 0.0))
    material("Wood_Bench", g("#8a5a36"), 0.8)
    material("Net", g("#e8e8e8"), 0.9, alpha=0.25)
    material("Flag", (1, 1, 1), 0.8)
    for i, h in enumerate(["#e9e6de", "#c9362c", "#2f5d8a", "#f1e3b0", "#9aa3a8", "#e8d7c1", "#6d8f7a"]):
        material(f"House_{i}", g(h), 0.7)
    material("Roof_Red", g("#8e2b24"), 0.7)
    material("Roof_Dark", g("#2f3336"), 0.8)
    material("Collider", (1, 0, 1), 1, alpha=0.2)
    # Terrain uses its own copies (they multiply by the terrain's vertex colour).
    terrain = {}
    for k in W["surfaces"]:
        m = surf[k]
        if m.name not in terrain:
            c = m.copy()
            c.name = "Terrain_" + m.name
            terrain[m.name] = c
    return [terrain[surf[k].name] for k in W["surfaces"]]


# ============================================================================ terrain
def build_terrain(coll, surf_mats):
    V, T, M = D["V"], D["T"], D["M"]
    C = V[T].mean(axis=1)
    x0, y0, x1, y1 = W["world"]
    step = 150.0
    tiles = {}
    ix = np.floor((C[:, 0] - x0) / step).astype(int)
    iy = np.floor((C[:, 1] - y0) / step).astype(int)
    for key in set(zip(ix.tolist(), iy.tolist())):
        sel = (ix == key[0]) & (iy == key[1])
        tri = T[sel]
        used, inv = np.unique(tri.ravel(), return_inverse=True)
        verts = V[used]
        faces = inv.reshape(-1, 3)
        ob = mesh_object(f"Terrain_{key[0]}_{key[1]}", verts, faces, coll, surf_mats, M[sel], verts[:, :2], smooth=True,
                         props={"collider": "trimesh", "surface": "terrain"})
        tiles[key] = ob
    # Large-scale brightness/hue variation as a vertex colour (breaks up texture
    # tiling; glTF COLOR_0 multiplies baseColor the same way).
    for ob in tiles.values():
        me = ob.data
        co = np.zeros(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        n1 = (np.sin(co[:, 0] * 0.043 + np.sin(co[:, 1] * 0.031) * 2.1) * np.cos(co[:, 1] * 0.037 + 0.7) +
              0.5 * np.sin(co[:, 0] * 0.13 + co[:, 1] * 0.11) * np.cos(co[:, 1] * 0.17 - co[:, 0] * 0.07))
        v = 0.9 + 0.08 * n1
        col = np.column_stack([v * 1.0, v * (1.0 + 0.02 * n1), v * (0.98 - 0.02 * n1), np.ones_like(v)])
        ca = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        ca.data.foreach_set("color", col.astype(np.float32).ravel())
    for m in dict.fromkeys(surf_mats):
        nt = m.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        link = bsdf.inputs["Base Color"].links
        if not link:
            continue
        src = link[0].from_socket
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(src, mix.inputs[6])
        nt.links.new(ca.outputs["Color"], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    # Surface id per face as an attribute (game physics: grip per surface).
    for ob in tiles.values():
        me = ob.data
        at = me.attributes.new("surface_id", "INT", "FACE")
        idx = np.zeros(len(me.polygons), dtype=np.int32)
        me.polygons.foreach_get("material_index", idx)
        at.data.foreach_set("value", idx)
    print("terrain tiles", len(tiles))

    # Backdrop (visual only): 8 m grid outside the detailed world.
    BZa, Binside = D["BZ"], D["Binside"]
    g = D["bgrid"]
    nx, ny = int(g[3]), int(g[4])
    xs = g[0] + np.arange(nx) * g[2]
    ys = g[1] + np.arange(ny) * g[2]
    X, Y = np.meshgrid(xs, ys)
    verts = np.column_stack([X.ravel(), Y.ravel(), BZa.ravel()])
    faces, mats = [], []
    for r in range(ny - 1):
        for c in range(nx - 1):
            if Binside[r, c] and Binside[r + 1, c + 1] and Binside[r, c + 1] and Binside[r + 1, c]:
                continue
            a, b, cc, d = r * nx + c, r * nx + c + 1, (r + 1) * nx + c + 1, (r + 1) * nx + c
            zz = BZa[r:r + 2, c:c + 2]
            faces.append((a, b, cc, d))
            mats.append(0 if zz.max() < WATER_Z - 0.2 else (1 if zz.min() > WATER_Z + 0.8 else 2))
    mesh_object("Backdrop_Terrain", verts, faces, coll, [MATS["Seabed"], MATS["Grass"], MATS["Sand_Wet"]], mats,
                verts[:, :2], smooth=True, props={"collider": "none", "surface": "backdrop"})


def build_water(coll):
    z = WATER_Z
    for key, name, mat in (("sea_tri", "Water_Sea", "Water_Sea"), ("lagoon_tri", "Water_Lagoon", "Water_Lagoon")):
        tr = W[key]
        verts = [(x, y, z) for x, y in tr["v"]]
        ob = mesh_object(name, verts, tr["t"], coll, [MATS[mat]], None, [(x / 8, y / 8) for x, y in tr["v"]],
                         props={"collider": "water", "water_level": z})
        ob.visible_shadow = False  # let sunlight reach the lagoon floor in Cycles


# ============================================================================ beach structures
def build_service_centre(coll):
    """Service centre (Arkibúllan, 2001) built into the Fossvogur bank: beach-level
    changing rooms with larch shutters, flat roof flush with the coastal path,
    basalt-clad end tower, pool terrace with a long 38 °C hot pool."""
    fp = ccw(W["service"])
    z0 = W["terrace_z"]
    z1 = W["roof_path_z"]
    mb = MeshBuilder()
    # 0 concrete wall, 1 roof deck, 2 larch, 3 blue tile, 4 stone, 5 glass, 6 steel
    n = len(fp)
    base = z0 - 1.2
    for i in range(n):
        a, b = fp[i], fp[(i + 1) % n]
        L = math.dist(a, b)
        mb.add([(a[0], a[1], base), (b[0], b[1], base), (b[0], b[1], z1 + 0.25), (a[0], a[1], z1 + 0.25)],
               [(0, 1, 2, 3)], 0, uv=[(0, base), (L, base), (L, z1), (0, z1)])
    pts, tris = polygon_faces(fp)
    mb.add([(x, y, z1 + 0.25) for x, y in pts], tris, 1)
    # Façade panels: SW facade A(34.1,47.6)->B(60.9,35.2) and SE wing west face B->C.
    A, B, Cc, Dd = Vector((34.1, 47.6)), Vector((60.9, 35.2)), Vector((55.9, 24.4)), Vector((61.9, 21.6))

    def panels(p, q, pattern, h0, h1):
        d = (q - p)
        L = d.length
        u = d.normalized()
        nrm = Vector((u.y, -u.x))  # outward (to the right of travel for a CCW-reversed edge)
        nseg = len(pattern)
        pier = 0.45
        w = (L - pier * (nseg + 1)) / nseg
        for k, kind in enumerate(pattern):
            s = pier + k * (w + pier)
            c = p + u * (s + w / 2) + nrm * 0.06
            ang = math.atan2(u.y, u.x)
            mb.box((c.x, c.y, (h0 + h1) / 2), (w, 0.12, h1 - h0), ang, {"W": 2, "B": 3, "G": 5}[kind], uv_scale=0.5)

    panels(A, B, "WBWWGWBW", z0 + 0.05, z1 - 0.35)
    panels(B, Cc, "WBW", z0 + 0.05, z1 - 0.35)
    # Basalt-clad tower on the south end of the SE wing, 1.8 m above the roof.
    t0 = Cc
    t1 = Dd
    side = (Vector((73.1, 41.1)) - t1).normalized()
    tower = [t0, t1, t1 + side * 6.5, t0 + side * 6.5]
    tc = sum(tower, Vector((0, 0))) / 4
    tower = [tc + (p - tc) * 1.04 for p in tower]
    bm = bmesh.new()
    vs0 = [bm.verts.new((p.x, p.y, base)) for p in tower]
    vs1 = [bm.verts.new((p.x, p.y, z1 + 1.8)) for p in tower]
    for i in range(4):
        bm.faces.new((vs0[i], vs0[(i + 1) % 4], vs1[(i + 1) % 4], vs1[i]))
    bm.faces.new(vs1)
    bm.faces.new(vs0[::-1])
    vert_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1 and
                  any((Vector(v.co.xy) - t1).length < 0.6 or (Vector(v.co.xy) - (t1 + side * 6.5)).length < 0.6 for v in e.verts)]
    bmesh.ops.bevel(bm, geom=vert_edges, offset=2.2, segments=8, affect="EDGES", profile=0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.verts.ensure_lookup_table()
    tv = [tuple(v.co) for v in bm.verts]
    tf = [tuple(v.index for v in f.verts) for f in bm.faces]
    tuv = []
    for v in bm.verts:
        tuv.append(((v.co.x + v.co.y) * 0.7, v.co.z))
    bm.free()
    mb.add(tv, tf, 4, uv=tuv)
    # Roof railing (glass panes on steel posts) along the beach-facing edges.
    rail_edges = [(A, B), (B, Cc)]
    for p, q in rail_edges:
        d = q - p
        L = d.length
        u = d.normalized()
        nrm = Vector((u.y, -u.x))
        ang = math.atan2(u.y, u.x)
        c = (p + q) / 2 - nrm * 0.15
        mb.box((c.x, c.y, z1 + 0.25 + 0.55), (L, 0.02, 1.0), ang, 5)
        mb.box((c.x, c.y, z1 + 0.25 + 1.08), (L, 0.06, 0.06), ang, 6)
        for k in range(int(L / 2.0) + 1):
            pp = p + u * min(k * 2.0, L) - nrm * 0.15
            mb.box((pp.x, pp.y, z1 + 0.25 + 0.55), (0.06, 0.06, 1.1), ang, 6)
    # Stairs from the path/roof level down to the beach at the NW end.
    Pn = Vector((37.5, 54.8))
    u = (A - Pn).normalized()
    out = Vector((-u.y, u.x))  # away from the building (north-west)
    if (Vector((20, 60)) - Pn).dot(out) < 0:
        out = -out
    nsteps = max(3, int(round((z1 - z0) / 0.17)))
    rise = (z1 + 0.25 - z0) / nsteps
    run = 0.3
    ang = math.atan2(u.y, u.x)
    for k in range(nsteps):
        c = Pn + out * 1.4 + u * (k * run + run / 2)
        top = z1 + 0.25 - (k + 1) * rise
        mb.box((c.x, c.y, (top + z0 - 1.0) / 2), (run, 2.6, top - (z0 - 1.0)), ang, 0)
    mb.object("ServiceCentre", coll, [MATS["ConcreteDark"], MATS["Pavers"], MATS["Larch"], MATS["BlueTile"],
                                           MATS["StoneClad"], MATS["Glass"], MATS["Steel"]],
                   props={"collider": "trimesh", "name_is": "Þjónustuhús Ylstrandarinnar"})
    return z0, z1


def build_terrace_and_pools(coll):
    z0 = W["terrace_z"]
    mb = MeshBuilder()
    tt = W["terrace_top"]
    mb.add([(x, y, z0) for x, y in tt["v"]], tt["t"], 0)
    # Steps down to the sand: each ring lower; never below the surrounding ground.
    ring_ground = []
    for k, st in enumerate(W["terrace_steps"]):
        gz = [ground(x, y) for x, y in st["v"]]
        ring_ground.append(np.percentile(gz, 10) if gz else z0)
    low = min(min(ring_ground), z0 - 0.3)
    nst = len(W["terrace_steps"])
    for k, st in enumerate(W["terrace_steps"]):
        zk = z0 - (k + 1) * (z0 - low) / (nst + 0.5)
        vs = [(x, y, max(zk, ground(x, y) + 0.01)) for x, y in st["v"]]
        mb.add(vs, st["t"], 0)
    # Vertical risers: extrude each terrace/step outline down 1.2 m (hidden where buried).
    outline = ccw(W["terrace"])
    for k in range(nst + 1):
        ring = offset_ring(outline, 0.45 * k) if k else outline
        zt = z0 - k * (z0 - low) / (nst + 0.5)
        for i in range(len(ring)):
            a, b = ring[i], ring[(i + 1) % len(ring)]
            L = math.dist(a, b)
            mb.add([(a[0], a[1], zt - 1.2), (b[0], b[1], zt - 1.2), (b[0], b[1], zt), (a[0], a[1], zt)],
                   [(0, 1, 2, 3)], 0, uv=[(0, 0), (L, 0), (L, 1.2), (0, 1.2)])
    # Retaining wall on the outermost step line where the bank is higher than the
    # steps (north-west end, towards the coastal path) - closes the terrain cut.
    outer = offset_ring(outline, 0.45 * nst)
    zl = z0 - nst * (z0 - low) / (nst + 0.5)
    for i in range(len(outer)):
        a, b = outer[i], outer[(i + 1) % len(outer)]
        ga, gb = ground(*a), ground(*b)
        if max(ga, gb) <= zl + 0.05:
            continue
        ta, tb = max(ga, zl) + 0.08, max(gb, zl) + 0.08
        quad = [(a[0], a[1], zl - 1.2), (b[0], b[1], zl - 1.2), (b[0], b[1], tb), (a[0], a[1], ta)]
        mb.add(quad, [(0, 1, 2, 3), (3, 2, 1, 0)], 0)

    # White painted lines parallel to the pool (photos 4-5).
    pool = ccw(W["long_pool"])
    e = max(((pool[i], pool[(i + 1) % 4]) for i in range(4)), key=lambda ab: math.dist(*ab))
    pa, pb = Vector(e[0]), Vector(e[1])
    u = (pb - pa).normalized()
    pc = sum((Vector(p) for p in pool), Vector((0, 0))) / 4
    nrm = Vector((u.y, -u.x))
    if (pc - pa).dot(nrm) > 0:
        nrm = -nrm
    Lp = (pb - pa).length
    ang = math.atan2(u.y, u.x)
    for off in (1.6, 3.2):
        for sgn in (1, -1):
            c = pc + nrm * sgn * (1.15 + off)
            mb.box((c.x, c.y, z0 + 0.005), (Lp + 2.0, 0.1, 0.01), ang, 2)
    mb.object("PoolTerrace", coll, [MATS["Concrete"], MATS["PoolWhite"], MATS["PaintWhite"]],
              props={"collider": "trimesh"})

    def sunken_pool(name, ring, top, depth, water_drop, coping, seat=True):
        pb_ = MeshBuilder()
        ring = ccw(ring)
        outer = offset_ring(ring, coping)
        pts, tris = polygon_faces(outer, [ring[::-1]])
        pb_.add([(x, y, top) for x, y in pts], tris, 0)
        # inner walls, seat ledge, floor
        n = len(ring)
        ledge = offset_ring(ring, -0.45)
        for i in range(n):
            a, b = ring[i], ring[(i + 1) % n]
            L = math.dist(a, b)
            pb_.add([(b[0], b[1], top), (a[0], a[1], top), (a[0], a[1], top - 0.45), (b[0], b[1], top - 0.45)],
                    [(0, 1, 2, 3)], 1, uv=[(L, 0), (0, 0), (0, .45), (L, .45)])
            if seat:
                la, lb = ledge[i], ledge[(i + 1) % n]
                pb_.add([(b[0], b[1], top - 0.45), (a[0], a[1], top - 0.45), (la[0], la[1], top - 0.45), (lb[0], lb[1], top - 0.45)],
                        [(0, 1, 2, 3)], 1)
                pb_.add([(lb[0], lb[1], top - 0.45), (la[0], la[1], top - 0.45), (la[0], la[1], top - depth), (lb[0], lb[1], top - depth)],
                        [(0, 1, 2, 3)], 1)
            # outer skirt below the coping
            oa, ob = outer[i], outer[(i + 1) % n]
            pb_.add([(oa[0], oa[1], top - 1.5), (ob[0], ob[1], top - 1.5), (ob[0], ob[1], top), (oa[0], oa[1], top)],
                    [(0, 1, 2, 3)], 0)
        floor_ring = ledge if seat else ring
        pts, tris = polygon_faces(floor_ring)
        pb_.add([(x, y, top - depth) for x, y in pts], tris, 1)
        pts, tris = polygon_faces(ring)
        pb_.add([(x, y, top - water_drop) for x, y in pts], tris, 2)
        ob = pb_.object(name, coll, [MATS["PoolWhite"], MATS["PoolFloor"], MATS["Water_HotPool"]],
                        props={"collider": "trimesh", "water_temp_c": 38})
        return ob

    sunken_pool("HotPool_Long", W["long_pool"], z0, 0.9, 0.12, 0.35)
    # Round pool on the sand at the lagoon edge: a low concrete ring wall.
    rp = ccw(W["ring_pool"])
    c = sum((Vector(p) for p in rp), Vector((0, 0))) / len(rp)
    r = sum((Vector(p) - c).length for p in rp) / len(rp)
    gz = ground(c.x, c.y)
    seg = 40
    ring = [(c.x + r * math.cos(2 * math.pi * i / seg), c.y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    top = max(gz + 0.55, WATER_Z + 0.5)
    sunken_pool("HotPool_Round", ring, top, 1.05, 0.15, 0.35, seat=True)
    # Four warm-water inlets on the floor (dark squares in aerial photo 1).
    mb2 = MeshBuilder()
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        p = c + Vector((math.cos(a), math.sin(a))) * (r * 0.42)
        mb2.box((p.x, p.y, top - 1.05 + 0.06), (0.55, 0.55, 0.12), a, 0)
    mb2.object("HotPool_Round_Inlets", coll, [MATS["ConcreteDark"]])


def build_boardwalk(coll):
    ring = ccw(W["boardwalk"])
    # Platform centre: the circular part of the pier polygon (south-west end).
    pc = Vector((22.25, -51.4))
    r_out = max((Vector(p) - pc).length for p in ring if (Vector(p) - pc).length < 8)
    pit_r = 2.9
    a0 = Vector((57.8, 11.8))
    axis = (pc - a0)
    L = axis.length
    u = axis.normalized()
    zs = [ground(*(a0 + u * t)) for t in np.linspace(0, L, 60)]
    z_start = max(zs[0], ground(a0.x, a0.y)) + 0.05
    z_plat = 3.3
    deck_z = lambda p: z_start + (z_plat - z_start) * min(max((Vector(p) - a0).dot(u) / (L - r_out), 0), 1)
    pit = [(pc.x + pit_r * math.cos(2 * math.pi * i / 32), pc.y + pit_r * math.sin(2 * math.pi * i / 32)) for i in range(32)]
    pts, tris = polygon_faces(ring, [pit[::-1]])
    mb = MeshBuilder()
    # UVs along the walkway so planks run across it.
    uvs = [((Vector(p) - a0).dot(Vector((-u.y, u.x))), (Vector(p) - a0).dot(u)) for p in pts]
    mb.add([(x, y, deck_z((x, y))) for x, y in pts], tris, 0, uv=uvs)
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        za, zb = deck_z(a), deck_z(b)
        Lab = math.dist(a, b)
        mb.add([(a[0], a[1], za - 2.6), (b[0], b[1], zb - 2.6), (b[0], b[1], zb), (a[0], a[1], za)],
               [(0, 1, 2, 3)], 1, uv=[(0, 0), (Lab, 0), (Lab, 2.6), (0, 2.6)])
    # Sand pit: inner wall and sand fill 0.25 m below the deck.
    for i in range(32):
        a, b = pit[i], pit[(i + 1) % 32]
        mb.add([(b[0], b[1], z_plat - 0.25), (a[0], a[1], z_plat - 0.25), (a[0], a[1], z_plat), (b[0], b[1], z_plat)],
               [(0, 1, 2, 3)], 1)
    pts2, tris2 = polygon_faces(pit)
    mb.add([(x, y, z_plat - 0.25) for x, y in pts2], tris2, 2)
    # Ladder / swimming steps frame at the seaward tip (photo 2).
    tip = pc + Vector((0.35, -1)).normalized() * (r_out - 0.2)
    d = Vector((0.35, -1)).normalized()
    side = Vector((-d.y, d.x))
    ang = math.atan2(d.y, d.x)
    for s_ in (-0.4, 0.4):
        p = tip + side * s_
        mb.box((p.x, p.y, z_plat + 0.1), (0.06, 0.06, 1.8), ang, 3)
        mb.box((p.x + d.x * 0.35, p.y + d.y * 0.35, z_plat + 1.0), (0.7, 0.06, 0.06), ang, 3)
    for k in range(5):
        p = tip + d * 0.3
        mb.box((p.x, p.y, z_plat - 0.4 * k - 0.2), (0.3, 0.8, 0.05), ang, 3)
    mb.object("Boardwalk_Pier", coll, [MATS["Deck_Wood"], MATS["ConcreteDark"], MATS["Sand_Golden"], MATS["Steel"]],
              props={"collider": "trimesh"})
    return pc, r_out, z_plat


def rock_variants(k=12):
    out = []
    for i in range(k):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.5)
        sx, sy, sz = rng.uniform(0.8, 1.25), rng.uniform(0.7, 1.1), rng.uniform(0.45, 0.8)
        for v in bm.verts:
            v.co.x *= sx * rng.uniform(0.85, 1.15)
            v.co.y *= sy * rng.uniform(0.85, 1.15)
            v.co.z *= sz * rng.uniform(0.85, 1.15)
        # flatten a couple of faces for a quarried look
        cut = rng.uniform(-0.25, -0.15)
        for v in bm.verts:
            if v.co.z < cut:
                v.co.z = cut + (v.co.z - cut) * 0.3
        bm.verts.ensure_lookup_table()
        out.append(([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces]))
        bm.free()
    return out


def build_rock_armour(coll, platform):
    variants = rock_variants()
    pc, r_out, z_plat = platform
    lines = [[Vector(p) for p in ln] for ln in W["armour_lines"]]
    mb = MeshBuilder()
    count = 0
    for ln in lines:
        for i in range(len(ln) - 1):
            a, b = ln[i], ln[i + 1]
            d = (b - a)
            if d.length < 1e-3:
                continue
            u = d.normalized()
            nrm = Vector((u.y, -u.x))  # land side is on the left of the CCW coastline -> sea = right
            for t in np.arange(0, d.length, 0.95):
                base = a + u * t
                for off in np.arange(-3.0, 4.6, 1.15):
                    off2 = off + rng.uniform(-0.35, 0.35)
                    p = base + nrm * off2 + u * rng.uniform(-0.3, 0.3)
                    if (p - pc).length < r_out + 0.2:
                        continue  # under the platform deck
                    s = rng.uniform(0.9, 1.7) * (1.15 if off2 > 0 else 1.0)
                    # Land-side (crest) rocks stand proud of the DEM surface; toe rocks sit lower.
                    z = ground(p.x, p.y) + s * (rng.uniform(0.25, 0.45) if off2 > 0 else rng.uniform(0.05, 0.22))
                    M = (Matrix.Translation((p.x, p.y, z)) @ Matrix.Rotation(rng.uniform(0, 6.283), 4, "Z") @
                         Matrix.Rotation(rng.uniform(-0.35, 0.35), 4, "X") @ Matrix.Scale(s, 4))
                    mb.add_mesh(rng.choice(variants), M, 0, uv_scale=0.6)
                    count += 1
    # Submerged sill across the lagoon mouth (crest ~0.45 m under WATER_Z).
    sill = [Vector(p) for p in W["sill"]]
    for i in range(len(sill) - 1):
        a, b = sill[i], sill[i + 1]
        u = (b - a).normalized()
        nrm = Vector((u.y, -u.x))
        for t in np.arange(0, (b - a).length, 0.9):
            for off in (-1.2, 0.0, 1.2):
                p = a + u * t + nrm * (off + rng.uniform(-0.3, 0.3))
                s = rng.uniform(0.8, 1.3)
                z = WATER_Z - 0.45 - s * 0.25 - abs(off) * 0.3
                M = Matrix.Translation((p.x, p.y, z)) @ Matrix.Rotation(rng.uniform(0, 6.283), 4, "Z") @ Matrix.Scale(s, 4)
                mb.add_mesh(rng.choice(variants), M, 0, uv_scale=0.6)
                count += 1
    mb.object("RockArmour", coll, [MATS["Basalt"]], smooth=True, props={"collider": "trimesh", "surface": "rock"})
    print("rocks", count, len(mb.f))


def build_buoys(coll, platform):
    pc, r_out, z_plat = platform
    sill = [Vector(p) for p in W["sill"]]
    start = sill[0] + (sill[1] - sill[0]).normalized() * 3.0
    end = pc + (sill[-1] - pc).normalized() * (r_out + 0.3)
    pts = [start] + [p + Vector((0, 1.2)) for p in sill[1:-1]] + [end]
    mb = MeshBuilder()
    total = sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))
    nb = int(total / 1.5)
    seg = 10
    for k in range(nb + 1):
        t = k / nb * total
        acc = 0
        for i in range(len(pts) - 1):
            L = (pts[i + 1] - pts[i]).length
            if acc + L >= t or i == len(pts) - 2:
                p = pts[i] + (pts[i + 1] - pts[i]) * ((t - acc) / max(L, 1e-6))
                break
            acc += L
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=6, radius=0.17)
        verts = [(v.co.x + p.x, v.co.y + p.y, v.co.z * 0.85 + WATER_Z + 0.06) for v in bm.verts]
        bm.verts.ensure_lookup_table()
        faces = [tuple(v.index for v in f.verts) for f in bm.faces]
        bm.free()
        mb.add(verts, faces, 0)
    # floating rope between buoys
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = b - a
        c = (a + b) / 2
        mb.box((c.x, c.y, WATER_Z + 0.02), (d.length, 0.03, 0.03), math.atan2(d.y, d.x), 1)
    mb.object("BuoyLine", coll, [MATS["Buoy_Yellow"], MATS["Rope"]], smooth=True, props={"collider": "none"})


def build_slipway(coll):
    ring = ccw(W["slipway"])
    # Old seaplane slipway (WWII RAF base): concrete ramp sloping into Fossvogur.
    top = Vector((122.0, 15.0))
    pts, tris = polygon_faces(ring)
    z_top = ground(top.x, top.y)
    zf = lambda p: z_top - max(0.0, (top.y - p[1])) * 0.075
    mb = MeshBuilder()
    mb.add([(x, y, zf((x, y)) + 0.12) for x, y in pts], tris, 0)
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        mb.add([(a[0], a[1], zf(a) - 1.5), (b[0], b[1], zf(b) - 1.5), (b[0], b[1], zf(b) + 0.12), (a[0], a[1], zf(a) + 0.12)],
               [(0, 1, 2, 3)], 0)
    mb.object("Slipway_Concrete", coll, [MATS["ConcreteDark"]], props={"collider": "trimesh"})


def build_beach_props(coll, platform):
    mb = MeshBuilder()
    # 0 white paint, 1 yellow, 2 blue, 3 net, 4 wood, 5 steel, 6 red, 7 flag
    # Beach volleyball court (photo 2, west side of the beach), 16 x 8 m.
    cx, cy, rot = -60.0, 30.0, math.radians(95)
    gz = ground(cx, cy)
    c, s = math.cos(rot), math.sin(rot)
    tr = lambda x, y: (cx + x * c - y * s, cy + x * s + y * c)
    for sx in (-1, 1):
        for x0, y0, x1, y1 in ((-8, sx * 4, 8, sx * 4), (sx * 8, -4, sx * 8, 4)):
            a, b = Vector(tr(x0, y0)), Vector(tr(x1, y1))
            m = (a + b) / 2
            mb.box((m.x, m.y, ground(m.x, m.y) + 0.01), ((b - a).length, 0.05, 0.02), math.atan2((b - a).y, (b - a).x), 2)
    for sy in (-1, 1):
        p = tr(0, sy * 4.6)
        mb.cylinder((p[0], p[1], gz - 0.6), 0.05, 3.1, 8, 1)
    a, b = Vector(tr(0, -4.6)), Vector(tr(0, 4.6))
    m = (a + b) / 2
    mb.box((m.x, m.y, gz + 2.0), (9.2, 0.02, 1.0), math.atan2((b - a).y, (b - a).x), 3)
    # Small football goals on the sand (photo 4).
    for gx, gy, gr in ((-28.0, 30.0, 0.35), (-8.0, 37.0, 0.35 + math.pi)):
        z = ground(gx, gy)
        c2, s2 = math.cos(gr), math.sin(gr)
        for side in (-1, 1):
            p = (gx - s2 * side * 1.5, gy + c2 * side * 1.5)
            mb.box((p[0], p[1], z + 0.6), (0.06, 0.06, 1.2), gr, 0)
        mb.box((gx, gy, z + 1.2), (0.06, 3.0, 0.06), gr, 0)
        mb.box((gx - c2 * 0.5, gy - s2 * 0.5, z + 0.6), (0.02, 3.0, 1.2), gr, 3)
    # Blue wind-shelter wall on the west beach (photo 2).
    for (x, y, L, a) in ((-84.0, 6.0, 7.0, math.radians(100)), (-86.5, 9.2, 3.0, math.radians(10))):
        mb.box((x, y, ground(x, y) + 0.9), (L, 0.25, 1.8), a, 2)
    # Flag pole with the Icelandic flag near the pier root (photo 5).
    fx, fy = 50.5, 10.5
    fz = ground(fx, fy)
    mb.cylinder((fx, fy, fz), 0.06, 8.0, 10, 0, r_top=0.035)
    fl = [(fx, fy, fz + 7.9), (fx + 1.8, fy, fz + 7.9), (fx + 1.8, fy, fz + 6.6), (fx, fy, fz + 6.6)]
    mb.add(fl, [(3, 2, 1, 0), (0, 1, 2, 3)], 7, uv=[(0, 1), (1, 1), (1, 0), (0, 0)] * 1)
    # Lifeguard chair and picnic tables on the terrace (photo 5).
    z0 = W["terrace_z"]
    lx, ly = 58.5, 30.5
    for dx in (-0.35, 0.35):
        for dy in (-0.35, 0.35):
            mb.box((lx + dx, ly + dy, z0 + 0.8), (0.06, 0.06, 1.6), 0.4, 0)
    mb.box((lx, ly, z0 + 1.6), (0.8, 0.8, 0.08), 0.4, 6)
    mb.box((lx, ly + 0.35, z0 + 2.0), (0.8, 0.06, 0.8), 0.4, 6)
    fa, fb = Vector((34.1, 47.6)), Vector((60.9, 35.2))
    u = (fb - fa).normalized()
    nrm = Vector((u.y, -u.x))
    if nrm.y > 0:
        nrm = -nrm
    ang = math.atan2(u.y, u.x)
    for k in range(5):
        p = fa + u * (4 + k * 5.2) + nrm * 1.6
        mb.box((p.x, p.y, z0 + 0.74), (1.8, 0.75, 0.05), ang, 4)
        for sgn in (-1, 1):
            q = p + nrm * sgn * 0.65
            mb.box((q.x, q.y, z0 + 0.44), (1.8, 0.28, 0.04), ang, 4)
        for sgn in (-1, 1):
            q = p + u * sgn * 0.75
            mb.box((q.x, q.y, z0 + 0.37), (0.06, 1.5, 0.74), ang, 4)
    mb.object("BeachProps", coll, [MATS["PaintWhite"], MATS["PaintYellow"], MATS["PaintBlue"], MATS["Net"],
                                    MATS["Wood_Bench"], MATS["Steel"], MATS["PaintRed"], MATS["Flag"]],
              props={"collider": "trimesh"})
    # Icelandic flag texture (ratio 18:25).
    n = 128
    img = np.zeros((n, n, 3))
    yy, xx = np.mgrid[0:n, 0:n] / n
    blue, white, red = hexc("#02529c"), hexc("#ffffff"), hexc("#dc1e35")
    img[:] = blue
    wcross = (np.abs(xx * 25 - 9) < 2) | (np.abs(yy * 18 - 9) < 2)
    rcross = (np.abs(xx * 25 - 9) < 1) | (np.abs(yy * 18 - 9) < 1)
    img[wcross] = white
    img[rcross] = red
    fim = image("T_flag_is", img)
    m = MATS["Flag"]
    ti = m.node_tree.nodes.new("ShaderNodeTexImage")
    ti.image = fim
    m.node_tree.links.new(ti.outputs["Color"], m.node_tree.nodes["Principled BSDF"].inputs["Base Color"])


# ============================================================================ buildings
def build_buildings(coll_world, coll_back):
    groups = {}
    service_c = Vector((50, 40))
    for i, (b, roof) in enumerate(zip(W["buildings"], W["roofs"])):
        ring = [tuple(p) for p in b["poly"]]
        cen = sum((Vector(p) for p in ring), Vector((0, 0))) / len(ring)
        if (cen - service_c).length < 12 and abs(ring_area(ring[:-1])) > 380:
            continue  # the service centre is modelled in detail
        area = abs(ring_area(ring[:-1]))
        cls = b["class"] or ""
        world = b["world"]
        if world:
            base, top = b["base"], b["top"]
        else:
            gz = [BZ(x, y) for x, y in ring]
            base = min(gz) - 0.8
            top = max(b["top"], max(gz) + 2.5)
        top = max(top, base + 3.0)
        if cls in ("hangar", "industrial", "warehouse", "storage_tank", "service"):
            wall, roofm = "Metal_Clad", "Roof"
        elif cls in ("university", "office", "commercial", "school"):
            wall, roofm = ("Facade_Glass" if cls == "university" else "Facade"), "Roof"
        elif area < 260 or cls in ("house", "detached", "semidetached_house", "garage", "garages", "shed"):
            wall, roofm = f"House_{i % 7}", ("Roof_Red" if i % 3 == 0 else "Roof_Dark")
        else:
            wall, roofm = "Facade", "Roof"
        key = ("W" if world else "B", wall, roofm, int(cen.x // 300), int(cen.y // 300))
        mb = groups.setdefault(key, MeshBuilder())
        rings = [ring] + [[tuple(p) for p in h] for h in b["holes"]]
        for r in rings:
            r = r[:-1] if r[0] == r[-1] else r
            u = 0.0
            for j in range(len(r)):
                a, c = r[j], r[(j + 1) % len(r)]
                L = math.dist(a, c)
                mb.add([(a[0], a[1], base), (c[0], c[1], base), (c[0], c[1], top), (a[0], a[1], top)],
                       [(0, 1, 2, 3)], 0, uv=[(u, base), (u + L, base), (u + L, top), (u, top)])
                u += L
        mb.add([(x, y, top) for x, y in roof["v"]], roof["t"], 1)
    for key, mb in groups.items():
        world, wall, roofm, gx, gy = key
        # Fix winding: walls built from GIS rings may face inward; recalc normals.
        ob = mb.object(f"Buildings_{world}_{wall}_{gx}_{gy}", coll_world if world == "W" else coll_back,
                       [MATS[wall], MATS[roofm]], props={"collider": "trimesh" if world == "W" else "none"})
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data)
        bm.free()


# ============================================================================ vegetation & props
def tree_meshes():
    """Unit-height low-poly trees: 0 birch, 1 row tree, 2 spruce, 3 shrub."""
    out = {}

    def crown(bm, cz, rx, rz, subdiv=1, jitter=0.12):
        m = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
        for v in m["verts"]:
            v.co.x = v.co.x * rx * rng.uniform(1 - jitter, 1 + jitter)
            v.co.y = v.co.y * rx * rng.uniform(1 - jitter, 1 + jitter)
            v.co.z = v.co.z * rz * rng.uniform(1 - jitter, 1 + jitter) + cz
        return m

    def pack(bm, mat_of):
        bm.verts.ensure_lookup_table()
        return ([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces],
                [mat_of(f) for f in bm.faces])

    for kind in range(4):
        out[kind] = []
        for var in range(3):
            bm = bmesh.new()
            if kind == 0:
                bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=0.035, radius2=0.02, depth=0.5,
                                      matrix=Matrix.Translation((0, 0, 0.25)))
                ntr = len(bm.faces)
                crown(bm, 0.62, 0.26, 0.36)
                crown(bm, 0.72, 0.18, 0.22, jitter=0.2)
                mat_of = lambda f, n=ntr: 0 if f.index < n else 1
            elif kind == 1:
                bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=0.03, radius2=0.02, depth=0.3,
                                      matrix=Matrix.Translation((0, 0, 0.15)))
                ntr = len(bm.faces)
                crown(bm, 0.6, 0.17, 0.42)
                mat_of = lambda f, n=ntr: 0 if f.index < n else 1
            elif kind == 2:
                bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=0.03, radius2=0.01, depth=0.2,
                                      matrix=Matrix.Translation((0, 0, 0.1)))
                ntr = len(bm.faces)
                for k, (z, r, h) in enumerate(((0.12, 0.25, 0.42), (0.38, 0.19, 0.36), (0.62, 0.12, 0.38))):
                    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r * rng.uniform(0.9, 1.1), radius2=0.0,
                                          depth=h, matrix=Matrix.Translation((0, 0, z + h / 2)))
                mat_of = lambda f, n=ntr: 0 if f.index < n else 1
            else:
                crown(bm, 0.45, 0.7, 0.5, jitter=0.18)
                mat_of = lambda f: 1
            out[kind].append(pack(bm, mat_of))
            bm.free()
    return out


def build_vegetation(coll):
    """Trees as linked duplicates of 12 low-poly meshes (exported with
    EXT_mesh_gpu_instancing, so engines that support it draw them instanced)."""
    meshes = tree_meshes()
    mats = {0: ("Bark_Birch", "Leaves_Birch"), 1: ("Bark", "Leaves_Poplar"), 2: ("Bark", "Leaves_Spruce"), 3: ("Bark", "Shrub")}
    names = {0: "Birch", 1: "RowTree", 2: "Spruce", 3: "Shrub"}
    data = {}
    for kind, variants in meshes.items():
        for vi, (v, f, m) in enumerate(variants):
            ob = mesh_object(f"_{names[kind]}_{vi}", v, f, coll, [MATS[mats[kind][0]], MATS[mats[kind][1]]], m, None, smooth=kind != 2)
            data[(kind, vi)] = ob.data
            coll.objects.unlink(ob)
            bpy.data.objects.remove(ob)
    root = bpy.data.objects.new("Vegetation_Root", None)
    coll.objects.link(root)
    for i, (x, y, z, h, kind) in enumerate(W["trees"]):
        vi = rng.randrange(3)
        ob = bpy.data.objects.new(f"{names[kind]}.{i:04d}", data[(kind, vi)])
        sxy = h * rng.uniform(0.85, 1.15)
        ob.location = (x, y, z - 0.1)
        ob.rotation_euler = (0, 0, rng.uniform(0, 6.283))
        ob.scale = (sxy, sxy, h)
        ob["collider"] = "none"
        ob.parent = root
        coll.objects.link(ob)
    print("trees", len(W["trees"]))


def build_street_furniture(coll):
    mb = MeshBuilder()
    # 0 steel pole, 1 lamp head, 2 bench wood, 3 dark metal, 4 blue sign
    for x, y, z, hd in W["street_lamps"]:
        near_road = min(((x - p[0]) ** 2 + (y - p[1]) ** 2 for r in W["roads"] for p in r["pts"][::3]), default=1e9) < 64
        h = 8.0 if near_road else 4.5
        mb.cylinder((x, y, z - 0.3), 0.09, h + 0.3, 8, 0, r_top=0.055)
        arm = 1.2 if near_road else 0.25
        hx, hy = x + math.cos(hd) * arm, y + math.sin(hd) * arm
        mb.box(((x + hx) / 2, (y + hy) / 2, z + h - 0.05), (arm + 0.1, 0.06, 0.06), hd, 0)
        mb.box((hx, hy, z + h - 0.12), (0.6, 0.28, 0.12), hd, 1)
    for x, y, z, hd in W["benches"]:
        a = hd + math.pi / 2
        mb.box((x, y, z + 0.44), (1.6, 0.42, 0.05), a, 2)
        bx, by = x - math.cos(hd) * 0.22, y - math.sin(hd) * 0.22
        mb.box((bx, by, z + 0.72), (1.6, 0.05, 0.35), a, 2)
        for sgn in (-1, 1):
            px, py = x + math.cos(a) * 0.7 * sgn, y + math.sin(a) * 0.7 * sgn
            mb.box((px, py, z + 0.22), (0.06, 0.4, 0.44), a, 3)
    for x, y, z, hd in W["waste_baskets"]:
        mb.cylinder((x, y, z), 0.22, 0.95, 10, 3)
    for x, y, z, hd in W["bike_racks"]:
        for k in range(4):
            px, py = x + math.cos(hd + math.pi / 2) * (k - 1.5) * 0.8, y + math.sin(hd + math.pi / 2) * (k - 1.5) * 0.8
            mb.box((px, py, z + 0.4), (0.7, 0.05, 0.8), hd, 0)
    for x, y, z, hd in W["info_boards"]:
        mb.box((x, y, z + 1.1), (1.2, 0.08, 0.9), hd + math.pi / 2, 4)
        mb.box((x, y, z + 0.4), (0.08, 0.08, 0.8), hd, 0)
    for x, y, z, hd in W["hydrants"]:
        mb.cylinder((x, y, z), 0.12, 0.8, 8, 3)
    mb.object("StreetFurniture", coll, [MATS["Steel"], MATS["Lamp_Head"], MATS["Wood_Bench"], MATS["Roof_Dark"], MATS["PaintBlue"]],
                   props={"collider": "trimesh"})
    # Linear features: walls, fences, hedges.
    mb = MeshBuilder()
    for key, mat, h0, wdt in (("walls", 0, 0.6, 0.4), ("fences", 1, 1.8, 0.05), ("hedges", 2, 1.2, 0.9), ("guard_rails", 1, 0.75, 0.1)):
        for ln in W[key]:
            h = ln["height"] or h0
            p = ln["pts"]
            for i in range(len(p) - 1):
                a, b = p[i], p[i + 1]
                L = math.dist(a[:2], b[:2])
                if L < 0.05:
                    continue
                ang = math.atan2(b[1] - a[1], b[0] - a[0])
                mb.box(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + h / 2 - 0.1), (L + 0.02, wdt, h + 0.2), ang, mat)
    if mb.f:
        mb.object("Walls_Fences_Hedges", coll, [MATS["Basalt"], MATS["Steel"], MATS["Shrub"]], props={"collider": "trimesh"})


def build_road_markings(coll):
    mb = MeshBuilder()
    for r in W["roads"]:
        if r["class"] not in ("tertiary", "residential", "primary", "secondary", "unclassified") or r["sub"] == "parking_aisle":
            continue
        p = [Vector(q) for q in r["pts"]]
        s = 0.0
        for i in range(len(p) - 1):
            a, b = p[i], p[i + 1]
            d = (b - a)
            L = d.xy.length
            if L < 1e-3:
                continue
            u = Vector((d.x, d.y)).normalized()
            ang = math.atan2(u.y, u.x)
            t = 0.0
            while t < L:
                phase = (s + t) % 9.0
                if phase < 3.0:
                    seg = min(3.0 - phase, L - t)
                    c = a + d * ((t + seg / 2) / L)
                    mb.box((c.x, c.y, c.z + 0.02), (seg, 0.12, 0.012), ang, 0)
                    t += seg
                else:
                    t += 9.0 - phase
            s += L
    for x, y, z, hd, w in W["crossings"]:
        for k in range(-3, 4):
            px, py = x + math.cos(hd) * k * 1.0, y + math.sin(hd) * k * 1.0
            mb.box((px, py, z + 0.012), (0.5, w - 0.4, 0.012), hd, 0)
    if mb.f:
        mb.object("RoadMarkings", coll, [MATS["PaintWhite"]], props={"collider": "none"})
    # Concrete kerbs, 15 cm wide, 12 cm upstand, along road/car-park edges:
    # one continuous strip (top + both faces) per polyline.
    kb = MeshBuilder()
    for ln in W["kerbs"]:
        P = [Vector(p) for p in ln]
        n = len(P)
        if n < 2:
            continue
        verts, faces, uvs = [], [], []
        s_acc = 0.0
        for i in range(n):
            d = (P[min(i + 1, n - 1)] - P[max(i - 1, 0)]).xy
            if d.length < 1e-6:
                d = Vector((1, 0))
            nrm = Vector((-d.y, d.x)).normalized() * 0.075
            if i:
                s_acc += (P[i] - P[i - 1]).xy.length
            z = P[i].z
            for off, dz in ((-1, -0.3), (-1, 0.12), (1, 0.12), (1, -0.3)):
                verts.append((P[i].x + nrm.x * off, P[i].y + nrm.y * off, z + dz))
                uvs.append((s_acc, dz + off))
        for i in range(n - 1):
            a, b = 4 * i, 4 * (i + 1)
            faces += [(a, b, b + 1, a + 1), (a + 1, b + 1, b + 2, a + 2), (a + 2, b + 2, b + 3, a + 3)]
        kb.add(verts, faces, 0, uv=uvs)
    if kb.f:
        kb.object("Kerbs", coll, [MATS["Concrete"]], props={"collider": "trimesh", "surface": "kerb"})


def build_game_helpers(coll):
    x0, y0, x1, y1 = W["world"]
    mb = MeshBuilder()
    for c, s in ((((x0 + x1) / 2, y0, 20), (x1 - x0, 1, 80)), (((x0 + x1) / 2, y1, 20), (x1 - x0, 1, 80)),
                 ((x0, (y0 + y1) / 2, 20), (1, y1 - y0, 80)), ((x1, (y0 + y1) / 2, 20), (1, y1 - y0, 80))):
        mb.box(c, s, 0, 0)
    ob = mb.object("COL_WorldBounds", coll, [MATS["Collider"]], props={"collider": "box", "visible": False})
    ob.hide_render = True
    ob.display_type = "WIRE"
    # Spawn points: largest paved car parks and the approach road.
    lots = sorted(W["parking"], key=lambda p: -abs(ring_area(p["poly"])))
    spawns = []
    for p in lots:
        ring = p["poly"]
        if p["mat"] != "asphalt":
            continue
        cx = sum(q[0] for q in ring) / len(ring)
        cy = sum(q[1] for q in ring) / len(ring)
        if not (x0 + 30 < cx < x1 - 30 and y0 + 30 < cy < y1 - 30):
            continue
        spawns.append((cx, cy))
        if len(spawns) == 3:
            break
    for i, (cx, cy) in enumerate(spawns):
        e = bpy.data.objects.new(f"SPAWN_CarPark_{i + 1}", None)
        e.empty_display_type = "ARROWS"
        e.location = (cx, cy, HZ(cx, cy) + 0.6)
        e["spawn"] = True
        coll.objects.link(e)
    road = next((r for r in W["roads"] if r["name"] == "Nauthólsvegur" and len(r["pts"]) > 20), None)
    if road:
        a, b = road["pts"][5], road["pts"][6]
        e = bpy.data.objects.new("SPAWN_Nautholsvegur", None)
        e.empty_display_type = "ARROWS"
        e.location = (a[0], a[1], a[2] + 0.6)
        e.rotation_euler = (0, 0, math.atan2(b[1] - a[1], b[0] - a[0]))
        e["spawn"] = True
        coll.objects.link(e)


# ============================================================================ scene, render, export
def setup_world_and_camera():
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    wd = bpy.data.worlds.new("Sky_Reykjavik")
    sc.world = wd
    wd.use_nodes = True
    nt = wd.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(32)
    sky.sun_rotation = math.radians(215)
    sky.altitude = 10
    nt.links.new(sky.outputs["Color"], nt.nodes["Background"].inputs["Color"])
    nt.nodes["Background"].inputs["Strength"].default_value = 0.22
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.0
    sun.angle = math.radians(0.6)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(58), 0, math.radians(35))
    sc.collection.objects.link(so)
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = -0.9


def add_camera(name, loc, target, lens=35):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_end = 8000
    ob = bpy.data.objects.new(name, cam)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def render_previews():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    shots = {
        # (camera location, target) - chosen to match the reference photos.
        "preview_aerial_1": ((5, -125, 75), (25, 15, 0), 30),           # like photo 1
        "preview_aerial_2": ((-60, -140, 70), (20, 10, 0), 30),          # like photo 2
        "preview_lagoon_level": ((-30, -20, 2.5), (45, 40, 5), 30),     # like photo 3
        "preview_platform": ((45, -30, 7), (20, -50, 2.5), 30),
        "preview_overview": ((-380, -520, 420), (40, 60, 0), 30),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    # Orthographic top-down minimap of the drivable world (1 px = 0.5 m).
    x0, y0, x1, y1 = W["world"]
    cam = bpy.data.cameras.new("CAM_minimap")
    cam.type = "ORTHO"
    cam.ortho_scale = max(x1 - x0, y1 - y0)
    cam.clip_end = 2000
    mo = bpy.data.objects.new("CAM_minimap", cam)
    sc.collection.objects.link(mo)
    mo.location = ((x0 + x1) / 2, (y0 + y1) / 2, 900)
    mo.rotation_euler = (0, 0, 0)
    sc.camera = mo
    sc.render.resolution_x = int((x1 - x0) * 2)
    sc.render.resolution_y = int((y1 - y0) * 2)
    sc.cycles.samples = 16
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    sc.render.filepath = str(OUT / "minimap_0.5m_per_px.jpg")
    bpy.ops.render.render(write_still=True)
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.cycles.samples = 48
    for name, (loc, tgt, lens) in shots.items():
        cam = add_camera("CAM_" + name, loc, tgt, lens)
        sc.camera = cam
        sc.render.filepath = str(OUT / f"{name}.jpg")
        bpy.ops.render.render(write_still=True)
        print("rendered", name)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups
    global TEX
    TEX = make_textures()
    surf_mats = make_materials()
    C = {k: collection(k) for k in ("Terrain", "Water", "Beach_Nautholsvik", "Buildings", "Vegetation",
                                    "Street_Furniture", "Roads", "Backdrop", "Game")}
    build_terrain(C["Terrain"], surf_mats)
    bd = bpy.data.objects["Backdrop_Terrain"]
    C["Terrain"].objects.unlink(bd)
    C["Backdrop"].objects.link(bd)
    build_water(C["Water"])
    build_service_centre(C["Beach_Nautholsvik"])
    build_terrace_and_pools(C["Beach_Nautholsvik"])
    platform = build_boardwalk(C["Beach_Nautholsvik"])
    build_rock_armour(C["Beach_Nautholsvik"], platform)
    build_buoys(C["Beach_Nautholsvik"], platform)
    build_slipway(C["Beach_Nautholsvik"])
    build_beach_props(C["Beach_Nautholsvik"], platform)
    build_buildings(C["Buildings"], C["Backdrop"])
    build_vegetation(C["Vegetation"])
    build_street_furniture(C["Street_Furniture"])
    build_road_markings(C["Roads"])
    build_game_helpers(C["Game"])
    setup_world_and_camera()
    sc = bpy.context.scene
    sc["crs_proj4"] = "+proj=tmerc +lat_0=64.1213 +lon_0=-21.93 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m"
    sc["z_datum"] = "metres above mean sea level (ArcticDEM ellipsoidal - 65.10 m)"
    sc["water_level"] = WATER_Z
    OUT.mkdir(parents=True, exist_ok=True)
    blend = OUT / "nautholsvik.blend"
    if RENDER:
        render_previews()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    print("saved", blend)
    if EXPORT:
        for ob in bpy.data.objects:
            ob.select_set(not ob.name.startswith("CAM_") and ob.type != "LIGHT")
        bpy.ops.export_scene.gltf(filepath=str(OUT / "nautholsvik.glb"), export_format="GLB",
                                  use_selection=True, export_extras=True, export_yup=True, export_apply=True,
                                  export_cameras=False, export_lights=False, export_image_format="JPEG",
                                  export_image_quality=88, export_gpu_instances=True, export_tangents=True)
        print("exported glb")


if __name__ == "__main__":
    main()
