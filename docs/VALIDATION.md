# 验证记录

## 2026-11-07

- 独立仓库，无原项目 Git 历史。
- `npm test`：10 项测试通过。
- `npm run build`：生成 `dist/dglab-majsoul.user.js`。
- Chrome + Tampermonkey，页面 `https://game.maj-soul.com/1/`：观察器成功显示。
- 真实三人友人场：画面中有电脑玩家；实际观察到 `game-start`（`playerCount: 3`，`me: 1`）、`resync`、`round-start`、`discard`、`north-extraction`、`kan`（`kind: 3`）。进入下一局后仍持续观察到事件。
- 上述为已有友人场中的实测观察，不声称创建房间和添加电脑的 UI 步骤由代理完成。
- 刷新后游戏画面恢复，但浏览器自动化多次断开或超时，未成功读取刷新后的观察器内容，因此不能认定断线恢复验证通过。
- 其他事件、四人友人场、地区服务器、浏览器和断线恢复仍需分别验证。单元测试不替代这些实测。

没有连接 DG-LAB 设备或调用设备控制服务。

## 0.2.0 点炮联动实现

- 新增实际结算失分的点炮事件、线性临时强度换算、固定时长及上限。
- 默认模拟、手动启用、任务去重、不排队、不自动重试、停止入口。
- 集成官方 dglab-kit 1.0.5；使用 SDK 手动传输与模拟 App 响应验证真实 V4 帧，包括 hello 配对、设备发现、临时强度、波形和清理/归零。
- `npm test`：17 项通过；`npm run build`：通过。
- 未完成：0.2.0 用户界面的浏览器实测、真实点炮结算实测、真实 DG-LAB App/设备配对与输出。未连接设备，没有执行实际惩罚。

## 0.3.0 Pages 控制台与脚本桥接

- 控制台负责 WSS 设备配对、规则与任务执行；脚本只解析事件、桥接规范化消息和显示操作结果。
- 精确控制台来源由 DASHBOARD_ORIGIN 编译绑定；默认仅本地 http://127.0.0.1:4173 。
- 新增跨页握手、来源/窗口/会话/实例检查、序号去重与过期点炮拒绝，以及控制台 DOM 挂载和未连接禁止启用测试。
- 23 项测试通过。DOM 测试使用 linkedom，通信测试使用窗口替身，不代表真实跨源标签页已验收。
- 本地 HTTP 检查：首页、app.js、style.css 和脚本下载均返回 200；站点脚本与独立副本一致，用户脚本中不含设备控制实现。
- 已验证带路径的非法可信来源、Pages 构建缺失 DASHBOARD_ORIGIN 会被拒绝。
- 浏览器预览工具本次超时，无法完成视觉验证。尚未实测 0.3.0 用户脚本与真实雀魂页面之间的桥接、真实 App/主机输出。
- 构建输出 dist/site，Cloudflare Pages 配置与本地运行方法见 DEPLOYMENT.md。用户要求先完成代码与配置，本次未进行线上部署。

## Cloudflare 构建与部署模式检查（2026-11-07）

通过 Google Chrome 的 Cloudflare 构建日志确认：提交 5257c75 的 `npm run build` 已成功；失败发生在 Workers 项目的 `npx wrangler deploy`，报 `Missing entry-point to Worker script or to assets directory`。原构建还回落到了本地可信来源，不可直接用作线上脚本。

本地改动：明确拒绝 Workers Builds；Pages/通用 CI 缺少 HTTPS DASHBOARD_ORIGIN 时提前失败；新增锁定 Wrangler 4.158.0 的 check:pages 命令。

已验证：

- 在独立临时目录，Node 22.23.4 从 package-lock.json 干净安装依赖。
- 27 项测试通过，包括构建环境与来源验证回归。
- CF_PAGES=1、保留域名 https://pages-build-check.invalid 的构建通过。
- 使用 Wrangler 4.158.0 的 pages dev 启动本地 Pages 服务；首页、app.js、style.css、脚本下载均返回 200。
- 校验真实 Pages 服务返回的 CSP、COOP、nosniff、脚本 no-store，以及脚本的精确可信来源与独立副本一致性。
- 临时 Pages 服务在验收结束后关闭。原工作目录最终恢复本地开发构建。

环境为 macOS arm64 + Node 22，并非 Cloudflare 的完整 Linux 构建镜像。未修改云端项目或触发部署；检查域名为保留域名，不代表真实站点。0.3.0 的真实浏览器桥接和设备输出仍未验收。

## 0.4.0 前端与独立中继

- 默认地址改为 wss://dglab-majsoul.pages.dev 。改动前浏览器实测此地址连接失败；原部署没有 WebSocket 服务端。
- 新界面分为设备连接、点炮规则、游戏接入和实时记录；增加状态条、实时换算预览和移动端布局。默认仍为模拟、零强度和停用。
- 修复设备更新重置选择、旧连接回调覆盖新连接、配对失败/断开后残留旧二维码的问题。
- 新增 Pages 根路径 WebSocket Function 和独立 Worker/SQLite Durable Object。普通 HTTPS 请求保留静态内容；中继不处理游戏数据和设备指令内容。
- 27 项测试通过；check:relay 使用本地 Cloudflare 运行时验证配对、双向消息、心跳、断开通知、Origin 检查和会话隔离。Wrangler relay deploy dry-run 通过；Pages 静态资源与响应头验收通过。
- 新界面已在本地 Chrome 查看。真实 App/主机输出仍待验收；不得把模拟 App 响应视为硬件验证。
