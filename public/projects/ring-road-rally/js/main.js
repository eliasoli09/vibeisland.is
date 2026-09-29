/**
 * Ring Road Rally 3D — the browser half.
 *
 * The room (server logic.js) only relays positions and keeps the leaderboard;
 * the race is simulated here with a fixed 120 Hz step. Sections:
 *   strings · net · input · tuning · physics · hazards · skills · race ·
 *   render (cars, camera) · HUD · audio · loop
 */

import * as THREE from "three";
import * as T from "./track.js";
import * as Wd from "./world.js";
import { createWorld, animateWorld } from "./scene.js";

// ── strings ─────────────────────────────────────────────────────────────────

const STR = {
  tagline: "Rallý um Hringveginn: frá hátíðinni í Reykjavík, gegnum Almannagjá, framhjá Strokki og Gullfossi, yfir hraunið, eftir svörtum sandi og glerhálum jökulís, yfir hálendið og heim.",
  driver: "Ökumaður",
  start: "Keyra af stað",
  controls: "<kbd>W</kbd>/<kbd>↑</kbd> bensín · <kbd>S</kbd>/<kbd>↓</kbd> bremsa · <kbd>A</kbd><kbd>D</kbd> stýra · <kbd>Bil</kbd> handbremsa · <kbd>C</kbd> myndavél · <kbd>R</kbd> á veginn · <kbd>M</kbd> hljóð · <kbd>Esc</kbd> valmynd",
  sound: "Hljóð",
  shake: "Hristingur",
  board: "Stigatafla",
  route: "Á leiðinni",
  finished: "Í mark!",
  newPb: "Persónulegt met!",
  again: "Keyra aftur",
  menu: "Valmynd",
  lap: "hringur",
  time: "TÍMI",
  bestLap: "BESTI HRINGUR",
  skillScore: "Stig",
  topSpeed: "Hámarkshraði",
  online: (n) => `${n} á brautinni`,
  noTimes: "Enginn tími kominn — vertu fyrst(ur)!",
  offline: "Ótengt — tímar vistast ekki í töflu",
  record: (name, t) => `Brautarmet í hring: ${t} — ${name}`,
  roomMeta: (room, n) => `Herbergi „${room}“ · ${n} tengd(ir). Deildu ?room=nafn til að keppa við vini.`,
  lapsLine: (laps) => `Hringir: ${laps.join(" · ")}`,
  loadingTerrain: "Mótum landslagið…",
  loadingKit: "Sæki Blender-módelin…",
  loadingWorld: "Kveikjum á eldfjallinu…",
  go: "AF STAÐ!",
  lastLap: "LOKAHRINGUR",
  wrongWay: "RÖNG ÁTT",
  fell: "Ofan í gljúfrið!",
  splash: "Í sjóinn!",
  geyser: "STROKKUR GAUS!",
  sheep: "MEEE!",
  crash: "ÁREKSTUR — KEÐJAN TÝNDIST",
  speedTrap: (k) => `HRAÐAGILDRA · ${k} KM/KLST`,
  defaultName: "Ökuþór",
  skills: { drift: "SKRIÐ", air: "STÖKK", speed: "HRAÐI", near: "RÉTT SLOPPIÐ", boost: "JARÐHITI", trap: "HRAÐAGILDRA" },
  zones: {
    city: ["Reykjavík", "Hringvegur-hátíðin — nýttu beinu kaflana"],
    rift: ["Þingvellir · Almannagjá", "Þröngt gil milli flekanna — varist veggina"],
    geysir: ["Geysir", "Strokkur gýs — bíddu eftir bólunum eða farðu hinum megin"],
    gullfoss: ["Gullfoss", "Gljúfrið er hægra megin — ekki detta niður"],
    lava: ["Eyjafjallajökull", "Hraunstraumar renna yfir veginn — farðu þegar þeir kólna"],
    sand: ["Reynisfjara", "Laus svartur sandur og hraunsteinar á veginum"],
    ice: ["Jökulsárlón", "Glerhált! Stýrðu mjúkt og varastu ísjakana"],
    fjords: ["Austfirðir", "Krappar beygjur — bremsaðu fyrir beygju"],
    high: ["Hálendið", "Kindur á veginum — og stökkpallur framundan!"],
    west: ["Vesturland", "Hraðagildra og stökk — lokaspretturinn heim"],
  },
};
const COLORS = [
  { name: "Rauður", hex: 0xc8160f },
  { name: "Gulur", hex: 0xf0b416 },
  { name: "Blár", hex: 0x1f5fc4 },
  { name: "Bleikur", hex: 0xf01f78 },
];

// ── net ─────────────────────────────────────────────────────────────────────

const QS = new URLSearchParams(location.search);
const room = QS.get("room") || "hringvegur";
const DEBUG = QS.has("debug");
const AUTOPILOT = DEBUG && QS.has("autopilot");
/** Debug only: run the simulation faster than real time (slow test machines). */
const SIM = DEBUG ? Math.max(1, Math.min(8, Number(QS.get("sim")) || 1)) : 1;
const LITE = QS.has("lite") || (matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 500);

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
  return null;
}
function playerId() {
  let id = store("hf:game:playerId");
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    store("hf:game:playerId", id);
  }
  return id;
}

let socket = null;
let retry = 0;
let online = false;
let lastRoomMsg = null;
function connect() {
  if (location.protocol === "file:") return;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  try {
    socket = new WebSocket(`${proto}//${location.host}/ws/${encodeURIComponent(room)}`);
  } catch {
    return;
  }
  socket.addEventListener("open", () => {
    retry = 0;
    online = true;
    send({ type: "join", playerId: playerId() });
    sendHello();
  });
  socket.addEventListener("message", (e) => {
    if (e.data === "__pong") return;
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type === "state") onRoomState(msg);
    else if (msg.type === "error" && msg.error === "say hello first") sendHello();
  });
  socket.addEventListener("close", () => {
    online = false;
    retry = Math.min(retry + 1, 6);
    setTimeout(connect, 1000 * 2 ** (retry - 1));
  });
}
const send = (m) => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify(m));
const act = (action) => send({ type: "action", action });
setInterval(() => {
  if (socket?.readyState === WebSocket.OPEN) socket.send("__ping");
}, 30000);

// ── input ───────────────────────────────────────────────────────────────────

const keys = new Set();
const touchKeys = new Set();
const input = { gas: 0, brake: 0, steer: 0, hand: false };
let steerSmooth = 0;

addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) {
    if (e.code === "Enter") startRace();
    return;
  }
  keys.add(e.code);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyR" && race.state === "racing") respawn();
  if (e.code === "KeyC") cycleCamera();
  if (e.code === "KeyM") setSound(!settings.sound);
  if (e.code === "Escape" && race.state !== "menu") showMenu();
  if (e.code === "Enter" && (race.state === "menu" || race.state === "finished")) startRace();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  touchKeys.clear();
});

const touchEl = document.querySelector("#touch");
for (const btn of touchEl.querySelectorAll(".tbtn")) {
  const k = btn.dataset.k;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    if (k === "cam") cycleCamera();
    else touchKeys.add(k);
    btn.classList.add("on");
  });
  const off = () => {
    touchKeys.delete(k);
    btn.classList.remove("on");
  };
  btn.addEventListener("pointerup", off);
  btn.addEventListener("pointercancel", off);
  btn.addEventListener("lostpointercapture", off);
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}
let usedTouch = matchMedia("(pointer: coarse)").matches;
addEventListener("touchstart", () => {
  usedTouch = true;
  document.body.classList.add("touch");
}, { passive: true });
if (usedTouch) document.body.classList.add("touch");

