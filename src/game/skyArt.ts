/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RoadBiomeConfig } from './rules';

export type SkyThemeId =
  | 'auto'
  | 'sun_day'
  | 'golden_sunset'
  | 'big_moon'
  | 'red_moon'
  | 'aurora_night';

export type ResolvedSkyId = Exclude<SkyThemeId, 'auto'>;

export interface SkyThemeOption {
  id: SkyThemeId;
  label: string;
  shortLabel: string;
  dotColor: string;
}

export const SKY_THEME_OPTIONS: SkyThemeOption[] = [
  { id: 'auto', label: 'Auto Sky', shortLabel: 'Auto', dotColor: '#fbbf24' },
  { id: 'sun_day', label: 'Radiant Sun', shortLabel: 'Sun', dotColor: '#fef08a' },
  { id: 'golden_sunset', label: 'Anime Sunset', shortLabel: 'Sunset', dotColor: '#f97316' },
  { id: 'big_moon', label: 'Big Moon Night', shortLabel: 'Big Moon', dotColor: '#bae6fd' },
  { id: 'red_moon', label: 'Red Moon Night', shortLabel: 'Red Moon', dotColor: '#ef4444' },
  { id: 'aurora_night', label: 'Aurora Night', shortLabel: 'Aurora', dotColor: '#34d399' },
];

export interface AnimeCloudPalette {
  deepShadow: string;
  midShadow: string;
  body: string;
  rim: string;
  mist: string;
}

export interface SkyAtmosphereConfig {
  id: ResolvedSkyId;
  skyStops: [string, string, string];
  isNight: boolean;
  celestialKind: 'sun' | 'sunset_sun' | 'big_moon' | 'red_moon' | 'aurora_moon';
  celestialRadius: number;
  celestialYRatio: number; // fraction of horizonY
  celestialXRatio: number; // fraction of pxW
  celestialPrimary: string;
  celestialSecondary: string;
  celestialGlow: string;
  celestialInnerGlow: string;
  hasGodRays: boolean;
  hasAurora: boolean;
  hasShootingStars: boolean;
  starTint: string;
  mtnFar: string;
  mtnNear: string;
  horizonGlowColor: string;
  clouds: AnimeCloudPalette;
}

