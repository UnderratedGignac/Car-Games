/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TrackSynthSpec {
  id?: string;
  bpm: number;
  mood?: 'high_energy' | 'drift' | 'chill' | 'intense';
  genre?: string;
}

/**
 * PolyBLEP anti-aliasing correction for sawtooth and pulse oscillators.
 * Removes harsh digital Nyquist buzz so leads and basses sound analog and warm.
 */
function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

function aaSaw(phase: number, dt: number): number {
  let y = 2 * phase - 1;
  y -= polyBlep(phase, dt);
  return y;
}

function aaPulse(phase: number, dt: number, duty = 0.5): number {
  let y = phase < duty ? 1 : -1;
  y += polyBlep(phase, dt);
  const shifted = (phase + (1 - duty)) % 1;
  y -= polyBlep(shifted, dt);
  return y;
}

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getSwingOffsetSec(step16: number, sixteenthSec: number, swingAmount: number): number {
  // Delay odd 16th notes slightly for organic human pocket & groove
  return step16 % 2 === 1 ? sixteenthSec * swingAmount : 0;
}

/**
 * Wraps audio writes seamlessly around loop boundaries so reverb/release tails never click.
 */
function addWrapped(buf: Float32Array, index: number, value: number, len: number): void {
  const idx = ((index % len) + len) % len;
  buf[idx] += value;
}

/**
 * Procedural In-Memory Soundtrack Generator for Neon Redline.
 * Synthesizes warm, musical 16-bar stereo soundtracks with:
 * - PolyBLEP anti-aliased analog oscillators & phase-accumulated vibrato/pitch glide
 * - Resonant 2-pole State-Variable lowpass filters per voice
 * - Expressive human pocket swing, velocity dynamics, and multi-bar chord progressions
 * - Circular wrap-around stereo ping-pong delay & lush room reverb
 */
