/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Daily missions + personal-best bonus. Pure logic; persistence lives in App.
 * Ethical loop: rewards only, no penalties for skipping a day.
 */

export type MissionMetric = 'nearMisses' | 'maxCombo' | 'coinsCollected' | 'distance' | 'score' | 'overtakes';

export interface Mission {
  id: string;
  metric: MissionMetric;
  mode: 'sum' | 'best';
  target: number;
  progress: number;
  claimed: boolean;
  reward: number;
  label: string;
}

export interface MissionState {
  day: string;
  missions: Mission[];
}

export interface RunResult {
  score: number;
  distance: number;
  maxCombo: number;
  coinsCollected: number;
  overtakes?: number;
  nearMisses?: number;
}

const POOL: Omit<Mission, 'progress' | 'claimed' | 'id'>[] = [
  { metric: 'nearMisses', mode: 'sum', target: 15, reward: 180, label: 'Land 15 near misses' },
  { metric: 'nearMisses', mode: 'sum', target: 30, reward: 300, label: 'Land 30 near misses' },
  { metric: 'maxCombo', mode: 'best', target: 12, reward: 160, label: 'Reach a x12 combo' },
  { metric: 'maxCombo', mode: 'best', target: 20, reward: 280, label: 'Reach a x20 combo' },
  { metric: 'coinsCollected', mode: 'sum', target: 150, reward: 150, label: 'Collect 150 CR' },
  { metric: 'coinsCollected', mode: 'sum', target: 400, reward: 260, label: 'Collect 400 CR' },
  { metric: 'distance', mode: 'sum', target: 3000, reward: 160, label: 'Drive 3 km total' },
  { metric: 'distance', mode: 'best', target: 1500, reward: 240, label: 'Drive 1.5 km in one run' },
  { metric: 'score', mode: 'best', target: 25000, reward: 220, label: 'Score 25,000 in one run' },
  { metric: 'overtakes', mode: 'sum', target: 60, reward: 200, label: 'Overtake 60 cars' },
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dailyMissions(day: string): MissionState {
  let seed = hash(day);
  const picked: Mission[] = [];
  const usedMetrics = new Set<MissionMetric>();
  let guard = 0;
  while (picked.length < 3 && guard++ < 200) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const idx = seed % POOL.length;
    const m = POOL[idx];
    if (usedMetrics.has(m.metric)) continue;
    usedMetrics.add(m.metric);
    picked.push({ ...m, id: `${day}:${idx}`, progress: 0, claimed: false });
  }
  return { day, missions: picked };
}

export function applyRunToMissions(
  state: MissionState,
  run: RunResult
): { state: MissionState; earned: number; completed: string[] } {
  let earned = 0;
  const completed: string[] = [];
  const missions = state.missions.map((m) => {
    if (m.claimed) return m;
    const value = run[m.metric] ?? 0;
    const progress = Math.min(m.target, m.mode === 'sum' ? m.progress + value : Math.max(m.progress, value));
    const done = progress >= m.target;
    if (done) {
      earned += m.reward;
      completed.push(m.id);
    }
    return { ...m, progress, claimed: done };
  });
  return { state: { ...state, missions }, earned, completed };
}

/** +20% of the run's coins when a previous best exists and is beaten. */
export function pbBonusCoins(score: number, previousBest: number, runCoins: number): number {
  if (previousBest <= 0 || score <= previousBest) return 0;
  return Math.round(runCoins * 0.2);
}
