# 团队协同 App · 交接说明（2026-10-03 · 第七轮）

## 老板请看（2026-10-03 自动开发日结束时的状态）

**现在能做什么**
- iOS App 能在模拟器运行；真机发布版本能编译，只差签名。
- 团队服务器：在办公室 Mac 上运行 `scripts/server-mac.sh install`，同事在同一个 Wi-Fi 下就能用。
- **Android APK**（2026-10-05，当前 1.4，也放在本机服务器上：手机浏览器打开 http://192.168.1.108:8787/app 下载）：`npm run android` 生成并复制到桌面「团队协同.apk」，可直接装到安卓手机（需允许「安装未知来源应用」）；同一签名，新版可直接覆盖安装。
- 按角色区分的界面、老板分派账号（扫码加入）、实时同步、离线补发、附件、推送（代码已就绪）、AI（代码已就绪）、早报和截止提醒都已完成并测试。

**需要你做 / 决定的事**
1. **Claude API Key**：设置服务器环境变量 `ANTHROPIC_API_KEY` 后，老板和管理员的 AI 功能就换成真实的 Claude。没有 Key 时自动用规则模拟。费用可以在「更多设置 → 使用情况」里看。
2. **苹果开发者账号**（每年 99 美元）：真机安装、TestFlight、App Store 上架和推送都需要它。拿到后按 DEPLOY.md 配置推送密钥。
3. **App 名称和 Bundle ID**：现在是占位的「团队协同」和 `com.teamops.app`，上架后就不能改了。
4. **请过目一条业务规则**（第 31 条）：团队里没有运营者时由老板兼任跟进；没有项目负责人时，老板可以自任产品项目负责人。
5. **服务器放哪里**：放在办公室 Mac 上（局域网 http 即可），还是放云服务器（需要 https，见 DEPLOY.md）。

**给团队的说明**：[使用说明.md](使用说明.md)

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
- 端到端：`npm run e2e`（全部）｜界面爬虫：`npm run crawl`或 `npm run e2e -- kbv`（按文件名筛选）
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

10. **附件上传**：服务器 `PUT/GET /api/files/:id`（客户端的 localId 即文件 ID；上传人才能覆盖；Range 分段读取供 iPhone 播放视频；大小上限 MAX_FILE_MB）；客户端 `keepBlob`/`blobUrl` 统一（本机 blob 优先，没有就从服务器取）；`sync.js` 用 IndexedDB 排队上传（断网、App 被关都不丢）；所有类型文件都有 localId。
11. **App 图标与启动屏**：`gen/icon.js` 用 Playwright 渲染生成（深蓝底「协同」+ 日出光弧），写入 iOS Assets；副本 `img/app-icon.png`。
12. **iOS 安全区修复**：`.is-new main` 有 `zoom:.8`、首页 `zoom:.86`，安全区负外边距/内边距按比例补偿；根元素透明（画布用 body 背景）；首页锁定滚动时不要根元素安全区内边距。新增 `e2e_safe.js`（把 env(safe-area-inset-*) 替换成 59/34 后在 Chromium 里检查）。
13. **数据持久化加强**：WKWebView 的 localStorage 异步写盘，App 刚写完被杀会丢；native.js 启动时把备份清单里有、本机缺的键（如登录令牌）补回。
14. **真实 AI**（`server/ai.js`，官方 SDK）：claude-opus-5-5，`fallbacks:"default"` 拒答回退，稳定部分提示缓存，只把提问人能看到的数据（viewFor）给模型；默认只有老板和管理员可用（AI_FOR_ALL=1 全员），每人每日上限；AI 助手里周报/进度/负载/优先/方案/自由提问交给 Claude（纪要、拆待办、拆任务仍走规则版按钮），口述整理用结构化输出；出错自动退回规则。`test_ai.js` 用本地模拟的 Anthropic API 测试（不花钱）。
15. **员工体验修复**：任务页「今天」显示所有等我处理的任务（之前执行者/负责人看不到下周才截止的新任务，红点和页面对不上）。
16. **部署**：`DEPLOY.md`；`scripts/server-mac.sh install`（launchd 常驻）；`Dockerfile`（构建步骤已在干净目录模拟验证，镜像本身未构建：本机 Docker 守护进程没开）。
17. **iOS 调试辅助**（仅 Debug）：模拟器启动环境变量 `SIMCTL_CHILD_TM_SERVER` / `TM_AUTOLOGIN=账号:密码` / `TM_HASH=ideas`。已验证 App 通过局域网 IP（http://192.168.1.108:8787）登录服务器。

