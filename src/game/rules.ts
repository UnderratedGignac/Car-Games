/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DiagonalDirection = 'right' | 'left';

export type BodyShapeId =
  | 'coupe'
  | 'truck'
  | 'muscle'
  | 'kei'
  | 'supercar'
  | 'roadster'
  | 'rally'
  | 'gt3'
  | 'wagon'
  | 'interceptor'
  | 'prototype'
  | 'motorcycle'
  | 'cyber_bike'
  | 'van'
  | 'formula'
  | 'semi'
  | 'suv'
  | 'classic';

export type VehicleCategory =
  | 'all'
  | 'tuner'
  | 'super'
  | 'truck'
  | 'motorcycle'
  | 'muscle'
  | 'van'
  | 'formula'
  | 'rally_kei';

export type PaintFinishId =
  | 'stock'
  | 'electric_blue'
  | 'crimson_blaze'
  | 'sakura_pink'
  | 'solar_gold'
  | 'emerald_mint'
  | 'cyber_cyan'
  | 'pearl_white'
  | 'stealth_black'
  | 'hyper_purple'
  | 'acid_green'
  | 'sunset_copper'
  | 'midnight_navy'
  | 'chameleon_violet'
  | 'liquid_chrome'
  | 'carbon_matte'
  | 'matte_khaki'
  | 'nardo_grey';

export type LiveryPatternId =
  | 'stock'
  | 'twin_stripes'
  | 'two_tone'
  | 'side_flash'
  | 'clean'
  | 'police_intercept'
  | 'hazard_chevrons'
  | 'camo_digital'
  | 'flame_decals'
  | 'sponsor_wrap';

export type WingKitId =
  | 'stock'
  | 'lip'
  | 'gt'
  | 'twin'
  | 'active'
  | 'cyber'
  | 'f1_giant'
  | 'roof_spoiler'
  | 'duckbill_retro'
  | 'drag_chute';

export type RimFinishId =
  | 'stock'
  | 'alloy'
  | 'gold'
  | 'neon_cyan'
  | 'crimson'
  | 'matte_black'
  | 'deep_dish_chrome'
  | 'white_rally'
  | 'purple_anodized'
  | 'turbo_fan';

export type UnderglowId =
  | 'none'
  | 'cyan'
  | 'amber'
  | 'pink'
  | 'emerald'
  | 'crimson'
  | 'purple'
  | 'white'
  | 'gold'
  | 'ice_blue';

export type HornTypeId = 'dual' | 'laser' | 'fanfare' | 'melody' | 'train';

export type FlameColorId =
  | 'stock'
  | 'amber'
  | 'nitro_blue'
  | 'plasma_pink'
  | 'emerald'
  | 'hellfire';

export type EngineModId =
  | 'stock'
  | 'twin_turbo'
  | 'supercharged'
  | 'v12_hybrid'
  | 'rotary_brap'
  | 'turbo_diesel_heavy'
  | 'supercharged_v8_hemi'
  | 'quad_turbo_w16'
  | 'electric_tri_motor'
  | 'liter_bike_inline4';

export type RoofModId =
  | 'stock'
  | 'carbon_panel'
  | 'roof_scoop'
  | 'moonroof'
  | 'light_bar'
  | 'vortex_fins'
  | 'siren_strobe'
  | 'heavy_bullbar'
  | 'roof_cargo_box';

export type TireSpecId =
  | 'stock'
  | 'semi_slick'
  | 'whitewall'
  | 'drift_spec'
  | 'rain_groove'
  | 'drag_slick';

export type ExhaustStyleId =
  | 'stock'
  | 'quad_ti'
  | 'side_exit'
  | 'shotgun'
  | 'center_tri'
  | 'hood_exit'
  | 'dual_diesel_stacks'
  | 'under_tail_moto';

export type HoodStyleId =
  | 'stock'
  | 'carbon'
  | 'vented'
  | 'blower'
  | 'clear_bay'
  | 'twin_scoop';

export type WindowTintId =
  | 'stock'
  | 'limo_black'
  | 'chameleon_cyan'
  | 'amber_gold'
  | 'clear_cage';

export type HornStyleId =
  | 'stock'
  | 'jdm_sport'
  | 'air_horn'
  | 'train_bass'
  | 'cyber_chirp'
  | 'truck_air_blast'
  | 'bike_beep';

export type SoundProfileId =
  | 'stock'
  | 'jdm_turbo'
  | 'v8_muscle'
  | 'f1_scream'
  | 'rotary_braap'
  | 'diesel_chug'
  | 'superbike_16k'
  | 'electric_whine';

export type HeadlightKitId =
  | 'stock'
  | 'xenon_ice'
  | 'cyber_cyan'
  | 'gt_gold'
  | 'demon_red';

export interface CarCustomization {
  paint: PaintFinishId;
  livery: LiveryPatternId;
  wing: WingKitId;
  rims: RimFinishId;
  underglow: UnderglowId;
  underglowColor?: string;
  flame: FlameColorId;
  number: string; // '73', '86', '01', '24', '77', '99', '13', '42', '90'
  engine?: EngineModId;
  roof?: RoofModId;
  tires?: TireSpecId;
  exhaust?: ExhaustStyleId;
  hood?: HoodStyleId;
  windows?: WindowTintId;
  horn?: HornStyleId;
  hornType?: 'dual' | 'laser' | 'fanfare' | 'melody' | 'train';
  sound?: SoundProfileId;
  lights?: HeadlightKitId;
}

export const DEFAULT_CUSTOMIZATION: CarCustomization = {
  paint: 'stock',
  livery: 'stock',
  wing: 'stock',
  rims: 'stock',
  underglow: 'none',
  underglowColor: 'none',
  flame: 'stock',
  number: '73',
  engine: 'stock',
  roof: 'stock',
  tires: 'stock',
  exhaust: 'stock',
  hood: 'stock',
  windows: 'stock',
  horn: 'stock',
  hornType: 'dual',
  sound: 'stock',
  lights: 'stock',
};

export const PAINT_OPTIONS: { id: PaintFinishId; label: string; hex: string | null }[] = [
  { id: 'stock', label: 'Factory Paint', hex: null },
  { id: 'electric_blue', label: 'Apex Blue', hex: '#2563eb' },
  { id: 'crimson_blaze', label: 'Crimson Blaze', hex: '#dc2626' },
  { id: 'sakura_pink', label: 'Sakura Pink', hex: '#f472b6' },
  { id: 'solar_gold', label: 'Solar Gold', hex: '#eab308' },
  { id: 'emerald_mint', label: 'Emerald Mint', hex: '#10b981' },
  { id: 'cyber_cyan', label: 'Neon Cyan', hex: '#06b6d4' },
  { id: 'pearl_white', label: 'Pearl White', hex: '#f1f5f9' },
  { id: 'stealth_black', label: 'Stealth Black', hex: '#1e293b' },
  { id: 'hyper_purple', label: 'Hyper Violet', hex: '#7e22ce' },
  { id: 'acid_green', label: 'Acid Lime', hex: '#84cc16' },
  { id: 'sunset_copper', label: 'Sunset Copper', hex: '#c2410c' },
  { id: 'midnight_navy', label: 'Midnight Navy', hex: '#172554' },
  { id: 'chameleon_violet', label: 'Prism Violet', hex: '#a21caf' },
  { id: 'liquid_chrome', label: 'Liquid Chrome', hex: '#e2e8f0' },
  { id: 'carbon_matte', label: 'Forged Carbon', hex: '#14171f' },
  { id: 'matte_khaki', label: 'Tactical Khaki', hex: '#4d5645' },
  { id: 'nardo_grey', label: 'Nardo Grey', hex: '#64748b' },
];

export const LIVERY_OPTIONS: { id: LiveryPatternId; label: string }[] = [
  { id: 'stock', label: 'Factory' },
  { id: 'twin_stripes', label: 'Twin Stripes' },
  { id: 'two_tone', label: 'Two-Tone Roof' },
  { id: 'side_flash', label: 'Side Flash' },
  { id: 'clean', label: 'Clean Debadged' },
  { id: 'police_intercept', label: 'Police Intercept' },
  { id: 'hazard_chevrons', label: 'Hazard Chevrons' },
  { id: 'camo_digital', label: 'Digital Camo' },
  { id: 'flame_decals', label: 'Hot Rod Flames' },
  { id: 'sponsor_wrap', label: 'Pro Sponsor Wrap' },
];

export const WING_OPTIONS: { id: WingKitId; label: string }[] = [
  { id: 'stock', label: 'Factory' },
  { id: 'lip', label: 'Ducktail Lip' },
  { id: 'gt', label: 'GT Wing' },
  { id: 'twin', label: 'Twin Deck' },
  { id: 'active', label: 'Active Aero' },
  { id: 'cyber', label: 'High Swan-Neck' },
  { id: 'f1_giant', label: 'F1 High-Downforce' },
  { id: 'roof_spoiler', label: 'Roof Top Wing' },
  { id: 'duckbill_retro', label: 'Retro Duckbill' },
  { id: 'drag_chute', label: 'Drag Wheelie Bar' },
];

export const RIM_OPTIONS: { id: RimFinishId; label: string; hex: string | null }[] = [
  { id: 'stock', label: 'Factory', hex: null },
  { id: 'alloy', label: 'Forged Silver', hex: '#cbd5e1' },
  { id: 'gold', label: 'Bronze Gold', hex: '#fbbf24' },
  { id: 'neon_cyan', label: 'Electric Teal', hex: '#2dd4bf' },
  { id: 'crimson', label: 'Track Red', hex: '#ef4444' },
  { id: 'matte_black', label: 'Stealth Dark', hex: '#334155' },
  { id: 'deep_dish_chrome', label: 'Deep-Dish Chrome', hex: '#f8fafc' },
  { id: 'white_rally', label: 'Championship White', hex: '#f1f5f9' },
  { id: 'purple_anodized', label: 'Purple Anodized', hex: '#c084fc' },
  { id: 'turbo_fan', label: 'Aerodynamic Turbofan', hex: '#94a3b8' },
];

export interface UnderglowOption {
  id: string;
  label: string;
  color: string;
  cost: number;
  hex?: string | null;
}

export const UNDERGLOW_OPTIONS: UnderglowOption[] = [
  { id: 'none', label: 'None', color: 'transparent', hex: null, cost: 0 },
  { id: '#06b6d4', label: 'Neon Cyan', color: '#06b6d4', hex: '#06b6d4', cost: 500 },
  { id: '#f43f5e', label: 'Crimson Glow', color: '#f43f5e', hex: '#f43f5e', cost: 500 },
  { id: '#10b981', label: 'Acid Emerald', color: '#10b981', hex: '#10b981', cost: 500 },
  { id: '#8b5cf6', label: 'Cyber Violet', color: '#8b5cf6', hex: '#8b5cf6', cost: 750 },
  { id: '#f59e0b', label: 'Solar Amber', color: '#f59e0b', hex: '#f59e0b', cost: 750 },
  { id: '#ec4899', label: 'Tokyo Pink', color: '#ec4899', hex: '#ec4899', cost: 750 },
  { id: 'rainbow', label: 'RGB Rainbow Cycle', color: 'linear-gradient(to right, #06b6d4, #f43f5e, #10b981)', hex: '#06b6d4', cost: 1500 },
];

export const LEGACY_UNDERGLOW_MAP: Record<string, string> = {
  cyan: '#22d3ee',
  amber: '#fbbf24',
  pink: '#f472b6',
  emerald: '#34d399',
  crimson: '#fb7185',
  purple: '#a855f7',
  white: '#f8fafc',
  gold: '#facc15',
  ice_blue: '#38bdf8',
};

/**
 * Calculates smooth cycling RGB hex color across the full 360-degree color wheel.
 * Loops cleanly every 3 seconds (120 degrees/sec).
 */
