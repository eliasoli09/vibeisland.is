/* Small WebGL2 helper: compiles a fullscreen fragment shader, keeps the canvas
   sized, pauses when off-screen and adapts render resolution to frame time. */
(function () {
  const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error(log, src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      throw new Error('Shader compile failed: ' + log);
    }
    return s;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class GLView {
    constructor(canvas, frag, opts = {}) {
      this.canvas = canvas;
      this.opts = Object.assign({ scale: 0.7, minScale: 0.3, maxScale: 1, maxDpr: 1.5 }, opts);
      this.scale = this.opts.scale;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      if (!gl) { this.failed = true; canvas.classList.add('gl-failed'); return; }
      this.gl = gl;
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.prog = p;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.vao = vao;
      this.loc = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const u = gl.getActiveUniform(p, i);
        this.loc[u.name] = gl.getUniformLocation(p, u.name);
      }
      this.visible = false;
      this.time = 0;
      this.frameMs = 16;
      this.lastAdapt = 0;
      this.onFrame = null;
      this.reduceMotion = reduceMotion;

      const io = new IntersectionObserver((es) => { es.forEach(e => { this.visible = e.isIntersecting; }); }, { rootMargin: '100px' });
      io.observe(canvas);
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(canvas);
      this.resize();
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
        last = now;
        if (this.visible && !document.hidden) {
          this.time += dt;
          this.adapt(dt, now);
          this.draw(dt);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    resize() {
      if (!this.gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
      const w = Math.max(2, Math.round(this.canvas.clientWidth * dpr * this.scale));
      const h = Math.max(2, Math.round(this.canvas.clientHeight * dpr * this.scale));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }

    adapt(dt, now) {
      this.frameMs = this.frameMs * 0.95 + dt * 1000 * 0.05;
      if (now - this.lastAdapt < 1200) return;
      if (this.frameMs > 28 && this.scale > this.opts.minScale) {
        this.scale = Math.max(this.opts.minScale, this.scale * 0.85);
        this.lastAdapt = now; this.resize();
      } else if (this.frameMs < 17.5 && this.scale < this.opts.maxScale) {
        this.scale = Math.min(this.opts.maxScale, this.scale * 1.08);
        this.lastAdapt = now; this.resize();
      }
    }

    u(name, ...v) {
      const l = this.loc[name];
      if (l === undefined || l === null) return;
      const gl = this.gl;
      if (v.length === 1) gl.uniform1f(l, v[0]);
      else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    }

    draw(dt) {
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      this.u('uRes', this.canvas.width, this.canvas.height);
      this.u('uTime', this.time);
      if (this.onFrame) this.onFrame(dt, this);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  window.GLView = GLView;
  window.REDUCE_MOTION = reduceMotion;
})();
