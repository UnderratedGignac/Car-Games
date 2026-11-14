import React, { useEffect, useRef, useState } from 'react';
import {
  CAR_ROSTER,
  CarCustomization,
  CarSpec,
  CarUpgradeLevels,
  DEFAULT_CUSTOMIZATION,
  DiagonalDirection,
  ENGINE_OPTIONS,
  EXHAUST_OPTIONS,
  FLAME_OPTIONS,
  HEADLIGHT_OPTIONS,
  HOOD_OPTIONS,
  HORN_OPTIONS,
  LIVERY_OPTIONS,
  NUMBER_OPTIONS,
  PAINT_OPTIONS,
  RIM_OPTIONS,
  ROOF_OPTIONS,
  SOUND_OPTIONS,
  TIRE_OPTIONS,
  UNDERGLOW_OPTIONS,
  VehicleCategory,
  WINDOW_OPTIONS,
  WING_OPTIONS,
  computeEffectiveCarStats,
  getCarCategory,
  getRainbowCycleColor,
  getUpgradeCost,
  LEGACY_UNDERGLOW_MAP,
  resolveCarAppearance,
  resolveUnderglowColor,
} from '../game/rules';
import { getPixelCarCanvas } from '../game/pixelSprites';
import {
  CAR_PARTS_META,
  CarDamageMap,
  CarDamageState,
  CarPartId,
  computeDamagedStats,
  countDamagedParts,
  getCarOverallIntegrity,
  getDamageVisualCacheKey,
  getFullRepairCost,
  getPartRepairCost,
  isCarTotaled,
  normalizeCarDamageState,
} from '../game/damage';
import { soundFX } from '../game/audio';
import { Car3DViewer } from './Car3DViewer';

export type GarageTabId =
  | 'repair'
  | 'body'
  | 'wheels_aero'
  | 'underglow_horns'
  | 'power_audio'
  | 'performance';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
  selectedCarId: string;
  unlockedCarIds: string[];
  carUpgrades: Record<string, CarUpgradeLevels>;
  carCustomizations: Record<string, CarCustomization>;
  carDamageMap?: CarDamageMap;
  initialTab?: GarageTabId;
  customSpriteUrl: string;
  onSelectCar: (carId: string) => void;
  onUnlockCar: (car: CarSpec) => void;
  onUpgradeStat: (car: CarSpec, stat: keyof CarUpgradeLevels) => void;
  onUpdateCustomization: (carId: string, nextCustom: CarCustomization) => void;
  onRepairPart?: (carId: string, partId: CarPartId, useEmergencyFree?: boolean) => void;
  onRepairAll?: (carId: string, useEmergencyFree?: boolean) => void;
  onClearCustomSprite: () => void;
}

type ShowroomMode = 'pixel' | '3d';

function getInspectionYawForPart(partId: CarPartId): number {
  switch (partId) {
    case 'front_bumper':
    case 'hood':
      return Math.PI * 0.82;
    case 'windshield':
    case 'roof':
      return Math.PI * 0.62;
    case 'left_door':
      return -Math.PI * 0.5;
    case 'right_door':
      return Math.PI * 0.5;
    case 'rear_bumper':
    case 'spoiler':
      return -0.35;
  }
}

function getPartStatImpactHint(partId: CarPartId): string {
  switch (partId) {
    case 'front_bumper':
      return 'Splitter aero & front crash beam';
    case 'hood':
      return 'Top speed aero & engine bay cover';
    case 'windshield':
      return 'A-pillar bracing & cockpit shield';
    case 'roof':
      return 'Chassis rigidity & rollover cage';
    case 'left_door':
    case 'right_door':
      return 'Side rigidity & handling response';
    case 'rear_bumper':
      return 'Rear diffuser & chassis tail';
    case 'spoiler':
      return 'Rear downforce & drift grip';
  }
}

const CATEGORY_TABS: { id: VehicleCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tuner', label: 'Tuner' },
  { id: 'super', label: 'Super' },
  { id: 'truck', label: 'Trucks' },
  { id: 'motorcycle', label: 'Motos' },
  { id: 'muscle', label: 'Muscle' },
  { id: 'van', label: 'Vans' },
  { id: 'formula', label: 'Formula' },
  { id: 'rally_kei', label: 'Rally & Kei' },
];

const thumbCache = new Map<string, string>();

const CarRosterThumbnail: React.FC<{ car: CarSpec; paintId: string }> = React.memo(({ car, paintId }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const key = `${car.id}:${paintId}`;
  const [src, setSrc] = useState<string>(() => thumbCache.get(key) || '');

  useEffect(() => {
    const cached = thumbCache.get(key);
    if (cached) {
      setSrc(cached);
      return;
    }
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      const custom: CarCustomization = { ...DEFAULT_CUSTOMIZATION, paint: paintId as CarCustomization['paint'] };
      const c = getPixelCarCanvas(car, 0, false, false, 0, custom, 'coast', false, -0.68, 0.36);
      const url = c.toDataURL();
      thumbCache.set(key, url);
      setSrc(url);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          const custom: CarCustomization = { ...DEFAULT_CUSTOMIZATION, paint: paintId as CarCustomization['paint'] };
          const c = getPixelCarCanvas(car, 0, false, false, 0, custom, 'coast', false, -0.68, 0.36);
          const url = c.toDataURL();
          thumbCache.set(key, url);
          setSrc(url);
          obs.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [car, key, paintId]);

  return (
    <div
      ref={hostRef}
      className="w-14 h-10 rounded-md bg-slate-950/90 border border-slate-800/80 flex items-center justify-center shrink-0 overflow-hidden"
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="w-14 h-10 object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: car.primaryColor }} />
      )}
    </div>
  );
});

