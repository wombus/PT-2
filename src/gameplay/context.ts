import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import type { Player } from './Player';
import type { AudioManager } from '../core/AudioManager';
import type { Lighting } from '../world/Lighting';
import type { Props } from '../world/Props';
import type { Ui } from '../ui/Ui';
import type { PostProcessing } from '../core/PostProcessing';

/** Everything a scare needs to affect the world, plus a few helpers. */
export interface GameContext {
  engine: Engine;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  player: Player;
  audio: AudioManager;
  lighting: Lighting;
  props: Props;
  ui: Ui;
  post: PostProcessing;

  loop: number;

  /** World position `dist` metres behind the player at eye height. */
  behind(dist: number): THREE.Vector3;
  /** World position `dist` metres ahead of the player. */
  ahead(dist: number): THREE.Vector3;
  /** Is the camera looking roughly toward `p`? (dot > threshold) */
  isLookingAt(p: THREE.Vector3, threshold?: number): boolean;
  /** Left/right pan value (-1..1) of a world point relative to the camera. */
  panOf(p: THREE.Vector3): number;
  /** Force a full loop reset (used by the "caught" scare). */
  triggerReset(): void;
}

/** Base class for a self-contained scare. */
export abstract class Scare {
  active = false;
  protected t = 0;
  /** Guards that fully own the screen; the scheduler won't start another. */
  blocking = false;
  constructor(protected ctx: GameContext) {}
  abstract readonly id: string;

  start(): void {
    if (this.active) return;
    this.active = true;
    this.t = 0;
    this.onStart();
  }
  finish(): void {
    if (!this.active) return;
    this.active = false;
    this.onEnd();
  }
  protected onStart(): void {}
  protected onEnd(): void {}
  update(dt: number): void {
    this.t += dt;
    this.onUpdate(dt);
  }
  protected abstract onUpdate(dt: number): void;
}
