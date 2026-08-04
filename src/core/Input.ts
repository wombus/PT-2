/**
 * Keyboard + pointer-lock mouse input. Accumulates mouse deltas each frame;
 * the Player consumes them. Fires callbacks on lock changes and interaction.
 */
export class Input {
  private keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;

  sensitivity = 1;
  invertY = false;

  onLockChange: (locked: boolean) => void = () => {};
  onInteract: () => void = () => {};
  onPause: () => void = () => {};
  onCanvasClick: () => void = () => {};

  private readonly el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;

    window.addEventListener('keydown', (e) => {
      const k = e.code;
      if (k === 'Escape') { this.onPause(); return; }
      this.keys.add(k);
      if (k === 'KeyE' || k === 'Space') this.onInteract();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    document.addEventListener('mousedown', () => {
      if (this.locked) this.onInteract();
      else this.onCanvasClick();
    });

    // pointer lock can be refused (e.g. Chrome's ~1s re-lock cooldown); don't crash
    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      this.onLockChange(false);
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) this.keys.clear();
      this.onLockChange(this.locked);
    });
  }

  requestLock(): void {
    // newer Chrome returns a promise that can reject; swallow it
    const r = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
    if (r && typeof r.catch === 'function') r.catch(() => {});
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** Returns and clears accumulated mouse movement, scaled by sensitivity. */
  consumeMouse(): { dx: number; dy: number } {
    const s = this.sensitivity * 0.0022;
    const dx = this.mouseDX * s;
    const dy = this.mouseDY * s * (this.invertY ? -1 : 1);
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }
}
