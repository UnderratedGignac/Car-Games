/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_ROSTER,
  HORN_OPTIONS,
  UNDERGLOW_OPTIONS,
  getRainbowCycleColor,
  resolveCarAppearance,
  resolveUnderglowColor,
} from './rules';
import { JUKEBOX_TRACKS, SoundFXSystem, soundFX } from './audio';
import { generateBuiltinArcadeTrack } from './synthTrack';

// --- 1. HORN OPTIONS & AUDIO SYNTHESIS TESTS ---

test('HORN_OPTIONS exports all 5 arcade horn profiles with proper metadata', () => {
  assert.equal(HORN_OPTIONS.length, 5);
  const ids = HORN_OPTIONS.map((h) => h.id);
  assert.deepEqual(ids, ['dual', 'laser', 'fanfare', 'melody', 'train']);

  HORN_OPTIONS.forEach((opt) => {
    assert.ok(typeof opt.id === 'string' && opt.id.length > 0);
    assert.ok(typeof opt.label === 'string' && opt.label.length > 0);
    assert.ok(typeof opt.icon === 'string' && opt.icon.length > 0);
    assert.ok(typeof opt.cost === 'number' && opt.cost >= 0);
  });

  const classic = HORN_OPTIONS.find((h) => h.id === 'dual');
  assert.equal(classic?.cost, 0);

  const laser = HORN_OPTIONS.find((h) => h.id === 'laser');
  assert.equal(laser?.cost, 500);

  const fanfare = HORN_OPTIONS.find((h) => h.id === 'fanfare');
  assert.equal(fanfare?.cost, 800);

  const melody = HORN_OPTIONS.find((h) => h.id === 'melody');
  assert.equal(melody?.cost, 1000);

  const train = HORN_OPTIONS.find((h) => h.id === 'train');
  assert.equal(train?.cost, 1200);
});

test('Horn synthesis - safe execution without throwing in headless SSR environment', () => {
  const engine = new SoundFXSystem();
  // Safe calls for all types
  assert.doesNotThrow(() => engine.playHorn('dual'));
  assert.doesNotThrow(() => engine.playHorn('laser'));
  assert.doesNotThrow(() => engine.playHorn('fanfare'));
  assert.doesNotThrow(() => engine.playHorn('melody'));
  assert.doesNotThrow(() => engine.playHorn('train'));
  assert.doesNotThrow(() => engine.playHorn(undefined));
  assert.doesNotThrow(() => engine.playHorn('unknown_custom_id'));
});

