import { build } from 'esbuild';
import { cp, mkdir, rm, readFile } from 'node:fs/promises';
import { resolveDashboardOrigin } from './build-config.mjs';
const origin = resolveDashboardOrigin(process.env);
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
await mkdir('dist/site/link', { recursive: true });
const common = { bundle: true, platform: 'browser', target: ['chrome110', 'firefox115'], legalComments: 'inline', minify: false };
await build({ ...common, entryPoints: ['src/index.mjs'], format: 'iife', outfile: 'dist/dglab-majsoul.user.js',
  define: { __DASHBOARD_ORIGIN__: JSON.stringify(origin) }, banner: { js: header } });
await cp('dist/dglab-majsoul.user.js', 'dist/site/userscripts/dglab-majsoul.user.js');
await build({ ...common, entryPoints: ['web/main.mjs'], format: 'esm', outfile: 'dist/site/app.js' });
for (const file of ['index.html', 'style.css', '_headers', '_routes.json']) await cp(`web/${file}`, `dist/site/${file}`);
await cp('web/index.html', 'dist/site/link/index.html');
console.log(`Built ${version}; trusted dashboard: ${origin}; Pages output: dist/site`);