export function getRainbowCycleColor(timeMs: number = Date.now()): string {
  const hue = ((timeMs % 3000) / 3000) * 360;
  const s = 1.0;
  const l = 0.55;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; b = 0; }
  else if (hue < 120) { r = x; g = c; b = 0; }
  else if (hue < 180) { r = 0; g = c; b = x; }
  else if (hue < 240) { r = 0; g = x; b = c; }
  else if (hue < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Resolves any underglow identifier (ID, hex string, legacy ID, or 'rainbow')
 * into a valid color string or null if disabled.
 */
export function resolveUnderglowColor(
  underglow?: string,
  timeMs: number = Date.now()
): string | null {
  if (!underglow || underglow === 'none' || underglow === 'transparent') {
    return null;
  }
  if (underglow === 'rainbow') {
    return getRainbowCycleColor(timeMs);
  }
  if (underglow.startsWith('#')) {
    return underglow;
  }
  const match = UNDERGLOW_OPTIONS.find((u) => u.id === underglow);
  if (match) {
    if (match.id === 'none') return null;
    if (match.id === 'rainbow') return getRainbowCycleColor(timeMs);
    return match.color.startsWith('#') ? match.color : null;
  }
  const legacy = LEGACY_UNDERGLOW_MAP[underglow];
  if (legacy) return legacy;

  return null;
}

export const FLAME_OPTIONS: { id: FlameColorId; label: string; outer: string | null; core: string | null }[] = [
  { id: 'stock', label: 'Factory', outer: null, core: null },
  { id: 'amber', label: 'Turbo Orange', outer: '#f97316', core: '#fef08a' },
  { id: 'nitro_blue', label: 'Nitro Blue', outer: '#06b6d4', core: '#cffafe' },
  { id: 'plasma_pink', label: 'Plasma Pink', outer: '#ec4899', core: '#fbcfe8' },
  { id: 'emerald', label: 'Toxic Flame', outer: '#10b981', core: '#a7f3d0' },
  { id: 'hellfire', label: 'Boss Crimson', outer: '#ef4444', core: '#fde047' },
];

export const ENGINE_OPTIONS: {
  id: EngineModId;
  label: string;
  speedBonus: number;
  handlingBonus: number;
  feverBonus: number;
  tag: string;
}[] = [
  { id: 'stock', label: 'Factory Block', speedBonus: 0, handlingBonus: 0, feverBonus: 0, tag: 'STD' },
  { id: 'twin_turbo', label: 'Twin-Turbo I6', speedBonus: 1.6, handlingBonus: 0.05, feverBonus: 0.12, tag: '+TOP SPD' },
  { id: 'supercharged', label: 'Supercharged V8', speedBonus: 1.3, handlingBonus: -0.02, feverBonus: 0.18, tag: '+TORQUE' },
  { id: 'v12_hybrid', label: 'V12 KERS Hybrid', speedBonus: 2.2, handlingBonus: 0.08, feverBonus: 0.25, tag: '+FEVER' },
  { id: 'rotary_brap', label: 'Ported 4-Rotor', speedBonus: 1.1, handlingBonus: 0.22, feverBonus: 0.20, tag: '+AGILITY' },
  { id: 'turbo_diesel_heavy', label: 'Heavy Turbo Diesel', speedBonus: 1.8, handlingBonus: -0.06, feverBonus: 0.30, tag: '+HAUL' },
  { id: 'supercharged_v8_hemi', label: '6.2L Blown Hemi', speedBonus: 2.4, handlingBonus: -0.04, feverBonus: 0.28, tag: '+HELLFIRE' },
  { id: 'quad_turbo_w16', label: '8.0L Quad-Turbo W16', speedBonus: 3.2, handlingBonus: 0.06, feverBonus: 0.35, tag: '+WARP' },
  { id: 'electric_tri_motor', label: 'Tri-Motor Electric', speedBonus: 2.0, handlingBonus: 0.16, feverBonus: 0.32, tag: '+INSTANT' },
  { id: 'liter_bike_inline4', label: '1000cc 16,000RPM I4', speedBonus: 1.5, handlingBonus: 0.25, feverBonus: 0.22, tag: '+HIGH-REV' },
];

export const ROOF_OPTIONS: { id: RoofModId; label: string }[] = [
  { id: 'stock', label: 'Factory' },
  { id: 'carbon_panel', label: 'Carbon Weave' },
  { id: 'roof_scoop', label: 'Rally Scoop' },
  { id: 'moonroof', label: 'Glass Sunroof' },
  { id: 'light_bar', label: 'LED Lightbar' },
  { id: 'vortex_fins', label: 'Vortex Fins' },
  { id: 'siren_strobe', label: 'Police Strobe Bar' },
  { id: 'heavy_bullbar', label: 'Heavy Overload Rack' },
  { id: 'roof_cargo_box', label: 'Aerodynamic Travel Box' },
];

export const TIRE_OPTIONS: {
  id: TireSpecId;
  label: string;
  gripDelta: number;
  speedDelta: number;
  stripeHex: string | null;
}[] = [
  { id: 'stock', label: 'Street Radial', gripDelta: 0, speedDelta: 0, stripeHex: null },
  { id: 'semi_slick', label: 'Track Semi-Slick', gripDelta: 0.04, speedDelta: 0.4, stripeHex: '#f59e0b' },
  { id: 'whitewall', label: 'Retro Whitewall', gripDelta: 0.01, speedDelta: 0.1, stripeHex: '#f8fafc' },
  { id: 'drift_spec', label: 'Drift Compound', gripDelta: -0.04, speedDelta: 0.2, stripeHex: '#f472b6' },
  { id: 'rain_groove', label: 'Aqua Neon Tread', gripDelta: 0.03, speedDelta: 0.2, stripeHex: '#22d3ee' },
  { id: 'drag_slick', label: 'Fat Drag Slicks', gripDelta: 0.05, speedDelta: 0.8, stripeHex: '#ef4444' },
];

export const EXHAUST_OPTIONS: { id: ExhaustStyleId; label: string }[] = [
  { id: 'stock', label: 'Dual Street' },
  { id: 'quad_ti', label: 'Quad Burnt-Ti' },
  { id: 'side_exit', label: 'Side Flank Pipes' },
  { id: 'shotgun', label: 'Shotgun Blast' },
  { id: 'center_tri', label: 'Center Tri-Tip' },
  { id: 'hood_exit', label: 'Hood Exit Flames' },
  { id: 'dual_diesel_stacks', label: 'Dual Vertical Stacks' },
  { id: 'under_tail_moto', label: 'Under-Tail Moto Pipe' },
];

export const HOOD_OPTIONS: { id: HoodStyleId; label: string }[] = [
  { id: 'stock', label: 'Factory' },
  { id: 'carbon', label: 'Forged Carbon' },
  { id: 'vented', label: 'GT Heat Louvers' },
  { id: 'blower', label: 'Chrome Blower' },
  { id: 'clear_bay', label: 'Clear Engine Bay' },
  { id: 'twin_scoop', label: 'Twin NACA Scoops' },
];

export const WINDOW_OPTIONS: {
  id: WindowTintId;
  label: string;
  darkHex: string;
  midHex: string;
  specHex: string;
}[] = [
  { id: 'stock', label: 'Factory Tint', darkHex: '#172334', midHex: '#2d5466', specHex: '#bae6fd' },
  { id: 'limo_black', label: 'Limo Obsidian', darkHex: '#070a10', midHex: '#111827', specHex: '#64748b' },
  { id: 'chameleon_cyan', label: 'Cyan Chameleon', darkHex: '#0c4a6e', midHex: '#0891b2', specHex: '#67e8f9' },
  { id: 'amber_gold', label: 'Solar Iridium', darkHex: '#451a03', midHex: '#92400e', specHex: '#fde047' },
  { id: 'clear_cage', label: 'Clear + Roll Cage', darkHex: '#1e293b', midHex: '#3b82f6', specHex: '#e0f2fe' },
];

export interface HornOption {
  id: HornTypeId;
  label: string;
  icon: string;
  cost: number;
}

export const HORN_OPTIONS: HornOption[] = [
  { id: 'dual', label: 'Classic Euro Dual-Tone', icon: '📢', cost: 0 },
  { id: 'laser', label: 'Arcade Sci-Fi Laser', icon: '⚡', cost: 500 },
  { id: 'fanfare', label: 'Trophy Fanfare', icon: '🎺', cost: 800 },
  { id: 'melody', label: 'Chiptune Drift Melody', icon: '🎶', cost: 1000 },
  { id: 'train', label: 'Hyperion Super Airhorn', icon: '🚂', cost: 1200 },
];

export const LEGACY_HORN_MAP: Record<string, HornTypeId> = {
  stock: 'dual',
  jdm_sport: 'melody',
  air_horn: 'train',
  train_bass: 'train',
  cyber_chirp: 'laser',
  truck_air_blast: 'train',
  bike_beep: 'laser',
};

export const SOUND_OPTIONS: { id: SoundProfileId; label: string }[] = [
  { id: 'stock', label: 'Balanced Coupe' },
  { id: 'jdm_turbo', label: 'Turbo Blow-Off' },
  { id: 'v8_muscle', label: 'Thundering V8' },
  { id: 'f1_scream', label: 'V12 High-Rev' },
  { id: 'rotary_braap', label: 'Rotary Braap' },
  { id: 'diesel_chug', label: 'Heavy Turbo Diesel' },
  { id: 'superbike_16k', label: '16,000 RPM Superbike' },
  { id: 'electric_whine', label: 'High-Torque EV Whine' },
];

export const HEADLIGHT_OPTIONS: {
  id: HeadlightKitId;
  label: string;
  lensHex: string;
  beamHex: string;
}[] = [
  { id: 'stock', label: 'Halogen Warm', lensHex: '#fef3c7', beamHex: '#fde68a' },
  { id: 'xenon_ice', label: 'Xenon Ice', lensHex: '#e0f2fe', beamHex: '#bae6fd' },
  { id: 'cyber_cyan', label: 'Cyber Matrix', lensHex: '#a5f3fc', beamHex: '#22d3ee' },
  { id: 'gt_gold', label: 'Endurance Yellow', lensHex: '#fef08a', beamHex: '#facc15' },
  { id: 'demon_red', label: 'Apex Crimson', lensHex: '#fecaca', beamHex: '#fb7185' },
];

export const NUMBER_OPTIONS = ['73', '86', '01', '24', '77', '99', '13', '42', '90'] as const;

export interface CarSpec {
  id: string;
  tier: number;
  name: string;
  codename: string;
  tagline: string;
  unlockCost: number;
  baseSpeed: number;     // units per second along track
  driftGrip: number;     // 0.6..1.0 drift lateral friction & slip retention
  handling: number;      // 0.6..1.0 steering agility & turn rate
  coinMultiplier: number;
  feverGainRate: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  tailGlowColor: string;
  spoilerStyle: WingKitId;
  bodyShape?: BodyShapeId;
  hoodFeature?: 'stripes' | 'carbon' | 'supercharger' | 'fog_lights' | 'neon_slits' | 'boss_scoop' | 'sakura' | 'vented';
  decalText?: string;
  cardImage?: string;
  category?: VehicleCategory;
}

export function getCarCategory(car: CarSpec): VehicleCategory {
  if (car.category) return car.category;
  const s = car.bodyShape;
  if (s === 'motorcycle' || s === 'cyber_bike') return 'motorcycle';
  if (s === 'truck' || s === 'semi' || s === 'suv') return 'truck';
  if (s === 'supercar' || s === 'prototype' || s === 'gt3') return 'super';
  if (s === 'muscle' || s === 'classic' || s === 'roadster') return 'muscle';
  if (s === 'van' || s === 'wagon') return 'van';
  if (s === 'formula') return 'formula';
  if (s === 'rally' || s === 'kei') return 'rally_kei';
  return 'tuner';
}

export interface CarUpgradeLevels {
  speed: number;    // 1..5
  handling: number; // 1..5
  magnet: number;   // 1..5
}

/**
 * 90 Distinct Playable Vehicles (Progressive Tiers T1 -> T90):
 * Tuners, Supercars, Trucks, Big Rigs, Motorcycles, Cyberbikes, Formula, Vans & Wagons!
 */
export const CAR_ROSTER: CarSpec[] = [
  {
    "id": "blue_jdm",
    "tier": 1,
    "name": "Blue JDM Coupe",
    "codename": "STARTER BALANCED · #73 RACER",
    "tagline": "Metallic blue coupe with twin white racing stripes, GT rear wing, and classic #73 racing decals.",
    "unlockCost": 0,
    "baseSpeed": 22,
    "driftGrip": 0.8,
    "handling": 0.85,
    "coinMultiplier": 1,
    "feverGainRate": 1,
    "primaryColor": "#2563eb",
    "secondaryColor": "#1e293b",
    "accentColor": "#ffffff",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "gt",
    "bodyShape": "coupe",
    "hoodFeature": "stripes",
    "decalText": "73"
  },
  {
    "id": "crimson_tuner",
    "tier": 2,
    "name": "Crimson Street Tuner",
    "codename": "AGILE DRIFTER · TOUGE WEAPON",
    "tagline": "Glossy red body with matte black carbon hood, aggressive widebody fenders, and gold forged rims.",
    "unlockCost": 180,
    "baseSpeed": 23.8,
    "driftGrip": 0.74,
    "handling": 0.96,
    "coinMultiplier": 1.25,
    "feverGainRate": 1.2,
    "primaryColor": "#dc2626",
    "secondaryColor": "#171717",
    "accentColor": "#fbbf24",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "gt",
    "bodyShape": "coupe",
    "hoodFeature": "carbon"
  },
  {
    "id": "emerald_truck",
    "tier": 3,
    "name": "Emerald Drift Truck",
    "codename": "SLAMMED UTE · ROLL-BAR SLIDER",
    "tagline": "Slammed emerald street pickup with wide rear arches, tubular bed roll bar, and tail-happy weight balance.",
    "unlockCost": 360,
    "baseSpeed": 25,
    "driftGrip": 0.72,
    "handling": 0.88,
    "coinMultiplier": 1.4,
    "feverGainRate": 1.3,
    "primaryColor": "#10b981",
    "secondaryColor": "#064e3b",
    "accentColor": "#a7f3d0",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "stripes"
  },
  {
    "id": "midnight_muscle",
    "tier": 4,
    "name": "Midnight Purple Muscle",
    "codename": "HEAVY POWER · V8 SUPERCHARGED",
    "tagline": "Deep matte purple powerhouse with an exposed chrome supercharger scoop and massive rear contact patch.",
    "unlockCost": 580,
    "baseSpeed": 26.8,
    "driftGrip": 0.69,
    "handling": 0.78,
    "coinMultiplier": 1.55,
    "feverGainRate": 1.4,
    "primaryColor": "#7c3aed",
    "secondaryColor": "#090d16",
    "accentColor": "#c084fc",
    "tailGlowColor": "#ec4899",
    "spoilerStyle": "twin",
    "bodyShape": "muscle",
    "hoodFeature": "supercharger"
  },
  {
    "id": "sakura_silvia",
    "tier": 5,
    "name": "Sakura Pink Silvia",
    "codename": "D1 SHOWSTOPPER · NEON DRIFT",
    "tagline": "Cherry-blossom pink and pearl white two-tone drift weapon with tall swan-neck aero and sakura flare.",
    "unlockCost": 850,
    "baseSpeed": 27.6,
    "driftGrip": 0.79,
    "handling": 0.98,
    "coinMultiplier": 1.75,
    "feverGainRate": 1.55,
    "primaryColor": "#f472b6",
    "secondaryColor": "#fdf2f8",
    "accentColor": "#fbcfe8",
    "tailGlowColor": "#fb7185",
    "spoilerStyle": "cyber",
    "bodyShape": "coupe",
    "hoodFeature": "sakura",
    "decalText": "86"
  },
  {
    "id": "yellow_kei",
    "tier": 6,
    "name": "Sunburst Yellow Kei-Racer",
    "codename": "TIGHT CORNERING · RALLY APEX",
    "tagline": "Featherweight compact yellow hatch with high-contrast black roof, wide rally fog lights, and razor turn-in.",
    "unlockCost": 1150,
    "baseSpeed": 26.4,
    "driftGrip": 0.89,
    "handling": 1,
    "coinMultiplier": 1.95,
    "feverGainRate": 1.65,
    "primaryColor": "#eab308",
    "secondaryColor": "#0f172a",
    "accentColor": "#fef08a",
    "tailGlowColor": "#f97316",
    "spoilerStyle": "lip",
    "bodyShape": "kei",
    "hoodFeature": "fog_lights"
  },
  {
    "id": "rally_legend",
    "tier": 7,
    "name": "Azure Classic Rally",
    "codename": "GROUP-B ICON · QUAD-POD TURBO",
    "tagline": "Box-fender sapphire 90s rally legend with gold livery accents, quad bumper rally pods, and planted grip.",
    "unlockCost": 1500,
    "baseSpeed": 28.4,
    "driftGrip": 0.91,
    "handling": 0.94,
    "coinMultiplier": 2.15,
    "feverGainRate": 1.75,
    "primaryColor": "#1d4ed8",
    "secondaryColor": "#1e293b",
    "accentColor": "#fbbf24",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "twin",
    "bodyShape": "rally",
    "hoodFeature": "fog_lights",
    "decalText": "01"
  },
  {
    "id": "cyber_supercar",
    "tier": 8,
    "name": "Cyber White & Teal Supercar",
    "codename": "ENDGAME PRO · AERO V10 HYBRID",
    "tagline": "Sleek pearl-white aerodynamic body with vibrant neon teal underglow and high-downforce active aero wing.",
    "unlockCost": 1950,
    "baseSpeed": 29.8,
    "driftGrip": 0.9,
    "handling": 0.94,
    "coinMultiplier": 2.4,
    "feverGainRate": 1.9,
    "primaryColor": "#f8fafc",
    "secondaryColor": "#042f2e",
    "accentColor": "#14b8a6",
    "tailGlowColor": "#06b6d4",
    "spoilerStyle": "active",
    "bodyShape": "supercar",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "solar_hypercar",
    "tier": 9,
    "name": "Solar Gold Hypercar",
    "codename": "APEX PROTOTYPE · CARBON V12",
    "tagline": "Shimmering solar-gold mid-engine prototype with dorsal shark-fin, forged carbon vents, and extreme speed.",
    "unlockCost": 2500,
    "baseSpeed": 31.2,
    "driftGrip": 0.88,
    "handling": 0.96,
    "coinMultiplier": 2.75,
    "feverGainRate": 2.05,
    "primaryColor": "#f59e0b",
    "secondaryColor": "#18181b",
    "accentColor": "#fef08a",
    "tailGlowColor": "#f97316",
    "spoilerStyle": "cyber",
    "bodyShape": "supercar",
    "hoodFeature": "carbon"
  },
  {
    "id": "matte_boss",
    "tier": 10,
    "name": "Matte Black Boss Roadster",
    "codename": "DRIFT KING · STEALTH OVERLORD",
    "tagline": "Stealth satin black convertible roadster with blood-red aero trim and roaring twin flame-throwing exhausts.",
    "unlockCost": 3200,
    "baseSpeed": 32.5,
    "driftGrip": 0.86,
    "handling": 0.97,
    "coinMultiplier": 3.2,
    "feverGainRate": 2.3,
    "primaryColor": "#18181b",
    "secondaryColor": "#450a0a",
    "accentColor": "#ef4444",
    "tailGlowColor": "#dc2626",
    "spoilerStyle": "cyber",
    "bodyShape": "roadster",
    "hoodFeature": "boss_scoop"
  },
  {
    "id": "cobalt_gt3",
    "tier": 11,
    "name": "Cobalt GT3 Endurance",
    "codename": "WIDEBODY GT3 · CANARD AERO",
    "tagline": "Track-homologated cobalt GT3 coupe with neon-lime dive planes, roof airbox, and swan-neck wing.",
    "unlockCost": 3900,
    "baseSpeed": 33.4,
    "driftGrip": 0.92,
    "handling": 0.96,
    "coinMultiplier": 3.4,
    "feverGainRate": 2.35,
    "primaryColor": "#0284c7",
    "secondaryColor": "#0f172a",
    "accentColor": "#a3e635",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "gt3",
    "hoodFeature": "carbon",
    "decalText": "24"
  },
  {
    "id": "crimson_wagon",
    "tier": 12,
    "name": "Touge Drift Wagon",
    "codename": "SHOOTING BRAKE · LONG-ROOF SLIDER",
    "tagline": "Extended-roof metallic burgundy drift wagon with wide touring flares, side exhausts, and long-arc stability.",
    "unlockCost": 4600,
    "baseSpeed": 33.8,
    "driftGrip": 0.85,
    "handling": 0.95,
    "coinMultiplier": 3.6,
    "feverGainRate": 2.45,
    "primaryColor": "#be123c",
    "secondaryColor": "#18181b",
    "accentColor": "#fde047",
    "tailGlowColor": "#fb7185",
    "spoilerStyle": "twin",
    "bodyShape": "wagon",
    "hoodFeature": "stripes",
    "decalText": "77"
  },
  {
    "id": "neon_interceptor",
    "tier": 13,
    "name": "Midnight Interceptor",
    "codename": "HIGHWAY PURSUIT · TWIN-TURBO",
    "tagline": "Gunmetal midnight pursuit interceptor with tactical roof lightbar, xenon matrix optics, and quad titanium tips.",
    "unlockCost": 5400,
    "baseSpeed": 34.8,
    "driftGrip": 0.9,
    "handling": 0.98,
    "coinMultiplier": 3.9,
    "feverGainRate": 2.6,
    "primaryColor": "#334155",
    "secondaryColor": "#020617",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#22d3ee",
    "spoilerStyle": "active",
    "bodyShape": "interceptor",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "apex_valkyrie",
    "tier": 14,
    "name": "Apex Carbon Valkyrie",
    "codename": "LE MANS PROTOTYPE · V12 HYPER",
    "tagline": "Obsidian carbon endurance prototype with rose-gold aero blades, exposed engine bay, and center tri-exhaust.",
    "unlockCost": 6500,
    "baseSpeed": 36.2,
    "driftGrip": 0.93,
    "handling": 1,
    "coinMultiplier": 4.4,
    "feverGainRate": 2.85,
    "primaryColor": "#1e1b4b",
    "secondaryColor": "#09090b",
    "accentColor": "#fb7185",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "cyber",
    "bodyShape": "prototype",
    "hoodFeature": "boss_scoop",
    "decalText": "99"
  },
  {
    "id": "hayabusa_ghost",
    "tier": 15,
    "name": "Hayabusa Ghost 1300",
    "codename": "SUPERBIKE · HYPER-VELOCITY INLINE-4",
    "tagline": "Pearl white aerodynamic hypersport motorcycle with deep violet wheels, sleek clip-on bars, and blistering 300+ km/h top-end.",
    "unlockCost": 7200,
    "baseSpeed": 35.5,
    "driftGrip": 0.72,
    "handling": 1.02,
    "coinMultiplier": 4,
    "feverGainRate": 2.7,
    "primaryColor": "#f8fafc",
    "secondaryColor": "#581c87",
    "accentColor": "#a855f7",
    "tailGlowColor": "#c084fc",
    "spoilerStyle": "lip",
    "bodyShape": "motorcycle",
    "hoodFeature": "neon_slits",
    "decalText": "13"
  },
  {
    "id": "neo_tokyo_kaneda",
    "tier": 16,
    "name": "Neo-Tokyo Cyberbike",
    "codename": "ANIME LEGEND · RECLINED POWER SLIDER",
    "tagline": "Iconic glossy scarlet recumbent cyber-cruiser with hubless glowing rims, twin ceramic battery drives, and low-slung slide dynamics.",
    "unlockCost": 7800,
    "baseSpeed": 35.8,
    "driftGrip": 0.76,
    "handling": 1.04,
    "coinMultiplier": 4.1,
    "feverGainRate": 2.75,
    "primaryColor": "#dc2626",
    "secondaryColor": "#450a0a",
    "accentColor": "#fef08a",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "cyber_bike",
    "hoodFeature": "boss_scoop",
    "decalText": "28"
  },
  {
    "id": "panigale_corsa",
    "tier": 17,
    "name": "Corsa V4 Superbike",
    "codename": "DESMO APEX · ITALIAN CORSA RED",
    "tagline": "Bologna purebred V4 sportbike with sculpted winglets, single-sided swingarm, and razor-sharp apex carving ability.",
    "unlockCost": 8400,
    "baseSpeed": 36,
    "driftGrip": 0.74,
    "handling": 1.05,
    "coinMultiplier": 4.2,
    "feverGainRate": 2.8,
    "primaryColor": "#b91c1c",
    "secondaryColor": "#1c1917",
    "accentColor": "#ffffff",
    "tailGlowColor": "#f87171",
    "spoilerStyle": "lip",
    "bodyShape": "motorcycle",
    "hoodFeature": "stripes"
  },
  {
    "id": "ninja_supercharged",
    "tier": 18,
    "name": "Ninja H2-R Supercharged",
    "codename": "CENTRIFUGAL BOOST · CARBON GREEN BEAST",
    "tagline": "Raw forged-carbon supercharged track motorcycle with mirror-finish emerald accents, dual carbon aero wings, and insane acceleration.",
    "unlockCost": 9000,
    "baseSpeed": 36.6,
    "driftGrip": 0.75,
    "handling": 1.01,
    "coinMultiplier": 4.3,
    "feverGainRate": 2.85,
    "primaryColor": "#052e16",
    "secondaryColor": "#15803d",
    "accentColor": "#4ade80",
    "tailGlowColor": "#22c55e",
    "spoilerStyle": "active",
    "bodyShape": "motorcycle",
    "hoodFeature": "carbon"
  },
  {
    "id": "tron_lightcycle",
    "tier": 19,
    "name": "Quantum Lightcycle",
    "codename": "GRID GLADIATOR · ENCLOSED PHOTON RUNNER",
    "tagline": "Ultra-low aerodynamic enclosed photon motorcycle leaving radiant cyan light trails with zero-roll magnetic traction.",
    "unlockCost": 9700,
    "baseSpeed": 37,
    "driftGrip": 0.85,
    "handling": 1.06,
    "coinMultiplier": 4.4,
    "feverGainRate": 2.9,
    "primaryColor": "#090d16",
    "secondaryColor": "#083344",
    "accentColor": "#22d3ee",
    "tailGlowColor": "#06b6d4",
    "spoilerStyle": "cyber",
    "bodyShape": "cyber_bike",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "harley_drag_chopper",
    "tier": 20,
    "name": "Iron V-Twin Drag Chopper",
    "codename": "RAKED FORK · 2000CC GROUND SHAKER",
    "tagline": "Extended chrome springer front end, giant fat 300mm rear drag slick, and rumbling straight-pipe exhaust notes.",
    "unlockCost": 10400,
    "baseSpeed": 34.6,
    "driftGrip": 0.68,
    "handling": 0.82,
    "coinMultiplier": 4.5,
    "feverGainRate": 2.95,
    "primaryColor": "#18181b",
    "secondaryColor": "#71717a",
    "accentColor": "#f59e0b",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "motorcycle",
    "hoodFeature": "supercharger"
  },
  {
    "id": "motocross_supermoto",
    "tier": 21,
    "name": "Touge Supermoto 450",
    "codename": "LEG-OUT SLIDER · ULTRA-LIGHT DRIFTER",
    "tagline": "Featherweight single-cylinder 450cc supermoto on sticky 17-inch slicks, built for backing into hairpin turns sideways.",
    "unlockCost": 11100,
    "baseSpeed": 33.2,
    "driftGrip": 0.88,
    "handling": 1.1,
    "coinMultiplier": 4.6,
    "feverGainRate": 3,
    "primaryColor": "#ea580c",
    "secondaryColor": "#ffffff",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#fb923c",
    "spoilerStyle": "lip",
    "bodyShape": "motorcycle",
    "hoodFeature": "stripes"
  },
  {
    "id": "cafe_racer_vintage",
    "tier": 22,
    "name": "Silver Cafe Racer 750",
    "codename": "TON-UP HERITAGE · CLIP-ON ROADSTER",
    "tagline": "Brushed bare-aluminum tank, bullet seat cowl, brown leather accents, and classic twin-dial analog tachometer.",
    "unlockCost": 11800,
    "baseSpeed": 34,
    "driftGrip": 0.78,
    "handling": 0.98,
    "coinMultiplier": 4.7,
    "feverGainRate": 2.8,
    "primaryColor": "#e2e8f0",
    "secondaryColor": "#475569",
    "accentColor": "#92400e",
    "tailGlowColor": "#f87171",
    "spoilerStyle": "lip",
    "bodyShape": "motorcycle",
    "hoodFeature": "stripes"
  },
  {
    "id": "cyber_ronin_bike",
    "tier": 23,
    "name": "Cyber Ronin Monobike",
    "codename": "ORBITAL GYRO · STREET WEAPON",
    "tagline": "Single giant hubless gyroscopic ring frame with magnetic suspension and dual plasma pulse cannons for pure sci-fi styling.",
    "unlockCost": 12500,
    "baseSpeed": 37.2,
    "driftGrip": 0.82,
    "handling": 1.05,
    "coinMultiplier": 4.8,
    "feverGainRate": 3.05,
    "primaryColor": "#3b0764",
    "secondaryColor": "#0f172a",
    "accentColor": "#e879f9",
    "tailGlowColor": "#d946ef",
    "spoilerStyle": "cyber",
    "bodyShape": "cyber_bike",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "hell_rider_chopper",
    "tier": 24,
    "name": "Infernal Street Chopper",
    "codename": "SKULL BILLET · FLAMETHROWER TWIN",
    "tagline": "Black satin chassis with candy-apple flame graphics, high ape-hanger bars, and dual shotgun pipes that bark blue fire on revs.",
    "unlockCost": 13200,
    "baseSpeed": 35,
    "driftGrip": 0.7,
    "handling": 0.85,
    "coinMultiplier": 4.9,
    "feverGainRate": 3.1,
    "primaryColor": "#09090b",
    "secondaryColor": "#991b1b",
    "accentColor": "#f97316",
    "tailGlowColor": "#dc2626",
    "spoilerStyle": "lip",
    "bodyShape": "motorcycle",
    "hoodFeature": "supercharger"
  },
  {
    "id": "enduro_rally_bike",
    "tier": 25,
    "name": "Dakar Rally Raid 990",
    "codename": "DESERT NAVIGATOR · HIGH-CLEARANCE TWIN",
    "tagline": "High-tower navigation fairing, long-travel WP suspension, dual front LED rally pods, and all-terrain drifting mastery.",
    "unlockCost": 13900,
    "baseSpeed": 35.2,
    "driftGrip": 0.8,
    "handling": 1.02,
    "coinMultiplier": 5,
    "feverGainRate": 2.9,
    "primaryColor": "#0284c7",
    "secondaryColor": "#f97316",
    "accentColor": "#ffffff",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "motorcycle",
    "hoodFeature": "fog_lights"
  },
  {
    "id": "electric_speed_bike",
    "tier": 26,
    "name": "Volt Apex Formula Bike",
    "codename": "ZERO EMISSION · 300KW INSTANT TORQUE",
    "tagline": "High-voltage carbon fiber electric superbike with aerodynamic full fairings, regenerative slip control, and silent warp speed.",
    "unlockCost": 14600,
    "baseSpeed": 37.8,
    "driftGrip": 0.86,
    "handling": 1.07,
    "coinMultiplier": 5.1,
    "feverGainRate": 3.15,
    "primaryColor": "#0f766e",
    "secondaryColor": "#020617",
    "accentColor": "#2dd4bf",
    "tailGlowColor": "#14b8a6",
    "spoilerStyle": "active",
    "bodyShape": "cyber_bike",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "baja_trophy_truck",
    "tier": 27,
    "name": "Baja 1000 Trophy Rig",
    "codename": "DESERT UNLIMITED · 900HP LONG-TRAVEL",
    "tagline": "High-stance trophy truck with massive bypass shocks, fiberglass wide fenders, spare rear wheels mounted on bed cage, and roof light pods.",
    "unlockCost": 15300,
    "baseSpeed": 34.4,
    "driftGrip": 0.82,
    "handling": 0.9,
    "coinMultiplier": 5.2,
    "feverGainRate": 2.8,
    "primaryColor": "#d97706",
    "secondaryColor": "#1e293b",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "fog_lights"
  },
  {
    "id": "cyber_titan_pickup",
    "tier": 28,
    "name": "Cyber Titan Tri-Motor",
    "codename": "EXOSKELETON RIG · COLD-ROLLED STEEL",
    "tagline": "Angular faceted stainless steel electric super-truck with full-width lightbars front and rear, armor glass, and monster torque.",
    "unlockCost": 16000,
    "baseSpeed": 36,
    "driftGrip": 0.84,
    "handling": 0.88,
    "coinMultiplier": 5.3,
    "feverGainRate": 3,
    "primaryColor": "#94a3b8",
    "secondaryColor": "#0f172a",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "slammed_c10_dually",
    "tier": 29,
    "name": "Slammed Dually Hauler",
    "codename": "TWIN REAR WHEELS · BAG-ON-GROUND",
    "tagline": "Classic 1970s custom dually pickup slammed on air suspension with 4 fat rear slicks, copper metallic paint, and twin turbo V8.",
    "unlockCost": 16800,
    "baseSpeed": 34.8,
    "driftGrip": 0.74,
    "handling": 0.84,
    "coinMultiplier": 5.4,
    "feverGainRate": 2.85,
    "primaryColor": "#b45309",
    "secondaryColor": "#18181b",
    "accentColor": "#fef08a",
    "tailGlowColor": "#dc2626",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "supercharger"
  },
  {
    "id": "highway_semi_boss",
    "tier": 30,
    "name": "Highway Overlord Semi",
    "codename": "18-WHEELER CAB · TWIN SMOKESTACKS",
    "tagline": "Massive aerodynamic long-nose big rig tractor cab with chrome monster grille, twin 8-inch vertical stacks, and high sleeper roof.",
    "unlockCost": 17600,
    "baseSpeed": 33.6,
    "driftGrip": 0.88,
    "handling": 0.75,
    "coinMultiplier": 5.6,
    "feverGainRate": 3.1,
    "primaryColor": "#1e3a8a",
    "secondaryColor": "#0f172a",
    "accentColor": "#e2e8f0",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "gt",
    "bodyShape": "semi",
    "hoodFeature": "supercharger"
  },
  {
    "id": "monster_drift_rig",
    "tier": 31,
    "name": "Monster Drift Hauler",
    "codename": "TWIN ENGINES · FLAME CANNONS",
    "tagline": "Custom purpose-built drift racing truck with twin turbo diesel powerplants, tubular exo-skeleton cage, and massive downforce rear wing.",
    "unlockCost": 18400,
    "baseSpeed": 35.4,
    "driftGrip": 0.78,
    "handling": 0.86,
    "coinMultiplier": 5.7,
    "feverGainRate": 3.15,
    "primaryColor": "#84cc16",
    "secondaryColor": "#14532d",
    "accentColor": "#facc15",
    "tailGlowColor": "#84cc16",
    "spoilerStyle": "cyber",
    "bodyShape": "truck",
    "hoodFeature": "boss_scoop"
  },
  {
    "id": "kenworth_behemoth",
    "tier": 32,
    "name": "Iron Hauler Titan",
    "codename": "HEAVY ROAD TRAIN · BULL-BAR BEAST",
    "tagline": "Satin midnight black road-train semi with reinforced steel cattle pusher, dual air horns, and thunderous diesel compression braking.",
    "unlockCost": 19200,
    "baseSpeed": 33.8,
    "driftGrip": 0.9,
    "handling": 0.76,
    "coinMultiplier": 5.8,
    "feverGainRate": 3.2,
    "primaryColor": "#09090b",
    "secondaryColor": "#450a0a",
    "accentColor": "#ef4444",
    "tailGlowColor": "#b91c1c",
    "spoilerStyle": "lip",
    "bodyShape": "semi",
    "hoodFeature": "stripes"
  },
  {
    "id": "flatbed_hauler",
    "tier": 33,
    "name": "Touge Towing Flatbed",
    "codename": "DRIFT RESCUE · WARNING STROBE RIG",
    "tagline": "Diamond-plate steel rollback carrier with functional amber beacon bar, winch rack, and surprisingly nimble rear-wheel slide control.",
    "unlockCost": 20000,
    "baseSpeed": 34.2,
    "driftGrip": 0.8,
    "handling": 0.82,
    "coinMultiplier": 5.9,
    "feverGainRate": 3,
    "primaryColor": "#ea580c",
    "secondaryColor": "#1c1917",
    "accentColor": "#fde047",
    "tailGlowColor": "#f97316",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "stripes"
  },
  {
    "id": "military_apc_hauler",
    "tier": 34,
    "name": "Tactical 6x6 Enforcer",
    "codename": "ARMORED OVERLAND · BULLETPROOF BEAST",
    "tagline": "Heavy matte olive drab multi-axle tactical hauler with angular ballistic armor panels, steel wheels, and indestructible chassis.",
    "unlockCost": 20800,
    "baseSpeed": 34,
    "driftGrip": 0.92,
    "handling": 0.78,
    "coinMultiplier": 6,
    "feverGainRate": 3.25,
    "primaryColor": "#365314",
    "secondaryColor": "#1c1917",
    "accentColor": "#a3e635",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "boss_scoop"
  },
  {
    "id": "syclone_turbo_ute",
    "tier": 35,
    "name": "Night Cyclone Turbo Ute",
    "codename": "ALL-WHEEL BOOST · 90S DRAG SLEEPER",
    "tagline": "Gloss obsidian black compact pickup with turbo intercooler hiding behind front valance, red badging, and sub-4s sprint times.",
    "unlockCost": 21600,
    "baseSpeed": 36.2,
    "driftGrip": 0.86,
    "handling": 0.94,
    "coinMultiplier": 6.1,
    "feverGainRate": 3.3,
    "primaryColor": "#09090b",
    "secondaryColor": "#171717",
    "accentColor": "#dc2626",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "stripes"
  },
  {
    "id": "ford_f100_ratrod",
    "tier": 36,
    "name": "Patina Ratrod Pickup",
    "codename": "CHOPPED ROOF · BLOWN BIG BLOCK",
    "tagline": "Distressed vintage cab with 4-inch roof chop, slammed unpainted frame, huge chrome velocity stacks, and raw attitude.",
    "unlockCost": 22400,
    "baseSpeed": 35.6,
    "driftGrip": 0.72,
    "handling": 0.85,
    "coinMultiplier": 6.2,
    "feverGainRate": 3.2,
    "primaryColor": "#78350f",
    "secondaryColor": "#451a03",
    "accentColor": "#fde047",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "supercharger"
  },
  {
    "id": "tacoma_prerunner",
    "tier": 37,
    "name": "Overland Prerunner 4x4",
    "codename": "TRAIL BOMBER · HIGHWAY DRIFT CONVERSION",
    "tagline": "Cement grey desert pickup with tubular front bumper, wide flared carbon fenders, beadlock wheels, and high-speed sand stability.",
    "unlockCost": 23200,
    "baseSpeed": 35,
    "driftGrip": 0.84,
    "handling": 0.92,
    "coinMultiplier": 6.3,
    "feverGainRate": 3.1,
    "primaryColor": "#64748b",
    "secondaryColor": "#0f172a",
    "accentColor": "#ef4444",
    "tailGlowColor": "#f87171",
    "spoilerStyle": "lip",
    "bodyShape": "truck",
    "hoodFeature": "fog_lights"
  },
  {
    "id": "supercharged_ram_trx",
    "tier": 38,
    "name": "Apex Predator Hell-Truck",
    "codename": "HELLCAT 6.2L · 702HP DESERT MONSTER",
    "tagline": "Flame red widebody truck with functional hood heat extractor, twin side exhausts, 35-inch all-terrain tires, and colossal roar.",
    "unlockCost": 24000,
    "baseSpeed": 36.8,
    "driftGrip": 0.82,
    "handling": 0.88,
    "coinMultiplier": 6.4,
    "feverGainRate": 3.35,
    "primaryColor": "#dc2626",
    "secondaryColor": "#1c1917",
    "accentColor": "#fbbf24",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "twin",
    "bodyShape": "truck",
    "hoodFeature": "supercharger"
  },
  {
    "id": "hiace_vip_box",
    "tier": 39,
    "name": "VIP Executive Box Van",
    "codename": "SLAYER VAN · SLAMMED JDM VIP AERO",
    "tagline": "Gloss obsidian black luxury box van with mirror-tint windows, deep-dish gold mesh rims, VIP aero bodykit, and surprisingly flat drifts.",
    "unlockCost": 24800,
    "baseSpeed": 34.8,
    "driftGrip": 0.8,
    "handling": 0.9,
    "coinMultiplier": 6.5,
    "feverGainRate": 3.2,
    "primaryColor": "#09090b",
    "secondaryColor": "#1e1b4b",
    "accentColor": "#fbbf24",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "gt",
    "bodyShape": "van",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "stagea_gtr_wagon",
    "tier": 40,
    "name": "Godzilla Station Wagon 260RS",
    "codename": "RB26DETT WAGON · AWD GODZILLA SOUL",
    "tagline": "Midnight purple long-roof sports wagon with authentic R34 front-end conversion, twin turbos, and full AWD drift power.",
    "unlockCost": 25600,
    "baseSpeed": 36.5,
    "driftGrip": 0.88,
    "handling": 0.96,
    "coinMultiplier": 6.6,
    "feverGainRate": 3.4,
    "primaryColor": "#581c87",
    "secondaryColor": "#0f172a",
    "accentColor": "#f8fafc",
    "tailGlowColor": "#ec4899",
    "spoilerStyle": "twin",
    "bodyShape": "wagon",
    "hoodFeature": "stripes"
  },
  {
    "id": "rs6_avant_destroyer",
    "tier": 41,
    "name": "Quattro V8 Superwagon",
    "codename": "TWIN-TURBO 800HP · ROOF-BOX MISSILE",
    "tagline": "Nardo grey ultra-wide touring wagon with carbon aerodynamic roof travel box, ceramic brakes, and autobahn-crushing acceleration.",
    "unlockCost": 26400,
    "baseSpeed": 37.2,
    "driftGrip": 0.92,
    "handling": 0.95,
    "coinMultiplier": 6.7,
    "feverGainRate": 3.45,
    "primaryColor": "#64748b",
    "secondaryColor": "#020617",
    "accentColor": "#dc2626",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "active",
    "bodyShape": "wagon",
    "hoodFeature": "carbon"
  },
  {
    "id": "cyber_delivery_runner",
    "tier": 42,
    "name": "Neo-Express Delivery Van",
    "codename": "SUB-SECOND COURIER · NEON CARGO SLIDER",
    "tagline": "Electric canary-yellow high-speed delivery van with digital side display matrix, high-roof aero, and lightning courier handling.",
    "unlockCost": 27200,
    "baseSpeed": 35.2,
    "driftGrip": 0.84,
    "handling": 0.92,
    "coinMultiplier": 6.8,
    "feverGainRate": 3.3,
    "primaryColor": "#facc15",
    "secondaryColor": "#0f172a",
    "accentColor": "#06b6d4",
    "tailGlowColor": "#38bdf8",
    "spoilerStyle": "lip",
    "bodyShape": "van",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "custom_aero_transit",
    "tier": 43,
    "name": "Supervan V8 Mid-Engine",
    "codename": "HOMOLOGATION VAN · GT3 UNDERPINNINGS",
    "tagline": "Formula-derived mid-engine racing van with giant carbon rear wing, side air intakes, and full race suspension geometry.",
    "unlockCost": 28000,
    "baseSpeed": 37,
    "driftGrip": 0.9,
    "handling": 0.97,
    "coinMultiplier": 6.9,
    "feverGainRate": 3.5,
    "primaryColor": "#0284c7",
    "secondaryColor": "#ffffff",
    "accentColor": "#ef4444",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "van",
    "hoodFeature": "carbon"
  },
  {
    "id": "volvo_850_btcc_wagon",
    "tier": 44,
    "name": "Touring Legend 850 Wagon",
    "codename": "BTCC HERITAGE · TWO-WHEELING LONG-ROOF",
    "tagline": "Iconic 1994 British Touring Car heritage blue-and-white livery wagon that conquered race tracks on two wheels.",
    "unlockCost": 28800,
    "baseSpeed": 35.8,
    "driftGrip": 0.86,
    "handling": 0.98,
    "coinMultiplier": 7,
    "feverGainRate": 3.35,
    "primaryColor": "#1d4ed8",
    "secondaryColor": "#ffffff",
    "accentColor": "#fbbf24",
    "tailGlowColor": "#f87171",
    "spoilerStyle": "lip",
    "bodyShape": "wagon",
    "hoodFeature": "stripes"
  },
  {
    "id": "delica_overland_van",
    "tier": 45,
    "name": "Overland 4WD Turbo Van",
    "codename": "HIGH-RIDER CAMPER · TOUGE EXPLORER",
    "tagline": "Two-tone metallic teal and silver 4WD high-clearance van with roof rack, ladder, and high-center-of-gravity drift thrill.",
    "unlockCost": 29600,
    "baseSpeed": 34.6,
    "driftGrip": 0.78,
    "handling": 0.88,
    "coinMultiplier": 7.1,
    "feverGainRate": 3.25,
    "primaryColor": "#0d9488",
    "secondaryColor": "#94a3b8",
    "accentColor": "#fef08a",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "van",
    "hoodFeature": "fog_lights"
  },
  {
    "id": "e63_amg_estate",
    "tier": 46,
    "name": "Affalterbach V8 Biturbo Estate",
    "codename": "DRIFT MODE ACTIVE · 4.0L TWIN-TURBO",
    "tagline": "Matte obsidian estate with dedicated rear-wheel drift mode, panoramic glass roof, and menacing quad trapezoid exhaust tips.",
    "unlockCost": 30400,
    "baseSpeed": 37.4,
    "driftGrip": 0.89,
    "handling": 0.96,
    "coinMultiplier": 7.2,
    "feverGainRate": 3.55,
    "primaryColor": "#18181b",
    "secondaryColor": "#09090b",
    "accentColor": "#f59e0b",
    "tailGlowColor": "#dc2626",
    "spoilerStyle": "active",
    "bodyShape": "wagon",
    "hoodFeature": "carbon"
  },
  {
    "id": "classic_woodie_wagon",
    "tier": 47,
    "name": "California Woodie V8 Cruiser",
    "codename": "SURF DRIFT · HAND-CRAFTED TIMBER",
    "tagline": "1950 vintage timber-panel cruiser retrofitted with modern independent rear suspension and high-rev crate V8.",
    "unlockCost": 31200,
    "baseSpeed": 34.4,
    "driftGrip": 0.75,
    "handling": 0.86,
    "coinMultiplier": 7.3,
    "feverGainRate": 3.2,
    "primaryColor": "#78350f",
    "secondaryColor": "#fef3c7",
    "accentColor": "#0284c7",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "wagon",
    "hoodFeature": "stripes"
  },
  {
    "id": "cyber_cargo_hauler",
    "tier": 48,
    "name": "Cyberpunk Cargo Pod",
    "codename": "AUTONOMOUS RUNNER · OVERRIDDEN JOYSTICK",
    "tagline": "Futuristic monovolume transport stripped of autonomous speed limiters for illegal midnight highway drift runs.",
    "unlockCost": 32000,
    "baseSpeed": 36.6,
    "driftGrip": 0.85,
    "handling": 0.93,
    "coinMultiplier": 7.4,
    "feverGainRate": 3.6,
    "primaryColor": "#475569",
    "secondaryColor": "#0f172a",
    "accentColor": "#06b6d4",
    "tailGlowColor": "#22d3ee",
    "spoilerStyle": "cyber",
    "bodyShape": "van",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "formula_v10_screamer",
    "tier": 49,
    "name": "Formula V10 2000s Screamer",
    "codename": "20,000 RPM · HIGH-DOWNFORCE AERO",
    "tagline": "Needle-nose open-wheel formula racer with shrieking V10 naturally aspirated engine, multi-element front wing, and giant slicks.",
    "unlockCost": 32800,
    "baseSpeed": 38.4,
    "driftGrip": 0.96,
    "handling": 1.05,
    "coinMultiplier": 7.5,
    "feverGainRate": 3.7,
    "primaryColor": "#e2e8f0",
    "secondaryColor": "#ea580c",
    "accentColor": "#ffffff",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "formula",
    "hoodFeature": "carbon"
  },
  {
    "id": "formula_e_lightning",
    "tier": 50,
    "name": "Formula Gen-3 Cyber Blade",
    "codename": "DELTA WING · ELECTRIC DOWNFORCE",
    "tagline": "Futuristic triangular open-wheel design with sharp angular wheel fairings, regen braking lights, and instant-warp torque.",
    "unlockCost": 33600,
    "baseSpeed": 38.6,
    "driftGrip": 0.95,
    "handling": 1.08,
    "coinMultiplier": 7.6,
    "feverGainRate": 3.75,
    "primaryColor": "#0891b2",
    "secondaryColor": "#0f172a",
    "accentColor": "#67e8f9",
    "tailGlowColor": "#22d3ee",
    "spoilerStyle": "active",
    "bodyShape": "formula",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "lotus_98t_turbo",
    "tier": 51,
    "name": "Black & Gold 1200HP Turbo",
    "codename": "QUALIFYING BOOST · 5.5 BAR LEGEND",
    "tagline": "Iconic gloss black and gold pinstripe turbo legend capable of astronomical qualifying horsepower and wild powerslides.",
    "unlockCost": 34400,
    "baseSpeed": 39,
    "driftGrip": 0.94,
    "handling": 1.04,
    "coinMultiplier": 7.7,
    "feverGainRate": 3.8,
    "primaryColor": "#09090b",
    "secondaryColor": "#171717",
    "accentColor": "#eab308",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "gt",
    "bodyShape": "formula",
    "hoodFeature": "stripes"
  },
  {
    "id": "red_bullet_indy",
    "tier": 52,
    "name": "Superspeedway Indy Bullet",
    "codename": "380 KM/H SPEEDWAY ARROW",
    "tagline": "Low-drag superspeedway aero package with delicate rear winglets, crimson body, and blistering straight-line highway pace.",
    "unlockCost": 35200,
    "baseSpeed": 39.4,
    "driftGrip": 0.93,
    "handling": 1.02,
    "coinMultiplier": 7.8,
    "feverGainRate": 3.85,
    "primaryColor": "#dc2626",
    "secondaryColor": "#facc15",
    "accentColor": "#ffffff",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "formula",
    "hoodFeature": "stripes"
  },
  {
    "id": "canam_shadow_prototype",
    "tier": 53,
    "name": "Can-Am 8.1L Shadow Beast",
    "codename": "UNLIMITED POWER · NO RULES BIG BLOCK",
    "tagline": "Low-slung Can-Am open cockpit racer with massive side-mounted radiators, huge rear contact patches, and unrestricted displacement.",
    "unlockCost": 36000,
    "baseSpeed": 38.8,
    "driftGrip": 0.92,
    "handling": 1,
    "coinMultiplier": 7.9,
    "feverGainRate": 3.7,
    "primaryColor": "#09090b",
    "secondaryColor": "#334155",
    "accentColor": "#ffffff",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "formula",
    "hoodFeature": "supercharger"
  },
  {
    "id": "formula_drift_open",
    "tier": 54,
    "name": "Aero-Drift Open Monoposto",
    "codename": "SIDEWAYS FORMULA · ANGLE KIT MONSTER",
    "tagline": "Customized open-wheel chassis fitted with a 70-degree steering angle kit, hot pink livery, and clouds of rear tire smoke.",
    "unlockCost": 36800,
    "baseSpeed": 37.8,
    "driftGrip": 0.88,
    "handling": 1.1,
    "coinMultiplier": 8,
    "feverGainRate": 3.9,
    "primaryColor": "#ec4899",
    "secondaryColor": "#06b6d4",
    "accentColor": "#fef08a",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "cyber",
    "bodyShape": "formula",
    "hoodFeature": "stripes"
  },
  {
    "id": "apex_aero_monoposto",
    "tier": 55,
    "name": "Apex Carbon Arrow Monoposto",
    "codename": "ENDGAME SINGLE-SEAT · ACTIVE VENTURI",
    "tagline": "Raw exposed woven carbon fiber single-seater with full ground-effect venturi tunnels and rose-gold aerodynamic vanes.",
    "unlockCost": 37600,
    "baseSpeed": 39.6,
    "driftGrip": 0.97,
    "handling": 1.08,
    "coinMultiplier": 8.1,
    "feverGainRate": 4,
    "primaryColor": "#18181b",
    "secondaryColor": "#020617",
    "accentColor": "#fb7185",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "active",
    "bodyShape": "formula",
    "hoodFeature": "carbon"
  },
  {
    "id": "vintage_grand_prix",
    "tier": 56,
    "name": "1967 Cigar Grand Prix",
    "codename": "RETRO MONOPOSTO · SLENDER BULLET",
    "tagline": "Historic narrow-cigar Grand Prix racer in classic British racing green with exposed chrome velocity trumpets and yellow nose cone.",
    "unlockCost": 38400,
    "baseSpeed": 36.2,
    "driftGrip": 0.84,
    "handling": 1,
    "coinMultiplier": 8.2,
    "feverGainRate": 3.65,
    "primaryColor": "#14532d",
    "secondaryColor": "#1e293b",
    "accentColor": "#facc15",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "formula",
    "hoodFeature": "stripes"
  },
  {
    "id": "ground_effect_fan_car",
    "tier": 57,
    "name": "Suction Fan Aeromaster",
    "codename": "FAN CAR · MAXIMUM LATERAL SUCTION",
    "tagline": "Equipped with a rear-mounted active vacuum fan that sucks the chassis to the tarmac for unbelievable high-speed drift angles.",
    "unlockCost": 39200,
    "baseSpeed": 39.2,
    "driftGrip": 0.98,
    "handling": 1.09,
    "coinMultiplier": 8.3,
    "feverGainRate": 4.05,
    "primaryColor": "#dc2626",
    "secondaryColor": "#ffffff",
    "accentColor": "#2563eb",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "formula",
    "hoodFeature": "carbon"
  },
  {
    "id": "quantum_formula_x",
    "tier": 58,
    "name": "Quantum Formula X Prototype",
    "codename": "PLASMA THRUST · TRANSCENDENT SPEED",
    "tagline": "Experimental closed-cockpit hybrid open-wheel weapon featuring variable-sweep wings and sub-atomic laser telemetry.",
    "unlockCost": 40000,
    "baseSpeed": 40,
    "driftGrip": 0.98,
    "handling": 1.1,
    "coinMultiplier": 8.5,
    "feverGainRate": 4.1,
    "primaryColor": "#312e81",
    "secondaryColor": "#09090b",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#06b6d4",
    "spoilerStyle": "cyber",
    "bodyShape": "formula",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "ae86_trueno_panda",
    "tier": 59,
    "name": "Akina Ghost Panda AE86",
    "codename": "TOFU RUNNER · 4A-GE 11,000 RPM",
    "tagline": "The undisputed mountain pass legend with iconic black and white panda two-tone, pop-up headlamps, and weight-transfer drift purity.",
    "unlockCost": 40800,
    "baseSpeed": 35.8,
    "driftGrip": 0.88,
    "handling": 1.08,
    "coinMultiplier": 8.6,
    "feverGainRate": 4,
    "primaryColor": "#ffffff",
    "secondaryColor": "#09090b",
    "accentColor": "#f59e0b",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "coupe",
    "hoodFeature": "carbon",
    "decalText": "86"
  },
  {
    "id": "rx7_fd_rotary_boss",
    "tier": 60,
    "name": "Rotary Apex FD3S",
    "codename": "13B TWIN-TURBO · FLAMING ROTARY BRAP",
    "tagline": "Competition yellow widebody RX-7 with vented carbon hood, screaming twin-rotary engine, and explosive backfire on every corner exit.",
    "unlockCost": 41600,
    "baseSpeed": 37.4,
    "driftGrip": 0.9,
    "handling": 1.05,
    "coinMultiplier": 8.7,
    "feverGainRate": 4.15,
    "primaryColor": "#eab308",
    "secondaryColor": "#171717",
    "accentColor": "#f97316",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "gt",
    "bodyShape": "coupe",
    "hoodFeature": "vented",
    "decalText": "07"
  },
  {
    "id": "supra_mk4_2jz",
    "tier": 61,
    "name": "Midnight Highway 2JZ Bullet",
    "codename": "ROYAL SAPPHIRE · 1000HP SINGLE TURBO",
    "tagline": "Royal sapphire blue metallic legend with polished aluminum lip, monster T51R turbocharger, and legendary top-speed highway pulls.",
    "unlockCost": 42400,
    "baseSpeed": 38.6,
    "driftGrip": 0.86,
    "handling": 0.96,
    "coinMultiplier": 8.8,
    "feverGainRate": 4.2,
    "primaryColor": "#1e3a8a",
    "secondaryColor": "#020617",
    "accentColor": "#e2e8f0",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "gt",
    "bodyShape": "coupe",
    "hoodFeature": "boss_scoop"
  },
  {
    "id": "skyline_r34_gtr_vspec",
    "tier": 62,
    "name": "Bayside Blue Godzilla R34",
    "codename": "ATTESA AWD · V-SPEC II AERO",
    "tagline": "Bayside blue legend with quad circular taillights, active front spoiler, and unstoppable traction through high-speed S-bends.",
    "unlockCost": 43200,
    "baseSpeed": 38.2,
    "driftGrip": 0.93,
    "handling": 1,
    "coinMultiplier": 8.9,
    "feverGainRate": 4.25,
    "primaryColor": "#2563eb",
    "secondaryColor": "#0f172a",
    "accentColor": "#f8fafc",
    "tailGlowColor": "#dc2626",
    "spoilerStyle": "gt",
    "bodyShape": "coupe",
    "hoodFeature": "vented",
    "decalText": "34"
  },
  {
    "id": "nsx_type_r_na1",
    "tier": 63,
    "name": "Championship White NSX-R",
    "codename": "MID-ENGINE MONOCOQUE · SENNA DNA",
    "tagline": "Pure championship white aluminum mid-engine supercar with contrast black canopy roof, red interior, and surgical cornering balance.",
    "unlockCost": 44000,
    "baseSpeed": 37.8,
    "driftGrip": 0.94,
    "handling": 1.06,
    "coinMultiplier": 9,
    "feverGainRate": 4.3,
    "primaryColor": "#f8fafc",
    "secondaryColor": "#09090b",
    "accentColor": "#dc2626",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "supercar",
    "hoodFeature": "carbon"
  },
  {
    "id": "s2000_screamer_ap2",
    "tier": 64,
    "name": "S2000 9000RPM Screamer",
    "codename": "HIGH-REV ROADSTER · VTEC KICK",
    "tagline": "Silverstone metallic drop-top roadster with high-downforce GT wing, titanium exhaust, and hair-raising 9000 RPM powerband.",
    "unlockCost": 44800,
    "baseSpeed": 37,
    "driftGrip": 0.89,
    "handling": 1.07,
    "coinMultiplier": 9.1,
    "feverGainRate": 4.25,
    "primaryColor": "#94a3b8",
    "secondaryColor": "#450a0a",
    "accentColor": "#dc2626",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "gt",
    "bodyShape": "roadster",
    "hoodFeature": "vented"
  },
  {
    "id": "evo_ix_time_attack",
    "tier": 65,
    "name": "Evo IX Time Attack Monster",
    "codename": "SUPER-AYC · CARBON DIVE PLANES",
    "tagline": "Satin carbon-bodied rally saloon with massive multi-tier front splitter, side air-exhaust louvers, and AWD launch velocity.",
    "unlockCost": 45600,
    "baseSpeed": 38,
    "driftGrip": 0.94,
    "handling": 1.02,
    "coinMultiplier": 9.2,
    "feverGainRate": 4.35,
    "primaryColor": "#171717",
    "secondaryColor": "#042f2e",
    "accentColor": "#10b981",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "cyber",
    "bodyShape": "rally",
    "hoodFeature": "vented",
    "decalText": "09"
  },
  {
    "id": "chaser_jzx100_four_door",
    "tier": 66,
    "name": "VIP Chaser JZX100",
    "codename": "1JZ 4-DOOR MISSILE · TOUGE LUXURY",
    "tagline": "Deep pearl white executive saloon with slammed suspension, roof spoiler, straight-pipe 1JZ scream, and endless angle.",
    "unlockCost": 46400,
    "baseSpeed": 37.2,
    "driftGrip": 0.85,
    "handling": 0.98,
    "coinMultiplier": 9.3,
    "feverGainRate": 4.3,
    "primaryColor": "#f1f5f9",
    "secondaryColor": "#18181b",
    "accentColor": "#f59e0b",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "coupe",
    "hoodFeature": "stripes"
  },
  {
    "id": "fairlady_240z_devil",
    "tier": 67,
    "name": "Wangan Devil Z S30",
    "codename": "L28 TWIN-TURBO · MIDNIGHT DEVIL",
    "tagline": "Midnight blue vintage Japanese GT with bolt-on G-nose flares, Watanabe bronze wheels, and an insatiable hunger for speed.",
    "unlockCost": 47200,
    "baseSpeed": 37.6,
    "driftGrip": 0.83,
    "handling": 0.97,
    "coinMultiplier": 9.4,
    "feverGainRate": 4.4,
    "primaryColor": "#1e3a8a",
    "secondaryColor": "#020617",
    "accentColor": "#b45309",
    "tailGlowColor": "#f87171",
    "spoilerStyle": "lip",
    "bodyShape": "classic",
    "hoodFeature": "carbon"
  },
  {
    "id": "silvia_s15_spec_r",
    "tier": 68,
    "name": "Sunset Orange Silvia S15",
    "codename": "VERTEX EDGE · D1 CHAMPION DRIFTER",
    "tagline": "Vibrant sunset orange widebody S15 with dual side graphics, swan-neck carbon wing, and legendary balanced chassis poise.",
    "unlockCost": 48000,
    "baseSpeed": 37.8,
    "driftGrip": 0.87,
    "handling": 1.05,
    "coinMultiplier": 9.5,
    "feverGainRate": 4.45,
    "primaryColor": "#ea580c",
    "secondaryColor": "#0f172a",
    "accentColor": "#ffffff",
    "tailGlowColor": "#fb923c",
    "spoilerStyle": "cyber",
    "bodyShape": "coupe",
    "hoodFeature": "vented",
    "decalText": "15"
  },
  {
    "id": "civic_ek9_typer_hatch",
    "tier": 69,
    "name": "Spoon Yellow Civic Type-R",
    "codename": "B16B FEATHERWEIGHT · 9000RPM CANNON",
    "tagline": "High-contrast bright yellow and black carbon hatchback with track-prepped aero mirrors, rear duckbill, and razor mountain agility.",
    "unlockCost": 48800,
    "baseSpeed": 36.4,
    "driftGrip": 0.91,
    "handling": 1.1,
    "coinMultiplier": 9.6,
    "feverGainRate": 4.4,
    "primaryColor": "#facc15",
    "secondaryColor": "#09090b",
    "accentColor": "#06b6d4",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "kei",
    "hoodFeature": "carbon"
  },
  {
    "id": "180sx_type_x_popups",
    "tier": 70,
    "name": "Midnight Kouki 180SX",
    "codename": "TYPE-X AERO · POP-UP WINK SLIDER",
    "tagline": "Deep dark violet Type-X hatchback with factory aero skirts, sleep-eye pop-up headlights, and shotgun blast rear pipes.",
    "unlockCost": 49600,
    "baseSpeed": 37,
    "driftGrip": 0.84,
    "handling": 1.04,
    "coinMultiplier": 9.7,
    "feverGainRate": 4.5,
    "primaryColor": "#3b0764",
    "secondaryColor": "#0f172a",
    "accentColor": "#ec4899",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "twin",
    "bodyShape": "coupe",
    "hoodFeature": "stripes"
  },
  {
    "id": "chiron_speed_world",
    "tier": 71,
    "name": "W16 Quad-Turbo 300+ Hypercar",
    "codename": "490 KM/H RECORD · RAW CARBON STREAMLINER",
    "tagline": "French racing blue and naked carbon hypercar powered by an 8.0L quad-turbo W16 engine with extended low-drag rear tail.",
    "unlockCost": 50400,
    "baseSpeed": 40.2,
    "driftGrip": 0.92,
    "handling": 0.95,
    "coinMultiplier": 9.8,
    "feverGainRate": 4.6,
    "primaryColor": "#0284c7",
    "secondaryColor": "#09090b",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "active",
    "bodyShape": "supercar",
    "hoodFeature": "carbon"
  },
  {
    "id": "jesko_attack_aero",
    "tier": 72,
    "name": "Apex Megacar Jesko Attack",
    "codename": "ACTIVE TOP-MOUNT WING · 1600HP E85",
    "tagline": "Pearl white Swedish megacar with emerald green aero accents, dihedral synchro-helix doors, and 1400kg of downforce.",
    "unlockCost": 51200,
    "baseSpeed": 40.6,
    "driftGrip": 0.95,
    "handling": 1.02,
    "coinMultiplier": 9.9,
    "feverGainRate": 4.65,
    "primaryColor": "#f8fafc",
    "secondaryColor": "#064e3b",
    "accentColor": "#10b981",
    "tailGlowColor": "#34d399",
    "spoilerStyle": "cyber",
    "bodyShape": "supercar",
    "hoodFeature": "carbon"
  },
  {
    "id": "senna_gtr_carbon",
    "tier": 73,
    "name": "Senna GTR Track Monster",
    "codename": "LMP1 DOWNFORCE · MONSTER DIFFUSER",
    "tagline": "Pure track-only carbon aero predator with massive front dive planes, roof snorkel airbox, and giant swan-neck rear wing.",
    "unlockCost": 52000,
    "baseSpeed": 39.8,
    "driftGrip": 0.97,
    "handling": 1.07,
    "coinMultiplier": 10,
    "feverGainRate": 4.7,
    "primaryColor": "#18181b",
    "secondaryColor": "#ea580c",
    "accentColor": "#f97316",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "gt3",
    "hoodFeature": "carbon"
  },
  {
    "id": "huayra_bc_tempesta",
    "tier": 74,
    "name": "Titanium Tempesta Hypercar",
    "codename": "CARBO-TRIANIUM · ACTIVE QUAD FLAPS",
    "tagline": "Sculpted silver-grey jewel with active corner flaps that tilt dynamically during turns, and quad center titanium trumpet pipes.",
    "unlockCost": 52800,
    "baseSpeed": 39.4,
    "driftGrip": 0.93,
    "handling": 1.04,
    "coinMultiplier": 10.1,
    "feverGainRate": 4.75,
    "primaryColor": "#94a3b8",
    "secondaryColor": "#1e293b",
    "accentColor": "#16a34a",
    "tailGlowColor": "#dc2626",
    "spoilerStyle": "active",
    "bodyShape": "supercar",
    "hoodFeature": "stripes"
  },
  {
    "id": "rimac_nevera_electric",
    "tier": 75,
    "name": "Nevera Quad-Motor Lightning",
    "codename": "2000HP TORQUE VECTORING · 0-100 1.8S",
    "tagline": "Electric cyan and pearl white hypercar with 4 individual wheel motors capable of mathematically perfect drift angles.",
    "unlockCost": 53600,
    "baseSpeed": 40.4,
    "driftGrip": 0.96,
    "handling": 1.05,
    "coinMultiplier": 10.2,
    "feverGainRate": 4.8,
    "primaryColor": "#06b6d4",
    "secondaryColor": "#f8fafc",
    "accentColor": "#a5f3fc",
    "tailGlowColor": "#06b6d4",
    "spoilerStyle": "active",
    "bodyShape": "supercar",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "p1_hyper_hybrid",
    "tier": 76,
    "name": "Volcano Yellow P1 Hybrid",
    "codename": "RACE MODE LOWERED · IPAS BOOST",
    "tagline": "Flamboyant volcano yellow track weapon that hunkers down 50mm in race mode and deploys giant active DRS wing.",
    "unlockCost": 54400,
    "baseSpeed": 39.6,
    "driftGrip": 0.94,
    "handling": 1.03,
    "coinMultiplier": 10.3,
    "feverGainRate": 4.85,
    "primaryColor": "#eab308",
    "secondaryColor": "#09090b",
    "accentColor": "#f97316",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "active",
    "bodyShape": "supercar",
    "hoodFeature": "carbon"
  },
  {
    "id": "laferrari_corsa",
    "tier": 77,
    "name": "Rosso Corsa Hybrid V12",
    "codename": "KERS POWERED · MARANELLO FLAGSHIP",
    "tagline": "Iconic Rosso Corsa bodywork with contrast Nero roof, 9500 RPM screaming V12, and Formula 1 KERS battery boost.",
    "unlockCost": 55200,
    "baseSpeed": 39.8,
    "driftGrip": 0.93,
    "handling": 1.04,
    "coinMultiplier": 10.4,
    "feverGainRate": 4.9,
    "primaryColor": "#dc2626",
    "secondaryColor": "#09090b",
    "accentColor": "#fef08a",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "active",
    "bodyShape": "supercar",
    "hoodFeature": "stripes"
  },
  {
    "id": "venom_f5_hyper",
    "tier": 78,
    "name": "Venom F5 Twin-Turbo V8",
    "codename": "FURY V8 1817HP · 500 KM/H CHASER",
    "tagline": "Blaze orange carbon missile with bespoke 6.6L twin-turbo Fury V8, carbon tub, and blistering top speed capability.",
    "unlockCost": 56000,
    "baseSpeed": 40.8,
    "driftGrip": 0.91,
    "handling": 0.98,
    "coinMultiplier": 10.5,
    "feverGainRate": 4.95,
    "primaryColor": "#ea580c",
    "secondaryColor": "#171717",
    "accentColor": "#fef08a",
    "tailGlowColor": "#f97316",
    "spoilerStyle": "gt",
    "bodyShape": "supercar",
    "hoodFeature": "carbon"
  },
  {
    "id": "speedtail_streamliner",
    "tier": 79,
    "name": "Speedtail Central Cockpit",
    "codename": "FLEXIBLE CARBON TAIL · 3-SEAT STREAMLINER",
    "tagline": "Liquid metallic silver streamliner with center driver seating position, enclosed front wheel aero covers, and seamless active tail.",
    "unlockCost": 56800,
    "baseSpeed": 41,
    "driftGrip": 0.9,
    "handling": 0.97,
    "coinMultiplier": 10.6,
    "feverGainRate": 5,
    "primaryColor": "#cbd5e1",
    "secondaryColor": "#0f172a",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "supercar",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "countach_lpi_revival",
    "tier": 80,
    "name": "Wedge Revival V12 Supercar",
    "codename": "RETRO FUTURE · PERISCOPE ROOF V12",
    "tagline": "Pure Bianco Siderale wedge supercar with bronze telephone-dial wheels, scissor doors, and naturally aspirated V12 howl.",
    "unlockCost": 57600,
    "baseSpeed": 39.5,
    "driftGrip": 0.91,
    "handling": 1.01,
    "coinMultiplier": 10.7,
    "feverGainRate": 4.9,
    "primaryColor": "#f8fafc",
    "secondaryColor": "#78350f",
    "accentColor": "#d97706",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "supercar",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "charger_69_general_v8",
    "tier": 81,
    "name": "1969 426 Hemi Muscle",
    "codename": "HEAVY HEMI · BUMBLEBEE STRIPE BRUTE",
    "tagline": "Burnt orange heavy steel American muscle with black rear bumblebee stripe, welded differential, and tail-out tire smoking glory.",
    "unlockCost": 58400,
    "baseSpeed": 38,
    "driftGrip": 0.74,
    "handling": 0.88,
    "coinMultiplier": 10.8,
    "feverGainRate": 5.05,
    "primaryColor": "#c2410c",
    "secondaryColor": "#09090b",
    "accentColor": "#ffffff",
    "tailGlowColor": "#dc2626",
    "spoilerStyle": "lip",
    "bodyShape": "muscle",
    "hoodFeature": "stripes"
  },
  {
    "id": "mustang_gtd_carbon",
    "tier": 82,
    "name": "Mustang GTD Carbon Supercar",
    "codename": "TRANSAXLE V8 · PUSHROD SUSPENSION",
    "tagline": "Widebody carbon-bodied 800HP super-Mustang with rear transaxle, active DRS swan-neck wing, and GT3-level circuit times.",
    "unlockCost": 59200,
    "baseSpeed": 39.6,
    "driftGrip": 0.92,
    "handling": 1.02,
    "coinMultiplier": 10.9,
    "feverGainRate": 5.1,
    "primaryColor": "#475569",
    "secondaryColor": "#020617",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "muscle",
    "hoodFeature": "vented"
  },
  {
    "id": "shelby_cobra_427",
    "tier": 83,
    "name": "Cobra 427 Side-Pipe Roadster",
    "codename": "7.0L BIG BLOCK · NO ROOF NO DRIVERS AIDS",
    "tagline": "Guardsman blue roadster with twin white racing stripes, side exhaust pipes, chrome roll hoop, and raw uncontrollable power.",
    "unlockCost": 60000,
    "baseSpeed": 38.4,
    "driftGrip": 0.76,
    "handling": 0.95,
    "coinMultiplier": 11,
    "feverGainRate": 5.15,
    "primaryColor": "#1d4ed8",
    "secondaryColor": "#ffffff",
    "accentColor": "#e2e8f0",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "lip",
    "bodyShape": "classic",
    "hoodFeature": "stripes"
  },
  {
    "id": "camaro_zl1_1le_track",
    "tier": 84,
    "name": "Camaro ZL1 1LE Track Weapon",
    "codename": "SUPERCHARGED LT4 · MULTIMATIC DSSV",
    "tagline": "Shock yellow track package muscle car with satin black hood, front dive plane canards, and roaring supercharged V8.",
    "unlockCost": 60800,
    "baseSpeed": 38.8,
    "driftGrip": 0.89,
    "handling": 1.01,
    "coinMultiplier": 11.1,
    "feverGainRate": 5.2,
    "primaryColor": "#eab308",
    "secondaryColor": "#09090b",
    "accentColor": "#171717",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "gt",
    "bodyShape": "muscle",
    "hoodFeature": "carbon"
  },
  {
    "id": "hellcat_redeye_wide",
    "tier": 85,
    "name": "Hellcat Redeye Demon Widebody",
    "codename": "807HP SUPERCHARGER · BURNOUT MASTER",
    "tagline": "Plum crazy purple widebody muscle monster with dual-snorkel hood scoop, drag radials, and tires that incinerate on command.",
    "unlockCost": 61600,
    "baseSpeed": 39.2,
    "driftGrip": 0.75,
    "handling": 0.9,
    "coinMultiplier": 11.2,
    "feverGainRate": 5.25,
    "primaryColor": "#7e22ce",
    "secondaryColor": "#09090b",
    "accentColor": "#fde047",
    "tailGlowColor": "#dc2626",
    "spoilerStyle": "lip",
    "bodyShape": "muscle",
    "hoodFeature": "supercharger"
  },
  {
    "id": "corvette_c8_z06_rev",
    "tier": 86,
    "name": "Corvette C8 Z06 Flat-Plane",
    "codename": "8600 RPM LT6 · MID-ENGINE SCREAMER",
    "tagline": "Amplify orange mid-engine supercar with 5.5L flat-plane crank V8, carbon ground effects, and center quad exhaust pipes.",
    "unlockCost": 62400,
    "baseSpeed": 39.4,
    "driftGrip": 0.93,
    "handling": 1.04,
    "coinMultiplier": 11.3,
    "feverGainRate": 5.3,
    "primaryColor": "#f97316",
    "secondaryColor": "#09090b",
    "accentColor": "#171717",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "supercar",
    "hoodFeature": "carbon"
  },
  {
    "id": "delorean_dmc_time",
    "tier": 87,
    "name": "OutaTime Flux Coupe",
    "codename": "88 MPH READY · FLUX CAPACITOR CORE",
    "tagline": "Brushed stainless steel gullwing coupe with rear reactor vents, glowing cyan flux wiring, and iconic retro-future charisma.",
    "unlockCost": 63200,
    "baseSpeed": 38.6,
    "driftGrip": 0.86,
    "handling": 0.98,
    "coinMultiplier": 11.4,
    "feverGainRate": 5.35,
    "primaryColor": "#94a3b8",
    "secondaryColor": "#0f172a",
    "accentColor": "#38bdf8",
    "tailGlowColor": "#f59e0b",
    "spoilerStyle": "lip",
    "bodyShape": "interceptor",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "phantom_drift_hearse",
    "tier": 88,
    "name": "Phantom V8 Drag Hearse",
    "codename": "FINAL RIDE · BLOWN METALLIC CASKET",
    "tagline": "Deep gloss obsidian black 3-ton hearse slammed over polished chrome rims with purple velvet curtains and fire-breathing side pipes.",
    "unlockCost": 64000,
    "baseSpeed": 37.6,
    "driftGrip": 0.76,
    "handling": 0.88,
    "coinMultiplier": 11.5,
    "feverGainRate": 5.4,
    "primaryColor": "#020617",
    "secondaryColor": "#581c87",
    "accentColor": "#a855f7",
    "tailGlowColor": "#a855f7",
    "spoilerStyle": "lip",
    "bodyShape": "wagon",
    "hoodFeature": "supercharger"
  },
  {
    "id": "cyber_spinner_runner",
    "tier": 89,
    "name": "2049 Police Aero Spinner",
    "codename": "OFF-WORLD PATROL · STROBE HOVER INTERCEPTOR",
    "tagline": "Heavy gunmetal aerodynamic pursuit spinner with dual roof strobe pods, enclosed wheels, and vertical thruster stabilization.",
    "unlockCost": 64800,
    "baseSpeed": 40.5,
    "driftGrip": 0.95,
    "handling": 1.08,
    "coinMultiplier": 11.8,
    "feverGainRate": 5.5,
    "primaryColor": "#1e293b",
    "secondaryColor": "#020617",
    "accentColor": "#06b6d4",
    "tailGlowColor": "#ef4444",
    "spoilerStyle": "cyber",
    "bodyShape": "interceptor",
    "hoodFeature": "neon_slits"
  },
  {
    "id": "omega_redline_emperor",
    "tier": 90,
    "name": "Omega Redline Emperor",
    "codename": "THE ULTIMATE DRIFT OVERLORD · T90 APEX",
    "tagline": "The crowning achievement of Neon Redline: a gold-carbon hyper-chassis powered by antimatter hybrid cores, tri-beam lasers, and infinite redline.",
    "unlockCost": 66000,
    "baseSpeed": 41.5,
    "driftGrip": 0.99,
    "handling": 1.12,
    "coinMultiplier": 12.5,
    "feverGainRate": 6,
    "primaryColor": "#09090b",
    "secondaryColor": "#b45309",
    "accentColor": "#facc15",
    "tailGlowColor": "#f43f5e",
    "spoilerStyle": "cyber",
    "bodyShape": "prototype",
    "hoodFeature": "boss_scoop",
    "decalText": "90"
  }
];

export function resolveCarAppearance(
  car: CarSpec,
  custom?: Partial<CarCustomization>
): {
  primaryColor: string;
  accentColor: string;
  rimHex: string;
  spoilerStyle: CarSpec['spoilerStyle'];
  livery: LiveryPatternId;
  underglowHex: string | null;
  flameOuter: string;
  flameCore: string;
  number: string;
  engine: EngineModId;
  roof: RoofModId;
  tires: TireSpecId;
  tireStripeHex: string | null;
  exhaust: ExhaustStyleId;
  hood: HoodStyleId;
  windows: WindowTintId;
  windowDarkHex: string;
  windowMidHex: string;
  windowSpecHex: string;
  horn: HornStyleId;
  hornType: HornTypeId;
  sound: SoundProfileId;
  lights: HeadlightKitId;
  headlightLensHex: string;
  headlightBeamHex: string;
} {
  const paintOpt = PAINT_OPTIONS.find((p) => p.id === (custom?.paint || 'stock'));
  const rimOpt = RIM_OPTIONS.find((r) => r.id === (custom?.rims || 'stock'));
  const rawUnderglow = custom?.underglowColor || custom?.underglow || 'none';
  const resolvedUnderglowHex = resolveUnderglowColor(rawUnderglow);
  const flameOpt = FLAME_OPTIONS.find((f) => f.id === (custom?.flame || 'stock'));
  const tireOpt = TIRE_OPTIONS.find((t) => t.id === (custom?.tires || 'stock')) || TIRE_OPTIONS[0];
  const windowOpt = WINDOW_OPTIONS.find((w) => w.id === (custom?.windows || 'stock')) || WINDOW_OPTIONS[0];
  const lightOpt = HEADLIGHT_OPTIONS.find((l) => l.id === (custom?.lights || 'stock')) || HEADLIGHT_OPTIONS[0];

  const primaryColor = paintOpt?.hex || car.primaryColor;
  const defaultRimHex =
    car.id === 'crimson_tuner' || car.id === 'rally_legend'
      ? '#fbbf24'
      : car.id === 'cyber_supercar' || car.id === 'neon_interceptor'
      ? '#2dd4bf'
      : car.id === 'cobalt_gt3'
      ? '#a3e635'
      : car.id === 'apex_valkyrie'
      ? '#fb7185'
      : car.id === 'sakura_silvia'
      ? '#f8fafc'
      : '#cbd5e1';

  const wingChoice = custom?.wing && custom.wing !== 'stock' ? custom.wing : car.spoilerStyle;
  const defaultFlameOuter =
    car.id === 'matte_boss' || car.id === 'apex_valkyrie'
      ? '#ef4444'
      : car.id === 'neon_interceptor'
      ? '#06b6d4'
      : '#f97316';

  const defaultRoof: RoofModId =
    custom?.roof && custom.roof !== 'stock'
      ? custom.roof
      : car.id === 'neon_interceptor'
      ? 'light_bar'
      : car.id === 'cobalt_gt3'
      ? 'roof_scoop'
      : 'stock';

  const defaultExhaust: ExhaustStyleId =
    custom?.exhaust && custom.exhaust !== 'stock'
      ? custom.exhaust
      : car.id === 'apex_valkyrie'
      ? 'center_tri'
      : car.id === 'neon_interceptor' || car.id === 'cobalt_gt3'
      ? 'quad_ti'
      : car.id === 'crimson_wagon'
      ? 'side_exit'
      : 'stock';

  return {
    primaryColor,
    accentColor: car.accentColor,
    rimHex: rimOpt?.hex || defaultRimHex,
    spoilerStyle: wingChoice,
    livery: custom?.livery || 'stock',
    underglowHex: resolvedUnderglowHex,
    flameOuter: flameOpt?.outer || defaultFlameOuter,
    flameCore: flameOpt?.core || '#fef08a',
    number: (custom?.number || car.decalText || '73').slice(0, 2),
    engine: custom?.engine || 'stock',
    roof: defaultRoof,
    tires: tireOpt.id,
    tireStripeHex: tireOpt.stripeHex,
    exhaust: defaultExhaust,
    hood: custom?.hood || 'stock',
    windows: windowOpt.id,
    windowDarkHex: windowOpt.darkHex,
    windowMidHex: windowOpt.midHex,
    windowSpecHex: windowOpt.specHex,
    horn: custom?.horn || 'stock',
    hornType:
      custom?.hornType ||
      (custom?.horn && custom.horn in LEGACY_HORN_MAP ? LEGACY_HORN_MAP[custom.horn] : 'dual'),
    sound: custom?.sound || 'stock',
    lights: lightOpt.id,
    headlightLensHex: lightOpt.lensHex,
    headlightBeamHex: lightOpt.beamHex,
  };
}

export function getDriftRank(score: number): { rank: string; title: string; color: string } {
  if (score >= 15000) return { rank: 'SS', title: 'DRIFT KING', color: '#22d3ee' };
  if (score >= 8000) return { rank: 'S', title: 'APEX LEGEND', color: '#fbbf24' };
  if (score >= 4200) return { rank: 'A', title: 'TOUGE MASTER', color: '#a855f7' };
  if (score >= 1800) return { rank: 'B', title: 'STREET PRO', color: '#10b981' };
  if (score >= 600) return { rank: 'C', title: 'SLIDE RUNNER', color: '#3b82f6' };
  return { rank: 'D', title: 'ROOKIE', color: '#94a3b8' };
}

export type RoadBiomeId = 'alpine' | 'canyon' | 'neon' | 'sakura';
export type RoadSelectionMode = RoadBiomeId | 'tour';

export interface RoadBiomeConfig {
  id: RoadBiomeId;
  name: string;
  shortName: string;
  badgeColor: string;
  skyStops: [string, string, string];
  sunColor: string;
  sunGlow: string;
  isNight: boolean;
  cloudShadow: string;
  cloudTop: string;
  mtnFar: string;
  mtnNear: string;
  valleyStops: [string, string, string];
  asphaltEven: string;
  asphaltOdd: string;
  edgeStripe: string;
  centerLine: string;
  curbA: string;
  curbB: string;
  railLight: string;
  railDark: string;
  railSpec: string;
  pierLight: string;
  pierDark: string;
  wallLeft: string;
  wallRight: string;
  underside: string;
  gantryAccent: string;
  gantrySign: string;
  lampColor: string;
  propStyle: 'pine' | 'cactus' | 'tower' | 'sakura';
  ambientParticle: 'none' | 'embers' | 'neon_orb' | 'petal';
}

export const ROAD_BIOME_ORDER: RoadBiomeId[] = ['alpine', 'canyon', 'neon', 'sakura'];

export const ROAD_BIOMES: Record<RoadBiomeId, RoadBiomeConfig> = {
  alpine: {
    id: 'alpine',
    name: 'Alpine Viaduct',
    shortName: 'Alpine',
    badgeColor: '#38bdf8',
    skyStops: ['#6bb8e2', '#a3d9ee', '#fdebd9'],
    sunColor: '#fef9c3',
    sunGlow: 'rgba(254, 240, 138, 0.38)',
    isNight: false,
    cloudShadow: '#ead7db',
    cloudTop: '#fff9f2',
    mtnFar: '#9bb2c9',
    mtnNear: '#7d97b3',
    valleyStops: ['#b3dba2', '#8fc27e', '#63955c'],
    asphaltEven: '#525966',
    asphaltOdd: '#4d5461',
    edgeStripe: '#e2e8f0',
    centerLine: 'rgba(226, 232, 240, 0.38)',
    curbA: '#ef4444',
    curbB: '#f8fafc',
    railLight: '#8b96a5',
    railDark: '#758292',
    railSpec: '#e2e8f0',
    pierLight: '#738291',
    pierDark: '#53606e',
    wallLeft: '#5b6675',
    wallRight: '#4a5565',
    underside: '#3f4854',
    gantryAccent: '#22d3ee',
    gantrySign: 'APEX PASS',
    lampColor: '#fef08a',
    propStyle: 'pine',
    ambientParticle: 'none',
  },
  canyon: {
    id: 'canyon',
    name: 'Sunset Canyon Ridge',
    shortName: 'Canyon',
    badgeColor: '#fb923c',
    skyStops: ['#4c1d95', '#ea580c', '#fed7aa'],
    sunColor: '#fde047',
    sunGlow: 'rgba(251, 146, 60, 0.45)',
    isNight: false,
    cloudShadow: '#c2410c',
    cloudTop: '#fdba74',
    mtnFar: '#9a3412',
    mtnNear: '#7c2d12',
    valleyStops: ['#d97706', '#b45309', '#78350f'],
    asphaltEven: '#4b4453',
    asphaltOdd: '#433d4b',
    edgeStripe: '#fde68a',
    centerLine: 'rgba(251, 191, 36, 0.55)',
    curbA: '#f97316',
    curbB: '#fef3c7',
    railLight: '#a8a29e',
    railDark: '#78716c',
    railSpec: '#fed7aa',
    pierLight: '#92400e',
    pierDark: '#78350f',
    wallLeft: '#78716c',
    wallRight: '#57534e',
    underside: '#44403c',
    gantryAccent: '#f97316',
    gantrySign: 'CANYON 99',
    lampColor: '#fdba74',
    propStyle: 'cactus',
    ambientParticle: 'embers',
  },
  neon: {
    id: 'neon',
    name: 'Midnight Neon Expressway',
    shortName: 'Neon',
    badgeColor: '#22d3ee',
    skyStops: ['#050816', '#1e1b4b', '#4c1d95'],
    sunColor: '#e0f2fe',
    sunGlow: 'rgba(34, 211, 238, 0.35)',
    isNight: true,
    cloudShadow: '#312e81',
    cloudTop: '#6366f1',
    mtnFar: '#1e1b4b',
    mtnNear: '#0f172a',
    valleyStops: ['#0f172a', '#090d1a', '#030712'],
    asphaltEven: '#1f2937',
    asphaltOdd: '#182230',
    edgeStripe: '#22d3ee',
    centerLine: 'rgba(244, 114, 182, 0.65)',
    curbA: '#06b6d4',
    curbB: '#ec4899',
    railLight: '#475569',
    railDark: '#334155',
    railSpec: '#22d3ee',
    pierLight: '#334155',
    pierDark: '#1e293b',
    wallLeft: '#334155',
    wallRight: '#1e293b',
    underside: '#0f172a',
    gantryAccent: '#ec4899',
    gantrySign: 'WANGAN',
    lampColor: '#22d3ee',
    propStyle: 'tower',
    ambientParticle: 'neon_orb',
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura Mountain Touge',
    shortName: 'Sakura',
    badgeColor: '#f472b6',
    skyStops: ['#38bdf8', '#f9a8d4', '#fce7f3'],
    sunColor: '#fff1f2',
    sunGlow: 'rgba(244, 114, 182, 0.40)',
    isNight: false,
    cloudShadow: '#fbcfe8',
    cloudTop: '#ffffff',
    mtnFar: '#a5b4fc',
    mtnNear: '#6366f1',
    valleyStops: ['#86efac', '#4ade80', '#15803d'],
    asphaltEven: '#475569',
    asphaltOdd: '#3f4d60',
    edgeStripe: '#fbcfe8',
    centerLine: 'rgba(255, 255, 255, 0.45)',
    curbA: '#ec4899',
    curbB: '#fdf2f8',
    railLight: '#cbd5e1',
    railDark: '#94a3b8',
    railSpec: '#fce7f3',
    pierLight: '#94a3b8',
    pierDark: '#64748b',
    wallLeft: '#64748b',
    wallRight: '#475569',
    underside: '#334155',
    gantryAccent: '#f472b6',
    gantrySign: 'TOUGE',
    lampColor: '#fbcfe8',
    propStyle: 'sakura',
    ambientParticle: 'petal',
  },
};

export const ROAD_MODE_OPTIONS: {
  id: RoadSelectionMode;
  label: string;
  color: string;
}[] = [
  { id: 'tour', label: 'World Tour', color: '#fbbf24' },
  { id: 'alpine', label: 'Alpine', color: ROAD_BIOMES.alpine.badgeColor },
  { id: 'canyon', label: 'Canyon', color: ROAD_BIOMES.canyon.badgeColor },
  { id: 'neon', label: 'Neon', color: ROAD_BIOMES.neon.badgeColor },
  { id: 'sakura', label: 'Sakura', color: ROAD_BIOMES.sakura.badgeColor },
];

export const TOUR_BIOME_INTERVAL_METERS = 450;

export function resolveRoadBiome(
  mode: RoadSelectionMode,
  distanceMeters = 0
): RoadBiomeConfig {
  if (mode !== 'tour') {
    return ROAD_BIOMES[mode] || ROAD_BIOMES.alpine;
  }
  const safeDist = Math.max(0, distanceMeters);
  const idx =
    Math.floor(safeDist / TOUR_BIOME_INTERVAL_METERS) % ROAD_BIOME_ORDER.length;
  return ROAD_BIOMES[ROAD_BIOME_ORDER[idx]];
}

export const INV_SQRT2 = Math.SQRT1_2;

export function getDirectionVector(dir: DiagonalDirection): { vx: number; vz: number; yaw: number } {
  if (dir === 'right') {
    return { vx: INV_SQRT2, vz: -INV_SQRT2, yaw: -Math.PI / 4 };
  }
  return { vx: -INV_SQRT2, vz: -INV_SQRT2, yaw: Math.PI / 4 };
}

export function flipDirection(dir: DiagonalDirection): DiagonalDirection {
  return dir === 'right' ? 'left' : 'right';
}

export function computeEffectiveCarStats(
  car: CarSpec,
  upgrades: CarUpgradeLevels = { speed: 1, handling: 1, magnet: 1 },
  custom?: Partial<CarCustomization>
) {
  const speedLv = Math.min(5, Math.max(1, upgrades.speed || 1));
  const handlingLv = Math.min(5, Math.max(1, upgrades.handling || 1));
  const magnetLv = Math.min(5, Math.max(1, upgrades.magnet || 1));

  const engineOpt = ENGINE_OPTIONS.find((e) => e.id === (custom?.engine || 'stock')) || ENGINE_OPTIONS[0];
  const tireOpt = TIRE_OPTIONS.find((t) => t.id === (custom?.tires || 'stock')) || TIRE_OPTIONS[0];

  return {
    topSpeed: Number((car.baseSpeed + (speedLv - 1) * 1.25 + engineOpt.speedBonus + tireOpt.speedDelta).toFixed(2)),
    driftGrip: Number(Math.max(0.55, Math.min(1.05, car.driftGrip + (handlingLv - 1) * 0.02 + tireOpt.gripDelta)).toFixed(3)),
    handlingRate: Number(((car.handling + engineOpt.handlingBonus) * 2.8 + (handlingLv - 1) * 0.32).toFixed(2)),
    roadAllowanceBonus: Number(((handlingLv - 1) * 0.25 + (car.driftGrip - 0.70) * 1.4).toFixed(2)),
    magnetRadius: Number((2.8 + (magnetLv - 1) * 0.8).toFixed(2)),
    coinMultiplier: car.coinMultiplier,
    feverGainRate: Number((car.feverGainRate + engineOpt.feverBonus).toFixed(2)),
  };
}

export function getUpgradeCost(carTier: number, currentLevel: number): number {
  if (currentLevel >= 5) return 0;
  return Math.round(60 * carTier * Math.pow(1.55, currentLevel - 1));
}

/**
 * Drift Physics State & Simulation Step
 * Separates forward velocity from lateral friction to model drift slip angle,
 * counter-steering, and progressive tire slip.
 * Note: World space uses -Z as forward, +X as right. Heading = -PI/2 is straight -Z.
 */
export interface DriftPhysicsState {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  heading: number;       // Chassis angle in radians (-PI/2 is straight ahead -Z)
  angularVelocity: number;
  slipAngle: number;     // Signed angle between velocity heading and chassis heading
  absSlipAngle: number;  // Absolute slip angle in radians
  isDrifting: boolean;
  driftFactor: number;   // 0..1 intensity of current drift
}

export function createInitialDriftState(
  startX = 0,
  startZ = 0,
  startY = 0,
  initialHeading = -Math.PI / 2,
  initialSpeed = 16.0
): DriftPhysicsState {
  return {
    x: startX,
    z: startZ,
    y: startY,
    vx: Math.cos(initialHeading) * initialSpeed,
    vz: Math.sin(initialHeading) * initialSpeed,
    heading: initialHeading,
    angularVelocity: 0,
    slipAngle: 0,
    absSlipAngle: 0,
    isDrifting: false,
    driftFactor: 0,
  };
}

export function normalizeAngle(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

export function stepDriftPhysics(
  state: DriftPhysicsState,
  inputs: {
    steerInput: number;   // -1 (steer left), 0, +1 (steer right)
    throttle: number;     // 0..1.3
    handbrake?: boolean;  // manual drift trigger
    roadTangentAngle?: number; // subtle stabilization assist when no steering is held
  },
  stats: {
    topSpeed: number;
    driftGrip: number;
    handlingRate: number;
  },
  dt: number
): DriftPhysicsState {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);

  const forwardX = Math.cos(state.heading);
  const forwardZ = Math.sin(state.heading);
  const rightX = -forwardZ;
  const rightZ = forwardX;

  // Steering angular velocity:
  // In screen space (X right, -Z up/forward):
  // Heading = -PI/2 -> cos=0, sin=-1 (straight forward)
  // Steering RIGHT (+1) increases heading toward 0 (cos > 0, sin < 0 -> +X, -Z)
  // Steering LEFT (-1) decreases heading toward -PI (cos < 0, sin < 0 -> -X, -Z)
  const steerRate = stats.handlingRate * (inputs.handbrake ? 1.3 : 1.0);
  let targetAngVel = inputs.steerInput * steerRate;

  // Gentle auto-alignment toward velocity/road tangent when releasing steering
  if (Math.abs(inputs.steerInput) < 0.05 && inputs.roadTangentAngle !== undefined) {
    const angleToRoad = normalizeAngle(inputs.roadTangentAngle - state.heading);
    targetAngVel = angleToRoad * 1.15;
  }

  const angularLerpRate = inputs.handbrake ? 9.0 : 13.0;
  const nextAngVel =
    state.angularVelocity +
    (targetAngVel - state.angularVelocity) * Math.min(1, angularLerpRate * clampedDt);
  const nextHeading = normalizeAngle(state.heading + nextAngVel * clampedDt);

  // Decompose velocity into forward & lateral components along chassis
  const vForward = state.vx * forwardX + state.vz * forwardZ;
  const vLateral = state.vx * rightX + state.vz * rightZ;

  // Engine drive acceleration
  const desiredForwardSpeed = stats.topSpeed * Math.max(0.55, inputs.throttle);
  const accelRate = 4.2;
  const nextVForward = vForward + (desiredForwardSpeed - vForward) * Math.min(1, accelRate * clampedDt);

  // Lateral friction: lower grip during active steering or handbrake produces juicy tail-out drift!
  const isActivelyTurning = Math.abs(inputs.steerInput) > 0.1 || !!inputs.handbrake;
  const effectiveGrip = inputs.handbrake
    ? 1.8
    : isActivelyTurning
    ? stats.driftGrip * 3.1
    : stats.driftGrip * 6.5;

  const lateralRetention = Math.exp(-effectiveGrip * clampedDt);
  const nextVLateral = vLateral * lateralRetention;

  const nextVx = forwardX * nextVForward + rightX * nextVLateral;
  const nextVz = forwardZ * nextVForward + rightZ * nextVLateral;

  // Calculate signed & absolute slip angle
  const currentSpeed = Math.hypot(nextVx, nextVz);
  let slipAngle = 0;
  if (currentSpeed > 2.0) {
    const velocityHeading = Math.atan2(nextVz, nextVx);
    slipAngle = normalizeAngle(nextHeading - velocityHeading);
  }
  const absSlipAngle = Math.abs(slipAngle);

  // Drift threshold: slip angle > 0.14 rad (~8 degrees) or active steering at speed
  const driftThreshold = 0.14;
  const isDrifting =
    currentSpeed > 8.0 &&
    (absSlipAngle > driftThreshold || !!inputs.handbrake || (isActivelyTurning && absSlipAngle > 0.08));
  const driftFactor = isDrifting
    ? Math.min(1.0, (absSlipAngle - 0.08) / 0.5 + (inputs.handbrake ? 0.35 : 0.15))
    : 0;

  const nextX = state.x + nextVx * clampedDt;
  const nextZ = state.z + nextVz * clampedDt;

  return {
    x: nextX,
    z: nextZ,
    y: state.y,
    vx: nextVx,
    vz: nextVz,
    heading: nextHeading,
    angularVelocity: nextAngVel,
    slipAngle,
    absSlipAngle,
    isDrifting,
    driftFactor,
  };
}

/**
 * Planted Highway Physics Step (2-Lane Traffic Mode)
 * High lateral tire grip prevents perpetual drifting during normal lane changes,
 * supports Gas (accelerate) and Brake (decelerate) pedals around a comfortable cruise speed,
 * and self-centers cleanly onto the highway tangent when steering is released.
 */
export function stepHighwayPhysics(
  state: DriftPhysicsState,
  inputs: {
    steerInput: number;        // -1 (left) .. +1 (right)
    accelInput: number;        // 0..1 (Gas pedal)
    brakeInput: number;        // 0..1 (Brake pedal)
    handbrake?: boolean;       // optional emergency drift swerve
    roadTangentAngle?: number; // highway direction for strong self-centering
  },
  stats: {
    topSpeed: number;
    handlingRate: number;
  },
  dt: number
): DriftPhysicsState {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);

  const forwardX = Math.cos(state.heading);
  const forwardZ = Math.sin(state.heading);
  const rightX = -forwardZ;
  const rightZ = forwardX;

  const steerRate = stats.handlingRate * (inputs.handbrake ? 1.15 : 0.78);
  let targetAngVel = inputs.steerInput * steerRate;

  // Strong self-centering onto highway lane direction when steering is released
  if (Math.abs(inputs.steerInput) < 0.05 && inputs.roadTangentAngle !== undefined) {
    const angleToRoad = normalizeAngle(inputs.roadTangentAngle - state.heading);
    targetAngVel = angleToRoad * 3.8;
  }

  const angularLerpRate = Math.abs(inputs.steerInput) < 0.05 ? 16.0 : 14.0;
  const nextAngVel =
    state.angularVelocity +
    (targetAngVel - state.angularVelocity) * Math.min(1, angularLerpRate * clampedDt);
  let nextHeading = normalizeAngle(state.heading + nextAngVel * clampedDt);

  // Keep highway steering within crisp lane-change angles (no wild 90-deg spinouts unless handbraking)
  if (!inputs.handbrake && inputs.roadTangentAngle !== undefined) {
    const rel = normalizeAngle(nextHeading - inputs.roadTangentAngle);
    const maxAngle = 0.65;
    if (Math.abs(rel) > maxAngle) {
      nextHeading = normalizeAngle(inputs.roadTangentAngle + Math.sign(rel) * maxAngle);
    }
  }

  const nextFwdX = Math.cos(nextHeading);
  const nextFwdZ = Math.sin(nextHeading);
  const nextRightX = -nextFwdZ;
  const nextRightZ = nextFwdX;

  // Decompose current velocity along current chassis axes
  const vForward = state.vx * forwardX + state.vz * forwardZ;
  const vLateral = state.vx * rightX + state.vz * rightZ;

  // Gas & Brake Pedal Speed Band:
  // - Brake held -> smoothly slow down to ~36% topSpeed (never stalls/reverses)
  // - Gas held   -> accelerate smoothly up to ~138% topSpeed
  // - Coasting   -> settle at ~78% topSpeed cruise
  const accel = Math.max(0, Math.min(1, inputs.accelInput));
  const brake = Math.max(0, Math.min(1, inputs.brakeInput));

  let desiredSpeed = stats.topSpeed * 0.78;
  let speedResponseRate = 3.2;
  if (brake > 0.05) {
    desiredSpeed = stats.topSpeed * (0.78 - 0.42 * brake); // down to 0.36 * topSpeed
    speedResponseRate = 8.8;
  } else if (accel > 0.05) {
    desiredSpeed = stats.topSpeed * (0.78 + 0.60 * accel); // up to 1.38 * topSpeed
    speedResponseRate = 5.6;
  }

  const nextVForward =
    vForward + (desiredSpeed - vForward) * Math.min(1, speedResponseRate * clampedDt);

  // High lateral grip keeps tires planted cleanly through lane weaves
  const effectiveGrip = inputs.handbrake ? 2.4 : 13.5;
  const nextVLateral = vLateral * Math.exp(-effectiveGrip * clampedDt);

  const nextVx = nextFwdX * nextVForward + nextRightX * nextVLateral;
  const nextVz = nextFwdZ * nextVForward + nextRightZ * nextVLateral;

  const currentSpeed = Math.hypot(nextVx, nextVz);
  let slipAngle = 0;
  if (currentSpeed > 2.0) {
    const velocityHeading = Math.atan2(nextVz, nextVx);
    slipAngle = normalizeAngle(nextHeading - velocityHeading);
  }
  const absSlipAngle = Math.abs(slipAngle);

  // Only count as drifting on highway if handbrake is explicitly held at speed
  const isDrifting = Boolean(inputs.handbrake && absSlipAngle > 0.14 && currentSpeed > 8.0);
  const driftFactor = isDrifting ? Math.min(1.0, (absSlipAngle - 0.1) / 0.45) : 0;

  return {
    x: state.x + nextVx * clampedDt,
    z: state.z + nextVz * clampedDt,
    y: state.y,
    vx: nextVx,
    vz: nextVz,
    heading: nextHeading,
    angularVelocity: nextAngVel,
    slipAngle,
    absSlipAngle,
    isDrifting,
    driftFactor,
  };
}


