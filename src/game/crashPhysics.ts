/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrafficCarState, TrafficVehicleKind } from './rules';

export interface CrashBody3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  yawVel: number;
  roll: number;
  rollVel: number;
  pitch: number;
  pitchVel: number;
  bounceCount: number;
  airborne: boolean;
}

export interface CrashStepOutcome {
  impactedGround: boolean;
  impactSpeed: number;
  justSettled: boolean;
}

export interface TrafficImpulseParams {
  playerSpeedForward: number;
  playerLateralVel: number;
  playerLateralOffset: number;
  playerMass?: number;
  car: TrafficCarState;
}

export interface TrafficImpulseOutcome {
  isFatalCrash: boolean;
  impactSeverity: number;
  closingSpeed: number;
  sideBias: -1 | 1;
  playerBounceVz: number;
  playerBounceVx: number;
  playerBounceVy: number;
  playerYawVel: number;
  playerRollVel: number;
  trafficCrashSpeedS: number;
  trafficCrashVelLat: number;
  trafficCrashVy: number;
  trafficYawVel: number;
  trafficRollVel: number;
}

const VEHICLE_MASS_BY_KIND: Record<TrafficVehicleKind, number> = {
  hatch: 1.05,
  sports: 1.25,
  sedan: 1.38,
  van: 1.95,
  box_truck: 3.4,
};

export function getTrafficVehicleMass(kind: TrafficVehicleKind): number {
  return VEHICLE_MASS_BY_KIND[kind] ?? 1.35;
}

export function createCrashBody3D(init?: Partial<CrashBody3D>): CrashBody3D {
  return {
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    z: init?.z ?? 0,
    vx: init?.vx ?? 0,
    vy: init?.vy ?? 0,
    vz: init?.vz ?? 0,
    yaw: init?.yaw ?? 0,
    yawVel: init?.yawVel ?? 0,
    roll: init?.roll ?? 0,
    rollVel: init?.rollVel ?? 0,
    pitch: init?.pitch ?? 0,
    pitchVel: init?.pitchVel ?? 0,
    bounceCount: init?.bounceCount ?? 0,
    airborne: init?.airborne ?? false,
  };
}

/**
 * Computes rigid-body 2-vehicle collision impulse with mass ratios, restitution,
 * off-center lever torque (yaw/roll spin), and glancing sideswipe vs fatal crash threshold.
 */