18. **安全加固**（独立代码审查发现 2 高 10 中，全部修复并补测试）：引擎操作名只认自身属性（`constructor` 曾能拿到整库）；`/api/act` 只回传简单字段；附件类型白名单 + nosniff + CSP 沙箱（防上传 HTML 盗会话）、按可见性读、加密随机 ID、每人配额、上传中断清理、Range 规范；动态记录按项目 / 任务裁剪；网址里只放「只能读附件」的文件令牌；服务器强制首次改密；首次创建团队要初始化码（`setup-code.txt`）；管理员不能管老板和其他管理员、不能改老板资料；重置密码不恢复停用；登录限流加固（假哈希、按 IP 总量、TRUST_PROXY）；AI 额度预占；会话失效即断 SSE；清理演示数据只限老板且先备份；偏好白名单、设置类型校验；演示专用迁移只作用于演示数据（`real` 标记）。同步层：5xx/429 退避重试、过期保留发件箱（同一人重登后补发）、本地 ID 被服务器改写时同步替换后续操作、拒绝旧版本覆盖、上传队列逐个读取。
19. **想法整理稿接 Claude**：提交后规则稿立即可用；服务器后台用结构化输出生成 Claude 稿，以系统身份 `agent` 通过 `idea.aiResult` 写回（字段清洗；最新一版是人工写的就不覆盖），界面标「Claude 整理」。`AI_AUTO_ANALYZE=0` 可关。
20. **正式模式文案**：`SRV_WORDS` 措辞对照表（`wordsFix`）在服务器模式下作用于页面、弹窗、提示、AI 面板：去掉「演示版」，已不属实的说法（不上传等）改为实际情况；真实团队不显示「清理演示数据」。
21. **构建拦截同名函数**：build.js 检查 app.js 同名函数（曾把 `W(id)` 覆盖导致项目页报错）。
22. **按角色**：执行者的想法页六宫格换成「全部 / 共创中 / 我参与的 / 进行中 / 已完成 / 暂缓」；App 首次打开欢迎页（连接服务器 / 看演示）；App 里禁止缩放、去掉点按高亮和长按菜单。

23. **上架准备**：iOS 隐私清单 `PrivacyInfo.xcprivacy`（UserDefaults CA92.1、不追踪、数据只用于 App 功能）；App 内注销账号（需密码；老板不能注销；通知老板）；`PRIVACY.md` 隐私政策；真机 Release 构建（`-sdk iphoneos`，不签名）已验证通过。
24. **iOS 推送**：`server/push.js`（零依赖 http2 + ES256，`APNS_*` 环境变量，失效设备自动清理，遵守「重要事项通知我」偏好，同一手机换人登录设备跟随）；App 端登录后申请权限、登记设备、点通知跳页、前台收到时立即同步、退出时先注销设备；AppDelegate + `App.entitlements` 已就绪。`test_push.js`（16 项）用本地模拟 APNs 验证签名和收件人。需要开发者账号的推送密钥才能真正发出。
25. **更多 Claude 功能**（都只给老板 / 管理员，失败退回规则版，以系统身份 `agent` 写回、字段清洗）：老板决策建议（按需「让 Claude 分析」，存到 `decision.ai`）；讨论总结（后台把规则版换成 Claude 版，`idea.digestResult`）；AI 新建项目解析（`/api/ai/project`）。
26. 欢迎页不显示演示横幅；密码框补全样式。

