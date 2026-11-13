const fs = require('fs');
const path = require('path');

const rosterData = JSON.parse(fs.readFileSync(path.join(__dirname, 'rosterData.json'), 'utf8'));

const tsTypesAndOptions = `export type DiagonalDirection = 'right' | 'left';

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
export const CAR_ROSTER: CarSpec[] = ${JSON.stringify(rosterData, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, 'generatedRulesHeader.ts'), tsTypesAndOptions);
console.log('generatedRulesHeader.ts written successfully!');