const pad = { start: false, y: false, cam: false };
function readInput(dt) {
  const k = (...codes) => codes.some((c) => keys.has(c));
  let gas = k("ArrowUp", "KeyW") || touchKeys.has("gas") ? 1 : 0;
  let brake = k("ArrowDown", "KeyS") || touchKeys.has("brake") ? 1 : 0;
  // Both held cancel out: predictable, never "last one wins".
  let steer = (k("ArrowRight", "KeyD") || touchKeys.has("right") ? 1 : 0) - (k("ArrowLeft", "KeyA") || touchKeys.has("left") ? 1 : 0);
  let hand = k("Space") || touchKeys.has("hand");
  const gp = navigator.getGamepads?.().find((g) => g && g.connected);
  let analog = false;
  if (gp) {
    const ax = gp.axes[0] ?? 0;
    if (Math.abs(ax) > 0.12) {
      steer = Math.max(-1, Math.min(1, ax));
      analog = true;
    }
    gas = Math.max(gas, gp.buttons[7]?.value ?? 0, gp.buttons[0]?.pressed ? 1 : 0);
    brake = Math.max(brake, gp.buttons[6]?.value ?? 0, gp.buttons[1]?.pressed ? 1 : 0);
    hand ||= Boolean(gp.buttons[2]?.pressed);
    const st = Boolean(gp.buttons[9]?.pressed);
    if (st && !pad.start && race.state !== "racing" && race.state !== "countdown") startRace();
    pad.start = st;
    const y = Boolean(gp.buttons[3]?.pressed);
    if (y && !pad.y && race.state === "racing") respawn();
    pad.y = y;
    const cam = Boolean(gp.buttons[5]?.pressed);
    if (cam && !pad.cam) cycleCamera();
    pad.cam = cam;
  }
  // Digital steering eases in, so tapping a key is a nudge, not a jerk.
  steerSmooth = analog ? steer : steerSmooth + (steer - steerSmooth) * Math.min(1, dt * (steer === 0 ? 10 : 6));
  input.gas = gas;
  input.brake = brake;
  input.steer = steerSmooth;
  input.hand = hand;
}

function autopilot() {
  const speed = Math.hypot(car.vx, car.vz);
  const j = T.wrap(car.i + 5 + Math.round(speed / 5));
  let d = Math.atan2(T.Z[j] - car.z, T.X[j] - car.x) - car.a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  input.steer = Math.max(-1, Math.min(1, d * 3 - car.lat * 0.06));
  const k = T.wrap(car.i + 14);
  let bend = Math.atan2(T.TZ[k], T.TX[k]) - Math.atan2(T.TZ[car.i], T.TX[car.i]);
  bend = Math.abs(Math.atan2(Math.sin(bend), Math.cos(bend)));
  const limit = CFG.maxSpeed * (car.zone.key === "ice" ? 0.55 : 1) * (1 - Math.min(0.6, bend * 0.9));
  input.gas = speed < limit ? 1 : 0;
  input.brake = speed > limit * 1.15 ? 1 : 0;
  input.hand = false;
}

// ── tuning (data, not code) ───────────────────────────────────────────────

const CFG = {
  dt: 1 / 120,
  laps: 3,
  accel: 11,
  brake: 26,
  reverse: 7,
  maxSpeed: 58,
  maxReverse: 10,
  rolling: 1.4,
  drag: 0.11,
  steer: 2.1,
  steerRef: 9,
  highSpeedSteer: 0.42,
  grip: 7,
  handGrip: 0.14,
  boostSpeed: 74,
  boostTime: 1.3,
  carR: 1.05,
  wheelR: 0.34,
  fence: 45,
  kmh: 3.6,
  lavaTop: 0.33,
  geyserKick: 21,
  gravity: 22,
  airtimeSkill: 0.35,
};

// ── physics ─────────────────────────────────────────────────────────────────

function makeCar() {
  return { x: 0, z: 0, y: 0, a: 0, vx: 0, vz: 0, vy: 0, spin: 0, i: 0, lat: 0, boost: 0, falling: 0, air: false, airT: 0, zone: T.ZONE_LIST[0], inLava: false, slip: 0, vf: 0, latAcc: 0, lonAcc: 0, pitch: 0, roll: 0, wheelSpin: 0 };
}
const car = makeCar();

