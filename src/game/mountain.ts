/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SCurvePoint, normalizeAngle } from './rules';

export const MOUNTAIN_GRAVITY = 25.5;
export const MOUNTAIN_CYCLE_SLICES = 40;
export const MOUNTAIN_STEP_DEFAULT = 3.4;

export interface MountainPhysicsState {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  heading: number;
  angularVelocity: number;
  isDrifting: boolean;
  driftFactor: number;
  isAirborne: boolean;
  airTimeSec: number;
  wasOnRamp: boolean;
  lastRampPitchRad: number;
  jumpsCleared: number;
  bestAirTimeSec: number;
  currentPeakNum: number;
  currentSlopePct: number;
  launchStartX: number;
  launchStartZ: number;
}

export interface MountainSurfaceSample {
  onRoadCorridor: boolean;
  inChasmGap: boolean;
  isRamp: boolean;
  roadY: number;
  roadSlope: number; // dy / ds
  rampPitchRad: number;
  referenceGroundY: number;
  terrainY: number;
  signedPerpOffset: number;
  halfWidth: number;
  closestPoint: SCurvePoint | null;
  peakNum: number;
  gapWidthSlices: number;
}

export interface MountainStepResult {
  state: MountainPhysicsState;
  justLaunched: boolean;
  justLanded: boolean;
  landedAirTimeSec: number;
  jumpDistanceM: number;
  landingImpactSpeed: number;
  bermBounce?: boolean;
  impactSpeed?: number;
  fellReason: 'Fell Off Mountain Cliff' | 'Missed Mountain Jump' | 'Fell Into Mountain Chasm' | null;
}

function getCycleLaunchLipY(peakNum: number, seed: number): number {
  const altWave = Math.sin(peakNum * 1.15 + seed * 0.13) * 4.2 + Math.cos(peakNum * 0.55) * 1.8;
  return 6.4 + altWave;
}

function getCycleGapSlices(peakNum: number): number {
  // Alternating exciting 5-slice (17m) and 6-slice (20.4m) chasms
  return peakNum % 3 === 0 ? 6 : 5;
}

/**
 * Computes deterministic elevation, ramp, and chasm gap properties for Mountain Drive slice index.
 */
