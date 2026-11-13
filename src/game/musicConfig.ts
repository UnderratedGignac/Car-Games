/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RoadBiomeId } from './rules';

export type AiMusicPresetId = RoadBiomeId | 'custom';
export type AiSfxSlotId = 'fever' | 'milestone' | 'crash' | 'overtake' | 'drift_flip';

export interface BiomeMusicPreset {
  id: RoadBiomeId;
  title: string;
  genreTag: string;
  bpm: number;
  accentColor: string;
  prompt: string;
}

export const BIOME_MUSIC_PRESETS: Record<RoadBiomeId, BiomeMusicPreset> = {
  alpine: {
    id: 'alpine',
    title: 'Alpine Touge Eurobeat',
    genreTag: 'EUROBEAT · 154 BPM',
    bpm: 154,
    accentColor: '#38bdf8',
    prompt:
      'High-energy 90s Japanese touge eurobeat instrumental racing anthem at 154 BPM with rapid supersaw synth leads, driving octave bassline, crisp snare rolls, and uplifting arcade chorus energy, no vocals',
  },
  canyon: {
    id: 'canyon',
    title: 'Sunset Canyon Synth-Rock',
    genreTag: 'SYNTH-ROCK · 138 BPM',
    bpm: 138,
    accentColor: '#fb923c',
    prompt:
      'Adrenaline-fueled desert canyon arcade racing track at 138 BPM blending overdriven electric guitar riffs, warm analog synth brass, thundering acoustic drums, and heroic sunset momentum, instrumental only',
  },
  neon: {
    id: 'neon',
    title: 'Wangan Midnight Phonk',
    genreTag: 'DRIFT PHONK · 142 BPM',
    bpm: 142,
    accentColor: '#22d3ee',
    prompt:
      'Hard-hitting Tokyo midnight highway drift phonk and dark cyberpunk synthwave instrumental at 142 BPM with signature metallic 808 cowbell melody, distorted sub-bass, and roaring turbo atmosphere, no vocals',
  },
  sakura: {
    id: 'sakura',
    title: 'Sakura Ridge Liquid D&B',
    genreTag: 'LIQUID D&B · 172 BPM',
    bpm: 172,
    accentColor: '#f472b6',
    prompt:
      'Euphoric fast-paced Japanese drum and bass racing soundtrack at 172 BPM with crisp breakbeats, lush cherry-blossom piano chords, bright koto-like synth plucks, and soaring sub-bass, instrumental only',
  },
};

export interface AiSfxSlotSpec {
  id: AiSfxSlotId;
  label: string;
  shortTag: string;
  targetDurationSec: number;
  baseGain: number;
  prompt: string;
}

export const AI_SFX_SLOTS: AiSfxSlotSpec[] = [
  {
    id: 'fever',
    label: 'Nitro Fever Overdrive Drop',
    shortTag: 'FEVER',
    targetDurationSec: 1.5,
    baseGain: 0.72,
    prompt:
      'Explosive futuristic arcade nitro boost sound effect: tight 1-second turbo synth riser straight into a massive euphoric bass drop chord impact, clean studio punch, instrumental',
  },
  {
    id: 'drift_flip',
    label: 'Apex Drift Whip Stinger',
    shortTag: 'DRIFT',
    targetDurationSec: 0.45,
    baseGain: 0.48,
    prompt:
      'Ultra-tight snappy electronic percussion whip hit and metallic phonk cowbell transient stinger for sharp car cornering, fast attack, dry punchy mix, instrumental',
  },
  {
    id: 'overtake',
    label: 'Highway Pass Whoosh Hit',
    shortTag: 'PASS',
    targetDurationSec: 0.6,
    baseGain: 0.52,
    prompt:
      'Crisp aerodynamic synth whoosh sweep followed by a bright high-tech dual-note arcade reward chime hit, fast attack, instrumental',
  },
  {
    id: 'milestone',
    label: 'Sector Clear Fanfare',
    shortTag: 'RANK',
    targetDurationSec: 1.25,
    baseGain: 0.6,
    prompt:
      'Triumphant retro-arcade motorsport fanfare chord stab with shimmering ascending synthesizer arpeggio, energetic celebratory hit, instrumental',
  },
  {
    id: 'crash',
    label: 'Guardrail Crash Sub-Impact',
    shortTag: 'CRASH',
    targetDurationSec: 1.45,
    baseGain: 0.78,
    prompt:
      'Heavy dramatic cinematic sub-bass impact boom with metallic crunch transient and dark analog synth power-down sweep, intense collision hit, instrumental',
  },
];

export const AI_SFX_SLOT_MAP: Record<AiSfxSlotId, AiSfxSlotSpec> = AI_SFX_SLOTS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<AiSfxSlotId, AiSfxSlotSpec>
);

export interface MusicDspInput {
  phase: 'title' | 'playing' | 'paused' | 'gameover';
  speedRatio: number; // ~0.35 .. 1.65
  isDrifting: boolean;
  driftFactor: number; // 0 .. 1
  isFever: boolean;
  isBraking: boolean;
  isNearEdge: boolean;
}