27. **第二轮独立审查**（3 高 5 中，全部修复并补测试）：整理稿只引用公开给团队的资料（规则版 `kbMatch(..., teamOnly)` 和 Claude 版都改，防止员工通过想法原文套出老板「仅 AI 可见」资料）；`decision.ai` 与讨论总结只下发老板；想法已派发 / 已决策后迟到的 AI 结果不覆盖；推送设备绑定会话（退出、重置密码、会话过期即停推），每人最多 10 台；APNs 半断连接自动重建；后台 AI 写回出错回滚、全局兜底不崩；同一想法 10 分钟内只自动整理一次、系统自动 AI 单独额度 `AI_SYSTEM_LIMIT`；`ai_jobs` 记录后台任务，重启只补做没做完的；注销 / 改密码限流；**iOS 退出登录后令牌被原生备份「复活」**（sync.js `reloadSafe` 刷新前先写完备份）；发件箱、上传队列按用户隔离。
28. **同步一致性测试** `test_sync.js`：把 test.js 每一步都在裁剪后数据（客户端）和完整数据（服务器）上各跑一次，校验成败和 ID 一致。
29. 执行者「我的」统计块：待接收、已逾期；同步刷新时保留折叠区展开状态。

30. **新团队第一天**：老板创建空白团队后弹出「三步开始使用」（添加成员、公司方向、第一个想法，可在我的页重新打开）；设置里「使用情况」（AI 次数与估算费用、账号、设备、附件空间）和「导出全部数据」（老板）；新建项目「AI 拆任务」接 Claude。
31. **⚠️ 我做的业务规则决定（请老板过目）**：团队里**还没有运营者**时，由老板兼任跟进（建项目自动由老板跟进、想法由老板认领、待认领通知发老板）；**还没有负责人**时，老板可以自任产品项目负责人。原因：否则只有老板和执行者的小团队建不了项目、想法永远没人认领。加了运营者 / 负责人后自动恢复原分工。引擎 `followUsers` / `canFollow` / `leadUsers`。
32. 构建检查：app.js 在 `var DO` 定义前给 DO 赋值（曾两次导致整个 App 打不开）也会在构建时拦下。
33. **规模**：大团队（2400 想法 / 4000 任务）老板完整数据约 6MB；服务器响应 brotli / gzip 压缩到约 230KB；客户端各页渲染约 0.1 秒（电脑）。完整数据超过 localStorage 容量（约 5MB）时改存 IndexedDB + 小的启动骨架 `tm_boot`，**服务器模式启动绝不退回演示数据**（之前会让真实用户短暂看到演示数据），原生备份不镜像大缓存。`e2e_bigcache.js`。
34. 想法 / 项目详情的「问 AI」接 Claude（带该想法 / 项目背景）。
35. 扫码加入（分派账号后显示 `teamops://join` 二维码，App 打开后自动填好服务器和账号）；自己设置头像（裁成 256 正方形上传，全队可见）；演示老板照片只用于演示数据；每天清理 60 天前已读通知；`使用说明.md`（给老板和团队看）。
36. **随机操作测试** `test_fuzz.js`（多角色随机操作，检查不抛异常、不泄漏、客户端与服务器一致、ID 唯一；npm test 里跑两组种子各 3000 次，另手工跑过 20 组 × 8000 次全部干净）。它发现并修复了：老板能删除别人的私人草稿；已删除的想法仍能被各种操作改动（`idea()` 辅助函数统一拦截）。
37. App 触感反馈（成功轻震、出错提示震动，`@capacitor/haptics`）。
38. **界面爬虫** `npm run crawl`（约 4 分钟，不在日常 check 里）：5 个角色 × 22 个页面 × 每个可点按钮（含弹出面板里一层），每次重新加载，检查无脚本报错。首轮 828 次点击发现 1 处（复制链接失败未处理），已修。改动界面较多时建议跑一次。
39. **知识库上传 Word / PDF**：`.docx` 在手机上解析成 Markdown（`docxToMd`：手动解 zip + `DecompressionStream('deflate-raw')` + DOMParser，保留标题和列表，不经过服务器、离线可用）；PDF 交给 Claude 读（`/api/ai/doc`，仅老板 / 管理员且 AI 启用，请求体单独放宽到 15MB）。
40. **第三轮独立审查**（2 高 3 中 4 低，全部修复）：头像文件只认本人上传的（防止把别人的私有附件设成头像来读取）；AI 请求超时放宽（读 PDF 5 分钟、其他生成 2 分钟，之前 15 秒就放弃但服务器照扣次数）；启动骨架不弹引导、不写成缓存、读到骨架改读 IndexedDB；扫码加入只认干净的 origin（防伪造地址）、切换前确认；PDF 读取失败提示、截断时标题注明「内容不完整」；Word 解压超过 20MB 拒绝；注销 / 切换服务器清大缓存，缓存记录所属服务器；没有运营者时老板的认领 / 重试能力一致。
41. 语音识别没网时改用手机本地识别（`onDevice`）。
42. **老板每日早报**：服务器每天 `BRIEF_AT`（默认 08:00）以系统身份发 `system.dailyBrief` 通知（推送配置后同时推到手机）：待决策、待终验、逾期、受阻、无动静任务、昨天新想法和完成数；AI 启用时附 Claude 三句话要点（计入系统额度）；没事不发。测试用 `BRIEF_NOW=1`。
43. **截止提醒**：同一时间 `system.dueReminders` 给执行人发「明天截止」「已逾期」（每任务每天最多一次，`t.remindedOn`）。
44. AI 生成待办接 Claude（`/api/ai/todos`，提示里带今天日期和星期，服务器校验日期 / 时间 / 优先级、人名转 ID）。
45. 新建项目「优化描述」「拟写目标」接 Claude（`/api/ai/write` 轻量接口）；AI 助手里的拆待办、会议纪要的待办部分走 Claude。
46. **从备份恢复**：`server/restore.js <备份文件> --yes`（每日备份或导出文件都可以；先停服务器；恢复前自动另存当前数据；版本号前进，在线手机自动拉取）。