function resolveMountainSliceShape(
  idx: number,
  seed: number
): {
  y: number;
  width: number;
  isMountainRamp: boolean;
  isChasmGap: boolean;
  rampSlope: number;
  mountainPeakNum: number;
  hasJumpChevron: boolean;
  hasBoostPad: boolean;
} {
  // Opening launchpad (0..10): flat start -> steady opening hill climb onto Peak 1
  if (idx <= 4) {
    return {
      y: 0,
      width: 10.2,
      isMountainRamp: false,
      isChasmGap: false,
      rampSlope: 0,
      mountainPeakNum: 1,
      hasJumpChevron: false,
      hasBoostPad: false,
    };
  }
  if (idx <= 10) {
    const t = (idx - 4) / 6;
    const smoothT = t * t * (3 - 2 * t);
    return {
      y: Number((smoothT * 4.2).toFixed(2)),
      width: 9.8,
      isMountainRamp: false,
      isChasmGap: false,
      rampSlope: 0,
      mountainPeakNum: 1,
      hasJumpChevron: false,
      hasBoostPad: idx === 9,
    };
  }

  const k = idx - 11;
  const peakNum = Math.floor(k / MOUNTAIN_CYCLE_SLICES) + 1;
  const c = k % MOUNTAIN_CYCLE_SLICES;
  const gapLen = getCycleGapSlices(peakNum);
  const gapEnd = 34 + gapLen - 1; // 38 for 5-slice gap, 39 for 6-slice gap

  const prevLipY = peakNum === 1 ? 4.2 : getCycleLaunchLipY(peakNum - 1, seed);
  const startRimY = peakNum === 1 ? 4.2 : prevLipY - 2.3;
  const targetLipY = getCycleLaunchLipY(peakNum, seed);
  const rampBaseY = targetLipY - 5.2;

  // 1. Landing zone downslope (c = 0..8)
  if (c <= 8) {
    const t = c / 8;
    const drop = t * 6.4;
    return {
      y: Number((startRimY - drop).toFixed(2)),
      width: c <= 5 ? 12.2 : 11.4,
      isMountainRamp: false,
      isChasmGap: false,
      rampSlope: 0,
      mountainPeakNum: peakNum,
      hasJumpChevron: c <= 3,
      hasBoostPad: false,
    };
  }

  // 2. Heavy roller-coaster mountain slopes (c = 9..28): dramatic climbs and drops!
  const saddleBaseY = startRimY - 6.4;
  if (c <= 28) {
    const ridgeT = (c - 9) / 19; // 0..1
    const baseSpline = saddleBaseY + (rampBaseY - saddleBaseY) * ridgeT;
    // Smooth sine envelope guarantees exact C0 continuity at c=8->9 and c=28->29
    const env = Math.sin(ridgeT * Math.PI);
    const rollerWave =
      env * (Math.sin(ridgeT * Math.PI * 2.0 + peakNum * 0.9 + seed * 0.05) * 4.3 + 2.8);
    const yVal = baseSpline + rollerWave;
    return {
      y: Number(yVal.toFixed(2)),
      width: Number((10.4 + Math.sin(c * 0.25) * 0.7).toFixed(2)),
      isMountainRamp: false,
      isChasmGap: false,
      rampSlope: 0,
      mountainPeakNum: peakNum,
      hasJumpChevron: false,
      hasBoostPad: c === 27,
    };
  }

  // 3. Upward Launch Ramp (c = 29..33)
  if (c <= 33) {
    const rt = (c - 28) / 5; // 0.2 .. 1.0
    const rampY = rampBaseY + rt * 5.2;
    const slopeVal = 0.34 + rt * 0.05;
    return {
      y: Number(rampY.toFixed(2)),
      width: 9.2,
      isMountainRamp: true,
      isChasmGap: false,
      rampSlope: Number(slopeVal.toFixed(3)),
      mountainPeakNum: peakNum,
      hasJumpChevron: true,
      hasBoostPad: c === 31,
    };
  }

  // 4. Open Mountain Chasm Gap (c = 34..gapEnd)
  if (c <= gapEnd) {
    const gt = (c - 33) / (gapLen + 1);
    const nextRimY = targetLipY - 2.3;
    const chordY = targetLipY + (nextRimY - targetLipY) * gt;
    // Floating aerial coin arc across the gap!
    const arcLift = Math.sin(gt * Math.PI) * 3.8;
    return {
      y: Number((chordY + arcLift).toFixed(2)),
      width: 9.6,
      isMountainRamp: false,
      isChasmGap: true,
      rampSlope: 0,
      mountainPeakNum: peakNum,
      hasJumpChevron: false,
      hasBoostPad: false,
    };
  }

  // 5. Opposite Mountain Landing Rim (c = 39 when 5-slice gap)
  const nextRimY = targetLipY - 2.3;
  return {
    y: Number(nextRimY.toFixed(2)),
    width: 10.4,
    isMountainRamp: false,
    isChasmGap: false,
    rampSlope: 0,
    mountainPeakNum: peakNum + 1,
    hasJumpChevron: true,
    hasBoostPad: false,
  };
}

