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

1. 老板第一次打开 App（或用浏览器打开这个地址），在登录页填服务器地址 → 「创建你的团队」。
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

## 备份

- 数据目录下 `backups/` 每天自动存一份完整快照（JSON）。
- 整体备份：停服务后复制整个数据目录（`team.db`、`files/`、`backups/`）。

## 安全提示

- 密码加盐哈希存储；登录连续输错 10 次锁定 15 分钟；老板可随时停用账号、重置密码（对方立即被登出）。
- 员工只能拿到自己有权看的数据（服务器按身份裁剪），AI 也只读提问人能看到的数据。
- 局域网用 http 即可；放到公网必须用 https。
