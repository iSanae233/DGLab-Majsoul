import test from 'node:test';
import assert from 'node:assert/strict';
import { penaltyFor, PenaltyEngine } from '../src/penalty.mjs';

const config = { per1000: 2, maxIntensity: 30, durationMs: 5000, simulation: false };
const event = { type: 'deal-in', connection: 1, round: '0:0:0', step: 10, loss: 8300 };
test('linear intensity, fixed duration and ceiling are enforced; invalid values rejected', () => {
  assert.deepEqual(penaltyFor(8300, config), { intensity: 16, durationMs: 5000 });
  assert.equal(penaltyFor(48000, config).intensity, 30);
  assert.equal(penaltyFor(3900, { ...config, per1000: 1 }).intensity, 4);
  assert.equal(penaltyFor(3400, config).intensity, 6, 'round point units before multiplying');
  assert.equal(penaltyFor(3500, { ...config, per1000: 1 }).intensity, 4);
  assert.equal(penaltyFor(100, { ...config, per1000: 0.1 }).intensity, 0);
  for (const loss of [0, -1, NaN, Infinity]) assert.throws(() => penaltyFor(loss, config));
  for (const patch of [{ maxIntensity: 0 }, { maxIntensity: 201 }, { durationMs: 0 }, { durationMs: 10001 }, { per1000: Infinity }]) {
    assert.throws(() => penaltyFor(8000, { ...config, ...patch }));
  }
});
test('simulation never sends commands; live mode deduplicates and errors disarm', async () => {
  let fires = 0; let stops = 0;
  const engine = new PenaltyEngine({ ready: () => true, fire: async () => { fires++; }, stop: async () => { stops++; } }, () => {});
  engine.arm({ ...config, simulation: true }); await engine.handle(event); assert.equal(fires, 0);
  engine.arm(config); await engine.handle({ ...event, step: 11 }); await engine.handle({ ...event, step: 11 });
  assert.equal(fires, 1);
  await engine.handle({ type: 'resync' }); assert.equal(engine.enabled, false); assert.equal(stops, 1);
});
test('no queued or retried punishments; failed command triggers stop', async () => {
  let release; let fires = 0; let stops = 0;
  const engine = new PenaltyEngine({ ready: () => true, fire: () => { fires++; return new Promise((_, reject) => { release = reject; }); }, stop: async () => { stops++; } }, () => {});
  engine.arm(config);
  const first = engine.handle(event);
  await engine.handle({ ...event, step: 11 }); assert.equal(fires, 1);
  release(new Error('timeout')); await first;
  assert.equal(engine.enabled, false); assert.equal(stops, 1);
  await engine.handle({ ...event, step: 12 }); assert.equal(fires, 1);
});
