import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEADLIGHTS_STORAGE_KEY,
  computeHeadlightSliceIllumination,
  getHeadlightRgba,
  loadInitialHeadlightsState,
  resolveHeadlightLighting,
  saveHeadlightsState,
  toggleHeadlightsState,
} from './headlights';

test('headlights default to ON when no stored preference exists and persist toggles', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  assert.equal(loadInitialHeadlightsState(null), true);
  assert.equal(loadInitialHeadlightsState(mockStorage), true);

  const off = toggleHeadlightsState(true);
  assert.equal(off, false);
  saveHeadlightsState(off, mockStorage);
  assert.equal(mem.get(HEADLIGHTS_STORAGE_KEY), '0');
  assert.equal(loadInitialHeadlightsState(mockStorage), false);

  const onAgain = toggleHeadlightsState(off);
  assert.equal(onAgain, true);
  saveHeadlightsState(onAgain, mockStorage);
  assert.equal(mem.get(HEADLIGHTS_STORAGE_KEY), '1');
  assert.equal(loadInitialHeadlightsState(mockStorage), true);
});

test('resolveHeadlightLighting yields active reach when ON and zero when OFF (unless flashing)', () => {
  const caveOn = resolveHeadlightLighting({
    headlightsOn: true,
    highBeamTimer: 0,
    caveBlend: 1,
    isNight: false,
  });
  assert.equal(caveOn.beamsActive, true);
  assert.equal(caveOn.isHighBeam, false);
  assert.ok(caveOn.reachMeters >= 75);
  assert.ok(caveOn.tunnelAmbientLift > 0.6);

  const caveOff = resolveHeadlightLighting({
    headlightsOn: false,
    highBeamTimer: 0,
    caveBlend: 1,
    isNight: false,
  });
  assert.equal(caveOff.beamsActive, false);
  assert.equal(caveOff.reachMeters, 0);
  assert.equal(caveOff.strength, 0);
  assert.equal(caveOff.tunnelAmbientLift, 0);

  const caveFlashWhileOff = resolveHeadlightLighting({
    headlightsOn: false,
    highBeamTimer: 0.4,
    caveBlend: 1,
    isNight: false,
  });
  assert.equal(caveFlashWhileOff.beamsActive, true);
  assert.equal(caveFlashWhileOff.isHighBeam, true);
  assert.ok(caveFlashWhileOff.reachMeters > caveOn.reachMeters);
});

test('computeHeadlightSliceIllumination illuminates near/mid cave tunnel only when lights are ON and tapers cleanly with distance', () => {
  const nearOn = computeHeadlightSliceIllumination({
    rawZ: 10,
    headlightsOn: true,
    highBeamActive: false,
    caveBlend: 1,
    isNight: false,
  });
  const midOn = computeHeadlightSliceIllumination({
    rawZ: 38,
    headlightsOn: true,
    highBeamActive: false,
    caveBlend: 1,
    isNight: false,
  });
  const farBeyond = computeHeadlightSliceIllumination({
    rawZ: 95,
    headlightsOn: true,
    highBeamActive: false,
    caveBlend: 1,
    isNight: false,
  });
  const nearOff = computeHeadlightSliceIllumination({
    rawZ: 10,
    headlightsOn: false,
    highBeamActive: false,
    caveBlend: 1,
    isNight: false,
  });

  assert.ok(nearOn.roadIllum > 0.65);
  assert.ok(nearOn.wallIllum > 0.55);
  assert.ok(midOn.roadIllum > 0.25 && midOn.roadIllum < nearOn.roadIllum);
  assert.ok(midOn.wallIllum > 0.18 && midOn.wallIllum < nearOn.wallIllum);
  assert.equal(farBeyond.roadIllum, 0);
  assert.equal(nearOff.roadIllum, 0);
  assert.equal(nearOff.wallIllum, 0);

  const highBeamFar = computeHeadlightSliceIllumination({
    rawZ: 95,
    headlightsOn: true,
    highBeamActive: true,
    caveBlend: 1,
    isNight: false,
  });
  assert.ok(highBeamFar.roadIllum > 0);
});

test('getHeadlightRgba quantizes and caches formatted rgba strings', () => {
  const a = getHeadlightRgba('#fef9c3', 0.25);
  const b = getHeadlightRgba('#fef9c3', 0.251);
  assert.equal(a, 'rgba(254, 249, 195, 0.26)');
  assert.equal(a, b);
});
