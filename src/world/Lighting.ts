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
 * Practical warm lighting with a flicker/blackout controller. The first light
 * hangs from a swinging pendant lamp whose shadow-casting PointLight tracks the
 * bulb, so shadows sway across the hall. The other two are cheap fill.
 */
export class Lighting {
  readonly group = new THREE.Group();
  private practicals: Practical[] = [];
  private ambient: THREE.HemisphereLight;
  private time = 0;

  private pendant: THREE.Group | null = null;
  private pendantBulb: THREE.Mesh | null = null;
  private bulbWorld = new THREE.Vector3();

  constructor(shadowMapSize: number) {
    // low cold ambient so shadows never go pure black-crushed
    this.ambient = new THREE.HemisphereLight(0x2a3040, 0x0a0806, 0.32);
    this.group.add(this.ambient);

    const positions: [number, number, number, boolean][] = [
      [0, LAYOUT.wallH - 0.3, -2.5, true],    // near landing (swinging pendant, shadow caster)
      [0, LAYOUT.wallH - 0.15, -8.5, false],  // deep in main corridor
      [-6.5, LAYOUT.wallH - 0.15, -10.9, false], // turn corridor
    ];

    const bulbGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const bulbMat = () => new THREE.MeshBasicMaterial({ color: 0xffd8a0 });

    positions.forEach(([x, y, z, shadow], idx) => {
      const light = new THREE.PointLight(0xffb15a, 26, 16, 2);
      light.position.set(x, y, z);
      if (shadow && shadowMapSize > 0) {
        light.castShadow = true;
        light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
        light.shadow.bias = -0.0015;
        light.shadow.normalBias = 0.02;
        light.shadow.radius = 6;         // softer contact shadows
        light.shadow.blurSamples = 24;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 16;
      }
      this.group.add(light);

      let bulb: THREE.Mesh;
      if (idx === 0) {
        bulb = this.buildPendant(x, y, z, bulbGeo, bulbMat());
      } else {
        bulb = new THREE.Mesh(bulbGeo, bulbMat());
        bulb.position.set(x, y, z);
        this.group.add(bulb);
        const cup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.1, 0.12, 12, 1, true),
          new THREE.MeshStandardMaterial({ color: 0x1a1712, roughness: 0.7, side: THREE.DoubleSide }),
        );
        cup.position.set(x, y + 0.08, z);
        this.group.add(cup);
      }

      this.practicals.push({ light, bulb, base: light.intensity, target: light.intensity, flickerUntil: 0 });
    });
  }

  /** Build the hanging pendant (pivot at the ceiling); returns the bulb mesh. */
  private buildPendant(x: number, y: number, z: number, bulbGeo: THREE.BufferGeometry, bulbMat: THREE.Material): THREE.Mesh {
    const pivot = new THREE.Group();
    pivot.position.set(x, LAYOUT.wallH, z);
    const drop = y - LAYOUT.wallH; // negative: bulb hangs below the pivot

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, Math.abs(drop) + 0.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 }),
    );
    cord.position.y = drop / 2;
    pivot.add(cord);

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.2, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x181410, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }),
    );
    shade.position.y = drop + 0.04;
    pivot.add(shade);

    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.y = drop - 0.02;
    pivot.add(bulb);

    // faint additive god-ray cone: narrow at the bulb, widening toward the floor
    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 2.2, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff9a4a,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    shaft.position.y = drop - 1.1;
    shaft.renderOrder = 3;
    pivot.add(shaft);

    this.group.add(pivot);
    this.pendant = pivot;
    this.pendantBulb = bulb;
    return bulb;
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
    this.ambient.intensity = 0.05;
  }

  restore(): void {
    this.practicals.forEach((p) => (p.target = p.base));
    this.ambient.intensity = 0.32;
  }

  /** Dim everything toward a factor of base (mood). */
  setMood(factor: number): void {
    this.practicals.forEach((p) => (p.target = p.base * factor));
  }

  update(dt: number): void {
    this.time += dt;

    // swing the pendant and drag its shadow-casting light with the bulb
    if (this.pendant && this.pendantBulb) {
      this.pendant.rotation.x = Math.sin(this.time * 0.9) * 0.035;
      this.pendant.rotation.z = Math.sin(this.time * 0.7 + 1.3) * 0.05;
      this.pendantBulb.getWorldPosition(this.bulbWorld);
      this.practicals[0].light.position.copy(this.bulbWorld);
    }

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
