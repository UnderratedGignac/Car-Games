import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_ROSTER,
  flipDirection,
  getDirectionVector,
  computeEffectiveCarStats,
  getUpgradeCost,
  createInitialDriftState,
  stepDriftPhysics,
  stepHighwayPhysics,
  generateSCurveTrack,
  extendSCurveTrack,
  evaluateCarOnSCurveRoad,
  calculateDriftScoreStep,
  resolveCarAppearance,
  getDriftRank,
  ROAD_BIOMES,
  ROAD_MODE_OPTIONS,
  resolveRoadBiome,
  HIGHWAY_ROAD_WIDTH,
  HIGHWAY_LANE_OFFSET,
  generateHighwayTrack,
  extendHighwayTrack,
  sampleTrackAtS,
  generateTrafficBatch,
  evaluateTrafficInteraction,
  VALLEY_BASE_Y,
  sampleTerrainElevation,
  evaluateSlipstreamDraft,
  getOvertakeStreakLabel,
  triggerTrafficFlashYield,
  stepTrafficCars,
  compactInPlace,
  ROAD_WIDTH,
} from './rules';
import { computeMixerVolume, SoundFXSystem, soundFX } from './audio';
import { getPixelCarTireAnchors, resolveVehicleArchetype } from './pixelSprites';
import { computeDistanceFogAlpha } from './world3d';
import {
  AI_SFX_SLOTS,
  BIOME_MUSIC_PRESETS,
  computeMusicDspParams,
  findPeakAudioWindow,
} from './musicConfig';
import {
  ANIME_CLOUD_COUNT,
  SKY_THEME_OPTIONS,
  resolveSkyAtmosphere,
} from './skyArt';

test('CAR_ROSTER has 90 distinct progressive vehicles from T1 to T90', () => {
  assert.equal(CAR_ROSTER.length, 90);
  const ids = CAR_ROSTER.map((c) => c.id);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, 90, 'All 90 vehicle IDs must be unique');

  // Verify first 14 legacy cars are preserved in order
  const legacyIds = [
    'blue_jdm',
    'crimson_tuner',
    'emerald_truck',
    'midnight_muscle',
    'sakura_silvia',
    'yellow_kei',
    'rally_legend',
    'cyber_supercar',
    'solar_hypercar',
    'matte_boss',
    'cobalt_gt3',
    'crimson_wagon',
    'neon_interceptor',
    'apex_valkyrie',
  ];
  for (let i = 0; i < legacyIds.length; i++) {
    assert.equal(ids[i], legacyIds[i], `Legacy car at index ${i} should be ${legacyIds[i]}`);
  }

  // Verify progressive tiers 1..90
  const tiers = CAR_ROSTER.map((c) => c.tier);
  const expectedTiers = Array.from({ length: 90 }, (_, i) => i + 1);
  assert.deepEqual(tiers, expectedTiers, 'Tiers must increment strictly 1..90');

  // Verify diverse body shapes
  const shapes = new Set(CAR_ROSTER.map((c) => c.bodyShape));
  assert.ok(shapes.has('motorcycle'), 'Must have motorcycle shape');
  assert.ok(shapes.has('cyber_bike'), 'Must have cyber_bike shape');
  assert.ok(shapes.has('truck'), 'Must have truck shape');
  assert.ok(shapes.has('semi'), 'Must have semi shape');
  assert.ok(shapes.has('van'), 'Must have van shape');
  assert.ok(shapes.has('formula'), 'Must have formula shape');
  assert.ok(shapes.has('classic'), 'Must have classic shape');
  assert.ok(shapes.has('supercar'), 'Must have supercar shape');
  assert.ok(shapes.has('rally'), 'Must have rally shape');
  assert.ok(shapes.has('kei'), 'Must have kei shape');

  const blueJdm = CAR_ROSTER.find((c) => c.id === 'blue_jdm')!;
  assert.equal(blueJdm.decalText, '73');
  assert.equal(blueJdm.hoodFeature, 'stripes');

  const emeraldTruck = CAR_ROSTER.find((c) => c.id === 'emerald_truck')!;
  assert.equal(emeraldTruck.bodyShape, 'truck');

  const sakuraSilvia = CAR_ROSTER.find((c) => c.id === 'sakura_silvia')!;
  assert.equal(sakuraSilvia.hoodFeature, 'sakura');
  assert.equal(sakuraSilvia.decalText, '86');

  const rallyLegend = CAR_ROSTER.find((c) => c.id === 'rally_legend')!;
  assert.equal(rallyLegend.bodyShape, 'rally');
  assert.equal(rallyLegend.decalText, '01');

  const solarHyper = CAR_ROSTER.find((c) => c.id === 'solar_hypercar')!;
  assert.equal(solarHyper.bodyShape, 'supercar');

  assert.equal(CAR_ROSTER.find((c) => c.id === 'cobalt_gt3')!.bodyShape, 'gt3');
  assert.equal(CAR_ROSTER.find((c) => c.id === 'crimson_wagon')!.bodyShape, 'wagon');
  assert.equal(CAR_ROSTER.find((c) => c.id === 'neon_interceptor')!.bodyShape, 'interceptor');
  assert.equal(CAR_ROSTER.find((c) => c.id === 'apex_valkyrie')!.bodyShape, 'prototype');
});

