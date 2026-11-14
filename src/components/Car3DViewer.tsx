import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CarCustomization, CarSpec, resolveCarAppearance } from '../game/rules';
import { resolveVehicleArchetype } from '../game/pixelSprites';
import { CarDamageState, CarPartId, CAR_PART_IDS, getDamageVisualCacheKey } from '../game/damage';

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
  bevel = 0.025
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
    bevelSegments: 2,
    steps: 1,
  });
  // Extrude runs along +Z with profile in X-Y; rotate so profile Z-Y maps to car length Z & height Y, extruded along X centered at 0
  geo.translate(0, 0, -width * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
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

  const stateRef = useRef({
    yaw: -0.65,
    pitch: 0.30,
    targetYaw: -0.65,
    targetPitch: 0.30,
    distance: 6.8,
    targetDistance: 6.8,
    targetCenterY: 0.62,
    centerY: 0.62,
    isDragging: false,
    prevPointerX: 0,
    prevPointerY: 0,
    autoRotate: true,
  });

  stateRef.current.autoRotate = autoRotate;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);
  const fxGroupRef = useRef<THREE.Group | null>(null);
  const exhaustFlamesRef = useRef<THREE.Group | null>(null);
  const headlightLightsRef = useRef<THREE.SpotLight[]>([]);
  const underglowLightRef = useRef<THREE.PointLight | null>(null);
  const isSoftwareGlRef = useRef<boolean>(false);

  const setInspectionMode = (target: InspectTarget) => {
    setActiveInspect(target);
    onInspectTargetChange?.(target);
    setAutoRotate(false);

    const s = stateRef.current;
    switch (target) {
      case 'hood':
        s.targetYaw = -0.42;
        s.targetPitch = 0.42;
        s.targetDistance = 4.6;
        s.targetCenterY = 0.80;
        break;
      case 'wheels':
        s.targetYaw = -1.48;
        s.targetPitch = 0.16;
        s.targetDistance = 3.8;
        s.targetCenterY = 0.42;
        break;
      case 'aero':
        s.targetYaw = 2.48;
        s.targetPitch = 0.44;
        s.targetDistance = 4.5;
        s.targetCenterY = 0.88;
        break;
      case 'exhaust':
        s.targetYaw = 3.14;
        s.targetPitch = 0.14;
        s.targetDistance = 3.7;
        s.targetCenterY = 0.36;
        break;
      case 'underglow':
        s.targetYaw = -0.85;
        s.targetPitch = 0.08;
        s.targetDistance = 5.0;
        s.targetCenterY = 0.25;
        break;
      case 'all':
      default:
        s.targetYaw = -0.65;
        s.targetPitch = 0.30;
        s.targetDistance = 6.8;
        s.targetCenterY = 0.62;
        break;
    }
  };

  useEffect(() => {
    if (!highlightedPart) return;
    setAutoRotate(false);
    const s = stateRef.current;
    switch (highlightedPart) {
      case 'front_bumper':
      case 'hood':
        s.targetYaw = -0.35;
        s.targetPitch = 0.38;
        s.targetDistance = 4.6;
        s.targetCenterY = 0.68;
        break;
      case 'windshield':
      case 'roof':
        s.targetYaw = -0.65;
        s.targetPitch = 0.52;
        s.targetDistance = 5.1;
        s.targetCenterY = 0.88;
        break;
      case 'left_door':
        s.targetYaw = -1.55;
        s.targetPitch = 0.24;
        s.targetDistance = 4.8;
        s.targetCenterY = 0.62;
        break;
      case 'right_door':
        s.targetYaw = 1.55;
        s.targetPitch = 0.24;
        s.targetDistance = 4.8;
        s.targetCenterY = 0.62;
        break;
      case 'rear_bumper':
        s.targetYaw = 3.0;
        s.targetPitch = 0.22;
        s.targetDistance = 4.5;
        s.targetCenterY = 0.55;
        break;
      case 'spoiler':
        s.targetYaw = 2.52;
        s.targetPitch = 0.44;
        s.targetDistance = 4.6;
        s.targetCenterY = 0.88;
        break;
    }
  }, [highlightedPart]);

  // 1. Mount Three.js Renderer, Studio Lighting Rig & Turntable ONCE
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x090e1a);
    scene.fog = new THREE.FogExp2(0x090e1a, 0.032);

    const camera = new THREE.PerspectiveCamera(
      36,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      80
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const glCtx = renderer.getContext();
    const dbgInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
    const glVendor = String(
      dbgInfo ? glCtx.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : glCtx.getParameter(glCtx.RENDERER)
    ).toLowerCase();
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(glVendor);
    isSoftwareGlRef.current = isSoftwareGl;

    renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmremGen = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGen.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGen.dispose();

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

    // 3-Point Warm/Cool Automotive Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(5, 8.5, 5.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.05);
    fillLight.position.set(-6, 4.5, -3.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.15);
    rimLight.position.set(0, 5.5, -6.5);
    scene.add(rimLight);

    // Architectural Turntable Stage
    const turntableGeo = new THREE.CylinderGeometry(3.45, 3.65, 0.16, 48);
    const turntableMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.78,
      roughness: 0.28,
    });
    const turntable = new THREE.Mesh(turntableGeo, turntableMat);
    turntable.position.y = -0.08;
    turntable.receiveShadow = !isSoftwareGl;
    scene.add(turntable);

    const innerDiskGeo = new THREE.RingGeometry(2.35, 2.38, 48);
    const innerDiskMat = new THREE.MeshBasicMaterial({
      color: 0x334155,
      side: THREE.DoubleSide,
    });
    const innerDisk = new THREE.Mesh(innerDiskGeo, innerDiskMat);
    innerDisk.rotation.x = -Math.PI / 2;
    innerDisk.position.y = 0.002;
    scene.add(innerDisk);

    const ringGeo = new THREE.RingGeometry(3.48, 3.55, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
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

    const onPointerDown = (e: PointerEvent) => {
      stateRef.current.isDragging = true;
      stateRef.current.prevPointerX = e.clientX;
      stateRef.current.prevPointerY = e.clientY;
      setAutoRotate(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!stateRef.current.isDragging) return;
      const dx = e.clientX - stateRef.current.prevPointerX;
      const dy = e.clientY - stateRef.current.prevPointerY;
      stateRef.current.prevPointerX = e.clientX;
      stateRef.current.prevPointerY = e.clientY;

      stateRef.current.targetYaw += dx * 0.008;
      stateRef.current.targetPitch = Math.max(
        0.05,
        Math.min(1.18, stateRef.current.targetPitch - dy * 0.007)
      );
    };

    const onPointerUp = () => {
      stateRef.current.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stateRef.current.targetDistance = Math.max(
        3.0,
        Math.min(10.5, stateRef.current.targetDistance + e.deltaY * 0.005)
      );
    };

    let initialPinchDist = 0;
    let initialTargetDist = 6.8;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        stateRef.current.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
        initialTargetDist = stateRef.current.targetDistance;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const ratio = initialPinchDist / Math.max(10, currentDist);
        stateRef.current.targetDistance = Math.max(
          2.8,
          Math.min(11.0, initialTargetDist * ratio)
        );
      }
    };

    const onTouchEnd = () => {
      initialPinchDist = 0;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = Math.max(1, mountRef.current.clientWidth);
      const h = Math.max(1, mountRef.current.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => onResize()) : null;
    resizeObserver?.observe(container);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

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
      const dt = Math.min(0.05, clock.getDelta());
      const s = stateRef.current;

      if (s.autoRotate && !s.isDragging) {
        s.targetYaw += dt * 0.55;
      }

      const k = 1 - Math.exp(-9 * dt);
      s.yaw += (s.targetYaw - s.yaw) * k;
      s.pitch += (s.targetPitch - s.pitch) * k;
      s.distance += (s.targetDistance - s.distance) * k;
      s.centerY += (s.targetCenterY - s.centerY) * k;

      const camX = Math.sin(s.yaw) * Math.cos(s.pitch) * s.distance;
      const camY = Math.sin(s.pitch) * s.distance + s.centerY;
      const camZ = Math.cos(s.yaw) * Math.cos(s.pitch) * s.distance;

      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, s.centerY, 0);

      renderer.render(scene, camera);

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
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
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

    const bodyColor = new THREE.Color(appearance.primaryColor);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.72,
      roughness: 0.24,
    });
    const scuffedBodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor.clone().multiplyScalar(0.84),
      metalness: 0.32,
      roughness: 0.66,
    });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.82, roughness: 0.44 });
    const engineBlockMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.35 });
    const valveCoverMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.45, roughness: 0.42 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.18, roughness: 0.85 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(car.accentColor || '#22d3ee'),
      metalness: 0.65,
      roughness: 0.28,
    });
    const isCarbonHood = appearance.hood === 'carbon';
    const hoodMat = isCarbonHood
      ? new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.35 })
      : bodyMat;
    const isCarbonRoof = appearance.roof === 'carbon_panel';
    const roofMat = isCarbonRoof
      ? new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.35 })
      : bodyMat;
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.55, roughness: 0.45 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(appearance.windowDarkHex || '#0f172a'),
      metalness: 0.15,
      roughness: 0.08,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.84,
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
      metalness: 0.92,
      roughness: 0.18,
    });
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.28 });
    const caliperMat = new THREE.MeshStandardMaterial({
      color: isGt3 || isSupercar ? 0xef4444 : 0xf97316,
      metalness: 0.45,
      roughness: 0.32,
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x171717, metalness: 0.08, roughness: 0.88 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.12 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.12, roughness: 0.72 });
    const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(car.tailGlowColor || '#ef4444') });
    const amberMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    const bodyL = isKei ? 3.25 : isSemi || arch === 'wagon_hearse' ? 4.4 : isMoto ? 2.5 : isFormula ? 4.45 : 3.95;
    const bodyW = isMoto ? 0.52 : isFormula && arch !== 'formula_canam' ? 0.82 : isSemi ? 2.05 : isKei ? 1.56 : 1.78;
    const bodyH = isSemi ? 0.95 : isTruck || isVan ? 0.68 : isSupercar ? 0.36 : isFormula ? 0.32 : 0.46;
    const yFloor = arch === 'truck_baja' || arch === 'van_overland' ? 0.42 : isSupercar || arch === 'truck_dually' ? 0.20 : 0.28;
    const yCenter = yFloor + bodyH * 0.5;

    // Create 8 modular detachable/bendable part groups anchored to carGroup
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

    // Ground contact shadow disc
    const contactShadowGeo = new THREE.CircleGeometry(isMoto ? 1.25 : 2.35, 32);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      depthWrite: false,
      opacity: 0.58,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.scale.set(isMoto ? 0.45 : 0.62, isMoto ? 1.2 : 1.15, 1);
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

    const addWheel = (x: number, y: number, z: number, rad: number, w: number, hasRim = true) => {
      const hub = new THREE.Group();
      hub.position.set(x, y, z);
      const tGeo = new THREE.CylinderGeometry(rad, rad, w, 22);
      tGeo.rotateZ(Math.PI / 2);
      const tMesh = new THREE.Mesh(tGeo, tireMat);
      tMesh.castShadow = !isSoftwareGl;
      hub.add(tMesh);

      if (hasRim) {
        const discGeo = new THREE.CylinderGeometry(rad * 0.52, rad * 0.52, w * 0.72, 16);
        discGeo.rotateZ(Math.PI / 2);
        hub.add(new THREE.Mesh(discGeo, rotorMat));

        const caliper = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.82, rad * 0.34, rad * 0.24),
          caliperMat
        );
        caliper.position.set(0, rad * 0.16, -rad * 0.34);
        hub.add(caliper);

        const rGeo = new THREE.CylinderGeometry(rad * 0.63, rad * 0.63, w + 0.014, 14);
        rGeo.rotateZ(Math.PI / 2);
        hub.add(new THREE.Mesh(rGeo, rimMat));

        const outerSign = x < 0 ? -1 : 1;
        const centerNut = new THREE.Mesh(
          new THREE.CylinderGeometry(rad * 0.13, rad * 0.13, 0.04, 10),
          caliperMat
        );
        centerNut.rotation.z = Math.PI / 2;
        centerNut.position.x = outerSign * (w * 0.5 + 0.01);
        hub.add(centerNut);
      }
      carGroup.add(hub);
    };

    // Internal Chassis & Engine Bay Details (revealed when hood, bumpers, doors, roof, or spoiler detach!)
    if (!isMoto && !isFormula) {
      // Exposed front steel crash bar + radiator core
      addBox(bodyW * 0.78, 0.10, 0.10, steelMat, 0, yFloor + bodyH * 0.42, bodyL * 0.49);
      addBox(bodyW * 0.48, bodyH * 0.44, 0.08, rotorMat, 0, yFloor + bodyH * 0.36, bodyL * 0.47);
      // Exposed engine block + twin valve covers + strut brace inside engine bay
      addBox(bodyW * 0.38, bodyH * 0.36, bodyL * 0.22, engineBlockMat, 0, yFloor + bodyH * 0.68, bodyL * 0.27);
      addBox(bodyW * 0.12, 0.07, bodyL * 0.18, valveCoverMat, -bodyW * 0.12, yFloor + bodyH * 0.84, bodyL * 0.27);
      addBox(bodyW * 0.12, 0.07, bodyL * 0.18, valveCoverMat, bodyW * 0.12, yFloor + bodyH * 0.84, bodyL * 0.27);
      addBox(bodyW * 0.74, 0.04, 0.04, accentMat, 0, yFloor + bodyH * 0.84, bodyL * 0.22);
      // Exposed cabin tub & bucket seats (visible if doors, windshield, or roof detach)
      addBox(bodyW * 0.66, 0.10, 0.95, interiorMat, 0, yFloor + bodyH * 0.78, -0.15);
      addBox(0.32, 0.34, 0.16, interiorMat, -bodyW * 0.20, yFloor + bodyH + 0.10, -0.26, -0.18);
      addBox(0.32, 0.34, 0.16, interiorMat, bodyW * 0.20, yFloor + bodyH + 0.10, -0.26, -0.18);
      // Exposed rear steel crash beam
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
      const wRad = isSemi || arch === 'truck_baja' || arch === 'truck_apc' ? 0.41 : 0.34;
      const trackX = bodyW * 0.5 + 0.02;
      addWheel(-trackX, wRad, bodyL * 0.34, wRad, 0.26);
      addWheel(trackX, wRad, bodyL * 0.34, wRad, 0.26);
      addWheel(-trackX, wRad, -bodyL * 0.32, wRad, 0.30);
      addWheel(trackX, wRad, -bodyL * 0.32, wRad, 0.30);
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
        // Core monocoque inner tub (slightly narrower so doors & front/rear bumpers cleanly mount on top!)
        const noseH = isSupercar ? bodyH * 0.68 : bodyH * 0.84;
        const hullGeo = createExtrudedProfile(
          [
            [-bodyL * 0.46, yFloor],
            [bodyL * 0.46, yFloor],
            [bodyL * 0.46, yFloor + noseH],
            [bodyL * 0.16, yFloor + bodyH * 0.92],
            [-bodyL * 0.46, yFloor + bodyH],
          ],
          bodyW * 0.82,
          0.022
        );
        const hullMesh = new THREE.Mesh(hullGeo, bodyMat);
        hullMesh.castShadow = !isSoftwareGl;
        hullMesh.receiveShadow = !isSoftwareGl;
        carGroup.add(hullMesh);

        // Detachable Front Bumper + Carbon Splitter + Titanium Struts + Canards
        addBox(bodyW * 1.0, bodyH * 0.84, 0.24, bodyMat, 0, yFloor + noseH * 0.5, bodyL * 0.46, 0, 0, 'front_bumper');
        addBox(bodyW * 1.06, 0.05, 0.42, trimMat, 0, yFloor + 0.02, bodyL * 0.5 + 0.12, 0, 0, 'front_bumper');
        addBox(0.03, 0.18, 0.03, chromeMat, -bodyW * 0.24, yFloor + 0.12, bodyL * 0.5 + 0.18, 0, 0, 'front_bumper');
        addBox(0.03, 0.18, 0.03, chromeMat, bodyW * 0.24, yFloor + 0.12, bodyL * 0.5 + 0.18, 0, 0, 'front_bumper');
        if (isGt3 || isSupercar) {
          addBox(0.14, 0.03, 0.28, trimMat, -bodyW * 0.52, yFloor + 0.18, bodyL * 0.42, 0.14, 0, 'front_bumper');
          addBox(0.14, 0.03, 0.28, trimMat, bodyW * 0.52, yFloor + 0.18, bodyL * 0.42, 0.14, 0, 'front_bumper');
        }
        if (arch !== 'classic_cobra') {
          addBox(bodyW * 0.52, bodyH * 0.42, 0.08, rotorMat, 0, yFloor + bodyH * 0.34, bodyL * 0.5 + 0.02, 0, 0, 'front_bumper');
        }

        // Detachable Left & Right Doors + Door Handles + Side Mirrors
        addBox(0.09, bodyH * 0.90, bodyL * 0.44, bodyMat, -bodyW * 0.46, yFloor + bodyH * 0.50, 0.04, 0, 0, 'left_door');
        addBox(0.04, 0.05, 0.18, chromeMat, -bodyW * 0.51, yFloor + bodyH * 0.78, 0.06, 0, 0, 'left_door');
        addBox(0.16, 0.09, 0.12, bodyMat, -bodyW * 0.49, yFloor + bodyH + 0.09, 0.52, 0, 0, 'left_door');

        addBox(0.09, bodyH * 0.90, bodyL * 0.44, bodyMat, bodyW * 0.46, yFloor + bodyH * 0.50, 0.04, 0, 0, 'right_door');
        addBox(0.04, 0.05, 0.18, chromeMat, bodyW * 0.51, yFloor + bodyH * 0.78, 0.06, 0, 0, 'right_door');
        addBox(0.16, 0.09, 0.12, bodyMat, bodyW * 0.49, yFloor + bodyH + 0.09, 0.52, 0, 0, 'right_door');

        // Side Skirts on main sill
        addBox(bodyW * 1.0, 0.06, bodyL * 0.56, trimMat, 0, yFloor + 0.03, 0);

        if (isRoadster) {
          addBox(bodyW * 0.80, 0.28, 0.14, glassMat, 0, yCenter + bodyH * 0.5 + 0.12, 0.52, -0.45, 0, 'windshield');
          if (arch === 'classic_cobra') {
            addBox(0.38, 0.28, 0.06, chromeMat, -0.38, yCenter + bodyH * 0.5 + 0.16, -0.78);
            addBox(0.64, 0.16, 0.12, chromeMat, 0, yCenter - 0.04, bodyL * 0.5 + 0.03, 0, 0, 'front_bumper');
          }
        } else {
          const cabH = isSupercar ? 0.35 : 0.44;
          const zBack = isSupercar ? -1.18 : -1.28;
          const zRoofBack = isSupercar ? -0.58 : -0.68;
          const zRoofFront = isSupercar ? 0.45 : 0.28;
          const zWindshieldBase = isSupercar ? 1.08 : 0.88;
          const cabTopY = yFloor + bodyH + cabH;
          const greenhouseGeo = createExtrudedProfile(
            [
              [zBack, yFloor + bodyH - 0.02],
              [zWindshieldBase, yFloor + bodyH - 0.04],
              [zRoofFront, cabTopY],
              [zRoofBack, cabTopY],
            ],
            bodyW * 0.78,
            0.02
          );
          const cabMesh = new THREE.Mesh(greenhouseGeo, getPartMat('windshield', glassMat));
          partGroups.windshield.add(cabMesh);

          const roofCap = addBox(
            bodyW * 0.76,
            0.04,
            zRoofFront - zRoofBack,
            roofMat,
            0,
            cabTopY + 0.015,
            (zRoofFront + zRoofBack) * 0.5,
            0,
            0,
            'roof'
          );
          roofCap.castShadow = !isSoftwareGl;

          if (shape === 'prototype') {
            addBox(0.05, 0.24, 1.05, trimMat, 0, cabTopY - 0.06, -0.92, 0, 0, 'roof');
          }

          if (customization.windows === 'clear_cage') {
            addBox(0.05, cabH * 0.9, 0.05, caliperMat, -bodyW * 0.28, cabTopY - cabH * 0.45, zRoofBack + 0.12);
            addBox(0.05, cabH * 0.9, 0.05, caliperMat, bodyW * 0.28, cabTopY - cabH * 0.45, zRoofBack + 0.12);
          }

          if (appearance.roof === 'roof_scoop') {
            addBox(0.32, 0.14, 0.52, trimMat, 0, cabTopY + 0.09, (zRoofFront + zRoofBack) * 0.5, 0, 0, 'roof');
          } else if (appearance.roof === 'light_bar' || appearance.roof === 'siren_strobe') {
            addBox(bodyW * 0.62, 0.09, 0.16, tailMat, -bodyW * 0.16, cabTopY + 0.07, 0.06, 0, 0, 'roof');
            addBox(bodyW * 0.62, 0.09, 0.16, amberMat, bodyW * 0.16, cabTopY + 0.07, 0.06, 0, 0, 'roof');
          } else if (appearance.roof === 'roof_cargo_box') {
            addBox(0.58, 0.22, 0.92, trimMat, 0, cabTopY + 0.13, -0.18, 0, 0, 'roof');
          }
        }
        // Detachable Hood Panel!
        addBox(bodyW * 0.88, 0.05, bodyL * 0.30, hoodMat, 0, yFloor + bodyH * 0.90, bodyL * 0.30, 0.08, 0, 'hood');
      }

      // Detachable Rear Bumper + Diffuser Strakes + Taillights
      if (arch !== 'truck_cyber') {
        addBox(bodyW * 0.96, bodyH * 0.72, 0.20, bodyMat, 0, yFloor + bodyH * 0.42, -bodyL * 0.46, 0, 0, 'rear_bumper');
        for (const dfx of [-0.36, -0.14, 0.14, 0.36]) {
          addBox(0.04, 0.18, 0.14, trimMat, dfx, yFloor + 0.06, -bodyL * 0.5 - 0.02, 0, 0, 'rear_bumper');
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

      // Detachable Rear Wing / Spoiler + Snapped Stubs Left Behind on Decklid
      if (appearance.spoilerStyle !== 'lip' && arch !== 'formula_cigar' && arch !== 'supercar_streamliner') {
        const wingW = bodyW * 1.08;
        const isHighWing =
          appearance.spoilerStyle === 'gt' ||
          appearance.spoilerStyle === 'cyber' ||
          appearance.spoilerStyle === 'active' ||
          appearance.spoilerStyle === 'f1_giant';
        const wingH = isHighWing ? 0.44 : 0.18;
        const wingZ = -bodyL * 0.5 + 0.08;
        // Stub mounts on decklid stay visible when spoiler snaps off
        addBox(0.05, 0.05, 0.14, trimMat, -0.46, yFloor + bodyH + 0.02, wingZ);
        addBox(0.05, 0.05, 0.14, trimMat, 0.46, yFloor + bodyH + 0.02, wingZ);
        addBox(0.04, wingH, 0.14, trimMat, -0.46, yFloor + bodyH + wingH * 0.5, wingZ, 0, 0, 'spoiler');
        addBox(0.04, wingH, 0.14, trimMat, 0.46, yFloor + bodyH + wingH * 0.5, wingZ, 0, 0, 'spoiler');
        const blade = addBox(wingW, 0.05, 0.34, trimMat, 0, yFloor + bodyH + wingH, wingZ, -0.08, 0, 'spoiler');
        blade.castShadow = !isSoftwareGl;
        addBox(0.04, 0.22, 0.40, accentMat, -wingW * 0.5, yFloor + bodyH + wingH, wingZ, 0, 0, 'spoiler');
        addBox(0.04, 0.22, 0.40, accentMat, wingW * 0.5, yFloor + bodyH + wingH, wingZ, 0, 0, 'spoiler');
      } else {
        // Subtle decklid lip spoiler on cars with lip wing
        addBox(bodyW * 0.92, 0.06, 0.14, accentMat, 0, yFloor + bodyH + 0.03, -bodyL * 0.46, -0.18, 0, 'spoiler');
      }
    }

    // Apply physical detachment & bend deformations to each of the 8 partGroups!
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
      const pipeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.28, 12);
      pipeGeo.rotateX(Math.PI / 2);

      [-0.38, -0.22, 0.22, 0.38].forEach((px, i) => {
        const isQuad = appearance.exhaust === 'quad_ti' || appearance.exhaust === 'center_tri';
        if (!isQuad && (i === 0 || i === 3)) return;

        const pipe = new THREE.Mesh(pipeGeo, chromeMat);
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

    const lightLensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(appearance.headlightLensHex || '#ffffff') });
    const hlXs = isMoto ? [0] : [-bodyW * 0.36, bodyW * 0.36];
    hlXs.forEach((lx) => {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(isMoto ? 0.18 : 0.24, 0.08, 0.08), lightLensMat);
      lens.position.set(lx, yCenter + 0.02, bodyL * 0.5 + 0.01);
      carGroup.add(lens);

      const spot = new THREE.SpotLight(0xfffbeb, 0, 14, Math.PI / 4, 0.4);
      spot.position.set(lx, yCenter + 0.02, bodyL * 0.5 + 0.1);
      spot.target.position.set(lx, yCenter - 0.1, bodyL * 0.5 + 4);
      fxGroup.add(spot);
      fxGroup.add(spot.target);
      headlightLightsRef.current.push(spot);
    });

    if (appearance.underglowHex) {
      const glowColor = new THREE.Color(appearance.underglowHex);
      const underLight = new THREE.PointLight(glowColor, 3.0, 3.6);
      underLight.position.set(0, 0.14, 0);
      fxGroup.add(underLight);
      underglowLightRef.current = underLight;

      const underPlaneGeo = new THREE.PlaneGeometry(bodyW * 1.45, bodyL * 1.12);
      const underPlaneMat = new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        depthWrite: false,
        opacity: 0.40,
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
            3D WEBGL SHOWROOM · ORBIT
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
