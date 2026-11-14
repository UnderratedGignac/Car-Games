/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GhostFrame {
  timeSec: number;
  distance: number;
  lateralOffset: number; // -1 to 1 or world lateral coordinate
  angle: number;
  speedKmh: number;
}

export interface GhostRun {
  mode: string;
  carId: string;
  carColor: string;
  score: number;
  distance: number;
  createdAt: number;
  frames: GhostFrame[];
}

export const GHOST_STORAGE_KEY_PREFIX = 'neon_ghost_';

/**
 * Normalizes an angle into (-PI, PI] range
 */
export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Compares distance/score against existing saved ghost for that mode in
 * localStorage['neon_ghost_' + run.mode], saves if better.
 */
export function saveBestGhostRun(run: GhostRun): boolean {
  if (
    typeof localStorage === 'undefined' ||
    !run ||
    !run.mode ||
    !Array.isArray(run.frames) ||
    run.frames.length === 0
  ) {
    return false;
  }

  try {
    const key = GHOST_STORAGE_KEY_PREFIX + run.mode;
    const existing = loadBestGhostRun(run.mode);
    const isBetter =
      !existing ||
      run.distance > existing.distance ||
      (run.distance === existing.distance && run.score > existing.score);

    if (isBetter) {
      localStorage.setItem(key, JSON.stringify(run));
      return true;
    }
  } catch (err) {
    console.warn('Failed to save ghost run:', err);
  }
  return false;
}

/**
 * Loads saved ghost from localStorage for the given mode.
 */
export function loadBestGhostRun(mode: string): GhostRun | null {
  if (typeof localStorage === 'undefined' || !mode) {
    return null;
  }

  try {
    const key = GHOST_STORAGE_KEY_PREFIX + mode;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.mode === 'string' &&
      typeof parsed.distance === 'number' &&
      Array.isArray(parsed.frames) &&
      parsed.frames.length > 0
    ) {
      return parsed as GhostRun;
    }
  } catch (err) {
    console.warn('Failed to parse ghost run:', err);
  }
  return null;
}

/**
 * Efficient binary search and lerp between adjacent frames based on currentTimeSec.
 * Supports an optional preallocated `out` frame to ensure zero GC allocations during 60-120fps render loops.
 */