test('resolveCarAppearance resolves stock defaults and full custom Mod Shop overrides', () => {
  const starter = CAR_ROSTER[0];
  const stockAppearance = resolveCarAppearance(starter);
  assert.equal(stockAppearance.primaryColor, starter.primaryColor);
  assert.equal(stockAppearance.spoilerStyle, starter.spoilerStyle);
  assert.equal(stockAppearance.number, '73');
  assert.equal(stockAppearance.underglowHex, null);
  assert.equal(stockAppearance.engine, 'stock');
  assert.equal(stockAppearance.roof, 'stock');
  assert.equal(stockAppearance.tires, 'stock');
  assert.equal(stockAppearance.exhaust, 'stock');
  assert.equal(stockAppearance.hood, 'stock');
  assert.equal(stockAppearance.windows, 'stock');
  assert.equal(stockAppearance.horn, 'stock');
  assert.equal(stockAppearance.sound, 'stock');
  assert.equal(stockAppearance.lights, 'stock');

  const modded = resolveCarAppearance(starter, {
    paint: 'sakura_pink',
    livery: 'two_tone',
    wing: 'cyber',
    rims: 'gold',
    underglow: 'cyan',
    flame: 'plasma_pink',
    number: '86',
    engine: 'v12_hybrid',
    roof: 'light_bar',
    tires: 'drag_slick',
    exhaust: 'quad_ti',
    hood: 'clear_bay',
    windows: 'chameleon_cyan',
    horn: 'air_horn',
    sound: 'f1_scream',
    lights: 'cyber_cyan',
  });
  assert.equal(modded.primaryColor, '#f472b6');
  assert.equal(modded.livery, 'two_tone');
  assert.equal(modded.spoilerStyle, 'cyber');
  assert.equal(modded.rimHex, '#fbbf24');
  assert.equal(modded.underglowHex, '#22d3ee');
  assert.equal(modded.flameOuter, '#ec4899');
  assert.equal(modded.number, '86');
  assert.equal(modded.engine, 'v12_hybrid');
  assert.equal(modded.roof, 'light_bar');
  assert.equal(modded.tires, 'drag_slick');
  assert.equal(modded.tireStripeHex, '#ef4444');
  assert.equal(modded.exhaust, 'quad_ti');
  assert.equal(modded.hood, 'clear_bay');
  assert.equal(modded.windows, 'chameleon_cyan');
  assert.equal(modded.windowSpecHex, '#67e8f9');
  assert.equal(modded.horn, 'air_horn');
  assert.equal(modded.sound, 'f1_scream');
  assert.equal(modded.lights, 'cyber_cyan');
  assert.equal(modded.headlightBeamHex, '#22d3ee');
});

test('getDriftRank scales from D Rookie up to SS Drift King', () => {
  assert.equal(getDriftRank(100).rank, 'D');
  assert.equal(getDriftRank(650).rank, 'C');
  assert.equal(getDriftRank(2000).rank, 'B');
  assert.equal(getDriftRank(4500).rank, 'A');
  assert.equal(getDriftRank(9000).rank, 'S');
  assert.equal(getDriftRank(16000).rank, 'SS');
});

test('ROAD_BIOMES and resolveRoadBiome support fixed roads and 450m World Tour cycling', () => {
  assert.equal(Object.keys(ROAD_BIOMES).length, 4);
  assert.equal(ROAD_MODE_OPTIONS.length, 5);

  assert.equal(resolveRoadBiome('tour', 0).id, 'alpine');
  assert.equal(resolveRoadBiome('tour', 449).id, 'alpine');
  assert.equal(resolveRoadBiome('tour', 450).id, 'canyon');
  assert.equal(resolveRoadBiome('tour', 900).id, 'neon');
  assert.equal(resolveRoadBiome('tour', 1350).id, 'sakura');
  assert.equal(resolveRoadBiome('tour', 1800).id, 'alpine');

  assert.equal(resolveRoadBiome('neon', 0).id, 'neon');
  assert.equal(resolveRoadBiome('neon', 9999).id, 'neon');
  assert.equal(resolveRoadBiome('neon', 0).isNight, true);
  assert.equal(resolveRoadBiome('sakura', 0).ambientParticle, 'petal');
});

test('stepDriftPhysics decomposes forward drive and lateral friction with slip angle', () => {
  const initial = createInitialDriftState(0, 0, 0, -Math.PI / 2, 18.0);
  const stats = { topSpeed: 22.0, driftGrip: 0.78, handlingRate: 2.5 };

  // Straight throttle step
  const straight = stepDriftPhysics(
    initial,
    { steerInput: 0, throttle: 1.0 },
    stats,
    0.016
  );
  assert.ok(straight.vz < 0);
  assert.ok(straight.absSlipAngle < 0.05);
  assert.equal(straight.isDrifting, false);

  // Sharp steering initiates drift slip
  let drifting = straight;
  for (let i = 0; i < 16; i++) {
    drifting = stepDriftPhysics(
      drifting,
      { steerInput: 1.0, throttle: 1.0, handbrake: true },
      stats,
      0.016
    );
  }
  assert.ok(drifting.absSlipAngle > 0.14);
  assert.equal(drifting.isDrifting, true);
  assert.ok(drifting.driftFactor > 0);
});

