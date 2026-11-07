# 第三方来源

## Coyote-Majsoul

- 来源：https://github.com/hyperzlib/Coyote-Majsoul
- 固定提交：`20e59d740d1cf036f8343a98017cc94f8c1d9512`
- 继承文件：`server/majsoul/liqi.json` → 本仓库 `src/protocol/liqi.json`（原样保留）
- 算法参考：`server/majsoul/parseResBufferMsg.ts` 中的 ActionPrototype XOR 处理
- 上游 package.json 声明：AGPL-3.0-or-later。许可证文本保留于本仓库 `LICENSE`。
- 上游 README 将协议解析工作追溯至 https://github.com/HomeArchbishop/majsoul-analyser 。

协议文件的继承记录不表示它已与当前所有地区和玩法的协议一致。

## npm 依赖

`protobufjs` 用于解析协议，`esbuild` 用于构建。精确版本及传递依赖见 `package-lock.json`，各包的许可证随 npm 包分发。构建保留工具识别出的内联法律声明。

## DG-LAB 与二维码

- dglab-kit 1.0.5：https://github.com/dungeonlab-open/dglab-kit 。用于 V4 配对、设备发现、强度控制、内置波形播放和任务清理；包内附 GPL-3.0 许可证。
- qrcode-generator 2.0.4：https://github.com/kazuhikoarase/qrcode-generator 。用于本地生成配对二维码，MIT 许可证。

开发测试使用 linkedom 0.18.15（ISC），仅用于 DOM 模拟，不打包进网页或用户脚本。
