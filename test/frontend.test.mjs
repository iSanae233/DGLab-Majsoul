import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { parseHTML } from 'linkedom';

const compiled = await build({ entryPoints: ['web/main.mjs'], bundle: true, write: false, format: 'iife', platform: 'browser' });
function dashboard(storage = new Map()) {
  const { document, window: domWindow } = parseHTML('<html><body></body></html>');
  const listeners = {};
  const scope = { crypto: webcrypto, addEventListener(type, listener) { listeners[type] = listener; }, removeEventListener() {}, open: () => null,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } };
  const Option = function(text, value) { const node = document.createElement('option'); node.textContent = text; node.value = value; return node; };
  vm.runInContext(compiled.outputFiles[0].text, vm.createContext({ window: scope, document, Option, URL, console, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {}, navigator: { clipboard: { writeText: async () => {} } } }));
  const event = (node, type, properties = {}) => {
    const e = new domWindow.Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(properties)) Object.defineProperty(e, key, { value });
    node.dispatchEvent(e);
  };
  const choose = (selector, value) => {
    const node = document.querySelector(selector), options = [...node.querySelectorAll('option')];
    options.forEach(option => { option.selected = false; }); options.find(option => option.value === value).selected = true; event(node, 'change');
  };
  const add = key => { choose('#new-trigger', key); event(document.querySelector('#add-rule'), 'click'); return document.querySelector(`[data-trigger="${key}"]`); };
  return { document, scope, listeners, event, choose, add, storage };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('custom-only rule cards stay visible, preserve edits, delete individually and restore safe preferences', async () => {
  const ui = dashboard(); const { document, event, add } = ui;
  assert.equal(document.querySelector('h2').textContent, '连接设备');
  assert.ok([...document.querySelectorAll('h2')].some(node => node.textContent === '电击惩罚'));
  assert.equal(document.querySelector('#strategy'), null); assert.equal(document.querySelector('#linear-rules'), null);
  assert.equal(document.querySelector('#simulation').checked, true);
  assert.equal(document.querySelectorAll('.event-rule-card').length, 0);
  event(document.querySelector('#arm'), 'click'); await flush();
  assert.match(document.querySelector('#operation-status').textContent, /请先从本页打开雀魂/);
  const chi = add('tile-chi'); chi.querySelector('[data-field=delta]').value = '2'; event(chi.querySelector('[data-field=delta]'), 'input');
  const pon = add('tile-pon'); pon.querySelector('[data-field=delta]').value = '5'; event(pon.querySelector('[data-field=delta]'), 'input');
  assert.equal(document.querySelectorAll('.event-rule-card').length, 2);
  assert.equal(chi.querySelector('[data-field=editor]').hidden, true);
  assert.equal(pon.querySelector('[data-field=editor]').hidden, false);
  assert.equal(chi.querySelector('[data-field=delta]').value, '2');
  document.querySelector('#maximum').value = '201'; event(document.querySelector('#maximum'), 'input');
  assert.equal(document.querySelector('#maximum').value, '200');
  event(chi.querySelector('[data-field=remove]'), 'click');
  assert.equal(document.querySelectorAll('.event-rule-card').length, 1);
  assert.equal(pon.querySelector('[data-field=delta]').value, '5');
  const restored = dashboard(ui.storage).document;
  assert.equal(restored.querySelectorAll('.event-rule-card').length, 1);
  assert.equal(restored.querySelector('[data-trigger=tile-pon] [data-field=delta]').value, '5');
  assert.equal(restored.querySelector('[data-field=editor]').hidden, true, 'saved rule summaries start compact');
  assert.equal(restored.querySelector('#simulation').checked, true);
  assert.equal(restored.querySelector('#operation-status').textContent, '未启用');
  const saved = JSON.parse(ui.storage.get('dglab-majsoul.rules.v1'));
  assert.deepEqual(Object.keys(saved).sort(), ['version','maxIntensity','targetChannel','stopShortcut','eventRules'].sort());
});

