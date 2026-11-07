export const GAME_URLS = ['https://game.maj-soul.com/1/', 'https://game.mahjongsoul.com/', 'https://mahjongsoul.game.yo-star.com/'];
const CHANNEL = 'dglab-majsoul-v1';
const token = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
export function randomToken(crypto) {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function validEvent(value) {
  if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.connection) ||
    (value.connection < 1 && !(value.type === 'script-ready' && value.connection === 0))) return false;
  try { if (JSON.stringify(value).length > 8192) return false; } catch { return false; }
  const types = ['script-ready', 'connection-observed', 'connection-closed', 'capture-error', 'protocol-error', 'game-start', 'game-end',
    'resync', 'round-start', 'discard', 'riichi', 'meld', 'kan', 'win', 'exhaustive-draw', 'abortive-draw', 'north-extraction', 'deal-in'];
  if (!types.includes(value.type)) return false;
  if (value.type === 'deal-in') return Number.isSafeInteger(value.loss) && value.loss > 0 && value.loss <= 10000000 &&
    Number.isSafeInteger(value.step) && value.step >= 0 && typeof value.round === 'string' && /^\d+:\d+:\d+$/.test(value.round) &&
    Number.isInteger(value.me) && value.me >= 0 && value.me <= 3;
  return true;
}

export class DashboardBridge {
  connected = false;
  game = null;
  origin = null;
  session = null;
  instance = null;
  sequence = 0;
  lastAck = 0;
  constructor(scope, onEvent, onState, now = () => Date.now()) {
    this.scope = scope; this.onEvent = onEvent; this.onState = onState; this.now = now;
    this.listener = event => this.receive(event);
    scope.addEventListener('message', this.listener);
  }
  open(url) {
    if (!GAME_URLS.includes(url)) throw new Error('请选择支持的雀魂服务器');
    if (this.game && !this.game.closed) throw new Error('已有雀魂窗口，请先关闭该窗口再重新连接');
    this.game = this.scope.open(url, '_blank');
    if (!this.game) throw new Error('浏览器阻止了弹窗，请允许本页打开雀魂');
    this.origin = new URL(url).origin;
    this.session = randomToken(this.scope.crypto);
    this.instance = null; this.sequence = 0; this.connected = false;
    this.waitingWarning = false;
    this.lastAck = this.now(); this.onState('等待雀魂脚本连接'); this.tick();
  }
  tick() {
    if (!this.game) return;
    if (!this.connected && !this.instance && this.now() - this.lastAck > 10000 && !this.waitingWarning) {
      this.waitingWarning = true;
      this.onState('尚未检测到雀魂脚本，请确认已安装并启用最新版本，再刷新游戏');
    }
    if (this.game.closed || this.now() - this.lastAck > 90000) {
      if (this.connected) this.onState('雀魂连接已中断');
      this.connected = false;
    }
    if (!this.game.closed) this.game.postMessage({ channel: CHANNEL, kind: 'hello', session: this.session }, this.origin);
  }
  receive(event) {
    const data = event.data;
    if (this.scope.opener && data?.channel === CHANNEL && data.kind === 'link-request' && token(data.instance) &&
        event.source === this.scope.opener && GAME_URLS.some(url => new URL(url).origin === event.origin) &&
        (!this.game || this.game.closed)) {
      this.game = event.source; this.origin = event.origin;
      this.session = randomToken(this.scope.crypto); this.instance = null; this.sequence = 0;
      this.connected = false; this.lastAck = this.now();
      this.waitingWarning = false;
      this.onState('正在关联已打开的雀魂'); this.tick(); return;
    }
    if (!this.game || event.source !== this.game || event.origin !== this.origin ||
      data?.channel !== CHANNEL || data.session !== this.session || !token(data.instance)) return;
    if (data.kind === 'ack') {
      if (this.instance !== data.instance) {
        this.sequence = 0;
        this.onState(this.instance ? '雀魂已刷新，请重新启用联动' : '雀魂脚本已连接');
        this.instance = data.instance;
      } else if (!this.connected) this.onState('雀魂脚本已连接，请重新启用联动');
      this.connected = true; this.lastAck = this.now();
      this.waitingWarning = false;
      if (this.stopKey) this.configureStopKey(this.stopKey);
    } else if (data.kind === 'stop' && this.connected && data.instance === this.instance) {
      this.onStop?.();
    } else if (data.kind === 'event' && this.connected && data.instance === this.instance &&
      Number.isSafeInteger(data.sequence) && data.sequence > this.sequence && validEvent(data.event)) {
      this.sequence = data.sequence;
      if (data.event.type === 'deal-in' && (!Number.isFinite(Date.parse(data.event.time)) ||
        Math.abs(this.now() - Date.parse(data.event.time)) > 10000)) {
        this.onState('点炮事件已过期，请重新启用联动'); return;
      }
      this.onEvent({ ...data.event, connection: `${this.instance}:${data.event.connection}` });
    }
  }
  status(text) {
    if (this.connected) this.game.postMessage({ channel: CHANNEL, kind: 'status', session: this.session,
      instance: this.instance, text: String(text).slice(0, 500) }, this.origin);
  }
  configureStopKey(key) {
    if (!STOP_KEYS.includes(key)) return;
    this.stopKey = key;
    if (this.connected) this.game.postMessage({ channel: CHANNEL, kind: 'settings', session: this.session,
      instance: this.instance, stopKey: key }, this.origin);
  }
  destroy() { this.scope.removeEventListener('message', this.listener); this.connected = false; }
}