test('generateSCurveTrack and extendSCurveTrack produce continuous S-curves, coins, and Nitro Star Gems', () => {
  const track = generateSCurveTrack(50, 2.6, 123);
  assert.equal(track.length, 50);

  // First 12 points form straight safe launchpad
  for (let i = 0; i < 12; i++) {
    assert.equal(track[i].curvature, 0);
  }

  // Every point advances forward (-Z)
  for (let i = 1; i < track.length; i++) {
    assert.ok(track[i].z < track[i - 1].z, `Point ${i} should advance in -Z`);
  }

  // Contains both coins and Nitro Star Gems
  assert.ok(track.some((pt) => pt.hasCoin), 'Track should include coins');
  assert.ok(track.some((pt) => pt.hasNitroGem), 'Track should include Nitro Star Gems');

  // Seamless extension
  const extended = extendSCurveTrack(track, 20, 2.6, 123);
  assert.equal(extended.length, 20);
  assert.equal(extended[0].index, 50);
  assert.ok(extended[0].z < track[track.length - 1].z);

  // Origin evaluation
  const atSpawn = evaluateCarOnSCurveRoad(track[0].x, track[0].z, track);
  assert.equal(atSpawn.onRoad, true);
  assert.ok(atSpawn.perpDistance < 0.5);

  // Off-road detection
  const offRoad = evaluateCarOnSCurveRoad(track[10].x + 30, track[10].z, track);
  assert.equal(offRoad.onRoad, false);
});

test('flipDirection toggles between right (/) and left (\\)', () => {
  assert.equal(flipDirection('right'), 'left');
  assert.equal(flipDirection('left'), 'right');
});

test('getDirectionVector returns normalized diagonal velocity vectors', () => {
  const rightVec = getDirectionVector('right');
  const leftVec = getDirectionVector('left');
  assert.ok(rightVec.vx > 0 && rightVec.vz < 0);
  assert.ok(leftVec.vx < 0 && leftVec.vz < 0);
  assert.ok(Math.abs(Math.hypot(rightVec.vx, rightVec.vz) - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(leftVec.vx, leftVec.vz) - 1) < 1e-6);
});

test('computeEffectiveCarStats and getUpgradeCost scale with car tier, upgrades, engine & tire mods', () => {
  const starter = CAR_ROSTER[0];
  const baseStats = computeEffectiveCarStats(starter, { speed: 1, handling: 1, magnet: 1 });
  const maxedStats = computeEffectiveCarStats(starter, { speed: 5, handling: 5, magnet: 5 });

  assert.ok(maxedStats.topSpeed > baseStats.topSpeed);
  assert.ok(maxedStats.magnetRadius > baseStats.magnetRadius);
  assert.ok(getUpgradeCost(1, 1) > 0);
  assert.equal(getUpgradeCost(1, 5), 0);

  const kersDragStats = computeEffectiveCarStats(
    starter,
    { speed: 1, handling: 1, magnet: 1 },
    { engine: 'v12_hybrid', tires: 'drag_slick' }
  );
  assert.ok(kersDragStats.topSpeed > baseStats.topSpeed + 2.5);
  assert.ok(kersDragStats.driftGrip > baseStats.driftGrip);
  assert.ok(kersDragStats.feverGainRate > baseStats.feverGainRate);

  const rotaryDriftStats = computeEffectiveCarStats(
    starter,
    { speed: 1, handling: 1, magnet: 1 },
    { engine: 'rotary_brap', tires: 'drift_spec' }
  );
  assert.ok(rotaryDriftStats.handlingRate > baseStats.handlingRate);
  assert.ok(rotaryDriftStats.driftGrip < baseStats.driftGrip);
});

test('calculateDriftScoreStep increases with combo, nearEdge, and fever state', () => {
  const normal = calculateDriftScoreStep({
    distanceDelta: 2,
    combo: 1,
    isFever: false,
    nearEdge: false,
    isDrifting: false,
  });
  const feverDriftingEdge = calculateDriftScoreStep({
    distanceDelta: 2,
    combo: 5,
    isFever: true,
    nearEdge: true,
    isDrifting: true,
  });
  assert.ok(feverDriftingEdge.scoreDelta > normal.scoreDelta * 10);
  assert.ok(feverDriftingEdge.feverDelta > normal.feverDelta);
});

test('generateHighwayTrack & sampleTrackAtS produce wide 2-lane road with smooth interpolation', () => {
  const hwy = generateHighwayTrack(40, 3.4, 77);
  assert.equal(hwy.length, 40);
  assert.equal(hwy[0].width, HIGHWAY_ROAD_WIDTH);
  for (let i = 0; i < 12; i++) {
    assert.equal(hwy[i].curvature, 0);
  }
  const ext = extendHighwayTrack(hwy, 15, 3.4, 77);
  assert.equal(ext.length, 15);
  assert.equal(ext[0].index, 40);

  const sample = sampleTrackAtS(hwy, 5.1, 3.4);
  assert.ok(sample !== null);
  assert.ok(sample.z < 0);
  assert.equal(sample.width, HIGHWAY_ROAD_WIDTH);
});

test('generateTrafficBatch leaves safe start zone and guaranteed staggered overtaking gaps', () => {
  const { cars } = generateTrafficBatch({
    startS: 0,
    endS: 320,
    nextIdStart: 1,
    seed: 99,
    existingCars: [],
    difficultyProgress: 0.4,
  });
  assert.ok(cars.length >= 6);
  // Safe initial launch margin
  assert.ok(cars.every((c) => c.s >= 58));

  const hasSameLane = cars.some((c) => !c.isOncoming && c.lane === 1);
  const hasOncoming = cars.some((c) => c.isOncoming && c.lane === -1);
  assert.ok(hasSameLane && hasOncoming, 'Batch should contain both same-lane and oncoming cars');

  // Verify no two opposite-lane cars ever spawn side-by-side blocking both lanes
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      if (cars[i].lane !== cars[j].lane) {
        assert.ok(
          Math.abs(cars[i].s - cars[j].s) >= 15.0,
          'Opposite-lane cars must maintain staggered passing pocket'
        );
      }
    }
  }
});

