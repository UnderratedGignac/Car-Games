/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NEON REDLINE pseudo-3D renderer (React + Canvas 2D).
 *
 * High-resolution pipeline: the scene renders into an internal buffer at
 * ~device pixels / 1.5 (capped at 1200px tall) and is presented with smooth
 * scaling. Pixel-art car sprites are pre-upscaled 2x (nearest) into a bounded
 * cache so bilinear downscaling keeps them crisp at any size.
 *
 * Depth cues: continuous guardrails (posts + rail + reflectors), per-segment
 * fog baked into colour lookup tables (no per-frame string churn), aerial
 * haze, scrolling ground/asphalt noise, three parallax backdrop layers with
 * haze between them, biome ambient particles, night headlight cones and neon
 * road-edge glow. Game rules/economy live in rules.ts + pseudoRoad.ts and are
 * untouched here.
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
import { getPixelCarCanvas, getTrafficVehicleCanvas, getPixelCarTireAnchors } from './pixelSprites';
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
  RoadSegment,
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
  projectPointF,
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
  getGlowSprite,
  getHeadlightCone,
  getNoiseTile,
  getPetalSprite,
  getShadowSprite,
  getSmokeSprite,
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
  puff?: 'white' | 'cyan' | 'dust';
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

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgbStr(c: [number, number, number]): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