export function resolveSkyAtmosphere(
  skyMode: SkyThemeId,
  biome: RoadBiomeConfig
): SkyAtmosphereConfig {
  if (skyMode === 'auto') {
    if (biome.id === 'canyon') {
      return {
        id: 'golden_sunset',
        skyStops: ['#311068', '#c2410c', '#fed7aa'],
        isNight: false,
        celestialKind: 'sunset_sun',
        celestialRadius: 21,
        celestialYRatio: 0.72,
        celestialXRatio: 0.72,
        celestialPrimary: '#fef08a',
        celestialSecondary: '#fb923c',
        celestialGlow: 'rgba(251, 146, 60, 0.36)',
        celestialInnerGlow: 'rgba(254, 240, 138, 0.52)',
        hasGodRays: true,
        hasAurora: false,
        hasShootingStars: false,
        starTint: '#fef3c7',
        mtnFar: biome.mtnFar,
        mtnNear: biome.mtnNear,
        horizonGlowColor: 'rgba(251, 146, 60, 0.28)',
        clouds: {
          deepShadow: '#6d28d9',
          midShadow: '#be185d',
          body: '#fdba74',
          rim: '#fef08a',
          mist: 'rgba(253, 186, 116, 0.45)',
        },
      };
    }

    if (biome.id === 'neon') {
      return {
        id: 'big_moon',
        skyStops: ['#030712', '#171544', '#3b1d7a'],
        isNight: true,
        celestialKind: 'big_moon',
        celestialRadius: 24,
        celestialYRatio: 0.46,
        celestialXRatio: 0.76,
        celestialPrimary: '#f1f5f9',
        celestialSecondary: '#94a3b8',
        celestialGlow: 'rgba(56, 189, 248, 0.24)',
        celestialInnerGlow: 'rgba(224, 242, 254, 0.42)',
        hasGodRays: false,
        hasAurora: false,
        hasShootingStars: true,
        starTint: '#bae6fd',
        mtnFar: biome.mtnFar,
        mtnNear: biome.mtnNear,
        horizonGlowColor: 'rgba(139, 92, 246, 0.25)',
        clouds: {
          deepShadow: '#1e1b4b',
          midShadow: '#3730a3',
          body: '#6366f1',
          rim: '#a5f3fc',
          mist: 'rgba(99, 102, 241, 0.35)',
        },
      };
    }

    if (biome.id === 'sakura') {
      return {
        id: 'sun_day',
        skyStops: ['#2563eb', '#f472b6', '#fce7f3'],
        isNight: false,
        celestialKind: 'sun',
        celestialRadius: 15,
        celestialYRatio: 0.52,
        celestialXRatio: 0.76,
        celestialPrimary: '#fffbeb',
        celestialSecondary: '#fbcfe8',
        celestialGlow: 'rgba(244, 114, 182, 0.32)',
        celestialInnerGlow: 'rgba(255, 251, 235, 0.55)',
        hasGodRays: true,
        hasAurora: false,
        hasShootingStars: false,
        starTint: '#ffffff',
        mtnFar: biome.mtnFar,
        mtnNear: biome.mtnNear,
        horizonGlowColor: 'rgba(251, 207, 232, 0.3)',
        clouds: {
          deepShadow: '#a78bfa',
          midShadow: '#f9a8d4',
          body: '#fff1f2',
          rim: '#ffffff',
          mist: 'rgba(252, 231, 243, 0.5)',
        },
      };
    }

    // Default Alpine Radiant Anime Day
    return {
      id: 'sun_day',
      skyStops: ['#2276c9', '#67bfe8', '#e8f5ff'],
      isNight: false,
      celestialKind: 'sun',
      celestialRadius: 14,
      celestialYRatio: 0.44,
      celestialXRatio: 0.76,
      celestialPrimary: '#fffef0',
      celestialSecondary: '#fde047',
      celestialGlow: 'rgba(254, 240, 138, 0.30)',
      celestialInnerGlow: 'rgba(255, 255, 245, 0.62)',
      hasGodRays: true,
      hasAurora: false,
      hasShootingStars: false,
      starTint: '#ffffff',
      mtnFar: biome.mtnFar,
      mtnNear: biome.mtnNear,
      horizonGlowColor: 'rgba(224, 242, 254, 0.35)',
      clouds: {
        deepShadow: '#87a8d0',
        midShadow: '#b8d3ee',
        body: '#f4f8ff',
        rim: '#ffffff',
        mist: 'rgba(255, 255, 255, 0.48)',
      },
    };
  }

  switch (skyMode) {
    case 'sun_day':
      return {
        id: 'sun_day',
        skyStops: ['#1d6fd1', '#5dbbe8', '#e6f5ff'],
        isNight: false,
        celestialKind: 'sun',
        celestialRadius: 15,
        celestialYRatio: 0.42,
        celestialXRatio: 0.76,
        celestialPrimary: '#fffef2',
        celestialSecondary: '#fde047',
        celestialGlow: 'rgba(254, 240, 138, 0.34)',
        celestialInnerGlow: 'rgba(255, 255, 250, 0.65)',
        hasGodRays: true,
        hasAurora: false,
        hasShootingStars: false,
        starTint: '#ffffff',
        mtnFar: biome.id === 'canyon' ? '#8b5cf6' : '#85a2c2',
        mtnNear: biome.id === 'canyon' ? '#7c3aed' : '#6584a8',
        horizonGlowColor: 'rgba(224, 242, 254, 0.38)',
        clouds: {
          deepShadow: '#7ca1cc',
          midShadow: '#b0cde9',
          body: '#f6faff',
          rim: '#ffffff',
          mist: 'rgba(255, 255, 255, 0.5)',
        },
      };

    case 'golden_sunset':
      return {
        id: 'golden_sunset',
        skyStops: ['#2e1065', '#db2777', '#fbbf24'],
        isNight: false,
        celestialKind: 'sunset_sun',
        celestialRadius: 23,
        celestialYRatio: 0.70,
        celestialXRatio: 0.70,
        celestialPrimary: '#fef9c3',
        celestialSecondary: '#f97316',
        celestialGlow: 'rgba(251, 146, 60, 0.42)',
        celestialInnerGlow: 'rgba(254, 240, 138, 0.6)',
        hasGodRays: true,
        hasAurora: false,
        hasShootingStars: false,
        starTint: '#fde68a',
        mtnFar: '#581c87',
        mtnNear: '#3b0764',
        horizonGlowColor: 'rgba(251, 191, 36, 0.34)',
        clouds: {
          deepShadow: '#5b21b6',
          midShadow: '#be185d',
          body: '#fdba74',
          rim: '#fef08a',
          mist: 'rgba(253, 186, 116, 0.42)',
        },
      };

    case 'big_moon':
      return {
        id: 'big_moon',
        skyStops: ['#020617', '#0f172a', '#1e293b'],
        isNight: true,
        celestialKind: 'big_moon',
        celestialRadius: 26,
        celestialYRatio: 0.46,
        celestialXRatio: 0.75,
        celestialPrimary: '#f8fafc',
        celestialSecondary: '#94a3b8',
        celestialGlow: 'rgba(125, 211, 252, 0.25)',
        celestialInnerGlow: 'rgba(224, 242, 254, 0.48)',
        hasGodRays: false,
        hasAurora: false,
        hasShootingStars: true,
        starTint: '#e0f2fe',
        mtnFar: '#1e293b',
        mtnNear: '#0f172a',
        horizonGlowColor: 'rgba(56, 189, 248, 0.22)',
        clouds: {
          deepShadow: '#0f172a',
          midShadow: '#1e3a5f',
          body: '#475569',
          rim: '#e0f2fe',
          mist: 'rgba(148, 163, 184, 0.25)',
        },
      };

    case 'red_moon':
      return {
        id: 'red_moon',
        skyStops: ['#070308', '#2a0814', '#5c101b'],
        isNight: true,
        celestialKind: 'red_moon',
        celestialRadius: 29,
        celestialYRatio: 0.48,
        celestialXRatio: 0.74,
        celestialPrimary: '#ef4444',
        celestialSecondary: '#7f1d1d',
        celestialGlow: 'rgba(220, 38, 38, 0.34)',
        celestialInnerGlow: 'rgba(251, 146, 60, 0.45)',
        hasGodRays: false,
        hasAurora: false,
        hasShootingStars: true,
        starTint: '#fecaca',
        mtnFar: '#2c0b16',
        mtnNear: '#16050b',
        horizonGlowColor: 'rgba(239, 68, 68, 0.26)',
        clouds: {
          deepShadow: '#16060d',
          midShadow: '#450a18',
          body: '#7f1d1d',
          rim: '#fca5a5',
          mist: 'rgba(220, 38, 38, 0.26)',
        },
      };

    case 'aurora_night':
      return {
        id: 'aurora_night',
        skyStops: ['#020813', '#091f36', '#0f3847'],
        isNight: true,
        celestialKind: 'aurora_moon',
        celestialRadius: 17,
        celestialYRatio: 0.38,
        celestialXRatio: 0.24,
        celestialPrimary: '#ecfeff',
        celestialSecondary: '#67e8f9',
        celestialGlow: 'rgba(52, 211, 153, 0.24)',
        celestialInnerGlow: 'rgba(165, 243, 252, 0.44)',
        hasGodRays: false,
        hasAurora: true,
        hasShootingStars: true,
        starTint: '#a7f3d0',
        mtnFar: '#102a43',
        mtnNear: '#091a2e',
        horizonGlowColor: 'rgba(52, 211, 153, 0.24)',
        clouds: {
          deepShadow: '#0b192c',
          midShadow: '#164e63',
          body: '#334155',
          rim: '#6ee7b7',
          mist: 'rgba(52, 211, 153, 0.24)',
        },
      };
  }
}