/**
 * Smooth Continuous Procedural S-Curve Overpass Track
 * Guarantees the road always flows forward (-Z) while sweeping smoothly left & right
 * in dramatic S-curves and bends without ever looping back onto itself.
 */
export interface SCurvePoint {
  index: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  tx: number; // unit forward tangent
  tz: number;
  nx: number; // unit perpendicular right normal
  nz: number;
  width: number;
  bankAngle: number;
  curvature: number;
  hasCoin: boolean;
  coinX: number;
  coinZ: number;
  coinCollected?: boolean;
  hasNitroGem?: boolean;
  gemCollected?: boolean;
  hasBoostPad: boolean;
  boostX: number;
  boostZ: number;
  boostTriggered?: boolean;
  hasNitroCanister?: boolean;
  canisterCollected?: boolean;
  canisterX?: number;
  canisterZ?: number;
}

function buildTrackPointsFrom(
  startIndex: number,
  startX: number,
  startZ: number,
  count: number,
  stepDistance: number,
  seed: number
): SCurvePoint[] {
  const points: SCurvePoint[] = [];
  let curX = startX;
  let curZ = startZ;

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;

    // Smooth S-curve angle around straight-ahead (-PI/2):
    // First 12 points form a clean straight-ahead launchpad so player survives first 5+ seconds safely
    let angleOffset = 0;
    let curvature = 0;
    if (idx >= 12) {
      const ramp = Math.min(1, (idx - 12) / 14);
      const t = (idx - 12) * 0.115;
      // Superposition of two harmonic waves creates organic sweeping S-curves and hairpins
      const w1 = Math.sin(t * 0.85 + seed * 0.13) * 0.62;
      const w2 = Math.sin(t * 0.37 + seed * 0.71) * 0.28;
      angleOffset = ramp * (w1 + w2);
      // Clamp maximum angle from -Z to +/- 54 degrees (~0.94 rad) so road always advances forward
      angleOffset = Math.max(-0.94, Math.min(0.94, angleOffset));

      // Approximate derivative for banking & curvature
      const dt = 0.115;
      const w1p = Math.cos(t * 0.85 + seed * 0.13) * 0.62 * 0.85 * dt;
      const w2p = Math.cos(t * 0.37 + seed * 0.71) * 0.28 * 0.37 * dt;
      curvature = ramp * (w1p + w2p);
    }

    const heading = -Math.PI / 2 + angleOffset;
    const tx = Math.cos(heading);
    const tz = Math.sin(heading);
    // Right perpendicular vector in XZ plane (with -Z forward, +X is right)
    const nx = -tz;
    const nz = tx;

    const difficulty = Math.min(1, Math.max(0, (idx - 12) / 140));
    const width = idx < 14 ? 8.8 : Number((8.4 - difficulty * 2.2).toFixed(2));
    const elevRamp = Math.min(1, Math.max(0, (idx - 6) / 10));
    const yElevation = Number(
      (
        elevRamp *
        (Math.sin(idx * 0.052 + seed * 0.11) * 1.9 + Math.cos(idx * 0.023 + seed * 0.07) * 1.1)
      ).toFixed(2)
    );
    const bankAngle = Number((-curvature * 2.0).toFixed(3));

    const hasBoostPad = idx >= 18 && idx % 22 === 0;
    const hasNitroCanister = idx >= 30 && idx % 80 === 0 && !hasBoostPad;
    const hasNitroGem = idx >= 15 && idx % 17 === 0 && !hasBoostPad && !hasNitroCanister;
    const hasCoin = idx >= 6 && idx % 3 === 0 && !hasNitroGem && !hasNitroCanister;
    const coinOffset = Math.sin(idx * 0.7) * (width * 0.22);
    const coinX = curX + nx * coinOffset;
    const coinZ = curZ + nz * coinOffset;
    const canisterOffset = Math.sin(idx * 0.45) * (width * 0.24);
    const canisterX = curX + nx * canisterOffset;
    const canisterZ = curZ + nz * canisterOffset;

    points.push({
      index: idx,
      x: curX,
      y: yElevation,
      z: curZ,
      heading,
      tx,
      tz,
      nx,
      nz,
      width,
      bankAngle,
      curvature,
      hasCoin,
      coinX,
      coinZ,
      coinCollected: false,
      hasNitroGem,
      gemCollected: false,
      hasNitroCanister,
      canisterX,
      canisterZ,
      canisterCollected: false,
      hasBoostPad,
      boostX: curX,
      boostZ: curZ,
      boostTriggered: false,
    });

    curX += tx * stepDistance;
    curZ += tz * stepDistance;
  }

  return points;
}

