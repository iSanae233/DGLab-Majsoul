import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const origin = 'https://dglab-majsoul.pages.dev';
const module = async file => ({ type: 'ESModule', path: path.resolve(file), contents: await readFile(file, 'utf8') });
const router = await module('relay/router.mjs');
const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [
    { name: 'pages-test', modules: [await module('test/fixtures/pages-worker.mjs'), await module('functions/index.js'), router],
      compatibilityDate: '2026-11-07', bindings: { DASHBOARD_ORIGIN: origin },
      durableObjects: { RELAY_SESSIONS: { className: 'RelaySession', scriptName: 'dglab-majsoul-relay', useSQLite: true } } },
    { name: 'dglab-majsoul-relay', modules: [await module('relay/worker.mjs'), router],
      compatibilityDate: '2026-11-07', bindings: { DASHBOARD_ORIGIN: origin },
      durableObjects: { RELAY_SESSIONS: { className: 'RelaySession', useSQLite: true } } },
  ],
}));
const sockets = [];
async function connect(query = '', customOrigin = origin) {
  const response = await mf.dispatchFetch(`https://relay.test/${query}`, { headers: { Upgrade: 'websocket', Origin: customOrigin } });
  if (response.status !== 101) return { response };
  const ws = response.webSocket; sockets.push(ws);
  const closed = new Promise(resolve => ws.addEventListener('close', resolve, { once: true }));
  const messages = []; const waiters = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const waiter = waiters.find(item => item.match(message));
    if (waiter) { waiters.splice(waiters.indexOf(waiter), 1); clearTimeout(waiter.timer); waiter.resolve(message); }
    else messages.push(message);
  });
  const next = match => {
    const index = messages.findIndex(match);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { match, resolve, timer: setTimeout(() => reject(new Error('relay message timeout')), 5000) }; waiters.push(waiter);
    });
  };
  ws.accept();
  return { response, ws, next, closed };
}
try {
  const normal = await mf.dispatchFetch('https://relay.test/'); assert.equal(await normal.text(), 'static page');
  assert.equal((await connect('', 'https://evil.example')).response.status, 403);
  assert.equal((await connect('?tid=invalid')).response.status, 400);
  const controller = await connect();
  const hello = await controller.next(m => m.type === 'hello');
  const app = await connect(`?tid=${hello.clientId}`);
  const appHello = await app.next(m => m.type === 'hello');
  assert.equal((await controller.next(m => m.type === 'client_attached')).clientId, appHello.clientId);
  assert.equal((await app.next(m => m.type === 'controller_attached')).clientId, hello.clientId);
  controller.ws.send(JSON.stringify({ type: 'message', clientId: appHello.clientId, data: { t: 'req', reqId: 'test', m: 'devices.get' } }));
  assert.equal((await app.next(m => m.type === 'message')).data.m, 'devices.get');
  app.ws.send(JSON.stringify({ type: 'message', data: { t: 'resp', reqId: 'test', result: { devices: [] } } }));
  const response = await controller.next(m => m.type === 'message');
  assert.equal(response.clientId, appHello.clientId); assert.equal(response.data.reqId, 'test');
  controller.ws.send('{"type":"ping"}'); await controller.next(m => m.type === 'pong');
  const other = await connect(); await other.next(m => m.type === 'hello');
  other.ws.send(JSON.stringify({ type: 'message', clientId: appHello.clientId, data: { t: 'req', m: 'devices.get' } }));
  assert.equal((await other.next(m => m.type === 'error')).code, 'client_not_found');
  app.ws.close(1000, 'test');
  assert.equal((await controller.next(m => m.type === 'client_disconnected')).clientId, appHello.clientId);
  const orphan = await connect(`?tid=${crypto.randomUUID()}`);
  assert.equal((await orphan.closed).code, 4001);
  const app2 = await connect(`?tid=${hello.clientId}`); await app2.next(m => m.type === 'hello');
  controller.ws.close(1000, 'controller-test');
  assert.equal((await app2.closed).code, 4000);
  const malformed = await connect(); await malformed.next(m => m.type === 'hello'); malformed.ws.send('not JSON');
  assert.equal((await malformed.closed).code, 1007);
  const oversized = await connect(); await oversized.next(m => m.type === 'hello'); oversized.ws.send(' '.repeat(65537));
  assert.equal((await oversized.closed).code, 1009);
  console.log('PASS Pages root/static fallback, origin checks, Durable Object pairing, bidirectional V4 frames, heartbeat and session isolation');
} finally {
  for (const ws of sockets) { try { ws.close(1000, 'test-finished'); } catch {} }
  await mf.dispose();
}
