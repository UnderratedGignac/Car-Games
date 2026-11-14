/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock, Star, Trophy, X } from 'lucide-react';
import {
  CAMPAIGN_LEVELS,
  CampaignLevel,
  LevelProgressMap,
  getTotalCampaignStars,
  isLevelUnlocked,
} from '../game/levels';

interface LevelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLevelId: string | null;
  progress: LevelProgressMap;
  onSelectLevel: (levelId: string | null) => void;
}

const BIOME_DOT: Record<string, string> = {
  alpine: '#22c55e',
  canyon: '#ea580c',
  sakura: '#f472b6',
  neon: '#22d3ee',
};

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  isOpen,
  onClose,
  selectedLevelId,
  progress,
  onSelectLevel,
}) => {
  if (!isOpen) return null;

  const summary = getTotalCampaignStars(progress);
  const chapters = Array.from(new Set(CAMPAIGN_LEVELS.map((l) => l.chapter)));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/92"
      role="dialog"
      aria-modal="true"
      aria-label="Campaign Stages and Free Run"
    >
      <div className="w-full max-w-3xl max-h-[90dvh] rounded-2xl border border-slate-700/80 bg-[#090e1a] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-950/70">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
              <h2 className="text-lg sm:text-xl font-display font-bold text-white tracking-wide truncate">
                CAMPAIGN STAGES
              </h2>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5 tabular-nums">
              {summary.completedCount}/{CAMPAIGN_LEVELS.length} Stages Cleared ·{' '}
              <span className="text-amber-400 font-bold">
                {summary.earned}/{summary.total} ★
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Stage Select"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Stage Roster */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Endless Free Run Card */}
          <div>
            <button
              type="button"
              data-level-option="free"
              aria-label="Select Endless Free Run"
              onClick={() => {
                onSelectLevel(null);
                onClose();
              }}
              className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                selectedLevelId === null
                  ? 'bg-cyan-950/35 border-cyan-400 ring-1 ring-cyan-400/40'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80'
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-[10px] font-mono font-bold text-cyan-300 shrink-0">
                    ENDLESS
                  </span>
                  <span className="text-sm sm:text-base font-display font-bold text-white">
                    Free Run &amp; Parking Proving Ground
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Freely mix S-Curve Touge, 2-Lane Highway Traffic, or 6-Stage Parking across any biome or sky.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0 ${
                  selectedLevelId === null
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {selectedLevelId === null ? 'ACTIVE' : 'SELECT'}
              </span>
            </button>
          </div>

          {/* Chapters 1–5 */}
          {chapters.map((chapter) => {
            const chapterLevels: CampaignLevel[] = CAMPAIGN_LEVELS.filter(
              (l) => l.chapter === chapter
            );
            return (
              <div key={chapter} className="space-y-2.5">
                <h3 className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase px-1">
                  {chapter}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {chapterLevels.map((lvl) => {
                    const unlocked = isLevelUnlocked(lvl.number, progress);
                    const entry = progress[lvl.id];
                    const stars = entry?.stars ?? 0;
                    const isSelected = selectedLevelId === lvl.id;
                    const isHighway = lvl.mode === 'highway_traffic';

                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        disabled={!unlocked}
                        data-level-option={lvl.id}
                        aria-label={`Stage ${lvl.number}: ${lvl.title}${
                          !unlocked ? ' (Locked)' : ''
                        }`}
                        onClick={() => {
                          if (!unlocked) return;
                          onSelectLevel(lvl.id);
                          onClose();
                        }}
                        className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                          !unlocked
                            ? 'bg-slate-950/80 border-slate-800/80 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-amber-950/30 border-amber-400 ring-1 ring-amber-400/50'
                            : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 cursor-pointer'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                                  isSelected
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-200'
                                }`}
                              >
                                {String(lvl.number).padStart(2, '0')}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                                  isHighway
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {isHighway ? 'HIGHWAY' : 'DRIFT'}
                              </span>
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: BIOME_DOT[lvl.biome] || '#38bdf8' }}
                                aria-hidden="true"
                              />
                              <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                                {lvl.targetDistance}m
                              </span>
                            </div>

                            {unlocked ? (
                              <div className="flex items-center gap-0.5 shrink-0" aria-label={`${stars} of 3 stars`}>
                                {[1, 2, 3].map((sIdx) => (
                                  <Star
                                    key={sIdx}
                                    className={`w-3.5 h-3.5 ${
                                      sIdx <= stars
                                        ? 'text-amber-400 fill-amber-400'
                                        : 'text-slate-700'
                                    }`}
                                  />
                                ))}
                              </div>
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            )}
                          </div>

                          <div className="font-display font-bold text-sm sm:text-base text-white truncate">
                            {lvl.title}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                            {lvl.subtitle}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono tabular-nums">
                          {unlocked ? (
                            <>
                              <span className="text-slate-300">
                                {entry?.bestScore
                                  ? `BEST ${entry.bestScore.toLocaleString()}`
                                  : `3★ ${lvl.starThresholds[2].toLocaleString()}`}
                              </span>
                              <span className="text-amber-400 font-bold">
                                +{lvl.rewardCoins} CR
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-500">
                              Clear Stage {lvl.number - 1} to unlock
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
