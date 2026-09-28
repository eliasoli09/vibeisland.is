/* Chapter 2: the magnetosphere in the noon–midnight plane.
   Field lines are traced through Earth's dipole + a uniform solar-wind field
   (IMF Bz) + a simple tail current-sheet term that stretches the night side.
   This "open magnetosphere" superposition is the classic picture behind the
   Dungey (1961) cycle: with a southward IMF, X-type reconnection points appear
   on the day side and in the tail; with a northward IMF they move behind the
   cusps. Coordinates are in Earth radii; the Sun is to the left (-x). The night
   side is drawn with a mild stretch so the long tail fits on screen. */
(function () {
  const M = 1;
  const B0 = 1 / 343;       // |IMF| that puts the subsolar null at 7 Re, mapped to 8 nT
  const TAIL = 3 * B0;
  const XMIN = -12.5, XMAX = 10, ZMAX = 9.5;

  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function field(x, z, bz) {
    const r2 = x * x + z * z, r = Math.sqrt(r2), r5 = r2 * r2 * r;
    let bx = -3 * M * x * z / r5;
    let bzz = M * (r2 - 3 * z * z) / r5 + bz;
    bx += -TAIL * Math.tanh(z / 1.1) * smooth(-1.5, 5, x);
    return [bx, bzz];
  }

  function trace(x, z, dir, bz) {
    const pts = [[x, z]];
    let end = 'max';
    for (let i = 0; i < 2500; i++) {
      const r = Math.hypot(x, z);
      const h = Math.min(0.2, Math.max(0.015, 0.035 * r));
      let [bx, bb] = field(x, z, bz); let m = Math.hypot(bx, bb);
      if (m < 1e-12) { end = 'null'; break; }
      const mx = x + dir * 0.5 * h * bx / m, mz = z + dir * 0.5 * h * bb / m;
      [bx, bb] = field(mx, mz, bz); m = Math.hypot(bx, bb);
      if (m < 1e-12) { end = 'null'; break; }
      x += dir * h * bx / m; z += dir * h * bb / m;
      pts.push([x, z]);
      if (x * x + z * z < 1) { end = 'earth'; break; }
      if (x < XMIN || x > XMAX || Math.abs(z) > ZMAX) { end = 'out'; break; }
    }
    return { pts, end };
  }

  // stretch the night side so the tail X-line lands far down-tail
  const warp = (x) => x < 0 ? x : x + 0.23 * x * x / 7 * 1.25;

  class Magneto {
    constructor(canvas) {
      this.c = canvas; this.g = canvas.getContext('2d');
      this.south = true; this.nT = 8; this.t = 0;
      this.dots = []; this.flashes = []; this.sw = [];
      this.visible = false;
      new IntersectionObserver(es => es.forEach(e => this.visible = e.isIntersecting)).observe(canvas);
      new ResizeObserver(() => { this.resize(); }).observe(canvas);
      this.resize();
      this.rebuild();
      let last = performance.now();
      const loop = (now) => { const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; if (this.visible && !document.hidden) this.step(dt); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    get bz() { return (this.south ? -1 : 1) * B0 * this.nT / 8; }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.W = this.c.clientWidth; this.H = this.c.clientHeight;
      this.c.width = Math.round(this.W * dpr); this.c.height = Math.round(this.H * dpr);
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const spanX = warp(XMAX) - XMIN, spanZ = 2 * ZMAX;
      this.s = Math.min(this.W / spanX, this.H / spanZ);
      this.ox = (this.W - spanX * this.s) / 2 - XMIN * this.s;
      this.oy = this.H / 2;
      this.cacheValid = false;
    }
    X(x) { return this.ox + warp(x) * this.s; }
    Y(z) { return this.oy - z * this.s; }
    rebuild() {
      const bz = this.bz;
      const lines = [];
      // lines rooted in each hemisphere, day and night side
      for (const side of [-1, 1]) {
        for (let lat = 20; lat <= 86; lat += 3.3) {
          for (const hemi of [1, -1]) {
            const la = lat * Math.PI / 180;
            const x0 = side * Math.cos(la) * 1.001, z0 = hemi * Math.sin(la) * 1.001;
            const dir = hemi > 0 ? -1 : 1; // north: field points into Earth, so walk against it
            const tr = trace(x0, z0, dir, bz);
            if (tr.end === 'earth') { if (hemi > 0) lines.push({ kind: 'closed', pts: tr.pts }); }
            else lines.push({ kind: 'open', pts: tr.pts });
          }
        }
      }
      // solar-wind field lines entering from the top/bottom edges
      for (let x = XMIN + 0.5; x < XMAX; x += 1.1) {
        const zs = bz < 0 ? ZMAX - 0.01 : -ZMAX + 0.01;
        const tr = trace(x, zs, 1, bz);
        if (tr.end !== 'earth') lines.push({ kind: 'imf', pts: tr.pts });
      }
      this.lines = lines;
      // reconnection points
      const rN = Math.cbrt(M / Math.abs(bz));
      if (bz < 0) this.nulls = [[-rN, 0, 'Day-side reconnection'], [rN, 0, 'Tail reconnection']];
      else {
        let best = null;
        for (let x = -4; x <= 6; x += 0.05) for (let z = 3; z <= ZMAX - .3; z += 0.05) {
          const [a, b] = field(x, z, bz); const m = Math.hypot(a, b);
          if (!best || m < best[2]) best = [x, z, m];
        }
        this.nulls = [[best[0], best[1], 'Lobe reconnection'], [best[0], -best[1], '']];
      }
      this.rN = rN;
      this.cacheValid = false;
      this.buildPaths();
    }
    buildPaths() {
      const rN = this.rN;
      // plasma convection paths (model coordinates) for the southward case
      const up = [[-rN, 0.1], [-rN * 0.92, 2.4], [-rN * 0.55, 6.2], [0.5, 8.6], [4.5, 7.6], [rN * 0.95, 3.2], [rN, 0.25]];
      this.pathN = up; this.pathS = up.map(([x, z]) => [x, -z]);
    }
    along(path, u) {
      const n = path.length - 1, f = Math.min(n - 1e-6, Math.max(0, u * n)), i = Math.floor(f), t = f - i;
      const p0 = path[Math.max(0, i - 1)], p1 = path[i], p2 = path[i + 1], p3 = path[Math.min(n, i + 2)];
      const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
    }
    step(dt) {
      this.t += dt;
      const g = this.g, W = this.W, H = this.H;
      const rate = this.south ? 1 : 0.15;
      // solar wind particles
      for (let i = 0; i < 3; i++) if (Math.random() < 0.9) this.sw.push({ x: XMIN, z: (Math.random() * 2 - 1) * ZMAX, v: 5 + Math.random() * 2 });
      for (const p of this.sw) {
        const xs = -this.rN - 2.4 + 0.045 * p.z * p.z;
        if (p.x > xs - 0.3 && Math.abs(p.z) < 11) { p.z += Math.sign(p.z || 1) * p.v * 0.55 * dt; p.x += p.v * 0.75 * dt; }
        else p.x += p.v * dt;
      }
      this.sw = this.sw.filter(p => p.x < XMAX && Math.abs(p.z) < ZMAX);
      // magnetospheric convection (Dungey cycle)
      if (Math.random() < 2.2 * rate * dt * 10) {
        this.dots.push({ u: 0, n: Math.random() < .5, v: 0.13 + Math.random() * .05, phase: 'loop' });
      }
      for (const d of this.dots) {
        d.u += d.v * dt * (this.south ? 1 : .35);
        if (d.phase === 'loop' && d.u >= 1) {
          if (this.south) {
            d.phase = 'jet'; d.u = 0;
            d.L = 3.2 + Math.random() * Math.min(3.4, this.rN - 3.4);
            d.hemi = Math.random() < .5 ? 1 : -1;
          } else d.dead = true;
        } else if (d.phase === 'jet' && d.u >= 1) {
          d.dead = true;
          const lam = Math.acos(Math.sqrt(1 / d.L));
          this.flashes.push({ lam: lam * d.hemi, life: 1 });
        }
      }
      this.dots = this.dots.filter(d => !d.dead);
      for (const f of this.flashes) f.life -= dt * 0.8;
      this.flashes = this.flashes.filter(f => f.life > 0);
      this.draw();
    }
    posOf(d) {
      if (d.phase === 'loop') return this.along(d.n ? this.pathN : this.pathS, d.u);
      // earthward jet: along the equator to L, then down the dipole field line r = L cos^2(lat)
      const lamF = Math.acos(Math.sqrt(1 / d.L));
      if (d.u < 0.4) { const k = d.u / 0.4; return [this.rN + (d.L - this.rN) * k, 0]; }
      const k = (d.u - 0.4) / 0.6, lam = lamF * k * d.hemi, r = d.L * Math.cos(lam) ** 2;
      return [r * Math.cos(lam), r * Math.sin(lam)];
    }
    draw() {
      const g = this.g, W = this.W, H = this.H;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#04060b'; g.fillRect(0, 0, W, H);
      if (!this.cacheValid) this.cacheLines();
      g.drawImage(this.cache, 0, 0, W, H);
      // solar wind
      g.fillStyle = 'rgba(255,190,110,.55)';
      for (const p of this.sw) g.fillRect(this.X(p.x) - 1, this.Y(p.z) - .5, 2.2, 1.2);
      // convection dots
      g.globalCompositeOperation = 'lighter';
      for (const d of this.dots) {
        const [x, z] = this.posOf(d);
        const X = this.X(x), Y = this.Y(z);
        const jet = d.phase === 'jet';
        g.fillStyle = jet ? 'rgba(160,255,200,.95)' : 'rgba(140,220,255,.8)';
        g.beginPath(); g.arc(X, Y, jet ? 2.2 : 1.8, 0, 7); g.fill();
      }
      // X points
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 4);
      for (const [x, z, label] of this.nulls) {
        const X = this.X(x), Y = this.Y(z);
        const rg = g.createRadialGradient(X, Y, 0, X, Y, 16);
        rg.addColorStop(0, `rgba(255,255,255,${(this.south ? .85 : .5) * pulse})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(X, Y, 16, 0, 7); g.fill();
        g.globalCompositeOperation = 'source-over';
        if (label) {
          g.font = '500 10.5px "JetBrains Mono", monospace';
          g.fillStyle = 'rgba(232,238,246,.85)';
          g.textAlign = 'center';
          g.fillText(label.toUpperCase(), X, Y + 26);
        }
        g.globalCompositeOperation = 'lighter';
      }
      // Earth + aurora
      g.globalCompositeOperation = 'source-over';
      const EX = this.X(0), EY = this.Y(0), R = this.s;
      const eg = g.createLinearGradient(EX - R, 0, EX + R, 0);
      eg.addColorStop(0, '#5aa6ff'); eg.addColorStop(.5, '#1d4f8f'); eg.addColorStop(.5, '#0b1a33'); eg.addColorStop(1, '#081226');
      g.fillStyle = eg; g.beginPath(); g.arc(EX, EY, R, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter';
      const base = this.south ? 0.35 : 0.12;
      for (const hemi of [1, -1]) {
        let a = base;
        for (const f of this.flashes) if (Math.sign(f.lam) === hemi) a += f.life * 0.35;
        a = Math.min(1.4, a);
        const lam = (this.south ? 67 : 76) * Math.PI / 180;
        const px = EX + R * Math.cos(lam) * (this.south ? 1 : 0.4), py = EY - hemi * R * Math.sin(lam);
        const rg = g.createRadialGradient(px, py, 0, px, py, R * 0.9);
        rg.addColorStop(0, `rgba(93,255,160,${Math.min(1, a)})`); rg.addColorStop(1, 'rgba(93,255,160,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(px, py, R * .9, 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.font = '500 10.5px "JetBrains Mono", monospace'; g.textAlign = 'left';
      g.fillStyle = 'rgba(255,190,110,.9)';
      g.fillText('SOLAR WIND →', 12, H - 14);
      g.textAlign = 'right'; g.fillStyle = 'rgba(154,168,188,.9)';
      g.fillText('MAGNETOTAIL →', W - 12, H - 14);
    }
    cacheLines() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!this.cache) this.cache = document.createElement('canvas');
      const c = this.cache; c.width = this.c.width; c.height = this.c.height;
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, this.W, this.H);
      const col = { closed: 'rgba(106,168,255,.55)', open: 'rgba(93,255,160,.6)', imf: 'rgba(255,178,62,.45)' };
      g.lineWidth = 1.1; g.lineJoin = 'round';
      for (const L of this.lines) {
        g.strokeStyle = col[L.kind];
        g.beginPath();
        L.pts.forEach(([x, z], i) => { const X = this.X(x), Y = this.Y(z); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke();
      }
      // bow shock
      g.setLineDash([4, 5]); g.strokeStyle = 'rgba(255,178,62,.5)'; g.lineWidth = 1.2;
      g.beginPath();
      for (let z = -ZMAX; z <= ZMAX; z += .25) { const x = -this.rN - 2.4 + 0.045 * z * z; const X = this.X(x), Y = this.Y(z); z === -ZMAX ? g.moveTo(X, Y) : g.lineTo(X, Y); }
      g.stroke(); g.setLineDash([]);
      g.font = '500 10.5px "JetBrains Mono", monospace'; g.fillStyle = 'rgba(255,178,62,.8)'; g.textAlign = 'left';
      g.fillText('BOW SHOCK', this.X(-this.rN - 2.4 + 0.045 * 49) + 6, this.Y(7));
      this.cacheValid = true;
    }
    set(opts) { Object.assign(this, opts); this.rebuild(); }
  }

  window.initMagneto = function () {
    const m = new Magneto(document.getElementById('mag-canvas'));
    (window.__nl = window.__nl || {}).mag = m;
    const status = document.getElementById('mag-status');
    const upd = () => {
      status.textContent = m.south ? `Reconnection: fast` : `Reconnection: weak`;
      document.getElementById('imf-south').setAttribute('aria-pressed', String(m.south));
      document.getElementById('imf-north').setAttribute('aria-pressed', String(!m.south));
      document.getElementById('imf-str-val').textContent = m.nT + ' nT';
    };
    document.getElementById('imf-south').addEventListener('click', () => { m.set({ south: true }); upd(); });
    document.getElementById('imf-north').addEventListener('click', () => { m.set({ south: false }); upd(); });
    const sl = document.getElementById('imf-str');
    sl.addEventListener('input', () => { m.set({ nT: +sl.value }); upd(); });
    upd();
  };
})();
