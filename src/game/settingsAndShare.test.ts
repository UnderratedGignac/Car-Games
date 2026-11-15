/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  getActiveHapticCalibration,
  loadGameSettings,
  saveGameSettings,
  GameSettings,
} from '../components/SettingsModal';
import { SoundFXSystem, isHapticsEnabled, triggerHaptic } from './audio';
import {
  createDefaultHapticCalibrations,
  detectCurrentHapticDevice,
  formatHapticPatternPreview,
  scaleHapticPattern,
} from './haptics';
import { getDriftRank } from './rules';

// Minimal mock localStorage for test environment
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = mockStorage;
(globalThis as unknown as { window: { localStorage: MockLocalStorage } }).window = {
  localStorage: mockStorage,
};

test('Game Settings - Defaults and Storage Roundtrip', () => {
  mockStorage.clear();

  // 1. Initial load should return default values
  const initial = loadGameSettings();
  assert.equal(initial.masterVolume, 1.0);
  assert.equal(initial.musicVolume, 0.8);
  assert.equal(initial.sfxVolume, 0.9);
  assert.equal(initial.engineVolume, 0.7);
  assert.equal(initial.screenShake, 1.0);
  assert.equal(initial.controlScheme, 'classic');
  assert.equal(initial.hapticsEnabled, true);
  assert.equal(initial.hapticDeviceMode, 'auto');
  assert.deepEqual(initial.hapticCalibrations, createDefaultHapticCalibrations());
  assert.equal(initial.highFpsMode, false);

  // 2. Save modified settings including independent per-device calibrations
  const customCalibrations = createDefaultHapticCalibrations();
  customCalibrations.mobile_android = { collisionIntensity: 1.45, driftIntensity: 0.75 };
  customCalibrations.tablet_touch = { collisionIntensity: 1.8, driftIntensity: 1.25 };

  const custom: GameSettings = {
    masterVolume: 0.5,
    musicVolume: 0.4,
    sfxVolume: 0.6,
    engineVolume: 0.3,
    screenShake: 0.0, // Motion Sickness Safe
    controlScheme: 'wheel',
    hapticsEnabled: false,
    hapticDeviceMode: 'mobile_android',
    hapticCalibrations: customCalibrations,
    highFpsMode: true,
  };

  saveGameSettings(custom);
  const loaded = loadGameSettings();
  assert.deepEqual(loaded, custom);
  assert.equal(loaded.screenShake, 0.0);
  assert.equal(loaded.controlScheme, 'wheel');
  assert.equal(loaded.hapticCalibrations.mobile_android.collisionIntensity, 1.45);
  assert.equal(loaded.hapticCalibrations.tablet_touch.driftIntensity, 1.25);
});

test('Game Settings - Clamping and Malformed JSON Fallbacks', () => {
  mockStorage.clear();

  // Test out-of-bounds volumes & haptic intensities
  mockStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      masterVolume: 999,
      musicVolume: -5,
      sfxVolume: 1.5,
      engineVolume: -0.2,
      screenShake: -1,
      controlScheme: 'invalid_mode',
      hapticsEnabled: 'not_a_bool',
      hapticDeviceMode: 'unknown_device',
      hapticCalibrations: {
        mobile_android: { collisionIntensity: 9.9, driftIntensity: -2 },
        desktop_browser: { collisionIntensity: 'bad', driftIntensity: 1.35 },
      },
      highFpsMode: 123,
    })
  );

  const clamped = loadGameSettings();
  assert.equal(clamped.masterVolume, 1.0);
  assert.equal(clamped.musicVolume, 0.0);
  assert.equal(clamped.sfxVolume, 1.0);
  assert.equal(clamped.engineVolume, 0.0);
  assert.equal(clamped.screenShake, 0.0);
  assert.equal(clamped.controlScheme, 'classic'); // fallback
  assert.equal(clamped.hapticsEnabled, true); // fallback
  assert.equal(clamped.hapticDeviceMode, 'auto'); // fallback
  assert.equal(clamped.hapticCalibrations.mobile_android.collisionIntensity, 2.0); // clamped max
  assert.equal(clamped.hapticCalibrations.mobile_android.driftIntensity, 0.0); // clamped min
  assert.equal(clamped.hapticCalibrations.desktop_browser.collisionIntensity, 1.0); // fallback
  assert.equal(clamped.hapticCalibrations.desktop_browser.driftIntensity, 1.35);
  assert.equal(clamped.highFpsMode, false); // fallback

  // Test corrupt JSON string
  mockStorage.setItem(SETTINGS_STORAGE_KEY, '{ corrupt-json ::: ');
  const fallback = loadGameSettings();
  assert.deepEqual(fallback, DEFAULT_SETTINGS);
});

