import type { GameContext } from './context';
import type { ScareSystem } from './ScareSystem';

/**
 * The heart of P.T.: the door at the end of the hall drops you back at the
 * start of the same hallway, one loop deeper and progressively more wrong.
 */
export class LoopManager {
  loop = 0;
  private busy = false;

  constructor(private ctx: GameContext, private scares: ScareSystem) {}

  /** Start a fresh descent from loop 0. */
  begin(): void {
    this.loop = 0;
    this.ctx.loop = 0;
    this.ctx.player.reset();
    this.scares.onNewLoop(0);
    this.updateIndicator();
    this.ctx.ui.fadeTo(0, 1600);
  }

  /** Player opened + walked through the end door. */
  advance(): void {
    this.transition(true);
  }

  /** Forced reset (e.g. caught). Skips the door beat. */
  hardReset(): void {
    this.transition(false);
  }

  private transition(withDoor: boolean): void {
    if (this.busy) return;
    this.busy = true;
    if (withDoor) this.ctx.props.openDoor();
    this.ctx.player.frozen = true;
    this.ctx.ui.fadeTo(1, withDoor ? 700 : 350);

    window.setTimeout(() => {
      this.scares.reset();
      this.ctx.player.reset();
      this.ctx.props.closeDoor();
      this.ctx.props.disturbingPortraits = false;
      this.ctx.props.applyPortraits();
      this.ctx.lighting.restore();

      this.loop += 1;
      this.ctx.loop = this.loop;
      this.scares.onNewLoop(this.loop);
      this.updateIndicator();

      this.ctx.ui.fadeTo(0, 1000);
      window.setTimeout(() => {
        this.ctx.player.frozen = false;
        this.busy = false;
      }, 700);
    }, withDoor ? 750 : 400);
  }

  get transitioning(): boolean { return this.busy; }

  private updateIndicator(): void {
    // deliberately obscure, like a memory you can't place
    const n = this.loop;
    this.ctx.ui.setLoopIndicator(n === 0 ? '' : `${n} · ${'—'.repeat(Math.min(n, 8))}`);
  }
}
