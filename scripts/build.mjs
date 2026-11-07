import { build } from 'esbuild';
import { cp, mkdir, rm, readFile } from 'node:fs/promises';
const originInput = process.env.DASHBOARD_ORIGIN || 'http://127.0.0.1:4173';
if (process.env.CF_PAGES && !process.env.DASHBOARD_ORIGIN) throw new Error('Pages 构建必须设置 DASHBOARD_ORIGIN');
const origin = new URL(originInput);
if (origin.href !== `${origin.origin}/` || origin.username || origin.password ||
    !(origin.protocol === 'https:' || (origin.protocol === 'http:' && origin.origin === 'http://127.0.0.1:4173'))) {
  throw new Error('DASHBOARD_ORIGIN 必须为精确 HTTPS 来源，或本地 http://127.0.0.1:4173');
}
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const header = `// ==UserScript==
// @name         DGLab-Majsoul 事件桥接
// @namespace    dglab-majsoul-local
// @version      ${version}
// @description  将雀魂事件交给可信控制台，并显示惩罚操作
// @match        https://game.maj-soul.com/*
// @match        https://game.mahjongsoul.com/*
// @match        https://mahjongsoul.game.yo-star.com/*
// @run-at       document-start
// @grant        none
// @noframes
// @license      AGPL-3.0-or-later
// ==/UserScript==`;
await rm('dist', { recursive: true, force: true });
await mkdir('dist/site/userscripts', { recursive: true });
const common = { bundle: true, platform: 'browser', target: ['chrome110', 'firefox115'], legalComments: 'inline', minify: false };
await build({ ...common, entryPoints: ['src/index.mjs'], format: 'iife', outfile: 'dist/dglab-majsoul.user.js',
  define: { __DASHBOARD_ORIGIN__: JSON.stringify(origin.origin) }, banner: { js: header } });
await cp('dist/dglab-majsoul.user.js', 'dist/site/userscripts/dglab-majsoul.user.js');
await build({ ...common, entryPoints: ['web/main.mjs'], format: 'esm', outfile: 'dist/site/app.js' });
for (const file of ['index.html', 'style.css', '_headers']) await cp(`web/${file}`, `dist/site/${file}`);
console.log(`Built ${version}; trusted dashboard: ${origin.origin}; Pages output: dist/site`);
