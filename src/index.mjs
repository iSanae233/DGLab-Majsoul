import { ProtocolSession } from './protocol.mjs';
import { installCapture } from './capture.mjs';
import { GameBridge } from './bridge.mjs';
import { ShortcutMatcher, shortcutLabel } from './shortcut.mjs';

const recent = [];
let output;
let status;
const operationLog = [];
const VERSION = '0.8.0';
const bridge = new GameBridge(window, __DASHBOARD_ORIGIN__, text => {
  operationLog.push(text);
  if (operationLog.length > 5) operationLog.shift();
  if (status) status.textContent = operationLog.join('\n');
});
bridge.version = VERSION;
installCapture(window, () => new ProtocolSession(), event => {
  const record = { time: new Date().toISOString(), ...event };
  recent.push(record);
  if (recent.length > 100) recent.shift();
  if (output) output.textContent = recent.slice(-10).map(item => JSON.stringify(item)).join('\n');
  bridge.publish(record);
});
bridge.publish({ type: 'script-ready', connection: 0, version: VERSION, time: new Date().toISOString() });
function mount() {
  const host = document.createElement('div');
  host.id = 'dglab-majsoul-widget'; host.dataset.version = VERSION;
  host.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;max-width:380px';
  const shadow = host.attachShadow({ mode: 'open' });
  const details = document.createElement('details');
  details.style.cssText = 'background:#17202b;color:#edf2f7;padding:10px;border-radius:8px;font:12px sans-serif;max-height:60vh;overflow:auto';
  const summary = document.createElement('summary'); summary.textContent = 'DGLab-Majsoul · 事件与惩罚';
  const note = document.createElement('p'); note.textContent = `脚本 ${VERSION} · 控制台：${__DASHBOARD_ORIGIN__}`;
  const connect = document.createElement('button'); connect.textContent = '打开并关联控制台';
  connect.addEventListener('click', () => { try { bridge.connectDashboard(); } catch (error) { status.textContent = error.message; } });
  const matcher = new ShortcutMatcher();
  window.addEventListener('keyup', event => matcher.keyup(event));
  window.addEventListener('blur', () => matcher.reset());
  window.addEventListener('keydown', event => {
    if (matcher.keydown(event, bridge.stopKey)) { event.preventDefault(); bridge.stop(); }
  });
  status = document.createElement('pre'); status.style.whiteSpace = 'pre-wrap'; status.textContent = '等待控制台操作结果';
  const health = document.createElement('p');
  const refreshHealth = () => { bridge.requestLink(); health.textContent = bridge.session && Date.now() - bridge.lastHello <= 90000 ? `控制台已连接 · ${shortcutLabel(bridge.stopKey)} 停止` : '控制台未连接；可点击上方按钮关联'; };
  refreshHealth(); const timer = setInterval(refreshHealth, 3000);
  window.addEventListener('pagehide', () => { clearInterval(timer); bridge.destroy(); });
  output = document.createElement('pre'); output.style.cssText = 'white-space:pre-wrap;word-break:break-all';
  output.textContent = recent.slice(-10).map(item => JSON.stringify(item)).join('\n') || '等待牌局事件…';
  details.append(summary, note, connect, health, status, output); shadow.append(details); document.body.append(host);
}
if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount, { once: true });
