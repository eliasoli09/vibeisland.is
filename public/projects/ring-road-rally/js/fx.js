/**
 * Particles (dust, tyre smoke, snow spray, sparks, nitro flames) and skid
 * marks. Fixed pools, no allocation per frame.
 */

import * as THREE from "three";

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

class Pool {
  constructor(scene, count, additive) {
    this.n = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.grow = new Float32Array(count);
    this.a0 = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.lift = new Float32Array(count);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, size, grow, alpha, color, drag = 1.5, lift = 0) {
    const k = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[k * 3] = x;
    this.pos[k * 3 + 1] = y;
    this.pos[k * 3 + 2] = z;
    this.vel[k * 3] = vx;
    this.vel[k * 3 + 1] = vy;
    this.vel[k * 3 + 2] = vz;
    this.col[k * 3] = color.r;
    this.col[k * 3 + 1] = color.g;
    this.col[k * 3 + 2] = color.b;
    this.life[k] = life;
    this.max[k] = life;
    this.size[k] = size;
    this.grow[k] = grow;
    this.a0[k] = alpha;
    this.alpha[k] = alpha;
    this.drag[k] = drag;
    this.lift[k] = lift;
  }
  update(dt) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) {
        this.alpha[k] = 0;
        continue;
      }
      this.life[k] -= dt;
      const f = Math.exp(-this.drag[k] * dt);
      this.vel[k * 3] *= f;
      this.vel[k * 3 + 1] = this.vel[k * 3 + 1] * f + this.lift[k] * dt;
      this.vel[k * 3 + 2] *= f;
      this.pos[k * 3] += this.vel[k * 3] * dt;
      this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt;
      this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      this.size[k] += this.grow[k] * dt;
      const t = Math.max(0, this.life[k] / this.max[k]);
      this.alpha[k] = this.a0[k] * t * Math.min(1, (1 - t) * 8 + 0.2);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
  }
}

export function createFx(scene, { lite = false } = {}) {
  const soft = new Pool(scene, lite ? 500 : 1400, false);
  const glow = new Pool(scene, lite ? 200 : 500, true);

  // skid marks: a ring buffer of quads
  const MAXQ = lite ? 900 : 2400;
  const pos = new Float32Array(MAXQ * 4 * 3);
  const col = new Float32Array(MAXQ * 4 * 4);
  const idx = new Uint32Array(MAXQ * 6);
  for (let q = 0; q < MAXQ; q++) {
    const o = q * 4;
    idx.set([o, o + 1, o + 2, o + 1, o + 3, o + 2], q * 6);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  sg.setAttribute("color", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  sg.setIndex(new THREE.BufferAttribute(idx, 1));
  const skidMesh = new THREE.Mesh(
    sg,
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
  );
  skidMesh.frustumCulled = false;
  skidMesh.renderOrder = 1;
  scene.add(skidMesh);
  let q = 0;
  let dirty = false;

  function skid(ax, ay, az, bx, by, bz, w, color, alpha) {
    const dx = bx - ax;
    const dz = bz - az;
    const l = Math.hypot(dx, dz);
    if (l < 0.05 || l > 6) return;
    const nx = (-dz / l) * w * 0.5;
    const nz = (dx / l) * w * 0.5;
    const o = q * 4;
    pos.set([ax - nx, ay, az - nz, ax + nx, ay, az + nz, bx - nx, by, bz - nz, bx + nx, by, bz + nz], o * 3);
    for (let v = 0; v < 4; v++) col.set([color.r, color.g, color.b, alpha], (o + v) * 4);
    q = (q + 1) % MAXQ;
    dirty = true;
  }

  return {
    soft,
    glow,
    skid,
    update(dt, camera, h) {
      soft.mat.uniforms.uScale.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
      glow.mat.uniforms.uScale.value = soft.mat.uniforms.uScale.value;
      soft.update(dt);
      glow.update(dt);
      if (dirty) {
        sg.attributes.position.needsUpdate = true;
        sg.attributes.color.needsUpdate = true;
        dirty = false;
      }
    },
  };
}
