// 安卓真机环境的界面爬虫：调试版 App 装在模拟器或 USB 真机上，注入 e2e/inpage_crawl.js，
// 在真实的安卓 WebView 里逐个角色、逐个页面、逐个按钮点一遍；同时监视 App 有没有闪退、有没有被别的界面盖住。
// 先装调试版：npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug) && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
// 用法：node e2e/device_android.js [角色名...]
const { execSync } = require('child_process'), path = require('path');
const { _android } = require('playwright');
const collector = require('./_collector');
const { restartApp } = require('./_android');
const ADB = path.join(process.env.ANDROID_HOME || path.join(process.env.HOME, 'Library/Android/sdk'), 'platform-tools/adb');
const adb = (c) => { try { return execSync(`"${ADB}" ${c}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return ''; } };
const PKG = 'com.teamops.app';
collector(async (port, st, srv) => {
  const [d] = await _android.devices(); if (!d) { console.error('没有找到安卓设备（先启动模拟器或连上手机）'); process.exit(1); }
  console.log('设备：' + d.model() + '，Android ' + adb('shell getprop ro.build.version.release').trim());
  adb(`reverse tcp:${port} tcp:${port}`); // 手机访问 localhost:port 就是这台 Mac
  adb(`shell pm grant ${PKG} android.permission.RECORD_AUDIO`);
  adb('logcat -c -b crash');
  const p = await restartApp(d);
  // 清掉网页存储和原生备份，从演示模式开始
  await p.evaluate(async () => { await TMN.plugins.Preferences.clear(); localStorage.clear(); localStorage.setItem('tm_demo_chosen', '1'); });
  // 旧版 WebView 上 Playwright 的 reload() 可能一直等不到加载完成：从页面里刷新，再等 App 准备好
  await p.evaluate(() => { setTimeout(() => location.reload(), 50); }); await p.waitForTimeout(2500);
  await p.waitForFunction(() => window.__tm && window.__tm.S, null, { timeout: 30000 });
  await p.evaluate((u) => { const s = document.createElement('script'); s.src = u; document.body.appendChild(s); }, `http://localhost:${port}/crawl.js` + (process.argv.slice(2).length ? '?roles=' + encodeURIComponent(process.argv.slice(2).join(',')) : ''));
  console.log('开始点按钮');
  let crashed = false, covered = 0;
  while (!st.finished) {
    await new Promise(r => setTimeout(r, 3000));
    if (!adb(`shell pidof ${PKG}`).trim()) { crashed = true; break; }
    // 被别的界面（文件选择器、系统设置等）盖住：记下来并按返回键回到 App
    const top = adb('shell dumpsys activity activities').match(/topResumedActivity[^\n]*|mResumedActivity[^\n]*/);
    if (top && !top[0].includes(PKG)) { covered++; adb('shell input keyevent 4'); }
    if (Date.now() - st.last > 120000) { st.bad.push('两分钟没有进展（页面卡住？）'); break; }
  }
  console.log('');
  if (crashed) st.bad.push('App 闪退');
  const crashLog = adb('logcat -d -b crash').trim();
  if (crashLog) { st.bad.push('有崩溃日志'); console.log('崩溃日志：\n' + crashLog.slice(0, 3000)); }
  if (covered) console.log(`（期间有 ${covered} 次被系统界面盖住，已按返回键回到 App）`);
  [...new Set(st.bad)].forEach(m => console.log('✗ ' + m));
  const fin = st.finished;
  console.log(`安卓爬虫：点了 ${fin ? fin.total : st.total} 次`);
  console.log(`安卓爬虫 通过 ${fin ? fin.total - fin.bad : 0}，失败 ${st.bad.length}`);
  adb(`reverse --remove tcp:${port}`); await d.close(); srv.close(); process.exit(st.bad.length ? 1 : 0);
});
