# 团队协同 App · 交接说明（2026-10-03 · 第七轮）

## 发布
- 链接（始终更新同一个）：https://claude.ai/artifact/9B6z2RbfjJ2xSoSNYPMEbN
- 单文件产物：dist/team-ops.html（同步副本 dist/index.html，可拖到 app.netlify.com/drop）
- 本地开发包（VS Code）：见 README.md；从此开始以本地仓库为准

## 目录
- engine.js 领域引擎（纯逻辑）｜app.js 界面｜style.css 样式｜shell.html 外壳｜build.js 构建（内嵌 img/ 下图片）
- test.js 业务规则测试（290 项）｜e2e/ 端到端测试（19 组，Playwright；e2e/fixtures 测试素材，e2e/shots 截图输出）
- scripts/e2e.js 端到端运行器｜scripts/dev.js 改动自动构建｜gen/gen.js 类型卡插画生成（Playwright 截图）｜img/*.py 背景图处理脚本（Python + Pillow）
- kb_template.md 老板思想资料模板

## 命令
- 一次性准备：`npm install && npm run setup`
- 开发：`npm run dev`（改动自动构建）｜构建：`npm run build`｜业务测试：`npm test`
- 端到端：`npm run e2e`（全部）或 `npm run e2e -- kbv`（按文件名筛选）
- 完成任何改动前：`npm run check`（构建 + 业务测试 + 端到端全部通过才算完成）
- build.js 输出到 dist/（可用环境变量 OUT_DIR 改输出目录）

## 已完成（本轮）
演示向导；AI 润色可撤销且不叠加；想法详情重做（紧凑、五色进度条、原文/AI 整理折叠、讨论内联+问 AI+老板专用 AI 总结、老板决策 AI 建议、落实过程、附件完整功能+呈现开关+形成事项后锁定）；AI 拟题（不截原文，老板可改）；AI 知识库（我的 → AI 知识库，决策/整理/找回记忆会引用）；项目详情精良版；任务详情重做；全局紧凑（弹窗、表单、按钮、我的、设置、任务列表）。

## 本轮新增（第二轮）
记录想法提交前显示 AI 拟题（语音/视频/文字/文件四个入口，实时更新，可「改一改」，原样确认仍算 AI 拟题）；想法详情「形成的事项」改紧凑卡片（ixWorkRow）。新增 e2e_ait.js（14 项），端到端共 17 组。

## 本轮新增（第三轮）
项目详情：概览加「问 AI」（wchatAnswer：进度/分工/风险/下一步/文件/公司资料/总结）和「落实过程」（workFlowHTML，与想法共用 flowRender）；任务页五个筛选+紧凑任务卡（负责人、截止、清单、受阻/无动态、下一步）；成员页按角色排序、多角色标签、进行中/已完成计数、点成员看他的任务；文件页分区（项目文件/交付物/来源想法）+ 上传（拍照/相册/文件/录音/链接）、预览、删除。引擎新增 work.attach / work.detach（成员可传；上传人、负责人、跟进运营者、老板可删；上限 50）。新增 e2e_wx.js（30 项）。

## 本轮新增（第四轮）
想法页六宫格改为彩色真实图片背景 + 黑字（参照记录想法页的卡片）：六张背景 img/it_*.jpg 由 img/tiles_user.py 从 Enos 提供的设计图 img/src_tiles.png 裁出、柔焦并统一压成冷蓝灰单色调（灯泡/团队/文件夹/路标/公路日出/对勾，风格对齐记录想法页卡片；卡片缩小（约 115px 高、间距 12px，标题 15.5px 加粗放在图标下的主位置，数字在右下角），图标用低饱和色区分（琥珀/紫/青/玫红/蓝/绿，淡底）；「最近动态」列表图标同样改为冷蓝灰底深灰图标，只保留红点）；草稿、暂缓仍用 img/tiles.py 生成的灰调图（重跑 tiles.py 会覆盖六张，需再跑 tiles_user.py）；CSS 占位 __IT_xxx__，build.js 统一内嵌；选中态保留图片、用深色描边。

## 本轮新增（第五轮）
新建项目第 2、3 步重做（与第 1 步同风格）：第 2 步「项目团队」改为人员卡片 + 选择弹窗（npPick，显示每人手上任务数），「时间与优先级」快捷截止（1 周/2 周/1 个月/2 个月/自定义）+ 高中低，「项目目标」可 AI 拟写，「首批任务」卡片式（执行人弹窗选择、预期成果/验收标准并排）+「AI 拆任务」（先按描述解析，否则按项目类型模板，默认执行人取负责人部门）；第 3 步确认页：摘要卡（类型、描述、目标、截止/优先级/附件）、团队三人卡、任务清单、「创建后会通知谁」。引擎 project.create 支持 priority（非法回落为中）。注意：app.js 里另有分配页的 pickSheet，新建项目用 npPick，勿重名。

## 本轮新增（第六轮）
AI 知识库新增「录音口述，AI 整理成规则」（#/kb/voice，仅老板/管理员）：选主题 → 大按钮录音（Web Speech 连续识别，中途断开自动续上；不支持时提示用输入法话筒）→ 文本框可改 →「AI 整理成规则」（kbOrganize：断句、去口头语、按 决定/用人/钱/对外/团队/初心/常说的话 归类，未命中归入所选主题或「其他原则」，演示为规则模拟）→ 确认页可删条、改标题、改全文、选可见范围、附口述原文 → kb.add（source:'voice'，列表标「口述整理」）。新增 e2e_kbv.js（20 项）。阶段 3 接大模型后替换 kbOrganize 即可。

## 本轮新增（第七轮 · 2026-10-03 · 自动化开发日）
用户决定：Capacitor 封装 iOS（Android 暂缓）；老板与团队同地；大模型主要老板用；账号由老板创建分派、不开放注册；单团队自用；开发者账号 / App 名最后定。

1. **iOS App**（`ios/`，Capacitor 8 + SPM，无需 CocoaPods）：`capacitor.config.json` 的 webDir=`dist/app`；自写原生语音插件 `ios/App/App/SpeechPlugin.swift`（SFSpeechRecognizer）+ `MainViewController.swift`（注册插件、右滑返回）；Info.plist 加麦克风/相机/相册/语音权限说明、`teamops://` 深链接、仅竖屏。占位 Bundle ID `com.teamops.app`。模拟器已跑通。
2. **native.js**（在 engine 前加载，浏览器里不生效）：数据双存（localStorage 的 tm_* 镜像到原生 Preferences，WebView 数据被清后自动恢复）、语音兼容层（原生插件 → 浏览器 SpeechRecognition 接口，按停顿切句）、剪贴板深链接、状态栏/键盘/启动屏。build.js 把 `@capacitor/core` 浏览器版内嵌在它前面。
3. **字体本地化**：`fonts/`（Figtree、Caveat 拉丁子集 woff2），不再依赖 Google Fonts。
4. **按角色区分界面**：引擎 `TM.caps(s, uid)` 是唯一的能力表（recordIdea/createProject/assign/claimIdeas/members/settings/kbEdit/resetData/ideas/work…）；首页两张卡片按角色给（老板/发起人：记录想法+新建项目；运营者：整理想法+新建项目；执行者：我的待办+记一条待办；管理员：成员与账号+AI 知识库）；管理员底部只有 3 个标签；新建菜单、AI 快捷按钮、团队邀请、我的·流程开关、更多设置、操作记录按能力显示；越权路由直接跳回（不再显示空的无权限页）；「每条都送」模式下非老板不显示新建项目（引擎 `TM.canCreateProject` 同步收紧）；重置数据限老板/管理员。
5. **服务器**（`server/server.js`，零依赖 node:http + node:sqlite，`npm run server`，默认 8787，数据在 `server/data/`）：首次启动老板创建团队（可带演示数据）；老板/管理员给成员分派账号（自动生成初始密码、首次登录强制改密、重置、停用）；`/api/act` 用登录身份跑 engine；`TM.viewFor` 按身份裁剪下发（别人的草稿、通知、待办、仅 AI 可见资料不下发）；SSE 推送；每天备份一份快照；登录限流；异常回滚。同端口直接提供网页版（同源自动走服务器模式）。
6. **sync.js**（engine 与 app 之间）：服务器模式下拦截 TM.act，本地先执行、发件箱顺序上送、以服务器结果为准；断网存发件箱、联网补发；正在输入/弹窗打开时推迟应用远端更新；ID 冲突修正地址；离线提示条。本地演示模式下不生效。
7. **登录与账号界面**：服务器模式登录页（账号密码；App 里可填服务器地址；首次是「创建你的团队」）；我的 → 账号与安全（修改密码、服务器、退出登录）；成员资料 → 登录账号与密码；添加成员后自动弹出分派账号并显示可复制的登录信息。
8. **清理演示数据**（原待办 1）：引擎 `data.clearDemo`（老板/管理员），清空内容、保留成员设置和自己加的资料；新团队 `TM.blank`。
9. 测试：业务 322 项；新增 `test_server.js`（40 项，纳入 npm test）；端到端新增 e2e_native（22）、e2e_roles（81，7 个账号逐个点遍入口确认无「无权限」提示）、e2e_srv（30，双浏览器 + 真实服务器）。共 22 组。

## 待办
1. 附件上传到服务器（现在服务器模式下附件仍只存本机：需要 /api/files + media 引用 fileId）
2. iOS 真机：需要 Apple 开发者账号（用户说最后再说）；推送通知（APNs）同样依赖它
3. 真实大模型：服务端代理 + 开关，无 Key 时保持规则模拟（需要用户提供 API Key）
4. 服务器部署到公网（https）后，App 里填 https 地址即可；局域网 http 已在 Info.plist 允许本地网络
5. Android：装 SDK 后 `npx cap add android`
6. app.js 按页面拆模块（函数同名覆盖隐患）

## 命令（新增）
- `npm run server`：启动服务器（PORT / HOST / DATA_DIR 可配）
- `npm run ios`：构建网页 → 拷进 iOS 工程 → 编译并在模拟器启动
- 打开 Xcode：`npx cap open ios`

## 规范
- 用户偏好：中文、简洁、按设计图 1:1 复刻、每次交付前跑完测试、结尾给编号的下一步
- 紧凑比例：详情页标题 19、卡片标题 15.5、正文 13.5–14、卡片圆角 20、输入框 42 高、按钮 44–46 高
