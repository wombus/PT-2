export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualitySettings {
  pixelRatio: number;      // cap on devicePixelRatio
  shadowMapSize: number;   // 0 disables shadows
  ssao: boolean;
  bloom: boolean;
  grade: boolean;          // vignette / grain / chromatic aberration pass
  fogDensity: number;
  reflections: boolean;    // live mirror Reflector (extra scene render)
  particles: number;       // dust-mote count (0 disables)
}

export const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    pixelRatio: 1,
    shadowMapSize: 0,
    ssao: false,
    bloom: true,
    grade: true,
    fogDensity: 0.11,
    reflections: false,
    particles: 250,
  },
  medium: {
    pixelRatio: 1.25,
    shadowMapSize: 1024,
    ssao: false,
    bloom: true,
    grade: true,
    fogDensity: 0.1,
    reflections: false,
    particles: 600,
  },
  high: {
    pixelRatio: 1.5,
    shadowMapSize: 2048,
    ssao: true,
    bloom: true,
    grade: true,
    fogDensity: 0.09,
    reflections: true,
    particles: 1100,
  },
  ultra: {
    pixelRatio: 2,
    shadowMapSize: 4096,
    ssao: true,
    bloom: true,
    grade: true,
    fogDensity: 0.085,
    reflections: true,
    particles: 1800,
  },
};

/** Rough auto-detect based on device. Conservative default. */
export function detectQuality(): QualityLevel {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile || mem <= 2 || cores <= 2) return 'low';
  if (mem <= 4 || cores <= 4) return 'medium';
  if (mem >= 8 && cores >= 8) return 'high';
  return 'high';
}
