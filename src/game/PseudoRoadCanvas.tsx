/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Retro pseudo-3D arcade renderer + game loop (replaces the old projected-3D scene).
 * Segment road with curves and hills, scaled 2D billboard sprites, parallax backdrops.
 */

import React, { useEffect, useRef } from 'react';
import {
  CarCustomization,
  CarSpec,
  CarUpgradeLevels,
  GameModeId,
  RoadBiomeConfig,
  RoadSelectionMode,
  TrafficVehicleKind,
  computeEffectiveCarStats,
  resolveRoadBiome,
} from './rules';
import { getPixelCarCanvas, getTrafficVehicleCanvas } from './pixelSprites';
import { soundFX } from './audio';
import {
  ANIME_CLOUD_COUNT,
  SkyAtmosphereConfig,
  SkyThemeId,
  renderAnimeCloudSprite,
  renderCelestialSprite,
  resolveSkyAtmosphere,
} from './skyArt';
import {
  CAMERA_HEIGHT,
  DRAW_DISTANCE,
  FEVER_DURATION,
  FIELD_OF_VIEW,
  ROAD_WIDTH,
  RUMBLE_LENGTH,
  RunState,
  SEGMENT_LENGTH,
  UNITS_PER_METER,
  Track,
  addFever,
  bumpCombo,
  cameraDepthFor,
  carsOverlap,
  createRunState,
  createTrack,
  ensureTrackAhead,
  findSegment,
  laneCenter,
  maxSpeedFor,
  projectPoint,
  speedToKmh,
  stepLateral,
  stepTimers,
  sweptOverlapZ,
  pruneTrackBehind,
} from './pseudoRoad';
import {
  getBackdropLayer,
  getCheckpointSprite,
  getCoinFrames,
  getGantrySprite,
  getLampSprite,
  getRockSprite,
  getSignSprite,
  getStarSprite,
  getTreeSprite,
} from './roadArt';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export interface LiveTelemetry {
  score: number;
  distance: number;
  combo: number;
  maxCombo: number;
  coinsRun: number;
  fever: number; // 0..100
  isFever: boolean;
  speedKmh: number;
  direction: 'right' | 'left';
  nearMissText: string;
  isDrifting?: boolean;
  biomeName?: string;
  overtakes?: number;
  nearMisses?: number;
  nitro?: number; // 0..100
  timeLeft?: number; // seconds, drift mode only
}

interface SceneCanvasProps {
  gamePhase: GamePhase;
  gameMode?: GameModeId;
  selectedCar: CarSpec;
  carUpgrades: CarUpgradeLevels;
  carCustom?: Partial<CarCustomization>;
  customSpriteUrl?: string;
  roadMode?: RoadSelectionMode;
  skyMode?: SkyThemeId;
  steerHold?: number;
  flipTriggerCount: number;
  boostTriggerCount: number;
  restartTriggerCount: number;
  flashTriggerCount?: number;
  hornTriggerCount?: number;
  onTelemetryUpdate: (telemetry: LiveTelemetry) => void;
  onGameOver: (finalStats: {
    score: number;
    distance: number;
    maxCombo: number;
    coinsCollected: number;
    overtakes?: number;
    nearMisses?: number;
    crashReason?: string;
  }) => void;
}

interface TrafficCar {
  z: number;
  x: number; // road half-width units
  targetX: number;
  speed: number;
  kind: TrafficVehicleKind;
  color: string;
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  grow: number;
  gravity: number;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
  size: number;
}

