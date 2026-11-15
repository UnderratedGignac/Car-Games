/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

/** Deterministic PRNG (Mulberry32) so procedural textures look identical across sessions. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clampByte(val: number): number {
  if (val <= 0) return 0;
  if (val >= 255) return 255;
  return Math.round(val);
}

/**
 * Multi-octave fractal Brownian motion (fBm) over 2D simplex noise in range [-1, 1].
 */
export function sampleFractalNoise2D(
  noiseFn: NoiseFunction2D,
  x: number,
  y: number,
  octaves = 3,
  persistence = 0.5,
  lacunarity = 2.0
): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    total += noiseFn(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return maxAmplitude > 0 ? total / maxAmplitude : 0;
}

/**
 * Computes a seamless 2x2 twill carbon-fiber weave pixel intensity (0..255).
 */
export function computeCarbonWeavePixel(x: number, y: number): number {
  const cellX = ((x % 8) + 8) % 8;
  const cellY = ((y % 8) + 8) % 8;
  const band = (Math.floor(cellX / 2) + Math.floor(cellY / 2)) % 4;
  const localU = cellX % 2;
  const localV = cellY % 2;

  if (band === 0 || band === 1) {
    // Warp tow highlight
    return localU === 0 ? 54 : 38;
  }
  // Weft tow shadow
  return localV === 0 ? 24 : 14;
}

/**
 * Computes sport tire tread groove depth mask in [0, 1] where 0 = deep groove, 1 = rubber block.
 */
export function computeTreadGrooveMask(u: number, v: number): number {
  const wrappedU = ((u % 1) + 1) % 1;
  const wrappedV = ((v % 1) + 1) % 1;

  // Dual longitudinal water-evacuation channels near center
  const distCenter = Math.abs(wrappedU - 0.5);
  if (distCenter > 0.08 && distCenter < 0.14) return 0.15;

  // Angled directional V-grooves on left and right shoulders
  const sideDist = Math.max(0, distCenter - 0.16);
  const slant = (wrappedV + sideDist * 1.85) % 0.25;
  if (distCenter >= 0.16 && slant < 0.055) return 0.22;

  return 1.0;
}

/**
 * Computes ventilated/slotted brake rotor intensity in [0, 1] given normalized center coords [-1, 1].
 */
export function computeRadialRotorIntensity(dx: number, dy: number): number {
  const r = Math.hypot(dx, dy);
  if (r < 0.34 || r > 0.96) return 0.22;

  const angle = Math.atan2(dy, dx);
  // Subtle concentric lathe brush lines
  const lathe = 0.72 + Math.sin(r * 95) * 0.12;

  // 8 directional cooling slots + cross-drilled holes
  const slotPhase = (((angle / (Math.PI * 2)) * 8 + r * 0.45) % 1 + 1) % 1;
  if (slotPhase < 0.08 && r > 0.45 && r < 0.88) {
    return 0.18;
  }

  // Drilled holes along 3 concentric bands
  const holeRing = Math.abs(((r - 0.44) / 0.44) * 3 % 1 - 0.5);
  const spokeAngle = Math.abs(((angle / (Math.PI * 2)) * 12) % 1 - 0.5);
  if (r > 0.44 && r < 0.88 && holeRing < 0.14 && spokeAngle < 0.14) {
    return 0.12;
  }

  return Math.max(0.1, Math.min(1.0, lathe));
}

/**
 * Computes architectural paddock concrete slab & expansion-joint mask in [0, 1].
 * Seam grooves return low values (~0.22), subtle chamfer edge returns 0.96, slab face returns 0.80.
 */
export function computePaddockTileMask(u: number, v: number): number {
  const wu = ((u % 1) + 1) % 1;
  const wv = ((v % 1) + 1) % 1;
  const edgeU = Math.min(wu, 1 - wu);
  const edgeV = Math.min(wv, 1 - wv);
  const minEdge = Math.min(edgeU, edgeV);

  if (minEdge < 0.022) return 0.22;
  if (minEdge < 0.042) return 0.96;
  return 0.8;
}

