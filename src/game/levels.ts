/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RoadBiomeId } from './rules';
import type { SkyThemeId } from './skyArt';

export type CampaignStageMode = 'drift' | 'highway_traffic';

export interface CampaignLevel {
  id: string;
  number: number;
  chapter: string;
  title: string;
  subtitle: string;
  mode: CampaignStageMode;
  biome: RoadBiomeId;
  sky: SkyThemeId;
  targetDistance: number;
  curveMultiplier: number;
  widthMultiplier: number;
  trafficDensity: number;
  starThresholds: [number, number, number];
  rewardCoins: number;
  seed: number;
}

export interface LevelProgressEntry {
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  bestDistance: number;
}

export type LevelProgressMap = Record<string, LevelProgressEntry>;

export const LEVEL_PROGRESS_STORAGE_KEY = 'apex_slash_level_progress_v1';
export const SELECTED_LEVEL_STORAGE_KEY = 'apex_slash_selected_level_v1';

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  {
    id: 'lvl_01',
    number: 1,
    chapter: 'CH.1 · ALPINE DAWN',
    title: 'Morning Hairpin',
    subtitle: 'Learn weight transfer across crisp alpine switchbacks.',
    mode: 'drift',
    biome: 'alpine',
    sky: 'sun_day',
    targetDistance: 450,
    curveMultiplier: 0.78,
    widthMultiplier: 1.12,
    trafficDensity: 0,
    starThresholds: [1400, 3000, 5000],
    rewardCoins: 120,
    seed: 101,
  },
  {
    id: 'lvl_02',
    number: 2,
    chapter: 'CH.1 · ALPINE DAWN',
    title: 'Sunrise Commute',
    subtitle: 'Thread 2-lane mountain highway traffic at dawn.',
    mode: 'highway_traffic',
    biome: 'alpine',
    sky: 'sun_day',
    targetDistance: 550,
    curveMultiplier: 0.76,
    widthMultiplier: 1.05,
    trafficDensity: 0.75,
    starThresholds: [2200, 4400, 7000],
    rewardCoins: 150,
    seed: 202,
  },
  {
    id: 'lvl_03',
    number: 3,
    chapter: 'CH.2 · RED CANYON',
    title: 'Mesa Switchbacks',
    subtitle: 'Hold sweeping drifts along desert canyon cliffs at dusk.',
    mode: 'drift',
    biome: 'canyon',
    sky: 'golden_sunset',
    targetDistance: 640,
    curveMultiplier: 0.94,
    widthMultiplier: 1.04,
    trafficDensity: 0,
    starThresholds: [3000, 5600, 8800],
    rewardCoins: 180,
    seed: 303,
  },
  {
    id: 'lvl_04',
    number: 4,
    chapter: 'CH.2 · RED CANYON',
    title: 'Sunset Slipstream',
    subtitle: 'Chain near-miss overtakes down the amber expressway.',
    mode: 'highway_traffic',
    biome: 'canyon',
    sky: 'golden_sunset',
    targetDistance: 740,
    curveMultiplier: 0.95,
    widthMultiplier: 1.0,
    trafficDensity: 0.92,
    starThresholds: [3800, 7000, 10800],
    rewardCoins: 210,
    seed: 404,
  },
  {
    id: 'lvl_05',
    number: 5,
    chapter: 'CH.3 · SAKURA RIDGE',
    title: 'Blossom Touge',
    subtitle: 'Carve beneath the full harvest moon and cherry trees.',
    mode: 'drift',
    biome: 'sakura',
    sky: 'big_moon',
    targetDistance: 820,
    curveMultiplier: 1.02,
    widthMultiplier: 0.98,
    trafficDensity: 0,
    starThresholds: [4600, 8200, 12600],
    rewardCoins: 250,
    seed: 505,
  },
  {
    id: 'lvl_06',
    number: 6,
    chapter: 'CH.3 · SAKURA RIDGE',
    title: 'Moonlight Bypass',
    subtitle: 'High-speed midnight lane-splitting through valley traffic.',
    mode: 'highway_traffic',
    biome: 'sakura',
    sky: 'big_moon',
    targetDistance: 920,
    curveMultiplier: 1.02,
    widthMultiplier: 0.98,
    trafficDensity: 1.05,
    starThresholds: [5400, 9600, 14500],
    rewardCoins: 280,
    seed: 606,
  },
  {
    id: 'lvl_07',
    number: 7,
    chapter: 'CH.4 · TOKYO REDLINE',
    title: 'Crimson Serpent',
    subtitle: 'Technical neon canyon hairpins under a blood moon.',
    mode: 'drift',
    biome: 'neon',
    sky: 'red_moon',
    targetDistance: 1000,
    curveMultiplier: 1.12,
    widthMultiplier: 0.95,
    trafficDensity: 0,
    starThresholds: [6500, 11400, 17200],
    rewardCoins: 340,
    seed: 707,
  },
  {
    id: 'lvl_08',
    number: 8,
    chapter: 'CH.4 · TOKYO REDLINE',
    title: 'Wangan Midnight Rush',
    subtitle: 'Dense metropolitan highway runs under emerald aurora.',
    mode: 'highway_traffic',
    biome: 'neon',
    sky: 'aurora_night',
    targetDistance: 1120,
    curveMultiplier: 1.08,
    widthMultiplier: 0.96,
    trafficDensity: 1.18,
    starThresholds: [7800, 13400, 19800],
    rewardCoins: 400,
    seed: 808,
  },
  {
    id: 'lvl_09',
    number: 9,
    chapter: 'CH.5 · APEX FINALS',
    title: 'Aurora Apex Duel',
    subtitle: 'Razor-narrow alpine ridge with rapid consecutive S-bends.',
    mode: 'drift',
    biome: 'alpine',
    sky: 'aurora_night',
    targetDistance: 1220,
    curveMultiplier: 1.18,
    widthMultiplier: 0.92,
    trafficDensity: 0,
    starThresholds: [9200, 15800, 23200],
    rewardCoins: 480,
    seed: 909,
  },
  {
    id: 'lvl_10',
    number: 10,
    chapter: 'CH.5 · APEX FINALS',
    title: 'Redline Emperor',
    subtitle: 'Final sprint through heavy oncoming traffic to claim the crown.',
    mode: 'highway_traffic',
    biome: 'neon',
    sky: 'red_moon',
    targetDistance: 1380,
    curveMultiplier: 1.18,
    widthMultiplier: 0.95,
    trafficDensity: 1.32,
    starThresholds: [11500, 19200, 28000],
    rewardCoins: 700,
    seed: 1010,
  },
];

