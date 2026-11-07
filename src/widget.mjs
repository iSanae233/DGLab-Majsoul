const mark = `<svg viewBox="0 0 32 38" fill="none" aria-hidden="true"><rect x="3" y="2" width="26" height="34" rx="7" stroke="currentColor" stroke-width="1.5"/><path d="m18 8-10 14h7l-1 9 11-16h-8z" fill="currentColor"/></svg>`;
const styles = `
:host{font:12px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:#f1e4ec;color-scheme:dark}
*{box-sizing:border-box}button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #edb4cf;outline-offset:3px}
.shell{display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:calc(100vw - 24px)}
.toggle{position:relative;display:grid;place-items:center;width:44px;height:44px;padding:7px;background:#211823f2;color:#e4acbf;border:1px solid #8b6079;border-radius:12px;box-shadow:0 4px 18px #0005}
.toggle:hover{background:#3e2637}.toggle svg{width:25px;height:30px}.dot{position:absolute;bottom:6px;right:5px;width:6px;height:6px;border-radius:50%;background:#b397a7;box-shadow:0 0 0 2px #211823}
.toggle[data-connected=true] .dot{background:#a6d8bc}
.panel{width:360px;max-width:calc(100vw - 24px);max-height:min(70vh,600px);overflow:auto;padding:17px;background:#1c151ff5;color:#e8d8e3;border:1px solid #6a495d;border-radius:12px;box-shadow:0 12px 35px #0007;text-align:left}
.heading{display:flex;justify-content:space-between;align-items:center;gap:12px}.heading strong{font-size:14px;font-weight:600}.close{background:transparent;border:0;color:#cbb1c0;font-size:21px;line-height:1;padding:5px 7px;border-radius:4px}
.meta{font-size:10px;color:#b69ead;margin:6px 0 14px;overflow-wrap:anywhere}.actions{display:flex;gap:8px}.actions button{border:1px solid #79546b;border-radius:6px;background:#422b3d;color:#f5dbe9;padding:9px 11px}.actions .stop{background:#3c222c;border-color:#b4657e;color:#ffcfde}.actions button:disabled{opacity:.45;cursor:not-allowed}
.health{color:#b9cdbf;font-size:11px;margin:12px 0 15px}.section-title{display:flex;align-items:center;justify-content:space-between;font-size:11px;margin:16px 0 8px;color:#d6b5c8}.count{font-size:10px;color:#ad93a3}
pre{font:10px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0;padding:11px;background:#120f15;border:1px solid #43303e;border-radius:6px;max-height:245px;overflow:auto;color:#ddc9d7}.operations{max-height:150px;font-size:11px}
[hidden]{display:none!important}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}`;

export function createGameWidget({ document, version, dashboardOrigin, onConnect, onStop }) {
  const host = document.createElement('div');
  host.id = 'dglab-majsoul-widget'; host.dataset.version = version;
  host.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;width:max-content;max-width:calc(100vw - 24px)';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = styles;
  const shell = document.createElement('div'); shell.className = 'shell';
  shell.innerHTML = `<button class="toggle" type="button" aria-label="展开 DGLab 事件与惩罚" aria-expanded="false" aria-controls="widget-panel">${mark}<span class="dot" aria-hidden="true"></span></button>
<section id="widget-panel" class="panel" aria-label="DGLab 事件与惩罚" hidden><div class="heading"><strong>DGLab-Majsoul</strong><button type="button" class="close" aria-label="收起数据流">×</button></div><p class="meta"></p><div class="actions"><button class="connect" type="button">打开并关联控制台</button><button class="stop" type="button" disabled>停止联动</button></div><p class="health"></p><div class="section-title">惩罚与操作记录</div><pre class="operations" role="log" aria-live="polite"></pre><div class="section-title"><span>牌局数据流</span><span class="count"></span></div><pre class="events"></pre></section>`;
  const get = selector => shell.querySelector(selector);
  const toggle = get('.toggle'), panel = get('.panel'), stop = get('.stop');
  const setOpen = open => {
    panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', `${open ? '收起' : '展开'} DGLab 事件与惩罚`);
    toggle.title = `DGLab-Majsoul · ${toggle.dataset.connected === 'true' ? '控制台已连接' : '控制台未连接'} · 点击${open ? '收起' : '展开'}`;
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  get('.close').addEventListener('click', () => { setOpen(false); toggle.focus?.(); });
  shell.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus?.(); } });
  shell.addEventListener('click', event => event.stopPropagation());
  get('.connect').addEventListener('click', onConnect);
  stop.addEventListener('click', onStop);
  get('.meta').textContent = `脚本 ${version} · ${new URL(dashboardOrigin).host}`;
  shadow.append(style, shell); document.body.append(host);
  const widget = {
    host,
    setEvents(events) {
      const shown = events.slice(-20);
      get('.events').textContent = shown.length ? shown.map(item => JSON.stringify(item, null, 2)).join('\n\n') : '等待牌局事件…';
      get('.count').textContent = `最近 ${shown.length} 条`;
    },
    setOperations(lines) { get('.operations').textContent = lines.slice(-5).join('\n\n') || '等待控制台操作结果'; },
    setConnection(connected, shortcut) {
      toggle.dataset.connected = String(connected); stop.disabled = !connected;
      get('.health').textContent = connected ? `控制台已连接 · ${shortcut} 停止` : '控制台未连接';
      toggle.title = `DGLab-Majsoul · ${connected ? '控制台已连接' : '控制台未连接'} · 点击${panel.hidden ? '展开' : '收起'}`;
    },
  };
  widget.setEvents([]); widget.setOperations([]); widget.setConnection(false, 'F7');
  return widget;
}
