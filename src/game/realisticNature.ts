/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdventureChapterSpec, AdventureZoneSample } from './adventure';

export interface CaveWallProfile {
  baseOffset: number;
  lowShelfOffset: number;
  midOffset: number;
  upperLedgeOffset: number;
  archOffset: number;
  ceilOffset: number;
  strataShade: number;
  wetStreak: number;
}

/**
 * Deterministic 0..1 pseudo-noise hash for organic terrain, rock, and botanical placement.
 */
export function deterministicNoise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Smooth 0..1 organic variation for forest floor / cavern terrain bands so adjacent slices
 * blend naturally instead of forming an artificial 2-slice checkerboard.
 */
export function smoothTerrainMix(
  sliceIndex: number,
  band: 'outerL' | 'outerR' | 'bankL' | 'bankR' | 'center'
): number {
  const bandPhase =
    band === 'outerL'
      ? 0.0
      : band === 'bankL'
      ? 1.7
      : band === 'center'
      ? 3.1
      : band === 'bankR'
      ? 4.6
      : 6.2;
  const w1 = Math.sin(sliceIndex * 0.21 + bandPhase) * 0.32;
  const w2 = Math.cos(sliceIndex * 0.47 - bandPhase * 0.7) * 0.16;
  const w3 = (deterministicNoise(sliceIndex * 0.37, bandPhase) - 0.5) * 0.14;
  return Math.max(0, Math.min(1, 0.5 + w1 + w2 + w3));
}

/**
 * Computes an asymmetric, multi-harmonic natural rock cavern profile for one slice and wall side.
 * Eliminates symmetric low-poly tunnel ribs by introducing rocky shelves, overhangs, and varied vault heights.
 */
export function sampleCaveWallProfile(sliceIndex: number, side: -1 | 1): CaveWallProfile {
  const phase = side < 0 ? 0.0 : 2.35;
  const rockJitter = Math.sin(sliceIndex * 0.73 + phase) * 0.55 + Math.cos(sliceIndex * 1.61 - phase) * 0.32;
  const shelfJut = Math.sin(sliceIndex * 1.18 + phase * 1.4) * 0.62 + Math.cos(sliceIndex * 2.41 + phase) * 0.25;
  const ceilingWave = Math.sin(sliceIndex * 0.44 + 0.8) * 0.65 + Math.cos(sliceIndex * 1.29) * 0.35;
  const strataRaw = 0.5 + 0.34 * Math.sin(sliceIndex * 0.85 + phase) + 0.16 * Math.cos(sliceIndex * 2.13);
  const wetRaw = deterministicNoise(sliceIndex * 1.3, side * 7.1);

  return {
    baseOffset: 0.35 * rockJitter,
    lowShelfOffset: -0.45 + 0.48 * shelfJut,
    midOffset: 0.75 * rockJitter - 0.25 * shelfJut,
    upperLedgeOffset: -0.35 + 0.42 * rockJitter,
    archOffset: 0.38 * ceilingWave + 0.24 * rockJitter,
    ceilOffset: ceilingWave,
    strataShade: Math.max(0, Math.min(1, strataRaw)),
    wetStreak: wetRaw,
  };
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export interface ChapterTerrainRamps {
  hill: string[];
  hillMist: string[];
  bank: string[];
  caveWall: string[];
  caveWallDeep: string[];
  caveCeiling: string[];
  caveWallLit: string[];
  caveCeilingLit: string[];
}

const RAMP_STEPS = 16;
const chapterRampCache = new Map<string, ChapterTerrainRamps>();

/**
 * Pre-bakes 16-step smooth color ramps per chapter so terrain and rock shading
 * have zero per-frame string allocations.
 */
export function getChapterTerrainRamps(ch: AdventureChapterSpec): ChapterTerrainRamps {
  let cached = chapterRampCache.get(ch.id);
  if (cached) return cached;

  const hill: string[] = [];
  const hillMist: string[] = [];
  const bank: string[] = [];
  const caveWall: string[] = [];
  const caveWallDeep: string[] = [];
  const caveCeiling: string[] = [];
  const caveWallLit: string[] = [];
  const caveCeilingLit: string[] = [];

  const litWallLow = lerpHexColor(ch.caveWallMid, '#6f737d', 0.42);
  const litWallHigh = ch.featureBias === 'amber_cave' ? '#9e826b' : '#8e96a6';
  const litCeilLow = lerpHexColor(ch.caveCeiling, ch.caveWallMid, 0.55);
  const litCeilHigh = lerpHexColor(ch.caveWallMid, '#697080', 0.35);

  for (let i = 0; i < RAMP_STEPS; i++) {
    const t = i / (RAMP_STEPS - 1);
    const hillCol = lerpHexColor(ch.terrainHillDark, ch.terrainHillLight, t);
    hill.push(hillCol);
    // Atmospheric blue-green forest mountain haze for distant slopes
    hillMist.push(lerpHexColor(ch.terrainHillDark, '#3b5849', 0.45 + t * 0.42));
    bank.push(lerpHexColor(ch.terrainBankDark, ch.terrainBankLight, t));
    caveWall.push(lerpHexColor(ch.caveWallDark, ch.caveWallMid, t));
    caveWallDeep.push(lerpHexColor('#08090c', ch.caveWallDark, t * 0.78));
    caveCeiling.push(lerpHexColor(ch.caveCeiling, ch.caveWallDark, t));
    caveWallLit.push(lerpHexColor(litWallLow, litWallHigh, t));
    caveCeilingLit.push(lerpHexColor(litCeilLow, litCeilHigh, t));
  }

  cached = { hill, hillMist, bank, caveWall, caveWallDeep, caveCeiling, caveWallLit, caveCeilingLit };
  chapterRampCache.set(ch.id, cached);
  return cached;
}

export function pickRampColor(ramp: string[], t: number): string {
  const idx = Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))));
  return ramp[idx];
}

