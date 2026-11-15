/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MissionType =
  | 'drift_score'
  | 'distance'
  | 'combo'
  | 'overtakes'
  | 'near_misses'
  | 'coins'
  | 'top_speed'
  | 'touge_runs'
  | 'parking_clears'
  | 'parallel_parks'
  | 'reverse_parks'
  | 'zero_hit_parks'
  | 'gymkhana_parks'
  | 'precision_aligns'
  | 'slalom_clears'
  | 'flash_yields';

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  reward: number; // in CR
  completed: boolean;
  claimed: boolean;
  type: MissionType;
  icon: string;
  tier?: 'Standard' | 'Pro' | 'Ace';
  categoryTag?: 'Drift' | 'Highway' | 'Parking' | 'All-Mode';
}

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  type: MissionType;
  icon: string;
}

export interface RandomMissionBlueprint {
  type: MissionType;
  icon: string;
  categoryTag: 'Drift' | 'Highway' | 'Parking' | 'All-Mode';
  titles: string[];
  makeDesc: (target: number) => string;
  minTarget: number;
  maxTarget: number;
  step: number;
  baseReward: number;
  rewardPerStep: number;
}

export const DAILY_MISSIONS_STORAGE_KEY = 'neon_daily_missions_v1';
export const TECHNICAL_MISSIONS_STORAGE_KEY = 'neon_tech_missions_v1';
export const RANDOM_MISSIONS_STORAGE_KEY = 'neon_random_missions_v1';
export const RANDOM_MISSIONS_COUNT = 4;

export const MISSION_POOL: MissionTemplate[] = [
  {
    id: 'drift_virtuoso',
    title: 'Drift Virtuoso',
    description: 'Reach a drift score of 25,000 pts in a single run',
    target: 25000,
    reward: 1500,
    type: 'drift_score',
    icon: 'flame',
  },
  {
    id: 'apex_combo',
    title: 'Apex Combo',
    description: 'Pull off an 8x drift combo',
    target: 8,
    reward: 1200,
    type: 'combo',
    icon: 'zap',
  },
  {
    id: 'highway_phantom',
    title: 'Highway Phantom',
    description: 'Perform 6 near-misses in Traffic mode',
    target: 6,
    reward: 1500,
    type: 'near_misses',
    icon: 'ghost',
  },
  {
    id: 'traffic_dominator',
    title: 'Traffic Dominator',
    description: 'Overtake 15 vehicles in Traffic mode',
    target: 15,
    reward: 2000,
    type: 'overtakes',
    icon: 'car',
  },
  {
    id: 'coin_hoarder',
    title: 'Coin Hoarder',
    description: 'Collect 30 coins in runs',
    target: 30,
    reward: 1000,
    type: 'coins',
    icon: 'coins',
  },
  {
    id: 'distance_demon',
    title: 'Distance Demon',
    description: 'Cover 1,500m of distance across runs',
    target: 1500,
    reward: 1800,
    type: 'distance',
    icon: 'gauge',
  },
  {
    id: 'speed_freaks',
    title: 'Speed Freaks',
    description: 'Exceed 220 km/h in top speed',
    target: 220,
    reward: 1200,
    type: 'top_speed',
    icon: 'rocket',
  },
  {
    id: 'touge_legend',
    title: 'Touge Legend',
    description: 'Complete 3 runs on any Touge road',
    target: 3,
    reward: 1500,
    type: 'touge_runs',
    icon: 'trophy',
  },
  {
    id: 'neon_velocity',
    title: 'Neon Velocity',
    description: 'Push your ride beyond 250 km/h',
    target: 250,
    reward: 1400,
    type: 'top_speed',
    icon: 'sparkles',
  },
  {
    id: 'apex_predator',
    title: 'Apex Predator',
    description: 'Rack up 25 overtakes in Traffic mode',
    target: 25,
    reward: 2500,
    type: 'overtakes',
    icon: 'crosshair',
  },
  {
    id: 'daily_valet_ace',
    title: 'Daily Valet Ace',
    description: 'Complete 3 Parking Mode bay clears',
    target: 3,
    reward: 1600,
    type: 'parking_clears',
    icon: 'parking',
  },
  {
    id: 'daily_parallel_pro',
    title: 'Curbside Threader',
    description: 'Nail 2 tight Parallel Parking bays',
    target: 2,
    reward: 1800,
    type: 'parallel_parks',
    icon: 'sliders',
  },
  {
    id: 'daily_clean_parking',
    title: 'Zero-Scrape Valet',
    description: 'Clear 2 Parking stages with zero cone or car hits',
    target: 2,
    reward: 2100,
    type: 'zero_hit_parks',
    icon: 'cone',
  },
  {
    id: 'daily_beam_courtesy',
    title: 'Passing Lane Signal',
    description: 'Signal 5 traffic cars to yield using High-Beams or Horn',
    target: 5,
    reward: 1300,
    type: 'flash_yields',
    icon: 'zap',
  },
];