test('evaluateTrafficInteraction detects collisions, near-misses, and overtakes accurately', () => {
  const { cars } = generateTrafficBatch({
    startS: 60,
    endS: 160,
    nextIdStart: 1,
    seed: 12,
    existingCars: [],
  });
  const target = { ...cars[0], s: 100, lane: 1 as const, lateralOffset: HIGHWAY_LANE_OFFSET, halfWidth: 0.94, halfLength: 1.95, overtaken: false, nearMissed: false };

  // Passing in left lane close enough for a near miss, no collision
  const nearPass = evaluateTrafficInteraction({
    playerS: 100,
    playerLateralOffset: HIGHWAY_LANE_OFFSET - 2.6, // ~2.6m lateral gap (touch threshold is ~1.51m, near miss is ~3.29m)
    trafficCars: [target],
  });
  assert.equal(nearPass.collidedCar, null);
  assert.equal(nearPass.newlyNearMissed.length, 1);
  assert.equal(nearPass.newlyOvertaken.length, 0);

  // Clearing past the front bumper awards overtake
  const cleared = evaluateTrafficInteraction({
    playerS: 104,
    playerLateralOffset: HIGHWAY_LANE_OFFSET - 2.6,
    trafficCars: [target],
  });
  assert.equal(cleared.collidedCar, null);
  assert.equal(cleared.newlyOvertaken.length, 1);

  // Direct overlap triggers collision
  const hit = evaluateTrafficInteraction({
    playerS: 100.5,
    playerLateralOffset: HIGHWAY_LANE_OFFSET,
    trafficCars: [target],
  });
  assert.ok(hit.collidedCar !== null);
});

test('stepHighwayPhysics keeps grip planted without drifting and responds to Gas & Brake pedals', () => {
  const stats = { topSpeed: 22.0, handlingRate: 2.8 };
  let s = createInitialDriftState(0, 0, 0, -Math.PI / 2, 17.0);

  // Normal lane steering should NOT trigger drift
  for (let i = 0; i < 12; i++) {
    s = stepHighwayPhysics(
      s,
      { steerInput: 1.0, accelInput: 0, brakeInput: 0, roadTangentAngle: -Math.PI / 2 },
      stats,
      0.016
    );
  }
  assert.equal(s.isDrifting, false, 'Normal highway steering must not trigger perpetual drift');
  assert.ok(s.absSlipAngle < 0.14, 'High lateral grip keeps slip angle low');

  // Releasing steering self-centers heading cleanly back toward road tangent
  for (let i = 0; i < 40; i++) {
    s = stepHighwayPhysics(
      s,
      { steerInput: 0, accelInput: 0, brakeInput: 0, roadTangentAngle: -Math.PI / 2 },
      stats,
      0.016
    );
  }
  assert.ok(Math.abs(s.heading - -Math.PI / 2) < 0.12, 'Highway steering self-centers smoothly');

  const cruiseSpeed = Math.hypot(s.vx, s.vz);

  // Holding Gas accelerates significantly above cruise speed
  let gassed = s;
  for (let i = 0; i < 45; i++) {
    gassed = stepHighwayPhysics(
      gassed,
      { steerInput: 0, accelInput: 1, brakeInput: 0, roadTangentAngle: -Math.PI / 2 },
      stats,
      0.016
    );
  }
  const gasSpeed = Math.hypot(gassed.vx, gassed.vz);
  assert.ok(gasSpeed > cruiseSpeed * 1.35, `Gas speed (${gasSpeed}) should exceed cruise (${cruiseSpeed})`);

  // Holding Brake decelerates smoothly well below cruise without stalling backward
  let braked = gassed;
  for (let i = 0; i < 35; i++) {
    braked = stepHighwayPhysics(
      braked,
      { steerInput: 0, accelInput: 0, brakeInput: 1, roadTangentAngle: -Math.PI / 2 },
      stats,
      0.016
    );
  }
  const brakeSpeed = Math.hypot(braked.vx, braked.vz);
  assert.ok(brakeSpeed < cruiseSpeed * 0.72, `Brake speed (${brakeSpeed}) should drop below cruise (${cruiseSpeed})`);
  assert.ok(brakeSpeed >= stats.topSpeed * 0.34, 'Braking preserves forward motion floor');
  assert.ok(braked.vz < 0, 'Car continues advancing forward when braking');
});

test('sampleTerrainElevation forms low viaduct river basin and rising 3D biome flanks', () => {
  const riverCenter = sampleTerrainElevation(0, -40, 'alpine');
  const embankment = sampleTerrainElevation(20, -40, 'alpine');
  const mountainOuter = sampleTerrainElevation(48, -40, 'alpine');
  assert.ok(riverCenter < VALLEY_BASE_Y, 'Center basin under viaduct stays recessed below VALLEY_BASE_Y');
  assert.ok(embankment > riverCenter, 'Embankment rises above river basin');
  assert.ok(mountainOuter > embankment, 'Outer foothills rise above inner embankment');

  // Canyon terraces & Neon decks remain well below road level (y ~ 0) so terrain never clips viaduct
  for (const biome of ['alpine', 'canyon', 'neon', 'sakura'] as const) {
    assert.ok(sampleTerrainElevation(16, -80, biome) < -4.0, `${biome} inner bank stays below elevated road`);
  }
});

