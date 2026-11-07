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
  const device = { slotId: 'slot-test', name: 'Mock Coyote', type: 'COYOTE_030', props: { intensityA: 5, intensityB: 8 },
    slotState: { hasDevice: true, channelA: { intensityMax: 12 }, channelB: { intensityMax: 20 } } };
  sdk.setSender(text => {
    const frame = JSON.parse(text); frames.push(frame);
    if (frame.type === 'message' && frame.data.t === 'req') {
      if (frame.data.data?.t === 7) {
        const current = sdk.getClient(frame.clientId)?.getDevice('slot-test');
        if (current) current.props[frame.data.data.c === 0 ? 'intensityA' : 'intensityB'] = 0;
      }
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
  assert.ok(operations.some(op => op.t === 4 && op.v === 7 && op.d === 5000 && op.c === 0 && op.s === 'slot-test'));
  assert.ok(operations.some(op => op.t === 0 && op.d === 5000 && Array.isArray(op.v) && op.v.length));
  await controller.stop();
  assert.ok(frames.some(frame => frame.data?.m === 'device.op.clear' && frame.data.data.s === 'slot-test'));
  assert.ok(frames.some(frame => frame.data?.data?.t === 7 && frame.data.data.v === 0));
  controller.selection.channel = 'both';
  sdk.getClient('app-test').getDevice('slot-test').props = { intensityA: 5, intensityB: 8 };
  const custom = { strategy: 'custom', maxIntensity: 10, channels: {
    A: { mode: 'permanent', delta: 20, durationMs: 0, waveform: null },
    B: { mode: 'reset', delta: 0, durationMs: 100, waveform: null },
  } };
  await controller.fire(custom);
  assert.ok(frames.some(frame => frame.data?.data?.t === 3 && frame.data.data.c === 0 && frame.data.data.v === 5));
  assert.ok(frames.some(frame => frame.data?.data?.t === 7 && frame.data.data.c === 1 && frame.data.data.v === 0));
  assert.ok(frames.some(frame => frame.data?.data?.t === 3 && frame.data.data.c === 1 && frame.data.data.v === 8));
  await controller.stop();
  assert.ok(frames.some(frame => frame.data?.m === 'device.op.clear' && frame.data.data.c === 1));
  delete sdk.getClient('app-test').getDevice('slot-test').props.intensityB;
  const count = frames.length;
  await assert.rejects(controller.fire(custom), /缺少 B 通道/);
  assert.equal(frames.length, count, 'all channels are validated before sending any command');
  await controller.disconnect();
});
test('relay URL rejects insecure or credential-bearing pairing addresses', async () => {
  const controller = new DglabController(() => {}, () => {});
  for (const url of ['ws://example.com', 'wss://user:pass@example.com', 'wss://example.com?tid=someone']) {
    await assert.rejects(controller.connect(url));
  }
});

test('emergency stop cancels temporary-reset restoration', async () => {
  const device = { type: 'COYOTE_030', props: { intensityA: 8 }, slotState: { hasDevice: true, channelA: { intensityMax: 20 } } };
  let restored = 0;
  const controller = new DglabController(() => {}, () => {});
  controller.sdk = {
    getClient: () => ({ getDevice: () => device }),
    clearOperate: async () => {},
    resetIntensity: async () => { device.props.intensityA = 0; },
    addIntensity: async (_, __, ___, value) => { restored += value; },
  };
  controller.selection = { clientId: 'app', slotId: 'slot', channel: 0 };
  const running = controller.fire({ strategy: 'custom', maxIntensity: 20, channels: { A: { mode: 'reset', delta: 0, durationMs: 1000, waveform: null } } });
  await new Promise(resolve => setImmediate(resolve));
  await controller.stop(); await running;
  assert.equal(restored, 0); assert.equal(device.props.intensityA, 0);
});
