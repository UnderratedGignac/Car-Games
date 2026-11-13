/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { soundFX, triggerHaptic } from '../game/audio';

export interface GameSettings {
  masterVolume: number; // 0.0 - 1.0 (default 1.0)
  musicVolume: number;  // 0.0 - 1.0 (default 0.8)
  sfxVolume: number;    // 0.0 - 1.0 (default 0.9)
  engineVolume: number; // 0.0 - 1.0 (default 0.7)
  screenShake: number;  // 0.0 - 1.0 (default 1.0, 0.0 = motion safe)
  controlScheme: 'classic' | 'wheel' | 'swipe'; // default 'classic'
  hapticsEnabled: boolean; // default true
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
  hapticsEnabled: true,
  highFpsMode: false,
};

/**
 * Loads game settings from localStorage with safe fallbacks and bounds clamping.
 */
export function loadGameSettings(): GameSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS };
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

        return {
          masterVolume: clamp01(parsed.masterVolume, DEFAULT_SETTINGS.masterVolume),
          musicVolume: clamp01(parsed.musicVolume, DEFAULT_SETTINGS.musicVolume),
          sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
          engineVolume: clamp01(parsed.engineVolume, DEFAULT_SETTINGS.engineVolume),
          screenShake: clamp01(parsed.screenShake, DEFAULT_SETTINGS.screenShake),
          controlScheme: control,
          hapticsEnabled:
            typeof parsed.hapticsEnabled === 'boolean'
              ? parsed.hapticsEnabled
              : DEFAULT_SETTINGS.hapticsEnabled,
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
  return { ...DEFAULT_SETTINGS };
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

type SettingsTab = 'audio' | 'accessibility' | 'controls';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [hapticFeedbackNotice, setHapticFeedbackNotice] = useState<string | null>(null);

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

  const updateSetting = useCallback(
    <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
      const nextSettings: GameSettings = {
        ...settings,
        [key]: value,
      };
      onUpdateSettings(nextSettings);
      saveGameSettings(nextSettings);

      // Keep soundFX volumes synchronized in real-time
      if (key === 'masterVolume' || key === 'musicVolume') {
        const effMusic = (nextSettings.musicVolume * nextSettings.masterVolume);
        soundFX.setMusicVolume(effMusic);
      }
      if (key === 'masterVolume' || key === 'sfxVolume') {
        const effSfx = (nextSettings.sfxVolume * nextSettings.masterVolume);
        soundFX.setSfxVolume(effSfx);
      }
    },
    [settings, onUpdateSettings]
  );

  const handleTestSfx = useCallback(() => {
    soundFX.playCoinPickup(3);
    if (settings.hapticsEnabled) {
      triggerHaptic('light');
    }
  }, [settings.hapticsEnabled]);

  const handleTestHaptics = useCallback(() => {
    const success = triggerHaptic('medium');
    setHapticFeedbackNotice(
      success ? '⚡ Haptic pulse triggered!' : '⚠️ Vibration unsupported on this device/browser'
    );
    setTimeout(() => setHapticFeedbackNotice(null), 2500);
  }, []);

  const handleResetDefaults = useCallback(() => {
    onUpdateSettings({ ...DEFAULT_SETTINGS });
    saveGameSettings({ ...DEFAULT_SETTINGS });
    soundFX.setMusicVolume(DEFAULT_SETTINGS.musicVolume * DEFAULT_SETTINGS.masterVolume);
    soundFX.setSfxVolume(DEFAULT_SETTINGS.sfxVolume * DEFAULT_SETTINGS.masterVolume);
    soundFX.playCoinPickup(1);
  }, [onUpdateSettings]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Settings and Accessibility"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
        style={{ backgroundColor: 'rgba(9, 14, 26, 0.96)' }}
      >
        {/* Ambient Top Cyber Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-10 bg-cyan-500/20 blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/70 border border-cyan-500/50 flex items-center justify-center text-cyan-300 font-bold text-sm shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold tracking-wide text-white">
                GAME SETTINGS
              </h2>
              <p className="text-[10px] font-mono text-cyan-400 tracking-wider uppercase">
                AUDIO · ACCESSIBILITY · CONTROLS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors text-sm"
            aria-label="Close Settings"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 p-2 gap-1.5 bg-slate-900/60 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'audio'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.4)] font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <span>🔊</span>
            <span>Audio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accessibility')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'accessibility'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.4)] font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <span>🛡️</span>
            <span>Motion</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('controls')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'controls'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.4)] font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <span>🎮</span>
            <span>Controls</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[calc(92vh-150px)]">
          {/* TAB 1: AUDIO MIXER */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Master Equalizer &amp; Channel Gains
                </span>
                <button
                  type="button"
                  onClick={handleTestSfx}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono flex items-center gap-1 border border-cyan-500/30"
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

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => updateSetting('screenShake', 0)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
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
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                      settings.screenShake === 0.5
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Gentle (50%)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('screenShake', 1.0)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                      settings.screenShake === 1.0
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Arcade Max (100%)
                  </button>
                </div>
              </div>

              {/* High Refresh Rate Mode */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      ⚡ Refresh Rate Cadence
                    </h3>
                    <p className="text-xs text-slate-400">
                      Target rendering frame rate for viewport and camera animation.
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      settings.highFpsMode
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {settings.highFpsMode ? '120Hz Uncapped' : '60 FPS Standard'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
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

              {/* Mobile Haptics Toggle */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">Mobile Haptic Feedback</h4>
                    <p className="text-[11px] text-slate-400">
                      Tactile micro-vibrations on drift apexes, fever bursts, and guardrail scrapes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('hapticsEnabled', !settings.hapticsEnabled)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                      settings.hapticsEnabled ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                    aria-label="Toggle Mobile Haptics"
                  >
                    <span className="w-4 h-4 rounded-full bg-slate-950 shadow-md transform" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleTestHaptics}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono border border-cyan-500/30 flex items-center gap-1.5"
                  >
                    <span>📳</span> Test Vibration Pulse
                  </button>
                  {hapticFeedbackNotice && (
                    <span className="text-[10px] font-mono text-amber-400">
                      {hapticFeedbackNotice}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono transition-colors"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm tracking-wide shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
