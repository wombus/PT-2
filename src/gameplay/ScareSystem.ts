import type { GameContext, Scare } from './context';
import { pathProgress } from '../world/layout';
import { pick, chance } from '../utils/rng';
import { Apparition, BehindYou, BlackoutReveal, Charger, MirrorFace } from './scares/apparitions';
import { PortraitChange, ClockEvent, BangingFootsteps, DoorSlam, Bloodbath } from './scares/environmental';

interface Event { p: number; id: string; fired: boolean; }

/**
 * Schedules scares. One discrete scare runs at a time (position-triggered by
 * the player's progress down the hall), on top of a continuous bed of ambient
 * dread that intensifies with the loop count.
 */
export class ScareSystem {
  private scares = new Map<string, Scare>();
  active: Scare | null = null;
  private schedule: Event[] = [];
  private ambientNext = 3;

  constructor(private ctx: GameContext) {
    const list: Scare[] = [
      new Apparition(ctx), new BehindYou(ctx), new BlackoutReveal(ctx),
      new Charger(ctx), new MirrorFace(ctx),
      new PortraitChange(ctx), new ClockEvent(ctx), new BangingFootsteps(ctx),
      new DoorSlam(ctx), new Bloodbath(ctx),
    ];
    for (const s of list) this.scares.set(s.id, s);
  }

  /** Build the scripted beats + mood for a loop and reset fired flags. */
  onNewLoop(loop: number): void {
    this.reset();
    const S = (p: number, id: string): Event => ({ p, id, fired: false });

    const scripts: Event[][] = [
      // 0 — uneasy calm
      [S(0.55, 'clock')],
      // 1 — the portraits, and something in the walls
      [S(0.2, 'portraits'), S(0.7, 'banging')],
      // 2 — she is at the end of the hall; a face in the mirror
      [S(0.35, 'mirror'), S(0.8, 'apparition')],
      // 3 — behind you, then the dark
      [S(0.3, 'banging'), S(0.6, 'behind'), S(0.9, 'blackout')],
      // 4 — blood
      [S(0.25, 'portraits'), S(0.5, 'bloodbath'), S(0.85, 'slam')],
      // 5 — the chase
      [S(0.4, 'apparition'), S(0.75, 'charger')],
    ];

    if (loop < scripts.length) {
      this.schedule = scripts[loop];
    } else {
      // procedural escalation: pick several at random thresholds
      const ids = ['portraits', 'banging', 'mirror', 'apparition', 'behind', 'blackout', 'bloodbath', 'slam', 'clock'];
      const n = 3 + (loop % 3);
      this.schedule = [];
      for (let i = 0; i < n; i++) this.schedule.push(S(0.15 + (i / n) * 0.75, pick(ids)));
      if (chance(0.5)) this.schedule.push(S(0.9, 'charger'));
    }

    // mood
    const dark = Math.min(0.75, loop * 0.12);
    this.ctx.lighting.setMood(1 - dark);
    this.ctx.audio.setTension(0.15 + dark * 0.4);

    // ringing phone on certain loops
    this.ctx.props.setPhoneRinging(loop === 1 || loop === 4 || (loop > 5 && chance(0.4)));
  }

  reset(): void {
    if (this.active) { this.active.finish(); this.active = null; }
    this.ctx.props.setPhoneRinging(false);
  }

  private trigger(id: string): void {
    if (this.active) return;
    const s = this.scares.get(id);
    if (!s) return;
    s.start();
    this.active = s;
  }

  update(dt: number): void {
    // ambient dread bed
    this.ambientNext -= dt;
    if (this.ambientNext <= 0) {
      const loop = this.ctx.loop;
      const pan = Math.random() * 2 - 1;
      const r = Math.random();
      if (r < 0.4) this.ctx.audio.whisper(pan);
      else if (r < 0.7) this.ctx.audio.footstep(pan, 0.2);
      else if (r < 0.9) this.ctx.audio.knock(pan, 0.4);
      else this.ctx.audio.heartbeat(0.35);
      this.ambientNext = Math.max(1.5, 7 - loop * 0.6) * (0.6 + Math.random());
    }

    if (this.active) {
      this.active.update(dt);
      if (!this.active.active) this.active = null;
      return;
    }

    const prog = pathProgress(this.ctx.player.position.x, this.ctx.player.position.z);
    for (const ev of this.schedule) {
      if (!ev.fired && prog >= ev.p) {
        ev.fired = true;
        this.trigger(ev.id);
        break;
      }
    }
  }

  /** True while a screen-owning scare (charge/blackout) is running. */
  get blocking(): boolean {
    return !!this.active && this.active.blocking;
  }

  /** 0..1 dread level driving the post-process grade. */
  get fearLevel(): number {
    if (!this.active) return Math.min(0.25, this.ctx.loop * 0.03);
    return this.active.blocking ? 1 : 0.5;
  }
}
