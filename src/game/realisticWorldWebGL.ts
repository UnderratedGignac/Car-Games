/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { createNoise2D } from 'simplex-noise';
import { RoadBiomeConfig, RoadBiomeId, VALLEY_BASE_Y } from './rules';
import { SkyAtmosphereConfig } from './skyArt';
import { createSeededRng, sampleFractalNoise2D } from './proceduralTextures';

export interface WebGLCameraSyncParams {
  fovDeg: number;
  aspect: number;
  camPos: [number, number, number];
  lookAt: [number, number, number];
  viewOffsetX: number;
  viewOffsetY: number;
}

/**
 * Computes exact Three.js PerspectiveCamera parameters (FOV, lookAt pitch slope 0.068,
 * and setViewOffset screen-horizon shift) matching SceneCanvas `projectInto()`.
 */
export function computeWebGLCameraSyncParams(params: {
  pxW: number;
  pxH: number;
  fovScale: number;
  horizonY: number;
  shakeX: number;
  shakeY: number;
  camWorldX: number;
  camWorldY: number;
  camWorldZ: number;
  fwdX: number;
  fwdZ: number;
  camPitchSlope?: number;
}): WebGLCameraSyncParams {
  const {
    pxW,
    pxH,
    fovScale,
    horizonY,
    shakeX,
    shakeY,
    camWorldX,
    camWorldY,
    camWorldZ,
    fwdX,
    fwdZ,
    camPitchSlope = 0.068,
  } = params;

  const safeH = Math.max(1, pxH);
  const safeW = Math.max(1, pxW);
  const safeFovScale = Math.max(1, fovScale);
  const fovRad = 2 * Math.atan((safeH * 0.5) / safeFovScale);
  const fovDeg = (fovRad * 180) / Math.PI;

  const lookDist = 100;
  return {
    fovDeg,
    aspect: safeW / safeH,
    camPos: [camWorldX, camWorldY, camWorldZ],
    lookAt: [
      camWorldX + fwdX * lookDist,
      camWorldY - camPitchSlope * lookDist,
      camWorldZ + fwdZ * lookDist,
    ],
    viewOffsetX: -shakeX,
    viewOffsetY: safeH * 0.5 - horizonY - shakeY,
  };
}

export interface RealisticWorldRenderArgs {
  nowMs: number;
  pxW: number;
  pxH: number;
  fovScale: number;
  horizonY: number;
  shakeX: number;
  shakeY: number;
  camWorldX: number;
  camWorldY: number;
  camWorldZ: number;
  fwdX: number;
  fwdZ: number;
  camPitchSlope?: number;
  biome: RoadBiomeConfig;
  sky: SkyAtmosphereConfig;
  inDeepCave: boolean;
}

export interface RealisticWorldWebGLController {
  readonly isSoftwareGl: boolean;
  resize: (width: number, height: number) => void;
  render: (args: RealisticWorldRenderArgs) => void;
  dispose: () => void;
}

export interface AtmosphereProfile {
  elevationDeg: number;
  azimuthDeg: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  exposure: number;
  fogColor: number;
  fogDensity: number;
  waterDeep: number;
  waterShallow: number;
  starOpacity: number;
  auroraOpacity: number;
  sunColor: number;
  keyLightIntensity: number;
  cloudTint: number;
  cloudOpacity: number;
  envIntensity: number;
}

