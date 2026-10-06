# 团队服务器部署说明

团队协同由两部分组成：**服务器**（存全团队的数据、账号、附件，代理 AI）和 **App**（iPhone / 浏览器）。
服务器是一个零依赖的 Node 程序（Node 24+），数据都在一个文件夹里（默认 `server/data/`）。

## 方式一：放在办公室的一台 Mac 上（最简单）

团队在同一个地方，用办公室 Wi-Fi 就够了。

```bash
cd team-ops
npm install
# 可选：填了才启用真实 AI（只有老板和管理员会用到）
export ANTHROPIC_API_KEY=sk-ant-...
scripts/server-mac.sh install     # 装成常驻服务：开机自启、崩溃自动重启
scripts/server-mac.sh status      # 查看状态
scripts/server-mac.sh logs        # 看日志
```

装好后会显示地址，例如 `http://192.168.1.108:8787`：

1. 老板第一次打开 App（或用浏览器打开这个地址），在登录页填服务器地址 → 「创建你的团队」。需要填**初始化码**：安装时会显示，也保存在数据目录的 `setup-code.txt`（防止同一网络里别人抢先创建团队）。
2. 「我的 → 我的团队 → 邀请新成员」添加同事，添加后会弹出「分派登录账号」，把账号和初始密码发给对方。
3. 同事在 App 登录页填同一个服务器地址和账号；第一次登录会要求改密码。

注意：这台 Mac 要一直开着、不要睡眠（系统设置 → 电池 / 节能 → 防止自动睡眠），并建议在路由器里给它固定 IP。

## 方式一·补充：临时公网地址（同事不在同一个 Wi-Fi）

不想买服务器、只是先用起来或测试时，可以给办公室这台 Mac 开一个 Cloudflare 免费通道（不用注册，全程 https 加密）：

```bash
scripts/tunnel-mac.sh install     # 开通道（常驻、开机自启），显示公网地址，例如 https://xxxx.trycloudflare.com
scripts/tunnel-mac.sh url         # 查看当前地址
scripts/tunnel-mac.sh uninstall   # 关闭（之后只有同一个 Wi-Fi 能连）
```

App 登录页的服务器地址填这个 https 地址即可，手机用 4G/5G 或任何 Wi-Fi 都能连。限制：Mac 要开着；通道重启（重启电脑等）后**地址会变**，要把新地址告诉同事；没有可用性保证，正式使用请用方式二或 Cloudflare 账号的固定域名。

## 方式二：云服务器（在外面也能用）

```bash
docker build -t team-ops .
docker run -d --name team-ops -p 8787:8787 -v team-ops-data:/data \
  -e ANTHROPIC_API_KEY=sk-ant-... --restart unless-stopped team-ops
```

公网一定要加 HTTPS。最省事的是在同一台服务器上用 Caddy（自动申请证书）：

```
# /etc/caddy/Caddyfile
team.example.com {
  reverse_proxy localhost:8787
}
```

然后 App 里服务器地址填 `https://team.example.com`。

## 配置项（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 8787 | 端口 |
| `HOST` | 0.0.0.0 | 监听地址 |
| `DATA_DIR` | server/data | 数据目录（数据库、附件、每日备份） |
| `MAX_FILE_MB` | 500 | 单个附件上限 |
| `ANTHROPIC_API_KEY` | 无 | 填了才启用真实 AI（Claude） |
| `AI_MODEL` | claude-opus-5-5 | AI 模型 |
| `AI_FOR_ALL` | 关 | 设为 1 时全员可用真实 AI（默认只有老板和管理员） |
| `AI_DAILY_LIMIT` | 200 | 每人每天 AI 调用上限 |
| `AI_SYSTEM_LIMIT` | 100 | 后台自动 AI（整理稿、讨论总结、早报）全队每天上限 |
| `AI_AUTO_ANALYZE` | 开 | 设为 0：想法整理稿、讨论总结不自动交给 Claude |
| `BRIEF_AT` | 08:00 | 老板每日早报的时间（服务器所在时区） |
| `AI_DAILY_BRIEF` | 开 | 设为 0：早报不附 Claude 要点（只发数字） |
| `USER_QUOTA_MB` | 5000 | 每人附件总容量 |
| `SETUP_CODE` | 随机 | 首次创建团队的初始化码 |
| `TRUST_PROXY` | 关 | 设为 1：在反向代理后按 X-Forwarded-For 识别 IP（登录限流用） |

## 录音 / 视频自动转文字（可选，推荐）