test('generateSCurveTrack and generateHighwayTrack keep launchpad flat and roll into 3D hills', () => {
  const driftTrack = generateSCurveTrack(90, 2.6, 42);
  const hwyTrack = generateHighwayTrack(90, 3.4, 42);

  for (let i = 0; i <= 6; i++) {
    assert.equal(driftTrack[i].y, 0, 'Drift launchpad stays flat');
    assert.equal(hwyTrack[i].y, 0, 'Highway launchpad stays flat');
  }
  const driftYs = driftTrack.slice(12).map((p) => p.y);
  const hwyYs = hwyTrack.slice(12).map((p) => p.y);
  assert.ok(Math.max(...driftYs) > 1.5 && Math.min(...driftYs) < -1.5, 'Drift road has rolling hills & dips');
  assert.ok(Math.max(...hwyYs) > 1.0 && Math.min(...hwyYs) < -1.0, 'Highway road has rolling hills & dips');
});

test('evaluateSlipstreamDraft & getOvertakeStreakLabel reward drafting and multi-pass chains', () => {
  const { cars } = generateTrafficBatch({
    startS: 60,
    endS: 160,
    nextIdStart: 1,
    seed: 12,
    existingCars: [],
  });
  const sameLaneAhead = { ...cars[0], s: 112, lane: 1 as const, isOncoming: false, lateralOffset: HIGHWAY_LANE_OFFSET };
  const oncomingAhead = { ...cars[0], id: 99, s: 108, lane: -1 as const, isOncoming: true, lateralOffset: -HIGHWAY_LANE_OFFSET };

  const activeDraft = evaluateSlipstreamDraft({
    playerS: 100,
    playerLateralOffset: HIGHWAY_LANE_OFFSET + 0.2,
    trafficCars: [sameLaneAhead, oncomingAhead],
  });
  assert.ok(activeDraft.draftingCar !== null);
  assert.equal(activeDraft.draftingCar!.id, sameLaneAhead.id);
  assert.ok(activeDraft.intensity > 0.35);

  const noDraft = evaluateSlipstreamDraft({
    playerS: 100,
    playerLateralOffset: -HIGHWAY_LANE_OFFSET,
    trafficCars: [sameLaneAhead, oncomingAhead],
  });
  assert.equal(noDraft.draftingCar, null);
  assert.equal(noDraft.intensity, 0);

  assert.equal(getOvertakeStreakLabel(1), '');
  assert.equal(getOvertakeStreakLabel(2), 'DOUBLE PASS x2!');
  assert.equal(getOvertakeStreakLabel(3), 'TRIPLE PASS x3!');
  assert.equal(getOvertakeStreakLabel(5), 'APEX SLASH x5!');
  assert.equal(getOvertakeStreakLabel(7), 'UNSTOPPABLE x7!');
});

test('triggerTrafficFlashYield & stepTrafficCars move same-lane traffic out of player path and recover cleanly', () => {
  const { cars } = generateTrafficBatch({
    startS: 60,
    endS: 160,
    nextIdStart: 1,
    seed: 12,
    existingCars: [],
  });
  const aheadSameLane = {
    ...cars[0],
    id: 101,
    s: 118,
    lane: 1 as const,
    isOncoming: false,
    lateralOffset: HIGHWAY_LANE_OFFSET,
    speed: 10,
  };
  const aheadOncoming = {
    ...cars[0],
    id: 102,
    s: 118,
    lane: -1 as const,
    isOncoming: true,
    lateralOffset: -HIGHWAY_LANE_OFFSET,
    speed: 12,
  };

  const traffic = [aheadSameLane, aheadOncoming];
  const res = triggerTrafficFlashYield({
    playerS: 100,
    playerLateralOffset: HIGHWAY_LANE_OFFSET,
    trafficCars: traffic,
    rangeMeters: 48,
  });

  assert.equal(res.yieldedCars.length, 1);
  assert.equal(res.newlyFlashedCount, 1);
  assert.equal(aheadSameLane.yieldingToSide, 1);
  assert.ok((aheadSameLane.yieldTimer || 0) > 2.5);
  assert.ok((aheadSameLane.targetLateralOffset || 0) > HIGHWAY_LANE_OFFSET + 0.8);
  assert.equal(aheadOncoming.yieldingToSide, undefined);

  // Repeated flash counts only once per traffic vehicle
  const repeatRes = triggerTrafficFlashYield({
    playerS: 100,
    playerLateralOffset: HIGHWAY_LANE_OFFSET,
    trafficCars: traffic,
    rangeMeters: 48,
  });
  assert.equal(repeatRes.newlyFlashedCount, 0);

  // Step forward and confirm lateral pocket yield displacement
  const initialLat = aheadSameLane.lateralOffset;
  for (let i = 0; i < 20; i++) {
    stepTrafficCars(traffic, 0.05);
  }
  assert.ok(aheadSameLane.lateralOffset > initialLat + 0.85, 'Yielding car pulls toward right shoulder');
  assert.ok(aheadOncoming.s < 118, 'Oncoming car continues advancing opposite way');

  // After timer expires, car smoothly drifts back to its lane center
  for (let i = 0; i < 90; i++) {
    stepTrafficCars(traffic, 0.05);
  }
  assert.equal(aheadSameLane.yieldingToSide, undefined);
  assert.ok(Math.abs(aheadSameLane.lateralOffset - HIGHWAY_LANE_OFFSET) < 0.35);
});

