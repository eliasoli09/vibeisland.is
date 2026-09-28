/* Chapter 5: a globe with day/night, the auroral oval in AACGM-v2 magnetic
   coordinates, and visibility for real places. */
(function () {
  const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime, uKp, uUT, uDist, uTanH;
uniform sampler2D uLand, uCgm;
uniform mat3 uRot;
uniform vec3 uSun;
const float PI = 3.14159265;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 hash33(vec3 p3){ p3 = fract(p3*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }

float oval(float mlat, float mlt, float kp){
  float c = cos(mlt/24.*2.*PI);
  float eq = 66. - 2.*kp + 4.5*(1. - c);
  float width = 4. + .5*kp + (3. + .6*kp)*(.5 + .5*c);
  float x = (mlat - eq)/width;               // 0 at equatorward edge, 1 at poleward edge
  float band = smoothstep(-.12, .12, x)*smoothstep(1.15, .75, x);
  float peak = exp(-pow((x - .35)/.28, 2.));
  float dm = mod(mlt - 23. + 12., 24.) - 12.;
  float sector = .3 + .7*exp(-dm*dm/28.);
  return (band*.35 + peak*.9)*sector*(.45 + .1*kp);
}

vec4 cgmAt(vec3 p){
  float lat = degrees(asin(clamp(p.z, -1., 1.)));
  float lon = degrees(atan(p.y, p.x));
  return texture(uCgm, vec2(((lon + 180.)/4. + .5)/90., (lat + 90. + .5)/181.));
}

float auroraAt(vec3 pe){
  vec4 c = cgmAt(pe);
  float mlat = abs(c.r);
  if(mlat < 38.) return 0.;
  float mlt = mod(atan(c.b, c.g)/(2.*PI)*24. + uUT + 48., 24.);
  float a = oval(mlat, mlt, uKp);
  float n = noise(vec2(mlt*3.1 + uTime*.12, mlat*1.7 - uTime*.05));
  float n2 = noise(vec2(mlt*9. - uTime*.3, mlat*5.));
  return a*(.45 + .9*n*n + .35*n2);
}

vec3 stars(vec3 rd){
  vec3 q = rd*140.; vec3 id = floor(q); vec3 h = hash33(id);
  if(h.x < .965) return vec3(0);
  float d = length(fract(q) - (.3 + .4*hash33(id + 2.)));
  return vec3(.8, .85, 1.)*pow((h.x - .965)/.035, 2.)*exp(-d*d*60.)*.9;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes)/uRes.y;
  vec3 ro = vec3(0., 0., uDist);
  vec3 rd = normalize(vec3(uv*2.*uTanH, -1.));
  vec3 col = stars(rd);
  float b = dot(ro, rd), c = dot(ro, ro) - 1.;
  float h = b*b - c;
  float tHit = h > 0. ? -b - sqrt(h) : -1.;

  // atmosphere halo
  float closest = length(ro + rd*max(-b, 0.));
  vec3 sunV = transpose(uRot)*uSun;
  float halo = exp(-max(closest - 1., 0.)*38.)*step(1., closest);
  vec3 cp = normalize(ro + rd*max(-b, 0.));
  float lit = smoothstep(-.35, .45, dot(cp, sunV));
  col += vec3(.25, .5, 1.)*halo*.55*lit;

  // aurora shell, 90-380 km
  vec3 aur = vec3(0);
  float rOut = 1. + 380./6371.;
  float h2 = b*b - (dot(ro, ro) - rOut*rOut);
  if(h2 > 0.){
    float t0 = -b - sqrt(h2);
    float t1 = tHit > 0. ? tHit : -b + sqrt(h2);
    float dt = (t1 - t0)/28.;
    for(int i=0;i<28;i++){
      float t = t0 + (float(i) + .5)*dt;
      vec3 p = ro + rd*t; float r = length(p);
      float alt = (r - 1.)*6371.;
      if(alt < 88.) continue;
      vec3 pe = uRot*(p/r);
      float a = auroraAt(pe);
      if(a <= 0.) continue;
      float night = smoothstep(.10, -.14, dot(pe, uSun));
      float g = smoothstep(88., 108., alt)*exp(-max(alt - 115., 0.)/38.);
      float rr = smoothstep(170., 240., alt)*exp(-max(alt - 260., 0.)/80.)*(.25 + .05*uKp);
      aur += (vec3(.18, 1., .45)*g + vec3(1., .12, .2)*rr)*a*(.2 + .8*night)*dt;
    }
  }

  if(tHit > 0.){
    vec3 n = normalize(ro + rd*tHit);
    vec3 pe = uRot*n;
    float lat = asin(clamp(pe.z, -1., 1.)), lon = atan(pe.y, pe.x);
    vec4 L = texture(uLand, vec2((lon + PI)/(2.*PI), (PI/2. - lat)/PI));
    float land = L.r, grat = L.g, coast = L.b;
    float mu = dot(pe, uSun);
    float ice = smoothstep(58., 72., abs(degrees(lat)));
    vec3 ocean = vec3(.018, .06, .14);
    vec3 ground = mix(vec3(.16, .19, .12), vec3(.78, .84, .9), ice*land);
    vec3 base = mix(ocean, ground, land);
    vec3 dayC = base*(.12 + 1.05*max(mu, 0.));
    dayC += vec3(.2, .35, .6)*pow(1. - max(dot(n, -rd), 0.), 3.)*.5*smoothstep(-.1, .3, mu);
    vec3 nightC = mix(vec3(.006, .011, .022), vec3(.018, .022, .03), land) + coast*vec3(.02, .035, .06);
    float day = smoothstep(-.1, .1, mu);
    col = mix(nightC, dayC, day);
    col += vec3(.4, .16, .05)*exp(-mu*mu*260.)*.12;          // twilight band
    col += grat*vec3(.05, .08, .12)*(.35 + .65*(1. - day));
  }
  col += aur*16.;
  col = 1. - exp(-col*1.4);
  col = pow(col, vec3(1./2.2));
  outColor = vec4(col, 1.);
}`;

  const CITIES = [
    ['Reykjavík', 64.15, -21.94], ['Akureyri', 65.68, -18.09], ['Tromsø', 69.65, 18.96], ['Abisko', 68.35, 18.83],
    ['Rovaniemi', 66.5, 25.73], ['Nuuk', 64.18, -51.69], ['Yellowknife', 62.45, -114.37], ['Fairbanks', 64.84, -147.72],
    ['Oslo', 59.91, 10.75], ['Edinburgh', 55.95, -3.19], ['London', 51.51, -0.13], ['Berlin', 52.52, 13.4],
    ['Toronto', 43.65, -79.38], ['New York', 40.71, -74.0], ['Seattle', 47.61, -122.33], ['Murmansk', 68.97, 33.08],
    ['Hobart', -42.88, 147.33], ['Invercargill', -46.41, 168.35], ['Ushuaia', -54.8, -68.3]
  ];
  const STATUS = {
    ov: ['Overhead', 'ov'], pc: ['Poleward of oval', 'pc'], lo: ['Low in sky', 'lo'], cam: ['Camera only', 'cam'],
    no: ['Not tonight', 'no'], day: ['Too bright', 'day']
  };

  function cityStatus(city, date, ut, kp) {
    const [name, lat, lon] = city;
    const { mlat, mlt0 } = Astro.cgm(lat, lon);
    const mlt = Astro.mltAt(mlt0, ut);
    const sa = Astro.sunAlt(date, lat, lon);
    const e = Astro.ovalEdges(mlt, kp);
    const m = Math.abs(mlat);
    let st;
    if (sa > -6) st = 'day';
    else if (m >= e.eq && m <= e.pole) st = 'ov';
    else if (m > e.pole) st = 'pc';
    else if (e.eq - m <= 3) st = 'lo';
    else if (e.eq - m <= 7) st = 'cam';
    else st = 'no';
    return { st, mlat, mlt, sa };
  }

  function landTexture() {
    const W = 2048, H = 1024;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (!window.d3 || !window.topojson) return c;
    const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]).precision(0.1);
    const path = d3.geoPath(proj, g);
    const land = topojson.feature(LAND_TOPO, LAND_TOPO.objects.land);
    g.fillStyle = 'rgb(255,0,0)'; g.beginPath(); path(land); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgb(0,0,255)'; g.lineWidth = 1.6; g.beginPath(); path(land); g.stroke();
    g.strokeStyle = 'rgb(0,200,0)'; g.lineWidth = 1; g.beginPath(); path(d3.geoGraticule().step([30, 30])()); g.stroke();
    return c;
  }

  class Globe {
    constructor(canvas, overlay) {
      this.view = new GLView(canvas, FRAG, { scale: .9, minScale: .45, maxScale: 1, maxDpr: 2 });
      if (this.view.failed) { this.failed = true; return; }
      this.ov = overlay; this.og = overlay.getContext('2d');
      const gl = this.view.gl;
      this.lat0 = 58; this.lon0 = -30; this.kp = 3; this.ut = 23; this.year = 2026; this.doy = 269;
      this.dist = 3.05; this.tanH = 0.40;
      // textures
      const tLand = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tLand);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, landTexture());
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const { mlatArr, cArr, sArr, G } = Astro.grid;
      const data = new Float32Array(G.nlat * G.nlon * 4);
      for (let k = 0; k < G.nlat * G.nlon; k++) { data[k * 4] = mlatArr[k]; data[k * 4 + 1] = cArr[k]; data[k * 4 + 2] = sArr[k]; data[k * 4 + 3] = 1; }
      const tC = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tC);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, G.nlon, G.nlat, 0, gl.RGBA, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tLand = tLand; this.tC = tC;
      this.view.onFrame = (dt, v) => this.frame(dt, v);
      this.bindDrag(canvas);
    }
    get date() { return new Date(Date.UTC(this.year, 0, 1) + this.doy * 86400000 + this.ut * 3600000); }
    basis() {
      const r = Math.PI / 180, la = this.lat0 * r, lo = this.lon0 * r;
      const e = [-Math.sin(lo), Math.cos(lo), 0];
      const n = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
      const c = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
      return { e, n, c };
    }
    bindDrag(el) {
      let d = null;
      el.addEventListener('pointerdown', ev => { if (ev.pointerType === 'touch') return; d = { x: ev.clientX, y: ev.clientY, lat: this.lat0, lon: this.lon0 }; el.setPointerCapture(ev.pointerId); el.style.cursor = 'grabbing'; });
      el.addEventListener('pointermove', ev => {
        if (!d) return;
        const k = 180 / el.clientHeight;
        this.lon0 = d.lon - (ev.clientX - d.x) * k;
        this.lat0 = Math.max(-89, Math.min(89, d.lat + (ev.clientY - d.y) * k));
      });
      const end = () => { d = null; el.style.cursor = ''; };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    }
    frame(dt, v) {
      const gl = v.gl;
      if (this.playing) { this.ut += dt * 2; if (this.ut >= 24) { this.ut -= 24; this.doy = (this.doy + 1) % 365; } if (this.onChange) this.onChange(true); }
      if (this.anim) {
        const a = this.anim, k = 1 - Math.exp(-dt * 3);
        this.lat0 += (a.lat - this.lat0) * k;
        let dl = ((a.lon - this.lon0 + 540) % 360) - 180; this.lon0 += dl * k;
        if (Math.abs(a.lat - this.lat0) < .05 && Math.abs(dl) < .05) this.anim = null;
      }
      const { e, n, c } = this.basis();
      gl.uniformMatrix3fv(v.loc.uRot, false, new Float32Array([...e, ...n, ...c]));
      const sun = Astro.subsolar(this.date).vec;
      v.u('uSun', sun[0], sun[1], sun[2]);
      v.u('uKp', this.kp); v.u('uUT', this.ut); v.u('uDist', this.dist); v.u('uTanH', this.tanH);
      gl.uniform1i(v.loc.uLand, 0); gl.uniform1i(v.loc.uCgm, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tLand);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tC);
      this.drawOverlay(e, n, c);
    }
    project(lat, lon, B) {
      const r = Math.PI / 180, la = lat * r, lo = lon * r;
      const p = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const v = [dot(p, B.e), dot(p, B.n), dot(p, B.c)];
      if (v[2] < 1 / this.dist + 0.02) return null;
      const dz = v[2] - this.dist;
      const W = this.ov.clientWidth, H = this.ov.clientHeight;
      const ux = v[0] / -dz / (2 * this.tanH), uy = v[1] / -dz / (2 * this.tanH);
      return [W / 2 + ux * H, H / 2 - uy * H];
    }
    drawOverlay(e, n, c) {
      const o = this.ov, g = this.og;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = o.clientWidth, H = o.clientHeight;
      if (o.width !== Math.round(W * dpr)) { o.width = Math.round(W * dpr); o.height = Math.round(H * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const B = { e, n, c };
      g.font = '500 11px "Figtree", sans-serif';
      const placed = [];
      const order = this.hl ? [CITIES.find(c => c[0] === this.hl), ...CITIES.filter(c => c[0] !== this.hl)] : CITIES;
      for (const city of order) {
        const p = this.project(city[1], city[2], B);
        if (!p) continue;
        const tw = g.measureText(city[0]).width;
        const box = [p[0] + 5, p[1] - 7, p[0] + 8 + tw, p[1] + 7];
        const clash = placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
        const st = this.statusCache && this.statusCache[city[0]];
        const col = { ov: '#5dffa0', lo: '#ffd166', cam: '#b8b1ff', pc: '#9fe8bf', day: '#ffcf8a', no: '#9aa8bc' }[st ? st.st : 'no'];
        g.fillStyle = col;
        g.beginPath(); g.arc(p[0], p[1], this.hl === city[0] ? 4.5 : 3, 0, 7); g.fill();
        g.strokeStyle = 'rgba(4,6,11,.9)'; g.lineWidth = 1.2; g.stroke();
        if (clash) continue;
        placed.push(box);
        g.fillStyle = 'rgba(232,238,246,.92)';
        g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 4;
        g.fillText(city[0], p[0] + 6, p[1] + 4);
        g.shadowBlur = 0;
      }
    }
    lookAt(lat, lon) { this.anim = { lat, lon }; }
  }

  window.initGlobe = function () {
    const glc = document.getElementById('globe-gl');
    const globe = new Globe(glc, document.getElementById('globe-ov'));
    if (globe.failed) { document.getElementById('globe-stage').insertAdjacentHTML('beforeend', '<div class="nogl">This globe needs WebGL 2, which your browser has turned off.</div>'); return; }
    const kp = document.getElementById('g-kp'), time = document.getElementById('g-time'), dateS = document.getElementById('g-date');
    const list = document.getElementById('cities');
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastListUpdate = 0;
    const refresh = (fromPlay) => {
      const d = new Date(Date.UTC(globe.year, 0, 1) + globe.doy * 86400000);
      document.getElementById('g-kp-val').textContent = 'Kp ' + globe.kp;
      document.getElementById('g-time-val').textContent = Astro.fmtHM(globe.ut);
      document.getElementById('g-date-val').textContent = d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + (globe.year !== 2026 ? ' ' + globe.year : '');
      if (fromPlay) { time.value = Math.floor(globe.ut * 4) / 4; time.dispatchEvent(new Event('fill')); }
      const now = performance.now();
      if (fromPlay && now - lastListUpdate < 250) return;
      lastListUpdate = now;
      const date = globe.date;
      const rows = CITIES.map(c => ({ c, s: cityStatus(c, date, globe.ut, globe.kp) }));
      globe.statusCache = Object.fromEntries(rows.map(r => [r.c[0], r.s]));
      rows.sort((a, b) => Math.abs(b.s.mlat) - Math.abs(a.s.mlat));
      list.innerHTML = rows.map(({ c, s }) => {
        const [label, cls] = STATUS[s.st];
        const local = s.sa > -6 ? `sun ${s.sa > 0 ? 'up' : 'just set'}` : `mag. lat ${Math.abs(s.mlat).toFixed(1)}°`;
        return `<li data-city="${c[0]}" tabindex="0"><span class="nm">${c[0]}</span><span class="st ${cls}">${label}</span><span class="sub">${local} · MLT ${Astro.fmtHM(s.mlt)}</span></li>`;
      }).join('');
    };
    globe.onChange = refresh;
    const fillAll = () => [kp, time, dateS].forEach(el => el.dispatchEvent(new Event('fill')));
    kp.addEventListener('input', () => { globe.kp = +kp.value; refresh(); });
    time.addEventListener('input', () => { globe.ut = +time.value; refresh(); });
    dateS.addEventListener('input', () => { globe.doy = +dateS.value; globe.year = 2026; refresh(); });
    list.addEventListener('click', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      const c = CITIES.find(c => c[0] === li.dataset.city);
      globe.hl = c[0]; globe.lookAt(Math.max(-70, Math.min(70, c[1] * 0.85)), c[2]);
    });
    list.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.click(); });
    const play = document.getElementById('g-play');
    play.addEventListener('click', () => { globe.playing = !globe.playing; play.textContent = globe.playing ? '❚❚ Pause' : '▶ Spin a day'; });
    const presets = {
      rvk: () => { globe.year = 2026; globe.doy = 269; globe.ut = 23.5; globe.kp = 3; globe.lookAt(60, -25); },
      may2024: () => { globe.year = 2024; globe.doy = 130; globe.ut = 22; globe.kp = 9; globe.lookAt(48, -35); },
      south: () => { globe.year = 2026; globe.doy = 172; globe.ut = 12; globe.kp = 5; globe.lookAt(-58, 150); }
    };
    document.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => {
      presets[b.dataset.g]();
      kp.value = globe.kp; time.value = globe.ut; dateS.value = globe.doy;
      fillAll(); refresh();
    }));
    refresh();
  };
  window.GlobeCities = { CITIES, cityStatus };
})();
