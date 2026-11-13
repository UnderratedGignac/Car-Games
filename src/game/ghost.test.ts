/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GhostFrame,
  GhostRun,
  GHOST_STORAGE_KEY_PREFIX,
  generateDevRivalGhost,
  loadBestGhostRun,
  saveBestGhostRun,
  sampleGhostPosition,
  normalizeAngle,
} from './ghost';
import { generateSCurveTrack, generateHighwayTrack } from './rules';

// Minimal mock localStorage for node test environment
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

test('Ghost Run Engine - normalizeAngle wraps angles within (-PI, PI]', () => {
  assert.equal(Number(normalizeAngle(0).toFixed(4)), 0);
  assert.equal(Math.abs(Number(normalizeAngle(Math.PI).toFixed(4))), Number(Math.PI.toFixed(4)));
  assert.equal(Math.abs(Number(normalizeAngle(-Math.PI).toFixed(4))), Number(Math.PI.toFixed(4)));
  assert.equal(Math.abs(Number(normalizeAngle(Math.PI * 3).toFixed(4))), Number(Math.PI.toFixed(4)));
  assert.equal(Number(normalizeAngle(Math.PI + 0.5).toFixed(4)), Number((-Math.PI + 0.5).toFixed(4)));
});

test('Ghost Run Engine - generateDevRivalGhost creates challenging rival runs for each mode', () => {
  const modes = ['drift', 'highway_traffic', 'zen'] as const;

  for (const mode of modes) {
    const rival = generateDevRivalGhost(mode);

    assert.equal(rival.mode, mode);
    assert.ok(rival.carId.length > 0, `Rival should have a carId for ${mode}`);
    assert.ok(rival.carColor.startsWith('#'), `Rival should have a hex color for ${mode}`);
    assert.ok(rival.distance > 1000, `Rival should achieve significant distance for ${mode}`);
    assert.ok(rival.score > 5000, `Rival should achieve substantial score for ${mode}`);
    assert.ok(rival.frames.length >= 700, `Rival should have at least 700 frames at 10Hz`);

    // Verify time strictly increments by 0.1s and distance is monotonically non-decreasing
    for (let i = 1; i < rival.frames.length; i++) {
      const prev = rival.frames[i - 1];
      const cur = rival.frames[i];
      assert.ok(cur.timeSec > prev.timeSec, `Frame ${i} timeSec must increase`);
      assert.ok(cur.distance >= prev.distance, `Frame ${i} distance must not decrease`);
      assert.ok(cur.speedKmh > 0, `Frame ${i} speed must be positive`);
    }
  }

  // Highway rival weaves lanes
  const hwyRival = generateDevRivalGhost('highway_traffic');
  const hwyOffsets = hwyRival.frames.map((f) => f.lateralOffset);
  assert.ok(Math.max(...hwyOffsets) > 1.5, 'Highway rival should use right lane');
  assert.ok(Math.min(...hwyOffsets) < -1.5, 'Highway rival should use left lane');

  // Drift rival has noticeable slip angles
  const driftRival = generateDevRivalGhost('drift');
  const driftAngles = driftRival.frames.map((f) => f.angle);
  const baseHeading = -Math.PI / 2;
  const maxDev = Math.max(...driftAngles.map((a) => Math.abs(a - baseHeading)));
  assert.ok(maxDev > 0.25, 'Drift rival should exhibit dynamic slip angle sweeps');
});

test('Ghost Run Engine - sampleGhostPosition handles empty, boundary, and clamping cases', () => {
  const emptyRun: GhostRun = {
    mode: 'drift',
    carId: 't1',
    carColor: '#fff',
    score: 0,
    distance: 0,
    createdAt: 0,
    frames: [],
  };

  assert.equal(sampleGhostPosition(emptyRun, 5.0), null);

  const sampleRun: GhostRun = {
    mode: 'drift',
    carId: 't1',
    carColor: '#fff',
    score: 1000,
    distance: 500,
    createdAt: 0,
    frames: [
      { timeSec: 1.0, distance: 100, lateralOffset: -1.0, angle: 0, speedKmh: 100 },
      { timeSec: 2.0, distance: 200, lateralOffset: 1.0, angle: 0.5, speedKmh: 150 },
    ],
  };

  // Sample before or at first frame clamps to frame 0
  const early = sampleGhostPosition(sampleRun, 0.5);
  assert.ok(early);
  assert.equal(early.timeSec, 1.0);
  assert.equal(early.distance, 100);

  // Sample after last frame clamps to last frame
  const late = sampleGhostPosition(sampleRun, 3.5);
  assert.ok(late);
  assert.equal(late.timeSec, 2.0);
  assert.equal(late.distance, 200);
});

