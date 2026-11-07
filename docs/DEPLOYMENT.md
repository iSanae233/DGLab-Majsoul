# Cloudflare Pages 部署

这是纯静态控制台，无 Pages Functions、数据库或服务端设备凭据。浏览器直接连接用户选择的 V4 WSS 中继。Cloudflare Pages 不承担 WebSocket 中继。

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

`wrangler.toml` 也声明了输出目录。GitHub 仓库为 `iSanae233/DGLab-Majsoul`；当前尚未部署 Pages 项目。

确定项目域名后，在生产构建环境中设置精确的 `DASHBOARD_ORIGIN`，例如 `https://dglab-majsoul.pages.dev`，然后构建。不要直接照抄示例域名，也不要使用通配符。

本地生成正式发布物：

```sh
DASHBOARD_ORIGIN=https://你的正式域名 npm run build
```

将完整 `dist/site` 作为静态产物部署。Cloudflare Pages 自动构建环境若没有设置此变量，构建会明确失败，避免发布仍信任本地地址的脚本。

官方参考：[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[静态响应头](https://developers.cloudflare.com/pages/configuration/headers/)。

## 用户使用流程

1. 打开控制台，从站点链接安装或更新用户脚本。
2. 在控制台连接 V4 WSS 中继，用 DG-LAB 4 App 扫二维码，选择设备及通道。
3. 在控制台设置规则，初次保留模拟。
4. 点击“打开雀魂并连接脚本”。必须从控制台打开，以建立两个窗口之间的连接；允许浏览器为此按钮打开新标签页。
5. 等控制台显示“雀魂脚本已连接”，再点击“应用设置并启用”。控制台保持打开。
6. 雀魂右上角展开小窗口，查看本地牌局事件和控制台返回的模拟、输出、停止或失败信息。

更换域名后必须重新构建、部署并更新用户脚本。预览部署地址不会自动获得信任；如需测试预览站点，应为其单独构建脚本。

刷新控制台会丢失窗口引用、配对和启用状态；关闭旧雀魂标签页，再从控制台重新打开。刷新雀魂会让控制台停用联动，当前局恢复动作不触发惩罚。浏览器扩展、弹窗策略或雀魂未来的隔离响应头可能切断窗口关系，此时脚本只在本页显示事件，不能启用控制。

## 通信边界

双向 `postMessage` 检查精确 `origin`、窗口 `source`、随机会话编号和脚本实例编号。点炮事件需要合法字段、新的消息序号以及不超过 10 秒的时间差。页面时钟相同，但后台标签页调度延迟仍可能导致事件过期并停用。

这些检查能隔离其他来源和其他标签页，并不能防御雀魂页面自身或控制台站点自身被入侵。两个来源都是信任边界的一部分。

配对凭据留在控制台内存；不通过事件桥接传给雀魂、不放入雀魂 URL，也不持久化。传输的是规范化牌局事件和操作文字，不传原始协议、认证 token 或手牌。

`web/_headers` 配置 CSP、禁止嵌入和缓存策略。`same-origin-allow-popups` 用于保留本控制台主动打开的跨源窗口，不要改成 `same-origin` 后仍假定桥接可用。CSP 的 `connect-src wss:` 允许用户自选 WSS 中继；控制台仅在用户点击连接后发起连接。

断开、超时或刷新会停用联动，重新握手不会自动恢复真实输出。两端心跳超时为 90 秒；设备任务期限最多 10 秒。网络或标签页被强制关闭时不能保证停止请求送达，应能在 App 或设备端手动停止。
