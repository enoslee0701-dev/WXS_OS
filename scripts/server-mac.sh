#!/bin/zsh
# 在这台 Mac 上把团队服务器装成常驻服务（开机自启、崩溃自动重启）。
# 用法：scripts/server-mac.sh install | uninstall | status | logs
# 可选环境变量：PORT（默认 8787）、ANTHROPIC_API_KEY（填了才启用真实 AI）
set -e
LABEL=com.teamops.server
ROOT=${0:A:h:h}
PLIST=~/Library/LaunchAgents/$LABEL.plist
DATA=${DATA_DIR:-$ROOT/server/data}
LOG=$DATA/server.log
case "$1" in
  install)
    mkdir -p $DATA ~/Library/LaunchAgents
    (cd $ROOT && node build.js >/dev/null)
    cat > $PLIST <<P
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$(command -v node)</string><string>$ROOT/server/server.js</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>PORT</key><string>${PORT:-8787}</string>
    <key>DATA_DIR</key><string>$DATA</string>
    <key>ANTHROPIC_API_KEY</key><string>${ANTHROPIC_API_KEY:-}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
P
    chmod 600 $PLIST
    launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true
    launchctl bootstrap gui/$(id -u) $PLIST
    sleep 1
    IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo 本机IP)
    echo "已安装并启动。同事在同一个 Wi-Fi 下用：http://$IP:${PORT:-8787}"
    ;;
  uninstall) launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true; rm -f $PLIST; echo 已卸载（数据保留在 $DATA）;;
  status) launchctl print gui/$(id -u)/$LABEL 2>/dev/null | grep -E "state|pid" || echo 未运行; curl -s -m 3 http://localhost:${PORT:-8787}/api/health; echo;;
  logs) tail -n 50 -f $LOG;;
  *) echo "用法：$0 install | uninstall | status | logs"; exit 1;;
esac
