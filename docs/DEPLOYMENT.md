# 部署说明

本项目使用 Cloudflare Pages 托管首页和配置页，通过独立 Worker 的 Durable Object 提供 V4 WebSocket 中继。

当前站点：

- 首页：`https://dglab-majsoul.pages.dev/`
- 配置页：`https://dglab-majsoul.pages.dev/play/`
- 中继：`wss://dglab-majsoul.pages.dev`

同一域名下，普通 HTTPS 请求返回页面，WebSocket 请求交给中继处理。

## 本地运行

使用 Node.js 22+：

```sh
npm ci
npm test
npm run dev
```

打开 `http://127.0.0.1:4173`，再从首页进入配置页。`npm run preview` 只启动已构建的静态站点。

本地构建的脚本只信任 `http://127.0.0.1:4173`，`localhost:4173` 不等价。正式中继只接受配置的控制台来源；本地真实配对需要使用接受本地来源的中继。

## 部署顺序

先部署中继 Worker，再部署 Pages。两个项目连接同一个 GitHub 仓库，但构建方式不同。

本仓库在 `relay/worker.mjs` 定义 `RelaySession`，Pages 通过 `script_name` 绑定它。中继只转发 V4 外层消息，不生成或修改设备指令，也不保存设备输出历史。

### 中继 Worker

| 设置 | 值 |
| --- | --- |
| Repository | `iSanae233/DGLab-Majsoul` |
| Worker name | `dglab-majsoul-relay` |
| Build command | `node --version` |
| Deploy command | `npx wrangler deploy --config relay/wrangler.toml` |
| Preview builds | 关闭，避免预览版本改变配对会话 |

`relay/wrangler.toml` 已包含 SQLite Durable Object 的首次迁移配置。`workers_dev=false`，中继通过 Pages 的绑定访问。

如果本地已有 Wrangler 授权，也可以运行：

```sh
npm run deploy:relay
```

### Cloudflare Pages

在 Cloudflare 创建 **Pages** 项目并连接仓库：

| 设置 | 值 |
| --- | --- |
| Framework preset | None |
| Root directory | 仓库根目录 |
| Build command | `npm run build` |
| Build output directory | `dist/site` |
| Node version | 22，仓库已提供 `.node-version` |
| Environment variable | `DASHBOARD_ORIGIN=https://你的正式域名` |

Pages 会在构建后上传静态产物，不需要另外填写 `npx wrangler deploy`。

`wrangler.toml` 已声明输出目录、`RELAY_SESSIONS` 绑定和当前站点的 `DASHBOARD_ORIGIN`。更换域名时，同步修改根目录与 `relay/` 下的 Wrangler 配置，再重新构建、部署并更新用户脚本。Pages 使用仓库中的 Wrangler 配置时，只修改控制台变量可能不会生效。

`DASHBOARD_ORIGIN` 填写控制台的精确来源，例如 `https://dglab-majsoul.pages.dev`。只填写协议、域名和端口，不添加路径、查询参数或末尾斜线，也不要使用通配符。

本地生成正式发布物：

```sh
DASHBOARD_ORIGIN=https://你的正式域名 npm run build
```

部署完整的 `dist/site/`。Pages 或通用 CI 构建缺少有效 HTTPS 来源时会直接失败，避免生成仍信任本地地址的线上脚本。

### 项目类型选错时

如果日志里出现单独的 `Deploy command: npx wrangler deploy`，并报 `Missing entry-point to Worker script or to assets directory`，请检查是否把前端建成了 Workers 项目。

前端应使用 Pages，输出目录为 `dist/site`；独立中继才使用 `relay/wrangler.toml`。构建脚本检测到 `WORKERS_CI=1` 时，也会提示项目类型不匹配。