## 本轮新增（第八轮 · 2026-10-05 · Android）
47. **Android 工程**（android/，Capacitor 8）：本机装了 JDK 21（~/Library/Java）和 Android SDK（~/Library/Android/sdk，命令行工具）；`npm run android` = 构建 → 同步 → 编译签名的 release APK → 复制到桌面。
    - 原生语音：`SpeechPlugin.java`（Android SpeechRecognizer，接口与 iOS 版相同；每句说完自动接着听，结果累加），在 MainActivity 注册。
    - 权限：RECORD_AUDIO + MODIFY_AUDIO_SETTINGS（页面里 getUserMedia 录音需要后者，否则 WebView 直接拒绝）；声明 RecognitionService 查询。
    - 允许 http 服务器（usesCleartextTraffic + allowMixedContent），teamops:// 链接（扫码加入）、仅竖屏、返回键。图标 / 启动屏由 img/app-icon.png 生成（@capacitor/assets）。
    - **推送在 Android 上暂不启用**（需 Firebase google-services.json，服务器也只接了 APNs）；native.js 里 platform==='android' 时不注册。
    - **发布签名**：android/release.keystore + android/keystore.properties（不进 git）。**务必另外备份这两个文件**，丢了以后发的新版本不能覆盖安装。
    - 模拟器验证：启动、连 http 服务器、登录、老板首页、语音页录音与识别启动都正常。真机上「录音 + 语音识别同时用麦克风」有的机型可能冲突，待真机确认。

48. **页面切换动画**（app.js `navTo`）：进入下一级从右滑入、返回反向、切底部标签淡入淡出；有 View Transitions 时新旧两页一起动，否则只给新页进入动画；iOS 侧滑返回不重复播放；系统「减少动态效果」时关闭；自动化测试里默认关（`window.__tmAnim = true` 强制打开，见 e2e_anim）。弹窗关闭也有收起动画（`#layer-out`）。
49. **返回逻辑重做**（用户反馈「返回直接回首页」）：
    - `goBack()`：有来源页就 history.back()，没有（重开 App 后）就回到 `navParent()` 给出的上一级；所有返回键（`back`、通用页头 `pBack`）都走它。原来 `pBack` 一律回首页、`project/ai` 返回会压新历史。
    - `navFinish(h)`：提交表单（想法、新建项目、派任务、加待办、口述成规则、删除想法）后，把表单页从返回路径里去掉（history.go(-k) 再跳结果页）。
    - Android 返回键 `__tm.back()`：先关弹窗 / AI 面板 → 子页面返回 → 标签页回首页 → 首页才退出。
    - 测试：e2e_nav（16 项）；`node e2e/crawl_back.js`：5 个角色 × 22 个页面 × 每个会跳页的按钮，点进去再返回（页面返回键 + 手机返回键）必须回原页，264 条路径全过。
