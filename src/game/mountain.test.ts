/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialMountainState,
  extendMountainTrack,
  generateMountainTrack,
  sampleMountainSurface,
  sampleMountainTerrainElevation,
  stepMountainPhysics,
} from './mountain';

test('generateMountainTrack builds heavy slopes, ramps, chasm gaps, and smooth solid transitions', () => {
  const track = generateMountainTrack(120, 3.4, 42);
  assert.equal(track.length, 120);

  // Starting launchpad is safe and level
  for (let i = 0; i <= 4; i++) {
    assert.equal(track[i].y, 0);
    assert.equal(track[i].isChasmGap, false);
  }

  let maxSlopePct = 0;
  let minSlopePct = 0;
  let rampCount = 0;
  let gapCount = 0;

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1];
    const curr = track[i];
    if (curr.isMountainRamp) rampCount++;
    if (curr.isChasmGap) gapCount++;

    if (!prev.isChasmGap && !curr.isChasmGap) {
      const stepY = curr.y - prev.y;
      const slopePct = (stepY / 3.4) * 100;
      if (slopePct > maxSlopePct) maxSlopePct = slopePct;
      if (slopePct < minSlopePct) minSlopePct = slopePct;
      // Verify no discontinuous vertical cliff steps between connected solid slices
      assert.ok(
        Math.abs(stepY) <= 2.2,
        `Unexpected vertical step ${stepY} at index ${curr.index}`
      );
    }
  }

  assert.ok(maxSlopePct >= 20, `Expected steep climb >= 20%, got ${maxSlopePct.toFixed(1)}%`);
  assert.ok(minSlopePct <= -18, `Expected steep descent <= -18%, got ${minSlopePct.toFixed(1)}%`);
  assert.ok(rampCount >= 10, `Expected launch ramps, got ${rampCount}`);
  assert.ok(gapCount >= 10, `Expected chasm gaps, got ${gapCount}`);
});

test('extendMountainTrack seamlessly continues track indices and coordinates', () => {
  const base = generateMountainTrack(60, 3.4, 77);
  const ext = extendMountainTrack(base, 40, 3.4, 77);
  assert.equal(ext.length, 40);
  assert.equal(ext[0].index, 60);
  const lastBase = base[base.length - 1];
  const dist = Math.hypot(ext[0].x - lastBase.x, ext[0].z - lastBase.z);
  assert.ok(Math.abs(dist - 3.4) < 0.05);
});

test('stepMountainPhysics accelerates downhill and slows uphill on heavy slopes', () => {
  const track = generateMountainTrack(90, 3.4, 42);
  // Find a steep downhill slice and a steep uphill slice
  let uphillIdx = -1;
  let downhillIdx = -1;
  for (let i = 12; i < 65; i++) {
    if (track[i].isChasmGap || track[i + 1].isChasmGap || track[i - 1].isChasmGap) continue;
    const slope = (track[i + 1].y - track[i - 1].y) / 6.8;
    if (slope > 0.2 && uphillIdx < 0) uphillIdx = i;
    if (slope < -0.2 && downhillIdx < 0) downhillIdx = i;
  }
  assert.ok(uphillIdx > 0 && downhillIdx > 0, 'Track must contain both steep uphill and downhill segments');

  const upPt = track[uphillIdx];
  const upState = createInitialMountainState(upPt.x, upPt.z, upPt.y, upPt.heading, 24);
  const upRes = stepMountainPhysics(
    upState,
    { steerInput: 0, throttle: 0.7 },
    { topSpeed: 28, driftGrip: 0.8, handlingRate: 2.5 },
    track,
    3.4,
    0.04
  );

  const downPt = track[downhillIdx];
  const downState = createInitialMountainState(downPt.x, downPt.z, downPt.y, downPt.heading, 24);
  const downRes = stepMountainPhysics(
    downState,
    { steerInput: 0, throttle: 0.7 },
    { topSpeed: 28, driftGrip: 0.8, handlingRate: 2.5 },
    track,
    3.4,
    0.04
  );

  const upSpeed = Math.hypot(upRes.state.vx, upRes.state.vz);
  const downSpeed = Math.hypot(downRes.state.vx, downRes.state.vz);
  assert.ok(downSpeed > upSpeed + 0.5, `Downhill (${downSpeed.toFixed(2)}) should exceed uphill (${upSpeed.toFixed(2)})`);
});

