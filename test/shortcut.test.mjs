import test from 'node:test';
import assert from 'node:assert/strict';
import { recordShortcut, shortcutMatches, shortcutLabel, validShortcut, ShortcutRecorder, ShortcutMatcher } from '../src/shortcut.mjs';

test('records player keys and modifier combinations', () => {
  assert.equal(recordShortcut({ key: 'g', code: 'KeyG' }), 'KeyG');
  assert.equal(recordShortcut({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true }), 'Ctrl+Alt+KeyK');
  assert.equal(shortcutLabel('Ctrl+Alt+KeyK'), 'Ctrl + Alt + K');
  assert.equal(recordShortcut({ key: 'Control', code: 'ControlLeft', ctrlKey: true }), null);
  assert.throws(() => recordShortcut({ key: 'w', code: 'KeyW', ctrlKey: true }));
  for (const key of ['F5', 'Ctrl+Ctrl+KeyG', 'Alt+Ctrl+KeyG', '<script>']) assert.equal(validShortcut(key), false);
});
test('plain typing, composition and key repeats never stop the game', () => {
  assert.equal(shortcutMatches({ key: 'g', code: 'KeyG', target: { tagName: 'INPUT' } }, 'KeyG'), false);
  assert.equal(shortcutMatches({ key: 'g', code: 'KeyG', target: { tagName: 'CANVAS' } }, 'KeyG'), true);
  assert.equal(shortcutMatches({ key: 'F7', code: 'F7', target: { tagName: 'INPUT' } }, 'F7'), true);
  assert.equal(shortcutMatches({ key: 'g', code: 'KeyG', repeat: true }, 'KeyG'), false);
  assert.equal(shortcutMatches({ key: 'g', code: 'KeyG', isComposing: true }, 'KeyG'), false);
});

test('multi-key recorder waits for all keys and matcher resets on release or blur', () => {
  const recorder = new ShortcutRecorder();
  assert.equal(recorder.keydown({ key: 'g', code: 'KeyG' }), 'KeyG');
  assert.equal(recorder.keydown({ key: 'h', code: 'KeyH' }), 'KeyG+KeyH');
  assert.equal(recorder.keyup({ key: 'h', code: 'KeyH' }), null);
  assert.equal(recorder.keyup({ key: 'g', code: 'KeyG' }), 'KeyG+KeyH');
  const matcher = new ShortcutMatcher();
  assert.equal(matcher.keydown({ key: 'g', code: 'KeyG' }, 'KeyG+KeyH'), false);
  assert.equal(matcher.keydown({ key: 'h', code: 'KeyH' }, 'KeyG+KeyH'), true);
  assert.equal(matcher.keydown({ key: 'h', code: 'KeyH', repeat: true }, 'KeyG+KeyH'), false);
  matcher.keyup({ key: 'h', code: 'KeyH' }); matcher.reset();
  assert.equal(matcher.keydown({ key: 'h', code: 'KeyH' }, 'KeyG+KeyH'), false);
  assert.equal(validShortcut('KeyG+KeyG'), false);
});

test('modifier-key chords remain intact until every modifier is released', () => {
  const recorder = new ShortcutRecorder();
  recorder.keydown({ key: 'Control', code: 'ControlLeft', ctrlKey: true });
  recorder.keydown({ key: 'Alt', code: 'AltLeft', ctrlKey: true, altKey: true });
  assert.equal(recorder.keydown({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true }), 'Ctrl+Alt+KeyK');
  assert.equal(recorder.keyup({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true }), null);
  assert.equal(recorder.keyup({ key: 'Alt', code: 'AltLeft', ctrlKey: true }), null);
  assert.equal(recorder.keyup({ key: 'Control', code: 'ControlLeft' }), 'Ctrl+Alt+KeyK');
});
