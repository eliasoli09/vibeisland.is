/* Chapter 1: solar wind from the Sun to Earth (2D canvas, not to scale). */
(function () {
  const AU = 149.6e6, L1 = 1.5e6; // km

  function makeSunTexture(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const r = size / 2;
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, '#fff6d8');
    grd.addColorStop(0.55, '#ffd27a');
    grd.addColorStop(0.85, '#ff9a2e');
    grd.addColorStop(1, '#e0561a');
    g.fillStyle = grd;
    g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    // granulation
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < size * 6; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d;
      const s = 1 + Math.random() * size * 0.012;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,250,220,.10)' : 'rgba(150,50,0,.10)';
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
    // a few sunspot groups
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * Math.PI * 2, d = (0.25 + Math.random() * 0.5) * r;
      const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d * 0.6;
      for (let j = 0; j < 3; j++) {
        const s = size * (0.006 + Math.random() * 0.01);
        g.fillStyle = 'rgba(120,40,0,.55)';
        g.beginPath(); g.arc(x + j * s * 2.2, y + (Math.random() - .5) * s * 2, s * 1.6, 0, 7); g.fill();
        g.fillStyle = 'rgba(40,10,0,.8)';
        g.beginPath(); g.arc(x + j * s * 2.2, y + (Math.random() - .5) * s, s * .8, 0, 7); g.fill();
      }
    }
    // limb darkening
    const ld = g.createRadialGradient(r, r, r * 0.55, r, r, r);
    ld.addColorStop(0, 'rgba(0,0,0,0)');
    ld.addColorStop(1, 'rgba(90,20,0,.55)');
    g.fillStyle = ld; g.fillRect(0, 0, size, size);
    return c;
  }

  class SunWind {
    constructor(canvas) {
      this.c = canvas; this.g = canvas.getContext('2d');
      this.speed = 420; this.parts = []; this.cmes = []; this.hit = 0; this.squeeze = 0;
      this.stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()]);
      this.sunTex = makeSunTexture(512);
      this.visible = false; this.t = 0;
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
      this.layout();
    }
    layout() {
      const W = this.W, H = this.H;
      this.sun = { x: -H * 0.12, y: H * 0.5, r: H * 0.46 };
      this.earth = { x: W * 0.87, y: H * 0.5, r: Math.max(7, H * 0.032) };
      this.l1 = { x: W * 0.87 - Math.max(46, W * 0.085), y: H * 0.5 };
    }
    visSpeed(v) { return (this.W / 900) * (55 + (v - 250) / 2750 * 520); }
    spawn(v, cme) {
      const s = this.sun;
      const a = (Math.random() - 0.5) * (cme ? cme.width * 2 : 1.9);
      const r0 = s.r * (1.02 + Math.random() * .05);
      this.parts.push({ a, r: r0, v: this.visSpeed(v) * (0.85 + Math.random() * .3), life: 0, cme: !!cme, w: cme ? 1.6 : 1 });
    }
    launchCME(v) {
      this.cmes.push({ r: this.sun.r * 1.02, v: this.visSpeed(v), width: 0.42 + Math.random() * .12, a0: (Math.random() - .5) * 0.12, hitDone: false, t: 0 });
    }
    step(dt) {
      this.t += dt;
      const s = this.sun, E = this.earth;
      const rate = 60 + this.speed * 0.05;
      const n = rate * dt;
      for (let i = 0; i < n; i++) if (Math.random() < n - i) this.spawn(this.speed);
      for (const c of this.cmes) {
        c.t += dt; c.r += c.v * dt;
        if (c.t < 1.2) for (let i = 0; i < 14; i++) this.spawn(this.speed, c);
        const dE = Math.hypot(E.x - s.x, E.y - s.y);
        if (!c.hitDone && c.r > dE - E.r * 4) { c.hitDone = true; this.hit = 1; this.squeeze = 1; }
      }
      this.cmes = this.cmes.filter(c => c.r < this.W * 2);
      for (const p of this.parts) { p.r += p.v * dt; p.life += dt; }
      this.parts = this.parts.filter(p => p.r < this.W * 1.6);
      this.hit *= Math.exp(-dt * 0.5);
      this.squeeze *= Math.exp(-dt * 0.8);
      this.draw();
    }
    draw() {
      const g = this.g, W = this.W, H = this.H, s = this.sun, E = this.earth;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#04060b'; g.fillRect(0, 0, W, H);
      for (const [x, y, b] of this.stars) { g.fillStyle = `rgba(220,230,255,${0.15 + b * 0.5})`; g.fillRect(x * W, y * H, b > .85 ? 1.6 : 1, b > .85 ? 1.6 : 1); }
      // corona + streamers
      g.globalCompositeOperation = 'lighter';
      const cg = g.createRadialGradient(s.x, s.y, s.r * .9, s.x, s.y, s.r * 2.3);
      cg.addColorStop(0, 'rgba(255,190,90,.40)'); cg.addColorStop(.35, 'rgba(255,150,60,.10)'); cg.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(s.x, s.y, s.r * 2.3, 0, 7); g.fill();
      for (let k = 0; k < 9; k++) {
        const a = -1.1 + k * 0.28 + Math.sin(this.t * .1 + k) * .03;
        const len = s.r * (1.5 + (k % 3) * .35);
        const grd = g.createLinearGradient(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, s.x + Math.cos(a) * len, s.y + Math.sin(a) * len);
        grd.addColorStop(0, 'rgba(255,200,120,.16)'); grd.addColorStop(1, 'rgba(255,200,120,0)');
        g.strokeStyle = grd; g.lineWidth = s.r * 0.07; g.lineCap = 'round';
        g.beginPath(); g.moveTo(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r); g.lineTo(s.x + Math.cos(a) * len, s.y + Math.sin(a) * len); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(s.x, s.y); g.rotate(this.t * 0.01);
      g.drawImage(this.sunTex, -s.r, -s.r, s.r * 2, s.r * 2); g.restore();
      // CME shells
      g.globalCompositeOperation = 'lighter';
      for (const c of this.cmes) {
        const fade = Math.max(0, 1 - c.r / (W * 1.4));
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = `rgba(255,${170 + k * 20},${90 + k * 30},${(0.28 - k * .07) * fade})`;
          g.lineWidth = 10 - k * 3;
          g.beginPath(); g.arc(s.x, s.y, c.r - k * 8, c.a0 - c.width, c.a0 + c.width); g.stroke();
        }
      }
      // particles
      for (const p of this.parts) {
        const x = s.x + Math.cos(p.a) * p.r, y = s.y + Math.sin(p.a) * p.r;
        const tl = Math.min(22, p.v * 0.045);
        const x2 = x - Math.cos(p.a) * tl, y2 = y - Math.sin(p.a) * tl;
        const alpha = Math.min(1, p.life * 2) * (p.cme ? .75 : .45);
        g.strokeStyle = p.cme ? `rgba(255,200,130,${alpha})` : `rgba(255,226,180,${alpha})`;
        g.lineWidth = p.w;
        g.beginPath(); g.moveTo(x2, y2); g.lineTo(x, y); g.stroke();
      }
      // Earth's magnetosphere bubble (particles pass "around" it visually)
      const stand = E.r * (3.2 - 1.1 * this.squeeze - Math.min(.6, (this.speed - 400) / 2600));
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(4,6,11,.88)';
      g.beginPath();
      g.moveTo(E.x - stand, E.y);
      g.bezierCurveTo(E.x - stand, E.y - stand * 1.4, E.x + stand * .6, E.y - stand * 1.7, E.x + W, E.y - stand * 1.9);
      g.lineTo(E.x + W, E.y + stand * 1.9);
      g.bezierCurveTo(E.x + stand * .6, E.y + stand * 1.7, E.x - stand, E.y + stand * 1.4, E.x - stand, E.y);
      g.fill();
      g.strokeStyle = 'rgba(106,168,255,.55)'; g.lineWidth = 1.2; g.stroke();
      // Earth
      const eg = g.createRadialGradient(E.x - E.r * .5, E.y - E.r * .3, E.r * .1, E.x, E.y, E.r);
      eg.addColorStop(0, '#9fd0ff'); eg.addColorStop(.6, '#2c6fb8'); eg.addColorStop(1, '#0c2140');
      g.fillStyle = eg; g.beginPath(); g.arc(E.x, E.y, E.r, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(E.x, E.y, E.r, -Math.PI / 2, Math.PI / 2); g.fill();
      // aurora rings at the poles
      const glow = 0.25 + Math.min(1, (this.speed - 250) / 900) * .45 + this.hit * 1.2;
      g.globalCompositeOperation = 'lighter';
      for (const sy of [-1, 1]) {
        const cy = E.y + sy * E.r * .92;
        const ag = g.createRadialGradient(E.x, cy, 0, E.x, cy, E.r * (0.9 + this.hit));
        ag.addColorStop(0, `rgba(93,255,160,${Math.min(1, .5 * glow)})`); ag.addColorStop(1, 'rgba(93,255,160,0)');
        g.fillStyle = ag; g.beginPath(); g.ellipse(E.x, cy, E.r * (1 + this.hit), E.r * .45 * (1 + this.hit), 0, 0, 7); g.fill();
      }
      // L1
      g.globalCompositeOperation = 'source-over';
      const L = this.l1;
      g.strokeStyle = 'rgba(232,238,246,.8)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(L.x - 5, L.y); g.lineTo(L.x + 5, L.y); g.moveTo(L.x, L.y - 5); g.lineTo(L.x, L.y + 5); g.stroke();
      g.fillStyle = 'rgba(232,238,246,.9)';
      g.fillRect(L.x - 7, L.y - 1.5, 3, 3); g.fillRect(L.x + 4, L.y - 1.5, 3, 3);
      g.font = '500 10.5px "JetBrains Mono", monospace'; g.textAlign = 'center';
      g.fillStyle = 'rgba(232,238,246,.8)';
      g.fillText('L1', L.x, L.y - 14);
      g.fillStyle = 'rgba(154,168,188,.9)';
      g.fillText('EARTH', E.x, E.y + E.r * 3.4 + 16);
      g.textAlign = 'left';
      g.fillText('SUN', 14, H - 16);
    }
  }

  function kindOf(v) {
    if (v < 500) return 'Slow wind';
    if (v < 850) return 'Fast wind (coronal hole)';
    return 'CME speed';
  }
  function travel(v) {
    const h = AU / v / 3600;
    if (h >= 48) return (h / 24).toFixed(1) + ' <small>days</small>';
    return h.toFixed(1) + ' <small>hours</small>';
  }

  window.initSun = function () {
    const c = document.getElementById('sun-canvas');
    const sim = new SunWind(c);
    (window.__nl = window.__nl || {}).sun = sim;
    const sl = document.getElementById('sw-speed');
    const out = (v) => {
      document.getElementById('sw-speed-val').textContent = Math.round(v).toLocaleString('en-US') + ' km/s';
      document.getElementById('ro-travel').innerHTML = travel(v);
      document.getElementById('ro-l1').innerHTML = Math.round(L1 / v / 60) + ' <small>min</small>';
      document.getElementById('ro-kind').textContent = kindOf(v);
      document.querySelectorAll('[data-sw]').forEach(b => b.setAttribute('aria-pressed', String(Math.abs(+b.dataset.sw - v) < 1)));
    };
    const set = (v) => { sim.speed = v; sl.value = v; sl.dispatchEvent(new Event('fill')); out(v); };
    sl.addEventListener('input', () => set(+sl.value));
    document.querySelectorAll('[data-sw]').forEach(b => b.addEventListener('click', () => set(+b.dataset.sw)));
    document.getElementById('cme-btn').addEventListener('click', () => {
      const v = Math.max(1500, sim.speed);
      set(v);
      sim.launchCME(v);
    });
    set(420);
  };
})();