50. **Android 加固**（不带 Google 服务的 Android 14 / WebView 113 模拟器复现国产手机环境）：
    - 没有系统语音识别服务时去掉转写（`tm-nospeech` 事件），页面提示「这台手机不支持转写」，录音照常。
    - 闪退记录：`DiagPlugin`（Java 异常）+ 网页渲染进程崩溃时重建页面而不是整个 App 退出；下次打开弹「App 上次意外关闭」，可一键复制发给开发者。
    - 原生语音插件回调全部兜底；识别器忙时换新的重试。
    - 打开附件 / 外部链接 / 导出备份：App 里没有新窗口和网页下载 → 外部地址交给系统浏览器，本地文件写缓存后弹系统分享（@capacitor/filesystem + share）。
    - 「浏览器」字样在 App 里改成手机说法（`APP_WORDS`），权限提示给出手机设置路径。
    - 只有 iOS 才调用键盘工具条接口（安卓上会报 UNIMPLEMENTED）。
    - 固定浅色主题，状态栏 / 导航栏白底深色图标（旧 WebView 上 Capacitor 把页面放在系统栏之间）；CSS 安全区改用 `--sat/--sab`（同时读 env() 和 Capacitor 注入的 --safe-area-inset-*）。
    - 测试：e2e_android（伪造 Capacitor Android 端，20 项）。
51. **真机环境爬虫**（不进 `npm run check`，需要模拟器）：`e2e/inpage_crawl.js` 在 App 页面里逐个角色 / 页面 / 按钮点击并回报；`npm run test:android`（adb + Playwright，模拟器或 USB 真机）、`npm run test:ios`（编译调试版装进 iOS 模拟器，靠 `TM_SCRIPT` 环境变量注入）。同时监视闪退、被系统界面盖住。调试版 `__tm.as(uid)` 仅演示模式可用。

52. **安卓相机 / 选文件 / 扫码实测**（模拟器里真实走系统界面）：
    - 「拍照」「拍摄视频」原来在 Android 11+ 打不开相机（没声明相机 intent，Capacitor 退回相册选择）→ 清单 `<queries>` 补 IMAGE_CAPTURE / VIDEO_CAPTURE；相册选视频、相机拍视频、拍照上传到项目都已实测。
    - 相机 / 相册给的文件名（JPEG_2026…、1000000019.mp4）改成「照片 / 视频 X月X日 时:分」（`niceFileName`，在 change 事件入口统一改名）。
    - 扫码加入（teamops://join）确认、删除待办、清空录音、重置演示数据：改用应用内确认面板 `askSheet`（系统对话框的按钮跟手机语言走、样式不统一）；`kbTpl` 在已打开的面板里，仍用系统对话框。
    - 只用来查看的面板（主按钮是「关闭」）不再同时显示「取消」。
    - 语音页只输入了文字时「清空」按钮也能点。
    - 用户可见文字去掉 npm、setup-code.txt 等技术词。
    - 测试：e2e_ask（10）、e2e_android（22）；`node e2e/device_android_flow.js`（安卓真机环境：建团队 → 记想法 → 服务器收到 → 实时同步 → 断开补发 → 重开仍登录 → 退出，13 项）。
    - 设备爬虫结果：安卓（Android 14 / WebView 113，无 Google 服务）5 个角色 796 次点击 0 报错 0 闪退；iOS 模拟器 892 次点击，0 报错（复测）。

53. **老系统兼容（Android 11 / WebView 83 模拟器实测）**：
    - **黑屏 / 「App 没有响应」**：页面加载太快时，第一次关启动屏的调用早于系统准备好，被忽略，屏幕一直黑（0 帧）。修：native.js 加载后 60 / 700 / 1800 ms 各发一次 hide；capacitor.config 启动屏 `launchAutoHide: true`、最长 2 秒兜底。去掉 Capacitor 8 不建议的 `Keyboard.resizeOnFullScreen`。
    - CSS `inset` 简写（Chrome 87+）：build.js `cssCompat` 自动在前面补 top/right/bottom/left。
    - `:has()`（Chrome 105+ / iOS 15.4+）：选项卡片选中样式改由 JS 加 `is-checked` 类兜底（`markChecked`）；首页锁定给 html 加 `home-lock` 类。
    - flex `gap`（Chrome 84+）：检测不支持时把 gap 换成子元素外边距（`flexGapFix`，只在旧 WebView 上运行）。
    - Android 11 上全角色爬虫 890 次点击 0 报错 0 闪退。
    - 设备测试共用 `e2e/_android.js`（按新进程号找 WebView，避免拿到旧进程的）。

