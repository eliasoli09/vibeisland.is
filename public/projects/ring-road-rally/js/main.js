/**
 * Ring Road Rally 3D — the browser half.
 *
 * The room (server logic.js) relays human players and keeps the leaderboard;
 * the race — you, five AI rivals, physics, hazards — runs here at a fixed
 * 120 Hz. Sections:
 *   strings · net · input · tuning · physics · hazards · skills · race ·
 *   render (cars, camera, post) · HUD · audio · loop
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as T from "./track.js";
import * as Wd from "./world.js";
import { createWorld, animateWorld } from "./scene.js";
import { createPost } from "./post.js";
import { createFx } from "./fx.js";
import { makeCar, paint, dress } from "./cars.js";
import { RIVALS, makeBrain, drive } from "./ai.js";
import { nextNote } from "./notes.js";

// ── strings ─────────────────────────────────────────────────────────────────

const STR = {
  tagline: "Rallý um Hringveginn við fimm aðra ökumenn: frá hátíðinni í Reykjavík, gegnum Almannagjá, framhjá Strokki og Gullfossi, yfir hraunið, eftir svörtum sandi og glerhálum jökulís, gegnum Hallormsstaðaskóg og heim.",
  driver: "Ökumaður",
  start: "Keyra af stað",
  controls:
    "<kbd>W</kbd>/<kbd>↑</kbd> bensín · <kbd>S</kbd>/<kbd>↓</kbd> bremsa · <kbd>A</kbd><kbd>D</kbd> stýra · <kbd>Shift</kbd> nítró · <kbd>Bil</kbd> handbremsa · <kbd>C</kbd> myndavél · <kbd>R</kbd> á veginn · <kbd>M</kbd> hljóð · <kbd>Esc</kbd> valmynd",
  sound: "Hljóð",
  shake: "Hristingur",
  notesOpt: "Leiðarnótur",
  board: "Stigatafla",
  route: "Á leiðinni",
  finished: "Í mark!",
  newPb: "Persónulegt met!",
  again: "Keyra aftur",
  menu: "Valmynd",
  lap: "HRINGUR",
  time: "TÍMI",
  last: "SÍÐASTI",
  best: "BESTI",
  bestLap: "Besti hringur",
  skillScore: "Stig",
  topSpeed: "Hámarkshraði",
  nitro: "NÍTRÓ",
  paceNotes: "LEIÐARNÓTUR",
  timeOfDay: "Tími dags",
  day: "Sólsetur",
  night: "Norðurljós",
  rivalsOpt: "Andstæðingar",
  online: (n) => `${n} á netinu`,
  noTimes: "Enginn tími kominn — vertu fyrst(ur)!",
  offline: "Ótengt — tímar vistast ekki í töflu",
  record: (name, t) => `Brautarmet í hring: ${t} — ${name}`,
  roomMeta: (room, n) => `Herbergi „${room}“ · ${n} tengd(ir). Deildu ?room=nafn til að keppa við vini.`,
  lapsLine: (laps) => `Hringir: ${laps.join(" · ")}`,
  placeLine: (p, n) => `${p}. sæti af ${n}`,
  loadingKit: "Sæki Blender-módelin og rallýbílinn…",
  loadingWorld: "Kveikjum á eldfjallinu…",
  go: "AF STAÐ!",
  lastLap: "LOKAHRINGUR",
  wrongWay: "RÖNG ÁTT",
  fell: "Ofan í gljúfrið!",
  splash: "Í sjóinn!",
  geyser: "STROKKUR GAUS!",
  sheep: "MEEE!",
  crash: "ÁREKSTUR — KEÐJAN TÝNDIST",
  nitroReady: "NÍTRÓ TILBÚIÐ",
  overtake: (n) => `FRAMÚR ${n.toUpperCase()}`,
  speedTrap: (k) => `HRAÐAGILDRA · ${k} KM/KLST`,
  defaultName: "Ökuþór",
  skills: { drift: "SKRIÐ", air: "STÖKK", speed: "HRAÐI", near: "RÉTT SLOPPIÐ", boost: "JARÐHITI", trap: "HRAÐAGILDRA", pass: "FRAMÚRAKSTUR" },
  zones: {
    city: ["Reykjavík", "Hringvegur-hátíðin — nýttu beinu kaflana"],
    rift: ["Þingvellir · Almannagjá", "Þröngt gil milli flekanna — varist veggina"],
    geysir: ["Geysir", "Strokkur gýs — bíddu eftir bólunum eða farðu hinum megin"],
    gullfoss: ["Gullfoss", "Gljúfrið er hægra megin — ekki detta niður"],
    lava: ["Eyjafjallajökull", "Hraunstraumar renna yfir veginn — farðu þegar þeir kólna"],
    sand: ["Reynisfjara", "Laus svartur sandur og hraunsteinar á veginum"],
    ice: ["Jökulsárlón", "Glerhált! Stýrðu mjúkt og varastu ísjakana"],
    fjords: ["Austfirðir · Hallormsstaðaskógur", "Krappar beygjur gegnum skóginn"],
    high: ["Hálendið", "Kindur á veginum — og stökkpallur framundan!"],
    west: ["Vesturland", "Hraðagildra og stökk — lokaspretturinn heim"],
  },
};
const COLORS = [
  { name: "Hvítur", hex: 0xffffff },
  { name: "Rauður", hex: 0xd4201a },
  { name: "Blár", hex: 0x2a62d8 },
  { name: "Bleikur", hex: 0xff2d87 },
];

// ── net ─────────────────────────────────────────────────────────────────────

const QS = new URLSearchParams(location.search);
const room = QS.get("room") || "hringvegur";
const DEBUG = QS.has("debug");
const AUTOPILOT = DEBUG && QS.has("autopilot");
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
function send(m) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
}
const act = (action) => send({ type: "action", action });
setInterval(() => {
  if (socket?.readyState === WebSocket.OPEN) socket.send("__ping");
}, 30000);

// ── input ───────────────────────────────────────────────────────────────────

const keys = new Set();
const touchKeys = new Set();
const input = { gas: 0, brake: 0, steer: 0, hand: false, nitro: false };
let steerSmooth = 0;

addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type === "text") {
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
addEventListener(
  "touchstart",
  () => {
    usedTouch = true;
    document.body.classList.add("touch");
  },
  { passive: true },
);
if (usedTouch) document.body.classList.add("touch");

const pad = { start: false, y: false, cam: false };
function readInput(dt) {
  const k = (...codes) => codes.some((c) => keys.has(c));
  let gas = k("ArrowUp", "KeyW") || touchKeys.has("gas") ? 1 : 0;
  let brake = k("ArrowDown", "KeyS") || touchKeys.has("brake") ? 1 : 0;
  // Both held cancel out: predictable, never "last one wins".
  let steer = (k("ArrowRight", "KeyD") || touchKeys.has("right") ? 1 : 0) - (k("ArrowLeft", "KeyA") || touchKeys.has("left") ? 1 : 0);
  let hand = k("Space") || touchKeys.has("hand");
  let nitro = k("ShiftLeft", "ShiftRight", "KeyN") || touchKeys.has("nitro");
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
    nitro ||= Boolean(gp.buttons[4]?.pressed);
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
  input.nitro = nitro;
}

// ── tuning (data, not code) ───────────────────────────────────────────────

const CFG = {
  dt: 1 / 120,
  laps: 3,
  accel: 12,
  brake: 26,
  reverse: 7,
  maxSpeed: 60,
  maxReverse: 10,
  rolling: 1.4,
  drag: 0.11,
  steer: 2.1,
  steerRef: 9,
  highSpeedSteer: 0.42,
  grip: 7,
  handGrip: 0.14,
  boostSpeed: 76,
  boostTime: 1.3,
  nitroSpeed: 16,
  nitroDrain: 0.3,
  carR: 1.0,
  carHalf: 1.15,
  wheelR: 0.46,
  fence: 45,
  kmh: 3.6,
  lavaTop: 0.33,
  geyserKick: 21,
  gravity: 22,
  airtimeSkill: 0.35,
};

// ── physics ─────────────────────────────────────────────────────────────────

function makeState() {
  return {
    x: 0, z: 0, y: 0, a: 0, vx: 0, vz: 0, vy: 0, spin: 0, i: 0, lat: 0, boost: 0, nitro: 0.35, nitroOn: false,
    falling: 0, fallIdx: 0, air: false, airT: 0, zone: T.ZONE_LIST[0], inLava: false, slip: 0, vf: 0,
    latAcc: 0, lonAcc: 0, pitch: 0, roll: 0, geyserCycle: -1, braking: false, steerVis: 0,
    lap: 1, cpNext: 1, lapStart: 0, laps: [], finished: false, finishT: 0,
  };
}

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

const NOEV = { toast() {}, skill() {}, crash() {}, sfx() {}, bump() {} };

function collideCircle(c, ox, oz, r, ev, bounce = 0.35) {
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
    ev.bump(Math.min(1, -vn / 20));
    if (-vn > 7) ev.crash();
  }
  return true;
}

function wall(c, limit, ev) {
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
    ev.bump(Math.min(0.8, Math.abs(vn) / 20));
    if (Math.abs(vn) > 9) ev.crash();
    if (Math.abs(vn) > 5) sparksAt(c.x + T.NX[i] * side, c.y + 0.5, c.z + T.NZ[i] * side, 6);
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

function startFall(c, msg, ev) {
  if (c.falling > 0) return;
  c.falling = 1.3;
  c.fallIdx = c.i;
  ev.toast(msg, "warn");
  ev.crash(true);
}

function step(c, dt, now, ctl, ev) {
  if (c.falling > 0) {
    c.falling -= dt;
    c.vy -= CFG.gravity * dt;
    c.x += c.vx * dt * 0.5;
    c.z += c.vz * dt * 0.5;
    c.y += c.vy * dt;
    if (c.falling <= 0) placeAt(c, T.wrap(c.fallIdx - 8));
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
  c.nitroOn = Boolean(ctl.nitro) && c.nitro > 0.02 && !c.inLava;
  if (c.nitroOn) {
    top += CFG.nitroSpeed;
    c.nitro = Math.max(0, c.nitro - CFG.nitroDrain * dt);
  }
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
    const gasK = c.nitroOn ? 1 : ctl.gas;
    if (gasK > 0 && vf < top) vf += CFG.accel * gasK * dt * (vf < 0 ? 2.5 : 1) * (c.boost > 0 || c.nitroOn ? 1.8 : 1) * (1 - 0.45 * Math.max(0, vf / CFG.maxSpeed));
    if (ctl.brake > 0) {
      if (vf > 0.6) vf -= CFG.brake * ctl.brake * dt;
      else if (vf > -CFG.maxReverse) vf -= CFG.reverse * ctl.brake * dt;
    }
    if (!gasK && !ctl.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), CFG.rolling * dt);
    vf -= vf * CFG.drag * dt;
    if (vf > top) vf += (top - vf) * Math.min(1, 2.4 * dt);
    if (ctl.hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
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
  c.steerVis += (ctl.steer - c.steerVis) * Math.min(1, dt * 8);
  c.vx = fx * vf + rx * vr;
  c.vz = fz * vf + rz * vr;
  c.a += c.spin * dt;
  c.spin *= Math.exp(-2.4 * dt);
  c.lonAcc = (vf - vf0) / dt;
  c.latAcc += ((vr - vr0) / dt + vf * (ctl.steer * 0.3) - c.latAcc) * Math.min(1, dt * 8);
  c.vf = vf;
  c.slip = Math.atan2(Math.abs(vr), Math.max(1, Math.abs(vf)));
  c.braking = ctl.brake > 0 && vf > 1;

  const px = c.x;
  const pz = c.z;
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  locate(c);

  const w = T.W[c.i];
  const here = T.ZONE_LIST[T.ZONE[c.i]];
  if (here.walls && c.y < Wd.ROADH[c.i] + 6) wall(c, w + 0.2, ev);
  else wall(c, w + CFG.fence, ev);
  for (const o of T.OBSTACLES) {
    const di = Math.abs(o.i - c.i);
    if (di > 12 && di < T.N - 12) continue;
    if (c.y > Wd.ROADH[o.i] + 2.5) continue;
    if (!collideCircle(c, o.x, o.z, o.r, ev)) ev.near?.(`o${o.i}`, o.x, o.z, o.r);
  }
  for (const s of T.SHEEP) {
    const di = Math.abs(s.i - c.i);
    if (di > 8 && di < T.N - 8) continue;
    const p = sheepPos(s, now);
    if (collideCircle(c, p.x, p.z, 0.8, ev, 0.2)) ev.sheep?.();
    else ev.near?.(`s${s.i}`, p.x, p.z, 0.8);
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
    ev.bump(Math.min(1, sp / 25));
    if (sp > 12) ev.crash();
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
        ev.skill("air", Math.round(c.airT * 420));
        ev.bump(Math.min(1, c.airT * 0.8));
        ev.sfx("land", c.airT);
        dustAt(c, 16);
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
  if (c.y < Wd.ROADH[c.i] - 4.5 && Math.abs(c.lat) > w + 2) startFall(c, STR.fell, ev);
  if (g < -0.1 && c.y < 0.3) startFall(c, STR.splash, ev);

  // ── the geyser ──
  const G = T.GEYSER;
  const gp = geyserPhase(now);
  const cycle = Math.floor(now / G.period);
  if (gp.state === "blow" && cycle !== c.geyserCycle) {
    const dx = c.x - G.x;
    const dz = c.z - G.z;
    const d = Math.hypot(dx, dz);
    if (d < G.radius && c.y < Wd.ROADH[G.i] + 3) {
      c.geyserCycle = cycle;
      const k = CFG.geyserKick * (1 - d / G.radius / 2);
      c.vx += (dx / (d || 1)) * k;
      c.vz += (dz / (d || 1)) * k;
      c.vy = 9;
      c.air = true;
      c.airT = 0;
      c.spin = (Math.random() < 0.5 ? -1 : 1) * 4.5;
      ev.toast(STR.geyser, "warn");
      ev.bump(1);
    }
  }
  // ── boost pads ──
  for (const b of T.BOOSTS) {
    const da = (c.x - T.X[b.i]) * T.TX[b.i] + (c.z - T.Z[b.i]) * T.TZ[b.i];
    const dl = (c.x - T.X[b.i]) * T.NX[b.i] + (c.z - T.Z[b.i]) * T.NZ[b.i];
    if (Math.abs(da) < b.len && Math.abs(dl) < T.W[b.i] * 0.7 && !c.air) {
      if (c.boost < CFG.boostTime - 0.3) {
        ev.skill("boost", 100);
        ev.sfx("boost");
      }
      c.boost = CFG.boostTime;
    }
  }
  // ── speed trap ──
  {
    const i = T.SPEEDTRAP.i;
    const before = (px - T.X[i]) * T.TX[i] + (pz - T.Z[i]) * T.TZ[i];
    const after = (c.x - T.X[i]) * T.TX[i] + (c.z - T.Z[i]) * T.TZ[i];
    if (before < 0 && after >= 0 && Math.abs(c.lat) < w + 4) ev.trap?.(Math.round(Math.hypot(c.vx, c.vz) * CFG.kmh));
  }
}

/** Two cars bump: each is a pair of circles along its length. */
function collideCars(a, b, evA, evB) {
  if (Math.abs(a.y - b.y) > 2 || a.falling > 0 || b.falling > 0) return;
  const dx0 = a.x - b.x;
  const dz0 = a.z - b.z;
  if (dx0 * dx0 + dz0 * dz0 > 36) return;
  for (const sa of [-CFG.carHalf, CFG.carHalf]) {
    for (const sb of [-CFG.carHalf, CFG.carHalf]) {
      const ax = a.x + Math.cos(a.a) * sa;
      const az = a.z + Math.sin(a.a) * sa;
      const bx = b.x + Math.cos(b.a) * sb;
      const bz = b.z + Math.sin(b.a) * sb;
      const dx = ax - bx;
      const dz = az - bz;
      const min = CFG.carR * 2;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1;
      const nx = dx / d;
      const nz = dz / d;
      const push = (min - d) / 2;
      a.x += nx * push;
      a.z += nz * push;
      b.x -= nx * push;
      b.z -= nz * push;
      const rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (rv < 0) {
        const j = -rv * 0.65;
        a.vx += nx * j;
        a.vz += nz * j;
        b.vx -= nx * j;
        b.vz -= nz * j;
        evA.bump(Math.min(0.8, -rv / 18));
        evB.bump(Math.min(0.8, -rv / 18));
        if (-rv > 8) {
          evA.crash();
          evB.crash();
          sparksAt((ax + bx) / 2, (a.y + b.y) / 2 + 0.6, (az + bz) / 2, 10);
        }
      }
    }
  }
}

