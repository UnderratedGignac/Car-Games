import test from 'node:test';
import assert from 'node:assert/strict';
import type { TrafficCarState } from './rules';
import {
  computeObbOverlap2D,
  createCrashBody3D,
  evaluateGuardrailImpact,
  getTrafficVehicleMass,
  resolveHighwayTrafficSolidPass,
  resolveSolidGuardrailContact,
  resolveTrafficCollisionImpulse,
  resolveTrafficInterCarSpacing,
  stepCrashBody3D,
  stepTrafficCrashBody,
} from './crashPhysics';
import { computeAutomotiveNormalShade, computeFrontWheelSteerRad } from './pixelSprites';

function makeTrafficCar(overrides?: Partial<TrafficCarState>): TrafficCarState {
  return {
    id: 1,
    s: 120,
    lane: 1,
    lateralOffset: 2.25,
    speed: 11,
    isOncoming: false,
    kind: 'sedan',
    color: '#2563eb',
    accentColor: '#cbd5e1',
    overtaken: false,
    nearMissed: false,
    halfWidth: 0.94,
    halfLength: 1.95,
    ...overrides,
  };
}

test('resolveTrafficCollisionImpulse transfers momentum proportionally by vehicle mass and hit angle', () => {
  const sedan = makeTrafficCar({ kind: 'sedan', speed: 10, lateralOffset: 2.25 });
  const truck = makeTrafficCar({ kind: 'box_truck', speed: 10, lateralOffset: 2.25 });

  const hitSedan = resolveTrafficCollisionImpulse({
    playerSpeedForward: 28,
    playerLateralVel: 1.5,
    playerLateralOffset: 2.05,
    car: sedan,
  });
  const hitTruck = resolveTrafficCollisionImpulse({
    playerSpeedForward: 28,
    playerLateralVel: 1.5,
    playerLateralOffset: 2.05,
    car: truck,
  });

  assert.equal(hitSedan.isFatalCrash, true);
  assert.ok(hitSedan.trafficCrashSpeedS > sedan.speed, 'Fast player launches sedan forward');
  assert.ok(hitSedan.playerBounceVz < 28, 'Player slows down after impulse transfer');
  assert.ok(
    hitTruck.playerBounceVz < hitSedan.playerBounceVz,
    'Heavy box_truck takes away much more player forward momentum than a sedan'
  );
  assert.ok(
    hitTruck.impactSeverity > hitSedan.impactSeverity,
    'Heavy box_truck produces higher structural impact severity'
  );
  assert.ok(getTrafficVehicleMass('box_truck') > getTrafficVehicleMass('hatch'));
});

test('resolveTrafficCollisionImpulse treats light oblique same-lane nudges as glancing sideswipes', () => {
  const sedan = makeTrafficCar({ kind: 'sedan', speed: 14, lateralOffset: 2.25, isOncoming: false });
  const scrape = resolveTrafficCollisionImpulse({
    playerSpeedForward: 21,
    playerLateralVel: -2.0,
    playerLateralOffset: 1.15,
    car: sedan,
  });

  assert.equal(scrape.isFatalCrash, false);
  assert.ok(scrape.impactSeverity < 0.5);
  assert.ok(scrape.playerBounceVx < 0, 'Pushes player outward from traffic flank');
  assert.ok(scrape.trafficCrashVelLat > 0, 'Shoves traffic car in opposite lateral direction');
});

test('stepCrashBody3D simulates gravity fall, bounce restitution, slope kick, and skid settle', () => {
  const body = createCrashBody3D({
    x: 10,
    y: 8.0,
    z: -40,
    vx: 6.0,
    vy: 2.5,
    vz: -18.0,
    yawVel: 4.5,
    rollVel: 2.0,
  });

  let sawImpact = false;
  let bouncedUp = false;
  for (let i = 0; i < 120; i++) {
    const out = stepCrashBody3D(body, -10.0, -0.35, 1 / 60);
    if (out.impactedGround) {
      sawImpact = true;
      assert.ok(out.impactSpeed > 8, 'Should record high downward impact speed');
      if (body.vy > 1.5) bouncedUp = true;
    }
  }

  assert.equal(sawImpact, true);
  assert.equal(bouncedUp, true);
  assert.ok(body.bounceCount >= 1);
  assert.ok(Math.abs(body.vz) < 12, 'Ground skid drag slows wreckage down over time');
});