/**
 * Maps an adventure prop variant + shade to a realistic botanical species index (0..5).
 */
export function resolveRealisticTreeSpecies(variant: number, shade: number, zoneSample: AdventureZoneSample): number {
  const bias = zoneSample.chapter.featureBias;
  if (variant === 0) {
    if (bias === 'emerald') return shade > 0.68 ? 1 : shade > 0.34 ? 0 : 4;
    if (bias === 'ruins') return shade > 0.55 ? 4 : 0;
    return shade > 0.5 ? 1 : 0;
  }
  if (variant === 1 || variant === 3) {
    if (shade > 0.66) return 3; // Silver Birch
    if (shade > 0.32) return 2; // Ancient Oak
    return 5; // Woodland Maple/Alder
  }
  if (variant === 4) return shade > 0.5 ? 1 : 2;
  if (variant === 5) return shade > 0.5 ? 3 : 4;
  return 0;
}

// ============================================================================
// CACHED HIGH-DETAIL PROCEDURAL BOTANICAL & ROCK SPRITE GENERATORS (BROWSER)
// ============================================================================

const treeSpriteCache = new Map<number, HTMLCanvasElement>();
const undergrowthSpriteCache = new Map<number, HTMLCanvasElement>();
const cavePropSpriteCache = new Map<number, HTMLCanvasElement>();

