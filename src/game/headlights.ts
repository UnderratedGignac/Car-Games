/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const HEADLIGHTS_STORAGE_KEY = 'neon_headlights_on_v1';

export interface HeadlightLightingState {
  headlightsOn: boolean;
  beamsActive: boolean;
  isHighBeam: boolean;
  darkness: number;
  strength: number;
  reachMeters: number;
  tunnelAmbientLift: number;
}

export interface HeadlightSliceIllumination {
  roadIllum: number;
  wallIllum: number;
  coreIllum: number;
}

export interface HeadlightProjectionParams {
  headlightsOn: boolean;
  highBeamActive: boolean;
  caveBlend: number;
  isNight: boolean;
}

/**
 * Loads initial headlights state from storage. Defaults to ON (true) so caves
 * and night highways are immediately illuminated unless the player turns them OFF.
 */
export function loadInitialHeadlightsState(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  if (!storage) return true;
  try {
    const raw = storage.getItem(HEADLIGHTS_STORAGE_KEY);
    if (raw === '0' || raw === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

export function saveHeadlightsState(
  on: boolean,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  if (!storage) return;
  try {
    storage.setItem(HEADLIGHTS_STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function toggleHeadlightsState(current: boolean): boolean {
  return !current;
}

/**
 * Computes global headlight state & reach given user toggle, momentary high-beam flash,
 * cavern enclosure blend, and night atmosphere.
 */
export function resolveHeadlightLighting(params: {
  headlightsOn: boolean;
  highBeamTimer: number;
  caveBlend: number;
  isNight: boolean;
}): HeadlightLightingState {
  const isHighBeam = params.highBeamTimer > 0;
  const beamsActive = params.headlightsOn || isHighBeam;
  const clampedCave = Math.max(0, Math.min(1, params.caveBlend));
  const darkness = Math.max(clampedCave, params.isNight ? 0.74 : 0);

  if (!beamsActive) {
    return {
      headlightsOn: params.headlightsOn,
      beamsActive: false,
      isHighBeam: false,
      darkness,
      strength: 0,
      reachMeters: 0,
      tunnelAmbientLift: 0,
    };
  }

  return {
    headlightsOn: params.headlightsOn,
    beamsActive: true,
    isHighBeam,
    darkness,
    strength: isHighBeam ? 1.38 : 1.0,
    reachMeters: isHighBeam ? 106 : 80,
    tunnelAmbientLift: isHighBeam ? 0.96 : 0.76,
  };
}

/**
 * Computes per-slice illumination (0..1.38) for road asphalt, markings, and cave walls
 * at a forward longitudinal distance `rawZ` ahead of the camera/vehicle.
 */
export function computeHeadlightSliceIllumination(
  params: HeadlightProjectionParams & { rawZ: number }
): HeadlightSliceIllumination {
  const { rawZ, headlightsOn, highBeamActive, caveBlend, isNight } = params;
  const beamsActive = headlightsOn || highBeamActive;
  const reachMeters = highBeamActive ? 106 : 80;

  if (!beamsActive || rawZ < 0.8 || rawZ > reachMeters) {
    return { roadIllum: 0, wallIllum: 0, coreIllum: 0 };
  }

  const nearFade = Math.min(1, Math.max(0, (rawZ - 0.8) / 2.8));
  const t = Math.max(0, Math.min(1, (rawZ - 0.8) / (reachMeters - 0.8)));
  const roadFalloff = Math.pow(1 - t, 1.25);
  const wallFalloff = Math.pow(1 - t, 1.42);
  const coreFalloff = Math.pow(1 - t, 1.72);

  const clampedCave = Math.max(0, Math.min(1, caveBlend));
  const envContrast = Math.max(clampedCave, isNight ? 0.78 : 0.28);
  const boost = highBeamActive ? 1.35 : 1.0;

  return {
    roadIllum: Math.min(1.35, nearFade * roadFalloff * envContrast * boost),
    wallIllum: Math.min(1.25, nearFade * wallFalloff * clampedCave * boost),
    coreIllum: Math.min(1.35, nearFade * coreFalloff * envContrast * boost),
  };
}

const rgbCache = new Map<string, [number, number, number]>();

export function parseHeadlightHexRgb(hex: string): [number, number, number] {
  const cached = rgbCache.get(hex);
  if (cached) return cached;
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const num = parseInt(full, 16);
  const tuple: [number, number, number] = Number.isFinite(num)
    ? [(num >> 16) & 255, (num >> 8) & 255, num & 255]
    : [254, 249, 195];
  rgbCache.set(hex, tuple);
  return tuple;
}

const rgbaQuantizedCache = new Map<string, string>();

/**
 * Returns a cached `rgba(r, g, b, a)` string quantized to 0.02 alpha steps
 * so 60 FPS headlight passes produce zero GC churn.
 */
export function getHeadlightRgba(hex: string, alpha: number): string {
  const clampedAlpha = Math.max(0, Math.min(1, Math.round(alpha * 50) / 50));
  const key = `${hex}_${clampedAlpha}`;
  let hit = rgbaQuantizedCache.get(key);
  if (!hit) {
    const [r, g, b] = parseHeadlightHexRgb(hex);
    hit = `rgba(${r}, ${g}, ${b}, ${clampedAlpha.toFixed(2)})`;
    rgbaQuantizedCache.set(key, hit);
  }
  return hit;
}