function locate(c) {
  let best = c.i;
  let bestD = Infinity;
  for (let k = -24; k <= 24; k++) {
    const i = T.wrap(c.i + k);
    const d = (c.x - T.X[i]) ** 2 + (c.z - T.Z[i]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (bestD > 90 * 90) {
    for (let i = 0; i < T.N; i++) {
      const d = (c.x - T.X[i]) ** 2 + (c.z - T.Z[i]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  c.i = best;
  c.lat = (c.x - T.X[best]) * T.NX[best] + (c.z - T.Z[best]) * T.NZ[best];
}

/** Surface height at (x, z) given the nearest road sample. */
function groundAt(i, lat, x, z) {
  const edge = T.W[i] + Wd.SHOULDER;
  const l = Math.abs(lat);
  if (l <= edge) return Wd.roadAt(i, x, z) + 0.06;
  const terrain = Wd.terrainAt(x, z);
  // the road's lip eases into the verge, so you can always drive back on
  if (l < edge + 2.5) return terrain + (Wd.roadAt(i, x, z) + 0.06 - terrain) * (1 - (l - edge) / 2.5);
  return terrain;
}

function placeAt(c, i, lat = 0) {
  c.i = i;
  c.x = T.X[i] + T.NX[i] * lat;
  c.z = T.Z[i] + T.NZ[i] * lat;
  c.a = Math.atan2(T.TZ[i], T.TX[i]);
  c.vx = c.vz = c.vy = c.spin = c.boost = 0;
  c.falling = 0;
  c.air = false;
  locate(c);
  c.y = groundAt(c.i, c.lat, c.x, c.z);
}

let shake = 0;
const bump = (a) => (shake = Math.min(1.4, shake + a));

let crashedAt = -10;
function collideCircle(c, ox, oz, r, bounce = 0.35) {
  const dx = c.x - ox;
  const dz = c.z - oz;
  const min = r + CFG.carR;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2) || 1;
  const nx = dx / d;
  const nz = dz / d;
  c.x = ox + nx * min;
  c.z = oz + nz * min;
  const vn = c.vx * nx + c.vz * nz;
  if (vn < 0) {
    c.vx -= (1 + bounce) * vn * nx;
    c.vz -= (1 + bounce) * vn * nz;
    c.vx *= 0.7;
    c.vz *= 0.7;
    bump(Math.min(1, -vn / 20));
    if (-vn > 7) crash();
  }
  return true;
}

function wall(c, limit) {
  if (Math.abs(c.lat) <= limit) return false;
  const i = c.i;
  const side = Math.sign(c.lat);
  const push = c.lat - side * limit;
  c.x -= T.NX[i] * push;
  c.z -= T.NZ[i] * push;
  const vn = c.vx * T.NX[i] + c.vz * T.NZ[i];
  if (vn * side > 0) {
    c.vx -= 1.3 * vn * T.NX[i];
    c.vz -= 1.3 * vn * T.NZ[i];
    c.vx *= 0.96;
    c.vz *= 0.96;
    bump(Math.min(0.8, Math.abs(vn) / 20));
    if (Math.abs(vn) > 9) crash();
  }
  c.lat = side * limit;
  return true;
}

// hazards share the wall clock, so everyone in a room sees the same eruptions
function geyserPhase(now) {
  const g = T.GEYSER;
  const p = now % g.period;
  if (p >= g.blowAt && p < g.blowEnd) return { state: "blow", k: (p - g.blowAt) / (g.blowEnd - g.blowAt) };
  if (p >= g.warnAt && p < g.blowAt) return { state: "warn", k: (p - g.warnAt) / (g.blowAt - g.warnAt) };
  return { state: "idle", k: 0 };
}
function lavaState(L, now) {
  const p = (now + L.offset) % L.period;
  return p >= L.flowAt ? "flow" : p >= L.warnAt ? "warn" : "cool";
}
const sheepOut = { x: 0, z: 0, dir: 1 };
function sheepPos(s, now) {
  const t = now * s.speed + s.phase;
  const lat = Math.sin(t) * (T.W[s.i] + 5);
  sheepOut.x = T.X[s.i] + T.NX[s.i] * lat;
  sheepOut.z = T.Z[s.i] + T.NZ[s.i] * lat;
  sheepOut.dir = Math.cos(t) >= 0 ? 1 : -1;
  return sheepOut;
}

let lastGeyserCycle = -1;
let sheepCooldown = 0;
let fallIdx = 0;
const nearMissAt = new Map();

function startFall(c, msg) {
  if (c.falling > 0) return;
  c.falling = 1.3;
  fallIdx = c.i;
  toast(msg, "warn");
  crash(true);
}

function step(c, dt, now, ctl) {
  if (c.falling > 0) {
    c.falling -= dt;
    c.vy -= CFG.gravity * dt;
    c.x += c.vx * dt * 0.5;
    c.z += c.vz * dt * 0.5;
    c.y += c.vy * dt;
    if (c.falling <= 0) placeAt(c, T.wrap(fallIdx - 8));
    return;
  }
  locate(c);
  const zone = T.ZONE_LIST[T.ZONE[c.i]];
  const halfW = T.W[c.i];
  c.zone = zone;
  const onRoad = Math.abs(c.lat) <= halfW + 0.5;
  const surf = onRoad ? zone : zone.key === "ice" ? T.SNOW : T.OFFROAD;

  let top = CFG.maxSpeed * surf.top;
  c.inLava = false;
  for (const L of T.LAVA) {
    const da = (c.x - T.X[L.i]) * T.TX[L.i] + (c.z - T.Z[L.i]) * T.TZ[L.i];
    if (Math.abs(da) < L.half + 1 && Math.abs(c.lat) < halfW + 6 && lavaState(L, now) === "flow" && !c.air) c.inLava = true;
  }
  if (c.inLava) top *= CFG.lavaTop;
  if (c.boost > 0) {
    top = Math.max(top, CFG.boostSpeed);
    c.boost -= dt;
  }

  const fx = Math.cos(c.a);
  const fz = Math.sin(c.a);
  const rx = -fz;
  const rz = fx;
  let vf = c.vx * fx + c.vz * fz;
  let vr = c.vx * rx + c.vz * rz;
  const vf0 = vf;
  const vr0 = vr;

  if (!c.air) {
    if (ctl.gas > 0 && vf < top) vf += CFG.accel * ctl.gas * dt * (vf < 0 ? 2.5 : 1) * (c.boost > 0 ? 1.8 : 1) * (1 - 0.45 * Math.max(0, vf / CFG.maxSpeed));
    if (ctl.brake > 0) {
      if (vf > 0.6) vf -= CFG.brake * ctl.brake * dt;
      else if (vf > -CFG.maxReverse) vf -= CFG.reverse * ctl.brake * dt;
    }
    if (!ctl.gas && !ctl.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), CFG.rolling * dt);
    vf -= vf * CFG.drag * dt;
    if (vf > top) vf += (top - vf) * Math.min(1, 2.4 * dt);
    if (ctl.hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
    // gravity along the slope: hills slow you down, descents push you on
    const ahead = groundAt(c.i, c.lat, c.x + fx * 1.8, c.z + fz * 1.8);
    const behind = groundAt(c.i, c.lat, c.x - fx * 1.8, c.z - fz * 1.8);
    const slope = (ahead - behind) / 3.6;
    vf -= CFG.gravity * 0.55 * (slope / Math.sqrt(1 + slope * slope)) * dt;
    vr *= Math.exp(-CFG.grip * surf.grip * (ctl.hand ? CFG.handGrip : 1) * dt);
    const sp = Math.abs(vf);
    const turn = ctl.steer * CFG.steer * Math.min(1, sp / CFG.steerRef) * (1 - (1 - CFG.highSpeedSteer) * Math.min(1, sp / CFG.maxSpeed)) * (ctl.hand ? 1.4 : 1);
    c.a += turn * (vf < -0.3 ? -1 : 1) * dt;
  } else {
    vf -= vf * 0.02 * dt;
  }
  c.vx = fx * vf + rx * vr;
  c.vz = fz * vf + rz * vr;
  c.a += c.spin * dt;
  c.spin *= Math.exp(-2.4 * dt);
  c.lonAcc = (vf - vf0) / dt;
  c.latAcc += ((vr - vr0) / dt + vf * (ctl.steer * 0.3) - c.latAcc) * Math.min(1, dt * 8);
  c.vf = vf;
  c.slip = Math.atan2(Math.abs(vr), Math.max(1, Math.abs(vf)));

  const px = c.x;
  const pz = c.z;
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  locate(c);

  // ── contacts in the plane ──
  const w = T.W[c.i];
  const here = T.ZONE_LIST[T.ZONE[c.i]];
  if (here.walls && c.y < Wd.ROADH[c.i] + 6) wall(c, w + 0.2);
  else wall(c, w + CFG.fence);
  for (const o of T.OBSTACLES) {
    const di = Math.abs(o.i - c.i);
    if (di > 12 && di < T.N - 12) continue;
    if (c.y > Wd.ROADH[o.i] + 2.5) continue;
    if (!collideCircle(c, o.x, o.z, o.r)) nearMiss(`o${o.i}`, o.x, o.z, o.r);
  }
  if (sheepCooldown > 0) sheepCooldown -= dt;
  for (const s of T.SHEEP) {
    const di = Math.abs(s.i - c.i);
    if (di > 8 && di < T.N - 8) continue;
    const p = sheepPos(s, now);
    if (collideCircle(c, p.x, p.z, 0.8, 0.2)) {
      if (sheepCooldown <= 0) {
        toast(STR.sheep);
        sheepCooldown = 1.5;
      }
    } else nearMiss(`s${s.i}`, p.x, p.z, 0.8);
  }

  // ── vertical: follow the ground, or fly ──
  let g = groundAt(c.i, c.lat, c.x, c.z);
  const prevY = c.y;
  const stepLen = Math.hypot(c.x - px, c.z - pz);
  // Ground that rises faster than a car can climb (cliffs, gorge walls,
  // rocks) is a wall, whether we arrive on the ground or in the air.
  if (g - prevY > Math.max(0.45, stepLen * 1.3)) {
    const sp = Math.hypot(c.vx, c.vz);
    c.x = px;
    c.z = pz;
    locate(c);
    c.vx *= -0.3;
    c.vz *= -0.3;
    bump(Math.min(1, sp / 25));
    if (sp > 12) crash();
    g = groundAt(c.i, c.lat, c.x, c.z);
  }
  if (c.air) {
    c.vy -= CFG.gravity * dt;
    c.y += c.vy * dt;
    c.airT += dt;
    if (c.y <= g) {
      c.y = g;
      c.air = false;
      if (c.airT > CFG.airtimeSkill) {
        addSkill("air", Math.round(c.airT * 420));
        bump(Math.min(1, c.airT * 0.8));
        sfx.land(c.airT);
      }
      c.vy = 0;
      c.airT = 0;
    }
  } else {
    const followVy = (g - prevY) / dt;
    const freeVy = c.vy - CFG.gravity * dt;
    if (followVy < freeVy - 0.5) {
      // the ground falls away faster than gravity: airborne
      c.air = true;
      c.airT = 0;
      c.vy = freeVy;
      c.y = prevY + c.vy * dt;
    } else {
      c.y = g;
      c.vy = Math.max(-40, Math.min(12, followVy));
    }
  }

  // off the edge into the gorge, or into the sea
  if (c.y < Wd.ROADH[c.i] - 4.5 && Math.abs(c.lat) > w + 2) startFall(c, STR.fell);
  if (g < -0.1 && c.y < 0.3) startFall(c, STR.splash);

  // ── the geyser ──
  const G = T.GEYSER;
  const gp = geyserPhase(now);
  const cycle = Math.floor(now / G.period);
  if (gp.state === "blow" && cycle !== lastGeyserCycle) {
    const dx = c.x - G.x;
    const dz = c.z - G.z;
    const d = Math.hypot(dx, dz);
    if (d < G.radius && c.y < Wd.ROADH[G.i] + 3) {
      lastGeyserCycle = cycle;
      const k = CFG.geyserKick * (1 - d / G.radius / 2);
      c.vx += (dx / (d || 1)) * k;
      c.vz += (dz / (d || 1)) * k;
      c.vy = 9;
      c.air = true;
      c.airT = 0;
      c.spin = (Math.random() < 0.5 ? -1 : 1) * 4.5;
      toast(STR.geyser, "warn");
      bump(1);
    }
  }

  // ── boost pads ──
  for (const b of T.BOOSTS) {
    const da = (c.x - T.X[b.i]) * T.TX[b.i] + (c.z - T.Z[b.i]) * T.TZ[b.i];
    const dl = (c.x - T.X[b.i]) * T.NX[b.i] + (c.z - T.Z[b.i]) * T.NZ[b.i];
    if (Math.abs(da) < b.len && Math.abs(dl) < T.W[b.i] * 0.7 && !c.air) {
      if (c.boost < CFG.boostTime - 0.3) {
        addSkill("boost", 100);
        sfx.boost();
      }
      c.boost = CFG.boostTime;
    }
  }

  // ── speed trap ──
  {
    const i = T.SPEEDTRAP.i;
    const before = (px - T.X[i]) * T.TX[i] + (pz - T.Z[i]) * T.TZ[i];
    const after = (c.x - T.X[i]) * T.TX[i] + (c.z - T.Z[i]) * T.TZ[i];
    if (before < 0 && after >= 0 && Math.abs(c.lat) < w + 4) {
      const kmh = Math.round(Math.hypot(c.vx, c.vz) * CFG.kmh);
      toast(STR.speedTrap(kmh), "good");
      addSkill("trap", kmh * 2);
      if (kmh > (Number(store("rrr3:trap")) || 0)) store("rrr3:trap", String(kmh));
    }
  }
}

function nearMiss(key, x, z, r) {
  const speed = Math.hypot(car.vx, car.vz);
  if (speed < 18 || car.air) return;
  const d = Math.hypot(car.x - x, car.z - z) - r - CFG.carR;
  if (d > 1.6) return;
  const t = performance.now();
  if (t - (nearMissAt.get(key) || 0) < 3000 || t - crashedAt < 1500) return;
  nearMissAt.set(key, t);
  addSkill("near", 250);
}

// ── skills (a Forza-style chain) ──────────────────────────────────────────

const skill = { pts: 0, mult: 1, list: [], idle: 0, total: 0, drift: 0, driftCalm: 0, fast: 0, state: "idle", flash: 0 };
function addSkill(kind, pts) {
  if (race.state !== "racing") return;
  skill.pts += pts;
  skill.mult = Math.min(9, skill.mult + (skill.list.length ? 1 : 0));
  skill.list.unshift(STR.skills[kind]);
  skill.list.length = Math.min(skill.list.length, 4);
  skill.idle = 0;
  skill.state = "active";
}
function crash(silent = false) {
  crashedAt = performance.now();
  if (skill.state === "active" && skill.pts > 0) {
    skill.state = "lost";
    skill.flash = 1.4;
    if (!silent) toast(STR.crash, "warn");
    skill.pts = 0;
    skill.mult = 1;
    skill.list = [];
    skill.drift = 0;
  }
}
function skillTick(dt) {
  const speed = Math.hypot(car.vx, car.vz);
  const drifting = !car.air && car.slip > 0.2 && speed > 11 && Math.abs(car.lat) <= T.W[car.i] + 1;
  if (drifting) {
    skill.drift += speed * car.slip * dt * 14;
    skill.driftCalm = 0;
    skill.idle = 0;
    if (skill.state !== "active") skill.state = "active";
  } else if (skill.drift > 0) {
    skill.driftCalm += dt;
    if (skill.driftCalm > 0.35) {
      if (skill.drift > 40) addSkill("drift", Math.round(skill.drift));
      skill.drift = 0;
    }
  }
  skill.fast = speed > 47 ? skill.fast + dt : 0;
  if (skill.fast > 2.5) {
    addSkill("speed", 150);
    skill.fast = 0;
  }
  if (skill.state === "active" && skill.drift === 0) {
    skill.idle += dt;
    if (skill.idle > 2.6) {
      skill.total += Math.round(skill.pts * skill.mult);
      skill.state = "banked";
      skill.flash = 1.2;
    }
  }
  if (skill.state === "banked" || skill.state === "lost") {
    skill.flash -= dt;
    if (skill.flash <= 0) {
      skill.state = "idle";
      skill.pts = 0;
      skill.mult = 1;
      skill.list = [];
    }
  }
}

// ── race ────────────────────────────────────────────────────────────────────

const race = { state: "boot", t: 0, count: 0, lap: 1, lapStart: 0, cpNext: 1, laps: [], wrongT: 0, sendT: 0, rec: [], recT: 0, lastZone: null, top: 0 };
let ghost = null;
try {
  ghost = JSON.parse(store("rrr3:ghost") || "null");
} catch {
  ghost = null;
}
let bestLocalLap = Number(store("rrr3:bestLap")) || null;
let bestLocalRace = Number(store("rrr3:bestRace")) || null;
const settings = {
  color: Math.min(COLORS.length - 1, Math.max(0, Number(store("rrr3:color")) || 0)),
  shake: store("rrr3:shake") !== "0",
  sound: store("rrr3:sound") !== "0",
};

function playerName() {
  return $("#name").value.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || STR.defaultName;
}
function sendHello() {
  act({ t: "hello", name: playerName(), color: settings.color });
}

function startRace() {
  if (race.state === "boot") return;
  store("rrr3:name", playerName());
  sendHello();
  audio.start();
  placeAt(car, T.wrap(-5));
  Object.assign(race, { state: "countdown", count: 3.4, t: 0, lap: 1, lapStart: 0, cpNext: 1, laps: [], rec: [], recT: 0, wrongT: 0, lastZone: null, top: 0 });
  Object.assign(skill, { pts: 0, mult: 1, list: [], idle: 0, total: 0, drift: 0, fast: 0, state: "idle" });
  paintCar(player, settings.color);
  $("#menu").classList.add("hidden");
  $("#result").classList.add("hidden");
  $("#hud").classList.remove("hidden");
  touchEl.classList.toggle("hidden", !usedTouch);
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function showMenu() {
  race.state = "menu";
  act({ t: "leave" });
  placeAt(car, T.wrap(-5));
  $("#menu").classList.remove("hidden");
  $("#result").classList.add("hidden");
  $("#hud").classList.add("hidden");
  touchEl.classList.add("hidden");
  renderBoards(true);
}

function respawn() {
  placeAt(car, car.i, 0);
  crash(true);
}

function lapDone() {
  const ms = Math.round((race.t - race.lapStart) * 1000);
  race.laps.push(ms);
  if (!AUTOPILOT) act({ t: "lap", ms });
  if (!bestLocalLap || ms < bestLocalLap) {
    bestLocalLap = ms;
    store("rrr3:bestLap", String(ms));
  }
  if (!AUTOPILOT && (!ghost || ms < ghost.ms)) {
    ghost = { ms, f: race.rec };
    store("rrr3:ghost", JSON.stringify(ghost));
  }
  race.rec = [];
  race.recT = 0;
  race.lapStart = race.t;
  if (race.lap >= CFG.laps) finish();
  else {
    race.lap++;
    toast(race.lap === CFG.laps ? STR.lastLap : `${STR.lap.toUpperCase()} ${race.lap}/${CFG.laps}`, "good");
  }
}

function finish() {
  race.state = "finished";
  if (skill.state === "active") skill.total += Math.round(skill.pts * skill.mult);
  const total = race.laps.reduce((a, b) => a + b, 0);
  if (!AUTOPILOT) act({ t: "finish", ms: total });
  const pb = !bestLocalRace || total < bestLocalRace;
  if (pb && !AUTOPILOT) {
    bestLocalRace = total;
    store("rrr3:bestRace", String(total));
  }
  $("#res-time").textContent = fmt(total);
  $("#res-pb").classList.toggle("hidden", !pb);
  $("#res-best").textContent = fmt(Math.min(...race.laps));
  $("#res-skill").textContent = skill.total.toLocaleString("is-IS");
  $("#res-top").textContent = `${Math.round(race.top * CFG.kmh)}`;
  $("#res-laps").textContent = STR.lapsLine(race.laps.map(fmt));
  setTimeout(() => {
    if (race.state !== "finished") return;
    $("#result").classList.remove("hidden");
    $("#hud").classList.add("hidden");
    touchEl.classList.add("hidden");
    renderBoards(true);
  }, 1800);
}

const IDLE = { gas: 0, brake: 0, steer: 0, hand: false };
function tick(dt, now) {
  if (race.state === "countdown") {
    race.count -= dt;
    if (race.count <= 0.2) {
      race.state = "racing";
      toast(STR.go, "good");
    }
    return;
  }
  if (race.state === "menu" || race.state === "boot") return;
  const racing = race.state === "racing";
  if (AUTOPILOT && racing) autopilot();
  step(car, dt, now, racing ? input : { ...IDLE, brake: 0.4 });
  if (!racing) return;
  skillTick(dt);
  race.t += dt;
  race.top = Math.max(race.top, Math.hypot(car.vx, car.vz));
  const cp = T.CHECKPOINTS[race.cpNext % T.CHECKPOINTS.length];
  const ahead = T.wrap(car.i - cp);
  if (ahead < 30 && car.falling <= 0) {
    if (race.cpNext === T.CHECKPOINTS.length) {
      race.cpNext = 1;
      lapDone();
    } else race.cpNext++;
  }
  const along = car.vx * T.TX[car.i] + car.vz * T.TZ[car.i];
  race.wrongT = along < -4 ? race.wrongT + dt : 0;
  race.recT += dt;
  if (race.recT >= 0.1) {
    race.recT -= 0.1;
    race.rec.push([Math.round(car.x * 10) / 10, Math.round(car.y * 10) / 10, Math.round(car.z * 10) / 10, Math.round(car.a * 100) / 100]);
  }
  race.sendT += dt;
  if (race.sendT >= 0.2) {
    race.sendT = 0;
    act({ t: "pos", x: Math.round(car.x * 10) / 10, y: Math.round(car.z * 10) / 10, a: Math.round(Math.atan2(Math.sin(car.a), Math.cos(car.a)) * 1000) / 1000, lap: race.lap });
  }
  if (car.zone !== race.lastZone) {
    race.lastZone = car.zone;
    showBanner(car.zone.key);
  }
}

// ── render ──────────────────────────────────────────────────────────────────

const $ = (s) => document.querySelector(s);
const canvas = $("#game");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: "high-performance" });
} catch {
  $("#nogl").classList.remove("hidden");
  $("#loading").classList.add("hidden");
  throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LITE ? 1 : 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 3200);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const loadingText = $("#loading-text");
const loadingBar = $("#loading-bar");
loadingText.textContent = STR.loadingKit;
loadingBar.style.width = "40%";
const world = await createWorld(renderer, { lite: LITE });
loadingText.textContent = STR.loadingWorld;
loadingBar.style.width = "85%";
const { scene } = world;

function makeCarVisual(color, ghostly = false) {
  const root = world.clone("Car");
  root.rotation.order = "YZX";
  const chassis = new THREE.Group();
  const wheels = {};
  const parts = [];
  root.children.slice().forEach((o) => {
    if (o.name.startsWith("Car_Wheel")) {
      o.rotation.order = "YZX";
      wheels[o.name.slice(10)] = o;
    } else parts.push(o);
  });
  for (const p of parts) chassis.add(p);
  root.add(chassis);
  const v = { root, chassis, wheels, paint: [], tail: [] };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const cloned = mats.map((m) => {
      // Car paint gets a clear coat: the glossy showroom look.
      const c = m.name === "CarPaint"
        ? new THREE.MeshPhysicalMaterial({ name: "CarPaint", color: m.color, metalness: 0.1, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.7 })
        : m.clone();
      if (ghostly) {
        c.transparent = true;
        c.opacity = 0.32;
        c.depthWrite = false;
      }
      if (m.name === "CarPaint") v.paint.push(c);
      if (m.name === "TailLight") v.tail.push(c);
      return c;
    });
    o.material = Array.isArray(o.material) ? cloned : cloned[0];
    o.castShadow = !ghostly;
  });
  paintCar(v, color);
  scene.add(root);
  return v;
}
function paintCar(v, color) {
  for (const m of v.paint) m.color.setHex(COLORS[color]?.hex ?? COLORS[0].hex);
}

