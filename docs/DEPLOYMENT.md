# Cloudflare Pages 部署

控制台由 Pages 托管。0.4.0 在根路径增加 WebSocket Function，通过外部 Worker 的 Durable Object 管理 V4 会话；普通 HTTPS 请求仍提供静态控制台。服务端不保存设备输出历史或配对凭据数据库。

## 本地

```sh
npm ci
npm test
npm run dev
```

打开 `http://127.0.0.1:4173`。该构建的脚本只信任这个精确来源，`localhost:4173` 不等价。`npm run preview` 可只启动已构建的静态站点。

## Git 集成配置

| 设置 | 值 |
| --- | --- |
| Framework preset | None |
| Root directory | 仓库根目录 |
| Build command | `npm run build` |
| Build output directory | `dist/site` |
| Environment variable | `DASHBOARD_ORIGIN=https://你的正式域名` |
| Node version | 22（仓库 `.node-version`） |

`wrangler.toml` 也声明了输出目录。GitHub 仓库为 `iSanae233/DGLab-Majsoul`；Pages 项目已部署，正式地址为 https://dglab-majsoul.pages.dev 。

本项目实际 Pages 域名为 `https://dglab-majsoul.pages.dev`，已在 `wrangler.toml` 的 `[vars]` 中配置 `DASHBOARD_ORIGIN`。Pages 读取 Wrangler 配置时，应以仓库中的变量为准；首次部署实测发现只在创建界面填写变量，构建仍可能报告没有变量。更换域名时同步修改此配置，并重新构建、部署和安装脚本。

### 避免误建为 Workers 项目

Cloudflare 的“Workers & Pages”入口包含两种不同项目。如果日志中出现单独的 **Deploy command: `npx wrangler deploy`**，并报 `Missing entry-point to Worker script or to assets directory`，说明进入了 Workers 构建流程。本仓库的 `pages_build_output_dir` 配置用于 Pages，不能交给这个 Workers 部署命令。

在 Cloudflare 创建 **Pages** 项目并连接本仓库，按上表填写构建命令和输出目录。Git 集成的 Pages 会在构建后自动上传静态输出，不需要添加 `npx wrangler deploy`。无需删除已有 Worker，避免误删其他配置。

构建脚本识别 `WORKERS_CI=1` 后会明确报出项目类型不匹配；Pages 或通用 CI 构建缺少 HTTPS `DASHBOARD_ORIGIN` 时，也会失败，避免错误地产生信任本地地址的线上脚本。

确定项目域名后，在生产构建环境中设置精确的 `DASHBOARD_ORIGIN`，例如 `https://dglab-majsoul.pages.dev`，然后构建。不要直接照抄示例域名，也不要使用通配符。

本地生成正式发布物：

```sh
DASHBOARD_ORIGIN=https://你的正式域名 npm run build
```

将完整 `dist/site` 作为静态产物部署。Cloudflare Pages 自动构建环境若没有设置此变量，构建会明确失败，避免发布仍信任本地地址的脚本。

