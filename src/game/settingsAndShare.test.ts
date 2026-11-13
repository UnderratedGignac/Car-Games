/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadGameSettings,
  saveGameSettings,
  GameSettings,
} from '../components/SettingsModal';
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
  assert.equal(initial.highFpsMode, false);

  // 2. Save modified settings and verify persistence
  const custom: GameSettings = {
    masterVolume: 0.5,
    musicVolume: 0.4,
    sfxVolume: 0.6,
    engineVolume: 0.3,
    screenShake: 0.0, // Motion Sickness Safe
    controlScheme: 'wheel',
    hapticsEnabled: false,
    highFpsMode: true,
  };

  saveGameSettings(custom);
  const loaded = loadGameSettings();
  assert.deepEqual(loaded, custom);
  assert.equal(loaded.screenShake, 0.0);
  assert.equal(loaded.controlScheme, 'wheel');
});

test('Game Settings - Clamping and Malformed JSON Fallbacks', () => {
  mockStorage.clear();

  // Test out-of-bounds volumes
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
