# 给 Claude Code 的工作说明

先读 `HANDOFF.md` 了解进度、规范和待办。

## 规则
- 用中文交流。
- 源码改 `engine.js` / `app.js` / `style.css` / `shell.html`；不要手改 `dist/`。
- 业务规则改动先在 `engine.js` 实现，并在 `test.js` 补测试；界面改动在 `e2e/` 补或改端到端测试。
- 完成前必须运行 `npm run check`，全部通过才算完成；没通过就继续修，不要宣布完成。
- 用户给 UI 设计图时，一比一复刻。
- 每轮结束更新 `HANDOFF.md`（本轮新增、待办）。
- 注意 `app.js` 中函数同名会被后定义的覆盖（例如分配页已有 `pickSheet`，新建项目用 `npPick`）。
