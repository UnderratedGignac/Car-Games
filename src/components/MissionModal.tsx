/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Mission,
  claimMission,
  getDailyMissions,
  getTimeUntilUtcMidnight,
} from '../game/missions';
import { soundFX, triggerHaptic } from '../game/audio';

export interface MissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimReward: (rewardAmount: number, label: string) => void;
}

function renderMissionIcon(icon: string) {
  switch (icon) {
    case 'flame':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-rose-400">
          <path d="M12 23c-4.97 0-9-4.03-9-9 0-4.66 3.52-8.5 7.5-12 1.48 2.25 3.5 5.5 3.5 8 0 .55-.45 1-1 1s-1-.45-1-1c0-1.28-.96-3-2.06-4.5C7.45 8.1 5 11.13 5 14c0 3.87 3.13 7 7 7s7-3.13 7-7c0-1.89-1.07-4.14-2.58-6.17a1 1 0 0 1 1.6-1.2C19.78 8.87 21 11.53 21 14c0 4.97-4.03 9-9 9z" />
        </svg>
      );
    case 'zap':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-amber-400">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'ghost':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-cyan-400">
          <path d="M12 2a8 8 0 0 0-8 8v10a2 2 0 0 0 3.4 1.4L11 19.8l1.6 1.6a2 2 0 0 0 2.8 0L17 19.8l1.6 1.6A2 2 0 0 0 22 20V10a8 8 0 0 0-8-8zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
      );
    case 'car':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-emerald-400">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM7.5 16c-.83 0-1.5-.67-1.5-1.5S6.67 13 7.5 13s1.5.67 1.5 1.5S8.33 16 7.5 16zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      );
    case 'coins':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-yellow-400">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-1c-1.66 0-3-1.34-3-3h2c0 .55.45 1 1 1h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-1.66 0-3-1.34-3-3s1.34-3 3-3V6h2v1c1.66 0 3 1.34 3 3h-2c0-.55-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1h2c1.66 0 3 1.34 3 3s-1.34 3-3 3v1z" />
        </svg>
      );
    case 'gauge':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-purple-400">
          <path d="M12 4a8 8 0 0 0-8 8c0 2.21.89 4.21 2.34 5.66l1.41-1.41A6 6 0 0 1 6 12a6 6 0 0 1 12 0c0 1.66-.67 3.16-1.76 4.24l1.42 1.42A8 8 0 0 0 12 4zm-1 5v4.41l2.83 2.83 1.41-1.41L13 12.59V9h-2z" />
        </svg>
      );
    case 'rocket':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-orange-400">
          <path d="M13.13 2.13a1 1 0 0 0-1.26 0C8.32 5.09 5.5 9.17 5 14c0 1.25.32 2.45.89 3.5L3 21l3.5-2.89A7.78 7.78 0 0 0 10 19c4.83-.5 8.91-3.32 11.87-6.87a1 1 0 0 0 0-1.26C18.91 7.32 14.83 2.5 13.13 2.13zM12 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
        </svg>
      );
    case 'trophy':
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-amber-400">
          <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1c1.86-.47 3.29-1.95 3.61-3.96C19.08 11.63 21 9.55 21 7V5c0-1.1-.9-2-2-2zm-14 3V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
        </svg>
      );
  }
}

export const MissionModal: React.FC<MissionModalProps> = ({
  isOpen,
  onClose,
  onClaimReward,
}) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [countdownStr, setCountdownStr] = useState<string>('');

  const refreshMissions = () => {
    setMissions(getDailyMissions());
  };

  useEffect(() => {
    if (isOpen) {
      refreshMissions();
      const tick = () => {
        const { formatted } = getTimeUntilUtcMidnight();
        setCountdownStr(formatted);
      };
      tick();
      const interval = window.setInterval(tick, 1000);
      return () => window.clearInterval(interval);
    }
  }, [isOpen]);

  const handleClaim = (mission: Mission) => {
    if (!mission.completed || mission.claimed) return;
    const result = claimMission(mission.id);
    if (result.success) {
      soundFX.playFeverBurst();
      triggerHaptic('fever');
      onClaimReward(result.reward, `Daily Mission: ${mission.title}`);
      refreshMissions();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Missions Modal"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-950/95 border border-slate-700/80 shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden flex flex-col p-4 sm:p-6 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-12 bg-purple-500/20 blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close Daily Missions"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-mono tracking-widest uppercase mb-1">
            <span>📋 Daily Cyberpunk Challenges</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-black text-white tracking-wide">
            DAILY MISSIONS
          </h2>
          <p className="text-xs text-cyan-400 font-mono mt-0.5">
            Resets at Midnight UTC {countdownStr ? `(${countdownStr})` : ''}
          </p>
        </div>

        {/* 3 Mission Cards */}
        <div className="space-y-3">
          {missions.map((m) => {
            const currentCapped = Math.min(m.current, m.target);
            const percent = Math.min(100, Math.floor((currentCapped / m.target) * 100));

            return (
              <div
                key={m.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  m.claimed
                    ? 'bg-slate-900/50 border-slate-800/80 opacity-70'
                    : m.completed
                    ? 'bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-950 border-amber-500/80 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      {renderMissionIcon(m.icon)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{m.title}</span>
                        {m.completed && !m.claimed && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-bold uppercase tracking-wider">
                            Ready!
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="inline-block px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs">
                      +{m.reward.toLocaleString()} CR
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Numeric Indicator */}
                <div className="mt-3">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
                    <span>PROGRESS</span>
                    <span className="tabular-nums">
                      {currentCapped.toLocaleString()} / {m.target.toLocaleString()}{' '}
                      ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        m.claimed
                          ? 'bg-slate-600'
                          : m.completed
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                          : 'bg-gradient-to-r from-cyan-500 to-fuchsia-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Action CTA */}
                <div className="mt-3 flex justify-end">
                  {m.claimed ? (
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 text-xs font-mono font-semibold cursor-default"
                    >
                      Claimed ✓
                    </button>
                  ) : m.completed ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(m)}
                      className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs font-bold font-display tracking-wider shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse transition-all cursor-pointer"
                    >
                      CLAIM REWARD
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-slate-400 text-xs font-mono cursor-default"
                    >
                      In Progress ({percent}%)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info note */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400 font-mono">
            💡 Missions track progress across all Touge drift & Highway traffic runs.
          </p>
        </div>
      </div>
    </div>
  );
};