export function generateSCurveTrack(
  sampleCount: number,
  stepDistance = 2.6,
  seed = 42
): SCurvePoint[] {
  return buildTrackPointsFrom(0, 0, 0, sampleCount, stepDistance, seed);
}

export function extendSCurveTrack(
  existingTrack: SCurvePoint[],
  count: number,
  stepDistance = 2.6,
  seed = 42
): SCurvePoint[] {
  if (existingTrack.length === 0) {
    return generateSCurveTrack(count, stepDistance, seed);
  }
  const last = existingTrack[existingTrack.length - 1];
  const nextX = last.x + last.tx * stepDistance;
  const nextZ = last.z + last.tz * stepDistance;
  return buildTrackPointsFrom(last.index + 1, nextX, nextZ, count, stepDistance, seed);
}

/**
 * Evaluates car position against the continuous S-curve ribbon.
 */
export function evaluateCarOnSCurveRoad(
  carX: number,
  carZ: number,
  track: SCurvePoint[],
  allowanceBonus = 0
): {
  onRoad: boolean;
  nearEdge: boolean;
  closestPoint: SCurvePoint | null;
  perpDistance: number;
  signedPerpOffset: number;
  halfWidth: number;
} {
  if (track.length === 0) {
    return {
      onRoad: false,
      nearEdge: false,
      closestPoint: null,
      perpDistance: Infinity,
      signedPerpOffset: 0,
      halfWidth: 3.5,
    };
  }

  let bestDistSq = Infinity;
  let bestPoint: SCurvePoint | null = null;

  for (let i = 0; i < track.length; i++) {
    const pt = track[i];
    if (Math.abs(carZ - pt.z) > 16) continue;
    const dx = carX - pt.x;
    const dz = carZ - pt.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPoint = pt;
    }
  }

  if (!bestPoint) {
    for (let i = 0; i < track.length; i++) {
      const pt = track[i];
      const dx = carX - pt.x;
      const dz = carZ - pt.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPoint = pt;
      }
    }
  }

  if (!bestPoint) {
    return {
      onRoad: false,
      nearEdge: false,
      closestPoint: null,
      perpDistance: Infinity,
      signedPerpOffset: 0,
      halfWidth: 3.5,
    };
  }

  const dx = carX - bestPoint.x;
  const dz = carZ - bestPoint.z;
  const signedPerpOffset = dx * bestPoint.nx + dz * bestPoint.nz;
  const perpDist = Math.abs(signedPerpOffset);
  const effectiveHalfWidth = bestPoint.width * 0.5 + allowanceBonus;

  const onRoad = perpDist <= effectiveHalfWidth;
  const nearEdge = onRoad && perpDist >= effectiveHalfWidth * 0.62;

  return {
    onRoad,
    nearEdge,
    closestPoint: bestPoint,
    perpDistance: perpDist,
    signedPerpOffset,
    halfWidth: effectiveHalfWidth,
  };
}