// ── skills (a Forza-style chain) + nitro ──────────────────────────────────

const skill = { pts: 0, mult: 1, list: [], idle: 0, total: 0, drift: 0, driftCalm: 0, fast: 0, state: "idle", flash: 0 };
const nearMissAt = new Map();
let crashedAt = -10;
let shake = 0;
let sheepCooldown = 0;

const playerEv = {
  toast: (t, k) => toast(t, k),
  skill: (kind, pts) => addSkill(kind, pts),
  crash: (silent) => crash(silent),
  bump: (a) => (shake = Math.min(1.4, shake + a)),
  sfx: (k, a) => (k === "boost" ? audio.boost() : k === "land" ? audio.land(a) : null),
  sheep: () => {
    if (sheepCooldown <= 0) {
      toast(STR.sheep);
      sheepCooldown = 1.5;
    }
  },
  near: (key, x, z, r) => nearMiss(key, x, z, r),
  trap: (kmh) => {
    toast(STR.speedTrap(kmh), "good");
    addSkill("trap", kmh * 2);
    if (kmh > (Number(store("rrr3:trap")) || 0)) store("rrr3:trap", String(kmh));
  },
};

function addSkill(kind, pts) {
  if (race.state !== "racing") return;
  skill.pts += pts;
  skill.mult = Math.min(9, skill.mult + (skill.list.length ? 1 : 0));
  skill.list.unshift(STR.skills[kind]);
  skill.list.length = Math.min(skill.list.length, 4);
  skill.idle = 0;
  skill.state = "active";
  gainNitro(pts / 2600);
}
function gainNitro(x) {
  const before = player.c.nitro;
  player.c.nitro = Math.min(1, player.c.nitro + x);
  if (before < 1 && player.c.nitro >= 1) toast(STR.nitroReady, "good");
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
function nearMiss(key, x, z, r) {
  const c = player.c;
  const speed = Math.hypot(c.vx, c.vz);
  if (speed < 18 || c.air) return;
  const d = Math.hypot(c.x - x, c.z - z) - r - CFG.carR;
  if (d > 1.6) return;
  const t = performance.now();
  if (t - (nearMissAt.get(key) || 0) < 3000 || t - crashedAt < 1500) return;
  nearMissAt.set(key, t);
  addSkill("near", 250);
}
function skillTick(dt) {
  const c = player.c;
  const speed = Math.hypot(c.vx, c.vz);
  const drifting = !c.air && c.slip > 0.2 && speed > 11 && Math.abs(c.lat) <= T.W[c.i] + 1;
  if (drifting) {
    skill.drift += speed * c.slip * dt * 14;
    skill.driftCalm = 0;
    skill.idle = 0;
    if (skill.state !== "active") skill.state = "active";
    gainNitro(dt * 0.05);
  } else if (skill.drift > 0) {
    skill.driftCalm += dt;
    if (skill.driftCalm > 0.35) {
      if (skill.drift > 40) addSkill("drift", Math.round(skill.drift));
      skill.drift = 0;
    }
  }
  skill.fast = speed > 50 ? skill.fast + dt : 0;
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
  gainNitro(dt * 0.012);
}

// ── race ────────────────────────────────────────────────────────────────────

const race = { state: "boot", t: 0, count: 0, sendT: 0, rec: [], recT: 0, lastZone: null, top: 0, lastLap: null, place: 0, noteKey: -1, wrongT: 0 };
let ghost = null;
try {
  ghost = JSON.parse(store("rrr3:ghost") || "null");
} catch {
  ghost = null;
}
let bestLocalLap = Number(store("rrr3:bestLap")) || null;
let bestLocalRace = Number(store("rrr3:bestRace")) || null;
const settings = {
  color: Math.min(COLORS.length - 1, Math.max(0, Number(store("rrr4:color")) || 0)),
  shake: store("rrr3:shake") !== "0",
  sound: store("rrr3:sound") !== "0",
  notes: store("rrr4:notes") !== "0",
  night: store("rrr4:night") === "1" || QS.get("time") === "night",
  rivals: store("rrr4:rivals") === "0" ? 0 : 5,
};
if (QS.get("time") === "day") settings.night = false;

function playerName() {
  return $("#name").value.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || STR.defaultName;
}
function sendHello() {
  act({ t: "hello", name: playerName(), color: settings.color });
}

/** Distance raced, for positions: laps × length + distance into the lap. */
function progressOf(c) {
  let d = T.D[c.i];
  if (c.cpNext === 1 && c.i > T.N * 0.75) d -= T.LENGTH; // still behind the start line
  return (c.lap - 1) * T.LENGTH + d;
}

/** Two-wide staggered grid behind the line; slot 0 is pole. */
function gridSlot(k) {
  const row = Math.floor(k / 2);
  return { i: T.wrap(-4 - row * 3 - (k % 2)), lat: (k % 2 ? 1 : -1) * 3.4 };
}

const activeCars = () => [player, ...rivals.filter((r) => r.active)];

function setField() {
  rivals.forEach((r, k) => {
    r.active = k < settings.rivals;
    r.v.root.visible = r.active;
  });
  [...rivals.filter((r) => r.active), player].forEach((car, k) => {
    const s = gridSlot(k);
    Object.assign(car.c, makeState());
    placeAt(car.c, s.i, s.lat);
    if (car.brain) Object.assign(car.brain, makeBrain(k), { lane: s.lat / T.W[s.i] });
    car.prevW = null;
  });
}

function startRace() {
  if (race.state === "boot") return;
  store("rrr3:name", playerName());
  sendHello();
  audio.start();
  setField();
  Object.assign(race, { state: "countdown", count: 3.4, t: 0, rec: [], recT: 0, lastZone: null, top: 0, lastLap: null, place: activeCars().length, noteKey: -1, wrongT: 0 });
  Object.assign(skill, { pts: 0, mult: 1, list: [], idle: 0, total: 0, drift: 0, fast: 0, state: "idle" });
  paint(player.v, COLORS[settings.color].hex);
  $("#menu").classList.add("hidden");
  $("#result").classList.add("hidden");
  $("#hud").classList.remove("hidden");
  touchEl.classList.toggle("hidden", !usedTouch);
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function showMenu() {
  race.state = "menu";
  act({ t: "leave" });
  setField();
  $("#menu").classList.remove("hidden");
  $("#result").classList.add("hidden");
  $("#hud").classList.add("hidden");
  touchEl.classList.add("hidden");
  renderBoards(true);
}

function respawn() {
  placeAt(player.c, player.c.i, 0);
  crash(true);
}

function lapDone(car) {
  const c = car.c;
  const ms = Math.round((race.t - c.lapStart) * 1000);
  c.laps.push(ms);
  c.lapStart = race.t;
  if (c.lap >= CFG.laps) {
    c.finished = true;
    c.finishT = race.t;
  } else c.lap++;
  if (car !== player) return;
  race.lastLap = ms;
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
  if (c.finished) finish();
  else toast(c.lap === CFG.laps ? STR.lastLap : `${STR.lap} ${c.lap}/${CFG.laps}`, "good");
}

function checkpointTick(car) {
  const c = car.c;
  if (c.finished || c.falling > 0) return;
  const cp = T.CHECKPOINTS[c.cpNext % T.CHECKPOINTS.length];
  if (T.wrap(c.i - cp) < 30) {
    if (c.cpNext === T.CHECKPOINTS.length) {
      c.cpNext = 1;
      lapDone(car);
    } else c.cpNext++;
  }
}

function finish() {
  race.state = "finished";
  if (skill.state === "active") skill.total += Math.round(skill.pts * skill.mult);
  const c = player.c;
  const total = c.laps.reduce((a, b) => a + b, 0);
  if (!AUTOPILOT) act({ t: "finish", ms: total });
  const pb = !bestLocalRace || total < bestLocalRace;
  if (pb && !AUTOPILOT) {
    bestLocalRace = total;
    store("rrr3:bestRace", String(total));
  }
  const field = activeCars();
  const place = 1 + field.filter((o) => o !== player && o.c.finished && o.c.finishT < c.finishT).length;
  $("#res-place").textContent = STR.placeLine(place, field.length);
  $("#res-time").textContent = fmt(total);
  $("#res-pb").classList.toggle("hidden", !pb);
  $("#res-best").textContent = fmt(Math.min(...c.laps));
  $("#res-skill").textContent = skill.total.toLocaleString("is-IS");
  $("#res-top").textContent = `${Math.round(race.top * CFG.kmh)}`;
  $("#res-laps").textContent = STR.lapsLine(c.laps.map(fmt));
  setTimeout(() => {
    if (race.state !== "finished") return;
    $("#result").classList.remove("hidden");
    $("#hud").classList.add("hidden");
    touchEl.classList.add("hidden");
    renderBoards(true);
  }, 2200);
}

function autopilotCtl(c) {
  const speed = Math.hypot(c.vx, c.vz);
  const j = T.wrap(c.i + 5 + Math.round(speed / 5));
  let d = Math.atan2(T.Z[j] - c.z, T.X[j] - c.x) - c.a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const k = T.wrap(c.i + 14);
  let bend = Math.atan2(T.TZ[k], T.TX[k]) - Math.atan2(T.TZ[c.i], T.TX[c.i]);
  bend = Math.abs(Math.atan2(Math.sin(bend), Math.cos(bend)));
  const limit = CFG.maxSpeed * (c.zone.key === "ice" ? 0.55 : 1) * (1 - Math.min(0.6, bend * 0.9));
  return { gas: speed < limit ? 1 : 0, brake: speed > limit * 1.15 ? 1 : 0, steer: Math.max(-1, Math.min(1, d * 3 - c.lat * 0.06)), hand: false, nitro: bend < 0.05 && c.nitro > 0.5 };
}

const hazardView = {
  now: 0,
  lavaAhead(c) {
    const speed = Math.hypot(c.vx, c.vz);
    for (const L of T.LAVA) {
      const ahead = T.D[L.i] - T.D[c.i];
      if (ahead > -4 && ahead < speed * 1.3 + 12 && lavaState(L, hazardView.now + 900) !== "cool") return true;
    }
    return false;
  },
};

const IDLE = { gas: 0, brake: 0, steer: 0, hand: false, nitro: false };
function tick(dt, now) {
  hazardView.now = now;
  if (race.state === "countdown") {
    race.count -= dt;
    if (race.count <= 0.2) {
      race.state = "racing";
      toast(STR.go, "good");
      audio.go();
    }
    return;
  }
  if (race.state === "menu" || race.state === "boot") return;
  const racing = race.state === "racing";
  if (sheepCooldown > 0) sheepCooldown -= dt;

  const pc = player.c;
  const pctl = racing && !pc.finished ? (AUTOPILOT ? autopilotCtl(pc) : input) : { ...IDLE, brake: 0.4 };
  step(pc, dt, now, pctl, playerEv);
  const pProg = progressOf(pc);
  for (const r of rivals) {
    if (!r.active) continue;
    const ctl = r.c.finished ? { ...IDLE, brake: 0.3 } : drive(r.c, r.brain, r.profile, CFG, dt, race.t, pProg - progressOf(r.c), hazardView);
    step(r.c, dt, now, ctl, NOEV);
    r.c.nitro = Math.min(1, r.c.nitro + dt * 0.03);
  }
  const field = activeCars();
  for (let a = 0; a < field.length; a++) {
    for (let b = a + 1; b < field.length; b++) collideCars(field[a].c, field[b].c, field[a] === player ? playerEv : NOEV, field[b] === player ? playerEv : NOEV);
  }
  race.t += dt;
  for (const car of field) checkpointTick(car);
  if (!racing) return;

  skillTick(dt);
  race.top = Math.max(race.top, Math.hypot(pc.vx, pc.vz));
  const order = field.slice().sort((a, b) => b.c.finished - a.c.finished || (a.c.finished ? a.c.finishT - b.c.finishT : progressOf(b.c) - progressOf(a.c)));
  const place = order.indexOf(player) + 1;
  if (place < race.place && race.t > 3) {
    const passed = order[place];
    if (passed && passed !== player) {
      toast(STR.overtake(passed.name), "good");
      addSkill("pass", 300);
    }
  }
  race.place = place;
  // drafting: tucked in behind a rival at speed fills the nitro
  for (const r of rivals) {
    if (!r.active) continue;
    const dx = r.c.x - pc.x;
    const dz = r.c.z - pc.z;
    const along = dx * Math.cos(pc.a) + dz * Math.sin(pc.a);
    const side = Math.abs(-dx * Math.sin(pc.a) + dz * Math.cos(pc.a));
    if (along > 3 && along < 14 && side < 1.6 && Math.hypot(pc.vx, pc.vz) > 30) gainNitro(dt * 0.08);
  }
  const along = pc.vx * T.TX[pc.i] + pc.vz * T.TZ[pc.i];
  race.wrongT = along < -4 ? race.wrongT + dt : 0;
  race.recT += dt;
  if (race.recT >= 0.1) {
    race.recT -= 0.1;
    race.rec.push([Math.round(pc.x * 10) / 10, Math.round(pc.y * 10) / 10, Math.round(pc.z * 10) / 10, Math.round(pc.a * 100) / 100]);
  }
  race.sendT += dt;
  if (race.sendT >= 0.2) {
    race.sendT = 0;
    act({ t: "pos", x: Math.round(pc.x * 10) / 10, y: Math.round(pc.z * 10) / 10, a: Math.round(Math.atan2(Math.sin(pc.a), Math.cos(pc.a)) * 1000) / 1000, lap: Math.min(pc.lap, CFG.laps) });
  }
  if (pc.zone !== race.lastZone) {
    race.lastZone = pc.zone;
    showBanner(pc.zone.key);
  }
}

// ── render ──────────────────────────────────────────────────────────────────

const $ = (s) => document.querySelector(s);
const canvas = $("#game");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
} catch {
  $("#nogl").classList.remove("hidden");
  $("#loading").classList.add("hidden");
  throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LITE ? 1 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 4600);

const loadingText = $("#loading-text");
const loadingBar = $("#loading-bar");
loadingText.textContent = STR.loadingKit;
loadingBar.style.width = "30%";
// The textured rally car: bundled copy first, then the CDN copy (CORS-open,
// immutable), else null and the Blender kit car stands in.
const CAR_CDN = "https://d2ol7oe51mr4n9.cloudfront.net/user_3Bd2ySVG9o4EIwZ87VdhxlurjR9/6d04f254-5cb1-4f4b-8665-7d5bb2cfca63.glb";
async function loadRallyCar() {
  const loader = new GLTFLoader();
  for (const url of [new URL("../models/car.glb", import.meta.url).href, CAR_CDN]) {
    try {
      const g = await loader.loadAsync(url);
      if (g.scene.getObjectByName("KIT_Rally")) return g;
    } catch {
      // try the next source
    }
  }
  return null;
}
const [world, rallyGltf] = await Promise.all([
  createWorld(renderer, { lite: LITE }),
  loadRallyCar(),
]);
loadingText.textContent = STR.loadingWorld;
loadingBar.style.width = "85%";
const { scene } = world;
const post = createPost(renderer, scene, camera, { lite: LITE });
const fx = createFx(scene, { lite: LITE });
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
}
addEventListener("resize", resize);
resize();

