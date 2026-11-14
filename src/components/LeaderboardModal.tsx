import React from 'react';
import { CAR_ROSTER } from '../game/rules';

export interface LeaderboardEntry {
  id: number;
  pilotName: string;
  carId: string;
  score: number;
  distance: number;
  maxCombo: number;
  coinsCollected: number;
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  loading: boolean;
  userEmail: string | null;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  entries,
  loading,
  userEmail,
  onGoogleSignIn,
  onSignOut,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 pointer-events-auto"
      style={{ backgroundColor: 'rgba(5, 8, 17, 0.88)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Global Drift Leaderboard"
    >
      <div
        className="w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl border border-slate-800 text-slate-100 shadow-2xl"
        style={{ backgroundColor: '#0b101e' }}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider text-cyan-400 truncate">
              CLOUD SQL GLOBAL STANDINGS
            </p>
            <h2 className="text-lg sm:text-2xl font-bold font-display truncate">
              Canyon Slash Leaderboard
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Leaderboard"
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
        {/* Account Sync Banner */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-300">
            {userEmail ? (
              <span>
                Signed in as <strong className="text-white">{userEmail}</strong> · Garage &amp; Runs synced
              </span>
            ) : (
              <span>Sign in with Google to sync your unlocked cars and post global drift scores.</span>
            )}
          </div>
          {userEmail ? (
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="min-h-[40px] px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 whitespace-nowrap shrink-0"
            >
              Sign In with Google
            </button>
          )}
        </div>

        {/* Standings Table */}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Loading global drift standings...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No drift runs recorded yet. Complete a run to claim #1!
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            {entries.map((row, idx) => {
              const carName =
                CAR_ROSTER.find((c) => c.id === row.carId)?.name || row.carId.toUpperCase();
              return (
                <div
                  key={row.id || idx}
                  className="flex items-center justify-between gap-3 px-3.5 sm:px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <span
                      className={`w-7 text-center font-mono font-bold tabular-nums shrink-0 ${
                        idx === 0
                          ? 'text-amber-400'
                          : idx === 1
                          ? 'text-slate-200'
                          : idx === 2
                          ? 'text-amber-600'
                          : 'text-slate-500'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 truncate">
                        {row.pilotName}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {carName} · {Math.round(row.distance)}m · Max x{row.maxCombo}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono font-bold tabular-nums text-amber-400 shrink-0 text-xs sm:text-sm">
                    {Math.round(row.score).toLocaleString()} PTS
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
