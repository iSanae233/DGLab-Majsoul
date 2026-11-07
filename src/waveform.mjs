import { COYOTE_WAVEFORMS } from 'dglab-kit';

// The V4 SDK consumes one built-in raw frame per tick (normally 100ms).
// Repeat complete waveform cycles; do not assume that sendPulse repeats v.
export function* waveformStream(keys, mode = 'sequence', random = Math.random) {
  if (!Array.isArray(keys) || !keys.length || keys.some(key => !Object.hasOwn(COYOTE_WAVEFORMS, key)) || !['sequence', 'random'].includes(mode)) throw new Error('波形播放列表无效');
  let index = 0;
  while (true) {
    const selected = mode === 'random' ? Math.floor(random() * keys.length) : index++ % keys.length;
    if (!Number.isInteger(selected) || selected < 0 || selected >= keys.length) throw new Error('随机波形选择无效');
    yield* COYOTE_WAVEFORMS[keys[selected]].raw;
  }
}
export function takeFrames(stream, count) {
  if (!Number.isInteger(count) || count < 1 || count > 600) throw new Error('波形帧数量无效');
  return Array.from({ length: count }, () => stream.next().value);
}
