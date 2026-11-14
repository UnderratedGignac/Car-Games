/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSwipeAnchor,
  computeSwipeSteerDelta,
  computeWheelSteer,
  resolveCombinedSteering,
  resolveDrivingPedals,
} from './controls';

test('Swipe steering eliminates jitter deadzone and scales smoothly to full lock', () => {
  assert.equal(computeSwipeSteerDelta(0), 0);
  assert.equal(computeSwipeSteerDelta(4), 0);
  assert.equal(computeSwipeSteerDelta(-5), 0);

  const gentleRight = computeSwipeSteerDelta(20);
  assert.ok(gentleRight > 0.15 && gentleRight < 0.5, `Expected gentle right steer, got ${gentleRight}`);

  assert.equal(computeSwipeSteerDelta(80), 1);
  assert.equal(computeSwipeSteerDelta(-80), -1);
});

test('Swipe anchor clamps lag cleanly for fast counter-steering reversals', () => {
  // Drag within lag keeps anchor unchanged
  assert.equal(clampSwipeAnchor(100, 150, 86), 100);
  // Dragging far right pulls anchor forward so reversing left responds immediately
  assert.equal(clampSwipeAnchor(100, 260, 86), 174);
  assert.equal(clampSwipeAnchor(200, 50, 86), 136);
});

test('Steering wheel prevents bottom-rim horizontal sign inversion', () => {
  const rect = { left: 100, top: 400, width: 80, height: 80 }; // center at (140, 440)
  // User touches bottom rim (140, 472 -> angle +PI/2) and drags RIGHT (startX 140 -> clientX 170)
  // At 6 o'clock, dragging right decreases atan2 angle, which previously fought linear drag!
  const steer = computeWheelSteer({
    clientX: 170,
    clientY: 470,
    startX: 140,
    startY: 472,
    rect,
    startAngleRad: Math.PI / 2,
    startValue: 0,
  });
  assert.ok(steer > 0.35, `Dragging bottom rim right must steer right (> 0.35), got ${steer}`);
});

test('Combined steering gives HUD SteeringWheel/buttons priority over stale canvas pointer steer', () => {
  // HUD wheel holds -0.45 while background pointer tries +1
  assert.equal(
    resolveCombinedSteering({
      keyLeft: false,
      keyRight: false,
      hudSteer: -0.45,
      pointerSteer: 1,
      tapImpulse: 0,
    }),
    -0.45
  );

  // Keyboard overrides both HUD and pointer steer
  assert.equal(
    resolveCombinedSteering({
      keyLeft: false,
      keyRight: true,
      hudSteer: -0.8,
      pointerSteer: -1,
      tapImpulse: -1,
    }),
    1
  );

  // When both left & right keys are held, cancels to 0 and falls back cleanly
  assert.equal(
    resolveCombinedSteering({
      keyLeft: true,
      keyRight: true,
      hudSteer: 0.6,
      pointerSteer: 0,
      tapImpulse: 0,
    }),
    0.6
  );
});

test('Driving pedals wire Gas, Brake, and touch Handbrake consistently across all modes', () => {
  // Drift mode: Gas surges, Coast cruises at 0.96, Brake slows, touch handbrake passes through
  const driftCoast = resolveDrivingPedals({
    mode: 'drift',
    keyUp: false,
    keyDown: false,
    pedalGas: false,
    pedalBrake: false,
    keyHandbrake: false,
    pedalHandbrake: true,
  });
  assert.equal(driftCoast.throttle, 0.96);
  assert.equal(driftCoast.gasInput, 0);
  assert.equal(driftCoast.handbrake, true);

  const driftGas = resolveDrivingPedals({
    mode: 'drift',
    keyUp: false,
    keyDown: false,
    pedalGas: true,
    pedalBrake: false,
    keyHandbrake: false,
    pedalHandbrake: false,
  });
  assert.equal(driftGas.throttle, 1.28);
  assert.equal(driftGas.gasInput, 1);

  // Highway mode: Coasting sets gasInput=0 (cruise 78% speed), Gas pedal sets gasInput=1 (accelerate!)
  const hwyCoast = resolveDrivingPedals({
    mode: 'highway_traffic',
    keyUp: false,
    keyDown: false,
    pedalGas: false,
    pedalBrake: false,
    keyHandbrake: false,
    pedalHandbrake: false,
  });
  assert.equal(hwyCoast.gasInput, 0);
  assert.equal(hwyCoast.brakeInput, 0);

  const hwyGas = resolveDrivingPedals({
    mode: 'highway_traffic',
    keyUp: false,
    keyDown: false,
    pedalGas: true,
    pedalBrake: false,
    keyHandbrake: false,
    pedalHandbrake: false,
  });
  assert.equal(hwyGas.gasInput, 1);

  // Parking mode: Strict manual gas/brake/handbrake
  const parkIdle = resolveDrivingPedals({
    mode: 'parking',
    keyUp: false,
    keyDown: false,
    pedalGas: false,
    pedalBrake: false,
    keyHandbrake: false,
    pedalHandbrake: false,
  });
  assert.equal(parkIdle.gasInput, 0);
  assert.equal(parkIdle.brakeInput, 0);
  assert.equal(parkIdle.handbrake, false);
});
