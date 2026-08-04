import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import type { Engine } from './Engine';

/**
 * Cinematic composer: (SSAO or Render) -> Bloom -> Grade -> Output(ACES+sRGB).
 * The Grade pass merges vignette, chromatic aberration, film grain and a
 * "fear" desaturation/pulse into a single shader pass.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    vignette: { value: 0.85 },
    aberration: { value: 0.36 },
    grain: { value: 0.04 },
    fear: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, vignette, aberration, grain, fear;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float d = length(dir);

      // chromatic aberration grows toward the edges + with fear
      float ab = aberration * (0.0009 + fear * 0.0025);
      vec2 off = dir * d * ab * 40.0;
      float r = texture2D(tDiffuse, uv - off).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + off).b;
      vec3 col = vec3(r, g, b);

      // cinematic color grade: cool shadows, warm highlights (teal/amber split)
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(0.82, 0.94, 1.14);
      vec3 highTint = vec3(1.12, 1.0, 0.82);
      col *= mix(shadowTint, highTint, smoothstep(0.0, 0.55, l));
      // gentle contrast (S-curve) for depth
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);

      // fear desaturation toward a sick red
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum) * vec3(1.15, 0.55, 0.5), fear * 0.5);

      // film grain (animated) — use pixel coords for precision-safe, non-streaky noise
      float n = hash(gl_FragCoord.xy + fract(time) * 60.0) - 0.5;
      col += n * (grain + fear * 0.06);

      // vignette
      float vig = 1.0 - vignette * smoothstep(0.4, 1.3, d * 2.0);
      col *= clamp(vig, 0.0, 1.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostProcessing {
  composer: EffectComposer;
  private grade!: ShaderPass;
  private bloom: UnrealBloomPass | null = null;

  constructor(private engine: Engine) {
    this.composer = new EffectComposer(engine.renderer);
    this.composer.setPixelRatio(engine.renderer.getPixelRatio());
    this.build();
  }

  build(): void {
    const { renderer, scene, camera, quality } = this.engine;
    // AgX has a more filmic highlight rolloff than ACES — the practicals glow
    // instead of blowing out to flat white, which reads as more photographic.
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.55;

    // clear existing passes
    this.composer.passes.slice().forEach((p) => this.composer.removePass(p));
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (quality.ssao) {
      const ssao = new SSAOPass(scene, camera, w, h);
      ssao.kernelRadius = 0.6;
      ssao.minDistance = 0.004;
      ssao.maxDistance = 0.09;
      this.composer.addPass(ssao);
    } else {
      this.composer.addPass(new RenderPass(scene, camera));
    }

    if (quality.bloom) {
      // tighter, brighter-threshold bloom so only the lamps glow (less haze)
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.38, 0.6, 0.9);
      this.composer.addPass(this.bloom);
    } else {
      this.bloom = null;
    }

    // Tonemap + sRGB FIRST, so the grade runs on LDR colours (0..1). Doing the
    // contrast/tint in HDR shifted hues near clipping (green blooming).
    this.composer.addPass(new OutputPass());

    this.grade = new ShaderPass(GradeShader);
    if (!quality.grade) {
      this.grade.uniforms.grain.value = 0.0;
      this.grade.uniforms.aberration.value = 0.0;
    }
    this.composer.addPass(this.grade);

    // anti-aliasing last, on the final graded image (kills jagged edges)
    this.composer.addPass(new SMAAPass(w, h));
  }

  /** 0..1 fear amount drives grain/aberration/desaturation. */
  setFear(v: number): void {
    if (this.grade) this.grade.uniforms.fear.value = v;
  }

  setBloom(strength: number): void {
    if (this.bloom) this.bloom.strength = strength;
  }

  resize(): void {
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setPixelRatio(this.engine.renderer.getPixelRatio());
  }

  render(dt: number): void {
    if (this.grade) this.grade.uniforms.time.value += dt;
    this.composer.render();
  }
}