export interface MusicDspParams {
  lowpassHz: number;
  bassBoostDb: number;
  highShelfDb: number;
  driveAmount: number; // 0 .. 1
  playbackRate: number; // 0.84 .. 1.06
  gainMultiplier: number; // 0 .. 1.15
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Computes real-time Web Audio DSP modulation parameters applied directly
 * onto the AI-generated music stream based on driving state.
 */
export function computeMusicDspParams(input: MusicDspInput): MusicDspParams {
  const spd = clamp(input.speedRatio, 0.25, 1.65);
  const drift = clamp(input.driftFactor, 0, 1);

  if (input.phase === 'paused') {
    return {
      lowpassHz: 540,
      bassBoostDb: 3.5,
      highShelfDb: -5.5,
      driveAmount: 0,
      playbackRate: 0.96,
      gainMultiplier: 0.44,
    };
  }

  if (input.phase === 'gameover') {
    return {
      lowpassHz: 420,
      bassBoostDb: 2.0,
      highShelfDb: -6.0,
      driveAmount: 0.05,
      playbackRate: 0.86,
      gainMultiplier: 0.36,
    };
  }

  if (input.phase === 'title') {
    return {
      lowpassHz: 4200,
      bassBoostDb: 2.0,
      highShelfDb: -1.0,
      driveAmount: 0,
      playbackRate: 1.0,
      gainMultiplier: 0.62,
    };
  }

  // Active gameplay DSP modulation
  if (input.isFever) {
    return {
      lowpassHz: 21500,
      bassBoostDb: 7.2,
      highShelfDb: 4.5,
      driveAmount: 0.28,
      playbackRate: 1.045,
      gainMultiplier: 1.1,
    };
  }

  if (input.isBraking) {
    return {
      lowpassHz: 1850,
      bassBoostDb: 4.2,
      highShelfDb: -3.2,
      driveAmount: 0.04,
      playbackRate: 0.945,
      gainMultiplier: 0.82,
    };
  }

  // Cruising + active drifting sweep
  const speedOpen = clamp((spd - 0.45) / 0.95, 0, 1);
  const baseCutoff = 7600 + speedOpen * 11400;
  const driftResonanceLift = input.isDrifting ? 1600 * drift : 0;
  const edgeAdrenaline = input.isNearEdge ? 1400 : 0;

  return {
    lowpassHz: clamp(Math.round(baseCutoff + driftResonanceLift + edgeAdrenaline), 2200, 21000),
    bassBoostDb: Number((2.4 + drift * 2.6 + (input.isNearEdge ? 1.2 : 0)).toFixed(2)),
    highShelfDb: Number((0.2 + speedOpen * 1.8 + drift * 1.4).toFixed(2)),
    driveAmount: Number((drift * 0.14 + (input.isNearEdge ? 0.08 : 0)).toFixed(3)),
    playbackRate: Number((0.99 + speedOpen * 0.025 + drift * 0.01).toFixed(4)),
    gainMultiplier: Number((0.92 + speedOpen * 0.08).toFixed(3)),
  };
}

/**
 * Scans a decoded audio buffer to find the punchiest peak-energy transient window
 * of length `targetDurationSec` so long AI music clips turn into crisp, instant SFX.
 */
export function findPeakAudioWindow(
  samples: Float32Array,
  sampleRate: number,
  targetDurationSec: number
): { startSec: number; durationSec: number } {
  if (!samples || samples.length === 0 || sampleRate <= 0) {
    return { startSec: 0, durationSec: Math.max(0.25, targetDurationSec) };
  }

  const totalDur = samples.length / sampleRate;
  const durationSec = Math.min(totalDur, Math.max(0.2, targetDurationSec));
  if (totalDur <= durationSec + 0.08) {
    return { startSec: 0, durationSec };
  }

  const windowSamples = Math.max(1, Math.floor(durationSec * sampleRate));
  const hopSamples = Math.max(1, Math.floor(0.05 * sampleRate)); // 50ms scan step
  const maxStartIdx = Math.max(0, samples.length - windowSamples);

  // Prefix sum of squared amplitudes for O(N) exact window RMS scoring
  // Stride by 4 for fast inner scoring on large buffers
  let bestStart = 0;
  let bestScore = -1;

  for (let start = 0; start <= maxStartIdx; start += hopSamples) {
    let sumSq = 0;
    let peak = 0;
    // Emphasize the first 35% of the window so SFX hits have a strong immediate attack
    const attackEnd = start + Math.floor(windowSamples * 0.35);
    const stride = 8;
    let count = 0;
    for (let i = start; i < start + windowSamples; i += stride) {
      const v = Math.abs(samples[i]);
      const weight = i < attackEnd ? 1.65 : 0.85;
      sumSq += v * v * weight;
      if (v > peak) peak = v;
      count++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    const score = rms * 0.72 + peak * 0.28;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  // Nudge backward slightly (~35ms) to preserve the natural attack transient
  const preRollSamples = Math.floor(0.035 * sampleRate);
  const refinedStart = Math.max(0, bestStart - preRollSamples);

  return {
    startSec: Number((refinedStart / sampleRate).toFixed(3)),
    durationSec: Number(Math.min(totalDur - refinedStart / sampleRate, durationSec).toFixed(3)),
  };
}