test('Horn synthesis - exact acoustic frequency and DSP parameters with mock Web Audio API', () => {
  const createdOscs: {
    type: string;
    freqSet: number[];
    freqRamps: { val: number; time: number }[];
  }[] = [];
  const createdFilters: {
    type: string;
    qSet: number[];
    freqSet: number[];
    freqRamps: { val: number; time: number }[];
  }[] = [];

  const mockCtx = {
    currentTime: 10.0,
    createOscillator: () => {
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: {
          setValueAtTime: (v: number) => osc.freqSet.push(v),
          exponentialRampToValueAtTime: (v: number, t: number) => osc.freqRamps.push({ val: v, time: t }),
          linearRampToValueAtTime: () => {},
        },
        connect: () => {},
        start: () => {},
        stop: () => {},
        freqSet: [] as number[],
        freqRamps: [] as { val: number; time: number }[],
      };
      createdOscs.push(osc);
      return osc;
    },
    createBiquadFilter: () => {
      const filter = {
        type: 'lowpass' as BiquadFilterType,
        Q: {
          setValueAtTime: (v: number) => filter.qSet.push(v),
        },
        frequency: {
          setValueAtTime: (v: number) => filter.freqSet.push(v),
          exponentialRampToValueAtTime: (v: number, t: number) => filter.freqRamps.push({ val: v, time: t }),
        },
        connect: () => {},
        qSet: [] as number[],
        freqSet: [] as number[],
        freqRamps: [] as { val: number; time: number }[],
      };
      createdFilters.push(filter);
      return filter;
    },
    createGain: () => ({
      gain: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        setTargetAtTime: () => {},
      },
      connect: () => {},
    }),
    createDynamicsCompressor: () => ({
      threshold: { setValueAtTime: () => {} },
      knee: { setValueAtTime: () => {} },
      ratio: { setValueAtTime: () => {} },
      attack: { setValueAtTime: () => {} },
      release: { setValueAtTime: () => {} },
      connect: () => {},
    }),
    destination: {},
  };

  const engine = new SoundFXSystem();
  // Inject mock ctx into engine
  (engine as unknown as { ctx: unknown }).ctx = mockCtx;

  // 1. LASER HORN: 880Hz down to 220Hz with fast resonant sweep
  createdOscs.length = 0;
  createdFilters.length = 0;
  engine.playHorn('laser');
  assert.equal(createdOscs.length, 1);
  assert.equal(createdOscs[0].type, 'sawtooth');
  assert.equal(createdOscs[0].freqSet[0], 880);
  assert.equal(createdOscs[0].freqRamps[0].val, 220);
  assert.equal(createdFilters[0].type, 'lowpass');
  assert.ok(createdFilters[0].qSet[0] >= 6.0, 'Laser filter must have high resonant Q sweep');

  // 2. FANFARE HORN: Rapid 4-note ascending fanfare (C5, E5, G5, C6)
  createdOscs.length = 0;
  createdFilters.length = 0;
  engine.playHorn('fanfare');
  assert.equal(createdOscs.length, 4);
  const fanfareFreqs = createdOscs.map((o) => o.freqSet[0]);
  assert.deepEqual(fanfareFreqs, [523.25, 659.25, 783.99, 1046.50]);

  // 3. MELODY HORN: 5-note retro chiptune riff with square wave
  createdOscs.length = 0;
  engine.playHorn('melody');
  assert.equal(createdOscs.length, 5);
  createdOscs.forEach((o) => {
    assert.equal(o.type, 'square', 'Retro chiptune melody must use square wave');
  });
  const melodyFreqs = createdOscs.map((o) => o.freqSet[0]);
  assert.deepEqual(melodyFreqs, [523.25, 659.25, 783.99, 880.00, 1046.50]);

  // 4. TRAIN HORN: Low dual-frequency chord (150Hz + 225Hz with sawtooth warmth)
  createdOscs.length = 0;
  engine.playHorn('train');
  assert.equal(createdOscs.length, 2);
  assert.equal(createdOscs[0].type, 'sawtooth');
  assert.equal(createdOscs[1].type, 'sawtooth');
  const trainFreqs = createdOscs.map((o) => o.freqSet[0]).sort((a, b) => a - b);
  assert.deepEqual(trainFreqs, [150, 225]);

  // 5. DUAL HORN: Classic automotive dual horn (440Hz + 370Hz)
  createdOscs.length = 0;
  engine.playHorn('dual');
  assert.equal(createdOscs.length, 2);
  const dualFreqs = createdOscs.map((o) => o.freqSet[0]).sort((a, b) => a - b);
  assert.deepEqual(dualFreqs, [370, 440]);

  // Default fallback also triggers dual
  createdOscs.length = 0;
  engine.playHorn(undefined);
  assert.equal(createdOscs.length, 2);
  const defFreqs = createdOscs.map((o) => o.freqSet[0]).sort((a, b) => a - b);
  assert.deepEqual(defFreqs, [370, 440]);
});

// --- 2. JUKEBOX PLAYLIST & TRACK CYCLING TESTS ---

