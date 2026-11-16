/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialParkingState,
  createParkingStages,
  evaluateParkingBayStatus,
  evaluateParkingProximity,
  stepParkingObstacles,
  stepParkingPhysics,
} from './parking';

test('createParkingStages returns 12 distinct isolated precision parking & gymkhana stages', () => {
  const stagesA = createParkingStages();
  const stagesB = createParkingStages();

  assert.equal(stagesA.length, 12);
  assert.deepEqual(
    stagesA.map((s) => s.maneuverType),
    [
      'nose_in',
      'reverse_bay',
      'parallel',
      'slalom_reverse',
      'chicane_diagonal',
      'gymkhana_180',
      'underground_tight',
      'loading_dock',
      'three_point_turn',
      'offset_chicane_parallel',
      'double_slalom_bay',
      'valet_gauntlet',
    ]
  );

  // Mutating stage clone A must not leak into stage clone B
  stagesA[0].cones[0].knocked = true;
  assert.equal(stagesB[0].cones[0].knocked, false);

  const ids = new Set<string>();
  for (let i = 0; i < stagesA.length; i++) {
    const st = stagesA[i];
    assert.equal(st.stageNumber, i + 1);
    assert.equal(ids.has(st.id), false, `Duplicate stage id: ${st.id}`);
    ids.add(st.id);
    assert.ok(st.targetBay.width >= 3.0);
    assert.ok(st.targetBay.length >= 5.0);
    assert.ok(st.parkedCars.length >= 2);

    // Every stage spawn must have generous clearance from parked cars & barriers
    const spawnState = createInitialParkingState(st);
    const spawnProx = evaluateParkingProximity(spawnState, st);
    assert.ok(spawnProx.minClearanceM > 0.75, `Stage ${st.stageNumber} spawn too tight: ${spawnProx.minClearanceM}m`);

    // Every stage target bay must accept a perfectly aligned stopped car once gates are cleared
    for (const g of st.slalomGates) g.passed = true;
    const goalState = createInitialParkingState(st);
    goalState.x = st.targetBay.x;
    goalState.z = st.targetBay.z;
    goalState.heading = st.targetBay.heading;
    const bayStatus = evaluateParkingBayStatus(goalState, st);
    assert.equal(bayStatus.readyToLock, true, `Stage ${st.stageNumber} targetBay should lock cleanly`);
  }
});

test('stepParkingPhysics models D/R/P gears, reverse Ackermann steering, and high-speed handbrake J-turn', () => {
  const stages = createParkingStages();
  const stage = stages[0];
  const bounds = { halfPlazaWidth: stage.plazaWidth * 0.5, minZ: stage.endZ, maxZ: stage.startZ };
  const stats = { topSpeed: 22.0, handlingRate: 2.8 };

  let s = createInitialParkingState(stage);
  assert.equal(s.gear, 'D');

  // 1. Drive forward turning right (+steerInput increases heading when moving forward)
  const initialHeading = s.heading;
  for (let i = 0; i < 24; i++) {
    s = stepParkingPhysics(s, { steerInput: 1, gasInput: 1, brakeInput: 0, gear: 'D' }, stats, bounds, 0.016);
  }
  assert.ok(s.speed > 1.5, `Expected positive forward speed in D, got ${s.speed}`);
  assert.ok(s.heading > initialHeading + 0.05, 'Right steer in Drive turns nose right (+heading)');

  // 2. Shift to P locks vehicle cleanly to near zero speed
  for (let i = 0; i < 40; i++) {
    s = stepParkingPhysics(s, { steerInput: 0, gasInput: 1, brakeInput: 0, gear: 'P' }, stats, bounds, 0.016);
  }
  assert.equal(s.gear, 'P');
  assert.ok(Math.abs(s.speed) < 0.05, 'Park gear locks drive wheels');

  // 3. Shift to R moves backward and reverses yaw direction cleanly
  let rev = createInitialParkingState(stage);
  const revInitHeading = rev.heading;
  for (let i = 0; i < 28; i++) {
    rev = stepParkingPhysics(rev, { steerInput: 1, gasInput: 1, brakeInput: 0, gear: 'R' }, stats, bounds, 0.016);
  }
  assert.ok(rev.speed < -1.0, `Expected negative speed in Reverse, got ${rev.speed}`);
  assert.ok(rev.heading < revInitHeading - 0.03, 'Right steer while reversing swings nose left (-heading)');

  // 4. High-speed handbrake initiates J-turn drift state
  let jTurn = createInitialParkingState(stages[5]);
  for (let i = 0; i < 45; i++) {
    jTurn = stepParkingPhysics(jTurn, { steerInput: 0, gasInput: 1, brakeInput: 0, gear: 'D' }, stats, {
      halfPlazaWidth: 12,
      minZ: -64,
      maxZ: 8,
    }, 0.016);
  }
  assert.ok(jTurn.speed > 5.0);
  jTurn = stepParkingPhysics(
    jTurn,
    { steerInput: 1, gasInput: 0.4, brakeInput: 0, handbrake: true, gear: 'D' },
    stats,
    { halfPlazaWidth: 12, minZ: -64, maxZ: 8 },
    0.016
  );
  assert.equal(jTurn.isDrifting, true, 'High-speed handbrake whip initiates J-turn drift');
  assert.ok(jTurn.driftFactor > 0.2);
});

