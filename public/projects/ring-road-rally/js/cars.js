/**
 * Car visuals: the textured rally car (models/car.glb — a Meshy scan cleaned
 * up offline: metre scale, facing +X, wheels split out so they spin) with the
 * Blender kit car as a fallback. Adds the dressing that sells speed: underglow,
 * head/brake light glows, nitro flames and a name tag.
 */

import * as THREE from "three";

function radialTex(inner, outer = "rgba(0,0,0,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner);
  r.addColorStop(1, outer);
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GLOW = radialTex("rgba(255,255,255,1)");

function flameTex() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d");
  const lg = g.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, "rgba(255,255,255,1)");
  lg.addColorStop(0.2, "rgba(120,200,255,0.95)");
  lg.addColorStop(0.6, "rgba(140,80,255,0.6)");
  lg.addColorStop(1, "rgba(140,80,255,0)");
  g.fillStyle = lg;
  g.beginPath();
  g.moveTo(32, 0);
  g.bezierCurveTo(64, 40, 44, 200, 32, 256);
  g.bezierCurveTo(20, 200, 0, 40, 32, 0);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const FLAME = flameTex();

export function labelSprite(text, accent = "#ff2d87") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(10,12,20,0.72)";
  g.beginPath();
  g.roundRect(8, 12, 240, 40, 10);
  g.fill();
  g.fillStyle = accent;
  g.fillRect(8, 12, 6, 40);
  g.fillStyle = "#fff";
  g.font = "italic 800 26px 'Barlow Condensed', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text.toUpperCase(), 132, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  // constant on-screen size (fraction of view height) so close cars aren't covered
  s.scale.set(0.12, 0.03, 1);
  s.position.set(0, 2.5, 0);
  s.renderOrder = 10;
  return s;
}

// Light glows are one-sided quads, not sprites, so headlights are only seen
// from in front and brake lights from behind.
const GLOW_GEO = new THREE.PlaneGeometry(1, 1);
function glowQuad(color, scale, opacity, facing) {
  const m = new THREE.MeshBasicMaterial({ map: GLOW, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const q = new THREE.Mesh(GLOW_GEO, m);
  q.rotation.y = (facing * Math.PI) / 2;
  q.scale.setScalar(scale);
  return q;
}

/**
 * Build one car. `rally` is the loaded car.glb (or null), `kit` the Blender
 * kit (fallback + wheel shapes). Returns handles for posing.
 */
export function makeCar(scene, rally, kit, color, { ghost = false, name = null, accent } = {}) {
  const root = new THREE.Group();
  root.rotation.order = "YZX";
  const chassis = new THREE.Group();
  root.add(chassis);
  const wheels = {};
  const paints = [];
  const src = rally ? rally.scene.getObjectByName("KIT_Rally") : kit.scene.getObjectByName("KIT_Car");
  const copy = src.clone(true);
  copy.position.set(0, 0, 0);
  for (const o of copy.children.slice()) {
    const m = o.name.match(/Wheel_([FR][LR])$/);
    if (m) {
      const steer = new THREE.Group();
      steer.position.copy(o.position);
      o.position.set(0, 0, 0);
      steer.add(o);
      root.add(steer);
      wheels[m[1]] = { steer, spin: o };
    } else chassis.add(o);
  }
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((mat) => {
      const c = mat.clone();
      if (ghost) {
        c.transparent = true;
        c.opacity = 0.3;
        c.depthWrite = false;
      }
      if (rally || mat.name === "CarPaint") paints.push(c);
      if (rally) c.envMapIntensity = 1.35;
      return c;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
    o.castShadow = !ghost;
    o.receiveShadow = !ghost;
  });

  const extras = new THREE.Group();
  root.add(extras);
  // underglow
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 3.4),
    new THREE.MeshBasicMaterial({ map: GLOW, color, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.06;
  extras.add(under);
  // lights
  const head = [];
  const tail = [];
  for (const z of [-0.62, 0.62]) {
    const h = glowQuad(0xfff1d0, 0.9, 0.0, 1);
    h.position.set(2.2, 0.72, z);
    extras.add(h);
    head.push(h);
    const t = glowQuad(0xff2a1a, 0.7, 0.35, -1);
    t.position.set(-2.18, 0.86, z);
    extras.add(t);
    tail.push(t);
  }
  // nitro flames
  const flames = [];
  for (const z of [-0.32, 0.32]) {
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 1.6),
      new THREE.MeshBasicMaterial({ map: FLAME, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    f.rotation.z = Math.PI / 2;
    f.position.set(-2.95, 0.34, z);
    const f2 = f.clone();
    f2.material = f.material;
    f2.rotation.x = Math.PI / 2;
    extras.add(f, f2);
    flames.push(f, f2);
  }
  let label = null;
  if (name) {
    label = labelSprite(name, accent);
    root.add(label);
  }
  scene.add(root);
  const v = { root, chassis, wheels, paints, under, head, tail, flames, label, rally: Boolean(rally), spinA: 0 };
  paint(v, color);
  return v;
}

export function paint(v, color) {
  const c = new THREE.Color(color);
  for (const m of v.paints) m.color.copy(c);
  v.under.material.color.copy(c);
}

/** Per-frame dressing. */
export function dress(v, { braking, nitro, night, speed, steer, dt, wheelR }) {
  v.spinA -= (speed / wheelR) * dt;
  for (const [k, w] of Object.entries(v.wheels)) {
    w.spin.rotation.z = v.spinA;
    w.steer.rotation.y = k[0] === "F" ? -steer * 0.45 : 0;
  }
  for (const t of v.tail) {
    t.material.opacity = braking ? 1 : night ? 0.55 : 0.25;
    t.scale.setScalar(braking ? 1.6 : 0.8);
  }
  for (const h of v.head) {
    h.material.opacity = night ? 1 : 0.18;
    h.scale.setScalar(night ? 1.8 : 0.7);
  }
  v.under.material.opacity = night ? 0.55 : 0.12;
  const fl = nitro ? 0.75 + Math.random() * 0.25 : 0;
  for (const f of v.flames) {
    f.material.opacity = fl;
    f.scale.set(1, 0.7 + Math.random() * 0.6, 1);
  }
}
