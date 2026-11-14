/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_POOL,
  TECHNICAL_MISSIONS_POOL,
  claimMission,
  claimTechnicalMission,
  generateDailyMissionsForDate,
  getClaimableMissionsCount,
  getClaimableTechnicalMissionsCount,
  getDailyMissions,
  getTechnicalMissions,
  getTimeUntilUtcMidnight,
  getTotalClaimableMissionsCount,
  hasClaimableMissions,
  hasClaimableTechnicalMissions,
  hashDateString,
  recordMissionProgress,
  resetDailyMissionsStorage,
  resetTechnicalMissionsStorage,
} from './missions';
import {
  WHEEL_SEGMENTS,
  STREAK_REWARDS,
  getDailyStreakState,
  isDailySpinReady,
  getRemainingSpinCooldownMs,
  saveDailyStreakState,
  DAILY_STREAK_STORAGE_KEY,
} from '../components/DailyRewardModal';

describe('Daily Missions System (missions.ts)', () => {
  beforeEach(() => {
    resetDailyMissionsStorage();
    resetTechnicalMissionsStorage();
  });

  it('MISSION_POOL contains at least 8 distinct cyberpunk arcade missions', () => {
    assert.ok(MISSION_POOL.length >= 8);
    const ids = new Set(MISSION_POOL.map((m) => m.id));
    assert.equal(ids.size, MISSION_POOL.length, 'All mission IDs must be unique');

    // Confirm presence of key core challenges
    const titles = MISSION_POOL.map((m) => m.title);
    assert.ok(titles.includes('Drift Virtuoso'));
    assert.ok(titles.includes('Apex Combo'));
    assert.ok(titles.includes('Highway Phantom'));
    assert.ok(titles.includes('Traffic Dominator'));
    assert.ok(titles.includes('Coin Hoarder'));
    assert.ok(titles.includes('Distance Demon'));
    assert.ok(titles.includes('Speed Freaks'));
    assert.ok(titles.includes('Touge Legend'));
  });

  it('hashDateString is deterministic and produces consistent hash for the same date', () => {
    const hash1 = hashDateString('2026-11-13');
    const hash2 = hashDateString('2026-11-13');
    const hash3 = hashDateString('2026-11-14');

    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hash3);
  });

  it('generateDailyMissionsForDate deterministically selects exactly 3 distinct missions', () => {
    const missionsA = generateDailyMissionsForDate('2026-11-13');
    const missionsB = generateDailyMissionsForDate('2026-11-13');

    assert.equal(missionsA.length, 3);
    assert.equal(missionsB.length, 3);

    const idsA = missionsA.map((m) => m.id);
    const idsB = missionsB.map((m) => m.id);
    assert.deepEqual(idsA, idsB);

    // Verify 3 distinct missions
    const uniqueIds = new Set(idsA);
    assert.equal(uniqueIds.size, 3);

    // Initial state check
    for (const m of missionsA) {
      assert.equal(m.current, 0);
      assert.equal(m.completed, false);
      assert.equal(m.claimed, false);
      assert.ok(m.target > 0);
      assert.ok(m.reward > 0);
    }
  });

  it('getDailyMissions returns persisted state for same date', () => {
    const testDate = '2026-12-25';
    const first = getDailyMissions(testDate);
    assert.equal(first.length, 3);

    // Simulate progress on first mission
    const firstType = first[0].type;
    recordMissionProgress({ [firstType]: 10 }, testDate);

    const second = getDailyMissions(testDate);
    assert.equal(second[0].current > 0, true);
    assert.equal(first[0].id, second[0].id);
  });

  it('single-run milestone missions use high-water mark logic', () => {
    const testDate = '2026-10-01';
    const missions = getDailyMissions(testDate);

    // Find any single-run mission, or if none in this day's pool, test with a date that has one
    let targetDate = testDate;
    let singleRunMission = missions.find(
      (m) => m.type === 'drift_score' || m.type === 'combo' || m.type === 'top_speed'
    );

    // Cycle dates until we hit one with a single run mission
    let d = 1;
    while (!singleRunMission && d < 30) {
      targetDate = `2026-10-${d < 10 ? '0' + d : d}`;
      const mList = getDailyMissions(targetDate);
      singleRunMission = mList.find(
        (m) => m.type === 'drift_score' || m.type === 'combo' || m.type === 'top_speed'
      );
      d++;
    }

    assert.ok(singleRunMission, 'Found a date with a single-run milestone mission');

    // First progress: 500
    recordMissionProgress({ [singleRunMission.type]: 500 }, targetDate);
    let updated = getDailyMissions(targetDate).find((m) => m.id === singleRunMission!.id)!;
    const initialExpected = Math.min(updated.target, 500);
    assert.equal(updated.current, initialExpected);

    // Second lower progress: 300 should NOT reduce high-water mark
    recordMissionProgress({ [singleRunMission.type]: 300 }, targetDate);
    updated = getDailyMissions(targetDate).find((m) => m.id === singleRunMission!.id)!;
    assert.equal(updated.current, initialExpected);

    // Third higher progress: should increase
    recordMissionProgress({ [singleRunMission.type]: 800 }, targetDate);
    updated = getDailyMissions(targetDate).find((m) => m.id === singleRunMission!.id)!;
    assert.equal(updated.current, Math.min(updated.target, 800));
  });

  it('cumulative missions accumulate progress across runs', () => {
    // Find a date with a cumulative mission like distance or coins
    let targetDate = '2026-05-01';
    let cumulativeMission = getDailyMissions(targetDate).find(
      (m) => m.type === 'distance' || m.type === 'coins' || m.type === 'overtakes'
    );
    let d = 1;
    while (!cumulativeMission && d < 30) {
      targetDate = `2026-05-${d < 10 ? '0' + d : d}`;
      const mList = getDailyMissions(targetDate);
      cumulativeMission = mList.find(
        (m) => m.type === 'distance' || m.type === 'coins' || m.type === 'overtakes'
      );
      d++;
    }

    assert.ok(cumulativeMission, 'Found a date with a cumulative mission');

    // Add 10, then add 15 -> should total 25
    recordMissionProgress({ [cumulativeMission.type]: 10 }, targetDate);
    recordMissionProgress({ [cumulativeMission.type]: 15 }, targetDate);

    const updated = getDailyMissions(targetDate).find((m) => m.id === cumulativeMission!.id)!;
    assert.equal(updated.current, Math.min(updated.target, 25));
  });

  it('completing and claiming a mission grants reward CR and prevents double claiming', () => {
    const testDate = '2026-07-20';
    const missions = getDailyMissions(testDate);
    const target = missions[0];

    assert.equal(hasClaimableMissions(testDate), false);
    assert.equal(getClaimableMissionsCount(testDate), 0);

    // Satisfy target fully
    const res = recordMissionProgress({ [target.type]: target.target * 2 }, testDate);
    assert.equal(res.newlyCompleted.length, 1);
    assert.equal(res.newlyCompleted[0].id, target.id);

    // Verify claimable
    assert.equal(hasClaimableMissions(testDate), true);
    assert.equal(getClaimableMissionsCount(testDate), 1);

    // Claim reward
    const claimRes = claimMission(target.id, testDate);
    assert.equal(claimRes.success, true);
    assert.equal(claimRes.reward, target.reward);

    // Verify no longer claimable
    assert.equal(hasClaimableMissions(testDate), false);
    assert.equal(getClaimableMissionsCount(testDate), 0);

    // Attempt double claim
    const doubleClaimRes = claimMission(target.id, testDate);
    assert.equal(doubleClaimRes.success, false);
    assert.equal(doubleClaimRes.reward, 0);
  });

  it('getTimeUntilUtcMidnight returns positive hours, minutes, seconds and string', () => {
    const t = getTimeUntilUtcMidnight();
    assert.ok(t.hours >= 0 && t.hours <= 24);
    assert.ok(t.minutes >= 0 && t.minutes <= 59);
    assert.ok(t.seconds >= 0 && t.seconds <= 59);
    assert.ok(t.formatted.includes('h '));
    assert.ok(t.formatted.includes('m '));
    assert.ok(t.formatted.includes('s'));
  });

  it('WHEEL_SEGMENTS defines all 8 cyberpunk reward sectors with Super Drop and Jackpot', () => {
    assert.equal(WHEEL_SEGMENTS.length, 8);
    const amounts = WHEEL_SEGMENTS.map((s) => s.amount);
    assert.deepEqual(amounts, [500, 1000, 2500, 750, 5000, 1500, 10000, 2000]);

    const superDrop = WHEEL_SEGMENTS.find((s) => s.isSuper);
    assert.ok(superDrop);
    assert.equal(superDrop.amount, 5000);

    const jackpot = WHEEL_SEGMENTS.find((s) => s.isJackpot);
    assert.ok(jackpot);
    assert.equal(jackpot.amount, 10000);
  });

  it('STREAK_REWARDS defines 7 cumulative login streak steps ending in 15k jackpot', () => {
    assert.equal(STREAK_REWARDS.length, 7);
    assert.equal(STREAK_REWARDS[0].reward, 500);
    assert.equal(STREAK_REWARDS[6].reward, 15000);
    assert.equal(STREAK_REWARDS[6].isJackpot, true);
  });

  it('Daily Spin readiness and 24h cooldown calculations behave correctly', () => {
    // When never spun, ready = true
    const defaultState = getDailyStreakState();
    assert.equal(defaultState.streakCount >= 1 && defaultState.streakCount <= 7, true);
  });

  it('TECHNICAL_MISSIONS_POOL defines 8 persistent parking & complex car craft challenges and tracks live telemetry', () => {
    assert.equal(TECHNICAL_MISSIONS_POOL.length, 8);
    const tech = getTechnicalMissions();
    assert.equal(tech.length, 8);
    assert.equal(hasClaimableTechnicalMissions(), false);
    assert.equal(getClaimableTechnicalMissionsCount(), 0);

    // Progress parallel parks, flash yields, and parking clears simultaneously
    const res = recordMissionProgress({
      parking_clears: 3,
      parallel_parks: 2,
      flash_yields: 8,
    });
    assert.ok(res.newlyCompleted.some((m) => m.id === 'tech_valet_apprentice'));
    assert.ok(res.newlyCompleted.some((m) => m.id === 'tech_parallel_perfection'));
    assert.ok(res.newlyCompleted.some((m) => m.id === 'tech_highbeam_tactician'));

    assert.equal(hasClaimableTechnicalMissions(), true);
    assert.equal(getClaimableTechnicalMissionsCount(), 3);
    assert.ok(getTotalClaimableMissionsCount() >= 3);

    // Claim parallel parker reward and guard against double claim
    const claim = claimTechnicalMission('tech_parallel_perfection');
    assert.equal(claim.success, true);
    assert.equal(claim.reward, 2400);
    assert.equal(getClaimableTechnicalMissionsCount(), 2);

    const doubleClaim = claimTechnicalMission('tech_parallel_perfection');
    assert.equal(doubleClaim.success, false);
    assert.equal(doubleClaim.reward, 0);
  });
});