export const TECHNICAL_MISSIONS_POOL: MissionTemplate[] = [
  {
    id: 'tech_valet_apprentice',
    title: 'Valet Apprentice',
    description: 'Complete 3 bays in Precision Parking Mode using R/D gears and pedals',
    target: 3,
    reward: 1800,
    type: 'parking_clears',
    icon: 'parking',
  },
  {
    id: 'tech_parallel_perfection',
    title: 'Parallel Perfection',
    description: 'Execute 2 tight street-side Parallel Parks between parked cars',
    target: 2,
    reward: 2400,
    type: 'parallel_parks',
    icon: 'sliders',
  },
  {
    id: 'tech_reverse_master',
    title: 'Reverse Gear Master',
    description: 'Back your car into 3 Reverse Bays using Gear R & ultrasonic radar',
    target: 3,
    reward: 2200,
    type: 'reverse_parks',
    icon: 'rotate',
  },
  {
    id: 'tech_zero_scratch_valet',
    title: 'Zero-Scratch Valet',
    description: 'Lock 4 Parking stages without clipping a cone, barrier, or parked car',
    target: 4,
    reward: 3000,
    type: 'zero_hit_parks',
    icon: 'trophy',
  },
  {
    id: 'tech_slalom_technician',
    title: 'Cone Slalom Technician',
    description: 'Thread 6 slalom gates cleanly before locking into the target bay',
    target: 6,
    reward: 2000,
    type: 'slalom_clears',
    icon: 'cone',
  },
  {
    id: 'tech_gymkhana_180',
    title: 'Gymkhana 180° Driver',
    description: 'Pull a handbrake J-turn spin-in finish in Parking Mode Stage 6',
    target: 1,
    reward: 3500,
    type: 'gymkhana_parks',
    icon: 'flame',
  },
  {
    id: 'tech_laser_alignment',
    title: 'Laser Alignment',
    description: 'Park 2 times within 0.35m center offset and under 4° yaw error',
    target: 2,
    reward: 2600,
    type: 'precision_aligns',
    icon: 'crosshair',
  },
  {
    id: 'tech_highbeam_tactician',
    title: 'High-Beam Tactician',
    description: 'Flash headlamps or sound horn to yield 8 Highway Traffic cars',
    target: 8,
    reward: 1700,
    type: 'flash_yields',
    icon: 'zap',
  },
];