test('compactInPlace filters elements in-place preserving order and zeroing array tail length', () => {
  const arr = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
  const sameRef = arr;
  compactInPlace(arr, (item) => item.id % 2 === 1);
  assert.equal(arr, sameRef);
  assert.deepEqual(
    arr.map((x) => x.id),
    [1, 3, 5]
  );

  compactInPlace(arr, () => false);
  assert.equal(arr.length, 0);
});

test('getPixelCarTireAnchors computes exact tire contact coordinates and compound width scaling', () => {
  const car = CAR_ROSTER[0];
  const rightDrift = getPixelCarTireAnchors(car, 0.75, { tires: 'stock' });
  const leftDrift = getPixelCarTireAnchors(car, -0.75, { tires: 'stock' });
  const dragSlicks = getPixelCarTireAnchors(car, 0.75, { tires: 'drag_slick' });

  assert.ok(rightDrift.rearLeft.u > 0 && rightDrift.rearLeft.u < rightDrift.rearRight.u);
  assert.ok(rightDrift.rearRight.u < 1);
  assert.ok(rightDrift.rearLeft.v > 0.55 && rightDrift.rearLeft.v < 0.95);
  assert.ok(rightDrift.frontLeft.u < rightDrift.frontRight.u);
  assert.equal(rightDrift.dirSign, 1);

  assert.equal(leftDrift.dirSign, -1);
  assert.ok(leftDrift.rearLeft.u < leftDrift.rearRight.u);
  // Mirror symmetry: left-drift rearRight should sit symmetrically opposite right-drift rearLeft
  assert.ok(Math.abs(leftDrift.rearRight.u + rightDrift.rearLeft.u - 1) < 0.03);
  assert.ok(dragSlicks.tireWidthScale > rightDrift.tireWidthScale);
});

test('BIOME_MUSIC_PRESETS and AI_SFX_SLOTS cover all 4 biomes and 5 core gameplay FX slots', () => {
  assert.deepEqual(Object.keys(BIOME_MUSIC_PRESETS).sort(), ['alpine', 'canyon', 'neon', 'sakura']);
  for (const preset of Object.values(BIOME_MUSIC_PRESETS)) {
    assert.ok(preset.prompt.length > 30);
    assert.ok(preset.bpm >= 120);
  }
  assert.deepEqual(
    AI_SFX_SLOTS.map((s) => s.id),
    ['fever', 'drift_flip', 'overtake', 'milestone', 'crash']
  );
});

test('computeMusicDspParams modulates AI music lowpass, bass, and playback rate cleanly across game states', () => {
  const cruise = computeMusicDspParams({
    phase: 'playing',
    speedRatio: 1.0,
    isDrifting: false,
    driftFactor: 0,
    isFever: false,
    isBraking: false,
    isNearEdge: false,
  });
  const fever = computeMusicDspParams({
    phase: 'playing',
    speedRatio: 1.35,
    isDrifting: true,
    driftFactor: 0.9,
    isFever: true,
    isBraking: false,
    isNearEdge: true,
  });
  const paused = computeMusicDspParams({
    phase: 'paused',
    speedRatio: 1.0,
    isDrifting: false,
    driftFactor: 0,
    isFever: false,
    isBraking: false,
    isNearEdge: false,
  });
  const gameover = computeMusicDspParams({
    phase: 'gameover',
    speedRatio: 0.5,
    isDrifting: false,
    driftFactor: 0,
    isFever: false,
    isBraking: false,
    isNearEdge: false,
  });

  assert.ok(fever.lowpassHz > cruise.lowpassHz);
  assert.ok(fever.bassBoostDb > cruise.bassBoostDb);
  assert.ok(fever.playbackRate > cruise.playbackRate);
  assert.ok(paused.lowpassHz < 800, 'Pause applies muffled pit-stop lowpass filter');
  assert.ok(gameover.playbackRate < 0.9, 'Gameover applies tape-slow pitch drop');
});

test('findPeakAudioWindow locates loudest transient region inside a decoded audio buffer', () => {
  const sampleRate = 1000;
  const totalSec = 6;
  const samples = new Float32Array(sampleRate * totalSec);
  // Put quiet ambience from 0..2.5s and a strong transient burst around 3.2s..4.0s
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.02 * Math.sin(i * 0.1);
  }
  for (let i = 3200; i < 4000; i++) {
    samples[i] = 0.92 * Math.sin(i * 0.4);
  }
  const win = findPeakAudioWindow(samples, sampleRate, 1.0);
  assert.ok(win.startSec >= 2.8 && win.startSec <= 3.35, `Expected peak near 3.2s, got ${win.startSec}s`);
  assert.ok(win.durationSec >= 0.95 && win.durationSec <= 1.05);
});