/**
 * Legacy RoadTile helpers preserved for compatibility
 */
export interface RoadTile {
  index: number;
  direction: DiagonalDirection;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  width: number;
  elevation: number;
  hasCoin: boolean;
  coinX: number;
  coinZ: number;
  coinCollected?: boolean;
  hasBoostPad: boolean;
  boostX: number;
  boostZ: number;
  boostTriggered?: boolean;
  biome: 'canyon' | 'neon_bridge' | 'sky_spire';
}

export function generateRoadTiles(
  count: number,
  startTile?: RoadTile,
  seedOffset = 0
): RoadTile[] {
  const tiles: RoadTile[] = [];
  const stepLength = 9.0;

  let prevX = startTile ? startTile.endX : 0;
  let prevZ = startTile ? startTile.endZ : 0;
  let startIndex = startTile ? startTile.index + 1 : 0;
  let currentDir: DiagonalDirection = startTile ? startTile.direction : 'right';

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    if (idx < 5) {
      currentDir = 'right';
    } else {
      const hash = Math.abs(Math.sin((idx + seedOffset) * 12.9898 + 78.233) * 43758.5453) % 1;
      if (prevX > 26) {
        currentDir = 'left';
      } else if (prevX < -26) {
        currentDir = 'right';
      } else if (hash > 0.42) {
        currentDir = flipDirection(currentDir);
      }
    }

    const vec = getDirectionVector(currentDir);
    const segLen = idx === 0 ? 22.0 : stepLength;
    const endX = prevX + vec.vx * segLen;
    const endZ = prevZ + vec.vz * segLen;

    const difficultyFactor = Math.min(1, Math.max(0, (idx - 5) / 85));
    const width = idx < 4 ? 7.4 : Number((6.4 - difficultyFactor * 1.9).toFixed(2));

    const midX = (prevX + endX) * 0.5;
    const midZ = (prevZ + endZ) * 0.5;
    const elevation = Number((Math.sin(idx * 0.18) * 0.65).toFixed(2));

    const hasCoin = idx >= 2 && idx % 2 === 0;
    const hasBoostPad = idx >= 6 && idx % 9 === 0;
    const biome: RoadTile['biome'] =
      idx < 25 ? 'canyon' : idx < 55 ? 'neon_bridge' : 'sky_spire';

    tiles.push({
      index: idx,
      direction: currentDir,
      startX: prevX,
      startZ: prevZ,
      endX,
      endZ,
      width,
      elevation,
      hasCoin,
      coinX: midX,
      coinZ: midZ,
      coinCollected: false,
      hasBoostPad,
      boostX: midX,
      boostZ: midZ,
      boostTriggered: false,
      biome,
    });

    prevX = endX;
    prevZ = endZ;
  }

  return tiles;
}

