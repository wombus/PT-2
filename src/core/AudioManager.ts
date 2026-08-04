import { clamp } from '../utils/math';

/**
 * Fully procedural Web Audio horror soundscape — no asset files required.
 * A layered ambient bed (rumble drone + dissonant pad + air hiss) plus a
 * library of one-shot scare sounds (stingers, whispers, knocks, heartbeat,
 * footsteps, phone/radio). Directional cues use a StereoPanner.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambientGain!: GainNode;
  private started = false;
  private masterVolume = 0.9;

  private ambientNodes: AudioScheduledSourceNode[] = [];
  private droneFilter: BiquadFilterNode | null = null;

  /** Must be called from a user gesture (Start button). */
  async init(): Promise<void> {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVolume;
    this.master.connect(this.ctx.destination);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.master);

    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  setMasterVolume(v: number): void {
    this.masterVolume = clamp(v, 0, 1);
    if (this.master) this.master.gain.value = this.masterVolume;
  }

  /** White/brown noise buffer, cached. */
  private noiseBuffer: AudioBuffer | null = null;
  private getNoise(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish
      data[i] = last * 3.5;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  // ---- Ambient bed --------------------------------------------------------
  startAmbient(): void {
    if (!this.ctx || this.started) return;
    this.started = true;
    const ctx = this.ctx;

    // 1. Sub rumble: brown noise through a low-pass with a slow wobble.
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.getNoise();
    rumble.loop = true;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 120;
    rumbleFilter.Q.value = 2;
    this.droneFilter = rumbleFilter;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.5;
    rumble.connect(rumbleFilter).connect(rumbleGain).connect(this.ambientGain);
    rumble.start();

    // slow LFO on filter cutoff for a breathing drone
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain).connect(rumbleFilter.frequency);
    lfo.start();

    // 2. Dissonant pad: two detuned low oscillators, very quiet.
    const padGain = ctx.createGain();
    padGain.gain.value = 0.045;
    padGain.connect(this.ambientGain);
    [55, 58.27].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g).connect(padGain);
      osc.start();
      this.ambientNodes.push(osc);
    });

    // 3. Air hiss: high-passed noise, extremely quiet.
    const air = ctx.createBufferSource();
    air.buffer = this.getNoise();
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'highpass';
    airFilter.frequency.value = 6000;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.012;
    air.connect(airFilter).connect(airGain).connect(this.ambientGain);
    air.start();

    this.ambientNodes.push(rumble, lfo, air);

    // fade in
    this.ambientGain.gain.setValueAtTime(0, ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 4);
  }

  /** Raise/lower dread by nudging the drone brightness. 0..1 */
  setTension(t: number): void {
    if (!this.ctx || !this.droneFilter) return;
    const target = 90 + t * 260;
    this.droneFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 1.5);
  }

  private envGain(attack: number, hold: number, release: number, peak = 1): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  private panner(pan: number): StereoPannerNode {
    const p = this.ctx!.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }

  // ---- One-shots ----------------------------------------------------------

  /** Cinematic jump-scare hit — a dissonant cluster + noise swell + sub drop,
   *  deliberately organic (no chiptune sawtooth). intensity 0..1 */
  stinger(intensity = 1): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Air/impact: broadband noise sweeping downward
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoise();
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.setValueAtTime(3200, t);
    nf.frequency.exponentialRampToValueAtTime(320, t + 0.55);
    nf.Q.value = 0.6;
    const ng = this.envGain(0.004, 0.05, 0.75, 0.85 * intensity);
    noise.connect(nf).connect(ng).connect(this.master);
    noise.start(t);
    noise.stop(t + 1.0);

    // 2. Dissonant tonal cluster — triangle voices (soft, organic) a minor-second apart
    const cluster = [146.83, 155.56, 207.65, 220.0];
    for (const f of cluster) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f * 1.03, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.5);
      const og = this.envGain(0.006, 0.12, 0.7, 0.16 * intensity);
      o.connect(og).connect(this.master);
      o.start(t);
      o.stop(t + 0.9);
    }

    // 3. Sub drop for body
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    const sg = this.envGain(0.005, 0.1, 0.55, 0.95 * intensity);
    sub.connect(sg).connect(this.master);
    sub.start(t);
    sub.stop(t + 0.7);
  }

  /**
   * Slow, raspy breathing that loops until the returned stopper is called.
   * Used when the apparition is present — presence, not a jump scare.
   */
  breathing(pan = 0): () => void {
    if (!this.ctx) return () => {};
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(this.panner(pan)).connect(this.master);

    let stopped = false;
    const breath = (inhale: boolean): void => {
      if (stopped || !this.ctx) return;
      const now = ctx.currentTime;
      const dur = inhale ? 1.0 : 1.35;
      const src = ctx.createBufferSource();
      src.buffer = this.getNoise();
      src.playbackRate.value = 0.5;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(inhale ? 320 : 820, now);
      bp.frequency.linearRampToValueAtTime(inhale ? 950 : 240, now + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(inhale ? 0.1 : 0.13, now + dur * 0.42);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bp).connect(g).connect(bus);
      src.start(now);
      src.stop(now + dur + 0.05);
      // faint low throat rasp under the exhale
      if (!inhale) {
        const rasp = ctx.createOscillator();
        rasp.type = 'sawtooth';
        rasp.frequency.value = 58;
        const rg = ctx.createGain();
        rg.gain.setValueAtTime(0.0001, now);
        rg.gain.exponentialRampToValueAtTime(0.03, now + 0.2);
        rg.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        const rlp = ctx.createBiquadFilter();
        rlp.type = 'lowpass'; rlp.frequency.value = 200;
        rasp.connect(rlp).connect(rg).connect(bus);
        rasp.start(now); rasp.stop(now + dur);
      }
    };

    let inhale = true;
    breath(true);
    const iv = window.setInterval(() => {
      inhale = !inhale;
      breath(inhale);
    }, 1700);

    return () => {
      stopped = true;
      clearInterval(iv);
      if (this.ctx) bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    };
  }

  /** Breathy whisper, panned. */
  whisper(pan = 0): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dur = 0.9 + Math.random() * 0.8;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise();
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400 + Math.random() * 800;
    bp.Q.value = 5;
    // amplitude wobble to mimic syllables
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    const steps = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < steps; i++) {
      const tt = t + (i / steps) * dur;
      g.gain.exponentialRampToValueAtTime(0.06 + Math.random() * 0.05, tt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.002, tt + dur / steps * 0.9);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.panner(pan)).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  /** Heavy knock/bang on a wall, panned. */
  knock(pan = 0, intensity = 1): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.envGain(0.002, 0.01, 0.18, 0.9 * intensity);
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoise();
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 400;
    const ng = this.envGain(0.001, 0.005, 0.09, 0.5 * intensity);
    const pan1 = this.panner(pan);
    osc.connect(g).connect(pan1).connect(this.master);
    noise.connect(nf).connect(ng).connect(pan1);
    osc.start(t); osc.stop(t + 0.3);
    noise.start(t); noise.stop(t + 0.2);
  }

  /** Muffled footstep, panned; used for "something walking" cues. */
  footstep(pan = 0, vol = 0.25): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoise();
    noise.playbackRate.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 350;
    const g = this.envGain(0.002, 0.005, 0.11, vol);
    noise.connect(lp).connect(g).connect(this.panner(pan)).connect(this.master);
    noise.start(t); noise.stop(t + 0.2);
  }

  /** Two-thump heartbeat. Call repeatedly for sustained fear. */
  heartbeat(vol = 0.5): void {
    if (!this.ctx) return;
    const beat = (offset: number, v: number) => {
      const ctx = this.ctx!;
      const t = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(60, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g).connect(this.master);
      osc.start(t); osc.stop(t + 0.3);
    };
    beat(0, vol);
    beat(0.28, vol * 0.7);
  }

  /** Old telephone ring loop handle. */
  private ringTimer: number | null = null;
  startPhoneRing(): void {
    if (!this.ctx || this.ringTimer !== null) return;
    const ring = () => {
      const ctx = this.ctx!;
      for (let k = 0; k < 2; k++) {
        const t = ctx.currentTime + k * 0.35;
        [1000, 1250].forEach((f) => {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
          g.gain.setValueAtTime(0.12, t + 0.28);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
          o.connect(g).connect(this.master);
          o.start(t); o.stop(t + 0.35);
        });
      }
    };
    ring();
    this.ringTimer = window.setInterval(ring, 2600);
  }
  stopPhoneRing(): void {
    if (this.ringTimer !== null) { clearInterval(this.ringTimer); this.ringTimer = null; }
  }

  /** Radio static bed handle. Returns a stopper. */
  radioStatic(vol = 0.15): () => void {
    if (!this.ctx) return () => {};
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise();
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    return () => {
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(0, t, 0.3);
      src.stop(t + 1);
    };
  }

  get context(): AudioContext | null {
    return this.ctx;
  }
}
