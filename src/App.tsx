/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase';
import {
  CAR_ROSTER,
  CarCustomization,
  CarSpec,
  CarUpgradeLevels,
  DEFAULT_CUSTOMIZATION,
  ENGINE_OPTIONS,
  GameModeId,
  ROAD_MODE_OPTIONS,
  RoadSelectionMode,
  computeEffectiveCarStats,
  getDriftRank,
  getUpgradeCost,
  resolveCarAppearance,
  resolveRoadBiome,
} from './game/rules';
import { GamePhase, LiveTelemetry, SceneCanvas } from './game/SceneCanvas';
import { SKY_THEME_OPTIONS, SkyThemeId } from './game/skyArt';
import { AudioDeckSnapshot, soundFX } from './game/audio';
import { GarageModal } from './components/GarageModal';
import { LeaderboardEntry, LeaderboardModal } from './components/LeaderboardModal';
import { ArtGalleryModal } from './components/ArtGalleryModal';
import { SteeringWheel } from './components/SteeringWheel';

const INITIAL_UPGRADES: Record<string, CarUpgradeLevels> = {
  blue_jdm: { speed: 1, handling: 1, magnet: 1 },
};

export default function App() {
  // Support ?autostart=1 to boot directly into 'playing'
  const initialPhase: GamePhase = (() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  })();

  const [gamePhase, setGamePhase] = useState<GamePhase>(initialPhase);

  // Player Progression State (synced with Cloud SQL when signed in, plus local persistence)
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [coins, setCoins] = useState<number>(320);
  const [bestScore, setBestScore] = useState<number>(0);
  const [bestCombo, setBestCombo] = useState<number>(1);
  const [selectedCarId, setSelectedCarId] = useState<string>('blue_jdm');
  const [unlockedCarIds, setUnlockedCarIds] = useState<string[]>(['blue_jdm']);
  const [carUpgrades, setCarUpgrades] =
    useState<Record<string, CarUpgradeLevels>>(INITIAL_UPGRADES);
  const [carCustomizations, setCarCustomizations] = useState<
    Record<string, CarCustomization>
  >(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = window.localStorage.getItem('apex_slash_custom_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
  });
  const [customSpriteUrl, setCustomSpriteUrl] = useState<string>('');
  const [roadMode, setRoadMode] = useState<RoadSelectionMode>(() => {
    if (typeof window === 'undefined') return 'tour';
    try {
      const saved = window.localStorage.getItem('apex_slash_road_v1');
      if (
        saved === 'tour' ||
        saved === 'alpine' ||
        saved === 'canyon' ||
        saved === 'neon' ||
        saved === 'sakura'
      ) {
        return saved;
      }
    } catch {}
    return 'tour';
  });

  const [gameMode, setGameMode] = useState<GameModeId>(() => {
    if (typeof window === 'undefined') return 'drift';
    const params = new URLSearchParams(window.location.search);
    const qMode = params.get('mode');
    if (qMode === 'traffic' || qMode === 'highway_traffic') return 'highway_traffic';
    if (qMode === 'drift') return 'drift';
    try {
      const saved = window.localStorage.getItem('apex_slash_mode_v1');
      if (saved === 'highway_traffic' || saved === 'drift') return saved;
    } catch {}
    return 'drift';
  });

  const [skyMode, setSkyMode] = useState<SkyThemeId>(() => {
    if (typeof window === 'undefined') return 'auto';
    const params = new URLSearchParams(window.location.search);
    const qSky = params.get('sky');
    if (
      qSky === 'auto' ||
      qSky === 'sun_day' ||
      qSky === 'golden_sunset' ||
      qSky === 'big_moon' ||
      qSky === 'red_moon' ||
      qSky === 'aurora_night'
    ) {
      return qSky;
    }
    try {
      const saved = window.localStorage.getItem('apex_slash_sky_v1');
      if (
        saved === 'auto' ||
        saved === 'sun_day' ||
        saved === 'golden_sunset' ||
        saved === 'big_moon' ||
        saved === 'red_moon' ||
        saved === 'aurora_night'
      ) {
        return saved;
      }
    } catch {}
    return 'auto';
  });

  const handleSelectGameMode = useCallback((mode: GameModeId) => {
    setGameMode(mode);
    try {
      window.localStorage.setItem('apex_slash_mode_v1', mode);
    } catch {}
  }, []);

  const handleSelectRoadMode = useCallback((mode: RoadSelectionMode) => {
    setRoadMode(mode);
    try {
      window.localStorage.setItem('apex_slash_road_v1', mode);
    } catch {}
  }, []);

  const handleSelectSkyMode = useCallback((mode: SkyThemeId) => {
    setSkyMode(mode);
    try {
      window.localStorage.setItem('apex_slash_sky_v1', mode);
    } catch {}
  }, []);

  // Imperative simulation triggers passed into SceneCanvas
  const [steerHold, setSteerHold] = useState<number>(0);
  const [keySteerVisual, setKeySteerVisual] = useState<number>(0);
  const [flipTriggerCount, setFlipTriggerCount] = useState<number>(0);
  const [boostTriggerCount, setBoostTriggerCount] = useState<number>(0);
  const [restartTriggerCount, setRestartTriggerCount] = useState<number>(0);
  const [flashTriggerCount, setFlashTriggerCount] = useState<number>(0);
  const [hornTriggerCount, setHornTriggerCount] = useState<number>(0);
  const [flashPulse, setFlashPulse] = useState<boolean>(false);
  const [hornPulse, setHornPulse] = useState<boolean>(false);
  const flashPulseTimerRef = useRef<number | null>(null);
  const hornPulseTimerRef = useRef<number | null>(null);

  const triggerFlashAction = useCallback(() => {
    setFlashTriggerCount((c) => c + 1);
    setFlashPulse(true);
    if (flashPulseTimerRef.current) window.clearTimeout(flashPulseTimerRef.current);
    flashPulseTimerRef.current = window.setTimeout(() => setFlashPulse(false), 360);
  }, []);

  const triggerHornAction = useCallback(() => {
    setHornTriggerCount((c) => c + 1);
    setHornPulse(true);
    if (hornPulseTimerRef.current) window.clearTimeout(hornPulseTimerRef.current);
    hornPulseTimerRef.current = window.setTimeout(() => setHornPulse(false), 320);
  }, []);

  // Live HUD Telemetry (throttled ~10Hz from SceneCanvas)
  const [telemetry, setTelemetry] = useState<LiveTelemetry>({
    score: 0,
    distance: 0,
    combo: 1,
    maxCombo: 1,
    coinsRun: 0,
    fever: 0,
    isFever: false,
    speedKmh: 132,
    direction: 'right',
    nearMissText: '',
    overtakes: 0,
    nearMisses: 0,
  });

  // Frozen End-of-Run Snapshot for Game Over Modal
  const [lastRunStats, setLastRunStats] = useState<{
    score: number;
    distance: number;
    maxCombo: number;
    coinsCollected: number;
    overtakes?: number;
    nearMisses?: number;
    crashReason?: string;
  }>({
    score: 0,
    distance: 0,
    maxCombo: 1,
    coinsCollected: 0,
    overtakes: 0,
    nearMisses: 0,
    crashReason: 'Guardrail Breached',
  });

  // Modals & Collapsible Bottom Dock
  const [isGarageOpen, setIsGarageOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isArtGalleryOpen, setIsArtGalleryOpen] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Leaderboard & Official Soundtrack Deck
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const [customBgmTitle, setCustomBgmTitle] = useState<string>('Neon Redline — Tokyo Highway Eurobeat');
  const [audioDeck, setAudioDeck] = useState<AudioDeckSnapshot>(() => soundFX.getDeckSnapshot());
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  const selectedCar: CarSpec =
    CAR_ROSTER.find((c) => c.id === selectedCarId) || CAR_ROSTER[0];
  const activeCarUpgrades: CarUpgradeLevels = carUpgrades[selectedCar.id] || {
    speed: 1,
    handling: 1,
    magnet: 1,
  };
  const activeCarCustom: CarCustomization = {
    ...DEFAULT_CUSTOMIZATION,
    ...carCustomizations[selectedCar.id],
    number: carCustomizations[selectedCar.id]?.number || selectedCar.decalText || '73',
  };
  const activeAppearance = resolveCarAppearance(selectedCar, activeCarCustom);
  const activeStats = computeEffectiveCarStats(selectedCar, activeCarUpgrades, activeCarCustom);
  const activeEngineOption =
    ENGINE_OPTIONS.find((e) => e.id === activeAppearance.engine) || ENGINE_OPTIONS[0];

  // Mirror gamePhase to document.body.dataset.state & clear held controls when leaving 'playing'
  useEffect(() => {
    document.body.dataset.state = gamePhase;
    if (gamePhase !== 'playing') {
      setSteerHold(0);
      setKeySteerVisual(0);
    }
  }, [gamePhase]);

  // Fetch Global Cloud SQL Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
        }
      }
    } catch {
      // Keep existing leaderboard entries if offline
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Subscribe to Audio Deck state on startup
  useEffect(() => {
    const unsub = soundFX.subscribe(() => {
      setAudioDeck(soundFX.getDeckSnapshot());
    });
    setCustomBgmTitle('Neon Redline — Tokyo Highway Eurobeat');
    return unsub;
  }, []);

  // Firebase Auth listener + Cloud SQL Profile Load
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      if (currUser) {
        try {
          const token = await currUser.getIdToken();
          setIdToken(token);
          const res = await fetch('/api/user/profile', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { profile } = await res.json();
            if (profile) {
              setCoins(profile.coins ?? 320);
              setBestScore(profile.bestScore ?? 0);
              setBestCombo(profile.bestCombo ?? 1);
              setSelectedCarId(profile.selectedCarId || 'blue_jdm');
              try {
                const parsedUnlocked = JSON.parse(profile.unlockedCarsJson || '["blue_jdm"]');
                if (Array.isArray(parsedUnlocked) && parsedUnlocked.length > 0) {
                  setUnlockedCarIds(parsedUnlocked);
                }
              } catch {}
              try {
                const parsedUpgrades = JSON.parse(profile.carUpgradesJson || '{}');
                if (parsedUpgrades && typeof parsedUpgrades === 'object') {
                  setCarUpgrades({ ...INITIAL_UPGRADES, ...parsedUpgrades });
                }
              } catch {}
              if (profile.customSpriteUrl) {
                setCustomSpriteUrl(profile.customSpriteUrl);
              }
            }
          }
        } catch (err) {
          console.error('Error syncing user profile:', err);
        }
      } else {
        setIdToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Garage Changes to Cloud SQL when signed in
  const syncGarageToCloudSql = useCallback(
    async (nextState: {
      coins: number;
      bestScore: number;
      bestCombo: number;
      selectedCarId: string;
      unlockedCarIds: string[];
      carUpgrades: Record<string, CarUpgradeLevels>;
      customSpriteUrl?: string;
    }) => {
      if (!idToken) return;
      try {
        await fetch('/api/user/garage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            coins: nextState.coins,
            bestScore: nextState.bestScore,
            bestCombo: nextState.bestCombo,
            selectedCarId: nextState.selectedCarId,
            unlockedCarsJson: JSON.stringify(nextState.unlockedCarIds),
            carUpgradesJson: JSON.stringify(nextState.carUpgrades),
            customSpriteUrl: nextState.customSpriteUrl,
          }),
        });
      } catch (err) {
        console.error('Garage Cloud SQL sync error:', err);
      }
    },
    [idToken]
  );

  // Start / Restart Run Handler
  const handleStartRun = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsGarageOpen(false);
    setIsLeaderboardOpen(false);
    setIsArtGalleryOpen(false);
    document.body.dataset.state = 'playing';
    setRestartTriggerCount((c) => c + 1);
    setGamePhase('playing');
    soundFX.unlockAndEnsureMusic().catch(() => {});
  }, []);

  // End-of-Run Defeat Callback (after 3D fall-off & destruction animation finishes)
  const handleGameOver = useCallback(
    async (finalStats: {
      score: number;
      distance: number;
      maxCombo: number;
      coinsCollected: number;
      overtakes?: number;
      nearMisses?: number;
      crashReason?: string;
    }) => {
      setLastRunStats(finalStats);
      const nextCoins = coins + finalStats.coinsCollected;
      const nextBestScore = Math.max(bestScore, finalStats.score);
      const nextBestCombo = Math.max(bestCombo, finalStats.maxCombo);

      setCoins(nextCoins);
      setBestScore(nextBestScore);
      setBestCombo(nextBestCombo);
      document.body.dataset.state = 'gameover';
      setGamePhase('gameover');

      if (idToken) {
        try {
          await fetch('/api/runs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              carId: selectedCarId,
              score: finalStats.score,
              distance: finalStats.distance,
              maxCombo: finalStats.maxCombo,
              coinsCollected: finalStats.coinsCollected,
            }),
          });
          fetchLeaderboard();
        } catch {}
      }
    },
    [coins, bestScore, bestCombo, idToken, selectedCarId, fetchLeaderboard]
  );

  // Unified Keyboard Input Hub (Edge-Triggered One-Shots & Blur Hygiene)
  const keysHeldRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const syncKeyboardSteerVisual = () => {
      const leftHeld =
        keysHeldRef.current.has('ArrowLeft') || keysHeldRef.current.has('KeyA');
      const rightHeld =
        keysHeldRef.current.has('ArrowRight') || keysHeldRef.current.has('KeyD');
      setKeySteerVisual((rightHeld ? 1 : 0) - (leftHeld ? 1 : 0));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in an input inside AI Studio modal
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const code = e.code;
      const isRepeat = keysHeldRef.current.has(code);
      keysHeldRef.current.add(code);

      if (isRepeat) return; // Edge-triggered one-shots only!

      if (code === 'KeyM') {
        setIsMuted((prev) => {
          const next = !prev;
          soundFX.setMuted(next);
          if (bgmAudioRef.current) bgmAudioRef.current.muted = next;
          return next;
        });
        return;
      }

      if (code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
        return;
      }

      if (isGarageOpen || isLeaderboardOpen || isArtGalleryOpen) {
        if (code === 'Escape') {
          setIsGarageOpen(false);
          setIsLeaderboardOpen(false);
          setIsArtGalleryOpen(false);
        }
        return;
      }

      if (gamePhase === 'title' || gamePhase === 'gameover') {
        if (code === 'Space' || code === 'Enter') {
          e.preventDefault();
          handleStartRun();
        } else if (code === 'KeyG') {
          setIsGarageOpen(true);
        }
        return;
      }

      if (gamePhase === 'playing') {
        if (code === 'Escape' || code === 'KeyP') {
          e.preventDefault();
          setGamePhase('paused');
          return;
        }
        if (code === 'KeyR') {
          e.preventDefault();
          handleStartRun();
          return;
        }
        if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowRight' || code === 'KeyD') {
          syncKeyboardSteerVisual();
          return;
        }
        if (code === 'KeyF') {
          e.preventDefault();
          triggerFlashAction();
          return;
        }
        if (code === 'KeyE') {
          e.preventDefault();
          triggerHornAction();
          return;
        }
        if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
          e.preventDefault();
          setBoostTriggerCount((c) => c + 1);
        }
      } else if (gamePhase === 'paused') {
        if (code === 'Escape' || code === 'KeyP' || code === 'Space' || code === 'Enter') {
          e.preventDefault();
          setGamePhase('playing');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
      if (
        e.code === 'ArrowLeft' ||
        e.code === 'KeyA' ||
        e.code === 'ArrowRight' ||
        e.code === 'KeyD'
      ) {
        syncKeyboardSteerVisual();
      }
    };

    const onWindowBlur = () => {
      keysHeldRef.current.clear();
      setSteerHold(0);
      setKeySteerVisual(0);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    gamePhase,
    isGarageOpen,
    isLeaderboardOpen,
    isArtGalleryOpen,
    handleStartRun,
    triggerFlashAction,
    triggerHornAction,
  ]);

  // Garage Actions
  const handleUnlockCar = (car: CarSpec) => {
    if (coins < car.unlockCost || unlockedCarIds.includes(car.id)) return;
    const nextCoins = coins - car.unlockCost;
    const nextUnlocked = [...unlockedCarIds, car.id];
    const nextUpgrades = {
      ...carUpgrades,
      [car.id]: carUpgrades[car.id] || { speed: 1, handling: 1, magnet: 1 },
    };
    setCoins(nextCoins);
    setUnlockedCarIds(nextUnlocked);
    setSelectedCarId(car.id);
    setCarUpgrades(nextUpgrades);
    soundFX.playFeverBurst();
    syncGarageToCloudSql({
      coins: nextCoins,
      bestScore,
      bestCombo,
      selectedCarId: car.id,
      unlockedCarIds: nextUnlocked,
      carUpgrades: nextUpgrades,
      customSpriteUrl,
    });
  };

  const handleUpgradeStat = (car: CarSpec, stat: keyof CarUpgradeLevels) => {
    const current = carUpgrades[car.id] || { speed: 1, handling: 1, magnet: 1 };
    const lv = current[stat] || 1;
    const cost = getUpgradeCost(car.tier, lv);
    if (lv >= 5 || coins < cost) return;

    const nextCoins = coins - cost;
    const nextUpgrades: Record<string, CarUpgradeLevels> = {
      ...carUpgrades,
      [car.id]: {
        ...current,
        [stat]: lv + 1,
      },
    };
    setCoins(nextCoins);
    setCarUpgrades(nextUpgrades);
    soundFX.playCoinPickup(lv + 2);
    syncGarageToCloudSql({
      coins: nextCoins,
      bestScore,
      bestCombo,
      selectedCarId,
      unlockedCarIds,
      carUpgrades: nextUpgrades,
      customSpriteUrl,
    });
  };

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error('Google Sign-In error:', err);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Determine next locked car for progressive dopamine goal bar on Game Over & HUD
  const nextLockedCar = CAR_ROSTER.find((c) => !unlockedCarIds.includes(c.id));

  return (
    <main className="relative w-full h-[100dvh] max-h-[100dvh] overflow-hidden select-none touch-none">
      {/* 1. Full-Bleed 2D Pixel-Art Drift Viewport */}
      <SceneCanvas
        gamePhase={gamePhase}
        gameMode={gameMode}
        selectedCar={selectedCar}
        carUpgrades={activeCarUpgrades}
        carCustom={activeCarCustom}
        customSpriteUrl={customSpriteUrl}
        roadMode={roadMode}
        skyMode={skyMode}
        steerHold={steerHold}
        flipTriggerCount={flipTriggerCount}
        boostTriggerCount={boostTriggerCount}
        restartTriggerCount={restartTriggerCount}
        flashTriggerCount={flashTriggerCount}
        hornTriggerCount={hornTriggerCount}
        onTelemetryUpdate={setTelemetry}
        onGameOver={handleGameOver}
      />

      {/* Hidden Audio Element for Custom Lyria Soundtrack */}
      <audio ref={bgmAudioRef} loop className="hidden" />

      {/* 2. Interactive Full-Screen Hold-to-Steer Touch Zones During Active Gameplay */}
      {gamePhase === 'playing' && (
        <div className="fixed inset-0 z-10 grid grid-cols-2 pointer-events-auto">
          <button
            type="button"
            aria-label="Steer Left"
            onPointerDown={() => setSteerHold(-1)}
            onPointerUp={() => setSteerHold(0)}
            onPointerLeave={() => setSteerHold(0)}
            onPointerCancel={() => setSteerHold(0)}
            className="w-full h-full bg-transparent cursor-pointer focus:outline-none active:bg-sky-500/10 transition-colors"
            tabIndex={-1}
          />
          <button
            type="button"
            aria-label="Steer Right"
            onPointerDown={() => setSteerHold(1)}
            onPointerUp={() => setSteerHold(0)}
            onPointerLeave={() => setSteerHold(0)}
            onPointerCancel={() => setSteerHold(0)}
            className="w-full h-full bg-transparent cursor-pointer focus:outline-none active:bg-amber-500/10 transition-colors"
            tabIndex={-1}
          />
        </div>
      )}

      {/* 3. TITLE SCREEN OVERLAY (Motorsport Command Deck + Bespoke SVG Emblem) */}
      {gamePhase === 'title' && (
        <div
          className="fixed inset-0 z-20 flex flex-col justify-between items-center p-4 sm:p-6 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(7,10,19,0.62) 0%, rgba(7,10,19,0.0) 34%, rgba(7,10,19,0.0) 62%, rgba(7,10,19,0.88) 100%)',
          }}
        >
          {/* Top Utility Bar */}
          <div className="w-full max-w-lg flex items-center justify-between gap-3 pointer-events-auto">
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-200 truncate">
              <span
                className="w-2.5 h-2.5 rounded-sm border border-white/40 shrink-0"
                style={{ backgroundColor: activeAppearance.primaryColor }}
                aria-hidden="true"
              />
              <span className="font-semibold truncate">{selectedCar.name}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-amber-400 font-bold shrink-0">{Math.round(coins)} CR</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsLeaderboardOpen(true)}
                className="min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/90 text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Leaderboard
              </button>
              <button
                type="button"
                onClick={() => setIsArtGalleryOpen(true)}
                className="min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/90 text-xs font-semibold text-cyan-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <span>🖼️ Gallery</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !isMuted;
                  setIsMuted(next);
                  soundFX.setMuted(next);
                  if (bgmAudioRef.current) bgmAudioRef.current.muted = next;
                }}
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/90 text-slate-100"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  {isMuted ? (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  ) : (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Upper Negative-Space Motorsport SVG Title Emblem */}
          <div className="w-full max-w-lg text-center mt-1 pointer-events-auto">
            <svg
              viewBox="0 0 440 112"
              className="w-full max-w-[390px] mx-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)]"
              role="img"
              aria-label="Neon Redline: 3D Touge & Highway Drift"
            >
              <polygon
                points="26,12 418,6 396,84 10,90"
                fill="#090e1a"
                stroke="#06b6d4"
                strokeWidth="2.6"
              />
              <polygon points="376,7 418,6 396,84 354,85" fill="#f43f5e" />
              <polygon points="348,8 368,8 346,85 326,85" fill="#f59e0b" />
              <polygon points="30,18 44,18 30,78 16,78" fill="#06b6d4" />
              <text
                x="182"
                y="54"
                textAnchor="middle"
                fill="#ffffff"
                fontFamily="'Chakra Petch', sans-serif"
                fontWeight="700"
                fontStyle="italic"
                fontSize="38"
                letterSpacing="2.0"
              >
                NEON REDLINE
              </text>
              <text
                x="182"
                y="75"
                textAnchor="middle"
                fill="#06b6d4"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="700"
                fontSize="10"
                letterSpacing="1.8"
              >
                {gameMode === 'highway_traffic'
                  ? 'HIGHWAY TRAFFIC · OVERTAKE CLASH'
                  : 'TOKYO TOUGE · 3D PIXEL DRIFT'}
              </text>
            </svg>
          </div>

          {/* Open Center Road Preview */}
          <div className="my-auto" />

          {/* Lower Motorsport Pit Command Deck */}
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700/80 p-3 sm:p-4 space-y-2.5 pointer-events-auto shadow-2xl"
            style={{ backgroundColor: 'rgba(9, 14, 26, 0.94)' }}
          >
            {/* Active Build Telemetry Strip */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/90 text-xs">
              <div className="min-w-0 truncate">
                <span className="font-display font-bold text-white">
                  {selectedCar.name}
                </span>
                <span aria-hidden="true" className="text-slate-600 mx-1.5">/</span>
                <span className="font-mono text-slate-300">
                  {activeEngineOption.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums text-[11px] text-amber-400">
                <span>{Math.round(activeStats.topSpeed * 8)} KM/H</span>
                <button
                  type="button"
                  onClick={() => setIsGarageOpen(true)}
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 font-sans font-semibold text-[11px] whitespace-nowrap"
                >
                  Tune
                </button>
              </div>
            </div>

            {/* 2-Mode Switcher + 5-Road Selector */}
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Select Game Mode">
              <button
                type="button"
                data-mode-id="drift"
                onClick={() => handleSelectGameMode('drift')}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide transition-colors whitespace-nowrap ${
                  gameMode === 'drift'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                S-Curve Drift
              </button>
              <button
                type="button"
                data-mode-id="highway_traffic"
                onClick={() => handleSelectGameMode('highway_traffic')}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide transition-colors whitespace-nowrap ${
                  gameMode === 'highway_traffic'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                2-Lane Traffic
              </button>
            </div>

            <div
              className="grid grid-cols-5 gap-1"
              role="group"
              aria-label="Select Road Route"
            >
              {ROAD_MODE_OPTIONS.map((opt) => {
                const active = roadMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-road-id={opt.id}
                    onClick={() => handleSelectRoadMode(opt.id)}
                    className={`min-h-[36px] px-1 py-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-800 text-white border border-amber-400/90'
                        : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-sm shrink-0"
                      style={{ backgroundColor: opt.color }}
                      aria-hidden="true"
                    />
                    <span>{opt.id === 'tour' ? 'Tour' : opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Anime Sky & Moon Atmosphere Selector */}
            <div
              className="grid grid-cols-3 sm:grid-cols-6 gap-1"
              role="group"
              aria-label="Select Sky Atmosphere"
            >
              {SKY_THEME_OPTIONS.map((opt) => {
                const active = skyMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-sky-id={opt.id}
                    onClick={() => handleSelectSkyMode(opt.id)}
                    className={`min-h-[34px] px-1.5 py-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-800 text-white border border-sky-400/90'
                        : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-sm shrink-0"
                      style={{ backgroundColor: opt.dotColor }}
                      aria-hidden="true"
                    />
                    <span>{opt.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Primary Launch CTA */}
            <button
              type="button"
              data-start="true"
              onClick={handleStartRun}
              className="w-full min-h-[50px] py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display font-bold text-lg tracking-wider shadow-lg transition-transform whitespace-nowrap"
            >
              {gameMode === 'highway_traffic'
                ? 'Launch Highway Run'
                : 'Launch Drift Run'}
            </button>

            {/* Secondary Hangar & Gallery Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsGarageOpen(true)}
                className="min-h-[42px] py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Garage ({unlockedCarIds.length}/{CAR_ROSTER.length} Cars)
              </button>
              <button
                type="button"
                onClick={() => setIsArtGalleryOpen(true)}
                className="min-h-[42px] py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-700/70 text-cyan-300 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
              >
                🖼️ Art Gallery
              </button>
            </div>

            <p className="text-center text-[10px] sm:text-xs text-slate-300 pt-0.5 leading-tight flex items-center justify-center gap-1.5 font-mono">
              <span className="text-cyan-400">📱 Mobile Ready:</span>
              <span>Tap to Drift · Pedals &amp; Wheel for Traffic · 3D Garage</span>
            </p>
          </div>
        </div>
      )}

      {/* 4. PLAYING HUD (World-Matched, Perimeter-Only <= 15% Footprint, Tabular-Nums Integer Readouts) */}
      {gamePhase === 'playing' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-5">
          {/* Top Perimeter Row: Left Score/Combo Cluster + Right Utility Icon Buttons */}
          <div className="w-full max-w-lg mx-auto flex items-start justify-between gap-2 sm:gap-3">
            {/* Top-Left Score & Combo Cluster */}
            <div
              className={`px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-2xl border shadow-lg transition-colors ${
                telemetry.isFever
                  ? 'border-cyan-400/90'
                  : telemetry.combo >= 3
                  ? 'border-amber-400/80'
                  : 'border-slate-800/90'
              }`}
              style={{ backgroundColor: 'rgba(9, 13, 22, 0.86)' }}
            >
              <div className="flex items-baseline gap-2 sm:gap-3">
                <div>
                  <span className="block text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-400">
                    SCORE
                  </span>
                  <span
                    className="text-xl sm:text-3xl font-bold font-display tabular-nums text-white"
                    data-testid="hud-score"
                  >
                    {Math.round(telemetry.score)}
                  </span>
                </div>

                <div className="pl-2 sm:pl-3 border-l border-slate-800">
                  <span className="block text-[9px] sm:text-[10px] font-semibold tracking-wider text-amber-400">
                    COMBO
                  </span>
                  <span
                    className={`inline-block text-lg sm:text-2xl font-bold font-mono tabular-nums transition-transform ${
                      telemetry.isFever
                        ? 'text-cyan-300 scale-110'
                        : telemetry.combo >= 3
                        ? 'text-amber-300 scale-105'
                        : 'text-amber-400'
                    }`}
                  >
                    x{Math.round(telemetry.combo)}
                  </span>
                </div>

                <div className="pl-2 sm:pl-3 border-l border-slate-800">
                  <span className="block text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-400">
                    {gameMode === 'highway_traffic' ? 'PASSES' : 'DIR'}
                  </span>
                  <span
                    className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-cyan-400"
                    data-testid={gameMode === 'highway_traffic' ? 'hud-passes' : 'hud-dir'}
                  >
                    {gameMode === 'highway_traffic'
                      ? Math.round(telemetry.overtakes || 0)
                      : telemetry.direction === 'right'
                      ? '/'
                      : '\\'}
                  </span>
                </div>
              </div>
            </div>

            {/* Top-Right Compact Square SVG Utility Buttons (Mute [M], Restart [R], Pause [P]) */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
              <button
                type="button"
                tabIndex={-1}
                aria-label={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  const next = !isMuted;
                  setIsMuted(next);
                  soundFX.setMuted(next);
                  if (bgmAudioRef.current) bgmAudioRef.current.muted = next;
                }}
                className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl border border-slate-800 text-slate-200 hover:bg-slate-800"
                style={{ backgroundColor: 'rgba(9, 13, 22, 0.86)' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-current">
                  {isMuted ? (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  ) : (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart Run [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleStartRun();
                }}
                className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl border border-slate-800 text-slate-200 hover:bg-slate-800"
                style={{ backgroundColor: 'rgba(9, 13, 22, 0.86)' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-current">
                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game [P]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setGamePhase('paused');
                }}
                className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl border border-slate-800 text-slate-200 hover:bg-slate-800"
                style={{ backgroundColor: 'rgba(9, 13, 22, 0.86)' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-current">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Ephemeral Near-Miss / Fever / Flash / Milestone Callout Banner */}
          {telemetry.nearMissText && (
            <div
              className={`mx-auto mt-2 px-4 py-1 rounded-lg font-display font-bold text-sm tracking-wide shadow-md ${
                telemetry.nearMissText.includes('SLIPSTREAM') ||
                telemetry.nearMissText.includes('FEVER') ||
                telemetry.nearMissText.includes('NITRO') ||
                telemetry.nearMissText.includes('FLASH') ||
                telemetry.nearMissText.includes('HORN')
                  ? 'bg-cyan-400 text-slate-950'
                  : telemetry.nearMissText.includes('RANK') ||
                    telemetry.nearMissText.includes('SECTOR') ||
                    telemetry.nearMissText.includes('APEX') ||
                    telemetry.nearMissText.includes('UNSTOPPABLE')
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-amber-500 text-slate-950'
              }`}
            >
              {telemetry.nearMissText}
            </div>
          )}

          <div className="my-auto" />

          {/* Unified Cockpit Controls: Steering Wheel + Flash/Horn/Nitro + Metal Gas & Brake Pedals */}
          <div className="w-full max-w-lg mx-auto pointer-events-auto flex flex-col items-center">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                setDockCollapsed((prev) => !prev);
              }}
              className="px-3 py-1 rounded-t-xl border border-b-0 border-slate-700/80 text-[11px] font-mono text-slate-300 hover:text-white"
              style={{ backgroundColor: 'rgba(9, 14, 26, 0.92)' }}
            >
              {dockCollapsed ? '▴ Cockpit Controls [H]' : '▾ Hide Cockpit [H]'}
            </button>

            {!dockCollapsed && (
              <div
                className="w-full rounded-2xl border border-slate-700/80 p-2 sm:p-2.5 shadow-2xl"
                style={{ backgroundColor: 'rgba(9, 14, 26, 0.94)' }}
              >
                {/* Telemetry & Fever Strip */}
                <div className="flex items-center justify-between gap-2 mb-2 text-[11px]">
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-slate-300">
                      <strong
                        className={
                          telemetry.isFever || telemetry.speedKmh >= 235
                            ? 'text-cyan-300'
                            : telemetry.speedKmh >= 180
                            ? 'text-amber-300'
                            : 'text-white'
                        }
                        data-testid="hud-speed"
                      >
                        {Math.round(telemetry.speedKmh)}
                      </strong>{' '}
                      KM/H
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-amber-400 font-bold">
                      +{Math.round(telemetry.coinsRun)} CR
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-slate-300">
                      {Math.round(telemetry.distance)}m
                    </span>
                  </div>
                </div>

                {/* Tactile Cockpit Row: Steering Wheel & Flash + Horn */}
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Interactive Rotatable Steering Wheel with Center Horn */}
                  <SteeringWheel
                    value={steerHold !== 0 ? steerHold : keySteerVisual}
                    onChange={setSteerHold}
                    onHorn={triggerHornAction}
                  />

                  {/* Right: High-Beam Flash [F] & Horn [E] */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-hud-btn="true"
                      data-testid="btn-flash"
                      tabIndex={-1}
                      aria-label="Flash High-Beams [F]"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        triggerFlashAction();
                      }}
                      className={`min-h-[52px] min-w-[58px] sm:min-w-[64px] px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors whitespace-nowrap ${
                        flashPulse
                          ? 'bg-cyan-400 border-white text-slate-950'
                          : 'bg-slate-900 border-cyan-500/60 hover:bg-slate-800 text-cyan-300'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                        <path d="M5 7c-1.7 0-3 2.2-3 5s1.3 5 3 5h5V7H5zm8 0v2h8V7h-8zm0 4v2h9v-2h-9zm0 4v2h8v-2h-8z" />
                      </svg>
                      <span className="text-[10px] font-mono font-bold">FLASH</span>
                    </button>

                    <button
                      type="button"
                      data-hud-btn="true"
                      data-testid="btn-horn"
                      tabIndex={-1}
                      aria-label="Sound Horn [E]"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        triggerHornAction();
                      }}
                      className={`min-h-[52px] min-w-[58px] sm:min-w-[64px] px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors whitespace-nowrap ${
                        hornPulse
                          ? 'bg-amber-400 border-white text-slate-950'
                          : 'bg-slate-900 border-amber-500/60 hover:bg-slate-800 text-amber-300'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                        <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                      <span className="text-[10px] font-mono font-bold">HORN</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. PAUSED MODAL */}
      {gamePhase === 'paused' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
          style={{ backgroundColor: 'rgba(5, 8, 17, 0.86)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700/80 p-6 text-center space-y-4 shadow-2xl"
            style={{ backgroundColor: '#090e1a' }}
          >
            <p className="text-xs font-semibold tracking-wider text-amber-400">
              SIMULATION PAUSED
            </p>
            <h2 className="text-2xl font-bold font-display text-white">Pit Stop Hold</h2>

            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums">
              <div>
                <span className="block text-slate-400">CURRENT SCORE</span>
                <span className="text-base font-bold text-white">
                  {Math.round(telemetry.score)}
                </span>
              </div>
              <div>
                <span className="block text-slate-400">MAX COMBO</span>
                <span className="text-base font-bold text-amber-400">
                  x{Math.round(telemetry.maxCombo)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5 text-left">
                Sky &amp; Moon Atmosphere
              </p>
              <div
                className="grid grid-cols-3 gap-1.5"
                role="group"
                aria-label="Change Sky Atmosphere"
              >
                {SKY_THEME_OPTIONS.map((opt) => {
                  const active = skyMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-pause-sky-id={opt.id}
                      onClick={() => handleSelectSkyMode(opt.id)}
                      className={`min-h-[34px] px-1.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-slate-800 text-white border border-sky-400/90'
                          : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-sm shrink-0"
                        style={{ backgroundColor: opt.dotColor }}
                        aria-hidden="true"
                      />
                      <span>{opt.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => setGamePhase('playing')}
                className="w-full min-h-[46px] py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm whitespace-nowrap"
              >
                Resume Run
              </button>
              <button
                type="button"
                onClick={handleStartRun}
                className="w-full min-h-[44px] py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm whitespace-nowrap"
              >
                Restart Run
              </button>
              <button
                type="button"
                onClick={() => setGamePhase('title')}
                className="w-full min-h-[44px] py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-sm whitespace-nowrap"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. GAME OVER (WRECKED OFF CANYON ROAD) MODAL */}
      {gamePhase === 'gameover' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
          style={{ backgroundColor: 'rgba(5, 8, 17, 0.88)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Run Complete - Car Wrecked"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700/80 p-6 space-y-4 shadow-2xl"
            style={{ backgroundColor: '#090e1a' }}
          >
            <div className="text-center">
              <p className="text-xs font-semibold tracking-wider text-rose-400">
                {(telemetry.biomeName || resolveRoadBiome(roadMode, lastRunStats.distance).name).toUpperCase()} ·{' '}
                {(lastRunStats.crashReason || 'GUARDRAIL BREACHED').toUpperCase()}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mt-0.5">
                {gameMode === 'highway_traffic' && lastRunStats.crashReason !== 'Guardrail Breached'
                  ? 'Highway Pileup!'
                  : 'Wrecked in the Abyss'}
              </h2>
              {(() => {
                const rankInfo = getDriftRank(lastRunStats.score);
                return (
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
                    <span className="font-bold text-sm" style={{ color: rankInfo.color }}>
                      RANK {rankInfo.rank}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-200">{rankInfo.title}</span>
                  </div>
                );
              })()}
            </div>

            {/* 3 Tabular-Nums Stat Tiles */}
            <div className="grid grid-cols-3 gap-2.5 text-center font-mono tabular-nums">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="block text-[10px] text-slate-400">RUN SCORE</span>
                <span className="text-lg font-bold text-white">
                  {Math.round(lastRunStats.score)}
                </span>
                <span className="block text-[10px] text-amber-400 mt-0.5">
                  BEST {Math.round(bestScore)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="block text-[10px] text-slate-400">
                  {gameMode === 'highway_traffic' ? 'OVERTAKES' : 'DISTANCE'}
                </span>
                <span className="text-lg font-bold text-cyan-400">
                  {gameMode === 'highway_traffic'
                    ? `${Math.round(lastRunStats.overtakes || 0)}`
                    : `${Math.round(lastRunStats.distance)}m`}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">
                  {gameMode === 'highway_traffic'
                    ? `${Math.round(lastRunStats.nearMisses || 0)} NEAR MISS`
                    : `COMBO x${Math.round(lastRunStats.maxCombo)}`}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="block text-[10px] text-slate-400">COINS EARNED</span>
                <span className="text-lg font-bold text-amber-400">
                  +{Math.round(lastRunStats.coinsCollected)}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">
                  BANK {Math.round(coins)} CR
                </span>
              </div>
            </div>

            {/* Progressive Car Unlock Progress Bar */}
            {nextLockedCar && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-200">
                    {coins >= nextLockedCar.unlockCost
                      ? `Ready to Unlock: ${nextLockedCar.name}!`
                      : `Next Unlock: ${nextLockedCar.name}`}
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      coins >= nextLockedCar.unlockCost ? 'text-emerald-400 font-bold' : 'text-amber-400'
                    }`}
                  >
                    {coins >= nextLockedCar.unlockCost
                      ? `${nextLockedCar.unlockCost} CR READY`
                      : `${Math.round(coins)} / ${nextLockedCar.unlockCost} CR`}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-transform origin-left ${
                      coins >= nextLockedCar.unlockCost ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{
                      transform: `scaleX(${Math.min(1, coins / nextLockedCar.unlockCost)})`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Primary Retry CTA & Garage / AI Voice Hype Actions */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={handleStartRun}
                className="w-full min-h-[50px] py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-lg tracking-wide transition-colors whitespace-nowrap"
              >
                Try Again (Space / Tap)
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsGarageOpen(true)}
                  className="min-h-[44px] py-2.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold whitespace-nowrap"
                >
                  Garage &amp; Upgrades
                </button>
                <button
                  type="button"
                  onClick={() => setGamePhase('title')}
                  className="min-h-[44px] py-2.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold whitespace-nowrap"
                >
                  Title Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals (mounted only when open so closed modals don't re-render on 11Hz HUD ticks) */}
      {isGarageOpen && (
        <GarageModal
          isOpen={isGarageOpen}
          onClose={() => setIsGarageOpen(false)}
          coins={coins}
          selectedCarId={selectedCarId}
          unlockedCarIds={unlockedCarIds}
          carUpgrades={carUpgrades}
          carCustomizations={carCustomizations}
          customSpriteUrl={customSpriteUrl}
          onSelectCar={(carId) => {
            setSelectedCarId(carId);
            syncGarageToCloudSql({
              coins,
              bestScore,
              bestCombo,
              selectedCarId: carId,
              unlockedCarIds,
              carUpgrades,
              customSpriteUrl,
            });
          }}
          onUnlockCar={handleUnlockCar}
          onUpgradeStat={handleUpgradeStat}
          onUpdateCustomization={(carId, nextCustom) => {
            const updated = { ...carCustomizations, [carId]: nextCustom };
            setCarCustomizations(updated);
            try {
              window.localStorage.setItem('apex_slash_custom_v1', JSON.stringify(updated));
            } catch {}
          }}
          onClearCustomSprite={() => {
            setCustomSpriteUrl('');
            syncGarageToCloudSql({
              coins,
              bestScore,
              bestCombo,
              selectedCarId,
              unlockedCarIds,
              carUpgrades,
              customSpriteUrl: '',
            });
          }}
        />
      )}

      {isLeaderboardOpen && (
        <LeaderboardModal
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
          entries={leaderboard}
          loading={loadingLeaderboard}
          userEmail={user?.email || null}
          onGoogleSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
        />
      )}

      {isArtGalleryOpen && (
        <ArtGalleryModal
          isOpen={isArtGalleryOpen}
          onClose={() => setIsArtGalleryOpen(false)}
        />
      )}
    </main>
  );
}