export function evaluateCarOnRoad(
  carX: number,
  carZ: number,
  tiles: RoadTile[],
  allowanceBonus = 0
): {
  onRoad: boolean;
  nearEdge: boolean;
  closestTile: RoadTile | null;
  perpDistance: number;
  halfWidth: number;
} {
  let bestDist = Infinity;
  let bestTile: RoadTile | null = null;

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const minZ = Math.min(t.startZ, t.endZ) - t.width;
    const maxZ = Math.max(t.startZ, t.endZ) + t.width;
    if (carZ < minZ - 4 || carZ > maxZ + 4) continue;

    const dx = t.endX - t.startX;
    const dz = t.endZ - t.startZ;
    const lenSq = dx * dx + dz * dz;
    if (lenSq <= 0.0001) continue;

    const proj = Math.max(0, Math.min(1, ((carX - t.startX) * dx + (carZ - t.startZ) * dz) / lenSq));
    const cx = t.startX + proj * dx;
    const cz = t.startZ + proj * dz;
    const dist = Math.hypot(carX - cx, carZ - cz);

    if (dist < bestDist) {
      bestDist = dist;
      bestTile = t;
    }
  }

  if (!bestTile) {
    return {
      onRoad: false,
      nearEdge: false,
      closestTile: null,
      perpDistance: Infinity,
      halfWidth: 2.5,
    };
  }

  const effectiveHalfWidth = bestTile.width * 0.5 + allowanceBonus;
  const onRoad = bestDist <= effectiveHalfWidth;
  const nearEdge = onRoad && bestDist >= effectiveHalfWidth * 0.62;

  return {
    onRoad,
    nearEdge,
    closestTile: bestTile,
    perpDistance: bestDist,
    halfWidth: effectiveHalfWidth,
  };
}