const player = makeCarVisual(settings.color);
const ghostCar = makeCarVisual(settings.color, true);
ghostCar.root.visible = false;

function poseCar(v, c, dt, braking) {
  v.root.position.set(c.x, c.y, c.z);
  // tilt with the ground (sampled under the wheels), lean with the load
  const fx = Math.cos(c.a);
  const fz = Math.sin(c.a);
  if (!c.air && c.falling <= 0) {
    const hf = groundAt(c.i, c.lat, c.x + fx * 1.4, c.z + fz * 1.4);
    const hb = groundAt(c.i, c.lat, c.x - fx * 1.4, c.z - fz * 1.4);
    const hl = groundAt(c.i, c.lat - 0.85, c.x + fz * 0.85, c.z - fx * 0.85);
    const hr = groundAt(c.i, c.lat + 0.85, c.x - fz * 0.85, c.z + fx * 0.85);
    const tp = Math.atan2(hf - hb, 2.8);
    const tr = Math.atan2(hl - hr, 1.7);
    c.pitch += (tp - c.pitch) * Math.min(1, dt * 12);
    c.roll += (tr - c.roll) * Math.min(1, dt * 12);
  } else {
    c.pitch += (Math.max(-0.35, Math.min(0.35, c.vy * 0.03)) - c.pitch) * Math.min(1, dt * 2);
    c.roll *= 1 - Math.min(1, dt * 2);
  }
  v.root.rotation.set(c.roll, -c.a, c.pitch);
  v.chassis.rotation.x = THREE.MathUtils.clamp(-c.latAcc * 0.004, -0.07, 0.07);
  v.chassis.rotation.z = THREE.MathUtils.clamp(-c.lonAcc * 0.003, -0.05, 0.05);
  const speed = c.vf ?? 0;
  c.wheelSpin -= (speed / CFG.wheelR) * dt;
  for (const [k, w] of Object.entries(v.wheels)) {
    w.rotation.z = c.wheelSpin;
    w.rotation.y = k.startsWith("F") ? -input.steer * 0.42 * (race.state === "racing" ? 1 : 0) : 0;
  }
  for (const m of v.tail) m.emissiveIntensity = braking ? 4 : 0.6;
}

