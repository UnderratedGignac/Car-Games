/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
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
      camWorldY - 0.068 * lookDist,
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

interface AtmosphereProfile {
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
}

function resolveAtmosphereProfile(
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
      fogDensity: 0.0046,
      waterDeep: 0x19060e,
      waterShallow: 0x4c0519,
      starOpacity: 0.9,
      auroraOpacity: 0.12,
      sunColor: 0xfb7185,
      keyLightIntensity: 0.9,
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
      fogDensity: 0.0042,
      waterDeep: 0x030c1a,
      waterShallow: 0x0d3b4c,
      starOpacity: 0.95,
      auroraOpacity: 0.82,
      sunColor: 0x6ee7b7,
      keyLightIntensity: 0.85,
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
      fogDensity: 0.0042,
      waterDeep: 0x040b18,
      waterShallow: biome.id === 'neon' ? 0x0e4a66 : 0x0f2d52,
      starOpacity: 0.88,
      auroraOpacity: 0.0,
      sunColor: 0xbae6fd,
      keyLightIntensity: 0.95,
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
      fogDensity: 0.0036,
      waterDeep: 0x1e2942,
      waterShallow: 0x7c3e2a,
      starOpacity: 0.16,
      auroraOpacity: 0.0,
      sunColor: 0xfdba74,
      keyLightIntensity: 1.55,
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
      fogDensity: 0.0032,
      waterDeep: 0x1e4d6b,
      waterShallow: 0x4ca6c4,
      starOpacity: 0.0,
      auroraOpacity: 0.0,
      sunColor: 0xfef3c7,
      keyLightIntensity: 1.7,
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
    fogDensity: 0.003,
    waterDeep: 0x184366,
    waterShallow: 0x3b8ea8,
    starOpacity: 0.0,
    auroraOpacity: 0.0,
    sunColor: 0xfffbeb,
    keyLightIntensity: 1.85,
  };
}

