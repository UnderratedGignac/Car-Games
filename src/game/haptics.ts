/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HapticEventCategory = 'collision' | 'drift' | 'general';

export type HapticDeviceProfileId =
  | 'mobile_android'
  | 'mobile_ios'
  | 'tablet_touch'
  | 'handheld_gamepad'
  | 'desktop_browser';

export type ActiveHapticDeviceMode = 'auto' | HapticDeviceProfileId;

export interface DeviceHapticCalibration {
  collisionIntensity: number; // 0.0 (off) .. 2.0 (200% overdrive)
  driftIntensity: number;     // 0.0 (off) .. 2.0 (200% overdrive)
}

export type HapticCalibrationsByDevice = Record<HapticDeviceProfileId, DeviceHapticCalibration>;

export interface HapticDeviceProfileMeta {
  id: HapticDeviceProfileId;
  label: string;
  shortLabel: string;
  actuatorHint: string;
  recommended: DeviceHapticCalibration;
}

export interface DetectedHapticDevice {
  profileId: HapticDeviceProfileId;
  label: string;
  actuatorHint: string;
  supportsVibration: boolean;
}

export interface HapticEnvironmentSnapshot {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  screenWidth?: number;
  screenHeight?: number;
  hasGamepad?: boolean;
  supportsVibration?: boolean;
}

export const HAPTIC_MIN_INTENSITY = 0;
export const HAPTIC_MAX_INTENSITY = 2.0;

export const HAPTIC_DEVICE_PROFILES: readonly HapticDeviceProfileMeta[] = [
  {
    id: 'mobile_android',
    label: 'Android Smartphone',
    shortLabel: 'Android',
    actuatorHint: 'Compact ERM / Linear Motor',
    recommended: { collisionIntensity: 1.0, driftIntensity: 1.0 },
  },
  {
    id: 'mobile_ios',
    label: 'iPhone / iOS Mobile',
    shortLabel: 'iPhone',
    actuatorHint: 'High-Precision Taptic Profile',
    recommended: { collisionIntensity: 1.0, driftIntensity: 1.0 },
  },
  {
    id: 'tablet_touch',
    label: 'Tablet / Large Touch',
    shortLabel: 'Tablet',
    actuatorHint: 'Wide-Chassis Frame Actuator',
    recommended: { collisionIntensity: 1.0, driftIntensity: 1.0 },
  },
  {
    id: 'handheld_gamepad',
    label: 'Handheld / Controller',
    shortLabel: 'Handheld',
    actuatorHint: 'Dual-Rumble Trigger Profile',
    recommended: { collisionIntensity: 1.0, driftIntensity: 1.0 },
  },
  {
    id: 'desktop_browser',
    label: 'Desktop / Laptop',
    shortLabel: 'Desktop',
    actuatorHint: 'Trackpad / Browser Fallback',
    recommended: { collisionIntensity: 1.0, driftIntensity: 1.0 },
  },
] as const;

const PROFILE_META_MAP: Record<HapticDeviceProfileId, HapticDeviceProfileMeta> = {
  mobile_android: HAPTIC_DEVICE_PROFILES[0],
  mobile_ios: HAPTIC_DEVICE_PROFILES[1],
  tablet_touch: HAPTIC_DEVICE_PROFILES[2],
  handheld_gamepad: HAPTIC_DEVICE_PROFILES[3],
  desktop_browser: HAPTIC_DEVICE_PROFILES[4],
};

export function isHapticDeviceProfileId(val: unknown): val is HapticDeviceProfileId {
  return (
    val === 'mobile_android' ||
    val === 'mobile_ios' ||
    val === 'tablet_touch' ||
    val === 'handheld_gamepad' ||
    val === 'desktop_browser'
  );
}

export function clampHapticIntensity(value: unknown, fallback = 1.0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const clamped = Math.max(HAPTIC_MIN_INTENSITY, Math.min(HAPTIC_MAX_INTENSITY, value));
    return Math.round(clamped * 100) / 100;
  }
  return fallback;
}

export function createDefaultHapticCalibrations(): HapticCalibrationsByDevice {
  return {
    mobile_android: { ...PROFILE_META_MAP.mobile_android.recommended },
    mobile_ios: { ...PROFILE_META_MAP.mobile_ios.recommended },
    tablet_touch: { ...PROFILE_META_MAP.tablet_touch.recommended },
    handheld_gamepad: { ...PROFILE_META_MAP.handheld_gamepad.recommended },
    desktop_browser: { ...PROFILE_META_MAP.desktop_browser.recommended },
  };
}

export function normalizeHapticCalibrations(raw: unknown): HapticCalibrationsByDevice {
  const defaults = createDefaultHapticCalibrations();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const source = raw as Record<string, unknown>;
  for (const meta of HAPTIC_DEVICE_PROFILES) {
    const entry = source[meta.id];
    if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      defaults[meta.id] = {
        collisionIntensity: clampHapticIntensity(
          obj.collisionIntensity,
          meta.recommended.collisionIntensity
        ),
        driftIntensity: clampHapticIntensity(
          obj.driftIntensity,
          meta.recommended.driftIntensity
        ),
      };
    }
  }
  return defaults;
}

