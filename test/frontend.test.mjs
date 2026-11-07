import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { parseHTML } from 'linkedom';

test('dashboard mounts defaults and cannot arm without the game bridge', async () => {
  const { document, window: domWindow } = parseHTML('<html><body></body></html>');
  const listeners = {};
  const scope = { crypto: webcrypto, addEventListener(type, listener) { listeners[type] = listener; }, removeEventListener() {}, open: () => null };
  const Option = function (text, value) {
    const element = document.createElement('option'); element.textContent = text; element.value = value; return element;
  };
  const compiled = await build({ entryPoints: ['web/main.mjs'], bundle: true, write: false, format: 'iife', platform: 'browser' });
  const context = vm.createContext({ window: scope, document, Option, URL, console, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval() {}, navigator: { clipboard: { writeText: async () => {} } } });
  vm.runInContext(compiled.outputFiles[0].text, context);
  assert.equal(document.querySelector('h1').textContent, 'DGLab-Majsoul 控制台');
  assert.equal(document.querySelector('#simulation').checked, true);
  assert.equal(document.querySelector('#rule-enabled').checked, false);
  assert.equal(document.querySelector('#strategy').value, 'custom');
  assert.equal(document.querySelector('#maximum').value, '0');
  assert.equal(document.querySelector('#strength-delta').value, '0');
  assert.equal(document.querySelector('#custom-seconds').value, '5');
  assert.equal(document.querySelector('a').getAttribute('href'), '/userscripts/dglab-majsoul.user.js');
  const arm = [...document.querySelectorAll('button')].find(e => e.textContent === '应用设置并启用');
  arm.dispatchEvent(new domWindow.Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(document.body.textContent.includes('请先从本页打开雀魂并等待脚本连接'));
  assert.equal(document.querySelector('img').hidden, true);
  assert.equal(document.querySelector('#relay-address').value, 'wss://dglab-majsoul.pages.dev');
  assert.equal(document.querySelectorAll('.card').length, 4);
  for (const option of document.querySelector('#strategy').querySelectorAll('option')) option.selected = option.value === 'linear';
  document.querySelector('#rate').value = '2';
  document.querySelector('#maximum').value = '30';
  document.querySelector('#rate').dispatchEvent(new domWindow.Event('input'));
  assert.equal(document.querySelector('#rule-preview').textContent, '临时强度 8 · 5 秒');
  document.querySelector('#stop').dispatchEvent(new domWindow.Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector('#operation-status').textContent, '联动已暂停');
  document.querySelector('#pair-link').value = 'test-only-pairing';
  document.querySelector('#pairing').hidden = false;
  document.querySelector('#relay-address').dispatchEvent(new domWindow.Event('change'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector('#pair-link').value, '');
  assert.equal(document.querySelector('#pairing').hidden, true);
  assert.equal(document.querySelector('#show-pairing').hidden, true);
  const choose = (id, value) => {
    const options = [...document.querySelector(id).querySelectorAll('option')];
    options.forEach(option => { option.selected = false; }); options.find(option => option.value === value).selected = true;
    document.querySelector(id).dispatchEvent(new domWindow.Event('change'));
  };
  choose('#strategy', 'custom');
  document.querySelector('#rule-enabled').checked = true;
  document.querySelector('#strength-delta').value = '2';
  document.querySelector('#strength-delta').dispatchEvent(new domWindow.Event('input'));
  choose('#trigger', 'discard-dora');
  assert.equal(document.querySelector('#strength-delta').value, '0');
  assert.equal(document.querySelector('#rule-enabled').checked, false);
  document.querySelector('#rule-enabled').checked = true;
  document.querySelector('#strength-delta').value = '5';
  document.querySelector('#strength-delta').dispatchEvent(new domWindow.Event('input'));
  choose('#trigger', 'deal-in');
  assert.equal(document.querySelector('#strength-delta').value, '2');
  assert.equal(document.querySelector('#rule-enabled').checked, true);
  document.querySelector('#maximum').value = '201';
  document.querySelector('#maximum').dispatchEvent(new domWindow.Event('input'));
  assert.equal(document.querySelector('#maximum').value, '200');
  document.querySelector('#stop-key').dispatchEvent(new domWindow.Event('focus'));
  const key = new domWindow.Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperties(key, { key: { value: 'g' }, code: { value: 'KeyG' } });
  document.querySelector('#stop-key').dispatchEvent(key);
  assert.equal(document.querySelector('#stop-key').value, 'G');
  const instance = 'a'.repeat(32);
  const gameWindow = { closed: false, postMessage(message) {
    if (message.kind !== 'hello') return;
    listeners.message({ source: gameWindow, origin: 'https://game.maj-soul.com', data: {
      channel: 'dglab-majsoul-v1', kind: 'ack', session: message.session, instance,
    } });
    listeners.message({ source: gameWindow, origin: 'https://game.maj-soul.com', data: {
      channel: 'dglab-majsoul-v1', kind: 'event', session: message.session, instance, sequence: 1,
      event: { type: 'script-ready', connection: 0, version: '0.5.0', time: new Date().toISOString() },
    } });
  } };
  scope.open = () => gameWindow;
  document.querySelector('#open-game').dispatchEvent(new domWindow.Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector('#event-count').textContent, '1');
  assert.match(document.querySelector('#event-list').textContent, /脚本就绪.*0.5.0/);

});
