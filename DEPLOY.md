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
| `USER_QUOTA_MB` | 5000 | 每人附件总容量 |
| `SETUP_CODE` | 随机 | 首次创建团队的初始化码 |
| `TRUST_PROXY` | 关 | 设为 1：在反向代理后按 X-Forwarded-For 识别 IP（登录限流用） |

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

## 安全提示

- 首次创建团队需要初始化码；成员首次登录必须改掉初始密码才能操作。
- 附件只有能看到对应想法 / 项目的人能打开；网页、SVG 这类文件一律按下载处理；附件链接里只有「只能读附件」的文件令牌。
- 密码加盐哈希存储；登录连续输错 10 次锁定 15 分钟；老板可随时停用账号、重置密码（对方立即被登出）。
- 员工只能拿到自己有权看的数据（服务器按身份裁剪），AI 也只读提问人能看到的数据。
- 局域网用 http 即可；放到公网必须用 https。
