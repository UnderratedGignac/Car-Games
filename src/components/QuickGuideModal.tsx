/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  Flame,
  Gauge,
  Hand,
  OctagonAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import type { GameModeId } from '../game/rules';
import {
  ControlSchemeId,
  QuickGuideControlId,
  getControlSchemeLabel,
  getQuickGuideForMode,
} from '../game/quickGuide';

export interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameMode: GameModeId;
  controlScheme: ControlSchemeId;
}

const ACCENT_STYLES: Record<
  'amber' | 'cyan' | 'emerald' | 'orange',
  {
    border: string;
    headerIconBg: string;
    modeTag: string;
    buttonBg: string;
    cardHighlight: string;
  }
> = {
  amber: {
    border: 'border-amber-500/40',
    headerIconBg: 'bg-amber-500/15 border-amber-400/50 text-amber-300',
    modeTag: 'text-amber-300',
    buttonBg: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    cardHighlight: 'border-amber-500/25',
  },
  cyan: {
    border: 'border-cyan-500/40',
    headerIconBg: 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300',
    modeTag: 'text-cyan-300',
    buttonBg: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950',
    cardHighlight: 'border-cyan-500/25',
  },
  emerald: {
    border: 'border-emerald-500/40',
    headerIconBg: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300',
    modeTag: 'text-emerald-300',
    buttonBg: 'bg-emerald-400 hover:bg-emerald-300 text-slate-950',
    cardHighlight: 'border-emerald-500/25',
  },
  orange: {
    border: 'border-orange-500/40',
    headerIconBg: 'bg-orange-500/15 border-orange-400/50 text-orange-300',
    modeTag: 'text-orange-300',
    buttonBg: 'bg-orange-400 hover:bg-orange-300 text-slate-950',
    cardHighlight: 'border-orange-500/25',
  },
};

function renderControlIcon(controlId: QuickGuideControlId, mode: GameModeId) {
  switch (controlId) {
    case 'steer':
      return (
        <div
          className="w-11 h-11 rounded-xl bg-cyan-500/12 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <ArrowLeftRight className="w-5 h-5" />
        </div>
      );
    case 'gas':
      return (
        <div
          className="w-11 h-11 rounded-xl bg-emerald-500/12 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Gauge className="w-5 h-5" />
        </div>
      );
    case 'brake':
      return (
        <div
          className="w-11 h-11 rounded-xl bg-rose-500/12 border border-rose-400/40 text-rose-300 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <OctagonAlert className="w-5 h-5" />
        </div>
      );
    case 'nitro':
    default:
      if (mode === 'parking') {
        return (
          <div
            className="w-11 h-11 rounded-xl bg-amber-500/12 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <Hand className="w-5 h-5" />
          </div>
        );
      }
      return (
        <div
          className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-400/45 text-sky-300 flex items-center justify-center shrink-0 relative"
          aria-hidden="true"
        >
          <Flame className="w-5 h-5" />
          <Zap className="w-3 h-3 text-amber-300 absolute -top-1 -right-1" />
        </div>
      );
  }
}

export const QuickGuideModal: React.FC<QuickGuideModalProps> = ({
  isOpen,
  onClose,
  gameMode,
  controlScheme,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const guide = getQuickGuideForMode(gameMode, controlScheme);
  const accent = ACCENT_STYLES[guide.accentColor];
  const schemeLabel = getControlSchemeLabel(controlScheme);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Guide"
    >
      <div
        className={`relative w-full max-w-2xl rounded-2xl bg-slate-950 border ${accent.border} shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] text-slate-100`}
        style={{ backgroundColor: 'rgba(9, 14, 26, 0.98)' }}
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 pb-3.5 border-b border-slate-800/90">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${accent.headerIconBg}`}
              aria-hidden="true"
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 truncate">
                <span className={`font-bold ${accent.modeTag}`}>{guide.modeTitle}</span>
                <span aria-hidden="true">·</span>
                <span>{schemeLabel}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-display font-bold tracking-wide text-white truncate">
                Quick Guide
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors shrink-0"
            aria-label="Close Quick Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Guide Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
          {/* Mode Objective Summary */}
          <div className="space-y-1">
            <p className="text-xs font-mono text-slate-400">{guide.modeSubtitle}</p>
            <p className="text-sm text-slate-200 leading-relaxed">{guide.objective}</p>
          </div>

          {/* 4 Core Controls Grid: Steer, Gas, Brake, Nitro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {guide.controls.map((item) => (
              <section
                key={item.id}
                data-guide-control={item.id}
                className={`rounded-xl bg-slate-900/85 border border-slate-800 ${accent.cardHighlight} p-3.5 flex flex-col justify-between gap-2.5`}
              >
                <div className="flex items-start gap-3">
                  {renderControlIcon(item.id, guide.mode)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-display font-bold text-white">
                        {item.label}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                        {item.actionTag}
                      </span>
                    </div>

                    {/* Keycaps & Touch Mapping */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {item.keycaps.map((cap) => (
                        <kbd
                          key={cap}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono font-bold text-slate-100 shadow-inner"
                        >
                          {cap}
                        </kbd>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{item.summary}</p>

                <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
                  <div className="font-mono text-cyan-300 leading-snug">
                    Touch: {item.touchHint}
                  </div>
                  <div className="text-slate-400 leading-snug flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item.proTip}</span>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {/* Mode Extras & Cockpit Shortcuts */}
          <div className="pt-2 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono text-slate-400">Cockpit Shortcuts</span>
            <div className="flex flex-wrap items-center gap-3">
              {guide.shortcuts.map((sc) => (
                <div key={sc.keycap} className="flex items-center gap-1.5 text-slate-200">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-slate-100">
                    {sc.keycap}
                  </kbd>
                  <span className="text-[11px] text-slate-300">{sc.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 bg-slate-950 border-t border-slate-800/90 flex items-center justify-between gap-3">
          <span className="text-[11px] font-mono text-slate-400 truncate">
            Switches automatically with selected mode
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`min-h-[40px] px-5 py-2 rounded-xl font-display font-bold text-sm tracking-wide transition-colors whitespace-nowrap shrink-0 ${accent.buttonBg}`}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