const player = { name: "", c: makeState(), v: makeCar(scene, rallyGltf, world.gltf, COLORS[settings.color].hex) };
const rivals = RIVALS.map((p, k) => ({
  name: p.name,
  profile: p,
  brain: makeBrain(k),
  c: makeState(),
  active: true,
  v: makeCar(scene, rallyGltf, world.gltf, p.color, { name: p.name, accent: `#${p.color.toString(16).padStart(6, "0")}` }),
}));
const ghostCar = makeCar(scene, rallyGltf, world.gltf, COLORS[settings.color].hex, { ghost: true });
ghostCar.root.visible = false;

// the player's headlights: one real spotlight, only at night
const headlight = new THREE.SpotLight(0xfff0d8, 0, 90, 0.45, 0.7, 1.0);
scene.add(headlight, headlight.target);

function applyMood() {
  world.setNight(settings.night);
  post.setMood(settings.night);
  renderer.toneMappingExposure = settings.night ? 1.0 : 0.85;
  headlight.intensity = settings.night ? 280 : 0;
  document.body.classList.toggle("night", settings.night);
}
applyMood();

function poseCar(car, dt) {
  const c = car.c;
  const v = car.v;
  v.root.position.set(c.x, c.y, c.z);
  const fx = Math.cos(c.a);
  const fz = Math.sin(c.a);
  if (!c.air && c.falling <= 0) {
    const hf = groundAt(c.i, c.lat, c.x + fx * 1.4, c.z + fz * 1.4);
    const hb = groundAt(c.i, c.lat, c.x - fx * 1.4, c.z - fz * 1.4);
    const hl = groundAt(c.i, c.lat - 0.85, c.x + fz * 0.85, c.z - fx * 0.85);
    const hr = groundAt(c.i, c.lat + 0.85, c.x - fz * 0.85, c.z + fx * 0.85);
    c.pitch += (Math.atan2(hf - hb, 2.8) - c.pitch) * Math.min(1, dt * 12);
    c.roll += (Math.atan2(hl - hr, 1.7) - c.roll) * Math.min(1, dt * 12);
  } else {
    c.pitch += (Math.max(-0.35, Math.min(0.35, c.vy * 0.03)) - c.pitch) * Math.min(1, dt * 2);
    c.roll *= 1 - Math.min(1, dt * 2);
  }
  v.root.rotation.set(c.roll, -c.a, c.pitch);
  v.chassis.rotation.x = THREE.MathUtils.clamp(-c.latAcc * 0.004, -0.07, 0.07);
  v.chassis.rotation.z = THREE.MathUtils.clamp(-c.lonAcc * 0.003, -0.05, 0.05);
  dress(v, { braking: c.braking || (car === player && race.state === "finished"), nitro: c.nitroOn || c.boost > 0, night: settings.night, speed: c.vf ?? 0, steer: c.steerVis, dt, wheelR: CFG.wheelR });
}

