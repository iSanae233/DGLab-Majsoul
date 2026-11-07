import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const env = { ...process.env, CF_PAGES: '1', WRANGLER_SEND_METRICS: 'false' };
if (!env.DASHBOARD_ORIGIN) throw new Error('请设置实际 DASHBOARD_ORIGIN；纯本地验收可使用 https://pages-build-check.invalid');
console.log(`Pages check on Node ${process.version}`);
const build = spawn(process.execPath, ['scripts/build.mjs'], { env, stdio: 'inherit' });
const [buildCode] = await once(build, 'exit');
if (buildCode !== 0) process.exit(buildCode || 1);
const portServer = net.createServer();
portServer.listen(0, '127.0.0.1'); await once(portServer, 'listening');
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const temporary = await mkdtemp(path.join(tmpdir(), 'dglab-pages-check-'));
const server = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'dev', 'dist/site', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0', '--persist-to', path.join(temporary, 'state')], {
  env: { ...env, XDG_CONFIG_HOME: temporary, WRANGLER_LOG_PATH: path.join(temporary, 'wrangler.log'), CHOKIDAR_USEPOLLING: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = ''; let exitCode;
server.stdout.on('data', chunk => { output = (output + chunk).slice(-100000); });
server.stderr.on('data', chunk => { output = (output + chunk).slice(-100000); });
server.on('exit', code => { exitCode = code; });
try {
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (exitCode !== undefined) throw new Error(`Wrangler exited (${exitCode})\n${output}`);
    try { ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Wrangler Pages did not start\n${output}`);
  for (const path of ['/', '/app.js', '/style.css', '/userscripts/dglab-majsoul.user.js']) {
    const response = await fetch(url + path, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups', path);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/, path);
    const body = await response.text();
    if (path === '/') assert.match(body, /DGLab-Majsoul/);
    if (path.endsWith('.user.js')) {
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.ok(body.includes(new URL(env.DASHBOARD_ORIGIN).origin));
      assert.equal(body, await readFile('dist/dglab-majsoul.user.js', 'utf8'));
    }
    console.log(`PASS ${path}: HTTP 200 and Pages headers`);
  }
  console.log('PASS Wrangler Pages static assets, origin binding and _headers');
} finally {
  server.kill('SIGTERM');
  if (exitCode === undefined) await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (exitCode === undefined) server.kill('SIGKILL');
  await rm(temporary, { recursive: true, force: true });
}
