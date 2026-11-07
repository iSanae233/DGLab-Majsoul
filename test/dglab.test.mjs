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
  controller.selection.channel = 0;
  const reported = sdk.getClient('app-test').getDevice('slot-test'); reported.props.intensityA = 5; reported.slotState.channelA.intensityMax = 50;
  await controller.fire({ strategy: 'custom', maxIntensity: 30, scaleByLoss: true, loss: 3900, channels: { A: { mode: 'temporary', delta: 1, durationMs: 100, waveform: null } } });
  const scaled = frames.filter(frame => frame.data?.data?.t === 4).at(-1).data.data;
  assert.equal(scaled.v, 4); assert.equal(scaled.c, 0);
  await controller.fire({ strategy: 'custom', maxIntensity: 30, scaleByLoss: true, loss: 1300, channels: { A: { mode: 'temporary', delta: 3, durationMs: 100, waveform: null } } });
  assert.equal(frames.filter(frame => frame.data?.data?.t === 4).at(-1).data.data.v, 3, '1300 points becomes one unit before multiplying by 3');
  controller.selection.channel = 'both';
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

function controllerFixture() {
  const calls = [];
  const device = { type:'COYOTE_030', props:{intensityA:5,intensityB:8}, slotState:{hasDevice:true,channelA:{intensityMax:50},channelB:{intensityMax:50}} };
  const controller = new DglabController(() => {}, () => {});
  controller.sdk = {
    getClient: () => ({getDevice: () => device}),
    clearOperate: async (...args) => { calls.push(['clear',...args]); },
    resetIntensity: async (_,__,channel) => { calls.push(['reset',channel]); device.props[channel===0?'intensityA':'intensityB']=0; },
    addIntensity: async (_,__,channel,value) => { calls.push(['add',channel,value]); device.props[channel===0?'intensityA':'intensityB']+=value; },
    setTempIntensity: async (_,__,channel,value,duration) => { calls.push(['temp',channel,value,duration]); },
    sendPulse: async (_,__,channel,duration,frames) => { calls.push(['pulse',channel,duration,frames]); },
  };
  controller.selection={clientId:'app',slotId:'slot',channel:0};
  const fire = (rule, extra={}) => controller.fire({strategy:'custom',maxIntensity:20,channels:{A:{mode:'permanent',action:'set',delta:0,durationMs:0,waveforms:[],...rule}},...extra});
  return {controller,device,calls,fire};
}

test('absolute targets use observed base, score units and both intensity caps; reset persists without a timer', async () => {
  const {controller,device,calls,fire}=controllerFixture();
  await fire({delta:30}); assert.deepEqual(calls.at(-1),['add',0,15]); assert.equal(device.props.intensityA,20);
  await fire({delta:2}); assert.deepEqual(calls.at(-1),['add',0,-18]);
  await fire({mode:'temporary',delta:0,durationMs:100}); assert.deepEqual(calls.at(-1),['temp',0,-2,100]);
  await fire({mode:'permanent-reset'}); assert.deepEqual(calls.at(-1),['reset',0]); assert.equal(controller.resetWaiters.size,0);
  await fire({delta:3},{scaleByLoss:true,loss:3900}); assert.deepEqual(calls.at(-1),['add',0,12]);
  device.slotState.channelA.intensityMax=10;
  await fire({delta:200}); assert.equal(device.props.intensityA,10);
  await controller.stop();
});

test('finite playlists fill the task and persistent playback is replaced and cancelled by stop', async () => {
  const {controller,calls,fire}=controllerFixture();
  await fire({mode:'temporary',action:'add',delta:0,durationMs:500,waveforms:['BUBBLE','EXTRUSTION'],waveformMode:'sequence'});
  assert.equal(calls.at(-1)[0],'pulse'); assert.equal(calls.at(-1)[3].length,5);
  await fire({action:'add',delta:0,waveforms:['BUBBLE','EXTRUSTION'],waveformMode:'sequence'});
  const before=calls.filter(call=>call[0]==='pulse').length;
  assert.equal(controller.pulseLoops.size,1);
  await fire({delta:8});
  assert.equal(controller.pulseLoops.size,0);
  await new Promise(resolve=>setTimeout(resolve,1050));
  assert.equal(calls.filter(call=>call[0]==='pulse').length,before,'replaced loop never sends again');
  await fire({action:'add',delta:0,waveforms:['BUBBLE'],waveformMode:'random'});
  await controller.stop(); const stopped=calls.length;
  await new Promise(resolve=>setTimeout(resolve,1050));
  assert.equal(calls.length,stopped,'stop cancels all future pulse chunks');
  assert.equal(controller.pulseLoops.size,0);
});

