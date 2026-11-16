/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoadBiomeConfig, RoadBiomeId, SCurvePoint, VALLEY_BASE_Y, sampleTerrainElevation } from './rules';
import {
  AdventureZoneSample,
  resolveAdventureZone,
  sampleAdventureTerrainElevation,
} from './adventure';
import { sampleMountainTerrainElevation } from './mountain';
import {
  deterministicNoise,
  getChapterTerrainRamps,
  getRealisticCavePropSprite,
  getRealisticTreeSprite,
  getRealisticUndergrowthSprite,
  pickRampColor,
  resolveRealisticTreeSpecies,
  sampleCaveWallProfile,
  smoothTerrainMix,
} from './realisticNature';
import { getHeadlightRgba } from './headlights';

export interface Projected3D {
  x: number;
  y: number;
  z: number;
  scale: number;
}

export interface RoadSlice3D {
  pt: SCurvePoint;
  rawZ: number;
  pL: Projected3D;
  pR: Projected3D;
  uL: Projected3D;
  uR: Projected3D;
  gL: Projected3D;
  gR: Projected3D;
  cM: Projected3D;
}

export interface WorldProp3D {
  x: number;
  z: number;
  lateralOffset: number; // signed offset relative to local road centerline
  scale: number;
  shade: number;
  variant: number;
}

export type Project3DIntoFn = (
  wx: number,
  wy: number,
  wz: number,
  out: Projected3D,
  clampMinZ?: number
) => boolean;

const BIOME_TERRAIN_PALETTE: Record<
  RoadBiomeId,
  {
    riverBase: string;
    riverGlint: string;
    bankLight: string;
    bankDark: string;
    hillLight: string;
    hillDark: string;
    ridgeCap: string;
    shadowColor: string;
  }
> = {
  alpine: {
    riverBase: '#2b7a9b',
    riverGlint: '#7dd3fc',
    bankLight: '#6ca367',
    bankDark: '#558753',
    hillLight: '#5a8f5c',
    hillDark: '#447049',
    ridgeCap: '#7db372',
    shadowColor: 'rgba(15, 23, 42, 0.34)',
  },
  canyon: {
    riverBase: '#92400e',
    riverGlint: '#d97706',
    bankLight: '#c25e1a',
    bankDark: '#9a3412',
    hillLight: '#b45309',
    hillDark: '#7c2d12',
    ridgeCap: '#ea580c',
    shadowColor: 'rgba(28, 12, 6, 0.38)',
  },
  neon: {
    riverBase: '#082f49',
    riverGlint: '#22d3ee',
    bankLight: '#131c31',
    bankDark: '#0b1120',
    hillLight: '#1e293b',
    hillDark: '#0f172a',
    ridgeCap: '#06b6d4',
    shadowColor: 'rgba(2, 6, 23, 0.52)',
  },
  sakura: {
    riverBase: '#38bdf8',
    riverGlint: '#e0f2fe',
    bankLight: '#5ec97f',
    bankDark: '#3ba360',
    hillLight: '#4ade80',
    hillDark: '#16a34a',
    ridgeCap: '#fbcfe8',
    shadowColor: 'rgba(15, 23, 42, 0.30)',
  },
};

// Terrain station lateral offsets: [0..7] -> [-Outer, -Mid, -In, -River, +River, +In, +Mid, +Outer]
const TERRAIN_LATS = [-78.0, -26.0, -11.2, -5.4, 5.4, 11.2, 26.0, 78.0];

interface TerrainRow {
  pts: Projected3D[];
  ok: boolean[];
}

function createTerrainRow(): TerrainRow {
  return {
    pts: Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0, scale: 0 })),
    ok: new Array(8).fill(false),
  };
}

const terrainRowA = createTerrainRow();
const terrainRowB = createTerrainRow();
const shFL: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const shFR: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const shNL: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const shNR: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };

// Scratch points for 3D props & bridge arches (zero per-frame allocations)
const wpBase: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const wp0: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const wp1: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const wp2: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const wp3: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const wp4: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const wp5: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const wp6: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const wp7: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };

