import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { parseHTML } from 'linkedom';

test('dashboard mounts defaults and cannot arm without the game bridge', async () => {
  const { document, window: domWindow } = parseHTML('<html><body></body></html>');
  const scope = { crypto: webcrypto, addEventListener() {}, removeEventListener() {}, open: () => null };
  const Option = function (text, value) {
    const element = document.createElement('option'); element.textContent = text; element.value = value; return element;
  };
  const compiled = await build({ entryPoints: ['web/main.mjs'], bundle: true, write: false, format: 'iife', platform: 'browser' });
  const context = vm.createContext({ window: scope, document, Option, URL, console, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval() {}, navigator: { clipboard: { writeText: async () => {} } } });
  vm.runInContext(compiled.outputFiles[0].text, context);
  assert.equal(document.querySelector('h1').textContent, 'DGLab-Majsoul 控制台');
  assert.equal(document.querySelector('input[type=checkbox]').checked, true);
  assert.deepEqual([...document.querySelectorAll('input[type=number]')].map(e => e.value), ['0', '0', '5000']);
  assert.equal(document.querySelector('a').getAttribute('href'), '/userscripts/dglab-majsoul.user.js');
  const arm = [...document.querySelectorAll('button')].find(e => e.textContent === '应用设置并启用');
  arm.dispatchEvent(new domWindow.Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(document.body.textContent.includes('请先从本页打开雀魂并等待脚本连接'));
  assert.equal(document.querySelector('img').hidden, true);
  assert.equal(document.querySelector('#relay-address').value, 'wss://dglab-majsoul.pages.dev');
  assert.equal(document.querySelectorAll('.card').length, 4);
  document.querySelector('#rate').value = '2';
  document.querySelector('#maximum').value = '30';
  document.querySelector('#rate').dispatchEvent(new domWindow.Event('input'));
  assert.equal(document.querySelector('#rule-preview').textContent, '临时强度 16 · 5 秒');
  document.querySelector('#stop').dispatchEvent(new domWindow.Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector('#operation-status').textContent, '联动已暂停');
});
