import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoise2D } from 'simplex-noise';
import {
  clampByte,
  computeCarbonWeavePixel,
  computeHeightmapNormalRgba,
  computePaddockTileMask,
  computeRadialRotorIntensity,
  computeTreadGrooveMask,
  computeTurntableCollarMask,
  createSeededRng,
  sampleFractalNoise2D,
} from './proceduralTextures';

test('clampByte clamps cleanly into [0, 255]', () => {
  assert.equal(clampByte(-12), 0);
  assert.equal(clampByte(0), 0);
  assert.equal(clampByte(127.6), 128);
  assert.equal(clampByte(300), 255);
});

test('sampleFractalNoise2D is deterministic and stays normalized within [-1, 1]', () => {
  const nA = createNoise2D(createSeededRng(42));
  const nB = createNoise2D(createSeededRng(42));

  const valA = sampleFractalNoise2D(nA, 1.37, 2.91, 3);
  const valB = sampleFractalNoise2D(nB, 1.37, 2.91, 3);

  assert.equal(valA, valB);
  assert.ok(valA >= -1 && valA <= 1, `Expected noise in [-1, 1], got ${valA}`);
});

test('computeCarbonWeavePixel produces repeating alternating warp/weft twill bands', () => {
  const warp = computeCarbonWeavePixel(0, 0);
  const weft = computeCarbonWeavePixel(4, 0);
  assert.ok(warp > weft, 'Warp tow should be brighter than weft shadow');
  assert.equal(computeCarbonWeavePixel(0, 0), computeCarbonWeavePixel(8, 8));
});

test('computeTreadGrooveMask carves center water channels and outer rubber blocks', () => {
  const centerChannel = computeTreadGrooveMask(0.5 + 0.11, 0.25);
  const rubberBlock = computeTreadGrooveMask(0.5, 0.25);
  assert.ok(centerChannel < 0.3);
  assert.equal(rubberBlock, 1.0);
});

test('computeRadialRotorIntensity dims hub and outer rim while preserving braking surface', () => {
  assert.ok(computeRadialRotorIntensity(0.0, 0.0) < 0.3);
  assert.ok(computeRadialRotorIntensity(0.62, 0.0) >= 0.12);
  assert.ok(computeRadialRotorIntensity(0.99, 0.0) < 0.3);
});

test('computePaddockTileMask carves expansion joints and highlights bevel edges', () => {
  const seam = computePaddockTileMask(0.005, 0.5);
  const bevel = computePaddockTileMask(0.03, 0.5);
  const slab = computePaddockTileMask(0.5, 0.5);
  assert.ok(seam < 0.3, 'Expansion seam should be dark');
  assert.ok(bevel > slab, 'Chamfer bevel should catch more light than interior slab');
  assert.equal(computePaddockTileMask(0.5, 0.5), computePaddockTileMask(1.5, 2.5));
});

test('computeTurntableCollarMask highlights radial ring collar and telemetry grooves', () => {
  const groove = computeTurntableCollarMask(0.59);
  const collar = computeTurntableCollarMask(0.83);
  const base = computeTurntableCollarMask(0.35);
  assert.ok(groove < base, 'Inner telemetry groove should be recessed');
  assert.ok(collar > base, 'Outer brushed-metal collar should catch specular highlights');
});

test('computeHeightmapNormalRgba produces neutral +Z normals on flat surfaces and tilted vectors on slopes', () => {
  const flat = new Float32Array(16).fill(0.5);
  const flatRgba = computeHeightmapNormalRgba(flat, 4, 4, 2.0);
  assert.equal(flatRgba.length, 64);
  assert.equal(flatRgba[0], 128);
  assert.equal(flatRgba[1], 128);
  assert.equal(flatRgba[2], 255);
  assert.equal(flatRgba[3], 255);

  const sloped = new Float32Array(16);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      sloped[y * 4 + x] = x / 3;
    }
  }
  const slopedRgba = computeHeightmapNormalRgba(sloped, 4, 4, 2.0);
  // At x=1, hL=0, hR=2/3 => dx < 0 => R < 128 while Z remains positive (> 128)
  const idx = (1 * 4 + 1) * 4;
  assert.ok(slopedRgba[idx] < 120, `Expected tilted X normal < 120, got ${slopedRgba[idx]}`);
  assert.equal(slopedRgba[idx + 1], 128);
  assert.ok(slopedRgba[idx + 2] > 140, `Expected positive Z normal > 140, got ${slopedRgba[idx + 2]}`);
});