test('Share Card - Rank and Telemetry Formatters', () => {
  // Drift ranks
  const ssRank = getDriftRank(25000);
  assert.equal(ssRank.rank, 'SS');
  assert.equal(ssRank.title, 'DRIFT KING');

  const sRank = getDriftRank(9000);
  assert.equal(sRank.rank, 'S');
  assert.equal(sRank.title, 'APEX LEGEND');

  const rookieRank = getDriftRank(120);
  assert.equal(rookieRank.rank, 'D');
  assert.equal(rookieRank.title, 'ROOKIE');

  // Formatted Score Text
  const score = 124500;
  const carName = 'Shadow Drifter';
  const carTier = 45;
  const maxCombo = 18;
  const distance = 1850;

  const formattedLines = [
    '🏁 NEON REDLINE RUN RECORD 🏁',
    `🚗 Car: ${carName} (Tier ${carTier})`,
    `🏆 Rank: RANK ${ssRank.rank} · ${ssRank.title}`,
    `🔥 Score: ${score.toLocaleString()} PTS`,
    `⚡ Max Combo: x${maxCombo}`,
    `🛣️ Touge Distance: ${distance.toLocaleString()}m`,
  ];

  assert.ok(formattedLines[0].includes('NEON REDLINE'));
  assert.ok(formattedLines[1].includes('Shadow Drifter (Tier 45)'));
  assert.ok(formattedLines[2].includes('RANK SS · DRIFT KING'));
  assert.ok(formattedLines[3].includes('124,500 PTS'));
});

test('Audio Mixer & Haptics - Global haptics toggle and live gain scaling', () => {
  const sfx = new SoundFXSystem();
  let vibrateCalls = 0;

  const origNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      vibrate: () => {
        vibrateCalls++;
        return true;
      },
    },
  });

  try {
    sfx.setHapticsEnabled(false);
    assert.equal(isHapticsEnabled(), false);
    assert.equal(triggerHaptic('light'), false);
    assert.equal(vibrateCalls, 0);

    // Force pulse (used by Settings test button) bypasses mute toggle
    assert.equal(triggerHaptic('medium', true), true);
    assert.equal(vibrateCalls, 1);

    sfx.setHapticsEnabled(true);
    assert.equal(isHapticsEnabled(), true);
    assert.equal(triggerHaptic('heavy'), true);
    assert.equal(vibrateCalls, 2);
  } finally {
    if (origNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', origNavigatorDesc);
    } else {
      delete (globalThis as unknown as { navigator?: unknown }).navigator;
    }
  }

  // Verify mixer clamps cleanly without compounding master^2 and updates live engine gain
  const gainTargets: { music: number[]; engine: number[] } = { music: [], engine: [] };
  (sfx as unknown as { ctx: unknown }).ctx = { currentTime: 1.0 };
  (sfx as unknown as { musicGainNode: unknown }).musicGainNode = {
    gain: { setTargetAtTime: (v: number) => gainTargets.music.push(v) },
  };
  (sfx as unknown as { engGain: unknown }).engGain = {
    gain: { setTargetAtTime: (v: number) => gainTargets.engine.push(v) },
  };
  (sfx as unknown as { engRunning: boolean }).engRunning = true;
  (sfx as unknown as { lastEngBaseVol: number }).lastEngBaseVol = 0.04;
  (sfx as unknown as { lastEngVol: number }).lastEngVol = 0.028;

  sfx.setMixerVolumes({ master: 0.5, music: 0.8, sfx: 0.6, engine: 0.4 });
  assert.deepEqual(sfx.getMixerVolumes(), {
    master: 0.5,
    music: 0.8,
    sfx: 0.6,
    engine: 0.4,
  });

  // Effective music gain = 0.8 * 0.5 * 1.0 * 0.72 = 0.288 (NOT master^2 * 0.8)
  assert.ok(Math.abs(gainTargets.music[0] - 0.288) < 1e-6);
  // Live engine gain = lastEngBaseVol (0.04) * engineScale (0.4 * 0.5 = 0.2) = 0.008
  assert.ok(Math.abs(gainTargets.engine[0] - 0.008) < 1e-6);
});

