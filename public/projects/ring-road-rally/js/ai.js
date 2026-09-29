/**
 * Rival drivers. Each follows its own line (a lateral offset that drifts
 * slowly so they spread across the road and overtake), brakes for what is
 * ahead, and is rubber-banded to the player so the pack stays close.
 */

import * as T from "./track.js";

export const RIVALS = [
  { name: "Sigga", color: 0xff2d87, skill: 1.0 },
  { name: "Jón Páll", color: 0x2f7fd6, skill: 0.97 },
  { name: "Gunna", color: 0x39c26a, skill: 0.95 },
  { name: "Óli", color: 0xf0b416, skill: 0.93 },
  { name: "Birna", color: 0x8a4dff, skill: 0.91 },
];

function headingAt(i) {
  return Math.atan2(T.TZ[i], T.TX[i]);
}
function dAngle(a, b) {
  const d = b - a;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** Max safe speed from the bend ahead (rad over the next stretch). */
function cornerSpeed(i, look, maxSpeed, grip) {
  let bend = 0;
  for (let k = 4; k <= look; k += 4) bend = Math.max(bend, Math.abs(dAngle(headingAt(i), headingAt(T.wrap(i + k)))) / (k / 16));
  const base = maxSpeed * (1 - Math.min(0.62, bend * 0.55));
  return base * (0.55 + 0.45 * grip);
}

export function makeBrain(k) {
  return { lane: (k % 3 - 1) * 0.35, laneT: 0, laneTarget: 0, stuck: 0, seed: k * 17.3 };
}

/**
 * ctl for one AI car. `progressGap` = (player progress − this car) in metres:
 * positive means the player is ahead.
 */
export function drive(c, brain, profile, cfg, dt, t, progressGap, hazards) {
  const speed = Math.hypot(c.vx, c.vz);
  // wander between lanes, a little differently for each driver
  brain.laneT -= dt;
  if (brain.laneT <= 0) {
    brain.laneTarget = Math.max(-0.55, Math.min(0.55, Math.sin(t * 0.13 + brain.seed) * 0.5 + (Math.random() - 0.5) * 0.3));
    brain.laneT = 3 + Math.random() * 4;
  }
  brain.lane += (brain.laneTarget - brain.lane) * Math.min(1, dt * 0.6);
  const look = 5 + Math.round(speed / 4.2);
  const j = T.wrap(c.i + look);
  const tx = T.X[j] + T.NX[j] * T.W[j] * brain.lane;
  const tz = T.Z[j] + T.NZ[j] * T.W[j] * brain.lane;
  const d = dAngle(c.a, Math.atan2(tz - c.z, tx - c.x));
  const steer = Math.max(-1, Math.min(1, d * 2.6 - Math.max(-1, Math.min(1, (c.lat - T.W[c.i] * brain.lane) * 0.04))));

  const zone = T.ZONE_LIST[T.ZONE[c.i]];
  const grip = Math.min(zone.grip, T.ZONE_LIST[T.ZONE[j]].grip);
  // rubber band: fall back when far ahead of the player, push when behind
  const band = Math.max(0.86, Math.min(1.08, 1 + progressGap * 0.0009));
  let limit = cornerSpeed(c.i, 40, cfg.maxSpeed, grip) * profile.skill * band;
  if (hazards.lavaAhead(c)) limit = Math.min(limit, 16);
  const gas = speed < limit ? 1 : 0.15;
  const brake = speed > limit * 1.08 ? Math.min(1, (speed - limit) / 6) : 0;

  // unstick: reverse briefly if pinned against something
  if (speed < 1.5 && gas > 0.5) brain.stuck += dt;
  else brain.stuck = Math.max(0, brain.stuck - dt);
  if (brain.stuck > 1.2) {
    if (brain.stuck > 2.4) brain.stuck = 0;
    return { gas: 0, brake: 1, steer: -steer, hand: false, nitro: false };
  }
  const straight = Math.abs(d) < 0.08 && limit > cfg.maxSpeed * 0.9;
  return { gas, brake, steer, hand: false, nitro: straight && progressGap > 60 };
}