test('stepTrafficCrashBody rebounds knocked traffic cars off highway guardrails', () => {
  const car = makeTrafficCar({
    crashed: true,
    lateralOffset: 3.7,
    crashVs: 18,
    crashVelLat: 9.5,
    crashVy: 4.2,
    crashY: 0,
    crashYaw: 0,
    crashYawVel: 5.0,
    crashRoll: 0,
    crashRollVel: 1.8,
  });

  let hitRail = false;
  for (let i = 0; i < 40; i++) {
    const res = stepTrafficCrashBody(car, 4.9, 1 / 60);
    if (res.hitRail) hitRail = true;
  }

  assert.equal(hitRail, true, 'Spinning traffic car should rebound off the highway guardrail');
  assert.ok((car.crashVelLat ?? 0) < 0, 'Lateral velocity flips inward after rail rebound');
  assert.ok(Math.abs(car.crashYaw ?? 0) > 0.2, 'Traffic car spins in yaw during crash');
});

test('computeFrontWheelSteerRad maps steering input cleanly for mirrored and un-mirrored sprites', () => {
  const rightUnmirrored = computeFrontWheelSteerRad({
    frontSteerNorm: 1,
    driftAbsNorm: 0,
    isCustomYaw: false,
    shouldMirror: false,
  });
  const leftUnmirrored = computeFrontWheelSteerRad({
    frontSteerNorm: -1,
    driftAbsNorm: 0,
    isCustomYaw: false,
    shouldMirror: false,
  });
  assert.ok(rightUnmirrored < -0.4, 'Right turn produces negative car-local steerRad when un-mirrored');
  assert.ok(leftUnmirrored > 0.4, 'Left turn produces positive car-local steerRad when un-mirrored');
  assert.equal(rightUnmirrored, -leftUnmirrored);

  const rightMirrored = computeFrontWheelSteerRad({
    frontSteerNorm: 1,
    driftAbsNorm: 0.4,
    isCustomYaw: false,
    shouldMirror: true,
  });
  const leftMirrored = computeFrontWheelSteerRad({
    frontSteerNorm: -1,
    driftAbsNorm: 0.4,
    isCustomYaw: false,
    shouldMirror: true,
  });
  assert.ok(rightMirrored > 0.4, 'Mirrored sprite flips local steerRad sign so visual turn stays right');
  assert.ok(leftMirrored < -0.4, 'Mirrored sprite flips local steerRad sign so visual turn stays left');

  const customYawRight = computeFrontWheelSteerRad({
    frontSteerNorm: 0.8,
    driftAbsNorm: 0.5,
    isCustomYaw: true,
    shouldMirror: false,
  });
  const customYawLeft = computeFrontWheelSteerRad({
    frontSteerNorm: -0.8,
    driftAbsNorm: 0.5,
    isCustomYaw: true,
    shouldMirror: false,
  });
  const customYawCenter = computeFrontWheelSteerRad({
    frontSteerNorm: 0,
    driftAbsNorm: 0.5,
    isCustomYaw: true,
    shouldMirror: false,
  });
  assert.equal(customYawRight, -customYawLeft);
  assert.equal(customYawCenter, 0);
});

test('evaluateGuardrailImpact bounces low-speed or shallow grazes and breaches only on fast direct hits', () => {
  const slowDirect = evaluateGuardrailImpact({
    playerSpeed: 14.0,
    outwardLateralSpeed: 8.0,
    overallIntegrity: 100,
  });
  assert.equal(slowDirect.shouldBreach, false);
  assert.ok(slowDirect.inwardBounceLatVel > 3.5);

  const fastShallow = evaluateGuardrailImpact({
    playerSpeed: 28.0,
    outwardLateralSpeed: 3.2,
    overallIntegrity: 100,
  });
  assert.equal(fastShallow.shouldBreach, false);

  const fastDirect = evaluateGuardrailImpact({
    playerSpeed: 26.5,
    outwardLateralSpeed: 7.5,
    overallIntegrity: 100,
  });
  assert.equal(fastDirect.shouldBreach, true);
});

