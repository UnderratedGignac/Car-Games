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

/**
 * Mobile haptic vibration helper using the Web Vibration API.
 * Safely guards against SSR and environments without vibration support.
 */
export function triggerHaptic(type: HapticType): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  try {
    let pattern: number | number[];
    switch (type) {
      case 'light':
        pattern = 18; // 18ms (coin pickup)
        break;
      case 'medium':
        pattern = 38; // 38ms (near miss, style switch)
        break;
      case 'heavy':
        pattern = 65; // 65ms (guardrail scrape, crash impact)
        break;
      case 'double':
        pattern = [25, 45, 35]; // [25, 45, 35] (combo level up, overtake streak)
        break;
      case 'fever':
        pattern = [45, 35, 45, 35, 75]; // [45, 35, 45, 35, 75] (fever activation)
        break;
      default:
        pattern = 18;
    }
    return navigator.vibrate(pattern);
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

  // Live continuous engine synth nodes
  private engOscA: OscillatorNode | null = null;
  private engOscB: OscillatorNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private engGain: GainNode | null = null;
  private engRunning = false;
  private lastTurboFlutterTime = 0;
  private lastEngineUpdateTime = 0;
  private lastEngBaseHz = -1;
  private lastEngCutoff = -1;
  private lastEngVol = -1;

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
    if (this.ctx && this.engGain && this.engRunning && this.lastEngVol > 0) {
      this.engGain.gain.setTargetAtTime(this.lastEngVol, this.ctx.currentTime, 0.05);
    }
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

  public triggerHaptic(type: HapticType): boolean {
    return triggerHaptic(type);
  }

  // Subtle mechanical gear shift / soft thump sound (Zen mode guardrails & traffic bump)
  public playGearShift() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.12 * this.sfxScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.1);

    // Soft mechanical click transient
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(480, now);
    clickOsc.frequency.exponentialRampToValueAtTime(180, now + 0.03);

    clickGain.gain.setValueAtTime(0.08 * this.sfxScale, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    clickOsc.connect(clickGain);
    clickGain.connect(this.getOutputNode(ctx));
    clickOsc.start(now);
    clickOsc.stop(now + 0.04);
  }

  // Light pitch-varied tire screech + turbo flutter + hype combo stings on diagonal direction flip (/ <-> \)
  public playDriftFlip(combo: number, isFever = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const pitchVariance = 0.94 + Math.random() * 0.12;
    const comboSemitone = Math.pow(1.035, Math.min(12, combo));
    const hasAi = this.playAiSfxClip('drift_flip', pitchVariance * comboSemitone, isFever ? 0.95 : 0.78);
    const layer = (hasAi ? 0.48 : 1.0) * this.sfxScale;

    const now = ctx.currentTime;

    // Turbo blow-off / synth chord stab
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isFever ? 'sawtooth' : 'triangle';
    const baseFreq = (isFever ? 330 : 240) * pitchVariance * comboSemitone;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.09);

    gain.gain.setValueAtTime(0.14 * layer, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.15);

    // Subtle tire hiss burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450 * pitchVariance, now);
    filter.Q.setValueAtTime(3.2, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.08 * layer, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.getOutputNode(ctx));
    noise.start(now);

    // Hype combo stings layered on top as combo climbs (SLICK WEAVE -> DRIFT DEMON -> APEX PREDATOR -> DRIFT GOD)
    if (combo >= 5) {
      const stingScale = this.sfxScale * (hasAi ? 0.45 : 0.82);
      if (combo >= 20) {
        // Combo >= 20: "UNSTOPPABLE DRIFT GOD!" 4-note ascending euphoric synth fanfare
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          sOsc.type = 'sawtooth';
          sOsc.frequency.setValueAtTime(f, now + i * 0.024);
          sGain.gain.setValueAtTime(0.12 * stingScale, now + i * 0.024);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.024 + 0.18);
          sOsc.connect(sGain);
          sGain.connect(this.getOutputNode(ctx));
          sOsc.start(now + i * 0.024);
          sOsc.stop(now + i * 0.024 + 0.19);
        });
      } else if (combo >= 15) {
        // Combo >= 15: "APEX PREDATOR!" Triple chord ascending arpeggio
        [440, 554.37, 659.25].forEach((f, i) => {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          sOsc.type = 'sawtooth';
          sOsc.frequency.setValueAtTime(f, now + i * 0.028);
          sGain.gain.setValueAtTime(0.10 * stingScale, now + i * 0.028);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.028 + 0.15);
          sOsc.connect(sGain);
          sGain.connect(this.getOutputNode(ctx));
          sOsc.start(now + i * 0.028);
          sOsc.stop(now + i * 0.028 + 0.16);
        });
      } else if (combo >= 10) {
        // Combo >= 10: "DRIFT DEMON!" Punchy dual harmonic fifth
        [349.23, 523.25].forEach((f, i) => {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          sOsc.type = 'triangle';
          sOsc.frequency.setValueAtTime(f, now + i * 0.03);
          sGain.gain.setValueAtTime(0.11 * stingScale, now + i * 0.03);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.13);
          sOsc.connect(sGain);
          sGain.connect(this.getOutputNode(ctx));
          sOsc.start(now + i * 0.03);
          sOsc.stop(now + i * 0.03 + 0.14);
        });
      } else {
        // Combo >= 5: "SLICK WEAVE!" Crisp single harmonic overtone
        const sOsc = ctx.createOscillator();
        const sGain = ctx.createGain();
        sOsc.type = 'sine';
        sOsc.frequency.setValueAtTime(baseFreq * 1.5, now + 0.02);
        sGain.gain.setValueAtTime(0.09 * stingScale, now + 0.02);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        sOsc.connect(sGain);
        sGain.connect(this.getOutputNode(ctx));
        sOsc.start(now + 0.02);
        sOsc.stop(now + 0.13);
      }
    }
  }

  // Rising dopamine coin pickup chime with escalating pitch streak
  public playCoinPickup(streak = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const safeStreak = Math.max(0, Math.min(24, streak));
    // Escalating pitch: each consecutive coin pitches up slightly for maximum satisfaction!
    const pitchMult = Math.pow(1.059463, safeStreak % 12) * (1 + Math.floor(safeStreak / 12) * 0.28);
    const scale = this.sfxScale;

    // Base dual-tone ping + high shimmer overtone on higher streaks
    const baseFreqs = safeStreak >= 3 ? [587.33, 880.0, 1174.66] : [587.33, 880.0];

    baseFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startFreq = freq * pitchMult;
      osc.frequency.setValueAtTime(startFreq, now + idx * 0.038);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 1.04, now + idx * 0.038 + 0.12);

      const noteVol = (idx === 2 ? 0.09 : 0.16) * scale;
      gain.gain.setValueAtTime(noteVol, now + idx * 0.038);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.038 + 0.16);

      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + idx * 0.038);
      osc.stop(now + idx * 0.038 + 0.17);
    });
  }

  // Turbo blow-off valve chirp & flutter on throttle lift / speed deceleration
  public playTurboChirp() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = this.sfxScale;

    // Stage 1: Compressed air whoosh / hiss burst
    const hissLen = Math.floor(ctx.sampleRate * 0.16);
    const hissBuf = ctx.createBuffer(1, hissLen, ctx.sampleRate);
    const hissData = hissBuf.getChannelData(0);
    for (let i = 0; i < hissLen; i++) {
      hissData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / hissLen, 1.8);
    }
    const hissNode = ctx.createBufferSource();
    hissNode.buffer = hissBuf;

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.setValueAtTime(2600, now);
    hissFilter.frequency.exponentialRampToValueAtTime(1100, now + 0.15);

    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0.16 * scale, now);
    hissGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    hissNode.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(this.getOutputNode(ctx));
    hissNode.start(now);

    // Stage 2: Iconic 3-pulse flutter chirps (su-tu-tu-tu)
    const flutterOffsets = [0, 0.042, 0.084];
    const flutterPitches = [2450, 2180, 1860];
    flutterOffsets.forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const f = flutterPitches[idx] * (0.96 + Math.random() * 0.08);
      osc.frequency.setValueAtTime(f, now + offset);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, now + offset + 0.055);

      const amp = (0.13 - idx * 0.025) * scale;
      gain.gain.setValueAtTime(amp, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + offset);
      osc.stop(now + offset + 0.065);
    });
  }

  // Nitro boost pad / Fever activation fanfare (AI Fever Drop + Synth Harmonic)
  public playFeverBurst() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const hasAi = this.playAiSfxClip('fever', 1.0, 1.0);
    const layer = (hasAi ? 0.5 : 1.0) * this.sfxScale;

    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      gain.gain.setValueAtTime(0.11 * layer, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.28);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.29);
    });
  }

  // Crisp dual-tone style switch chime (/ <-> \ mid-drift)
  public playStyleSwitch(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const mult = Math.pow(1.04, Math.min(16, combo));
    const hasAi = this.playAiSfxClip('drift_flip', mult, 0.72);
    const layer = (hasAi ? 0.55 : 1.0) * this.sfxScale;

    const now = ctx.currentTime;
    [440, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * mult, now + i * 0.035);
      gain.gain.setValueAtTime(0.14 * layer, now + i * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.035 + 0.14);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + i * 0.035);
      osc.stop(now + i * 0.035 + 0.15);
    });
  }

  // High-frequency tactile sector tick / boundary flipper sound for prize wheel & style flips
  public playStyleFlip() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.02);
    gain.gain.setValueAtTime(0.09 * this.sfxScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.035);
  }

  // Metallic guardrail scrape spark sound
  public playGuardrailSpark() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2800 + Math.random() * 900, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09 * this.sfxScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    noise.start(now);
  }

  // Sparkly ascending arpeggio when picking up a Nitro Star Gem
  public playStarPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.032);
      gain.gain.setValueAtTime(0.14 * this.sfxScale, now + i * 0.032);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.032 + 0.18);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + i * 0.032);
      osc.stop(now + i * 0.032 + 0.19);
    });
  }

  // Car falling off the 3D cliff + guardrail crunch + AI Crash Impact & valley boom
  public playFallAndDestroy() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const hasAi = this.playAiSfxClip('crash', 0.96, 1.0);
    const layer = (hasAi ? 0.65 : 1.0) * this.sfxScale;

    const now = ctx.currentTime;

    // Stage 1: Metallic guardrail crunch burst
    const crunchLen = Math.floor(ctx.sampleRate * 0.14);
    const crunchBuf = ctx.createBuffer(1, crunchLen, ctx.sampleRate);
    const crunchCh = crunchBuf.getChannelData(0);
    for (let i = 0; i < crunchLen; i++) {
      crunchCh[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crunchLen, 1.2);
    }
    const crunchNoise = ctx.createBufferSource();
    crunchNoise.buffer = crunchBuf;
    const crunchFilter = ctx.createBiquadFilter();
    crunchFilter.type = 'bandpass';
    crunchFilter.frequency.setValueAtTime(1600, now);
    crunchFilter.Q.setValueAtTime(1.5, now);
    const crunchGain = ctx.createGain();
    crunchGain.gain.setValueAtTime(0.24 * layer, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    crunchNoise.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    crunchGain.connect(this.getOutputNode(ctx));
    crunchNoise.start(now);

    // Stage 2: Falling whistle while tumbling off viaduct
    const fallOsc = ctx.createOscillator();
    const fallGain = ctx.createGain();
    fallOsc.type = 'sine';
    fallOsc.frequency.setValueAtTime(540, now);
    fallOsc.frequency.exponentialRampToValueAtTime(90, now + 0.42);
    fallGain.gain.setValueAtTime(0.18 * layer, now);
    fallGain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);
    fallOsc.connect(fallGain);
    fallGain.connect(this.getOutputNode(ctx));
    fallOsc.start(now);
    fallOsc.stop(now + 0.43);

    // Stage 3: Heavy explosion sub-bass & shatter noise at t + 0.40s (valley impact)
    const boomTime = now + 0.40;
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(145, boomTime);
    subOsc.frequency.exponentialRampToValueAtTime(26, boomTime + 0.62);
    subGain.gain.setValueAtTime(0.36 * layer, boomTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.64);
    subOsc.connect(subGain);
    subGain.connect(this.getOutputNode(ctx));
    subOsc.start(boomTime);
    subOsc.stop(boomTime + 0.65);

    const len = Math.floor(ctx.sampleRate * 0.56);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4);
    }
    const crashNoise = ctx.createBufferSource();
    crashNoise.buffer = buf;
    const crashGain = ctx.createGain();
    crashGain.gain.setValueAtTime(0.28 * layer, boomTime);
    crashGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.56);
    crashNoise.connect(crashGain);
    crashGain.connect(this.getOutputNode(ctx));
    crashNoise.start(boomTime);
  }

  // Crisp rising turbo-pass cue when overtaking traffic
  public playOvertake(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const mult = Math.pow(1.035, Math.min(12, combo));
    const hasAi = this.playAiSfxClip('overtake', mult, 0.85);
    const layer = (hasAi ? 0.5 : 1.0) * this.sfxScale;

    const now = ctx.currentTime;
    [392.0, 587.33].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * mult, now + idx * 0.04);
      gain.gain.setValueAtTime(0.13 * layer, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.14);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.15);
    });
  }

  // High-adrenaline Doppler whoosh + chime on close near-miss / oncoming dodge
  public playNearMiss(isOncoming: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const hasAi = this.playAiSfxClip('overtake', isOncoming ? 1.15 : 1.05, 0.9);
    const layer = (hasAi ? 0.65 : 1.0) * this.sfxScale;

    const now = ctx.currentTime;

    // Doppler air-whoosh noise sweep
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isOncoming ? 1800 : 1200, now);
    filter.frequency.exponentialRampToValueAtTime(340, now + 0.18);
    filter.Q.setValueAtTime(2.4, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.22 * layer, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.getOutputNode(ctx));
    noise.start(now);

    // Bright reward chime
    const notes = isOncoming ? [659.25, 987.77, 1318.5] : [587.33, 880.0];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.032);
      gain.gain.setValueAtTime(0.14 * layer, now + idx * 0.032);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.032 + 0.16);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + idx * 0.032);
      osc.stop(now + idx * 0.032 + 0.17);
    });
  }

  // Turbo slipstream burst when slingshotting past a drafted vehicle
  public playSlipstreamPass(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const mult = Math.pow(1.035, Math.min(12, combo));
    const hasAi = this.playAiSfxClip('fever', 1.08, 0.65);
    const layer = (hasAi ? 0.58 : 1.0) * this.sfxScale;

    const now = ctx.currentTime;
    [440, 659.25, 880, 1174.66].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * mult, now + idx * 0.028);
      gain.gain.setValueAtTime(0.09 * layer, now + idx * 0.028);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.028 + 0.18);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + idx * 0.028);
      osc.stop(now + idx * 0.028 + 0.19);
    });
  }

  // Euphoric gold chord chime on 250m distance milestones & rank-ups
  public playMilestone() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const hasAi = this.playAiSfxClip('milestone', 1.0, 1.0);
    const layer = (hasAi ? 0.5 : 1.0) * this.sfxScale;

    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.04);
      gain.gain.setValueAtTime(0.12 * layer, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.25);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.26);
    });
  }

  // Customizable Car Horn Synthesizer (supports 5 distinct arcade horn profiles)
  public playHorn(hornStyle?: HornStyleId | HornTypeId | string) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = this.sfxScale;
    const out = this.getOutputNode(ctx);

    const style = String(hornStyle || 'dual').toLowerCase();

    if (style === 'laser' || style === 'cyber_chirp') {
      // Synthesized pitch-drop laser chirp (880Hz down to 220Hz with fast resonant sweep)
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.16);

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(7.0, now); // Fast resonant sweep
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.16);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24 * scale, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc.start(now);
      osc.stop(now + 0.19);
    } else if (style === 'fanfare') {
      // Rapid 4-note ascending fanfare (C5, E5, G5, C6)
      const notes = [
        { f: 523.25, start: 0, dur: 0.08 },     // C5
        { f: 659.25, start: 0.08, dur: 0.08 },  // E5
        { f: 783.99, start: 0.16, dur: 0.08 },  // G5
        { f: 1046.50, start: 0.24, dur: 0.24 }, // C6
      ];
      notes.forEach(({ f, start, dur }) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + start);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now + start);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(0.18 * scale, now + start + 0.012);
        gain.gain.setValueAtTime(0.18 * scale, now + start + dur - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.01);
      });
    } else if (style === 'melody' || style === 'jdm_sport') {
      // Catchy 5-note retro chiptune riff
      const riff = [
        { f: 523.25, start: 0, dur: 0.07 },      // C5
        { f: 659.25, start: 0.07, dur: 0.07 },     // E5
        { f: 783.99, start: 0.14, dur: 0.07 },     // G5
        { f: 880.00, start: 0.21, dur: 0.07 },     // A5
        { f: 1046.50, start: 0.28, dur: 0.20 },    // C6
      ];
      riff.forEach(({ f, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(f, now + start);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(0.16 * scale, now + start + 0.008);
        gain.gain.setValueAtTime(0.16 * scale, now + start + dur - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(out);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.01);
      });
    } else if (
      style === 'train' ||
      style === 'train_bass' ||
      style === 'air_horn' ||
      style === 'truck_air_blast'
    ) {
      // Low dual-frequency chord (150Hz + 225Hz with sawtooth warmth)
      [150, 225].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(850, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.22 * scale, now + 0.025);
        gain.gain.setValueAtTime(0.22 * scale, now + 0.32);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);

        osc.start(now);
        osc.stop(now + 0.40);
      });
    } else {
      // Classic automotive dual horn (440Hz + 370Hz)
      [440, 370].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.17 * scale, now + 0.018);
        gain.gain.setValueAtTime(0.17 * scale, now + 0.20);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);

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
    [0, 0.11].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 0 ? 1120 : 1380, now + offset);
      osc.frequency.exponentialRampToValueAtTime(520, now + offset + 0.055);
      gain.gain.setValueAtTime(0.11 * this.sfxScale, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + offset);
      osc.stop(now + offset + 0.07);
    });
  }

  // Friendly blinker yield chime when ahead traffic pulls out of your lane
  public playTrafficYieldChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 987.77].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.048);
      gain.gain.setValueAtTime(0.10 * this.sfxScale, now + idx * 0.048);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.048 + 0.14);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + idx * 0.048);
      osc.stop(now + idx * 0.048 + 0.15);
    });
  }

  // Continuous throttled engine note tuned to equipped Exhaust/Sound Profile
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

    if (!this.engRunning || !this.engOscA || !this.engOscB || !this.engFilter || !this.engGain) {
      try {
        this.engOscA = ctx.createOscillator();
        this.engOscB = ctx.createOscillator();
        this.engFilter = ctx.createBiquadFilter();
        this.engGain = ctx.createGain();

        this.engFilter.type = 'lowpass';
        this.engFilter.Q.setValueAtTime(2.2, now);
        this.engGain.gain.setValueAtTime(0.001, now);

        this.engOscA.connect(this.engFilter);
        this.engOscB.connect(this.engFilter);
        this.engFilter.connect(this.engGain);
        this.engGain.connect(this.getOutputNode(ctx));

        this.engOscA.start(now);
        this.engOscB.start(now);
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
    let cutoff = 280 + r * 420;
    let oscTypeA: OscillatorType = 'sawtooth';
    let oscTypeB: OscillatorType = 'triangle';

    if (profile === 'jdm_turbo') {
      baseHz = 62 + r * 92;
      harmMult = 2.0;
      cutoff = 360 + r * 580;
    } else if (profile === 'v8_muscle') {
      baseHz = 42 + r * 54;
      harmMult = 1.5;
      cutoff = 240 + r * 340;
      oscTypeB = 'sawtooth';
    } else if (profile === 'f1_scream') {
      baseHz = 86 + r * 142;
      harmMult = 2.0;
      cutoff = 540 + r * 900;
    } else if (profile === 'rotary_braap') {
      baseHz = 68 + r * 102;
      harmMult = 1.333;
      cutoff = 420 + r * 660;
      oscTypeA = 'square';
    }

    if (params.isFever) {
      baseHz *= 1.15;
      cutoff *= 1.35;
    }

    const effectiveCutoff = cutoff + (params.isGassing ? 240 : 0);
    const baseVol = params.isGassing ? 0.046 : params.isBraking ? 0.02 : 0.03;
    const targetVol = baseVol * this.engineScale;

    if (this.engOscA.type !== oscTypeA) this.engOscA.type = oscTypeA;
    if (this.engOscB.type !== oscTypeB) this.engOscB.type = oscTypeB;

    if (Math.abs(baseHz - this.lastEngBaseHz) > 0.75) {
      this.lastEngBaseHz = baseHz;
      this.engOscA.frequency.setTargetAtTime(baseHz, now, 0.045);
      this.engOscB.frequency.setTargetAtTime(baseHz * harmMult, now, 0.045);
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
      tGain.connect(this.getOutputNode(ctx));
      tOsc.start(now);
      tOsc.stop(now + 0.17);
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
      this.engOscA?.disconnect();
      this.engOscB?.disconnect();
      this.engFilter?.disconnect();
      this.engGain?.disconnect();
    } catch {}
    this.engOscA = null;
    this.engOscB = null;
    this.engFilter = null;
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
