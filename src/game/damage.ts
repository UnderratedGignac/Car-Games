/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { computeEffectiveCarStats } from './rules';

export type EffectiveCarStats = ReturnType<typeof computeEffectiveCarStats>;

export type CarPartId =
  | 'front_bumper'
  | 'hood'
  | 'windshield'
  | 'roof'
  | 'left_door'
  | 'right_door'
  | 'rear_bumper'
  | 'spoiler';

export type ImpactZone =
  | 'front'
  | 'rear'
  | 'left'
  | 'right'
  | 'rollover'
  | 'ground_slam';

export interface CarPartDamageState {
  /** 100 = factory mint, 40..89 = scratched/bent, 1..39 = severely crumpled/dangling, 0 = detached */
  integrity: number;
  /** Signed bend/warp intensity (-1..+1) controlling crooked angles and buckled creases */
  bendAngle: number;
  /** True once part physically rips off the vehicle */
  detached: boolean;
}

export type CarDamageState = Record<CarPartId, CarPartDamageState>;
export type CarDamageMap = Record<string, CarDamageState>;

export interface CarPartMeta {
  id: CarPartId;
  label: string;
  shortLabel: string;
  baseRepairCost: number;
  inspectTarget: 'hood' | 'wheels' | 'aero' | 'exhaust' | 'all';
}

export const CAR_PARTS_META: CarPartMeta[] = [
  { id: 'front_bumper', label: 'Front Bumper & Splitter', shortLabel: 'F. Bumper', baseRepairCost: 24, inspectTarget: 'hood' },
  { id: 'hood', label: 'Hood / Bonnet', shortLabel: 'Hood', baseRepairCost: 28, inspectTarget: 'hood' },
  { id: 'windshield', label: 'Windshield & A-Pillars', shortLabel: 'Windshield', baseRepairCost: 26, inspectTarget: 'all' },
  { id: 'roof', label: 'Roof & Cabin Frame', shortLabel: 'Roof', baseRepairCost: 30, inspectTarget: 'all' },
  { id: 'left_door', label: 'Left Door & Mirror', shortLabel: 'L. Door', baseRepairCost: 22, inspectTarget: 'wheels' },
  { id: 'right_door', label: 'Right Door & Mirror', shortLabel: 'R. Door', baseRepairCost: 22, inspectTarget: 'wheels' },
  { id: 'rear_bumper', label: 'Rear Bumper & Diffuser', shortLabel: 'R. Bumper', baseRepairCost: 24, inspectTarget: 'exhaust' },
  { id: 'spoiler', label: 'Rear Wing / Decklid', shortLabel: 'Rear Wing', baseRepairCost: 26, inspectTarget: 'aero' },
];

export const CAR_PART_IDS: CarPartId[] = CAR_PARTS_META.map((p) => p.id);

export const DAMAGE_STORAGE_KEY = 'apex_slash_damage_v1';

export function createMintDamageState(): CarDamageState {
  return {
    front_bumper: { integrity: 100, bendAngle: 0, detached: false },
    hood: { integrity: 100, bendAngle: 0, detached: false },
    windshield: { integrity: 100, bendAngle: 0, detached: false },
    roof: { integrity: 100, bendAngle: 0, detached: false },
    left_door: { integrity: 100, bendAngle: 0, detached: false },
    right_door: { integrity: 100, bendAngle: 0, detached: false },
    rear_bumper: { integrity: 100, bendAngle: 0, detached: false },
    spoiler: { integrity: 100, bendAngle: 0, detached: false },
  };
}

export function normalizeCarDamageState(raw?: Partial<CarDamageState> | null): CarDamageState {
  const mint = createMintDamageState();
  if (!raw) return mint;
  for (const id of CAR_PART_IDS) {
    const p = raw[id];
    if (p) {
      const integrity = Math.max(0, Math.min(100, Math.round(Number(p.integrity ?? 100))));
      const detached = Boolean(p.detached) || integrity <= 0;
      const bendAngle = detached
        ? 0
        : Math.max(-1, Math.min(1, Number(p.bendAngle ?? 0) || 0));
      mint[id] = {
        integrity: detached ? 0 : integrity,
        bendAngle,
        detached,
      };
    }
  }
  return mint;
}

