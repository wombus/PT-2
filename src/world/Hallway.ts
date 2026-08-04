import * as THREE from 'three';
import { LAYOUT } from './layout';
import { wallpaperMaterial, floorMaterial, plasterMaterial, woodMaterial } from './Materials';

/**
 * Builds the static L-shaped hallway shell (floor, ceiling, walls, trim).
 * Exposes named surfaces so variants/scares can mutate them (e.g. add blood,
 * swap a wall to an opening).
 */
export class Hallway {
  readonly group = new THREE.Group();
  readonly walls: Record<string, THREE.Mesh> = {};
  private wallMat: THREE.MeshStandardMaterial;

  constructor(envMap: THREE.Texture | null) {
    this.wallMat = wallpaperMaterial();
    const floorMat = floorMaterial();
    const ceilMat = plasterMaterial('#161410');
    const trimMat = woodMaterial('#241611');
    if (envMap) {
      [this.wallMat, floorMat, ceilMat, trimMat].forEach((m) => {
        m.envMap = envMap;
        m.envMapIntensity = 0.35;
      });
      floorMat.envMapIntensity = 0.6;
    }

    const { wallH } = LAYOUT;

    // Floor + ceiling spanning the bounding box (unseen corner is walled off).
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12.4, 14.2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-5, 0, -5);
    floor.receiveShadow = true;
    this.group.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12.4, 14.2), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(-5, wallH, -5);
    ceil.receiveShadow = true;
    this.group.add(ceil);

    // Walls: [name, cx, cz, sizeX, sizeZ]
    const W: [string, number, number, number, number][] = [
      ['right', LAYOUT.wallX, -5, 0.1, 14],            // main corridor right (+X)
      ['left', -LAYOUT.wallX, -3.95, 0.1, 11.8],       // main corridor left (upper part)
      ['landing', 0, 2.05, 2.3, 0.1],                  // behind spawn (basement door)
      ['far', -4.95, -12.05, 12.2, 0.1],               // far wall (spans both corridors)
      ['turnNear', -6.05, -9.85, 9.9, 0.1],            // near wall of the turn corridor
      ['end', -11.05, -10.9, 0.1, 2.3],                // end-door wall
    ];
    for (const [name, cx, cz, sx, sz] of W) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, wallH, sz), this.wallMat);
      mesh.position.set(cx, wallH / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.walls[name] = mesh;
      this.group.add(mesh);

      // baseboard
      const bb = new THREE.Mesh(
        new THREE.BoxGeometry(sx + 0.04, 0.16, sz + 0.04),
        trimMat,
      );
      bb.position.set(cx, 0.08, cz);
      this.group.add(bb);
      // crown molding
      const crown = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.04, 0.1, sz + 0.04), trimMat);
      crown.position.set(cx, wallH - 0.05, cz);
      this.group.add(crown);
    }
  }

  get material(): THREE.MeshStandardMaterial {
    return this.wallMat;
  }
}
