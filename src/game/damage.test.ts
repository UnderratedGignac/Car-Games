import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_PART_IDS,
  applyImpactToCarDamage,
  computeDamagedStats,
  countDamagedParts,
  createMintDamageState,
  getCarOverallIntegrity,
  getDamageVisualCacheKey,
  getFullRepairCost,
  getPartRepairCost,
  isCarTotaled,
  normalizeCarDamageState,
  repairAllParts,
  repairSinglePart,
} from './damage';

test('createMintDamageState initializes all 8 detachable parts at 100% integrity', () => {
  const mint = createMintDamageState();
  assert.equal(CAR_PART_IDS.length, 8);
  assert.equal(getCarOverallIntegrity(mint), 100);
  assert.equal(getDamageVisualCacheKey(mint), 'mint');
  assert.equal(isCarTotaled(mint), false);
  for (const id of CAR_PART_IDS) {
    assert.equal(mint[id].integrity, 100);
    assert.equal(mint[id].bendAngle, 0);
    assert.equal(mint[id].detached, false);
  }
});

test('applyImpactToCarDamage bends parts on moderate impact and detaches them on severe slam', () => {
  const mint = createMintDamageState();

  // Moderate front hit bends front bumper and hood without detaching everything
  const frontTap = applyImpactToCarDamage({
    damage: mint,
    impactZone: 'front',
    severity: 0.65,
    sideBias: 1,
  });
  assert.ok(frontTap.nextDamage.front_bumper.integrity < 65);
  assert.ok(frontTap.nextDamage.hood.integrity < 70);
  assert.ok(Math.abs(frontTap.nextDamage.hood.bendAngle) > 0.2);
  assert.equal(frontTap.nextDamage.rear_bumper.integrity, 100);
  assert.notEqual(getDamageVisualCacheKey(frontTap.nextDamage), 'mint');

  // Heavy ground slam from viaduct crash detaches multiple parts and totals the car
  const slam = applyImpactToCarDamage({
    damage: frontTap.nextDamage,
    impactZone: 'ground_slam',
    severity: 1.35,
    sideBias: -1,
  });
  assert.ok(slam.newlyDetached.includes('front_bumper'));
  assert.ok(slam.newlyDetached.includes('hood'));
  assert.ok(slam.newlyDetached.includes('spoiler'));
  assert.equal(slam.nextDamage.front_bumper.detached, true);
  assert.equal(slam.nextDamage.front_bumper.integrity, 0);
  assert.equal(isCarTotaled(slam.nextDamage), true);
  const counts = countDamagedParts(slam.nextDamage);
  assert.ok(counts.detachedCount >= 3);
});

test('computeDamagedStats reduces speed, grip, and handling proportionally to part damage', () => {
  const baseStats = {
    topSpeed: 24.0,
    driftGrip: 0.85,
    handlingRate: 4.5,
    roadAllowanceBonus: 0.25,
    magnetRadius: 2.8,
    coinMultiplier: 1.0,
    feverGainRate: 1.1,
  };
  assert.deepEqual(computeDamagedStats(baseStats, createMintDamageState()), baseStats);

  const rearSmash = applyImpactToCarDamage({
    damage: createMintDamageState(),
    impactZone: 'ground_slam',
    severity: 1.4,
  }).nextDamage;
  const degraded = computeDamagedStats(baseStats, rearSmash);
  assert.ok(degraded.topSpeed < baseStats.topSpeed);
  assert.ok(degraded.driftGrip < baseStats.driftGrip);
  assert.ok(degraded.handlingRate < baseStats.handlingRate);
});

test('repairSinglePart and repairAllParts restore part integrity, bendAngle, and costs accurately', () => {
  const damaged = applyImpactToCarDamage({
    damage: createMintDamageState(),
    impactZone: 'front',
    severity: 1.35,
  }).nextDamage;

  const frontCost = getPartRepairCost('front_bumper', damaged.front_bumper);
  assert.ok(frontCost >= 20);
  const fullCost = getFullRepairCost(damaged);
  assert.ok(fullCost > 0);

  const partialFix = repairSinglePart(damaged, 'front_bumper');
  assert.equal(partialFix.front_bumper.integrity, 100);
  assert.equal(partialFix.front_bumper.detached, false);
  assert.equal(partialFix.front_bumper.bendAngle, 0);
  assert.ok(getFullRepairCost(partialFix) < fullCost);

  const fullFix = repairAllParts();
  assert.equal(getCarOverallIntegrity(fullFix), 100);
  assert.equal(getFullRepairCost(fullFix), 0);
  assert.equal(isCarTotaled(fullFix), false);

  const normalized = normalizeCarDamageState({
    hood: { integrity: 150, bendAngle: 3, detached: false },
    spoiler: { integrity: 0, bendAngle: 0.5, detached: false },
  });
  assert.equal(normalized.hood.integrity, 100);
  assert.equal(normalized.hood.bendAngle, 1);
  assert.equal(normalized.spoiler.detached, true);
  assert.equal(normalized.spoiler.integrity, 0);
});
