// iOS 模拟器里的完整使用流程（连团队服务器，真实的 WKWebView）：
//   预设服务器 + 自动登录（调试版 TM_SERVER / TM_AUTOLOGIN）→ 在 App 里记一个想法 → 服务器收到
//   → 服务器上别人的改动实时出现在 App 里 → 重开 App 仍登录、数据还在
// 用法：node e2e/device_ios_flow.js   （需要 Xcode；会重新编译调试版）
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), { execSync, spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), sh = (c, cwd) => execSync(c, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'] });
const PORT = 29000 + Math.floor(Math.random() * 900), API = 'http://127.0.0.1:' + PORT, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-ios-'));
let pass = 0, fail = 0, srv = null; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const api = async (method, p, body, token) => (await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// App 里运行的脚本：每次页面加载都会被注入一次，所以按「已经做到哪一步」继续
const FLOW = `(async function () {
  var base = document.currentScript.src.replace(/\\/[^/]*$/, ''), post = function (p, o) { return fetch(base + p, { method: 'POST', body: JSON.stringify(o) }).catch(function () {}); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  for (var i = 0; i < 100 && !(window.TMS && TMS.loggedIn() && window.__tm && window.__tm.me && !window.__tm.S.loading); i++) await sleep(200);
  post('/state', { loggedIn: !!(window.TMS && TMS.loggedIn()), me: window.__tm && window.__tm.me, ideas: window.__tm ? window.__tm.S.ideas.map(function (d) { return d.title || d.note; }) : [], outbox: window.TMS ? TMS.outbox.length : -1, status: window.TMS && TMS.status });
  if (sessionStorage.getItem('flow_done')) return;
  sessionStorage.setItem('flow_done', '1');
  location.hash = '#/new/text'; await sleep(800);
  var set = function (sel, v) { var e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
  set('[data-cap="tx.title"]', 'iOS 测试想法'); set('[data-cap="tx.note"]', '在 iOS 模拟器里记的');
  document.querySelector('[data-do=capNext][data-k=tx]').click(); await sleep(600);
  document.querySelector('.sheet footer button[type=button]').click(); await sleep(2500);
  post('/created', { hash: location.hash, outbox: TMS.outbox.length });
  for (var k = 0; k < 40; k++) { await sleep(500); if (window.__tm.S.ideas.some(function (d) { return d.note === '来自电脑的想法'; })) { post('/live', { ok: true }); return; } }
  post('/live', { ok: false });
})();`;
const got = {}; const col = http.createServer((q, s) => {
  s.setHeader('Access-Control-Allow-Origin', '*');
  if (q.method === 'GET') { s.setHeader('Content-Type', 'text/javascript'); return s.end(FLOW); }
  let b = ''; q.on('data', c => b += c); q.on('end', () => { try { (got[q.url] = got[q.url] || []).push(JSON.parse(b)); } catch (e) {} s.end('ok'); });
});
const waitFor = async (k, n, ms) => { for (let t = 0; t < ms; t += 250) { if ((got[k] || []).length >= (n || 1)) return got[k][(n || 1) - 1]; await sleep(250); } return null; };
col.listen(0, '127.0.0.1', async () => {
  try {
    const cport = col.address().port;
    srv = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: 'c' }, stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise(r => srv.stdout.on('data', d => { if (/已启动/.test(String(d))) r(); }));
    const tok = (await api('POST', '/api/setup', { name: '王老板', login: 'boss', password: 'boss123456', code: 'c' })).token;
    const devs = Object.values(JSON.parse(sh('xcrun simctl list devices available -j')).devices).flat();
    const dev = devs.find(d => d.name === (process.env.SIM || 'iPhone 18 Pro')) || devs.find(d => /iPhone/.test(d.name));
    console.log('编译 iOS 调试版（' + dev.name + '）…');
    sh('node build.js', ROOT); sh('npx cap copy ios', ROOT);
    sh(`xcodebuild -project App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=${dev.udid}' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet`, path.join(ROOT, 'ios', 'App'));
    try { sh(`xcrun simctl boot ${dev.udid}`); } catch (e) {}
    sh(`xcrun simctl bootstatus ${dev.udid} -b`);
    try { sh(`xcrun simctl uninstall ${dev.udid} com.teamops.app`); } catch (e) {}
    sh(`xcrun simctl install ${dev.udid} "${path.join(ROOT, 'ios/App/build/Build/Products/Debug-iphonesimulator/App.app')}"`);
    const launch = () => sh(`SIMCTL_CHILD_TM_SERVER=${API} SIMCTL_CHILD_TM_AUTOLOGIN=boss:boss123456 SIMCTL_CHILD_TM_SCRIPT=http://127.0.0.1:${cport}/flow.js xcrun simctl launch --terminate-running-process ${dev.udid} com.teamops.app`);
    launch();
    // 自动登录后页面会重新加载：取「已登录」的那次状态
    let st = null; for (let n = 1; n <= 4 && !(st && st.loggedIn); n++) st = await waitFor('/state', n, 30000);
    ok(st && st.loggedIn && st.me, 'iOS App 连上服务器并登录 ' + JSON.stringify(st));
    const cr = await waitFor('/created', 1, 30000);
    ok(cr && cr.hash.startsWith('#/idea/'), '在 App 里记想法，到想法详情 ' + JSON.stringify(cr));
    let seen = false; for (let i = 0; i < 20 && !seen; i++) { await sleep(500); seen = (await api('GET', '/api/state', null, tok)).state.ideas.some(x => x.title === 'iOS 测试想法'); }
    ok(seen, '服务器收到 iOS App 记的想法');
    await api('POST', '/api/act', { name: 'idea.create', payload: { note: '来自电脑的想法' } }, tok);
    const live = await waitFor('/live', 1, 30000);
    ok(live && live.ok, '服务器上的改动实时同步到 iOS App');
    // 重开 App：仍登录、数据还在（flow_done 在 sessionStorage，重开后会重新跑一遍记想法，这里只看第一次上报的状态）
    const n0 = (got['/state'] || []).length;
    sh(`xcrun simctl terminate ${dev.udid} com.teamops.app`); await sleep(1000);
    sh(`SIMCTL_CHILD_TM_SCRIPT=http://127.0.0.1:${cport}/flow.js xcrun simctl launch ${dev.udid} com.teamops.app`);
    const st2 = await waitFor('/state', n0 + 1, 40000);
    ok(st2 && st2.loggedIn && st2.ideas.includes('iOS 测试想法') && st2.ideas.includes('来自电脑的想法'), '重开 App 仍登录、数据还在 ' + JSON.stringify(st2 && { loggedIn: st2.loggedIn, n: st2.ideas.length }));
    sh(`xcrun simctl terminate ${dev.udid} com.teamops.app`);
  } catch (e) { fail++; console.log('✗ ' + e.message); }
  console.log(`iOS 使用流程 通过 ${pass}，失败 ${fail}`);
  if (srv) srv.kill(); col.close(); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
});
