/* Physically-proportioned aurora sky over an Icelandic lake.
   Units are kilometres. The observer stands at the shore; north is -z.
   Auroral curtains are thin vertical sheets (a few km thick) that start at a
   sharp lower border near 100 km and fade upward; red oxygen light sits high
   above (200-400 km); a magenta nitrogen fringe appears at the bottom during
   energetic precipitation. The Earth is curved (R = 6371 km) so arcs sink
   toward the horizon with distance exactly as they do in reality. */
(function () {
  const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;      // wall-clock seconds
uniform float uAT;        // aurora evolution time
uniform float uYaw, uPitch, uFov;
uniform float uBright, uArcDist, uArcSep, uAmp, uRed, uPink, uPulse, uDiffuse, uRayAmt, uArcs;
uniform float uEye, uSplit, uExposure, uStarT, uLat, uFlash, uCenter;

const float R = 6371.0;
const float COTI = 0.249; // field lines dip ~76 deg in Iceland: going up, they lean south
const vec3 GREEN = vec3(0.13, 1.0, 0.40);
const vec3 RED   = vec3(1.0, 0.07, 0.13);
const vec3 PINK  = vec3(0.95, 0.16, 0.72);
const vec3 BLUE  = vec3(0.30, 0.22, 1.0);

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 hash33(vec3 p3){ p3 = fract(p3*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+vec2(17.1,9.2); a*=.5;} return s; }
float fbm3(vec2 p){ float a=.5, s=0.; for(int i=0;i<3;i++){ s+=a*noise(p); p=p*2.03+vec2(17.1,9.2); a*=.5;} return s/.875; }
float n1(float x, float s){ return noise(vec2(x, s)); }
float fbm1(float x, float s){ float a=.5, r=0.; for(int i=0;i<5;i++){ r+=a*noise(vec2(x,s)); x=x*2.1+13.7; a*=.5;} return r; }
// seamless around the horizon: noise on a circle of radius k
float fbmc(float az, float k, float s){ vec2 q = vec2(cos(az), sin(az))*k + s; float a=.5, r=0.; for(int i=0;i<5;i++){ r+=a*noise(q); q=q*2.07+vec2(13.7,5.1); a*=.5;} return r; }

// ---- aurora -------------------------------------------------------------
float wob(float i, float x, float t){
  return uAmp*(50.*sin(x*.0041 + t*.05 + i*2.3) + 22.*sin(x*.0112 - t*.085 + i*1.3) + 7.*sin(x*.036 + t*.23 + i))
       + uAmp*120.*(fbm3(vec2(x*.0019 + i*5.1, t*.022 + i*3.)) - .5);
}
float arcZ(float i, float x, float t){
  float D = uArcDist + i*uArcSep;
  float w = wob(i, x, t);
  // uCenter pins the nearest arc so it passes through the observer's magnetic zenith
  if(i < .5) w -= uCenter*wob(i, 0., t)*exp(-x*x/9e4);
  return -D + w;
}

vec3 emission(vec3 p, float h, float horiz){
  vec3 e = vec3(0);
  float t = uAT;
  for(int k=0;k<3;k++){
    float i = float(k);
    float wA = clamp(uArcs - i, 0., 1.) * (1. - .28*i);
    if(wA <= 0.) continue;
    float dz = p.z - arcZ(i, p.x, t) - (h - 100.)*COTI;
    float w = 2.2 + i*1.4;
    float we = sqrt(w*w + horiz*horiz*.3);
    float sheet = exp(-dz*dz/(we*we)) * (w/we);
    float broad = exp(-dz*dz/3200.);
    if(sheet < .002 && broad < .01) continue;
    float env = smoothstep(.25, .62, fbm3(vec2(p.x*.0011 + i*3.3, t*.011 + i)));
    if(i < .5) env = max(env, uCenter*exp(-p.x*p.x/8e4));
    float r1 = noise(vec2(p.x*.21 + t*(.45 + i*.1), i*7.3));
    float r2 = noise(vec2(p.x*.83 - t*1.3, i*3.1 + 2.));
    float r0 = noise(vec2(p.x*.05 + t*.12, i*1.7 + 9.));
    float ray = mix(1., (.12 + 1.5*r1*r1*r1 + .7*r2*r2*r1)*(.5 + r0), uRayAmt);
    float hl = 103. + 8.*noise(vec2(p.x*.008, i)) - uPink*10.;
    float H = 16. + 58.*ray*ray + i*6.;
    float above = max(h - hl, 0.);
    float lower = smoothstep(hl - 3., hl + 1.2, h);
    float amp = wA*env*uBright;
    float g = lower*exp(-above/H);
    e += GREEN * (sheet*g*ray*amp);
    e += BLUE  * (sheet*g*ray*amp*.06);
    e += PINK  * (sheet*uPink*lower*exp(-above/4.5)*amp*ray*1.4);
    float rp = smoothstep(150., 235., h)*exp(-max(h - 250., 0.)/110.);
    e += RED * (broad*rp*uRed*amp*(.3 + .7*ray)*.035);
  }
  // diffuse aurora and pulsating patches, equatorward (south) of the arcs
  if(uDiffuse > 0.){
    float zrel = p.z + uArcDist;
    float region = smoothstep(-20., 40., zrel) * smoothstep(420., 160., zrel);
    float vp = exp(-pow((h - 112.)/13., 2.));
    vec2 q = p.xz*.018;
    float pat = smoothstep(.48, .72, fbm3(q + vec2(0., t*.02)));
    vec2 cell = floor(q*1.5);
    float per = 3. + 9.*hash12(cell);
    float on = .5 + .5*sin(uTime*6.2831/per + hash12(cell + 7.)*6.28);
    on = smoothstep(.35, .75, on);
    float pul = mix(1., on, uPulse) * mix(.35, 1., pat);
    e += GREEN * (region*vp*uDiffuse*pul*.035*uBright);
  }
  return e;
}

float shellT(float b, float c0, float r){ float hh = b*b - (c0 - r*r); return -b + sqrt(max(hh, 0.)); }

vec3 aurora(vec3 ro, vec3 rd, float jit){
  vec3 oc = ro + vec3(0., R, 0.);
  float b = dot(oc, rd), c0 = dot(oc, oc);
  float tA = shellT(b, c0, R + 86.), tB = shellT(b, c0, R + 205.), tC = shellT(b, c0, R + 420.);
  vec3 acc = vec3(0);
  float dt = (tB - tA)/40.;
  float horiz = abs(rd.z)*dt + abs(rd.x)*dt*.15;
  for(int k=0;k<40;k++){
    vec3 p = ro + rd*(tA + (float(k) + jit)*dt);
    float h = length(p + vec3(0., R, 0.)) - R;
    acc += emission(p, h, horiz)*dt;
  }
  dt = (tC - tB)/12.;
  horiz = abs(rd.z)*dt + abs(rd.x)*dt*.15;
  for(int k=0;k<12;k++){
    vec3 p = ro + rd*(tB + (float(k) + jit)*dt);
    float h = length(p + vec3(0., R, 0.)) - R;
    acc += emission(p, h, horiz)*dt;
  }
  return acc;
}

// ---- sky ----------------------------------------------------------------
vec3 toEq(vec3 rd){
  float s = sin(uLat), c = cos(uLat);
  vec3 P = vec3(0., s, -c), A = vec3(0., c, s), W = vec3(-1., 0., 0.);
  vec3 q = vec3(dot(rd, A), dot(rd, W), dot(rd, P));
  float cs = cos(uStarT), sn = sin(uStarT);
  return vec3(q.x*cs - q.y*sn, q.x*sn + q.y*cs, q.z);
}

vec3 stars(vec3 rd, float pixAng){
  vec3 q = toEq(rd);
  vec3 col = vec3(0);
  float ext = smoothstep(-.01, .22, rd.y);
  for(int l=0;l<2;l++){
    float sc = l==0 ? 115. : 240.;
    vec3 pp = q*sc;
    vec3 id = floor(pp);
    vec3 f = fract(pp);
    vec3 hs = hash33(id + float(l)*41.7);
    float th = l==0 ? .955 : .9;
    if(hs.x < th) continue;
    vec3 sp = .28 + .44*hash33(id + 3.1);
    float d = length(f - sp)/sc;
    float sig = pixAng*.7;
    float mag = (hs.x - th)/(1. - th);
    float br = l==0 ? pow(mag, 3.)*2.2 + .04 : mag*.06;
    float tw = .8 + .2*sin(uTime*(2. + hs.z*6.) + hs.y*50.);
    tw = mix(1., tw, 1. - smoothstep(.0, .5, rd.y));
    vec3 tint = mix(vec3(1., .82, .66), vec3(.72, .84, 1.), hs.z);
    col += tint*br*tw*exp(-d*d/(2.*sig*sig));
  }
  // Milky Way: galactic plane band (north galactic pole RA 192.86 deg, Dec 27.13 deg)
  vec3 ngp = vec3(cos(.4735)*cos(3.366), cos(.4735)*sin(3.366), sin(.4735));
  float gb = dot(q, ngp);
  float band = exp(-gb*gb/.018);
  float dust = fbm(q.xy*7. + q.z*3.);
  float lane = smoothstep(.35, .7, fbm(q.yz*11. + 4.));
  col += vec3(.55, .6, .75)*band*(.012 + .03*dust)*(1. - .6*lane*exp(-gb*gb/.002));
  return col*ext;
}

vec3 skyBase(vec3 rd){
  float e = max(rd.y, 0.);
  vec3 c = mix(vec3(.0065, .010, .021), vec3(.0016, .0025, .0065), pow(e, .4));
  c += vec3(.005, .014, .008)*exp(-e*10.);            // 557.7 nm airglow near horizon
  float az = atan(rd.x, -rd.z);
  c += vec3(.020, .009, .003)*exp(-e*24.)*smoothstep(-.3, -.95, cos(az - .3)); // distant town glow, south
  return c;
}

float mountain(float az){
  float m = .014 + .04*fbmc(az, 2.3, 3.);
  float dt = abs(az - .44);
  float tuya = .085*smoothstep(.215, .16, dt) + .004*n1(az*70., 4.);
  m = max(m, tuya);
  float dc = abs(az + .64);
  m = max(m, .12*pow(max(1. - dc/.17, 0.), 1.35) + .003*n1(az*90., 8.));
  return m;
}
float farRange(float az){ return .002 + .03*pow(fbmc(az, 6.5, 11.), 2.2) + .004*fbmc(az, 40., 2.); }

vec3 auroraTint(){ return (GREEN*.9 + RED*uRed*.15 + PINK*uPink*.2)*uBright; }

vec3 skyColor(vec3 ro, vec3 rd, float jit, float pixAng, out vec3 aur){
  vec3 c = skyBase(rd) + stars(rd, pixAng);
  aur = vec3(0);
  if(rd.y > -.02) aur = aurora(ro, rd, jit);
  return c;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = (fc - .5*uRes)/uRes.y;
  float th = tan(uFov*.5);
  vec3 fw = vec3(sin(uYaw)*cos(uPitch), sin(uPitch), -cos(uYaw)*cos(uPitch));
  vec3 rt = normalize(cross(fw, vec3(0, 1, 0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw + (uv.x*rt + uv.y*up)*2.*th);
  vec3 ro = vec3(0., .002, 0.);
  float pixAng = 2.*th/uRes.y;
  float jit = fract(52.9829189*fract(dot(fc, vec2(.06711056, .00583715))));

  float az = atan(rd.x, -rd.z);
  float el = asin(clamp(rd.y, -1., 1.));
  vec3 base = vec3(0), aur = vec3(0);
  vec3 amb = auroraTint();

  if(el >= 0.){
    float m = mountain(az), fr = farRange(az);
    if(el < m){
      float snow = smoothstep(.55, .75, noise(vec2(az*95., el*420.)))*smoothstep(m*.35, m, el);
      base = vec3(.004, .006, .010) + amb*.004*(.3 + snow) + vec3(.006, .008, .012)*snow;
      float rim = exp(-(m - el)*900.);
      base += amb*.006*rim;
    } else if(el < fr){
      base = skyBase(rd)*.55 + amb*.004;
    } else {
      base = skyColor(ro, rd, jit, pixAng, aur);
    }
  } else {
    float shore = -.30 + .07*fbmc(az, 5.5, 9.) + .10*smoothstep(.5, 1.3, abs(az));
    if(el < shore){
      float tex = fbm(vec2(az*40., el*60.));
      base = vec3(.0022, .0028, .0038)*(.5 + tex) + amb*.001*tex;
    } else {
      float s = .002/max(-rd.y, 1e-4);
      vec2 wp = rd.xz*s*1000.;
      float nx = noise(wp*.35 + vec2(uTime*.35, 0.)) - noise(wp*.35 + vec2(.5, uTime*.3));
      float nz = noise(wp*.21 + vec2(3., uTime*.25)) - .5;
      float rip = .5/(1. + s*2.);
      vec3 rr = normalize(vec3(rd.x + nx*.012*rip, -rd.y + nz*.02*rip, rd.z));
      float raz = atan(rr.x, -rr.z);
      float rel = asin(clamp(rr.y, -1., 1.));
      float fres = .02 + .98*pow(1. - abs(rd.y), 5.);
      vec3 rc;
      if(rel < mountain(raz)){
        rc = vec3(.004, .006, .010) + amb*.003;
      } else if(rel < farRange(raz)){
        rc = skyBase(rr)*.55;
      } else {
        rc = skyColor(ro, rr, jit, pixAng*1.15, aur);
      }
      base = rc*fres;
      aur *= fres;
      float edge = exp(-(el - shore)*140.);
      base += vec3(.01, .014, .02)*edge*.3;
    }
  }

  vec3 lin = base + aur*uExposure*(1. + uFlash);
  // eye vs camera: faint light is seen by rods (no colour, weak in red)
  bool eye = uSplit > 0. ? (fc.x < uSplit*uRes.x) : (uEye > .5);
  if(eye){
    vec3 a = aur*uExposure*.55;
    vec3 l2 = base*.45 + a;
    float Y = dot(l2, vec3(.12, .78, .10));
    float sat = smoothstep(.04, .4, Y);
    vec3 grey = vec3(Y)*vec3(.8, .92, 1.12);
    lin = mix(grey, l2*vec3(mix(.25, 1., sat), 1., 1.), sat);
  }
  vec3 col = 1. - exp(-lin*1.35);
  col = pow(col, vec3(1./2.2));
  col += (hash12(fc + fract(uTime*7.)*97.) - .5)*.018;
  vec2 vq = fc/uRes - .5;
  col *= 1. - dot(vq, vq)*.45;
  if(uSplit > 0.){
    float dx = abs(fc.x - uSplit*uRes.x);
    col = mix(col, vec3(.9, .95, 1.), smoothstep(1.5, 0., dx)*.8);
  }
  outColor = vec4(col, 1.);
}`;

  // Parameter presets (see substorm section for their physical meaning)
  const PRESETS = {
    quiet:     { bright: .75, arcDist: 250, arcSep: 70, amp: .45, red: .25, pink: 0, pulse: 0, diffuse: .15, rayAmt: .35, arcs: 1.2, speed: .5, center: 0 },
    growth:    { bright: 1.1, arcDist: 150, arcSep: 55, amp: .55, red: .35, pink: 0, pulse: 0, diffuse: .2, rayAmt: .5, arcs: 2.0, speed: .6, center: 0 },
    onset:     { bright: 2.3, arcDist: 105, arcSep: 50, amp: .9, red: .4, pink: .55, pulse: 0, diffuse: .3, rayAmt: .9, arcs: 2.4, speed: 1.7, center: .3 },
    expansion: { bright: 2.5, arcDist: -25, center: 1, arcSep: 70, amp: 1.5, red: .32, pink: .9, pulse: 0, diffuse: .4, rayAmt: 1, arcs: 3, speed: 2.4 },
    recovery:  { bright: .7, arcDist: 190, arcSep: 80, amp: .6, red: .3, pink: 0, pulse: 1, diffuse: 1.4, rayAmt: .25, arcs: 1.2, speed: .4, center: 0 }
  };

  function fromKp(kp) {
    return {
      bright: .18 + .32 * kp,
      arcDist: 170 - 55 * kp,
      arcSep: 140 + 4 * kp,
      amp: .35 + .11 * kp,
      red: .12 + .09 * kp,
      pink: Math.max(0, (kp - 4.5) * .3),
      pulse: 0,
      diffuse: .1 + .04 * kp,
      rayAmt: Math.min(1, .25 + .1 * kp),
      arcs: Math.min(3, 1.8 + kp / 2.5),
      speed: .35 + .15 * kp,
      center: 0
    };
  }

  class SkySim {
    constructor(canvas, opts = {}) {
      this.view = new GLView(canvas, FRAG, { scale: opts.scale || .7, minScale: .3, maxScale: .95 });
      if (this.view.failed) { this.failed = true; return; }
      this.p = Object.assign({}, fromKp(opts.kp ?? 3));
      this.target = Object.assign({}, this.p);
      this.cam = { yaw: opts.yaw ?? 0, pitch: opts.pitch ?? .2, fov: opts.fov ?? 1.05 };
      this.camTarget = Object.assign({}, this.cam);
      this.eye = 0; this.split = 0; this.flash = 0;
      this.at = 400 + Math.random() * 400;
      this.starT = Math.random() * 6.28;
      this.rate = 1.2;
      this.view.onFrame = (dt, v) => this.frame(dt, v);
      this.bindDrag(canvas);
    }
    set(params, rate) { Object.assign(this.target, params); if (rate) this.rate = rate; }
    setKp(kp) { this.set(fromKp(kp)); }
    preset(name, rate) { this.set(PRESETS[name], rate); }
    look(yaw, pitch) { if (yaw != null) this.camTarget.yaw = yaw; if (pitch != null) this.camTarget.pitch = pitch; }
    bindDrag(el) {
      let drag = null;
      el.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return; // keep page scroll natural on phones
        drag = { x: e.clientX, y: e.clientY, yaw: this.camTarget.yaw, pitch: this.camTarget.pitch };
        el.setPointerCapture(e.pointerId); el.classList.add('dragging');
      });
      el.addEventListener('pointermove', e => {
        if (!drag) return;
        const k = this.cam.fov / el.clientHeight;
        const yaw = drag.yaw - (e.clientX - drag.x) * k;
        const behind = Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))) > 1.3;
        this.camTarget.yaw = yaw;
        this.camTarget.pitch = Math.max(behind ? .06 : -.12, Math.min(1.52, drag.pitch + (e.clientY - drag.y) * k));
        if (this.onLook) this.onLook(this.camTarget);
      });
      const end = () => { drag = null; el.classList.remove('dragging'); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
    frame(dt, v) {
      const k = 1 - Math.exp(-dt * this.rate);
      for (const key in this.target) this.p[key] += (this.target[key] - this.p[key]) * k;
      const kc = 1 - Math.exp(-dt * 4);
      for (const key in this.camTarget) this.cam[key] += (this.camTarget[key] - this.cam[key]) * kc;
      const motion = v.reduceMotion ? .35 : 1;
      this.at += dt * this.p.speed * motion;
      this.starT += dt * 0.0073 * motion; // ~60x sidereal rate, so the sky slowly turns
      this.flash *= Math.exp(-dt * 1.5);
      const p = this.p;
      v.u('uAT', this.at);
      v.u('uYaw', this.cam.yaw); v.u('uPitch', this.cam.pitch); v.u('uFov', this.cam.fov);
      v.u('uBright', p.bright); v.u('uArcDist', p.arcDist); v.u('uArcSep', p.arcSep);
      v.u('uAmp', p.amp); v.u('uRed', p.red); v.u('uPink', p.pink); v.u('uPulse', p.pulse);
      v.u('uDiffuse', p.diffuse); v.u('uRayAmt', p.rayAmt); v.u('uArcs', p.arcs);
      v.u('uEye', this.eye); v.u('uSplit', this.split); v.u('uExposure', .05);
      v.u('uCenter', p.center || 0);
      v.u('uStarT', this.starT); v.u('uLat', 64.1 * Math.PI / 180); v.u('uFlash', this.flash);
      if (this.onTick) this.onTick(dt);
    }
  }

  window.SkySim = SkySim;
  window.SKY_PRESETS = PRESETS;
})();
