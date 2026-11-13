/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { soundFX, triggerHaptic } from '../game/audio';

export const DAILY_STREAK_STORAGE_KEY = 'neon_daily_streak_v1';

export interface DailyStreakData {
  lastSpinTimestamp: number;
  streakCount: number; // 1 to 7
  lastSpinDate: string; // 'YYYY-MM-DD'
  totalSpins: number;
}

export interface WheelSegment {
  amount: number;
  label: string;
  isJackpot?: boolean;
  isSuper?: boolean;
  color: string;
  bgColor: string;
  textColor: string;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { amount: 500, label: '500 CR', color: '#00f0ff', bgColor: '#06283d', textColor: '#e0f2fe' },
  { amount: 1000, label: '1,000 CR', color: '#a855f7', bgColor: '#2e1065', textColor: '#f3e8ff' },
  { amount: 2500, label: '2,500 CR', color: '#eab308', bgColor: '#422006', textColor: '#fef08a' },
  { amount: 750, label: '750 CR', color: '#22c55e', bgColor: '#052e16', textColor: '#bbf7d0' },
  { amount: 5000, label: '5,000 CR', isSuper: true, color: '#f97316', bgColor: '#431407', textColor: '#ffedd5' },
  { amount: 1500, label: '1,500 CR', color: '#38bdf8', bgColor: '#0c2e4e', textColor: '#bae6fd' },
  { amount: 10000, label: '10,000 CR', isJackpot: true, color: '#f43f5e', bgColor: '#4c0519', textColor: '#ffe4e6' },
  { amount: 2000, label: '2,000 CR', color: '#10b981', bgColor: '#064e3b', textColor: '#a7f3d0' },
];

export const STREAK_REWARDS = [
  { day: 1, reward: 500, label: '500 CR' },
  { day: 2, reward: 1000, label: '1K CR' },
  { day: 3, reward: 1500, label: '1.5K CR' },
  { day: 4, reward: 2500, label: '2.5K CR' },
  { day: 5, reward: 4000, label: '4K CR' },
  { day: 6, reward: 7500, label: '7.5K CR' },
  { day: 7, reward: 15000, label: '15K JACKPOT', isJackpot: true },
];

export function getDailyStreakState(): DailyStreakData {
  if (typeof window === 'undefined') {
    return { lastSpinTimestamp: 0, streakCount: 1, lastSpinDate: '', totalSpins: 0 };
  }
  try {
    const raw = window.localStorage.getItem(DAILY_STREAK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          lastSpinTimestamp: Number(parsed.lastSpinTimestamp) || 0,
          streakCount: Math.min(7, Math.max(1, Number(parsed.streakCount) || 1)),
          lastSpinDate: String(parsed.lastSpinDate || ''),
          totalSpins: Number(parsed.totalSpins) || 0,
        };
      }
    }
  } catch {}
  return { lastSpinTimestamp: 0, streakCount: 1, lastSpinDate: '', totalSpins: 0 };
}