export const RANDOM_MISSION_BLUEPRINTS: RandomMissionBlueprint[] = [
  {
    type: 'drift_score',
    icon: 'flame',
    categoryTag: 'Drift',
    titles: ['Midnight Sideways', 'Touge Heatwave', 'Tire Smoke Contract', 'Redline Slide'],
    makeDesc: (t) => `Score ${t.toLocaleString()} pts in a single Touge or Drift run`,
    minTarget: 12000,
    maxTarget: 45000,
    step: 3000,
    baseReward: 950,
    rewardPerStep: 140,
  },
  {
    type: 'combo',
    icon: 'zap',
    categoryTag: 'Drift',
    titles: ['Switchback Chain', 'Combo Rhythm', 'Apex Linker', 'Weave Flow'],
    makeDesc: (t) => `Chain a ${t}x drift or overtake combo in any run`,
    minTarget: 5,
    maxTarget: 15,
    step: 2,
    baseReward: 900,
    rewardPerStep: 220,
  },
  {
    type: 'distance',
    icon: 'gauge',
    categoryTag: 'All-Mode',
    titles: ['Wangan Endurance', 'Horizon Courier', 'Night Mile Hunter', 'Expressway Run'],
    makeDesc: (t) => `Cover ${t.toLocaleString()}m total distance across runs`,
    minTarget: 800,
    maxTarget: 3200,
    step: 400,
    baseReward: 850,
    rewardPerStep: 240,
  },
  {
    type: 'coins',
    icon: 'coins',
    categoryTag: 'All-Mode',
    titles: ['Neon Bounty Collect', 'Street Token Sweep', 'Gold Line Pickup', 'Paddock Cash Grab'],
    makeDesc: (t) => `Collect ${t} coins across driving or parking runs`,
    minTarget: 15,
    maxTarget: 65,
    step: 5,
    baseReward: 750,
    rewardPerStep: 110,
  },
  {
    type: 'overtakes',
    icon: 'car',
    categoryTag: 'Highway',
    titles: ['Lane Splitter', 'Wangan Express', 'Rush Hour Cutter', 'Slipstream Pass'],
    makeDesc: (t) => `Overtake ${t} traffic vehicles on the highway`,
    minTarget: 8,
    maxTarget: 32,
    step: 4,
    baseReward: 950,
    rewardPerStep: 230,
  },
  {
    type: 'near_misses',
    icon: 'ghost',
    categoryTag: 'Highway',
    titles: ['Razor Edge', 'Paint Shaver', 'Close Call Rush', 'Mirror Grazing'],
    makeDesc: (t) => `Pull off ${t} close near-misses in Highway Traffic`,
    minTarget: 3,
    maxTarget: 12,
    step: 1,
    baseReward: 950,
    rewardPerStep: 190,
  },
  {
    type: 'top_speed',
    icon: 'rocket',
    categoryTag: 'Highway',
    titles: ['Terminal Velocity', 'Speed Trap Trigger', 'Turbo Overspeed', 'Midnight Blitz'],
    makeDesc: (t) => `Hit ${t} km/h peak speed in any run`,
    minTarget: 195,
    maxTarget: 285,
    step: 15,
    baseReward: 900,
    rewardPerStep: 210,
  },
  {
    type: 'touge_runs',
    icon: 'trophy',
    categoryTag: 'Drift',
    titles: ['Mountain Patrol', 'Peak Runner', 'Touge Regular', 'Canyon Attack'],
    makeDesc: (t) => `Finish ${t} Touge or Drift runs`,
    minTarget: 2,
    maxTarget: 5,
    step: 1,
    baseReward: 950,
    rewardPerStep: 420,
  },
  {
    type: 'flash_yields',
    icon: 'zap',
    categoryTag: 'Highway',
    titles: ['Passing Beam Blitz', 'Horn Clearance', 'Fast-Lane Protocol', 'Overtake Flash'],
    makeDesc: (t) => `Flash high-beams or honk to yield ${t} traffic cars`,
    minTarget: 3,
    maxTarget: 11,
    step: 2,
    baseReward: 850,
    rewardPerStep: 280,
  },
  {
    type: 'parking_clears',
    icon: 'parking',
    categoryTag: 'Parking',
    titles: ['Valet Shift', 'Lot Specialist', 'Bay Clear Streak', 'Tight Spot Contract'],
    makeDesc: (t) => `Clear ${t} bays in Precision Parking mode`,
    minTarget: 2,
    maxTarget: 7,
    step: 1,
    baseReward: 950,
    rewardPerStep: 360,
  },
  {
    type: 'zero_hit_parks',
    icon: 'trophy',
    categoryTag: 'Parking',
    titles: ['Spotless Paintwork', 'Untouched Chassis', 'Clean Valet Run', 'No-Scrape Contract'],
    makeDesc: (t) => `Lock ${t} Parking stages with zero cone or bumper hits`,
    minTarget: 1,
    maxTarget: 5,
    step: 1,
    baseReward: 1100,
    rewardPerStep: 520,
  },
  {
    type: 'reverse_parks',
    icon: 'rotate',
    categoryTag: 'Parking',
    titles: ['Backup Camera Pro', 'Dock Reverse Order', 'Rear-In Precision', 'Blindspot Backer'],
    makeDesc: (t) => `Complete ${t} Reverse-gear parking bays`,
    minTarget: 1,
    maxTarget: 4,
    step: 1,
    baseReward: 1050,
    rewardPerStep: 540,
  },
  {
    type: 'parallel_parks',
    icon: 'sliders',
    categoryTag: 'Parking',
    titles: ['Tight Curb Fit', 'Shibuya Slotter', 'Curbside Craft', 'Bumper Clearance'],
    makeDesc: (t) => `Lock ${t} Parallel Curb parking stages`,
    minTarget: 1,
    maxTarget: 3,
    step: 1,
    baseReward: 1150,
    rewardPerStep: 680,
  },
  {
    type: 'slalom_clears',
    icon: 'cone',
    categoryTag: 'Parking',
    titles: ['Cone Chaser', 'Gate Threader', 'Pyon Weaver', 'Slalom Sprint'],
    makeDesc: (t) => `Pass cleanly through ${t} Parking slalom gates`,
    minTarget: 3,
    maxTarget: 10,
    step: 1,
    baseReward: 850,
    rewardPerStep: 210,
  },
  {
    type: 'precision_aligns',
    icon: 'crosshair',
    categoryTag: 'Parking',
    titles: ['Bullseye Stance', 'Laser Centering', 'Dead-Center Park', 'Millimeter Lock'],
    makeDesc: (t) => `Park ${t} time${t > 1 ? 's' : ''} within 0.35m center and 4° yaw`,
    minTarget: 1,
    maxTarget: 3,
    step: 1,
    baseReward: 1200,
    rewardPerStep: 650,
  },
  {
    type: 'gymkhana_parks',
    icon: 'flame',
    categoryTag: 'Parking',
    titles: ['Handbrake Whip Box', 'J-Turn Finale', '180° Pivot Lock', 'Gymkhana Showdown'],
    makeDesc: (t) => `Complete ${t} Gymkhana 180° or Gauntlet parking finale${t > 1 ? 's' : ''}`,
    minTarget: 1,
    maxTarget: 2,
    step: 1,
    baseReward: 1900,
    rewardPerStep: 1200,
  },
];

