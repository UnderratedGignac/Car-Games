import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEGMENT_LENGTH,
  createTrack,
  ensureTrackAhead,
  findSegment,
  projectPoint,
  stepLateral,
  carsOverlap,
  speedToKmh,
  maxSpeedFor,
  createRunState,
  addFever,
  FEVER_DURATION,
  stepTimers,
  checkpointEvery,
  UNITS_PER_METER,
} from './pseudoRoad';

test('createTrack builds a continuous road with segment z positions', () => {
  const t = createTrack('drift', 7);
  assert.ok(t.segments.length >= 300);
  t.segments.forEach((s, i) => {
    assert.equal(s.index, i);
    assert.equal(s.z, i * SEGMENT_LENGTH);
    if (i > 0) assert.equal(s.y1, t.segments[i - 1].y2, 'hills must be continuous');
  });
});

test('track generation is deterministic for a seed', () => {
  const a = createTrack('highway_traffic', 42);
  const b = createTrack('highway_traffic', 42);
  assert.deepEqual(
    a.segments.slice(0, 200).map((s) => [s.curve, s.y2]),
    b.segments.slice(0, 200).map((s) => [s.curve, s.y2])
  );
});

test('drift track is twistier than highway track', () => {
  const avgCurve = (mode: 'drift' | 'highway_traffic') => {
    const t = createTrack(mode, 3);
    ensureTrackAhead(t, 3000);
    return t.segments.reduce((sum, s) => sum + Math.abs(s.curve), 0) / t.segments.length;
  };
  assert.ok(avgCurve('drift') > avgCurve('highway_traffic') * 1.4);
});

test('ensureTrackAhead extends the track without breaking continuity', () => {
  const t = createTrack('drift', 1);
  const before = t.segments.length;
  ensureTrackAhead(t, before + 500);
  assert.ok(t.segments.length >= before + 500);
  for (let i = 1; i < t.segments.length; i++) {
    assert.equal(t.segments[i].y1, t.segments[i - 1].y2);
  }
});

test('findSegment maps z into the right segment', () => {
  const t = createTrack('drift', 1);
  assert.equal(findSegment(t, 0).index, 0);
  assert.equal(findSegment(t, SEGMENT_LENGTH * 10 + 5).index, 10);
});

test('projectPoint: farther points are smaller and closer to the horizon', () => {
  const near = projectPoint(0, 0, 1000, 0, 1000, 0, 0.84, 400, 300, 2000);
  const far = projectPoint(0, 0, 8000, 0, 1000, 0, 0.84, 400, 300, 2000);
  assert.ok(near.w > far.w);
  assert.ok(near.y > far.y, 'near ground point lower on screen');
  assert.equal(Math.round(near.x), 200);
});

test('stepLateral: centrifugal force pushes the car outward on curves', () => {
  const r = stepLateral({ x: 0, speedRatio: 1, steer: 0, curve: 4, dt: 0.1, handling: 2.8, drifting: false });
  assert.ok(r.x < 0, 'right curve pushes car left');
});

test('stepLateral: drifting reduces centrifugal drag', () => {
  const grip = stepLateral({ x: 0, speedRatio: 1, steer: 0, curve: 4, dt: 0.1, handling: 2.8, drifting: false });
  const drift = stepLateral({ x: 0, speedRatio: 1, steer: 0, curve: 4, dt: 0.1, handling: 2.8, drifting: true });
  assert.ok(Math.abs(drift.x) < Math.abs(grip.x));
});

test('stepLateral: steering moves car and clamps it within limits', () => {
  let x = 0;
  for (let i = 0; i < 200; i++) {
    x = stepLateral({ x, speedRatio: 1, steer: 1, curve: 0, dt: 0.05, handling: 2.8, drifting: false }).x;
  }
  assert.ok(x > 0 && x <= 2.2);
});

test('carsOverlap detects lateral overlap only in range', () => {
  assert.equal(carsOverlap(0, 0.3, 0.2, 0.3), true);
  assert.equal(carsOverlap(-0.6, 0.3, 0.6, 0.3), false);
});

test('speed conversion: base car top speed reads as ~170-180 km/h', () => {
  const kmh = speedToKmh(maxSpeedFor(22));
  assert.ok(kmh > 165 && kmh < 185, `got ${kmh}`);
});

test('fever triggers at 100 and lasts FEVER_DURATION', () => {
  const run = createRunState('highway_traffic');
  const triggered = addFever(run, 120);
  assert.equal(triggered, true);
  assert.equal(run.feverTimer, FEVER_DURATION);
  assert.equal(run.fever, 0);
  stepTimers(run, FEVER_DURATION + 0.1);
  assert.equal(run.feverTimer, 0);
});

test('drift mode has a countdown that checkpoints extend', () => {
  const run = createRunState('drift');
  assert.ok(run.timeLeft > 0);
  const t0 = run.timeLeft;
  stepTimers(run, 1);
  assert.ok(Math.abs(run.timeLeft - (t0 - 1)) < 1e-9);
  assert.ok(checkpointEvery('drift') > 0);
  const hw = createRunState('highway_traffic');
  assert.equal(hw.timeLeft, Infinity);
});

test('distance scale matches the speedometer (1 s at X km/h = X/3.6 m)', () => {
  const speed = maxSpeedFor(22);
  const metersPerSec = speed / UNITS_PER_METER;
  assert.ok(Math.abs(metersPerSec - speedToKmh(speed) / 3.6) < 0.01);
});

test('stepLateral: steering assist softens centrifugal drift when hands are off', () => {
  const raw = stepLateral({ x: 0, speedRatio: 1, steer: 0, curve: 5, dt: 0.1, handling: 2.8, drifting: false });
  const assisted = stepLateral({ x: 0, speedRatio: 1, steer: 0, curve: 5, dt: 0.1, handling: 2.8, drifting: false, assist: 0.5 });
  assert.ok(Math.abs(assisted.x) < Math.abs(raw.x) * 0.6);
  const steering = stepLateral({ x: 0, speedRatio: 1, steer: -1, curve: 5, dt: 0.1, handling: 2.8, drifting: false, assist: 0.5 });
  const steeringRaw = stepLateral({ x: 0, speedRatio: 1, steer: -1, curve: 5, dt: 0.1, handling: 2.8, drifting: false });
  assert.equal(steering.x, steeringRaw.x, 'assist only applies with no input');
});
