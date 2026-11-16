/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  ChevronRight,
  Gamepad2,
  Monitor,
  RotateCcw,
  Shield,
  Sliders,
  Smartphone,
  Tablet,
  Vibrate,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { soundFX, triggerHaptic } from '../game/audio';
import {
  ActiveHapticDeviceMode,
  DeviceHapticCalibration,
  HAPTIC_DEVICE_PROFILES,
  HapticCalibrationsByDevice,
  HapticDeviceProfileId,
  HapticEnvironmentSnapshot,
  clampHapticIntensity,
  createDefaultHapticCalibrations,
  detectCurrentHapticDevice,
  formatHapticPatternPreview,
  getHapticDeviceMeta,
  isHapticDeviceProfileId,
  normalizeHapticCalibrations,
  resolveActiveHapticDeviceId,
} from '../game/haptics';

export interface GameSettings {
  masterVolume: number; // 0.0 - 1.0 (default 1.0)
  musicVolume: number;  // 0.0 - 1.0 (default 0.8)
  sfxVolume: number;    // 0.0 - 1.0 (default 0.9)
  engineVolume: number; // 0.0 - 1.0 (default 0.7)
  screenShake: number;  // 0.0 - 1.0 (default 1.0, 0.0 = motion safe)
  controlScheme: 'classic' | 'wheel' | 'swipe'; // default 'classic'
  leftHanded: boolean; // swap steering & pedal pods (default false)
  steerSensitivity: 'smooth' | 'balanced' | 'sharp'; // steering response (default 'balanced')
  hapticsEnabled: boolean; // default true
  hapticDeviceMode: ActiveHapticDeviceMode; // 'auto' | specific device profile
  hapticCalibrations: HapticCalibrationsByDevice; // per-device collision & drift intensities
  highFpsMode: boolean; // default false (false = 60fps, true = uncapped / 120fps)
}

export const SETTINGS_STORAGE_KEY = 'neon_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 1.0,
  musicVolume: 0.8,
  sfxVolume: 0.9,
  engineVolume: 0.7,
  screenShake: 1.0,
  controlScheme: 'classic',
  leftHanded: false,
  steerSensitivity: 'balanced',
  hapticsEnabled: true,
  hapticDeviceMode: 'auto',
  hapticCalibrations: createDefaultHapticCalibrations(),
  highFpsMode: false,
};

export function getActiveHapticCalibration(
  settings: GameSettings,
  env?: HapticEnvironmentSnapshot
): {
  detected: ReturnType<typeof detectCurrentHapticDevice>;
  activeDeviceId: HapticDeviceProfileId;
  calibration: DeviceHapticCalibration;
} {
  const detected = detectCurrentHapticDevice(env);
  const activeDeviceId = resolveActiveHapticDeviceId(settings.hapticDeviceMode, detected);
  const calibration = settings.hapticCalibrations[activeDeviceId] ?? {
    collisionIntensity: 1.0,
    driftIntensity: 1.0,
  };
  return { detected, activeDeviceId, calibration };
}

/**
 * Loads game settings from localStorage with safe fallbacks and bounds clamping.
 */
