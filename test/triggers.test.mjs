import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTrigger } from '../src/triggers.mjs';
import { doraFromIndicator, isDoraDiscard } from '../src/dora.mjs';
import { PenaltyEngine } from '../src/penalty.mjs';

test('Dora indicators cover suits, honors, red fives and sanma manzu', () => {
  for (const [indicator, expected] of [['9p','1p'],['4z','1z'],['7z','5z'],['0s','6s']]) assert.equal(doraFromIndicator(indicator), expected);
  assert.equal(doraFromIndicator('1m', 3), '9m'); assert.equal(doraFromIndicator('9m', 3), '1m');
  assert.equal(isDoraDiscard('0p', [], 4), true); assert.equal(isDoraDiscard('5p', ['4p'], 4), true);
  assert.equal(isDoraDiscard('4p', ['4p'], 4), false); assert.equal(doraFromIndicator('8z'), null);
});
test('own Dora discards and calls from own seat are distinguished from other players', () => {
  const base = { me: 1, live: true };
  assert.equal(matchesTrigger('discard-dora', { ...base, type: 'discard', seat: 1, isDora: true }), true);
  assert.equal(matchesTrigger('discard-dora', { ...base, type: 'discard', seat: 2, isDora: true }), false);
  assert.equal(matchesTrigger('tile-pon', { ...base, type: 'meld', kind: 1, seat: 2, fromSeats: [2,2,1] }), true);
  assert.equal(matchesTrigger('tile-pon', { ...base, type: 'meld', kind: 1, seat: 1, fromSeats: [1,1,2] }), false);
  assert.equal(matchesTrigger('tile-pon', { ...base, type: 'kan', seat: 2 }), false, 'ankan/kakan is not a call of our discard');
  for (const [key, kind] of [['tile-chi', 0], ['tile-pon', 1], ['tile-kan', 2]]) {
    assert.equal(matchesTrigger(key, { ...base, type: 'meld', kind, seat: 2, fromSeats: [2,2,1] }), true);
    assert.equal(matchesTrigger(key, { ...base, type: 'meld', kind: (kind + 1) % 3, seat: 2, fromSeats: [2,2,1] }), false);
  }
  assert.equal(matchesTrigger('discard-dora', { ...base, live: false, type: 'discard', seat: 1, isDora: true }), false);
  assert.equal(matchesTrigger('opponent-riichi', { ...base, type: 'riichi' }), false);
  assert.equal(matchesTrigger('noten-draw', { ...base, type: 'exhaustive-draw', readySeats: [] }), false, 'unknown readiness is not noten');
  assert.equal(matchesTrigger('noten-draw', { ...base, type: 'exhaustive-draw', readyKnown: true, readySeats: [] }), true);
});
test('event-specific rules have independent instructions and cannot override the global cap', async () => {
  const channel = delta => ({ mode: 'temporary', delta, durationMs: 1000, waveform: null });
  const messages = [];
  const engine = new PenaltyEngine({ ready: () => true, stop: async () => {}, fire: async () => assert.fail('simulation must not send') }, m => messages.push(m));
  engine.arm({ strategy: 'custom', simulation: true, targetChannel: 'A', maxIntensity: 20, eventRules: {
    'discard-dora': { enabled: true, syncChannels: true, channels: { A: channel(2) } },
    'tile-pon': { enabled: true, syncChannels: true, channels: { A: channel(5) } },
  } });
  const base = { me: 1, live: true, connection: 1, round: '0:0:0' };
  await engine.handle({ ...base, step: 1, type: 'discard', seat: 1, isDora: true });
  await engine.handle({ ...base, step: 2, type: 'meld', kind: 1, seat: 2, fromSeats: [2,2,1] });
  await engine.handle({ ...base, step: 2, type: 'meld', kind: 1, seat: 2, fromSeats: [2,2,1] });
  assert.equal(messages.length, 2); assert.match(messages[0], /Dora.*\+2/); assert.match(messages[1], /碰.*\+5/);
  assert.throws(() => engine.arm({ strategy: 'custom', maxIntensity: 201, targetChannel: 'A', eventRules: {
    'discard-dora': { enabled: true, maxIntensity: 10, syncChannels: true, channels: { A: channel(2) } },
  } }));
});
