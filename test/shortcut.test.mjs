import test from 'node:test';
import assert from 'node:assert/strict';
import { recordShortcut, shortcutMatches, shortcutLabel, validShortcut } from '../src/shortcut.mjs';

test('records player keys and modifier combinations', () => {
  assert.equal(recordShortcut({ key: 'g', code: 'KeyG' }), 'KeyG');
  assert.equal(recordShortcut({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true }), 'Ctrl+Alt+KeyK');
  assert.equal(shortcutLabel('Ctrl+Alt+KeyK'), 'Ctrl+Alt+K');
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
