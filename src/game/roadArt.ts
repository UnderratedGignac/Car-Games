/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Procedural 2D billboard art for the pseudo-3D road: roadside props per biome,
 * coins, gantries, checkpoint arches and parallax mountain / skyline layers.
 * Everything is drawn once into cached offscreen canvases.
 */

import type { RoadBiomeConfig } from './rules';

const cache = new Map<string, HTMLCanvasElement>();

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function cached(key: string, build: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = build();
    cache.set(key, c);
  }
  return c;
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- trees per biome -----------------------------------------------------

function drawPine(ctx: CanvasRenderingContext2D, w: number, h: number, v: number) {
  const tones = [
    ['#14532d', '#166534', '#22a04b'],
    ['#134e3a', '#15803d', '#4ade80'],
    ['#1e3a2b', '#2f5d3a', '#5b8f4e'],
    ['#164e3f', '#0f766e', '#34d399'],
  ][v % 4];
  ctx.fillStyle = '#4a2f1d';
  ctx.fillRect(w / 2 - 3, h - 18, 6, 18);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const ty = h - 14 - i * (h - 20) / tiers;
    const tw = (w * (1 - i * 0.2)) / 2;
    const th = (h - 14) / tiers + 10;
    ctx.fillStyle = tones[0];
    ctx.beginPath();
    ctx.moveTo(w / 2, ty - th);
    ctx.lineTo(w / 2 + tw, ty);
    ctx.lineTo(w / 2 - tw, ty);
    ctx.fill();
    ctx.fillStyle = tones[1];
    ctx.beginPath();
    ctx.moveTo(w / 2, ty - th);
    ctx.lineTo(w / 2 + tw * 0.15, ty);
    ctx.lineTo(w / 2 - tw, ty);
    ctx.fill();
    ctx.fillStyle = tones[2];
    ctx.fillRect(w / 2 - tw * 0.55, ty - 3, tw * 0.4, 2);
  }
  // snow caps
  if (v % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(w / 2, 2);
    ctx.lineTo(w / 2 + 7, 14);
    ctx.lineTo(w / 2 - 7, 14);
    ctx.fill();
  }
}

function drawCactus(ctx: CanvasRenderingContext2D, w: number, h: number, v: number) {
  if (v === 3) {
    // mesa rock spire
    ctx.fillStyle = '#9a3412';
    ctx.fillRect(w * 0.25, h * 0.2, w * 0.5, h * 0.8);
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(w * 0.25, h * 0.2, w * 0.18, h * 0.8);
    ctx.fillStyle = '#7c2d12';
    for (let y = h * 0.3; y < h; y += 10) ctx.fillRect(w * 0.25, y, w * 0.5, 2);
    return;
  }
  const g = ['#166534', '#15803d', '#4d7c0f'][v % 3];
  const hi = '#86efac';
  const cx = w / 2;
  ctx.fillStyle = g;
  ctx.fillRect(cx - 6, h * 0.15, 12, h * 0.85);
  ctx.fillRect(cx - 20, h * 0.4, 8, h * 0.25);
  ctx.fillRect(cx - 20, h * 0.58, 16, 7);
  ctx.fillRect(cx + 12, h * 0.3, 8, h * 0.28);
  ctx.fillRect(cx + 4, h * 0.52, 16, 7);
  ctx.fillStyle = hi;
  ctx.fillRect(cx - 4, h * 0.17, 2, h * 0.8);
  ctx.fillRect(cx - 18, h * 0.42, 2, h * 0.2);
  ctx.fillRect(cx + 14, h * 0.32, 2, h * 0.22);
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(cx - 2, h * 0.12, 4, 4);
}

function drawTower(ctx: CanvasRenderingContext2D, w: number, h: number, v: number) {
  const rnd = seeded(v * 97 + 3);
  const neon = ['#22d3ee', '#f472b6', '#a78bfa', '#facc15'][v % 4];
  const bw = w * 0.78;
  const x0 = (w - bw) / 2;
  const top = h * (0.05 + rnd() * 0.2);
  ctx.fillStyle = '#0b1024';
  ctx.fillRect(x0, top, bw, h - top);
  ctx.fillStyle = '#151c3d';
  ctx.fillRect(x0, top, bw * 0.3, h - top);
  for (let y = top + 6; y < h - 6; y += 7) {
    for (let x = x0 + 4; x < x0 + bw - 6; x += 7) {
      if (rnd() < 0.45) {
        ctx.fillStyle = rnd() < 0.7 ? '#fde68a' : neon;
        ctx.fillRect(x, y, 3, 3);
      }
    }
  }
  ctx.fillStyle = neon;
  ctx.fillRect(x0, top, bw, 2);
  ctx.fillRect(x0 + bw / 2 - 1, top - 10, 2, 10);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x0 + bw / 2 - 2, top - 12, 4, 3);
}

