import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { computeWebGLCameraSyncParams } from './realisticWorldWebGL';

test('computeWebGLCameraSyncParams aligns Three.js camera projection with SceneCanvas projectInto', () => {
  const pxW = 1280;
  const pxH = 720;
  const fovScale = pxH * 0.9;
  const horizonY = Math.round(pxH * 0.35);

  const sync = computeWebGLCameraSyncParams({
    pxW,
    pxH,
    fovScale,
    horizonY,
    shakeX: 0,
    shakeY: 0,
    camWorldX: 10,
    camWorldY: 5,
    camWorldZ: 20,
    fwdX: 0,
    fwdZ: -1,
  });

  assert.ok(sync.fovDeg > 40 && sync.fovDeg < 75, `Unexpected FOV: ${sync.fovDeg}`);
  assert.ok(Math.abs(sync.aspect - 16 / 9) < 1e-6);
  assert.equal(sync.lookAt[0], 10);
  assert.ok(sync.lookAt[1] < 5, 'Camera should pitch downward along -0.068 slope');
  assert.equal(sync.viewOffsetY, pxH * 0.5 - horizonY);

  // Verify a distant horizon point with slope 0.068 above camera projects directly to horizonY
  const cam = new THREE.PerspectiveCamera(sync.fovDeg, sync.aspect, 0.5, 900);
  cam.setViewOffset(pxW, pxH, sync.viewOffsetX, sync.viewOffsetY, pxW, pxH);
  cam.position.set(...sync.camPos);
  cam.lookAt(...sync.lookAt);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();

  const worldHorizonPt = new THREE.Vector3(10, 5 - 100 * 0.068, 20 - 100);
  const ndc = worldHorizonPt.project(cam);
  const screenY = (1 - ndc.y) * 0.5 * pxH;
  assert.ok(Math.abs(screenY - horizonY) < 0.75, `Expected screenY ~ ${horizonY}, got ${screenY}`);
});