官方参考：[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[静态响应头](https://developers.cloudflare.com/pages/configuration/headers/)。

## 独立中继部署（0.4.0）

需要先部署 `dglab-majsoul-relay` Worker，再部署 Pages。Pages 无法在自身项目内定义 Durable Object 类，因此 `RelaySession` 在独立 Worker 中定义并通过 `script_name` 绑定。

中继 Worker 的 Git 构建设置：

| 设置 | 值 |
| --- | --- |
| Repository | iSanae233/DGLab-Majsoul |
| Worker name | dglab-majsoul-relay |
| Build command | `node --version`（不执行前端的 Pages 构建） |
| Deploy command | `npx wrangler deploy --config relay/wrangler.toml` |
| Preview builds | 关闭，避免预览版本改变配对会话 |

`relay/wrangler.toml` 包含 SQLite Durable Object 的首次迁移；`workers_dev=false`，通过 Pages 的绑定访问。已有 CLI 授权时也可运行 `npm run deploy:relay`。

Pages 的 `wrangler.toml` 将 `RELAY_SESSIONS` 绑定到这个 Worker。默认地址为 `wss://dglab-majsoul.pages.dev`，App 配对地址为同一地址加 `?tid=<控制方ID>`。不依赖官方中继代转；自建中继只转发 V4 外层消息，不生成或修改设备指令。

控制方连接检查精确 `Origin`，App 连接使用随机 UUID 配对 ID；配对 ID 是访问会话的能力凭据，不应公开。每会话最多 8 个 App，文本帧上限 64KiB，无 App 时 5 分钟关闭控制连接。不同会话由不同 Durable Object 隔离；未知目标客户端不能跨会话转发。

线上无设备协议验收：`npm run check:relay:remote`（仅创建临时测试会话与模拟 App，不输出设备指令）。

本地验收：`npm run check:relay` 使用 Cloudflare 本地运行时，覆盖 Pages 路由、配对、双向 V4 消息、心跳、断开和会话隔离，不控制真实设备。SQLite Durable Objects 支持 Cloudflare Free 方案，但配额和实际费用以账号设置及 Cloudflare 官方价格为准；部署不包含升级付费方案。

## 本地 Pages 验收

```sh
DASHBOARD_ORIGIN=https://你的实际域名 npm run check:pages
```

该命令在 Pages 环境标记下构建，再启动锁定版本的 `wrangler pages dev`，检查首页、JS、CSS 和脚本下载的 HTTP 响应、CSP、COOP、缓存头及脚本来源绑定；结束后关闭临时服务。不会上传或部署，也不连接 DG-LAB 设备。

还没有域名时，可以用保留域名 `https://pages-build-check.invalid` 进行纯本地验收。这会生成仅用于验收的脚本，不应发布或安装后用于真实联动。检查结束后用实际域名重建，或运行 `npm run build` 恢复本地开发构建。

## 用户使用流程

1. 打开控制台，从站点链接安装或更新用户脚本。
2. 在控制台连接 V4 WSS 中继，用 DG-LAB 4 App 扫二维码，选择设备及通道。
3. 在控制台设置规则，初次保留模拟。
4. 点击“打开雀魂并连接脚本”。也可以先打开雀魂，在游戏小窗口点击“打开并关联控制台”；两种入口都会建立受校验的窗口引用。允许相应按钮打开新标签页。
5. 等控制台显示“雀魂脚本已连接”，再点击“应用设置并启用”。控制台保持打开。
6. 雀魂右上角展开小窗口，查看本地牌局事件和控制台返回的模拟、输出、停止或失败信息。

更换域名后必须重新构建、部署并更新用户脚本。预览部署地址不会自动获得信任；如需测试预览站点，应为其单独构建脚本。

刷新控制台会丢失窗口引用、配对和启用状态；可从雀魂小窗口重新打开并关联控制台，或关闭旧游戏窗口后从控制台重新打开。刷新雀魂会让控制台停用联动，当前局恢复动作不触发惩罚。浏览器扩展、弹窗策略或雀魂未来的隔离响应头可能切断窗口关系，此时脚本只在本页显示事件，不能启用控制。LIVE ACTIVITY 会报告尚未检测到脚本；应检查最新脚本是否启用及其游戏内版本标识。

## 通信边界

双向 `postMessage` 检查精确 `origin`、窗口 `source`、随机会话编号和脚本实例编号。点炮事件需要合法字段、新的消息序号以及不超过 10 秒的时间差。页面时钟相同，但后台标签页调度延迟仍可能导致事件过期并停用。

这些检查能隔离其他来源和其他标签页，并不能防御雀魂页面自身或控制台站点自身被入侵。两个来源都是信任边界的一部分。

配对凭据留在控制台内存；不通过事件桥接传给雀魂、不放入雀魂 URL，也不持久化。传输的是规范化牌局事件和操作文字，不传原始协议、认证 token 或手牌。

`web/_headers` 配置 CSP、禁止嵌入和缓存策略。`same-origin-allow-popups` 用于保留本控制台主动打开的跨源窗口，不要改成 `same-origin` 后仍假定桥接可用。CSP 的 `connect-src wss:` 允许用户自选 WSS 中继；控制台仅在用户点击连接后发起连接。

断开、超时或刷新会停用联动，重新握手不会自动恢复真实输出。两端心跳超时为 90 秒；设备任务期限最多 10 秒。网络或标签页被强制关闭时不能保证停止请求送达，应能在 App 或设备端手动停止。
