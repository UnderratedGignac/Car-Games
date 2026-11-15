import type { HornStyleId, HornTypeId, SoundProfileId } from './rules';
import {
  AI_SFX_SLOT_MAP,
  AiSfxSlotId,
  MusicDspInput,
  MusicDspParams,
  computeMusicDspParams,
  findPeakAudioWindow,
} from './musicConfig';
import { generateBuiltinArcadeTrack } from './synthTrack';
import {
  clampHapticIntensity,
  getIntensityForCategory,
  scaleHapticPattern,
  type DeviceHapticCalibration,
  type HapticEventCategory,
} from './haptics';

export type { DeviceHapticCalibration, HapticEventCategory } from './haptics';

export interface JukeboxTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  genre: string;
  mood: 'high_energy' | 'drift' | 'chill' | 'intense';
}

export const JUKEBOX_TRACKS: JukeboxTrack[] = [
  { id: 'eurobeat', title: 'Tokyo Highway Eurobeat', artist: 'Neon Redline OST', bpm: 160, genre: 'Eurobeat', mood: 'high_energy' },
  { id: 'synthwave', title: 'Cyberpunk Synthwave Pulse', artist: 'Neon Redline OST', bpm: 128, genre: 'Synthwave', mood: 'intense' },
  { id: 'phonk', title: 'Midnight Touge Drift Phonk', artist: 'Neon Redline OST', bpm: 142, genre: 'Drift Phonk', mood: 'drift' },
  { id: 'lofi', title: 'Neo-Tokyo Lo-Fi Serenity', artist: 'Neon Redline OST', bpm: 88, genre: 'Chillwave', mood: 'chill' },
];

export interface AiSfxEntry {
  slotId: AiSfxSlotId;
  url: string;
  buffer: AudioBuffer | null;
  startSec: number;
  durationSec: number;
  decoding: boolean;
}

export interface AudioDeckSnapshot {
  muted: boolean;
  musicEnabled: boolean;
  musicPlaying: boolean;
  aiSfxEnabled: boolean;
  dspEnabled: boolean;
  masterVolume: number; // 0 .. 1
  musicVolume: number; // 0 .. 1
  sfxVolume: number; // 0 .. 1
  engineVolume: number; // 0 .. 1
  activeTrackId: string;
  activeTrackTitle: string;
  currentTrack: JukeboxTrack;
  loadedTrackIds: string[];
  loadedSfxIds: AiSfxSlotId[];
  dspModeLabel: string;
  dspLowpassHz: number;
  dspPlaybackRate: number;
}

export type HapticType = 'light' | 'medium' | 'heavy' | 'double' | 'fever';

let globalHapticsEnabled = true;
let globalHapticCalibration: DeviceHapticCalibration = {
  collisionIntensity: 1.0,
  driftIntensity: 1.0,
};

export function isHapticsEnabled(): boolean {
  return globalHapticsEnabled;
}

export function getHapticCalibration(): DeviceHapticCalibration {
  return { ...globalHapticCalibration };
}

/**
 * Mobile haptic vibration helper using the Web Vibration API.
 * Respects global haptics toggle unless force = true (e.g., Settings test pulse),
 * and scales pulse durations by the calibrated intensity for collision/drift events.
 * Safely guards against SSR and environments without vibration support.
 */
export function triggerHaptic(
  type: HapticType,
  force = false,
  category: HapticEventCategory = 'general',
  calibrationOverride?: DeviceHapticCalibration
): boolean {
  if (!force && !globalHapticsEnabled) {
    return false;
  }
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  try {
    let basePattern: number | number[];
    switch (type) {
      case 'light':
        basePattern = 18; // 18ms (coin pickup / drift entry)
        break;
      case 'medium':
        basePattern = 38; // 38ms (near miss, style switch, cone clip)
        break;
      case 'heavy':
        basePattern = 65; // 65ms (guardrail scrape, crash impact)
        break;
      case 'double':
        basePattern = [25, 45, 35]; // [25, 45, 35] (combo level up, overtake streak)
        break;
      case 'fever':
        basePattern = [45, 35, 45, 35, 75]; // [45, 35, 45, 35, 75] (fever activation)
        break;
      default:
        basePattern = 18;
    }

    const activeCal = calibrationOverride ?? globalHapticCalibration;
    const intensity = getIntensityForCategory(activeCal, category);
    const scaled = scaleHapticPattern(basePattern, intensity);
    if (scaled === null) {
      return false;
    }
    return navigator.vibrate(scaled);
  } catch {
    return false;
  }
}

function makeSaturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = Math.max(0.01, drive * 28);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = drive <= 0.01 ? x : ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Procedural Web Audio API Synthesizer + AI Music DSP Rack & AI SFX Sampler
export class SoundFXSystem {
  private ctx: AudioContext | null = null;
  public muted = false;

  // Master compressor to prevent clipping when AI music + AI SFX + engine stack
  private masterComp: DynamicsCompressorNode | null = null;
  // Shared studio SFX FX Bus (subtle tape warmth + short spatial room slap delay)
  private sfxBusInput: GainNode | null = null;
  private sfxDelay: DelayNode | null = null;
  private sfxDelayFilter: BiquadFilterNode | null = null;
  private sfxDelayWet: GainNode | null = null;

  // Live continuous engine synth nodes
  private engOscA: OscillatorNode | null = null;
  private engOscB: OscillatorNode | null = null;
  private engOscSub: OscillatorNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private engShaper: WaveShaperNode | null = null;
  private engGain: GainNode | null = null;
  private engRunning = false;
  private lastTurboFlutterTime = 0;
  private lastOverrunPopTime = 0;
  private lastEngineUpdateTime = 0;
  private lastEngBaseHz = -1;
  private lastEngCutoff = -1;
  private lastEngBaseVol = 0.03;
  private lastEngVol = -1;
  public hapticsEnabled = true;
  public hapticCalibration: DeviceHapticCalibration = {
    collisionIntensity: 1.0,
    driftIntensity: 1.0,
  };

  // AI Music Deck + Real-Time Web Audio DSP Chain
  private musicEnabled = true;
  private musicPlaying = false;
  private aiSfxEnabled = true;
  private dspEnabled = true;

  // Independent Channel Volume Multipliers (Sprint 3 Specifications)
  private masterVolume = 1.0;
  private musicVolume = 0.8;
  private sfxVolume = 0.9;
  private engineVolume = 0.7;

  // Standardized Official Soundtrack for all players
  private activeTrackId = JUKEBOX_TRACKS[0].id;
  private activeTrackTitle = JUKEBOX_TRACKS[0].title;
  private activeJukeboxTrack: JukeboxTrack = JUKEBOX_TRACKS[0];
  private builtinTrackBuffer: AudioBuffer | null = null;
  private proceduralTrackBuffers = new Map<string, AudioBuffer>();
  private trackSources = new Map<string, { title: string; url: string; buffer: AudioBuffer | null; decoding: boolean }>([
    ...JUKEBOX_TRACKS.map((t) => [t.id, { title: t.title, url: `./audio/${t.id}.mp3`, buffer: null, decoding: false }] as [string, { title: string; url: string; buffer: AudioBuffer | null; decoding: boolean }]),
    [
      'neon_redline_ost',
      {
        title: 'Neon Redline — Tokyo Highway Eurobeat',
        url: './audio/neon_redline_ost.mp3',
        buffer: null,
        decoding: false,
      },
    ],
  ]);
  private musicSourceNode: AudioBufferSourceNode | null = null;
  private musicLowpass: BiquadFilterNode | null = null;
  private musicBassShelf: BiquadFilterNode | null = null;
  private musicHighShelf: BiquadFilterNode | null = null;
  private musicShaper: WaveShaperNode | null = null;
  private musicGainNode: GainNode | null = null;

  private lastDspUpdateTime = 0;
  private lastDspPhase = '';
  private lastDspParams: MusicDspParams = {
    lowpassHz: 18000,
    bassBoostDb: 2.0,
    highShelfDb: 0,
    driveAmount: 0,
    playbackRate: 1.0,
    gainMultiplier: 1.0,
  };
  private lastDriveBucket = -1;
  private dspModeLabel = 'CRUISE CLEAN';

  // AI SFX Buffer Sampler
  private aiSfxEntries = new Map<AiSfxSlotId, AiSfxEntry>();
  private listeners = new Set<() => void>();