export function generateBuiltinArcadeTrack(
  ctx: AudioContext,
  trackSpec?: number | string | TrackSynthSpec
): AudioBuffer {
  const sampleRate = ctx.sampleRate;

  let bpm = 138;
  let mood: 'high_energy' | 'drift' | 'chill' | 'intense' = 'high_energy';
  let trackId = 'eurobeat';

  if (typeof trackSpec === 'number') {
    bpm = trackSpec;
  } else if (typeof trackSpec === 'string') {
    trackId = trackSpec;
    if (trackId === 'eurobeat') {
      bpm = 160;
      mood = 'high_energy';
    } else if (trackId === 'synthwave') {
      bpm = 128;
      mood = 'intense';
    } else if (trackId === 'phonk') {
      bpm = 142;
      mood = 'drift';
    } else if (trackId === 'lofi') {
      bpm = 88;
      mood = 'chill';
    }
  } else if (trackSpec && typeof trackSpec === 'object') {
    bpm = trackSpec.bpm || 138;
    mood = trackSpec.mood || 'high_energy';
    trackId = trackSpec.id || 'custom';
  }

  const beatSec = 60 / bpm;
  const sixteenthSec = beatSec / 4;
  const totalBeats = 64; // 16 bars * 4 beats
  const totalSixteenths = totalBeats * 4;
  const totalDurationSec = totalBeats * beatSec;
  const totalSamples = Math.max(1, Math.floor(totalDurationSec * sampleRate));

  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const dryL = buffer.getChannelData(0);
  const dryR = buffer.getChannelData(1);

  // Stereo bus for melodic elements & snare ambiance routed into circular delay + reverb
  const wetBusL = new Float32Array(totalSamples);
  const wetBusR = new Float32Array(totalSamples);

  const rand = createRng(
    mood === 'chill' ? 4049 : mood === 'drift' ? 8087 : mood === 'intense' ? 1984 : 2001
  );

  // Pre-build short bandlimited noise table for warm percussive transients
  const noiseTableLen = 8192;
  const noiseTable = new Float32Array(noiseTableLen);
  let lpNoise = 0;
  for (let i = 0; i < noiseTableLen; i++) {
    const white = rand() * 2 - 1;
    lpNoise = lpNoise * 0.35 + white * 0.65;
    noiseTable[i] = lpNoise;
  }

  const swingAmount =
    mood === 'chill' ? 0.24 : mood === 'drift' ? 0.14 : mood === 'intense' ? 0.06 : 0.04;

  // ---------------------------------------------------------------------------
  // 1. EXPRESSIVE DRUMS & PERCUSSION WITH HUMAN POCKET & LAYERED BODY
  // ---------------------------------------------------------------------------
  for (let beat = 0; beat < totalBeats; beat++) {
    const beatStart = Math.floor(beat * beatSec * sampleRate);
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    const isTurnaroundBar = bar % 4 === 3;

    if (mood === 'chill') {
      // Warm boom-bap Lo-Fi kick on 1 and syncopated 3
      const kickOffsets =
        beatInBar === 0
          ? [0]
          : beatInBar === 2
          ? [0, Math.floor(sixteenthSec * 2.15 * sampleRate)]
          : [];

      for (let k = 0; k < kickOffsets.length; k++) {
        const start = beatStart + kickOffsets[k];
        const vel = k === 0 ? 0.36 : 0.22;
        const kickLen = Math.floor(0.24 * sampleRate);
        let phase = 0;
        for (let i = 0; i < kickLen; i++) {
          const t = i / sampleRate;
          const freq = 92 * Math.exp(-t * 28) + 41;
          phase += freq / sampleRate;
          const click = Math.exp(-t * 140) * 0.18;
          const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 10.5);
          const s = (body + click) * vel;
          addWrapped(dryL, start + i, s, totalSamples);
          addWrapped(dryR, start + i, s, totalSamples);
        }
      }

      // Warm wood/rim snare on 2 and 4 (+ soft ghost snare on turnaround)
      if (beatInBar === 1 || beatInBar === 3) {
        const start = beatStart + Math.floor(0.012 * sampleRate); // Laid-back pocket
        const snareLen = Math.floor(0.16 * sampleRate);
        let lp = 0;
        let phase = 0;
        for (let i = 0; i < snareLen; i++) {
          const t = i / sampleRate;
          const n = noiseTable[(i * 3) % noiseTableLen];
          lp = lp * 0.72 + n * 0.28;
          phase += (245 * Math.exp(-t * 14) + 175) / sampleRate;
          const tone = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 24);
          const s = (lp * Math.exp(-t * 22) * 0.55 + tone * 0.45) * 0.2;
          addWrapped(dryL, start + i, s * 0.94, totalSamples);
          addWrapped(dryR, start + i, s * 1.06, totalSamples);
          addWrapped(wetBusL, start + i, s * 0.35, totalSamples);
          addWrapped(wetBusR, start + i, s * 0.35, totalSamples);
        }
      }

      // Brushed swung 8th hi-hats with human velocity contour
      for (let sub = 0; sub < 2; sub++) {
        const swing = sub === 1 ? sixteenthSec * 0.42 : 0;
        const start = beatStart + Math.floor((sub * beatSec * 0.5 + swing) * sampleRate);
        const vel = sub === 0 ? 0.042 : 0.028;
        const hatLen = Math.floor(0.055 * sampleRate);
        let prevN = 0;
        for (let i = 0; i < hatLen; i++) {
          const t = i / sampleRate;
          const rawN = rand() * 2 - 1;
          const hp = rawN - prevN * 0.85; // High-pass brush air
          prevN = rawN;
          const s = hp * Math.exp(-t * 62) * vel;
          addWrapped(dryL, start + i, s * 0.85, totalSamples);
          addWrapped(dryR, start + i, s * 1.15, totalSamples);
        }
      }
    } else {
      // DRIVING PUNCHY KICK (4-on-floor for Eurobeat/Synthwave, syncopated 808 for Phonk)
      const hasKick =
        mood === 'drift'
          ? beatInBar === 0 || beatInBar === 2
          : true;

      if (hasKick) {
        const kickLen = Math.floor((mood === 'drift' ? 0.3 : 0.24) * sampleRate);
        let phase = 0;
        for (let i = 0; i < kickLen; i++) {
          const t = i / sampleRate;
          const pitchSweep = mood === 'drift' ? 145 : 138;
          const baseHz = mood === 'drift' ? 40 : 46;
          const freq = pitchSweep * Math.exp(-t * 36) + baseHz;
          phase += freq / sampleRate;
          const sub = Math.sin(2 * Math.PI * phase) * Math.exp(-t * (mood === 'drift' ? 9.5 : 12.5));
          const transient = Math.exp(-t * 165) * 0.25;
          const raw = (sub + transient) * (mood === 'drift' ? 0.52 : 0.42);
          const s = Math.tanh(raw * 1.15);
          addWrapped(dryL, beatStart + i, s, totalSamples);
          addWrapped(dryR, beatStart + i, s, totalSamples);
        }
      }

      // Extra Phonk bounce kick on off-beat 16th in bar
      if (mood === 'drift' && beatInBar === 3) {
        const start = beatStart + Math.floor(sixteenthSec * 2 * sampleRate);
        const kickLen = Math.floor(0.2 * sampleRate);
        let phase = 0;
        for (let i = 0; i < kickLen; i++) {
          const t = i / sampleRate;
          phase += (120 * Math.exp(-t * 34) + 42) / sampleRate;
          const s = Math.tanh(Math.sin(2 * Math.PI * phase) * Math.exp(-t * 14) * 0.42);
          addWrapped(dryL, start + i, s, totalSamples);
          addWrapped(dryR, start + i, s, totalSamples);
        }
      }

      // Layered Crisp Snare + Clap on beats 2 & 4 (+ turnaround fills)
      const hitSnare = beatInBar === 1 || beatInBar === 3;
      if (hitSnare) {
        const snareLen = Math.floor((mood === 'intense' ? 0.26 : 0.19) * sampleRate);
        let phase = 0;
        let lp = 0;
        for (let i = 0; i < snareLen; i++) {
          const t = i / sampleRate;
          phase += (210 * Math.exp(-t * 28) + 165) / sampleRate;
          const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 24);
          const n = rand() * 2 - 1;
          lp = lp * 0.5 + n * 0.5;
          // Double clap micro-burst
          const clapGate =
            t < 0.018
              ? Math.sin((t / 0.009) * Math.PI * 0.5)
              : Math.exp(-(t - 0.018) * (mood === 'intense' ? 14 : 21));
          const val = (body * 0.36 + lp * clapGate * 0.64) * 0.28;
          addWrapped(dryL, beatStart + i, val * 0.96, totalSamples);
          addWrapped(dryR, beatStart + i, val * 1.04, totalSamples);
          // Send snare tail to stereo room reverb bus
          addWrapped(wetBusL, beatStart + i, val * (mood === 'intense' ? 0.65 : 0.38), totalSamples);
          addWrapped(wetBusR, beatStart + i, val * (mood === 'intense' ? 0.65 : 0.38), totalSamples);
        }
      }

      // Snare fill on beat 4 of every 4th bar
      if (isTurnaroundBar && beatInBar === 3) {
        for (const sub of [2, 3]) {
          const fStart = beatStart + Math.floor(sub * sixteenthSec * sampleRate);
          const fLen = Math.floor(0.11 * sampleRate);
          let fPhase = 0;
          for (let i = 0; i < fLen; i++) {
            const t = i / sampleRate;
            fPhase += (260 - sub * 25) / sampleRate;
            const s = (Math.sin(2 * Math.PI * fPhase) * 0.4 + noiseTable[i % noiseTableLen] * 0.6) * Math.exp(-t * 28) * 0.2;
            addWrapped(dryL, fStart + i, s, totalSamples);
            addWrapped(dryR, fStart + i, s, totalSamples);
          }
        }
      }

      // Crisp 16th hi-hats with swung pocket & open-hat accents on off-beats
      for (let step = 0; step < 4; step++) {
        const swing = getSwingOffsetSec(step, sixteenthSec, swingAmount);
        const start = beatStart + Math.floor((step * sixteenthSec + swing) * sampleRate);
        const isOffbeatOpen = step === 2;
        const hatLen = Math.floor((isOffbeatOpen ? 0.085 : 0.036) * sampleRate);
        const vel = isOffbeatOpen ? 0.11 : step === 0 ? 0.055 : 0.042;
        let prevN = 0;
        let prevN2 = 0;
        for (let i = 0; i < hatLen; i++) {
          const t = i / sampleRate;
          const n = rand() * 2 - 1;
          // 2nd-order high-pass shimmer so hats don't sound like harsh white noise
          const hp = n - 1.4 * prevN + 0.55 * prevN2;
          prevN2 = prevN;
          prevN = n;
          const decay = isOffbeatOpen ? 26 : 68;
          const s = hp * Math.exp(-t * decay) * vel * 0.65;
          const pan = step % 2 === 0 ? 0.88 : 1.12;
          addWrapped(dryL, start + i, s * pan, totalSamples);
          addWrapped(dryR, start + i, s * (2 - pan), totalSamples);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. ANALOG FILTERED BASSLINES (4-BAR PROGRESSION + TURNAROUND VARIATION)
  // ---------------------------------------------------------------------------
  // Am -> F -> C -> G (bars 0..11) and Am -> F -> Dm -> E (bars 12..15 turnaround!)
  const bassProgressionA = [55.0, 43.65, 65.41, 49.0];
  const bassProgressionB = [55.0, 43.65, 73.42, 41.20];

  const getChordRootForBar = (bar: number): number => {
    const groupIdx = Math.floor(bar / 4) % 4;
    const prog = bar >= 12 ? bassProgressionB : bassProgressionA;
    return prog[groupIdx];
  };

  if (mood === 'chill') {
    // Deep, warm Rhodes-companion bass on quarter & dotted rhythms
    for (let beat = 0; beat < totalBeats; beat++) {
      const bar = Math.floor(beat / 4);
      const beatInBar = beat % 4;
      if (beatInBar === 1) continue; // Breathing space
      const root = getChordRootForBar(bar);
      const freq = beatInBar === 3 ? root * 1.5 : root; // Walk to 5th on beat 4
      const start = Math.floor(beat * beatSec * sampleRate);
      const dur = Math.floor(beatSec * (beatInBar === 0 ? 1.65 : 0.88) * sampleRate);
      let phase = 0;
      for (let i = 0; i < dur; i++) {
        const t = i / sampleRate;
        phase += freq / sampleRate;
        const env = Math.min(1, t / 0.025) * Math.exp(-t * 2.1);
        const fundamental = Math.sin(2 * Math.PI * phase);
        const warmHarm = Math.sin(4 * Math.PI * phase) * 0.16 * Math.exp(-t * 3.5);
        const s = (fundamental + warmHarm) * env * 0.34;
        addWrapped(dryL, start + i, s, totalSamples);
        addWrapped(dryR, start + i, s, totalSamples);
      }
    }
  } else if (mood === 'drift') {
    // Saturated 808 glide bass locking with kick pattern
    for (let beat = 0; beat < totalBeats; beat += 2) {
      const bar = Math.floor(beat / 4);
      const root = getChordRootForBar(bar);
      const start = Math.floor(beat * beatSec * sampleRate);
      const dur = Math.floor(beatSec * 1.75 * sampleRate);
      let phase = 0;
      for (let i = 0; i < dur; i++) {
        const t = i / sampleRate;
        const glide = 1 + Math.exp(-t * 14) * 0.25;
        phase += (root * glide) / sampleRate;
        const env = Math.min(1, t / 0.012) * Math.exp(-t * 1.65);
        const s = Math.tanh((Math.sin(2 * Math.PI * phase) + Math.sin(4 * Math.PI * phase) * 0.18) * 1.65) * env * 0.36;
        addWrapped(dryL, start + i, s, totalSamples);
        addWrapped(dryR, start + i, s, totalSamples);
      }
    }
  } else {
    // EUROBEAT & SYNTHWAVE: Anti-aliased PolyBLEP octave bass passed through resonant lowpass envelope!
    for (let s = 0; s < totalSixteenths; s++) {
      const bar = Math.floor(s / 16);
      const stepInBar = s % 16;
      const root = getChordRootForBar(bar);
      // Groove octave & fifth turnaround
      const isOctave = s % 2 === 1;
      const freq =
        bar % 4 === 3 && stepInBar >= 14
          ? root * 1.5
          : isOctave
          ? root * 2
          : root;

      const swing = getSwingOffsetSec(s, sixteenthSec, swingAmount);
      const start = Math.floor((s * sixteenthSec + swing) * sampleRate);
      const dur = Math.floor(sixteenthSec * 0.85 * sampleRate);

      let phase = 0;
      let lp1 = 0;
      let lp2 = 0;
      const dtNorm = freq / sampleRate;

      for (let i = 0; i < dur; i++) {
        const t = i / sampleRate;
        phase = (phase + dtNorm) % 1;
        const rawSaw = aaSaw(phase, dtNorm);
        const subSine = Math.sin(2 * Math.PI * phase) * 0.45;

        // Plucky analog filter envelope: opens to ~1100Hz on attack, settles cleanly to ~210Hz
        const filtEnv = Math.exp(-t * 22);
        const cutoffHz = 210 + filtEnv * (mood === 'high_energy' ? 1250 : 920);
        const alpha = Math.min(0.85, (2 * Math.PI * cutoffHz) / (2 * Math.PI * cutoffHz + sampleRate));
        lp1 += alpha * (rawSaw - lp1);
        lp2 += alpha * (lp1 - lp2);

        const ampEnv = Math.min(1, t / 0.006) * Math.exp(-t * (mood === 'high_energy' ? 11 : 13));
        const val = (lp2 * 0.72 + subSine * 0.35) * ampEnv * 0.29;
        addWrapped(dryL, start + i, val, totalSamples);
        addWrapped(dryR, start + i, val, totalSamples);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. WARM CHORD PADS & ELECTRIC KEYS ACROSS ALL 16 BARS (NO EMPTY INTRO BARS!)
  // ---------------------------------------------------------------------------
  const chordVoicingsA = [
    [220.0, 261.63, 329.63, 392.0, 493.88], // Am9
    [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
    [261.63, 329.63, 392.0, 493.88, 587.33], // Cmaj9
    [196.0, 246.94, 293.66, 329.63, 440.0], // G6/9
  ];
  const chordVoicingsB = [
    [220.0, 261.63, 329.63, 392.0, 493.88], // Am9
    [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
    [220.0, 261.63, 293.66, 349.23, 440.0], // Dm9
    [164.81, 246.94, 311.13, 392.0, 493.88], // Em/E7sus glow
  ];

  const getChordForBar = (bar: number): number[] => {
    const groupIdx = Math.floor(bar / 4) % 4;
    return bar >= 12 ? chordVoicingsB[groupIdx] : chordVoicingsA[groupIdx];
  };

  for (let bar = 0; bar < 16; bar++) {
    const notes = getChordForBar(bar);
    const barStart = Math.floor(bar * 4 * beatSec * sampleRate);

    if (mood === 'chill') {
      // Warm Fender Rhodes chords with bell-tine transient & stereo tremolo
      const dur = Math.floor(beatSec * 3.85 * sampleRate);
      notes.forEach((freq, idx) => {
        const voiceOffset = Math.floor(idx * 0.014 * sampleRate); // Gentle guitar/piano strum
        const pan = 0.72 + (idx / (notes.length - 1)) * 0.56;
        let phase = 0;
        let chimePhase = 0;
        for (let i = 0; i < dur; i++) {
          const t = i / sampleRate;
          const vib = 1 + Math.sin(2 * Math.PI * 3.8 * t + idx) * 0.0014;
          phase += (freq * vib) / sampleRate;
          chimePhase += (freq * 3) / sampleRate;
          const attack = Math.min(1, t / 0.018);
          const env = attack * Math.exp(-t * 0.85);
          const body = Math.sin(2 * Math.PI * phase) + Math.sin(4 * Math.PI * phase) * 0.18;
          const tine = Math.sin(2 * Math.PI * chimePhase) * Math.exp(-t * 14) * 0.22;
          const trem = 0.88 + 0.12 * Math.sin(2 * Math.PI * 3.2 * t);
          const v = (body * 0.78 + tine) * env * trem * 0.068;
          addWrapped(wetBusL, barStart + voiceOffset + i, v * (2 - pan), totalSamples);
          addWrapped(wetBusR, barStart + voiceOffset + i, v * pan, totalSamples);
        }
      });
    } else {
      // Warm Stereo Lowpass Analog Chorus Pad across all 16 bars
      const dur = Math.floor(beatSec * 3.95 * sampleRate);
      notes.slice(0, 4).forEach((freq, idx) => {
        const pan = idx % 2 === 0 ? 0.76 : 1.24;
        const padGain = mood === 'drift' ? 0.036 : 0.048;
        let pA = rand();
        let pB = rand();
        let lp = 0;
        const dtA = (freq * 1.0035) / sampleRate;
        const dtB = (freq * 0.9965) / sampleRate;
        for (let i = 0; i < dur; i++) {
          const t = i / sampleRate;
          pA = (pA + dtA) % 1;
          pB = (pB + dtB) % 1;
          const osc = (aaSaw(pA, dtA) + aaSaw(pB, dtB)) * 0.5;
          // Slow breathing filter sweep
          const cutoff = (mood === 'drift' ? 680 : 1050) + Math.sin(Math.PI * (i / dur)) * 580;
          const alpha = Math.min(0.65, (2 * Math.PI * cutoff) / (2 * Math.PI * cutoff + sampleRate));
          lp += alpha * (osc - lp);

          const fadeIn = Math.min(1, t / (beatSec * 0.65));
          const fadeOut = Math.min(1, (dur - i) / (sampleRate * 0.25));
          const val = lp * fadeIn * fadeOut * padGain;
          addWrapped(wetBusL, barStart + i, val * pan, totalSamples);
          addWrapped(wetBusR, barStart + i, val * (2 - pan), totalSamples);
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. EXPRESSIVE MELODY, ARPEGGIOS & GENRE SIGNATURES
  // ---------------------------------------------------------------------------
  const renderWarmLeadNote = (
    startBeat: number,
    durBeats: number,
    freq: number,
    gain: number,
    panLR: number,
    detuneCents: number,
    brightnessHz: number
  ) => {
    const startSample = Math.floor(startBeat * beatSec * sampleRate);
    const durSamples = Math.floor(durBeats * beatSec * sampleRate);
    let p1 = 0;
    let p2 = 0;
    let lp1 = 0;
    let lp2 = 0;
    const det = 1 + detuneCents;
    const invDet = 1 - detuneCents;

    for (let i = 0; i < durSamples; i++) {
      const t = i / sampleRate;
      // Expressive subtle pitch scoop at note onset + natural vibrato after 110ms
      const scoop = 1 - Math.exp(-t * 65) * 0.025;
      const vibDepth = Math.min(1, Math.max(0, (t - 0.11) / 0.14)) * 0.0048;
      const vib = 1 + Math.sin(2 * Math.PI * 5.4 * t) * vibDepth;
      const instFreq = freq * scoop * vib;

      const dt1 = (instFreq * det) / sampleRate;
      const dt2 = (instFreq * invDet) / sampleRate;
      p1 = (p1 + dt1) % 1;
      p2 = (p2 + dt2) / 1 % 1;

      const wave = aaSaw(p1, dt1) * 0.55 + aaSaw(p2, dt2) * 0.45;
      const cutoff = 420 + brightnessHz * (0.35 + 0.65 * Math.exp(-t * 5.2));
      const alpha = Math.min(0.85, (2 * Math.PI * cutoff) / (2 * Math.PI * cutoff + sampleRate));
      lp1 += alpha * (wave - lp1);
      lp2 += alpha * (lp1 - lp2);

      const env =
        Math.min(1, t / 0.014) *
        Math.min(1, (durSamples - i) / (sampleRate * 0.045)) *
        (0.65 + 0.35 * Math.exp(-t * 2.2));
      const s = lp2 * env * gain;
      addWrapped(wetBusL, startSample + i, s * (1 - panLR * 0.35), totalSamples);
      addWrapped(wetBusR, startSample + i, s * (1 + panLR * 0.35), totalSamples);
    }
  };

  if (mood === 'drift') {
    // PHONK: Warm Bandpass-Filtered 808 Cowbell (no harsh raw buzzing square wave!)
    const cowbellNotes = [587.33, 698.46, 783.99, 880.0, 1046.5];
    const phonkRiff = [
      { step: 0, n: 3 }, { step: 3, n: 3 }, { step: 6, n: 2 }, { step: 8, n: 4 },
      { step: 11, n: 3 }, { step: 14, n: 1 }, { step: 16, n: 3 }, { step: 19, n: 3 },
      { step: 22, n: 2 }, { step: 24, n: 4 }, { step: 27, n: 3 }, { step: 30, n: 0 },
    ];

    for (let bar = 0; bar < 16; bar += 2) {
      const barStartStep = bar * 16;
      const isSecondHalf = bar >= 8;
      phonkRiff.forEach((item, idx) => {
        const s = barStartStep + item.step;
        if (s >= totalSixteenths) return;
        const swing = getSwingOffsetSec(s, sixteenthSec, swingAmount);
        const startSample = Math.floor((s * sixteenthSec + swing) * sampleRate);
        const durSamples = Math.floor(sixteenthSec * 1.45 * sampleRate);
        const freq = cowbellNotes[item.n] * (isSecondHalf && idx % 4 === 3 ? 1.5 : 1);

        let p1 = 0;
        let p2 = 0;
        let lp = 0;
        let hp = 0;
        let prevLp = 0;
        const dt1 = freq / sampleRate;
        const dt2 = (freq * 1.486) / sampleRate;

        for (let i = 0; i < durSamples; i++) {
          const t = i / sampleRate;
          p1 = (p1 + dt1) % 1;
          p2 = (p2 + dt2) % 1;
          const raw = aaPulse(p1, dt1, 0.5) * 0.58 + aaPulse(p2, dt2, 0.5) * 0.42;

          // Band-shape between 380Hz and 2900Hz for authentic warm TR-808 cowbell resonance
          lp += 0.34 * (raw - lp);
          hp = 0.94 * (hp + lp - prevLp);
          prevLp = lp;

          const env = Math.min(1, t / 0.003) * Math.exp(-t * 14.5);
          const sVal = Math.tanh(hp * 1.35) * env * 0.14;
          const pan = idx % 2 === 0 ? 0.92 : 1.08;
          addWrapped(wetBusL, startSample + i, sVal * pan, totalSamples);
          addWrapped(wetBusR, startSample + i, sVal * (2 - pan), totalSamples);
        }
      });
    }
  } else if (mood === 'chill') {
    // LO-FI: Expressive soft sine-flute / electric bell topline (Bars 4..15)
    const lofiMel = [
      { beat: 16, f: 659.25, dur: 1.5 },
      { beat: 18, f: 587.33, dur: 1.0 },
      { beat: 19.5, f: 523.25, dur: 2.0 },
      { beat: 22, f: 440.0, dur: 1.5 },
      { beat: 24, f: 523.25, dur: 1.5 },
      { beat: 26, f: 587.33, dur: 1.2 },
      { beat: 27.5, f: 659.25, dur: 2.5 },
      { beat: 32, f: 783.99, dur: 1.5 },
      { beat: 34, f: 659.25, dur: 1.0 },
      { beat: 35.5, f: 587.33, dur: 1.5 },
      { beat: 38, f: 523.25, dur: 1.8 },
      { beat: 40, f: 440.0, dur: 1.5 },
      { beat: 42, f: 523.25, dur: 1.5 },
      { beat: 44, f: 587.33, dur: 3.0 },
      { beat: 48, f: 659.25, dur: 1.5 },
      { beat: 50, f: 783.99, dur: 1.5 },
      { beat: 52, f: 880.0, dur: 2.0 },
      { beat: 55, f: 783.99, dur: 1.5 },
      { beat: 57, f: 659.25, dur: 1.5 },
      { beat: 59.5, f: 587.33, dur: 3.0 },
    ];
    lofiMel.forEach((n, idx) => {
      const startSample = Math.floor(n.beat * beatSec * sampleRate);
      const durSamples = Math.floor(n.dur * beatSec * sampleRate);
      let phase = 0;
      const pan = idx % 2 === 0 ? -0.25 : 0.25;
      for (let i = 0; i < durSamples; i++) {
        const t = i / sampleRate;
        const vib = 1 + Math.sin(2 * Math.PI * 4.6 * t) * Math.min(1, t / 0.2) * 0.004;
        phase += (n.f * vib) / sampleRate;
        const env = Math.min(1, t / 0.05) * Math.exp(-t * 1.45);
        const s = (Math.sin(2 * Math.PI * phase) + Math.sin(6 * Math.PI * phase) * 0.07) * env * 0.085;
        addWrapped(wetBusL, startSample + i, s * (1 - pan), totalSamples);
        addWrapped(wetBusR, startSample + i, s * (1 + pan), totalSamples);
      }
    });
  } else {
    // EUROBEAT & SYNTHWAVE: Sparkling Filtered 16th/8th Arpeggio + 16-Bar Dual-Phrase Hook!
    for (let bar = 0; bar < 16; bar++) {
      const chord = getChordForBar(bar);
      const stepsPerBar = mood === 'intense' ? 8 : 16;
      const stepBeats = 4 / stepsPerBar;
      for (let st = 0; st < stepsPerBar; st++) {
        const noteFreq = chord[st % chord.length] * (st % 8 >= 4 ? 2 : 1);
        const startBeat = bar * 4 + st * stepBeats;
        const pan = Math.sin(st * 0.75) * 0.45;
        renderWarmLeadNote(
          startBeat,
          stepBeats * 0.72,
          noteFreq,
          mood === 'intense' ? 0.052 : 0.044,
          pan,
          0.0022,
          1650
        );
      }
    }

    // Verse Hook (Bars 2..7) + Soaring Chorus Lead (Bars 8..15)
    const melodyNotes = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
    const verseHook = [
      { beat: 8, note: 5, dur: 1.25 },
      { beat: 10, note: 6, dur: 1.0 },
      { beat: 11.5, note: 7, dur: 1.5 },
      { beat: 14, note: 5, dur: 1.5 },
      { beat: 16, note: 6, dur: 1.25 },
      { beat: 18, note: 5, dur: 1.0 },
      { beat: 19.5, note: 4, dur: 2.0 },
      { beat: 22.5, note: 3, dur: 1.25 },
      { beat: 24, note: 5, dur: 1.25 },
      { beat: 26, note: 6, dur: 1.25 },
      { beat: 27.5, note: 8, dur: 2.0 },
      { beat: 30, note: 7, dur: 1.5 },
    ];
    const chorusHook = [
      { beat: 32, note: 5, dur: 1.5 },
      { beat: 34, note: 4, dur: 1.0 },
      { beat: 35.5, note: 6, dur: 0.5 },
      { beat: 36, note: 7, dur: 2.0 },
      { beat: 38.5, note: 6, dur: 1.5 },
      { beat: 40, note: 8, dur: 2.0 },
      { beat: 42.5, note: 7, dur: 1.0 },
      { beat: 44, note: 5, dur: 3.4 },
      { beat: 48, note: 5, dur: 1.5 },
      { beat: 50, note: 4, dur: 1.0 },
      { beat: 51.5, note: 6, dur: 0.5 },
      { beat: 52, note: 7, dur: 2.0 },
      { beat: 54.5, note: 8, dur: 1.5 },
      { beat: 56, note: 9, dur: 1.5 },
      { beat: 58, note: 8, dur: 1.5 },
      { beat: 60, note: 7, dur: 3.4 },
    ];

    verseHook.forEach((item, idx) => {
      renderWarmLeadNote(
        item.beat,
        item.dur,
        melodyNotes[item.note],
        0.095,
        idx % 2 === 0 ? -0.18 : 0.18,
        0.0042,
        2400
      );
    });
    chorusHook.forEach((item, idx) => {
      renderWarmLeadNote(
        item.beat,
        item.dur,
        melodyNotes[item.note],
        0.135,
        idx % 2 === 0 ? -0.22 : 0.22,
        0.0055,
        3200
      );
    });
  }

  // ---------------------------------------------------------------------------
  // 5. SEAMLESS CIRCULAR STEREO PING-PONG DELAY + WARM ROOM REVERB + SOFT LIMIT
  // ---------------------------------------------------------------------------
  const delayTapA = Math.floor(beatSec * 0.75 * sampleRate); // dotted 8th
  const delayTapB = Math.floor(beatSec * 1.5 * sampleRate);  // 3/8 bar echo
  const revTap1 = Math.floor(0.029 * sampleRate);
  const revTap2 = Math.floor(0.043 * sampleRate);
  const revTap3 = Math.floor(0.061 * sampleRate);
  const revTap4 = Math.floor(0.083 * sampleRate);

  const wetAmount = mood === 'chill' ? 0.42 : mood === 'intense' ? 0.38 : 0.32;
  let dampL = 0;
  let dampR = 0;

  for (let i = 0; i < totalSamples; i++) {
    const srcL = wetBusL[i];
    const srcR = wetBusR[i];

    const iA = (i - delayTapA + totalSamples) % totalSamples;
    const iB = (i - delayTapB + totalSamples) % totalSamples;

    // Cross-channel stereo ping-pong echo + 4-tap early room diffuser
    const echoL = wetBusR[iA] * 0.28 + wetBusL[iB] * 0.14;
    const echoR = wetBusL[iA] * 0.28 + wetBusR[iB] * 0.14;

    const r1 = (i - revTap1 + totalSamples) % totalSamples;
    const r2 = (i - revTap2 + totalSamples) % totalSamples;
    const r3 = (i - revTap3 + totalSamples) % totalSamples;
    const r4 = (i - revTap4 + totalSamples) % totalSamples;

    const roomL =
      (wetBusL[r1] * 0.28 + wetBusR[r2] * 0.22 - wetBusL[r3] * 0.16 + wetBusR[r4] * 0.12) * 0.5;
    const roomR =
      (wetBusR[r1] * 0.28 + wetBusL[r2] * 0.22 - wetBusR[r3] * 0.16 + wetBusL[r4] * 0.12) * 0.5;

    // Gentle high-cut damping on reverb/echo tails for analog tape warmth
    dampL = dampL * 0.42 + (echoL + roomL) * 0.58;
    dampR = dampR * 0.42 + (echoR + roomR) * 0.58;

    dryL[i] = Math.tanh((dryL[i] + srcL + dampL * wetAmount) * 1.05);
    dryR[i] = Math.tanh((dryR[i] + srcR + dampR * wetAmount) * 1.05);
  }

  // Soft peak normalize safely below 0.90
  let maxPeak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const absL = Math.abs(dryL[i]);
    const absR = Math.abs(dryR[i]);
    if (absL > maxPeak) maxPeak = absL;
    if (absR > maxPeak) maxPeak = absR;
  }

  if (maxPeak > 0.9) {
    const scale = 0.9 / maxPeak;
    for (let i = 0; i < totalSamples; i++) {
      dryL[i] *= scale;
      dryR[i] *= scale;
    }
  }

  return buffer;
}
