# DGLab-Majsoul

雀魂网页版的点炮联动：Cloudflare Pages 控制台负责配对 DG-LAB App 4、设置规则和执行惩罚；Tampermonkey 脚本负责采集牌局事件，并在雀魂右上角的可展开窗口显示事件和操作结果。

当前为 0.9.1 开发版。已部署独立中继与控制台；真实 App/主机输出仍待实测。默认模拟、停用，强度上限为 0。

## 控制台界面

采用暖黑、酒红与金属色的暗色主题；麻将牌、链环和电脉冲组成品牌标识。首页 `/` 展示玩法介绍，并提供安装 / 更新脚本与开始游玩入口；`/play/` 为独立游玩配置页，设备连接、规则设置和进入雀魂分为三个区域，滚动时保留联动状态与停止按钮。两页的页脚左侧均提供 GitHub 仓库链接。

内置 SVG 操作图标、浏览器 favicon、Apple 主屏幕图标与 Web App Manifest；图标及字体均不向第三方服务发起请求。规则摘要保留 A/B 通道区别，手机上编辑表单转为单列，并支持键盘焦点提示和减少动态效果的系统偏好。

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

Cloudflare Pages 构建命令为 `npm run build`，输出目录为 `dist/site`，并在构建环境设置 `DASHBOARD_ORIGIN`。详见 [部署与信任配置](docs/DEPLOYMENT.md)。正式站点已部署至 https://dglab-majsoul.pages.dev 。

## 使用流程

1. 在浏览器安装 Tampermonkey，从首页安装脚本，再点击“开始游玩”进入配置页。
2. 在控制台连接 V4 WSS 中继，用 DG-LAB 4 App 扫二维码，选择设备和 A/B 通道。
3. 点击“添加事件”创建规则卡，在各卡片内设置指令，再设置全局强度上限。先保留模拟。
4. 可以从控制台打开雀魂，也可以先打开雀魂、点击游戏小窗口中的“打开并关联控制台”；等待桥接成功后再启用。
5. 控制台保持打开。雀魂右上角小窗口显示事件，以及控制台返回的模拟、输出、停止和失败信息。

脚本匹配繁中、日服和国际服的三个网页域名；匹配范围不等于全部地区已实测。当前设备控制限定 App 暴露的 `COYOTE_030`（郊狼 3.0 主机），App 4 的版本与主机型号不是同一概念。

两种方式都通过浏览器窗口引用进行精确来源的 postMessage 握手，不会自动控制任意已打开的标签页。直接打开雀魂时，点击游戏内的“打开并关联控制台”。刷新控制台后可从游戏窗口重新关联，再配对设备。刷新雀魂或连接中断后需重新启用；历史恢复动作不触发惩罚。

## 电击惩罚

第 02 区只提供自定义指令，不再提供按失分换算模式。选择事件后点击“添加事件”，所有已创建规则以精简摘要一起展示，A/B 不同时分两行显示、相同时合并为 A/B 一行，点击编辑才展开参数，支持独立启用/停用和删除；同一事件不重复创建。

自己的牌被吃、被碰、被明杠是三个独立事件。明杠只指他家用自己的弃牌完成大明杠，不包括暗杠或加杠。还支持自己打出 Dora/赤宝、自己点炮、其他玩家立直/自摸、自己和牌/立直、流局时已听/未听。

规则、强度上限和快捷键仅保存在当前浏览器，不保存设备 ID、配对链接、启用状态或真实输出模式。重新打开页面会恢复规则，但始终为仅模拟、未启用；本地保存被浏览器禁止时会显示提示。

参考官方 T-Rex Demo 的指令设置，支持：

- 强度临时变化：相对当前基础强度增加或减少，任务结束撤销临时变化。
- 强度永久变化：增加或减少基础强度，可能随点炮次数累积；停止或断开等保护动作会归零。
- 强度临时归零：先归零，在页面保持连接且反馈仍为零、未静音时按当前上限恢复原基础强度。快捷停止、关闭或断开会取消恢复；此恢复由控制台计时。
- 覆盖波形：选择内置郊狼波形，或保持 App 当前波形。
- A/B 同步规则或独立规则，可指定单通道或 A+B。
- 0.1–60 秒时长；永久变化可设 0 秒，仅立即改变强度、不发送波形。
- 点击快捷停止键输入框，同时按下组合并松开全部按键后确认。支持 Ctrl + Alt + K，也支持 G + H 等最多 4 个普通键组合；修饰键可以叠加。仅在控制台或已关联游戏窗口聚焦时生效，不是操作系统全局热键。已知浏览器保留键会被拒绝，普通字母在文本输入框内不触发停止。