interface CloudPuff {
  ox: number; // normalized -0.5..0.5 of width
  oy: number; // normalized 0..1 of height
  r: number;  // radius in pixels relative to ch
}

// Asymmetric Shinkai-style cumulonimbus cloud silhouettes (tall hero towers + wispy tails)
const ANIME_CLOUD_BLUEPRINTS: {
  w: number;
  h: number;
  baseY: number;
  puffs: CloudPuff[];
}[] = [
  // 0: Tall Hero Anvil Cumulonimbus (left-tower bias)
  {
    w: 112,
    h: 52,
    baseY: 0.78,
    puffs: [
      { ox: -0.34, oy: 0.68, r: 0.22 },
      { ox: -0.22, oy: 0.50, r: 0.30 },
      { ox: -0.10, oy: 0.32, r: 0.34 }, // tall hero summit
      { ox: 0.04, oy: 0.44, r: 0.29 },
      { ox: 0.18, oy: 0.56, r: 0.25 },
      { ox: 0.32, oy: 0.66, r: 0.19 },
      { ox: 0.41, oy: 0.72, r: 0.13 },
    ],
  },
  // 1: Majestic Towering Peak Cloud (right-summit bias)
  {
    w: 124,
    h: 56,
    baseY: 0.78,
    puffs: [
      { ox: -0.40, oy: 0.72, r: 0.13 },
      { ox: -0.28, oy: 0.63, r: 0.21 },
      { ox: -0.14, oy: 0.53, r: 0.26 },
      { ox: 0.02, oy: 0.36, r: 0.35 }, // towering crest
      { ox: 0.16, oy: 0.48, r: 0.30 },
      { ox: 0.30, oy: 0.62, r: 0.22 },
      { ox: 0.40, oy: 0.70, r: 0.14 },
    ],
  },
  // 2: Wide Horizon Stratocumulus Bank
  {
    w: 146,
    h: 36,
    baseY: 0.80,
    puffs: [
      { ox: -0.42, oy: 0.70, r: 0.16 },
      { ox: -0.28, oy: 0.56, r: 0.26 },
      { ox: -0.12, oy: 0.44, r: 0.30 },
      { ox: 0.04, oy: 0.50, r: 0.28 },
      { ox: 0.20, oy: 0.46, r: 0.29 },
      { ox: 0.34, oy: 0.60, r: 0.22 },
      { ox: 0.44, oy: 0.72, r: 0.14 },
    ],
  },
  // 3: Compact Fluffy Anime Puff
  {
    w: 84,
    h: 38,
    baseY: 0.78,
    puffs: [
      { ox: -0.32, oy: 0.68, r: 0.19 },
      { ox: -0.14, oy: 0.46, r: 0.31 },
      { ox: 0.06, oy: 0.42, r: 0.32 },
      { ox: 0.24, oy: 0.58, r: 0.23 },
      { ox: 0.37, oy: 0.70, r: 0.14 },
    ],
  },
  // 4: Swept Wind-Sheared Cirrocumulus
  {
    w: 102,
    h: 34,
    baseY: 0.78,
    puffs: [
      { ox: -0.38, oy: 0.72, r: 0.14 },
      { ox: -0.22, oy: 0.56, r: 0.25 },
      { ox: -0.02, oy: 0.44, r: 0.30 },
      { ox: 0.18, oy: 0.56, r: 0.24 },
      { ox: 0.36, oy: 0.70, r: 0.15 },
    ],
  },
];

export const ANIME_CLOUD_COUNT = ANIME_CLOUD_BLUEPRINTS.length;