test('late persistent-pulse acknowledgement cannot restart playback after stop', async () => {
  const {controller,calls,fire}=controllerFixture();
  let acknowledge;
  controller.sdk.sendPulse=()=>new Promise(resolve=>{acknowledge=resolve;});
  const pending=fire({action:'add',delta:0,waveforms:['BUBBLE']});
  await new Promise(resolve=>setImmediate(resolve));
  await controller.stop(); acknowledge(); await pending;
  const stopped=calls.length;
  await new Promise(resolve=>setTimeout(resolve,1050));
  assert.equal(calls.length,stopped); assert.equal(controller.pulseLoops.size,0); assert.equal(controller.active,null);
});

test('relative changes clamp the resulting intensity rather than sending an unsafe offset', async () => {
  const {controller,device,calls,fire}=controllerFixture();
  await fire({action:'change',delta:200}); assert.equal(device.props.intensityA,20); assert.deepEqual(calls.at(-1),['add',0,15]);
  await fire({action:'change',delta:-200}); assert.equal(device.props.intensityA,0); assert.deepEqual(calls.at(-1),['add',0,-20]);
  await controller.stop();
});

test('persistent waveform failure stops the device and does not retry', async () => {
  const {controller,device,fire}=controllerFixture();
  let pulses=0, disconnected=0;
  controller.onDisconnected=()=>{disconnected++;};
  controller.sdk.sendPulse=async()=>{if(++pulses>1) throw new Error('lost-response');};
  await fire({action:'change',delta:0,waveforms:['BUBBLE']});
  await new Promise(resolve=>setTimeout(resolve,1150));
  assert.equal(disconnected,1); assert.equal(controller.pulseLoops.size,0); assert.equal(device.props.intensityA,0);
  await new Promise(resolve=>setTimeout(resolve,1050)); assert.equal(pulses,2);
});

test('a no-op target keeps the stop scope of an earlier persistent intensity', async () => {
  const {controller,device,fire}=controllerFixture();
  await fire({delta:12}); const result=await fire({delta:12}); assert.equal(result.skipped,true);
  await controller.stop(); assert.equal(device.props.intensityA,0);
});

test('emergency zero is sent before a stalled persistent-pulse cancellation acknowledges', async () => {
  const {controller,device,fire}=controllerFixture();
  await fire({action:'change',delta:0,waveforms:['BUBBLE']});
  let acknowledge, clears=0;
  controller.sdk.clearOperate=()=>++clears===1?new Promise(resolve=>{acknowledge=resolve;}):Promise.resolve();
  const stopping=controller.stop();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(device.props.intensityA,0,'resetIntensity must not wait for clearOperate acknowledgement');
  assert.equal(controller.pulseLoops.size,0);
  acknowledge(); await stopping;
});

test('absolute target is recomputed from feedback received while cancelling an old pulse', async () => {
  const {controller,device,calls,fire}=controllerFixture();
  await fire({action:'change',delta:0,waveforms:['BUBBLE']});
  controller.sdk.clearOperate=async()=>{device.props.intensityA=50;};
  await fire({action:'set',delta:20});
  assert.deepEqual(calls.at(-1),['add',0,-30]);
  assert.equal(device.props.intensityA,20);
  await controller.stop();
});

test('background failure pauses its consumer before stalled cleanup responses', async () => {
  const {controller,fire}=controllerFixture();
  let enabled=true, attempts=0, clearCalls=0; const pending=[];
  controller.onDisconnected=()=>{enabled=false;};
  controller.sdk.sendPulse=async()=>{if(++attempts===2) throw new Error('background-failure');};
  controller.sdk.clearOperate=()=>{clearCalls++;return new Promise(resolve=>pending.push(resolve));};
  await fire({action:'change',delta:0,waveforms:['BUBBLE']});
  await new Promise(resolve=>setTimeout(resolve,1150));
  assert.ok(clearCalls>0); assert.equal(enabled,false,'the engine notification is not blocked on cleanup');
  assert.equal(controller.pulseLoops.size,0);
  for(const resolve of pending) resolve();
  await new Promise(resolve=>setImmediate(resolve));
});
