// 安卓真机环境的完整使用流程（连团队服务器）：在模拟器或 USB 真机上的调试版 App 里
//   连接服务器 → 用初始化码建团队 → 记一个想法 → 服务器收到 → 服务器上别人的改动实时出现在手机上
//   → 服务器断开时记的想法先存手机、恢复后自动补发 → 手机返回键 → 退出登录
// 用法：node e2e/device_android_flow.js
const { execSync, spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const { _android } = require('playwright');
const ADB = path.join(process.env.ANDROID_HOME || path.join(process.env.HOME, 'Library/Android/sdk'), 'platform-tools/adb');
const adb = (c) => { try { return execSync(`"${ADB}" ${c}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return ''; } };
const PKG = 'com.teamops.app', PORT = 28000 + Math.floor(Math.random() * 1000), DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-dev-'));
const API = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0, srv = null; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const startSrv = () => new Promise(r => { srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: '135790' }, stdio: ['ignore', 'pipe', 'inherit'] }); srv.stdout.on('data', d => { if (/已启动/.test(String(d))) r(); }); });
// 重启 App 后，按新进程号找它的 WebView（旧进程的 WebView 记录可能还在）
const attach = async (d) => {
  await d.shell(`am force-stop ${PKG}`); await d.shell(`am start -n ${PKG}/.MainActivity`);
  let pid = ''; for (let i = 0; i < 40 && !pid; i++) { await new Promise(r => setTimeout(r, 250)); pid = String(await d.shell(`pidof ${PKG}`)).trim(); }
  for (let i = 0; i < 80; i++) { const w = d.webViews().find(x => x.pkg() === PKG && String(x.pid()) === pid); if (w) { const pg = await w.page(); await pg.waitForFunction(() => window.__tm, null, { timeout: 15000 }); return pg; } await new Promise(r => setTimeout(r, 250)); }
  throw new Error('找不到 App 的 WebView');
};
const api = async (method, p, body, token) => (await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
(async () => {
  await startSrv();
  const [d] = await _android.devices(); if (!d) throw new Error('没有找到安卓设备');
  console.log('设备：' + d.model());
  adb(`reverse tcp:${PORT} tcp:${PORT}`); // 手机上的 localhost:PORT 就是这台 Mac
  adb('logcat -c -b crash');
  let p = await attach(d);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // 页面用了 CSS zoom，旧版安卓 WebView 上 Playwright 算出的点击坐标会偏：直接触发元素的点击
  const tap = (sel) => p.evaluate((x) => document.querySelector(x).click(), sel);
  const hideKb = async () => { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(600); };
  await p.evaluate(async () => { await TMN.plugins.Preferences.clear(); localStorage.clear(); });
  await p.reload(); await p.waitForTimeout(1500);
  // 1. 欢迎页 → 连接团队服务器 → 建团队
  await tap('[data-do=srvConnect]'); await p.waitForTimeout(400); await p.fill('.sheet input[name=server]', 'http://localhost:' + PORT); await tap('.sheet footer button[type=submit]');
  await p.waitForSelector('form[data-form=srvSetup]', { timeout: 15000 });
  ok(true, '连上服务器，显示创建团队');
  await p.fill('form[data-form=srvSetup] input[name=code]', '135790'); await p.fill('form[data-form=srvSetup] input[name=name]', '王老板');
  await p.fill('form[data-form=srvSetup] input[name=login]', 'boss'); await p.fill('form[data-form=srvSetup] input[name=password]', 'boss123456');
  await tap('form[data-form=srvSetup] button[type=submit]');
  await p.waitForSelector('.hm-card', { timeout: 15000 }); await p.waitForTimeout(800);
  if (await p.locator('#layer .sheet').count()) { await tap('#layer .sheet footer button[type=button]'); await p.waitForTimeout(300); } // 「三步开始」引导：以后再说
  ok(await p.evaluate(() => TMS.loggedIn() && window.__tm.S.users[0].name === '王老板'), '建好团队并以老板身份登录');
  const tok = (await api('POST', '/api/login', { login: 'boss', password: 'boss123456' })).token;
  // 2. 记一个想法（文字），服务器收到
  await p.evaluate(() => { location.hash = '#/new/text'; }); await p.waitForTimeout(500);
  await p.fill('[data-cap="tx.title"]', '安卓测试想法'); await p.fill('[data-cap="tx.note"]', '安卓真机测试：下周开同工会'); await hideKb();
  await tap('[data-do=capNext][data-k=tx]'); await p.waitForSelector('.sheet.on'); await tap('.sheet footer button[type=button]'); await p.waitForTimeout(2500);
  let st = await api('GET', '/api/state', null, tok);
  ok(st.state.ideas.some(x => x.title === '安卓测试想法'), '服务器收到手机上记的想法');
  ok((await p.evaluate(() => location.hash)).startsWith('#/idea/'), '保存后到想法详情');
  // 3. 手机返回键：回到开始记录前的页面（首页）
  adb('shell input keyevent 4'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => location.hash) === '#/home', '手机返回键回到首页：' + await p.evaluate(() => location.hash));
  // 4. 服务器上的改动实时出现在手机上
  await api('POST', '/api/act', { name: 'idea.create', payload: { note: '来自电脑的想法' } }, tok);
  let seen = false; for (let i = 0; i < 20 && !seen; i++) { await p.waitForTimeout(500); seen = await p.evaluate(() => window.__tm.S.ideas.some(x => x.note === '来自电脑的想法')); }
  ok(seen, '服务器上的改动实时同步到手机');
  // 5. 服务器断开：先存手机，恢复后自动补发
  srv.kill(); await new Promise(r => srv.on('exit', r)); await p.waitForTimeout(1000);
  await p.evaluate(() => { location.hash = '#/new/text'; }); await p.waitForTimeout(500);
  await p.fill('[data-cap="tx.title"]', '离线想法'); await p.fill('[data-cap="tx.note"]', '断网时记的想法'); await hideKb();
  await tap('[data-do=capNext][data-k=tx]'); await p.waitForSelector('.sheet.on'); await tap('.sheet footer button[type=button]'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => TMS.outbox.length > 0 && window.__tm.S.ideas.some(x => x.title === '离线想法')), '断开时：想法先存在手机上，等待同步');
  await startSrv();
  let synced = false; for (let i = 0; i < 40 && !synced; i++) { await p.waitForTimeout(1000); st = await api('GET', '/api/state', null, tok).catch(() => ({ state: { ideas: [] } })); synced = st.state.ideas.some(x => x.title === '离线想法'); }
  ok(synced, '服务器恢复后自动补发');
  ok(await p.evaluate(() => TMS.outbox.length === 0), '待同步清空');
  // 6. 重新打开 App：仍是登录状态，数据还在
  p = await attach(d); p.on('pageerror', e => errs.push(e.message)); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => TMS.loggedIn() && window.__tm.S.ideas.some(x => x.title === '离线想法')), '重开 App 仍登录、数据还在');
  // 7. 退出登录
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForTimeout(500);
  await tap('[data-do=srvLogout]'); await p.waitForTimeout(400); await tap('.sheet footer button[type=submit]');
  await p.waitForSelector('form[data-form=srvLogin]', { timeout: 15000 }).catch(() => {});
  // 退出时会重新加载页面（先等原生备份写完），要重新连上页面
  await p.waitForTimeout(3000);
  ok(await p.evaluate(() => !TMS.loggedIn() && !!document.querySelector('form[data-form=srvLogin]')), '退出登录回到登录页');
  ok(!adb('logcat -d -b crash').trim(), '没有崩溃日志');
  ok(errs.length === 0, '无报错 ' + errs.join(' | '));
  console.log(`安卓使用流程 通过 ${pass}，失败 ${fail}`);
  adb(`reverse --remove tcp:${PORT}`); srv.kill(); await d.close(); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