export function saveDailyStreakState(data: DailyStreakData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DAILY_STREAK_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * Returns true if the daily lucky spin wheel is ready (cooldown elapsed or never spun).
 */
export function isDailySpinReady(): boolean {
  if (typeof window === 'undefined') return true;
  const state = getDailyStreakState();
  if (state.lastSpinTimestamp <= 0) return true;
  const elapsed = Date.now() - state.lastSpinTimestamp;
  return elapsed >= 24 * 60 * 60 * 1000;
}

/**
 * Remaining milliseconds on 24-hour daily spin cooldown.
 */
export function getRemainingSpinCooldownMs(): number {
  if (typeof window === 'undefined') return 0;
  const state = getDailyStreakState();
  if (state.lastSpinTimestamp <= 0) return 0;
  const elapsed = Date.now() - state.lastSpinTimestamp;
  const cooldown = 24 * 60 * 60 * 1000;
  return Math.max(0, cooldown - elapsed);
}

export interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimReward: (rewardAmount: number, label: string) => void;
  currentCoins: number;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
  isOpen,
  onClose,
  onClaimReward,
  currentCoins,
}) => {
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [wonSegment, setWonSegment] = useState<WheelSegment | null>(null);
  const [streakData, setStreakData] = useState<DailyStreakData>(getDailyStreakState);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(getRemainingSpinCooldownMs);

  const animFrameRef = useRef<number | null>(null);
  const lastSectorRef = useRef<number>(-1);
  const rotationRef = useRef<number>(0);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setStreakData(getDailyStreakState());
      setCooldownRemainingMs(getRemainingSpinCooldownMs());
      setWonSegment(null);
    }
  }, [isOpen]);

  // Live timer tick for cooldown countdown
  useEffect(() => {
    if (!isOpen) return;
    const interval = window.setInterval(() => {
      setCooldownRemainingMs(getRemainingSpinCooldownMs());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const spinReady = cooldownRemainingMs <= 0;

  const formatCooldown = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}h ${m}m ${s < 10 ? '0' + s : s}s`;
  };

  const handleStartSpin = useCallback(() => {
    if (isSpinning || (!spinReady && process.env.NODE_ENV !== 'test')) return;

    setIsSpinning(true);
    setWonSegment(null);

    // Pick winning segment weighted towards excitement
    // Weights: 500 (20%), 750 (20%), 1000 (18%), 1500 (15%), 2000 (12%), 2500 (8%), 5000 (5%), 10000 (2%)
    const weights = [20, 18, 8, 20, 5, 15, 2, 12];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let winningIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      if (rand < weights[i]) {
        winningIndex = i;
        break;
      }
      rand -= weights[i];
    }

    const segmentAngle = 360 / WHEEL_SEGMENTS.length; // 45 deg
    // Wheel is rendered with segment 0 centered at top (12 o'clock).
    // Clockwise rotation of theta brings segment index k = (360 - theta%360) / 45 to top.
    // Target rotation to land on winningIndex:
    const baseTargetAngle = 360 - winningIndex * segmentAngle;
    const minFullRotations = 5;
    const extraRotations = Math.floor(Math.random() * 3); // 5 to 7 full spins
    // Random jitter within +/- 15 degrees so needle doesn't hit exact center every time
    const jitter = (Math.random() - 0.5) * 26;

    const startAngle = rotationRef.current % 360;
    const finalAngle =
      rotationRef.current -
      startAngle +
      (minFullRotations + extraRotations) * 360 +
      baseTargetAngle +
      jitter;

    const duration = 3600; // ~3.6s total spin
    const startTime = performance.now();

    // Quintic ease-out for ultra smooth mechanical deceleration
    const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutQuint(progress);

      const currentAngle = rotationRef.current + (finalAngle - rotationRef.current) * eased;
      setRotationAngle(currentAngle);

      // Sector boundary ticking sound
      const normalizedAngle = ((360 - (currentAngle % 360)) % 360 + 360) % 360;
      const sector = Math.floor(((normalizedAngle + segmentAngle / 2) % 360) / segmentAngle);

      if (sector !== lastSectorRef.current) {
        lastSectorRef.current = sector;
        soundFX.playStyleFlip();
        triggerHaptic('light');
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        rotationRef.current = finalAngle;
        setIsSpinning(false);

        // Final sector landing
        const chosen = WHEEL_SEGMENTS[winningIndex];
        setWonSegment(chosen);
        soundFX.playFeverBurst();
        triggerHaptic('fever');

        // Update streak & timestamp
        const nowMs = Date.now();
        const prev = getDailyStreakState();
        let nextStreak = prev.streakCount;
        if (prev.lastSpinTimestamp > 0) {
          const diffHours = (nowMs - prev.lastSpinTimestamp) / (1000 * 3600);
          if (diffHours >= 24 && diffHours <= 48) {
            nextStreak = nextStreak >= 7 ? 1 : nextStreak + 1;
          } else if (diffHours > 48) {
            nextStreak = 1;
          }
        }
        const updatedData: DailyStreakData = {
          lastSpinTimestamp: nowMs,
          streakCount: nextStreak,
          lastSpinDate: new Date().toISOString().slice(0, 10),
          totalSpins: prev.totalSpins + 1,
        };
        saveDailyStreakState(updatedData);
        setStreakData(updatedData);
        setCooldownRemainingMs(24 * 60 * 60 * 1000);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, [isSpinning, spinReady]);

  const handleClaimWonReward = () => {
    if (!wonSegment) return;
    const amount = wonSegment.amount;
    const label = wonSegment.label;
    setWonSegment(null);
    onClaimReward(amount, label);
    soundFX.playCoinPickup(5);
    onClose();
  };

  if (!isOpen) return null;

  const segmentCount = WHEEL_SEGMENTS.length;
  const sliceAngle = 360 / segmentCount;
  const radius = 135;
  const center = 150;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Lucky Spin Wheel"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-slate-950 border border-slate-700/80 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col items-center p-4 sm:p-6 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-cyan-500/20 blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSpinning}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
          aria-label="Close Daily Wheel"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mt-1 mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono tracking-widest uppercase mb-1">
            <span>⚡ Cyberpunk Lucky Spin</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-black text-white tracking-wide">
            DAILY PRIZE WHEEL
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Bank: <span className="text-amber-400 font-bold">{Math.round(currentCoins)} CR</span>
          </p>
        </div>

        {/* 7-Day Login Streak Progress Bar */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 mb-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-1.5 px-0.5">
            <span className="font-semibold text-cyan-300">🔥 7-DAY STREAK</span>
            <span className="text-slate-400">Day {streakData.streakCount} of 7</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {STREAK_REWARDS.map((item) => {
              const isPassed = item.day < streakData.streakCount;
              const isCurrent = item.day === streakData.streakCount;
              return (
                <div
                  key={item.day}
                  className={`flex flex-col items-center justify-center p-1 rounded-lg border text-center transition-all ${
                    isPassed
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-400'
                      : isCurrent
                      ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)] text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="text-[9px] font-mono font-bold leading-none">D{item.day}</span>
                  <span className="text-[10px] my-0.5">
                    {isPassed ? '✓' : item.isJackpot ? '👑' : '🪙'}
                  </span>
                  <span className="text-[8px] font-mono tabular-nums leading-none truncate max-w-full">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wheel Area with Glowing Top Pointer Needle */}
        <div className="relative w-[300px] h-[300px] sm:w-[320px] sm:h-[320px] my-2 select-none flex items-center justify-center">
          {/* Outer Cyber Neon Ring Shadow */}
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.35)] pointer-events-none" />

          {/* Interactive Wheel SVG */}
          <svg
            viewBox="0 0 300 300"
            className="w-full h-full transform transition-transform"
            style={{
              transform: `rotate(${rotationAngle}deg)`,
              transformOrigin: '150px 150px',
            }}
          >
            <defs>
              <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background disc */}
            <circle cx={center} cy={center} r={radius} fill="#090e1a" stroke="#1e293b" strokeWidth="3" />

            {/* Slices */}
            {WHEEL_SEGMENTS.map((seg, i) => {
              // Center segment 0 at top (-90 degrees)
              const startDeg = -90 + (i - 0.5) * sliceAngle;
              const endDeg = startDeg + sliceAngle;
              const startRad = (startDeg * Math.PI) / 180;
              const endRad = (endDeg * Math.PI) / 180;

              const x1 = center + radius * Math.cos(startRad);
              const y1 = center + radius * Math.sin(startRad);
              const x2 = center + radius * Math.cos(endRad);
              const y2 = center + radius * Math.sin(endRad);

              const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;

              // Mid angle for text positioning
              const midDeg = -90 + i * sliceAngle;

              return (
                <g key={i}>
                  <path
                    d={pathData}
                    fill={seg.bgColor}
                    stroke="#1e293b"
                    strokeWidth="1.5"
                  />
                  {/* Outer edge highlight */}
                  <path
                    d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="3.5"
                    strokeOpacity="0.85"
                  />
                  {/* Cyber Rune Divider peg */}
                  <circle cx={x1} cy={y1} r="3" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1" />

                  {/* Segment Text */}
                  <g
                    transform={`rotate(${midDeg + 90}, ${center}, ${center}) translate(${center}, ${center - radius + 32})`}
                  >
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={seg.color}
                      fontSize={seg.isJackpot ? '11' : seg.isSuper ? '10' : '9.5'}
                      fontWeight="900"
                      fontFamily="monospace"
                      letterSpacing="0.05em"
                    >
                      {seg.label}
                    </text>
                    {seg.isJackpot && (
                      <text
                        textAnchor="middle"
                        y="10"
                        fill="#fbbf24"
                        fontSize="7"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        JACKPOT
                      </text>
                    )}
                    {seg.isSuper && (
                      <text
                        textAnchor="middle"
                        y="9"
                        fill="#fed7aa"
                        fontSize="6.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        SUPER DROP
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

            {/* Inner Hub */}
            <circle cx={center} cy={center} r="32" fill="#0f172a" stroke="#00f0ff" strokeWidth="2.5" />
            <circle cx={center} cy={center} r="18" fill="#1e293b" stroke="#f43f5e" strokeWidth="1.5" />
            <circle cx={center} cy={center} r="6" fill="#00f0ff" />
          </svg>

          {/* Top Indicator Needle Pointer (at 12 o'clock pointing down) */}
          <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 z-20 pointer-events-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
            <svg width="28" height="34" viewBox="0 0 28 34">
              <polygon
                points="14,32 3,4 25,4"
                fill="#fbbf24"
                stroke="#0f172a"
                strokeWidth="2"
              />
              <circle cx="14" cy="8" r="3.5" fill="#f59e0b" />
            </svg>
          </div>
        </div>

        {/* Won Prize Banner Overlay if Spin just concluded */}
        {wonSegment && (
          <div className="w-full my-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-cyan-500/20 border border-amber-400/80 text-center animate-bounce shadow-xl">
            <p className="text-[11px] font-mono tracking-widest text-amber-300 uppercase">
              🎉 PRIZE DROPPED!
            </p>
            <h3 className="text-2xl font-black font-display text-white mt-0.5">
              +{wonSegment.label}
            </h3>
            <button
              type="button"
              onClick={handleClaimWonReward}
              className="mt-2.5 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold font-display tracking-wider text-sm transition-all shadow-[0_0_20px_rgba(251,191,36,0.5)]"
            >
              COLLECT REWARD (+{wonSegment.amount} CR)
            </button>
          </div>
        )}

        {/* Spin CTA Button & Cooldown Timer */}
        {!wonSegment && (
          <div className="w-full mt-3 space-y-2">
            <button
              type="button"
              onClick={handleStartSpin}
              disabled={isSpinning || !spinReady}
              className={`w-full py-3.5 px-4 rounded-xl font-display font-black tracking-wider text-base uppercase transition-all shadow-lg ${
                isSpinning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : spinReady
                  ? 'bg-gradient-to-r from-cyan-500 via-rose-500 to-amber-500 hover:from-cyan-400 hover:to-amber-400 text-white shadow-[0_0_25px_rgba(6,182,212,0.4)] animate-pulse'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSpinning ? 'SPINNING SECTORS...' : spinReady ? 'SPIN WHEEL NOW' : 'DAILY SPIN ON COOLDOWN'}
            </button>

            {!spinReady && !isSpinning && (
              <p className="text-center text-xs font-mono text-cyan-400">
                Next Free Spin: {formatCooldown(cooldownRemainingMs)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
