/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import {
  CAR_ROSTER,
  CarCustomization,
  CarSpec,
  CarUpgradeLevels,
  DiagonalDirection,
  DriftPhysicsState,
  GameModeId,
  HIGHWAY_LANE_OFFSET,
  HIGHWAY_ROAD_WIDTH,
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
  sampleSCurveSurface,
  stepDriftPhysics,
  stepHighwayPhysics,
  stepTrafficCars,
  triggerTrafficFlashYield,
  compactInPlace,
  sampleTerrainElevation,
} from './rules';
import {
  CarDamageState,
  CarPartId,
  applyImpactToCarDamage,
  computeDamagedStats,
  createMintDamageState,
  evaluateSpeedGatedImpact,
  getCarOverallIntegrity,
  getDamageVisualCacheKey,
  isCarTotaled,
  normalizeCarDamageState,
} from './damage';
import {
  CrashBody3D,
  createCrashBody3D,
  evaluateGuardrailImpact,
  resolveHighwayTrafficSolidPass,
  resolveSolidGuardrailContact,
  resolveTrafficCollisionImpulse,
  resolveTrafficInterCarSpacing,
  stepCrashBody3D,
  stepTrafficCrashBody,
} from './crashPhysics';
import {
  GhostFrame,
  GhostRun,
  generateDevRivalGhost,
  loadBestGhostRun,
  sampleGhostPosition,
  saveBestGhostRun,
} from './ghost';
import {
  HERO_SPRITE_GROUND_V,
  TRAFFIC_SPRITE_GROUND_V,
  getHeroGroundedShadowY,
  getSpriteGroundCenterY,
  getTrafficGroundedShadowY,
} from './grounding';
import { getPixelCarCanvas, getPixelCarTireAnchors, getTrafficVehicleCanvas } from './pixelSprites';
import {
  Project3DIntoFn,
  Projected3D,
  RoadSlice3D,
  WorldProp3D,
  computeDistanceFogAlpha,
  renderAdventureProp3D,
  renderAdventureRoadSlice3D,
  renderAdventureTerrainMesh3D,
  renderBackgroundVista3D,
  renderBridgeTrussArch3D,
  renderCaveTunnelSegment3D,
  renderFinishGate3D,
  renderMountainProp3D,
  renderMountainRoadSlice3D,
  renderMountainTerrainMesh3D,
  renderRealisticRoadsideLandmarks3D,
  renderReflectorBollard3D,
  renderTerrainMesh3D,
  renderWorldObject3D,
} from './world3d';
import {
  applyAdventureElevationProfile,
  resolveAdventureZone,
  sampleAdventureTerrainElevation,
} from './adventure';
import {
  MountainPhysicsState,
  computeMountainCameraTarget,
  createInitialMountainState,
  extendMountainTrack,
  generateMountainTrack,
  sampleMountainSurface,
  sampleMountainTerrainElevation,
  stepMountainPhysics,
} from './mountain';
import {
  computeHeadlightSliceIllumination,
  getHeadlightRgba,
  resolveHeadlightLighting,
} from './headlights';
import type { CampaignLevel } from './levels';
import { soundFX, triggerHaptic } from './audio';
import { MissionType } from './missions';
import {
  ParkedObstacleCar,
  ParkingGear,
  ParkingPhysicsState,
  ParkingProximity,
  ParkingStageSpec,
  createInitialParkingState,
  createParkingStages,
  evaluateParkingBayStatus,
  evaluateParkingProximity,
  stepParkingObstacles,
  stepParkingPhysics,
} from './parking';
import {
  renderParkingObstacleProps3D,
  renderParkingPlazaGround3D,
} from './parkingRender';
import {
  ANIME_CLOUD_COUNT,
  SkyAtmosphereConfig,
  SkyThemeId,
  renderAnimeCloudSprite,
  renderCelestialSprite,
  renderDynamicSkyAtmosphere,
  resolveSkyAtmosphere,
} from './skyArt';
import {
  clampSwipeAnchor,
  computeSwipeSteerDelta,
  resolveCombinedSteering,
  resolveDrivingPedals,
} from './controls';
import { createRealisticWorldWebGL } from './realisticWorldWebGL';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export interface ParkingTelemetry {
  stageNum: number;
  totalStages: number;
  stageTitle: string;
  subtitle: string;
  instruction: string;
  maneuverType: string;
  gear: ParkingGear;
  distM: number;
  angleErrDeg: number;
  hits: number;
  maxHits: number;
  lockProgress: number;
  isInsideBox: boolean;
  isAligned: boolean;
  gatesCleared: number;
  gatesTotal: number;
  proximity: ParkingProximity;
  carX: number;
  carZ: number;
  carHeading: number;
  steerAngle: number;
  bayX: number;
  bayZ: number;
  bayHeading: number;
  bayW: number;
  bayL: number;
  nearbyCars: { x: number; z: number; heading: number; hw: number; hl: number }[];
  nearbyCones: { x: number; z: number; knocked: boolean }[];
  nearbyBarriers: { x: number; z: number; hw: number; hl: number; heading: number }[];
}

