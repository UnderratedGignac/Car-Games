/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SCurvePoint } from './rules';

export type AdventureZoneKind = 'forest' | 'cave';

export type AdventureRoadFeature =
  | 'forest_trail'
  | 'wooden_bridge'
  | 'cave_entrance'
  | 'cave_interior'
  | 'cave_exit'
  | 'ruin_pass';

export interface AdventureChapterSpec {
  id: string;
  name: string;
  zone: AdventureZoneKind;
  startDistM: number;
  endDistM: number;
  featureBias: 'emerald' | 'bridge' | 'crystal_cave' | 'ruins' | 'amber_cave';
  crystalPrimary: string;
  crystalSecondary: string;
  caveWallDark: string;
  caveWallMid: string;
  caveCeiling: string;
  lanternGlow: string;
  foliageLight: string;
  foliageDark: string;
  terrainHillLight: string;
  terrainHillDark: string;
  terrainBankLight: string;
  terrainBankDark: string;
  riverColor: string;
  riverGlint: string;
}

export interface AdventureZoneSample {
  chapter: AdventureChapterSpec;
  zone: AdventureZoneKind;
  feature: AdventureRoadFeature;
  /** Smooth 0..1 enclosure factor: 0 = open forest sky, 1 = deep inside rock cave */
  caveBlend: number;
  /** True right at the stone portal entering a cave */
  isCavePortalIn: boolean;
  /** True right at the stone portal exiting a cave */
  isCavePortalOut: boolean;
  /** True along wooden suspension / trestle bridge segments over forest rivers */
  isWoodenBridge: boolean;
  /** True on ancient stone ruin archway landmarks */
  hasRuinArch: boolean;
  /** True on forest timber trail archway signposts */
  hasTimberGate: boolean;
  /** Bridge transition 0..1 (for dropping canyon river chasm cleanly under bridges) */
  bridgeBlend: number;
}

export const ADVENTURE_CYCLE_METERS = 440;

const ADVENTURE_CHAPTERS: AdventureChapterSpec[] = [
  {
    id: 'emerald_forest',
    name: 'Emerald Pine Forest',
    zone: 'forest',
    startDistM: 0,
    endDistM: 48,
    featureBias: 'emerald',
    crystalPrimary: '#38bdf8',
    crystalSecondary: '#34d399',
    caveWallDark: '#363b47',
    caveWallMid: '#525b6e',
    caveCeiling: '#232733',
    lanternGlow: '#fde68a',
    foliageLight: '#4b7840',
    foliageDark: '#234222',
    terrainHillLight: '#3a5932',
    terrainHillDark: '#21361f',
    terrainBankLight: '#495b38',
    terrainBankDark: '#2e3b25',
    riverColor: '#1b5063',
    riverGlint: '#93c5d6',
  },
  {
    id: 'timber_bridge',
    name: 'Whispering River Bridge',
    zone: 'forest',
    startDistM: 48,
    endDistM: 102,
    featureBias: 'bridge',
    crystalPrimary: '#38bdf8',
    crystalSecondary: '#fbbf24',
    caveWallDark: '#363b47',
    caveWallMid: '#525b6e',
    caveCeiling: '#232733',
    lanternGlow: '#fef08a',
    foliageLight: '#528044',
    foliageDark: '#264724',
    terrainHillLight: '#3d5e34',
    terrainHillDark: '#243a21',
    terrainBankLight: '#545b47',
    terrainBankDark: '#363b2f',
    riverColor: '#16586e',
    riverGlint: '#bae6fd',
  },
  {
    id: 'crystal_cave',
    name: 'Crystal Cavern',
    zone: 'cave',
    startDistM: 102,
    endDistM: 218,
    featureBias: 'crystal_cave',
    crystalPrimary: '#38bdf8',
    crystalSecondary: '#818cf8',
    caveWallDark: '#333b4f',
    caveWallMid: '#505c78',
    caveCeiling: '#212736',
    lanternGlow: '#fbbf24',
    foliageLight: '#365439',
    foliageDark: '#1d3020',
    terrainHillLight: '#344c37',
    terrainHillDark: '#203124',
    terrainBankLight: '#3b423c',
    terrainBankDark: '#232724',
    riverColor: '#133b4a',
    riverGlint: '#67e8f9',
  },
  {
    id: 'ancient_ruins',
    name: 'Ancient Ruin Woods',
    zone: 'forest',
    startDistM: 218,
    endDistM: 326,
    featureBias: 'ruins',
    crystalPrimary: '#34d399',
    crystalSecondary: '#fbbf24',
    caveWallDark: '#363b47',
    caveWallMid: '#525b6e',
    caveCeiling: '#232733',
    lanternGlow: '#fcd34d',
    foliageLight: '#49743f',
    foliageDark: '#203d22',
    terrainHillLight: '#365430',
    terrainHillDark: '#1f331d',
    terrainBankLight: '#4a5739',
    terrainBankDark: '#2e3826',
    riverColor: '#174c5c',
    riverGlint: '#7dd3fc',
  },
  {
    id: 'amber_cave',
    name: 'Amber Glow Cavern',
    zone: 'cave',
    startDistM: 326,
    endDistM: 440,
    featureBias: 'amber_cave',
    crystalPrimary: '#f59e0b',
    crystalSecondary: '#fb923c',
    caveWallDark: '#42342c',
    caveWallMid: '#634f43',
    caveCeiling: '#2b211c',
    lanternGlow: '#fb923c',
    foliageLight: '#3a5738',
    foliageDark: '#1f331f',
    terrainHillLight: '#384632',
    terrainHillDark: '#222c1f',
    terrainBankLight: '#3d342d',
    terrainBankDark: '#26201b',
    riverColor: '#452216',
    riverGlint: '#fdba74',
  },
];

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Resolves the active Forest & Caves Adventure zone at a given track distance in meters
 * (or slice index * stepDistance).
 */