function buildDistantMountainRing(biomeId: RoadBiomeId): THREE.Group {
  const group = new THREE.Group();
  const noise2D = createNoise2D(createSeededRng(biomeId === 'canyon' ? 771 : biomeId === 'sakura' ? 503 : 919));

  const ringRadius = 310;
  const segs = 128;
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const baseColor = new THREE.Color(
    biomeId === 'canyon'
      ? 0x7c2d12
      : biomeId === 'neon'
      ? 0x0f172a
      : biomeId === 'sakura'
      ? 0x3f4c6b
      : 0x33475b
  );
  const peakColor = new THREE.Color(
    biomeId === 'canyon'
      ? 0xd97706
      : biomeId === 'neon'
      ? 0x1e3a5f
      : biomeId === 'sakura'
      ? 0xf8fafc
      : 0xe2e8f0
  );

  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const nx = Math.cos(theta);
    const nz = Math.sin(theta);

    let h = 14;
    if (biomeId === 'neon') {
      // Stepped bayfront city skyline silhouette
      const block = Math.floor((i / segs) * 44);
      const pseudo = Math.abs(Math.sin(block * 12.9898 + 4.14));
      h = 12 + pseudo * 34;
    } else if (biomeId === 'canyon') {
      // Flat-topped sandstone mesas
      const raw = sampleFractalNoise2D(noise2D, nx * 2.2, nz * 2.2, 3);
      const clamped = Math.min(0.45, Math.max(-0.2, raw));
      h = 18 + (clamped + 0.2) * 58;
    } else if (biomeId === 'sakura') {
      // Iconic Mount Fuji cone ahead (-Z ~ -PI/2) + soft surrounding ridges
      const fujiDelta = Math.atan2(Math.sin(theta + Math.PI * 0.5), Math.cos(theta + Math.PI * 0.5));
      const fuji = Math.max(0, 1 - Math.abs(fujiDelta) / 0.28);
      const n = sampleFractalNoise2D(noise2D, nx * 2.5, nz * 2.5, 3);
      h = 10 + Math.max(0, n) * 24 + Math.pow(fuji, 1.35) * 44;
    } else {
      // Sharp jagged Alpine peaks
      const ridge = 1 - Math.abs(sampleFractalNoise2D(noise2D, nx * 2.8, nz * 2.8, 4));
      h = 12 + Math.pow(ridge, 1.7) * 52;
    }

    const x = nx * ringRadius;
    const z = nz * ringRadius;
    const yBot = VALLEY_BASE_Y - 8;
    const yTop = VALLEY_BASE_Y + h;

    positions.push(x, yBot, z);
    positions.push(x, yTop, z);

    const snowFrac = biomeId === 'alpine' || biomeId === 'sakura' ? Math.max(0, (h - 30) / 26) : Math.max(0, (h - 24) / 30) * 0.45;
    const topC = baseColor.clone().lerp(peakColor, Math.min(1, snowFrac));
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
    roughness: 0.92,
    metalness: biomeId === 'neon' ? 0.35 : 0.04,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, mat);
  group.add(mesh);
  return group;
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
  const fog = new THREE.FogExp2(0x9ec7e6, 0.003);
  scene.fog = fog;

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

  // 5. Reflective Animated Water / Valley Sea Basin using CustomShaderMaterial
  const waterUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(0x184366) },
    uShallowColor: { value: new THREE.Color(0x3b8ea8) },
    uSunDir: { value: new THREE.Vector3(0.2, 0.4, -0.9).normalize() },
    uSunColor: { value: new THREE.Color(0xfffbeb) },
  };
  const waterMat = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    roughness: 0.14,
    metalness: 0.35,
    uniforms: waterUniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWaterWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float w1 = sin(wp.x * 0.18 + uTime * 1.4) * cos(wp.z * 0.22 + uTime * 1.1) * 0.18;
        float w2 = sin((wp.x + wp.z) * 0.34 - uTime * 1.9) * 0.08;
        wp.y += w1 + w2;
        vWaterWorld = wp.xyz;
        csm_Position = (inverse(modelMatrix) * wp).xyz;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vWaterWorld;
      void main() {
        float rippleA = sin(vWaterWorld.x * 0.45 + uTime * 1.8) * cos(vWaterWorld.z * 0.45 - uTime * 1.3);
        float rippleB = sin(vWaterWorld.x * 1.1 - vWaterWorld.z * 0.9 + uTime * 2.4);
        vec3 n = normalize(vec3(rippleA * 0.11 + rippleB * 0.04, 1.0, rippleB * 0.09 - rippleA * 0.05));
        vec3 viewDir = normalize(cameraPosition - vWaterWorld);
        float fresnel = pow(1.0 - max(0.0, dot(viewDir, n)), 3.2);
        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(0.0, dot(n, halfVec)), 72.0) * 1.35;
        vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(fresnel * 0.85 + rippleA * 0.12, 0.0, 1.0));
        csm_DiffuseColor.rgb = baseWater + uSunColor * spec;
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
      camWorldY - 0.068 * lookDist,
      camWorldZ + fwdZ * lookDist
    );
    camera.updateProjectionMatrix();

    // Keep infinite backdrop centered horizontally around the moving car/camera
    skyObj.position.set(camWorldX, 0, camWorldZ);
    starPoints.position.set(camWorldX, camWorldY, camWorldZ);
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

      sunLight.position.copy(sunVec).multiplyScalar(80);
      sunLight.color.setHex(prof.sunColor);
      sunLight.intensity = prof.keyLightIntensity;

      celestialMat.color.setHex(prof.sunColor);
      celestialMat.opacity = sky.isNight ? 0.92 : 0.72;
      celestialMesh.scale.setScalar(sky.id === 'big_moon' || sky.id === 'red_moon' ? 1.75 : 0.9);

      starMat.opacity = prof.starOpacity;
      starPoints.visible = prof.starOpacity > 0.02;

      waterUniforms.uDeepColor.value.setHex(prof.waterDeep);
      waterUniforms.uShallowColor.value.setHex(prof.waterShallow);
      waterUniforms.uSunDir.value.copy(sunVec).normalize();
      waterUniforms.uSunColor.value.setHex(prof.sunColor);
    }

    // Position Sun / Moon visual disc relative to camera
    celestialMesh.position.set(
      camWorldX + sunVec.x * 340,
      camWorldY + Math.max(0.06, Math.abs(sunVec.y)) * 340,
      camWorldZ + sunVec.z * 340
    );
    celestialMesh.lookAt(camera.position);

    waterUniforms.uTime.value = nowMs * 0.001;

    renderer.render(scene, camera);
  };

  const dispose = () => {
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
