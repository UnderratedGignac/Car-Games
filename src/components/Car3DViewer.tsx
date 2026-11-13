import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CarCustomization, CarSpec, resolveCarAppearance } from '../game/rules';

export type InspectTarget = 'all' | 'hood' | 'wheels' | 'aero' | 'exhaust' | 'underglow';

interface Car3DViewerProps {
  car: CarSpec;
  appearance: ReturnType<typeof resolveCarAppearance>;
  customization: CarCustomization;
  isFlashing?: boolean;
  isRevving?: boolean;
  onInspectTargetChange?: (target: InspectTarget) => void;
}

export const Car3DViewer: React.FC<Car3DViewerProps> = ({
  car,
  appearance,
  customization,
  isFlashing = false,
  isRevving = false,
  onInspectTargetChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [activeInspect, setActiveInspect] = useState<InspectTarget>('all');

  const stateRef = useRef({
    yaw: -0.65,
    pitch: 0.32,
    targetYaw: -0.65,
    targetPitch: 0.32,
    distance: 7.2,
    targetDistance: 7.2,
    targetCenterY: 0.65,
    centerY: 0.65,
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
  const exhaustFlamesRef = useRef<THREE.Group | null>(null);
  const headlightLightsRef = useRef<THREE.SpotLight[]>([]);
  const underglowLightRef = useRef<THREE.PointLight | null>(null);

  const setInspectionMode = (target: InspectTarget) => {
    setActiveInspect(target);
    onInspectTargetChange?.(target);
    setAutoRotate(false);

    const s = stateRef.current;
    switch (target) {
      case 'hood':
        s.targetYaw = -0.42;
        s.targetPitch = 0.45;
        s.targetDistance = 4.8;
        s.targetCenterY = 0.85;
        break;
      case 'wheels':
        s.targetYaw = -1.45;
        s.targetPitch = 0.18;
        s.targetDistance = 3.9;
        s.targetCenterY = 0.45;
        break;
      case 'aero':
        s.targetYaw = 2.45;
        s.targetPitch = 0.48;
        s.targetDistance = 4.6;
        s.targetCenterY = 0.95;
        break;
      case 'exhaust':
        s.targetYaw = 3.14;
        s.targetPitch = 0.15;
        s.targetDistance = 3.8;
        s.targetCenterY = 0.35;
        break;
      case 'underglow':
        s.targetYaw = -0.85;
        s.targetPitch = 0.08;
        s.targetDistance = 5.2;
        s.targetCenterY = 0.25;
        break;
      case 'all':
      default:
        s.targetYaw = -0.65;
        s.targetPitch = 0.32;
        s.targetDistance = 7.0;
        s.targetCenterY = 0.65;
        break;
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x090e1a);

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.4);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf43f5e, 1.8);
    rimLight.position.set(0, 6, -6);
    scene.add(rimLight);

    const turntableGeo = new THREE.CylinderGeometry(3.6, 3.8, 0.16, 64);
    const turntableMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.22,
    });
    const turntable = new THREE.Mesh(turntableGeo, turntableMat);
    turntable.position.y = -0.08;
    turntable.receiveShadow = true;
    scene.add(turntable);

    const ringGeo = new THREE.RingGeometry(3.68, 3.78, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);

    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    const bodyColor = new THREE.Color(appearance.primaryColor);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.72,
      roughness: 0.24,
    });

    const isCarbonHood = appearance.hood === 'carbon';
    const hoodMat = isCarbonHood
      ? new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9, roughness: 0.35 })
      : bodyMat;

    const isCarbonRoof = appearance.roof === 'carbon_panel';
    const roofMat = isCarbonRoof
      ? new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9, roughness: 0.35 })
      : bodyMat;

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      metalness: 0.6,
      roughness: 0.45,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      metalness: 0.2,
      roughness: 0.05,
      transparent: true,
      opacity: 0.78,
      transmission: 0.45,
    });

    const rimColor = new THREE.Color(appearance.rimHex || '#f59e0b');
    const rimMat = new THREE.MeshStandardMaterial({
      color: rimColor,
      metalness: 0.92,
      roughness: 0.18,
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x171717,
      metalness: 0.1,
      roughness: 0.85,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.96,
      roughness: 0.12,
    });

    const bodyL = 3.9;
    const bodyW = 1.76;
    const bodyH = 0.48;
    const yCenter = 0.54;

    const tubGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyL);
    const tub = new THREE.Mesh(tubGeo, bodyMat);
    tub.position.set(0, yCenter, 0);
    tub.castShadow = true;
    tub.receiveShadow = true;
    carGroup.add(tub);

    const splitterGeo = new THREE.BoxGeometry(bodyW * 1.04, 0.07, 0.52);
    const splitter = new THREE.Mesh(splitterGeo, trimMat);
    splitter.position.set(0, yCenter - 0.22, bodyL * 0.5 + 0.14);
    splitter.castShadow = true;
    carGroup.add(splitter);

    const cabinW = bodyW * 0.82;
    const cabinH = 0.44;
    const cabinL = bodyL * 0.48;
    const cabinGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, yCenter + bodyH * 0.5 + cabinH * 0.48, -0.15);
    cabin.castShadow = true;
    carGroup.add(cabin);

    const roofGeo = new THREE.BoxGeometry(cabinW * 0.96, 0.04, cabinL * 0.76);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, yCenter + bodyH * 0.5 + cabinH * 0.98, -0.16);
    carGroup.add(roof);

    if (appearance.roof === 'light_bar') {
      const barGeo = new THREE.BoxGeometry(cabinW * 0.88, 0.07, 0.14);
      const barMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(0, yCenter + bodyH * 0.5 + cabinH + 0.06, -0.05);
      carGroup.add(bar);
    } else if (appearance.roof === 'roof_scoop') {
      const scoopGeo = new THREE.BoxGeometry(0.34, 0.12, 0.38);
      const scoop = new THREE.Mesh(scoopGeo, hoodMat);
      scoop.position.set(0, yCenter + bodyH * 0.5 + cabinH + 0.06, -0.05);
      carGroup.add(scoop);
    }

    const hoodGeo = new THREE.BoxGeometry(bodyW * 0.92, 0.06, bodyL * 0.36);
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(0, yCenter + bodyH * 0.48, bodyL * 0.28);
    carGroup.add(hood);

    if (appearance.hood === 'blower') {
      const blowerGeo = new THREE.BoxGeometry(0.42, 0.28, 0.44);
      const blower = new THREE.Mesh(blowerGeo, chromeMat);
      blower.position.set(0, yCenter + bodyH * 0.48 + 0.15, bodyL * 0.24);
      carGroup.add(blower);

      const scoopTopGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.38, 16);
      const scoopTop = new THREE.Mesh(scoopTopGeo, chromeMat);
      scoopTop.rotation.x = Math.PI / 2;
      scoopTop.position.set(0, yCenter + bodyH * 0.48 + 0.32, bodyL * 0.24);
      carGroup.add(scoopTop);
    }

    const wheelRadius = 0.34;
    const wheelWidth = 0.26;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
    wheelGeo.rotateZ(Math.PI / 2);

    const rimInnerGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.01, 16);
    rimInnerGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
      { x: -(bodyW * 0.5 + 0.04), y: wheelRadius, z: bodyL * 0.34 },
      { x: bodyW * 0.5 + 0.04, y: wheelRadius, z: bodyL * 0.34 },
      { x: -(bodyW * 0.5 + 0.04), y: wheelRadius, z: -bodyL * 0.32 },
      { x: bodyW * 0.5 + 0.04, y: wheelRadius, z: -bodyL * 0.32 },
    ];

    wheelPositions.forEach((pos) => {
      const wheelHub = new THREE.Group();
      wheelHub.position.set(pos.x, pos.y, pos.z);

      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.castShadow = true;
      wheelHub.add(tire);

      const rim = new THREE.Mesh(rimInnerGeo, rimMat);
      wheelHub.add(rim);

      const rotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.45, wheelRadius * 0.45, 0.04, 16);
      rotorGeo.rotateZ(Math.PI / 2);
      const rotor = new THREE.Mesh(rotorGeo, chromeMat);
      wheelHub.add(rotor);

      carGroup.add(wheelHub);
    });

    if (appearance.spoilerStyle !== 'lip') {
      const wingW = bodyW * 1.08;
      const isHighWing =
        appearance.spoilerStyle === 'gt' ||
        appearance.spoilerStyle === 'cyber' ||
        appearance.spoilerStyle === 'active';
      const wingH = isHighWing ? 0.44 : 0.18;
      const wingZ = -bodyL * 0.5 + 0.08;

      const stanchionGeo = new THREE.BoxGeometry(0.04, wingH, 0.14);
      [-0.48, 0.48].forEach((sx) => {
        const stanchion = new THREE.Mesh(stanchionGeo, trimMat);
        stanchion.position.set(sx, yCenter + bodyH * 0.5 + wingH * 0.5, wingZ);
        carGroup.add(stanchion);
      });

      const bladeGeo = new THREE.BoxGeometry(wingW, 0.05, 0.34);
      const blade = new THREE.Mesh(bladeGeo, trimMat);
      blade.position.set(0, yCenter + bodyH * 0.5 + wingH, wingZ);
      blade.rotation.x = -0.08;
      blade.castShadow = true;
      carGroup.add(blade);
    }

    const exhaustGroup = new THREE.Group();
    exhaustFlamesRef.current = exhaustGroup;
    carGroup.add(exhaustGroup);

    const pipeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.28, 16);
    pipeGeo.rotateX(Math.PI / 2);

    [-0.38, -0.22, 0.22, 0.38].forEach((px, i) => {
      const isQuad = appearance.exhaust === 'quad_ti' || appearance.exhaust === 'center_tri';
      if (!isQuad && (i === 0 || i === 3)) return;

      const pipe = new THREE.Mesh(pipeGeo, chromeMat);
      pipe.position.set(px, yCenter - 0.18, -bodyL * 0.5 - 0.04);
      carGroup.add(pipe);

      const flameGeo = new THREE.ConeGeometry(0.12, 0.65, 12);
      flameGeo.rotateX(-Math.PI / 2);
      const flameMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xf97316 : 0x06b6d4,
        transparent: true,
        opacity: 0,
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(px, yCenter - 0.18, -bodyL * 0.5 - 0.4);
      exhaustGroup.add(flame);
    });

    const lightLensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-0.62, 0.62].forEach((lx) => {
      const lensGeo = new THREE.BoxGeometry(0.24, 0.08, 0.08);
      const lens = new THREE.Mesh(lensGeo, lightLensMat);
      lens.position.set(lx, yCenter + 0.08, bodyL * 0.5 + 0.01);
      carGroup.add(lens);

      const spot = new THREE.SpotLight(0xfffbeb, 0, 14, Math.PI / 4, 0.4);
      spot.position.set(lx, yCenter + 0.08, bodyL * 0.5 + 0.1);
      spot.target.position.set(lx, yCenter, bodyL * 0.5 + 4);
      scene.add(spot);
      scene.add(spot.target);
      headlightLightsRef.current.push(spot);
    });

    if (appearance.underglowHex) {
      const glowColor = new THREE.Color(appearance.underglowHex);
      const underLight = new THREE.PointLight(glowColor, 3.5, 3.8);
      underLight.position.set(0, 0.15, 0);
      scene.add(underLight);
      underglowLightRef.current = underLight;

      const underPlaneGeo = new THREE.PlaneGeometry(bodyW * 1.5, bodyL * 1.15);
      const underPlaneMat = new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.45,
      });
      const underPlane = new THREE.Mesh(underPlaneGeo, underPlaneMat);
      underPlane.rotation.x = -Math.PI / 2;
      underPlane.position.y = 0.005;
      scene.add(underPlane);
    }

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
        Math.min(1.2, stateRef.current.targetPitch - dy * 0.007)
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
    let initialTargetDist = 7.2;

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
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let animId = 0;
    const clock = new THREE.Clock();

    const loop = () => {
      const dt = clock.getDelta();
      const s = stateRef.current;

      if (s.autoRotate && !s.isDragging) {
        s.targetYaw += dt * 0.55;
      }

      s.yaw += (s.targetYaw - s.yaw) * Math.min(1, 10 * dt);
      s.pitch += (s.targetPitch - s.pitch) * Math.min(1, 10 * dt);
      s.distance += (s.targetDistance - s.distance) * Math.min(1, 8 * dt);
      s.centerY += (s.targetCenterY - s.centerY) * Math.min(1, 8 * dt);

      const camX = Math.sin(s.yaw) * Math.cos(s.pitch) * s.distance;
      const camY = Math.sin(s.pitch) * s.distance + s.centerY;
      const camZ = Math.cos(s.yaw) * Math.cos(s.pitch) * s.distance;

      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, s.centerY, 0);

      renderer.render(scene, camera);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [car, appearance, customization]);

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
    <div className="relative w-full flex flex-col rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      <div
        ref={mountRef}
        className="relative w-full h-56 sm:h-72 cursor-grab active:cursor-grabbing touch-none select-none"
        title="Drag or swipe to spin 360°"
      />

      <div className="p-2.5 sm:p-3 bg-slate-900/95 border-t border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-cyan-400 font-bold flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block shrink-0" />
            3D SHOWROOM · 360° ORBIT
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setAutoRotate((prev) => !prev)}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                autoRotate
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              <span>{autoRotate ? '⏸ Pause Spin' : '▶ 360° Spin'}</span>
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
              ['hood', 'Hood & Engine'],
              ['wheels', 'Wheels & Rims'],
              ['aero', 'Downforce Wing'],
              ['exhaust', 'Exhaust Pipes'],
              ['underglow', 'Neon Underglow'],
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
                    ? 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.3)] ring-1 ring-amber-400/60'
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