export function calculateDriftScoreStep(params: {
  distanceDelta: number;
  combo: number;
  isFever: boolean;
  nearEdge: boolean;
  isDrifting?: boolean;
  gameMode?: GameModeId;
}): { scoreDelta: number; feverDelta: number } {
  const { distanceDelta, combo, isFever, nearEdge, isDrifting } = params;

  const base = distanceDelta * 12;
  const driftBonus = isDrifting ? 1.8 : 1.0;
  const edgeBonus = nearEdge ? 1.65 : 1.0;
  const feverBonus = isFever ? 2.5 : 1.0;
  const multiplier = Math.max(1, combo) * driftBonus * edgeBonus * feverBonus;

  const scoreDelta = Math.max(0, base * multiplier);
  const feverDelta = (nearEdge || isDrifting) ? distanceDelta * 5.2 : distanceDelta * 1.4;

  return { scoreDelta, feverDelta };
}

/**
 * ============================================================================
 * GAME MODE IDS & 2-LANE HIGHWAY TRAFFIC MODE
 * ============================================================================
 */
export type GameModeId = 'drift' | 'highway_traffic' | 'parking';

export type TrafficVehicleKind = 'sedan' | 'hatch' | 'van' | 'box_truck' | 'sports';

export interface TrafficCarState {
  id: number;
  s: number;             // progress along highway centerline (world units)
  lane: -1 | 1;          // +1 = right lane (same direction), -1 = left lane (oncoming)
  lateralOffset: number; // signed perpendicular offset from road center (+ right, - left)
  baseLateralOffset?: number;
  targetLateralOffset?: number;
  yieldingToSide?: -1 | 1;
  yieldTimer?: number;
  flashedNotified?: boolean;
  speed: number;         // scalar forward speed magnitude (units/sec)
  isOncoming: boolean;   // true when lane === -1
  kind: TrafficVehicleKind;
  color: string;
  accentColor: string;
  overtaken: boolean;
  nearMissed: boolean;
  halfWidth: number;
  halfLength: number;
}

export const HIGHWAY_ROAD_WIDTH = 9.8;
export const ROAD_WIDTH = HIGHWAY_ROAD_WIDTH;
export const HIGHWAY_LANE_OFFSET = 2.25;

const TRAFFIC_CATALOG: {
  kind: TrafficVehicleKind;
  colors: string[];
  accentColor: string;
  halfWidth: number;
  halfLength: number;
  sameLaneSpeedRange: [number, number];
  oncomingSpeedRange: [number, number];
}[] = [
  {
    kind: 'sedan',
    colors: ['#94a3b8', '#2563eb', '#16a34a', '#b91c1c', '#e2e8f0'],
    accentColor: '#cbd5e1',
    halfWidth: 0.94,
    halfLength: 1.95,
    sameLaneSpeedRange: [10.5, 13.5],
    oncomingSpeedRange: [13.0, 17.5],
  },
  {
    kind: 'hatch',
    colors: ['#0ea5e9', '#f97316', '#84cc16', '#facc15', '#ec4899'],
    accentColor: '#f8fafc',
    halfWidth: 0.88,
    halfLength: 1.65,
    sameLaneSpeedRange: [10.0, 13.0],
    oncomingSpeedRange: [12.5, 16.5],
  },
  {
    kind: 'sports',
    colors: ['#dc2626', '#14b8a6', '#eab308', '#8b5cf6'],
    accentColor: '#0f172a',
    halfWidth: 0.96,
    halfLength: 1.95,
    sameLaneSpeedRange: [13.2, 16.0],
    oncomingSpeedRange: [16.5, 21.0],
  },
  {
    kind: 'van',
    colors: ['#e2e8f0', '#334155', '#0284c7', '#b45309'],
    accentColor: '#64748b',
    halfWidth: 1.00,
    halfLength: 2.15,
    sameLaneSpeedRange: [9.5, 11.8],
    oncomingSpeedRange: [11.5, 15.0],
  },
  {
    kind: 'box_truck',
    colors: ['#f59e0b', '#f1f5f9', '#0d9488', '#475569'],
    accentColor: '#fbbf24',
    halfWidth: 1.06,
    halfLength: 2.55,
    sameLaneSpeedRange: [8.2, 10.2],
    oncomingSpeedRange: [10.5, 13.2],
  },
];

