/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Procedural In-Memory Arcade Synthwave / Eurobeat Soundtrack Generator.
 * Synthesizes a seamless 16-bar stereo 138 BPM racing anthem directly into
 * an AudioBuffer using clean algorithmic FM/additive synthesis and PCM mixing.
 * Works 100% offline with zero external network or audio file dependencies!
 */
export function generateBuiltinArcadeTrack(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bpm = 138;
  const beatSec = 60 / bpm; // ~0.4348s
  const totalBeats = 64; // 16 bars * 4 beats
  const totalDurationSec = totalBeats * beatSec;
  const totalSamples = Math.floor(totalDurationSec * sampleRate);

  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // 1. Master Drums (Kick, Snare, 16th Hi-Hats)
  for (let beat = 0; beat < totalBeats; beat++) {
    const beatStart = Math.floor(beat * beatSec * sampleRate);

    // Punchy 808-Style Sub Kick on every beat
    const kickSamples = Math.floor(0.24 * sampleRate);
    for (let i = 0; i < kickSamples && beatStart + i < totalSamples; i++) {
      const t = i / sampleRate;
      const freq = 145 * Math.exp(-t * 28) + 42;
      const env = Math.exp(-t * 14);
      const val = Math.sin(2 * Math.PI * freq * t) * env * 0.45;
      left[beatStart + i] += val;
      right[beatStart + i] += val;
    }

    // Snare / Rim Clap on beats 2 and 4 (beat % 2 === 1)
    if (beat % 2 === 1) {
      const snareSamples = Math.floor(0.22 * sampleRate);
      for (let i = 0; i < snareSamples && beatStart + i < totalSamples; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 22);
        const tone = Math.sin(2 * Math.PI * 210 * t) * Math.exp(-t * 26);
        const val = (noise * 0.65 + tone * 0.35) * 0.28;
        left[beatStart + i] += val * 0.95;
        right[beatStart + i] += val * 1.05;
      }
    }

    // 16th-Note Stereo Hi-Hats
    for (let step = 0; step < 4; step++) {
      const hatStart = beatStart + Math.floor((step * beatSec * sampleRate) / 4);
      const isUpbeat = step === 2;
      const hatVol = isUpbeat ? 0.16 : 0.08;
      const hatSamples = Math.floor((isUpbeat ? 0.08 : 0.04) * sampleRate);
      for (let i = 0; i < hatSamples && hatStart + i < totalSamples; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 55) * hatVol;
        // Subtle stereo panning for hi-hats
        left[hatStart + i] += noise * (step % 2 === 0 ? 0.8 : 1.1);
        right[hatStart + i] += noise * (step % 2 === 0 ? 1.1 : 0.8);
      }
    }
  }

  // 2. Rolling Octave Synth Bassline (Classic Eurobeat / Outrun Italo-Disco)
  // Chord progression across 16 bars (4 bars per chord: Am -> F -> C -> G)
  const rootFreqs = [
    55.0, // A1
    43.65, // F1
    65.41, // C2
    49.0, // G1
  ];

  const sixteenthSec = beatSec / 4;
  const totalSixteenths = totalBeats * 4;

  for (let s = 0; s < totalSixteenths; s++) {
    const bar = Math.floor(s / 16);
    const chordIndex = Math.floor(bar / 4) % 4;
    const baseFreq = rootFreqs[chordIndex];
    // Octave bounce pattern: low, high, low, high
    const freq = s % 2 === 1 ? baseFreq * 2 : baseFreq;
    const startSample = Math.floor(s * sixteenthSec * sampleRate);
    const durSamples = Math.floor(sixteenthSec * 0.82 * sampleRate);

    for (let i = 0; i < durSamples && startSample + i < totalSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 18);
      // Sawtooth wave with subtle second harmonic
      const saw = (2 * ((freq * t) % 1) - 1) * 0.7 + (2 * ((freq * 2 * t) % 1) - 1) * 0.3;
      const val = saw * env * 0.26;
      left[startSample + i] += val;
      right[startSample + i] += val;
    }
  }

  // 3. Catchy Neon Touge Supersaw Lead Melody (Bars 8 to 16)
  // Notes in A-Minor pentatonic / blues scale
  const melodyNotes = [
    220.0, // A3
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.0, // G4
    440.0, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
  ];

  // Pattern repeats with energetic variations
  const leadPattern = [
    { beat: 32, note: 5, dur: 1.5 },
    { beat: 34, note: 4, dur: 1.0 },
    { beat: 35.5, note: 6, dur: 0.5 },
    { beat: 36, note: 7, dur: 2.0 },
    { beat: 38.5, note: 6, dur: 1.5 },
    { beat: 40, note: 8, dur: 2.0 },
    { beat: 42.5, note: 7, dur: 1.0 },
    { beat: 44, note: 5, dur: 3.5 },

    { beat: 48, note: 5, dur: 1.5 },
    { beat: 50, note: 4, dur: 1.0 },
    { beat: 51.5, note: 6, dur: 0.5 },
    { beat: 52, note: 7, dur: 2.0 },
    { beat: 54.5, note: 8, dur: 1.5 },
    { beat: 56, note: 7, dur: 1.5 },
    { beat: 58, note: 6, dur: 1.5 },
    { beat: 60, note: 5, dur: 3.5 },
  ];

  leadPattern.forEach((item) => {
    const startSample = Math.floor(item.beat * beatSec * sampleRate);
    const durSamples = Math.floor(item.dur * beatSec * sampleRate);
    const freq = melodyNotes[item.note];

    for (let i = 0; i < durSamples && startSample + i < totalSamples; i++) {
      const t = i / sampleRate;
      const env = Math.min(1, t / 0.02) * Math.exp(-t * (1.8 / item.dur));
      // Detuned twin supersaw oscillators
      const osc1 = 2 * ((freq * t) % 1) - 1;
      const osc2 = 2 * (((freq * 1.006) * t) % 1) - 1;
      const osc3 = 2 * (((freq * 0.994) * t) % 1) - 1;
      const val = (osc1 * 0.45 + osc2 * 0.3 + osc3 * 0.25) * env * 0.18;

      // Stereo chorus spread
      left[startSample + i] += val * 1.1;
      right[startSample + i] += val * 0.9;
    }
  });

  // 4. Soft limiter / normalize to prevent any digital clipping
  let maxPeak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const absL = Math.abs(left[i]);
    const absR = Math.abs(right[i]);
    if (absL > maxPeak) maxPeak = absL;
    if (absR > maxPeak) maxPeak = absR;
  }

  if (maxPeak > 0.92) {
    const scale = 0.92 / maxPeak;
    for (let i = 0; i < totalSamples; i++) {
      left[i] *= scale;
      right[i] *= scale;
    }
  }

  return buffer;
}