function buildMountainPointsFrom(
  startIndex: number,
  startX: number,
  startZ: number,
  count: number,
  stepDistance: number,
  seed: number,
  curveMultiplier = 1
): SCurvePoint[] {
  const points: SCurvePoint[] = [];
  let curX = startX;
  let curZ = startZ;

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const shape = resolveMountainSliceShape(idx, seed);

    let angleOffset = 0;
    let curvature = 0;

    if (idx >= 11) {
      const k = idx - 11;
      const c = k % MOUNTAIN_CYCLE_SLICES;
      // Smoothly straighten heading across approach -> ramp -> chasm -> landing runway
      // so both normal and full-Nitro jumps line up cleanly with the next mountain!
      const rampStraightBlend =
        c >= 26 || c <= 10
          ? 0
          : c <= 14
          ? (c - 10) / 4
          : c >= 22
          ? 1 - (c - 22) / 4
          : 1;

      const t = (idx - 11) * 0.105;
      const w1 = Math.sin(t * 0.82 + seed * 0.19) * 0.56 * curveMultiplier;
      const w2 = Math.sin(t * 0.34 + seed * 0.67) * 0.24 * curveMultiplier;
      angleOffset = Math.max(-0.84, Math.min(0.84, (w1 + w2) * rampStraightBlend));

      const dt = 0.105;
      const w1p = Math.cos(t * 0.82 + seed * 0.19) * 0.56 * curveMultiplier * 0.82 * dt;
      const w2p = Math.cos(t * 0.34 + seed * 0.67) * 0.24 * curveMultiplier * 0.34 * dt;
      curvature = (w1p + w2p) * rampStraightBlend;
    }

    const heading = -Math.PI / 2 + angleOffset;
    const tx = Math.cos(heading);
    const tz = Math.sin(heading);
    const nx = -tz;
    const nz = tx;

    const hasBoostPad = shape.hasBoostPad;
    const hasNitroCanister = !shape.isChasmGap && !hasBoostPad && idx >= 26 && idx % 64 === 0;
    const hasNitroGem =
      (shape.isChasmGap && idx % 2 === 1) ||
      (!shape.isChasmGap && !hasBoostPad && !hasNitroCanister && idx >= 14 && idx % 16 === 0);
    const hasCoin =
      shape.isChasmGap
        ? !hasNitroGem
        : idx >= 6 && idx % 3 === 0 && !hasNitroGem && !hasNitroCanister;

    const coinOffset = shape.isChasmGap ? 0 : Math.sin(idx * 0.65) * (shape.width * 0.22);
    const coinX = curX + nx * coinOffset;
    const coinZ = curZ + nz * coinOffset;
    const canisterOffset = Math.sin(idx * 0.45) * (shape.width * 0.2);
    const canisterX = curX + nx * canisterOffset;
    const canisterZ = curZ + nz * canisterOffset;

    points.push({
      index: idx,
      x: curX,
      y: shape.y,
      z: curZ,
      heading,
      tx,
      tz,
      nx,
      nz,
      width: shape.width,
      bankAngle: Number((-curvature * 1.8).toFixed(3)),
      curvature,
      hasCoin,
      coinX,
      coinZ,
      coinCollected: false,
      hasNitroGem,
      gemCollected: false,
      hasNitroCanister,
      canisterX,
      canisterZ,
      canisterCollected: false,
      hasBoostPad,
      boostX: curX,
      boostZ: curZ,
      boostTriggered: false,
      isMountainRamp: shape.isMountainRamp,
      isChasmGap: shape.isChasmGap,
      rampSlope: shape.rampSlope,
      mountainPeakNum: shape.mountainPeakNum,
      hasJumpChevron: shape.hasJumpChevron,
    });

    curX += tx * stepDistance;
    curZ += tz * stepDistance;
  }

  return points;
}

export function generateMountainTrack(
  sampleCount: number,
  stepDistance = MOUNTAIN_STEP_DEFAULT,
  seed = 42,
  curveMultiplier = 1
): SCurvePoint[] {
  return buildMountainPointsFrom(0, 0, 0, sampleCount, stepDistance, seed, curveMultiplier);
}

export function extendMountainTrack(
  existingTrack: SCurvePoint[],
  count: number,
  stepDistance = MOUNTAIN_STEP_DEFAULT,
  seed = 42,
  curveMultiplier = 1
): SCurvePoint[] {
  if (existingTrack.length === 0) {
    return generateMountainTrack(count, stepDistance, seed, curveMultiplier);
  }
  const last = existingTrack[existingTrack.length - 1];
  const nextX = last.x + last.tx * stepDistance;
  const nextZ = last.z + last.tz * stepDistance;
  return buildMountainPointsFrom(last.index + 1, nextX, nextZ, count, stepDistance, seed, curveMultiplier);
}

/**
 * Dramatic sculpted alpine mountainside and deep rocky chasm canyon floor.
 */
export function sampleMountainTerrainElevation(
  lateralDist: number,
  worldZ: number,
  roadY: number,
  isChasmGap = false
): number {
  const absLat = Math.abs(lateralDist);
  const canyonDrop = isChasmGap ? 22.0 : 0;

  if (isChasmGap) {
    const rockyFloor = roadY - canyonDrop + Math.sin(worldZ * 0.14 + lateralDist * 0.18) * 1.8;
    const cliffWalls = absLat > 14 ? Math.min(18, (absLat - 14) * 0.48) : 0;
    return rockyFloor + cliffWalls;
  }

  // Directly under the drivable mountain dirt crest -> flush rocky earth crown tapering cleanly into slopes!
  if (absLat <= 5.8) {
    return roadY - 0.14 - Math.max(0, absLat - 4.8) * 0.72;
  }

  const cliffDropT = Math.min(1, (absLat - 5.8) / 14.0);
  const farPeakT = Math.max(0, Math.min(1, (absLat - 19.8) / 48.0));
  const cragWave =
    Math.sin(worldZ * 0.062 + lateralDist * 0.12) * 2.4 +
    Math.cos(worldZ * 0.031 - lateralDist * 0.08) * 1.9;

  // Steep drop off mountain side, then jagged alpine neighbor peaks further out
  const cliffAbyss = roadY - 0.86 - cliffDropT * 15.2;
  const distantMountains = farPeakT * 24.5 + Math.abs(cragWave) * (0.4 + farPeakT * 1.6);
  return cliffAbyss + distantMountains;
}

