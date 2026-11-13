/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoadBiomeConfig, RoadBiomeId, SCurvePoint, VALLEY_BASE_Y, sampleTerrainElevation } from './rules';

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
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.lineTo(Math.round(c.x), Math.round(c.y));
  ctx.lineTo(Math.round(d.x), Math.round(d.y));
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
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.lineTo(Math.round(c.x), Math.round(c.y));
  ctx.lineTo(Math.round(d.x), Math.round(d.y));
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
}) {
  const { ctx, visibleSlices, visibleCount, biome, nowMs, projectInto } = params;
  const pal = BIOME_TERRAIN_PALETTE[biome.id];
  const shimmerTick = Math.floor(nowMs * 0.008);

  let farRow = terrainRowA;
  let nearRow = terrainRowB;
  let prevNearIndex = -999999;

  for (let i = 0; i < visibleCount - 1; ) {
    const far = visibleSlices[i];
    const step =
      far.rawZ > 64 && i + 3 < visibleCount
        ? 3
        : far.rawZ > 22 && i + 2 < visibleCount
        ? 2
        : 1;
    const near = visibleSlices[i + step];
    i += step;
    if (Math.abs(far.pt.index - near.pt.index) > step + 1) continue;
    if (far.rawZ > 148) continue;

    const fpt = far.pt;
    const npt = near.pt;
    const isEven = Math.floor(fpt.index / step) % 2 === 0;

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

    // 1. Outer 3D hills / canyon ridges / neon mega-decks
    if (fo[0] && fo[1] && no[1] && no[0]) {
      drawQuadDirect(ctx, fp[0], fp[1], np[1], np[0], isEven ? pal.hillLight : pal.hillDark);
    }
    if (fo[6] && fo[7] && no[7] && no[6]) {
      drawQuadDirect(ctx, fp[6], fp[7], np[7], np[6], isEven ? pal.hillDark : pal.hillLight);
    }

    // 2 & 3. Sloped embankment walls + valley floor banks (batched by shared parity color!)
    const canSlopeL = fo[1] && fo[2] && no[2] && no[1];
    const canSlopeR = fo[5] && fo[6] && no[6] && no[5];
    const canBankL = fo[2] && fo[3] && no[3] && no[2];
    const canBankR = fo[4] && fo[5] && no[5] && no[4];

    if (canSlopeL || canBankR) {
      ctx.beginPath();
      if (canSlopeL) addQuadSubpath(ctx, fp[1], fp[2], np[2], np[1]);
      if (canBankR) addQuadSubpath(ctx, fp[4], fp[5], np[5], np[4]);
      ctx.fillStyle = isEven ? pal.bankLight : pal.bankDark;
      ctx.fill();
    }
    if (canSlopeR || canBankL) {
      ctx.beginPath();
      if (canSlopeR) addQuadSubpath(ctx, fp[5], fp[6], np[6], np[5]);
      if (canBankL) addQuadSubpath(ctx, fp[2], fp[3], np[3], np[2]);
      ctx.fillStyle = isEven ? pal.bankDark : pal.bankLight;
      ctx.fill();
    }

    // Ridge highlight lines for nearby embankment crests
    if (far.rawZ < 68 && fpt.index % 3 === 0) {
      const hasL = fo[1] && no[1];
      const hasR = fo[6] && no[6];
      if (hasL || hasR) {
        ctx.strokeStyle = pal.ridgeCap;
        ctx.globalAlpha = biome.id === 'neon' ? 0.35 : 0.25;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (hasL) {
          ctx.moveTo(Math.round(fp[1].x), Math.round(fp[1].y));
          ctx.lineTo(Math.round(np[1].x), Math.round(np[1].y));
        }
        if (hasR) {
          ctx.moveTo(Math.round(fp[6].x), Math.round(fp[6].y));
          ctx.lineTo(Math.round(np[6].x), Math.round(np[6].y));
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }

    // 4. Shimmering central river / neon canal / canyon wash beneath viaduct
    if (fo[3] && fo[4] && no[4] && no[3]) {
      drawQuadDirect(ctx, fp[3], fp[4], np[4], np[3], pal.riverBase);
      if (far.rawZ < 70 && (fpt.index + shimmerTick) % 4 === 0) {
        const rx1 = fp[3].x + (fp[4].x - fp[3].x) * 0.28;
        const ry1 = fp[3].y + (fp[4].y - fp[3].y) * 0.28;
        const rx2 = fp[3].x + (fp[4].x - fp[3].x) * 0.72;
        const ry2 = fp[3].y + (fp[4].y - fp[3].y) * 0.72;
        ctx.strokeStyle = pal.riverGlint;
        ctx.globalAlpha = biome.id === 'canyon' ? 0.25 : 0.55;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(rx1), Math.round(ry1));
        ctx.lineTo(Math.round(rx2), Math.round(ry2));
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }

    // 5. Cast Viaduct Bridge Shadow onto valley basin directly below the road deck!
    if (far.rawZ < 82) {
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
  const bx = Math.round(wpBase.x);
  const by = Math.round(wpBase.y);
  const nearOutline = rawZ < 72;

  // Grounded contact shadow beneath mid/near 3D objects
  if (rawZ < 95) {
    const shW = Math.max(3, Math.round(2.3 * s * sc));
    const shH = Math.max(1, Math.round(shW * 0.35));
    ctx.fillStyle = 'rgba(9, 13, 22, 0.35)';
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
        prop.shade > 0.5 ? '#1e293b' : '#172033',
        nearOutline ? '#090d16' : undefined,
        1
      );

      ctx.strokeStyle = trimCol;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(wp3.x), Math.round(wp3.y));
      ctx.lineTo(Math.round(wp2.x), Math.round(wp2.y));
      ctx.stroke();

      // Lit pixel window grid batched into 2 color passes (near/mid towers only)
      const bW = Math.round(Math.abs(wp1.x - wp0.x));
      const bH = Math.round(Math.abs(wp0.y - wp3.y));
      if (rawZ < 76 && bW >= 7 && bH >= 14) {
        const leftX = Math.round(Math.min(wp0.x, wp1.x));
        const topY = Math.round(wp3.y);
        const maxWX = leftX + bW - 3;
        const maxWY = topY + bH - 3;

        ctx.fillStyle = trimCol;
        for (let wy = topY + 3; wy < maxWY; wy += 4) {
          for (let wx = leftX + 2; wx < maxWX; wx += 3) {
            if ((wx + wy + prop.variant) % 3 !== 0 && (wx + wy) % 2 === 0) {
              ctx.fillRect(wx, wy, 2, 2);
            }
          }
        }
        ctx.fillStyle = '#fef08a';
        for (let wy = topY + 3; wy < maxWY; wy += 4) {
          for (let wx = leftX + 2; wx < maxWX; wx += 3) {
            if ((wx + wy + prop.variant) % 3 !== 0 && (wx + wy) % 2 !== 0) {
              ctx.fillRect(wx, wy, 2, 2);
            }
          }
        }
      }

      if (okSB && okST) {
        const edgeBot = isLeft ? wp1 : wp0;
        const edgeTop = isLeft ? wp2 : wp3;
        drawQuadDirect(ctx, edgeBot, wp4, wp5, edgeTop, '#0f172a', nearOutline ? '#090d16' : undefined, 1);
      }

      if (prop.variant === 0 && rawZ < 92) {
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
        if (rawZ < 85) {
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
      return;
    }

    // 3D Shaded Saguaro Cactus
    const th = Math.max(7, Math.round(5.2 * s * sc));
    const cw = Math.max(2, Math.round(0.75 * s * sc));
    if (nearOutline) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(bx - Math.round(cw * 0.5) - 1, by - th - 1, cw + 2, th + 2);
    }
    ctx.fillStyle = '#15803d';
    ctx.fillRect(bx - Math.round(cw * 0.5), by - th, cw, th);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(bx - Math.round(cw * 0.5), by - th, Math.max(1, Math.floor(cw * 0.45)), th);
    ctx.fillStyle = '#166534';
    ctx.fillRect(bx - Math.round(cw * 1.9), by - Math.round(th * 0.65), Math.round(cw * 1.5), Math.max(1, Math.round(cw * 0.65)));
    ctx.fillRect(bx - Math.round(cw * 1.9), by - Math.round(th * 0.88), Math.max(1, Math.round(cw * 0.7)), Math.round(th * 0.26));
    ctx.fillRect(bx + Math.round(cw * 0.4), by - Math.round(th * 0.52), Math.round(cw * 1.5), Math.max(1, Math.round(cw * 0.65)));
    ctx.fillRect(bx + Math.round(cw * 1.2), by - Math.round(th * 0.78), Math.max(1, Math.round(cw * 0.7)), Math.round(th * 0.26));
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
        if (nearOutline) {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(Math.round(wp0.x - postW * 0.5) - 1, Math.round(wp2.y), postW + 2, Math.round(wp0.y - wp2.y));
          ctx.fillRect(Math.round(wp1.x - postW * 0.5) - 1, Math.round(wp3.y), postW + 2, Math.round(wp1.y - wp3.y));
        }
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(Math.round(wp0.x - postW * 0.5), Math.round(wp2.y), postW, Math.round(wp0.y - wp2.y));
        ctx.fillRect(Math.round(wp1.x - postW * 0.5), Math.round(wp3.y), postW, Math.round(wp1.y - wp3.y));
        ctx.fillStyle = '#090d16';
        ctx.fillRect(Math.round(wp4.x), Math.round(wp4.y - postW * 0.8), Math.round(wp5.x - wp4.x), Math.max(2, Math.round(postW * 0.9)));
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(Math.round(wp4.x + 1), Math.round(wp4.y), Math.round(wp5.x - wp4.x - 2), Math.max(2, Math.round(postW * 0.75)));
      }
      return;
    }

    if (!projectInto(prop.x, groundY + 4.8 * s, prop.z, wp0)) return;
    const th = Math.max(6, Math.round(by - wp0.y));
    const rad = Math.max(3, Math.round(th * 0.44));
    const trunkW = Math.max(2, Math.round(th * 0.16));
    ctx.fillStyle = '#4a3525';
    ctx.fillRect(bx - Math.round(trunkW * 0.5), by - Math.round(th * 0.52), trunkW, Math.round(th * 0.52));

    ctx.fillStyle = '#db2777';
    ctx.beginPath();
    ctx.arc(bx + Math.round(rad * 0.25), by - Math.round(th * 0.68), Math.round(rad * 0.85), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(bx, by - Math.round(th * 0.74), rad, 0, Math.PI * 2);
    ctx.fill();

    if (rawZ < 95) {
      ctx.fillStyle = '#fce7f3';
      ctx.beginPath();
      ctx.arc(bx - Math.round(rad * 0.25), by - Math.round(th * 0.84), Math.max(2, Math.round(rad * 0.58)), 0, Math.PI * 2);
      ctx.fill();
    }
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
      const baseAng = nowMs * 0.003 + prop.z * 0.1;
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
    return;
  }

  // 3D Faceted 3-Tier Alpine Pine Tree (batched into 2 fills + 1 outline stroke!)
  if (!projectInto(prop.x, groundY + 5.4 * s, prop.z, wp0)) return;
  const th = Math.max(7, Math.round(by - wp0.y));
  const tw = Math.max(5, Math.round(th * 0.56));
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

  // Batch 1: Lit left faces across all 3 tiers
  ctx.fillStyle = prop.shade > 0.5 ? '#5b926c' : '#4e805e';
  ctx.beginPath();
  ctx.moveTo(bx, t0Top);
  ctx.lineTo(bx, t0Bot);
  ctx.lineTo(bx - t0HW, t0Bot);
  ctx.closePath();
  ctx.moveTo(bx, t1Top);
  ctx.lineTo(bx, t1Bot);
  ctx.lineTo(bx - t1HW, t1Bot);
  ctx.closePath();
  ctx.moveTo(bx, t2Top);
  ctx.lineTo(bx, t2Bot);
  ctx.lineTo(bx - t2HW, t2Bot);
  ctx.closePath();
  ctx.fill();

  // Batch 2: Shaded right faces across all 3 tiers
  ctx.fillStyle = prop.shade > 0.5 ? '#355c44' : '#2d4f3b';
  ctx.beginPath();
  ctx.moveTo(bx, t0Top);
  ctx.lineTo(bx + t0HW, t0Bot);
  ctx.lineTo(bx, t0Bot);
  ctx.closePath();
  ctx.moveTo(bx, t1Top);
  ctx.lineTo(bx + t1HW, t1Bot);
  ctx.lineTo(bx, t1Bot);
  ctx.closePath();
  ctx.moveTo(bx, t2Top);
  ctx.lineTo(bx + t2HW, t2Bot);
  ctx.lineTo(bx, t2Bot);
  ctx.closePath();
  ctx.fill();

  // Batch 3: Crisp dark contour stroke (near/mid trees only)
  if (rawZ < 68) {
    ctx.strokeStyle = '#14241c';
    ctx.lineWidth = 1;
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
    ctx.stroke();
  }
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
  if (far.pt.index % 4 !== 0 || far.rawZ <= 3 || far.rawZ >= 88) return;

  const postH = Math.max(2, Math.round(0.55 * far.cM.scale));
  const postW = Math.max(1, Math.round(0.14 * far.cM.scale));
  const halfPW = Math.floor(postW * 0.5);
  const reflectorCol = biome.id === 'neon' ? '#22d3ee' : far.pt.curvature !== 0 ? '#facc15' : '#f87171';
  const capH = Math.max(1, Math.floor(postH * 0.4));

  const lx = Math.round(far.gL.x) - halfPW;
  const ly = Math.round(far.gL.y) - postH;
  const rx = Math.round(far.gR.x) - halfPW;
  const ry = Math.round(far.gR.y) - postH;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(lx, ly, postW, postH);
  ctx.fillRect(rx, ry, postW, postH);
  ctx.fillStyle = reflectorCol;
  ctx.fillRect(lx, ly, postW, capH);
  ctx.fillRect(rx, ry, postW, capH);
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
  if (far.pt.index < 18 || far.pt.index % 44 !== 22 || far.rawZ <= 4 || far.rawZ >= 115) return;

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

  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = beamW + 2;
  ctx.beginPath();
  ctx.moveTo(bLx, bLy);
  ctx.lineTo(tLx, tLy);
  ctx.lineTo(tRx, tRy);
  ctx.lineTo(bRx, bRy);
  ctx.stroke();

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
}
