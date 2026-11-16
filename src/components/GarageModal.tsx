import React, { useEffect, useRef, useState } from 'react';
import {
  CAR_ROSTER,
  CarCustomization,
  CarSpec,
  CarUpgradeLevels,
  DEFAULT_CUSTOMIZATION,
  HORN_OPTIONS,
  ModCostCategory,
  NUMBER_OPTIONS,
  PAINT_OPTIONS,
  UNDERGLOW_OPTIONS,
  VehicleCategory,
  applyCarModPreview,
  applyCarStylePackagePreview,
  computeEffectiveCarStats,
  computeGaragePreviewSummary,
  getCarCategory,
  getCarCompatibleModSet,
  getCarStylePackages,
  getRainbowCycleColor,
  getUpgradeCost,
  isCarModOwned,
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
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  LayoutGrid,
  RotateCcw,
  Search,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import studioPaddockImg from '../assets/images/studio_paddock_bay_1794662835288.jpg';

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
  ownedCarMods: Record<string, string[]>;
  carDamageMap?: CarDamageMap;
  initialTab?: GarageTabId;
  customSpriteUrl: string;
  onSelectCar: (carId: string) => void;
  onUnlockCar: (car: CarSpec) => void;
  onUpgradeStat: (car: CarSpec, stat: keyof CarUpgradeLevels) => void;
  onPurchaseMod: (car: CarSpec, category: ModCostCategory, optionId: string) => boolean;
  onPurchaseStylePackage: (car: CarSpec, packageId: string) => boolean;
  onPurchasePreviewBundle?: (car: CarSpec, draftCustom: CarCustomization) => boolean;
  onResetCustomization: (car: CarSpec) => void;
  onUpdateCustomization: (carId: string, nextCustom: CarCustomization) => void;
  onRepairPart?: (carId: string, partId: CarPartId, useEmergencyFree?: boolean) => void;
  onRepairAll?: (carId: string, useEmergencyFree?: boolean) => void;
  onClearCustomSprite: () => void;
}

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
    case 'front_left_wheel':
    case 'rear_left_wheel':
      return -Math.PI * 0.56;
    case 'front_right_wheel':
    case 'rear_right_wheel':
      return Math.PI * 0.56;
  }
}

