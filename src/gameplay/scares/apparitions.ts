import * as THREE from 'three';
import { Scare } from '../context';
import { buildFigure, makeFaceTexture } from './figure';
import { LAYOUT } from '../../world/layout';

/** Lisa standing far down the hall; fades away if approached or stared at. */
export class Apparition extends Scare {
  readonly id = 'apparition';
  private fig = buildFigure();
  private opacity = 0;
  private target = 0.8;
  private headPoint = new THREE.Vector3();
  private breathStop: (() => void) | null = null;

  protected onStart(): void {
    // stand at the far end of the main corridor, facing the player
    this.fig.group.position.set(0, 0, LAYOUT.mainZBack + 0.4);
    this.fig.group.rotation.y = Math.PI;
    this.fig.setOpacity(0);
    this.opacity = 0;
    this.target = 0.85;
    this.ctx.scene.add(this.fig.group);
    // her presence is announced by slow, raspy breathing — no cheap sting
    this.breathStop = this.ctx.audio.breathing(0);
    this.ctx.audio.setTension(0.6);
  }

  protected onUpdate(dt: number): void {
    this.opacity += (this.target - this.opacity) * Math.min(1, dt * 3);
    this.fig.setOpacity(this.opacity);
    this.headPoint.copy(this.fig.group.position).setY(1.6);

    const dist = this.ctx.player.position.distanceTo(this.fig.group.position);
    const staring = this.ctx.isLookingAt(this.headPoint, 0.9);

    // vanish if the player gets close or stares it down
    if (dist < 3.5 || (staring && this.t > 1.5) || this.t > 10) {
      this.target = 0;
      if (this.opacity < 0.05) this.finish();
    }
  }

  protected onEnd(): void {
    if (this.breathStop) { this.breathStop(); this.breathStop = null; }
    this.ctx.scene.remove(this.fig.group);
    this.ctx.audio.setTension(0.2);
  }
}

/** A figure materialises behind the player; lunges when they turn to look. */
export class BehindYou extends Scare {
  readonly id = 'behind';
  private fig = buildFigure();
  private opacity = 0;
  private lunged = false;
  private headPoint = new THREE.Vector3();
  private breathStop: (() => void) | null = null;

  protected onStart(): void {
    const p = this.ctx.behind(2.6);
    this.fig.group.position.copy(p);
    this.fig.group.lookAt(this.ctx.player.position.x, 0, this.ctx.player.position.z);
    this.fig.setOpacity(0);
    this.opacity = 0;
    this.ctx.scene.add(this.fig.group);
    this.ctx.audio.footstep(0, 0.35);
    // breathing right behind you
    this.breathStop = this.ctx.audio.breathing(0);
    this.ctx.audio.setTension(0.7);
  }

  protected onUpdate(dt: number): void {
    this.opacity = Math.min(0.9, this.opacity + dt * 1.5);
    this.fig.setOpacity(this.opacity);
    this.headPoint.copy(this.fig.group.position).setY(1.6);

    if (Math.random() < dt * 1.2) this.ctx.audio.whisper(this.ctx.panOf(this.headPoint));

    const looking = this.ctx.isLookingAt(this.headPoint, 0.55);
    if (looking && !this.lunged) {
      this.lunged = true;
      if (this.breathStop) { this.breathStop(); this.breathStop = null; }
      this.ctx.audio.stinger(1);
      this.ctx.ui.flash(0.9);
      this.ctx.lighting.flicker(0.6);
    }
    if (this.lunged) {
      // rush the camera then vanish
      const toP = new THREE.Vector3().subVectors(this.ctx.player.position, this.fig.group.position);
      toP.y = 0;
      this.fig.group.position.addScaledVector(toP.normalize(), dt * 6);
      if (this.t > (this.lungeStart() + 0.35)) this.finish();
    } else if (this.t > 9) {
      this.finish();
    }
  }

  private lungeT = -1;
  private lungeStart(): number {
    if (this.lunged && this.lungeT < 0) this.lungeT = this.t;
    return this.lungeT < 0 ? this.t : this.lungeT;
  }

