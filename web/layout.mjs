export const dashboardMarkup = `
<header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">雀</span><span>DGLab<span class="muted"> / </span>Majsoul</span></div><span class="top-note">MAHJONG × DG-LAB</span></header>
<section class="hero"><div><p class="eyebrow">YOUR GAME, YOUR RULES</p><h1>DGLab-Majsoul 控制台</h1><p class="hero-description">把每一次点炮，变成你定义的游戏反馈。</p></div><a class="button secondary" href="/userscripts/dglab-majsoul.user.js">安装 / 更新 Tampermonkey 脚本 <span aria-hidden="true">↗</span></a></section>
<div class="status-strip" aria-label="联动状态"><span class="status-item"><i id="relay-dot"></i><span id="relay-state">中继未连接</span></span><span class="status-item"><i id="game-dot"></i><span id="game-state">雀魂未连接</span></span><span class="status-item"><i id="mode-dot"></i><span id="mode-state">模拟模式 · 未启用</span></span><span class="event-counter"><strong id="event-count">0</strong> 条事件</span></div>
<div class="workspace"><div class="setup-column">
<section class="card"><div class="section-heading"><span class="step">01</span><div><h2>连接设备</h2><p>通过 DG-LAB 4 App 扫码，选择本次使用的设备。</p></div></div>
<label class="field" for="relay-address">V4 中继地址<input id="relay-address" type="url" value="wss://dglab-majsoul.pages.dev" spellcheck="false" autocomplete="off"></label>
<div class="button-row"><button id="pair" class="primary">连接并生成配对二维码</button><button id="disconnect" class="quiet">断开 App</button></div>
<button id="show-pairing" class="text-button pairing-toggle" hidden>显示配对二维码</button>
<p id="relay-message" class="field-help" role="status">连接成功后会在下方显示配对二维码。</p>
<div id="pairing" class="pairing" hidden><img id="qr-image" alt="App 配对二维码" hidden><div><h3>使用 App 扫码配对</h3><p>打开 App 的 Socket 功能进行扫描。请勿公开配对链接。</p><label class="field" for="pair-link">配对链接<textarea id="pair-link" readonly rows="3" hidden></textarea></label></div></div>
<div class="two-columns"><label class="field" for="device">目标设备<select id="device"><option value="">等待 App 接入</option></select></label><label class="field" for="channel">输出通道<select id="channel"><option value="0" selected>A 通道</option><option value="1">B 通道</option><option value="both">A + B 通道</option></select></label></div>
</section>
<section class="card"><div class="section-heading"><span class="step">02</span><div><h2>自定义点炮惩罚</h2><p>选择强度操作、覆盖波形、持续时间和快捷停止键。</p></div></div>
<label class="field" for="strategy">规则模式<select id="strategy"><option value="custom" selected>自定义指令</option><option value="linear">按失分换算强度</option></select></label>
<div id="custom-rules"><label class="sync-label"><input id="sync-channels" type="checkbox" checked> A / B 通道使用相同规则</label>
<fieldset class="rule-channel"><legend>A 通道 / 同步规则</legend>
<div class="two-columns"><label class="field" for="strength-mode">强度操作<select id="strength-mode"><option value="temporary" selected>强度临时变化</option><option value="permanent">强度永久变化</option><option value="reset">强度临时归零</option></select></label><label class="field" for="strength-delta">强度变化<input id="strength-delta" type="number" value="0" min="-40" max="40" step="1"><small>正数增加，负数减少</small></label><label class="field" for="custom-seconds">惩罚时长（秒）<input id="custom-seconds" type="number" value="5" min="0" max="60" step="0.1"></label><label class="field" for="waveform">覆盖波形<select id="waveform"><option value="" selected>保持 App 当前波形</option></select></label></div>
</fieldset>
<fieldset id="channel-b-rules" class="rule-channel" hidden><legend>B 通道独立规则</legend>
<div class="two-columns"><label class="field" for="strength-mode-b">B 通道强度操作<select id="strength-mode-b"><option value="temporary" selected>强度临时变化</option><option value="permanent">强度永久变化</option><option value="reset">强度临时归零</option></select></label><label class="field" for="strength-delta-b">B 通道强度变化<input id="strength-delta-b" type="number" value="0" min="-40" max="40" step="1"></label><label class="field" for="custom-seconds-b">B 通道惩罚时长（秒）<input id="custom-seconds-b" type="number" value="5" min="0" max="60" step="0.1"></label><label class="field" for="waveform-b">B 通道覆盖波形<select id="waveform-b"><option value="" selected>保持 App 当前波形</option></select></label></div>
</fieldset><p class="field-help">临时变化结束后撤销该临时变化；临时归零结束后按当前上限恢复原基础强度；快捷停止、关闭或断开会取消恢复。永久变化会保留并可能累积，时长只影响覆盖波形，0 秒时仅改变强度。</p></div>
<div id="linear-rules" hidden><div class="two-columns"><label class="field" for="rate">每 1000 点强度<input id="rate" type="number" value="0" min="0" max="200" step="0.1"></label><label class="field" for="duration">固定时长 ms<input id="duration" type="number" value="5000" min="100" max="10000" step="100"></label></div></div>
<div class="two-columns rule-common"><label class="field" for="maximum">强度上限<input id="maximum" type="number" value="0" min="0" max="200" step="1"><small>同时受 App 上报的通道上限约束</small></label><label class="field" for="stop-key">快捷停止键<select id="stop-key"><option value="F7" selected>F7</option><option>F8</option><option>F9</option><option>F10</option><option>Escape</option></select><small>控制台和已关联的游戏窗口均可使用</small></label></div>
<div class="rule-preview"><span id="preview-caption">规则预览</span><strong id="rule-preview">请先设置规则和强度上限</strong></div>
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
<footer><span>DGLab-Majsoul <span class="muted">/ v0.5.1</span></span><span>连接 · 配置 · 开始游戏</span></footer>`;