test('Ghost Run Engine - sampleGhostPosition performs accurate linear and angular interpolation', () => {
  const run: GhostRun = {
    mode: 'drift',
    carId: 't10',
    carColor: '#06b6d4',
    score: 2000,
    distance: 1000,
    createdAt: 1000,
    frames: [
      { timeSec: 10.0, distance: 500, lateralOffset: -2.0, angle: 3.10, speedKmh: 120 },
      { timeSec: 12.0, distance: 700, lateralOffset: 2.0, angle: -3.10, speedKmh: 180 },
    ],
  };

  // Exactly halfway at t = 11.0 (tNorm = 0.5)
  const mid = sampleGhostPosition(run, 11.0);
  assert.ok(mid);
  assert.equal(mid.timeSec, 11.0);
  assert.equal(mid.distance, 600); // 500 + 100
  assert.equal(mid.lateralOffset, 0); // -2.0 + 2.0
  assert.equal(mid.speedKmh, 150); // 120 + 30

  // Shortest angular path across +/- PI boundary:
  // 3.10 rad is near PI (~3.1416). -3.10 rad is near -PI.
  // The angular delta across the boundary is ~0.083, so halfway should be near Math.PI!
  assert.ok(Math.abs(Math.abs(mid.angle) - Math.PI) < 0.1, `Angle halfway should wrap smoothly across boundary, got ${mid.angle}`);
});

test('Ghost Run Engine - sampleGhostPosition supports preallocated out frame for Zero GC', () => {
  const run = generateDevRivalGhost('highway_traffic');
  const scratch: GhostFrame = {
    timeSec: 0,
    distance: 0,
    lateralOffset: 0,
    angle: 0,
    speedKmh: 0,
  };

  const res = sampleGhostPosition(run, 15.35, scratch);
  assert.equal(res, scratch, 'Should return the exact preallocated scratch reference');
  assert.equal(scratch.timeSec, 15.35);
  assert.ok(scratch.distance > 0);
  assert.ok(scratch.speedKmh > 0);
});