// wheel dust, smoke and skids for any car
const DUST = { gravel: new THREE.Color(0.72, 0.62, 0.46), sand: new THREE.Color(0.16, 0.16, 0.18), ice: new THREE.Color(0.9, 0.96, 1), asphalt: new THREE.Color(0.85, 0.85, 0.85), grass: new THREE.Color(0.45, 0.5, 0.32) };
const SKID = { asphalt: new THREE.Color(0.06, 0.06, 0.06), gravel: new THREE.Color(0.35, 0.28, 0.2), sand: new THREE.Color(0.05, 0.05, 0.06), ice: new THREE.Color(0.55, 0.7, 0.8), grass: new THREE.Color(0.2, 0.26, 0.14) };
const SPARK = new THREE.Color(1, 0.75, 0.3);
const FLAMEC = new THREE.Color(0.45, 0.6, 1);
const LAVAC = new THREE.Color(1, 0.45, 0.1);
function dustAt(c, n) {
  const style = Math.abs(c.lat) > T.W[c.i] + 0.5 ? "grass" : c.zone.style;
  for (let k = 0; k < n; k++) fx.soft.emit(c.x + (Math.random() - 0.5) * 3, c.y + 0.3, c.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6, 1 + Math.random() * 2, (Math.random() - 0.5) * 6, 1.2, 1.4, 2.5, 0.55, DUST[style] || DUST.gravel, 1.2, 0.4);
}
function sparksAt(x, y, z, n) {
  for (let k = 0; k < n; k++) fx.glow.emit(x, y, z, (Math.random() - 0.5) * 14, Math.random() * 6, (Math.random() - 0.5) * 14, 0.4, 0.25, -0.2, 1, SPARK, 1, -12);
}
function wheelFx(car, dt) {
  const c = car.c;
  if (c.air || c.falling > 0) {
    car.prevW = null;
    return;
  }
  const speed = Math.hypot(c.vx, c.vz);
  const off = Math.abs(c.lat) > T.W[c.i] + 0.5;
  const style = off ? "grass" : c.zone.style;
  const fx0 = Math.cos(c.a);
  const fz0 = Math.sin(c.a);
  const pos = [
    [c.x - fx0 * 1.4 + fz0 * 0.82, c.z - fz0 * 1.4 - fx0 * 0.82],
    [c.x - fx0 * 1.4 - fz0 * 0.82, c.z - fz0 * 1.4 + fx0 * 0.82],
  ];
  const sliding = c.slip > 0.16 && speed > 7;
  const loose = style === "gravel" || style === "sand" || style === "grass" || style === "ice";
  // dust: loose surfaces always kick some up; drifting kicks up a lot
  car.dustAcc = (car.dustAcc || 0) + dt * (loose ? speed * 0.9 + (sliding ? 40 : 0) : sliding ? 30 : 0) * (LITE ? 0.5 : 1);
  while (car.dustAcc > 1) {
    car.dustAcc -= 1;
    const [px, pz] = pos[Math.random() < 0.5 ? 0 : 1];
    const back = -Math.min(8, speed * 0.12);
    const col = style === "asphalt" ? DUST.asphalt : DUST[style] || DUST.gravel;
    fx.soft.emit(px, c.y + 0.25, pz, fx0 * back + (Math.random() - 0.5) * 2.5, 0.6 + Math.random() * 1.4, fz0 * back + (Math.random() - 0.5) * 2.5, loose ? 1.6 : 1.1, loose ? 1.1 : 0.9, loose ? 3.2 : 2.6, style === "asphalt" ? 0.4 : 0.5, col, 1.0, 0.35);
  }
  if (c.inLava && Math.random() < 0.5) fx.glow.emit(c.x, c.y + 0.3, c.z, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.7, 0.3, 0, 1, LAVAC, 1, -4);
  const marking = sliding || (c.braking && speed > 18) || (loose && speed > 10);
  if (marking && car.prevW) {
    const col = SKID[style] || SKID.asphalt;
    const alpha = loose && !sliding ? 0.18 : 0.42;
    for (let k = 0; k < 2; k++) fx.skid(car.prevW[k][0], c.y + 0.1, car.prevW[k][1], pos[k][0], c.y + 0.1, pos[k][1], 0.32, col, alpha);
  }
  car.prevW = marking ? pos : null;
  if (c.nitroOn || c.boost > 0) {
    for (const b of [-0.32, 0.32]) {
      fx.glow.emit(c.x - fx0 * 2.3 - fz0 * b, c.y + 0.35, c.z - fz0 * 2.3 + fx0 * b, -fx0 * 8, 0.2, -fz0 * 8, 0.18, 0.5, 1.2, 0.8, FLAMEC, 3, 0);
    }
  }
}

