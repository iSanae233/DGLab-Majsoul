import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDashboardOrigin } from '../scripts/build-config.mjs';

test('local default and explicit HTTPS origin are supported', () => {
  assert.equal(resolveDashboardOrigin({}), 'http://127.0.0.1:4173');
  assert.equal(resolveDashboardOrigin({ CF_PAGES: '1', DASHBOARD_ORIGIN: 'https://control.example/' }), 'https://control.example');
  assert.equal(resolveDashboardOrigin({ CF_PAGES: '0', CI: 'false' }), 'http://127.0.0.1:4173');
});
test('Workers Builds is rejected with the actual deployment-mode diagnosis', () => {
  assert.throws(() => resolveDashboardOrigin({ WORKERS_CI: '1' }), /Workers Builds.*Cloudflare Pages/);
});
test('cloud builds cannot silently trust localhost or infer trust from preview URLs', () => {
  for (const env of [{ CF_PAGES: '1' }, { CI: 'true' }, { CF_PAGES: '1', CF_PAGES_URL: 'https://hash.project.pages.dev' },
    { CF_PAGES: '1', DASHBOARD_ORIGIN: 'http://127.0.0.1:4173' }]) {
    assert.throws(() => resolveDashboardOrigin(env));
  }
});
test('malformed, path-bearing, insecure and credential-bearing origins are rejected', () => {
  for (const DASHBOARD_ORIGIN of ['not-a-url', 'https://control.example/path', 'http://control.example', 'https://user:password@control.example', 'https://control.example?key=value']) {
    assert.throws(() => resolveDashboardOrigin({ DASHBOARD_ORIGIN }));
  }
});
