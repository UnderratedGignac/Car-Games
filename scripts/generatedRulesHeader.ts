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
  flame: FlameColorId;
  number: string; // '73', '86', '01', '24', '77', '99', '13', '42', '90'
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

export const UNDERGLOW_OPTIONS: { id: UnderglowId; label: string; hex: string | null }[] = [
  { id: 'none', label: 'Off', hex: null },
  { id: 'cyan', label: 'Cyber Cyan', hex: '#22d3ee' },
  { id: 'amber', label: 'Sunset Amber', hex: '#fbbf24' },
  { id: 'pink', label: 'Sakura Neon', hex: '#f472b6' },
  { id: 'emerald', label: 'Nitro Green', hex: '#34d399' },
  { id: 'crimson', label: 'Crimson Glow', hex: '#fb7185' },
  { id: 'purple', label: 'Ultra Violet', hex: '#a855f7' },
  { id: 'white', label: 'Pure Xenon White', hex: '#f8fafc' },
  { id: 'gold', label: 'Imperial Gold', hex: '#facc15' },
  { id: 'ice_blue', label: 'Arctic Frost', hex: '#38bdf8' },
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

export const HORN_OPTIONS: { id: HornStyleId; label: string }[] = [
  { id: 'stock', label: 'Dual Street' },
  { id: 'jdm_sport', label: 'JDM Twin-Tone' },
  { id: 'air_horn', label: 'GT Air Horn' },
  { id: 'train_bass', label: 'Sub-Bass Blast' },
  { id: 'cyber_chirp', label: 'Cyber Pulse' },
  { id: 'truck_air_blast', label: 'Locomotive Blast' },
  { id: 'bike_beep', label: 'High-Pitch Road Beep' },
];

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
