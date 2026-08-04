import type { QualityLevel } from '../core/Quality';

export interface UiCallbacks {
  onBegin: () => void;   // Enter pressed on title
  onAccept: () => void;  // content warning accepted -> start play
  onResume: () => void;
  onQuality: (q: QualityLevel) => void;
  onSensitivity: (v: number) => void;
  onMaster: (v: number) => void;
  onInvert: (v: boolean) => void;
}

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing #${id}`);
  return e as T;
}

/** Owns every DOM overlay: menus, HUD, and full-screen effect layers. */
export class Ui {
  private loading = el('loading');
  private loadingFill = el('loading-fill');
  private start = el('start');
  private warning = el('warning');
  private pause = el('pause');
  private hud = el('hud');
  private pauseHint = el('pause-hint');
  private clickHint = el('click-hint');

  private reticle = el('reticle');
  private prompt = el('prompt');
  private subtitle = el('subtitle');
  private loopIndicator = el('loop-indicator');

  private fade = el('fade');
  private flashEl = el('flash');
  private damage = el('damage');

  private subtitleTimer = 0;

  constructor(cb: UiCallbacks) {
    el<HTMLButtonElement>('btn-begin').addEventListener('click', () => cb.onBegin());
    el<HTMLButtonElement>('btn-accept').addEventListener('click', () => cb.onAccept());
    el<HTMLButtonElement>('btn-resume').addEventListener('click', () => cb.onResume());

    el<HTMLSelectElement>('set-quality').addEventListener('change', (e) =>
      cb.onQuality((e.target as HTMLSelectElement).value as QualityLevel));
    el<HTMLInputElement>('set-sens').addEventListener('input', (e) =>
      cb.onSensitivity(parseFloat((e.target as HTMLInputElement).value)));
    el<HTMLInputElement>('set-master').addEventListener('input', (e) =>
      cb.onMaster(parseFloat((e.target as HTMLInputElement).value)));
    el<HTMLInputElement>('set-invert').addEventListener('change', (e) =>
      cb.onInvert((e.target as HTMLInputElement).checked));
  }

  // ---- loading / menus ----
  setLoading(frac: number): void { this.loadingFill.style.width = `${Math.round(frac * 100)}%`; }
  showTitle(): void { this.loading.classList.add('hidden'); this.start.classList.remove('hidden'); }
  showWarning(): void { this.start.classList.add('hidden'); this.warning.classList.remove('hidden'); }
  hideMenus(): void {
    this.start.classList.add('hidden');
    this.warning.classList.add('hidden');
    this.pause.classList.add('hidden');
  }
  showPause(): void { this.pause.classList.remove('hidden'); }
  hidePause(): void { this.pause.classList.add('hidden'); }

  showClickHint(): void { this.clickHint.classList.remove('hidden'); }
  hideClickHint(): void { this.clickHint.classList.add('hidden'); }

  enterGame(): void {
    this.hideMenus();
    this.hud.classList.remove('hidden');
    this.pauseHint.classList.remove('hidden');
  }

  setQualitySelect(q: QualityLevel): void { el<HTMLSelectElement>('set-quality').value = q; }

  // ---- HUD ----
  setPrompt(text: string | null): void {
    if (text) { this.prompt.textContent = text; this.prompt.classList.add('show'); }
    else this.prompt.classList.remove('show');
  }
  setReticleActive(active: boolean): void {
    this.reticle.classList.toggle('active', active);
  }
  setLoopIndicator(text: string): void { this.loopIndicator.textContent = text; }

  say(text: string, seconds = 4): void {
    this.subtitle.textContent = text;
    this.subtitle.classList.add('show');
    this.subtitleTimer = seconds;
  }

  // ---- full-screen effects ----
  fadeTo(alpha: number, ms = 600): void {
    this.fade.style.transition = `opacity ${ms}ms ease`;
    this.fade.style.opacity = String(alpha);
  }
  flash(intensity = 1): void {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = String(intensity);
    requestAnimationFrame(() => {
      this.flashEl.style.transition = 'opacity 260ms ease';
      this.flashEl.style.opacity = '0';
    });
  }
  setDamage(alpha: number): void { this.damage.style.opacity = String(alpha); }

  update(dt: number): void {
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.subtitle.classList.remove('show');
    }
  }
}
