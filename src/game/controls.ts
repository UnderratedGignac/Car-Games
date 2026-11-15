/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GameModeId } from './rules';

export interface WheelSteerInput {
  clientX: number;
  clientY: number;
  startX: number;
  startY: number;
  rect: { left: number; top: number; width: number; height: number };
  startAngleRad: number;
  startValue: number;
}

/**
 * Computes responsive non-linear steering from a horizontal swipe delta.
 * Eliminates tiny finger jitter inside deadzonePx while giving crisp full lock at maxThrowPx.
 */
export function computeSwipeSteerDelta(
  deltaX: number,
  maxThrowPx = 68,
  deadzonePx = 5
): number {
  const absDx = Math.abs(deltaX);
  if (absDx <= deadzonePx) return 0;
  const span = Math.max(12, maxThrowPx - deadzonePx);
  const linear = Math.min(1, (absDx - deadzonePx) / span);
  const curved = Math.pow(linear, 0.88);
  return Number((Math.sign(deltaX) * curved).toFixed(3));
}

/**
 * Clamps a swipe anchor so if a player drags far past full lock and immediately
 * reverses thumb direction, counter-steering starts right away without dead travel.
 */
export function clampSwipeAnchor(
  startX: number,
  curX: number,
  maxAnchorLagPx = 86
): number {
  const dx = curX - startX;
  if (Math.abs(dx) <= maxAnchorLagPx) return startX;
  return curX - Math.sign(dx) * maxAnchorLagPx;
}

/**
 * Computes smooth rotary/linear steering value [-1, +1] for the HUD SteeringWheel
 * without bottom-rim angle sign inversion.
 */
export function computeWheelSteer(input: WheelSteerInput): number {
  const { clientX, clientY, startX, rect, startAngleRad, startValue } = input;
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.5;
  const dxCenter = clientX - centerX;
  const dyCenter = clientY - centerY;
  const distFromCenter = Math.hypot(dxCenter, dyCenter);
  const maxRadius = Math.max(22, rect.width * 0.44);

  const dragDx = clientX - startX;
  const linearSteer = dragDx / (maxRadius * 0.95);
  const positionSteer = dxCenter / maxRadius;

  if (distFromCenter > rect.width * 0.2) {
    const curAngle = Math.atan2(dyCenter, dxCenter);
    let dAngle = curAngle - startAngleRad;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    const rotarySteer = startValue + dAngle / 1.3;

    // Only favor rotary delta when it doesn't fight clear horizontal drag
    const sameDirection =
      Math.abs(linearSteer) < 0.12 || Math.sign(rotarySteer) === Math.sign(linearSteer);
    const chosen = sameDirection
      ? Math.abs(rotarySteer) > Math.abs(linearSteer)
        ? rotarySteer
        : linearSteer
      : Math.abs(linearSteer) > 0.08
      ? startValue * 0.25 + linearSteer
      : positionSteer;

    const clamped = Math.max(-1, Math.min(1, chosen));
    return Math.abs(clamped) < 0.05 ? 0 : Number(clamped.toFixed(2));
  }

  const normalized = Math.max(-1, Math.min(1, dxCenter / maxRadius));
  if (Math.abs(normalized) < 0.07) return 0;
  return Number(normalized.toFixed(2));
}

/**
 * Combines steering sources with strict priority:
 * Keyboard > HUD SteeringWheel/Buttons > Background Canvas Touch/Swipe > Tap Impulse.
 */
export function resolveCombinedSteering(inputs: {
  keyLeft: boolean;
  keyRight: boolean;
  hudSteer: number;
  pointerSteer: number;
  tapImpulse: number;
}): number {
  const keySteer = (inputs.keyRight ? 1 : 0) - (inputs.keyLeft ? 1 : 0);
  if (keySteer !== 0) return keySteer;

  if (Math.abs(inputs.hudSteer) > 0.01) {
    return Math.max(-1, Math.min(1, inputs.hudSteer));
  }
  if (Math.abs(inputs.pointerSteer) > 0.01) {
    return Math.max(-1, Math.min(1, inputs.pointerSteer));
  }
  if (Math.abs(inputs.tapImpulse) > 0.01) {
    return Math.max(-1, Math.min(1, inputs.tapImpulse));
  }
  return 0;
}

/**
 * Resolves unified pedal, throttle, and handbrake signals across all 3 gameplay modes
 * from both keyboard and multi-touch cockpit pedals.
 */
export function resolveDrivingPedals(inputs: {
  mode: GameModeId;
  keyUp: boolean;
  keyDown: boolean;
  pedalGas: boolean;
  pedalBrake: boolean;
  keyHandbrake: boolean;
  pedalHandbrake: boolean;
}): {
  gasInput: number;
  brakeInput: number;
  throttle: number;
  handbrake: boolean;
} {
  const gasHeld = inputs.keyUp || inputs.pedalGas;
  const brakeHeld = inputs.keyDown || inputs.pedalBrake;
  const handbrake = inputs.keyHandbrake || inputs.pedalHandbrake;

  if (inputs.mode === 'parking') {
    return {
      gasInput: gasHeld ? 1 : 0,
      brakeInput: brakeHeld ? 1 : 0,
      throttle: gasHeld ? 1 : 0,
      handbrake,
    };
  }

  if (inputs.mode === 'highway_traffic') {
    const brakeInput = brakeHeld ? 1 : 0;
    const gasInput = brakeHeld ? 0 : gasHeld ? 1 : 0;
    return {
      gasInput,
      brakeInput,
      throttle: brakeHeld ? 0.45 : gasHeld ? 1.25 : 0.78,
      handbrake,
    };
  }

  if (inputs.mode === 'mountain_drive') {
    const brakeInput = brakeHeld ? 1 : 0;
    const gasInput = brakeHeld ? 0 : gasHeld ? 1 : 0;
    return {
      gasInput,
      brakeInput,
      throttle: brakeHeld ? 0.34 : gasHeld ? 1.32 : 0.88,
      handbrake,
    };
  }

  // Touge S-Curve Drift mode: effortless auto-cruise baseline + real Gas surge & Brake modulation
  const brakeInput = brakeHeld ? 1 : 0;
  const gasInput = brakeHeld ? 0 : gasHeld ? 1 : 0;
  const throttle = brakeHeld ? 0.56 : gasHeld ? 1.28 : 0.96;

  return {
    gasInput,
    brakeInput,
    throttle,
    handbrake,
  };
}
