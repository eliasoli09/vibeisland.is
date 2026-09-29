/**
 * Everything you see: sky, sea, the island mesh, the road, and the Blender kit
 * (models/kit.glb) placed around the loop. Returns handles the game loop
 * animates (geyser, lava, waterfall, sheep, checkpoints, sun).
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Sky } from "three/addons/objects/Sky.js";
import * as T from "./track.js";
import * as Wd from "./world.js";

const rng = (() => {
  let s = 1234567;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
})();

const heading = (i) => Math.atan2(T.TZ[i], T.TX[i]);
/** Rotation about Y that turns local +X into direction angle `a` (x/z plane). */
const yaw = (a) => -a;

function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

function speckle(g, w, h, n, colors, size = [1, 3]) {
  for (let k = 0; k < n; k++) {
    g.fillStyle = colors[Math.floor(rng() * colors.length)];
    const s = size[0] + rng() * (size[1] - size[0]);
    g.fillRect(rng() * w, rng() * h, s, s);
  }
}

/** Road textures: u across (0 = left shoulder), v along (repeat every 12 m). */
function roadTexture(style) {
  return canvasTex(
    256,
    512,
    (g, w, h) => {
      const base = { asphalt: "#6a6d72", gravel: "#b8a07a", sand: "#3a3a3f", ice: "#e8f4f9" }[style];
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      if (style === "asphalt") speckle(g, w, h, 5000, ["#5c5f63", "#7a7d81", "#4f5256"]);
      if (style === "gravel") speckle(g, w, h, 7000, ["#a58e6a", "#cbb690", "#8f7a5a", "#d8c7a3"], [1, 4]);
      if (style === "sand") speckle(g, w, h, 6000, ["#2c2c30", "#4a4a50", "#232326"], [1, 3]);
      if (style === "ice") {
        speckle(g, w, h, 2500, ["#d7ecf4", "#f7fcff", "#c5e2ee"], [2, 6]);
        g.strokeStyle = "rgba(150,200,220,0.6)";
        g.lineWidth = 1.5;
        for (let k = 0; k < 26; k++) {
          g.beginPath();
          let x = rng() * w;
          let y = rng() * h;
          g.moveTo(x, y);
          for (let s = 0; s < 4; s++) {
            x += (rng() - 0.5) * 60;
            y += (rng() - 0.5) * 60;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      // shoulders
      const sh = 0.07 * w;
      g.fillStyle = style === "ice" ? "rgba(255,255,255,0.5)" : "rgba(120,110,95,0.55)";
      g.fillRect(0, 0, sh, h);
      g.fillRect(w - sh, 0, sh, h);
      if (style === "gravel" || style === "sand") {
        // tyre tracks
        g.fillStyle = "rgba(0,0,0,0.12)";
        for (const u of [0.3, 0.38, 0.62, 0.7]) g.fillRect(u * w, 0, 10, h);
      }
      if (style === "asphalt") {
        g.fillStyle = "#f2f0e6";
        g.fillRect(sh + 2, 0, 5, h);
        g.fillRect(w - sh - 7, 0, 5, h);
        g.fillStyle = "#f1e7c2";
        g.fillRect(w / 2 - 3, 0, 6, h * 0.45);
      }
    },
    { repeat: true },
  );
}

function makeRoad(scene) {
  const group = new THREE.Group();
  const mats = {};
  const styleRough = { asphalt: 0.82, gravel: 0.95, sand: 0.95, ice: 0.18 };
  for (const z of T.ZONE_LIST) {
    const tex = (mats[z.style] ||= roadTexture(z.style));
    z._mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: new THREE.Color(0xffffff).lerp(new THREE.Color(z.tint), 0.35),
      roughness: styleRough[z.style],
      metalness: z.style === "ice" ? 0.05 : 0,
    });
  }
  // contiguous zone ranges, padded one sample so meshes meet
  const ranges = [];
  let start = 0;
  for (let i = 1; i <= T.N; i++) {
    if (i === T.N || T.ZONE[i] !== T.ZONE[start]) {
      ranges.push([T.ZONE[start], start - 1, i + 1]);
      start = i;
    }
  }
  for (const [zi, a, b] of ranges) {
    const n = b - a + 1;
    const pos = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2);
    const index = [];
    let v = 0;
    for (let k = 0; k < n; k++) {
      const i = T.wrap(a + k);
      if (k > 0) {
        const p = T.wrap(a + k - 1);
        v += Math.hypot(T.X[i] - T.X[p], T.Z[i] - T.Z[p]) / 12;
      }
      const w = T.W[i] + Wd.SHOULDER;
      const y = Wd.ROADH[i] + 0.06;
      pos.set([T.X[i] - T.NX[i] * w, y, T.Z[i] - T.NZ[i] * w, T.X[i] + T.NX[i] * w, y, T.Z[i] + T.NZ[i] * w], k * 6);
      uv.set([0, v, 1, v], k * 4);
      if (k < n - 1) {
        const o = k * 2;
        index.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, T.ZONE_LIST[zi]._mat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  scene.add(group);
  return group;
}

const KIND_COLORS = [
  [0x5d7d43, 0x87a258], // grass & moss
  [0x2a2a2e, 0x3e3e44], // black sand
  [0x34302e, 0x57704a], // lava field (moss patches)
  [0x4b4b50, 0x5f5e60], // rock
  [0xeaf2f6, 0xffffff], // snow
  [0x7c9460, 0x98a882], // town green
  [0x30383a, 0x3a4446], // seabed
];

function makeTerrain(scene) {
  const nx = Wd.NXC + 1;
  const nz = Wd.NZC + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const j = iz * nx + ix;
      pos[j * 3] = Wd.X0 + ix * Wd.CELL;
      pos[j * 3 + 1] = Wd.HGT[j];
      pos[j * 3 + 2] = Wd.Z0 + iz * Wd.CELL;
    }
  }
  const index = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let o = 0;
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      index[o++] = a;
      index[o++] = c;
      index[o++] = b;
      index[o++] = b;
      index[o++] = c;
      index[o++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal.array;
  const ca = new THREE.Color();
  const cb = new THREE.Color();
  const rock = new THREE.Color(0x55555a);
  for (let j = 0; j < nx * nz; j++) {
    const x = pos[j * 3];
    const z = pos[j * 3 + 2];
    const kind = Wd.KIND[j];
    const [c1, c2] = KIND_COLORS[kind];
    const n = Wd.fbm(x * 0.06, z * 0.06, 3);
    ca.setHex(c1).lerp(cb.setHex(c2), Math.min(1, Math.max(0, (n - 0.3) * 2.2)));
    const up = nrm[j * 3 + 1];
    if (kind !== 4 && kind !== 6 && up < 0.8) ca.lerp(rock, Math.min(1, (0.8 - up) * 4));
    if (kind === 4 && up < 0.7) ca.lerp(rock, 0.6);
    col[j * 3] = ca.r;
    col[j * 3 + 1] = ca.g;
    col[j * 3 + 2] = ca.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makeOcean(scene) {
  const normal = canvasTex(
    256,
    256,
    (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const a = (x / w) * Math.PI * 2;
          const b = (y / h) * Math.PI * 2;
          const nx = Math.sin(a * 3 + Math.cos(b * 2) * 2) * 0.35 + Math.sin(a * 7 + b * 5) * 0.12;
          const ny = Math.cos(b * 4 + Math.sin(a * 2) * 2) * 0.35 + Math.cos(b * 9 - a * 3) * 0.12;
          const k = (y * w + x) * 4;
          img.data[k] = 128 + nx * 127;
          img.data[k + 1] = 128 + ny * 127;
          img.data[k + 2] = 255;
          img.data[k + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    },
    { repeat: true, srgb: false },
  );
  normal.repeat.set(160, 160);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1d5871,
    roughness: 0.12,
    metalness: 0.05,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(500, 0, 300);
  scene.add(mesh);
  return { mesh, normal };
}

// ── kit helpers ───────────────────────────────────────────────────────────

function kitRoot(gltf, name) {
  const src = gltf.scene.getObjectByName(`KIT_${name}`);
  if (!src) throw new Error(`kit is missing ${name}`);
  return src;
}

/** A fresh copy of a kit item, re-centred at the origin. */
function clone(gltf, name) {
  const c = kitRoot(gltf, name).clone(true);
  c.position.set(0, 0, 0);
  c.rotation.set(0, 0, 0);
  c.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return c;
}

/**
 * Many copies of one kit item as instanced meshes (one per sub-mesh), so a
 * hundred posts cost a handful of draw calls. `list` is [{x,y,z,rot,s,color}].
 */
function instanced(gltf, name, list, { shadow = true, tintMaterial = null } = {}) {
  const root = kitRoot(gltf, name);
  const saved = root.position.clone();
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const rel = o.matrixWorld.clone();
    let material = o.material;
    const tint = tintMaterial && material.name === tintMaterial;
    if (tint) {
      material = material.clone();
      material.color.set(0xffffff);
    }
    const im = new THREE.InstancedMesh(o.geometry, material, list.length);
    list.forEach((p, k) => {
      q.setFromAxisAngle(up, p.rot || 0);
      const s = p.s ?? 1;
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(s, p.sy ?? s, s));
      im.setMatrixAt(k, m.multiply(rel));
      if (tint) im.setColorAt(k, color.set(p.color ?? 0xffffff));
    });
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  });
  root.position.copy(saved);
  root.updateMatrixWorld(true);
  return group;
}

function distToRoad(x, z) {
  let best = 1e9;
  let bi = 0;
  for (let i = 0; i < T.N; i += 2) {
    const d = (x - T.X[i]) ** 2 + (z - T.Z[i]) ** 2;
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return { d: Math.sqrt(best) - T.W[bi], i: bi };
}

function groundY(x, z) {
  return Wd.terrainAt(x, z);
}

function bannerTexture(text) {
  return canvasTex(1024, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#ff2d87");
    grad.addColorStop(1, "#ff8a1e");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.font = "800 84px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

function checkerTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    const s = 16;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      g.fillStyle = (x / s + y / s) % 2 ? "#111" : "#f5f5f5";
      g.fillRect(x, y, s, s);
    }
  });
}

function chevronTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "rgba(79,227,208,0.25)";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#4fe3d0";
    g.lineWidth = 22;
    g.lineJoin = "round";
    for (let k = 0; k < 3; k++) {
      const y = 200 - k * 70;
      g.beginPath();
      g.moveTo(40, y);
      g.lineTo(128, y - 50);
      g.lineTo(216, y);
      g.stroke();
    }
  });
}