test('JUKEBOX_TRACKS exports exact 4 curated racing anthems', () => {
  assert.equal(JUKEBOX_TRACKS.length, 4);

  const eurobeat = JUKEBOX_TRACKS.find((t) => t.id === 'eurobeat')!;
  assert.ok(eurobeat);
  assert.equal(eurobeat.title, 'Tokyo Highway Eurobeat');
  assert.equal(eurobeat.bpm, 160);
  assert.equal(eurobeat.genre, 'Eurobeat');
  assert.equal(eurobeat.mood, 'high_energy');

  const synthwave = JUKEBOX_TRACKS.find((t) => t.id === 'synthwave')!;
  assert.ok(synthwave);
  assert.equal(synthwave.title, 'Cyberpunk Synthwave Pulse');
  assert.equal(synthwave.bpm, 128);
  assert.equal(synthwave.genre, 'Synthwave');
  assert.equal(synthwave.mood, 'intense');

  const phonk = JUKEBOX_TRACKS.find((t) => t.id === 'phonk')!;
  assert.ok(phonk);
  assert.equal(phonk.title, 'Midnight Touge Drift Phonk');
  assert.equal(phonk.bpm, 142);
  assert.equal(phonk.genre, 'Drift Phonk');
  assert.equal(phonk.mood, 'drift');

  const lofi = JUKEBOX_TRACKS.find((t) => t.id === 'lofi')!;
  assert.ok(lofi);
  assert.equal(lofi.title, 'Neo-Tokyo Lo-Fi Serenity');
  assert.equal(lofi.bpm, 88);
  assert.equal(lofi.genre, 'Chillwave');
  assert.equal(lofi.mood, 'chill');
});

test('Jukebox track cycling - nextJukeboxTrack, prevJukeboxTrack & switchJukeboxTrack', () => {
  const engine = new SoundFXSystem();

  // Initial track is eurobeat
  const initial = engine.getJukeboxTrack();
  assert.equal(initial.id, 'eurobeat');

  // Next track advances to synthwave
  const track2 = engine.nextJukeboxTrack();
  assert.equal(track2.id, 'synthwave');
  assert.equal(engine.getJukeboxTrack().id, 'synthwave');

  // Next track advances to phonk
  const track3 = engine.nextJukeboxTrack();
  assert.equal(track3.id, 'phonk');

  // Next track advances to lofi
  const track4 = engine.nextJukeboxTrack();
  assert.equal(track4.id, 'lofi');

  // Wrap around back to eurobeat
  const trackWrap = engine.nextJukeboxTrack();
  assert.equal(trackWrap.id, 'eurobeat');

  // Cycle backwards
  const prevTrack = engine.prevJukeboxTrack();
  assert.equal(prevTrack.id, 'lofi');

  // Direct switch to chill lo-fi cruise track
  const direct = engine.switchJukeboxTrack('lofi');
  assert.equal(direct.id, 'lofi');
  assert.equal(direct.title, 'Neo-Tokyo Lo-Fi Serenity');
  assert.equal(engine.getDeckSnapshot().activeTrackId, 'lofi');
  assert.equal(engine.getDeckSnapshot().currentTrack.id, 'lofi');
});

test('Jukebox track cycling - triggers reactive subscriber notifications', () => {
  const engine = new SoundFXSystem();
  let notifications = 0;
  const unsub = engine.subscribe(() => {
    notifications++;
  });

  engine.nextJukeboxTrack();
  assert.equal(notifications, 1);

  engine.switchJukeboxTrack('phonk');
  assert.equal(notifications, 2);

  unsub();
  engine.nextJukeboxTrack();
  assert.equal(notifications, 2); // No new call after unsubscribe
});