const TRAFFIC_KINDS: TrafficVehicleKind[] = ['sedan', 'hatch', 'van', 'box_truck', 'sports'];
const TRAFFIC_COLORS = ['#ef4444', '#3b82f6', '#f8fafc', '#22c55e', '#f59e0b', '#a855f7', '#64748b', '#14b8a6'];
const CAR_WORLD_W = 820;
const SPRITE_FILL = 0.62; // fraction of pixel-sprite canvas width the car body occupies
const PLAYER_HALF_W = (CAR_WORLD_W / ROAD_WIDTH) * 0.5; // in road half-width units

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** In-place filter: keeps array identity and avoids a per-frame allocation. */
function compact<T>(arr: T[], keep: (v: T) => boolean) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[w++] = arr[i];
  arr.length = w;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const SceneCanvas: React.FC<SceneCanvasProps> = React.memo((props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const pending = useRef({ boost: false, reset: false, flash: false, horn: false });
  const prev = useRef({
    boost: props.boostTriggerCount,
    restart: props.restartTriggerCount,
    flash: props.flashTriggerCount ?? 0,
    horn: props.hornTriggerCount ?? 0,
    mode: props.gameMode,
  });
  if (props.boostTriggerCount !== prev.current.boost) {
    prev.current.boost = props.boostTriggerCount;
    pending.current.boost = true;
  }
  if (props.restartTriggerCount !== prev.current.restart) {
    prev.current.restart = props.restartTriggerCount;
    pending.current.reset = true;
  }
  if ((props.flashTriggerCount ?? 0) !== prev.current.flash) {
    prev.current.flash = props.flashTriggerCount ?? 0;
    pending.current.flash = true;
  }
  if ((props.hornTriggerCount ?? 0) !== prev.current.horn) {
    prev.current.horn = props.hornTriggerCount ?? 0;
    pending.current.horn = true;
  }
  if (props.gameMode !== prev.current.mode) {
    prev.current.mode = props.gameMode;
    pending.current.reset = true;
  }

  useEffect(() => {
    const display = canvasRef.current;
    if (!display) return;
    const dctx = display.getContext('2d', { alpha: false });
    if (!dctx) return;

    // Internal low-res buffer, upscaled with nearest-neighbour for a crisp retro look.
    const buf = document.createElement('canvas');
    const ctx = buf.getContext('2d', { alpha: false })!;
    let W = 400;
    let H = 400;
    let pixelScale = 2;

    const resize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pixelScale = Math.max(1, Math.floor((vh * dpr) / 420));
      H = Math.ceil((vh * dpr) / pixelScale);
      W = Math.ceil((vw * dpr) / pixelScale);
      buf.width = W;
      buf.height = H;
      display.width = Math.round(vw * dpr);
      display.height = Math.round(vh * dpr);
      display.style.width = `${vw}px`;
      display.style.height = `${vh}px`;
      ctx.imageSmoothingEnabled = false;
      skyKey = '';
    };

    // ------------------------------------------------------------------ state
    let track: Track = createTrack(propsRef.current.gameMode || 'drift', (Math.random() * 1e9) | 0);
    let run: RunState = createRunState(track.mode);
    let position = 0; // camera z
    let speed = 0;
    let playerX = 0;
    let steerSmooth = 0;
    let drifting = false;
    let driftHold = 0;
    let driftBank = 0;
    let traffic: TrafficCar[] = [];
    let particles: Particle[] = [];
    let popups: Popup[] = [];
    let skyOffset = 0;
    let shake = 0;
    let flashFx = 0;
    let hitStop = 0;
    let crashed = false;
    let crashTimer = 0;
    let crashReason = '';
    let gameOverSent = false;
    let calloutText = '';
    let calloutTimer = 0;
    let wheelPhase = 0;
    let fovKick = 0;
    let lastPhase: GamePhase = propsRef.current.gamePhase;
    let telemetryTimer = 0;
    let lastCheckpointIdx = 0;
    let slipTimer = 0;
    let bumpCooldown = 0;
    let nextTrafficZ = 0;
    let customImg: HTMLImageElement | null = null;
    let customImgUrl = '';

    const keys = { left: false, right: false };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    };
    const onBlur = () => {
      keys.left = keys.right = false;
    };

    let statsKey: unknown[] = [];
    let statsCache: ReturnType<typeof computeEffectiveCarStats> | null = null;
    const getStats = () => {
      const p = propsRef.current;
      if (!statsCache || statsKey[0] !== p.selectedCar || statsKey[1] !== p.carUpgrades || statsKey[2] !== p.carCustom) {
        statsKey = [p.selectedCar, p.carUpgrades, p.carCustom];
        statsCache = computeEffectiveCarStats(p.selectedCar, p.carUpgrades, p.carCustom);
      }
      return statsCache;
    };

    const coinFrames = getCoinFrames();
    const baseDepth = cameraDepthFor(FIELD_OF_VIEW);
    const playerZ = CAMERA_HEIGHT * baseDepth;

    const resetRun = () => {
      const mode = propsRef.current.gameMode || 'drift';
      track = createTrack(mode, (Math.random() * 1e9) | 0);
      run = createRunState(mode);
      position = 0;
      speed = 0;
      playerX = mode === 'drift' ? 0 : laneCenter(1, track.lanes);
      drifting = false;
      driftHold = 0;
      driftBank = 0;
      traffic = [];
      particles = [];
      popups = [];
      crashed = false;
      crashTimer = 0;
      crashReason = '';
      gameOverSent = false;
      calloutText = mode === 'drift' ? 'DRIFT THE BENDS!' : 'WEAVE THROUGH TRAFFIC!';
      calloutTimer = 2;
      lastCheckpointIdx = 0;
      nextTrafficZ = SEGMENT_LENGTH * 30;
      hitStop = 0;
      shake = 0;
    };

    const callout = (text: string, t = 1.2) => {
      calloutText = text;
      calloutTimer = t;
    };

    const popup = (text: string, color: string, size = 1, y = H * 0.55) => {
      popups.push({ text, x: W / 2 + (Math.random() - 0.5) * W * 0.2, y, life: 1.1, color, size });
      if (popups.length > 14) popups.shift();
    };

    const burst = (x: number, y: number, n: number, color: string, speedMul = 1, size = 2, gravity = 140) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (40 + Math.random() * 140) * speedMul;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 40,
          life: 0.5 + Math.random() * 0.4,
          maxLife: 0.9,
          size: size + Math.random() * size,
          color,
          grow: 0,
          gravity,
        });
      }
    };

    const smoke = (x: number, y: number, color: string, n = 1) => {
      for (let i = 0; i < n; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 10,
          y,
          vx: (Math.random() - 0.5) * 30,
          vy: -10 - Math.random() * 25,
          life: 0.7,
          maxLife: 0.7,
          size: 3 + Math.random() * 3,
          color,
          grow: 14,
          gravity: -10,
        });
      }
    };

    // ------------------------------------------------------------ sky caches
    let skyKey = '';
    let skyGrad: CanvasGradient | null = null;
    let biome: RoadBiomeConfig = resolveRoadBiome(propsRef.current.roadMode || 'alpine', 0);
    let sky: SkyAtmosphereConfig = resolveSkyAtmosphere(propsRef.current.skyMode || 'auto', biome);
    const celestial = document.createElement('canvas');
    const clouds = Array.from({ length: ANIME_CLOUD_COUNT }, () => document.createElement('canvas'));
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), t: Math.random() * 6 }));

    const horizonRatio = () => (W / H < 0.8 ? 0.44 : 0.5);

    const ensureSky = () => {
      const key = `${biome.id}:${sky.id}:${W}:${H}`;
      if (key === skyKey) return;
      skyKey = key;
      const hy = H * horizonRatio();
      skyGrad = ctx.createLinearGradient(0, 0, 0, hy);
      skyGrad.addColorStop(0, sky.skyStops[0]);
      skyGrad.addColorStop(0.6, sky.skyStops[1]);
      skyGrad.addColorStop(1, sky.skyStops[2]);
      renderCelestialSprite(celestial, sky);
      const sunRight = sky.celestialXRatio >= 0.5;
      clouds.forEach((c, i) => renderAnimeCloudSprite(c, i, sky.clouds, sunRight));
    };

    // --------------------------------------------------------------- spawning
    const spawnTraffic = () => {
      const mode = track.mode;
      const want = mode === 'highway_traffic' ? 14 : 4;
      const ahead = position + playerZ;
      compact(traffic, (c) => c.z > position - SEGMENT_LENGTH * 4);
      if (nextTrafficZ < ahead + SEGMENT_LENGTH * 20) nextTrafficZ = ahead + SEGMENT_LENGTH * 20;
      while (traffic.length < want) {
        const lane = Math.floor(Math.random() * track.lanes);
        const x = laneCenter(lane, track.lanes);
        const progress = Math.min(1, run.distance / 6000);
        const gap = SEGMENT_LENGTH * (mode === 'highway_traffic' ? lerp(16, 8, progress) : 45) * (0.6 + Math.random() * 0.8);
        nextTrafficZ += gap;
        traffic.push({
          z: nextTrafficZ,
          x,
          targetX: x,
          speed: maxSpeedFor(22) * (0.32 + Math.random() * 0.28),
          kind: TRAFFIC_KINDS[Math.floor(Math.random() * TRAFFIC_KINDS.length)],
          color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
          passed: false,
        });
      }
    };

    // ------------------------------------------------------------------ update
    const update = (dtRaw: number, phase: GamePhase) => {
      const p = propsRef.current;
      const stats = getStats();
      const playing = phase === 'playing' && !crashed;
      const attract = phase === 'title' || phase === 'gameover';

      // hit-stop / slow-mo
      let dt = dtRaw;
      if (hitStop > 0) {
        hitStop -= dtRaw;
        dt = dtRaw * 0.15;
      }

      const isFever = run.feverTimer > 0;
      const boosting = run.boostTimer > 0;
      const maxSpeed = maxSpeedFor(stats.topSpeed);

      // ---- input
      let steer = 0;
      if (playing) {
        if (keys.left) steer -= 1;
        if (keys.right) steer += 1;
        if (steer === 0 && p.steerHold) steer = p.steerHold;
        if (pending.current.boost) {
          pending.current.boost = false;
          if (run.boostTimer <= 0 && run.nitro >= 30) {
            run.nitro -= 30;
            run.boostTimer = 2.2;
            fovKick = 1;
            shake = Math.max(shake, 4);
            callout('NITRO!', 0.9);
            soundFX.playStyleSwitch(run.combo);
          } else if (run.nitro < 30) {
            callout('NITRO EMPTY', 0.6);
          }
        }
        if (pending.current.flash || pending.current.horn) {
          const isFlash = pending.current.flash;
          pending.current.flash = pending.current.horn = false;
          if (isFlash) {
            soundFX.playHeadlightFlash();
            flashFx = 0.35;
          } else {
            soundFX.playHorn(p.carCustom?.horn || 'stock');
          }
          const reach = SEGMENT_LENGTH * (isFlash ? 40 : 22);
          let best: TrafficCar | null = null;
          for (const c of traffic) {
            const dz = c.z - (position + playerZ);
            if (dz > 0 && dz < reach && Math.abs(c.x - playerX) < 0.45 && (!best || c.z < best.z)) best = c;
          }
          if (best) {
            const lanes = track.lanes;
            const options = Array.from({ length: lanes }, (_, i) => laneCenter(i, lanes)).filter(
              (lx) => Math.abs(lx - playerX) > 0.5
            );
            best.targetX = options.sort((a, b) => Math.abs(a - best!.x) - Math.abs(b - best!.x))[0] ?? best.x;
            bumpCombo(run);
            callout(isFlash ? 'FLASH · MOVE OVER!' : 'HORN · MAKE WAY!', 0.9);
            soundFX.playTrafficYieldChime();
          }
        }
      } else if (attract) {
        // autopilot: lean into curves and dodge traffic
        const seg = findSegment(track, position + playerZ);
        let aim = clamp(seg.curve * 0.08, -0.6, 0.6);
        for (const c of traffic) {
          const dz = c.z - (position + playerZ);
          if (dz > 0 && dz < SEGMENT_LENGTH * 12 && Math.abs(c.x - playerX) < 0.4) aim = c.x > 0 ? -0.55 : 0.55;
        }
        steer = clamp((aim - playerX) * 3, -1, 1);
        pending.current.boost = pending.current.flash = pending.current.horn = false;
      }
      steerSmooth = lerp(steerSmooth, steer, Math.min(1, dt * 10));

      // ---- speed
      const playerSeg = findSegment(track, position + playerZ);
      const offRoad = Math.abs(playerX) > 1;
      let target = attract ? maxSpeed * 0.82 : maxSpeed;
      if (boosting) target *= 1.38;
      if (isFever) target *= 1.15;
      if (drifting) target *= 0.94;
      if (offRoad) target = Math.min(target, maxSpeed * 0.42);
      if (crashed) target = 0;
      if (phase === 'gameover' && !crashed) target = maxSpeed * 0.6;
      const accel = (speed < target ? maxSpeed / 2.6 : maxSpeed / 1.3) * dt;
      speed = speed < target ? Math.min(target, speed + accel) : Math.max(target, speed - accel);
      const speedRatio = speed / maxSpeed;

      // ---- lateral
      const intoCurve = Math.abs(playerSeg.curve) > 1.6 && Math.sign(steerSmooth) === Math.sign(playerSeg.curve) && Math.abs(steerSmooth) > 0.4;
      const wantDrift = !attract && playing && intoCurve && speedRatio > 0.55;
      if (wantDrift) driftHold += dt;
      else driftHold = 0;
      const wasDrifting = drifting;
      drifting = driftHold > 0.12;
      playerX = stepLateral({
        x: playerX,
        speedRatio,
        steer: steerSmooth,
        curve: playerSeg.curve,
        dt,
        handling: stats.handlingRate,
        drifting,
        assist: 0.5,
      }).x;

      // ---- guardrails
      if (bumpCooldown > 0) bumpCooldown -= dt;
      if (Math.abs(playerX) > 1.28) {
        playerX = Math.sign(playerX) * 1.2;
        if (playing && bumpCooldown <= 0) {
          bumpCooldown = 0.5;
          speed *= 0.62;
          shake = Math.max(shake, 7);
          hitStop = 0.06;
          if (run.combo > 1) callout('COMBO LOST', 0.9);
          run.combo = 1;
          run.comboTimer = 0;
          burst(playerX > 0 ? W * 0.72 : W * 0.28, H * 0.86, 18, '#fde047', 1.4, 1.5);
          soundFX.playGuardrailSpark();
        }
      }

      // ---- advance
      position += speed * dt;
      skyOffset += playerSeg.curve * speedRatio * dt * 0.012;
      wheelPhase += speedRatio * dt * 30;
      if (offRoad && speedRatio > 0.2) {
        shake = Math.max(shake, 1.5);
        if (Math.random() < 0.6) smoke(W / 2 + (Math.random() - 0.5) * W * 0.2, H * 0.92, 'rgba(160,130,90,0.5)');
      }
      ensureTrackAhead(track, Math.floor((position + playerZ) / SEGMENT_LENGTH) + DRAW_DISTANCE + 2);
      pruneTrackBehind(track, Math.floor(position / SEGMENT_LENGTH) - 8);
      if (attract && position > SEGMENT_LENGTH * 6000) {
        // keep the idle title-screen demo from growing the road forever
        track = createTrack(track.mode, (Math.random() * 1e9) | 0);
        position = 0;
        traffic = [];
        nextTrafficZ = SEGMENT_LENGTH * 30;
      }

      // ---- traffic
      spawnTraffic();
      const playerWorldZ = position + playerZ;
      const prevPlayerWorldZ = playerWorldZ - speed * dt;
      let slipCandidate = false;
      for (const c of traffic) {
        const prevDz = c.z - prevPlayerWorldZ;
        c.z += c.speed * dt;
        c.x = lerp(c.x, c.targetX, Math.min(1, dt * 2.2));
        const dz = c.z - playerWorldZ;
        // collision (swept along z so a big frame step can't skip through a car)
        if (!crashed && !attract && sweptOverlapZ(prevDz, dz, SEGMENT_LENGTH * 0.9) && carsOverlap(playerX, PLAYER_HALF_W * 2, c.x, PLAYER_HALF_W * 2, 0.78)) {
          if (track.mode === 'highway_traffic' && run.feverTimer <= 0) {
            crashed = true;
            crashReason = 'Traffic Collision';
            crashTimer = 1.1;
            hitStop = 0.5;
            shake = 14;
            flashFx = 0.6;
            burst(W / 2, H * 0.8, 40, '#f97316', 1.8, 2.5);
            burst(W / 2, H * 0.8, 24, '#e2e8f0', 1.2, 2);
            soundFX.playFallAndDestroy();
          } else {
            // fever smash / drift-mode bump
            const smash = run.feverTimer > 0;
            c.z += SEGMENT_LENGTH * 2;
            c.speed = speed * (smash ? 1.25 : 1.05);
            c.targetX = c.x + (c.x >= playerX ? 0.9 : -0.9);
            speed *= smash ? 0.95 : 0.55;
            shake = Math.max(shake, smash ? 6 : 9);
            hitStop = 0.08;
            burst(W / 2, H * 0.78, 22, smash ? '#22d3ee' : '#fde047', 1.5, 2);
            if (smash) {
              run.score += 500 * run.combo;
              popup('SMASH +' + 500 * run.combo, '#22d3ee', 1.3);
              soundFX.playOvertake(run.combo);
            } else {
              run.combo = 1;
              run.comboTimer = 0;
              callout('BUMP!', 0.7);
              soundFX.playGuardrailSpark();
            }
          }
        }
        // slipstream: right behind a car
        if (dz > SEGMENT_LENGTH && dz < SEGMENT_LENGTH * 7 && Math.abs(c.x - playerX) < 0.22) slipCandidate = true;
        // pass detection
        if (!c.passed && dz < -SEGMENT_LENGTH * 0.6) {
          c.passed = true;
          if (!attract && playing) {
            const gap = Math.abs(c.x - playerX);
            run.overtakes++;
            if (gap < 0.62) {
              run.nearMisses++;
              bumpCombo(run, 2);
              run.nitro = Math.min(100, run.nitro + 14);
              const pts = 250 * run.combo * (isFever ? 2 : 1);
              run.score += pts;
              popup(`NEAR MISS +${pts}`, '#f472b6', 1.2);
              callout(run.combo >= 8 ? 'UNSTOPPABLE!' : 'NEAR MISS!', 0.8);
              if (addFever(run, 18 * stats.feverGainRate)) startFever();
              shake = Math.max(shake, 3);
              hitStop = Math.max(hitStop, 0.035);
              soundFX.playNearMiss(false);
            } else {
              bumpCombo(run);
              const pts = 80 * run.combo * (isFever ? 2 : 1);
              run.score += pts;
              popup(`+${pts}`, '#a5f3fc', 0.9);
              if (addFever(run, 6 * stats.feverGainRate)) startFever();
              soundFX.playOvertake(run.combo);
            }
          }
        }
      }
      if (playing && slipCandidate) {
        slipTimer += dt;
        if (slipTimer > 0.6) {
          speed = Math.min(speed + maxSpeed * 0.25 * dt, maxSpeed * 1.25);
          run.nitro = Math.min(100, run.nitro + 6 * dt);
          if (slipTimer - dt <= 0.6) {
            callout('SLIPSTREAM!', 0.8);
            soundFX.playSlipstreamPass(run.combo);
          }
        }
      } else slipTimer = 0;

      // ---- coins (collected when they reach the car)
      if (!attract) {
        const fromIdx = Math.floor((playerWorldZ - speed * dt) / SEGMENT_LENGTH);
        const toIdx = Math.floor(playerWorldZ / SEGMENT_LENGTH);
        const magnet = stats.magnetRadius * 0.075 + (isFever ? 0.35 : 0);
        for (let i = Math.max(0, fromIdx); i <= toIdx; i++) {
          const coin = track.segments[i]?.coin;
          if (coin && !coin.taken && Math.abs(coin.offset - playerX) < magnet) {
            coin.taken = true;
            if (coin.star) {
              run.coins += 5 * stats.coinMultiplier;
              run.score += 400 * run.combo;
              if (addFever(run, 35)) startFever();
              popup('★ STAR +5 CR', '#f0abfc', 1.3);
              burst(W / 2, H * 0.78, 16, '#f0abfc', 1, 2, 60);
              soundFX.playStarPickup();
            } else {
              run.coins += 1 * stats.coinMultiplier;
              run.score += 40 * run.combo;
              run.nitro = Math.min(100, run.nitro + 2);
              if (addFever(run, 2.5)) startFever();
              burst(W / 2, H * 0.8, 6, '#fde047', 0.6, 1.5, 60);
              soundFX.playCoinPickup(run.combo);
            }
          }
        }
      }

      // ---- drifting score
      if (drifting && playing) {
        run.driftTime += dt;
        const pts = dt * speedRatio * Math.abs(playerSeg.curve) * 70 * run.combo * (isFever ? 2 : 1);
        driftBank += pts;
        run.nitro = Math.min(100, run.nitro + 9 * dt);
        if (addFever(run, 9 * dt * stats.feverGainRate)) startFever();
        if (Math.random() < 0.9) {
          const side = Math.sign(playerSeg.curve);
          smoke(W / 2 - side * W * 0.08, H * 0.93, isFever ? 'rgba(34,211,238,0.55)' : 'rgba(235,235,245,0.6)', 2);
        }
        if (Math.floor(run.driftTime / 1.1) !== Math.floor((run.driftTime - dt) / 1.1)) {
          bumpCombo(run);
          soundFX.playDriftFlip(run.combo, isFever);
        } else run.comboTimer = Math.max(run.comboTimer, 1.5);
      }
      if (wasDrifting && !drifting && driftBank > 0) {
        const banked = Math.round(driftBank);
        run.score += banked;
        popup(`DRIFT +${banked}`, '#fbbf24', banked > 2000 ? 1.5 : 1.1);
        if (banked > 1500) callout(banked > 5000 ? 'LEGENDARY DRIFT!' : 'GREAT DRIFT!', 1);
        driftBank = 0;
      }
      if (!drifting) run.driftTime = 0;

      // ---- distance score, checkpoints, biome
      if (playing) {
        const meters = (speed * dt) / UNITS_PER_METER;
        run.distance += meters;
        run.score += meters * 10 * run.combo * (isFever ? 2 : 1);
        const segIdx = playerSeg.index;
        if (segIdx > lastCheckpointIdx && playerSeg.checkpoint) {
          lastCheckpointIdx = segIdx;
          run.checkpoints++;
          if (track.mode === 'drift') {
            const bonus = Math.max(12, 24 - run.checkpoints * 2);
            run.timeLeft += bonus;
            popup(`+${bonus.toFixed(0)}s`, '#4ade80', 1.6, H * 0.35);
          }
          run.score += 1000 * run.checkpoints;
          callout(`CHECKPOINT ${run.checkpoints}`, 1.4);
          flashFx = 0.25;
          soundFX.playMilestone();
        }
        stepTimers(run, dt);
        if (track.mode === 'drift' && run.timeLeft <= 0 && !crashed) {
          crashed = true;
          crashReason = 'Time Up';
          crashTimer = 1.2;
          hitStop = 0.4;
          callout('TIME UP!', 2);
          soundFX.playFallAndDestroy();
        }
        // passive nitro trickle
        run.nitro = Math.min(100, run.nitro + 1.5 * dt);
      } else if (!attract) {
        // keep fever/boost timers frozen while crashed, but let effects decay
      }

      const newBiome = resolveRoadBiome(p.roadMode || 'alpine', run.distance);
      if (newBiome.id !== biome.id || p.skyMode !== lastSkyMode) {
        biome = newBiome;
        lastSkyMode = p.skyMode;
        sky = resolveSkyAtmosphere(p.skyMode || 'auto', biome);
        if (playing && run.distance > 10) {
          callout(biome.name.toUpperCase(), 1.6);
          flashFx = 0.4;
        }
      }

      // ---- crash → game over
      if (crashed) {
        crashTimer -= dtRaw;
        if (crashTimer <= 0 && !gameOverSent && phase === 'playing') {
          gameOverSent = true;
          p.onGameOver({
            score: Math.round(run.score),
            distance: Math.round(run.distance),
            maxCombo: run.maxCombo,
            coinsCollected: Math.round(run.coins),
            overtakes: run.overtakes,
            nearMisses: run.nearMisses,
            crashReason,
          });
        }
      }

      // ---- effects decay
      shake = Math.max(0, shake - dtRaw * 22);
      flashFx = Math.max(0, flashFx - dtRaw * 1.6);
      fovKick = Math.max(boosting ? 0.6 : 0, fovKick - dtRaw * 1.5);
      if (calloutTimer > 0) calloutTimer -= dtRaw;
      for (const pt of particles) {
        pt.life -= dtRaw;
        pt.x += pt.vx * dtRaw;
        pt.y += pt.vy * dtRaw;
        pt.vy += pt.gravity * dtRaw;
        pt.size += pt.grow * dtRaw;
      }
      compact(particles, (pt) => pt.life > 0);
      if (particles.length > 260) particles.splice(0, particles.length - 260);
      for (const pu of popups) {
        pu.life -= dtRaw;
        pu.y -= 34 * dtRaw;
      }
      compact(popups, (pu) => pu.life > 0);

      // ---- audio
      if (playing) {
        soundFX.updateEngineSound({
          active: true,
          speedRatio: clamp(0.3 + speedRatio * 1.05, 0.3, 1.6),
          isGassing: true,
          isBraking: false,
          isFever,
          soundProfile: p.carCustom?.sound,
        });
      } else if (phase !== 'paused') {
        soundFX.stopEngineSound();
      }
      soundFX.updateMusicEffects({
        phase,
        speedRatio: clamp(speedRatio * (boosting ? 1.3 : 1), 0.35, 1.65),
        isDrifting: drifting,
        driftFactor: drifting ? 1 : 0,
        isFever,
        isBraking: false,
        isNearEdge: Math.abs(playerX) > 0.95,
      });

      // ---- telemetry (~10 Hz)
      telemetryTimer -= dtRaw;
      if (telemetryTimer <= 0 && phase === 'playing') {
        telemetryTimer = 0.1;
        p.onTelemetryUpdate({
          score: Math.round(run.score + driftBank),
          distance: Math.round(run.distance),
          combo: run.combo,
          maxCombo: run.maxCombo,
          coinsRun: Math.round(run.coins),
          fever: run.feverTimer > 0 ? (run.feverTimer / FEVER_DURATION) * 100 : run.fever,
          isFever: run.feverTimer > 0,
          speedKmh: speedToKmh(speed),
          direction: steerSmooth >= 0 ? 'right' : 'left',
          nearMissText: calloutTimer > 0 ? calloutText : '',
          isDrifting: drifting,
          biomeName: biome.name,
          overtakes: run.overtakes,
          nearMisses: run.nearMisses,
          nitro: run.nitro,
          timeLeft: Number.isFinite(run.timeLeft) ? run.timeLeft : undefined,
        });
      }
    };
    let lastSkyMode = propsRef.current.skyMode;

    function startFever() {
      callout('FEVER MODE!', 1.6);
      flashFx = 0.5;
      shake = Math.max(shake, 5);
      popup('x2 SCORE', '#22d3ee', 1.6, H * 0.4);
      soundFX.playFeverBurst();
    }

    // ------------------------------------------------------------------ render
    const drawPoly = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.closePath();
      ctx.fill();
    };

    const fogColor = () => sky.skyStops[2];
    let fogCacheKey = '';
    const fogStyles: string[] = new Array(DRAW_DISTANCE);

    const drawSprite = (
      img: CanvasImageSource & { width: number; height: number },
      worldW: number,
      scale: number,
      sx: number,
      sy: number,
      clipY: number,
      offsetX = -0.5,
      alpha = 1
    ) => {
      const destW = worldW * scale * (W / 2);
      if (destW < 1) return;
      const destH = destW * (img.height / img.width);
      const dx = sx + destW * offsetX;
      const dy = sy - destH;
      const clipH = clipY ? Math.max(0, dy + destH - clipY) : 0;
      if (clipH >= destH) return;
      const srcH = img.height * (1 - clipH / destH);
      if (alpha < 1) ctx.globalAlpha = alpha;
      ctx.drawImage(img, 0, 0, img.width, srcH, dx, dy, destW, destH - clipH);
      if (alpha < 1) ctx.globalAlpha = 1;
    };

    const render = (time: number, phase: GamePhase) => {
      const p = propsRef.current;
      ensureSky();
      const horizon = H * horizonRatio();
      const isFever = run.feverTimer > 0;
      const boosting = run.boostTimer > 0;
      const maxSpeed = maxSpeedFor(getStats().topSpeed);
      const speedRatio = speed / maxSpeed;

      ctx.save();
      if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake));

      // ---- sky
      ctx.fillStyle = skyGrad!;
      ctx.fillRect(-20, -20, W + 40, horizon + 40);
      if (sky.isNight) {
        for (const s of stars) {
          const tw = 0.5 + 0.5 * Math.sin(time * 0.002 + s.t);
          ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.6})`;
          ctx.fillRect(((s.x * W - skyOffset * 20) % W + W) % W, s.y * horizon * 0.8, 1, 1);
        }
      }
      if (celestial.width) {
        const cs = Math.max(0.5, Math.min(1.4, W / 360));
        const cw = celestial.width * cs;
        const cx = ((sky.celestialXRatio * W - skyOffset * 40) % (W + cw) + (W + cw)) % (W + cw) - cw / 2;
        ctx.drawImage(celestial, cx - cw / 2, sky.celestialYRatio * horizon - cw / 2, cw, cw);
      }
      clouds.forEach((c, i) => {
        if (!c.width) return;
        const span = W + c.width * 2;
        const cx = (((i * 173 + time * 0.004 * (i + 1)) - skyOffset * (60 + i * 15)) % span + span) % span - c.width;
        const cy = horizon * (0.12 + ((i * 37) % 50) / 100);
        ctx.globalAlpha = 0.92;
        ctx.drawImage(c, Math.round(cx), Math.round(cy));
        ctx.globalAlpha = 1;
      });
      // backdrop layers
      const bgW = 1024;
      const far = getBackdropLayer(biome, 0, sky.mtnFar, bgW);
      const near = getBackdropLayer(biome, 1, sky.mtnNear, bgW);
      const playerSeg = findSegment(track, position + playerZ);
      const hillLift = clamp((playerSeg.y1 - findSegment(track, position + playerZ + SEGMENT_LENGTH * 40).y1) / 120, -18, 18);
      for (const [layer, factor, lift] of [[far, 140, 0.35], [near, 260, 0.6]] as const) {
        const ox = ((-skyOffset * factor) % layer.width + layer.width) % layer.width;
        const ly = Math.round(horizon - layer.height + 2 + hillLift * lift);
        ctx.drawImage(layer, -ox, ly);
        ctx.drawImage(layer, layer.width - ox, ly);
      }
      // horizon glow
      const hg = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 4);
      hg.addColorStop(0, 'rgba(0,0,0,0)');
      hg.addColorStop(1, sky.horizonGlowColor || fogColor());
      ctx.fillStyle = hg;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, horizon - 30, W, 34);
      ctx.globalAlpha = 1;

      // ---- road
      const baseSeg = findSegment(track, position);
      const basePercent = (position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
      const playerPercent = ((position + playerZ) % SEGMENT_LENGTH) / SEGMENT_LENGTH;
      const playerY = lerp(playerSeg.y1, playerSeg.y2, playerPercent);
      const camDepth = cameraDepthFor(FIELD_OF_VIEW + fovKick * 14 + (isFever ? 6 : 0));
      const camY = playerY + CAMERA_HEIGHT;
      let maxY = H;
      let x = 0;
      let dx = -(baseSeg.curve * basePercent);
      const projs: { x1: number; y1: number; w1: number; x2: number; y2: number; w2: number; s2: number; clip: number; camX: number }[] = [];
      const fogKey = fogColor();
      if (fogKey !== fogCacheKey) {
        fogCacheKey = fogKey;
        const fog = hexToRgb(fogKey.startsWith('#') ? fogKey : '#9ca3af');
        for (let n = 0; n < DRAW_DISTANCE; n++) {
          const fogT = clamp(n / DRAW_DISTANCE, 0, 1) ** 1.6;
          fogStyles[n] = `rgba(${fog[0]},${fog[1]},${fog[2]},${fogT * 0.85})`;
        }
      }
      const valley = biome.valleyStops;
      const feverHue = (time * 0.25) % 360;

      for (let n = 0; n < DRAW_DISTANCE; n++) {
        const seg = track.segments[baseSeg.index + n];
        const camX = playerX * ROAD_WIDTH - x;
        const p1 = projectPoint(0, seg.y1, seg.z, camX, camY, position, camDepth, W, H, ROAD_WIDTH, horizon);
        const p2 = projectPoint(0, seg.y2, seg.z + SEGMENT_LENGTH, camX - dx, camY, position, camDepth, W, H, ROAD_WIDTH, horizon);
        x += dx;
        dx += seg.curve;
        projs[n] = { x1: p1.x, y1: p1.y, w1: p1.w, x2: p2.x, y2: p2.y, w2: p2.w, s2: p2.scale, clip: maxY, camX };
        if (p1.y <= p2.y || p2.y >= maxY) continue;

        const band = Math.floor(seg.index / RUMBLE_LENGTH) % 2;
        const fogT = clamp(n / DRAW_DISTANCE, 0, 1) ** 1.6;
        const y1 = Math.min(p1.y, maxY);
        // ground
        ctx.fillStyle = band ? valley[1] : valley[2];
        ctx.fillRect(0, p2.y, W, y1 - p2.y + 1);
        const r1 = p1.w / 6;
        const r2 = p2.w / 6;
        // rumble / curbs
        drawPoly(p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, band ? biome.curbA : biome.curbB);
        drawPoly(p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, band ? biome.curbA : biome.curbB);
        // asphalt
        drawPoly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, band ? biome.asphaltEven : biome.asphaltOdd);
        // edge lines
        const e1 = p1.w / 40;
        const e2 = p2.w / 40;
        drawPoly(p1.x - p1.w, p1.y, p1.x - p1.w + e1, p1.y, p2.x - p2.w + e2, p2.y, p2.x - p2.w, p2.y, biome.edgeStripe);
        drawPoly(p1.x + p1.w - e1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w - e2, p2.y, biome.edgeStripe);
        // lane dashes
        if (band) {
          const lanes = track.lanes;
          const l1 = p1.w / 32;
          const l2 = p2.w / 32;
          const laneColor = isFever ? `hsl(${(feverHue + n * 4) % 360},90%,65%)` : '#f1f5f9';
          for (let lane = 1; lane < lanes; lane++) {
            const lx1 = p1.x - p1.w + (p1.w * 2 * lane) / lanes;
            const lx2 = p2.x - p2.w + (p2.w * 2 * lane) / lanes;
            drawPoly(lx1 - l1 / 2, p1.y, lx1 + l1 / 2, p1.y, lx2 + l2 / 2, p2.y, lx2 - l2 / 2, p2.y, laneColor);
          }
        }
        if (seg.checkpoint) {
          drawPoly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, 'rgba(250,250,250,0.85)');
        }
        // fog
        if (fogT > 0.02) {
          ctx.fillStyle = fogStyles[n];
          ctx.fillRect(0, p2.y, W, y1 - p2.y + 1);
        }
        maxY = p2.y;
      }

      // ---- sprites, back to front
      const coinFrame = coinFrames[Math.floor(time / 70) % coinFrames.length];
      const isNight = sky.isNight || biome.isNight;
      for (let n = DRAW_DISTANCE - 1; n > 0; n--) {
        const seg = track.segments[baseSeg.index + n];
        const pr = projs[n];
        if (!pr) continue;
        const scale = pr.s2 ? cameraDepthFor(FIELD_OF_VIEW + fovKick * 14 + (isFever ? 6 : 0)) / Math.max(1, seg.z - position) : 0;
        const sx = pr.x1;
        const sy = pr.y1;
        const fogA = n > DRAW_DISTANCE * 0.75 ? 1 - (n - DRAW_DISTANCE * 0.75) / (DRAW_DISTANCE * 0.25) : 1;
        const toScreenX = (off: number) => sx + scale * off * ROAD_WIDTH * (W / 2);
        for (const prop of seg.props) {
          let img: HTMLCanvasElement;
          let ww = 900;
          if (prop.kind === 'tree') {
            img = getTreeSprite(biome, prop.variant);
            ww = biome.propStyle === 'tower' ? 1500 : 1300;
          } else if (prop.kind === 'rock') {
            img = getRockSprite(biome);
            ww = 900;
          } else if (prop.kind === 'lamp') {
            img = getLampSprite(biome);
            ww = 330;
          } else if (prop.kind === 'sign') {
            img = getSignSprite(biome, prop.variant === 1);
            ww = 620;
          } else if (prop.kind === 'gantry') {
            img = getGantrySprite(biome, prop.variant);
            ww = ROAD_WIDTH * 2.5;
          } else {
            img = getCheckpointSprite();
            ww = ROAD_WIDTH * 2.5;
          }
          const ox = toScreenX(prop.offset);
          drawSprite(img, ww, scale, ox, sy, pr.clip, -0.5, fogA);
          if (isNight && prop.kind === 'lamp' && n < 120) {
            const gw = 700 * scale * (W / 2);
            const g = ctx.createRadialGradient(ox, sy - gw * 3.6, 0, ox, sy - gw * 3.6, gw);
            g.addColorStop(0, 'rgba(255,230,160,0.35)');
            g.addColorStop(1, 'rgba(255,230,160,0)');
            ctx.fillStyle = g;
            ctx.fillRect(ox - gw, sy - gw * 4.6, gw * 2, gw * 2);
          }
        }
        if (seg.coin && !seg.coin.taken) {
          const bob = Math.sin(time * 0.006 + seg.index) * 0.15;
          const img = seg.coin.star ? getStarSprite() : coinFrame;
          drawSprite(img, seg.coin.star ? 360 : 280, scale, toScreenX(seg.coin.offset), sy - scale * (220 + bob * 200) * (H / 2), pr.clip, -0.5, fogA);
        }
        for (const c of traffic) {
          const ci = Math.floor(c.z / SEGMENT_LENGTH);
          if (ci !== seg.index) continue;
          const pct = (c.z % SEGMENT_LENGTH) / SEGMENT_LENGTH;
          const cScale = lerp(scale, pr.s2, pct);
          const cy = lerp(pr.y1, pr.y2, pct);
          const cx = lerp(pr.x1, pr.x2, pct) + cScale * c.x * ROAD_WIDTH * (W / 2);
          const view = clamp((cx - W / 2) / (W / 2), -1, 1);
          const img = getTrafficVehicleCanvas(c.kind, c.color, false, view, isNight);
          // shadow
          const sw = CAR_WORLD_W * cScale * (W / 2);
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(cx - sw * 0.5, cy - sw * 0.06, sw, sw * 0.08);
          drawSprite(img, CAR_WORLD_W / SPRITE_FILL, cScale, cx, cy + sw * 0.18, pr.clip, -0.5, fogA);
        }
      }

      // ---- player
      const heroDrift = drifting ? Math.sign(playerSeg.curve) * 0.85 : clamp(steerSmooth * 0.35, -0.4, 0.4);
      let hero: CanvasImageSource & { width: number; height: number } = getPixelCarCanvas(
        p.selectedCar,
        heroDrift,
        isFever,
        crashed && crashReason !== 'Time Up',
        wheelPhase,
        p.carCustom,
        boosting ? 'gas' : 'coast',
        flashFx > 0.2
      );
      if (p.customSpriteUrl) {
        if (customImgUrl !== p.customSpriteUrl) {
          customImgUrl = p.customSpriteUrl;
          customImg = new Image();
          customImg.src = p.customSpriteUrl;
        }
        if (customImg && customImg.complete && customImg.naturalWidth) hero = customImg;
      }
      const heroW = Math.min(W * 0.62, Math.max(W * 0.34, H * 0.42));
      const heroH = heroW * (hero.height / hero.width);
      const bounce = speedRatio > 0.1 ? Math.round(Math.sin(time * 0.05) * (Math.abs(playerX) > 1 ? 2 : 0.6)) : 0;
      const heroX = W / 2 - heroW / 2;
      const heroY = H * 0.86 - heroH + bounce;
      // shadow + underglow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(W / 2, heroY + heroH * 0.86, heroW * 0.36, heroH * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      if (isFever || boosting) {
        const glow = ctx.createRadialGradient(W / 2, heroY + heroH * 0.8, 2, W / 2, heroY + heroH * 0.8, heroW * 0.6);
        glow.addColorStop(0, isFever ? 'rgba(34,211,238,0.45)' : 'rgba(96,165,250,0.4)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, heroY, W, heroH);
      }
      ctx.drawImage(hero, Math.round(heroX), Math.round(heroY), Math.round(heroW), Math.round(heroH));
      // exhaust flames on boost
      if (boosting && phase === 'playing') {
        for (const side of [-1, 1]) {
          const fx = W / 2 + side * heroW * 0.17;
          const fy = heroY + heroH * 0.74;
          const fl = 6 + Math.random() * 10;
          ctx.fillStyle = Math.random() < 0.5 ? '#60a5fa' : '#f0f9ff';
          ctx.beginPath();
          ctx.moveTo(fx - 3, fy);
          ctx.lineTo(fx + 3, fy);
          ctx.lineTo(fx, fy + fl);
          ctx.fill();
        }
      }

      // ---- particles
      for (const pt of particles) {
        ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
        ctx.fillStyle = pt.color;
        if (pt.grow > 0) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(Math.round(pt.x), Math.round(pt.y), Math.ceil(pt.size), Math.ceil(pt.size));
      }
      ctx.globalAlpha = 1;

      // ---- speed lines
      const lineAmt = phase === 'playing' ? clamp((speedRatio - 0.85) * 3, 0, 1) + (boosting ? 0.8 : 0) + (isFever ? 0.4 : 0) : 0;
      if (lineAmt > 0) {
        const count = Math.floor(10 + lineAmt * 26);
        ctx.strokeStyle = isFever ? 'rgba(165,243,252,0.55)' : 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const r0 = (0.45 + Math.random() * 0.3) * Math.max(W, H);
          const r1 = r0 + (20 + Math.random() * 60) * lineAmt;
          ctx.moveTo(W / 2 + Math.cos(a) * r0, horizon + Math.sin(a) * r0 * 0.7);
          ctx.lineTo(W / 2 + Math.cos(a) * r1, horizon + Math.sin(a) * r1 * 0.7);
        }
        ctx.stroke();
      }

      // ---- popups
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const pu of popups) {
        const t = clamp(pu.life / 1.1, 0, 1);
        const pop = t > 0.85 ? 1 + (t - 0.85) * 3 : 1;
        const size = Math.round(Math.max(8, W / 32) * pu.size * pop);
        ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.fillStyle = '#0b1020';
        ctx.fillText(pu.text, pu.x + 1, pu.y + 1);
        ctx.fillStyle = pu.color;
        ctx.fillText(pu.text, pu.x, pu.y);
      }
      ctx.globalAlpha = 1;

      // ---- drift meter (live bank)
      if (driftBank > 0 && phase === 'playing') {
        const size = Math.round(Math.max(9, W / 26));
        ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
        ctx.fillStyle = '#0b1020';
        ctx.fillText(`DRIFT ${Math.round(driftBank)}`, W / 2 + 1, H * 0.3 + 1);
        ctx.fillStyle = `hsl(${40 + Math.sin(time * 0.02) * 15},95%,60%)`;
        ctx.fillText(`DRIFT ${Math.round(driftBank)}`, W / 2, H * 0.3);
      }
      ctx.restore();

      // ---- post fx
      if (isFever) {
        const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, `hsla(${feverHue},90%,55%,0.35)`);
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);
      } else if (boosting) {
        const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(37,99,235,0.3)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);
      }
      if (flashFx > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashFx * 0.6})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (crashed && crashReason !== 'Time Up') {
        ctx.fillStyle = 'rgba(127,29,29,0.18)';
        ctx.fillRect(0, 0, W, H);
      }
      // drift-mode low time warning
      if (phase === 'playing' && Number.isFinite(run.timeLeft) && run.timeLeft < 8 && !crashed) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 0.012);
        ctx.strokeStyle = `rgba(239,68,68,${0.35 + pulse * 0.4})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, W - 4, H - 4);
      }
      // scanline-free crisp upscale
      dctx.imageSmoothingEnabled = false;
      dctx.drawImage(buf, 0, 0, W, H, 0, 0, display.width, display.height);
    };

    // -------------------------------------------------------------------- loop
    let raf = 0;
    let last = performance.now();
    // Dev-only: `?bgloop` drives the loop via MessageChannel so automated checks
    // keep running in a hidden/background tab where rAF is paused.
    let schedule: (cb: (t: number) => void) => number = (cb) => requestAnimationFrame(cb);
    let stopped = false;
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('bgloop')) {
      const ch = new MessageChannel();
      let pendingCb: ((t: number) => void) | null = null;
      ch.port1.onmessage = () => {
        const cb = pendingCb;
        pendingCb = null;
        if (cb && !stopped) cb(performance.now());
      };
      schedule = (cb) => {
        pendingCb = cb;
        ch.port2.postMessage(0);
        return 0;
      };
    }
    const frame = (now: number) => {
      if (stopped) return;
      raf = schedule(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const phase = propsRef.current.gamePhase;
      if (pending.current.reset || (phase === 'playing' && (lastPhase === 'title' || lastPhase === 'gameover'))) {
        pending.current.reset = false;
        resetRun();
      }
      lastPhase = phase;
      if (phase !== 'paused') update(dt, phase);
      else soundFX.stopEngineSound();
      render(now, phase);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    raf = schedule(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      soundFX.stopEngineSound();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full block"
      style={{ imageRendering: 'pixelated', touchAction: 'none' }}
      data-testid="game-canvas"
    />
  );
});

SceneCanvas.displayName = 'SceneCanvas';