function getInspectionYawForMod(category: ModCostCategory | 'style'): number {
  switch (category) {
    case 'hood':
    case 'lights':
      return Math.PI * 0.82;
    case 'roof':
      return Math.PI * 0.65;
    case 'tires':
    case 'rims':
      return Math.PI * 0.52;
    case 'wing':
    case 'exhaust':
    case 'flame':
      return -0.32;
    case 'paint':
    case 'windows':
    case 'livery':
      return -0.74;
    case 'underglow':
      return -0.55;
    case 'style':
    default:
      return -0.58;
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
    case 'front_left_wheel':
    case 'front_right_wheel':
      return 'Front steering response & turn-in grip';
    case 'rear_left_wheel':
    case 'rear_right_wheel':
      return 'Rear traction & drift stability';
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
  ownedCarMods,
  carDamageMap,
  initialTab,
  customSpriteUrl,
  onSelectCar,
  onUnlockCar,
  onUpgradeStat,
  onPurchaseMod,
  onPurchaseStylePackage,
  onPurchasePreviewBundle,
  onResetCustomization,
  onUpdateCustomization,
  onRepairPart,
  onRepairAll,
  onClearCustomSprite,
}) => {
  const [previewCarId, setPreviewCarId] = useState<string>(selectedCarId);
  const [categoryFilter, setCategoryFilter] = useState<VehicleCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewYawRad, setPreviewYawRad] = useState<number>(-0.55);
  const [isAutoSpin, setIsAutoSpin] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<GarageTabId>(initialTab || 'body');
  const [highlightedPart, setHighlightedPart] = useState<CarPartId | null>(null);
  const [previewFlashing, setPreviewFlashing] = useState<boolean>(false);
  const [previewRevving, setPreviewRevving] = useState<boolean>(false);
  const [previewSpin, setPreviewSpin] = useState<number>(0);
  const [rainbowTick, setRainbowTick] = useState<number>(0);
  const [previewDraft, setPreviewDraft] = useState<CarCustomization | null>(null);
  const [inspectFocusLabel, setInspectFocusLabel] = useState<string | null>(null);
  const [mobileRosterOpen, setMobileRosterOpen] = useState<boolean>(false);
  const [isComparingSaved, setIsComparingSaved] = useState<boolean>(false);
  const spriteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartYawRef = useRef<number>(0);
  const revTimerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);

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
    setPreviewDraft(null);
    setInspectFocusLabel(null);
    setMobileRosterOpen(false);
    setIsComparingSaved(false);
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [selectedCarId, isOpen, initialTab]);

  useEffect(() => {
    setPreviewDraft(null);
    setInspectFocusLabel(null);
    setIsComparingSaved(false);
  }, [previewCarId]);

  const previewCar = CAR_ROSTER.find((c) => c.id === previewCarId) || CAR_ROSTER[0];
  const isUnlocked = unlockedCarIds.includes(previewCar.id);
  const isEquipped = selectedCarId === previewCar.id;
  const upgrades = carUpgrades[previewCar.id] || { speed: 1, handling: 1, magnet: 1 };
  const savedCustomRaw = carCustomizations[previewCar.id];
  const savedCustom: CarCustomization = {
    ...DEFAULT_CUSTOMIZATION,
    ...savedCustomRaw,
    number: savedCustomRaw?.number || previewCar.decalText || '73',
  };
  const currentCustom: CarCustomization = previewDraft || savedCustom;
  const previewDamage: CarDamageState = normalizeCarDamageState(carDamageMap?.[previewCar.id]);
  const previewDamageKey = getDamageVisualCacheKey(previewDamage);
  const overallIntegrity = getCarOverallIntegrity(previewDamage);
  const damageCounts = countDamagedParts(previewDamage);
  const previewTotaled = isCarTotaled(previewDamage);
  const fullRepairCost = getFullRepairCost(previewDamage);

  const carOwnedMods = ownedCarMods[previewCar.id] || [];
  const previewSummary = React.useMemo(
    () =>
      previewDraft
        ? computeGaragePreviewSummary({
            car: previewCar,
            savedCustom,
            draftCustom: previewDraft,
            ownedMods: carOwnedMods,
          })
        : null,
    [previewDraft, previewCar, savedCustom, carOwnedMods]
  );
  const hasActivePreview = Boolean(previewDraft && previewSummary?.hasChanges);
  const stageCustom: CarCustomization = isComparingSaved && hasActivePreview ? savedCustom : currentCustom;

  const resolved = resolveCarAppearance(previewCar, stageCustom);
  const savedBaseEffective = computeEffectiveCarStats(previewCar, upgrades, savedCustom);
  const savedEffective = computeDamagedStats(savedBaseEffective, previewDamage);
  const baseEffective = computeEffectiveCarStats(previewCar, upgrades, stageCustom);
  const effective = computeDamagedStats(baseEffective, previewDamage);
  const stylePackages = React.useMemo(() => getCarStylePackages(previewCar), [previewCar]);
  const compatMods = React.useMemo(() => getCarCompatibleModSet(previewCar), [previewCar]);

  const activeUnderglow = stageCustom.underglowColor || stageCustom.underglow || 'none';
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
    if (!isOpen) return;
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
  }, [isOpen, isAutoSpin, isDragging, hasRainbow]);

  useEffect(() => {
    if (!isOpen || !spriteCanvasRef.current) return;
    const canvas = spriteCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelSource = getPixelCarCanvas(
      previewCar,
      0,
      false,
      false,
      previewSpin,
      stageCustom,
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
    previewCar,
    previewYawRad,
    stageCustom,
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
    if (previewDraft) {
      setPreviewDraft({ ...currentCustom, [key]: value });
      return;
    }
    onUpdateCustomization(previewCar.id, {
      ...savedCustom,
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

  const triggerVisualRev = (playAudio = false) => {
    if (revTimerRef.current) window.clearTimeout(revTimerRef.current);
    setPreviewRevving(true);
    if (playAudio) soundFX.playDriftFlip(4, false);
    revTimerRef.current = window.setTimeout(() => {
      setPreviewRevving(false);
      revTimerRef.current = null;
    }, 1800);
  };

  const triggerTestHorn = () => {
    soundFX.playHorn((currentCustom.hornType || currentCustom.horn || (resolved as any).hornType || resolved.horn || 'dual') as any);
  };

  const triggerTestRev = () => {
    triggerVisualRev(true);
  };

  const showFocusCue = (category: ModCostCategory | 'style', label: string, isPreviewing: boolean) => {
    setPreviewYawRad(getInspectionYawForMod(category));
    setIsAutoSpin(false);
    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    setInspectFocusLabel(`${isPreviewing ? 'Preview' : 'Applied'}: ${label}`);
    focusTimerRef.current = window.setTimeout(() => {
      setInspectFocusLabel(null);
      focusTimerRef.current = null;
    }, 2800);
  };

  const handleSelectOrPreviewMod = (
    category: ModCostCategory,
    optionId: string,
    label: string,
    cost: number
  ) => {
    const owned = isCarModOwned(carOwnedMods, category, optionId, cost);
    if (category === 'exhaust' || category === 'flame') {
      triggerVisualRev(false);
    } else if (category === 'lights') {
      triggerTestFlash();
    } else if (category === 'horn') {
      soundFX.playHorn(optionId as any);
    }

    if (owned && isUnlocked && !previewDraft) {
      onPurchaseMod(previewCar, category, optionId);
      showFocusCue(category, label, false);
      return;
    }

    setIsComparingSaved(false);
    const nextDraft = applyCarModPreview(currentCustom, category, optionId);
    setPreviewDraft(nextDraft);
    showFocusCue(category, label, true);
  };

  const handleSelectOrPreviewStylePackage = (pkgId: string) => {
    const pkg = stylePackages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const owned = isCarModOwned(carOwnedMods, 'style', pkg.id, pkg.cost);
    if (owned && isUnlocked && !previewDraft) {
      onPurchaseStylePackage(previewCar, pkg.id);
      showFocusCue('style', pkg.name, false);
      return;
    }

    setIsComparingSaved(false);
    const { nextCustom } = applyCarStylePackagePreview(previewCar, currentCustom, pkg.id);
    setPreviewDraft(nextCustom);
    triggerVisualRev(false);
    showFocusCue('style', pkg.name, true);
  };

  const handleCommitPreview = () => {
    if (!previewDraft || !isUnlocked) return;
    if (onPurchasePreviewBundle) {
      if (onPurchasePreviewBundle(previewCar, previewDraft)) {
        setPreviewDraft(null);
        setInspectFocusLabel(null);
        setIsComparingSaved(false);
      }
      return;
    }
    if (previewSummary?.pendingStylePackage) {
      if (onPurchaseStylePackage(previewCar, previewSummary.pendingStylePackage.id)) {
        setPreviewDraft(null);
        setInspectFocusLabel(null);
        setIsComparingSaved(false);
      }
    }
  };

  const handleBuySingleStylePackageNow = (pkgId: string) => {
    if (!isUnlocked) return;
    if (onPurchaseStylePackage(previewCar, pkgId)) {
      setPreviewDraft(null);
      setIsComparingSaved(false);
      const pkg = stylePackages.find((p) => p.id === pkgId);
      if (pkg) showFocusCue('style', pkg.name, false);
    }
  };

  const previewIndexInRoster = Math.max(
    0,
    CAR_ROSTER.findIndex((c) => c.id === previewCar.id)
  );
  const stepPreviewCar = (delta: number) => {
    const nextIdx = (previewIndexInRoster + delta + CAR_ROSTER.length) % CAR_ROSTER.length;
    setPreviewCarId(CAR_ROSTER[nextIdx].id);
  };

  const speedKmh = Math.round(effective.topSpeed * 8.5);
  const savedSpeedKmh = Math.round(savedEffective.topSpeed * 8.5);
  const speedDelta = speedKmh - savedSpeedKmh;
  const speedPct = Math.min(100, Math.round((speedKmh / 420) * 100));

  const gripPct = Math.min(100, Math.round(effective.driftGrip * 100));
  const savedGripPct = Math.min(100, Math.round(savedEffective.driftGrip * 100));
  const gripDelta = gripPct - savedGripPct;

  const feverPct = Math.min(100, Math.round((effective.feverGainRate / 2.2) * 100));
  const feverDelta = +(effective.feverGainRate - savedEffective.feverGainRate).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#080c17] lg:inset-4 lg:max-w-[1380px] lg:mx-auto lg:rounded-2xl border lg:border-slate-800 overflow-hidden pointer-events-auto touch-auto shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Neon Redline Garage and Mod Shop"
    >
      {/* 1. SINGLE-ROW PADDOCK HEADER */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3 border-b border-slate-800 bg-[#0b101d] shrink-0 pt-safe">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h2 className="text-sm sm:text-xl font-bold tracking-tight font-display text-white truncate">
            <span className="sm:hidden">Garage</span>
            <span className="hidden sm:inline">Paddock &amp; Mod Shop</span>
          </h2>
          <span className="hidden sm:inline text-xs font-mono text-slate-400 whitespace-nowrap">
            {CAR_ROSTER.length} Vehicles · {unlockedCarIds.length} Owned
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right">
            <span className="hidden sm:block text-[10px] font-mono text-slate-400 leading-none mb-0.5">
              CREDITS
            </span>
            <span
              data-testid="garage-credits"
              className="text-xs sm:text-base font-bold font-mono tabular-nums text-amber-400 leading-none"
            >
              {Math.round(coins).toLocaleString()} CR
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Garage"
            className="min-h-[38px] sm:min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-1"
          >
            <X className="w-3.5 h-3.5 sm:hidden" />
            <span>Close</span>
          </button>
        </div>
      </header>

      {/* MOBILE QUICK VEHICLE BAR (< lg): Frees vertical height so car showcase + scrollable shop both fit cleanly */}
      <div className="lg:hidden flex items-center justify-between gap-1.5 px-2.5 py-1.5 border-b border-slate-800 bg-[#090e1a] shrink-0">
        <button
          type="button"
          onClick={() => stepPreviewCar(-1)}
          aria-label="Previous vehicle"
          className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center justify-center shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          data-testid="mobile-open-roster"
          onClick={() => setMobileRosterOpen(true)}
          className="min-h-[36px] flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 flex items-center justify-between gap-2 text-left"
        >
          <div className="min-w-0 flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs font-display font-bold text-white truncate">
              {previewCar.name}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
            T{previewCar.tier} · {previewIndexInRoster + 1}/{CAR_ROSTER.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => stepPreviewCar(1)}
          aria-label="Next vehicle"
          className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center justify-center shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 2. THREE-ZONE SHOWROOM WORKSPACE */}
      <div className="relative flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 overflow-hidden">
        {/* ZONE A: DESKTOP VEHICLE ROSTER SIDEBAR */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col border-r border-slate-800 bg-[#090e1a] min-h-0">
          {/* Category Filter + Search */}
          <div className="px-3 py-2.5 border-b border-slate-800/80 space-y-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${CAR_ROSTER.length} vehicles...`}
                aria-label="Search vehicles"
                className="w-full min-h-[36px] pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs text-white placeholder-slate-500 font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-1">
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
          <div className="flex flex-col overflow-y-auto touch-pan-y overscroll-contain gap-1.5 p-2.5 flex-1 min-h-0">
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
                    className={`w-full p-2 rounded-lg border text-left transition-colors shrink-0 flex items-center gap-2.5 relative ${
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

        {/* ZONE B & C WRAPPER: Pinned car showcase + independently scrollable shop on ALL screens */}
        <div className="flex-1 min-h-0 flex flex-col lg:col-span-9 lg:grid lg:grid-cols-12 overflow-hidden">
          {/* ZONE B: PINNED SHOWROOM STAGE & TELEMETRY (Always visible while scrolling shop!) */}
          <section className="shrink-0 lg:min-h-0 lg:col-span-6 lg:overflow-y-auto flex flex-col justify-between p-2.5 sm:p-4 lg:p-5 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#080c17]">
            <div>
              {/* Stage Sub-Header (Desktop/Tablet; Mobile uses compact overlay pills on stage to preserve scroll room) */}
              <div className="hidden sm:flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-slate-400">
                    <span>{previewCar.codename}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">Tier {previewCar.tier}</span>
                    <span>·</span>
                    <span className="text-amber-400 font-semibold whitespace-nowrap">{previewCar.coinMultiplier.toFixed(1)}x CR</span>
                  </div>
                  <h3 className="text-xl font-bold font-display text-white truncate mt-0.5">
                    {previewCar.name}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAutoSpin((s) => !s)}
                  className={`min-h-[34px] px-3 py-1 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    isAutoSpin
                      ? 'bg-amber-400/15 text-amber-300 border-amber-400/50'
                      : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                  }`}
                >
                  {isAutoSpin ? 'Pause Spin' : 'Auto-Spin'}
                </button>
              </div>

              {/* Showroom Turntable Stage */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`relative flex items-center justify-center h-32 sm:h-44 lg:h-60 rounded-xl overflow-hidden bg-slate-900 border select-none transition-colors ${
                  hasActivePreview
                    ? isComparingSaved
                      ? 'border-slate-500'
                      : 'border-cyan-400/70'
                    : 'border-slate-800'
                } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  backgroundImage: previewFlashing
                    ? `radial-gradient(circle at 50% 42%, ${resolved.headlightBeamHex}66, rgba(9, 14, 26, 0.98) 72%)`
                    : underglowColor && activeUnderglow !== 'none'
                    ? `radial-gradient(circle at 50% 68%, ${underglowColor}44, rgba(9, 14, 26, 0.98) 74%)`
                    : 'radial-gradient(circle at 50% 66%, rgba(251, 191, 36, 0.14), rgba(9, 14, 26, 0.98) 74%)',
                }}
              >
                <img
                  src={studioPaddockImg}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none select-none"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse at 50% 68%, transparent 18%, rgba(8, 12, 23, 0.78) 88%)',
                  }}
                />
                <div className="absolute top-2 left-2.5 z-20 text-[10px] sm:text-[11px] font-mono text-amber-300/90 pointer-events-none">
                  {Math.round(((previewYawRad * 180) / Math.PI + 360) % 360)}° ·{' '}
                  {Math.abs(previewYawRad) < 0.15
                    ? 'Rear'
                    : Math.abs(previewYawRad - Math.PI) < 0.2 || Math.abs(previewYawRad + Math.PI) < 0.2
                    ? 'Front'
                    : Math.abs(Math.abs(previewYawRad) - Math.PI * 0.5) < 0.2
                    ? 'Profile'
                    : '3/4 Stage'}
                </div>

                {/* Mobile quick Auto-Spin chip inside stage top-right when no focus badge overrides */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setIsAutoSpin((s) => !s)}
                  className={`sm:hidden absolute top-1.5 right-1.5 z-20 min-h-[26px] px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold ${
                    isAutoSpin
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                      : 'bg-slate-950/80 text-slate-300 border-slate-700'
                  }`}
                >
                  {isAutoSpin ? 'Pause' : 'Spin'}
                </button>

                {inspectFocusLabel && (
                  <div className="hidden sm:block absolute top-2 right-2.5 z-20 px-2 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-400/50 text-[10px] font-mono font-semibold text-cyan-200 pointer-events-none max-w-[58%] truncate">
                    {isComparingSaved ? 'Comparing Stock Build' : inspectFocusLabel}
                  </div>
                )}
                <div className="absolute bottom-1.5 left-2.5 z-20 sm:hidden text-[10px] font-mono text-amber-300/90 pointer-events-none">
                  {previewCar.coinMultiplier.toFixed(1)}x CR
                </div>
                <div className="absolute bottom-1.5 right-2.5 z-20 text-[10px] font-mono text-slate-400 pointer-events-none">
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
                  width={320}
                  height={240}
                  className="relative z-10 w-full h-full max-w-[360px] object-contain pointer-events-none"
                />
              </div>

              {/* Pinned Live Preview Action Bar (appears whenever previewing unbought/unsaved changes!) */}
              {hasActivePreview && previewSummary && (
                <div
                  data-testid="garage-preview-bar"
                  className="mt-1.5 sm:mt-2 p-2 sm:p-2.5 rounded-xl border border-cyan-400/60 bg-cyan-950/35 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono text-[9px] font-bold uppercase shrink-0">
                        {isComparingSaved ? 'SAVED' : 'PREVIEW'}
                      </span>
                      <span className="text-xs font-display font-bold text-white truncate">
                        {previewSummary.summaryLabel}
                      </span>
                    </div>
                    <span className="block text-[10px] font-mono text-cyan-200/85 mt-0.5 truncate">
                      {!isUnlocked
                        ? `Unlock vehicle (${previewCar.unlockCost.toLocaleString()} CR) to buy`
                        : previewSummary.totalCost === 0
                        ? 'All previewed items owned · Free apply'
                        : coins >= previewSummary.totalCost
                        ? `Build cost: ${previewSummary.totalCost.toLocaleString()} CR`
                        : `Need ${(previewSummary.totalCost - coins).toLocaleString()} more CR (${previewSummary.totalCost.toLocaleString()} CR)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      data-testid="btn-compare-preview"
                      onClick={() => setIsComparingSaved((v) => !v)}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono font-semibold whitespace-nowrap inline-flex items-center gap-1 transition-colors ${
                        isComparingSaved
                          ? 'bg-cyan-400 text-slate-950 border-white font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-200'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>{isComparingSaved ? 'Show New' : 'Compare'}</span>
                    </button>
                    <button
                      type="button"
                      data-testid="btn-discard-preview"
                      onClick={() => {
                        setPreviewDraft(null);
                        setInspectFocusLabel(null);
                        setIsComparingSaved(false);
                      }}
                      className="min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10px] sm:text-[11px] font-mono font-semibold whitespace-nowrap"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      data-testid="btn-buy-preview"
                      disabled={!isUnlocked || coins < previewSummary.totalCost}
                      onClick={handleCommitPreview}
                      className={`min-h-[32px] sm:min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-bold whitespace-nowrap transition-colors ${
                        isUnlocked && coins >= previewSummary.totalCost
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      {!isUnlocked
                        ? 'Car Locked'
                        : previewSummary.totalCost === 0
                        ? 'Apply Free'
                        : coins >= previewSummary.totalCost
                        ? `Buy & Equip (${previewSummary.totalCost} CR)`
                        : `Need ${previewSummary.totalCost} CR`}
                    </button>
                  </div>
                </div>
              )}

              {/* Camera Angle Presets + Continuous Slider */}
              <div className="flex overflow-x-auto touch-pan-x scrollbar-none sm:grid sm:grid-cols-5 gap-1.5 mt-1.5 sm:mt-2">
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
                      className={`shrink-0 min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-1 py-0.5 sm:py-1 rounded-md text-[10px] font-mono font-semibold transition-colors whitespace-nowrap ${
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

              <div className="hidden sm:flex items-center gap-2 mt-1.5">
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

              {/* Interactive Hardware Checks */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                <button
                  type="button"
                  onClick={triggerTestFlash}
                  className={`min-h-[32px] sm:min-h-[38px] px-1.5 py-0.5 sm:py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1 transition-colors ${
                    previewFlashing
                      ? 'bg-cyan-400 border-white text-slate-950 font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-cyan-300'
                  }`}
                >
                  <Zap className="w-3 h-3 shrink-0 hidden sm:inline" />
                  <span>Test Flash</span>
                </button>
                <button
                  type="button"
                  onClick={triggerTestHorn}
                  className="min-h-[32px] sm:min-h-[38px] px-1.5 py-0.5 sm:py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] sm:text-[11px] font-mono font-semibold text-amber-300 whitespace-nowrap inline-flex items-center justify-center gap-1"
                >
                  <Volume2 className="w-3 h-3 shrink-0 hidden sm:inline" />
                  <span>Test Horn</span>
                </button>
                <button
                  type="button"
                  onClick={triggerTestRev}
                  className={`min-h-[32px] sm:min-h-[38px] px-1.5 py-0.5 sm:py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1 transition-colors ${
                    previewRevving
                      ? 'bg-rose-500 border-white text-slate-950 font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-rose-300'
                  }`}
                >
                  <Flame className="w-3 h-3 shrink-0 hidden sm:inline" />
                  <span>Rev Flames</span>
                </button>
                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => {
                    setPreviewDraft(null);
                    setInspectFocusLabel(null);
                    setIsComparingSaved(false);
                    onResetCustomization(previewCar);
                  }}
                  className="min-h-[32px] sm:min-h-[38px] px-1.5 py-0.5 sm:py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-800 text-[10px] sm:text-[11px] font-mono font-semibold text-slate-300 whitespace-nowrap inline-flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3 shrink-0 hidden sm:inline" />
                  <span>Reset Stock</span>
                </button>
              </div>
            </div>

            {/* Unboxed Telemetry Readout */}
            <div className="mt-1.5 sm:mt-2.5 pt-1.5 sm:pt-2.5 border-t border-slate-800/80 space-y-1.5 sm:space-y-2">
              <div className="hidden sm:flex items-center justify-between gap-2">
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

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 font-mono tabular-nums">
                <div>
                  <div className="flex items-baseline justify-between text-[10px] mb-1">
                    <span className="text-slate-400">SPEED</span>
                    <span className="text-white font-bold">
                      {speedKmh}
                      {speedDelta !== 0 && (
                        <span className={speedDelta > 0 ? 'text-emerald-400 ml-1' : 'text-rose-400 ml-1'}>
                          ({speedDelta > 0 ? `+${speedDelta}` : speedDelta})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${speedPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-[10px] mb-1">
                    <span className="text-slate-400">GRIP</span>
                    <span className="text-cyan-300 font-bold">
                      {gripPct}
                      {gripDelta !== 0 && (
                        <span className={gripDelta > 0 ? 'text-emerald-400 ml-1' : 'text-rose-400 ml-1'}>
                          ({gripDelta > 0 ? `+${gripDelta}` : gripDelta})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all" style={{ width: `${gripPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-[10px] mb-1">
                    <span className="text-slate-400">FEVER</span>
                    <span className="text-emerald-300 font-bold">
                      {effective.feverGainRate.toFixed(2)}x
                      {Math.abs(feverDelta) >= 0.01 && (
                        <span className={feverDelta > 0 ? 'text-emerald-400 ml-1' : 'text-rose-400 ml-1'}>
                          ({feverDelta > 0 ? `+${feverDelta.toFixed(2)}` : feverDelta.toFixed(2)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-400 transition-all" style={{ width: `${feverPct}%` }} />
                  </div>
                </div>
              </div>

              {customSpriteUrl && (
                <div className="pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-xs">
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

          {/* ZONE C: STREAMLINED MOD & TUNING WORKSHOP (Independently scrollable on all sizes) */}
          <section
            data-testid="garage-shop-scroll"
            className="flex-1 min-h-0 overflow-y-auto touch-pan-y overscroll-contain lg:col-span-6 flex flex-col bg-[#090e1a]"
          >
            {/* Sticky Workshop Navigation Tabs */}
            <div
              className="sticky top-0 z-10 shrink-0 flex overflow-x-auto touch-pan-x lg:flex-wrap scrollbar-none gap-1.5 px-3 sm:px-4 pt-2.5 pb-2 border-b border-slate-800 bg-[#0b101d]"
              role="tablist"
              aria-label="Mod Shop Categories"
            >
              {(
                [
                  ['repair', 'Repair Bay'],
                  ['body', 'Style & Body'],
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
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
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

            {/* Active Workshop Content (Unboxed sections with generous bottom scroll cushion) */}
            <div className="p-3.5 sm:p-5 pb-8 space-y-5 text-xs">
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
                    const nextUpgrades: CarUpgradeLevels = {
                      ...upgrades,
                      [statKey]: Math.min(5, lv + 1),
                    };
                    const nextEff = computeDamagedStats(
                      computeEffectiveCarStats(previewCar, nextUpgrades, currentCustom),
                      previewDamage
                    );
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
                    const nextHint =
                      lv >= 5
                        ? 'MAX'
                        : statKey === 'speed'
                        ? `Next Lv.${lv + 1}: ${Math.round(nextEff.topSpeed * 8.5)} KM/H (+${
                            Math.round(nextEff.topSpeed * 8.5) - Math.round(effective.topSpeed * 8.5)
                          })`
                        : statKey === 'handling'
                        ? `Next Lv.${lv + 1}: +${nextEff.roadAllowanceBonus.toFixed(2)}m (+${(
                            nextEff.roadAllowanceBonus - effective.roadAllowanceBonus
                          ).toFixed(2)}m)`
                        : `Next Lv.${lv + 1}: ${nextEff.magnetRadius.toFixed(1)}m (+${(
                            nextEff.magnetRadius - effective.magnetRadius
                          ).toFixed(1)}m)`;

                    return (
                      <div
                        key={statKey}
                        className={idx > 0 ? 'pt-4 border-t border-slate-800/80' : ''}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-slate-100">{label}</span>
                          <span className="font-mono tabular-nums text-amber-400 font-semibold">
                            Lv.{lv}/5 · {readout}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-cyan-300/90 mb-2">
                          {nextHint}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map((step) => (
                              <div
                                key={step}
                                className={`h-2.5 rounded-sm ${
                                  step <= lv
                                    ? 'bg-amber-400'
                                    : step === lv + 1
                                    ? 'bg-cyan-500/45 border border-cyan-400/60'
                                    : 'bg-slate-800'
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
                  {/* Car-Specific Style Upgrade Packages (Preview Anytime · CR Required to Buy) */}
                  <div data-testid="style-packages-section">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-[11px] font-mono font-semibold text-amber-300 uppercase tracking-wider">
                        {previewCar.name} Style Kits
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        {isUnlocked ? 'Tap to Preview · CR to Buy' : 'Tap to Preview · Unlock Car to Buy'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {stylePackages.map((pkg) => {
                        const owned = isCarModOwned(carOwnedMods, 'style', pkg.id, pkg.cost);
                        const isSavedActive = savedCustom.stylePackageId === pkg.id;
                        const isPreviewed = Boolean(previewDraft && currentCustom.stylePackageId === pkg.id && !isSavedActive);
                        const canBuyNow = isUnlocked && (owned || coins >= pkg.cost);
                        return (
                          <div
                            key={pkg.id}
                            className={`rounded-xl border transition-colors ${
                              isPreviewed
                                ? 'border-cyan-400 bg-cyan-950/30 text-white'
                                : isSavedActive
                                ? 'border-amber-400 bg-amber-950/35 text-white'
                                : 'border-slate-700/90 bg-slate-900/80 hover:border-amber-400/70 text-slate-200'
                            }`}
                          >
                            <button
                              type="button"
                              data-style-pkg={pkg.id}
                              onClick={() => handleSelectOrPreviewStylePackage(pkg.id)}
                              className="w-full p-3 text-left flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono text-[9px] font-bold shrink-0">
                                    {pkg.badge}
                                  </span>
                                  <span className="font-display font-bold text-xs sm:text-sm truncate">
                                    {pkg.name}
                                  </span>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                                    isPreviewed
                                      ? 'bg-cyan-400 text-slate-950'
                                      : isSavedActive
                                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                                      : owned
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                                      : canBuyNow
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {isPreviewed
                                    ? `PREVIEW · ${owned ? 'OWNED' : `${pkg.cost} CR`}`
                                    : isSavedActive
                                    ? 'ACTIVE'
                                    : owned
                                    ? 'OWNED'
                                    : `${pkg.cost} CR`}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-snug">
                                {pkg.description}
                              </p>
                              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[10px] font-mono tabular-nums">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950/90 text-amber-300">
                                    +{Math.round(pkg.speedBonus * 8.5)} KM/H
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950/90 text-cyan-300">
                                    +{Math.round(pkg.gripBonus * 100)} GRIP
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950/90 text-emerald-300">
                                    +{pkg.feverBonus.toFixed(2)}x FEVER
                                  </span>
                                </div>
                                {!isSavedActive && !isPreviewed && (
                                  <span className="text-[10px] text-cyan-300/80">Tap to preview</span>
                                )}
                              </div>
                            </button>

                            {isPreviewed && (
                              <div className="px-3 pb-2.5 pt-1 border-t border-cyan-500/25 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono text-cyan-200/90">
                                  {!isUnlocked
                                    ? 'Unlock vehicle to purchase'
                                    : coins >= pkg.cost || owned
                                    ? 'Ready to install on your ride'
                                    : `Need ${(pkg.cost - coins).toLocaleString()} more CR`}
                                </span>
                                <button
                                  type="button"
                                  data-buy-style-pkg={pkg.id}
                                  disabled={!canBuyNow}
                                  onClick={() => handleBuySingleStylePackageNow(pkg.id)}
                                  className={`min-h-[30px] px-3 py-1 rounded-lg font-mono text-[10px] font-bold whitespace-nowrap transition-colors ${
                                    canBuyNow
                                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                                      : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                                  }`}
                                >
                                  {owned ? 'Equip Free' : `Buy (${pkg.cost} CR)`}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Body Paint Finish
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {compatMods.paints.map((p) => {
                        const selected = currentCustom.paint === p.id;
                        const isSavedSelected = savedCustom.paint === p.id && !previewDraft;
                        const isPreviewingItem = selected && !isSavedSelected;
                        const owned = isCarModOwned(carOwnedMods, 'paint', p.id, p.cost);
                        const affordable = isUnlocked && (owned || coins >= p.cost);
                        const swatchHex = p.hex || previewCar.primaryColor;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectOrPreviewMod('paint', p.id, p.displayLabel, p.cost)}
                            aria-label={`Paint ${p.displayLabel}`}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              isPreviewingItem
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100 font-bold'
                                : selected
                                ? 'border-amber-400 bg-slate-800 text-white font-bold'
                                : affordable
                                ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-sm border border-white/25 shrink-0"
                              style={{ backgroundColor: swatchHex }}
                            />
                            <span>{p.displayLabel}</span>
                            <span className="text-[10px] font-mono text-amber-300/90">
                              {isPreviewingItem
                                ? `PREVIEW · ${owned ? 'OWNED' : `${p.cost}`}`
                                : selected
                                ? ''
                                : p.cost === 0
                                ? 'STD'
                                : owned
                                ? 'OWNED'
                                : `${p.cost}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(compatMods.showHood || compatMods.showRoof) && (
                    <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {compatMods.showHood && (
                        <div>
                          <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Hood Modification
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {compatMods.hoods.map((h) => {
                              const selected = (currentCustom.hood || 'stock') === h.id;
                              const isSavedSelected = (savedCustom.hood || 'stock') === h.id && !previewDraft;
                              const isPreviewingItem = selected && !isSavedSelected;
                              const owned = isCarModOwned(carOwnedMods, 'hood', h.id, h.cost);
                              const affordable = isUnlocked && (owned || coins >= h.cost);
                              return (
                                <button
                                  key={h.id}
                                  type="button"
                                  onClick={() => handleSelectOrPreviewMod('hood', h.id, h.displayLabel, h.cost)}
                                  className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                    isPreviewingItem
                                      ? 'border-cyan-400 bg-cyan-950/70 text-cyan-100 font-bold'
                                      : selected
                                      ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                      : affordable
                                      ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                      : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                                  }`}
                                >
                                  <span>{h.displayLabel}</span>
                                  {(isPreviewingItem || (!selected && h.cost > 0)) && (
                                    <span className="text-[10px] font-mono text-amber-300/90">
                                      {isPreviewingItem ? `PREVIEW` : owned ? 'OWNED' : `${h.cost}`}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {compatMods.showRoof && (
                        <div>
                          <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Roof Hardware
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {compatMods.roofs.map((rf) => {
                              const selected = (currentCustom.roof || 'stock') === rf.id;
                              const isSavedSelected = (savedCustom.roof || 'stock') === rf.id && !previewDraft;
                              const isPreviewingItem = selected && !isSavedSelected;
                              const owned = isCarModOwned(carOwnedMods, 'roof', rf.id, rf.cost);
                              const affordable = isUnlocked && (owned || coins >= rf.cost);
                              return (
                                <button
                                  key={rf.id}
                                  type="button"
                                  onClick={() => handleSelectOrPreviewMod('roof', rf.id, rf.displayLabel, rf.cost)}
                                  className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                    isPreviewingItem
                                      ? 'border-cyan-400 bg-cyan-950/70 text-cyan-100 font-bold'
                                      : selected
                                      ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                      : affordable
                                      ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                      : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                                  }`}
                                >
                                  <span>{rf.displayLabel}</span>
                                  {(isPreviewingItem || (!selected && rf.cost > 0)) && (
                                    <span className="text-[10px] font-mono text-amber-300/90">
                                      {isPreviewingItem ? `PREVIEW` : owned ? 'OWNED' : `${rf.cost}`}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {compatMods.showWindows && (
                      <div>
                        <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Window Tint &amp; Cage
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {compatMods.windows.map((w) => {
                            const selected = (currentCustom.windows || 'stock') === w.id;
                            const isSavedSelected = (savedCustom.windows || 'stock') === w.id && !previewDraft;
                            const isPreviewingItem = selected && !isSavedSelected;
                            const owned = isCarModOwned(carOwnedMods, 'windows', w.id, w.cost);
                            const affordable = isUnlocked && (owned || coins >= w.cost);
                            return (
                              <button
                                key={w.id}
                                type="button"
                                onClick={() => handleSelectOrPreviewMod('windows', w.id, w.displayLabel, w.cost)}
                                className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                  isPreviewingItem
                                    ? 'border-cyan-400 bg-cyan-950/70 text-cyan-100 font-bold'
                                    : selected
                                    ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                    : affordable
                                    ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                    : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                                }`}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-sm border border-white/25"
                                  style={{ backgroundColor: w.midHex }}
                                />
                                <span>{w.displayLabel}</span>
                                {(isPreviewingItem || (!selected && w.cost > 0)) && (
                                  <span className="text-[10px] font-mono text-amber-300/90">
                                    {isPreviewingItem ? `PREVIEW` : owned ? 'OWNED' : `${w.cost}`}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className={compatMods.showWindows ? '' : 'sm:col-span-2'}>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Livery &amp; Door Number
                      </h4>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {compatMods.liveries.map((l) => {
                          const selected = currentCustom.livery === l.id;
                          const isSavedSelected = savedCustom.livery === l.id && !previewDraft;
                          const isPreviewingItem = selected && !isSavedSelected;
                          const owned = isCarModOwned(carOwnedMods, 'livery', l.id, l.cost);
                          const affordable = isUnlocked && (owned || coins >= l.cost);
                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => handleSelectOrPreviewMod('livery', l.id, l.displayLabel, l.cost)}
                              className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                isPreviewingItem
                                  ? 'border-cyan-400 bg-cyan-950/70 text-cyan-100 font-bold'
                                  : selected
                                  ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                  : affordable
                                  ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                  : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                              }`}
                            >
                              <span>{l.displayLabel}</span>
                              {(isPreviewingItem || (!selected && l.cost > 0)) && (
                                <span className="text-[10px] font-mono text-amber-300/90">
                                  {isPreviewingItem ? `PREVIEW` : owned ? 'OWNED' : `${l.cost}`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {NUMBER_OPTIONS.map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              setCustomField('number', num);
                              showFocusCue('livery', `#${num}`, !isUnlocked || Boolean(previewDraft));
                            }}
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
                      {compatMods.tires.map((t) => {
                        const selected = (currentCustom.tires || 'stock') === t.id;
                        const isSavedSelected = (savedCustom.tires || 'stock') === t.id && !previewDraft;
                        const isPreviewingItem = selected && !isSavedSelected;
                        const owned = isCarModOwned(carOwnedMods, 'tires', t.id, t.cost);
                        const affordable = isUnlocked && (owned || coins >= t.cost);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectOrPreviewMod('tires', t.id, t.displayLabel, t.cost)}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              isPreviewingItem
                                ? 'border-cyan-400 bg-cyan-950/70 text-cyan-100 font-bold'
                                : selected
                                ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                : affordable
                                ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                            }`}
                          >
                            {t.stripeHex && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/30"
                                style={{ backgroundColor: t.stripeHex }}
                              />
                            )}
                            <span>{t.displayLabel}</span>
                            {(isPreviewingItem || (!selected && t.cost > 0)) && (
                              <span className="text-[10px] font-mono text-amber-300/90">
                                {isPreviewingItem ? `PREVIEW` : owned ? 'OWNED' : `${t.cost}`}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Deep-Dish Wheel Finish
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {compatMods.rims.map((r) => {
                        const selected = currentCustom.rims === r.id;
                        const isSavedSelected = savedCustom.rims === r.id && !previewDraft;
                        const isPreviewingItem = selected && !isSavedSelected;
                        const owned = isCarModOwned(carOwnedMods, 'rims', r.id, r.cost);
                        const affordable = isUnlocked && (owned || coins >= r.cost);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => handleSelectOrPreviewMod('rims', r.id, r.displayLabel, r.cost)}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              isPreviewingItem
                                ? 'border-cyan-400 bg-cyan-950/70 text-cyan-100 font-bold'
                                : selected
                                ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                : affordable
                                ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                            }`}
                          >
                            {r.hex && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/30"
                                style={{ backgroundColor: r.hex }}
                              />
                            )}
                            <span>{r.displayLabel}</span>
                            {(isPreviewingItem || (!selected && r.cost > 0)) && (
                              <span className="text-[10px] font-mono text-amber-300/90">
                                {isPreviewingItem ? `PREVIEW` : owned ? 'OWNED' : `${r.cost}`}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Rear Wing Downforce Kit
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {compatMods.wings.map((w) => {
                        const selected = currentCustom.wing === w.id;
                        const isSavedSelected = savedCustom.wing === w.id && !previewDraft;
                        const isPreviewingItem = selected && !isSavedSelected;
                        const owned = isCarModOwned(carOwnedMods, 'wing', w.id, w.cost);
                        const affordable = isUnlocked && (owned || coins >= w.cost);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => handleSelectOrPreviewMod('wing', w.id, w.displayLabel, w.cost)}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              isPreviewingItem
                                ? 'border-cyan-400 bg-cyan-950/70 text-cyan-100 font-bold'
                                : selected
                                ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                : affordable
                                ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                            }`}
                          >
                            <span>{w.displayLabel}</span>
                            {(isPreviewingItem || (!selected && w.cost > 0)) && (
                              <span className="text-[10px] font-mono text-amber-300/90">
                                {isPreviewingItem ? `PREVIEW` : owned ? 'OWNED' : `${w.cost}`}
                              </span>
                            )}
                          </button>
                        );
                      })}
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
                        const isSavedSelected =
                          !previewDraft &&
                          ((savedCustom.underglowColor || 'none') === u.id ||
                            (!savedCustom.underglowColor && savedCustom.underglow === u.id));
                        const isPreviewingItem = isSelected && !isSavedSelected;
                        const owned = isCarModOwned(carOwnedMods, 'underglow', u.id, u.cost);
                        const affordable = isUnlocked && (owned || coins >= u.cost);
                        const isRainbow = u.id === 'rainbow';

                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleSelectOrPreviewMod('underglow', u.id, u.label, u.cost)}
                            className={`p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors ${
                              isPreviewingItem
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100'
                                : isSelected
                                ? 'border-amber-400 bg-amber-950/40 text-amber-100'
                                : affordable
                                ? 'border-slate-800 bg-slate-900/70 hover:border-slate-700 text-slate-300'
                                : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
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
                            <span className="text-[10px] font-mono text-amber-300/90 shrink-0">
                              {isPreviewingItem
                                ? 'PREVIEW'
                                : isSelected
                                ? 'ACTIVE'
                                : u.cost === 0
                                ? 'STD'
                                : owned
                                ? 'OWNED'
                                : `${u.cost} CR`}
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
                        const isSavedSelected =
                          !previewDraft &&
                          (savedCustom.hornType || (savedCustom.horn as unknown as string) || 'dual') === hrn.id;
                        const isPreviewingItem = isSelected && !isSavedSelected;
                        const owned = isCarModOwned(carOwnedMods, 'horn', hrn.id, hrn.cost);
                        const affordable = isUnlocked && (owned || coins >= hrn.cost);

                        return (
                          <button
                            key={hrn.id}
                            type="button"
                            onClick={() => handleSelectOrPreviewMod('horn', hrn.id, hrn.label, hrn.cost)}
                            className={`p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors ${
                              isPreviewingItem
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100'
                                : isSelected
                                ? 'border-amber-400 bg-amber-950/50 text-amber-100'
                                : affordable
                                ? 'border-slate-800 bg-slate-900/70 hover:border-slate-700 text-slate-300'
                                : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-[11px] font-semibold truncate">{hrn.label}</span>
                            <span className="text-[10px] font-mono text-amber-300/90 shrink-0">
                              {isPreviewingItem
                                ? 'PREVIEW'
                                : isSelected
                                ? 'ACTIVE'
                                : hrn.cost === 0
                                ? 'STD'
                                : owned
                                ? 'OWNED'
                                : `${hrn.cost} CR`}
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
                      {compatMods.engines.map((eng) => {
                        const selected = (currentCustom.engine || 'stock') === eng.id;
                        const isSavedSelected = (savedCustom.engine || 'stock') === eng.id && !previewDraft;
                        const isPreviewingItem = selected && !isSavedSelected;
                        const owned = isCarModOwned(carOwnedMods, 'engine', eng.id, eng.cost);
                        const affordable = isUnlocked && (owned || coins >= eng.cost);
                        return (
                          <button
                            key={eng.id}
                            type="button"
                            onClick={() => handleSelectOrPreviewMod('engine', eng.id, eng.displayLabel, eng.cost)}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              isPreviewingItem
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100 font-bold'
                                : selected
                                ? 'border-amber-400 bg-amber-950/50 text-amber-200 font-bold'
                                : affordable
                                ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                            }`}
                          >
                            <span>{eng.displayLabel}</span>
                            <span className="text-[10px] font-mono text-cyan-400">{eng.tag}</span>
                            {(isPreviewingItem || (!selected && eng.cost > 0)) && (
                              <span className="text-[10px] font-mono text-amber-300/90">
                                {isPreviewingItem ? 'PREVIEW' : owned ? 'OWNED' : `${eng.cost}`}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Exhaust Piping
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {compatMods.exhausts.map((ex) => {
                          const selected = (currentCustom.exhaust || 'stock') === ex.id;
                          const isSavedSelected = (savedCustom.exhaust || 'stock') === ex.id && !previewDraft;
                          const isPreviewingItem = selected && !isSavedSelected;
                          const owned = isCarModOwned(carOwnedMods, 'exhaust', ex.id, ex.cost);
                          const affordable = isUnlocked && (owned || coins >= ex.cost);
                          return (
                            <button
                              key={ex.id}
                              type="button"
                              onClick={() => handleSelectOrPreviewMod('exhaust', ex.id, ex.displayLabel, ex.cost)}
                              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                isPreviewingItem
                                  ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100 font-bold'
                                  : selected
                                  ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                  : affordable
                                  ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                  : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                              }`}
                            >
                              <span>{ex.displayLabel}</span>
                              {(isPreviewingItem || (!selected && ex.cost > 0)) && (
                                <span className="text-[10px] font-mono text-amber-300/90">
                                  {isPreviewingItem ? 'PREVIEW' : owned ? 'OWNED' : `${ex.cost}`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Backfire Flame Hue
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {compatMods.flames.map((f) => {
                          const selected = currentCustom.flame === f.id;
                          const isSavedSelected = savedCustom.flame === f.id && !previewDraft;
                          const isPreviewingItem = selected && !isSavedSelected;
                          const owned = isCarModOwned(carOwnedMods, 'flame', f.id, f.cost);
                          const affordable = isUnlocked && (owned || coins >= f.cost);
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => handleSelectOrPreviewMod('flame', f.id, f.displayLabel, f.cost)}
                              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                isPreviewingItem
                                  ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100 font-bold'
                                  : selected
                                  ? 'border-amber-400 bg-amber-950/60 text-amber-200 font-bold'
                                  : affordable
                                  ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                  : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                              }`}
                            >
                              {f.outer && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: f.outer }}
                                />
                              )}
                              <span>{f.displayLabel}</span>
                              {(isPreviewingItem || (!selected && f.cost > 0)) && (
                                <span className="text-[10px] font-mono text-amber-300/90">
                                  {isPreviewingItem ? 'PREVIEW' : owned ? 'OWNED' : `${f.cost}`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Exhaust Note
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {compatMods.sounds.map((snd) => {
                          const selected = (currentCustom.sound || 'stock') === snd.id;
                          const isSavedSelected = (savedCustom.sound || 'stock') === snd.id && !previewDraft;
                          const isPreviewingItem = selected && !isSavedSelected;
                          const owned = isCarModOwned(carOwnedMods, 'sound', snd.id, snd.cost);
                          const affordable = isUnlocked && (owned || coins >= snd.cost);
                          return (
                            <button
                              key={snd.id}
                              type="button"
                              onClick={() => handleSelectOrPreviewMod('sound', snd.id, snd.displayLabel, snd.cost)}
                              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                isPreviewingItem
                                  ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100 font-bold'
                                  : selected
                                  ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                  : affordable
                                  ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                  : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                              }`}
                            >
                              <span>{snd.displayLabel}</span>
                              {(isPreviewingItem || (!selected && snd.cost > 0)) && (
                                <span className="text-[10px] font-mono text-amber-300/90">
                                  {isPreviewingItem ? 'PREVIEW' : owned ? 'OWNED' : `${snd.cost}`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Headlight Optics
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {compatMods.lights.map((hl) => {
                          const selected = (currentCustom.lights || 'stock') === hl.id;
                          const isSavedSelected = (savedCustom.lights || 'stock') === hl.id && !previewDraft;
                          const isPreviewingItem = selected && !isSavedSelected;
                          const owned = isCarModOwned(carOwnedMods, 'lights', hl.id, hl.cost);
                          const affordable = isUnlocked && (owned || coins >= hl.cost);
                          return (
                            <button
                              key={hl.id}
                              type="button"
                              onClick={() => handleSelectOrPreviewMod('lights', hl.id, hl.displayLabel, hl.cost)}
                              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                isPreviewingItem
                                  ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100 font-bold'
                                  : selected
                                  ? 'border-amber-400 bg-amber-950/40 text-amber-100 font-bold'
                                  : affordable
                                  ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                                  : 'border-slate-800/80 bg-slate-950/80 text-slate-400 hover:border-cyan-500/60 hover:text-slate-200'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/30"
                                style={{ backgroundColor: hl.beamHex }}
                              />
                              <span>{hl.displayLabel}</span>
                              {(isPreviewingItem || (!selected && hl.cost > 0)) && (
                                <span className="text-[10px] font-mono text-amber-300/90">
                                  {isPreviewingItem ? 'PREVIEW' : owned ? 'OWNED' : `${hl.cost}`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* MOBILE FULL-SCREEN VEHICLE ROSTER DRAWER (< lg) */}
        {mobileRosterOpen && (
          <div
            data-testid="mobile-roster-drawer"
            className="lg:hidden absolute inset-0 z-30 flex flex-col bg-[#080c17]"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-800 bg-[#0b101d] shrink-0">
              <h3 className="text-sm font-display font-bold text-white">
                Select Vehicle ({filteredCars.length}/{CAR_ROSTER.length})
              </h3>
              <button
                type="button"
                onClick={() => setMobileRosterOpen(false)}
                className="min-h-[38px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>

            <div className="px-3 py-2.5 border-b border-slate-800 bg-[#090e1a] space-y-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${CAR_ROSTER.length} vehicles...`}
                  aria-label="Search vehicles mobile"
                  className="w-full min-h-[40px] pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs text-white placeholder-slate-500 font-mono"
                />
              </div>
              <div className="flex overflow-x-auto touch-pan-x scrollbar-none gap-1.5">
                {CATEGORY_TABS.map((tab) => {
                  const count = categoryCounts[tab.id] || 0;
                  const isActive = categoryFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryFilter(tab.id)}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        isActive
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {tab.label} <span className="opacity-70 font-mono tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y overscroll-contain p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
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
                      onClick={() => {
                        setPreviewCarId(car.id);
                        setMobileRosterOpen(false);
                      }}
                      className={`w-full min-h-[64px] p-2.5 rounded-xl border text-left transition-colors flex items-center gap-3 ${
                        active
                          ? 'border-amber-400 bg-slate-900'
                          : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
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
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
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
          </div>
        )}
      </div>

      {/* 3. PINNED ACTION BAR (Solid surface — smooth UI) */}
      <footer className="shrink-0 border-t border-slate-800 bg-[#0b101d] px-3 sm:px-6 py-2 sm:py-3 pb-safe flex items-center justify-between gap-3">
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
