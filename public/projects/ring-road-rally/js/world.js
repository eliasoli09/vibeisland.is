/**
 * The island's shape, as numbers: a height grid shared by the renderer (terrain
 * mesh) and the physics (ground height under the car), plus the road's height
 * profile. No three.js here, so it can be reasoned about and tested alone.
 */

import * as T from "./track.js";

// ── noise ────────────────────────────────────────────────────────────────

function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 4) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < oct; o++) {
    s += amp * vnoise(x * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// ── grid ─────────────────────────────────────────────────────────────────

export const CELL = 3.2;
export const X0 = -170;
export const Z0 = -130;
export const NXC = 420; // cells across (x)
export const NZC = 290; // cells down (z)
export const HGT = new Float32Array((NXC + 1) * (NZC + 1));
/** Per-vertex "what is this ground" for colouring: 0 grass, 1 black sand, 2 lava field, 3 rock, 4 snow, 5 city, 6 beach/seabed */
export const KIND = new Uint8Array((NXC + 1) * (NZC + 1));
/** Nearest road sample per vertex (or 65535) and its signed lateral offset. */
const NEAR = new Uint16Array((NXC + 1) * (NZC + 1)).fill(65535);
const NEARD = new Float32Array((NXC + 1) * (NZC + 1)).fill(1e9);
const LAT = new Float32Array((NXC + 1) * (NZC + 1));
const SHORE = new Float32Array((NXC + 1) * (NZC + 1));

/** Road centre-line height per sample. */
export const ROADH = new Float32Array(T.N);

const idx = (ix, iz) => iz * (NXC + 1) + ix;

function buildShoreDistance() {
  // 1) inside/outside by scanline polygon fill
  const inside = new Uint8Array((NXC + 1) * (NZC + 1));
  const P = T.COAST;
  for (let iz = 0; iz <= NZC; iz++) {
    const z = Z0 + iz * CELL;
    const xs = [];
    for (let k = 0; k < P.length; k++) {
      const [ax, az] = P[k];
      const [bx, bz] = P[(k + 1) % P.length];
      if ((az <= z && bz > z) || (bz <= z && az > z)) xs.push(ax + ((z - az) / (bz - az)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil((xs[k] - X0) / CELL));
      const b = Math.min(NXC, Math.floor((xs[k + 1] - X0) / CELL));
      for (let ix = a; ix <= b; ix++) inside[idx(ix, iz)] = 1;
    }
  }
  // 2) chamfer distance transform on each side of the shore
  const INF = 1e9;
  const din = new Float32Array(inside.length);
  const dout = new Float32Array(inside.length);
  for (let i = 0; i < inside.length; i++) {
    din[i] = inside[i] ? INF : 0;
    dout[i] = inside[i] ? 0 : INF;
  }
  const d1 = CELL;
  const d2 = CELL * 1.4142;
  for (const d of [din, dout]) {
    for (let iz = 0; iz <= NZC; iz++) {
      for (let ix = 0; ix <= NXC; ix++) {
        const i = idx(ix, iz);
        let v = d[i];
        if (ix > 0) v = Math.min(v, d[i - 1] + d1);
        if (iz > 0) {
          v = Math.min(v, d[i - NXC - 1] + d1);
          if (ix > 0) v = Math.min(v, d[i - NXC - 2] + d2);
          if (ix < NXC) v = Math.min(v, d[i - NXC] + d2);
        }
        d[i] = v;
      }
    }
    for (let iz = NZC; iz >= 0; iz--) {
      for (let ix = NXC; ix >= 0; ix--) {
        const i = idx(ix, iz);
        let v = d[i];
        if (ix < NXC) v = Math.min(v, d[i + 1] + d1);
        if (iz < NZC) {
          v = Math.min(v, d[i + NXC + 1] + d1);
          if (ix < NXC) v = Math.min(v, d[i + NXC + 2] + d2);
          if (ix > 0) v = Math.min(v, d[i + NXC] + d2);
        }
        d[i] = v;
      }
    }
  }
  for (let i = 0; i < inside.length; i++) SHORE[i] = inside[i] ? din[i] : -dout[i];
}

/** Terrain before the road is carved into it. */
function natural(x, z, shore) {
  if (shore <= 0) return Math.max(-14, -1.2 + shore * 0.12);
  const n = fbm(x * 0.012, z * 0.012);
  const detail = fbm(x * 0.05 + 40, z * 0.05 - 17, 3);
  let h = smooth(0, 45, shore) * (2.5 + n * 12 + detail * 2.5);
  // Highlands and ice caps rise toward the interior.
  h += 62 * smooth(70, 230, shore) * (0.55 + 0.6 * fbm(x * 0.006 + 9, z * 0.006 + 3, 3));
  // The volcano.
  const vd = Math.hypot(x - T.VOLCANO.x, z - T.VOLCANO.z);
  if (vd < T.VOLCANO.radius) {
    const k = 1 - vd / T.VOLCANO.radius;
    const cone = T.VOLCANO.height * Math.pow(k, 1.6);
    const crater = vd < 16 ? (16 - vd) * 0.9 : 0;
    h = Math.max(h, cone - crater + detail * 2);
  }
  return h;
}

function buildRoadInfluence() {
  const R = 70; // metres of road influence
  const rc = Math.ceil(R / CELL);
  for (let i = 0; i < T.N; i++) {
    const cx = Math.round((T.X[i] - X0) / CELL);
    const cz = Math.round((T.Z[i] - Z0) / CELL);
    for (let dz = -rc; dz <= rc; dz++) {
      const iz = cz + dz;
      if (iz < 0 || iz > NZC) continue;
      for (let dx = -rc; dx <= rc; dx++) {
        const ix = cx + dx;
        if (ix < 0 || ix > NXC) continue;
        const x = X0 + ix * CELL;
        const z = Z0 + iz * CELL;
        const ex = x - T.X[i];
        const ez = z - T.Z[i];
        const d = ex * ex + ez * ez;
        const j = idx(ix, iz);
        if (d < NEARD[j]) {
          NEARD[j] = d;
          NEAR[j] = i;
          LAT[j] = ex * T.NX[i] + ez * T.NZ[i];
        }
      }
    }
  }
}

function sampleNatural(x, z) {
  const fx = (x - X0) / CELL;
  const fz = (z - Z0) / CELL;
  const ix = Math.max(0, Math.min(NXC, Math.round(fx)));
  const iz = Math.max(0, Math.min(NZC, Math.round(fz)));
  return natural(x, z, SHORE[idx(ix, iz)]);
}

function buildRoadProfile() {
  const raw = new Float32Array(T.N);
  for (let i = 0; i < T.N; i++) raw[i] = sampleNatural(T.X[i], T.Z[i]);
  // Heavy smoothing: the road may climb, but never lurch.
  let a = raw;
  for (let pass = 0; pass < 6; pass++) {
    const b = new Float32Array(T.N);
    for (let i = 0; i < T.N; i++) {
      let s = 0;
      for (let k = -10; k <= 10; k++) s += a[T.wrap(i + k)];
      b[i] = s / 21;
    }
    a = b;
  }
  for (let i = 0; i < T.N; i++) {
    // Rolling crests along the way, so the road is never a flat ribbon.
    // Noise sampled around a circle so the profile closes seamlessly at the
    // start line (the lap distance wraps there).
    const th = (T.D[i] / T.LENGTH) * Math.PI * 2;
    const R = (T.LENGTH * 0.0055) / (Math.PI * 2);
    const roll = 16 * (fbm(R * Math.cos(th) + 7, R * Math.sin(th) + 3.7, 3) - 0.3);
    let h = Math.max(1.6, a[i] * 0.8 + 1 + roll);
    const zk = T.ZONE_LIST[T.ZONE[i]].key;
    if (zk === "ice" || zk === "sand") h = Math.min(h, 3.2);
    ROADH[i] = h;
  }
  // The Golden Circle sits on a plateau, so Gullfoss has a real drop. The lift
  // is smoothed on its own so the climbs onto it stay drivable.
  let lift = new Float32Array(T.N);
  for (let i = 0; i < T.N; i++) lift[i] = { rift: 6, geysir: 10, gullfoss: 15, lava: 2 }[T.ZONE_LIST[T.ZONE[i]].key] ?? 0;
  for (let pass = 0; pass < 8; pass++) {
    const b = new Float32Array(T.N);
    for (let i = 0; i < T.N; i++) {
      let s = 0;
      for (let k = -10; k <= 10; k++) s += lift[T.wrap(i + k)];
      b[i] = s / 21;
    }
    lift = b;
  }
  for (let i = 0; i < T.N; i++) ROADH[i] += lift[i];
  // Re-smooth after clamping, then add the jumps.
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float32Array(T.N);
    for (let i = 0; i < T.N; i++) {
      let s = 0;
      for (let k = -6; k <= 6; k++) s += ROADH[T.wrap(i + k)];
      b[i] = s / 13;
    }
    ROADH.set(b);
  }
  for (const [seg, height, width] of T.JUMPS) {
    const c = T.at(seg);
    for (let k = -14; k <= 14; k++) {
      ROADH[T.wrap(c + k)] += height * Math.exp(-(k * k) / (2 * width * width));
    }
  }
}

function buildHeights() {
  for (let iz = 0; iz <= NZC; iz++) {
    for (let ix = 0; ix <= NXC; ix++) {
      const j = idx(ix, iz);
      const x = X0 + ix * CELL;
      const z = Z0 + iz * CELL;
      const shore = SHORE[j];
      let h = natural(x, z, shore);
      let kind = shore <= 0 ? 6 : shore < 14 ? 1 : 0;
      if (h > 46 + fbm(x * 0.02, z * 0.02) * 14) kind = 4;
      else if (h > 30) kind = 3;
      const vd = Math.hypot(x - T.VOLCANO.x, z - T.VOLCANO.z);
      if (vd < T.VOLCANO.radius * 0.95 && kind !== 4) kind = 2;

      const i = NEAR[j];
      if (i !== 65535) {
        const zone = T.ZONE_LIST[T.ZONE[i]];
        const w = T.W[i];
        const lat = LAT[j];
        const l = Math.abs(lat);
        const rh = ROADH[i];
        const t = smooth(w + 4, w + 34, l);
        h = mix(rh - 0.25, h, t);
        if (zone.key === "rift" && l > w + 0.5) {
          const cliff = 11 * smooth(w + 0.5, w + 2.5, l) * (1 - smooth(w + 16, w + 30, l));
          h = Math.max(h, rh + cliff);
          if (l < w + 18) kind = 3;
        }
        if (zone.key === "gullfoss" && lat > w + 2) {
          const depth = 24 * smooth(w + 2.5, w + 6, lat) * (1 - smooth(w + 40, w + 58, lat));
          // Keep the gorge floor above sea level: the river runs down there.
          h = Math.min(h, Math.max(rh - depth, 1.4));
          if (depth > 2) kind = 3;
        }
        if (zone.key === "ice" && lat < -(w + 8)) {
          // Jökulsárlón: the glacier lagoon beside the road.
          const f = smooth(w + 8, w + 20, -lat) * (1 - smooth(w + 56, w + 68, -lat));
          h = mix(h, -3, f);
          if (f > 0.3) kind = 6;
        }
        if (zone.key === "sand" && l < w + 45) kind = 1;
        if (zone.key === "lava" && l < w + 60 && kind === 0) kind = 2;
        if (zone.key === "city" && l < w + 40 && kind === 0) kind = 5;
      }
      HGT[j] = h;
      KIND[j] = kind;
    }
  }
}

buildShoreDistance();
buildRoadInfluence();
buildRoadProfile();
buildHeights();

/** Ground height of the terrain grid (bilinear). */
export function terrainAt(x, z) {
  let fx = (x - X0) / CELL;
  let fz = (z - Z0) / CELL;
  fx = Math.max(0, Math.min(NXC - 0.001, fx));
  fz = Math.max(0, Math.min(NZC - 0.001, fz));
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const u = fx - ix;
  const v = fz - iz;
  const a = HGT[idx(ix, iz)];
  const b = HGT[idx(ix + 1, iz)];
  const c = HGT[idx(ix, iz + 1)];
  const d = HGT[idx(ix + 1, iz + 1)];
  // Match the renderer's triangle split (a-c-b / b-c-d) so the car sits on
  // what you see.
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

/** Road surface height near sample i, interpolated along the road. */
export function roadAt(i, x, z) {
  const along = (x - T.X[i]) * T.TX[i] + (z - T.Z[i]) * T.TZ[i];
  const j = along >= 0 ? T.wrap(i + 1) : T.wrap(i - 1);
  const seg = Math.hypot(T.X[j] - T.X[i], T.Z[j] - T.Z[i]) || 1;
  const t = Math.min(1, Math.abs(along) / seg);
  return ROADH[i] + (ROADH[j] - ROADH[i]) * t;
}

export const SHOULDER = 1.4;
