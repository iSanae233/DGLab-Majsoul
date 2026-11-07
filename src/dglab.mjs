import { DglabSocket, COYOTE_WAVEFORMS, COYOTE_WAVEFORM } from 'dglab-kit';

export class DglabController {
  selection = null;
  sdk = null;
  active = null;
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
  async fire({ intensity, durationMs }) {
    if (!this.ready() || ![0, 1].includes(this.selection.channel)) throw new Error('device-unavailable');
    const target = this.active = { ...this.selection };
    const { clientId, slotId, channel } = target;
    const state = this.sdk.getClient(clientId).getDevice(slotId).slotState;
    const appMax = state[channel === 0 ? 'channelA' : 'channelB']?.intensityMax;
    if (!Number.isFinite(appMax) || appMax < 0 || !Number.isFinite(intensity) || intensity < 0 ||
        !Number.isInteger(durationMs) || durationMs < 100 || durationMs > 10000) throw new Error('missing-device-limits');
    intensity = Math.floor(Math.min(intensity, appMax, 200));
    if (intensity <= 0) { this.active = null; return { intensity: 0, durationMs, skipped: true }; }
    // App owns the duration: temporary intensity resets to zero on task completion.
    await Promise.all([
      this.sdk.setTempIntensity(clientId, slotId, channel, intensity, durationMs, { timeout: durationMs + 5000, immediate: true }),
      this.sdk.sendPulse(clientId, slotId, channel, durationMs, COYOTE_WAVEFORMS[COYOTE_WAVEFORM.BUBBLE].raw, { timeout: durationMs + 5000, immediate: true }),
    ]);
    return { intensity, durationMs };
  }
  async stop() {
    const target = this.active;
    this.active = null;
    if (!target || !this.sdk) return;
    const { clientId, slotId, channel } = target;
    const results = await Promise.allSettled([
      this.sdk.clearOperate(clientId, { slotId, channel }),
      this.sdk.resetIntensity(clientId, slotId, channel),
    ]);
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
