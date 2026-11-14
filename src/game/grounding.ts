export const HERO_SPRITE_GROUND_V = 0.65;
export const TRAFFIC_SPRITE_GROUND_V = 0.68;

export const HERO_SHADOW_OFFSET_V = 1.5 / 144;
export const TRAFFIC_SHADOW_OFFSET_V = 1.5 / 108;

/**
 * Computes the screen-space center Y at which a 3D-projected car sprite of height `drawH`
 * must be drawn so that its ground-contact plane (`v = groundV`, where y = 0 tires rest)
 * aligns flush with the projected road surface point `projY`.
 */
export function getSpriteGroundCenterY(
  projY: number,
  drawH: number,
  groundV: number,
  verticalBouncePx = 0
): number {
  return projY - drawH * (groundV - 0.5) + verticalBouncePx;
}

/**
 * Inverse helper: returns the screen-space Y of a sprite's ground plane (`v = groundV`)
 * given the sprite center Y and drawn height.
 */
export function getSpriteGroundPlaneY(centerY: number, drawH: number, groundV: number): number {
  return centerY + drawH * (groundV - 0.5);
}

/**
 * Returns the screen-space Y for the hero / ghost external road contact shadow
 * aligned to the grounded chassis contact patch.
 */
export function getHeroGroundedShadowY(projY: number, drawH: number): number {
  return projY + drawH * HERO_SHADOW_OFFSET_V;
}

/**
 * Returns the screen-space Y for a highway traffic vehicle's external road contact shadow,
 * keeping the shadow pinned to the road surface even when `crashLiftPx > 0` lifts the car.
 */
export function getTrafficGroundedShadowY(
  projY: number,
  drawH: number,
  crashLiftPx = 0
): number {
  return projY + crashLiftPx + drawH * TRAFFIC_SHADOW_OFFSET_V;
}