在服务器这台 Mac 上运行一次：
```
scripts/whisper-mac.sh
scripts/server-mac.sh install   # 重启服务器
```
之后同事上传的录音和视频会在这台电脑上自动转成文字（不发给任何第三方），再用来生成整理稿。需要 ffmpeg；模型约 550MB。

## 本机 AI（没有 Claude 密钥时，可选）

```
scripts/llm-mac.sh
scripts/server-mac.sh install   # 重启服务器
```
在服务器这台 Mac 上运行开源中文模型（Qwen2.5 7B，约 4.7GB，建议 16GB 以上内存的 Apple 芯片 Mac）。AI 整理想法、AI 助手、拆待办、新建项目解析等由它完成，数据不出这台电脑、不花钱。配置 `ANTHROPIC_API_KEY` 后自动改用 Claude（效果更好，还能看图片、读 PDF）。

## 安卓 App 的安装与更新（不经过应用商店）

- **发布新版**：在服务器这台 Mac 上，先把 `android/app/build.gradle` 里的 `versionCode` 加 1、`versionName` 改成新版本号，然后运行：
  ```
  npm run android -- "这次更新的说明"
  ```
  会生成桌面上的「团队协同.apk」，并放到服务器数据目录的 `app/` 里。
- **同事更新**：同事打开 App 时会提示「发现新版本」，点「下载安装」即可。数据都在服务器上，更新不会丢失。
- **同事首次安装**：老板在 App「我的 → 给同事安装 App」出示二维码，或直接把 `http://服务器地址:8787/app` 发给同事，用手机浏览器打开后下载。
- **签名证书**：`android/release.keystore` 和 `android/keystore.properties` 只在这台 Mac 上，**一定要另外备份**。丢了的话，新版本无法覆盖安装旧版本。

## iOS 推送通知（有苹果开发者账号后）

1. 在 [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list) 新建一把密钥，勾选 **Apple Push Notifications service (APNs)**，下载 `AuthKey_XXXXXXXXXX.p8`（只能下载一次，妥善保存）。
2. 在 Xcode 里给 App 开启 **Push Notifications** 能力（工程里已经准备好 `App.entitlements` 和 AppDelegate 代码）。
3. 服务器加上这些环境变量后重启：

| 变量 | 说明 |
|---|---|
| `APNS_KEY_FILE` | .p8 文件的路径 |
| `APNS_KEY_ID` | 密钥 ID（10 位，文件名里那串） |
| `APNS_TEAM_ID` | 开发者账号的 Team ID |
| `APNS_BUNDLE_ID` | App 的 Bundle ID（默认 com.teamops.app） |
| `APNS_ENV` | Xcode 直接装到手机上调试时填 `development`；TestFlight / App Store 用默认的 `production` |

之后，派任务、待验收、等老板决策、被 @ 等 App 内通知会同时推送到手机。每个人可以在「我的 → 通知」里关掉。

## 备份

- 数据目录下 `backups/` 每天自动存一份完整快照（JSON）。
- 整体备份：停服务后复制整个数据目录（`team.db`、`files/`、`backups/`）。
- **每月异地备份**（建议）：`scripts/backup-mac.sh install <文件夹>`，每月 1 日凌晨 3 点把数据库快照和全部附件打包到这个文件夹（选 iCloud 云盘、外接硬盘或网盘同步文件夹），保留最近 12 份；`scripts/backup-mac.sh run <文件夹>` 立刻备份一次。
- **恢复**：先停服务器（`scripts/server-mac.sh uninstall` 或停 Docker），再运行 `node server/restore.js server/data/backups/state-2026-10-03.json --yes`，然后重新启动。也可以用「只导出团队数据」的 .json，或「完整备份」下载的 .tar.gz 来恢复（.tar.gz 会把附件一起放回 data/files，已有的不覆盖）。恢复前会自动把当前数据另存一份；账号和密码不受影响。

## 安全提示

- 首次创建团队需要初始化码；成员首次登录必须改掉初始密码才能操作。
- 附件只有能看到对应想法 / 项目的人能打开；网页、SVG 这类文件一律按下载处理；附件链接里只有「只能读附件」的文件令牌。
- 密码加盐哈希存储；登录连续输错 10 次锁定 15 分钟；老板可随时停用账号、重置密码（对方立即被登出）。
- 员工只能拿到自己有权看的数据（服务器按身份裁剪），AI 也只读提问人能看到的数据。
- 局域网用 http 即可；放到公网必须用 https。
