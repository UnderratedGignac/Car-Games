/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_LEVELS,
  evaluateLevelCompletion,
  evaluateLevelStars,
  getLevelById,
  getNextLevel,
  getTotalCampaignStars,
  isLevelUnlocked,
  LevelProgressMap,
} from './levels';
import { generateHighwayTrack, generateSCurveTrack } from './rules';

test('campaign has 10 valid progressive levels spanning drift and highway traffic', () => {
  assert.equal(CAMPAIGN_LEVELS.length, 10);
  const driftCount = CAMPAIGN_LEVELS.filter((l) => l.mode === 'drift').length;
  const hwCount = CAMPAIGN_LEVELS.filter((l) => l.mode === 'highway_traffic').length;
  assert.equal(driftCount, 5);
  assert.equal(hwCount, 5);

  for (let i = 0; i < CAMPAIGN_LEVELS.length; i++) {
    const lvl = CAMPAIGN_LEVELS[i];
    assert.equal(lvl.number, i + 1);
    assert.ok(lvl.targetDistance >= 450);
    assert.ok(lvl.starThresholds[0] < lvl.starThresholds[1]);
    assert.ok(lvl.starThresholds[1] < lvl.starThresholds[2]);
    if (i > 0) {
      assert.ok(lvl.targetDistance > CAMPAIGN_LEVELS[i - 1].targetDistance);
    }
  }
});

test('level lookup and next-level progression resolve cleanly', () => {
  const first = getLevelById('lvl_01');
  assert.ok(first);
  assert.equal(first.number, 1);

  const second = getNextLevel('lvl_01');
  assert.ok(second);
  assert.equal(second.id, 'lvl_02');

  assert.equal(getNextLevel('lvl_10'), null);
  assert.equal(getLevelById('unknown'), null);
});

test('level unlock progression unlocks level N+1 only after level N is completed', () => {
  const empty: LevelProgressMap = {};
  assert.equal(isLevelUnlocked(1, empty), true);
  assert.equal(isLevelUnlocked(2, empty), false);

  const afterLvl1: LevelProgressMap = {
    lvl_01: { completed: true, stars: 2, bestScore: 3400, bestDistance: 460 },
  };
  assert.equal(isLevelUnlocked(2, afterLvl1), true);
  assert.equal(isLevelUnlocked(3, afterLvl1), false);
});

test('star rating and reward calculation work for first clear and replay', () => {
  const lvl1 = CAMPAIGN_LEVELS[0];
  assert.equal(evaluateLevelStars(lvl1, 9000, false), 0);
  assert.equal(evaluateLevelStars(lvl1, 800, true), 1);
  assert.equal(evaluateLevelStars(lvl1, lvl1.starThresholds[1], true), 2);
  assert.equal(evaluateLevelStars(lvl1, lvl1.starThresholds[2] + 500, true), 3);

  const firstClear = evaluateLevelCompletion(lvl1, {
    score: lvl1.starThresholds[2] + 100,
    distance: 460,
    completed: true,
  });
  assert.equal(firstClear.starsEarned, 3);
  assert.equal(firstClear.isFirstClear, true);
  assert.equal(firstClear.bonusCoins, lvl1.rewardCoins + 80);
  assert.equal(firstClear.nextEntry.completed, true);
  assert.equal(firstClear.nextEntry.stars, 3);

  const replay = evaluateLevelCompletion(
    lvl1,
    { score: 1500, distance: 455, completed: true },
    firstClear.nextEntry
  );
  assert.equal(replay.isFirstClear, false);
  assert.equal(replay.nextEntry.stars, 3);
  assert.equal(replay.nextEntry.bestScore, firstClear.nextEntry.bestScore);
});

test('getTotalCampaignStars aggregates completed stages and star counts', () => {
  const summary = getTotalCampaignStars({
    lvl_01: { completed: true, stars: 3, bestScore: 5500, bestDistance: 460 },
    lvl_02: { completed: true, stars: 2, bestScore: 4600, bestDistance: 560 },
    lvl_03: { completed: false, stars: 0, bestScore: 1200, bestDistance: 300 },
  });
  assert.equal(summary.earned, 5);
  assert.equal(summary.total, 30);
  assert.equal(summary.completedCount, 2);
});

test('track generation options modulate width and curvature without breaking defaults', () => {
  const base = generateSCurveTrack(60, 2.6, 101);
  const wideGentle = generateSCurveTrack(60, 2.6, 101, {
    curveMultiplier: 0.75,
    widthMultiplier: 1.15,
  });
  assert.equal(base.length, 60);
  assert.equal(wideGentle.length, 60);
  assert.ok(wideGentle[20].width > base[20].width);
  assert.ok(Math.abs(wideGentle[35].curvature) <= Math.abs(base[35].curvature) + 0.0001);

  const hwBase = generateHighwayTrack(40, 3.4, 202);
  const hwWide = generateHighwayTrack(40, 3.4, 202, {
    curveMultiplier: 0.7,
    widthMultiplier: 1.1,
  });
  assert.ok(hwWide[10].width > hwBase[10].width);
});
