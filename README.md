# 团队协同 App

**iOS App（Capacitor）+ 网页版 + 团队服务器**。没连服务器时是演示模式（数据存本机）；连上服务器后是正式模式：老板分派账号、全团队实时同步、附件上传、真实 AI。部署见 [DEPLOY.md](DEPLOY.md)，团队怎么用见 [使用说明.md](使用说明.md)。

网页部分是单文件 HTML 应用：源码在根目录，构建后得到一个自带全部图片、样式和脚本的 `dist/team-ops.html`，双击就能在浏览器打开，也可以直接拖到 Netlify 部署。

## 一次性准备

需要 Node.js 18 及以上。

```bash
npm install          # 安装 Playwright（只用于端到端测试）
npm run setup        # 下载测试用的 Chromium 浏览器（约 150 MB，只需一次）
```

只改代码、不跑端到端测试的话，`npm run setup` 可以先跳过。

## 日常开发

```bash
npm run dev          # 监听源码，改完自动重新构建，浏览器刷新 dist/team-ops.html 即可
npm run build        # 手动构建一次
npm test             # 业务规则测试（engine.js，290 项，1 秒内）
npm run e2e          # 端到端测试（19 组，约 3 分钟）
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
| `native.js` | 原生桥接：iOS 里的数据双存、原生语音识别、剪贴板深链接 |
| `server/` | 团队服务器（`server.js` 零依赖 HTTP + SQLite；`ai.js` Claude 代理） |
| `ios/` | iOS 工程（Capacitor 8，自写原生语音插件 `SpeechPlugin.swift`） |
| `fonts/` | 本地字体（不依赖 Google Fonts） |
| `app.js` | 界面：路由、页面渲染、交互 |
| `style.css` | 样式（图片用 `__XXX__` 占位，构建时内嵌） |
| `shell.html` | HTML 外壳 |
| `build.js` | 构建脚本：把以上文件和 `img/` 图片合成单文件 |
| `test.js` / `test_server.js` / `test_ai.js` | 业务规则 / 服务器 / AI 代理测试 |
| `e2e/` | 端到端测试；`fixtures/` 是上传测试用的素材，`shots/` 是测试截图（不入库） |
| `scripts/` | 端到端运行器、开发监听 |
| `img/` | 图片素材；`*.py` 是背景图处理脚本（需要 Python + Pillow + NumPy） |
| `gen/` | 项目类型卡插画生成脚本 |
| `kb_template.md` | AI 知识库「老板思想」模板 |
| `HANDOFF.md` | 交接说明：做到哪了、规范、待办 |

## 部署

1. `npm run build`
2. 把 `dist/index.html` 拖到 <https://app.netlify.com/drop>（或已有站点的 Deploys 页面）

## 说明

- 演示模式：数据存在本机，AI 为规则模拟。
- 正式模式（连服务器）：数据在服务器；配置了 `ANTHROPIC_API_KEY` 时老板和管理员用真实 AI（Claude），否则仍为规则模拟。
- 待办与路线图见 `HANDOFF.md`。