export function loadGameSettings(): GameSettings {
  if (typeof window === 'undefined') {
    return {
      ...DEFAULT_SETTINGS,
      hapticCalibrations: createDefaultHapticCalibrations(),
    };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const clamp01 = (val: unknown, fallback: number) => {
          if (typeof val === 'number' && !Number.isNaN(val)) {
            return Math.max(0, Math.min(1, val));
          }
          return fallback;
        };

        const control =
          parsed.controlScheme === 'classic' ||
          parsed.controlScheme === 'wheel' ||
          parsed.controlScheme === 'swipe'
            ? parsed.controlScheme
            : DEFAULT_SETTINGS.controlScheme;

        const hapticDeviceMode: ActiveHapticDeviceMode =
          parsed.hapticDeviceMode === 'auto' || isHapticDeviceProfileId(parsed.hapticDeviceMode)
            ? parsed.hapticDeviceMode
            : DEFAULT_SETTINGS.hapticDeviceMode;

        return {
          masterVolume: clamp01(parsed.masterVolume, DEFAULT_SETTINGS.masterVolume),
          musicVolume: clamp01(parsed.musicVolume, DEFAULT_SETTINGS.musicVolume),
          sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
          engineVolume: clamp01(parsed.engineVolume, DEFAULT_SETTINGS.engineVolume),
          screenShake: clamp01(parsed.screenShake, DEFAULT_SETTINGS.screenShake),
          controlScheme: control,
          leftHanded: typeof parsed.leftHanded === 'boolean' ? parsed.leftHanded : DEFAULT_SETTINGS.leftHanded,
          steerSensitivity:
            parsed.steerSensitivity === 'smooth' || parsed.steerSensitivity === 'sharp'
              ? parsed.steerSensitivity
              : 'balanced',
          hapticsEnabled:
            typeof parsed.hapticsEnabled === 'boolean'
              ? parsed.hapticsEnabled
              : DEFAULT_SETTINGS.hapticsEnabled,
          hapticDeviceMode,
          hapticCalibrations: normalizeHapticCalibrations(parsed.hapticCalibrations),
          highFpsMode:
            typeof parsed.highFpsMode === 'boolean'
              ? parsed.highFpsMode
              : DEFAULT_SETTINGS.highFpsMode,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved game settings, falling back to defaults', err);
  }
  return {
    ...DEFAULT_SETTINGS,
    hapticCalibrations: createDefaultHapticCalibrations(),
  };
}

/**
 * Persists game settings to localStorage.
 */
export function saveGameSettings(settings: GameSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save game settings to localStorage', err);
  }
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
}

type SettingsTab = 'audio' | 'accessibility' | 'controls' | 'haptics';