// remote players
const remote = new Map();
function labelSprite(text) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(12,16,22,0.7)";
  g.beginPath();
  g.roundRect(8, 10, 240, 44, 12);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "700 28px 'Barlow Condensed', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(4, 1, 1);
  s.position.set(0, 2.6, 0);
  s.renderOrder = 10;
  return s;
}
function onRoomState(msg) {
  lastRoomMsg = msg;
  const seen = new Set();
  for (const rc of msg.view?.cars ?? []) {
    seen.add(rc.id);
    let r = remote.get(rc.id);
    if (!r) {
      const v = makeCarVisual(rc.color ?? 0);
      const label = labelSprite(rc.name);
      v.root.add(label);
      r = { v, c: makeCar(), tx: rc.x, tz: rc.y, ta: rc.a, name: rc.name, label };
      r.c.x = rc.x;
      r.c.z = rc.y;
      r.c.a = rc.a;
      remote.set(rc.id, r);
    }
    r.tx = rc.x;
    r.tz = rc.y;
    r.ta = rc.a;
    if (r.v.paintColor !== rc.color) {
      paintCar(r.v, rc.color ?? 0);
      r.v.paintColor = rc.color;
    }
  }
  for (const [id, r] of remote) {
    if (!seen.has(id)) {
      scene.remove(r.v.root);
      remote.delete(id);
    }
  }
  renderBoards(false);
}

