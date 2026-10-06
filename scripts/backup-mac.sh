#!/bin/zsh
# 每月异地备份（开发者文档 14）：把团队数据库（一致性快照）和全部附件打成一个压缩包，放到你指定的文件夹
# （例如 iCloud 云盘、外接硬盘、网盘同步文件夹），只保留最近 12 份。
# 用法：
#   scripts/backup-mac.sh run <目标文件夹>        立刻备份一次
#   scripts/backup-mac.sh install <目标文件夹>    每月 1 日凌晨 3 点自动备份（launchd）
#   scripts/backup-mac.sh uninstall              取消自动备份
#   scripts/backup-mac.sh list <目标文件夹>       看已有的备份
# 恢复：先停服务器，解压后用 node server/restore.js 恢复团队数据，附件拷回 server/data/files（见 DEPLOY.md）。
set -e
LABEL=com.teamops.backup
ROOT=${0:A:h:h}
DATA=${DATA_DIR:-$ROOT/server/data}
PLIST=~/Library/LaunchAgents/$LABEL.plist
case "$1" in
  run)
    DEST=${2:?请给出目标文件夹}; mkdir -p "$DEST"
    DAY=$(date +%Y-%m-%d); TMP=$(mktemp -d)
    # 用 VACUUM INTO 得到一致性的数据库快照（服务器运行中也安全）
    node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec(\"VACUUM INTO '\"+process.argv[2].replace(/'/g,\"''\")+\"'\");" "$DATA/team.db" "$TMP/team.db" 2>/dev/null
    mkdir -p "$TMP/files"; [ -d "$DATA/files" ] && find "$DATA/files" -type f ! -name '*.upload-*' ! -name '*.part-*' -exec cp -p {} "$TMP/files/" \;
    tar -czf "$DEST/团队协同备份-$DAY.tar.gz" -C "$TMP" team.db files
    rm -rf "$TMP"
    ls -1t "$DEST"/团队协同备份-*.tar.gz 2>/dev/null | tail -n +13 | while read f; do rm -f "$f"; done
    echo "已备份：$DEST/团队协同备份-$DAY.tar.gz"
    ;;
  install)
    DEST=${2:?请给出目标文件夹}; mkdir -p "$DEST" ~/Library/LaunchAgents
    cat > $PLIST <<P
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$ROOT/scripts/backup-mac.sh</string><string>run</string><string>$DEST</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname $(command -v node)):/usr/bin:/bin</string><key>DATA_DIR</key><string>$DATA</string></dict>
  <key>StartCalendarInterval</key><dict><key>Day</key><integer>1</integer><key>Hour</key><integer>3</integer><key>Minute</key><integer>17</integer></dict>
  <key>StandardOutPath</key><string>$HOME/Library/TeamOps/backup.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/TeamOps/backup.log</string>
</dict></plist>
P
    mkdir -p ~/Library/TeamOps
    launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true
    launchctl bootstrap gui/$(id -u) $PLIST
    echo "已设置：每月 1 日凌晨 3 点备份到 $DEST（现在先备份一次）"; "$0" run "$DEST"
    ;;
  uninstall) launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true; rm -f $PLIST; echo 已取消自动备份;;
  list) ls -lh "${2:?请给出目标文件夹}"/团队协同备份-*.tar.gz 2>/dev/null || echo 还没有备份;;
  *) echo "用法：$0 run|install <目标文件夹> | uninstall | list <目标文件夹>"; exit 1;;
esac