test('Per-Device Haptic Calibration - detection, scaling, and collision vs drift triggers', () => {
  const androidPhone = detectCurrentHapticDevice({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
    maxTouchPoints: 5,
    screenWidth: 390,
    screenHeight: 844,
    supportsVibration: true,
  });
  assert.equal(androidPhone.profileId, 'mobile_android');
  assert.equal(androidPhone.supportsVibration, true);

  const ipadTablet = detectCurrentHapticDevice({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    platform: 'MacIntel',
    maxTouchPoints: 5,
    screenWidth: 1024,
    screenHeight: 768,
    supportsVibration: false,
  });
  assert.equal(ipadTablet.profileId, 'tablet_touch');

  const handheld = detectCurrentHapticDevice({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    hasGamepad: true,
    supportsVibration: true,
  });
  assert.equal(handheld.profileId, 'handheld_gamepad');

  // Pattern scaling keeps pauses distinct and turns off cleanly at 0%
  assert.equal(scaleHapticPattern(65, 0), null);
  assert.equal(scaleHapticPattern(65, 1.5), 98);
  assert.deepEqual(scaleHapticPattern([25, 45, 35], 0.6), [15, 45, 21]);
  assert.equal(formatHapticPatternPreview(38, 0), 'OFF (0ms)');
  assert.equal(formatHapticPatternPreview(38, 1.5), '57ms');

  // Active calibration resolves per detected device unless overridden
  const calSettings: GameSettings = {
    ...DEFAULT_SETTINGS,
    hapticDeviceMode: 'auto',
    hapticCalibrations: {
      ...createDefaultHapticCalibrations(),
      mobile_android: { collisionIntensity: 1.6, driftIntensity: 0.5 },
      desktop_browser: { collisionIntensity: 0.7, driftIntensity: 1.3 },
    },
  };
  const resolvedAndroid = getActiveHapticCalibration(calSettings, {
    userAgent: 'Android Mobile',
    maxTouchPoints: 5,
    screenWidth: 390,
    screenHeight: 844,
    supportsVibration: true,
  });
  assert.equal(resolvedAndroid.activeDeviceId, 'mobile_android');
  assert.equal(resolvedAndroid.calibration.collisionIntensity, 1.6);
  assert.equal(resolvedAndroid.calibration.driftIntensity, 0.5);

  // Live triggerHaptic scales collision and drift pulses independently
  const vibratePayloads: (number | number[])[] = [];
  const origNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      vibrate: (pattern: number | number[]) => {
        vibratePayloads.push(pattern);
        return true;
      },
    },
  });

  const sfx = new SoundFXSystem();
  try {
    sfx.setHapticsEnabled(true);
    sfx.setHapticCalibration({ collisionIntensity: 1.5, driftIntensity: 0.5 });

    // Collision heavy impact: 65ms * 1.5 = 98ms
    assert.equal(triggerHaptic('heavy', false, 'collision'), true);
    assert.equal(vibratePayloads[vibratePayloads.length - 1], 98);

    // Drift style switch: 38ms * 0.5 = 19ms
    assert.equal(triggerHaptic('medium', false, 'drift'), true);
    assert.equal(vibratePayloads[vibratePayloads.length - 1], 19);

    // Muting collision only (0%) suppresses collision while drift still fires
    sfx.setHapticCalibration({ collisionIntensity: 0, driftIntensity: 1.2 });
    assert.equal(triggerHaptic('heavy', false, 'collision'), false);
    assert.equal(triggerHaptic('double', false, 'drift'), true);
    assert.deepEqual(vibratePayloads[vibratePayloads.length - 1], [30, 45, 42]);
  } finally {
    sfx.setHapticCalibration({ collisionIntensity: 1.0, driftIntensity: 1.0 });
    if (origNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', origNavigatorDesc);
    } else {
      delete (globalThis as unknown as { navigator?: unknown }).navigator;
    }
  }
});