// remote human players
const remote = new Map();
function onRoomState(msg) {
  lastRoomMsg = msg;
  const seen = new Set();
  for (const rc of msg.view?.cars ?? []) {
    seen.add(rc.id);
    let r = remote.get(rc.id);
    if (!r) {
      const color = COLORS[rc.color ?? 0]?.hex ?? 0xffffff;
      r = { name: rc.name, c: makeState(), v: makeCar(scene, rallyGltf, world.gltf, color, { name: rc.name, accent: "#4fe3d0" }), tx: rc.x, tz: rc.y, ta: rc.a };
      r.c.x = rc.x;
      r.c.z = rc.y;
      r.c.a = rc.a;
      remote.set(rc.id, r);
    }
    r.tx = rc.x;
    r.tz = rc.y;
    r.ta = rc.a;
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
  { dist: 6.3, height: 2.0, look: 1.15, fov: 64 },
  { dist: 10.5, height: 3.4, look: 1.5, fov: 58 },
  { hood: true, fov: 76 },
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
let camRoll = 0;

function updateCamera(dt, t) {
  const c = player.c;
  const speed = Math.hypot(c.vx, c.vz);
  const cfg = CAMS[camMode];
  const nitro = c.nitroOn || c.boost > 0 ? 1 : 0;
  let targetRoll = 0;
  if (race.state === "menu" || race.state === "boot" || race.state === "finished") {
    const ang = t * 0.1 + 2.2;
    tmp.set(c.x + Math.cos(ang) * 9.5, c.y + 2.1 + Math.sin(t * 0.2) * 0.5, c.z + Math.sin(ang) * 9.5);
    camPos.lerp(tmp, 1 - Math.exp(-dt * 3));
    camLook.set(c.x, c.y + 0.9, c.z);
    camera.fov += (46 - camera.fov) * Math.min(1, dt * 2);
  } else if (cfg.hood) {
    const fx = Math.cos(c.a);
    const fz = Math.sin(c.a);
    camPos.set(c.x + fx * 0.3, c.y + 1.45, c.z + fz * 0.3);
    camLook.set(c.x + fx * 20, c.y + 1.1 + c.pitch * 20, c.z + fz * 20);
    camera.fov += (cfg.fov + 10 * Math.min(1, speed / CFG.maxSpeed) + nitro * 8 - camera.fov) * Math.min(1, dt * 3);
  } else {
    // follow a blend of where the car points and where it's going (drift cam)
    let target = c.a;
    if (speed > 6) {
      let d = Math.atan2(c.vz, c.vx) - c.a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 1.6) target = c.a + d * 0.45;
    }
    let dd = target - camDir;
    dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    camDir += dd * Math.min(1, dt * 5);
    const fx = Math.cos(camDir);
    const fz = Math.sin(camDir);
    const dist = cfg.dist + Math.min(1, speed / CFG.maxSpeed) * 1.2 - nitro * 0.6;
    tmp.set(c.x - fx * dist, c.y + cfg.height, c.z - fz * dist);
    camPos.lerp(tmp, 1 - Math.exp(-dt * 10));
    const floor = Wd.terrainAt(camPos.x, camPos.z) + 1.0;
    if (camPos.y < floor) camPos.y = floor;
    camLook.set(c.x + Math.cos(c.a) * 5, c.y + cfg.look, c.z + Math.sin(c.a) * 5);
    camera.fov += (cfg.fov + 14 * Math.min(1, speed / CFG.maxSpeed) + nitro * 10 - camera.fov) * Math.min(1, dt * 3);
    targetRoll = -input.steer * Math.min(1, speed / 40) * 0.035;
  }
  camRoll += (targetRoll - camRoll) * Math.min(1, dt * 4);
  shake *= Math.exp(-5 * dt);
  const sp = speed > 46 ? (speed - 46) * 0.0016 + nitro * 0.02 : 0;
  const sh = settings.shake ? shake * 0.35 + sp : 0;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh);
  camera.lookAt(camLook);
  camera.rotateZ(camRoll);
  camera.updateProjectionMatrix();

  // keep the sun's shadow box on the car, snapped to texels to avoid shimmer
  const s = world.sun;
  const snap = 140 / s.shadow.mapSize.x;
  const cx = Math.round(c.x / snap) * snap;
  const cz = Math.round(c.z / snap) * snap;
  s.target.position.set(cx, c.y, cz);
  s.position.set(cx + world.sunDir.x * 320, c.y + world.sunDir.y * 320, cz + world.sunDir.z * 320);
  headlight.position.set(c.x + Math.cos(c.a) * 2.2, c.y + 0.9, c.z + Math.sin(c.a) * 2.2);
  headlight.target.position.set(c.x + Math.cos(c.a) * 30, c.y - 1, c.z + Math.sin(c.a) * 30);
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
      store("rrr4:color", String(k));
      paint(player.v, c.hex);
      paint(ghostCar, c.hex);
      for (const o of $("#swatches").children) o.setAttribute("aria-pressed", String(o === b));
      sendHello();
    });
    return b;
  }),
);
function segmented(id, options, get, set) {
  const el = $(id);
  el.replaceChildren(
    ...options.map(([label, value]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.setAttribute("aria-pressed", String(get() === value));
      b.addEventListener("click", () => {
        set(value);
        for (const o of el.children) o.setAttribute("aria-pressed", String(o === b));
      });
      return b;
    }),
  );
}
segmented(
  "#opt-time",
  [
    [STR.day, false],
    [STR.night, true],
  ],
  () => settings.night,
  (v) => {
    settings.night = v;
    store("rrr4:night", v ? "1" : "0");
    applyMood();
  },
);
segmented(
  "#opt-rivals",
  [
    ["0", 0],
    ["5", 5],
  ],
  () => settings.rivals,
  (v) => {
    settings.rivals = v;
    store("rrr4:rivals", String(v));
    setField();
  },
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

// speedometer arc (bottom-centre gauge)
const ARC = { cx: 110, cy: 110, r: 92, a0: (150 * Math.PI) / 180, sweep: (240 * Math.PI) / 180 };
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
const GEARS = [0, 13, 23, 33, 43, 53, 66];
function gearAndRpm() {
  const c = player.c;
  const v = Math.abs(c.vf);
  if (race.state === "countdown" || v < 0.5) return { gear: c.vf < -0.5 ? "R" : "N", rpm: 0.15 + input.gas * 0.65 + Math.random() * 0.02 * input.gas };
  if (c.vf < -0.5) return { gear: "R", rpm: 0.3 + (v / CFG.maxReverse) * 0.5 };
  let g = 1;
  while (g < GEARS.length - 1 && v > GEARS[g]) g++;
  return { gear: String(g), rpm: 0.3 + 0.7 * Math.min(1, (v - GEARS[g - 1]) / (GEARS[g] - GEARS[g - 1])) };
}

// minimap: the loop as a neon outline, cars as dots
const mm = $("#minimap");
const mctx = mm.getContext("2d");
const MMB = (() => {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < T.N; i++) {
    x0 = Math.min(x0, T.X[i]);
    x1 = Math.max(x1, T.X[i]);
    z0 = Math.min(z0, T.Z[i]);
    z1 = Math.max(z1, T.Z[i]);
  }
  const s = Math.min((mm.width - 36) / (x1 - x0), (mm.height - 36) / (z1 - z0));
  return { s, ox: (mm.width - (x1 - x0) * s) / 2 - x0 * s, oz: (mm.height - (z1 - z0) * s) / 2 - z0 * s };
})();
function drawMinimap() {
  const g = mctx;
  g.clearRect(0, 0, mm.width, mm.height);
  g.lineJoin = g.lineCap = "round";
  g.beginPath();
  for (let i = 0; i <= T.N; i += 2) {
    const k = i % T.N;
    const x = T.X[k] * MMB.s + MMB.ox;
    const y = T.Z[k] * MMB.s + MMB.oz;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.strokeStyle = "rgba(255,45,135,0.35)";
  g.lineWidth = 12;
  g.stroke();
  g.strokeStyle = "#ff5aa8";
  g.lineWidth = 4;
  g.stroke();
  const dot = (c, color, r) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(c.x * MMB.s + MMB.ox, c.z * MMB.s + MMB.oz, r, 0, Math.PI * 2);
    g.fill();
  };
  for (const r of rivals) if (r.active) dot(r.c, `#${r.profile.color.toString(16).padStart(6, "0")}`, 6);
  for (const r of remote.values()) dot(r.c, "#4fe3d0", 6);
  dot(player.c, "#ffffff", 9);
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
  audio.update(rpm, input.gas, player.c);
  hudT += dt;
  if (hudT < 0.066) return;
  hudT = 0;
  if (race.state === "menu" || race.state === "boot") return;
  const c = player.c;
  const n = activeCars().length;
  $("#hud-lap").textContent = `${Math.min(c.lap, CFG.laps)}/${CFG.laps}`;
  $("#hud-total").textContent = fmt(race.state === "racing" ? (race.t - c.lapStart) * 1000 : c.laps.reduce((a, b) => a + b, 0));
  $("#hud-last").textContent = fmt(race.lastLap);
  $("#hud-best").textContent = fmt(bestLocalLap);
  $("#hud-pos").textContent = String(race.place || n);
  $("#hud-posn").textContent = `/${n}`;
  $("#hud-speed").textContent = String(Math.round(Math.hypot(c.vx, c.vz) * CFG.kmh));
  $("#hud-gear").textContent = gear;
  $("#hud-nitro").style.width = `${Math.round(c.nitro * 100)}%`;
  $("#nitro-bar").classList.toggle("full", c.nitro >= 0.99);
  $("#nitro-bar").classList.toggle("on", c.nitroOn);
  $("#hud-score").textContent = skill.total.toLocaleString("is-IS");
  $("#hud-online").textContent = online && remote.size ? STR.online(remote.size + 1) : "";
  if (race.wrongT > 1) toast(STR.wrongWay, "warn");
  const sk = $("#skills");
  const live = (skill.state !== "idle" || skill.drift > 0) && (skill.state === "lost" || skill.state === "banked" || skill.pts + Math.max(0, skill.drift) >= 1);
  sk.style.opacity = live ? "1" : "0";
  sk.className = skill.state === "lost" ? "lost" : skill.state === "banked" ? "banked" : "";
  $("#sk-mult").textContent = `x${skill.mult}`;
  const running = skill.pts + (skill.drift > 0 ? skill.drift : 0);
  $("#sk-pts").textContent = skill.state === "banked" ? `+${Math.round(skill.pts * skill.mult).toLocaleString("is-IS")}` : Math.round(running).toLocaleString("is-IS");
  const counts = new Map();
  for (const s of skill.drift > 0 ? [STR.skills.drift, ...skill.list] : skill.list) counts.set(s, (counts.get(s) || 0) + 1);
  $("#sk-list").textContent = [...counts].slice(0, 4).map(([s, n]) => (n > 1 ? `${s} ×${n}` : s)).join(" · ");
  // pace notes
  const note = settings.notes && race.state === "racing" ? nextNote(c.i, 30) : null;
  const pn = $("#pace");
  if (note) {
    pn.classList.add("show");
    pn.classList.toggle("hazard", note.kind !== "corner");
    $("#pace-text").textContent = note.text;
    $("#pace-grade").textContent = note.grade ? String(note.grade) : "!";
    $("#pace-arrow").dataset.dir = note.text.startsWith("Hægri") ? "r" : note.text.startsWith("Vinstri") ? "l" : "";
    if (note.i !== race.noteKey) {
      race.noteKey = note.i;
      audio.note();
    }
  } else pn.classList.remove("show");
  drawMinimap();
  if (DEBUG) {
    $("#debug").classList.remove("hidden");
    $("#debug").textContent = `fps ${Math.round(fpsN / fpsT)} · i ${c.i} · lat ${c.lat.toFixed(1)} · y ${c.y.toFixed(1)} · ${c.zone.key}${c.air ? " · AIR" : ""} · cp ${c.cpNext} · lap ${c.lap} · P${race.place} · calls ${renderer.info.render.calls} · tris ${Math.round(renderer.info.render.triangles / 1000)}k`;
    fpsN = 0;
    fpsT = 0;
  }
}

