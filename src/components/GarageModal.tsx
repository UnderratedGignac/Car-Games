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
  WINDOW_OPTIONS,
  WING_OPTIONS,
  computeEffectiveCarStats,
  getUpgradeCost,
  resolveCarAppearance,
} from '../game/rules';
import { getPixelCarCanvas } from '../game/pixelSprites';
import { soundFX } from '../game/audio';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
  selectedCarId: string;
  unlockedCarIds: string[];
  carUpgrades: Record<string, CarUpgradeLevels>;
  carCustomizations: Record<string, CarCustomization>;
  customSpriteUrl: string;
  onSelectCar: (carId: string) => void;
  onUnlockCar: (car: CarSpec) => void;
  onUpgradeStat: (car: CarSpec, stat: keyof CarUpgradeLevels) => void;
  onUpdateCustomization: (carId: string, nextCustom: CarCustomization) => void;
  onClearCustomSprite: () => void;
}

type GarageTabId = 'performance' | 'body' | 'wheels_aero' | 'power_audio';

export const GarageModal: React.FC<GarageModalProps> = ({
  isOpen,
  onClose,
  coins,
  selectedCarId,
  unlockedCarIds,
  carUpgrades,
  carCustomizations,
  customSpriteUrl,
  onSelectCar,
  onUnlockCar,
  onUpgradeStat,
  onUpdateCustomization,
  onClearCustomSprite,
}) => {
  const [previewCarId, setPreviewCarId] = useState<string>(selectedCarId);
  const [previewDir, setPreviewDir] = useState<DiagonalDirection>('right');
  const [activeTab, setActiveTab] = useState<GarageTabId>('body');
  const [previewFlashing, setPreviewFlashing] = useState<boolean>(false);
  const [previewRevving, setPreviewRevving] = useState<boolean>(false);
  const [previewSpin, setPreviewSpin] = useState<number>(0);
  const spriteCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setPreviewCarId(selectedCarId);
  }, [selectedCarId, isOpen]);

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
  const resolved = resolveCarAppearance(previewCar, currentCustom);
  const effective = computeEffectiveCarStats(previewCar, upgrades, currentCustom);

  // Subtle wheel/flame toggle animation while previewing gas flames
  useEffect(() => {
    if (!isOpen || !previewRevving) return;
    const id = window.setInterval(() => {
      setPreviewSpin((s) => (s + 1) % 2);
    }, 110);
    return () => window.clearInterval(id);
  }, [isOpen, previewRevving]);

  // Render crisp 1:1 3D pixel-art sprite from getPixelCarCanvas
  useEffect(() => {
    if (!isOpen || !spriteCanvasRef.current) return;
    const canvas = spriteCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelSource = getPixelCarCanvas(
      previewCar,
      previewDir === 'right' ? 0.72 : -0.72,
      false,
      false,
      previewSpin,
      currentCustom,
      previewRevving ? 'gas' : 'coast',
      previewFlashing
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    // Scale 144x108 into 288x216 centered inside 300x220
    const drawW = 288;
    const drawH = 216;
    ctx.drawImage(
      pixelSource,
      Math.round((canvas.width - drawW) / 2),
      Math.round((canvas.height - drawH) / 2),
      drawW,
      drawH
    );
  }, [isOpen, previewCar, previewDir, currentCustom, previewSpin, previewRevving, previewFlashing]);

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
    soundFX.playHorn(resolved.horn);
  };

  const triggerTestRev = () => {
    setPreviewRevving(true);
    soundFX.playDriftFlip(4, false);
    window.setTimeout(() => setPreviewRevving(false), 950);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#090e1a] sm:inset-3 sm:max-w-6xl sm:mx-auto sm:rounded-2xl border sm:border-slate-700/80 overflow-hidden pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Neon Redline 3D Garage and Mod Shop"
    >
      {/* 1. PINNED MOBILE HEADER */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 border-b border-slate-800 bg-[#090e1a] shrink-0 pt-safe">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-mono tracking-wider text-amber-400 truncate">
            {CAR_ROSTER.length} CHASSIS · 3D SHOWROOM
          </p>
          <h2 className="text-base sm:text-xl font-bold tracking-tight font-display text-white truncate">
            Neon Redline Garage
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
            <span className="block text-[9px] font-mono text-slate-400">CREDITS</span>
            <span className="text-xs sm:text-base font-bold font-mono tabular-nums text-amber-400">
              {Math.round(coins).toLocaleString()} CR
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Garage"
            className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
          >
            <span>✕</span>
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      {/* 2. 14-CAR ROSTER STRIP (Touch-Scrollable Horizontal Carousel on Mobile) */}
      <div className="flex overflow-x-auto scrollbar-none snap-x gap-1.5 px-3 sm:px-5 py-2 bg-slate-950/60 border-b border-slate-800/80 shrink-0">
        {CAR_ROSTER.map((car) => {
          const unlocked = unlockedCarIds.includes(car.id);
          const active = previewCar.id === car.id;
          const equipped = selectedCarId === car.id;
          const swatch =
            PAINT_OPTIONS.find((p) => p.id === (carCustomizations[car.id]?.paint || 'stock'))?.hex ||
            car.primaryColor;
          return (
            <button
              key={car.id}
              type="button"
              onClick={() => setPreviewCarId(car.id)}
              className={`min-w-[118px] sm:min-w-[134px] p-2 rounded-xl border text-left transition-colors snap-start shrink-0 ${
                active
                  ? 'border-amber-400 bg-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono mb-0.5">
                <span className="flex items-center gap-1 font-bold text-slate-300">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/30 inline-block shrink-0"
                    style={{ backgroundColor: swatch }}
                  />
                  T{car.tier}
                </span>
                <span
                  className={
                    equipped
                      ? 'text-emerald-400 font-bold'
                      : unlocked
                      ? 'text-cyan-400'
                      : 'text-amber-400'
                  }
                >
                  {equipped ? 'ACTIVE' : unlocked ? 'OWNED' : `${car.unlockCost}`}
                </span>
              </div>
              <div className="text-[11px] font-bold font-display leading-tight truncate text-slate-100">
                {car.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. SCROLLABLE MIDDLE BODY */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 min-h-0 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: 2D Pixel Showcase & Testing Bay */}
          <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-mono text-slate-300 truncate font-semibold">
                {previewCar.codename} · T{previewCar.tier}
              </span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewDir('left')}
                  className={`min-h-[34px] px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors whitespace-nowrap ${
                    previewDir === 'left'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  \ Left Drift
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDir('right')}
                  className={`min-h-[34px] px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors whitespace-nowrap ${
                    previewDir === 'right'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  / Right Drift
                </button>
              </div>
            </div>

            {/* Turntable Bay: 2D Pixel Canvas */}
            <div
              className="relative flex items-center justify-center h-48 sm:h-60 rounded-xl overflow-hidden bg-slate-900 border border-slate-800"
              style={{
                backgroundImage: previewFlashing
                  ? `radial-gradient(circle at ${previewDir === 'right' ? '72% 38%' : '28% 38%'}, ${resolved.headlightBeamHex}77, rgba(15, 23, 42, 0.96) 70%)`
                  : resolved.underglowHex
                  ? `radial-gradient(circle at 50% 66%, ${resolved.underglowHex}38, rgba(15, 23, 42, 0.96) 72%)`
                  : 'radial-gradient(circle at 50% 62%, rgba(251, 191, 36, 0.14), rgba(15, 23, 42, 0.96) 72%)',
              }}
            >
              {previewFlashing && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      previewDir === 'right'
                        ? `linear-gradient(28deg, transparent 42%, ${resolved.headlightBeamHex}55 78%, ${resolved.headlightBeamHex}99 100%)`
                        : `linear-gradient(152deg, transparent 42%, ${resolved.headlightBeamHex}55 78%, ${resolved.headlightBeamHex}99 100%)`,
                  }}
                />
              )}
              <canvas
                ref={spriteCanvasRef}
                width={300}
                height={220}
                style={{ imageRendering: 'pixelated' }}
                className="relative z-10 w-64 h-44 sm:w-72 sm:h-52 object-contain"
              />
            </div>

            {/* Interactive Rig Tester Buttons: Flash / Horn / Rev Flames + Reset */}
            <div className="grid grid-cols-4 gap-1.5 mt-2.5">
              <button
                type="button"
                onClick={triggerTestFlash}
                className={`min-h-[40px] px-1 sm:px-2 py-1.5 rounded-lg border text-[10px] sm:text-[11px] font-mono font-semibold whitespace-nowrap transition-colors ${
                  previewFlashing
                    ? 'bg-cyan-400 border-white text-slate-950 font-bold'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
                }`}
              >
                Test Flash
              </button>
              <button
                type="button"
                onClick={triggerTestHorn}
                className="min-h-[40px] px-1 sm:px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] sm:text-[11px] font-mono font-semibold text-amber-300 whitespace-nowrap"
              >
                Test Horn
              </button>
              <button
                type="button"
                onClick={triggerTestRev}
                className={`min-h-[40px] px-1 sm:px-2 py-1.5 rounded-lg border text-[10px] sm:text-[11px] font-mono font-semibold whitespace-nowrap transition-colors ${
                  previewRevving
                    ? 'bg-rose-500 border-white text-slate-950 font-bold'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-rose-300'
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
                className="min-h-[40px] px-1 sm:px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] sm:text-[11px] font-mono font-semibold text-slate-300 whitespace-nowrap"
              >
                Reset
              </button>
            </div>

            {/* Vehicle Summary & Live Computed Spec Readout */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-white">
                  {previewCar.name}
                </h3>
                <span className="text-[11px] font-mono tabular-nums text-amber-400 shrink-0 font-bold">
                  {previewCar.coinMultiplier.toFixed(1)}x CR
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {previewCar.tagline}
              </p>

              <div className="grid grid-cols-3 gap-1.5 mt-2.5 text-center font-mono tabular-nums">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="block text-[9px] text-slate-400 font-semibold">TOP SPEED</span>
                  <span className="text-xs font-bold text-white">
                    {Math.round(effective.topSpeed * 8.5)} KM/H
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="block text-[9px] text-slate-400 font-semibold">GRIP</span>
                  <span className="text-xs font-bold text-cyan-300">
                    {Math.round(effective.driftGrip * 100)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="block text-[9px] text-slate-400 font-semibold">FEVER RATE</span>
                  <span className="text-xs font-bold text-amber-300">
                    {effective.feverGainRate.toFixed(2)}x
                  </span>
                </div>
              </div>
            </div>

            {customSpriteUrl && (
              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-cyan-400 font-medium">Custom AI Livery Active</span>
                <button
                  type="button"
                  onClick={onClearCustomSprite}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap"
                >
                  Reset AI Sprite
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Organized 4-Tab Tuning & Mod Shop */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5 sm:p-4">
            <div>
              {/* Primary Category Sub-Tabs */}
              <div className="mb-3.5 pb-3 border-b border-slate-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="tablist" aria-label="Mod Shop Categories">
                  {(
                    [
                      ['body', 'Body & Paint'],
                      ['wheels_aero', 'Wheels & Aero'],
                      ['power_audio', 'Engine & Lights'],
                      ['performance', 'Stat Upgrades'],
                    ] as const
                  ).map(([tabId, tabLabel]) => (
                    <button
                      key={tabId}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tabId}
                      onClick={() => setActiveTab(tabId)}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        activeTab === tabId
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {tabLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* TAB 1: STAT UPGRADES */}
              {activeTab === 'performance' && (
                <div className="space-y-3">
                  {(['speed', 'handling', 'magnet'] as const).map((statKey) => {
                    const lv = upgrades[statKey] || 1;
                    const cost = getUpgradeCost(previewCar.tier, lv);
                    const label =
                      statKey === 'speed'
                        ? '01. Diagonal Velocity & Top Speed'
                        : statKey === 'handling'
                        ? '02. Tire Grip & Edge Drift Forgiveness'
                        : '03. Nitro Coin Magnet Radius';
                    const readout =
                      statKey === 'speed'
                        ? `${Math.round(effective.topSpeed * 8.5)} KM/H`
                        : statKey === 'handling'
                        ? `+${effective.roadAllowanceBonus.toFixed(2)}m Hold`
                        : `${effective.magnetRadius.toFixed(1)}m Pull`;

                    return (
                      <div
                        key={statKey}
                        className="p-3 rounded-lg border border-slate-800 bg-slate-900/70"
                      >
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-semibold text-slate-200">{label}</span>
                          <span className="font-mono tabular-nums text-amber-400">
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
                            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              !isUnlocked
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : lv >= 5
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default'
                                : coins >= cost
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
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

              {/* TAB 2: PAINT, LIVERY, HOOD, ROOF & WINDOWS */}
              {activeTab === 'body' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                      BODY PAINT FINISH
                    </span>
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
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              selected
                                ? 'border-cyan-400 bg-slate-800 text-white font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-sm border border-white/30 shrink-0"
                              style={{ backgroundColor: swatchHex }}
                            />
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        HOOD MODIFICATION
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {HOOD_OPTIONS.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setCustomField('hood', h.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
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
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        ROOF HARDWARE
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ROOF_OPTIONS.map((rf) => (
                          <button
                            key={rf.id}
                            type="button"
                            onClick={() => setCustomField('roof', rf.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        WINDOW TINT &amp; CAGE
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {WINDOW_OPTIONS.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setCustomField('windows', w.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              (currentCustom.windows || 'stock') === w.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-sm border border-white/30"
                              style={{ backgroundColor: w.midHex }}
                            />
                            <span>{w.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        LIVERY &amp; NUMBER
                      </span>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {LIVERY_OPTIONS.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setCustomField('livery', l.id)}
                            className={`px-2 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
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
                            className={`min-w-[36px] px-2 py-1 rounded-lg border font-mono text-[11px] transition-colors ${
                              currentCustom.number === num
                                ? 'border-amber-400 bg-amber-500 text-slate-950 font-bold'
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

              {/* TAB 3: WHEELS, TIRES, WING & UNDERGLOW */}
              {activeTab === 'wheels_aero' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        TIRE COMPOUND &amp; PROFILE
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {TIRE_OPTIONS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setCustomField('tires', t.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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

                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        DEEP-DISH RIMS
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {RIM_OPTIONS.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setCustomField('rims', r.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        REAR WING AERO
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {WING_OPTIONS.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setCustomField('wing', w.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
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

                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        NEON UNDERGLOW
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {UNDERGLOW_OPTIONS.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setCustomField('underglow', u.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              currentCustom.underglow === u.id
                                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {u.hex && (
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: u.hex }}
                              />
                            )}
                            <span>{u.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ENGINE, EXHAUST, SOUND PROFILE, HORN & HEADLIGHTS */}
              {activeTab === 'power_audio' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                      ENGINE SWAP &amp; POWERTRAIN
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ENGINE_OPTIONS.map((eng) => (
                        <button
                          key={eng.id}
                          type="button"
                          onClick={() => setCustomField('engine', eng.id)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        EXHAUST PIPING
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {EXHAUST_OPTIONS.map((ex) => (
                          <button
                            key={ex.id}
                            type="button"
                            onClick={() => setCustomField('exhaust', ex.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
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
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        EXHAUST FLAME COLOR
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {FLAME_OPTIONS.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setCustomField('flame', f.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        EXHAUST SOUND PROFILE
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {SOUND_OPTIONS.map((snd) => (
                          <button
                            key={snd.id}
                            type="button"
                            onClick={() => setCustomField('sound', snd.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
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
                      <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                        HORN KIT
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {HORN_OPTIONS.map((hrn) => (
                          <button
                            key={hrn.id}
                            type="button"
                            onClick={() => {
                              setCustomField('horn', hrn.id);
                              soundFX.playHorn(hrn.id);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
                              (currentCustom.horn || 'stock') === hrn.id
                                ? 'border-amber-400 bg-amber-950/60 text-amber-200 font-bold'
                                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            {hrn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-mono font-semibold text-slate-400 mb-1.5">
                      HEADLIGHT &amp; HIGH-BEAM OPTICS
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {HEADLIGHT_OPTIONS.map((hl) => (
                        <button
                          key={hl.id}
                          type="button"
                          onClick={() => {
                            setCustomField('lights', hl.id);
                            triggerTestFlash();
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. PINNED STICKY BOTTOM ACTION BAR (Always visible for instant thumb access on mobile) */}
      <div className="flex-shrink-0 border-t border-slate-800 bg-[#090e1a]/95 backdrop-blur-md px-3 sm:px-5 py-2.5 pb-safe flex items-center justify-between gap-3 z-10 shadow-2xl">
        <div className="min-w-0 flex flex-col justify-center">
          <span className="text-xs sm:text-sm font-display font-bold text-white truncate">
            {previewCar.name}
          </span>
          <span className="text-[11px] font-mono text-slate-400 truncate">
            {isUnlocked
              ? isEquipped
                ? 'Ready on grid'
                : 'Unlocked · Tap to drive'
              : `Tier ${previewCar.tier} · ${previewCar.unlockCost.toLocaleString()} CR`}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {isUnlocked ? (
            <button
              type="button"
              onClick={() => {
                onSelectCar(previewCar.id);
                onClose();
              }}
              className={`min-h-[46px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold font-display tracking-wider transition-all shadow-lg active:scale-95 whitespace-nowrap ${
                isEquipped
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/50'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50'
              }`}
            >
              {isEquipped ? '✓ Equipped · Race' : 'Equip Car'}
            </button>
          ) : (
            <button
              type="button"
              disabled={coins < previewCar.unlockCost}
              onClick={() => onUnlockCar(previewCar)}
              className={`min-h-[46px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold font-display tracking-wider transition-all shadow-lg active:scale-95 whitespace-nowrap ${
                coins >= previewCar.unlockCost
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              Unlock ({previewCar.unlockCost.toLocaleString()} CR)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