interface Ambient {
  alive: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; phase: number; rot: number; vr: number;
}

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

    // Internal high-res buffer (~device px / 1.5, capped 1200px tall), presented with smooth scaling.
    const buf = document.createElement('canvas');
    const ctx = buf.getContext('2d', { alpha: false })!;
    let W = 400;
    let H = 400;
    let pixelScale = 2;

    const resize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      H = Math.min(1200, Math.max(480, Math.round((vh * dpr) / 1.5)));
      W = Math.max(2, Math.round((vw * H) / vh));
      pixelScale = 1;
      buf.width = W;
      buf.height = H;
      display.width = Math.round(vw * dpr);
      display.height = Math.round(vh * dpr);
      display.style.width = `${vw}px`;
      display.style.height = `${vh}px`;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      dctx.imageSmoothingEnabled = true;
      dctx.imageSmoothingQuality = 'high';
      skyKey = '';
      visualsKey = '';
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
    // visual-upgrade state
    let visualsKey = '';
    let heading = 0;
    let headingSmooth = 0;
    let leanSmooth = 0;
    let prevSpeed = 0;
    let calloutTotal = 1.2;
    let lastHeroW = 200;
    let lastHeroH = 150;
    let lastHeroCx = 240;
    let lastHeroTop = 600;
    let ambientKind = '';
    const ambient: Ambient[] = Array.from({ length: 36 }, () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 4, phase: 0, rot: 0, vr: 0,
    }));

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
      heading = 0;
      headingSmooth = 0;
      leanSmooth = 0;
      prevSpeed = 0;
      calloutTotal = 2;
      ambientKind = '';
      for (const a of ambient) a.alive = false;
    };

    const callout = (text: string, t = 1.2) => {
      calloutText = text;
      calloutTimer = t;
      calloutTotal = t;
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
    // soft sprite-based smoke puff (tyre drift / off-road dust)
    const puffAt = (x: number, y: number, vx: number, vy: number, tint: 'white' | 'cyan' | 'dust', size: number) => {
      particles.push({
        x, y, vx, vy,
        life: 0.55 + Math.random() * 0.3,
        maxLife: 0.85,
        size,
        color: '#ffffff',
        grow: size * 3.2,
        gravity: 0,
        puff: tint,
      });
      if (particles.length > 260) particles.splice(0, particles.length - 260);
    };
    const spawnAmbient = (a: Ambient, kind: string, k: number) => {
      a.alive = true;
      a.life = 0;
      a.phase = Math.random() * Math.PI * 2;
      a.rot = Math.random() * Math.PI * 2;
      a.vr = (Math.random() - 0.5) * 3;
      if (kind === 'petal') {
        a.x = Math.random() * W;
        a.y = -14;
        a.vx = 0;
        a.vy = (55 + Math.random() * 45) * k;
        a.size = (4.5 + Math.random() * 3.5) * k;
        a.maxLife = (H + 40) / a.vy;
      } else if (kind === 'embers') {
        a.x = Math.random() * W;
        a.y = H + 10;
        a.vx = 0;
        a.vy = -(35 + Math.random() * 45) * k;
        a.size = (2.5 + Math.random() * 3.5) * k;
        a.maxLife = 3.5 + Math.random() * 2.5;
      } else {
        a.x = Math.random() * W;
        a.y = Math.random() * H * 0.72;
        a.vx = (Math.random() - 0.5) * 16 * k;
        a.vy = (Math.random() - 0.5) * 12 * k;
        a.size = (4 + Math.random() * 7) * k;
        a.maxLife = 5 + Math.random() * 3;
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
      {
        const s0 = hexRgb(sky.skyStops[0]);
        const s1 = hexRgb(sky.skyStops[1]);
        const s2 = hexRgb(sky.skyStops[2]);
        const sm = (t: number) => t * t * (3 - 2 * t);
        for (const t of [0, 0.2, 0.4, 0.55, 0.7, 0.85, 1]) {
          const c = t < 0.6 ? mixRgb(s0, s1, sm(t / 0.6)) : mixRgb(s1, s2, sm((t - 0.6) / 0.4));
          skyGrad.addColorStop(t, rgbStr(c));
        }
      }
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
      heading += playerSeg.curve * speedRatio * dt * 0.055;
      headingSmooth += (heading - headingSmooth) * Math.min(1, dt * 2.5);
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
        if (Math.random() < dt * 40) {
          const anchors = getPixelCarTireAnchors(p.selectedCar, 0.85, p.carCustom);
          const a = Math.random() < 0.5 ? anchors.rearLeft : anchors.rearRight;
          const hx = lastHeroCx - lastHeroW / 2;
          puffAt(
            hx + a.u * lastHeroW, lastHeroTop + a.v * lastHeroH,
            (a.u - 0.5) * 60 - steerSmooth * 40, (45 + Math.random() * 55) * (H / 800),
            isFever ? 'cyan' : 'white', (5 + Math.random() * 4) * (H / 800)
          );
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
      // visual-upgrade updates: steering lean, brake-light speed memory,
      // ambient biome particles
      leanSmooth += (steerSmooth - leanSmooth) * Math.min(1, dtRaw * 6);
      prevSpeed = speed;
      {
        const vk = H / 800;
        const ambKind = biome.ambientParticle;
        if (ambKind !== ambientKind) {
          ambientKind = ambKind;
          for (const a of ambient) a.alive = false;
        }
        const ambTarget = ambKind === 'petal' ? 26 : ambKind === 'embers' ? 22 : ambKind === 'neon_orb' ? 16 : 0;
        for (let i = 0; i < ambient.length; i++) {
          const a = ambient[i];
          if (!a.alive) {
            if (i < ambTarget) spawnAmbient(a, ambKind, vk);
            continue;
          }
          a.life += dtRaw;
          if (a.life >= a.maxLife || a.y > H + 30 || a.y < -50) { a.alive = false; continue; }
          if (ambKind === 'petal') {
            a.x += Math.sin(a.phase + a.life * 2.2) * 34 * vk * dtRaw;
            a.y += a.vy * dtRaw;
            a.rot += a.vr * dtRaw;
          } else if (ambKind === 'embers') {
            a.x += Math.sin(a.phase + a.life * 3) * 18 * vk * dtRaw;
            a.y += a.vy * dtRaw;
          } else {
            a.x += a.vx * dtRaw;
            a.y += a.vy * dtRaw;
          }
        }
      }
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
    // High-resolution pipeline: colours are pre-fogged into lookup tables per
    // biome/sky so the hot loop never builds strings; geometry pools are reused
    // every frame; sprites scale through a bounded 2x pre-upscale cache.

    const coinWorldSize = (star: boolean): number => (star ? 360 : 280);

    const FOG_STEPS = 24;
    const FOG_MAX = 0.92;
    const RAIL_X = 1.26;   // guardrail offset in road-half units
    const RAIL_TOP = 320;  // rail height above the road, world units
    const RAIL_BOT = 170;
    const POST_H = 340;
    const TRAFFIC_SCALE = 0.95;
    const SIDES: readonly number[] = [-1, 1];

    interface Palette {
      grassA: string[]; grassB: string[];
      roadA: string[]; roadB: string[];
      curbA: string[]; curbB: string[];
      railFace: string[]; railTop: string[]; railDark: string[]; post: string[];
      edge: string[]; edgeGlow: string[]; lane: string[];
      haze: string;
    }

    const buildPalette = (b: RoadBiomeConfig, s: SkyAtmosphereConfig): Palette => {
      const hazeRgb = hexRgb(s.skyStops[2]);
      const fog = (hex: string, t: number) => rgbStr(mixRgb(hexRgb(hex), hazeRgb, t));
      const v1 = hexRgb(b.valleyStops[1]);
      const v2 = hexRgb(b.valleyStops[2]);
      const avg = mixRgb(v1, v2, 0.5);
      // subtle alternation: pull both tones toward their mean so the bands read
      // as terrain, not high-contrast stripes
      const gA = mixRgb(v1, avg, 0.55);
      const gB = mixRgb(v2, avg, 0.55);
      const edgeRgb = hexRgb(b.edgeStripe);
      const pal: Palette = {
        grassA: [], grassB: [], roadA: [], roadB: [], curbA: [], curbB: [],
        railFace: [], railTop: [], railDark: [], post: [],
        edge: [], edgeGlow: [], lane: [], haze: rgbStr(hazeRgb),
      };
      for (let i = 0; i < FOG_STEPS; i++) {
        const t = (i / (FOG_STEPS - 1)) * FOG_MAX;
        pal.grassA.push(rgbStr(mixRgb(gA, hazeRgb, t)));
        pal.grassB.push(rgbStr(mixRgb(gB, hazeRgb, t)));
        pal.roadA.push(fog(b.asphaltEven, t));
        pal.roadB.push(fog(b.asphaltOdd, t));
        pal.curbA.push(fog(b.curbA, t));
        pal.curbB.push(fog(b.curbB, t));
        pal.railFace.push(fog(b.railLight, t));
        pal.railTop.push(fog(b.railSpec, t));
        pal.railDark.push(fog(b.railDark, t));
        pal.post.push(fog(b.pierDark, t));
        pal.edge.push(fog(b.edgeStripe, t));
        pal.edgeGlow.push(`rgba(${edgeRgb[0]},${edgeRgb[1]},${edgeRgb[2]},${(0.22 * (1 - t)).toFixed(3)})`);
        pal.lane.push(fog(b.centerLine, t));
      }
      return pal;
    };

    let palette: Palette = buildPalette(biome, sky);
    let hazeBandFar: CanvasGradient | null = null;
    let hazeBandMid: CanvasGradient | null = null;
    let horizonGlowGrad: CanvasGradient | null = null;
    let aerialGrad: CanvasGradient | null = null;
    let layerFar: HTMLCanvasElement | null = null;
    let layerMid: HTMLCanvasElement | null = null;
    let layerNear: HTMLCanvasElement | null = null;
    let vignetteFever: HTMLCanvasElement | null = null;
    let vignetteBoost: HTMLCanvasElement | null = null;
    let vignetteCrash: HTMLCanvasElement | null = null;
    let vignetteLow: HTMLCanvasElement | null = null;
    let noisePattern: CanvasPattern | null = null;

    const makeVignette = (edge: string): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.floor(W / 2));
      c.height = Math.max(2, Math.floor(H / 2));
      const vc = c.getContext('2d')!;
      const g = vc.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.32, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, edge);
      vc.fillStyle = g;
      vc.fillRect(0, 0, c.width, c.height);
      return c;
    };

    const ensureVisuals = () => {
      const key = `${biome.id}|${sky.id}|${W}x${H}`;
      if (key === visualsKey) return;
      visualsKey = key;
      palette = buildPalette(biome, sky);
      const hf = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.46);
      hf.addColorStop(0, 'rgba(0,0,0,0)');
      hf.addColorStop(1, palette.haze);
      hazeBandFar = hf;
      const hm = ctx.createLinearGradient(0, H * 0.36, 0, H * 0.46);
      hm.addColorStop(0, 'rgba(0,0,0,0)');
      hm.addColorStop(1, palette.haze);
      hazeBandMid = hm;
      const hg = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.52);
      hg.addColorStop(0, 'rgba(0,0,0,0)');
      hg.addColorStop(0.5, sky.horizonGlowColor);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      horizonGlowGrad = hg;
      const ag = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.72);
      ag.addColorStop(0, palette.haze);
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      aerialGrad = ag;
      const hazeHex = sky.skyStops[2];
      const mixHex = (a: string, b: string, t: number) => rgbStr(mixRgb(hexRgb(a), hexRgb(b), t));
      layerFar = getBackdropLayer(biome, 0, mixHex(sky.mtnFar, hazeHex, 0.55), 1024);
      layerMid = getBackdropLayer(biome, 1, mixHex(mixHex(sky.mtnFar, sky.mtnNear, 0.5), hazeHex, 0.3), 1024);
      layerNear = getBackdropLayer(biome, 2, mixHex(sky.mtnNear, hazeHex, 0.12), 1024);
      vignetteFever = makeVignette('rgba(103,232,249,0.34)');
      vignetteBoost = makeVignette('rgba(59,130,246,0.32)');
      vignetteCrash = makeVignette('rgba(239,68,68,0.45)');
      vignetteLow = makeVignette('rgba(248,113,113,0.3)');
      noisePattern = ctx.createPattern(getNoiseTile(), 'repeat');
    };

    // crisp pixel-art scaling: pre-upscale small sprites 2x (nearest) once, then
    // bilinear downscaling lands on fractional sizes without mush or shimmer.
    const hiResCache = new Map<HTMLCanvasElement, HTMLCanvasElement>();
    const crisp = (img: HTMLCanvasElement, destW: number): HTMLCanvasElement => {
      if (img.width > 160 || destW <= img.width * 0.7) return img;
      let big = hiResCache.get(img);
      if (!big) {
        big = document.createElement('canvas');
        big.width = img.width * 2;
        big.height = img.height * 2;
        const c2 = big.getContext('2d')!;
        c2.imageSmoothingEnabled = false;
        c2.drawImage(img, 0, 0, big.width, big.height);
        hiResCache.set(img, big);
        if (hiResCache.size > 96) {
          const oldest = hiResCache.keys().next().value;
          if (oldest) hiResCache.delete(oldest);
        }
      }
      return big;
    };

    interface Proj {
      seg: RoadSegment | null;
      x1: number; y1: number; w1: number; s1: number;
      x2: number; y2: number; w2: number; s2: number;
      clip: number; fog: number; fogT: number;
    }
    const projs: Proj[] = Array.from({ length: DRAW_DISTANCE + 4 }, () => ({
      seg: null, x1: 0, y1: 0, w1: 0, s1: 0, x2: 0, y2: 0, w2: 0, s2: 0, clip: 0, fog: 0, fogT: 0,
    }));
    const buckets: TrafficCar[][] = Array.from({ length: DRAW_DISTANCE + 4 }, () => []);
    const fontCache = new Map<number, string>();
    const fontFor = (px: number) => {
      const key = Math.round(px);
      let f = fontCache.get(key);
      if (!f) {
        f = `900 ${key}px "Arial Black", Impact, sans-serif`;
        fontCache.set(key, f);
        if (fontCache.size > 60) fontCache.delete(fontCache.keys().next().value as number);
      }
      return f;
    };
    const textWidthCache = new Map<string, number>();

    const quad = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.closePath();
      ctx.fill();
    };

    const drawSprite = (
      img: HTMLCanvasElement,
      worldW: number, scale: number, sx: number, sy: number, clipY: number,
      offsetX = -0.5, alpha = 1, useCrisp = false
    ) => {
      const destW = worldW * scale * (W / 2);
      const iw = img.width;
      const ih = img.height;
      if (destW < 1.5 || !iw || !ih) return;
      const destH = (destW * ih) / iw;
      const dx = sx + destW * offsetX;
      const dy = sy - destH;
      if (dy > H || dy + destH < 0 || dx > W || dx + destW < 0) return;
      if (alpha < 1) ctx.globalAlpha = alpha;
      const src = useCrisp ? crisp(img, destW) : img;
      if (clipY > 0 && clipY < H && dy + destH > clipY) {
        const visH = clipY - dy;
        if (visH > 0) ctx.drawImage(src, 0, 0, iw, (ih * visH) / destH, dx, dy, destW, visH);
      } else {
        ctx.drawImage(src, dx, dy, destW, destH);
      }
      if (alpha < 1) ctx.globalAlpha = 1;
    };

    let lastRenderTime = 0;

    const render = (time: number, phase: GamePhase) => {
      const p = propsRef.current;
      const stats = getStats();
      const speedRatio = clamp(speed / stats.topSpeed, 0, 1.5);
      const isFever = run.feverTimer > 0;
      const boosting = run.boostTimer > 0;
      const isNight = sky.isNight;
      const k = H / 800;
      const horizon = H * horizonRatio();
      const rdt = lastRenderTime ? Math.min(0.05, (time - lastRenderTime) / 1000) : 1 / 60;
      lastRenderTime = time;

      ensureSky();
      ensureVisuals();

      const baseIdx = Math.floor(position / SEGMENT_LENGTH);
      const basePct = (position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
      const baseSeg = track.segments[baseIdx];
      const playerZWorld = position + playerZ;
      const playerSegIdx = Math.floor(playerZWorld / SEGMENT_LENGTH);
      const playerSeg = track.segments[playerSegIdx];
      const playerPct = (playerZWorld % SEGMENT_LENGTH) / SEGMENT_LENGTH;
      const playerY = playerSeg.y1 + (playerSeg.y2 - playerSeg.y1) * playerPct;
      const camY = playerY + CAMERA_HEIGHT;
      const camX = playerX * ROAD_WIDTH;
      const camDepth = cameraDepthFor(FIELD_OF_VIEW + fovKick * 14 + (isFever ? 6 : 0));

      // project near → far, accumulating curve (float precision: no seams)
      let x = 0;
      let dx = -(baseSeg.curve * basePct);
      let maxY = H;
      let maxN = -1;
      for (let n = 0; n < DRAW_DISTANCE; n++) {
        const seg = track.segments[baseIdx + n];
        if (!seg) break;
        const pr = projs[n];
        const p1 = projectPointF(0, seg.y1, seg.z, camX, camY, position, camDepth, W, H, ROAD_WIDTH, horizon);
        const p2 = projectPointF(0, seg.y2, seg.z + SEGMENT_LENGTH, camX - dx, camY, position, camDepth, W, H, ROAD_WIDTH, horizon);
        x += dx;
        dx += seg.curve;
        pr.seg = seg;
        pr.x1 = p1.x; pr.w1 = p1.w; pr.s1 = p1.scale;
        pr.x2 = p2.x; pr.w2 = p2.w; pr.s2 = p2.scale;
        const ft = Math.pow(n / DRAW_DISTANCE, 1.7) * FOG_MAX;
        pr.fogT = ft;
        pr.fog = Math.min(FOG_STEPS - 1, Math.round((ft / FOG_MAX) * (FOG_STEPS - 1)));
        maxN = n;
        if (p1.y <= p2.y || p2.y >= maxY) {
          pr.clip = 0; // hidden behind a crest
          continue;
        }
        pr.clip = maxY;
        pr.y1 = Math.min(p1.y, maxY);
        pr.y2 = p2.y;
        maxY = p2.y;
      }

      // bucket traffic by segment for interleaved painter order
      for (let n = 0; n <= maxN; n++) buckets[n].length = 0;
      for (const c of traffic) {
        const n = Math.floor(c.z / SEGMENT_LENGTH) - baseIdx;
        if (n >= 0 && n <= maxN) buckets[n].push(c);
      }

      // camera shake (trauma-squared falloff)
      shake = Math.max(0, shake - rdt * 26);
      const shakeAmt = shake * shake * 0.05 * k;
      const shX = (Math.random() - 0.5) * shakeAmt;
      const shY = (Math.random() - 0.5) * shakeAmt;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // --- sky ---
      ctx.fillStyle = skyGrad!;
      ctx.fillRect(0, 0, W, H);

      if (isNight) {
        ctx.fillStyle = '#e2e8f0';
        for (const st of stars) {
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.001 + st.t));
          ctx.globalAlpha = tw * 0.8;
          const sz = (st.t > 4 ? 2 : 1.2) * k;
          ctx.fillRect(st.x * W, st.y * horizon * 0.9, sz, sz);
        }
        ctx.globalAlpha = 1;
      }

      // celestial body + atmospheric halo
      const cw = W * 0.2;
      const chh = cw * (celestial.height / celestial.width);
      const cxPos = W * sky.celestialXRatio;
      const cyPos = horizon * sky.celestialYRatio;
      const halo = getGlowSprite(isNight ? '#dbe4ff' : '#fff7d6', 96);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = isNight ? 0.4 : 0.55;
      ctx.drawImage(halo, cxPos - cw * 1.7, cyPos - cw * 1.7, cw * 3.4, cw * 3.4);
      ctx.restore();
      ctx.drawImage(celestial, cxPos - cw / 2, cyPos - chh / 2, cw, chh);

      // clouds (two-speed parallax)
      for (let i = 0; i < clouds.length; i++) {
        const cl = clouds[i];
        const cw2 = cl.width * (0.55 + (i % 3) * 0.18) * k;
        const ch2 = cl.height * (0.55 + (i % 3) * 0.18) * k;
        const span = W + cw2;
        let cx2 = (i * 271 - skyOffset * (0.4 + (i % 3) * 0.2) - headingSmooth * W * 0.02) % span;
        if (cx2 > 0) cx2 -= span;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(cl, cx2, horizon * (0.1 + (i % 4) * 0.13), cw2, ch2);
      }
      ctx.globalAlpha = 1;

      // parallax backdrop layers with haze between them
      const hillLift = (playerSeg.y1 - playerSeg.y2) * 0.02 * k;
      const drawLayer = (img: HTMLCanvasElement | null, factor: number, lift: number) => {
        if (!img) return;
        const lw = img.width * k;
        const lh = img.height * k;
        let ox = (-headingSmooth * W * factor - skyOffset * factor * 3) % lw;
        if (ox > 0) ox -= lw;
        const ly = horizon - lh + 2 + lift;
        ctx.drawImage(img, ox, ly, lw, lh);
        ctx.drawImage(img, ox + lw, ly, lw, lh);
        if (ox + lw * 2 < W) ctx.drawImage(img, ox + lw * 2, ly, lw, lh);
      };
      drawLayer(layerFar, 0.06, hillLift * 0.3);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = hazeBandFar!;
      ctx.fillRect(0, H * 0.3, W, H * 0.16);
      ctx.globalAlpha = 1;
      drawLayer(layerMid, 0.14, hillLift * 0.55);
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = hazeBandMid!;
      ctx.fillRect(0, H * 0.36, W, H * 0.1);
      ctx.globalAlpha = 1;
      drawLayer(layerNear, 0.26, hillLift);
      ctx.fillStyle = horizonGlowGrad!;
      ctx.fillRect(0, H * 0.4, W, H * 0.12);

      // --- ground + road (far → near, sprites interleaved per segment) ---
      ctx.save();
      ctx.translate(shX, shY);
      ctx.fillStyle = palette.grassB[FOG_STEPS - 1];
      ctx.fillRect(-8, horizon, W + 16, H - horizon + 8);

      const edgeGlowOn = isNight && (biome.id === 'neon' || biome.id === 'sakura');
      const shadowSpr = getShadowSprite();
      const starSpr = getStarSprite();
      const lampGlow = getGlowSprite(biome.lampColor, 64);
      const coinGlow = getGlowSprite('#fde047', 64);
      const starGlow = getGlowSprite('#f0abfc', 64);
      const feverHue = (time * 0.25) % 360;
      const feverLane = `hsl(${feverHue},95%,70%)`;

      for (let n = maxN; n >= 0; n--) {
        const pr = projs[n];
        if (pr.clip <= 0 || !pr.seg) continue;
        const seg = pr.seg;
        const fi = pr.fog;
        const y1 = pr.y1;
        const y2 = pr.y2;
        const hSeg = y1 - y2;
        if (hSeg <= 0) continue;
        const detail = hSeg >= 1.1;
        const band = Math.floor(seg.index / RUMBLE_LENGTH) % 2;

        // grass band (1px overlap kills seams)
        ctx.fillStyle = band ? palette.grassA[fi] : palette.grassB[fi];
        ctx.fillRect(-8, y2, W + 16, hSeg + 1);

        // road quad, extended 1px toward the camera
        quad(
          pr.x1 - pr.w1, y1 + 1, pr.x1 + pr.w1, y1 + 1,
          pr.x2 + pr.w2, y2, pr.x2 - pr.w2, y2,
          band ? palette.roadA[fi] : palette.roadB[fi]
        );

        if (detail) {
          const rumbleW1 = pr.w1 * 0.13;
          const rumbleW2 = pr.w2 * 0.13;
          const curbCol = band ? palette.curbA[fi] : palette.curbB[fi];
          quad(pr.x1 - pr.w1 - rumbleW1, y1 + 1, pr.x1 - pr.w1, y1 + 1, pr.x2 - pr.w2, y2, pr.x2 - pr.w2 - rumbleW2, y2, curbCol);
          quad(pr.x1 + pr.w1, y1 + 1, pr.x1 + pr.w1 + rumbleW1, y1 + 1, pr.x2 + pr.w2 + rumbleW2, y2, pr.x2 + pr.w2, y2, curbCol);
          // edge lines (+ neon glow at night)
          const ew1 = Math.max(1, pr.w1 * 0.022);
          const ew2 = Math.max(0.5, pr.w2 * 0.022);
          if (edgeGlowOn) {
            const gw1 = pr.w1 * 0.085;
            const gw2 = pr.w2 * 0.085;
            quad(pr.x1 - pr.w1 - gw1, y1 + 1, pr.x1 - pr.w1 + gw1, y1 + 1, pr.x2 - pr.w2 + gw2, y2, pr.x2 - pr.w2 - gw2, y2, palette.edgeGlow[fi]);
            quad(pr.x1 + pr.w1 - gw1, y1 + 1, pr.x1 + pr.w1 + gw1, y1 + 1, pr.x2 + pr.w2 + gw2, y2, pr.x2 + pr.w2 - gw2, y2, palette.edgeGlow[fi]);
          }
          quad(pr.x1 - pr.w1 - ew1, y1 + 1, pr.x1 - pr.w1 + ew1, y1 + 1, pr.x2 - pr.w2 + ew2, y2, pr.x2 - pr.w2 - ew2, y2, palette.edge[fi]);
          quad(pr.x1 + pr.w1 - ew1, y1 + 1, pr.x1 + pr.w1 + ew1, y1 + 1, pr.x2 + pr.w2 + ew2, y2, pr.x2 + pr.w2 - ew2, y2, palette.edge[fi]);
          // lane dashes
          if (band && track.lanes > 1) {
            const laneCol = isFever ? feverLane : palette.lane[fi];
            const lw1 = Math.max(1, pr.w1 * 0.02);
            const lw2 = Math.max(0.5, pr.w2 * 0.02);
            for (let ln = 1; ln < track.lanes; ln++) {
              const off = -1 + (2 * ln) / track.lanes;
              const lx1 = pr.x1 + pr.w1 * off;
              const lx2 = pr.x2 + pr.w2 * off;
              quad(lx1 - lw1, y1 + 1, lx1 + lw1, y1 + 1, lx2 + lw2, y2, lx2 - lw2, y2, laneCol);
            }
          }
          if (seg.checkpoint) {
            quad(pr.x1 - pr.w1, y1 + 1, pr.x1 + pr.w1, y1 + 1, pr.x2 + pr.w2, y2, pr.x2 - pr.w2, y2, 'rgba(250,204,21,0.5)');
          }

          // guardrails: posts + continuous rail + spec cap + night reflectors
          const rh1 = pr.s1 * (H / 2);
          const rh2 = pr.s2 * (H / 2);
          for (const side of SIDES) {
            const rx1 = pr.x1 + side * pr.w1 * RAIL_X;
            const rx2 = pr.x2 + side * pr.w2 * RAIL_X;
            const t1 = y1 - RAIL_TOP * rh1;
            const t2 = y2 - RAIL_TOP * rh2;
            const b1 = y1 - RAIL_BOT * rh1;
            const b2 = y2 - RAIL_BOT * rh2;
            if (seg.index % 3 === 0) {
              const pw = Math.max(1.5, pr.w1 * 0.024);
              ctx.fillStyle = palette.post[fi];
              ctx.fillRect(rx1 - pw / 2, y1 - POST_H * rh1, pw, POST_H * rh1);
            }
            quad(rx1, t1, rx2, t2, rx2, b2, rx1, b1, palette.railFace[fi]);
            const capH1 = Math.max(1, 45 * rh1);
            const capH2 = Math.max(0.5, 45 * rh2);
            quad(rx1, t1, rx2, t2, rx2, t2 - capH2, rx1, t1 - capH1, palette.railTop[fi]);
            if (isNight && seg.index % 6 === 0 && n < 90) {
              const ry = y1 - 245 * rh1;
              const rs = Math.max(1.5, pr.w1 * 0.02);
              ctx.fillStyle = palette.railTop[fi];
              ctx.fillRect(rx1 - rs / 2, ry - rs / 2, rs, rs);
            }
          }
        }

        // lamp light pools on the asphalt at night
        if (isNight && detail && n < 70) {
          for (const prop of seg.props) {
            if (prop.kind !== 'lamp') continue;
            const lx = pr.x1 + pr.w1 * prop.offset * 0.62;
            const poolR = pr.w1 * 0.55;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.4 * (1 - pr.fogT);
            ctx.drawImage(lampGlow, lx - poolR, y1 - poolR * 0.3, poolR * 2, poolR * 0.6);
            ctx.restore();
          }
        }

        // roadside props (crest-clipped)
        const clipY = pr.clip;
        for (const prop of seg.props) {
          const px = pr.x1 + pr.w1 * prop.offset;
          const fade = 1 - pr.fogT * 0.85;
          let img: HTMLCanvasElement;
          let ww: number;
          switch (prop.kind) {
            case 'tree': img = getTreeSprite(biome, prop.variant); ww = biome.propStyle === 'tower' ? 1500 : biome.propStyle === 'sakura' ? 1700 : 1300; break;
            case 'rock': img = getRockSprite(biome); ww = 700; break;
            case 'lamp': img = getLampSprite(biome); ww = 400; break;
            case 'sign': img = getSignSprite(biome, prop.variant === 1); ww = 750; break;
            case 'gantry': img = getGantrySprite(biome, prop.variant); ww = ROAD_WIDTH * 2.3; break;
            case 'checkpoint': img = getCheckpointSprite(); ww = ROAD_WIDTH * 2.3; break;
            default: continue;
          }
          if (prop.kind === 'gantry' || prop.kind === 'checkpoint') {
            drawSprite(img, ww, pr.s1, pr.x1, y1, clipY, -0.5, fade);
          } else {
            drawSprite(img, ww, pr.s1, px, y1, clipY, -0.5, fade);
          }
        }

        // coins
        if (seg.coin && !seg.coin.taken) {
          const t = (seg.z + SEGMENT_LENGTH * 0.5 - playerZWorld) / SEGMENT_LENGTH;
          if (t > -1 && t < 2) {
            const cxp = (pr.x1 + pr.x2) / 2 + ((pr.w1 + pr.w2) / 2) * seg.coin.offset;
            const cyp = (y1 + y2) / 2;
            const cs = (pr.s1 + pr.s2) / 2;
            const spin = Math.floor(time * 0.008 + seg.index) % 8;
            const img = seg.coin.star ? starSpr : coinFrames[spin];
            const bob = Math.sin(time * 0.004 + seg.index) * 60 * cs * (H / 2);
            const lift = 200 * cs * (H / 2);
            if (isNight) {
              const gw = coinWorldSize(seg.coin.star) * cs * (W / 2) * 2.2;
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = 0.35 * (1 - pr.fogT);
              ctx.drawImage(seg.coin.star ? starGlow : coinGlow, cxp - gw / 2, cyp - lift + bob - gw / 2, gw, gw);
              ctx.restore();
            }
            drawSprite(img, coinWorldSize(seg.coin.star), cs, cxp, cyp - lift + bob, clipY, -0.5, 1 - pr.fogT * 0.7);
          }
        }

        // traffic in this segment
        const bucket = buckets[n];
        for (let bi = bucket.length - 1; bi >= 0; bi--) {
          const c = bucket[bi];
          const t = clamp((c.z - seg.z) / SEGMENT_LENGTH, 0, 1);
          const sx = pr.x1 + (pr.x2 - pr.x1) * t + (pr.w1 + (pr.w2 - pr.w1) * t) * c.x;
          const sy = y1 + (y2 - y1) * t;
          const cs = pr.s1 + (pr.s2 - pr.s1) * t;
          const view = clamp(c.x * 0.5, -1, 1);
          const img = getTrafficVehicleCanvas(c.kind, c.color, false, view, isNight);
          const worldW = (CAR_WORLD_W / SPRITE_FILL) * TRAFFIC_SCALE;
          const drawW = worldW * cs * (W / 2);
          const drawH = drawW * (img.height / img.width);
          const fade = 1 - pr.fogT * 0.85;
          ctx.globalAlpha = fade * 0.55;
          ctx.drawImage(shadowSpr, sx - drawW * 0.46, sy - drawH * 0.06, drawW * 0.92, drawH * 0.14);
          ctx.globalAlpha = 1;
          drawSprite(img, worldW, cs, sx, sy, clipY, -0.5, fade, true);
          if (isNight && detail && n < 90) {
            const gw = drawW * 0.13;
            const g = getGlowSprite('#ef4444', 64);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5 * fade;
            ctx.drawImage(g, sx - drawW * 0.28 - gw / 2, sy - drawH * 0.4, gw, gw);
            ctx.drawImage(g, sx + drawW * 0.28 - gw / 2, sy - drawH * 0.4, gw, gw);
            ctx.restore();
          }
        }
      }

      // aerial perspective over the far ground
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = aerialGrad!;
      ctx.fillRect(0, horizon, W, H * 0.3);
      ctx.globalAlpha = 1;

      // scrolling terrain / asphalt texture (two octaves, moves with the road)
      if (noisePattern) {
        const off = (position * 0.5) % 128;
        const midY = horizon + (H - horizon) * 0.45;
        ctx.save();
        ctx.fillStyle = noisePattern;
        ctx.globalAlpha = 0.5;
        ctx.translate(0, off);
        ctx.fillRect(-8, horizon - off, W + 16, midY - horizon);
        ctx.globalAlpha = 0.85;
        ctx.scale(1.9, 1.9);
        ctx.fillRect(-8, (midY - off) / 1.9, (W + 16) / 1.9, (H - midY) / 1.9 + 8);
        ctx.restore();
      }

      // --- hero car ---
      const offRoadNow = Math.abs(playerX) > 1;
      const heroW = Math.min(W * 0.72, H * 0.5);
      const heroH = heroW * 0.75;
      const bounce = Math.sin(wheelPhase * 2) * 1.2 * k * speedRatio + (offRoadNow && speedRatio > 0.2 ? Math.sin(wheelPhase * 5) * 1.6 * k : 0);
      const heroBottom = H * 0.88 + bounce;
      const heroCx = W / 2 + leanSmooth * W * 0.015;
      const heroTop = heroBottom - heroH;
      lastHeroW = heroW;
      lastHeroH = heroH;
      lastHeroCx = heroCx;
      lastHeroTop = heroTop;

      // headlight cones at night
      if (isNight && phase === 'playing') {
        const cone = getHeadlightCone();
        const coneH = H * 0.36;
        const coneW = heroW * 0.95;
        const coneBottom = heroTop + heroH * 0.6;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.5;
        for (const side of SIDES) {
          ctx.save();
          ctx.translate(heroCx + side * heroW * 0.17, coneBottom);
          ctx.rotate(leanSmooth * 0.06);
          ctx.drawImage(cone, -coneW / 2, -coneH, coneW, coneH);
          ctx.restore();
        }
        ctx.restore();
      }

      // contact shadow
      ctx.globalAlpha = 0.6;
      ctx.drawImage(shadowSpr, heroCx - heroW * 0.44, heroBottom - heroW * 0.075, heroW * 0.88, heroW * 0.15);
      ctx.globalAlpha = 1;

      if (!p.customSpriteUrl) {
        if (customImg) { customImg = null; customImgUrl = ''; }
      } else if (customImgUrl !== p.customSpriteUrl) {
        customImgUrl = p.customSpriteUrl;
        customImg = new Image();
        customImg.src = p.customSpriteUrl;
      }
      const wrecked = crashed && crashReason === 'wrecked';
      const heroDrift = drifting ? Math.sign(baseSeg.curve) * 0.85 : clamp(steerSmooth * 0.35, -0.4, 0.4);
      const pedal = wrecked ? undefined : boosting ? 'gas' : speedRatio > 0.92 ? 'gas' : speedRatio > 0.2 ? 'coast' : undefined;
      const flashing = crashed && Math.floor(time / 90) % 2 === 0 && phase === 'playing';
      const heroImg = getPixelCarCanvas(p.selectedCar, heroDrift, isFever, wrecked, wheelPhase, p.carCustom, pedal, flashing);
      const lean = -leanSmooth * 0.05 - Math.sign(heroDrift) * Math.abs(heroDrift) * 0.03;
      ctx.save();
      ctx.translate(heroCx, heroBottom);
      ctx.rotate(lean);
      if (customImg && customImg.complete && customImg.naturalWidth > 0) {
        ctx.drawImage(customImg, -heroW / 2, -heroH, heroW, heroH);
      } else {
        ctx.drawImage(crisp(heroImg, heroW), -heroW / 2, -heroH, heroW, heroH);
      }
      ctx.restore();

      // tail-light glow: bright when decelerating / wrecked, soft at night
      const braking = wrecked || speed < prevSpeed - stats.topSpeed * 0.004 || hitStop > 0;
      const tailAlpha = braking ? 0.85 : isNight ? 0.4 : 0.14;
      const tailGlow = getGlowSprite('#ef4444', 64);
      const tg = heroW * (braking ? 0.14 : 0.1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = tailAlpha;
      ctx.drawImage(tailGlow, heroCx - heroW * 0.27 - tg / 2, heroBottom - heroH * 0.42 - tg / 2, tg, tg);
      ctx.drawImage(tailGlow, heroCx + heroW * 0.27 - tg / 2, heroBottom - heroH * 0.42 - tg / 2, tg, tg);
      if (boosting) {
        const bg = getGlowSprite('#67e8f9', 64);
        const bw = heroW * 0.2;
        ctx.globalAlpha = 0.7;
        ctx.drawImage(bg, heroCx - bw / 2, heroBottom - heroH * 0.18 - bw / 2, bw, bw);
      }
      ctx.restore();

      // particles (sparks, dust, tyre smoke)
      for (const pt of particles) {
        const a = clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.puff) {
          ctx.globalAlpha = a * 0.6;
          const spr = getSmokeSprite(pt.puff);
          ctx.drawImage(spr, pt.x - pt.size, pt.y - pt.size, pt.size * 2, pt.size * 2);
        } else if (pt.grow > 0) {
          ctx.globalAlpha = a * 0.5;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = a;
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        }
      }
      ctx.globalAlpha = 1;

      // ambient biome particles (foreground)
      if (ambientKind === 'petal') {
        const spr = getPetalSprite();
        for (const a of ambient) {
          if (!a.alive) continue;
          const fade = Math.min(1, a.life * 2) * Math.min(1, (a.maxLife - a.life) * 2);
          ctx.save();
          ctx.globalAlpha = 0.85 * fade;
          ctx.translate(a.x, a.y);
          ctx.rotate(a.rot);
          ctx.drawImage(spr, -a.size, -a.size * 0.86, a.size * 2, a.size * 1.72);
          ctx.restore();
        }
      } else if (ambientKind === 'embers') {
        const spr = getGlowSprite('#fb923c', 32);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const a of ambient) {
          if (!a.alive) continue;
          const fade = Math.min(1, a.life * 2) * Math.min(1, a.maxLife - a.life);
          ctx.globalAlpha = fade * (0.5 + 0.4 * Math.sin(a.phase + a.life * 9));
          ctx.drawImage(spr, a.x - a.size, a.y - a.size, a.size * 2, a.size * 2);
        }
        ctx.restore();
      } else if (ambientKind === 'neon_orb') {
        const cyan = getGlowSprite('#67e8f9', 32);
        const magenta = getGlowSprite('#f0abfc', 32);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        let i = 0;
        for (const a of ambient) {
          if (!a.alive) { i++; continue; }
          const fade = Math.min(1, a.life) * Math.min(1, a.maxLife - a.life);
          ctx.globalAlpha = fade * (0.3 + 0.2 * Math.sin(a.phase + a.life * 2));
          ctx.drawImage(i % 2 ? magenta : cyan, a.x - a.size, a.y - a.size, a.size * 2, a.size * 2);
          i++;
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // end camera-shake transform (world only; UI below is stable)

      // --- post effects ---
      const lineAmt = Math.max(0, speedRatio - 0.58) * 1.6 + (boosting ? 0.5 : 0) + (isFever ? 0.25 : 0);
      if (lineAmt > 0.03 && phase === 'playing') {
        ctx.save();
        ctx.strokeStyle = isFever ? '#67e8f9' : '#ffffff';
        ctx.lineWidth = 1.5 * k;
        ctx.globalAlpha = Math.min(0.16, 0.04 + lineAmt * 0.1);
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2 + Math.sin(time * 0.0008 + i * 1.7) * 0.04;
          const r0 = H * (0.46 + ((i * 37) % 10) * 0.014);
          const len = H * (0.05 + lineAmt * 0.1) * (0.6 + ((i * 53) % 10) * 0.05);
          const ox = W / 2 + Math.cos(ang) * r0 * 1.3;
          const oy = horizon + Math.sin(ang) * r0;
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(ang) * len * 1.3, oy + Math.sin(ang) * len);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (isFever && vignetteFever) {
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(time * 0.006);
        ctx.drawImage(vignetteFever, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (boosting && vignetteBoost) {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(vignetteBoost, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (flashFx > 0) {
        ctx.globalAlpha = flashFx * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (crashed && vignetteCrash) {
        ctx.globalAlpha = clamp(crashTimer * 2, 0, 0.85);
        ctx.drawImage(vignetteCrash, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (phase === 'playing' && run.timeLeft < 10 && vignetteLow) {
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 0.012);
        ctx.drawImage(vignetteLow, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      // popups (outlined, phone-sized)
      for (const pu of popups) {
        const alpha = clamp(pu.life * 2.5, 0, 1);
        const px = clamp(H * 0.026, 15, 46) * pu.size;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = fontFor(px);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, px * 0.16);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(8,12,24,0.9)';
        ctx.strokeText(pu.text, pu.x, pu.y);
        ctx.fillStyle = pu.color;
        ctx.fillText(pu.text, pu.x, pu.y);
        ctx.restore();
      }

      // callout banner (checkpoint / fever / nitro / mode intro)
      if (calloutTimer > 0 && calloutText) {
        const total = calloutTotal > 0 ? calloutTotal : 1.2;
        const prog = 1 - calloutTimer / total;
        const slide = 1 - Math.pow(1 - Math.min(1, prog / 0.15), 3);
        const alpha = prog > 0.78 ? clamp((1 - prog) / 0.22, 0, 1) : 1;
        const px = clamp(H * 0.037, 18, 58);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = fontFor(px);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let tw = textWidthCache.get(calloutText);
        if (tw === undefined) {
          tw = ctx.measureText(calloutText).width;
          textWidthCache.set(calloutText, tw);
          if (textWidthCache.size > 40) textWidthCache.delete(textWidthCache.keys().next().value as string);
        }
        const by = H * 0.26 + (1 - slide) * H * 0.03;
        const pad = px * 0.7;
        ctx.fillStyle = 'rgba(8,12,24,0.55)';
        ctx.fillRect(W / 2 - tw / 2 - pad, by - px * 0.75, tw + pad * 2, px * 1.5);
        ctx.fillStyle = biome.gantryAccent;
        ctx.fillRect(W / 2 - tw / 2 - pad, by + px * 0.75 - 3 * k, tw + pad * 2, 3 * k);
        ctx.lineWidth = Math.max(3, px * 0.12);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(8,12,24,0.95)';
        ctx.strokeText(calloutText, W / 2, by);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(calloutText, W / 2, by);
        ctx.restore();
      }

      // drift meter
      if (drifting && phase === 'playing') {
        const px = clamp(H * 0.027, 14, 40);
        ctx.save();
        ctx.font = fontFor(px);
        ctx.textAlign = 'center';
        ctx.fillStyle = driftBank > 0.95 ? '#fbbf24' : '#fde68a';
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 0.02);
        ctx.fillText(`DRIFT ${driftHold.toFixed(1)}s`, W / 2, H * 0.3);
        ctx.restore();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // present: smooth upscale from the high-res buffer
      dctx.drawImage(buf, 0, 0, display.width, display.height);
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
      style={{ touchAction: 'none' }}
      data-testid="game-canvas"
    />
  );
});

SceneCanvas.displayName = 'SceneCanvas';
