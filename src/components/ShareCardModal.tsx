/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getDriftRank } from '../game/rules';
import { triggerHaptic } from '../game/audio';

export interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  score: number;
  distance: number;
  maxCombo: number;
  overtakes?: number;
  nearMisses?: number;
  carName: string;
  carTier: number;
  carColor: string;
  gameMode: string;
  coinsEarned?: number;
}

const CARD_WIDTH = 800;
const CARD_HEIGHT = 1000;

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  score,
  distance,
  maxCombo,
  overtakes = 0,
  nearMisses = 0,
  carName,
  carTier,
  carColor,
  gameMode,
  coinsEarned,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Procedural Cyberpunk Polaroid Drawing on 800 x 1000 Canvas
  const drawShareCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGenerating(true);

    // Rank evaluation
    const rankInfo = getDriftRank(score);
    const coins =
      coinsEarned !== undefined
        ? coinsEarned
        : Math.max(50, Math.round(score * 0.05 + distance * 0.08));

    // Clear canvas
    ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // 1. Sleek Cyberpunk Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
    bgGrad.addColorStop(0, '#090e1a');
    bgGrad.addColorStop(0.4, '#060a14');
    bgGrad.addColorStop(1, '#03050a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // 2. Subtle Cyberpunk Grid Lines
    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.07)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < CARD_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CARD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CARD_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CARD_WIDTH, y);
      ctx.stroke();
    }

    // Angled Road Perspective Horizon in Bottom Half
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.06)';
    ctx.beginPath();
    for (let i = -6; i <= 6; i++) {
      ctx.moveTo(CARD_WIDTH / 2, 340);
      ctx.lineTo(CARD_WIDTH / 2 + i * 140, CARD_HEIGHT);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Glowing Neon Borders (#06b6d4 / #f59e0b)
    const margin = 24;
    const cornerR = 24;
    ctx.save();
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 25;
    ctx.lineWidth = 3.5;

    const borderGrad = ctx.createLinearGradient(margin, margin, CARD_WIDTH - margin, CARD_HEIGHT - margin);
    borderGrad.addColorStop(0, '#06b6d4');
    borderGrad.addColorStop(0.5, '#3b82f6');
    borderGrad.addColorStop(1, '#f59e0b');
    ctx.strokeStyle = borderGrad;

    // Rounded Border Path
    ctx.beginPath();
    ctx.roundRect(margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, cornerR);
    ctx.stroke();

    // Inner hairline border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(margin + 6, margin + 6, CARD_WIDTH - (margin + 6) * 2, CARD_HEIGHT - (margin + 6) * 2, cornerR - 4);
    ctx.stroke();
    ctx.restore();

    // Corner HUD brackets
    ctx.save();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    const bLen = 22;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(margin + 12, margin + 12 + bLen);
    ctx.lineTo(margin + 12, margin + 12);
    ctx.lineTo(margin + 12 + bLen, margin + 12);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(CARD_WIDTH - margin - 12 - bLen, margin + 12);
    ctx.lineTo(CARD_WIDTH - margin - 12, margin + 12);
    ctx.lineTo(CARD_WIDTH - margin - 12, margin + 12 + bLen);
    ctx.stroke();
    // Bottom-Left
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(margin + 12, CARD_HEIGHT - margin - 12 - bLen);
    ctx.lineTo(margin + 12, CARD_HEIGHT - margin - 12);
    ctx.lineTo(margin + 12 + bLen, CARD_HEIGHT - margin - 12);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(CARD_WIDTH - margin - 12 - bLen, CARD_HEIGHT - margin - 12);
    ctx.lineTo(CARD_WIDTH - margin - 12, CARD_HEIGHT - margin - 12);
    ctx.lineTo(CARD_WIDTH - margin - 12, CARD_HEIGHT - margin - 12 - bLen);
    ctx.stroke();
    ctx.restore();

    // 4. UPPER HEADER: Stylized "NEON REDLINE" Emblem
    ctx.save();
    // Emblem angled trapezoid backdrop
    const embX = 180;
    const embY = 56;
    const embW = 440;
    const embH = 72;
    ctx.beginPath();
    ctx.moveTo(embX + 20, embY);
    ctx.lineTo(embX + embW, embY - 4);
    ctx.lineTo(embX + embW - 22, embY + embH);
    ctx.lineTo(embX, embY + embH);
    ctx.closePath();
    ctx.fillStyle = '#0b1326';
    ctx.fill();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Diagonal accents on the emblem badge
    ctx.beginPath();
    ctx.moveTo(embX + embW - 55, embY - 3);
    ctx.lineTo(embX + embW, embY - 4);
    ctx.lineTo(embX + embW - 22, embY + embH);
    ctx.lineTo(embX + embW - 75, embY + embH);
    ctx.closePath();
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(embX + embW - 85, embY - 2);
    ctx.lineTo(embX + embW - 65, embY - 3);
    ctx.lineTo(embX + embW - 85, embY + embH);
    ctx.lineTo(embX + embW - 105, embY + embH);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // Title Text: NEON REDLINE
    ctx.font = 'italic 700 38px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NEON REDLINE', CARD_WIDTH / 2 - 25, embY + embH / 2);

    // Glowing Subtitle: TOKYO HIGHWAY & TOUGE RACING
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('TOKYO HIGHWAY & TOUGE RACING', CARD_WIDTH / 2, embY + embH + 24);

    // Mode Tag
    const modeLabel =
      gameMode === 'highway_traffic'
        ? 'HIGHWAY TRAFFIC · OVERTAKE CLASH'
        : 'TOKYO TOUGE · S-CURVE DRIFT';
    ctx.shadowBlur = 0;
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(modeLabel, CARD_WIDTH / 2, embY + embH + 42);
    ctx.restore();

    // 5. CENTER FEATURE: Vehicle Showcase Box (Y: 195 to 490)
    const boxX = 64;
    const boxY = 195;
    const boxW = 672;
    const boxH = 295;
    const boxR = 18;

    ctx.save();
    // Showcase box backdrop
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, boxR);
    const boxGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    boxGrad.addColorStop(0, '#0c1527');
    boxGrad.addColorStop(1, '#070b16');
    ctx.fillStyle = boxGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ground Neon Underglow (radial ellipse beneath vehicle)
    const glowCenterX = CARD_WIDTH / 2;
    const glowCenterY = boxY + 185;
    const underglowGrad = ctx.createRadialGradient(
      glowCenterX,
      glowCenterY,
      10,
      glowCenterX,
      glowCenterY,
      210
    );
    underglowGrad.addColorStop(0, carColor || '#06b6d4');
    underglowGrad.addColorStop(0.4, carColor || '#06b6d4');
    underglowGrad.addColorStop(1, 'transparent');

    ctx.save();
    ctx.scale(1, 0.38);
    ctx.beginPath();
    ctx.arc(glowCenterX, glowCenterY / 0.38, 220, 0, Math.PI * 2);
    ctx.fillStyle = underglowGrad;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.restore();

    // Dual Headlight Projection Cones
    ctx.save();
    const lightGrad = ctx.createLinearGradient(glowCenterX - 110, glowCenterY, glowCenterX - 240, glowCenterY + 70);
    lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    lightGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.moveTo(glowCenterX - 110, glowCenterY - 10);
    ctx.lineTo(glowCenterX - 240, glowCenterY + 70);
    ctx.lineTo(glowCenterX - 160, glowCenterY + 75);
    ctx.closePath();
    ctx.fill();

    const lightGradR = ctx.createLinearGradient(glowCenterX + 110, glowCenterY, glowCenterX + 240, glowCenterY + 70);
    lightGradR.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    lightGradR.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = lightGradR;
    ctx.beginPath();
    ctx.moveTo(glowCenterX + 110, glowCenterY - 10);
    ctx.lineTo(glowCenterX + 240, glowCenterY + 70);
    ctx.lineTo(glowCenterX + 160, glowCenterY + 75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Stylized Supercar Silhouette / Badge
    ctx.save();
    const carX = CARD_WIDTH / 2;
    const carY = boxY + 145;

    // Car Body Shadow
    ctx.fillStyle = '#020408';
    ctx.beginPath();
    ctx.ellipse(carX, carY + 38, 175, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // High-performance racing car chassis path
    ctx.beginPath();
    ctx.moveTo(carX - 160, carY + 28); // Rear bumper bottom
    ctx.lineTo(carX - 165, carY + 12); // Rear bumper corner
    ctx.lineTo(carX - 145, carY - 2);  // Rear quarter
    ctx.lineTo(carX - 140, carY - 28); // Spoiler upright rear
    ctx.lineTo(carX - 155, carY - 32); // Spoiler wing
    ctx.lineTo(carX - 100, carY - 32); // Spoiler front
    ctx.lineTo(carX - 105, carY - 10); // Rear deck
    ctx.lineTo(carX - 55, carY - 26);  // Rear windshield
    ctx.lineTo(carX + 15, carY - 28);  // Roof line
    ctx.lineTo(carX + 75, carY - 8);   // Front windshield
    ctx.lineTo(carX + 140, carY + 6);  // Hood / nose
    ctx.lineTo(carX + 165, carY + 18); // Front splitter top
    ctx.lineTo(carX + 162, carY + 30); // Front splitter bottom
    ctx.lineTo(carX + 125, carY + 32); // Front tire well right
    ctx.arc(carX + 95, carY + 28, 22, 0, Math.PI, true); // Front tire well arch
    ctx.lineTo(carX - 65, carY + 32);  // Side skirt
    ctx.arc(carX - 95, carY + 28, 22, 0, Math.PI, true); // Rear tire well arch
    ctx.lineTo(carX - 160, carY + 28); // Back to rear bottom
    ctx.closePath();

    // Primary Body Fill
    const bodyGrad = ctx.createLinearGradient(carX - 160, carY - 30, carX + 160, carY + 30);
    bodyGrad.addColorStop(0, carColor || '#06b6d4');
    bodyGrad.addColorStop(0.5, '#ffffff');
    bodyGrad.addColorStop(0.7, carColor || '#06b6d4');
    bodyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cockpit / Tinted Windshield Glass
    ctx.beginPath();
    ctx.moveTo(carX - 45, carY - 22);
    ctx.lineTo(carX + 10, carY - 24);
    ctx.lineTo(carX + 65, carY - 7);
    ctx.lineTo(carX - 15, carY - 7);
    ctx.closePath();
    ctx.fillStyle = '#050a14';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wheels (Deep dish with alloy spokes)
    const drawWheel = (wx: number, wy: number) => {
      ctx.save();
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(wx, wy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rim rim
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(wx, wy, 12, 0, Math.PI * 2);
      ctx.fill();

      // Brake Caliper
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(wx + 4, wy - 3, 5, 0, Math.PI * 2);
      ctx.fill();

      // Center Hub
      ctx.fillStyle = '#090e1a';
      ctx.beginPath();
      ctx.arc(wx, wy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawWheel(carX - 95, carY + 28);
    drawWheel(carX + 95, carY + 28);

    // Glowing LED Headlight & Taillight
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(carX + 152, carY + 16, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(carX - 162, carY + 14, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Drift Rank Badge (Pill Badge at Top of Showcase Box)
    ctx.save();
    const rankBadgeW = 260;
    const rankBadgeH = 34;
    const rankBadgeX = CARD_WIDTH / 2 - rankBadgeW / 2;
    const rankBadgeY = boxY + 16;
    ctx.beginPath();
    ctx.roundRect(rankBadgeX, rankBadgeY, rankBadgeW, rankBadgeH, 17);
    ctx.fillStyle = 'rgba(5, 8, 17, 0.92)';
    ctx.fill();
    ctx.strokeStyle = rankInfo.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = rankInfo.color;
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rankInfo.color;
    ctx.fillText(
      `RANK ${rankInfo.rank} · ${rankInfo.title}`,
      CARD_WIDTH / 2,
      rankBadgeY + rankBadgeH / 2 + 1
    );
    ctx.restore();

    // Car Name & Tier Banner (Pill Badge at Bottom of Showcase Box)
    ctx.save();
    const carBannerW = 340;
    const carBannerH = 36;
    const carBannerX = CARD_WIDTH / 2 - carBannerW / 2;
    const carBannerY = boxY + boxH - 48;
    ctx.beginPath();
    ctx.roundRect(carBannerX, carBannerY, carBannerW, carBannerH, 18);
    ctx.fillStyle = 'rgba(7, 11, 22, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 16px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `TIER ${carTier} · ${carName.toUpperCase()}`,
      CARD_WIDTH / 2,
      carBannerY + carBannerH / 2
    );
    ctx.restore();
    ctx.restore();

    // 6. STATS GRID: 4 Sleek Tiles (2x2 Grid)
    const gridLeft = 64;
    const gridTop = 508;
    const tileW = 326;
    const tileH = 126;
    const tileGap = 20;
    const tileR = 14;

    const drawStatTile = (
      col: number,
      row: number,
      title: string,
      mainValue: string,
      subValue: string,
      accentColor: string
    ) => {
      const tx = gridLeft + col * (tileW + tileGap);
      const ty = gridTop + row * (tileH + tileGap);

      ctx.save();
      // Tile background
      ctx.beginPath();
      ctx.roundRect(tx, ty, tileW, tileH, tileR);
      ctx.fillStyle = '#080d1a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Top-left small accent square
      ctx.fillStyle = accentColor;
      ctx.fillRect(tx + 16, ty + 18, 6, 6);

      // Label Header
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(title, tx + 30, ty + 15);

      // Main Big Value
      ctx.font = '700 32px "Chakra Petch", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(mainValue, tx + 18, ty + 64);

      // Subtitle / Note
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = accentColor;
      ctx.fillText(subValue, tx + 18, ty + tileH - 14);
      ctx.restore();
    };

    // Tile 1: Final Drift Score
    drawStatTile(
      0,
      0,
      'TOTAL SCORE',
      `${Math.round(score).toLocaleString()} PTS`,
      `VERIFIED CHRONO RUN`,
      '#fbbf24'
    );

    // Tile 2: Distance or Overtakes
    if (gameMode === 'highway_traffic') {
      drawStatTile(
        1,
        0,
        'OVERTAKES',
        `${overtakes} PASSES`,
        `${nearMisses} NEAR MISS CLASH`,
        '#06b6d4'
      );
    } else {
      drawStatTile(
        1,
        0,
        'DISTANCE',
        `${Math.round(distance).toLocaleString()}m`,
        `TOKYO TOUGE SECTOR`,
        '#06b6d4'
      );
    }

    // Tile 3: Max Combo
    drawStatTile(
      0,
      1,
      'MAX COMBO',
      `x${maxCombo} MAX COMBO`,
      maxCombo >= 10 ? 'FEVER BURST IGNITION' : 'CHAIN DRIFT FLOW',
      '#f43f5e'
    );

    // Tile 4: Coins Earned
    drawStatTile(
      1,
      1,
      'CREDITS BOUNTY',
      `+${Math.round(coins).toLocaleString()} CR`,
      'BANKED TO ACCOUNT',
      '#10b981'
    );

    // 7. FOOTER: Challenge Callout, Scanlines & Cyberpunk Barcode
    const footerY = 800;

    // Challenge Banner Text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 700 24px "Chakra Petch", sans-serif';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🏎️ CHALLENGE MY RECORD! neon-redline.app', CARD_WIDTH / 2, footerY + 28);
    ctx.restore();

    // Procedural Cyberpunk Barcode
    ctx.save();
    const barcodeY = footerY + 68;
    const barcodeH = 34;
    const barcodeW = 340;
    const barcodeX = CARD_WIDTH / 2 - barcodeW / 2;

    // Seeded-look procedural bars
    let currX = barcodeX;
    const barPattern = [
      3, 1, 4, 2, 1, 6, 2, 4, 1, 2, 5, 2, 1, 4, 3, 1, 2, 6, 1, 3, 4, 2, 1, 5, 2, 1, 4, 2, 6, 1, 3,
      2, 4, 1, 5, 2, 1, 4, 2, 3, 1, 6, 2, 4,
    ];

    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < barPattern.length && currX < barcodeX + barcodeW; i++) {
      const w = barPattern[i];
      if (i % 2 === 0) {
        ctx.fillRect(currX, barcodeY, w, barcodeH);
      }
      currX += w + 2;
    }

    // Barcode Text Identifier
    const runHash = Math.abs(score * 31 + distance * 17 + 9421)
      .toString(16)
      .toUpperCase();
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`NR-VERIFIED-${runHash}-TOKYO-PROD`, CARD_WIDTH / 2, barcodeY + barcodeH + 5);

    // Decorative Scanline Overlay Across Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    for (let sy = 0; sy < CARD_HEIGHT; sy += 4) {
      ctx.fillRect(margin, sy, CARD_WIDTH - margin * 2, 1.5);
    }
    ctx.restore();

    // Export data URL for image preview
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setCardDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to export canvas to dataURL:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [score, distance, maxCombo, overtakes, nearMisses, carName, carTier, carColor, gameMode, coinsEarned]);

  // Re-draw when modal opens or stats change
  useEffect(() => {
    if (isOpen) {
      // Give DOM time to mount canvas
      const timer = window.setTimeout(() => {
        drawShareCard();
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, drawShareCard]);

  // 1. Web Share API Handler
  const handleShareToFriends = useCallback(async () => {
    const canvas = canvasRef.current;
    const rankInfo = getDriftRank(score);
    const bragText = `🏎️ I just scored ${Math.round(score).toLocaleString()} PTS (RANK ${rankInfo.rank} · ${rankInfo.title}) in Neon Redline with my ${carName}! Can you beat my record?`;
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://neon-redline.app';

    if (canvas && typeof navigator !== 'undefined' && navigator.share) {
      try {
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `neon-redline-${Math.round(score)}.png`, {
              type: 'image/png',
            });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: 'Neon Redline Drift Record',
                  text: bragText,
                  url: shareUrl,
                });
                showToast('Shared successfully!');
                triggerHaptic('light');
                return;
              } catch (err) {
                // User may have aborted share dialog; fallback to text share if not abort
                if ((err as Error).name === 'AbortError') return;
              }
            }
          }

          // Fallback to text + URL Web Share
          try {
            await navigator.share({
              title: 'Neon Redline Drift Record',
              text: bragText,
              url: shareUrl,
            });
            showToast('Shared successfully!');
            triggerHaptic('light');
          } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              // Copy to clipboard fallback
              if (navigator.clipboard) {
                await navigator.clipboard.writeText(`${bragText}\n🎮 Play now: ${shareUrl}`);
                showToast('Score brag copied to clipboard!');
                triggerHaptic('light');
              }
            }
          }
        }, 'image/png');
        return;
      } catch (err) {
        console.warn('Web Share failed', err);
      }
    }

    // Desktop browser fallback
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${bragText}\n🎮 Play now: ${shareUrl}`);
        showToast('Brag link & score copied to clipboard!');
        triggerHaptic('light');
      } catch {
        showToast('Failed to copy to clipboard.');
      }
    }
  }, [score, carName, showToast]);

  // 2. Download Card Handler
  const handleDownloadCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const fileName = `neon-redline-${Math.round(score)}.png`;
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          showToast('Polaroid Card Downloaded!');
          triggerHaptic('medium');
        }, 'image/png');
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Polaroid Card Downloaded!');
        triggerHaptic('medium');
      }
    } catch (err) {
      console.error('Failed to trigger card download:', err);
      showToast('Download error.');
    }
  }, [score, showToast]);

  // 3. Copy Score Handler
  const handleCopyScore = useCallback(async () => {
    const rankInfo = getDriftRank(score);
    const formatted = [
      '🏁 NEON REDLINE RUN RECORD 🏁',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      `🚗 Car: ${carName} (Tier ${carTier})`,
      `🏆 Rank: RANK ${rankInfo.rank} · ${rankInfo.title}`,
      `🔥 Score: ${Math.round(score).toLocaleString()} PTS`,
      `⚡ Max Combo: x${maxCombo}`,
      gameMode === 'highway_traffic'
        ? `🛣️ Overtakes: ${overtakes} Passes (${nearMisses} Near Misses)`
        : `🛣️ Touge Distance: ${Math.round(distance).toLocaleString()}m`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🎮 Can you beat my record? Play free:',
      typeof window !== 'undefined' ? window.location.origin : 'https://neon-redline.app',
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(formatted);
        showToast('Copied to clipboard!');
        triggerHaptic('light');
      } catch {
        showToast('Clipboard permission denied.');
      }
    } else {
      showToast('Clipboard unsupported.');
    }
  }, [score, carName, carTier, maxCombo, distance, overtakes, nearMisses, gameMode, showToast]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="High-Score Polaroid Share Card"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-slate-950/95 border border-cyan-500/50 shadow-[0_0_60px_rgba(6,182,212,0.25)] overflow-hidden flex flex-col items-center p-4 sm:p-5 max-h-[95vh] text-slate-100"
        style={{ backgroundColor: 'rgba(9, 14, 26, 0.97)' }}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-12 bg-cyan-500/20 blur-3xl pointer-events-none" />

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold font-mono text-xs shadow-xl flex items-center gap-2 animate-bounce">
            <span>✨</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-white tracking-wide">
                HIGH-SCORE POLAROID
              </h2>
              <p className="text-[10px] font-mono text-cyan-400">
                SHARE RECORD · CHALLENGE RIVALS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-sm"
            aria-label="Close Share Modal"
          >
            ✕
          </button>
        </div>

        {/* Hidden High-Res 800x1000 Canvas */}
        <canvas
          ref={canvasRef}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          className="hidden"
          aria-hidden="true"
        />

        {/* Polaroid Card Preview */}
        <div className="relative w-full flex items-center justify-center my-1 select-none overflow-hidden max-h-[58vh]">
          {cardDataUrl ? (
            <img
              src={cardDataUrl}
              alt="High-Score Polaroid Card"
              className="max-h-[56vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-cyan-500/40"
            />
          ) : (
            <div className="w-full aspect-[4/5] max-h-[56vh] flex flex-col items-center justify-center bg-slate-900/60 rounded-xl border border-slate-800 animate-pulse">
              <span className="text-3xl mb-2">🏎️</span>
              <span className="text-xs font-mono text-cyan-400">
                {isGenerating ? 'Rendering High-Res Card...' : 'Initializing Preview...'}
              </span>
            </div>
          )}
        </div>

        {/* Interactive Action Buttons */}
        <div className="w-full space-y-2 mt-3 pt-2 border-t border-slate-800/80">
          {/* Primary Share Action */}
          <button
            type="button"
            onClick={handleShareToFriends}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-display font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
          >
            <span>📸</span>
            <span>Share to Friends</span>
          </button>

          {/* Secondary Actions: Download & Copy */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadCard}
              className="min-h-[42px] py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>💾</span>
              <span>Download Card</span>
            </button>
            <button
              type="button"
              onClick={handleCopyScore}
              className="min-h-[42px] py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>📋</span>
              <span>Copy Score</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