export const GarageModal: React.FC<GarageModalProps> = ({
  isOpen,
  onClose,
  coins,
  selectedCarId,
  unlockedCarIds,
  carUpgrades,
  carCustomizations,
  carDamageMap,
  initialTab,
  customSpriteUrl,
  onSelectCar,
  onUnlockCar,
  onUpgradeStat,
  onUpdateCustomization,
  onRepairPart,
  onRepairAll,
  onClearCustomSprite,
}) => {
  const [previewCarId, setPreviewCarId] = useState<string>(selectedCarId);
  const [categoryFilter, setCategoryFilter] = useState<VehicleCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showroomMode, setShowroomMode] = useState<ShowroomMode>('pixel');
  const [previewYawRad, setPreviewYawRad] = useState<number>(-0.55);
  const [isAutoSpin, setIsAutoSpin] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<GarageTabId>(initialTab || 'body');
  const [highlightedPart, setHighlightedPart] = useState<CarPartId | null>(null);
  const [previewFlashing, setPreviewFlashing] = useState<boolean>(false);
  const [previewRevving, setPreviewRevving] = useState<boolean>(false);
  const [previewSpin, setPreviewSpin] = useState<number>(0);
  const [rainbowTick, setRainbowTick] = useState<number>(0);
  const spriteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartYawRef = useRef<number>(0);

  const filteredCars = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CAR_ROSTER.filter((c) => {
      if (categoryFilter !== 'all' && getCarCategory(c) !== categoryFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.codename.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categoryFilter, searchQuery]);

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: CAR_ROSTER.length };
    for (const c of CAR_ROSTER) {
      const cat = getCarCategory(c);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPreviewCarId(selectedCarId);
    setHighlightedPart(null);
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [selectedCarId, isOpen, initialTab]);

  const previewCar = CAR_ROSTER.find((c) => c.id === previewCarId) || CAR_ROSTER[0];
  const isUnlocked = unlockedCarIds.includes(previewCar.id);
  const isEquipped = selectedCarId === previewCar.id;
  const upgrades = carUpgrades[previewCar.id] || { speed: 1, handling: 1, magnet: 1 };
  const savedCustom = carCustomizations[previewCar.id];
  const currentCustom: CarCustomization = {
    ...DEFAULT_CUSTOMIZATION,
    ...savedCustom,
    number: savedCustom?.number || previewCar.decalText || '73',
  };
  const previewDamage: CarDamageState = normalizeCarDamageState(carDamageMap?.[previewCar.id]);
  const previewDamageKey = getDamageVisualCacheKey(previewDamage);
  const overallIntegrity = getCarOverallIntegrity(previewDamage);
  const damageCounts = countDamagedParts(previewDamage);
  const previewTotaled = isCarTotaled(previewDamage);
  const fullRepairCost = getFullRepairCost(previewDamage);

  const resolved = resolveCarAppearance(previewCar, currentCustom);
  const baseEffective = computeEffectiveCarStats(previewCar, upgrades, currentCustom);
  const effective = computeDamagedStats(baseEffective, previewDamage);

  const activeUnderglow = currentCustom.underglowColor || currentCustom.underglow || 'none';
  const hasRainbow = activeUnderglow === 'rainbow';
  const underglowColor = hasRainbow
    ? getRainbowCycleColor(Date.now())
    : resolveUnderglowColor(activeUnderglow);

  useEffect(() => {
    if (!isOpen || !previewRevving) return;
    const id = window.setInterval(() => {
      setPreviewSpin((s) => (s + 1) % 2);
    }, 110);
    return () => window.clearInterval(id);
  }, [isOpen, previewRevving]);

  useEffect(() => {
    if (!isOpen || showroomMode !== 'pixel') return;
    if (!isAutoSpin && !hasRainbow && isDragging) return;

    let animId: number;
    let lastTime = performance.now();
    const spinLoop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) * 0.001);
      lastTime = now;
      if (isAutoSpin && !isDragging) {
        setPreviewYawRad((prev) => {
          let next = prev + dt * 0.65;
          if (next > Math.PI) next -= Math.PI * 2;
          return next;
        });
      }
      if (hasRainbow) {
        setRainbowTick((r) => (r + 1) % 100000);
      }
      animId = requestAnimationFrame(spinLoop);
    };
    animId = requestAnimationFrame(spinLoop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, showroomMode, isAutoSpin, isDragging, hasRainbow]);

  useEffect(() => {
    if (!isOpen || showroomMode !== 'pixel' || !spriteCanvasRef.current) return;
    const canvas = spriteCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelSource = getPixelCarCanvas(
      previewCar,
      0,
      false,
      false,
      previewSpin,
      currentCustom,
      previewRevving ? 'gas' : 'coast',
      previewFlashing,
      previewYawRad,
      0.37,
      previewDamage
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    if (underglowColor && activeUnderglow !== 'none') {
      ctx.save();
      const cx = canvas.width / 2;
      const cy = 158;
      const cosYaw = Math.cos(previewYawRad);
      const sinYaw = Math.sin(previewYawRad);
      const rx = 74 + Math.abs(sinYaw) * 18;
      const ry = 22 + Math.abs(cosYaw) * 6;

      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
      grad.addColorStop(0, underglowColor);
      grad.addColorStop(0.35, `${underglowColor}bb`);
      grad.addColorStop(0.7, `${underglowColor}44`);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const drawW = 288;
    const drawH = 216;
    ctx.drawImage(
      pixelSource,
      Math.round((canvas.width - drawW) / 2),
      Math.round((canvas.height - drawH) / 2),
      drawW,
      drawH
    );
  }, [
    isOpen,
    showroomMode,
    previewCar,
    previewYawRad,
    currentCustom,
    previewDamageKey,
    previewSpin,
    previewRevving,
    previewFlashing,
    rainbowTick,
    underglowColor,
    activeUnderglow,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setIsAutoSpin(false);
    dragStartXRef.current = e.clientX;
    dragStartYawRef.current = previewYawRad;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartXRef.current;
    let nextYaw = dragStartYawRef.current + (dx / 140) * Math.PI;
    while (nextYaw > Math.PI) nextYaw -= Math.PI * 2;
    while (nextYaw < -Math.PI) nextYaw += Math.PI * 2;
    setPreviewYawRad(nextYaw);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  if (!isOpen) return null;

  const setCustomField = <K extends keyof CarCustomization>(
    key: K,
    value: CarCustomization[K]
  ) => {
    onUpdateCustomization(previewCar.id, {
      ...currentCustom,
      [key]: value,
    });
  };

  const triggerTestFlash = () => {
    soundFX.playHeadlightFlash();
    setPreviewFlashing(true);
    window.setTimeout(() => setPreviewFlashing(false), 180);
    window.setTimeout(() => {
      setPreviewFlashing(true);
      window.setTimeout(() => setPreviewFlashing(false), 180);
    }, 260);
  };

  const triggerTestHorn = () => {
    soundFX.playHorn((currentCustom.hornType || currentCustom.horn || (resolved as any).hornType || resolved.horn || 'dual') as any);
  };

  const triggerTestRev = () => {
    setPreviewRevving(true);
    soundFX.playDriftFlip(4, false);
    window.setTimeout(() => setPreviewRevving(false), 950);
  };

  const speedPct = Math.min(100, Math.round((effective.topSpeed * 8.5 / 420) * 100));
  const gripPct = Math.min(100, Math.round(effective.driftGrip * 100));
  const feverPct = Math.min(100, Math.round((effective.feverGainRate / 2.2) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#080c17] lg:inset-4 lg:max-w-[1380px] lg:mx-auto lg:rounded-2xl border lg:border-slate-800 overflow-hidden pointer-events-auto shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Neon Redline 3D Garage and Mod Shop"
    >
      {/* 1. COMPACT PADDOCK HEADER */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-800 bg-[#0b101d] shrink-0 pt-safe">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="text-base sm:text-xl font-bold tracking-tight font-display text-white truncate">
            Paddock &amp; Mod Shop
          </h2>
          <span className="hidden md:inline text-xs font-mono text-slate-400">
            {CAR_ROSTER.length} Vehicles · {unlockedCarIds.length} Owned
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Pixel vs Live 3D Showroom Switcher */}
          <div
            className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-0.5"
            role="group"
            aria-label="Showroom View Mode"
          >
            <button
              type="button"
              onClick={() => setShowroomMode('pixel')}
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors whitespace-nowrap ${
                showroomMode === 'pixel'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pixel Bay
            </button>
            <button
              type="button"
              onClick={() => setShowroomMode('3d')}
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors whitespace-nowrap ${
                showroomMode === '3d'
                  ? 'bg-cyan-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3D Studio
            </button>
          </div>

          <div className="text-right pl-3 border-l border-slate-800">
            <span className="block text-[10px] font-mono text-slate-400 leading-none mb-0.5">CREDITS</span>
            <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-amber-400 leading-none">
              {Math.round(coins).toLocaleString()} CR
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Garage"
            className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>
      </header>

      {/* 2. THREE-ZONE SHOWROOM WORKSPACE */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 overflow-hidden">
        {/* ZONE A: VEHICLE ROSTER SIDEBAR (Horizontal strip on mobile, Clean sidebar on desktop) */}
        <aside className="lg:col-span-3 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#090e1a] shrink-0 lg:min-h-0">
          {/* Category Filter + Search */}
          <div className="px-3 py-2.5 border-b border-slate-800/80 space-y-2 shrink-0">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${CAR_ROSTER.length} vehicles...`}
              aria-label="Search vehicles"
              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs text-white placeholder-slate-500 font-mono"
            />
            <div className="flex overflow-x-auto lg:flex-wrap scrollbar-none gap-1">
              {CATEGORY_TABS.map((tab) => {
                const count = categoryCounts[tab.id] || 0;
                const isActive = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`min-h-[30px] px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab.label} <span className="opacity-70 font-mono tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Roster Vehicle List */}
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto scrollbar-none snap-x lg:snap-none gap-1.5 p-2.5 lg:flex-1 lg:min-h-0">
            {filteredCars.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 px-2 py-4">No vehicles match "{searchQuery}"</p>
            ) : (
              filteredCars.map((car) => {
                const unlocked = unlockedCarIds.includes(car.id);
                const active = previewCar.id === car.id;
                const equipped = selectedCarId === car.id;
                const customPaintId = carCustomizations[car.id]?.paint || 'stock';
                const swatch =
                  PAINT_OPTIONS.find((p) => p.id === customPaintId)?.hex || car.primaryColor;

                const carDmg = carDamageMap?.[car.id]
                  ? normalizeCarDamageState(carDamageMap[car.id])
                  : null;
                const carIntegrity = carDmg ? getCarOverallIntegrity(carDmg) : 100;
                const carTotaled = carDmg ? isCarTotaled(carDmg) : false;

                return (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => setPreviewCarId(car.id)}
                    className={`min-w-[180px] lg:min-w-0 lg:w-full p-2 rounded-lg border text-left transition-colors snap-start shrink-0 flex items-center gap-2.5 relative ${
                      active
                        ? 'border-amber-400 bg-slate-900'
                        : 'border-slate-800/80 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/50'
                    }`}
                  >
                    <CarRosterThumbnail car={car} paintId={customPaintId} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 text-[10px] font-mono mb-0.5">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <span
                            className="w-2 h-2 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: swatch }}
                          />
                          T{car.tier}
                          {carIntegrity < 100 && (
                            <span
                              className={`px-1 rounded text-[9px] font-bold ${
                                carTotaled
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {carIntegrity}%
                            </span>
                          )}
                        </span>
                        <span
                          className={
                            equipped
                              ? 'text-emerald-400 font-bold'
                              : unlocked
                              ? 'text-cyan-400 font-semibold'
                              : 'text-amber-400 font-semibold'
                          }
                        >
                          {equipped ? 'ACTIVE' : unlocked ? 'OWNED' : `${car.unlockCost.toLocaleString()} CR`}
                        </span>
                      </div>
                      <div className="text-xs font-bold font-display leading-tight truncate text-slate-100">
                        {car.name}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ZONE B & C WRAPPER: Scrollable on mobile/tablet, Split columns on desktop */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:col-span-9 lg:grid lg:grid-cols-12">
          {/* ZONE B: CENTER SHOWROOM STAGE & TELEMETRY */}
          <section className="lg:col-span-6 flex flex-col justify-between p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#080c17] lg:overflow-y-auto">
            <div>
              {/* Stage Sub-Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>{previewCar.codename}</span>
                    <span>·</span>
                    <span>Tier {previewCar.tier}</span>
                    <span>·</span>
                    <span className="text-amber-400 font-semibold">{previewCar.coinMultiplier.toFixed(1)}x CR</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-display text-white truncate mt-0.5">
                    {previewCar.name}
                  </h3>
                </div>

                {showroomMode === 'pixel' && (
                  <button
                    type="button"
                    onClick={() => setIsAutoSpin((s) => !s)}
                    className={`min-h-[36px] px-3 py-1 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      isAutoSpin
                        ? 'bg-amber-400/15 text-amber-300 border-amber-400/50'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    {isAutoSpin ? 'Pause Spin' : 'Auto-Spin'}
                  </button>
                )}
              </div>

              {/* Showroom Turntable Stage (Pixel vs Live 3D WebGL) */}
              {showroomMode === '3d' ? (
                <Car3DViewer
                  car={previewCar}
                  appearance={resolved}
                  customization={currentCustom}
                  damageState={previewDamage}
                  highlightedPart={highlightedPart}
                  isFlashing={previewFlashing}
                  isRevving={previewRevving}
                />
              ) : (
                <>
                  <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className={`relative flex items-center justify-center h-56 sm:h-64 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 select-none ${
                      isDragging ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                    style={{
                      backgroundImage: previewFlashing
                        ? `radial-gradient(circle at 50% 42%, ${resolved.headlightBeamHex}66, rgba(9, 14, 26, 0.98) 72%)`
                        : underglowColor && activeUnderglow !== 'none'
                        ? `radial-gradient(circle at 50% 68%, ${underglowColor}44, rgba(9, 14, 26, 0.98) 74%)`
                        : 'radial-gradient(circle at 50% 66%, rgba(251, 191, 36, 0.14), rgba(9, 14, 26, 0.98) 74%)',
                    }}
                  >
                    <div className="absolute top-2.5 left-3 z-20 text-[11px] font-mono text-amber-300/90 pointer-events-none">
                      {Math.round(((previewYawRad * 180) / Math.PI + 360) % 360)}° ·{' '}
                      {Math.abs(previewYawRad) < 0.15
                        ? 'Rear'
                        : Math.abs(previewYawRad - Math.PI) < 0.2 || Math.abs(previewYawRad + Math.PI) < 0.2
                        ? 'Front'
                        : Math.abs(Math.abs(previewYawRad) - Math.PI * 0.5) < 0.2
                        ? 'Profile'
                        : '3/4 Stage'}
                    </div>
                    <div className="absolute bottom-2.5 right-3 z-20 text-[10px] font-mono text-slate-400 pointer-events-none">
                      Drag to rotate 360°
                    </div>

                    {previewFlashing && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at 50% 50%, ${resolved.headlightBeamHex}55 0%, transparent 72%)`,
                        }}
                      />
                    )}
                    <canvas
                      ref={spriteCanvasRef}
                      width={300}
                      height={220}
                      style={{ imageRendering: 'pixelated' }}
                      className="relative z-10 w-72 h-52 object-contain pointer-events-none"
                    />
                  </div>

                  {/* Camera Angle Presets + Continuous Slider */}
                  <div className="grid grid-cols-5 gap-1.5 mt-2.5">
                    {[
                      { label: 'Front 180°', rad: Math.PI },
                      { label: '135° 3/4', rad: Math.PI * 0.75 },
                      { label: '90° Side', rad: Math.PI * 0.5 },
                      { label: '45° 3/4', rad: Math.PI * 0.25 },
                      { label: 'Rear 0°', rad: 0 },
                    ].map((preset) => {
                      const isSelected =
                        Math.abs(previewYawRad - preset.rad) < 0.15 ||
                        (preset.rad === Math.PI && Math.abs(previewYawRad + Math.PI) < 0.15);
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setPreviewYawRad(preset.rad);
                            setIsAutoSpin(false);
                          }}
                          className={`min-h-[34px] px-1 py-1 rounded-md text-[10px] font-mono font-semibold transition-colors whitespace-nowrap ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 font-bold'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">-180°</span>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={Math.round((previewYawRad * 180) / Math.PI)}
                      onChange={(e) => {
                        setPreviewYawRad((Number(e.target.value) * Math.PI) / 180);
                        setIsAutoSpin(false);
                      }}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      aria-label="Car 360 turntable angle"
                    />
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">+180°</span>
                  </div>
                </>
              )}

              {/* Interactive Hardware Checks */}
              <div className="grid grid-cols-4 gap-2 mt-3">
                <button
                  type="button"
                  onClick={triggerTestFlash}
                  className={`min-h-[40px] px-2 py-1.5 rounded-lg border text-xs font-mono font-semibold whitespace-nowrap transition-colors ${
                    previewFlashing
                      ? 'bg-cyan-400 border-white text-slate-950 font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-cyan-300'
                  }`}
                >
                  Test Flash
                </button>
                <button
                  type="button"
                  onClick={triggerTestHorn}
                  className="min-h-[40px] px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-semibold text-amber-300 whitespace-nowrap"
                >
                  Test Horn
                </button>
                <button
                  type="button"
                  onClick={triggerTestRev}
                  className={`min-h-[40px] px-2 py-1.5 rounded-lg border text-xs font-mono font-semibold whitespace-nowrap transition-colors ${
                    previewRevving
                      ? 'bg-rose-500 border-white text-slate-950 font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-rose-300'
                  }`}
                >
                  Rev Flames
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCustomization(previewCar.id, {
                      ...DEFAULT_CUSTOMIZATION,
                      number: previewCar.decalText || '73',
                    })
                  }
                  className="min-h-[40px] px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-semibold text-slate-300 whitespace-nowrap"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Unboxed Telemetry Readout */}
            <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400 leading-relaxed truncate">{previewCar.tagline}</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('repair')}
                  className={`shrink-0 px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-colors ${
                    previewTotaled
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 hover:bg-rose-500/30'
                      : damageCounts.totalDamaged > 0
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  CHASSIS {overallIntegrity}%
                  {damageCounts.detachedCount > 0 ? ` · ${damageCounts.detachedCount} MISSING` : ''}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono tabular-nums pt-1">
                <div>
                  <div className="flex items-baseline justify-between text-[10px] mb-1">
                    <span className="text-slate-400">SPEED</span>
                    <span className="text-white font-bold">{Math.round(effective.topSpeed * 8.5)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${speedPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-[10px] mb-1">
                    <span className="text-slate-400">GRIP</span>
                    <span className="text-cyan-300 font-bold">{gripPct}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: `${gripPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-[10px] mb-1">
                    <span className="text-slate-400">FEVER</span>
                    <span className="text-emerald-300 font-bold">{effective.feverGainRate.toFixed(2)}x</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: `${feverPct}%` }} />
                  </div>
                </div>
              </div>

              {customSpriteUrl && (
                <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-xs">
                  <span className="text-cyan-400 font-medium">Custom Livery Active</span>
                  <button
                    type="button"
                    onClick={onClearCustomSprite}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap"
                  >
                    Reset Livery
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ZONE C: STREAMLINED MOD & TUNING WORKSHOP */}
          <section className="lg:col-span-6 flex flex-col bg-[#090e1a] lg:overflow-y-auto">
            {/* Sticky Workshop Navigation Tabs */}
            <div
              className="sticky top-0 z-10 shrink-0 flex overflow-x-auto lg:flex-wrap scrollbar-none gap-1 px-4 pt-3 pb-2.5 border-b border-slate-800 bg-[#0b101d]"
              role="tablist"
              aria-label="Mod Shop Categories"
            >
              {(
                [
                  ['repair', 'Repair Bay'],
                  ['body', 'Body & Paint'],
                  ['wheels_aero', 'Wheels & Aero'],
                  ['underglow_horns', 'Glow & Horns'],
                  ['power_audio', 'Engine & Lights'],
                  ['performance', 'Upgrades'],
                ] as const
              ).map(([tabId, tabLabel]) => {
                const isRepair = tabId === 'repair';
                return (
                  <button
                    key={tabId}
                    type="button"
                    role="tab"
                    data-garage-tab={tabId}
                    aria-selected={activeTab === tabId}
                    onClick={() => {
                      setActiveTab(tabId);
                      if (tabId !== 'repair') setHighlightedPart(null);
                    }}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      activeTab === tabId
                        ? isRepair && previewTotaled
                          ? 'bg-rose-500 text-white font-bold'
                          : 'bg-amber-400 text-slate-950 font-bold'
                        : isRepair && damageCounts.totalDamaged > 0
                        ? 'bg-rose-950/60 text-rose-200 hover:bg-rose-900/70 border border-rose-500/50'
                        : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{tabLabel}</span>
                    {isRepair && damageCounts.totalDamaged > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 font-mono text-[10px] font-bold">
                        {damageCounts.totalDamaged}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Workshop Content (Unboxed sections with hairline dividers) */}
            <div className="p-4 sm:p-5 space-y-5 text-xs">
              {activeTab === 'repair' && (
                <div className="space-y-4" data-testid="repair-bay-panel">
                  {/* Overall Structural Health Header & Fix-All Action */}
                  <div
                    className={`p-3.5 rounded-xl border ${
                      previewTotaled
                        ? 'bg-rose-950/35 border-rose-500/60'
                        : damageCounts.totalDamaged > 0
                        ? 'bg-amber-950/25 border-amber-500/45'
                        : 'bg-emerald-950/25 border-emerald-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          STRUCTURAL CHASSIS INTEGRITY
                        </span>
                        <span className="text-base font-display font-bold text-white">
                          {previewTotaled
                            ? 'CRITICAL DAMAGE — REPAIR REQUIRED'
                            : damageCounts.totalDamaged > 0
                            ? `${damageCounts.detachedCount} Detached · ${damageCounts.bentCount} Bent`
                            : 'Factory Mint Condition'}
                        </span>
                      </div>
                      <span
                        className={`text-xl font-mono font-bold tabular-nums ${
                          previewTotaled
                            ? 'text-rose-400'
                            : damageCounts.totalDamaged > 0
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {overallIntegrity}%
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden mb-3">
                      <div
                        className={`h-full transition-all ${
                          previewTotaled
                            ? 'bg-rose-500'
                            : overallIntegrity < 90
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${overallIntegrity}%` }}
                      />
                    </div>

                    {damageCounts.totalDamaged > 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-slate-300">
                          {coins >= fullRepairCost
                            ? `20% pit-crew bundle discount (${fullRepairCost} CR)`
                            : 'Low credits — emergency pit crew patch available'}
                        </span>
                        <button
                          type="button"
                          data-testid="btn-repair-all"
                          onClick={() => {
                            const useFree = coins < fullRepairCost;
                            onRepairAll?.(previewCar.id, useFree);
                            setHighlightedPart(null);
                          }}
                          className={`min-h-[38px] px-4 py-1.5 rounded-lg font-display font-bold text-xs tracking-wide transition-colors whitespace-nowrap ${
                            coins >= fullRepairCost
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                              : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                          }`}
                        >
                          {coins >= fullRepairCost
                            ? `Fix All Parts (${fullRepairCost} CR)`
                            : 'Free Emergency Pit Patch'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] font-mono text-emerald-300/90">
                        All 8 body panels, glass, and aero assemblies are bolted straight and race-legal.
                      </p>
                    )}
                  </div>

                  {/* 8-Part Detachable & Bendable Inspection List */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider px-1">
                      <span>Body &amp; Aero Components (Click to Inspect)</span>
                      <span>Integrity / Action</span>
                    </div>

                    {CAR_PARTS_META.map((meta) => {
                      const pState = previewDamage[meta.id];
                      const isDetached = pState.detached || pState.integrity <= 0;
                      const isBent = !isDetached && pState.integrity < 90;
                      const isScuffed = !isDetached && !isBent && pState.integrity < 100;
                      const needsFix = isDetached || pState.integrity < 100;
                      const cost = getPartRepairCost(meta.id, pState);
                      const useFree = coins < cost;
                      const isSelected = highlightedPart === meta.id;

                      return (
                        <div
                          key={meta.id}
                          onClick={() => {
                            setHighlightedPart(meta.id);
                            setPreviewYawRad(getInspectionYawForPart(meta.id));
                            setIsAutoSpin(false);
                          }}
                          className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2.5 ${
                            isSelected
                              ? 'border-cyan-400 bg-slate-900'
                              : isDetached
                              ? 'border-rose-500/45 bg-rose-950/20 hover:border-rose-400/70'
                              : isBent
                              ? 'border-amber-500/40 bg-amber-950/15 hover:border-amber-400/70'
                              : 'border-slate-800/80 bg-slate-950/70 hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-100 truncate">
                                {meta.label}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase ${
                                  isDetached
                                    ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                                    : isBent
                                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                    : isScuffed
                                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/35'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                                }`}
                              >
                                {isDetached
                                  ? 'DETACHED'
                                  : isBent
                                  ? `BENT ${pState.integrity}%`
                                  : isScuffed
                                  ? `SCUFF ${pState.integrity}%`
                                  : 'MINT 100%'}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                              {getPartStatImpactHint(meta.id)}
                              {isBent ? ` · Bend ${Math.round(Math.abs(pState.bendAngle) * 100)}%` : ''}
                            </p>
                          </div>

                          {needsFix ? (
                            <button
                              type="button"
                              data-repair-part={meta.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRepairPart?.(previewCar.id, meta.id, useFree);
                              }}
                              className={`min-h-[34px] px-3 py-1 rounded-lg font-mono text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                                useFree
                                  ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                              }`}
                            >
                              {isDetached
                                ? useFree
                                  ? 'Reattach (Free)'
                                  : `Reattach (${cost} CR)`
                                : useFree
                                ? 'Straighten (Free)'
                                : `Fix (${cost} CR)`}
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-emerald-400 px-2 shrink-0">
                              ✓ OK
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'performance' && (
                <div className="space-y-4">
                  {(['speed', 'handling', 'magnet'] as const).map((statKey, idx) => {
                    const lv = upgrades[statKey] || 1;
                    const cost = getUpgradeCost(previewCar.tier, lv);
                    const label =
                      statKey === 'speed'
                        ? '01. Drivetrain & Top Speed'
                        : statKey === 'handling'
                        ? '02. Chassis Grip & Drift Stability'
                        : '03. Coin Slipstream Pull Radius';
                    const readout =
                      statKey === 'speed'
                        ? `${Math.round(effective.topSpeed * 8.5)} KM/H`
                        : statKey === 'handling'
                        ? `+${effective.roadAllowanceBonus.toFixed(2)}m Hold`
                        : `${effective.magnetRadius.toFixed(1)}m Pull`;

                    return (
                      <div
                        key={statKey}
                        className={idx > 0 ? 'pt-4 border-t border-slate-800/80' : ''}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-100">{label}</span>
                          <span className="font-mono tabular-nums text-amber-400 font-semibold">
                            Lv.{lv}/5 · {readout}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map((step) => (
                              <div
                                key={step}
                                className={`h-2.5 rounded-sm ${
                                  step <= lv ? 'bg-amber-400' : 'bg-slate-800'
                                }`}
                              />
                            ))}
                          </div>

                          <button
                            type="button"
                            disabled={!isUnlocked || lv >= 5 || coins < cost}
                            onClick={() => onUpgradeStat(previewCar, statKey)}
                            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              !isUnlocked
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : lv >= 5
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default'
                                : coins >= cost
                                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {lv >= 5 ? 'MAXED' : `Upgrade (${cost} CR)`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'body' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Body Paint Finish
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {PAINT_OPTIONS.map((p) => {
                        const selected = currentCustom.paint === p.id;
                        const swatchHex = p.hex || previewCar.primaryColor;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setCustomField('paint', p.id)}
                            aria-label={`Paint ${p.label}`}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              selected
                                ? 'border-cyan-400 bg-slate-800 text-white font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-sm border border-white/25 shrink-0"
                              style={{ backgroundColor: swatchHex }}
                            />
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Hood Modification
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {HOOD_OPTIONS.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setCustomField('hood', h.id)}
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
                              (currentCustom.hood || 'stock') === h.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {h.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Roof Hardware
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {ROOF_OPTIONS.map((rf) => (
                          <button
                            key={rf.id}
                            type="button"
                            onClick={() => setCustomField('roof', rf.id)}
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
                              (currentCustom.roof || 'stock') === rf.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {rf.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Window Tint &amp; Cage
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {WINDOW_OPTIONS.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setCustomField('windows', w.id)}
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              (currentCustom.windows || 'stock') === w.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-sm border border-white/25"
                              style={{ backgroundColor: w.midHex }}
                            />
                            <span>{w.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Livery &amp; Door Number
                      </h4>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {LIVERY_OPTIONS.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setCustomField('livery', l.id)}
                            className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
                              currentCustom.livery === l.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {NUMBER_OPTIONS.map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setCustomField('number', num)}
                            className={`min-w-[38px] min-h-[32px] px-2 py-1 rounded-lg border font-mono text-[11px] transition-colors ${
                              currentCustom.number === num
                                ? 'border-amber-400 bg-amber-400 text-slate-950 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            #{num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'wheels_aero' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Tire Compound &amp; Profile
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {TIRE_OPTIONS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setCustomField('tires', t.id)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            (currentCustom.tires || 'stock') === t.id
                              ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {t.stripeHex && (
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30"
                              style={{ backgroundColor: t.stripeHex }}
                            />
                          )}
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Deep-Dish Wheel Finish
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {RIM_OPTIONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setCustomField('rims', r.id)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            currentCustom.rims === r.id
                              ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {r.hex && (
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30"
                              style={{ backgroundColor: r.hex }}
                            />
                          )}
                          <span>{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Rear Wing Downforce Kit
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {WING_OPTIONS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setCustomField('wing', w.id)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
                            currentCustom.wing === w.id
                              ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'underglow_horns' && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-mono font-semibold text-cyan-400 uppercase tracking-wider">
                        Neon Underglow Kits
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400">
                        {UNDERGLOW_OPTIONS.find((u) => u.id === (currentCustom.underglowColor || 'none'))?.label || 'None'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {UNDERGLOW_OPTIONS.map((u) => {
                        const isSelected =
                          (currentCustom.underglowColor || 'none') === u.id ||
                          (!currentCustom.underglowColor && currentCustom.underglow === u.id);
                        const isRainbow = u.id === 'rainbow';

                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setCustomField('underglowColor', u.id);
                              setCustomField(
                                'underglow',
                                (u.id in LEGACY_UNDERGLOW_MAP ? u.id : 'none') as any
                              );
                            }}
                            className={`p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors ${
                              isSelected
                                ? 'border-cyan-400 bg-cyan-950/50 text-cyan-100'
                                : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                                style={{
                                  background: isRainbow
                                    ? 'linear-gradient(135deg, #06b6d4, #f43f5e, #10b981)'
                                    : u.color === 'transparent'
                                    ? '#334155'
                                    : u.color,
                                }}
                              />
                              <span className="text-[11px] font-semibold truncate">{u.label}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {u.cost === 0 ? 'STD' : `${u.cost}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-mono font-semibold text-amber-400 uppercase tracking-wider">
                        Horn Signatures
                      </h4>
                      <button
                        type="button"
                        onClick={triggerTestHorn}
                        className="min-h-[32px] px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-semibold"
                      >
                        Play Active Horn
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {HORN_OPTIONS.map((hrn) => {
                        const isSelected =
                          (currentCustom.hornType || (currentCustom.horn as unknown as string) || 'dual') === hrn.id;

                        return (
                          <button
                            key={hrn.id}
                            type="button"
                            onClick={() => {
                              setCustomField('hornType', hrn.id);
                              setCustomField('horn', hrn.id as any);
                              soundFX.playHorn(hrn.id);
                            }}
                            className={`p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors ${
                              isSelected
                                ? 'border-amber-400 bg-amber-950/50 text-amber-100'
                                : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <span className="text-[11px] font-semibold truncate">{hrn.label}</span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {isSelected ? 'ACTIVE' : hrn.cost === 0 ? 'FREE' : `${hrn.cost} CR`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'power_audio' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Engine Swap &amp; Powertrain
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {ENGINE_OPTIONS.map((eng) => (
                        <button
                          key={eng.id}
                          type="button"
                          onClick={() => setCustomField('engine', eng.id)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            (currentCustom.engine || 'stock') === eng.id
                              ? 'border-amber-400 bg-amber-950/50 text-amber-200 font-bold'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <span>{eng.label}</span>
                          <span className="text-[10px] font-mono text-cyan-400">{eng.tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Exhaust Piping
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {EXHAUST_OPTIONS.map((ex) => (
                          <button
                            key={ex.id}
                            type="button"
                            onClick={() => setCustomField('exhaust', ex.id)}
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
                              (currentCustom.exhaust || 'stock') === ex.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {ex.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Backfire Flame Hue
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {FLAME_OPTIONS.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setCustomField('flame', f.id)}
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              currentCustom.flame === f.id
                                ? 'border-amber-400 bg-amber-950/60 text-amber-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {f.outer && (
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: f.outer }}
                              />
                            )}
                            <span>{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Exhaust Note
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {SOUND_OPTIONS.map((snd) => (
                          <button
                            key={snd.id}
                            type="button"
                            onClick={() => setCustomField('sound', snd.id)}
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
                              (currentCustom.sound || 'stock') === snd.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {snd.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Headlight Optics
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {HEADLIGHT_OPTIONS.map((hl) => (
                          <button
                            key={hl.id}
                            type="button"
                            onClick={() => {
                              setCustomField('lights', hl.id);
                              triggerTestFlash();
                            }}
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              (currentCustom.lights || 'stock') === hl.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30"
                              style={{ backgroundColor: hl.beamHex }}
                            />
                            <span>{hl.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 3. PINNED ACTION BAR (Solid surface — zero backdrop-blur over WebGL) */}
      <footer className="shrink-0 border-t border-slate-800 bg-[#0b101d] px-4 sm:px-6 py-3 pb-safe flex items-center justify-between gap-3">
        <div className="min-w-0 flex flex-col">
          <span className="text-sm font-display font-bold text-white truncate">
            {previewCar.name}
          </span>
          <span className="text-[11px] font-mono text-slate-400 truncate">
            {isUnlocked
              ? previewTotaled
                ? `Chassis ${overallIntegrity}% · Repair needed before racing`
                : isEquipped
                ? `Active on Starting Grid · Chassis ${overallIntegrity}%`
                : `Owned · Ready to Equip · Chassis ${overallIntegrity}%`
              : `Tier ${previewCar.tier} · ${previewCar.unlockCost.toLocaleString()} CR`}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {isUnlocked ? (
            previewTotaled ? (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'repair') {
                    onRepairAll?.(previewCar.id, coins < fullRepairCost);
                    setHighlightedPart(null);
                  } else {
                    setActiveTab('repair');
                  }
                }}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs sm:text-sm font-bold font-display tracking-wider transition-colors whitespace-nowrap"
              >
                {activeTab === 'repair'
                  ? coins >= fullRepairCost
                    ? `Fix All (${fullRepairCost} CR)`
                    : 'Free Pit Patch'
                  : '⚠️ Repair Car'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSelectCar(previewCar.id);
                  onClose();
                }}
                className={`min-h-[44px] px-6 py-2 rounded-lg text-xs sm:text-sm font-bold font-display tracking-wider transition-colors whitespace-nowrap ${
                  isEquipped
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {isEquipped ? '✓ Equipped · Race' : 'Equip Car'}
              </button>
            )
          ) : (
            <button
              type="button"
              disabled={coins < previewCar.unlockCost}
              onClick={() => onUnlockCar(previewCar)}
              className={`min-h-[44px] px-6 py-2 rounded-lg text-xs sm:text-sm font-bold font-display tracking-wider transition-colors whitespace-nowrap ${
                coins >= previewCar.unlockCost
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              Unlock ({previewCar.unlockCost.toLocaleString()} CR)
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