/**
 * Pre-renders a sculpted 4-layer cel-shaded anime cloud onto an offscreen canvas.
 */
export function renderAnimeCloudSprite(
  canvas: HTMLCanvasElement,
  variantIndex: number,
  palette: AnimeCloudPalette,
  sunRightBias = true
) {
  const bp = ANIME_CLOUD_BLUEPRINTS[variantIndex % ANIME_CLOUD_BLUEPRINTS.length];
  canvas.width = bp.w;
  canvas.height = bp.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, bp.w, bp.h);
  const cx = bp.w * 0.5;
  const basePxY = Math.round(bp.h * bp.baseY);
  const scaleR = bp.h;

  const fillCloudMass = (
    dx: number,
    dy: number,
    radiusDelta: number,
    clipBottomY: number
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, bp.w, clipBottomY);
    ctx.clip();
    ctx.beginPath();
    for (let i = 0; i < bp.puffs.length; i++) {
      const p = bp.puffs[i];
      const px = Math.round(cx + p.ox * bp.w + dx);
      const py = Math.round(p.oy * bp.h + dy);
      const pr = Math.max(2, Math.round(p.r * scaleR + radiusDelta));
      ctx.moveTo(px + pr, py);
      ctx.arc(px, py, pr, 0, Math.PI * 2);
    }
    // Flat anime cloud floor tucked cleanly inside outer puffs
    const span = Math.round(bp.w * 0.66);
    ctx.rect(Math.round(cx - span * 0.5 + dx), basePxY - 7 + dy, span, 9);
    ctx.fill();
    ctx.restore();
  };

  const lightDir = sunRightBias ? 1 : -1;

  // 1. Soft horizon mist base directly under flat cloud bottom
  ctx.fillStyle = palette.mist;
  ctx.fillRect(Math.round(bp.w * 0.14), basePxY, Math.round(bp.w * 0.72), 2);
  ctx.fillRect(Math.round(bp.w * 0.22), basePxY + 2, Math.round(bp.w * 0.56), 1);

  // 2. Luminous rim highlight back-silhouette (shifted slightly toward light source + up)
  ctx.fillStyle = palette.rim;
  fillCloudMass(lightDir * 1, -2, 1, basePxY);

  // 3. Crisp bright anime cloud body
  ctx.fillStyle = palette.body;
  fillCloudMass(0, 0, 0, basePxY);

  // 4. Sculpted mid-tone shadow along the lower/shaded curvature
  ctx.fillStyle = palette.midShadow;
  fillCloudMass(-lightDir * 2, 4, -2, basePxY);

  // Re-stamp upper inner puffs with body color to carve dramatic Shinkai cel-shaded lobes!
  ctx.fillStyle = palette.body;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, bp.w, basePxY - 5);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i < bp.puffs.length; i++) {
    const p = bp.puffs[i];
    const px = Math.round(cx + p.ox * bp.w + lightDir * 1);
    const py = Math.round(p.oy * bp.h - 2);
    const pr = Math.max(2, Math.round(p.r * scaleR * 0.84));
    ctx.moveTo(px + pr, py);
    ctx.arc(px, py, pr, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();

  // 5. Crisp deep underbelly shadow along the flat bottom shelf (clipped within cloud mass)
  ctx.fillStyle = palette.deepShadow;
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.round(bp.w * 0.14), basePxY - 5, Math.round(bp.w * 0.72), 5);
  ctx.clip();
  fillCloudMass(-lightDir * 1, 5, -1, basePxY);
  ctx.restore();

  // 6. Specular bright top-edge sparkle pixels on tall puff crests
  ctx.fillStyle = palette.rim;
  for (let i = 1; i < bp.puffs.length - 1; i++) {
    const p = bp.puffs[i];
    const px = Math.round(cx + p.ox * bp.w + lightDir * 2);
    const py = Math.round(p.oy * bp.h - p.r * scaleR + 1);
    if (py >= 1 && py < basePxY - 6) {
      ctx.fillRect(px - 3, py, 6, 1);
      ctx.fillRect(px - 1, py - 1, 3, 1);
    }
  }
}

/**
 * Pre-renders the active Sun, Sunset Sun, Big Moon, Red Moon, or Aurora Moon sprite
 * with multi-ring glow, atmospheric bloom, and pixel lunar craters/maria.
 */
