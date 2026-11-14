/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ParkingBayStatus,
  ParkingCone,
  ParkingStageSpec,
} from './parking';
import { RoadBiomeConfig } from './rules';
import { Project3DIntoFn, Projected3D } from './world3d';

const q0: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const q1: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const q2: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const q3: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const q4: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const q5: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const q6: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };
const q7: Projected3D = { x: 0, y: 0, z: 0, scale: 0 };

function fillQuad(
  ctx: CanvasRenderingContext2D,
  a: Projected3D,
  b: Projected3D,
  c: Projected3D,
  d: Projected3D,
  fill: string,
  stroke?: string,
  lineWidth = 1
) {
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.lineTo(Math.round(c.x), Math.round(c.y));
  ctx.lineTo(Math.round(d.x), Math.round(d.y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function renderParkingPlazaGround3D(params: {
  ctx: CanvasRenderingContext2D;
  stage: ParkingStageSpec;
  bayStatus: ParkingBayStatus | null;
  biome: RoadBiomeConfig;
  nowMs: number;
  projectInto: Project3DIntoFn;
}) {
  const { ctx, stage, bayStatus, biome, nowMs, projectInto } = params;
  const hw = stage.plazaWidth * 0.5;
  const minZ = stage.endZ - 8;
  const maxZ = stage.startZ + 8;
  const stripLen = 4.0;

  // 1. Concrete apron & multi-tile asphalt strips (far to near)
  for (let z = minZ; z < maxZ; z += stripLen) {
    const zFar = z;
    const zNear = Math.min(maxZ, z + stripLen);
    const tileIdx = Math.round((maxZ - z) / stripLen);

    if (
      projectInto(-hw, 0, zFar, q0, 0.45) &&
      projectInto(hw, 0, zFar, q1, 0.45) &&
      projectInto(hw, 0, zNear, q2, 0.45) &&
      projectInto(-hw, 0, zNear, q3, 0.45)
    ) {
      const asphalt = tileIdx % 2 === 0 ? biome.asphaltEven : biome.asphaltOdd;
      fillQuad(ctx, q0, q1, q2, q3, asphalt);

      // Left & right raised concrete perimeter curbs
      if (
        projectInto(-hw, 0.45, zFar, q4, 0.45) &&
        projectInto(-hw, 0.45, zNear, q5, 0.45)
      ) {
        fillQuad(ctx, q4, q0, q3, q5, tileIdx % 2 === 0 ? '#475569' : '#334155', '#0f172a');
      }
      if (
        projectInto(hw, 0.45, zFar, q6, 0.45) &&
        projectInto(hw, 0.45, zNear, q7, 0.45)
      ) {
        fillQuad(ctx, q1, q6, q7, q2, tileIdx % 2 === 0 ? '#334155' : '#1e293b', '#0f172a');
      }

      // Subtle parking deck expansion line & lane aisle dashes
      if (tileIdx % 2 === 0) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(q0.x), Math.round(q0.y));
        ctx.lineTo(Math.round(q1.x), Math.round(q1.y));
        ctx.stroke();
      }
    }
  }

  // Far back wall curb
  if (
    projectInto(-hw, 0, minZ, q0, 0.45) &&
    projectInto(hw, 0, minZ, q1, 0.45) &&
    projectInto(hw, 0.6, minZ, q2, 0.45) &&
    projectInto(-hw, 0.6, minZ, q3, 0.45)
  ) {
    fillQuad(ctx, q3, q2, q1, q0, '#334155', '#0f172a');
  }

  // Side light poles along plaza edges
  for (let z = maxZ - 6; z >= minZ + 6; z -= 14) {
    for (const side of [-1, 1]) {
      const px = side * (hw - 0.35);
      if (projectInto(px, 0, z, q0) && projectInto(px, 4.2, z, q1)) {
        const bx = Math.round(q0.x);
        const by = Math.round(q0.y);
        const ty = Math.round(q1.y);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1, Math.round(0.14 * q0.scale));
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, ty);
        ctx.stroke();

        const r = Math.max(2, Math.round(0.32 * q1.scale));
        ctx.fillStyle = biome.isNight ? '#22d3ee' : '#fef08a';
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(bx, ty, r * 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - Math.round(r * 0.5), ty - 1, Math.max(2, r), 2);
      }
    }
  }

  // 2. Target Parking Bay Box + Directional Arrow
  const bay = stage.targetBay;
  const fwdX = Math.cos(bay.heading);
  const fwdZ = Math.sin(bay.heading);
  const rgtX = -fwdZ;
  const rgtZ = fwdX;
  const hbW = bay.width * 0.5;
  const hbL = bay.length * 0.5;

  const flx = bay.x + fwdX * hbL - rgtX * hbW;
  const flz = bay.z + fwdZ * hbL - rgtZ * hbW;
  const frx = bay.x + fwdX * hbL + rgtX * hbW;
  const frz = bay.z + fwdZ * hbL + rgtZ * hbW;
  const rrx = bay.x - fwdX * hbL + rgtX * hbW;
  const rrz = bay.z - fwdZ * hbL + rgtZ * hbW;
  const rlx = bay.x - fwdX * hbL - rgtX * hbW;
  const rlz = bay.z - fwdZ * hbL - rgtZ * hbW;

  if (
    projectInto(flx, 0.03, flz, q0, 0.45) &&
    projectInto(frx, 0.03, frz, q1, 0.45) &&
    projectInto(rrx, 0.03, rrz, q2, 0.45) &&
    projectInto(rlx, 0.03, rlz, q3, 0.45)
  ) {
    const isLocked = Boolean(bayStatus?.readyToLock);
    const isInside = Boolean(bayStatus?.isInsideBox);
    const pulse = 0.55 + Math.sin(nowMs * 0.008) * 0.2;

    const borderColor = isLocked
      ? '#10b981'
      : isInside
      ? '#22d3ee'
      : '#f59e0b';
    const fillColor = isLocked
      ? 'rgba(16, 185, 129, 0.28)'
      : isInside
      ? 'rgba(34, 211, 238, 0.22)'
      : `rgba(245, 158, 11, ${(0.12 + pulse * 0.08).toFixed(2)})`;

    fillQuad(ctx, q0, q1, q2, q3, fillColor, borderColor, Math.max(2, Math.round(0.14 * q0.scale)));

    // Front wheel stop bar (painted yellow-black block near front of stall)
    const sbL = hbL - 0.55;
    if (
      projectInto(bay.x + fwdX * sbL - rgtX * (hbW * 0.68), 0.05, bay.z + fwdZ * sbL - rgtZ * (hbW * 0.68), q4, 0.45) &&
      projectInto(bay.x + fwdX * sbL + rgtX * (hbW * 0.68), 0.05, bay.z + fwdZ * sbL + rgtZ * (hbW * 0.68), q5, 0.45)
    ) {
      ctx.strokeStyle = isLocked ? '#34d399' : '#facc15';
      ctx.lineWidth = Math.max(2, Math.round(0.18 * q4.scale));
      ctx.beginPath();
      ctx.moveTo(Math.round(q4.x), Math.round(q4.y));
      ctx.lineTo(Math.round(q5.x), Math.round(q5.y));
      ctx.stroke();
    }

    // Center "P" / Nose Direction Arrow inside bay
    if (
      projectInto(bay.x + fwdX * (hbL * 0.48), 0.05, bay.z + fwdZ * (hbL * 0.48), q4, 0.45) &&
      projectInto(bay.x - fwdX * (hbL * 0.25) - rgtX * (hbW * 0.35), 0.05, bay.z - fwdZ * (hbL * 0.25) - rgtZ * (hbW * 0.35), q5, 0.45) &&
      projectInto(bay.x - fwdX * (hbL * 0.25) + rgtX * (hbW * 0.35), 0.05, bay.z - fwdZ * (hbL * 0.25) + rgtZ * (hbW * 0.35), q6, 0.45)
    ) {
      ctx.fillStyle = isLocked ? 'rgba(52, 211, 153, 0.72)' : 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(Math.round(q4.x), Math.round(q4.y));
      ctx.lineTo(Math.round(q5.x), Math.round(q5.y));
      ctx.lineTo(Math.round(q6.x), Math.round(q6.y));
      ctx.closePath();
      ctx.fill();
    }

    // Floating holographic beacon label above bay center
    const bob = Math.sin(nowMs * 0.005) * 0.16;
    if (projectInto(bay.x, 2.35 + bob, bay.z, q4)) {
      const bx = Math.round(q4.x);
      const by = Math.round(q4.y);
      ctx.textAlign = 'center';
      ctx.font = 'bold 8px "Chakra Petch", monospace';
      ctx.fillStyle = '#090d16';
      ctx.fillText(isLocked ? 'HOLD POSITION' : bay.label, bx + 1, by + 1);
      ctx.fillStyle = borderColor;
      ctx.fillText(isLocked ? 'HOLD POSITION' : bay.label, bx, by);
    }
  }

  // 3. Slalom Gate Arches (Stages 4 & 6)
  for (let i = 0; i < stage.slalomGates.length; i++) {
    const g = stage.slalomGates[i];
    const lx = g.x - g.halfWidth;
    const rx = g.x + g.halfWidth;
    const gateColor = g.passed ? '#10b981' : '#22d3ee';
    if (
      projectInto(lx, 0, g.z, q0) &&
      projectInto(lx, 2.1, g.z, q1) &&
      projectInto(rx, 2.1, g.z, q2) &&
      projectInto(rx, 0, g.z, q3)
    ) {
      ctx.strokeStyle = gateColor;
      ctx.lineWidth = Math.max(2, Math.round(0.12 * q0.scale));
      ctx.beginPath();
      ctx.moveTo(Math.round(q0.x), Math.round(q0.y));
      ctx.lineTo(Math.round(q1.x), Math.round(q1.y));
      ctx.lineTo(Math.round(q2.x), Math.round(q2.y));
      ctx.lineTo(Math.round(q3.x), Math.round(q3.y));
      ctx.stroke();

      const midX = Math.round((q1.x + q2.x) * 0.5);
      const midY = Math.round((q1.y + q2.y) * 0.5 - 5);
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#090d16';
      ctx.fillText(g.passed ? `${g.label} ✓` : g.label, midX + 1, midY + 1);
      ctx.fillStyle = gateColor;
      ctx.fillText(g.passed ? `${g.label} ✓` : g.label, midX, midY);
    }
  }
}