export function resolveAtmosphereProfile(
  biome: RoadBiomeConfig,
  sky: SkyAtmosphereConfig
): AtmosphereProfile {
  if (sky.id === 'red_moon') {
    return {
      elevationDeg: -3.5,
      azimuthDeg: 185,
      turbidity: 6.5,
      rayleigh: 0.42,
      mieCoefficient: 0.014,
      mieDirectionalG: 0.86,
      exposure: 0.44,
      fogColor: 0x2a0814,
      fogDensity: 0.0044,
      waterDeep: 0x19060e,
      waterShallow: 0x4c0519,
      starOpacity: 0.9,
      auroraOpacity: 0.12,
      sunColor: 0xfb7185,
      keyLightIntensity: 0.9,
      cloudTint: 0x7f1d1d,
      cloudOpacity: 0.34,
      envIntensity: 0.25,
    };
  }
  if (sky.id === 'aurora_night') {
    return {
      elevationDeg: -5.0,
      azimuthDeg: 175,
      turbidity: 2.2,
      rayleigh: 0.25,
      mieCoefficient: 0.008,
      mieDirectionalG: 0.8,
      exposure: 0.42,
      fogColor: 0x06152b,
      fogDensity: 0.004,
      waterDeep: 0x030c1a,
      waterShallow: 0x0d3b4c,
      starOpacity: 0.95,
      auroraOpacity: 0.82,
      sunColor: 0x6ee7b7,
      keyLightIntensity: 0.85,
      cloudTint: 0x1e3a5f,
      cloudOpacity: 0.28,
      envIntensity: 0.24,
    };
  }
  if (sky.id === 'big_moon' || sky.isNight) {
    return {
      elevationDeg: -4.2,
      azimuthDeg: 190,
      turbidity: 3.4,
      rayleigh: 0.34,
      mieCoefficient: 0.01,
      mieDirectionalG: 0.82,
      exposure: 0.46,
      fogColor: biome.id === 'neon' ? 0x09162d : 0x0a1732,
      fogDensity: 0.004,
      waterDeep: 0x040b18,
      waterShallow: biome.id === 'neon' ? 0x0e4a66 : 0x0f2d52,
      starOpacity: 0.88,
      auroraOpacity: 0.0,
      sunColor: 0xbae6fd,
      keyLightIntensity: 0.95,
      cloudTint: biome.id === 'neon' ? 0x1e293b : 0x334155,
      cloudOpacity: 0.32,
      envIntensity: 0.28,
    };
  }
  if (sky.id === 'golden_sunset' || biome.id === 'canyon') {
    return {
      elevationDeg: 4.5,
      azimuthDeg: 198,
      turbidity: 8.8,
      rayleigh: 2.85,
      mieCoefficient: 0.008,
      mieDirectionalG: 0.84,
      exposure: 0.56,
      fogColor: 0xca6c42,
      fogDensity: 0.0034,
      waterDeep: 0x1e2942,
      waterShallow: 0x7c3e2a,
      starOpacity: 0.16,
      auroraOpacity: 0.0,
      sunColor: 0xfdba74,
      keyLightIntensity: 1.55,
      cloudTint: 0xfed7aa,
      cloudOpacity: 0.58,
      envIntensity: 0.44,
    };
  }
  if (biome.id === 'sakura') {
    return {
      elevationDeg: 18.0,
      azimuthDeg: 162,
      turbidity: 4.2,
      rayleigh: 1.45,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.78,
      exposure: 0.58,
      fogColor: 0xbfdcf0,
      fogDensity: 0.003,
      waterDeep: 0x1e4d6b,
      waterShallow: 0x4ca6c4,
      starOpacity: 0.0,
      auroraOpacity: 0.0,
      sunColor: 0xfef3c7,
      keyLightIntensity: 1.7,
      cloudTint: 0xfff1f2,
      cloudOpacity: 0.68,
      envIntensity: 0.48,
    };
  }
  // Radiant Alpine Day
  return {
    elevationDeg: 26.0,
    azimuthDeg: 168,
    turbidity: 3.1,
    rayleigh: 1.28,
    mieCoefficient: 0.0045,
    mieDirectionalG: 0.76,
    exposure: 0.62,
    fogColor: 0x9ec7e6,
    fogDensity: 0.0028,
    waterDeep: 0x184366,
    waterShallow: 0x3b8ea8,
    starOpacity: 0.0,
    auroraOpacity: 0.0,
    sunColor: 0xfffbeb,
    keyLightIntensity: 1.85,
    cloudTint: 0xf8fafc,
    cloudOpacity: 0.72,
    envIntensity: 0.52,
  };
}