export const STOP_KEYS = ['F7', 'F8', 'F9', 'F10', 'Escape'];
export class GameBridge {
  session = null;
  sequence = 0;
  pending = [];
  controller = null;
  stopKey = 'F7';
  constructor(scope, trustedOrigin, onStatus, now = () => Date.now()) {
    this.scope = scope; this.origin = trustedOrigin; this.onStatus = onStatus; this.now = now;
    this.instance = randomToken(scope.crypto); this.lastHello = 0;
    this.listener = event => this.receive(event);
    scope.addEventListener('message', this.listener);
  }
  receive(event) {
    const data = event.data;
    const controller = this.controller || this.scope.opener;
    if (!controller || event.source !== controller || event.origin !== this.origin || data?.channel !== CHANNEL || !token(data.session)) return;
    if (data.kind === 'hello') {
      // A different controller session requires a new game page; never silently switch.
      if (this.session && this.session !== data.session) return;
      const fresh = this.session !== data.session;
      this.session = data.session; this.lastHello = this.now();
      this.send({ kind: 'ack' });
      if (fresh && this.version && !this.pending.some(event => event.type === 'script-ready')) {
        this.publish({ type: 'script-ready', connection: 0, version: this.version, time: new Date(this.now()).toISOString() });
      }
      for (const pending of this.pending.splice(0)) this.publish(pending);
    } else if (data.kind === 'status' && data.session === this.session && data.instance === this.instance && typeof data.text === 'string') {
      this.onStatus(data.text.slice(0, 500));
    } else if (data.kind === 'settings' && data.session === this.session && data.instance === this.instance && STOP_KEYS.includes(data.stopKey)) {
      this.stopKey = data.stopKey;
    }
  }
  send(message) {
    const controller = this.controller || this.scope.opener;
    if (!controller || !this.session || controller.closed || this.now() - this.lastHello > 90000) return false;
    controller.postMessage({ ...message, channel: CHANNEL, session: this.session, instance: this.instance }, this.origin);
    return true;
  }
  publish(event) {
    if (!validEvent(event)) return;
    if (!this.send({ kind: 'event', sequence: ++this.sequence, event }) && ['script-ready', 'connection-observed', 'capture-error'].includes(event.type)) {
      // Buffer diagnostics only, never historical deal-ins or gameplay triggers.
      this.pending.push(event); if (this.pending.length > 20) this.pending.shift();
    }
  }
  connectDashboard() {
    this.stop();
    const controller = this.scope.open(`${this.origin}/link/`, '_blank');
    if (!controller) throw new Error('浏览器阻止了控制台弹窗，请允许后重试');
    this.controller = controller; this.session = null;
    this.requestLink();
  }
  requestLink() {
    if (this.controller && !this.controller.closed && !this.session) this.controller.postMessage({
      channel: CHANNEL, kind: 'link-request', instance: this.instance,
    }, this.origin);
  }
  stop() { this.send({ kind: 'stop' }); }
  destroy() { this.scope.removeEventListener('message', this.listener); }
}
