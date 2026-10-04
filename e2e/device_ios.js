// iOS 模拟器里的界面爬虫：编译调试版 App → 装进模拟器 → 用 TM_SCRIPT 注入 e2e/inpage_crawl.js，
// 在真实的 iOS WebView（WKWebView）里逐个角色、逐个页面、逐个按钮点一遍；结果发回这里。同时监视 App 有没有闪退。
// 用法：node e2e/device_ios.js [角色名...]（SIM=模拟器名称）   （需要 Xcode）
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), sh = (c, cwd) => execSync(c, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'] });
const name = process.env.SIM || 'iPhone 18 Pro', roles = process.argv.slice(2).join(',');
const devs = Object.values(JSON.parse(sh('xcrun simctl list devices available -j')).devices).flat();
const dev = devs.find(d => d.name === name) || devs.find(d => /iPhone/.test(d.name));
if (!dev) { console.error('没有可用的 iPhone 模拟器'); process.exit(1); }
const collector = require('./_collector');
collector(async (port, st, srv) => {
  const bad = st.bad;
  console.log('编译 iOS 调试版（' + dev.name + '）…');
  sh('node build.js', ROOT); sh('npx cap copy ios', ROOT);
  sh(`xcodebuild -project App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=${dev.udid}' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet`, path.join(ROOT, 'ios', 'App'));
  try { sh(`xcrun simctl boot ${dev.udid}`); } catch (e) {}
  sh(`xcrun simctl bootstatus ${dev.udid} -b`);
  try { sh(`xcrun simctl uninstall ${dev.udid} com.teamops.app`); } catch (e) {}
  sh(`xcrun simctl install ${dev.udid} "${path.join(ROOT, 'ios/App/build/Build/Products/Debug-iphonesimulator/App.app')}"`);
  for (const s of ['microphone', 'speech-recognition', 'photos', 'camera']) { try { sh(`xcrun simctl privacy ${dev.udid} grant ${s} com.teamops.app`); } catch (e) {} }
  const t0 = Date.now();
  sh(`SIMCTL_CHILD_TM_SCRIPT='http://127.0.0.1:${port}/crawl.js${roles ? '?roles=' + encodeURIComponent(roles) : ''}' xcrun simctl launch ${dev.udid} com.teamops.app`);
  console.log('已启动，开始点按钮');
  let crashed = false;
  while (!st.finished) {
    await new Promise(r => setTimeout(r, 3000));
    const running = /com\.teamops\.app/.test(sh(`xcrun simctl spawn ${dev.udid} launchctl list`));
    if (!running) { crashed = true; break; }
    if (Date.now() - st.last > 120000) { bad.push('两分钟没有进展（页面卡住？）'); break; }
  }
  console.log('');
  if (crashed) {
    bad.push('App 闪退');
    const dir = path.join(process.env.HOME, 'Library/Logs/DiagnosticReports');
    const f = fs.existsSync(dir) && fs.readdirSync(dir).filter(x => /^App[-_].*\.ips$/.test(x)).map(x => path.join(dir, x)).filter(x => fs.statSync(x).mtimeMs > t0)[0];
    if (f) console.log('崩溃报告：' + f + '\n' + fs.readFileSync(f, 'utf8').slice(0, 3000));
  }
  [...new Set(bad)].forEach(m => console.log('✗ ' + m));
  const fin = st.finished;
  console.log(`iOS 爬虫：点了 ${fin ? fin.total : st.total} 次`);
  console.log(`iOS 爬虫 通过 ${fin ? fin.total - fin.bad : 0}，失败 ${bad.length}`);
  srv.close(); process.exit(bad.length ? 1 : 0);
});
