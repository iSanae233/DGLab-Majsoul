import test from 'node:test';
import assert from 'node:assert/strict';
import { COYOTE_WAVEFORMS as waves } from 'dglab-kit';
import { waveformStream, takeFrames } from '../src/waveform.mjs';

test('waveform cycles honor selected order and fill the complete finite duration', () => {
  const ordered = [...waves.BUBBLE.raw, ...waves.EXTRUSTION.raw];
  assert.deepEqual(takeFrames(waveformStream(['BUBBLE', 'EXTRUSTION']), 10), Array.from({ length: 10 }, (_, n) => ordered[n % ordered.length]));
});
test('random mode selects full waveform cycles; invalid playlists are rejected', () => {
  const rng = [0.9, 0.1], stream = waveformStream(['BUBBLE', 'EXTRUSTION'], 'random', () => rng.shift());
  assert.deepEqual(takeFrames(stream, 4), [...waves.EXTRUSTION.raw, ...waves.BUBBLE.raw]);
  assert.throws(() => waveformStream(['INVALID']).next());
  assert.throws(() => waveformStream([], 'random').next());
  assert.throws(() => takeFrames(waveformStream(['BUBBLE']), 601));
});
