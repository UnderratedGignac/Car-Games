/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure pseudo-3D road core: segment track generation (curves + hills),
 * screen projection, lateral car physics, collisions and run timers.
 * No DOM / canvas access here so it can be unit tested with node:test.
 */

import type { GameModeId } from './rules';

export const SEGMENT_LENGTH = 200;
export const ROAD_WIDTH = 2000; // half-width in world units
export const RUMBLE_LENGTH = 3; // segments per rumble stripe
export const DRAW_DISTANCE = 220; // segments
export const CAMERA_HEIGHT = 1000;
export const FIELD_OF_VIEW = 100; // degrees
export const PLAYER_Z_OFFSET = 0; // computed at runtime from camera depth
export const FEVER_DURATION = 8;

export type PropKind = 'tree' | 'lamp' | 'sign' | 'rock' | 'gantry' | 'checkpoint';

export interface RoadProp {
  kind: PropKind;
  offset: number; // -x .. +x in road half-widths (|x|>1 is off-road)
  variant: number;
}

export interface RoadCoin {
  offset: number;
  taken: boolean;
  star: boolean;
}

export interface RoadSegment {
  index: number;
  z: number;
  curve: number;
  y1: number;
  y2: number;
  props: RoadProp[];
  coin: RoadCoin | null;
  checkpoint: boolean;
}

export interface Track {
  mode: GameModeId;
  segments: RoadSegment[];
  rngState: number;
  lanes: number;
  checkpointEverySegs: number;
}

