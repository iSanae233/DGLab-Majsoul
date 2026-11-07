import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { DashboardBridge, GameBridge, validEvent } from '../src/bridge.mjs';

function setup() {
  let now = 100000;
  const events = [], states = [], statuses = [];
  const dashboard = { crypto: webcrypto, addEventListener() {}, removeEventListener() {} };
  const game = { crypto: webcrypto, addEventListener() {}, removeEventListener() {} };
  const gameWindow = { closed: false, postMessage: data => gm.receive({ source: dashboardWindow, origin: 'https://control.example', data }) };
  const dashboardWindow = { closed: false, postMessage: data => dm.receive({ source: gameWindow, origin: 'https://game.maj-soul.com', data }) };
  game.opener = dashboardWindow;
  dashboard.open = () => gameWindow;
  const dm = new DashboardBridge(dashboard, e => events.push(e), s => states.push(s), () => now);
  const gm = new GameBridge(game, 'https://control.example', s => statuses.push(s), () => now);
  dm.open('https://game.maj-soul.com/1/');
  return { dm, gm, gameWindow, dashboardWindow, events, states, statuses, advance: ms => { now += ms; } };
}
test('cross-origin handshake forwards events and returns operation status', () => {
  const { dm, gm, events, statuses } = setup();
  assert.equal(dm.connected, true);
  gm.publish({ type: 'discard', connection: 1, seat: 1 });
  assert.equal(events[0].type, 'discard');
  assert.equal(events[0].connection, `${gm.instance}:1`);
  dm.status('模拟：失分8000，强度10');
  assert.deepEqual(statuses, ['模拟：失分8000，强度10']);
});
test('wrong origin/source/session, duplicate sequence and unknown events are rejected', () => {
  const { dm, gm, gameWindow, events } = setup();
  const data = { channel: 'dglab-majsoul-v1', kind: 'event', session: dm.session, instance: gm.instance,
    sequence: 1, event: { type: 'discard', connection: 1 } };
  dm.receive({ source: gameWindow, origin: 'https://evil.example', data });
  dm.receive({ source: {}, origin: dm.origin, data });
  dm.receive({ source: gameWindow, origin: dm.origin, data: { ...data, session: 'f'.repeat(32) } });
  assert.equal(events.length, 0);
  dm.receive({ source: gameWindow, origin: dm.origin, data });
  dm.receive({ source: gameWindow, origin: dm.origin, data });
  assert.equal(events.length, 1);
  assert.equal(validEvent({ type: 'device-command', connection: 1 }), false);
  assert.equal(validEvent({ type: 'deal-in', connection: 1, loss: -8000 }), false);
  const cyclic = { connection: 1 }; cyclic.self = cyclic;
  assert.equal(validEvent(cyclic), false);
});
test('game bridge trusts only configured opener and never switches session silently', () => {
  const { gm, dashboardWindow } = setup();
  const original = gm.session;
  gm.receive({ source: dashboardWindow, origin: 'https://preview.control.example', data: { channel: 'dglab-majsoul-v1', kind: 'hello', session: 'f'.repeat(32) } });
  gm.receive({ source: dashboardWindow, origin: 'https://control.example', data: { channel: 'dglab-majsoul-v1', kind: 'hello', session: 'f'.repeat(32) } });
  assert.equal(gm.session, original);
});
test('closed game disconnects and stale deal-in never triggers an operation', () => {
  const { dm, gm, gameWindow, events, states, advance } = setup();
  gm.publish({ type: 'deal-in', connection: 1, me: 1, round: '0:0:0', step: 3, loss: 8000, time: new Date(0).toISOString() });
  assert.equal(events.length, 0);
  assert.ok(states.some(s => s.includes('过期')));
  gameWindow.closed = true; advance(91000); dm.tick(); assert.equal(dm.connected, false);
});
test('unknown game URLs cannot be opened', () => {
  const { dm, gameWindow } = setup(); gameWindow.closed = true;
  assert.throws(() => dm.open('https://evil.example'));
});
