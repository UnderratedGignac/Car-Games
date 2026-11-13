/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import {
  CarCustomization,
  CarSpec,
  CarUpgradeLevels,
  DiagonalDirection,
  DriftPhysicsState,
  GameModeId,
  HIGHWAY_LANE_OFFSET,
  RoadBiomeConfig,
  RoadBiomeId,
  RoadSelectionMode,
  SCurvePoint,
  TrafficCarState,
  VALLEY_BASE_Y,
  calculateDriftScoreStep,
  computeEffectiveCarStats,
  createInitialDriftState,
  evaluateCarOnSCurveRoad,
  evaluateSlipstreamDraft,
  evaluateTrafficInteraction,
  extendHighwayTrack,
  extendSCurveTrack,
  generateHighwayTrack,
  generateSCurveTrack,
  generateTrafficBatch,
  getDriftRank,
  getOvertakeStreakLabel,
  normalizeAngle,
  resolveCarAppearance,
  resolveRoadBiome,
  sampleTrackAtS,
  stepDriftPhysics,
  stepHighwayPhysics,
  stepTrafficCars,
  triggerTrafficFlashYield,
  compactInPlace,
} from './rules';
import { getPixelCarCanvas, getPixelCarTireAnchors, getTrafficVehicleCanvas } from './pixelSprites';
import {
  Project3DIntoFn,
  Projected3D,
  RoadSlice3D,
  WorldProp3D,
  renderBridgeTrussArch3D,
  renderReflectorBollard3D,
  renderTerrainMesh3D,
  renderWeirdRoadsideLandmarks3D,
  renderWorldObject3D,
} from './world3d';
import { soundFX, triggerHaptic } from './audio';
import {
  ANIME_CLOUD_COUNT,
  SkyAtmosphereConfig,
  SkyThemeId,
  renderAnimeCloudSprite,
  renderCelestialSprite,
  renderDynamicSkyAtmosphere,
  renderMythicalDragonsAndSkyAnomalies,
  resolveSkyAtmosphere,
} from './skyArt';

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
  direction: DiagonalDirection;
  nearMissText: string;
  isDrifting?: boolean;
  biomeName?: string;
  overtakes?: number;
  nearMisses?: number;
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
  steerHold?: number; // -1 left, 0 neutral, +1 right from UI buttons or steering wheel
  flipTriggerCount: number;
  boostTriggerCount: number;
  restartTriggerCount: number;
  flashTriggerCount?: number;
  hornTriggerCount?: number;
  screenShakeIntensity?: number; // 0.0 (no shake, accessibility safe) to 1.0 (default 1.0)
  screenShakeMultiplier?: number;
  controlScheme?: 'classic' | 'wheel' | 'swipe'; // default 'classic'
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

interface SkidSegment {
  lx: number;
  lz: number;
  rx: number;
  rz: number;
  y: number;
  connected: boolean;
  widthScale: number;
  alpha: number;
  color: string;
  dirSign: -1 | 1;
}

interface SmokePuff {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  tint: 'white' | 'cyan' | 'fire' | 'dark' | 'pink' | 'aqua' | 'warm';
  overCar?: boolean;
}

interface DebrisChunk {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  w?: number;
  h?: number;
  gravity?: number;
  rot: number;
  vRot: number;
  life: number;
  color: string;
}