test('Ghost Run Engine - saveBestGhostRun and loadBestGhostRun localStorage roundtrip & high-water mark', () => {
  mockStorage.clear();

  const runA: GhostRun = {
    mode: 'drift',
    carId: 'car_a',
    carColor: '#ff0055',
    score: 5000,
    distance: 850,
    createdAt: 1000,
    frames: [
      { timeSec: 0, distance: 0, lateralOffset: 0, angle: 0, speedKmh: 100 },
      { timeSec: 10, distance: 850, lateralOffset: 1, angle: 0, speedKmh: 120 },
    ],
  };

  // 1. Initial save of runA
  const savedFirst = saveBestGhostRun(runA);
  assert.equal(savedFirst, true);

  const loadedA = loadBestGhostRun('drift');
  assert.ok(loadedA);
  assert.equal(loadedA.carId, 'car_a');
  assert.equal(loadedA.distance, 850);
  assert.equal(loadedA.frames.length, 2);

  // 2. Attempt to save worse run (lower distance and lower score) -> should NOT overwrite
  const worseRun: GhostRun = {
    mode: 'drift',
    carId: 'car_worse',
    carColor: '#aaaaaa',
    score: 4000,
    distance: 700,
    createdAt: 2000,
    frames: [{ timeSec: 0, distance: 0, lateralOffset: 0, angle: 0, speedKmh: 80 }],
  };
  const savedWorse = saveBestGhostRun(worseRun);
  assert.equal(savedWorse, false);
  const stillLoadedA = loadBestGhostRun('drift');
  assert.equal(stillLoadedA?.carId, 'car_a');

  // 3. Attempt to save run with equal distance but higher score -> should overwrite
  const equalDistHigherScore: GhostRun = {
    mode: 'drift',
    carId: 'car_skilled',
    carColor: '#00ff88',
    score: 9500,
    distance: 850,
    createdAt: 3000,
    frames: [
      { timeSec: 0, distance: 0, lateralOffset: 0, angle: 0, speedKmh: 100 },
      { timeSec: 10, distance: 850, lateralOffset: 0, angle: 0, speedKmh: 140 },
    ],
  };
  const savedSkilled = saveBestGhostRun(equalDistHigherScore);
  assert.equal(savedSkilled, true);
  const loadedSkilled = loadBestGhostRun('drift');
  assert.equal(loadedSkilled?.carId, 'car_skilled');
  assert.equal(loadedSkilled?.score, 9500);

  // 4. Save run with higher distance -> should overwrite
  const longerRun: GhostRun = {
    mode: 'drift',
    carId: 'car_legend',
    carColor: '#ffd700',
    score: 15000,
    distance: 1420,
    createdAt: 4000,
    frames: [
      { timeSec: 0, distance: 0, lateralOffset: 0, angle: 0, speedKmh: 100 },
      { timeSec: 15, distance: 1420, lateralOffset: 0, angle: 0, speedKmh: 180 },
    ],
  };
  const savedLonger = saveBestGhostRun(longerRun);
  assert.equal(savedLonger, true);
  const loadedLegend = loadBestGhostRun('drift');
  assert.equal(loadedLegend?.carId, 'car_legend');
  assert.equal(loadedLegend?.distance, 1420);
});

test('Ghost Run Engine - Frame recording at 10Hz accumulator simulation', () => {
  const recordedFrames: GhostFrame[] = [];
  let recordTimer = 0;
  let elapsedSec = 0;
  const RECORD_INTERVAL = 0.1; // 10 Hz

  // Simulate 60 FPS loop (16.67ms per tick) for 2.0 seconds
  const dt = 1 / 60;
  for (let frame = 0; frame < 120; frame++) {
    elapsedSec += dt;
    recordTimer += dt;
    if (recordTimer >= RECORD_INTERVAL) {
      recordTimer -= RECORD_INTERVAL;
      recordedFrames.push({
        timeSec: Number(elapsedSec.toFixed(2)),
        distance: Number((elapsedSec * 45).toFixed(1)), // ~162 km/h
        lateralOffset: 0.5,
        angle: -1.57,
        speedKmh: 162,
      });
    }
  }

  // Over 2 seconds, 10Hz should record ~20 frames
  assert.ok(recordedFrames.length >= 19 && recordedFrames.length <= 21, `Expected ~20 frames, got ${recordedFrames.length}`);
  assert.ok(recordedFrames[0].timeSec >= 0.1);
  assert.ok(recordedFrames[recordedFrames.length - 1].timeSec >= 1.9);
});

test('Nitro Canister Track Placement - generates Nitro Canisters every 200m-300m', () => {
  const sCurveTrack = generateSCurveTrack(250, 2.6, 99);
  const canistersSCurve = sCurveTrack.filter((p: any) => p.hasNitroCanister);
  assert.ok(canistersSCurve.length >= 2, 'SCurve track should generate multiple canisters over 250 points');
  for (const c of canistersSCurve) {
    assert.equal(typeof c.canisterX, 'number');
    assert.equal(typeof c.canisterZ, 'number');
    assert.equal(c.canisterCollected, false);
  }

  const hwyTrack = generateHighwayTrack(250, 3.4, 99);
  const canistersHwy = hwyTrack.filter((p: any) => p.hasNitroCanister);
  assert.ok(canistersHwy.length >= 2, 'Highway track should generate multiple canisters over 250 points');
  for (const c of canistersHwy) {
    assert.equal(typeof c.canisterX, 'number');
    assert.equal(typeof c.canisterZ, 'number');
    assert.equal(c.canisterCollected, false);
  }
});

