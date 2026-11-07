import { customPlan, describePlan } from './rules.mjs';

export function penaltyFor(loss, config) {
  if (config.strategy === 'custom') return customPlan(config);
  const { per1000, maxIntensity, durationMs } = config;
  if (!Number.isSafeInteger(loss) || loss <= 0 ||
      !Number.isFinite(per1000) || per1000 <= 0 ||
      !Number.isInteger(maxIntensity) || maxIntensity < 1 || maxIntensity > 200 ||
      !Number.isInteger(durationMs) || durationMs < 100 || durationMs > 10000) {
    throw new Error('请设置有效的换算、强度上限和时长（100–10000ms）');
  }
  return { intensity: Math.min(maxIntensity, Math.ceil(loss / 1000 * per1000)), durationMs };
}

export class PenaltyEngine {
  enabled = false;
  busy = false;
  generation = 0;
  seen = new Set();
  config = { per1000: 0, maxIntensity: 0, durationMs: 5000, simulation: true };
  constructor(transport, log) { this.transport = transport; this.log = log; }
  arm(config) {
    penaltyFor(1000, config);
    if (!config.simulation && !this.transport.ready()) throw new Error('请先配对并选择设备通道');
    this.config = JSON.parse(JSON.stringify(config));
    this.generation++;
    this.enabled = true;
  }
  async stop() {
    this.generation++;
    this.enabled = false;
    await this.transport.stop();
  }
  async handle(event) {
    if (['capture-error', 'protocol-error', 'connection-closed', 'resync', 'game-end'].includes(event.type)) {
      if (this.enabled) {
        this.enabled = false;
        this.log('联动已暂停，请在下一局开始后重新启用');
        await this.stop();
      }
      return;
    }
    if (!this.enabled || event.type !== 'deal-in') return;
    const key = `${event.connection}:${event.round}:${event.step}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value);
    if (this.busy) { this.log('已有任务，跳过本次惩罚（不排队）'); return; }
    const command = penaltyFor(event.loss, this.config);
    if (this.config.simulation) { this.log(command.strategy === 'custom' ? `模拟：点炮失分 ${event.loss}；${describePlan(command)}` : `模拟：点炮失分 ${event.loss}，临时强度 ${command.intensity}，${command.durationMs}ms`); return; }
    if (!this.transport.ready()) { this.enabled = false; this.log('设备不可用，已暂停'); return; }
    this.busy = true;
    const generation = this.generation;
    try {
      this.log(command.strategy === 'custom' ? `请求：点炮失分 ${event.loss}；${describePlan(command)}` : `请求：点炮失分 ${event.loss}，临时强度上限 ${command.intensity}，${command.durationMs}ms`);
      const result = await this.transport.fire(command);
      if (generation !== this.generation) return;
      this.log(result?.details ? `任务已返回成功；${result.details.map(item => `${item.channel} 通道下发变化 ${item.delta >= 0 ? '+' : ''}${item.delta}`).join('；')}` : result?.skipped ? 'App 通道上限为零或无有效变化，未下发任务' :
        `任务已返回成功；下发临时强度 ${result?.intensity ?? command.intensity}，${command.durationMs}ms`);
    } catch {
      if (generation !== this.generation) return;
      this.enabled = false;
      this.log('任务失败或响应超时，已暂停；不自动重试');
      await this.stop();
    } finally { this.busy = false; }
  }
}
