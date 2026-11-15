/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getControlSchemeLabel,
  getQuickGuideForMode,
  getSteerTouchHint,
} from './quickGuide';
import type { GameModeId } from './rules';

test('getQuickGuideForMode covers steer, gas, brake, and nitro for every game mode', () => {
  const modes: GameModeId[] = ['drift', 'highway_traffic', 'parking', 'mountain_drive'];
  for (const mode of modes) {
    const guide = getQuickGuideForMode(mode, 'classic');
    assert.equal(guide.mode, mode);
    assert.equal(guide.controls.length, 4);
    assert.deepEqual(
      guide.controls.map((c) => c.id),
      ['steer', 'gas', 'brake', 'nitro']
    );
    for (const item of guide.controls) {
      assert.ok(item.label.length > 0);
      assert.ok(item.keycaps.length >= 2);
      assert.ok(item.summary.length > 15);
      assert.ok(item.touchHint.length > 5);
    }
    assert.ok(guide.shortcuts.length >= 4);
  }
});

test('getQuickGuideForMode adapts mode tactics and nitro/handbrake behavior cleanly', () => {
  const driftGuide = getQuickGuideForMode('drift', 'wheel');
  const highwayGuide = getQuickGuideForMode('highway_traffic', 'swipe');
  const parkingGuide = getQuickGuideForMode('parking', 'classic');
  const mountainGuide = getQuickGuideForMode('mountain_drive', 'classic');

  assert.equal(driftGuide.accentColor, 'amber');
  assert.match(driftGuide.controls[3].summary, /Fever/i);

  assert.equal(highwayGuide.accentColor, 'cyan');
  assert.match(highwayGuide.controls[0].summary, /lanes/i);
  assert.match(highwayGuide.controls[3].proTip, /Flash|Horn/i);

  assert.equal(parkingGuide.accentColor, 'emerald');
  assert.match(parkingGuide.controls[1].summary, /Reverse|\[R\]/i);
  assert.match(parkingGuide.controls[3].label, /Nitro/i);
  assert.match(parkingGuide.controls[3].summary, /Handbrake/i);
  assert.ok(parkingGuide.shortcuts.some((s) => s.keycap === '1·2·3'));

  assert.equal(mountainGuide.accentColor, 'orange');
  assert.match(mountainGuide.controls[3].summary, /Nitro|Ramp|Jump/i);
});

test('control scheme labels and steering touch hints match active scheme', () => {
  assert.equal(getControlSchemeLabel('classic'), 'Classic Touch Buttons');
  assert.equal(getControlSchemeLabel('wheel'), 'Analog Steering Wheel');
  assert.equal(getControlSchemeLabel('swipe'), 'One-Thumb Tap & Swipe');

  assert.match(getSteerTouchHint('wheel', 'drift'), /wheel/i);
  assert.match(getSteerTouchHint('swipe', 'highway_traffic'), /swipe/i);
  assert.match(getSteerTouchHint('classic', 'parking'), /Left \/ Right/i);
  assert.match(getSteerTouchHint('classic', 'mountain_drive'), /Left \/ Right/i);
});
