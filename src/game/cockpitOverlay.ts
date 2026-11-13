/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CarCustomization, CarSpec, resolveCarAppearance } from './rules';

export interface CockpitRenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  speedKmh: number;
  rpmRatio: number; // 0 to 1
  gear: number; // 1 to 6
  feverRatio: number; // 0 to 1
  isFever: boolean;
  steerAngle: number; // -1 (full left) to +1 (full right)
  visualDriftAngle: number; // -1 to +1
  pedalMode: 'coast' | 'gas' | 'brake';
  isHighBeam: boolean;
  car: CarSpec;
  customization?: Partial<CarCustomization>;
  shakeX: number;
  shakeY: number;
}

/**
 * High-performance 60FPS realistic First-Person cockpit overlay.
 * Renders true-perspective sculpted hood with custom paint/scoops,
 * curved windshield A-pillars, digital LCD racing cluster,
 * rear-view mirror, and a dynamic counter-steering racing wheel.
 */
export function renderRealisticCockpit(params: CockpitRenderParams): void {
  const {
    ctx,
    width,
    height,
    speedKmh,
    rpmRatio,
    gear,
    feverRatio,
    isFever,
    steerAngle,
    visualDriftAngle,
    pedalMode,
    isHighBeam,
    car,
    customization,
    shakeX,
    shakeY,
  } = params;

  ctx.save();

  // Dynamic G-force & physics head motion
  // Gas = slight nose lift (-pitch); Brake = forward dive (+pitch); Drift = lateral lean
  const pitchOffset =
    pedalMode === 'gas' || isFever
      ? -height * 0.018
      : pedalMode === 'brake'
      ? height * 0.024
      : 0;

  const rollAngle = -visualDriftAngle * 0.045 - steerAngle * 0.02;
  const lateralGOffset = -visualDriftAngle * (width * 0.035);

  const centerX = width * 0.5 + lateralGOffset + shakeX * 0.6;
  const centerY = height * 0.5 + pitchOffset + shakeY * 0.6;

  // Resolve paint & hood modifications
  const appearance = resolveCarAppearance(car, customization);
  const bodyHex = appearance.primaryColor;
  const hoodStyle = customization?.hood || 'stock';

  // -------------------------------------------------------------
  // 1. CAR HOOD (True Perspective Bonnett projecting out to road)
  // -------------------------------------------------------------
  const hoodTopY = height * 0.56 + pitchOffset * 0.5;
  const hoodBottomY = height * 0.78;
  const hoodTopHalfW = width * 0.17;
  const hoodBottomHalfW = width * 0.44;

  ctx.save();
  // Hood Base Trapezius
  ctx.beginPath();
  ctx.moveTo(centerX - hoodTopHalfW, hoodTopY);
  ctx.lineTo(centerX + hoodTopHalfW, hoodTopY);
  ctx.lineTo(centerX + hoodBottomHalfW, hoodBottomY);
  ctx.lineTo(centerX - hoodBottomHalfW, hoodBottomY);
  ctx.closePath();

  // Metallic hood gradient with sunlight reflection
  const hoodGrad = ctx.createLinearGradient(0, hoodTopY, 0, hoodBottomY);
  hoodGrad.addColorStop(0, adjustBrightness(bodyHex, -25));
  hoodGrad.addColorStop(0.35, bodyHex);
  hoodGrad.addColorStop(0.55, adjustBrightness(bodyHex, 28)); // metallic specular highlight
  hoodGrad.addColorStop(1, adjustBrightness(bodyHex, -35)); // bottom ambient shadow
  ctx.fillStyle = hoodGrad;
  ctx.fill();

  // Hood Center Sculpt Ridge / Power Bulge
  const ridgeTopHalfW = hoodTopHalfW * 0.38;
  const ridgeBottomHalfW = hoodBottomHalfW * 0.36;
  ctx.beginPath();
  ctx.moveTo(centerX - ridgeTopHalfW, hoodTopY + 2);
  ctx.lineTo(centerX + ridgeTopHalfW, hoodTopY + 2);
  ctx.lineTo(centerX + ridgeBottomHalfW, hoodBottomY);
  ctx.lineTo(centerX - ridgeBottomHalfW, hoodBottomY);
  ctx.closePath();

  const ridgeGrad = ctx.createLinearGradient(0, hoodTopY, 0, hoodBottomY);
  ridgeGrad.addColorStop(0, adjustBrightness(bodyHex, 35));
  ridgeGrad.addColorStop(0.6, adjustBrightness(bodyHex, 15));
  ridgeGrad.addColorStop(1, adjustBrightness(bodyHex, -20));
  ctx.fillStyle = ridgeGrad;
  ctx.fill();

  // Subtle Left/Right fender creases
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX - hoodTopHalfW * 0.92, hoodTopY);
  ctx.lineTo(centerX - hoodBottomHalfW * 0.88, hoodBottomY);
  ctx.moveTo(centerX + hoodTopHalfW * 0.92, hoodTopY);
  ctx.lineTo(centerX + hoodBottomHalfW * 0.88, hoodBottomY);
  ctx.stroke();

  // Carbon Weave Overlay (if carbon panel equipped)
  if (hoodStyle === 'carbon') {
    ctx.fillStyle = 'rgba(12, 16, 24, 0.72)';
    ctx.fillRect(
      centerX - hoodBottomHalfW,
      hoodTopY,
      hoodBottomHalfW * 2,
      hoodBottomY - hoodTopY
    );
    // Subtle cross-hatch carbon lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let lx = centerX - hoodBottomHalfW; lx < centerX + hoodBottomHalfW; lx += 8) {
      ctx.beginPath();
      ctx.moveTo(lx, hoodTopY);
      ctx.lineTo(lx + 20, hoodBottomY);
      ctx.stroke();
    }
  }

  // Chrome Blower Scoop (if supercharger equipped)
  if (hoodStyle === 'blower') {
    const blowerW = width * 0.14;
    const blowerH = height * 0.08;
    const blowerY = hoodTopY + (hoodBottomY - hoodTopY) * 0.35;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(centerX - blowerW * 0.5, blowerY, blowerW, blowerH);

    // Chrome intake snout
    const chromeGrad = ctx.createLinearGradient(
      centerX - blowerW * 0.5,
      0,
      centerX + blowerW * 0.5,
      0
    );
    chromeGrad.addColorStop(0, '#64748b');
    chromeGrad.addColorStop(0.3, '#f8fafc');
    chromeGrad.addColorStop(0.6, '#94a3b8');
    chromeGrad.addColorStop(1, '#475569');
    ctx.fillStyle = chromeGrad;
    ctx.beginPath();
    ctx.roundRect(
      centerX - blowerW * 0.52,
      blowerY - blowerH * 0.3,
      blowerW * 1.04,
      blowerH * 0.6,
      4
    );
    ctx.fill();

    // Red butterfly valves
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(centerX - blowerW * 0.38, blowerY - blowerH * 0.15, blowerW * 0.32, 4);
    ctx.fillRect(centerX + blowerW * 0.06, blowerY - blowerH * 0.15, blowerW * 0.32, 4);
  } else if (hoodStyle === 'vented') {
    // Vented Louver Slots
    ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
    const louverY = hoodTopY + (hoodBottomY - hoodTopY) * 0.32;
    for (let i = 0; i < 4; i++) {
      const stepY = louverY + i * (height * 0.016);
      const slotW = width * (0.05 + i * 0.006);
      ctx.fillRect(centerX - slotW - 8, stepY, slotW, 2.5);
      ctx.fillRect(centerX + 8, stepY, slotW, 2.5);
    }
  } else if (hoodStyle === 'twin_scoop') {
    // Dual NACA Duct Indents
    const nacaY = hoodTopY + (hoodBottomY - hoodTopY) * 0.38;
    const nacaW = width * 0.045;
    const nacaL = height * 0.05;
    ctx.fillStyle = 'rgba(5, 8, 17, 0.9)';
    ctx.beginPath();
    ctx.moveTo(centerX - 18, nacaY);
    ctx.lineTo(centerX - 18 - nacaW, nacaY + nacaL);
    ctx.lineTo(centerX - 18, nacaY + nacaL);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX + 18, nacaY);
    ctx.lineTo(centerX + 18 + nacaW, nacaY + nacaL);
    ctx.lineTo(centerX + 18, nacaY + nacaL);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // -------------------------------------------------------------
  // 2. WINDSHIELD PILLARS (A-Pillars), VISOR & REAR-VIEW MIRROR
  // -------------------------------------------------------------
  // Left A-Pillar
  ctx.fillStyle = '#060913';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.14, 0);
  ctx.lineTo(width * 0.04, height * 0.72);
  ctx.lineTo(0, height * 0.72);
  ctx.closePath();
  ctx.fill();

  // Left A-Pillar highlight bevel
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.14, 0);
  ctx.lineTo(width * 0.04, height * 0.72);
  ctx.stroke();

  // Right A-Pillar
  ctx.fillStyle = '#060913';
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width * 0.86, 0);
  ctx.lineTo(width * 0.96, height * 0.72);
  ctx.lineTo(width, height * 0.72);
  ctx.closePath();
  ctx.fill();

  // Right A-Pillar highlight bevel
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.moveTo(width * 0.86, 0);
  ctx.lineTo(width * 0.96, height * 0.72);
  ctx.stroke();

  // Top Sun Visor Tint Strip
  const visorGrad = ctx.createLinearGradient(0, 0, 0, height * 0.12);
  visorGrad.addColorStop(0, 'rgba(5, 8, 18, 0.88)');
  visorGrad.addColorStop(0.7, 'rgba(5, 8, 18, 0.45)');
  visorGrad.addColorStop(1, 'rgba(5, 8, 18, 0.0)');
  ctx.fillStyle = visorGrad;
  ctx.fillRect(0, 0, width, height * 0.14);

  // Rear-View Mirror (Top Center)
  const mirrorW = Math.max(90, Math.min(160, width * 0.32));
  const mirrorH = Math.max(26, Math.min(42, mirrorW * 0.28));
  const mirrorX = width * 0.5 - mirrorW * 0.5;
  const mirrorY = height * 0.028;

  // Mirror Stem
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(width * 0.5 - 4, 0, 8, mirrorY + 4);

  // Mirror Outer Housing
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(mirrorX, mirrorY, mirrorW, mirrorH, 6);
  ctx.fill();
  ctx.stroke();

  // Mirror Glass with Rear Horizon Reflection
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mirrorX + 2, mirrorY + 2, mirrorW - 4, mirrorH - 4, 4);
  ctx.clip();
  // Sky in mirror
  const mirSkyGrad = ctx.createLinearGradient(0, mirrorY, 0, mirrorY + mirrorH);
  mirSkyGrad.addColorStop(0, '#0f172a');
  mirSkyGrad.addColorStop(0.55, '#1e293b');
  mirSkyGrad.addColorStop(0.65, '#06b6d4'); // twilight skyline
  mirSkyGrad.addColorStop(0.7, '#020617'); // road
  mirSkyGrad.addColorStop(1, '#020617');
  ctx.fillStyle = mirSkyGrad;
  ctx.fillRect(mirrorX, mirrorY, mirrorW, mirrorH);

  // Road vanishing line in mirror
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(mirrorX + mirrorW * 0.5, mirrorY + mirrorH * 0.68);
  ctx.lineTo(mirrorX + mirrorW * 0.42, mirrorY + mirrorH);
  ctx.moveTo(mirrorX + mirrorW * 0.5, mirrorY + mirrorH * 0.68);
  ctx.lineTo(mirrorX + mirrorW * 0.58, mirrorY + mirrorH);
  ctx.stroke();

  // Subtle glass reflection sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.moveTo(mirrorX + mirrorW * 0.1, mirrorY);
  ctx.lineTo(mirrorX + mirrorW * 0.45, mirrorY);
  ctx.lineTo(mirrorX + mirrorW * 0.35, mirrorY + mirrorH);
  ctx.lineTo(mirrorX, mirrorY + mirrorH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // -------------------------------------------------------------
  // 3. CARBON FIBER DASHBOARD COWL (Bottom Half of Cockpit)
  // -------------------------------------------------------------
  const dashTopY = height * 0.72 + pitchOffset * 0.35;
  ctx.fillStyle = '#070a12';
  ctx.beginPath();
  ctx.moveTo(0, dashTopY + height * 0.04);
  // Cowl hump over instrument cluster (left of center for driver side)
  const clusterCenterX = width * 0.38 + lateralGOffset * 0.5;
  const clusterW = width * 0.32;
  ctx.lineTo(clusterCenterX - clusterW * 0.65, dashTopY + height * 0.03);
  ctx.quadraticCurveTo(
    clusterCenterX,
    dashTopY - height * 0.045,
    clusterCenterX + clusterW * 0.65,
    dashTopY + height * 0.03
  );
  ctx.lineTo(width, dashTopY + height * 0.04);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Dashboard Leather / Carbon Bevel Line
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ambient Dash Glow
  const dashGlow = ctx.createLinearGradient(0, dashTopY, 0, height);
  dashGlow.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
  dashGlow.addColorStop(0.35, 'transparent');
  ctx.fillStyle = dashGlow;
  ctx.fill();

  // -------------------------------------------------------------
  // 4. DIGITAL MOTORSPORT LCD GAUGE CLUSTER
  // -------------------------------------------------------------
  const clusterX = clusterCenterX - clusterW * 0.5;
  const clusterY = dashTopY - height * 0.022;
  const clusterH = height * 0.145;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(clusterX, clusterY, clusterW, clusterH, 8);
  ctx.fillStyle = '#030712';
  ctx.fill();
  ctx.strokeStyle = isFever ? '#06b6d4' : '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // A. LED Shift Light Tachometer Bar across top of cluster
  const ledCount = 10;
  const ledW = Math.max(3, (clusterW - 24) / ledCount - 3);
  const ledH = 4;
  const activeLeds = Math.min(ledCount, Math.floor(rpmRatio * ledCount * 1.05));

  for (let i = 0; i < ledCount; i++) {
    const lx = clusterX + 12 + i * (ledW + 3);
    const ly = clusterY + 8;
    const isLit = i < activeLeds;
    // First 4 green, next 3 yellow, top 3 red
    const ledColor =
      i < 4 ? '#10b981' : i < 7 ? '#f59e0b' : '#ef4444';

    ctx.fillStyle = isLit ? ledColor : '#1e293b';
    if (isLit) {
      ctx.shadowColor = ledColor;
      ctx.shadowBlur = 6;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillRect(lx, ly, ledW, ledH);
  }
  ctx.shadowBlur = 0;

  // B. Large Digital Speedometer (KM/H)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(16, Math.round(clusterH * 0.38))}px 'Chakra Petch', monospace`;
  ctx.fillStyle = isFever ? '#38bdf8' : '#f8fafc';
  ctx.fillText(`${Math.round(speedKmh)}`, clusterX + clusterW * 0.48, clusterY + clusterH * 0.44);

  ctx.font = `bold ${Math.max(8, Math.round(clusterH * 0.12))}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('KM/H', clusterX + clusterW * 0.48, clusterY + clusterH * 0.68);

  // C. Gear Indicator (Right side of cluster)
  const gearX = clusterX + clusterW * 0.84;
  ctx.font = `bold ${Math.max(14, Math.round(clusterH * 0.34))}px 'Chakra Petch', monospace`;
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(`${gear}`, gearX, clusterY + clusterH * 0.44);
  ctx.font = `bold ${Math.max(7, Math.round(clusterH * 0.11))}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#64748b';
  ctx.fillText('GEAR', gearX, clusterY + clusterH * 0.68);

  // D. Nitro / Fever Bar (Bottom of cluster)
  const nitroBarW = clusterW - 24;
  const nitroBarY = clusterY + clusterH - 12;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(clusterX + 12, nitroBarY, nitroBarW, 3.5);
  ctx.fillStyle = isFever ? '#38bdf8' : '#06b6d4';
  if (isFever) {
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;
  }
  ctx.fillRect(clusterX + 12, nitroBarY, nitroBarW * Math.min(1, feverRatio), 3.5);
  ctx.shadowBlur = 0;

  // E. High-Beam Indicator Lamp (Blue headlight symbol when active)
  if (isHighBeam) {
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(clusterX + 18, clusterY + clusterH * 0.44, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();

  // -------------------------------------------------------------
  // 5. INTERACTIVE 3-SPOKE RACING STEERING WHEEL
  // -------------------------------------------------------------
  // Positioned directly in front of driver's cluster
  const wheelCenterX = clusterCenterX;
  const wheelCenterY = height * 0.94 + pitchOffset * 0.2;
  const wheelRadius = Math.max(90, Math.min(170, width * 0.36));

  ctx.save();
  ctx.translate(wheelCenterX, wheelCenterY);
  // Wheel rotates with player steering input + drift angle
  const totalWheelRot = steerAngle * 0.95 + visualDriftAngle * 0.42;
  ctx.rotate(totalWheelRot);

  // Wheel Outer Rim (Thick Alcantara / Leather)
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#0b0f19';
  ctx.lineWidth = Math.max(14, wheelRadius * 0.15);
  ctx.stroke();

  // Red Center Top Alignment Stripe (12 o'clock marker)
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius, -Math.PI * 0.5 - 0.08, -Math.PI * 0.5 + 0.08);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = Math.max(14, wheelRadius * 0.15);
  ctx.stroke();

  // Inner Wheel Rim Bevel
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius - Math.max(7, wheelRadius * 0.075), 0, Math.PI * 2);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3 Brushed Metal / Carbon Spokes (Left, Right, Bottom)
  const spokeW = Math.max(12, wheelRadius * 0.14);
  ctx.fillStyle = '#1e293b';

  // Left Spoke
  ctx.beginPath();
  ctx.moveTo(0, -spokeW * 0.4);
  ctx.lineTo(-wheelRadius + 10, -spokeW * 0.6);
  ctx.lineTo(-wheelRadius + 10, spokeW * 0.6);
  ctx.lineTo(0, spokeW * 0.4);
  ctx.closePath();
  ctx.fill();

  // Right Spoke
  ctx.beginPath();
  ctx.moveTo(0, -spokeW * 0.4);
  ctx.lineTo(wheelRadius - 10, -spokeW * 0.6);
  ctx.lineTo(wheelRadius - 10, spokeW * 0.6);
  ctx.lineTo(0, spokeW * 0.4);
  ctx.closePath();
  ctx.fill();

  // Bottom Center Spoke
  ctx.beginPath();
  ctx.moveTo(-spokeW * 0.4, 0);
  ctx.lineTo(-spokeW * 0.6, wheelRadius - 10);
  ctx.lineTo(spokeW * 0.6, wheelRadius - 10);
  ctx.lineTo(spokeW * 0.4, 0);
  ctx.closePath();
  ctx.fill();

  // Center Horn Boss / Emblem
  const hubRadius = Math.max(22, wheelRadius * 0.26);
  ctx.beginPath();
  ctx.arc(0, 0, hubRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#090d16';
  ctx.fill();
  ctx.strokeStyle = isFever ? '#06b6d4' : '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center Motorsport Emblem
  ctx.fillStyle = isFever ? '#38bdf8' : '#ffffff';
  ctx.font = `bold ${Math.round(hubRadius * 0.6)}px 'Chakra Petch', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', 0, -1);

  ctx.restore();

  // -------------------------------------------------------------
  // 6. SPEED WARP & WINDSHIELD OPTICAL FLARE AT HIGH SPEED
  // -------------------------------------------------------------
  if (speedKmh > 165 || isFever) {
    const warpIntensity = Math.min(1, (speedKmh - 165) / 75 + (isFever ? 0.35 : 0));
    ctx.strokeStyle = isFever ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.2;
    // 6 wind speed streaks across windshield
    for (let s = 0; s < 6; s++) {
      const angle = (s * Math.PI) / 3 + ((Date.now() * 0.003) % Math.PI);
      const distStart = width * 0.15;
      const distEnd = distStart + width * 0.28 * warpIntensity;
      const sx = centerX + Math.cos(angle) * distStart;
      const sy = centerY + Math.sin(angle) * distStart * 0.7;
      const ex = centerX + Math.cos(angle) * distEnd;
      const ey = centerY + Math.sin(angle) * distEnd * 0.7;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Utility to adjust hex color brightness
 */
function adjustBrightness(hex: string, percent: number): string {
  let num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(2.55 * percent);
  let b = (num & 0x0000ff) + Math.round(2.55 * percent);
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