function streakTexture(color = "255,255,255") {
  return canvasTex(
    128,
    256,
    (g, w, h) => {
      g.fillStyle = "rgba(170,215,235,1)";
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < 90; k++) {
        g.fillStyle = `rgba(${color},${0.3 + rng() * 0.6})`;
        g.fillRect(rng() * w, rng() * h, 2 + rng() * 5, 30 + rng() * 90);
      }
    },
    { repeat: true },
  );
}

function softDot(color = "255,255,255") {
  return canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, `rgba(${color},1)`);
    r.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
}

/** A simple looping particle cloud (steam, smoke, spray). */
function particleCloud(count, tex, { size = 6, color = 0xffffff, opacity = 0.7 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: tex, size, color, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, pos, seeds: Array.from({ length: count }, () => [rng(), rng(), rng()]) };
}

// ── build ─────────────────────────────────────────────────────────────────

export async function createWorld(renderer, { lite = false } = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc9d6de, 260, lite ? 1100 : 1700);

  // Sky & sun: low, warm evening light (golden hour).
  const sky = new Sky();
  sky.scale.setScalar(4500);
  const su = sky.material.uniforms;
  su.turbidity.value = 5.5;
  su.rayleigh.value = 1.5;
  su.mieCoefficient.value = 0.004;
  su.mieDirectionalG.value = 0.86;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 13), THREE.MathUtils.degToRad(215));
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(4500);
  for (const k of Object.keys(su)) envSky.material.uniforms[k].value = su[k].value;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 1, 5000).texture;
  scene.environmentIntensity = 0.6;

  const hemi = new THREE.HemisphereLight(0xd6e8ff, 0x3d4a33, 0.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffdcae, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -70;
  sc.right = 70;
  sc.top = 70;
  sc.bottom = -70;
  sc.near = 10;
  sc.far = 700;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.5;
  scene.add(sun);
  scene.add(sun.target);

  const terrain = makeTerrain(scene);
  const ocean = makeOcean(scene);
  makeRoad(scene);

  const gltf = await new GLTFLoader().loadAsync(new URL("../models/kit.glb", import.meta.url).href);

  // ── decals: start line, boost pads ──
  const decal = (tex, i, len, width, lift = 0.09, emissive = null) => {
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
    if (emissive) {
      mat.emissive = new THREE.Color(emissive);
      mat.emissiveMap = tex;
      mat.emissiveIntensity = 0.8;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), mat);
    m.rotation.set(-Math.PI / 2, 0, 0);
    const g = new THREE.Group();
    g.add(m);
    g.position.set(T.X[i], Wd.ROADH[i] + lift, T.Z[i]);
    g.rotation.y = yaw(heading(i));
    // PlaneGeometry's +X is along the road once the group is yawed.
    scene.add(g);
    return mat;
  };
  decal(checkerTexture(), 0, 3, T.W[0] * 2, 0.1);
  const chev = chevronTexture();
  chev.center.set(0.5, 0.5);
  chev.rotation = -Math.PI / 2;
  const boostMats = T.BOOSTS.map((b) => decal(chev, b.i, b.len * 2, T.W[b.i] * 1.4, 0.1, 0x4fe3d0));

  // ── Reykjavík: church, houses, lighthouse, festival ──
  {
    const i = T.at(0.25);
    const [x, z] = T.beside(i, -1, 42);
    const church = clone(gltf, "Church");
    church.position.set(x, groundY(x, z) - 0.3, z);
    church.rotation.y = yaw(Math.atan2(T.Z[i] - z, T.X[i] - x));
    scene.add(church);
  }
  {
    const roofs = [0xc8402f, 0x2f6fa3, 0x3f8a4f, 0xe0b53a, 0x9c3b5a, 0x33475b, 0xd96a2b];
    const list = [];
    let k = 0;
    for (const seg of [25.8, 26.05, 26.3, 26.55, 26.8, 0.05, 0.55, 0.8, 1.05, 1.3, 1.55, 1.8]) {
      for (const side of [-1, 1]) {
        for (const row of [0, 1]) {
          k++;
          if ((k * 7) % 5 === 0) continue;
          const i = T.at(seg);
          const [x, z] = T.beside(i, side, 12 + row * 16 + ((k * 13) % 6));
          if (Math.hypot(x - T.X[T.at(0.25)], z - T.Z[T.at(0.25)]) < 40 && side === -1) continue;
          list.push({ x, y: groundY(x, z) - 0.2, z, rot: yaw(heading(i)) + (side > 0 ? Math.PI : 0), s: 0.9 + ((k * 17) % 5) * 0.06, color: roofs[k % roofs.length] });
        }
      }
    }
    scene.add(instanced(gltf, "House", list, { tintMaterial: "Roof" }));
  }
  for (const seg of [26.4, 1.2]) {
    // lighthouse on the nearest coast point
    const i = T.at(seg);
    let best = null;
    for (const [cx, cz] of T.COAST) {
      const d = (cx - T.X[i]) ** 2 + (cz - T.Z[i]) ** 2;
      if (!best || d < best[0]) best = [d, cx, cz];
    }
    const dx = T.X[i] - best[1];
    const dz = T.Z[i] - best[2];
    const l = Math.hypot(dx, dz);
    let x = best[1] + (dx / l) * 6;
    let z = best[2] + (dz / l) * 6;
    if (distToRoad(x, z).d < 14) continue;
    const lh = clone(gltf, "Lighthouse");
    lh.position.set(x, Math.max(0.5, groundY(x, z)) - 0.4, z);
    scene.add(lh);
  }
  {
    const arch = clone(gltf, "Arch");
    arch.position.set(T.X[0], Wd.ROADH[0], T.Z[0]);
    arch.rotation.y = yaw(heading(0));
    // The Blender banner boxes carry no UVs, so the printed banner is a pair
    // of planes laid over them.
    const banner = bannerTexture("HRINGVEGUR FESTIVAL");
    const bannerMat = new THREE.MeshStandardMaterial({ map: banner, emissive: 0xffffff, emissiveMap: banner, emissiveIntensity: 0.35, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.6), bannerMat);
      p.position.set(side * 1.09, 9.6, 0);
      p.rotation.y = side * Math.PI / 2;
      arch.add(p);
    }
    scene.add(arch);
    const tents = [];
    for (let k = 0; k < 7; k++) {
      const i = T.at(26.75 + k * 0.12);
      const [x, z] = T.beside(i, 1, 16 + (k % 2) * 11);
      tents.push({ name: `Tent${(k % 3) + 1}`, x, z, rot: k * 0.4 });
    }
    for (const t of tents) {
      const o = clone(gltf, t.name);
      o.position.set(t.x, groundY(t.x, t.z) - 0.1, t.z);
      o.rotation.y = t.rot;
      scene.add(o);
    }
  }

  // ── checkpoints (inflatable arches) ──
  const checkpoints = T.CHECKPOINTS.slice(1).map((i) => {
    const cp = clone(gltf, "Checkpoint");
    cp.position.set(T.X[i], Wd.ROADH[i], T.Z[i]);
    cp.rotation.y = yaw(heading(i) + Math.PI / 2);
    cp.scale.setScalar(T.W[i] + 2.4);
    cp.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0xff8a1e);
        o.material.emissiveIntensity = 0.1;
        o.castShadow = false;
      }
    });
    scene.add(cp);
    return cp;
  });

  // ── road furniture: marker posts, rift cliffs ──
  {
    const posts = [];
    for (let i = 0; i < T.N; i += 5) {
      const zk = T.ZONE_LIST[T.ZONE[i]].key;
      if (zk === "rift" || zk === "city") continue;
      for (const side of [-1, 1]) {
        const [x, z] = T.beside(i, side, Wd.SHOULDER + 1.0);
        posts.push({ x, y: Wd.ROADH[i] - 0.1, z, rot: yaw(heading(i)) });
      }
    }
    scene.add(instanced(gltf, "Post", posts, { shadow: false }));
    const cliffs = [];
    for (let i = 0; i < T.N; i += 2) {
      if (T.ZONE_LIST[T.ZONE[i]].key !== "rift") continue;
      for (const side of [-1, 1]) {
        const [x, z] = T.beside(i, side, 1.6);
        cliffs.push({ x, y: Wd.ROADH[i] - 1, z, rot: yaw(heading(i)) + (rng() - 0.5) * 0.3, s: 1, sy: 0.9 + rng() * 0.5 });
      }
    }
    scene.add(instanced(gltf, "Cliff", cliffs));
  }

  // ── scatter: rocks & lupines ──
  {
    const rocks = [[], [], []];
    const lupines = [];
    for (let k = 0; k < 5200 && (rocks[0].length + rocks[1].length + rocks[2].length < (lite ? 260 : 520) || lupines.length < (lite ? 350 : 800)); k++) {
      const x = Wd.X0 + rng() * Wd.NXC * Wd.CELL;
      const z = Wd.Z0 + rng() * Wd.NZC * Wd.CELL;
      const y = groundY(x, z);
      if (y < 1.2 || y > 44) continue;
      const { d } = distToRoad(x, z);
      if (d < 8) continue;
      const near = d < 90;
      if (near && rng() < 0.55 && lupines.length < (lite ? 350 : 800) && y < 22) {
        for (let c = 0; c < 4; c++) {
          const lx = x + (rng() - 0.5) * 6;
          const lz = z + (rng() - 0.5) * 6;
          lupines.push({ x: lx, y: groundY(lx, lz) - 0.05, z: lz, rot: rng() * 6.28, s: 0.8 + rng() * 0.7 });
        }
      } else {
        const v = Math.floor(rng() * 3);
        const s = 0.6 + rng() * (d > 40 ? 1.8 : 1.0);
        // bedded into the ground, never perched on it
        rocks[v].push({ x, y: y - 0.3 - 0.25 * s, z, rot: rng() * 6.28, s, sy: s * 0.7 });
      }
    }
    rocks.forEach((list, v) => scene.add(instanced(gltf, `Rock${v + 1}`, list)));
    scene.add(instanced(gltf, "Lupine", lupines, { shadow: false }));
  }

  // ── static sheep grazing ──
  {
    const list = [];
    for (let k = 0; k < 16; k++) {
      const i = T.at(18 + k * 0.45);
      const [x, z] = T.beside(i, k % 2 ? 1 : -1, 14 + (k * 7) % 30);
      list.push({ x, y: groundY(x, z), z, rot: k * 1.3 });
    }
    scene.add(instanced(gltf, "Sheep", list));
  }

  // ── obstacles on the road ──
  for (const o of T.OBSTACLES) {
    const m = clone(gltf, o.kit);
    m.position.set(o.x, Wd.ROADH[o.i] - 0.2, o.z);
    m.rotation.y = o.seg * 3;
    m.scale.setScalar(o.scale);
    scene.add(m);
  }

  // ── Jökulsárlón icebergs (floating) ──
  const bergs = [];
  for (let k = 0; k < 16; k++) {
    const i = T.at(12.05 + k * 0.12);
    const [x, z] = T.beside(i, -1, 26 + ((k * 23) % 34));
    if (groundY(x, z) > -0.5) continue;
    const m = clone(gltf, k % 2 ? "Iceberg1" : "Iceberg2");
    m.position.set(x, 0, z);
    m.rotation.y = k * 1.7;
    m.scale.setScalar(0.8 + ((k * 37) % 10) / 6);
    scene.add(m);
    bergs.push({ m, phase: k * 0.9 });
  }

  // ── Reynisdrangar ──
  for (const [seg, off, s] of [[10.9, 70, 1], [11.5, 95, 0.8], [11.1, 120, 0.65]]) {
    const i = T.at(seg);
    let [x, z] = T.beside(i, 1, off);
    // push out until we're in the sea
    for (let k = 0; k < 20 && groundY(x, z) > -1; k++) {
      x += T.NX[i] * 8;
      z += T.NZ[i] * 8;
    }
    const m = clone(gltf, "SeaStacks");
    m.position.set(x, -1.5, z);
    m.rotation.y = seg;
    m.scale.setScalar(s);
    scene.add(m);
  }

  // ── speed trap ──
  {
    const i = T.SPEEDTRAP.i;
    const [x, z] = T.beside(i, 1, Wd.SHOULDER + 2);
    const m = clone(gltf, "SpeedCam");
    m.position.set(x, Wd.ROADH[i] - 0.1, z);
    m.rotation.y = yaw(heading(i) + Math.PI);
    scene.add(m);
  }

  // ── Geysir: pool, warning ring, eruption column, steam ──
  const G = T.GEYSER;
  const gy = Math.max(groundY(G.x, G.z), Wd.ROADH[G.i]) - 0.1;
  const pool = clone(gltf, "Geyser");
  pool.position.set(G.x, gy - 0.15, G.z);
  scene.add(pool);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(G.radius - 0.9, G.radius, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(G.x, Wd.ROADH[G.i] + 0.25, G.z);
  scene.add(ring);
  const columnMat = new THREE.MeshStandardMaterial({ color: 0xf4fbff, emissive: 0xcfeaf5, emissiveIntensity: 0.35, transparent: true, opacity: 0.85, roughness: 0.3, depthWrite: false });
  const columnGeo = new THREE.CylinderGeometry(1.1, 3.4, 1, 18, 1, true);
  columnGeo.translate(0, 0.5, 0);
  const column = new THREE.Mesh(columnGeo, columnMat);
  column.position.set(G.x, gy, G.z);
  column.visible = false;
  scene.add(column);
  const steam = particleCloud(lite ? 40 : 90, softDot(), { size: 9, opacity: 0.55 });
  scene.add(steam.pts);

  // ── the volcano: crater glow, ash plume, lava streams ──
  const V = T.VOLCANO;
  const craterY = groundY(V.x, V.z + 14);
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(13, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a1a0c, emissive: 0xff5a10, emissiveIntensity: 2.2 }),
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(V.x, groundY(V.x, V.z) + 0.6, V.z);
  scene.add(crater);
  const craterLight = new THREE.PointLight(0xff6a20, 600, 160, 1.6);
  craterLight.position.set(V.x, craterY + 12, V.z);
  scene.add(craterLight);
  const plume = particleCloud(lite ? 35 : 70, softDot("90,88,92"), { size: 38, opacity: 0.55, color: 0x777777 });
  scene.add(plume.pts);

  const lavaTex = canvasTex(
    64,
    256,
    (g, w, h) => {
      g.fillStyle = "#3b1206";
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < 60; k++) {
        g.fillStyle = `rgba(255,${120 + Math.floor(rng() * 100)},30,${0.5 + rng() * 0.5})`;
        g.fillRect(rng() * w, rng() * h, 3 + rng() * 14, 8 + rng() * 40);
      }
    },
    { repeat: true },
  );
  const lava = T.LAVA.map((L) => {
    const i = L.i;
    const px = T.X[i];
    const pz = T.Z[i];
    let dx = px - V.x;
    let dz = pz - V.z;
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    const sx = V.x + dx * 12;
    const sz = V.z + dz * 12;
    const total = len - 12 + 30;
    const steps = Math.ceil(total / 4);
    const pos = [];
    const uv = [];
    const idxs = [];
    const perpX = -dz;
    const perpZ = dx;
    for (let s = 0; s <= steps; s++) {
      const d = (s / steps) * total;
      const cx = sx + dx * d;
      const cz = sz + dz * d;
      const widen = 1 + Math.sin(s * 0.7) * 0.15;
      for (const side of [-1, 1]) {
        const x = cx + perpX * side * L.half * widen;
        const z = cz + perpZ * side * L.half * widen;
        const onRoad = Math.hypot(x - px, z - pz) < T.W[i] + 3;
        const y = (onRoad ? Wd.ROADH[i] + 0.12 : groundY(x, z) + 0.35);
        pos.push(x, y, z);
        uv.push(side < 0 ? 0 : 1, d / 10);
      }
      if (s < steps) {
        const o = s * 2;
        idxs.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    const tex = lavaTex.clone();
    tex.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a140c, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    const light = new THREE.PointLight(0xff6a1a, 0, 36, 1.5);
    light.position.set(px, Wd.ROADH[i] + 3, pz);
    scene.add(light);
    return { L, mat, tex, light };
  });

  // ── Gullfoss: river in the gorge + the falls ──
  const flowTex = streakTexture();
  flowTex.repeat.set(1, 1);
  const water = [];
  {
    const idxs = [];
    const pos = [];
    const uv = [];
    const ids = [];
    for (let i = 0; i < T.N; i++) if (T.ZONE_LIST[T.ZONE[i]].key === "gullfoss") ids.push(i);
    ids.slice(3, -3).forEach((i, k) => {
      for (const off of [T.W[i] + 14, T.W[i] + 30]) {
        const x = T.X[i] + T.NX[i] * off;
        const z = T.Z[i] + T.NZ[i] * off;
        pos.push(x, groundY(T.X[i] + T.NX[i] * (T.W[i] + 22), T.Z[i] + T.NZ[i] * (T.W[i] + 22)) + 0.4, z);
        uv.push(off > T.W[i] + 20 ? 1 : 0, k * 0.15);
      }
      if (k > 0) {
        const o = (k - 1) * 2;
        idxs.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    const river = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flowTex, color: 0x9fd3e6, roughness: 0.2, emissive: 0x2a5a6a, emissiveIntensity: 0.3, side: THREE.DoubleSide }));
    scene.add(river);
    water.push(flowTex);
  }
  // Gullfoss: a river on the far plateau drops in two steps into the gorge.
  const fallsTex = streakTexture();
  fallsTex.repeat.set(3, 1);
  {
    const i = T.at(5.55);
    const h0 = heading(i);
    const along = (d, off) => [T.X[i] + T.TX[i] * d + T.NX[i] * off, T.Z[i] + T.TZ[i] * d + T.NZ[i] * off];
    const floorY = groundY(...along(0, T.W[i] + 22)) + 0.4;
    const rimOff = T.W[i] + 58;
    const rimY = groundY(...along(0, rimOff + 6));
    const midY = floorY + (rimY - floorY) * 0.45;
    const waterMat = new THREE.MeshStandardMaterial({ map: fallsTex, color: 0xd8eef6, emissive: 0x3d6f82, emissiveIntensity: 0.35, roughness: 0.25, side: THREE.DoubleSide });
    // upper step, set back at the rim, and the lower main drop
    for (const [off, top, bottom, width] of [[rimOff, rimY + 0.4, midY, 16], [rimOff - 9, midY + 0.2, floorY, 24]]) {
      const [x, z] = along(0, off);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, Math.max(1, top - bottom)), waterMat);
      sheet.position.set(x, (top + bottom) / 2, z);
      sheet.rotation.y = yaw(h0);
      scene.add(sheet);
    }
    // ledge between the steps
    {
      const [x, z] = along(0, rimOff - 4.5);
      const ledge = new THREE.Mesh(new THREE.PlaneGeometry(9, 16), new THREE.MeshStandardMaterial({ map: flowTex, color: 0xbfe3f0, roughness: 0.2, emissive: 0x2a5a6a, emissiveIntensity: 0.3 }));
      ledge.rotation.set(-Math.PI / 2, 0, yaw(h0) + Math.PI / 2);
      ledge.position.set(x, midY + 0.25, z);
      scene.add(ledge);
    }
    // the feeding river across the plateau, flowing toward the gorge
    const pts = [];
    for (let d = 0; d <= 120; d += 6) {
      const [x, z] = along(Math.sin(d * 0.05) * 10, rimOff + d);
      pts.push([x, groundY(x, z) + 0.35, z]);
    }
    const pos = [];
    const uv = [];
    const idx = [];
    pts.forEach(([x, y, z], k) => {
      for (const s of [-1, 1]) {
        pos.push(x + T.TX[i] * s * 7, Math.max(y, rimY + 0.3), z + T.TZ[i] * s * 7);
        uv.push(s < 0 ? 0 : 1, -k * 0.5);
      }
      if (k > 0) {
        const o = (k - 1) * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flowTex, color: 0x9fd3e6, roughness: 0.2, emissive: 0x2a5a6a, emissiveIntensity: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })));
    water.push(fallsTex);
  }
  const spray = particleCloud(lite ? 30 : 60, softDot(), { size: 7, opacity: 0.45 });
  scene.add(spray.pts);
  const sprayAt = (() => {
    const i = T.at(5.55);
    const [x, z] = T.beside(i, 1, 44);
    return [x, groundY(x, z), z];
  })();

  // ── walking sheep ──
  const walkers = T.SHEEP.map(() => {
    const m = clone(gltf, "Sheep");
    scene.add(m);
    return m;
  });

  // ── flora: Hallormsstaður forest in the east fjords, birch clumps elsewhere, grass on the verges ──
  {
    const birch = [[], []];
    const spruce = [];
    const grass = [];
    const fj = [];
    for (let i = 0; i < T.N; i++) if (T.ZONE_LIST[T.ZONE[i]].key === "fjords") fj.push(i);
    for (let k = 0; k < (lite ? 500 : 1400); k++) {
      const i = fj[Math.floor(rng() * fj.length)];
      const side = rng() < 0.5 ? -1 : 1;
      const [x0, z0] = T.beside(i, side, 4 + Math.pow(rng(), 0.7) * 75);
      const x = x0 + (rng() - 0.5) * 6;
      const z = z0 + (rng() - 0.5) * 6;
      const y = groundY(x, z);
      if (y < 1 || y > 40 || distToRoad(x, z).d < 3.5) continue;
      const s = 0.8 + rng() * 0.7;
      if (rng() < 0.38) spruce.push({ x, y: y - 0.2, z, rot: rng() * 6.28, s });
      else birch[rng() < 0.5 ? 0 : 1].push({ x, y: y - 0.1, z, rot: rng() * 6.28, s });
    }
    for (let k = 0; k < (lite ? 220 : 600); k++) {
      const x = Wd.X0 + rng() * Wd.NXC * Wd.CELL;
      const z = Wd.Z0 + rng() * Wd.NZC * Wd.CELL;
      const y = groundY(x, z);
      if (y < 2 || y > 26) continue;
      const { d, i } = distToRoad(x, z);
      const zk = T.ZONE_LIST[T.ZONE[i]].key;
      if (d < 6 || d > 150 || zk === "sand" || zk === "ice" || zk === "lava") continue;
      for (let c = 0; c < 3; c++) {
        const bx = x + (rng() - 0.5) * 9;
        const bz = z + (rng() - 0.5) * 9;
        birch[c % 2].push({ x: bx, y: groundY(bx, bz) - 0.1, z: bz, rot: rng() * 6.28, s: 0.6 + rng() * 0.6 });
      }
    }
    const perSample = lite ? 2 : 5;
    for (let i = 0; i < T.N; i++) {
      const zk = T.ZONE_LIST[T.ZONE[i]].key;
      if (zk === "sand" || zk === "ice" || zk === "rift" || zk === "lava") continue;
      for (let c = 0; c < perSample; c++) {
        const side = rng() < 0.5 ? -1 : 1;
        const [x0, z0] = T.beside(i, side, Wd.SHOULDER + 0.9 + Math.pow(rng(), 1.6) * 16);
        const x = x0 + T.TX[i] * (rng() - 0.5) * 4;
        const z = z0 + T.TZ[i] * (rng() - 0.5) * 4;
        grass.push({ x, y: groundY(x, z) - 0.04, z, rot: rng() * 6.28, s: 0.7 + rng() * 0.9 });
      }
    }
    scene.add(instanced(gltf, "Birch1", birch[0]));
    scene.add(instanced(gltf, "Birch2", birch[1]));
    scene.add(instanced(gltf, "Spruce", spruce));
    scene.add(instanced(gltf, "Grass", grass, { shadow: false }));
  }

  // ── rumble curbs on the inside of real corners ──
  {
    const curbTex = canvasTex(
      64,
      256,
      (g, w, h) => {
        for (let k = 0; k < 8; k++) {
          g.fillStyle = k % 2 ? "#f4f4f2" : "#d8262b";
          g.fillRect(0, (k * h) / 8, w, h / 8);
        }
      },
      { repeat: true },
    );
    const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3 });
    const turn = new Float32Array(T.N);
    for (let i = 0; i < T.N; i++) {
      const a = Math.atan2(T.TZ[T.wrap(i - 3)], T.TX[T.wrap(i - 3)]);
      const b = Math.atan2(T.TZ[T.wrap(i + 3)], T.TX[T.wrap(i + 3)]);
      turn[i] = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    }
    let i = 0;
    while (i < T.N) {
      if (Math.abs(turn[i]) < 0.12 || T.ZONE_LIST[T.ZONE[i]].key === "rift") {
        i++;
        continue;
      }
      const inner = Math.sign(turn[i]); // right turn → curb on the right (+1)
      let j = i;
      while (j < T.N && Math.sign(turn[j]) === inner && Math.abs(turn[j]) > 0.08) j++;
      if (j - i >= 3) {
        const pos = [];
        const uv = [];
        const idx = [];
        let v = 0;
        for (let k = i - 1; k <= j; k++) {
          const s = T.wrap(k);
          if (k > i - 1) v += Math.hypot(T.X[s] - T.X[T.wrap(k - 1)], T.Z[s] - T.Z[T.wrap(k - 1)]) / 4;
          const y = Wd.ROADH[s] + 0.1;
          for (const off of [T.W[s] - 0.2, T.W[s] + 1.2]) {
            pos.push(T.X[s] + T.NX[s] * inner * off, y, T.Z[s] + T.NZ[s] * inner * off);
            uv.push(off > T.W[s] ? 1 : 0, v);
          }
          if (k > i - 1) {
            const o = (k - i) * 2;
            if (inner > 0) idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
            else idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, curbMat);
        m.receiveShadow = true;
        scene.add(m);
      }
      i = j + 1;
    }
  }

  // ── night dressing: neon road edges, street lamps with light pools ──
  const nightGroup = new THREE.Group();
  nightGroup.visible = false;
  scene.add(nightGroup);
  {
    const ribbon = (side, color) => {
      const pos = [];
      const idx = [];
      for (let k = 0; k <= T.N; k++) {
        const s = T.wrap(k);
        const off = side * (T.W[s] + Wd.SHOULDER + 0.35);
        const x = T.X[s] + T.NX[s] * off;
        const z = T.Z[s] + T.NZ[s] * off;
        const y = Wd.ROADH[s];
        pos.push(x, y + 0.08, z, x, y + 0.24, z);
        if (k < T.N) {
          const o = k * 2;
          idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false, fog: true });
      nightGroup.add(new THREE.Mesh(geo, mat));
    };
    ribbon(-1, new THREE.Color(0.15, 1.35, 2.0)); // cyan on the left
    ribbon(1, new THREE.Color(2.0, 0.22, 1.2)); // pink on the right
  }
  const lampList = [];
  for (let i = 0; i < T.N; i += 8) {
    const zk = T.ZONE_LIST[T.ZONE[i]].key;
    if (zk !== "city" && zk !== "west" && zk !== "gullfoss") continue;
    const side = (i / 8) % 2 ? 1 : -1;
    const [x, z] = T.beside(i, side, Wd.SHOULDER + 2.4);
    const toRoad = Math.atan2(-T.NZ[i] * side, -T.NX[i] * side);
    lampList.push({ x, y: groundY(x, z) - 0.1, z, rot: yaw(toRoad), i, side });
  }
  scene.add(instanced(gltf, "StreetLamp", lampList));
  {
    const poolTex = softDot("255,214,150");
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
    for (const l of lampList) {
      const px = l.x - T.NX[l.i] * l.side * 2.1;
      const pz = l.z - T.NZ[l.i] * l.side * 2.1;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 20), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(px, Wd.ROADH[l.i] + 0.12, pz);
      nightGroup.add(pool);
    }
  }

  // ── night sky: stars, aurora curtains and a low moon ──
  const nightSky = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 }, uMoon: { value: sunDir.clone() } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uMoon; varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          vec3 zenith = vec3(0.02, 0.02, 0.07);
          vec3 horizon = vec3(0.22, 0.07, 0.30);
          vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.45));
          col += vec3(0.35, 0.1, 0.25) * pow(1.0 - abs(h), 12.0) * 0.6;
          // stars
          vec2 sp = vec2(atan(d.z, d.x) * 180.0, d.y * 180.0);
          float st = step(0.9965, hash(floor(sp))) * smoothstep(0.02, 0.2, h);
          col += st * (0.6 + 0.4 * sin(uTime * 3.0 + hash(floor(sp)) * 40.0));
          // aurora: bands sheared over the sky, rippling
          float az = atan(d.z, d.x);
          float band = 0.0;
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float y0 = 0.28 + 0.12 * fk + 0.06 * sin(az * (2.0 + fk) + uTime * (0.12 + 0.05 * fk));
            float n = noise(vec2(az * 9.0 + fk * 3.0, uTime * 0.25 + fk));
            float curtain = smoothstep(0.0, 0.05, h - y0 + 0.05) * (1.0 - smoothstep(0.0, 0.28 + n * 0.15, h - y0));
            band += curtain * (0.35 + 0.65 * n) * (0.6 + 0.4 * sin(az * 30.0 + n * 6.0 + uTime));
          }
          vec3 aur = mix(vec3(0.1, 1.0, 0.55), vec3(0.75, 0.25, 1.0), smoothstep(0.35, 0.75, h));
          col += aur * band * 0.55;
          // moon, low and big, glowing
          float m = max(dot(d, normalize(uMoon)), 0.0);
          col += vec3(1.0, 0.85, 0.95) * smoothstep(0.9993, 0.9996, m) * 2.5;
          col += vec3(0.9, 0.5, 0.8) * pow(m, 60.0) * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  nightSky.visible = false;
  nightSky.renderOrder = -1;
  scene.add(nightSky);
  const envDay = scene.environment;
  let envNight = null;
  {
    const es = new THREE.Scene();
    const ns = nightSky.clone();
    ns.visible = true;
    es.add(ns);
    envNight = pmrem.fromScene(es, 0, 1, 5000).texture;
  }
  const glowMats = {};
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (["ChurchWindow", "LampBulb", "Lamp", "Reflector", "HeadLight", "Banner"].includes(m.name)) glowMats[m.name] = m;
    }
  });
  scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.name === "ChurchWindow") (glowMats.windows ||= new Set()).add(m);
    }
  });
  let isNight = false;
  function setNight(n) {
    isNight = n;
    sky.visible = !n;
    nightSky.visible = n;
    nightGroup.visible = n;
    scene.environment = n ? envNight : envDay;
    scene.environmentIntensity = n ? 0.9 : 0.6;
    sun.color.setHex(n ? 0x8fa6ff : 0xffdcae);
    sun.intensity = n ? 0.7 : 2.3;
    hemi.color.setHex(n ? 0x5a4a9a : 0xd6e8ff);
    hemi.groundColor.setHex(n ? 0x14101c : 0x3d4a33);
    hemi.intensity = n ? 0.55 : 0.35;
    scene.fog.color.setHex(n ? 0x1d1236 : 0xc9d6de);
    scene.fog.near = n ? 120 : 260;
    scene.fog.far = n ? 900 : lite ? 1100 : 1700;
    ocean.mesh.material.color.setHex(n ? 0x0d1f33 : 0x1d5871);
    for (const m of glowMats.windows || []) {
      m.emissive = new THREE.Color(0xffc46b);
      m.emissiveIntensity = n ? 2.2 : 0;
    }
    if (glowMats.LampBulb) glowMats.LampBulb.emissiveIntensity = n ? 8 : 0.5;
    if (glowMats.Lamp) glowMats.Lamp.emissiveIntensity = n ? 12 : 4;
    if (glowMats.Reflector) glowMats.Reflector.emissiveIntensity = n ? 3 : 1.2;
  }

  return {
    scene,
    gltf,
    sun,
    sunDir,
    setNight,
    nightSky,
    get night() {
      return isNight;
    },
    terrain,
    ocean,
    checkpoints,
    boostMats,
    walkers,
    geyser: { ringMat, column, columnMat, steam, gy },
    volcano: { plume, craterY, crater, craterLight },
    lava,
    water,
    spray,
    sprayAt,
    bergs,
    clone: (name) => clone(gltf, name),
  };
}

