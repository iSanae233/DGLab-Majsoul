import qrcode from 'qrcode-generator';
import { DglabController } from '../src/dglab.mjs';
import { PenaltyEngine } from '../src/penalty.mjs';
import { DashboardBridge, GAME_URLS } from '../src/bridge.mjs';

const recent = [];
let output;
let total = 0;
let status;
let deviceSelect;
let devices = [];
const log = message => { if (status) status.textContent = message; bridge.status(message); };
const controller = new DglabController(list => {
  devices = list;
  if (!deviceSelect) return;
  deviceSelect.replaceChildren(new Option('选择设备', ''));
  list.forEach((device, i) => deviceSelect.append(new Option(`${device.name} (${i + 1})`, String(i))));
}, () => { engine.stop().catch(() => log('连接中断；请在 App 确认停止')); log('连接已断开或设备不可用，请重新启用'); });
const engine = new PenaltyEngine(controller, log);
const bridge = new DashboardBridge(window, event => {
  const record = { time: new Date().toISOString(), ...event };
  total++;
  recent.push(record);
  if (recent.length > 100) recent.shift();
  if (output) output.textContent = recent.slice(-12).map(item => JSON.stringify(item)).join('\n');
  engine.handle(record).catch(() => log('停止未确认，请在 App 手动停止'));
}, message => {
  engine.stop().then(() => log(message)).catch(() => log('停止未确认，请在 App 手动停止'));
  if (connectionStatus) connectionStatus.textContent = message;
});
let connectionStatus;
const heartbeat = setInterval(() => bridge.tick(), 3000);

function mount() {
  const host = document.createElement('div');
  host.className = 'console';
  const shadow = host;
  const details = document.createElement('section'); details.className = 'panel';

  const summary = document.createElement('h1');
  summary.textContent = 'DGLab-Majsoul 控制台';
  const note = document.createElement('p');
  note.textContent = '默认模拟。按结算失分换算临时强度，任务结束临时强度归零。真实设备输出尚待验证。';
  connectionStatus = document.createElement('p'); connectionStatus.textContent = '请从这里打开雀魂以建立连接';
  const server = document.createElement('select'); server.setAttribute('aria-label', '雀魂服务器');
  GAME_URLS.forEach((url, index) => server.append(new Option(['繁中服', '日服', '国际服'][index], url)));
  const openGame = document.createElement('button'); openGame.textContent = '打开雀魂并连接脚本';
  openGame.addEventListener('click', () => { try { bridge.open(server.value); } catch (error) { log(error.message); } });
  const download = document.createElement('a'); download.href = '/userscripts/dglab-majsoul.user.js'; download.textContent = '安装 / 更新 Tampermonkey 脚本';
  output = document.createElement('pre');
  output.style.cssText = 'max-height:260px;overflow:auto;white-space:pre-wrap;word-break:break-all';
  output.textContent = recent.slice(-12).map(item => JSON.stringify(item)).join('\n') || '等待牌局 WebSocket…';
  const copy = document.createElement('button');
  copy.textContent = '复制最近 100 条事件';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ version: '0.3.0', total, events: recent }, null, 2));
      copy.textContent = '已复制';
    } catch { copy.textContent = '复制失败，请允许剪贴板访问'; }
  });
  status = document.createElement('p'); status.textContent = '未启用';
  const address = document.createElement('input'); address.value = 'wss://trex.dungeon-lab.cn/v4';
  address.setAttribute('aria-label', 'V4 中继地址'); address.style.width = '100%';
  const pair = document.createElement('button'); pair.textContent = '连接并生成配对二维码';
  const qrImage = document.createElement('img'); qrImage.alt = 'App 配对二维码'; qrImage.hidden = true;
  const pairText = document.createElement('textarea'); pairText.readOnly = true; pairText.hidden = true;
  pairText.setAttribute('aria-label', '配对链接（勿公开）'); pairText.style.width = '100%';
  pair.addEventListener('click', async () => {
    pair.disabled = true;
    try {
      await engine.stop();
      const link = await controller.connect(address.value);
      const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
      qrImage.src = qr.createDataURL(3); qrImage.hidden = false;
      pairText.value = link; pairText.hidden = false;
      log('使用 DG-LAB 4 App 扫码，然后选择设备');
    } catch { log('配对失败，请检查中继连接'); }
    finally { pair.disabled = false; }
  });
  deviceSelect = document.createElement('select'); deviceSelect.append(new Option('选择设备', ''));
  deviceSelect.setAttribute('aria-label', '目标设备');
  const channel = document.createElement('select'); channel.append(new Option('A 通道', '0')); channel.append(new Option('B 通道', '1'));
  const numberInput = (label, value, min, max, step = '1') => {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const input = document.createElement('input'); input.type = 'number'; input.value = value;
    input.min = min; input.max = max; input.step = step; input.style.width = '65px';
    wrapper.append(input); return [wrapper, input];
  };
  const [rateLabel, rate] = numberInput('每 1000 点强度 ', '0', '0', '200', '0.1');
  const [maxLabel, max] = numberInput('强度上限 ', '0', '0', '200');
  const [durationLabel, duration] = numberInput('固定时长 ms ', '5000', '100', '10000');
  const simulationLabel = document.createElement('label'); simulationLabel.textContent = '仅模拟（不发送指令）';
  const simulation = document.createElement('input'); simulation.type = 'checkbox'; simulation.checked = true;
  simulationLabel.prepend(simulation);
  const arm = document.createElement('button'); arm.textContent = '应用设置并启用';
  arm.addEventListener('click', async () => {
    try {
      await engine.stop();
      if (!bridge.connected) throw new Error('请先从本页打开雀魂并等待脚本连接');
      const device = deviceSelect.value === '' ? null : devices[Number(deviceSelect.value)];
      controller.selection = device ? { ...device, channel: Number(channel.value) } : null;
      engine.arm({ per1000: Number(rate.value), maxIntensity: Number(max.value), durationMs: Number(duration.value), simulation: simulation.checked });
      log(simulation.checked ? '模拟已启用' : '真实输出已启用；重连或异常后需重新启用');
    } catch (error) { log(error.message); }
  });
  for (const input of [deviceSelect, channel, rate, max, duration, simulation]) {
    input.addEventListener('change', () => { engine.stop().then(() => log('设置已改变，请重新启用')).catch(() => log('请在 App 手动停止')); });
  }
  const stop = document.createElement('button'); stop.textContent = '停止联动并归零'; stop.style.color = '#b00020';
  stop.addEventListener('click', () => engine.stop().then(() => log('已暂停，停止指令已确认')).catch(error => log(error.message)));
  const disconnect = document.createElement('button'); disconnect.textContent = '断开 App';
  disconnect.addEventListener('click', async () => {
    engine.enabled = false;
    try { await controller.disconnect(); log('已断开'); } catch { log('停止未确认，请在 App 手动停止'); }
    qrImage.hidden = pairText.hidden = true; pairText.value = '';
  });
  window.addEventListener('pagehide', () => { clearInterval(heartbeat); bridge.destroy(); engine.enabled = false; controller.disconnect().catch(() => {}); });

  details.append(summary, note, download, connectionStatus, server, openGame, status, address, pair, qrImage, pairText, deviceSelect, channel,
    rateLabel, maxLabel, durationLabel, simulationLabel, arm, stop, disconnect, output, copy);
  shadow.append(details);
  document.body.append(host);
}
if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount, { once: true });
