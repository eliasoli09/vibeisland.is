/* Chapters 6–7: the night planner (Sun & Moon over Iceland) and the map of
   viewing spots with lines of magnetic latitude. */
(function () {
  const PLACES = {
    rvk: { name: 'Reykjavík', lat: 64.146, lon: -21.942 },
    aku: { name: 'Akureyri', lat: 65.683, lon: -18.09 },
    egs: { name: 'Egilsstaðir', lat: 65.265, lon: -14.395 },
    isa: { name: 'Ísafjörður', lat: 66.075, lon: -23.126 }
  };
  const SPOTS = [
    { name: 'Grótta lighthouse', lat: 64.164, lon: -22.022, where: 'Seltjarnarnes, Reykjavík area · ~10 min from downtown',
      text: 'The western tip of the capital area. It\'s one of the darkest places you can reach without leaving Reykjavík, with open views north over Faxaflói bay.' },
    { name: 'Þingvellir National Park', lat: 64.256, lon: -21.13, where: '~45 min drive from Reykjavík',
      text: 'A UNESCO World Heritage Site in a rift valley between the North American and Eurasian plates. Very little artificial light, and wide views across the lake.' },
    { name: 'Kirkjufell', lat: 64.941, lon: -23.305, where: 'Snæfellsnes peninsula · ~2.5 h from Reykjavík',
      text: 'The famous cone-shaped mountain near Grundarfjörður. The aurora usually sits behind it to the north. Park only in the official car park.' },
    { name: 'Vík & Reynisfjara', lat: 63.404, lon: -19.044, where: 'South coast · ~2.5 h from Reykjavík',
      text: 'The south coast has the lowest magnetic latitude in Iceland, but it still sits under the oval on most active nights. Never go near the waves at Reynisfjara: sneaker waves there are deadly.' },
    { name: 'Jökulsárlón', lat: 64.048, lon: -16.179, where: 'Southeast · ~5 h from Reykjavík',
      text: 'A glacier lagoon full of icebergs. On calm nights the water reflects the aurora between the ice.' },
    { name: 'Akureyri', lat: 65.683, lon: -18.09, where: 'North Iceland · largest town outside the capital area',
      text: 'Drive a few minutes out of town into the hills around Eyjafjörður. The north is often clear when the south and west are cloudy.' },
    { name: 'Mývatn', lat: 65.6, lon: -16.99, where: 'Northeast · ~1 h from Akureyri',
      text: 'A lake among lava formations with very few lights. It sits at a higher magnetic latitude than Reykjavík, so it is right under the oval on quiet nights.' },
    { name: 'Egilsstaðir', lat: 65.265, lon: -14.395, where: 'East Iceland',
      text: 'East Iceland\'s main town. It\'s often worth a look when low-pressure systems bring cloud to the southwest.' },
    { name: 'Ísafjörður', lat: 66.075, lon: -23.126, where: 'Westfjords',
      text: 'Remote and very dark. Steep fjord walls can block the low northern sky, so look for open viewpoints facing north.' }
  ];

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ---------- map ----------
  function initMap() {
    const stage = document.getElementById('map-stage'), info = document.getElementById('spot-info');
    if (!window.d3) { stage.innerHTML = '<p class="nogl" style="position:static">Map needs d3.</p>'; return; }
    const W = 820, H = 560;
    const geo = { type: 'Feature', geometry: window.ICELAND_GEO };
    const proj = d3.geoConicConformal().parallels([64, 66]).rotate([19, 0]).fitExtent([[28, 34], [W - 28, H - 40]], geo);
    const path = d3.geoPath(proj);
    // magnetic latitude grid over and around Iceland
    const lon0 = -32, lon1 = -6, lat0 = 61.5, lat1 = 68.5, dl = 0.1;
    const nx = Math.round((lon1 - lon0) / dl) + 1, ny = Math.round((lat1 - lat0) / dl) + 1;
    const vals = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) vals[j * nx + i] = Astro.cgm(lat0 + j * dl, lon0 + i * dl).mlat;
    const levels = [63, 63.5, 64, 64.5, 65, 65.5, 66, 66.5, 67];
    const cont = d3.contours().size([nx, ny]).thresholds(levels)(Array.from(vals));
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of Iceland with lines of magnetic latitude and aurora viewing spots">`;
    svg += `<defs><clipPath id="mclip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
      <radialGradient id="spotglow"><stop offset="0" stop-color="#5dffa0" stop-opacity=".6"/><stop offset="1" stop-color="#5dffa0" stop-opacity="0"/></radialGradient></defs>`;
    svg += `<rect width="${W}" height="${H}" fill="#060a12"/>`;
    const grat = d3.geoGraticule().extent([[-30, 62], [-8, 68]]).step([2, 1]);
    svg += `<path d="${path(grat())}" fill="none" stroke="rgba(190,210,245,.07)"/>`;
    svg += `<path d="${path(geo)}" fill="#111a29" stroke="rgba(232,238,246,.55)" stroke-width="1"/>`;
    svg += `<g clip-path="url(#mclip)">`;
    const labels = [];
    for (const c of cont) {
      const lines = [];
      for (const poly of c.coordinates) for (const ring of poly) {
        const pts = ring.map(([x, y]) => [lon0 + x * dl, lat0 + y * dl]).filter(([lo, la]) => lo > lon0 + .15 && lo < lon1 - .15 && la > lat0 + .15 && la < lat1 - .15);
        if (pts.length > 1) lines.push(pts);
      }
      if (!lines.length) continue;
      const major = Number.isInteger(c.value);
      svg += `<path d="${path({ type: 'MultiLineString', coordinates: lines })}" fill="none" stroke="#5dffa0" stroke-opacity="${major ? .6 : .28}" stroke-width="${major ? 1.2 : .8}" stroke-dasharray="${major ? '5 4' : '2 5'}"/>`;
      // label near the western edge of the view
      const all = lines.flat().map(p => [proj(p), p]).filter(([xy]) => xy && xy[0] > 30 && xy[0] < W - 60 && xy[1] > 20 && xy[1] < H - 20);
      if (all.length && major) { all.sort((a, b) => a[0][0] - b[0][0]); labels.push([all[0][0], c.value]); }
    }
    svg += `</g>`;
    for (const [[x, y], v] of labels) svg += `<text x="${x + 4}" y="${y - 5}" fill="#5dffa0" fill-opacity=".85" font-family="JetBrains Mono, monospace" font-size="12">${v}° mag</text>`;
    SPOTS.forEach((s, i) => {
      const [x, y] = proj([s.lon, s.lat]);
      const anchor = x > W * 0.7 ? 'end' : 'start', dx = anchor === 'end' ? -10 : 10;
      svg += `<g class="spot" data-i="${i}" tabindex="0" role="button" aria-label="${s.name}" style="cursor:pointer">
        <circle cx="${x}" cy="${y}" r="16" fill="url(#spotglow)" opacity="0" class="halo"/>
        <circle cx="${x}" cy="${y}" r="4.5" fill="#e8eef6" stroke="#04060b" stroke-width="1.5"/>
        <text x="${x + dx}" y="${y + 4}" text-anchor="${anchor}" fill="#e8eef6" font-family="Figtree, sans-serif" font-size="13" font-weight="500" paint-order="stroke" stroke="#060a12" stroke-width="3">${s.name}</text></g>`;
    });
    const px100 = Math.abs(proj([-19, 65])[0] - proj([-21.125, 65])[0]); // 100 km along 65°N
    svg += `<line x1="${W - 16 - px100}" x2="${W - 16}" y1="${H - 26}" y2="${H - 26}" stroke="#9aa8bc" stroke-width="1.5"/>
      <line x1="${W - 16 - px100}" x2="${W - 16 - px100}" y1="${H - 30}" y2="${H - 22}" stroke="#9aa8bc"/><line x1="${W - 16}" x2="${W - 16}" y1="${H - 30}" y2="${H - 22}" stroke="#9aa8bc"/>
      <text x="${W - 16 - px100 / 2}" y="${H - 10}" text-anchor="middle" fill="#9aa8bc" font-family="JetBrains Mono, monospace" font-size="11">100 km</text>`;
    svg += `</svg>`;
    stage.innerHTML = svg;
    const select = (i) => {
      const s = SPOTS[i];
      const { mlat, mlt0 } = Astro.cgm(s.lat, s.lon);
      const kpNeed = Math.max(0, (66 - mlat) / 2);
      stage.querySelectorAll('.spot .halo').forEach((h, k) => h.setAttribute('opacity', k === i ? 1 : 0));
      info.innerHTML = `<span class="eyebrow">Viewing spot</span><h3>${s.name}</h3>
        <div class="meta">${s.where}<br>${s.lat.toFixed(2)}°N ${Math.abs(s.lon).toFixed(2)}°W · magnetic latitude ${mlat.toFixed(1)}°</div>
        <p>${s.text}</p>
        <div class="readouts" style="margin:6px -18px -18px;border-top:1px solid var(--line)">
          <div><span class="k">Oval overhead from</span><span class="v">Kp ${kpNeed < 0.25 ? '0' : (Math.round(kpNeed * 2) / 2).toFixed(1).replace('.0', '')}</span></div>
          <div><span class="k">Magnetic midnight</span><span class="v">${Astro.fmtHM(Astro.magMidnightUT(mlt0))}</span></div>
        </div>`;
    };
    stage.querySelectorAll('.spot').forEach(el => {
      el.addEventListener('click', () => select(+el.dataset.i));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(+el.dataset.i); } });
    });
    select(1);
  }

  // ---------- planner ----------
  function nightSeries(place, dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const start = Date.UTC(y, m - 1, d, 12, 0);
    const pts = [];
    for (let k = 0; k <= 288; k++) { // every 5 minutes for 24 h
      const t = new Date(start + k * 300000);
      pts.push({ h: 12 + k / 12, sun: Astro.sunAlt(t, place.lat, place.lon), moon: Astro.moonAlt(t, place.lat, place.lon) });
    }
    return { pts, start };
  }
  function darkClass(a) { return a > 0 ? 0 : a > -6 ? 1 : a > -12 ? 2 : a > -18 ? 3 : 4; }

  function drawNight(place, dateStr) {
    const el = document.getElementById('night-chart');
    const { pts, start } = nightSeries(place, dateStr);
    const W = 960, H = 300, x0 = 44, x1 = W - 16, y0 = 16, y1 = H - 34;
    const X = (h) => x0 + (h - 12) / 24 * (x1 - x0);
    const yMin = -55, yMax = 55;
    const Y = (a) => y1 - (a - yMin) / (yMax - yMin) * (y1 - y0);
    const shades = ['rgba(120,170,255,.16)', 'rgba(70,110,200,.13)', 'rgba(40,70,150,.12)', 'rgba(20,40,100,.1)', 'rgba(0,0,0,0)'];
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sun and Moon altitude over the night">`;
    // darkness strip
    for (let i = 0; i < pts.length - 1; i++) {
      const c = darkClass(pts[i].sun);
      svg += `<rect x="${X(pts[i].h).toFixed(1)}" y="${y0}" width="${(X(pts[i + 1].h) - X(pts[i].h) + .6).toFixed(1)}" height="${y1 - y0}" fill="${shades[c]}"/>`;
    }
    // aurora window 22-02
    svg += `<rect x="${X(22)}" y="${y0}" width="${X(26) - X(22)}" height="${y1 - y0}" fill="rgba(93,255,160,.06)" stroke="rgba(93,255,160,.25)" stroke-dasharray="3 4"/>`;
    svg += `<text x="${X(24)}" y="${y0 + 14}" text-anchor="middle" fill="#5dffa0" font-family="JetBrains Mono, monospace" font-size="10.5">BEST WINDOW 22–02</text>`;
    const { mlt0 } = Astro.cgm(place.lat, place.lon);
    let mm = Astro.magMidnightUT(mlt0); if (mm < 12) mm += 24;
    svg += `<line x1="${X(mm)}" x2="${X(mm)}" y1="${y0 + 20}" y2="${y1}" stroke="#5dffa0" stroke-width="1.2"/>`;
    svg += `<text x="${X(mm) + 5}" y="${y0 + 34}" fill="#bff5d6" font-family="JetBrains Mono, monospace" font-size="10.5">magnetic midnight ${Astro.fmtHM(mm)}</text>`;
    // horizon & reference lines
    for (const a of [-18, -12, -6, 0, 20, 40, -40]) {
      svg += `<line x1="${x0}" x2="${x1}" y1="${Y(a)}" y2="${Y(a)}" stroke="rgba(190,210,245,${a === 0 ? .35 : .08})"/>`;
      svg += `<text x="${x0 - 6}" y="${Y(a) + 3.5}" text-anchor="end" fill="#6c7a8f" font-family="JetBrains Mono, monospace" font-size="10">${a}°</text>`;
    }
    for (let h = 12; h <= 36; h += 2) svg += `<text x="${X(h)}" y="${H - 14}" text-anchor="middle" fill="#9aa8bc" font-family="JetBrains Mono, monospace" font-size="10.5">${String(h % 24).padStart(2, '0')}:00</text>`;
    const line = (key) => pts.map((p, i) => (i ? 'L' : 'M') + X(p.h).toFixed(1) + ' ' + Y(Math.max(yMin, Math.min(yMax, p[key]))).toFixed(1)).join('');
    svg += `<path d="${line('moon')}" fill="none" stroke="#c9d3e3" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    svg += `<path d="${line('sun')}" fill="none" stroke="#ffb23e" stroke-width="2"/>`;
    const midT = new Date(start + 12 * 3600000);
    const ill = Astro.moonIllum(midT);
    // labels for curves at their max within view
    const sMax = pts.reduce((a, b) => b.sun > a.sun ? b : a), mMax = pts.reduce((a, b) => b.moon > a.moon ? b : a);
    svg += `<text x="${Math.min(x1 - 40, X(sMax.h) + 6)}" y="${Math.max(y0 + 12, Y(Math.min(yMax, sMax.sun)) - 6)}" fill="#ffb23e" font-family="JetBrains Mono, monospace" font-size="10.5">SUN</text>`;
    svg += `<text x="${Math.min(x1 - 90, X(mMax.h) + 6)}" y="${Math.max(y0 + 12, Y(Math.min(yMax, mMax.moon)) - 6)}" fill="#c9d3e3" font-family="JetBrains Mono, monospace" font-size="10.5">MOON ${Math.round(ill.fraction * 100)}%</text>`;
    svg += `<text x="${x1}" y="${y1 + 13}" text-anchor="end" fill="#6c7a8f" font-family="JetBrains Mono, monospace" font-size="10">Iceland time = UTC</text>`;
    svg += `</svg>`;
    el.innerHTML = svg;

    // checks
    let darkMin = 0, moonDarkMin = 0;
    for (const p of pts) if (p.sun < -12) { darkMin += 5; if (p.moon > 0) moonDarkMin += 5; }
    const darkH = Math.floor(darkMin / 60), darkM = darkMin % 60;
    const moonShare = darkMin ? moonDarkMin / darkMin : 0;
    const moonBad = ill.fraction > 0.6 && moonShare > 0.5;
    const moonMeh = !moonBad && ill.fraction > 0.3 && moonShare > 0.3;
    const cards = [
      { cls: darkMin >= 180 ? 'ok' : darkMin > 0 ? 'meh' : 'bad', k: 'Darkness', v: darkMin ? `${darkH} h ${String(darkM).padStart(2, '0')} min of dark sky` : 'No proper darkness',
        p: darkMin ? 'Time with the Sun more than 12° below the horizon.' : 'The Sun never gets 12° below the horizon — the sky stays too bright.' },
      { cls: moonBad ? 'bad' : moonMeh ? 'meh' : 'ok', k: 'Moon', v: `${Math.round(ill.fraction * 100)}% lit · up ${Math.round(moonShare * 100)}% of the dark hours`,
        p: moonBad ? 'A bright Moon will wash out faint aurora; strong displays still shine through.' : 'Moonlight won\'t be much of a problem.' },
      { cls: 'ok', k: 'Peak hours', v: `Magnetic midnight ≈ ${Astro.fmtHM(mm)}`,
        p: 'Substorms are most likely in the hours around it. Be out from about 22:00.' },
      { cls: 'meh', k: 'Clouds & activity', v: 'Check on the day',
        p: 'Nobody can forecast these weeks ahead. Use the <a href="https://en.vedur.is/weather/forecasts/aurora/" target="_blank" rel="noopener">Met Office cloud map</a> and the Kp forecast.' }
    ];
    document.getElementById('checks').innerHTML = cards.map(c => `<div class="check ${c.cls}"><span class="k"><i></i>${c.k}</span><span class="v">${c.v}</span><p>${c.p}</p></div>`).join('');
  }

  function drawYear(place, dateStr) {
    const el = document.getElementById('year-chart');
    const [y, m, d] = dateStr.split('-').map(Number);
    const days = [];
    for (let k = 0; k < 365; k++) {
      const base = Date.UTC(y, 0, 1) + k * 86400000;
      let dark = 0;
      for (let i = 0; i < 144; i++) if (Astro.sunAlt(new Date(base + 12 * 3600000 + i * 600000), place.lat, place.lon) < -12) dark += 10;
      days.push(dark / 60);
    }
    const W = 560, H = 250, x0 = 34, x1 = W - 10, y0 = 14, y1 = H - 30;
    const maxH = 16;
    const X = (k) => x0 + k / 364 * (x1 - x0), Y = (h) => y1 - h / maxH * (y1 - y0);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hours of darkness per night through the year">`;
    for (const h of [0, 4, 8, 12, 16]) svg += `<line x1="${x0}" x2="${x1}" y1="${Y(h)}" y2="${Y(h)}" stroke="rgba(190,210,245,.08)"/><text x="${x0 - 6}" y="${Y(h) + 3.5}" text-anchor="end" fill="#6c7a8f" font-family="JetBrains Mono, monospace" font-size="10">${h}h</text>`;
    // no-darkness band
    let s = -1;
    for (let k = 0; k <= 365; k++) {
      const z = k < 365 && days[k] === 0;
      if (z && s < 0) s = k;
      if (!z && s >= 0) { svg += `<rect x="${X(s)}" y="${y0}" width="${X(k - 1) - X(s)}" height="${y1 - y0}" fill="rgba(255,178,62,.07)"/><text x="${(X(s) + X(k - 1)) / 2}" y="${y0 + 30}" text-anchor="middle" fill="#ffcf8a" font-family="JetBrains Mono, monospace" font-size="10">TOO</text><text x="${(X(s) + X(k - 1)) / 2}" y="${y0 + 43}" text-anchor="middle" fill="#ffcf8a" font-family="JetBrains Mono, monospace" font-size="10">BRIGHT</text>`; s = -1; }
    }
    const area = 'M' + X(0) + ' ' + Y(0) + days.map((h, k) => 'L' + X(k).toFixed(1) + ' ' + Y(h).toFixed(1)).join('') + 'L' + X(364) + ' ' + Y(0) + 'Z';
    svg += `<defs><linearGradient id="yg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5dffa0" stop-opacity=".35"/><stop offset="1" stop-color="#5dffa0" stop-opacity=".03"/></linearGradient></defs>`;
    svg += `<path d="${area}" fill="url(#yg)"/>`;
    svg += `<path d="${days.map((h, k) => (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(h).toFixed(1)).join('')}" fill="none" stroke="#5dffa0" stroke-width="1.6"/>`;
    const doy = (mm, dd) => Math.round((Date.UTC(y, mm - 1, dd) - Date.UTC(y, 0, 1)) / 86400000);
    for (const [mm, dd, lab] of [[3, 20, 'EQUINOX'], [9, 23, 'EQUINOX']]) {
      const k = doy(mm, dd);
      svg += `<line x1="${X(k)}" x2="${X(k)}" y1="${y0}" y2="${y1}" stroke="rgba(143,134,255,.6)" stroke-dasharray="3 4"/><text x="${X(k)}" y="${y0 + 8}" text-anchor="middle" fill="#b8b1ff" font-family="JetBrains Mono, monospace" font-size="9.5">${lab}</text>`;
    }
    const sel = Math.min(364, Math.max(0, doy(m, d)));
    svg += `<circle cx="${X(sel)}" cy="${Y(days[sel])}" r="4.5" fill="#e8eef6" stroke="#04060b" stroke-width="1.5"/>`;
    svg += `<text x="${Math.min(x1 - 4, Math.max(x0 + 4, X(sel)))}" y="${Y(days[sel]) - 10}" text-anchor="middle" fill="#e8eef6" font-family="JetBrains Mono, monospace" font-size="10.5">${days[sel].toFixed(1)} h</text>`;
    for (let mm = 0; mm < 12; mm++) svg += `<text x="${X(doy(mm + 1, 15))}" y="${H - 12}" text-anchor="middle" fill="#9aa8bc" font-family="JetBrains Mono, monospace" font-size="10">${MONTHS[mm][0]}</text>`;
    svg += `</svg>`;
    el.innerHTML = svg;
  }

  window.initPlanner = function () {
    const date = document.getElementById('p-date'), place = document.getElementById('p-place');
    const note = document.getElementById('p-note');
    let lastKey = '';
    const upd = () => {
      if (!date.value) return;
      const p = PLACES[place.value];
      drawNight(p, date.value);
      const key = place.value + date.value.slice(0, 4) + date.value;
      if (key !== lastKey) { drawYear(p, date.value); lastKey = key; }
      const { mlat } = Astro.cgm(p.lat, p.lon);
      note.textContent = `${p.name} · magnetic latitude ${mlat.toFixed(1)}°`;
    };
    date.addEventListener('change', upd); date.addEventListener('input', upd);
    place.addEventListener('change', upd);
    upd();
    initMap();
  };
})();