export function resolveTrafficCollisionImpulse(
  params: TrafficImpulseParams
): TrafficImpulseOutcome {
  const {
    playerSpeedForward,
    playerLateralVel,
    playerLateralOffset,
    playerMass = 1.32,
    car,
  } = params;

  const trafficMass = getTrafficVehicleMass(car.kind);
  const trafficSignedForward = car.isOncoming ? -car.speed : car.speed;
  const relForward = Math.max(2.5, playerSpeedForward - trafficSignedForward);

  const dLat = playerLateralOffset - car.lateralOffset;
  const absDLat = Math.abs(dLat);
  const sideBias: -1 | 1 = dLat >= 0 ? 1 : -1;
  const overlapFraction = Math.max(0, 1 - absDLat / Math.max(0.8, car.halfWidth + 0.9));

  // Head-on or heavy center-line hits are fatal; light oblique sideswipes on same-lane traffic deflect & scrape
  const isGlancingSideswipe =
    !car.isOncoming && overlapFraction < 0.42 && relForward < 13.5 && absDLat > 0.92;

  const restitution = isGlancingSideswipe ? 0.52 : 0.44;
  const invMassSum = 1 / playerMass + 1 / trafficMass;

  // Longitudinal momentum transfer impulse
  const jLong = ((1 + restitution) * relForward) / invMassSum;
  const playerDeltaForward = -(jLong / playerMass) * (isGlancingSideswipe ? 0.34 : 0.88);
  const trafficDeltaForward = (jLong / trafficMass) * (isGlancingSideswipe ? 0.55 : 0.95);

  // Off-center lateral & rotational lever torque
  const leverNorm = Math.max(0.18, Math.min(1.0, absDLat / 1.35));
  const lateralImpulseBase = Math.max(4.5, relForward * 0.42 + Math.abs(playerLateralVel) * 0.55);
  const playerBounceVx = sideBias * lateralImpulseBase * (trafficMass / (playerMass + trafficMass)) * 1.45;
  const trafficCrashVelLat = -sideBias * lateralImpulseBase * (playerMass / (playerMass + trafficMass)) * 1.65;

  const kineticNorm = Math.min(1.5, (relForward * (car.isOncoming ? 1.15 : 0.85)) / 22);
  const impactSeverity = isGlancingSideswipe
    ? Math.max(0.22, Math.min(0.48, kineticNorm * 0.45))
    : Math.max(0.68, Math.min(1.48, kineticNorm * (0.75 + trafficMass * 0.16)));

  const playerBounceVy = isGlancingSideswipe
    ? 1.4
    : Math.min(9.5, 3.8 + kineticNorm * (car.isOncoming ? 4.2 : 2.8));
  const trafficCrashVy = isGlancingSideswipe
    ? 1.2
    : Math.min(10.5, 3.2 + (playerMass / trafficMass) * kineticNorm * 4.4);

  const torqueSign = sideBias;
  const playerYawVel = torqueSign * (isGlancingSideswipe ? 1.8 : 3.2 + leverNorm * kineticNorm * 4.8);
  const playerRollVel = torqueSign * (isGlancingSideswipe ? 0.9 : 2.1 + kineticNorm * 2.5);

  const trafficYawVel = -torqueSign * (isGlancingSideswipe ? 2.4 : 4.2 + leverNorm * (playerMass / trafficMass) * 5.2);
  const trafficRollVel = -torqueSign * (isGlancingSideswipe ? 1.0 : 2.4 + (playerMass / trafficMass) * 2.2);

  return {
    isFatalCrash: !isGlancingSideswipe,
    impactSeverity: Number(impactSeverity.toFixed(3)),
    closingSpeed: Number(relForward.toFixed(2)),
    sideBias,
    playerBounceVz: Number((playerSpeedForward + playerDeltaForward).toFixed(2)),
    playerBounceVx: Number(playerBounceVx.toFixed(2)),
    playerBounceVy: Number(playerBounceVy.toFixed(2)),
    playerYawVel: Number(playerYawVel.toFixed(2)),
    playerRollVel: Number(playerRollVel.toFixed(2)),
    trafficCrashSpeedS: Number((trafficSignedForward + trafficDeltaForward).toFixed(2)),
    trafficCrashVelLat: Number(trafficCrashVelLat.toFixed(2)),
    trafficCrashVy: Number(trafficCrashVy.toFixed(2)),
    trafficYawVel: Number(trafficYawVel.toFixed(2)),
    trafficRollVel: Number(trafficRollVel.toFixed(2)),
  };
}

/**
 * Steps a 3D crashing car body with gravity, sloped terrain bounce restitution,
 * coupled yaw/roll angular tumble, and ground skid friction.
 */