test('Procedural track synthesizer - produces valid multi-beat stereo PCM buffers for each mood', () => {
  // Mock AudioContext for offline buffer generation
  const mockCtx = {
    sampleRate: 22050, // Low sample rate for fast unit testing
    createBuffer: (channels: number, length: number, sampleRate: number) => {
      const channelData: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: (ch: number) => channelData[ch],
      } as unknown as AudioBuffer;
    },
  } as AudioContext;

  JUKEBOX_TRACKS.forEach((track) => {
    const buf = generateBuiltinArcadeTrack(mockCtx, track);
    assert.ok(buf);
    assert.equal(buf.numberOfChannels, 2);
    assert.ok(buf.length > 0);
    assert.ok(buf.duration > 10.0, 'Track must generate full 16-bar duration');

    // Confirm audio buffer contains valid non-zero synthesized PCM samples
    const left = buf.getChannelData(0);
    const right = buf.getChannelData(1);
    let leftPeak = 0;
    let rightPeak = 0;
    for (let i = 0; i < buf.length; i += 20) {
      if (Math.abs(left[i]) > leftPeak) leftPeak = Math.abs(left[i]);
      if (Math.abs(right[i]) > rightPeak) rightPeak = Math.abs(right[i]);
    }
    assert.ok(leftPeak > 0.05, `Track ${track.id} left channel must synthesize audio`);
    assert.ok(rightPeak > 0.05, `Track ${track.id} right channel must synthesize audio`);
    assert.ok(leftPeak <= 1.0, `Track ${track.id} left peak must not clip`);
    assert.ok(rightPeak <= 1.0, `Track ${track.id} right peak must not clip`);
  });
});

// --- 3. UNDERGLOW PARSING & RESOLUTION TESTS ---

test('UNDERGLOW_OPTIONS exports all 8 glow kits specified in Sprint 6 & 7', () => {
  assert.equal(UNDERGLOW_OPTIONS.length, 8);
  const ids = UNDERGLOW_OPTIONS.map((u) => u.id);
  assert.deepEqual(ids, [
    'none',
    '#06b6d4',
    '#f43f5e',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ec4899',
    'rainbow',
  ]);

  const none = UNDERGLOW_OPTIONS.find((u) => u.id === 'none')!;
  assert.equal(none.cost, 0);
  assert.equal(none.color, 'transparent');

  const cyan = UNDERGLOW_OPTIONS.find((u) => u.id === '#06b6d4')!;
  assert.equal(cyan.label, 'Neon Cyan');
  assert.equal(cyan.cost, 500);

  const crimson = UNDERGLOW_OPTIONS.find((u) => u.id === '#f43f5e')!;
  assert.equal(crimson.label, 'Crimson Glow');
  assert.equal(crimson.cost, 500);

  const rainbow = UNDERGLOW_OPTIONS.find((u) => u.id === 'rainbow')!;
  assert.equal(rainbow.label, 'RGB Rainbow Cycle');
  assert.equal(rainbow.cost, 1500);
});

