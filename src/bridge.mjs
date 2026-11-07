export const GAME_URLS = ['https://game.maj-soul.com/1/', 'https://game.mahjongsoul.com/', 'https://mahjongsoul.game.yo-star.com/'];
const CHANNEL = 'dglab-majsoul-v1';
const token = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
export function randomToken(crypto) {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function validEvent(value) {
  if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.connection) || value.connection < 1) return false;
  try { if (JSON.stringify(value).length > 8192) return false; } catch { return false; }
  const types = ['connection-observed', 'connection-closed', 'capture-error', 'protocol-error', 'game-start', 'game-end',
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
    this.lastAck = this.now(); this.onState('等待雀魂脚本连接'); this.tick();
  }
  tick() {
    if (!this.game) return;
    if (this.game.closed || this.now() - this.lastAck > 90000) {
      if (this.connected) this.onState('雀魂连接已中断');
      this.connected = false;
    }
    if (!this.game.closed) this.game.postMessage({ channel: CHANNEL, kind: 'hello', session: this.session }, this.origin);
  }
  receive(event) {
    const data = event.data;
    if (!this.game || event.source !== this.game || event.origin !== this.origin ||
      data?.channel !== CHANNEL || data.session !== this.session || !token(data.instance)) return;
    if (data.kind === 'ack') {
      if (this.instance !== data.instance) {
        this.sequence = 0;
        this.onState(this.instance ? '雀魂已刷新，请重新启用联动' : '雀魂脚本已连接');
        this.instance = data.instance;
      } else if (!this.connected) this.onState('雀魂脚本已连接，请重新启用联动');
      this.connected = true; this.lastAck = this.now();
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
  destroy() { this.scope.removeEventListener('message', this.listener); this.connected = false; }
}

export class GameBridge {
  session = null;
  sequence = 0;
  constructor(scope, trustedOrigin, onStatus, now = () => Date.now()) {
    this.scope = scope; this.origin = trustedOrigin; this.onStatus = onStatus; this.now = now;
    this.instance = randomToken(scope.crypto); this.lastHello = 0;
    this.listener = event => this.receive(event);
    scope.addEventListener('message', this.listener);
  }
  receive(event) {
    const data = event.data;
    if (!this.scope.opener || event.source !== this.scope.opener || event.origin !== this.origin || data?.channel !== CHANNEL || !token(data.session)) return;
    if (data.kind === 'hello') {
      // A different controller session requires a new game page; never silently switch.
      if (this.session && this.session !== data.session) return;
      this.session = data.session; this.lastHello = this.now();
      this.send({ kind: 'ack' });
    } else if (data.kind === 'status' && data.session === this.session && data.instance === this.instance && typeof data.text === 'string') {
      this.onStatus(data.text.slice(0, 500));
    }
  }
  send(message) {
    if (!this.session || this.scope.opener?.closed || this.now() - this.lastHello > 90000) return false;
    this.scope.opener.postMessage({ ...message, channel: CHANNEL, session: this.session, instance: this.instance }, this.origin);
    return true;
  }
  publish(event) { if (validEvent(event)) this.send({ kind: 'event', sequence: ++this.sequence, event }); }
  destroy() { this.scope.removeEventListener('message', this.listener); }
}
