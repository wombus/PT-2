import * as THREE from 'three';
import { Input } from '../core/Input';
import { resolveMove, LAYOUT, SPAWN, SPAWN_YAW } from '../world/layout';
import { clamp, damp } from '../utils/math';

/**
 * First-person walker: mouse look, slow WASD movement with wall-slide
 * collision, headbob + subtle handheld sway, and footstep callbacks.
 * Deliberately slow — dread over speed.
 */
export class Player {
  yaw = SPAWN_YAW;
  pitch = 0;
  private pos = new THREE.Vector3().copy(SPAWN);
  private vel = new THREE.Vector3();
  private bobPhase = 0;
  private stepFlip = false;
  private swayT = 0;
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();

  /** External hooks. */
  onFootstep: (movingFast: boolean) => void = () => {};
  /** Set by scares to forcibly steer/lock the view. */
  frozen = false;

  constructor(private camera: THREE.PerspectiveCamera) {
    this.camera.rotation.order = 'YXZ';
    this.apply();
  }

  reset(): void {
    this.pos.copy(SPAWN);
    this.yaw = SPAWN_YAW;
    this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.apply();
  }

  get position(): THREE.Vector3 { return this.pos; }

  /** How much the player rotated this frame (rad) — used for turn scares. */
  lastYawDelta = 0;

  update(dt: number, input: Input): void {
    // ---- look ----
    const m = input.consumeMouse();
    if (!this.frozen) {
      const prevYaw = this.yaw;
      this.yaw -= m.dx;
      this.pitch -= m.dy;
      this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      this.lastYawDelta = this.yaw - prevYaw;
    } else {
      this.lastYawDelta = 0;
    }

    // ---- movement ----
    let fwd = 0, strafe = 0;
    if (!this.frozen) {
      const mv = input.getMove();
      fwd = mv.fwd;
      strafe = mv.strafe;
    }

    this.forward.set(Math.sin(this.yaw) * -1, 0, Math.cos(this.yaw) * -1);
    this.right.set(-this.forward.z, 0, this.forward.x);

    const speed = 1.5;
    const desired = new THREE.Vector3()
      .addScaledVector(this.forward, fwd)
      .addScaledVector(this.right, strafe);
    if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(speed);

    this.vel.lerp(desired, damp(dt, 9));

    const targetX = this.pos.x + this.vel.x * dt;
    const targetZ = this.pos.z + this.vel.z * dt;
    const [nx, nz] = resolveMove(this.pos.x, this.pos.z, targetX, targetZ);
    this.pos.x = nx;
    this.pos.z = nz;

    // ---- headbob + footsteps ----
    const moveSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.bobPhase += moveSpeed * dt * 5.2;
    const bobY = Math.sin(this.bobPhase * 2) * 0.035 * Math.min(1, moveSpeed);
    const roll = Math.sin(this.bobPhase) * 0.006 * Math.min(1, moveSpeed);

    const half = Math.sin(this.bobPhase) > 0;
    if (half !== this.stepFlip && moveSpeed > 0.4) {
      this.stepFlip = half;
      this.onFootstep(false);
    }

    // ---- idle handheld sway ----
    this.swayT += dt;
    const swayX = (Math.sin(this.swayT * 0.7) + Math.sin(this.swayT * 1.3)) * 0.0016;
    const swayY = (Math.sin(this.swayT * 0.9) + Math.sin(this.swayT * 1.7)) * 0.0016;

    this.pos.y = LAYOUT.eyeHeight + bobY;
    this.apply(roll, swayX, swayY);
  }

  private apply(roll = 0, swayX = 0, swayY = 0): void {
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch + swayY, this.yaw + swayX, roll);
  }

  /** Smoothly force the camera to look at a world point (for scripted scares). */
  lookAt(target: THREE.Vector3, dt: number, rate = 6): void {
    const dir = new THREE.Vector3().subVectors(target, this.pos);
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    const targetPitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    let dy = targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * damp(dt, rate);
    this.pitch += (targetPitch - this.pitch) * damp(dt, rate);
    this.apply();
  }
}