export function resolveAdventureZone(
  distanceMeters: number,
  sliceIndex = -1
): AdventureZoneSample {
  const safeDist = Math.max(0, distanceMeters);
  const cycDist = safeDist % ADVENTURE_CYCLE_METERS;

  let chapter = ADVENTURE_CHAPTERS[0];
  for (let i = 0; i < ADVENTURE_CHAPTERS.length; i++) {
    const ch = ADVENTURE_CHAPTERS[i];
    if (cycDist >= ch.startDistM && cycDist < ch.endDistM) {
      chapter = ch;
      break;
    }
  }

  let caveBlend = 0;
  let isCavePortalIn = false;
  let isCavePortalOut = false;

  if (chapter.zone === 'cave') {
    const intoCave = cycDist - chapter.startDistM;
    const outOfCave = chapter.endDistM - cycDist;
    const enterRamp = smoothStep(0, 9.5, intoCave);
    const exitRamp = smoothStep(0, 9.5, outOfCave);
    caveBlend = Math.min(enterRamp, exitRamp);
    isCavePortalIn = intoCave >= 0 && intoCave < 3.0;
    isCavePortalOut = outOfCave > 0 && outOfCave <= 3.0;
  }

  // Bridge spans chapter 2 (48..102m) plus a short log-bridge crossing inside Ancient Ruins (268..298m)
  const inMainBridge = cycDist >= 50 && cycDist <= 98;
  const inRuinBridge = cycDist >= 268 && cycDist <= 298;
  const isWoodenBridge = inMainBridge || inRuinBridge;

  let bridgeBlend = 0;
  if (cycDist >= 44 && cycDist <= 104) {
    bridgeBlend = Math.min(smoothStep(44, 52, cycDist), smoothStep(104, 96, cycDist));
  } else if (cycDist >= 262 && cycDist <= 304) {
    bridgeBlend = Math.min(smoothStep(262, 270, cycDist), smoothStep(304, 296, cycDist));
  }

  let feature: AdventureRoadFeature = 'forest_trail';
  if (isCavePortalIn) feature = 'cave_entrance';
  else if (isCavePortalOut) feature = 'cave_exit';
  else if (chapter.zone === 'cave') feature = 'cave_interior';
  else if (isWoodenBridge) feature = 'wooden_bridge';
  else if (chapter.featureBias === 'ruins') feature = 'ruin_pass';

  const hasRuinArch =
    sliceIndex >= 16 &&
    chapter.zone === 'forest' &&
    !isWoodenBridge &&
    ((chapter.featureBias === 'ruins' && sliceIndex % 16 === 4) ||
      (chapter.featureBias === 'emerald' && sliceIndex % 24 === 18));

  const hasTimberGate =
    sliceIndex >= 10 &&
    chapter.zone === 'forest' &&
    !hasRuinArch &&
    !isWoodenBridge &&
    sliceIndex % 18 === 8;

  return {
    chapter,
    zone: chapter.zone,
    feature,
    caveBlend,
    isCavePortalIn,
    isCavePortalOut,
    isWoodenBridge,
    hasRuinArch,
    hasTimberGate,
    bridgeBlend,
  };
}

