/* Chapter 3: electrons entering the upper atmosphere.
   - Peak energy-deposition altitude vs electron energy: approximate values from
     standard deposition models (Rees 1963; Fang et al. 2010), consistent with
     the finding that electrons below ~4 keV peak above ~110 km.
   - Composition: approximate mid-activity MSIS number densities.
   - Emission: O(1S) 557.7 nm (lifetime ~0.7 s) and O(1D) 630.0 nm (~110 s) are
     emitted only if the atom is not quenched by a collision first; N2+ 427.8 /
     391.4 nm and N2 first-positive red bands are prompt. Quenching rates are
     tuned to the observed behaviour: red 630 nm lifetimes drop from ~100 s at
     350 km to ~20 s at 200 km (Tsuda et al. 2020); green is quenched below ~100 km. */
(function () {
  const H0 = 60, H1 = 440;
  const DEPO = [[0.1, 230], [0.3, 185], [0.5, 165], [1, 145], [2, 128], [4, 115], [10, 105], [30, 92], [100, 80]];
  const DENS = [ // km, N2, O2, O  (cm^-3)
    [60, 5.4e15, 1.4e15, 1e10], [80, 3.2e14, 8.6e13, 1e11], [90, 5.5e13, 1.5e13, 2.5e11], [100, 9e12, 2e12, 4.5e11],
    [110, 1.6e12, 3e11, 2e11], [120, 4e11, 6e10, 9e10], [150, 3e10, 2.5e9, 1.8e10], [200, 2.6e9, 1.5e8, 4e9],
    [250, 4e8, 1.5e7, 1.5e9], [300, 8e7, 2.5e6, 7e8], [350, 1.8e7, 5e5, 3.2e8], [400, 4e6, 1e5, 1.5e8], [450, 1e6, 2.5e4, 7e7]];
  const lerpLog = (tab, x, col) => {
    for (let i = 0; i < tab.length - 1; i++) if (x <= tab[i + 1][0] || i === tab.length - 2) {
      const a = tab[i], b = tab[i + 1], t = (x - a[0]) / (b[0] - a[0]);
      return Math.exp(Math.log(a[col]) * (1 - t) + Math.log(b[col]) * t);
    }
  };
  const dens = (h) => ({ n2: lerpLog(DENS, h, 1), o2: lerpLog(DENS, h, 2), o: lerpLog(DENS, h, 3) });
  function peakAlt(E) {
    const lx = Math.log(E);
    for (let i = 0; i < DEPO.length - 1; i++) {
      const a = DEPO[i], b = DEPO[i + 1];
      if (E <= b[0] || i === DEPO.length - 2) { const t = (lx - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0])); return a[1] + (b[1] - a[1]) * t; }
    }
  }
  const speed = (EkeV) => { const g = 1 + EkeV / 511; return 299792 * Math.sqrt(1 - 1 / (g * g)); };
  const pRed = (h) => { const A = 1 / 110, q = 0.041 * Math.exp(-(h - 200) / 35); return A / (A + q); };
  const pGreen = (h) => { const A = 1.35, q = 1.35 * Math.exp(-(h - 97) / 5); return A / (A + q); };
  // energy deposition profile: sharp below the peak, long tail above
  const depo = (h, hp) => h < hp ? Math.exp(-(((h - hp) / 5.5) ** 2)) : Math.exp(-(h - hp) / (10 + (hp - 75) * 0.28));

  function yields(h) {
    const d = dens(h), tot = d.n2 + d.o2 + d.o;
    const fO = d.o / tot, fN = d.n2 / tot;
    return {
      red: fO * 1.6 * pRed(h),
      green: (0.35 * fO + 0.5 * fN) * 0.9 * pGreen(h),
      blue: fN * 0.14,
      pink: fN * 0.3
    };
  }
  function spectrum(E) {
    const hp = peakAlt(E);
    const s = { red: 0, green: 0, blue: 0, pink: 0 };
    for (let h = H0; h <= H1; h += 1) {
      const w = depo(h, hp), y = yields(h);
      for (const k in s) s[k] += w * y[k];
    }
    return s;
  }

  const COL = { red: [255, 70, 90], green: [93, 255, 160], blue: [143, 134, 255], pink: [255, 114, 207] };

  class Atmos {
    constructor(canvas) {
      this.c = canvas; this.g = canvas.getContext('2d');
      this.E = 5; this.t = 0; this.es = []; this.atoms = []; this.photons = [];
      this.bins = new Float32Array((H1 - H0) * 4);
      this.visible = false;
      new IntersectionObserver(es => es.forEach(e => this.visible = e.isIntersecting)).observe(canvas);
      new ResizeObserver(() => this.resize()).observe(canvas);
      this.resize();
      let last = performance.now();
      const loop = (now) => { const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; if (this.visible && !document.hidden) this.step(dt); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.W = this.c.clientWidth; this.H = this.c.clientHeight;
      this.c.width = Math.round(this.W * dpr); this.c.height = Math.round(this.H * dpr);
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.top = 58; this.bot = this.H - 26;
      this.axisX = 46;
      this.beamX = this.axisX + (this.W - this.axisX) * 0.36;
      this.colX = this.axisX + (this.W - this.axisX) * 0.62;
      this.densX0 = this.axisX + (this.W - this.axisX) * 0.74;
    }
    Y(h) { return this.bot - (h - H0) / (H1 - H0) * (this.bot - this.top); }
    setEnergy(E) { this.E = E; }
    step(dt) {
      this.t += dt;
      const hp = peakAlt(this.E);
      // spawn electrons
      const n = 26 * dt;
      for (let i = 0; i < n; i++) if (Math.random() < n - i) {
        let stop;
        for (let k = 0; k < 20; k++) { const h = H0 + Math.random() * (H1 - H0); if (Math.random() < depo(h, hp)) { stop = h; break; } }
        if (stop === undefined) stop = hp;
        this.es.push({ h: H1 + 5, x: (Math.random() - .5) * 60, ph: Math.random() * 6.28, stop, next: stop + 6 + Math.random() * 60 });
      }
      const vis = 150 + Math.log10(this.E * 10) * 60; // km per second on screen
      for (const e of this.es) {
        e.h -= vis * dt; e.ph += dt * 9;
        if (e.h <= e.next && e.next > e.stop) { this.excite(e.next, e.x); e.next -= 12 + Math.random() * 40; }
        if (e.h <= e.stop) { e.done = true; for (let k = 0; k < 3; k++) this.excite(e.stop + Math.random() * 4, e.x); }
      }
      this.es = this.es.filter(e => !e.done);
      // excited atoms: wait, then emit or get quenched (time compressed: 1 s shown = 36 s real for red)
      for (const a of this.atoms) {
        a.age += dt;
        if (a.age >= a.tq) { a.dead = true; this.photons.push({ h: a.h, x: a.x, kind: 'quench', life: .6 }); }
        else if (a.age >= a.te) { a.dead = true; this.emit(a.kind, a.h, a.x); }
      }
      this.atoms = this.atoms.filter(a => !a.dead);
      for (const p of this.photons) p.life -= dt;
      this.photons = this.photons.filter(p => p.life > 0);
      const decay = Math.exp(-dt * 0.5);
      for (let i = 0; i < this.bins.length; i++) this.bins[i] *= decay;
      this.draw();
    }
    excite(h, x) {
      const y = yields(h);
      const d = dens(h), tot = d.n2 + d.o2 + d.o;
      const fO = d.o / tot, fN = d.n2 / tot;
      const r = Math.random() * (fO + fN + 0.25);
      const jitter = (Math.random() - .5) * 22;
      if (r < fO * 0.55) { // O(1D) -> red, slow
        const A = 1 / 110, q = 0.041 * Math.exp(-(h - 200) / 35);
        const te = -Math.log(Math.random()) / A, tq = -Math.log(Math.random()) / q;
        this.atoms.push({ kind: 'red', h, x: x + jitter, age: 0, te: te / 36, tq: tq / 36 });
      } else if (r < fO * 0.55 + (fO * .45 + fN * .5) * 0.6) { // O(1S) -> green
        const A = 1.35, q = 1.35 * Math.exp(-(h - 97) / 5);
        const te = -Math.log(Math.random()) / A, tq = -Math.log(Math.random()) / q;
        this.atoms.push({ kind: 'green', h, x: x + jitter, age: 0, te: te * .6, tq: tq * .6 });
      } else if (r < fO + fN) {
        this.emit(Math.random() < 0.45 ? 'blue' : 'pink', h, x + jitter);
      }
    }
    emit(kind, h, x) {
      this.photons.push({ h, x, kind, life: 1 });
      const bi = Math.round(h - H0);
      if (bi >= 0 && bi < H1 - H0) {
        const k = { red: 0, green: 1, blue: 2, pink: 3 }[kind];
        const w = kind === 'red' ? 1.6 : 1; // red emission is spread over a larger volume
        for (let d = -4; d <= 4; d++) { const j = bi + d; if (j >= 0 && j < H1 - H0) this.bins[j * 4 + k] += w * Math.exp(-d * d / 8) * 0.35; }
      }
    }
    draw() {
      const g = this.g, W = this.W, H = this.H;
      g.globalCompositeOperation = 'source-over';
      // air: denser (brighter haze) lower down
      const bg = g.createLinearGradient(0, this.top, 0, this.bot);
      bg.addColorStop(0, '#03050a'); bg.addColorStop(.7, '#060a14'); bg.addColorStop(1, '#0c1628');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // altitude grid
      g.font = '400 10.5px "JetBrains Mono", monospace'; g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let h = 100; h <= 400; h += 50) {
        const y = this.Y(h);
        g.strokeStyle = 'rgba(190,210,245,.08)'; g.beginPath(); g.moveTo(this.axisX + 6, y); g.lineTo(W - 8, y); g.stroke();
        g.fillStyle = 'rgba(154,168,188,.9)'; g.fillText(h + ' km', this.axisX + 2, y);
      }
      // ISS line
      const yI = this.Y(420);
      g.setLineDash([2, 4]); g.strokeStyle = 'rgba(232,238,246,.3)'; g.beginPath(); g.moveTo(this.axisX + 6, yI); g.lineTo(W - 8, yI); g.stroke(); g.setLineDash([]);
      g.textAlign = 'left'; g.fillStyle = 'rgba(232,238,246,.6)'; g.fillText('ISS orbit ~420 km', this.axisX + 10, yI - 9);
      // mesopause
      const yM = this.Y(88);
      g.fillStyle = 'rgba(154,168,188,.55)'; g.fillText('mesopause ~85–90 km', this.axisX + 10, yM + 12);
      g.strokeStyle = 'rgba(190,210,245,.12)'; g.beginPath(); g.moveTo(this.axisX + 6, yM); g.lineTo(W - 8, yM); g.stroke();

      // composition curves (log density)
      const x0 = this.densX0, x1 = W - 14;
      const lx = (n) => x0 + (Math.log10(n) - 6) / (14 - 6) * (x1 - x0);
      g.strokeStyle = 'rgba(190,210,245,.14)'; g.beginPath(); g.moveTo(x0, this.top); g.lineTo(x0, this.bot); g.stroke();
      const curve = (key, color) => {
        g.strokeStyle = color; g.lineWidth = 1.4; g.beginPath();
        for (let h = H0; h <= H1; h += 2) { const d = dens(h)[key]; const X = Math.max(x0, Math.min(x1, lx(d))); const Y = this.Y(h); h === H0 ? g.moveTo(X, Y) : g.lineTo(X, Y); }
        g.stroke(); g.lineWidth = 1;
      };
      curve('n2', 'rgba(143,134,255,.85)'); curve('o', 'rgba(93,255,160,.85)');
      g.fillStyle = 'rgba(143,134,255,.95)'; g.textAlign = 'left';
      g.fillText('N₂', Math.min(x1 - 18, lx(dens(300).n2) + 4), this.Y(300));
      g.fillStyle = 'rgba(93,255,160,.95)';
      g.fillText('O', Math.min(x1 - 10, lx(dens(330).o) + 4), this.Y(330));
      g.fillStyle = 'rgba(154,168,188,.8)'; g.textAlign = 'center';
      g.fillText('gas density', (x0 + x1) / 2, this.top - 20);
      g.fillText('(log scale)', (x0 + x1) / 2, this.top - 7);

      // accumulated glow column
      g.globalCompositeOperation = 'lighter';
      const cw = Math.max(26, (this.densX0 - this.colX) * 0.55);
      for (let i = 0; i < H1 - H0; i += 2) {
        const y = this.Y(H0 + i);
        let r = 0, gg = 0, b = 0;
        const add = (k, c) => { const v = Math.min(1.4, this.bins[i * 4 + k]); r += c[0] * v; gg += c[1] * v; b += c[2] * v; };
        add(0, COL.red); add(1, COL.green); add(2, COL.blue); add(3, COL.pink);
        if (r + gg + b < 2) continue;
        g.fillStyle = `rgba(${Math.min(255, r) | 0},${Math.min(255, gg) | 0},${Math.min(255, b) | 0},.55)`;
        g.fillRect(this.colX - cw / 2, y - 2, cw, 3);
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(154,168,188,.8)'; g.textAlign = 'center';
      g.fillText('glow seen', this.colX, this.top - 20);
      g.fillText('side-on', this.colX, this.top - 7);
      g.fillText('electrons', this.beamX, this.top - 14);

      // field line guide
      g.strokeStyle = 'rgba(106,168,255,.18)'; g.setLineDash([3, 6]);
      g.beginPath(); g.moveTo(this.beamX, this.top); g.lineTo(this.beamX, this.bot); g.stroke(); g.setLineDash([]);

      // electrons spiralling down the field line
      g.globalCompositeOperation = 'lighter';
      for (const e of this.es) {
        const X = this.beamX + e.x * 0.35 + Math.sin(e.ph) * 6, Y = this.Y(e.h);
        g.fillStyle = 'rgba(200,230,255,.9)'; g.beginPath(); g.arc(X, Y, 1.6, 0, 7); g.fill();
        g.strokeStyle = 'rgba(200,230,255,.25)'; g.beginPath(); g.moveTo(X, Y); g.lineTo(X - Math.cos(e.ph) * 3, Y - 10); g.stroke();
      }
      // waiting excited atoms (hollow rings)
      for (const a of this.atoms) {
        const X = this.beamX + a.x, Y = this.Y(a.h);
        const c = COL[a.kind];
        g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},.55)`;
        g.beginPath(); g.arc(X, Y, 2.6 + Math.sin(a.age * 8) * .6, 0, 7); g.stroke();
      }
      // photons and quenches
      for (const p of this.photons) {
        const X = this.beamX + p.x, Y = this.Y(p.h);
        if (p.kind === 'quench') {
          g.globalCompositeOperation = 'source-over';
          g.strokeStyle = `rgba(154,168,188,${p.life})`; g.lineWidth = 1;
          g.beginPath(); g.moveTo(X - 3, Y - 3); g.lineTo(X + 3, Y + 3); g.moveTo(X + 3, Y - 3); g.lineTo(X - 3, Y + 3); g.stroke();
          g.globalCompositeOperation = 'lighter';
          continue;
        }
        const c = COL[p.kind], r = 3 + (1 - p.life) * 9;
        const rg = g.createRadialGradient(X, Y, 0, X, Y, r);
        rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${p.life})`); rg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        g.fillStyle = rg; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // peak marker
      const yp = this.Y(peakAlt(this.E));
      g.strokeStyle = 'rgba(232,238,246,.5)'; g.beginPath(); g.moveTo(this.beamX - 40, yp); g.lineTo(this.beamX - 26, yp); g.stroke();
      g.textAlign = 'right'; g.fillStyle = 'rgba(232,238,246,.8)'; g.fillText('stop ▸', this.beamX - 42, yp);
      // legend
      g.textAlign = 'left'; g.font = '400 10px "JetBrains Mono", monospace';
      g.fillStyle = 'rgba(154,168,188,.85)';
      g.fillText('○ excited atom waiting   × quenched (energy lost, no light)', this.axisX + 10, H - 10);
    }
  }

  function wlColor(nm) {
    const c = { 391.4: '#b28cff', 427.8: '#8f86ff', 557.7: '#5dffa0', 630: '#ff5268', 636.4: '#ff5268' };
    if (c[nm]) return c[nm];
    return '#ff6a8a';
  }

  function drawSpectrum(el, E) {
    const s = spectrum(E);
    const lines = [
      { nm: 391.4, v: s.blue * 3.3, lab: '391.4' },
      { nm: 427.8, v: s.blue, lab: '427.8' },
      { nm: 557.7, v: s.green, lab: '557.7' },
      { nm: 630.0, v: s.red, lab: '630.0' },
      { nm: 636.4, v: s.red / 3.1, lab: '' },
      ...[654.5, 662.4, 670.5, 678.9, 687.5].map((nm, i) => ({ nm, v: s.pink * (0.28 - i * 0.03), lab: i === 2 ? 'N₂ bands' : '' }))
    ];
    const max = Math.max(...lines.map(l => l.v));
    const W = 560, H = 160, x0 = 18, x1 = W - 12, y0 = 34, y1 = H - 28;
    const X = (nm) => x0 + (nm - 380) / (700 - 380) * (x1 - x0);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Relative brightness of auroral emission lines"><defs><linearGradient id="vis" x1="0" x2="1">`;
    const stops = [[380, '#3b1c6b'], [430, '#2b2a8f'], [480, '#1f5c8f'], [520, '#1f7a4f'], [570, '#6f7a1f'], [600, '#8f5a1f'], [650, '#8f1f2b'], [700, '#4a0f16']];
    for (const [nm, c] of stops) svg += `<stop offset="${((nm - 380) / 320).toFixed(3)}" stop-color="${c}"/>`;
    svg += `</linearGradient></defs>`;
    svg += `<rect x="${x0}" y="${y1 + 4}" width="${x1 - x0}" height="5" rx="2" fill="url(#vis)" opacity=".9"/>`;
    for (const l of lines) {
      const h = Math.max(1.5, (l.v / max) * (y1 - y0));
      const col = l.nm > 640 ? '#ff6a8a' : wlColor(l.nm);
      svg += `<rect x="${(X(l.nm) - 2).toFixed(1)}" y="${(y1 - h).toFixed(1)}" width="4" height="${h.toFixed(1)}" fill="${col}"/>`;
      if (l.lab) svg += `<text x="${X(l.nm).toFixed(1)}" y="${(y1 - h - 5).toFixed(1)}" text-anchor="middle" fill="#9aa8bc" font-family="JetBrains Mono, monospace" font-size="10">${l.lab}</text>`;
    }
    for (const nm of [400, 450, 500, 550, 600, 650, 700]) svg += `<text x="${X(nm)}" y="${H - 6}" text-anchor="middle" fill="#6c7a8f" font-family="JetBrains Mono, monospace" font-size="10">${nm}</text>`;
    svg += `<text x="${x0}" y="11" text-anchor="start" fill="#9aa8bc" font-family="JetBrains Mono, monospace" font-size="10">RELATIVE BRIGHTNESS · WAVELENGTH (nm)</text></svg>`;
    el.innerHTML = svg;
    const ranking = [['Red (630 nm)', s.red], ['Green (557.7 nm)', s.green], ['Blue-violet (N₂⁺)', s.blue * 1.2]].sort((a, b) => b[1] - a[1]);
    let dom = ranking[0][0].split(' (')[0];
    if (dom === 'Green' && s.pink > s.green * 0.9) dom = 'Green + pink edge';
    if (dom === 'Green' && s.red > s.green * 0.5) dom = 'Green + red';
    if (dom === 'Red' && s.green > s.red * 0.5) dom = 'Red + green';
    return dom;
  }

  window.initAtmos = function () {
    const a = new Atmos(document.getElementById('atm-canvas'));
    (window.__nl = window.__nl || {}).atmos = a;
    const sl = document.getElementById('e-energy');
    const spec = document.getElementById('spectrum');
    const upd = () => {
      const E = 0.1 * Math.pow(10, 3 * sl.value / 1000);
      a.setEnergy(E);
      document.getElementById('e-energy-val').textContent = (E < 1 ? E.toFixed(2) : E < 10 ? E.toFixed(1) : Math.round(E)) + ' keV';
      document.getElementById('ro-ev').innerHTML = Math.round(speed(E) / 100) * 100 >= 1000 ? (Math.round(speed(E) / 100) * 100).toLocaleString('en-US') + ' <small>km/s</small>' : Math.round(speed(E)) + ' <small>km/s</small>';
      document.getElementById('ro-ealt').innerHTML = Math.round(peakAlt(E)) + ' <small>km</small>';
      document.getElementById('ro-ecol').textContent = drawSpectrum(spec, E);
    };
    sl.addEventListener('input', upd);
    upd();
  };
  window.AtmosModel = { peakAlt, speed, spectrum };
})();
