import test from 'node:test';
import assert from 'node:assert/strict';
import { DglabSocket } from 'dglab-kit';
import { DglabController } from '../src/dglab.mjs';
import { PenaltyEngine } from '../src/penalty.mjs';
import { ProtocolSession, decodeActionData } from '../src/protocol.mjs';
import protobuf from 'protobufjs/light.js';
import schema from '../src/protocol/liqi.json' with { type: 'json' };

test('official SDK generates V4 pairing, finite intensity/pulse tasks and scoped stop', async () => {
  const frames = [];
  const sdk = new DglabSocket();
  const device = { slotId: 'slot-test', name: 'Mock Coyote', type: 'COYOTE_030', slotState: { hasDevice: true, channelA: { intensityMax: 12 } } };
  sdk.setSender(text => {
    const frame = JSON.parse(text); frames.push(frame);
    if (frame.type === 'message' && frame.data.t === 'req') {
      queueMicrotask(() => sdk.handleMessage(JSON.stringify({ type: 'message', clientId: frame.clientId,
        data: { t: 'resp', reqId: frame.data.reqId, result: frame.data.m === 'devices.get' ? { devices: [device] } : {} } })));
    }
  });
  const controller = new DglabController(() => {}, () => {}, () => sdk);
  const connect = controller.connect('wss://relay.example/v4');
  await new Promise(resolve => setImmediate(resolve));
  sdk.handleOpen(); sdk.handleMessage(JSON.stringify({ type: 'hello', clientId: 'controller-test' }));
  const link = await connect;
  assert.equal(new URL(new URL(link).searchParams.get('url')).searchParams.get('tid'), 'controller-test');
  sdk.handleMessage(JSON.stringify({ type: 'client_attached', clientId: 'app-test' }));
  await new Promise(resolve => setImmediate(resolve));
  controller.selection = { clientId: 'app-test', slotId: 'slot-test', channel: 0 };
  assert.equal(controller.ready(), true);
  const root = protobuf.Root.fromJSON(schema);
  const encode = (name, value) => root.lookupType(`lq.${name}`).encode(value).finish();
  const session = new ProtocolSession(); session.me = 1;
  const engine = new PenaltyEngine(controller, () => {});
  engine.arm({ per1000: 2, maxIntensity: 30, durationMs: 5000, simulation: false });
  for (const [name, value, step] of [['ActionNewRound', {}, 0], ['ActionDiscardTile', { seat: 1 }, 1],
    ['ActionHule', { hules: [{ seat: 0 }], delta_scores: [8300, -8300, 0] }, 2]]) {
    const body = encode('ActionPrototype', { name, step, data: decodeActionData(encode(name, value)) });
    const frame = Uint8Array.from([1, ...encode('Wrapper', { name: '.lq.ActionPrototype', data: body })]);
    for (const event of session.feed('in', frame)) await engine.handle({ connection: 1, ...event });
  }
  const operations = frames.filter(frame => frame.data?.m === 'device.op').map(frame => frame.data.data);
  assert.ok(operations.some(op => op.t === 4 && op.v === 12 && op.d === 5000 && op.c === 0 && op.s === 'slot-test'));
  assert.ok(operations.some(op => op.t === 0 && op.d === 5000 && Array.isArray(op.v) && op.v.length));
  await controller.stop();
  assert.ok(frames.some(frame => frame.data?.m === 'device.op.clear' && frame.data.data.s === 'slot-test'));
  assert.ok(frames.some(frame => frame.data?.data?.t === 7 && frame.data.data.v === 0));
  await controller.disconnect();
});
test('relay URL rejects insecure or credential-bearing pairing addresses', async () => {
  const controller = new DglabController(() => {}, () => {});
  for (const url of ['ws://example.com', 'wss://user:pass@example.com', 'wss://example.com?tid=someone']) {
    await assert.rejects(controller.connect(url));
  }
});