function drawSakura(ctx: CanvasRenderingContext2D, w: number, h: number, v: number) {
  const rnd = seeded(v * 31 + 11);
  ctx.fillStyle = '#5b3a29';
  ctx.fillRect(w / 2 - 4, h * 0.45, 8, h * 0.55);
  ctx.fillRect(w / 2 - 14, h * 0.5, 12, 4);
  ctx.fillRect(w / 2 + 2, h * 0.42, 12, 4);
  const pinks = ['#fbcfe8', '#f9a8d4', '#f472b6', '#fce7f3'];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * w * 0.44;
    const x = w / 2 + Math.cos(a) * r;
    const y = h * 0.32 + Math.sin(a) * r * 0.62;
    ctx.fillStyle = pinks[Math.floor(rnd() * pinks.length)];
    ctx.beginPath();
    ctx.arc(x, y, 4 + rnd() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function getTreeSprite(biome: RoadBiomeConfig, variant: number): HTMLCanvasElement {
  return cached(`tree_${biome.propStyle}_${variant}`, () => {
    const tall = biome.propStyle === 'tower';
    const [c, ctx] = mk(64, tall ? 128 : 96);
    if (biome.propStyle === 'pine') drawPine(ctx, c.width, c.height, variant);
    else if (biome.propStyle === 'cactus') drawCactus(ctx, c.width, c.height, variant);
    else if (biome.propStyle === 'tower') drawTower(ctx, c.width, c.height, variant);
    else drawSakura(ctx, c.width, c.height, variant);
    return c;
  });
}

export function getRockSprite(biome: RoadBiomeConfig): HTMLCanvasElement {
  return cached(`rock_${biome.id}`, () => {
    const [c, ctx] = mk(48, 30);
    ctx.fillStyle = biome.pierDark;
    ctx.beginPath();
    ctx.moveTo(2, 30);
    ctx.lineTo(10, 8);
    ctx.lineTo(24, 2);
    ctx.lineTo(40, 10);
    ctx.lineTo(46, 30);
    ctx.fill();
    ctx.fillStyle = biome.pierLight;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(24, 2);
    ctx.lineTo(22, 30);
    ctx.lineTo(6, 30);
    ctx.fill();
    return c;
  });
}

export function getLampSprite(biome: RoadBiomeConfig): HTMLCanvasElement {
  return cached(`lamp_${biome.id}`, () => {
    const [c, ctx] = mk(24, 96);
    ctx.fillStyle = '#334155';
    ctx.fillRect(11, 8, 3, 88);
    ctx.fillRect(4, 6, 16, 4);
    ctx.fillStyle = biome.lampColor;
    ctx.fillRect(3, 9, 18, 3);
    if (biome.isNight) {
      const g = ctx.createRadialGradient(12, 12, 1, 12, 12, 12);
      g.addColorStop(0, 'rgba(255,240,180,0.9)');
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 24, 24);
    }
    return c;
  });
}

export function getSignSprite(biome: RoadBiomeConfig, pointRight: boolean): HTMLCanvasElement {
  return cached(`sign_${biome.id}_${pointRight ? 1 : 0}`, () => {
    const [c, ctx] = mk(40, 40);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(18, 22, 4, 18);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(2, 4, 36, 20);
    ctx.fillStyle = '#111827';
    for (let i = 0; i < 3; i++) {
      const x = 7 + i * 10;
      ctx.beginPath();
      if (pointRight) {
        ctx.moveTo(x, 7);
        ctx.lineTo(x + 6, 14);
        ctx.lineTo(x, 21);
        ctx.lineTo(x + 3, 21);
        ctx.lineTo(x + 9, 14);
        ctx.lineTo(x + 3, 7);
      } else {
        ctx.moveTo(x + 9, 7);
        ctx.lineTo(x + 3, 14);
        ctx.lineTo(x + 9, 21);
        ctx.lineTo(x + 6, 21);
        ctx.lineTo(x, 14);
        ctx.lineTo(x + 6, 7);
      }
      ctx.fill();
    }
    return c;
  });
}

function drawArch(label: string, accent: string, sub: string, checker: boolean): HTMLCanvasElement {
  const [c, ctx] = mk(256, 96);
  // legs
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(4, 18, 10, 78);
  ctx.fillRect(242, 18, 10, 78);
  ctx.fillStyle = '#475569';
  ctx.fillRect(4, 18, 3, 78);
  ctx.fillRect(242, 18, 3, 78);
  // banner
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 4, 256, 30);
  if (checker) {
    for (let x = 0; x < 256; x += 8) {
      ctx.fillStyle = (x / 8) % 2 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(x, 4, 8, 4);
      ctx.fillStyle = (x / 8) % 2 ? '#0f172a' : '#f8fafc';
      ctx.fillRect(x, 30, 8, 4);
    }
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 4, 256, 3);
    ctx.fillRect(0, 31, 256, 3);
  }
  ctx.fillStyle = accent;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 20);
  if (sub) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(sub, 128, 44);
  }
  return c;
}