test('fast car launches off mountain ramp, clears chasm, and lands cleanly on opposite mountain', () => {
  const track = generateMountainTrack(80, 3.4, 42);
  const rampStartIdx = track.findIndex((p) => p.isMountainRamp);
  assert.ok(rampStartIdx > 0);
  const startPt = track[rampStartIdx - 1];

  let state = createInitialMountainState(startPt.x, startPt.z, startPt.y, startPt.heading, 29);
  let launched = false;
  let landed = false;
  let maxAir = 0;

  for (let step = 0; step < 180; step++) {
    const res = stepMountainPhysics(
      state,
      { steerInput: 0, throttle: 1.25, isFever: true },
      { topSpeed: 30, driftGrip: 0.85, handlingRate: 2.4 },
      track,
      3.4,
      0.02
    );
    state = res.state;
    if (res.justLaunched) launched = true;
    if (state.isAirborne) maxAir = Math.max(maxAir, state.airTimeSec);
    if (res.justLanded) {
      landed = true;
      break;
    }
    assert.equal(res.fellReason, null, `Fast jump should not fall: ${res.fellReason}`);
  }

  assert.equal(launched, true, 'Car should launch off ramp lip');
  assert.equal(landed, true, 'Car should land safely on the opposite mountain');
  assert.ok(maxAir >= 0.35, `Expected substantial air time >= 0.35s, got ${maxAir.toFixed(2)}s`);
  assert.ok(state.jumpsCleared >= 1);
});

test('slow car entering chasm gap falls and driving off mountain edge triggers cliff fall', () => {
  const track = generateMountainTrack(80, 3.4, 42);
  const rampIdx = track.findIndex((p) => p.isMountainRamp);
  const lipPt = track[rampIdx + 4]; // ramp lip just before gap

  // 1. Slow approach drops into chasm or misses opposite rim
  let slowState = createInitialMountainState(lipPt.x, lipPt.z, lipPt.y, lipPt.heading, 8.5);
  let fellChasmReason: string | null = null;
  for (let step = 0; step < 180; step++) {
    const res = stepMountainPhysics(
      slowState,
      { steerInput: 0, throttle: 0.32 },
      { topSpeed: 12, driftGrip: 0.85, handlingRate: 2.2 },
      track,
      3.4,
      0.025
    );
    slowState = res.state;
    if (res.fellReason) {
      fellChasmReason = res.fellReason;
      break;
    }
  }
  assert.ok(
    fellChasmReason === 'Missed Mountain Jump' || fellChasmReason === 'Fell Into Mountain Chasm',
    `Expected jump/chasm fall reason, got ${fellChasmReason}`
  );

  // 2. Driving off lateral mountain cliff edge triggers Fell Off Mountain Cliff
  const edgePt = track[16];
  const offState = createInitialMountainState(
    edgePt.x + edgePt.nx * (edgePt.width * 0.5 + 1.4),
    edgePt.z + edgePt.nz * (edgePt.width * 0.5 + 1.4),
    edgePt.y,
    edgePt.heading + 0.5,
    22
  );
  const edgeRes = stepMountainPhysics(
    offState,
    { steerInput: 1, throttle: 1.0 },
    { topSpeed: 28, driftGrip: 0.85, handlingRate: 2.4 },
    track,
    3.4,
    0.02
  );
  assert.equal(edgeRes.fellReason, 'Fell Off Mountain Cliff');

  // Verify terrain elevation drops dramatically inside chasm vs road
  const chasmElev = sampleMountainTerrainElevation(0, track[rampIdx + 6].z, track[rampIdx + 4].y, true);
  assert.ok(chasmElev < track[rampIdx + 4].y - 15);
});

test('low-speed or shallow mountain edge contact bounces off rocky berm instead of ending the run', () => {
  const track = generateMountainTrack(80, 3.4, 42);
  const edgePt = track[16];

  // 1. Slow edge touch bounces cleanly onto the mountain ridge
  const slowEdgeState = createInitialMountainState(
    edgePt.x + edgePt.nx * (edgePt.width * 0.5 + 0.8),
    edgePt.z + edgePt.nz * (edgePt.width * 0.5 + 0.8),
    edgePt.y,
    edgePt.heading + 0.45,
    13.5
  );
  const slowEdgeRes = stepMountainPhysics(
    slowEdgeState,
    { steerInput: 0.4, throttle: 0.5 },
    { topSpeed: 28, driftGrip: 0.85, handlingRate: 2.4 },
    track,
    3.4,
    0.02
  );
  assert.equal(slowEdgeRes.fellReason, null);
  assert.equal(slowEdgeRes.bermBounce, true);

  // 2. Fast but very shallow graze along the edge also bounces off the berm
  const shallowFastState = createInitialMountainState(
    edgePt.x + edgePt.nx * (edgePt.width * 0.5 + 0.6),
    edgePt.z + edgePt.nz * (edgePt.width * 0.5 + 0.6),
    edgePt.y,
    edgePt.heading + 0.08,
    24.0
  );
  const shallowFastRes = stepMountainPhysics(
    shallowFastState,
    { steerInput: 0, throttle: 0.8 },
    { topSpeed: 28, driftGrip: 0.85, handlingRate: 2.4 },
    track,
    3.4,
    0.02
  );
  assert.equal(shallowFastRes.fellReason, null);
  assert.equal(shallowFastRes.bermBounce, true);
});