export function renderParkingObstacleProps3D(params: {
  ctx: CanvasRenderingContext2D;
  stage: ParkingStageSpec;
  camWorldX: number;
  camWorldZ: number;
  fwdX: number;
  fwdZ: number;
  projectInto: Project3DIntoFn;
}) {
  const { ctx, stage, camWorldX, camWorldZ, fwdX, fwdZ, projectInto } = params;

  // 1. Concrete Jersey Barriers
  for (let i = 0; i < stage.barriers.length; i++) {
    const b = stage.barriers[i];
    const bFwdX = Math.cos(b.heading);
    const bFwdZ = Math.sin(b.heading);
    const bRgtX = -bFwdZ;
    const bRgtZ = bFwdX;

    // Draw top & visible faces using 8-corner prism
    const h = 0.85;
    const cx0 = b.x + bFwdX * b.halfL - bRgtX * b.halfW;
    const cz0 = b.z + bFwdZ * b.halfL - bRgtZ * b.halfW;
    const cx1 = b.x + bFwdX * b.halfL + bRgtX * b.halfW;
    const cz1 = b.z + bFwdZ * b.halfL + bRgtZ * b.halfW;
    const cx2 = b.x - bFwdX * b.halfL + bRgtX * b.halfW;
    const cz2 = b.z - bFwdZ * b.halfL + bRgtZ * b.halfW;
    const cx3 = b.x - bFwdX * b.halfL - bRgtX * b.halfW;
    const cz3 = b.z - bFwdZ * b.halfL - bRgtZ * b.halfW;

    if (
      projectInto(cx0, 0, cz0, q0, 0.45) &&
      projectInto(cx1, 0, cz1, q1, 0.45) &&
      projectInto(cx2, 0, cz2, q2, 0.45) &&
      projectInto(cx3, 0, cz3, q3, 0.45) &&
      projectInto(cx0, h, cz0, q4, 0.45) &&
      projectInto(cx1, h, cz1, q5, 0.45) &&
      projectInto(cx2, h, cz2, q6, 0.45) &&
      projectInto(cx3, h, cz3, q7, 0.45)
    ) {
      // Side walls
      fillQuad(ctx, q0, q1, q5, q4, '#475569', '#0f172a');
      fillQuad(ctx, q1, q2, q6, q5, '#64748b', '#0f172a');
      fillQuad(ctx, q2, q3, q7, q6, '#94a3b8', '#0f172a');
      fillQuad(ctx, q3, q0, q4, q7, '#64748b', '#0f172a');
      // Top concrete face with hazard stripe
      fillQuad(ctx, q4, q5, q6, q7, '#cbd5e1', '#0f172a');
      // Amber hazard stripe along near rim
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = Math.max(1, Math.round(0.10 * q6.scale));
      ctx.beginPath();
      ctx.moveTo(Math.round(q6.x), Math.round(q6.y));
      ctx.lineTo(Math.round(q7.x), Math.round(q7.y));
      ctx.stroke();
    }
  }

  // 2. Depth-sorted Traffic Cones (simple small array, sorted far-to-near)
  const coneOrder: { cone: ParkingCone; rawZ: number }[] = [];
  for (let i = 0; i < stage.cones.length; i++) {
    const c = stage.cones[i];
    const rz = (c.x - camWorldX) * fwdX + (c.z - camWorldZ) * fwdZ;
    if (rz > 2.4 && rz < 120) {
      coneOrder.push({ cone: c, rawZ: rz });
    }
  }
  coneOrder.sort((a, b) => b.rawZ - a.rawZ);

  for (let i = 0; i < coneOrder.length; i++) {
    const c = coneOrder[i].cone;
    if (!projectInto(c.x, 0.02, c.z, q0)) continue;
    const cx = Math.round(q0.x);
    const cy = Math.round(q0.y);
    const baseW = Math.max(4, Math.round(0.46 * q0.scale));
    const coneH = Math.max(6, Math.round(0.76 * q0.scale));

    if (c.knocked) {
      // Toppled orange cone lying flat
      ctx.fillStyle = '#090d16';
      ctx.fillRect(cx - coneH * 0.5 - 1, cy - baseW * 0.35 - 1, coneH + 2, Math.max(3, baseW * 0.65));
      ctx.fillStyle = '#f97316';
      ctx.fillRect(cx - coneH * 0.5, cy - baseW * 0.35, coneH, Math.max(2, baseW * 0.5));
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx - Math.round(coneH * 0.1), cy - baseW * 0.35, Math.max(2, Math.round(coneH * 0.25)), Math.max(2, baseW * 0.5));
    } else {
      // Upright shaded orange/white traffic cone with crisp outline
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - Math.round(baseW * 0.62), cy - 2, Math.round(baseW * 1.24), 3);

      ctx.beginPath();
      ctx.moveTo(cx - Math.round(baseW * 0.44), cy - 1);
      ctx.lineTo(cx - Math.max(1, Math.round(baseW * 0.14)), cy - coneH);
      ctx.lineTo(cx + Math.max(1, Math.round(baseW * 0.14)), cy - coneH);
      ctx.lineTo(cx + Math.round(baseW * 0.44), cy - 1);
      ctx.closePath();
      ctx.fillStyle = '#f97316';
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1;
      ctx.stroke();

      // White reflective stripe band
      ctx.beginPath();
      ctx.moveTo(cx - Math.round(baseW * 0.30), cy - Math.round(coneH * 0.42));
      ctx.lineTo(cx - Math.round(baseW * 0.21), cy - Math.round(coneH * 0.68));
      ctx.lineTo(cx + Math.round(baseW * 0.21), cy - Math.round(coneH * 0.68));
      ctx.lineTo(cx + Math.round(baseW * 0.30), cy - Math.round(coneH * 0.42));
      ctx.closePath();
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
    }
  }
}