interface StoredMissionsState {
  date: string;
  missions: Mission[];
}

// In-memory cache for SSR & test environments without browser localStorage
let memoryStorage: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage[key] ?? null;
    }
  }
  return memoryStorage[key] ?? null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStorage[key] = value;
    }
  } else {
    memoryStorage[key] = value;
  }
}

/**
 * Deterministic string hash (FNV-1a 32-bit variant)
 */
export function hashDateString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Returns current UTC date string YYYY-MM-DD
 */
export function getCurrentUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deterministically select 3 distinct challenges from the pool for a given date.
 */
export function generateDailyMissionsForDate(dateStr: string): Mission[] {
  let seed = hashDateString(dateStr);
  const pool = [...MISSION_POOL];
  const selected: MissionTemplate[] = [];

  for (let i = 0; i < 3 && pool.length > 0; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const index = seed % pool.length;
    selected.push(pool[index]);
    pool.splice(index, 1);
  }

  return selected.map((tmpl) => ({
    id: tmpl.id,
    title: tmpl.title,
    description: tmpl.description,
    target: tmpl.target,
    current: 0,
    reward: tmpl.reward,
    completed: false,
    claimed: false,
    type: tmpl.type,
    icon: tmpl.icon,
  }));
}

/**
 * Retrieves the 3 active daily missions for today (or specified date),
 * reading from or persisting to localStorage.
 */