// ── audio: synth engine, tyre squeal, wind, a few effects ──────────────────

const audio = (() => {
  let ctx = null;
  let eng;
  let eng2;
  let filt;
  let gain;
  let skidGain;
  let windGain;
  let master;
  let noiseBuf;
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
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
    const mk = (freq, q, type) => {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf;
      n.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      n.connect(f).connect(g).connect(master);
      n.start();
      return g;
    };
    skidGain = mk(1800, 3, "bandpass");
    windGain = mk(500, 0.6, "lowpass");
  };
  const burst = (freq, dur, vol, type = "highpass") => {
    if (!ctx || !settings.sound) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
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
  const beep = (freq, dur, vol) => {
    if (!ctx || !settings.sound) return;
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  };
  return {
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
      filt.frequency.setTargetAtTime(350 + throttle * 1500 + rpm * 900 + (c.nitroOn ? 900 : 0), t, 0.05);
      gain.gain.setTargetAtTime(racing || race.state === "finished" ? 0.05 + throttle * 0.09 : 0.02, t, 0.08);
      const sp = Math.hypot(c.vx, c.vz);
      const squeal = !c.air && c.slip > 0.18 && sp > 8 && c.zone.style === "asphalt" ? Math.min(1, (c.slip - 0.18) * 3) : 0;
      skidGain.gain.setTargetAtTime(squeal * 0.1, t, 0.05);
      windGain.gain.setTargetAtTime(racing ? Math.min(0.12, (sp / CFG.maxSpeed) ** 2 * 0.1 + (c.nitroOn ? 0.05 : 0)) : 0, t, 0.1);
    },
    boost: () => burst(900, 0.7, 0.35),
    land: (air) => burst(160, 0.35, Math.min(0.6, 0.2 + air * 0.2), "lowpass"),
    note: () => beep(1320, 0.08, 0.05),
    go: () => beep(880, 0.35, 0.12),
  };
})();
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
$("#opt-notes").checked = settings.notes;
$("#opt-notes").addEventListener("change", (e) => {
  settings.notes = e.target.checked;
  store("rrr4:notes", settings.notes ? "1" : "0");
});
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

  for (const car of activeCars()) {
    poseCar(car, dt);
    if (race.state === "racing" || race.state === "finished") wheelFx(car, dt);
  }

  world.checkpoints.forEach((cp, k) => {
    const next = race.state === "racing" && k + 1 === player.c.cpNext % T.CHECKPOINTS.length;
    cp.traverse((o) => {
      if (o.isMesh) o.material.emissiveIntensity = next ? 1.2 + 0.8 * Math.abs(Math.sin(t * 5)) : settings.night ? 0.8 : 0.1;
    });
  });

  if (ghost && race.state === "racing" && ghost.f.length > 2) {
    const f = (race.t - player.c.lapStart) / 0.1;
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
    poseCar(r, dt);
  }

  updateCamera(dt, t);
  fx.update(dt, camera, innerHeight * renderer.getPixelRatio());
  const speed01 = Math.min(1, Math.hypot(player.c.vx, player.c.vz) / CFG.maxSpeed);
  post.render(t, race.state === "racing" ? speed01 : 0, race.state === "racing" && (player.c.nitroOn || player.c.boost > 0) ? 1 : 0);
  hud(dt);
  requestAnimationFrame(frame);
}

setField();
loadingBar.style.width = "100%";
race.state = "menu";
$("#loading").classList.add("done");
setTimeout(() => $("#loading").classList.add("hidden"), 700);
$("#menu").classList.remove("hidden");
renderBoards(true);
requestAnimationFrame(frame);
connect();
window.__rrr = { car: player.c, player, rivals, race, skill, T, Wd, camera, renderer, world, settings, applyMood };
