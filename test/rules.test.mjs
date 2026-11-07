import test from 'node:test';
import assert from 'node:assert/strict';
import { customPlan, describePlan, pointDelta } from '../src/rules.mjs';
import { PenaltyEngine } from '../src/penalty.mjs';

const rule = { mode: 'temporary', delta: 3, durationMs: 5000, waveform: null };
const config = { strategy: 'custom', maxIntensity: 30, targetChannel: 'both', syncChannels: true,
  channels: { A: rule, B: { ...rule, delta: -2 } }, simulation: true };
test('custom instructions support synchronized or independent A/B channels', () => {
  assert.equal(customPlan(config).channels.B.delta, 3);
  const plan = customPlan({ ...config, syncChannels: false });
  assert.equal(plan.channels.B.delta, -2);
  assert.match(describePlan(plan), /A 通道.*\+3.*B 通道.*-2/);
});
test('permanent changes may be immediate; temporary/reset rules have bounded durations', () => {
  assert.equal(customPlan({ ...config, channels: { A: { ...rule, mode: 'permanent', durationMs: 0 } } }).channels.A.durationMs, 0);
  for (const patch of [{ mode: 'temporary', durationMs: 0 }, { mode: 'reset', durationMs: 0 }, { durationMs: 60001 }, { delta: 41 }, { waveform: 'not-a-wave' }]) {
    assert.throws(() => customPlan({ ...config, channels: { A: { ...rule, ...patch } } }));
  }
  assert.throws(() => customPlan({ ...config, channels: { A: { ...rule, delta: 0 } } }));
});
test('custom plans still require explicit arming and simulation never controls a device', async () => {
  const messages = []; let calls = 0;
  const engine = new PenaltyEngine({ ready: () => true, stop: async () => {}, fire: async () => { calls++; } }, message => messages.push(message));
  const event = { type: 'deal-in', loss: 12000, connection: 1, round: '0:0:0', step: 10 };
  await engine.handle(event); assert.equal(messages.length, 0);
  engine.arm(config); await engine.handle(event);
  assert.equal(calls, 0); assert.match(messages[0], /模拟.*A 通道.*强度临时变化/);
});

test('point-size rules round point units before multiplying the rate', async () => {
  assert.equal(pointDelta(1,3900), 4); assert.equal(pointDelta(1,12000), 12);
  assert.equal(pointDelta(-1,3500), -4); assert.equal(pointDelta(1,100), 0);
  assert.equal(pointDelta(9,3900), 36); assert.equal(pointDelta(3,1300), 3); assert.equal(pointDelta(2,3400), 6);
  const logs = [];
  const engine = new PenaltyEngine({ ready: () => true, stop: async () => {}, fire: async () => assert.fail('simulation') }, message => logs.push(message));
  engine.arm({ strategy: 'custom', simulation: true, targetChannel: 'A', maxIntensity: 30, eventRules: {
    'deal-in': { enabled: true, syncChannels: true, scaleByLoss: true, channels: { A: { ...rule, delta: 1 } } },
  } });
  await engine.handle({ type: 'deal-in', connection: 1, round: '0:0:0', step: 1, loss: 3900 });
  await engine.handle({ type: 'deal-in', connection: 1, round: '0:0:1', step: 1, loss: 12000 });
  assert.match(logs[0], /3900.*\+4/); assert.match(logs[1], /12000.*\+12/);
});
