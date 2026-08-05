/**
 * Input for both desktop (keyboard + pointer-lock mouse) and touch (left-thumb
 * virtual stick to move, right-thumb drag to look, tap to interact). Movement
 * and look feed the same pipeline the Player already consumes.
 */
const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);
const STICK_R = 60; // joystick radius in px

export class Input {
  private keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;

  sensitivity = 1;
  invertY = false;

  // touch
  readonly touchCapable: boolean;
  touch = false;            // becomes true once the user touches the screen
  private moveX = 0;        // virtual stick output (-1..1)
  private moveY = 0;
  // exposed for the on-screen stick visual
  stickActive = false;
  stickOX = 0; stickOY = 0; stickKX = 0; stickKY = 0;

  onLockChange: (locked: boolean) => void = () => {};
  onInteract: () => void = () => {};
  onPause: () => void = () => {};
  onCanvasClick: () => void = () => {};

  private readonly el: HTMLElement;
  private moveId: number | null = null;
  private moveOX = 0; private moveOY = 0;
  private lookId: number | null = null;
  private lookLX = 0; private lookLY = 0; private lookMoved = 0; private lookStart = 0;

  constructor(el: HTMLElement) {
    this.el = el;
    this.touchCapable = typeof matchMedia !== 'undefined'
      && matchMedia('(pointer: coarse)').matches
      && !matchMedia('(pointer: fine)').matches;

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
      if (this.touch) return; // touch fires synthetic mouse events — ignore
      if (this.locked) this.onInteract();
      else this.onCanvasClick();
    });

    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      this.onLockChange(false);
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) this.keys.clear();
      this.onLockChange(this.locked);
    });

    this.bindTouch();
  }

  private bindTouch(): void {
    const start = (e: TouchEvent): void => {
      this.touch = true;
      for (const t of Array.from(e.changedTouches)) {
        const leftHalf = t.clientX < window.innerWidth * 0.5;
        if (leftHalf && this.moveId === null) {
          this.moveId = t.identifier;
          this.moveOX = t.clientX; this.moveOY = t.clientY;
          this.stickActive = true;
          this.stickOX = t.clientX; this.stickOY = t.clientY;
          this.stickKX = t.clientX; this.stickKY = t.clientY;
        } else if (this.lookId === null) {
          this.lookId = t.identifier;
          this.lookLX = t.clientX; this.lookLY = t.clientY;
          this.lookMoved = 0; this.lookStart = performance.now();
        }
      }
      e.preventDefault();
    };
    const move = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.moveId) {
          const dx = t.clientX - this.moveOX;
          const dy = t.clientY - this.moveOY;
          const len = Math.hypot(dx, dy) || 1;
          const cl = Math.min(len, STICK_R);
          const nx = (dx / len) * cl;
          const ny = (dy / len) * cl;
          this.moveX = nx / STICK_R;
          this.moveY = -ny / STICK_R; // up = forward
          this.stickKX = this.stickOX + nx;
          this.stickKY = this.stickOY + ny;
        } else if (t.identifier === this.lookId) {
          const dx = t.clientX - this.lookLX;
          const dy = t.clientY - this.lookLY;
          this.lookLX = t.clientX; this.lookLY = t.clientY;
          this.lookMoved += Math.abs(dx) + Math.abs(dy);
          this.mouseDX += dx * 1.5;
          this.mouseDY += dy * 1.5;
        }
      }
      e.preventDefault();
    };
    const end = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.moveId) {
          this.moveId = null; this.moveX = 0; this.moveY = 0; this.stickActive = false;
        } else if (t.identifier === this.lookId) {
          const dur = performance.now() - this.lookStart;
          if (this.lookMoved < 12 && dur < 300) this.onInteract(); // tap = interact
          this.lookId = null;
        }
      }
    };
    this.el.addEventListener('touchstart', start, { passive: false });
    this.el.addEventListener('touchmove', move, { passive: false });
    this.el.addEventListener('touchend', end);
    this.el.addEventListener('touchcancel', end);
  }

  requestLock(): void {
    const r = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
    if (r && typeof r.catch === 'function') r.catch(() => {});
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** Combined movement intent from keyboard + virtual stick. */
  getMove(): { fwd: number; strafe: number } {
    let fwd = this.moveY;
    let strafe = this.moveX;
    if (this.isDown('KeyW', 'ArrowUp')) fwd += 1;
    if (this.isDown('KeyS', 'ArrowDown')) fwd -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) strafe += 1;
    if (this.isDown('KeyA', 'ArrowLeft')) strafe -= 1;
    return { fwd: clamp1(fwd), strafe: clamp1(strafe) };
  }

  /** Returns and clears accumulated look movement, scaled by sensitivity. */
  consumeMouse(): { dx: number; dy: number } {
    const s = this.sensitivity * 0.0022;
    const dx = this.mouseDX * s;
    const dy = this.mouseDY * s * (this.invertY ? -1 : 1);
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }
}
