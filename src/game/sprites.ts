/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CarCustomization, CarSpec, DiagonalDirection } from './rules';
import { getPixelCarCanvas } from './pixelSprites';

/**
 * Generates crisp pixel-art car sprite preview textures (`/` right and `\` left)
 * for GarageModal and UI previews so the garage matches the in-game pixel art 1:1.
 */
export function createCarSpriteTexture(
  car: CarSpec,
  dir: DiagonalDirection,
  isFever: boolean,
  isWrecked = false,
  custom?: Partial<CarCustomization>
): THREE.CanvasTexture {
  const pixelSource = getPixelCarCanvas(
    car,
    dir === 'right' ? 1.0 : -1.0,
    isFever,
    isWrecked,
    0,
    custom
  );

  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, 384, 384);
  // Center the 104x78 pixel-art car inside the 384x384 preview canvas at crisp 3.4x nearest-neighbor scale
  const drawW = 354;
  const drawH = 266;
  ctx.drawImage(pixelSource, (384 - drawW) / 2, (384 - drawH) / 2 + 12, drawW, drawH);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createProceduralAsphaltTexture(maxAnisotropy: number): {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const c1 = document.createElement('canvas');
  c1.width = size;
  c1.height = size;
  const ctx1 = c1.getContext('2d')!;
  ctx1.fillStyle = '#475569';
  ctx1.fillRect(0, 0, size, size);

  const c2 = document.createElement('canvas');
  c2.width = size;
  c2.height = size;
  const ctx2 = c2.getContext('2d')!;
  ctx2.fillStyle = '#808080';
  ctx2.fillRect(0, 0, size, size);

  const albedoMap = new THREE.CanvasTexture(c1);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(c2);
  bumpMap.anisotropy = maxAnisotropy;

  return { albedoMap, bumpMap };
}
