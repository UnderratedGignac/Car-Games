/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DiagonalDirection = 'right' | 'left';

export type PaintFinishId =
  | 'stock'
  | 'electric_blue'
  | 'crimson_blaze'
  | 'sakura_pink'
  | 'solar_gold'
  | 'emerald_mint'
  | 'cyber_cyan'
  | 'pearl_white'
  | 'stealth_black';

export type LiveryPatternId = 'stock' | 'twin_stripes' | 'two_tone' | 'side_flash' | 'clean';
export type WingKitId = 'stock' | 'lip' | 'gt' | 'twin' | 'active' | 'cyber';
export type RimFinishId = 'stock' | 'alloy' | 'gold' | 'neon_cyan' | 'crimson' | 'matte_black';
export type UnderglowId = 'none' | 'cyan' | 'amber' | 'pink' | 'emerald' | 'crimson';
export type FlameColorId = 'stock' | 'amber' | 'nitro_blue' | 'plasma_pink' | 'emerald' | 'hellfire';

export type EngineModId =
  | 'stock'
  | 'twin_turbo'
  | 'supercharged'
  | 'v12_hybrid'
  | 'rotary_brap';

export type RoofModId =
  | 'stock'
  | 'carbon_panel'
  | 'roof_scoop'
  | 'moonroof'
  | 'light_bar'
  | 'vortex_fins';

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
  | 'center_tri';

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
  | 'cyber_chirp';

export type SoundProfileId =
  | 'stock'
  | 'jdm_turbo'
  | 'v8_muscle'
  | 'f1_scream'
  | 'rotary_braap';

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
  flame: FlameColorId;
  number: string; // '73', '86', '01', '24', '77', '99'
  engine?: EngineModId;
  roof?: RoofModId;
  tires?: TireSpecId;
  exhaust?: ExhaustStyleId;
  hood?: HoodStyleId;
  windows?: WindowTintId;
  horn?: HornStyleId;
  sound?: SoundProfileId;
  lights?: HeadlightKitId;
}

export const DEFAULT_CUSTOMIZATION: CarCustomization = {
  paint: 'stock',
  livery: 'stock',
  wing: 'stock',
  rims: 'stock',
  underglow: 'none',
  flame: 'stock',
  number: '73',
  engine: 'stock',
  roof: 'stock',
  tires: 'stock',
  exhaust: 'stock',
  hood: 'stock',
  windows: 'stock',
  horn: 'stock',
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
];

export const LIVERY_OPTIONS: { id: LiveryPatternId; label: string }[] = [
  { id: 'stock', label: 'Factory' },
  { id: 'twin_stripes', label: 'Twin Stripes' },
  { id: 'two_tone', label: 'Two-Tone Roof' },
  { id: 'side_flash', label: 'Side Flash' },
  { id: 'clean', label: 'Clean Debadged' },
];

export const WING_OPTIONS: { id: WingKitId; label: string }[] = [
  { id: 'stock', label: 'Factory' },
  { id: 'lip', label: 'Ducktail Lip' },
  { id: 'gt', label: 'GT Wing' },
  { id: 'twin', label: 'Twin Deck' },
  { id: 'active', label: 'Active Aero' },
  { id: 'cyber', label: 'High Swan-Neck' },
];

export const RIM_OPTIONS: { id: RimFinishId; label: string; hex: string | null }[] = [
  { id: 'stock', label: 'Factory', hex: null },
  { id: 'alloy', label: 'Forged Silver', hex: '#cbd5e1' },
  { id: 'gold', label: 'Bronze Gold', hex: '#fbbf24' },
  { id: 'neon_cyan', label: 'Electric Teal', hex: '#2dd4bf' },
  { id: 'crimson', label: 'Track Red', hex: '#ef4444' },
  { id: 'matte_black', label: 'Stealth Dark', hex: '#334155' },
];

export const UNDERGLOW_OPTIONS: { id: UnderglowId; label: string; hex: string | null }[] = [
  { id: 'none', label: 'Off', hex: null },
  { id: 'cyan', label: 'Cyber Cyan', hex: '#22d3ee' },
  { id: 'amber', label: 'Sunset Amber', hex: '#fbbf24' },
  { id: 'pink', label: 'Sakura Neon', hex: '#f472b6' },
  { id: 'emerald', label: 'Nitro Green', hex: '#34d399' },
  { id: 'crimson', label: 'Crimson Glow', hex: '#fb7185' },
];

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
];

