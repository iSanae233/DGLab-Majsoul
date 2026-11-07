import { TRIGGERS, triggerLabel } from '../src/triggers.mjs';
import { WAVEFORMS, STRENGTH_MODES, customPlan, pointDelta } from '../src/rules.mjs';

const channelFields = (channel, suffix) => `<fieldset class="rule-channel" data-field="panel${suffix}"><legend>${channel === 'A' ? 'A 通道 / 同步规则' : 'B 通道独立规则'}</legend><div class="two-columns">
<label class="field">${channel === 'B' ? 'B 通道' : ''}强度操作<select data-field="mode${suffix}"><option value="temporary" selected>强度临时变化</option><option value="permanent">强度永久变化</option><option value="reset">强度临时归零</option></select></label>
<label class="field"><span data-field="delta-caption${suffix}">${channel === 'B' ? 'B 通道' : ''}强度变化</span><input data-field="delta${suffix}" type="number" min="-40" max="40" step="1" value="0"><small>正数增加，负数减少</small></label>
<label class="field">${channel === 'B' ? 'B 通道' : ''}惩罚时长（秒）<input data-field="seconds${suffix}" type="number" min="0" max="60" step="0.1" value="5"></label>
<label class="field">${channel === 'B' ? 'B 通道' : ''}覆盖波形<select data-field="waveform${suffix}"><option value="" selected>保持 App 当前波形</option></select></label></div></fieldset>`;
function selectValue(select, value) {
  const options = [...select.querySelectorAll('option')]; options.forEach(option => { option.selected = false; });
  (options.find(option => option.value === value) || options[0]).selected = true;
}
const emptyChannel = () => ({ mode: 'temporary', delta: 0, durationMs: 5000, waveform: null });
export function validDraft(rule) {
  if (!rule || typeof rule.enabled !== 'boolean' || typeof rule.syncChannels !== 'boolean' || (rule.scaleByLoss !== undefined && typeof rule.scaleByLoss !== 'boolean')) return false;
  return ['A', 'B'].every(channel => {
    const profile = rule.channels?.[channel];
    return profile && Object.hasOwn(STRENGTH_MODES, profile.mode) && Number.isInteger(profile.delta) && Math.abs(profile.delta) <= 40 &&
      Number.isInteger(profile.durationMs) && profile.durationMs >= 0 && profile.durationMs <= 60000 &&
      (!profile.waveform || WAVEFORMS.some(wave => wave.value === profile.waveform));
  });
}
export class RuleEditor {
  rows = new Map();
  constructor(container, onChange, context) { this.container = container; this.onChange = onChange; this.context = context; this.empty(); }
  empty() {
    if (this.rows.size) return;
    this.container.replaceChildren(); const note = document.createElement('p'); note.className = 'rules-empty';
    note.textContent = '还没有事件规则。选择一个触发事件，点击“添加事件”开始配置。'; this.container.append(note);
  }
  add(key, saved, notify = true) {
    if (!TRIGGERS.some(trigger => trigger.value === key)) throw new Error('未知触发事件');
    if (this.rows.has(key)) throw new Error('此事件已添加，请直接编辑下方规则');
    if (saved && !validDraft(saved)) throw new Error('已保存的规则格式无效');
    if (!this.rows.size) this.container.replaceChildren();
    const card = document.createElement('section'); card.className = 'event-rule-card'; card.dataset.trigger = key;
    card.setAttribute('aria-label', triggerLabel(key));
    card.innerHTML = `<div class="event-rule-heading"><div><h3 data-field="title"></h3><span data-field="state" class="rule-state">待配置</span></div><div class="event-rule-actions"><label class="rule-enable"><input data-field="enabled" type="checkbox">启用</label><button data-field="edit" class="text-button" type="button">编辑</button><button data-field="remove" class="text-button remove-rule" type="button">删除</button></div></div>
<p data-field="preview" class="event-rule-preview"></p>
<div data-field="editor" class="event-rule-editor" hidden>
<div data-field="point-options" class="point-options" hidden><label class="sync-label"><input data-field="scale" type="checkbox">按实际点炮失分缩放强度变化</label><p class="field-help">变化值按每 1000 点填写，最终变化四舍五入。例如系数 +1，3900 点为 +4；实际输出仍受当前强度与上限限制。归零操作不按失分增加强度。</p></div>
<label class="sync-label"><input data-field="sync" type="checkbox">A / B 通道使用相同规则</label>${channelFields('A','')}${channelFields('B','-b')}
<p data-field="error" class="rule-error" role="status"></p><button data-field="done" class="secondary rule-done" type="button">完成编辑</button></div>`;
    const fields = {};
    card.querySelectorAll('[data-field]').forEach(element => { fields[element.dataset.field] = element; });
    fields.title.textContent = triggerLabel(key);
    const initial = saved || { enabled: true, syncChannels: true, channels: { A: emptyChannel(), B: emptyChannel() } };
    fields.enabled.checked = initial.enabled; fields.sync.checked = initial.syncChannels;
    fields.scale.checked = key === 'deal-in' && initial.scaleByLoss !== false; fields['point-options'].hidden = key !== 'deal-in';
    for (const [name, suffix] of [['A',''],['B','-b']]) {
      WAVEFORMS.forEach(wave => { const option = document.createElement('option'); option.value = wave.value; option.textContent = wave.label; fields[`waveform${suffix}`].append(option); });
      const profile = initial.channels[name];
      selectValue(fields[`mode${suffix}`], profile.mode); selectValue(fields[`waveform${suffix}`], profile.waveform || '');
      fields[`delta${suffix}`].value = String(profile.delta); fields[`seconds${suffix}`].value = String(profile.durationMs / 1000);
    }
    const changed = () => { this.preview(); this.onChange(); };
    card.querySelectorAll('input, select').forEach(input => { input.addEventListener('input', changed); input.addEventListener('change', changed); });
    fields.remove.addEventListener('click', () => this.remove(key));
    fields.edit.addEventListener('click', () => this.open(fields.editor.hidden ? key : null));
    fields.done.addEventListener('click', () => this.open(null));
    this.rows.set(key, { card, fields }); this.container.append(card); this.open(notify ? key : null); this.preview();
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
    return Object.fromEntries([...this.rows].map(([key, { fields }]) => [key, {
      enabled: fields.enabled.checked, syncChannels: fields.sync.checked, scaleByLoss: key === 'deal-in' && fields.scale.checked,
      channels: Object.fromEntries([['A',''],['B','-b']].map(([name,suffix]) => [name, {
        mode: fields[`mode${suffix}`].value, delta: Number(fields[`delta${suffix}`].value),
        durationMs: Math.round(Number(fields[`seconds${suffix}`].value) * 1000), waveform: fields[`waveform${suffix}`].value || null,
      }])),
    }]));
  }
  preview() {
    const snapshot = this.snapshot();
    for (const [key, { fields }] of this.rows) {
      const rule = snapshot[key]; fields['panel-b'].hidden = rule.syncChannels;
      fields.delta.disabled = rule.channels.A.mode === 'reset'; fields['delta-b'].disabled = rule.channels.B.mode === 'reset';
      fields['delta-caption'].textContent = rule.scaleByLoss ? '每 1000 点强度变化' : '强度变化';
      fields['delta-caption-b'].textContent = rule.scaleByLoss ? 'B 通道每 1000 点强度变化' : 'B 通道强度变化';
      const channelA = rule.channels.A, channelB = rule.syncChannels ? channelA : rule.channels.B;
      const equivalent = channelA.mode === channelB.mode && (channelA.mode === 'reset' || channelA.delta === channelB.delta) &&
        channelA.durationMs === channelB.durationMs && (channelA.waveform || null) === (channelB.waveform || null);
      const displayed = equivalent ? [['A/B', channelA]] : [['A', channelA], ['B', channelB]];
      const signed = value => `${value >= 0 ? '+' : ''}${value}`;
      fields.preview.replaceChildren(...displayed.map(([name, profile]) => {
        const mode = { temporary: '临时', permanent: '永久', reset: '归零' }[profile.mode];
        const change = profile.mode === 'reset' ? '' : rule.scaleByLoss ? ` 每千点 ${signed(profile.delta)}（3900点 ${signed(pointDelta(profile.delta,3900))}）` : ` ${signed(profile.delta)}`;
        const wave = profile.waveform ? ` · ${WAVEFORMS.find(item => item.value === profile.waveform)?.label}` : '';
        const row = document.createElement('span'); row.className = 'rule-channel-summary';
        const channel = document.createElement('strong'); channel.textContent = name;
        const description = document.createElement('span'); description.textContent = `${mode}${change} · ${profile.durationMs / 1000}s${wave}`;
        row.append(channel, description); return row;
      }));
      if (!rule.enabled) { fields.state.textContent = '已停用'; fields.error.textContent = ''; continue; }
      try {
        customPlan({ ...this.context(), channels: rule.channels, syncChannels: rule.syncChannels, scaleByLoss: rule.scaleByLoss });
        fields.state.textContent = '已配置'; fields.error.textContent = '';
      } catch (error) { fields.state.textContent = '待配置'; fields.error.textContent = error.message; }

    }
  }
}