function buildHorizonTerrainTier(params: {
  biomeId: RoadBiomeId;
  ringRadius: number;
  segs: number;
  heightScale: number;
  baseYOffset: number;
  baseHex: number;
  peakHex: number;
  phaseOffset: number;
  noise2D: (x: number, y: number) => number;
}): THREE.Mesh {
  const {
    biomeId,
    ringRadius,
    segs,
    heightScale,
    baseYOffset,
    baseHex,
    peakHex,
    phaseOffset,
    noise2D,
  } = params;

  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const baseColor = new THREE.Color(baseHex);
  const peakColor = new THREE.Color(peakHex);
  const sunTint = new THREE.Color(biomeId === 'canyon' ? 0xfdba74 : biomeId === 'sakura' ? 0xfce7f3 : 0xf8fafc);

  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const nx = Math.cos(theta);
    const nz = Math.sin(theta);
    const sx = Math.cos(theta + phaseOffset);
    const sz = Math.sin(theta + phaseOffset);

    let h = 14;
    if (biomeId === 'neon') {
      const block = Math.floor(((i + phaseOffset * 10) / segs) * 48);
      const pseudo = Math.abs(Math.sin(block * 12.9898 + 4.14));
      h = (10 + pseudo * 36) * heightScale;
    } else if (biomeId === 'canyon') {
      const raw = sampleFractalNoise2D(noise2D, sx * 2.3, sz * 2.3, 3);
      const clamped = Math.min(0.45, Math.max(-0.2, raw));
      h = (16 + (clamped + 0.2) * 58) * heightScale;
    } else if (biomeId === 'sakura') {
      const fujiDelta = Math.atan2(Math.sin(theta + Math.PI * 0.5), Math.cos(theta + Math.PI * 0.5));
      const fuji = heightScale > 0.8 ? Math.max(0, 1 - Math.abs(fujiDelta) / 0.28) : 0;
      const n = sampleFractalNoise2D(noise2D, sx * 2.5, sz * 2.5, 3);
      h = (10 + Math.max(0, n) * 24) * heightScale + Math.pow(fuji, 1.35) * 44;
    } else {
      const ridge = 1 - Math.abs(sampleFractalNoise2D(noise2D, sx * 2.8, sz * 2.8, 4));
      h = (11 + Math.pow(ridge, 1.7) * 52) * heightScale;
    }

    const x = nx * ringRadius;
    const z = nz * ringRadius;
    const yBot = VALLEY_BASE_Y + baseYOffset;
    const yTop = VALLEY_BASE_Y + h;

    positions.push(x, yBot, z);
    positions.push(x, yTop, z);

    const snowFrac =
      biomeId === 'alpine' || biomeId === 'sakura'
        ? Math.max(0, (h - 24 * heightScale) / (26 * heightScale))
        : Math.max(0, (h - 20 * heightScale) / (30 * heightScale)) * 0.45;
    const sunFacing = Math.max(0, nx * -0.35 + nz * 0.65) * 0.14;
    const topC = baseColor
      .clone()
      .lerp(peakColor, Math.min(1, snowFrac))
      .lerp(sunTint, sunFacing);
    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topC.r, topC.g, topC.b);

    if (i < segs) {
      const i0 = i * 2;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      const i3 = i0 + 3;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: biomeId === 'neon' ? 0.68 : 0.92,
    metalness: biomeId === 'neon' ? 0.35 : 0.04,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geom, mat);
}