interface ShockwaveRing {
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface AmbientParticle {
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

interface FloatingCallout {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  halfW: number;
}

interface FloatingTextParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = React.memo(({
  gamePhase,
  gameMode = 'drift',
  selectedCar,
  carUpgrades,
  carCustom,
  customSpriteUrl,
  roadMode = 'tour',
  skyMode = 'auto',
  steerHold = 0,
  flipTriggerCount,
  boostTriggerCount,
  restartTriggerCount,
  flashTriggerCount = 0,
  hornTriggerCount = 0,
  screenShakeIntensity,
  screenShakeMultiplier = 1.0,
  controlScheme = 'classic',
  onTelemetryUpdate,
  onGameOver,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const phaseRef = useRef<GamePhase>(gamePhase);
  phaseRef.current = gamePhase;

  const effectiveShake = screenShakeIntensity !== undefined ? screenShakeIntensity : screenShakeMultiplier;
  const shakeMultiplierRef = useRef<number>(effectiveShake);
  shakeMultiplierRef.current = effectiveShake;

  const controlSchemeRef = useRef<'classic' | 'wheel' | 'swipe'>(controlScheme);
  controlSchemeRef.current = controlScheme;

  const gameModeRef = useRef<GameModeId>(gameMode);
  gameModeRef.current = gameMode;

  const carRef = useRef<CarSpec>(selectedCar);
  carRef.current = selectedCar;

  const upgradesRef = useRef<CarUpgradeLevels>(carUpgrades);
  upgradesRef.current = carUpgrades;

  const carCustomRef = useRef<Partial<CarCustomization> | undefined>(carCustom);
  carCustomRef.current = carCustom;

  const customSpriteRef = useRef<string | undefined>(customSpriteUrl);
  customSpriteRef.current = customSpriteUrl;

  const roadModeRef = useRef<RoadSelectionMode>(roadMode);
  roadModeRef.current = roadMode;

  const skyModeRef = useRef<SkyThemeId>(skyMode);
  skyModeRef.current = skyMode;

  const steerHoldRef = useRef<number>(steerHold);
  steerHoldRef.current = steerHold;

  const onTelemetryRef = useRef(onTelemetryUpdate);
  onTelemetryRef.current = onTelemetryUpdate;

  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const pendingFlipRef = useRef(false);
  const pendingBoostRef = useRef(false);
  const pendingResetRef = useRef(false);
  const pendingFlashRef = useRef(false);
  const pendingHornRef = useRef(false);

  const prevGameMode = useRef(gameMode);
  if (gameMode !== prevGameMode.current) {
    prevGameMode.current = gameMode;
    pendingResetRef.current = true;
  }

  const prevFlipCount = useRef(flipTriggerCount);
  if (flipTriggerCount !== prevFlipCount.current) {
    prevFlipCount.current = flipTriggerCount;
    pendingFlipRef.current = true;
  }

  const prevBoostCount = useRef(boostTriggerCount);
  if (boostTriggerCount !== prevBoostCount.current) {
    prevBoostCount.current = boostTriggerCount;
    pendingBoostRef.current = true;
  }

  const prevRestartCount = useRef(restartTriggerCount);
  if (restartTriggerCount !== prevRestartCount.current) {
    prevRestartCount.current = restartTriggerCount;
    pendingResetRef.current = true;
  }

  const prevFlashCount = useRef(flashTriggerCount);
  if (flashTriggerCount !== prevFlashCount.current) {
    prevFlashCount.current = flashTriggerCount;
    pendingFlashRef.current = true;
  }

  const prevHornCount = useRef(hornTriggerCount);
  if (hornTriggerCount !== prevHornCount.current) {
    prevHornCount.current = hornTriggerCount;
    pendingHornRef.current = true;
  }

  useEffect(() => {
    const displayCanvas = canvasRef.current;
    if (!displayCanvas) return;
    const rawCtx = displayCanvas.getContext('2d', { alpha: false });
    if (!rawCtx) return;
    const ctx: CanvasRenderingContext2D = rawCtx;

    // Offscreen cached biome layers (4-layer cel-shaded anime clouds, sun/moon disc & skyline backdrop)
    const horizonCanvas = document.createElement('canvas');
    const horizonCtx = horizonCanvas.getContext('2d');
    const celestialCanvas = document.createElement('canvas');
    const cloudCanvases = Array.from({ length: ANIME_CLOUD_COUNT }, () =>
      document.createElement('canvas')
    );

    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    let pxW = 200;
    let pxH = 340;
    let cachedSkyGrad: CanvasGradient | null = null;
    let cachedMeadowGrad: CanvasGradient | null = null;
    let cachedSkyKey: string | null = null;
    let cachedHorizonY = Math.round(pxH * 0.35);

    const ensureBiomeLayers = (biome: RoadBiomeConfig, sky: SkyAtmosphereConfig) => {
      const nextSkyKey = `${biome.id}:${sky.id}:${pxW}`;
      if (cachedSkyKey === nextSkyKey && cachedSkyGrad && cachedMeadowGrad) return;
      cachedSkyKey = nextSkyKey;
      cachedSkyGrad = ctx.createLinearGradient(0, 0, 0, cachedHorizonY + 14);
      cachedSkyGrad.addColorStop(0.0, sky.skyStops[0]);
      cachedSkyGrad.addColorStop(0.55, sky.skyStops[1]);
      cachedSkyGrad.addColorStop(1.0, sky.skyStops[2]);

      cachedMeadowGrad = ctx.createLinearGradient(0, cachedHorizonY, 0, pxH);
      cachedMeadowGrad.addColorStop(0.0, biome.valleyStops[0]);
      cachedMeadowGrad.addColorStop(0.35, biome.valleyStops[1]);
      cachedMeadowGrad.addColorStop(1.0, biome.valleyStops[2]);

      // Pre-render sculpted Shinkai-style anime cloud sprites and celestial Sun/Moon disc offscreen
      const sunRightBias = sky.celestialXRatio >= 0.5;
      for (let i = 0; i < ANIME_CLOUD_COUNT; i++) {
        renderAnimeCloudSprite(cloudCanvases[i], i, sky.clouds, sunRightBias);
      }
      renderCelestialSprite(celestialCanvas, sky);

      // Pre-render distant skyline / mesas / mountains onto horizonCanvas (with 160px parallax overscan)
      const overscan = 160;
      const hw = pxW + overscan * 2;
      const hh = cachedHorizonY + 14;
      horizonCanvas.width = hw;
      horizonCanvas.height = hh;
      if (horizonCtx) {
        horizonCtx.clearRect(0, 0, hw, hh);
        if (biome.propStyle === 'tower') {
          const bWidths = [18, 24, 16, 28, 20, 22, 16, 26, 18, 22];
          const bHeights = [26, 40, 22, 48, 30, 36, 24, 44, 28, 34];
          const farTower = sky.id === 'red_moon' ? '#2c0a18' : sky.isNight ? biome.mtnFar : '#334155';
          const nearTower = sky.id === 'red_moon' ? '#17040c' : sky.isNight ? biome.mtnNear : '#1e293b';
          let bx = 0;
          let b = 0;
          while (bx < hw) {
            const bw = bWidths[b % bWidths.length];
            const bh = bHeights[b % bHeights.length];
            const by = cachedHorizonY - bh + 8;
            horizonCtx.fillStyle = b % 2 === 0 ? farTower : nearTower;
            horizonCtx.fillRect(bx, by, bw - 2, bh + 6);
            horizonCtx.fillStyle = sky.id === 'red_moon' ? '#fb7185' : b % 3 === 0 ? '#22d3ee' : '#ec4899';
            horizonCtx.fillRect(bx, by, bw - 2, 1);
            for (let wy = by + 4; wy < cachedHorizonY + 2; wy += 5) {
              for (let wx = bx + 3; wx < bx + bw - 5; wx += 4) {
                if ((wx + wy + b) % 3 !== 0) {
                  horizonCtx.fillStyle =
                    sky.id === 'red_moon'
                      ? (wx + b) % 4 === 0
                        ? '#fda4af'
                        : '#fbbf24'
                      : (wx + b) % 4 === 0
                      ? '#22d3ee'
                      : (wy + b) % 5 === 0
                      ? '#f472b6'
                      : '#fef08a';
                  horizonCtx.fillRect(wx, wy, 2, 2);
                }
              }
            }
            bx += bw;
            b++;
          }
        } else if (biome.propStyle === 'cactus') {
          horizonCtx.fillStyle = sky.mtnFar;
          horizonCtx.beginPath();
          horizonCtx.moveTo(0, hh);
          horizonCtx.lineTo(0, Math.round(cachedHorizonY * 0.72));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.14), Math.round(cachedHorizonY * 0.56));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.30), Math.round(cachedHorizonY * 0.56));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.40), Math.round(cachedHorizonY * 0.80));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.65), Math.round(cachedHorizonY * 0.80));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.74), Math.round(cachedHorizonY * 0.52));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.94), Math.round(cachedHorizonY * 0.52));
          horizonCtx.lineTo(hw, Math.round(cachedHorizonY * 0.76));
          horizonCtx.lineTo(hw, hh);
          horizonCtx.closePath();
          horizonCtx.fill();

          horizonCtx.fillStyle = sky.mtnNear;
          horizonCtx.beginPath();
          horizonCtx.moveTo(0, hh);
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.12), Math.round(cachedHorizonY * 0.70));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.24), Math.round(cachedHorizonY * 0.70));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.34), Math.round(cachedHorizonY * 0.90));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.78), Math.round(cachedHorizonY * 0.88));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.88), Math.round(cachedHorizonY * 0.64));
          horizonCtx.lineTo(hw, Math.round(cachedHorizonY * 0.64));
          horizonCtx.lineTo(hw, hh);
          horizonCtx.closePath();
          horizonCtx.fill();
        } else {
          horizonCtx.fillStyle = sky.mtnFar;
          horizonCtx.beginPath();
          horizonCtx.moveTo(0, hh);
          const ridgePts: [number, number][] = [
            [-0.45, 0.76],
            [0.08, 0.62],
            [0.24, 0.80],
            [0.45, 0.88],
            [0.65, 0.78],
            [0.86, 0.56],
            [1.45, 0.75],
          ];
          for (let r = 0; r < ridgePts.length; r++) {
            horizonCtx.lineTo(
              Math.round(overscan + ridgePts[r][0] * pxW),
              Math.round(cachedHorizonY * ridgePts[r][1])
            );
          }
          horizonCtx.lineTo(hw, hh);
          horizonCtx.closePath();
          horizonCtx.fill();

          if (biome.id === 'sakura') {
            const peakX = Math.round(overscan + 0.86 * pxW);
            const peakY = Math.round(cachedHorizonY * 0.56);
            horizonCtx.fillStyle =
              sky.id === 'red_moon'
                ? '#fda4af'
                : sky.id === 'golden_sunset'
                ? '#fed7aa'
                : sky.id === 'aurora_night'
                ? '#cffafe'
                : '#fdf2f8';
            horizonCtx.beginPath();
            horizonCtx.moveTo(peakX, peakY);
            horizonCtx.lineTo(peakX + 14, peakY + 11);
            horizonCtx.lineTo(peakX - 14, peakY + 11);
            horizonCtx.closePath();
            horizonCtx.fill();
          }

          horizonCtx.fillStyle = sky.mtnNear;
          horizonCtx.beginPath();
          horizonCtx.moveTo(0, hh);
          horizonCtx.lineTo(0, Math.round(cachedHorizonY * 0.84));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.18), Math.round(cachedHorizonY * 0.68));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.36), Math.round(cachedHorizonY * 0.90));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.70), Math.round(cachedHorizonY * 0.89));
          horizonCtx.lineTo(Math.round(overscan + pxW * 0.94), Math.round(cachedHorizonY * 0.66));
          horizonCtx.lineTo(hw, Math.round(cachedHorizonY * 0.82));
          horizonCtx.lineTo(hw, hh);
          horizonCtx.closePath();
          horizonCtx.fill();
        }
      }
    };

    const resize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      // Direct low-res 340px pixel-art canvas: GPU compositor handles nearest-neighbor scaling natively!
      pxH = 340;
      pxW = Math.max(170, Math.round(pxH * (viewW / Math.max(1, viewH))));
      displayCanvas.width = pxW;
      displayCanvas.height = pxH;
      ctx.imageSmoothingEnabled = false;

      cachedHorizonY = Math.round(pxH * 0.35);
      cachedSkyGrad = null;
      cachedMeadowGrad = null;
      cachedSkyKey = null;
    };
    resize();
    window.addEventListener('resize', resize);

    // Pre-allocated mutable biome config so frame rendering incurs zero object allocations
    const biome: RoadBiomeConfig = { ...resolveRoadBiome('tour', 0) };

    // Preload custom AI sprite if provided
    let customImgEl: HTMLImageElement | null = null;
    let loadedCustomUrl = '';

    // 1. Simulation State
    const STEP_DIST = 3.4;
    const VALLEY_FLOOR_Y = VALLEY_BASE_Y;
    let seed = 42;
    let track: SCurvePoint[] = [];
    let driftState: DriftPhysicsState = createInitialDriftState(0, 0, 0, -Math.PI / 2, 16);

    // Camera tracking state (dynamic elevated diagonal chase rig)
    let camFocusX = 0;
    let camFocusY = 0;
    let camFocusZ = 0;
    let camHeading = -Math.PI / 2;
    let camDiagBias = 0.45; // smooth lateral & yaw chase swing following drift direction
    let camSpeedZoom = 0;
    let visualDriftAngle = 0; // -1..+1 controls pixel-art car yaw silhouette

    // Gameplay metrics
    let score = 0;
    let distance = 0;
    let combo = 1;
    let maxCombo = 1;
    let wasDrifting = false;
    let driftSustainTimer = 0;
    let lastDriftSide = 0; // -1 left '\' or +1 right '/' for Style Switch detection
    let coinStreak = 0;
    let coinStreakTimer = 0;
    let sparkAudioCooldown = 0;
    let coinsRun = 0;
    let fever = 0;
    let isFever = false;
    let feverTimer = 0;
    let nearMissText = '';
    let nearMissTimer = 0;
    let activeDir: DiagonalDirection = 'right';
    let wheelSpinPhase = 0;

    // Breach / Fall-off & Traffic Crash state
    let isFalling = false;
    let fallTimer = 0;
    let fallVelX = 0;
    let fallVelY = 0;
    let fallVelZ = 0;
    let fallRotation = 0;
    let breachedSliceIdx = -1;
    let breachedSide = 1;
    let explodedInFall = false;

    // 2-Lane Highway Traffic Mode & Dopamine Rush state
    let trafficCars: TrafficCarState[] = [];
    let nextTrafficId = 1;
    let trafficSpawnCursor = 62;
    let overtakes = 0;
    let nearMisses = 0;
    let isTrafficCrash = false;
    let trafficCrashTimer = 0;
    let crashReason = 'Guardrail Breached';
    let slipstreamCharge = 0;
    let slipstreamCarId: number | null = null;
    let slipstreamBoostTimer = 0;
    let overtakeChain = 0;
    let overtakeChainTimer = 0;
    let nextMilestoneDist = 250;
    let lastRankCode = 'D';

    // Juice & Biome Transition
    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let hudEmitTimer = 0;
    let screenFlashAlpha = 0;
    let screenFlashColor = '#ffffff';
    let highBeamTimer = 0;
    let lastBiomeId: RoadBiomeId = resolveRoadBiome(roadModeRef.current, 0).id;
    let wasGassing = true;
    let prevSpeedKmh = 0;
    let turboChirpCooldown = 0;

    // Ring buffers for rear & front skid marks + bounded pools for particles & reusable 3D render slices
    const MAX_SKID = 160;
    const MAX_FRONT_SKID = 80;
    const makeSkidSlot = (): SkidSegment => ({
      lx: 0,
      lz: 0,
      rx: 0,
      rz: 0,
      y: 0,
      connected: false,
      widthScale: 1,
      alpha: 0.8,
      color: '#11141c',
      dirSign: 1,
    });
    const skidMarks: SkidSegment[] = Array.from({ length: MAX_SKID }, makeSkidSlot);
    let skidHead = 0;
    let skidCount = 0;

    const frontSkidMarks: SkidSegment[] = Array.from({ length: MAX_FRONT_SKID }, makeSkidSlot);
    let frontSkidHead = 0;
    let frontSkidCount = 0;

    const pushSkidMark = (
      lx: number,
      lz: number,
      rx: number,
      rz: number,
      y: number,
      connected: boolean,
      widthScale = 1,
      alpha = 0.8,
      color = '#11141c',
      dirSign: -1 | 1 = 1
    ) => {
      const idx = (skidHead + skidCount) % MAX_SKID;
      const seg = skidMarks[idx];
      seg.lx = lx;
      seg.lz = lz;
      seg.rx = rx;
      seg.rz = rz;
      seg.y = y;
      seg.connected = connected;
      seg.widthScale = widthScale;
      seg.alpha = alpha;
      seg.color = color;
      seg.dirSign = dirSign;
      if (skidCount < MAX_SKID) {
        skidCount++;
      } else {
        skidHead = (skidHead + 1) % MAX_SKID;
      }
    };

    const pushFrontSkidMark = (
      lx: number,
      lz: number,
      rx: number,
      rz: number,
      y: number,
      connected: boolean,
      widthScale = 0.85,
      alpha = 0.7,
      color = '#11141c',
      dirSign: -1 | 1 = 1
    ) => {
      const idx = (frontSkidHead + frontSkidCount) % MAX_FRONT_SKID;
      const seg = frontSkidMarks[idx];
      seg.lx = lx;
      seg.lz = lz;
      seg.rx = rx;
      seg.rz = rz;
      seg.y = y;
      seg.connected = connected;
      seg.widthScale = widthScale;
      seg.alpha = alpha;
      seg.color = color;
      seg.dirSign = dirSign;
      if (frontSkidCount < MAX_FRONT_SKID) {
        frontSkidCount++;
      } else {
        frontSkidHead = (frontSkidHead + 1) % MAX_FRONT_SKID;
      }
    };

    const getLastSkidMark = (): SkidSegment | null => {
      if (skidCount === 0) return null;
      return skidMarks[(skidHead + skidCount - 1) % MAX_SKID];
    };
    const getLastFrontSkidMark = (): SkidSegment | null => {
      if (frontSkidCount === 0) return null;
      return frontSkidMarks[(frontSkidHead + frontSkidCount - 1) % MAX_FRONT_SKID];
    };

    // Per-frame interactive tire state consumed right after camera registers lock in
    let tireEmitMode: 'none' | 'drift' | 'brake' | 'burnout' | 'scrape' | 'spray' = 'none';
    let tireSlipIntensity = 0;
    let tireBrakingNow = false;
    let tireGassingNow = false;
    let tireHighSparks = false;
    const tireWorldA = { x: 0, z: 0 };
    const tireWorldB = { x: 0, z: 0 };
    const tireFrontWorldA = { x: 0, z: 0 };
    const tireFrontWorldB = { x: 0, z: 0 };

    const MAX_SMOKE = 95;
    const MAX_DEBRIS = 95;
    const MAX_SHOCKWAVES = 16;
    const MAX_CALLOUTS = 14;
    const smokePuffs: SmokePuff[] = [];
    const debrisChunks: DebrisChunk[] = [];
    const shockwaves: ShockwaveRing[] = [];
    const callouts: FloatingCallout[] = [];
    const valleyProps: WorldProp3D[] = [];
    let propSpawnCursorZ = 24;

    const pushSmokePuff = (puff: SmokePuff) => {
      if (smokePuffs.length >= MAX_SMOKE) return;
      smokePuffs.push(puff);
    };
    const pushDebrisChunk = (chunk: DebrisChunk) => {
      if (debrisChunks.length >= MAX_DEBRIS) return;
      debrisChunks.push(chunk);
    };
    const pushShockwave = (ring: ShockwaveRing) => {
      if (shockwaves.length >= MAX_SHOCKWAVES) return;
      shockwaves.push(ring);
    };
    const pushCallout = (
      x: number,
      y: number,
      z: number,
      text: string,
      color: string,
      life: number
    ) => {
      if (callouts.length >= MAX_CALLOUTS) return;
      ctx.font = 'bold 8px "Chakra Petch", monospace';
      const halfW = Math.ceil(ctx.measureText(text).width * 0.5) + 4;
      callouts.push({ x, y, z, text, color, life, maxLife: life, halfW });
    };

    // Pre-allocated pool of 24 floating animated reward text popups (+50 CR, +150 CR) for zero-GC churn
    const MAX_FLOATING_TEXTS = 24;
    const floatingTextPool: FloatingTextParticle[] = Array.from({ length: MAX_FLOATING_TEXTS }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      text: '',
      color: '#fbbf24',
      life: 0,
      maxLife: 0.75,
    }));

    const spawnFloatingText = (
      x: number,
      y: number,
      z: number,
      text: string,
      color = '#fbbf24',
      duration = 0.75
    ) => {
      let slot: FloatingTextParticle | null = null;
      let minLife = Infinity;
      let oldestSlot: FloatingTextParticle = floatingTextPool[0];
      for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
        const item = floatingTextPool[i];
        if (!item.active) {
          slot = item;
          break;
        }
        if (item.life < minLife) {
          minLife = item.life;
          oldestSlot = item;
        }
      }
      const target = slot || oldestSlot;
      target.active = true;
      target.x = x;
      target.y = y;
      target.z = z;
      target.text = text;
      target.color = color;
      target.life = duration;
      target.maxLife = duration;
    };

    // Pre-allocated 3D road slice pool, prop sort buffer, vehicle sort buffer & scratch projected structs
    const makeEmptyProj = (): Projected3D => ({ x: 0, y: 0, z: 0, scale: 0 });
    const slicePool: RoadSlice3D[] = Array.from({ length: 110 }, () => ({
      pt: null as unknown as SCurvePoint,
      rawZ: 0,
      pL: makeEmptyProj(),
      pR: makeEmptyProj(),
      uL: makeEmptyProj(),
      uR: makeEmptyProj(),
      gL: makeEmptyProj(),
      gR: makeEmptyProj(),
      cM: makeEmptyProj(),
    }));
    const propSortBuf: { prop: WorldProp3D; rawZ: number }[] = Array.from({ length: 120 }, () => ({
      prop: null as unknown as WorldProp3D,
      rawZ: 0,
    }));
    const vehicleDrawBuf: {
      rawZ: number;
      isHero: boolean;
      proj: Projected3D;
      traffic?: TrafficCarState;
    }[] = Array.from({ length: 48 }, () => ({
      rawZ: 0,
      isHero: false,
      proj: makeEmptyProj(),
      traffic: undefined,
    }));
    const pScratch0 = makeEmptyProj();
    const pScratch1 = makeEmptyProj();
    const pScratch2 = makeEmptyProj();
    const pScratch3 = makeEmptyProj();
    const pScratch4 = makeEmptyProj();
    const pScratch5 = makeEmptyProj();
    const pScratchTmp = makeEmptyProj();
    const pScratchTmp2 = makeEmptyProj();
    const pScratchTmp3 = makeEmptyProj();
    const pScratchTmp4 = makeEmptyProj();

    const ambientParticles: AmbientParticle[] = Array.from({ length: 24 }, (_, idx) => ({
      sx: (idx * 37) % 240,
      sy: (idx * 53) % 340,
      vx: -14 - (idx % 5) * 4,
      vy: 18 + (idx % 4) * 6,
      size: idx % 3 === 0 ? 3 : 2,
      phase: idx * 0.7,
    }));

    function findClosestTrackAnchor(targetZ: number): SCurvePoint | null {
      let best: SCurvePoint | null = null;
      let bestDz = Infinity;
      for (let i = 0; i < track.length; i++) {
        const dz = Math.abs(track[i].z - targetZ);
        if (dz < bestDz) {
          bestDz = dz;
          best = track[i];
        }
      }
      return best;
    }

    function populateTreesAround(centerZ: number) {
      if (valleyProps.length > 0 && valleyProps[0].z > centerZ + 40) {
        compactInPlace(valleyProps, (p) => p.z <= centerZ + 40);
      }
      if (valleyProps.length === 0) {
        propSpawnCursorZ = centerZ + 22;
      }
      while (propSpawnCursorZ > centerZ - 195) {
        propSpawnCursorZ -= 5.2 + Math.random() * 4.4;
        const anchor = findClosestTrackAnchor(propSpawnCursorZ);
        const side = Math.random() > 0.5 ? 1 : -1;
        const lateralOffset = side * (12.6 + Math.random() * 38);
        const baseX = anchor ? anchor.x : 0;
        const nx = anchor ? anchor.nx : 1;
        const nz = anchor ? anchor.nz : 0;
        valleyProps.push({
          x: baseX + nx * lateralOffset,
          z: (anchor ? anchor.z : propSpawnCursorZ) + nz * lateralOffset,
          lateralOffset,
          scale: 0.78 + Math.random() * 0.85,
          shade: Math.random(),
          variant: Math.floor(Math.random() * 3),
        });
      }
    }

    function resetSimulation() {
      seed = Math.floor(Math.random() * 1000) + 17;
      const isHighway = gameModeRef.current === 'highway_traffic';
      track = isHighway
        ? generateHighwayTrack(75, STEP_DIST, seed)
        : generateSCurveTrack(65, STEP_DIST, seed);
      const startPt = track[0];
      const spawnOffset = isHighway ? HIGHWAY_LANE_OFFSET : 0;
      driftState = createInitialDriftState(
        startPt.x + startPt.nx * spawnOffset,
        startPt.z + startPt.nz * spawnOffset,
        startPt.y,
        startPt.heading,
        carRef.current.baseSpeed * 0.78
      );

      camFocusX = driftState.x;
      camFocusY = driftState.y;
      camFocusZ = driftState.z;
      camHeading = startPt.heading;
      visualDriftAngle = isHighway ? 0.0 : 0.25;

      score = 0;
      distance = 0;
      combo = 1;
      maxCombo = 1;
      wasDrifting = false;
      driftSustainTimer = 0;
      lastDriftSide = 0;
      coinStreak = 0;
      coinStreakTimer = 0;
      sparkAudioCooldown = 0;
      coinsRun = 0;
      fever = 0;
      isFever = false;
      feverTimer = 0;
      nearMissText = '';
      nearMissTimer = 0;
      activeDir = 'right';

      isFalling = false;
      fallTimer = 0;
      fallVelX = 0;
      fallVelY = 0;
      fallVelZ = 0;
      fallRotation = 0;
      breachedSliceIdx = -1;
      breachedSide = 1;
      explodedInFall = false;

      trafficCars = [];
      nextTrafficId = 1;
      trafficSpawnCursor = 62;
      overtakes = 0;
      nearMisses = 0;
      isTrafficCrash = false;
      trafficCrashTimer = 0;
      crashReason = 'Guardrail Breached';
      slipstreamCharge = 0;
      slipstreamCarId = null;
      slipstreamBoostTimer = 0;
      overtakeChain = 0;
      overtakeChainTimer = 0;
      nextMilestoneDist = 250;
      lastRankCode = 'D';
      if (isHighway) {
        const batch = generateTrafficBatch({
          startS: 58,
          endS: 270,
          nextIdStart: nextTrafficId,
          seed,
          existingCars: trafficCars,
          difficultyProgress: 0,
        });
        trafficCars = batch.cars;
        nextTrafficId = batch.nextId;
        trafficSpawnCursor = 270;
      }

      hitstopTimer = 0;
      cameraTrauma = 0;
      screenFlashAlpha = 0;
      highBeamTimer = 0;
      const startBiome = resolveRoadBiome(roadModeRef.current, 0);
      lastBiomeId = startBiome.id;

      skidHead = 0;
      skidCount = 0;
      frontSkidHead = 0;
      frontSkidCount = 0;
      tireEmitMode = 'none';
      tireSlipIntensity = 0;
      tireBrakingNow = false;
      tireGassingNow = false;
      tireHighSparks = false;
      smokePuffs.length = 0;
      debrisChunks.length = 0;
      shockwaves.length = 0;
      callouts.length = 0;
      for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
        floatingTextPool[i].active = false;
        floatingTextPool[i].life = 0;
      }
      wasGassing = true;
      prevSpeedKmh = 0;
      turboChirpCooldown = 0;
      valleyProps.length = 0;
      propSpawnCursorZ = driftState.z + 22;
      populateTreesAround(driftState.z);

      onTelemetryRef.current({
        score: 0,
        distance: 0,
        combo: 1,
        maxCombo: 1,
        coinsRun: 0,
        fever: 0,
        isFever: false,
        speedKmh: Math.round(carRef.current.baseSpeed * 7.2),
        direction: activeDir,
        nearMissText: '',
        isDrifting: false,
        biomeName: startBiome.name,
        overtakes: 0,
        nearMisses: 0,
      });
    }

    resetSimulation();

    // 2. Unified Input Hub (Pointer Touch Left/Right + Keyboard Arrows/WASD/Space)
    let keyLeft = false;
    let keyRight = false;
    let keyUp = false;
    let keyDown = false;
    let keyHandbrake = false;
    const activePointers = new Map<number, number>();
    const pointerStartX = new Map<number, number>();
    const pointerCurrentX = new Map<number, number>();
    let pointerSteer = 0;
    let tapImpulseTimer = 0;
    let tapImpulseDir = 0;

    const recalcPointerSteer = () => {
      if (pointerCurrentX.size === 0) {
        pointerSteer = 0;
        return;
      }
      if (controlSchemeRef.current === 'swipe') {
        let totalSteer = 0;
        let count = 0;
        pointerCurrentX.forEach((curX, id) => {
          const startX = pointerStartX.get(id) ?? curX;
          const deltaX = curX - startX;
          if (Math.abs(deltaX) > 10) {
            // Dragging finger left/right maps to smooth steering hold -1 to +1
            const dragRatio = Math.max(-1, Math.min(1, deltaX / 75));
            totalSteer += dragRatio;
          } else {
            // Tapping left half steers left (-1) and right half steers right (+1)
            totalSteer += curX < window.innerWidth * 0.5 ? -1 : 1;
          }
          count++;
        });
        pointerSteer = count > 0 ? Math.max(-1, Math.min(1, totalSteer / count)) : 0;
      } else {
        let sumX = 0;
        pointerCurrentX.forEach((cx) => {
          sumX += cx;
        });
        const avgX = sumX / pointerCurrentX.size;
        pointerSteer = avgX < window.innerWidth * 0.5 ? -1 : 1;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      // Ignore clicks on top/bottom HUD buttons
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button[data-hud-btn="true"]')) return;
      activePointers.set(e.pointerId, e.clientX);
      pointerStartX.set(e.pointerId, e.clientX);
      pointerCurrentX.set(e.pointerId, e.clientX);
      recalcPointerSteer();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerCurrentX.has(e.pointerId)) return;
      pointerCurrentX.set(e.pointerId, e.clientX);
      recalcPointerSteer();
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      pointerStartX.delete(e.pointerId);
      pointerCurrentX.delete(e.pointerId);
      recalcPointerSteer();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyLeft = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keyRight = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keyUp = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keyDown = true;
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        keyHandbrake = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keyRight = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keyUp = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keyDown = false;
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        keyHandbrake = false;
      }
    };

    const clearInputs = () => {
      keyLeft = false;
      keyRight = false;
      keyUp = false;
      keyDown = false;
      keyHandbrake = false;
      activePointers.clear();
      pointerStartX.clear();
      pointerCurrentX.clear();
      pointerSteer = 0;
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);

    // 3. Zero-Allocation 3D Camera Perspective Projection & Direct Quad Rasterizer
    let fCamX = 0;
    let fCamY = 0;
    let fCamZ = 0;
    let fFwdX = 0;
    let fFwdZ = -1;
    let fRightX = 1;
    let fRightZ = 0;
    let fHorizonY = 120;
    let fFovScale = 300;
    let fShakeX = 0;
    let fShakeY = 0;

    const projectInto: Project3DIntoFn = (wx, wy, wz, out, clampMinZ) => {
      const dx = wx - fCamX;
      const dy = wy - fCamY;
      const dz = wz - fCamZ;

      const rawCamZ = dx * fFwdX + dz * fFwdZ;
      if (clampMinZ === undefined) {
        if (rawCamZ < 1.2) return false;
      } else if (rawCamZ < -3.6) {
        return false;
      }

      const camZ = clampMinZ !== undefined && rawCamZ < clampMinZ ? clampMinZ : rawCamZ;
      const camX = dx * fRightX + dz * fRightZ;
      const camY = dy + camZ * 0.068;

      const invZ = fFovScale / camZ;
      out.x = pxW * 0.5 + camX * invZ + fShakeX;
      out.y = fHorizonY - camY * invZ + fShakeY;
      out.z = camZ;
      out.scale = invZ;
      return true;
    };

    // Closed-form inverse of projectInto onto horizontal road plane y = roadY
    const unprojectTireToRoad = (sx: number, sy: number, roadY: number, out: { x: number; z: number }) => {
      const dy = roadY - fCamY;
      const syNorm = (fHorizonY + fShakeY - sy) / fFovScale;
      const denom = Math.min(-0.08, syNorm - 0.068);
      const camZ = Math.max(2.0, Math.min(25.0, dy / denom));
      const camX = ((sx - pxW * 0.5 - fShakeX) * camZ) / fFovScale;
      out.x = fCamX + camZ * fFwdX + camX * fRightX;
      out.z = fCamZ + camZ * fFwdZ + camX * fRightZ;
    };

    function drawQuadPts(
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
      d: { x: number; y: number },
      fillStyle: string,
      strokeStyle?: string,
      lineWidth = 1
    ) {
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x), Math.round(a.y));
      ctx.lineTo(Math.round(b.x), Math.round(b.y));
      ctx.lineTo(Math.round(c.x), Math.round(c.y));
      ctx.lineTo(Math.round(d.x), Math.round(d.y));
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    // Cached car appearance & stats (recomputed only when car/upgrades/custom refs change)
    let cachedCarObj = carRef.current;
    let cachedUpgradesObj = upgradesRef.current;
    let cachedCustomObj = carCustomRef.current;
    let cachedAppearance = resolveCarAppearance(cachedCarObj, cachedCustomObj);
    let cachedStats = computeEffectiveCarStats(cachedCarObj, cachedUpgradesObj, cachedCustomObj);

    let lastHudScore = -1;
    let lastHudDist = -1;
    let lastHudCombo = -1;
    let lastHudCoins = -1;
    let lastHudFever = -1;
    let lastHudIsFever = false;
    let lastHudSpeed = -1;
    let lastHudDir: DiagonalDirection | '' = '';
    let lastHudMsg = '';
    let lastHudOvertakes = -1;
    let lastHudNearMisses = -1;

    // 4. Main Simulation & Pixel-Art Rendering Loop
    let animId = 0;
    let lastTime = performance.now();

    function loop() {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const phase = phaseRef.current;
      const currentCar = carRef.current;
      const currentUpgrades = upgradesRef.current;
      const currentCustom = carCustomRef.current;
      if (
        currentCar !== cachedCarObj ||
        currentUpgrades !== cachedUpgradesObj ||
        currentCustom !== cachedCustomObj
      ) {
        cachedCarObj = currentCar;
        cachedUpgradesObj = currentUpgrades;
        cachedCustomObj = currentCustom;
        cachedAppearance = resolveCarAppearance(currentCar, currentCustom);
        cachedStats = computeEffectiveCarStats(currentCar, currentUpgrades, currentCustom);
      }
      const currentAppearance = cachedAppearance;
      const stats = cachedStats;

      if (customSpriteRef.current && customSpriteRef.current !== loadedCustomUrl) {
        loadedCustomUrl = customSpriteRef.current;
        const img = new Image();
        img.src = loadedCustomUrl;
        img.onload = () => {
          customImgEl = img;
        };
      } else if (!customSpriteRef.current) {
        customImgEl = null;
        loadedCustomUrl = '';
      }

      if (pendingResetRef.current) {
        pendingResetRef.current = false;
        resetSimulation();
      }

      tireEmitMode = 'none';
      tireSlipIntensity = 0;
      tireBrakingNow = false;
      tireGassingNow = false;
      tireHighSparks = false;

      if (highBeamTimer > 0) {
        highBeamTimer = Math.max(0, highBeamTimer - dt);
      }

      // Handle manual direction flip button from bottom dock / quick tap
      if (pendingFlipRef.current) {
        pendingFlipRef.current = false;
        if (phase === 'playing' && !isFalling) {
          tapImpulseDir = activeDir === 'right' ? -1 : 1;
          tapImpulseTimer = 0.28;
          activeDir = tapImpulseDir > 0 ? 'right' : 'left';
        }
      }

      const isHighwayMode = gameModeRef.current === 'highway_traffic';

      if (phase !== 'playing') {
        soundFX.stopEngineSound();
        soundFX.updateMusicEffects({
          phase,
          speedRatio: 0.7,
          isDrifting: false,
          driftFactor: 0,
          isFever: false,
          isBraking: false,
          isNearEdge: false,
        });
      }

      // Title Showcase Cruise along the continuous S-curve viaduct or 2-lane highway!
      if (phase === 'title') {
        const speed = isHighwayMode ? 17.0 : 13.0;
        const roadEval = evaluateCarOnSCurveRoad(driftState.x, driftState.z, track, 2.0);
        const targetHeading = roadEval.closestPoint ? roadEval.closestPoint.heading : -Math.PI / 2;

        if (isHighwayMode && roadEval.closestPoint) {
          const playerSNow =
            roadEval.closestPoint.index * STEP_DIST +
            ((driftState.x - roadEval.closestPoint.x) * roadEval.closestPoint.tx +
              (driftState.z - roadEval.closestPoint.z) * roadEval.closestPoint.tz);
          // Cruise smoothly in right lane; weave left to overtake slow right-lane cars when oncoming lane is open!
          const rightAhead = trafficCars.some(
            (c) => !c.isOncoming && c.s > playerSNow && c.s < playerSNow + 20
          );
          const leftDanger = trafficCars.some(
            (c) => c.isOncoming && c.s > playerSNow - 4 && c.s < playerSNow + 28
          );
          const desiredOffset = rightAhead && !leftDanger ? -HIGHWAY_LANE_OFFSET : HIGHWAY_LANE_OFFSET;
          const steerDemo =
            (desiredOffset - roadEval.signedPerpOffset) * 0.45 +
            normalizeAngle(targetHeading - driftState.heading) * 1.8;
          driftState = stepHighwayPhysics(
            driftState,
            {
              steerInput: Math.max(-1, Math.min(1, steerDemo)),
              accelInput: 0.25,
              brakeInput: 0,
              roadTangentAngle: targetHeading,
            },
            { topSpeed: speed, handlingRate: 2.8 },
            dt
          );
          driftState.y = roadEval.closestPoint.y;
          camHeading += normalizeAngle(roadEval.closestPoint.heading - camHeading) * Math.min(1, 5.0 * dt);

          const angleDiff = normalizeAngle(driftState.heading - camHeading);
          visualDriftAngle += (Math.max(-0.36, Math.min(0.36, angleDiff * 1.35)) - visualDriftAngle) * Math.min(1, 8 * dt);
          activeDir = visualDriftAngle >= 0 ? 'right' : 'left';
          wheelSpinPhase += dt * 18;

          for (let i = 0; i < trafficCars.length; i++) {
            trafficCars[i].s += (trafficCars[i].isOncoming ? -1 : 1) * trafficCars[i].speed * dt;
          }
          compactInPlace(trafficCars, (c) => c.s > playerSNow - 24);
          if (trafficSpawnCursor < playerSNow + 240) {
            const batch = generateTrafficBatch({
              startS: trafficSpawnCursor,
              endS: playerSNow + 270,
              nextIdStart: nextTrafficId,
              seed,
              existingCars: trafficCars,
              difficultyProgress: 0.25,
            });
            for (let b = 0; b < batch.cars.length; b++) trafficCars.push(batch.cars[b]);
            nextTrafficId = batch.nextId;
            trafficSpawnCursor = playerSNow + 270;
          }

          const lastPt = track[track.length - 1];
          if (lastPt && driftState.z - lastPt.z < 155) {
            const ext = extendHighwayTrack(track, 20, STEP_DIST, seed);
            for (let e = 0; e < ext.length; e++) track.push(ext[e]);
            while (track.length > 90 && track[0].z > driftState.z + 32) {
              track.shift();
            }
            populateTreesAround(driftState.z);
          }

          camFocusX += (roadEval.closestPoint.x - camFocusX) * Math.min(1, 6 * dt);
          camFocusY += (driftState.y - camFocusY) * Math.min(1, 8 * dt);
          camFocusZ += (roadEval.closestPoint.z - camFocusZ) * Math.min(1, 8 * dt);
        } else {
          // Smoothly cruise and hold a dramatic diagonal drift showcase on Title Screen
          const steerDemo = 0.55 * Math.sin(now * 0.0014) + 0.35 + normalizeAngle(targetHeading - driftState.heading) * 1.4;
          driftState = stepDriftPhysics(
            driftState,
            { steerInput: Math.max(-1, Math.min(1, steerDemo)), throttle: 0.78 },
            { topSpeed: speed, driftGrip: 0.72, handlingRate: 2.6 },
            dt
          );

          // Keep title car safely centered on the viaduct
          if (roadEval.closestPoint) {
            driftState.x += (roadEval.closestPoint.x - driftState.x) * Math.min(1, 2.8 * dt);
            driftState.y = roadEval.closestPoint.y;
            camHeading += normalizeAngle(roadEval.closestPoint.heading - camHeading) * Math.min(1, 4.5 * dt);
          }

          // Showcase diagonal drift pose (`/` angle) + exact tire-anchored skid marks & smoke!
          const angleDiff = normalizeAngle(driftState.heading - camHeading);
          const showcaseBias = Math.sin(now * 0.0011) >= -0.3 ? 0.68 : -0.68;
          const targetPose = Math.max(-1, Math.min(1, angleDiff * 2.2 + showcaseBias * 0.55));
          visualDriftAngle += (targetPose - visualDriftAngle) * Math.min(1, 6 * dt);
          activeDir = visualDriftAngle >= 0 ? 'right' : 'left';
          wheelSpinPhase += dt * 16;

          if (Math.abs(visualDriftAngle) > 0.22) {
            tireEmitMode = 'drift';
            tireSlipIntensity = Math.min(1, Math.abs(visualDriftAngle) * 1.15);
          }

          // Extend endless road for continuous title flyover
          const lastPt = track[track.length - 1];
          if (lastPt && driftState.z - lastPt.z < 145) {
            const ext = extendSCurveTrack(track, 20, STEP_DIST, seed);
            for (let e = 0; e < ext.length; e++) track.push(ext[e]);
            while (track.length > 85 && track[0].z > driftState.z + 30) {
              track.shift();
            }
            populateTreesAround(driftState.z);
          }

          camFocusX += (driftState.x - camFocusX) * Math.min(1, 8 * dt);
          camFocusY += (driftState.y - camFocusY) * Math.min(1, 8 * dt);
          camFocusZ += (driftState.z - camFocusZ) * Math.min(1, 8 * dt);
        }
      } else if (phase === 'playing') {
        if (hitstopTimer > 0) hitstopTimer = Math.max(0, hitstopTimer - dt);
        const simDt = hitstopTimer > 0 ? 0 : dt;

        // Fever / Nitro trigger
        if (pendingBoostRef.current) {
          pendingBoostRef.current = false;
          if (fever >= 40 && !isFever && !isFalling) {
            isFever = true;
            feverTimer = 5.0;
            cameraTrauma = Math.min(1, cameraTrauma + 0.45);
            screenFlashAlpha = 0.28;
            screenFlashColor = '#22d3ee';
            soundFX.playFeverBurst();
            triggerHaptic('fever');
            pushShockwave({
              x: driftState.x,
              y: driftState.y + 0.15,
              z: driftState.z,
              radius: 0.6,
              maxRadius: 5.0,
              color: '#22d3ee',
              life: 0.42,
              maxLife: 0.42,
            });
            pushCallout(driftState.x, driftState.y + 1.5, driftState.z, 'FEVER OVERDRIVE!', '#22d3ee', 1.4);
          }
        }

        if (tapImpulseTimer > 0) tapImpulseTimer = Math.max(0, tapImpulseTimer - dt);

        // Combine Steering Inputs (Keyboard, Touch Hold, HUD Hold, Quick Tap)
        let steerInput = 0;
        if (keyLeft) steerInput -= 1;
        if (keyRight) steerInput += 1;
        if (steerInput === 0 && pointerSteer !== 0) steerInput = pointerSteer;
        if (steerInput === 0 && steerHoldRef.current !== 0) steerInput = steerHoldRef.current;
        if (steerInput === 0 && tapImpulseTimer > 0) steerInput = tapImpulseDir;

        if (!isFalling && !isTrafficCrash && simDt > 0) {
          if (isFever) {
            feverTimer -= simDt;
            fever = Math.max(0, (feverTimer / 5.0) * 100);
            if (feverTimer <= 0) {
              isFever = false;
              fever = 0;
            }
          }

          const preRoadEval = evaluateCarOnSCurveRoad(
            driftState.x,
            driftState.z,
            track,
            stats.roadAllowanceBonus
          );
          const roadTangent = preRoadEval.closestPoint ? preRoadEval.closestPoint.heading : -Math.PI / 2;

          if (slipstreamBoostTimer > 0) {
            slipstreamBoostTimer = Math.max(0, slipstreamBoostTimer - simDt);
          }
          if (overtakeChainTimer > 0) {
            overtakeChainTimer = Math.max(0, overtakeChainTimer - simDt);
            if (overtakeChainTimer === 0) overtakeChain = 0;
          }

          // Progressive speed scale + Gas/Brake pedal + Slipstream rush boost
          const speedBoost =
            (isFever ? 1.28 : 1.0) +
            (slipstreamBoostTimer > 0 ? 0.18 : slipstreamCharge * 0.14) +
            Math.min(0.25, distance * 0.00025);
          const brakeInput = keyDown ? 1 : 0;
          const accelInput = brakeInput > 0 ? 0 : 1;

          if (isHighwayMode) {
            driftState = stepHighwayPhysics(
              driftState,
              {
                steerInput,
                accelInput,
                brakeInput,
                handbrake: keyHandbrake,
                roadTangentAngle: roadTangent,
              },
              {
                topSpeed: stats.topSpeed * speedBoost,
                handlingRate: stats.handlingRate * 1.05,
              },
              simDt
            );
          } else {
            driftState = stepDriftPhysics(
              driftState,
              {
                steerInput,
                throttle: brakeInput > 0 ? 0.58 : accelInput > 0 ? 1.26 : 1.0,
                handbrake: keyHandbrake,
                roadTangentAngle: roadTangent,
              },
              {
                topSpeed: stats.topSpeed * speedBoost,
                driftGrip: stats.driftGrip,
                handlingRate: stats.handlingRate,
              },
              simDt
            );
          }

          const curSpeed = Math.hypot(driftState.vx, driftState.vz);
          const stepDist = curSpeed * simDt;
          distance += stepDist;
          wheelSpinPhase += stepDist * 0.65;

          const speedKmhNow = curSpeed * 7.2;
          if (turboChirpCooldown > 0) turboChirpCooldown -= dt;
          const isGassingNow = accelInput > 0;
          if (
            phase === 'playing' &&
            !isFalling &&
            turboChirpCooldown <= 0 &&
            speedKmhNow > 90 &&
            ((wasGassing && !isGassingNow) || (brakeInput > 0 && prevSpeedKmh - speedKmhNow > 1.2))
          ) {
            turboChirpCooldown = 0.95;
            soundFX.playTurboChirp();
          }
          wasGassing = isGassingNow;
          prevSpeedKmh = speedKmhNow;

          const speedRatio = curSpeed / Math.max(12, stats.topSpeed);
          soundFX.updateEngineSound({
            active: true,
            speedRatio,
            isGassing: accelInput > 0,
            isBraking: brakeInput > 0,
            isFever,
            soundProfile: currentAppearance.sound,
          });
          soundFX.updateMusicEffects({
            phase: isFalling ? 'gameover' : 'playing',
            speedRatio,
            isDrifting: driftState.isDrifting,
            driftFactor: driftState.driftFactor,
            isFever,
            isBraking: brakeInput > 0,
            isNearEdge: Boolean(wasDrifting && combo >= 3),
          });

          // Distance Milestone & Live Mid-Run Rank-Up Dopamine Bursts!
          if (distance >= nextMilestoneDist) {
            const reached = nextMilestoneDist;
            nextMilestoneDist += 250;
            const mCoins = 20;
            coinsRun += mCoins;
            score += 400;
            cameraTrauma = Math.min(1, cameraTrauma + 0.25);
            screenFlashAlpha = 0.2;
            screenFlashColor = '#fbbf24';
            soundFX.playMilestone();
            nearMissText = `${reached}m MILESTONE! +${mCoins} CR`;
            nearMissTimer = 1.6;
            pushShockwave({
              x: driftState.x,
              y: driftState.y + 0.2,
              z: driftState.z,
              radius: 0.5,
              maxRadius: 4.8,
              color: '#fbbf24',
              life: 0.4,
              maxLife: 0.4,
            });
            pushCallout(
              driftState.x,
              driftState.y + 1.9,
              driftState.z,
              `${reached}m CLEAR! +${mCoins} CR`,
              '#fbbf24',
              1.25
            );
          }

          const curRank = getDriftRank(score);
          if (curRank.rank !== lastRankCode) {
            lastRankCode = curRank.rank;
            if (curRank.rank !== 'D') {
              screenFlashAlpha = 0.24;
              screenFlashColor = curRank.color;
              soundFX.playMilestone();
              nearMissText = `RANK UP · ${curRank.rank} ${curRank.title}!`;
              nearMissTimer = 1.8;
            }
          }

          const curBiome = resolveRoadBiome(roadModeRef.current, distance);
          if (curBiome.id !== lastBiomeId) {
            lastBiomeId = curBiome.id;
            nearMissText = `ENTERING ${curBiome.name.toUpperCase()}`;
            nearMissTimer = 1.8;
            pushShockwave({
              x: driftState.x,
              y: driftState.y + 0.15,
              z: driftState.z,
              radius: 0.8,
              maxRadius: 5.5,
              color: curBiome.badgeColor,
              life: 0.45,
              maxLife: 0.45,
            });
            pushCallout(
              driftState.x,
              driftState.y + 2.0,
              driftState.z,
              curBiome.name.toUpperCase(),
              curBiome.badgeColor,
              1.4
            );
          }

          const roadCheck = evaluateCarOnSCurveRoad(
            driftState.x,
            driftState.z,
            track,
            stats.roadAllowanceBonus
          );

          if (roadCheck.closestPoint) {
            driftState.y += (roadCheck.closestPoint.y - driftState.y) * Math.min(1, 14 * simDt);
            // Smoothly follow road curve heading with chase camera
            camHeading += normalizeAngle(roadCheck.closestPoint.heading - camHeading) * Math.min(1, 3.8 * simDt);
          }

          // Compute car silhouette angle (-1 '\' .. +1 '/'); keep highway driving crisp & planted!
          const angleRelCam = normalizeAngle(driftState.heading - camHeading);
          let targetVisualAngle = isHighwayMode
            ? Math.max(-0.40, Math.min(0.40, angleRelCam * 1.35 + steerInput * 0.16))
            : Math.max(-1, Math.min(1, angleRelCam * 2.1 + steerInput * 0.35));
          // Snap clean deadzone to exact 0.0 (| straight rear angle) when driving forward without drift
          if (Math.abs(targetVisualAngle) < 0.045 && Math.abs(steerInput) < 0.045 && !driftState.isDrifting) {
            targetVisualAngle = 0;
          }
          visualDriftAngle += (targetVisualAngle - visualDriftAngle) * Math.min(1, 12 * simDt);
          if (Math.abs(visualDriftAngle) < 0.015 && targetVisualAngle === 0) {
            visualDriftAngle = 0;
          }
          activeDir = visualDriftAngle >= 0 ? 'right' : 'left';

          // Check Road / Guardrail Bounds
          if (!roadCheck.onRoad) {
            if (gameModeRef.current === 'zen') {
              // ZEN MODE: NEVER FALL OR BREACH! Soft rebound & boundary clamping
              const halfW = roadCheck.halfWidth || 4.9;
              const maxLat = Math.max(0.5, halfW - 0.20);
              const clampedLat = Math.max(-maxLat, Math.min(maxLat, roadCheck.signedPerpOffset));

              if (roadCheck.closestPoint) {
                driftState.x = roadCheck.closestPoint.x + roadCheck.closestPoint.nx * clampedLat;
                driftState.z = roadCheck.closestPoint.z + roadCheck.closestPoint.nz * clampedLat;

                const vFwd = driftState.vx * roadCheck.closestPoint.tx + driftState.vz * roadCheck.closestPoint.tz;
                const vLat = driftState.vx * roadCheck.closestPoint.nx + driftState.vz * roadCheck.closestPoint.nz;
                const bounceSign = clampedLat >= 0 ? -1 : 1;
                const reboundVLat = bounceSign * Math.abs(vLat) * 0.4;

                driftState.vx = roadCheck.closestPoint.tx * vFwd + roadCheck.closestPoint.nx * reboundVLat;
                driftState.vz = roadCheck.closestPoint.tz * vFwd + roadCheck.closestPoint.nz * reboundVLat;
              }

              soundFX.playGearShift();
              triggerHaptic('light');
              cameraTrauma = Math.min(0.25, cameraTrauma + 0.12);
              pushCallout(driftState.x, driftState.y + 1.6, driftState.z, 'CHILL FLOW', '#38bdf8', 0.65);

              // Soft dust and gentle sparks
              for (let i = 0; i < 4; i++) {
                const ang = Math.random() * Math.PI * 2;
                pushDebrisChunk({
                  x: driftState.x,
                  y: driftState.y + 0.35,
                  z: driftState.z,
                  vx: Math.cos(ang) * (1.5 + Math.random() * 2.5),
                  vy: 1.2 + Math.random() * 1.8,
                  vz: Math.sin(ang) * (1.5 + Math.random() * 2.5),
                  size: 0.18,
                  w: 0.25,
                  h: 0.15,
                  gravity: 10,
                  rot: Math.random() * 4,
                  vRot: (Math.random() - 0.5) * 6,
                  life: 0.4,
                  color: '#93c5fd',
                });
              }
              pushSmokePuff({
                x: driftState.x,
                y: driftState.y + 0.2,
                z: driftState.z,
                vx: (Math.random() - 0.5) * 1.2,
                vy: 0.8 + Math.random() * 0.6,
                vz: (Math.random() - 0.5) * 1.2,
                radius: 0.3,
                maxRadius: 0.9,
                life: 0.35,
                maxLife: 0.35,
                tint: 'cyan',
              });
            } else {
              // STAGE 1: BREACHED GUARDRAIL -> Shatter Steel Rail, Flash, Shockwave & Launch Over Edge!
              isFalling = true;
              fallTimer = 0;
              explodedInFall = false;
              breachedSliceIdx = roadCheck.closestPoint ? roadCheck.closestPoint.index : -1;
              breachedSide = roadCheck.signedPerpOffset >= 0 ? 1 : -1;
              fallVelX = driftState.vx * 0.86 + breachedSide * 3.8;
              fallVelZ = driftState.vz * 0.86;
              fallVelY = 5.4; // Dramatic vault over guardrail
              hitstopTimer = 0.08;
              cameraTrauma = 1.0;
              screenFlashAlpha = 0.72;
              screenFlashColor = '#fef08a';
              soundFX.playFallAndDestroy();
              triggerHaptic('heavy');

              pushShockwave({
                x: driftState.x,
                y: driftState.y + 0.4,
                z: driftState.z,
                radius: 0.4,
                maxRadius: 4.8,
                color: '#fbbf24',
                life: 0.36,
                maxLife: 0.36,
              });
              pushCallout(driftState.x, driftState.y + 1.6, driftState.z, 'GUARDRAIL BREACH!', '#fbbf24', 0.85);

              // Shatter Twisted Steel Guardrail Beam Chunks + Blazing Sparks!
              const activeBiomeNow = resolveRoadBiome(roadModeRef.current, distance);
              for (let i = 0; i < 8; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 3 + Math.random() * 7;
                pushDebrisChunk({
                  x: driftState.x,
                  y: driftState.y + 0.5,
                  z: driftState.z,
                  vx: Math.cos(ang) * spd + breachedSide * 2.4,
                  vy: 3.5 + Math.random() * 5,
                  vz: Math.sin(ang) * spd,
                  size: 0.5,
                  w: 1.4,
                  h: 0.24,
                  gravity: 22,
                  rot: Math.random() * 6,
                  vRot: (Math.random() - 0.5) * 16,
                  life: 1.05,
                  color: i % 2 === 0 ? activeBiomeNow.railLight : '#334155',
                });
              }
              for (let i = 0; i < 24; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 5 + Math.random() * 12;
                pushDebrisChunk({
                  x: driftState.x,
                  y: driftState.y + 0.6,
                  z: driftState.z,
                  vx: Math.cos(ang) * spd,
                  vy: 3 + Math.random() * 7,
                  vz: Math.sin(ang) * spd,
                  size: 0.24 + Math.random() * 0.28,
                  gravity: 18,
                  rot: Math.random() * 6,
                  vRot: (Math.random() - 0.5) * 18,
                  life: 0.65,
                  color: i % 3 === 0 ? '#fef08a' : i % 3 === 1 ? '#fbbf24' : '#f97316',
                });
              }
            }
          } else {
            if (coinStreakTimer > 0) {
              coinStreakTimer = Math.max(0, coinStreakTimer - simDt);
              if (coinStreakTimer === 0) coinStreak = 0;
            }
            if (sparkAudioCooldown > 0) {
              sparkAudioCooldown = Math.max(0, sparkAudioCooldown - simDt);
            }

            // Drift Combo, Style Switch (/ <-> \) & Scoring
            // In 2-Lane Highway mode, normal lane weaves NEVER trigger constant drift/skids/smoke!
            const hardRailScrape = isHighwayMode
              ? roadCheck.onRoad && roadCheck.perpDistance >= roadCheck.halfWidth * 0.86
              : roadCheck.nearEdge;
            const driftingNow = isHighwayMode
              ? Boolean(keyHandbrake && driftState.isDrifting)
              : driftState.isDrifting || Math.abs(visualDriftAngle) > 0.36;

            if (driftingNow) {
              const curSide = visualDriftAngle >= 0 ? 1 : -1;
              if (lastDriftSide !== 0 && curSide !== lastDriftSide && Math.abs(visualDriftAngle) > 0.32) {
                const prevCombo = combo;
                combo = Math.min(25, combo + 1);
                if (combo > maxCombo) maxCombo = combo;
                const switchBonus = 250 * combo;
                score += switchBonus;
                soundFX.playStyleSwitch(combo);
                triggerHaptic('medium');

                const hitMilestone =
                  (prevCombo < 5 && combo >= 5) ||
                  (prevCombo < 10 && combo >= 10) ||
                  (prevCombo < 15 && combo >= 15) ||
                  (prevCombo < 20 && combo >= 20);
                if (hitMilestone) {
                  triggerHaptic('double');
                }

                let hypeCallout = '';
                if (combo >= 20) hypeCallout = 'UNSTOPPABLE DRIFT GOD!';
                else if (combo >= 15) hypeCallout = 'APEX PREDATOR!';
                else if (combo >= 10) hypeCallout = 'DRIFT DEMON!';
                else if (combo >= 5) hypeCallout = 'SLICK WEAVE!';

                pushCallout(
                  driftState.x,
                  driftState.y + 1.85,
                  driftState.z,
                  hypeCallout ? `${hypeCallout} +${switchBonus}` : `STYLE SWITCH! +${switchBonus}`,
                  combo >= 15 ? '#ec4899' : '#22d3ee',
                  0.95
                );
                lastDriftSide = curSide;
                driftSustainTimer = 0;
              } else if (lastDriftSide === 0) {
                lastDriftSide = curSide;
              }

              driftSustainTimer += simDt;
              if (!wasDrifting || driftSustainTimer > 0.65) {
                driftSustainTimer = 0;
                const prevCombo = combo;
                combo = Math.min(25, combo + 1);
                if (combo > maxCombo) maxCombo = combo;
                soundFX.playDriftFlip(combo, isFever);

                const hitMilestone =
                  (prevCombo < 5 && combo >= 5) ||
                  (prevCombo < 10 && combo >= 10) ||
                  (prevCombo < 15 && combo >= 15) ||
                  (prevCombo < 20 && combo >= 20);
                if (hitMilestone) {
                  triggerHaptic('double');
                }

                let hypeCallout = '';
                let hypeColor = isFever ? '#22d3ee' : '#fbbf24';
                if (combo >= 20) {
                  hypeCallout = 'UNSTOPPABLE DRIFT GOD!';
                  hypeColor = '#ec4899';
                } else if (combo >= 15) {
                  hypeCallout = 'APEX PREDATOR!';
                  hypeColor = '#a855f7';
                } else if (combo >= 10) {
                  hypeCallout = 'DRIFT DEMON!';
                  hypeColor = '#ef4444';
                } else if (combo >= 5) {
                  hypeCallout = 'SLICK WEAVE!';
                  hypeColor = '#22d3ee';
                }

                pushCallout(
                  driftState.x,
                  driftState.y + (hypeCallout ? 1.6 : 1.4),
                  driftState.z,
                  hypeCallout ? `${hypeCallout} x${combo}` : `DRIFT x${combo}`,
                  hypeColor,
                  hypeCallout ? 0.95 : 0.75
                );
              }
            } else {
              driftSustainTimer = 0;
              lastDriftSide = 0;
            }
            wasDrifting = driftingNow;

            const { scoreDelta, feverDelta } = calculateDriftScoreStep({
              distanceDelta: stepDist,
              combo,
              isFever,
              nearEdge: hardRailScrape,
              isDrifting: driftingNow,
              gameMode: gameModeRef.current,
            });
            score += scoreDelta;

            if (!isFever) {
              fever = Math.min(100, fever + feverDelta * stats.feverGainRate);
              if (fever >= 100) {
                isFever = true;
                feverTimer = 5.0;
                screenFlashAlpha = 0.26;
                screenFlashColor = '#22d3ee';
                soundFX.playFeverBurst();
                triggerHaptic('fever');
                pushShockwave({
                  x: driftState.x,
                  y: driftState.y + 0.15,
                  z: driftState.z,
                  radius: 0.6,
                  maxRadius: 5.0,
                  color: '#22d3ee',
                  life: 0.42,
                  maxLife: 0.42,
                });
                nearMissText = gameModeRef.current === 'zen' ? 'ZEN FLOW BOOST!' : 'OVERDRIVE FEVER x2.5!';
                nearMissTimer = 1.6;
              }
            }

            if (hardRailScrape) {
              if (nearMissTimer <= 0) {
                nearMissText =
                  gameModeRef.current === 'zen'
                    ? 'ZEN FLOW'
                    : `RAIL SCRAPE! +${Math.round(scoreDelta * 4)}`;
                nearMissTimer = 0.65;
              }
              if (Math.random() < 0.75) {
                const edgeSign = roadCheck.signedPerpOffset >= 0 ? 1 : -1;
                pushDebrisChunk({
                  x: driftState.x + edgeSign * 0.85,
                  y: driftState.y + 0.32,
                  z: driftState.z,
                  vx: -edgeSign * (1.8 + Math.random() * 2.5) + (Math.random() - 0.5) * 2,
                  vy: 1.8 + Math.random() * 3.0,
                  vz: (Math.random() - 0.5) * 2,
                  size: 0.18 + Math.random() * 0.14,
                  rot: Math.random() * 3,
                  vRot: (Math.random() - 0.5) * 12,
                  life: 0.30,
                  color: Math.random() > 0.4 ? '#fbbf24' : '#f97316',
                });
              }
              if (sparkAudioCooldown <= 0) {
                sparkAudioCooldown = 0.15;
                soundFX.playGuardrailSpark();
                triggerHaptic('heavy');
              }
            }

            // Record Interactive Tire State (applied after camera lock-in so marks & smoke match exact pixel tires!)
            const simSpeedNow = Math.hypot(driftState.vx, driftState.vz);
            const activeTireId = currentCustom?.tires || 'stock';
            const isGasInputNow = (phase === 'playing' && !keyDown) || isFever;
            const isBrakeInputNow = keyDown && simSpeedNow > 4.5;
            const isLaunchBurnout =
              isGasInputNow &&
              ((simSpeedNow > 2.5 && simSpeedNow < 13.5) ||
                (activeTireId === 'drag_slick' && simSpeedNow < 19.5) ||
                isFever);
            const isRainMist =
              activeTireId === 'rain_groove' &&
              simSpeedNow > 10.5 &&
              (Math.abs(steerInput) > 0.22 || driftingNow || isBrakeInputNow);

            tireBrakingNow = isBrakeInputNow;
            tireGassingNow = isGasInputNow;
            tireHighSparks = combo >= 3 || isFever;

            if (driftingNow || hardRailScrape || isBrakeInputNow || isLaunchBurnout || isRainMist) {
              tireEmitMode = hardRailScrape
                ? 'scrape'
                : isBrakeInputNow
                ? 'brake'
                : driftingNow
                ? 'drift'
                : isLaunchBurnout
                ? 'burnout'
                : 'spray';
              const baseSlip = Math.max(
                driftState.driftFactor,
                Math.min(1, Math.abs(visualDriftAngle) * 1.1)
              );
              tireSlipIntensity = Math.min(
                1,
                Math.max(
                  baseSlip,
                  isBrakeInputNow ? 0.75 : 0,
                  isLaunchBurnout ? 0.58 : 0,
                  hardRailScrape ? 0.8 : 0,
                  isRainMist ? 0.48 : 0
                )
              );
            }

            // Check Coins, Nitro Star Gems & Boost Pads
            for (let i = 0; i < track.length; i++) {
              const pt = track[i];
              if (pt.hasCoin && !pt.coinCollected) {
                const d = Math.hypot(driftState.x - pt.coinX, driftState.z - pt.coinZ);
                if (d <= stats.magnetRadius) {
                  if (d <= 2.1) {
                    pt.coinCollected = true;
                    coinStreak += 1;
                    coinStreakTimer = 2.6;
                    const gained = Math.max(1, Math.round(2 * stats.coinMultiplier));
                    coinsRun += gained;
                    score += 50 * combo + coinStreak * 20;
                    soundFX.playCoinPickup(coinStreak);
                    triggerHaptic('light');
                    spawnFloatingText(pt.coinX, pt.y + 0.85, pt.coinZ, '+50 CR', '#fbbf24', 0.75);
                    // Golden pickup sparkle burst
                    for (let k = 0; k < 6; k++) {
                      const a = (k / 6) * Math.PI * 2 + Math.random() * 0.4;
                      pushDebrisChunk({
                        x: pt.coinX,
                        y: pt.y + 0.65,
                        z: pt.coinZ,
                        vx: Math.cos(a) * 3.2,
                        vy: 2.2 + Math.random() * 2.0,
                        vz: Math.sin(a) * 3.2,
                        size: 0.18,
                        gravity: 14,
                        rot: 0,
                        vRot: 8,
                        life: 0.28,
                        color: k % 2 === 0 ? '#fef08a' : '#fbbf24',
                      });
                    }
                    pushCallout(
                      pt.coinX,
                      pt.y + 1.2,
                      pt.coinZ,
                      coinStreak >= 3 ? `COIN x${coinStreak} +${gained} CR` : `+${gained} CR`,
                      '#fbbf24',
                      0.75
                    );
                  } else {
                    pt.coinX += (driftState.x - pt.coinX) * 0.25;
                    pt.coinZ += (driftState.z - pt.coinZ) * 0.25;
                  }
                }
              }

              if (pt.hasNitroGem && !pt.gemCollected) {
                const d = Math.hypot(driftState.x - pt.coinX, driftState.z - pt.coinZ);
                if (d <= stats.magnetRadius * 1.15) {
                  if (d <= 2.3) {
                    pt.gemCollected = true;
                    const starCoins = Math.max(6, Math.round(10 * stats.coinMultiplier));
                    coinsRun += starCoins;
                    fever = Math.min(100, fever + 25);
                    score += 250 * combo;
                    soundFX.playStarPickup();
                    triggerHaptic('light');
                    spawnFloatingText(pt.coinX, pt.y + 0.85, pt.coinZ, '+150 CR', '#fef08a', 0.75);
                    pushShockwave({
                      x: pt.coinX,
                      y: pt.y + 0.65,
                      z: pt.coinZ,
                      radius: 0.3,
                      maxRadius: 3.4,
                      color: '#22d3ee',
                      life: 0.32,
                      maxLife: 0.32,
                    });
                    for (let k = 0; k < 10; k++) {
                      const a = (k / 10) * Math.PI * 2;
                      pushDebrisChunk({
                        x: pt.coinX,
                        y: pt.y + 0.75,
                        z: pt.coinZ,
                        vx: Math.cos(a) * 4.5,
                        vy: 2.6 + Math.random() * 2.5,
                        vz: Math.sin(a) * 4.5,
                        size: 0.22,
                        gravity: 12,
                        rot: 0,
                        vRot: 12,
                        life: 0.35,
                        color: k % 2 === 0 ? '#22d3ee' : '#fef08a',
                      });
                    }
                    pushCallout(
                      pt.coinX,
                      pt.y + 1.6,
                      pt.coinZ,
                      `STAR GEM! +${starCoins} CR`,
                      '#22d3ee',
                      1.05
                    );
                  } else {
                    pt.coinX += (driftState.x - pt.coinX) * 0.28;
                    pt.coinZ += (driftState.z - pt.coinZ) * 0.28;
                  }
                }
              }

              if (pt.hasBoostPad && !pt.boostTriggered) {
                const d = Math.hypot(driftState.x - pt.boostX, driftState.z - pt.boostZ);
                if (d <= 2.4) {
                  pt.boostTriggered = true;
                  fever = Math.min(100, fever + 45);
                  score += 150 * combo;
                  cameraTrauma = Math.min(1, cameraTrauma + 0.35);
                  screenFlashAlpha = 0.22;
                  screenFlashColor = '#22d3ee';
                  soundFX.playFeverBurst();
                  triggerHaptic('fever');
                  pushShockwave({
                    x: pt.boostX,
                    y: pt.y + 0.15,
                    z: pt.boostZ,
                    radius: 0.5,
                    maxRadius: 4.5,
                    color: '#22d3ee',
                    life: 0.38,
                    maxLife: 0.38,
                  });
                  nearMissText = 'NITRO PAD BOOST!';
                  nearMissTimer = 1.1;
                }
              }
            }

            // Extend endless track ahead & cull far behind
            const lastPt = track[track.length - 1];
            if (lastPt && driftState.z - lastPt.z < 155) {
              const extSlices = isHighwayMode
                ? extendHighwayTrack(track, 20, STEP_DIST, seed)
                : extendSCurveTrack(track, 20, STEP_DIST, seed);
              for (let s = 0; s < extSlices.length; s++) track.push(extSlices[s]);
              while (track.length > 90 && track[0].z > driftState.z + 32) {
                track.shift();
              }
              populateTreesAround(driftState.z);
            }

            // Handle Headlight Flash & Horn Triggers (alerts same-lane traffic to yield!)
            const wantFlash = pendingFlashRef.current;
            const wantHorn = pendingHornRef.current;
            pendingFlashRef.current = false;
            pendingHornRef.current = false;

            if (wantFlash) {
              highBeamTimer = 0.56;
              soundFX.playHeadlightFlash();
              screenFlashAlpha = Math.max(screenFlashAlpha, 0.12);
              screenFlashColor = currentAppearance.headlightBeamHex;
              if (isHighwayMode && roadCheck.closestPoint) {
                const playerSNow =
                  roadCheck.closestPoint.index * STEP_DIST +
                  ((driftState.x - roadCheck.closestPoint.x) * roadCheck.closestPoint.tx +
                    (driftState.z - roadCheck.closestPoint.z) * roadCheck.closestPoint.tz);
                const res = triggerTrafficFlashYield({
                  playerS: playerSNow,
                  playerLateralOffset: roadCheck.signedPerpOffset,
                  trafficCars,
                  rangeMeters: 48,
                });
                if (res.yieldedCars.length > 0) {
                  soundFX.playTrafficYieldChime();
                  if (res.newlyFlashedCount > 0) {
                    score += 60 * res.newlyFlashedCount * combo;
                  }
                  nearMissText = 'HIGH-BEAM FLASH · TRAFFIC YIELDING!';
                  nearMissTimer = 1.2;
                  pushCallout(
                    driftState.x,
                    driftState.y + 1.8,
                    driftState.z,
                    'MOVE OVER!',
                    currentAppearance.headlightBeamHex,
                    0.9
                  );
                }
              }
            }

            if (wantHorn) {
              soundFX.playHorn(currentAppearance.horn);
              pushShockwave({
                x: driftState.x,
                y: driftState.y + 0.4,
                z: driftState.z,
                radius: 0.5,
                maxRadius: 3.4,
                color: '#fef08a',
                life: 0.28,
                maxLife: 0.28,
              });
              if (isHighwayMode && roadCheck.closestPoint) {
                const playerSNow =
                  roadCheck.closestPoint.index * STEP_DIST +
                  ((driftState.x - roadCheck.closestPoint.x) * roadCheck.closestPoint.tx +
                    (driftState.z - roadCheck.closestPoint.z) * roadCheck.closestPoint.tz);
                const res = triggerTrafficFlashYield({
                  playerS: playerSNow,
                  playerLateralOffset: roadCheck.signedPerpOffset,
                  trafficCars,
                  rangeMeters: 28,
                });
                if (res.yieldedCars.length > 0) {
                  soundFX.playTrafficYieldChime();
                  nearMissText = 'HORN CLEAR · PASSING LANE!';
                  nearMissTimer = 1.1;
                }
              }
            }

            // 2-LANE HIGHWAY TRAFFIC SIMULATION (Overtakes, Near Misses, Yielding & Collisions!)
            if (isHighwayMode && roadCheck.closestPoint) {
              const cp = roadCheck.closestPoint;
              const playerS =
                cp.index * STEP_DIST +
                ((driftState.x - cp.x) * cp.tx + (driftState.z - cp.z) * cp.tz);

              stepTrafficCars(trafficCars, simDt);

              const trafficEval = evaluateTrafficInteraction({
                playerS,
                playerLateralOffset: roadCheck.signedPerpOffset,
                trafficCars,
              });

              if (trafficEval.collidedCar) {
                const hit = trafficEval.collidedCar;
                if (gameModeRef.current === 'zen') {
                  // ZEN MODE: Gentle deflection occurs without wrecking
                  const defSide: -1 | 1 = roadCheck.signedPerpOffset >= hit.lateralOffset ? 1 : -1;
                  const halfW = roadCheck.halfWidth || 4.9;
                  const maxLat = Math.max(0.5, halfW - 0.20);
                  const targetOffset = hit.lateralOffset + defSide * (0.90 + hit.halfWidth + 0.35);
                  const clampedLat = Math.max(-maxLat, Math.min(maxLat, targetOffset));

                  if (roadCheck.closestPoint) {
                    driftState.x = roadCheck.closestPoint.x + roadCheck.closestPoint.nx * clampedLat;
                    driftState.z = roadCheck.closestPoint.z + roadCheck.closestPoint.nz * clampedLat;

                    const vFwd = driftState.vx * roadCheck.closestPoint.tx + driftState.vz * roadCheck.closestPoint.tz;
                    const reboundVLat = defSide * Math.max(1.5, Math.abs(driftState.vx * roadCheck.closestPoint.nx + driftState.vz * roadCheck.closestPoint.nz) * 0.4);
                    driftState.vx = roadCheck.closestPoint.tx * vFwd + roadCheck.closestPoint.nx * reboundVLat;
                    driftState.vz = roadCheck.closestPoint.tz * vFwd + roadCheck.closestPoint.nz * reboundVLat;
                  }

                  soundFX.playGearShift();
                  triggerHaptic('light');
                  cameraTrauma = Math.min(0.2, cameraTrauma + 0.1);
                  pushCallout(driftState.x, driftState.y + 1.8, driftState.z, 'SMOOTH DEFLECT', '#38bdf8', 0.65);

                  for (let k = 0; k < 5; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    pushDebrisChunk({
                      x: driftState.x,
                      y: driftState.y + 0.35,
                      z: driftState.z,
                      vx: Math.cos(ang) * (1.8 + Math.random() * 2),
                      vy: 1.2 + Math.random() * 1.5,
                      vz: Math.sin(ang) * (1.8 + Math.random() * 2),
                      size: 0.18,
                      w: 0.2,
                      h: 0.2,
                      gravity: 10,
                      rot: Math.random() * 4,
                      vRot: (Math.random() - 0.5) * 6,
                      life: 0.35,
                      color: '#67e8f9',
                    });
                  }
                } else {
                  isTrafficCrash = true;
                  trafficCrashTimer = 0;
                  crashReason = hit.isOncoming ? 'Head-On Collision' : 'Traffic Impact';
                  hitstopTimer = 0.09;
                  cameraTrauma = 1.0;
                  screenFlashAlpha = 0.85;
                  screenFlashColor = hit.isOncoming ? '#fef08a' : '#ef4444';
                  soundFX.playFallAndDestroy();
                  triggerHaptic('heavy');

                  pushShockwave({
                    x: driftState.x,
                    y: driftState.y + 0.3,
                    z: driftState.z,
                    radius: 0.5,
                    maxRadius: 7.2,
                    color: '#fef08a',
                    life: 0.5,
                    maxLife: 0.5,
                  });
                  pushShockwave({
                    x: driftState.x,
                    y: driftState.y + 0.3,
                    z: driftState.z,
                    radius: 0.4,
                    maxRadius: 5.5,
                    color: '#ef4444',
                    life: 0.4,
                    maxLife: 0.4,
                  });
                  pushCallout(
                    driftState.x,
                    driftState.y + 2.1,
                    driftState.z,
                    hit.isOncoming ? 'HEAD-ON CRASH!' : 'TRAFFIC WRECK!',
                    '#ef4444',
                    0.9
                  );

                  const wreckColors = [
                    currentCar.primaryColor,
                    hit.color,
                    '#1e293b',
                    '#ef4444',
                    '#f97316',
                    '#fef08a',
                  ];
                  for (let k = 0; k < 44; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 4 + Math.random() * 14;
                    const isPanel = k < 12;
                    pushDebrisChunk({
                      x: driftState.x,
                      y: driftState.y + 0.5,
                      z: driftState.z,
                      vx: Math.cos(ang) * spd,
                      vy: 5 + Math.random() * 11,
                      vz: Math.sin(ang) * spd,
                      size: isPanel ? 0.52 : 0.36 + Math.random() * 0.4,
                      w: isPanel ? 0.85 : undefined,
                      h: isPanel ? 0.42 : undefined,
                      gravity: 23,
                      rot: Math.random() * 6,
                      vRot: (Math.random() - 0.5) * 18,
                      life: 0.95,
                      color: wreckColors[k % wreckColors.length],
                    });
                  }
                  for (let k = 0; k < 18; k++) {
                    pushSmokePuff({
                      x: driftState.x + (Math.random() - 0.5) * 2.0,
                      y: driftState.y + 0.5,
                      z: driftState.z + (Math.random() - 0.5) * 2.0,
                      vx: (Math.random() - 0.5) * 6,
                      vy: 3.0 + Math.random() * 5.5,
                      vz: (Math.random() - 0.5) * 6,
                      radius: 0.85,
                      maxRadius: 2.9,
                      life: 0.8,
                      maxLife: 0.8,
                      tint: k % 3 === 0 ? 'dark' : 'fire',
                    });
                  }
                }
              } else {
                // Slipstream Drafting evaluation behind same-lane traffic!
                const draftEval = evaluateSlipstreamDraft({
                  playerS,
                  playerLateralOffset: roadCheck.signedPerpOffset,
                  trafficCars,
                });
                if (draftEval.draftingCar) {
                  slipstreamCarId = draftEval.draftingCar.id;
                  slipstreamCharge = Math.min(1, slipstreamCharge + simDt * (0.95 + draftEval.intensity));
                  score += 45 * simDt * combo;
                  if (slipstreamCharge > 0.35 && nearMissTimer <= 0.1) {
                    nearMissText = 'SLIPSTREAM DRAFTING!';
                    nearMissTimer = 0.35;
                  }
                } else {
                  slipstreamCharge = Math.max(0, slipstreamCharge - simDt * 0.55);
                  if (slipstreamCharge <= 0.05) slipstreamCarId = null;
                }

                // Near Miss / Oncoming Dodge Rewards
                for (const nm of trafficEval.newlyNearMissed) {
                  nearMisses += 1;
                  const prevCombo = combo;
                  combo = Math.min(25, combo + 1);
                  if (combo > maxCombo) maxCombo = combo;
                  overtakeChain += 1;
                  overtakeChainTimer = 3.4;
                  const bonus = (nm.isOncoming ? 450 : 300) * combo;
                  score += bonus;
                  fever = Math.min(100, fever + (nm.isOncoming ? 18 : 13));
                  soundFX.playNearMiss(nm.isOncoming);
                  triggerHaptic('medium');

                  const hitMilestone =
                    (prevCombo < 5 && combo >= 5) ||
                    (prevCombo < 10 && combo >= 10) ||
                    (prevCombo < 15 && combo >= 15) ||
                    (prevCombo < 20 && combo >= 20);
                  if (hitMilestone) {
                    triggerHaptic('double');
                  }
                  cameraTrauma = Math.min(1, cameraTrauma + 0.18);
                  if (gameModeRef.current === 'zen') {
                    const zenPhrases = ['CHILL VIBES', 'SMOOTH FLOW', 'SERENITY CRUISE'];
                    const phrase = zenPhrases[Math.floor(Math.random() * zenPhrases.length)];
                    nearMissText = `${phrase}! +${bonus}`;
                    pushCallout(driftState.x, driftState.y + 1.85, driftState.z, phrase, '#38bdf8', 0.95);
                  } else {
                    nearMissText = nm.isOncoming
                      ? `ONCOMING DODGE! +${bonus}`
                      : `CLOSE PASS! +${bonus}`;
                    pushCallout(
                      driftState.x,
                      driftState.y + 1.85,
                      driftState.z,
                      nm.isOncoming ? `ONCOMING DODGE! +${bonus}` : `NEAR MISS! +${bonus}`,
                      nm.isOncoming ? '#f472b6' : '#22d3ee',
                      0.95
                    );
                  }
                  nearMissTimer = 1.2;
                  pushShockwave({
                    x: driftState.x,
                    y: driftState.y + 0.25,
                    z: driftState.z,
                    radius: 0.4,
                    maxRadius: 3.6,
                    color: nm.isOncoming ? '#f472b6' : '#22d3ee',
                    life: 0.3,
                    maxLife: 0.3,
                  });
                }

                // Clean Overtake & Slipstream Slingshot Rewards
                for (const ov of trafficEval.newlyOvertaken) {
                  overtakes += 1;
                  combo = Math.min(25, combo + 1);
                  if (combo > maxCombo) maxCombo = combo;
                  overtakeChain += 1;
                  overtakeChainTimer = 3.4;
                  if (overtakeChain >= 2) {
                    triggerHaptic('double');
                  }
                  const wasSlipstreamed = slipstreamCarId === ov.id && slipstreamCharge >= 0.32;
                  const streakLabel = getOvertakeStreakLabel(overtakeChain);
                  const ovBonus = (ov.isOncoming ? 260 : 220) * combo + (wasSlipstreamed ? 350 : 0);
                  score += ovBonus;
                  coinsRun += wasSlipstreamed ? 2 : 1;
                  fever = Math.min(100, fever + (wasSlipstreamed ? 16 : 10));

                  if (wasSlipstreamed) {
                    slipstreamBoostTimer = 1.35;
                    slipstreamCharge = 0;
                    slipstreamCarId = null;
                    cameraTrauma = Math.min(1, cameraTrauma + 0.24);
                    screenFlashAlpha = 0.18;
                    screenFlashColor = '#22d3ee';
                    soundFX.playSlipstreamPass(combo);
                    nearMissText = `SLIPSTREAM PASS! +${ovBonus}`;
                    nearMissTimer = 1.25;
                    pushShockwave({
                      x: driftState.x,
                      y: driftState.y + 0.2,
                      z: driftState.z,
                      radius: 0.4,
                      maxRadius: 4.4,
                      color: '#22d3ee',
                      life: 0.36,
                      maxLife: 0.36,
                    });
                  } else {
                    soundFX.playOvertake(combo);
                  }

                  if (!ov.nearMissed || wasSlipstreamed || streakLabel) {
                    pushCallout(
                      driftState.x,
                      driftState.y + 2.35,
                      driftState.z,
                      wasSlipstreamed
                        ? `SLIPSTREAM! +${ovBonus}`
                        : streakLabel
                        ? `${streakLabel} +${ovBonus}`
                        : `PASS #${overtakes}! +${ovBonus}`,
                      wasSlipstreamed ? '#22d3ee' : streakLabel ? '#f472b6' : '#fbbf24',
                      0.9
                    );
                  }
                }

                compactInPlace(trafficCars, (c) => c.s > playerS - 26);
                if (trafficSpawnCursor < playerS + 250) {
                  const batch = generateTrafficBatch({
                    startS: trafficSpawnCursor,
                    endS: playerS + 290,
                    nextIdStart: nextTrafficId,
                    seed,
                    existingCars: trafficCars,
                    difficultyProgress: Math.min(1, distance / 1800),
                  });
                  for (let b = 0; b < batch.cars.length; b++) trafficCars.push(batch.cars[b]);
                  nextTrafficId = batch.nextId;
                  trafficSpawnCursor = playerS + 290;
                }
              }
            }
          }
        } else if (isFalling && simDt > 0) {
          // STAGE 2 & 3: Dramatic Fall Off Viaduct, Fire Smoke Trail & Valley Impact Explosion!
          fallTimer += simDt;
          fallVelY -= 24.0 * simDt;
          driftState.x += fallVelX * simDt;
          driftState.y += fallVelY * simDt;
          driftState.z += fallVelZ * simDt;
          fallRotation += breachedSide * simDt * 7.8;

          // Continuous billowing fire & dark crash smoke trail while airborne
          if (!explodedInFall && Math.random() < 0.85) {
            pushSmokePuff({
              x: driftState.x + (Math.random() - 0.5) * 0.6,
              y: driftState.y + 0.2,
              z: driftState.z + (Math.random() - 0.5) * 0.6,
              vx: (Math.random() - 0.5) * 2.5,
              vy: 1.5 + Math.random() * 2.5,
              vz: (Math.random() - 0.5) * 2.5,
              radius: 0.4,
              maxRadius: 1.4,
              life: 0.45,
              maxLife: 0.45,
              tint: Math.random() > 0.45 ? 'fire' : 'dark',
            });
          }

          if (fallTimer >= 0.42 && !explodedInFall) {
            explodedInFall = true;
            hitstopTimer = 0.06;
            cameraTrauma = 1.0;
            screenFlashAlpha = 0.85;
            screenFlashColor = '#ef4444';

            pushShockwave({
              x: driftState.x,
              y: driftState.y + 0.2,
              z: driftState.z,
              radius: 0.6,
              maxRadius: 7.5,
              color: '#fef08a',
              life: 0.52,
              maxLife: 0.52,
            });
            pushShockwave({
              x: driftState.x,
              y: driftState.y + 0.2,
              z: driftState.z,
              radius: 0.4,
              maxRadius: 5.8,
              color: '#ef4444',
              life: 0.42,
              maxLife: 0.42,
            });
            pushCallout(driftState.x, driftState.y + 2.2, driftState.z, 'TOTAL WRECK!', '#ef4444', 0.75);

            const wreckPalette = [
              currentCar.primaryColor,
              currentCar.accentColor,
              '#1e293b',
              '#ef4444',
              '#f97316',
              '#fef08a',
            ];
            for (let i = 0; i < 48; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 4 + Math.random() * 16;
              const isPanel = i < 12;
              pushDebrisChunk({
                x: driftState.x,
                y: driftState.y + 0.3,
                z: driftState.z,
                vx: Math.cos(ang) * spd,
                vy: 5 + Math.random() * 12,
                vz: Math.sin(ang) * spd,
                size: isPanel ? 0.55 : 0.42 + Math.random() * 0.5,
                w: isPanel ? 0.9 : undefined,
                h: isPanel ? 0.45 : undefined,
                gravity: 24,
                rot: Math.random() * 6,
                vRot: (Math.random() - 0.5) * 18,
                life: 0.95,
                color: wreckPalette[i % wreckPalette.length],
              });
            }
            for (let i = 0; i < 22; i++) {
              pushSmokePuff({
                x: driftState.x + (Math.random() - 0.5) * 2.4,
                y: driftState.y + 0.5,
                z: driftState.z + (Math.random() - 0.5) * 2.4,
                vx: (Math.random() - 0.5) * 7,
                vy: 3.5 + Math.random() * 6.5,
                vz: (Math.random() - 0.5) * 7,
                radius: 0.95,
                maxRadius: 3.2,
                life: 0.85,
                maxLife: 0.85,
                tint: i % 3 === 0 ? 'dark' : 'fire',
              });
            }
          }

          if (fallTimer >= 1.10) {
            onGameOverRef.current({
              score: Math.round(score),
              distance: Math.round(distance),
              maxCombo,
              coinsCollected: coinsRun,
              overtakes,
              nearMisses,
              crashReason: 'Guardrail Breached',
            });
          }
        } else if (isTrafficCrash && simDt > 0) {
          trafficCrashTimer += simDt;
          fallRotation += simDt * 5.2;
          driftState.x += driftState.vx * 0.18 * simDt;
          driftState.z += driftState.vz * 0.18 * simDt;
          if (Math.random() < 0.7) {
            pushSmokePuff({
              x: driftState.x + (Math.random() - 0.5) * 0.9,
              y: driftState.y + 0.35,
              z: driftState.z + (Math.random() - 0.5) * 0.9,
              vx: (Math.random() - 0.5) * 2.5,
              vy: 2.0 + Math.random() * 2.5,
              vz: (Math.random() - 0.5) * 2.5,
              radius: 0.45,
              maxRadius: 1.7,
              life: 0.48,
              maxLife: 0.48,
              tint: Math.random() > 0.4 ? 'fire' : 'dark',
            });
          }
          if (trafficCrashTimer >= 0.92) {
            onGameOverRef.current({
              score: Math.round(score),
              distance: Math.round(distance),
              maxCombo,
              coinsCollected: coinsRun,
              overtakes,
              nearMisses,
              crashReason,
            });
          }
        }

        // Smooth camera follow (frame both highway lanes while keeping hero car cleanly inside 390px portrait!)
        const camEval = isHighwayMode
          ? evaluateCarOnSCurveRoad(driftState.x, driftState.z, track, 5)
          : null;
        const targetCamX =
          isHighwayMode && camEval?.closestPoint
            ? camEval.closestPoint.x * 0.42 + driftState.x * 0.58
            : driftState.x;
        const targetCamZ =
          isHighwayMode && camEval?.closestPoint
            ? camEval.closestPoint.z * 0.42 + driftState.z * 0.58
            : driftState.z;
        camFocusX += (targetCamX - camFocusX) * Math.min(1, 9 * dt);
        if (!isFalling) {
          camFocusY += (driftState.y - camFocusY) * Math.min(1, 10 * dt);
        }
        camFocusZ += (targetCamZ - camFocusZ) * Math.min(1, 11 * dt);

        if (nearMissTimer > 0) {
          nearMissTimer = Math.max(0, nearMissTimer - dt);
          if (nearMissTimer === 0) nearMissText = '';
        }

        hudEmitTimer += dt;
        if (hudEmitTimer >= 0.09) {
          hudEmitTimer = 0;
          const speedNow = Math.hypot(driftState.vx, driftState.vz);
          const sRounded = Math.round(score);
          const dRounded = Math.round(distance);
          const fRounded = Math.round(fever);
          const kmhRounded = Math.round(speedNow * 7.2);
          if (
            sRounded !== lastHudScore ||
            dRounded !== lastHudDist ||
            combo !== lastHudCombo ||
            coinsRun !== lastHudCoins ||
            fRounded !== lastHudFever ||
            isFever !== lastHudIsFever ||
            kmhRounded !== lastHudSpeed ||
            activeDir !== lastHudDir ||
            nearMissText !== lastHudMsg ||
            overtakes !== lastHudOvertakes ||
            nearMisses !== lastHudNearMisses
          ) {
            lastHudScore = sRounded;
            lastHudDist = dRounded;
            lastHudCombo = combo;
            lastHudCoins = coinsRun;
            lastHudFever = fRounded;
            lastHudIsFever = isFever;
            lastHudSpeed = kmhRounded;
            lastHudDir = activeDir;
            lastHudMsg = nearMissText;
            lastHudOvertakes = overtakes;
            lastHudNearMisses = nearMisses;
            const activeBiome = resolveRoadBiome(roadModeRef.current, distance);
            onTelemetryRef.current({
              score: sRounded,
              distance: dRounded,
              combo,
              maxCombo,
              coinsRun,
              fever: fRounded,
              isFever,
              speedKmh: kmhRounded,
              direction: activeDir,
              nearMissText,
              isDrifting: driftState.isDrifting,
              biomeName: activeBiome.name,
              overtakes,
              nearMisses,
            });
          }
        }
      }

      // ============================================================
      // 5. RENDER PIXEL-ART WORLD DIRECTLY ONTO GPU-SCALED CANVAS
      // ============================================================
      const rawBiome = resolveRoadBiome(roadModeRef.current, distance);
      const sky = resolveSkyAtmosphere(skyModeRef.current, rawBiome);
      Object.assign(biome, rawBiome);
      biome.isNight = sky.isNight;
      ensureBiomeLayers(biome, sky);

      cameraTrauma = Math.max(0, cameraTrauma - dt * 2.1);
      if (screenFlashAlpha > 0) screenFlashAlpha = Math.max(0, screenFlashAlpha - dt * 2.4);
      const shakeMag = cameraTrauma * cameraTrauma * 9 * (shakeMultiplierRef.current ?? 1.0);
      const shakeX = (Math.random() - 0.5) * shakeMag;
      const shakeY = (Math.random() - 0.5) * shakeMag;

      const isPortrait = pxW < pxH;
      const curSpeedVal = Math.hypot(driftState.vx, driftState.vz);
      const speedRushFactor = Math.max(0, Math.min(1, (curSpeedVal - 20) / 16));
      const fovScale = pxH * (isPortrait ? 0.74 + speedRushFactor * 0.05 : 0.90 + speedRushFactor * 0.06);
      const horizonY = cachedHorizonY;

      const targetDiag = Math.max(-1, Math.min(1, visualDriftAngle));
      camDiagBias += (targetDiag - camDiagBias) * Math.min(1, 3.8 * dt);
      const targetZoom = isFever
        ? 1.15
        : slipstreamBoostTimer > 0
        ? 0.95
        : Math.max(speedRushFactor * 0.6, Math.min(0.65, driftState.driftFactor * 0.5));
      camSpeedZoom += (targetZoom - camSpeedZoom) * Math.min(1, 4.0 * dt);

      const camViewAngle = camHeading + camDiagBias * 0.085;
      const fwdX = Math.cos(camViewAngle);
      const fwdZ = Math.sin(camViewAngle);
      const rightX = -fwdZ;
      const rightZ = fwdX;

      const camDistBack = (isHighwayMode ? 9.4 : 8.4) + camSpeedZoom * 0.85;
      const camHeight = isHighwayMode ? 4.35 : 3.85;
      const camSideSwing = isHighwayMode ? -camDiagBias * 0.65 : -camDiagBias * 1.55;
      const camWorldX = camFocusX - fwdX * camDistBack + rightX * camSideSwing;
      const camWorldY = camFocusY + camHeight;
      const camWorldZ = camFocusZ - fwdZ * camDistBack + rightZ * camSideSwing;

      // Update per-frame camera projection registers (zero closure allocations)
      fCamX = camWorldX;
      fCamY = camWorldY;
      fCamZ = camWorldZ;
      fFwdX = fwdX;
      fFwdZ = fwdZ;
      fRightX = rightX;
      fRightZ = rightZ;
      fHorizonY = horizonY;
      fFovScale = fovScale;
      fShakeX = shakeX;
      fShakeY = shakeY;

      // Exact Tire-Locked Skid Marks, Lockup Streaks, Smoke & Sparks anchored to rendered car tires!
      if (
        !isFalling &&
        !isTrafficCrash &&
        tireEmitMode !== 'none' &&
        projectInto(driftState.x, driftState.y, driftState.z, pScratchTmp)
      ) {
        const carDrawW = Math.round(5.4 * pScratchTmp.scale);
        const carDrawH = Math.round(carDrawW * (108 / 144));
        const drawCx = Math.round(pScratchTmp.x);
        const drawCy = Math.round(pScratchTmp.y - carDrawH * 0.34);
        const spriteLeft = Math.round(drawCx - carDrawW * 0.5);
        const spriteTop = Math.round(drawCy - carDrawH * 0.5);

        const anchors = getPixelCarTireAnchors(currentCar, visualDriftAngle, currentCustom);
        const tireY = driftState.y + 0.025;

        const rlxScr = spriteLeft + anchors.rearLeft.u * carDrawW;
        const rlyScr = spriteTop + anchors.rearLeft.v * carDrawH;
        const rrxScr = spriteLeft + anchors.rearRight.u * carDrawW;
        const rryScr = spriteTop + anchors.rearRight.v * carDrawH;

        unprojectTireToRoad(rlxScr, rlyScr, tireY, tireWorldA);
        unprojectTireToRoad(rrxScr, rryScr, tireY, tireWorldB);

        const tireId = currentCustom?.tires || 'stock';
        const isSprayOnly = tireEmitMode === 'spray';
        const markColor =
          tireId === 'drag_slick'
            ? '#090b10'
            : tireId === 'rain_groove'
            ? '#0c1624'
            : tireId === 'semi_slick'
            ? '#0d1017'
            : '#11141c';
        const markWidth =
          anchors.tireWidthScale *
          (tireBrakingNow ? 1.16 : tireEmitMode === 'burnout' ? 1.12 : 1.0);
        const markAlpha = isSprayOnly
          ? 0.42
          : tireBrakingNow
          ? 0.88
          : Math.min(0.90, 0.54 + tireSlipIntensity * 0.36);

        const prevSkid = getLastSkidMark();
        const moveDist = prevSkid
          ? Math.hypot(tireWorldA.x - prevSkid.lx, tireWorldA.z - prevSkid.lz)
          : 99;
        if (moveDist > 0.24) {
          const connected =
            !!prevSkid &&
            prevSkid.dirSign === anchors.dirSign &&
            moveDist < 3.2 &&
            Math.hypot(tireWorldB.x - prevSkid.rx, tireWorldB.z - prevSkid.rz) < 3.2;
          pushSkidMark(
            tireWorldA.x,
            tireWorldA.z,
            tireWorldB.x,
            tireWorldB.z,
            tireY,
            connected,
            markWidth,
            markAlpha,
            markColor,
            anchors.dirSign
          );
        }

        // Interactive Front Tire Lockup / Deep Scrub Tracks on hard Braking or extreme drift lock
        if (tireBrakingNow || (tireEmitMode === 'drift' && tireSlipIntensity > 0.72)) {
          const flxScr = spriteLeft + anchors.frontLeft.u * carDrawW;
          const flyScr = spriteTop + anchors.frontLeft.v * carDrawH;
          const frxScr = spriteLeft + anchors.frontRight.u * carDrawW;
          const fryScr = spriteTop + anchors.frontRight.v * carDrawH;
          unprojectTireToRoad(flxScr, flyScr, tireY, tireFrontWorldA);
          unprojectTireToRoad(frxScr, fryScr, tireY, tireFrontWorldB);

          const prevFront = getLastFrontSkidMark();
          const fMoveDist = prevFront
            ? Math.hypot(tireFrontWorldA.x - prevFront.lx, tireFrontWorldA.z - prevFront.lz)
            : 99;
          if (fMoveDist > 0.28) {
            const fConnected =
              !!prevFront &&
              prevFront.dirSign === anchors.dirSign &&
              fMoveDist < 3.0 &&
              Math.hypot(tireFrontWorldB.x - prevFront.rx, tireFrontWorldB.z - prevFront.rz) < 3.0;
            pushFrontSkidMark(
              tireFrontWorldA.x,
              tireFrontWorldA.z,
              tireFrontWorldB.x,
              tireFrontWorldB.z,
              tireY,
              fConnected,
              tireBrakingNow ? 0.92 : 0.74,
              tireBrakingNow ? 0.74 : 0.48,
              markColor,
              anchors.dirSign
            );
          }
        }

        // Interactive Tire Smoke & Compound Plumes ejected along wheel scrub vector
        const cosH = Math.cos(driftState.heading);
        const sinH = Math.sin(driftState.heading);
        const rightH_X = -sinH;
        const rightH_Z = cosH;

        const smokeChance =
          tireId === 'drift_spec'
            ? 0.95
            : tireEmitMode === 'burnout'
            ? 0.65
            : Math.min(0.92, 0.45 + tireSlipIntensity * 0.55);

        if (Math.random() < smokeChance) {
          const smokeTint: SmokePuff['tint'] = isFever
            ? 'cyan'
            : tireId === 'rain_groove'
            ? 'aqua'
            : tireId === 'drift_spec'
            ? 'pink'
            : tireId === 'semi_slick' || tireId === 'drag_slick'
            ? 'warm'
            : 'white';
          const compoundScale =
            tireId === 'drift_spec'
              ? 1.24
              : tireId === 'drag_slick'
              ? 1.18
              : tireId === 'rain_groove'
              ? 0.92
              : 1.0;

          for (let w = 0; w < 2; w++) {
            const isLeft = w === 0;
            const anchor = isLeft ? anchors.rearLeft : anchors.rearRight;
            const wx = isLeft ? tireWorldA.x : tireWorldB.x;
            const wz = isLeft ? tireWorldA.z : tireWorldB.z;
            const sideSign = isLeft ? -1 : 1;
            const lateralPush = (0.75 + tireSlipIntensity * 0.95) * sideSign;
            const backPush = tireGassingNow ? 3.2 : 2.3;

            // Main billowing smoke trail directly from tire tread contact
            pushSmokePuff({
              x: wx + (Math.random() - 0.5) * 0.12,
              y: driftState.y + 0.08,
              z: wz + (Math.random() - 0.5) * 0.12,
              vx: -cosH * backPush + rightH_X * lateralPush + (Math.random() - 0.5) * 0.85,
              vy: 0.36 + tireSlipIntensity * 0.45 + Math.random() * 0.42,
              vz: -sinH * backPush + rightH_Z * lateralPush + (Math.random() - 0.5) * 0.85,
              radius: (0.18 + tireSlipIntensity * 0.07) * compoundScale,
              maxRadius: (0.68 + tireSlipIntensity * 0.36) * compoundScale,
              life: tireId === 'drift_spec' ? 0.52 : 0.42,
              maxLife: tireId === 'drift_spec' ? 0.52 : 0.42,
              tint: smokeTint,
            });

            // Foreground wheel-hugging wisp wrapping the camera-facing tire lip
            if (anchor.isCameraFacing && Math.random() < 0.45) {
              pushSmokePuff({
                x: wx + rightH_X * sideSign * 0.08,
                y: driftState.y + 0.14,
                z: wz + rightH_Z * sideSign * 0.08,
                vx: -cosH * (backPush * 0.72) + rightH_X * lateralPush * 0.65,
                vy: 0.28 + Math.random() * 0.32,
                vz: -sinH * (backPush * 0.72) + rightH_Z * lateralPush * 0.65,
                radius: 0.15 * compoundScale,
                maxRadius: 0.46 * compoundScale,
                life: 0.28,
                maxLife: 0.28,
                tint: smokeTint,
                overCar: true,
              });
            }

            // High-combo, Fever, or hot Semi-Slick curb sparks directly off loaded rear tire
            if (
              (tireHighSparks || tireEmitMode === 'scrape') &&
              (anchor.isCameraFacing || tireEmitMode === 'scrape') &&
              Math.random() < 0.35
            ) {
              pushDebrisChunk({
                x: wx,
                y: driftState.y + 0.10,
                z: wz,
                vx: -cosH * 3.8 + rightH_X * sideSign * 1.4 + (Math.random() - 0.5) * 2.2,
                vy: 1.3 + Math.random() * 2.2,
                vz: -sinH * 3.8 + rightH_Z * sideSign * 1.4 + (Math.random() - 0.5) * 2.2,
                size: 0.14 + Math.random() * 0.11,
                gravity: 16,
                rot: 0,
                vRot: 0,
                life: 0.22,
                color: isFever ? '#22d3ee' : '#fbbf24',
              });
            }
          }

          // Front brake-lockup or counter-steer scrub smoke off front outer tire
          if ((tireBrakingNow || tireSlipIntensity > 0.76) && Math.random() < 0.45) {
            const frontTarget = anchors.frontRight.isCameraFacing
              ? anchors.frontRight
              : anchors.frontLeft;
            unprojectTireToRoad(
              spriteLeft + frontTarget.u * carDrawW,
              spriteTop + frontTarget.v * carDrawH,
              tireY,
              tireFrontWorldA
            );
            pushSmokePuff({
              x: tireFrontWorldA.x,
              y: driftState.y + 0.08,
              z: tireFrontWorldA.z,
              vx: -cosH * 2.0 + (Math.random() - 0.5) * 0.9,
              vy: 0.32 + Math.random() * 0.35,
              vz: -sinH * 2.0 + (Math.random() - 0.5) * 0.9,
              radius: 0.14,
              maxRadius: 0.44,
              life: 0.26,
              maxLife: 0.26,
              tint: smokeTint,
              overCar: frontTarget.isCameraFacing,
            });
          }
        }
      }

      // A. Anime Sky Gradient, Dynamic Stars/Aurora/God-Rays & Offscreen Celestial Sun/Moon
      ctx.fillStyle = cachedSkyGrad || sky.skyStops[1];
      ctx.fillRect(0, 0, pxW, horizonY + 14);

      const sunX = Math.round(pxW * sky.celestialXRatio - (camHeading + Math.PI / 2) * 18);
      const sunY = Math.round(horizonY * sky.celestialYRatio);

      renderDynamicSkyAtmosphere({
        ctx,
        pxW,
        horizonY,
        nowMs: now,
        camHeading,
        sky,
        sunScreenX: sunX,
        sunScreenY: sunY,
      });

      ctx.drawImage(
        celestialCanvas,
        Math.round(sunX - celestialCanvas.width * 0.5),
        Math.round(sunY - celestialCanvas.height * 0.5)
      );

      // Render Soaring Mythical Dragons & Weird Celestial Anomalies (UFO, Sky Whale, Blimp)
      renderMythicalDragonsAndSkyAnomalies({
        ctx,
        pxW,
        horizonY,
        nowMs: now,
        camHeading,
        sky,
      });

      // B. Pre-Rendered 4-Layer Cel-Shaded Shinkai Anime Clouds
      const cloudDrift = (camHeading + Math.PI / 2) * 32;
      const drawAnimeCloud = (
        idx: number,
        baseFrac: number,
        yFrac: number,
        parallax: number,
        breezePxPerMs: number
      ) => {
        const cc = cloudCanvases[idx];
        const span = pxW + cc.width + 24;
        const rawX = baseFrac * pxW + now * breezePxPerMs - cloudDrift * parallax;
        const wrappedX = (((rawX + cc.width * 0.5 + 12) % span) + span) % span - cc.width - 12;
        ctx.drawImage(cc, Math.round(wrappedX), Math.round(horizonY * yFrac - cc.height * 0.65));
      };
      drawAnimeCloud(4, 0.20, 0.30, 0.24, 0.0022);
      drawAnimeCloud(3, 0.56, 0.25, 0.28, 0.0031);
      drawAnimeCloud(0, 0.14, 0.64, 0.42, 0.0018);
      drawAnimeCloud(1, 0.88, 0.58, 0.44, 0.0015);
      drawAnimeCloud(2, 0.46, 0.78, 0.32, 0.0026);

      // C. Offscreen Cached Horizon Skyline / Mesas / Alpine Peaks
      const mtnShift = (camHeading + Math.PI / 2) * 44;
      const clampedShift = Math.max(-155, Math.min(155, Math.round(mtnShift * 0.55)));
      ctx.drawImage(horizonCanvas, -160 - clampedShift, 0);

      // D. Collect Visible Road Slices into pre-allocated pool & sort far-to-near in place
      let visibleCount = 0;
      for (let i = 0; i < track.length && visibleCount < slicePool.length; i++) {
        const pt = track[i];
        const rawZ = (pt.x - camWorldX) * fwdX + (pt.z - camWorldZ) * fwdZ;
        if (rawZ < -3.4 || rawZ > 155) continue;

        const sl = slicePool[visibleCount];
        const hw = pt.width * 0.5;
        const lx = pt.x - pt.nx * hw;
        const lz = pt.z - pt.nz * hw;
        const rx = pt.x + pt.nx * hw;
        const rz = pt.z + pt.nz * hw;

        if (
          projectInto(lx, pt.y, lz, sl.pL, 0.45) &&
          projectInto(rx, pt.y, rz, sl.pR, 0.45) &&
          projectInto(lx, pt.y - 1.15, lz, sl.uL, 0.45) &&
          projectInto(rx, pt.y - 1.15, rz, sl.uR, 0.45) &&
          projectInto(lx, pt.y + 0.65, lz, sl.gL, 0.45) &&
          projectInto(rx, pt.y + 0.65, rz, sl.gR, 0.45) &&
          projectInto(pt.x, pt.y, pt.z, sl.cM, 0.45)
        ) {
          sl.pt = pt;
          sl.rawZ = rawZ;
          visibleCount++;
        }
      }

      for (let i = 1; i < visibleCount; i++) {
        const key = slicePool[i];
        let j = i - 1;
        while (j >= 0 && slicePool[j].rawZ < key.rawZ) {
          slicePool[j + 1] = slicePool[j];
          j--;
        }
        slicePool[j + 1] = key;
      }

      // Base valley sky-horizon backdrop + True 3D Contoured Terrain Mesh
      ctx.fillStyle = cachedMeadowGrad || biome.valleyStops[1];
      ctx.fillRect(0, horizonY, pxW, pxH - horizonY);

      renderTerrainMesh3D({
        ctx,
        visibleSlices: slicePool,
        visibleCount,
        biome,
        nowMs: now,
        projectInto,
      });

      // E. True 3D Extruded Roadside Objects grounded on local terrain relief (far-to-near, zero-alloc sort)
      let propCount = 0;
      for (let i = 0; i < valleyProps.length && propCount < propSortBuf.length; i++) {
        const prop = valleyProps[i];
        const rawZ = (prop.x - camWorldX) * fwdX + (prop.z - camWorldZ) * fwdZ;
        if (rawZ > 1.8 && rawZ < 160) {
          propSortBuf[propCount].prop = prop;
          propSortBuf[propCount].rawZ = rawZ;
          propCount++;
        }
      }
      for (let i = 1; i < propCount; i++) {
        const key = propSortBuf[i];
        let j = i - 1;
        while (j >= 0 && propSortBuf[j].rawZ < key.rawZ) {
          propSortBuf[j + 1] = propSortBuf[j];
          j--;
        }
        propSortBuf[j + 1] = key;
      }

      for (let i = 0; i < propCount; i++) {
        renderWorldObject3D({
          ctx,
          prop: propSortBuf[i].prop,
          biome,
          nowMs: now,
          pxW,
          projectInto,
        });
      }

      if (sky.isNight && (rawBiome.id !== 'neon' || sky.id === 'red_moon')) {
        ctx.fillStyle =
          sky.id === 'red_moon'
            ? rawBiome.id === 'neon'
              ? 'rgba(56, 8, 22, 0.24)'
              : 'rgba(38, 6, 18, 0.44)'
            : 'rgba(6, 12, 34, 0.44)';
        ctx.fillRect(0, horizonY, pxW, pxH - horizonY);
      }

      // F. Continuous Elevated Viaduct Overpass (Painter's Algorithm: Far to Near with Distance LOD & Batched Strokes)
      for (let i = 0; i < visibleCount - 1; ) {
        const far = slicePool[i];
        const step = far.rawZ > 72 && i + 2 < visibleCount ? 2 : 1;
        const near = slicePool[i + step];
        i += step;
        if (Math.abs(far.pt.index - near.pt.index) > step + 1) continue;

        const isNearMid = far.rawZ < 58;
        const strokeWalls = far.rawZ < 54 ? '#1e293b' : undefined;

        // 1. Tall Shaded Concrete Viaduct Support Pillars + Arched Pier Cap
        if (far.pt.index % 7 === 0 && far.rawZ > 2.2) {
          if (projectInto(far.pt.x, VALLEY_FLOOR_Y - 0.5, far.pt.z, pScratchTmp)) {
            const pierW = Math.max(3, Math.round(far.pt.width * 0.25 * far.cM.scale));
            const capW = Math.round(pierW * 1.65);
            const topY = Math.round((far.uL.y + far.uR.y) * 0.5);
            const botY = Math.round(pScratchTmp.y);
            const cx = Math.round(far.cM.x);
            if (botY > topY) {
              ctx.fillStyle = biome.pierLight;
              ctx.fillRect(cx - Math.round(capW * 0.5), topY, capW, Math.max(2, Math.round(pierW * 0.28)));
              ctx.fillRect(cx - Math.round(pierW * 0.5), topY, Math.round(pierW * 0.55), botY - topY);
              ctx.fillStyle = biome.pierDark;
              ctx.fillRect(cx + Math.round(pierW * 0.05), topY, Math.round(pierW * 0.45), botY - topY);
            }
          }
        }

        // 2. Concrete Viaduct Bridge Underside & Side Rim
        drawQuadPts(far.pL, near.pL, near.uL, far.uL, biome.wallLeft, strokeWalls, 1);
        drawQuadPts(far.pR, near.pR, near.uR, far.uR, biome.wallRight, strokeWalls, 1);
        drawQuadPts(far.uL, far.uR, near.uR, near.uL, biome.underside);

        // 3. Multi-Layer Textured Asphalt Road Ribbon
        const asphaltColor = Math.floor(far.pt.index / step) % 2 === 0 ? biome.asphaltEven : biome.asphaltOdd;
        drawQuadPts(far.pL, far.pR, near.pR, near.pL, asphaltColor);

        if (isNearMid && far.pt.index % 4 === 0) {
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.round(far.pL.x), Math.round(far.pL.y));
          ctx.lineTo(Math.round(far.pR.x), Math.round(far.pR.y));
          ctx.stroke();
        }

        // Subtle dual tire-wear grooves per lane (batched single beginPath)
        if (isNearMid) {
          ctx.strokeStyle = 'rgba(15, 20, 30, 0.16)';
          ctx.lineWidth = Math.max(1, Math.round(0.18 * near.cM.scale));
          const dfx = far.pR.x - far.pL.x;
          const dfy = far.pR.y - far.pL.y;
          const dnx = near.pR.x - near.pL.x;
          const dny = near.pR.y - near.pL.y;
          ctx.beginPath();
          if (isHighwayMode) {
            for (const gs of [0.20, 0.30, 0.70, 0.80]) {
              ctx.moveTo(Math.round(far.pL.x + dfx * gs), Math.round(far.pL.y + dfy * gs));
              ctx.lineTo(Math.round(near.pL.x + dnx * gs), Math.round(near.pL.y + dny * gs));
            }
          } else {
            for (const gs of [0.38, 0.62]) {
              ctx.moveTo(Math.round(far.pL.x + dfx * gs), Math.round(far.pL.y + dfy * gs));
              ctx.lineTo(Math.round(near.pL.x + dnx * gs), Math.round(near.pL.y + dny * gs));
            }
          }
          ctx.stroke();
        }

        // Batched outer edge stripes in a single path!
        ctx.strokeStyle = biome.edgeStripe;
        ctx.lineWidth = Math.max(1, Math.round(0.14 * near.cM.scale));
        ctx.beginPath();
        ctx.moveTo(Math.round(far.pL.x), Math.round(far.pL.y));
        ctx.lineTo(Math.round(near.pL.x), Math.round(near.pL.y));
        ctx.moveTo(Math.round(far.pR.x), Math.round(far.pR.y));
        ctx.lineTo(Math.round(near.pR.x), Math.round(near.pR.y));
        ctx.stroke();

        if (far.pt.index % 3 === 0 && far.rawZ < 75) {
          ctx.fillStyle = biome.isNight ? '#22d3ee' : '#fef9c3';
          const studSz = Math.max(1, Math.round(0.12 * far.cM.scale));
          ctx.fillRect(Math.round(far.cM.x - studSz * 0.5), Math.round(far.cM.y - studSz * 0.5), studSz, studSz);
        }

        // Center divider: Double Yellow Solid Highway Lines batched in 1 path!
        if (isHighwayMode) {
          const dfx = far.pR.x - far.pL.x;
          const dfy = far.pR.y - far.pL.y;
          const dnx = near.pR.x - near.pL.x;
          const dny = near.pR.y - near.pL.y;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1, Math.round(0.11 * near.cM.scale));
          ctx.beginPath();
          ctx.moveTo(Math.round(far.pL.x + dfx * 0.483), Math.round(far.pL.y + dfy * 0.483));
          ctx.lineTo(Math.round(near.pL.x + dnx * 0.483), Math.round(near.pL.y + dny * 0.483));
          ctx.moveTo(Math.round(far.pL.x + dfx * 0.517), Math.round(far.pL.y + dfy * 0.517));
          ctx.lineTo(Math.round(near.pL.x + dnx * 0.517), Math.round(near.pL.y + dny * 0.517));
          ctx.stroke();

          if (far.pt.index % 8 === 0 && far.rawZ > 4 && far.rawZ < 90) {
            const arrowR = Math.max(2, Math.round(0.42 * far.cM.scale));
            const lx = far.pL.x + dfx * 0.25;
            const ly = far.pL.y + dfy * 0.25;
            ctx.strokeStyle = 'rgba(251, 113, 133, 0.55)';
            ctx.lineWidth = Math.max(1, Math.round(0.10 * far.cM.scale));
            ctx.beginPath();
            ctx.moveTo(Math.round(lx - arrowR), Math.round(ly - arrowR * 0.45));
            ctx.lineTo(Math.round(lx), Math.round(ly + arrowR * 0.45));
            ctx.lineTo(Math.round(lx + arrowR), Math.round(ly - arrowR * 0.45));
            ctx.stroke();

            const rx = far.pL.x + dfx * 0.75;
            const ry = far.pL.y + dfy * 0.75;
            ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
            ctx.beginPath();
            ctx.moveTo(Math.round(rx - arrowR), Math.round(ry + arrowR * 0.45));
            ctx.lineTo(Math.round(rx), Math.round(ry - arrowR * 0.45));
            ctx.lineTo(Math.round(rx + arrowR), Math.round(ry + arrowR * 0.45));
            ctx.stroke();
          }
        } else if (far.pt.index % 2 === 0) {
          ctx.strokeStyle = biome.centerLine;
          ctx.lineWidth = Math.max(1, Math.round(0.10 * near.cM.scale));
          ctx.beginPath();
          ctx.moveTo(Math.round(far.cM.x), Math.round(far.cM.y));
          ctx.lineTo(Math.round(near.cM.x), Math.round(near.cM.y));
          ctx.stroke();
        }

        if (Math.abs(far.pt.curvature) > 0.012 && far.rawZ < 76) {
          const grooveOff = far.pt.curvature > 0 ? -0.18 : 0.18;
          const gFarX = far.pL.x + (far.pR.x - far.pL.x) * (0.5 + grooveOff);
          const gFarY = far.pL.y + (far.pR.y - far.pL.y) * (0.5 + grooveOff);
          const gNearX = near.pL.x + (near.pR.x - near.pL.x) * (0.5 + grooveOff);
          const gNearY = near.pL.y + (near.pR.y - near.pL.y) * (0.5 + grooveOff);
          ctx.strokeStyle = 'rgba(15, 20, 30, 0.34)';
          ctx.lineWidth = Math.max(1, Math.round(0.22 * near.cM.scale));
          ctx.beginPath();
          ctx.moveTo(Math.round(gFarX), Math.round(gFarY));
          ctx.lineTo(Math.round(gNearX), Math.round(gNearY));
          ctx.stroke();
        }

        // 3b. Pixel Apex Rumble Curbs on Curves (zero allocations!)
        if (Math.abs(far.pt.curvature) > 0.011) {
          const isInsideLeft = far.pt.curvature < 0;
          const curbCol = far.pt.index % 2 === 0 ? biome.curbA : biome.curbB;
          if (isInsideLeft) {
            pScratch0.x = far.pL.x + (far.pR.x - far.pL.x) * 0.075;
            pScratch0.y = far.pL.y + (far.pR.y - far.pL.y) * 0.075;
            pScratch1.x = near.pL.x + (near.pR.x - near.pL.x) * 0.075;
            pScratch1.y = near.pL.y + (near.pR.y - near.pL.y) * 0.075;
            drawQuadPts(far.pL, pScratch0, pScratch1, near.pL, curbCol);
          } else {
            pScratch0.x = far.pR.x - (far.pR.x - far.pL.x) * 0.075;
            pScratch0.y = far.pR.y - (far.pR.y - far.pL.y) * 0.075;
            pScratch1.x = near.pR.x - (near.pR.x - near.pL.x) * 0.075;
            pScratch1.y = near.pR.y - (near.pR.y - near.pL.y) * 0.075;
            drawQuadPts(pScratch0, far.pR, near.pR, pScratch1, curbCol);
          }
        }

        // 4. Illuminated Boost Pad on Road
        if (far.pt.hasBoostPad && !far.pt.boostTriggered) {
          const padW = Math.max(4, Math.round(1.4 * far.cM.scale));
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.moveTo(Math.round(far.cM.x), Math.round(far.cM.y - padW * 0.65));
          ctx.lineTo(Math.round(far.cM.x + padW), Math.round(far.cM.y + padW * 0.5));
          ctx.lineTo(Math.round(far.cM.x - padW), Math.round(far.cM.y + padW * 0.5));
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#cffafe';
          ctx.fillRect(Math.round(far.cM.x - 1), Math.round(far.cM.y - padW * 0.25), 2, Math.max(2, Math.round(padW * 0.5)));
        }

        // 5. Metallic Steel Guardrails & Posts (batched railSpec & posts with LOD)
        const isBreached = breachedSliceIdx >= 0 && Math.abs(far.pt.index - breachedSliceIdx) <= 1;
        if (!isBreached) {
          drawQuadPts(far.gL, near.gL, near.pL, far.pL, biome.railLight, strokeWalls, 1);
          drawQuadPts(far.gR, near.gR, near.pR, far.pR, biome.railDark, strokeWalls, 1);

          if (far.rawZ < 48) {
            ctx.strokeStyle = biome.railSpec;
            ctx.lineWidth = Math.max(1, Math.round(0.08 * near.cM.scale));
            ctx.beginPath();
            ctx.moveTo(Math.round(far.gL.x), Math.round(far.gL.y));
            ctx.lineTo(Math.round(near.gL.x), Math.round(near.gL.y));
            ctx.moveTo(Math.round(far.gR.x), Math.round(far.gR.y));
            ctx.lineTo(Math.round(near.gR.x), Math.round(near.gR.y));
            ctx.stroke();
          }

          if (far.rawZ < 44) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = Math.max(1, Math.round(0.11 * far.cM.scale));
            ctx.beginPath();
            ctx.moveTo(Math.round(far.pL.x), Math.round(far.pL.y));
            ctx.lineTo(Math.round(far.gL.x), Math.round(far.gL.y));
            ctx.moveTo(Math.round(far.pR.x), Math.round(far.pR.y));
            ctx.lineTo(Math.round(far.gR.x), Math.round(far.gR.y));
            ctx.stroke();
          }

          if (Math.abs(far.pt.curvature) > 0.014 && far.pt.index % 3 === 0) {
            const outerPost = far.pt.curvature > 0 ? far.gL : far.gR;
            const signW = Math.max(4, Math.round(0.95 * far.cM.scale));
            const signH = Math.max(4, Math.round(0.85 * far.cM.scale));
            const sx = Math.round(outerPost.x - signW * 0.5);
            const sy = Math.round(outerPost.y - signH - Math.max(2, Math.round(0.35 * far.cM.scale)));
            ctx.fillStyle = '#334155';
            ctx.fillRect(Math.round(outerPost.x) - 1, sy + signH, 2, Math.max(2, Math.round(outerPost.y - (sy + signH))));
            ctx.fillStyle = '#090d16';
            ctx.fillRect(sx - 1, sy - 1, signW + 2, signH + 2);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(sx, sy, signW, signH);
            if (signW >= 5 && signH >= 5) {
              ctx.strokeStyle = '#090d16';
              ctx.lineWidth = Math.max(1, Math.round(signW * 0.16));
              const midY = sy + Math.round(signH * 0.5);
              const tipX = far.pt.curvature > 0 ? sx + Math.round(signW * 0.72) : sx + Math.round(signW * 0.28);
              const backX = far.pt.curvature > 0 ? sx + Math.round(signW * 0.28) : sx + Math.round(signW * 0.72);
              ctx.beginPath();
              ctx.moveTo(backX, sy + Math.round(signH * 0.22));
              ctx.lineTo(tipX, midY);
              ctx.lineTo(backX, sy + Math.round(signH * 0.78));
              ctx.stroke();
            }
          }
        }

        // 5c. Roadside Highway Streetlamps
        if (far.pt.index % 6 === 0 && far.rawZ > 8.5 && far.rawZ < 115) {
          const isLeftLamp = far.pt.index % 12 === 0;
          const postBase = isLeftLamp ? far.gL : far.gR;
          const roadCenterX = far.cM.x;
          const poleH = Math.max(8, Math.round(3.4 * far.cM.scale));
          const armReach = Math.max(3, Math.round(1.15 * far.cM.scale)) * (isLeftLamp ? 1 : -1);
          const pxBase = Math.round(postBase.x);
          const pyBase = Math.round(postBase.y);
          const pyTop = pyBase - poleH;
          const bulbX = Math.round(pxBase + (roadCenterX > pxBase ? Math.abs(armReach) : -Math.abs(armReach)));

          ctx.strokeStyle = '#475569';
          ctx.lineWidth = Math.max(1, Math.round(0.14 * far.cM.scale));
          ctx.beginPath();
          ctx.moveTo(pxBase, pyBase);
          ctx.lineTo(pxBase, pyTop);
          ctx.lineTo(bulbX, pyTop);
          ctx.stroke();

          ctx.fillStyle = biome.lampColor;
          ctx.globalAlpha = biome.isNight ? 0.32 : 0.16;
          ctx.beginPath();
          ctx.arc(bulbX, pyTop + 1, Math.min(7, Math.max(2, Math.round(0.45 * far.cM.scale))), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bulbX - 1, pyTop, Math.max(2, Math.round(0.22 * far.cM.scale)), 2);
        }

        // 5d. Overhead Highway Steel Gantries with Illuminated Biome Signboard!
        if (far.pt.index >= 10 && far.pt.index % 26 === 14 && far.rawZ > 7 && far.rawZ < 110) {
          const gantryH = Math.max(10, Math.round(3.6 * far.cM.scale));
          const leftX = Math.round(far.gL.x);
          const leftY = Math.round(far.gL.y);
          const rightX_g = Math.round(far.gR.x);
          const rightY_g = Math.round(far.gR.y);
          const topYL = leftY - gantryH;
          const topYR = rightY_g - gantryH;

          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = Math.max(2, Math.round(0.22 * far.cM.scale));
          ctx.beginPath();
          ctx.moveTo(leftX, leftY);
          ctx.lineTo(leftX, topYL);
          ctx.lineTo(rightX_g, topYR);
          ctx.lineTo(rightX_g, rightY_g);
          ctx.stroke();

          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1, Math.round(0.11 * far.cM.scale));
          ctx.beginPath();
          ctx.moveTo(leftX, topYL);
          ctx.lineTo(rightX_g, topYR);
          ctx.stroke();

          const midGX = Math.round((leftX + rightX_g) * 0.5);
          const midGY = Math.round((topYL + topYR) * 0.5);
          const signW = Math.max(12, Math.round(Math.abs(rightX_g - leftX) * 0.48));
          const signH = Math.max(5, Math.round(0.95 * far.cM.scale));
          ctx.fillStyle = '#090d16';
          ctx.fillRect(midGX - Math.round(signW * 0.5) - 1, midGY - Math.round(signH * 0.5) - 1, signW + 2, signH + 2);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(midGX - Math.round(signW * 0.5), midGY - Math.round(signH * 0.5), signW, signH);
          ctx.fillStyle = biome.gantryAccent;
          ctx.fillRect(midGX - Math.round(signW * 0.5), midGY - Math.round(signH * 0.5), signW, Math.max(1, Math.round(signH * 0.22)));

          if (signW >= 26) {
            ctx.textAlign = 'center';
            ctx.font = `bold ${Math.max(5, Math.round(signH * 0.56))}px "Chakra Petch", monospace`;
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(biome.gantrySign, midGX, midGY + Math.round(signH * 0.28));
          }
        }

        // 5e. 3D Roadside Reflector Bollards, Truss Bridges & Weird Landmarks (Dragon Skull, Torii, Monolith, Arcade)
        renderReflectorBollard3D({ ctx, far, biome });
        renderBridgeTrussArch3D({ ctx, far, biome, projectInto });
        renderWeirdRoadsideLandmarks3D({ ctx, far, biome, projectInto, nowMs: now });
      }

      // G. Persistent Dual Tire Skid Marks & Brake Lockup Streaks anchored to Car Tires (Ring Buffers!)
      const renderSkidRing = (buf: SkidSegment[], head: number, count: number, cap: number) => {
        for (let k = 1; k < count; k++) {
          const prev = buf[(head + k - 1) % cap];
          const curr = buf[(head + k) % cap];
          if (!curr.connected) continue;

          ctx.globalAlpha = curr.alpha;
          ctx.strokeStyle = curr.color;
          if (
            projectInto(prev.lx, prev.y, prev.lz, pScratchTmp) &&
            projectInto(curr.lx, curr.y, curr.lz, pScratchTmp2)
          ) {
            ctx.lineWidth = Math.max(2, Math.round(0.25 * curr.widthScale * pScratchTmp2.scale));
            ctx.beginPath();
            ctx.moveTo(Math.round(pScratchTmp.x), Math.round(pScratchTmp.y));
            ctx.lineTo(Math.round(pScratchTmp2.x), Math.round(pScratchTmp2.y));
            ctx.stroke();
          }
          if (
            projectInto(prev.rx, prev.y, prev.rz, pScratchTmp) &&
            projectInto(curr.rx, curr.y, curr.rz, pScratchTmp2)
          ) {
            ctx.lineWidth = Math.max(2, Math.round(0.25 * curr.widthScale * pScratchTmp2.scale));
            ctx.beginPath();
            ctx.moveTo(Math.round(pScratchTmp.x), Math.round(pScratchTmp.y));
            ctx.lineTo(Math.round(pScratchTmp2.x), Math.round(pScratchTmp2.y));
            ctx.stroke();
          }
        }
      };
      renderSkidRing(skidMarks, skidHead, skidCount, MAX_SKID);
      if (frontSkidCount > 1) {
        renderSkidRing(frontSkidMarks, frontSkidHead, frontSkidCount, MAX_FRONT_SKID);
      }
      ctx.globalAlpha = 1.0;

      // H. Spinning Gold Nitro Coins & Teal/Gold Nitro Star Gems along the S-Curve
      for (let i = track.length - 1; i >= 0; i--) {
        const pt = track[i];
        if (pt.hasCoin && !pt.coinCollected) {
          if (
            projectInto(pt.coinX, pt.y + 0.65, pt.coinZ, pScratchTmp) &&
            pScratchTmp.z <= 120 &&
            !(phase === 'title' && pScratchTmp.z < 24)
          ) {
            const r = Math.max(2, Math.round(0.45 * pScratchTmp.scale));
            const spinW = Math.max(1, Math.round(Math.abs(Math.cos(now * 0.005 + pt.index)) * r));
            const cx = Math.round(pScratchTmp.x);
            const cy = Math.round(pScratchTmp.y);
            ctx.fillStyle = '#090d16';
            ctx.fillRect(cx - spinW - 1, cy - r - 1, spinW * 2 + 2, r * 2 + 2);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(cx - spinW, cy - r, spinW * 2, r * 2);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(cx - Math.max(1, Math.floor(spinW * 0.4)), cy - r + 1, Math.max(1, Math.floor(spinW * 0.6)), r);
          }
        }

        if (pt.hasNitroGem && !pt.gemCollected) {
          if (
            projectInto(
              pt.coinX,
              pt.y + 0.85 + Math.sin(now * 0.006 + pt.index) * 0.14,
              pt.coinZ,
              pScratchTmp
            ) &&
            pScratchTmp.z <= 120 &&
            !(phase === 'title' && pScratchTmp.z < 24)
          ) {
            const gr = Math.max(3, Math.round(0.62 * pScratchTmp.scale));
            const cx = Math.round(pScratchTmp.x);
            const cy = Math.round(pScratchTmp.y);
            pScratch0.x = cx;
            pScratch0.y = cy - gr;
            pScratch1.x = cx + gr;
            pScratch1.y = cy;
            pScratch2.x = cx;
            pScratch2.y = cy + gr;
            pScratch3.x = cx - gr;
            pScratch3.y = cy;
            drawQuadPts(pScratch0, pScratch1, pScratch2, pScratch3, '#06b6d4', '#090d16', 1);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(cx - 1, cy - 1, 2, 2);
          }
        }
      }

      const drawSmokePuff = (p: SmokePuff) => {
        if (!projectInto(p.x, p.y, p.z, pScratchTmp)) return;
        const age = 1 - p.life / p.maxLife;
        const curRad = p.radius + (p.maxRadius - p.radius) * age;
        const pr = Math.max(2, Math.round(curRad * pScratchTmp.scale));
        const sx = Math.round(pScratchTmp.x);
        const sy = Math.round(pScratchTmp.y);
        const alpha = Math.min(0.84, (p.life / p.maxLife) * 0.94);

        ctx.globalAlpha = alpha;
        ctx.fillStyle =
          p.tint === 'cyan'
            ? '#0891b2'
            : p.tint === 'aqua'
            ? '#0e7490'
            : p.tint === 'pink'
            ? '#db2777'
            : p.tint === 'warm'
            ? '#94a3b8'
            : p.tint === 'fire'
            ? '#dc2626'
            : p.tint === 'dark'
            ? '#1e293b'
            : '#cbd5e1';
        ctx.beginPath();
        ctx.arc(sx, sy + 1, pr, 0, Math.PI * 2);
        ctx.arc(sx - Math.round(pr * 0.45), sy + 2, Math.max(1, Math.round(pr * 0.65)), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle =
          p.tint === 'cyan'
            ? '#cffafe'
            : p.tint === 'aqua'
            ? '#a5f3fc'
            : p.tint === 'pink'
            ? '#fbcfe8'
            : p.tint === 'warm'
            ? '#fef3c7'
            : p.tint === 'fire'
            ? '#fef08a'
            : p.tint === 'dark'
            ? '#475569'
            : '#ffffff';
        ctx.beginPath();
        ctx.arc(sx - Math.round(pr * 0.12), sy - Math.round(pr * 0.18), Math.max(1, Math.round(pr * 0.78)), 0, Math.PI * 2);
        ctx.arc(sx + Math.round(pr * 0.35), sy - Math.round(pr * 0.05), Math.max(1, Math.round(pr * 0.56)), 0, Math.PI * 2);
        ctx.fill();
      };

      // I. Billowing Layered Pixel Tire Smoke & Crash Plumes (behind vehicles, O(1) swap-remove)
      for (let i = smokePuffs.length - 1; i >= 0; i--) {
        const p = smokePuffs[i];
        p.life -= dt;
        if (p.life <= 0) {
          smokePuffs[i] = smokePuffs[smokePuffs.length - 1];
          smokePuffs.pop();
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (!p.overCar) {
          drawSmokePuff(p);
        }
      }
      ctx.globalAlpha = 1.0;

      // I2. Expanding 3D Shockwave Rings (Fever, Star Gem, Boost Pad, Guardrail Breach & Crash Explosion)
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life -= dt;
        if (sw.life <= 0) {
          shockwaves[i] = shockwaves[shockwaves.length - 1];
          shockwaves.pop();
          continue;
        }
        if (!projectInto(sw.x, sw.y, sw.z, pScratchTmp)) continue;
        const t = 1 - sw.life / sw.maxLife;
        const rad = sw.radius + (sw.maxRadius - sw.radius) * t;
        const rxPx = Math.max(4, Math.round(rad * pScratchTmp.scale));
        const ryPx = Math.max(2, Math.round(rxPx * 0.42));
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = Math.max(2, Math.round((1 - t) * 4));
        ctx.beginPath();
        ctx.ellipse(Math.round(pScratchTmp.x), Math.round(pScratchTmp.y), rxPx, ryPx, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // J. Depth-Sorted Traffic Vehicles + Oncoming Headlight Cones + Hero Pixel-Art Car!
      let vehicleCount = 0;

      if (isHighwayMode) {
        for (let i = 0; i < trafficCars.length && vehicleCount < vehicleDrawBuf.length - 1; i++) {
          const tc = trafficCars[i];
          const sample = sampleTrackAtS(track, tc.s, STEP_DIST);
          if (!sample) continue;
          const wx = sample.x + sample.nx * tc.lateralOffset;
          const wy = sample.y;
          const wz = sample.z + sample.nz * tc.lateralOffset;
          const rawZ = (wx - camWorldX) * fwdX + (wz - camWorldZ) * fwdZ;
          if (rawZ < 1.5 || rawZ > 145) continue;

          // Oncoming cars cast crisp two-tier headlight beams onto the highway asphalt ahead of them!
          if (tc.isOncoming && rawZ < 110) {
            const frontSample = sampleTrackAtS(track, tc.s - tc.halfLength * 0.9, STEP_DIST);
            const midSample = sampleTrackAtS(track, tc.s - tc.halfLength - 4.8, STEP_DIST);
            const tipSample = sampleTrackAtS(track, tc.s - tc.halfLength - 9.8, STEP_DIST);
            if (frontSample && midSample && tipSample) {
              const fx = frontSample.x + frontSample.nx * tc.lateralOffset;
              const fz = frontSample.z + frontSample.nz * tc.lateralOffset;
              const mxW = midSample.x + midSample.nx * tc.lateralOffset;
              const mzW = midSample.z + midSample.nz * tc.lateralOffset;
              const txW = tipSample.x + tipSample.nx * tc.lateralOffset;
              const tzW = tipSample.z + tipSample.nz * tc.lateralOffset;
              if (
                projectInto(fx - frontSample.nx * 0.68, frontSample.y + 0.06, fz - frontSample.nz * 0.68, pScratch0, 0.45) &&
                projectInto(fx + frontSample.nx * 0.68, frontSample.y + 0.06, fz + frontSample.nz * 0.68, pScratch1, 0.45) &&
                projectInto(mxW - midSample.nx * 1.02, midSample.y + 0.05, mzW - midSample.nz * 1.02, pScratch2, 0.45) &&
                projectInto(mxW + midSample.nx * 1.02, midSample.y + 0.05, mzW + midSample.nz * 1.02, pScratch3, 0.45) &&
                projectInto(txW - tipSample.nx * 1.32, tipSample.y + 0.05, tzW - tipSample.nz * 1.32, pScratch4, 0.45) &&
                projectInto(txW + tipSample.nx * 1.32, tipSample.y + 0.05, tzW + tipSample.nz * 1.32, pScratch5, 0.45)
              ) {
                ctx.globalAlpha = biome.isNight ? 0.36 : 0.20;
                drawQuadPts(pScratch0, pScratch1, pScratch3, pScratch2, '#fef9c3');
                ctx.globalAlpha = biome.isNight ? 0.18 : 0.09;
                drawQuadPts(pScratch2, pScratch3, pScratch5, pScratch4, '#fef08a');
                ctx.globalAlpha = 1.0;
              }
            }
          }

          const slot = vehicleDrawBuf[vehicleCount];
          if (projectInto(wx, wy, wz, slot.proj)) {
            slot.rawZ = rawZ;
            slot.isHero = false;
            slot.traffic = tc;
            vehicleCount++;
          }
        }
      }

      const heroRawZ = (driftState.x - camWorldX) * fwdX + (driftState.z - camWorldZ) * fwdZ;
      if (vehicleCount < vehicleDrawBuf.length) {
        const heroSlot = vehicleDrawBuf[vehicleCount];
        if (projectInto(driftState.x, driftState.y, driftState.z, heroSlot.proj)) {
          heroSlot.rawZ = heroRawZ;
          heroSlot.isHero = true;
          heroSlot.traffic = undefined;
          vehicleCount++;
        }
      }

      // Insertion sort far-to-near in place so closer cars cleanly occlude distant vehicles
      for (let i = 1; i < vehicleCount; i++) {
        const key = vehicleDrawBuf[i];
        let j = i - 1;
        while (j >= 0 && vehicleDrawBuf[j].rawZ < key.rawZ) {
          vehicleDrawBuf[j + 1] = vehicleDrawBuf[j];
          j--;
        }
        vehicleDrawBuf[j + 1] = key;
      }

      const isHighBeamPulse =
        highBeamTimer > 0 && Math.floor(highBeamTimer * 18) % 2 === 0;

      // Project Hero Car Forward Headlights / High-Beam Flash Cones onto Road Ahead
      if (!isFalling && !isTrafficCrash && (biome.isNight || highBeamTimer > 0)) {
        const fwdCos = Math.cos(driftState.heading);
        const fwdSin = Math.sin(driftState.heading);
        const rgtX = -fwdSin;
        const rgtZ = fwdCos;
        const reachNear = 1.85;
        const reachMid = isHighBeamPulse ? 14.0 : 8.5;
        const reachFar = isHighBeamPulse ? 26.0 : 14.5;
        const spreadMid = isHighBeamPulse ? 2.15 : 1.55;
        const spreadFar = isHighBeamPulse ? 3.2 : 2.25;

        if (
          projectInto(driftState.x + fwdCos * reachNear - rgtX * 0.65, driftState.y + 0.06, driftState.z + fwdSin * reachNear - rgtZ * 0.65, pScratch0, 0.45) &&
          projectInto(driftState.x + fwdCos * reachNear + rgtX * 0.65, driftState.y + 0.06, driftState.z + fwdSin * reachNear + rgtZ * 0.65, pScratch1, 0.45) &&
          projectInto(driftState.x + fwdCos * reachMid - rgtX * spreadMid, driftState.y + 0.06, driftState.z + fwdSin * reachMid - rgtZ * spreadMid, pScratch2, 0.45) &&
          projectInto(driftState.x + fwdCos * reachMid + rgtX * spreadMid, driftState.y + 0.06, driftState.z + fwdSin * reachMid + rgtZ * spreadMid, pScratch3, 0.45) &&
          projectInto(driftState.x + fwdCos * reachFar - rgtX * spreadFar, driftState.y + 0.06, driftState.z + fwdSin * reachFar - rgtZ * spreadFar, pScratch4, 0.45) &&
          projectInto(driftState.x + fwdCos * reachFar + rgtX * spreadFar, driftState.y + 0.06, driftState.z + fwdSin * reachFar + rgtZ * spreadFar, pScratch5, 0.45)
        ) {
          ctx.globalAlpha = isHighBeamPulse ? 0.52 : 0.24;
          drawQuadPts(pScratch0, pScratch1, pScratch3, pScratch2, cachedAppearance.headlightBeamHex);
          ctx.globalAlpha = isHighBeamPulse ? 0.28 : 0.11;
          drawQuadPts(pScratch2, pScratch3, pScratch5, pScratch4, cachedAppearance.headlightLensHex);
          ctx.globalAlpha = 1.0;
        }
      }

      for (let v = 0; v < vehicleCount; v++) {
        const item = vehicleDrawBuf[v];
        if (item.isHero) {
          const carDrawW = Math.round(5.4 * item.proj.scale);
          const carDrawH = Math.round(carDrawW * (108 / 144));
          const cx = Math.round(item.proj.x);
          const cy = Math.round(item.proj.y - carDrawH * 0.34);

          if (customImgEl && customImgEl.complete) {
            ctx.save();
            ctx.translate(cx, cy);
            if (isFalling || isTrafficCrash) ctx.rotate(fallRotation);
            if (visualDriftAngle < 0) ctx.scale(-1, 1);
            ctx.drawImage(customImgEl, -carDrawW * 0.5, -carDrawH * 0.5, carDrawW, carDrawH);
            ctx.restore();
          } else {
            const activePedalMode: 'coast' | 'gas' | 'brake' =
              phase === 'playing'
                ? keyDown
                  ? 'brake'
                  : 'gas'
                : 'coast';
            const isWrecked =
              gameModeRef.current === 'zen'
                ? false
                : (isFalling && explodedInFall) || isTrafficCrash;
            const spriteCanvas = getPixelCarCanvas(
              currentCar,
              visualDriftAngle,
              isFever,
              isWrecked,
              wheelSpinPhase,
              carCustomRef.current,
              activePedalMode,
              isHighBeamPulse
            );
            if ((isFalling || isTrafficCrash) && gameModeRef.current !== 'zen') {
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(fallRotation);
              ctx.drawImage(spriteCanvas, -carDrawW * 0.5, -carDrawH * 0.5, carDrawW, carDrawH);
              ctx.restore();
            } else {
              ctx.drawImage(
                spriteCanvas,
                Math.round(cx - carDrawW * 0.5),
                Math.round(cy - carDrawH * 0.5),
                carDrawW,
                carDrawH
              );
            }
          }
        } else if (item.traffic) {
          const tc = item.traffic;
          const sizeScale = tc.kind === 'box_truck' ? 5.9 : tc.kind === 'van' ? 5.4 : 5.1;
          const drawW = Math.max(8, Math.round(sizeScale * item.proj.scale));
          const drawH = Math.max(6, Math.round(drawW * (84 / 112)));
          const tx = Math.round(item.proj.x);
          const ty = Math.round(item.proj.y - drawH * 0.34);
          const viewNorm = Math.max(-1, Math.min(1, (item.proj.x - pxW * 0.5) / Math.max(40, pxW * 0.42)));
          const trSprite = getTrafficVehicleCanvas(
            tc.kind,
            tc.color,
            tc.isOncoming,
            viewNorm,
            biome.isNight
          );
          ctx.drawImage(trSprite, tx - Math.round(drawW * 0.5), ty - Math.round(drawH * 0.5), drawW, drawH);

          // Blinking amber turn-signal hazard indicator when yielding out of player's lane!
          if (tc.yieldingToSide && Math.floor(now / 140) % 2 === 0) {
            const sigX = tx + tc.yieldingToSide * Math.round(drawW * 0.25);
            const sigY = ty + Math.round(drawH * 0.08);
            const sigSize = Math.max(2, Math.round(drawW * 0.08));
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(sigX - Math.floor(sigSize / 2), sigY - Math.floor(sigSize / 2), sigSize, sigSize);
          }
        }
      }

      // J2. Foreground Wheel-Hugging Tire Smoke Wisps curling off camera-facing tires
      for (let i = 0; i < smokePuffs.length; i++) {
        if (smokePuffs[i].overCar) {
          drawSmokePuff(smokePuffs[i]);
        }
      }
      ctx.globalAlpha = 1.0;

      // K. Shattered Guardrail Beams, Wreckage Panels & Spark Chunks (O(1) swap-remove)
      for (let i = debrisChunks.length - 1; i >= 0; i--) {
        const d = debrisChunks[i];
        d.life -= dt;
        if (d.life <= 0) {
          debrisChunks[i] = debrisChunks[debrisChunks.length - 1];
          debrisChunks.pop();
          continue;
        }
        d.vy -= (d.gravity ?? 26) * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.rot += d.vRot * dt;

        if (!projectInto(d.x, d.y, d.z, pScratchTmp)) continue;
        const maxPx = d.w ? 10 : 6;
        const wPx = Math.min(maxPx, Math.max(2, Math.round((d.w ?? d.size) * pScratchTmp.scale)));
        const hPx = Math.min(maxPx, Math.max(2, Math.round((d.h ?? d.size) * pScratchTmp.scale)));
        ctx.save();
        ctx.translate(Math.round(pScratchTmp.x), Math.round(pScratchTmp.y));
        ctx.rotate(d.rot);
        ctx.fillStyle = d.color;
        ctx.fillRect(-wPx * 0.5, -hPx * 0.5, wPx, hPx);
        ctx.restore();
      }

      // K2. Ambient Biome Particles (Sakura Petals / Neon Cyber Orbs / Canyon Embers)
      if (biome.ambientParticle !== 'none') {
        for (let i = 0; i < ambientParticles.length; i++) {
          const ap = ambientParticles[i];
          if (biome.ambientParticle === 'petal') {
            ap.sx += (ap.vx + Math.sin(now * 0.003 + ap.phase) * 14) * dt;
            ap.sy += ap.vy * dt;
          } else if (biome.ambientParticle === 'neon_orb') {
            ap.sx += Math.sin(now * 0.002 + ap.phase) * 8 * dt;
            ap.sy -= ap.vy * 0.65 * dt;
          } else {
            // Canyon rising embers
            ap.sx += Math.sin(now * 0.004 + ap.phase) * 12 * dt;
            ap.sy -= ap.vy * 0.9 * dt;
          }
          if (ap.sx < -4) ap.sx = pxW + 2;
          if (ap.sx > pxW + 4) ap.sx = -2;
          if (ap.sy < -4) ap.sy = pxH + 2;
          if (ap.sy > pxH + 4) ap.sy = -2;

          ctx.fillStyle =
            biome.ambientParticle === 'petal'
              ? i % 2 === 0
                ? '#fbcfe8'
                : '#f472b6'
              : biome.ambientParticle === 'neon_orb'
              ? i % 2 === 0
                ? 'rgba(34, 211, 238, 0.7)'
                : 'rgba(244, 114, 182, 0.7)'
              : 'rgba(251, 146, 60, 0.75)';
          ctx.fillRect(Math.round(ap.sx), Math.round(ap.sy), ap.size, Math.max(1, ap.size - 1));
        }
      }

      // L. Crisp Floating Pixel Callouts (precomputed halfW & O(1) swap-remove)
      if (callouts.length > 0) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 8px "Chakra Petch", monospace';
        for (let i = callouts.length - 1; i >= 0; i--) {
          const ft = callouts[i];
          ft.life -= dt;
          if (ft.life <= 0) {
            callouts[i] = callouts[callouts.length - 1];
            callouts.pop();
            continue;
          }
          const progress = 1 - ft.life / ft.maxLife;
          if (!projectInto(ft.x, ft.y + progress * 1.6, ft.z, pScratchTmp)) continue;
          const halfW = ft.halfW;
          const tx = Math.max(halfW, Math.min(pxW - halfW, Math.round(pScratchTmp.x)));
          const ty = Math.max(44, Math.min(pxH - 86, Math.round(pScratchTmp.y)));
          ctx.fillStyle = '#090d16';
          ctx.fillText(ft.text, tx + 1, ty + 1);
          ctx.fillStyle = ft.color;
          ctx.fillText(ft.text, tx, ty);
        }
      }

      // L1. Floating Animated Reward Text Popups (+50 CR, +150 CR) with Zero GC Churn
      for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
        const ftp = floatingTextPool[i];
        if (!ftp.active) continue;
        ftp.life -= dt;
        if (ftp.life <= 0) {
          ftp.active = false;
          continue;
        }
        const progress = 1 - ftp.life / ftp.maxLife; // 0 to 1
        const riseY = ftp.y + progress * 1.5;
        if (!projectInto(ftp.x, riseY, ftp.z, pScratchTmp)) continue;

        const tx = Math.round(pScratchTmp.x);
        const ty = Math.round(pScratchTmp.y);
        if (tx < -40 || tx > pxW + 40 || ty < -20 || ty > pxH + 20) continue;

        const alpha = Math.max(0, Math.min(1, ftp.life / (ftp.maxLife * 0.4)));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 9px "Chakra Petch", monospace';
        ctx.textAlign = 'center';

        // Drop shadow outline for crisp readability
        ctx.fillStyle = '#090d16';
        ctx.fillText(ftp.text, tx + 1, ty + 1);

        // Golden reward text
        ctx.fillStyle = ftp.color;
        ctx.fillText(ftp.text, tx, ty);
        ctx.restore();
      }

      // L2. Slipstream Wind-Tunnel Ribbons connecting drafted traffic car -> hero car hood!
      if (phase === 'playing' && isHighwayMode && slipstreamCarId !== null && slipstreamCharge > 0.15) {
        let draftTarget: TrafficCarState | undefined;
        for (let i = 0; i < trafficCars.length; i++) {
          if (trafficCars[i].id === slipstreamCarId) {
            draftTarget = trafficCars[i];
            break;
          }
        }
        if (draftTarget && projectInto(driftState.x, driftState.y + 0.6, driftState.z, pScratchTmp)) {
          const ts = sampleTrackAtS(track, draftTarget.s - draftTarget.halfLength, STEP_DIST);
          if (ts) {
            ctx.strokeStyle = `rgba(34, 211, 238, ${(0.35 + slipstreamCharge * 0.45).toFixed(2)})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -(now * 0.06);
            for (const side of [-0.75, 0.75]) {
              if (
                projectInto(
                  ts.x + ts.nx * (draftTarget.lateralOffset + side),
                  ts.y + 0.7,
                  ts.z + ts.nz * (draftTarget.lateralOffset + side),
                  pScratchTmp2
                )
              ) {
                ctx.beginPath();
                ctx.moveTo(Math.round(pScratchTmp2.x), Math.round(pScratchTmp2.y));
                ctx.lineTo(Math.round(pScratchTmp.x + side * 12), Math.round(pScratchTmp.y - 6));
                ctx.stroke();
              }
            }
            ctx.setLineDash([]);
          }
        }
      }

      // M. Radial Vanishing-Point Speed Streaks & Overdrive Perimeter Rush
      const curSpeedNow = Math.hypot(driftState.vx, driftState.vz);
      const isHighSpeedRush = isFever || slipstreamBoostTimer > 0 || curSpeedNow > 22.5;
      if (phase === 'playing' && isHighSpeedRush) {
        const rushColor = isFever
          ? 'rgba(34, 211, 238, 0.62)'
          : slipstreamBoostTimer > 0
          ? 'rgba(56, 189, 248, 0.55)'
          : 'rgba(255, 255, 255, 0.36)';
        ctx.strokeStyle = rushColor;
        ctx.lineWidth = 1;
        const streakCount = isFever ? 14 : slipstreamBoostTimer > 0 ? 10 : 7;
        const vpX = pxW * 0.5;
        const vpY = horizonY * 0.92;
        ctx.beginPath();
        for (let s = 0; s < streakCount; s++) {
          const ang = (s / streakCount) * Math.PI * 2 + (s % 2 === 0 ? 0.14 : -0.14);
          const rStart = 54 + ((now * 0.28 + s * 29) % 48);
          const rEnd = rStart + (isFever ? 24 : 16);
          ctx.moveTo(Math.round(vpX + Math.cos(ang) * rStart), Math.round(vpY + Math.sin(ang) * rStart * 1.15));
          ctx.lineTo(Math.round(vpX + Math.cos(ang) * rEnd), Math.round(vpY + Math.sin(ang) * rEnd * 1.15));
        }
        ctx.stroke();
      }

      // N. Dynamic Speed Vignette Border Glow (cyan in fever, amber/gold in high speed > 180 km/h)
      const currentKmh = curSpeedNow * 7.2;
      const showSpeedVignette = phase === 'playing' && (isFever || currentKmh > 180);
      if (showSpeedVignette) {
        ctx.save();
        const pulse = 0.65 + Math.sin(now * 0.009) * 0.25;
        const isFeverVignette = isFever;
        const edgeColorCenter = isFeverVignette
          ? 'rgba(34, 211, 238, 0)'
          : 'rgba(251, 191, 36, 0)';
        const edgeColorMid = isFeverVignette
          ? `rgba(34, 211, 238, ${(0.14 * pulse).toFixed(3)})`
          : `rgba(251, 191, 36, ${(0.12 * pulse).toFixed(3)})`;
        const edgeColorOuter = isFeverVignette
          ? `rgba(34, 211, 238, ${(0.38 * pulse).toFixed(3)})`
          : `rgba(251, 191, 36, ${(0.32 * pulse).toFixed(3)})`;

        // Soft radial vignette glow from screen center to perimeter
        const cx = pxW * 0.5;
        const cy = pxH * 0.5;
        const rInner = Math.min(pxW, pxH) * 0.38;
        const rOuter = Math.hypot(cx, cy);
        const vigGrad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
        vigGrad.addColorStop(0, edgeColorCenter);
        vigGrad.addColorStop(0.68, edgeColorMid);
        vigGrad.addColorStop(1, edgeColorOuter);
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, pxW, pxH);

        // Neon border edge pulse outline
        ctx.strokeStyle = isFeverVignette
          ? `rgba(34, 211, 238, ${(0.45 * pulse).toFixed(3)})`
          : `rgba(251, 191, 36, ${(0.40 * pulse).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, pxW - 2, pxH - 2);

        // Subtle corner glow accents
        const cornerLen = 14;
        ctx.lineWidth = 3;
        ctx.strokeStyle = isFeverVignette
          ? `rgba(165, 243, 252, ${(0.65 * pulse).toFixed(3)})`
          : `rgba(254, 240, 138, ${(0.60 * pulse).toFixed(3)})`;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(1, cornerLen); ctx.lineTo(1, 1); ctx.lineTo(cornerLen, 1);
        // Top-right
        ctx.moveTo(pxW - cornerLen - 1, 1); ctx.lineTo(pxW - 1, 1); ctx.lineTo(pxW - 1, cornerLen);
        // Bottom-left
        ctx.moveTo(1, pxH - cornerLen - 1); ctx.lineTo(1, pxH - 1); ctx.lineTo(cornerLen, pxH - 1);
        // Bottom-right
        ctx.moveTo(pxW - cornerLen - 1, pxH - 1); ctx.lineTo(pxW - 1, pxH - 1); ctx.lineTo(pxW - 1, pxH - 1 - cornerLen);
        ctx.stroke();

        ctx.restore();
      }

      // O. Impact & Overdrive Screen Flash Overlay
      if (screenFlashAlpha > 0.01) {
        ctx.globalAlpha = Math.min(0.85, screenFlashAlpha);
        ctx.fillStyle = screenFlashColor;
        ctx.fillRect(0, 0, pxW, pxH);
        ctx.globalAlpha = 1.0;
      }

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      soundFX.stopEngineSound();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full block select-none touch-none"
      style={{ imageRendering: 'pixelated' }}
      data-testid="drift-2d-canvas"
    />
  );
});
