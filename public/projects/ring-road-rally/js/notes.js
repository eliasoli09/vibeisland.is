/**
 * Pace notes: a co-driver's calls generated from the stage itself. Corners are
 * graded 1 (hairpin) to 6 (flat-out kink) from their radius, with a direction
 * and "langt" when they keep turning; hazards get their own calls.
 */

import * as T from "./track.js";

function headingAt(i) {
  return Math.atan2(T.TZ[i], T.TX[i]);
}
function dAngle(a, b) {
  let d = b - a;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** Signed turn rate (rad/m) around sample i, smoothed over ~20 m. */
function curvature(i) {
  const a = T.wrap(i - 3);
  const b = T.wrap(i + 3);
  const len = Math.abs(T.D[b] - T.D[a]) || 1;
  return dAngle(headingAt(a), headingAt(b)) / (len > 200 ? T.LENGTH - len : len);
}

export const NOTES = (() => {
  const out = [];
  const k = new Float32Array(T.N);
  for (let i = 0; i < T.N; i++) k[i] = curvature(i);
  // corners: runs of samples turning the same way faster than a kink
  let i = 0;
  while (i < T.N) {
    const c = k[i];
    if (Math.abs(c) < 1 / 140) {
      i++;
      continue;
    }
    const dir = Math.sign(c);
    let j = i;
    let peak = 0;
    let total = 0;
    while (j < T.N && Math.sign(k[j]) === dir && Math.abs(k[j]) > 1 / 190) {
      peak = Math.max(peak, Math.abs(k[j]));
      total += Math.abs(dAngle(headingAt(j), headingAt(T.wrap(j + 1))));
      j++;
    }
    if (total > 0.18) {
      const r = 1 / peak;
      const grade = r < 22 ? 1 : r < 38 ? 2 : r < 60 ? 3 : r < 90 ? 4 : r < 130 ? 5 : 6;
      // Heading angle grows clockwise on screen (z points south): a positive
      // turn is to the driver's right.
      const side = dir > 0 ? "Hægri" : "Vinstri";
      const long = total > 1.2 ? " · langt" : "";
      out.push({ i, text: `${side} ${grade}${long}`, grade, kind: "corner" });
    }
    i = j + 1;
  }
  const add = (i, text, kind = "hazard") => out.push({ i, text, grade: 0, kind });
  for (const [seg] of T.JUMPS) add(T.wrap(T.at(seg) - 4), "Stökk! Beint yfir");
  add(T.wrap(T.GEYSER.i - 8), "Strokkur vinstra megin");
  add(T.wrap(T.LAVA[0].i - 8), "Hraun yfir veginn · varúð");
  add(T.wrap(T.SHEEP[0].i - 10), "Kindur á veginum!");
  add(T.wrap(T.SPEEDTRAP.i - 12), "Hraðagildra · botnaðu");
  for (const b of T.BOOSTS) add(T.wrap(b.i - 6), "Jarðhiti · búst", "boost");
  const zoneStart = (key) => {
    for (let s = 0; s < T.N; s++) {
      if (T.ZONE_LIST[T.ZONE[s]].key === key && T.ZONE_LIST[T.ZONE[T.wrap(s - 1)]].key !== key) return s;
    }
    return 0;
  };
  add(T.wrap(zoneStart("rift") - 6), "Þröngt · veggir báðum megin");
  add(T.wrap(zoneStart("gullfoss") - 4), "Gljúfur hægra megin · haltu vinstra");
  add(T.wrap(zoneStart("ice") - 6), "Ís! Mjúkt á stýrið");
  add(T.wrap(zoneStart("sand") - 6), "Laus sandur · steinar");
  out.sort((a, b) => a.i - b.i);
  return out;
})();

/** The next call ahead of sample i within `range` samples, or null. */
export function nextNote(i, range = 34) {
  for (const n of NOTES) {
    const ahead = T.wrap(n.i - i);
    if (ahead > 0 && ahead <= range) return { ...n, ahead };
  }
  return null;
}
