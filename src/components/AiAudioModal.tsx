import React, { useEffect, useState } from 'react';
import { ROAD_BIOME_ORDER, RoadBiomeId } from '../game/rules';
import {
  AI_SFX_SLOTS,
  AiSfxSlotId,
  BIOME_MUSIC_PRESETS,
} from '../game/musicConfig';
import { AudioDeckSnapshot, soundFX } from '../game/audio';
import { saveAiAudioClip } from '../lib/audioCache';

interface AiAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBiomeId: RoadBiomeId;
  autoBiomeDj: boolean;
  onToggleAutoBiomeDj: (next: boolean) => void;
  onTrackActivated: (trackId: string, title: string) => void;
}

export const AiAudioModal: React.FC<AiAudioModalProps> = ({
  isOpen,
  onClose,
  activeBiomeId,
  autoBiomeDj,
  onToggleAutoBiomeDj,
  onTrackActivated,
}) => {
  const [deck, setDeck] = useState<AudioDeckSnapshot>(() => soundFX.getDeckSnapshot());
  const [busyKey, setBusyKey] = useState<string>('');
  const [batchStatus, setBatchStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [durationMode, setDurationMode] = useState<'clip' | 'full'>('clip');
  const [customPrompt, setCustomPrompt] = useState<string>(
    'High-tempo Tokyo drift phonk and analog synthwave with crisp 808 cowbells and turbo bassline, instrumental'
  );

  useEffect(() => {
    if (!isOpen) return;
    setDeck(soundFX.getDeckSnapshot());
    return soundFX.subscribe(() => {
      setDeck(soundFX.getDeckSnapshot());
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const generateOrPlayStation = async (presetId: RoadBiomeId | 'custom', forceRefresh = false) => {
    const isLoaded = deck.loadedTrackIds.includes(presetId);
    if (isLoaded && !forceRefresh && presetId !== 'custom') {
      await soundFX.unlockAndEnsureMusic(presetId);
      const title = BIOME_MUSIC_PRESETS[presetId].title;
      onTrackActivated(presetId, title);
      return;
    }

    setBusyKey(`track:${presetId}`);
    setErrorMsg('');
    try {
      const prompt =
        presetId === 'custom'
          ? customPrompt
          : BIOME_MUSIC_PRESETS[presetId].prompt;
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetId,
          prompt: presetId === 'custom' ? prompt : '',
          durationMode,
          forceRefresh,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI music generation failed');

      const title =
        data.title ||
        (presetId !== 'custom'
          ? BIOME_MUSIC_PRESETS[presetId].title
          : 'Custom Lyria Drift Track');
      const sourceUrl = data.audioDataUrl || data.audioUrl;

      await saveAiAudioClip({
        key: `track:${presetId}`,
        kind: 'track',
        slotId: presetId,
        title,
        modelUsed: data.modelUsed || 'lyria-3-clip-preview',
        lyrics: data.lyrics || '',
        audioDataUrl: sourceUrl,
        updatedAt: Date.now(),
      });

      soundFX.setMusicEnabled(true);
      await soundFX.loadAiMusicTrack(presetId, title, sourceUrl, true);
      onTrackActivated(presetId, title);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate AI track.');
    } finally {
      setBusyKey('');
    }
  };

  const generateSfxSlot = async (slotId: AiSfxSlotId, forceRefresh = false) => {
    setBusyKey(`sfx:${slotId}`);
    setErrorMsg('');
    try {
      const res = await fetch('/api/ai/sfx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, forceRefresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI SFX generation failed');

      const sourceUrl = data.audioDataUrl || data.audioUrl;
      await saveAiAudioClip({
        key: `sfx:${slotId}`,
        kind: 'sfx',
        slotId,
        title: data.label || slotId,
        modelUsed: data.modelUsed || 'lyria-3-clip-preview',
        audioDataUrl: sourceUrl,
        updatedAt: Date.now(),
      });

      soundFX.setAiSfxEnabled(true);
      await soundFX.loadAiSfxClip(slotId, sourceUrl);
      await soundFX.previewAiSfx(slotId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate AI SFX.');
    } finally {
      setBusyKey('');
    }
  };

  const generateStarterPack = async () => {
    if (busyKey) return;
    setErrorMsg('');
    try {
      setBatchStatus(`1/6 Generating ${BIOME_MUSIC_PRESETS[activeBiomeId].title}...`);
      await generateOrPlayStation(activeBiomeId, false);

      for (let i = 0; i < AI_SFX_SLOTS.length; i++) {
        const slot = AI_SFX_SLOTS[i];
        if (deck.loadedSfxIds.includes(slot.id)) continue;
        setBatchStatus(`${i + 2}/6 Generating AI FX: ${slot.label}...`);
        await generateSfxSlot(slot.id, false);
      }
      setBatchStatus('AI Soundtrack & Full FX Pack Ready!');
      setTimeout(() => setBatchStatus(''), 3500);
    } catch {
      setBatchStatus('');
    }
  };

  const generateAllSfx = async () => {
    if (busyKey) return;
    setErrorMsg('');
    for (let i = 0; i < AI_SFX_SLOTS.length; i++) {
      const slot = AI_SFX_SLOTS[i];
      setBatchStatus(`Generating FX ${i + 1}/${AI_SFX_SLOTS.length}: ${slot.label}...`);
      await generateSfxSlot(slot.id, false);
    }
    setBatchStatus('All 5 AI SFX Stingers Loaded!');
    setTimeout(() => setBatchStatus(''), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pointer-events-auto"
      style={{ backgroundColor: 'rgba(5, 8, 17, 0.9)' }}
      role="dialog"
      aria-modal="true"
      aria-label="AI Music & Sound Effects Deck"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 p-4 sm:p-6 text-slate-100 shadow-2xl space-y-5"
        style={{ backgroundColor: '#0b101e' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <p className="text-xs font-mono tracking-wider text-cyan-400">
              LYRIA AI SOUNDTRACK &amp; WEB AUDIO DSP RACK
            </p>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
              AI Music &amp; Reactive FX Deck
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Audio Deck"
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>

        {/* One-Click Full Pack Banner */}
        <div className="p-3.5 rounded-xl border border-amber-500/40 bg-slate-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-display font-bold text-amber-300">
              Instant AI Drift Audio Pack
            </div>
            <p className="text-xs text-slate-400">
              Generates your active biome&apos;s Lyria soundtrack plus all 5 peak-sliced AI SFX stingers and caches them locally.
            </p>
          </div>
          <button
            type="button"
            disabled={Boolean(busyKey)}
            onClick={generateStarterPack}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0"
          >
            {busyKey ? 'Synthesizing...' : 'Generate AI Music + FX Pack'}
          </button>
        </div>

        {batchStatus && (
          <div className="p-3 rounded-xl border border-cyan-700/70 bg-cyan-950/50 text-xs font-mono text-cyan-200">
            {batchStatus}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl border border-rose-700/70 bg-rose-950/60 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Section 1: Real-Time DSP Effects Rack & Mixer */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-300">
              MIXER &amp; LIVE DSP EFFECTS
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-[10px] font-mono text-cyan-300">
              {deck.dspModeLabel} · {Math.round(deck.dspLowpassHz)}Hz · {deck.dspPlaybackRate.toFixed(2)}x
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1 block">
              <div className="flex justify-between font-mono text-slate-300">
                <span>AI Music Volume</span>
                <span>{Math.round(deck.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(deck.musicVolume * 100)}
                onChange={(e) => soundFX.setMusicVolume(Number(e.target.value) / 100)}
                className="w-full accent-amber-500"
              />
            </label>

            <label className="space-y-1 block">
              <div className="flex justify-between font-mono text-slate-300">
                <span>SFX &amp; Engine Volume</span>
                <span>{Math.round(deck.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(deck.sfxVolume * 100)}
                onChange={(e) => soundFX.setSfxVolume(Number(e.target.value) / 100)}
                className="w-full accent-cyan-400"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => soundFX.setMusicEnabled(!deck.musicEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                deck.musicEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              AI Music: {deck.musicEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => soundFX.setDspEnabled(!deck.dspEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                deck.dspEnabled
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              Dynamic Drift DSP: {deck.dspEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => soundFX.setAiSfxEnabled(!deck.aiSfxEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                deck.aiSfxEnabled
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              AI Musical SFX: {deck.aiSfxEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => onToggleAutoBiomeDj(!autoBiomeDj)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                autoBiomeDj
                  ? 'bg-violet-500/20 border-violet-500/60 text-violet-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              Auto Biome DJ: {autoBiomeDj ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Section 2: Biome AI Radio Stations */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-300">
              BIOME AI SOUNDTRACK STATIONS
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setDurationMode('clip')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono ${
                  durationMode === 'clip'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-300 border border-slate-800'
                }`}
              >
                30s Loop (Clip)
              </button>
              <button
                type="button"
                onClick={() => setDurationMode('full')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono ${
                  durationMode === 'full'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-300 border border-slate-800'
                }`}
              >
                Full Track (Pro)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ROAD_BIOME_ORDER.map((bId) => {
              const preset = BIOME_MUSIC_PRESETS[bId];
              const isLoaded = deck.loadedTrackIds.includes(bId);
              const isActive = deck.activeTrackId === bId;
              const isBusy = busyKey === `track:${bId}`;

              return (
                <div
                  key={bId}
                  className={`p-3 rounded-xl border transition-colors flex flex-col justify-between gap-2.5 ${
                    isActive
                      ? 'bg-slate-900 border-amber-400/80'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                        <span className="text-sm font-display font-bold text-white">
                          {preset.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {preset.genreTag}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isActive && deck.musicPlaying
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isLoaded
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isActive && deck.musicPlaying
                        ? 'PLAYING'
                        : isLoaded
                        ? 'CACHED'
                        : 'UNLOADED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyKey)}
                      onClick={() => generateOrPlayStation(bId, false)}
                      className={`flex-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isLoaded
                          ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      } disabled:opacity-50`}
                    >
                      {isBusy
                        ? 'Generating...'
                        : isActive && deck.musicPlaying
                        ? 'Active Track'
                        : isLoaded
                        ? 'Play Station'
                        : 'Generate Track'}
                    </button>
                    {isLoaded && (
                      <button
                        type="button"
                        disabled={Boolean(busyKey)}
                        onClick={() => generateOrPlayStation(bId, true)}
                        title="Regenerate fresh track via Lyria"
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono disabled:opacity-50"
                      >
                        Regen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Prompt Bar */}
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              aria-label="Custom AI Music Prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              placeholder="Describe custom AI soundtrack style..."
            />
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => generateOrPlayStation('custom', true)}
              className="min-h-[38px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-600/60 text-cyan-300 text-xs font-bold whitespace-nowrap disabled:opacity-50"
            >
              {busyKey === 'track:custom' ? 'Generating...' : 'Generate Custom'}
            </button>
          </div>
        </div>

        {/* Section 3: AI-Generated Sound Effects Pack */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono font-bold tracking-wider text-slate-300 block">
                AI-GENERATED SOUND EFFECTS PACK ({deck.loadedSfxIds.length}/{AI_SFX_SLOTS.length} LOADED)
              </span>
              <span className="text-[11px] text-slate-400">
                Lyria musical impacts automatically peak-sliced into instant gameplay FX.
              </span>
            </div>
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={generateAllSfx}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/50 text-amber-300 text-xs font-semibold whitespace-nowrap disabled:opacity-50"
            >
              Generate Missing FX
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AI_SFX_SLOTS.map((slot) => {
              const isLoaded = deck.loadedSfxIds.includes(slot.id);
              const isBusy = busyKey === `sfx:${slot.id}`;
              return (
                <div
                  key={slot.id}
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {slot.label}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {slot.shortTag} · {slot.targetDurationSec.toFixed(1)}s envelope
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLoaded && (
                      <button
                        type="button"
                        onClick={() => soundFX.previewAiSfx(slot.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-[11px] font-mono font-bold"
                      >
                        Test
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(busyKey)}
                      onClick={() => generateSfxSlot(slot.id, isLoaded)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold disabled:opacity-50"
                    >
                      {isBusy ? '...' : isLoaded ? 'Regen' : 'Generate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
