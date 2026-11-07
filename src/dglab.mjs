import { DglabSocket, COYOTE_WAVEFORMS, COYOTE_WAVEFORM } from 'dglab-kit';
import { customPlan, pointDelta, isPersistent, isReset } from './rules.mjs';
import { waveformStream, takeFrames } from './waveform.mjs';

export class DglabController {
  selection = null;
  sdk = null;
  active = null;
  generation = 0;
  resetWaiters = new Set();
  pulseLoops = new Set();
  constructor(onDevices, onDisconnected, create = url => new DglabSocket({ url, responseTimeout: 15000 })) {
    this.onDevices = onDevices;
    this.onDisconnected = onDisconnected;
    this.create = create;
  }
  async connect(address) {
    const url = new URL(address);
    if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash) throw new Error('请填写不含查询参数的 wss:// 中继地址');
    await this.disconnect();
    const sdk = this.sdk = this.create(url.href);
    const current = handler => (...args) => { if (this.sdk === sdk) handler(...args); };
    const update = () => {
      if (this.selection && !this.ready()) { this.onDisconnected(); this.selection = null; }
      this.onDevices(sdk.clients.flatMap(client => client.devices
      .filter(device => device.type === 'COYOTE_030' && device.slotState?.hasDevice !== false)
      .map(device => ({ clientId: client.clientId, slotId: device.slotId, name: device.name }))));
    };
    sdk.on('devices', current(update));
    sdk.on('device', current(update));
    sdk.on('client-attached', current(clientId => { sdk.requestDevices(clientId).catch(current(() => this.onDisconnected())); }));
    sdk.on('client-disconnected', current(() => { this.selection = null; update(); this.onDisconnected(); }));
    sdk.on('close', current(() => { this.selection = null; this.onDevices([]); this.onDisconnected(); }));
    sdk.on('error', current(() => this.onDisconnected()));
    let targetId;
    try {
      ({ targetId } = await sdk.connect());
      if (this.sdk !== sdk) throw new Error('connection-cancelled');
    } catch (error) {
      if (this.sdk === sdk) this.sdk = null;
      sdk.destroy();
      throw error;
    }
    url.searchParams.set('tid', targetId);
    return `https://dungeon-lab.cn/s/?v=1&action=socket&url=${encodeURIComponent(url.href)}`;
  }
  ready() {
    const target = this.selection;
    const device = target && this.sdk?.getClient(target.clientId)?.getDevice(target.slotId);
    return !!device && device.type === 'COYOTE_030' && device.slotState?.hasDevice === true;
  }
  async fire(command) {
    if (command.strategy === 'custom') return this.fireCustom(command);
    let { intensity, durationMs } = command;
    if (!this.ready() || ![0, 1].includes(this.selection.channel)) throw new Error('device-unavailable');
    const target = this.active = { ...this.selection };
    const { clientId, slotId, channel } = target;
    const device = this.sdk.getClient(clientId).getDevice(slotId);
    const state = device.slotState;
    const base = device.props?.[channel === 0 ? 'intensityA' : 'intensityB'];
    const appMax = state[channel === 0 ? 'channelA' : 'channelB']?.intensityMax;
    if (!Number.isInteger(base) || base < 0 || base > 200 || !Number.isFinite(appMax) || appMax < 0 || !Number.isFinite(intensity) || intensity < 0 ||
        !Number.isInteger(durationMs) || durationMs < 100 || durationMs > 10000) throw new Error('missing-device-limits');
    intensity = Math.floor(Math.min(intensity, appMax, 200));
    if (intensity <= 0) { this.active = null; return { intensity: 0, durationMs, skipped: true }; }
    // App owns the duration: temporary intensity resets to zero on task completion.
    await Promise.all([
      this.sdk.setTempIntensity(clientId, slotId, channel, intensity - base, durationMs, { timeout: durationMs + 5000, immediate: true }),
      this.sdk.sendPulse(clientId, slotId, channel, durationMs, COYOTE_WAVEFORMS[COYOTE_WAVEFORM.BUBBLE].raw, { timeout: durationMs + 5000, immediate: true }),
    ]);
    return { intensity, durationMs };
  }
  async fireCustom(plan) {
    if (!this.ready()) throw new Error('device-unavailable');
    const channelNames = this.selection.channel === 'both' ? ['A', 'B'] : this.selection.channel === 0 ? ['A'] : this.selection.channel === 1 ? ['B'] : [];
    if (!channelNames.length || Object.keys(plan.channels || {}).sort().join() !== channelNames.sort().join()) throw new Error('channel-mismatch');
    const loss = plan.loss;
    plan = { ...customPlan({ ...plan, targetChannel: channelNames.length === 2 ? 'both' : channelNames[0], syncChannels: false }), loss };
    const { clientId, slotId } = this.selection;
    const prepare = () => channelNames.map(name => {
      const device = this.sdk?.getClient(clientId)?.getDevice(slotId);
      const rule = plan.channels[name], channel = name === 'A' ? 0 : 1;
      const base = device?.props?.[`intensity${name}`];
      const appMax = device?.slotState?.[`channel${name}`]?.intensityMax;
      if (!Number.isInteger(base) || base < 0 || base > 200 || !Number.isFinite(appMax) || appMax < 0) throw new Error(`缺少 ${name} 通道强度或上限反馈`);
      const requested = plan.scaleByLoss && !isReset(rule.mode) ? pointDelta(rule.delta, loss) : rule.delta;
      const target = isReset(rule.mode) ? 0 : Math.max(0, Math.min(rule.action === 'set' ? requested : base + requested, plan.maxIntensity, appMax, 200));
      return { ...rule, name, channel, maxIntensity: plan.maxIntensity, delta: Math.floor(target) - base };
    });
    prepare(); // Reject incomplete channels before cancelling any existing work.
    const generation = ++this.generation;
    await this.cancelPulseLoops();
    if (generation !== this.generation) return { skipped: true };
    // Clearing a previous waveform may wait for a remote acknowledgement.
    // Re-read limits/base afterwards; an App update must not stale the delta.
    const prepared = prepare();
    this.active = { clientId, slotId, channels: prepared.map(rule => rule.channel) };
    const tasks = [];
    for (const rule of prepared) {
      const options = { immediate: true, timeout: rule.durationMs + 5000 };
      const pulse = () => {
        if (!rule.waveforms.length || generation !== this.generation) return Promise.resolve();
        const stream = waveformStream(rule.waveforms, rule.waveformMode);
        return isPersistent(rule.mode) ? this.startPulseLoop({ clientId, slotId, channel: rule.channel, stream }, generation) :
          this.sdk.sendPulse(clientId, slotId, rule.channel, rule.durationMs, takeFrames(stream, Math.ceil(rule.durationMs / 100)), options);
      };
      if (rule.mode === 'reset') tasks.push(this.temporaryReset({ clientId, slotId, ...rule }, generation, pulse));
      else if (rule.mode === 'permanent-reset') tasks.push((async () => {
        await this.sdk.clearOperate(clientId, { slotId, channel: rule.channel });
        if (generation !== this.generation) return;
        await this.sdk.resetIntensity(clientId, slotId, rule.channel);
        if (generation === this.generation) await pulse();
      })());
      else {
        if (rule.delta !== 0) tasks.push(rule.mode === 'permanent' ? this.sdk.addIntensity(clientId, slotId, rule.channel, rule.delta, options) :
          this.sdk.setTempIntensity(clientId, slotId, rule.channel, rule.delta, rule.durationMs, options));
        if (rule.waveforms.length) tasks.push(pulse());
      }
    }
    if (!tasks.length) return { skipped: true };
    await Promise.all(tasks);
    return { details: prepared.map(rule => ({ channel: rule.name, delta: rule.delta })) };
  }
  async cancelPulseLoops() {
    const loops = [...this.pulseLoops]; this.pulseLoops.clear();
    for (const loop of loops) clearTimeout(loop.timer);
    await Promise.all(loops.map(loop => loop.sdk.clearOperate(loop.clientId, { slotId: loop.slotId, channel: loop.channel })));
  }
  async startPulseLoop({ clientId, slotId, channel, stream }, generation) {
    const loop = { clientId, slotId, channel, stream, sdk: this.sdk, timer: null };
    this.pulseLoops.add(loop);
    const current = () => generation === this.generation && this.sdk === loop.sdk && this.pulseLoops.has(loop);
    const schedule = started => {
      if (!current()) return;
      loop.timer = setTimeout(() => {
        if (!current()) return;
        send().catch(async () => {
          if (!current()) return;
          this.onDisconnected();
          await this.stop().catch(() => {});
        });
      }, Math.max(0, 1000 - (Date.now() - started)));
    };
    const send = async () => {
      if (!current()) return;
      if (!this.ready()) throw new Error('device-unavailable');
      const state = loop.sdk.getClient(clientId)?.getDevice(slotId)?.slotState;
      if (state?.[channel === 0 ? 'channelA' : 'channelB']?.isMuted === true) throw new Error('channel-muted');
      const started = Date.now();
      // Every App task is finite. Losing the browser/connection cannot leave
      // an unbounded pulse task running; stop/new rules cancel future chunks.
      await loop.sdk.sendPulse(clientId, slotId, channel, 1000, takeFrames(stream, 10), { immediate: true, timeout: 6000 });
      schedule(started);
    };
    try { await send(); }
    catch (error) { clearTimeout(loop.timer); this.pulseLoops.delete(loop); throw error; }
  }
  async temporaryReset(rule, generation, pulse = () => Promise.resolve()) {
    const sdk = this.sdk;
    await sdk.clearOperate(rule.clientId, { slotId: rule.slotId, channel: rule.channel });
    if (generation !== this.generation || this.sdk !== sdk) return;
    await sdk.resetIntensity(rule.clientId, rule.slotId, rule.channel);
    if (generation !== this.generation || this.sdk !== sdk) return;
    const elapsed = new Promise(resolve => {
      const waiter = { resolve, timer: null };
      waiter.timer = setTimeout(() => { this.resetWaiters.delete(waiter); resolve(); }, rule.durationMs);
      this.resetWaiters.add(waiter);
    });
    await Promise.all([elapsed, pulse()]);
    if (generation !== this.generation || this.sdk !== sdk) return;
    const device = sdk.getClient(rule.clientId)?.getDevice(rule.slotId);
    const base = device?.props?.[`intensity${rule.name}`];
    const limit = device?.slotState?.[`channel${rule.name}`]?.intensityMax;
    // Do not restore after an observed intensity change, mute, or lost feedback.
    if (device?.slotState?.hasDevice !== true || device?.slotState?.[`channel${rule.name}`]?.isMuted === true || base !== 0 || !Number.isFinite(limit) || limit < 0) return;
    const restore = Math.floor(Math.min(-rule.delta, rule.maxIntensity, limit, 200));
    if (restore > 0) await sdk.addIntensity(rule.clientId, rule.slotId, rule.channel, restore, { immediate: true });
  }
  async stop() {
    this.generation++;
    for (const waiter of this.resetWaiters) { clearTimeout(waiter.timer); waiter.resolve(); }
    this.resetWaiters.clear();
    const target = this.active;
    this.active = null;
    const sdk = this.sdk;
    const tasks = [this.cancelPulseLoops()];
    if (target && sdk) {
      const { clientId, slotId } = target;
      const channels = target.channels || [target.channel];
      if (channels.some(channel => ![0, 1].includes(channel))) tasks.push(Promise.reject(new Error('invalid-stop-channel')));
      else tasks.push(...channels.flatMap(channel => [
        sdk.clearOperate(clientId, { slotId, channel }),
        sdk.resetIntensity(clientId, slotId, channel),
      ]));
    }
    // Dispatch resets immediately; neither waveform cancellation nor another
    // channel's clear acknowledgement may delay an emergency zero request.
    const results = await Promise.allSettled(tasks);
    if (results.some(result => result.status === 'rejected')) throw new Error('停止未确认，请在 App 手动停止');
  }
  async disconnect() {
    try { await this.stop(); }
    finally {
      const sdk = this.sdk; this.sdk = null; this.selection = null;
      sdk?.destroy(); this.onDevices([]);
    }
  }
}