export function getDailyMissions(dateOverride?: string): Mission[] {
  const dateStr = dateOverride || getCurrentUtcDateString();
  const raw = getStorageItem(DAILY_MISSIONS_STORAGE_KEY);

  if (raw) {
    try {
      const parsed: StoredMissionsState = JSON.parse(raw);
      if (
        parsed &&
        parsed.date === dateStr &&
        Array.isArray(parsed.missions) &&
        parsed.missions.length === 3
      ) {
        return parsed.missions;
      }
    } catch {
      // Fall through on JSON parse error
    }
  }

  // Generate fresh missions for this date and store
  const missions = generateDailyMissionsForDate(dateStr);
  const state: StoredMissionsState = {
    date: dateStr,
    missions,
  };
  setStorageItem(DAILY_MISSIONS_STORAGE_KEY, JSON.stringify(state));
  return missions;
}

/**
 * Retrieves persistent Parking & Complex Car Craft mastery missions.
 */
export function getTechnicalMissions(): Mission[] {
  const raw = getStorageItem(TECHNICAL_MISSIONS_STORAGE_KEY);
  let storedMap: Record<string, Mission> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.id === 'string') {
            storedMap[item.id] = item;
          }
        }
      }
    } catch {
      storedMap = {};
    }
  }

  const synced: Mission[] = TECHNICAL_MISSIONS_POOL.map((tmpl) => {
    const prev = storedMap[tmpl.id];
    if (prev && typeof prev.current === 'number') {
      return {
        ...tmpl,
        current: Math.min(tmpl.target, Math.max(0, prev.current)),
        completed: Boolean(prev.completed || prev.current >= tmpl.target),
        claimed: Boolean(prev.claimed),
      };
    }
    return {
      id: tmpl.id,
      title: tmpl.title,
      description: tmpl.description,
      target: tmpl.target,
      current: 0,
      reward: tmpl.reward,
      completed: false,
      claimed: false,
      type: tmpl.type,
      icon: tmpl.icon,
    };
  });

  setStorageItem(TECHNICAL_MISSIONS_STORAGE_KEY, JSON.stringify(synced));
  return synced;
}

let randomMissionNonce = 1;

export function generateRandomMission(
  excludeTypes: Set<MissionType> = new Set(),
  rng: () => number = Math.random
): Mission {
  const candidates = RANDOM_MISSION_BLUEPRINTS.filter((bp) => !excludeTypes.has(bp.type));
  const pool = candidates.length > 0 ? candidates : RANDOM_MISSION_BLUEPRINTS;
  const bp = pool[Math.floor(rng() * pool.length) % pool.length];

  const stepsTotal = Math.max(0, Math.round((bp.maxTarget - bp.minTarget) / bp.step));
  const stepIdx = Math.floor(rng() * (stepsTotal + 1));
  const target = bp.minTarget + stepIdx * bp.step;
  const ratio = stepsTotal > 0 ? stepIdx / stepsTotal : 0.5;
  const tier: 'Standard' | 'Pro' | 'Ace' =
    ratio >= 0.72 ? 'Ace' : ratio >= 0.35 ? 'Pro' : 'Standard';

  const title = bp.titles[Math.floor(rng() * bp.titles.length) % bp.titles.length];
  const rawReward = bp.baseReward + stepIdx * bp.rewardPerStep;
  const reward = Math.round(rawReward / 50) * 50;
  const uid = `rand_${bp.type}_${Date.now().toString(36)}_${randomMissionNonce++}`;

  return {
    id: uid,
    title,
    description: bp.makeDesc(target),
    target,
    current: 0,
    reward,
    completed: false,
    claimed: false,
    type: bp.type,
    icon: bp.icon,
    tier,
    categoryTag: bp.categoryTag,
  };
}

export function generateRandomMissions(
  count = RANDOM_MISSIONS_COUNT,
  rng: () => number = Math.random
): Mission[] {
  const used = new Set<MissionType>();
  const out: Mission[] = [];
  for (let i = 0; i < count; i++) {
    const m = generateRandomMission(used, rng);
    used.add(m.type);
    out.push(m);
  }
  return out;
}

/**
 * Retrieves the active Random Missions / Bounties deck (auto-generated if empty).
 */