export function getGantrySprite(biome: RoadBiomeConfig, variant: number): HTMLCanvasElement {
  return cached(`gantry_${biome.id}_${variant}`, () => {
    const labels = [biome.gantrySign, 'NEON REDLINE', 'KEEP IT FLAT'];
    return drawArch(labels[variant % labels.length], biome.gantryAccent, '', false);
  });
}

export function getCheckpointSprite(): HTMLCanvasElement {
  return cached('checkpoint', () => drawArch('CHECKPOINT', '#facc15', '', true));
}

export function getCoinFrames(): HTMLCanvasElement[] {
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < 8; f++) {
    frames.push(
      cached(`coin_${f}`, () => {
        const [c, ctx] = mk(24, 24);
        const sx = Math.max(0.15, Math.abs(Math.cos((f / 8) * Math.PI)));
        ctx.translate(12, 12);
        ctx.scale(sx, 1);
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(-6, -7, 3, 3);
        return c;
      })
    );
  }
  return frames;
}

export function getStarSprite(): HTMLCanvasElement {
  return cached('star', () => {
    const [c, ctx] = mk(28, 28);
    ctx.translate(14, 14);
    ctx.fillStyle = '#f0abfc';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 5 : 13;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -2, 4, 4);
    return c;
  });
}

/** Wide wrapping silhouette layer (mountains, mesas, skyline or hills) for parallax. */
export function getBackdropLayer(biome: RoadBiomeConfig, layer: 0 | 1, color: string, width: number): HTMLCanvasElement {
  return cached(`bg_${biome.id}_${layer}_${color}_${width}`, () => {
    const h = layer === 0 ? 90 : 60;
    const [c, ctx] = mk(width, h);
    const rnd = seeded(biome.id.length * 131 + layer * 17);
    ctx.fillStyle = color;
    if (biome.propStyle === 'tower') {
      let x = 0;
      while (x < width) {
        const bw = 10 + Math.floor(rnd() * 26);
        const bh = h * (0.25 + rnd() * (layer === 0 ? 0.75 : 0.55));
        ctx.fillStyle = color;
        ctx.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 4; wy < h - 2; wy += 5)
          for (let wx = x + 2; wx < x + bw - 2; wx += 4)
            if (rnd() < 0.18) {
              ctx.fillStyle = rnd() < 0.5 ? 'rgba(253,230,138,0.8)' : 'rgba(34,211,238,0.7)';
              ctx.fillRect(wx, wy, 2, 2);
            }
        x += bw + Math.floor(rnd() * 3);
      }
      return c;
    }
    // periodic noise so the layer wraps seamlessly
    const waves = Array.from({ length: 4 }, (_, i) => ({
      k: (i + 1) * (layer === 0 ? 2 : 3) + Math.floor(rnd() * 2),
      a: (layer === 0 ? 0.32 : 0.22) / (i + 1),
      p: rnd() * Math.PI * 2,
    }));
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= width; x++) {
      let v = 0.5;
      for (const w of waves) v += Math.sin((x / width) * Math.PI * 2 * w.k + w.p) * w.a;
      const y = biome.propStyle === 'cactus' ? Math.round(h - Math.max(0.12, v) * h * 0.95 / 4) * 4 : h - Math.max(0.1, v) * h * 0.95;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, h);
    ctx.fill();
    if (biome.propStyle === 'pine' && layer === 0) {
      // snow line highlights
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(0, 0, width, h * 0.28);
      ctx.globalCompositeOperation = 'source-over';
    }
    return c;
  });
}