export function getHapticDeviceMeta(profileId: HapticDeviceProfileId): HapticDeviceProfileMeta {
  return PROFILE_META_MAP[profileId] ?? PROFILE_META_MAP.desktop_browser;
}

export function detectCurrentHapticDevice(env?: HapticEnvironmentSnapshot): DetectedHapticDevice {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const win = typeof window !== 'undefined' ? window : undefined;

  const ua = env?.userAgent ?? nav?.userAgent ?? '';
  const platform = env?.platform ?? (nav as { platform?: string } | undefined)?.platform ?? '';
  const maxTouchPoints = env?.maxTouchPoints ?? nav?.maxTouchPoints ?? 0;
  const screenWidth = env?.screenWidth ?? win?.innerWidth ?? 1280;
  const screenHeight = env?.screenHeight ?? win?.innerHeight ?? 800;
  const minDim = Math.min(screenWidth, screenHeight);

  let hasGamepad = env?.hasGamepad ?? false;
  if (env?.hasGamepad === undefined && nav && typeof nav.getGamepads === 'function') {
    try {
      const pads = nav.getGamepads();
      hasGamepad = Array.isArray(pads) && pads.some((p) => Boolean(p && p.connected));
    } catch {
      hasGamepad = false;
    }
  }

  const supportsVibration =
    env?.supportsVibration ?? Boolean(nav && typeof nav.vibrate === 'function');

  let profileId: HapticDeviceProfileId = 'desktop_browser';

  if (hasGamepad || /SteamDeck|ROG Ally|PlayStation|Xbox|Nintendo|Shield/i.test(ua)) {
    profileId = 'handheld_gamepad';
  } else if (/iPhone|iPod/i.test(ua)) {
    profileId = 'mobile_ios';
  } else if (/iPad/i.test(ua) || (/Macintosh|MacIntel/i.test(platform + ' ' + ua) && maxTouchPoints > 1)) {
    profileId = minDim >= 600 ? 'tablet_touch' : 'mobile_ios';
  } else if (/Android/i.test(ua)) {
    profileId = /Mobile/i.test(ua) || minDim < 600 ? 'mobile_android' : 'tablet_touch';
  } else if (maxTouchPoints > 0) {
    profileId = minDim >= 600 ? 'tablet_touch' : 'mobile_android';
  }

  const meta = getHapticDeviceMeta(profileId);
  return {
    profileId,
    label: meta.label,
    actuatorHint: supportsVibration ? meta.actuatorHint : `${meta.actuatorHint} (Vibration Unsupported)`,
    supportsVibration,
  };
}

export function resolveActiveHapticDeviceId(
  mode: ActiveHapticDeviceMode | undefined,
  detected: DetectedHapticDevice
): HapticDeviceProfileId {
  if (mode && mode !== 'auto' && isHapticDeviceProfileId(mode)) {
    return mode;
  }
  return detected.profileId;
}

export function getIntensityForCategory(
  calibration: DeviceHapticCalibration,
  category: HapticEventCategory
): number {
  if (category === 'collision') {
    return clampHapticIntensity(calibration.collisionIntensity, 1.0);
  }
  if (category === 'drift') {
    return clampHapticIntensity(calibration.driftIntensity, 1.0);
  }
  return 1.0;
}

/**
 * Scales a single millisecond pulse or an alternating [vibrate, pause, ...] pattern
 * by a calibrated intensity multiplier (0.0 to 2.0).
 * Returns null if calibrated intensity is 0 (event haptics disabled).
 */
export function scaleHapticPattern(
  basePattern: number | readonly number[],
  intensity: number
): number | number[] | null {
  const clamped = clampHapticIntensity(intensity, 1.0);
  if (clamped <= 0) {
    return null;
  }

  const scalePulse = (ms: number) => Math.max(4, Math.min(250, Math.round(ms * clamped)));

  if (typeof basePattern === 'number') {
    return scalePulse(basePattern);
  }
  if (basePattern.length === 0) {
    return null;
  }

  return basePattern.map((segment, index) => {
    if (index % 2 === 0) {
      return scalePulse(segment);
    }
    return Math.max(20, Math.round(segment));
  });
}

export function formatHapticPatternPreview(
  basePattern: number | readonly number[],
  intensity: number
): string {
  const scaled = scaleHapticPattern(basePattern, intensity);
  if (scaled === null) {
    return 'OFF (0ms)';
  }
  if (typeof scaled === 'number') {
    return `${scaled}ms`;
  }
  return scaled.filter((_, idx) => idx % 2 === 0).map((ms) => `${ms}ms`).join(' + ');
}
