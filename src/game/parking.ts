/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrafficVehicleKind, normalizeAngle } from './rules';
import { computeObbOverlap2D, type Obb2D, type ObbContact2D } from './crashPhysics';

export type ParkingGear = 'P' | 'R' | 'D';

export type ParkingManeuverType =
  | 'nose_in'
  | 'reverse_bay'
  | 'parallel'
  | 'slalom_reverse'
  | 'chicane_diagonal'
  | 'gymkhana_180'
  | 'underground_tight'
  | 'loading_dock'
  | 'three_point_turn'
  | 'offset_chicane_parallel'
  | 'double_slalom_bay'
  | 'valet_gauntlet';

export interface ParkingPhysicsState {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  heading: number; // radians; -PI/2 = straight ahead (-Z)
  speed: number; // signed longitudinal speed (m/s, <0 when reversing)
  steerAngle: number; // radians (-0.64 .. +0.64)
  gear: ParkingGear;
  handbrakeActive: boolean;
  wheelbase: number;
  isDrifting: boolean;
  driftFactor: number;
}

export interface ParkedObstacleCar {
  id: number;
  x: number;
  z: number;
  heading: number;
  kind: TrafficVehicleKind;
  color: string;
  halfWidth: number;
  halfLength: number;
}

export interface ParkingCone {
  id: number;
  x: number;
  z: number;
  knocked: boolean;
  vx: number;
  vz: number;
}

export interface ParkingBarrier {
  id: number;
  x: number;
  z: number;
  halfW: number;
  halfL: number;
  heading: number;
}

export interface SlalomGate {
  id: number;
  x: number;
  z: number;
  halfWidth: number;
  passed: boolean;
  label: string;
}

export interface ParkingTargetBay {
  x: number;
  z: number;
  heading: number;
  width: number;
  length: number;
  angleToleranceDeg: number;
  distToleranceM: number;
  allowEitherDirection: boolean;
  label: string;
}

export interface ParkingStageSpec {
  stageNumber: number;
  id: string;
  title: string;
  subtitle: string;
  instruction: string;
  maneuverType: ParkingManeuverType;
  plazaWidth: number;
  startZ: number;
  endZ: number;
  spawn: { x: number; z: number; heading: number; gear: ParkingGear };
  targetBay: ParkingTargetBay;
  parkedCars: ParkedObstacleCar[];
  cones: ParkingCone[];
  barriers: ParkingBarrier[];
  slalomGates: SlalomGate[];
}

export interface ParkingProximity {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
  minClearanceM: number;
}

export interface ParkingBayStatus {
  centerDistM: number;
  headingErrorDeg: number;
  isInsideBox: boolean;
  isAligned: boolean;
  isStopped: boolean;
  allGatesCleared: boolean;
  readyToLock: boolean;
}

export interface ParkingStepHitResult {
  coneHitsDelta: number;
  barrierHit: boolean;
  carBump: boolean;
  impactSpeed: number;
  newlyClearedGates: number;
}

export function createInitialParkingState(stage: ParkingStageSpec): ParkingPhysicsState {
  return {
    x: stage.spawn.x,
    z: stage.spawn.z,
    y: 0,
    vx: 0,
    vz: 0,
    heading: stage.spawn.heading,
    speed: 0,
    steerAngle: 0,
    gear: stage.spawn.gear,
    handbrakeActive: false,
    wheelbase: 2.65,
    isDrifting: false,
    driftFactor: 0,
  };
}

/**
 * Steps complex precision car physics:
 * - Smooth Ackermann wheel angle slew (-0.62..+0.62 rad)
 * - Natural reverse steering geometry (backing up swings tail opposite nose)
 * - Electronic gear selector ('P' locks transmission, 'D' drives forward, 'R' reverses)
 * - High-speed handbrake J-turn / drift-park slide vs low-speed emergency stop
 */