export function loadSavedDamageMap(): CarDamageMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(DAMAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<CarDamageState>>;
    const out: CarDamageMap = {};
    for (const [carId, st] of Object.entries(parsed)) {
      out[carId] = normalizeCarDamageState(st);
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDamageMap(map: CarDamageMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DAMAGE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota failures cleanly
  }
}

/**
 * Computes average chassis integrity percentage (0..100).
 */
export function getCarOverallIntegrity(damage?: CarDamageState | null): number {
  if (!damage) return 100;
  let sum = 0;
  for (const id of CAR_PART_IDS) {
    sum += Math.max(0, Math.min(100, damage[id]?.integrity ?? 100));
  }
  return Math.round(sum / CAR_PART_IDS.length);
}

/**
 * Counts how many parts are currently bent or detached.
 */
export function countDamagedParts(damage?: CarDamageState | null): {
  bentCount: number;
  detachedCount: number;
  totalDamaged: number;
} {
  if (!damage) return { bentCount: 0, detachedCount: 0, totalDamaged: 0 };
  let bentCount = 0;
  let detachedCount = 0;
  for (const id of CAR_PART_IDS) {
    const p = damage[id];
    if (!p) continue;
    if (p.detached || p.integrity <= 0) {
      detachedCount++;
    } else if (p.integrity < 90) {
      bentCount++;
    }
  }
  return {
    bentCount,
    detachedCount,
    totalDamaged: bentCount + detachedCount,
  };
}

/**
 * Returns true if the vehicle is severely damaged and MUST be repaired before racing again.
 */
export function isCarTotaled(damage?: CarDamageState | null): boolean {
  if (!damage) return false;
  const overall = getCarOverallIntegrity(damage);
  const { detachedCount } = countDamagedParts(damage);
  return overall < 55 || detachedCount >= 3;
}

/**
 * Compact cache key capturing visual damage state per part:
 * 'mint' when undamaged; otherwise 8 chars: '0' (mint), '1' (scratched/slightly bent),
 * '2' (heavily crumpled), 'X' (detached).
 */
export function getDamageVisualCacheKey(damage?: CarDamageState | null): string {
  if (!damage) return 'mint';
  let anyDamaged = false;
  let chars = '';
  for (const id of CAR_PART_IDS) {
    const p = damage[id];
    if (!p || (p.integrity >= 90 && !p.detached)) {
      chars += '0';
    } else if (p.detached || p.integrity <= 0) {
      anyDamaged = true;
      chars += 'X';
    } else if (p.integrity < 55) {
      anyDamaged = true;
      chars += p.bendAngle < 0 ? '2' : '3';
    } else {
      anyDamaged = true;
      chars += p.bendAngle < 0 ? '1' : '4';
    }
  }
  return anyDamaged ? chars : 'mint';
}

const IMPACT_WEIGHTS: Record<ImpactZone, Partial<Record<CarPartId, number>>> = {
  front: {
    front_bumper: 1.0,
    hood: 0.85,
    windshield: 0.55,
    left_door: 0.25,
    right_door: 0.25,
    roof: 0.15,
  },
  rear: {
    rear_bumper: 1.0,
    spoiler: 0.92,
    left_door: 0.2,
    right_door: 0.2,
    roof: 0.15,
  },
  left: {
    left_door: 1.0,
    front_bumper: 0.52,
    rear_bumper: 0.48,
    windshield: 0.35,
    roof: 0.30,
    hood: 0.25,
  },
  right: {
    right_door: 1.0,
    front_bumper: 0.52,
    rear_bumper: 0.48,
    windshield: 0.35,
    roof: 0.30,
    hood: 0.25,
  },
  rollover: {
    roof: 1.0,
    windshield: 0.88,
    spoiler: 0.82,
    hood: 0.65,
    left_door: 0.65,
    right_door: 0.65,
    front_bumper: 0.55,
    rear_bumper: 0.55,
  },
  ground_slam: {
    front_bumper: 1.0,
    rear_bumper: 0.94,
    hood: 0.92,
    spoiler: 0.95,
    roof: 0.80,
    windshield: 0.85,
    left_door: 0.72,
    right_door: 0.72,
  },
};

export interface ApplyImpactParams {
  damage: CarDamageState;
  impactZone: ImpactZone;
  /** 0.1 (light scrape) .. 1.0 (major collision) .. 1.4 (hard valley slam) */
  severity: number;
  /** Optional directional bias (-1..1) so impacts bend symmetrically or toward hit side */
  sideBias?: number;
}

export interface ApplyImpactResult {
  nextDamage: CarDamageState;
  newlyDetached: CarPartId[];
  newlyBent: CarPartId[];
}

export function applyImpactToCarDamage({
  damage,
  impactZone,
  severity,
  sideBias = 1,
}: ApplyImpactParams): ApplyImpactResult {
  const weights = IMPACT_WEIGHTS[impactZone];
  const clampedSev = Math.max(0.05, Math.min(1.5, severity));
  const sign = sideBias < 0 ? -1 : 1;
  const next = normalizeCarDamageState(damage);
  const newlyDetached: CarPartId[] = [];
  const newlyBent: CarPartId[] = [];

  for (let i = 0; i < CAR_PART_IDS.length; i++) {
    const id = CAR_PART_IDS[i];
    const w = weights[id] ?? 0;
    if (w <= 0) continue;

    const prev = next[id];
    if (prev.detached || prev.integrity <= 0) continue;

    const wasIntact = prev.integrity >= 90;
    const rawLoss = clampedSev * w * 78;
    const nextIntegrity = Math.max(0, Math.round(prev.integrity - rawLoss));

    if (nextIntegrity <= 0) {
      next[id] = {
        integrity: 0,
        bendAngle: 0,
        detached: true,
      };
      newlyDetached.push(id);
    } else {
      const damageRatio = (100 - nextIntegrity) / 100;
      const partSign = i % 2 === 0 ? sign : -sign;
      const nextBend = Math.max(
        -1,
        Math.min(1, partSign * (0.28 + damageRatio * 0.72))
      );
      next[id] = {
        integrity: nextIntegrity,
        bendAngle: Number(nextBend.toFixed(2)),
        detached: false,
      };
      if (wasIntact && nextIntegrity < 90) {
        newlyBent.push(id);
      }
    }
  }

  return {
    nextDamage: next,
    newlyDetached,
    newlyBent,
  };
}

/**
 * Applies physical driving penalties when driving with bent or missing car parts.
 */
export function computeDamagedStats(
  stats: EffectiveCarStats,
  damage?: CarDamageState | null
): EffectiveCarStats {
  if (!damage) return stats;
  const overall = getCarOverallIntegrity(damage);
  if (overall >= 98) return stats;

  const spoilerLoss = damage.spoiler.detached ? 0.11 : ((100 - damage.spoiler.integrity) / 100) * 0.07;
  const hoodLoss = damage.hood.detached ? 0.06 : ((100 - damage.hood.integrity) / 100) * 0.05;
  const bumperLoss =
    (damage.front_bumper.detached ? 0.04 : ((100 - damage.front_bumper.integrity) / 100) * 0.03) +
    (damage.rear_bumper.detached ? 0.03 : 0);

  const speedMult = Math.max(0.76, 1 - hoodLoss - bumperLoss);
  const gripMult = Math.max(0.78, 1 - spoilerLoss - (100 - overall) * 0.0012);
  const handlingMult = Math.max(0.80, 1 - (100 - overall) * 0.0018);

  return {
    ...stats,
    topSpeed: Number((stats.topSpeed * speedMult).toFixed(2)),
    driftGrip: Number((stats.driftGrip * gripMult).toFixed(3)),
    handlingRate: Number((stats.handlingRate * handlingMult).toFixed(2)),
  };
}

export function getPartRepairCost(partId: CarPartId, partState: CarPartDamageState): number {
  if (!partState.detached && partState.integrity >= 100) return 0;
  const meta = CAR_PARTS_META.find((m) => m.id === partId);
  const base = meta ? meta.baseRepairCost : 24;
  if (partState.detached || partState.integrity <= 0) return base;
  const missingFraction = (100 - Math.max(0, Math.min(100, partState.integrity))) / 100;
  return Math.max(8, Math.round(base * (0.25 + missingFraction * 0.65)));
}

export function getFullRepairCost(damage?: CarDamageState | null): number {
  if (!damage) return 0;
  let sum = 0;
  for (const id of CAR_PART_IDS) {
    sum += getPartRepairCost(id, damage[id]);
  }
  if (sum <= 0) return 0;
  // Bundle discount when fixing the whole chassis at once
  return Math.max(10, Math.round(sum * 0.8));
}

export function repairSinglePart(damage: CarDamageState, partId: CarPartId): CarDamageState {
  const next = normalizeCarDamageState(damage);
  next[partId] = { integrity: 100, bendAngle: 0, detached: false };
  return next;
}

export function repairAllParts(): CarDamageState {
  return createMintDamageState();
}
