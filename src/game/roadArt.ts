/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Procedural 2D billboard art for the pseudo-3D road: roadside props per biome,
 * coins, gantries, checkpoint arches and parallax mountain / skyline layers,
 * plus reusable atmosphere sprites (glows, shadows, noise, smoke, petals).
 * Everything is drawn once into cached offscreen canvases at 2x detail so the
 * high-resolution renderer can scale it crisply.
 */

import type { RoadBiomeConfig } from './rules';

const cache = new Map<string, HTMLCanvasElement>();

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
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

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amt: number): string {
  const [r, g, b] = hexRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Soft elliptical ground shadow baked once (contact shadow for cars). */
export function getShadowSprite(): HTMLCanvasElement {
  return cached('shadow_soft', () => {
    const [c, ctx] = mk(128, 64);
    const g = ctx.createRadialGradient(64, 32, 4, 64, 32, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.scale(1, 0.5);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.restore();
    return c;
  });
}

/** Radial glow sprite (lamps, tail lights, coins, sun halo). Color must be hex. */
export function getGlowSprite(color: string, size = 64): HTMLCanvasElement {
  return cached(`glow_${color}_${size}`, () => {
    const [c, ctx] = mk(size, size);
    const [r, g, b] = hexRgb(color);
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.38)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  });
}

/** Grayscale speckle tile used as scrolling ground / asphalt texture. */
export function getNoiseTile(seed = 7, size = 128): HTMLCanvasElement {
  return cached(`noise_${seed}_${size}`, () => {
    const [c, ctx] = mk(size, size);
    const img = ctx.createImageData(size, size);
    const r = seeded(seed);
    for (let i = 0; i < size * size; i++) {
      const v = Math.floor(r() * 255);
      const a = r() < 0.5 ? Math.floor(r() * 34) : Math.floor(r() * 22);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}

/** Soft smoke puff for tyre drift / off-road dust. */
export function getSmokeSprite(tint: 'white' | 'cyan' | 'dust'): HTMLCanvasElement {
  return cached(`smoke_${tint}`, () => {
    const [c, ctx] = mk(64, 64);
    const col = tint === 'cyan' ? '180,235,250' : tint === 'dust' ? '190,160,120' : '235,238,245';
    const r = seeded(tint.length * 977 + 13);
    for (let i = 0; i < 5; i++) {
      const x = 24 + r() * 16;
      const y = 24 + r() * 16;
      const rad = 12 + r() * 14;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${col},0.32)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    return c;
  });
}

/** Tiny sakura petal (ambient particle). */
export function getPetalSprite(): HTMLCanvasElement {
  return cached('petal', () => {
    const [c, ctx] = mk(14, 12);
    const g = ctx.createLinearGradient(0, 0, 14, 12);
    g.addColorStop(0, '#ffd7e8');
    g.addColorStop(1, '#f9a8d4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.bezierCurveTo(13, 2, 14, 8, 7, 12);
    ctx.bezierCurveTo(0, 8, 1, 2, 7, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(5, 4, 2.4, 1.4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    return c;
  });
}

/** Headlight cone: bright at the bottom (near car), fading toward the top. */
export function getHeadlightCone(): HTMLCanvasElement {
  return cached('headlight_cone', () => {
    const [c, ctx] = mk(256, 256);
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, 'rgba(255,244,214,0.5)');
    g.addColorStop(0.45, 'rgba(255,240,200,0.16)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(104, 0);
    ctx.lineTo(152, 0);
    ctx.lineTo(252, 256);
    ctx.lineTo(4, 256);
    ctx.closePath();
    ctx.fill();
    return c;
  });
}

// --- trees / props per biome ------------------------------------------------

function drawPine(ctx: CanvasRenderingContext2D, w: number, h: number, biome: RoadBiomeConfig, v: number) {
  const snowy = biome.id === 'alpine';
  const foliage = biome.id === 'canyon' ? '#4d7c3a' : snowy ? '#2f5d46' : '#316b46';
  const dark = shade(foliage, -34);
  const light = shade(foliage, 30);
  const cx = w / 2;
  const trunkW = w * 0.1;
  const tg = ctx.createLinearGradient(cx - trunkW, 0, cx + trunkW, 0);
  tg.addColorStop(0, '#3f2d1e');
  tg.addColorStop(0.5, '#6b4c33');
  tg.addColorStop(1, '#33241a');
  ctx.fillStyle = tg;
  ctx.fillRect(cx - trunkW / 2, h * 0.62, trunkW, h * 0.36);
  const tiers = v === 1 ? 5 : 4;
  const topY = h * (v === 1 ? 0.04 : 0.08);
  const baseY = h * 0.72;
  const maxHalf = w * (v === 1 ? 0.3 : 0.44);
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers;
    const t1 = Math.min(1, (i + 1.35) / tiers);
    const y0 = topY + (baseY - topY) * t0;
    const y1 = topY + (baseY - topY) * t1;
    const half = maxHalf * (0.28 + 0.72 * t1);
    const g = ctx.createLinearGradient(cx - half, y0, cx + half, y1);
    g.addColorStop(0, light);
    g.addColorStop(0.5, foliage);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, y0);
    ctx.lineTo(cx + half, y1);
    ctx.lineTo(cx + half * 0.55, y1 - h * 0.015);
    ctx.lineTo(cx - half * 0.55, y1 - h * 0.015);
    ctx.lineTo(cx - half, y1);
    ctx.closePath();
    ctx.fill();
    if (snowy) {
      ctx.fillStyle = 'rgba(240,248,255,0.92)';
      ctx.beginPath();
      ctx.moveTo(cx, y0);
      ctx.lineTo(cx + half * 0.62, y0 + (y1 - y0) * 0.42);
      ctx.lineTo(cx + half * 0.2, y0 + (y1 - y0) * 0.34);
      ctx.lineTo(cx - half * 0.28, y0 + (y1 - y0) * 0.44);
      ctx.lineTo(cx - half * 0.6, y0 + (y1 - y0) * 0.36);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (snowy) {
    ctx.fillStyle = 'rgba(240,248,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.97, w * 0.34, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCactus(ctx: CanvasRenderingContext2D, w: number, h: number, v: number) {
  const green = '#3f8f4f';
  const dark = '#28603a';
  const light = '#63b56f';
  const cx = w / 2;
  const bodyW = w * (v === 1 ? 0.2 : 0.24);
  const g = ctx.createLinearGradient(cx - bodyW, 0, cx + bodyW, 0);
  g.addColorStop(0, dark);
  g.addColorStop(0.42, light);
  g.addColorStop(0.62, green);
  g.addColorStop(1, dark);
  const roundRect = (x: number, y: number, rw: number, rh: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, r);
    ctx.arcTo(x + rw, y + rh, x, y + rh, r);
    ctx.arcTo(x, y + rh, x, y, r);
    ctx.arcTo(x, y, x + rw, y, r);
    ctx.closePath();
  };
  ctx.fillStyle = g;
  roundRect(cx - bodyW / 2, h * 0.1, bodyW, h * 0.86, bodyW / 2);
  ctx.fill();
  if (v === 0) {
    for (const side of [-1, 1]) {
      const ax = cx + side * w * 0.26;
      ctx.fillStyle = g;
      roundRect(ax - bodyW * 0.36, h * (side < 0 ? 0.3 : 0.42), bodyW * 0.72, h * 0.34, bodyW * 0.36);
      ctx.fill();
      ctx.fillRect(Math.min(cx, ax) - bodyW * 0.1, h * (side < 0 ? 0.52 : 0.62), Math.abs(ax - cx) + bodyW * 0.2, bodyW * 0.62);
    }
  } else {
    for (const side of [-1, 1]) {
      ctx.fillStyle = g;
      roundRect(cx + side * w * 0.24 - bodyW * 0.4, h * 0.55, bodyW * 0.8, h * 0.41, bodyW * 0.4);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(20,50,28,0.4)';
  ctx.lineWidth = Math.max(1, w * 0.015);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * bodyW * 0.26, h * 0.14);
    ctx.lineTo(cx + i * bodyW * 0.26, h * 0.93);
    ctx.stroke();
  }
  ctx.fillStyle = '#fda4af';
  ctx.beginPath();
  ctx.arc(cx, h * 0.09, w * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function drawMesa(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = seeded(seed);
  const base = '#9a5b3c';
  const topY = h * (0.18 + r() * 0.14);
  const g = ctx.createLinearGradient(0, topY, 0, h);
  g.addColorStop(0, shade(base, 34));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shade(base, -42));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h);
  ctx.lineTo(w * (0.16 + r() * 0.08), topY + h * 0.1);
  ctx.lineTo(w * 0.24, topY);
  ctx.lineTo(w * 0.72, topY);
  ctx.lineTo(w * (0.82 + r() * 0.06), topY + h * 0.12);
  ctx.lineTo(w * 0.96, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = Math.max(1, h * 0.02);
  for (let i = 1; i <= 4; i++) {
    const y = topY + (h - topY) * (i / 5) + r() * 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, y);
    ctx.lineTo(w * 0.9, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,220,170,0.4)';
  ctx.lineWidth = Math.max(1.5, h * 0.025);
  ctx.beginPath();
  ctx.moveTo(w * 0.24, topY);
  ctx.lineTo(w * 0.72, topY);
  ctx.stroke();
}

function drawTower(ctx: CanvasRenderingContext2D, w: number, h: number, biome: RoadBiomeConfig, v: number) {
  const r = seeded(v * 1013 + biome.id.length * 7919);
  const bodyW = w * (v === 1 ? 0.6 : v === 2 ? 0.34 : 0.74);
  const bodyH = h * (v === 1 ? 0.72 : v === 2 ? 0.9 : 0.86);
  const x0 = (w - bodyW) / 2;
  const y0 = h - bodyH;
  const g = ctx.createLinearGradient(x0, 0, x0 + bodyW, 0);
  g.addColorStop(0, '#131a30');
  g.addColorStop(0.45, '#232c4e');
  g.addColorStop(1, '#0c1122');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, bodyW, bodyH);
  ctx.fillStyle = '#0a0f1e';
  ctx.fillRect(x0 - bodyW * 0.04, y0, bodyW * 1.08, h * 0.025);
  const cols = Math.max(2, Math.floor(bodyW / (w * 0.1)));
  const rows = Math.max(4, Math.floor(bodyH / (h * 0.055)));
  const winW = (bodyW * 0.72) / cols;
  const winH = (bodyH * 0.72) / rows;
  const accents = [biome.gantryAccent, biome.lampColor, biome.lampColor, '#e2e8f0'];
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (r() < 0.44) continue;
      ctx.fillStyle = accents[Math.floor(r() * accents.length)];
      ctx.globalAlpha = 0.5 + r() * 0.5;
      ctx.fillRect(x0 + bodyW * 0.14 + cx * ((bodyW * 0.72) / cols), y0 + bodyH * 0.06 + cy * ((bodyH * 0.86) / rows), winW * 0.62, winH * 0.5);
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = biome.gantryAccent;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x0, y0, Math.max(1.5, w * 0.015), bodyH);
  ctx.fillStyle = biome.lampColor;
  ctx.fillRect(x0 + bodyW - Math.max(1.5, w * 0.015), y0, Math.max(1.5, w * 0.015), bodyH);
  ctx.globalAlpha = 1;
  if (v !== 2) {
    const sx = x0 + bodyW * 0.62;
    const sy = y0 + bodyH * 0.12;
    const sw = bodyW * 0.26;
    const sh = bodyH * 0.34;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = biome.lampColor;
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.65 + r() * 0.35;
      ctx.fillRect(sx + sw * 0.24, sy + sh * (0.1 + i * 0.22), sw * 0.52, sh * 0.1);
    }
    ctx.globalAlpha = 1;
  }
  if (v !== 1) {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.5, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(w / 2, y0);
    ctx.lineTo(w / 2, y0 - h * 0.08);
    ctx.stroke();
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(w / 2, y0 - h * 0.08, w * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSakura(ctx: CanvasRenderingContext2D, w: number, h: number, v: number) {
  const r = seeded(v * 331 + 7);
  const cx = w / 2;
  ctx.strokeStyle = '#4a3226';
  ctx.lineWidth = w * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.98);
  ctx.quadraticCurveTo(cx - w * 0.05, h * 0.6, cx - w * 0.12, h * 0.42);
  ctx.moveTo(cx, h * 0.72);
  ctx.quadraticCurveTo(cx + w * 0.12, h * 0.58, cx + w * 0.2, h * 0.44);
  ctx.stroke();
  const crownY = h * 0.34;
  const crownR = w * (v === 2 ? 0.26 : 0.36);
  const blobs = v === 2 ? 5 : 8;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2;
    const bx = cx + Math.cos(a) * crownR * 0.62 + (r() - 0.5) * w * 0.08;
    const by = crownY + Math.sin(a) * crownR * 0.42 + (r() - 0.5) * h * 0.05;
    const br = crownR * (0.42 + r() * 0.3);
    const g = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.1, bx, by, br);
    g.addColorStop(0, '#ffe4ef');
    g.addColorStop(0.55, '#fbcfe8');
    g.addColorStop(1, '#ec8fb8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(190,80,130,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, crownY + crownR * 0.45, crownR * 0.8, crownR * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(251,207,232,0.8)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + (r() - 0.5) * w * 0.7, h * (0.94 + r() * 0.04), w * 0.025, w * 0.014, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function getTreeSprite(biome: RoadBiomeConfig, variant: number): HTMLCanvasElement {
  const v = ((variant % 4) + 4) % 4;
  return cached(`tree2_${biome.id}_${v}`, () => {
    const style = biome.propStyle;
    if (style === 'tower') {
      const [c, ctx] = mk(144, 352);
      drawTower(ctx, 144, 352, biome, v);
      return c;
    }
    if (style === 'sakura') {
      const [c, ctx] = mk(176, 192);
      drawSakura(ctx, 176, 192, v);
      return c;
    }
    if (style === 'cactus') {
      if (v === 2) {
        const [c, ctx] = mk(128, 128);
        drawMesa(ctx, 128, 128, 99);
        return c;
      }
      const [c, ctx] = mk(112, 176);
      drawCactus(ctx, 112, 176, v === 3 ? 1 : 0);
      return c;
    }
    const [c, ctx] = mk(128, 192);
    drawPine(ctx, 128, 192, biome, v);
    return c;
  });
}

export function getRockSprite(biome: RoadBiomeConfig): HTMLCanvasElement {
  return cached(`rock2_${biome.id}`, () => {
    const [c, ctx] = mk(128, 80);
    const snowy = biome.id === 'alpine';
    const base = biome.propStyle === 'cactus' ? '#8a5a3c' : '#5b6472';
    const g = ctx.createLinearGradient(0, 8, 0, 80);
    g.addColorStop(0, shade(base, 40));
    g.addColorStop(0.6, base);
    g.addColorStop(1, shade(base, -36));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(6, 78);
    ctx.lineTo(18, 34);
    ctx.lineTo(44, 12);
    ctx.lineTo(82, 16);
    ctx.lineTo(112, 42);
    ctx.lineTo(122, 78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(44, 14);
    ctx.lineTo(56, 76);
    ctx.moveTo(82, 18);
    ctx.lineTo(74, 76);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(20, 36);
    ctx.lineTo(44, 13);
    ctx.lineTo(80, 17);
    ctx.stroke();
    if (snowy) {
      ctx.fillStyle = 'rgba(240,248,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(18, 34);
      ctx.lineTo(44, 12);
      ctx.lineTo(82, 16);
      ctx.lineTo(96, 28);
      ctx.lineTo(64, 26);
      ctx.lineTo(40, 30);
      ctx.closePath();
      ctx.fill();
    }
    return c;
  });
}

export function getLampSprite(biome: RoadBiomeConfig): HTMLCanvasElement {
  return cached(`lamp2_${biome.id}`, () => {
    const [c, ctx] = mk(64, 224);
    const cx = 26;
    const halo = ctx.createRadialGradient(cx + 14, 26, 2, cx + 14, 26, 26);
    halo.addColorStop(0, 'rgba(255,232,170,0.5)');
    halo.addColorStop(1, 'rgba(255,232,170,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 64, 64);
    const pg = ctx.createLinearGradient(cx - 4, 0, cx + 4, 0);
    pg.addColorStop(0, '#1f2937');
    pg.addColorStop(0.5, '#64748b');
    pg.addColorStop(1, '#111827');
    ctx.fillStyle = pg;
    ctx.fillRect(cx - 3, 26, 6, 192);
    ctx.fillRect(cx - 7, 214, 14, 8);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, 30);
    ctx.quadraticCurveTo(cx + 14, 22, cx + 16, 26);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx + 8, 22, 18, 7);
    ctx.fillStyle = biome.lampColor;
    ctx.fillRect(cx + 10, 28, 14, 4);
    return c;
  });
}

export function getSignSprite(biome: RoadBiomeConfig, pointRight: boolean): HTMLCanvasElement {
  return cached(`sign2_${biome.id}_${pointRight ? 1 : 0}`, () => {
    const [c, ctx] = mk(96, 96);
    ctx.fillStyle = '#334155';
    ctx.fillRect(44, 56, 8, 40);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(8, 8, 80, 52);
    const g = ctx.createLinearGradient(8, 8, 88, 60);
    g.addColorStop(0, biome.isNight ? '#1e1b4b' : '#1d4ed8');
    g.addColorStop(1, biome.isNight ? '#312e81' : '#2563eb');
    ctx.fillStyle = g;
    ctx.fillRect(11, 11, 74, 46);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(11, 11, 74, 46);
    ctx.fillStyle = biome.isNight ? biome.gantryAccent : '#fbbf24';
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 20;
      ctx.beginPath();
      if (pointRight) {
        ctx.moveTo(x, 20);
        ctx.lineTo(x + 12, 34);
        ctx.lineTo(x, 48);
        ctx.lineTo(x + 5, 34);
      } else {
        ctx.moveTo(x + 12, 20);
        ctx.lineTo(x, 34);
        ctx.lineTo(x + 12, 48);
        ctx.lineTo(x + 7, 34);
      }
      ctx.closePath();
      ctx.fill();
    }
    return c;
  });
}

function drawArch(label: string, accent: string, sub: string, checker: boolean): HTMLCanvasElement {
  const [c, ctx] = mk(512, 160);
  const legW = 20;
  const beamH = 48;
  const beamY = 16;
  const lg = ctx.createLinearGradient(0, beamY, 0, 160);
  lg.addColorStop(0, '#475569');
  lg.addColorStop(1, '#1e293b');
  ctx.fillStyle = lg;
  ctx.fillRect(10, beamY, legW, 160 - beamY);
  ctx.fillRect(482, beamY, legW, 160 - beamY);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(10, beamY, 5, 160 - beamY);
  ctx.fillRect(482, beamY, 5, 160 - beamY);
  const bg = ctx.createLinearGradient(0, beamY, 0, beamY + beamH);
  bg.addColorStop(0, '#334155');
  bg.addColorStop(0.5, '#1e293b');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, beamY, 512, beamH);
  if (checker) {
    for (let x = 0; x < 512; x += 16) {
      ctx.fillStyle = (x / 16) % 2 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(x, beamY, 16, 7);
      ctx.fillStyle = (x / 16) % 2 ? '#0f172a' : '#f8fafc';
      ctx.fillRect(x, beamY + beamH - 7, 16, 7);
    }
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(0, beamY, 512, 4);
    ctx.fillRect(0, beamY + beamH - 4, 512, 4);
  }
  ctx.fillStyle = checker ? '#f8fafc' : accent;
  ctx.font = '900 30px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, beamY + beamH / 2 + 1);
  if (sub) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(sub, 256, beamY + beamH + 20);
  }
  return c;
}

export function getGantrySprite(biome: RoadBiomeConfig, variant: number): HTMLCanvasElement {
  return cached(`gantry2_${biome.id}_${variant}`, () => {
    const labels = [biome.gantrySign, 'NEON REDLINE', 'KEEP IT FLAT'];
    return drawArch(labels[variant % labels.length], biome.gantryAccent, '', false);
  });
}

export function getCheckpointSprite(): HTMLCanvasElement {
  return cached('checkpoint2', () => drawArch('CHECKPOINT', '#facc15', '', true));
}

export function getCoinFrames(): HTMLCanvasElement[] {
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < 8; f++) {
    frames.push(
      cached(`coin2_${f}`, () => {
        const [c, ctx] = mk(32, 32);
        const wScale = Math.max(0.16, Math.abs(Math.cos((f / 8) * Math.PI)));
        const cx = 16;
        const g = ctx.createRadialGradient(cx, 16, 2, cx, 16, 15);
        g.addColorStop(0, 'rgba(253,224,71,0.5)');
        g.addColorStop(1, 'rgba(253,224,71,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 32, 32);
        const rw = 11 * wScale;
        const cg = ctx.createLinearGradient(cx - rw, 5, cx + rw, 27);
        cg.addColorStop(0, '#fef9c3');
        cg.addColorStop(0.5, '#fbbf24');
        cg.addColorStop(1, '#b45309');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(cx, 16, rw, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (wScale > 0.45) {
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.beginPath();
          ctx.ellipse(cx - rw * 0.3, 11, rw * 0.28, 3, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(146,64,14,0.55)';
          ctx.fillRect(cx - rw * 0.14, 9, rw * 0.28, 14);
        }
        return c;
      })
    );
  }
  return frames;
}

export function getStarSprite(): HTMLCanvasElement {
  return cached('star2', () => {
    const [c, ctx] = mk(40, 40);
    const g = ctx.createRadialGradient(20, 20, 2, 20, 20, 19);
    g.addColorStop(0, 'rgba(240,171,252,0.6)');
    g.addColorStop(1, 'rgba(240,171,252,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, 40);
    ctx.fillStyle = '#f0abfc';
    ctx.strokeStyle = '#a21caf';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 12 : 5.5;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = 20 + Math.cos(a) * r;
      const y = 20 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(17, 16, 2.2, 0, Math.PI * 2);
    ctx.fill();
    return c;
  });
}

/**
 * Wide wrapping parallax silhouette layer. `layer` 0 = far, 1 = mid, 2 = near.
 * `color` is the already haze-mixed base colour; biome identity is baked in
 * (snowy peaks, canyon mesas, lit city windows, sakura hills + torii).
 */
export function getBackdropLayer(biome: RoadBiomeConfig, layer: 0 | 1 | 2, color: string, width: number): HTMLCanvasElement {
  const h = layer === 0 ? 200 : layer === 1 ? 170 : 140;
  return cached(`bg3_${biome.id}_${layer}_${color}_${width}_${h}`, () => {
    const [c, ctx] = mk(width, h);
    const r = seeded(biome.id.length * 1000 + layer * 97 + 5);
    const base = h;
    const style = biome.propStyle;
    const light = shade(color, 26);
    const dark = shade(color, -24);

    if (style === 'tower') {
      let x = 0;
      while (x < width) {
        const bw = 26 + r() * (layer === 2 ? 60 : 46);
        const bh = h * (0.25 + r() * (layer === 0 ? 0.45 : 0.68));
        const g = ctx.createLinearGradient(x, base - bh, x + bw, base);
        g.addColorStop(0, light);
        g.addColorStop(1, dark);
        ctx.fillStyle = g;
        ctx.fillRect(x, base - bh, bw, bh);
        if (layer > 0) {
          const cols = Math.max(1, Math.floor(bw / 9));
          const rows = Math.max(2, Math.floor(bh / 12));
          const accents = [biome.gantryAccent, biome.lampColor, biome.lampColor];
          for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
              if (r() < 0.62) continue;
              ctx.fillStyle = accents[Math.floor(r() * accents.length)];
              ctx.globalAlpha = 0.35 + r() * 0.5;
              ctx.fillRect(x + 3 + (cx * (bw - 6)) / cols, base - bh + 4 + (cy * (bh - 8)) / rows, 3, 4);
            }
          }
          ctx.globalAlpha = 1;
          if (r() < 0.3) {
            ctx.fillStyle = biome.gantryAccent;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(x, base - bh, bw, 2);
            ctx.globalAlpha = 1;
          }
          if (r() < 0.22) {
            ctx.strokeStyle = dark;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + bw / 2, base - bh);
            ctx.lineTo(x + bw / 2, base - bh - 12);
            ctx.stroke();
            ctx.fillStyle = '#f87171';
            ctx.fillRect(x + bw / 2 - 1.5, base - bh - 14, 3, 3);
          }
        }
        x += bw + 2 + r() * 8;
      }
      return c;
    }

    // periodic ridge so the layer wraps seamlessly
    const waves = Array.from({ length: 4 }, (_, i) => ({
      k: (i + 1) * (layer === 0 ? 2 : 3) + Math.floor(r() * 2),
      a: (layer === 0 ? 0.3 : 0.22) / (i + 1),
      p: r() * Math.PI * 2,
    }));
    const ridgeY = (x: number): number => {
      let v = 0.5;
      for (const w of waves) v += Math.sin((x / width) * Math.PI * 2 * w.k + w.p) * w.a;
      if (style === 'cactus') {
        return base - Math.max(0.14, Math.round(Math.max(0.12, v) * 8) / 8) * h * 0.92;
      }
      if (style === 'sakura') return base - Math.max(0.12, v) * h * 0.72;
      return base - Math.max(0.12, v) * h * 0.95;
    };
    const g = ctx.createLinearGradient(0, 0, 0, base);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= width; x += 2) ctx.lineTo(x, ridgeY(x));
    ctx.lineTo(width, base);
    ctx.closePath();
    ctx.fill();

    if (style === 'cactus' && layer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = 'rgba(0,0,0,0.14)';
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        const y = base - h * 0.16 * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }
    const snowyBiome = style === 'pine' || biome.id === 'alpine';
    if (snowyBiome && layer < 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const sg = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      sg.addColorStop(0, 'rgba(240,248,255,0.75)');
      sg.addColorStop(1, 'rgba(240,248,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, width, h * 0.5);
      ctx.restore();
    }
    if (style === 'pine' && layer === 2) {
      ctx.fillStyle = dark;
      for (let x = 0; x < width; x += 9 + r() * 8) {
        const th = 10 + r() * 16;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + 4, base - th);
        ctx.lineTo(x + 8, base);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (style === 'sakura') {
      if (layer === 1) {
        for (let i = 0; i < 16; i++) {
          const x = r() * width;
          ctx.fillStyle = 'rgba(244,180,210,0.5)';
          ctx.beginPath();
          ctx.arc(x, ridgeY(x) + 8 + r() * 10, 5 + r() * 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (layer === 2) {
        const tx = width * (0.2 + r() * 0.6);
        const ty = base - h * 0.42;
        ctx.fillStyle = shade(color, -40);
        ctx.fillRect(tx - 26, ty, 6, h * 0.42);
        ctx.fillRect(tx + 20, ty, 6, h * 0.42);
        ctx.fillRect(tx - 34, ty - 4, 68, 7);
        ctx.fillRect(tx - 28, ty + 10, 56, 5);
        for (let i = 0; i < 10; i++) {
          const x = r() * width;
          ctx.fillStyle = 'rgba(236,143,184,0.55)';
          ctx.beginPath();
          ctx.arc(x, base - 8 - r() * 20, 7 + r() * 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return c;
  });
}