export function sampleGhostPosition(
  ghost: GhostRun,
  currentTimeSec: number,
  out?: GhostFrame
): GhostFrame | null {
  if (!ghost || !ghost.frames || ghost.frames.length === 0) {
    return null;
  }

  const frames = ghost.frames;
  const count = frames.length;

  // Before or at first frame
  if (currentTimeSec <= frames[0].timeSec) {
    const f0 = frames[0];
    if (out) {
      out.timeSec = f0.timeSec;
      out.distance = f0.distance;
      out.lateralOffset = f0.lateralOffset;
      out.angle = f0.angle;
      out.speedKmh = f0.speedKmh;
      return out;
    }
    return { ...f0 };
  }

  // At or past last frame
  if (currentTimeSec >= frames[count - 1].timeSec) {
    const fLast = frames[count - 1];
    if (out) {
      out.timeSec = fLast.timeSec;
      out.distance = fLast.distance;
      out.lateralOffset = fLast.lateralOffset;
      out.angle = fLast.angle;
      out.speedKmh = fLast.speedKmh;
      return out;
    }
    return { ...fLast };
  }

  // Binary search for interval [low, low + 1]
  let low = 0;
  let high = count - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (frames[mid].timeSec <= currentTimeSec) {
      if (mid === count - 1 || frames[mid + 1].timeSec > currentTimeSec) {
        low = mid;
        break;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const f0 = frames[low];
  const f1 = frames[Math.min(count - 1, low + 1)];
  const dt = f1.timeSec - f0.timeSec;
  const t = dt > 1e-6 ? Math.max(0, Math.min(1, (currentTimeSec - f0.timeSec) / dt)) : 0;

  const interpolatedDistance = f0.distance + (f1.distance - f0.distance) * t;
  const interpolatedLateral = f0.lateralOffset + (f1.lateralOffset - f0.lateralOffset) * t;
  const angleDelta = normalizeAngle(f1.angle - f0.angle);
  const interpolatedAngle = normalizeAngle(f0.angle + angleDelta * t);
  const interpolatedSpeed = f0.speedKmh + (f1.speedKmh - f0.speedKmh) * t;

  if (out) {
    out.timeSec = currentTimeSec;
    out.distance = interpolatedDistance;
    out.lateralOffset = interpolatedLateral;
    out.angle = interpolatedAngle;
    out.speedKmh = interpolatedSpeed;
    return out;
  }

  return {
    timeSec: currentTimeSec,
    distance: interpolatedDistance,
    lateralOffset: interpolatedLateral,
    angle: interpolatedAngle,
    speedKmh: interpolatedSpeed,
  };
}

/**
 * Provides a default challenging rival ghost if the player doesn't have a personal best yet,
 * so every new player immediately has someone to chase!
 */
export function generateDevRivalGhost(mode: string): GhostRun {
  const isHighway = mode === 'highway_traffic';
  const isParking = mode === 'parking';

  const durationSec = 75; // 75 seconds run
  const dt = 0.1; // 10 Hz sampling
  const frameCount = Math.round(durationSec / dt);
  const frames: GhostFrame[] = new Array(frameCount);

  let curDist = 0;
  let curSpeedKmh = isParking ? 45 : 80;
  const targetSpeedKmh = isHighway ? 210 : isParking ? 78 : 185;

  const carId = isHighway ? 't40_spectre' : isParking ? 't10_stratos' : 't30_raptor';
  const carColor = isHighway ? '#06b6d4' : isParking ? '#10b981' : '#ec4899';

  for (let i = 0; i < frameCount; i++) {
    const t = Number((i * dt).toFixed(2));

    // Smooth launch acceleration in first 6 seconds
    if (t < 6.0) {
      const ramp = t / 6.0;
      curSpeedKmh = (isParking ? 45 : 75) + (targetSpeedKmh - (isParking ? 45 : 75)) * Math.sin(ramp * (Math.PI / 2));
    } else {
      // Natural racing speed micro-modulations (cornering braking and straight line boost)
      const wave = Math.sin(t * 0.4) * 8 + Math.cos(t * 0.18) * 12;
      curSpeedKmh = targetSpeedKmh + wave;
    }

    // Advance distance based on current speed
    const speedMps = curSpeedKmh / 3.6;
    curDist += speedMps * dt;

    // Mode-specific lateral racing line and angle
    let lateral = 0;
    let angle = -Math.PI / 2; // Default forward heading (-Z)

    if (isHighway) {
      // Weave between highway lanes (-2.2 and +2.2) smoothly every ~7 seconds
      const laneCycle = Math.sin(t * 0.35);
      lateral = Math.tanh(laneCycle * 3.0) * 2.2;
      // Slight yaw during lane change
      const dLateral = Math.cos(t * 0.35) * 0.15;
      angle = -Math.PI / 2 + dLateral;
    } else if (isParking) {
      // Precision slalom line
      lateral = Math.sin(t * 0.55) * 1.9;
      angle = -Math.PI / 2 + Math.cos(t * 0.55) * 0.22;
    } else {
      // High-performance drift sweeping line
      const driftSweep = Math.sin(t * 0.72) * 2.4;
      lateral = driftSweep;
      // Drifting slip angle
      const slipAngle = Math.cos(t * 0.72) * 0.38;
      angle = -Math.PI / 2 + slipAngle;
    }

    frames[i] = {
      timeSec: t,
      distance: Number(curDist.toFixed(1)),
      lateralOffset: Number(lateral.toFixed(2)),
      angle: Number(angle.toFixed(3)),
      speedKmh: Math.round(curSpeedKmh),
    };
  }

  const finalScore = isHighway ? 28500 : isParking ? 19200 : 34200;

  return {
    mode,
    carId,
    carColor,
    score: finalScore,
    distance: Math.round(curDist),
    createdAt: 1731535200000,
    frames,
  };
}
