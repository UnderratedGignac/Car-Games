/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CarCustomization, CarSpec, TrafficVehicleKind, resolveCarAppearance } from './rules';

/**
 * True Integer-Pixel 3D-Projected Car Sprite Renderer (112x84)
 * Renders each car's genuine 3D low-poly silhouette (widebody fenders, fastback glass,
 * pickup bed, rally box arches, counter-steered deep-dish rims, wings, and custom mods)
 * into a software Z-buffered Uint32Array pixel grid with:
 * - Zero anti-aliased edge blur
 * - Automatic crisp 1px dark pixel ink outline pass (#090d16)
 * - 3-tone cel shading, glossy specular strips, and teal glass glare
 * - True continuous 3D yaw from rear chase (0) to 3/4 isometric drift ('/' or '\')
 */

const W = 144;
const H = 108;
const TW = 112;
const TH = 84;
const MAX_HERO_CACHE = 640;
const MAX_TRAFFIC_CACHE = 640;
const spriteCache = new Map<string, HTMLCanvasElement>();

// Reusable software rasterizer scratch buffers (zero TypedArray / ImageData / scratch-canvas churn on misses)
const heroColorBuf = new Uint32Array(W * H);
const heroDepthBuf = new Float32Array(W * H);
const heroOutlinedBuf = new Uint32Array(W * H);
const heroFinalBuf = new Uint32Array(W * H);
let heroScratchCanvas: HTMLCanvasElement | null = null;
let heroScratchCtx: CanvasRenderingContext2D | null = null;
let heroScratchImgData: ImageData | null = null;

const trColorBuf = new Uint32Array(TW * TH);
const trDepthBuf = new Float32Array(TW * TH);
const trOutlinedBuf = new Uint32Array(TW * TH);
let trScratchCanvas: HTMLCanvasElement | null = null;
let trScratchCtx: CanvasRenderingContext2D | null = null;
let trScratchImgData: ImageData | null = null;

