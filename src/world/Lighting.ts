import * as THREE from 'three';
import { LAYOUT } from './layout';

interface Practical {
  light: THREE.PointLight;
  bulb: THREE.Mesh;
  base: number;      // base intensity
  target: number;    // current target (for blackout/restore)
  flickerUntil: number;
}

/**
 * Practical warm lighting with a flicker/blackout controller. One light casts
 * shadows (perf); the rest are cheap fill. `shaftMesh` is exposed as the
 * emissive source for the god-ray post effect.
 */
export class Lighting {
  readonly group = new THREE.Group();
  readonly shaftMesh: THREE.Mesh;
  private practicals: Practical[] = [];
  private ambient: THREE.HemisphereLight;
  private time = 0;

  constructor(shadowMapSize: number) {
    // very low cold ambient so shadows never go pure black-crushed
    this.ambient = new THREE.HemisphereLight(0x20242e, 0x080604, 0.12);
    this.group.add(this.ambient);

    const positions: [number, number, number, boolean][] = [
      [0, LAYOUT.wallH - 0.15, -2.5, true],   // near landing (shadow caster)
      [0, LAYOUT.wallH - 0.15, -8.5, false],  // deep in main corridor
      [-6.5, LAYOUT.wallH - 0.15, -10.9, false], // turn corridor
    ];

    const bulbGeo = new THREE.SphereGeometry(0.06, 12, 12);
    for (const [x, y, z, shadow] of positions) {
      const light = new THREE.PointLight(0xffb15a, 12, 11, 2);
      light.position.set(x, y, z);
      if (shadow && shadowMapSize > 0) {
        light.castShadow = true;
        light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
        light.shadow.bias = -0.002;
        light.shadow.radius = 3;
        light.shadow.camera.far = 14;
      }
      this.group.add(light);

      const bulb = new THREE.Mesh(
        bulbGeo,
        new THREE.MeshBasicMaterial({ color: 0xffd8a0 }),
      );
      bulb.position.copy(light.position);
      this.group.add(bulb);

      // small fixture cup
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.1, 0.12, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x1a1712, roughness: 0.7, side: THREE.DoubleSide }),
      );
      cup.position.set(x, y + 0.08, z);
      this.group.add(cup);

      this.practicals.push({ light, bulb, base: light.intensity, target: light.intensity, flickerUntil: 0 });
    }

    // god-ray shaft source: a dim emissive quad near the first lamp
    this.shaftMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffcaa0 }),
    );
    this.shaftMesh.position.set(0, LAYOUT.wallH - 0.15, -2.5);
    this.group.add(this.shaftMesh);
  }

  /** Flicker a specific light (or all) for a duration. */
  flicker(seconds: number, index = -1): void {
    const until = this.time + seconds;
    this.practicals.forEach((p, i) => {
      if (index === -1 || index === i) p.flickerUntil = until;
    });
  }

  blackout(): void {
    this.practicals.forEach((p) => (p.target = 0));
    this.ambient.intensity = 0.02;
  }

  restore(): void {
    this.practicals.forEach((p) => (p.target = p.base));
    this.ambient.intensity = 0.12;
  }

  /** Dim everything toward a factor of base (mood). */
  setMood(factor: number): void {
    this.practicals.forEach((p) => (p.target = p.base * factor));
  }

  update(dt: number): void {
    this.time += dt;
    for (const p of this.practicals) {
      let intensity = p.target;
      if (this.time < p.flickerUntil) {
        // erratic flicker
        const n = Math.sin(this.time * 47) * Math.sin(this.time * 13.3) * Math.sin(this.time * 91.7);
        intensity = p.target * (0.15 + 0.85 * (n > -0.2 ? 1 : Math.random() * 0.4));
      }
      p.light.intensity += (intensity - p.light.intensity) * Math.min(1, dt * 18);
      const mat = p.bulb.material as THREE.MeshBasicMaterial;
      const lit = p.light.intensity / (p.base || 1);
      mat.color.setRGB(1 * lit + 0.02, 0.85 * lit + 0.01, 0.6 * lit);
    }
  }
}