test('SKY_THEME_OPTIONS & resolveSkyAtmosphere support Sun, Sunset, Big Moon, Red Moon, Aurora & sculpted anime clouds', () => {
  assert.equal(ANIME_CLOUD_COUNT, 5);
  assert.deepEqual(
    SKY_THEME_OPTIONS.map((o) => o.id),
    ['auto', 'sun_day', 'golden_sunset', 'big_moon', 'red_moon', 'aurora_night']
  );

  const alpineBiome = ROAD_BIOMES.alpine;
  const sunSky = resolveSkyAtmosphere('sun_day', alpineBiome);
  assert.equal(sunSky.isNight, false);
  assert.equal(sunSky.celestialKind, 'sun');
  assert.equal(sunSky.hasGodRays, true);

  const autoCanyon = resolveSkyAtmosphere('auto', ROAD_BIOMES.canyon);
  assert.equal(autoCanyon.id, 'golden_sunset');
  const autoNeon = resolveSkyAtmosphere('auto', ROAD_BIOMES.neon);
  assert.equal(autoNeon.isNight, true);
  assert.equal(autoNeon.id, 'big_moon');

  const sunsetSky = resolveSkyAtmosphere('golden_sunset', alpineBiome);
  assert.equal(sunsetSky.isNight, false);
  assert.equal(sunsetSky.celestialKind, 'sunset_sun');
  assert.equal(sunsetSky.hasGodRays, true);

  const bigMoonSky = resolveSkyAtmosphere('big_moon', alpineBiome);
  assert.equal(bigMoonSky.isNight, true);
  assert.equal(bigMoonSky.celestialKind, 'big_moon');
  assert.ok(bigMoonSky.celestialRadius >= 24, 'Big Moon should render as a giant lunar disc');
  assert.equal(bigMoonSky.hasShootingStars, true);

  const redMoonSky = resolveSkyAtmosphere('red_moon', alpineBiome);
  assert.equal(redMoonSky.isNight, true);
  assert.equal(redMoonSky.celestialKind, 'red_moon');
  assert.ok(redMoonSky.celestialRadius >= 24, 'Red Blood Moon should render as a massive lunar disc');
  assert.equal(redMoonSky.hasShootingStars, true);

  const auroraSky = resolveSkyAtmosphere('aurora_night', alpineBiome);
  assert.equal(auroraSky.isNight, true);
  assert.equal(auroraSky.hasAurora, true);
  assert.equal(auroraSky.hasShootingStars, true);
});

test('triggerHaptic safely handles SSR and invokes navigator.vibrate with exact sprint specs', async () => {
  const { triggerHaptic, soundFX } = await import('./audio');

  // SSR / headless environment safe check
  const ssrResult = triggerHaptic('light');
  assert.equal(typeof ssrResult, 'boolean');

  // Mock navigator.vibrate safely
  const calls: (number | number[])[] = [];
  const mockVibrate = (pattern: number | number[]) => {
    calls.push(pattern);
    return true;
  };

  const nav = typeof navigator !== 'undefined' ? navigator : (globalThis as unknown as { navigator: Navigator }).navigator;
  const originalVibrate = (nav as unknown as { vibrate?: unknown })?.vibrate;
  Object.defineProperty(nav, 'vibrate', {
    value: mockVibrate,
    configurable: true,
    writable: true,
  });

  try {
    assert.equal(triggerHaptic('light'), true);
    assert.equal(calls[calls.length - 1], 18);

    assert.equal(triggerHaptic('medium'), true);
    assert.equal(calls[calls.length - 1], 38);

    assert.equal(triggerHaptic('heavy'), true);
    assert.equal(calls[calls.length - 1], 65);

    assert.equal(triggerHaptic('double'), true);
    assert.deepEqual(calls[calls.length - 1], [25, 45, 35]);

    assert.equal(triggerHaptic('fever'), true);
    assert.deepEqual(calls[calls.length - 1], [45, 35, 45, 35, 75]);

    // Method on soundFX
    assert.equal(soundFX.triggerHaptic('light'), true);
    assert.equal(calls[calls.length - 1], 18);

    // Sound FX methods execute safely without throwing
    assert.doesNotThrow(() => soundFX.playCoinPickup(0));
    assert.doesNotThrow(() => soundFX.playCoinPickup(5));
    assert.doesNotThrow(() => soundFX.playTurboChirp());
    assert.doesNotThrow(() => soundFX.playDriftFlip(5, false));
    assert.doesNotThrow(() => soundFX.playDriftFlip(10, false));
    assert.doesNotThrow(() => soundFX.playDriftFlip(15, false));
    assert.doesNotThrow(() => soundFX.playDriftFlip(20, true));
    assert.doesNotThrow(() => soundFX.playGearShift());
  } finally {
    if (originalVibrate) {
      Object.defineProperty(nav, 'vibrate', {
        value: originalVibrate,
        configurable: true,
        writable: true,
      });
    } else {
      delete (nav as unknown as { vibrate?: unknown }).vibrate;
    }
  }
});

// Zen mode replaced by Precision Parking mode (covered in parking.test.ts)