/**
 * Computes radial turntable brushed-metal & telemetry groove mask in [0, 1] for rNorm in [0, 1].
 */
export function computeTurntableCollarMask(rNorm: number): number {
  if (rNorm < 0 || rNorm > 1) return 0.35;
  if (Math.abs(rNorm - 0.59) < 0.015) return 0.42;
  if (Math.abs(rNorm - 0.83) < 0.022) return 0.95;
  if (rNorm > 0.965) return 0.3;
  return 0.78;
}

/**
 * Converts a scalar height buffer (values in [0, 1]) into a seamless tangent-space
 * RGBA normal-map byte buffer using wrapped central Sobel-style finite differences.
 */
export function computeHeightmapNormalRgba(
  heights: Float32Array,
  width: number,
  height: number,
  strength = 2.2
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ym = (y - 1 + height) % height;
    const yp = (y + 1) % height;
    for (let x = 0; x < width; x++) {
      const xm = (x - 1 + width) % width;
      const xp = (x + 1) % width;

      const hL = heights[y * width + xm];
      const hR = heights[y * width + xp];
      const hD = heights[ym * width + x];
      const hU = heights[yp * width + x];

      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y * width + x) * 4;
      out[idx] = clampByte((dx * invLen * 0.5 + 0.5) * 255);
      out[idx + 1] = clampByte((dy * invLen * 0.5 + 0.5) * 255);
      out[idx + 2] = clampByte((dz * invLen * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }
  return out;
}

export interface ShowroomTexturePack {
  paintFlakeRoughness: THREE.CanvasTexture;
  paintFlakeNormal: THREE.CanvasTexture;
  carbonAlbedo: THREE.CanvasTexture;
  carbonBump: THREE.CanvasTexture;
  carbonNormal: THREE.CanvasTexture;
  tireBump: THREE.CanvasTexture;
  tireNormal: THREE.CanvasTexture;
  rotorAlbedo: THREE.CanvasTexture;
  rotorBump: THREE.CanvasTexture;
  rotorNormal: THREE.CanvasTexture;
  turntableAlbedo: THREE.CanvasTexture;
  turntableRoughness: THREE.CanvasTexture;
  turntableNormal: THREE.CanvasTexture;
  studioFloorAlbedo: THREE.CanvasTexture;
  studioFloorRoughness: THREE.CanvasTexture;
  studioFloorNormal: THREE.CanvasTexture;
  contactShadowAlpha: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function configureTexture(
  tex: THREE.CanvasTexture,
  options: {
    srgb: boolean;
    repeatX?: number;
    repeatY?: number;
    anisotropy?: number;
  }
): THREE.CanvasTexture {
  if (options.srgb) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (options.repeatX !== undefined && options.repeatY !== undefined) {
    tex.repeat.set(options.repeatX, options.repeatY);
  }
  if (options.anisotropy) {
    tex.anisotropy = options.anisotropy;
  }
  tex.needsUpdate = true;
  return tex;
}

function normalCanvasTexture(
  heights: Float32Array,
  w: number,
  h: number,
  strength: number,
  repeatX: number,
  repeatY: number,
  anisotropy: number
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(w, h);
  const rgba = computeHeightmapNormalRgba(heights, w, h, strength);
  const img = new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h);
  ctx.putImageData(img, 0, 0);
  return configureTexture(new THREE.CanvasTexture(c), {
    srgb: false,
    repeatX,
    repeatY,
    anisotropy,
  });
}

/**
 * Generates a cohesive, high-craft procedural PBR texture suite (albedo, roughness, bump,
 * and tangent-space normal maps) for the 3D Showroom using multi-octave `simplex-noise`.
 */
export function createShowroomTexturePack(maxAnisotropy = 4): ShowroomTexturePack {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));
  const noiseFlake = createNoise2D(createSeededRng(104729));
  const noiseSlate = createNoise2D(createSeededRng(88171));
  const flakeRng = createSeededRng(31337);

  // 1. Metallic Paint Flake Roughness + Clearcoat Micro-Flake Normal (linear data textures)
  const flakeW = 192;
  const [flakeC, flakeCtx] = makeCanvas(flakeW, flakeW);
  const flakeImg = flakeCtx.createImageData(flakeW, flakeW);
  const flakeHeights = new Float32Array(flakeW * flakeW);
  for (let y = 0; y < flakeW; y++) {
    for (let x = 0; x < flakeW; x++) {
      const i = y * flakeW + x;
      const idx = i * 4;
      const micro = noiseFlake(x * 0.9, y * 0.9);
      const sparkle = flakeRng() > 0.72 ? (flakeRng() - 0.5) * 0.45 : 0;
      flakeHeights[i] = 0.5 + micro * 0.18 + sparkle;
      const val = clampByte(50 + micro * 22 + Math.abs(sparkle) * 34);
      flakeImg.data[idx] = val;
      flakeImg.data[idx + 1] = val;
      flakeImg.data[idx + 2] = val;
      flakeImg.data[idx + 3] = 255;
    }
  }
  flakeCtx.putImageData(flakeImg, 0, 0);
  const paintFlakeRoughness = configureTexture(new THREE.CanvasTexture(flakeC), {
    srgb: false,
    repeatX: 7,
    repeatY: 7,
    anisotropy: aniso,
  });
  const paintFlakeNormal = normalCanvasTexture(flakeHeights, flakeW, flakeW, 0.9, 7, 7, aniso);

  // 2. Twill Carbon Fiber Albedo (sRGB) + Bump + Normal (linear)
  const carbSize = 128;
  const [carbAlbC, carbAlbCtx] = makeCanvas(carbSize, carbSize);
  const [carbBmpC, carbBmpCtx] = makeCanvas(carbSize, carbSize);
  const carbAlbImg = carbAlbCtx.createImageData(carbSize, carbSize);
  const carbBmpImg = carbBmpCtx.createImageData(carbSize, carbSize);
  const carbHeights = new Float32Array(carbSize * carbSize);
  for (let y = 0; y < carbSize; y++) {
    for (let x = 0; x < carbSize; x++) {
      const i = y * carbSize + x;
      const idx = i * 4;
      const lum = computeCarbonWeavePixel(x, y);
      carbAlbImg.data[idx] = clampByte(lum * 0.92);
      carbAlbImg.data[idx + 1] = clampByte(lum * 0.96);
      carbAlbImg.data[idx + 2] = clampByte(lum * 1.1);
      carbAlbImg.data[idx + 3] = 255;

      const norm = lum / 54;
      carbHeights[i] = norm;
      const bmp = clampByte(norm * 235);
      carbBmpImg.data[idx] = bmp;
      carbBmpImg.data[idx + 1] = bmp;
      carbBmpImg.data[idx + 2] = bmp;
      carbBmpImg.data[idx + 3] = 255;
    }
  }
  carbAlbCtx.putImageData(carbAlbImg, 0, 0);
  carbBmpCtx.putImageData(carbBmpImg, 0, 0);
  const carbonAlbedo = configureTexture(new THREE.CanvasTexture(carbAlbC), {
    srgb: true,
    repeatX: 10,
    repeatY: 10,
    anisotropy: aniso,
  });
  const carbonBump = configureTexture(new THREE.CanvasTexture(carbBmpC), {
    srgb: false,
    repeatX: 10,
    repeatY: 10,
    anisotropy: aniso,
  });
  const carbonNormal = normalCanvasTexture(carbHeights, carbSize, carbSize, 2.4, 10, 10, aniso);

  // 3. Sport Tire Tread Bump + Normal (linear)
  const tireW = 256;
  const tireH = 128;
  const [tireC, tireCtx] = makeCanvas(tireW, tireH);
  const tireImg = tireCtx.createImageData(tireW, tireH);
  const tireHeights = new Float32Array(tireW * tireH);
  for (let y = 0; y < tireH; y++) {
    for (let x = 0; x < tireW; x++) {
      const i = y * tireW + x;
      const idx = i * 4;
      const mask = computeTreadGrooveMask(x / tireW, y / tireH);
      const rubberGrain = sampleFractalNoise2D(noiseSlate, x * 0.25, y * 0.25, 2) * 0.06;
      const hVal = Math.max(0, Math.min(1, mask * 0.88 + rubberGrain));
      tireHeights[i] = hVal;
      const v = clampByte(hVal * 235);
      tireImg.data[idx] = v;
      tireImg.data[idx + 1] = v;
      tireImg.data[idx + 2] = v;
      tireImg.data[idx + 3] = 255;
    }
  }
  tireCtx.putImageData(tireImg, 0, 0);
  const tireBump = configureTexture(new THREE.CanvasTexture(tireC), {
    srgb: false,
    repeatX: 1,
    repeatY: 8,
    anisotropy: aniso,
  });
  const tireNormal = normalCanvasTexture(tireHeights, tireW, tireH, 3.0, 1, 8, aniso);

  // 4. Cross-Drilled Ventilated Brake Rotor Albedo (sRGB), Bump & Normal (linear)
  const rotSize = 256;
  const [rotAlbC, rotAlbCtx] = makeCanvas(rotSize, rotSize);
  const [rotBmpC, rotBmpCtx] = makeCanvas(rotSize, rotSize);
  const rotAlbImg = rotAlbCtx.createImageData(rotSize, rotSize);
  const rotBmpImg = rotBmpCtx.createImageData(rotSize, rotSize);
  const rotHeights = new Float32Array(rotSize * rotSize);
  for (let y = 0; y < rotSize; y++) {
    for (let x = 0; x < rotSize; x++) {
      const i = y * rotSize + x;
      const idx = i * 4;
      const dx = (x / (rotSize - 1)) * 2 - 1;
      const dy = (y / (rotSize - 1)) * 2 - 1;
      const k = computeRadialRotorIntensity(dx, dy);
      rotHeights[i] = k;
      const base = clampByte(k * 218);
      rotAlbImg.data[idx] = base;
      rotAlbImg.data[idx + 1] = clampByte(base * 1.02);
      rotAlbImg.data[idx + 2] = clampByte(base * 1.08);
      rotAlbImg.data[idx + 3] = 255;

      const bv = clampByte(k * 255);
      rotBmpImg.data[idx] = bv;
      rotBmpImg.data[idx + 1] = bv;
      rotBmpImg.data[idx + 2] = bv;
      rotBmpImg.data[idx + 3] = 255;
    }
  }
  rotAlbCtx.putImageData(rotAlbImg, 0, 0);
  rotBmpCtx.putImageData(rotBmpImg, 0, 0);
  const rotorAlbedo = configureTexture(new THREE.CanvasTexture(rotAlbC), {
    srgb: true,
    anisotropy: aniso,
  });
  const rotorBump = configureTexture(new THREE.CanvasTexture(rotBmpC), {
    srgb: false,
    anisotropy: aniso,
  });
  const rotorNormal = normalCanvasTexture(rotHeights, rotSize, rotSize, 2.8, 1, 1, aniso);

  // 5. Brushed Basalt & Telemetry Turntable Floor (512x512 sRGB Albedo + Linear Roughness + Normal)
  const [ttAlbC, ttAlbCtx] = makeCanvas(512, 512);
  const [ttRoughC, ttRoughCtx] = makeCanvas(512, 512);
  const ttAlbImg = ttAlbCtx.createImageData(512, 512);
  const ttRoughImg = ttRoughCtx.createImageData(512, 512);
  const ttHeights = new Float32Array(512 * 512);

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = y * 512 + x;
      const idx = i * 4;
      const n = sampleFractalNoise2D(noiseSlate, x * 0.045, y * 0.045, 3, 0.55, 2.2);
      const dx = (x - 256) / 256;
      const dy = (y - 256) / 256;
      const dist = Math.hypot(dx, dy);
      const collarMask = computeTurntableCollarMask(dist);
      const radialBrush = Math.sin(dist * 240) * 0.04;
      const radialVignette = Math.max(0.55, 1.05 - dist * 0.42);
      const baseLum = (24 + n * 7) * radialVignette * (0.68 + collarMask * 0.42);

      ttHeights[i] = collarMask * 0.72 + n * 0.1 + radialBrush;

      ttAlbImg.data[idx] = clampByte(baseLum * 0.85);
      ttAlbImg.data[idx + 1] = clampByte(baseLum * 1.02);
      ttAlbImg.data[idx + 2] = clampByte(baseLum * 1.38);
      ttAlbImg.data[idx + 3] = 255;

      const rVal = clampByte(62 + n * 24 + dist * 22 + (1 - collarMask) * 44);
      ttRoughImg.data[idx] = rVal;
      ttRoughImg.data[idx + 1] = rVal;
      ttRoughImg.data[idx + 2] = rVal;
      ttRoughImg.data[idx + 3] = 255;
    }
  }
  ttAlbCtx.putImageData(ttAlbImg, 0, 0);
  ttRoughCtx.putImageData(ttRoughImg, 0, 0);

  // Architectural radial degree ticks & precision pit-bay ring on turntable Albedo
  ttAlbCtx.save();
  ttAlbCtx.translate(256, 256);
  ttAlbCtx.strokeStyle = 'rgba(56, 189, 248, 0.30)';
  ttAlbCtx.lineWidth = 2;
  ttAlbCtx.beginPath();
  ttAlbCtx.arc(0, 0, 212, 0, Math.PI * 2);
  ttAlbCtx.stroke();

  ttAlbCtx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ttAlbCtx.lineWidth = 1.5;
  ttAlbCtx.beginPath();
  ttAlbCtx.arc(0, 0, 152, 0, Math.PI * 2);
  ttAlbCtx.stroke();

  for (let deg = 0; deg < 360; deg += 10) {
    const rad = (deg * Math.PI) / 180;
    const isCardinal = deg % 90 === 0;
    const isMajor = deg % 30 === 0;
    const r0 = isCardinal ? 190 : isMajor ? 198 : 204;
    const r1 = 212;
    ttAlbCtx.strokeStyle = isCardinal
      ? 'rgba(34, 211, 238, 0.65)'
      : isMajor
      ? 'rgba(251, 191, 36, 0.44)'
      : 'rgba(148, 163, 184, 0.26)';
    ttAlbCtx.lineWidth = isCardinal ? 2.5 : isMajor ? 2 : 1;
    ttAlbCtx.beginPath();
    ttAlbCtx.moveTo(Math.cos(rad) * r0, Math.sin(rad) * r0);
    ttAlbCtx.lineTo(Math.cos(rad) * r1, Math.sin(rad) * r1);
    ttAlbCtx.stroke();
  }
  ttAlbCtx.restore();

  const turntableAlbedo = configureTexture(new THREE.CanvasTexture(ttAlbC), {
    srgb: true,
    anisotropy: aniso,
  });
  const turntableRoughness = configureTexture(new THREE.CanvasTexture(ttRoughC), {
    srgb: false,
    anisotropy: aniso,
  });
  const turntableNormal = normalCanvasTexture(ttHeights, 512, 512, 1.8, 1, 1, aniso);

  // 5b. Sealed Studio Concrete Expansion-Joint Paddock Floor (512x512 tiled sRGB Albedo + Roughness + Normal)
  const sfSize = 512;
  const [sfAlbC, sfAlbCtx] = makeCanvas(sfSize, sfSize);
  const [sfRoughC, sfRoughCtx] = makeCanvas(sfSize, sfSize);
  const sfAlbImg = sfAlbCtx.createImageData(sfSize, sfSize);
  const sfRoughImg = sfRoughCtx.createImageData(sfSize, sfSize);
  const sfHeights = new Float32Array(sfSize * sfSize);
  for (let y = 0; y < sfSize; y++) {
    for (let x = 0; x < sfSize; x++) {
      const i = y * sfSize + x;
      const idx = i * 4;
      const tileMask = computePaddockTileMask(x / 256, y / 256);
      const micro = sampleFractalNoise2D(noiseSlate, x * 0.055, y * 0.055, 3, 0.5, 2.0);
      const slabLum = (15 + micro * 4.2) * tileMask;
      sfHeights[i] = tileMask * 0.78 + micro * 0.08;

      sfAlbImg.data[idx] = clampByte(slabLum * 0.8);
      sfAlbImg.data[idx + 1] = clampByte(slabLum * 0.98);
      sfAlbImg.data[idx + 2] = clampByte(slabLum * 1.36);
      sfAlbImg.data[idx + 3] = 255;

      // Grout seams are matte (218), sealed epoxy slab is smooth (~95) to reflect lights cleanly
      const rVal = tileMask < 0.35 ? 218 : clampByte(92 + micro * 20);
      sfRoughImg.data[idx] = rVal;
      sfRoughImg.data[idx + 1] = rVal;
      sfRoughImg.data[idx + 2] = rVal;
      sfRoughImg.data[idx + 3] = 255;
    }
  }
  sfAlbCtx.putImageData(sfAlbImg, 0, 0);
  sfRoughCtx.putImageData(sfRoughImg, 0, 0);

  const studioFloorAlbedo = configureTexture(new THREE.CanvasTexture(sfAlbC), {
    srgb: true,
    repeatX: 16,
    repeatY: 16,
    anisotropy: aniso,
  });
  const studioFloorRoughness = configureTexture(new THREE.CanvasTexture(sfRoughC), {
    srgb: false,
    repeatX: 16,
    repeatY: 16,
    anisotropy: aniso,
  });
  const studioFloorNormal = normalCanvasTexture(sfHeights, sfSize, sfSize, 1.9, 16, 16, aniso);

  // 6. Soft Radial Alpha Disc (white RGB + smooth radial alpha falloff, tintable for AO shadow & neon underglow)
  const [shadC, shadCtx] = makeCanvas(256, 256);
  const shadGrad = shadCtx.createRadialGradient(128, 128, 20, 128, 128, 124);
  shadGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.96)');
  shadGrad.addColorStop(0.46, 'rgba(255, 255, 255, 0.70)');
  shadGrad.addColorStop(0.76, 'rgba(255, 255, 255, 0.24)');
  shadGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  shadCtx.fillStyle = shadGrad;
  shadCtx.fillRect(0, 0, 256, 256);
  const contactShadowAlpha = new THREE.CanvasTexture(shadC);
  contactShadowAlpha.colorSpace = THREE.SRGBColorSpace;
  contactShadowAlpha.needsUpdate = true;

  return {
    paintFlakeRoughness,
    paintFlakeNormal,
    carbonAlbedo,
    carbonBump,
    carbonNormal,
    tireBump,
    tireNormal,
    rotorAlbedo,
    rotorBump,
    rotorNormal,
    turntableAlbedo,
    turntableRoughness,
    turntableNormal,
    studioFloorAlbedo,
    studioFloorRoughness,
    studioFloorNormal,
    contactShadowAlpha,
    dispose: () => {
      paintFlakeRoughness.dispose();
      paintFlakeNormal.dispose();
      carbonAlbedo.dispose();
      carbonBump.dispose();
      carbonNormal.dispose();
      tireBump.dispose();
      tireNormal.dispose();
      rotorAlbedo.dispose();
      rotorBump.dispose();
      rotorNormal.dispose();
      turntableAlbedo.dispose();
      turntableRoughness.dispose();
      turntableNormal.dispose();
      studioFloorAlbedo.dispose();
      studioFloorRoughness.dispose();
      studioFloorNormal.dispose();
      contactShadowAlpha.dispose();
    },
  };
}
