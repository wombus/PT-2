import * as THREE from 'three';
import { QUALITY_PRESETS, type QualityLevel, type QualitySettings } from './Quality';

/**
 * Owns the renderer, scene and camera. Keeps them alive across the whole
 * session; the world is (re)built by other systems into `scene`.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  quality: QualitySettings;

  constructor(container: HTMLElement, level: QualityLevel) {
    this.quality = QUALITY_PRESETS[level];

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // SMAA/FXAA handled in post; MSAA is costly with a composer
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Tone mapping is applied in the post stack; keep renderer linear-ish here.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = this.quality.shadowMapSize > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, this.quality.fogDensity);

    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.05,
      120,
    );
    this.camera.position.set(0, 1.65, 0);
  }

  applyQuality(level: QualityLevel): void {
    this.quality = QUALITY_PRESETS[level];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
    this.renderer.shadowMap.enabled = this.quality.shadowMapSize > 0;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.quality.fogDensity;
    }
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
