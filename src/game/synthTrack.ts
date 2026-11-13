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
 * Procedural In-Memory Soundtrack Generator for Neon Redline.
 * Synthesizes seamless 16-bar stereo racing soundtracks directly into
 * an AudioBuffer matching specific BPM, genre, and mood characteristics.
 * 100% algorithmic Web Audio PCM mixing with zero network dependencies!
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
  const totalBeats = 64; // 16 bars * 4 beats
  const totalDurationSec = totalBeats * beatSec;
  const totalSamples = Math.floor(totalDurationSec * sampleRate);

  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // 1. DRUM PATTERNS BASED ON MOOD
  for (let beat = 0; beat < totalBeats; beat++) {
    const beatStart = Math.floor(beat * beatSec * sampleRate);

    if (mood === 'chill') {
      // LO-FI / CHILLWAVE: Warm soft thud kick on beats 1 and 3 (with subtle swing)
      if (beat % 4 === 0 || (beat % 4 === 2 && (beat % 8 === 2))) {
        const kickSamples = Math.floor(0.18 * sampleRate);
        for (let i = 0; i < kickSamples && beatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const freq = 95 * Math.exp(-t * 22) + 38;
          const env = Math.exp(-t * 12);
          const val = Math.sin(2 * Math.PI * freq * t) * env * 0.36;
          left[beatStart + i] += val;
          right[beatStart + i] += val;
        }
      }

      // Soft rim / finger snap on beats 2 and 4 (beat % 2 === 1)
      if (beat % 2 === 1) {
        const snapSamples = Math.floor(0.12 * sampleRate);
        for (let i = 0; i < snapSamples && beatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 40);
          const tone = Math.sin(2 * Math.PI * 340 * t) * Math.exp(-t * 35);
          const val = (noise * 0.5 + tone * 0.5) * 0.16;
          left[beatStart + i] += val * 0.95;
          right[beatStart + i] += val * 1.05;
        }
      }

      // Gentle mellow 8th hi-hats with soft brush sound
      for (let step = 0; step < 2; step++) {
        const hatOffset = Math.floor((step * beatSec * sampleRate) / 2);
        const hatStart = beatStart + hatOffset;
        const hatSamples = Math.floor(0.04 * sampleRate);
        const hatVol = step === 1 ? 0.05 : 0.035;
        for (let i = 0; i < hatSamples && hatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 70) * hatVol;
          left[hatStart + i] += noise;
          right[hatStart + i] += noise;
        }
      }
    } else if (mood === 'drift') {
      // DRIFT PHONK: Distorted 808 sub-kick on beat 1 and 3.5
      const isPhonkKick = beat % 2 === 0 || (beat % 4 === 3 && beat % 2 === 1);
      if (isPhonkKick) {
        const kickSamples = Math.floor(0.28 * sampleRate);
        for (let i = 0; i < kickSamples && beatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const freq = 160 * Math.exp(-t * 26) + 38;
          const env = Math.exp(-t * 11);
          // Overdriven 808 punch
          let val = Math.sin(2 * Math.PI * freq * t) * env * 0.65;
          val = Math.tanh(val * 1.4) * 0.48;
          left[beatStart + i] += val;
          right[beatStart + i] += val;
        }
      }

      // Crisp phonk trap snare on beat 2 and 4 (beat % 2 === 1)
      if (beat % 2 === 1) {
        const snareSamples = Math.floor(0.20 * sampleRate);
        for (let i = 0; i < snareSamples && beatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 24);
          const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 28);
          const val = (noise * 0.72 + tone * 0.28) * 0.32;
          left[beatStart + i] += val;
          right[beatStart + i] += val;
        }
      }

      // Rapid phonk trap hi-hat rolls (16ths + triple bursts)
      for (let step = 0; step < 4; step++) {
        const hatStart = beatStart + Math.floor((step * beatSec * sampleRate) / 4);
        const hatSamples = Math.floor(0.045 * sampleRate);
        const hatVol = step === 2 ? 0.12 : 0.07;
        for (let i = 0; i < hatSamples && hatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 60) * hatVol;
          left[hatStart + i] += noise * (step % 2 === 0 ? 0.75 : 1.15);
          right[hatStart + i] += noise * (step % 2 === 0 ? 1.15 : 0.75);
        }
      }
    } else if (mood === 'intense') {
      // SYNTHWAVE: Heavy 80s gated kick and snare
      const kickSamples = Math.floor(0.25 * sampleRate);
      for (let i = 0; i < kickSamples && beatStart + i < totalSamples; i++) {
        const t = i / sampleRate;
        const freq = 135 * Math.exp(-t * 25) + 44;
        const env = Math.exp(-t * 13);
        const val = Math.sin(2 * Math.PI * freq * t) * env * 0.46;
        left[beatStart + i] += val;
        right[beatStart + i] += val;
      }

      if (beat % 2 === 1) {
        const snareSamples = Math.floor(0.28 * sampleRate);
        for (let i = 0; i < snareSamples && beatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 18);
          const tone = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t * 22);
          const val = (noise * 0.6 + tone * 0.4) * 0.30;
          left[beatStart + i] += val;
          right[beatStart + i] += val;
        }
      }

      for (let step = 0; step < 4; step++) {
        const hatStart = beatStart + Math.floor((step * beatSec * sampleRate) / 4);
        const isUpbeat = step === 2;
        const hatVol = isUpbeat ? 0.14 : 0.08;
        const hatSamples = Math.floor(0.04 * sampleRate);
        for (let i = 0; i < hatSamples && hatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 50) * hatVol;
          left[hatStart + i] += noise * 0.9;
          right[hatStart + i] += noise * 1.1;
        }
      }
    } else {
      // HIGH_ENERGY (EUROBEAT): Driving 4-on-the-floor kick + driving 16th hats
      const kickSamples = Math.floor(0.22 * sampleRate);
      for (let i = 0; i < kickSamples && beatStart + i < totalSamples; i++) {
        const t = i / sampleRate;
        const freq = 150 * Math.exp(-t * 30) + 45;
        const env = Math.exp(-t * 15);
        const val = Math.sin(2 * Math.PI * freq * t) * env * 0.44;
        left[beatStart + i] += val;
        right[beatStart + i] += val;
      }

      if (beat % 2 === 1) {
        const snareSamples = Math.floor(0.20 * sampleRate);
        for (let i = 0; i < snareSamples && beatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 22);
          const tone = Math.sin(2 * Math.PI * 230 * t) * Math.exp(-t * 24);
          const val = (noise * 0.65 + tone * 0.35) * 0.28;
          left[beatStart + i] += val * 0.95;
          right[beatStart + i] += val * 1.05;
        }
      }

      for (let step = 0; step < 4; step++) {
        const hatStart = beatStart + Math.floor((step * beatSec * sampleRate) / 4);
        const isUpbeat = step === 2;
        const hatVol = isUpbeat ? 0.16 : 0.08;
        const hatSamples = Math.floor((isUpbeat ? 0.08 : 0.04) * sampleRate);
        for (let i = 0; i < hatSamples && hatStart + i < totalSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 55) * hatVol;
          left[hatStart + i] += noise * (step % 2 === 0 ? 0.8 : 1.1);
          right[hatStart + i] += noise * (step % 2 === 0 ? 1.1 : 0.8);
        }
      }
    }
  }

  // 2. BASSLINE SYNTHESIS MATCHING MOOD & BPM
  const rootFreqs = [55.0, 43.65, 65.41, 49.0]; // Am -> F -> C -> G
  const sixteenthSec = beatSec / 4;
  const totalSixteenths = totalBeats * 4;

  if (mood === 'chill') {
    // LO-FI: Warm deep sine sub-bass walking smoothly on quarter/half notes
    for (let beat = 0; beat < totalBeats; beat++) {
      const bar = Math.floor(beat / 4);
      const chordIndex = Math.floor(bar / 4) % 4;
      const baseFreq = rootFreqs[chordIndex];
      const startSample = Math.floor(beat * beatSec * sampleRate);
      const durSamples = Math.floor(beatSec * 0.92 * sampleRate);

      for (let i = 0; i < durSamples && startSample + i < totalSamples; i++) {
        const t = i / sampleRate;
        const env = Math.min(1, t / 0.03) * Math.exp(-t * 2.2);
        const sine = Math.sin(2 * Math.PI * baseFreq * t);
        const warm2nd = Math.sin(2 * Math.PI * baseFreq * 2 * t) * 0.15;
        const val = (sine + warm2nd) * env * 0.32;
        left[startSample + i] += val;
        right[startSample + i] += val;
      }
    }
  } else if (mood === 'drift') {
    // DRIFT PHONK: Heavy sliding 808 sub bass with low-end saturation
    for (let beat = 0; beat < totalBeats; beat += 2) {
      const bar = Math.floor(beat / 4);
      const chordIndex = Math.floor(bar / 4) % 4;
      const baseFreq = rootFreqs[chordIndex];
      const startSample = Math.floor(beat * beatSec * sampleRate);
      const durSamples = Math.floor(beatSec * 1.8 * sampleRate);

      for (let i = 0; i < durSamples && startSample + i < totalSamples; i++) {
        const t = i / sampleRate;
        const slide = Math.exp(-t * 0.75);
        const f = baseFreq * (1 + slide * 0.35);
        const env = Math.min(1, t / 0.015) * Math.exp(-t * 1.6);
        let sub = Math.sin(2 * Math.PI * f * t);
        sub = Math.tanh(sub * 1.8) * 0.36; // Warm 808 saturation
        left[startSample + i] += sub;
        right[startSample + i] += sub;
      }
    }
  } else {
    // HIGH_ENERGY & INTENSE: Bouncing octave saw bassline
    for (let s = 0; s < totalSixteenths; s++) {
      const bar = Math.floor(s / 16);
      const chordIndex = Math.floor(bar / 4) % 4;
      const baseFreq = rootFreqs[chordIndex];
      const freq = s % 2 === 1 ? baseFreq * 2 : baseFreq;
      const startSample = Math.floor(s * sixteenthSec * sampleRate);
      const durSamples = Math.floor(sixteenthSec * 0.82 * sampleRate);

      for (let i = 0; i < durSamples && startSample + i < totalSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 18);
        const saw = (2 * ((freq * t) % 1) - 1) * 0.7 + (2 * ((freq * 2 * t) % 1) - 1) * 0.3;
        const val = saw * env * 0.25;
        left[startSample + i] += val;
        right[startSample + i] += val;
      }
    }
  }

  // 3. MELODY & ATMOSPHERE MATCHING GENRE
  if (mood === 'drift') {
    // PHONK: Iconic metallic cowbell melody riff
    const cowbellNotes = [587.33, 698.46, 783.99, 880.0, 1046.5];
    const phonkRiff = [
      { step: 0, n: 3 }, { step: 3, n: 3 }, { step: 6, n: 2 }, { step: 8, n: 4 },
      { step: 11, n: 3 }, { step: 14, n: 1 }, { step: 16, n: 3 }, { step: 19, n: 3 },
      { step: 22, n: 2 }, { step: 24, n: 4 }, { step: 27, n: 3 }, { step: 30, n: 0 },
    ];

    for (let bar = 2; bar < 16; bar += 2) {
      const barStartStep = bar * 16;
      phonkRiff.forEach((item) => {
        const s = barStartStep + item.step;
        if (s >= totalSixteenths) return;
        const startSample = Math.floor(s * sixteenthSec * sampleRate);
        const durSamples = Math.floor(sixteenthSec * 1.5 * sampleRate);
        const freq = cowbellNotes[item.n];

        for (let i = 0; i < durSamples && startSample + i < totalSamples; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 16);
          // Metallic dual-square FM
          const sq1 = Math.sign(Math.sin(2 * Math.PI * freq * t));
          const sq2 = Math.sign(Math.sin(2 * Math.PI * freq * 1.48 * t));
          const val = (sq1 * 0.6 + sq2 * 0.4) * env * 0.16;
          left[startSample + i] += val * 1.1;
          right[startSample + i] += val * 0.9;
        }
      });
    }
  } else if (mood === 'chill') {
    // LO-FI: Soft jazzy electric piano 7th chords
    const chordVoicings = [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [196.0, 246.94, 293.66, 349.23], // G7
    ];

    for (let bar = 0; bar < 16; bar++) {
      const chordIndex = Math.floor(bar / 4) % 4;
      const notes = chordVoicings[chordIndex];
      const startSample = Math.floor(bar * 4 * beatSec * sampleRate);
      const durSamples = Math.floor(beatSec * 3.6 * sampleRate);

      notes.forEach((freq, idx) => {
        for (let i = 0; i < durSamples && startSample + i < totalSamples; i++) {
          const t = i / sampleRate;
          const env = Math.min(1, t / 0.04) * Math.exp(-t * 0.95);
          const sine = Math.sin(2 * Math.PI * freq * t);
          const tri = (Math.abs(((freq * t) % 1) - 0.5) - 0.25) * 4;
          const val = (sine * 0.75 + tri * 0.25) * env * 0.08;
          const pan = idx % 2 === 0 ? 0.85 : 1.15;
          left[startSample + i] += val * pan;
          right[startSample + i] += val * (2 - pan);
        }
      });
    }
  } else {
    // EUROBEAT & SYNTHWAVE: Catchy supersaw lead melody (Bars 8 to 16)
    const melodyNotes = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
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
        const osc1 = 2 * ((freq * t) % 1) - 1;
        const osc2 = 2 * (((freq * 1.006) * t) % 1) - 1;
        const osc3 = 2 * (((freq * 0.994) * t) % 1) - 1;
        const val = (osc1 * 0.45 + osc2 * 0.3 + osc3 * 0.25) * env * 0.18;
        left[startSample + i] += val * 1.1;
        right[startSample + i] += val * 0.9;
      }
    });
  }

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
