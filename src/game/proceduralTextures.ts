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

export interface ShowroomTexturePack {
  paintFlakeRoughness: THREE.CanvasTexture;
  carbonAlbedo: THREE.CanvasTexture;
  carbonBump: THREE.CanvasTexture;
  tireBump: THREE.CanvasTexture;
  rotorAlbedo: THREE.CanvasTexture;
  rotorBump: THREE.CanvasTexture;
  turntableAlbedo: THREE.CanvasTexture;
  turntableRoughness: THREE.CanvasTexture;
  studioFloorAlbedo: THREE.CanvasTexture;
  studioFloorRoughness: THREE.CanvasTexture;
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

/**
 * Generates a cohesive, high-craft procedural PBR texture suite for the 3D Showroom
 * using multi-octave `simplex-noise` and radial studio graphics.
 */
export function createShowroomTexturePack(maxAnisotropy = 4): ShowroomTexturePack {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));
  const noiseFlake = createNoise2D(createSeededRng(104729));
  const noiseSlate = createNoise2D(createSeededRng(88171));

  // 1. Metallic Paint Flake Roughness (linear data texture)
  const [flakeC, flakeCtx] = makeCanvas(128, 128);
  const flakeImg = flakeCtx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const idx = (y * 128 + x) * 4;
      const micro = noiseFlake(x * 0.85, y * 0.85);
      const val = clampByte(56 + micro * 24);
      flakeImg.data[idx] = val;
      flakeImg.data[idx + 1] = val;
      flakeImg.data[idx + 2] = val;
      flakeImg.data[idx + 3] = 255;
    }
  }
  flakeCtx.putImageData(flakeImg, 0, 0);
  const paintFlakeRoughness = configureTexture(new THREE.CanvasTexture(flakeC), {
    srgb: false,
    repeatX: 6,
    repeatY: 6,
    anisotropy: aniso,
  });

  // 2. Twill Carbon Fiber Albedo (sRGB) + Bump (linear)
  const [carbAlbC, carbAlbCtx] = makeCanvas(64, 64);
  const [carbBmpC, carbBmpCtx] = makeCanvas(64, 64);
  const carbAlbImg = carbAlbCtx.createImageData(64, 64);
  const carbBmpImg = carbBmpCtx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const idx = (y * 64 + x) * 4;
      const lum = computeCarbonWeavePixel(x, y);
      carbAlbImg.data[idx] = clampByte(lum * 0.94);
      carbAlbImg.data[idx + 1] = clampByte(lum * 0.97);
      carbAlbImg.data[idx + 2] = clampByte(lum * 1.08);
      carbAlbImg.data[idx + 3] = 255;

      const bmp = clampByte((lum / 54) * 235);
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
    repeatX: 9,
    repeatY: 9,
    anisotropy: aniso,
  });
  const carbonBump = configureTexture(new THREE.CanvasTexture(carbBmpC), {
    srgb: false,
    repeatX: 9,
    repeatY: 9,
    anisotropy: aniso,
  });

  // 3. Sport Tire Tread Bump (linear)
  const [tireC, tireCtx] = makeCanvas(128, 64);
  const tireImg = tireCtx.createImageData(128, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 128; x++) {
      const idx = (y * 128 + x) * 4;
      const mask = computeTreadGrooveMask(x / 128, y / 64);
      const rubberGrain = sampleFractalNoise2D(noiseSlate, x * 0.35, y * 0.35, 2) * 14;
      const v = clampByte(mask * 215 + rubberGrain);
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
    repeatY: 6,
    anisotropy: aniso,
  });

  // 4. Cross-Drilled Ventilated Brake Rotor Albedo (sRGB) & Bump (linear)
  const [rotAlbC, rotAlbCtx] = makeCanvas(128, 128);
  const [rotBmpC, rotBmpCtx] = makeCanvas(128, 128);
  const rotAlbImg = rotAlbCtx.createImageData(128, 128);
  const rotBmpImg = rotBmpCtx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const idx = (y * 128 + x) * 4;
      const dx = (x / 127) * 2 - 1;
      const dy = (y / 127) * 2 - 1;
      const k = computeRadialRotorIntensity(dx, dy);
      const base = clampByte(k * 210);
      rotAlbImg.data[idx] = base;
      rotAlbImg.data[idx + 1] = clampByte(base * 1.02);
      rotAlbImg.data[idx + 2] = clampByte(base * 1.07);
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

  // 5. Brushed Basalt & Telemetry Turntable Floor (512x512 sRGB Albedo + Linear Roughness)
  const [ttAlbC, ttAlbCtx] = makeCanvas(512, 512);
  const [ttRoughC, ttRoughCtx] = makeCanvas(512, 512);
  const ttAlbImg = ttAlbCtx.createImageData(512, 512);
  const ttRoughImg = ttRoughCtx.createImageData(512, 512);

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      const n = sampleFractalNoise2D(noiseSlate, x * 0.045, y * 0.045, 3, 0.55, 2.2);
      const dx = (x - 256) / 256;
      const dy = (y - 256) / 256;
      const dist = Math.hypot(dx, dy);
      const collarMask = computeTurntableCollarMask(dist);
      const radialVignette = Math.max(0.55, 1.05 - dist * 0.42);
      const baseLum = (22 + n * 7) * radialVignette * (0.68 + collarMask * 0.42);

      ttAlbImg.data[idx] = clampByte(baseLum * 0.85);
      ttAlbImg.data[idx + 1] = clampByte(baseLum * 1.02);
      ttAlbImg.data[idx + 2] = clampByte(baseLum * 1.38);
      ttAlbImg.data[idx + 3] = 255;

      const rVal = clampByte(70 + n * 28 + dist * 24 + (1 - collarMask) * 42);
      ttRoughImg.data[idx] = rVal;
      ttRoughImg.data[idx + 1] = rVal;
      ttRoughImg.data[idx + 2] = rVal;
      ttRoughImg.data[idx + 3] = 255;
    }
  }
  ttAlbCtx.putImageData(ttAlbImg, 0, 0);
  ttRoughCtx.putImageData(ttRoughImg, 0, 0);

  // Subtle architectural radial degree ticks & precision pit-bay ring on turntable Albedo
  ttAlbCtx.save();
  ttAlbCtx.translate(256, 256);
  ttAlbCtx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
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

  // 5b. Sealed Studio Concrete Expansion-Joint Paddock Floor (256x256 tiled sRGB Albedo + Linear Roughness)
  const [sfAlbC, sfAlbCtx] = makeCanvas(256, 256);
  const [sfRoughC, sfRoughCtx] = makeCanvas(256, 256);
  const sfAlbImg = sfAlbCtx.createImageData(256, 256);
  const sfRoughImg = sfRoughCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4;
      const tileMask = computePaddockTileMask(x / 128, y / 128);
      const micro = sampleFractalNoise2D(noiseSlate, x * 0.08, y * 0.08, 3, 0.5, 2.0);
      const slabLum = (14 + micro * 4.5) * tileMask;

      sfAlbImg.data[idx] = clampByte(slabLum * 0.78);
      sfAlbImg.data[idx + 1] = clampByte(slabLum * 0.96);
      sfAlbImg.data[idx + 2] = clampByte(slabLum * 1.38);
      sfAlbImg.data[idx + 3] = 255;

      // Grout seams are rough/matte (210), sealed slab concrete is semi-glossy (~108) to catch neon pillar reflections
      const rVal = tileMask < 0.35 ? 215 : clampByte(108 + micro * 22);
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

  // 6. Soft Radial Alpha Disc (white RGB + smooth radial alpha falloff, tintable for AO shadow & neon underglow)
  const [shadC, shadCtx] = makeCanvas(256, 256);
  const shadGrad = shadCtx.createRadialGradient(128, 128, 20, 128, 128, 124);
  shadGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.94)');
  shadGrad.addColorStop(0.46, 'rgba(255, 255, 255, 0.68)');
  shadGrad.addColorStop(0.76, 'rgba(255, 255, 255, 0.24)');
  shadGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  shadCtx.fillStyle = shadGrad;
  shadCtx.fillRect(0, 0, 256, 256);
  const contactShadowAlpha = new THREE.CanvasTexture(shadC);
  contactShadowAlpha.colorSpace = THREE.SRGBColorSpace;
  contactShadowAlpha.needsUpdate = true;

  return {
    paintFlakeRoughness,
    carbonAlbedo,
    carbonBump,
    tireBump,
    rotorAlbedo,
    rotorBump,
    turntableAlbedo,
    turntableRoughness,
    studioFloorAlbedo,
    studioFloorRoughness,
    contactShadowAlpha,
    dispose: () => {
      paintFlakeRoughness.dispose();
      carbonAlbedo.dispose();
      carbonBump.dispose();
      tireBump.dispose();
      rotorAlbedo.dispose();
      rotorBump.dispose();
      turntableAlbedo.dispose();
      turntableRoughness.dispose();
      studioFloorAlbedo.dispose();
      studioFloorRoughness.dispose();
      contactShadowAlpha.dispose();
    },
  };
}
