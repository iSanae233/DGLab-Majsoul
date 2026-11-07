import { icon } from './icons.mjs';
import { brandMarkup, footerMarkup } from './components.mjs';

export const emptyEventMarkup = `<span class="empty-glyph" aria-hidden="true">${icon('tiles')}</span><strong>静候开局</strong><p>关联雀魂后显示牌局与反馈。</p><span class="empty-caption">WAITING FOR YOUR NEXT MOVE</span>`;

export const dashboardMarkup = `
<a class="skip-link" href="#device-section">跳到配置</a>
<header class="topbar config-topbar">${brandMarkup}<nav class="top-nav" aria-label="页面导航"><a href="/" class="home-link">返回首页</a></nav></header>
<div class="config-heading"><div><p class="eyebrow">YOUR SESSION</p><h1>游玩配置</h1></div><a class="button secondary install-button" href="/userscripts/dglab-majsoul.user.js">${icon('download')}安装 / 更新脚本</a></div>
<div class="status-strip" aria-label="联动状态"><span class="status-item"><i id="relay-dot"></i><span id="relay-state">中继未连接</span></span><span class="status-item"><i id="game-dot"></i><span id="game-state">雀魂未连接</span></span><span class="status-item"><i id="mode-dot"></i><span id="mode-state">模拟模式 · 未启用</span></span><span class="event-counter"><strong id="event-count">0</strong> 条事件</span><button id="quick-stop" class="danger compact-stop" type="button">${icon('stop')}停止联动</button></div>
<div class="workspace"><div class="setup-column">
<section class="card" id="device-section"><div class="section-heading"><span class="section-symbol">${icon('link')}</span><div><h2>连接设备</h2></div></div>
<label class="field" for="relay-address">V4 中继地址<input id="relay-address" type="url" value="wss://dglab-majsoul.pages.dev" spellcheck="false" autocomplete="off"></label>
<div class="button-row"><button id="pair" class="primary">${icon('qr')}<span id="pair-label">连接并生成配对二维码</span></button><button id="disconnect" class="quiet">断开 App</button></div>
<button id="show-pairing" class="text-button pairing-toggle" hidden>显示配对二维码</button>
<p id="relay-message" class="field-help" role="status">连接后使用 DG-LAB 4 App 扫码。</p>
<div id="pairing" class="pairing" hidden><img id="qr-image" alt="App 配对二维码" hidden><div><h3>使用 App 扫码配对</h3><p>打开 App 的 Socket 功能进行扫描。请勿公开配对链接。</p><label class="field" for="pair-link">配对链接<textarea id="pair-link" readonly rows="3" hidden></textarea></label></div></div>
<div class="two-columns"><label class="field" for="device">目标设备<select id="device"><option value="">等待 App 接入</option></select></label><label class="field" for="channel">输出通道<select id="channel"><option value="0" selected>A 通道</option><option value="1">B 通道</option><option value="both">A + B 通道</option></select></label></div>
</section>
<section class="card rules-card" id="rules-section"><div class="section-heading"><span class="section-symbol">${icon('bolt')}</span><div><h2>电击惩罚</h2></div></div>
<div class="custom-mode-heading"><span class="mode-tag">${icon('sliders')}自定义指令</span></div>
<div class="two-columns rule-common"><label class="field" for="maximum"><span class="field-caption">${icon('sliders')}强度上限</span><input id="maximum" type="number" value="0" min="0" max="200" step="1"><small>最高 200，同时受 App 通道上限约束</small></label><label class="field" for="stop-key"><span class="field-caption">${icon('keyboard')}快捷停止键</span><input id="stop-key" class="shortcut-input" type="text" value="F7" readonly aria-describedby="shortcut-help" autocomplete="off"><small id="shortcut-help">点击录入，松开全部按键确认。仅在本页或已关联游戏内生效。</small></label></div>
<div class="add-event-row"><label class="field" for="new-trigger">触发事件<select id="new-trigger"></select></label><button id="add-rule" class="secondary" type="button">${icon('plus')}添加事件</button></div>
<div class="rules-list-heading"><h3>已创建的规则</h3><span id="rule-count">0 条</span></div>
<div id="rule-list" class="rules-list"></div><p id="rules-save-note" class="field-help">规则自动保存在此浏览器。</p>
<details class="rule-notes"><summary>关于强度与连续触发</summary><p class="field-help">临时变化到期撤销；永久变化保留并可能累积。真实输出繁忙时跳过连续触发，不排队叠加。每个事件只需添加一次，可随时编辑、停用或删除。</p></details>
<label class="simulation-toggle"><input id="simulation" type="checkbox" checked><span class="simulation-icon" aria-hidden="true">${icon('shield')}</span><span><strong>仅模拟（不发送指令）</strong></span><span class="toggle-track" aria-hidden="true"></span></label>
</section>
<section class="card" id="game-section"><div class="section-heading"><span class="section-symbol">${icon('tiles')}</span><div><h2>进入雀魂</h2></div></div>
<div class="game-launch"><label class="field" for="server">雀魂服务器<select id="server"></select></label><button id="open-game" class="secondary">打开雀魂并连接脚本${icon('arrow')}</button></div>
<p id="connection-status" class="field-help">等待雀魂脚本关联。</p>
<div class="control-actions"><button id="arm" class="primary">${icon('play')}应用设置并启用</button><button id="stop" class="danger">${icon('stop')}停止联动并归零</button></div>
<p id="operation-status" class="operation-status" role="status" aria-live="polite">未启用</p>
</section></div>
<aside class="activity-column"><section class="card activity-card"><div class="activity-heading"><div><p class="eyebrow">${icon('pulse')}LIVE ACTIVITY</p><h2>牌局与惩罚记录</h2></div><span class="live-label">事件流</span></div>
<p id="activity-health" class="activity-health" role="status">等待雀魂脚本。</p><div class="log-heading"><span>最近操作</span><span class="log-annotation">OPERATIONS</span></div><ol id="operation-list" class="operation-list"><li class="empty-operation">暂无操作记录</li></ol>
<div class="log-heading event-heading"><span>牌局事件</span><button id="clear" class="text-button">清空显示</button></div>
<ol id="event-list" class="event-list"><li class="empty-state">${emptyEventMarkup}</li></ol>
<button id="copy" class="secondary full-width">${icon('copy')}<span id="copy-label">复制最近 100 条事件</span></button>
</section></aside></div>
${footerMarkup}`;