export function getLevelById(id: string | null | undefined): CampaignLevel | null {
  if (!id) return null;
  return CAMPAIGN_LEVELS.find((lvl) => lvl.id === id) || null;
}

export function getNextLevel(currentId: string): CampaignLevel | null {
  const idx = CAMPAIGN_LEVELS.findIndex((lvl) => lvl.id === currentId);
  if (idx < 0 || idx >= CAMPAIGN_LEVELS.length - 1) return null;
  return CAMPAIGN_LEVELS[idx + 1];
}

export function isLevelUnlocked(
  levelNumber: number,
  progress: LevelProgressMap
): boolean {
  if (levelNumber <= 1) return true;
  const prevLevel = CAMPAIGN_LEVELS.find((lvl) => lvl.number === levelNumber - 1);
  if (!prevLevel) return false;
  return Boolean(progress[prevLevel.id]?.completed);
}

export function evaluateLevelStars(
  level: CampaignLevel,
  score: number,
  completed: boolean
): 0 | 1 | 2 | 3 {
  if (!completed) return 0;
  if (score >= level.starThresholds[2]) return 3;
  if (score >= level.starThresholds[1]) return 2;
  return 1;
}

export function evaluateLevelCompletion(
  level: CampaignLevel,
  params: { score: number; distance: number; completed: boolean },
  prevRecord?: LevelProgressEntry
): {
  starsEarned: 0 | 1 | 2 | 3;
  isFirstClear: boolean;
  bonusCoins: number;
  nextEntry: LevelProgressEntry;
} {
  const starsEarned = evaluateLevelStars(level, params.score, params.completed);
  const wasCompleted = Boolean(prevRecord?.completed);
  const isFirstClear = params.completed && !wasCompleted;
  const prevStars = prevRecord?.stars ?? 0;
  const newStarsGained = Math.max(0, starsEarned - prevStars);
  const bonusCoins = params.completed
    ? isFirstClear
      ? level.rewardCoins + (starsEarned - 1) * 40
      : newStarsGained * 40 + 35
    : 0;

  const nextEntry: LevelProgressEntry = {
    completed: wasCompleted || params.completed,
    stars: Math.max(prevStars, starsEarned) as 0 | 1 | 2 | 3,
    bestScore: Math.max(prevRecord?.bestScore ?? 0, Math.round(params.score)),
    bestDistance: Math.max(
      prevRecord?.bestDistance ?? 0,
      Math.round(params.distance)
    ),
  };

  return {
    starsEarned,
    isFirstClear,
    bonusCoins,
    nextEntry,
  };
}

export function getTotalCampaignStars(progress: LevelProgressMap): {
  earned: number;
  total: number;
  completedCount: number;
} {
  let earned = 0;
  let completedCount = 0;
  for (const lvl of CAMPAIGN_LEVELS) {
    const entry = progress[lvl.id];
    if (entry) {
      earned += entry.stars;
      if (entry.completed) completedCount++;
    }
  }
  return {
    earned,
    total: CAMPAIGN_LEVELS.length * 3,
    completedCount,
  };
}

export function loadLevelProgress(): LevelProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LEVEL_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as LevelProgressMap;
    }
  } catch {}
  return {};
}

export function saveLevelProgress(progress: LevelProgressMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LEVEL_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress)
    );
  } catch {}
}

export function loadSelectedLevelId(): string | null {
  if (typeof window === 'undefined') return 'lvl_01';
  try {
    const saved = window.localStorage.getItem(SELECTED_LEVEL_STORAGE_KEY);
    if (saved === 'free') return null;
    if (saved && getLevelById(saved)) return saved;
  } catch {}
  return 'lvl_01';
}

export function saveSelectedLevelId(levelId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SELECTED_LEVEL_STORAGE_KEY,
      levelId || 'free'
    );
  } catch {}
}
