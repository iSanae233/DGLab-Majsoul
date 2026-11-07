import { COYOTE_WAVEFORMS } from 'dglab-kit';
import { TRIGGERS, triggerLabel } from './triggers.mjs';
export const WAVEFORMS = Object.entries(COYOTE_WAVEFORMS).map(([value, wave]) => ({ value, label: wave.label.cn }));
export const STRENGTH_MODES = { temporary: '强度临时变化', permanent: '强度永久变化', reset: '强度临时归零' };
export function customPlan(config) {
  if (!Number.isInteger(config.maxIntensity) || config.maxIntensity < 1 || config.maxIntensity > 200) throw new Error('请设置 1–200 的强度上限');
  if (!['A', 'B', 'both'].includes(config.targetChannel)) throw new Error('请选择目标通道');
  const selected = config.targetChannel === 'both' ? ['A', 'B'] : [config.targetChannel];
  const channels = {};
  for (const channel of selected) {
    const rule = config.channels?.[config.syncChannels ? 'A' : channel];
    if (!rule || !Object.hasOwn(STRENGTH_MODES, rule.mode)) throw new Error('请选择有效的强度操作');
    if (!Number.isInteger(rule.delta) || Math.abs(rule.delta) > 40) throw new Error('自定义强度变化需为 -40 至 +40 的整数');
    if (!Number.isInteger(rule.durationMs) || rule.durationMs < 0 || rule.durationMs > 60000 ||
        (rule.mode !== 'permanent' && rule.durationMs < 100)) throw new Error('临时操作需 0.1–60 秒，永久变化可设 0 秒');
    const waveform = rule.waveform || null;
    if (waveform && !Object.hasOwn(COYOTE_WAVEFORMS, waveform)) throw new Error('请选择有效的覆盖波形');
    if (rule.mode !== 'reset' && rule.delta === 0 && (!waveform || rule.durationMs === 0)) throw new Error('请设置强度变化或覆盖波形');
    channels[channel] = { mode: rule.mode, delta: rule.mode === 'reset' ? 0 : rule.delta, durationMs: rule.durationMs, waveform };
  }
  return { strategy: 'custom', maxIntensity: config.maxIntensity, channels };
}
export function describePlan(plan) {
  return Object.entries(plan.channels).map(([channel, rule]) => `${channel} 通道：${STRENGTH_MODES[rule.mode]}${rule.mode === 'reset' ? '' : ` ${rule.delta >= 0 ? '+' : ''}${rule.delta}`}，${rule.durationMs / 1000} 秒${rule.waveform ? `，波形 ${WAVEFORMS.find(w => w.value === rule.waveform)?.label}` : '，保持 App 波形'}`).join('；');
}
export function customEventPlans(config) {
  if (!config.eventRules) return [{ trigger: 'deal-in', plan: customPlan(config) }];
  if (typeof config.eventRules !== 'object' || Array.isArray(config.eventRules) ||
    Object.keys(config.eventRules).some(key => !TRIGGERS.some(trigger => trigger.value === key))) throw new Error('存在未知的触发事件');
  const enabled = TRIGGERS.filter(trigger => Object.hasOwn(config.eventRules, trigger.value) && config.eventRules[trigger.value]?.enabled === true);
  if (!enabled.length) throw new Error('请至少启用一个触发事件');
  return enabled.map(trigger => {
    const rule = config.eventRules[trigger.value];
    try { return { trigger: trigger.value, plan: customPlan({ ...config, channels: rule.channels, syncChannels: rule.syncChannels }) }; }
    catch (error) { throw new Error(`${triggerLabel(trigger.value)}：${error.message}`); }
  });
}