export interface MountainTelemetry {
  jumpsCleared: number;
  bestAirTimeSec: number;
  currentPeakNum: number;
  currentSlopePct: number;
  isAirborne: boolean;
  airTimeSec: number;
}

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
  parking?: ParkingTelemetry;
  mountain?: MountainTelemetry;
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
  activeLevel?: CampaignLevel | null;
  isModalOpen?: boolean;
  steerHold?: number; // -1 left, 0 neutral, +1 right from UI buttons or steering wheel
  pedalGas?: boolean;
  pedalBrake?: boolean;
  pedalHandbrake?: boolean;
  parkingGear?: ParkingGear;
  onParkingGearChange?: (gear: ParkingGear) => void;
  onMissionEvent?: (event: Partial<Record<MissionType, number>>) => void;
  flipTriggerCount: number;
  boostTriggerCount: number;
  restartTriggerCount: number;
  flashTriggerCount?: number;
  hornTriggerCount?: number;
  headlightsOn?: boolean;
  screenShakeIntensity?: number; // 0.0 (no shake, accessibility safe) to 1.0 (default 1.0)
  screenShakeMultiplier?: number;
  highFpsMode?: boolean;
  controlScheme?: 'classic' | 'wheel' | 'swipe'; // default 'classic'
  carDamage?: CarDamageState;
  recentRunRanks?: readonly string[];
  onCarDamageChange?: (nextDamage: CarDamageState) => void;
  onTelemetryUpdate: (telemetry: LiveTelemetry) => void;
  onGameOver: (finalStats: {
    score: number;
    distance: number;
    maxCombo: number;
    coinsCollected: number;
    overtakes?: number;
    nearMisses?: number;
    jumpsCleared?: number;
    bestAirTimeSec?: number;
    crashReason?: string;
    isVictory?: boolean;
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
  tint: 'white' | 'cyan' | 'dust' | 'dirt' | 'steam' | 'dark' | 'pink' | 'aqua' | 'warm';
  overCar?: boolean;
}

interface DetachedPartDebris {
  active: boolean;
  partId: CarPartId | 'wheel';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vRot: number;
  floorY: number;
  color: string;
  accentColor: string;
  life: number;
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
  activeLevel = null,
  isModalOpen = false,
  steerHold = 0,
  pedalGas = false,
  pedalBrake = false,
  pedalHandbrake = false,
  parkingGear = 'D',
  onParkingGearChange,
  onMissionEvent,
  flipTriggerCount,
  boostTriggerCount,
  restartTriggerCount,
  flashTriggerCount = 0,
  hornTriggerCount = 0,
  headlightsOn = true,
  screenShakeIntensity,
  screenShakeMultiplier = 1.0,
  highFpsMode = true,
  controlScheme = 'classic',
  carDamage,
  recentRunRanks = [],
  onCarDamageChange,
  onTelemetryUpdate,
  onGameOver,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglMountRef = useRef<HTMLDivElement | null>(null);

  const phaseRef = useRef<GamePhase>(gamePhase);
  phaseRef.current = gamePhase;

  const effectiveShake = screenShakeIntensity !== undefined ? screenShakeIntensity : screenShakeMultiplier;
  const shakeMultiplierRef = useRef<number>(effectiveShake);
  shakeMultiplierRef.current = effectiveShake;

  const highFpsRef = useRef<boolean>(highFpsMode);
  highFpsRef.current = highFpsMode;

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

  const levelRef = useRef<CampaignLevel | null>(activeLevel);
  levelRef.current = activeLevel;

  const isModalOpenRef = useRef<boolean>(isModalOpen);
  isModalOpenRef.current = isModalOpen;

  const steerHoldRef = useRef<number>(steerHold);
  steerHoldRef.current = steerHold;

  const pedalGasRef = useRef<boolean>(pedalGas);
  pedalGasRef.current = pedalGas;

  const pedalBrakeRef = useRef<boolean>(pedalBrake);
  pedalBrakeRef.current = pedalBrake;

  const pedalHandbrakeRef = useRef<boolean>(pedalHandbrake);
  pedalHandbrakeRef.current = pedalHandbrake;

  const parkingGearRef = useRef<ParkingGear>(parkingGear);
  parkingGearRef.current = parkingGear;

  const onParkingGearChangeRef = useRef(onParkingGearChange);
  onParkingGearChangeRef.current = onParkingGearChange;

  const onMissionEventRef = useRef(onMissionEvent);
  onMissionEventRef.current = onMissionEvent;

  const onTelemetryRef = useRef(onTelemetryUpdate);
  onTelemetryRef.current = onTelemetryUpdate;

  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const carDamageRef = useRef<CarDamageState>(carDamage || createMintDamageState());
  carDamageRef.current = carDamage || createMintDamageState();

  const recentRunRanksRef = useRef<readonly string[]>(recentRunRanks);
  recentRunRanksRef.current = recentRunRanks;

  const onCarDamageChangeRef = useRef(onCarDamageChange);
  onCarDamageChangeRef.current = onCarDamageChange;

  const pendingFlipRef = useRef(false);
  const pendingBoostRef = useRef(false);
  const pendingResetRef = useRef(false);
  const pendingFlashRef = useRef(false);
  const pendingHornRef = useRef(false);
  const headlightsOnRef = useRef<boolean>(headlightsOn);
  headlightsOnRef.current = headlightsOn;

  const prevGameMode = useRef(gameMode);
  if (gameMode !== prevGameMode.current) {
    prevGameMode.current = gameMode;
    pendingResetRef.current = true;
  }

  const prevLevelIdRef = useRef<string | null>(activeLevel?.id ?? null);
  if ((activeLevel?.id ?? null) !== prevLevelIdRef.current) {
    prevLevelIdRef.current = activeLevel?.id ?? null;
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
    const rawCtx = displayCanvas.getContext('2d', { alpha: true });
    if (!rawCtx) return;
    const ctx: CanvasRenderingContext2D = rawCtx;

    const webglWorld = webglMountRef.current
      ? createRealisticWorldWebGL(webglMountRef.current)
      : null;
    const isSoftwareGl = Boolean(webglWorld?.isSoftwareGl);

    // Offscreen cached biome layers (fallback when WebGL is inactive or inside subterranean caves)
    const horizonCanvas = document.createElement('canvas');
    const horizonCtx = horizonCanvas.getContext('2d');
    const celestialCanvas = document.createElement('canvas');
    const cloudCanvases = Array.from({ length: ANIME_CLOUD_COUNT }, () =>
      document.createElement('canvas')
    );

    // Pre-baked offscreen sprite caches to eliminate per-frame CanvasGradient allocations in hot loops
    const goldCoinSprite = document.createElement('canvas');
    goldCoinSprite.width = 64;
    goldCoinSprite.height = 64;
    {
      const gctx = goldCoinSprite.getContext('2d');
      if (gctx) {
        const g = gctx.createRadialGradient(24, 23, 3, 32, 32, 28);
        g.addColorStop(0, '#fef9c3');
        g.addColorStop(0.55, '#facc15');
        g.addColorStop(1, '#b45309');
        gctx.fillStyle = g;
        gctx.beginPath();
        gctx.arc(32, 32, 28, 0, Math.PI * 2);
        gctx.fill();
        gctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
        gctx.lineWidth = 3.2;
        gctx.stroke();
        gctx.strokeStyle = 'rgba(146, 64, 14, 0.65)';
        gctx.lineWidth = 2.4;
        gctx.beginPath();
        gctx.arc(32, 32, 16, 0, Math.PI * 2);
        gctx.stroke();
      }
    }

    const nitroGemSprite = document.createElement('canvas');
    nitroGemSprite.width = 72;
    nitroGemSprite.height = 72;
    {
      const nctx = nitroGemSprite.getContext('2d');
      if (nctx) {
        nctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
        nctx.beginPath();
        nctx.arc(36, 36, 33, 0, Math.PI * 2);
        nctx.fill();
        const g = nctx.createLinearGradient(13, 13, 59, 59);
        g.addColorStop(0, '#e0f2fe');
        g.addColorStop(0.45, '#22d3ee');
        g.addColorStop(1, '#0284c7');
        nctx.fillStyle = g;
        nctx.beginPath();
        nctx.moveTo(36, 13);
        nctx.lineTo(55, 36);
        nctx.lineTo(36, 59);
        nctx.lineTo(17, 36);
        nctx.closePath();
        nctx.fill();
        nctx.strokeStyle = 'rgba(224, 242, 254, 0.92)';
        nctx.lineWidth = 2.2;
        nctx.stroke();
        nctx.fillStyle = '#ffffff';
        nctx.beginPath();
        nctx.arc(32.5, 30, 3.8, 0, Math.PI * 2);
        nctx.fill();
      }
    }

    const canisterBodySprite = document.createElement('canvas');
    canisterBodySprite.width = 32;
    canisterBodySprite.height = 32;
    {
      const cctx = canisterBodySprite.getContext('2d');
      if (cctx) {
        const g = cctx.createLinearGradient(0, 0, 32, 0);
        g.addColorStop(0, '#0284c7');
        g.addColorStop(0.35, '#38bdf8');
        g.addColorStop(0.5, '#e0f2fe');
        g.addColorStop(0.8, '#00f0ff');
        g.addColorStop(1, '#0369a1');
        cctx.fillStyle = g;
        cctx.fillRect(0, 0, 32, 32);
      }
    }

    const wispSpriteCache = new Map<string, HTMLCanvasElement>();
    const getWispSprite = (rgb: string): HTMLCanvasElement => {
      let c = wispSpriteCache.get(rgb);
      if (c) return c;
      c = document.createElement('canvas');
      c.width = 128;
      c.height = 32;
      const wctx = c.getContext('2d');
      if (wctx) {
        wctx.save();
        wctx.translate(64, 16);
        wctx.scale(1, 0.25);
        const g = wctx.createRadialGradient(0, 0, 2, 0, 0, 62);
        g.addColorStop(0, `rgba(${rgb}, 0.55)`);
        g.addColorStop(0.55, `rgba(${rgb}, 0.18)`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        wctx.fillStyle = g;
        wctx.beginPath();
        wctx.arc(0, 0, 62, 0, Math.PI * 2);
        wctx.fill();
        wctx.restore();
      }
      wispSpriteCache.set(rgb, c);
      return c;
    };

    const bloomSpriteCache = new Map<string, HTMLCanvasElement>();
    const getBloomSprite = (beamHex: string, isHigh: boolean): HTMLCanvasElement => {
      const k = `${beamHex}:${isHigh ? 1 : 0}`;
      let c = bloomSpriteCache.get(k);
      if (c) return c;
      c = document.createElement('canvas');
      c.width = 96;
      c.height = 96;
      const bctx = c.getContext('2d');
      if (bctx) {
        const g = bctx.createRadialGradient(48, 48, 0, 48, 48, 46);
        g.addColorStop(0, getHeadlightRgba('#ffffff', isHigh ? 0.72 : 0.46));
        g.addColorStop(0.45, getHeadlightRgba(beamHex, 0.24));
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        bctx.fillStyle = g;
        bctx.fillRect(0, 0, 96, 96);
      }
      bloomSpriteCache.set(k, c);
      return c;
    };

    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    let pxH = isSoftwareGl
      ? Math.min(580, Math.max(480, viewH))
      : Math.min(920, Math.max(580, Math.round(viewH * Math.min(window.devicePixelRatio || 1, 1.5))));
    let HD_UI_SCALE = pxH / 340;
    let pxW = Math.max(320, Math.round(pxH * (viewW / Math.max(1, viewH))));
    let cachedSkyGrad: CanvasGradient | null = null;
    let cachedMeadowGrad: CanvasGradient | null = null;
    let cachedHorizonMistGrad: CanvasGradient | null = null;
    let cachedFeverVigGrad: CanvasGradient | null = null;
    let cachedSpeedVigGrad: CanvasGradient | null = null;
    let cachedVigDimKey = '';
    let cachedSkyKey: string | null = null;
    let cachedHorizonY = Math.round(pxH * 0.35);

    const ensureBiomeLayers = (biome: RoadBiomeConfig, sky: SkyAtmosphereConfig) => {
      const nextSkyKey = `${biome.id}:${sky.id}:${pxW}x${pxH}`;
      if (cachedSkyKey === nextSkyKey && cachedSkyGrad && cachedMeadowGrad && cachedHorizonMistGrad) return;
      cachedSkyKey = nextSkyKey;
      cachedSkyGrad = ctx.createLinearGradient(0, 0, 0, cachedHorizonY + Math.round(14 * HD_UI_SCALE));
      cachedSkyGrad.addColorStop(0.0, sky.skyStops[0]);
      cachedSkyGrad.addColorStop(0.55, sky.skyStops[1]);
      cachedSkyGrad.addColorStop(1.0, sky.skyStops[2]);

      cachedMeadowGrad = ctx.createLinearGradient(0, cachedHorizonY, 0, pxH);
      cachedMeadowGrad.addColorStop(0.0, biome.valleyStops[0]);
      cachedMeadowGrad.addColorStop(0.35, biome.valleyStops[1]);
      cachedMeadowGrad.addColorStop(1.0, biome.valleyStops[2]);

      cachedHorizonMistGrad = ctx.createLinearGradient(
        0,
        Math.max(0, cachedHorizonY - Math.round(6 * HD_UI_SCALE)),
        0,
        cachedHorizonY + Math.round(22 * HD_UI_SCALE)
      );
      cachedHorizonMistGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
      cachedHorizonMistGrad.addColorStop(0.35, sky.horizonGlowColor);
      cachedHorizonMistGrad.addColorStop(0.68, biome.valleyStops[0]);
      cachedHorizonMistGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      // Pre-render sculpted Shinkai-style anime cloud sprites and celestial Sun/Moon disc offscreen
      const sunRightBias = sky.celestialXRatio >= 0.5;
      for (let i = 0; i < ANIME_CLOUD_COUNT; i++) {
        renderAnimeCloudSprite(cloudCanvases[i], i, sky.clouds, sunRightBias);
      }
      renderCelestialSprite(celestialCanvas, sky);

      // Pre-render multi-layer realistic skyline / canyon mesas / alpine peaks onto horizonCanvas at HD resolution
      const logPxW = pxW / HD_UI_SCALE;
      const logHorizonY = cachedHorizonY / HD_UI_SCALE;
      const overscan = 160;
      const hw = logPxW + overscan * 2;
      const hh = logHorizonY + 14;
      horizonCanvas.width = Math.round(hw * HD_UI_SCALE);
      horizonCanvas.height = Math.round(hh * HD_UI_SCALE);
      if (horizonCtx) {
        horizonCtx.save();
        horizonCtx.clearRect(0, 0, horizonCanvas.width, horizonCanvas.height);
        horizonCtx.scale(HD_UI_SCALE, HD_UI_SCALE);
        if (biome.propStyle === 'tower') {
          const farTower = sky.id === 'red_moon' ? '#2c0a18' : sky.isNight ? biome.mtnFar : '#475569';
          const midTower = sky.id === 'red_moon' ? '#1f0710' : sky.isNight ? '#1e293b' : '#334155';
          const nearTower = sky.id === 'red_moon' ? '#120309' : sky.isNight ? biome.mtnNear : '#1e293b';

          // Depth layer 1: Distant hazy skyline towers
          horizonCtx.globalAlpha = 0.55;
          let fx = 0;
          let fi = 0;
          const farW = [22, 16, 26, 18, 24, 20, 28, 16];
          const farH = [38, 28, 50, 32, 44, 30, 48, 26];
          while (fx < hw) {
            const bw = farW[fi % farW.length];
            const bh = farH[fi % farH.length];
            const by = logHorizonY - bh + 8;
            horizonCtx.fillStyle = farTower;
            horizonCtx.fillRect(fx, by, bw - 2, bh + 6);
            if (fi % 3 === 0) {
              horizonCtx.fillRect(fx + (bw - 4) * 0.5, by - 8, 2, 8);
            }
            fx += bw - 4;
            fi++;
          }
          horizonCtx.globalAlpha = 1.0;

          // Subtle suspension bridge silhouette across the bay
          const brX = overscan + logPxW * 0.66;
          const brTopY = logHorizonY * 0.36;
          horizonCtx.strokeStyle = midTower;
          horizonCtx.lineWidth = 2;
          horizonCtx.beginPath();
          horizonCtx.moveTo(brX - 38, logHorizonY + 4);
          horizonCtx.lineTo(brX - 38, brTopY);
          horizonCtx.moveTo(brX + 38, logHorizonY + 4);
          horizonCtx.lineTo(brX + 38, brTopY);
          horizonCtx.moveTo(brX - 75, logHorizonY - 3);
          horizonCtx.quadraticCurveTo(brX - 55, brTopY + 12, brX - 38, brTopY);
          horizonCtx.quadraticCurveTo(brX, brTopY + 18, brX + 38, brTopY);
          horizonCtx.quadraticCurveTo(brX + 55, brTopY + 12, brX + 75, logHorizonY - 3);
          horizonCtx.stroke();

          // Depth layer 2: Crisp waterfront architectural high-rises with stepped tops & lit interior windows
          const bWidths = [18, 24, 16, 28, 20, 22, 16, 26, 18, 22];
          const bHeights = [22, 36, 18, 42, 26, 32, 20, 38, 24, 30];
          let bx = 0;
          let b = 0;
          while (bx < hw) {
            const bw = bWidths[b % bWidths.length];
            const bh = bHeights[b % bHeights.length];
            const by = logHorizonY - bh + 8;
            horizonCtx.fillStyle = b % 2 === 0 ? midTower : nearTower;
            horizonCtx.fillRect(bx, by, bw - 2, bh + 6);
            if (b % 4 === 1) {
              horizonCtx.fillRect(bx + 3, by - 4, bw - 8, 4);
            }
            for (let wy = by + 4; wy < logHorizonY + 2; wy += 5) {
              for (let wx = bx + 3; wx < bx + bw - 5; wx += 4) {
                if ((Math.floor(wx) + Math.floor(wy) + b) % 4 !== 0) {
                  horizonCtx.fillStyle =
                    sky.id === 'red_moon'
                      ? (Math.floor(wx) + b) % 3 === 0
                        ? '#fda4af'
                        : '#fbbf24'
                      : (Math.floor(wx) + b) % 5 === 0
                      ? '#bae6fd'
                      : '#fef08a';
                  horizonCtx.fillRect(wx, wy, 2, 2);
                }
              }
            }
            bx += bw;
            b++;
          }
        } else if (biome.propStyle === 'cactus') {
          // Depth layer 1: Distant atmospheric haze canyon range
          horizonCtx.globalAlpha = 0.65;
          horizonCtx.fillStyle = sky.mtnFar;
          horizonCtx.beginPath();
          horizonCtx.moveTo(0, hh);
          horizonCtx.lineTo(0, logHorizonY * 0.72);
          horizonCtx.lineTo(overscan + logPxW * 0.10, logHorizonY * 0.54);
          horizonCtx.lineTo(overscan + logPxW * 0.28, logHorizonY * 0.54);
          horizonCtx.lineTo(overscan + logPxW * 0.38, logHorizonY * 0.78);
          horizonCtx.lineTo(overscan + logPxW * 0.58, logHorizonY * 0.76);
          horizonCtx.lineTo(overscan + logPxW * 0.70, logHorizonY * 0.48);
          horizonCtx.lineTo(overscan + logPxW * 0.92, logHorizonY * 0.48);
          horizonCtx.lineTo(hw, logHorizonY * 0.72);
          horizonCtx.lineTo(hw, hh);
          horizonCtx.closePath();
          horizonCtx.fill();
          horizonCtx.globalAlpha = 1.0;

          // Depth layer 2: Sculpted sandstone mesas & flat-top Monument Valley buttes
          horizonCtx.fillStyle = sky.mtnNear;
          horizonCtx.beginPath();
          horizonCtx.moveTo(0, hh);
          horizonCtx.lineTo(0, logHorizonY * 0.84);
          horizonCtx.lineTo(overscan + logPxW * 0.12, logHorizonY * 0.68);
          horizonCtx.lineTo(overscan + logPxW * 0.23, logHorizonY * 0.68);
          horizonCtx.lineTo(overscan + logPxW * 0.34, logHorizonY * 0.88);
          horizonCtx.lineTo(overscan + logPxW * 0.48, logHorizonY * 0.76);
          horizonCtx.lineTo(overscan + logPxW * 0.56, logHorizonY * 0.76);
          horizonCtx.lineTo(overscan + logPxW * 0.64, logHorizonY * 0.88);
          horizonCtx.lineTo(overscan + logPxW * 0.86, logHorizonY * 0.62);
          horizonCtx.lineTo(overscan + logPxW * 1.02, logHorizonY * 0.62);
          horizonCtx.lineTo(hw, logHorizonY * 0.80);
          horizonCtx.lineTo(hw, hh);
          horizonCtx.closePath();
          horizonCtx.fill();

          // Sedimentary rim highlight line along near mesas
          horizonCtx.fillStyle = sky.isNight ? 'rgba(148, 163, 184, 0.25)' : 'rgba(253, 186, 116, 0.42)';
          horizonCtx.fillRect(overscan + logPxW * 0.12, logHorizonY * 0.68, logPxW * 0.11, 2);
          horizonCtx.fillRect(overscan + logPxW * 0.86, logHorizonY * 0.62, logPxW * 0.16, 2);
        } else {
          // Depth layer 1: Distant hazy mountain range
          horizonCtx.globalAlpha = 0.68;
          horizonCtx.fillStyle = sky.mtnFar;
          horizonCtx.beginPath();
          horizonCtx.moveTo(0, hh);
          const ridgePts: [number, number][] = [
            [-0.45, 0.74],
            [-0.12, 0.58],
            [0.08, 0.56],
            [0.24, 0.76],
            [0.44, 0.84],
            [0.64, 0.74],
            [0.84, 0.48],
            [1.06, 0.72],
            [1.45, 0.74],
          ];
          for (let r = 0; r < ridgePts.length; r++) {
            horizonCtx.lineTo(
              overscan + ridgePts[r][0] * logPxW,
              logHorizonY * ridgePts[r][1]
            );
          }
          horizonCtx.lineTo(hw, hh);
          horizonCtx.closePath();
          horizonCtx.fill();
          horizonCtx.globalAlpha = 1.0;

          // Snowcaps on highest alpine / Fuji summits
          const snowCol =
            sky.id === 'red_moon'
              ? '#fda4af'
              : sky.id === 'golden_sunset'
              ? '#fed7aa'
              : sky.id === 'aurora_night'
              ? '#cffafe'
              : '#f8fafc';
          const peakX = overscan + 0.84 * logPxW;
          const peakY = logHorizonY * 0.48;
          horizonCtx.fillStyle = snowCol;
          horizonCtx.beginPath();
          horizonCtx.moveTo(peakX, peakY);
          horizonCtx.lineTo(peakX + 16, peakY + 13);
          horizonCtx.lineTo(peakX + 4, peakY + 10);
          horizonCtx.lineTo(peakX - 4, peakY + 14);
          horizonCtx.lineTo(peakX - 16, peakY + 12);
          horizonCtx.closePath();
          horizonCtx.fill();

          if (biome.id !== 'sakura') {
            const leftPeakX = overscan + 0.08 * logPxW;
            const leftPeakY = logHorizonY * 0.56;
            horizonCtx.beginPath();
            horizonCtx.moveTo(leftPeakX, leftPeakY);
            horizonCtx.lineTo(leftPeakX + 12, leftPeakY + 10);
            horizonCtx.lineTo(leftPeakX - 12, leftPeakY + 10);
            horizonCtx.closePath();
            horizonCtx.fill();
          }

          // Depth layer 2: Grounded mid-range foothills
          horizonCtx.fillStyle = sky.mtnNear;
          horizonCtx.beginPath();
          horizonCtx.moveTo(0, hh);
          horizonCtx.lineTo(0, logHorizonY * 0.84);
          horizonCtx.lineTo(overscan + logPxW * 0.18, logHorizonY * 0.66);
          horizonCtx.lineTo(overscan + logPxW * 0.36, logHorizonY * 0.88);
          horizonCtx.lineTo(overscan + logPxW * 0.54, logHorizonY * 0.82);
          horizonCtx.lineTo(overscan + logPxW * 0.70, logHorizonY * 0.89);
          horizonCtx.lineTo(overscan + logPxW * 0.94, logHorizonY * 0.64);
          horizonCtx.lineTo(hw, logHorizonY * 0.82);
          horizonCtx.lineTo(hw, hh);
          horizonCtx.closePath();
          horizonCtx.fill();
        }
        horizonCtx.restore();
      }
    };

    const resize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      pxH = isSoftwareGl
        ? Math.min(680, Math.max(520, viewH))
        : Math.min(920, Math.max(580, Math.round(viewH * Math.min(window.devicePixelRatio || 1, 1.5))));
      HD_UI_SCALE = pxH / 340;
      pxW = Math.max(320, Math.round(pxH * (viewW / Math.max(1, viewH))));
      displayCanvas.width = pxW;
      displayCanvas.height = pxH;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      webglWorld?.resize(viewW, viewH);

      cachedHorizonY = Math.round(pxH * 0.35);
      cachedSkyGrad = null;
      cachedMeadowGrad = null;
      cachedHorizonMistGrad = null;
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
    let heroRollRad = 0;
    let heroPitchY = 0;
    let heroAirPitchRad = 0;
    let heroPitchRad = 0.37;
    let fCamPitchSlope = 0.068;
    let carVy = 0;
    let carAirborne = false;
    let carAirTime = 0;
    let carGroundY = 0;
    let prevRoadSlope = 0;
    let activeRoadSlope = 0;
    let suspensionY = 0;
    let suspensionVel = 0;
    let levelFinished = false;

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
    let visualFrontSteer = 0;

    // Breach / Fall-off & Traffic Crash rigid-body state
    let isFalling = false;
    let fallTimer = 0;
    let fallVelX = 0;
    let fallVelY = 0;
    let fallVelZ = 0;
    let fallRotation = 0;
    let crashRoll = 0;
    let breachedSliceIdx = -1;
    let breachedSide = 1;
    let groundImpacted = false;
    let groundRestTimer = 0;
    let crashGroundY = VALLEY_FLOOR_Y;
    let crashBody: CrashBody3D = createCrashBody3D();
    let isOffRoad = false;
    let offRoadTreeHitCooldown = 0;
    let smoothSteerInput = 0;

    // Mountain Drive physics & stunt state
    let mountainState: MountainPhysicsState | null = null;

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

    // Precision Parking & Gymkhana Mode State
    let parkingStages: ParkingStageSpec[] = [];
    let parkingStageIdx = 0;
    let parkingState: ParkingPhysicsState | null = null;
    let parkingHits = 0;
    let parkingStageHits = 0;
    const PARKING_MAX_HITS = 3;
    let parkingHitCooldown = 0;
    let parkingLockTimer = 0;
    let parkingClearDelay = 0;
    let parkingStageClearedBanner = false;
    let parkingReverseHoldTimer = 0;
    let parkingSonarTimer = 0;
    let parkingGearOverride: ParkingGear | null = null;
    let parkingLastSyncedPropGear: ParkingGear = parkingGearRef.current;

    // Juice & Biome Transition
    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let hudEmitTimer = 0;
    let screenFlashAlpha = 0;
    let screenFlashColor = '#ffffff';
    let highBeamTimer = 0;
    let lastBiomeId: RoadBiomeId = resolveRoadBiome(roadModeRef.current, 0).id;
    let lastAdventureChapterId = resolveAdventureZone(0).chapter.id;
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

    const MAX_DETACHED_PARTS = 12;
    const detachedPartPool: DetachedPartDebris[] = Array.from({ length: MAX_DETACHED_PARTS }, () => ({
      active: false,
      partId: 'front_bumper',
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rot: 0,
      vRot: 0,
      floorY: VALLEY_FLOOR_Y,
      color: '#ef4444',
      accentColor: '#38bdf8',
      life: 0,
    }));

    const spawnDetachedPart = (
      partId: CarPartId | 'wheel',
      x: number,
      y: number,
      z: number,
      vxBase: number,
      vzBase: number,
      floorY: number,
      color: string,
      accentColor: string,
      sideBias = 1
    ) => {
      let slot = detachedPartPool.find((p) => !p.active);
      if (!slot) slot = detachedPartPool[0];
      const angleSpread = (Math.random() - 0.5) * 2.2;
      const sideImpulse =
        partId === 'left_door'
          ? -4.8
          : partId === 'right_door'
          ? 4.8
          : partId === 'wheel'
          ? sideBias * (4.2 + Math.random() * 4.5)
          : sideBias * (2.2 + Math.random() * 4.5);
      slot.active = true;
      slot.partId = partId;
      slot.x = x + (Math.random() - 0.5) * 0.5;
      slot.y = y + 0.55;
      slot.z = z + (Math.random() - 0.5) * 0.5;
      slot.vx = vxBase * 0.55 + sideImpulse + Math.cos(angleSpread) * 2.5;
      slot.vy = (partId === 'wheel' ? 6.2 : 5.4) + Math.random() * 5.2;
      slot.vz = vzBase * 0.55 + (partId === 'front_bumper' ? -3.0 : partId === 'rear_bumper' || partId === 'spoiler' ? 2.5 : (Math.random() - 0.5) * 3.0);
      slot.rot = (Math.random() - 0.5) * 0.8;
      slot.vRot = (Math.random() > 0.5 ? 1 : -1) * (partId === 'wheel' ? 12 + Math.random() * 8 : 5.5 + Math.random() * 7.5);
      slot.floorY = floorY;
      slot.color = color;
      slot.accentColor = accentColor;
      slot.life = 2.8;
    };

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
      ctx.font = `bold ${Math.round(8 * HD_UI_SCALE)}px "Chakra Petch", monospace`;
      const halfW = Math.ceil(ctx.measureText(text).width * 0.5) + Math.round(4 * HD_UI_SCALE);
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
      trafficRelYaw?: number;
      parked?: ParkedObstacleCar;
      isGhost?: boolean;
      ghostFrame?: GhostFrame;
      ghostColor?: string;
      ghostCarId?: string;
    }[] = Array.from({ length: 48 }, () => ({
      rawZ: 0,
      isHero: false,
      proj: makeEmptyProj(),
      traffic: undefined,
      trafficRelYaw: undefined,
      parked: undefined,
      isGhost: false,
      ghostFrame: undefined,
      ghostColor: undefined,
      ghostCarId: undefined,
    }));
    const MAX_GHOST_RECORD_FRAMES = 6000;
    const recordedGhostFrames: GhostFrame[] = Array.from({ length: MAX_GHOST_RECORD_FRAMES }, () => ({
      timeSec: 0,
      distance: 0,
      lateralOffset: 0,
      angle: 0,
      speedKmh: 0,
    }));
    let recordedGhostFrameCount = 0;
    let ghostRecordTimer = 0;
    let runElapsedSec = 0;
    let activeGhost: GhostRun | null = null;
    let ghostOvertakenTriggered = false;
    let wasGhostAhead = false;
    const ghostSampleScratch: GhostFrame = {
      timeSec: 0,
      distance: 0,
      lateralOffset: 0,
      angle: 0,
      speedKmh: 0,
    };
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
    const startApronPt: SCurvePoint = {
      index: 0,
      x: 0,
      y: 0,
      z: 0,
      heading: -Math.PI / 2,
      tx: 0,
      tz: -1,
      nx: 1,
      nz: 0,
      width: 11,
      bankAngle: 0,
      curvature: 0,
      hasCoin: false,
      coinX: 0,
      coinZ: 0,
      hasBoostPad: false,
      boostX: 0,
      boostZ: 0,
    };

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

    function populateTreesAround(centerZ: number, isAdventure = false, isMountain = false) {
      if (valleyProps.length > 0 && valleyProps[0].z > centerZ + 40) {
        compactInPlace(valleyProps, (p) => p.z <= centerZ + 40);
      }
      if (valleyProps.length === 0) {
        propSpawnCursorZ = centerZ + 22;
      }
      while (propSpawnCursorZ > centerZ - 195) {
        propSpawnCursorZ -=
          isAdventure
            ? 1.85 + Math.random() * 1.35
            : isMountain
            ? 2.35 + Math.random() * 1.85
            : 5.2 + Math.random() * 4.4;
        const anchor = findClosestTrackAnchor(propSpawnCursorZ);
        const side = Math.random() > 0.5 ? 1 : -1;
        const baseX = anchor ? anchor.x : 0;
        const baseZ = anchor ? anchor.z : propSpawnCursorZ;
        const nx = anchor ? anchor.nx : 1;
        const nz = anchor ? anchor.nz : 0;

        if (isMountain) {
          // Near mountain edge: rocks, scrub bushes, and dirt outcrops along shoulder
          const shoulderLat = side * (6.8 + Math.random() * 6.5);
          const nearRoll = Math.random();
          valleyProps.push({
            x: baseX + nx * shoulderLat,
            z: baseZ + nz * shoulderLat,
            lateralOffset: shoulderLat,
            scale: 0.72 + Math.random() * 0.68,
            shade: Math.random(),
            variant: nearRoll < 0.36 ? 2 : nearRoll < 0.7 ? 3 : nearRoll < 0.9 ? 4 : 0,
          });
          if (Math.random() < 0.85) {
            const slopeSide = Math.random() < 0.65 ? -side : side;
            const slopeLat = slopeSide * (14.5 + Math.random() * 28.0);
            const farRoll = Math.random();
            valleyProps.push({
              x: baseX + nx * slopeLat,
              z: baseZ + nz * slopeLat,
              lateralOffset: slopeLat,
              scale: 0.95 + Math.random() * 0.95,
              shade: Math.random(),
              variant: farRoll < 0.55 ? 0 : farRoll < 0.75 ? 2 : farRoll < 0.9 ? 3 : 4,
            });
          }
        } else if (isAdventure) {
          const nearLat = side * (7.6 + Math.random() * 7.6);
          valleyProps.push({
            x: baseX + nx * nearLat,
            z: baseZ + nz * nearLat,
            lateralOffset: nearLat,
            scale: 0.85 + Math.random() * 0.85,
            shade: Math.random(),
            variant: Math.random() < 0.34 ? 2 : Math.floor(Math.random() * 5),
          });
          if (Math.random() < 0.82) {
            const deepSide = Math.random() < 0.7 ? -side : side;
            const deepLat = deepSide * (16.0 + Math.random() * 26.0);
            valleyProps.push({
              x: baseX + nx * deepLat,
              z: baseZ + nz * deepLat,
              lateralOffset: deepLat,
              scale: 1.05 + Math.random() * 0.95,
              shade: Math.random(),
              variant: Math.random() < 0.55 ? 0 : 1 + Math.floor(Math.random() * 3),
            });
          }
        } else {
          const lateralOffset = side * (12.6 + Math.random() * 38);
          valleyProps.push({
            x: baseX + nx * lateralOffset,
            z: baseZ + nz * lateralOffset,
            lateralOffset,
            scale: 0.78 + Math.random() * 0.85,
            shade: Math.random(),
            variant: Math.floor(Math.random() * 3),
          });
        }
      }
    }

    function resetSimulation() {
      const curLevel = levelRef.current;
      seed = curLevel ? curLevel.seed : Math.floor(Math.random() * 1000) + 17;
      const effectiveMode: GameModeId = curLevel ? curLevel.mode : gameModeRef.current;
      const isHighway = effectiveMode === 'highway_traffic';
      const isParking = effectiveMode === 'parking';
      const isMountain = effectiveMode === 'mountain_drive';
      const trackOpts = curLevel
        ? { curveMultiplier: curLevel.curveMultiplier, widthMultiplier: curLevel.widthMultiplier }
        : undefined;

      score = 0;
      distance = 0;
      levelFinished = false;
      heroRollRad = 0;
      heroPitchY = 0;
      heroAirPitchRad = 0;
      heroPitchRad = 0.37;
      fCamPitchSlope = 0.068;
      carVy = 0;
      carAirborne = false;
      carAirTime = 0;
      carGroundY = 0;
      prevRoadSlope = 0;
      activeRoadSlope = 0;
      suspensionY = 0;
      suspensionVel = 0;
      recordedGhostFrameCount = 0;
      ghostRecordTimer = 0;
      runElapsedSec = 0;
      ghostOvertakenTriggered = false;
      wasGhostAhead = false;
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
      nearMissText = curLevel ? `STAGE ${curLevel.number}: ${curLevel.title.toUpperCase()}` : '';
      nearMissTimer = curLevel ? 1.8 : 0;
      activeDir = 'right';
      visualFrontSteer = 0;
      isFalling = false;
      fallTimer = 0;
      fallVelX = 0;
      fallVelY = 0;
      fallVelZ = 0;
      fallRotation = 0;
      crashRoll = 0;
      breachedSliceIdx = -1;
      breachedSide = 1;
      groundImpacted = false;
      groundRestTimer = 0;
      crashGroundY = VALLEY_FLOOR_Y;
      crashBody = createCrashBody3D();
      isOffRoad = false;
      offRoadTreeHitCooldown = 0;
      smoothSteerInput = 0;
      mountainState = null;
      trafficCars = [];
      nextTrafficId = 1;
      trafficSpawnCursor = 62;
      overtakes = 0;
      nearMisses = 0;
      isTrafficCrash = false;
      trafficCrashTimer = 0;
      crashReason = isMountain ? 'Fell Off Mountain Cliff' : 'Guardrail Contact';
      slipstreamCharge = 0;
      slipstreamCarId = null;
      slipstreamBoostTimer = 0;
      overtakeChain = 0;
      overtakeChainTimer = 0;
      nextMilestoneDist = 250;
      lastRankCode = 'D';
      parkingStages = [];
      parkingStageIdx = 0;
      parkingState = null;
      parkingHits = 0;
      parkingStageHits = 0;
      parkingHitCooldown = 0;
      parkingLockTimer = 0;
      parkingClearDelay = 0;
      parkingStageClearedBanner = false;
      parkingReverseHoldTimer = 0;
      parkingSonarTimer = 0;
      parkingGearOverride = null;

      const isAdventureStart = !isHighway && !isParking && !isMountain;
      if (isParking) {
        track = [];
        parkingStages = createParkingStages();
        const st0 = parkingStages[0];
        parkingState = createInitialParkingState(st0);
        parkingLastSyncedPropGear = st0.spawn.gear;
        onParkingGearChangeRef.current?.(st0.spawn.gear);
        driftState = createInitialDriftState(st0.spawn.x, st0.spawn.z, 0, st0.spawn.heading, 0);
        camFocusX = st0.spawn.x * 0.65;
        camFocusY = 0;
        camFocusZ = st0.spawn.z - 6;
        camHeading = -Math.PI / 2;
        visualDriftAngle = 0;
        activeGhost = null;
      } else if (isMountain) {
        track = generateMountainTrack(
          80,
          STEP_DIST,
          seed,
          curLevel ? curLevel.curveMultiplier : 1
        );
        const startPt = track[0];
        const initSpd = carRef.current.baseSpeed * 0.85;
        mountainState = createInitialMountainState(
          startPt.x,
          startPt.z,
          startPt.y,
          startPt.heading,
          initSpd
        );
        driftState = createInitialDriftState(
          startPt.x,
          startPt.z,
          startPt.y,
          startPt.heading,
          initSpd
        );
        carGroundY = startPt.y;
        camFocusX = driftState.x;
        camFocusY = driftState.y;
        camFocusZ = driftState.z;
        camHeading = startPt.heading;
        visualDriftAngle = 0;
        const savedGhost = loadBestGhostRun(effectiveMode);
        activeGhost = savedGhost || generateDevRivalGhost(effectiveMode);
      } else {
        track = isHighway
          ? generateHighwayTrack(75, STEP_DIST, seed, trackOpts)
          : generateSCurveTrack(65, STEP_DIST, seed, trackOpts);
        if (isAdventureStart) {
          applyAdventureElevationProfile(track, STEP_DIST, seed);
        }
        const startPt = track[0];
        const spawnOffset = isHighway ? HIGHWAY_LANE_OFFSET : 0;
        driftState = createInitialDriftState(
          startPt.x + startPt.nx * spawnOffset,
          startPt.z + startPt.nz * spawnOffset,
          startPt.y,
          startPt.heading,
          carRef.current.baseSpeed * 0.78
        );
        carGroundY = startPt.y;

        camFocusX = driftState.x;
        camFocusY = driftState.y;
        camFocusZ = driftState.z;
        camHeading = startPt.heading;
        visualDriftAngle = isHighway ? 0.0 : 0.25;

        const savedGhost = loadBestGhostRun(effectiveMode);
        activeGhost = savedGhost || generateDevRivalGhost(effectiveMode);

        if (isHighway) {
          const baseDiff = curLevel
            ? Math.min(1, Math.max(0, (curLevel.trafficDensity - 0.6) * 0.85))
            : 0;
          const batch = generateTrafficBatch({
            startS: 58,
            endS: 270,
            nextIdStart: nextTrafficId,
            seed,
            existingCars: trafficCars,
            difficultyProgress: baseDiff,
            mode: effectiveMode,
            recentRunRanks: recentRunRanksRef.current,
          });
          trafficCars = batch.cars;
          nextTrafficId = batch.nextId;
          trafficSpawnCursor = 270;
        }
      }

      hitstopTimer = 0;
      cameraTrauma = 0;
      screenFlashAlpha = 0;
      highBeamTimer = 0;
      const startBiome = resolveRoadBiome(curLevel ? curLevel.biome : roadModeRef.current, 0);
      lastBiomeId = startBiome.id;
      const startAdvZone = resolveAdventureZone(0);
      lastAdventureChapterId = startAdvZone.chapter.id;

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
      for (let i = 0; i < MAX_DETACHED_PARTS; i++) {
        detachedPartPool[i].active = false;
      }
      for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
        floatingTextPool[i].active = false;
        floatingTextPool[i].life = 0;
      }
      wasGassing = true;
      prevSpeedKmh = 0;
      turboChirpCooldown = 0;
      valleyProps.length = 0;
      propSpawnCursorZ = driftState.z + 22;
      if (!isParking) {
        populateTreesAround(driftState.z, isAdventureStart, isMountain);
      }

      const pStage = isParking ? parkingStages[0] : null;
      onTelemetryRef.current({
        score: 0,
        distance: 0,
        combo: 1,
        maxCombo: 1,
        coinsRun: 0,
        fever: 0,
        isFever: false,
        speedKmh: isParking ? 0 : Math.round(carRef.current.baseSpeed * 7.2),
        direction: activeDir,
        nearMissText: '',
        isDrifting: false,
        biomeName: isMountain
          ? 'Alpine Peaks'
          : isAdventureStart
          ? startAdvZone.chapter.name
          : startBiome.name,
        overtakes: 0,
        nearMisses: 0,
        mountain:
          isMountain && mountainState
            ? {
                jumpsCleared: 0,
                bestAirTimeSec: 0,
                currentPeakNum: mountainState.currentPeakNum,
                currentSlopePct: mountainState.currentSlopePct,
                isAirborne: false,
                airTimeSec: 0,
              }
            : undefined,
        parking:
          isParking && pStage && parkingState
            ? {
                stageNum: 1,
                totalStages: parkingStages.length,
                stageTitle: pStage.title,
                subtitle: pStage.subtitle,
                instruction: pStage.instruction,
                maneuverType: pStage.maneuverType,
                gear: parkingState.gear,
                distM: evaluateParkingBayStatus(parkingState, pStage).centerDistM,
                angleErrDeg: evaluateParkingBayStatus(parkingState, pStage).headingErrorDeg,
                hits: 0,
                maxHits: PARKING_MAX_HITS,
                lockProgress: 0,
                isInsideBox: false,
                isAligned: false,
                gatesCleared: 0,
                gatesTotal: pStage.slalomGates.length,
                proximity: evaluateParkingProximity(parkingState, pStage),
                carX: parkingState.x,
                carZ: parkingState.z,
                carHeading: parkingState.heading,
                steerAngle: 0,
                bayX: pStage.targetBay.x,
                bayZ: pStage.targetBay.z,
                bayHeading: pStage.targetBay.heading,
                bayW: pStage.targetBay.width,
                bayL: pStage.targetBay.length,
                nearbyCars: pStage.parkedCars.map((c) => ({
                  x: c.x,
                  z: c.z,
                  heading: c.heading,
                  hw: c.halfWidth,
                  hl: c.halfLength,
                })),
                nearbyCones: pStage.cones.map((c) => ({
                  x: c.x,
                  z: c.z,
                  knocked: c.knocked,
                })),
                nearbyBarriers: pStage.barriers.map((b) => ({
                  x: b.x,
                  z: b.z,
                  hw: b.halfW,
                  hl: b.halfL,
                  heading: b.heading,
                })),
              }
            : undefined,
      });
    }

    resetSimulation();

    // 2. Unified Input Hub (Pointer Touch Left/Right + Keyboard Arrows/WASD/Space)
    let keyLeft = false;
    let keyRight = false;
    let keyUp = false;
    let keyDown = false;
    let keyHandbrake = false;
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
          const swipeSteer = computeSwipeSteerDelta(deltaX, 68, 5);
          if (swipeSteer !== 0) {
            totalSteer += swipeSteer;
          } else {
            // Brief tap or finger parked within deadzone: gentle left/right half steering
            totalSteer += curX < window.innerWidth * 0.5 ? -0.82 : 0.82;
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
      // Ignore interactions originating inside HUD buttons, steering wheel, or cockpit dock
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest('[data-hud-btn="true"], [data-cockpit-dock="true"], button, [role="button"], input, select, a')
      ) {
        return;
      }
      // In Wheel mode, keep lower dock margin immune to accidental mis-taps near pedals/wheel
      if (controlSchemeRef.current === 'wheel' && e.clientY > window.innerHeight * 0.72) {
        return;
      }
      pointerStartX.set(e.pointerId, e.clientX);
      pointerCurrentX.set(e.pointerId, e.clientX);
      recalcPointerSteer();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerCurrentX.has(e.pointerId)) return;
      if (controlSchemeRef.current === 'swipe') {
        const prevStart = pointerStartX.get(e.pointerId) ?? e.clientX;
        pointerStartX.set(e.pointerId, clampSwipeAnchor(prevStart, e.clientX, 86));
      }
      pointerCurrentX.set(e.pointerId, e.clientX);
      recalcPointerSteer();
    };

    const onPointerUp = (e: PointerEvent) => {
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
      if (gameModeRef.current === 'parking' && parkingState) {
        if (e.code === 'KeyG' || e.code === 'KeyQ') {
          parkingGearOverride = parkingState.gear === 'R' ? 'D' : 'R';
        } else if (e.code === 'Digit1') {
          parkingGearOverride = 'P';
        } else if (e.code === 'Digit2') {
          parkingGearOverride = 'R';
        } else if (e.code === 'Digit3') {
          parkingGearOverride = 'D';
        }
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
      } else if (rawCamZ < -5.8) {
        return false;
      }

      const camZ = clampMinZ !== undefined && rawCamZ < clampMinZ ? clampMinZ : rawCamZ;
      const camX = dx * fRightX + dz * fRightZ;
      const camY = dy + camZ * fCamPitchSlope;

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
      const denom = Math.min(-0.08, syNorm - fCamPitchSlope);
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
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    // Cached car appearance & stats (recomputed only when car/upgrades/custom/damage refs change)
    let cachedCarObj = carRef.current;
    let cachedUpgradesObj = upgradesRef.current;
    let cachedCustomObj = carCustomRef.current;
    let cachedDamageObj = carDamageRef.current;
    let cachedDamageKey = getDamageVisualCacheKey(cachedDamageObj);
    let activeDamageState: CarDamageState = normalizeCarDamageState(cachedDamageObj);
    let cachedAppearance = resolveCarAppearance(cachedCarObj, cachedCustomObj);
    let cachedStats = computeDamagedStats(
      computeEffectiveCarStats(cachedCarObj, cachedUpgradesObj, cachedCustomObj),
      activeDamageState
    );

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
    let lastHudJumps = -1;
    let lastHudSlope = -999;
    let lastHudAirborne = false;

    // 4. Main Simulation & Pixel-Art Rendering Loop
    let animId = 0;
    let idleTimerId: number | null = null;
    let lastTime = performance.now();
    let pausedFrameDrawn = false;

    const scheduleNextFrame = (delayMs = 0) => {
      if (delayMs > 0) {
        idleTimerId = window.setTimeout(() => {
          idleTimerId = null;
          animId = requestAnimationFrame(loop);
        }, delayMs);
      } else {
        animId = requestAnimationFrame(loop);
      }
    };

    let lastFrameDrawMs = 0;
    let lastRafCallbackMs = 0;
    let avgRafIntervalMs = 16.67;
    let smoothDt = 1 / 60;
    function loop() {
      const now = performance.now();
      const phase = phaseRef.current;
      if (lastRafCallbackMs > 0) {
        const rafGap = now - lastRafCallbackMs;
        if (rafGap > 1 && rafGap < 45) {
          avgRafIntervalMs = avgRafIntervalMs * 0.85 + rafGap * 0.15;
        }
      }
      lastRafCallbackMs = now;
      // Only throttle genuine >95Hz high-refresh displays when High FPS Mode is off; never drop 60Hz VSync jitter frames
      if (
        phase === 'playing' &&
        !highFpsRef.current &&
        avgRafIntervalMs < 11.2 &&
        lastFrameDrawMs > 0 &&
        now - lastFrameDrawMs < 13.5
      ) {
        scheduleNextFrame(0);
        return;
      }
      lastFrameDrawMs = now;
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const clampedDt = Math.min(Math.max(rawDt, 0.001), 0.05);
      smoothDt =
        phase === 'playing' && clampedDt < 0.038
          ? smoothDt * 0.55 + clampedDt * 0.45
          : clampedDt;
      const dt = smoothDt;

      if (phase === 'paused') {
        if (pausedFrameDrawn && !pendingResetRef.current) {
          scheduleNextFrame(180);
          return;
        }
        pausedFrameDrawn = true;
      } else {
        pausedFrameDrawn = false;
      }

      if (isModalOpenRef.current && phase !== 'playing') {
        scheduleNextFrame(180);
        return;
      }
      const currentCar = carRef.current;
      const currentUpgrades = upgradesRef.current;
      const currentCustom = carCustomRef.current;
      const extDamage = carDamageRef.current;
      const extDamageKey = getDamageVisualCacheKey(extDamage);

      if (extDamage !== cachedDamageObj && extDamageKey !== cachedDamageKey) {
        cachedDamageObj = extDamage;
        activeDamageState = normalizeCarDamageState(extDamage);
      }

      const activeDmgKey = getDamageVisualCacheKey(activeDamageState);
      if (
        currentCar !== cachedCarObj ||
        currentUpgrades !== cachedUpgradesObj ||
        currentCustom !== cachedCustomObj ||
        activeDmgKey !== cachedDamageKey
      ) {
        cachedCarObj = currentCar;
        cachedUpgradesObj = currentUpgrades;
        cachedCustomObj = currentCustom;
        cachedDamageKey = activeDmgKey;
        cachedAppearance = resolveCarAppearance(currentCar, currentCustom);
        cachedStats = computeDamagedStats(
          computeEffectiveCarStats(currentCar, currentUpgrades, currentCustom),
          activeDamageState
        );
      }
      const currentAppearance = cachedAppearance;
      const stats = cachedStats;

      const finalizeGameOver = (reason: string, isVictory = false) => {
        if (recordedGhostFrameCount > 10 && gameModeRef.current !== 'parking') {
          const runToSave: GhostRun = {
            mode: gameModeRef.current,
            carId: carRef.current.id,
            carColor: cachedAppearance.primaryColor || carRef.current.primaryColor,
            score: Math.round(score),
            distance: Math.round(distance),
            createdAt: Date.now(),
            frames: recordedGhostFrames.slice(0, recordedGhostFrameCount).map((f) => ({ ...f })),
          };
          saveBestGhostRun(runToSave);
        }
        onGameOverRef.current({
          score: Math.round(score),
          distance: Math.round(distance),
          maxCombo,
          coinsCollected: coinsRun,
          overtakes,
          nearMisses,
          jumpsCleared: mountainState?.jumpsCleared,
          bestAirTimeSec: mountainState ? Number(mountainState.bestAirTimeSec.toFixed(2)) : undefined,
          crashReason: reason,
          isVictory,
        });
      };

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

      const curLevel = levelRef.current;
      const effectiveMode: GameModeId = curLevel ? curLevel.mode : gameModeRef.current;
      const isHighwayMode = effectiveMode === 'highway_traffic';
      const isParkingMode = effectiveMode === 'parking';
      const isMountainMode = effectiveMode === 'mountain_drive';
      const isAdventureMode = !isHighwayMode && !isParkingMode && !isMountainMode;
      const effectiveRoadMode: RoadSelectionMode = curLevel ? curLevel.biome : roadModeRef.current;
      const effectiveSkyMode: SkyThemeId = curLevel ? curLevel.sky : skyModeRef.current;
      const activeTrackOpts = curLevel
        ? { curveMultiplier: curLevel.curveMultiplier, widthMultiplier: curLevel.widthMultiplier }
        : undefined;

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

      // Title Showcase Cruise along the continuous S-curve viaduct, 2-lane highway, Mountain Drive, or Parking plaza preview!
      if (phase === 'title') {
        const speed = isHighwayMode ? 17.0 : isMountainMode ? 24.0 : 13.0;
        if (isParkingMode && parkingStages.length > 0 && parkingState) {
          const st = parkingStages[parkingStageIdx];
          camFocusX += (Math.sin(now * 0.00055) * 1.6 - camFocusX) * Math.min(1, 3.0 * dt);
          camFocusY = 0;
          camFocusZ += ((st.targetBay.z + 11) - camFocusZ) * Math.min(1, 3.0 * dt);
          camHeading = -Math.PI / 2;
          visualDriftAngle = 0;
        } else if (isMountainMode) {
          if (!mountainState && track.length > 0) {
            const p0 = track[0];
            mountainState = createInitialMountainState(p0.x, p0.z, p0.y, p0.heading, speed);
          }
          const mSurfDemo = sampleMountainSurface(
            mountainState ? mountainState.x : driftState.x,
            mountainState ? mountainState.z : driftState.z,
            track,
            STEP_DIST,
            1.5
          );
          const cp = mSurfDemo.closestPoint;
          const targetH = cp ? cp.heading : -Math.PI / 2;
          const steerDemo = cp
            ? Math.max(
                -1,
                Math.min(
                  1,
                  -mSurfDemo.signedPerpOffset * 0.42 +
                    normalizeAngle(targetH - (mountainState?.heading ?? driftState.heading)) * 2.2
                )
              )
            : 0;
          if (mountainState) {
            const mDemoRes = stepMountainPhysics(
              mountainState,
              {
                steerInput: steerDemo,
                throttle: mSurfDemo.isRamp || mountainState.isAirborne ? 1.18 : 1.0,
                isFever: mSurfDemo.isRamp || mountainState.isAirborne,
                roadAllowanceBonus: 2.0,
              },
              { topSpeed: 28, driftGrip: 0.78, handlingRate: 2.8 },
              track,
              STEP_DIST,
              dt
            );
            if (mDemoRes.fellReason && cp) {
              mountainState = createInitialMountainState(cp.x, cp.z, cp.y, cp.heading, speed);
            } else {
              mountainState = mDemoRes.state;
            }
            driftState.x = mountainState.x;
            driftState.y = mountainState.y;
            driftState.z = mountainState.z;
            driftState.vx = mountainState.vx;
            driftState.vz = mountainState.vz;
            driftState.heading = mountainState.heading;
            driftState.isDrifting = mountainState.isDrifting;
            driftState.driftFactor = mountainState.driftFactor;
            carGroundY = mSurfDemo.inChasmGap ? mSurfDemo.referenceGroundY : mSurfDemo.roadY;
            activeRoadSlope = (mountainState.currentSlopePct || 0) / 100;
            carVy = mountainState.vy;
            carAirborne = mountainState.isAirborne;
            if (cp) {
              camHeading += normalizeAngle(cp.heading - camHeading) * Math.min(1, 5.0 * dt);
            }
            const angleDiff = normalizeAngle(driftState.heading - camHeading);
            visualDriftAngle +=
              (Math.max(-0.65, Math.min(0.65, angleDiff * 1.8)) - visualDriftAngle) *
              Math.min(1, 7 * dt);
            activeDir = visualDriftAngle >= 0 ? 'right' : 'left';
            wheelSpinPhase += dt * 18;
            const demoAirAtt = mountainState.isAirborne
              ? Math.max(-0.34, Math.min(0.36, mountainState.vy / 20))
              : Math.max(-0.26, Math.min(0.26, activeRoadSlope));
            const targetPitchDemo = Math.max(0.14, Math.min(0.62, 0.37 + demoAirAtt * 0.58));
            heroPitchRad += (targetPitchDemo - heroPitchRad) * Math.min(1, 8 * dt);
            heroAirPitchRad = 0;
            heroRollRad += (-visualDriftAngle * 0.036 - heroRollRad) * Math.min(1, 8 * dt);
            heroPitchY += (0 - heroPitchY) * Math.min(1, 8 * dt);
            if (!mountainState.isAirborne) {
              if (Math.abs(visualDriftAngle) > 0.24) {
                tireEmitMode = 'drift';
                tireSlipIntensity = Math.min(1, Math.abs(visualDriftAngle) * 0.95);
              } else {
                tireEmitMode = 'spray';
                tireSlipIntensity = 0.42;
              }
            }
            const lastPt = track[track.length - 1];
            if (lastPt && driftState.z - lastPt.z < 155) {
              const ext = extendMountainTrack(track, 24, STEP_DIST, seed);
              for (let e = 0; e < ext.length; e++) track.push(ext[e]);
              while (track.length > 96 && track[0].z > driftState.z + 32) {
                track.shift();
              }
              populateTreesAround(driftState.z, false, true);
            }
            const mtnDemoAheadPt = cp ? track[Math.min(track.length - 1, Math.max(0, (cp.index - (track[0]?.index ?? 0)) + 3))] : null;
            const mtnDemoCam = computeMountainCameraTarget({
              carY: driftState.y,
              carVy: mountainState.vy,
              roadSlope: activeRoadSlope,
              isAirborne: mountainState.isAirborne,
              inChasmGap: mSurfDemo.inChasmGap,
              referenceGroundY: mSurfDemo.referenceGroundY,
              roadY: mSurfDemo.roadY,
              aheadRoadY: mtnDemoAheadPt ? mtnDemoAheadPt.y : undefined,
              isTitle: true,
            });
            camFocusX += (driftState.x - camFocusX) * Math.min(1, 8 * dt);
            camFocusY += (mtnDemoCam.focusY - camFocusY) * Math.min(1, (mountainState.isAirborne ? 6.8 : 9.5) * dt);
            camFocusZ += (driftState.z - camFocusZ) * Math.min(1, 8 * dt);
          }
        } else {
        const roadEval = evaluateCarOnSCurveRoad(driftState.x, driftState.z, track, 2.0);
        const demoSurf = sampleSCurveSurface(driftState.x, driftState.z, track, STEP_DIST);
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
              roadSlope: demoSurf.roadSlope,
            },
            { topSpeed: speed, handlingRate: 2.8 },
            dt
          );
          const postDemoSurf = sampleSCurveSurface(driftState.x, driftState.z, track, STEP_DIST);
          driftState.y = postDemoSurf.groundY;
          carGroundY = postDemoSurf.groundY;
          activeRoadSlope = postDemoSurf.roadSlope;
          carAirborne = false;
          heroPitchRad += (Math.max(0.14, Math.min(0.60, 0.37 + activeRoadSlope * 0.62)) - heroPitchRad) * Math.min(1, 8 * dt);
          camHeading += normalizeAngle(roadEval.closestPoint.heading - camHeading) * Math.min(1, 5.0 * dt);

          const angleDiff = normalizeAngle(driftState.heading - camHeading);
          visualDriftAngle += (Math.max(-0.36, Math.min(0.36, angleDiff * 1.35)) - visualDriftAngle) * Math.min(1, 8 * dt);
          activeDir = visualDriftAngle >= 0 ? 'right' : 'left';
          wheelSpinPhase += dt * 18;

          for (let i = 0; i < trafficCars.length; i++) {
            trafficCars[i].s += (trafficCars[i].isOncoming ? -1 : 1) * trafficCars[i].speed * dt;
          }
          resolveTrafficInterCarSpacing(trafficCars, HIGHWAY_ROAD_WIDTH * 0.5);
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
            const ext = extendHighwayTrack(track, 20, STEP_DIST, seed, activeTrackOpts);
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
            { steerInput: Math.max(-1, Math.min(1, steerDemo)), throttle: 0.78, roadSlope: demoSurf.roadSlope },
            { topSpeed: speed, driftGrip: 0.72, handlingRate: 2.6 },
            dt
          );

          // Keep title car safely centered on the viaduct
          if (roadEval.closestPoint) {
            driftState.x += (roadEval.closestPoint.x - driftState.x) * Math.min(1, 2.8 * dt);
            camHeading += normalizeAngle(roadEval.closestPoint.heading - camHeading) * Math.min(1, 4.5 * dt);
          }
          const postDemoSurf = sampleSCurveSurface(driftState.x, driftState.z, track, STEP_DIST);
          driftState.y = postDemoSurf.groundY;
          carGroundY = postDemoSurf.groundY;
          activeRoadSlope = postDemoSurf.roadSlope;
          carAirborne = false;
          heroPitchRad += (Math.max(0.14, Math.min(0.60, 0.37 + activeRoadSlope * 0.62)) - heroPitchRad) * Math.min(1, 8 * dt);

          // Showcase diagonal drift pose (`/` angle) + exact tire-anchored skid marks & smoke!
          const angleDiff = normalizeAngle(driftState.heading - camHeading);
          const showcaseBias = Math.sin(now * 0.0011) >= -0.3 ? 0.68 : -0.68;
          const targetPose = Math.max(-1, Math.min(1, angleDiff * 2.2 + showcaseBias * 0.55));
          visualDriftAngle += (targetPose - visualDriftAngle) * Math.min(1, 6 * dt);
          activeDir = visualDriftAngle >= 0 ? 'right' : 'left';
          wheelSpinPhase += dt * 16;
          heroRollRad += (-visualDriftAngle * 0.042 - heroRollRad) * Math.min(1, 8 * dt);
          heroPitchY += (0 - heroPitchY) * Math.min(1, 8 * dt);

          if (Math.abs(visualDriftAngle) > 0.22) {
            tireEmitMode = 'drift';
            tireSlipIntensity = Math.min(1, Math.abs(visualDriftAngle) * 1.15);
          }

          // Extend endless road for continuous title flyover
          const lastPt = track[track.length - 1];
          if (lastPt && driftState.z - lastPt.z < 145) {
            const ext = extendSCurveTrack(track, 20, STEP_DIST, seed, activeTrackOpts);
            if (isAdventureMode) {
              applyAdventureElevationProfile(ext, STEP_DIST, seed);
            }
            for (let e = 0; e < ext.length; e++) track.push(ext[e]);
            while (track.length > 85 && track[0].z > driftState.z + 30) {
              track.shift();
            }
            populateTreesAround(driftState.z, isAdventureMode);
          }

          camFocusX += (driftState.x - camFocusX) * Math.min(1, 8 * dt);
          camFocusY += (driftState.y - camFocusY) * Math.min(1, 8 * dt);
          camFocusZ += (driftState.z - camFocusZ) * Math.min(1, 8 * dt);
        }
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
            cameraTrauma = Math.min(1, cameraTrauma + 0.32);
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

        // Combine Steering Inputs (Priority: Keyboard > HUD Wheel/Buttons > Canvas Touch/Swipe > Tap Impulse)
        const steerInput = resolveCombinedSteering({
          keyLeft,
          keyRight,
          hudSteer: steerHoldRef.current,
          pointerSteer,
          tapImpulse: tapImpulseTimer > 0 ? tapImpulseDir : 0,
        });

        if (isParkingMode && parkingState && parkingStages.length > 0 && simDt > 0) {
          const curStage = parkingStages[parkingStageIdx];
          if (parkingHitCooldown > 0) parkingHitCooldown = Math.max(0, parkingHitCooldown - simDt);

          // Sync external UI gear selector (P / R / D) or keyboard override
          if (parkingGearOverride !== null) {
            parkingState.gear = parkingGearOverride;
            parkingLastSyncedPropGear = parkingGearOverride;
            onParkingGearChangeRef.current?.(parkingGearOverride);
            parkingGearOverride = null;
          } else if (parkingGearRef.current !== parkingLastSyncedPropGear) {
            parkingLastSyncedPropGear = parkingGearRef.current;
            parkingState.gear = parkingGearRef.current;
            soundFX.playGearShift();
          }

          let rawGas = (keyUp || pedalGasRef.current) ? 1 : 0;
          let rawBrake = (keyDown || pedalBrakeRef.current) ? 1 : 0;
          const rawHandbrake = Boolean(keyHandbrake || pedalHandbrakeRef.current);

          // Casual keyboard ergonomic assist: holding Brake/S when stopped in 'D' shifts into 'R' and reverses smoothly
          if (rawBrake > 0 && rawGas === 0 && parkingState.gear === 'D' && Math.abs(parkingState.speed) < 0.22) {
            parkingReverseHoldTimer += simDt;
            if (parkingReverseHoldTimer >= 0.28) {
              parkingState.gear = 'R';
              parkingLastSyncedPropGear = 'R';
              onParkingGearChangeRef.current?.('R');
              soundFX.playGearShift();
              rawGas = 0.72;
              rawBrake = 0;
            }
          } else {
            parkingReverseHoldTimer = 0;
          }

          // Flash / Horn handlers inside Parking mode (visual & audio feedback!)
          const wantFlash = pendingFlashRef.current;
          const wantHorn = pendingHornRef.current;
          pendingFlashRef.current = false;
          pendingHornRef.current = false;
          if (wantFlash) {
            highBeamTimer = 0.56;
            soundFX.playHeadlightFlash();
            screenFlashAlpha = Math.max(screenFlashAlpha, 0.05);
            screenFlashColor = currentAppearance.headlightBeamHex;
          }
          if (wantHorn) {
            soundFX.playHorn(currentAppearance.horn);
            pushShockwave({
              x: parkingState.x,
              y: 0.4,
              z: parkingState.z,
              radius: 0.5,
              maxRadius: 3.4,
              color: '#fef08a',
              life: 0.28,
              maxLife: 0.28,
            });
          }

          if (!parkingStageClearedBanner) {
            parkingState = stepParkingPhysics(
              parkingState,
              {
                steerInput,
                gasInput: rawGas,
                brakeInput: rawBrake,
                handbrake: rawHandbrake,
                gear: parkingState.gear,
              },
              {
                topSpeed: stats.topSpeed,
                handlingRate: stats.handlingRate,
              },
              {
                halfPlazaWidth: curStage.plazaWidth * 0.5,
                minZ: curStage.endZ - 5,
                maxZ: curStage.startZ + 5,
              },
              simDt
            );

            const hitRes = stepParkingObstacles(parkingState, curStage, simDt);
            const stepMove = Math.hypot(parkingState.vx, parkingState.vz) * simDt;
            distance += stepMove;
            wheelSpinPhase += (parkingState.speed >= 0 ? 1 : -1) * stepMove * 0.75;
            visualFrontSteer = Math.max(-1, Math.min(1, parkingState.steerAngle / 0.60));

            if (hitRes.newlyClearedGates > 0) {
              score += 250 * hitRes.newlyClearedGates;
              soundFX.playCoinPickup(2);
              triggerHaptic('light');
              pushCallout(
                parkingState.x,
                1.8,
                parkingState.z,
                `GATE CLEAR! +${250 * hitRes.newlyClearedGates}`,
                '#22d3ee',
                0.85
              );
              onMissionEventRef.current?.({ slalom_clears: hitRes.newlyClearedGates });
            }

            if (hitRes.coneHitsDelta > 0) {
              parkingHits += hitRes.coneHitsDelta;
              parkingStageHits += hitRes.coneHitsDelta;
              soundFX.playConeKnock(hitRes.impactSpeed);
              triggerHaptic('medium', false, 'collision');
              cameraTrauma = Math.min(1, cameraTrauma + 0.35);
              nearMissText = `CONE CLIPPED! (${parkingHits} HITS)`;
              nearMissTimer = 1.1;
              pushCallout(parkingState.x, 1.8, parkingState.z, 'CONE HIT!', '#f97316', 0.9);
            }

            if ((hitRes.carBump || hitRes.barrierHit) && parkingHitCooldown <= 0) {
              parkingHits += 1;
              parkingStageHits += 1;
              parkingHitCooldown = 0.65;
              soundFX.playTrafficCrunch(hitRes.impactSpeed >= 9 ? 0.65 : 0.35);
              triggerHaptic(hitRes.impactSpeed >= 9 ? 'heavy' : 'light', false, 'collision');
              cameraTrauma = Math.min(1, cameraTrauma + (hitRes.impactSpeed >= 9 ? 0.45 : 0.22));
              if (hitRes.impactSpeed >= 8.5) {
                screenFlashAlpha = 0.14;
                screenFlashColor = '#e2e8f0';
              }

              const impactDir = parkingState.gear === 'R' ? 'rear' : 'front';
              const pkDmg = evaluateSpeedGatedImpact({
                damage: activeDamageState,
                impactZone: impactDir,
                impactSpeed: hitRes.impactSpeed,
                minDamageSpeed: 8.5,
                highSpeedThreshold: 13.0,
                hitQuality: 0.72,
                sideBias: steerInput < 0 ? -1 : 1,
                allowTotaling: false,
              });
              if (pkDmg.appliedSeverity > 0) {
                activeDamageState = pkDmg.nextDamage;
                onCarDamageChangeRef.current?.(activeDamageState);
                if (pkDmg.newlyDetached.length > 0) {
                  soundFX.playPartDetach(pkDmg.newlyDetached.length);
                  for (let dp = 0; dp < pkDmg.newlyDetached.length; dp++) {
                    spawnDetachedPart(
                      pkDmg.newlyDetached[dp],
                      parkingState.x,
                      0,
                      parkingState.z,
                      parkingState.vx,
                      parkingState.vz,
                      0.06,
                      currentAppearance.primaryColor,
                      currentCar.accentColor,
                      steerInput < 0 ? -1 : 1
                    );
                  }
                }
              }

              const lbl =
                pkDmg.appliedSeverity > 0
                  ? hitRes.carBump
                    ? 'BUMPER BENT!'
                    : 'BARRIER IMPACT!'
                  : 'BUMPER TAP!';
              nearMissText = `${lbl} (${parkingHits} HITS)`;
              nearMissTimer = 1.2;
              pushCallout(
                parkingState.x,
                1.9,
                parkingState.z,
                lbl,
                pkDmg.appliedSeverity > 0 ? '#ef4444' : '#fbbf24',
                0.95
              );

              if (isCarTotaled(activeDamageState)) {
                finalizeGameOver('Car Destroyed in Lot', false);
              }
            }

            // Emit tire marks & smoke on fast handbrake J-turns in Stage 6 or peel-outs!
            if (parkingState.isDrifting || (rawHandbrake && Math.abs(parkingState.speed) > 4.0)) {
              tireEmitMode = 'drift';
              tireSlipIntensity = Math.max(0.45, parkingState.driftFactor);
              tireGassingNow = rawGas > 0;
              tireBrakingNow = rawHandbrake;
            }

            const bayStatus = evaluateParkingBayStatus(parkingState, curStage);
            const liveProx = evaluateParkingProximity(parkingState, curStage);
            if (
              parkingState.gear !== 'P' &&
              liveProx.minClearanceM < 1.85 &&
              Math.hypot(parkingState.vx, parkingState.vz) > 0.16 &&
              !bayStatus.readyToLock
            ) {
              parkingSonarTimer -= simDt;
              if (parkingSonarTimer <= 0) {
                soundFX.playParkingBeep(liveProx.minClearanceM, parkingState.gear);
                const tUrgency = Math.max(0, Math.min(1, (liveProx.minClearanceM - 0.35) / 1.5));
                parkingSonarTimer = 0.14 + tUrgency * 0.44;
              }
            } else {
              parkingSonarTimer = Math.max(0, parkingSonarTimer - simDt);
            }

            if (bayStatus.readyToLock) {
              parkingLockTimer =
                parkingState.gear === 'P'
                  ? 1.0
                  : Math.min(1.0, parkingLockTimer + simDt * 1.15);
              if (parkingLockTimer >= 1.0) {
                parkingStageClearedBanner = true;
                parkingClearDelay = 1.25;
                const cleanBonus = parkingStageHits === 0 ? 800 : 0;
                const stagePts = 1500 + parkingStageIdx * 400 + cleanBonus;
                const stageCoins = 40 + parkingStageIdx * 10;
                score += stagePts;
                coinsRun += stageCoins;
                soundFX.playParkingLock();
                triggerHaptic('fever');
                nearMissText =
                  parkingStageHits === 0
                    ? `CLEAN BAY LOCKED! +${stagePts} PTS`
                    : `BAY LOCKED! +${stagePts} PTS`;
                nearMissTimer = 1.4;
                pushShockwave({
                  x: curStage.targetBay.x,
                  y: 0.12,
                  z: curStage.targetBay.z,
                  radius: 0.5,
                  maxRadius: 4.5,
                  color: '#10b981',
                  life: 0.45,
                  maxLife: 0.45,
                });
                pushCallout(
                  curStage.targetBay.x,
                  2.0,
                  curStage.targetBay.z,
                  `BAY CLEARED! +${stageCoins} CR`,
                  '#10b981',
                  1.2
                );

                const mEv: Partial<Record<MissionType, number>> = { parking_clears: 1 };
                if (parkingStageHits === 0) mEv.zero_hit_parks = 1;
                if (
                  curStage.maneuverType === 'parallel' ||
                  curStage.maneuverType === 'offset_chicane_parallel'
                ) {
                  mEv.parallel_parks = 1;
                }
                if (
                  curStage.maneuverType === 'reverse_bay' ||
                  curStage.maneuverType === 'slalom_reverse' ||
                  curStage.maneuverType === 'underground_tight' ||
                  curStage.maneuverType === 'loading_dock'
                ) {
                  mEv.reverse_parks = 1;
                }
                if (
                  curStage.maneuverType === 'gymkhana_180' ||
                  curStage.maneuverType === 'valet_gauntlet'
                ) {
                  mEv.gymkhana_parks = 1;
                }
                if (bayStatus.centerDistM <= 0.35 && bayStatus.headingErrorDeg <= 4.0) {
                  mEv.precision_aligns = 1;
                }
                onMissionEventRef.current?.(mEv);
              }
            } else {
              parkingLockTimer = Math.max(0, parkingLockTimer - simDt * 1.8);
            }
          } else {
            parkingClearDelay -= simDt;
            if (parkingClearDelay <= 0) {
              if (parkingStageIdx + 1 < parkingStages.length) {
                parkingStageIdx += 1;
                const nextSt = parkingStages[parkingStageIdx];
                parkingState = createInitialParkingState(nextSt);
                parkingStageHits = 0;
                parkingLockTimer = 0;
                parkingStageClearedBanner = false;
                parkingLastSyncedPropGear = nextSt.spawn.gear;
                onParkingGearChangeRef.current?.(nextSt.spawn.gear);
                skidHead = 0;
                skidCount = 0;
                frontSkidHead = 0;
                frontSkidCount = 0;
                nearMissText = `STAGE ${nextSt.stageNumber}: ${nextSt.subtitle.toUpperCase()}`;
                nearMissTimer = 1.8;
              } else {
                finalizeGameOver('Parking Mastery Complete!', true);
              }
            }
          }

          // Sync driftState mirror for camera & tire smoke/lights helpers
          driftState.x = parkingState.x;
          driftState.z = parkingState.z;
          driftState.y = 0;
          driftState.vx = parkingState.vx;
          driftState.vz = parkingState.vz;
          driftState.heading = parkingState.heading;
          driftState.isDrifting = parkingState.isDrifting;
          driftState.driftFactor = parkingState.driftFactor;
          visualDriftAngle = 0;

          const pSpeedMag = Math.hypot(parkingState.vx, parkingState.vz);
          const pSpeedRatio = Math.min(1, pSpeedMag / 16);
          soundFX.updateEngineSound({
            active: true,
            speedRatio: Math.max(0.08, pSpeedRatio),
            isGassing: rawGas > 0 && parkingState.gear !== 'P',
            isBraking: rawBrake > 0 || rawHandbrake,
            isFever: false,
            soundProfile: currentAppearance.sound,
          });
          soundFX.updateMusicEffects({
            phase: 'playing',
            speedRatio: pSpeedRatio,
            isDrifting: parkingState.isDrifting,
            driftFactor: parkingState.driftFactor,
            isFever: false,
            isBraking: rawBrake > 0,
            isNearEdge: false,
          });
        } else if (!isFalling && !isTrafficCrash && simDt > 0) {
          if (isFever) {
            feverTimer -= simDt;
            fever = Math.max(0, (feverTimer / 5.0) * 100);
            if (feverTimer <= 0) {
              isFever = false;
              fever = 0;
            }
          }

          const preSurf = !isMountainMode
            ? sampleSCurveSurface(driftState.x, driftState.z, track, STEP_DIST)
            : null;
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

          // Progressive speed scale + Gas/Brake/Handbrake pedals + Slipstream rush boost
          const speedBoost =
            (isFever ? 1.28 : 1.0) +
            (slipstreamBoostTimer > 0 ? 0.18 : slipstreamCharge * 0.14) +
            Math.min(0.25, distance * 0.00025);
          const resolvedPedals = resolveDrivingPedals({
            mode: effectiveMode,
            keyUp,
            keyDown,
            pedalGas: pedalGasRef.current,
            pedalBrake: pedalBrakeRef.current,
            keyHandbrake,
            pedalHandbrake: pedalHandbrakeRef.current,
          });
          const brakeInput = resolvedPedals.brakeInput;
          const accelInput = resolvedPedals.gasInput;
          const effectiveHandbrake = resolvedPedals.handbrake;

          const preSpeedNow = Math.hypot(driftState.vx, driftState.vz);
          const speedSteerWeight = 1.0 - Math.min(0.26, Math.max(0, (preSpeedNow - 18) * 0.015));
          const weightedSteerTarget = steerInput * speedSteerWeight;
          smoothSteerInput += (weightedSteerTarget - smoothSteerInput) * Math.min(1, 18 * simDt);
          if (Math.abs(steerInput) < 0.02 && Math.abs(smoothSteerInput) < 0.02) {
            smoothSteerInput = 0;
          }
          if (offRoadTreeHitCooldown > 0) {
            offRoadTreeHitCooldown = Math.max(0, offRoadTreeHitCooldown - simDt);
          }

          let mountainStepRes: ReturnType<typeof stepMountainPhysics> | null = null;
          if (isMountainMode) {
            if (!mountainState && track.length > 0) {
              mountainState = createInitialMountainState(
                driftState.x,
                driftState.z,
                driftState.y,
                driftState.heading,
                preSpeedNow
              );
            }
            if (mountainState) {
              mountainStepRes = stepMountainPhysics(
                mountainState,
                {
                  steerInput: smoothSteerInput,
                  throttle: resolvedPedals.throttle,
                  handbrake: effectiveHandbrake,
                  isFever,
                  roadAllowanceBonus: stats.roadAllowanceBonus,
                },
                {
                  topSpeed: stats.topSpeed * speedBoost,
                  driftGrip: stats.driftGrip,
                  handlingRate: stats.handlingRate,
                },
                track,
                STEP_DIST,
                simDt
              );
              mountainState = mountainStepRes.state;
              driftState.x = mountainState.x;
              driftState.y = mountainState.y;
              driftState.z = mountainState.z;
              driftState.vx = mountainState.vx;
              driftState.vz = mountainState.vz;
              driftState.heading = mountainState.heading;
              driftState.isDrifting = mountainState.isDrifting;
              driftState.driftFactor = mountainState.driftFactor;
            }
          } else if (isHighwayMode) {
            driftState = stepHighwayPhysics(
              driftState,
              {
                steerInput: smoothSteerInput,
                accelInput,
                brakeInput,
                handbrake: effectiveHandbrake,
                roadTangentAngle: roadTangent,
                roadSlope: preSurf?.roadSlope ?? 0,
                airborne: carAirborne,
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
                steerInput: smoothSteerInput,
                throttle: isOffRoad ? Math.min(0.68, resolvedPedals.throttle) : resolvedPedals.throttle,
                handbrake: effectiveHandbrake,
                roadTangentAngle: isOffRoad ? undefined : roadTangent,
                roadSlope: preSurf?.roadSlope ?? 0,
                airborne: carAirborne,
              },
              {
                topSpeed: stats.topSpeed * speedBoost * (isOffRoad ? 0.68 : 1.0),
                driftGrip: stats.driftGrip * (isOffRoad ? 0.66 : 1.0),
                handlingRate: stats.handlingRate * (isOffRoad ? 0.88 : 1.0),
              },
              simDt
            );
            if (isOffRoad && !carAirborne) {
              const offDrag = Math.exp(-0.95 * simDt);
              driftState.vx *= offDrag;
              driftState.vz *= offDrag;
            }
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

          // Holographic Ghost Recording (~10 Hz) & Live Overtake Detection
          runElapsedSec += simDt;
          ghostRecordTimer += simDt;
          if (ghostRecordTimer >= 0.1) {
            ghostRecordTimer -= 0.1;
            if (recordedGhostFrameCount < MAX_GHOST_RECORD_FRAMES) {
              const rec = recordedGhostFrames[recordedGhostFrameCount];
              rec.timeSec = Number(runElapsedSec.toFixed(2));
              rec.distance = Number(distance.toFixed(1));
              rec.lateralOffset = Number(preRoadEval.signedPerpOffset.toFixed(2));
              rec.angle = Number(driftState.heading.toFixed(3));
              rec.speedKmh = Math.round(curSpeed * 7.2);
              recordedGhostFrameCount++;
            }
          }

          if (activeGhost) {
            const curGhost = sampleGhostPosition(activeGhost, runElapsedSec, ghostSampleScratch);
            if (curGhost) {
              if (curGhost.distance > distance + 1.2) {
                wasGhostAhead = true;
              }
              if (wasGhostAhead && distance >= curGhost.distance && !ghostOvertakenTriggered && runElapsedSec >= 1.0) {
                ghostOvertakenTriggered = true;
                soundFX.playFeverBurst();
                triggerHaptic('double');
                pushCallout(
                  driftState.x,
                  driftState.y + 1.8,
                  driftState.z,
                  'GHOST OVERTAKEN! ⏱️',
                  '#06b6d4',
                  1.4
                );
                spawnFloatingText(
                  driftState.x,
                  driftState.y + 1.2,
                  driftState.z,
                  'RIVAL OVERTAKEN!',
                  '#22d3ee',
                  1.1
                );
                pushShockwave({
                  x: driftState.x,
                  y: driftState.y + 0.6,
                  z: driftState.z,
                  radius: 0.5,
                  maxRadius: 4.8,
                  color: '#06b6d4',
                  life: 0.42,
                  maxLife: 0.42,
                });
              }
            }
          }

          // Distance Milestone & Live Mid-Run Rank-Up Dopamine Bursts!
          if (distance >= nextMilestoneDist) {
            const reached = nextMilestoneDist;
            nextMilestoneDist += 250;
            const mCoins = 20;
            coinsRun += mCoins;
            score += 400;
            cameraTrauma = Math.min(1, cameraTrauma + 0.16);
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
              soundFX.playMilestone();
              nearMissText = `RANK UP · ${curRank.rank} ${curRank.title}!`;
              nearMissTimer = 1.8;
            }
          }

          if (isAdventureMode) {
            const curAdv = resolveAdventureZone(distance);
            if (curAdv.chapter.id !== lastAdventureChapterId) {
              lastAdventureChapterId = curAdv.chapter.id;
              nearMissText = `ENTERING ${curAdv.chapter.name.toUpperCase()}`;
              nearMissTimer = 1.9;
              pushShockwave({
                x: driftState.x,
                y: driftState.y + 0.15,
                z: driftState.z,
                radius: 0.8,
                maxRadius: 5.5,
                color: curAdv.chapter.crystalPrimary,
                life: 0.45,
                maxLife: 0.45,
              });
              pushCallout(
                driftState.x,
                driftState.y + 2.0,
                driftState.z,
                curAdv.chapter.name.toUpperCase(),
                curAdv.chapter.crystalPrimary,
                1.4
              );
            }
          } else if (!isMountainMode) {
            const curBiome = resolveRoadBiome(effectiveRoadMode, distance);
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
          }

          // Campaign Level Finish Line Completion Check
          if (curLevel && !levelFinished && distance >= curLevel.targetDistance) {
            levelFinished = true;
            soundFX.playFeverBurst();
            triggerHaptic('fever');
            finalizeGameOver(`Stage ${curLevel.number} Complete!`, true);
          }

          const mountainSurfaceNow = isMountainMode
            ? sampleMountainSurface(
                driftState.x,
                driftState.z,
                track,
                STEP_DIST,
                stats.roadAllowanceBonus
              )
            : null;
          const roadCheck = isMountainMode && mountainSurfaceNow
            ? {
                onRoad: !mountainStepRes?.fellReason,
                nearEdge:
                  mountainSurfaceNow.onRoadCorridor &&
                  !mountainSurfaceNow.inChasmGap &&
                  Math.abs(mountainSurfaceNow.signedPerpOffset) >=
                    mountainSurfaceNow.halfWidth * 0.78,
                perpDistance: Math.abs(mountainSurfaceNow.signedPerpOffset),
                signedPerpOffset: mountainSurfaceNow.signedPerpOffset,
                halfWidth: mountainSurfaceNow.halfWidth,
                closestPoint: mountainSurfaceNow.closestPoint,
              }
            : evaluateCarOnSCurveRoad(
                driftState.x,
                driftState.z,
                track,
                stats.roadAllowanceBonus
              );

          if (roadCheck.closestPoint) {
            // Smoothly follow road curve heading with chase camera
            camHeading += normalizeAngle(roadCheck.closestPoint.heading - camHeading) * Math.min(1, 3.8 * simDt);
          }

          if (!isMountainMode) {
            const postSurf = sampleSCurveSurface(driftState.x, driftState.z, track, STEP_DIST);
            let targetGroundY = postSurf.groundY;
            let slopeNow = postSurf.roadSlope;

            if (isOffRoad && roadCheck.closestPoint) {
              const advOffZone = isAdventureMode ? resolveAdventureZone(distance, roadCheck.closestPoint.index) : null;
              const offBiomeId = resolveRoadBiome(effectiveRoadMode, distance).id;
              targetGroundY = advOffZone
                ? sampleAdventureTerrainElevation(
                    roadCheck.signedPerpOffset,
                    driftState.z,
                    roadCheck.closestPoint.y,
                    advOffZone
                  )
                : sampleTerrainElevation(roadCheck.signedPerpOffset, driftState.z, offBiomeId);
              const fwdProbeZ = driftState.z + Math.sin(driftState.heading) * 1.5;
              const fwdProbeX = driftState.x + Math.cos(driftState.heading) * 1.5;
              const fwdLat =
                (fwdProbeX - roadCheck.closestPoint.x) * roadCheck.closestPoint.nx +
                (fwdProbeZ - roadCheck.closestPoint.z) * roadCheck.closestPoint.nz;
              const fwdGroundY = advOffZone
                ? sampleAdventureTerrainElevation(fwdLat, fwdProbeZ, roadCheck.closestPoint.y, advOffZone)
                : sampleTerrainElevation(fwdLat, fwdProbeZ, offBiomeId);
              slopeNow = Math.max(-0.4, Math.min(0.4, (fwdGroundY - targetGroundY) / 1.5));
              if (!carAirborne && curSpeed > 4.0) {
                suspensionVel += Math.sin(now * 0.048) * Math.min(2.6, curSpeed * 0.14);
              }
            }

            carGroundY = targetGroundY;
            activeRoadSlope = slopeNow;
            const prevSpd = curSpeed;

            if (!carAirborne) {
              const prevExpectedVy = prevSpd * prevRoadSlope;
              const slopeDrop = prevRoadSlope - slopeNow;
              const crestLiftAccel = slopeDrop > 0.01 && simDt > 0 ? (prevSpd * slopeDrop) / simDt : 0;
              const predY = driftState.y + prevExpectedVy * simDt - 0.5 * 24.0 * simDt * simDt;
              if (prevSpd >= 18.0 && crestLiftAccel > 25.0 && predY > targetGroundY + 0.01) {
                carAirborne = true;
                carAirTime = simDt;
                carVy = Math.max(1.0, prevExpectedVy * 0.95);
                driftState.y = predY;
              } else {
                driftState.y = targetGroundY;
                carVy = prevSpd * slopeNow;
              }
            } else {
              carAirTime += simDt;
              carVy -= 24.0 * simDt;
              driftState.y += carVy * simDt;
              if (driftState.y <= targetGroundY) {
                const downImpact = Math.max(0, slopeNow * prevSpd - carVy);
                driftState.y = targetGroundY;
                carVy = slopeNow * prevSpd;
                carAirborne = false;
                suspensionVel -= Math.min(4.8, downImpact * 0.65);
                if (carAirTime >= 0.16 && downImpact >= 2.2) {
                  soundFX.playGroundSlam(Math.min(0.58, 0.22 + downImpact * 0.04));
                  cameraTrauma = Math.min(1, cameraTrauma + Math.min(0.32, downImpact * 0.038));
                  if (downImpact >= 5.2) {
                    const landDmg = applyImpactToCarDamage({
                      damage: activeDamageState,
                      impactZone: 'ground_slam',
                      severity: Math.min(0.55, (downImpact - 4.5) * 0.08),
                      sideBias: visualDriftAngle >= 0 ? 1 : -1,
                    });
                    activeDamageState = landDmg.nextDamage;
                    onCarDamageChangeRef.current?.(activeDamageState);
                    if (landDmg.newlyDetached.length > 0) {
                      soundFX.playPartDetach(landDmg.newlyDetached.length);
                      for (let dp = 0; dp < landDmg.newlyDetached.length; dp++) {
                        spawnDetachedPart(
                          landDmg.newlyDetached[dp],
                          driftState.x,
                          driftState.y,
                          driftState.z,
                          driftState.vx * 0.6,
                          driftState.vz * 0.6,
                          driftState.y + 0.05,
                          currentAppearance.primaryColor,
                          currentCar.accentColor,
                          dp % 2 === 0 ? 1 : -1
                        );
                      }
                    }
                  }
                  for (let lp = 0; lp < 6; lp++) {
                    const ang = Math.random() * Math.PI * 2;
                    pushSmokePuff({
                      x: driftState.x + Math.cos(ang) * 0.7,
                      y: driftState.y + 0.14,
                      z: driftState.z + Math.sin(ang) * 0.7,
                      vx: Math.cos(ang) * (2.0 + Math.random() * 2.5),
                      vy: 0.6 + Math.random() * 1.1,
                      vz: Math.sin(ang) * (2.0 + Math.random() * 2.5),
                      radius: 0.24,
                      maxRadius: 1.0,
                      life: 0.36,
                      maxLife: 0.36,
                      tint: isOffRoad ? 'dirt' : 'dust',
                    });
                  }
                }
                carAirTime = 0;
              }
            }
            prevRoadSlope = slopeNow;
          } else if (mountainState) {
            carGroundY = mountainSurfaceNow
              ? mountainSurfaceNow.inChasmGap
                ? mountainSurfaceNow.referenceGroundY
                : mountainSurfaceNow.roadY
              : driftState.y;
            carVy = mountainState.vy;
            carAirborne = mountainState.isAirborne;
            carAirTime = mountainState.airTimeSec;
            activeRoadSlope = (mountainState.currentSlopePct || 0) / 100;
            prevRoadSlope = activeRoadSlope;
          }

          if (isMountainMode && mountainState && mountainStepRes) {
            if (mountainStepRes.bermBounce) {
              const edgeSign = (mountainSurfaceNow?.signedPerpOffset ?? 1) >= 0 ? 1 : -1;
              const bermDmg = evaluateSpeedGatedImpact({
                damage: activeDamageState,
                impactZone: edgeSign < 0 ? 'left' : 'right',
                impactSpeed: mountainStepRes.impactSpeed ?? 10,
                minDamageSpeed: 7.5,
                highSpeedThreshold: 19.5,
                hitQuality: 0.65,
                sideBias: edgeSign,
                allowTotaling: false,
              });
              if (bermDmg.appliedSeverity > 0) {
                activeDamageState = bermDmg.nextDamage;
                onCarDamageChangeRef.current?.(activeDamageState);
                if (bermDmg.newlyDetached.length > 0) {
                  soundFX.playPartDetach(bermDmg.newlyDetached.length);
                  for (let dp = 0; dp < bermDmg.newlyDetached.length; dp++) {
                    spawnDetachedPart(
                      bermDmg.newlyDetached[dp],
                      driftState.x,
                      driftState.y,
                      driftState.z,
                      driftState.vx * 0.5,
                      driftState.vz * 0.5,
                      driftState.y + 0.08,
                      currentAppearance.primaryColor,
                      currentCar.accentColor,
                      edgeSign
                    );
                  }
                }
              }
              soundFX.playGuardrailSpark();
              triggerHaptic('medium', false, 'collision');
              cameraTrauma = Math.min(1, cameraTrauma + 0.34);
              heroRollRad += edgeSign * 0.16;
              nearMissText = 'RIDGE BERM BOUNCE!';
              nearMissTimer = 0.85;
              pushCallout(driftState.x, driftState.y + 1.5, driftState.z, 'RIDGE BERM!', '#fbbf24', 0.85);
              for (let bp = 0; bp < 6; bp++) {
                pushSmokePuff({
                  x: driftState.x + (Math.random() - 0.5) * 0.8,
                  y: driftState.y + 0.18,
                  z: driftState.z + (Math.random() - 0.5) * 0.8,
                  vx: -edgeSign * (1.8 + Math.random() * 2.2),
                  vy: 0.9 + Math.random() * 1.4,
                  vz: (Math.random() - 0.5) * 2.0,
                  radius: 0.34,
                  maxRadius: 1.35,
                  life: 0.48,
                  maxLife: 0.48,
                  tint: 'dirt',
                });
              }
            }
            if (mountainStepRes.justLaunched) {
              soundFX.playTurboChirp();
              triggerHaptic('medium', false, 'drift');
              cameraTrauma = Math.min(1, cameraTrauma + 0.2);
              pushShockwave({
                x: driftState.x,
                y: driftState.y + 0.25,
                z: driftState.z,
                radius: 0.6,
                maxRadius: 4.5,
                color: '#f97316',
                life: 0.36,
                maxLife: 0.36,
              });
              pushCallout(
                driftState.x,
                driftState.y + 1.8,
                driftState.z,
                'PEAK LAUNCH!',
                '#fb923c',
                1.0
              );
              nearMissText = 'MEGA LAUNCH!';
              nearMissTimer = 1.0;
            }
            if (mountainStepRes.justLanded) {
              const airBonus = Math.round(250 + mountainStepRes.landedAirTimeSec * 420);
              const airCoins = Math.max(4, Math.round(6 * stats.coinMultiplier));
              score += airBonus * combo;
              coinsRun += airCoins;
              fever = Math.min(100, fever + 22);
              combo = Math.min(25, combo + 1);
              if (combo > maxCombo) maxCombo = combo;
              soundFX.playGroundSlam(
                Math.min(0.65, 0.28 + mountainStepRes.landingImpactSpeed * 0.03)
              );
              triggerHaptic('medium', false, 'drift');
              suspensionVel -= Math.min(4.8, (mountainStepRes.landingImpactSpeed || 4) * 0.65);
              heroPitchY = 2.8;
              cameraTrauma = Math.min(1, cameraTrauma + 0.24);
              const airLabel =
                mountainStepRes.landedAirTimeSec >= 0.85
                  ? `MEGA AIR ${mountainStepRes.landedAirTimeSec.toFixed(1)}s! +${airBonus}`
                  : `PEAK JUMP! +${airBonus}`;
              nearMissText = `${airLabel} (+${airCoins} CR)`;
              nearMissTimer = 1.6;
              pushShockwave({
                x: driftState.x,
                y: driftState.y + 0.15,
                z: driftState.z,
                radius: 0.6,
                maxRadius: 5.2,
                color: '#34d399',
                life: 0.4,
                maxLife: 0.4,
              });
              pushCallout(
                driftState.x,
                driftState.y + 1.85,
                driftState.z,
                airLabel,
                '#34d399',
                1.25
              );
              for (let lp = 0; lp < 10; lp++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 2.5 + Math.random() * 4.5;
                pushSmokePuff({
                  x: driftState.x + Math.cos(ang) * 0.85,
                  y: driftState.y + 0.18,
                  z: driftState.z + Math.sin(ang) * 0.85,
                  vx: Math.cos(ang) * spd,
                  vy: 0.7 + Math.random() * 1.4,
                  vz: Math.sin(ang) * spd,
                  radius: 0.3,
                  maxRadius: 1.25,
                  life: 0.42,
                  maxLife: 0.42,
                  tint: 'dust',
                });
              }
            }
          }

          // Vertical suspension spring-damper (unloads in air, compresses on landing, squats on throttle, dives on brake)
          const airborneFlagNow = carAirborne || Boolean(isMountainMode && mountainState?.isAirborne);
          const pedalSuspTarget = airborneFlagNow ? 0.105 : brakeInput > 0 ? -0.028 : accelInput > 0 ? 0.018 : 0;
          suspensionVel += (-145 * (suspensionY - pedalSuspTarget) - 15 * suspensionVel) * simDt;
          suspensionY = Math.max(-0.18, Math.min(0.16, suspensionY + suspensionVel * simDt));

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
          const targetFrontSteer = Math.max(-1, Math.min(1, steerInput));
          visualFrontSteer += (targetFrontSteer - visualFrontSteer) * Math.min(1, 16 * simDt);
          if (Math.abs(visualFrontSteer) < 0.02 && targetFrontSteer === 0) {
            visualFrontSteer = 0;
          }

          // Live cornering suspension roll, suspension bounce, & 3D slope/airborne pitch attitude
          const targetRoll = Math.max(-0.055, Math.min(0.055, -visualDriftAngle * 0.046 - steerInput * 0.016));
          heroRollRad += (targetRoll - heroRollRad) * Math.min(1, 10 * simDt);

          const effectiveVy = isMountainMode && mountainState ? mountainState.vy : carVy;
          const airAttitude = airborneFlagNow
            ? Math.max(-0.34, Math.min(0.36, effectiveVy / Math.max(12, curSpeed)))
            : 0;
          const slopeAttitude = airborneFlagNow ? 0 : Math.max(-0.28, Math.min(0.28, activeRoadSlope));
          const pedalPitchDelta = brakeInput > 0 ? -0.055 : accelInput > 0 ? 0.04 : 0;
          const targetSpritePitch = Math.max(
            0.14,
            Math.min(0.62, 0.37 + slopeAttitude * 0.65 + airAttitude * 0.58 + pedalPitchDelta)
          );
          heroPitchRad += (targetSpritePitch - heroPitchRad) * Math.min(1, 10 * simDt);
          const targetPitchPx = -(suspensionY * 14) + (brakeInput > 0 ? 1.2 : accelInput > 0 ? -0.7 : 0);
          heroPitchY += (targetPitchPx - heroPitchY) * Math.min(1, 11 * simDt);
          heroAirPitchRad = 0;

          // Guardrail Containment / Break-Through & Live Off-Road Driving (Drift / Adventure / Highway) + Mountain Bounds
          let shouldCrashOut = false;
          if (!isMountainMode && roadCheck.closestPoint) {
            const cpRail = roadCheck.closestPoint;
            const maxCenterLat = Math.max(1.1, cpRail.width * 0.5 - (isHighwayMode ? 0.86 : 0.85));

            if (!isOffRoad) {
              const railRes = resolveSolidGuardrailContact({
                vx: driftState.vx,
                vz: driftState.vz,
                heading: driftState.heading,
                tx: cpRail.tx,
                tz: cpRail.tz,
                nx: cpRail.nx,
                nz: cpRail.nz,
                roadHeading: cpRail.heading,
                signedPerpOffset: roadCheck.signedPerpOffset,
                maxCenterLat,
              });
              if (railRes.hit) {
                const railImpact = evaluateGuardrailImpact({
                  playerSpeed: curSpeed,
                  outwardLateralSpeed: railRes.outwardSpeed,
                  overallIntegrity: getCarOverallIntegrity(activeDamageState),
                });

                if (railRes.outwardSpeed > 1.15) {
                  const railDmg =
                    railRes.outwardSpeed >= 4.0
                      ? applyImpactToCarDamage({
                          damage: activeDamageState,
                          impactZone: railRes.railSide < 0 ? 'left' : 'right',
                          severity: Math.min(0.88, 0.28 + railRes.outwardSpeed * 0.075),
                          sideBias: railRes.railSide,
                        })
                      : evaluateSpeedGatedImpact({
                          damage: activeDamageState,
                          impactZone: railRes.railSide < 0 ? 'left' : 'right',
                          impactSpeed: railImpact.impactSpeed,
                          minDamageSpeed: 5.5,
                          highSpeedThreshold: 17.5,
                          hitQuality: Math.min(1, 0.38 + railRes.outwardSpeed * 0.09),
                          sideBias: railRes.railSide,
                          allowTotaling: false,
                        });
                  activeDamageState = railDmg.nextDamage;
                  onCarDamageChangeRef.current?.(activeDamageState);
                  if (railDmg.newlyDetached.length > 0) {
                    soundFX.playPartDetach(railDmg.newlyDetached.length);
                    for (let dp = 0; dp < railDmg.newlyDetached.length; dp++) {
                      spawnDetachedPart(
                        railDmg.newlyDetached[dp],
                        driftState.x,
                        driftState.y,
                        driftState.z,
                        driftState.vx * 0.45,
                        driftState.vz * 0.45,
                        driftState.y + 0.06,
                        currentAppearance.primaryColor,
                        currentCar.accentColor,
                        railRes.railSide
                      );
                    }
                  }
                }

                if (railImpact.shouldBreach || isCarTotaled(activeDamageState)) {
                  // SMASH THROUGH THE GUARDRAIL!
                  breachedSliceIdx = cpRail.index;
                  breachedSide = railRes.railSide;
                  const advZoneBreach = isAdventureMode ? resolveAdventureZone(distance, cpRail.index) : null;
                  const offLatProbe = railRes.railSide * (cpRail.width * 0.5 + 2.1);
                  const offGroundProbe = advZoneBreach
                    ? sampleAdventureTerrainElevation(offLatProbe, driftState.z, cpRail.y, advZoneBreach)
                    : sampleTerrainElevation(offLatProbe, driftState.z, resolveRoadBiome(effectiveRoadMode, distance).id);
                  const dropFromRoad = cpRail.y - offGroundProbe;

                  // Shatter steel/wood barrier posts & sparks visually
                  const breachBiome = resolveRoadBiome(effectiveRoadMode, distance);
                  for (let bi = 0; bi < 8; bi++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 3 + Math.random() * 6.5;
                    pushDebrisChunk({
                      x: driftState.x + cpRail.nx * railRes.railSide * 0.85,
                      y: driftState.y + 0.45,
                      z: driftState.z + cpRail.nz * railRes.railSide * 0.85,
                      vx: Math.cos(ang) * spd + cpRail.nx * railRes.railSide * 3.0,
                      vy: 2.8 + Math.random() * 4.2,
                      vz: Math.sin(ang) * spd,
                      size: 0.42,
                      w: 1.25,
                      h: 0.22,
                      gravity: 24,
                      rot: Math.random() * 6,
                      vRot: (Math.random() - 0.5) * 14,
                      life: 1.25,
                      color: isAdventureMode ? '#7c4a21' : bi % 2 === 0 ? breachBiome.railLight : '#475569',
                    });
                  }

                  if (isHighwayMode || dropFromRoad > 3.2 || getCarOverallIntegrity(activeDamageState) < 28) {
                    shouldCrashOut = true;
                  } else {
                    // Regular Adventure/Drift Mode: Break barrier & launch onto live OFF-ROAD terrain!
                    isOffRoad = true;
                    offRoadTreeHitCooldown = 0.22;
                    const alongS = (driftState.x - cpRail.x) * cpRail.tx + (driftState.z - cpRail.z) * cpRail.tz;
                    const outLat = railRes.railSide * (maxCenterLat + 1.15);
                    driftState.x = cpRail.x + cpRail.tx * alongS + cpRail.nx * outLat;
                    driftState.z = cpRail.z + cpRail.tz * alongS + cpRail.nz * outLat;
                    driftState.vx = driftState.vx * 0.78 + cpRail.nx * railRes.railSide * 2.2;
                    driftState.vz = driftState.vz * 0.78 + cpRail.nz * railRes.railSide * 2.2;
                    carAirborne = true;
                    carVy = Math.max(1.8, railRes.outwardSpeed * 0.32);
                    heroRollRad += railRes.railSide * 0.24;
                    cameraTrauma = Math.min(1, cameraTrauma + 0.62);
                    soundFX.playTrafficCrunch(0.68);
                    soundFX.playGuardrailSpark();
                    triggerHaptic('heavy', false, 'collision');
                    nearMissText = 'GUARDRAIL BROKEN · OFF-ROAD!';
                    nearMissTimer = 1.45;
                    pushCallout(driftState.x, driftState.y + 1.85, driftState.z, 'OFF-ROAD BREACH!', '#f59e0b', 1.15);
                  }
                } else {
                  const alongS = (driftState.x - cpRail.x) * cpRail.tx + (driftState.z - cpRail.z) * cpRail.tz;
                  driftState.x = cpRail.x + cpRail.tx * alongS + cpRail.nx * railRes.clampedLat;
                  driftState.z = cpRail.z + cpRail.tz * alongS + cpRail.nz * railRes.clampedLat;
                  driftState.vx = railRes.nextVx;
                  driftState.vz = railRes.nextVz;
                  driftState.heading = railRes.nextHeading;

                  if (railRes.outwardSpeed > 1.35) {
                    heroRollRad += railRes.railSide * Math.min(0.22, 0.08 + railRes.outwardSpeed * 0.012);
                    cameraTrauma = Math.min(1, cameraTrauma + Math.min(0.45, 0.16 + railRes.outwardSpeed * 0.025));
                    combo = Math.max(1, Math.floor(combo * 0.78));
                    if (sparkAudioCooldown <= 0) {
                      sparkAudioCooldown = 0.15;
                      soundFX.playGuardrailSpark();
                      triggerHaptic('medium', false, 'collision');
                    }
                    if (nearMissTimer <= 0.1) {
                      nearMissText = railRes.outwardSpeed >= 4.0 ? 'GUARDRAIL IMPACT!' : 'RAIL SCRAPE!';
                      nearMissTimer = 0.75;
                    }
                    for (let sp = 0; sp < 6; sp++) {
                      pushDebrisChunk({
                        x: driftState.x + cpRail.nx * railRes.railSide * 0.85,
                        y: driftState.y + 0.35,
                        z: driftState.z + cpRail.nz * railRes.railSide * 0.85,
                        vx: -cpRail.nx * railRes.railSide * (2 + Math.random() * 4),
                        vy: 2 + Math.random() * 3.5,
                        vz: -cpRail.nz * railRes.railSide * (2 + Math.random() * 4) + (Math.random() - 0.5) * 3,
                        size: 0.16,
                        rot: Math.random() * 4,
                        vRot: 10,
                        life: 0.32,
                        color: sp % 2 === 0 ? '#fef08a' : '#f97316',
                      });
                    }
                  }
                }
              }
            } else {
              // Currently driving OFF-ROAD outside the guardrail!
              if (Math.abs(roadCheck.signedPerpOffset) < cpRail.width * 0.45 && Math.abs(driftState.y - cpRail.y) < 1.6) {
                isOffRoad = false;
                nearMissText = 'BACK ON ROAD!';
                nearMissTimer = 0.9;
                pushCallout(driftState.x, driftState.y + 1.5, driftState.z, 'BACK ON TARMAC!', '#34d399', 0.85);
              } else {
                const advZoneOffNow = isAdventureMode ? resolveAdventureZone(distance, cpRail.index) : null;
                const offGroundNow = advZoneOffNow
                  ? sampleAdventureTerrainElevation(roadCheck.signedPerpOffset, driftState.z, cpRail.y, advZoneOffNow)
                  : sampleTerrainElevation(roadCheck.signedPerpOffset, driftState.z, resolveRoadBiome(effectiveRoadMode, distance).id);
                // Plunged into river gorge beneath wooden bridge or way out off cliff edge
                if (cpRail.y - offGroundNow > 4.2 || Math.abs(roadCheck.signedPerpOffset) > 28) {
                  crashReason = 'Off-Road Gorge Drop';
                  shouldCrashOut = true;
                } else if (offRoadTreeHitCooldown <= 0) {
                  // Collide solidly with roadside trees, rocks & buildings while driving off-road!
                  for (let pi = 0; pi < valleyProps.length; pi++) {
                    const pr = valleyProps[pi];
                    const pdx = driftState.x - pr.x;
                    const pdz = driftState.z - pr.z;
                    const hitRad = pr.variant === 2 ? 1.25 : 1.55;
                    if (pdx * pdx + pdz * pdz <= hitRad * hitRad) {
                      offRoadTreeHitCooldown = 0.48;
                      const sideBiasProp = pdx * cpRail.nx + pdz * cpRail.nz >= 0 ? 1 : -1;
                      const propDmg = applyImpactToCarDamage({
                        damage: activeDamageState,
                        impactZone: 'front',
                        severity: curSpeed >= 13 ? 0.92 : 0.56,
                        sideBias: sideBiasProp,
                      });
                      activeDamageState = propDmg.nextDamage;
                      onCarDamageChangeRef.current?.(activeDamageState);
                      if (propDmg.newlyDetached.length > 0) {
                        soundFX.playPartDetach(propDmg.newlyDetached.length);
                        for (let dp = 0; dp < propDmg.newlyDetached.length; dp++) {
                          spawnDetachedPart(
                            propDmg.newlyDetached[dp],
                            driftState.x,
                            driftState.y,
                            driftState.z,
                            driftState.vx * 0.4,
                            driftState.vz * 0.4,
                            driftState.y + 0.08,
                            currentAppearance.primaryColor,
                            currentCar.accentColor,
                            sideBiasProp
                          );
                        }
                      }
                      for (let lk = 0; lk < 12; lk++) {
                        const ang = Math.random() * Math.PI * 2;
                        pushDebrisChunk({
                          x: pr.x,
                          y: driftState.y + 0.9,
                          z: pr.z,
                          vx: Math.cos(ang) * (3 + Math.random() * 5),
                          vy: 2.5 + Math.random() * 4.5,
                          vz: Math.sin(ang) * (3 + Math.random() * 5),
                          size: 0.24 + Math.random() * 0.14,
                          gravity: 16,
                          rot: Math.random() * 6,
                          vRot: (Math.random() - 0.5) * 14,
                          life: 0.72,
                          color: lk % 2 === 0 ? '#4d7c0f' : '#78350f',
                        });
                      }
                      soundFX.playTrafficCrunch(0.75);
                      cameraTrauma = Math.min(1, cameraTrauma + 0.72);
                      triggerHaptic('heavy', false, 'collision');
                      driftState.vx = -driftState.vx * 0.35 + cpRail.nx * -Math.sign(roadCheck.signedPerpOffset || 1) * 3.0;
                      driftState.vz = -driftState.vz * 0.35;
                      if (curSpeed >= 15.0 || isCarTotaled(activeDamageState)) {
                        crashReason = 'Off-Road Obstacle Impact';
                        shouldCrashOut = true;
                      } else {
                        nearMissText = 'OFF-ROAD OBSTACLE HIT!';
                        nearMissTimer = 1.1;
                        pushCallout(driftState.x, driftState.y + 1.8, driftState.z, 'IMPACT!', '#ef4444', 0.95);
                      }
                      break;
                    }
                  }
                }
              }
            }
          } else if (isMountainMode && (!roadCheck.onRoad || mountainStepRes?.fellReason)) {
            shouldCrashOut = true;
          }

          if (shouldCrashOut) {
            {
              // STAGE 1: BREACHED GUARDRAIL OR FELL OFF MOUNTAIN CLIFF/CHASM -> Crumble, Shed Parts & Tumble
              isFalling = true;
              fallTimer = 0;
              groundImpacted = false;
              groundRestTimer = 0;
              crashReason =
                (isMountainMode && mountainStepRes?.fellReason) || 'Guardrail Breached';
              breachedSliceIdx = roadCheck.closestPoint ? roadCheck.closestPoint.index : -1;
              breachedSide = roadCheck.signedPerpOffset >= 0 ? 1 : -1;
              crashRoll = breachedSide * (isMountainMode ? 0.34 : 0.24);
              const launchSpeed = Math.hypot(driftState.vx, driftState.vz);
              fallVelX = driftState.vx * 0.86 + breachedSide * (isMountainMode ? 6.2 : 4.4);
              fallVelZ = driftState.vz * 0.86;
              fallVelY = isMountainMode
                ? Math.min(3.5, Math.max(-4.5, (mountainState?.vy ?? 0) * 0.6 + 2.2))
                : 3.8 + Math.min(2.6, launchSpeed * 0.09);
              crashBody = createCrashBody3D({
                x: driftState.x,
                y: driftState.y,
                z: driftState.z,
                vx: fallVelX,
                vy: fallVelY,
                vz: fallVelZ,
                yaw: 0,
                yawVel: breachedSide * (3.6 + Math.min(4.2, launchSpeed * 0.16)),
                roll: crashRoll,
                rollVel: breachedSide * (isMountainMode ? 3.8 : 2.7),
                pitch: -0.18,
                pitchVel: isMountainMode ? 2.4 : 1.5,
                bounceCount: 0,
                airborne: true,
              });
              hitstopTimer = isMountainMode ? 0.095 : 0.075;
              cameraTrauma = isMountainMode ? 1.0 : 0.92;
              screenFlashAlpha = isMountainMode ? 0.34 : 0.25;
              screenFlashColor = isMountainMode ? '#fca5a5' : '#e2e8f0';
              soundFX.playFallAndDestroy();
              triggerHaptic('heavy', false, 'collision');

              // Apply initial high-speed cliff / guardrail breach impact damage
              const railDmg = applyImpactToCarDamage({
                damage: activeDamageState,
                impactZone:
                  crashReason === 'Missed Mountain Jump'
                    ? 'front'
                    : breachedSide < 0
                    ? 'left'
                    : 'right',
                severity: isMountainMode ? 1.15 : 0.85,
                sideBias: breachedSide,
              });
              activeDamageState = railDmg.nextDamage;
              onCarDamageChangeRef.current?.(activeDamageState);
              const anchorStart = roadCheck.closestPoint;
              const curBiomeStart = resolveRoadBiome(roadModeRef.current, distance).id;
              const latStart = anchorStart ? roadCheck.signedPerpOffset : breachedSide * 10;
              const initFloorY = isMountainMode
                ? sampleMountainTerrainElevation(
                    latStart,
                    driftState.z,
                    mountainSurfaceNow ? mountainSurfaceNow.referenceGroundY : 0,
                    Boolean(anchorStart?.isChasmGap)
                  ) + 0.15
                : isAdventureMode
                ? sampleAdventureTerrainElevation(
                    latStart,
                    driftState.z,
                    anchorStart ? anchorStart.y : 0,
                    resolveAdventureZone(distance)
                  ) + 0.15
                : sampleTerrainElevation(latStart, driftState.z, curBiomeStart) + 0.15;
              if (railDmg.newlyDetached.length > 0) {
                soundFX.playPartDetach(railDmg.newlyDetached.length);
                for (let dp = 0; dp < railDmg.newlyDetached.length; dp++) {
                  spawnDetachedPart(
                    railDmg.newlyDetached[dp],
                    driftState.x,
                    driftState.y,
                    driftState.z,
                    fallVelX,
                    fallVelZ,
                    initFloorY,
                    currentAppearance.primaryColor,
                    currentCar.accentColor,
                    breachedSide
                  );
                }
              }
              if (launchSpeed >= 18 || isMountainMode) {
                spawnDetachedPart(
                  'wheel',
                  driftState.x,
                  driftState.y,
                  driftState.z,
                  fallVelX,
                  fallVelZ,
                  initFloorY,
                  currentAppearance.primaryColor,
                  currentAppearance.rimHex,
                  breachedSide
                );
              }
              if (isMountainMode) {
                spawnDetachedPart(
                  'front_bumper',
                  driftState.x,
                  driftState.y + 0.25,
                  driftState.z,
                  fallVelX * 0.9,
                  fallVelZ * 0.9,
                  initFloorY,
                  currentAppearance.primaryColor,
                  currentCar.accentColor,
                  -breachedSide
                );
                for (let sp = 0; sp < 10; sp++) {
                  pushSmokePuff({
                    x: driftState.x + (Math.random() - 0.5) * 1.4,
                    y: driftState.y + 0.45,
                    z: driftState.z + (Math.random() - 0.5) * 1.4,
                    vx: (Math.random() - 0.5) * 4.2,
                    vy: 1.5 + Math.random() * 2.5,
                    vz: (Math.random() - 0.5) * 4.2,
                    radius: 0.45,
                    maxRadius: 1.85,
                    life: 0.72,
                    maxLife: 0.72,
                    tint: sp % 2 === 0 ? 'dark' : 'steam',
                  });
                }
              }

              pushCallout(
                driftState.x,
                driftState.y + 1.6,
                driftState.z,
                isMountainMode
                  ? crashReason === 'Fell Into Mountain Chasm'
                    ? 'CHASM PLUNGE!'
                    : crashReason === 'Missed Mountain Jump'
                    ? 'CLIFF SLAM!'
                    : 'CLIFF FALL!'
                  : 'GUARDRAIL BREACH!',
                isMountainMode ? '#fb7185' : '#fbbf24',
                0.95
              );

              // Shatter Twisted Steel Guardrail Beams / Alpine Timber Posts + Metallic Sparks
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
                  gravity: 24,
                  rot: Math.random() * 6,
                  vRot: (Math.random() - 0.5) * 16,
                  life: 1.4,
                  color: isMountainMode
                    ? i % 2 === 0
                      ? '#92400e'
                      : '#78716c'
                    : i % 2 === 0
                    ? activeBiomeNow.railLight
                    : '#475569',
                });
              }
              for (let i = 0; i < 18; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 5 + Math.random() * 11;
                pushDebrisChunk({
                  x: driftState.x,
                  y: driftState.y + 0.6,
                  z: driftState.z,
                  vx: Math.cos(ang) * spd,
                  vy: 3 + Math.random() * 6,
                  vz: Math.sin(ang) * spd,
                  size: 0.22 + Math.random() * 0.24,
                  gravity: 22,
                  rot: Math.random() * 6,
                  vRot: (Math.random() - 0.5) * 18,
                  life: 0.65,
                  color: i % 2 === 0 ? '#fef08a' : '#f97316',
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
                triggerHaptic('medium', false, 'drift');

                const hitMilestone =
                  (prevCombo < 5 && combo >= 5) ||
                  (prevCombo < 10 && combo >= 10) ||
                  (prevCombo < 15 && combo >= 15) ||
                  (prevCombo < 20 && combo >= 20);
                if (hitMilestone) {
                  triggerHaptic('double', false, 'drift');
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
                if (!wasDrifting) {
                  triggerHaptic('light', false, 'drift');
                }

                const hitMilestone =
                  (prevCombo < 5 && combo >= 5) ||
                  (prevCombo < 10 && combo >= 10) ||
                  (prevCombo < 15 && combo >= 15) ||
                  (prevCombo < 20 && combo >= 20);
                if (hitMilestone) {
                  triggerHaptic('double', false, 'drift');
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
                soundFX.playFeverBurst();
                triggerHaptic('fever', false, 'drift');
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
                nearMissText = 'OVERDRIVE FEVER x2.5!';
                nearMissTimer = 1.6;
              }
            }

            if (hardRailScrape) {
              if (nearMissTimer <= 0) {
                nearMissText = `RAIL SCRAPE! +${Math.round(scoreDelta * 4)}`;
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
                triggerHaptic('heavy', false, 'collision');
              }
            }

            // Record Interactive Tire State (applied after camera lock-in so marks & smoke match exact pixel tires!)
            const simSpeedNow = Math.hypot(driftState.vx, driftState.vz);
            const activeTireId = currentCustom?.tires || 'stock';
            const isGasInputNow = (phase === 'playing' && !(keyDown || pedalBrakeRef.current)) || isFever;
            const isBrakeInputNow = (keyDown || pedalBrakeRef.current) && simSpeedNow > 4.5;
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

            const isDirtTrailRoost = (isMountainMode || isOffRoad) && !airborneFlagNow && simSpeedNow > 5.5;
            if (
              !airborneFlagNow &&
              (driftingNow || hardRailScrape || isBrakeInputNow || isLaunchBurnout || isRainMist || isDirtTrailRoost)
            ) {
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
                  isRainMist ? 0.48 : 0,
                  isDirtTrailRoost ? 0.62 : 0
                )
              );
            }

            // Check Coins, Nitro Star Gems & Boost Pads
            for (let i = 0; i < track.length; i++) {
              const pt = track[i];
              const yDiffOk = !isMountainMode || Math.abs(driftState.y - pt.y) <= 5.5;
              if (pt.hasCoin && !pt.coinCollected && yDiffOk) {
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

              if (pt.hasNitroCanister && !pt.canisterCollected) {
                const canX = pt.canisterX ?? pt.x;
                const canZ = pt.canisterZ ?? pt.z;
                const d = Math.hypot(driftState.x - canX, driftState.z - canZ);
                if (d <= 2.8 || (d <= stats.magnetRadius * 1.15 && d <= 3.6)) {
                  pt.canisterCollected = true;
                  fever = Math.min(100, fever + 35);
                  if (!isFever && fever >= 100) {
                    isFever = true;
                    feverTimer = 5.0;
                  } else if (isFever) {
                    feverTimer = Math.min(8.0, feverTimer + 3.0);
                  }
                  score += 500 * combo;
                  soundFX.playTurboChirp();
                  soundFX.playFeverBurst();
                  triggerHaptic('double');
                  spawnFloatingText(canX, pt.y + 1.2, canZ, '+NITRO BOOST!', '#00f0ff', 0.95);
                  pushCallout(canX, pt.y + 1.8, canZ, '+NITRO BOOST!', '#00f0ff', 1.25);
                  pushShockwave({
                    x: canX,
                    y: pt.y + 0.65,
                    z: canZ,
                    radius: 0.4,
                    maxRadius: 4.2,
                    color: '#00f0ff',
                    life: 0.38,
                    maxLife: 0.38,
                  });
                  for (let k = 0; k < 20; k++) {
                    const ang = (k / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                    const spd = 4.5 + Math.random() * 8.5;
                    pushDebrisChunk({
                      x: canX,
                      y: pt.y + 0.75,
                      z: canZ,
                      vx: Math.cos(ang) * spd,
                      vy: 2.8 + Math.random() * 5.2,
                      vz: Math.sin(ang) * spd,
                      size: 0.22 + Math.random() * 0.18,
                      gravity: 14,
                      rot: Math.random() * 6,
                      vRot: (Math.random() - 0.5) * 22,
                      life: 0.55,
                      color: k % 3 === 0 ? '#00f0ff' : k % 3 === 1 ? '#38bdf8' : '#e0f2fe',
                    });
                  }
                }
              }

              if (pt.hasBoostPad && !pt.boostTriggered) {
                const d = Math.hypot(driftState.x - pt.boostX, driftState.z - pt.boostZ);
                if (d <= 2.4) {
                  pt.boostTriggered = true;
                  fever = Math.min(100, fever + 45);
                  score += 150 * combo;
                  cameraTrauma = Math.min(1, cameraTrauma + 0.22);
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
              const extSlices = isMountainMode
                ? extendMountainTrack(track, 24, STEP_DIST, seed, curLevel ? curLevel.curveMultiplier : 1)
                : isHighwayMode
                ? extendHighwayTrack(track, 20, STEP_DIST, seed, activeTrackOpts)
                : extendSCurveTrack(track, 20, STEP_DIST, seed, activeTrackOpts);
              if (isAdventureMode) {
                applyAdventureElevationProfile(extSlices, STEP_DIST, seed);
              }
              for (let s = 0; s < extSlices.length; s++) track.push(extSlices[s]);
              while (track.length > 96 && track[0].z > driftState.z + 32) {
                track.shift();
              }
              populateTreesAround(driftState.z, isAdventureMode, isMountainMode);
            }

            // Handle Headlight Flash & Horn Triggers (alerts same-lane traffic to yield!)
            const wantFlash = pendingFlashRef.current;
            const wantHorn = pendingHornRef.current;
            pendingFlashRef.current = false;
            pendingHornRef.current = false;

            if (wantFlash) {
              highBeamTimer = 0.56;
              soundFX.playHeadlightFlash();
              screenFlashAlpha = Math.max(screenFlashAlpha, 0.06);
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
                    onMissionEventRef.current?.({ flash_yields: res.newlyFlashedCount });
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
                  if (res.newlyFlashedCount > 0) {
                    onMissionEventRef.current?.({ flash_yields: res.newlyFlashedCount });
                  }
                  nearMissText = 'HORN CLEAR · PASSING LANE!';
                  nearMissTimer = 1.1;
                }
              }
            }

            // 2-LANE HIGHWAY TRAFFIC SIMULATION (Overtakes, Near Misses, Yielding & Solid-Body Collisions!)
            if (isHighwayMode && roadCheck.closestPoint) {
              const cp = roadCheck.closestPoint;
              const playerS =
                cp.index * STEP_DIST +
                ((driftState.x - cp.x) * cp.tx + (driftState.z - cp.z) * cp.tz);

              stepTrafficCars(trafficCars, simDt);
              const curRoadHalfW = roadCheck.halfWidth || 4.9;
              resolveTrafficInterCarSpacing(trafficCars, curRoadHalfW);
              for (let ti = 0; ti < trafficCars.length; ti++) {
                const tc = trafficCars[ti];
                if (tc.crashed) {
                  const tcRes = stepTrafficCrashBody(tc, curRoadHalfW, simDt);
                  if (tcRes.hitRail || tcRes.bouncedGround) {
                    const tcSample = sampleTrackAtS(track, tc.s, STEP_DIST);
                    if (tcSample) {
                      const wx = tcSample.x + tcSample.nx * tc.lateralOffset;
                      const wy = tcSample.y + (tc.crashY ?? 0) + 0.35;
                      const wz = tcSample.z + tcSample.nz * tc.lateralOffset;
                      for (let sp = 0; sp < 8; sp++) {
                        const ang = Math.random() * Math.PI * 2;
                        const spd = 3 + Math.random() * 8;
                        pushDebrisChunk({
                          x: wx,
                          y: wy,
                          z: wz,
                          vx: Math.cos(ang) * spd,
                          vy: 2.5 + Math.random() * 4.5,
                          vz: Math.sin(ang) * spd,
                          size: 0.22 + Math.random() * 0.16,
                          gravity: 22,
                          rot: Math.random() * 6,
                          vRot: (Math.random() - 0.5) * 18,
                          life: 0.45,
                          color: sp % 2 === 0 ? '#fef08a' : '#fb923c',
                        });
                      }
                      soundFX.playGroundSlam(0.38);
                    }
                  }
                } else {
                  if (tc.crashRoll) tc.crashRoll *= Math.exp(-5.0 * simDt);
                  if (tc.crashYaw) tc.crashYaw *= Math.exp(-5.0 * simDt);
                }
              }

              const trafficEval = evaluateTrafficInteraction({
                playerS,
                playerLateralOffset: roadCheck.signedPerpOffset,
                trafficCars,
              });

              if (trafficEval.collidedCar) {
                const hit = trafficEval.collidedCar;
                const playerSpeedForward = driftState.vx * cp.tx + driftState.vz * cp.tz;
                const playerLateralVel = driftState.vx * cp.nx + driftState.vz * cp.nz;
                const playerMass =
                  currentCar.bodyShape === 'semi' || currentCar.bodyShape === 'truck' ? 2.15 : 1.32;
                const impulse = resolveTrafficCollisionImpulse({
                  playerSpeedForward,
                  playerLateralVel,
                  playerLateralOffset: roadCheck.signedPerpOffset,
                  playerMass,
                  car: hit,
                });

                const tDmg = evaluateSpeedGatedImpact({
                  damage: activeDamageState,
                  impactZone: impulse.isFatalCrash ? 'front' : impulse.sideBias < 0 ? 'right' : 'left',
                  impactSpeed: impulse.closingSpeed,
                  minDamageSpeed: 5.5,
                  highSpeedThreshold: hit.isOncoming ? 22.0 : 13.5,
                  hitQuality: Math.max(impulse.hitQuality, 0.45),
                  sideBias: impulse.sideBias,
                  allowTotaling: impulse.isFatalCrash || impulse.closingSpeed >= 13.5,
                });
                activeDamageState = tDmg.nextDamage;
                if (!impulse.isFatalCrash && impulse.closingSpeed >= 10.5) {
                  const crunchRes = applyImpactToCarDamage({
                    damage: activeDamageState,
                    impactZone: impulse.sideBias < 0 ? 'right' : 'left',
                    severity: Math.min(0.68, 0.25 + impulse.closingSpeed * 0.025),
                    sideBias: impulse.sideBias,
                  });
                  activeDamageState = crunchRes.nextDamage;
                  for (let cd = 0; cd < crunchRes.newlyDetached.length; cd++) {
                    if (!tDmg.newlyDetached.includes(crunchRes.newlyDetached[cd])) {
                      tDmg.newlyDetached.push(crunchRes.newlyDetached[cd]);
                    }
                  }
                }

                const fatalCrash = impulse.isFatalCrash || tDmg.isTotaled || isCarTotaled(activeDamageState);
                if (fatalCrash && !isCarTotaled(activeDamageState)) {
                  const wreckCrush = applyImpactToCarDamage({
                    damage: activeDamageState,
                    impactZone: 'ground_slam',
                    severity: 1.35,
                    sideBias: impulse.sideBias,
                  });
                  activeDamageState = wreckCrush.nextDamage;
                  for (let wd = 0; wd < wreckCrush.newlyDetached.length; wd++) {
                    if (!tDmg.newlyDetached.includes(wreckCrush.newlyDetached[wd])) {
                      tDmg.newlyDetached.push(wreckCrush.newlyDetached[wd]);
                    }
                  }
                }
                onCarDamageChangeRef.current?.(activeDamageState);

                if (!fatalCrash) {
                  // Glancing sideswipe or non-destructive bump: deflect both cars cleanly, keep racing!
                  hit.scrapeCooldown = 0.55;
                  hit.crashRoll = -impulse.sideBias * 0.22;
                  hit.crashYaw = -impulse.sideBias * 0.24;
                  hit.yieldingToSide = impulse.sideBias < 0 ? 1 : -1;
                  hit.yieldTimer = 1.4;
                  hit.targetLateralOffset = Math.max(
                    -4.1,
                    Math.min(4.1, hit.lateralOffset + impulse.trafficCrashVelLat * 0.18)
                  );

                  const nextFwd = Math.max(8, impulse.playerBounceVz);
                  driftState.vx = nextFwd * cp.tx + impulse.playerBounceVx * cp.nx;
                  driftState.vz = nextFwd * cp.tz + impulse.playerBounceVx * cp.nz;
                  cameraTrauma = Math.min(1, cameraTrauma + (tDmg.appliedSeverity > 0 ? 0.52 : 0.28));
                  heroRollRad += impulse.sideBias * 0.22;
                  combo = Math.max(1, Math.floor(combo * 0.5));
                  soundFX.playTrafficCrunch(tDmg.appliedSeverity > 0 ? 0.55 : 0.35);
                  triggerHaptic(tDmg.appliedSeverity > 0 ? 'medium' : 'light', false, 'collision');
                  const bumpTxt = tDmg.appliedSeverity > 0 ? 'SIDESWIPE!' : 'BUMP!';
                  nearMissText = bumpTxt;
                  nearMissTimer = 0.85;
                  pushCallout(
                    driftState.x,
                    driftState.y + 1.85,
                    driftState.z,
                    bumpTxt,
                    '#fb923c',
                    0.75
                  );
                  if (tDmg.newlyDetached.length > 0) {
                    soundFX.playPartDetach(tDmg.newlyDetached.length);
                    for (let dp = 0; dp < tDmg.newlyDetached.length; dp++) {
                      spawnDetachedPart(
                        tDmg.newlyDetached[dp],
                        driftState.x,
                        driftState.y,
                        driftState.z,
                        driftState.vx * 0.45,
                        driftState.vz * 0.45,
                        driftState.y + 0.04,
                        currentAppearance.primaryColor,
                        currentCar.accentColor,
                        impulse.sideBias
                      );
                    }
                  }
                  for (let k = 0; k < 16; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 4 + Math.random() * 9;
                    pushDebrisChunk({
                      x: driftState.x - impulse.sideBias * 0.65,
                      y: driftState.y + 0.42,
                      z: driftState.z,
                      vx: Math.cos(ang) * spd,
                      vy: 2.5 + Math.random() * 5,
                      vz: Math.sin(ang) * spd,
                      size: 0.2 + Math.random() * 0.18,
                      gravity: 22,
                      rot: Math.random() * 6,
                      vRot: (Math.random() - 0.5) * 16,
                      life: 0.48,
                      color: k % 2 === 0 ? '#fef08a' : '#fb923c',
                    });
                  }
                } else {
                  isTrafficCrash = true;
                  trafficCrashTimer = 0;
                  crashReason = hit.isOncoming ? 'Head-On Collision' : 'High-Speed Impact';
                  crashGroundY = driftState.y + 0.04;
                  crashRoll = impulse.sideBias * (hit.isOncoming ? 0.34 : 0.24);
                  hitstopTimer = 0.085;
                  cameraTrauma = 1.0;
                  screenFlashAlpha = 0.32;
                  screenFlashColor = '#f8fafc';
                  soundFX.playTrafficCrunch(hit.isOncoming ? 1.25 : 0.95);
                  triggerHaptic('heavy', false, 'collision');

                  hit.crashed = true;
                  hit.crashVs = impulse.trafficCrashSpeedS;
                  hit.crashVelLat = impulse.trafficCrashVelLat;
                  hit.crashVy = impulse.trafficCrashVy;
                  hit.crashY = 0.12;
                  hit.crashYaw = 0;
                  hit.crashYawVel = impulse.trafficYawVel;
                  hit.crashRoll = 0;
                  hit.crashRollVel = impulse.trafficRollVel;

                  const heroPostVx = impulse.playerBounceVz * cp.tx + impulse.playerBounceVx * cp.nx;
                  const heroPostVz = impulse.playerBounceVz * cp.tz + impulse.playerBounceVx * cp.nz;
                  driftState.vx = heroPostVx;
                  driftState.vz = heroPostVz;
                  crashBody = createCrashBody3D({
                    x: driftState.x,
                    y: driftState.y,
                    z: driftState.z,
                    vx: heroPostVx,
                    vy: impulse.playerBounceVy,
                    vz: heroPostVz,
                    yaw: 0,
                    yawVel: impulse.playerYawVel,
                    roll: 0,
                    rollVel: impulse.playerRollVel,
                    pitch: -0.22,
                    pitchVel: 1.9,
                    bounceCount: 0,
                    airborne: true,
                  });

                  if (tDmg.newlyDetached.length > 0) {
                    soundFX.playPartDetach(tDmg.newlyDetached.length);
                    for (let dp = 0; dp < tDmg.newlyDetached.length; dp++) {
                      spawnDetachedPart(
                        tDmg.newlyDetached[dp],
                        driftState.x,
                        driftState.y,
                        driftState.z,
                        heroPostVx * 0.45,
                        heroPostVz * 0.45,
                        crashGroundY,
                        currentAppearance.primaryColor,
                        currentCar.accentColor,
                        impulse.sideBias
                      );
                    }
                  }
                  if (impulse.impactSeverity >= 0.85) {
                    spawnDetachedPart(
                      'wheel',
                      driftState.x,
                      driftState.y,
                      driftState.z,
                      heroPostVx * 0.45,
                      heroPostVz * 0.45,
                      crashGroundY,
                      currentAppearance.primaryColor,
                      currentAppearance.rimHex,
                      impulse.sideBias
                    );
                  }

                  pushShockwave({
                    x: driftState.x,
                    y: driftState.y + 0.25,
                    z: driftState.z,
                    radius: 0.4,
                    maxRadius: 5.5,
                    color: '#cbd5e1',
                    life: 0.38,
                    maxLife: 0.38,
                  });
                  pushCallout(
                    driftState.x,
                    driftState.y + 2.1,
                    driftState.z,
                    hit.isOncoming ? 'HEAD-ON CRASH!' : 'HEAVY IMPACT!',
                    '#fbbf24',
                    0.95
                  );

                  // Glass shards, steel sparks & painted trim bits (Zero explosion fireballs!)
                  const crashChips = [
                    currentAppearance.primaryColor,
                    hit.color,
                    '#94a3b8',
                    '#bae6fd',
                    '#fef08a',
                    '#475569',
                  ];
                  for (let k = 0; k < 34; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 4 + Math.random() * 12;
                    const isShard = k < 10;
                    pushDebrisChunk({
                      x: driftState.x,
                      y: driftState.y + 0.5,
                      z: driftState.z,
                      vx: Math.cos(ang) * spd,
                      vy: 4 + Math.random() * 8,
                      vz: Math.sin(ang) * spd,
                      size: isShard ? 0.32 : 0.24 + Math.random() * 0.26,
                      w: isShard ? 0.55 : undefined,
                      h: isShard ? 0.28 : undefined,
                      gravity: 24,
                      rot: Math.random() * 6,
                      vRot: (Math.random() - 0.5) * 16,
                      life: 1.0,
                      color: crashChips[k % crashChips.length],
                    });
                  }
                  for (let k = 0; k < 12; k++) {
                    pushSmokePuff({
                      x: driftState.x + (Math.random() - 0.5) * 1.4,
                      y: driftState.y + 0.4,
                      z: driftState.z + (Math.random() - 0.5) * 1.4,
                      vx: (Math.random() - 0.5) * 4.5,
                      vy: 2.2 + Math.random() * 3.8,
                      vz: (Math.random() - 0.5) * 4.5,
                      radius: 0.65,
                      maxRadius: 2.3,
                      life: 0.78,
                      maxLife: 0.78,
                      tint: k % 3 === 0 ? 'dark' : 'steam',
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
                    cameraTrauma = Math.min(1, cameraTrauma + 0.16);
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
                  const diffProg = curLevel
                    ? Math.min(1, Math.max(0, (curLevel.trafficDensity - 0.55) * 0.75 + (distance / curLevel.targetDistance) * 0.35))
                    : Math.min(1, distance / 1800);
                  const batch = generateTrafficBatch({
                    startS: trafficSpawnCursor,
                    endS: playerS + 290,
                    nextIdStart: nextTrafficId,
                    seed,
                    existingCars: trafficCars,
                    difficultyProgress: diffProg,
                    mode: effectiveMode,
                    recentRunRanks: recentRunRanksRef.current,
                  });
                  for (let b = 0; b < batch.cars.length; b++) trafficCars.push(batch.cars[b]);
                  nextTrafficId = batch.nextId;
                  trafficSpawnCursor = playerS + 290;
                }
              }

              // Unconditional solid-body OBB separation against ALL traffic cars (prevents ghosting during cooldowns/crashes)
              const solidPlayerLatNow =
                (driftState.x - cp.x) * cp.nx + (driftState.z - cp.z) * cp.nz;
              const solidPlayerSNow =
                cp.index * STEP_DIST +
                ((driftState.x - cp.x) * cp.tx + (driftState.z - cp.z) * cp.tz);
              const solidFwdVel = driftState.vx * cp.tx + driftState.vz * cp.tz;
              const solidLatVel = driftState.vx * cp.nx + driftState.vz * cp.nz;
              const solidPlayerMass =
                currentCar.bodyShape === 'semi' || currentCar.bodyShape === 'truck' ? 2.15 : 1.32;
              const solidRes = resolveHighwayTrafficSolidPass({
                playerS: solidPlayerSNow,
                playerLat: solidPlayerLatNow,
                playerHeadingRelRoad: normalizeAngle(driftState.heading - cp.heading),
                playerFwdVel: solidFwdVel,
                playerLatVel: solidLatVel,
                playerMass: solidPlayerMass,
                roadHalfWidth: curRoadHalfW,
                trafficCars,
              });
              if (solidRes.primaryCar) {
                const baseAlongS = solidRes.nextPlayerS - cp.index * STEP_DIST;
                driftState.x = cp.x + cp.tx * baseAlongS + cp.nx * solidRes.nextPlayerLat;
                driftState.z = cp.z + cp.tz * baseAlongS + cp.nz * solidRes.nextPlayerLat;
                driftState.vx = cp.tx * solidRes.nextPlayerFwdVel + cp.nx * solidRes.nextPlayerLatVel;
                driftState.vz = cp.tz * solidRes.nextPlayerFwdVel + cp.nz * solidRes.nextPlayerLatVel;
                if (isTrafficCrash) {
                  crashBody.x = driftState.x;
                  crashBody.z = driftState.z;
                  crashBody.vx = driftState.vx;
                  crashBody.vz = driftState.vz;
                } else if (
                  !trafficEval.collidedCar &&
                  (!solidRes.primaryCar.scrapeCooldown || solidRes.primaryCar.scrapeCooldown <= 0) &&
                  solidRes.impactSpeed > 1.2
                ) {
                  solidRes.primaryCar.scrapeCooldown = 0.35;
                  soundFX.playTrafficCrunch(0.28);
                  cameraTrauma = Math.min(1, cameraTrauma + 0.16);
                }
              }
            }
        }
        }
        // End of Drift/Highway branch; Parking branch handled above.

        if (isFalling && simDt > 0) {
          // STAGE 2 & 3: 3D Rigid-Body Valley / Mountain Tumble -> Sloped Terrain Bounce & Skid
          fallTimer += simDt;
          const anchorNow = findClosestTrackAnchor(driftState.z);
          const curBiomeNow = resolveRoadBiome(roadModeRef.current, distance);
          const latOffsetNow = anchorNow
            ? (driftState.x - anchorNow.x) * anchorNow.nx + (driftState.z - anchorNow.z) * anchorNow.nz
            : breachedSide * 10;
          const advZoneCrash = isAdventureMode ? resolveAdventureZone(distance) : null;
          const mtnRefY = anchorNow
            ? anchorNow.isChasmGap
              ? anchorNow.y - 3.2
              : anchorNow.y
            : 0;
          const mtnInChasm = Boolean(anchorNow?.isChasmGap);
          crashGroundY =
            (isMountainMode
              ? sampleMountainTerrainElevation(latOffsetNow, driftState.z, mtnRefY, mtnInChasm)
              : advZoneCrash
              ? sampleAdventureTerrainElevation(
                  latOffsetNow,
                  driftState.z,
                  anchorNow ? anchorNow.y : 0,
                  advZoneCrash
                )
              : sampleTerrainElevation(latOffsetNow, driftState.z, curBiomeNow.id)) + 0.18;
          const groundSlopeX =
            ((isMountainMode
              ? sampleMountainTerrainElevation(latOffsetNow + 0.6, driftState.z, mtnRefY, mtnInChasm)
              : advZoneCrash
              ? sampleAdventureTerrainElevation(
                  latOffsetNow + 0.6,
                  driftState.z,
                  anchorNow ? anchorNow.y : 0,
                  advZoneCrash
                )
              : sampleTerrainElevation(latOffsetNow + 0.6, driftState.z, curBiomeNow.id)) -
              (isMountainMode
                ? sampleMountainTerrainElevation(latOffsetNow - 0.6, driftState.z, mtnRefY, mtnInChasm)
                : advZoneCrash
                ? sampleAdventureTerrainElevation(
                    latOffsetNow - 0.6,
                    driftState.z,
                    anchorNow ? anchorNow.y : 0,
                    advZoneCrash
                  )
                : sampleTerrainElevation(latOffsetNow - 0.6, driftState.z, curBiomeNow.id))) /
            1.2;

          const stepRes = stepCrashBody3D(crashBody, crashGroundY, groundSlopeX, simDt);
          driftState.x = crashBody.x;
          driftState.y = crashBody.y;
          driftState.z = crashBody.z;
          fallVelX = crashBody.vx;
          fallVelY = crashBody.vy;
          fallVelZ = crashBody.vz;
          fallRotation = Math.max(-0.85, Math.min(0.85, crashBody.roll));

          if (stepRes.impactedGround) {
            if (crashBody.bounceCount === 1) {
              groundImpacted = true;
              groundRestTimer = 0;
              hitstopTimer = isMountainMode ? 0.085 : 0.065;
              cameraTrauma = 1.0;
              screenFlashAlpha = isMountainMode ? 0.36 : 0.28;
              screenFlashColor = isMountainMode ? '#fca5a5' : '#e2e8f0';
              soundFX.playGroundSlam(isMountainMode ? 1.35 : 1.2);
              triggerHaptic('heavy', false, 'collision');

              const slamDmg = applyImpactToCarDamage({
                damage: activeDamageState,
                impactZone: 'ground_slam',
                severity: isMountainMode ? 1.65 : 1.32,
                sideBias: breachedSide,
              });
              activeDamageState = slamDmg.nextDamage;
              if (isMountainMode) {
                const extraCrumb = applyImpactToCarDamage({
                  damage: activeDamageState,
                  impactZone: 'front',
                  severity: 1.05,
                  sideBias: -breachedSide,
                });
                activeDamageState = extraCrumb.nextDamage;
                for (let ec = 0; ec < extraCrumb.newlyDetached.length; ec++) {
                  if (!slamDmg.newlyDetached.includes(extraCrumb.newlyDetached[ec])) {
                    slamDmg.newlyDetached.push(extraCrumb.newlyDetached[ec]);
                  }
                }
              }
              onCarDamageChangeRef.current?.(activeDamageState);
              if (slamDmg.newlyDetached.length > 0) {
                soundFX.playPartDetach(slamDmg.newlyDetached.length);
                for (let dp = 0; dp < slamDmg.newlyDetached.length; dp++) {
                  spawnDetachedPart(
                    slamDmg.newlyDetached[dp],
                    driftState.x,
                    driftState.y,
                    driftState.z,
                    fallVelX,
                    fallVelZ,
                    crashGroundY,
                    currentAppearance.primaryColor,
                    currentCar.accentColor,
                    dp % 2 === 0 ? breachedSide : -breachedSide
                  );
                }
              }
              spawnDetachedPart(
                'wheel',
                driftState.x,
                driftState.y,
                driftState.z,
                fallVelX,
                fallVelZ,
                crashGroundY,
                currentAppearance.primaryColor,
                currentAppearance.rimHex,
                -breachedSide
              );
              if (isMountainMode) {
                spawnDetachedPart(
                  'wheel',
                  driftState.x,
                  driftState.y + 0.35,
                  driftState.z,
                  fallVelX * 0.7,
                  fallVelZ * 0.7,
                  crashGroundY,
                  currentAppearance.primaryColor,
                  currentAppearance.rimHex,
                  breachedSide
                );
              }

              const dustRingCol = isMountainMode
                ? '#f97316'
                : curBiomeNow.id === 'canyon'
                ? '#ea580c'
                : '#d6d3d1';
              pushShockwave({
                x: driftState.x,
                y: crashGroundY + 0.15,
                z: driftState.z,
                radius: 0.7,
                maxRadius: isMountainMode ? 10.2 : 8.4,
                color: dustRingCol,
                life: 0.56,
                maxLife: 0.56,
              });
              pushCallout(
                driftState.x,
                driftState.y + 2.2,
                driftState.z,
                isMountainMode ? 'WRECKED ON THE CLIFF!' : 'GROUND IMPACT!',
                isMountainMode ? '#fb7185' : '#f8fafc',
                1.0
              );

              const groundPalette = [
                currentAppearance.primaryColor,
                currentCar.accentColor,
                '#78716c',
                '#475569',
                '#f97316',
                '#fef08a',
              ];
              for (let i = 0; i < (isMountainMode ? 52 : 42); i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 4 + Math.random() * 14;
                const isScrap = i < (isMountainMode ? 15 : 10);
                pushDebrisChunk({
                  x: driftState.x,
                  y: crashGroundY + 0.35,
                  z: driftState.z,
                  vx: Math.cos(ang) * spd,
                  vy: 4 + Math.random() * 9.5,
                  vz: Math.sin(ang) * spd,
                  size: isScrap ? 0.48 : 0.28 + Math.random() * 0.34,
                  w: isScrap ? 0.84 : undefined,
                  h: isScrap ? 0.38 : undefined,
                  gravity: 26,
                  rot: Math.random() * 6,
                  vRot: (Math.random() - 0.5) * 16,
                  life: 1.25,
                  color: groundPalette[i % groundPalette.length],
                });
              }

              for (let i = 0; i < (isMountainMode ? 26 : 20); i++) {
                pushSmokePuff({
                  x: driftState.x + (Math.random() - 0.5) * 2.4,
                  y: crashGroundY + 0.4,
                  z: driftState.z + (Math.random() - 0.5) * 2.4,
                  vx: (Math.random() - 0.5) * 7.5,
                  vy: 1.8 + Math.random() * 4.5,
                  vz: (Math.random() - 0.5) * 7.5,
                  radius: 0.85,
                  maxRadius: 3.1,
                  life: 0.96,
                  maxLife: 0.96,
                  tint: i % 3 === 0 ? 'dark' : i % 3 === 1 ? 'steam' : 'dust',
                });
              }
            } else {
              cameraTrauma = Math.min(1, cameraTrauma + 0.48);
              soundFX.playGroundSlam(0.6);
              for (let i = 0; i < 12; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 3 + Math.random() * 7;
                pushDebrisChunk({
                  x: driftState.x,
                  y: crashGroundY + 0.25,
                  z: driftState.z,
                  vx: Math.cos(ang) * spd,
                  vy: 2.5 + Math.random() * 5,
                  vz: Math.sin(ang) * spd,
                  size: 0.24 + Math.random() * 0.18,
                  gravity: 24,
                  rot: Math.random() * 6,
                  vRot: (Math.random() - 0.5) * 14,
                  life: 0.65,
                  color: i % 2 === 0 ? '#f97316' : '#78716c',
                });
              }
            }
          }

          if (!crashBody.airborne) {
            const slideSpd = Math.hypot(crashBody.vx, crashBody.vz);
            if (slideSpd > 2.5) {
              const yawRad = driftState.heading + crashBody.yaw;
              const rx = -Math.sin(yawRad) * 0.72;
              const rz = Math.cos(yawRad) * 0.72;
              pushSkidMark(
                driftState.x - rx,
                driftState.z - rz,
                driftState.x + rx,
                driftState.z + rz,
                crashGroundY + 0.04,
                true,
                1.25,
                0.72,
                '#292524',
                breachedSide >= 0 ? 1 : -1
              );
              if (Math.random() < 0.6) {
                pushSmokePuff({
                  x: driftState.x + (Math.random() - 0.5) * 1.2,
                  y: crashGroundY + 0.35,
                  z: driftState.z + (Math.random() - 0.5) * 1.2,
                  vx: (Math.random() - 0.5) * 2.5,
                  vy: 1.4 + Math.random() * 2.4,
                  vz: (Math.random() - 0.5) * 2.5,
                  radius: 0.55,
                  maxRadius: 2.1,
                  life: 0.72,
                  maxLife: 0.72,
                  tint: 'dust',
                });
              }
            }
          }

          if (groundImpacted) {
            if (Math.random() < (isMountainMode ? 0.7 : 0.45)) {
              pushSmokePuff({
                x: driftState.x + (Math.random() - 0.5) * 0.8,
                y: driftState.y + 0.55,
                z: driftState.z + (Math.random() - 0.5) * 0.8,
                vx: (Math.random() - 0.5) * 1.4,
                vy: 2.4 + Math.random() * 2.4,
                vz: (Math.random() - 0.5) * 1.4,
                radius: isMountainMode ? 0.48 : 0.35,
                maxRadius: isMountainMode ? 1.85 : 1.45,
                life: 0.75,
                maxLife: 0.75,
                tint: isMountainMode && Math.random() < 0.55 ? 'dark' : 'steam',
              });
            }
            if (stepRes.justSettled || Math.hypot(crashBody.vx, crashBody.vz) < 4.5 || fallTimer > 2.2) {
              groundRestTimer += simDt;
              if (groundRestTimer >= (isMountainMode ? 0.95 : 0.72)) {
                if (!isCarTotaled(activeDamageState)) {
                  activeDamageState = applyImpactToCarDamage({
                    damage: activeDamageState,
                    impactZone: 'ground_slam',
                    severity: 1.35,
                    sideBias: breachedSide,
                  }).nextDamage;
                  onCarDamageChangeRef.current?.(activeDamageState);
                }
                finalizeGameOver(crashReason);
              }
            }
          } else if (fallTimer >= (isMountainMode ? 3.5 : 3.0)) {
            if (!isCarTotaled(activeDamageState)) {
              activeDamageState = applyImpactToCarDamage({
                damage: activeDamageState,
                impactZone: 'ground_slam',
                severity: 1.35,
                sideBias: breachedSide,
              }).nextDamage;
              onCarDamageChangeRef.current?.(activeDamageState);
            }
            finalizeGameOver(crashReason);
          }
        } else if (isTrafficCrash && simDt > 0) {
          trafficCrashTimer += simDt;
          // Keep knocked traffic cars tumbling & bouncing off rails during crash slow-mo
          if (isHighwayMode) {
            for (let ti = 0; ti < trafficCars.length; ti++) {
              const tc = trafficCars[ti];
              if (tc.crashed) {
                const tcRes = stepTrafficCrashBody(tc, HIGHWAY_ROAD_WIDTH * 0.5, simDt);
                if (tcRes.hitRail || tcRes.bouncedGround) {
                  const tcSample = sampleTrackAtS(track, tc.s, STEP_DIST);
                  if (tcSample) {
                    const wx = tcSample.x + tcSample.nx * tc.lateralOffset;
                    const wy = tcSample.y + (tc.crashY ?? 0) + 0.35;
                    const wz = tcSample.z + tcSample.nz * tc.lateralOffset;
                    for (let sp = 0; sp < 7; sp++) {
                      const ang = Math.random() * Math.PI * 2;
                      const spd = 3 + Math.random() * 8;
                      pushDebrisChunk({
                        x: wx,
                        y: wy,
                        z: wz,
                        vx: Math.cos(ang) * spd,
                        vy: 2.5 + Math.random() * 4.5,
                        vz: Math.sin(ang) * spd,
                        size: 0.22 + Math.random() * 0.16,
                        gravity: 22,
                        rot: Math.random() * 6,
                        vRot: (Math.random() - 0.5) * 18,
                        life: 0.45,
                        color: sp % 2 === 0 ? '#fef08a' : '#fb923c',
                      });
                    }
                    soundFX.playGroundSlam(0.35);
                  }
                }
              }
            }
          }

          const roadCheckNow = evaluateCarOnSCurveRoad(driftState.x, driftState.z, track, 6);
          const cpNow = roadCheckNow.closestPoint;
          const latOff = roadCheckNow.signedPerpOffset;
          const hw = roadCheckNow.halfWidth || 4.9;
          if (cpNow) {
            crashGroundY = cpNow.y + 0.04;
            const maxCrashCenterLat = Math.max(1.1, hw - 0.86);
            if (Math.abs(latOff) > maxCrashCenterLat) {
              // Keep wrecked car contained solidly inside steel highway guardrails with sparks
              const sign = latOff >= 0 ? 1 : -1;
              const alongS = (crashBody.x - cpNow.x) * cpNow.tx + (crashBody.z - cpNow.z) * cpNow.tz;
              const clampedCrashLat = sign * maxCrashCenterLat;
              crashBody.x = cpNow.x + cpNow.tx * alongS + cpNow.nx * clampedCrashLat;
              crashBody.z = cpNow.z + cpNow.tz * alongS + cpNow.nz * clampedCrashLat;
              driftState.x = crashBody.x;
              driftState.z = crashBody.z;
              const latVel = crashBody.vx * cpNow.nx + crashBody.vz * cpNow.nz;
              if (latVel * sign > 0) {
                crashBody.vx -= cpNow.nx * latVel * 1.48;
                crashBody.vz -= cpNow.nz * latVel * 1.48;
                crashBody.yawVel = -crashBody.yawVel * 0.65;
                cameraTrauma = Math.min(1, cameraTrauma + 0.32);
                if (sparkAudioCooldown <= 0) {
                  sparkAudioCooldown = 0.15;
                  soundFX.playGuardrailSpark();
                }
                for (let sp = 0; sp < 8; sp++) {
                  const ang = Math.random() * Math.PI * 2;
                  const spd = 3 + Math.random() * 8;
                  pushDebrisChunk({
                    x: driftState.x,
                    y: driftState.y + 0.4,
                    z: driftState.z,
                    vx: Math.cos(ang) * spd,
                    vy: 2.5 + Math.random() * 4.5,
                    vz: Math.sin(ang) * spd,
                    size: 0.2 + Math.random() * 0.16,
                    gravity: 22,
                    rot: Math.random() * 6,
                    vRot: (Math.random() - 0.5) * 16,
                    life: 0.45,
                    color: sp % 2 === 0 ? '#fef08a' : '#fb923c',
                  });
                }
              }
            }
          }

          if (isTrafficCrash) {
            const tStep = stepCrashBody3D(crashBody, crashGroundY, 0, simDt);
            driftState.x = crashBody.x;
            driftState.y = crashBody.y;
            driftState.z = crashBody.z;
            driftState.vx = crashBody.vx;
            driftState.vz = crashBody.vz;
            fallRotation = Math.max(-0.55, Math.min(0.55, crashBody.roll));
            if (tStep.impactedGround) {
              soundFX.playGroundSlam(0.45);
              for (let sp = 0; sp < 10; sp++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 3 + Math.random() * 8;
                pushDebrisChunk({
                  x: driftState.x,
                  y: crashGroundY + 0.2,
                  z: driftState.z,
                  vx: Math.cos(ang) * spd,
                  vy: 2 + Math.random() * 4.5,
                  vz: Math.sin(ang) * spd,
                  size: 0.2 + Math.random() * 0.16,
                  gravity: 22,
                  rot: Math.random() * 6,
                  vRot: (Math.random() - 0.5) * 16,
                  life: 0.48,
                  color: sp % 2 === 0 ? '#fef08a' : '#94a3b8',
                });
              }
            }
            if (!crashBody.airborne && Math.hypot(crashBody.vx, crashBody.vz) > 3.0) {
              const yawRad = driftState.heading + crashBody.yaw;
              const rx = -Math.sin(yawRad) * 0.72;
              const rz = Math.cos(yawRad) * 0.72;
              pushSkidMark(
                driftState.x - rx,
                driftState.z - rz,
                driftState.x + rx,
                driftState.z + rz,
                crashGroundY + 0.03,
                true,
                1.2,
                0.78,
                '#11141c',
                1
              );
            }
            if (Math.random() < 0.55) {
              pushSmokePuff({
                x: driftState.x + (Math.random() - 0.5) * 0.8,
                y: driftState.y + 0.45,
                z: driftState.z + (Math.random() - 0.5) * 0.8,
                vx: (Math.random() - 0.5) * 1.8,
                vy: 2.1 + Math.random() * 2.4,
                vz: (Math.random() - 0.5) * 1.8,
                radius: 0.40,
                maxRadius: 1.55,
                life: 0.56,
                maxLife: 0.56,
                tint: Math.random() > 0.3 ? 'steam' : 'dark',
              });
            }
            if (trafficCrashTimer >= 1.25) {
              finalizeGameOver(crashReason);
            }
          }
        }

        // Smooth camera follow (frame highway, parking lot, drifting apex, AND follow falling car down to the ground!)
        if (isParkingMode && parkingState && parkingStages.length > 0) {
          camFocusX += (parkingState.x * 0.72 - camFocusX) * Math.min(1, 5.5 * dt);
          camFocusY += (0 - camFocusY) * Math.min(1, 8 * dt);
          camFocusZ += ((parkingState.z - 2.0) - camFocusZ) * Math.min(1, 6.2 * dt);
          const headingYawLead = Math.max(-0.22, Math.min(0.22, Math.sin(parkingState.heading + Math.PI * 0.5) * 0.14));
          camHeading += ((-Math.PI / 2 + headingYawLead) - camHeading) * Math.min(1, 4.5 * dt);
        } else {
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
          if (isFalling) {
            const targetFallCamY = Math.max(crashGroundY + 0.4, driftState.y + 0.75);
            camFocusY += (targetFallCamY - camFocusY) * Math.min(1, 7.5 * dt);
          } else if (isMountainMode) {
            const mtnSurfCam = sampleMountainSurface(
              driftState.x,
              driftState.z,
              track,
              STEP_DIST,
              stats.roadAllowanceBonus
            );
            const mtnCpCam = mtnSurfCam.closestPoint;
            const mtnAheadPt = mtnCpCam
              ? track[Math.min(track.length - 1, Math.max(0, (mtnCpCam.index - (track[0]?.index ?? 0)) + 3))]
              : null;
            const mtnCamGoal = computeMountainCameraTarget({
              carY: driftState.y,
              carVy: mountainState?.vy ?? carVy,
              roadSlope: (mountainState?.currentSlopePct || 0) / 100,
              isAirborne: Boolean(mountainState?.isAirborne),
              inChasmGap: mtnSurfCam.inChasmGap,
              referenceGroundY: mtnSurfCam.referenceGroundY,
              roadY: mtnSurfCam.roadY,
              aheadRoadY: mtnAheadPt ? mtnAheadPt.y : undefined,
              isTitle: false,
            });
            camFocusY += (mtnCamGoal.focusY - camFocusY) * Math.min(1, (mountainState?.isAirborne ? 7.2 : 10.5) * dt);
          } else {
            const heroAltNow = Math.max(0, driftState.y - carGroundY);
            const targetCamY =
              heroAltNow > 0.05 ? carGroundY * 0.45 + driftState.y * 0.55 : driftState.y;
            camFocusY += (targetCamY - camFocusY) * Math.min(1, (heroAltNow > 0.05 ? 5.8 : 10) * dt);
          }
          camFocusZ += (targetCamZ - camFocusZ) * Math.min(1, 11 * dt);
        }

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
          const kmhRounded = Math.round(speedNow * (isParkingMode ? 3.6 : 7.2));
          const mJumps = mountainState?.jumpsCleared ?? 0;
          const mSlope = mountainState?.currentSlopePct ?? 0;
          const mAir = mountainState?.isAirborne ?? false;
          if (
            isParkingMode ||
            (isMountainMode && (mAir || mJumps !== lastHudJumps || mSlope !== lastHudSlope || mAir !== lastHudAirborne)) ||
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
            lastHudJumps = mJumps;
            lastHudSlope = mSlope;
            lastHudAirborne = mAir;
            const activeBiome = resolveRoadBiome(effectiveRoadMode, distance);
            const activeAdvName = isMountainMode
              ? 'Alpine Peaks'
              : isAdventureMode
              ? resolveAdventureZone(distance).chapter.name
              : activeBiome.name;
            const curSt = isParkingMode && parkingStages.length > 0 ? parkingStages[parkingStageIdx] : null;
            const baySt = curSt && parkingState ? evaluateParkingBayStatus(parkingState, curSt) : null;
            const prox = curSt && parkingState ? evaluateParkingProximity(parkingState, curSt) : null;
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
              biomeName: activeAdvName,
              overtakes,
              nearMisses,
              mountain:
                isMountainMode && mountainState
                  ? {
                      jumpsCleared: mountainState.jumpsCleared,
                      bestAirTimeSec: Number(mountainState.bestAirTimeSec.toFixed(2)),
                      currentPeakNum: mountainState.currentPeakNum,
                      currentSlopePct: mountainState.currentSlopePct,
                      isAirborne: mountainState.isAirborne,
                      airTimeSec: Number(mountainState.airTimeSec.toFixed(2)),
                    }
                  : undefined,
              parking:
                curSt && parkingState && baySt && prox
                  ? {
                      stageNum: parkingStageIdx + 1,
                      totalStages: parkingStages.length,
                      stageTitle: curSt.title,
                      subtitle: curSt.subtitle,
                      instruction: curSt.instruction,
                      maneuverType: curSt.maneuverType,
                      gear: parkingState.gear,
                      distM: baySt.centerDistM,
                      angleErrDeg: baySt.headingErrorDeg,
                      hits: parkingHits,
                      maxHits: PARKING_MAX_HITS,
                      lockProgress: parkingLockTimer,
                      isInsideBox: baySt.isInsideBox,
                      isAligned: baySt.isAligned,
                      gatesCleared: curSt.slalomGates.filter((g) => g.passed).length,
                      gatesTotal: curSt.slalomGates.length,
                      proximity: prox,
                      carX: parkingState.x,
                      carZ: parkingState.z,
                      carHeading: parkingState.heading,
                      steerAngle: parkingState.steerAngle,
                      bayX: curSt.targetBay.x,
                      bayZ: curSt.targetBay.z,
                      bayHeading: curSt.targetBay.heading,
                      bayW: curSt.targetBay.width,
                      bayL: curSt.targetBay.length,
                      nearbyCars: curSt.parkedCars.map((c) => ({
                        x: c.x,
                        z: c.z,
                        heading: c.heading,
                        hw: c.halfWidth,
                        hl: c.halfLength,
                      })),
                      nearbyCones: curSt.cones.map((c) => ({
                        x: c.x,
                        z: c.z,
                        knocked: c.knocked,
                      })),
                      nearbyBarriers: curSt.barriers.map((b) => ({
                        x: b.x,
                        z: b.z,
                        hw: b.halfW,
                        hl: b.halfL,
                        heading: b.heading,
                      })),
                    }
                  : undefined,
            });
          }
        }
      }

      // ============================================================
      // 5. RENDER PIXEL-ART WORLD DIRECTLY ONTO GPU-SCALED CANVAS
      // ============================================================
      const rawBiome = resolveRoadBiome(effectiveRoadMode, distance);
      const sky = resolveSkyAtmosphere(effectiveSkyMode, rawBiome);
      Object.assign(biome, rawBiome);
      biome.isNight = sky.isNight;
      ensureBiomeLayers(biome, sky);

      cameraTrauma = Math.max(0, cameraTrauma - dt * 2.1);
      if (screenFlashAlpha > 0) screenFlashAlpha = Math.max(0, screenFlashAlpha - dt * 2.4);
      const shakeMag = cameraTrauma * cameraTrauma * 9 * HD_UI_SCALE * (shakeMultiplierRef.current ?? 1.0);
      const shakeX = (Math.sin(now * 0.043) * 0.65 + Math.cos(now * 0.071) * 0.35) * shakeMag;
      const shakeY = (Math.cos(now * 0.051) * 0.65 + Math.sin(now * 0.063) * 0.35) * shakeMag;

      const isPortrait = pxW < pxH;
      const curSpeedVal = Math.hypot(driftState.vx, driftState.vz);
      const speedRushFactor = Math.max(0, Math.min(1, (curSpeedVal - 20) / 16));
      const pedalFovShift =
        phase === 'playing' && !isParkingMode
          ? keyDown || pedalBrakeRef.current
            ? -0.014
            : keyUp || pedalGasRef.current
            ? 0.015
            : 0
          : 0;
      const fovScale = pxH * (isPortrait ? 0.74 + speedRushFactor * 0.05 + pedalFovShift : 0.90 + speedRushFactor * 0.06 + pedalFovShift);
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

      const isAirborneRender = carAirborne || Boolean(isMountainMode && mountainState?.isAirborne);
      const mtnCamMetrics = isMountainMode
        ? computeMountainCameraTarget({
            carY: driftState.y,
            carVy: mountainState?.vy ?? carVy,
            roadSlope: activeRoadSlope,
            isAirborne: isAirborneRender,
            inChasmGap: false,
            referenceGroundY: driftState.y,
            roadY: driftState.y,
            isTitle: phase === 'title',
            speedZoom: camSpeedZoom,
          })
        : null;
      const airPitchSlopeShift = isAirborneRender
        ? -Math.max(-0.22, Math.min(0.22, carVy / Math.max(12, curSpeedVal))) * 0.22
        : 0;
      const targetCamPitchSlope = isParkingMode
        ? 0.068
        : mtnCamMetrics
        ? mtnCamMetrics.pitchSlope
        : Math.max(-0.14, Math.min(0.26, 0.068 - activeRoadSlope * 0.42 + airPitchSlopeShift));
      fCamPitchSlope += (targetCamPitchSlope - fCamPitchSlope) * Math.min(1, 7.5 * dt);

      const baseDistBack = isParkingMode
        ? 12.4
        : mtnCamMetrics
        ? mtnCamMetrics.camDistBack
        : (isHighwayMode ? 9.4 : 8.4) + camSpeedZoom * 0.85;
      const camDistBack = phase === 'title' && !isParkingMode && !mtnCamMetrics ? baseDistBack + 2.0 : baseDistBack;
      const camHeight = isParkingMode
        ? 5.05
        : mtnCamMetrics
        ? mtnCamMetrics.camHeight
        : phase === 'title'
        ? isHighwayMode
          ? 2.35
          : 2.15
        : isHighwayMode
        ? 4.35
        : 3.85;
      const camSideSwing = isParkingMode ? 0 : isHighwayMode ? -camDiagBias * 0.65 : -camDiagBias * 1.55;
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
        const carDrawW = 5.4 * pScratchTmp.scale;
        const carDrawH = carDrawW * 0.75;
        const drawCx = pScratchTmp.x;
        const drawCy = getSpriteGroundCenterY(pScratchTmp.y, carDrawH, HERO_SPRITE_GROUND_V);
        const spriteLeft = drawCx - carDrawW * 0.5;
        const spriteTop = drawCy - carDrawH * 0.5;

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
          isMountainMode || isOffRoad
            ? '#46301f'
            : tireId === 'drag_slick'
            ? '#090b10'
            : tireId === 'rain_groove'
            ? '#0c1624'
            : tireId === 'semi_slick'
            ? '#0d1017'
            : '#11141c';
        const markWidth =
          anchors.tireWidthScale *
          (tireBrakingNow ? 1.16 : tireEmitMode === 'burnout' ? 1.12 : isMountainMode || isOffRoad ? 1.12 : 1.0);
        const markAlpha =
          isMountainMode || isOffRoad
            ? isSprayOnly
              ? 0.36
              : 0.60
            : isSprayOnly
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
          const smokeTint: SmokePuff['tint'] =
            isMountainMode || isOffRoad
              ? isFever
                ? 'cyan'
                : 'dirt'
              : isFever
              ? 'cyan'
              : tireId === 'rain_groove'
              ? 'aqua'
              : tireId === 'drift_spec'
              ? 'pink'
              : tireId === 'semi_slick' || tireId === 'drag_slick'
              ? 'warm'
              : 'white';
          const compoundScale =
            (isMountainMode ? 1.24 : 1.0) *
            (tireId === 'drift_spec'
              ? 1.24
              : tireId === 'drag_slick'
              ? 1.18
              : tireId === 'rain_groove'
              ? 0.92
              : 1.0);

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

            // Flung dirt clods & pebbles on mountain/off-road terrain, or sparks on paved curbs
            if ((isMountainMode || isOffRoad) && Math.random() < (tireGassingNow ? 0.55 : 0.35)) {
              pushDebrisChunk({
                x: wx,
                y: driftState.y + 0.08,
                z: wz,
                vx: -cosH * (3.2 + Math.random() * 2.5) + rightH_X * sideSign * 0.9 + (Math.random() - 0.5) * 1.8,
                vy: 1.6 + Math.random() * 2.1,
                vz: -sinH * (3.2 + Math.random() * 2.5) + rightH_Z * sideSign * 0.9 + (Math.random() - 0.5) * 1.8,
                size: 0.12 + Math.random() * 0.14,
                gravity: 18,
                rot: Math.random() * 6,
                vRot: (Math.random() - 0.5) * 8,
                life: 0.34,
                color: Math.random() < 0.3 ? '#78716c' : Math.random() < 0.5 ? '#7c5838' : '#573c26',
              });
            } else if (
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

      const playerAdvZone = isAdventureMode ? resolveAdventureZone(distance) : null;
      const aheadAdvZone = isAdventureMode ? resolveAdventureZone(distance + 58) : null;
      const inDeepCave = Boolean(playerAdvZone && playerAdvZone.caveBlend > 0.72);
      const useWebglBackdrop = Boolean(webglWorld) && !inDeepCave;

      if (useWebglBackdrop) {
        ctx.clearRect(0, 0, pxW, pxH);
        webglWorld!.render({
          nowMs: now,
          pxW,
          pxH,
          fovScale,
          horizonY,
          shakeX,
          shakeY,
          camWorldX,
          camWorldY,
          camWorldZ,
          fwdX,
          fwdZ,
          camPitchSlope: fCamPitchSlope,
          biome,
          sky,
          inDeepCave,
        });

        // Soft high-altitude atmospheric cirrus wisps + distant soaring bird flock (zero allocs)
        const cloudDrift = (camHeading + Math.PI / 2) * 28;
        ctx.save();
        ctx.globalAlpha = sky.isNight ? 0.16 : 0.28;
        const wispTint = sky.id === 'golden_sunset' ? '253, 214, 178' : sky.isNight ? '148, 163, 184' : '248, 250, 252';
        const wispImg = getWispSprite(wispTint);
        for (let w = 0; w < 4; w++) {
          const span = pxW + 420 * HD_UI_SCALE;
          const rawX = ((w * 0.27 + 0.12) * pxW + now * (0.003 + w * 0.0008) - cloudDrift * (0.25 + w * 0.06));
          const wx = (((rawX % span) + span) % span) - 210 * HD_UI_SCALE;
          const wy = horizonY * (0.18 + (w % 3) * 0.11);
          const rx = (85 + w * 24) * HD_UI_SCALE;
          const ry = (11 + (w % 2) * 5) * HD_UI_SCALE;
          ctx.drawImage(wispImg, wx - rx, wy - ry, rx * 2, ry * 2);
        }
        if (!sky.isNight) {
          ctx.globalAlpha = 0.42;
          ctx.strokeStyle = sky.id === 'golden_sunset' ? '#451a03' : '#1e293b';
          ctx.lineWidth = Math.max(1, 1.25 * HD_UI_SCALE);
          for (let b = 0; b < 6; b++) {
            const bSpan = pxW + 180 * HD_UI_SCALE;
            const bxRaw = (0.15 + b * 0.095) * pxW + now * (0.009 + (b % 3) * 0.002) - cloudDrift * 0.38;
            const bx = (((bxRaw % bSpan) + bSpan) % bSpan) - 90 * HD_UI_SCALE;
            const by = horizonY * (0.34 + Math.sin(b * 1.4) * 0.09) + Math.sin(now * 0.002 + b) * 3 * HD_UI_SCALE;
            const flap = Math.sin(now * 0.009 + b * 1.9) * 2.8 * HD_UI_SCALE;
            const wing = (4.2 + (b % 2) * 1.6) * HD_UI_SCALE;
            ctx.beginPath();
            ctx.moveTo(bx - wing, by - flap);
            ctx.quadraticCurveTo(bx - wing * 0.45, by - Math.abs(flap) - 1.5 * HD_UI_SCALE, bx, by);
            ctx.quadraticCurveTo(bx + wing * 0.45, by - Math.abs(flap) - 1.5 * HD_UI_SCALE, bx + wing, by - flap);
            ctx.stroke();
          }
        }
        ctx.restore();
      } else {
        // Fallback 2D Sky Gradient, Stars/Aurora & Celestial Disc (also used inside deep caves)
        const skySplitY = Math.max(0, Math.min(pxH, horizonY + (0.068 - fCamPitchSlope) * fovScale));
        ctx.fillStyle = cachedSkyGrad || sky.skyStops[1];
        ctx.fillRect(0, 0, pxW, skySplitY + Math.round(14 * HD_UI_SCALE));

        const logPxW = pxW / HD_UI_SCALE;
        const logHorizonY = horizonY / HD_UI_SCALE;
        const sunLogX = logPxW * sky.celestialXRatio - (camHeading + Math.PI / 2) * 18;
        const sunLogY = logHorizonY * sky.celestialYRatio;

        ctx.save();
        ctx.scale(HD_UI_SCALE, HD_UI_SCALE);
        renderDynamicSkyAtmosphere({
          ctx,
          pxW: logPxW,
          horizonY: logHorizonY,
          nowMs: now,
          camHeading,
          sky,
          sunScreenX: sunLogX,
          sunScreenY: sunLogY,
        });

        ctx.drawImage(
          celestialCanvas,
          sunLogX - celestialCanvas.width * 0.5,
          sunLogY - celestialCanvas.height * 0.5
        );

        const cloudDrift = (camHeading + Math.PI / 2) * 32;
        const drawAnimeCloud = (
          idx: number,
          baseFrac: number,
          yFrac: number,
          parallax: number,
          breezePxPerMs: number
        ) => {
          const cc = cloudCanvases[idx];
          const span = logPxW + cc.width + 24;
          const rawX = baseFrac * logPxW + now * breezePxPerMs - cloudDrift * parallax;
          const wrappedX = (((rawX + cc.width * 0.5 + 12) % span) + span) % span - cc.width - 12;
          ctx.drawImage(cc, wrappedX, logHorizonY * yFrac - cc.height * 0.65);
        };
        drawAnimeCloud(4, 0.20, 0.30, 0.24, 0.0022);
        drawAnimeCloud(3, 0.56, 0.25, 0.28, 0.0031);
        drawAnimeCloud(0, 0.14, 0.64, 0.42, 0.0018);
        drawAnimeCloud(1, 0.88, 0.58, 0.44, 0.0015);
        drawAnimeCloud(2, 0.46, 0.78, 0.32, 0.0026);
        ctx.restore();

        const mtnShift = (camHeading + Math.PI / 2) * 44 * HD_UI_SCALE;
        const clampedShift = Math.max(-155 * HD_UI_SCALE, Math.min(155 * HD_UI_SCALE, mtnShift * 0.55));
        ctx.globalAlpha = 0.34;
        ctx.drawImage(horizonCanvas, -Math.round(160 * HD_UI_SCALE) - clampedShift, 0);
        ctx.globalAlpha = 1.0;
      }

      // D. Collect Visible Road Slices into pre-allocated pool & sort far-to-near in place
      let visibleCount = 0;
      for (let i = 0; i < track.length && visibleCount < slicePool.length; i++) {
        const pt = track[i];
        const rawZ = (pt.x - camWorldX) * fwdX + (pt.z - camWorldZ) * fwdZ;
        if (rawZ < -5.2 || rawZ > 155) continue;

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

      // Render-only starting road apron behind track[0] so distance=0m fills to bottom of screen
      if (isAdventureMode && visibleCount > 0 && visibleCount < slicePool.length) {
        const nearestSlice = slicePool[visibleCount - 1];
        if (nearestSlice.pt.index === 0) {
          const p0 = nearestSlice.pt;
          const backDist = 7.8;
          startApronPt.x = p0.x - p0.tx * backDist;
          startApronPt.y = p0.y;
          startApronPt.z = p0.z - p0.tz * backDist;
          startApronPt.heading = p0.heading;
          startApronPt.tx = p0.tx;
          startApronPt.tz = p0.tz;
          startApronPt.nx = p0.nx;
          startApronPt.nz = p0.nz;
          startApronPt.width = p0.width;
          const aprRawZ = (startApronPt.x - camWorldX) * fwdX + (startApronPt.z - camWorldZ) * fwdZ;
          const hw = startApronPt.width * 0.5;
          const lx = startApronPt.x - startApronPt.nx * hw;
          const lz = startApronPt.z - startApronPt.nz * hw;
          const rx = startApronPt.x + startApronPt.nx * hw;
          const rz = startApronPt.z + startApronPt.nz * hw;
          const sl = slicePool[visibleCount];
          if (
            aprRawZ >= -5.6 &&
            projectInto(lx, startApronPt.y, lz, sl.pL, 0.45) &&
            projectInto(rx, startApronPt.y, rz, sl.pR, 0.45) &&
            projectInto(lx, startApronPt.y - 1.15, lz, sl.uL, 0.45) &&
            projectInto(rx, startApronPt.y - 1.15, rz, sl.uR, 0.45) &&
            projectInto(lx, startApronPt.y + 0.65, lz, sl.gL, 0.45) &&
            projectInto(rx, startApronPt.y + 0.65, rz, sl.gR, 0.45) &&
            projectInto(startApronPt.x, startApronPt.y, startApronPt.z, sl.cM, 0.45)
          ) {
            sl.pt = startApronPt;
            sl.rawZ = aprRawZ;
            visibleCount++;
          }
        }
      }

      const dynamicGroundCutY = Math.max(0, Math.min(pxH, horizonY + (0.068 - fCamPitchSlope) * fovScale));
      if (!useWebglBackdrop) {
        if (playerAdvZone) {
          ctx.fillStyle = playerAdvZone.caveBlend > 0.45 ? playerAdvZone.chapter.caveCeiling : '#1e3522';
        } else {
          ctx.fillStyle = cachedMeadowGrad || biome.valleyStops[1];
        }
        ctx.fillRect(0, dynamicGroundCutY, pxW, pxH - dynamicGroundCutY);

        if (!playerAdvZone || playerAdvZone.caveBlend <= 0.65) {
          renderBackgroundVista3D({
            ctx,
            camWorldX,
            camWorldZ,
            fwdX,
            fwdZ,
            rightX,
            rightZ,
            biome,
            skyIsNight: sky.isNight,
            skyId: sky.id,
            mtnFarColor: sky.mtnFar,
            mtnNearColor: sky.mtnNear,
            pxW,
            projectInto,
            isAdventure: isAdventureMode,
          });
        }
      } else if (isAdventureMode) {
        // Adventure forest hillside ground color when WebGL sky horizon sits behind
        ctx.fillStyle = '#1e3522';
        ctx.fillRect(0, dynamicGroundCutY, pxW, pxH - dynamicGroundCutY);
      }

      // In Adventure Mode, place horizon mist & subterranean sky darkening BEHIND foreground hills/caves
      if (isAdventureMode) {
        if (!useWebglBackdrop && cachedHorizonMistGrad && (!playerAdvZone || playerAdvZone.caveBlend < 0.35)) {
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = cachedHorizonMistGrad;
          ctx.fillRect(0, Math.max(0, horizonY - Math.round(6 * HD_UI_SCALE)), pxW, Math.round(24 * HD_UI_SCALE));
          ctx.globalAlpha = 1.0;
        }
        if (playerAdvZone && playerAdvZone.caveBlend > 0.08) {
          const skyDarkAlpha = Math.min(0.46, playerAdvZone.caveBlend * 0.46);
          ctx.fillStyle = `rgba(22, 28, 44, ${skyDarkAlpha.toFixed(2)})`;
          ctx.fillRect(0, 0, pxW, horizonY + Math.round(28 * HD_UI_SCALE));
          if (aheadAdvZone && aheadAdvZone.caveBlend > 0.35) {
            ctx.fillStyle = `rgba(22, 28, 44, ${(playerAdvZone.caveBlend * 0.16).toFixed(2)})`;
            ctx.fillRect(0, horizonY, pxW, Math.round((pxH - horizonY) * 0.35));
          }
        }
      }

      if (isMountainMode) {
        renderMountainTerrainMesh3D({
          ctx,
          visibleSlices: slicePool,
          visibleCount,
          projectInto,
          skyIsNight: sky.isNight,
        });
      } else if (isAdventureMode) {
        renderAdventureTerrainMesh3D({
          ctx,
          visibleSlices: slicePool,
          visibleCount,
          projectInto,
        });
      } else {
        renderTerrainMesh3D({
          ctx,
          visibleSlices: slicePool,
          visibleCount,
          biome,
          nowMs: now,
          projectInto,
          webglBackdropActive: useWebglBackdrop,
        });
      }

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
        const propItem = propSortBuf[i].prop;
        if (isMountainMode) {
          const anchor = findClosestTrackAnchor(propItem.z);
          const refY = anchor ? (anchor.isChasmGap ? anchor.y - 3.2 : anchor.y) : 0;
          renderMountainProp3D({
            ctx,
            prop: propItem,
            roadY: refY,
            isChasmGap: Boolean(anchor?.isChasmGap),
            nowMs: now,
            pxW,
            projectInto,
          });
        } else if (isAdventureMode) {
          const anchor = findClosestTrackAnchor(propItem.z);
          const propDist = anchor ? anchor.index * STEP_DIST : Math.max(0, -propItem.z);
          const propZone = resolveAdventureZone(propDist, anchor ? anchor.index : -1);
          if (propZone.isWoodenBridge && Math.abs(propItem.lateralOffset) < 13.5) {
            continue;
          }
          if (
            playerAdvZone &&
            playerAdvZone.caveBlend > 0.45 &&
            propZone.caveBlend < 0.25 &&
            (!aheadAdvZone || aheadAdvZone.caveBlend > 0.25)
          ) {
            continue;
          }
          renderAdventureProp3D({
            ctx,
            prop: propItem,
            roadY: anchor ? anchor.y : 0,
            zoneSample: propZone,
            nowMs: now,
            pxW,
            projectInto,
          });
        } else {
          renderWorldObject3D({
            ctx,
            prop: propItem,
            biome,
            nowMs: now,
            pxW,
            projectInto,
          });
        }
      }

      if (!useWebglBackdrop && sky.isNight && (rawBiome.id !== 'neon' || sky.id === 'red_moon') && !playerAdvZone) {
        ctx.fillStyle =
          sky.id === 'red_moon'
            ? rawBiome.id === 'neon'
              ? 'rgba(56, 8, 22, 0.24)'
              : 'rgba(38, 6, 18, 0.44)'
            : 'rgba(6, 12, 34, 0.44)';
        ctx.fillRect(0, horizonY, pxW, pxH - horizonY);
      }

      if (!useWebglBackdrop && !isAdventureMode && cachedHorizonMistGrad) {
        ctx.fillStyle = cachedHorizonMistGrad;
        ctx.fillRect(0, Math.max(0, horizonY - Math.round(6 * HD_UI_SCALE)), pxW, Math.round(28 * HD_UI_SCALE));
      }

      // F. Parking Plaza Proving Ground OR Mountain Drive Ridges & Ramps OR Forest/Caves Adventure Trail OR Elevated Highway Viaduct
      if (isParkingMode && parkingStages.length > 0 && parkingState) {
        const curStage = parkingStages[parkingStageIdx];
        const bayStNow = evaluateParkingBayStatus(parkingState, curStage);
        renderParkingPlazaGround3D({
          ctx,
          stage: curStage,
          bayStatus: bayStNow,
          biome,
          nowMs: now,
          projectInto,
        });
        renderParkingObstacleProps3D({
          ctx,
          stage: curStage,
          camWorldX,
          camWorldZ,
          fwdX,
          fwdZ,
          projectInto,
        });
      } else if (isMountainMode) {
        for (let i = 0; i < visibleCount - 1; i++) {
          const far = slicePool[i];
          const near = slicePool[i + 1];
          if (Math.abs(far.pt.index - near.pt.index) > 2) continue;

          const roadFog = computeDistanceFogAlpha(far.rawZ, 108, 152);
          if (roadFog <= 0.02) continue;
          renderMountainRoadSlice3D({
            ctx,
            far,
            near,
            fogAlpha: roadFog,
            nowMs: now,
            projectInto,
          });
          ctx.globalAlpha = 1.0;
        }
      } else if (isAdventureMode) {
        const heroRawZAdv = (driftState.x - camWorldX) * fwdX + (driftState.z - camWorldZ) * fwdZ;
        const headlightsActiveNow = headlightsOnRef.current;
        const highBeamActiveNow = highBeamTimer > 0;
        const beamHexNow = currentAppearance.headlightBeamHex;

        for (let i = 0; i < visibleCount - 1; i++) {
          const far = slicePool[i];
          const near = slicePool[i + 1];
          if (Math.abs(far.pt.index - near.pt.index) > 2) continue;

          const roadFog = computeDistanceFogAlpha(far.rawZ, 108, 152);
          if (roadFog <= 0.02) continue;
          ctx.globalAlpha = roadFog;

          const farZone = resolveAdventureZone(far.pt.index * STEP_DIST, far.pt.index);
          const nearZone = resolveAdventureZone(near.pt.index * STEP_DIST, near.pt.index);

          const playerInCave = Boolean(playerAdvZone && (playerAdvZone.zone === 'cave' || playerAdvZone.caveBlend > 0.04));
          const aheadFromCarZ = Math.max(0.9, far.rawZ - Math.max(0, heroRawZAdv - 1.5));
          const sliceIllum = computeHeadlightSliceIllumination({
            rawZ: far.rawZ >= heroRawZAdv - 1.2 ? aheadFromCarZ : 999,
            headlightsOn: headlightsActiveNow,
            highBeamActive: highBeamActiveNow,
            caveBlend: Math.max(farZone.caveBlend, nearZone.caveBlend),
            isNight: sky.isNight,
          });

          // Render overhead 3D rock cave shell + stalactites + crystals + portal before road surface
          renderCaveTunnelSegment3D({
            ctx,
            far,
            near,
            farZone,
            nearZone,
            playerInCave,
            headlightWallIllum: sliceIllum.wallIllum,
            headlightBeamColor: beamHexNow,
            nowMs: now,
            projectInto,
          });

          if (playerInCave || (!farZone.isCavePortalOut && (farZone.isCavePortalIn || farZone.caveBlend <= 0.65))) {
            renderAdventureRoadSlice3D({
              ctx,
              far,
              near,
              farZone,
              fogAlpha: roadFog,
              breachedSliceIdx,
              headlightRoadIllum: sliceIllum.roadIllum,
              headlightBeamColor: beamHexNow,
              nowMs: now,
              projectInto,
            });
          }
          ctx.globalAlpha = 1.0;
        }

        // Subtle ambient dim when player turns headlights OFF inside a cave without sacrificing road visibility
        if (playerAdvZone && playerAdvZone.caveBlend > 0.32 && !headlightsActiveNow && !highBeamActiveNow) {
          ctx.fillStyle = `rgba(12, 16, 26, ${(playerAdvZone.caveBlend * 0.15).toFixed(2)})`;
          ctx.fillRect(0, 0, pxW, pxH);
        }

        const sunbeamVis = playerAdvZone ? Math.max(0, 1 - playerAdvZone.caveBlend * 1.45) : 1;
        if (sunbeamVis > 0.04 && !sky.isNight) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const driftShift = Math.sin(now * 0.00045 + distance * 0.015) * pxW * 0.04;
          for (let b = 0; b < 3; b++) {
            const bxTop = pxW * (0.18 + b * 0.28) + driftShift * (1 + b * 0.2);
            const bxBot = bxTop + pxW * 0.19;
            const beamW = pxW * (0.08 + b * 0.025);
            ctx.fillStyle = sky.id === 'golden_sunset'
              ? `rgba(253, 186, 116, ${(0.055 * sunbeamVis).toFixed(3)})`
              : `rgba(254, 249, 195, ${(0.045 * sunbeamVis).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(bxTop, 0);
            ctx.lineTo(bxTop + beamW * 0.55, 0);
            ctx.lineTo(bxBot + beamW * 1.4, pxH * 0.78);
            ctx.lineTo(bxBot, pxH * 0.78);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      } else {
      for (let i = 0; i < visibleCount - 1; i++) {
        const far = slicePool[i];
        const near = slicePool[i + 1];
        if (Math.abs(far.pt.index - near.pt.index) > 2) continue;

        const roadFog = computeDistanceFogAlpha(far.rawZ, 108, 152);
        if (roadFog <= 0.02) continue;
        ctx.globalAlpha = roadFog;

        const isNearMid = far.rawZ < 64;
        const strokeWalls = far.rawZ < 68 ? '#1e293b' : undefined;

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

        // 3. Smooth Continuous Asphalt Road Ribbon (eliminates artificial checkerboard bands)
        drawQuadPts(far.pL, far.pR, near.pR, near.pL, biome.asphaltEven);

        // Outer Paved Shoulder Apron Trim (subtle dark asphalt border outside lane lines, zero alloc)
        if (isNearMid) {
          const shoulderTint = biome.isNight ? 'rgba(2, 6, 23, 0.24)' : 'rgba(15, 23, 42, 0.16)';
          pScratch0.x = far.pL.x + (far.pR.x - far.pL.x) * 0.045;
          pScratch0.y = far.pL.y + (far.pR.y - far.pL.y) * 0.045;
          pScratch1.x = near.pL.x + (near.pR.x - near.pL.x) * 0.045;
          pScratch1.y = near.pL.y + (near.pR.y - near.pL.y) * 0.045;
          drawQuadPts(far.pL, pScratch0, pScratch1, near.pL, shoulderTint);

          pScratch0.x = far.pR.x - (far.pR.x - far.pL.x) * 0.045;
          pScratch0.y = far.pR.y - (far.pR.y - far.pL.y) * 0.045;
          pScratch1.x = near.pR.x - (near.pR.x - near.pL.x) * 0.045;
          pScratch1.y = near.pR.y - (near.pR.y - near.pL.y) * 0.045;
          drawQuadPts(pScratch0, far.pR, near.pR, pScratch1, shoulderTint);
        }

        // Specular Wet-Night / Golden-Hour Center Reflection Sheen + Damp Puddle Glints (zero allocations)
        if ((biome.isNight || sky.id === 'golden_sunset') && far.rawZ < 92) {
          const sheenCol =
            sky.id === 'red_moon'
              ? 'rgba(248, 113, 113, 0.075)'
              : sky.id === 'golden_sunset'
              ? 'rgba(251, 146, 60, 0.085)'
              : biome.id === 'neon'
              ? 'rgba(34, 211, 238, 0.095)'
              : 'rgba(125, 211, 252, 0.07)';
          pScratch0.x = far.pL.x + (far.pR.x - far.pL.x) * 0.34;
          pScratch0.y = far.pL.y + (far.pR.y - far.pL.y) * 0.34;
          pScratch1.x = far.pL.x + (far.pR.x - far.pL.x) * 0.66;
          pScratch1.y = far.pL.y + (far.pR.y - far.pL.y) * 0.66;
          pScratch2.x = near.pL.x + (near.pR.x - near.pL.x) * 0.66;
          pScratch2.y = near.pL.y + (near.pR.y - near.pL.y) * 0.66;
          pScratch3.x = near.pL.x + (near.pR.x - near.pL.x) * 0.34;
          pScratch3.y = near.pL.y + (near.pR.y - near.pL.y) * 0.34;
          drawQuadPts(pScratch0, pScratch1, pScratch2, pScratch3, sheenCol);
          if (far.pt.index % 7 === 3 && far.rawZ < 58) {
            const pLatFrac = far.pt.index % 14 === 3 ? 0.24 : 0.76;
            const pxPud = far.pL.x + (far.pR.x - far.pL.x) * pLatFrac;
            const pyPud = (far.pL.y + near.pL.y) * 0.5;
            ctx.fillStyle = biome.id === 'neon' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(254, 215, 170, 0.13)';
            ctx.beginPath();
            ctx.ellipse(pxPud, pyPud, Math.max(3, 0.72 * far.cM.scale), Math.max(1.2, 0.18 * far.cM.scale), 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (isNearMid && far.pt.index % 6 === 0) {
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.12)';
          ctx.lineWidth = Math.max(0.8, 0.05 * near.cM.scale);
          ctx.beginPath();
          ctx.moveTo(far.pL.x, far.pL.y);
          ctx.lineTo(far.pR.x, far.pR.y);
          ctx.stroke();
        }

        // Subtle dual tire-wear grooves per lane (batched single beginPath)
        if (isNearMid) {
          ctx.strokeStyle = 'rgba(15, 20, 30, 0.16)';
          ctx.lineWidth = Math.max(1, 0.18 * near.cM.scale);
          const dfx = far.pR.x - far.pL.x;
          const dfy = far.pR.y - far.pL.y;
          const dnx = near.pR.x - near.pL.x;
          const dny = near.pR.y - near.pL.y;
          ctx.beginPath();
          if (isHighwayMode) {
            for (const gs of [0.20, 0.30, 0.70, 0.80]) {
              ctx.moveTo(far.pL.x + dfx * gs, far.pL.y + dfy * gs);
              ctx.lineTo(near.pL.x + dnx * gs, near.pL.y + dny * gs);
            }
          } else {
            for (const gs of [0.38, 0.62]) {
              ctx.moveTo(far.pL.x + dfx * gs, far.pL.y + dfy * gs);
              ctx.lineTo(near.pL.x + dnx * gs, near.pL.y + dny * gs);
            }
          }
          ctx.stroke();
        }

        // Batched outer edge stripes in a single path!
        ctx.strokeStyle = biome.edgeStripe;
        ctx.lineWidth = Math.max(1.2, 0.14 * near.cM.scale);
        ctx.beginPath();
        ctx.moveTo(far.pL.x, far.pL.y);
        ctx.lineTo(near.pL.x, near.pL.y);
        ctx.moveTo(far.pR.x, far.pR.y);
        ctx.lineTo(near.pR.x, near.pR.y);
        ctx.stroke();

        if (far.pt.index % 3 === 0 && far.rawZ < 75) {
          ctx.fillStyle = biome.isNight ? '#22d3ee' : '#fef9c3';
          const studSz = Math.max(1.5, 0.12 * far.cM.scale);
          ctx.fillRect(far.cM.x - studSz * 0.5, far.cM.y - studSz * 0.5, studSz, studSz);
        }

        // Center divider: Double Yellow Solid Highway Lines batched in 1 path!
        if (isHighwayMode) {
          const dfx = far.pR.x - far.pL.x;
          const dfy = far.pR.y - far.pL.y;
          const dnx = near.pR.x - near.pL.x;
          const dny = near.pR.y - near.pL.y;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1.2, 0.11 * near.cM.scale);
          ctx.beginPath();
          ctx.moveTo(far.pL.x + dfx * 0.483, far.pL.y + dfy * 0.483);
          ctx.lineTo(near.pL.x + dnx * 0.483, near.pL.y + dny * 0.483);
          ctx.moveTo(far.pL.x + dfx * 0.517, far.pL.y + dfy * 0.517);
          ctx.lineTo(near.pL.x + dnx * 0.517, near.pL.y + dny * 0.517);
          ctx.stroke();

          if (far.pt.index % 8 === 0 && far.rawZ > 4 && far.rawZ < 90) {
            const arrowR = Math.max(2, 0.42 * far.cM.scale);
            const lx = far.pL.x + dfx * 0.25;
            const ly = far.pL.y + dfy * 0.25;
            ctx.strokeStyle = 'rgba(251, 113, 133, 0.55)';
            ctx.lineWidth = Math.max(1, 0.10 * far.cM.scale);
            ctx.beginPath();
            ctx.moveTo(lx - arrowR, ly - arrowR * 0.45);
            ctx.lineTo(lx, ly + arrowR * 0.45);
            ctx.lineTo(lx + arrowR, ly - arrowR * 0.45);
            ctx.stroke();

            const rx = far.pL.x + dfx * 0.75;
            const ry = far.pL.y + dfy * 0.75;
            ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
            ctx.beginPath();
            ctx.moveTo(rx - arrowR, ry + arrowR * 0.45);
            ctx.lineTo(rx, ry - arrowR * 0.45);
            ctx.lineTo(rx + arrowR, ry + arrowR * 0.45);
            ctx.stroke();
          }
        } else if (far.pt.index % 2 === 0) {
          ctx.strokeStyle = biome.centerLine;
          ctx.lineWidth = Math.max(1.2, 0.10 * near.cM.scale);
          ctx.beginPath();
          ctx.moveTo(far.cM.x, far.cM.y);
          ctx.lineTo(near.cM.x, near.cM.y);
          ctx.stroke();
        }

        if (Math.abs(far.pt.curvature) > 0.012 && far.rawZ < 76) {
          const grooveOff = far.pt.curvature > 0 ? -0.18 : 0.18;
          const gFarX = far.pL.x + (far.pR.x - far.pL.x) * (0.5 + grooveOff);
          const gFarY = far.pL.y + (far.pR.y - far.pL.y) * (0.5 + grooveOff);
          const gNearX = near.pL.x + (near.pR.x - near.pL.x) * (0.5 + grooveOff);
          const gNearY = near.pL.y + (near.pR.y - near.pL.y) * (0.5 + grooveOff);
          ctx.strokeStyle = 'rgba(15, 20, 30, 0.34)';
          ctx.lineWidth = Math.max(1.2, 0.22 * near.cM.scale);
          ctx.beginPath();
          ctx.moveTo(gFarX, gFarY);
          ctx.lineTo(gNearX, gNearY);
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

          if (far.rawZ < 70) {
            ctx.strokeStyle = biome.railSpec;
            ctx.lineWidth = Math.max(1, 0.09 * near.cM.scale);
            ctx.beginPath();
            ctx.moveTo(far.gL.x, far.gL.y);
            ctx.lineTo(near.gL.x, near.gL.y);
            ctx.moveTo(far.gR.x, far.gR.y);
            ctx.lineTo(near.gR.x, near.gR.y);
            ctx.stroke();

            // Mid W-beam corrugation crease for authentic 3D steel guardrail profile
            if (far.rawZ < 44) {
              ctx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
              ctx.lineWidth = Math.max(1, 0.06 * near.cM.scale);
              ctx.beginPath();
              ctx.moveTo((far.gL.x + far.pL.x) * 0.5, (far.gL.y + far.pL.y) * 0.5);
              ctx.lineTo((near.gL.x + near.pL.x) * 0.5, (near.gL.y + near.pL.y) * 0.5);
              ctx.moveTo((far.gR.x + far.pR.x) * 0.5, (far.gR.y + far.pR.y) * 0.5);
              ctx.lineTo((near.gR.x + near.pR.x) * 0.5, (near.gR.y + near.pR.y) * 0.5);
              ctx.stroke();
            }
          }

          if (far.rawZ < 44) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = Math.max(1, 0.11 * far.cM.scale);
            ctx.beginPath();
            ctx.moveTo(far.pL.x, far.pL.y);
            ctx.lineTo(far.gL.x, far.gL.y);
            ctx.moveTo(far.pR.x, far.pR.y);
            ctx.lineTo(far.gR.x, far.gR.y);
            ctx.stroke();

            if (far.pt.index % 2 === 0) {
              const stud = Math.max(1.5, 0.09 * far.cM.scale);
              ctx.fillStyle = biome.isNight ? '#38bdf8' : '#fef08a';
              ctx.fillRect(far.gL.x - stud * 0.5, (far.gL.y + far.pL.y) * 0.5 - stud * 0.5, stud, stud);
              ctx.fillStyle = biome.isNight ? '#fb7185' : '#fef08a';
              ctx.fillRect(far.gR.x - stud * 0.5, (far.gR.y + far.pR.y) * 0.5 - stud * 0.5, stud, stud);
            }
          }

          if (Math.abs(far.pt.curvature) > 0.014 && far.pt.index % 3 === 0) {
            const outerPost = far.pt.curvature > 0 ? far.gL : far.gR;
            const signW = Math.max(4, 0.95 * far.cM.scale);
            const signH = Math.max(4, 0.85 * far.cM.scale);
            const sx = outerPost.x - signW * 0.5;
            const sy = outerPost.y - signH - Math.max(2, 0.35 * far.cM.scale);
            ctx.fillStyle = '#334155';
            ctx.fillRect(outerPost.x - 1, sy + signH, 2, Math.max(2, outerPost.y - (sy + signH)));
            ctx.fillStyle = '#090d16';
            ctx.fillRect(sx - 1, sy - 1, signW + 2, signH + 2);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(sx, sy, signW, signH);
            if (signW >= 5 && signH >= 5) {
              ctx.strokeStyle = '#090d16';
              ctx.lineWidth = Math.max(1, signW * 0.16);
              const midY = sy + signH * 0.5;
              const tipX = far.pt.curvature > 0 ? sx + signW * 0.72 : sx + signW * 0.28;
              const backX = far.pt.curvature > 0 ? sx + signW * 0.28 : sx + signW * 0.72;
              ctx.beginPath();
              ctx.moveTo(backX, sy + signH * 0.22);
              ctx.lineTo(tipX, midY);
              ctx.lineTo(backX, sy + signH * 0.78);
              ctx.stroke();
            }
          }
        }

        // 5c. Roadside Highway Streetlamps + Night Road Pool Glow
        if (far.pt.index % 6 === 0 && far.rawZ > 8.5 && far.rawZ < 115) {
          const isLeftLamp = far.pt.index % 12 === 0;
          const postBase = isLeftLamp ? far.gL : far.gR;
          const roadCenterX = far.cM.x;
          const poleH = Math.max(8, 3.4 * far.cM.scale);
          const armReach = Math.max(3, 1.15 * far.cM.scale) * (isLeftLamp ? 1 : -1);
          const pxBase = postBase.x;
          const pyBase = postBase.y;
          const pyTop = pyBase - poleH;
          const bulbX = pxBase + (roadCenterX > pxBase ? Math.abs(armReach) : -Math.abs(armReach));

          if (biome.isNight && far.rawZ < 68) {
            ctx.fillStyle = biome.lampColor;
            ctx.globalAlpha = roadFog * 0.095;
            ctx.beginPath();
            ctx.ellipse(
              far.cM.x + (isLeftLamp ? -0.25 : 0.25) * (far.pR.x - far.pL.x),
              far.cM.y,
              Math.max(4, far.cM.scale * 2.2),
              Math.max(1.5, far.cM.scale * 0.58),
              0,
              0,
              Math.PI * 2
            );
            ctx.fill();

            // Soft atmospheric volumetric light cone beneath streetlamp fixture
            const coneSpread = Math.max(4, far.cM.scale * 1.45);
            const coneCenterX = far.cM.x + (isLeftLamp ? -0.22 : 0.22) * (far.pR.x - far.pL.x);
            ctx.globalAlpha = roadFog * 0.045;
            ctx.beginPath();
            ctx.moveTo(bulbX, pyTop + 1);
            ctx.lineTo(coneCenterX - coneSpread, far.cM.y);
            ctx.lineTo(coneCenterX + coneSpread, far.cM.y);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = roadFog;
          }

          ctx.strokeStyle = '#475569';
          ctx.lineWidth = Math.max(1, 0.14 * far.cM.scale);
          ctx.beginPath();
          ctx.moveTo(pxBase, pyBase);
          ctx.lineTo(pxBase, pyTop);
          ctx.lineTo(bulbX, pyTop);
          ctx.stroke();

          ctx.fillStyle = biome.lampColor;
          ctx.globalAlpha = roadFog * (biome.isNight ? 0.34 : 0.14);
          ctx.beginPath();
          ctx.arc(bulbX, pyTop + 1, Math.min(11, Math.max(2, 0.45 * far.cM.scale)), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = roadFog;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bulbX - 1.2, pyTop, Math.max(2, 0.22 * far.cM.scale), Math.max(2, 0.14 * far.cM.scale));
        }

        // 5d. Overhead Highway Steel Gantries with Illuminated Biome Signboard!
        if (far.pt.index >= 10 && far.pt.index % 26 === 14 && far.rawZ > 7 && far.rawZ < 118) {
          const gantryH = Math.max(10, 3.6 * far.cM.scale);
          const leftX = far.gL.x;
          const leftY = far.gL.y;
          const rightX_g = far.gR.x;
          const rightY_g = far.gR.y;
          const topYL = leftY - gantryH;
          const topYR = rightY_g - gantryH;

          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = Math.max(2, 0.22 * far.cM.scale);
          ctx.beginPath();
          ctx.moveTo(leftX, leftY);
          ctx.lineTo(leftX, topYL);
          ctx.lineTo(rightX_g, topYR);
          ctx.lineTo(rightX_g, rightY_g);
          ctx.stroke();

          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1, 0.11 * far.cM.scale);
          ctx.beginPath();
          ctx.moveTo(leftX, topYL);
          ctx.lineTo(rightX_g, topYR);
          ctx.stroke();

          const midGX = (leftX + rightX_g) * 0.5;
          const midGY = (topYL + topYR) * 0.5;
          const signW = Math.max(12, Math.abs(rightX_g - leftX) * 0.48);
          const signH = Math.max(5, 0.95 * far.cM.scale);
          ctx.fillStyle = '#090d16';
          ctx.fillRect(midGX - signW * 0.5 - 1, midGY - signH * 0.5 - 1, signW + 2, signH + 2);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(midGX - signW * 0.5, midGY - signH * 0.5, signW, signH);
          ctx.fillStyle = biome.gantryAccent;
          ctx.fillRect(midGX - signW * 0.5, midGY - signH * 0.5, signW, Math.max(1.5, signH * 0.22));

          if (signW >= 34) {
            ctx.textAlign = 'center';
            ctx.font = `bold ${Math.max(6, Math.round(signH * 0.56))}px "Chakra Petch", monospace`;
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(biome.gantrySign, midGX, midGY + signH * 0.28);
          }
        }

        // 5e. 3D Roadside Reflector Bollards, Truss Bridges & Biome-Authentic Roadside Landmarks
        renderReflectorBollard3D({ ctx, far, biome });
        renderBridgeTrussArch3D({ ctx, far, biome, projectInto });
        renderRealisticRoadsideLandmarks3D({ ctx, far, biome, projectInto, nowMs: now });
        ctx.globalAlpha = 1.0;
      }
      }

      // 5f. Checkered Campaign Finish Gate Banner
      if (!isParkingMode && curLevel) {
        const targetIdx = Math.round(curLevel.targetDistance / STEP_DIST);
        for (let i = 0; i < visibleCount; i++) {
          if (slicePool[i].pt.index === targetIdx) {
            renderFinishGate3D({
              ctx,
              pt: slicePool[i].pt,
              rawZ: slicePool[i].rawZ,
              projectInto,
              nowMs: now,
            });
            break;
          }
        }
      }
      ctx.globalAlpha = 1.0;

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

      const activeCaveBlend = playerAdvZone ? playerAdvZone.caveBlend : 0;
      resolveHeadlightLighting({
        headlightsOn: headlightsOnRef.current,
        highBeamTimer,
        caveBlend: activeCaveBlend,
        isNight: sky.isNight,
      });

      // H. Spinning Metallic 3D Gold Coins & Faceted Glowing Nitro Star Gems along the S-Curve
      for (let i = track.length - 1; i >= 0; i--) {
        const pt = track[i];
        if (pt.hasCoin && !pt.coinCollected) {
          if (
            projectInto(pt.coinX, pt.y + 0.65, pt.coinZ, pScratchTmp) &&
            pScratchTmp.z >= 1.8 &&
            pScratchTmp.z <= 120 &&
            !(phase === 'title' && pScratchTmp.z < 24)
          ) {
            const nearFade = Math.min(1, Math.max(0, (pScratchTmp.z - 2.0) / 2.6));
            const r = Math.min(28, Math.max(2.5, 0.42 * pScratchTmp.scale));
            const spinCos = Math.abs(Math.cos(now * 0.005 + pt.index));
            const rx = Math.max(1.8, spinCos * r);
            const cx = pScratchTmp.x;
            const cy = pScratchTmp.y;

            ctx.save();
            ctx.globalAlpha = nearFade * 0.34;
            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.ellipse(cx, cy + r * 1.15, Math.max(2, r * 0.75), Math.max(1.2, r * 0.26), 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = nearFade;
            const spriteDrawR = r * (32 / 28);
            const spriteDrawRx = Math.max(2.2, (rx / Math.max(1, r)) * spriteDrawR);
            ctx.drawImage(
              goldCoinSprite,
              cx - spriteDrawRx,
              cy - spriteDrawR,
              spriteDrawRx * 2,
              spriteDrawR * 2
            );
            ctx.restore();
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
            pScratchTmp.z >= 1.8 &&
            pScratchTmp.z <= 120 &&
            !(phase === 'title' && pScratchTmp.z < 24)
          ) {
            const nearFade = Math.min(1, Math.max(0, (pScratchTmp.z - 2.0) / 2.6));
            const gr = Math.min(34, Math.max(3, 0.58 * pScratchTmp.scale));
            const cx = pScratchTmp.x;
            const cy = pScratchTmp.y;
            const gemDrawR = gr * (36 / 23);
            ctx.globalAlpha = nearFade;
            ctx.drawImage(
              nitroGemSprite,
              cx - gemDrawR,
              cy - gemDrawR,
              gemDrawR * 2,
              gemDrawR * 2
            );
            ctx.globalAlpha = 1.0;
          }
        }

        if (pt.hasNitroCanister && !pt.canisterCollected) {
          const cxWorld = pt.canisterX ?? pt.x;
          const czWorld = pt.canisterZ ?? pt.z;
          const bob = Math.sin(now * 0.005 + pt.index * 1.3) * 0.2;
          const cyWorld = pt.y + 0.9 + bob;
          if (
            projectInto(cxWorld, cyWorld, czWorld, pScratchTmp) &&
            pScratchTmp.z >= 1.5 &&
            pScratchTmp.z <= 125 &&
            !(phase === 'title' && pScratchTmp.z < 20)
          ) {
            const scale = pScratchTmp.scale;
            const canW = Math.max(5, Math.round(0.55 * scale));
            const canH = Math.max(9, Math.round(1.2 * scale));
            const csx = Math.round(pScratchTmp.x);
            const csy = Math.round(pScratchTmp.y);

            ctx.save();
            // Outer cyan aura (fast concentric glow rings, zero CPU shadowBlur)
            ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
            ctx.beginPath();
            ctx.arc(csx, csy, Math.round(canW * 1.9), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(6, 182, 212, 0.28)';
            ctx.beginPath();
            ctx.arc(csx, csy, Math.round(canW * 1.35), 0, Math.PI * 2);
            ctx.fill();

            // Cylinder body
            const bodyLeft = csx - Math.floor(canW * 0.5);
            const bodyTop = csy - Math.floor(canH * 0.5);
            const radY = Math.max(2, Math.round(canW * 0.28));

            ctx.drawImage(
              canisterBodySprite,
              bodyLeft,
              bodyTop + radY,
              canW,
              Math.max(1, canH - radY * 2)
            );

            // Bottom cap
            ctx.fillStyle = '#0284c7';
            ctx.beginPath();
            ctx.ellipse(csx, bodyTop + canH - radY, Math.floor(canW * 0.5), radY, 0, 0, Math.PI);
            ctx.fill();

            // Top cap
            ctx.fillStyle = '#a5f3fc';
            ctx.beginPath();
            ctx.ellipse(csx, bodyTop + radY, Math.floor(canW * 0.5), radY, 0, 0, Math.PI * 2);
            ctx.fill();

            // Top nozzle
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(csx - 1, bodyTop - Math.max(2, Math.round(canH * 0.15)), 2, Math.max(2, Math.round(canH * 0.15)));

            // Rotating star rune on canister face
            const runeAngle = (now * 0.005 + pt.index * 0.8) % (Math.PI * 2);
            const runeR = Math.max(2, Math.round(canW * 0.35));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1, Math.round(scale * 0.05));
            ctx.beginPath();
            for (let s = 0; s < 4; s++) {
              const a = runeAngle + (s * Math.PI) / 2;
              const rx = csx + Math.cos(a) * runeR;
              const ry = csy + Math.sin(a) * runeR * 0.7;
              if (s === 0) ctx.moveTo(rx, ry);
              else {
                ctx.moveTo(csx, csy);
                ctx.lineTo(rx, ry);
              }
            }
            ctx.stroke();

            // Bright white star core
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(csx - 1, csy - 1, 2, 2);

            ctx.restore();
          }
        }
      }

      const drawSmokePuff = (p: SmokePuff) => {
        if (!projectInto(p.x, p.y, p.z, pScratchTmp)) return;
        const age = 1 - p.life / p.maxLife;
        const curRad = p.radius + (p.maxRadius - p.radius) * age;
        const pr = Math.min(34, Math.max(2, curRad * 0.72 * pScratchTmp.scale));
        const sx = pScratchTmp.x;
        const sy = pScratchTmp.y;
        const baseAlpha =
          Math.min(p.tint === 'dirt' ? 0.62 : 0.46, (p.life / p.maxLife) * (p.tint === 'dirt' ? 0.72 : 0.54)) *
          (1 - age * 0.25);

        const outerColor =
          p.tint === 'cyan'
            ? '#0891b2'
            : p.tint === 'aqua'
            ? '#0e7490'
            : p.tint === 'pink'
            ? '#db2777'
            : p.tint === 'warm'
            ? '#94a3b8'
            : p.tint === 'dust'
            ? '#78716c'
            : p.tint === 'dirt'
            ? '#735032'
            : p.tint === 'steam'
            ? '#94a3b8'
            : p.tint === 'dark'
            ? '#1e293b'
            : '#cbd5e1';

        const innerColor =
          p.tint === 'cyan'
            ? '#cffafe'
            : p.tint === 'aqua'
            ? '#a5f3fc'
            : p.tint === 'pink'
            ? '#fbcfe8'
            : p.tint === 'warm'
            ? '#fef3c7'
            : p.tint === 'dust'
            ? '#d6d3d1'
            : p.tint === 'dirt'
            ? '#d4ac82'
            : p.tint === 'steam'
            ? '#f8fafc'
            : p.tint === 'dark'
            ? '#475569'
            : '#ffffff';

        // Subtle ground shadow curl tint underneath smoke plume
        ctx.globalAlpha = baseAlpha * 0.22;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(sx, sy + pr * 0.65, pr * 1.15, Math.max(1.2, pr * 0.38), 0, 0, Math.PI * 2);
        ctx.fill();

        // Outer soft 3-lobe cel-shaded halo puff
        ctx.globalAlpha = baseAlpha * 0.46;
        ctx.fillStyle = outerColor;
        ctx.beginPath();
        ctx.arc(sx, sy + 1, pr * 1.18, 0, Math.PI * 2);
        ctx.arc(sx - pr * 0.46, sy + 1.5, Math.max(1.5, pr * 0.78), 0, Math.PI * 2);
        ctx.arc(sx + pr * 0.42, sy + 0.5, Math.max(1.4, pr * 0.68), 0, Math.PI * 2);
        ctx.fill();

        // Inner crisp cel-highlight puff curl
        ctx.globalAlpha = baseAlpha * 0.82;
        ctx.fillStyle = innerColor;
        ctx.beginPath();
        ctx.arc(sx - pr * 0.14, sy - pr * 0.18, Math.max(1.5, pr * 0.68), 0, Math.PI * 2);
        ctx.arc(sx + pr * 0.32, sy - pr * 0.08, Math.max(1.2, pr * 0.48), 0, Math.PI * 2);
        ctx.arc(sx - pr * 0.42, sy - pr * 0.04, Math.max(1.0, pr * 0.36), 0, Math.PI * 2);
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

      if (isParkingMode && parkingStages.length > 0) {
        const curStage = parkingStages[parkingStageIdx];
        for (let i = 0; i < curStage.parkedCars.length && vehicleCount < vehicleDrawBuf.length - 1; i++) {
          const pc = curStage.parkedCars[i];
          const rawZ = (pc.x - camWorldX) * fwdX + (pc.z - camWorldZ) * fwdZ;
          if (rawZ < 3.8 || rawZ > 120) continue;
          const slot = vehicleDrawBuf[vehicleCount];
          if (projectInto(pc.x, 0, pc.z, slot.proj)) {
            slot.rawZ = rawZ;
            slot.isHero = false;
            slot.isGhost = false;
            slot.ghostFrame = undefined;
            slot.traffic = undefined;
            slot.parked = pc;
            vehicleCount++;
          }
        }
      } else if (isHighwayMode) {
        for (let i = 0; i < trafficCars.length && vehicleCount < vehicleDrawBuf.length - 1; i++) {
          const tc = trafficCars[i];
          const sample = sampleTrackAtS(track, tc.s, STEP_DIST);
          if (!sample) continue;
          const wx = sample.x + sample.nx * tc.lateralOffset;
          const wy = sample.y + (tc.crashY ?? 0);
          const wz = sample.z + sample.nz * tc.lateralOffset;
          const rawZ = (wx - camWorldX) * fwdX + (wz - camWorldZ) * fwdZ;
          if (rawZ < 1.5 || rawZ > 145) continue;

          const slot = vehicleDrawBuf[vehicleCount];
          if (projectInto(wx, wy, wz, slot.proj)) {
            slot.rawZ = rawZ;
            slot.isHero = false;
            slot.isGhost = false;
            slot.ghostFrame = undefined;
            slot.parked = undefined;
            slot.traffic = tc;
            slot.trafficRelYaw = (tc.isOncoming ? sample.heading + Math.PI : sample.heading) + (tc.crashYaw ?? 0);
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
          heroSlot.isGhost = false;
          heroSlot.ghostFrame = undefined;
          heroSlot.traffic = undefined;
          heroSlot.parked = undefined;
          vehicleCount++;
        }
      }

      // Sample and project Holographic Rival Ghost into 3D world space (during active play)
      if (phase === 'playing' && !isParkingMode && activeGhost && vehicleCount < vehicleDrawBuf.length) {
        const curGhost = sampleGhostPosition(activeGhost, runElapsedSec, ghostSampleScratch);
        if (curGhost) {
          const gSample = sampleTrackAtS(track, curGhost.distance, STEP_DIST);
          if (gSample) {
            const gx = gSample.x + gSample.nx * curGhost.lateralOffset;
            const gy = gSample.y;
            const gz = gSample.z + gSample.nz * curGhost.lateralOffset;
            const gRawZ = (gx - camWorldX) * fwdX + (gz - camWorldZ) * fwdZ;
            if (gRawZ >= 1.5 && gRawZ <= 145) {
              const gSlot = vehicleDrawBuf[vehicleCount];
              if (projectInto(gx, gy, gz, gSlot.proj)) {
                gSlot.rawZ = gRawZ;
                gSlot.isHero = false;
                gSlot.traffic = undefined;
                gSlot.parked = undefined;
                gSlot.isGhost = true;
                gSlot.ghostFrame = curGhost;
                gSlot.ghostColor = activeGhost.carColor;
                gSlot.ghostCarId = activeGhost.carId;
                vehicleCount++;
              }
            }
          }
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

      const isDarkOrCave = biome.isNight || (playerAdvZone ? playerAdvZone.caveBlend > 0.16 : false);

      for (let v = 0; v < vehicleCount; v++) {
        const item = vehicleDrawBuf[v];
        if (item.isHero) {
          const carDrawW = 5.4 * item.proj.scale;
          const carDrawH = carDrawW * 0.75;
          const cx = item.proj.x;
          const cy = getSpriteGroundCenterY(
            item.proj.y,
            carDrawH,
            HERO_SPRITE_GROUND_V,
            heroPitchY * HD_UI_SCALE
          );
          const activePedalMode: 'coast' | 'gas' | 'brake' =
            phase === 'playing'
              ? keyDown || pedalBrakeRef.current || (isParkingMode && Boolean(pedalHandbrakeRef.current || keyHandbrake))
                ? 'brake'
                : !isParkingMode || keyUp || pedalGasRef.current
                ? 'gas'
                : 'coast'
              : 'coast';

          // Grounded Chassis Contact Shadow + Airborne Mountain Jump Shadow + Underglow
          const heroAirAltitude = Math.max(0, driftState.y - carGroundY);
          const showAirborneShadow =
            !isParkingMode &&
            (isAirborneRender || heroAirAltitude > 0.08);
          if (isFalling || isTrafficCrash) {
            if (projectInto(driftState.x, crashGroundY, driftState.z, pScratchTmp)) {
              const alt = Math.max(0, driftState.y - crashGroundY);
              const altScale = Math.max(0.32, 1 - alt * 0.08);
              const shW = 5.4 * pScratchTmp.scale * 0.42 * altScale;
              const shH = shW * 0.26;
              ctx.save();
              ctx.globalAlpha = Math.max(0.14, 0.46 * altScale);
              ctx.fillStyle = '#020617';
              ctx.beginPath();
              ctx.ellipse(pScratchTmp.x, pScratchTmp.y, shW, shH, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          } else if (showAirborneShadow) {
            const floorShadowY = isMountainMode
              ? (() => {
                  const jumpSurf = sampleMountainSurface(
                    driftState.x,
                    driftState.z,
                    track,
                    STEP_DIST,
                    stats.roadAllowanceBonus
                  );
                  return jumpSurf.inChasmGap ? jumpSurf.terrainY : jumpSurf.roadY;
                })()
              : carGroundY;
            if (projectInto(driftState.x, floorShadowY, driftState.z, pScratchTmp)) {
              const alt = Math.max(0, driftState.y - floorShadowY);
              const altScale = Math.max(0.28, 1 - alt * 0.055);
              const shW = 5.4 * pScratchTmp.scale * 0.44 * altScale;
              const shH = shW * 0.25;
              ctx.save();
              ctx.globalAlpha = Math.max(0.12, 0.42 * altScale);
              ctx.fillStyle = '#020617';
              ctx.beginPath();
              ctx.ellipse(pScratchTmp.x, pScratchTmp.y, shW, shH, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          } else {
            ctx.save();
            const shadowCy = getHeroGroundedShadowY(item.proj.y, carDrawH);
            const suspScale = Math.max(0.86, 1 - Math.max(0, suspensionY) * 0.65);
            const shadowRx = carDrawW * 0.42 * suspScale;
            const shadowRy = carDrawH * 0.14 * suspScale;
            ctx.save();
            ctx.translate(cx, shadowCy);
            ctx.rotate(heroRollRad * 0.6);
            ctx.scale(1, Math.max(0.05, shadowRy / Math.max(1, shadowRx)));
            const heroShGrad = ctx.createRadialGradient(0, 0, shadowRx * 0.15, 0, 0, shadowRx * 1.25);
            heroShGrad.addColorStop(0, 'rgba(2, 6, 23, 0.56)');
            heroShGrad.addColorStop(0.45, 'rgba(2, 6, 23, 0.40)');
            heroShGrad.addColorStop(0.75, 'rgba(2, 6, 23, 0.15)');
            heroShGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
            ctx.fillStyle = heroShGrad;
            ctx.beginPath();
            ctx.arc(0, 0, shadowRx * 1.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (cachedAppearance.underglowHex) {
              ctx.save();
              ctx.translate(cx, shadowCy);
              ctx.rotate(heroRollRad * 0.6);
              ctx.scale(1, Math.max(0.05, (shadowRy * 1.25) / Math.max(1, shadowRx * 1.18)));
              const heroUgGrad = ctx.createRadialGradient(0, 0, shadowRx * 0.3, 0, 0, shadowRx * 1.3);
              const ugA = isFever ? '66' : '4d';
              const ugB = isFever ? '2e' : '1f';
              heroUgGrad.addColorStop(0, cachedAppearance.underglowHex + ugA);
              heroUgGrad.addColorStop(0.6, cachedAppearance.underglowHex + ugB);
              heroUgGrad.addColorStop(1, cachedAppearance.underglowHex + '00');
              ctx.fillStyle = heroUgGrad;
              ctx.beginPath();
              ctx.arc(0, 0, shadowRx * 1.3, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // Twin red taillight / brake-light ground reflection bounce
            const brakeIntensity = activePedalMode === 'brake' ? 0.34 : isDarkOrCave ? 0.22 : 0.09;
            ctx.globalAlpha = brakeIntensity;
            ctx.fillStyle = currentCar.tailGlowColor || '#ef4444';
            ctx.beginPath();
            ctx.ellipse(cx - carDrawW * 0.16, shadowCy + shadowRy * 0.65, shadowRx * 0.34, shadowRy * 0.72, 0, 0, Math.PI * 2);
            ctx.ellipse(cx + carDrawW * 0.16, shadowCy + shadowRy * 0.65, shadowRx * 0.34, shadowRy * 0.72, 0, 0, Math.PI * 2);
            ctx.fill();

            // Fever / Slipstream twin cyan-amber aero slipstream ground streak
            if (isFever || slipstreamBoostTimer > 0) {
              ctx.globalAlpha = 0.28;
              ctx.fillStyle = isFever ? '#22d3ee' : '#fbbf24';
              ctx.beginPath();
              ctx.ellipse(cx, shadowCy + shadowRy * 1.15, shadowRx * 0.92, shadowRy * 0.65, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }

          if (customImgEl && customImgEl.complete) {
            ctx.save();
            ctx.translate(cx, cy);
            if (isFalling || isTrafficCrash) ctx.rotate(fallRotation);
            else ctx.rotate(heroRollRad);
            if (visualDriftAngle < 0) ctx.scale(-1, 1);
            ctx.drawImage(customImgEl, -carDrawW * 0.5, -carDrawH * 0.5, carDrawW, carDrawH);
            ctx.restore();
          } else {
            const heroYawOverride =
              isParkingMode && parkingState
                ? Math.round(normalizeAngle(parkingState.heading - camViewAngle) * 32) / 32
                : isFalling || isTrafficCrash
                ? Math.round(normalizeAngle(driftState.heading + crashBody.yaw - camViewAngle) * 32) / 32
                : undefined;
            const spriteHeadlightsOn =
              highBeamTimer > 0
                ? isHighBeamPulse
                : headlightsOnRef.current && (isDarkOrCave || isParkingMode);
            const effectiveHeroPitch = isParkingMode
              ? 0.37
              : isFalling || isTrafficCrash
              ? Math.max(0.14, Math.min(0.62, 0.37 + crashBody.pitch * 0.5))
              : heroPitchRad;
            const spriteCanvas = getPixelCarCanvas(
              currentCar,
              visualDriftAngle,
              isFever,
              false, // Show real paint & visible bent/detached damage instead of uniform grey tint
              wheelSpinPhase,
              carCustomRef.current,
              activePedalMode,
              spriteHeadlightsOn,
              heroYawOverride,
              effectiveHeroPitch,
              activeDamageState,
              visualFrontSteer
            );
            ctx.save();
            ctx.translate(cx, cy);
            if (isFalling || isTrafficCrash) {
              ctx.rotate(fallRotation);
            } else {
              ctx.rotate(heroRollRad);
            }
            ctx.drawImage(spriteCanvas, -carDrawW * 0.5, -carDrawH * 0.5, carDrawW, carDrawH);
            ctx.restore();

            // Subtle crisp headlamp lens bloom on camera-facing front lamp during 3/4 drift or Parking maneuvers
            const activeBeamNow = (headlightsOnRef.current || highBeamTimer > 0) && !isFalling && !isTrafficCrash;
            if (activeBeamNow) {
              const effYaw = heroYawOverride ?? visualDriftAngle;
              if (Math.abs(effYaw) > 0.22) {
                const hBaseX = isParkingMode && parkingState ? parkingState.x : driftState.x;
                const hBaseY = isParkingMode && parkingState ? 0 : driftState.y;
                const hBaseZ = isParkingMode && parkingState ? parkingState.z : driftState.z;
                const hAng = isParkingMode && parkingState ? parkingState.heading : driftState.heading;
                const hc = Math.cos(hAng);
                const hs = Math.sin(hAng);
                const visibleSide = effYaw > 0 ? -1 : 1;
                const lampX = hBaseX + hc * 1.88 - hs * (visibleSide * 0.68);
                const lampZ = hBaseZ + hs * 1.88 + hc * (visibleSide * 0.68);
                if (projectInto(lampX, hBaseY + 0.52, lampZ, pScratchTmp, 0.45)) {
                  const bloomR = Math.max(6, pScratchTmp.scale * (highBeamTimer > 0 ? 0.62 : 0.42));
                  const bloomImg = getBloomSprite(
                    currentAppearance.headlightBeamHex,
                    highBeamTimer > 0
                  );
                  ctx.save();
                  ctx.globalCompositeOperation = 'screen';
                  ctx.drawImage(
                    bloomImg,
                    pScratchTmp.x - bloomR,
                    pScratchTmp.y - bloomR,
                    bloomR * 2,
                    bloomR * 2
                  );
                  ctx.restore();
                }
              }
            }
          }
        } else if (item.parked) {
          const pc = item.parked;
          const sizeScale = pc.kind === 'box_truck' ? 5.9 : pc.kind === 'van' ? 5.4 : 5.1;
          const drawW = Math.max(10, sizeScale * item.proj.scale);
          const drawH = Math.max(7.5, drawW * 0.75);
          const tx = item.proj.x;
          const ty = getSpriteGroundCenterY(item.proj.y, drawH, TRAFFIC_SPRITE_GROUND_V);
          const yawRelCam = normalizeAngle(pc.heading - camViewAngle);
          const trSprite = getTrafficVehicleCanvas(
            pc.kind,
            pc.color,
            false,
            0,
            biome.isNight,
            yawRelCam
          );
          const nearFade = Math.min(1, Math.max(0, (item.rawZ - 3.8) / 1.4));
          ctx.globalAlpha = nearFade;
          ctx.drawImage(trSprite, tx - drawW * 0.5, ty - drawH * 0.5, drawW, drawH);
          ctx.globalAlpha = 1.0;
        } else if (item.isGhost && item.ghostFrame) {
          const gf = item.ghostFrame;
          const ghostDrawW = Math.max(10, 5.4 * item.proj.scale);
          const ghostDrawH = ghostDrawW * 0.75;
          const gcx = item.proj.x;
          const gcy = getSpriteGroundCenterY(item.proj.y, ghostDrawH, HERO_SPRITE_GROUND_V);

          const baseGhostSpec =
            CAR_ROSTER.find((c) => c.id === item.ghostCarId) || CAR_ROSTER[0];
          const ghostColor = item.ghostColor || '#06b6d4';
          const ghostCarSpec: CarSpec = {
            ...baseGhostSpec,
            primaryColor: ghostColor,
            accentColor: ghostColor,
          };

          ctx.save();
          // Shimmering translucent holographic visual
          const shimmer = 0.40 + Math.sin(now * 0.012) * 0.08;
          ctx.globalAlpha = shimmer * 0.35;
          ctx.fillStyle = ghostColor;
          ctx.beginPath();
          ctx.ellipse(
            gcx,
            getHeroGroundedShadowY(item.proj.y, ghostDrawH),
            ghostDrawW * 0.46,
            ghostDrawH * 0.18,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          ctx.globalAlpha = shimmer;
          const ghostRelAngle = Math.max(-1, Math.min(1, normalizeAngle(gf.angle - camHeading) / 0.74));
          const ghostSprite = getPixelCarCanvas(
            ghostCarSpec,
            ghostRelAngle,
            false,
            false,
            Math.floor(now * 0.015) % 4
          );

          ctx.drawImage(
            ghostSprite,
            gcx - ghostDrawW * 0.5,
            gcy - ghostDrawH * 0.5,
            ghostDrawW,
            ghostDrawH
          );

          // Holographic scanlines effect
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = ghostColor;
          const topY = gcy - ghostDrawH * 0.5;
          const botY = gcy + ghostDrawH * 0.5;
          const scanShift = Math.floor(now * 0.025) % 4;
          for (let sy = topY + scanShift; sy < botY; sy += 5) {
            ctx.fillRect(gcx - ghostDrawW * 0.5, sy, ghostDrawW, 1.2);
          }

          // Floating holographic tag above rival ghost
          if (item.rawZ < 85) {
            ctx.globalAlpha = 0.88;
            ctx.font = `bold ${Math.round(8.5 * HD_UI_SCALE)}px monospace`;
            ctx.textAlign = 'center';
            const tag = wasGhostAhead && distance >= gf.distance ? 'RIVAL (PASSED)' : 'GHOST RIVAL';
            ctx.fillStyle = '#090d16';
            ctx.fillText(tag, gcx + 1.2, gcy - ghostDrawH * 0.55 + 1.2);
            ctx.fillStyle = ghostColor;
            ctx.fillText(tag, gcx, gcy - ghostDrawH * 0.55);
          }

          ctx.restore();
        } else if (item.traffic) {
          const tc = item.traffic;
          const sizeScale = tc.kind === 'box_truck' ? 5.9 : tc.kind === 'van' ? 5.4 : 5.1;
          const drawW = Math.max(10, sizeScale * item.proj.scale);
          const drawH = Math.max(7.5, drawW * 0.75);
          const tx = item.proj.x;
          const ty = getSpriteGroundCenterY(item.proj.y, drawH, TRAFFIC_SPRITE_GROUND_V);
          const viewNorm = Math.max(-1, Math.min(1, (item.proj.x - pxW * 0.5) / Math.max(40, pxW * 0.42)));
          // Subtle grounded contact shadow & rear taillight asphalt glow on nearby traffic
          if (item.rawZ < 72) {
            const crashLiftPx = (tc.crashY ?? 0) * item.proj.scale;
            const shY = getTrafficGroundedShadowY(item.proj.y, drawH, crashLiftPx);
            const shScale = Math.max(0.42, 1 - (tc.crashY ?? 0) * 0.12);
            ctx.save();
            ctx.globalAlpha = 0.36 * shScale;
            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.ellipse(tx, shY, drawW * 0.38 * shScale, drawH * 0.12 * shScale, 0, 0, Math.PI * 2);
            ctx.fill();
            if (!tc.isOncoming && !tc.crashed) {
              ctx.globalAlpha = biome.isNight ? 0.22 : 0.08;
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.ellipse(tx, shY + drawH * 0.05, drawW * 0.32, drawH * 0.08, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
          const customYawRad =
            (tc.crashed || Math.abs(tc.crashYaw ?? 0) > 0.02) && item.trafficRelYaw !== undefined
              ? normalizeAngle(item.trafficRelYaw - camViewAngle)
              : undefined;
          const trSprite = getTrafficVehicleCanvas(
            tc.kind,
            tc.color,
            tc.isOncoming,
            viewNorm,
            biome.isNight,
            customYawRad
          );
          if (tc.crashRoll && Math.abs(tc.crashRoll) > 0.01) {
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(Math.max(-0.65, Math.min(0.65, tc.crashRoll)));
            ctx.drawImage(trSprite, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
            ctx.restore();
          } else {
            ctx.drawImage(trSprite, tx - drawW * 0.5, ty - drawH * 0.5, drawW, drawH);
          }

          // Blinking amber turn-signal hazard indicator when yielding out of player's lane!
          if (!tc.crashed && tc.yieldingToSide && Math.floor(now / 140) % 2 === 0) {
            const sigX = tx + tc.yieldingToSide * drawW * 0.25;
            const sigY = ty + drawH * 0.08;
            const sigSize = Math.max(2.5, drawW * 0.08);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(sigX - sigSize * 0.5, sigY - sigSize * 0.5, sigSize, sigSize);
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

      // K. Shattered Guardrail Beams, Ground Gravel, Sparks & Flying Shaped Car Parts (O(1) swap-remove)
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

        if ((isFalling || groundImpacted) && d.y <= crashGroundY) {
          d.y = crashGroundY;
          if (d.vy < -1.5) {
            d.vy = Math.abs(d.vy) * 0.32;
            d.vx *= 0.65;
            d.vz *= 0.65;
            d.vRot *= 0.6;
          } else {
            d.vy = 0;
            d.vx *= 0.92;
            d.vz *= 0.92;
            d.vRot = 0;
          }
        }

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

      // K1. Flying & Bouncing Shaped Detached Car Parts (Bumpers, Hood, Doors, Wing, Roof, Windshield)
      for (let i = 0; i < MAX_DETACHED_PARTS; i++) {
        const dp = detachedPartPool[i];
        if (!dp.active) continue;
        dp.life -= dt;
        if (dp.life <= 0) {
          dp.active = false;
          continue;
        }
        dp.vy -= 26 * dt;
        dp.x += dp.vx * dt;
        dp.y += dp.vy * dt;
        dp.z += dp.vz * dt;
        dp.rot += dp.vRot * dt;

        if (dp.y <= dp.floorY) {
          dp.y = dp.floorY;
          if (dp.vy < -1.6) {
            dp.vy = Math.abs(dp.vy) * 0.36;
            dp.vx *= 0.68;
            dp.vz *= 0.68;
            dp.vRot *= 0.55;
          } else {
            dp.vy = 0;
            dp.vx *= 0.88;
            dp.vz *= 0.88;
            dp.vRot *= 0.82;
          }
        }

        if (!projectInto(dp.x, dp.y, dp.z, pScratchTmp)) continue;
        const sc = pScratchTmp.scale;
        const sx = Math.round(pScratchTmp.x);
        const sy = Math.round(pScratchTmp.y);
        const partFade = Math.min(1, dp.life / 0.45);
        ctx.save();
        ctx.globalAlpha = partFade;
        ctx.translate(sx, sy);
        ctx.rotate(dp.rot);

        if (dp.partId === 'front_bumper' || dp.partId === 'rear_bumper') {
          const w = Math.min(30, Math.max(6, Math.round(0.76 * sc)));
          const h = Math.min(10, Math.max(3, Math.round(0.24 * sc)));
          ctx.fillStyle = '#090d16';
          ctx.fillRect(-w * 0.5 - 1, -h * 0.5 - 1, w + 2, h + 2);
          ctx.fillStyle = dp.color;
          ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-w * 0.35, -h * 0.15, w * 0.7, Math.max(1, Math.round(h * 0.45)));
        } else if (dp.partId === 'hood' || dp.partId === 'roof') {
          const w = Math.min(28, Math.max(6, Math.round(0.68 * sc)));
          const h = Math.min(18, Math.max(4, Math.round(0.45 * sc)));
          ctx.fillStyle = '#090d16';
          ctx.fillRect(-w * 0.5 - 1, -h * 0.5 - 1, w + 2, h + 2);
          ctx.fillStyle = dp.color;
          ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillRect(-w * 0.42, -h * 0.35, w * 0.84, Math.max(1, Math.round(h * 0.16)));
        } else if (dp.partId === 'spoiler') {
          const w = Math.min(32, Math.max(7, Math.round(0.82 * sc)));
          const h = Math.min(7, Math.max(2, Math.round(0.16 * sc)));
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
          ctx.fillStyle = dp.accentColor;
          ctx.fillRect(-w * 0.5, -h * 0.8, 2, Math.max(2, h + 2));
          ctx.fillRect(w * 0.5 - 2, -h * 0.8, 2, Math.max(2, h + 2));
        } else if (dp.partId === 'windshield') {
          const w = Math.min(24, Math.max(5, Math.round(0.60 * sc)));
          const h = Math.min(11, Math.max(3, Math.round(0.28 * sc)));
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.5, 1);
        } else if (dp.partId === 'wheel') {
          const r = Math.min(13, Math.max(3.5, Math.round(0.32 * sc)));
          ctx.fillStyle = '#090d16';
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = dp.accentColor || '#cbd5e1';
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(1.8, r * 0.56), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-r * 0.45, -1, r * 0.9, 2);
          ctx.fillRect(-1, -r * 0.45, 2, r * 0.9);
        } else {
          // Left / Right door
          const w = Math.min(25, Math.max(5, Math.round(0.60 * sc)));
          const h = Math.min(13, Math.max(4, Math.round(0.32 * sc)));
          ctx.fillStyle = '#090d16';
          ctx.fillRect(-w * 0.5 - 1, -h * 0.5 - 1, w + 2, h + 2);
          ctx.fillStyle = dp.color;
          ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-w * 0.35, -h * 0.42, w * 0.7, Math.max(1, Math.round(h * 0.35)));
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(0, 0, Math.max(2, Math.round(w * 0.25)), 1);
        }
        ctx.restore();
      }

      // K2. Ambient Biome Particles (Forest Fireflies / Cave Crystal Spores / Sakura Petals / Neon Cyber Orbs)
      if (playerAdvZone) {
        const inCaveNow = playerAdvZone.caveBlend > 0.35;
        for (let i = 0; i < ambientParticles.length; i++) {
          const ap = ambientParticles[i];
          ap.sx += (Math.sin(now * 0.0025 + ap.phase) * 10 - (inCaveNow ? 0 : 4)) * HD_UI_SCALE * dt;
          ap.sy += (inCaveNow ? -ap.vy * 0.45 : ap.vy * 0.35 + Math.cos(now * 0.003 + ap.phase) * 8) * HD_UI_SCALE * dt;
          if (ap.sx < -4) ap.sx = pxW + 2;
          if (ap.sx > pxW + 4) ap.sx = -2;
          if (ap.sy < -4) ap.sy = pxH + 2;
          if (ap.sy > pxH + 4) ap.sy = -2;

          const pRad = Math.max(1.1, ap.size * 0.48 * HD_UI_SCALE);
          ctx.beginPath();
          ctx.arc(ap.sx, ap.sy, pRad * 1.9, 0, Math.PI * 2);
          ctx.fillStyle = inCaveNow ? 'rgba(56, 189, 248, 0.16)' : 'rgba(190, 242, 100, 0.16)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ap.sx, ap.sy, pRad, 0, Math.PI * 2);
          ctx.fillStyle = inCaveNow
            ? i % 2 === 0
              ? playerAdvZone.chapter.crystalPrimary
              : playerAdvZone.chapter.lanternGlow
            : i % 3 === 0
            ? 'rgba(190, 242, 100, 0.82)'
            : i % 3 === 1
            ? 'rgba(253, 230, 138, 0.78)'
            : 'rgba(134, 239, 172, 0.78)';
          ctx.fill();
        }
      } else if (biome.ambientParticle !== 'none') {
        for (let i = 0; i < ambientParticles.length; i++) {
          const ap = ambientParticles[i];
          if (biome.ambientParticle === 'petal') {
            ap.sx += (ap.vx + Math.sin(now * 0.003 + ap.phase) * 14) * HD_UI_SCALE * dt;
            ap.sy += ap.vy * HD_UI_SCALE * dt;
          } else if (biome.ambientParticle === 'neon_orb') {
            ap.sx += Math.sin(now * 0.002 + ap.phase) * 8 * HD_UI_SCALE * dt;
            ap.sy -= ap.vy * 0.65 * HD_UI_SCALE * dt;
          } else {
            // Canyon rising embers
            ap.sx += Math.sin(now * 0.004 + ap.phase) * 12 * HD_UI_SCALE * dt;
            ap.sy -= ap.vy * 0.9 * HD_UI_SCALE * dt;
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
                ? 'rgba(34, 211, 238, 0.72)'
                : 'rgba(244, 114, 182, 0.72)'
              : 'rgba(251, 146, 60, 0.78)';
          const pRad = Math.max(1.1, ap.size * 0.48 * HD_UI_SCALE);
          ctx.beginPath();
          if (biome.ambientParticle === 'petal') {
            ctx.ellipse(ap.sx, ap.sy, pRad * 1.4, pRad * 0.75, ap.phase + now * 0.003, 0, Math.PI * 2);
          } else {
            ctx.arc(ap.sx, ap.sy, pRad, 0, Math.PI * 2);
          }
          ctx.fill();
        }
      }

      // L. Crisp Floating Callouts (precomputed halfW & O(1) swap-remove)
      if (callouts.length > 0) {
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(8.5 * HD_UI_SCALE)}px "Chakra Petch", monospace`;
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
          const tx = Math.max(halfW, Math.min(pxW - halfW, pScratchTmp.x));
          const ty = Math.max(44 * HD_UI_SCALE, Math.min(pxH - 86 * HD_UI_SCALE, pScratchTmp.y));
          ctx.fillStyle = '#090d16';
          ctx.fillText(ft.text, tx + 1.5, ty + 1.5);
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

        const tx = pScratchTmp.x;
        const ty = pScratchTmp.y;
        if (tx < -60 || tx > pxW + 60 || ty < -30 || ty > pxH + 30) continue;

        const alpha = Math.max(0, Math.min(1, ftp.life / (ftp.maxLife * 0.4)));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.round(9 * HD_UI_SCALE)}px "Chakra Petch", monospace`;
        ctx.textAlign = 'center';

        // Drop shadow outline for crisp readability
        ctx.fillStyle = '#090d16';
        ctx.fillText(ftp.text, tx + 1.5, ty + 1.5);

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
            ctx.lineWidth = Math.max(1.2, HD_UI_SCALE);
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = -(now * 0.08);
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
                ctx.moveTo(pScratchTmp2.x, pScratchTmp2.y);
                ctx.lineTo(pScratchTmp.x + side * 12 * HD_UI_SCALE, pScratchTmp.y - 6 * HD_UI_SCALE);
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
        ctx.lineWidth = Math.max(1.2, 1.05 * HD_UI_SCALE);
        const streakCount = isFever ? 14 : slipstreamBoostTimer > 0 ? 10 : 7;
        const vpX = pxW * 0.5;
        const vpY = horizonY * 0.92;
        ctx.beginPath();
        for (let s = 0; s < streakCount; s++) {
          const ang = (s / streakCount) * Math.PI * 2 + (s % 2 === 0 ? 0.14 : -0.14);
          const rStart = (54 + ((now * 0.28 + s * 29) % 48)) * HD_UI_SCALE;
          const rEnd = rStart + (isFever ? 24 : 16) * HD_UI_SCALE;
          ctx.moveTo(vpX + Math.cos(ang) * rStart, vpY + Math.sin(ang) * rStart * 1.15);
          ctx.lineTo(vpX + Math.cos(ang) * rEnd, vpY + Math.sin(ang) * rEnd * 1.15);
        }
        ctx.stroke();
      }

      // N. Calm Radial Velocity Vignette (cached gradient by viewport, zero per-frame allocation)
      const currentKmh = curSpeedNow * 7.2;
      const showSpeedVignette = phase === 'playing' && (isFever || currentKmh > 185);
      if (showSpeedVignette) {
        const dimKey = `${pxW}x${pxH}`;
        if (cachedVigDimKey !== dimKey || !cachedFeverVigGrad || !cachedSpeedVigGrad) {
          cachedVigDimKey = dimKey;
          const cx = pxW * 0.5;
          const cy = pxH * 0.5;
          const rInner = Math.min(pxW, pxH) * 0.44;
          const rOuter = Math.hypot(cx, cy);
          cachedFeverVigGrad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
          cachedFeverVigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          cachedFeverVigGrad.addColorStop(0.72, 'rgba(34, 211, 238, 0.08)');
          cachedFeverVigGrad.addColorStop(1, 'rgba(34, 211, 238, 0.22)');

          cachedSpeedVigGrad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
          cachedSpeedVigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          cachedSpeedVigGrad.addColorStop(0.72, 'rgba(251, 191, 36, 0.06)');
          cachedSpeedVigGrad.addColorStop(1, 'rgba(251, 191, 36, 0.18)');
        }
        if (isFever) {
          ctx.fillStyle = cachedFeverVigGrad;
          ctx.fillRect(0, 0, pxW, pxH);
        } else {
          const speedStrength = Math.min(1, (currentKmh - 185) / 90);
          ctx.globalAlpha = speedStrength;
          ctx.fillStyle = cachedSpeedVigGrad;
          ctx.fillRect(0, 0, pxW, pxH);
          ctx.globalAlpha = 1.0;
        }
      }

      // O. Impact & Overdrive Screen Flash Overlay
      if (screenFlashAlpha > 0.01) {
        ctx.globalAlpha = Math.min(0.85, screenFlashAlpha);
        ctx.fillStyle = screenFlashColor;
        ctx.fillRect(0, 0, pxW, pxH);
        ctx.globalAlpha = 1.0;
      }

      scheduleNextFrame(phase === 'gameover' ? 120 : 0);
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (idleTimerId !== null) window.clearTimeout(idleTimerId);
      soundFX.stopEngineSound();
      webglWorld?.dispose();
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
    <div className="fixed inset-0 w-full h-full select-none touch-none overflow-hidden">
      <div
        ref={webglMountRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <canvas
        ref={canvasRef}
        className="relative z-10 w-full h-full block select-none touch-none"
        data-testid="drift-2d-canvas"
      />
    </div>
  );
});
