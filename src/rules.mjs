import { COYOTE_WAVEFORMS } from 'dglab-kit';
import { TRIGGERS, triggerLabel } from './triggers.mjs';
export const WAVEFORMS = Object.entries(COYOTE_WAVEFORMS).map(([value, wave]) => ({ value, label: wave.label.cn }));
export const STRENGTH_MODES = { temporary: '强度临时变化', permanent: '强度持久变化', reset: '强度临时归零', 'permanent-reset': '强度持久归零' };
export const isPersistent = mode => mode === 'permanent' || mode === 'permanent-reset';
export const isReset = mode => mode === 'reset' || mode === 'permanent-reset';
export function normalizeRule(rule) {
  if (!rule || !Object.hasOwn(STRENGTH_MODES, rule.mode)) throw new Error('请选择有效的强度操作');
  const previousAction = rule.action ?? 'change';
  if (!['change', 'add', 'subtract', 'set'].includes(previousAction)) throw new Error('请选择变化或调整到');
  const action = previousAction === 'set' ? 'set' : 'change';
  const delta = isReset(rule.mode) ? 0 : rule.delta;
  if (!Number.isInteger(delta) || (action === 'set' ? delta < 0 || delta > 200 : Math.abs(delta) > 200)) throw new Error('变化需为 -200 至 +200，调整到需为 0–200 的整数');
  const durationMs = isPersistent(rule.mode) ? 0 : rule.durationMs;
  if (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > 60000) throw new Error('临时操作时长需为 0.1–60 秒');
  const waveforms = rule.waveforms === undefined ? (rule.waveform ? [rule.waveform] : []) : rule.waveforms;
  if (!Array.isArray(waveforms) || waveforms.length > WAVEFORMS.length || new Set(waveforms).size !== waveforms.length ||
    waveforms.some(key => !Object.hasOwn(COYOTE_WAVEFORMS, key))) throw new Error('请选择有效且不重复的波形');
  const waveformMode = rule.waveformMode ?? 'sequence';
  if (!['sequence', 'random'].includes(waveformMode)) throw new Error('请选择波形播放方式');
  return { mode: rule.mode, action, delta, durationMs, waveforms: [...waveforms], waveformMode };
}
export function pointDelta(delta, loss) {
  if (!Number.isFinite(delta) || !Number.isSafeInteger(loss) || loss <= 0 || loss > 10000000) throw new Error('点炮失分或变化系数无效');
  const result = Math.round(loss / 1000) * delta;
  return result === 0 ? 0 : result;
}
export function customPlan(config) {
  if (!Number.isInteger(config.maxIntensity) || config.maxIntensity < 1 || config.maxIntensity > 200) throw new Error('请设置 1–200 的强度上限');
  if (!['A', 'B', 'both'].includes(config.targetChannel)) throw new Error('请选择目标通道');
  const selected = config.targetChannel === 'both' ? ['A', 'B'] : [config.targetChannel];
  const channels = {};
  for (const channel of selected) {
    const rule = config.channels?.[config.syncChannels ? 'A' : channel];
    const normalized = normalizeRule(rule);
    if (!isPersistent(normalized.mode) && normalized.durationMs < 100) throw new Error('临时操作时长需为 0.1–60 秒');
    if (!isReset(normalized.mode) && normalized.action !== 'set' && normalized.delta === 0 && !normalized.waveforms.length) throw new Error('请设置强度变化或勾选波形');
    channels[channel] = normalized;
  }
  return { strategy: 'custom', maxIntensity: config.maxIntensity, channels, scaleByLoss: config.scaleByLoss === true };
}
export function describePlan(plan) {
  return Object.entries(plan.channels).map(([channel, rule]) => {
    const scaled = plan.scaleByLoss && !isReset(rule.mode) && plan.loss;
    const delta = scaled ? pointDelta(rule.delta, plan.loss) : rule.delta;
    const change = isReset(rule.mode) ? '' : rule.action === 'set' ? ` 调整到 ${delta}` : ` ${delta >= 0 ? '+' : ''}${delta}`;
    const duration = isPersistent(rule.mode) ? '' : `，${rule.durationMs / 1000} 秒`;
    const waves = rule.waveforms?.length ? `，${rule.waveformMode === 'random' ? '随机' : '顺序'}波形 ${rule.waveforms.map(key => WAVEFORMS.find(w => w.value === key).label).join(rule.waveformMode === 'random' ? '、' : ' → ')}` : '，跟随 App 波形';
    return `${channel} 通道：${STRENGTH_MODES[rule.mode]}${change}${plan.scaleByLoss && !scaled && !isReset(rule.mode) ? ' / 每千点' : ''}${duration}${waves}`;
  }).join('；');
}
export function customEventPlans(config) {
  if (!config.eventRules) return [{ trigger: 'deal-in', plan: customPlan(config) }];
  if (typeof config.eventRules !== 'object' || Array.isArray(config.eventRules) ||
    Object.keys(config.eventRules).some(key => !TRIGGERS.some(trigger => trigger.value === key))) throw new Error('存在未知的触发事件');
  const enabled = TRIGGERS.filter(trigger => Object.hasOwn(config.eventRules, trigger.value) && config.eventRules[trigger.value]?.enabled === true);
  if (!enabled.length) throw new Error('请至少启用一个触发事件');
  return enabled.map(trigger => {
    const rule = config.eventRules[trigger.value];
    if (trigger.value !== 'deal-in' && rule.scaleByLoss === true) throw new Error('只有自己点炮可按失分缩放');
    try { return { trigger: trigger.value, plan: customPlan({ ...config, channels: rule.channels, syncChannels: rule.syncChannels, scaleByLoss: rule.scaleByLoss === true }) }; }
    catch (error) { throw new Error(`${triggerLabel(trigger.value)}：${error.message}`); }
  });
}
