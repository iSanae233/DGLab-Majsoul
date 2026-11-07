import { ProtocolSession } from './protocol.mjs';
import { installCapture } from './capture.mjs';
import { GameBridge } from './bridge.mjs';
import { ShortcutMatcher, shortcutLabel } from './shortcut.mjs';
import { createGameWidget } from './widget.mjs';

const recent = [];
let widget;
const operationLog = [];
const VERSION = '1.0.0';
const recordOperation = text => {
  operationLog.push(text);
  if (operationLog.length > 5) operationLog.shift();
  widget?.setOperations(operationLog);
};
const bridge = new GameBridge(window, __DASHBOARD_ORIGIN__, recordOperation);
bridge.version = VERSION;
installCapture(window, () => new ProtocolSession(), event => {
  const record = { time: new Date().toISOString(), ...event };
  recent.push(record);
  if (recent.length > 100) recent.shift();
  widget?.setEvents(recent);
  bridge.publish(record);
});
bridge.publish({ type: 'script-ready', connection: 0, version: VERSION, time: new Date().toISOString() });
function mount() {
  widget = createGameWidget({ document, version: VERSION, dashboardOrigin: __DASHBOARD_ORIGIN__,
    onConnect: () => { try { bridge.connectDashboard(); } catch (error) { recordOperation(error.message); } },
    onStop: () => recordOperation(bridge.stop() ? '已请求停止联动' : '控制台未连接，停止请求未发送'),
  });
  widget.setEvents(recent); widget.setOperations(operationLog);
  const matcher = new ShortcutMatcher();
  window.addEventListener('keyup', event => matcher.keyup(event));
  window.addEventListener('blur', () => matcher.reset());
  window.addEventListener('keydown', event => {
    if (matcher.keydown(event, bridge.stopKey)) { event.preventDefault(); bridge.stop(); }
  });
  const refreshHealth = () => { bridge.requestLink(); widget.setConnection(!!bridge.session && Date.now() - bridge.lastHello <= 90000, shortcutLabel(bridge.stopKey)); };
  refreshHealth(); const timer = setInterval(refreshHealth, 3000);
  window.addEventListener('pagehide', () => { clearInterval(timer); bridge.destroy(); });
}
if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount, { once: true });