test('resolveTrafficCollisionImpulse requires high closing speed AND solid overlap for fatal crashes', () => {
  // 1. Slow rear-end tap (even dead-center) is non-fatal
  const slowSameLane = makeTrafficCar({ kind: 'sedan', speed: 12, lateralOffset: 2.25, isOncoming: false });
  const slowTap = resolveTrafficCollisionImpulse({
    playerSpeedForward: 18.0,
    playerLateralVel: 0.2,
    playerLateralOffset: 2.25,
    car: slowSameLane,
  });
  assert.equal(slowTap.isFatalCrash, false);
  assert.ok(slowTap.impactSeverity <= 0.16);

  // 2. High-speed rear-end with small closing speed delta (< 14.5 m/s) is non-fatal
  const fastTraffic = makeTrafficCar({ kind: 'sedan', speed: 15, lateralOffset: 2.25, isOncoming: false });
  const lowDeltaHit = resolveTrafficCollisionImpulse({
    playerSpeedForward: 24.0,
    playerLateralVel: 0,
    playerLateralOffset: 2.25,
    car: fastTraffic,
  });
  assert.equal(lowDeltaHit.isFatalCrash, false);
  assert.ok(lowDeltaHit.impactSeverity <= 0.38);

  // 3. Oncoming corner clip (low overlapFraction < 0.45) is non-fatal
  const oncomingCar = makeTrafficCar({ kind: 'sedan', speed: 12, lateralOffset: -2.25, isOncoming: true });
  const oncomingCornerClip = resolveTrafficCollisionImpulse({
    playerSpeedForward: 22.0,
    playerLateralVel: 1.5,
    playerLateralOffset: -1.1, // absDLat = 1.15 -> overlapFraction = 1 - 1.15/1.84 = 0.375 < 0.45
    car: oncomingCar,
  });
  assert.equal(oncomingCornerClip.isFatalCrash, false);
  assert.ok(oncomingCornerClip.hitQuality < 0.45);

  // 4. Center oncoming collision at speed IS fatal
  const oncomingDirect = resolveTrafficCollisionImpulse({
    playerSpeedForward: 22.0,
    playerLateralVel: 0,
    playerLateralOffset: -2.2,
    car: oncomingCar,
  });
  assert.equal(oncomingDirect.isFatalCrash, true);
  assert.ok(oncomingDirect.hitQuality >= 0.9);
});

test('computeObbOverlap2D resolves oriented rectangular overlap and rejects separated boxes', () => {
  const a = { x: 0, z: 0, halfLength: 2.0, halfWidth: 0.9, heading: 0 };
  const b = { x: 1.4, z: 0.5, halfLength: 2.0, halfWidth: 0.9, heading: Math.PI / 6 };
  const c = { x: 6.0, z: 6.0, halfLength: 2.0, halfWidth: 0.9, heading: 0 };

  const contact = computeObbOverlap2D(a, b);
  assert.ok(contact.hit, 'Rotated nearby OBBs must overlap');
  assert.ok(contact.overlap > 0.1);
  assert.ok(Math.abs(Math.hypot(contact.normalX, contact.normalZ) - 1) < 1e-4);

  const noContact = computeObbOverlap2D(a, c);
  assert.equal(noContact.hit, false);
});

test('resolveSolidGuardrailContact strictly clamps car inside rails and deflects outward velocity', () => {
  const res = resolveSolidGuardrailContact({
    vx: 9.2,
    vz: -28,
    heading: -Math.PI / 2 + 0.45,
    tx: 0,
    tz: -1,
    nx: 1,
    nz: 0,
    roadHeading: -Math.PI / 2,
    signedPerpOffset: 5.4,
    maxCenterLat: 4.05,
  });
  assert.equal(res.hit, true);
  assert.equal(res.railSide, 1);
  assert.equal(res.clampedLat, 4.05);
  assert.ok(res.nextVx < 0, 'Outward velocity must rebound inward');
  assert.ok(-res.nextVz > 0 && -res.nextVz < 28, 'Barrier friction scrubs forward speed');
  assert.ok(res.outwardSpeed > 8);
});

