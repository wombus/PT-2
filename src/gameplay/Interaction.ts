import * as THREE from 'three';

export interface Interactable {
  object: THREE.Object3D;
  prompt: string;
  enabled: boolean;
  maxDist: number;
  onInteract: () => void;
}

/**
 * Center-screen raycast interaction. Tracks the focused interactable and
 * reports it to the HUD; `use()` triggers it.
 */
export class Interaction {
  private ray = new THREE.Raycaster();
  private items: Interactable[] = [];
  focused: Interactable | null = null;

  constructor(private camera: THREE.PerspectiveCamera) {}

  add(item: Interactable): Interactable {
    this.items.push(item);
    return item;
  }

  update(): void {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const it of this.items) {
      if (!it.enabled) continue;
      const hits = this.ray.intersectObject(it.object, true);
      if (hits.length && hits[0].distance < it.maxDist && hits[0].distance < bestDist) {
        best = it;
        bestDist = hits[0].distance;
      }
    }
    this.focused = best;
  }

  use(): void {
    if (this.focused && this.focused.enabled) this.focused.onInteract();
  }
}
