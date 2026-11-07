import qrcode from 'qrcode-generator';
import { DglabController } from '../src/dglab.mjs';
import { PenaltyEngine, penaltyFor } from '../src/penalty.mjs';
import { DashboardBridge, GAME_URLS } from '../src/bridge.mjs';
import { TRIGGERS } from '../src/triggers.mjs';
import { recordShortcut, shortcutMatches, shortcutLabel } from '../src/shortcut.mjs';
import { WAVEFORMS, customPlan, describePlan } from '../src/rules.mjs';
import { dashboardMarkup } from './layout.mjs';

const recent = [], operations = [];
let total = 0, devices = [], pairGeneration = 0, scriptVersion = null;
let editingTrigger = 'deal-in', stopShortcut = 'F7', recordingShortcut = false;
const emptyChannel = () => ({ mode: 'temporary', delta: 0, durationMs: 5000, waveform: null });
const eventRules = Object.fromEntries(TRIGGERS.map(trigger => [trigger.value, { enabled: false, syncChannels: true, channels: { A: emptyChannel(), B: emptyChannel() } }]));
const ui = {};
const labels = { 'script-ready': '脚本就绪', discard: '弃牌', riichi: '立直', meld: '吃碰杠', kan: '杠', win: '和牌', 'deal-in': '点炮结算',
  'round-start': '新一局', 'game-start': '进入对局', resync: '恢复对局', 'north-extraction': '拔北',
  'exhaustive-draw': '荒牌流局', 'abortive-draw': '途中流局', 'game-end': '对局结束',
  'connection-observed': '发现游戏连接', 'connection-closed': '游戏连接关闭', 'capture-error': '解析异常', 'protocol-error': '协议异常' };
