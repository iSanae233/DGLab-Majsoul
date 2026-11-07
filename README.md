# DGLab-Majsoul

雀魂网页版的点炮联动：Cloudflare Pages 控制台负责配对 DG-LAB App 4、设置规则和执行惩罚；Tampermonkey 脚本负责采集牌局事件，并在雀魂右上角的可展开窗口显示事件和操作结果。

当前为 0.3.0 开发版。代码与模拟测试已完成，真实 App/主机联动及生产 Pages 部署尚未验收。默认模拟、停用，换算系数和强度上限为 0。

## 运行与部署

```sh
npm ci
npm test
npm run dev
```

打开 `http://127.0.0.1:4173`。Node.js 22+ 仅用于开发和构建，玩家使用已部署的站点和脚本即可。

构建产物：

- `dist/site/`：可部署到 Cloudflare Pages 的完整静态站点。
- `dist/site/userscripts/dglab-majsoul.user.js`：站点提供的脚本下载。
- `dist/dglab-majsoul.user.js`：同一脚本的独立副本。

正式构建必须绑定实际域名：

```sh
DASHBOARD_ORIGIN=https://你的正式域名 npm run build
```

本地 Pages 验收可运行 `DASHBOARD_ORIGIN=https://你的实际域名 npm run check:pages`，使用 Wrangler 实际检查静态资源与响应头。

Cloudflare Pages 构建命令为 `npm run build`，输出目录为 `dist/site`，并在构建环境设置 `DASHBOARD_ORIGIN`。详见 [部署与信任配置](docs/DEPLOYMENT.md)。当前没有执行线上部署。

## 使用流程

1. 在浏览器安装 Tampermonkey，再从控制台安装脚本。
2. 在控制台连接 V4 WSS 中继，用 DG-LAB 4 App 扫二维码，选择设备和 A/B 通道。
3. 配置每 1000 点强度、强度上限和固定时长，先保留模拟。
4. 从控制台点击“打开雀魂并连接脚本”，等待桥接成功，再应用设置并启用。
5. 控制台保持打开。雀魂右上角小窗口显示事件，以及控制台返回的模拟、输出、停止和失败信息。

脚本匹配繁中、日服和国际服的三个网页域名；匹配范围不等于全部地区已实测。当前设备控制限定 App 暴露的 `COYOTE_030`（郊狼 3.0 主机），App 4 的版本与主机型号不是同一概念。

必须从控制台打开雀魂；直接进入雀魂只能本地观察，无法交给控制台执行。刷新控制台需重新配对并重新打开游戏窗口。刷新雀魂或连接中断后需重新启用；历史恢复动作不触发惩罚。

## 点炮规则

```text
临时强度 = min(用户上限, ceil(实际失分 / 1000 × 每1000点强度))
```

最终下发值再受 App 上报的通道 `intensityMax` 限制。固定时长范围 100–10000ms，点数只影响强度。换算向上取整，达到上限后不再增加。不提供适用于所有人的默认输出强度。

点炮金额使用服务器 `ActionHule.delta_scores[me]` 的负值绝对值。本场和多家荣和以实际扣分合计为准；不手工重算番符，也不把和牌方拿到的供托当成点炮者额外支付。此前已经扣除的立直棒不重复计算。

判定要求：已完整观察到本局开始、最近出牌或杠来自自己、全部和牌者为其他玩家荣和、结算只有自己失分。自摸、身份不明、归因不明或多人分摊支付等复杂包牌结算会跳过。同步恢复后的当前局不触发惩罚，下一局重新观察后再判定。

设备端同时接收有期限的临时强度任务与 BUBBLE 波形任务。官方协议规定临时强度任务结束归零，不声称恢复某个历史绝对强度。其他 App 任务可能影响最终输出，应使用独立通道验证。