function buildDistantMountainRing(biomeId: RoadBiomeId): THREE.Group {
  const group = new THREE.Group();
  const noise2D = createNoise2D(
    createSeededRng(biomeId === 'canyon' ? 771 : biomeId === 'sakura' ? 503 : 919)
  );

  // Outer majestic horizon peaks / skyline
  const outerRing = buildHorizonTerrainTier({
    biomeId,
    ringRadius: 315,
    segs: 128,
    heightScale: 1.0,
    baseYOffset: -8,
    baseHex:
      biomeId === 'canyon'
        ? 0x7c2d12
        : biomeId === 'neon'
        ? 0x0f172a
        : biomeId === 'sakura'
        ? 0x3f4c6b
        : 0x33475b,
    peakHex:
      biomeId === 'canyon'
        ? 0xd97706
        : biomeId === 'neon'
        ? 0x1e3a5f
        : biomeId === 'sakura'
        ? 0xf8fafc
        : 0xe2e8f0,
    phaseOffset: 0,
    noise2D,
  });
  group.add(outerRing);

  // Inner mid-distance forested / terracotta foothills for authentic valley parallax depth
  const innerRing = buildHorizonTerrainTier({
    biomeId,
    ringRadius: 215,
    segs: 108,
    heightScale: 0.46,
    baseYOffset: -6,
    baseHex:
      biomeId === 'canyon'
        ? 0x5c200d
        : biomeId === 'neon'
        ? 0x091122
        : biomeId === 'sakura'
        ? 0x28434a
        : 0x25423a,
    peakHex:
      biomeId === 'canyon'
        ? 0xb45309
        : biomeId === 'neon'
        ? 0x162b4d
        : biomeId === 'sakura'
        ? 0x4b7766
        : 0x456e57,
    phaseOffset: 0.62,
    noise2D,
  });
  group.add(innerRing);

  // Glowing bayfront city window specks & beacon spires in Neon skyline
  if (biomeId === 'neon') {
    const winCount = 420;
    const winPos = new Float32Array(winCount * 3);
    const winCols = new Float32Array(winCount * 3);
    const rng = createSeededRng(4242);
    const palette = [
      new THREE.Color(0x22d3ee),
      new THREE.Color(0xfef08a),
      new THREE.Color(0xf472b6),
      new THREE.Color(0xf8fafc),
    ];
    for (let i = 0; i < winCount; i++) {
      const theta = rng() * Math.PI * 2;
      const r = i % 3 === 0 ? 213 : 312;
      const block = Math.floor((theta / (Math.PI * 2)) * 48);
      const maxH = (10 + Math.abs(Math.sin(block * 12.9898 + 4.14)) * 32) * (r < 250 ? 0.46 : 1.0);
      const wy = VALLEY_BASE_Y + 2 + rng() * Math.max(4, maxH - 3);
      winPos[i * 3] = Math.cos(theta) * r;
      winPos[i * 3 + 1] = wy;
      winPos[i * 3 + 2] = Math.sin(theta) * r;
      const c = palette[i % palette.length];
      winCols[i * 3] = c.r;
      winCols[i * 3 + 1] = c.g;
      winCols[i * 3 + 2] = c.b;
    }
    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute('position', new THREE.BufferAttribute(winPos, 3));
    winGeo.setAttribute('color', new THREE.BufferAttribute(winCols, 3));
    const winMat = new THREE.PointsMaterial({
      size: 2.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    group.add(new THREE.Points(winGeo, winMat));
  }

  return group;
}

function createSoftCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const lobes: [number, number, number, number][] = [
    [76, 76, 46, 0.55],
    [122, 60, 56, 0.78],
    [172, 72, 48, 0.62],
    [104, 82, 44, 0.58],
    [148, 82, 44, 0.55],
  ];
  for (const [cx, cy, r, a] of lobes) {
    const g = ctx.createRadialGradient(cx, cy - r * 0.14, r * 0.12, cx, cy, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
    g.addColorStop(0.58, `rgba(255, 255, 255, ${(a * 0.52).toFixed(2)})`);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface CloudSlot {
  sprite: THREE.Sprite;
  baseTheta: number;
  radius: number;
  height: number;
  driftSpeed: number;
}

export function createRealisticWorldWebGL(
  mountEl: HTMLElement
): RealisticWorldWebGLController | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
  } catch {
    return null;
  }

  const glCtx = renderer.getContext();
  const dbgInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
  const glVendor = String(
    dbgInfo ? glCtx.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : glCtx.getParameter(glCtx.RENDERER)
  ).toLowerCase();
  const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(glVendor);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.58;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  while (mountEl.firstChild) {
    mountEl.removeChild(mountEl.firstChild);
  }
  mountEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0x9ec7e6, 0.0028);
  scene.fog = fog;

  // PBR Environment IBL via RoomEnvironment + PMREMGenerator (clean sky/ground specular bounce)
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmremGen.fromScene(roomEnv, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.45;
  roomEnv.dispose();
  pmremGen.dispose();

  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.5, 900);

  // 1. Physically Based Atmospheric Sky
  const skyObj = new Sky();
  skyObj.scale.setScalar(800);
  scene.add(skyObj);

  // 2. Lighting Rig matching Sun/Moon Azimuth
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
  scene.add(hemiLight);
  const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.75);
  scene.add(sunLight);

  // 3. Night Starfield Points
  const starCount = 650;
  const starPos = new Float32Array(starCount * 3);
  const starRng = createSeededRng(90210);
  for (let i = 0; i < starCount; i++) {
    const theta = starRng() * Math.PI * 2;
    const phi = Math.acos(0.12 + starRng() * 0.88);
    const r = 360;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xe0f2fe,
    size: 1.9,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  scene.add(starPoints);

  // 4. Sun / Moon Disc Halo
  const celestialGeo = new THREE.CircleGeometry(14, 32);
  const celestialMat = new THREE.MeshBasicMaterial({
    color: 0xfffbeb,
    transparent: true,
    opacity: 0.92,
    fog: false,
    depthWrite: false,
  });
  const celestialMesh = new THREE.Mesh(celestialGeo, celestialMat);
  scene.add(celestialMesh);

  // 4b. Volumetric Drifting 3D Sky Cloud Deck (lightweight instanced sprite ring)
  const cloudTex = createSoftCloudTexture();
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTex,
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    fog: true,
  });
  const cloudGroup = new THREE.Group();
  const cloudRng = createSeededRng(31415);
  const cloudSlots: CloudSlot[] = [];
  const cloudCount = isSoftwareGl ? 16 : 24;
  for (let i = 0; i < cloudCount; i++) {
    const sp = new THREE.Sprite(cloudMat);
    const baseTheta = (i / cloudCount) * Math.PI * 2 + (cloudRng() - 0.5) * 0.18;
    const radius = 195 + cloudRng() * 95;
    const height = VALLEY_BASE_Y + 34 + cloudRng() * 44;
    const wScale = 64 + cloudRng() * 68;
    sp.scale.set(wScale, wScale * (0.42 + cloudRng() * 0.14), 1);
    cloudGroup.add(sp);
    cloudSlots.push({
      sprite: sp,
      baseTheta,
      radius,
      height,
      driftSpeed: 0.0045 + cloudRng() * 0.0055,
    });
  }
  scene.add(cloudGroup);

  // 5. Reflective Animated Water / Valley Sea Basin using CustomShaderMaterial
  const waterUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(0x184366) },
    uShallowColor: { value: new THREE.Color(0x3b8ea8) },
    uHorizonColor: { value: new THREE.Color(0x9ec7e6) },
    uSunDir: { value: new THREE.Vector3(0.2, 0.4, -0.9).normalize() },
    uSunColor: { value: new THREE.Color(0xfffbeb) },
  };
  const waterMat = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    roughness: 0.12,
    metalness: 0.42,
    uniforms: waterUniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWaterWorld;
      varying float vWaveCrest;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float w1 = sin(wp.x * 0.18 + uTime * 1.4) * cos(wp.z * 0.22 + uTime * 1.1) * 0.18;
        float w2 = sin((wp.x + wp.z) * 0.34 - uTime * 1.9) * 0.08;
        wp.y += w1 + w2;
        vWaterWorld = wp.xyz;
        vWaveCrest = (w1 + w2);
        csm_Position = (inverse(modelMatrix) * wp).xyz;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vWaterWorld;
      varying float vWaveCrest;
      void main() {
        float rippleA = sin(vWaterWorld.x * 0.45 + uTime * 1.8) * cos(vWaterWorld.z * 0.45 - uTime * 1.3);
        float rippleB = sin(vWaterWorld.x * 1.1 - vWaterWorld.z * 0.9 + uTime * 2.4);
        vec3 n = normalize(vec3(rippleA * 0.11 + rippleB * 0.04, 1.0, rippleB * 0.09 - rippleA * 0.05));
        vec3 viewDir = normalize(cameraPosition - vWaterWorld);
        float fresnel = pow(1.0 - max(0.0, dot(viewDir, n)), 3.0);
        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(0.0, dot(n, halfVec)), 84.0) * 1.45;
        float foam = smoothstep(0.16, 0.26, vWaveCrest + rippleA * 0.06) * 0.18;
        vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(fresnel * 0.65 + rippleA * 0.12, 0.0, 1.0));
        vec3 skyRefl = mix(baseWater, uHorizonColor, fresnel * 0.48);
        csm_DiffuseColor.rgb = skyRefl + uSunColor * spec + vec3(foam);
      }
    `,
  }) as unknown as THREE.MeshStandardMaterial;

  const waterGeo = new THREE.PlaneGeometry(760, 760, isSoftwareGl ? 16 : 36, isSoftwareGl ? 16 : 36);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = VALLEY_BASE_Y - 1.35;
  scene.add(waterMesh);

  // 6. Biome-Specific 3D Distant Horizon Peaks / Mesas / Skyline
  const biomeRings = new Map<RoadBiomeId, THREE.Group>();
  let activeRingBiome: RoadBiomeId | null = null;
  const ensureBiomeRing = (biomeId: RoadBiomeId) => {
    if (activeRingBiome === biomeId) return;
    biomeRings.forEach((grp, key) => {
      grp.visible = key === biomeId;
    });
    if (!biomeRings.has(biomeId)) {
      const grp = buildDistantMountainRing(biomeId);
      biomeRings.set(biomeId, grp);
      scene.add(grp);
    }
    biomeRings.get(biomeId)!.visible = true;
    activeRingBiome = biomeId;
  };

  const sunVec = new THREE.Vector3();
  let lastSizeW = 0;
  let lastSizeH = 0;
  let lastAtmosphereKey = '';
  let cachedProfile: AtmosphereProfile | null = null;

  const resize = (width: number, height: number) => {
    const scale = isSoftwareGl ? 0.6 : 1;
    const w = Math.max(isSoftwareGl ? 320 : 1, Math.round(width * scale));
    const h = Math.max(isSoftwareGl ? 200 : 1, Math.round(height * scale));
    if (w === lastSizeW && h === lastSizeH) return;
    lastSizeW = w;
    lastSizeH = h;
    renderer.setSize(w, h, false);
  };

  const render = (args: RealisticWorldRenderArgs) => {
    const {
      nowMs,
      pxW,
      pxH,
      fovScale,
      horizonY,
      shakeX,
      shakeY,
      camWorldX,
      camWorldY,
      camWorldZ,
      fwdX,
      fwdZ,
      camPitchSlope = 0.068,
      biome,
      sky,
      inDeepCave,
    } = args;

    if (inDeepCave) {
      return;
    }

    resize(mountEl.clientWidth || pxW, mountEl.clientHeight || pxH);

    const safeH = Math.max(1, pxH);
    const safeW = Math.max(1, pxW);
    const safeFovScale = Math.max(1, fovScale);
    const fovDeg = (2 * Math.atan((safeH * 0.5) / safeFovScale) * 180) / Math.PI;
    const lookDist = 100;

    camera.fov = fovDeg;
    camera.aspect = safeW / safeH;
    camera.setViewOffset(
      safeW,
      safeH,
      -shakeX,
      safeH * 0.5 - horizonY - shakeY,
      safeW,
      safeH
    );
    camera.position.set(camWorldX, camWorldY, camWorldZ);
    camera.lookAt(
      camWorldX + fwdX * lookDist,
      camWorldY - camPitchSlope * lookDist,
      camWorldZ + fwdZ * lookDist
    );
    camera.updateProjectionMatrix();

    // Keep infinite backdrop centered horizontally around the moving car/camera
    skyObj.position.set(camWorldX, 0, camWorldZ);
    starPoints.position.set(camWorldX, camWorldY, camWorldZ);
    cloudGroup.position.set(camWorldX, 0, camWorldZ);
    waterMesh.position.x = camWorldX;
    waterMesh.position.z = camWorldZ;

    ensureBiomeRing(biome.id);
    const ringGrp = biomeRings.get(biome.id);
    if (ringGrp) {
      ringGrp.position.set(camWorldX, 0, camWorldZ);
    }

    const atmoKey = `${biome.id}:${sky.id}`;
    if (atmoKey !== lastAtmosphereKey || !cachedProfile) {
      lastAtmosphereKey = atmoKey;
      const prof = resolveAtmosphereProfile(biome, sky);
      cachedProfile = prof;

      const phi = THREE.MathUtils.degToRad(90 - prof.elevationDeg);
      const theta = THREE.MathUtils.degToRad(prof.azimuthDeg);
      sunVec.setFromSphericalCoords(1, phi, theta);

      const skyUniforms = skyObj.material.uniforms;
      skyUniforms['turbidity'].value = prof.turbidity;
      skyUniforms['rayleigh'].value = prof.rayleigh;
      skyUniforms['mieCoefficient'].value = prof.mieCoefficient;
      skyUniforms['mieDirectionalG'].value = prof.mieDirectionalG;
      skyUniforms['sunPosition'].value.copy(sunVec);

      renderer.toneMappingExposure = prof.exposure;
      fog.color.setHex(prof.fogColor);
      fog.density = prof.fogDensity;
      scene.environmentIntensity = prof.envIntensity;

      sunLight.position.copy(sunVec).multiplyScalar(80);
      sunLight.color.setHex(prof.sunColor);
      sunLight.intensity = prof.keyLightIntensity;

      celestialMat.color.setHex(prof.sunColor);
      celestialMat.opacity = sky.isNight ? 0.92 : 0.72;
      celestialMesh.scale.setScalar(sky.id === 'big_moon' || sky.id === 'red_moon' ? 1.75 : 0.9);

      starMat.opacity = prof.starOpacity;
      starPoints.visible = prof.starOpacity > 0.02;

      cloudMat.color.setHex(prof.cloudTint);
      cloudMat.opacity = prof.cloudOpacity;

      waterUniforms.uDeepColor.value.setHex(prof.waterDeep);
      waterUniforms.uShallowColor.value.setHex(prof.waterShallow);
      waterUniforms.uHorizonColor.value.setHex(prof.fogColor);
      waterUniforms.uSunDir.value.copy(sunVec).normalize();
      waterUniforms.uSunColor.value.setHex(prof.sunColor);
    }

    const timeSec = nowMs * 0.001;
    for (let i = 0; i < cloudSlots.length; i++) {
      const cs = cloudSlots[i];
      const ang = cs.baseTheta + timeSec * cs.driftSpeed;
      cs.sprite.position.set(
        Math.cos(ang) * cs.radius,
        cs.height,
        Math.sin(ang) * cs.radius
      );
    }

    // Position Sun / Moon visual disc relative to camera
    celestialMesh.position.set(
      camWorldX + sunVec.x * 340,
      camWorldY + Math.max(0.06, Math.abs(sunVec.y)) * 340,
      camWorldZ + sunVec.z * 340
    );
    celestialMesh.lookAt(camera.position);

    waterUniforms.uTime.value = timeSec;

    renderer.render(scene, camera);
  };

  const dispose = () => {
    envRT.dispose();
    cloudTex.dispose();
    cloudMat.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
    renderer.dispose();
    while (mountEl.firstChild) {
      mountEl.removeChild(mountEl.firstChild);
    }
  };

  return {
    isSoftwareGl,
    resize,
    render,
    dispose,
  };
}
