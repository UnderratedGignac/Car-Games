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
  hitQuality: number;
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

export interface GuardrailImpactParams {
  playerSpeed: number;
  outwardLateralSpeed: number;
  overallIntegrity?: number;
}

export interface GuardrailImpactOutcome {
  shouldBreach: boolean;
  hitQuality: number;
  impactSpeed: number;
  scrubbedSpeedFactor: number;
  inwardBounceLatVel: number;
}

/**
 * Evaluates whether a guardrail hit is fast and direct enough to smash through and wreck the car,
 * or whether the rail should deflect the car safely back onto the road.
 */
export function evaluateGuardrailImpact({
  playerSpeed,
  outwardLateralSpeed,
  overallIntegrity = 100,
}: GuardrailImpactParams): GuardrailImpactOutcome {
  const safeOutward = Math.max(0, outwardLateralSpeed);
  const hitQuality = Math.max(0, Math.min(1, safeOutward / 8.5));
  const integrityFactor = overallIntegrity < 75 ? 0.8 : 1.0;

  // Guardrail breaks through when slammed at racing speed with decisive outward angle (or when chassis is weakened)
  const isHighSpeed = playerSpeed >= 17.5 * integrityFactor;
  const isWellHit = safeOutward >= 3.8 * integrityFactor;
  const weakenedBreach = overallIntegrity <= 65 && playerSpeed >= 11.0 && safeOutward >= 2.2;
  const shouldBreach = (isHighSpeed && isWellHit) || weakenedBreach;

  return {
    shouldBreach,
    hitQuality: Number(hitQuality.toFixed(3)),
    impactSpeed: Number((safeOutward * 1.8 + playerSpeed * 0.32).toFixed(2)),
    scrubbedSpeedFactor: shouldBreach ? 0.82 : safeOutward > 3.5 ? 0.84 : 0.92,
    inwardBounceLatVel: Math.max(3.5, safeOutward * 0.52 + 2.2),
  };
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

  // Only high-speed, solidly aligned ("well hit") impacts destroy the player's car.
  // Slow taps, moderate rear-ends, and glancing corner clips deflect cleanly without destroying the car.
  const isWellHit = overlapFraction >= 0.45;
  const isHighSpeedImpact = car.isOncoming
    ? playerSpeedForward >= 15.0 && relForward >= 24.0
    : playerSpeedForward >= 22.0 && relForward >= 14.5;
  const isFatalCrash = isWellHit && isHighSpeedImpact;

  const restitution = isFatalCrash ? 0.44 : 0.52;
  const invMassSum = 1 / playerMass + 1 / trafficMass;

  // Longitudinal momentum transfer impulse
  const jLong = ((1 + restitution) * relForward) / invMassSum;
  const playerDeltaForward = -(jLong / playerMass) * (isFatalCrash ? 0.88 : 0.30);
  const trafficDeltaForward = (jLong / trafficMass) * (isFatalCrash ? 0.95 : 0.55);

  // Off-center lateral & rotational lever torque
  const leverNorm = Math.max(0.18, Math.min(1.0, absDLat / 1.35));
  const lateralImpulseBase = Math.max(4.2, relForward * 0.38 + Math.abs(playerLateralVel) * 0.55);
  const playerBounceVx = sideBias * lateralImpulseBase * (trafficMass / (playerMass + trafficMass)) * 1.45;
  const trafficCrashVelLat = -sideBias * lateralImpulseBase * (playerMass / (playerMass + trafficMass)) * 1.65;

  const kineticNorm = Math.min(1.5, (relForward * (car.isOncoming ? 1.15 : 0.85)) / 22);
  const isLightTap = !isFatalCrash && relForward < 9.5 && playerSpeedForward < 20.0;
  const impactSeverity = isLightTap
    ? 0.08
    : !isFatalCrash
    ? Math.max(0.16, Math.min(0.38, kineticNorm * 0.38))
    : Math.max(0.85, Math.min(1.48, kineticNorm * (0.8 + trafficMass * 0.16)));

  const playerBounceVy = !isFatalCrash
    ? 1.2
    : Math.min(9.5, 3.8 + kineticNorm * (car.isOncoming ? 4.2 : 2.8));
  const trafficCrashVy = !isFatalCrash
    ? 1.0
    : Math.min(10.5, 3.2 + (playerMass / trafficMass) * kineticNorm * 4.4);

  const torqueSign = sideBias;
  const playerYawVel = torqueSign * (!isFatalCrash ? 1.6 : 3.2 + leverNorm * kineticNorm * 4.8);
  const playerRollVel = torqueSign * (!isFatalCrash ? 0.8 : 2.1 + kineticNorm * 2.5);

  const trafficYawVel = -torqueSign * (!isFatalCrash ? 2.2 : 4.2 + leverNorm * (playerMass / trafficMass) * 5.2);
  const trafficRollVel = -torqueSign * (!isFatalCrash ? 0.9 : 2.4 + (playerMass / trafficMass) * 2.2);

  return {
    isFatalCrash,
    hitQuality: Number(overlapFraction.toFixed(3)),
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

export interface Obb2D {
  x: number;
  z: number;
  heading: number;
  halfLength: number;
  halfWidth: number;
}

export interface ObbContact2D {
  hit: boolean;
  overlap: number;
  normalX: number;
  normalZ: number;
}

/**
 * Computes exact 2D Separating Axis Theorem (SAT) overlap between two oriented bounding boxes.
 * Normal always points from `b` toward `a` (direction to push `a` out of `b`).
 */
export function computeObbOverlap2D(
  a: Obb2D,
  b: Obb2D,
  out: ObbContact2D = { hit: false, overlap: 0, normalX: 0, normalZ: 0 }
): ObbContact2D {
  const axF = Math.cos(a.heading);
  const azF = Math.sin(a.heading);
  const axR = -azF;
  const azR = axF;

  const bxF = Math.cos(b.heading);
  const bzF = Math.sin(b.heading);
  const bxR = -bzF;
  const bzR = bxF;

  const dx = a.x - b.x;
  const dz = a.z - b.z;

  let minOverlap = Infinity;
  let bestNx = 0;
  let bestNz = 0;

  // Test the 4 SAT axes: aF, aR, bF, bR
  for (let axisIdx = 0; axisIdx < 4; axisIdx++) {
    const nx = axisIdx === 0 ? axF : axisIdx === 1 ? axR : axisIdx === 2 ? bxF : bxR;
    const nz = axisIdx === 0 ? azF : axisIdx === 1 ? azR : axisIdx === 2 ? bzF : bzR;

    const projA =
      a.halfLength * Math.abs(axF * nx + azF * nz) +
      a.halfWidth * Math.abs(axR * nx + azR * nz);
    const projB =
      b.halfLength * Math.abs(bxF * nx + bzF * nz) +
      b.halfWidth * Math.abs(bxR * nx + bzR * nz);

    const centerDist = dx * nx + dz * nz;
    const overlap = projA + projB - Math.abs(centerDist);
    if (overlap <= 0) {
      out.hit = false;
      out.overlap = 0;
      out.normalX = 0;
      out.normalZ = 0;
      return out;
    }

    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = centerDist >= 0 ? 1 : -1;
      bestNx = nx * sign;
      bestNz = nz * sign;
    }
  }

  out.hit = true;
  out.overlap = minOverlap;
  out.normalX = bestNx;
  out.normalZ = bestNz;
  return out;
}

export interface SolidGuardrailParams {
  vx: number;
  vz: number;
  heading: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  roadHeading: number;
  signedPerpOffset: number;
  maxCenterLat: number;
}

export interface SolidGuardrailOutcome {
  hit: boolean;
  railSide: -1 | 1;
  clampedLat: number;
  outwardSpeed: number;
  nextVx: number;
  nextVz: number;
  nextHeading: number;
}

/**
 * Resolves solid barrier/guardrail containment without ever allowing the car body
 * to phase through the rail. Reflects outward lateral velocity and bleeds tangential scrape speed.
 */
export function resolveSolidGuardrailContact(
  params: SolidGuardrailParams
): SolidGuardrailOutcome {
  const {
    vx,
    vz,
    heading,
    tx,
    tz,
    nx,
    nz,
    roadHeading,
    signedPerpOffset,
    maxCenterLat,
  } = params;

  const railSide: -1 | 1 = signedPerpOffset >= 0 ? 1 : -1;
  const safeMax = Math.max(0.8, maxCenterLat);
  if (Math.abs(signedPerpOffset) <= safeMax) {
    return {
      hit: false,
      railSide,
      clampedLat: signedPerpOffset,
      outwardSpeed: 0,
      nextVx: vx,
      nextVz: vz,
      nextHeading: heading,
    };
  }

  const clampedLat = railSide * safeMax;
  const vFwd = vx * tx + vz * tz;
  const vLat = vx * nx + vz * nz;
  const outwardSpeed = Math.max(0, vLat * railSide);

  // Realistic steel/concrete barrier friction & deflection:
  // Shallow scrape loses minimal speed; heavy angled slam bleeds up to ~35% speed and bounces inward.
  const impactRatio = Math.min(1, outwardSpeed / 14);
  const fwdKeepFactor = Math.max(0.62, 0.94 - impactRatio * 0.28);
  const nextFwd = Math.max(4.5, vFwd * fwdKeepFactor);
  const restitution = outwardSpeed > 4.0 ? 0.36 : 0.24;
  const inwardBounce = Math.max(1.2, outwardSpeed * restitution + 1.0);
  const nextLat = -railSide * inwardBounce;

  const nextVx = tx * nextFwd + nx * nextLat;
  const nextVz = tz * nextFwd + nz * nextLat;

  // Gently deflect heading back parallel to the barrier wall
  let diff = roadHeading - heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  let nextHeading = heading + diff * (0.35 + impactRatio * 0.25);
  while (nextHeading > Math.PI) nextHeading -= Math.PI * 2;
  while (nextHeading < -Math.PI) nextHeading += Math.PI * 2;

  return {
    hit: true,
    railSide,
    clampedLat,
    outwardSpeed: Number(outwardSpeed.toFixed(2)),
    nextVx,
    nextVz,
    nextHeading,
  };
}

export interface HighwaySolidContactOutcome {
  primaryCar: TrafficCarState | null;
  impactSpeed: number;
  hitQuality: number;
  sideBias: -1 | 1;
  nextPlayerS: number;
  nextPlayerLat: number;
  nextPlayerFwdVel: number;
  nextPlayerLatVel: number;
}

const obbScratchA: Obb2D = { x: 0, z: 0, heading: 0, halfLength: 1.9, halfWidth: 0.88 };
const obbScratchB: Obb2D = { x: 0, z: 0, heading: 0, halfLength: 1.9, halfWidth: 0.94 };
const obbContactScratch: ObbContact2D = { hit: false, overlap: 0, normalX: 0, normalZ: 0 };

/**
 * Solves solid 2D OBB-vs-OBB collisions in road (s, lat) frame between the player
 * and ALL nearby traffic vehicles (including crashed & cooldown cars), preventing any ghosting.
 */
export function resolveHighwayTrafficSolidPass(params: {
  playerS: number;
  playerLat: number;
  playerHeadingRelRoad: number;
  playerFwdVel: number;
  playerLatVel: number;
  playerHalfLength?: number;
  playerHalfWidth?: number;
  playerMass?: number;
  roadHalfWidth: number;
  trafficCars: TrafficCarState[];
}): HighwaySolidContactOutcome {
  const {
    playerHalfLength = 1.88,
    playerHalfWidth = 0.86,
    playerMass = 1.32,
    roadHalfWidth,
    trafficCars,
  } = params;

  let curS = params.playerS;
  let curLat = params.playerLat;
  let vFwd = params.playerFwdVel;
  let vLat = params.playerLatVel;

  let primaryCar: TrafficCarState | null = null;
  let maxImpactSpeed = 0;
  let maxHitQuality = 0;
  let bestSideBias: -1 | 1 = 1;

  // Road coordinates mapped to Obb2D: x -> lateralOffset, z -> s, heading=PI/2 -> forward along +s
  obbScratchA.halfLength = playerHalfLength;
  obbScratchA.halfWidth = playerHalfWidth;
  obbScratchA.heading = Math.PI * 0.5 + params.playerHeadingRelRoad;

  for (let iter = 0; iter < 3; iter++) {
    let anyThisIter = false;
    for (let i = 0; i < trafficCars.length; i++) {
      const car = trafficCars[i];
      if (Math.abs(car.s - curS) > 8.5) continue;

      obbScratchA.x = curLat;
      obbScratchA.z = curS;

      obbScratchB.x = car.lateralOffset;
      obbScratchB.z = car.s;
      obbScratchB.halfLength = car.halfLength;
      obbScratchB.halfWidth = car.halfWidth;
      obbScratchB.heading = car.crashed
        ? Math.PI * 0.5 + (car.crashYaw ?? 0)
        : Math.PI * 0.5 + (car.crashYaw ?? 0) * 0.5;

      const contact = computeObbOverlap2D(obbScratchA, obbScratchB, obbContactScratch);
      if (!contact.hit) continue;

      anyThisIter = true;
      const tMass = getTrafficVehicleMass(car.kind);
      const invP = 1 / playerMass;
      const invT = 1 / tMass;
      const invSum = invP + invT;

      // Separate both vehicles proportionally to inverse mass; clamp traffic inside rails
      const pushDist = contact.overlap + 0.02;
      const pShare = invP / invSum;
      const tShare = invT / invSum;

      // If traffic is pushed into guardrail, player absorbs remaining separation
      const prevCarLat = car.lateralOffset;
      const maxCarLat = Math.max(1.0, roadHalfWidth - car.halfWidth - 0.14);
      const rawCarLat = prevCarLat - contact.normalX * pushDist * tShare;
      const clampedCarLat = Math.max(-maxCarLat, Math.min(maxCarLat, rawCarLat));
      const clampedExcess = Math.abs(rawCarLat - clampedCarLat);

      car.lateralOffset = clampedCarLat;
      car.s -= contact.normalZ * pushDist * tShare;

      curS += contact.normalZ * pushDist * pShare;
      curLat += contact.normalX * (pushDist * pShare + clampedExcess);

      // Keep player inside rails too
      const maxPlayerLat = Math.max(1.0, roadHalfWidth - playerHalfWidth - 0.12);
      if (Math.abs(curLat) > maxPlayerLat) {
        const overflow = Math.abs(curLat) - maxPlayerLat;
        const pSign = curLat >= 0 ? 1 : -1;
        curLat = pSign * maxPlayerLat;
        // Push traffic car further away if pinched against rail
        car.lateralOffset = Math.max(
          -maxCarLat,
          Math.min(maxCarLat, car.lateralOffset - pSign * overflow * 0.9)
        );
      }

      // Compute relative closing velocity along contact normal
      const carVelS = car.crashed
        ? car.crashVs ?? 0
        : car.isOncoming
        ? -car.speed
        : car.speed;
      const carVelLat = car.crashed ? car.crashVelLat ?? 0 : 0;

      const relVx = vLat - carVelLat;
      const relVz = vFwd - carVelS;
      const vn = relVx * contact.normalX + relVz * contact.normalZ;

      if (vn < 0) {
        const closing = -vn;
        const restitution = 0.28;
        const j = (-(1 + restitution) * vn) / invSum;

        vLat += j * invP * contact.normalX;
        vFwd += j * invP * contact.normalZ;

        if (car.crashed) {
          car.crashVelLat = carVelLat - j * invT * contact.normalX;
          car.crashVs = carVelS - j * invT * contact.normalZ;
        } else {
          // Nudge non-crashed traffic car slightly off trajectory without destroying it
          const latKick = -j * invT * contact.normalX * 0.45;
          car.lateralOffset = Math.max(
            -maxCarLat,
            Math.min(maxCarLat, car.lateralOffset + latKick * 0.04)
          );
          if (Math.abs(contact.normalZ) > 0.5) {
            car.s -= (j * invT * contact.normalZ) * 0.04;
          }
        }

        const dLat = curLat - car.lateralOffset;
        const overlapFrac = Math.max(0, Math.min(1, 1 - Math.abs(dLat) / Math.max(0.8, car.halfWidth + playerHalfWidth)));
        if (closing > maxImpactSpeed || !primaryCar) {
          primaryCar = car;
          maxImpactSpeed = Math.max(maxImpactSpeed, closing);
          maxHitQuality = Math.max(maxHitQuality, overlapFrac);
          bestSideBias = dLat >= 0 ? 1 : -1;
        }
      } else if (!primaryCar) {
        const dLat = curLat - car.lateralOffset;
        const overlapFrac = Math.max(0, Math.min(1, 1 - Math.abs(dLat) / Math.max(0.8, car.halfWidth + playerHalfWidth)));
        primaryCar = car;
        maxHitQuality = overlapFrac;
        bestSideBias = dLat >= 0 ? 1 : -1;
      }
    }
    if (!anyThisIter) break;
  }

  return {
    primaryCar,
    impactSpeed: Number(maxImpactSpeed.toFixed(2)),
    hitQuality: Number(maxHitQuality.toFixed(3)),
    sideBias: bestSideBias,
    nextPlayerS: curS,
    nextPlayerLat: curLat,
    nextPlayerFwdVel: vFwd,
    nextPlayerLatVel: vLat,
  };
}

/**
 * Ensures nearby traffic vehicles maintain solid physical separation from each other
 * (so yielding, slowing, or crashed traffic cars never overlap or ghost through each other).
 */
export function resolveTrafficInterCarSpacing(
  trafficCars: TrafficCarState[],
  roadHalfWidth: number
): void {
  const n = trafficCars.length;
  for (let i = 0; i < n; i++) {
    const a = trafficCars[i];
    for (let j = i + 1; j < n; j++) {
      const b = trafficCars[j];
      const ds = a.s - b.s;
      const minSepS = a.halfLength + b.halfLength + 0.25;
      if (Math.abs(ds) >= minSepS) continue;

      const dLat = a.lateralOffset - b.lateralOffset;
      const minSepLat = a.halfWidth + b.halfWidth + 0.12;
      if (Math.abs(dLat) >= minSepLat) continue;

      const penS = minSepS - Math.abs(ds);
      const penLat = minSepLat - Math.abs(dLat);
      const sameLane = Math.abs(dLat) < (a.halfWidth + b.halfWidth) * 0.65;

      if (sameLane || penS < penLat) {
        const signS = ds >= 0 ? 1 : -1;
        const shift = penS * 0.5 + 0.02;
        a.s += signS * shift;
        b.s -= signS * shift;
        if (!a.crashed && !b.crashed && a.isOncoming === b.isOncoming) {
          // Match speed of leading same-direction vehicle smoothly on bumper touch
          if ((a.isOncoming && ds < 0) || (!a.isOncoming && ds > 0)) {
            b.speed = Math.min(b.speed, a.speed);
          } else {
            a.speed = Math.min(a.speed, b.speed);
          }
        }
      } else {
        const signLat = dLat >= 0 ? 1 : -1;
        const shift = penLat * 0.5 + 0.02;
        const maxA = Math.max(1.0, roadHalfWidth - a.halfWidth - 0.14);
        const maxB = Math.max(1.0, roadHalfWidth - b.halfWidth - 0.14);
        a.lateralOffset = Math.max(-maxA, Math.min(maxA, a.lateralOffset + signLat * shift));
        b.lateralOffset = Math.max(-maxB, Math.min(maxB, b.lateralOffset - signLat * shift));
      }
    }
  }
}