// ── camera ──────────────────────────────────────────────────────────────────

const CAMS = [
  { dist: 7.4, height: 2.5, look: 1.3, fov: 62 },
  { dist: 11.5, height: 3.8, look: 1.6, fov: 58 },
  { hood: true, fov: 74 },
];
let camMode = Number(store("rrr3:cam")) || 0;
function cycleCamera() {
  camMode = (camMode + 1) % CAMS.length;
  store("rrr3:cam", String(camMode));
}
const camPos = new THREE.Vector3(T.X[0], 30, T.Z[0]);
const camLook = new THREE.Vector3();
const tmp = new THREE.Vector3();
let camDir = 0;

function updateCamera(dt, t) {
  const speed = Math.hypot(car.vx, car.vz);
  const cfg = CAMS[camMode];
  if (race.state === "menu" || race.state === "boot" || race.state === "finished") {
    const ang = t * 0.12 + 0.8;
    const r = 10.5;
    tmp.set(car.x + Math.cos(ang) * r, car.y + 2.6 + Math.sin(t * 0.2) * 0.6, car.z + Math.sin(ang) * r);
    camPos.lerp(tmp, 1 - Math.exp(-dt * 3));
    camLook.set(car.x, car.y + 1.0, car.z);
    camera.fov += (50 - camera.fov) * Math.min(1, dt * 2);
  } else if (cfg.hood) {
    const fx = Math.cos(car.a);
    const fz = Math.sin(car.a);
    camPos.set(car.x + fx * 0.2, car.y + 1.35, car.z + fz * 0.2);
    camLook.set(car.x + fx * 20, car.y + 1.0 + car.pitch * 20, car.z + fz * 20);
    camera.fov += (cfg.fov + 10 * Math.min(1, speed / CFG.maxSpeed) - camera.fov) * Math.min(1, dt * 3);
  } else {
    // follow a blend of where the car points and where it's going (drift cam)
    let target = car.a;
    if (speed > 6) {
      const vel = Math.atan2(car.vz, car.vx);
      let d = vel - car.a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 1.6) target = car.a + d * 0.45;
    }
    let dd = target - camDir;
    dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    camDir += dd * Math.min(1, dt * 5);
    const fx = Math.cos(camDir);
    const fz = Math.sin(camDir);
    const dist = cfg.dist + Math.min(1, speed / CFG.maxSpeed) * 1.4;
    tmp.set(car.x - fx * dist, car.y + cfg.height, car.z - fz * dist);
    camPos.lerp(tmp, 1 - Math.exp(-dt * 9));
    const floor = Wd.terrainAt(camPos.x, camPos.z) + 1.2;
    if (camPos.y < floor) camPos.y = floor;
    camLook.set(car.x + Math.cos(car.a) * 4, car.y + cfg.look, car.z + Math.sin(car.a) * 4);
    const boost = car.boost > 0 ? 8 : 0;
    camera.fov += (cfg.fov + 14 * Math.min(1, speed / CFG.maxSpeed) + boost - camera.fov) * Math.min(1, dt * 3);
  }
  shake *= Math.exp(-5 * dt);
  const sp = speed > 44 ? (speed - 44) * 0.0015 : 0;
  const sh = settings.shake ? shake * 0.35 + sp : 0;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh);
  camera.lookAt(camLook);
  camera.updateProjectionMatrix();

  // keep the sun's shadow box on the car, snapped to texels to avoid shimmer
  const s = world.sun;
  const snap = 140 / s.shadow.mapSize.x;
  const cx = Math.round(car.x / snap) * snap;
  const cz = Math.round(car.z / snap) * snap;
  s.target.position.set(cx, car.y, cz);
  s.position.set(cx + world.sunDir.x * 320, car.y + world.sunDir.y * 320, cz + world.sunDir.z * 320);
}

// ── HUD ─────────────────────────────────────────────────────────────────────

for (const el of document.querySelectorAll("[data-s]")) {
  const v = STR[el.dataset.s];
  if (typeof v === "string") {
    if (el.dataset.s === "controls") el.innerHTML = v; // static, trusted markup
    else el.textContent = v;
  }
}
$("#places").replaceChildren(...Object.values(STR.zones).map(([name]) => Object.assign(document.createElement("span"), { textContent: name })));
$("#swatches").replaceChildren(
  ...COLORS.map((c, k) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.style.background = `#${c.hex.toString(16).padStart(6, "0")}`;
    b.setAttribute("aria-label", c.name);
    b.setAttribute("aria-pressed", String(k === settings.color));
    b.addEventListener("click", () => {
      settings.color = k;
      store("rrr3:color", String(k));
      paintCar(player, k);
      for (const o of $("#swatches").children) o.setAttribute("aria-pressed", String(o === b));
      sendHello();
    });
    return b;
  }),
);