export function stepParkingPhysics(
  state: ParkingPhysicsState,
  inputs: {
    steerInput: number; // -1..+1
    gasInput: number; // 0..1
    brakeInput: number; // 0..1
    handbrake?: boolean;
    gear?: ParkingGear;
  },
  stats: {
    topSpeed: number;
    handlingRate: number;
  },
  stageBounds: {
    halfPlazaWidth: number;
    minZ: number;
    maxZ: number;
  },
  dt: number
): ParkingPhysicsState {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const steer = Math.max(-1, Math.min(1, inputs.steerInput));
  const gas = Math.max(0, Math.min(1, inputs.gasInput));
  const brake = Math.max(0, Math.min(1, inputs.brakeInput));
  const handbrake = Boolean(inputs.handbrake);
  const gear: ParkingGear = inputs.gear || state.gear;

  // Front-wheel Ackermann steer slew
  const maxWheelAngle = 0.60;
  const targetWheel = steer * maxWheelAngle;
  const steerSlew = 5.4 + stats.handlingRate * 0.6;
  const nextSteerAngle =
    state.steerAngle + (targetWheel - state.steerAngle) * Math.min(1, steerSlew * clampedDt);

  const fwdX = Math.cos(state.heading);
  const fwdZ = Math.sin(state.heading);
  const rightX = -fwdZ;
  const rightZ = fwdX;

  let vForward = state.vx * fwdX + state.vz * fwdZ;
  let vLateral = state.vx * rightX + state.vz * rightZ;

  const maxForwardSpeed = Math.min(18.5, Math.max(12.0, stats.topSpeed * 0.64));
  const maxReverseSpeed = 7.6;

  if (gear === 'P') {
    // Parking pawl locks wheels quickly
    vForward *= Math.exp(-16.0 * clampedDt);
    vLateral *= Math.exp(-16.0 * clampedDt);
    if (Math.abs(vForward) < 0.08) vForward = 0;
  } else if (handbrake && Math.abs(vForward) <= 4.2) {
    // Low-speed handbrake acts as crisp parking/stop brake
    vForward *= Math.exp(-11.0 * clampedDt);
    if (Math.abs(vForward) < 0.08) vForward = 0;
  } else {
    if (brake > 0.05) {
      const decel = 19.5 * brake;
      if (Math.abs(vForward) <= decel * clampedDt) {
        vForward = 0;
      } else {
        vForward -= Math.sign(vForward) * decel * clampedDt;
      }
    } else if (gas > 0.05) {
      if (gear === 'D') {
        const accel = 13.5 * gas;
        vForward = Math.min(maxForwardSpeed, vForward + accel * clampedDt);
      } else if (gear === 'R') {
        const revAccel = 9.5 * gas;
        vForward = Math.max(-maxReverseSpeed, vForward - revAccel * clampedDt);
      }
    } else {
      // Gentle rolling resistance & engine drag
      const drag = gear === 'D' && vForward < 0 ? 7.5 : gear === 'R' && vForward > 0 ? 7.5 : 2.3;
      vForward *= Math.exp(-drag * clampedDt);
      if (Math.abs(vForward) < 0.03) vForward = 0;
    }
  }

  // Handbrake J-turn / drift-park slide when moving fast (> 4.2 m/s)
  const isJTurnSlide = handbrake && Math.abs(vForward) > 4.2 && gear !== 'P';
  const lateralGrip = isJTurnSlide ? 2.1 : 13.8;
  vLateral *= Math.exp(-lateralGrip * clampedDt);

  // Bicycle Ackermann angular rate: naturally flips yaw sense in Reverse (vForward < 0)!
  const effectiveTurn =
    (vForward / Math.max(2.0, state.wheelbase)) * Math.tan(nextSteerAngle) * (isJTurnSlide ? 1.55 : 1.0);
  const nextHeading = normalizeAngle(state.heading + effectiveTurn * clampedDt);

  const nFwdX = Math.cos(nextHeading);
  const nFwdZ = Math.sin(nextHeading);
  const nRightX = -nFwdZ;
  const nRightZ = nFwdX;

  let nextVx = nFwdX * vForward + nRightX * vLateral;
  let nextVz = nFwdZ * vForward + nRightZ * vLateral;

  let nextX = state.x + nextVx * clampedDt;
  let nextZ = state.z + nextVz * clampedDt;

  // Clamp cleanly inside parking plaza walls
  const maxX = Math.max(3.5, stageBounds.halfPlazaWidth - 1.1);
  if (nextX > maxX) {
    nextX = maxX;
    if (nextVx > 0) nextVx = -nextVx * 0.25;
  } else if (nextX < -maxX) {
    nextX = -maxX;
    if (nextVx < 0) nextVx = -nextVx * 0.25;
  }

  if (nextZ < stageBounds.minZ + 1.4) {
    nextZ = stageBounds.minZ + 1.4;
    if (nextVz < 0) nextVz = -nextVz * 0.25;
  } else if (nextZ > stageBounds.maxZ - 1.4) {
    nextZ = stageBounds.maxZ - 1.4;
    if (nextVz > 0) nextVz = -nextVz * 0.25;
  }

  const speedMag = Math.hypot(nextVx, nextVz);
  let slipAngle = 0;
  if (speedMag > 1.2) {
    slipAngle = Math.abs(normalizeAngle(nextHeading - Math.atan2(nextVz, nextVx)));
    if (slipAngle > Math.PI * 0.5) slipAngle = Math.PI - slipAngle;
  }

  const isDrifting = isJTurnSlide || (speedMag > 4.5 && slipAngle > 0.22);
  const driftFactor = isDrifting ? Math.min(1, Math.max(0.25, slipAngle / 0.7)) : 0;

  return {
    x: nextX,
    z: nextZ,
    y: state.y,
    vx: nextVx,
    vz: nextVz,
    heading: nextHeading,
    speed: nextVx * nFwdX + nextVz * nFwdZ,
    steerAngle: nextSteerAngle,
    gear,
    handbrakeActive: handbrake,
    wheelbase: state.wheelbase,
    isDrifting,
    driftFactor,
  };
}

/**
 * Evaluates cone knocks, slalom gate clears, concrete barrier collisions, and parked car bumps.
 * Pushes player cleanly out of solid parked cars/barriers so car never teleports or glitches inside solids.
 */