test('resolveUnderglowColor correctly parses IDs, hex values, legacy names, and rainbow', () => {
  // None / empty
  assert.equal(resolveUnderglowColor('none'), null);
  assert.equal(resolveUnderglowColor('transparent'), null);
  assert.equal(resolveUnderglowColor(undefined), null);
  assert.equal(resolveUnderglowColor(''), null);

  // Exact hex colors
  assert.equal(resolveUnderglowColor('#06b6d4'), '#06b6d4');
  assert.equal(resolveUnderglowColor('#f43f5e'), '#f43f5e');
  assert.equal(resolveUnderglowColor('#10b981'), '#10b981');
  assert.equal(resolveUnderglowColor('#8b5cf6'), '#8b5cf6');
  assert.equal(resolveUnderglowColor('#f59e0b'), '#f59e0b');
  assert.equal(resolveUnderglowColor('#ec4899'), '#ec4899');

  // Legacy IDs
  assert.equal(resolveUnderglowColor('cyan'), '#22d3ee');
  assert.equal(resolveUnderglowColor('amber'), '#fbbf24');
  assert.equal(resolveUnderglowColor('pink'), '#f472b6');

  // Rainbow cycle produces valid hex at specified timestamps
  const rainbowAt0 = resolveUnderglowColor('rainbow', 0);
  assert.ok(rainbowAt0 && /^#[0-9a-f]{6}$/i.test(rainbowAt0));

  const rainbowAt1500 = resolveUnderglowColor('rainbow', 1500);
  assert.ok(rainbowAt1500 && /^#[0-9a-f]{6}$/i.test(rainbowAt1500));
  assert.notEqual(rainbowAt0, rainbowAt1500, 'Rainbow cycle colors must shift across time');
});

test('resolveCarAppearance integrates underglowColor and hornType overrides', () => {
  const starter = CAR_ROSTER[0];

  // Stock default
  const stock = resolveCarAppearance(starter);
  assert.equal(stock.underglowHex, null);
  assert.equal(stock.hornType, 'dual');

  // Custom Neon Cyan underglow and Sci-Fi Laser horn
  const custom1 = resolveCarAppearance(starter, {
    underglowColor: '#06b6d4',
    hornType: 'laser',
  });
  assert.equal(custom1.underglowHex, '#06b6d4');
  assert.equal(custom1.hornType, 'laser');

  // Custom RGB Rainbow Cycle underglow and Trophy Fanfare horn
  const custom2 = resolveCarAppearance(starter, {
    underglowColor: 'rainbow',
    hornType: 'fanfare',
  });
  assert.ok(custom2.underglowHex && /^#[0-9a-f]{6}$/i.test(custom2.underglowHex));
  assert.equal(custom2.hornType, 'fanfare');

  // Backward compatibility: legacy underglow: 'cyan' and horn: 'air_horn'
  const customLegacy = resolveCarAppearance(starter, {
    underglow: 'cyan',
    horn: 'air_horn',
  });
  assert.equal(customLegacy.underglowHex, '#22d3ee');
  assert.equal(customLegacy.hornType, 'train');
  assert.equal(customLegacy.horn, 'air_horn');
});

// --- 4. RAINBOW CYCLE COLOR CALCULATION TESTS ---

test('getRainbowCycleColor produces valid 7-character #rrggbb hex strings', () => {
  for (let t = 0; t <= 3000; t += 250) {
    const hex = getRainbowCycleColor(t);
    assert.equal(hex.length, 7);
    assert.ok(/^#[0-9a-f]{6}$/i.test(hex), `Output ${hex} must be a valid hex color string`);
  }
});

test('getRainbowCycleColor is deterministic and loops cleanly every 3000ms', () => {
  const t0 = getRainbowCycleColor(0);
  const t3000 = getRainbowCycleColor(3000);
  assert.equal(t0, t3000, 'Color at t=0 and t=3000 must match exactly (seamless 3s loop)');

  const t500 = getRainbowCycleColor(500);
  const t3500 = getRainbowCycleColor(3500);
  assert.equal(t500, t3500, 'Color at t=500 and t=3500 must match');
});

test('getRainbowCycleColor sweeps the RGB color spectrum (Red -> Green -> Blue -> Red)', () => {
  // Helper to parse hex to [r, g, b]
  const parseRgb = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  // At t=0 (0° hue): Red dominates
  const [r0, g0, b0] = parseRgb(getRainbowCycleColor(0));
  assert.ok(r0 > g0 && r0 > b0, `Red should dominate at hue 0°: ${r0}, ${g0}, ${b0}`);

  // At t=1000 (120° hue): Green dominates
  const [r1000, g1000, b1000] = parseRgb(getRainbowCycleColor(1000));
  assert.ok(g1000 > r1000 && g1000 > b1000, `Green should dominate at hue 120°: ${r1000}, ${g1000}, ${b1000}`);

  // At t=2000 (240° hue): Blue dominates
  const [r2000, g2000, b2000] = parseRgb(getRainbowCycleColor(2000));
  assert.ok(b2000 > r2000 && b2000 > g2000, `Blue should dominate at hue 240°: ${r2000}, ${g2000}, ${b2000}`);
});
