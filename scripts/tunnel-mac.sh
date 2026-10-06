#!/bin/zsh
# 临时公网地址（Cloudflare 免费通道，不用注册）：不在同一个 Wi-Fi 的同事也能连团队服务器，全程 https 加密。
# 这台 Mac 要开着；通道重启后地址会变（用 url 查看新地址）。正式上线请换云服务器或固定域名，见 DEPLOY.md。
# 用法：scripts/tunnel-mac.sh install | uninstall | status | url | logs
set -e
LABEL=com.teamops.tunnel
ROOT=${0:A:h:h}
PLIST=~/Library/LaunchAgents/$LABEL.plist
DATA=${DATA_DIR:-$ROOT/server/data}
LOG=$HOME/Library/TeamOps/tunnel.log   # 不放桌面：macOS 不让后台程序写桌面文件夹
BIN=${CLOUDFLARED:-$HOME/Library/TeamOps/bin/cloudflared}
url() { grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' $LOG 2>/dev/null | grep -v '//api\.' | tail -1; }
case "$1" in
  install)
    if [ ! -x $BIN ]; then
      mkdir -p ${BIN:h}; A=$(uname -m); [ $A = x86_64 ] && A=amd64
      curl -sSL -o /tmp/cf.tgz https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$A.tgz
      tar xzf /tmp/cf.tgz -C ${BIN:h} && rm -f /tmp/cf.tgz
    fi
    mkdir -p ${LOG:h} ~/Library/LaunchAgents
    cat > $PLIST <<P
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$BIN</string><string>tunnel</string><string>--no-autoupdate</string><string>--url</string><string>http://localhost:${PORT:-8787}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
P
    launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true
    for i in 1 2 3 4 5 6 7 8 9 10; do launchctl print gui/$(id -u)/$LABEL >/dev/null 2>&1 || break; sleep 1; done
    : > $LOG
    launchctl bootstrap gui/$(id -u) $PLIST 2>/dev/null || { sleep 2; launchctl bootstrap gui/$(id -u) $PLIST; }
    for i in $(seq 1 90); do [ -n "$(url)" ] && break; sleep 1; done
    [ -n "$(url)" ] && echo "公网地址：$(url)    （在 App 的服务器地址里填这个）" || { echo "还没拿到地址，看日志：$LOG"; exit 1; }
    ;;
  uninstall) launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true; rm -f $PLIST; echo 已关闭公网通道;;
  status) launchctl print gui/$(id -u)/$LABEL 2>/dev/null | grep -E "state|pid" || echo 未运行; U=$(url); [ -n "$U" ] && { echo $U; curl -s -m 10 $U/api/health; echo; };;
  url) url;;
  logs) tail -n 50 -f $LOG;;
  *) echo "用法：$0 install | uninstall | status | url | logs"; exit 1;;
esac
