/**
 * The Ring Road loop — geometry only, in metres. World axes: x east, z south
 * (the old 2D map's y), y up. North is -z.
 *
 * Every zone teaches one pattern: rift walls, a timed geyser, a one-sided drop
 * into the Gullfoss gorge, lava pulses, loose black sand, glare ice, hairpins,
 * sheep and a jump — then the west coast lets you breathe before Reykjavík.
 */

const S = 0.14; // old map units → metres

/** Control points [x, z, zone of the segment that starts here]. */
const CONTROL = [
  [900, 3000, "city"],
  [1500, 3050, "city"],
  [2000, 2750, "rift"],
  [2350, 2450, "rift"],
  [2750, 2350, "geysir"],
  [3200, 2500, "gullfoss"],
  [3650, 2350, "gullfoss"],
  [4000, 2550, "lava"],
  [3900, 3000, "lava"],
  [3700, 3400, "lava"],
  [4200, 3700, "sand"],
  [4800, 3850, "sand"],
  [5400, 3700, "ice"],
  [6000, 3400, "ice"],
  [6350, 2950, "fjords"],
  [6450, 2400, "fjords"],
  [6100, 2100, "fjords"],
  [6400, 1700, "fjords"],
  [6000, 1300, "high"],
  [5300, 1000, "high"],
  [4500, 900, "high"],
  [3700, 1100, "high"],
  [2900, 900, "west"],
  [2100, 1100, "west"],
  [1500, 1500, "west"],
  [1000, 1900, "west"],
  [700, 2500, "city"],
].map(([x, z, k]) => [x * S, z * S, k]);

/**
 * Surfaces. w = half width (m), grip = how fast sideways slide dies (1 = tarmac),
 * top = top-speed multiplier, style = road texture. `walls` = hard sides.
 */
export const ZONES = {
  city: { key: "city", w: 9, grip: 1, top: 1, style: "asphalt", tint: 0x8d9197 },
  rift: { key: "rift", w: 6.2, grip: 1, top: 1, style: "asphalt", tint: 0x7f8388, walls: true },
  geysir: { key: "geysir", w: 8, grip: 0.8, top: 0.95, style: "gravel", tint: 0xc3ae88 },
  gullfoss: { key: "gullfoss", w: 8, grip: 1, top: 1, style: "asphalt", tint: 0x8a8d90 },
  lava: { key: "lava", w: 8.4, grip: 0.95, top: 1, style: "asphalt", tint: 0x6b6969 },
  sand: { key: "sand", w: 9, grip: 0.62, top: 0.9, style: "sand", tint: 0x3a3a3e },
  ice: { key: "ice", w: 9, grip: 0.22, top: 1, style: "ice", tint: 0xd9eef6 },
  fjords: { key: "fjords", w: 7.4, grip: 0.8, top: 0.95, style: "gravel", tint: 0xb09a78 },
  high: { key: "high", w: 8.4, grip: 0.8, top: 0.95, style: "gravel", tint: 0xbba583 },
  west: { key: "west", w: 9, grip: 1, top: 1, style: "asphalt", tint: 0x8d9197 },
};
export const ZONE_LIST = Object.values(ZONES);
export const OFFROAD = { grip: 0.7, top: 0.45 };
export const SNOW = { grip: 0.35, top: 0.45 };

const SPS = 22; // samples per control segment
export const N = CONTROL.length * SPS;
export const X = new Float32Array(N);
export const Z = new Float32Array(N);
export const TX = new Float32Array(N);
export const TZ = new Float32Array(N);
export const NX = new Float32Array(N); // normal: driver's right
export const NZ = new Float32Array(N);
export const W = new Float32Array(N);
export const ZONE = new Uint8Array(N);
export const D = new Float32Array(N);
export let LENGTH = 0;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

(function build() {
  const C = CONTROL.length;
  const rawW = new Float32Array(N);
  for (let s = 0; s < C; s++) {
    const p0 = CONTROL[(s - 1 + C) % C];
    const p1 = CONTROL[s];
    const p2 = CONTROL[(s + 1) % C];
    const p3 = CONTROL[(s + 2) % C];
    for (let k = 0; k < SPS; k++) {
      const i = s * SPS + k;
      const t = k / SPS;
      X[i] = catmull(p0[0], p1[0], p2[0], p3[0], t);
      Z[i] = catmull(p0[1], p1[1], p2[1], p3[1], t);
      ZONE[i] = ZONE_LIST.indexOf(ZONES[p1[2]]);
      rawW[i] = ZONE_LIST[ZONE[i]].w;
    }
  }
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let k = -8; k <= 8; k++) sum += rawW[(i + k + N) % N];
    W[i] = sum / 17;
  }
  let dist = 0;
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N;
    const b = (i + 1) % N;
    let tx = X[b] - X[a];
    let tz = Z[b] - Z[a];
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    TX[i] = tx;
    TZ[i] = tz;
    // Heading a = atan2(tz, tx); the driver's right is (-tz, tx) in x/z.
    NX[i] = -tz;
    NZ[i] = tx;
    D[i] = dist;
    dist += Math.hypot(X[b] - X[i], Z[b] - Z[i]);
  }
  LENGTH = dist;
})();