function fmt(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

let bannerTimer = 0;
function showBanner(key) {
  const z = STR.zones[key];
  if (!z) return;
  $("#banner-title").textContent = z[0];
  $("#banner-tip").textContent = z[1];
  $("#banner").classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => $("#banner").classList.remove("show"), 3400);
}
let toastTimer = 0;
function toast(text, kind = "") {
  const el = $("#toast");
  el.textContent = text;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = kind), 1400);
}

let lastBoardKey = "";
function fillBoard(ol, board) {
  ol.replaceChildren();
  if (!board.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = online ? STR.noTimes : STR.offline;
    ol.append(p);
    return;
  }
  for (const e of board) {
    const li = document.createElement("li");
    if (e.me) li.className = "me";
    const n = document.createElement("span");
    n.textContent = e.name; // untrusted: textContent only
    const t = document.createElement("b");
    t.textContent = fmt(e.ms);
    li.append(n, t);
    ol.append(li);
  }
}
function renderBoards(force) {
  const v = lastRoomMsg?.view;
  const board = v?.board ?? [];
  const key = JSON.stringify([board, v?.lapRecord, online, lastRoomMsg?.connected]);
  if (!force && key === lastBoardKey) return;
  lastBoardKey = key;
  fillBoard($("#board-menu"), board);
  fillBoard($("#board-result"), board);
  $("#record-menu").textContent = v?.lapRecord ? STR.record(v.lapRecord.name, fmt(v.lapRecord.ms)) : "";
  $("#room-meta").textContent = STR.roomMeta(room, lastRoomMsg?.connected ?? 0);
}

// speedometer arc
const ARC = { cx: 100, cy: 100, r: 80, a0: (135 * Math.PI) / 180, sweep: (270 * Math.PI) / 180 };
function arcPath(frac) {
  const a1 = ARC.a0 + ARC.sweep * Math.max(0.001, Math.min(1, frac));
  const x0 = ARC.cx + Math.cos(ARC.a0) * ARC.r;
  const y0 = ARC.cy + Math.sin(ARC.a0) * ARC.r;
  const x1 = ARC.cx + Math.cos(a1) * ARC.r;
  const y1 = ARC.cy + Math.sin(a1) * ARC.r;
  const large = a1 - ARC.a0 > Math.PI ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${ARC.r} ${ARC.r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
$("#rpm-track").setAttribute("d", arcPath(1));
const GEARS = [0, 13, 22, 31, 40, 49, 62];
function gearAndRpm() {
  const v = Math.abs(car.vf);
  if (race.state === "countdown" || v < 0.5) return { gear: car.vf < -0.5 ? "R" : "N", rpm: 0.18 + input.gas * 0.62 + Math.random() * 0.02 * input.gas };
  if (car.vf < -0.5) return { gear: "R", rpm: 0.3 + (v / CFG.maxReverse) * 0.5 };
  let g = 1;
  while (g < GEARS.length - 1 && v > GEARS[g]) g++;
  const lo = GEARS[g - 1];
  const hi = GEARS[g];
  return { gear: String(g), rpm: 0.3 + 0.7 * Math.min(1, (v - lo) / (hi - lo)) };
}

// minimap: a pre-rendered island, rotated so "up" is where you're driving
const mm = $("#minimap");
const mctx = mm.getContext("2d");
const MMS = 1.5; // px per metre
const mmBase = (() => {
  const c = document.createElement("canvas");
  c.width = Math.ceil(Wd.NXC * Wd.CELL * MMS);
  c.height = Math.ceil(Wd.NZC * Wd.CELL * MMS);
  const g = c.getContext("2d");
  g.setTransform(MMS, 0, 0, MMS, -Wd.X0 * MMS, -Wd.Z0 * MMS);
  g.fillStyle = "rgba(90,120,80,0.55)";
  g.beginPath();
  T.COAST.forEach(([x, z], k) => (k ? g.lineTo(x, z) : g.moveTo(x, z)));
  g.closePath();
  g.fill();
  g.lineJoin = g.lineCap = "round";
  g.lineWidth = 16;
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.beginPath();
  g.moveTo(T.X[0], T.Z[0]);
  for (let i = 1; i <= T.N; i++) g.lineTo(T.X[i % T.N], T.Z[i % T.N]);
  g.stroke();
  g.lineWidth = 9;
  for (let i = 0; i < T.N; i++) {
    const k = T.ZONE_LIST[T.ZONE[i]].key;
    g.strokeStyle = k === "lava" ? "#ff8a1e" : k === "ice" ? "#bfe6f5" : "#f3f6f8";
    g.beginPath();
    g.moveTo(T.X[i], T.Z[i]);
    g.lineTo(T.X[(i + 1) % T.N], T.Z[(i + 1) % T.N]);
    g.stroke();
  }
  return c;
})();
function drawMinimap() {
  const w = mm.width;
  mctx.clearRect(0, 0, w, w);
  mctx.save();
  mctx.beginPath();
  mctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
  mctx.clip();
  mctx.translate(w / 2, w / 2);
  mctx.rotate(-Math.PI / 2 - car.a);
  mctx.drawImage(mmBase, -(car.x - Wd.X0) * MMS, -(car.z - Wd.Z0) * MMS);
  const dot = (x, z, color, r) => {
    mctx.fillStyle = color;
    mctx.beginPath();
    mctx.arc((x - car.x) * MMS, (z - car.z) * MMS, r, 0, Math.PI * 2);
    mctx.fill();
  };
  if (race.state === "racing") {
    const cp = T.CHECKPOINTS[race.cpNext % T.CHECKPOINTS.length];
    dot(T.X[cp], T.Z[cp], "#ff2d87", 9);
  }
  for (const r of remote.values()) dot(r.c.x, r.c.z, "#ff8a1e", 7);
  mctx.restore();
  // you: an arrow pointing up
  mctx.fillStyle = "#fff";
  mctx.beginPath();
  mctx.moveTo(w / 2, w / 2 - 14);
  mctx.lineTo(w / 2 + 10, w / 2 + 10);
  mctx.lineTo(w / 2, w / 2 + 4);
  mctx.lineTo(w / 2 - 10, w / 2 + 10);
  mctx.closePath();
  mctx.fill();
}

let hudT = 0;
let fpsN = 0;
let fpsT = 0;
function hud(dt) {
  fpsN++;
  fpsT += dt;
  if (race.state === "countdown") {
    $("#count").classList.remove("hidden");
    $("#count").textContent = String(Math.max(1, Math.ceil(race.count - 0.2)));
  } else $("#count").classList.add("hidden");
  const { gear, rpm } = gearAndRpm();
  $("#rpm-arc").setAttribute("d", arcPath(rpm));
  audio.update(rpm, input.gas, car);
  hudT += dt;
  if (hudT < 0.066) return;
  hudT = 0;
  if (race.state === "menu" || race.state === "boot") return;
  const cur = race.state === "racing" ? race.t : race.laps.reduce((a, b) => a + b, 0) / 1000;
  $("#hud-lap").textContent = String(Math.min(race.lap, CFG.laps));
  $("#hud-total").textContent = fmt(cur * 1000);
  $("#hud-best").textContent = fmt(bestLocalLap);
  $("#hud-speed").textContent = String(Math.round(Math.hypot(car.vx, car.vz) * CFG.kmh));
  $("#hud-gear").textContent = gear;
  $("#hud-score").textContent = skill.total.toLocaleString("is-IS");
  $("#hud-online").textContent = online ? STR.online(remote.size + 1) : "";
  if (race.wrongT > 1) toast(STR.wrongWay, "warn");
  const sk = $("#skills");
  const live = skill.state !== "idle" || skill.drift > 0;
  sk.style.opacity = live ? "1" : "0";
  sk.className = skill.state === "lost" ? "lost" : skill.state === "banked" ? "banked" : "";
  $("#sk-mult").textContent = `x${skill.mult}`;
  const running = skill.pts + (skill.drift > 0 ? skill.drift : 0);
  $("#sk-pts").textContent = skill.state === "banked" ? `+${Math.round(skill.pts * skill.mult).toLocaleString("is-IS")}` : Math.round(running).toLocaleString("is-IS");
  $("#sk-list").textContent = (skill.drift > 0 ? [STR.skills.drift, ...skill.list] : skill.list).slice(0, 4).join(" · ");
  drawMinimap();
  if (DEBUG) {
    $("#debug").classList.remove("hidden");
    $("#debug").textContent = `fps ${Math.round(fpsN / fpsT)} · i ${car.i} · lat ${car.lat.toFixed(1)} · y ${car.y.toFixed(1)} · ${car.zone.key}${car.air ? " · AIR" : ""} · cp ${race.cpNext} · lap ${race.lap} · calls ${renderer.info.render.calls} · tris ${Math.round(renderer.info.render.triangles / 1000)}k`;
    fpsN = 0;
    fpsT = 0;
  }
}

// ── audio: a small synth engine, tyre squeal and a few effects ────────────

const audio = (() => {
  let ctx = null;
  let eng;
  let eng2;
  let filt;
  let gain;
  let skidGain;
  let master;
  const init = () => {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    master = ctx.createGain();
    master.gain.value = settings.sound ? 0.55 : 0;
    master.connect(ctx.destination);
    eng = ctx.createOscillator();
    eng.type = "sawtooth";
    eng2 = ctx.createOscillator();
    eng2.type = "square";
    filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.Q.value = 4;
    gain = ctx.createGain();
    gain.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    eng.connect(filt);
    eng2.connect(g2).connect(filt);
    filt.connect(gain).connect(master);
    eng.start();
    eng2.start();
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 3;
    skidGain = ctx.createGain();
    skidGain.gain.value = 0;
    noise.connect(bp).connect(skidGain).connect(master);
    noise.start();
    audio.noiseBuf = buf;
  };
  const burst = (freq, dur, vol, type = "highpass") => {
    if (!ctx || !settings.sound) return;
    const src = ctx.createBufferSource();
    src.buffer = audio.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f).connect(g).connect(master);
    src.start();
    src.stop(ctx.currentTime + dur);
  };
  return {
    noiseBuf: null,
    start() {
      init();
      ctx?.resume?.();
    },
    setVolume(on) {
      if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
    },
    update(rpm, throttle, c) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const racing = race.state === "racing" || race.state === "countdown";
      const f = 38 + rpm * 150;
      eng.frequency.setTargetAtTime(f, t, 0.03);
      eng2.frequency.setTargetAtTime(f / 2, t, 0.03);
      filt.frequency.setTargetAtTime(350 + throttle * 1500 + rpm * 900, t, 0.05);
      gain.gain.setTargetAtTime(racing || race.state === "finished" ? 0.05 + throttle * 0.09 : 0.02, t, 0.08);
      const sp = Math.hypot(c.vx, c.vz);
      const squeal = !c.air && c.slip > 0.18 && sp > 8 ? Math.min(1, (c.slip - 0.18) * 3) : 0;
      skidGain.gain.setTargetAtTime(squeal * 0.1, t, 0.05);
    },
    boost: () => burst(900, 0.7, 0.35),
    land: (air) => burst(160, 0.35, Math.min(0.6, 0.2 + air * 0.2), "lowpass"),
  };
})();
const sfx = { boost: () => audio.boost(), land: (a) => audio.land(a) };
function setSound(on) {
  settings.sound = on;
  store("rrr3:sound", on ? "1" : "0");
  $("#opt-sound").checked = on;
  audio.setVolume(on);
}

