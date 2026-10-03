# 团队协同 App（演示版）

单文件 HTML 应用：源码在根目录，构建后得到一个自带全部图片、样式和脚本的 `dist/team-ops.html`，双击就能在浏览器打开，也可以直接拖到 Netlify 部署。

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
```

在 VS Code 里也可以按 `Ctrl/Cmd + Shift + B` 直接构建，或从「终端 → 运行任务」选择上面的任务。

## 目录

| 路径 | 说明 |
|---|---|
| `engine.js` | 领域引擎：数据、权限、业务规则，纯逻辑，不碰界面 |
| `app.js` | 界面：路由、页面渲染、交互 |
| `style.css` | 样式（图片用 `__XXX__` 占位，构建时内嵌） |
| `shell.html` | HTML 外壳 |
| `build.js` | 构建脚本：把以上文件和 `img/` 图片合成单文件 |
| `test.js` | 业务规则测试 |
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

- 当前是演示版：数据存在浏览器 localStorage，AI 功能为规则模拟，不调用真实大模型。
- 待办与路线图见 `HANDOFF.md`。
