import * as THREE from 'three';
import { LAYOUT } from './layout';

/** Soft round sprite for a dust mote. */
function moteSprite(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,244,224,1)');
  g.addColorStop(0.4, 'rgba(255,240,214,0.5)');
  g.addColorStop(1, 'rgba(255,240,214,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// lamp anchors dust clusters around (matches Lighting practicals)
const LAMPS: [number, number][] = [
  [0, -2.5], [0, -8.5], [-6.5, -10.9],
];

/**
 * Slow-drifting dust motes that thicken around the practical lights and catch
 * them in the fog. Purely decorative; additive + depthWrite off so it never
 * occludes geometry.
 */
export class Atmosphere {
  readonly group = new THREE.Group();
  private positions: Float32Array;
  private velocities: Float32Array;
  private count: number;
  private geo: THREE.BufferGeometry;

  constructor(count: number) {
    this.count = Math.max(0, count);
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      this.seed(i, true);
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      map: moteSprite(),
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffe9c8,
    });

    const points = new THREE.Points(this.geo, mat);
    points.frustumCulled = false;
    this.group.add(points);
  }

  private seed(i: number, anywhereY: boolean): void {
    const near = Math.random() < 0.6;
    let x: number, z: number;
    if (near) {
      const [lx, lz] = LAMPS[(Math.random() * LAMPS.length) | 0];
      x = lx + (Math.random() - 0.5) * 2.2;
      z = lz + (Math.random() - 0.5) * 3.5;
    } else if (Math.random() < 0.7) {
      x = (Math.random() - 0.5) * 2 * LAYOUT.half;
      z = LAYOUT.mainZBack + Math.random() * (LAYOUT.mainZFront - LAYOUT.mainZBack);
    } else {
      x = LAYOUT.turnXEnd + Math.random() * (LAYOUT.half - LAYOUT.turnXEnd);
      z = LAYOUT.mainZBack + Math.random() * (LAYOUT.turnZNear - LAYOUT.mainZBack);
    }
    const y = anywhereY ? Math.random() * LAYOUT.wallH : 0.05;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.velocities[i * 3] = (Math.random() - 0.5) * 0.04;
    this.velocities[i * 3 + 1] = 0.01 + Math.random() * 0.03;
    this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
  }

  update(dt: number, time: number): void {
    if (this.count === 0) return;
    const p = this.positions;
    const v = this.velocities;
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      p[j] += (v[j] + Math.sin(time * 0.5 + i) * 0.006) * dt;
      p[j + 1] += v[j + 1] * dt;
      p[j + 2] += (v[j + 2] + Math.cos(time * 0.4 + i * 0.7) * 0.006) * dt;
      if (p[j + 1] > LAYOUT.wallH) this.seed(i, false); // rose to ceiling → respawn low
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