export function renderCelestialSprite(
  canvas: HTMLCanvasElement,
  sky: SkyAtmosphereConfig
) {
  const r = sky.celestialRadius;
  const pad = Math.round(r * 1.9);
  const size = (r + pad) * 2;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  const cx = Math.round(size * 0.5);
  const cy = Math.round(size * 0.5);

  // Smooth radial atmospheric bloom halo (zero stepped bullseye rings)
  const haloR = Math.round(r * 2.25);
  const haloGrad = ctx.createRadialGradient(cx, cy, Math.round(r * 0.75), cx, cy, haloR);
  haloGrad.addColorStop(0.0, sky.celestialInnerGlow);
  haloGrad.addColorStop(0.45, sky.celestialGlow);
  haloGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fill();

  if (sky.celestialKind === 'big_moon' || sky.celestialKind === 'red_moon' || sky.celestialKind === 'aurora_moon') {
    const isRed = sky.celestialKind === 'red_moon';
    // Base lunar disc
    ctx.fillStyle = isRed ? '#dc2626' : sky.celestialPrimary;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner clip for natural astronomical lunar maria, craters, and rim lighting
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Soft radial terminator gradient across lunar face
    const grad = ctx.createRadialGradient(
      cx - r * 0.34,
      cy - r * 0.34,
      r * 0.12,
      cx + r * 0.18,
      cy + r * 0.18,
      r * 1.15
    );
    if (isRed) {
      grad.addColorStop(0, '#fecaca');
      grad.addColorStop(0.38, '#ef4444');
      grad.addColorStop(0.78, '#991b1b');
      grad.addColorStop(1, '#450a0a');
    } else if (sky.celestialKind === 'aurora_moon') {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.62, '#cffafe');
      grad.addColorStop(1, '#67e8f9');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.55, '#e2e8f0');
      grad.addColorStop(1, '#94a3b8');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Broad astronomical lunar seas (maria) spread near upper/side limbs (avoiding center cluster)
    const maria: [number, number, number][] = [
      [-0.48, -0.26, 0.25],
      [-0.22, -0.50, 0.22],
      [0.36, -0.34, 0.26],
      [0.52, 0.08, 0.21],
      [-0.38, 0.36, 0.23],
      [0.26, 0.44, 0.20],
    ];
    ctx.fillStyle = isRed
      ? 'rgba(69, 10, 10, 0.28)'
      : 'rgba(100, 116, 139, 0.20)';
    for (const [mx, my, mr] of maria) {
      ctx.beginPath();
      ctx.arc(Math.round(cx + mx * r), Math.round(cy + my * r), Math.max(2, Math.round(mr * r)), 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine astronomical craters with subtle rim glint
    const craters: [number, number, number][] = [
      [-0.14, 0.18, 0.11],
      [0.14, -0.10, 0.09],
      [-0.56, 0.08, 0.08],
      [0.10, 0.62, 0.08],
    ];
    for (const [kx, ky, kr] of craters) {
      const kpx = Math.round(cx + kx * r);
      const kpy = Math.round(cy + ky * r);
      const kpr = Math.max(1.5, Math.round(kr * r));
      ctx.fillStyle = isRed ? 'rgba(69, 10, 10, 0.34)' : 'rgba(71, 85, 105, 0.24)';
      ctx.beginPath();
      ctx.arc(kpx, kpy, kpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isRed ? 'rgba(254, 202, 202, 0.35)' : 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(kpx - kpr + 1, kpy + 1, Math.max(1, kpr), 1);
    }

    // Bright upper-left lunar crescent rim highlight
    ctx.strokeStyle = isRed ? 'rgba(254, 202, 202, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.8, Math.PI * 0.85, Math.PI * 1.85);
    ctx.stroke();

    ctx.restore();
  } else {
    // Anime Sun or Setting Sun
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const sunGrad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    sunGrad.addColorStop(0, sky.celestialPrimary);
    sunGrad.addColorStop(0.7, sky.celestialSecondary);
    sunGrad.addColorStop(1, sky.celestialKind === 'sunset_sun' ? '#dc2626' : sky.celestialSecondary);
    ctx.fillStyle = sunGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Classic anime horizon heat-slice stripes across bottom third of setting sun
    if (sky.celestialKind === 'sunset_sun') {
      ctx.fillStyle = 'rgba(159, 18, 57, 0.42)';
      ctx.fillRect(cx - r, Math.round(cy + r * 0.34), r * 2, 2);
      ctx.fillRect(cx - r, Math.round(cy + r * 0.58), r * 2, 2);
      ctx.fillRect(cx - r, Math.round(cy + r * 0.78), r * 2, 3);
    }
    ctx.restore();

    // Crisp bright solar core flare
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy - Math.round(r * 0.12), Math.max(3, Math.round(r * 0.45)), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders animated dynamic sky atmosphere behind clouds:
 * - Night starfield + Milky Way stardust + Shooting stars
 * - Aurora Borealis curtains (aurora_night)
 * - Diagonal crepuscular Sunbeams (sun_day / golden_sunset)
 */
export function renderDynamicSkyAtmosphere(params: {
  ctx: CanvasRenderingContext2D;
  pxW: number;
  horizonY: number;
  nowMs: number;
  camHeading: number;
  sky: SkyAtmosphereConfig;
  sunScreenX: number;
  sunScreenY: number;
}) {
  const { ctx, pxW, horizonY, nowMs, camHeading, sky, sunScreenX, sunScreenY } = params;
  const headingShift = (camHeading + Math.PI / 2) * 16;

  // 1. Diagonal anime Sunbeams / Crepuscular God-Rays
  if (sky.hasGodRays) {
    ctx.save();
    ctx.globalAlpha = sky.celestialKind === 'sunset_sun' ? 0.14 : 0.10;
    ctx.fillStyle = sky.celestialPrimary;
    const rays = [-0.55, -0.2, 0.18, 0.52];
    for (let i = 0; i < rays.length; i++) {
      const sway = Math.sin(nowMs * 0.00045 + i * 1.7) * 8;
      const spread = rays[i] * pxW * 0.65 + sway;
      ctx.beginPath();
      ctx.moveTo(sunScreenX - 4, sunScreenY);
      ctx.lineTo(sunScreenX + 4, sunScreenY);
      ctx.lineTo(sunScreenX + spread + 28, horizonY + 14);
      ctx.lineTo(sunScreenX + spread - 12, horizonY + 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 2. Night Starfield, Milky Way Dust & Anime Shooting Stars
  if (sky.isNight) {
    // Subtle diagonal Milky Way stardust band
    ctx.fillStyle = sky.id === 'red_moon' ? 'rgba(248, 113, 113, 0.07)' : 'rgba(186, 230, 253, 0.08)';
    for (let m = 0; m < 18; m++) {
      const mx = ((m * 29 - headingShift * 0.5 + pxW * 2) % pxW);
      const my = Math.round(((18 - m) / 18) * (horizonY * 0.86));
      ctx.fillRect(Math.round(mx), my, 10, 4);
    }

    // Multi-size twinkling stars
    for (let st = 0; st < 46; st++) {
      const sx = Math.round(((st * 67 + 19 - headingShift * 0.45 + pxW * 4) % pxW));
      const sy = Math.round(((st * 31 + 7) % Math.max(12, horizonY - 10)));
      const twinkle = Math.sin(nowMs * 0.004 + st * 1.7);
      if (twinkle > -0.35) {
        ctx.fillStyle = st % 3 === 0 ? sky.starTint : '#ffffff';
        const sz = st % 7 === 0 && twinkle > 0.4 ? 2 : 1;
        ctx.fillRect(sx, sy, sz, sz);
        if (st % 13 === 0 && twinkle > 0.55) {
          // 4-point crisp anime star sparkle
          ctx.fillRect(sx - 1, sy, 3, 1);
          ctx.fillRect(sx, sy - 1, 1, 3);
        }
      }
    }

    // Periodic Anime Shooting Stars
    if (sky.hasShootingStars) {
      const cycleMs = 6200;
      const phase = (nowMs % cycleMs) / cycleMs;
      if (phase < 0.16) {
        const t = phase / 0.16;
        const streakIdx = Math.floor(nowMs / cycleMs);
        const startX = ((streakIdx * 83 + 40) % Math.max(80, pxW - 60));
        const startY = 8 + ((streakIdx * 19) % Math.max(20, Math.round(horizonY * 0.4)));
        const curX = startX + t * 56;
        const curY = startY + t * 24;
        ctx.save();
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.92;
        ctx.strokeStyle = sky.id === 'red_moon' ? '#fca5a5' : '#e0f2fe';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX - 18, curY - 7.5);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(curX) - 1, Math.round(curY) - 1, 2, 2);
        ctx.restore();
      }
    }
  }

  // 3. Rippling Aurora Borealis Curtains (Aurora Night)
  if (sky.hasAurora) {
    ctx.save();
    const bands = [
      { yBase: horizonY * 0.34, amp: 9, color: 'rgba(52, 211, 153, 0.22)', rimColor: 'rgba(110, 231, 183, 0.36)', h: 20, speed: 0.0009 },
      { yBase: horizonY * 0.44, amp: 7, color: 'rgba(34, 211, 238, 0.18)', rimColor: 'rgba(103, 232, 249, 0.32)', h: 16, speed: 0.0012 },
      { yBase: horizonY * 0.27, amp: 6, color: 'rgba(168, 85, 247, 0.14)', rimColor: 'rgba(216, 180, 254, 0.26)', h: 14, speed: 0.0007 },
    ];
    const step = 4;
    for (let b = 0; b < bands.length; b++) {
      const band = bands[b];
      for (let x = 0; x < pxW; x += step) {
        const wave =
          Math.sin((x + headingShift * 1.4) * 0.04 + nowMs * band.speed + b * 1.8) * band.amp +
          Math.cos(x * 0.025 - nowMs * 0.0005) * 4;
        const topY = Math.round(band.yBase + wave);
        const colH = band.h + Math.round(Math.sin(x * 0.07 + nowMs * 0.002) * 5);
        ctx.fillStyle = band.color;
        ctx.fillRect(x, topY, step, colH);
        // Bright aurora lower ribbon edge
        ctx.fillStyle = band.rimColor;
        ctx.fillRect(x, topY + colH - 2, step, 2);
      }
    }
    ctx.restore();
  }

  // 4. Soft Horizon Atmospheric Haze
  ctx.fillStyle = sky.horizonGlowColor;
  ctx.fillRect(0, Math.max(0, horizonY - 12), pxW, 18);
}

/**
 * Renders animated mythical soaring dragons, celestial serpents,
 * cosmic sky leviathans, UFOs, and cyber blimps across the sky!
 */
export function renderMythicalDragonsAndSkyAnomalies(params: {
  ctx: CanvasRenderingContext2D;
  pxW: number;
  horizonY: number;
  nowMs: number;
  camHeading: number;
  sky: SkyAtmosphereConfig;
}) {
  const { ctx, pxW, horizonY, nowMs, camHeading, sky } = params;
  if (horizonY <= 15) return;

  ctx.save();

  // -------------------------------------------------------------
  // 1. SOARING MYTHICAL & CYBER DRAGONS (Serpentine Undulation + Flapping Wings)
  // -------------------------------------------------------------
  const dragons = [
    {
      id: 'azure_wyrm',
      periodMs: 24000,
      baseYRatio: 0.28,
      speedPxPerSec: 32,
      bodyColor: '#0ea5e9',
      bellyColor: '#38bdf8',
      crestColor: '#0284c7',
      eyeColor: '#fef08a',
      wingColor: 'rgba(56, 189, 248, 0.45)',
      emberColor: '#38bdf8',
      scale: 1.15,
      dir: 1,
    },
    {
      id: 'crimson_drake',
      periodMs: 31000,
      baseYRatio: 0.42,
      speedPxPerSec: 26,
      bodyColor: '#dc2626',
      bellyColor: '#f97316',
      crestColor: '#991b1b',
      eyeColor: '#67e8f9',
      wingColor: 'rgba(239, 68, 68, 0.45)',
      emberColor: '#f59e0b',
      scale: 0.95,
      dir: -1,
    },
    {
      id: 'golden_celestial',
      periodMs: 38000,
      baseYRatio: 0.18,
      speedPxPerSec: 22,
      bodyColor: '#eab308',
      bellyColor: '#fef08a',
      crestColor: '#ca8a04',
      eyeColor: '#ef4444',
      wingColor: 'rgba(250, 204, 21, 0.50)',
      emberColor: '#fbbf24',
      scale: 1.25,
      dir: 1,
    },
  ];

  for (let d = 0; d < dragons.length; d++) {
    const dragon = dragons[d];
    const loopT = (nowMs * 0.001 * dragon.speedPxPerSec + d * 380) % (pxW + 300);
    const headX = dragon.dir === 1 ? -150 + loopT : pxW + 150 - loopT;
    const baseY = horizonY * dragon.baseYRatio;
    const waveY = Math.sin(nowMs * 0.0022 + d * 2.1) * 12;
    const headY = baseY + waveY;

    // Draw undulating serpentine body segments (12 segments from tail to head)
    const segCount = 12;
    const segSpacing = 7.5 * dragon.scale;
    const flapAngle = Math.sin(nowMs * 0.0065 + d * 1.5); // Wing flap cycle (~1.1 Hz)

    for (let s = segCount; s >= 0; s--) {
      const segLag = s * 0.45;
      const segX = headX - dragon.dir * s * segSpacing;
      const segY = headY + Math.sin(nowMs * 0.003 - segLag) * (9 * dragon.scale);
      const segRad = Math.max(2, Math.round((s === 0 ? 5.5 : s < 4 ? 4.8 : s < 8 ? 3.6 : 2.2) * dragon.scale));

      // Trailing fire/plasma spirit embers from the tail
      if (s >= 9 && Math.random() < 0.6) {
        ctx.fillStyle = dragon.emberColor;
        ctx.globalAlpha = 0.65;
        const emberX = segX - dragon.dir * (Math.random() * 14);
        const emberY = segY + (Math.random() - 0.5) * 8;
        ctx.fillRect(Math.round(emberX), Math.round(emberY), 2, 2);
      }

      // Outer dragon ink border
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(segX, segY, segRad + 1, 0, Math.PI * 2);
      ctx.fill();

      // Dragon body core color
      ctx.fillStyle = s % 2 === 0 ? dragon.bodyColor : dragon.crestColor;
      ctx.beginPath();
      ctx.arc(segX, segY, segRad, 0, Math.PI * 2);
      ctx.fill();

      // Belly highlight on lower segment
      ctx.fillStyle = dragon.bellyColor;
      ctx.fillRect(
        Math.round(segX - segRad * 0.5),
        Math.round(segY + 1),
        Math.max(1, segRad),
        Math.max(1, Math.round(segRad * 0.5))
      );

      // Horned Dragon Head with Glowing Eyes & Whisker Barbels
      if (s === 0) {
        // Dragon Horns
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(segX, segY - segRad);
        ctx.lineTo(segX - dragon.dir * 8 * dragon.scale, segY - segRad - 9 * dragon.scale);
        ctx.stroke();
        ctx.strokeStyle = dragon.bellyColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Piercing Dragon Eye
        const eyeX = segX + dragon.dir * 2.2;
        const eyeY = segY - 1.5;
        ctx.fillStyle = dragon.eyeColor;
        ctx.fillRect(Math.round(eyeX), Math.round(eyeY), 2, 2);

        // Glowing snort / spirit flame breath flare
        ctx.fillStyle = dragon.emberColor;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(Math.round(segX + dragon.dir * (segRad + 3)), Math.round(segY), 3, 2);
      }

      // Pair of Flapping Wyvern Wings on Segments 3 & 4
      if (s === 3) {
        const wingSpan = 22 * dragon.scale;
        const wingLift = flapAngle * 14 * dragon.scale;
        const wingTipX = segX - dragon.dir * 4 * dragon.scale;
        const wingTipY = segY - wingSpan * 0.7 + wingLift;

        // Wing membrane polygon
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = dragon.wingColor;
        ctx.beginPath();
        ctx.moveTo(segX, segY - 2);
        ctx.lineTo(wingTipX, wingTipY);
        ctx.lineTo(wingTipX - dragon.dir * 12 * dragon.scale, wingTipY + 9 * dragon.scale);
        ctx.lineTo(segX - dragon.dir * 10 * dragon.scale, segY + 2);
        ctx.closePath();
        ctx.fill();

        // Crisp wing spars
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(segX, segY - 2);
        ctx.lineTo(wingTipX, wingTipY);
        ctx.lineTo(wingTipX - dragon.dir * 12 * dragon.scale, wingTipY + 9 * dragon.scale);
        ctx.stroke();

        ctx.strokeStyle = dragon.crestColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }

  // -------------------------------------------------------------
  // 2. WEIRD CELESTIAL SKY VISITORS (Cosmic Whale, UFO, Cyber-Blimp)
  // -------------------------------------------------------------
  // A. Flying Cosmic Sky Whale / Leviathan (Majestic, slow, serene)
  const whaleCycle = 54000;
  const whaleT = (nowMs % whaleCycle) / whaleCycle;
  const whaleX = -120 + whaleT * (pxW + 240);
  const whaleY = horizonY * 0.35 + Math.sin(nowMs * 0.0012) * 8;
  if (whaleX > -100 && whaleX < pxW + 100) {
    ctx.globalAlpha = 0.72;
    // Whale body silhouette
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.ellipse(whaleX, whaleY, 32, 11, -0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sky.isNight ? '#1e293b' : '#334155';
    ctx.beginPath();
    ctx.ellipse(whaleX, whaleY, 30, 9.5, -0.04, 0, Math.PI * 2);
    ctx.fill();
    // Bioluminescent ventral grooves & flukes
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(Math.round(whaleX - 16), Math.round(whaleY + 3), 22, 1.5);
    ctx.fillRect(Math.round(whaleX - 12), Math.round(whaleY + 5), 18, 1.5);
    // Fluke fin
    const flukeTailX = whaleX - 32;
    const flukeTailY = whaleY + Math.sin(nowMs * 0.0025) * 5;
    ctx.beginPath();
    ctx.moveTo(whaleX - 26, whaleY);
    ctx.lineTo(flukeTailX - 6, flukeTailY - 8);
    ctx.lineTo(flukeTailX, flukeTailY);
    ctx.lineTo(flukeTailX - 6, flukeTailY + 8);
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();
  }

  // B. Retro-Futuristic Alien Flying Saucer / UFO (Scanning with tractor beam!)
  const ufoCycle = 29000;
  const ufoT = ((nowMs + 12000) % ufoCycle) / ufoCycle;
  const ufoX = pxW + 80 - ufoT * (pxW + 160);
  const ufoY = horizonY * 0.22 + Math.sin(nowMs * 0.0035) * 5;
  if (ufoX > -60 && ufoX < pxW + 60) {
    // Pulsing Conical Tractor Beam scanning down towards horizon
    const beamPulse = (Math.sin(nowMs * 0.008) + 1) * 0.5;
    ctx.globalAlpha = 0.12 + beamPulse * 0.14;
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(ufoX - 5, ufoY + 4);
    ctx.lineTo(ufoX + 5, ufoY + 4);
    ctx.lineTo(ufoX + 28, horizonY);
    ctx.lineTo(ufoX - 28, horizonY);
    ctx.closePath();
    ctx.fill();

    // UFO Cockpit Dome
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(ufoX, ufoY - 2, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(ufoX, ufoY - 2, 5.5, Math.PI, 0);
    ctx.fill();

    // UFO Saucer Disc
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.ellipse(ufoX, ufoY + 1, 16, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(ufoX, ufoY + 1, 14, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Neon Ring Lights
    const ufoLights = 5;
    for (let l = 0; l < ufoLights; l++) {
      const la = (nowMs * 0.006 + (l / ufoLights) * Math.PI * 2) % (Math.PI * 2);
      const lx = ufoX + Math.cos(la) * 11;
      const ly = ufoY + 1 + Math.sin(la) * 2;
      ctx.fillStyle = l % 2 === 0 ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(Math.round(lx) - 1, Math.round(ly) - 1, 2, 2);
    }
  }

  // C. Neon Cyber Blimp with Scrolling LED Ticker
  const blimpCycle = 42000;
  const blimpT = (nowMs % blimpCycle) / blimpCycle;
  const blimpX = -100 + blimpT * (pxW + 200);
  const blimpY = horizonY * 0.16 + Math.sin(nowMs * 0.0009) * 4;
  if (blimpX > -90 && blimpX < pxW + 90) {
    ctx.globalAlpha = 0.88;
    // Hull
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.ellipse(blimpX, blimpY, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(blimpX, blimpY, 24, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Gondola
    ctx.fillStyle = '#090d16';
    ctx.fillRect(Math.round(blimpX - 9), Math.round(blimpY + 7), 18, 5);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(Math.round(blimpX - 8), Math.round(blimpY + 8), 16, 3);
    // Banner with pixel LED dots on blimp
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(Math.round(blimpX - 16), Math.round(blimpY - 2), 32, 4);
    ctx.fillStyle = '#ffffff';
    for (let dot = 0; dot < 7; dot++) {
      ctx.fillRect(Math.round(blimpX - 14 + dot * 4), Math.round(blimpY - 1), 2, 2);
    }
  }

  ctx.restore();
}
