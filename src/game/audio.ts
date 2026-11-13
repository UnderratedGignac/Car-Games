import type { HornStyleId, SoundProfileId } from './rules';

// Procedural Web Audio API Synthesizer for High-Dopamine Drift Feedback
class DriftAudioEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

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

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (mute) {
      this.stopEngineSound();
    }
  }

  // Light pitch-varied tire screech + turbo flutter on diagonal direction flip (/ <-> \)
  public playDriftFlip(combo: number, isFever: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pitchVariance = 0.94 + Math.random() * 0.12;
    const comboSemitone = Math.pow(1.045, Math.min(16, combo));

    // Turbo blow-off / synth chord stab
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isFever ? 'sawtooth' : 'triangle';
    const baseFreq = (isFever ? 330 : 240) * pitchVariance * comboSemitone;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.09);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
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
    nGain.gain.setValueAtTime(0.08, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  // Rising dopamine coin pickup chime
  public playCoinPickup(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const mult = Math.pow(1.05, Math.min(14, combo));

    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * mult, now + idx * 0.045);
      gain.gain.setValueAtTime(0.16, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.17);
    });
  }

  // Nitro boost pad / Fever activation fanfare
  public playFeverBurst() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      gain.gain.setValueAtTime(0.11, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.29);
    });
  }

  // Crisp dual-tone style switch chime (/ <-> \ mid-drift)
  public playStyleSwitch(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const mult = Math.pow(1.04, Math.min(16, combo));
    [440, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * mult, now + i * 0.035);
      gain.gain.setValueAtTime(0.14, now + i * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.035 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
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
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
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
      gain.gain.setValueAtTime(0.14, now + i * 0.032);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.032 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.032);
      osc.stop(now + i * 0.032 + 0.19);
    });
  }

  // Car falling off the 3D cliff + guardrail crunch + explosive valley impact
  public playFallAndDestroy() {
    const ctx = this.ensureContext();
    if (!ctx) return;
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
    crunchGain.gain.setValueAtTime(0.24, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    crunchNoise.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    crunchGain.connect(ctx.destination);
    crunchNoise.start(now);

    // Stage 2: Falling whistle while tumbling off viaduct
    const fallOsc = ctx.createOscillator();
    const fallGain = ctx.createGain();
    fallOsc.type = 'sine';
    fallOsc.frequency.setValueAtTime(540, now);
    fallOsc.frequency.exponentialRampToValueAtTime(90, now + 0.42);
    fallGain.gain.setValueAtTime(0.18, now);
    fallGain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);
    fallOsc.connect(fallGain);
    fallGain.connect(ctx.destination);
    fallOsc.start(now);
    fallOsc.stop(now + 0.43);

    // Stage 3: Heavy explosion sub-bass & shatter noise at t + 0.40s (valley impact)
    const boomTime = now + 0.40;
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(145, boomTime);
    subOsc.frequency.exponentialRampToValueAtTime(26, boomTime + 0.62);
    subGain.gain.setValueAtTime(0.36, boomTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.64);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
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
    crashGain.gain.setValueAtTime(0.28, boomTime);
    crashGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.56);
    crashNoise.connect(crashGain);
    crashGain.connect(ctx.destination);
    crashNoise.start(boomTime);
  }

  // Crisp rising turbo-pass cue when overtaking traffic
  public playOvertake(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const mult = Math.pow(1.045, Math.min(14, combo));
    [392.0, 587.33].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * mult, now + idx * 0.04);
      gain.gain.setValueAtTime(0.13, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.15);
    });
  }

  // High-adrenaline Doppler whoosh + chime on close near-miss / oncoming dodge
  public playNearMiss(isOncoming: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
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
    nGain.gain.setValueAtTime(0.22, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);

    // Bright reward chime
    const notes = isOncoming ? [659.25, 987.77, 1318.5] : [587.33, 880.0];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.032);
      gain.gain.setValueAtTime(0.14, now + idx * 0.032);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.032 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.032);
      osc.stop(now + idx * 0.032 + 0.17);
    });
  }

  // Turbo slipstream burst when slingshotting past a drafted vehicle
  public playSlipstreamPass(combo: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const mult = Math.pow(1.035, Math.min(12, combo));
    [440, 659.25, 880, 1174.66].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * mult, now + idx * 0.028);
      gain.gain.setValueAtTime(0.09, now + idx * 0.028);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.028 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.028);
      osc.stop(now + idx * 0.028 + 0.19);
    });
  }

  // Euphoric gold chord chime on 250m distance milestones & rank-ups
  public playMilestone() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.04);
      gain.gain.setValueAtTime(0.12, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.26);
    });
  }

  // Customizable Car Horn Synthesizer (supports 5 distinct horn profiles)
  public playHorn(hornStyle: HornStyleId = 'stock') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

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
        gain.gain.linearRampToValueAtTime(vol, start + 0.018);
        gain.gain.setValueAtTime(vol, start + dur - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
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
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
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
      gain.gain.setValueAtTime(0.11, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
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
      gain.gain.setValueAtTime(0.10, now + idx * 0.048);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.048 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
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
        this.engGain.connect(ctx.destination);

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
    const targetVol = params.isGassing
      ? 0.048
      : params.isBraking
      ? 0.022
      : 0.032;

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
      tGain.gain.setValueAtTime(0.02, now);
      tGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.16);
      tOsc.connect(tGain);
      tGain.connect(ctx.destination);
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
