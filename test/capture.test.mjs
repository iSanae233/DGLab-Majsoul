import test from 'node:test';
import assert from 'node:assert/strict';
import { installCapture, isGameSocket, toBytes } from '../src/capture.mjs';

class Socket extends EventTarget {
  static OPEN = 1;
  sent = [];
  constructor(url) { super(); this.url = url; }
  send(data) { this.sent.push(data); }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 10));

test('host filtering rejects lookalike domains and external controller sockets', () => {
  assert.equal(isGameSocket('wss://gateway.maj-soul.com/game-gateway'), true);
  assert.equal(isGameSocket('wss://maj-soul.com.evil.example/'), false);
  assert.equal(isGameSocket('wss://trex.dungeon-lab.cn/v4'), false);
});
test('typed array offset is preserved and buffer snapshot is independent', async () => {
  const source = new Uint8Array([1, 2, 3, 4]);
  const result = toBytes(source.subarray(1, 3)); source[1] = 9;
  assert.deepEqual([...await result], [2, 3]);
});
test('native constants/prototype and listeners remain intact; each frame captured once', async () => {
  const scope = { WebSocket: Socket }; const seen = [];
  const restore = installCapture(scope, () => ({ feed: (dir, bytes) => [{ type: dir, value: bytes[0] }] }), e => seen.push(e));
  assert.equal(scope.WebSocket.OPEN, 1);
  const ws = new scope.WebSocket('wss://gateway.maj-soul.com/game-gateway');
  assert.equal(ws instanceof Socket, true);
  assert.equal(ws instanceof scope.WebSocket, true);
  let calls = 0; const listener = () => calls++;
  ws.addEventListener('message', listener); ws.removeEventListener('message', listener);
  ws.addEventListener('message', () => calls++);
  const data = new Uint8Array([8]); ws.send(data);
  ws.dispatchEvent(new MessageEvent('message', { data: new Blob([new Uint8Array([9])]) }));
  ws.dispatchEvent(new MessageEvent('message', { data: new Uint8Array([10]).buffer }));
  await flush();
  assert.equal(calls, 2);
  assert.equal(ws.sent[0], data);
  assert.deepEqual(seen.filter(e => ['in', 'out'].includes(e.type)).map(e => [e.type, e.value]), [['out', 8], ['in', 9], ['in', 10]]);
  restore(); assert.equal(scope.WebSocket, Socket);
});
test('decoder exceptions do not interrupt game listeners or later captures', async () => {
  const scope = { WebSocket: Socket }; const seen = [];
  installCapture(scope, () => ({ feed: () => { throw new Error('secret-payload'); } }), e => seen.push(e));
  const ws = new scope.WebSocket('wss://gateway.maj-soul.com/');
  let calls = 0; ws.addEventListener('message', () => calls++);
  ws.dispatchEvent(new MessageEvent('message', { data: new Uint8Array([1]) }));
  ws.dispatchEvent(new MessageEvent('message', { data: new Uint8Array([2]) }));
  await flush();
  assert.equal(calls, 2); assert.equal(seen.filter(e => e.type === 'capture-error').length, 2);
  assert.equal(JSON.stringify(seen).includes('secret-payload'), false);
});
