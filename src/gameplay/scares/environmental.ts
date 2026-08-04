import * as THREE from 'three';
import { Scare } from '../context';
import { LAYOUT } from '../../world/layout';
import { bloodTexture } from '../../world/Materials';

/** Portraits turn disturbing while you aren't looking; a jolt when you notice. */
export class PortraitChange extends Scare {
  readonly id = 'portraits';
  private noticed = false;
  private point = new THREE.Vector3(LAYOUT.wallX, 1.6, -5);

  protected onStart(): void {
    this.ctx.props.disturbingPortraits = true;
    this.ctx.props.applyPortraits();
    this.ctx.audio.whisper(0.4);
  }

  protected onUpdate(_dt: number): void {
    if (!this.noticed && this.ctx.isLookingAt(this.point, 0.75) && this.t > 0.3) {
      this.noticed = true;
      this.ctx.audio.stinger(0.5);
      this.ctx.lighting.flicker(0.3);
    }
    if ((this.noticed && this.t > 1) || this.t > 12) this.finish();
  }
}

/** The clock spins wildly and strikes an impossible hour. */
export class ClockEvent extends Scare {
  readonly id = 'clock';
  private strikes = 0;
  private nextStrike = 0;

  protected onStart(): void {
    this.ctx.props.clockSpin = 10;
    this.ctx.audio.setTension(0.5);
  }

  protected onUpdate(dt: number): void {
    this.nextStrike -= dt;
    if (this.nextStrike <= 0 && this.strikes < 13) {
      this.ctx.audio.knock(0.2, 0.6);
      this.strikes++;
      this.nextStrike = 0.32;
    }
    if (this.t > 2.4) {
      this.ctx.props.clockSpin = 0;
      this.finish();
    }
  }

  protected onEnd(): void { this.ctx.audio.setTension(0.2); }
}

/** Bangs and footsteps circle the player from beyond the walls. */
export class BangingFootsteps extends Scare {
  readonly id = 'banging';
  private next = 0;

  protected onStart(): void {
    this.ctx.audio.setTension(0.55);
  }

  protected onUpdate(dt: number): void {
    this.next -= dt;
    if (this.next <= 0) {
      const pan = Math.sin(this.t * 2.3);
      if (Math.random() < 0.5) this.ctx.audio.knock(pan, 0.8);
      else this.ctx.audio.footstep(pan, 0.4);
      this.next = 0.25 + Math.random() * 0.35;
    }
    if (this.t > 4.5) this.finish();
  }

  protected onEnd(): void { this.ctx.audio.setTension(0.2); }
}

/** A single violent slam. */
export class DoorSlam extends Scare {
  readonly id = 'slam';

  protected onStart(): void {
    this.ctx.audio.knock(0, 1);
    this.ctx.audio.stinger(0.4);
    this.ctx.lighting.flicker(0.5);
    this.ctx.props.closeDoor();
  }
  protected onUpdate(_dt: number): void { if (this.t > 0.6) this.finish(); }
}

/** Blood floods the walls and floor; the screen sickens. */
export class Bloodbath extends Scare {
  readonly id = 'blood';
  private decals: THREE.Mesh[] = [];
  private growth = 0;
  private static pool: THREE.Mesh[] = [];

  protected onStart(): void {
    this.ctx.audio.setTension(0.9);
    this.ctx.audio.whisper(0);
    const tex = bloodTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });

    const spots: [number, number, number, number][] = [
      // x, y, z, yaw  (walls + floor)
      [LAYOUT.wallX - 0.02, 1.4, -4, -Math.PI / 2],
      [LAYOUT.wallX - 0.02, 1.7, -8, -Math.PI / 2],
      [-LAYOUT.wallX + 0.02, 1.5, -6, Math.PI / 2],
      [-4, 0.02, -11.4, 0],  // floor near far wall (handled below)
      [-2, 0.02, -6, 0],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [x, y, z, yaw] = spots[i];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), mat);
      if (y < 0.1) { m.rotation.x = -Math.PI / 2; } else { m.rotation.y = yaw; }
      m.position.set(x, y, z);
      m.scale.setScalar(0.01);
      m.renderOrder = 1;
      this.ctx.scene.add(m);
      this.decals.push(m);
      Bloodbath.pool.push(m);
    }
    // cap total persistent decals
    while (Bloodbath.pool.length > 24) {
      const old = Bloodbath.pool.shift()!;
      old.removeFromParent();
    }
  }

  protected onUpdate(dt: number): void {
    this.growth = Math.min(1, this.growth + dt * 0.8);
    for (const d of this.decals) d.scale.setScalar(0.01 + this.growth * 1.1);
    this.ctx.ui.setDamage(Math.sin(this.t * 3) * 0.15 + 0.15);
    if (this.t > 3.2) {
      this.ctx.ui.setDamage(0);
      this.finish();
    }
  }

  protected onEnd(): void { this.ctx.audio.setTension(0.3); }
}