export function createInitialMountainState(
  x = 0,
  z = 0,
  y = 0,
  heading = -Math.PI / 2,
  initialSpeed = 16
): MountainPhysicsState {
  return {
    x,
    z,
    y,
    vx: Math.cos(heading) * initialSpeed,
    vz: Math.sin(heading) * initialSpeed,
    vy: 0,
    heading,
    angularVelocity: 0,
    isDrifting: false,
    driftFactor: 0,
    isAirborne: false,
    airTimeSec: 0,
    wasOnRamp: false,
    lastRampPitchRad: 0,
    jumpsCleared: 0,
    bestAirTimeSec: 0,
    currentPeakNum: 1,
    currentSlopePct: 0,
    launchStartX: x,
    launchStartZ: z,
  };
}

/**
 * Samples interpolated road elevation, forward grade (dy/ds), ramp flags, and chasm bounds.
 */
export function sampleMountainSurface(
  carX: number,
  carZ: number,
  track: SCurvePoint[],
  stepDistance = MOUNTAIN_STEP_DEFAULT,
  allowanceBonus = 0
): MountainSurfaceSample {
  if (track.length === 0) {
    return {
      onRoadCorridor: false,
      inChasmGap: false,
      isRamp: false,
      roadY: 0,
      roadSlope: 0,
      rampPitchRad: 0,
      referenceGroundY: 0,
      terrainY: -12,
      signedPerpOffset: 0,
      halfWidth: 4.5,
      closestPoint: null,
      peakNum: 1,
      gapWidthSlices: 0,
    };
  }

  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < track.length; i++) {
    const pt = track[i];
    if (Math.abs(carZ - pt.z) > 22) continue;
    const dx = carX - pt.x;
    const dz = carZ - pt.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  if (bestDistSq === Infinity) {
    for (let i = 0; i < track.length; i++) {
      const pt = track[i];
      const dx = carX - pt.x;
      const dz = carZ - pt.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
  }

  const pt = track[bestIdx];
  const dx = carX - pt.x;
  const dz = carZ - pt.z;
  const signedPerpOffset = dx * pt.nx + dz * pt.nz;
  const alongS = dx * pt.tx + dz * pt.tz;
  const perpDist = Math.abs(signedPerpOffset);
  const halfWidth = pt.width * 0.5 + allowanceBonus;
  const onRoadCorridor = perpDist <= halfWidth;

  const prevPt = track[Math.max(0, bestIdx - 1)];
  const nextPt = track[Math.min(track.length - 1, bestIdx + 1)];

  // Determine chasm gap status & reference elevation ignoring floating chasm coin arc
  const inChasmGap = Boolean(pt.isChasmGap);

  // Interpolate road height cleanly between solid points
  let roadY = pt.y;
  let roadSlope = 0;
  let referenceGroundY = pt.y;

  if (inChasmGap) {
    // Find nearest solid launch lip behind and landing rim ahead for cliff/chasm checks
    let backSolid = pt;
    for (let b = bestIdx - 1; b >= 0; b--) {
      if (!track[b].isChasmGap) {
        backSolid = track[b];
        break;
      }
    }
    let fwdSolid = pt;
    for (let f = bestIdx + 1; f < track.length; f++) {
      if (!track[f].isChasmGap) {
        fwdSolid = track[f];
        break;
      }
    }
    referenceGroundY = Math.min(backSolid.y, fwdSolid.y);
    roadY = referenceGroundY - 20;
    roadSlope = 0;
  } else {
    const neighborPt = alongS >= 0 ? nextPt : prevPt;
    if (neighborPt !== pt && !neighborPt.isChasmGap) {
      const t = Math.max(0, Math.min(1, Math.abs(alongS) / stepDistance));
      roadY = pt.y + (neighborPt.y - pt.y) * t;
    }
    const pLow = prevPt.isChasmGap ? pt : prevPt;
    const pHigh = nextPt.isChasmGap ? pt : nextPt;
    const span = (pHigh.index - pLow.index) * stepDistance;
    if (span > 0.5) {
      roadSlope = Math.max(-0.48, Math.min(0.48, (pHigh.y - pLow.y) / span));
    }
  }

  const rampPitchRad = pt.isMountainRamp ? pt.rampSlope ?? 0.36 : Math.atan(roadSlope);
  const terrainY = sampleMountainTerrainElevation(signedPerpOffset, carZ, referenceGroundY, inChasmGap);

  return {
    onRoadCorridor,
    inChasmGap,
    isRamp: Boolean(pt.isMountainRamp),
    roadY,
    roadSlope,
    rampPitchRad,
    referenceGroundY,
    terrainY,
    signedPerpOffset,
    halfWidth,
    closestPoint: pt,
    peakNum: pt.mountainPeakNum ?? 1,
    gapWidthSlices: getCycleGapSlices(pt.mountainPeakNum ?? 1),
  };
}

/**
 * Advances Mountain Drive physics with heavy slope gravity, ramp launches,
 * ballistic chasm flight, air control, clean landings, and cliff/chasm falls.
 */
export function stepMountainPhysics(
  state: MountainPhysicsState,
  inputs: {
    steerInput: number;
    throttle: number;
    handbrake?: boolean;
    isFever?: boolean;
    roadAllowanceBonus?: number;
  },
  stats: {
    topSpeed: number;
    driftGrip: number;
    handlingRate: number;
  },
  track: SCurvePoint[],
  stepDistance = MOUNTAIN_STEP_DEFAULT,
  dt: number
): MountainStepResult {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const allowance = inputs.roadAllowanceBonus ?? 0;

  let nextX = state.x;
  let nextY = state.y;
  let nextZ = state.z;
  let nextVx = state.vx;
  let nextVz = state.vz;
  let nextVy = state.vy;
  let nextHeading = state.heading;
  let nextAngVel = state.angularVelocity;
  let nextAirborne = state.isAirborne;
  let nextAirTime = state.airTimeSec;
  let nextWasOnRamp = state.wasOnRamp;
  let nextRampPitch = state.lastRampPitchRad;
  let nextJumps = state.jumpsCleared;
  let nextBestAir = state.bestAirTimeSec;
  let nextLaunchX = state.launchStartX;
  let nextLaunchZ = state.launchStartZ;
  let isDrifting = false;
  let driftFactor = 0;

  let justLaunched = false;
  let justLanded = false;
  let landedAirTimeSec = 0;
  let jumpDistanceM = 0;
  let landingImpactSpeed = 0;
  let bermBounce = false;
  let impactSpeed = 0;
  let fellReason: MountainStepResult['fellReason'] = null;

  const curSurf = sampleMountainSurface(state.x, state.z, track, stepDistance, allowance);

  if (!state.isAirborne) {
    // Grounded driving with heavy mountain slope physics
    const forwardX = Math.cos(state.heading);
    const forwardZ = Math.sin(state.heading);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    const steerRate = stats.handlingRate * (inputs.handbrake ? 1.25 : 0.98);
    let targetAngVel = inputs.steerInput * steerRate;
    if (Math.abs(inputs.steerInput) < 0.05 && curSurf.closestPoint) {
      const angleToRoad = normalizeAngle(curSurf.closestPoint.heading - state.heading);
      targetAngVel = angleToRoad * 1.25;
    }

    const angularLerpRate = inputs.handbrake ? 8.5 : 12.5;
    nextAngVel =
      state.angularVelocity +
      (targetAngVel - state.angularVelocity) * Math.min(1, angularLerpRate * clampedDt);
    nextHeading = normalizeAngle(state.heading + nextAngVel * clampedDt);

    const vForward = state.vx * forwardX + state.vz * forwardZ;
    const vLateral = state.vx * rightX + state.vz * rightZ;

    // Heavy mountain slopes: climbing drains target speed & momentum; descending amplifies rush!
    const slope = curSurf.roadSlope;
    const slopeGravityPull = -slope * 18.5; // uphill (<0 pull), downhill (>0 push)
    const slopeTopSpeedBonus = -slope * stats.topSpeed * 0.42;
    const desiredForwardSpeed = Math.max(
      7.5,
      stats.topSpeed * Math.max(0.32, inputs.throttle) + slopeTopSpeedBonus
    );
    const accelRate = slope > 0.08 ? 3.2 : 4.2;
    let nextVForward =
      vForward + (desiredForwardSpeed - vForward) * Math.min(1, accelRate * clampedDt) + slopeGravityPull * clampedDt;
    nextVForward = Math.max(4.0, Math.min(stats.topSpeed * 1.48, nextVForward));

    const isTurning = Math.abs(inputs.steerInput) > 0.1 || !!inputs.handbrake;
    const effectiveGrip = inputs.handbrake
      ? 2.0
      : isTurning
      ? stats.driftGrip * 3.3
      : stats.driftGrip * 6.8;
    const nextVLateral = vLateral * Math.exp(-effectiveGrip * clampedDt);

    const nFwdX = Math.cos(nextHeading);
    const nFwdZ = Math.sin(nextHeading);
    const nRightX = -nFwdZ;
    const nRightZ = nFwdX;

    nextVx = nFwdX * nextVForward + nRightX * nextVLateral;
    nextVz = nFwdZ * nextVForward + nRightZ * nextVLateral;

    const currentSpeed = Math.hypot(nextVx, nextVz);
    let slipAngle = 0;
    if (currentSpeed > 2.0) {
      slipAngle = normalizeAngle(nextHeading - Math.atan2(nextVz, nextVx));
    }
    const absSlip = Math.abs(slipAngle);
    isDrifting =
      currentSpeed > 8.0 &&
      (absSlip > 0.14 || !!inputs.handbrake || (isTurning && absSlip > 0.08));
    driftFactor = isDrifting
      ? Math.min(1, (absSlip - 0.08) / 0.5 + (inputs.handbrake ? 0.35 : 0.15))
      : 0;

    nextX = state.x + nextVx * clampedDt;
    nextZ = state.z + nextVz * clampedDt;

    if (curSurf.isRamp) {
      nextWasOnRamp = true;
      nextRampPitch = Math.max(0.32, curSurf.rampPitchRad);
    } else if (!curSurf.inChasmGap) {
      nextWasOnRamp = false;
    }

    const nextSurf = sampleMountainSurface(nextX, nextZ, track, stepDistance, allowance);

    if (nextSurf.inChasmGap) {
      // Entered mountain chasm -> Launch off the lip!
      nextAirborne = true;
      nextAirTime = 0;
      justLaunched = true;
      nextLaunchX = state.x;
      nextLaunchZ = state.z;
      const launchAngle = nextWasOnRamp ? Math.max(0.32, nextRampPitch) : 0.08;
      const rampPop = nextWasOnRamp ? 4.4 + (inputs.isFever ? 1.8 : 0) : 0.8;
      const rawLaunchVy = nextVForward * Math.sin(launchAngle) + rampPop;
      nextVy = nextWasOnRamp ? Math.max(6.8, Math.min(16.2, rawLaunchVy)) : Math.max(1.0, rawLaunchVy);
      nextY = state.y + nextVy * clampedDt;
    } else if (!nextSurf.onRoadCorridor) {
      const cpEdge = nextSurf.closestPoint || curSurf.closestPoint;
      const edgeSign = nextSurf.signedPerpOffset >= 0 ? 1 : -1;
      const outwardVel = cpEdge
        ? Math.max(0, (nextVx * cpEdge.nx + nextVz * cpEdge.nz) * edgeSign)
        : Math.abs(nextVLateral);
      const absOff = Math.abs(nextSurf.signedPerpOffset);

      // Only fast, solidly angled cliff plunges destroy the car off the mountain!
      // Low-speed or shallow edge touches kick off the rocky dirt berm back onto the ridge.
      if ((currentSpeed < 20.0 || outwardVel < 5.5) && cpEdge && absOff < nextSurf.halfWidth + 2.2) {
        bermBounce = true;
        impactSpeed = Number((outwardVel * 1.3 + currentSpeed * 0.2).toFixed(2));
        const clampedLat = edgeSign * Math.max(0, nextSurf.halfWidth - 0.24);
        const alongS = (nextX - cpEdge.x) * cpEdge.tx + (nextZ - cpEdge.z) * cpEdge.tz;
        nextX = cpEdge.x + cpEdge.tx * alongS + cpEdge.nx * clampedLat;
        nextZ = cpEdge.z + cpEdge.tz * alongS + cpEdge.nz * clampedLat;
        const inwardPush = -edgeSign * Math.max(3.0, outwardVel * 0.55 + 1.8);
        const keepFwd = Math.max(5.5, nextVForward * 0.86);
        nextVx = cpEdge.tx * keepFwd + cpEdge.nx * inwardPush;
        nextVz = cpEdge.tz * keepFwd + cpEdge.nz * inwardPush;
        nextHeading = normalizeAngle(nextHeading + normalizeAngle(cpEdge.heading - nextHeading) * 0.45);
        nextY = nextSurf.roadY;
        nextVy = 0;
      } else {
        // Steered fast & hard off the exposed alpine mountain cliff edge!
        impactSpeed = Number(Math.hypot(currentSpeed, outwardVel).toFixed(2));
        fellReason = 'Fell Off Mountain Cliff';
      }
    } else {
      // Cresting a sharp convex hilltop at high speed launches the car ballistically into the air!
      const prevExpectedVy = vForward * curSurf.roadSlope;
      const ballisticPredY = state.y + prevExpectedVy * clampedDt - 0.5 * MOUNTAIN_GRAVITY * clampedDt * clampedDt;
      const slopeDrop = curSurf.roadSlope - nextSurf.roadSlope;
      const crestLiftAccel = slopeDrop > 0.01 ? (nextVForward * slopeDrop) / clampedDt : 0;
      if (
        nextVForward >= 17.5 &&
        crestLiftAccel > MOUNTAIN_GRAVITY * 1.05 &&
        ballisticPredY > nextSurf.roadY + 0.01
      ) {
        nextAirborne = true;
        nextAirTime = 0;
        justLaunched = true;
        nextLaunchX = state.x;
        nextLaunchZ = state.z;
        nextVy = Math.max(1.2, prevExpectedVy * 0.95);
        nextY = ballisticPredY;
      } else {
        nextY = nextSurf.roadY;
        nextVy = nextVForward * nextSurf.roadSlope;
      }
    }

    return {
      state: {
        x: nextX,
        z: nextZ,
        y: nextY,
        vx: nextVx,
        vz: nextVz,
        vy: nextVy,
        heading: nextHeading,
        angularVelocity: nextAngVel,
        isDrifting,
        driftFactor,
        isAirborne: nextAirborne,
        airTimeSec: nextAirTime,
        wasOnRamp: nextWasOnRamp,
        lastRampPitchRad: nextRampPitch,
        jumpsCleared: nextJumps,
        bestAirTimeSec: nextBestAir,
        currentPeakNum: nextSurf.peakNum,
        currentSlopePct: Math.round(nextSurf.roadSlope * 100),
        launchStartX: nextLaunchX,
        launchStartZ: nextLaunchZ,
      },
      justLaunched,
      justLanded,
      landedAirTimeSec,
      jumpDistanceM,
      landingImpactSpeed,
      bermBounce,
      impactSpeed,
      fellReason,
    };
  }

  // Airborne Ballistic Flight across mountain chasm!
  nextAirTime = state.airTimeSec + clampedDt;
  // Subtle responsive mid-air yaw control
  const airYawVel = inputs.steerInput * 0.72;
  nextHeading = normalizeAngle(state.heading + airYawVel * clampedDt);
  nextAngVel = airYawVel;

  // Redirect slight air steer momentum + optional Nitro mid-air glide extension
  const hSpeed = Math.hypot(state.vx, state.vz);
  const feverAirAccel = inputs.isFever ? 4.8 * clampedDt : 0;
  const targetAirHeading = normalizeAngle(Math.atan2(state.vz, state.vx) + airYawVel * 0.35 * clampedDt);
  const newHSpeed = Math.min(stats.topSpeed * 1.48, hSpeed + feverAirAccel);
  nextVx = Math.cos(targetAirHeading) * newHSpeed;
  nextVz = Math.sin(targetAirHeading) * newHSpeed;

  nextVy = state.vy - (MOUNTAIN_GRAVITY - (inputs.isFever ? 3.8 : 0)) * clampedDt;
  nextX = state.x + nextVx * clampedDt;
  nextZ = state.z + nextVz * clampedDt;
  nextY = state.y + nextVy * clampedDt;

  const airSurf = sampleMountainSurface(nextX, nextZ, track, stepDistance, allowance + 0.55);

  if (airSurf.inChasmGap) {
    // Still over chasm — check if fallen deep below into the canyon abyss
    const chasmFailFloor = airSurf.referenceGroundY - 8.5;
    if (nextY < chasmFailFloor) {
      impactSpeed = Number(Math.hypot(newHSpeed, nextVy).toFixed(2));
      fellReason = 'Fell Into Mountain Chasm';
    }
  } else {
    // Over opposite (or current) mountain ridge!
    if (!airSurf.onRoadCorridor) {
      if (nextY <= airSurf.terrainY + 0.25) {
        impactSpeed = Number(Math.hypot(newHSpeed, nextVy).toFixed(2));
        fellReason = 'Fell Off Mountain Cliff';
      }
    } else {
      // Inside road corridor: forgiving lip-scramble if near rim, otherwise cliff wall slam vs clean landing
      if (nextY < airSurf.roadY - 2.15 && nextVy < 5.0) {
        impactSpeed = Number(Math.hypot(newHSpeed, nextVy).toFixed(2));
        fellReason = 'Missed Mountain Jump';
      } else if (nextY <= airSurf.roadY + 0.12 && nextVy <= 0) {
        // Landed cleanly back onto mountain ridge!
        landingImpactSpeed = Math.abs(nextVy);
        nextY = airSurf.roadY;
        nextVy = 0;
        nextAirborne = false;
        nextWasOnRamp = false;
        justLanded = true;
        landedAirTimeSec = nextAirTime;
        jumpDistanceM = Math.hypot(nextX - state.launchStartX, nextZ - state.launchStartZ);
        if (nextAirTime >= 0.32) {
          nextJumps += 1;
          if (nextAirTime > nextBestAir) nextBestAir = nextAirTime;
        }
        nextAirTime = 0;
      }
    }
  }

  return {
    state: {
      x: nextX,
      z: nextZ,
      y: nextY,
      vx: nextVx,
      vz: nextVz,
      vy: nextVy,
      heading: nextHeading,
      angularVelocity: nextAngVel,
      isDrifting: false,
      driftFactor: 0,
      isAirborne: nextAirborne,
      airTimeSec: nextAirTime,
      wasOnRamp: nextWasOnRamp,
      lastRampPitchRad: nextRampPitch,
      jumpsCleared: nextJumps,
      bestAirTimeSec: nextBestAir,
      currentPeakNum: airSurf.peakNum,
      currentSlopePct: nextAirborne ? Math.round((nextVy / Math.max(1, newHSpeed)) * 100) : Math.round(airSurf.roadSlope * 100),
      launchStartX: nextLaunchX,
      launchStartZ: nextLaunchZ,
    },
    justLaunched,
    justLanded,
    landedAirTimeSec,
    jumpDistanceM,
    landingImpactSpeed,
    bermBounce,
    impactSpeed,
    fellReason,
  };
}

export interface MountainCameraTarget {
  focusY: number;
  pitchSlope: number;
  camHeight: number;
  camDistBack: number;
}

/**
 * Computes stable Mountain Drive chase camera framing across steep climbs,
 * descents, launch ramps, and deep chasms without snapping down to canyon floors.
 */
export function computeMountainCameraTarget(params: {
  carY: number;
  carVy: number;
  roadSlope: number;
  isAirborne: boolean;
  inChasmGap: boolean;
  referenceGroundY: number;
  roadY: number;
  aheadRoadY?: number;
  isTitle?: boolean;
  speedZoom?: number;
}): MountainCameraTarget {
  const {
    carY,
    carVy,
    roadSlope,
    isAirborne,
    inChasmGap,
    referenceGroundY,
    roadY,
    aheadRoadY,
    isTitle = false,
    speedZoom = 0,
  } = params;

  // Never track the -22m canyon bottom during chasm flight; anchor to the ridge/lip deck instead.
  const safeGroundY = inChasmGap || isAirborne ? referenceGroundY : roadY;
  const clampedSlope = Math.max(-0.42, Math.min(0.42, roadSlope));

  let focusY: number;
  if (isAirborne) {
    const vyLead = Math.max(-0.85, Math.min(0.75, carVy * 0.045));
    focusY = safeGroundY * 0.22 + carY * 0.78 + vyLead;
  } else {
    const aheadDelta =
      aheadRoadY !== undefined ? Math.max(-1.8, Math.min(1.8, (aheadRoadY - carY) * 0.18)) : 0;
    focusY = carY + aheadDelta;
  }

  // Keep horizon pitch controlled: never invert negative into the sky on +39% ramps,
  // and gently look down toward landing rim once descending across a chasm.
  const descentLookDown = isAirborne ? Math.max(0, Math.min(0.055, (2.0 - carVy) * 0.0055)) : 0;
  const rawPitchSlope = 0.098 - clampedSlope * 0.145 + descentLookDown;
  const pitchSlope = Number(Math.max(0.045, Math.min(0.175, rawPitchSlope)).toFixed(4));

  return {
    focusY,
    pitchSlope,
    camHeight: isTitle ? 3.05 : 4.55,
    camDistBack: (isTitle ? 10.6 : 9.3) + speedZoom * 0.85,
  };
}