test('records simultaneous key chords only after release and renders trusted event simulation', async () => {
  const ui = dashboard(); const { document, event, add, scope, listeners } = ui;
  const input = document.querySelector('#stop-key'); event(input, 'focus');
  event(input, 'keydown', { key: 'g', code: 'KeyG' }); event(input, 'keydown', { key: 'h', code: 'KeyH' });
  assert.match(input.value, /G \+ H.*松开/);
  event(input, 'keyup', { key: 'h', code: 'KeyH' }); event(input, 'keyup', { key: 'g', code: 'KeyG' });
  assert.equal(input.value, 'G + H');
  const card = add('tile-pon'); card.querySelector('[data-field=delta]').value = '3'; event(card.querySelector('[data-field=delta]'), 'input');
  document.querySelector('#maximum').value = '20'; event(document.querySelector('#maximum'), 'input');
  let session; const instance = 'a'.repeat(32);
  const receive = (kind, data = {}) => listeners.message({ source: gameWindow, origin: 'https://game.maj-soul.com', data: { channel: 'dglab-majsoul-v1', session, instance, kind, ...data } });
  const gameWindow = { closed: false, postMessage(message) {
    if (message.kind !== 'hello') return;
    session = message.session; receive('ack');
    receive('event', { sequence: 1, event: { type: 'script-ready', connection: 0, version: '0.7.0', time: new Date().toISOString() } });
  } };
  scope.open = () => gameWindow;
  event(document.querySelector('#open-game'), 'click'); await flush();
  assert.equal(document.querySelector('#event-count').textContent, '1');
  event(document.querySelector('#arm'), 'click'); await flush();
  receive('event', { sequence: 2, event: { type: 'meld', kind: 1, fromSeats: [2,2,1], seat: 2, me: 1, live: true, round: '0:0:0', step: 2, connection: 1, time: new Date().toISOString() } });
  await flush(); assert.match(document.querySelector('#operation-status').textContent, /模拟.*被碰.*\+3/);
  listeners.keydown({ key: 'g', code: 'KeyG' }); listeners.keydown({ key: 'h', code: 'KeyH', preventDefault() {} });
  await flush(); assert.equal(document.querySelector('#operation-status').textContent, '快捷停止：联动已暂停');
});

test('invalid stored settings cannot create rules, exceed the cap or enable output', () => {
  const storage = new Map([['dglab-majsoul.rules.v1', JSON.stringify({ version: 1, maxIntensity: 9999, stopShortcut: 'Ctrl+KeyW',
    eventRules: { 'tile-chi': { enabled: true, syncChannels: true, channels: { A: { mode: 'temporary', delta: 999, durationMs: 1000 }, B: {} } } } })]]);
  const { document } = dashboard(storage);
  assert.equal(document.querySelectorAll('.event-rule-card').length, 0);
  assert.equal(document.querySelector('#maximum').value, '0');
  assert.equal(document.querySelector('#stop-key').value, 'F7');
  assert.equal(document.querySelector('#simulation').checked, true);
  assert.equal(document.querySelector('#operation-status').textContent, '未启用');
});

test('compact summaries show different A/B profiles on two rows regardless of output selection', () => {
  const profile = { mode: 'temporary', delta: 1, durationMs: 5000, waveform: null };
  const storage = new Map([['dglab-majsoul.rules.v1', JSON.stringify({ version: 1, maxIntensity: 30, targetChannel: 'A', stopShortcut: 'F7',
    eventRules: { 'tile-chi': { enabled: true, syncChannels: false, channels: { A: profile, B: { ...profile, delta: -10, durationMs: 2500, waveform: 'BUBBLE' } } } } })]]);
  const ui = dashboard(storage); const { document, event, choose } = ui;
  const card = document.querySelector('[data-trigger=tile-chi]');
  let rows = card.querySelectorAll('.rule-channel-summary');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector('strong').textContent, 'A');
  assert.equal(rows[1].querySelector('strong').textContent, 'B');
  assert.match(rows[0].textContent, /\+1.*5s/); assert.match(rows[1].textContent, /-10.*2.5s.*气泡/);
  event(card.querySelector('[data-field=edit]'), 'click');
  card.querySelector('[data-field=delta-b]').value = '1'; event(card.querySelector('[data-field=delta-b]'), 'input');
  card.querySelector('[data-field=seconds-b]').value = '5'; event(card.querySelector('[data-field=seconds-b]'), 'input');
  choose('[data-trigger=tile-chi] [data-field=waveform-b]', '');
  rows = card.querySelectorAll('.rule-channel-summary');
  assert.equal(rows.length, 1); assert.equal(rows[0].querySelector('strong').textContent, 'A/B');
});

test('deal-in scaling checkbox stays visible in the compact rule without example numbers', () => {
  const { document, event, add } = dashboard();
  const card = add('deal-in');
  card.querySelector('[data-field=delta]').value = '9'; event(card.querySelector('[data-field=delta]'), 'input');
  event(card.querySelector('[data-field=done]'), 'click');
  assert.equal(card.querySelector('[data-field=editor]').hidden, true);
  assert.equal(card.querySelector('[data-field=point-toggle]').hidden, false);
  assert.equal(card.querySelector('[data-field=scale]').checked, true);
  assert.equal(card.querySelector('[data-field=point-toggle]').closest('[data-field=editor]'), null);
  assert.match(card.querySelector('[data-field=preview]').textContent, /每千点 \+9/);
  assert.doesNotMatch(card.querySelector('[data-field=preview]').textContent, /3900|（/);
});
