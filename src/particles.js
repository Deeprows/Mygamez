import * as THREE from 'three';

/** Pooled soft-point particle system (ring buffer). One draw call per instance. */
export class Particles {
  constructor(scene, { max = 300, blending = THREE.NormalBlending, gravity = 0, drag = 1.2 } = {}) {
    this.max = max; this.gravity = gravity; this.drag = drag; this.i = 0;
    const n = max;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.maxLife = new Float32Array(n);
    this.s0 = new Float32Array(n); this.a0 = new Float32Array(n); this.grow = new Float32Array(n);

    const geo = new THREE.BufferGeometry();
    const dyn = (arr, k) => new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
    this.aPos = dyn(this.pos, 3); this.aCol = dyn(this.col, 3); this.aSize = dyn(this.size, 1); this.aAlpha = dyn(this.alpha, 1);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aColor', this.aCol);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);

    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending, uniforms: { uScale: { value: 600 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform float uScale; varying vec3 vC; varying float vA;
        void main(){
          vC = aColor; vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vC, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setScale(s) { this.mat.uniforms.uScale.value = s; }

  emit(x, y, z, vx, vy, vz, life, size, r, g, b, a = 1, grow = 0) {
    const i = this.i; this.i = (i + 1) % this.max; const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b;
    this.life[i] = this.maxLife[i] = life;
    this.s0[i] = size; this.a0[i] = a; this.grow[i] = grow;
    this.size[i] = size; this.alpha[i] = a;
  }

  update(dt) {
    const damp = Math.max(0, 1 - this.drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.size[i] = 0; this.alpha[i] = 0; continue; }
      const k = i * 3;
      this.vel[k + 1] += this.gravity * dt;
      this.vel[k] *= damp; this.vel[k + 1] *= damp; this.vel[k + 2] *= damp;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.03) { this.pos[k + 1] = 0.03; this.vel[k + 1] *= -0.3; }
      const t = this.life[i] / this.maxLife[i];
      this.size[i] = this.s0[i] + this.grow[i] * (1 - t);
      this.alpha[i] = this.a0[i] * t;
    }
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}
