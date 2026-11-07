import { DglabSocket, COYOTE_WAVEFORMS, COYOTE_WAVEFORM } from 'dglab-kit';
import { customPlan } from './rules.mjs';

export class DglabController {
  selection = null;
  sdk = null;
  active = null;
  generation = 0;
  resetWaiters = new Set();
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
    plan = customPlan({ ...plan, targetChannel: channelNames.length === 2 ? 'both' : channelNames[0], syncChannels: false });
    const { clientId, slotId } = this.selection;
    const device = this.sdk.getClient(clientId).getDevice(slotId);
    const prepared = channelNames.map(name => {
      const rule = plan.channels[name], channel = name === 'A' ? 0 : 1;
      const base = device.props?.[`intensity${name}`];
      const appMax = device.slotState?.[`channel${name}`]?.intensityMax;
      if (!Number.isInteger(base) || base < 0 || base > 200 || !Number.isFinite(appMax) || appMax < 0) throw new Error(`缺少 ${name} 通道强度或上限反馈`);
      const target = rule.mode === 'reset' ? 0 : Math.max(0, Math.min(base + rule.delta, plan.maxIntensity, appMax, 200));
      return { ...rule, name, channel, maxIntensity: plan.maxIntensity, delta: Math.floor(target) - base };
    });
    this.active = { clientId, slotId, channels: prepared.map(rule => rule.channel) };
    const generation = ++this.generation;
    const tasks = [];
    for (const rule of prepared) {
      const options = { immediate: true, timeout: rule.durationMs + 5000 };
      if (rule.mode === 'reset') tasks.push(this.temporaryReset({ clientId, slotId, ...rule }, generation));
      else if (rule.delta !== 0) tasks.push(rule.mode === 'permanent' ?
        this.sdk.addIntensity(clientId, slotId, rule.channel, rule.delta, options) :
        this.sdk.setTempIntensity(clientId, slotId, rule.channel, rule.delta, rule.durationMs, options));
      if (rule.waveform && rule.durationMs > 0) tasks.push(this.sdk.sendPulse(clientId, slotId, rule.channel, rule.durationMs, COYOTE_WAVEFORMS[rule.waveform].raw, options));
    }
    if (!tasks.length) { this.active = null; return { skipped: true }; }
    await Promise.all(tasks);
    return { details: prepared.map(rule => ({ channel: rule.name, delta: rule.delta })) };
  }
  async temporaryReset(rule, generation) {
    const sdk = this.sdk;
    await sdk.clearOperate(rule.clientId, { slotId: rule.slotId, channel: rule.channel });
    if (generation !== this.generation || this.sdk !== sdk) return;
    await sdk.resetIntensity(rule.clientId, rule.slotId, rule.channel);
    if (generation !== this.generation || this.sdk !== sdk) return;
    await new Promise(resolve => {
      const waiter = { resolve, timer: null };
      waiter.timer = setTimeout(() => { this.resetWaiters.delete(waiter); resolve(); }, rule.durationMs);
      this.resetWaiters.add(waiter);
    });
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
    if (!target || !this.sdk) return;
    const { clientId, slotId } = target;
    const channels = target.channels || [target.channel];
    if (channels.some(channel => ![0, 1].includes(channel))) throw new Error('invalid-stop-channel');
    const results = await Promise.allSettled(channels.flatMap(channel => [
      this.sdk.clearOperate(clientId, { slotId, channel }),
      this.sdk.resetIntensity(clientId, slotId, channel),
    ]));
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