  protected onEnd(): void {
    if (this.breathStop) { this.breathStop(); this.breathStop = null; }
    this.ctx.scene.remove(this.fig.group);
    this.ctx.audio.setTension(0.2);
  }
}

/** Total blackout, then a flash reveals a face inches away. */
export class BlackoutReveal extends Scare {
  readonly id = 'blackout';
  blocking = true;
  private fig = buildFigure();
  private revealed = false;

  protected onStart(): void {
    this.ctx.lighting.blackout();
    this.ctx.audio.setTension(1);
    const p = this.ctx.ahead(1.6);
    this.fig.group.position.copy(p);
    this.fig.group.lookAt(this.ctx.player.position.x, 0, this.ctx.player.position.z);
    this.fig.setOpacity(0);
    this.ctx.scene.add(this.fig.group);
  }

  protected onUpdate(dt: number): void {
    if (this.t < 1.8) {
      if (Math.random() < dt * 3) this.ctx.audio.heartbeat(0.5);
    } else if (!this.revealed) {
      this.revealed = true;
      // face right in front
      this.fig.group.position.copy(this.ctx.ahead(0.8));
      this.fig.setOpacity(1);
      this.ctx.ui.flash(1);
      this.ctx.audio.stinger(1);
    } else if (this.t > 2.4) {
      this.finish();
    }
  }

  protected onEnd(): void {
    this.ctx.scene.remove(this.fig.group);
    this.ctx.lighting.restore();
    this.ctx.audio.setTension(0.2);
  }
}

/** Figure sprints down the hall at the player; contact resets the loop. */
export class Charger extends Scare {
  readonly id = 'charger';
  blocking = true;
  private fig = buildFigure();
  private caught = false;
  private beatT = 0;

  protected onStart(): void {
    this.fig.group.position.set(0, 0, LAYOUT.mainZBack + 0.3);
    this.fig.setOpacity(0.95);
    this.ctx.scene.add(this.fig.group);
    this.ctx.lighting.flicker(4);
    this.ctx.audio.setTension(1);
  }

  protected onUpdate(dt: number): void {
    if (this.caught) return;
    // charge toward the player on the floor plane
    const to = new THREE.Vector3().subVectors(this.ctx.player.position, this.fig.group.position);
    to.y = 0;
    const dist = to.length();
    this.fig.group.position.addScaledVector(to.normalize(), dt * 4.2);
    this.fig.group.lookAt(this.ctx.player.position.x, 0, this.ctx.player.position.z);

    this.beatT -= dt;
    if (this.beatT <= 0) { this.ctx.audio.heartbeat(0.7); this.beatT = Math.max(0.2, dist * 0.09); }
    this.ctx.audio.footstep(this.ctx.panOf(this.fig.group.position), 0.3);

    if (dist < 1.0) {
      this.caught = true;
      this.ctx.ui.flash(1);
      this.ctx.audio.stinger(1);
      this.ctx.ui.setDamage(1);
      window.setTimeout(() => this.ctx.ui.setDamage(0), 500);
      this.ctx.triggerReset();
      this.finish();
    } else if (this.t > 12) {
      this.finish();
    }
  }

  protected onEnd(): void {
    this.ctx.scene.remove(this.fig.group);
    this.ctx.audio.setTension(0.2);
  }
}

/** A face surfaces in the bathroom mirror; stinger when the player sees it. */
export class MirrorFace extends Scare {
  readonly id = 'mirror';
  private face = makeFaceTexture();
  private seen = false;

  protected onStart(): void {
    this.ctx.props.mirrorFlash(this.face);
    this.ctx.audio.whisper(-0.3);
    this.ctx.audio.setTension(0.6);
  }

  protected onUpdate(_dt: number): void {
    const looking = this.ctx.isLookingAt(this.ctx.props.mirror.position, 0.8);
    if (looking && !this.seen && this.t > 0.4) {
      this.seen = true;
      this.ctx.audio.stinger(0.8);
      this.ctx.ui.flash(0.5);
      this.ctx.lighting.flicker(0.4);
    }
    if ((this.seen && this.t > 1.2) || this.t > 9) this.finish();
  }

  protected onEnd(): void {
    this.ctx.props.mirrorFlash(null);
    this.ctx.audio.setTension(0.2);
  }
}