- 默认模拟和停用，刷新不保留启用状态或配对凭据。
- 重复事件不重复执行，失败请求不自动重试，执行中不追加排队。
- 识别异常、桥接中断或设备断开会停用；恢复连接不会自动启用。
- “停止联动并归零”会清理目标通道任务并请求强度归零，会影响同通道的其他任务。
- 网络断开时无法保证停止请求送达，仍需能在 App 或设备端手动停止。

## 实现

```text
雀魂 WebSocket → 用户脚本解析 → 精确来源/窗口/会话检查 → Pages 控制台
                                                            ↓
雀魂小窗口 ← 操作文字 ← 惩罚规则 → V4 WSS 中继 → DG-LAB App → 主机
```

Cloudflare Pages 只托管静态文件，不承担 WSS 中继。控制台使用官方中继或用户指定的兼容 WSS 服务。

用户脚本只信任构建时的精确控制台来源，不信任所有 `*.pages.dev`，不从 URL 接收任意可信来源。换域名后须重建并更新脚本。桥接检查来源、窗口引用、随机会话、实例和消息序号；过期点炮事件不执行。详见 [信任边界](docs/DEPLOYMENT.md#通信边界)。

原生 WebSocket 的 Proxy 包装保留原型、静态常量和原生 MessageEvent。请求编号、身份和队列按连接隔离，支持 ArrayBuffer、TypedArray 和 Blob。身份来自 `authGame`，不依赖旧版 `GameMgr`。去重是有限窗口内的保护，不承诺所有复杂网络状态下恰好一次。

协议描述继承自固定版本的 Coyote-Majsoul，无自动更新功能。未知动作忽略，已知消息解析失败报告错误并停用联动。

## 日志与隐私

两个页面各保留最近 100 条规范化事件；雀魂窗口展示最近 10 条事件和 5 条操作文字。控制台可以复制最近事件。

事件不包含账号 ID、认证 token、原始二进制消息或私有手牌。配对链接和设备凭据留在控制台，不传给雀魂、不放入雀魂 URL、不持久化。只有设备控制指令发送给选定中继。

当前展示事件：`game-start`、`resync`、`round-start`、`discard`、`riichi`、`meld`、`kan`、`win`、`deal-in`、`exhaustive-draw`、`abortive-draw`、`north-extraction`、`game-end`，以及连接和错误事件。其他事件不会自动触发设备输出。

## 验证

`npm test` 覆盖协议身份、结算归因、消息顺序、重复与历史事件、规则封顶、官方 SDK 的 V4 控制帧及跨页通信的来源/会话/过期检查。模拟测试不代替真实浏览器、真实结算和设备输出验收。

[验证记录](docs/VALIDATION.md) 明确区分旧版观察器实测、当前模拟测试及尚未完成的工作。

## 感谢

- [hyperzlib/Coyote-Majsoul](https://github.com/hyperzlib/Coyote-Majsoul)：项目起点、联动思路、Liqi 协议描述及 ActionPrototype 混淆解析参考。
- [HomeArchbishop/majsoul-analyser](https://github.com/HomeArchbishop/majsoul-analyser)：原项目基于的协议解析与事件处理工作。
- [Sunalamye/Naki](https://github.com/Sunalamye/Naki)：Unity 网页端、WebSocket 与协议恢复的调查文档参考，未复制其实现。
- [dungeonlab-open/dglab-websocket-server](https://github.com/dungeonlab-open/dglab-websocket-server) 和 [dungeonlab-open/dglab-kit](https://github.com/dungeonlab-open/dglab-kit)：官方 V4 协议参考与 SDK。
- [protobuf.js](https://github.com/protobufjs/protobuf.js)、[esbuild](https://github.com/evanw/esbuild)、[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 和 [Tampermonkey](https://www.tampermonkey.net/)：协议解析、构建、二维码和运行环境。

## 许可证

独立初始化 Git 历史。AGPL-3.0-or-later，见 [LICENSE](LICENSE)。继承文件与依赖来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