function addQuadSubpath(
  ctx: CanvasRenderingContext2D,
  a: Projected3D,
  b: Projected3D,
  c: Projected3D,
  d: Projected3D
) {
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

function drawQuadDirect(
  ctx: CanvasRenderingContext2D,
  a: Projected3D,
  b: Projected3D,
  c: Projected3D,
  d: Projected3D,
  fillStyle: string,
  strokeStyle?: string,
  lineWidth = 1
) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function fillTerrainRow(
  pt: SCurvePoint,
  biomeId: RoadBiomeId,
  projectInto: Project3DIntoFn,
  row: TerrainRow
) {
  for (let k = 0; k < 8; k++) {
    const lat = TERRAIN_LATS[k];
    const wx = pt.x + pt.nx * lat;
    const wz = pt.z + pt.nz * lat;
    const wy = sampleTerrainElevation(lat, wz, biomeId);
    row.ok[k] = projectInto(wx, wy, wz, row.pts[k], 0.55);
  }
}

export function computeDistanceFogAlpha(rawZ: number, fadeStart = 104, fadeEnd = 152): number {
  if (rawZ <= fadeStart) return 1;
  if (rawZ >= fadeEnd) return 0;
  return 1 - (rawZ - fadeStart) / (fadeEnd - fadeStart);
}

/**
 * Renders true 3D contoured terrain strips (riverbed, sloped embankments, rolling ridges,
 * and cast viaduct shadows) below & flanking the highway with zero per-frame allocations
 * and adjacent-band station reuse.
 */
export function renderTerrainMesh3D(params: {
  ctx: CanvasRenderingContext2D;
  visibleSlices: RoadSlice3D[];
  visibleCount: number;
  biome: RoadBiomeConfig;
  nowMs: number;
  projectInto: Project3DIntoFn;
  webglBackdropActive?: boolean;
}) {
  const { ctx, visibleSlices, visibleCount, biome, projectInto, webglBackdropActive = false } = params;
  const pal = BIOME_TERRAIN_PALETTE[biome.id];

  let farRow = terrainRowA;
  let nearRow = terrainRowB;
  let prevNearIndex = -999999;

  for (let i = 0; i < visibleCount - 1; i++) {
    const far = visibleSlices[i];
    const near = visibleSlices[i + 1];
    if (Math.abs(far.pt.index - near.pt.index) > 2) continue;
    if (far.rawZ > 152) continue;

    const fpt = far.pt;
    const npt = near.pt;
    const fogAlpha = computeDistanceFogAlpha(far.rawZ, 108, 152);
    if (fogAlpha <= 0.02) continue;

    if (fpt.index === prevNearIndex) {
      const tmp = farRow;
      farRow = nearRow;
      nearRow = tmp;
    } else {
      fillTerrainRow(fpt, biome.id, projectInto, farRow);
    }
    fillTerrainRow(npt, biome.id, projectInto, nearRow);
    prevNearIndex = npt.index;

    const fp = farRow.pts;
    const fo = farRow.ok;
    const np = nearRow.pts;
    const no = nearRow.ok;

    ctx.globalAlpha = fogAlpha;

    // 1. Outer 3D hills / canyon ridges / neon waterfront decks (skipped when WebGL 3D backdrop renders terrain & water)
    if (!webglBackdropActive) {
      if (fo[0] && fo[1] && no[1] && no[0]) {
        drawQuadDirect(ctx, fp[0], fp[1], np[1], np[0], pal.hillDark);
      }
      if (fo[6] && fo[7] && no[7] && no[6]) {
        drawQuadDirect(ctx, fp[6], fp[7], np[7], np[6], pal.hillLight);
      }
    }

    // 2 & 3. Sloped embankment walls + valley floor banks (smooth directional lighting, zero parity banding)
    const canSlopeL = fo[1] && fo[2] && no[2] && no[1];
    const canSlopeR = fo[5] && fo[6] && no[6] && no[5];
    const canBankL = fo[2] && fo[3] && no[3] && no[2];
    const canBankR = fo[4] && fo[5] && no[5] && no[4];

    if (canSlopeL || canBankR) {
      ctx.beginPath();
      if (canSlopeL) addQuadSubpath(ctx, fp[1], fp[2], np[2], np[1]);
      if (canBankR) addQuadSubpath(ctx, fp[4], fp[5], np[5], np[4]);
      ctx.fillStyle = pal.bankDark;
      ctx.fill();
      ctx.strokeStyle = pal.bankDark;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    if (canSlopeR || canBankL) {
      ctx.beginPath();
      if (canSlopeR) addQuadSubpath(ctx, fp[5], fp[6], np[6], np[5]);
      if (canBankL) addQuadSubpath(ctx, fp[2], fp[3], np[3], np[2]);
      ctx.fillStyle = pal.bankLight;
      ctx.fill();
      ctx.strokeStyle = pal.bankLight;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Subtle outer + inner ridge crest rim highlights (continuous smooth aerial depth)
    if (far.rawZ < 105) {
      const hasL = fo[1] && no[1];
      const hasR = fo[6] && no[6];
      const hasOutL = fo[0] && no[0];
      const hasOutR = fo[7] && no[7];
      if (hasL || hasR || hasOutL || hasOutR) {
        ctx.strokeStyle = pal.ridgeCap;
        ctx.globalAlpha = fogAlpha * (biome.id === 'neon' ? 0.24 : 0.14);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        if (hasL) {
          ctx.moveTo(Math.round(fp[1].x), Math.round(fp[1].y));
          ctx.lineTo(Math.round(np[1].x), Math.round(np[1].y));
        }
        if (hasR) {
          ctx.moveTo(Math.round(fp[6].x), Math.round(fp[6].y));
          ctx.lineTo(Math.round(np[6].x), Math.round(np[6].y));
        }
        if (hasOutL && far.rawZ > 24) {
          ctx.moveTo(Math.round(fp[0].x), Math.round(fp[0].y));
          ctx.lineTo(Math.round(np[0].x), Math.round(np[0].y));
        }
        if (hasOutR && far.rawZ > 24) {
          ctx.moveTo(Math.round(fp[7].x), Math.round(fp[7].y));
          ctx.lineTo(Math.round(np[7].x), Math.round(np[7].y));
        }
        ctx.stroke();
        ctx.globalAlpha = fogAlpha;
      }
    }

    // 4. Calm central river / canal / canyon wash beneath viaduct (let WebGL shader water show when active)
    if (!webglBackdropActive && fo[3] && fo[4] && no[4] && no[3]) {
      drawQuadDirect(ctx, fp[3], fp[4], np[4], np[3], pal.riverBase);
      if (far.rawZ < 92) {
        // Crisp riverbank shoreline bevel highlight along both water edges
        ctx.strokeStyle = pal.riverGlint;
        ctx.globalAlpha = fogAlpha * (biome.id === 'canyon' ? 0.14 : 0.24);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(fp[3].x), Math.round(fp[3].y));
        ctx.lineTo(Math.round(np[3].x), Math.round(np[3].y));
        ctx.moveTo(Math.round(fp[4].x), Math.round(fp[4].y));
        ctx.lineTo(Math.round(np[4].x), Math.round(np[4].y));
        ctx.stroke();

        if (fpt.index % 3 === 0) {
          const rx1 = fp[3].x + (fp[4].x - fp[3].x) * 0.22;
          const ry1 = fp[3].y + (fp[4].y - fp[3].y) * 0.22;
          const rx2 = fp[3].x + (fp[4].x - fp[3].x) * 0.78;
          const ry2 = fp[3].y + (fp[4].y - fp[3].y) * 0.78;
          ctx.globalAlpha = fogAlpha * (biome.id === 'canyon' ? 0.18 : 0.36);
          ctx.beginPath();
          ctx.moveTo(Math.round(rx1), Math.round(ry1));
          ctx.lineTo(Math.round(rx2), Math.round(ry2));
          ctx.stroke();
        }
        ctx.globalAlpha = fogAlpha;
      }
    }

    // 5. Cast Viaduct Bridge Shadow onto valley basin directly below the road deck
    if (far.rawZ < 92) {
      const shOff = 1.3;
      const fhw = fpt.width * 0.5;
      const nhw = npt.width * 0.5;
      const ok1 = projectInto(fpt.x - fpt.nx * fhw + shOff, VALLEY_BASE_Y - 0.5, fpt.z - fpt.nz * fhw, shFL, 0.55);
      const ok2 = projectInto(fpt.x + fpt.nx * fhw + shOff, VALLEY_BASE_Y - 0.5, fpt.z + fpt.nz * fhw, shFR, 0.55);
      const ok3 = projectInto(npt.x - npt.nx * nhw + shOff, VALLEY_BASE_Y - 0.5, npt.z - npt.nz * nhw, shNL, 0.55);
      const ok4 = projectInto(npt.x + npt.nx * nhw + shOff, VALLEY_BASE_Y - 0.5, npt.z + npt.nz * nhw, shNR, 0.55);
      if (ok1 && ok2 && ok3 && ok4) {
        drawQuadDirect(ctx, shFL, shFR, shNR, shNL, pal.shadowColor);
      }
    }
  }
  ctx.globalAlpha = 1.0;
}

/**
 * Renders a 3D extruded roadside object grounded onto the local terrain relief
 * with zero per-frame object allocations and distance-based LOD.
 */
export function renderWorldObject3D(params: {
  ctx: CanvasRenderingContext2D;
  prop: WorldProp3D;
  biome: RoadBiomeConfig;
  nowMs: number;
  pxW: number;
  projectInto: Project3DIntoFn;
}) {
  const { ctx, prop, biome, nowMs, pxW, projectInto } = params;
  const groundY = sampleTerrainElevation(prop.lateralOffset, prop.z, biome.id);
  if (!projectInto(prop.x, groundY, prop.z, wpBase)) return;
  if (wpBase.x < -36 || wpBase.x > pxW + 36 || wpBase.z > 158) return;

  const s = prop.scale;
  const sc = wpBase.scale;
  const rawZ = wpBase.z;
  const fogAlpha = computeDistanceFogAlpha(rawZ, 102, 154);
  if (fogAlpha <= 0.02) return;

  const bx = Math.round(wpBase.x);
  const by = Math.round(wpBase.y);
  const nearOutline = rawZ < 78;

  ctx.globalAlpha = fogAlpha;

  // Grounded contact shadow beneath mid/near 3D objects
  if (rawZ < 105) {
    const shW = Math.max(3, Math.round(2.3 * s * sc));
    const shH = Math.max(1, Math.round(shW * 0.35));
    ctx.fillStyle = 'rgba(9, 13, 22, 0.30)';
    ctx.beginPath();
    ctx.ellipse(bx + Math.round(shW * 0.25), by, shW, shH, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (biome.propStyle === 'tower') {
    // NEON BIOME: 3D Isometric Extruded Skyscrapers & Hologram Pylons
    const w3d = 3.2 * s;
    const d3d = 2.6 * s;
    const h3d = (prop.variant === 0 ? 11.5 : prop.variant === 1 ? 8.2 : 6.0) * s;
    const isLeft = prop.lateralOffset < 0;

    const okFL = projectInto(prop.x - w3d * 0.5, groundY, prop.z + d3d * 0.5, wp0);
    const okFR = projectInto(prop.x + w3d * 0.5, groundY, prop.z + d3d * 0.5, wp1);
    const okTR = projectInto(prop.x + w3d * 0.5, groundY + h3d, prop.z + d3d * 0.5, wp2);
    const okTL = projectInto(prop.x - w3d * 0.5, groundY + h3d, prop.z + d3d * 0.5, wp3);

    const sideX = isLeft ? prop.x + w3d * 0.5 : prop.x - w3d * 0.5;
    const okSB = projectInto(sideX, groundY, prop.z - d3d * 0.5, wp4);
    const okST = projectInto(sideX, groundY + h3d, prop.z - d3d * 0.5, wp5);

    const trimCol = prop.variant === 0 ? '#22d3ee' : prop.variant === 1 ? '#ec4899' : '#facc15';

    if (okFL && okFR && okTR && okTL) {
      drawQuadDirect(
        ctx,
        wp0,
        wp1,
        wp2,
        wp3,
        prop.shade > 0.5 ? '#1e293b' : '#172033'
      );

      ctx.strokeStyle = trimCol;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(wp3.x), Math.round(wp3.y));
      ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
      ctx.stroke();

      // Lit glass facade floor bands & window mullions (LOD step for smooth frame times)
      const bW = Math.round(Math.abs(wp1.x - wp0.x));
      const bH = Math.round(Math.abs(wp0.y - wp3.y));
      if (rawZ < 76 && bW >= 7 && bH >= 14) {
        const leftX = Math.round(Math.min(wp0.x, wp1.x));
        const topY = Math.round(wp3.y);
        const maxWX = leftX + bW - 3;
        const maxWY = topY + bH - 3;

        ctx.fillStyle = trimCol;
        for (let wy = topY + 3; wy < maxWY; wy += 6) {
          for (let wx = leftX + 2; wx < maxWX; wx += 5) {
            if ((wx + wy + prop.variant) % 3 !== 0 && (wx + wy) % 2 === 0) {
              ctx.fillRect(wx, wy, 2, 2);
            }
          }
        }
        ctx.fillStyle = '#fef08a';
        for (let wy = topY + 3; wy < maxWY; wy += 6) {
          for (let wx = leftX + 2; wx < maxWX; wx += 5) {
            if ((wx + wy + prop.variant) % 3 !== 0 && (wx + wy) % 2 !== 0) {
              ctx.fillRect(wx, wy, 2, 2);
            }
          }
        }
      }

      if (okSB && okST) {
        const edgeBot = isLeft ? wp1 : wp0;
        const edgeTop = isLeft ? wp2 : wp3;
        drawQuadDirect(ctx, edgeBot, wp4, wp5, edgeTop, '#0f172a');
      }

      if (prop.variant === 0 && rawZ < 96) {
        if (projectInto(prop.x, groundY + h3d + 2.4, prop.z + d3d * 0.5, wp6)) {
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.round((wp3.x + wp2.x) * 0.5), Math.round(wp3.y));
          ctx.lineTo(Math.round(wp6.x), Math.round(wp6.y));
          ctx.stroke();
          ctx.fillStyle = trimCol;
          ctx.fillRect(Math.round(wp6.x) - 1, Math.round(wp6.y) - 1, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  if (biome.propStyle === 'cactus') {
    if (prop.variant === 2) {
      const rw = 2.6 * s;
      const rd = 2.0 * s;
      const rh = 4.6 * s;
      const okFL = projectInto(prop.x - rw * 0.5, groundY, prop.z + rd * 0.5, wp0);
      const okFR = projectInto(prop.x + rw * 0.5, groundY, prop.z + rd * 0.5, wp1);
      const okTR = projectInto(prop.x + rw * 0.38, groundY + rh, prop.z + rd * 0.35, wp2);
      const okTL = projectInto(prop.x - rw * 0.38, groundY + rh, prop.z + rd * 0.35, wp3);
      const okSB = projectInto(prop.x + rw * 0.55, groundY, prop.z - rd * 0.4, wp4);
      const okST = projectInto(prop.x + rw * 0.42, groundY + rh, prop.z - rd * 0.35, wp5);
      const okTopL = projectInto(prop.x - rw * 0.32, groundY + rh, prop.z - rd * 0.35, wp6);

      if (okFL && okFR && okTR && okTL) {
        drawQuadDirect(ctx, wp0, wp1, wp2, wp3, '#b45309', nearOutline ? '#451a03' : undefined, 1);
        if (rawZ < 92) {
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = Math.max(1, Math.round(0.25 * sc));
          ctx.beginPath();
          ctx.moveTo(Math.round((wp0.x + wp3.x) * 0.5), Math.round((wp0.y + wp3.y) * 0.5));
          ctx.lineTo(Math.round((wp1.x + wp2.x) * 0.5), Math.round((wp1.y + wp2.y) * 0.5));
          ctx.stroke();
        }
        if (okSB && okST) {
          drawQuadDirect(ctx, wp1, wp4, wp5, wp2, '#7c2d12', nearOutline ? '#451a03' : undefined, 1);
        }
        if (okTopL && okST) {
          drawQuadDirect(ctx, wp3, wp2, wp5, wp6, '#fdba74');
        }
      }
      ctx.globalAlpha = 1.0;
      return;
    }

    if (prop.variant === 1 && Math.abs(prop.lateralOffset) < 25) {
      const bh = 4.2 * s;
      const bw = 3.2 * s;
      const okL = projectInto(prop.x - bw * 0.4, groundY, prop.z, wp0);
      const okR = projectInto(prop.x + bw * 0.4, groundY, prop.z, wp1);
      const okTL = projectInto(prop.x - bw * 0.5, groundY + bh, prop.z, wp2);
      const okTR = projectInto(prop.x + bw * 0.5, groundY + bh, prop.z, wp3);
      const okBL = projectInto(prop.x - bw * 0.5, groundY + bh * 0.48, prop.z, wp4);
      const okBR = projectInto(prop.x + bw * 0.5, groundY + bh * 0.48, prop.z, wp5);
      if (okL && okR && okTL && okTR && okBL && okBR) {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(1, Math.round(0.18 * sc));
        ctx.beginPath();
        ctx.moveTo(Math.round(wp0.x), Math.round(wp0.y));
        ctx.lineTo(Math.round(wp0.x), Math.round(wp4.y));
        ctx.moveTo(Math.round(wp1.x), Math.round(wp1.y));
        ctx.lineTo(Math.round(wp1.x), Math.round(wp5.y));
        ctx.stroke();
        drawQuadDirect(ctx, wp4, wp5, wp3, wp2, '#1e293b', nearOutline ? '#090d16' : undefined, 1);
        const signTopH = Math.max(1, Math.round((wp4.y - wp2.y) * 0.25));
        ctx.fillStyle = '#f97316';
        ctx.fillRect(Math.round(wp2.x), Math.round(wp2.y), Math.round(wp3.x - wp2.x), signTopH);
      }
      ctx.globalAlpha = 1.0;
      return;
    }

    // 3D Shaded Saguaro Cactus
    const th = Math.max(7, Math.round(5.2 * s * sc));
    const cw = Math.max(2, Math.round(0.75 * s * sc));
    ctx.fillStyle = '#15803d';
    ctx.fillRect(bx - Math.round(cw * 0.5), by - th, cw, th);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(bx - Math.round(cw * 0.5), by - th, Math.max(1, Math.floor(cw * 0.45)), th);
    ctx.fillStyle = '#166534';
    ctx.fillRect(bx - Math.round(cw * 1.9), by - Math.round(th * 0.65), Math.round(cw * 1.5), Math.max(1, Math.round(cw * 0.65)));
    ctx.fillRect(bx - Math.round(cw * 1.9), by - Math.round(th * 0.88), Math.max(1, Math.round(cw * 0.7)), Math.round(th * 0.26));
    ctx.fillRect(bx + Math.round(cw * 0.4), by - Math.round(th * 0.52), Math.round(cw * 1.5), Math.max(1, Math.round(cw * 0.65)));
    ctx.fillRect(bx + Math.round(cw * 1.2), by - Math.round(th * 0.78), Math.max(1, Math.round(cw * 0.7)), Math.round(th * 0.26));
    ctx.globalAlpha = 1.0;
    return;
  }

  if (biome.propStyle === 'sakura') {
    if (prop.variant === 2 && Math.abs(prop.lateralOffset) < 28) {
      const gw = 2.8 * s;
      const gh = 4.2 * s;
      const okL = projectInto(prop.x - gw * 0.45, groundY, prop.z, wp0);
      const okR = projectInto(prop.x + gw * 0.45, groundY, prop.z, wp1);
      const okTL = projectInto(prop.x - gw * 0.45, groundY + gh, prop.z, wp2);
      const okTR = projectInto(prop.x + gw * 0.45, groundY + gh, prop.z, wp3);
      const okCapL = projectInto(prop.x - gw * 0.68, groundY + gh + 0.3, prop.z, wp4);
      const okCapR = projectInto(prop.x + gw * 0.68, groundY + gh + 0.3, prop.z, wp5);
      if (okL && okR && okTL && okTR && okCapL && okCapR) {
        const postW = Math.max(2, Math.round(0.32 * sc));
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(Math.round(wp0.x - postW * 0.5), Math.round(wp2.y), postW, Math.round(wp0.y - wp2.y));
        ctx.fillRect(Math.round(wp1.x - postW * 0.5), Math.round(wp3.y), postW, Math.round(wp1.y - wp3.y));
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(Math.round(wp4.x), Math.round(wp4.y - postW * 0.8), Math.round(wp5.x - wp4.x), Math.max(2, Math.round(postW * 0.9)));
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(Math.round(wp4.x + 1), Math.round(wp4.y), Math.round(wp5.x - wp4.x - 2), Math.max(2, Math.round(postW * 0.75)));
      }
      ctx.globalAlpha = 1.0;
      return;
    }

    if (!projectInto(prop.x, groundY + 4.8 * s, prop.z, wp0)) {
      ctx.globalAlpha = 1.0;
      return;
    }
    const th = Math.max(6, Math.round(by - wp0.y));
    const rad = Math.max(3, Math.round(th * 0.44));
    const trunkW = Math.max(2, Math.round(th * 0.16));
    const swayPx = rawZ < 110 ? Math.sin(nowMs * 0.0021 + prop.z * 0.19 + prop.x * 0.27) * Math.min(3.5, th * 0.045) : 0;
    ctx.fillStyle = '#4a3525';
    ctx.fillRect(bx - Math.round(trunkW * 0.5), by - Math.round(th * 0.52), trunkW, Math.round(th * 0.52));

    ctx.fillStyle = '#db2777';
    ctx.beginPath();
    ctx.arc(bx + swayPx * 0.8 + Math.round(rad * 0.25), by - Math.round(th * 0.68), Math.round(rad * 0.85), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(bx + swayPx, by - Math.round(th * 0.74), rad, 0, Math.PI * 2);
    ctx.fill();

    if (rawZ < 95) {
      ctx.fillStyle = '#fce7f3';
      ctx.beginPath();
      ctx.arc(bx + swayPx * 1.1 - Math.round(rad * 0.25), by - Math.round(th * 0.84), Math.max(2, Math.round(rad * 0.58)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  // ALPINE BIOME: 3D Faceted Pine Trees, Chalets, Spinning Wind Turbines, Granite Boulders
  if (prop.variant === 2 && prop.shade > 0.65 && Math.abs(prop.lateralOffset) < 34) {
    const cw = 2.8 * s;
    const cd = 2.4 * s;
    const wallH = 1.8 * s;
    const roofH = 3.6 * s;
    const okFL = projectInto(prop.x - cw * 0.5, groundY, prop.z + cd * 0.5, wp0);
    const okFR = projectInto(prop.x + cw * 0.5, groundY, prop.z + cd * 0.5, wp1);
    const okWL = projectInto(prop.x - cw * 0.5, groundY + wallH, prop.z + cd * 0.5, wp2);
    const okWR = projectInto(prop.x + cw * 0.5, groundY + wallH, prop.z + cd * 0.5, wp3);
    const okPeakF = projectInto(prop.x, groundY + roofH, prop.z + cd * 0.5, wp4);
    const okSR = projectInto(prop.x + cw * 0.5, groundY, prop.z - cd * 0.5, wp5);
    const okWSR = projectInto(prop.x + cw * 0.5, groundY + wallH, prop.z - cd * 0.5, wp6);
    const okPeakB = projectInto(prop.x, groundY + roofH, prop.z - cd * 0.5, wp7);
    if (okFL && okFR && okWL && okWR && okPeakF) {
      ctx.beginPath();
      ctx.moveTo(Math.round(wp0.x), Math.round(wp0.y));
      ctx.lineTo(Math.round(wp1.x), Math.round(wp1.y));
      ctx.lineTo(Math.round(wp3.x), Math.round(wp3.y));
      ctx.lineTo(Math.round(wp4.x), Math.round(wp4.y));
      ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
      ctx.closePath();
      ctx.fillStyle = '#92400e';
      ctx.fill();
      if (nearOutline) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (okSR && okWSR && okPeakB) {
        drawQuadDirect(ctx, wp1, wp5, wp6, wp3, '#78350f', nearOutline ? '#1e293b' : undefined, 1);
        drawQuadDirect(ctx, wp3, wp6, wp7, wp4, '#cbd5e1', nearOutline ? '#1e293b' : undefined, 1);
      }
      if (rawZ < 90) {
        const winX = Math.round((wp0.x + wp1.x) * 0.5 - 1);
        const winY = Math.round((wp0.y + wp2.y) * 0.5 - 1);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(winX, winY, Math.max(2, Math.round(0.45 * sc)), Math.max(2, Math.round(0.45 * sc)));
      }
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  if (prop.variant === 2 && prop.shade <= 0.35 && Math.abs(prop.lateralOffset) > 22) {
    if (projectInto(prop.x, groundY + 7.2 * s, prop.z, wp0)) {
      const hx = Math.round(wp0.x);
      const hy = Math.round(wp0.y);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, Math.round(0.24 * sc));
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      const bladeLen = Math.max(4, Math.round(2.4 * s * sc));
      const baseAng = nowMs * 0.0014 + prop.z * 0.1;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let b = 0; b < 3; b++) {
        const a = baseAng + (b * Math.PI * 2) / 3;
        ctx.moveTo(hx, hy);
        ctx.lineTo(Math.round(hx + Math.cos(a) * bladeLen), Math.round(hy + Math.sin(a) * bladeLen));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  if (prop.variant === 2) {
    const bw = 1.8 * s;
    const bh = 1.4 * s;
    const okL = projectInto(prop.x - bw * 0.5, groundY, prop.z, wp0);
    const okR = projectInto(prop.x + bw * 0.5, groundY, prop.z, wp1);
    const okTop = projectInto(prop.x - bw * 0.1, groundY + bh, prop.z, wp2);
    const okMid = projectInto(prop.x + bw * 0.1, groundY + bh * 0.6, prop.z + 0.4, wp3);
    if (okL && okR && okTop && okMid) {
      ctx.beginPath();
      ctx.moveTo(Math.round(wp0.x), Math.round(wp0.y));
      ctx.lineTo(Math.round(wp3.x), Math.round(wp3.y));
      ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
      ctx.closePath();
      ctx.fillStyle = '#94a3b8';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(Math.round(wp3.x), Math.round(wp3.y));
      ctx.lineTo(Math.round(wp1.x), Math.round(wp1.y));
      ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
      ctx.closePath();
      ctx.fillStyle = '#64748b';
      ctx.fill();

      if (nearOutline) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(wp0.x), Math.round(wp0.y));
        ctx.lineTo(Math.round(wp1.x), Math.round(wp1.y));
        ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  // 3D Faceted 3-Tier Alpine Pine Tree (batched into 2 fills + 1 outline stroke)
  if (!projectInto(prop.x, groundY + 5.4 * s, prop.z, wp0)) {
    ctx.globalAlpha = 1.0;
    return;
  }
  const th = Math.max(7, Math.round(by - wp0.y));
  const tw = Math.max(5, Math.round(th * 0.56));
  const trunkH = Math.max(2, Math.round(th * 0.18));
  const trunkW = Math.max(1, Math.round(tw * 0.2));
  const pineSway = rawZ < 105 ? Math.sin(nowMs * 0.002 + prop.z * 0.17 + prop.x * 0.23) * Math.min(3.2, th * 0.042) : 0;

  ctx.fillStyle = '#47362b';
  ctx.fillRect(bx - Math.round(trunkW * 0.5), by - trunkH, trunkW, trunkH);

  const t0Top = by - Math.round(th * 0.52);
  const t0Bot = by - trunkH;
  const t0HW = Math.round(tw * 0.52);

  const t1Top = by - Math.round(th * 0.78);
  const t1Bot = by - Math.round(th * 0.36);
  const t1HW = Math.round(tw * 0.41);

  const t2Top = by - th;
  const t2Bot = by - Math.round(th * 0.62);
  const t2HW = Math.round(tw * 0.28);

  const bx0 = bx + pineSway * 0.45;
  const bx1 = bx + pineSway * 0.75;
  const bx2 = bx + pineSway;

  // Batch 1: Lit left faces across all 3 tiers
  ctx.fillStyle = prop.shade > 0.5 ? '#5b926c' : '#4e805e';
  ctx.beginPath();
  ctx.moveTo(bx0, t0Top);
  ctx.lineTo(bx, t0Bot);
  ctx.lineTo(bx - t0HW, t0Bot);
  ctx.closePath();
  ctx.moveTo(bx1, t1Top);
  ctx.lineTo(bx0, t1Bot);
  ctx.lineTo(bx0 - t1HW, t1Bot);
  ctx.closePath();
  ctx.moveTo(bx2, t2Top);
  ctx.lineTo(bx1, t2Bot);
  ctx.lineTo(bx1 - t2HW, t2Bot);
  ctx.closePath();
  ctx.fill();

  // Batch 2: Shaded right faces across all 3 tiers
  ctx.fillStyle = prop.shade > 0.5 ? '#355c44' : '#2d4f3b';
  ctx.beginPath();
  ctx.moveTo(bx0, t0Top);
  ctx.lineTo(bx + t0HW, t0Bot);
  ctx.lineTo(bx, t0Bot);
  ctx.closePath();
  ctx.moveTo(bx1, t1Top);
  ctx.lineTo(bx0 + t1HW, t1Bot);
  ctx.lineTo(bx0, t1Bot);
  ctx.closePath();
  ctx.moveTo(bx2, t2Top);
  ctx.lineTo(bx1 + t2HW, t2Bot);
  ctx.lineTo(bx1, t2Bot);
  ctx.closePath();
  ctx.fill();

  // Batch 3: Crisp dark contour stroke (near/mid trees only)
  if (rawZ < 76) {
    ctx.strokeStyle = '#14241c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx0, t0Top);
    ctx.lineTo(bx + t0HW, t0Bot);
    ctx.lineTo(bx - t0HW, t0Bot);
    ctx.closePath();
    ctx.moveTo(bx1, t1Top);
    ctx.lineTo(bx0 + t1HW, t1Bot);
    ctx.lineTo(bx0 - t1HW, t1Bot);
    ctx.closePath();
    ctx.moveTo(bx2, t2Top);
    ctx.lineTo(bx1 + t2HW, t2Bot);
    ctx.lineTo(bx1 - t2HW, t2Bot);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}

/**
 * Renders 3D roadside cat's-eye reflector bollards along both shoulders.
 */
export function renderReflectorBollard3D(params: {
  ctx: CanvasRenderingContext2D;
  far: RoadSlice3D;
  biome: RoadBiomeConfig;
}) {
  const { ctx, far, biome } = params;
  if (far.pt.index % 4 !== 0 || far.rawZ <= 3 || far.rawZ >= 92) return;

  const fogAlpha = computeDistanceFogAlpha(far.rawZ, 68, 92);
  if (fogAlpha <= 0.02) return;

  const postH = Math.max(2, Math.round(0.55 * far.cM.scale));
  const postW = Math.max(1, Math.round(0.14 * far.cM.scale));
  const halfPW = Math.floor(postW * 0.5);
  const reflectorCol = biome.id === 'neon' ? '#22d3ee' : far.pt.curvature !== 0 ? '#facc15' : '#f87171';
  const capH = Math.max(1, Math.floor(postH * 0.4));

  const lx = Math.round(far.gL.x) - halfPW;
  const ly = Math.round(far.gL.y) - postH;
  const rx = Math.round(far.gR.x) - halfPW;
  const ry = Math.round(far.gR.y) - postH;

  ctx.globalAlpha = fogAlpha;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(lx, ly, postW, postH);
  ctx.fillRect(rx, ry, postW, postH);
  ctx.fillStyle = reflectorCol;
  ctx.fillRect(lx, ly, postW, capH);
  ctx.fillRect(rx, ry, postW, capH);
  ctx.globalAlpha = 1.0;
}

/**
 * Renders an iconic 3D Overhead Steel Truss Bridge Portal spanning the highway.
 */
export function renderBridgeTrussArch3D(params: {
  ctx: CanvasRenderingContext2D;
  far: RoadSlice3D;
  biome: RoadBiomeConfig;
  projectInto: Project3DIntoFn;
}) {
  const { ctx, far, biome, projectInto } = params;
  if (far.pt.index < 18 || far.pt.index % 44 !== 22 || far.rawZ <= 4 || far.rawZ >= 122) return;

  const fogAlpha = computeDistanceFogAlpha(far.rawZ, 94, 122);
  if (fogAlpha <= 0.02) return;

  const pt = far.pt;
  const hw = pt.width * 0.54;
  const archH = 5.0;
  const topInset = 0.75;

  const ok1 = projectInto(pt.x - pt.nx * hw, pt.y, pt.z - pt.nz * hw, wp0, 0.55);
  const ok2 = projectInto(pt.x + pt.nx * hw, pt.y, pt.z + pt.nz * hw, wp1, 0.55);
  const ok3 = projectInto(pt.x - pt.nx * (hw - topInset), pt.y + archH, pt.z - pt.nz * (hw - topInset), wp2, 0.55);
  const ok4 = projectInto(pt.x + pt.nx * (hw - topInset), pt.y + archH, pt.z + pt.nz * (hw - topInset), wp3, 0.55);
  if (!ok1 || !ok2 || !ok3 || !ok4) return;

  const beamW = Math.max(2, Math.round(0.28 * far.cM.scale));
  const bLx = Math.round(wp0.x);
  const bLy = Math.round(wp0.y);
  const bRx = Math.round(wp1.x);
  const bRy = Math.round(wp1.y);
  const tLx = Math.round(wp2.x);
  const tLy = Math.round(wp2.y);
  const tRx = Math.round(wp3.x);
  const tRy = Math.round(wp3.y);

  ctx.globalAlpha = fogAlpha;
  ctx.strokeStyle = biome.isNight ? '#334155' : '#94a3b8';
  ctx.lineWidth = beamW;
  ctx.beginPath();
  ctx.moveTo(bLx, bLy);
  ctx.lineTo(tLx, tLy);
  ctx.lineTo(tRx, tRy);
  ctx.lineTo(bRx, bRy);
  ctx.stroke();

  ctx.strokeStyle = biome.gantryAccent;
  ctx.lineWidth = Math.max(1, Math.round(beamW * 0.45));
  ctx.beginPath();
  ctx.moveTo(tLx, tLy);
  ctx.lineTo(tRx, tRy);
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

/**
 * Renders grounded, biome-authentic architectural roadside landmarks along the highway
 * (alpine viaduct overlooks & chalets, canyon flat-top sandstone buttes & rock arches,
 * Tokyo bayfront suspension pylons, and sakura vermilion Torii shrine gates & stone lanterns).
 */
export function renderRealisticRoadsideLandmarks3D(params: {
  ctx: CanvasRenderingContext2D;
  far: RoadSlice3D;
  biome: RoadBiomeConfig;
  projectInto: Project3DIntoFn;
  nowMs?: number;
}) {
  const { ctx, far, biome, projectInto } = params;
  if (far.rawZ <= 4 || far.rawZ >= 124) return;
  const fogAlpha = computeDistanceFogAlpha(far.rawZ, 94, 124);
  if (fogAlpha <= 0.02) return;

  const pt = far.pt;
  const idx = pt.index;
  ctx.globalAlpha = fogAlpha;

  // Curve Apex Warning Chevron Boards on tight bends (all biomes)
  if (idx > 14 && idx % 7 === 0 && Math.abs(pt.curvature) > 0.011) {
    const outerSide = pt.curvature > 0 ? -1 : 1;
    const lat = outerSide * (pt.width * 0.5 + 1.45);
    const sx = pt.x + pt.nx * lat;
    const sz = pt.z + pt.nz * lat;
    if (projectInto(sx, pt.y, sz, wp0, 0.55) && projectInto(sx, pt.y + 1.65, sz, wp1, 0.55)) {
      const sc = far.cM.scale;
      const bw = Math.max(4, sc * 0.95);
      const bh = Math.max(3, sc * 0.65);
      const bx = wp1.x;
      const by = wp1.y;
      ctx.fillStyle = '#334155';
      ctx.fillRect(bx - Math.max(1, sc * 0.08), by + bh * 0.5, Math.max(1.5, sc * 0.16), Math.max(2, wp0.y - by));
      ctx.fillStyle = biome.id === 'neon' ? '#0f172a' : '#facc15';
      ctx.fillRect(bx - bw * 0.5, by - bh * 0.5, bw, bh);
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - bw * 0.5, by - bh * 0.5, bw, bh);
      const dir = outerSide > 0 ? -1 : 1;
      ctx.strokeStyle = biome.id === 'neon' ? '#22d3ee' : '#090d16';
      ctx.lineWidth = Math.max(1.2, sc * 0.16);
      ctx.beginPath();
      ctx.moveTo(bx - dir * bw * 0.2, by - bh * 0.28);
      ctx.lineTo(bx + dir * bw * 0.22, by);
      ctx.lineTo(bx - dir * bw * 0.2, by + bh * 0.28);
      ctx.stroke();
    }
  }

  if (biome.id === 'sakura') {
    // 1. Traditional Vermilion Cedar Torii Shrine Gate spanning scenic road
    if (idx > 14 && idx % 64 === 18) {
      const hw = pt.width * 0.56;
      const gateH = 5.8;
      const ok1 = projectInto(pt.x - pt.nx * hw, pt.y, pt.z - pt.nz * hw, wp0, 0.55);
      const ok2 = projectInto(pt.x + pt.nx * hw, pt.y, pt.z + pt.nz * hw, wp1, 0.55);
      const ok3 = projectInto(pt.x - pt.nx * (hw + 0.5), pt.y + gateH, pt.z - pt.nz * (hw + 0.5), wp2, 0.55);
      const ok4 = projectInto(pt.x + pt.nx * (hw + 0.5), pt.y + gateH, pt.z + pt.nz * (hw + 0.5), wp3, 0.55);
      if (ok1 && ok2 && ok3 && ok4) {
        const beamW = Math.max(2, Math.round(0.30 * far.cM.scale));
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = beamW;
        ctx.beginPath();
        ctx.moveTo(Math.round(wp0.x), Math.round(wp0.y));
        ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
        ctx.moveTo(Math.round(wp1.x), Math.round(wp1.y));
        ctx.lineTo(Math.round(wp3.x), Math.round(wp3.y));
        ctx.moveTo(Math.round(wp2.x - 3), Math.round(wp2.y + 2));
        ctx.lineTo(Math.round(wp3.x + 3), Math.round(wp3.y + 2));
        ctx.stroke();

        // Curved dark-slate Kasagi top cap
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(2, Math.round(beamW * 0.72));
        ctx.beginPath();
        ctx.moveTo(Math.round(wp2.x - 6), Math.round(wp2.y - 1));
        ctx.lineTo(Math.round(wp3.x + 6), Math.round(wp3.y - 1));
        ctx.stroke();
      }
    }

    // 2. Carved Moss-Granite Roadside Stone Lanterns (Tōrō)
    if (idx > 8 && idx % 36 === 8) {
      const side = idx % 72 === 8 ? 1 : -1;
      const lat = side * (pt.width * 0.5 + 3.8);
      const sx = pt.x + pt.nx * lat;
      const sz = pt.z + pt.nz * lat;
      const gy = sampleTerrainElevation(lat, sz, biome.id);
      if (projectInto(sx, gy, sz, wp0, 0.55) && projectInto(sx, gy + 2.4, sz, wp1, 0.55)) {
        const sc = far.cM.scale;
        const postW = Math.max(2, Math.round(0.32 * sc));
        const cx = Math.round(wp0.x);
        const botY = Math.round(wp0.y);
        const topY = Math.round(wp1.y);
        const capW = Math.max(4, Math.round(0.95 * sc));
        ctx.fillStyle = '#475569';
        ctx.fillRect(cx - Math.floor(postW * 0.5), topY + Math.round(postW * 0.7), postW, Math.max(2, botY - topY));
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(cx - Math.floor(postW * 0.65), topY + 2, Math.max(2, Math.round(postW * 1.3)), Math.max(2, Math.round(postW * 0.85)));
        ctx.fillStyle = '#334155';
        ctx.fillRect(cx - Math.floor(capW * 0.5), topY, capW, Math.max(2, Math.round(postW * 0.45)));
      }
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  if (biome.id === 'neon') {
    // 1. Tokyo Wangan Steel Cable-Stayed Suspension Bridge Pylon Towers
    if (idx > 14 && idx % 64 === 18) {
      const hw = pt.width * 0.58;
      const towerH = 12.5;
      const okL0 = projectInto(pt.x - pt.nx * hw, pt.y - 1.5, pt.z - pt.nz * hw, wp0, 0.55);
      const okR0 = projectInto(pt.x + pt.nx * hw, pt.y - 1.5, pt.z + pt.nz * hw, wp1, 0.55);
      const okLT = projectInto(pt.x - pt.nx * (hw - 0.6), pt.y + towerH, pt.z - pt.nz * (hw - 0.6), wp2, 0.55);
      const okRT = projectInto(pt.x + pt.nx * (hw - 0.6), pt.y + towerH, pt.z + pt.nz * (hw - 0.6), wp3, 0.55);
      const okSpanL = projectInto(pt.x - pt.nx * hw, pt.y, pt.z - pt.nz * hw - 5.5, wp4, 0.55);
      const okSpanR = projectInto(pt.x + pt.nx * hw, pt.y, pt.z + pt.nz * hw - 5.5, wp5, 0.55);
      if (okL0 && okR0 && okLT && okRT) {
        const beamW = Math.max(2, Math.round(0.36 * far.cM.scale));
        // Diagonal stay cables down to bridge deck
        if (okSpanL && okSpanR) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.62)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.round(wp2.x), Math.round(wp2.y + 3));
          ctx.lineTo(Math.round(wp4.x), Math.round(wp4.y));
          ctx.moveTo(Math.round(wp3.x), Math.round(wp3.y + 3));
          ctx.lineTo(Math.round(wp5.x), Math.round(wp5.y));
          ctx.stroke();
        }
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = beamW;
        ctx.beginPath();
        ctx.moveTo(Math.round(wp0.x), Math.round(wp0.y));
        ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
        ctx.moveTo(Math.round(wp1.x), Math.round(wp1.y));
        ctx.lineTo(Math.round(wp3.x), Math.round(wp3.y));
        ctx.moveTo(Math.round(wp2.x), Math.round(wp2.y + 4));
        ctx.lineTo(Math.round(wp3.x), Math.round(wp3.y + 4));
        ctx.stroke();

        // Pulsing aviation marker beacons on top of suspension towers
        const beaconPulse = 0.55 + 0.45 * Math.sin((params.nowMs ?? 0) * 0.0045 + idx * 0.7);
        ctx.fillStyle = beaconPulse > 0.65 ? '#fb7185' : '#9f1239';
        ctx.fillRect(Math.round(wp2.x) - 1, Math.round(wp2.y) - 2, 2, 2);
        ctx.fillRect(Math.round(wp3.x) - 1, Math.round(wp3.y) - 2, 2, 2);
      }
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  if (biome.id === 'canyon') {
    // Layered Terracotta Flat-Top Sandstone Butte flanking the canyon highway
    if (idx > 14 && idx % 58 === 20) {
      const side = idx % 116 === 20 ? 1 : -1;
      const lat = side * (pt.width * 0.5 + 14.5);
      const bx = pt.x + pt.nx * lat;
      const bz = pt.z + pt.nz * lat;
      const gy = sampleTerrainElevation(lat, bz, biome.id);
      const bw = 6.2;
      const bd = 4.6;
      const bh = 9.4;
      const okFL = projectInto(bx - bw * 0.55, gy, bz + bd * 0.5, wp0, 0.55);
      const okFR = projectInto(bx + bw * 0.55, gy, bz + bd * 0.5, wp1, 0.55);
      const okTR = projectInto(bx + bw * 0.36, gy + bh, bz + bd * 0.36, wp2, 0.55);
      const okTL = projectInto(bx - bw * 0.36, gy + bh, bz + bd * 0.36, wp3, 0.55);
      const okSB = projectInto(bx + side * bw * 0.58, gy, bz - bd * 0.45, wp4, 0.55);
      const okST = projectInto(bx + side * bw * 0.38, gy + bh, bz - bd * 0.36, wp5, 0.55);
      if (okFL && okFR && okTR && okTL) {
        drawQuadDirect(ctx, wp0, wp1, wp2, wp3, '#9a3412', '#451a03', 1);
        // Sedimentary rock stripe
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = Math.max(1, Math.round(0.28 * far.cM.scale));
        ctx.beginPath();
        ctx.moveTo(Math.round((wp0.x + wp3.x) * 0.5), Math.round((wp0.y + wp3.y) * 0.5));
        ctx.lineTo(Math.round((wp1.x + wp2.x) * 0.5), Math.round((wp1.y + wp2.y) * 0.5));
        ctx.stroke();
        if (okSB && okST) {
          drawQuadDirect(ctx, side > 0 ? wp1 : wp0, wp4, wp5, side > 0 ? wp2 : wp3, '#7c2d12', '#451a03', 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  // ALPINE: Concrete & Stone Viaduct Lookouts and Milepost Gantries
  if (idx > 16 && idx % 64 === 24) {
    const side = idx % 128 === 24 ? -1 : 1;
    const lat = side * (pt.width * 0.5 + 9.2);
    const sx = pt.x + pt.nx * lat;
    const sz = pt.z + pt.nz * lat;
    const gy = sampleTerrainElevation(lat, sz, biome.id);
    const hw3 = 1.85;
    const h3 = 2.6;
    const okFL = projectInto(sx - pt.nx * hw3, gy, sz - pt.nz * hw3, wp0, 0.55);
    const okFR = projectInto(sx + pt.nx * hw3, gy, sz + pt.nz * hw3, wp1, 0.55);
    const okTR = projectInto(sx + pt.nx * hw3, gy + h3, sz + pt.nz * hw3, wp2, 0.55);
    const okTL = projectInto(sx - pt.nx * hw3, gy + h3, sz - pt.nz * hw3, wp3, 0.55);
    const okPeak = projectInto(sx, gy + h3 + 1.55, sz, wp4, 0.55);
    if (okFL && okFR && okTR && okTL && okPeak) {
      drawQuadDirect(ctx, wp0, wp1, wp2, wp3, '#78350f', '#1e293b', 1);
      ctx.beginPath();
      ctx.moveTo(wp3.x - 2, wp3.y);
      ctx.lineTo(wp4.x, wp4.y);
      ctx.lineTo(wp2.x + 2, wp2.y);
      ctx.closePath();
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1.0;
}

export const renderWeirdRoadsideLandmarks3D = renderRealisticRoadsideLandmarks3D;

/**
 * Renders the 3D Checkered Finish Line Banner Gantry across the track for Campaign Levels.
 */
export function renderFinishGate3D(params: {
  ctx: CanvasRenderingContext2D;
  pt: SCurvePoint;
  rawZ: number;
  projectInto: Project3DIntoFn;
  nowMs: number;
}) {
  const { ctx, pt, rawZ, projectInto, nowMs } = params;
  if (rawZ <= 2 || rawZ >= 145) return;

  const fogAlpha = computeDistanceFogAlpha(rawZ, 110, 145);
  if (fogAlpha <= 0.02) return;

  const hw = pt.width * 0.56;
  const gateH = 5.4;
  const bannerBotY = 3.85;

  const okL0 = projectInto(pt.x - pt.nx * hw, pt.y, pt.z - pt.nz * hw, wp0, 0.55);
  const okR0 = projectInto(pt.x + pt.nx * hw, pt.y, pt.z + pt.nz * hw, wp1, 0.55);
  const okLT = projectInto(pt.x - pt.nx * hw, pt.y + gateH, pt.z - pt.nz * hw, wp2, 0.55);
  const okRT = projectInto(pt.x + pt.nx * hw, pt.y + gateH, pt.z + pt.nz * hw, wp3, 0.55);
  const okLB = projectInto(pt.x - pt.nx * hw, pt.y + bannerBotY, pt.z - pt.nz * hw, wp4, 0.55);
  const okRB = projectInto(pt.x + pt.nx * hw, pt.y + bannerBotY, pt.z + pt.nz * hw, wp5, 0.55);
  if (!okL0 || !okR0 || !okLT || !okRT || !okLB || !okRB) return;

  ctx.save();
  ctx.globalAlpha = fogAlpha;

  const pylonW = Math.max(3, wp0.scale * 0.34);

  // Checkered road line strip across asphalt
  const okRoadL = projectInto(pt.x - pt.nx * (pt.width * 0.48), pt.y + 0.02, pt.z - pt.nz * (pt.width * 0.48), wp6, 0.55);
  const okRoadR = projectInto(pt.x + pt.nx * (pt.width * 0.48), pt.y + 0.02, pt.z + pt.nz * (pt.width * 0.48), wp7, 0.55);
  if (okRoadL && okRoadR) {
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      ctx.strokeStyle = i % 2 === 0 ? '#f8fafc' : '#0f172a';
      ctx.lineWidth = Math.max(2, wp0.scale * 0.42);
      ctx.beginPath();
      ctx.moveTo(wp6.x + (wp7.x - wp6.x) * t0, wp6.y + (wp7.y - wp6.y) * t0);
      ctx.lineTo(wp6.x + (wp7.x - wp6.x) * t1, wp6.y + (wp7.y - wp6.y) * t1);
      ctx.stroke();
    }
  }

  // Twin Red/White Motorsport Tower Pylons
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = pylonW;
  ctx.beginPath();
  ctx.moveTo(wp0.x, wp0.y);
  ctx.lineTo(wp2.x, wp2.y);
  ctx.moveTo(wp1.x, wp1.y);
  ctx.lineTo(wp3.x, wp3.y);
  ctx.stroke();

  // Checkered Banner Span
  drawQuadDirect(ctx, wp4, wp5, wp3, wp2, '#0f172a', '#f8fafc', 1.5);
  const cols = 10;
  for (let c = 0; c < cols; c++) {
    const u0 = c / cols;
    const u1 = (c + 1) / cols;
    for (let row = 0; row < 2; row++) {
      if ((c + row) % 2 !== 0) continue;
      const v0 = row * 0.5;
      const v1 = (row + 1) * 0.5;
      const lxTop = wp2.x + (wp3.x - wp2.x) * u0;
      const lyTop = wp2.y + (wp3.y - wp2.y) * u0;
      const rxTop = wp2.x + (wp3.x - wp2.x) * u1;
      const ryTop = wp2.y + (wp3.y - wp2.y) * u1;
      const lxBot = wp4.x + (wp5.x - wp4.x) * u0;
      const lyBot = wp4.y + (wp5.y - wp4.y) * u0;
      const rxBot = wp4.x + (wp5.x - wp4.x) * u1;
      const ryBot = wp4.y + (wp5.y - wp4.y) * u1;

      ctx.beginPath();
      ctx.moveTo(lxTop + (lxBot - lxTop) * v0, lyTop + (lyBot - lyTop) * v0);
      ctx.lineTo(rxTop + (rxBot - rxTop) * v0, ryTop + (ryBot - ryTop) * v0);
      ctx.lineTo(rxTop + (rxBot - rxTop) * v1, ryTop + (ryBot - ryTop) * v1);
      ctx.lineTo(lxTop + (lxBot - lxTop) * v1, lyTop + (lyBot - lyTop) * v1);
      ctx.closePath();
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
    }
  }

  // Glowing Finish Beacon Lamps at Top Corners
  const pulse = 0.65 + 0.35 * Math.sin(nowMs * 0.012);
  ctx.fillStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
  const beaconR = Math.max(2.5, wp2.scale * 0.32);
  ctx.beginPath();
  ctx.arc(wp2.x, wp2.y - beaconR * 0.4, beaconR, 0, Math.PI * 2);
  ctx.arc(wp3.x, wp3.y - beaconR * 0.4, beaconR, 0, Math.PI * 2);
  ctx.fill();

  const spanW = Math.hypot(wp3.x - wp2.x, wp3.y - wp2.y);
  if (spanW > 46) {
    ctx.font = `900 ${Math.max(9, Math.round(spanW * 0.11))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mx = (wp2.x + wp3.x + wp4.x + wp5.x) * 0.25;
    const my = (wp2.y + wp3.y + wp4.y + wp5.y) * 0.25;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(mx - spanW * 0.26, my - spanW * 0.075, spanW * 0.52, spanW * 0.15);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('FINISH', mx, my + 0.5);
  }

  ctx.restore();
}

// ===========================================================================
// TRUE 3D PROJECTED DISTANT BACKGROUND VISTAS (Mountains, Mesas, City, Fuji)
// ===========================================================================

export function computeVistaFadeAlpha(rawZ: number): number {
  if (rawZ <= 146 || rawZ >= 415) return 0;
  if (rawZ < 176) return (rawZ - 146) / 30;
  if (rawZ > 340) return 1 - (rawZ - 340) / 75;
  return 1;
}

interface VistaItem3D {
  wx: number;
  wz: number;
  rawZ: number;
  lat: number;
  height: number;
  width: number;
  depth: number;
  kind: number; // 0 = peak/mesa/tower, 1 = spur/wing/bridge, 2 = landmark (Fuji / Bay Bridge)
  seed: number;
}

const VISTA_POOL: VistaItem3D[] = Array.from({ length: 120 }, () => ({
  wx: 0,
  wz: 0,
  rawZ: 0,
  lat: 0,
  height: 0,
  width: 0,
  depth: 0,
  kind: 0,
  seed: 0,
}));

function hashGrid(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function drawTriProjected(
  ctx: CanvasRenderingContext2D,
  a: Projected3D,
  b: Projected3D,
  c: Projected3D,
  fillStyle: string,
  strokeStyle?: string
) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Renders true perspective-projected 3D background vistas (faceted snow-capped alpine peaks,
 * Monument Valley sandstone mesas, extruded Tokyo bayfront skyscrapers & 3D suspension bridge,
 * and Mt. Fuji snow cone) anchored in world coordinates with zero per-frame allocations.
 */
export function renderBackgroundVista3D(params: {
  ctx: CanvasRenderingContext2D;
  camWorldX: number;
  camWorldZ: number;
  fwdX: number;
  fwdZ: number;
  rightX: number;
  rightZ: number;
  biome: RoadBiomeConfig;
  skyIsNight: boolean;
  skyId: string;
  mtnFarColor: string;
  mtnNearColor: string;
  pxW: number;
  projectInto: Project3DIntoFn;
  isAdventure?: boolean;
}) {
  const {
    ctx,
    camWorldX,
    camWorldZ,
    fwdX,
    fwdZ,
    rightX,
    rightZ,
    biome,
    skyIsNight,
    skyId,
    mtnFarColor,
    mtnNearColor,
    pxW,
    projectInto,
    isAdventure = false,
  } = params;

  const CELL = 68;
  const baseIx = Math.round(camWorldX / CELL);
  const baseIz = Math.round(camWorldZ / CELL);
  const searchRadius = 6; // ±408m coverage in world space

  let count = 0;

  for (let gx = baseIx - searchRadius; gx <= baseIx + searchRadius; gx++) {
    for (let gz = baseIz - searchRadius; gz <= baseIz + searchRadius; gz++) {
      if (count >= VISTA_POOL.length - 2) break;
      const h0 = hashGrid(gx, gz);
      const h1 = hashGrid(gx + 19, gz - 7);
      const h2 = hashGrid(gx - 11, gz + 23);

      const wx = (gx + (h0 - 0.5) * 0.62) * CELL;
      const wz = (gz + (h1 - 0.5) * 0.62) * CELL;
      const dx = wx - camWorldX;
      const dz = wz - camWorldZ;
      const rawZ = dx * fwdX + dz * fwdZ;
      if (rawZ <= 148 || rawZ >= 412) continue;

      const lat = dx * rightX + dz * rightZ;
      // Keep mid-distance central corridor clear so the elevated viaduct doesn't clip a peak directly ahead
      if (rawZ < 290 && Math.abs(lat) < 42) continue;
      // Frustum cull generously beyond viewport edges
      if (Math.abs(lat) > rawZ * 1.35 + 48) continue;

      const item = VISTA_POOL[count++];
      item.wx = wx;
      item.wz = wz;
      item.rawZ = rawZ;
      item.lat = lat;
      item.seed = h2;

      if (biome.id === 'neon') {
        item.width = 16 + h0 * 18;
        item.depth = 14 + h1 * 16;
        item.height = (rawZ > 270 ? 34 : 22) + h2 * 44;
        item.kind = h2 > 0.86 && rawZ > 240 ? 2 : h0 > 0.5 ? 1 : 0;
      } else if (biome.id === 'canyon') {
        item.width = 34 + h0 * 34;
        item.depth = 28 + h1 * 26;
        item.height = 24 + h2 * 36;
        item.kind = h2 > 0.72 ? 1 : 0;
      } else if (biome.id === 'sakura') {
        const isFuji = ((Math.abs(gx) + Math.abs(gz)) % 7 === 0) && rawZ > 265;
        item.width = isFuji ? 96 : 38 + h0 * 32;
        item.depth = isFuji ? 84 : 34 + h1 * 28;
        item.height = isFuji ? 74 : 22 + h2 * 32;
        item.kind = isFuji ? 2 : 0;
      } else {
        // Alpine massive faceted peaks
        item.width = 42 + h0 * 38;
        item.depth = 38 + h1 * 32;
        item.height = (rawZ > 250 ? 38 : 26) + h2 * 48;
        item.kind = h2 > 0.65 ? 1 : 0;
      }
    }
  }

  // Far-to-near painter's sort (zero-alloc insertion sort)
  for (let i = 1; i < count; i++) {
    const key = VISTA_POOL[i];
    let j = i - 1;
    while (j >= 0 && VISTA_POOL[j].rawZ < key.rawZ) {
      VISTA_POOL[j + 1] = VISTA_POOL[j];
      j--;
    }
    VISTA_POOL[j + 1] = key;
  }

  const baseY = VALLEY_BASE_Y - 5.5;
  const isRedMoon = skyId === 'red_moon';
  const isSunset = skyId === 'golden_sunset';
  const isAurora = skyId === 'aurora_night';

  for (let i = 0; i < count; i++) {
    const v = VISTA_POOL[i];
    const fade = computeVistaFadeAlpha(v.rawZ);
    if (fade <= 0.02) continue;

    const farBlend = v.rawZ > 275;
    ctx.globalAlpha = fade * (farBlend ? 0.84 : 0.96);

    if (biome.id === 'neon') {
      // 3D Extruded Bayfront Skyscrapers & 3D Suspension Bridge Spans
      if (v.kind === 2) {
        // Long 3D Distant Suspension Bridge spanning across the horizon
        const spanW = 58;
        const towerH = v.height * 0.78;
        const deckY = baseY + 11;
        const okL0 = projectInto(v.wx - spanW * 0.5, baseY, v.wz, wp0, 1.0);
        const okR0 = projectInto(v.wx + spanW * 0.5, baseY, v.wz, wp1, 1.0);
        const okLT = projectInto(v.wx - spanW * 0.5, baseY + towerH, v.wz, wp2, 1.0);
        const okRT = projectInto(v.wx + spanW * 0.5, baseY + towerH, v.wz, wp3, 1.0);
        const okDL = projectInto(v.wx - spanW * 1.15, deckY, v.wz, wp4, 1.0);
        const okDR = projectInto(v.wx + spanW * 1.15, deckY, v.wz, wp5, 1.0);
        if (okL0 && okR0 && okLT && okRT && okDL && okDR) {
          ctx.strokeStyle = isRedMoon ? '#881337' : '#334155';
          ctx.lineWidth = Math.max(2, Math.round(0.45 * wp0.scale));
          ctx.beginPath();
          ctx.moveTo(Math.round(wp0.x), Math.round(wp0.y));
          ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
          ctx.moveTo(Math.round(wp1.x), Math.round(wp1.y));
          ctx.lineTo(Math.round(wp3.x), Math.round(wp3.y));
          ctx.moveTo(Math.round(wp4.x), Math.round(wp4.y));
          ctx.lineTo(Math.round(wp5.x), Math.round(wp5.y));
          ctx.stroke();

          // Catenary main cables + deck glow
          ctx.strokeStyle = isRedMoon ? '#fda4af' : '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.round(wp4.x), Math.round(wp4.y));
          ctx.quadraticCurveTo(
            Math.round((wp4.x + wp2.x) * 0.5),
            Math.round(wp4.y - 4),
            Math.round(wp2.x),
            Math.round(wp2.y)
          );
          ctx.quadraticCurveTo(
            Math.round((wp2.x + wp3.x) * 0.5),
            Math.round(wp4.y - 2),
            Math.round(wp3.x),
            Math.round(wp3.y)
          );
          ctx.quadraticCurveTo(
            Math.round((wp3.x + wp5.x) * 0.5),
            Math.round(wp5.y - 4),
            Math.round(wp5.x),
            Math.round(wp5.y)
          );
          ctx.stroke();

          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(Math.round(wp2.x) - 1, Math.round(wp2.y) - 2, 2, 2);
          ctx.fillRect(Math.round(wp3.x) - 1, Math.round(wp3.y) - 2, 2, 2);
        }
        continue;
      }

      const hw = v.width * 0.5;
      const hd = v.depth * 0.5;
      const isLeft = v.lat < 0;
      const frontZ = v.wz + (fwdZ < 0 ? hd : -hd);
      const backZ = v.wz - (fwdZ < 0 ? hd : -hd);
      const sideX = isLeft ? v.wx + hw : v.wx - hw;

      const okFL = projectInto(v.wx - hw, baseY, frontZ, wp0, 1.0);
      const okFR = projectInto(v.wx + hw, baseY, frontZ, wp1, 1.0);
      const okTR = projectInto(v.wx + hw, baseY + v.height, frontZ, wp2, 1.0);
      const okTL = projectInto(v.wx - hw, baseY + v.height, frontZ, wp3, 1.0);
      if (!okFL || !okFR || !okTR || !okTL) continue;
      if (Math.max(wp0.x, wp1.x) < -24 || Math.min(wp0.x, wp1.x) > pxW + 24) continue;

      const frontCol = isRedMoon
        ? farBlend ? '#2d0b19' : '#1f0710'
        : skyIsNight
        ? farBlend ? '#1e293b' : '#111827'
        : farBlend ? '#475569' : '#334155';
      const sideCol = isRedMoon ? '#14040a' : skyIsNight ? '#090e1a' : '#1e293b';

      drawQuadDirect(ctx, wp0, wp1, wp2, wp3, frontCol);

      if (
        projectInto(sideX, baseY, backZ, wp4, 1.0) &&
        projectInto(sideX, baseY + v.height, backZ, wp5, 1.0)
      ) {
        const eb = isLeft ? wp1 : wp0;
        const et = isLeft ? wp2 : wp3;
        drawQuadDirect(ctx, eb, wp4, wp5, et, sideCol);
      }

      // Illuminated neon roof crown + skyline spire beacon on tall towers + window grid
      const crownCol = isRedMoon
        ? '#fda4af'
        : v.seed > 0.65
        ? '#22d3ee'
        : v.seed > 0.32
        ? '#f472b6'
        : '#facc15';
      ctx.strokeStyle = crownCol;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(wp3.x), Math.round(wp3.y));
      ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
      ctx.stroke();

      if (v.height > 52) {
        const spireX = Math.round((wp3.x + wp2.x) * 0.5);
        const spireBaseY = Math.round((wp3.y + wp2.y) * 0.5);
        const spireH = Math.max(4, Math.round(0.42 * wp3.scale * 10));
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(spireX, spireBaseY);
        ctx.lineTo(spireX, spireBaseY - spireH);
        ctx.stroke();
        ctx.fillStyle = isRedMoon ? '#fda4af' : '#f43f5e';
        ctx.fillRect(spireX - 1, spireBaseY - spireH - 1, 2, 2);
      }

      const scrW = Math.abs(wp1.x - wp0.x);
      const scrH = Math.abs(wp0.y - wp3.y);
      if (scrW >= 7 && scrH >= 14 && v.rawZ < 310) {
        const lx = Math.round(Math.min(wp0.x, wp1.x)) + 2;
        const rx = Math.round(Math.max(wp0.x, wp1.x)) - 2;
        const ty = Math.round(wp3.y) + 3;
        const by = Math.round(Math.min(wp0.y, wp1.y)) - 3;
        ctx.fillStyle = isRedMoon ? '#fda4af' : v.kind === 1 ? '#bae6fd' : '#fef08a';
        for (let wy = ty; wy < by; wy += 4) {
          for (let wx2 = lx; wx2 < rx; wx2 += 3) {
            if (((wx2 + wy) & 3) !== 0) {
              ctx.fillRect(wx2, wy, 1, 2);
            }
          }
        }
      }
      continue;
    }

    if (biome.id === 'canyon') {
      // Sculpted 3D Monument Valley Flat-Top Sandstone Mesas & Stratified Buttes
      const botHW = v.width * 0.56;
      const topHW = v.width * (v.kind === 1 ? 0.28 : 0.38);
      const peakY = baseY + v.height;
      const ridgeX = v.wx + (v.seed - 0.5) * v.width * 0.16;

      const okBL = projectInto(v.wx - botHW, baseY, v.wz, wp0, 1.0);
      const okBM = projectInto(ridgeX, baseY, v.wz + v.depth * 0.25, wp1, 1.0);
      const okBR = projectInto(v.wx + botHW, baseY, v.wz, wp2, 1.0);
      const okTL = projectInto(ridgeX - topHW, peakY, v.wz + v.depth * 0.08, wp3, 1.0);
      const okTR = projectInto(ridgeX + topHW, peakY, v.wz + v.depth * 0.08, wp4, 1.0);
      if (!okBL || !okBM || !okBR || !okTL || !okTR) continue;
      if (Math.max(wp0.x, wp2.x) < -30 || Math.min(wp0.x, wp2.x) > pxW + 30) continue;

      const litFace = skyIsNight ? mtnFarColor : farBlend ? '#c2410c' : '#ea580c';
      const darkFace = skyIsNight ? mtnNearColor : farBlend ? '#7c2d12' : '#9a3412';
      drawQuadDirect(ctx, wp0, wp1, wp4, wp3, litFace);
      drawTriProjected(ctx, wp1, wp2, wp4, darkFace);

      // Sunlit horizontal sedimentary rim on flat plateau crest
      ctx.strokeStyle = skyIsNight ? 'rgba(148, 163, 184, 0.35)' : isSunset ? '#fed7aa' : '#fdba74';
      ctx.lineWidth = Math.max(1, Math.round(0.32 * wp3.scale));
      ctx.beginPath();
      ctx.moveTo(Math.round(wp3.x), Math.round(wp3.y));
      ctx.lineTo(Math.round(wp4.x), Math.round(wp4.y));
      ctx.stroke();
      continue;
    }

    // ADVENTURE MODE: Misty, pine-forested mountain ridges instead of sharp white-capped origami cones
    if (isAdventure) {
      const hw = v.width * 0.72;
      const peakY = baseY + v.height * 0.68;
      const peakOffset = (v.seed - 0.5) * hw * 0.35;
      const okBL = projectInto(v.wx - hw, baseY, v.wz, wp0, 1.0);
      const okBR = projectInto(v.wx + hw, baseY, v.wz, wp2, 1.0);
      const okPkL = projectInto(v.wx + peakOffset - hw * 0.28, peakY * 0.92, v.wz, wp3, 1.0);
      const okPkC = projectInto(v.wx + peakOffset, peakY, v.wz + v.depth * 0.14, wp4, 1.0);
      const okPkR = projectInto(v.wx + peakOffset + hw * 0.32, peakY * 0.88, v.wz, wp5, 1.0);
      if (!okBL || !okBR || !okPkL || !okPkC || !okPkR) continue;
      if (Math.max(wp0.x, wp2.x) < -44 || Math.min(wp0.x, wp2.x) > pxW + 44) continue;

      const ridgeLit = skyIsNight
        ? farBlend ? '#172822' : '#101d18'
        : farBlend ? '#3a5748' : '#264030';
      const ridgeShade = skyIsNight
        ? farBlend ? '#0f1b17' : '#0a120f'
        : farBlend ? '#2b4537' : '#1b3023';

      ctx.fillStyle = ridgeLit;
      ctx.beginPath();
      ctx.moveTo(wp0.x, wp0.y);
      ctx.quadraticCurveTo((wp0.x + wp3.x) * 0.5, wp3.y, wp4.x, wp4.y);
      ctx.quadraticCurveTo((wp4.x + wp2.x) * 0.5, wp5.y, wp2.x, wp2.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = ridgeShade;
      ctx.beginPath();
      ctx.moveTo(wp4.x, wp4.y);
      ctx.quadraticCurveTo((wp4.x + wp2.x) * 0.5, wp5.y, wp2.x, wp2.y);
      ctx.lineTo((wp0.x + wp2.x) * 0.52, (wp0.y + wp2.y) * 0.5);
      ctx.closePath();
      ctx.fill();

      if (!farBlend && Math.abs(wp2.x - wp0.x) > 36) {
        const trees = 9;
        ctx.fillStyle = ridgeShade;
        ctx.beginPath();
        for (let t = 1; t < trees; t++) {
          const f = t / trees;
          const rx = wp0.x + (wp2.x - wp0.x) * f;
          const ry = wp0.y + (wp4.y - wp0.y) * Math.sin(f * Math.PI);
          const th = Math.max(2, Math.min(7, (wp0.y - wp4.y) * 0.16));
          ctx.moveTo(rx - 2, ry + 1);
          ctx.lineTo(rx, ry - th);
          ctx.lineTo(rx + 2, ry + 1);
        }
        ctx.fill();
      }
      continue;
    }

    // ALPINE & SAKURA: True 3D Faceted Mountains + Majestic Snow-Capped Mt. Fuji
    const hw = v.width * 0.5;
    const peakY = baseY + v.height;
    const isFuji = biome.id === 'sakura' && v.kind === 2;
    const peakOffset = isFuji ? 0 : (v.seed - 0.5) * hw * 0.42;

    const okBL = projectInto(v.wx - hw, baseY, v.wz, wp0, 1.0);
    const okBM = projectInto(v.wx + peakOffset * 0.4, baseY, v.wz + v.depth * 0.38, wp1, 1.0);
    const okBR = projectInto(v.wx + hw, baseY, v.wz, wp2, 1.0);
    const okPkL = projectInto(v.wx + peakOffset - (isFuji ? 9.5 : 0), peakY, v.wz, wp3, 1.0);
    const okPkR = isFuji
      ? projectInto(v.wx + peakOffset + 9.5, peakY, v.wz, wp4, 1.0)
      : okPkL;
    if (!okBL || !okBM || !okBR || !okPkL || !okPkR) continue;
    if (Math.max(wp0.x, wp2.x) < -36 || Math.min(wp0.x, wp2.x) > pxW + 36) continue;

    const litCol = farBlend ? mtnFarColor : mtnNearColor;
    const shadowCol = isRedMoon
      ? '#260814'
      : skyIsNight
      ? '#0f172a'
      : biome.id === 'sakura'
      ? farBlend ? '#475569' : '#334155'
      : farBlend ? '#334155' : '#1e293b';

    if (isFuji) {
      drawQuadDirect(ctx, wp0, wp1, wp4, wp3, litCol);
      drawTriProjected(ctx, wp1, wp2, wp4, shadowCol);
    } else {
      drawTriProjected(ctx, wp0, wp1, wp3, litCol);
      drawTriProjected(ctx, wp1, wp2, wp3, shadowCol);
      ctx.strokeStyle = isRedMoon
        ? 'rgba(253, 164, 175, 0.25)'
        : isSunset
        ? 'rgba(254, 215, 170, 0.42)'
        : skyIsNight
        ? 'rgba(148, 163, 184, 0.22)'
        : 'rgba(241, 245, 249, 0.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(wp0.x), Math.round(wp0.y));
      ctx.lineTo(Math.round(wp3.x), Math.round(wp3.y));
      ctx.stroke();
    }

    if (isFuji || v.height > 44) {
      const snowBaseY = baseY + v.height * (isFuji ? 0.62 : 0.72);
      const snowHW = hw * (isFuji ? 0.38 : 0.28);
      const okSL = projectInto(v.wx + peakOffset - snowHW, snowBaseY, v.wz + v.depth * 0.11, wp5, 1.0);
      const okSM = projectInto(v.wx + peakOffset * 0.6, snowBaseY - 1.5, v.wz + v.depth * 0.14, wp6, 1.0);
      const okSR = projectInto(v.wx + peakOffset + snowHW, snowBaseY, v.wz + v.depth * 0.11, wp7, 1.0);
      if (okSL && okSM && okSR) {
        const snowLit = isRedMoon
          ? '#fda4af'
          : isSunset
          ? '#fed7aa'
          : isAurora
          ? '#cffafe'
          : '#f8fafc';
        const snowShade = isRedMoon ? '#9f1239' : isSunset ? '#fb923c' : '#cbd5e1';
        if (isFuji) {
          drawQuadDirect(ctx, wp5, wp6, wp4, wp3, snowLit);
          drawTriProjected(ctx, wp6, wp7, wp4, snowShade);
        } else {
          drawTriProjected(ctx, wp5, wp6, wp3, snowLit);
          drawTriProjected(ctx, wp6, wp7, wp3, snowShade);
        }
      }
    }
  }

  ctx.globalAlpha = 1.0;
}

// ===========================================================================
// FOREST & CAVES ADVENTURE 3D RENDERING (Terrain, Props, Cave Vault, Ruins)
// ===========================================================================

const ADV_TERRAIN_LATS = [-72.0, -24.0, -9.8, -5.2, 5.2, 9.8, 24.0, 72.0];
const STEP_DIST_REF = 3.4;

// Dedicated zero-alloc scratch Projected3D registers for cave vault rings (11 points per ring)
const cvFL0: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFR0: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFL_S: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFR_S: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFL1: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFR1: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFL2: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFR2: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFC: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFLB: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvFRB: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };

const cvNL0: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNR0: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNL_S: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNR_S: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNL1: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNR1: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNL2: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNR2: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNC: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNLB: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const cvNRB: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };

function fillAdventureTerrainRow(
  pt: SCurvePoint,
  zoneSample: AdventureZoneSample,
  projectInto: Project3DIntoFn,
  row: TerrainRow
) {
  for (let k = 0; k < 8; k++) {
    const lat = ADV_TERRAIN_LATS[k];
    const wx = pt.x + pt.nx * lat;
    const wz = pt.z + pt.nz * lat;
    const wy = sampleAdventureTerrainElevation(lat, wz, pt.y, zoneSample);
    row.ok[k] = projectInto(wx, wy, wz, row.pts[k], 0.55);
  }
}

/**
 * Renders naturalistic contoured Forest hillsides (smooth non-checkerboard mossy loam,
 * woodland grass tufts, leaf litter & river-cobble banks), Wooden Bridge gorges,
 * and rocky Cavern floors with zero per-frame allocations.
 */
export function renderAdventureTerrainMesh3D(params: {
  ctx: CanvasRenderingContext2D;
  visibleSlices: RoadSlice3D[];
  visibleCount: number;
  projectInto: Project3DIntoFn;
}) {
  const { ctx, visibleSlices, visibleCount, projectInto } = params;

  let farRow = terrainRowA;
  let nearRow = terrainRowB;
  let prevNearIndex = -999999;

  for (let i = 0; i < visibleCount - 1; i++) {
    const far = visibleSlices[i];
    const near = visibleSlices[i + 1];
    if (Math.abs(far.pt.index - near.pt.index) > 2) continue;
    if (far.rawZ > 152) continue;

    const fpt = far.pt;
    const npt = near.pt;
    const fZone = resolveAdventureZone(fpt.index * STEP_DIST_REF, fpt.index);
    const nZone = resolveAdventureZone(npt.index * STEP_DIST_REF, npt.index);
    const ch = fZone.chapter;
    const ramps = getChapterTerrainRamps(ch);
    const fogAlpha = computeDistanceFogAlpha(far.rawZ, 108, 152);
    if (fogAlpha <= 0.02) continue;

    if (fpt.index === prevNearIndex) {
      const tmp = farRow;
      farRow = nearRow;
      nearRow = tmp;
    } else {
      fillAdventureTerrainRow(fpt, fZone, projectInto, farRow);
    }
    fillAdventureTerrainRow(npt, nZone, projectInto, nearRow);
    prevNearIndex = npt.index;

    const fp = farRow.pts;
    const fo = farRow.ok;
    const np = nearRow.pts;
    const no = nearRow.ok;

    ctx.globalAlpha = fogAlpha;

    const mixOuterL = smoothTerrainMix(fpt.index, 'outerL');
    const mixOuterR = smoothTerrainMix(fpt.index, 'outerR');
    const mixBankL = smoothTerrainMix(fpt.index, 'bankL');
    const mixBankR = smoothTerrainMix(fpt.index, 'bankR');
    const outerHillRamp = far.rawZ > 74 ? ramps.hillMist : ramps.hill;

    if (fo[0] && fo[1] && no[1] && no[0]) {
      drawQuadDirect(ctx, fp[0], fp[1], np[1], np[0], pickRampColor(outerHillRamp, mixOuterL));
    }
    if (fo[6] && fo[7] && no[7] && no[6]) {
      drawQuadDirect(ctx, fp[6], fp[7], np[7], np[6], pickRampColor(outerHillRamp, mixOuterR * 0.86));
    }

    if (fo[1] && fo[2] && no[2] && no[1]) {
      drawQuadDirect(ctx, fp[1], fp[2], np[2], np[1], pickRampColor(ramps.bank, mixBankL * 0.92));
    }
    if (fo[5] && fo[6] && no[6] && no[5]) {
      drawQuadDirect(ctx, fp[5], fp[6], np[6], np[5], pickRampColor(ramps.bank, mixBankR * 0.85));
    }
    if (fo[2] && fo[3] && no[3] && no[2]) {
      drawQuadDirect(ctx, fp[2], fp[3], np[3], np[2], pickRampColor(ramps.bank, mixBankL * 0.72));
    }
    if (fo[4] && fo[5] && no[5] && no[4]) {
      drawQuadDirect(ctx, fp[4], fp[5], np[5], np[4], pickRampColor(ramps.bank, mixBankR * 0.68));
    }

    if (far.rawZ < 54 && fZone.zone === 'forest') {
      const nA = deterministicNoise(fpt.index, 3.7);
      const nB = deterministicNoise(fpt.index, 9.1);
      if (fo[1] && fo[2] && nA > 0.38) {
        const tx = fp[2].x + (fp[1].x - fp[2].x) * (0.18 + nA * 0.48);
        const ty = fp[2].y + (fp[1].y - fp[2].y) * (0.18 + nA * 0.48);
        const tw = Math.max(2, Math.round(far.cM.scale * 0.55));
        ctx.fillStyle = fZone.bridgeBlend > 0.35 ? 'rgba(110, 108, 100, 0.38)' : 'rgba(28, 46, 24, 0.32)';
        ctx.fillRect(Math.round(tx - tw * 0.5), Math.round(ty - 1), tw, Math.max(1, Math.round(tw * 0.35)));
      }
      if (fo[5] && fo[6] && nB > 0.42) {
        const tx = fp[5].x + (fp[6].x - fp[5].x) * (0.16 + nB * 0.46);
        const ty = fp[5].y + (fp[6].y - fp[5].y) * (0.16 + nB * 0.46);
        const tw = Math.max(2, Math.round(far.cM.scale * 0.52));
        ctx.fillStyle = fZone.bridgeBlend > 0.35 ? 'rgba(95, 92, 85, 0.35)' : 'rgba(68, 96, 48, 0.28)';
        ctx.fillRect(Math.round(tx - tw * 0.5), Math.round(ty - 1), tw, Math.max(1, Math.round(tw * 0.32)));
      }
    }

    const hasWaterChannel =
      fZone.bridgeBlend > 0.15 ||
      nZone.bridgeBlend > 0.15 ||
      fZone.caveBlend > 0.25 ||
      nZone.caveBlend > 0.25;
    if (fo[3] && fo[4] && no[4] && no[3]) {
      drawQuadDirect(
        ctx,
        fp[3],
        fp[4],
        np[4],
        np[3],
        hasWaterChannel ? ch.riverColor : pickRampColor(ramps.bank, smoothTerrainMix(fpt.index, 'center') * 0.45)
      );
      if (far.rawZ < 92 && hasWaterChannel) {
        ctx.strokeStyle = ch.riverGlint;
        ctx.globalAlpha = fogAlpha * 0.28;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(fp[3].x), Math.round(fp[3].y));
        ctx.lineTo(Math.round(np[3].x), Math.round(np[3].y));
        ctx.moveTo(Math.round(fp[4].x), Math.round(fp[4].y));
        ctx.lineTo(Math.round(np[4].x), Math.round(np[4].y));
        if (fpt.index % 2 === 0) {
          const t0 = 0.18 + deterministicNoise(fpt.index, 1.9) * 0.25;
          const t1 = 0.55 + deterministicNoise(fpt.index, 4.3) * 0.28;
          const rx1 = fp[3].x + (fp[4].x - fp[3].x) * t0;
          const ry1 = fp[3].y + (fp[4].y - fp[3].y) * t0;
          const rx2 = fp[3].x + (fp[4].x - fp[3].x) * t1;
          const ry2 = fp[3].y + (fp[4].y - fp[3].y) * t1;
          ctx.moveTo(Math.round(rx1), Math.round(ry1));
          ctx.lineTo(Math.round(rx2), Math.round(ry2));
        }
        ctx.stroke();
        ctx.globalAlpha = fogAlpha;
      }
    }
  }
  ctx.globalAlpha = 1.0;
}

/**
 * Renders grounded realistic Forest & Caves Adventure props:
 * - High-detail cached botanical trees (Douglas Fir, Coastal Redwood, Ancient Oak, Silver Birch, Pine, Maple)
 * - Craggy mossy granite boulders, sword-fern clusters, mossy fallen nurse logs
 * - Natural limestone stalagmites & multi-faceted cave mineral crystal matrices
 */
export function renderAdventureProp3D(params: {
  ctx: CanvasRenderingContext2D;
  prop: WorldProp3D;
  roadY: number;
  zoneSample: AdventureZoneSample;
  nowMs: number;
  pxW: number;
  projectInto: Project3DIntoFn;
}) {
  const { ctx, prop, roadY, zoneSample, nowMs, pxW, projectInto } = params;

  const inCaveProp = zoneSample.caveBlend > 0.3;
  if (inCaveProp && Math.abs(prop.lateralOffset) > 15.5) {
    return;
  }

  let worldPropX = prop.x;
  let worldPropZ = prop.z;
  const effLat = inCaveProp
    ? Math.sign(prop.lateralOffset || 1) * (6.7 + (Math.abs(prop.lateralOffset) % 2.6))
    : prop.lateralOffset;
  if (inCaveProp && Math.abs(prop.lateralOffset) > 9.4) {
    const shift = effLat - prop.lateralOffset;
    // Gently pull wide forest props inward onto the cavern floor shelf
    const len = Math.hypot(prop.x, prop.z) || 1;
    worldPropX = prop.x + (prop.x / len) * shift * 0.35;
    worldPropZ = prop.z;
  }

  const groundY =
    zoneSample.caveBlend > 0.35
      ? roadY - 0.12
      : sampleAdventureTerrainElevation(effLat, worldPropZ, roadY, zoneSample);
  if (!projectInto(worldPropX, groundY, worldPropZ, wpBase)) return;
  if (wpBase.x < -56 || wpBase.x > pxW + 56 || wpBase.z > 158) return;

  const s = prop.scale;
  const sc = wpBase.scale;
  const rawZ = wpBase.z;
  const fogAlpha = computeDistanceFogAlpha(rawZ, 104, 156);
  if (fogAlpha <= 0.02) return;

  const bx = Math.round(wpBase.x);
  const by = Math.round(wpBase.y);
  const ch = zoneSample.chapter;

  ctx.globalAlpha = fogAlpha;

  if (zoneSample.caveBlend > 0.35) {
    const cavePropKind = prop.shade > 0.45 ? 0 : ch.featureBias === 'amber_cave' ? 2 : 1;
    const caveSprite = getRealisticCavePropSprite(cavePropKind);
    const propH = (cavePropKind === 0 ? 3.2 : 2.35) * s;
    if (caveSprite && projectInto(worldPropX, groundY + propH, worldPropZ, wp0)) {
      const dh = Math.max(8, Math.round(by - wp0.y));
      const dw = Math.max(6, Math.round(dh * (caveSprite.width / caveSprite.height)));
      if (cavePropKind > 0 && rawZ < 76) {
        const pulse = 0.7 + 0.3 * Math.sin(nowMs * 0.004 + worldPropZ);
        ctx.globalAlpha = fogAlpha * 0.2 * pulse;
        ctx.fillStyle = ch.crystalPrimary;
        ctx.beginPath();
        ctx.arc(bx, by - Math.round(dh * 0.42), Math.max(5, Math.round(dw * 0.72)), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fogAlpha;
      }
      ctx.drawImage(caveSprite, Math.round(bx - dw * 0.5), by - dh + 2, dw, dh);
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  if (rawZ < 96) {
    const shW = Math.max(3, Math.round((prop.variant === 2 ? 1.15 : 1.65) * s * sc));
    const shH = Math.max(1, Math.round(shW * 0.28));
    ctx.fillStyle = 'rgba(10, 18, 12, 0.16)';
    ctx.beginPath();
    ctx.ellipse(bx + Math.round(shW * 0.18), by, shW, shH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(8, 14, 9, 0.22)';
    ctx.beginPath();
    ctx.ellipse(bx + Math.round(shW * 0.08), by, Math.max(2, Math.round(shW * 0.52)), Math.max(1, Math.round(shH * 0.6)), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (prop.variant === 2) {
    const underKind = prop.shade > 0.62 ? 0 : prop.shade > 0.22 ? 1 : 2;
    const underSprite = getRealisticUndergrowthSprite(underKind);
    const uh = (underKind === 0 ? 1.95 : underKind === 1 ? 1.55 : 1.35) * s;
    if (underSprite && projectInto(prop.x, groundY + uh, prop.z, wp0)) {
      const dh = Math.max(5, Math.round(by - wp0.y));
      const dw = Math.max(6, Math.round(dh * (underSprite.width / underSprite.height)));
      const flip = ((Math.round(Math.abs(prop.x)) + Math.round(Math.abs(prop.z))) & 1) === 1;
      if (flip && rawZ < 72) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(-1, 1);
        ctx.drawImage(underSprite, Math.round(-dw * 0.5), -dh + 2, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(underSprite, Math.round(bx - dw * 0.5), by - dh + 2, dw, dh);
      }
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  const species = resolveRealisticTreeSpecies(prop.variant, prop.shade, zoneSample);
  const treeSprite = getRealisticTreeSprite(species);
  const treeHeightMeters =
    species === 1 ? 8.2 * s : species === 0 || species === 4 ? 7.1 * s : species === 3 ? 6.4 * s : 6.0 * s;

  if (!treeSprite || !projectInto(prop.x, groundY + treeHeightMeters, prop.z, wp0)) {
    ctx.globalAlpha = 1.0;
    return;
  }

  const th = Math.max(10, Math.round(by - wp0.y));
  const tw = Math.max(8, Math.round(th * (treeSprite.width / treeSprite.height)));
  const mirror = prop.shade > 0.5;
  const canopySway = rawZ < 95 ? Math.sin(nowMs * 0.0023 + prop.z * 0.18 + prop.x * 0.25) * 0.022 : 0;

  if ((mirror && rawZ < 85) || Math.abs(canopySway) > 0.002) {
    ctx.save();
    ctx.translate(bx, by);
    if (canopySway !== 0) ctx.transform(1, 0, canopySway, 1, 0, 0);
    if (mirror && rawZ < 85) ctx.scale(-1, 1);
    ctx.drawImage(treeSprite, Math.round(-tw * 0.5), -th + 3, tw, th);
    ctx.restore();
  } else {
    ctx.drawImage(treeSprite, Math.round(bx - tw * 0.5), by - th + 3, tw, th);
  }

  ctx.globalAlpha = 1.0;
}

/**
 * Renders the realistic 3D Rock Cavern shell:
 * - Organic asymmetric multi-station rock walls & overhangs (no wireframe polygon lines)
 * - Sedimentary rock strata seams & damp mineral seepage streaks
 * - Multi-segment tapered limestone stalactites, prismatic crystal veins, wall torches
 * - Rugged boulder-framed mountainside cave portals with draped roots & forest vines
 */
export function renderCaveTunnelSegment3D(params: {
  ctx: CanvasRenderingContext2D;
  far: RoadSlice3D;
  near: RoadSlice3D;
  farZone: AdventureZoneSample;
  nearZone: AdventureZoneSample;
  playerInCave?: boolean;
  headlightWallIllum?: number;
  headlightBeamColor?: string;
  nowMs: number;
  projectInto: Project3DIntoFn;
}) {
  const {
    ctx,
    far,
    near,
    farZone,
    nearZone,
    playerInCave = false,
    headlightWallIllum = 0,
    headlightBeamColor = '#fef9c3',
    nowMs,
    projectInto,
  } = params;
  const blend = Math.max(farZone.caveBlend, nearZone.caveBlend);
  if (blend <= 0.04 && !farZone.isCavePortalIn && !farZone.isCavePortalOut) return;
  if (!playerInCave && (farZone.isCavePortalOut || (!farZone.isCavePortalIn && blend > 0.65))) return;
  if (far.rawZ < 0.8 || far.rawZ > 142) return;

  const fogAlpha = computeDistanceFogAlpha(far.rawZ, 102, 142);
  if (fogAlpha <= 0.02) return;

  const fpt = far.pt;
  const npt = near.pt;
  const ch = farZone.zone === 'cave' ? farZone.chapter : nearZone.chapter;
  const ramps = getChapterTerrainRamps(ch);

  const profFL = sampleCaveWallProfile(fpt.index, -1);
  const profFR = sampleCaveWallProfile(fpt.index, 1);
  const profNL = sampleCaveWallProfile(npt.index, -1);
  const profNR = sampleCaveWallProfile(npt.index, 1);

  const fhw = fpt.width * 0.5;
  const nhw = npt.width * 0.5;

  const baseWL_F = fhw + 4.3 + profFL.baseOffset;
  const baseWR_F = fhw + 4.3 + profFR.baseOffset;
  const shelfWL_F = fhw + 4.75 + profFL.lowShelfOffset;
  const shelfWR_F = fhw + 4.75 + profFR.lowShelfOffset;
  const midWL_F = fhw + 5.25 + profFL.midOffset;
  const midWR_F = fhw + 5.25 + profFR.midOffset;
  const archWL_F = fhw * 1.12 + profFL.archOffset * 0.6;
  const archWR_F = fhw * 1.12 + profFR.archOffset * 0.6;

  const baseWL_N = nhw + 4.3 + profNL.baseOffset;
  const baseWR_N = nhw + 4.3 + profNR.baseOffset;
  const shelfWL_N = nhw + 4.75 + profNL.lowShelfOffset;
  const shelfWR_N = nhw + 4.75 + profNR.lowShelfOffset;
  const midWL_N = nhw + 5.25 + profNL.midOffset;
  const midWR_N = nhw + 5.25 + profNR.midOffset;
  const archWL_N = nhw * 1.12 + profNL.archOffset * 0.6;
  const archWR_N = nhw * 1.12 + profNR.archOffset * 0.6;

  const shelfH_F = 1.75 + profFL.lowShelfOffset * 0.25;
  const shelfHR_F = 1.75 + profFR.lowShelfOffset * 0.25;
  const midH_F = 3.9 + profFL.midOffset * 0.35;
  const midHR_F = 3.9 + profFR.midOffset * 0.35;
  const archH_F = 6.35 + profFL.upperLedgeOffset * 0.45;
  const archHR_F = 6.35 + profFR.upperLedgeOffset * 0.45;
  const ceilH_F = 8.05 + (profFL.ceilOffset + profFR.ceilOffset) * 0.38;

  const shelfH_N = 1.75 + profNL.lowShelfOffset * 0.25;
  const shelfHR_N = 1.75 + profNR.lowShelfOffset * 0.25;
  const midH_N = 3.9 + profNL.midOffset * 0.35;
  const midHR_N = 3.9 + profNR.midOffset * 0.35;
  const archH_N = 6.35 + profNL.upperLedgeOffset * 0.45;
  const archHR_N = 6.35 + profNR.upperLedgeOffset * 0.45;
  const ceilH_N = 8.05 + (profNL.ceilOffset + profNR.ceilOffset) * 0.38;

  const okF =
    projectInto(fpt.x - fpt.nx * baseWL_F, fpt.y - 0.6, fpt.z - fpt.nz * baseWL_F, cvFL0, 0.55) &&
    projectInto(fpt.x + fpt.nx * baseWR_F, fpt.y - 0.6, fpt.z + fpt.nz * baseWR_F, cvFR0, 0.55) &&
    projectInto(fpt.x - fpt.nx * baseWL_F, fpt.y - 5.4, fpt.z - fpt.nz * baseWL_F, cvFLB, 0.55) &&
    projectInto(fpt.x + fpt.nx * baseWR_F, fpt.y - 5.4, fpt.z + fpt.nz * baseWR_F, cvFRB, 0.55) &&
    projectInto(fpt.x - fpt.nx * shelfWL_F, fpt.y + shelfH_F, fpt.z - fpt.nz * shelfWL_F, cvFL_S, 0.55) &&
    projectInto(fpt.x + fpt.nx * shelfWR_F, fpt.y + shelfHR_F, fpt.z + fpt.nz * shelfWR_F, cvFR_S, 0.55) &&
    projectInto(fpt.x - fpt.nx * midWL_F, fpt.y + midH_F, fpt.z - fpt.nz * midWL_F, cvFL1, 0.55) &&
    projectInto(fpt.x + fpt.nx * midWR_F, fpt.y + midHR_F, fpt.z + fpt.nz * midWR_F, cvFR1, 0.55) &&
    projectInto(fpt.x - fpt.nx * archWL_F, fpt.y + archH_F, fpt.z - fpt.nz * archWL_F, cvFL2, 0.55) &&
    projectInto(fpt.x + fpt.nx * archWR_F, fpt.y + archHR_F, fpt.z + fpt.nz * archWR_F, cvFR2, 0.55) &&
    projectInto(fpt.x + fpt.nx * ((profFR.archOffset - profFL.archOffset) * 0.4), fpt.y + ceilH_F, fpt.z, cvFC, 0.55);

  const okN =
    projectInto(npt.x - npt.nx * baseWL_N, npt.y - 0.6, npt.z - npt.nz * baseWL_N, cvNL0, 0.55) &&
    projectInto(npt.x + npt.nx * baseWR_N, npt.y - 0.6, npt.z + npt.nz * baseWR_N, cvNR0, 0.55) &&
    projectInto(npt.x - npt.nx * baseWL_N, npt.y - 5.4, npt.z - npt.nz * baseWL_N, cvNLB, 0.55) &&
    projectInto(npt.x + npt.nx * baseWR_N, npt.y - 5.4, npt.z + npt.nz * baseWR_N, cvNRB, 0.55) &&
    projectInto(npt.x - npt.nx * shelfWL_N, npt.y + shelfH_N, npt.z - npt.nz * shelfWL_N, cvNL_S, 0.55) &&
    projectInto(npt.x + npt.nx * shelfWR_N, npt.y + shelfHR_N, npt.z + npt.nz * shelfWR_N, cvNR_S, 0.55) &&
    projectInto(npt.x - npt.nx * midWL_N, npt.y + midH_N, npt.z - npt.nz * midWL_N, cvNL1, 0.55) &&
    projectInto(npt.x + npt.nx * midWR_N, npt.y + midHR_N, npt.z + npt.nz * midWR_N, cvNR1, 0.55) &&
    projectInto(npt.x - npt.nx * archWL_N, npt.y + archH_N, npt.z - npt.nz * archWL_N, cvNL2, 0.55) &&
    projectInto(npt.x + npt.nx * archWR_N, npt.y + archHR_N, npt.z + npt.nz * archWR_N, cvNR2, 0.55) &&
    projectInto(npt.x + npt.nx * ((profNR.archOffset - profNL.archOffset) * 0.4), npt.y + ceilH_N, npt.z, cvNC, 0.55);

  if (!okF || !okN) return;

  const alpha = (blend > 0.48 || farZone.isCavePortalIn)
    ? Math.max(fogAlpha, 0.94)
    : fogAlpha * Math.min(1, 0.55 + blend * 0.45);
  const illum = Math.max(0, Math.min(1.25, headlightWallIllum));
  const wallRamp =
    illum > 0.18
      ? ramps.caveWallLit
      : illum > 0.04 || far.rawZ <= 68
      ? ramps.caveWall
      : ramps.caveWallDeep;
  const ceilRamp = illum > 0.2 ? ramps.caveCeilingLit : ramps.caveCeiling;
  const wallTintBias = 0.14 + illum * 0.34;

  ctx.save();

  // Cavern depth backdrop on portal mouth from outside, or at far vanishing depth (>106m) so mid-tunnel walls & road stay visible
  if ((!playerInCave && farZone.isCavePortalIn) || (playerInCave && !farZone.isCavePortalOut && blend > 0.45 && far.rawZ > 106)) {
    ctx.globalAlpha = Math.max(fogAlpha, 0.92);
    ctx.fillStyle = illum > 0.2 ? pickRampColor(ramps.caveCeilingLit, 0.34) : pickRampColor(ramps.caveWall, 0.32);
    ctx.beginPath();
    ctx.moveTo(cvFL0.x, cvFL0.y + 4);
    ctx.lineTo(cvFL_S.x, cvFL_S.y);
    ctx.lineTo(cvFL1.x, cvFL1.y);
    ctx.lineTo(cvFL2.x, cvFL2.y);
    ctx.lineTo(cvFC.x, cvFC.y);
    ctx.lineTo(cvFR2.x, cvFR2.y);
    ctx.lineTo(cvFR1.x, cvFR1.y);
    ctx.lineTo(cvFR_S.x, cvFR_S.y);
    ctx.lineTo(cvFR0.x, cvFR0.y + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = alpha;

  drawQuadDirect(ctx, cvFLB, cvNLB, cvNL0, cvFL0, pickRampColor(wallRamp, 0.15 + wallTintBias * 0.5));
  drawQuadDirect(ctx, cvFRB, cvNRB, cvNR0, cvFR0, pickRampColor(wallRamp, 0.12 + wallTintBias * 0.5));

  drawQuadDirect(ctx, cvFL0, cvNL0, cvNL_S, cvFL_S, pickRampColor(wallRamp, profFL.strataShade * 0.72 + wallTintBias));
  drawQuadDirect(ctx, cvFL_S, cvNL_S, cvNL1, cvFL1, pickRampColor(wallRamp, 0.25 + profFL.strataShade * 0.68 + wallTintBias * 0.75));
  drawQuadDirect(ctx, cvFL1, cvNL1, cvNL2, cvFL2, pickRampColor(ramps.caveWall, 0.12 + profFL.strataShade * 0.5 + wallTintBias * 0.45));

  drawQuadDirect(ctx, cvFR0, cvNR0, cvNR_S, cvFR_S, pickRampColor(wallRamp, profFR.strataShade * 0.68 + wallTintBias));
  drawQuadDirect(ctx, cvFR_S, cvNR_S, cvNR1, cvFR1, pickRampColor(wallRamp, 0.2 + profFR.strataShade * 0.64 + wallTintBias * 0.75));
  drawQuadDirect(ctx, cvFR1, cvNR1, cvNR2, cvFR2, pickRampColor(ramps.caveWall, 0.1 + profFR.strataShade * 0.45 + wallTintBias * 0.45));

  drawQuadDirect(ctx, cvFL2, cvNL2, cvNC, cvFC, pickRampColor(ceilRamp, profFL.strataShade * 0.65 + wallTintBias * 0.35));
  drawQuadDirect(ctx, cvFC, cvNC, cvNR2, cvFR2, pickRampColor(ceilRamp, profFR.strataShade * 0.55 + wallTintBias * 0.35));

  // Direct warm/xenon headlight grazing bounce across lower & mid cavern rock walls
  if (illum > 0.05) {
    const wallBeamAlpha = Math.min(0.28, illum * 0.23) * alpha;
    const upperBeamAlpha = Math.min(0.14, illum * 0.11) * alpha;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 1.0;
    const lowWallWash = getHeadlightRgba(headlightBeamColor, wallBeamAlpha);
    const midWallWash = getHeadlightRgba(headlightBeamColor, upperBeamAlpha);
    drawQuadDirect(ctx, cvFL0, cvNL0, cvNL_S, cvFL_S, lowWallWash);
    drawQuadDirect(ctx, cvFR0, cvNR0, cvNR_S, cvFR_S, lowWallWash);
    drawQuadDirect(ctx, cvFL_S, cvNL_S, cvNL1, cvFL1, midWallWash);
    drawQuadDirect(ctx, cvFR_S, cvNR_S, cvNR1, cvFR1, midWallWash);
    ctx.restore();
  }

  if (far.rawZ < 76) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.lineWidth = Math.max(1, 0.09 * far.cM.scale);
    ctx.beginPath();
    ctx.moveTo(cvFL_S.x, cvFL_S.y);
    ctx.lineTo(cvNL_S.x, cvNL_S.y);
    ctx.moveTo(cvFR_S.x, cvFR_S.y);
    ctx.lineTo(cvNR_S.x, cvNR_S.y);
    ctx.stroke();

    // Specular limestone rock ridge catchlight along wall shelves (glows cleanly in headlights)
    ctx.strokeStyle = illum > 0.08
      ? getHeadlightRgba(headlightBeamColor, Math.min(0.38, 0.12 + illum * 0.24))
      : 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = Math.max(1, 0.08 * far.cM.scale);
    ctx.beginPath();
    ctx.moveTo(cvFL_S.x, cvFL_S.y);
    ctx.lineTo(cvNL_S.x, cvNL_S.y);
    ctx.moveTo(cvFR_S.x, cvFR_S.y);
    ctx.lineTo(cvNR_S.x, cvNR_S.y);
    ctx.moveTo(cvFL1.x, cvFL1.y);
    ctx.lineTo(cvNL1.x, cvNL1.y);
    ctx.moveTo(cvFR1.x, cvFR1.y);
    ctx.lineTo(cvNR1.x, cvNR1.y);
    ctx.stroke();

    if (profFL.wetStreak > 0.62) {
      ctx.strokeStyle = illum > 0.12
        ? getHeadlightRgba(headlightBeamColor, Math.min(0.34, 0.12 + illum * 0.22))
        : 'rgba(180, 195, 210, 0.10)';
      ctx.lineWidth = Math.max(1, 0.08 * far.cM.scale);
      ctx.beginPath();
      ctx.moveTo(cvFL1.x, cvFL1.y);
      ctx.lineTo(cvFL_S.x, cvFL_S.y);
      ctx.lineTo(cvFL0.x, cvFL0.y);
      ctx.stroke();
    }
    if (profFR.wetStreak > 0.62) {
      ctx.strokeStyle = illum > 0.12
        ? getHeadlightRgba(headlightBeamColor, Math.min(0.34, 0.12 + illum * 0.22))
        : 'rgba(180, 195, 210, 0.10)';
      ctx.lineWidth = Math.max(1, 0.08 * far.cM.scale);
      ctx.beginPath();
      ctx.moveTo(cvFR1.x, cvFR1.y);
      ctx.lineTo(cvFR_S.x, cvFR_S.y);
      ctx.lineTo(cvFR0.x, cvFR0.y);
      ctx.stroke();
    }
  }

  // Stalactites inside cavern vault
  if (blend > 0.38 && fpt.index % 3 === 0 && far.rawZ > 4 && far.rawZ < 92) {
    const sc = far.cM.scale;
    const stalSide = fpt.index % 6 === 0 ? -0.38 : 0.34;
    const baseStalX = cvFC.x + (cvFR2.x - cvFL2.x) * stalSide * 0.44;
    const baseStalY = (cvFC.y + (stalSide < 0 ? cvFL2.y : cvFR2.y)) * 0.5;
    const stalW = Math.max(2.5, sc * 0.46);
    const stalH = Math.max(6, sc * (1.3 + ((fpt.index * 7) % 3) * 0.48));
    const midY = baseStalY + stalH * 0.46;
    const tipX = baseStalX + Math.sin(fpt.index) * stalW * 0.22;

    const stalRamp = illum > 0.24 ? ramps.caveWallLit : wallRamp;
    ctx.fillStyle = pickRampColor(stalRamp, 0.16 + wallTintBias * 0.4);
    ctx.beginPath();
    ctx.moveTo(baseStalX - stalW, baseStalY - 2);
    ctx.lineTo(baseStalX + stalW, baseStalY - 2);
    ctx.lineTo(baseStalX + stalW * 0.42, midY);
    ctx.lineTo(tipX, baseStalY + stalH);
    ctx.lineTo(baseStalX - stalW * 0.36, midY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pickRampColor(stalRamp, Math.min(1, 0.68 + wallTintBias * 0.6));
    ctx.beginPath();
    ctx.moveTo(baseStalX - stalW, baseStalY - 2);
    ctx.lineTo(baseStalX + stalW * 0.08, baseStalY - 2);
    ctx.lineTo(baseStalX + stalW * 0.04, midY);
    ctx.lineTo(tipX, baseStalY + stalH);
    ctx.lineTo(baseStalX - stalW * 0.36, midY);
    ctx.closePath();
    ctx.fill();

    const compX = baseStalX + (stalSide < 0 ? 1 : -1) * stalW * 1.45;
    const compH = stalH * 0.58;
    ctx.fillStyle = pickRampColor(stalRamp, 0.44 + wallTintBias * 0.4);
    ctx.beginPath();
    ctx.moveTo(compX - stalW * 0.5, baseStalY);
    ctx.lineTo(compX + stalW * 0.5, baseStalY);
    ctx.lineTo(compX, baseStalY + compH);
    ctx.closePath();
    ctx.fill();
  }

  // Prismatic crystal veins strictly inside enclosed cavern walls
  if (blend > 0.46 && fpt.index % 4 === 1 && far.rawZ > 4 && far.rawZ < 92) {
    const isLeft = fpt.index % 8 === 1;
    const wallX = isLeft ? (cvFL_S.x + cvFL1.x) * 0.5 : (cvFR_S.x + cvFR1.x) * 0.5;
    const wallY = isLeft ? (cvFL_S.y + cvFL1.y) * 0.5 : (cvFR_S.y + cvFR1.y) * 0.5;
    const sc = far.cM.scale;
    const dir = isLeft ? 1 : -1;
    const len = Math.max(4, sc * 0.92);
    const thick = Math.max(1.8, sc * 0.26);
    const pulse = 0.72 + 0.28 * Math.sin(nowMs * 0.004 + fpt.index);
    const cryCol = fpt.index % 8 === 1 ? ch.crystalPrimary : ch.crystalSecondary;

    ctx.globalAlpha = fogAlpha * 0.26 * pulse;
    ctx.fillStyle = cryCol;
    ctx.beginPath();
    ctx.arc(wallX + dir * len * 0.35, wallY, Math.max(5, len * 1.65), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = fogAlpha * 0.94;
    for (let k = -1; k <= 1; k++) {
      const prongLen = len * (k === 0 ? 1.05 : 0.72);
      const tilt = k * thick * 1.45;
      ctx.fillStyle = k === 0 ? cryCol : ch.crystalSecondary;
      ctx.beginPath();
      ctx.moveTo(wallX, wallY - thick * 0.7 + tilt * 0.25);
      ctx.lineTo(wallX + dir * prongLen * 0.76, wallY - thick * 0.5 + tilt);
      ctx.lineTo(wallX + dir * prongLen, wallY + tilt * 1.15);
      ctx.lineTo(wallX + dir * prongLen * 0.72, wallY + thick * 0.5 + tilt);
      ctx.lineTo(wallX, wallY + thick * 0.7 + tilt * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
    ctx.fillRect(Math.round(wallX + dir * len * 0.64) - 1, Math.round(wallY - thick * 0.3) - 1, 2, 2);
  }

  // Iron cavern lanterns strictly inside enclosed cavern walls
  if (blend > 0.5 && fpt.index % 6 === 0 && far.rawZ > 5 && far.rawZ < 86) {
    const isLeft = fpt.index % 12 === 0;
    const lx = isLeft ? cvFL1.x + (cvFL_S.x - cvFL1.x) * 0.45 : cvFR1.x + (cvFR_S.x - cvFR1.x) * 0.45;
    const ly = isLeft ? cvFL1.y + (cvFL_S.y - cvFL1.y) * 0.45 : cvFR1.y + (cvFR_S.y - cvFR1.y) * 0.45;
    const sc = far.cM.scale;
    const glowR = Math.max(9, sc * 2.15);

    ctx.globalAlpha = fogAlpha * 0.18;
    ctx.fillStyle = ch.lanternGlow;
    ctx.beginPath();
    ctx.arc(lx, ly, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = fogAlpha * 0.34;
    ctx.beginPath();
    ctx.arc(lx, ly, glowR * 0.54, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = fogAlpha;
    const bSz = Math.max(2, Math.round(sc * 0.22));
    // Wall iron sconce arm + cage
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = Math.max(1, bSz * 0.45);
    ctx.beginPath();
    ctx.moveTo(lx + (isLeft ? -bSz * 1.4 : bSz * 1.4), ly - bSz * 0.4);
    ctx.lineTo(lx, ly - bSz * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(lx - bSz * 0.8, ly - bSz, bSz * 1.6, bSz * 2);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(lx - bSz * 0.45, ly - bSz * 0.55, bSz * 0.9, bSz * 1.1);
  }

  // Grounded mountainside rock cliff facade at cave entrance / exit portals
  if ((farZone.isCavePortalIn || farZone.isCavePortalOut) && far.rawZ > 3.5 && far.rawZ < 130) {
    const sc = far.cM.scale;
    const cliffW = Math.max(15, sc * 3.8);
    const browH = Math.max(11, sc * 3.5);
    const groundDropY = Math.max(cvFLB.y, cvFL0.y + sc * 6.5);
    const groundDropRY = Math.max(cvFRB.y, cvFR0.y + sc * 6.5);
    ctx.globalAlpha = fogAlpha;

    // Grounded granite cliff buttress shoulders anchoring deep into the valley floor
    ctx.fillStyle = '#2b2926';
    ctx.beginPath();
    ctx.moveTo(cvFL0.x - cliffW * 1.55, groundDropY);
    ctx.lineTo(cvFL_S.x - cliffW * 1.28, cvFL_S.y + browH * 0.05);
    ctx.lineTo(cvFL1.x - cliffW * 0.92, cvFL1.y - browH * 0.52);
    ctx.lineTo(cvFL2.x - cliffW * 0.5, cvFL2.y - browH * 1.08);
    ctx.lineTo(cvFL2.x - cliffW * 0.12, cvFC.y - browH * 1.32);
    ctx.lineTo(cvFC.x - cliffW * 0.04, cvFC.y - browH * 1.12);
    ctx.lineTo(cvFR2.x + cliffW * 0.08, cvFC.y - browH * 1.26);
    ctx.lineTo(cvFR2.x + cliffW * 0.5, cvFR2.y - browH * 1.0);
    ctx.lineTo(cvFR1.x + cliffW * 0.92, cvFR1.y - browH * 0.46);
    ctx.lineTo(cvFR_S.x + cliffW * 1.28, cvFR_S.y + browH * 0.05);
    ctx.lineTo(cvFR0.x + cliffW * 1.55, groundDropRY);
    ctx.lineTo(cvFR0.x, groundDropRY);
    // Cut back along the rugged inner rock mouth opening
    ctx.lineTo(cvFR0.x, cvFR0.y + 2);
    ctx.lineTo(cvFR_S.x, cvFR_S.y);
    ctx.lineTo(cvFR1.x, cvFR1.y);
    ctx.lineTo(cvFR2.x, cvFR2.y);
    ctx.lineTo(cvFC.x, cvFC.y);
    ctx.lineTo(cvFL2.x, cvFL2.y);
    ctx.lineTo(cvFL1.x, cvFL1.y);
    ctx.lineTo(cvFL_S.x, cvFL_S.y);
    ctx.lineTo(cvFL0.x, cvFL0.y + 2);
    ctx.lineTo(cvFL0.x, groundDropY);
    ctx.closePath();
    ctx.fill();

    // Sunlit limestone/granite rock strata ledges across the upper cliff face
    ctx.fillStyle = '#4c4943';
    ctx.beginPath();
    ctx.moveTo(cvFL1.x - cliffW * 0.85, cvFL1.y - browH * 0.6);
    ctx.lineTo(cvFL2.x - cliffW * 0.55, cvFL2.y - browH * 1.15);
    ctx.lineTo(cvFL2.x - cliffW * 0.12, cvFC.y - browH * 1.38);
    ctx.lineTo(cvFC.x - cliffW * 0.04, cvFC.y - browH * 1.18);
    ctx.lineTo(cvFR2.x + cliffW * 0.08, cvFC.y - browH * 1.32);
    ctx.lineTo(cvFR2.x + cliffW * 0.35, cvFR2.y - browH * 0.68);
    ctx.lineTo(cvFC.x, cvFC.y - browH * 0.45);
    ctx.lineTo(cvFL2.x - cliffW * 0.18, cvFL2.y - browH * 0.42);
    ctx.closePath();
    ctx.fill();

    // Irregular mossy forest shelf hugging the cliff crest (varied sizes, natural placement)
    const mossSpots = 9;
    for (let m = 0; m < mossSpots; m++) {
      const t = (m / (mossSpots - 1)) * 1.24 - 0.12;
      const mx = cvFL2.x + (cvFR2.x - cvFL2.x) * t;
      const arc = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
      const my = cvFL2.y + (cvFC.y - cvFL2.y) * arc - browH * (0.82 + (m % 3) * 0.16);
      const mw = Math.max(4, sc * (0.72 + ((m * 5) % 4) * 0.24));
      ctx.fillStyle = m % 2 === 0 ? ch.foliageLight : ch.foliageDark;
      ctx.beginPath();
      ctx.ellipse(mx, my, mw, mw * 0.38, (m % 3 - 1) * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hanging woodland roots & ivy tendrils from upper rock mouth cracks
    ctx.strokeStyle = '#36522e';
    ctx.lineWidth = Math.max(1.1, sc * 0.09);
    for (let v = 0; v < 6; v++) {
      const f = 0.14 + v * 0.145;
      const vx = cvFL2.x + (cvFR2.x - cvFL2.x) * f;
      const vy = cvFL2.y + (cvFC.y - cvFL2.y) * Math.sin(f * Math.PI);
      const vLen = Math.max(4, sc * (0.75 + ((v * 3) % 4) * 0.38));
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.quadraticCurveTo(vx + Math.sin(v * 2.1) * sc * 0.2, vy + vLen * 0.55, vx - Math.cos(v) * sc * 0.14, vy + vLen);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Renders Forest Trail / Wooden Bridge / Cave Road architecture:
 * - Weathered timber bridge decks & trestle legs over mountain river gorges
 * - Rustic timber log guardrails on forest trails & rocky cave curbs
 * - Explorer lantern posts, Timber Expedition Gates & Mossy Stone Ruin Archways
 */
export function renderAdventureRoadSlice3D(params: {
  ctx: CanvasRenderingContext2D;
  far: RoadSlice3D;
  near: RoadSlice3D;
  farZone: AdventureZoneSample;
  fogAlpha: number;
  breachedSliceIdx: number;
  headlightRoadIllum?: number;
  headlightBeamColor?: string;
  nowMs: number;
  projectInto: Project3DIntoFn;
}) {
  const {
    ctx,
    far,
    near,
    farZone,
    fogAlpha,
    breachedSliceIdx,
    headlightRoadIllum = 0,
    headlightBeamColor = '#fef9c3',
    nowMs,
    projectInto,
  } = params;
  const fpt = far.pt;
  const isNearMid = far.rawZ < 64;
  const ch = farZone.chapter;
  const inCave = farZone.zone === 'cave';
  const onBridge = farZone.isWoodenBridge;
  const roadIllum = Math.max(0, Math.min(1.35, headlightRoadIllum));

  if (onBridge) {
    if (fpt.index % 5 === 0 && far.rawZ > 2.2) {
      if (projectInto(fpt.x, fpt.y - 9.5, fpt.z, wp0, 0.55)) {
        const legW = Math.max(2, Math.round(0.28 * far.cM.scale));
        const topY = Math.round((far.uL.y + far.uR.y) * 0.5);
        const botY = Math.round(wp0.y);
        if (botY > topY) {
          ctx.fillStyle = '#3d210d';
          ctx.fillRect(Math.round(far.uL.x), topY, legW, botY - topY);
          ctx.fillRect(Math.round(far.uR.x) - legW, topY, legW, botY - topY);
          ctx.strokeStyle = '#633818';
          ctx.lineWidth = Math.max(1, Math.round(legW * 0.62));
          ctx.beginPath();
          ctx.moveTo(far.uL.x, topY);
          ctx.lineTo(far.uR.x, Math.min(botY, topY + (botY - topY) * 0.55));
          ctx.moveTo(far.uR.x, topY);
          ctx.lineTo(far.uL.x, Math.min(botY, topY + (botY - topY) * 0.55));
          ctx.stroke();
        }
      }
    }
    drawQuadPtsDirect(ctx, far.pL, near.pL, near.uL, far.uL, '#6b3e1b', far.rawZ < 64 ? '#291507' : undefined);
    drawQuadPtsDirect(ctx, far.pR, near.pR, near.uR, far.uR, '#42240d', far.rawZ < 64 ? '#291507' : undefined);
  } else {
    const sideWallL = inCave
      ? roadIllum > 0.25 ? '#4b5263' : '#393f4c'
      : '#35482b';
    const sideWallR = inCave
      ? roadIllum > 0.25 ? '#3e4452' : '#2f3440'
      : '#263420';
    drawQuadPtsDirect(ctx, far.pL, near.pL, near.uL, far.uL, sideWallL);
    drawQuadPtsDirect(ctx, far.pR, near.pR, near.uR, far.uR, sideWallR);
  }

  const plankTone = deterministicNoise(fpt.index, 2.3);
  const deckColor = onBridge
    ? plankTone > 0.5 ? '#7c4a21' : '#6b3e1b'
    : inCave
    ? roadIllum > 0.45
      ? plankTone > 0.5 ? '#4e5668' : '#474e5e'
      : roadIllum > 0.14
      ? plankTone > 0.5 ? '#3f4656' : '#393f4d'
      : plankTone > 0.5 ? '#323845' : '#2d323e'
    : plankTone > 0.5 ? '#3b3f45' : '#373b40';
  drawQuadPtsDirect(ctx, far.pL, far.pR, near.pR, near.pL, deckColor);

  const nearLineScale = Math.min(near.cM.scale, 95);
  const farLineScale = Math.min(far.cM.scale, 95);

  if (onBridge) {
    if (isNearMid) {
      ctx.strokeStyle = '#331a08';
      ctx.lineWidth = Math.max(1, 0.1 * nearLineScale);
      ctx.beginPath();
      ctx.moveTo(far.pL.x, far.pL.y);
      ctx.lineTo(far.pR.x, far.pR.y);
      ctx.stroke();
    }
  } else if (isNearMid) {
    const trimCol = inCave ? 'rgba(18, 20, 24, 0.35)' : 'rgba(54, 72, 42, 0.38)';
    wp0.x = far.pL.x + (far.pR.x - far.pL.x) * 0.065;
    wp0.y = far.pL.y + (far.pR.y - far.pL.y) * 0.065;
    wp1.x = near.pL.x + (near.pR.x - near.pL.x) * 0.065;
    wp1.y = near.pL.y + (near.pR.y - near.pL.y) * 0.065;
    drawQuadPtsDirect(ctx, far.pL, wp0, wp1, near.pL, trimCol);

    wp0.x = far.pR.x - (far.pR.x - far.pL.x) * 0.065;
    wp0.y = far.pR.y - (far.pR.y - far.pL.y) * 0.065;
    wp1.x = near.pR.x - (near.pR.x - near.pL.x) * 0.065;
    wp1.y = near.pR.y - (near.pR.y - near.pL.y) * 0.065;
    drawQuadPtsDirect(ctx, wp0, far.pR, near.pR, wp1, trimCol);
  }

  if (inCave && far.rawZ < 88) {
    wp0.x = far.pL.x + (far.pR.x - far.pL.x) * 0.34;
    wp0.y = far.pL.y + (far.pR.y - far.pL.y) * 0.34;
    wp1.x = far.pL.x + (far.pR.x - far.pL.x) * 0.66;
    wp1.y = far.pL.y + (far.pR.y - far.pL.y) * 0.66;
    wp2.x = near.pL.x + (near.pR.x - near.pL.x) * 0.66;
    wp2.y = near.pL.y + (near.pR.y - near.pL.y) * 0.66;
    wp3.x = near.pL.x + (near.pR.x - near.pL.x) * 0.34;
    wp3.y = near.pL.y + (near.pR.y - near.pL.y) * 0.34;
    ctx.globalAlpha = fogAlpha * (roadIllum > 0.08 ? 0.14 : 0.06);
    drawQuadPtsDirect(ctx, wp0, wp1, wp2, wp3, roadIllum > 0.1 ? headlightBeamColor : ch.crystalPrimary);
    ctx.globalAlpha = fogAlpha;
  }

  ctx.strokeStyle = onBridge
    ? '#b45309'
    : inCave
    ? roadIllum > 0.08
      ? getHeadlightRgba(headlightBeamColor, Math.min(0.88, 0.42 + roadIllum * 0.46))
      : 'rgba(203, 213, 225, 0.36)'
    : 'rgba(226, 232, 240, 0.42)';
  ctx.globalAlpha = fogAlpha * (inCave ? (roadIllum > 0.08 ? 0.88 : 0.48) : 0.46);
  ctx.lineWidth = Math.max(1.1, 0.09 * nearLineScale);
  ctx.beginPath();
  ctx.moveTo(far.pL.x, far.pL.y);
  ctx.lineTo(near.pL.x, near.pL.y);
  ctx.moveTo(far.pR.x, far.pR.y);
  ctx.lineTo(near.pR.x, near.pR.y);
  ctx.stroke();
  ctx.globalAlpha = fogAlpha;

  if (fpt.index % 2 === 0) {
    ctx.strokeStyle = onBridge
      ? 'rgba(254, 243, 199, 0.38)'
      : inCave
      ? roadIllum > 0.08
        ? getHeadlightRgba(headlightBeamColor, Math.min(0.9, 0.44 + roadIllum * 0.46))
        : 'rgba(203, 213, 225, 0.38)'
      : 'rgba(253, 224, 71, 0.42)';
    ctx.lineWidth = Math.max(1.1, 0.08 * nearLineScale);
    ctx.beginPath();
    ctx.moveTo(far.cM.x, far.cM.y);
    ctx.lineTo(near.cM.x, near.cM.y);
    ctx.stroke();
  }

  if (Math.abs(fpt.curvature) > 0.011) {
    const isInsideLeft = fpt.curvature < 0;
    const curbCol = inCave
      ? roadIllum > 0.22
        ? fpt.index % 2 === 0 ? '#5c6478' : '#737d94'
        : fpt.index % 2 === 0 ? '#3a404f' : '#464d5e'
      : fpt.index % 2 === 0 ? '#4d5444' : '#5e5b52';
    if (isInsideLeft) {
      wp0.x = far.pL.x + (far.pR.x - far.pL.x) * 0.065;
      wp0.y = far.pL.y + (far.pR.y - far.pL.y) * 0.065;
      wp1.x = near.pL.x + (near.pR.x - near.pL.x) * 0.065;
      wp1.y = near.pL.y + (near.pR.y - near.pL.y) * 0.065;
      drawQuadPtsDirect(ctx, far.pL, wp0, wp1, near.pL, curbCol);
    } else {
      wp0.x = far.pR.x - (far.pR.x - far.pL.x) * 0.065;
      wp0.y = far.pR.y - (far.pR.y - far.pL.y) * 0.065;
      wp1.x = near.pR.x - (near.pR.x - near.pL.x) * 0.065;
      wp1.y = near.pR.y - (near.pR.y - near.pL.y) * 0.065;
      drawQuadPtsDirect(ctx, wp0, far.pR, near.pR, wp1, curbCol);
    }
  }

  if (fpt.hasBoostPad && !fpt.boostTriggered) {
    const padW = Math.max(4, Math.round(1.45 * farLineScale));
    ctx.fillStyle = ch.crystalPrimary;
    ctx.beginPath();
    ctx.moveTo(Math.round(far.cM.x), Math.round(far.cM.y - padW * 0.65));
    ctx.lineTo(Math.round(far.cM.x + padW), Math.round(far.cM.y + padW * 0.5));
    ctx.lineTo(Math.round(far.cM.x - padW), Math.round(far.cM.y + padW * 0.5));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(far.cM.x - 1), Math.round(far.cM.y - padW * 0.25), 2, Math.max(2, Math.round(padW * 0.5)));
  }

  const isBreached = breachedSliceIdx >= 0 && Math.abs(fpt.index - breachedSliceIdx) <= 1;
  if (!isBreached) {
    if (inCave) {
      drawQuadPtsDirect(
        ctx,
        far.gL,
        near.gL,
        near.pL,
        far.pL,
        roadIllum > 0.2 ? 'rgba(64, 67, 74, 0.84)' : 'rgba(22, 22, 24, 0.84)'
      );
      drawQuadPtsDirect(
        ctx,
        far.gR,
        near.gR,
        near.pR,
        far.pR,
        roadIllum > 0.2 ? 'rgba(50, 53, 60, 0.84)' : 'rgba(16, 16, 18, 0.84)'
      );
      if (fpt.index % 3 === 0 && far.rawZ < 75) {
        const dotSz = Math.max(2, Math.round(0.12 * farLineScale));
        ctx.fillStyle = ch.crystalPrimary;
        ctx.fillRect(far.gL.x - dotSz * 0.5, (far.gL.y + far.pL.y) * 0.5 - dotSz * 0.5, dotSz, dotSz);
        ctx.fillStyle = ch.crystalSecondary;
        ctx.fillRect(far.gR.x - dotSz * 0.5, (far.gR.y + far.pR.y) * 0.5 - dotSz * 0.5, dotSz, dotSz);
      }
    } else {
      const woodLight = onBridge ? '#925728' : '#7a4b25';
      const woodDark = onBridge ? '#5c3415' : '#4a2c14';
      if (onBridge) {
        drawQuadPtsDirect(ctx, far.gL, near.gL, near.pL, far.pL, 'rgba(92, 52, 21, 0.45)', '#291507');
        drawQuadPtsDirect(ctx, far.gR, near.gR, near.pR, far.pR, 'rgba(58, 32, 12, 0.45)', '#291507');
      }
      ctx.strokeStyle = woodLight;
      ctx.lineWidth = Math.max(2, 0.15 * nearLineScale);
      ctx.beginPath();
      ctx.moveTo(far.gL.x, far.gL.y);
      ctx.lineTo(near.gL.x, near.gL.y);
      ctx.moveTo(far.gR.x, far.gR.y);
      ctx.lineTo(near.gR.x, near.gR.y);
      ctx.stroke();

      if (far.rawZ < 60) {
        ctx.strokeStyle = woodDark;
        ctx.lineWidth = Math.max(1.5, 0.11 * nearLineScale);
        ctx.beginPath();
        ctx.moveTo((far.gL.x + far.pL.x) * 0.5, (far.gL.y + far.pL.y) * 0.5);
        ctx.lineTo((near.gL.x + near.pL.x) * 0.5, (near.gL.y + near.pL.y) * 0.5);
        ctx.moveTo((far.gR.x + far.pR.x) * 0.5, (far.gR.y + far.pR.y) * 0.5);
        ctx.lineTo((near.gR.x + near.pR.x) * 0.5, (near.gR.y + near.pR.y) * 0.5);
        ctx.stroke();
      }

      if (far.rawZ < 58) {
        ctx.strokeStyle = '#38200d';
        ctx.lineWidth = Math.max(1.5, 0.15 * farLineScale);
        ctx.beginPath();
        ctx.moveTo(far.pL.x, far.pL.y);
        ctx.lineTo(far.gL.x, far.gL.y);
        ctx.moveTo(far.pR.x, far.pR.y);
        ctx.lineTo(far.gR.x, far.gR.y);
        ctx.stroke();
      }
    }
  }

  if (!inCave && fpt.index % 8 === 0 && far.rawZ > 6 && far.rawZ < 105) {
    const isLeft = fpt.index % 16 === 0;
    const base = isLeft ? far.gL : far.gR;
    const postH = Math.max(6, 2.35 * far.cM.scale);
    const arm = Math.max(2, 0.65 * far.cM.scale) * (isLeft ? 1 : -1);
    const topY = base.y - postH;
    const lx = base.x + arm;

    ctx.strokeStyle = '#38200d';
    ctx.lineWidth = Math.max(1.5, 0.16 * far.cM.scale);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x, topY);
    ctx.lineTo(lx, topY);
    ctx.stroke();

    const glowPulse = 0.72 + 0.28 * Math.sin(nowMs * 0.006 + fpt.index);
    ctx.fillStyle = ch.lanternGlow;
    ctx.globalAlpha = fogAlpha * 0.28 * glowPulse;
    ctx.beginPath();
    ctx.arc(lx, topY + 2, Math.max(3, 0.45 * far.cM.scale), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = fogAlpha;
    ctx.fillStyle = '#fef3c7';
    const sz = Math.max(2, Math.round(0.24 * far.cM.scale));
    ctx.fillRect(lx - sz * 0.5, topY + 1, sz, sz * 1.2);
  }

  if (farZone.hasRuinArch && far.rawZ > 4 && far.rawZ < 124) {
    const hw = fpt.width * 0.56;
    const archH = 5.4;
    if (
      projectInto(fpt.x - fpt.nx * hw, fpt.y, fpt.z - fpt.nz * hw, wp0, 0.55) &&
      projectInto(fpt.x + fpt.nx * hw, fpt.y, fpt.z + fpt.nz * hw, wp1, 0.55) &&
      projectInto(fpt.x - fpt.nx * (hw - 0.35), fpt.y + archH, fpt.z - fpt.nz * (hw - 0.35), wp2, 0.55) &&
      projectInto(fpt.x + fpt.nx * (hw - 0.35), fpt.y + archH, fpt.z + fpt.nz * (hw - 0.35), wp3, 0.55)
    ) {
      const colW = Math.max(3, Math.round(0.58 * far.cM.scale));
      ctx.strokeStyle = '#36332f';
      ctx.lineWidth = colW + 2;
      ctx.beginPath();
      ctx.moveTo(wp0.x, wp0.y);
      ctx.lineTo(wp2.x, wp2.y);
      ctx.lineTo(wp3.x, wp3.y);
      ctx.lineTo(wp1.x, wp1.y);
      ctx.stroke();

      ctx.strokeStyle = '#6b665e';
      ctx.lineWidth = colW;
      ctx.stroke();

      ctx.fillStyle = ch.foliageLight;
      const span = wp3.x - wp2.x;
      for (let m = 0; m < 6; m++) {
        const f = m / 5;
        ctx.beginPath();
        ctx.ellipse(wp2.x + span * f, wp2.y - 1, Math.max(2, colW * 0.65), Math.max(1.5, colW * 0.35), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const midX = (wp2.x + wp3.x) * 0.5;
      const midY = (wp2.y + wp3.y) * 0.5;
      ctx.fillStyle = ch.crystalPrimary;
      ctx.fillRect(midX - 2, midY - 2, Math.max(3, colW * 0.45), Math.max(3, colW * 0.45));
    }
  }

  if (farZone.hasTimberGate && far.rawZ > 4 && far.rawZ < 120) {
    const hw = fpt.width * 0.55;
    const gateH = 4.9;
    if (
      projectInto(fpt.x - fpt.nx * hw, fpt.y, fpt.z - fpt.nz * hw, wp0, 0.55) &&
      projectInto(fpt.x + fpt.nx * hw, fpt.y, fpt.z + fpt.nz * hw, wp1, 0.55) &&
      projectInto(fpt.x - fpt.nx * hw, fpt.y + gateH, fpt.z - fpt.nz * hw, wp2, 0.55) &&
      projectInto(fpt.x + fpt.nx * hw, fpt.y + gateH, fpt.z + fpt.nz * hw, wp3, 0.55)
    ) {
      const logW = Math.max(2, Math.round(0.32 * far.cM.scale));
      ctx.strokeStyle = '#38200d';
      ctx.lineWidth = logW + 2;
      ctx.beginPath();
      ctx.moveTo(wp0.x, wp0.y);
      ctx.lineTo(wp2.x, wp2.y);
      ctx.lineTo(wp3.x, wp3.y);
      ctx.lineTo(wp1.x, wp1.y);
      ctx.stroke();

      ctx.strokeStyle = '#7c4a21';
      ctx.lineWidth = logW;
      ctx.stroke();

      const lanY = (wp2.y + wp3.y) * 0.5 + Math.max(3, 0.4 * far.cM.scale);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(wp2.x + (wp3.x - wp2.x) * 0.28 - 1.5, lanY, Math.max(2, logW * 0.65), Math.max(3, logW * 0.8));
      ctx.fillRect(wp2.x + (wp3.x - wp2.x) * 0.72 - 1.5, lanY, Math.max(2, logW * 0.65), Math.max(3, logW * 0.8));
    }
  }

  ctx.globalAlpha = 1.0;
}

function drawQuadPtsDirect(
  ctx: CanvasRenderingContext2D,
  a: Projected3D,
  b: Projected3D,
  c: Projected3D,
  d: Projected3D,
  fillStyle: string,
  strokeStyle?: string
) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ===========================================================================
// MOUNTAIN DRIVE 3D RENDERING (Natural Roadless Dirt Mountains & Peak Jumps)
// ===========================================================================

const MTN_TERRAIN_LATS = [-82.0, -32.0, -13.5, -5.8, 5.8, 13.5, 32.0, 82.0];

function fillMountainTerrainRow(
  pt: SCurvePoint,
  projectInto: Project3DIntoFn,
  row: TerrainRow
) {
  const refY = pt.isChasmGap ? pt.y - 3.2 : pt.y;
  for (let k = 0; k < 8; k++) {
    const lat = MTN_TERRAIN_LATS[k];
    const wx = pt.x + pt.nx * lat;
    const wz = pt.z + pt.nz * lat;
    const wy = sampleMountainTerrainElevation(lat, wz, refY, Boolean(pt.isChasmGap));
    row.ok[k] = projectInto(wx, wy, wz, row.pts[k], 0.55);
  }
}

/**
 * Renders sculpted alpine mountain slopes, earthy shoulders, granite crags, and deep canyon chasms
 * with zero per-frame allocations.
 */
export function renderMountainTerrainMesh3D(params: {
  ctx: CanvasRenderingContext2D;
  visibleSlices: RoadSlice3D[];
  visibleCount: number;
  projectInto: Project3DIntoFn;
  skyIsNight: boolean;
}) {
  const { ctx, visibleSlices, visibleCount, projectInto, skyIsNight } = params;

  let farRow = terrainRowA;
  let nearRow = terrainRowB;
  let prevNearIndex = -999999;

  const ridgeOuterL = skyIsNight ? '#1c2a24' : '#3d5a45';
  const ridgeOuterR = skyIsNight ? '#15201b' : '#2e4736';
  const midSlopeL = skyIsNight ? '#212c25' : '#4a5c42';
  const midSlopeR = skyIsNight ? '#19221c' : '#3b4b35';
  const shoulderDirtL = skyIsNight ? '#2b241f' : '#6a523e';
  const shoulderDirtR = skyIsNight ? '#231d19' : '#574232';
  const canyonFloor = skyIsNight ? '#0f172a' : '#2d353a';
  const chasmMist = skyIsNight ? '#1e293b' : '#475569';

  for (let i = 0; i < visibleCount - 1; i++) {
    const far = visibleSlices[i];
    const near = visibleSlices[i + 1];
    if (Math.abs(far.pt.index - near.pt.index) > 2) continue;
    if (far.rawZ > 154) continue;

    const fpt = far.pt;
    const npt = near.pt;
    const fogAlpha = computeDistanceFogAlpha(far.rawZ, 108, 154);
    if (fogAlpha <= 0.02) continue;

    if (fpt.index === prevNearIndex) {
      const tmp = farRow;
      farRow = nearRow;
      nearRow = tmp;
    } else {
      fillMountainTerrainRow(fpt, projectInto, farRow);
    }
    fillMountainTerrainRow(npt, projectInto, nearRow);
    prevNearIndex = npt.index;

    const fp = farRow.pts;
    const fo = farRow.ok;
    const np = nearRow.pts;
    const no = nearRow.ok;
    const inGap = Boolean(fpt.isChasmGap || npt.isChasmGap);
    const alt = (fpt.index & 1) === 0;

    ctx.globalAlpha = fogAlpha;

    if (fo[0] && fo[1] && no[1] && no[0]) {
      drawQuadDirect(ctx, fp[0], fp[1], np[1], np[0], ridgeOuterL);
    }
    if (fo[6] && fo[7] && no[7] && no[6]) {
      drawQuadDirect(ctx, fp[6], fp[7], np[7], np[6], ridgeOuterR);
    }
    if (fo[1] && fo[2] && no[2] && no[1]) {
      drawQuadDirect(
        ctx,
        fp[1],
        fp[2],
        np[2],
        np[1],
        inGap ? chasmMist : alt ? midSlopeL : '#43543b'
      );
    }
    if (fo[5] && fo[6] && no[6] && no[5]) {
      drawQuadDirect(
        ctx,
        fp[5],
        fp[6],
        np[6],
        np[5],
        inGap ? chasmMist : alt ? midSlopeR : '#35442f'
      );
    }
    if (fo[2] && fo[3] && no[3] && no[2]) {
      drawQuadDirect(
        ctx,
        fp[2],
        fp[3],
        np[3],
        np[2],
        inGap ? '#44403c' : alt ? shoulderDirtL : '#614a37'
      );
    }
    if (fo[4] && fo[5] && no[5] && no[4]) {
      drawQuadDirect(
        ctx,
        fp[4],
        fp[5],
        np[5],
        np[4],
        inGap ? '#3b3734' : alt ? shoulderDirtR : '#4f3c2d'
      );
    }
    if (fo[3] && fo[4] && no[4] && no[3]) {
      drawQuadDirect(
        ctx,
        fp[3],
        fp[4],
        np[4],
        np[3],
        inGap ? canyonFloor : skyIsNight ? '#261f1a' : '#5e4937'
      );
    }

    // Crisp snow/granite rim highlights along distant outer mountain peaks
    if (far.rawZ < 105 && !inGap) {
      ctx.strokeStyle = skyIsNight ? 'rgba(148, 163, 184, 0.16)' : 'rgba(226, 232, 240, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (fo[1] && no[1]) {
        ctx.moveTo(fp[1].x, fp[1].y);
        ctx.lineTo(np[1].x, np[1].y);
      }
      if (fo[6] && no[6]) {
        ctx.moveTo(fp[6].x, fp[6].y);
        ctx.lineTo(np[6].x, np[6].y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1.0;
}

/**
 * Renders Mountain Drive natural props: snow-dusted pines, granite boulders, highland scrub bushes,
 * and rocky dirt outcrops anchored directly on the mountainside.
 */
export function renderMountainProp3D(params: {
  ctx: CanvasRenderingContext2D;
  prop: WorldProp3D;
  roadY: number;
  isChasmGap: boolean;
  nowMs: number;
  pxW: number;
  projectInto: Project3DIntoFn;
}) {
  const { ctx, prop, roadY, isChasmGap, pxW, projectInto } = params;
  if (isChasmGap && Math.abs(prop.lateralOffset) < 22) return;

  const groundY = sampleMountainTerrainElevation(prop.lateralOffset, prop.z, roadY, isChasmGap);
  if (!projectInto(prop.x, groundY, prop.z, wpBase)) return;
  if (wpBase.x < -44 || wpBase.x > pxW + 44 || wpBase.z > 158) return;

  const s = prop.scale;
  const sc = wpBase.scale;
  const rawZ = wpBase.z;
  const fogAlpha = computeDistanceFogAlpha(rawZ, 102, 154);
  if (fogAlpha <= 0.02) return;

  const bx = Math.round(wpBase.x);
  const by = Math.round(wpBase.y);
  ctx.globalAlpha = fogAlpha;

  if (prop.variant === 2) {
    // Faceted granite mountain boulder cluster with earthy base
    const bw = 2.1 * s;
    const bh = 1.65 * s;
    const okL = projectInto(prop.x - bw * 0.52, groundY, prop.z, wp0);
    const okR = projectInto(prop.x + bw * 0.52, groundY, prop.z, wp1);
    const okTop = projectInto(prop.x - bw * 0.12, groundY + bh, prop.z, wp2);
    const okMid = projectInto(prop.x + bw * 0.16, groundY + bh * 0.62, prop.z + 0.4, wp3);
    if (okL && okR && okTop && okMid) {
      drawQuadDirect(ctx, wp0, wp3, wp2, wp0, prop.shade > 0.5 ? '#94a3b8' : '#a8a29e');
      ctx.beginPath();
      ctx.moveTo(wp3.x, wp3.y);
      ctx.lineTo(wp1.x, wp1.y);
      ctx.lineTo(wp2.x, wp2.y);
      ctx.closePath();
      ctx.fillStyle = '#57534e';
      ctx.fill();

      // Earth/dirt mound collar around boulder base
      const baseRx = Math.max(3, Math.round(Math.abs(wp1.x - wp0.x) * 0.58));
      ctx.fillStyle = '#57412f';
      ctx.beginPath();
      ctx.ellipse(bx, by + 1, baseRx, Math.max(1.5, baseRx * 0.28), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  if (prop.variant === 3) {
    // Highland alpine scrub / dry heather bush clump
    const bushR = Math.max(3, Math.round(0.88 * s * sc));
    const bushH = Math.max(3, Math.round(0.75 * s * sc));
    ctx.fillStyle = '#3f5233';
    ctx.beginPath();
    ctx.ellipse(bx, by - Math.round(bushH * 0.35), bushR, Math.max(2, Math.round(bushH * 0.65)), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = prop.shade > 0.5 ? '#657c46' : '#586d3e';
    ctx.beginPath();
    ctx.ellipse(
      bx - Math.round(bushR * 0.28),
      by - Math.round(bushH * 0.55),
      Math.max(2, Math.round(bushR * 0.62)),
      Math.max(2, Math.round(bushH * 0.5)),
      0,
      0,
      Math.PI * 2
    );
    ctx.ellipse(
      bx + Math.round(bushR * 0.3),
      by - Math.round(bushH * 0.48),
      Math.max(2, Math.round(bushR * 0.52)),
      Math.max(2, Math.round(bushH * 0.44)),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.globalAlpha = 1.0;
    return;
  }

  if (prop.variant === 4) {
    // Earthy dirt mound & rugged rock cluster / mountain stump
    const mw = Math.max(4, Math.round(1.25 * s * sc));
    const mh = Math.max(2, Math.round(0.55 * s * sc));
    ctx.fillStyle = '#6e5038';
    ctx.beginPath();
    ctx.ellipse(bx, by, mw, mh, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.moveTo(bx - Math.round(mw * 0.45), by);
    ctx.lineTo(bx - Math.round(mw * 0.1), by - Math.round(mh * 1.65));
    ctx.lineTo(bx + Math.round(mw * 0.35), by);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
    return;
  }

  // Snow-dusted alpine pine tree
  if (!projectInto(prop.x, groundY + 5.8 * s, prop.z, wp0)) {
    ctx.globalAlpha = 1.0;
    return;
  }
  const th = Math.max(7, Math.round(by - wp0.y));
  const tw = Math.max(5, Math.round(th * 0.54));
  const trunkH = Math.max(2, Math.round(th * 0.18));
  const trunkW = Math.max(1, Math.round(tw * 0.2));

  ctx.fillStyle = '#47362b';
  ctx.fillRect(bx - Math.round(trunkW * 0.5), by - trunkH, trunkW, trunkH);

  const t0Top = by - Math.round(th * 0.52);
  const t0Bot = by - trunkH;
  const t0HW = Math.round(tw * 0.52);
  const t1Top = by - Math.round(th * 0.78);
  const t1Bot = by - Math.round(th * 0.36);
  const t1HW = Math.round(tw * 0.41);
  const t2Top = by - th;
  const t2Bot = by - Math.round(th * 0.62);
  const t2HW = Math.round(tw * 0.28);

  ctx.fillStyle = prop.shade > 0.5 ? '#4e8462' : '#3d6f50';
  ctx.beginPath();
  ctx.moveTo(bx, t0Top);
  ctx.lineTo(bx + t0HW, t0Bot);
  ctx.lineTo(bx - t0HW, t0Bot);
  ctx.closePath();
  ctx.moveTo(bx, t1Top);
  ctx.lineTo(bx + t1HW, t1Bot);
  ctx.lineTo(bx - t1HW, t1Bot);
  ctx.closePath();
  ctx.moveTo(bx, t2Top);
  ctx.lineTo(bx + t2HW, t2Bot);
  ctx.lineTo(bx - t2HW, t2Bot);
  ctx.closePath();
  ctx.fill();

  // Snow cap tip on high mountain pines
  if (rawZ < 92 && th >= 14) {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(bx, t2Top);
    ctx.lineTo(bx + Math.max(2, Math.round(t2HW * 0.48)), t2Top + Math.max(2, Math.round(th * 0.14)));
    ctx.lineTo(bx - Math.max(2, Math.round(t2HW * 0.48)), t2Top + Math.max(2, Math.round(th * 0.14)));
    ctx.closePath();
    ctx.fill();
  }
  if (rawZ < 76) {
    ctx.strokeStyle = '#14241c';
    ctx.lineWidth = Math.max(1, Math.min(1.5, sc * 0.05));
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}

/**
 * Renders the roadless Mountain Drive ridge crest directly as packed mountain dirt, gravel pebbles,
 * mossy alpine shoulders, natural wheel ruts, rock-and-earth peak jump crests, and mountain-to-mountain
 * chasm cliff drops (zero asphalt roads or street lane markings!).
 */
export function renderMountainRoadSlice3D(params: {
  ctx: CanvasRenderingContext2D;
  far: RoadSlice3D;
  near: RoadSlice3D;
  fogAlpha: number;
  nowMs: number;
  projectInto: Project3DIntoFn;
}) {
  const { ctx, far, near, fogAlpha, nowMs, projectInto } = params;
  const fpt = far.pt;
  const npt = near.pt;
  const farIsGap = Boolean(fpt.isChasmGap);
  const nearIsGap = Boolean(npt.isChasmGap);

  ctx.globalAlpha = fogAlpha;

  // 1. Open Chasm Gap between two mountains: completely empty open canyon air!
  if (farIsGap && nearIsGap) {
    ctx.globalAlpha = 1.0;
    return;
  }

  if (farIsGap && !nearIsGap) {
    // Near slice is the takeoff mountain's sheer dirt & granite cliff face!
    const hw = npt.width * 0.55;
    if (
      projectInto(npt.x - npt.nx * hw, npt.y - 18, npt.z - npt.nz * hw, wp0, 0.55) &&
      projectInto(npt.x + npt.nx * hw, npt.y - 18, npt.z + npt.nz * hw, wp1, 0.55) &&
      projectInto(npt.x - npt.nx * hw, npt.y - 2.6, npt.z - npt.nz * hw, wp2, 0.55) &&
      projectInto(npt.x + npt.nx * hw, npt.y - 2.6, npt.z + npt.nz * hw, wp3, 0.55)
    ) {
      drawQuadDirect(ctx, wp2, wp3, wp1, wp0, '#44403c');
      drawQuadDirect(ctx, near.pL, near.pR, wp3, wp2, '#6b4c35');
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  if (!farIsGap && nearIsGap) {
    // Far slice is the opposite mountain peak rising across the chasm!
    const hw = fpt.width * 0.58;
    if (
      projectInto(fpt.x - fpt.nx * hw, fpt.y - 20, fpt.z - fpt.nz * hw, wp0, 0.55) &&
      projectInto(fpt.x + fpt.nx * hw, fpt.y - 20, fpt.z + fpt.nz * hw, wp1, 0.55) &&
      projectInto(fpt.x - fpt.nx * hw, fpt.y - 2.8, fpt.z - fpt.nz * hw, wp2, 0.55) &&
      projectInto(fpt.x + fpt.nx * hw, fpt.y - 2.8, fpt.z + fpt.nz * hw, wp3, 0.55)
    ) {
      // Lower jagged granite cliff wall + upper warm soil strata cap
      drawQuadDirect(ctx, wp2, wp3, wp1, wp0, '#57534e');
      drawQuadDirect(ctx, far.pL, far.pR, wp3, wp2, '#7c583c');
      // Natural sunlit dusty sandstone/ochre rim highlight on opposite mountain crest
      ctx.strokeStyle = '#d99058';
      ctx.lineWidth = Math.max(2, 0.2 * far.cM.scale);
      ctx.beginPath();
      ctx.moveTo(far.pL.x, far.pL.y);
      ctx.lineTo(far.pR.x, far.pR.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  const isRamp = Boolean(fpt.isMountainRamp || npt.isMountainRamp);
  const isNearMid = far.rawZ < 72;
  const nearScale = Math.min(near.cM.scale, 95);
  const farScale = Math.min(far.cM.scale, 95);
  const alt = (fpt.index & 1) === 0;

  // 2. Sculpted Rocky & Earthy Mountain Side Flanks blending seamlessly into terrain mesh
  if (isRamp) {
    drawQuadPtsDirect(ctx, far.pL, near.pL, near.uL, far.uL, '#735036');
    drawQuadPtsDirect(ctx, far.pR, near.pR, near.uR, far.uR, '#573d29');
  } else {
    drawQuadPtsDirect(ctx, far.pL, near.pL, near.uL, far.uL, alt ? '#664e3a' : '#5e4735');
    drawQuadPtsDirect(ctx, far.pR, near.pR, near.uR, far.uR, alt ? '#523e2e' : '#4a3829');
  }

  // 3. Natural Mountain Dirt Surface (NO asphalt!)
  const patchMod = Math.abs(Math.sin(fpt.index * 2.31)) % 1;
  const dirtDeckCol = isRamp
    ? alt
      ? '#946239'
      : '#875731'
    : patchMod > 0.66
    ? '#7e5d40'
    : alt
    ? '#74543a'
    : '#6b4d35';
  drawQuadPtsDirect(ctx, far.pL, far.pR, near.pR, near.pL, dirtDeckCol);

  // Irregular mossy alpine grass & rocky soil encroachment along rugged ridge edges
  const farEdgeWL = 0.065 + 0.075 * (0.5 + 0.5 * Math.sin(fpt.index * 1.43));
  const nearEdgeWL = 0.065 + 0.075 * (0.5 + 0.5 * Math.sin(npt.index * 1.43));
  const farEdgeWR = 0.065 + 0.075 * (0.5 + 0.5 * Math.cos(fpt.index * 1.27));
  const nearEdgeWR = 0.065 + 0.075 * (0.5 + 0.5 * Math.cos(npt.index * 1.27));
  const grassL = alt ? '#4d683b' : '#587143';
  const grassR = alt ? '#415831' : '#4b6239';

  wp0.x = far.pL.x + (far.pR.x - far.pL.x) * farEdgeWL;
  wp0.y = far.pL.y + (far.pR.y - far.pL.y) * farEdgeWL;
  wp1.x = near.pL.x + (near.pR.x - near.pL.x) * nearEdgeWL;
  wp1.y = near.pL.y + (near.pR.y - near.pL.y) * nearEdgeWL;
  drawQuadPtsDirect(ctx, far.pL, wp0, wp1, near.pL, isRamp ? '#7d5b3b' : grassL);

  wp0.x = far.pR.x - (far.pR.x - far.pL.x) * farEdgeWR;
  wp0.y = far.pR.y - (far.pR.y - far.pL.y) * farEdgeWR;
  wp1.x = near.pR.x - (near.pR.x - near.pL.x) * nearEdgeWR;
  wp1.y = near.pR.y - (near.pR.y - near.pL.y) * nearEdgeWR;
  drawQuadPtsDirect(ctx, wp0, far.pR, near.pR, wp1, isRamp ? '#6b4d31' : grassR);

  // Subtle sun-baked lighter dirt center mound & packed twin tire trail ruts
  const rutSwayF = Math.sin(fpt.index * 0.35) * 0.04;
  const rutSwayN = Math.sin(npt.index * 0.35) * 0.04;
  const crownLF = 0.39 + rutSwayF;
  const crownRF = 0.61 + rutSwayF;
  const crownLN = 0.39 + rutSwayN;
  const crownRN = 0.61 + rutSwayN;
  wp0.x = far.pL.x + (far.pR.x - far.pL.x) * crownLF;
  wp0.y = far.pL.y + (far.pR.y - far.pL.y) * crownLF;
  wp1.x = far.pL.x + (far.pR.x - far.pL.x) * crownRF;
  wp1.y = far.pL.y + (far.pR.y - far.pL.y) * crownRF;
  wp2.x = near.pL.x + (near.pR.x - near.pL.x) * crownRN;
  wp2.y = near.pL.y + (near.pR.y - near.pL.y) * crownRN;
  wp3.x = near.pL.x + (near.pR.x - near.pL.x) * crownLN;
  wp3.y = near.pL.y + (near.pR.y - near.pL.y) * crownLN;
  drawQuadPtsDirect(ctx, wp0, wp1, wp2, wp3, isRamp ? '#a16f44' : alt ? '#8a6648' : '#805e41');

  // Natural worn dark-earth tire ruts meandering slightly along the mountain dirt
  if (far.rawZ < 92) {
    ctx.strokeStyle = isRamp ? 'rgba(92, 52, 24, 0.56)' : 'rgba(72, 49, 31, 0.52)';
    ctx.lineWidth = Math.max(1.5, 0.28 * nearScale);
    const lRutF = 0.33 + rutSwayF;
    const lRutN = 0.33 + rutSwayN;
    const rRutF = 0.67 + rutSwayF;
    const rRutN = 0.67 + rutSwayN;
    ctx.beginPath();
    ctx.moveTo(far.pL.x + (far.pR.x - far.pL.x) * lRutF, far.pL.y + (far.pR.y - far.pL.y) * lRutF);
    ctx.lineTo(near.pL.x + (near.pR.x - near.pL.x) * lRutN, near.pL.y + (near.pR.y - near.pL.y) * lRutN);
    ctx.moveTo(far.pL.x + (far.pR.x - far.pL.x) * rRutF, far.pL.y + (far.pR.y - far.pL.y) * rRutF);
    ctx.lineTo(near.pL.x + (near.pR.x - near.pL.x) * rRutN, near.pL.y + (near.pR.y - near.pL.y) * rRutN);
    ctx.stroke();
  }

  // Scattered mountain dirt details: organic rounded dirt clods, stones & mossy earth clumps
  if (isNearMid) {
    const hash = Math.abs(Math.sin(fpt.index * 12.9898) * 43758.5453) % 1;
    const p1u = 0.16 + ((hash * 3.7) % 0.68);
    const p2u = 0.14 + ((hash * 7.3) % 0.72);
    const p1x = far.pL.x + (far.pR.x - far.pL.x) * p1u;
    const p1y = far.pL.y + (far.pR.y - far.pL.y) * p1u;
    const p2x = near.pL.x + (near.pR.x - near.pL.x) * p2u;
    const p2y = near.pL.y + (near.pR.y - near.pL.y) * p2u;
    const clodRx = Math.min(8, Math.max(2, Math.round(0.24 * farScale)));
    const clodRy = Math.min(4, Math.max(1.2, Math.round(0.11 * farScale)));

    ctx.fillStyle = hash > 0.55 ? '#543c29' : '#8c694a';
    ctx.beginPath();
    ctx.ellipse(p1x, p1y, clodRx, clodRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hash > 0.35 ? '#78716c' : '#5e432d';
    ctx.beginPath();
    ctx.ellipse(p2x, p2y, Math.max(1.5, clodRx * 0.78), Math.max(1, clodRy * 0.78), 0, 0, Math.PI * 2);
    ctx.fill();

    // Scattered mossy earth & small shoulder rocks along irregular ridge edge
    if (fpt.index % 2 === 0) {
      const tuftR = Math.min(7, Math.max(2, Math.round(0.22 * farScale)));
      ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.arc(far.pL.x + tuftR * 0.6, far.pL.y, tuftR, 0, Math.PI * 2);
      ctx.arc(far.pR.x - tuftR * 0.6, far.pR.y, tuftR * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. Mountain Peak Jump Crest Indicators (dust chevrons + backcountry expedition flags)
  if (isRamp) {
    const pulse = (Math.floor(nowMs / 140) + fpt.index) % 2 === 0;
    const chevW = Math.max(5, Math.round(1.85 * farScale));
    const chevH = Math.max(3, Math.round(1.05 * farScale));
    ctx.strokeStyle = pulse ? '#fbbf24' : '#f97316';
    ctx.lineWidth = Math.max(2, Math.round(0.22 * farScale));
    ctx.beginPath();
    ctx.moveTo(far.cM.x - chevW, far.cM.y + chevH * 0.4);
    ctx.lineTo(far.cM.x, far.cM.y - chevH * 0.55);
    ctx.lineTo(far.cM.x + chevW, far.cM.y + chevH * 0.4);
    ctx.stroke();

    // Rustic wooden trail stakes & fluttering orange expedition flags at jump entry & takeoff cliff lip
    if (!npt.isMountainRamp || !trackPointHasPrevRamp(fpt)) {
      const flagH = Math.max(6, 2.25 * farScale);
      const flagW = Math.max(4, 1.05 * farScale);
      const wave = Math.sin(nowMs * 0.01 + fpt.index) * (flagW * 0.25);
      for (const sideBase of [far.pL, far.pR]) {
        ctx.strokeStyle = '#5c3a21';
        ctx.lineWidth = Math.max(1.5, 0.16 * farScale);
        ctx.beginPath();
        ctx.moveTo(sideBase.x, sideBase.y);
        ctx.lineTo(sideBase.x, sideBase.y - flagH);
        ctx.stroke();

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(sideBase.x, sideBase.y - flagH);
        ctx.lineTo(sideBase.x + flagW, sideBase.y - flagH + flagH * 0.18 + wave);
        ctx.lineTo(sideBase.x, sideBase.y - flagH + flagH * 0.38);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (fpt.hasJumpChevron && isNearMid) {
    // Opposite mountain landing zone: dusty emerald backcountry trail flags + earth arrow
    const lcW = Math.max(4, Math.round(1.4 * farScale));
    const lcH = Math.max(2.5, Math.round(0.75 * farScale));
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.72)';
    ctx.lineWidth = Math.max(1.8, Math.round(0.18 * farScale));
    ctx.beginPath();
    ctx.moveTo(far.cM.x - lcW, far.cM.y + lcH * 0.45);
    ctx.lineTo(far.cM.x, far.cM.y - lcH * 0.45);
    ctx.lineTo(far.cM.x + lcW, far.cM.y + lcH * 0.45);
    ctx.stroke();

    if (fpt.index % 2 === 0) {
      const stH = Math.max(4, 1.35 * farScale);
      const stW = Math.max(3, 0.75 * farScale);
      for (const sideBase of [far.pL, far.pR]) {
        ctx.strokeStyle = '#5c3a21';
        ctx.lineWidth = Math.max(1.5, 0.14 * farScale);
        ctx.beginPath();
        ctx.moveTo(sideBase.x, sideBase.y);
        ctx.lineTo(sideBase.x, sideBase.y - stH);
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.fillRect(sideBase.x, sideBase.y - stH, stW, Math.max(2, stH * 0.32));
      }
    }
  }

  // 5. Embedded Nitro Wind-Trail Crystal / Dirt Boost Chevron
  if (fpt.hasBoostPad && !fpt.boostTriggered) {
    const padW = Math.max(4, Math.round(1.5 * farScale));
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(Math.round(far.cM.x), Math.round(far.cM.y - padW * 0.65));
    ctx.lineTo(Math.round(far.cM.x + padW), Math.round(far.cM.y + padW * 0.5));
    ctx.lineTo(Math.round(far.cM.x - padW), Math.round(far.cM.y + padW * 0.5));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cffafe';
    ctx.fillRect(Math.round(far.cM.x - 1), Math.round(far.cM.y - padW * 0.25), 2, Math.max(2, Math.round(padW * 0.5)));
  }

  // 6. Rustic Timber Alpine Trailhead Archway (`PEAK N`)
  if (!isRamp && fpt.index > 16 && (fpt.index - 11) % 40 === 14 && far.rawZ > 11 && far.rawZ < 122) {
    const hw = fpt.width * 0.56;
    const archH = 5.1;
    if (
      projectInto(fpt.x - fpt.nx * hw, fpt.y, fpt.z - fpt.nz * hw, wp0, 0.55) &&
      projectInto(fpt.x + fpt.nx * hw, fpt.y, fpt.z + fpt.nz * hw, wp1, 0.55) &&
      projectInto(fpt.x - fpt.nx * hw, fpt.y + archH, fpt.z - fpt.nz * hw, wp2, 0.55) &&
      projectInto(fpt.x + fpt.nx * hw, fpt.y + archH, fpt.z + fpt.nz * hw, wp3, 0.55)
    ) {
      const colW = Math.min(11, Math.max(2.5, Math.round(0.28 * farScale)));
      ctx.strokeStyle = '#5c3a21';
      ctx.lineWidth = colW;
      ctx.beginPath();
      ctx.moveTo(wp0.x, wp0.y);
      ctx.lineTo(wp2.x, wp2.y);
      ctx.moveTo(wp1.x, wp1.y);
      ctx.lineTo(wp3.x, wp3.y);
      ctx.stroke();

      const midX = (wp2.x + wp3.x) * 0.5;
      const midY = (wp2.y + wp3.y) * 0.5;
      const banW = Math.max(16, Math.abs(wp3.x - wp2.x));
      const banH = Math.min(32, Math.max(5, 0.85 * farScale));
      ctx.fillStyle = '#3b2414';
      ctx.fillRect(midX - banW * 0.5, midY - banH * 0.5, banW, banH);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(midX - banW * 0.5, midY - banH * 0.5, banW, Math.max(1.5, banH * 0.22));
      if (banW >= 34) {
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.max(6, Math.round(banH * 0.56))}px "Chakra Petch", monospace`;
        ctx.fillStyle = '#fef3c7';
        ctx.fillText(`PEAK ${fpt.mountainPeakNum ?? 1}`, midX, midY + banH * 0.28);
      }
    }
  }

  ctx.globalAlpha = 1.0;
}

function trackPointHasPrevRamp(pt: SCurvePoint): boolean {
  const c = (pt.index - 11) % 40;
  return c > 29 && c < 33;
}





