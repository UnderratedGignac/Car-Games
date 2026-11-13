import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyMissions, applyRunToMissions, pbBonusCoins, MissionState } from './missions';

const run = { score: 12000, distance: 900, maxCombo: 12, coinsCollected: 40, overtakes: 20, nearMisses: 6 };

test('dailyMissions: 3 deterministic missions per day key', () => {
  const a = dailyMissions('2026-11-13');
  const b = dailyMissions('2026-11-13');
  const c = dailyMissions('2026-11-14');
  assert.equal(a.missions.length, 3);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.missions.map((m) => m.id), c.missions.map((m) => m.id));
  assert.equal(new Set(a.missions.map((m) => m.metric)).size, 3, 'no duplicate metrics');
});

test('applyRunToMissions: cumulative metrics add, best metrics take max', () => {
  const s: MissionState = {
    day: 'x',
    missions: [
      { id: 'a', metric: 'nearMisses', mode: 'sum', target: 10, progress: 5, claimed: false, reward: 100, label: '' },
      { id: 'b', metric: 'maxCombo', mode: 'best', target: 20, progress: 15, claimed: false, reward: 100, label: '' },
    ],
  };
  const { state, earned, completed } = applyRunToMissions(s, run);
  assert.equal(state.missions[0].progress, 10);
  assert.equal(state.missions[0].claimed, true);
  assert.equal(state.missions[1].progress, 15);
  assert.equal(earned, 100);
  assert.deepEqual(completed, ['a']);
});

test('applyRunToMissions does not pay twice', () => {
  const s = dailyMissions('2026-01-01');
  s.missions.forEach((m) => (m.target = 1));
  const first = applyRunToMissions(s, run);
  const second = applyRunToMissions(first.state, run);
  assert.ok(first.earned > 0);
  assert.equal(second.earned, 0);
});

test('pbBonusCoins: +20% of run coins only on a new best', () => {
  assert.equal(pbBonusCoins(1000, 900, 50), 10);
  assert.equal(pbBonusCoins(800, 900, 50), 0);
  assert.equal(pbBonusCoins(1000, 0, 50), 0, 'first ever run is not a PB bonus');
});