export const wrap = (i) => ((i % N) + N) % N;

/** Sample index for "control segment + fraction", e.g. at(4.5). */
export function at(seg) {
  return wrap(Math.round(seg * SPS));
}

/** World point beside the track: side +1 is the driver's right. */
export function beside(i, side, off) {
  return [X[i] + NX[i] * side * (W[i] + off), Z[i] + NZ[i] * side * (W[i] + off)];
}

/** Coastline polygon: control points pushed out from the island centre, wobbled. */
export const COAST = (() => {
  let cx = 0;
  let cz = 0;
  for (const p of CONTROL) {
    cx += p[0];
    cz += p[1];
  }
  cx /= CONTROL.length;
  cz /= CONTROL.length;
  const C = CONTROL.length;
  const steps = 10;
  const pts = CONTROL.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const l = Math.hypot(dx, dz) || 1;
    return [x + (dx / l) * 98, z + (dz / l) * 98];
  });
  const out = [];
  for (let s = 0; s < C; s++) {
    const p0 = pts[(s - 1 + C) % C];
    const p1 = pts[s];
    const p2 = pts[(s + 1) % C];
    const p3 = pts[(s + 2) % C];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const j = s * steps + k;
      const wob = (Math.sin(j * 1.7) * 60 + Math.sin(j * 0.53) * 90) * S;
      const x = catmull(p0[0], p1[0], p2[0], p3[0], t);
      const z = catmull(p0[1], p1[1], p2[1], p3[1], t);
      const dx = x - cx;
      const dz = z - cz;
      const l = Math.hypot(dx, dz) || 1;
      out.push([x + (dx / l) * wob, z + (dz / l) * wob]);
    }
  }
  return out;
})();

export const CENTER = (() => {
  let x = 0;
  let z = 0;
  for (const p of CONTROL) {
    x += p[0];
    z += p[1];
  }
  return [x / CONTROL.length, z / CONTROL.length];
})();

/** Lap gates, evenly spaced; all must be passed in order for a lap to count. */
export const CHECKPOINTS = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => Math.floor((k * N) / 8));

// ── things on the map (positions in metres) ─────────────────────────────

export const GEYSER = (() => {
  const i = at(4.55);
  const [x, z] = beside(i, -1, 5);
  return { i, x, z, radius: 17, period: 7000, warnAt: 4600, blowAt: 5900, blowEnd: 6900 };
})();

/** Lava streams crossing the road below the volcano; they pulse out of phase. */
export const LAVA = [7.75, 8.6, 9.45].map((seg, k) => ({
  i: at(seg),
  half: 3.2,
  period: 6000,
  offset: k * 2000,
  warnAt: 2600,
  flowAt: 3400,
}));

/**
 * The volcano: the interior point farthest from any road (found offline,
 * ~150 m clearance), so its cone never touches the track. Lava runs from its
 * crater down to the three crossings.
 */
export const VOLCANO = { x: 712, z: 338, radius: 128, height: 74 };

export const SHEEP = [18.5, 19.3, 19.8, 20.4, 21.3].map((seg, k) => ({
  i: at(seg),
  speed: 0.0009 + k * 0.00017,
  phase: k * 1.9,
}));

/** Geothermal boost pads ("jarðhiti"). */
export const BOOSTS = [0.45, 10.4, 19.05, 23.4, 16.55].map((seg) => ({ i: at(seg), len: 5 }));

/** Crests that throw you in the air: [segment, height m, width in samples]. */
export const JUMPS = [
  [20.05, 3.6, 3.2],
  [24.3, 3.0, 3.0],
];

/** Speed trap camera. */
export const SPEEDTRAP = { i: at(22.6) };

/** Static round obstacles on the road: rocks on the beach, ice on the lagoon road. */
export const OBSTACLES = [
  { seg: 10.75, lat: -0.45, r: 1.6, kit: "Rock3", scale: 1.1 },
  { seg: 11.35, lat: 0.5, r: 1.6, kit: "Rock1", scale: 1.3 },
  { seg: 11.8, lat: -0.2, r: 1.5, kit: "Rock3", scale: 1.0 },
  { seg: 12.35, lat: 0.45, r: 2.1, kit: "Iceberg1", scale: 0.75 },
  { seg: 12.8, lat: -0.5, r: 2.1, kit: "Iceberg2", scale: 0.8 },
  { seg: 13.3, lat: 0.15, r: 1.9, kit: "Iceberg1", scale: 0.65 },
].map((o) => {
  const i = at(o.seg);
  return { ...o, i, x: X[i] + NX[i] * W[i] * o.lat, z: Z[i] + NZ[i] * W[i] * o.lat };
});
