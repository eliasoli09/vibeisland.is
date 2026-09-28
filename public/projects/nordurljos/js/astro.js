/* Astronomy + magnetic-coordinate helpers.
   Sun/Moon: standard low-precision formulas (the same ones used by the SunCalc
   library; good to a fraction of a degree). Magnetic coordinates: a grid of
   AACGM-v2 latitude and magnetic local time (at 110 km) precomputed with the
   aacgmv2 package. Auroral oval: NOAA SWPC rule of thumb — the night-side
   equatorward edge sits near 66° magnetic latitude at Kp 0 and moves ~2° toward
   the equator per Kp step (48° at Kp 9); the day side sits several degrees higher. */
(function () {
  const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
  const toDays = (date) => date.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const rightAsc = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const declin = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
  const altitude = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const refraction = (h) => { if (h < 0) h = 0; return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); };

  function sunCoords(d) {
    const M = rad * (357.5291 + 0.98560028 * d);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad * 102.9372 + Math.PI;
    return { dec: declin(L, 0), ra: rightAsc(L, 0) };
  }
  function moonCoords(d) {
    const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.229350 * d);
    const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F), dist = 385001 - 20905 * Math.cos(M);
    return { ra: rightAsc(l, b), dec: declin(l, b), dist };
  }
  function sunAlt(date, lat, lng) {
    const d = toDays(date), c = sunCoords(d);
    return altitude(sidereal(d, rad * -lng) - c.ra, rad * lat, c.dec) / rad;
  }
  function moonAlt(date, lat, lng) {
    const d = toDays(date), c = moonCoords(d);
    let h = altitude(sidereal(d, rad * -lng) - c.ra, rad * lat, c.dec);
    h += refraction(h);
    return h / rad;
  }
  function moonIllum(date) {
    const d = toDays(date), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI };
  }
  // Unit vector (Earth-fixed: x -> 0°E on equator, z -> north pole) pointing at the Sun
  function subsolar(date) {
    const d = toDays(date), c = sunCoords(d);
    const lng = c.ra - sidereal(d, 0);
    return { lat: c.dec / rad, lng: ((lng / rad + 540) % 360) - 180, vec: [Math.cos(c.dec) * Math.cos(lng), Math.cos(c.dec) * Math.sin(lng), Math.sin(c.dec)] };
  }

  // ---- AACGM grid ----
  const G = window.CGM_GRID;
  const raw = Uint8Array.from(atob(G.b64), ch => ch.charCodeAt(0));
  const i16 = new Int16Array(raw.buffer);
  const N = G.nlat * G.nlon;
  const mlatArr = new Float32Array(N), cArr = new Float32Array(N), sArr = new Float32Array(N);
  for (let k = 0; k < N; k++) { mlatArr[k] = i16[k * 3] / 100; cArr[k] = i16[k * 3 + 1] / 30000; sArr[k] = i16[k * 3 + 2] / 30000; }
  function cgm(lat, lon) {
    const fi = Math.max(0, Math.min(G.nlat - 1.0001, (lat - G.lat0) / G.dlat));
    let fj = ((lon - G.lon0) / G.dlon) % G.nlon; if (fj < 0) fj += G.nlon;
    const i0 = Math.floor(fi), j0 = Math.floor(fj), ti = fi - i0, tj = fj - j0;
    const i1 = i0 + 1, j1 = (j0 + 1) % G.nlon;
    const at = (arr, i, j) => arr[i * G.nlon + j];
    const bl = (arr) => (at(arr, i0, j0) * (1 - tj) + at(arr, i0, j1) * tj) * (1 - ti) + (at(arr, i1, j0) * (1 - tj) + at(arr, i1, j1) * tj) * ti;
    const mlat = bl(mlatArr), c = bl(cArr), s = bl(sArr);
    let mlt0 = Math.atan2(s, c) / (2 * Math.PI) * 24; if (mlt0 < 0) mlt0 += 24;
    return { mlat, mlt0 };
  }
  const mltAt = (mlt0, utHours) => ((mlt0 + utHours) % 24 + 24) % 24;
  // UT hour when a place passes magnetic midnight
  const magMidnightUT = (mlt0) => ((24 - mlt0) % 24 + 24) % 24;

  function ovalEdges(mlt, kp) {
    const c = Math.cos(mlt / 24 * 2 * Math.PI); // +1 at magnetic midnight, -1 at magnetic noon
    const eq = 66 - 2 * kp + 4.5 * (1 - c);
    const width = 4 + 0.5 * kp + (3 + 0.6 * kp) * (0.5 + 0.5 * c);
    return { eq, pole: eq + width, width };
  }

  function fmtHM(h) {
    h = ((h % 24) + 24) % 24;
    let hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  window.Astro = { sunAlt, moonAlt, moonIllum, subsolar, cgm, mltAt, magMidnightUT, ovalEdges, fmtHM, grid: { mlatArr, cArr, sArr, G } };
})();
