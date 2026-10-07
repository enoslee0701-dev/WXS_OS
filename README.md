# 团队协同 App

**iOS / Android App（Capacitor）+ 网页版 + 团队服务器**。没连服务器时是演示模式（数据存本机）；连上服务器后是正式模式：老板分派账号、全团队实时同步、附件上传、真实 AI。部署见 [DEPLOY.md](DEPLOY.md)，团队怎么用见 [使用说明.md](使用说明.md)。

网页部分是单文件 HTML 应用：源码在根目录，构建后得到一个自带全部图片、样式和脚本的 `dist/team-ops.html`，双击就能在浏览器打开，也可以直接拖到 Netlify 部署。

## 一次性准备

需要 Node.js 22.5 及以上（服务器用内置的 `node:sqlite`；推荐 24）。

```bash
npm install          # 安装 Playwright（只用于端到端测试）
npm run setup        # 下载测试用的 Chromium 浏览器（约 150 MB，只需一次）
```

只改代码、不跑端到端测试的话，`npm run setup` 可以先跳过。

## 日常开发

```bash
npm run dev          # 监听源码，改完自动重新构建，浏览器刷新 dist/team-ops.html 即可
npm run build        # 手动构建一次
npm test             # 业务规则测试（engine.js，540+ 项，1 秒内）
npm run e2e          # 端到端测试（33 组，约 5 分钟）
npm run e2e -- proj  # 只跑文件名含 proj 的那组
npm run check        # 构建 + 业务测试 + 端到端，全部通过才算完成
npm run server       # 启动团队服务器（http://localhost:8787）
npm run ios          # 构建并在 iOS 模拟器里运行 App
npx cap open ios     # 用 Xcode 打开 iOS 工程（真机调试、打包）
```

在 VS Code 里也可以按 `Ctrl/Cmd + Shift + B` 直接构建，或从「终端 → 运行任务」选择上面的任务。

## 目录

| 路径 | 说明 |
|---|---|
| `engine.js` | 领域引擎：数据、权限、业务规则、角色能力表（TM.caps）、按身份裁剪（TM.viewFor），客户端和服务器共用 |
| `sync.js` | 同步层：服务器模式下的发件箱、离线补发、SSE、附件上传队列、AI 调用 |
| `native.js` | 原生桥接（iOS / Android）：数据双存、原生语音识别、剪贴板深链接、网络诊断、分享文件 |
| `server/` | 团队服务器：`server.js` 零依赖 HTTP + SQLite；`ai.js` AI 代理（Claude 或本机模型）；`llm.js` 本机 AI（llama.cpp）；`transcribe.js` 语音转写（whisper.cpp）；`push.js` iOS 推送；`restore.js` 从备份恢复 |
| `ios/` | iOS 工程（Capacitor 8，自写原生语音插件 `SpeechPlugin.swift`） |
| `android/` | Android 工程（Capacitor 8，自写 `SpeechPlugin.java`、`DiagPlugin.java`；签名文件不入库） |
| `fonts/` | 本地字体（不依赖 Google Fonts） |
| `app/*.js` | 界面：按页面拆成多个文件（01 公共工具 … 17 路由与渲染），构建时拼进同一个闭包 |
| `style.css` | 样式（图片用 `__XXX__` 占位，构建时内嵌） |
| `shell.html` | HTML 外壳 |
| `build.js` | 构建脚本：把以上文件和 `img/` 图片合成单文件 |
| `test*.js` | 业务规则、同步一致性、随机操作、服务器、AI 代理、本机 AI、推送、语音转写测试（`npm run check` 全跑） |
| `e2e/` | 端到端测试；`fixtures/` 是上传测试用的素材，`shots/` 是测试截图（不入库） |
| `scripts/` | 端到端运行器、开发监听；`android.js` 出安装包；`server-mac.sh` 服务器常驻；`tunnel-mac.sh` 临时公网地址；`whisper-mac.sh` / `llm-mac.sh` 安装本机转写和 AI |
| `img/` | 图片素材；`*.py` 是背景图处理脚本（需要 Python + Pillow + NumPy） |
| `gen/` | 项目类型卡插画生成脚本 |
| `kb_template.md` | AI 知识库「老板思想」模板 |
| `HANDOFF.md` | 交接说明：做到哪了、规范、待办 |

## 部署

- 团队服务器：见 [DEPLOY.md](DEPLOY.md)（办公室 Mac 常驻 / 临时公网地址 / 云服务器 Docker）。
- 安卓安装包：`npm run android -- "更新说明"`（先把 `android/app/build.gradle` 的 versionCode 加 1），生成到桌面并放到服务器 `/app` 供下载。
- iOS：`npm run ios` 在模拟器运行；上架需要 Apple 开发者账号。
- 只要网页演示版：`npm run build` 后把 `dist/index.html` 拖到 <https://app.netlify.com/drop>。

## 说明

- 演示模式：数据存在本机，AI 为规则模拟。
- 正式模式（连服务器）：数据在服务器；配置了 `ANTHROPIC_API_KEY` 时用 Claude，否则用服务器本机的开源模型（装了的话），再不然是规则模拟。录音和视频由服务器本机 whisper 转文字。
- 待办与路线图见 `HANDOFF.md`。