// --- deterministic RNG (mulberry32) -------------------------------------
function nextRand(track: Track): number {
  let t = (track.rngState = (track.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const easeIn = (a: number, b: number, p: number) => a + (b - a) * p * p;
const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

export function checkpointEvery(mode: GameModeId): number {
  return mode === 'drift' ? 1300 : 700; // segments (~1 km drift, ~550 m highway)
}

export function lanesFor(mode: GameModeId): number {
  return mode === 'drift' ? 2 : 3;
}

export function laneCenter(lane: number, lanes: number): number {
  // returns offset in -1..1 road half-width units
  return -1 + (2 * lane + 1) / lanes;
}

function addSegment(track: Track, curve: number, y: number) {
  const n = track.segments.length;
  const prevY = n === 0 ? 0 : track.segments[n - 1].y2;
  track.segments.push({
    index: n,
    z: n * SEGMENT_LENGTH,
    curve,
    y1: prevY,
    y2: y,
    props: [],
    coin: null,
    checkpoint: n > 0 && n % track.checkpointEverySegs === 0,
  });
}

function addRoad(track: Track, enter: number, hold: number, leave: number, curve: number, height: number) {
  const n = track.segments.length;
  const startY = n === 0 ? 0 : track.segments[n - 1].y2;
  const endY = startY + height * SEGMENT_LENGTH;
  const total = enter + hold + leave;
  for (let i = 0; i < enter; i++) addSegment(track, easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total));
  for (let i = 0; i < hold; i++) addSegment(track, curve, easeInOut(startY, endY, (enter + i) / total));
  for (let i = 0; i < leave; i++) addSegment(track, easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (enter + hold + i) / total));
}

/** Appends one randomised "chunk" of road and decorates it. */
function addChunk(track: Track) {
  const r = () => nextRand(track);
  const drift = track.mode === 'drift';
  const from = track.segments.length;
  const curveMax = drift ? 6.5 : 2.6;
  const roll = r();
  const len = drift ? 18 + Math.floor(r() * 22) : 30 + Math.floor(r() * 40);
  const sign = r() < 0.5 ? -1 : 1;
  // keep hills bounded so the road never drifts far from y=0
  const lastY = from === 0 ? 0 : track.segments[from - 1].y2;
  const hillPull = -lastY / (SEGMENT_LENGTH * 60);
  const hill = Math.max(-40, Math.min(40, (r() - 0.5) * (drift ? 70 : 50) + hillPull * 40));

  if (roll < (drift ? 0.12 : 0.3)) {
    addRoad(track, 10, len, 10, 0, hill * 0.4);
  } else if (roll < (drift ? 0.55 : 0.75)) {
    addRoad(track, 12, len, 12, sign * curveMax * (0.5 + r() * 0.5), hill);
  } else {
    // S-bend
    const c = curveMax * (0.55 + r() * 0.45);
    addRoad(track, 8, Math.floor(len / 2), 8, sign * c, hill * 0.5);
    addRoad(track, 8, Math.floor(len / 2), 8, -sign * c, -hill * 0.3);
  }

  decorate(track, from, track.segments.length);
}

function decorate(track: Track, from: number, to: number) {
  const r = () => nextRand(track);
  const lanes = track.lanes;
  let coinRun = 0;
  let coinLane = 0;
  for (let i = from; i < to; i++) {
    const seg = track.segments[i];
    if (i < 12) continue;
    if (seg.checkpoint) {
      seg.props.push({ kind: 'checkpoint', offset: 0, variant: 0 });
      continue;
    }
    // roadside scenery
    if (i % 3 === 0) {
      const side = r() < 0.5 ? -1 : 1;
      seg.props.push({ kind: r() < 0.12 ? 'rock' : 'tree', offset: side * (1.4 + r() * 2.6), variant: Math.floor(r() * 4) });
    }
    if (r() < 0.35) {
      const side = r() < 0.5 ? -1 : 1;
      seg.props.push({ kind: 'tree', offset: side * (3.2 + r() * 4), variant: Math.floor(r() * 4) });
    }
    if (i % 16 === 0) {
      seg.props.push({ kind: 'lamp', offset: -1.22, variant: 0 });
      seg.props.push({ kind: 'lamp', offset: 1.22, variant: 0 });
    }
    if (Math.abs(seg.curve) > 2 && i % 10 === 0) {
      // chevron sign on the outside of the bend
      seg.props.push({ kind: 'sign', offset: seg.curve > 0 ? 1.35 : -1.35, variant: seg.curve > 0 ? 1 : 0 });
    }
    if (i % 140 === 70) seg.props.push({ kind: 'gantry', offset: 0, variant: Math.floor(r() * 3) });

    // coin trails: runs of 6-10 coins in a lane, drifting towards the inside of curves
    if (coinRun <= 0 && r() < 0.06) {
      coinRun = 6 + Math.floor(r() * 5);
      coinLane = Math.floor(r() * lanes);
    }
    if (coinRun > 0 && i % 2 === 0) {
      const base = laneCenter(coinLane, lanes);
      const inside = Math.max(-0.8, Math.min(0.8, base + Math.sign(seg.curve) * Math.min(0.35, Math.abs(seg.curve) * 0.06)));
      seg.coin = { offset: inside, taken: false, star: coinRun === 1 && r() < 0.35 };
      coinRun--;
    }
  }
}

export function createTrack(mode: GameModeId, seed: number): Track {
  const track: Track = {
    mode,
    segments: [],
    rngState: seed >>> 0 || 1,
    lanes: lanesFor(mode),
    checkpointEverySegs: checkpointEvery(mode),
  };
  addRoad(track, 0, 40, 0, 0, 0); // straight start grid
  decorate(track, 0, track.segments.length);
  while (track.segments.length < 400) addChunk(track);
  return track;
}

export function ensureTrackAhead(track: Track, uptoIndex: number) {
  while (track.segments.length <= uptoIndex) addChunk(track);
}

export function findSegment(track: Track, z: number): RoadSegment {
  const i = Math.max(0, Math.floor(z / SEGMENT_LENGTH));
  ensureTrackAhead(track, i + 1);
  return track.segments[i];
}

export interface Projected {
  x: number;
  y: number;
  w: number;
  scale: number;
}

export function cameraDepthFor(fovDeg: number): number {
  return 1 / Math.tan(((fovDeg / 2) * Math.PI) / 180);
}

export function projectPoint(
  wx: number,
  wy: number,
  wz: number,
  camX: number,
  camY: number,
  camZ: number,
  camDepth: number,
  width: number,
  height: number,
  roadWidth: number,
  horizonY = height / 2
): Projected {
  const dz = Math.max(1, wz - camZ);
  const scale = camDepth / dz;
  return {
    scale,
    x: Math.round(width / 2 + scale * (wx - camX) * width / 2),
    y: Math.round(horizonY - scale * (wy - camY) * height / 2),
    w: Math.round(scale * roadWidth * width / 2),
  };
}

export interface LateralInput {
  x: number;
  speedRatio: number; // 0..~1.4
  steer: number; // -1..1
  curve: number;
  dt: number;
  handling: number; // ~2.2..3.6 from computeEffectiveCarStats.handlingRate
  drifting: boolean;
  assist?: number; // 0..1: share of centrifugal pull cancelled while there is no steering input
}

export const CENTRIFUGAL = 0.3;
export const MAX_X = 2.2;

export function stepLateral(i: LateralInput): { x: number } {
  const steerRate = (i.handling / 2.8) * 2.1 * i.dt * Math.min(1, 0.35 + i.speedRatio);
  let x = i.x + i.steer * steerRate * (i.drifting ? 1.15 : 1);
  const grip = i.drifting ? 0.45 : 1;
  const assist = i.steer === 0 ? 1 - Math.max(0, Math.min(1, i.assist ?? 0)) : 1;
  x -= i.dt * i.speedRatio * i.speedRatio * i.curve * CENTRIFUGAL * grip * assist;
  return { x: Math.max(-MAX_X, Math.min(MAX_X, x)) };
}

export function carsOverlap(x1: number, w1: number, x2: number, w2: number, percent = 0.8): boolean {
  const half = (w1 + w2) * 0.5 * percent;
  return Math.abs(x1 - x2) < half;
}

/** World units per second at full throttle for a car's effective topSpeed stat. */
export function maxSpeedFor(topSpeedStat: number): number {
  return topSpeedStat * 560;
}

export function speedToKmh(speed: number): number {
  return (speed / 560) * 8;
}

export interface RunState {
  mode: GameModeId;
  score: number;
  combo: number;
  maxCombo: number;
  comboTimer: number;
  fever: number;
  feverTimer: number;
  nitro: number; // 0..100
  boostTimer: number;
  timeLeft: number;
  coins: number;
  overtakes: number;
  nearMisses: number;
  distance: number; // meters
  checkpoints: number;
  driftTime: number;
}

export function createRunState(mode: GameModeId): RunState {
  return {
    mode,
    score: 0,
    combo: 1,
    maxCombo: 1,
    comboTimer: 0,
    fever: 0,
    feverTimer: 0,
    nitro: 100,
    boostTimer: 0,
    timeLeft: mode === 'drift' ? 32 : Infinity,
    coins: 0,
    overtakes: 0,
    nearMisses: 0,
    distance: 0,
    checkpoints: 0,
    driftTime: 0,
  };
}

/** Adds fever; returns true when fever mode starts. */
export function addFever(run: RunState, amount: number): boolean {
  if (run.feverTimer > 0) return false;
  run.fever += amount;
  if (run.fever >= 100) {
    run.fever = 0;
    run.feverTimer = FEVER_DURATION;
    return true;
  }
  return false;
}

export function bumpCombo(run: RunState, by = 1) {
  run.combo = Math.min(99, run.combo + by);
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  run.comboTimer = 3.2;
}

export function stepTimers(run: RunState, dt: number) {
  if (run.feverTimer > 0) run.feverTimer = Math.max(0, run.feverTimer - dt);
  if (run.boostTimer > 0) run.boostTimer = Math.max(0, run.boostTimer - dt);
  if (run.comboTimer > 0) {
    run.comboTimer -= dt;
    if (run.comboTimer <= 0) {
      run.comboTimer = 0;
      run.combo = 1;
    }
  }
  if (Number.isFinite(run.timeLeft)) run.timeLeft = Math.max(0, run.timeLeft - dt);
}

/** World units per real metre, consistent with speedToKmh. */
export const UNITS_PER_METER = 560 * 3.6 / 8;

/**
 * Swept collision along z: true when the car's position relative to the player
 * was inside, or crossed, the +/-halfWindow band during this frame.
 */
export function sweptOverlapZ(prevDz: number, curDz: number, halfWindow: number): boolean {
  const lo = Math.min(prevDz, curDz);
  const hi = Math.max(prevDz, curDz);
  return lo <= halfWindow && hi >= -halfWindow;
}

const PRUNED_SEGMENT: RoadSegment = Object.freeze({
  index: -1,
  z: 0,
  curve: 0,
  y1: 0,
  y2: 0,
  props: Object.freeze([]) as unknown as RoadProp[],
  coin: null,
  checkpoint: false,
}) as RoadSegment;

const prunedUpTo = new WeakMap<Track, number>();

/** Replaces every segment before `beforeIndex` with one shared empty placeholder (frees props/coins). */
export function pruneTrackBehind(track: Track, beforeIndex: number) {
  const end = Math.min(beforeIndex, track.segments.length);
  for (let i = prunedUpTo.get(track) ?? 0; i < end; i++) track.segments[i] = PRUNED_SEGMENT;
  prunedUpTo.set(track, Math.max(prunedUpTo.get(track) ?? 0, end));
}