// ── menu wiring ─────────────────────────────────────────────────────────────

$("#name").value = store("rrr3:name") || store("rrr:name") || "";
$("#opt-shake").checked = settings.shake;
$("#opt-shake").addEventListener("change", (e) => {
  settings.shake = e.target.checked;
  store("rrr3:shake", settings.shake ? "1" : "0");
});
$("#opt-sound").checked = settings.sound;
$("#opt-sound").addEventListener("change", (e) => setSound(e.target.checked));
$("#start").addEventListener("click", startRace);
$("#again").addEventListener("click", startRace);
$("#to-menu").addEventListener("click", showMenu);
$("#name").addEventListener("change", sendHello);

// ── loop ────────────────────────────────────────────────────────────────────

const hz = { geyser: null, lava: null };
let acc = 0;
let last = performance.now();
const t0 = performance.now();
function frame(tNow) {
  const dt = Math.min(SIM > 1 ? 0.25 : 0.1, (tNow - last) / 1000);
  last = tNow;
  const t = (tNow - t0) / 1000;
  readInput(dt);
  acc += dt * SIM;
  const now = Date.now();
  while (acc >= CFG.dt) {
    tick(CFG.dt, now);
    acc -= CFG.dt;
  }
  hz.geyser = geyserPhase(now);
  hz.lava = (L) => lavaState(L, now);
  animateWorld(world, t, dt, hz, (s) => sheepPos(s, now));

  const braking = race.state === "racing" && input.brake > 0 && car.vf > 1;
  poseCar(player, car, dt, braking || race.state === "finished");
  player.root.visible = race.state !== "boot";

  // checkpoints: the next one glows
  world.checkpoints.forEach((cp, k) => {
    const next = race.state === "racing" && k + 1 === race.cpNext % T.CHECKPOINTS.length;
    cp.traverse((o) => {
      if (o.isMesh) o.material.emissiveIntensity = next ? 0.8 + 0.6 * Math.abs(Math.sin(t * 5)) : 0.1;
    });
  });

  // ghost of your best lap
  if (ghost && race.state === "racing" && ghost.f.length > 2) {
    const f = (race.t - race.lapStart) / 0.1;
    const a = Math.floor(f);
    if (a + 1 < ghost.f.length) {
      const p = ghost.f[a];
      const q = ghost.f[a + 1];
      const u = f - a;
      ghostCar.root.visible = true;
      ghostCar.root.position.set(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u);
      ghostCar.root.rotation.set(0, -(p[3] + (q[3] - p[3]) * u), 0);
    } else ghostCar.root.visible = false;
  } else ghostCar.root.visible = false;

  // other players, smoothed toward their last report
  const kk = 1 - Math.exp(-8 * dt);
  for (const r of remote.values()) {
    const c = r.c;
    let da = r.ta - c.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    c.x += (r.tx - c.x) * kk;
    c.z += (r.tz - c.z) * kk;
    c.a += da * kk;
    locate(c);
    c.y = groundAt(c.i, c.lat, c.x, c.z);
    poseCar(r.v, c, dt, false);
  }

  updateCamera(dt, t);
  renderer.render(scene, camera);
  hud(dt);
  requestAnimationFrame(frame);
}

placeAt(car, T.wrap(-5));
loadingBar.style.width = "100%";
race.state = "menu";
$("#loading").classList.add("done");
setTimeout(() => $("#loading").classList.add("hidden"), 700);
$("#menu").classList.remove("hidden");
renderBoards(true);
requestAnimationFrame(frame);
connect();
window.__rrr = { car, race, skill, T, Wd, camera, renderer, world };