/** Per-frame animation of the living world. `hz` gives hazard phases. */
export function animateWorld(w, t, dt, hz, sheepPos) {
  if (w.nightSky.visible) w.nightSky.material.uniforms.uTime.value = t;
  // ocean ripple
  w.ocean.normal.offset.x = t * 0.004;
  w.ocean.normal.offset.y = t * 0.0025;
  for (const tex of w.water) tex.offset.y = -t * 0.9;

  // geyser
  const gp = hz.geyser;
  const g = w.geyser;
  g.ringMat.opacity = gp.state === "warn" ? 0.35 + 0.55 * Math.abs(Math.sin(t * 9)) : 0;
  g.column.visible = gp.state === "blow";
  if (gp.state === "blow") {
    const k = Math.min(1, gp.k * 4) * (1 - Math.max(0, gp.k - 0.8) * 5);
    g.column.scale.set(1 + k * 0.4, 2 + 30 * k, 1 + k * 0.4);
    g.columnMat.opacity = 0.85 * Math.max(0.2, 1 - Math.max(0, gp.k - 0.7) * 3);
  }
  {
    const { pts, pos, seeds } = g.steam;
    const G = T.GEYSER;
    const strength = gp.state === "blow" ? 1 : gp.state === "warn" ? 0.5 : 0.18;
    for (let k = 0; k < seeds.length; k++) {
      const [a, b, c] = seeds[k];
      const life = (t * (0.15 + a * 0.2) + b) % 1;
      const r = 1.5 + life * 7 * strength;
      pos[k * 3] = G.x + Math.cos(c * 6.28 + life) * r;
      pos[k * 3 + 1] = g.gy + 1 + life * (6 + 30 * strength);
      pos[k * 3 + 2] = G.z + Math.sin(c * 6.28 + life) * r;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.material.opacity = 0.25 + 0.45 * strength;
  }

  // volcano plume
  {
    const { pts, pos, seeds } = w.volcano.plume;
    const V = T.VOLCANO;
    for (let k = 0; k < seeds.length; k++) {
      const [a, b, c] = seeds[k];
      const life = (t * (0.02 + a * 0.02) + b) % 1;
      pos[k * 3] = V.x + (c - 0.5) * 20 + life * 90;
      pos[k * 3 + 1] = w.volcano.craterY + 8 + life * 150;
      pos[k * 3 + 2] = V.z + (a - 0.5) * 20 - life * 40;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    w.volcano.craterLight.intensity = 500 + Math.sin(t * 3.1) * 120 + Math.sin(t * 7.3) * 60;
  }

  // lava pulses
  for (const lv of w.lava) {
    const st = hz.lava(lv.L);
    const target = st === "flow" ? 2.4 : st === "warn" ? 0.7 + 0.5 * Math.abs(Math.sin(t * 8)) : 0.12;
    lv.mat.emissiveIntensity += (target - lv.mat.emissiveIntensity) * Math.min(1, dt * 6);
    lv.light.intensity = lv.mat.emissiveIntensity * 60;
    lv.tex.offset.y = -t * (st === "flow" ? 0.35 : 0.03);
  }

  // waterfall spray
  {
    const { pts, pos, seeds } = w.spray;
    const [x, y, z] = w.sprayAt;
    for (let k = 0; k < seeds.length; k++) {
      const [a, b, c] = seeds[k];
      const life = (t * (0.3 + a * 0.3) + b) % 1;
      pos[k * 3] = x + (c - 0.5) * 26;
      pos[k * 3 + 1] = y + life * 12;
      pos[k * 3 + 2] = z + (a - 0.5) * 8;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  }

  // floating icebergs
  for (const b of w.bergs) {
    b.m.position.y = Math.sin(t * 0.6 + b.phase) * 0.25 - 0.3;
    b.m.rotation.z = Math.sin(t * 0.4 + b.phase) * 0.02;
  }

  // boost pads pulse
  for (const m of w.boostMats) m.emissiveIntensity = 0.6 + 0.5 * Math.abs(Math.sin(t * 4));

  // walking sheep
  T.SHEEP.forEach((s, k) => {
    const p = sheepPos(s);
    const m = w.walkers[k];
    m.position.set(p.x, Wd.ROADH[s.i] + Math.abs(Math.sin(t * 8 + k)) * 0.06, p.z);
    m.rotation.y = yaw(Math.atan2(T.NZ[s.i] * p.dir, T.NX[s.i] * p.dir));
  });
}