test('stepParkingObstacles knocks cones, clears slalom gates, and pushes out of parked cars cleanly', () => {
  const stages = createParkingStages();
  const slalomStage = stages[3]; // Stage 4 has cones and 4 slalom gates
  const state = createInitialParkingState(slalomStage);

  // Place player hitting first cone
  state.x = slalomStage.cones[0].x;
  state.z = slalomStage.cones[0].z + 0.5;
  state.vx = 0;
  state.vz = -5.0;

  const coneHit = stepParkingObstacles(state, slalomStage, 0.016);
  assert.equal(coneHit.coneHitsDelta, 1);
  assert.equal(slalomStage.cones[0].knocked, true);

  // Clear gate 1
  state.x = slalomStage.slalomGates[0].x;
  state.z = slalomStage.slalomGates[0].z;
  const gateHit = stepParkingObstacles(state, slalomStage, 0.016);
  assert.equal(gateHit.newlyClearedGates, 1);
  assert.equal(slalomStage.slalomGates[0].passed, true);

  // Collide into parked car 0 -> gets pushed outside without clipping inside
  const parked = slalomStage.parkedCars[0];
  state.x = parked.x + 0.2;
  state.z = parked.z + 0.2;
  state.vx = -3.0;
  state.vz = 0;
  const carHit = stepParkingObstacles(state, slalomStage, 0.016);
  assert.equal(carHit.carBump, true);
  assert.ok(Math.hypot(state.x - parked.x, state.z - parked.z) > 0.4);
});

test('evaluateParkingProximity and evaluateParkingBayStatus detect clearances and readyToLock accurately', () => {
  const stage = createParkingStages()[2]; // Parallel park stage
  const state = createInitialParkingState(stage);

  // Far from bay initially
  const farStatus = evaluateParkingBayStatus(state, stage);
  assert.equal(farStatus.isInsideBox, false);
  assert.equal(farStatus.readyToLock, false);

  // Move squarely into target bay, aligned, and stopped
  state.x = stage.targetBay.x;
  state.z = stage.targetBay.z;
  state.heading = stage.targetBay.heading;
  state.vx = 0;
  state.vz = 0;
  state.speed = 0;

  const parkedStatus = evaluateParkingBayStatus(state, stage);
  assert.equal(parkedStatus.isInsideBox, true);
  assert.equal(parkedStatus.isAligned, true);
  assert.equal(parkedStatus.isStopped, true);
  assert.equal(parkedStatus.readyToLock, true);

  // Proximity sensors pick up nearby curb barrier / front/rear parallel cars (higher intensity = closer)
  const prox = evaluateParkingProximity(state, stage);
  assert.ok(prox.minClearanceM < 3.5);
  assert.ok(
    Math.max(prox.frontLeft, prox.frontRight, prox.rearLeft, prox.rearRight) > 0.2,
    'Ultrasonic sensors report nearby barrier/cars inside tight parallel spot'
  );
});

test('stepParkingObstacles uses rotated OBB extents to keep car outside barriers, parked cars, and plaza curbs', () => {
  const stage = createParkingStages().find((s) => s.barriers.length > 0)!;
  const state = createInitialParkingState(stage);

  // Drive nose-first diagonally into first barrier -> rotated OBB pushes back without ghosting
  const barrier = stage.barriers[0];
  state.x = barrier.x;
  state.z = barrier.z + barrier.halfL + 1.25; // Overlapping rotated corner (player halfL ~ 1.94)
  state.heading = -Math.PI / 2 + 0.35;
  state.vx = 1.5;
  state.vz = -4.0;
  const barRes = stepParkingObstacles(state, stage, 0.016);
  assert.equal(barRes.barrierHit, true);
  assert.ok(Math.hypot(state.x - barrier.x, state.z - barrier.z) > 1.5);

  // Diagonal heading near side plaza curb must keep rotated car corner inside halfPlaza
  const halfPlaza = stage.plazaWidth * 0.5;
  state.x = halfPlaza - 0.85; // Too close for rotated car center!
  state.z = stage.spawn.z;
  state.heading = -Math.PI / 2 + 0.65;
  state.vx = 3.0;
  state.vz = 0;
  const curbRes = stepParkingObstacles(state, stage, 0.016);
  assert.equal(curbRes.barrierHit, true);
  const lateralExtent =
    Math.abs(Math.cos(state.heading)) * 1.94 + Math.abs(Math.sin(state.heading)) * 0.90;
  assert.ok(
    Math.abs(state.x) + lateralExtent <= halfPlaza + 0.01,
    `Expected rotated car edge (${(Math.abs(state.x) + lateralExtent).toFixed(2)}) <= halfPlaza (${halfPlaza})`
  );
});