function renderDeviceProfileIcon(profileId: HapticDeviceProfileId, className = 'w-4 h-4') {
  switch (profileId) {
    case 'mobile_android':
    case 'mobile_ios':
      return <Smartphone className={className} />;
    case 'tablet_touch':
      return <Tablet className={className} />;
    case 'handheld_gamepad':
      return <Gamepad2 className={className} />;
    case 'desktop_browser':
    default:
      return <Monitor className={className} />;
  }
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const detectedDevice = useMemo(() => detectCurrentHapticDevice(), []);
  const activeDeviceId = useMemo(
    () => resolveActiveHapticDeviceId(settings.hapticDeviceMode, detectedDevice),
    [settings.hapticDeviceMode, detectedDevice]
  );

  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [selectedHapticDeviceId, setSelectedHapticDeviceId] = useState<HapticDeviceProfileId>(
    () => activeDeviceId
  );
  const [hapticFeedbackNotice, setHapticFeedbackNotice] = useState<string | null>(null);
  const [pulseHighlight, setPulseHighlight] = useState<'collision' | 'drift' | null>(null);

  // Sync selected device editor to active device when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedHapticDeviceId(activeDeviceId);
    }
  }, [isOpen, activeDeviceId]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const applySettingsUpdate = useCallback(
    (nextSettings: GameSettings) => {
      onUpdateSettings(nextSettings);
      saveGameSettings(nextSettings);
      soundFX.setMixerVolumes({
        master: nextSettings.masterVolume,
        music: nextSettings.musicVolume,
        sfx: nextSettings.sfxVolume,
        engine: nextSettings.engineVolume,
      });
      soundFX.setHapticsEnabled(nextSettings.hapticsEnabled);
      const nextActiveId = resolveActiveHapticDeviceId(
        nextSettings.hapticDeviceMode,
        detectedDevice
      );
      soundFX.setHapticCalibration(nextSettings.hapticCalibrations[nextActiveId]);
    },
    [onUpdateSettings, detectedDevice]
  );

  const updateSetting = useCallback(
    <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
      const nextSettings: GameSettings = {
        ...settings,
        [key]: value,
      };
      applySettingsUpdate(nextSettings);
    },
    [settings, applySettingsUpdate]
  );

  const updateDeviceCalibration = useCallback(
    (
      deviceId: HapticDeviceProfileId,
      field: keyof DeviceHapticCalibration,
      value: number
    ) => {
      const clamped = clampHapticIntensity(value, 1.0);
      const existing = settings.hapticCalibrations[deviceId] ?? {
        collisionIntensity: 1.0,
        driftIntensity: 1.0,
      };
      const nextSettings: GameSettings = {
        ...settings,
        hapticCalibrations: {
          ...settings.hapticCalibrations,
          [deviceId]: {
            ...existing,
            [field]: clamped,
          },
        },
      };
      applySettingsUpdate(nextSettings);
    },
    [settings, applySettingsUpdate]
  );

  const handleResetDeviceCalibration = useCallback(
    (deviceId: HapticDeviceProfileId) => {
      const meta = getHapticDeviceMeta(deviceId);
      const nextSettings: GameSettings = {
        ...settings,
        hapticCalibrations: {
          ...settings.hapticCalibrations,
          [deviceId]: { ...meta.recommended },
        },
      };
      applySettingsUpdate(nextSettings);
      setHapticFeedbackNotice(`${meta.shortLabel} calibration reset to 100% / 100%`);
      setTimeout(() => setHapticFeedbackNotice(null), 2600);
    },
    [settings, applySettingsUpdate]
  );

  const handleTestSfx = useCallback(() => {
    soundFX.playCoinPickup(3);
    if (settings.hapticsEnabled) {
      triggerHaptic('light');
    }
  }, [settings.hapticsEnabled]);

  const handleTestCategoryHaptic = useCallback(
    (category: 'collision' | 'drift') => {
      const cal = settings.hapticCalibrations[selectedHapticDeviceId] ?? {
        collisionIntensity: 1.0,
        driftIntensity: 1.0,
      };
      const intensity = category === 'collision' ? cal.collisionIntensity : cal.driftIntensity;
      const basePattern = category === 'collision' ? 65 : [25, 45, 35];
      const preview = formatHapticPatternPreview(basePattern, intensity);
      const type = category === 'collision' ? 'heavy' : 'double';
      const triggered = triggerHaptic(type, true, category, cal);

      setPulseHighlight(category);
      setTimeout(() => setPulseHighlight((prev) => (prev === category ? null : prev)), 320);

      if (intensity <= 0) {
        setHapticFeedbackNotice(
          `${category === 'collision' ? 'Collision' : 'Drift'} haptics set to 0% (muted for ${getHapticDeviceMeta(selectedHapticDeviceId).shortLabel})`
        );
      } else if (triggered) {
        setHapticFeedbackNotice(
          `${category === 'collision' ? 'Collision' : 'Drift'} pulse triggered (${preview})`
        );
      } else {
        setHapticFeedbackNotice(
          `Calibrated ${category === 'collision' ? 'Collision' : 'Drift'} pulse at ${preview} (vibration API unavailable on this browser)`
        );
      }
      setTimeout(() => setHapticFeedbackNotice(null), 3000);
    },
    [settings.hapticCalibrations, selectedHapticDeviceId]
  );

  const handleResetDefaults = useCallback(() => {
    const freshDefaults: GameSettings = {
      ...DEFAULT_SETTINGS,
      hapticCalibrations: createDefaultHapticCalibrations(),
    };
    applySettingsUpdate(freshDefaults);
    setSelectedHapticDeviceId(detectedDevice.profileId);
    soundFX.playCoinPickup(1);
  }, [applySettingsUpdate, detectedDevice.profileId]);

  if (!isOpen) return null;

  const selectedDeviceMeta = getHapticDeviceMeta(selectedHapticDeviceId);
  const selectedCalibration = settings.hapticCalibrations[selectedHapticDeviceId] ?? {
    collisionIntensity: 1.0,
    driftIntensity: 1.0,
  };
  const activeCalibration = settings.hapticCalibrations[activeDeviceId] ?? {
    collisionIntensity: 1.0,
    driftIntensity: 1.0,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 pointer-events-auto touch-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Settings and Accessibility"
    >
      <div
        className="relative w-full max-w-xl rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col max-h-[92dvh] text-slate-100"
        style={{ backgroundColor: 'rgba(9, 14, 26, 0.98)' }}
      >
        {/* Ambient Top Cyber Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-10 bg-cyan-500/20 blur-2xl pointer-events-none" />

        {/* Modal Header (Pinned) */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 pt-3.5 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/70 border border-cyan-500/50 flex items-center justify-center text-cyan-300 font-bold text-sm shadow-[0_0_12px_rgba(6,182,212,0.3)] shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-display font-bold tracking-wide text-white truncate">
                GAME SETTINGS
              </h2>
              <p className="text-[10px] font-mono text-cyan-400 tracking-wider uppercase truncate">
                AUDIO · MOTION · CONTROLS · HAPTICS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors shrink-0"
            aria-label="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (Pinned) */}
        <div
          role="tablist"
          aria-label="Settings Categories"
          className="shrink-0 grid grid-cols-4 p-2 gap-1 sm:gap-1.5 bg-slate-900/60 border-b border-slate-800/80"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audio'}
            onClick={() => setActiveTab('audio')}
            className={`min-h-[38px] px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${
              activeTab === 'audio'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.4)] font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>Audio</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accessibility'}
            onClick={() => setActiveTab('accessibility')}
            className={`min-h-[38px] px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${
              activeTab === 'accessibility'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.4)] font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>Motion</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'controls'}
            onClick={() => setActiveTab('controls')}
            className={`min-h-[38px] px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${
              activeTab === 'controls'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.4)] font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
            <span>Controls</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'haptics'}
            onClick={() => setActiveTab('haptics')}
            className={`min-h-[38px] px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${
              activeTab === 'haptics'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.4)] font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Vibrate className="w-3.5 h-3.5 shrink-0" />
            <span>Haptics</span>
          </button>
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="flex-1 min-h-0 p-3.5 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-3.5 sm:space-y-4">
          {/* TAB 1: AUDIO MIXER */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Master Equalizer &amp; Channel Gains
                </span>
                <button
                  type="button"
                  onClick={handleTestSfx}
                  className="shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono flex items-center gap-1 border border-cyan-500/30"
                >
                  <span>▶</span> Test SFX
                </button>
              </div>

              {/* Master Volume */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>🎚️ Master Volume</span>
                    {settings.masterVolume === 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                        MUTED
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-cyan-400 font-bold">
                      {Math.round(settings.masterVolume * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSetting('masterVolume', settings.masterVolume > 0 ? 0 : 1.0)
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
                    >
                      {settings.masterVolume > 0 ? 'Mute' : '100%'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.masterVolume}
                  onChange={(e) => updateSetting('masterVolume', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Music Volume */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>🎵 Synthwave / Eurobeat BGM</span>
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-cyan-400 font-bold">
                      {Math.round(settings.musicVolume * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSetting('musicVolume', settings.musicVolume > 0 ? 0 : 0.8)
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
                    >
                      {settings.musicVolume > 0 ? 'Mute' : '80%'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.musicVolume}
                  onChange={(e) => updateSetting('musicVolume', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* SFX Volume */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    💥 Sound FX (Tire Screech &amp; Scrapes)
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-cyan-400 font-bold">
                      {Math.round(settings.sfxVolume * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => updateSetting('sfxVolume', settings.sfxVolume > 0 ? 0 : 0.9)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
                    >
                      {settings.sfxVolume > 0 ? 'Mute' : '90%'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) => updateSetting('sfxVolume', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Engine Rumble Volume */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    🏎️ Engine Rumble &amp; Exhaust Tone
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-cyan-400 font-bold">
                      {Math.round(settings.engineVolume * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSetting('engineVolume', settings.engineVolume > 0 ? 0 : 0.7)
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
                    >
                      {settings.engineVolume > 0 ? 'Mute' : '70%'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.engineVolume}
                  onChange={(e) => updateSetting('engineVolume', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          )}

          {/* TAB 2: VISUAL & MOTION ACCESSIBILITY */}
          {activeTab === 'accessibility' && (
            <div className="space-y-4">
              {/* Screen Shake Slider */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    📳 Screen Shake &amp; Camera Inertia
                  </span>
                  <span className="font-mono tabular-nums text-amber-400 font-bold">
                    {Math.round(settings.screenShake * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.screenShake}
                  onChange={(e) => updateSetting('screenShake', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />

                {/* Motion Sickness Badge */}
                {settings.screenShake === 0 ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs">
                    <span className="text-base">🛡️</span>
                    <div>
                      <p className="font-bold">Motion Sickness Safe (Shake Disabled)</p>
                      <p className="text-[11px] text-emerald-400/80">
                        Camera displacement and impact shudder are completely eliminated.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Adjusts camera shudder intensity during high-speed drifts, near-misses, and guardrail impacts.
                    Slide to 0% for motion sickness safe mode.
                  </p>
                )}

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => updateSetting('screenShake', 0)}
                    className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                      settings.screenShake === 0
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Off (0%)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('screenShake', 0.5)}
                    className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                      settings.screenShake === 0.5
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Gentle 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('screenShake', 1.0)}
                    className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                      settings.screenShake === 1.0
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Max 100%
                  </button>
                </div>
              </div>

              {/* High Refresh Rate Mode */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">
                      ⚡ Refresh Rate Cadence
                    </h3>
                    <p className="text-xs text-slate-400">
                      Target rendering frame rate for viewport and camera animation.
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                      settings.highFpsMode
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {settings.highFpsMode ? '120Hz Uncapped' : '60 FPS Standard'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSetting('highFpsMode', false)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      !settings.highFpsMode
                        ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">Standard 60 FPS</span>
                      <span className="text-[10px] font-mono text-cyan-400">BATTERY SAVER</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      Consistent frame pacing, lower thermal dissipation, ideal for standard screens.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSetting('highFpsMode', true)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      settings.highFpsMode
                        ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">Uncapped 120Hz</span>
                      <span className="text-[10px] font-mono text-amber-400">ULTRA SMOOTH</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      Ultra-low input lag and silky animations on ProMotion and gaming displays.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTROLS & INPUT */}
          {activeTab === 'controls' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Touch &amp; Motion Control Scheme
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select your preferred steering interaction for mobile and touch screens.
                </p>
              </div>

              {/* 3 Interactive Cards */}
              <div className="space-y-2.5">
                {/* 1. Classic Touch Buttons */}
                <button
                  type="button"
                  onClick={() => updateSetting('controlScheme', 'classic')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    settings.controlScheme === 'classic'
                      ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                      settings.controlScheme === 'classic'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    ◀ ▶
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-white">Classic Touch Buttons</h4>
                      {settings.controlScheme === 'classic' && (
                        <span className="text-[10px] font-mono text-amber-400 font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Left / Right steering tap zones on screen edges + handbrake drift button. Best for classic arcade reflex racing.
                    </p>
                  </div>
                </button>

                {/* 2. Analog Steering Wheel */}
                <button
                  type="button"
                  onClick={() => updateSetting('controlScheme', 'wheel')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    settings.controlScheme === 'wheel'
                      ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                      settings.controlScheme === 'wheel'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    ☸️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-white">Analog Steering Wheel</h4>
                      {settings.controlScheme === 'wheel' && (
                        <span className="text-[10px] font-mono text-amber-400 font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Rotating Alcantara wheel dial with smooth rotation physics and center horn hub. Ideal for precision hairpin drift angles.
                    </p>
                  </div>
                </button>

                {/* 3. One-Thumb Tap & Swipe */}
                <button
                  type="button"
                  onClick={() => updateSetting('controlScheme', 'swipe')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                    settings.controlScheme === 'swipe'
                      ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                      settings.controlScheme === 'swipe'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    👆
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-white">One-Thumb Tap &amp; Swipe</h4>
                      {settings.controlScheme === 'swipe' && (
                        <span className="text-[10px] font-mono text-amber-400 font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      One-handed mobile control: Tap anywhere to counter-steer, swipe horizontally to slide smoothly through heavy highway traffic.
                    </p>
                  </div>
                </button>
              </div>

              {/* Left-handed cockpit + steering sensitivity */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-white">Left-Handed Cockpit</h4>
                    <p className="text-[11px] text-slate-400">Steering on the right, pedals on the left.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.leftHanded}
                    aria-label="Left-handed cockpit"
                    onClick={() => updateSetting('leftHanded', !settings.leftHanded)}
                    className={`shrink-0 w-12 h-7 rounded-full border relative transition-colors ${
                      settings.leftHanded ? 'bg-amber-500/80 border-amber-400' : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] left-[2px] w-[22px] h-[22px] rounded-full bg-white shadow transition-transform ${
                        settings.leftHanded ? 'translate-x-[20px]' : ''
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Steering Sensitivity</h4>
                  <p className="text-[11px] text-slate-400 mb-2">How sharply the car answers your steering.</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['smooth', 'balanced', 'sharp'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateSetting('steerSensitivity', s)}
                        className={`min-h-[36px] rounded-lg text-[11px] font-semibold border transition-colors ${
                          settings.steerSensitivity === s
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {s === 'smooth' ? '🪶 Smooth' : s === 'balanced' ? '⚖️ Balanced' : '⚡ Sharp'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Compact Haptics Summary + Shortcut to Per-Device Calibration */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-white">Haptic Feedback Engine</h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {getHapticDeviceMeta(activeDeviceId).shortLabel}: Collision{' '}
                      {Math.round(activeCalibration.collisionIntensity * 100)}% · Drift{' '}
                      {Math.round(activeCalibration.driftIntensity * 100)}%
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.hapticsEnabled}
                    onClick={() => updateSetting('hapticsEnabled', !settings.hapticsEnabled)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      settings.hapticsEnabled ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                    aria-label="Toggle Mobile Haptics"
                  >
                    <span className="w-4 h-4 rounded-full bg-slate-950 shadow-md transform" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('haptics')}
                  className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Vibrate className="w-3.5 h-3.5" />
                    <span>Calibrate Per-Device Collision &amp; Drift Intensity</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: PER-DEVICE HAPTIC CALIBRATION */}
          {activeTab === 'haptics' && (
            <div className="space-y-3.5" data-testid="haptics-calibration-panel">
              {/* Global Haptic Master Switch & Current Device Hardware Detection */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <Vibrate className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Haptic Feedback Master</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      This Device: <span className="text-slate-200 font-medium">{detectedDevice.label}</span>{' '}
                      <span
                        className={`inline-block ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          detectedDevice.supportsVibration
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {detectedDevice.supportsVibration ? 'MOTOR READY' : 'FALLBACK MODE'}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.hapticsEnabled}
                    onClick={() => updateSetting('hapticsEnabled', !settings.hapticsEnabled)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      settings.hapticsEnabled ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                    aria-label="Toggle Mobile Haptics"
                  >
                    <span className="w-4 h-4 rounded-full bg-slate-950 shadow-md transform" />
                  </button>
                </div>

                {!settings.hapticsEnabled && (
                  <p className="text-[11px] font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                    Haptics are muted globally during runs. You can still tune and test device pulses below.
                  </p>
                )}
              </div>

              {/* Per-Device Profile Switcher */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Per-Device Calibration Profiles
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300">
                    {settings.hapticDeviceMode === 'auto'
                      ? `Auto (${detectedDevice.label.split(' ')[0]})`
                      : `Active Override: ${getHapticDeviceMeta(activeDeviceId).shortLabel}`}
                  </span>
                </div>

                <div
                  className="grid grid-cols-2 sm:grid-cols-5 gap-1.5"
                  role="group"
                  aria-label="Device Haptic Profiles"
                >
                  {HAPTIC_DEVICE_PROFILES.map((profile) => {
                    const isSelected = selectedHapticDeviceId === profile.id;
                    const isDetected = detectedDevice.profileId === profile.id;
                    const isActive = activeDeviceId === profile.id;
                    const cal = settings.hapticCalibrations[profile.id] ?? profile.recommended;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        data-testid={`haptic-device-${profile.id}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedHapticDeviceId(profile.id)}
                        className={`min-h-[54px] px-2 py-1.5 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.22)]'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="flex items-center gap-1 text-[11px] font-bold whitespace-nowrap min-w-0">
                            {renderDeviceProfileIcon(profile.id, 'w-3.5 h-3.5 shrink-0 text-cyan-300')}
                            <span className="truncate">{profile.shortLabel}</span>
                          </span>
                          {(isDetected || isActive) && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isActive ? 'bg-emerald-400' : 'bg-cyan-400'
                              }`}
                              title={isActive ? 'Active on this device' : 'Detected device'}
                            />
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
                          {Math.round(cal.collisionIntensity * 100)}% / {Math.round(cal.driftIntensity * 100)}%
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Device Hardware Summary & Active Binding */}
                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap text-[11px]">
                  <div className="text-slate-300 min-w-0 flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-white">{selectedDeviceMeta.label}</span>
                    <span className="text-slate-400">· {selectedDeviceMeta.actuatorHint}</span>
                    {detectedDevice.profileId === selectedHapticDeviceId && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono whitespace-nowrap">
                        THIS DEVICE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {activeDeviceId !== selectedHapticDeviceId ? (
                      <button
                        type="button"
                        onClick={() => updateSetting('hapticDeviceMode', selectedHapticDeviceId)}
                        className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-[10px] font-mono font-semibold"
                      >
                        Use Here
                      </button>
                    ) : settings.hapticDeviceMode !== 'auto' ? (
                      <button
                        type="button"
                        onClick={() => updateSetting('hapticDeviceMode', 'auto')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-mono"
                      >
                        Restore Auto-Detect
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Collision Events Calibration */}
              <div
                className={`p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border transition-all space-y-2.5 ${
                  pulseHighlight === 'collision'
                    ? 'border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="haptic-collision-slider"
                    className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Collision Events Intensity</span>
                  </label>
                  <span
                    data-testid="haptic-collision-value"
                    className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded ${
                      selectedCalibration.collisionIntensity === 0
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {selectedCalibration.collisionIntensity === 0
                      ? 'OFF (0%)'
                      : `${Math.round(selectedCalibration.collisionIntensity * 100)}%`}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  Scales guardrail scrapes, traffic collisions, sideswipes &amp; parking obstacle hits for{' '}
                  <span className="text-slate-200">{selectedDeviceMeta.shortLabel}</span>.
                </p>

                <input
                  id="haptic-collision-slider"
                  data-testid="haptic-collision-slider"
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={selectedCalibration.collisionIntensity}
                  onChange={(e) =>
                    updateDeviceCalibration(
                      selectedHapticDeviceId,
                      'collisionIntensity',
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                />

                <div className="grid grid-cols-5 gap-1">
                  {[
                    { label: 'Off', val: 0 },
                    { label: '60%', val: 0.6 },
                    { label: '100%', val: 1.0 },
                    { label: '150%', val: 1.5 },
                    { label: '200%', val: 2.0 },
                  ].map((preset) => {
                    const active = Math.abs(selectedCalibration.collisionIntensity - preset.val) < 0.01;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          updateDeviceCalibration(
                            selectedHapticDeviceId,
                            'collisionIntensity',
                            preset.val
                          )
                        }
                        className={`min-h-[30px] rounded-md text-[10px] font-mono transition-colors ${
                          active
                            ? 'bg-rose-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    Sideswipe {formatHapticPatternPreview(38, selectedCalibration.collisionIntensity)} · Crash{' '}
                    {formatHapticPatternPreview(65, selectedCalibration.collisionIntensity)}
                  </span>
                  <button
                    type="button"
                    data-testid="btn-test-collision-haptic"
                    onClick={() => handleTestCategoryHaptic('collision')}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-rose-500/35 text-rose-300 text-[11px] font-mono flex items-center gap-1.5"
                  >
                    <Vibrate className="w-3.5 h-3.5" />
                    <span>Test Collision</span>
                  </button>
                </div>
              </div>

              {/* Drift Triggers Calibration */}
              <div
                className={`p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border transition-all space-y-2.5 ${
                  pulseHighlight === 'drift'
                    ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="haptic-drift-slider"
                    className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Drift Triggers Intensity</span>
                  </label>
                  <span
                    data-testid="haptic-drift-value"
                    className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded ${
                      selectedCalibration.driftIntensity === 0
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {selectedCalibration.driftIntensity === 0
                      ? 'OFF (0%)'
                      : `${Math.round(selectedCalibration.driftIntensity * 100)}%`}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  Scales drift entry, style switch flips (/ &harr; \), &amp; combo milestone bursts for{' '}
                  <span className="text-slate-200">{selectedDeviceMeta.shortLabel}</span>.
                </p>

                <input
                  id="haptic-drift-slider"
                  data-testid="haptic-drift-slider"
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={selectedCalibration.driftIntensity}
                  onChange={(e) =>
                    updateDeviceCalibration(
                      selectedHapticDeviceId,
                      'driftIntensity',
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />

                <div className="grid grid-cols-5 gap-1">
                  {[
                    { label: 'Off', val: 0 },
                    { label: '50%', val: 0.5 },
                    { label: '100%', val: 1.0 },
                    { label: '140%', val: 1.4 },
                    { label: '200%', val: 2.0 },
                  ].map((preset) => {
                    const active = Math.abs(selectedCalibration.driftIntensity - preset.val) < 0.01;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          updateDeviceCalibration(
                            selectedHapticDeviceId,
                            'driftIntensity',
                            preset.val
                          )
                        }
                        className={`min-h-[30px] rounded-md text-[10px] font-mono transition-colors ${
                          active
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    Entry {formatHapticPatternPreview(18, selectedCalibration.driftIntensity)} · Switch{' '}
                    {formatHapticPatternPreview(38, selectedCalibration.driftIntensity)}
                  </span>
                  <button
                    type="button"
                    data-testid="btn-test-drift-haptic"
                    onClick={() => handleTestCategoryHaptic('drift')}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/35 text-cyan-300 text-[11px] font-mono flex items-center gap-1.5"
                  >
                    <Vibrate className="w-3.5 h-3.5" />
                    <span>Test Drift</span>
                  </button>
                </div>
              </div>

              {/* Feedback Notice + Per-Device Reset */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                <button
                  type="button"
                  data-testid="btn-reset-device-haptics"
                  onClick={() => handleResetDeviceCalibration(selectedHapticDeviceId)}
                  className="min-h-[34px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-mono flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset {selectedDeviceMeta.shortLabel} Calibration</span>
                </button>
                {hapticFeedbackNotice && (
                  <span
                    data-testid="haptic-feedback-notice"
                    className="text-[11px] font-mono text-amber-300"
                  >
                    {hapticFeedbackNotice}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls (Pinned) */}
        <div className="shrink-0 p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono transition-colors"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm tracking-wide shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