54. 安卓首页按返回键：先提示「再按一次退出」，2 秒内再按才退出。iOS 真机环境流程测试 `npm run test:ios:flow`（调试版预设服务器 + 自动登录 → 记想法 → 服务器收到 → 实时同步 → 重开仍登录，5 项）；安卓同类 `npm run test:android:flow`。iOS 模拟器全角色爬虫复测 892 次 0 报错。旧安卓（模拟器软件渲染）页面切换约 10–110 ms。

**设备测试清单**（改了原生层或大改界面后跑；需要模拟器）：`npm run test:android`、`npm run test:android:flow`、`npm run test:ios`、`npm run test:ios:flow`；返回路径 `node e2e/crawl_back.js`。

55. **安卓 App 分发闭环（不上应用商店）**：服务器 `GET /api/app`（公开，版本信息）、`GET /app/android.apk`（下载）、`GET /app`（手机浏览器打开的安装页）；`npm run android [-- 说明]` = scripts/android.js：打包 → 桌面 → 放到 `DATA_DIR/app/`（teamops.apk + android.json）。App（安卓）启动 3 秒后比较 versionCode，有新版弹「发现新版本」（以后再说 → 同一版本不再自动弹）；「我的 → App 版本」手动检查；老板 / 管理员「我的 → 给同事安装 App」出示安装页二维码。测试：test_server 95、e2e_android 34。DEPLOY.md 补了发布说明。
56. 设置页去掉内部编号（「第 3 节待拍板」「C1–C4」）；演示页、云盘提示改成不再承诺没做的功能。
    - **当前安卓版本 1.4（versionCode 5），已放到本机服务器**。用户手机上的 1.0 没有检查更新功能，需要手动装一次 1.4，之后的更新会自动提示。

57. 安卓系统字体调大时 WebView 文字最多跟随到 115%（MainActivity `setTextZoom`），130% 时首页卡片会重叠。

测试现状：业务 418 + 同步一致性 254 次操作 + 随机操作 2×3000 + 服务器 90 + AI 代理 50 + 推送 19；端到端 25 组；界面爬虫另跑。提交前看 `npm run check` 的退出码。


## 待办
1. **需要老板提供**：`ANTHROPIC_API_KEY`（真实 AI）；Apple 开发者账号（真机安装、TestFlight、推送）
2. 推送：代码已就绪，拿到开发者账号后按 DEPLOY.md 配 APNS_* 并在 Xcode 开 Push 能力
3. 想法整理（deriveAnalysis）、AI 拟题、讨论总结等引擎内同步的「AI」仍是规则：要接真实 AI 需改成异步（服务器在 act 后补写 AI 结果）
4. Android：已出 APK；待办：真机验证语音、Android 推送（Firebase + 服务器 FCM）、上架 Google Play 需开发者账号（25 美元一次性）
5. app.js 按页面拆模块（函数同名覆盖隐患）
6. 增量同步（现在每次下发完整数据，已压缩；数据再大一个量级时再做）

## 命令（新增）
- `npm run server`：启动服务器（PORT / HOST / DATA_DIR 可配）
- `npm run ios`：构建网页 → 拷进 iOS 工程 → 编译并在模拟器启动
- 打开 Xcode：`npx cap open ios`
- `npm run android`：生成 Android APK 到桌面（模拟器：`~/Library/Android/sdk/emulator/emulator -avd tm36`）

## 规范
- 用户偏好：中文、简洁、按设计图 1:1 复刻、每次交付前跑完测试、结尾给编号的下一步
- 紧凑比例：详情页标题 19、卡片标题 15.5、正文 13.5–14、卡片圆角 20、输入框 42 高、按钮 44–46 高