  private notifyListeners() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getDeckSnapshot(): AudioDeckSnapshot {
    const loadedTrackIds: string[] = ['neon_redline_theme'];
    JUKEBOX_TRACKS.forEach((t) => loadedTrackIds.push(t.id));
    this.trackSources.forEach((_v, k) => {
      if (k !== 'neon_redline_theme' && !loadedTrackIds.includes(k)) loadedTrackIds.push(k);
    });
    const loadedSfxIds: AiSfxSlotId[] = [];
    this.aiSfxEntries.forEach((v, k) => {
      if (v.url || v.buffer) loadedSfxIds.push(k);
    });
    return {
      muted: this.muted,
      musicEnabled: this.musicEnabled,
      musicPlaying: this.musicPlaying,
      aiSfxEnabled: this.aiSfxEnabled,
      dspEnabled: this.dspEnabled,
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      engineVolume: this.engineVolume,
      activeTrackId: this.activeTrackId,
      activeTrackTitle: this.activeTrackTitle,
      currentTrack: this.activeJukeboxTrack,
      loadedTrackIds,
      loadedSfxIds,
      dspModeLabel: this.dspModeLabel,
      dspLowpassHz: this.lastDspParams.lowpassHz,
      dspPlaybackRate: this.lastDspParams.playbackRate,
    };
  }

