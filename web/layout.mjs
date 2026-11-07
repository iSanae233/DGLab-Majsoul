import { icon } from './icons.mjs';

export const emptyEventMarkup = `<span class="empty-glyph" aria-hidden="true">${icon('tiles')}</span><strong>静候开局</strong><p>连接雀魂脚本后，<br>这里会记录你的牌局与反馈。</p><span class="empty-caption">WAITING FOR YOUR NEXT MOVE</span>`;

const scene = `<div class="hero-art" aria-hidden="true">
  <span class="orbit orbit-one"></span><span class="orbit orbit-two"></span>
  <span class="art-coordinate coordinate-top">MJ / DG — 01</span>
  <div class="tile tile-back"><span class="tile-corner">DG</span>${icon('bolt')}<span class="tile-caption">DESIRE</span></div>
  <div class="tile tile-front"><span class="tile-corner">東</span><span class="tile-character">發</span><span class="tile-caption">YOUR RULES</span></div>
  <span class="art-ring ring-one"></span><span class="art-ring ring-two"></span>
  <span class="art-coordinate coordinate-bottom">THE NEXT MOVE IS YOURS.</span>
</div>`;

export const dashboardMarkup = `
<a class="skip-link" href="#device-section">跳到控制台</a>
<header class="topbar">
  <a class="brand" href="#" aria-label="DGLab-Majsoul 首页"><img class="brand-mark" src="/assets/brand.svg" width="40" height="44" alt=""><span>DGLab<span class="brand-divider"> / </span>Majsoul<small>PLAY ON YOUR TERMS</small></span></a>
  <nav class="top-nav" aria-label="控制台导航"><a href="#device-section"><span>01</span> 设备</a><a href="#rules-section"><span>02</span> 规则</a><a href="#game-section"><span>03</span> 入局</a></nav>
  <span class="top-note">${icon('ring')}自愿 · 边界 · 掌控</span>
</header>
<section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow"><span></span>MAHJONG MEETS DESIRE</p><h1 id="hero-title">入局，<br>由你<span class="hero-accent">掌控</span><span class="hero-period">。</span></h1><p class="hero-description">把牌桌上的每一次心跳，<br class="mobile-break">交给你亲手定义的规则。</p><div class="hero-actions"><a class="button secondary install-button" href="/userscripts/dglab-majsoul.user.js">${icon('download')}安装 / 更新脚本${icon('arrow')}</a><span class="hero-caption">DGLab-Majsoul 联动控制台</span></div></div>${scene}</section>
<div class="session-divider"><span>YOUR SESSION</span><span>连接设备，设定边界，然后开始。</span><span>01 — 03</span></div>
<div class="status-strip" aria-label="联动状态"><span class="status-item"><i id="relay-dot"></i><span id="relay-state">中继未连接</span></span><span class="status-item"><i id="game-dot"></i><span id="game-state">雀魂未连接</span></span><span class="status-item"><i id="mode-dot"></i><span id="mode-state">模拟模式 · 未启用</span></span><span class="event-counter"><strong id="event-count">0</strong> 条事件</span><button id="quick-stop" class="danger compact-stop" type="button">${icon('stop')}停止联动</button></div>
<div class="workspace"><div class="setup-column">
<section class="card" id="device-section"><div class="section-heading"><span class="section-symbol">${icon('link')}</span><div><p class="section-kicker">01 / CONNECTION</p><h2>连接设备</h2></div><span class="section-index" aria-hidden="true">01</span></div><p class="section-description">通过 DG-LAB 4 App 扫码，让设备加入这场游戏。</p>
<label class="field" for="relay-address">V4 中继地址<input id="relay-address" type="url" value="wss://dglab-majsoul.pages.dev" spellcheck="false" autocomplete="off"></label>
<div class="button-row"><button id="pair" class="primary">${icon('qr')}<span id="pair-label">连接并生成配对二维码</span></button><button id="disconnect" class="quiet">断开 App</button></div>
<button id="show-pairing" class="text-button pairing-toggle" hidden>显示配对二维码</button>
<p id="relay-message" class="field-help" role="status">连接成功后会在下方显示配对二维码。</p>
<div id="pairing" class="pairing" hidden><img id="qr-image" alt="App 配对二维码" hidden><div><h3>使用 App 扫码配对</h3><p>打开 App 的 Socket 功能进行扫描。请勿公开配对链接。</p><label class="field" for="pair-link">配对链接<textarea id="pair-link" readonly rows="3" hidden></textarea></label></div></div>
<div class="two-columns"><label class="field" for="device">目标设备<select id="device"><option value="">等待 App 接入</option></select></label><label class="field" for="channel">输出通道<select id="channel"><option value="0" selected>A 通道</option><option value="1">B 通道</option><option value="both">A + B 通道</option></select></label></div>
</section>
<section class="card rules-card" id="rules-section"><div class="section-heading"><span class="section-symbol">${icon('bolt')}</span><div><p class="section-kicker">02 / YOUR RULES</p><h2>电击惩罚</h2></div><span class="section-index" aria-hidden="true">02</span></div><p class="section-description">刺激有分寸，规则由你定义。先模拟，再开启。</p>
<div class="custom-mode-heading"><span class="mode-tag">${icon('sliders')}自定义指令</span><p>添加事件，分别设置 A / B 通道的反馈。</p></div>
<div class="two-columns rule-common"><label class="field" for="maximum"><span class="field-caption">${icon('sliders')}强度上限</span><input id="maximum" type="number" value="0" min="0" max="200" step="1"><small>最高 200，同时受 App 通道上限约束</small></label><label class="field" for="stop-key"><span class="field-caption">${icon('keyboard')}快捷停止键</span><input id="stop-key" class="shortcut-input" type="text" value="F7" readonly aria-describedby="shortcut-help" autocomplete="off"><small id="shortcut-help">点击录入组合，松开全部按键确认。最多 4 个普通键，可搭配 Ctrl / Alt 等；仅在控制台或已关联游戏内生效。</small></label></div>
<div class="add-event-row"><label class="field" for="new-trigger">触发事件<select id="new-trigger"></select></label><button id="add-rule" class="secondary" type="button">${icon('plus')}添加事件</button></div>
<div class="rules-list-heading"><h3>已创建的规则</h3><span id="rule-count">0 条</span></div>
<div id="rule-list" class="rules-list"></div><p id="rules-save-note" class="field-help">规则仅保存在此浏览器；刷新后仍需手动启用，默认仅模拟。</p>
<details class="rule-notes"><summary>关于强度与连续触发</summary><p class="field-help">临时变化到期撤销；永久变化保留并可能累积。真实输出繁忙时跳过连续触发，不排队叠加。每个事件只需添加一次，可随时编辑、停用或删除。</p></details>
<label class="simulation-toggle"><input id="simulation" type="checkbox" checked><span class="simulation-icon" aria-hidden="true">${icon('shield')}</span><span><strong>仅模拟（不发送指令）</strong><small>先确认反馈符合预期，再决定是否真实输出。</small></span><span class="toggle-track" aria-hidden="true"></span></label>
</section>
<section class="card" id="game-section"><div class="section-heading"><span class="section-symbol">${icon('tiles')}</span><div><p class="section-kicker">03 / LET'S PLAY</p><h2>进入雀魂</h2></div><span class="section-index" aria-hidden="true">03</span></div><p class="section-description">牌局即将开始。保持控制台开启，接收每一步反馈。</p>
<div class="game-launch"><label class="field" for="server">雀魂服务器<select id="server"></select></label><button id="open-game" class="secondary">打开雀魂并连接脚本${icon('arrow')}</button></div>
<p id="connection-status" class="field-help">可从这里打开雀魂，或在游戏内小窗口点击“打开并关联控制台”。</p>
<div class="control-actions"><button id="arm" class="primary">${icon('play')}应用设置并启用</button><button id="stop" class="danger">${icon('stop')}停止联动并归零</button></div>
<p id="operation-status" class="operation-status" role="status" aria-live="polite">未启用</p>
</section></div>
<aside class="activity-column"><section class="card activity-card"><div class="activity-heading"><div><p class="eyebrow">${icon('pulse')}LIVE ACTIVITY</p><h2>牌局与惩罚记录</h2></div><span class="live-label">事件流</span></div><p class="activity-intro">每一次触发，都有迹可循。<br>事件与操作同步显示在雀魂右上角。</p>
<p id="activity-health" class="activity-health" role="status">尚未检测到游戏脚本。请安装最新脚本并刷新雀魂。</p><div class="log-heading"><span>最近操作</span><span class="log-annotation">OPERATIONS</span></div><ol id="operation-list" class="operation-list"><li class="empty-operation">暂无操作记录</li></ol>
<div class="log-heading event-heading"><span>牌局事件</span><button id="clear" class="text-button">清空显示</button></div>
<ol id="event-list" class="event-list"><li class="empty-state">${emptyEventMarkup}</li></ol>
<button id="copy" class="secondary full-width">${icon('copy')}<span id="copy-label">复制最近 100 条事件</span></button>
</section><div class="session-note">${icon('ring')}<div><strong>尽兴，也尽在掌控。</strong><p>边界由你设定，随时可以停止。</p></div></div><div class="usage-note"><strong>${icon('shield')}使用提示</strong><p>默认模拟，刷新后需重新启用。网络断开时，应能在 App 或设备端手动停止。</p><p>真实设备输出效果仍需实测。</p></div></aside></div>
<footer><a class="footer-brand" href="#"><img src="/assets/brand.svg" width="24" height="28" alt="">DGLab-Majsoul <span class="muted">/ v0.8.0</span></a><span class="footer-motto">YOUR GAME. YOUR RULES. YOUR LIMITS.</span><span>自愿 · 沟通 · 随时停止</span></footer>`;