export function stepParkingObstacles(
  state: ParkingPhysicsState,
  stage: ParkingStageSpec,
  dt: number
): ParkingStepHitResult {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  let coneHitsDelta = 0;
  let barrierHit = false;
  let carBump = false;
  let impactSpeed = 0;
  let newlyClearedGates = 0;

  const carRadius = 1.05;

  // 1. Interactive traffic cones (topple & scatter when clipped)
  for (let i = 0; i < stage.cones.length; i++) {
    const cone = stage.cones[i];
    if (cone.knocked) {
      cone.x += cone.vx * clampedDt;
      cone.z += cone.vz * clampedDt;
      cone.vx *= Math.exp(-3.4 * clampedDt);
      cone.vz *= Math.exp(-3.4 * clampedDt);
      continue;
    }
    const dx = cone.x - state.x;
    const dz = cone.z - state.z;
    const dist = Math.hypot(dx, dz);
    if (dist < carRadius + 0.34) {
      cone.knocked = true;
      coneHitsDelta++;
      const invD = dist > 0.001 ? 1 / dist : 1;
      const spd = Math.max(3.5, Math.hypot(state.vx, state.vz) * 1.45);
      cone.vx = dx * invD * spd + state.vx * 0.4;
      cone.vz = dz * invD * spd + state.vz * 0.4;
      impactSpeed = Math.max(impactSpeed, Math.hypot(state.vx, state.vz));
    }
  }

  // 2. Slalom gates (ordered clearance)
  for (let i = 0; i < stage.slalomGates.length; i++) {
    const gate = stage.slalomGates[i];
    if (gate.passed) continue;
    const dz = Math.abs(state.z - gate.z);
    const dx = Math.abs(state.x - gate.x);
    if (dz < 2.2 && dx <= gate.halfWidth + 0.6) {
      gate.passed = true;
      newlyClearedGates++;
    }
  }

  // 3. Solid 2D OBB-vs-OBB SAT solver (3 iterations) against parked cars, Jersey barriers, and perimeter curbs
  const playerHalfL = 1.94;
  const playerHalfW = 0.90;
  const halfPlaza = stage.plazaWidth * 0.5;
  const minPlazaZ = stage.endZ - 8;
  const maxPlazaZ = stage.startZ + 8;

  const playerObb: Obb2D = {
    x: state.x,
    z: state.z,
    heading: state.heading,
    halfLength: playerHalfL,
    halfWidth: playerHalfW,
  };
  const obstacleObb: Obb2D = { x: 0, z: 0, heading: 0, halfLength: 1, halfWidth: 1 };
  const contactOut: ObbContact2D = { hit: false, overlap: 0, normalX: 0, normalZ: 0 };

  const applySolidSurfaceImpulse = (nx: number, nz: number, restitution = 0.22) => {
    const vNorm = state.vx * nx + state.vz * nz;
    if (vNorm < 0) {
      const closing = -vNorm;
      // Preserve tangential sliding friction while bouncing normal component solidly
      const vTanX = state.vx - vNorm * nx;
      const vTanZ = state.vz - vNorm * nz;
      const tanFriction = 0.88;
      const rebound = closing > 1.2 ? closing * restitution : 0;
      state.vx = vTanX * tanFriction + nx * rebound;
      state.vz = vTanZ * tanFriction + nz * rebound;
      const fwdX = Math.cos(state.heading);
      const fwdZ = Math.sin(state.heading);
      state.speed = state.vx * fwdX + state.vz * fwdZ;
      return closing;
    }
    return 0;
  };

  for (let iter = 0; iter < 3; iter++) {
    let anyContact = false;

    // 3a. Parked obstacle cars (exact oriented car rectangles)
    for (let i = 0; i < stage.parkedCars.length; i++) {
      const oc = stage.parkedCars[i];
      playerObb.x = state.x;
      playerObb.z = state.z;
      obstacleObb.x = oc.x;
      obstacleObb.z = oc.z;
      obstacleObb.heading = oc.heading;
      obstacleObb.halfLength = oc.halfLength;
      obstacleObb.halfWidth = oc.halfWidth;

      const c = computeObbOverlap2D(playerObb, obstacleObb, contactOut);
      if (c.hit) {
        anyContact = true;
        state.x += c.normalX * (c.overlap + 0.015);
        state.z += c.normalZ * (c.overlap + 0.015);
        const curSpd = Math.hypot(state.vx, state.vz);
        const closing = applySolidSurfaceImpulse(c.normalX, c.normalZ, 0.24);
        if (Math.max(curSpd, closing) > 0.65) {
          carBump = true;
          impactSpeed = Math.max(impactSpeed, curSpd, closing);
        }
      }
    }

    // 3b. Concrete Jersey Barriers
    for (let i = 0; i < stage.barriers.length; i++) {
      const b = stage.barriers[i];
      playerObb.x = state.x;
      playerObb.z = state.z;
      obstacleObb.x = b.x;
      obstacleObb.z = b.z;
      obstacleObb.heading = b.heading;
      obstacleObb.halfLength = b.halfL;
      obstacleObb.halfWidth = b.halfW;

      const c = computeObbOverlap2D(playerObb, obstacleObb, contactOut);
      if (c.hit) {
        anyContact = true;
        state.x += c.normalX * (c.overlap + 0.015);
        state.z += c.normalZ * (c.overlap + 0.015);
        const curSpd = Math.hypot(state.vx, state.vz);
        const closing = applySolidSurfaceImpulse(c.normalX, c.normalZ, 0.22);
        if (Math.max(curSpd, closing) > 0.65) {
          barrierHit = true;
          impactSpeed = Math.max(impactSpeed, curSpd, closing);
        }
      }
    }

    // 3c. Solid parking deck perimeter curbs / end walls (accounting for rotated car bumper corners!)
    const cosH = Math.abs(Math.cos(state.heading));
    const sinH = Math.abs(Math.sin(state.heading));
    const extentX = cosH * playerHalfL + sinH * playerHalfW;
    const extentZ = sinH * playerHalfL + cosH * playerHalfW;

    const maxCenterX = Math.max(1.5, halfPlaza - extentX - 0.05);
    if (state.x > maxCenterX) {
      anyContact = true;
      state.x = maxCenterX;
      const closing = applySolidSurfaceImpulse(-1, 0, 0.2);
      if (closing > 0.85) {
        barrierHit = true;
        impactSpeed = Math.max(impactSpeed, closing);
      }
    } else if (state.x < -maxCenterX) {
      anyContact = true;
      state.x = -maxCenterX;
      const closing = applySolidSurfaceImpulse(1, 0, 0.2);
      if (closing > 0.85) {
        barrierHit = true;
        impactSpeed = Math.max(impactSpeed, closing);
      }
    }

    const minCenterZ = minPlazaZ + extentZ + 0.05;
    const maxCenterZ = maxPlazaZ - extentZ - 0.05;
    if (state.z < minCenterZ) {
      anyContact = true;
      state.z = minCenterZ;
      const closing = applySolidSurfaceImpulse(0, 1, 0.2);
      if (closing > 0.85) {
        barrierHit = true;
        impactSpeed = Math.max(impactSpeed, closing);
      }
    } else if (state.z > maxCenterZ) {
      anyContact = true;
      state.z = maxCenterZ;
      const closing = applySolidSurfaceImpulse(0, -1, 0.2);
      if (closing > 0.85) {
        barrierHit = true;
        impactSpeed = Math.max(impactSpeed, closing);
      }
    }

    if (!anyContact) break;
  }

  return {
    coneHitsDelta,
    barrierHit,
    carBump,
    impactSpeed,
    newlyClearedGates,
  };
}

