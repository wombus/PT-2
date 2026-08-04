import * as THREE from 'three';

/**
 * Generates a dark, low-key environment map (via PMREM) so PBR surfaces get
 * believable subtle reflections without shipping an HDRI. If a real
 * `public/textures/env.hdr`-style asset pipeline is added later, swap the
 * generator here — nothing else needs to change.
 */
export class AssetManager {
  private pmrem: THREE.PMREMGenerator;
  envMap: THREE.Texture | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
  }

  /** Build a moody interior environment: warm practical glow + cold shadow. */
  buildEnvironment(): THREE.Texture {
    const scene = new THREE.Scene();

    // gradient sky sphere (very dark)
    const geo = new THREE.SphereGeometry(20, 24, 16);
    const c = document.createElement('canvas');
    c.width = 4; c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#0a0b12');
    grad.addColorStop(0.55, '#070609');
    grad.addColorStop(1, '#100a06');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 128);
    const gradTex = new THREE.CanvasTexture(c);
    gradTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: gradTex, side: THREE.BackSide });
    scene.add(new THREE.Mesh(geo, mat));

    // a couple of dim warm emissive quads to fake practical lamps
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x3a2410 });
    for (let i = 0; i < 3; i++) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lampMat);
      q.position.set(Math.sin(i * 2.1) * 8, 2 + i, Math.cos(i * 2.1) * 8);
      q.lookAt(0, 2, 0);
      scene.add(q);
    }

    const rt = this.pmrem.fromScene(scene, 0.04);
    this.envMap = rt.texture;
    geo.dispose();
    gradTex.dispose();
    return this.envMap;
  }

  dispose(): void {
    this.pmrem.dispose();
  }
}