function makePrng(seed: number) {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawNaturalTrunk(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  topX: number,
  topY: number,
  baseWidth: number,
  topWidth: number,
  barkDark: string,
  barkMid: string,
  barkLit: string,
  isBirch: boolean,
  rand: () => number
) {
  const midY = (baseY + topY) * 0.5;
  const leanX = (baseX + topX) * 0.5 + (rand() - 0.5) * baseWidth * 0.65;

  ctx.fillStyle = barkDark;
  ctx.beginPath();
  ctx.moveTo(baseX - baseWidth * 0.92, baseY);
  ctx.quadraticCurveTo(baseX - baseWidth * 0.52, baseY - baseWidth * 0.55, leanX - (baseWidth + topWidth) * 0.25, midY);
  ctx.lineTo(topX - topWidth * 0.5, topY);
  ctx.lineTo(topX + topWidth * 0.5, topY);
  ctx.lineTo(leanX + (baseWidth + topWidth) * 0.25, midY);
  ctx.quadraticCurveTo(baseX + baseWidth * 0.55, baseY - baseWidth * 0.45, baseX + baseWidth * 0.95, baseY);
  ctx.closePath();
  ctx.fill();

  const grad = ctx.createLinearGradient(baseX - baseWidth * 0.5, 0, baseX + baseWidth * 0.5, 0);
  grad.addColorStop(0, barkLit);
  grad.addColorStop(0.55, barkMid);
  grad.addColorStop(1, barkDark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(baseX - baseWidth * 0.72, baseY);
  ctx.quadraticCurveTo(leanX - baseWidth * 0.42, midY, topX - topWidth * 0.45, topY);
  ctx.lineTo(topX + topWidth * 0.45, topY);
  ctx.quadraticCurveTo(leanX + baseWidth * 0.42, midY, baseX + baseWidth * 0.72, baseY);
  ctx.closePath();
  ctx.fill();

  if (isBirch) {
    ctx.strokeStyle = 'rgba(38, 34, 30, 0.72)';
    const steps = 18;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const y = baseY + (topY - baseY) * t;
      const cx = baseX + (topX - baseX) * t + (leanX - (baseX + topX) * 0.5) * Math.sin(t * Math.PI) * 0.5;
      const w = (baseWidth * (1 - t) + topWidth * t) * (0.45 + rand() * 0.4);
      ctx.lineWidth = 1 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.5, y);
      ctx.lineTo(cx + w * (0.1 + rand() * 0.4), y + (rand() - 0.5) * 1.5);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = 'rgba(20, 12, 8, 0.42)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const rx = (i / 5 - 0.5) * baseWidth * 0.85;
      ctx.beginPath();
      ctx.moveTo(baseX + rx, baseY - 2);
      ctx.quadraticCurveTo(leanX + rx * 0.65, midY, topX + rx * 0.3, topY + 6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(63, 98, 52, 0.55)';
    ctx.beginPath();
    ctx.ellipse(baseX - baseWidth * 0.25, baseY - 5, baseWidth * 0.45, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNeedleClusterSpray(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spanX: number,
  spanY: number,
  droop: number,
  darkCol: string,
  midCol: string,
  litCol: string,
  tipCol: string,
  rand: () => number
) {
  ctx.fillStyle = darkCol;
  ctx.beginPath();
  ctx.moveTo(cx, cy - spanY * 0.35);
  const steps = 11;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cx - spanX + spanX * 2 * t;
    const arch = Math.sin(t * Math.PI);
    const jag = (rand() - 0.4) * spanY * 0.45;
    const y = cy + droop * (1 - arch * 0.65) + spanY * (0.35 - arch * 0.55) + jag;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  const tuftCount = 9;
  for (let i = 0; i < tuftCount; i++) {
    const t = i / (tuftCount - 1);
    const tx = cx + (t - 0.5) * spanX * 1.75;
    const arch = Math.sin(t * Math.PI);
    const ty = cy - spanY * 0.18 * arch + droop * (1 - arch) * 0.55 + (rand() - 0.5) * 3;
    const rw = (spanX / tuftCount) * (1.7 + rand() * 0.6);
    const rh = spanY * (0.45 + rand() * 0.35);

    ctx.fillStyle = i < tuftCount * 0.65 ? midCol : darkCol;
    ctx.beginPath();
    ctx.ellipse(tx, ty, rw, rh, (t - 0.5) * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = i < tuftCount * 0.55 ? litCol : midCol;
    ctx.lineWidth = 1.4;
    for (let n = 0; n < 4; n++) {
      const ang = -Math.PI * 0.85 + n * 0.42 + (t - 0.5) * 0.7;
      const len = rw * (0.85 + rand() * 0.45);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(ang) * len, ty + Math.sin(ang) * len * 0.72);
      ctx.stroke();
    }
  }

  ctx.fillStyle = tipCol;
  for (let i = 0; i < 5; i++) {
    const t = i / 6;
    const tx = cx - spanX * 0.72 + t * spanX * 1.15;
    const ty = cy - spanY * 0.25 + (rand() - 0.5) * 4;
    ctx.beginPath();
    ctx.ellipse(tx, ty, spanX * 0.16, spanY * 0.22, -0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLeafRosette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  rand: () => number
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const lobes = 7;
  for (let i = 0; i <= lobes * 2; i++) {
    const ang = (i / (lobes * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? r * (0.88 + rand() * 0.28) : r * (0.64 + rand() * 0.16);
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad * 0.84;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function buildRealisticTreeSprite(species: number): HTMLCanvasElement {
  const w = 192;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 340;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(256 / w, 340 / h);
  const rand = makePrng(401 + species * 97);

  const baseX = w * 0.5;
  const baseY = h - 4;

  if (species === 0 || species === 1 || species === 4) {
    const isRedwood = species === 1;
    const isWindswept = species === 4;
    const lean = isWindswept ? 8 : (rand() - 0.5) * 5;
    const trunkW = isRedwood ? 18 : isWindswept ? 13 : 15;
    const barkDark = isRedwood ? '#26130b' : '#1f150e';
    const barkMid = isRedwood ? '#4b2718' : '#3d2a1c';
    const barkLit = isRedwood ? '#6b3b25' : '#573d2a';

    drawNaturalTrunk(ctx, baseX, baseY, baseX + lean, 26, trunkW, 3.2, barkDark, barkMid, barkLit, false, rand);

    ctx.strokeStyle = barkMid;
    ctx.lineWidth = 2.2;
    for (let s = 0; s < 3; s++) {
      const sy = baseY - 24 - s * 14;
      const dir = s % 2 === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(baseX + dir * 3, sy);
      ctx.lineTo(baseX + dir * (15 + rand() * 10), sy + 5);
      ctx.stroke();
    }

    const darkCol = isRedwood ? '#0f2115' : '#0c1d13';
    const midCol = isRedwood ? '#1d4429' : isWindswept ? '#1f492d' : '#1b4225';
    const litCol = isRedwood ? '#34693c' : isWindswept ? '#356d40' : '#2f6336';
    const tipCol = isRedwood ? '#4d874a' : '#4a8549';

    const tiers = isRedwood ? 10 : 8;
    const crownBottom = isRedwood ? baseY - 46 : baseY - 38;
    const crownTop = 18;
    for (let t = 0; t < tiers; t++) {
      const frac = t / (tiers - 1);
      const y = crownBottom - frac * (crownBottom - crownTop);
      const maxSpan = (isRedwood ? 60 : 66) * (1 - frac * 0.74) * (0.9 + rand() * 0.22);
      const xOffset = lean * frac + (rand() - 0.5) * 9 * (1 - frac * 0.5);
      const spanY = 14 + (1 - frac) * 11;
      const droop = (1 - frac) * 11;

      drawNeedleClusterSpray(ctx, baseX + xOffset + 4, y + 4, maxSpan * 0.92, spanY, droop, darkCol, darkCol, midCol, midCol, rand);
      drawNeedleClusterSpray(ctx, baseX + xOffset - maxSpan * 0.16, y, maxSpan * 0.76, spanY, droop * 0.85, darkCol, midCol, litCol, tipCol, rand);
      drawNeedleClusterSpray(ctx, baseX + xOffset + maxSpan * 0.2, y + 2, maxSpan * 0.68, spanY * 0.92, droop * 0.95, darkCol, midCol, midCol, litCol, rand);
    }

    ctx.strokeStyle = litCol;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(baseX + lean, 28);
    ctx.lineTo(baseX + lean + (rand() - 0.5) * 3, 7);
    ctx.stroke();
    return canvas;
  }

  const isBirch = species === 3;
  const isMaple = species === 5;
  const trunkH = isBirch ? 156 : 138;
  const trunkTopY = baseY - trunkH;
  const leanX = isBirch ? (rand() - 0.5) * 14 : (rand() - 0.5) * 8;

  drawNaturalTrunk(
    ctx,
    baseX,
    baseY,
    baseX + leanX,
    trunkTopY,
    isBirch ? 13 : 20,
    isBirch ? 5 : 8,
    isBirch ? '#57534e' : '#1f140d',
    isBirch ? '#b8b2a6' : '#3d291a',
    isBirch ? '#e7e2d8' : '#5e402b',
    isBirch,
    rand
  );

  const limbColor = isBirch ? '#9c968b' : '#362315';
  const branchTips: Array<{ x: number; y: number; r: number }> = [];
  const forkCount = isBirch ? 5 : 4;
  for (let b = 0; b < forkCount; b++) {
    const startFrac = 0.42 + (b / forkCount) * 0.35;
    const sx = baseX + leanX * startFrac;
    const sy = baseY - trunkH * startFrac;
    const dir = b % 2 === 0 ? -1 : 1;
    const ex = sx + dir * (28 + rand() * 34);
    const ey = sy - (36 + rand() * 40);

    ctx.strokeStyle = limbColor;
    ctx.lineWidth = isBirch ? 4.2 : 6.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + ex) * 0.5 + dir * 6, (sy + ey) * 0.5 + 8, ex, ey);
    ctx.stroke();

    const tx = ex + dir * (12 + rand() * 14);
    const ty = ey - (14 + rand() * 18);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    branchTips.push({ x: ex, y: ey, r: 26 + rand() * 14 });
    branchTips.push({ x: tx, y: ty, r: 20 + rand() * 10 });
  }
  branchTips.push({ x: baseX + leanX, y: trunkTopY - 22, r: 34 });
  branchTips.push({ x: baseX + leanX - 18, y: trunkTopY - 8, r: 28 });
  branchTips.push({ x: baseX + leanX + 20, y: trunkTopY - 4, r: 26 });

  const deepShade = isBirch ? '#1b3d20' : isMaple ? '#162f18' : '#122916';
  const midShade = isBirch ? '#30632e' : isMaple ? '#285729' : '#224d26';
  const sunlitMid = isBirch ? '#528d3e' : isMaple ? '#457a37' : '#3a6e34';
  const sunlitTip = isBirch ? '#82b352' : isMaple ? '#6c9c44' : '#5f9446';

  for (const sub of branchTips) {
    for (let k = 0; k < 4; k++) {
      const ang = rand() * Math.PI * 2;
      const dist = rand() * sub.r * 0.62;
      drawLeafRosette(ctx, sub.x + Math.cos(ang) * dist + 4, sub.y + Math.sin(ang) * dist * 0.78 + 5, 12 + rand() * 10, deepShade, rand);
    }
  }

  for (const sub of branchTips) {
    const count = isBirch ? 5 : 7;
    for (let k = 0; k < count; k++) {
      const ang = rand() * Math.PI * 2;
      const dist = rand() * sub.r * 0.78;
      const lx = sub.x + Math.cos(ang) * dist;
      const ly = sub.y + Math.sin(ang) * dist * 0.8;
      const col = lx < baseX + 10 && ly < sub.y + 4 ? sunlitMid : midShade;
      drawLeafRosette(ctx, lx, ly, 10 + rand() * 9, col, rand);
    }
  }

  for (const sub of branchTips) {
    for (let k = 0; k < 4; k++) {
      const ang = -Math.PI * 0.95 + rand() * Math.PI * 0.9;
      const dist = sub.r * (0.25 + rand() * 0.58);
      const lx = sub.x + Math.cos(ang) * dist - 3;
      const ly = sub.y + Math.sin(ang) * dist * 0.75 - 4;
      drawLeafRosette(ctx, lx, ly, 6.5 + rand() * 6, sunlitTip, rand);
    }
  }

  return canvas;
}

function buildRealisticUndergrowthSprite(kind: number): HTMLCanvasElement {
  const w = 144;
  const h = 104;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = makePrng(907 + kind * 53);

  if (kind === 0) {
    const cx = w * 0.5;
    const by = h - 6;
    ctx.fillStyle = '#363936';
    ctx.beginPath();
    ctx.moveTo(cx - 56, by);
    ctx.lineTo(cx - 48, by - 28);
    ctx.lineTo(cx - 24, by - 54);
    ctx.lineTo(cx + 8, by - 60);
    ctx.lineTo(cx + 38, by - 42);
    ctx.lineTo(cx + 56, by - 14);
    ctx.lineTo(cx + 58, by);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#636863';
    ctx.beginPath();
    ctx.moveTo(cx - 56, by);
    ctx.lineTo(cx - 48, by - 28);
    ctx.lineTo(cx - 24, by - 54);
    ctx.lineTo(cx - 4, by - 36);
    ctx.lineTo(cx - 14, by);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#797f79';
    ctx.beginPath();
    ctx.moveTo(cx - 24, by - 54);
    ctx.lineTo(cx + 8, by - 60);
    ctx.lineTo(cx + 14, by - 34);
    ctx.lineTo(cx - 4, by - 36);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(18, 20, 18, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 4, by - 36);
    ctx.lineTo(cx - 14, by - 4);
    ctx.moveTo(cx + 14, by - 34);
    ctx.lineTo(cx + 28, by - 8);
    ctx.stroke();

    for (let i = 0; i < 16; i++) {
      const mx = cx - 28 + i * 3.6;
      const my = by - 50 - Math.sin((i / 15) * Math.PI) * 11 + (rand() - 0.5) * 6;
      drawLeafRosette(ctx, mx, my, 5 + rand() * 4.5, i % 3 === 0 ? '#558c44' : '#356633', rand);
    }
    return canvas;
  }

  if (kind === 1) {
    const cx = w * 0.5;
    const by = h - 4;
    const fronds = 13;
    for (let i = 0; i < fronds; i++) {
      const t = i / (fronds - 1);
      const ang = -Math.PI * 0.92 + t * Math.PI * 0.84;
      const len = 48 + Math.sin(t * Math.PI) * 30 + rand() * 10;
      const ex = cx + Math.cos(ang) * len;
      const ey = by + Math.sin(ang) * len * 0.86;
      const ctrlX = cx + Math.cos(ang) * len * 0.52;
      const ctrlY = by + Math.sin(ang) * len * 0.52 - 16;

      const isBack = i % 2 === 0;
      const frondCol = isBack ? '#1c4223' : t > 0.25 && t < 0.75 ? '#3a753b' : '#2b592e';
      ctx.strokeStyle = frondCol;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, by);
      ctx.quadraticCurveTo(ctrlX, ctrlY, ex, ey);
      ctx.stroke();

      const leaflets = 11;
      for (let l = 1; l < leaflets; l++) {
        const lt = l / leaflets;
        const px = (1 - lt) * (1 - lt) * cx + 2 * (1 - lt) * lt * ctrlX + lt * lt * ex;
        const py = (1 - lt) * (1 - lt) * by + 2 * (1 - lt) * lt * ctrlY + lt * lt * ey;
        const leafW = (1 - lt * 0.72) * 8.5;
        ctx.fillStyle = lt > 0.6 && !isBack ? '#5c9649' : frondCol;
        ctx.beginPath();
        ctx.ellipse(px, py, leafW, 2.6, ang + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return canvas;
  }

  const by = h - 8;
  // Irregular weathered fallen trunk with root flare on left and sawn/broken heartwood on right
  ctx.fillStyle = '#362216';
  ctx.beginPath();
  ctx.moveTo(10, by - 4);
  ctx.quadraticCurveTo(18, by - 32, 34, by - 28);
  ctx.quadraticCurveTo(68, by - 25, w - 20, by - 23);
  ctx.lineTo(w - 16, by - 6);
  ctx.quadraticCurveTo(72, by - 2, 16, by - 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#573a26';
  ctx.beginPath();
  ctx.moveTo(22, by - 17);
  ctx.quadraticCurveTo(66, by - 26, w - 20, by - 22);
  ctx.lineTo(w - 18, by - 13);
  ctx.quadraticCurveTo(68, by - 14, 20, by - 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#8a6948';
  ctx.beginPath();
  ctx.ellipse(w - 18, by - 14, 6, 9, 0.1, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 16; i++) {
    const mx = 22 + i * 6.4;
    drawLeafRosette(ctx, mx, by - 24 + (rand() - 0.5) * 4, 4.5 + rand() * 3.8, i % 2 === 0 ? '#4c8541' : '#2e5c2c', rand);
  }
  for (let f = 0; f < 4; f++) {
    ctx.fillStyle = f % 2 === 0 ? '#fef3c7' : '#fde68a';
    ctx.beginPath();
    ctx.arc(32 + f * 22, by - 28 + (rand() - 0.5) * 4, 2.0, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function buildRealisticCavePropSprite(kind: number): HTMLCanvasElement {
  const w = 112;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const cx = w * 0.5;
  const by = h - 4;

  if (kind === 0) {
    ctx.fillStyle = '#252423';
    ctx.beginPath();
    ctx.moveTo(cx - 34, by);
    ctx.lineTo(cx - 24, by - 36);
    ctx.lineTo(cx - 14, by - 92);
    ctx.lineTo(cx - 4, by - 142);
    ctx.lineTo(cx + 4, by - 144);
    ctx.lineTo(cx + 15, by - 88);
    ctx.lineTo(cx + 27, by - 32);
    ctx.lineTo(cx + 36, by);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#474542';
    ctx.beginPath();
    ctx.moveTo(cx - 34, by);
    ctx.lineTo(cx - 24, by - 36);
    ctx.lineTo(cx - 14, by - 92);
    ctx.lineTo(cx - 4, by - 142);
    ctx.lineTo(cx + 1, by - 142);
    ctx.lineTo(cx - 2, by - 84);
    ctx.lineTo(cx - 6, by);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(214, 211, 209, 0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const rx = (i - 1.5) * 6;
      ctx.beginPath();
      ctx.moveTo(cx + rx * 0.4, by - 130 + i * 16);
      ctx.lineTo(cx + rx, by - 10);
      ctx.stroke();
    }
    return canvas;
  }

  ctx.fillStyle = '#1f2024';
  ctx.beginPath();
  ctx.moveTo(cx - 38, by);
  ctx.lineTo(cx - 30, by - 32);
  ctx.lineTo(cx, by - 44);
  ctx.lineTo(cx + 32, by - 28);
  ctx.lineTo(cx + 40, by);
  ctx.closePath();
  ctx.fill();

  const prisms = [
    { dx: -16, tilt: -0.34, h: 78, w: 12 },
    { dx: 18, tilt: 0.3, h: 72, w: 11 },
    { dx: -4, tilt: -0.08, h: 112, w: 15 },
    { dx: 9, tilt: 0.16, h: 92, w: 13 },
  ];
  const isAmber = kind === 2;
  const colLit = isAmber ? '#fbbf24' : '#67e8f9';
  const colMid = isAmber ? '#d97706' : '#0891b2';
  const colDark = isAmber ? '#78350f' : '#164e63';

  for (const p of prisms) {
    ctx.save();
    ctx.translate(cx + p.dx, by - 24);
    ctx.rotate(p.tilt);
    ctx.fillStyle = colDark;
    ctx.beginPath();
    ctx.moveTo(-p.w * 0.5, 0);
    ctx.lineTo(-p.w * 0.44, -p.h * 0.8);
    ctx.lineTo(0, -p.h);
    ctx.lineTo(p.w * 0.44, -p.h * 0.8);
    ctx.lineTo(p.w * 0.5, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colMid;
    ctx.beginPath();
    ctx.moveTo(-p.w * 0.5, 0);
    ctx.lineTo(-p.w * 0.44, -p.h * 0.8);
    ctx.lineTo(0, -p.h);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = colLit;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-p.w * 0.44, -p.h * 0.8);
    ctx.lineTo(0, -p.h);
    ctx.lineTo(0, -p.h * 0.12);
    ctx.stroke();
    ctx.restore();
  }
  return canvas;
}

export function getRealisticTreeSprite(species: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = ((species % 6) + 6) % 6;
  let sprite = treeSpriteCache.get(key);
  if (!sprite) {
    sprite = buildRealisticTreeSprite(key);
    treeSpriteCache.set(key, sprite);
  }
  return sprite;
}

export function getRealisticUndergrowthSprite(kind: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = ((kind % 3) + 3) % 3;
  let sprite = undergrowthSpriteCache.get(key);
  if (!sprite) {
    sprite = buildRealisticUndergrowthSprite(key);
    undergrowthSpriteCache.set(key, sprite);
  }
  return sprite;
}

export function getRealisticCavePropSprite(kind: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = ((kind % 3) + 3) % 3;
  let sprite = cavePropSpriteCache.get(key);
  if (!sprite) {
    sprite = buildRealisticCavePropSprite(key);
    cavePropSpriteCache.set(key, sprite);
  }
  return sprite;
}
