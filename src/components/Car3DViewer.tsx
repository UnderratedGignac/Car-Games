import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { N8AOPostPass } from 'n8ao';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { CarCustomization, CarSpec, resolveCarAppearance } from '../game/rules';
import { resolveVehicleArchetype } from '../game/pixelSprites';
import { CarDamageState, CarPartId, CAR_PART_IDS, getDamageVisualCacheKey } from '../game/damage';
import { createShowroomTexturePack, type ShowroomTexturePack } from '../game/proceduralTextures';

CameraControls.install({ THREE });

export type InspectTarget = 'all' | 'hood' | 'wheels' | 'aero' | 'exhaust' | 'underglow';

interface Car3DViewerProps {
  car: CarSpec;
  appearance: ReturnType<typeof resolveCarAppearance>;
  customization: CarCustomization;
  damageState?: CarDamageState;
  highlightedPart?: CarPartId | null;
  isFlashing?: boolean;
  isRevving?: boolean;
  onInspectTargetChange?: (target: InspectTarget) => void;
}

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material?.dispose();
      }
    }
  });
}

function createExtrudedProfile(
  points: [number, number][],
  width: number,
  bevel = 0.028
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    steps: 1,
  });
  geo.translate(0, 0, -width * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createSculptedTireGeometry(rad: number, width: number): THREE.LatheGeometry {
  const hw = width * 0.5;
  const rimBead = rad * 0.62;
  const shoulderR = rad * 0.965;
  const crownR = rad;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rimBead, -hw * 0.88),
    new THREE.Vector2(rad * 0.78, -hw * 0.99),
    new THREE.Vector2(shoulderR, -hw * 0.84),
    new THREE.Vector2(crownR, -hw * 0.56),
    new THREE.Vector2(crownR, 0),
    new THREE.Vector2(crownR, hw * 0.56),
    new THREE.Vector2(shoulderR, hw * 0.84),
    new THREE.Vector2(rad * 0.78, hw * 0.99),
    new THREE.Vector2(rimBead, hw * 0.88),
  ];
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createExhaustTipGeometry(radius = 0.068, length = 0.28): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(radius * 0.82, -length * 0.5),
    new THREE.Vector2(radius, -length * 0.5),
    new THREE.Vector2(radius, length * 0.44),
    new THREE.Vector2(radius * 0.95, length * 0.5),
    new THREE.Vector2(radius * 0.84, length * 0.48),
    new THREE.Vector2(radius * 0.82, length * 0.06),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createMetallicFlakeMaterial(
  baseColor: THREE.Color,
  texPack: ShowroomTexturePack | null,
  clearcoatStrength = 1.0
): THREE.MeshPhysicalMaterial {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshPhysicalMaterial,
    color: baseColor,
    metalness: 0.72,
    roughness: 0.22,
    roughnessMap: texPack?.paintFlakeRoughness ?? null,
    clearcoat: clearcoatStrength,
    clearcoatRoughness: 0.065,
    clearcoatNormalMap: texPack?.paintFlakeNormal ?? null,
    clearcoatNormalScale: new THREE.Vector2(0.18, 0.18),
    envMapIntensity: 1.55,
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      float hashFlake(vec3 p) {
        p = fract(p * vec3(443.8975, 397.2973, 491.1871));
        p += dot(p, p.yxz + 19.19);
        return fract((p.x + p.y) * p.z);
      }
      void main() {
        vec3 cell = floor(vLocalPos * 145.0);
        float rnd = hashFlake(cell);
        float glint = smoothstep(0.92, 1.0, rnd);
        vec3 viewDirW = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, abs(dot(vNormal, viewDirW))), 3.0);
        csm_DiffuseColor.rgb += csm_DiffuseColor.rgb * (glint * 0.18 + fresnel * 0.06);
        csm_Roughness = clamp(csm_Roughness - glint * 0.14, 0.06, 0.95);
      }
    `,
  }) as unknown as THREE.MeshPhysicalMaterial;
}

function sphericalLookAt(yaw: number, pitch: number, dist: number, centerY: number): [number, number, number] {
  const x = Math.sin(yaw) * Math.cos(pitch) * dist;
  const y = Math.sin(pitch) * dist + centerY;
  const z = Math.cos(yaw) * Math.cos(pitch) * dist;
  return [x, y, z];
}

export const Car3DViewer: React.FC<Car3DViewerProps> = ({
  car,
  appearance,
  customization,
  damageState,
  highlightedPart = null,
  isFlashing = false,
  isRevving = false,
  onInspectTargetChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [activeInspect, setActiveInspect] = useState<InspectTarget>('all');
  const [contextLost, setContextLost] = useState<boolean>(false);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<CameraControls | null>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);
  const fxGroupRef = useRef<THREE.Group | null>(null);
  const exhaustFlamesRef = useRef<THREE.Group | null>(null);
  const headlightLightsRef = useRef<THREE.SpotLight[]>([]);
  const underglowLightRef = useRef<THREE.PointLight | null>(null);
  const isSoftwareGlRef = useRef<boolean>(false);
  const texPackRef = useRef<ShowroomTexturePack | null>(null);

  const moveCameraTo = (yaw: number, pitch: number, dist: number, centerY: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const [camX, camY, camZ] = sphericalLookAt(yaw, pitch, dist, centerY);
    controls.setLookAt(camX, camY, camZ, 0, centerY, 0, !isSoftwareGlRef.current);
  };

  const setInspectionMode = (target: InspectTarget) => {
    setActiveInspect(target);
    onInspectTargetChange?.(target);
    setAutoRotate(false);

    switch (target) {
      case 'hood':
        moveCameraTo(-0.42, 0.42, 4.5, 0.78);
        break;
      case 'wheels':
        moveCameraTo(-1.48, 0.16, 3.65, 0.42);
        break;
      case 'aero':
        moveCameraTo(2.48, 0.44, 4.4, 0.88);
        break;
      case 'exhaust':
        moveCameraTo(3.14, 0.14, 3.6, 0.36);
        break;
      case 'underglow':
        moveCameraTo(-0.85, 0.09, 4.9, 0.25);
        break;
      case 'all':
      default:
        moveCameraTo(-0.65, 0.30, 6.7, 0.62);
        break;
    }
  };

  useEffect(() => {
    if (!highlightedPart) return;
    setAutoRotate(false);
    switch (highlightedPart) {
      case 'front_bumper':
      case 'hood':
        moveCameraTo(-0.35, 0.38, 4.5, 0.68);
        break;
      case 'windshield':
      case 'roof':
        moveCameraTo(-0.65, 0.52, 5.0, 0.88);
        break;
      case 'left_door':
        moveCameraTo(-1.55, 0.24, 4.7, 0.62);
        break;
      case 'right_door':
        moveCameraTo(1.55, 0.24, 4.7, 0.62);
        break;
      case 'rear_bumper':
        moveCameraTo(3.0, 0.22, 4.4, 0.55);
        break;
      case 'spoiler':
        moveCameraTo(2.52, 0.44, 4.5, 0.88);
        break;
    }
  }, [highlightedPart]);

  // 1. Mount Three.js Renderer, Studio Softboxes, CameraControls & N8AO+Postprocessing Pipeline ONCE
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060a13);
    scene.fog = new THREE.FogExp2(0x060a13, 0.048);

    const initW = Math.max(1, container.clientWidth);
    const initH = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(35, initW / initH, 0.1, 80);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const glCtx = renderer.getContext();
    const dbgInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
    const glVendor = String(
      dbgInfo ? glCtx.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : glCtx.getParameter(glCtx.RENDERER)
    ).toLowerCase();
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(glVendor);
    isSoftwareGlRef.current = isSoftwareGl;

    // ToneMappingEffect applies ACES Filmic when EffectComposer runs; enable direct ACES only on fallback render path
    renderer.toneMapping = isSoftwareGl ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setSize(initW, initH);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const texPack = createShowroomTexturePack(renderer.capabilities.getMaxAnisotropy());
    texPackRef.current = texPack;

    const pmremGen = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGen.fromScene(roomEnv, 0.035);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGen.dispose();

    // CameraControls for silky damped orbiting, wheel zoom, pinch-zoom & inspection transitions
    const controls = new CameraControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.minDistance = 2.6;
    controls.maxDistance = 10.5;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.smoothTime = isSoftwareGl ? 0 : 0.24;
    controls.draggingSmoothTime = isSoftwareGl ? 0 : 0.12;
    controls.dollySpeed = 0.7;
    const [initCamX, initCamY, initCamZ] = sphericalLookAt(-0.65, 0.30, 6.7, 0.62);
    controls.setLookAt(initCamX, initCamY, initCamZ, 0, 0.62, 0, false);

    const onControlStart = () => {
      setAutoRotate(false);
    };
    controls.addEventListener('controlstart', onControlStart);

    // GPU-gated Post-Processing Pipeline: N8AO Contact Ambient Occlusion + Selective HDR Bloom + SMAA + Vignette + ACES
    let composer: EffectComposer | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
      composer.addPass(new RenderPass(scene, camera));

      const n8aoPass = new N8AOPostPass(scene, camera, initW, initH);
      n8aoPass.configuration.aoRadius = 0.72;
      n8aoPass.configuration.intensity = 1.6;
      n8aoPass.configuration.distanceFalloff = 0.65;
      n8aoPass.configuration.aoSamples = 8;
      n8aoPass.configuration.denoiseSamples = 4;
      n8aoPass.configuration.halfRes = true;
      composer.addPass(n8aoPass);

      const bloomEffect = new BloomEffect({
        mipmapBlur: true,
        luminanceThreshold: 1.05,
        intensity: 0.48,
      });
      const smaaEffect = new SMAAEffect();
      const vignetteEffect = new VignetteEffect({ darkness: 0.36, offset: 0.25 });
      const toneMappingEffect = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

      composer.addPass(
        new EffectPass(camera, bloomEffect, smaaEffect, vignetteEffect, toneMappingEffect)
      );
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // Studio Lighting Rig + GPU RectAreaLight Softboxes for authentic automotive clearcoat reflections
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x080d1a, 0.48);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.65);
    keyLight.position.set(4.8, 8.2, 5.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    fillLight.position.set(-6.2, 4.2, -2.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.35);
    rimLight.position.set(-1.5, 5.2, -6.5);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const overheadSoftbox = new THREE.RectAreaLight(0xf0f9ff, 3.2, 4.2, 1.6);
      overheadSoftbox.position.set(0, 4.9, 0);
      overheadSoftbox.lookAt(0, 0.5, 0);
      scene.add(overheadSoftbox);

      const coolFlank = new THREE.RectAreaLight(0xbae6fd, 2.1, 4.4, 1.1);
      coolFlank.position.set(-4.6, 2.2, 1.4);
      coolFlank.lookAt(0, 0.6, 0);
      scene.add(coolFlank);

      const warmFlank = new THREE.RectAreaLight(0xfef3c7, 1.9, 4.4, 1.1);
      warmFlank.position.set(4.6, 2.2, 1.4);
      warmFlank.lookAt(0, 0.6, 0);
      scene.add(warmFlank);
    }

    // Overhead Studio Softbox Light Bars (reflection streaks in car paint)
    const softboxBarGeo = new THREE.BoxGeometry(0.18, 0.04, 4.8);
    const softboxBarMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 1.9,
      roughness: 0.18,
    });
    for (const bx of [-1.25, 0, 1.25]) {
      const bar = new THREE.Mesh(softboxBarGeo, softboxBarMat);
      bar.position.set(bx, 5.2, 0);
      scene.add(bar);
    }

    // Architectural Textured Basalt & Telemetry Turntable Stage with Tangent-Space Normal Map
    const turntableGeo = new THREE.CylinderGeometry(3.48, 3.72, 0.18, 64);
    const turntableSideMat = new THREE.MeshStandardMaterial({
      color: 0x0b1222,
      metalness: 0.84,
      roughness: 0.24,
    });
    const turntableTopMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texPack.turntableAlbedo,
      roughnessMap: texPack.turntableRoughness,
      normalMap: texPack.turntableNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      metalness: 0.54,
      roughness: 0.42,
      envMapIntensity: 1.2,
    });
    const turntable = new THREE.Mesh(turntableGeo, [turntableSideMat, turntableTopMat, turntableSideMat]);
    turntable.position.y = -0.09;
    turntable.receiveShadow = !isSoftwareGl;
    scene.add(turntable);

    const collarGeo = new THREE.TorusGeometry(3.52, 0.042, 12, 64);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.92,
      roughness: 0.20,
      envMapIntensity: 1.4,
    });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.008;
    scene.add(collar);

    const floorApronGeo = new THREE.RingGeometry(3.7, 42, 64);
    const floorApronMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texPack.studioFloorAlbedo,
      roughnessMap: texPack.studioFloorRoughness,
      normalMap: texPack.studioFloorNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      metalness: 0.30,
      roughness: 0.70,
      envMapIntensity: 0.9,
    });
    const floorApron = new THREE.Mesh(floorApronGeo, floorApronMat);
    floorApron.rotation.x = -Math.PI / 2;
    floorApron.position.y = -0.18;
    floorApron.receiveShadow = !isSoftwareGl;
    scene.add(floorApron);

    const pillarHousingGeo = new THREE.BoxGeometry(0.16, 4.4, 0.16);
    const pillarStripGeo = new THREE.BoxGeometry(0.06, 3.8, 0.06);
    const cyanPillarMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.7,
      roughness: 0.2,
    });
    const amberPillarMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.55,
      roughness: 0.2,
    });
    for (let pi = 0; pi < 8; pi++) {
      const ang = (pi / 8) * Math.PI * 2 + 0.35;
      const dist = 7.4;
      const px = Math.cos(ang) * dist;
      const pz = Math.sin(ang) * dist;
      const housing = new THREE.Mesh(pillarHousingGeo, turntableSideMat);
      housing.position.set(px, 2.0, pz);
      housing.lookAt(0, 2.0, 0);
      scene.add(housing);

      const strip = new THREE.Mesh(pillarStripGeo, pi % 2 === 0 ? cyanPillarMat : amberPillarMat);
      strip.position.set(px * 0.985, 2.0, pz * 0.985);
      strip.lookAt(0, 2.0, 0);
      scene.add(strip);
    }

    const innerDiskGeo = new THREE.RingGeometry(2.35, 2.38, 64);
    const innerDiskMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const innerDisk = new THREE.Mesh(innerDiskGeo, innerDiskMat);
    innerDisk.rotation.x = -Math.PI / 2;
    innerDisk.position.y = 0.002;
    scene.add(innerDisk);

    const ringGeo = new THREE.RingGeometry(3.47, 3.55, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.15,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.003;
    scene.add(ring);

    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    const fxGroup = new THREE.Group();
    fxGroupRef.current = fxGroup;
    scene.add(fxGroup);

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = Math.max(1, mountRef.current.clientWidth);
      const h = Math.max(1, mountRef.current.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      composer?.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => onResize()) : null;
    resizeObserver?.observe(container);

    let frameId = 0;
    let disposed = false;
    let lastTimeMs = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl2 = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl2.fenceSync === 'function') {
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl2.deleteSync(sync);
            return;
          }
          const state = sync && gl2.getSyncParameter(sync, gl2.SYNC_STATUS);
          if (state === gl2.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl2.deleteSync(sync);
            frameId = window.setTimeout(cb, 64);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 64);
      }
    };

    const loop = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTimeMs) / 1000));
      lastTimeMs = nowMs;

      if (autoRotateRef.current) {
        controls.azimuthAngle += dt * 0.45;
      }
      controls.update(dt);

      if (isSoftwareGl || !composer) {
        renderer.render(scene, camera);
      } else {
        composer.render();
      }

      if (isSoftwareGl) {
        afterDraw(loop);
      } else {
        frameId = requestAnimationFrame(loop);
      }
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver?.disconnect();
      controls.removeEventListener('controlstart', onControlStart);
      controls.dispose();
      controlsRef.current = null;
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      window.removeEventListener('resize', onResize);
      composer?.dispose();
      texPack.dispose();
      texPackRef.current = null;
      disposeObject3D(scene);
      envTarget.dispose();
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  // 2. Rebuild Procedural Multi-Part Car Model cleanly whenever car or customization changes
  useEffect(() => {
    const carGroup = carGroupRef.current;
    const fxGroup = fxGroupRef.current;
    if (!carGroup || !fxGroup) return;

    while (carGroup.children.length > 0) {
      const ch = carGroup.children[0];
      carGroup.remove(ch);
      disposeObject3D(ch);
    }
    while (fxGroup.children.length > 0) {
      const ch = fxGroup.children[0];
      fxGroup.remove(ch);
      disposeObject3D(ch);
    }
    headlightLightsRef.current = [];
    underglowLightRef.current = null;
    exhaustFlamesRef.current = null;

    const isSoftwareGl = isSoftwareGlRef.current;
    const arch = resolveVehicleArchetype(car);
    const shape = car.bodyShape || 'coupe';
    const isMoto = shape === 'motorcycle' || shape === 'cyber_bike';
    const isFormula = shape === 'formula';
    const isTruck = shape === 'truck';
    const isSemi = shape === 'semi';
    const isVan = shape === 'van';
    const isWagon = shape === 'wagon';
    const isSupercar = shape === 'supercar' || shape === 'prototype';
    const isGt3 = shape === 'gt3';
    const isKei = shape === 'kei';
    const isRoadster = shape === 'roadster' || arch === 'classic_cobra';

    const tp = texPackRef.current;
    const bodyColor = new THREE.Color(appearance.primaryColor);
    const bodyMat = createMetallicFlakeMaterial(bodyColor, tp, 1.0);
    const scuffedBodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor.clone().multiplyScalar(0.84),
      metalness: 0.32,
      roughness: 0.66,
    });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.40 });
    const engineBlockMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.32 });
    const valveCoverMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.45, roughness: 0.40 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.18, roughness: 0.85 });
    const accentMat = createMetallicFlakeMaterial(new THREE.Color(car.accentColor || '#22d3ee'), tp, 0.85);
    const carbonFinishMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tp?.carbonAlbedo ?? null,
      bumpMap: tp?.carbonBump ?? null,
      bumpScale: 0.015,
      normalMap: tp?.carbonNormal ?? null,
      normalScale: new THREE.Vector2(0.55, 0.55),
      metalness: 0.58,
      roughness: 0.26,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
    });
    const isCarbonHood = appearance.hood === 'carbon';
    const hoodMat = isCarbonHood ? carbonFinishMat : bodyMat;
    const isCarbonRoof = appearance.roof === 'carbon_panel';
    const roofMat = isCarbonRoof ? carbonFinishMat : bodyMat;
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.55, roughness: 0.42 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(appearance.windowDarkHex || '#0f172a'),
      metalness: 0.12,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.86,
      envMapIntensity: 1.65,
    });
    const crackedGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8,
      metalness: 0.12,
      roughness: 0.58,
      transparent: true,
      opacity: 0.72,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(appearance.rimHex || '#f59e0b'),
      metalness: 0.94,
      roughness: 0.14,
      envMapIntensity: 1.5,
    });
    const rotorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tp?.rotorAlbedo ?? null,
      bumpMap: tp?.rotorBump ?? null,
      bumpScale: 0.014,
      normalMap: tp?.rotorNormal ?? null,
      normalScale: new THREE.Vector2(0.5, 0.5),
      metalness: 0.92,
      roughness: 0.24,
    });
    const caliperMat = new THREE.MeshStandardMaterial({
      color: isGt3 || isSupercar ? 0xef4444 : 0xf97316,
      metalness: 0.45,
      roughness: 0.30,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x161618,
      bumpMap: tp?.tireBump ?? null,
      bumpScale: 0.025,
      normalMap: tp?.tireNormal ?? null,
      normalScale: new THREE.Vector2(0.65, 0.65),
      metalness: 0.06,
      roughness: 0.84,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.96, roughness: 0.09, envMapIntensity: 1.55 });
    const burntTiMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness: 0.92, roughness: 0.16, envMapIntensity: 1.5 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.12, roughness: 0.72 });
    const tailCol = new THREE.Color(car.tailGlowColor || '#ef4444');
    const tailMat = new THREE.MeshStandardMaterial({
      color: tailCol,
      emissive: tailCol,
      emissiveIntensity: 2.35,
      roughness: 0.15,
    });
    const amberMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 2.0,
      roughness: 0.15,
    });

    const bodyL = isKei ? 3.25 : isSemi || arch === 'wagon_hearse' ? 4.4 : isMoto ? 2.5 : isFormula ? 4.45 : 3.95;
    const bodyW = isMoto ? 0.52 : isFormula && arch !== 'formula_canam' ? 0.82 : isSemi ? 2.05 : isKei ? 1.56 : 1.78;
    const bodyH = isSemi ? 0.95 : isTruck || isVan ? 0.68 : isSupercar ? 0.36 : isFormula ? 0.32 : 0.46;
    const yFloor = arch === 'truck_baja' || arch === 'van_overland' ? 0.42 : isSupercar || arch === 'truck_dually' ? 0.20 : 0.28;
    const yCenter = yFloor + bodyH * 0.5;

    const partGroups: Record<CarPartId, THREE.Group> = {
      front_bumper: new THREE.Group(),
      hood: new THREE.Group(),
      windshield: new THREE.Group(),
      roof: new THREE.Group(),
      left_door: new THREE.Group(),
      right_door: new THREE.Group(),
      rear_bumper: new THREE.Group(),
      spoiler: new THREE.Group(),
    };
    for (const pid of CAR_PART_IDS) {
      carGroup.add(partGroups[pid]);
    }

    const getPartMat = (pid: CarPartId, fallback: THREE.Material) => {
      const ps = damageState?.[pid];
      if (ps && !ps.detached && ps.integrity < 85 && (fallback === bodyMat || fallback === hoodMat || fallback === roofMat)) {
        return scuffedBodyMat;
      }
      if (ps && !ps.detached && ps.integrity < 85 && fallback === glassMat) {
        return crackedGlassMat;
      }
      return fallback;
    };

    const contactShadowGeo = new THREE.PlaneGeometry(isMoto ? 1.65 : 2.95, isMoto ? 3.25 : 4.95);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      map: tp?.contactShadowAlpha ?? null,
      transparent: true,
      depthWrite: false,
      opacity: tp ? 0.90 : 0.58,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.005;
    carGroup.add(contactShadow);

    const addBox = (
      w: number,
      h: number,
      l: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      rz = 0,
      partId: CarPartId | null = null
    ) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, l),
        partId ? getPartMat(partId, mat) : mat
      );
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = !isSoftwareGl;
      m.receiveShadow = !isSoftwareGl;
      (partId ? partGroups[partId] : carGroup).add(m);
      return m;
    };

    // Sculpted Lathe Tire + Multi-Spoke Alloy Wheel + Cross-Drilled Brake Rotor + Caliper + 5 Lug Nuts
    const addWheel = (x: number, y: number, z: number, rad: number, w: number, hasRim = true) => {
      const hub = new THREE.Group();
      hub.position.set(x, y, z);
      const tGeo = createSculptedTireGeometry(rad, w);
      const tMesh = new THREE.Mesh(tGeo, tireMat);
      tMesh.castShadow = !isSoftwareGl;
      hub.add(tMesh);

      if (hasRim) {
        const outerSign = x < 0 ? -1 : 1;
        const rimX = outerSign * (w * 0.44);

        // Dark wheel barrel recess behind spokes
        const barrelGeo = new THREE.CylinderGeometry(rad * 0.61, rad * 0.61, w * 0.86, 24);
        barrelGeo.rotateZ(Math.PI / 2);
        hub.add(new THREE.Mesh(barrelGeo, trimMat));

        // Cross-drilled brake rotor disc & radial Brembo caliper
        const discGeo = new THREE.CylinderGeometry(rad * 0.50, rad * 0.50, 0.025, 24);
        discGeo.rotateZ(Math.PI / 2);
        const disc = new THREE.Mesh(discGeo, rotorMat);
        disc.position.x = outerSign * (w * 0.22);
        hub.add(disc);

        const caliper = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.34, rad * 0.34, rad * 0.22),
          caliperMat
        );
        caliper.position.set(outerSign * (w * 0.24), rad * 0.16, -rad * 0.32);
        hub.add(caliper);

        // Outer polished alloy rim lip
        const lipGeo = new THREE.TorusGeometry(rad * 0.61, 0.024, 10, 28);
        lipGeo.rotateY(Math.PI / 2);
        const lip = new THREE.Mesh(lipGeo, chromeMat);
        lip.position.x = outerSign * (w * 0.47);
        hub.add(lip);

        // Rim Spokes (styled per customization.rims)
        const rimStyle = customization.rims || 'stock';
        if (rimStyle === 'turbo_fan') {
          const fanGeo = new THREE.CylinderGeometry(rad * 0.58, rad * 0.58, 0.03, 20);
          fanGeo.rotateZ(Math.PI / 2);
          const fanMesh = new THREE.Mesh(fanGeo, rimMat);
          fanMesh.position.x = rimX;
          hub.add(fanMesh);
        } else {
          const isMeshStyle = rimStyle === 'white_rally' || rimStyle === 'gold' || rimStyle === 'alloy';
          const isDeepDish = rimStyle === 'deep_dish_chrome';
          const spokeCount = isMeshStyle ? 10 : isDeepDish ? 6 : 5;
          const spokeLen = rad * 0.58;
          const spokeThick = isMeshStyle ? 0.022 : 0.036;
          for (let s = 0; s < spokeCount; s++) {
            const ang = (s / spokeCount) * Math.PI * 2;
            const spokeGeo = new THREE.BoxGeometry(0.032, spokeLen, spokeThick);
            const spoke = new THREE.Mesh(spokeGeo, rimMat);
            spoke.position.set(
              rimX,
              Math.cos(ang) * (spokeLen * 0.5),
              Math.sin(ang) * (spokeLen * 0.5)
            );
            spoke.rotation.x = ang;
            hub.add(spoke);
          }
        }

        // Center hub cap + 5 Chrome Lug Nuts
        const centerCap = new THREE.Mesh(
          new THREE.CylinderGeometry(rad * 0.16, rad * 0.16, 0.045, 16),
          rimMat
        );
        centerCap.rotation.z = Math.PI / 2;
        centerCap.position.x = rimX + outerSign * 0.01;
        hub.add(centerCap);

        const lugGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8);
        lugGeo.rotateZ(Math.PI / 2);
        for (let l = 0; l < 5; l++) {
          const lang = (l / 5) * Math.PI * 2;
          const lug = new THREE.Mesh(lugGeo, chromeMat);
          lug.position.set(
            rimX + outerSign * 0.02,
            Math.cos(lang) * rad * 0.11,
            Math.sin(lang) * rad * 0.11
          );
          hub.add(lug);
        }
      }
      carGroup.add(hub);
    };

    if (!isMoto && !isFormula) {
      addBox(bodyW * 0.78, 0.10, 0.10, steelMat, 0, yFloor + bodyH * 0.42, bodyL * 0.49);
      addBox(bodyW * 0.48, bodyH * 0.44, 0.08, rotorMat, 0, yFloor + bodyH * 0.36, bodyL * 0.47);
      addBox(bodyW * 0.38, bodyH * 0.32, bodyL * 0.22, engineBlockMat, 0, yFloor + bodyH * 0.54, bodyL * 0.27);
      addBox(bodyW * 0.12, 0.06, bodyL * 0.16, valveCoverMat, -bodyW * 0.12, yFloor + bodyH * 0.68, bodyL * 0.27);
      addBox(bodyW * 0.12, 0.06, bodyL * 0.16, valveCoverMat, bodyW * 0.12, yFloor + bodyH * 0.68, bodyL * 0.27);
      addBox(bodyW * 0.74, 0.04, 0.04, accentMat, 0, yFloor + bodyH * 0.68, bodyL * 0.22);
      addBox(bodyW * 0.66, 0.10, 0.95, interiorMat, 0, yFloor + bodyH * 0.78, -0.15);
      addBox(0.32, 0.34, 0.16, interiorMat, -bodyW * 0.20, yFloor + bodyH + 0.10, -0.26, -0.18);
      addBox(0.32, 0.34, 0.16, interiorMat, bodyW * 0.20, yFloor + bodyH + 0.10, -0.26, -0.18);
      addBox(bodyW * 0.76, 0.10, 0.10, steelMat, 0, yFloor + bodyH * 0.36, -bodyL * 0.49);
    }

    if (isMoto) {
      if (arch === 'moto_monobike') {
        addWheel(0, 0.72, 0, 0.72, 0.26, true);
        addWheel(-0.26, 0.22, 0.95, 0.22, 0.14, true);
        addWheel(0.26, 0.22, 0.95, 0.22, 0.14, true);
        addBox(0.38, 0.42, 1.15, bodyMat, 0, 0.68, 0.12, 0, 0, 'hood');
        addBox(0.26, 0.22, 0.56, glassMat, 0, 0.94, 0.62, 0.35, 0, 'windshield');
      } else {
        const rearZ = arch === 'moto_chopper' ? -1.02 : -0.82;
        const frontZ = arch === 'moto_chopper' ? 1.24 : 0.88;
        addWheel(0, 0.36, rearZ, 0.36, arch === 'moto_chopper' ? 0.30 : 0.18, arch !== 'moto_lightcycle');
        addWheel(0, 0.36, frontZ, 0.36, 0.14, arch !== 'moto_lightcycle');
        addBox(0.32, 0.36, 0.86, chromeMat, 0, 0.46, 0);
        addBox(0.05, 0.72, 0.06, chromeMat, -0.10, 0.66, frontZ - 0.16, 0.28);
        addBox(0.05, 0.72, 0.06, chromeMat, 0.10, 0.66, frontZ - 0.16, 0.28);
        addBox(0.68, 0.04, 0.04, trimMat, 0, 0.98, frontZ - 0.34);

        if (arch === 'moto_chopper') {
          addBox(0.36, 0.18, 0.62, bodyMat, 0, 0.82, 0.28, -0.22, 0, 'hood');
          addBox(0.28, 0.55, 0.08, chromeMat, 0, 0.95, -0.68, 0.20, 0, 'spoiler');
          addBox(0.84, 0.05, 0.05, chromeMat, 0, 1.20, 0.54);
          addBox(0.18, 0.06, 1.38, chromeMat, -0.20, 0.34, -0.26, 0, 0, 'left_door');
          addBox(0.18, 0.06, 1.38, chromeMat, 0.20, 0.34, -0.26, 0, 0, 'right_door');
        } else if (arch === 'moto_lightcycle') {
          addBox(0.56, 0.46, 2.1, bodyMat, 0, 0.56, 0.15, 0, 0, 'hood');
          addBox(0.42, 0.24, 1.15, glassMat, 0, 0.88, 0.42, 0.18, 0, 'windshield');
          addBox(0.52, 0.08, 0.10, accentMat, 0, 0.68, -0.88, 0, 0, 'spoiler');
        } else {
          addBox(0.34, 0.24, 0.72, bodyMat, 0, 0.78, -0.35, -0.14, 0, 'rear_bumper');
          addBox(0.44, 0.26, 0.64, bodyMat, 0, 0.88, 0.28, 0, 0, 'hood');
          addBox(0.42, 0.34, 0.64, bodyMat, 0, 0.80, 0.78, 0.25, 0, 'front_bumper');
          addBox(0.32, 0.22, 0.34, glassMat, 0, 1.05, 0.82, 0.45, 0, 'windshield');
          if (arch === 'moto_dirt') addBox(0.24, 0.05, 0.44, bodyMat, 0, 0.84, 1.04, 0, 0, 'front_bumper');
        }
        addBox(0.22, 0.07, 0.06, tailMat, 0, 0.78, rearZ - 0.14, 0, 0, 'rear_bumper');
      }
    } else if (isFormula && arch !== 'formula_canam') {
      const fwX = arch === 'formula_cigar' ? 0.94 : 1.08;
      addWheel(-fwX, 0.38, -1.35, 0.38, arch === 'formula_cigar' ? 0.22 : 0.42);
      addWheel(fwX, 0.38, -1.35, 0.38, arch === 'formula_cigar' ? 0.22 : 0.42);
      addWheel(-fwX, 0.34, 1.48, 0.34, arch === 'formula_cigar' ? 0.20 : 0.32);
      addWheel(fwX, 0.34, 1.48, 0.34, arch === 'formula_cigar' ? 0.20 : 0.32);

      const monocoqueGeo = createExtrudedProfile(
        [
          [-1.7, 0.22],
          [0.45, 0.22],
          [2.15, 0.24],
          [2.15, 0.36],
          [0.55, 0.56],
          [-1.55, 0.58],
        ],
        0.64,
        0.03
      );
      const monoMesh = new THREE.Mesh(monocoqueGeo, bodyMat);
      monoMesh.castShadow = !isSoftwareGl;
      carGroup.add(monoMesh);

      if (arch !== 'formula_cigar') {
        addBox(0.42, 0.26, 1.55, bodyMat, -0.56, 0.34, -0.25, 0, 0, 'left_door');
        addBox(0.42, 0.26, 1.55, bodyMat, 0.56, 0.34, -0.25, 0, 0, 'right_door');
        addBox(2.18, 0.06, 0.34, accentMat, 0, 0.18, 2.22, 0, 0, 'front_bumper');
        addBox(0.05, 0.22, 0.38, trimMat, -1.09, 0.26, 2.22, 0, 0, 'front_bumper');
        addBox(0.05, 0.22, 0.38, trimMat, 1.09, 0.26, 2.22, 0, 0, 'front_bumper');
        addBox(0.26, 0.32, 0.95, trimMat, 0, 0.72, -0.55, 0, 0, 'roof');
        addBox(0.10, 0.14, 0.06, tailMat, 0, 0.30, -1.78, 0, 0, 'rear_bumper');
      }
      if (arch === 'formula_fan') {
        const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 16), chromeMat);
        fan.rotation.x = Math.PI / 2;
        fan.position.set(0, 0.34, -1.78);
        partGroups.rear_bumper.add(fan);
      } else if (arch === 'formula_jet') {
        addBox(0.44, 0.28, 1.15, glassMat, 0, 0.68, 0.20, 0, 0, 'windshield');
      }
      addBox(2.0, 0.04, 0.08, trimMat, 0, 0.34, 1.48);
      addBox(2.0, 0.04, 0.08, trimMat, 0, 0.36, -1.35);
    } else {
      const wRad = isSemi || arch === 'truck_baja' || arch === 'truck_apc' ? 0.41 : 0.35;
      const trackX = bodyW * 0.5 + 0.045;
      addWheel(-trackX, wRad, bodyL * 0.34, wRad, 0.28);
      addWheel(trackX, wRad, bodyL * 0.34, wRad, 0.28);
      addWheel(-trackX, wRad, -bodyL * 0.32, wRad, 0.32);
      addWheel(trackX, wRad, -bodyL * 0.32, wRad, 0.32);
      if (arch === 'truck_apc') {
        addWheel(-trackX, wRad, 0.0, wRad, 0.30);
        addWheel(trackX, wRad, 0.0, wRad, 0.30);
      } else if (arch === 'truck_dually' || isSemi) {
        addWheel(-(trackX + 0.22), wRad, -bodyL * 0.32, wRad, 0.26);
        addWheel(trackX + 0.22, wRad, -bodyL * 0.32, wRad, 0.26);
      }

      if (arch === 'truck_cyber') {
        const cyberGeo = createExtrudedProfile(
          [
            [-bodyL * 0.5, yFloor],
            [bodyL * 0.5, yFloor],
            [bodyL * 0.5, yFloor + 0.46],
            [0.15, 1.38],
            [-bodyL * 0.5, yFloor + 0.62],
          ],
          bodyW * 0.86,
          0.02
        );
        const cyberMesh = new THREE.Mesh(cyberGeo, bodyMat);
        cyberMesh.castShadow = !isSoftwareGl;
        carGroup.add(cyberMesh);
        addBox(0.08, bodyH * 0.85, bodyL * 0.46, bodyMat, -bodyW * 0.48, yCenter, 0.05, 0, 0, 'left_door');
        addBox(0.08, bodyH * 0.85, bodyL * 0.46, bodyMat, bodyW * 0.48, yCenter, 0.05, 0, 0, 'right_door');
        addBox(bodyW * 0.88, 0.16, 1.35, glassMat, 0, 1.06, 0.42, 0.32, 0, 'windshield');
        addBox(bodyW * 0.96, 0.14, 0.16, trimMat, 0, yFloor + 0.22, bodyL * 0.5 + 0.02, 0, 0, 'front_bumper');
        addBox(bodyW * 0.94, 0.14, 0.14, trimMat, 0, yFloor + 0.26, -bodyL * 0.5 - 0.02, 0, 0, 'rear_bumper');
        addBox(bodyW * 0.94, 0.06, 0.06, tailMat, 0, yFloor + 0.56, -bodyL * 0.5 - 0.03, 0, 0, 'rear_bumper');
      } else if (isSemi) {
        addBox(bodyW * 0.86, 0.28, bodyL, trimMat, 0, 0.46, 0);
        addBox(bodyW * 0.86, 1.15, arch === 'semi_cabover' ? 2.1 : 2.35, bodyMat, 0, 1.08, arch === 'semi_cabover' ? 0.95 : 0.70);
        addBox(0.08, 0.95, 1.25, bodyMat, -bodyW * 0.48, 1.04, 0.65, 0, 0, 'left_door');
        addBox(0.08, 0.95, 1.25, bodyMat, bodyW * 0.48, 1.04, 0.65, 0, 0, 'right_door');
        addBox(bodyW * 0.90, 0.42, 1.15, glassMat, 0, 1.32, arch === 'semi_cabover' ? 1.50 : 1.05, 0, 0, 'windshield');
        addBox(bodyW * 0.92, 0.08, 1.35, roofMat, 0, 1.68, 0.72, 0, 0, 'roof');
        addBox(0.10, 1.45, 0.10, chromeMat, -bodyW * 0.52, 1.32, -0.15);
        addBox(0.10, 1.45, 0.10, chromeMat, bodyW * 0.52, 1.32, -0.15);
        addBox(bodyW * 0.86, 0.24, 0.14, chromeMat, 0, 0.44, bodyL * 0.5 + 0.04, 0, 0, 'front_bumper');
        addBox(bodyW * 0.62, 0.48, 0.06, chromeMat, 0, 0.78, bodyL * 0.5 + 0.02, 0, 0, 'hood');
      } else if (isTruck) {
        addBox(bodyW * 0.84, bodyH, bodyL, bodyMat, 0, yCenter, 0);
        addBox(0.08, bodyH * 0.92, bodyL * 0.36, bodyMat, -bodyW * 0.46, yCenter, 0.35, 0, 0, 'left_door');
        addBox(0.08, bodyH * 0.92, bodyL * 0.36, bodyMat, bodyW * 0.46, yCenter, 0.35, 0, 0, 'right_door');
        addBox(bodyW * 0.94, 0.16, 0.18, trimMat, 0, yFloor + 0.14, bodyL * 0.5 + 0.04, 0, 0, 'front_bumper');
        addBox(bodyW * 0.94, 0.16, 0.16, trimMat, 0, yFloor + 0.16, -bodyL * 0.5 - 0.04, 0, 0, 'rear_bumper');
        addBox(bodyW * 0.86, 0.05, bodyL * 0.28, hoodMat, 0, yCenter + bodyH * 0.5 + 0.02, bodyL * 0.32, 0.04, 0, 'hood');
        addBox(bodyW * 0.84, 0.56, 1.55, glassMat, 0, yCenter + bodyH * 0.5 + 0.28, 0.45, 0, 0, 'windshield');
        addBox(bodyW * 0.86, 0.06, 1.35, roofMat, 0, yCenter + bodyH * 0.5 + 0.58, 0.45, 0, 0, 'roof');
        if (arch === 'truck_baja') {
          addWheel(0, yCenter + bodyH * 0.5 + 0.15, -1.15, 0.36, 0.28, true);
        } else if (arch === 'truck_apc') {
          addBox(bodyW * 0.88, 0.48, 2.2, bodyMat, 0, yCenter + bodyH * 0.5 + 0.24, -0.65);
          addBox(0.55, 0.18, 0.55, trimMat, 0, yCenter + bodyH * 0.5 + 0.56, -0.45, 0, 0, 'roof');
        } else if (arch === 'truck_ratrod') {
          addBox(0.68, 0.64, 0.24, chromeMat, 0, yCenter + 0.08, bodyL * 0.5 + 0.05, 0, 0, 'front_bumper');
          addBox(bodyW * 0.82, 0.12, 1.65, woodMat, 0, yCenter + 0.24, -1.05);
        } else {
          addBox(bodyW * 0.82, 0.10, 1.72, trimMat, 0, yCenter + bodyH * 0.42, -1.02);
        }
      } else if (isVan || isWagon || isKei) {
        addBox(bodyW * 0.84, bodyH, bodyL, bodyMat, 0, yCenter, 0);
        addBox(0.08, bodyH * 0.92, bodyL * 0.42, bodyMat, -bodyW * 0.46, yCenter, 0.05, 0, 0, 'left_door');
        addBox(0.08, bodyH * 0.92, bodyL * 0.42, bodyMat, bodyW * 0.46, yCenter, 0.05, 0, 0, 'right_door');
        addBox(bodyW * 0.94, 0.16, 0.18, trimMat, 0, yFloor + 0.12, bodyL * 0.5 + 0.04, 0, 0, 'front_bumper');
        addBox(bodyW * 0.94, 0.16, 0.16, trimMat, 0, yFloor + 0.14, -bodyL * 0.5 - 0.04, 0, 0, 'rear_bumper');
        addBox(bodyW * 0.84, 0.04, bodyL * 0.24, hoodMat, 0, yCenter + bodyH * 0.5 + 0.02, bodyL * 0.34, 0.06, 0, 'hood');
        if (arch === 'wagon_woodie') {
          addBox(bodyW + 0.03, bodyH * 0.62, bodyL * 0.72, woodMat, 0, yCenter, -0.15);
        }
        const cabH = isVan ? 0.64 : isKei ? 0.58 : 0.46;
        const cabZ = isVan ? 0.05 : -0.35;
        const cabL = isVan ? bodyL * 0.86 : bodyL * 0.66;
        addBox(bodyW * 0.86, cabH, cabL, glassMat, 0, yCenter + bodyH * 0.5 + cabH * 0.5, cabZ, 0, 0, 'windshield');
        addBox(bodyW * 0.88, 0.05, cabL * 0.94, roofMat, 0, yCenter + bodyH * 0.5 + cabH + 0.02, cabZ, 0, 0, 'roof');
      } else {
        const noseH = isSupercar ? bodyH * 0.54 : bodyH * 0.72;
        const waistY = yFloor + bodyH * 0.96;
        const hullGeo = createExtrudedProfile(
          [
            [-bodyL * 0.48, yFloor + 0.03],
            [bodyL * 0.47, yFloor + 0.02],
            [bodyL * 0.51, yFloor + noseH * 0.45],
            [bodyL * 0.48, yFloor + noseH * 0.92],
            [bodyL * 0.22, yFloor + bodyH * 0.88],
            [bodyL * 0.05, waistY],
            [-bodyL * 0.36, waistY],
            [-bodyL * 0.49, yFloor + bodyH * 0.96],
            [-bodyL * 0.50, yFloor + bodyH * 0.38],
          ],
          bodyW * 0.88,
          0.062
        );
        const hullMesh = new THREE.Mesh(hullGeo, bodyMat);
        hullMesh.castShadow = !isSoftwareGl;
        hullMesh.receiveShadow = !isSoftwareGl;
        carGroup.add(hullMesh);

        // Sculpted Beveled Front Fascia & Recessed Radiator Grille
        const frontBumperGeo = createExtrudedProfile(
          [
            [bodyL * 0.44, yFloor + 0.03],
            [bodyL * 0.525, yFloor + 0.05],
            [bodyL * 0.515, yFloor + noseH * 0.82],
            [bodyL * 0.43, yFloor + noseH * 0.96],
          ],
          bodyW * 0.94,
          0.048
        );
        const frontBumperMesh = new THREE.Mesh(frontBumperGeo, getPartMat('front_bumper', bodyMat));
        frontBumperMesh.castShadow = !isSoftwareGl;
        partGroups.front_bumper.add(frontBumperMesh);

        // Carbon Aero Front Chin Splitter + Recessed Black Mesh Mouth
        const splitterGeo = createExtrudedProfile(
          [
            [bodyL * 0.42, yFloor],
            [bodyL * 0.555, yFloor],
            [bodyL * 0.545, yFloor + 0.042],
            [bodyL * 0.42, yFloor + 0.042],
          ],
          bodyW * 1.04,
          0.014
        );
        partGroups.front_bumper.add(new THREE.Mesh(splitterGeo, carbonFinishMat));
        if (isGt3 || isSupercar) {
          addBox(0.14, 0.028, 0.28, carbonFinishMat, -bodyW * 0.51, yFloor + 0.16, bodyL * 0.44, 0.14, 0, 'front_bumper');
          addBox(0.14, 0.028, 0.28, carbonFinishMat, bodyW * 0.51, yFloor + 0.16, bodyL * 0.44, 0.14, 0, 'front_bumper');
        }
        if (arch !== 'classic_cobra') {
          addBox(bodyW * 0.56, bodyH * 0.34, 0.06, rotorMat, 0, yFloor + bodyH * 0.28, bodyL * 0.52, 0, 0, 'front_bumper');
          addBox(bodyW * 0.58, 0.025, 0.04, chromeMat, 0, yFloor + bodyH * 0.28, bodyL * 0.535, 0, 0, 'front_bumper');
        }

        // Sculpted Side Skirts & Door Panels with Flush Chrome Handles & Aero Mirrors
        addBox(0.06, bodyH * 0.78, bodyL * 0.46, bodyMat, -bodyW * 0.495, yFloor + bodyH * 0.48, 0.02, 0, 0, 'left_door');
        addBox(0.03, 0.035, 0.16, chromeMat, -bodyW * 0.53, yFloor + bodyH * 0.74, -0.04, 0, 0, 'left_door');
        const mirrorGeoL = new THREE.CapsuleGeometry(0.042, 0.09, 6, 12);
        mirrorGeoL.rotateZ(Math.PI * 0.46);
        const mirrorL = new THREE.Mesh(mirrorGeoL, getPartMat('left_door', bodyMat));
        mirrorL.position.set(-bodyW * 0.52, yFloor + bodyH + 0.07, 0.48);
        partGroups.left_door.add(mirrorL);

        addBox(0.06, bodyH * 0.78, bodyL * 0.46, bodyMat, bodyW * 0.495, yFloor + bodyH * 0.48, 0.02, 0, 0, 'right_door');
        addBox(0.03, 0.035, 0.16, chromeMat, bodyW * 0.53, yFloor + bodyH * 0.74, -0.04, 0, 0, 'right_door');
        const mirrorR = new THREE.Mesh(mirrorGeoL, getPartMat('right_door', bodyMat));
        mirrorR.position.set(bodyW * 0.52, yFloor + bodyH + 0.07, 0.48);
        partGroups.right_door.add(mirrorR);

        // Carbon Side-Skirt Ground Effects
        addBox(bodyW * 1.06, 0.045, bodyL * 0.48, carbonFinishMat, 0, yFloor + 0.02, 0);

        // Curved Semi-Circular Fender Arches cleanly framing wheels (zero boxy steps)
        for (const fz of [bodyL * 0.34, -bodyL * 0.32]) {
          for (const side of [-1, 1]) {
            const fenderLip = new THREE.Mesh(
              new THREE.TorusGeometry(wRad + 0.055, 0.038, 10, 22, Math.PI),
              bodyMat
            );
            fenderLip.rotation.y = Math.PI / 2;
            fenderLip.position.set(side * (bodyW * 0.49), wRad + 0.01, fz);
            carGroup.add(fenderLip);
          }
        }

        if (isRoadster) {
          addBox(bodyW * 0.80, 0.28, 0.14, glassMat, 0, yCenter + bodyH * 0.5 + 0.12, 0.52, -0.45, 0, 'windshield');
          if (arch === 'classic_cobra') {
            addBox(0.38, 0.28, 0.06, chromeMat, -0.38, yCenter + bodyH * 0.5 + 0.16, -0.78);
            addBox(0.64, 0.16, 0.12, chromeMat, 0, yCenter - 0.04, bodyL * 0.5 + 0.03, 0, 0, 'front_bumper');
          }
        } else {
          const cabH = isSupercar ? 0.33 : 0.41;
          const zBack = isSupercar ? -1.24 : -1.32;
          const zRoofBack = isSupercar ? -0.58 : -0.70;
          const zRoofFront = isSupercar ? 0.42 : 0.26;
          const zWindshieldBase = isSupercar ? 1.12 : 0.90;
          const cabTopY = yFloor + bodyH + cabH;
          const greenhouseGeo = createExtrudedProfile(
            [
              [zBack, yFloor + bodyH - 0.02],
              [zWindshieldBase, yFloor + bodyH - 0.04],
              [zRoofFront, cabTopY],
              [zRoofBack, cabTopY],
            ],
            bodyW * 0.74,
            0.045
          );
          const cabMesh = new THREE.Mesh(greenhouseGeo, getPartMat('windshield', glassMat));
          partGroups.windshield.add(cabMesh);

          // Painted Body-Color A-Pillars & C-Pillars framing the glass canopy
          for (const side of [-1, 1]) {
            addBox(0.045, cabH * 1.18, 0.055, bodyMat, side * bodyW * 0.39, yFloor + bodyH + cabH * 0.46, (zWindshieldBase + zRoofFront) * 0.5, -0.78, 0, 'windshield');
            addBox(0.045, cabH * 1.12, 0.075, bodyMat, side * bodyW * 0.39, yFloor + bodyH + cabH * 0.46, (zRoofBack + zBack) * 0.5, 0.78, 0, 'windshield');
          }

          const roofGeo = createExtrudedProfile(
            [
              [zRoofBack - 0.04, cabTopY - 0.01],
              [zRoofFront + 0.04, cabTopY - 0.01],
              [zRoofFront, cabTopY + 0.042],
              [zRoofBack, cabTopY + 0.042],
            ],
            bodyW * 0.74,
            0.032
          );
          const roofCap = new THREE.Mesh(roofGeo, getPartMat('roof', roofMat));
          roofCap.castShadow = !isSoftwareGl;
          partGroups.roof.add(roofCap);

          if (shape === 'prototype') {
            addBox(0.05, 0.24, 1.05, trimMat, 0, cabTopY - 0.06, -0.92, 0, 0, 'roof');
          }

          if (customization.windows === 'clear_cage') {
            addBox(0.05, cabH * 0.9, 0.05, caliperMat, -bodyW * 0.28, cabTopY - cabH * 0.45, zRoofBack + 0.12);
            addBox(0.05, cabH * 0.9, 0.05, caliperMat, bodyW * 0.28, cabTopY - cabH * 0.45, zRoofBack + 0.12);
          }

          if (appearance.roof === 'roof_scoop') {
            addBox(0.32, 0.14, 0.52, carbonFinishMat, 0, cabTopY + 0.09, (zRoofFront + zRoofBack) * 0.5, 0, 0, 'roof');
          } else if (appearance.roof === 'light_bar' || appearance.roof === 'siren_strobe') {
            addBox(bodyW * 0.62, 0.09, 0.16, tailMat, -bodyW * 0.16, cabTopY + 0.07, 0.06, 0, 0, 'roof');
            addBox(bodyW * 0.62, 0.09, 0.16, amberMat, bodyW * 0.16, cabTopY + 0.07, 0.06, 0, 0, 'roof');
          } else if (appearance.roof === 'roof_cargo_box') {
            addBox(0.58, 0.22, 0.92, trimMat, 0, cabTopY + 0.13, -0.18, 0, 0, 'roof');
          }
        }
        // Flush Beveled Hood Panel (aligned cleanly with front nose slope)
        const hoodPanelGeo = createExtrudedProfile(
          [
            [bodyL * 0.18, yFloor + bodyH * 0.88],
            [bodyL * 0.48, yFloor + noseH * 0.91],
            [bodyL * 0.47, yFloor + noseH * 0.96],
            [bodyL * 0.18, yFloor + bodyH * 0.94],
          ],
          bodyW * 0.80,
          0.028
        );
        const hoodPanel = new THREE.Mesh(hoodPanelGeo, getPartMat('hood', hoodMat));
        hoodPanel.castShadow = !isSoftwareGl;
        partGroups.hood.add(hoodPanel);
      }

      if (arch !== 'truck_cyber') {
        addBox(bodyW * 0.96, bodyH * 0.72, 0.20, bodyMat, 0, yFloor + bodyH * 0.42, -bodyL * 0.46, 0, 0, 'rear_bumper');
        addBox(bodyW * 0.80, 0.04, 0.26, carbonFinishMat, 0, yFloor + 0.02, -bodyL * 0.48, 0, 0, 'rear_bumper');
        for (const dfx of [-0.36, -0.14, 0.14, 0.36]) {
          addBox(0.04, 0.18, 0.16, trimMat, dfx, yFloor + 0.06, -bodyL * 0.5 - 0.02, 0, 0, 'rear_bumper');
        }
        if (isSupercar || isRoadster) {
          addBox(bodyW * 0.88, 0.07, 0.05, tailMat, 0, yFloor + bodyH * 0.72, -bodyL * 0.5 - 0.02, 0, 0, 'rear_bumper');
        } else {
          addBox(bodyW * 0.28, 0.10, 0.05, tailMat, -bodyW * 0.32, yFloor + bodyH * 0.72, -bodyL * 0.5 - 0.02, 0, 0, 'rear_bumper');
          addBox(bodyW * 0.28, 0.10, 0.05, tailMat, bodyW * 0.32, yFloor + bodyH * 0.72, -bodyL * 0.5 - 0.02, 0, 0, 'rear_bumper');
        }
      }

      if (appearance.hood === 'blower' && !isVan) {
        addBox(0.42, 0.28, 0.44, chromeMat, 0, yFloor + bodyH + 0.08, bodyL * 0.24, 0, 0, 'hood');
      }

      if (appearance.spoilerStyle !== 'lip' && arch !== 'formula_cigar' && arch !== 'supercar_streamliner') {
        const wingW = bodyW * 1.08;
        const isHighWing =
          appearance.spoilerStyle === 'gt' ||
          appearance.spoilerStyle === 'cyber' ||
          appearance.spoilerStyle === 'active' ||
          appearance.spoilerStyle === 'f1_giant';
        const wingH = isHighWing ? 0.44 : 0.18;
        const wingZ = -bodyL * 0.5 + 0.08;
        addBox(0.05, 0.05, 0.14, trimMat, -0.46, yFloor + bodyH + 0.02, wingZ);
        addBox(0.05, 0.05, 0.14, trimMat, 0.46, yFloor + bodyH + 0.02, wingZ);
        addBox(0.04, wingH, 0.14, trimMat, -0.46, yFloor + bodyH + wingH * 0.5, wingZ, 0, 0, 'spoiler');
        addBox(0.04, wingH, 0.14, trimMat, 0.46, yFloor + bodyH + wingH * 0.5, wingZ, 0, 0, 'spoiler');
        const blade = addBox(wingW, 0.05, 0.34, carbonFinishMat, 0, yFloor + bodyH + wingH, wingZ, -0.08, 0, 'spoiler');
        blade.castShadow = !isSoftwareGl;
        addBox(0.04, 0.22, 0.40, accentMat, -wingW * 0.5, yFloor + bodyH + wingH, wingZ, 0, 0, 'spoiler');
        addBox(0.04, 0.22, 0.40, accentMat, wingW * 0.5, yFloor + bodyH + wingH, wingZ, 0, 0, 'spoiler');
      } else {
        addBox(bodyW * 0.92, 0.06, 0.14, accentMat, 0, yFloor + bodyH + 0.03, -bodyL * 0.46, -0.18, 0, 'spoiler');
      }
    }

    if (damageState) {
      for (const pid of CAR_PART_IDS) {
        const ps = damageState[pid];
        const pg = partGroups[pid];
        if (!ps || !pg) continue;

        if (ps.detached || ps.integrity <= 0) {
          pg.visible = false;
          continue;
        }
        pg.visible = true;

        if (ps.integrity < 90) {
          const dmgFrac = (100 - ps.integrity) / 100;
          const b = ps.bendAngle || 0.4;
          switch (pid) {
            case 'front_bumper':
              pg.position.set(b * dmgFrac * 0.06, -dmgFrac * 0.14, dmgFrac * 0.05);
              pg.rotation.set(dmgFrac * 0.14, b * dmgFrac * 0.16, b * dmgFrac * 0.26);
              break;
            case 'rear_bumper':
              pg.position.set(b * dmgFrac * 0.05, -dmgFrac * 0.13, -dmgFrac * 0.05);
              pg.rotation.set(-dmgFrac * 0.12, b * dmgFrac * 0.14, b * dmgFrac * 0.24);
              break;
            case 'hood':
              pg.position.set(0, dmgFrac * 0.12, -dmgFrac * 0.04);
              pg.rotation.set(-dmgFrac * 0.24, 0, b * dmgFrac * 0.12);
              break;
            case 'roof':
              pg.position.set(b * dmgFrac * 0.04, -dmgFrac * 0.08, 0);
              pg.rotation.set(dmgFrac * 0.08, b * dmgFrac * 0.06, b * dmgFrac * 0.16);
              break;
            case 'windshield':
              pg.position.set(0, -dmgFrac * 0.04, 0);
              pg.rotation.set(dmgFrac * 0.08, 0, b * dmgFrac * 0.10);
              break;
            case 'left_door':
              pg.position.set(dmgFrac * 0.09, -dmgFrac * 0.02, 0);
              pg.rotation.set(0, b * dmgFrac * 0.18, b * dmgFrac * 0.10);
              break;
            case 'right_door':
              pg.position.set(-dmgFrac * 0.09, -dmgFrac * 0.02, 0);
              pg.rotation.set(0, b * dmgFrac * 0.18, b * dmgFrac * 0.10);
              break;
            case 'spoiler':
              pg.position.set(b * dmgFrac * 0.06, -dmgFrac * 0.08, 0);
              pg.rotation.set(-dmgFrac * 0.16, b * dmgFrac * 0.12, b * dmgFrac * 0.34);
              break;
          }
        }
      }
    }

    const exhaustGroup = new THREE.Group();
    exhaustFlamesRef.current = exhaustGroup;
    carGroup.add(exhaustGroup);

    if (!isMoto) {
      const pipeGeo = createExhaustTipGeometry(0.066, 0.28);
      const isTi = appearance.exhaust === 'quad_ti';

      [-0.38, -0.22, 0.22, 0.38].forEach((px, i) => {
        const isQuad = appearance.exhaust === 'quad_ti' || appearance.exhaust === 'center_tri';
        if (!isQuad && (i === 0 || i === 3)) return;

        const pipe = new THREE.Mesh(pipeGeo, isTi ? burntTiMat : chromeMat);
        pipe.position.set(px, yFloor + 0.08, -bodyL * 0.5 - 0.04);
        carGroup.add(pipe);

        const flameGeo = new THREE.ConeGeometry(0.11, 0.62, 10);
        flameGeo.rotateX(-Math.PI / 2);
        const flameMat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xf97316 : 0x06b6d4,
          transparent: true,
          opacity: 0,
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(px, yFloor + 0.08, -bodyL * 0.5 - 0.4);
        exhaustGroup.add(flame);
      });
    }

    const lensCol = new THREE.Color(appearance.headlightLensHex || '#ffffff');
    const lightLensMat = new THREE.MeshStandardMaterial({
      color: lensCol,
      emissive: lensCol,
      emissiveIntensity: 2.6,
      roughness: 0.08,
    });
    const projectorDomeGeo = new THREE.SphereGeometry(0.036, 12, 12);
    const hlXs = isMoto ? [0] : [-bodyW * 0.35, bodyW * 0.35];
    const hlZ = isMoto || isFormula ? bodyL * 0.5 : bodyL * 0.532;
    const hlY = isMoto || isFormula ? yCenter + 0.02 : yFloor + bodyH * 0.54;
    hlXs.forEach((lx) => {
      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(isMoto ? 0.22 : 0.30, 0.11, 0.06),
        trimMat
      );
      bezel.position.set(lx, hlY, hlZ - 0.006);
      carGroup.add(bezel);

      const projector = new THREE.Mesh(projectorDomeGeo, lightLensMat);
      projector.scale.set(1.2, 0.9, 0.7);
      projector.position.set(lx, hlY, hlZ + 0.012);
      carGroup.add(projector);

      const outerCover = new THREE.Mesh(
        new THREE.BoxGeometry(isMoto ? 0.19 : 0.26, 0.085, 0.024),
        glassMat
      );
      outerCover.position.set(lx, hlY, hlZ + 0.026);
      carGroup.add(outerCover);

      if (!isMoto) {
        const drlBrow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.065), lightLensMat);
        drlBrow.position.set(lx, hlY + 0.062, hlZ + 0.008);
        drlBrow.rotation.z = lx < 0 ? -0.06 : 0.06;
        carGroup.add(drlBrow);
      }

      const spot = new THREE.SpotLight(0xfffbeb, 0, 14, Math.PI / 4, 0.4);
      spot.position.set(lx, hlY, hlZ + 0.1);
      spot.target.position.set(lx, hlY - 0.1, hlZ + 4);
      fxGroup.add(spot);
      fxGroup.add(spot.target);
      headlightLightsRef.current.push(spot);
    });

    if (appearance.underglowHex) {
      const glowColor = new THREE.Color(appearance.underglowHex);
      const underLight = new THREE.PointLight(glowColor, 3.2, 3.8);
      underLight.position.set(0, 0.14, 0);
      fxGroup.add(underLight);
      underglowLightRef.current = underLight;

      const underPlaneGeo = new THREE.PlaneGeometry(bodyW * 1.65, bodyL * 1.22);
      const underPlaneMat = new THREE.MeshBasicMaterial({
        color: glowColor,
        map: tp?.contactShadowAlpha ?? null,
        transparent: true,
        depthWrite: false,
        opacity: 0.58,
      });
      const underPlane = new THREE.Mesh(underPlaneGeo, underPlaneMat);
      underPlane.rotation.x = -Math.PI / 2;
      underPlane.position.y = 0.006;
      fxGroup.add(underPlane);
    }
  }, [car, appearance, customization, getDamageVisualCacheKey(damageState)]);

  useEffect(() => {
    headlightLightsRef.current.forEach((spot) => {
      spot.intensity = isFlashing ? 12 : 0;
    });

    if (exhaustFlamesRef.current) {
      exhaustFlamesRef.current.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = isRevving ? 0.95 : 0;
      });
    }
  }, [isFlashing, isRevving]);

  return (
    <div className="relative w-full flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
      <div
        ref={mountRef}
        className="relative w-full h-56 sm:h-64 cursor-grab active:cursor-grabbing touch-none select-none"
        title="Drag or swipe to spin 360°"
      >
        {contextLost && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 text-xs font-mono text-slate-300">
            Restoring 3D Showroom...
          </div>
        )}
      </div>

      <div className="p-2.5 bg-slate-900/95 border-t border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-cyan-400 font-bold truncate">
            3D WEBGL SHOWROOM · STUDIO PBR
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setAutoRotate((prev) => !prev)}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                autoRotate
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              <span>{autoRotate ? 'Pause Spin' : '360° Spin'}</span>
            </button>
            <button
              type="button"
              onClick={() => setInspectionMode('all')}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono font-semibold transition-colors whitespace-nowrap"
            >
              Reset View
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none snap-x py-0.5 touch-pan-x">
          {(
            [
              ['all', 'All Angles'],
              ['hood', 'Hood'],
              ['wheels', 'Wheels'],
              ['aero', 'Aero'],
              ['exhaust', 'Exhaust'],
              ['underglow', 'Underglow'],
            ] as const
          ).map(([targetKey, targetLabel]) => {
            const active = activeInspect === targetKey;
            return (
              <button
                key={targetKey}
                type="button"
                onClick={() => setInspectionMode(targetKey)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all snap-start shrink-0 whitespace-nowrap ${
                  active
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {targetLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
