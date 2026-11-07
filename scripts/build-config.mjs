const enabled = value => value === '1' || value === 'true';

export function resolveDashboardOrigin(env) {
  if (enabled(env.WORKERS_CI)) {
    throw new Error('当前是 Workers Builds，本仓库配置为 Cloudflare Pages。请创建 Pages 项目并设置输出目录 dist/site；不要使用 npx wrangler deploy。');
  }
  const cloudBuild = enabled(env.CF_PAGES) || enabled(env.CI);
  if (cloudBuild && !env.DASHBOARD_ORIGIN) {
    throw new Error('线上构建必须设置 DASHBOARD_ORIGIN 为实际控制台的 HTTPS 来源，不能使用本地地址。');
  }
  const origin = new URL(env.DASHBOARD_ORIGIN || 'http://127.0.0.1:4173');
  if (origin.href !== `${origin.origin}/` || origin.username || origin.password ||
      !(origin.protocol === 'https:' || (!cloudBuild && origin.origin === 'http://127.0.0.1:4173'))) {
    throw new Error('DASHBOARD_ORIGIN 必须为精确 HTTPS 来源；仅本地开发允许 http://127.0.0.1:4173。');
  }
  return origin.origin;
}
