import { TRIGGERS, triggerLabel } from '../src/triggers.mjs';
import { WAVEFORMS, normalizeRule, customPlan, isPersistent, isReset } from '../src/rules.mjs';

const channelFields = (channel, suffix) => `<fieldset class="rule-channel" data-field="panel${suffix}"><legend>${channel} 通道</legend><div class="two-columns">
<label class="field">强度操作<select data-field="mode${suffix}"><option value="temporary">临时变化</option><option value="permanent">持久变化</option><option value="reset">临时归零</option><option value="permanent-reset">持久归零</option></select></label>
<div class="field" data-field="change${suffix}"><span data-field="delta-caption${suffix}">强度变化</span><div class="strength-action"><select data-field="action${suffix}" aria-label="${channel} 通道强度变化方式"><option value="change">变化</option><option value="set">调整到</option></select><span data-field="number-wrap${suffix}" class="strength-number"><span data-field="positive${suffix}" class="positive-sign" aria-hidden="true" hidden>+</span><input data-field="delta${suffix}" aria-label="${channel} 通道强度数值" type="number" min="-200" max="200" step="1" value="0"></span></div><input data-field="slider${suffix}" class="strength-slider" aria-label="${channel} 通道目标强度滑块" type="range" min="0" max="200" step="1" value="0" hidden></div>
<label class="field" data-field="duration${suffix}">惩罚时长（秒）<input data-field="seconds${suffix}" type="number" min="0.1" max="60" step="0.1" value="5"></label></div>
<details class="waveform-picker"><summary>勾选波形 <span data-field="wave-summary${suffix}">跟随 App 波形</span></summary><div class="waveform-actions"><button data-field="wave-all${suffix}" class="text-button" type="button">全选</button><button data-field="wave-none${suffix}" class="text-button" type="button">全不选</button></div><div data-field="waves${suffix}" class="waveform-options"></div><label class="field waveform-playback">播放方式<select data-field="wave-mode${suffix}"><option value="sequence">按勾选顺序轮播</option><option value="random">随机播放</option></select></label><p data-field="wave-note${suffix}" class="field-help"></p></details></fieldset>`;
function selectValue(select, value) {
  const options = [...select.querySelectorAll('option')]; options.forEach(option => { option.selected = false; });
  (options.find(option => option.value === value) || options[0]).selected = true;
}
const emptyChannel = () => ({ mode: 'temporary', action: 'change', delta: 0, durationMs: 5000, waveforms: [], waveformMode: 'sequence' });
export function validDraft(rule) {
  if (!rule || typeof rule.enabled !== 'boolean' || typeof rule.syncChannels !== 'boolean' || (rule.scaleByLoss !== undefined && typeof rule.scaleByLoss !== 'boolean')) return false;
  try { for (const name of ['A', 'B']) normalizeRule(rule.channels?.[name]); return true; } catch { return false; }
}
export class RuleEditor {
  rows = new Map();
  constructor(container, onChange, context) { this.container = container; this.onChange = onChange; this.context = context; this.empty(); }
  empty() {
    if (this.rows.size) return;
    this.container.replaceChildren(); const note = document.createElement('p'); note.className = 'rules-empty';
    note.textContent = '还没有事件规则。选择触发事件，点击“添加事件”开始配置。'; this.container.append(note);
  }
  add(key, saved, notify = true) {
    if (!TRIGGERS.some(trigger => trigger.value === key)) throw new Error('未知触发事件');
    if (this.rows.has(key)) throw new Error('此事件已添加，请直接编辑下方规则');
    if (saved && !validDraft(saved)) throw new Error('已保存的规则格式无效');
    if (!this.rows.size) this.container.replaceChildren();
    const card = document.createElement('section'); card.className = 'event-rule-card'; card.dataset.trigger = key;
    card.setAttribute('aria-label', triggerLabel(key));
    card.innerHTML = `<div class="event-rule-heading"><div><h3 data-field="title"></h3><span data-field="state" class="rule-state">待配置</span></div><div class="event-rule-actions"><label class="rule-enable"><input data-field="enabled" type="checkbox">启用</label><button data-field="edit" class="text-button" type="button">编辑</button><button data-field="remove" class="text-button remove-rule" type="button">删除</button></div></div>
<div data-field="preview" class="event-rule-preview"></div>
<label data-field="point-toggle" class="point-scale-toggle" hidden><input data-field="scale" type="checkbox">按实际点炮失分缩放强度变化</label>
<div data-field="editor" class="event-rule-editor" hidden><p data-field="point-help" class="field-help" hidden>先将实际失分按千点四舍五入，再乘以变化系数。增加/减少缩放变化量，设置为则缩放目标强度。</p>
<label class="sync-label"><input data-field="sync" type="checkbox">A / B 通道使用相同规则</label>${channelFields('A','')}${channelFields('B','-b')}
<p data-field="error" class="rule-error" role="status"></p><button data-field="done" class="secondary rule-done" type="button">完成编辑</button></div>`;
    const fields = {};
    card.querySelectorAll('[data-field]').forEach(element => { fields[element.dataset.field] = element; });
    fields.title.textContent = triggerLabel(key);
    const initial = saved || { enabled: true, syncChannels: true, channels: { A: emptyChannel(), B: emptyChannel() } };
    fields.enabled.checked = initial.enabled; fields.sync.checked = initial.syncChannels;
    fields.scale.checked = key === 'deal-in' && initial.scaleByLoss !== false;
    fields['point-toggle'].hidden = fields['point-help'].hidden = key !== 'deal-in';
    const orders = {};
    for (const [name, suffix] of [['A',''],['B','-b']]) {
      const profile = normalizeRule(initial.channels[name]); orders[name] = [...profile.waveforms];
      for (const wave of WAVEFORMS) {
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.value = wave.value; input.checked = profile.waveforms.includes(wave.value);
        label.append(input, document.createTextNode(wave.label)); fields[`waves${suffix}`].append(label);
      }
      selectValue(fields[`mode${suffix}`], profile.mode); selectValue(fields[`action${suffix}`], profile.action);
      selectValue(fields[`wave-mode${suffix}`], profile.waveformMode);
      fields[`delta${suffix}`].value = String(profile.delta);
      fields[`seconds${suffix}`].value = String(profile.durationMs ? profile.durationMs / 1000 : 5);
    }
    const changed = () => { this.preview(); this.onChange(); };
    for (const [name, suffix] of [['A',''],['B','-b']]) {
      const number = fields[`delta${suffix}`], slider = fields[`slider${suffix}`];
      slider.addEventListener('input', () => { number.value = slider.value; });
      fields[`action${suffix}`].addEventListener('change', () => {
        if (fields[`action${suffix}`].value === 'set') number.value = String(Math.max(0, Math.min(200, Math.round(Number(number.value) || 0))));
      });
      number.addEventListener('wheel', event => {
        if (fields[`action${suffix}`].value !== 'set' || document.activeElement !== number || !event.deltaY) return;
        event.preventDefault();
        number.value = String(Math.max(0, Math.min(200, Math.round(Number(number.value) || 0) + (event.deltaY < 0 ? 1 : -1))));
        changed();
      }, { passive: false });
      number.addEventListener('change', () => {
        const value = Number(number.value);
        if (Number.isFinite(value)) number.value = String(Math.max(fields[`action${suffix}`].value === 'set' ? 0 : -200, Math.min(200, Math.round(value))));
      });
      const checkAll = checked => {
        fields[`waves${suffix}`].querySelectorAll('input').forEach(input => { input.checked = checked; });
        orders[name] = checked ? WAVEFORMS.map(wave => wave.value) : [];
        changed();
      };
      fields[`wave-all${suffix}`].addEventListener('click', () => checkAll(true));
      fields[`wave-none${suffix}`].addEventListener('click', () => checkAll(false));
    }
    card.querySelectorAll('input, select').forEach(input => { input.addEventListener('input', changed); input.addEventListener('change', changed); });
    fields.remove.addEventListener('click', () => this.remove(key));
    fields.edit.addEventListener('click', () => this.open(fields.editor.hidden ? key : null));
    fields.done.addEventListener('click', () => this.open(null));
    this.rows.set(key, { card, fields, orders }); this.container.append(card); this.open(notify ? key : null); this.preview();
    if (notify) this.onChange();
  }
  open(key) {
    for (const [id, { card, fields }] of this.rows) { fields.editor.hidden = id !== key; fields.edit.textContent = id === key ? '收起' : '编辑'; card.dataset.editing = String(id === key); }
  }
  remove(key) {
    const row = this.rows.get(key); if (!row) return;
    row.card.remove(); this.rows.delete(key); this.empty(); this.onChange();
  }
  snapshot() {
    return Object.fromEntries([...this.rows].map(([key, { fields, orders }]) => [key, {
      enabled: fields.enabled.checked, syncChannels: fields.sync.checked, scaleByLoss: key === 'deal-in' && fields.scale.checked,
      channels: Object.fromEntries([['A',''],['B','-b']].map(([name,suffix]) => {
        const checked = [...fields[`waves${suffix}`].querySelectorAll('input')].filter(input => input.checked).map(input => input.value);
        orders[name] = [...orders[name].filter(value => checked.includes(value)), ...checked.filter(value => !orders[name].includes(value))];
        const mode = fields[`mode${suffix}`].value, action = fields[`action${suffix}`].value;
        return [name, { mode, action, delta: isReset(mode) ? 0 : Number(fields[`delta${suffix}`].value),
          durationMs: isPersistent(mode) ? 0 : Math.round(Number(fields[`seconds${suffix}`].value) * 1000),
          waveforms: [...orders[name]], waveformMode: fields[`wave-mode${suffix}`].value }];
      })),
    }]));
  }
  preview() {
    const snapshot = this.snapshot();
    for (const [key, { fields }] of this.rows) {
      const rule = snapshot[key]; fields['panel-b'].hidden = rule.syncChannels;
      for (const [name, suffix] of [['A',''],['B','-b']]) {
        const profile = rule.channels[name];
        fields[`change${suffix}`].hidden = isReset(profile.mode);
        fields[`duration${suffix}`].hidden = isPersistent(profile.mode);
        fields[`delta${suffix}`].min = profile.action === 'set' ? '0' : '-200';
        const positive = profile.action === 'change' && profile.delta > 0;
        fields[`positive${suffix}`].hidden = !positive;
        fields[`number-wrap${suffix}`].dataset.positive = String(positive);
        fields[`slider${suffix}`].hidden = profile.action !== 'set';
        fields[`slider${suffix}`].value = String(Math.max(0, Math.min(200, Number.isFinite(profile.delta) ? profile.delta : 0)));
        fields[`delta-caption${suffix}`].textContent = rule.scaleByLoss ? profile.action === 'set' ? '每 1000 点目标强度' : '每 1000 点强度变化' : '强度变化';
        const labels = profile.waveforms.map(value => WAVEFORMS.find(wave => wave.value === value).label);
        fields[`wave-summary${suffix}`].textContent = labels.length ? labels.join(profile.waveformMode === 'random' ? '、' : ' → ') : '跟随 App 波形';
        fields[`wave-summary${suffix}`].dataset.follow = String(!labels.length);
        fields[`wave-note${suffix}`].textContent = labels.length ? isPersistent(profile.mode) ? '持久规则持续轮播，直到下一条规则或停止。' : '在惩罚时长内轮播勾选的波形。' : '未勾选时跟随 App 当前波形。';
      }
      const channelA = rule.channels.A, channelB = rule.syncChannels ? channelA : rule.channels.B;
      const equivalent = channelA.mode === channelB.mode && (isReset(channelA.mode) || (channelA.action === channelB.action && channelA.delta === channelB.delta)) &&
        channelA.durationMs === channelB.durationMs && channelA.waveformMode === channelB.waveformMode && channelA.waveforms.join() === channelB.waveforms.join();
      const displayed = equivalent ? [['A/B', channelA]] : [['A', channelA], ['B', channelB]];
      fields.preview.replaceChildren(...displayed.map(([name, profile]) => {
        const row = document.createElement('span'); row.className = 'rule-channel-summary';
        const channel = document.createElement('strong'); channel.textContent = `${name} 通道`;
        const description = document.createElement('span');
        const mode = { temporary: '临时变化', permanent: '持久变化', reset: '临时归零', 'permanent-reset': '持久归零' }[profile.mode];
        const value = profile.action === 'set' ? `调整到 ${profile.delta}` : `${profile.delta >= 0 ? '+' : ''}${profile.delta}`;
        description.textContent = `${mode}${isReset(profile.mode) ? '' : ` · ${rule.scaleByLoss ? '每千点 ' : ''}${value}`}${isPersistent(profile.mode) ? '' : ` · ${profile.durationMs / 1000} 秒`}`;
        if (profile.waveforms.length) row.title = `${profile.waveformMode === 'random' ? '随机' : '顺序'}波形：${profile.waveforms.map(value => WAVEFORMS.find(w => w.value === value).label).join(profile.waveformMode === 'random' ? '、' : ' → ')}`;
        row.append(channel, description); return row;
      }));
      if (!rule.enabled) { fields.state.textContent = '已暂停'; fields.error.textContent = ''; continue; }
      try {
        // Global intensity validation belongs to the common control / arm step,
        // not to every saved card. It remains enforced before any output.
        customPlan({ ...this.context(), maxIntensity: 200, channels: rule.channels, syncChannels: rule.syncChannels, scaleByLoss: rule.scaleByLoss });
        fields.state.textContent = '已配置'; fields.error.textContent = '';
      } catch (error) { fields.state.textContent = '待配置'; fields.error.textContent = error.message; }
    }
  }
}