/**
 * Computes ultrasonic proximity readings (0..1) for FL/FR/RL/RR bumper corners.
 */
export function evaluateParkingProximity(
  state: ParkingPhysicsState,
  stage: ParkingStageSpec
): ParkingProximity {
  const fwdX = Math.cos(state.heading);
  const fwdZ = Math.sin(state.heading);
  const rgtX = -fwdZ;
  const rgtZ = fwdX;

  const corners = [
    { key: 'frontLeft' as const, l: 1.8, r: -0.82 },
    { key: 'frontRight' as const, l: 1.8, r: 0.82 },
    { key: 'rearLeft' as const, l: -1.8, r: -0.82 },
    { key: 'rearRight' as const, l: -1.8, r: 0.82 },
  ];

  const out: ParkingProximity = {
    frontLeft: 0,
    frontRight: 0,
    rearLeft: 0,
    rearRight: 0,
    minClearanceM: 9.9,
  };

  const halfPlaza = stage.plazaWidth * 0.5;
  const minPlazaZ = stage.endZ - 8;
  const maxPlazaZ = stage.startZ + 8;
  const sensorRange = 3.2;

  for (let c = 0; c < corners.length; c++) {
    const corner = corners[c];
    const wx = state.x + fwdX * corner.l + rgtX * corner.r;
    const wz = state.z + fwdZ * corner.l + rgtZ * corner.r;

    let minDist = Math.min(
      Math.max(0, halfPlaza - wx),
      Math.max(0, wx + halfPlaza),
      Math.max(0, wz - minPlazaZ),
      Math.max(0, maxPlazaZ - wz)
    );

    for (let i = 0; i < stage.parkedCars.length; i++) {
      const oc = stage.parkedCars[i];
      const dx = wx - oc.x;
      const dz = wz - oc.z;
      const oFwdX = Math.cos(oc.heading);
      const oFwdZ = Math.sin(oc.heading);
      const oRgtX = -oFwdZ;
      const oRgtZ = oFwdX;
      const locLong = Math.abs(dx * oFwdX + dz * oFwdZ) - oc.halfLength;
      const locLat = Math.abs(dx * oRgtX + dz * oRgtZ) - oc.halfWidth;
      const dist = Math.hypot(Math.max(0, locLong), Math.max(0, locLat));
      if (dist < minDist) minDist = dist;
    }

    for (let i = 0; i < stage.barriers.length; i++) {
      const b = stage.barriers[i];
      const dx = wx - b.x;
      const dz = wz - b.z;
      const bFwdX = Math.cos(b.heading);
      const bFwdZ = Math.sin(b.heading);
      const bRgtX = -bFwdZ;
      const bRgtZ = bFwdX;
      const locLong = Math.abs(dx * bFwdX + dz * bFwdZ) - b.halfL;
      const locLat = Math.abs(dx * bRgtX + dz * bRgtZ) - b.halfW;
      const dist = Math.hypot(Math.max(0, locLong), Math.max(0, locLat));
      if (dist < minDist) minDist = dist;
    }

    if (minDist < out.minClearanceM) out.minClearanceM = Number(minDist.toFixed(2));
    const intensity = Math.max(0, Math.min(1, 1 - minDist / sensorRange));
    out[corner.key] = Number(intensity.toFixed(2));
  }

  return out;
}

/**
 * Evaluates whether the car sits accurately aligned and stopped inside the target parking bay.
 */
export function evaluateParkingBayStatus(
  state: ParkingPhysicsState,
  stage: ParkingStageSpec
): ParkingBayStatus {
  const bay = stage.targetBay;
  const dx = state.x - bay.x;
  const dz = state.z - bay.z;
  const centerDistM = Math.hypot(dx, dz);

  const bFwdX = Math.cos(bay.heading);
  const bFwdZ = Math.sin(bay.heading);
  const bRgtX = -bFwdZ;
  const bRgtZ = bFwdX;
  const localLong = Math.abs(dx * bFwdX + dz * bFwdZ);
  const localLat = Math.abs(dx * bRgtX + dz * bRgtZ);

  let angleDiffRad = Math.abs(normalizeAngle(state.heading - bay.heading));
  if (bay.allowEitherDirection) {
    const revDiff = Math.abs(normalizeAngle(state.heading - (bay.heading + Math.PI)));
    angleDiffRad = Math.min(angleDiffRad, revDiff);
  }
  const headingErrorDeg = (angleDiffRad * 180) / Math.PI;

  const isInsideBox =
    centerDistM <= bay.distToleranceM &&
    localLong <= bay.length * 0.5 - 0.55 &&
    localLat <= bay.width * 0.5 - 0.35;

  const isAligned = headingErrorDeg <= bay.angleToleranceDeg;
  const speedMag = Math.hypot(state.vx, state.vz);
  const isStopped = state.gear === 'P' ? speedMag < 0.9 : speedMag < 0.48;
  const allGatesCleared = stage.slalomGates.every((g) => g.passed);

  return {
    centerDistM: Number(centerDistM.toFixed(2)),
    headingErrorDeg: Number(headingErrorDeg.toFixed(1)),
    isInsideBox,
    isAligned,
    isStopped,
    allGatesCleared,
    readyToLock: isInsideBox && isAligned && isStopped && allGatesCleared,
  };
}