const badge = (kind, text, active = false) => {
  if (!ui[`${kind}-state`]) return;
  ui[`${kind}-state`].textContent = text;
  ui[`${kind}-dot`].dataset.active = String(active);
};
function renderEvents() {
  if (!ui['event-list']) return;
  ui['event-count'].textContent = String(total);
  if (!recent.length) {
    ui['event-list'].replaceChildren();
    const item = document.createElement('li'); item.className = 'empty-state';
    item.textContent = '等待第一条牌局事件'; ui['event-list'].append(item); return;
  }
  ui['event-list'].replaceChildren(...recent.slice(-12).reverse().map(event => {
    const item = document.createElement('li'); item.className = 'event-row';
    const time = document.createElement('time'); time.textContent = new Date(event.time).toLocaleTimeString('zh-CN', { hour12: false });
    const title = document.createElement('strong'); title.textContent = event.type === 'discard' && event.isDora ? '弃牌 · Dora' : labels[event.type] || event.type;
    const detail = document.createElement('span'); detail.textContent = event.type === 'script-ready' ? `脚本版本 ${event.version || '未知'}` : event.loss ? `实际失分 ${event.loss.toLocaleString()} 点` :
      event.tile ? `座位 ${event.seat} · ${event.tile}` : event.round ? `局标识 ${event.round}` : `连接 ${String(event.connection).split(':').at(-1)}`;
    item.append(time, title, detail); return item;
  }));
}
const log = message => {
  if (ui['operation-status']) ui['operation-status'].textContent = message;
  operations.push({ time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), message });
  if (operations.length > 5) operations.shift();
  if (ui['operation-list']) ui['operation-list'].replaceChildren(...operations.slice().reverse().map(operation => {
    const item = document.createElement('li'), time = document.createElement('time'), text = document.createElement('span');
    time.textContent = operation.time; text.textContent = operation.message; item.append(time, text); return item;
  }));
  badge('mode', engine.enabled ? (engine.config.simulation ? '模拟模式 · 已启用' : '真实输出 · 已启用') : '联动未启用', engine.enabled);
  bridge.status(message);
};
const clearPairing = () => {
  if (!ui.pairing) return;
  ui.pairing.hidden = ui['qr-image'].hidden = ui['pair-link'].hidden = true;
  ui['pair-link'].value = ''; ui['qr-image'].removeAttribute('src');
  ui['show-pairing'].hidden = true;
};
const controller = new DglabController(list => {
  devices = list;
  if (!ui.device) return;
  const selected = ui.device.value;
  ui.device.replaceChildren(new Option(list.length ? '选择设备' : '等待 App 接入', ''));
  list.forEach(device => ui.device.append(new Option(device.name, JSON.stringify([device.clientId, device.slotId]))));
  if (list.some(device => JSON.stringify([device.clientId, device.slotId]) === selected)) ui.device.value = selected;
  if (list.length) {
    badge('relay', `已发现 ${list.length} 台设备`, true);
    ui['relay-message'].textContent = 'App 已接入，请选择目标设备与通道。';
    ui.pairing.hidden = true;
    ui['show-pairing'].hidden = !ui['pair-link'].value;
  }
}, () => {
  clearPairing(); badge('relay', '中继或设备已断开');
  engine.stop().catch(() => log('连接中断；请在 App 确认停止'));
  log('连接已断开或设备不可用，请重新启用');
});
const engine = new PenaltyEngine(controller, log);
const bridge = new DashboardBridge(window, event => {
  const record = { time: new Date().toISOString(), ...event };
  if (record.type === 'script-ready') scriptVersion = record.version;
  total++; recent.push(record); if (recent.length > 100) recent.shift(); renderEvents();
  if (ui['activity-health']) ui['activity-health'].textContent = `脚本事件已接收 · 最近 ${new Date(record.time).toLocaleTimeString('zh-CN', { hour12: false })}${record.type === 'script-ready' ? ` · 版本 ${record.version}` : ''}`;
  engine.handle(record).catch(() => log('停止未确认，请在 App 手动停止'));
}, message => {
  if (ui['connection-status']) ui['connection-status'].textContent = message;
  if (ui['activity-health']) ui['activity-health'].textContent = message;
  engine.stop().then(() => log(message)).catch(() => log('停止未确认，请在 App 手动停止'));
});
const heartbeat = setInterval(() => {
  bridge.tick(); badge('game', bridge.connected ? '雀魂脚本已连接' : '雀魂未连接', bridge.connected);
}, 3000);
function mount() {
  const root = document.createElement('main'); root.className = 'console'; root.innerHTML = dashboardMarkup;
  document.body.append(root);
  root.querySelectorAll('[id]').forEach(element => { ui[element.id] = element; });
  ui.simulation.checked = true; ui['sync-channels'].checked = true;
  for (const select of [ui.waveform, ui['waveform-b']]) WAVEFORMS.forEach(wave => select.append(new Option(wave.label, wave.value)));
  const emergencyStop = () => engine.stop().then(() => log('快捷停止：联动已暂停')).catch(error => log(error.message));
  bridge.onStop = emergencyStop;
  window.addEventListener('keydown', event => { if (!recordingShortcut && shortcutMatches(event, stopShortcut)) { event.preventDefault(); emergencyStop(); } });
  TRIGGERS.forEach(trigger => { const option = new Option(trigger.label, trigger.value); option.selected = trigger.value === editingTrigger; ui.trigger.append(option); });
  ui['rule-enabled'].checked = false;
  GAME_URLS.forEach((url, i) => { const option = new Option(['繁中服', '日服', '国际服'][i], url); option.selected = i === 0; ui.server.append(option); });
  ui['open-game'].addEventListener('click', () => { try { bridge.open(ui.server.value); } catch (error) { log(error.message); } });
  ui['show-pairing'].addEventListener('click', () => { ui.pairing.hidden = !ui.pairing.hidden; });
  ui['relay-address'].addEventListener('change', async () => {
    pairGeneration++; clearPairing(); engine.enabled = false;
    ui.pair.disabled = false; ui.pair.textContent = '连接并生成配对二维码';
    try { await controller.disconnect(); log('中继地址已更改，请重新连接'); } catch { log('停止未确认，请在 App 手动停止'); }
    badge('relay', '中继未连接');
    ui['relay-message'].textContent = '地址已修改，等待重新连接。';
  });
  ui.pair.addEventListener('click', async () => {
    const generation = ++pairGeneration;
    clearPairing(); ui.pair.disabled = true; ui.pair.textContent = '正在连接…';
    ui['relay-message'].textContent = '正在与 V4 中继建立连接…'; badge('relay', '中继连接中');
    try {
      await engine.stop();
      const link = await controller.connect(ui['relay-address'].value);
      if (generation !== pairGeneration) return;
      const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
      ui['qr-image'].src = qr.createDataURL(3); ui['pair-link'].value = link;
      ui.pairing.hidden = ui['qr-image'].hidden = ui['pair-link'].hidden = false;
      ui['relay-message'].textContent = '中继已连接，等待 App 扫码。'; badge('relay', '等待 App 配对', true);
      log('请使用 DG-LAB 4 App 扫码，然后选择设备');
    } catch {
      if (generation !== pairGeneration) return;
      clearPairing(); badge('relay', '中继连接失败');
      ui['relay-message'].textContent = '无法连接 V4 中继。请确认服务可用、地址正确，并允许浏览器访问。';
      log('配对失败，未启用输出');
    } finally {
      if (generation === pairGeneration) { ui.pair.disabled = false; ui.pair.textContent = '连接并生成配对二维码'; }
    }
  });
  const readChannel = suffix => ({ mode: ui[`strength-mode${suffix}`].value,
    delta: Number(ui[`strength-delta${suffix}`].value), durationMs: Math.round(Number(ui[`custom-seconds${suffix}`].value) * 1000),
    waveform: ui[`waveform${suffix}`].value || null });
  const saveDraft = () => { eventRules[editingTrigger] = { enabled: ui['rule-enabled'].checked, syncChannels: ui['sync-channels'].checked, channels: { A: readChannel(''), B: readChannel('-b') } }; };
  const loadDraft = () => {
    const draft = eventRules[editingTrigger];
    ui['rule-enabled'].checked = draft.enabled; ui['sync-channels'].checked = draft.syncChannels;
    for (const [name, suffix] of [['A', ''], ['B', '-b']]) {
      const rule = draft.channels[name];
      const modes = [...ui[`strength-mode${suffix}`].querySelectorAll('option')];
      modes.forEach(option => { option.selected = false; }); modes.find(option => option.value === rule.mode).selected = true;
      ui[`strength-delta${suffix}`].value = String(rule.delta);
      ui[`custom-seconds${suffix}`].value = String(rule.durationMs / 1000); const waves = [...ui[`waveform${suffix}`].querySelectorAll('option')];
      waves.forEach(option => { option.selected = false; }); waves.find(option => option.value === (rule.waveform || '')).selected = true;
    }
  };
  const config = () => {
    const common = { strategy: ui.strategy.value, maxIntensity: Number(ui.maximum.value), simulation: ui.simulation.checked };
    if (common.strategy === 'custom') {
      saveDraft();
      return { ...common, targetChannel: ui.channel.value === 'both' ? 'both' : ui.channel.value === '1' ? 'B' : 'A',
        eventRules: JSON.parse(JSON.stringify(eventRules)) };
    }
    if (ui.channel.value === 'both') throw new Error('按失分换算时请选择单个通道，或使用自定义 A+B 指令');
    return { ...common, per1000: Number(ui.rate.value), durationMs: Number(ui.duration.value) };
  };
  const preview = () => {
    const custom = ui.strategy.value === 'custom';
    ui['custom-rules'].hidden = !custom; ui['linear-rules'].hidden = custom;
    ui['channel-b-rules'].hidden = ui['sync-channels'].checked;
    ui['strength-delta'].disabled = ui['strength-mode'].value === 'reset';
    ui['strength-delta-b'].disabled = ui['strength-mode-b'].value === 'reset';
    ui['preview-caption'].textContent = custom ? `${TRIGGERS.find(item => item.value === editingTrigger)?.label} · ${ui['rule-enabled'].checked ? '已启用' : '未启用'}` : '四舍五入预览 / 失分 3,900 点';
    bridge.configureStopKey(stopShortcut);
    try {
      const current = config();
      const result = custom ? customPlan({ ...current, ...eventRules[editingTrigger] }) : penaltyFor(3900, current);
      ui['rule-preview'].textContent = custom ? describePlan(result) : `临时强度 ${result.intensity} · ${(result.durationMs / 1000).toLocaleString()} 秒`;
    } catch (error) { ui['rule-preview'].textContent = error.message; }
  };
  for (const input of [ui.device, ui.channel, ui.rate, ui.maximum, ui.duration, ui.simulation, ui.strategy, ui['rule-enabled'], ui['sync-channels'],
    ui['strength-mode'], ui['strength-mode-b'], ui['strength-delta'], ui['strength-delta-b'], ui['custom-seconds'], ui['custom-seconds-b'], ui.waveform, ui['waveform-b']]) {
    const change = () => { if (Number(ui.maximum.value) > 200) ui.maximum.value = '200'; preview(); if (engine.enabled) engine.stop().then(() => log('设置已改变，请重新启用')).catch(() => log('请在 App 手动停止')); };
    input.addEventListener('input', change); input.addEventListener('change', change);
  }
  ui.trigger.addEventListener('change', () => {
    const key = ui.trigger.value; if (!Object.hasOwn(eventRules, key)) return;
    saveDraft(); editingTrigger = key; loadDraft(); preview();
    if (engine.enabled) engine.stop().then(() => log('触发事件已改变，请重新启用')).catch(() => log('请在 App 手动停止'));
  });
  ui['stop-key'].addEventListener('focus', () => {
    recordingShortcut = true; ui['stop-key'].value = '请按快捷键…';
    engine.stop().catch(() => log('请在 App 手动停止')); log('正在录入停止键，联动已暂停');
  });
  ui['stop-key'].addEventListener('keydown', event => {
    event.preventDefault(); event.stopPropagation();
    try {
      const key = recordShortcut(event); if (!key) return;
      stopShortcut = key; recordingShortcut = false;
      ui['stop-key'].value = shortcutLabel(key); ui['stop-key'].blur();
      preview(); log(`停止键已设为 ${shortcutLabel(key)}`);
    } catch (error) { ui['stop-key'].value = '请换一个按键'; log(error.message); }
  });
  ui['stop-key'].addEventListener('blur', () => { recordingShortcut = false; ui['stop-key'].value = shortcutLabel(stopShortcut); });
  ui.arm.addEventListener('click', async () => {
    ui.arm.disabled = true;
    try {
      await engine.stop();
      if (!bridge.connected) throw new Error('请先从本页打开雀魂并等待脚本连接');
      const modern = Number(scriptVersion?.split('.')[0]) > 0 || Number(scriptVersion?.split('.')[1]) >= 6;
      if (!modern && (config().strategy === 'custom' && Object.entries(config().eventRules).some(([key, rule]) => key !== 'deal-in' && rule.enabled) || !['F7','F8','F9','F10','Escape'].includes(stopShortcut))) throw new Error('新增事件和按键录入需要用户脚本 0.6.0，请更新并刷新雀魂');
      const device = devices.find(item => JSON.stringify([item.clientId, item.slotId]) === ui.device.value);
      controller.selection = device ? { ...device, channel: ui.channel.value === 'both' ? 'both' : Number(ui.channel.value) } : null;
      engine.arm(config()); log(ui.simulation.checked ? '模拟已启用' : '真实输出已启用；重连或异常后需重新启用');
    } catch (error) { log(error.message); }
    finally { ui.arm.disabled = false; }
  });
  ui.stop.addEventListener('click', () => {
    const active = !!controller.active;
    engine.stop().then(() => log(active ? '停止指令已确认，联动已暂停' : '联动已暂停')).catch(error => log(error.message));
  });
  ui.disconnect.addEventListener('click', async () => {
    pairGeneration++; clearPairing(); ui.pair.disabled = false; ui.pair.textContent = '连接并生成配对二维码';
    engine.enabled = false;
    try { await controller.disconnect(); log('已断开 App'); } catch { log('停止未确认，请在 App 手动停止'); }
    badge('relay', '中继未连接'); ui['relay-message'].textContent = '连接已断开。';
  });
  ui.copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(JSON.stringify({ version: '0.6.0', total, events: recent }, null, 2)); ui.copy.textContent = '已复制'; }
    catch { ui.copy.textContent = '复制失败，请允许剪贴板访问'; }
  });
  ui.clear.addEventListener('click', () => { recent.length = 0; renderEvents(); });
  window.addEventListener('pagehide', () => { pairGeneration++; clearInterval(heartbeat); bridge.destroy(); engine.enabled = false; controller.disconnect().catch(() => {}); });
}
if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