Cloudflare 参考文档：[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[静态响应头](https://developers.cloudflare.com/pages/configuration/headers/)。

## 部署检查

| 命令 | 检查内容 |
| --- | --- |
| `npm test` | 协议、规则、消息边界、模拟 SDK 指令和界面逻辑 |
| `DASHBOARD_ORIGIN=https://你的正式域名 npm run check:pages` | 本地 Pages 页面、静态资源、响应头和脚本来源 |
| `npm run check:relay` | 本地 Cloudflare 中继、配对、消息转发和会话隔离 |
| `npm run check:relay:remote` | 正式 WSS 的临时会话与模拟 App 通信 |

这些命令不向真实设备发送输出。远端中继检查会建立临时测试会话；本地 Pages 检查只启动临时服务，不上传或部署。

还没有正式域名时，可以使用 `https://pages-build-check.invalid` 做本地 Pages 检查。完成后请用实际域名重新构建，不要发布仅用于检查的脚本。

v1.0.0 的测试和 review 结果见 [验证说明](VALIDATION.md)。

## 升级与使用

1. 部署完成后，刷新首页和配置页。
2. 从站点更新 Tampermonkey 脚本，再刷新雀魂，启用新的图标浮窗。
3. 在配置页连接中继，用 DG-LAB 4 App 扫码，选择设备及通道。
4. 添加规则，设置上限和快捷键，先保留模拟模式。
5. 从控制台打开雀魂，或在游戏内点击图标，再选择“打开并关联控制台”。
6. 等待“雀魂脚本已连接”，再点击“应用设置并启用”。游玩时保持控制台开启。

旧版带符号强度和单波形规则可以继续读取。新规则默认跟随 App 波形，控制台刷新后始终为模拟、未启用。只刷新控制台不会更新雀魂里已运行的旧脚本。

刷新或断开后，需要重新关联、配对并启用。可以从游戏图标重新打开控制台，也可以关闭旧游戏窗口后，从控制台重新打开雀魂。恢复的历史动作不触发惩罚。

## 通信边界

用户脚本只接受构建时指定的控制台来源。双向 `postMessage` 会检查精确 `origin`、窗口 `source`、会话和脚本实例；事件还需通过序号和字段校验。点炮等实时触发事件超过 10 秒会被拒绝。后台标签页调度延迟也可能让事件过期。

控制方连接中继时，必须匹配 `DASHBOARD_ORIGIN`。App 使用随机 UUID 配对 ID 连接，这个 ID 是访问会话的凭据，请勿公开配对链接。

中继按会话隔离，未知客户端不能跨会话转发。每个会话最多接入 8 个 App，文本帧上限为 64KiB；没有 App 时，控制连接在 5 分钟后关闭。

配对凭据保留在控制台内存，不通过事件桥接传给雀魂，也不写入游戏 URL 或本地规则配置。桥接传输的是公开牌局事件和操作文字，不传认证 token、原始协议消息或私有手牌。

这些检查用于隔离其他来源和标签页，不能防御雀魂页面或控制台站点自身被入侵。

### 反向关联入口

游戏内的关联按钮打开 `/link/`，直接显示与 `/play/` 相同的配置文档，不先跳到介绍页。

普通页面保留 `Cross-Origin-Opener-Policy: same-origin-allow-popups`。只有 `/link/*` 移除该响应头，保留游戏窗口打开控制台时需要的 `opener`。CSP 和消息校验仍然保留，不要把这个例外扩大到所有路径。

响应头配置见 `web/_headers`。CSP 的 `connect-src wss:` 允许用户填写兼容中继，页面只在点击连接后发起连接。

### 停止与断开

重新握手不会自动恢复真实输出。临时规则的时长为 0.1–60 秒，持久波形按 1 秒任务续发；新规则、停止或断开会取消后续轮播。两端的桥接超时为 90 秒。

网络断开或标签页被强制关闭时，停止请求可能无法送达，仍需能在 App 或设备端手动停止。实际设备效果的验证范围见 [验证说明](VALIDATION.md)。