test('resolveHighwayTrafficSolidPass prevents ghosting through traffic even during cooldown or crash states', () => {
  const cooledCar = makeTrafficCar({
    id: 11,
    s: 100,
    lateralOffset: 2.1,
    speed: 14,
    scrapeCooldown: 0.45,
  });
  const crashedCar = makeTrafficCar({
    id: 12,
    s: 120,
    lateralOffset: -2.0,
    speed: 10,
    crashed: true,
    crashYaw: 0.6,
  });

  // Hero overlapping cooledCar
  const res1 = resolveHighwayTrafficSolidPass({
    playerS: 98.2,
    playerLat: 2.05,
    playerHeadingRelRoad: 0,
    playerFwdVel: 24,
    playerLatVel: 0,
    playerMass: 1.35,
    roadHalfWidth: 4.9,
    trafficCars: [cooledCar, crashedCar],
  });
  assert.equal(res1.primaryCar?.id, 11);
  assert.ok(
    Math.hypot(res1.nextPlayerS - cooledCar.s, res1.nextPlayerLat - cooledCar.lateralOffset) > 1.75,
    'Overlapping cooled car must be separated solidly'
  );
  assert.ok(Math.abs(res1.nextPlayerLat) <= 4.04);

  // Hero overlapping already-crashed car
  const res2 = resolveHighwayTrafficSolidPass({
    playerS: 119.5,
    playerLat: -1.6,
    playerHeadingRelRoad: 0,
    playerFwdVel: 22,
    playerLatVel: -1.0,
    playerMass: 1.35,
    roadHalfWidth: 4.9,
    trafficCars: [cooledCar, crashedCar],
  });
  assert.equal(res2.primaryCar?.id, 12);
});

test('resolveTrafficInterCarSpacing keeps nearby traffic vehicles separated', () => {
  const front = makeTrafficCar({ id: 1, s: 200, lateralOffset: 2.25, speed: 12, halfLength: 2.1 });
  const rear = makeTrafficCar({ id: 2, s: 198.2, lateralOffset: 2.25, speed: 19, halfLength: 2.0 });
  resolveTrafficInterCarSpacing([front, rear], 4.9);
  assert.ok(front.s - rear.s >= 4.0, `Expected non-overlapping traffic spacing, got ${front.s - rear.s}`);
  assert.ok(rear.speed <= front.speed, 'Trailing faster vehicle yields speed to slower car ahead');
});

test('evaluateGuardrailImpact breaches on decisive racing slams and lowered integrity, while computeAutomotiveNormalShade differentiates panels', () => {
  const decisiveSlam = evaluateGuardrailImpact({
    playerSpeed: 19.0,
    outwardLateralSpeed: 4.5,
    overallIntegrity: 100,
  });
  assert.equal(decisiveSlam.shouldBreach, true);

  const weakenedBreach = evaluateGuardrailImpact({
    playerSpeed: 15.0,
    outwardLateralSpeed: 3.5,
    overallIntegrity: 50,
  });
  assert.equal(weakenedBreach.shouldBreach, true);

  const roofShade = computeAutomotiveNormalShade(0, 1, 0, 1, 0, 1, 0);
  const sideShade = computeAutomotiveNormalShade(1, 0, 0, 1, 0, 1, 0);
  const underShade = computeAutomotiveNormalShade(0, -1, 0, 1, 0, 1, 0);

  assert.ok(roofShade >= 0.8 && roofShade <= 1.25);
  assert.ok(sideShade >= 0.8 && sideShade <= 1.25);
  assert.ok(underShade >= 0.8 && underShade <= 1.25);
  assert.ok(roofShade > underShade, `Roof shade (${roofShade}) should exceed underside (${underShade})`);
});



