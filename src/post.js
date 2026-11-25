import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Radial speed blur (stronger toward screen edges) + vignette.
const FX = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0 }, vig: { value: 0.18 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float strength; uniform float vig; varying vec2 vUv;
    void main(){
      vec2 dir = vUv - vec2(0.5, 0.45);
      float d = length(dir);
      vec4 sum = vec4(0.0); float tot = 0.0;
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        float w = 1.0 - t * 0.6;
        sum += texture2D(tDiffuse, vUv - dir * strength * t * (0.4 + d)) * w;
        tot += w;
      }
      vec4 c = sum / tot;
      c.rgb *= 1.0 - vig * smoothstep(0.35, 0.95, d * 1.4);
      gl_FragColor = c;
    }`,
};

/**
 * quality: 0 LOW  = direct render (no post)
 *          1 MED  = speed blur + vignette
 *          2 HIGH = + bloom
 */
export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.q = 2;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.6, 1.6);
    this.composer.addPass(this.bloom);
    this.fx = new ShaderPass(FX);
    this.composer.addPass(this.fx);
    this.composer.addPass(new OutputPass());
  }

  setQuality(q) { this.q = q; this.bloom.enabled = q >= 2; }

  resize(w, h) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(dt, { blur = 0, vig = 0.18 } = {}) {
    if (this.q === 0) { this.renderer.render(this.scene, this.camera); return; }
    this.fx.uniforms.strength.value = blur;
    this.fx.uniforms.vig.value = vig;
    this.composer.render(dt);
  }
}
