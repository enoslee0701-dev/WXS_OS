# 真实闭环实测（不在 npm run check 里：需要本机 whisper 和本机 AI，跑一次约 3 分钟）

模拟一个团队从老板口述视频到项目完成的全过程，用的是真转写、真模型、真浏览器。

1. 生成视频和会议录音（macOS 自带中文语音）：
   `say -v Tingting -f e2e/real/boss.txt -o /tmp/boss.aiff && ffmpeg -y -f lavfi -i color=c=black:s=640x360:r=15 -i /tmp/boss.aiff -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac e2e/real/boss.mp4`
   `say -v Tingting -f e2e/real/meet.txt -o /tmp/meet.aiff && ffmpeg -y -i /tmp/meet.aiff e2e/real/meet.m4a`
2. 另起一台临时服务器（不要碰正式的 8787）：
   `PORT=24871 HOST=127.0.0.1 DATA_DIR=/tmp/tm-real SETUP_CODE=c node server/server.js`
3. `cd e2e/real && node loop1_boss_video.js && node loop2_team.js`（账号写在 accts.json，日志在 run.log，截图 p1_*.png / p2_*.png）
4. 大视频（700MB、8 分钟、中途重启服务器续传）：`node loop3_bigvideo.js`（需要先准备 big.mp4，见脚本开头）