export const ROOF_OPTIONS: { id: RoofModId; label: string }[] = [
  { id: 'stock', label: 'Factory' },
  { id: 'carbon_panel', label: 'Carbon Weave' },
  { id: 'roof_scoop', label: 'Rally Scoop' },
  { id: 'moonroof', label: 'Glass Sunroof' },
  { id: 'light_bar', label: 'LED Lightbar' },
  { id: 'vortex_fins', label: 'Vortex Fins' },
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

export const HORN_OPTIONS: { id: HornStyleId; label: string }[] = [
  { id: 'stock', label: 'Dual Street' },
  { id: 'jdm_sport', label: 'JDM Twin-Tone' },
  { id: 'air_horn', label: 'GT Air Horn' },
  { id: 'train_bass', label: 'Sub-Bass Blast' },
  { id: 'cyber_chirp', label: 'Cyber Pulse' },
];

export const SOUND_OPTIONS: { id: SoundProfileId; label: string }[] = [
  { id: 'stock', label: 'Balanced Coupe' },
  { id: 'jdm_turbo', label: 'Turbo Blow-Off' },
  { id: 'v8_muscle', label: 'Thundering V8' },
  { id: 'f1_scream', label: 'V12 High-Rev' },
  { id: 'rotary_braap', label: 'Rotary Braap' },
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

export const NUMBER_OPTIONS = ['73', '86', '01', '24', '77', '99'] as const;

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
  spoilerStyle: 'lip' | 'gt' | 'cyber' | 'twin' | 'active';
  bodyShape?: 'coupe' | 'truck' | 'muscle' | 'kei' | 'supercar' | 'roadster' | 'rally' | 'gt3' | 'wagon' | 'interceptor' | 'prototype';
  hoodFeature?: 'stripes' | 'carbon' | 'supercharger' | 'fog_lights' | 'neon_slits' | 'boss_scoop' | 'sakura';
  decalText?: string;
  cardImage?: string;
}

export interface CarUpgradeLevels {
  speed: number;    // 1..5
  handling: number; // 1..5
  magnet: number;   // 1..5
}

/**
 * 10 Distinct Playable Drift Cars (Progressive Tiers T1 -> T10):
 */
export const CAR_ROSTER: CarSpec[] = [
  {
    id: 'blue_jdm',
    tier: 1,
    name: 'Blue JDM Coupe',
    codename: 'STARTER BALANCED · #73 RACER',
    tagline: 'Metallic blue coupe with twin white racing stripes, GT rear wing, and classic #73 racing decals.',
    unlockCost: 0,
    baseSpeed: 22.0,
    driftGrip: 0.80,
    handling: 0.85,
    coinMultiplier: 1.0,
    feverGainRate: 1.0,
    primaryColor: '#2563eb',
    secondaryColor: '#1e293b',
    accentColor: '#ffffff',
    tailGlowColor: '#ef4444',
    spoilerStyle: 'gt',
    bodyShape: 'coupe',
    hoodFeature: 'stripes',
    decalText: '73',
  },
  {
    id: 'crimson_tuner',
    tier: 2,
    name: 'Crimson Street Tuner',
    codename: 'AGILE DRIFTER · TOUGE WEAPON',
    tagline: 'Glossy red body with matte black carbon hood, aggressive widebody fenders, and gold forged rims.',
    unlockCost: 180,
    baseSpeed: 23.8,
    driftGrip: 0.74,
    handling: 0.96,
    coinMultiplier: 1.25,
    feverGainRate: 1.2,
    primaryColor: '#dc2626',
    secondaryColor: '#171717',
    accentColor: '#fbbf24',
    tailGlowColor: '#f43f5e',
    spoilerStyle: 'gt',
    bodyShape: 'coupe',
    hoodFeature: 'carbon',
  },
  {
    id: 'emerald_truck',
    tier: 3,
    name: 'Emerald Drift Truck',
    codename: 'SLAMMED UTE · ROLL-BAR SLIDER',
    tagline: 'Slammed emerald street pickup with wide rear arches, tubular bed roll bar, and tail-happy weight balance.',
    unlockCost: 360,
    baseSpeed: 25.0,
    driftGrip: 0.72,
    handling: 0.88,
    coinMultiplier: 1.4,
    feverGainRate: 1.3,
    primaryColor: '#10b981',
    secondaryColor: '#064e3b',
    accentColor: '#a7f3d0',
    tailGlowColor: '#ef4444',
    spoilerStyle: 'lip',
    bodyShape: 'truck',
    hoodFeature: 'stripes',
  },
  {
    id: 'midnight_muscle',
    tier: 4,
    name: 'Midnight Purple Muscle',
    codename: 'HEAVY POWER · V8 SUPERCHARGED',
    tagline: 'Deep matte purple powerhouse with an exposed chrome supercharger scoop and massive rear contact patch.',
    unlockCost: 580,
    baseSpeed: 26.8,
    driftGrip: 0.69,
    handling: 0.78,
    coinMultiplier: 1.55,
    feverGainRate: 1.4,
    primaryColor: '#7c3aed',
    secondaryColor: '#090d16',
    accentColor: '#c084fc',
    tailGlowColor: '#ec4899',
    spoilerStyle: 'twin',
    bodyShape: 'muscle',
    hoodFeature: 'supercharger',
  },
  {
    id: 'sakura_silvia',
    tier: 5,
    name: 'Sakura Pink Silvia',
    codename: 'D1 SHOWSTOPPER · NEON DRIFT',
    tagline: 'Cherry-blossom pink and pearl white two-tone drift weapon with tall swan-neck aero and sakura flare.',
    unlockCost: 850,
    baseSpeed: 27.6,
    driftGrip: 0.79,
    handling: 0.98,
    coinMultiplier: 1.75,
    feverGainRate: 1.55,
    primaryColor: '#f472b6',
    secondaryColor: '#fdf2f8',
    accentColor: '#fbcfe8',
    tailGlowColor: '#fb7185',
    spoilerStyle: 'cyber',
    bodyShape: 'coupe',
    hoodFeature: 'sakura',
    decalText: '86',
  },
  {
    id: 'yellow_kei',
    tier: 6,
    name: 'Sunburst Yellow Kei-Racer',
    codename: 'TIGHT CORNERING · RALLY APEX',
    tagline: 'Featherweight compact yellow hatch with high-contrast black roof, wide rally fog lights, and razor turn-in.',
    unlockCost: 1150,
    baseSpeed: 26.4,
    driftGrip: 0.89,
    handling: 1.0,
    coinMultiplier: 1.95,
    feverGainRate: 1.65,
    primaryColor: '#eab308',
    secondaryColor: '#0f172a',
    accentColor: '#fef08a',
    tailGlowColor: '#f97316',
    spoilerStyle: 'lip',
    bodyShape: 'kei',
    hoodFeature: 'fog_lights',
  },
  {
    id: 'rally_legend',
    tier: 7,
    name: 'Azure Classic Rally',
    codename: 'GROUP-B ICON · QUAD-POD TURBO',
    tagline: 'Box-fender sapphire 90s rally legend with gold livery accents, quad bumper rally pods, and planted grip.',
    unlockCost: 1500,
    baseSpeed: 28.4,
    driftGrip: 0.91,
    handling: 0.94,
    coinMultiplier: 2.15,
    feverGainRate: 1.75,
    primaryColor: '#1d4ed8',
    secondaryColor: '#1e293b',
    accentColor: '#fbbf24',
    tailGlowColor: '#ef4444',
    spoilerStyle: 'twin',
    bodyShape: 'rally',
    hoodFeature: 'fog_lights',
    decalText: '01',
  },
  {
    id: 'cyber_supercar',
    tier: 8,
    name: 'Cyber White & Teal Supercar',
    codename: 'ENDGAME PRO · AERO V10 HYBRID',
    tagline: 'Sleek pearl-white aerodynamic body with vibrant neon teal underglow and high-downforce active aero wing.',
    unlockCost: 1950,
    baseSpeed: 29.8,
    driftGrip: 0.90,
    handling: 0.94,
    coinMultiplier: 2.4,
    feverGainRate: 1.9,
    primaryColor: '#f8fafc',
    secondaryColor: '#042f2e',
    accentColor: '#14b8a6',
    tailGlowColor: '#06b6d4',
    spoilerStyle: 'active',
    bodyShape: 'supercar',
    hoodFeature: 'neon_slits',
  },
  {
    id: 'solar_hypercar',
    tier: 9,
    name: 'Solar Gold Hypercar',
    codename: 'APEX PROTOTYPE · CARBON V12',
    tagline: 'Shimmering solar-gold mid-engine prototype with dorsal shark-fin, forged carbon vents, and extreme speed.',
    unlockCost: 2500,
    baseSpeed: 31.2,
    driftGrip: 0.88,
    handling: 0.96,
    coinMultiplier: 2.75,
    feverGainRate: 2.05,
    primaryColor: '#f59e0b',
    secondaryColor: '#18181b',
    accentColor: '#fef08a',
    tailGlowColor: '#f97316',
    spoilerStyle: 'cyber',
    bodyShape: 'supercar',
    hoodFeature: 'carbon',
  },
  {
    id: 'matte_boss',
    tier: 10,
    name: 'Matte Black Boss Roadster',
    codename: 'DRIFT KING · STEALTH OVERLORD',
    tagline: 'Stealth satin black convertible roadster with blood-red aero trim and roaring twin flame-throwing exhausts.',
    unlockCost: 3200,
    baseSpeed: 32.5,
    driftGrip: 0.86,
    handling: 0.97,
    coinMultiplier: 3.2,
    feverGainRate: 2.3,
    primaryColor: '#18181b',
    secondaryColor: '#450a0a',
    accentColor: '#ef4444',
    tailGlowColor: '#dc2626',
    spoilerStyle: 'cyber',
    bodyShape: 'roadster',
    hoodFeature: 'boss_scoop',
  },
  {
    id: 'cobalt_gt3',
    tier: 11,
    name: 'Cobalt GT3 Endurance',
    codename: 'WIDEBODY GT3 · CANARD AERO',
    tagline: 'Track-homologated cobalt GT3 coupe with neon-lime dive planes, roof airbox, and swan-neck wing.',
    unlockCost: 3900,
    baseSpeed: 33.4,
    driftGrip: 0.92,
    handling: 0.96,
    coinMultiplier: 3.4,
    feverGainRate: 2.35,
    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
    accentColor: '#a3e635',
    tailGlowColor: '#ef4444',
    spoilerStyle: 'cyber',
    bodyShape: 'gt3',
    hoodFeature: 'carbon',
    decalText: '24',
  },
  {
    id: 'crimson_wagon',
    tier: 12,
    name: 'Touge Drift Wagon',
    codename: 'SHOOTING BRAKE · LONG-ROOF SLIDER',
    tagline: 'Extended-roof metallic burgundy drift wagon with wide touring flares, side exhausts, and long-arc stability.',
    unlockCost: 4600,
    baseSpeed: 33.8,
    driftGrip: 0.85,
    handling: 0.95,
    coinMultiplier: 3.6,
    feverGainRate: 2.45,
    primaryColor: '#be123c',
    secondaryColor: '#18181b',
    accentColor: '#fde047',
    tailGlowColor: '#fb7185',
    spoilerStyle: 'twin',
    bodyShape: 'wagon',
    hoodFeature: 'stripes',
    decalText: '77',
  },
  {
    id: 'neon_interceptor',
    tier: 13,
    name: 'Midnight Interceptor',
    codename: 'HIGHWAY PURSUIT · TWIN-TURBO',
    tagline: 'Gunmetal midnight pursuit interceptor with tactical roof lightbar, xenon matrix optics, and quad titanium tips.',
    unlockCost: 5400,
    baseSpeed: 34.8,
    driftGrip: 0.90,
    handling: 0.98,
    coinMultiplier: 3.9,
    feverGainRate: 2.6,
    primaryColor: '#334155',
    secondaryColor: '#020617',
    accentColor: '#38bdf8',
    tailGlowColor: '#22d3ee',
    spoilerStyle: 'active',
    bodyShape: 'interceptor',
    hoodFeature: 'neon_slits',
  },
  {
    id: 'apex_valkyrie',
    tier: 14,
    name: 'Apex Carbon Valkyrie',
    codename: 'LE MANS PROTOTYPE · V12 HYPER',
    tagline: 'Obsidian carbon endurance prototype with rose-gold aero blades, exposed engine bay, and center tri-exhaust.',
    unlockCost: 6500,
    baseSpeed: 36.2,
    driftGrip: 0.93,
    handling: 1.0,
    coinMultiplier: 4.4,
    feverGainRate: 2.85,
    primaryColor: '#1e1b4b',
    secondaryColor: '#09090b',
    accentColor: '#fb7185',
    tailGlowColor: '#f43f5e',
    spoilerStyle: 'cyber',
    bodyShape: 'prototype',
    hoodFeature: 'boss_scoop',
    decalText: '99',
  },
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
  sound: SoundProfileId;
  lights: HeadlightKitId;
  headlightLensHex: string;
  headlightBeamHex: string;
} {
  const paintOpt = PAINT_OPTIONS.find((p) => p.id === (custom?.paint || 'stock'));
  const rimOpt = RIM_OPTIONS.find((r) => r.id === (custom?.rims || 'stock'));
  const glowOpt = UNDERGLOW_OPTIONS.find((u) => u.id === (custom?.underglow || 'none'));
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
    underglowHex: glowOpt?.hex || null,
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
    const hasNitroGem = idx >= 15 && idx % 17 === 0 && !hasBoostPad;
    const hasCoin = idx >= 6 && idx % 3 === 0 && !hasNitroGem;
    const coinOffset = Math.sin(idx * 0.7) * (width * 0.22);
    const coinX = curX + nx * coinOffset;
    const coinZ = curZ + nz * coinOffset;

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
 * 2-LANE HIGHWAY TRAFFIC MODE (Overtaking Same-Lane & Dodging Oncoming Cars)
 * ============================================================================
 */
export type GameModeId = 'drift' | 'highway_traffic';

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
    const hasNitroGem = idx >= 18 && idx % 21 === 0 && !hasBoostPad;
    const hasCoin = idx >= 8 && idx % 4 === 0 && !hasNitroGem;
    const lanePick = idx % 8 < 4 ? HIGHWAY_LANE_OFFSET : -HIGHWAY_LANE_OFFSET;
    const coinX = curX + nx * lanePick;
    const coinZ = curZ + nz * lanePick;

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


