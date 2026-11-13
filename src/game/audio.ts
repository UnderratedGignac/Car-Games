import type { HornStyleId, SoundProfileId } from './rules';
import {
  AI_SFX_SLOT_MAP,
  AiSfxSlotId,
  MusicDspInput,
  MusicDspParams,
  computeMusicDspParams,
  findPeakAudioWindow,
} from './musicConfig';

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
  musicVolume: number; // 0 .. 1
  sfxVolume: number; // 0 .. 1
  activeTrackId: string;
  activeTrackTitle: string;
  loadedTrackIds: string[];
  loadedSfxIds: AiSfxSlotId[];
  dspModeLabel: string;
  dspLowpassHz: number;
  dspPlaybackRate: number;
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
class DriftAudioEngine {
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
  private musicVolume = 0.58;
  private sfxVolume = 0.82;

  private activeTrackId = '';
  private activeTrackTitle = '';
  private trackSources = new Map<string, { title: string; url: string; buffer: AudioBuffer | null; decoding: boolean }>();
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
    const loadedTrackIds: string[] = [];
    this.trackSources.forEach((_v, k) => loadedTrackIds.push(k));
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
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      activeTrackId: this.activeTrackId,
      activeTrackTitle: this.activeTrackTitle,
      loadedTrackIds,
      loadedSfxIds,
      dspModeLabel: this.dspModeLabel,
      dspLowpassHz: this.lastDspParams.lowpassHz,
      dspPlaybackRate: this.lastDspParams.playbackRate,
    };
  }

  private ensureContext(ignoreMute = false): AudioContext | null {
    if ((!ignoreMute && this.muted) || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.masterComp) {
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
    return Math.max(0, Math.min(1, this.musicVolume * dspMultiplier * 0.72));
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
   * or start whichever AI music track is active, plus hydrate pending AI SFX.
   */
  public async unlockAndEnsureMusic(preferredTrackId?: string): Promise<void> {
    const ctx = this.ensureContext(true);
    if (!ctx) return;

    // Hydrate any registered AI SFX buffers lazily in background
    this.aiSfxEntries.forEach((entry, slotId) => {
      if (!entry.buffer && !entry.decoding && entry.url) {
        this.decodeSfxSlot(ctx, slotId, entry.url).catch(() => {});
      }
    });

    if (!this.musicEnabled || this.muted) return;

    const targetId =
      preferredTrackId && this.trackSources.has(preferredTrackId)
        ? preferredTrackId
        : this.activeTrackId;

    if (!targetId) return;
    const track = this.trackSources.get(targetId);
    if (!track) return;

    if (this.musicPlaying && this.activeTrackId === targetId) return;
    await this.loadAiMusicTrack(targetId, track.title, track.url, true);
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

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.musicGainNode) {
      const mult = this.dspEnabled ? this.lastDspParams.gainMultiplier : 1.0;
      this.musicGainNode.gain.setTargetAtTime(
        this.computeEffectiveMusicGain(mult),
        this.ctx.currentTime,
        0.05
      );
    }
    this.notifyListeners();
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.notifyListeners();
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
    const vol = Math.max(0.05, Math.min(1.0, (spec?.baseGain ?? 0.55) * this.sfxVolume * gainScale));

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
    return Math.max(0, Math.min(1.25, this.sfxVolume));
  }

  // Light pitch-varied tire screech + turbo flutter on diagonal direction flip (/ <-> \)
  public playDriftFlip(combo: number, isFever: boolean) {
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
  }

  // Rising dopamine coin pickup chime
  public playCoinPickup(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const mult = Math.pow(1.05, Math.min(14, combo));
    const scale = this.sfxScale;

    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * mult, now + idx * 0.045);
      gain.gain.setValueAtTime(0.16 * scale, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.16);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.17);
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

  // Customizable Car Horn Synthesizer (supports 5 distinct horn profiles)
  public playHorn(hornStyle: HornStyleId = 'stock') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = this.sfxScale;

    const triggerChord = (freqs: number[], type: OscillatorType, start: number, dur: number, vol = 0.14) => {
      freqs.forEach((f) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f, start);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(hornStyle === 'train_bass' ? 900 : 2400, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(vol * scale, start + 0.018);
        gain.gain.setValueAtTime(vol * scale, start + dur - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.getOutputNode(ctx));
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    };

    if (hornStyle === 'jdm_sport') {
      triggerChord([415.3, 523.25], 'sawtooth', now, 0.10, 0.12);
      triggerChord([415.3, 523.25], 'sawtooth', now + 0.13, 0.17, 0.13);
    } else if (hornStyle === 'air_horn') {
      triggerChord([311.13, 392.0, 466.16], 'sawtooth', now, 0.34, 0.11);
    } else if (hornStyle === 'train_bass') {
      triggerChord([138.59, 174.61, 207.65], 'sawtooth', now, 0.42, 0.13);
    } else if (hornStyle === 'cyber_chirp') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.09);
      osc.frequency.setValueAtTime(980, now + 0.11);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.20);
      gain.gain.setValueAtTime(0.16 * scale, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      osc.start(now);
      osc.stop(now + 0.23);
    } else {
      triggerChord([349.23, 440.0], 'sawtooth', now, 0.24, 0.11);
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
    const targetVol = baseVol * this.sfxScale;

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
      tGain.gain.setValueAtTime(0.02 * this.sfxScale, now);
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

export const soundFX = new DriftAudioEngine();
