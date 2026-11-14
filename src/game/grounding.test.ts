import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HERO_SPRITE_GROUND_V,
  TRAFFIC_SPRITE_GROUND_V,
  getHeroGroundedShadowY,
  getSpriteGroundCenterY,
  getSpriteGroundPlaneY,
  getTrafficGroundedShadowY,
} from './grounding';

test('hero sprite ground plane sits flush on projected road point instead of floating', () => {
  const projY = 520;
  const drawW = 360;
  const drawH = drawW * 0.75; // 270px

  const centerY = getSpriteGroundCenterY(projY, drawH, HERO_SPRITE_GROUND_V);
  const spriteGroundY = getSpriteGroundPlaneY(centerY, drawH, HERO_SPRITE_GROUND_V);

  assert.ok(Math.abs(spriteGroundY - projY) < 1e-6, 'Hero ground plane must equal projY');
  assert.ok(Math.abs(centerY - (projY - drawH * 0.15)) < 1e-6);

  const shadowY = getHeroGroundedShadowY(projY, drawH);
  assert.ok(
    Math.abs(shadowY - spriteGroundY) < drawH * 0.02,
    'External shadow must sit flush under the grounded car with no gap'
  );
});

test('traffic and parked car sprites ground their y=0 plane (v=0.68) directly on projY', () => {
  const projY = 440;
  const drawH = 150;

  const centerY = getSpriteGroundCenterY(projY, drawH, TRAFFIC_SPRITE_GROUND_V);
  const spriteGroundY = getSpriteGroundPlaneY(centerY, drawH, TRAFFIC_SPRITE_GROUND_V);

  assert.ok(Math.abs(spriteGroundY - projY) < 1e-6, 'Traffic/parked ground plane must equal projY');
  assert.ok(Math.abs(centerY - (projY - drawH * 0.18)) < 1e-6);

  // When launched airborne during a crash, crashLiftPx keeps shadow pinned on road below car
  const crashLiftPx = 42;
  const airborneCarProjY = projY - crashLiftPx;
  const airborneShadowY = getTrafficGroundedShadowY(airborneCarProjY, drawH, crashLiftPx);
  const groundedShadowY = getTrafficGroundedShadowY(projY, drawH, 0);
  assert.ok(Math.abs(airborneShadowY - groundedShadowY) < 1e-6);
});

test('rear tire anchor screen Y maps below ground center (closer to camera on road surface)', () => {
  const projY = 540;
  const drawH = 280;
  const centerY = getSpriteGroundCenterY(projY, drawH, HERO_SPRITE_GROUND_V);
  const spriteTop = centerY - drawH * 0.5;
  // Rear tires sit at v ~ 0.75 (behind car center z < 0 -> lower on screen than projY)
  const rearTireScreenY = spriteTop + 0.75 * drawH;
  assert.ok(rearTireScreenY > projY, 'Rear tire screen contact must be below car center projY');
  assert.ok(Math.abs(rearTireScreenY - (projY + 0.10 * drawH)) < 1e-6);
});
