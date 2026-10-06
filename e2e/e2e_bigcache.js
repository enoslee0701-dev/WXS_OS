// 团队数据超过 localStorage 容量（约 5MB）时：完整缓存改存 IndexedDB，启动不会退回演示数据，断网也能看
// 测试里把 localStorage 的容量人为调小来模拟
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-big-')), PORT = 27000 + Math.floor(Math.random() * 2000), URL = 'http://127.0.0.1:' + PORT + '/';
let srv = null;
(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: 'c' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => { if (/已启动/.test(String(d))) r(); }));
  await (await fetch(URL + 'api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '王老板', login: 'enos', password: 'enos1234', demo: true, code: 'c' }) })).json();
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  // 模拟容量很小的 localStorage：完整数据写不进去
  await c.addInitScript(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'tm_demo_v3' && String(v).length > 5000) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } return set.call(this, k, v); }; });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('form[data-form=srvLogin]');
  await p.fill('input[name=login]', 'enos'); await p.fill('input[name=password]', 'enos1234'); await p.click('form[data-form=srvLogin] button[type=submit]');
  await p.waitForSelector('.hm-card', { timeout: 10000 }); await p.waitForTimeout(1500); await p.waitForSelector('.hm-card');
  const st0 = await p.evaluate(() => ({ k: (localStorage.getItem('tm_demo_v3') || '').length, idb: localStorage.getItem('tm_cache_idb'), boot: (localStorage.getItem('tm_boot') || '').length, loading: !!window.__tm.S.loading }));
  ok(!st0.k && st0.idb === '1' && st0.boot > 0, '完整数据写不进 localStorage：改存 IndexedDB，另存启动骨架 ' + JSON.stringify(st0));
  ok(await p.evaluate(() => window.__tm.S.ideas.length > 0 && !window.__tm.S.loading && window.__tm.S.users.find(u => u.id === 'u_owner').name === '王老板'), '登录后看到团队数据');
  // 服务器连不上时重新打开（iOS App 的页面打包在 App 里，断网也能打开；这里断开服务器接口来模拟）：用 IndexedDB 缓存显示，不会出现演示数据
  await c.route('**/api/**', r => r.abort()); await p.reload(); await p.waitForTimeout(1500);
  const off = await p.evaluate(() => ({ me: window.__tm.me, ideas: window.__tm.S.ideas.length, loading: !!window.__tm.S.loading, owner: (window.__tm.S.users.find(u => u.id === 'u_owner') || {}).name }));
  ok(off.me === 'u_owner' && off.ideas > 0 && !off.loading && off.owner === '王老板', '断网重开：从 IndexedDB 缓存显示团队数据 ' + JSON.stringify(off));
  // 旧版本可能把启动骨架存成了完整缓存：读到时要当作没有缓存，改从 IndexedDB 读
  await p.evaluate(() => { localStorage.setItem('tm_demo_v3', JSON.stringify({ v: 3, loading: true, users: [], ideas: [], settings: {} })); });
  await p.reload(); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.__tm.S.ideas.length > 0 && (window.__tm.S.users.find(u => u.id === 'u_owner') || {}).name === '王老板'), '本地存的是启动骨架时，改从 IndexedDB 读完整数据');
  await c.unroute('**/api/**');
  // 退出登录：清掉 IndexedDB 缓存
  await p.goto(URL + '#/me'); await p.waitForTimeout(300); await p.click('[data-do=srvLogout]'); await p.click('.sheet footer button[type=submit]');
  await p.waitForSelector('form[data-form=srvLogin]'); await p.waitForTimeout(300);
  const left = await p.evaluate(() => new Promise(ok => { const r = indexedDB.open('tm_cache', 1); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => ok(!!g.result); g.onerror = () => ok('err'); }; r.onerror = () => ok('err'); }));
  ok(left === false && await p.evaluate(() => !localStorage.getItem('tm_boot') && !localStorage.getItem('tm_cache_idb')), '退出登录后清除大缓存和启动骨架');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`大数据缓存 E2E 通过 ${pass}，失败 ${fail}`);
  await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
