import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
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
  private floorReflector: Reflector | null = null;

  constructor(envMap: THREE.Texture | null, reflections = false) {
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

    // Real-time planar reflection blended over the varnished boards, so the
    // lamp, walls and figures genuinely reflect in the polished floor.
    // Gated to High/Ultra (it is an extra full scene render each frame).
    const refl = new Reflector(new THREE.PlaneGeometry(12.4, 14.2), {
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x888888,
    });
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(-5, 0.008, -5);
    const rmat = refl.material as THREE.ShaderMaterial;
    rmat.transparent = true;
    rmat.depthWrite = false;
    // blend the reflection at ~30% over the wood beneath (subtle gloss, not a mirror)
    rmat.fragmentShader = rmat.fragmentShader.replace(
      'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
      'gl_FragColor = vec4( base.rgb, 0.3 );',
    );
    rmat.needsUpdate = true;
    refl.renderOrder = 1;
    refl.visible = reflections;
    this.floorReflector = refl;
    this.group.add(refl);

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

    // wainscoting + chair rail on the long main-corridor walls (X-normal)
    // [cx, cz, sz, sign] — sign points from the wall toward the corridor
    const wainscots: [number, number, number, number][] = [
      [LAYOUT.wallX, -5, 14, -1],       // right wall (full length)
      [-LAYOUT.wallX, -3.95, 11.8, +1], // left wall (upper part)
    ];
    for (const [cx, cz, sz, sign] of wainscots) {
      const backer = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.79, sz * 0.98), trimMat);
      backer.position.set(cx + sign * 0.06, 0.555, cz);
      this.group.add(backer);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, sz + 0.02), trimMat);
      rail.position.set(cx + sign * 0.05, 0.95, cz);
      this.group.add(rail);
      const stiles = Math.max(2, Math.floor(sz / 0.9));
      for (let i = 0; i <= stiles; i++) {
        const z = cz - sz / 2 + (i / stiles) * sz;
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.79, 0.05), trimMat);
        stile.position.set(cx + sign * 0.075, 0.555, z);
        this.group.add(stile);
      }
    }

    // door casings (jambs + header)
    const casing = (cx: number, cz: number, vertical: boolean, w: number): void => {
      const jambGeo = vertical
        ? new THREE.BoxGeometry(0.04, 2.2, 0.09)
        : new THREE.BoxGeometry(0.09, 2.2, 0.04);
      const headGeo = vertical
        ? new THREE.BoxGeometry(0.04, 0.1, w + 0.18)
        : new THREE.BoxGeometry(w + 0.18, 0.1, 0.04);
      for (const s of [-1, 1]) {
        const jamb = new THREE.Mesh(jambGeo, trimMat);
        if (vertical) jamb.position.set(cx, 1.1, cz + s * w / 2);
        else jamb.position.set(cx + s * w / 2, 1.1, cz);
        this.group.add(jamb);
      }
      const header = new THREE.Mesh(headGeo, trimMat);
      header.position.set(cx, 2.16, cz);
      this.group.add(header);
    };
    casing(-10.86, -10.9, true, 0.95);  // end door (X-normal wall)
    casing(0, 1.98, false, 1.1);        // landing door (Z-normal wall)
  }

  get material(): THREE.MeshStandardMaterial {
    return this.wallMat;
  }

  /** Toggle the live floor reflection (quality-driven). */
  setReflections(enabled: boolean): void {
    if (this.floorReflector) this.floorReflector.visible = enabled;
  }
}
