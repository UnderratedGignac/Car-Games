/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVENTURE_CYCLE_METERS,
  applyAdventureElevationProfile,
  computeAdventureRoadElevation,
  resolveAdventureZone,
  sampleAdventureTerrainElevation,
} from './adventure';
import {
  getChapterTerrainRamps,
  lerpHexColor,
  pickRampColor,
  resolveRealisticTreeSpecies,
  sampleCaveWallProfile,
  smoothTerrainMix,
} from './realisticNature';
import { generateSCurveTrack } from './rules';

test('resolveAdventureZone starts in Forest, crosses Wooden Bridge, enters Caves, and cycles cleanly', () => {
  const start = resolveAdventureZone(0, 0);
  assert.equal(start.zone, 'forest');
  assert.equal(start.caveBlend, 0);
  assert.equal(start.isWoodenBridge, false);

  const bridge = resolveAdventureZone(70, 27);
  assert.equal(bridge.zone, 'forest');
  assert.equal(bridge.isWoodenBridge, true);
  assert.equal(bridge.feature, 'wooden_bridge');
  assert.ok(bridge.bridgeBlend > 0.8);

  const portalIn = resolveAdventureZone(103, 40);
  assert.equal(portalIn.zone, 'cave');
  assert.equal(portalIn.isCavePortalIn, true);
  assert.ok(portalIn.caveBlend >= 0 && portalIn.caveBlend < 1);

  const deepCave = resolveAdventureZone(160, 62);
  assert.equal(deepCave.zone, 'cave');
  assert.equal(deepCave.feature, 'cave_interior');
  assert.equal(deepCave.caveBlend, 1);

  const ruins = resolveAdventureZone(245, 94);
  assert.equal(ruins.zone, 'forest');
  assert.equal(ruins.caveBlend, 0);

  const secondCave = resolveAdventureZone(380, 146);
  assert.equal(secondCave.zone, 'cave');
  assert.equal(secondCave.caveBlend, 1);

  const nextCycle = resolveAdventureZone(ADVENTURE_CYCLE_METERS + 15, 175);
  assert.equal(nextCycle.zone, 'forest');
});

test('sampleAdventureTerrainElevation hugs forest roadside hills and drops into river gorges under bridges', () => {
  const forestZone = resolveAdventureZone(20, 8);
  const forestBank = sampleAdventureTerrainElevation(12, -20, 0, forestZone);
  const forestHill = sampleAdventureTerrainElevation(30, -20, 0, forestZone);
  assert.ok(forestBank > -1.5, `Forest embankment (${forestBank}) hugs close to road level`);
  assert.ok(forestHill > 0.5, `Forest outer hillside (${forestHill}) rises above road level`);

  const bridgeZone = resolveAdventureZone(72, 28);
  const riverUnderBridge = sampleAdventureTerrainElevation(0, -72, -1, bridgeZone);
  assert.ok(riverUnderBridge < -6.5, `River under wooden bridge (${riverUnderBridge}) drops cleanly into chasm`);
});

test('adventure road elevation keeps launchpad flat and forms rollercoaster hills & cave dips', () => {
  const track = generateSCurveTrack(160, 2.6, 101);
  applyAdventureElevationProfile(track, 2.6, 101);

  for (let i = 0; i <= 6; i++) {
    assert.equal(track[i].y, 0);
    assert.equal(track[i].curvature, 0);
  }
  for (let i = 0; i < 12; i++) {
    assert.equal(track[i].curvature, 0);
  }

  const ys = track.slice(12).map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  assert.ok(maxY - minY > 3.5, 'Adventure track should have pronounced climbs and cave/gorge dips');
  assert.equal(computeAdventureRoadElevation(4, 2.6, 101), 0);
});

test('smoothTerrainMix and chapter ramps produce continuous non-checkerboard shading', () => {
  const forest = resolveAdventureZone(20, 8);
  const ramps = getChapterTerrainRamps(forest.chapter);
  assert.equal(ramps.hill.length, 16);
  assert.equal(ramps.bank.length, 16);
  assert.equal(ramps.caveWall.length, 16);
  assert.equal(lerpHexColor('#000000', '#ffffff', 0.5), 'rgb(128, 128, 128)');
  assert.equal(pickRampColor(ramps.hill, 0), ramps.hill[0]);
  assert.equal(pickRampColor(ramps.hill, 1), ramps.hill[15]);

  for (let i = 0; i < 20; i++) {
    const m = smoothTerrainMix(i, 'outerL');
    assert.ok(m >= 0 && m <= 1);
  }
});

test('sampleCaveWallProfile generates asymmetric organic rock ledges and species diversity', () => {
  const left = sampleCaveWallProfile(45, -1);
  const right = sampleCaveWallProfile(45, 1);
  assert.notEqual(left.midOffset, right.midOffset, 'Left and right cave walls should be organically asymmetric');
  assert.ok(left.strataShade >= 0 && left.strataShade <= 1);
  assert.ok(right.wetStreak >= 0 && right.wetStreak <= 1);

  const forest = resolveAdventureZone(20, 8);
  const speciesSet = new Set<number>([
    resolveRealisticTreeSpecies(0, 0.2, forest),
    resolveRealisticTreeSpecies(0, 0.5, forest),
    resolveRealisticTreeSpecies(0, 0.85, forest),
    resolveRealisticTreeSpecies(1, 0.15, forest),
    resolveRealisticTreeSpecies(1, 0.5, forest),
    resolveRealisticTreeSpecies(1, 0.85, forest),
  ]);
  assert.ok(speciesSet.size >= 5, `Expected diverse botanical tree species, got ${speciesSet.size}`);
});

test('cave terrain ramps never collapse to pure black on lit or deep surfaces', () => {
  const crystal = resolveAdventureZone(150, 58);
  const amber = resolveAdventureZone(380, 146);
  for (const ch of [crystal.chapter, amber.chapter]) {
    const ramps = getChapterTerrainRamps(ch);
    for (const group of [ramps.caveWall, ramps.caveWallDeep, ramps.caveCeiling, ramps.caveWallLit, ramps.caveCeilingLit]) {
      for (const col of group) {
        assert.notEqual(col, 'rgb(0, 0, 0)', `Expected non-black cave color for ${ch.id}, got ${col}`);
        const m = col.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        assert.ok(m, `Expected rgb() format, got ${col}`);
        const lum = Number(m[1]) + Number(m[2]) + Number(m[3]);
        assert.ok(lum >= 80, `Expected readable cave luminance >= 80, got ${lum} (${col})`);
      }
    }
  }
});