/**
 * Computes contoured adventure terrain height relative to the road deck.
 * Unlike the elevated highway viaduct, Forest hillsides hug right up to the road shoulder
 * while Wooden Bridges and Deep Cave Chasms drop away into dramatic gorges & rivers!
 */
export function sampleAdventureTerrainElevation(
  lateralDist: number,
  worldZ: number,
  roadY: number,
  sample: AdventureZoneSample
): number {
  const absLat = Math.abs(lateralDist);
  const gorgeDrop = sample.bridgeBlend * 7.8 + sample.caveBlend * 3.8;

  // Underneath the road corridor: recessed riverbed / cavern floor
  if (absLat <= 6.2) {
    const dip = Math.cos((absLat / 6.2) * Math.PI * 0.5) * 1.1;
    return roadY - 2.2 - gorgeDrop - dip;
  }

  // Forest shoulders hug right alongside the road (around roadY - 0.5 up to +4.6m rolling hills)
  // On bridges, banks slope cleanly down toward the river chasm
  const shoulderT = Math.min(1, (absLat - 6.2) / 10.5);
  const outerT = Math.max(0, Math.min(1, (absLat - 16.7) / 36.0));
  const undulation =
    Math.sin(worldZ * 0.055 + lateralDist * 0.13) * 1.15 +
    Math.cos(worldZ * 0.028 - lateralDist * 0.07) * 0.85;

  if (sample.caveBlend > 0.25) {
    // Rugged cavern rock floor & natural rolling mountain hillside outside
    const caveFloor = roadY - 1.3 - sample.caveBlend * 1.6;
    const wallRise = shoulderT * 2.5 + outerT * 5.8;
    return caveFloor + wallRise + Math.abs(undulation) * 0.65;
  }

  const forestBase = roadY - 0.65 - sample.bridgeBlend * 4.8;
  const hillRise = shoulderT * 1.9 + outerT * 5.2 + (0.35 + shoulderT * 0.65) * Math.max(-0.4, undulation);
  return forestBase + hillRise;
}

/**
 * Generates an adventurous winding elevation offset for Drift Mode tracks:
 * - Preserves idx < 12 flat/straight launchpad safety
 * - Climbs scenic forest ridges, dips into river bridge valleys, and plunges into cave portals
 */
export function computeAdventureRoadElevation(
  sliceIndex: number,
  stepDistance: number,
  seed: number
): number {
  if (sliceIndex <= 6) return 0;
  const ramp = Math.min(1, (sliceIndex - 6) / 10);
  const distM = sliceIndex * stepDistance;
  const zoneSample = resolveAdventureZone(distM, sliceIndex);

  // Rolling forest switchback waves + valley dip across bridges + subterranean plunge in caves
  const ridgeWave =
    Math.sin(sliceIndex * 0.068 + seed * 0.11) * 2.35 +
    Math.cos(sliceIndex * 0.029 + seed * 0.07) * 1.45;
  const bridgeDip = -zoneSample.bridgeBlend * 1.25;
  const caveDip = -zoneSample.caveBlend * 1.65;

  return Number((ramp * (ridgeWave + bridgeDip + caveDip)).toFixed(2));
}

/**
 * Helper to apply adventure road elevation onto an existing SCurvePoint segment array
 * without mutating the standard highway/rules.test.ts defaults.
 */
export function applyAdventureElevationProfile(
  points: SCurvePoint[],
  stepDistance: number,
  seed: number
): void {
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    pt.y = computeAdventureRoadElevation(pt.index, stepDistance, seed);
  }
}
