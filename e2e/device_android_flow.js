// 安卓真机环境的完整使用流程（连团队服务器）：在模拟器或 USB 真机上的调试版 App 里
//   连接服务器 → 用初始化码建团队 → 记一个想法 → 服务器收到 → 服务器上别人的改动实时出现在手机上
//   → 服务器断开时记的想法先存手机、恢复后自动补发 → 手机返回键 → 退出登录
// 用法：node e2e/device_android_flow.js
const { execSync, spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const { _android } = require('playwright');
const { restartApp, currentPage } = require('./_android');
const ADB = path.join(process.env.ANDROID_HOME || path.join(process.env.HOME, 'Library/Android/sdk'), 'platform-tools/adb');
const adb = (c) => { try { return execSync(`"${ADB}" ${c}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return ''; } };
const PKG = 'com.teamops.app', PORT = 28000 + Math.floor(Math.random() * 1000), DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-dev-'));
const API = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0, srv = null; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const startSrv = () => new Promise(r => { srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, LLM: '0', PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: '135790' }, stdio: ['ignore', 'pipe', 'inherit'] }); srv.stdout.on('data', d => { if (/已启动/.test(String(d))) r(); }); });
const api = async (method, p, body, token) => (await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
(async () => {
  await startSrv();
  const [d] = await _android.devices(); if (!d) throw new Error('没有找到安卓设备');
  console.log('设备：' + d.model());
  adb(`reverse tcp:${PORT} tcp:${PORT}`); // 手机上的 localhost:PORT 就是这台 Mac
  adb('logcat -c -b crash');
  adb(`shell pm grant ${PKG} android.permission.RECORD_AUDIO`); // 全新安装时录音会弹系统权限框，挡住后面的步骤
  let p = await restartApp(d);
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
  // 建好团队后页面会刷新：重新拿当前页面
  p = await currentPage(d, () => !!document.querySelector('.hm-card'), 20000); p.on('pageerror', e => errs.push(e.message)); await p.waitForTimeout(800);
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
  // 2b. 手机转不了文字时，录音交给服务器转（服务器装了 whisper 才测；模拟器麦克风是静音，所以结果是「没有识别到说话」或一段文字，只要流程走通）
  const trOn = await p.evaluate(() => TMS.aiStatus().then(r => !!r.transcribe));
  if (trOn) {
    await p.evaluate(() => { location.hash = '#/new/voice'; }); await p.waitForTimeout(800);
    const sr = await p.evaluate(() => !!window.SpeechRecognition);
    if (!sr) {
      await tap('.vr-c[data-do=voStart]'); await p.waitForTimeout(3000); await tap('.vr-c[data-do=voStop]');
      let res = ''; for (let i = 0; i < 40 && !res; i++) { await p.waitForTimeout(500); res = await p.evaluate(() => { const t = document.getElementById('toast'); const v = document.querySelector('[data-cap="vo.text"]'); return v && v.value ? 'text:' + v.value : (t.className.includes('on') && /识别到说话|转文字失败|连不上/.test(t.textContent) ? 'toast:' + t.textContent : ''); }); }
      ok(/^text:|没有识别到说话/.test(res), '这台手机没有语音识别：录音交给服务器转写，流程走通 ' + res);
      await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(500);
    } else { console.log('（这台设备有语音识别服务，跳过服务器转写这一步）'); await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(500); }
  } else console.log('（服务器没装语音转写，跳过）');
  // 3. 手机返回键：回到开始记录前的页面（首页）
  adb('shell input keyevent 4'); await p.waitForTimeout(1500); // 真机开着页面切换动画，多等一会
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
  p = await restartApp(d); p.on('pageerror', e => errs.push(e.message)); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => TMS.loggedIn() && window.__tm.S.ideas.some(x => x.title === '离线想法')), '重开 App 仍登录、数据还在');
  // 7. 退出登录
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForTimeout(500);
  await tap('[data-do=srvLogout]'); await p.waitForTimeout(400); await tap('.sheet footer button[type=submit]');
  // 退出时会重新加载页面（先等原生备份写完）：重新拿当前页面
  p = await currentPage(d, () => !!document.querySelector('form[data-form=srvLogin]'), 20000);
  ok(await p.evaluate(() => !TMS.loggedIn() && !!document.querySelector('form[data-form=srvLogin]')), '退出登录回到登录页');
  ok(!adb('logcat -d -b crash').trim(), '没有崩溃日志');
  ok(errs.length === 0, '无报错 ' + errs.join(' | '));
  console.log(`安卓使用流程 通过 ${pass}，失败 ${fail}`);
  adb(`reverse --remove tcp:${PORT}`); srv.kill(); await d.close(); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
