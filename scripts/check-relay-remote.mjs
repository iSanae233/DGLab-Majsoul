import WebSocket from 'ws';
import assert from 'node:assert/strict';

const address = process.env.RELAY_CHECK_URL || 'wss://dglab-majsoul.pages.dev';
const origin = process.env.RELAY_CHECK_ORIGIN || 'https://dglab-majsoul.pages.dev';
const sockets = [];
function connect(url) {
  const ws = new WebSocket(url, { origin, handshakeTimeout: 10000 }); sockets.push(ws);
  const inbox = [], waiting = [];
  ws.on('message', bytes => {
    const frame = JSON.parse(bytes.toString());
    const waiter = waiting.find(entry => entry.match(frame));
    if (waiter) { waiting.splice(waiting.indexOf(waiter), 1); clearTimeout(waiter.timer); waiter.resolve(frame); }
    else inbox.push(frame);
  });
  ws.on('error', () => { for (const waiter of waiting.splice(0)) { clearTimeout(waiter.timer); waiter.reject(new Error('Remote WebSocket failed')); } });
  const next = match => {
    const index = inbox.findIndex(match);
    if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { match, resolve, reject, timer: setTimeout(() => reject(new Error('Remote relay response timeout')), 10000) }; waiting.push(waiter);
    });
  };
  return { ws, next };
}
try {
  const controller = connect(address);
  const hello = await controller.next(frame => frame.type === 'hello');
  const appUrl = new URL(address); appUrl.searchParams.set('tid', hello.clientId);
  const app = connect(appUrl.href);
  const appHello = await app.next(frame => frame.type === 'hello');
  assert.equal((await controller.next(frame => frame.type === 'client_attached')).clientId, appHello.clientId);
  await app.next(frame => frame.type === 'controller_attached');
  controller.ws.send(JSON.stringify({ type: 'message', clientId: appHello.clientId, data: { t: 'req', reqId: 'remote-check', m: 'devices.get' } }));
  assert.equal((await app.next(frame => frame.type === 'message')).data.reqId, 'remote-check');
  app.ws.send(JSON.stringify({ type: 'message', data: { t: 'resp', reqId: 'remote-check', result: { devices: [] } } }));
  const response = await controller.next(frame => frame.type === 'message');
  assert.equal(response.clientId, appHello.clientId); assert.equal(response.data.reqId, 'remote-check');
  controller.ws.send('{"type":"ping"}'); await controller.next(frame => frame.type === 'pong');
  app.ws.close(1000, 'remote-check');
  await controller.next(frame => frame.type === 'client_disconnected');
  console.log('PASS production WSS hello, mock-App pairing, bidirectional RPC forwarding, heartbeat and disconnect notification (no device commands)');
} finally {
  for (const ws of sockets) { try { ws.close(1000, 'check-finished'); } catch { ws.terminate(); } }
}
