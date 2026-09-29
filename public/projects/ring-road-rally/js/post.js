/**
 * Post-processing: bloom (so emissives — lava, neon, lamps, the sun — glow),
 * then one grading pass that adds speed lines, a touch of chromatic aberration
 * at speed, a vignette and fine grain. Output pass does tone mapping + sRGB.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSpeed: { value: 0 }, // 0..1 of top speed
    uNitro: { value: 0 }, // 0..1
    uVignette: { value: 0.32 },
    uAspect: { value: 1 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uSpeed, uNitro, uVignette, uAspect;
    uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      c.x *= uAspect;
      float r = length(c);
      float ang = atan(c.y, c.x);
      // chromatic aberration grows with speed toward the edges
      float ca = (0.0015 + 0.004 * uNitro) * uSpeed * r;
      vec2 dir = normalize(vUv - 0.5 + 1e-5);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + dir * ca).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - dir * ca).b;
      // speed lines: thin radial streaks that race outward, only at the edges
      float lines = 0.0;
      float k = smoothstep(0.6, 1.0, uSpeed) * 0.4 + uNitro;
      if (k > 0.001) {
        float a = (ang + 3.14159) / 6.28318 * 90.0;
        float h = hash(vec2(floor(a), 7.0));
        float thin = 1.0 - smoothstep(0.0, 0.16, abs(fract(a) - 0.5));
        float travel = fract(r * 1.6 - uTime * (1.4 + h * 2.2) + h);
        float dash = smoothstep(0.0, 0.08, travel) * (1.0 - smoothstep(0.3, 0.55, travel));
        lines = k * step(0.66, h) * thin * dash * smoothstep(0.3, 0.75, r);
      }
      col += vec3(0.9, 0.97, 1.0) * lines * 0.55;
      // vignette
      float v = smoothstep(0.95, 0.25, r * (1.0 + uVignette * 0.6 + uNitro * 0.3));
      col *= mix(1.0 - uVignette, 1.0, v);
      col *= uTint;
      // grain
      col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.018;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera, { lite = false } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: lite ? 0 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.55, 0.9);
  bloom.enabled = true;
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    composer,
    bloom,
    grade,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
      grade.uniforms.uAspect.value = w / h;
    },
    setMood(night) {
      bloom.strength = night ? 0.85 : 0.32;
      bloom.radius = night ? 0.6 : 0.5;
      bloom.threshold = night ? 0.62 : 0.92;
      grade.uniforms.uVignette.value = night ? 0.42 : 0.28;
    },
    render(t, speed01, nitro01) {
      grade.uniforms.uTime.value = t;
      grade.uniforms.uSpeed.value = speed01;
      grade.uniforms.uNitro.value = nitro01;
      composer.render();
    },
  };
}
