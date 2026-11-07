export const dashboardMarkup = `
<header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">雀</span><span>DGLab<span class="muted"> / </span>Majsoul</span></div><span class="top-note">MAHJONG × DG-LAB</span></header>
<section class="hero"><div><p class="eyebrow">YOUR GAME, YOUR RULES</p><h1>DGLab-Majsoul 控制台</h1><p class="hero-description">把每一次点炮，变成你定义的游戏反馈。</p></div><a class="button secondary" href="/userscripts/dglab-majsoul.user.js">安装 / 更新 Tampermonkey 脚本 <span aria-hidden="true">↗</span></a></section>
<div class="status-strip" aria-label="联动状态"><span class="status-item"><i id="relay-dot"></i><span id="relay-state">中继未连接</span></span><span class="status-item"><i id="game-dot"></i><span id="game-state">雀魂未连接</span></span><span class="status-item"><i id="mode-dot"></i><span id="mode-state">模拟模式 · 未启用</span></span><span class="event-counter"><strong id="event-count">0</strong> 条事件</span><button id="quick-stop" class="danger compact-stop" type="button">停止联动</button></div>
<div class="workspace"><div class="setup-column">
<section class="card"><div class="section-heading"><span class="step">01</span><div><h2>连接设备</h2><p>通过 DG-LAB 4 App 扫码，选择本次使用的设备。</p></div></div>
<label class="field" for="relay-address">V4 中继地址<input id="relay-address" type="url" value="wss://dglab-majsoul.pages.dev" spellcheck="false" autocomplete="off"></label>
<div class="button-row"><button id="pair" class="primary">连接并生成配对二维码</button><button id="disconnect" class="quiet">断开 App</button></div>
<button id="show-pairing" class="text-button pairing-toggle" hidden>显示配对二维码</button>
<p id="relay-message" class="field-help" role="status">连接成功后会在下方显示配对二维码。</p>
<div id="pairing" class="pairing" hidden><img id="qr-image" alt="App 配对二维码" hidden><div><h3>使用 App 扫码配对</h3><p>打开 App 的 Socket 功能进行扫描。请勿公开配对链接。</p><label class="field" for="pair-link">配对链接<textarea id="pair-link" readonly rows="3" hidden></textarea></label></div></div>
<div class="two-columns"><label class="field" for="device">目标设备<select id="device"><option value="">等待 App 接入</option></select></label><label class="field" for="channel">输出通道<select id="channel"><option value="0" selected>A 通道</option><option value="1">B 通道</option><option value="both">A + B 通道</option></select></label></div>
</section>
<section class="card"><div class="section-heading"><span class="step">02</span><div><h2>电击惩罚</h2><p>选择触发事件与惩罚方式，先在模拟模式中验证。</p></div></div>
<div class="custom-mode-heading"><span class="mode-tag">自定义指令</span><p>添加需要的事件；所有规则都会显示在下方，可随时编辑、停用或删除。</p></div>
<div class="two-columns rule-common"><label class="field" for="maximum">强度上限<input id="maximum" type="number" value="0" min="0" max="200" step="1"><small>同时受 App 上报的通道上限约束</small></label><label class="field" for="stop-key">快捷停止键<input id="stop-key" class="shortcut-input" type="text" value="F7" readonly aria-describedby="shortcut-help" autocomplete="off"><small id="shortcut-help">点击后同时按下组合，松开全部按键确认。支持 Ctrl + Alt + K、G + H 等；最多 4 个普通键，可叠加修饰键；仅在控制台或已关联游戏窗口内生效。</small></label></div>
<div class="add-event-row"><label class="field" for="new-trigger">触发事件<select id="new-trigger"></select></label><button id="add-rule" class="secondary" type="button">＋ 添加事件</button></div>
<div class="rules-list-heading"><h3>已创建的规则</h3><span id="rule-count">0 条</span></div>
<div id="rule-list" class="rules-list"></div><p id="rules-save-note" class="field-help">规则仅保存在此浏览器；刷新后仍需手动启用，默认仅模拟。</p>
<p class="field-help">每个事件只需添加一次，可分别配置 A/B 通道。临时变化到期撤销；永久变化保留并可能累积。真实输出繁忙时跳过连续触发，不排队叠加。</p>
<label class="simulation-toggle"><input id="simulation" type="checkbox" checked><span><strong>仅模拟（不发送指令）</strong><small>先查看惩罚记录，再决定是否开启真实输出。</small></span><span class="toggle-track" aria-hidden="true"></span></label>
</section>
<section class="card"><div class="section-heading"><span class="step">03</span><div><h2>进入雀魂</h2><p>从此处打开游戏，保持控制台开启以接收牌局事件。</p></div></div>
<div class="game-launch"><label class="field" for="server">雀魂服务器<select id="server"></select></label><button id="open-game" class="secondary">打开雀魂并连接脚本 <span aria-hidden="true">↗</span></button></div>
<p id="connection-status" class="field-help">可从这里打开雀魂，或在游戏内小窗口点击“打开并关联控制台”。</p>
<div class="control-actions"><button id="arm" class="primary">应用设置并启用</button><button id="stop" class="danger">停止联动并归零</button></div>
<p id="operation-status" class="operation-status" role="status" aria-live="polite">未启用</p>
</section></div>
<aside class="activity-column"><section class="card activity-card"><div class="activity-heading"><div><p class="eyebrow">LIVE ACTIVITY</p><h2>牌局与惩罚记录</h2></div><span class="live-label">实时</span></div><p class="activity-intro">雀魂右上角也会同步显示事件和惩罚操作。</p>
<p id="activity-health" class="activity-health" role="status">尚未检测到游戏脚本。请安装最新脚本并刷新雀魂。</p><div class="log-heading">最近操作</div><ol id="operation-list" class="operation-list"><li class="empty-operation">暂无操作记录</li></ol>
<div class="log-heading event-heading">牌局事件 <button id="clear" class="text-button">清空显示</button></div>
<ol id="event-list" class="event-list"><li class="empty-state"><span class="empty-glyph" aria-hidden="true">東</span><strong>等待第一条牌局事件</strong><p>连接脚本后，弃牌、和牌和点炮结算会显示在这里。</p></li></ol>
<button id="copy" class="secondary full-width">复制最近 100 条事件</button>
</section><div class="usage-note"><strong>使用提示</strong><p>默认模拟，刷新后需重新启用。网络断开时，应能在 App 或设备端手动停止。</p><p>真实设备输出效果仍需实测。</p></div></aside></div>
<footer><span>DGLab-Majsoul <span class="muted">/ v0.7.1</span></span><span>连接 · 配置 · 开始游戏</span></footer>`;