function buildHighwayPointsFrom(
  startIndex: number,
  startX: number,
  startZ: number,
  count: number,
  stepDistance: number,
  seed: number
): SCurvePoint[] {
  const points: SCurvePoint[] = [];
  let curX = startX;
  let curZ = startZ;

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;

    let angleOffset = 0;
    let curvature = 0;
    if (idx >= 12) {
      const ramp = Math.min(1, (idx - 12) / 16);
      const t = (idx - 12) * 0.072;
      const w1 = Math.sin(t * 0.72 + seed * 0.13) * 0.28;
      const w2 = Math.sin(t * 0.31 + seed * 0.71) * 0.13;
      angleOffset = Math.max(-0.42, Math.min(0.42, ramp * (w1 + w2)));

      const dt = 0.072;
      const w1p = Math.cos(t * 0.72 + seed * 0.13) * 0.28 * 0.72 * dt;
      const w2p = Math.cos(t * 0.31 + seed * 0.71) * 0.13 * 0.31 * dt;
      curvature = ramp * (w1p + w2p);
    }

    const heading = -Math.PI / 2 + angleOffset;
    const tx = Math.cos(heading);
    const tz = Math.sin(heading);
    const nx = -tz;
    const nz = tx;

    const width = HIGHWAY_ROAD_WIDTH;
    const elevRamp = Math.min(1, Math.max(0, (idx - 6) / 10));
    const yElevation = Number(
      (
        elevRamp *
        (Math.sin(idx * 0.042 + seed * 0.11) * 1.55 + Math.cos(idx * 0.019 + seed * 0.07) * 0.9)
      ).toFixed(2)
    );
    const bankAngle = Number((-curvature * 1.1).toFixed(3));

    const hasBoostPad = idx >= 24 && idx % 28 === 0;
    const hasNitroCanister = idx >= 25 && idx % 75 === 0 && !hasBoostPad;
    const hasNitroGem = idx >= 18 && idx % 21 === 0 && !hasBoostPad && !hasNitroCanister;
    const hasCoin = idx >= 8 && idx % 4 === 0 && !hasNitroGem && !hasNitroCanister;
    const lanePick = idx % 8 < 4 ? HIGHWAY_LANE_OFFSET : -HIGHWAY_LANE_OFFSET;
    const coinX = curX + nx * lanePick;
    const coinZ = curZ + nz * lanePick;
    const canisterLane = idx % 150 < 75 ? HIGHWAY_LANE_OFFSET * 0.85 : -HIGHWAY_LANE_OFFSET * 0.85;
    const canisterX = curX + nx * canisterLane;
    const canisterZ = curZ + nz * canisterLane;

    points.push({
      index: idx,
      x: curX,
      y: yElevation,
      z: curZ,
      heading,
      tx,
      tz,
      nx,
      nz,
      width,
      bankAngle,
      curvature,
      hasCoin,
      coinX,
      coinZ,
      coinCollected: false,
      hasNitroGem,
      gemCollected: false,
      hasNitroCanister,
      canisterX,
      canisterZ,
      canisterCollected: false,
      hasBoostPad,
      boostX: curX + nx * HIGHWAY_LANE_OFFSET,
      boostZ: curZ + nz * HIGHWAY_LANE_OFFSET,
      boostTriggered: false,
    });

    curX += tx * stepDistance;
    curZ += tz * stepDistance;
  }

  return points;
}

export function generateHighwayTrack(
  sampleCount: number,
  stepDistance = 3.4,
  seed = 42
): SCurvePoint[] {
  return buildHighwayPointsFrom(0, 0, 0, sampleCount, stepDistance, seed);
}

export function extendHighwayTrack(
  existingTrack: SCurvePoint[],
  count: number,
  stepDistance = 3.4,
  seed = 42
): SCurvePoint[] {
  if (existingTrack.length === 0) {
    return generateHighwayTrack(count, stepDistance, seed);
  }
  const last = existingTrack[existingTrack.length - 1];
  const nextX = last.x + last.tx * stepDistance;
  const nextZ = last.z + last.tz * stepDistance;
  return buildHighwayPointsFrom(last.index + 1, nextX, nextZ, count, stepDistance, seed);
}

export function sampleTrackAtS(
  track: SCurvePoint[],
  s: number,
  stepDistance = 3.4
): {
  x: number;
  y: number;
  z: number;
  heading: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  width: number;
} | null {
  if (track.length === 0) return null;
  const firstS = track[0].index * stepDistance;
  const rel = (s - firstS) / stepDistance;
  const idx = Math.floor(rel);
  if (idx < 0) {
    const p = track[0];
    const diff = s - firstS;
    return {
      x: p.x + p.tx * diff,
      y: p.y,
      z: p.z + p.tz * diff,
      heading: p.heading,
      tx: p.tx,
      tz: p.tz,
      nx: p.nx,
      nz: p.nz,
      width: p.width,
    };
  }
  if (idx >= track.length - 1) {
    const p = track[track.length - 1];
    const lastS = p.index * stepDistance;
    const diff = s - lastS;
    return {
      x: p.x + p.tx * diff,
      y: p.y,
      z: p.z + p.tz * diff,
      heading: p.heading,
      tx: p.tx,
      tz: p.tz,
      nx: p.nx,
      nz: p.nz,
      width: p.width,
    };
  }

  const a = track[idx];
  const b = track[idx + 1];
  const t = Math.max(0, Math.min(1, rel - idx));
  const heading = a.heading + normalizeAngle(b.heading - a.heading) * t;
  const tx = Math.cos(heading);
  const tz = Math.sin(heading);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    heading,
    tx,
    tz,
    nx: -tz,
    nz: tx,
    width: a.width + (b.width - a.width) * t,
  };
}

function pseudoRand(seedVal: number): number {
  const x = Math.sin(seedVal * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generates staggered 2-lane traffic cars with guaranteed open overtaking gaps
 * so oncoming (-1) and same-lane (+1) cars never form an impassable wall.
 */
export function generateTrafficBatch(params: {
  startS: number;
  endS: number;
  nextIdStart: number;
  seed: number;
  existingCars: TrafficCarState[];
  difficultyProgress?: number; // 0..1
}): { cars: TrafficCarState[]; nextId: number } {
  const {
    startS,
    endS,
    nextIdStart,
    seed,
    existingCars,
    difficultyProgress = 0,
  } = params;

  const cars: TrafficCarState[] = [];
  let nextId = nextIdStart;
  const safeStartS = Math.max(58, startS); // Ensures >2.5s safe launch before first vehicle
  const minSpacingSameLane = Math.max(19, 28 - difficultyProgress * 7);
  const minGapOppositeLane = 15.5;

  let cursorS = safeStartS;
  let stepIdx = 0;

  while (cursorS < endS) {
    const rLane = pseudoRand(seed + cursorS * 0.37 + stepIdx * 11.3);
    const rKind = pseudoRand(seed + cursorS * 0.71 + stepIdx * 5.7);
    const rCol = pseudoRand(seed + cursorS * 1.13 + stepIdx * 3.1);
    const rSpd = pseudoRand(seed + cursorS * 1.49 + stepIdx * 7.9);
    const rGap = pseudoRand(seed + cursorS * 0.53 + stepIdx * 17.1);

    // ~54% same-lane cars to overtake, ~46% oncoming head-on cars to dodge
    const lane: -1 | 1 = rLane < 0.54 ? 1 : -1;
    const isOncoming = lane === -1;

    // Verify no overlap in same lane AND preserve a staggered passing pocket vs opposite lane
    const blockedInSameLane = [...existingCars, ...cars].some(
      (c) => c.lane === lane && Math.abs(c.s - cursorS) < minSpacingSameLane
    );
    const blockedOppositePocket = [...existingCars, ...cars].some(
      (c) => c.lane !== lane && Math.abs(c.s - cursorS) < minGapOppositeLane
    );

    if (!blockedInSameLane && !blockedOppositePocket) {
      const spec = TRAFFIC_CATALOG[Math.floor(rKind * TRAFFIC_CATALOG.length) % TRAFFIC_CATALOG.length];
      const color = spec.colors[Math.floor(rCol * spec.colors.length) % spec.colors.length];
      const [minSpd, maxSpd] = isOncoming ? spec.oncomingSpeedRange : spec.sameLaneSpeedRange;
      const speed = Number((minSpd + rSpd * (maxSpd - minSpd) + difficultyProgress * (isOncoming ? 2.5 : 1.0)).toFixed(2));
      const jitterLat = (pseudoRand(seed + stepIdx * 19.7) - 0.5) * 0.36;

      cars.push({
        id: nextId++,
        s: cursorS,
        lane,
        lateralOffset: lane * HIGHWAY_LANE_OFFSET + jitterLat,
        speed,
        isOncoming,
        kind: spec.kind,
        color,
        accentColor: spec.accentColor,
        overtaken: false,
        nearMissed: false,
        halfWidth: spec.halfWidth,
        halfLength: spec.halfLength,
      });
    }

    cursorS += Math.max(15, 22 - difficultyProgress * 5) + rGap * 14;
    stepIdx++;
  }

  return { cars, nextId };
}

export function evaluateTrafficInteraction(params: {
  playerS: number;
  playerLateralOffset: number;
  playerHalfWidth?: number;
  playerHalfLength?: number;
  trafficCars: TrafficCarState[];
}): {
  collidedCar: TrafficCarState | null;
  newlyOvertaken: TrafficCarState[];
  newlyNearMissed: TrafficCarState[];
} {
  const {
    playerS,
    playerLateralOffset,
    playerHalfWidth = 0.90,
    playerHalfLength = 1.90,
    trafficCars,
  } = params;

  let collidedCar: TrafficCarState | null = null;
  const newlyOvertaken: TrafficCarState[] = [];
  const newlyNearMissed: TrafficCarState[] = [];

  for (let i = 0; i < trafficCars.length; i++) {
    const car = trafficCars[i];
    const ds = playerS - car.s;
    const absDs = Math.abs(ds);
    const absDLat = Math.abs(playerLateralOffset - car.lateralOffset);

    const hitLen = (playerHalfLength + car.halfLength) * 0.84;
    const hitWidth = (playerHalfWidth + car.halfWidth) * 0.82;

    if (absDs < hitLen && absDLat < hitWidth) {
      collidedCar = car;
      break;
    }

    // Near-miss window when whipping past closely without touching
    if (
      !car.nearMissed &&
      absDs < playerHalfLength + car.halfLength + 1.2 &&
      absDLat < playerHalfWidth + car.halfWidth + 1.45
    ) {
      car.nearMissed = true;
      newlyNearMissed.push(car);
    }

    // Clean overtake once player's rear clears the traffic vehicle's front bumper
    if (!car.overtaken && ds > car.halfLength + playerHalfLength * 0.7) {
      car.overtaken = true;
      newlyOvertaken.push(car);
    }
  }

  return { collidedCar, newlyOvertaken, newlyNearMissed };
}

export const VALLEY_BASE_Y = -10.2;

/**
 * Deterministic 3D terrain elevation sampled relative to road lateral distance & world Z.
 * Keeps a clear recessed valley/river basin under the elevated viaduct while rising into
 * sloped embankments, foothills, canyon mesas, or stepped neon terraces on the flanks.
 */
export function sampleTerrainElevation(
  lateralDist: number,
  worldZ: number,
  biomeId: RoadBiomeId
): number {
  const absLat = Math.abs(lateralDist);
  if (absLat <= 10.5) {
    // Low river/gorge basin safely underneath the viaduct piers
    const riverDip = Math.cos((absLat / 10.5) * Math.PI * 0.5) * 0.8;
    return VALLEY_BASE_Y - riverDip;
  }

  const slopeT = Math.min(1, (absLat - 10.5) / 16.0);
  const outerT = Math.max(0, Math.min(1, (absLat - 26.5) / 28.0));

  if (biomeId === 'canyon') {
    // Stepped sandstone canyon terraces & rocky shelves
    const shelf = Math.floor(slopeT * 3) * 1.15 + outerT * 4.4;
    const ridgeWave = Math.sin(worldZ * 0.045 + lateralDist * 0.12) * 1.15;
    return VALLEY_BASE_Y + shelf + (ridgeWave > 0 ? ridgeWave : 0);
  }

  if (biomeId === 'neon') {
    // Tiered urban concrete decks flanking the expressway
    const deck = slopeT * 1.4 + (outerT > 0.2 ? 2.2 : 0);
    return VALLEY_BASE_Y + deck;
  }

  // Alpine & Sakura rolling organic mountain foothills
  const hills =
    Math.sin(worldZ * 0.036 + lateralDist * 0.09) * 1.45 +
    Math.cos(worldZ * 0.019 - lateralDist * 0.06) * 1.1;
  const rise = slopeT * 3.1 + outerT * 4.2 + (slopeT * 0.7 + 0.3) * hills;
  return VALLEY_BASE_Y + rise;
}

/**
 * Evaluates aerodynamic slipstream drafting behind same-lane vehicles in 2-lane highway mode.
 */
export function evaluateSlipstreamDraft(params: {
  playerS: number;
  playerLateralOffset: number;
  trafficCars: TrafficCarState[];
}): { draftingCar: TrafficCarState | null; intensity: number } {
  const { playerS, playerLateralOffset, trafficCars } = params;
  let bestCar: TrafficCarState | null = null;
  let bestGap = Infinity;

  for (let i = 0; i < trafficCars.length; i++) {
    const car = trafficCars[i];
    if (car.isOncoming) continue;
    const aheadDist = car.s - playerS;
    if (aheadDist < 3.4 || aheadDist > 21.0) continue;
    const latDiff = Math.abs(playerLateralOffset - car.lateralOffset);
    if (latDiff > 1.45) continue;
    if (aheadDist < bestGap) {
      bestGap = aheadDist;
      bestCar = car;
    }
  }

  if (!bestCar) {
    return { draftingCar: null, intensity: 0 };
  }

  const distScore = 1 - Math.max(0, Math.min(1, (bestGap - 3.6) / 17.4));
  const latDiff = Math.abs(playerLateralOffset - bestCar.lateralOffset);
  const alignScore = 1 - Math.max(0, Math.min(1, latDiff / 1.45));
  return {
    draftingCar: bestCar,
    intensity: Math.max(0.15, Math.min(1, distScore * 0.65 + alignScore * 0.35)),
  };
}

/**
 * Zero-allocation in-place array compaction preserving relative order of retained items.
 */
export function compactInPlace<T>(items: T[], keep: (item: T) => boolean): void {
  let writeIdx = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (keep(item)) {
      if (writeIdx !== i) {
        items[writeIdx] = item;
      }
      writeIdx++;
    }
  }
  items.length = writeIdx;
}

export function getOvertakeStreakLabel(streak: number): string {
  if (streak >= 6) return `UNSTOPPABLE x${streak}!`;
  if (streak === 5) return 'APEX SLASH x5!';
  if (streak === 4) return 'QUAD WEAVE x4!';
  if (streak === 3) return 'TRIPLE PASS x3!';
  if (streak === 2) return 'DOUBLE PASS x2!';
  return '';
}

/**
 * Triggers same-lane traffic cars directly ahead of the player to signal and yield laterally
 * out of the player's path when the player flashes high-beams or honks.
 */
export function triggerTrafficFlashYield(params: {
  playerS: number;
  playerLateralOffset: number;
  trafficCars: TrafficCarState[];
  rangeMeters?: number;
}): { yieldedCars: TrafficCarState[]; newlyFlashedCount: number } {
  const { playerS, playerLateralOffset, trafficCars, rangeMeters = 46 } = params;
  const yieldedCars: TrafficCarState[] = [];
  let newlyFlashedCount = 0;

  for (let i = 0; i < trafficCars.length; i++) {
    const car = trafficCars[i];
    if (car.isOncoming) continue;
    const ahead = car.s - playerS;
    if (ahead < 2.0 || ahead > rangeMeters) continue;

    const latDiff = Math.abs(car.lateralOffset - playerLateralOffset);
    if (latDiff > 2.5) continue;

    if (car.baseLateralOffset === undefined) {
      car.baseLateralOffset = car.lateralOffset;
    }

    // Move away from player's lateral position while staying safely in right-half / shoulder
    const yieldSide: -1 | 1 =
      playerLateralOffset > car.lateralOffset + 0.55 ? -1 : 1;
    const targetLat =
      yieldSide === 1
        ? Math.min(HIGHWAY_ROAD_WIDTH * 0.5 - car.halfWidth - 0.12, HIGHWAY_LANE_OFFSET + 1.55)
        : Math.max(0.55, HIGHWAY_LANE_OFFSET - 1.55);

    car.yieldingToSide = yieldSide;
    car.targetLateralOffset = Number(targetLat.toFixed(2));
    car.yieldTimer = 3.2;
    if (!car.flashedNotified) {
      car.flashedNotified = true;
      newlyFlashedCount += 1;
    }
    yieldedCars.push(car);
  }

  return { yieldedCars, newlyFlashedCount };
}

/**
 * Advances traffic positions and smoothly interpolates yielding cars toward their open shoulder pocket.
 */
export function stepTrafficCars(trafficCars: TrafficCarState[], dt: number): void {
  const clampedDt = Math.min(Math.max(dt, 0), 0.08);
  for (let i = 0; i < trafficCars.length; i++) {
    const c = trafficCars[i];
    c.s += c.isOncoming ? -c.speed * clampedDt : c.speed * clampedDt;

    if (c.yieldTimer && c.yieldTimer > 0) {
      c.yieldTimer = Math.max(0, c.yieldTimer - clampedDt);
      const goal = c.targetLateralOffset ?? c.lateralOffset;
      c.lateralOffset += (goal - c.lateralOffset) * Math.min(1, 5.2 * clampedDt);
      if (c.yieldTimer === 0) {
        c.yieldingToSide = undefined;
      }
    } else if (c.baseLateralOffset !== undefined && Math.abs(c.lateralOffset - c.baseLateralOffset) > 0.03) {
      c.lateralOffset += (c.baseLateralOffset - c.lateralOffset) * Math.min(1, 1.6 * clampedDt);
    }
  }
}