  private ensureContext(ignoreMute = false): AudioContext | null {
    if (!ignoreMute && this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') {
      try {
        this.ctx.resume().catch(() => {});
      } catch {}
    }
    if (!this.masterComp) {
      try {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-12, this.ctx.currentTime);
        comp.knee.setValueAtTime(14, this.ctx.currentTime);
        comp.ratio.setValueAtTime(4, this.ctx.currentTime);
        comp.attack.setValueAtTime(0.005, this.ctx.currentTime);
        comp.release.setValueAtTime(0.18, this.ctx.currentTime);
        comp.connect(this.ctx.destination);
        this.masterComp = comp;
      } catch {}
    }
    return this.ctx;
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    return this.masterComp || ctx.destination;
  }

  /**
   * Studio SFX FX bus: clean dry signal + soft filtered 48ms spatial slap echo
   * into masterComp so procedural SFX sit naturally in space rather than sounding flat.
   */
  private getSfxBus(ctx: AudioContext): AudioNode {
    const master = this.getOutputNode(ctx);
    if (this.sfxBusInput) return this.sfxBusInput;
    try {
      const now = ctx.currentTime;
      const input = ctx.createGain();
      input.gain.setValueAtTime(1.0, now);

      const delay = ctx.createDelay(0.25);
      delay.delayTime.setValueAtTime(0.048, now);

      const fb = ctx.createGain();
      fb.gain.setValueAtTime(0.18, now);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3400, now);

      const wet = ctx.createGain();
      wet.gain.setValueAtTime(0.16, now);

      input.connect(master);
      input.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(wet);
      wet.connect(master);

      this.sfxBusInput = input;
      this.sfxDelay = delay;
      this.sfxDelayFilter = lp;
      this.sfxDelayWet = wet;
      return input;
    } catch {
      return master;
    }
  }

  private createNoiseSource(
    ctx: AudioContext,
    durationSec: number,
    shaper?: (tNorm: number, idx: number, len: number) => number
  ): AudioBufferSourceNode {
    const len = Math.max(64, Math.floor(ctx.sampleRate * durationSec));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = shaper ? shaper(i / len, i, len) : 1 - i / len;
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  private ensureMusicChain(ctx: AudioContext) {
    if (
      this.musicLowpass &&
      this.musicBassShelf &&
      this.musicHighShelf &&
      this.musicShaper &&
      this.musicGainNode
    ) {
      return;
    }
    const now = ctx.currentTime;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(18000, now);
    lowpass.Q.setValueAtTime(0.9, now);

    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.setValueAtTime(115, now);
    bass.gain.setValueAtTime(2.0, now);

    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.setValueAtTime(6200, now);
    high.gain.setValueAtTime(0.5, now);

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSaturationCurve(0);
    shaper.oversample = 'none';

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.computeEffectiveMusicGain(this.lastDspParams.gainMultiplier), now);

    lowpass.connect(bass);
    bass.connect(high);
    high.connect(shaper);
    shaper.connect(gain);
    gain.connect(this.getOutputNode(ctx));

    this.musicLowpass = lowpass;
    this.musicBassShelf = bass;
    this.musicHighShelf = high;
    this.musicShaper = shaper;
    this.musicGainNode = gain;
  }

  private computeEffectiveMusicGain(dspMultiplier: number): number {
    if (this.muted || !this.musicEnabled) return 0;
    return Math.max(0, Math.min(1, this.musicVolume * this.masterVolume * dspMultiplier * 0.72));
  }

  private async decodeUrlToBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    } catch {
      return null;
    }
  }

  public registerCachedTrack(trackId: string, title: string, url: string) {
    const existing = this.trackSources.get(trackId);
    if (existing && existing.url === url) return;
    this.trackSources.set(trackId, { title, url, buffer: null, decoding: false });
    if (!this.activeTrackId) {
      this.activeTrackId = trackId;
      this.activeTrackTitle = title;
    }
    this.notifyListeners();
  }

  public async loadAiMusicTrack(
    trackId: string,
    title: string,
    url: string,
    autoPlay = true
  ): Promise<boolean> {
    const existing = this.trackSources.get(trackId);
    let buffer = existing && existing.url === url ? existing.buffer : null;
    this.trackSources.set(trackId, { title, url, buffer, decoding: !buffer });
    this.activeTrackId = trackId;
    this.activeTrackTitle = title;
    this.notifyListeners();

    if (!autoPlay) {
      return true;
    }

    const ctx = this.ensureContext(true);
    if (!ctx) return false;
    if (!buffer) {
      buffer = await this.decodeUrlToBuffer(ctx, url);
      if (!buffer) {
        // Fallback: procedural synth loop if network fetch is blocked
        if (!this.builtinTrackBuffer) {
          this.builtinTrackBuffer = generateBuiltinArcadeTrack(ctx);
        }
        buffer = this.builtinTrackBuffer;
      }
      const entry = this.trackSources.get(trackId);
      if (entry) {
        entry.buffer = buffer;
        entry.decoding = false;
      }
    }
    if (!buffer) {
      this.notifyListeners();
      return false;
    }

    if (this.activeTrackId === trackId && this.musicEnabled) {
      this.startBufferLoop(ctx, buffer);
    }
    this.notifyListeners();
    return true;
  }

  private stopMusicSourceOnly() {
    if (this.musicSourceNode) {
      try {
        this.musicSourceNode.stop();
        this.musicSourceNode.disconnect();
      } catch {}
      this.musicSourceNode = null;
    }
    this.musicPlaying = false;
  }

  private startBufferLoop(ctx: AudioContext, buffer: AudioBuffer) {
    this.stopMusicSourceOnly();
    this.ensureMusicChain(ctx);
    if (!this.musicLowpass || !this.musicGainNode) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.setValueAtTime(
      this.dspEnabled ? this.lastDspParams.playbackRate : 1.0,
      ctx.currentTime
    );
    src.connect(this.musicLowpass);
    src.start(0);

    this.musicSourceNode = src;
    this.musicPlaying = true;
    this.musicGainNode.gain.setTargetAtTime(
      this.computeEffectiveMusicGain(this.dspEnabled ? this.lastDspParams.gainMultiplier : 1.0),
      ctx.currentTime,
      0.08
    );
  }

  /**
   * Called on user gesture (Launch Drift Run, Audio Toggle, etc.) to resume
   * or start the standardized official soundtrack.
   */
  public async unlockAndEnsureMusic(preferredTrackId?: string): Promise<void> {
    const ctx = this.ensureContext(true);
    if (!ctx) return;

    // Hydrate any registered SFX buffers lazily in background
    this.aiSfxEntries.forEach((entry, slotId) => {
      if (!entry.buffer && !entry.decoding && entry.url) {
        this.decodeSfxSlot(ctx, slotId, entry.url).catch(() => {});
      }
    });

    if (!this.musicEnabled || this.muted) return;

    const targetId = preferredTrackId || this.activeTrackId || this.activeJukeboxTrack.id;
    const jb = JUKEBOX_TRACKS.find((t) => t.id === targetId);
    if (jb) {
      this.activeJukeboxTrack = jb;
      this.activeTrackId = jb.id;
      this.activeTrackTitle = jb.title;
      let buf = this.proceduralTrackBuffers.get(jb.id);
      if (!buf) {
        buf = generateBuiltinArcadeTrack(ctx, jb);
        this.proceduralTrackBuffers.set(jb.id, buf);
      }
      this.builtinTrackBuffer = buf;
      this.startBufferLoop(ctx, buf);
      this.applyJukeboxMoodDsp(jb);
      this.notifyListeners();
      return;
    }

    let track = this.trackSources.get(targetId);
    if (!track) {
      track = this.trackSources.get('neon_redline_ost')!;
    }
    if (!track) return;

    if (this.musicPlaying && this.activeTrackId === targetId) return;
    await this.loadAiMusicTrack(targetId, track.title, track.url, true);
  }

  public getJukeboxTrack(): JukeboxTrack {
    return this.activeJukeboxTrack;
  }

  public getJukeboxTracks(): JukeboxTrack[] {
    return JUKEBOX_TRACKS;
  }

  public switchJukeboxTrack(trackId: string): JukeboxTrack {
    const found = JUKEBOX_TRACKS.find((t) => t.id === trackId) || JUKEBOX_TRACKS[0];
    this.activeJukeboxTrack = found;
    this.activeTrackId = found.id;
    this.activeTrackTitle = found.title;

    const ctx = this.ensureContext(true);
    if (ctx) {
      let buf = this.proceduralTrackBuffers.get(found.id);
      if (!buf) {
        buf = generateBuiltinArcadeTrack(ctx, found);
        this.proceduralTrackBuffers.set(found.id, buf);
      }
      this.builtinTrackBuffer = buf;

      if (this.musicPlaying && this.musicEnabled && !this.muted) {
        this.startBufferLoop(ctx, buf);
      }
      this.applyJukeboxMoodDsp(found);
    }

    this.notifyListeners();
    return found;
  }

  public nextJukeboxTrack(): JukeboxTrack {
    const currentIndex = JUKEBOX_TRACKS.findIndex((t) => t.id === this.activeJukeboxTrack.id);
    const nextIndex = (currentIndex + 1) % JUKEBOX_TRACKS.length;
    return this.switchJukeboxTrack(JUKEBOX_TRACKS[nextIndex].id);
  }

  public prevJukeboxTrack(): JukeboxTrack {
    const currentIndex = JUKEBOX_TRACKS.findIndex((t) => t.id === this.activeJukeboxTrack.id);
    const prevIndex = (currentIndex - 1 + JUKEBOX_TRACKS.length) % JUKEBOX_TRACKS.length;
    return this.switchJukeboxTrack(JUKEBOX_TRACKS[prevIndex].id);
  }

  private applyJukeboxMoodDsp(track: JukeboxTrack) {
    if (!this.ctx || !this.musicLowpass || !this.musicBassShelf || !this.musicHighShelf || !this.musicGainNode) return;
    const now = this.ctx.currentTime;
    let lowpass = 21000;
    let bassDb = 2.0;
    let highDb = 0.0;
    let drive = 0.0;

    if (track.mood === 'chill') {
      lowpass = 4800;
      bassDb = 3.5;
      highDb = -2.5;
      drive = 0.0;
    } else if (track.mood === 'drift') {
      lowpass = 16000;
      bassDb = 5.5;
      highDb = 1.0;
      drive = 0.08;
    } else if (track.mood === 'intense') {
      lowpass = 18000;
      bassDb = 3.5;
      highDb = 0.5;
      drive = 0.04;
    } else {
      lowpass = 21000;
      bassDb = 2.5;
      highDb = 2.0;
      drive = 0.02;
    }

    this.musicLowpass.frequency.setTargetAtTime(lowpass, now, 0.08);
    this.musicBassShelf.gain.setTargetAtTime(bassDb, now, 0.08);
    this.musicHighShelf.gain.setTargetAtTime(highDb, now, 0.08);
    if (this.musicShaper) {
      this.musicShaper.curve = makeSaturationCurve(drive);
    }
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusicSourceOnly();
    } else if (this.activeTrackId && !this.muted) {
      this.unlockAndEnsureMusic(this.activeTrackId).catch(() => {});
    }
    this.notifyListeners();
  }

  public setAiSfxEnabled(enabled: boolean) {
    this.aiSfxEnabled = enabled;
    this.notifyListeners();
  }

  public setDspEnabled(enabled: boolean) {
    this.dspEnabled = enabled;
    if (!enabled && this.ctx && this.musicLowpass && this.musicBassShelf && this.musicHighShelf && this.musicShaper) {
      const now = this.ctx.currentTime;
      this.musicLowpass.frequency.setTargetAtTime(21000, now, 0.08);
      this.musicBassShelf.gain.setTargetAtTime(0, now, 0.08);
      this.musicHighShelf.gain.setTargetAtTime(0, now, 0.08);
      this.musicShaper.curve = makeSaturationCurve(0);
      this.musicSourceNode?.playbackRate.setTargetAtTime(1.0, now, 0.08);
      this.dspModeLabel = 'BYPASS CLEAN';
    }
    this.notifyListeners();
  }

  public setMixerVolumes(volumes: { master?: number; music?: number; sfx?: number; engine?: number }) {
    if (volumes.master !== undefined && !Number.isNaN(volumes.master)) {
      this.masterVolume = Math.max(0, Math.min(1, volumes.master));
    }
    if (volumes.music !== undefined && !Number.isNaN(volumes.music)) {
      this.musicVolume = Math.max(0, Math.min(1, volumes.music));
    }
    if (volumes.sfx !== undefined && !Number.isNaN(volumes.sfx)) {
      this.sfxVolume = Math.max(0, Math.min(1, volumes.sfx));
    }
    if (volumes.engine !== undefined && !Number.isNaN(volumes.engine)) {
      this.engineVolume = Math.max(0, Math.min(1, volumes.engine));
    }

    if (this.ctx && this.musicGainNode) {
      const mult = this.dspEnabled ? this.lastDspParams.gainMultiplier : 1.0;
      this.musicGainNode.gain.setTargetAtTime(
        this.computeEffectiveMusicGain(mult),
        this.ctx.currentTime,
        0.05
      );
    }
    if (this.ctx && this.engGain && this.engRunning && this.lastEngVol >= 0) {
      const nextEngVol = this.lastEngBaseVol * this.engineScale;
      this.lastEngVol = nextEngVol;
      this.engGain.gain.setTargetAtTime(nextEngVol, this.ctx.currentTime, 0.05);
    }
    this.notifyListeners();
  }

  public setHapticsEnabled(enabled: boolean) {
    this.hapticsEnabled = Boolean(enabled);
    globalHapticsEnabled = this.hapticsEnabled;
    this.notifyListeners();
  }

  public setHapticCalibration(calibration: Partial<DeviceHapticCalibration>) {
    const next: DeviceHapticCalibration = {
      collisionIntensity: clampHapticIntensity(
        calibration.collisionIntensity,
        this.hapticCalibration.collisionIntensity
      ),
      driftIntensity: clampHapticIntensity(
        calibration.driftIntensity,
        this.hapticCalibration.driftIntensity
      ),
    };
    this.hapticCalibration = next;
    globalHapticCalibration = { ...next };
    this.notifyListeners();
  }

  public getMixerVolumes(): { master: number; music: number; sfx: number; engine: number } {
    return {
      master: this.masterVolume,
      music: this.musicVolume,
      sfx: this.sfxVolume,
      engine: this.engineVolume,
    };
  }

  public setMusicVolume(vol: number) {
    this.setMixerVolumes({ music: vol });
  }

  public setSfxVolume(vol: number) {
    this.setMixerVolumes({ sfx: vol });
  }

  public stopMusic() {
    this.stopMusicSourceOnly();
    this.notifyListeners();
  }

  public updateMusicEffects(input: MusicDspInput) {
    if (!this.ctx || !this.musicPlaying || !this.musicLowpass || !this.musicBassShelf || !this.musicHighShelf || !this.musicGainNode) {
      return;
    }
    const now = this.ctx.currentTime;
    // Allow immediate update on phase change, otherwise throttle ~25Hz
    if (input.phase === this.lastDspPhase && now - this.lastDspUpdateTime < 0.04) {
      return;
    }
    this.lastDspUpdateTime = now;
    this.lastDspPhase = input.phase;

    if (!this.dspEnabled) {
      this.dspModeLabel = 'BYPASS CLEAN';
      return;
    }

    const params = computeMusicDspParams(input);
    this.lastDspParams = params;

    if (input.phase === 'paused') this.dspModeLabel = 'PIT MUFFLE';
    else if (input.phase === 'gameover') this.dspModeLabel = 'WRECK TAPE-SLOW';
    else if (input.phase === 'title') this.dspModeLabel = 'GARAGE LOUNGE';
    else if (input.isFever) this.dspModeLabel = 'FEVER OVERDRIVE';
    else if (input.isBraking) this.dspModeLabel = 'BRAKE DUCK';
    else if (input.isDrifting) this.dspModeLabel = 'DRIFT RESONANCE';
    else this.dspModeLabel = 'CRUISE DYNAMIC';

    this.musicLowpass.frequency.setTargetAtTime(params.lowpassHz, now, 0.07);
    this.musicBassShelf.gain.setTargetAtTime(params.bassBoostDb, now, 0.07);
    this.musicHighShelf.gain.setTargetAtTime(params.highShelfDb, now, 0.07);
    this.musicGainNode.gain.setTargetAtTime(
      this.computeEffectiveMusicGain(params.gainMultiplier),
      now,
      0.08
    );
    if (this.musicSourceNode) {
      this.musicSourceNode.playbackRate.setTargetAtTime(params.playbackRate, now, 0.08);
    }
    if (this.musicShaper) {
      const bucket = Math.round(params.driveAmount * 10);
      if (bucket !== this.lastDriveBucket) {
        this.lastDriveBucket = bucket;
        this.musicShaper.curve = makeSaturationCurve(params.driveAmount);
      }
    }
  }

  public registerCachedSfx(slotId: AiSfxSlotId, url: string) {
    const existing = this.aiSfxEntries.get(slotId);
    if (existing && existing.url === url) return;
    this.aiSfxEntries.set(slotId, {
      slotId,
      url,
      buffer: null,
      startSec: 0,
      durationSec: AI_SFX_SLOT_MAP[slotId]?.targetDurationSec || 1.0,
      decoding: false,
    });
    this.notifyListeners();
  }

  private async decodeSfxSlot(ctx: AudioContext, slotId: AiSfxSlotId, url: string): Promise<boolean> {
    const existing = this.aiSfxEntries.get(slotId);
    if (existing?.decoding) return false;
    const spec = AI_SFX_SLOT_MAP[slotId];
    const targetDur = spec?.targetDurationSec || 1.0;

    this.aiSfxEntries.set(slotId, {
      slotId,
      url,
      buffer: null,
      startSec: 0,
      durationSec: targetDur,
      decoding: true,
    });

    const buffer = await this.decodeUrlToBuffer(ctx, url);
    if (!buffer) {
      this.aiSfxEntries.set(slotId, {
        slotId,
        url,
        buffer: null,
        startSec: 0,
        durationSec: targetDur,
        decoding: false,
      });
      return false;
    }

    const channel = buffer.getChannelData(0);
    const window = findPeakAudioWindow(channel, buffer.sampleRate, targetDur);
    this.aiSfxEntries.set(slotId, {
      slotId,
      url,
      buffer,
      startSec: window.startSec,
      durationSec: window.durationSec,
      decoding: false,
    });
    this.notifyListeners();
    return true;
  }

  public async loadAiSfxClip(slotId: AiSfxSlotId, url: string): Promise<boolean> {
    this.registerCachedSfx(slotId, url);
    const ctx = this.ensureContext(true);
    if (!ctx) return false;
    return this.decodeSfxSlot(ctx, slotId, url);
  }

  private playAiSfxClip(slotId: AiSfxSlotId, pitchMult = 1.0, gainScale = 1.0): boolean {
    if (!this.aiSfxEnabled || this.muted) return false;
    const entry = this.aiSfxEntries.get(slotId);
    if (!entry) return false;
    const ctx = this.ensureContext();
    if (!ctx) return false;

    if (!entry.buffer) {
      if (!entry.decoding && entry.url) {
        this.decodeSfxSlot(ctx, slotId, entry.url).catch(() => {});
      }
      return false;
    }

    const spec = AI_SFX_SLOT_MAP[slotId];
    const now = ctx.currentTime;
    const dur = Math.max(0.18, entry.durationSec);
    const vol = Math.max(0.05, Math.min(1.0, (spec?.baseGain ?? 0.55) * this.sfxVolume * this.masterVolume * gainScale));

    const src = ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.playbackRate.setValueAtTime(Math.max(0.75, Math.min(1.4, pitchMult)), now);

    const filter = ctx.createBiquadFilter();
    filter.type = slotId === 'crash' ? 'lowpass' : 'highpass';
    filter.frequency.setValueAtTime(slotId === 'crash' ? 5200 : 120, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.016);
    gain.gain.setValueAtTime(vol, now + Math.max(0.04, dur * 0.52));
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutputNode(ctx));

    src.start(now, entry.startSec, dur + 0.04);
    src.stop(now + dur + 0.06);
    return true;
  }

  public async previewAiSfx(slotId: AiSfxSlotId): Promise<boolean> {
    const ctx = this.ensureContext(true);
    if (!ctx) return false;
    const entry = this.aiSfxEntries.get(slotId);
    if (!entry) return false;
    if (!entry.buffer && entry.url) {
      await this.decodeSfxSlot(ctx, slotId, entry.url);
    }
    return this.playAiSfxClip(slotId, 1.0, 1.05);
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (mute) {
      this.stopEngineSound();
    }
    if (this.ctx && this.musicGainNode) {
      const mult = this.dspEnabled ? this.lastDspParams.gainMultiplier : 1.0;
      this.musicGainNode.gain.setTargetAtTime(
        this.computeEffectiveMusicGain(mult),
        this.ctx.currentTime,
        0.04
      );
    }
    this.notifyListeners();
  }

  private get sfxScale(): number {
    return Math.max(0, Math.min(1.25, this.sfxVolume * this.masterVolume));
  }

  private get engineScale(): number {
    return Math.max(0, Math.min(1.25, this.engineVolume * this.masterVolume));
  }

  public triggerHaptic(
    type: HapticType,
    force = false,
    category: HapticEventCategory = 'general',
    calibrationOverride?: DeviceHapticCalibration
  ): boolean {
    return triggerHaptic(type, force, category, calibrationOverride);
  }

  // Tactile mechanical gear shift / gate detent click + linkage thump
  public playGearShift() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const scale = this.sfxScale;

    // 1. Deep transmission linkage thump
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(165, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(52, now + 0.085);
    bodyGain.gain.setValueAtTime(0.16 * scale, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(out);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.11);

    // 2. Crisp dual-stage metallic gate detent click
    [0, 0.026].forEach((off, idx) => {
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = idx === 0 ? 'square' : 'triangle';
      clickOsc.frequency.setValueAtTime(idx === 0 ? 1180 : 1620, now + off);
      clickOsc.frequency.exponentialRampToValueAtTime(360, now + off + 0.024);
      clickGain.gain.setValueAtTime((idx === 0 ? 0.065 : 0.09) * scale, now + off);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + off + 0.028);
      clickOsc.connect(clickGain);
      clickGain.connect(out);
      clickOsc.start(now + off);
      clickOsc.stop(now + off + 0.032);
    });
  }

  // Hollow PVC traffic cone knock + double tumble bounce
  public playConeKnock(speed = 4.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const intensity = Math.max(0.6, Math.min(1.4, speed / 5.5));
    const scale = this.sfxScale * intensity;

    // Initial hollow rubber-cone bonk
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(245, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.09);
    gain.gain.setValueAtTime(0.22 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.11);

    // Crisp plastic scrape transient + secondary ground bounces
    const scrape = this.createNoiseSource(ctx, 0.075, (t) => Math.pow(1 - t, 1.8));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1050, now);
    bp.Q.setValueAtTime(2.6, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.14 * scale, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    scrape.connect(bp);
    bp.connect(nGain);
    nGain.connect(out);
    scrape.start(now);

    [0.095, 0.165].forEach((offset, idx) => {
      const bOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(190 - idx * 35, now + offset);
      bOsc.frequency.exponentialRampToValueAtTime(84, now + offset + 0.05);
      bGain.gain.setValueAtTime((0.10 - idx * 0.035) * scale, now + offset);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055);
      bOsc.connect(bGain);
      bGain.connect(out);
      bOsc.start(now + offset);
      bOsc.stop(now + offset + 0.06);
    });
  }

  // Automotive ultrasonic PDC parking sonar pulse tuned to nearest bumper clearance
  public playParkingBeep(clearanceM: number, gear: 'P' | 'R' | 'D' = 'D') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const scale = this.sfxScale;

    const clamped = Math.max(0.15, Math.min(2.0, clearanceM));
    const urgency = Math.max(0, Math.min(1, 1 - (clamped - 0.35) / 1.45));
    const baseHz = (gear === 'R' ? 980 : 840) + urgency * 460;
    const dur = clamped < 0.45 ? 0.058 : 0.072;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = clamped < 0.45 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseHz, now);

    const amp = (0.045 + urgency * 0.055) * scale;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.006);
    gain.gain.setValueAtTime(amp, now + dur * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  // Crisp electronic valet confirmation + handbrake ratchet lock when bay clears
  public playParkingLock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const scale = this.sfxScale;

    // 1. Handbrake ratchet teeth burst (krr-click)
    [0, 0.025, 0.05, 0.078].forEach((off, idx) => {
      const rOsc = ctx.createOscillator();
      const rGain = ctx.createGain();
      rOsc.type = 'square';
      rOsc.frequency.setValueAtTime(920 + idx * 140, now + off);
      rOsc.frequency.exponentialRampToValueAtTime(320, now + off + 0.018);
      rGain.gain.setValueAtTime((0.05 + idx * 0.01) * scale, now + off);
      rGain.gain.exponentialRampToValueAtTime(0.001, now + off + 0.02);
      rOsc.connect(rGain);
      rGain.connect(out);
      rOsc.start(now + off);
      rOsc.stop(now + off + 0.025);
    });

    // 2. Valet electronic lock-in arpeggio (E5 -> G#5 -> B5 -> E6)
    [659.25, 830.61, 987.77, 1318.51].forEach((freq, idx) => {
      const t = now + 0.06 + idx * 0.048;
      const osc = ctx.createOscillator();
      const oscShimmer = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      oscShimmer.type = 'sine';
      oscShimmer.frequency.setValueAtTime(freq * 2, t);

      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(0.28, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14 * scale, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(gain);
      oscShimmer.connect(sGain);
      sGain.connect(gain);
      gain.connect(out);

      osc.start(t);
      oscShimmer.start(t);
      osc.stop(t + 0.25);
      oscShimmer.stop(t + 0.25);
    });
  }

  // Layered tire scrub, resonant turbo flutter & hype combo fanfares on drift flip
  public playDriftFlip(combo: number, isFever = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const pitchVariance = 0.94 + Math.random() * 0.12;
    const comboSemitone = Math.pow(1.032, Math.min(12, combo));
    const hasAi = this.playAiSfxClip('drift_flip', pitchVariance * comboSemitone, isFever ? 0.95 : 0.78);
    const layer = (hasAi ? 0.52 : 1.0) * this.sfxScale;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);

    // 1. Dual-detuned turbo intake stab through resonant filter envelope
    const baseFreq = (isFever ? 310 : 230) * pitchVariance * comboSemitone;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.setValueAtTime(3.6, now);
    filt.frequency.setValueAtTime(baseFreq * 2.2, now);
    filt.frequency.exponentialRampToValueAtTime(baseFreq * 5.8, now + 0.08);
    filt.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.18);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.14 * layer, now + 0.012);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    filt.connect(oscGain);
    oscGain.connect(out);

    [1.0, 1.007].forEach((det) => {
      const osc = ctx.createOscillator();
      osc.type = isFever ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * det, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.38 * det, now + 0.10);
      osc.connect(filt);
      osc.start(now);
      osc.stop(now + 0.19);
    });

    // 2. Dual-band asphalt tire scrub burst (low rubber groan + high chirp)
    const noise = this.createNoiseSource(ctx, 0.13, (t) => Math.pow(1 - t, 1.35));
    const groanBp = ctx.createBiquadFilter();
    groanBp.type = 'bandpass';
    groanBp.frequency.setValueAtTime(880 * pitchVariance, now);
    groanBp.Q.setValueAtTime(2.8, now);

    const screechBp = ctx.createBiquadFilter();
    screechBp.type = 'bandpass';
    screechBp.frequency.setValueAtTime(2150 * pitchVariance, now);
    screechBp.frequency.exponentialRampToValueAtTime(2750 * pitchVariance, now + 0.11);
    screechBp.Q.setValueAtTime(5.2, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.11 * layer, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    noise.connect(groanBp);
    noise.connect(screechBp);
    groanBp.connect(nGain);
    screechBp.connect(nGain);
    nGain.connect(out);
    noise.start(now);

    // 3. Hype combo stings layered cleanly into FX bus as combo climbs
    if (combo >= 5) {
      const stingScale = this.sfxScale * (hasAi ? 0.45 : 0.8);
      if (combo >= 20) {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const sOsc = ctx.createOscillator();
          const sLp = ctx.createBiquadFilter();
          const sGain = ctx.createGain();
          sOsc.type = 'sawtooth';
          sOsc.frequency.setValueAtTime(f, now + i * 0.026);
          sLp.type = 'lowpass';
          sLp.frequency.setValueAtTime(3400, now + i * 0.026);
          sGain.gain.setValueAtTime(0.10 * stingScale, now + i * 0.026);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.026 + 0.22);
          sOsc.connect(sLp);
          sLp.connect(sGain);
          sGain.connect(out);
          sOsc.start(now + i * 0.026);
          sOsc.stop(now + i * 0.026 + 0.23);
        });
      } else if (combo >= 15) {
        [440, 554.37, 659.25].forEach((f, i) => {
          const sOsc = ctx.createOscillator();
          const sLp = ctx.createBiquadFilter();
          const sGain = ctx.createGain();
          sOsc.type = 'sawtooth';
          sOsc.frequency.setValueAtTime(f, now + i * 0.028);
          sLp.type = 'lowpass';
          sLp.frequency.setValueAtTime(2900, now + i * 0.028);
          sGain.gain.setValueAtTime(0.095 * stingScale, now + i * 0.028);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.028 + 0.18);
          sOsc.connect(sLp);
          sLp.connect(sGain);
          sGain.connect(out);
          sOsc.start(now + i * 0.028);
          sOsc.stop(now + i * 0.028 + 0.19);
        });
      } else if (combo >= 10) {
        [349.23, 523.25].forEach((f, i) => {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          sOsc.type = 'triangle';
          sOsc.frequency.setValueAtTime(f, now + i * 0.03);
          sGain.gain.setValueAtTime(0.11 * stingScale, now + i * 0.03);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.15);
          sOsc.connect(sGain);
          sGain.connect(out);
          sOsc.start(now + i * 0.03);
          sOsc.stop(now + i * 0.03 + 0.16);
        });
      } else {
        const sOsc = ctx.createOscillator();
        const sGain = ctx.createGain();
        sOsc.type = 'sine';
        sOsc.frequency.setValueAtTime(baseFreq * 1.5, now + 0.02);
        sGain.gain.setValueAtTime(0.09 * stingScale, now + 0.02);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        sOsc.connect(sGain);
        sGain.connect(out);
        sOsc.start(now + 0.02);
        sOsc.stop(now + 0.15);
      }
    }
  }

  // Crisp metallic coin clink transient + bright bell-harmonic chime with escalating streak
  public playCoinPickup(streak = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const safeStreak = Math.max(0, Math.min(24, streak));
    const pitchMult = Math.pow(1.059463, safeStreak % 12) * (1 + Math.floor(safeStreak / 12) * 0.24);
    const scale = this.sfxScale;

    // 1. Metallic token strike transient (inharmonic bell ratio 2.756x)
    const clinkOsc = ctx.createOscillator();
    const clinkGain = ctx.createGain();
    clinkOsc.type = 'sine';
    clinkOsc.frequency.setValueAtTime(2480 * pitchMult, now);
    clinkGain.gain.setValueAtTime(0.08 * scale, now);
    clinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    clinkOsc.connect(clinkGain);
    clinkGain.connect(out);
    clinkOsc.start(now);
    clinkOsc.stop(now + 0.05);

    // 2. Dual-partial harmonic chime (fundamental + octave/fifth shimmer)
    const baseFreqs = safeStreak >= 3 ? [659.25, 987.77, 1318.51] : [659.25, 987.77];
    baseFreqs.forEach((freq, idx) => {
      const t = now + idx * 0.036;
      const startFreq = freq * pitchMult;

      const osc = ctx.createOscillator();
      const over = ctx.createOscillator();
      const overGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 1.025, t + 0.14);

      over.type = 'triangle';
      over.frequency.setValueAtTime(startFreq * 2.0, t);
      overGain.gain.setValueAtTime(0.24, t);

      const noteVol = (idx === 2 ? 0.085 : 0.145) * scale;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(noteVol, t + 0.007);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

      osc.connect(gain);
      over.connect(overGain);
      overGain.connect(gain);
      gain.connect(out);

      osc.start(t);
      over.start(t);
      osc.stop(t + 0.2);
      over.stop(t + 0.2);
    });
  }

  // Multi-pulse JDM wastegate blow-off flutter & pressurized air release
  public playTurboChirp() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const scale = this.sfxScale;

    // 1. Compressed intake air release burst
    const hissNode = this.createNoiseSource(ctx, 0.21, (t) => Math.pow(1 - t, 1.55));
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.Q.setValueAtTime(1.8, now);
    hissFilter.frequency.setValueAtTime(3400, now);
    hissFilter.frequency.exponentialRampToValueAtTime(1150, now + 0.20);
    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0.18 * scale, now);
    hissGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    hissNode.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(out);
    hissNode.start(now);

    // 2. Iconic 4-pulse decaying BOV flutter (su-tu-tu-tu-tu)
    const flutterOffsets = [0, 0.038, 0.078, 0.118];
    const flutterPitches = [2600, 2240, 1920, 1620];
    flutterOffsets.forEach((offset, idx) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const f = flutterPitches[idx] * (0.97 + Math.random() * 0.06);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.68, t + 0.048);

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f * 0.95, t);
      bp.Q.setValueAtTime(3.2, t);

      const amp = (0.125 - idx * 0.022) * scale;
      gain.gain.setValueAtTime(amp, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.052);

      osc.connect(bp);
      bp.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.058);
    });
  }

  // Nitro purge hiss + sub-drop + lush hypersaw chord burst on Fever activation
  public playFeverBurst() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const hasAi = this.playAiSfxClip('fever', 1.0, 1.0);
    const layer = (hasAi ? 0.54 : 1.0) * this.sfxScale;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);

    // 1. Sub-bass ignition drop
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(125, now);
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.28);
    subGain.gain.setValueAtTime(0.28 * layer, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    subOsc.connect(subGain);
    subGain.connect(out);
    subOsc.start(now);
    subOsc.stop(now + 0.31);

    // 2. Pressurized nitrous purge swoosh
    const purge = this.createNoiseSource(ctx, 0.26, (t) => Math.sin(t * Math.PI) * (1 - t * 0.4));
    const pFilter = ctx.createBiquadFilter();
    pFilter.type = 'highpass';
    pFilter.frequency.setValueAtTime(1800, now);
    pFilter.frequency.exponentialRampToValueAtTime(4800, now + 0.24);
    const pGain = ctx.createGain();
    pGain.gain.setValueAtTime(0.14 * layer, now);
    pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    purge.connect(pFilter);
    pFilter.connect(pGain);
    pGain.connect(out);
    purge.start(now);

    // 3. Swept filter hypersaw fanfare chord
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.setValueAtTime(2.0, now);
    lp.frequency.setValueAtTime(750, now);
    lp.frequency.exponentialRampToValueAtTime(5200, now + 0.22);
    lp.connect(out);

    notes.forEach((f, i) => {
      const t = now + i * 0.036;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.095 * layer, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(lp);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  // Crisp dual-tone style switch chime with tactile transient (/ <-> \ mid-drift)
  public playStyleSwitch(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const mult = Math.pow(1.038, Math.min(16, combo));
    const hasAi = this.playAiSfxClip('drift_flip', mult, 0.72);
    const layer = (hasAi ? 0.55 : 1.0) * this.sfxScale;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);

    [440, 659.25].forEach((freq, i) => {
      const t = now + i * 0.034;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * mult, t);
      gain.gain.setValueAtTime(0.135 * layer, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  // Tactile sector flipper click + bright ping for wheel & UI flips
  public playStyleFlip() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.022);
    gain.gain.setValueAtTime(0.095 * this.sfxScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.042);
  }

  // Metallic guardrail scrape sparks + steel rail resonance
  public playGuardrailSpark() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const scale = this.sfxScale;

    // 1. High-energy spark sizzle noise
    const noise = this.createNoiseSource(ctx, 0.10, (t) => Math.pow(1 - t, 1.1));
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2700 + Math.random() * 800, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    noise.start(now);

    // 2. Metallic steel rail scrape ring
    [1820, 3140].forEach((hz, idx) => {
      const mOsc = ctx.createOscillator();
      const mGain = ctx.createGain();
      mOsc.type = 'sawtooth';
      mOsc.frequency.setValueAtTime(hz + Math.random() * 240, now);
      mOsc.frequency.exponentialRampToValueAtTime(hz * 0.65, now + 0.08);
      mGain.gain.setValueAtTime((idx === 0 ? 0.045 : 0.03) * scale, now);
      mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      mOsc.connect(mGain);
      mGain.connect(out);
      mOsc.start(now);
      mOsc.stop(now + 0.09);
    });
  }

  // Shimmering crystal arpeggio + octave sparkle on Nitro Star pickup
  public playStarPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const scale = this.sfxScale;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((f, i) => {
      const t = now + i * 0.032;
      const osc = ctx.createOscillator();
      const hi = ctx.createOscillator();
      const hiGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      hi.type = 'triangle';
      hi.frequency.setValueAtTime(f * 2.0, t);
      hiGain.gain.setValueAtTime(0.28, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.13 * scale, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      hi.connect(hiGain);
      hiGain.connect(gain);
      gain.connect(out);

      osc.start(t);
      hi.start(t);
      osc.stop(t + 0.23);
      hi.stop(t + 0.23);
    });
  }

  // Guardrail breach metallic shear + wind rush drop
  public playFallAndDestroy() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const layer = this.sfxScale;

    // 1. Metallic rail shear impact
    const crunchNoise = this.createNoiseSource(ctx, 0.18, (t) => Math.pow(1 - t, 1.1));
    const crunchFilter = ctx.createBiquadFilter();
    crunchFilter.type = 'bandpass';
    crunchFilter.frequency.setValueAtTime(1450, now);
    crunchFilter.Q.setValueAtTime(1.5, now);
    const crunchGain = ctx.createGain();
    crunchGain.gain.setValueAtTime(0.28 * layer, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    crunchNoise.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    crunchGain.connect(out);
    crunchNoise.start(now);

    // 2. Downward air rush sweep
    const windNoise = this.createNoiseSource(ctx, 0.46, (t) => Math.sin(t * Math.PI));
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(1050, now);
    windFilter.frequency.exponentialRampToValueAtTime(240, now + 0.46);
    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.15 * layer, now);
    windGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(out);
    windNoise.start(now);
  }

  // Heavy chassis slam: sub-bass punch + modulated sheet-metal crumple + glass/debris shatter
  public playGroundSlam(intensity = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const hasAi = this.playAiSfxClip('crash', 0.94, Math.min(1.0, 0.72 * intensity));
    const layer = (hasAi ? 0.62 : 1.0) * this.sfxScale * Math.max(0.45, Math.min(1.25, intensity));
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);

    // 1. Sub-chassis punch (118Hz -> 30Hz)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(118, now);
    thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
    thudGain.gain.setValueAtTime(0.44 * layer, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    thudOsc.connect(thudGain);
    thudGain.connect(out);
    thudOsc.start(now);
    thudOsc.stop(now + 0.28);

    // 2. Textured sheet-metal crumple + gravel scatter
    const crumpleSrc = this.createNoiseSource(ctx, 0.44, (t, idx) => {
      const env = Math.pow(1 - t, 1.3);
      const pulse = Math.sin(idx * 0.045) > 0.15 ? 1.0 : 0.42;
      return env * pulse;
    });
    const crumpleBp = ctx.createBiquadFilter();
    crumpleBp.type = 'bandpass';
    crumpleBp.frequency.setValueAtTime(980, now);
    crumpleBp.frequency.exponentialRampToValueAtTime(380, now + 0.38);
    crumpleBp.Q.setValueAtTime(1.1, now);
    const crumpleGain = ctx.createGain();
    crumpleGain.gain.setValueAtTime(0.32 * layer, now);
    crumpleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    crumpleSrc.connect(crumpleBp);
    crumpleBp.connect(crumpleGain);
    crumpleGain.connect(out);
    crumpleSrc.start(now);

    // 3. Glass & trim debris scatter sparkle
    const debrisSrc = this.createNoiseSource(ctx, 0.28, (t, idx) =>
      Math.pow(1 - t, 1.9) * (idx % 17 < 4 ? 1.0 : 0.25)
    );
    const debrisHp = ctx.createBiquadFilter();
    debrisHp.type = 'highpass';
    debrisHp.frequency.setValueAtTime(3600, now);
    const debrisGain = ctx.createGain();
    debrisGain.gain.setValueAtTime(0.14 * layer, now + 0.02);
    debrisGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    debrisSrc.connect(debrisHp);
    debrisHp.connect(debrisGain);
    debrisGain.connect(out);
    debrisSrc.start(now + 0.02);
  }

  // Heavy vehicle-to-vehicle or barrier impact crunch
  public playTrafficCrunch(intensity = 1.0) {
    this.playGroundSlam(Math.max(0.65, intensity));
  }

  // Sharp metallic bolt shear + rattling body panel clatter when a part detaches
  public playPartDetach(partCount = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const hits = Math.min(3, Math.max(1, partCount));

    // Snap shear noise
    const snap = this.createNoiseSource(ctx, 0.07, (t) => Math.pow(1 - t, 2.2));
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2200, now);
    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.15 * this.sfxScale, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    snap.connect(hp);
    hp.connect(sGain);
    sGain.connect(out);
    snap.start(now);

    for (let i = 0; i < hits; i++) {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440 + i * 110, t);
      osc.frequency.exponentialRampToValueAtTime(125, t + 0.13);
      gain.gain.setValueAtTime(0.13 * this.sfxScale, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  // Pneumatic impact air-wrench pulses + metallic torque-lock chime on repair
  public playRepairWrench() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    const scale = this.sfxScale;

    [0, 0.055, 0.11].forEach((offset, idx) => {
      const t = now + offset;
      // Compressed air burst
      const air = this.createNoiseSource(ctx, 0.045, (u) => 1 - u);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(idx === 2 ? 2600 : 1850, t);
      bp.Q.setValueAtTime(2.2, t);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.10 * scale, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      air.connect(bp);
      bp.connect(nGain);
      nGain.connect(out);
      air.start(t);

      // Impact hammer anvil tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 2 ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(idx === 2 ? 820 : 340 + idx * 70, t);
      osc.frequency.exponentialRampToValueAtTime(idx === 2 ? 1240 : 195, t + 0.048);
      gain.gain.setValueAtTime((idx === 2 ? 0.14 : 0.095) * scale, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  // Crisp rising turbo-pass cue + aerodynamic air slip when overtaking traffic
  public playOvertake(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const mult = Math.pow(1.032, Math.min(12, combo));
    const hasAi = this.playAiSfxClip('overtake', mult, 0.85);
    const layer = (hasAi ? 0.52 : 1.0) * this.sfxScale;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);

    // Light wind pass
    const air = this.createNoiseSource(ctx, 0.11, (t) => Math.sin(t * Math.PI));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(950 * mult, now);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    const aGain = ctx.createGain();
    aGain.gain.setValueAtTime(0.11 * layer, now);
    aGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    air.connect(bp);
    bp.connect(aGain);
    aGain.connect(out);
    air.start(now);

    [392.0, 587.33].forEach((f, idx) => {
      const t = now + idx * 0.038;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * mult, t);
      gain.gain.setValueAtTime(0.125 * layer, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  // High-adrenaline Doppler air compression thump + swept whoosh + bright chime on near-miss
  public playNearMiss(isOncoming: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const hasAi = this.playAiSfxClip('overtake', isOncoming ? 1.15 : 1.05, 0.9);
    const layer = (hasAi ? 0.65 : 1.0) * this.sfxScale;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);

    // 1. Air pressure wave sub-thump (150Hz -> 55Hz)
    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isOncoming ? 180 : 140, now);
    sub.frequency.exponentialRampToValueAtTime(52, now + 0.13);
    sGain.gain.setValueAtTime(0.22 * layer, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    sub.connect(sGain);
    sGain.connect(out);
    sub.start(now);
    sub.stop(now + 0.15);

    // 2. Doppler air-whoosh resonant sweep
    const noise = this.createNoiseSource(ctx, 0.21, (t) => Math.sin(t * Math.PI));
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isOncoming ? 2200 : 1450, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.20);
    filter.Q.setValueAtTime(2.6, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.24 * layer, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(out);
    noise.start(now);

    // 3. Crisp reward chime
    const notes = isOncoming ? [659.25, 987.77, 1318.51] : [587.33, 880.0];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.032;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.135 * layer, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.20);
    });
  }

  // Turbo slipstream burst when slingshotting past a drafted vehicle
  public playSlipstreamPass(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const mult = Math.pow(1.032, Math.min(12, combo));
    const hasAi = this.playAiSfxClip('fever', 1.08, 0.65);
    const layer = (hasAi ? 0.58 : 1.0) * this.sfxScale;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);

    const whoosh = this.createNoiseSource(ctx, 0.16, (t) => Math.sin(t * Math.PI));
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1600 * mult, now);
    hp.frequency.exponentialRampToValueAtTime(3400 * mult, now + 0.15);
    const wGain = ctx.createGain();
    wGain.gain.setValueAtTime(0.14 * layer, now);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    whoosh.connect(hp);
    hp.connect(wGain);
    wGain.connect(out);
    whoosh.start(now);

    [440, 659.25, 880, 1174.66].forEach((f, idx) => {
      const t = now + idx * 0.028;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * mult, t);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      gain.gain.setValueAtTime(0.095 * layer, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.21);
    });
  }

  // Euphoric gold chord chime on milestones & mission clears
  public playMilestone() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const hasAi = this.playAiSfxClip('milestone', 1.0, 1.0);
    const layer = (hasAi ? 0.52 : 1.0) * this.sfxScale;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);

    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, idx) => {
      const t = now + idx * 0.04;
      const osc = ctx.createOscillator();
      const shimmer = ctx.createOscillator();
      const sGain = ctx.createGain();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(f * 2, t);
      sGain.gain.setValueAtTime(0.22, t);
      gain.gain.setValueAtTime(0.115 * layer, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      shimmer.connect(sGain);
      sGain.connect(gain);
      gain.connect(out);
      osc.start(t);
      shimmer.start(t);
      osc.stop(t + 0.29);
      shimmer.stop(t + 0.29);
    });
  }

  // Customizable Car Horn Synthesizer routed through warm studio saturation + spatial FX bus
  public playHorn(hornStyle?: HornStyleId | HornTypeId | string) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = this.sfxScale;
    const out = this.getSfxBus(ctx);

    let hornBus: AudioNode = out;
    try {
      if (typeof ctx.createWaveShaper === 'function') {
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeSaturationCurve(0.14);
        shaper.connect(out);
        hornBus = shaper;
      }
    } catch {}

    const style = String(hornStyle || 'dual').toLowerCase();

    if (style === 'laser' || style === 'cyber_chirp') {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.17);

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(7.5, now);
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.17);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24 * scale, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(hornBus);

      osc.start(now);
      osc.stop(now + 0.20);
    } else if (style === 'fanfare') {
      const notes = [
        { f: 523.25, start: 0, dur: 0.08 },
        { f: 659.25, start: 0.08, dur: 0.08 },
        { f: 783.99, start: 0.16, dur: 0.08 },
        { f: 1046.50, start: 0.24, dur: 0.26 },
      ];
      notes.forEach(({ f, start, dur }) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + start);
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(2.4, now + start);
        filter.frequency.setValueAtTime(2400, now + start);
        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(0.19 * scale, now + start + 0.012);
        gain.gain.setValueAtTime(0.19 * scale, now + start + dur - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(hornBus);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.01);
      });
    } else if (style === 'melody' || style === 'jdm_sport') {
      const riff = [
        { f: 523.25, start: 0, dur: 0.07 },
        { f: 659.25, start: 0.07, dur: 0.07 },
        { f: 783.99, start: 0.14, dur: 0.07 },
        { f: 880.00, start: 0.21, dur: 0.07 },
        { f: 1046.50, start: 0.28, dur: 0.22 },
      ];
      riff.forEach(({ f, start, dur }) => {
        const osc = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, now + start);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(3200, now + start);
        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(0.16 * scale, now + start + 0.008);
        gain.gain.setValueAtTime(0.16 * scale, now + start + dur - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(lp);
        lp.connect(gain);
        gain.connect(hornBus);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.01);
      });
    } else if (
      style === 'train' ||
      style === 'train_bass' ||
      style === 'air_horn' ||
      style === 'truck_air_blast'
    ) {
      [150, 225].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(2.6, now);
        filter.frequency.setValueAtTime(980, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.24 * scale, now + 0.025);
        gain.gain.setValueAtTime(0.24 * scale, now + 0.34);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.41);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(hornBus);
        osc.start(now);
        osc.stop(now + 0.42);
      });
    } else {
      [440, 370].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(2.1, now);
        filter.frequency.setValueAtTime(2400, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18 * scale, now + 0.016);
        gain.gain.setValueAtTime(0.18 * scale, now + 0.21);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(hornBus);
        osc.start(now);
        osc.stop(now + 0.26);
      });
    }
  }

  // Crisp relay snap + bright double pulse when flashing high beams
  public playHeadlightFlash() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    [0, 0.11].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 0 ? 1160 : 1440, now + offset);
      osc.frequency.exponentialRampToValueAtTime(520, now + offset + 0.055);
      gain.gain.setValueAtTime(0.115 * this.sfxScale, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.065);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + offset);
      osc.stop(now + offset + 0.075);
    });
  }

  // Friendly blinker yield chime when ahead traffic pulls out of your lane
  public playTrafficYieldChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getSfxBus(ctx);
    [659.25, 987.77].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.048);
      gain.gain.setValueAtTime(0.11 * this.sfxScale, now + idx * 0.048);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.048 + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + idx * 0.048);
      osc.stop(now + idx * 0.048 + 0.17);
    });
  }

  // Continuous throttled engine note with sub-octave rumble + subtle intake warmth
  public updateEngineSound(params: {
    active: boolean;
    speedRatio: number; // 0.3 .. 1.6
    isGassing: boolean;
    isBraking: boolean;
    isFever: boolean;
    soundProfile?: SoundProfileId;
  }) {
    if (!params.active || this.muted) {
      this.stopEngineSound();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const profile = params.soundProfile || 'stock';

    if (!this.engRunning || !this.engOscA || !this.engOscB || !this.engOscSub || !this.engFilter || !this.engGain) {
      try {
        this.engOscA = ctx.createOscillator();
        this.engOscB = ctx.createOscillator();
        this.engOscSub = ctx.createOscillator();
        this.engOscSub.type = 'triangle';
        this.engFilter = ctx.createBiquadFilter();
        this.engShaper = ctx.createWaveShaper();
        this.engShaper.curve = makeSaturationCurve(0.09);
        this.engGain = ctx.createGain();

        this.engFilter.type = 'lowpass';
        this.engFilter.Q.setValueAtTime(1.8, now);
        this.engGain.gain.setValueAtTime(0.001, now);

        this.engOscA.connect(this.engFilter);
        this.engOscB.connect(this.engFilter);
        this.engOscSub.connect(this.engFilter);
        this.engFilter.connect(this.engShaper);
        this.engShaper.connect(this.engGain);
        this.engGain.connect(this.getOutputNode(ctx));

        this.engOscA.start(now);
        this.engOscB.start(now);
        this.engOscSub.start(now);
        this.engRunning = true;
        this.lastEngineUpdateTime = 0;
        this.lastEngBaseHz = -1;
        this.lastEngCutoff = -1;
        this.lastEngVol = -1;
      } catch {
        this.engRunning = false;
        return;
      }
    }

    // Throttle WebAudio parameter automation to ~25Hz so 60-120fps frames don't spam AudioParams
    if (this.lastEngineUpdateTime > 0 && now - this.lastEngineUpdateTime < 0.04) {
      return;
    }
    this.lastEngineUpdateTime = now;

    const r = Math.max(0.25, Math.min(1.65, params.speedRatio));
    let baseHz = 54 + r * 78;
    let harmMult = 1.5;
    let cutoff = 230 + r * 380;
    let oscTypeA: OscillatorType = 'sawtooth';
    let oscTypeB: OscillatorType = 'triangle';

    if (profile === 'jdm_turbo') {
      baseHz = 62 + r * 92;
      harmMult = 2.0;
      cutoff = 310 + r * 510;
    } else if (profile === 'v8_muscle') {
      baseHz = 40 + r * 52;
      harmMult = 1.5;
      cutoff = 210 + r * 320;
      oscTypeB = 'sawtooth';
    } else if (profile === 'f1_scream') {
      baseHz = 86 + r * 142;
      harmMult = 2.0;
      cutoff = 480 + r * 800;
    } else if (profile === 'rotary_braap') {
      baseHz = 68 + r * 102;
      harmMult = 1.333;
      cutoff = 370 + r * 580;
      oscTypeA = 'square';
    }

    if (params.isFever) {
      baseHz *= 1.15;
      cutoff *= 1.35;
    }

    const effectiveCutoff = cutoff + (params.isGassing ? 250 : 0);
    const baseVol = params.isGassing ? 0.042 : params.isBraking ? 0.017 : 0.026;
    this.lastEngBaseVol = baseVol;
    const targetVol = baseVol * this.engineScale;

    if (this.engOscA.type !== oscTypeA) this.engOscA.type = oscTypeA;
    if (this.engOscB.type !== oscTypeB) this.engOscB.type = oscTypeB;

    if (Math.abs(baseHz - this.lastEngBaseHz) > 0.75) {
      this.lastEngBaseHz = baseHz;
      this.engOscA.frequency.setTargetAtTime(baseHz, now, 0.045);
      this.engOscB.frequency.setTargetAtTime(baseHz * harmMult, now, 0.045);
      this.engOscSub.frequency.setTargetAtTime(Math.max(24, baseHz * 0.5), now, 0.045);
    }
    if (Math.abs(effectiveCutoff - this.lastEngCutoff) > 8) {
      this.lastEngCutoff = effectiveCutoff;
      this.engFilter.frequency.setTargetAtTime(effectiveCutoff, now, 0.05);
    }
    if (Math.abs(targetVol - this.lastEngVol) > 0.002) {
      this.lastEngVol = targetVol;
      this.engGain.gain.setTargetAtTime(targetVol, now, 0.06);
    }

    // Subtle turbo blow-off flutter on throttle + high speed for JDM Turbo
    if (profile === 'jdm_turbo' && params.isGassing && r > 1.05 && now - this.lastTurboFlutterTime > 2.4) {
      this.lastTurboFlutterTime = now;
      const tOsc = ctx.createOscillator();
      const tGain = ctx.createGain();
      tOsc.type = 'sine';
      tOsc.frequency.setValueAtTime(1650, now);
      tOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.14);
      tGain.gain.setValueAtTime(0.02 * this.engineScale, now);
      tGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.16);
      tOsc.connect(tGain);
      tGain.connect(this.getSfxBus(ctx));
      tOsc.start(now);
      tOsc.stop(now + 0.17);
    }

    // Subtle sporty exhaust overrun crackle when lifting off throttle at speed
    if (
      !params.isGassing &&
      r > 0.92 &&
      (profile === 'jdm_turbo' || profile === 'rotary_braap' || profile === 'v8_muscle') &&
      now - this.lastOverrunPopTime > 1.85
    ) {
      this.lastOverrunPopTime = now;
      const popNoise = this.createNoiseSource(ctx, 0.05, (t) => Math.pow(1 - t, 2.5));
      const popLp = ctx.createBiquadFilter();
      popLp.type = 'lowpass';
      popLp.frequency.setValueAtTime(620, now);
      const popGain = ctx.createGain();
      popGain.gain.setValueAtTime(0.032 * this.engineScale, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      popNoise.connect(popLp);
      popLp.connect(popGain);
      popGain.connect(this.getSfxBus(ctx));
      popNoise.start(now);
    }
  }

  public stopEngineSound() {
    if (!this.engRunning) return;
    this.engRunning = false;
    this.lastEngineUpdateTime = 0;
    this.lastEngBaseHz = -1;
    this.lastEngCutoff = -1;
    this.lastEngVol = -1;
    try {
      this.engOscA?.stop();
      this.engOscB?.stop();
      this.engOscSub?.stop();
      this.engOscA?.disconnect();
      this.engOscB?.disconnect();
      this.engOscSub?.disconnect();
      this.engFilter?.disconnect();
      this.engShaper?.disconnect();
      this.engGain?.disconnect();
    } catch {}
    this.engOscA = null;
    this.engOscB = null;
    this.engOscSub = null;
    this.engFilter = null;
    this.engShaper = null;
    this.engGain = null;
  }
}

/**
 * Computes effective channel volume multiplier clamped between 0 and 1.
 */
export function computeMixerVolume(channelVolume: number, masterVolume: number): number {
  const c = Math.max(0, Math.min(1, channelVolume));
  const m = Math.max(0, Math.min(1, masterVolume));
  return Number((c * m).toFixed(4));
}

export const soundFX = new SoundFXSystem();
export { SoundFXSystem as DriftAudioEngine };