“自己点炮”卡片下直接展示“按实际点炮失分缩放强度变化”开关。开启后先计算 `千点单位 = round(实际失分 / 1000)`，再计算 `期望变化 = 千点单位 × 每1000点强度变化系数`。例如 3900 点先计为 4 个单位、1300 点先计为 1 个单位；系数 +9 时分别为 +36、+9。摘要只显示系数、操作和时长，不显示假设失分的括号示例。可取消缩放改为固定变化；归零操作不按失分增加强度。实际下发仍受当前基础强度、用户上限及 App 上限约束。

默认变化为 0、上限为 0，不会自动启用。上限输入和执行校验均限制最大 200，App 上限仍作为设备端保护。自定义强度变化范围为 -40 至 +40；还会根据 App 的当前强度和通道上限约束下发变化。缺少强度反馈时拒绝输出。它不接收任意代码或可执行公式。

## 点炮事件判定与保护

点炮金额使用服务器 `ActionHule.delta_scores[me]` 的负值绝对值。本场和多家荣和以实际扣分合计为准；不手工重算番符，也不把和牌方拿到的供托当成点炮者额外支付。此前已经扣除的立直棒不重复计算。

判定要求：已完整观察到本局开始、最近出牌或杠来自自己、全部和牌者为其他玩家荣和、结算只有自己失分。自摸、身份不明、归因不明或多人分摊支付等复杂包牌结算会跳过。同步恢复后的当前局不触发惩罚，下一局重新观察后再判定。

覆盖波形由玩家选择，不选择时保持 App 当前波形。其他 App 任务可能影响最终输出，应使用独立通道验证。

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

默认中继为 `wss://dglab-majsoul.pages.dev`。Pages 根路径通过 Function 将 WebSocket 连接交给独立 Worker 的 Durable Object，实现 V4 配对和双向消息转发。HTTPS 根路径继续提供控制台。也可以手动填写其他兼容的 V4 WSS 地址。

部署顺序：先用 `relay/wrangler.toml` 部署 `dglab-majsoul-relay` Worker，再部署 Pages；Pages 配置通过 `script_name` 绑定这个 Worker 中的 `RelaySession`。本地协议验收：`npm run check:relay`。

用户脚本只信任构建时的精确控制台来源，不信任所有 `*.pages.dev`，不从 URL 接收任意可信来源。换域名后须重建并更新脚本。桥接检查来源、窗口引用、随机会话、实例和消息序号；过期点炮事件不执行。详见 [信任边界](docs/DEPLOYMENT.md#通信边界)。

原生 WebSocket 的 Proxy 包装保留原型、静态常量和原生 MessageEvent。请求编号、身份和队列按连接隔离，支持 ArrayBuffer、TypedArray 和 Blob。身份来自 `authGame`，不依赖旧版 `GameMgr`。去重是有限窗口内的保护，不承诺所有复杂网络状态下恰好一次。

协议描述继承自固定版本的 Coyote-Majsoul，无自动更新功能。未知动作忽略，已知消息解析失败报告错误并停用联动。

## 日志与隐私

LIVE ACTIVITY 会显示“脚本就绪”、脚本版本、连接事件和真实牌局事件；握手前只补发诊断，不重放历史点炮。

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
- [EndlessCheng/mahjong-helper](https://github.com/EndlessCheng/mahjong-helper)：吃、碰、大明杠协议类型的参考。
- [DG-LAB T-Rex Demo](https://trex.dungeon-lab.cn/)：自定义强度变化、覆盖波形、时长及快捷停止交互的参考。
- [dungeonlab-open/dglab-websocket-server](https://github.com/dungeonlab-open/dglab-websocket-server) 和 [dungeonlab-open/dglab-kit](https://github.com/dungeonlab-open/dglab-kit)：官方 V4 协议参考与 SDK。
- [protobuf.js](https://github.com/protobufjs/protobuf.js)、[esbuild](https://github.com/evanw/esbuild)、[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 和 [Tampermonkey](https://www.tampermonkey.net/)：协议解析、构建、二维码和运行环境。

## 许可证

独立初始化 Git 历史。AGPL-3.0-or-later，见 [LICENSE](LICENSE)。继承文件与依赖来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

### 新事件需要更新脚本

请使用 0.7.0 或更新的用户脚本，多普通键组合需要新版按键状态追踪。脚本为公开牌局事件附加实时局标记和 Dora 信息；旧脚本缺少这些信息时不会触发新增规则。重连恢复和重复开局消息不能重新激活历史局的惩罚。
