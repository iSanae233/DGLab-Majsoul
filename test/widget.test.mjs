import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createGameWidget } from '../src/widget.mjs';

test('game widget starts as one icon and expands retained public records without HTML injection', () => {
  const { document, window } = parseHTML('<html><body></body></html>');
  let connections = 0, stops = 0;
  const widget = createGameWidget({ document, version: 'test', dashboardOrigin: 'https://control.example', onConnect: () => connections++, onStop: () => stops++ });
  const root = widget.host.shadowRoot, button = root.querySelector('.toggle'), panel = root.querySelector('.panel');
  const click = node => node.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(panel.hidden, true); assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.ok(button.querySelector('svg')); assert.equal(root.querySelector('summary'), null);
  widget.setEvents([{ type: 'discard', tile: '<img src=x onerror=alert(1)>' }]);
  widget.setOperations(['模拟：点炮失分 3900，强度 +4']);
  click(button); assert.equal(panel.hidden, false); assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.match(root.querySelector('.events').textContent, /<img/); assert.equal(root.querySelector('.events img'), null);
  assert.match(root.querySelector('.operations').textContent, /3900/);
  click(root.querySelector('.connect')); assert.equal(connections, 1);
  assert.equal(root.querySelector('.stop').disabled, true);
  widget.setConnection(true, 'Ctrl + Alt + K'); click(root.querySelector('.stop')); assert.equal(stops, 1);
  assert.match(root.querySelector('.health').textContent, /Ctrl \+ Alt \+ K/);
  click(root.querySelector('.close')); assert.equal(panel.hidden, true);
  click(button); assert.match(root.querySelector('.operations').textContent, /3900/);
  widget.setEvents(Array.from({ length: 30 }, (_, n) => ({ n })));
  assert.equal(root.querySelector('.count').textContent, '最近 20 条');
});