export function stepCrashBody3D(
  body: CrashBody3D,
  groundY: number,
  groundSlopeX: number,
  dt: number,
  gravity = 29.0
): CrashStepOutcome {
  const stepDt = Math.min(Math.max(dt, 0), 0.05);
  if (stepDt <= 0) {
    return { impactedGround: false, impactSpeed: 0, justSettled: false };
  }

  body.vy -= gravity * stepDt;
  body.x += body.vx * stepDt;
  body.y += body.vy * stepDt;
  body.z += body.vz * stepDt;

  body.yaw += body.yawVel * stepDt;
  body.roll += body.rollVel * stepDt;
  body.pitch += body.pitchVel * stepDt;

  if (body.y > groundY + 0.08) {
    body.airborne = true;
    // Slight air drag on spin & velocity
    const airDrag = Math.exp(-0.28 * stepDt);
    body.vx *= airDrag;
    body.vz *= airDrag;
    body.rollVel *= Math.exp(-0.35 * stepDt);
    return { impactedGround: false, impactSpeed: 0, justSettled: false };
  }

  const downSpeed = Math.max(0, -body.vy);
  body.y = groundY;

  if (downSpeed > 2.2) {
    body.bounceCount += 1;
    const restitution = body.bounceCount === 1 ? 0.34 : 0.24;
    body.vy = downSpeed * restitution;

    // Terrain slope kicks lateral sliding velocity & induces roll bounce torque
    body.vx = body.vx * 0.62 - groundSlopeX * downSpeed * 0.45;
    body.vz *= 0.66;
    body.yawVel = body.yawVel * 0.68 + (body.vx >= 0 ? 1 : -1) * Math.min(2.5, downSpeed * 0.14);
    body.rollVel = -body.roll * 4.5 + (body.vx >= 0 ? 1 : -1) * 1.4;
    body.pitchVel = -body.pitch * 3.8;
    body.airborne = true;

    return {
      impactedGround: true,
      impactSpeed: Number(downSpeed.toFixed(2)),
      justSettled: false,
    };
  }

  // Sliding/skidding along ground with exponential tire/chassis friction & spring suspension settle
  const wasAirborne = body.airborne;
  body.vy = 0;
  body.airborne = false;

  const skidDrag = Math.exp(-3.6 * stepDt);
  body.vx *= skidDrag;
  body.vz *= skidDrag;
  body.yawVel *= Math.exp(-4.8 * stepDt);
  body.rollVel = (body.rollVel - body.roll * 18.0 * stepDt) * Math.exp(-6.5 * stepDt);
  body.pitchVel = (body.pitchVel - body.pitch * 18.0 * stepDt) * Math.exp(-6.5 * stepDt);

  return {
    impactedGround: false,
    impactSpeed: 0,
    justSettled: wasAirborne && Math.hypot(body.vx, body.vz) < 4.5,
  };
}

/**
 * Steps a knocked/crashed traffic vehicle along highway S & lateral coordinates with
 * vertical hop bounce, skid drag, yaw spin, and guardrail wall rebound!
 */
export function stepTrafficCrashBody(
  car: TrafficCarState,
  roadHalfWidth: number,
  dt: number
): { hitRail: boolean; bouncedGround: boolean } {
  if (!car.crashed) {
    return { hitRail: false, bouncedGround: false };
  }
  const stepDt = Math.min(Math.max(dt, 0), 0.05);
  if (stepDt <= 0) return { hitRail: false, bouncedGround: false };

  let hitRail = false;
  let bouncedGround = false;

  const vs = car.crashVs ?? 0;
  const vLat = car.crashVelLat ?? 0;
  let vy = (car.crashVy ?? 0) - 27.0 * stepDt;
  let cy = (car.crashY ?? 0) + vy * stepDt;

  car.s += vs * stepDt;
  car.lateralOffset += vLat * stepDt;
  car.crashYaw = (car.crashYaw ?? 0) + (car.crashYawVel ?? 0) * stepDt;
  car.crashRoll = (car.crashRoll ?? 0) + (car.crashRollVel ?? 0) * stepDt;

  if (cy <= 0) {
    if (vy < -2.0) {
      vy = Math.abs(vy) * 0.34;
      bouncedGround = true;
      car.crashVs = vs * 0.72;
      car.crashVelLat = vLat * 0.68;
      car.crashYawVel = (car.crashYawVel ?? 0) * 0.72;
    } else {
      vy = 0;
      const drag = Math.exp(-3.1 * stepDt);
      car.crashVs = vs * drag;
      car.crashVelLat = vLat * drag;
      car.crashYawVel = (car.crashYawVel ?? 0) * Math.exp(-3.8 * stepDt);
      car.crashRoll = (car.crashRoll ?? 0) * Math.exp(-5.0 * stepDt);
    }
    cy = 0;
  }

  car.crashVy = vy;
  car.crashY = cy;

  const maxLat = Math.max(1.2, roadHalfWidth - car.halfWidth - 0.15);
  if (Math.abs(car.lateralOffset) > maxLat) {
    const sign = car.lateralOffset >= 0 ? 1 : -1;
    car.lateralOffset = sign * maxLat;
    car.crashVelLat = -(car.crashVelLat ?? 0) * 0.56;
    car.crashYawVel = (car.crashYawVel ?? 0) * -0.65;
    hitRail = true;
  }

  return { hitRail, bouncedGround };
}