test('Audio Mixer Channels - volume multipliers, clamping and gain math', () => {
  const engine = new SoundFXSystem();

  // 1. Default volumes match specifications
  const defaults = engine.getMixerVolumes();
  assert.equal(defaults.master, 1.0);
  assert.equal(defaults.music, 0.8);
  assert.equal(defaults.sfx, 0.9);
  assert.equal(defaults.engine, 0.7);

  // 2. setMixerVolumes updates independent channels and clamps to [0, 1]
  engine.setMixerVolumes({
    master: 0.85,
    music: 0.6,
    sfx: 0.75,
    engine: 0.5,
  });
  const updated = engine.getMixerVolumes();
  assert.equal(updated.master, 0.85);
  assert.equal(updated.music, 0.6);
  assert.equal(updated.sfx, 0.75);
  assert.equal(updated.engine, 0.5);

  // 3. Clamping bounds check (< 0 and > 1)
  engine.setMixerVolumes({
    master: -0.5,
    music: 1.8,
  });
  const clamped = engine.getMixerVolumes();
  assert.equal(clamped.master, 0.0);
  assert.equal(clamped.music, 1.0);

  // 4. Channel volume scaling math
  assert.equal(computeMixerVolume(0.8, 1.0), 0.8);
  assert.equal(computeMixerVolume(0.9, 0.5), 0.45);
  assert.equal(computeMixerVolume(0.7, 0.0), 0.0); // Zero master mutes channel
  assert.equal(computeMixerVolume(1.5, 1.0), 1.0); // Clamped

  // 5. Deck snapshot exposes mixer channels for UI subscribers
  engine.setMixerVolumes({ master: 0.9, music: 0.7, sfx: 0.8, engine: 0.65 });
  const snapshot = engine.getDeckSnapshot();
  assert.equal(snapshot.masterVolume, 0.9);
  assert.equal(snapshot.musicVolume, 0.7);
  assert.equal(snapshot.sfxVolume, 0.8);
  assert.equal(snapshot.engineVolume, 0.65);
});

test('resolveVehicleArchetype assigns distinct vehicle silhouettes instead of mere recolors', () => {
  const byId = new Map(CAR_ROSTER.map((c) => [c.id, c]));
  const expected: Record<string, string> = {
    harley_drag_chopper: 'moto_chopper',
    cyber_ronin_bike: 'moto_monobike',
    neo_tokyo_kaneda: 'moto_lightcycle',
    motocross_supermoto: 'moto_dirt',
    cafe_racer_vintage: 'moto_cafe',
    vintage_grand_prix: 'formula_cigar',
    ground_effect_fan_car: 'formula_fan',
    canam_shadow_prototype: 'formula_canam',
    quantum_formula_x: 'formula_jet',
    formula_e_lightning: 'formula_e',
    cyber_titan_pickup: 'truck_cyber',
    baja_trophy_truck: 'truck_baja',
    slammed_c10_dually: 'truck_dually',
    flatbed_hauler: 'truck_flatbed',
    military_apc_hauler: 'truck_apc',
    ford_f100_ratrod: 'truck_ratrod',
    kenworth_behemoth: 'semi_cabover',
    classic_woodie_wagon: 'wagon_woodie',
    phantom_drift_hearse: 'wagon_hearse',
    shelby_cobra_427: 'classic_cobra',
    skyline_r34_gtr_vspec: 'jdm_skyline',
    ae86_trueno_panda: 'jdm_popup',
    delorean_dmc_time: 'interceptor_delorean',
    cyber_spinner_runner: 'interceptor_spinner',
    speedtail_streamliner: 'supercar_streamliner',
    countach_lpi_revival: 'supercar_countach',
    delica_overland_van: 'van_overland',
    custom_aero_transit: 'van_aero',
  };

  for (const [id, expectedArch] of Object.entries(expected)) {
    const car = byId.get(id);
    assert.ok(car, `Expected ${id} in CAR_ROSTER`);
    assert.equal(resolveVehicleArchetype(car), expectedArch);
  }

  // Ensure at least 35 distinct archetypes are actively produced across the 90-car roster
  const uniqueArchetypes = new Set(CAR_ROSTER.map((c) => resolveVehicleArchetype(c)));
  assert.ok(
    uniqueArchetypes.size >= 35,
    `Expected >= 35 distinct vehicle archetypes across 90 vehicles, got ${uniqueArchetypes.size}`
  );
});

test('getPixelCarTireAnchors produces valid normalized ground-contact anchors for all 90 vehicles', () => {
  for (const car of CAR_ROSTER) {
    for (const driftAngle of [-0.65, 0, 0.65]) {
      const anchors = getPixelCarTireAnchors(car, driftAngle);
      for (const key of ['rearLeft', 'rearRight', 'frontLeft', 'frontRight'] as const) {
        const pt = anchors[key];
        assert.ok(Number.isFinite(pt.u) && pt.u > 0.05 && pt.u < 0.95, `${car.id} ${key}.u out of bounds: ${pt.u}`);
        assert.ok(Number.isFinite(pt.v) && pt.v > 0.45 && pt.v <= 0.99, `${car.id} ${key}.v out of bounds: ${pt.v}`);
      }
      assert.ok(anchors.tireWidthScale > 0 && Number.isFinite(anchors.tireWidthScale));
    }
  }
});

test('computeDistanceFogAlpha smoothly attenuates distant 3D slices without hard pop-in cliffs', () => {
  assert.equal(computeDistanceFogAlpha(20, 104, 152), 1);
  assert.equal(computeDistanceFogAlpha(104, 104, 152), 1);
  const mid = computeDistanceFogAlpha(128, 104, 152);
  assert.ok(Math.abs(mid - 0.5) < 0.001, `Expected 0.5 mid fade, got ${mid}`);
  assert.equal(computeDistanceFogAlpha(152, 104, 152), 0);
  assert.equal(computeDistanceFogAlpha(180, 104, 152), 0);
});