const BASE_STAGES: ParkingStageSpec[] = [
  {
    stageNumber: 1,
    id: 'tokyo_nose_in',
    title: 'Tokyo Bay #01',
    subtitle: 'Forward Pull-In',
    instruction: 'Drive into the glowing bay between parked cars and stop straight.',
    maneuverType: 'nose_in',
    plazaWidth: 24,
    startZ: 8,
    endZ: -38,
    spawn: { x: -2.6, z: 0, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: 3.4,
      z: -21,
      heading: -Math.PI / 2,
      width: 3.4,
      length: 5.2,
      angleToleranceDeg: 14,
      distToleranceM: 1.15,
      allowEitherDirection: false,
      label: 'PULL IN',
    },
    parkedCars: [
      { id: 101, x: -0.2, z: -21, heading: -Math.PI / 2, kind: 'sedan', color: '#64748b', halfWidth: 0.94, halfLength: 1.95 },
      { id: 102, x: 7.0, z: -21, heading: -Math.PI / 2, kind: 'hatch', color: '#0ea5e9', halfWidth: 0.88, halfLength: 1.65 },
      { id: 103, x: -6.8, z: -15, heading: -Math.PI / 2, kind: 'van', color: '#e2e8f0', halfWidth: 1.0, halfLength: 2.15 },
    ],
    cones: [
      { id: 1, x: 1.6, z: -16.5, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 5.2, z: -16.5, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: 1.6, z: -24.5, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: 5.2, z: -24.5, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [],
    slalomGates: [],
  },
  {
    stageNumber: 2,
    id: 'reverse_bay_02',
    title: 'Back-In Bay #02',
    subtitle: 'Reverse Gear Precision',
    instruction: 'Pull past the right stall, shift to [R] Reverse, and back cleanly in facing the aisle.',
    maneuverType: 'reverse_bay',
    plazaWidth: 24,
    startZ: 8,
    endZ: -40,
    spawn: { x: -2.0, z: 0, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: 6.4,
      z: -20,
      heading: Math.PI, // Facing left toward the center aisle!
      width: 3.4,
      length: 5.2,
      angleToleranceDeg: 14,
      distToleranceM: 1.1,
      allowEitherDirection: false,
      label: 'REVERSE IN',
    },
    parkedCars: [
      { id: 201, x: 6.4, z: -15.6, heading: Math.PI, kind: 'sports', color: '#dc2626', halfWidth: 0.96, halfLength: 1.95 },
      { id: 202, x: 6.4, z: -24.4, heading: Math.PI, kind: 'sedan', color: '#2563eb', halfWidth: 0.94, halfLength: 1.95 },
      { id: 203, x: -7.5, z: -18, heading: 0, kind: 'box_truck', color: '#f59e0b', halfWidth: 1.06, halfLength: 2.55 },
    ],
    cones: [
      { id: 1, x: 3.4, z: -18.0, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 3.4, z: -22.0, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: -4.2, z: -28.0, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: 0.5, z: -30.5, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [],
    slalomGates: [],
  },
  {
    stageNumber: 3,
    id: 'shibuya_parallel_03',
    title: 'Shibuya Curb #03',
    subtitle: 'Tight Parallel Park',
    instruction: 'Swing beside the front van, shift [R], and parallel-park neatly between bumpers.',
    maneuverType: 'parallel',
    plazaWidth: 24,
    startZ: 8,
    endZ: -42,
    spawn: { x: 1.8, z: 0, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: 7.4,
      z: -19,
      heading: -Math.PI / 2,
      width: 3.1,
      length: 5.8,
      angleToleranceDeg: 12,
      distToleranceM: 0.95,
      allowEitherDirection: false,
      label: 'PARALLEL',
    },
    parkedCars: [
      { id: 301, x: 7.4, z: -26.2, heading: -Math.PI / 2, kind: 'van', color: '#0284c7', halfWidth: 1.0, halfLength: 2.15 },
      { id: 302, x: 7.4, z: -11.8, heading: -Math.PI / 2, kind: 'sports', color: '#eab308', halfWidth: 0.96, halfLength: 1.95 },
      { id: 303, x: -6.2, z: -20.0, heading: -Math.PI / 2, kind: 'sedan', color: '#334155', halfWidth: 0.94, halfLength: 1.95 },
    ],
    cones: [
      { id: 1, x: 4.8, z: -14.8, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 4.8, z: -23.2, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: -1.8, z: -16.0, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: -1.8, z: -24.0, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [
      { id: 1, x: 9.8, z: -19.0, halfW: 0.45, halfL: 9.0, heading: -Math.PI / 2 },
    ],
    slalomGates: [],
  },
  {
    stageNumber: 4,
    id: 'slalom_reverse_04',
    title: 'Cone Slalom #04',
    subtitle: 'Weave Gates + Reverse Stall',
    instruction: 'Clear all 4 slalom gates cleanly, then reverse-park into the left VIP bay!',
    maneuverType: 'slalom_reverse',
    plazaWidth: 24,
    startZ: 8,
    endZ: -58,
    spawn: { x: 0, z: 2, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: -6.4,
      z: -42,
      heading: 0, // Nose facing right (+X) toward center aisle
      width: 3.4,
      length: 5.2,
      angleToleranceDeg: 15,
      distToleranceM: 1.15,
      allowEitherDirection: false,
      label: 'VIP REVERSE',
    },
    parkedCars: [
      { id: 401, x: -6.4, z: -37.5, heading: 0, kind: 'hatch', color: '#ec4899', halfWidth: 0.88, halfLength: 1.65 },
      { id: 402, x: -6.4, z: -46.5, heading: 0, kind: 'sedan', color: '#16a34a', halfWidth: 0.94, halfLength: 1.95 },
    ],
    cones: [
      { id: 1, x: 0.0, z: -7.5, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 0.0, z: -15.5, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: 0.0, z: -23.5, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: 0.0, z: -31.5, knocked: false, vx: 0, vz: 0 },
      { id: 5, x: -3.4, z: -40.0, knocked: false, vx: 0, vz: 0 },
      { id: 6, x: -3.4, z: -44.0, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [],
    slalomGates: [
      { id: 1, x: -3.3, z: -7.5, halfWidth: 2.3, passed: false, label: 'GATE 1' },
      { id: 2, x: 3.3, z: -15.5, halfWidth: 2.3, passed: false, label: 'GATE 2' },
      { id: 3, x: -3.3, z: -23.5, halfWidth: 2.3, passed: false, label: 'GATE 3' },
      { id: 4, x: 3.3, z: -31.5, halfWidth: 2.3, passed: false, label: 'GATE 4' },
    ],
  },
  {
    stageNumber: 5,
    id: 'chicane_diagonal_05',
    title: 'Jersey Chicane #05',
    subtitle: 'Barrier Maze + 45° Diagonal',
    instruction: 'Thread the concrete barrier chicane and align smoothly into the 45° diagonal bay.',
    maneuverType: 'chicane_diagonal',
    plazaWidth: 24,
    startZ: 8,
    endZ: -56,
    spawn: { x: -4.5, z: 2, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: 4.8,
      z: -41,
      heading: -Math.PI * 0.25, // Angled 45° NE
      width: 3.4,
      length: 5.4,
      angleToleranceDeg: 14,
      distToleranceM: 1.15,
      allowEitherDirection: false,
      label: '45° STALL',
    },
    parkedCars: [
      { id: 501, x: 1.2, z: -43.8, heading: -Math.PI * 0.25, kind: 'sports', color: '#8b5cf6', halfWidth: 0.96, halfLength: 1.95 },
      { id: 502, x: 8.2, z: -38.2, heading: -Math.PI * 0.25, kind: 'van', color: '#f97316', halfWidth: 1.0, halfLength: 2.15 },
    ],
    cones: [
      { id: 1, x: -0.5, z: -14, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 2.8, z: -26, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [
      { id: 1, x: 2.5, z: -11, halfW: 0.55, halfL: 4.2, heading: 0 },
      { id: 2, x: -2.8, z: -22, halfW: 0.55, halfL: 4.4, heading: 0 },
      { id: 3, x: -5.5, z: -35, halfW: 0.55, halfL: 3.6, heading: Math.PI / 2 },
    ],
    slalomGates: [],
  },
  {
    stageNumber: 6,
    id: 'gymkhana_180_06',
    title: 'Gymkhana 180° #06',
    subtitle: 'Handbrake Pivot Finale',
    instruction: 'Charge down the runway, whip a Handbrake [Space] 180° around the apex, and lock facing back!',
    maneuverType: 'gymkhana_180',
    plazaWidth: 24,
    startZ: 8,
    endZ: -64,
    spawn: { x: 0, z: 3, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: 0.0,
      z: -48,
      heading: Math.PI / 2, // Facing straight back toward start (+Z) after 180° whip!
      width: 3.7,
      length: 5.5,
      angleToleranceDeg: 16,
      distToleranceM: 1.2,
      allowEitherDirection: false,
      label: '180° VIP BOX',
    },
    parkedCars: [
      { id: 601, x: -4.2, z: -48, heading: Math.PI / 2, kind: 'sports', color: '#14b8a6', halfWidth: 0.96, halfLength: 1.95 },
      { id: 602, x: 4.2, z: -48, heading: Math.PI / 2, kind: 'sports', color: '#f43f5e', halfWidth: 0.96, halfLength: 1.95 },
    ],
    cones: [
      { id: 1, x: -4.8, z: -28, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 4.8, z: -28, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: -6.5, z: -36, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: 6.5, z: -36, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [
      { id: 1, x: 0, z: -35, halfW: 0.7, halfL: 0.7, heading: 0 }, // Center donut pylon
    ],
    slalomGates: [
      { id: 1, x: 0, z: -20, halfWidth: 4.0, passed: false, label: 'RUNWAY ENTRY' },
    ],
  },
  {
    stageNumber: 7,
    id: 'underground_tight_07',
    title: 'Deck B2 Pillars #07',
    subtitle: 'Pillared Underground Back-In',
    instruction: 'Thread past concrete support barriers and reverse [R] smoothly into the tight B2 bay.',
    maneuverType: 'underground_tight',
    plazaWidth: 22,
    startZ: 8,
    endZ: -44,
    spawn: { x: 2.2, z: 1, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: -6.2,
      z: -26,
      heading: 0, // Facing right (+X) toward aisle
      width: 3.25,
      length: 5.2,
      angleToleranceDeg: 13,
      distToleranceM: 1.0,
      allowEitherDirection: false,
      label: 'B2 REVERSE',
    },
    parkedCars: [
      { id: 701, x: -6.2, z: -21.6, heading: 0, kind: 'van', color: '#475569', halfWidth: 1.0, halfLength: 2.15 },
      { id: 702, x: -6.2, z: -30.4, heading: 0, kind: 'sedan', color: '#38bdf8', halfWidth: 0.94, halfLength: 1.95 },
      { id: 703, x: 6.4, z: -20, heading: Math.PI, kind: 'hatch', color: '#fb7185', halfWidth: 0.88, halfLength: 1.65 },
    ],
    cones: [
      { id: 1, x: -3.2, z: -24.1, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: -3.2, z: -27.9, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [
      { id: 1, x: 1.8, z: -14, halfW: 0.65, halfL: 0.65, heading: 0 },
      { id: 2, x: 1.8, z: -33, halfW: 0.65, halfL: 0.65, heading: 0 },
    ],
    slalomGates: [],
  },
  {
    stageNumber: 8,
    id: 'loading_dock_08',
    title: 'Cargo Dock #08',
    subtitle: 'Heavy Freight Alley Reverse',
    instruction: 'Clear the lane cones, pull ahead, then reverse [R] straight between twin box trucks!',
    maneuverType: 'loading_dock',
    plazaWidth: 24,
    startZ: 8,
    endZ: -52,
    spawn: { x: -3.2, z: 2, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: 0.0,
      z: -38,
      heading: Math.PI / 2, // Facing back out (+Z) so you back straight into the dock
      width: 3.3,
      length: 5.5,
      angleToleranceDeg: 12,
      distToleranceM: 1.05,
      allowEitherDirection: false,
      label: 'DOCK BACK-IN',
    },
    parkedCars: [
      { id: 801, x: -4.1, z: -38, heading: Math.PI / 2, kind: 'box_truck', color: '#f59e0b', halfWidth: 1.08, halfLength: 2.6 },
      { id: 802, x: 4.1, z: -38, heading: Math.PI / 2, kind: 'box_truck', color: '#cbd5e1', halfWidth: 1.08, halfLength: 2.6 },
    ],
    cones: [
      { id: 1, x: -2.0, z: -29, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 2.0, z: -29, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: -2.0, z: -15, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: 4.5, z: -15, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [
      { id: 1, x: 0.0, z: -43.2, halfW: 5.5, halfL: 0.55, heading: 0 },
    ],
    slalomGates: [
      { id: 1, x: 1.2, z: -15, halfWidth: 2.6, passed: false, label: 'DOCK APPROACH' },
    ],
  },
  {
    stageNumber: 9,
    id: 'three_point_turn_09',
    title: 'Alley K-Turn #09',
    subtitle: 'Tight 3-Point Return',
    instruction: 'Enter the dead-end court, execute a clean D/R 3-point turnaround, and park facing out!',
    maneuverType: 'three_point_turn',
    plazaWidth: 20,
    startZ: 8,
    endZ: -44,
    spawn: { x: 4.2, z: 1, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: -5.4,
      z: -12,
      heading: Math.PI / 2, // Facing back out (+Z)
      width: 3.3,
      length: 5.3,
      angleToleranceDeg: 14,
      distToleranceM: 1.1,
      allowEitherDirection: false,
      label: 'K-TURN BAY',
    },
    parkedCars: [
      { id: 901, x: -5.4, z: -18.8, heading: Math.PI / 2, kind: 'sedan', color: '#0ea5e9', halfWidth: 0.94, halfLength: 1.95 },
      { id: 902, x: -5.4, z: -5.2, heading: Math.PI / 2, kind: 'hatch', color: '#ec4899', halfWidth: 0.88, halfLength: 1.65 },
      { id: 903, x: 5.6, z: -28, heading: -Math.PI / 2, kind: 'van', color: '#94a3b8', halfWidth: 1.0, halfLength: 2.15 },
    ],
    cones: [
      { id: 1, x: 0.0, z: -23, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: -3.0, z: -34, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: 3.0, z: -34, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [
      { id: 1, x: 0.0, z: -39.5, halfW: 9.0, halfL: 0.5, heading: 0 },
    ],
    slalomGates: [
      { id: 1, x: 3.8, z: -20, halfWidth: 2.8, passed: false, label: 'TURN COURT' },
    ],
  },
  {
    stageNumber: 10,
    id: 'harbor_parallel_10',
    title: 'Harbor Curb #10',
    subtitle: 'Left-Side Chicane Parallel',
    instruction: 'Sweep past the promenade cones, shift [R], and parallel-park on the left seawall curb.',
    maneuverType: 'offset_chicane_parallel',
    plazaWidth: 24,
    startZ: 8,
    endZ: -52,
    spawn: { x: 3.0, z: 2, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: -7.4,
      z: -32,
      heading: -Math.PI / 2,
      width: 3.1,
      length: 5.7,
      angleToleranceDeg: 12,
      distToleranceM: 0.95,
      allowEitherDirection: false,
      label: 'SEAWALL CURB',
    },
    parkedCars: [
      { id: 1001, x: -7.4, z: -39.1, heading: -Math.PI / 2, kind: 'sports', color: '#22d3ee', halfWidth: 0.96, halfLength: 1.95 },
      { id: 1002, x: -7.4, z: -24.9, heading: -Math.PI / 2, kind: 'van', color: '#f97316', halfWidth: 1.0, halfLength: 2.15 },
      { id: 1003, x: 6.0, z: -28, heading: -Math.PI / 2, kind: 'sedan', color: '#64748b', halfWidth: 0.94, halfLength: 1.95 },
    ],
    cones: [
      { id: 1, x: -1.5, z: -13, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 2.5, z: -21, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: -4.6, z: -28, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: -4.6, z: -36, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [
      { id: 1, x: -9.8, z: -32, halfW: 0.45, halfL: 9.5, heading: -Math.PI / 2 },
    ],
    slalomGates: [],
  },
  {
    stageNumber: 11,
    id: 'double_slalom_11',
    title: 'Pro S-Slalom #11',
    subtitle: '5-Gate Weave + NW 45° Bay',
    instruction: 'Snake smoothly through all 5 alternating slalom gates without clipping cones, then slot NW!',
    maneuverType: 'double_slalom_bay',
    plazaWidth: 24,
    startZ: 8,
    endZ: -66,
    spawn: { x: 0, z: 3, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: -5.2,
      z: -51,
      heading: -Math.PI * 0.75, // Angled 45° NW
      width: 3.35,
      length: 5.4,
      angleToleranceDeg: 13,
      distToleranceM: 1.1,
      allowEitherDirection: false,
      label: '45° NW BAY',
    },
    parkedCars: [
      { id: 1101, x: -1.6, z: -53.8, heading: -Math.PI * 0.75, kind: 'sports', color: '#a855f7', halfWidth: 0.96, halfLength: 1.95 },
      { id: 1102, x: -8.6, z: -48.2, heading: -Math.PI * 0.75, kind: 'hatch', color: '#10b981', halfWidth: 0.88, halfLength: 1.65 },
    ],
    cones: [
      { id: 1, x: 0.0, z: -7.5, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 0.0, z: -15.5, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: 0.0, z: -23.5, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: 0.0, z: -31.5, knocked: false, vx: 0, vz: 0 },
      { id: 5, x: 0.0, z: -39.5, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [],
    slalomGates: [
      { id: 1, x: 3.4, z: -7.5, halfWidth: 2.3, passed: false, label: 'GATE 1' },
      { id: 2, x: -3.4, z: -15.5, halfWidth: 2.3, passed: false, label: 'GATE 2' },
      { id: 3, x: 3.4, z: -23.5, halfWidth: 2.3, passed: false, label: 'GATE 3' },
      { id: 4, x: -3.4, z: -31.5, halfWidth: 2.3, passed: false, label: 'GATE 4' },
      { id: 5, x: 3.4, z: -39.5, halfWidth: 2.3, passed: false, label: 'GATE 5' },
    ],
  },
  {
    stageNumber: 12,
    id: 'valet_gauntlet_12',
    title: 'Master Gauntlet #12',
    subtitle: 'Chicane + Handbrake 180° Box',
    instruction: 'Clear both slalom gates, thread the chicane, whip a 180° J-turn, and lock the Pro VIP Box!',
    maneuverType: 'valet_gauntlet',
    plazaWidth: 24,
    startZ: 8,
    endZ: -68,
    spawn: { x: 0, z: 3, heading: -Math.PI / 2, gear: 'D' },
    targetBay: {
      x: 0.0,
      z: -53,
      heading: Math.PI / 2, // Reverse-facing after 180° pivot
      width: 3.45,
      length: 5.4,
      angleToleranceDeg: 13,
      distToleranceM: 1.05,
      allowEitherDirection: false,
      label: 'MASTER VIP',
    },
    parkedCars: [
      { id: 1201, x: -4.0, z: -53, heading: Math.PI / 2, kind: 'sports', color: '#f43f5e', halfWidth: 0.96, halfLength: 1.95 },
      { id: 1202, x: 4.0, z: -53, heading: Math.PI / 2, kind: 'sports', color: '#06b6d4', halfWidth: 0.96, halfLength: 1.95 },
    ],
    cones: [
      { id: 1, x: -5.2, z: -31, knocked: false, vx: 0, vz: 0 },
      { id: 2, x: 5.2, z: -31, knocked: false, vx: 0, vz: 0 },
      { id: 3, x: -2.4, z: -47, knocked: false, vx: 0, vz: 0 },
      { id: 4, x: 2.4, z: -47, knocked: false, vx: 0, vz: 0 },
    ],
    barriers: [
      { id: 1, x: 3.4, z: -13, halfW: 0.55, halfL: 3.4, heading: 0 },
      { id: 2, x: -3.4, z: -24, halfW: 0.55, halfL: 3.4, heading: 0 },
      { id: 3, x: 0.0, z: -39, halfW: 0.7, halfL: 0.7, heading: 0 },
    ],
    slalomGates: [
      { id: 1, x: -3.2, z: -13, halfWidth: 2.5, passed: false, label: 'CHICANE 1' },
      { id: 2, x: 3.2, z: -24, halfWidth: 2.5, passed: false, label: 'CHICANE 2' },
    ],
  },
];

export function createParkingStages(): ParkingStageSpec[] {
  return BASE_STAGES.map((st) => ({
    ...st,
    spawn: { ...st.spawn },
    targetBay: { ...st.targetBay },
    parkedCars: st.parkedCars.map((c) => ({ ...c })),
    cones: st.cones.map((c) => ({ ...c })),
    barriers: st.barriers.map((b) => ({ ...b })),
    slalomGates: st.slalomGates.map((g) => ({ ...g })),
  }));
}