let lastHeroCarRef: CarSpec | null = null;
let lastHeroCustomRef: Partial<CarCustomization> | undefined = undefined;
let lastHeroResolved: ReturnType<typeof resolveCarAppearance> | null = null;
let lastHeroModKey = 'stock';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ScreenPt {
  x: number;
  y: number;
  z: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function scaleRgb(rgb: [number, number, number], f: number): [number, number, number] {
  return [
    Math.min(255, Math.max(0, Math.round(rgb[0] * f))),
    Math.min(255, Math.max(0, Math.round(rgb[1] * f))),
    Math.min(255, Math.max(0, Math.round(rgb[2] * f))),
  ];
}

function packAbgr(r: number, g: number, b: number, a = 255): number {
  return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

function packHex(hex: string, a = 255): number {
  const [r, g, b] = hexToRgb(hex);
  return packAbgr(r, g, b, a);
}

// Crisp 3x5 pixel bitmap glyphs for digits 0-9 so racing numbers never blur!
const PIXEL_DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

export interface TireAnchorNorm {
  u: number; // 0..1 across 144px sprite width
  v: number; // 0..1 across 108px sprite height
  isCameraFacing: boolean;
}

export interface CarTireAnchors {
  rearLeft: TireAnchorNorm;
  rearRight: TireAnchorNorm;
  frontLeft: TireAnchorNorm;
  frontRight: TireAnchorNorm;
  dirSign: -1 | 1;
  tireWidthScale: number;
}

const tireAnchorCache = new Map<string, CarTireAnchors>();
const MAX_TIRE_ANCHOR_CACHE = 256;

function getCarWheelDims(car: CarSpec) {
  const shape = car.bodyShape || 'coupe';
  const isKei = shape === 'kei';
  const isTruck = shape === 'truck';
  const isSemi = shape === 'semi';
  const isVan = shape === 'van';
  const isFormula = shape === 'formula';
  const isMotorcycle = shape === 'motorcycle' || shape === 'cyber_bike';
  const isRally = shape === 'rally';
  const isPrototype = shape === 'prototype';
  const isGt3 = shape === 'gt3';
  const isWagon = shape === 'wagon';
  const isInterceptor = shape === 'interceptor';
  const isMuscle = shape === 'muscle';

  const hw = isMotorcycle
    ? 0.38
    : isFormula
    ? 0.44
    : isSemi
    ? 1.15
    : isTruck || isVan
    ? 1.06
    : isKei
    ? 0.90
    : isPrototype
    ? 1.09
    : isGt3 || isMuscle
    ? 1.07
    : isWagon
    ? 1.04
    : isRally || isInterceptor
    ? 1.03
    : 1.02;
  const zRear = isKei ? -1.75 : isSemi ? -2.25 : isTruck || isWagon || isVan ? -2.14 : isMotorcycle ? -1.65 : -2.06;
  const zFront = isKei ? 1.75 : isFormula ? 2.30 : isPrototype ? 2.18 : isMotorcycle ? 1.70 : 2.10;
  return {
    hw,
    wheelZRear: zRear + 0.68,
    wheelZFront: zFront - 0.62,
    isMuscle,
    isMotorcycle,
    isFormula,
    isSemi,
  };
}

/**
 * Returns the exact normalized [0..1] screen-sprite contact patch coordinates of all 4 tires
 * for the active quantized drift pose, matching getPixelCarCanvas pixel-for-pixel.
 */
export function getPixelCarTireAnchors(
  car: CarSpec,
  driftAngleNorm: number,
  custom?: Partial<CarCustomization>
): CarTireAnchors {
  const angleBucket = Math.max(-6, Math.min(6, Math.round(driftAngleNorm * 6)));
  const tireId = custom?.tires || 'stock';
  const key = `${car.id}_${angleBucket}_${tireId}`;
  const cached = tireAnchorCache.get(key);
  if (cached) return cached;

  const { hw, wheelZRear, wheelZFront, isMuscle, isMotorcycle, isFormula, isSemi } = getCarWheelDims(car);
  const dirSign: -1 | 1 = angleBucket < 0 ? -1 : 1;
  const absNorm = Math.abs(angleBucket) / 6;
  const yaw = angleBucket === 0 ? 0.0 : 0.10 + absNorm * 0.64;
  const pitch = 0.37;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const cx = W * 0.5;
  const cy = H * 0.65;
  const scale = 24.8;

  const projAnchor = (vx: number, vy: number, vz: number, isCameraFacing: boolean): TireAnchorNorm => {
    const rx = vx * cosY + vz * sinY;
    const rz = -vx * sinY + vz * cosY;
    const py = vy * cosP + rz * sinP;
    const depth = rz * cosP - vy * sinP;
    const persp = 1 / (1 + depth * 0.06);
    const pxRaw = cx + rx * scale * persp;
    const pyRaw = cy - py * scale * persp;
    const finalX = dirSign < 0 ? W - 1 - pxRaw : pxRaw;
    return {
      u: finalX / W,
      v: pyRaw / H,
      isCameraFacing,
    };
  };

  // Bottom contact patch (y = 0.02) of inner/outer rear and front tires
  let rA: TireAnchorNorm;
  let rB: TireAnchorNorm;
  let fA: TireAnchorNorm;
  let fB: TireAnchorNorm;

  if (isMotorcycle) {
    rA = projAnchor(-0.06, 0.02, wheelZRear, false);
    rB = projAnchor(0.06, 0.02, wheelZRear, true);
    fA = projAnchor(-0.04, 0.02, wheelZFront, false);
    fB = projAnchor(0.04, 0.02, wheelZFront, true);
  } else if (isFormula) {
    rA = projAnchor(-1.12, 0.02, wheelZRear, false);
    rB = projAnchor(1.12, 0.02, wheelZRear, true);
    fA = projAnchor(-1.08, 0.02, wheelZFront, false);
    fB = projAnchor(1.08, 0.02, wheelZFront, true);
  } else if (isSemi) {
    rA = projAnchor(-hw - 0.08, 0.02, wheelZRear, false);
    rB = projAnchor(hw + 0.22, 0.02, wheelZRear, true);
    fA = projAnchor(-hw + 0.24, 0.02, wheelZFront, false);
    fB = projAnchor(hw - 0.10, 0.02, wheelZFront, true);
  } else {
    rA = projAnchor(-hw + 0.24, 0.02, wheelZRear, false);
    rB = projAnchor(hw - 0.10, 0.02, wheelZRear, true);
    fA = projAnchor(-hw + 0.24, 0.02, wheelZFront, false);
    fB = projAnchor(hw - 0.10, 0.02, wheelZFront, true);
  }

  const rearLeft = rA.u <= rB.u ? rA : rB;
  const rearRight = rA.u <= rB.u ? rB : rA;
  const frontLeft = fA.u <= fB.u ? fA : fB;
  const frontRight = fA.u <= fB.u ? fB : fA;

  const tireWidthScale =
    tireId === 'drag_slick'
      ? 1.45
      : isMuscle
      ? 1.22
      : tireId === 'drift_spec'
      ? 1.18
      : 1.0;

  const result: CarTireAnchors = {
    rearLeft,
    rearRight,
    frontLeft,
    frontRight,
    dirSign,
    tireWidthScale,
  };
  if (tireAnchorCache.size >= MAX_TIRE_ANCHOR_CACHE) {
    const oldest = tireAnchorCache.keys().next().value;
    if (oldest !== undefined) tireAnchorCache.delete(oldest);
  }
  tireAnchorCache.set(key, result);
  return result;
}

/**
 * Generates or retrieves cached 144x108 integer pixel-art sprite for the hero car.
 * Supports continuous 360-degree rotation (customYawRad) for garage showcase turntable!
 */
export function getPixelCarCanvas(
  car: CarSpec,
  driftAngleNorm: number, // -1.0 ('\') .. 0 .. +1.0 ('/')
  isFever: boolean,
  isWrecked: boolean,
  wheelPhase = 0,
  custom?: Partial<CarCustomization>,
  pedalMode: 'coast' | 'gas' | 'brake' = 'coast',
  isFlashing = false,
  customYawRad?: number,
  customPitchRad?: number
): HTMLCanvasElement {
  let resolved: ReturnType<typeof resolveCarAppearance>;
  let modKey: string;
  if (lastHeroResolved && lastHeroCarRef === car && lastHeroCustomRef === custom) {
    resolved = lastHeroResolved;
    modKey = lastHeroModKey;
  } else {
    resolved = resolveCarAppearance(car, custom);
    modKey = custom || resolved.roof !== 'stock' || resolved.exhaust !== 'stock'
      ? `${resolved.primaryColor}_${resolved.livery}_${resolved.spoilerStyle}_${resolved.rimHex}_${resolved.underglowHex || 'none'}_${resolved.flameOuter}_${resolved.number}_${resolved.roof}_${resolved.tires}_${resolved.exhaust}_${resolved.hood}_${resolved.windows}_${resolved.lights}`
      : 'stock';
    lastHeroCarRef = car;
    lastHeroCustomRef = custom;
    lastHeroResolved = resolved;
    lastHeroModKey = modKey;
  }

  const isCustomYaw = typeof customYawRad === 'number';
  // Straight driving keeps an exact normal straight rear stance 0.0 rad (|);
  // lane weaves smoothly tilt 0.18-0.38 rad, and full drift swings up to 0.78 rad diagonal!
  const angleBucket = Math.max(-6, Math.min(6, Math.round(driftAngleNorm * 6)));
  const dirSign = isCustomYaw ? 1 : angleBucket < 0 ? -1 : 1;
  const absNorm = isCustomYaw ? 0.5 : Math.abs(angleBucket) / 6; // 0 .. 1

  const yaw = isCustomYaw
    ? customYawRad
    : angleBucket === 0
    ? 0.0
    : 0.10 + absNorm * 0.64;
  const pitch = typeof customPitchRad === 'number' ? customPitchRad : 0.37; // elevated chase tilt

  const spinFrame = Math.floor(wheelPhase) % 2;
  const angleKey = isCustomYaw
    ? `yaw_${Math.round(customYawRad * 72)}`
    : `${angleBucket}`;
  const key = `${car.id}_${angleKey}_${isFever ? 1 : 0}_${isWrecked ? 1 : 0}_${spinFrame}_${pedalMode}_${isFlashing ? 1 : 0}_${modKey}`;

  const cached = spriteCache.get(key);
  if (cached) return cached;

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  // Project 3D car-local coordinate to 144x108 pixel space (exact 4:3 aspect match)
  const cx = W * 0.5;
  const cy = H * 0.65;
  const scale = 24.8;

  const project = (v: Vec3): ScreenPt => {
    // Rotate around Y (yaw): +Z nose swings upper-right, -Z rear swings lower-left, +X side faces camera
    const rx = v.x * cosY + v.z * sinY;
    const rz = -v.x * sinY + v.z * cosY;
    const ry = v.y;
    // Tilt camera downward from behind: further away (+rz) rises UP (+py), closer (-rz) sits LOWER (-py)
    const py = ry * cosP + rz * sinP;
    const depth = rz * cosP - ry * sinP;

    // Gentle perspective compression (closer = slightly larger)
    const persp = 1 / (1 + depth * 0.06);
    return {
      x: cx + rx * scale * persp,
      y: cy - py * scale * persp,
      z: depth,
    };
  };

  // Reuse pre-allocated software Z-buffer + ABGR pixel buffer
  const colorBuf = heroColorBuf;
  const depthBuf = heroDepthBuf;
  colorBuf.fill(0);
  depthBuf.fill(Infinity);

  const plot = (px: number, py: number, pz: number, col: number) => {
    const ix = px | 0;
    const iy = py | 0;
    if (ix < 1 || ix >= W - 1 || iy < 1 || iy >= H - 1) return;
    const idx = iy * W + ix;
    if (pz <= depthBuf[idx]) {
      depthBuf[idx] = pz;
      colorBuf[idx] = col;
    }
  };

  // Scanline integer triangle rasterizer with interpolated depth
  const fillTri3D = (a: Vec3, b: Vec3, c: Vec3, col: number, zBias = 0) => {
    const p0 = project(a);
    const p1 = project(b);
    const p2 = project(c);

    // Backface cull optional — we draw double-sided for thin spoilers/skirts, or keep clean
    const minX = Math.max(1, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(W - 2, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(1, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(H - 2, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    if (Math.abs(area) < 0.05) return;
    const invArea = 1 / area;

    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((p1.x - px) * (p2.y - py) - (p1.y - py) * (p2.x - px)) * invArea;
        const w1 = ((p2.x - px) * (p0.y - py) - (p2.y - py) * (p0.x - px)) * invArea;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) {
          const z = w0 * p0.z + w1 * p1.z + w2 * p2.z + zBias;
          plot(x, y, z, col);
        }
      }
    }
  };

  const fillQuad3D = (a: Vec3, b: Vec3, c: Vec3, d: Vec3, col: number, zBias = 0) => {
    fillTri3D(a, b, c, col, zBias);
    fillTri3D(a, c, d, col, zBias);
  };

  // Palette setup for 3-tone crisp cel/pixel shading
  const baseRgb = isWrecked ? hexToRgb('#52525b') : hexToRgb(resolved.primaryColor);
  const colBodyMain = packAbgr(...baseRgb);
  const colBodyLight = packAbgr(...scaleRgb(baseRgb, 1.32));
  const colBodyTop = packAbgr(...scaleRgb(baseRgb, 1.16));
  const colBodyMidShade = packAbgr(...scaleRgb(baseRgb, 0.78));
  const colBodyDark = packAbgr(...scaleRgb(baseRgb, 0.52));

  const accentRgb = hexToRgb(resolved.accentColor);
  const colAccent = packAbgr(...accentRgb);
  const colAccentDark = packAbgr(...scaleRgb(accentRgb, 0.65));

  const colCarbon = packHex('#181c26');
  const colWheelWell = packHex('#0b0f17');
  const colCarbonSpec = packHex('#334155');
  const colGlassDark = packHex(resolved.windowDarkHex);
  const colGlassMid = packHex(resolved.windowMidHex);
  const colGlassSpec = isFever ? packHex('#67e8f9') : packHex(resolved.windowSpecHex);
  const colWhite = packHex('#f8fafc');
  const isBraking = pedalMode === 'brake' && !isWrecked;
  const colTail = isBraking ? packHex('#ff2e2e') : packHex(car.tailGlowColor);
  const colTailCore = isBraking ? packHex('#fecaca') : packHex('#fca5a5');
  const colAmber = packHex('#fef08a');
  const colHeadlightLens = packHex(resolved.headlightLensHex);
  const colHeadlightBeam = packHex(resolved.headlightBeamHex);
  const colTire = packHex('#141519');
  const colTireSide = packHex('#27272a');
  const colTireStripe = resolved.tireStripeHex ? packHex(resolved.tireStripeHex) : null;
  const colRim = packHex(resolved.rimHex);
  const colRimSpec = packHex('#ffffff');
  const colBrakeGlow = packHex('#f97316');
  const colBurntTi = packHex('#38bdf8');
  const colEngineBlock = packHex('#94a3b8');
  const colEngineHeader = packHex('#ef4444');
  const colSeam = packAbgr(...scaleRgb(baseRgb, 0.36));

  // Car Proportions (custom tailored per bodyShape class!)
  const shape = car.bodyShape || 'coupe';
  const isKei = shape === 'kei';
  const isTruck = shape === 'truck';
  const isRally = shape === 'rally';
  const isSupercar = shape === 'supercar' || shape === 'prototype';
  const isPrototype = shape === 'prototype';
  const isGt3 = shape === 'gt3';
  const isWagon = shape === 'wagon';
  const isInterceptor = shape === 'interceptor';
  const isMuscle = shape === 'muscle';
  const isRoadster = shape === 'roadster';
  const isMotorcycle = shape === 'motorcycle' || shape === 'cyber_bike';
  const isCyberBike = shape === 'cyber_bike';
  const isSemi = shape === 'semi';
  const isVan = shape === 'van';
  const isFormula = shape === 'formula';
  const isClassic = shape === 'classic';
  const isSuv = shape === 'suv';

  const hw = isMotorcycle
    ? 0.38
    : isFormula
    ? 0.44
    : isSemi
    ? 1.15
    : isTruck || isVan || isSuv
    ? 1.06
    : isKei
    ? 0.90
    : isPrototype
    ? 1.09
    : isGt3 || isMuscle
    ? 1.07
    : isWagon || isClassic
    ? 1.04
    : isRally || isInterceptor
    ? 1.03
    : 1.02;
  const zRear = isKei
    ? -1.75
    : isSemi
    ? -2.25
    : isTruck || isWagon || isVan || isSuv
    ? -2.14
    : isMotorcycle
    ? -1.65
    : -2.06;
  const zFront = isKei ? 1.75 : isFormula ? 2.30 : isPrototype ? 2.18 : isMotorcycle ? 1.70 : 2.10;
  const zTrunk = isTruck ? -0.18 : isWagon || isVan || isSuv ? zRear + 0.14 : zRear + 0.55;
  const zRearGlassTop = isKei
    ? zRear + 0.35
    : isWagon || isVan || isSuv
    ? zRear + 0.28
    : isTruck
    ? -0.05
    : isRally
    ? zRear + 0.72
    : zRear + 0.95;
  const zFrontGlassTop =
    isSupercar || isGt3 || isInterceptor
      ? 0.36
      : isTruck || isSemi
      ? 0.55
      : isVan || isSuv
      ? 0.45
      : isFormula
      ? 0.50
      : 0.25;
  const zHoodBase =
    isSupercar || isPrototype
      ? 0.88
      : isTruck || isSemi
      ? 0.96
      : isVan
      ? 1.15
      : isFormula
      ? 0.55
      : 0.72;

  const yFloor = 0.22;
  const yBeltRear =
    isPrototype
      ? 0.80
      : isSupercar || isGt3
      ? 0.85
      : isTruck || isSemi
      ? 0.96
      : isVan || isSuv
      ? 0.92
      : 0.88;
  const yBeltFront =
    isPrototype
      ? 0.66
      : isSupercar || isGt3
      ? 0.72
      : isTruck || isSemi
      ? 0.90
      : isVan || isSuv
      ? 0.86
      : 0.78;
  const yNose =
    isPrototype
      ? 0.44
      : isSupercar || isGt3
      ? 0.49
      : isTruck || isSemi
      ? 0.72
      : isVan
      ? 0.68
      : isFormula
      ? 0.36
      : 0.56;
  const yRoof = isKei
    ? 1.38
    : isSemi
    ? 1.56
    : isTruck || isVan || isSuv
    ? 1.42
    : isRally || isWagon
    ? 1.32
    : isPrototype
    ? 1.08
    : isSupercar || isGt3 || isInterceptor
    ? 1.17
    : isRoadster
    ? 1.04
    : isFormula
    ? 0.96
    : 1.24;

  // =========================================================================
  // 1. WHEELS & TIRES (with Counter-Steered Front Wheels + Deep-Dish Rims!)
  // =========================================================================
  const drawWheel3D = (
    wx: number,
    wz: number,
    rad: number,
    width: number,
    steerRad: number,
    showRim: boolean
  ) => {
    const segs = 14;
    const cs = Math.cos(steerRad);
    const ss = Math.sin(steerRad);
    const wyCenter = rad;
    const halfW = width * 0.5;
    const isLeftWheel = wx < 0;
    const outerSign = isLeftWheel ? -1 : 1;

    const rimOffsetPts: Vec3[] = [];
    const rimInnerPts: Vec3[] = [];
    const outerSidePts: Vec3[] = [];
    const innerSidePts: Vec3[] = [];

    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ly = Math.sin(a) * rad;
      const lz = Math.cos(a) * rad;

      const rotXOuter = outerSign * halfW * cs - lz * ss;
      const rotZOuter = outerSign * halfW * ss + lz * cs;
      const rotXInner = -outerSign * halfW * cs - lz * ss;
      const rotZInner = -outerSign * halfW * ss + lz * cs;

      outerSidePts.push({ x: wx + rotXOuter, y: wyCenter + ly, z: wz + rotZOuter });
      innerSidePts.push({ x: wx + rotXInner, y: wyCenter + ly, z: wz + rotZInner });

      const rimR = rad * 0.64;
      const rly = Math.sin(a) * rimR;
      const rlz = Math.cos(a) * rimR;
      rimOffsetPts.push({
        x: wx + outerSign * halfW * cs - rlz * ss + outerSign * 0.02,
        y: wyCenter + rly,
        z: wz + outerSign * halfW * ss + rlz * cs,
      });
      const spokeR = rad * 0.24;
      rimInnerPts.push({
        x: wx + outerSign * halfW * cs - Math.cos(a) * spokeR * ss + outerSign * 0.035,
        y: wyCenter + Math.sin(a) * spokeR,
        z: wz + outerSign * halfW * ss + Math.cos(a) * spokeR * cs,
      });
    }

    // Tire tread band
    for (let i = 0; i < segs; i++) {
      const n = (i + 1) % segs;
      fillQuad3D(outerSidePts[i], outerSidePts[n], innerSidePts[n], innerSidePts[i], colTire);
    }

    // Sidewall & Deep-Dish Rim on camera-facing wheels
    const centerOuter: Vec3 = { x: wx + outerSign * halfW * cs, y: wyCenter, z: wz + outerSign * halfW * ss };
    const centerInner: Vec3 = { x: wx - outerSign * halfW * cs, y: wyCenter, z: wz - outerSign * halfW * ss };
    for (let i = 0; i < segs; i++) {
      const n = (i + 1) % segs;
      fillTri3D(centerOuter, outerSidePts[i], outerSidePts[n], colTireSide, -0.01);
      fillTri3D(centerInner, innerSidePts[n], innerSidePts[i], colTire, 0.01);
    }

    if (showRim) {
      // Optional Tire Compound Sidewall Stripe / Whitewall / Neon Groove
      if (colTireStripe !== null) {
        const stripePts: Vec3[] = [];
        const sR = rad * 0.82;
        for (let i = 0; i < segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          const rly = Math.sin(a) * sR;
          const rlz = Math.cos(a) * sR;
          stripePts.push({
            x: wx + outerSign * halfW * cs - rlz * ss + outerSign * 0.01,
            y: wyCenter + rly,
            z: wz + outerSign * halfW * ss + rlz * cs,
          });
        }
        for (let i = 0; i < segs; i++) {
          const n = (i + 1) % segs;
          fillTri3D(centerOuter, stripePts[i], stripePts[n], colTireStripe, -0.025);
        }
        const coverPts: Vec3[] = [];
        const cR = rad * 0.71;
        for (let i = 0; i < segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          const rly = Math.sin(a) * cR;
          const rlz = Math.cos(a) * cR;
          coverPts.push({
            x: wx + outerSign * halfW * cs - rlz * ss + outerSign * 0.015,
            y: wyCenter + rly,
            z: wz + outerSign * halfW * ss + rlz * cs,
          });
        }
        for (let i = 0; i < segs; i++) {
          const n = (i + 1) % segs;
          fillTri3D(centerOuter, coverPts[i], coverPts[n], colTireSide, -0.03);
        }
      }

      for (let i = 0; i < segs; i++) {
        const n = (i + 1) % segs;
        fillTri3D(centerOuter, rimOffsetPts[i], rimOffsetPts[n], colRim, -0.04);
      }
      // 5 animated spinning spokes + dark hub cap + brake caliper
      const spokeOffset = spinFrame * 1;
      for (let s = 0; s < 5; s++) {
        const idxA = (s * 3 + spokeOffset) % segs;
        const idxB = (idxA + 1) % segs;
        fillQuad3D(centerOuter, rimInnerPts[idxA], rimOffsetPts[idxB], rimOffsetPts[idxA], colRimSpec, -0.07);
      }
      for (let i = 0; i < segs; i++) {
        const n = (i + 1) % segs;
        fillTri3D(centerOuter, rimInnerPts[i], rimInnerPts[n], colCarbon, -0.08);
      }
      fillTri3D(centerOuter, rimInnerPts[0], rimOffsetPts[1], colBrakeGlow, -0.055);
    }
  };

  const isDragTires = resolved.tires === 'drag_slick';
  const wRadRear = isDragTires ? 0.41 : isMuscle || isSemi ? 0.39 : isMotorcycle ? 0.36 : 0.35;
  const wRadFront = isMotorcycle ? 0.36 : isFormula ? 0.33 : 0.34;
  const rearTireW = isDragTires ? 0.44 : isMuscle ? 0.36 : isMotorcycle ? 0.16 : 0.32;
  const wheelZRear = zRear + 0.68;
  const wheelZFront = zFront - 0.62;
  const counterSteer = -0.34 * absNorm; // Counter-steered front wheels into the slide!

  if (isMotorcycle) {
    drawWheel3D(0, wheelZRear, wRadRear, rearTireW, 0, true);
    drawWheel3D(0, wheelZFront, wRadFront, 0.14, counterSteer, true);
  } else if (isFormula) {
    drawWheel3D(-1.12, wheelZRear, 0.38, 0.44, 0, true);
    drawWheel3D(1.12, wheelZRear, 0.38, 0.44, 0, true);
    drawWheel3D(-1.08, wheelZFront, 0.34, 0.32, counterSteer, true);
    drawWheel3D(1.08, wheelZFront, 0.34, 0.32, counterSteer, true);
  } else if (isSemi) {
    drawWheel3D(-hw + 0.24, wheelZRear, wRadRear, rearTireW, 0, true);
    drawWheel3D(hw - 0.10, wheelZRear, wRadRear, rearTireW, 0, true);
    drawWheel3D(hw + 0.22, wheelZRear, wRadRear, rearTireW, 0, true);
    drawWheel3D(-hw + 0.24, wheelZFront, wRadFront, 0.30, counterSteer, true);
    drawWheel3D(hw - 0.10, wheelZFront, wRadFront, 0.30, counterSteer, true);
  } else {
    drawWheel3D(-hw + 0.24, wheelZRear, wRadRear, rearTireW, 0, true);
    drawWheel3D(hw - 0.10, wheelZRear, wRadRear, rearTireW, 0, true);
    drawWheel3D(-hw + 0.24, wheelZFront, wRadFront, 0.28, counterSteer, true);
    drawWheel3D(hw - 0.10, wheelZFront, wRadFront, 0.28, counterSteer, true);
  }

  // =========================================================================
  // 2. 3D CHASSIS & BODY RASTERIZATION (MOTORCYCLE VS 4-WHEELED VEHICLES)
  // =========================================================================
  const exhaustStyle = resolved.exhaust;
  const showDoorRoundel =
    !isMotorcycle &&
    resolved.livery !== 'clean' &&
    (resolved.livery !== 'stock' || Boolean(car.decalText));

  if (isMotorcycle) {
    // -----------------------------------------------------------------------
    // MOTORCYCLE & CYBER BIKE 3D RASTERIZATION (SLIM CHASSIS + LEANING RIDER)
    // -----------------------------------------------------------------------
    const riderLeanX = dirSign * absNorm * 0.18;
    const colRiderSuit = colCarbon;
    const colRiderStripe = colAccent;
    const colHelmet = isCyberBike ? colAccentDark : colWhite;
    const colVisor = packHex('#38bdf8');

    // Swingarm & rear sprocket
    fillQuad3D(
      { x: -0.10, y: 0.30, z: wheelZRear + 0.38 },
      { x: 0.10, y: 0.30, z: wheelZRear + 0.38 },
      { x: 0.08, y: wRadRear, z: wheelZRear },
      { x: -0.08, y: wRadRear, z: wheelZRear },
      colCarbonSpec
    );
    // Lower engine block & transmission casing
    fillQuad3D(
      { x: -0.22, y: yFloor, z: -0.25 },
      { x: 0.22, y: yFloor, z: -0.25 },
      { x: 0.20, y: 0.68, z: 0.55 },
      { x: -0.20, y: 0.68, z: 0.55 },
      colEngineBlock
    );
    fillQuad3D(
      { x: 0.16, y: yFloor + 0.08, z: -0.15 },
      { x: 0.24, y: yFloor + 0.08, z: 0.40 },
      { x: 0.22, y: 0.62, z: 0.40 },
      { x: 0.16, y: 0.62, z: -0.15 },
      colCarbonSpec,
      -0.02
    );
    // Exhaust headers from engine
    for (const hx of [-0.08, 0.08]) {
      fillQuad3D(
        { x: hx - 0.03, y: 0.64, z: 0.50 },
        { x: hx + 0.03, y: 0.64, z: 0.50 },
        { x: hx + 0.03, y: yFloor + 0.05, z: 0.18 },
        { x: hx - 0.03, y: yFloor + 0.05, z: 0.18 },
        colRim,
        -0.03
      );
    }
    // High tail cowl / solo seat hump
    fillQuad3D(
      { x: -0.18, y: 0.74, z: wheelZRear },
      { x: 0.18, y: 0.74, z: wheelZRear },
      { x: 0.22, y: 0.82, z: -0.08 },
      { x: -0.22, y: 0.82, z: -0.08 },
      colBodyMain
    );
    fillQuad3D(
      { x: -0.14, y: 0.84, z: wheelZRear + 0.05 },
      { x: 0.14, y: 0.84, z: wheelZRear + 0.05 },
      { x: 0.18, y: 0.88, z: -0.05 },
      { x: -0.18, y: 0.88, z: -0.05 },
      colBodyLight,
      -0.02
    );
    // Rear LED taillight on tail cowl
    fillQuad3D(
      { x: -0.12, y: 0.75, z: wheelZRear - 0.02 },
      { x: 0.12, y: 0.75, z: wheelZRear - 0.02 },
      { x: 0.12, y: 0.83, z: wheelZRear },
      { x: -0.12, y: 0.83, z: wheelZRear },
      colTail,
      -0.03
    );
    // Black rider seat
    fillQuad3D(
      { x: -0.16, y: 0.76, z: -0.08 },
      { x: 0.16, y: 0.76, z: -0.08 },
      { x: 0.15, y: 0.78, z: 0.28 },
      { x: -0.15, y: 0.78, z: 0.28 },
      colTire
    );
    // Sculpted aerodynamic fuel tank
    fillQuad3D(
      { x: -0.25, y: 0.78, z: 0.26 },
      { x: 0.25, y: 0.78, z: 0.26 },
      { x: 0.22, y: 0.98, z: 0.74 },
      { x: -0.22, y: 0.98, z: 0.74 },
      colBodyMain
    );
    fillQuad3D(
      { x: -0.18, y: 0.99, z: 0.32 },
      { x: 0.18, y: 0.99, z: 0.32 },
      { x: 0.14, y: 1.02, z: 0.70 },
      { x: -0.14, y: 1.02, z: 0.70 },
      colBodyLight,
      -0.02
    );
    // Front fairing cowl & dual angled headlights
    fillQuad3D(
      { x: -0.24, y: 0.60, z: 0.72 },
      { x: 0.24, y: 0.60, z: 0.72 },
      { x: 0.20, y: 0.96, z: zFront },
      { x: -0.20, y: 0.96, z: zFront },
      colBodyMain
    );
    fillQuad3D(
      { x: 0.04, y: 0.66, z: zFront + 0.01 },
      { x: 0.18, y: 0.66, z: zFront + 0.01 },
      { x: 0.16, y: 0.76, z: zFront - 0.04 },
      { x: 0.04, y: 0.76, z: zFront - 0.04 },
      isFlashing ? colHeadlightBeam : colHeadlightLens,
      -0.03
    );
    fillQuad3D(
      { x: -0.18, y: 0.66, z: zFront + 0.01 },
      { x: -0.04, y: 0.66, z: zFront + 0.01 },
      { x: -0.04, y: 0.76, z: zFront - 0.04 },
      { x: -0.16, y: 0.76, z: zFront - 0.04 },
      isFlashing ? colHeadlightBeam : colHeadlightLens,
      -0.03
    );
    // Aerodynamic tinted windscreen
    fillQuad3D(
      { x: -0.18, y: 0.95, z: 0.74 },
      { x: 0.18, y: 0.95, z: 0.74 },
      { x: 0.14, y: 1.16, z: 0.96 },
      { x: -0.14, y: 1.16, z: 0.96 },
      colGlassDark,
      -0.02
    );
    fillTri3D(
      { x: -0.10, y: 1.14, z: 0.94 },
      { x: 0.02, y: 1.14, z: 0.94 },
      { x: -0.06, y: 0.98, z: 0.78 },
      colGlassSpec,
      -0.03
    );
    // Handlebars with bar-end grips
    fillQuad3D(
      { x: -0.34, y: 0.92, z: 0.78 },
      { x: 0.34, y: 0.92, z: 0.78 },
      { x: 0.34, y: 0.96, z: 0.82 },
      { x: -0.34, y: 0.96, z: 0.82 },
      colCarbonSpec,
      -0.02
    );
    // Telescopic front fork tubes to front axle
    for (const fx of [-0.10, 0.10]) {
      fillQuad3D(
        { x: fx - 0.02, y: wRadFront, z: wheelZFront },
        { x: fx + 0.02, y: wRadFront, z: wheelZFront },
        { x: fx + 0.02, y: 0.90, z: 0.85 },
        { x: fx - 0.02, y: 0.90, z: 0.85 },
        colRimSpec,
        -0.025
      );
    }

    // Leaning 3D Rider (Torso, Arms, Helmet & Visor!)
    const rtx = riderLeanX;
    fillQuad3D(
      { x: rtx - 0.20, y: 0.84, z: 0.06 },
      { x: rtx + 0.20, y: 0.84, z: 0.06 },
      { x: rtx + 0.22, y: 1.22, z: 0.52 },
      { x: rtx - 0.22, y: 1.22, z: 0.52 },
      colRiderSuit,
      -0.04
    );
    fillQuad3D(
      { x: rtx - 0.06, y: 0.86, z: 0.08 },
      { x: rtx + 0.08, y: 0.86, z: 0.08 },
      { x: rtx + 0.14, y: 1.22, z: 0.50 },
      { x: rtx, y: 1.22, z: 0.50 },
      colRiderStripe,
      -0.05
    );
    fillQuad3D(
      { x: rtx + 0.18, y: 1.16, z: 0.48 },
      { x: 0.28, y: 0.94, z: 0.78 },
      { x: 0.32, y: 0.97, z: 0.80 },
      { x: rtx + 0.22, y: 1.19, z: 0.50 },
      colRiderSuit,
      -0.045
    );
    fillQuad3D(
      { x: rtx - 0.15, y: 1.22, z: 0.38 },
      { x: rtx + 0.15, y: 1.22, z: 0.38 },
      { x: rtx + 0.14, y: 1.44, z: 0.60 },
      { x: rtx - 0.14, y: 1.44, z: 0.60 },
      colHelmet,
      -0.06
    );
    fillQuad3D(
      { x: rtx + 0.04, y: 1.28, z: 0.54 },
      { x: rtx + 0.14, y: 1.28, z: 0.58 },
      { x: rtx + 0.13, y: 1.38, z: 0.58 },
      { x: rtx + 0.04, y: 1.38, z: 0.54 },
      colVisor,
      -0.07
    );
  } else {
    // -----------------------------------------------------------------------
    // 4-WHEELED VEHICLES (CARS, TRUCKS, SEMIS, VANS, FORMULA RACERS)
    // -----------------------------------------------------------------------
    const rearLipColor = colCarbon;
    // Lower rear diffuser & bumper valance + vertical aero fins
    fillQuad3D(
      { x: -hw * 0.96, y: yFloor, z: zRear - 0.04 },
      { x: hw * 0.96, y: yFloor, z: zRear - 0.04 },
      { x: hw * 0.99, y: yFloor + 0.28, z: zRear - 0.02 },
      { x: -hw * 0.99, y: yFloor + 0.28, z: zRear - 0.02 },
      rearLipColor
    );
    for (const fx of [-0.30, -0.10, 0.10, 0.30]) {
      fillQuad3D(
        { x: fx - 0.025, y: yFloor - 0.01, z: zRear - 0.05 },
        { x: fx + 0.025, y: yFloor - 0.01, z: zRear - 0.05 },
        { x: fx + 0.025, y: yFloor + 0.24, z: zRear - 0.04 },
        { x: fx - 0.025, y: yFloor + 0.24, z: zRear - 0.04 },
        colCarbonSpec,
        -0.02
      );
    }

    // Upper rear fascia (bumper panel)
    fillQuad3D(
      { x: -hw * 0.99, y: yFloor + 0.28, z: zRear - 0.02 },
      { x: hw * 0.99, y: yFloor + 0.28, z: zRear - 0.02 },
      { x: hw * 0.96, y: yBeltRear, z: zRear + 0.06 },
      { x: -hw * 0.96, y: yBeltRear, z: zRear + 0.06 },
      colBodyDark
    );

    // Trunk / Rear Deck Top / Pickup Bed / Semi Fifth Wheel / Van Rear
    if (isTruck) {
      fillQuad3D(
        { x: -hw * 0.84, y: yBeltRear - 0.22, z: zRear + 0.12 },
        { x: hw * 0.84, y: yBeltRear - 0.22, z: zRear + 0.12 },
        { x: hw * 0.84, y: yBeltRear - 0.20, z: zTrunk },
        { x: -hw * 0.84, y: yBeltRear - 0.20, z: zTrunk },
        colCarbon
      );
      fillQuad3D(
        { x: -hw * 0.96, y: yBeltRear, z: zRear + 0.06 },
        { x: -hw * 0.84, y: yBeltRear, z: zRear + 0.06 },
        { x: -hw * 0.84, y: yBeltRear + 0.03, z: zTrunk },
        { x: -hw * 0.96, y: yBeltRear + 0.03, z: zTrunk },
        colBodyTop
      );
      fillQuad3D(
        { x: hw * 0.84, y: yBeltRear, z: zRear + 0.06 },
        { x: hw * 0.96, y: yBeltRear, z: zRear + 0.06 },
        { x: hw * 0.96, y: yBeltRear + 0.03, z: zTrunk },
        { x: hw * 0.84, y: yBeltRear + 0.03, z: zTrunk },
        colBodyTop
      );
      for (const rbx of [-0.66, 0.56]) {
        fillQuad3D(
          { x: rbx, y: yBeltRear, z: zTrunk - 0.14 },
          { x: rbx + 0.10, y: yBeltRear, z: zTrunk - 0.14 },
          { x: rbx + 0.10, y: yRoof + 0.06, z: zTrunk + 0.04 },
          { x: rbx, y: yRoof + 0.06, z: zTrunk + 0.04 },
          colRim,
          -0.02
        );
      }
      fillQuad3D(
        { x: -0.68, y: yRoof + 0.02, z: zTrunk + 0.02 },
        { x: 0.68, y: yRoof + 0.02, z: zTrunk + 0.02 },
        { x: 0.68, y: yRoof + 0.08, z: zTrunk + 0.08 },
        { x: -0.68, y: yRoof + 0.08, z: zTrunk + 0.08 },
        colRimSpec,
        -0.03
      );
    } else if (isSemi) {
      fillQuad3D(
        { x: -hw * 0.70, y: yFloor + 0.18, z: zRear + 0.20 },
        { x: hw * 0.70, y: yFloor + 0.18, z: zRear + 0.20 },
        { x: hw * 0.70, y: yFloor + 0.18, z: zTrunk },
        { x: -hw * 0.70, y: yFloor + 0.18, z: zTrunk },
        colCarbon
      );
      fillQuad3D(
        { x: -0.32, y: yFloor + 0.21, z: zRear + 0.45 },
        { x: 0.32, y: yFloor + 0.21, z: zRear + 0.45 },
        { x: 0.32, y: yFloor + 0.21, z: zRear + 0.85 },
        { x: -0.32, y: yFloor + 0.21, z: zRear + 0.85 },
        colRimSpec,
        -0.02
      );
    } else if (isVan) {
      fillQuad3D(
        { x: -hw * 0.94, y: yBeltRear, z: zRear + 0.04 },
        { x: hw * 0.94, y: yBeltRear, z: zRear + 0.04 },
        { x: hw * 0.90, y: yRoof - 0.05, z: zRear + 0.04 },
        { x: -hw * 0.90, y: yRoof - 0.05, z: zRear + 0.04 },
        colBodyDark,
        -0.01
      );
      fillQuad3D(
        { x: -hw * 0.76, y: yBeltRear + 0.10, z: zRear + 0.03 },
        { x: hw * 0.76, y: yBeltRear + 0.10, z: zRear + 0.03 },
        { x: hw * 0.76, y: yRoof - 0.12, z: zRear + 0.03 },
        { x: -hw * 0.76, y: yRoof - 0.12, z: zRear + 0.03 },
        colGlassMid,
        -0.02
      );
    } else {
      fillQuad3D(
        { x: -hw * 0.96, y: yBeltRear, z: zRear + 0.06 },
        { x: hw * 0.96, y: yBeltRear, z: zRear + 0.06 },
        { x: hw * 0.92, y: yBeltRear + 0.04, z: zTrunk },
        { x: -hw * 0.92, y: yBeltRear + 0.04, z: zTrunk },
        colBodyTop
      );
    }

    // Right Flank (Body Side + Widebody Flare + Side Skirt!)
    fillQuad3D(
      { x: hw * 0.99, y: yFloor + 0.14, z: zRear + 0.02 },
      { x: hw * 0.96, y: yFloor + 0.12, z: zFront - 0.06 },
      { x: hw * 0.94, y: yBeltFront, z: zFront - 0.10 },
      { x: hw * 0.96, y: yBeltRear, z: zRear + 0.06 },
      colBodyMidShade
    );

    // Crisp Glossy Side Shoulder Highlight Strip & Defined Door Cut-line + Handle
    fillQuad3D(
      { x: hw * 0.96, y: yBeltRear - 0.14, z: zRear + 0.08 },
      { x: hw * 0.94, y: yBeltFront - 0.10, z: zFront - 0.12 },
      { x: hw * 0.95, y: yBeltFront - 0.02, z: zFront - 0.12 },
      { x: hw * 0.97, y: yBeltRear - 0.02, z: zRear + 0.08 },
      colBodyLight,
      -0.02
    );
    fillQuad3D(
      { x: hw * 0.985, y: yFloor + 0.18, z: -0.52 },
      { x: hw * 0.985, y: yFloor + 0.18, z: -0.47 },
      { x: hw * 0.965, y: yBeltRear - 0.06, z: -0.47 },
      { x: hw * 0.965, y: yBeltRear - 0.06, z: -0.52 },
      colSeam,
      -0.025
    );
    fillQuad3D(
      { x: hw * 0.985, y: yBeltRear - 0.17, z: -0.34 },
      { x: hw * 0.985, y: yBeltRear - 0.17, z: -0.14 },
      { x: hw * 0.985, y: yBeltRear - 0.11, z: -0.14 },
      { x: hw * 0.985, y: yBeltRear - 0.11, z: -0.34 },
      colCarbonSpec,
      -0.03
    );

    // Carbon/Accent Side Skirt
    fillQuad3D(
      { x: hw * 1.01, y: yFloor, z: wheelZRear + 0.36 },
      { x: hw * 1.00, y: yFloor, z: wheelZFront - 0.34 },
      { x: hw * 0.98, y: yFloor + 0.15, z: wheelZFront - 0.34 },
      { x: hw * 0.99, y: yFloor + 0.15, z: wheelZRear + 0.36 },
      isSupercar ? colAccent : isRoadster ? colTail : colCarbon,
      -0.03
    );

    // Widebody Fender Flare Arches + Recessed Dark Wheel Well Cavities
    const drawFenderArch = (wz: number, wRad: number) => {
      if (isFormula) return; // Open wheel cars have no fender arches!
      const flareCol =
        car.id === 'blue_jdm' || car.id === 'crimson_tuner' || isRally ? colBodyLight : colBodyMain;
      const bulge = isRally ? hw * 1.07 : hw * 1.03;
      fillQuad3D(
        { x: hw * 0.97, y: yFloor - 0.02, z: wz - wRad * 1.15 },
        { x: hw * 0.97, y: yFloor - 0.02, z: wz + wRad * 1.15 },
        { x: hw * 0.96, y: wRad + 0.20, z: wz + wRad * 0.95 },
        { x: hw * 0.96, y: wRad + 0.20, z: wz - wRad * 0.95 },
        colWheelWell,
        -0.015
      );
      fillQuad3D(
        { x: bulge, y: wRad + 0.14, z: wz - 0.42 },
        { x: bulge, y: wRad + 0.14, z: wz + 0.42 },
        { x: hw * 0.98, y: wRad + 0.34, z: wz + (isRally ? 0.34 : 0.24) },
        { x: hw * 0.98, y: wRad + 0.34, z: wz - (isRally ? 0.34 : 0.24) },
        flareCol,
        -0.04
      );
    };
    drawFenderArch(wheelZRear, wRadRear);
    drawFenderArch(wheelZFront, wRadFront);

    // Left Flank (Complete symmetrical 3D geometry for full 360-degree rotation)
    fillQuad3D(
      { x: -hw * 0.96, y: yFloor + 0.12, z: zFront - 0.06 },
      { x: -hw * 0.99, y: yFloor + 0.14, z: zRear + 0.02 },
      { x: -hw * 0.96, y: yBeltRear, z: zRear + 0.06 },
      { x: -hw * 0.94, y: yBeltFront, z: zFront - 0.10 },
      colBodyDark
    );
    // Left Shoulder Highlight Strip
    fillQuad3D(
      { x: -hw * 0.94, y: yBeltFront - 0.10, z: zFront - 0.12 },
      { x: -hw * 0.96, y: yBeltRear - 0.14, z: zRear + 0.08 },
      { x: -hw * 0.97, y: yBeltRear - 0.02, z: zRear + 0.08 },
      { x: -hw * 0.95, y: yBeltFront - 0.02, z: zFront - 0.12 },
      colBodyMidShade,
      -0.02
    );
    // Left Door Cut & Handle
    fillQuad3D(
      { x: -hw * 0.985, y: yFloor + 0.18, z: -0.47 },
      { x: -hw * 0.985, y: yFloor + 0.18, z: -0.52 },
      { x: -hw * 0.965, y: yBeltRear - 0.06, z: -0.52 },
      { x: -hw * 0.965, y: yBeltRear - 0.06, z: -0.47 },
      colSeam,
      -0.025
    );
    fillQuad3D(
      { x: -hw * 0.985, y: yBeltRear - 0.17, z: -0.14 },
      { x: -hw * 0.985, y: yBeltRear - 0.17, z: -0.34 },
      { x: -hw * 0.985, y: yBeltRear - 0.11, z: -0.34 },
      { x: -hw * 0.985, y: yBeltRear - 0.11, z: -0.14 },
      colCarbonSpec,
      -0.03
    );
    // Left Side Skirt
    fillQuad3D(
      { x: -hw * 1.00, y: yFloor, z: wheelZFront - 0.34 },
      { x: -hw * 1.01, y: yFloor, z: wheelZRear + 0.36 },
      { x: -hw * 0.99, y: yFloor + 0.15, z: wheelZRear + 0.36 },
      { x: -hw * 0.98, y: yFloor + 0.15, z: wheelZFront - 0.34 },
      isSupercar ? colAccent : isRoadster ? colTail : colCarbon,
      -0.03
    );
    // Left Fender Flares
    const drawLeftFenderArch = (wz: number, wRad: number) => {
      if (isFormula) return;
      const flareCol =
        car.id === 'blue_jdm' || car.id === 'crimson_tuner' || isRally ? colBodyLight : colBodyMain;
      const bulge = isRally ? -hw * 1.07 : -hw * 1.03;
      fillQuad3D(
        { x: -hw * 0.97, y: yFloor - 0.02, z: wz + wRad * 1.15 },
        { x: -hw * 0.97, y: yFloor - 0.02, z: wz - wRad * 1.15 },
        { x: -hw * 0.96, y: wRad + 0.20, z: wz - wRad * 0.95 },
        { x: -hw * 0.96, y: wRad + 0.20, z: wz + wRad * 0.95 },
        colWheelWell,
        -0.015
      );
      fillQuad3D(
        { x: bulge, y: wRad + 0.14, z: wz + 0.42 },
        { x: bulge, y: wRad + 0.14, z: wz - 0.42 },
        { x: -hw * 0.98, y: wRad + 0.34, z: wz - (isRally ? 0.34 : 0.24) },
        { x: -hw * 0.98, y: wRad + 0.34, z: wz + (isRally ? 0.34 : 0.24) },
        flareCol,
        -0.04
      );
    };
    drawLeftFenderArch(wheelZRear, wRadRear);
    drawLeftFenderArch(wheelZFront, wRadFront);

    // Front Hood (supports stock, carbon, vented, blower, clear_bay, twin_scoop)
    const activeHood = resolved.hood;
    const hasCarbonHood =
      activeHood === 'carbon' ||
      (activeHood === 'stock' &&
        ((resolved.livery === 'stock' && car.hoodFeature === 'carbon') ||
          resolved.livery === 'two_tone'));
    const hoodColor = hasCarbonHood ? colCarbon : activeHood === 'clear_bay' ? colGlassDark : colBodyMain;

    if (isFormula) {
      // Sleek tapered needle nose for open wheel formula racer
      fillQuad3D(
        { x: -0.32, y: yBeltFront + 0.06, z: zHoodBase },
        { x: 0.32, y: yBeltFront + 0.06, z: zHoodBase },
        { x: 0.12, y: yNose, z: zFront },
        { x: -0.12, y: yNose, z: zFront },
        colBodyMain
      );
    } else {
      fillQuad3D(
        { x: -hw * 0.92, y: yBeltFront + 0.06, z: zHoodBase },
        { x: hw * 0.92, y: yBeltFront + 0.06, z: zHoodBase },
        { x: hw * 0.88, y: yNose, z: zFront },
        { x: -hw * 0.88, y: yNose, z: zFront },
        hoodColor
      );
    }

    if (activeHood === 'clear_bay') {
      fillQuad3D(
        { x: -0.36, y: yBeltFront + 0.07, z: zHoodBase + 0.16 },
        { x: 0.36, y: yBeltFront + 0.07, z: zHoodBase + 0.16 },
        { x: 0.32, y: yNose + 0.04, z: zHoodBase + 0.82 },
        { x: -0.32, y: yNose + 0.04, z: zHoodBase + 0.82 },
        colEngineBlock,
        -0.015
      );
      for (const bx of [-0.28, 0.12]) {
        fillQuad3D(
          { x: bx, y: yBeltFront + 0.08, z: zHoodBase + 0.22 },
          { x: bx + 0.16, y: yBeltFront + 0.08, z: zHoodBase + 0.22 },
          { x: bx + 0.14, y: yNose + 0.05, z: zHoodBase + 0.76 },
          { x: bx, y: yNose + 0.05, z: zHoodBase + 0.76 },
          colEngineHeader,
          -0.025
        );
      }
    } else if (activeHood === 'twin_scoop') {
      for (const bx of [-0.46, 0.18]) {
        fillQuad3D(
          { x: bx, y: yBeltFront + 0.08, z: zHoodBase + 0.24 },
          { x: bx + 0.28, y: yBeltFront + 0.08, z: zHoodBase + 0.24 },
          { x: bx + 0.24, y: yNose + 0.14, z: zHoodBase + 0.70 },
          { x: bx + 0.04, y: yNose + 0.14, z: zHoodBase + 0.70 },
          colCarbonSpec,
          -0.02
        );
      }
    } else if (
      activeHood === 'vented' ||
      (!isTruck &&
        !isKei &&
        !isSemi &&
        !isFormula &&
        car.hoodFeature !== 'supercharger' &&
        activeHood !== 'blower')
    ) {
      for (const vx of [-0.46, 0.32]) {
        fillQuad3D(
          { x: vx, y: yBeltFront + 0.03, z: zHoodBase + 0.34 },
          { x: vx + 0.16, y: yBeltFront + 0.03, z: zHoodBase + 0.34 },
          { x: vx + 0.16, y: yNose + 0.09, z: zHoodBase + 0.62 },
          { x: vx, y: yNose + 0.09, z: zHoodBase + 0.62 },
          activeHood === 'vented' ? colCarbonSpec : colCarbon,
          -0.015
        );
      }
    }

    // Front Nose / Splitter / Intercooler / Semi Grille / Formula Wing
    if (isFormula) {
      fillQuad3D(
        { x: -1.14, y: yFloor - 0.02, z: zFront + 0.18 },
        { x: 1.14, y: yFloor - 0.02, z: zFront + 0.18 },
        { x: 1.14, y: yFloor + 0.08, z: zFront - 0.04 },
        { x: -1.14, y: yFloor + 0.08, z: zFront - 0.04 },
        colAccent,
        -0.03
      );
      fillQuad3D(
        { x: -1.05, y: yFloor + 0.09, z: zFront + 0.12 },
        { x: 1.05, y: yFloor + 0.09, z: zFront + 0.12 },
        { x: 1.05, y: yFloor + 0.16, z: zFront - 0.02 },
        { x: -1.05, y: yFloor + 0.16, z: zFront - 0.02 },
        colCarbonSpec,
        -0.04
      );
      for (const side of [-1, 1]) {
        fillQuad3D(
          { x: side * 1.14, y: yFloor - 0.04, z: zFront - 0.06 },
          { x: side * 1.14, y: yFloor - 0.04, z: zFront + 0.20 },
          { x: side * 1.14, y: yFloor + 0.24, z: zFront + 0.20 },
          { x: side * 1.14, y: yFloor + 0.24, z: zFront - 0.06 },
          colAccentDark,
          -0.05
        );
      }
    } else if (isSemi) {
      fillQuad3D(
        { x: -hw * 0.90, y: yFloor - 0.02, z: zFront + 0.08 },
        { x: hw * 0.90, y: yFloor - 0.02, z: zFront + 0.08 },
        { x: hw * 0.90, y: yFloor + 0.24, z: zFront + 0.06 },
        { x: -hw * 0.90, y: yFloor + 0.24, z: zFront + 0.06 },
        colRimSpec,
        -0.03
      );
      fillQuad3D(
        { x: -hw * 0.65, y: yFloor + 0.24, z: zFront + 0.05 },
        { x: hw * 0.65, y: yFloor + 0.24, z: zFront + 0.05 },
        { x: hw * 0.65, y: yNose + 0.15, z: zFront + 0.03 },
        { x: -hw * 0.65, y: yNose + 0.15, z: zFront + 0.03 },
        colCarbon,
        -0.02
      );
      for (const gx of [-0.48, -0.24, 0, 0.24, 0.48]) {
        fillQuad3D(
          { x: gx - 0.04, y: yFloor + 0.26, z: zFront + 0.06 },
          { x: gx + 0.04, y: yFloor + 0.26, z: zFront + 0.06 },
          { x: gx + 0.04, y: yNose + 0.13, z: zFront + 0.04 },
          { x: gx - 0.04, y: yNose + 0.13, z: zFront + 0.04 },
          colRimSpec,
          -0.03
        );
      }
    } else {
      fillQuad3D(
        { x: -hw * 0.92, y: yFloor, z: zFront + 0.04 },
        { x: hw * 0.92, y: yFloor, z: zFront + 0.04 },
        { x: hw * 0.88, y: yNose, z: zFront },
        { x: -hw * 0.88, y: yNose, z: zFront },
        colCarbon
      );
    }

    if (isGt3 || isPrototype || isInterceptor) {
      fillQuad3D(
        { x: -hw * 1.06, y: yFloor - 0.02, z: zFront + 0.16 },
        { x: hw * 1.06, y: yFloor - 0.02, z: zFront + 0.16 },
        { x: hw * 1.02, y: yFloor + 0.06, z: zFront - 0.02 },
        { x: -hw * 1.02, y: yFloor + 0.06, z: zFront - 0.02 },
        isGt3 ? colAccent : colCarbonSpec,
        -0.02
      );
    }

    // Front Headlight Corner Slant (Dual Symmetrical Headlights for 360 Turntable)
    if (!isFormula) {
      fillQuad3D(
        { x: hw * 0.52, y: yNose - 0.13, z: zFront + 0.02 },
        { x: hw * 0.89, y: yNose - 0.08, z: zFront + 0.01 },
        { x: hw * 0.86, y: yNose + 0.03, z: zFront - 0.08 },
        { x: hw * 0.54, y: yNose - 0.02, z: zFront - 0.04 },
        isFlashing ? colHeadlightBeam : colHeadlightLens,
        -0.025
      );
      fillQuad3D(
        { x: -hw * 0.89, y: yNose - 0.08, z: zFront + 0.01 },
        { x: -hw * 0.52, y: yNose - 0.13, z: zFront + 0.02 },
        { x: -hw * 0.54, y: yNose - 0.02, z: zFront - 0.04 },
        { x: -hw * 0.86, y: yNose + 0.03, z: zFront - 0.08 },
        isFlashing ? colHeadlightBeam : colHeadlightLens,
        -0.025
      );
    }
    if (isKei || isRally || car.hoodFeature === 'fog_lights') {
      fillQuad3D(
        { x: hw * 0.15, y: yFloor + 0.14, z: zFront + 0.05 },
        { x: hw * 0.36, y: yFloor + 0.14, z: zFront + 0.05 },
        { x: hw * 0.36, y: yFloor + 0.28, z: zFront + 0.04 },
        { x: hw * 0.15, y: yFloor + 0.28, z: zFront + 0.04 },
        isFlashing ? colWhite : colAmber,
        -0.03
      );
      if (isRally) {
        fillQuad3D(
          { x: -hw * 0.36, y: yFloor + 0.14, z: zFront + 0.05 },
          { x: -hw * 0.15, y: yFloor + 0.14, z: zFront + 0.05 },
          { x: -hw * 0.15, y: yFloor + 0.28, z: zFront + 0.04 },
          { x: -hw * 0.36, y: yFloor + 0.28, z: zFront + 0.04 },
          isFlashing ? colWhite : colAmber,
          -0.03
        );
      }
    }

    // =======================================================================
    // 3. GREENHOUSE CABIN, ROOF, TINTED WINDOWS & SPECULAR REFLECTIONS
    // =======================================================================
    const rw = hw * (isWagon || isVan ? 0.78 : isPrototype || isFormula ? 0.64 : 0.72);

    if (isFormula) {
      fillQuad3D(
        { x: -0.18, y: yBeltRear, z: zTrunk + 0.22 },
        { x: 0.18, y: yBeltRear, z: zTrunk + 0.22 },
        { x: 0.14, y: yRoof + 0.10, z: zTrunk + 0.22 },
        { x: -0.14, y: yRoof + 0.10, z: zTrunk + 0.22 },
        colCarbon,
        -0.03
      );
      fillQuad3D(
        { x: -0.14, y: yBeltFront + 0.14, z: 0.18 },
        { x: 0.14, y: yBeltFront + 0.14, z: 0.18 },
        { x: 0.13, y: yBeltFront + 0.36, z: 0.36 },
        { x: -0.13, y: yBeltFront + 0.36, z: 0.36 },
        colWhite,
        -0.04
      );
      fillQuad3D(
        { x: -0.10, y: yBeltFront + 0.20, z: 0.32 },
        { x: 0.10, y: yBeltFront + 0.20, z: 0.32 },
        { x: 0.09, y: yBeltFront + 0.28, z: 0.35 },
        { x: -0.09, y: yBeltFront + 0.28, z: 0.35 },
        packHex('#38bdf8'),
        -0.05
      );
    } else if (!isRoadster) {
      const useDarkRoof =
        resolved.roof === 'carbon_panel' ||
        resolved.livery === 'two_tone' ||
        (resolved.livery === 'stock' && isKei);
      const useWhiteRoof = resolved.livery === 'stock' && car.id === 'sakura_silvia';
      const roofCol = useDarkRoof ? colCarbon : useWhiteRoof ? colWhite : colBodyLight;
      fillQuad3D(
        { x: -rw, y: yRoof, z: zRearGlassTop },
        { x: rw, y: yRoof, z: zRearGlassTop },
        { x: rw * 0.96, y: yRoof, z: zFrontGlassTop },
        { x: -rw * 0.96, y: yRoof, z: zFrontGlassTop },
        roofCol
      );

      if (resolved.roof === 'moonroof') {
        fillQuad3D(
          { x: -rw * 0.66, y: yRoof + 0.01, z: (zRearGlassTop + zFrontGlassTop) * 0.5 - 0.18 },
          { x: rw * 0.66, y: yRoof + 0.01, z: (zRearGlassTop + zFrontGlassTop) * 0.5 - 0.18 },
          { x: rw * 0.64, y: yRoof + 0.01, z: zFrontGlassTop - 0.14 },
          { x: -rw * 0.64, y: yRoof + 0.01, z: zFrontGlassTop - 0.14 },
          colGlassDark,
          -0.02
        );
      } else if (resolved.roof === 'roof_scoop') {
        fillQuad3D(
          { x: -0.22, y: yRoof + 0.01, z: zRearGlassTop + 0.15 },
          { x: 0.22, y: yRoof + 0.01, z: zRearGlassTop + 0.15 },
          { x: 0.18, y: yRoof + 0.16, z: zFrontGlassTop - 0.12 },
          { x: -0.18, y: yRoof + 0.16, z: zFrontGlassTop - 0.12 },
          colCarbonSpec,
          -0.03
        );
      } else if (resolved.roof === 'light_bar') {
        const barZ = (zRearGlassTop + zFrontGlassTop) * 0.5 + 0.08;
        fillQuad3D(
          { x: -rw * 0.78, y: yRoof + 0.02, z: barZ - 0.08 },
          { x: 0, y: yRoof + 0.02, z: barZ - 0.08 },
          { x: 0, y: yRoof + 0.13, z: barZ + 0.06 },
          { x: -rw * 0.78, y: yRoof + 0.13, z: barZ + 0.06 },
          isFlashing ? colWhite : isInterceptor ? colTail : colHeadlightBeam,
          -0.035
        );
        fillQuad3D(
          { x: 0, y: yRoof + 0.02, z: barZ - 0.08 },
          { x: rw * 0.78, y: yRoof + 0.02, z: barZ - 0.08 },
          { x: rw * 0.78, y: yRoof + 0.13, z: barZ + 0.06 },
          { x: 0, y: yRoof + 0.13, z: barZ + 0.06 },
          isFlashing ? colWhite : isInterceptor ? colBurntTi : colHeadlightBeam,
          -0.035
        );
      } else if (resolved.roof === 'siren_strobe') {
        const barZ = (zRearGlassTop + zFrontGlassTop) * 0.5 + 0.08;
        const isAltPulse = Math.floor(Date.now() / 150) % 2 === 0;
        fillQuad3D(
          { x: -rw * 0.72, y: yRoof + 0.02, z: barZ - 0.08 },
          { x: 0, y: yRoof + 0.02, z: barZ - 0.08 },
          { x: 0, y: yRoof + 0.14, z: barZ + 0.06 },
          { x: -rw * 0.72, y: yRoof + 0.14, z: barZ + 0.06 },
          isAltPulse ? packHex('#38bdf8') : packHex('#1e3a8a'),
          -0.04
        );
        fillQuad3D(
          { x: 0, y: yRoof + 0.02, z: barZ - 0.08 },
          { x: rw * 0.72, y: yRoof + 0.02, z: barZ - 0.08 },
          { x: rw * 0.72, y: yRoof + 0.14, z: barZ + 0.06 },
          { x: 0, y: yRoof + 0.14, z: barZ + 0.06 },
          !isAltPulse ? packHex('#ef4444') : packHex('#7f1d1d'),
          -0.04
        );
      } else if (resolved.roof === 'heavy_bullbar') {
        fillQuad3D(
          { x: -hw * 0.70, y: yFloor + 0.05, z: zFront + 0.12 },
          { x: hw * 0.70, y: yFloor + 0.05, z: zFront + 0.12 },
          { x: hw * 0.70, y: yNose + 0.16, z: zFront + 0.08 },
          { x: -hw * 0.70, y: yNose + 0.16, z: zFront + 0.08 },
          colCarbonSpec,
          -0.04
        );
      } else if (resolved.roof === 'roof_cargo_box') {
        fillQuad3D(
          { x: -rw * 0.55, y: yRoof + 0.06, z: zRearGlassTop + 0.08 },
          { x: rw * 0.55, y: yRoof + 0.06, z: zRearGlassTop + 0.08 },
          { x: rw * 0.50, y: yRoof + 0.28, z: zFrontGlassTop - 0.06 },
          { x: -rw * 0.50, y: yRoof + 0.28, z: zFrontGlassTop - 0.06 },
          colCarbon,
          -0.035
        );
      } else if (resolved.roof === 'vortex_fins') {
        for (const vx of [-0.46, -0.23, 0, 0.23, 0.46]) {
          fillQuad3D(
            { x: vx - 0.03, y: yRoof + 0.01, z: zRearGlassTop + 0.04 },
            { x: vx + 0.03, y: yRoof + 0.01, z: zRearGlassTop + 0.04 },
            { x: vx + 0.02, y: yRoof + 0.12, z: zRearGlassTop + 0.22 },
            { x: vx - 0.02, y: yRoof + 0.12, z: zRearGlassTop + 0.22 },
            colCarbon,
            -0.03
          );
        }
      }

      // Rear Fastback Glass
      fillQuad3D(
        { x: -hw * 0.84, y: yBeltRear + 0.04, z: zTrunk },
        { x: hw * 0.84, y: yBeltRear + 0.04, z: zTrunk },
        { x: rw, y: yRoof, z: zRearGlassTop },
        { x: -rw, y: yRoof, z: zRearGlassTop },
        colGlassMid
      );
      if (resolved.windows === 'clear_cage') {
        for (const cxBar of [-0.48, 0.48]) {
          fillQuad3D(
            { x: cxBar - 0.04, y: yBeltRear + 0.08, z: zTrunk + 0.18 },
            { x: cxBar + 0.04, y: yBeltRear + 0.08, z: zTrunk + 0.18 },
            { x: cxBar + 0.04, y: yRoof - 0.05, z: zRearGlassTop - 0.08 },
            { x: cxBar - 0.04, y: yRoof - 0.05, z: zRearGlassTop - 0.08 },
            colEngineHeader,
            -0.015
          );
        }
      }
      fillTri3D(
        { x: -rw * 0.65, y: yRoof - 0.04, z: zRearGlassTop - 0.03 },
        { x: -rw * 0.10, y: yRoof - 0.04, z: zRearGlassTop - 0.03 },
        { x: -hw * 0.55, y: yBeltRear + 0.08, z: zTrunk + 0.05 },
        colGlassSpec,
        -0.02
      );

      // Front Windshield
      fillQuad3D(
        { x: -hw * 0.84, y: yBeltFront + 0.06, z: zHoodBase },
        { x: hw * 0.84, y: yBeltFront + 0.06, z: zHoodBase },
        { x: rw * 0.96, y: yRoof, z: zFrontGlassTop },
        { x: -rw * 0.96, y: yRoof, z: zFrontGlassTop },
        colGlassDark
      );
      fillQuad3D(
        { x: -rw * 0.86, y: yRoof - 0.06, z: zFrontGlassTop + 0.06 },
        { x: rw * 0.86, y: yRoof - 0.06, z: zFrontGlassTop + 0.06 },
        { x: rw * 0.92, y: yRoof - 0.01, z: zFrontGlassTop + 0.01 },
        { x: -rw * 0.92, y: yRoof - 0.01, z: zFrontGlassTop + 0.01 },
        colGlassSpec,
        -0.02
      );

      // Right Side Windows
      fillQuad3D(
        { x: hw * 0.88, y: yBeltRear + 0.02, z: zTrunk + 0.04 },
        { x: hw * 0.86, y: yBeltFront + 0.05, z: zHoodBase - 0.04 },
        { x: rw * 0.96, y: yRoof, z: zFrontGlassTop },
        { x: rw, y: yRoof, z: zRearGlassTop },
        colGlassMid
      );
      fillTri3D(
        { x: hw * 0.88, y: yBeltFront + 0.08, z: zHoodBase - 0.25 },
        { x: rw * 0.95, y: yRoof - 0.03, z: zFrontGlassTop - 0.06 },
        { x: rw * 0.97, y: yRoof - 0.03, z: zFrontGlassTop - 0.42 },
        colGlassSpec,
        -0.02
      );
      const bPillarZ = (zRearGlassTop + zFrontGlassTop) * 0.5 - 0.08;
      fillQuad3D(
        { x: hw * 0.88, y: yBeltRear + 0.01, z: bPillarZ - 0.06 },
        { x: hw * 0.88, y: yBeltFront + 0.04, z: bPillarZ + 0.05 },
        { x: rw * 0.98, y: yRoof, z: bPillarZ + 0.06 },
        { x: rw * 0.98, y: yRoof, z: bPillarZ - 0.05 },
        colCarbon,
        -0.025
      );
      fillQuad3D(
        { x: hw * 0.87, y: yBeltFront + 0.05, z: zHoodBase - 0.04 },
        { x: hw * 0.87, y: yBeltFront + 0.05, z: zHoodBase + 0.04 },
        { x: rw * 0.97, y: yRoof, z: zFrontGlassTop + 0.05 },
        { x: rw * 0.97, y: yRoof, z: zFrontGlassTop - 0.04 },
        colCarbon,
        -0.025
      );
      fillQuad3D(
        { x: -0.26, y: yRoof - 0.06, z: zRearGlassTop - 0.04 },
        { x: 0.26, y: yRoof - 0.06, z: zRearGlassTop - 0.04 },
        { x: 0.26, y: yRoof - 0.01, z: zRearGlassTop - 0.01 },
        { x: -0.26, y: yRoof - 0.01, z: zRearGlassTop - 0.01 },
        isBraking ? colTail : colCarbon,
        -0.035
      );
      fillTri3D(
        { x: hw * 0.92, y: yBeltRear, z: zRear + 0.22 },
        { x: hw * 0.88, y: yBeltRear + 0.03, z: zTrunk + 0.05 },
        { x: rw, y: yRoof, z: zRearGlassTop },
        colBodyMain,
        -0.01
      );
      fillQuad3D(
        { x: hw * 0.94, y: yBeltFront + 0.04, z: zHoodBase - 0.22 },
        { x: hw * 1.12, y: yBeltFront + 0.06, z: zHoodBase - 0.26 },
        { x: hw * 1.12, y: yBeltFront + 0.18, z: zHoodBase - 0.26 },
        { x: hw * 0.94, y: yBeltFront + 0.14, z: zHoodBase - 0.22 },
        colBodyLight,
        -0.03
      );

      // Left Side Windows (Symmetric 3D geometry for 360-degree rotation)
      fillQuad3D(
        { x: -hw * 0.86, y: yBeltFront + 0.05, z: zHoodBase - 0.04 },
        { x: -hw * 0.88, y: yBeltRear + 0.02, z: zTrunk + 0.04 },
        { x: -rw, y: yRoof, z: zRearGlassTop },
        { x: -rw * 0.96, y: yRoof, z: zFrontGlassTop },
        colGlassMid
      );
      fillTri3D(
        { x: -rw * 0.95, y: yRoof - 0.03, z: zFrontGlassTop - 0.06 },
        { x: -hw * 0.88, y: yBeltFront + 0.08, z: zHoodBase - 0.25 },
        { x: -rw * 0.97, y: yRoof - 0.03, z: zFrontGlassTop - 0.42 },
        colGlassSpec,
        -0.02
      );
      fillQuad3D(
        { x: -hw * 0.88, y: yBeltFront + 0.04, z: bPillarZ + 0.05 },
        { x: -hw * 0.88, y: yBeltRear + 0.01, z: bPillarZ - 0.06 },
        { x: -rw * 0.98, y: yRoof, z: bPillarZ - 0.05 },
        { x: -rw * 0.98, y: yRoof, z: bPillarZ + 0.06 },
        colCarbon,
        -0.025
      );
      fillQuad3D(
        { x: -hw * 0.87, y: yBeltFront + 0.05, z: zHoodBase + 0.04 },
        { x: -hw * 0.87, y: yBeltFront + 0.05, z: zHoodBase - 0.04 },
        { x: -rw * 0.97, y: yRoof, z: zFrontGlassTop - 0.04 },
        { x: -rw * 0.97, y: yRoof, z: zFrontGlassTop + 0.05 },
        colCarbon,
        -0.025
      );
      fillTri3D(
        { x: -hw * 0.88, y: yBeltRear + 0.03, z: zTrunk + 0.05 },
        { x: -hw * 0.92, y: yBeltRear, z: zRear + 0.22 },
        { x: -rw, y: yRoof, z: zRearGlassTop },
        colBodyMain,
        -0.01
      );
      // Left side mirror
      fillQuad3D(
        { x: -hw * 1.12, y: yBeltFront + 0.06, z: zHoodBase - 0.26 },
        { x: -hw * 0.94, y: yBeltFront + 0.04, z: zHoodBase - 0.22 },
        { x: -hw * 0.94, y: yBeltFront + 0.14, z: zHoodBase - 0.22 },
        { x: -hw * 1.12, y: yBeltFront + 0.18, z: zHoodBase - 0.26 },
        colBodyLight,
        -0.03
      );
    } else {
      // Open Cockpit Roadster
      fillQuad3D(
        { x: -hw * 0.84, y: yBeltFront + 0.04, z: zHoodBase },
        { x: hw * 0.84, y: yBeltFront + 0.04, z: zHoodBase },
        { x: rw * 0.90, y: yRoof + 0.08, z: zFrontGlassTop + 0.15 },
        { x: -rw * 0.90, y: yRoof + 0.08, z: zFrontGlassTop + 0.15 },
        colGlassMid
      );
      fillQuad3D(
        { x: -0.58, y: yBeltRear, z: zTrunk + 0.15 },
        { x: -0.20, y: yBeltRear, z: zTrunk + 0.15 },
        { x: -0.22, y: yRoof + 0.10, z: zTrunk + 0.15 },
        { x: -0.56, y: yRoof + 0.10, z: zTrunk + 0.15 },
        colTail
      );
      fillQuad3D(
        { x: 0.20, y: yBeltRear, z: zTrunk + 0.15 },
        { x: 0.58, y: yBeltRear, z: zTrunk + 0.15 },
        { x: 0.56, y: yRoof + 0.10, z: zTrunk + 0.15 },
        { x: 0.22, y: yRoof + 0.10, z: zTrunk + 0.15 },
        colTail
      );
    }

    // =======================================================================
    // 4. CUSTOM LIVERY PATTERNS, DOOR ROUNDEL & SUPERCHARGER BLOWER
    // =======================================================================
    const showTwinStripes =
      resolved.livery === 'twin_stripes' ||
      (resolved.livery === 'stock' && car.hoodFeature === 'stripes');
    const showSideFlash =
      resolved.livery === 'side_flash' ||
      (resolved.livery === 'stock' && (car.id === 'sakura_silvia' || car.id === 'rally_legend'));

    if (showTwinStripes) {
      const stripeCol = car.id === 'rally_legend' ? colAmber : colWhite;
      for (const sx of [-0.20, 0.10]) {
        if (!isTruck && !isFormula) {
          fillQuad3D(
            { x: sx, y: yBeltRear + 0.01, z: zRear + 0.06 },
            { x: sx + 0.11, y: yBeltRear + 0.01, z: zRear + 0.06 },
            { x: sx + 0.11, y: yBeltRear + 0.05, z: zTrunk },
            { x: sx, y: yBeltRear + 0.05, z: zTrunk },
            stripeCol,
            -0.02
          );
        }
        if (!isRoadster && !isFormula) {
          fillQuad3D(
            { x: sx, y: yRoof + 0.01, z: zRearGlassTop },
            { x: sx + 0.11, y: yRoof + 0.01, z: zRearGlassTop },
            { x: sx + 0.11, y: yRoof + 0.01, z: zFrontGlassTop },
            { x: sx, y: yRoof + 0.01, z: zFrontGlassTop },
            stripeCol,
            -0.02
          );
        }
        fillQuad3D(
          { x: sx, y: yBeltFront + 0.07, z: zHoodBase },
          { x: sx + 0.11, y: yBeltFront + 0.07, z: zHoodBase },
          { x: sx + 0.11, y: yNose + 0.01, z: zFront },
          { x: sx, y: yNose + 0.01, z: zFront },
          stripeCol,
          -0.02
        );
      }
    }

    if (showSideFlash) {
      const flashCol = car.id === 'sakura_silvia' ? colWhite : colAccent;
      fillQuad3D(
        { x: hw * 0.99, y: yFloor + 0.18, z: zRear + 0.25 },
        { x: hw * 0.98, y: yFloor + 0.34, z: zFront - 0.32 },
        { x: hw * 0.97, y: yBeltFront - 0.10, z: zFront - 0.38 },
        { x: hw * 0.98, y: yBeltRear - 0.22, z: zRear + 0.22 },
        flashCol,
        -0.03
      );
    }

    if (resolved.livery === 'police_intercept') {
      fillQuad3D(
        { x: hw * 0.99, y: yFloor + 0.16, z: -0.50 },
        { x: hw * 0.98, y: yFloor + 0.16, z: 0.45 },
        { x: hw * 0.96, y: yBeltRear - 0.04, z: 0.45 },
        { x: hw * 0.97, y: yBeltRear - 0.04, z: -0.50 },
        colWhite,
        -0.035
      );
    } else if (resolved.livery === 'hazard_chevrons') {
      for (const hx of [-0.60, -0.25, 0.10, 0.45]) {
        fillTri3D(
          { x: hx, y: yFloor + 0.28, z: zRear - 0.025 },
          { x: hx + 0.14, y: yFloor + 0.42, z: zRear - 0.025 },
          { x: hx + 0.14, y: yFloor + 0.28, z: zRear - 0.025 },
          colAmber,
          -0.03
        );
      }
    } else if (resolved.livery === 'flame_decals') {
      fillTri3D(
        { x: hw * 0.99, y: yFloor + 0.22, z: zFront - 0.40 },
        { x: hw * 0.98, y: yFloor + 0.38, z: zRear + 0.50 },
        { x: hw * 0.97, y: yBeltFront - 0.14, z: zFront - 0.30 },
        colAmber,
        -0.035
      );
      fillTri3D(
        { x: hw * 0.98, y: yFloor + 0.24, z: zFront - 0.25 },
        { x: hw * 0.97, y: yFloor + 0.35, z: zRear + 0.80 },
        { x: hw * 0.96, y: yBeltFront - 0.16, z: zFront - 0.15 },
        colTail,
        -0.04
      );
    } else if (resolved.livery === 'sponsor_wrap') {
      fillQuad3D(
        { x: -0.32, y: yBeltFront + 0.08, z: zHoodBase + 0.15 },
        { x: 0.32, y: yBeltFront + 0.08, z: zHoodBase + 0.15 },
        { x: 0.30, y: yBeltFront + 0.08, z: zHoodBase + 0.30 },
        { x: -0.30, y: yBeltFront + 0.08, z: zHoodBase + 0.30 },
        colWhite,
        -0.03
      );
      fillQuad3D(
        { x: hw * 0.99, y: yFloor + 0.18, z: -0.60 },
        { x: hw * 0.98, y: yFloor + 0.18, z: -0.10 },
        { x: hw * 0.97, y: yFloor + 0.26, z: -0.10 },
        { x: hw * 0.98, y: yFloor + 0.26, z: -0.60 },
        colAmber,
        -0.035
      );
    }

    if (showDoorRoundel && !isFormula) {
      fillQuad3D(
        { x: hw * 0.99, y: yFloor + 0.24, z: -0.45 },
        { x: hw * 0.98, y: yFloor + 0.22, z: 0.42 },
        { x: hw * 0.96, y: yBeltRear - 0.14, z: 0.42 },
        { x: hw * 0.97, y: yBeltRear - 0.12, z: -0.45 },
        colWhite,
        -0.04
      );
    }

    if (
      activeHood === 'blower' ||
      (activeHood === 'stock' && (car.hoodFeature === 'supercharger' || car.id === 'midnight_muscle'))
    ) {
      fillQuad3D(
        { x: -0.26, y: yBeltFront + 0.02, z: zHoodBase + 0.18 },
        { x: 0.26, y: yBeltFront + 0.02, z: zHoodBase + 0.18 },
        { x: 0.26, y: yBeltFront + 0.30, z: zHoodBase + 0.18 },
        { x: -0.26, y: yBeltFront + 0.30, z: zHoodBase + 0.18 },
        colRim,
        -0.03
      );
      fillQuad3D(
        { x: -0.24, y: yBeltFront + 0.30, z: zHoodBase + 0.18 },
        { x: 0.24, y: yBeltFront + 0.30, z: zHoodBase + 0.18 },
        { x: 0.22, y: yNose + 0.22, z: zHoodBase + 0.72 },
        { x: -0.22, y: yNose + 0.22, z: zHoodBase + 0.72 },
        colRimSpec,
        -0.03
      );
    } else if (car.id === 'cyber_supercar' || car.id === 'solar_hypercar' || isPrototype) {
      const spineH = car.id === 'solar_hypercar' || isPrototype ? yRoof + 0.22 : yRoof + 0.01;
      fillQuad3D(
        { x: -0.06, y: yRoof + 0.01, z: zRear + 0.45 },
        { x: 0.06, y: yRoof + 0.01, z: zRear + 0.45 },
        { x: 0.06, y: spineH, z: zFrontGlassTop },
        { x: -0.06, y: spineH, z: zFrontGlassTop },
        car.id === 'solar_hypercar' || isPrototype ? colCarbon : colAccent,
        -0.02
      );
    }

    // =======================================================================
    // 5. REAR TAIL LIGHTS, PLATE, EXHAUST PIPES & REAR WING
    // =======================================================================
    if (isSupercar || isRoadster) {
      fillQuad3D(
        { x: -hw * 0.84, y: yBeltRear - 0.16, z: zRear - 0.02 },
        { x: hw * 0.84, y: yBeltRear - 0.16, z: zRear - 0.02 },
        { x: hw * 0.84, y: yBeltRear - 0.05, z: zRear },
        { x: -hw * 0.84, y: yBeltRear - 0.05, z: zRear },
        colTail,
        -0.03
      );
      fillQuad3D(
        { x: -hw * 0.70, y: yBeltRear - 0.12, z: zRear - 0.03 },
        { x: hw * 0.70, y: yBeltRear - 0.12, z: zRear - 0.03 },
        { x: hw * 0.70, y: yBeltRear - 0.08, z: zRear - 0.02 },
        { x: -hw * 0.70, y: yBeltRear - 0.08, z: zRear - 0.02 },
        isBraking ? colTailCore : colWhite,
        -0.04
      );
    } else {
      for (const side of [-1, 1]) {
        const x1 = side * hw * 0.42;
        const x2 = side * hw * 0.86;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        fillQuad3D(
          { x: minX, y: yBeltRear - 0.22, z: zRear - 0.02 },
          { x: maxX, y: yBeltRear - 0.22, z: zRear - 0.02 },
          { x: maxX, y: yBeltRear - 0.06, z: zRear },
          { x: minX, y: yBeltRear - 0.06, z: zRear },
          colTail,
          -0.03
        );
        fillQuad3D(
          { x: minX + 0.05, y: yBeltRear - 0.18, z: zRear - 0.03 },
          { x: maxX - 0.05, y: yBeltRear - 0.18, z: zRear - 0.03 },
          { x: maxX - 0.05, y: yBeltRear - 0.10, z: zRear - 0.02 },
          { x: minX + 0.05, y: yBeltRear - 0.10, z: zRear - 0.02 },
          isBraking ? colTailCore : colAmber,
          -0.04
        );
      }
    }

    fillQuad3D(
      { x: -0.24, y: yFloor + 0.30, z: zRear - 0.015 },
      { x: 0.24, y: yFloor + 0.30, z: zRear - 0.015 },
      { x: 0.24, y: yFloor + 0.44, z: zRear },
      { x: -0.24, y: yFloor + 0.44, z: zRear },
      colCarbon,
      -0.025
    );
    fillQuad3D(
      { x: -0.20, y: yFloor + 0.32, z: zRear - 0.02 },
      { x: 0.20, y: yFloor + 0.32, z: zRear - 0.02 },
      { x: 0.20, y: yFloor + 0.42, z: zRear - 0.005 },
      { x: -0.20, y: yFloor + 0.42, z: zRear - 0.005 },
      colWhite,
      -0.03
    );

    // Exhaust System (stock, quad_ti, center_tri, shotgun, side_exit, hood_exit, dual_diesel_stacks, under_tail_moto)
    const drawRearPipe = (ex: number, ey: number, ez: number, w: number, h: number, tipCol: number) => {
      fillQuad3D(
        { x: ex, y: ey, z: ez },
        { x: ex + w, y: ey, z: ez },
        { x: ex + w, y: ey + h, z: ez + 0.01 },
        { x: ex, y: ey + h, z: ez + 0.01 },
        tipCol,
        -0.03
      );
      fillQuad3D(
        { x: ex + 0.025, y: ey + 0.025, z: ez - 0.01 },
        { x: ex + w - 0.025, y: ey + 0.025, z: ez - 0.01 },
        { x: ex + w - 0.025, y: ey + h - 0.025, z: ez },
        { x: ex + 0.025, y: ey + h - 0.025, z: ez },
        colTire,
        -0.04
      );
    };

    if (exhaustStyle === 'quad_ti') {
      for (const ex of [-0.66, -0.49, 0.35, 0.52]) {
        drawRearPipe(ex, yFloor + 0.06, zRear - 0.06, 0.13, 0.11, colBurntTi);
      }
    } else if (exhaustStyle === 'center_tri') {
      for (const ex of [-0.21, -0.06, 0.09]) {
        drawRearPipe(ex, yFloor + 0.07, zRear - 0.07, 0.12, 0.12, colRimSpec);
      }
    } else if (exhaustStyle === 'shotgun') {
      for (const ex of [-0.56, 0.40]) {
        drawRearPipe(ex, yFloor + 0.10, zRear - 0.14, 0.16, 0.16, colRim);
      }
    } else if (exhaustStyle === 'side_exit') {
      for (const sz of [wheelZRear + 0.44, wheelZRear + 0.64]) {
        fillQuad3D(
          { x: hw * 1.04, y: yFloor + 0.05, z: sz },
          { x: hw * 1.04, y: yFloor + 0.05, z: sz + 0.14 },
          { x: hw * 1.02, y: yFloor + 0.16, z: sz + 0.14 },
          { x: hw * 1.02, y: yFloor + 0.16, z: sz },
          colRim,
          -0.04
        );
      }
    } else if (exhaustStyle === 'hood_exit') {
      for (const hx of [-0.26, 0.20]) {
        fillQuad3D(
          { x: hx, y: yBeltFront + 0.06, z: zHoodBase + 0.32 },
          { x: hx + 0.10, y: yBeltFront + 0.06, z: zHoodBase + 0.32 },
          { x: hx + 0.10, y: yBeltFront + 0.20, z: zHoodBase + 0.40 },
          { x: hx, y: yBeltFront + 0.20, z: zHoodBase + 0.40 },
          colRim,
          -0.03
        );
      }
    } else if (exhaustStyle === 'dual_diesel_stacks') {
      for (const sx of [-hw * 0.76, hw * 0.68]) {
        fillQuad3D(
          { x: sx, y: yFloor + 0.20, z: (zRearGlassTop + zFrontGlassTop) * 0.5 },
          { x: sx + 0.10, y: yFloor + 0.20, z: (zRearGlassTop + zFrontGlassTop) * 0.5 },
          { x: sx + 0.10, y: yRoof + 0.26, z: (zRearGlassTop + zFrontGlassTop) * 0.5 },
          { x: sx, y: yRoof + 0.26, z: (zRearGlassTop + zFrontGlassTop) * 0.5 },
          colRimSpec,
          -0.04
        );
      }
    } else if (exhaustStyle === 'under_tail_moto') {
      for (const ex of [-0.14, 0.04]) {
        drawRearPipe(ex, yBeltRear - 0.08, zRear - 0.06, 0.10, 0.08, colBurntTi);
      }
    } else {
      for (const ex of [-0.54, 0.40]) {
        drawRearPipe(ex, yFloor + 0.06, zRear - 0.06, 0.14, 0.11, colRim);
      }
    }

    // Rear Wing Kit (lip, gt, twin, active, cyber, f1_giant, roof_spoiler, duckbill_retro, drag_chute)
    const activeWing = resolved.spoilerStyle;
    if (activeWing === 'duckbill_retro') {
      fillQuad3D(
        { x: -hw * 0.94, y: yBeltRear + 0.02, z: zRear + 0.08 },
        { x: hw * 0.94, y: yBeltRear + 0.02, z: zRear + 0.08 },
        { x: hw * 0.92, y: yBeltRear + 0.24, z: zRear - 0.12 },
        { x: -hw * 0.92, y: yBeltRear + 0.24, z: zRear - 0.12 },
        colCarbonSpec,
        -0.03
      );
    } else if (activeWing === 'roof_spoiler') {
      fillQuad3D(
        { x: -rw * 1.04, y: yRoof + 0.04, z: zRearGlassTop - 0.16 },
        { x: rw * 1.04, y: yRoof + 0.04, z: zRearGlassTop - 0.16 },
        { x: rw * 1.02, y: yRoof + 0.16, z: zRearGlassTop + 0.08 },
        { x: -rw * 1.02, y: yRoof + 0.16, z: zRearGlassTop + 0.08 },
        colCarbon,
        -0.03
      );
    } else if (activeWing === 'drag_chute') {
      for (const cx of [-0.22, 0.10]) {
        fillQuad3D(
          { x: cx, y: yFloor + 0.26, z: zRear - 0.20 },
          { x: cx + 0.18, y: yFloor + 0.26, z: zRear - 0.20 },
          { x: cx + 0.18, y: yFloor + 0.44, z: zRear - 0.05 },
          { x: cx, y: yFloor + 0.44, z: zRear - 0.05 },
          colCarbon,
          -0.04
        );
        fillQuad3D(
          { x: cx + 0.05, y: yFloor + 0.32, z: zRear - 0.21 },
          { x: cx + 0.13, y: yFloor + 0.32, z: zRear - 0.21 },
          { x: cx + 0.13, y: yFloor + 0.38, z: zRear - 0.21 },
          { x: cx + 0.05, y: yFloor + 0.38, z: zRear - 0.21 },
          colBrakeGlow,
          -0.05
        );
      }
    } else if (activeWing === 'f1_giant' || isFormula) {
      const wingY = yBeltRear + 0.48;
      const wingW = hw * 1.15;
      for (const px of [-0.36, 0.28]) {
        fillQuad3D(
          { x: px, y: yBeltRear, z: zRear + 0.20 },
          { x: px + 0.08, y: yBeltRear, z: zRear + 0.20 },
          { x: px + 0.08, y: wingY + 0.04, z: zRear + 0.08 },
          { x: px, y: wingY + 0.04, z: zRear + 0.08 },
          colCarbon,
          0.04
        );
      }
      fillQuad3D(
        { x: -wingW, y: wingY, z: zRear - 0.18 },
        { x: wingW, y: wingY, z: zRear - 0.18 },
        { x: wingW, y: wingY + 0.09, z: zRear + 0.24 },
        { x: -wingW, y: wingY + 0.09, z: zRear + 0.24 },
        colCarbonSpec,
        -0.04
      );
      fillQuad3D(
        { x: -wingW * 0.92, y: wingY - 0.12, z: zRear - 0.10 },
        { x: wingW * 0.92, y: wingY - 0.12, z: zRear - 0.10 },
        { x: wingW * 0.92, y: wingY - 0.06, z: zRear + 0.18 },
        { x: -wingW * 0.92, y: wingY - 0.06, z: zRear + 0.18 },
        colAccent,
        -0.04
      );
      for (const side of [-1, 1]) {
        fillQuad3D(
          { x: side * wingW, y: wingY - 0.16, z: zRear - 0.20 },
          { x: side * wingW, y: wingY - 0.16, z: zRear + 0.28 },
          { x: side * wingW, y: wingY + 0.22, z: zRear + 0.28 },
          { x: side * wingW, y: wingY + 0.22, z: zRear - 0.20 },
          colAccentDark,
          -0.05
        );
      }
    } else if (activeWing !== 'lip') {
      const wingY = activeWing === 'cyber' ? yBeltRear + 0.36 : yBeltRear + 0.25;
      const wingW = hw * (activeWing === 'cyber' ? 1.06 : 1.02);
      for (const px of [-0.46, 0.38]) {
        fillQuad3D(
          { x: px, y: yBeltRear, z: zRear + 0.24 },
          { x: px + 0.08, y: yBeltRear, z: zRear + 0.24 },
          { x: px + 0.08, y: wingY - 0.01, z: zRear + 0.14 },
          { x: px, y: wingY - 0.01, z: zRear + 0.14 },
          colCarbon,
          0.04
        );
      }
      fillQuad3D(
        { x: -wingW, y: wingY, z: zRear - 0.10 },
        { x: wingW, y: wingY, z: zRear - 0.10 },
        { x: wingW, y: wingY + 0.07, z: zRear + 0.22 },
        { x: -wingW, y: wingY + 0.07, z: zRear + 0.22 },
        activeWing === 'active' ? colAccent : car.id === 'blue_jdm' ? colBodyLight : colCarbonSpec,
        -0.04
      );
      if (activeWing === 'twin') {
        fillQuad3D(
          { x: -wingW * 0.94, y: wingY + 0.16, z: zRear - 0.14 },
          { x: wingW * 0.94, y: wingY + 0.16, z: zRear - 0.14 },
          { x: wingW * 0.94, y: wingY + 0.21, z: zRear + 0.12 },
          { x: -wingW * 0.94, y: wingY + 0.21, z: zRear + 0.12 },
          colBodyLight,
          -0.04
        );
      }
      for (const side of [-1, 1]) {
        fillQuad3D(
          { x: side * wingW, y: wingY - 0.08, z: zRear - 0.10 },
          { x: side * wingW, y: wingY - 0.08, z: zRear + 0.24 },
          { x: side * wingW, y: wingY + (activeWing === 'twin' ? 0.22 : 0.12), z: zRear + 0.24 },
          { x: side * wingW, y: wingY + (activeWing === 'twin' ? 0.22 : 0.12), z: zRear - 0.10 },
          colAccentDark,
          -0.05
        );
      }
    } else {
      fillQuad3D(
        { x: -hw * 0.94, y: yBeltRear + 0.02, z: zRear + 0.06 },
        { x: hw * 0.94, y: yBeltRear + 0.02, z: zRear + 0.06 },
        { x: hw * 0.92, y: yBeltRear + 0.18, z: zRear - 0.06 },
        { x: -hw * 0.92, y: yBeltRear + 0.18, z: zRear - 0.06 },
        colBodyLight,
        -0.02
      );
    }
  }

  // =========================================================================
  // 6. AUTOMATIC 1PX MORPHOLOGICAL DARK INK OUTLINE PASS (#090d16)
  // =========================================================================
  const outlineCol = packHex('#090d16');
  const outlinedBuf = heroOutlinedBuf;
  outlinedBuf.set(colorBuf);

  for (let y = 1; y < H - 1; y++) {
    const row = y * W;
    for (let x = 1; x < W - 1; x++) {
      const idx = row + x;
      if (colorBuf[idx] === 0) {
        if (
          colorBuf[idx - 1] !== 0 ||
          colorBuf[idx + 1] !== 0 ||
          colorBuf[idx - W] !== 0 ||
          colorBuf[idx + W] !== 0
        ) {
          outlinedBuf[idx] = outlineCol;
        }
      }
    }
  }

  // Mirror horizontally if drifting LEFT ('\') (disabled when using continuous 3D custom yaw)
  const shouldMirror = !isCustomYaw && dirSign < 0;
  const finalBuf = heroFinalBuf;
  if (shouldMirror) {
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        finalBuf[row + (W - 1 - x)] = outlinedBuf[row + x];
      }
    }
  } else {
    finalBuf.set(outlinedBuf);
  }

  // Assemble final canvas with crisp contact shadow + pixel buffer + #73 decal + flames
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Grounded contact shadow ellipse (+ Neon Underglow Kit if equipped!)
  const shCenter = project({ x: 0, y: 0.02, z: 0 });
  const shX = Math.round(shouldMirror ? W - 1 - shCenter.x : shCenter.x);
  const shY = Math.round(shCenter.y + 1);
  const shRx = Math.round(32 + absNorm * 13);
  const shRy = Math.round(12 + absNorm * 3);
  const shadowTilt = shouldMirror ? 0.18 : isCustomYaw ? Math.sin(yaw) * -0.18 : dirSign * -0.18;

  if (resolved.underglowHex && !isWrecked) {
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = resolved.underglowHex;
    ctx.beginPath();
    ctx.ellipse(shX, shY + 1, shRx + 5, shRy + 3, shadowTilt, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = isFever ? 'rgba(6, 182, 212, 0.45)' : 'rgba(9, 13, 22, 0.50)';
  ctx.beginPath();
  ctx.ellipse(shX, shY, shRx, shRy, shadowTilt, 0, Math.PI * 2);
  ctx.fill();

  // Blit crisp Z-buffered outlined pixel-art car via reusable scratch canvas!
  if (!heroScratchCanvas) {
    heroScratchCanvas = document.createElement('canvas');
    heroScratchCanvas.width = W;
    heroScratchCanvas.height = H;
    heroScratchCtx = heroScratchCanvas.getContext('2d')!;
    heroScratchImgData = heroScratchCtx.createImageData(W, H);
  }
  new Uint32Array(heroScratchImgData!.data.buffer).set(finalBuf);
  heroScratchCtx!.putImageData(heroScratchImgData!, 0, 0);
  ctx.drawImage(heroScratchCanvas, 0, 0);

  // Stamp crisp 3x5 pixel bitmap racing number onto door roundel!
  if (showDoorRoundel) {
    const doorPt = project({ x: hw * 1.0, y: yFloor + 0.34, z: -0.02 });
    const dx = Math.round(shouldMirror ? W - 1 - doorPt.x - 4 : doorPt.x - 3);
    const dy = Math.round(doorPt.y - 2);
    ctx.fillStyle = '#090d16';
    const drawDigit = (char: string, ox: number, oy: number) => {
      const rows = PIXEL_DIGITS[char];
      if (!rows) return;
      for (let r = 0; r < rows.length; r++) {
        for (let col = 0; col < rows[r].length; col++) {
          if (rows[r][col] === '1') {
            ctx.fillRect(ox + col, oy + r, 1, 1);
          }
        }
      }
    };
    const numStr = resolved.number.padStart(2, '0');
    drawDigit(numStr[0], dx, dy);
    drawDigit(numStr[1], dx + 4, dy);
  }

  // Animated Exhaust Backfire Flames OR Brake Light Glow Halo OR High-Beam Flash OR Wrecked Sparks
  if (!isWrecked) {
    if (isFlashing) {
      // Bright forward headlight flash flare on bumper & roof lightbar!
      const hlPt = project({ x: hw * 0.78, y: yNose - 0.05, z: zFront + 0.08 });
      const hx = Math.round(shouldMirror ? W - 1 - hlPt.x : hlPt.x);
      const hy = Math.round(hlPt.y);
      ctx.fillStyle = resolved.headlightBeamHex;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isBraking) {
      for (const side of [-1, 1]) {
        const tp = project({ x: side * hw * 0.64, y: yBeltRear - 0.14, z: zRear - 0.05 });
        const tx = Math.round(shouldMirror ? W - 1 - tp.x : tp.x);
        const ty = Math.round(tp.y);
        ctx.fillStyle = 'rgba(255, 59, 48, 0.42)';
        ctx.beginPath();
        ctx.arc(tx, ty, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const isBoss = car.id === 'matte_boss' || car.id === 'apex_valkyrie';
      const isGassing = pedalMode === 'gas';
      if (isGassing || isFever || isBoss) {
        const flameOuter = isFever ? '#06b6d4' : resolved.flameOuter;
        const flameCore = isFever ? '#cffafe' : resolved.flameCore;
        const reach =
          (isBoss ? 0.34 : 0.24) +
          (isGassing ? 0.18 : 0) +
          (isFever ? 0.16 : 0) +
          (spinFrame === 0 ? 0.08 : 0);

        const exhaustAnchors: {
          x: number;
          y: number;
          z: number;
          sx?: number;
          sy?: number;
          sz?: number;
        }[] =
          exhaustStyle === 'quad_ti'
            ? [
                { x: -0.60, y: yFloor + 0.11, z: zRear - 0.07 },
                { x: -0.43, y: yFloor + 0.11, z: zRear - 0.07 },
                { x: 0.41, y: yFloor + 0.11, z: zRear - 0.07 },
                { x: 0.58, y: yFloor + 0.11, z: zRear - 0.07 },
              ]
            : exhaustStyle === 'center_tri'
            ? [
                { x: -0.15, y: yFloor + 0.12, z: zRear - 0.08 },
                { x: 0.0, y: yFloor + 0.12, z: zRear - 0.08 },
                { x: 0.15, y: yFloor + 0.12, z: zRear - 0.08 },
              ]
            : exhaustStyle === 'side_exit'
            ? [
                { x: hw * 1.06, y: yFloor + 0.10, z: wheelZRear + 0.54, sx: 0.32 },
              ]
            : exhaustStyle === 'hood_exit'
            ? [
                { x: -0.21, y: yBeltFront + 0.16, z: zHoodBase + 0.36, sy: 0.26, sz: -0.10 },
                { x: 0.25, y: yBeltFront + 0.16, z: zHoodBase + 0.36, sy: 0.26, sz: -0.10 },
              ]
            : exhaustStyle === 'dual_diesel_stacks'
            ? [
                { x: -hw * 0.71, y: yRoof + 0.24, z: (zRearGlassTop + zFrontGlassTop) * 0.5, sy: 0.34, sz: -0.16 },
                { x: hw * 0.73, y: yRoof + 0.24, z: (zRearGlassTop + zFrontGlassTop) * 0.5, sy: 0.34, sz: -0.16 },
              ]
            : exhaustStyle === 'under_tail_moto'
            ? [
                { x: -0.09, y: yBeltRear - 0.04, z: zRear - 0.08 },
                { x: 0.09, y: yBeltRear - 0.04, z: zRear - 0.08 },
              ]
            : [
                { x: -0.47, y: yFloor + 0.11, z: zRear - (exhaustStyle === 'shotgun' ? 0.14 : 0.07) },
                { x: 0.47, y: yFloor + 0.11, z: zRear - (exhaustStyle === 'shotgun' ? 0.14 : 0.07) },
              ];

        for (const anc of exhaustAnchors) {
          const p0 = project({ x: anc.x, y: anc.y, z: anc.z });
          const p1 = project({
            x: anc.x + (anc.sx || 0),
            y: anc.y + (anc.sy || -0.02),
            z: anc.z - (anc.sz !== undefined ? -anc.sz : anc.sx ? reach * 0.45 : reach),
          });
          const x0 = shouldMirror ? W - 1 - p0.x : p0.x;
          const x1 = shouldMirror ? W - 1 - p1.x : p1.x;
          const y0 = p0.y;
          const y1 = p1.y;
          const steps = 6;
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const px = Math.round(x0 + (x1 - x0) * t);
            const py = Math.round(y0 + (y1 - y0) * t);
            const w = t < 0.4 ? 3 : t < 0.78 ? 2 : 1;
            ctx.fillStyle = flameOuter;
            ctx.fillRect(px - Math.floor(w / 2), py, w, 2);
            if (t < 0.65) {
              ctx.fillStyle = flameCore;
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
      }
    }
  } else {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(Math.round(cx - 10), Math.round(cy - 18), 3, 3);
    ctx.fillRect(Math.round(cx - 7), Math.round(cy - 15), 3, 3);
    ctx.fillRect(Math.round(cx - 4), Math.round(cy - 12), 3, 3);
    ctx.fillRect(Math.round(cx - 1), Math.round(cy - 15), 3, 3);
    ctx.fillRect(Math.round(cx + 2), Math.round(cy - 18), 3, 3);
  }

  if (spriteCache.size >= MAX_HERO_CACHE) {
    const oldest = spriteCache.keys().next().value;
    if (oldest !== undefined) spriteCache.delete(oldest);
  }
  spriteCache.set(key, c);
  return c;
}

const trafficSpriteCache = new Map<string, HTMLCanvasElement>();

/**
 * Generates or retrieves cached 112x84 integer pixel-art sprite for 2-lane highway traffic.
 * - isOncoming = true: rotated 180 deg so camera sees front bumper, grille, twin bright headlights, and windshield!
 * - isOncoming = false: rear chase view with twin glowing red taillights, plate, and side profile!
 */
export function getTrafficVehicleCanvas(
  kind: TrafficVehicleKind,
  primaryHex: string,
  isOncoming: boolean,
  viewAngleNorm: number, // -1 (car is on left side of screen) .. +1 (car is on right side)
  isNight = false
): HTMLCanvasElement {
  const angleBucket = Math.max(-3, Math.min(3, Math.round(viewAngleNorm * 3)));
  const key = `tr_${kind}_${primaryHex}_${isOncoming ? 1 : 0}_${angleBucket}_${isNight ? 1 : 0}`;
  const cached = trafficSpriteCache.get(key);
  if (cached) return cached;

  // Base yaw: slight 3/4 angle showing side flank toward screen center
  const baseYaw = isOncoming ? Math.PI - angleBucket * 0.14 : -angleBucket * 0.14;
  const pitch = 0.30;
  const cosY = Math.cos(baseYaw);
  const sinY = Math.sin(baseYaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const cx = TW * 0.5;
  const cy = TH * 0.68;
  const scale = 18.6;

  const project = (v: Vec3): ScreenPt => {
    const rx = v.x * cosY + v.z * sinY;
    const rz = -v.x * sinY + v.z * cosY;
    const ry = v.y;
    const py = ry * cosP + rz * sinP;
    const depth = rz * cosP - ry * sinP;
    const persp = 1 / (1 + depth * 0.06);
    return {
      x: cx + rx * scale * persp,
      y: cy - py * scale * persp,
      z: depth,
    };
  };

  const colorBuf = trColorBuf;
  const depthBuf = trDepthBuf;
  colorBuf.fill(0);
  depthBuf.fill(Infinity);

  const plot = (px: number, py: number, pz: number, col: number) => {
    const ix = px | 0;
    const iy = py | 0;
    if (ix < 1 || ix >= TW - 1 || iy < 1 || iy >= TH - 1) return;
    const idx = iy * TW + ix;
    if (pz <= depthBuf[idx]) {
      depthBuf[idx] = pz;
      colorBuf[idx] = col;
    }
  };

  const fillTri3D = (a: Vec3, b: Vec3, c: Vec3, col: number, zBias = 0) => {
    const p0 = project(a);
    const p1 = project(b);
    const p2 = project(c);
    const minX = Math.max(1, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(TW - 2, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(1, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(TH - 2, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    if (Math.abs(area) < 0.05) return;
    const invArea = 1 / area;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((p1.x - px) * (p2.y - py) - (p1.y - py) * (p2.x - px)) * invArea;
        const w1 = ((p2.x - px) * (p0.y - py) - (p2.y - py) * (p0.x - px)) * invArea;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) {
          plot(x, y, w0 * p0.z + w1 * p1.z + w2 * p2.z + zBias, col);
        }
      }
    }
  };

  const fillQuad3D = (a: Vec3, b: Vec3, c: Vec3, d: Vec3, col: number, zBias = 0) => {
    fillTri3D(a, b, c, col, zBias);
    fillTri3D(a, c, d, col, zBias);
  };

  const baseRgb = hexToRgb(primaryHex);
  const colMain = packAbgr(...baseRgb);
  const colLight = packAbgr(...scaleRgb(baseRgb, 1.24));
  const colTop = packAbgr(...scaleRgb(baseRgb, 1.12));
  const colMid = packAbgr(...scaleRgb(baseRgb, 0.80));
  const colDark = packAbgr(...scaleRgb(baseRgb, 0.54));

  const colBumper = packHex('#181c26');
  const colGrille = packHex('#0f172a');
  const colChrome = packHex('#cbd5e1');
  const colGlassDark = packHex('#1e293b');
  const colGlassMid = packHex('#335c6e');
  const colGlassSpec = packHex('#bae6fd');
  const colTire = packHex('#18181b');
  const colRim = packHex('#94a3b8');
  const colTail = packHex('#ef4444');
  const colTailBright = packHex('#fca5a5');
  const colHeadlight = isNight ? packHex('#ffffff') : packHex('#fef9c3');
  const colHeadlightRim = packHex('#fde047');
  const colAmber = packHex('#f97316');
  const colPlate = packHex('#f8fafc');
  const colCargoWhite = packHex('#f1f5f9');
  const colCargoShade = packHex('#cbd5e1');

  const isTruck = kind === 'box_truck';
  const isVan = kind === 'van';
  const isHatch = kind === 'hatch';
  const isSports = kind === 'sports';

  const hw = isTruck ? 1.05 : isVan ? 0.98 : isHatch ? 0.88 : isSports ? 0.98 : 0.94;
  const zRear = isTruck ? -2.35 : isVan ? -2.05 : isHatch ? -1.65 : -1.92;
  const zFront = isTruck ? 2.25 : isVan ? 2.05 : isHatch ? 1.68 : 1.96;

  // Helper to draw grounded boxy/angled wheels
  const drawWheel = (wx: number, wz: number, rad: number, w: number) => {
    const hwT = w * 0.5;
    fillQuad3D(
      { x: wx - hwT, y: 0.02, z: wz - rad },
      { x: wx + hwT, y: 0.02, z: wz - rad },
      { x: wx + hwT, y: rad * 1.9, z: wz - rad },
      { x: wx - hwT, y: rad * 1.9, z: wz - rad },
      colTire
    );
    fillQuad3D(
      { x: wx - hwT, y: 0.02, z: wz + rad },
      { x: wx + hwT, y: 0.02, z: wz + rad },
      { x: wx + hwT, y: rad * 1.9, z: wz + rad },
      { x: wx - hwT, y: rad * 1.9, z: wz + rad },
      colTire
    );
    fillQuad3D(
      { x: wx + (wx > 0 ? hwT : -hwT), y: 0.04, z: wz - rad },
      { x: wx + (wx > 0 ? hwT : -hwT), y: 0.04, z: wz + rad },
      { x: wx + (wx > 0 ? hwT : -hwT), y: rad * 1.85, z: wz + rad },
      { x: wx + (wx > 0 ? hwT : -hwT), y: rad * 1.85, z: wz - rad },
      colTire
    );
    const sx = wx + (wx > 0 ? hwT + 0.01 : -hwT - 0.01);
    fillQuad3D(
      { x: sx, y: rad * 0.45, z: wz - rad * 0.5 },
      { x: sx, y: rad * 0.45, z: wz + rad * 0.5 },
      { x: sx, y: rad * 1.45, z: wz + rad * 0.5 },
      { x: sx, y: rad * 1.45, z: wz - rad * 0.5 },
      colRim,
      -0.01
    );
  };

  drawWheel(-hw + 0.14, zRear + 0.62, 0.34, 0.28);
  drawWheel(hw - 0.14, zRear + 0.62, 0.34, 0.28);
  drawWheel(-hw + 0.14, zFront - 0.58, 0.34, 0.26);
  drawWheel(hw - 0.14, zFront - 0.58, 0.34, 0.26);

  if (isTruck) {
    // Cab + Tall Cargo Box silhouette
    const zBoxFront = 0.78;
    const yFloor = 0.26;
    const yBoxTop = 1.96;
    const yCabBelt = 0.96;
    const yCabRoof = 1.56;

    // Lower chassis & mudflaps
    fillQuad3D(
      { x: -hw, y: yFloor, z: zRear },
      { x: hw, y: yFloor, z: zRear },
      { x: hw, y: yFloor + 0.22, z: zRear },
      { x: -hw, y: yFloor + 0.22, z: zRear },
      colBumper
    );
    // Cargo Box Rear, Sides, Top, Front
    fillQuad3D(
      { x: -hw, y: yFloor + 0.22, z: zRear },
      { x: hw, y: yFloor + 0.22, z: zRear },
      { x: hw, y: yBoxTop, z: zRear },
      { x: -hw, y: yBoxTop, z: zRear },
      colCargoShade
    );
    // Roll-up door ribs
    fillQuad3D(
      { x: -hw * 0.84, y: yFloor + 0.34, z: zRear - 0.02 },
      { x: hw * 0.84, y: yFloor + 0.34, z: zRear - 0.02 },
      { x: hw * 0.84, y: yBoxTop - 0.12, z: zRear - 0.02 },
      { x: -hw * 0.84, y: yBoxTop - 0.12, z: zRear - 0.02 },
      colCargoWhite,
      -0.02
    );
    fillQuad3D(
      { x: -hw, y: yFloor + 0.22, z: zBoxFront },
      { x: hw, y: yFloor + 0.22, z: zBoxFront },
      { x: hw, y: yBoxTop, z: zBoxFront },
      { x: -hw, y: yBoxTop, z: zBoxFront },
      colCargoWhite
    );
    fillQuad3D(
      { x: -hw, y: yBoxTop, z: zRear },
      { x: hw, y: yBoxTop, z: zRear },
      { x: hw, y: yBoxTop, z: zBoxFront },
      { x: -hw, y: yBoxTop, z: zBoxFront },
      colCargoWhite
    );
    for (const sgn of [-1, 1]) {
      fillQuad3D(
        { x: sgn * hw, y: yFloor + 0.22, z: zRear },
        { x: sgn * hw, y: yFloor + 0.22, z: zBoxFront },
        { x: sgn * hw, y: yBoxTop, z: zBoxFront },
        { x: sgn * hw, y: yBoxTop, z: zRear },
        sgn > 0 ? colCargoShade : colCargoWhite
      );
      // Colored freight stripe on cargo box side
      fillQuad3D(
        { x: sgn * hw * 1.01, y: yFloor + 0.72, z: zRear + 0.12 },
        { x: sgn * hw * 1.01, y: yFloor + 0.72, z: zBoxFront - 0.12 },
        { x: sgn * hw * 1.01, y: yFloor + 1.05, z: zBoxFront - 0.12 },
        { x: sgn * hw * 1.01, y: yFloor + 1.05, z: zRear + 0.12 },
        colMain,
        -0.02
      );
    }

    // Forward Cab
    const cw = hw * 0.90;
    fillQuad3D(
      { x: -cw, y: yFloor, z: zFront },
      { x: cw, y: yFloor, z: zFront },
      { x: cw, y: yCabBelt, z: zFront - 0.04 },
      { x: -cw, y: yCabBelt, z: zFront - 0.04 },
      colMain
    );
    // Front Bumper & Grille
    fillQuad3D(
      { x: -cw * 1.02, y: yFloor, z: zFront + 0.03 },
      { x: cw * 1.02, y: yFloor, z: zFront + 0.03 },
      { x: cw * 1.02, y: yFloor + 0.25, z: zFront + 0.03 },
      { x: -cw * 1.02, y: yFloor + 0.25, z: zFront + 0.03 },
      colBumper,
      -0.01
    );
    fillQuad3D(
      { x: -cw * 0.56, y: yFloor + 0.30, z: zFront + 0.01 },
      { x: cw * 0.56, y: yFloor + 0.30, z: zFront + 0.01 },
      { x: cw * 0.56, y: yCabBelt - 0.14, z: zFront - 0.01 },
      { x: -cw * 0.56, y: yCabBelt - 0.14, z: zFront - 0.01 },
      colGrille,
      -0.02
    );
    // Cab Windshield & Roof
    fillQuad3D(
      { x: -cw * 0.92, y: yCabBelt, z: zFront - 0.04 },
      { x: cw * 0.92, y: yCabBelt, z: zFront - 0.04 },
      { x: cw * 0.86, y: yCabRoof, z: zFront - 0.42 },
      { x: -cw * 0.86, y: yCabRoof, z: zFront - 0.42 },
      colGlassDark
    );
    fillQuad3D(
      { x: -cw * 0.86, y: yCabRoof, z: zFront - 0.42 },
      { x: cw * 0.86, y: yCabRoof, z: zFront - 0.42 },
      { x: cw * 0.88, y: yCabRoof, z: zBoxFront },
      { x: -cw * 0.88, y: yCabRoof, z: zBoxFront },
      colLight
    );
    for (const sgn of [-1, 1]) {
      fillQuad3D(
        { x: sgn * cw, y: yFloor + 0.1, z: zBoxFront },
        { x: sgn * cw, y: yFloor + 0.1, z: zFront - 0.02 },
        { x: sgn * cw * 0.92, y: yCabBelt, z: zFront - 0.04 },
        { x: sgn * cw * 0.92, y: yCabBelt, z: zBoxFront },
        sgn > 0 ? colMid : colDark
      );
      fillQuad3D(
        { x: sgn * cw * 0.92, y: yCabBelt, z: zBoxFront },
        { x: sgn * cw * 0.92, y: yCabBelt, z: zFront - 0.04 },
        { x: sgn * cw * 0.86, y: yCabRoof, z: zFront - 0.42 },
        { x: sgn * cw * 0.88, y: yCabRoof, z: zBoxFront },
        colGlassMid
      );
      // Front Headlights & Rear Taillights
      const hx1 = sgn * cw * 0.60;
      const hx2 = sgn * cw * 0.90;
      fillQuad3D(
        { x: Math.min(hx1, hx2), y: yFloor + 0.30, z: zFront + 0.02 },
        { x: Math.max(hx1, hx2), y: yFloor + 0.30, z: zFront + 0.02 },
        { x: Math.max(hx1, hx2), y: yFloor + 0.48, z: zFront + 0.02 },
        { x: Math.min(hx1, hx2), y: yFloor + 0.48, z: zFront + 0.02 },
        colHeadlight,
        -0.03
      );
      fillQuad3D(
        { x: Math.min(hx1, hx2), y: yFloor + 0.08, z: zRear - 0.02 },
        { x: Math.max(hx1, hx2), y: yFloor + 0.08, z: zRear - 0.02 },
        { x: Math.max(hx1, hx2), y: yFloor + 0.22, z: zRear - 0.02 },
        { x: Math.min(hx1, hx2), y: yFloor + 0.22, z: zRear - 0.02 },
        colTail,
        -0.03
      );
    }
    // Amber Roof Marker Lights on Cargo Box Top Edge
    for (const mx of [-0.55, 0, 0.55]) {
      fillQuad3D(
        { x: mx - 0.08, y: yBoxTop - 0.08, z: zBoxFront + 0.01 },
        { x: mx + 0.08, y: yBoxTop - 0.08, z: zBoxFront + 0.01 },
        { x: mx + 0.08, y: yBoxTop + 0.02, z: zBoxFront + 0.01 },
        { x: mx - 0.08, y: yBoxTop + 0.02, z: zBoxFront + 0.01 },
        colAmber,
        -0.03
      );
    }
  } else {
    // Sedan / Hatch / Van / Sports
    const yFloor = 0.22;
    const yBeltRear = isVan ? 0.92 : isHatch ? 0.88 : isSports ? 0.80 : 0.84;
    const yBeltFront = isVan ? 0.86 : isSports ? 0.68 : 0.76;
    const yNose = isVan ? 0.66 : isSports ? 0.48 : 0.56;
    const yRoof = isVan ? 1.54 : isHatch ? 1.38 : isSports ? 1.16 : 1.30;

    const zTrunk = isVan || isHatch ? zRear + 0.22 : zRear + 0.56;
    const zRearGlassTop = isVan ? zRear + 0.36 : isHatch ? zRear + 0.44 : zRear + 0.92;
    const zFrontGlassTop = isVan ? 0.68 : 0.32;
    const zHoodBase = isVan ? 1.24 : isSports ? 0.82 : 0.74;
    const rw = hw * (isVan ? 0.86 : 0.75);

    // Lower bumpers (rear & front)
    fillQuad3D(
      { x: -hw * 0.98, y: yFloor, z: zRear - 0.02 },
      { x: hw * 0.98, y: yFloor, z: zRear - 0.02 },
      { x: hw * 0.98, y: yFloor + 0.24, z: zRear - 0.02 },
      { x: -hw * 0.98, y: yFloor + 0.24, z: zRear - 0.02 },
      colBumper
    );
    fillQuad3D(
      { x: -hw * 0.96, y: yFloor + 0.24, z: zRear - 0.01 },
      { x: hw * 0.96, y: yFloor + 0.24, z: zRear - 0.01 },
      { x: hw * 0.94, y: yBeltRear, z: zRear + 0.04 },
      { x: -hw * 0.94, y: yBeltRear, z: zRear + 0.04 },
      colDark
    );

    // Front Bumper & Radiator Grille
    fillQuad3D(
      { x: -hw * 0.96, y: yFloor, z: zFront + 0.03 },
      { x: hw * 0.96, y: yFloor, z: zFront + 0.03 },
      { x: hw * 0.94, y: yNose, z: zFront },
      { x: -hw * 0.94, y: yNose, z: zFront },
      colMain
    );
    fillQuad3D(
      { x: -hw * 0.98, y: yFloor, z: zFront + 0.04 },
      { x: hw * 0.98, y: yFloor, z: zFront + 0.04 },
      { x: hw * 0.98, y: yFloor + 0.16, z: zFront + 0.04 },
      { x: -hw * 0.98, y: yFloor + 0.16, z: zFront + 0.04 },
      colBumper,
      -0.01
    );
    fillQuad3D(
      { x: -hw * 0.44, y: yFloor + 0.18, z: zFront + 0.03 },
      { x: hw * 0.44, y: yFloor + 0.18, z: zFront + 0.03 },
      { x: hw * 0.42, y: yNose - 0.06, z: zFront + 0.01 },
      { x: -hw * 0.42, y: yNose - 0.06, z: zFront + 0.01 },
      colGrille,
      -0.02
    );
    // Chrome/dark grille bar
    fillQuad3D(
      { x: -hw * 0.38, y: (yFloor + 0.18 + yNose - 0.06) * 0.5 - 0.02, z: zFront + 0.04 },
      { x: hw * 0.38, y: (yFloor + 0.18 + yNose - 0.06) * 0.5 - 0.02, z: zFront + 0.04 },
      { x: hw * 0.38, y: (yFloor + 0.18 + yNose - 0.06) * 0.5 + 0.03, z: zFront + 0.04 },
      { x: -hw * 0.38, y: (yFloor + 0.18 + yNose - 0.06) * 0.5 + 0.03, z: zFront + 0.04 },
      colChrome,
      -0.03
    );

    // Hood & Trunk
    fillQuad3D(
      { x: -hw * 0.92, y: yBeltFront + 0.04, z: zHoodBase },
      { x: hw * 0.92, y: yBeltFront + 0.04, z: zHoodBase },
      { x: hw * 0.90, y: yNose, z: zFront },
      { x: -hw * 0.90, y: yNose, z: zFront },
      colMain
    );
    fillQuad3D(
      { x: -hw * 0.94, y: yBeltRear, z: zRear + 0.04 },
      { x: hw * 0.94, y: yBeltRear, z: zRear + 0.04 },
      { x: hw * 0.90, y: yBeltRear + 0.02, z: zTrunk },
      { x: -hw * 0.90, y: yBeltRear + 0.02, z: zTrunk },
      colTop
    );

    // Side Flanks + Gloss Strip
    for (const sgn of [-1, 1]) {
      fillQuad3D(
        { x: sgn * hw * 0.97, y: yFloor + 0.10, z: zRear + 0.02 },
        { x: sgn * hw * 0.95, y: yFloor + 0.10, z: zFront - 0.04 },
        { x: sgn * hw * 0.92, y: yBeltFront, z: zFront - 0.06 },
        { x: sgn * hw * 0.94, y: yBeltRear, z: zRear + 0.04 },
        sgn > 0 ? colMid : colDark
      );
      fillQuad3D(
        { x: sgn * hw * 0.96, y: yBeltRear - 0.12, z: zRear + 0.06 },
        { x: sgn * hw * 0.94, y: yBeltFront - 0.08, z: zFront - 0.08 },
        { x: sgn * hw * 0.95, y: yBeltFront, z: zFront - 0.08 },
        { x: sgn * hw * 0.97, y: yBeltRear, z: zRear + 0.06 },
        colLight,
        -0.01
      );
      // Side Windows
      fillQuad3D(
        { x: sgn * hw * 0.88, y: yBeltRear + 0.02, z: zTrunk + 0.04 },
        { x: sgn * hw * 0.86, y: yBeltFront + 0.04, z: zHoodBase - 0.04 },
        { x: sgn * rw * 0.96, y: yRoof, z: zFrontGlassTop },
        { x: sgn * rw, y: yRoof, z: zRearGlassTop },
        colGlassMid
      );
    }

    // Roof + Rear Glass + Front Windshield + Specular Glare
    fillQuad3D(
      { x: -rw, y: yRoof, z: zRearGlassTop },
      { x: rw, y: yRoof, z: zRearGlassTop },
      { x: rw * 0.96, y: yRoof, z: zFrontGlassTop },
      { x: -rw * 0.96, y: yRoof, z: zFrontGlassTop },
      colLight
    );
    fillQuad3D(
      { x: -hw * 0.84, y: yBeltRear + 0.02, z: zTrunk },
      { x: hw * 0.84, y: yBeltRear + 0.02, z: zTrunk },
      { x: rw, y: yRoof, z: zRearGlassTop },
      { x: -rw, y: yRoof, z: zRearGlassTop },
      colGlassMid
    );
    fillQuad3D(
      { x: -hw * 0.84, y: yBeltFront + 0.04, z: zHoodBase },
      { x: hw * 0.84, y: yBeltFront + 0.04, z: zHoodBase },
      { x: rw * 0.96, y: yRoof, z: zFrontGlassTop },
      { x: -rw * 0.96, y: yRoof, z: zFrontGlassTop },
      colGlassDark
    );
    // Windshield diagonal specular streak
    fillTri3D(
      { x: -rw * 0.65, y: yRoof - 0.04, z: zFrontGlassTop + 0.05 },
      { x: -rw * 0.15, y: yRoof - 0.04, z: zFrontGlassTop + 0.05 },
      { x: -hw * 0.55, y: yBeltFront + 0.10, z: zHoodBase - 0.06 },
      colGlassSpec,
      -0.02
    );

    // Twin Front Headlights + Amber Corner Signals
    for (const sgn of [-1, 1]) {
      const lx1 = sgn * hw * 0.48;
      const lx2 = sgn * hw * 0.88;
      fillQuad3D(
        { x: Math.min(lx1, lx2), y: yNose - 0.18, z: zFront + 0.03 },
        { x: Math.max(lx1, lx2), y: yNose - 0.18, z: zFront + 0.03 },
        { x: Math.max(lx1, lx2), y: yNose - 0.02, z: zFront + 0.02 },
        { x: Math.min(lx1, lx2), y: yNose - 0.02, z: zFront + 0.02 },
        colHeadlight,
        -0.03
      );
      fillQuad3D(
        { x: sgn > 0 ? lx2 - 0.10 : lx2, y: yNose - 0.16, z: zFront + 0.04 },
        { x: sgn > 0 ? lx2 : lx2 + 0.10, y: yNose - 0.16, z: zFront + 0.04 },
        { x: sgn > 0 ? lx2 : lx2 + 0.10, y: yNose - 0.05, z: zFront + 0.03 },
        { x: sgn > 0 ? lx2 - 0.10 : lx2, y: yNose - 0.05, z: zFront + 0.03 },
        colHeadlightRim,
        -0.04
      );

      // Rear Glowing Red Taillights
      const rx1 = sgn * hw * 0.44;
      const rx2 = sgn * hw * 0.88;
      fillQuad3D(
        { x: Math.min(rx1, rx2), y: yBeltRear - 0.22, z: zRear - 0.02 },
        { x: Math.max(rx1, rx2), y: yBeltRear - 0.22, z: zRear - 0.02 },
        { x: Math.max(rx1, rx2), y: yBeltRear - 0.06, z: zRear - 0.01 },
        { x: Math.min(rx1, rx2), y: yBeltRear - 0.06, z: zRear - 0.01 },
        colTail,
        -0.03
      );
      fillQuad3D(
        { x: Math.min(rx1, rx2) + 0.06, y: yBeltRear - 0.17, z: zRear - 0.03 },
        { x: Math.max(rx1, rx2) - 0.06, y: yBeltRear - 0.17, z: zRear - 0.03 },
        { x: Math.max(rx1, rx2) - 0.06, y: yBeltRear - 0.11, z: zRear - 0.02 },
        { x: Math.min(rx1, rx2) + 0.06, y: yBeltRear - 0.11, z: zRear - 0.02 },
        colTailBright,
        -0.04
      );
    }

    // Rear License Plate
    fillQuad3D(
      { x: -0.22, y: yFloor + 0.30, z: zRear - 0.02 },
      { x: 0.22, y: yFloor + 0.30, z: zRear - 0.02 },
      { x: 0.22, y: yFloor + 0.44, z: zRear - 0.01 },
      { x: -0.22, y: yFloor + 0.44, z: zRear - 0.01 },
      colPlate,
      -0.03
    );

    // Sports rear lip spoiler
    if (isSports) {
      fillQuad3D(
        { x: -hw * 0.88, y: yBeltRear + 0.02, z: zRear + 0.04 },
        { x: hw * 0.88, y: yBeltRear + 0.02, z: zRear + 0.04 },
        { x: hw * 0.86, y: yBeltRear + 0.18, z: zRear - 0.06 },
        { x: -hw * 0.86, y: yBeltRear + 0.18, z: zRear - 0.06 },
        colBumper,
        -0.02
      );
    }
  }

  // 1px Dark Pixel Outline Pass (#090d16)
  const outlineCol = packHex('#090d16');
  const outlinedBuf = trOutlinedBuf;
  outlinedBuf.set(colorBuf);
  for (let y = 1; y < TH - 1; y++) {
    const row = y * TW;
    for (let x = 1; x < TW - 1; x++) {
      const idx = row + x;
      if (colorBuf[idx] === 0) {
        if (
          colorBuf[idx - 1] !== 0 ||
          colorBuf[idx + 1] !== 0 ||
          colorBuf[idx - TW] !== 0 ||
          colorBuf[idx + TW] !== 0
        ) {
          outlinedBuf[idx] = outlineCol;
        }
      }
    }
  }

  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Grounded contact shadow ellipse
  const shCenter = project({ x: 0, y: 0.02, z: 0 });
  const shX = Math.round(shCenter.x);
  const shY = Math.round(shCenter.y + 1);
  ctx.fillStyle = 'rgba(9, 13, 22, 0.48)';
  ctx.beginPath();
  ctx.ellipse(shX, shY, isTruck ? 28 : 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!trScratchCanvas) {
    trScratchCanvas = document.createElement('canvas');
    trScratchCanvas.width = TW;
    trScratchCanvas.height = TH;
    trScratchCtx = trScratchCanvas.getContext('2d')!;
    trScratchImgData = trScratchCtx.createImageData(TW, TH);
  }
  new Uint32Array(trScratchImgData!.data.buffer).set(outlinedBuf);
  trScratchCtx!.putImageData(trScratchImgData!, 0, 0);
  ctx.drawImage(trScratchCanvas, 0, 0);

  // Subtle headlight flare on oncoming front bumper
  if (isOncoming) {
    for (const sgn of [-1, 1]) {
      const hp = project({ x: sgn * hw * 0.68, y: 0.48, z: zFront + 0.08 });
      const hx = Math.round(hp.x);
      const hy = Math.round(hp.y);
      ctx.fillStyle = isNight ? 'rgba(254, 249, 195, 0.55)' : 'rgba(254, 240, 138, 0.36)';
      ctx.beginPath();
      ctx.arc(hx, hy, isNight ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (trafficSpriteCache.size >= MAX_TRAFFIC_CACHE) {
    const oldest = trafficSpriteCache.keys().next().value;
    if (oldest !== undefined) trafficSpriteCache.delete(oldest);
  }
  trafficSpriteCache.set(key, c);
  return c;
}