export function getRandomMissions(): Mission[] {
  const raw = getStorageItem(RANDOM_MISSIONS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (m) => m && typeof m.id === 'string' && typeof m.target === 'number' && !m.claimed
        );
      }
    } catch {
      // Regenerate below
    }
  }
  const fresh = generateRandomMissions(RANDOM_MISSIONS_COUNT);
  setStorageItem(RANDOM_MISSIONS_STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

/**
 * Rolls fresh Random Missions while keeping already-completed unclaimed bounties safe.
 */
export function rerollRandomMissions(preserveCompleted = true, rng: () => number = Math.random): Mission[] {
  const existing = getRandomMissions();
  const kept = preserveCompleted ? existing.filter((m) => m.completed && !m.claimed) : [];
  const used = new Set<MissionType>(kept.map((m) => m.type));
  const next: Mission[] = [...kept];

  while (next.length < RANDOM_MISSIONS_COUNT) {
    const fresh = generateRandomMission(used, rng);
    used.add(fresh.type);
    next.push(fresh);
  }

  setStorageItem(RANDOM_MISSIONS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

/**
 * Claims a completed Random Mission and immediately deals a brand-new replacement contract!
 */
export function claimRandomMission(
  missionId: string,
  rng: () => number = Math.random
): { success: boolean; reward: number; missions: Mission[] } {
  const list = getRandomMissions();
  const idx = list.findIndex((m) => m.id === missionId);
  if (idx === -1) {
    return { success: false, reward: 0, missions: list };
  }
  const target = list[idx];
  if (!target.completed || target.claimed) {
    return { success: false, reward: 0, missions: list };
  }

  const reward = target.reward;
  const remaining = list.filter((m) => m.id !== missionId);
  const used = new Set<MissionType>(remaining.map((m) => m.type));
  // Avoid dealing the exact same type just claimed when possible
  used.add(target.type);
  const replacement = generateRandomMission(used, rng);
  remaining.splice(idx, 0, replacement);

  setStorageItem(RANDOM_MISSIONS_STORAGE_KEY, JSON.stringify(remaining));
  return { success: true, reward, missions: remaining };
}

function applyEventToMissionList(
  missions: Mission[],
  event: Partial<Record<Mission['type'], number>>
): { changed: boolean; newlyCompleted: Mission[] } {
  const newlyCompleted: Mission[] = [];
  let changed = false;

  for (const mission of missions) {
    const val = event[mission.type];
    if (val === undefined || Number.isNaN(val) || val <= 0) {
      continue;
    }

    const isSingleRunMax =
      mission.type === 'drift_score' ||
      mission.type === 'combo' ||
      mission.type === 'top_speed';

    const prevVal = mission.current;
    if (isSingleRunMax) {
      mission.current = Math.min(mission.target, Math.max(mission.current, Math.round(val)));
    } else {
      mission.current = Math.min(mission.target, mission.current + Math.round(val));
    }

    if (mission.current !== prevVal) {
      changed = true;
    }

    if (!mission.completed && mission.current >= mission.target) {
      mission.completed = true;
      changed = true;
      newlyCompleted.push(mission);
    }
  }

  return { changed, newlyCompleted };
}

/**
 * Feeds progress deltas or run maximums into Daily, Random Bounties, and Technical Car Craft Missions.
 */
export function recordMissionProgress(
  event: Partial<Record<Mission['type'], number>>,
  dateOverride?: string
): { newlyCompleted: Mission[] } {
  const dateStr = dateOverride || getCurrentUtcDateString();
  const missions = getDailyMissions(dateStr);
  const dailyRes = applyEventToMissionList(missions, event);

  if (dailyRes.changed) {
    const state: StoredMissionsState = {
      date: dateStr,
      missions,
    };
    setStorageItem(DAILY_MISSIONS_STORAGE_KEY, JSON.stringify(state));
  }

  const techMissions = getTechnicalMissions();
  const techRes = applyEventToMissionList(techMissions, event);
  if (techRes.changed) {
    setStorageItem(TECHNICAL_MISSIONS_STORAGE_KEY, JSON.stringify(techMissions));
  }

  const randomMissions = getRandomMissions();
  const randomRes = applyEventToMissionList(randomMissions, event);
  if (randomRes.changed) {
    setStorageItem(RANDOM_MISSIONS_STORAGE_KEY, JSON.stringify(randomMissions));
  }

  return {
    newlyCompleted: [
      ...dailyRes.newlyCompleted,
      ...randomRes.newlyCompleted,
      ...techRes.newlyCompleted,
    ],
  };
}

/**
 * Claims the reward for a completed daily mission.
 */
export function claimMission(
  missionId: string,
  dateOverride?: string
): { success: boolean; reward: number } {
  const dateStr = dateOverride || getCurrentUtcDateString();
  const missions = getDailyMissions(dateStr);
  const targetMission = missions.find((m) => m.id === missionId);

  if (!targetMission) {
    return { success: false, reward: 0 };
  }

  if (!targetMission.completed || targetMission.claimed) {
    return { success: false, reward: 0 };
  }

  targetMission.claimed = true;
  const state: StoredMissionsState = {
    date: dateStr,
    missions,
  };
  setStorageItem(DAILY_MISSIONS_STORAGE_KEY, JSON.stringify(state));

  return { success: true, reward: targetMission.reward };
}

/**
 * Claims the reward for a completed Parking & Car Craft mastery mission.
 */
export function claimTechnicalMission(
  missionId: string
): { success: boolean; reward: number } {
  const techMissions = getTechnicalMissions();
  const target = techMissions.find((m) => m.id === missionId);
  if (!target || !target.completed || target.claimed) {
    return { success: false, reward: 0 };
  }
  target.claimed = true;
  setStorageItem(TECHNICAL_MISSIONS_STORAGE_KEY, JSON.stringify(techMissions));
  return { success: true, reward: target.reward };
}

/**
 * Returns true if at least one daily mission is completed and uncollected.
 */
export function hasClaimableMissions(dateOverride?: string): boolean {
  const missions = getDailyMissions(dateOverride);
  return missions.some((m) => m.completed && !m.claimed);
}

/**
 * Returns count of completed but uncollected daily missions.
 */
export function getClaimableMissionsCount(dateOverride?: string): number {
  const missions = getDailyMissions(dateOverride);
  return missions.filter((m) => m.completed && !m.claimed).length;
}

export function hasClaimableTechnicalMissions(): boolean {
  return getTechnicalMissions().some((m) => m.completed && !m.claimed);
}

export function getClaimableTechnicalMissionsCount(): number {
  return getTechnicalMissions().filter((m) => m.completed && !m.claimed).length;
}

export function hasClaimableRandomMissions(): boolean {
  return getRandomMissions().some((m) => m.completed && !m.claimed);
}

export function getClaimableRandomMissionsCount(): number {
  return getRandomMissions().filter((m) => m.completed && !m.claimed).length;
}

export function getTotalClaimableMissionsCount(dateOverride?: string): number {
  return (
    getClaimableMissionsCount(dateOverride) +
    getClaimableRandomMissionsCount() +
    getClaimableTechnicalMissionsCount()
  );
}

/**
 * Formatted countdown until next Midnight UTC reset.
 */
export function getTimeUntilUtcMidnight(): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const now = new Date();
  const nextReset = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0
    )
  );
  const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    hours,
    minutes,
    seconds,
    formatted: `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
  };
}

/**
 * Helper to clear mission state (used in testing and debugging)
 */
export function resetDailyMissionsStorage(): void {
  memoryStorage = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(DAILY_MISSIONS_STORAGE_KEY);
      window.localStorage.removeItem(TECHNICAL_MISSIONS_STORAGE_KEY);
      window.localStorage.removeItem(RANDOM_MISSIONS_STORAGE_KEY);
    } catch {}
  }
}

export function resetTechnicalMissionsStorage(): void {
  delete memoryStorage[TECHNICAL_MISSIONS_STORAGE_KEY];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(TECHNICAL_MISSIONS_STORAGE_KEY);
    } catch {}
  }
}

export function resetRandomMissionsStorage(): void {
  delete memoryStorage[RANDOM_MISSIONS_STORAGE_KEY];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(RANDOM_MISSIONS_STORAGE_KEY);
    } catch {}
  }
}
