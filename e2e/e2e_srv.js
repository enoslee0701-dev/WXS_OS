// 服务器模式端到端：真实服务器 + 两个浏览器（老板、员工）
// 创建团队 → 添加成员并分派账号 → 员工登录并修改初始密码 → 角色化界面 → 数据隔离 → 实时同步 → 离线补发 → 退出
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (process.env.V) console.log(c ? '✓' : '✗', m); if (c) pass++; else { fail++; if (!process.env.V) console.log('✗', m); } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-e2e-')), PORT = 20000 + Math.floor(Math.random() * 2000), URL = 'http://127.0.0.1:' + PORT + '/';
const api = async (method, u, body, tok) => (await fetch(URL.slice(0, -1) + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
const until = async (fn, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise(z => setTimeout(z, 100)); } return false; };
let srv = null;
(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: '246810' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => { if (/已启动/.test(String(d))) r(); }));
  const b = await chromium.launch();
  const mk = async () => { const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::/.test(m.text())) p.errs.push(m.text()); }); return p; };
  const toast = async (p) => p.textContent('#toast');

  // ---- 老板：创建团队
  const A = await mk(); await A.goto(URL); await A.waitForSelector('form[data-form=srvSetup]');
  ok(await A.locator('input[name=server]').count() === 0, '同源网页版不用填服务器地址');
  ok(await A.locator('.demo').count() === 0, '服务器模式没有演示横幅');
  await A.fill('input[name=code]', '246810'); await A.fill('input[name=name]', '王老板'); await A.fill('input[name=title]', '创始人'); await A.fill('input[name=login]', 'boss'); await A.fill('input[name=password]', 'boss123');
  await A.click('form[data-form=srvSetup] button[type=submit]'); await A.waitForSelector('.hm-card');
  ok(JSON.stringify(await A.$$eval('.hm-card', xs => xs.map(x => x.dataset.do))) === '["quickIdea","quickProject"]', '老板进入首页');
  ok(await A.locator('.hm-demo').count() === 0, '首页没有演示版标记');
  await A.goto(URL + '#/me'); await A.waitForTimeout(120); ok(await A.locator('[data-do=srvDeactivate]').count() === 0, '老板没有注销入口'); await A.goto(URL + '#/home'); await A.waitForTimeout(100);
  const bossTok = await A.evaluate(() => localStorage.getItem('tm_token'));
  ok((await api('GET', '/api/state', null, bossTok)).state.users.length === 1, '新团队只有老板');

  // ---- 正式模式下界面不出现「演示」字样
  const demoWords = [];
  for (const r of ['home', 'ideas', 'tasks', 'work', 'me', 'settings', 'team', 'kb', 'new', 'new/voice', 'new/video', 'new/text', 'new/file', 'project', 'todo/new', 'inbox']) {
    await A.goto(URL + '#/' + r); await A.waitForTimeout(120);
    const t = await A.evaluate(() => document.body.innerText); if (/演示/.test(t)) demoWords.push(r + '：' + t.match(/.{0,12}演示.{0,16}/)[0]);
  }
  await A.goto(URL + '#/me'); await A.waitForTimeout(100); await A.click('.me-info[data-do=quickAI]'); await A.waitForSelector('.ai-panel');
  if (/演示/.test(await A.evaluate(() => document.body.innerText))) demoWords.push('AI 面板');
  await A.evaluate(() => document.querySelectorAll('.ai-scrim').forEach(x => x.click())); await A.waitForTimeout(150);
  ok(demoWords.length === 0, '正式模式不出现「演示」字样 ' + demoWords.join(' | '));

  // ---- 老板：添加成员 → 自动弹出分派账号
  await A.goto(URL + '#/team'); await A.waitForTimeout(150);
  await A.click('.tm-invite'); await A.fill('.sheet input[name=name]', '小李'); await A.fill('.sheet input[name=title]', '设计');
  await A.click('.sheet footer button[type=submit]');
  await A.waitForSelector('.sheet h2:has-text("分派登录账号")');
  ok(true, '添加成员后弹出分派账号');
  await A.fill('.sheet input[name=login]', 'xiaoli'); await A.click('.sheet footer button[type=submit]');
  await A.waitForSelector('.sheet .cred');
  const pw = (await A.textContent('#cred-p')).trim();
  ok(/^[a-z2-9]{4}-[a-z2-9]{4}$/.test(pw) && (await A.textContent('.cred')).includes(URL.slice(0, -1)), '显示账号、初始密码和服务器地址');
  await A.click('.sheet footer button[type=submit]'); await A.waitForTimeout(150);
  ok(await until(async () => (await api('GET', '/api/state', null, bossTok)).state.users.length === 2), '成员已同步到服务器');
  // 老板设置开关（真实界面操作）→ 同步到服务器
  await A.goto(URL + '#/settings'); await A.waitForTimeout(100);
  await A.fill('[data-set=staleDays]', '5'); await A.dispatchEvent('[data-set=staleDays]', 'change');
  ok(await until(async () => (await api('GET', '/api/state', null, bossTok)).state.settings.staleDays === 5), '界面上的设置改动同步到服务器');
  // 老板的私人草稿
  const dr = await api('POST', '/api/act', { name: 'idea.create', payload: { note: '老板的私人草稿：明年扩张计划' } }, bossTok);
  ok(dr.ok, '老板记了一条草稿');

  // ---- 员工：登录、首次改密
  const B = await mk(); await B.goto(URL); await B.waitForSelector('form[data-form=srvLogin]');
  await B.fill('input[name=login]', 'xiaoli'); await B.fill('input[name=password]', 'wrong-pw'); await B.click('form[data-form=srvLogin] button[type=submit]');
  ok(await until(async () => (await toast(B)).includes('账号或密码不对')), '密码错误有提示');
  await B.fill('input[name=password]', pw); await B.click('form[data-form=srvLogin] button[type=submit]');
  await B.waitForSelector('.sheet h2:has-text("请先修改初始密码")', { timeout: 5000 });
  ok(true, '首次登录要求修改初始密码');
  await B.fill('.sheet input[name=password]', 'li123456'); await B.fill('.sheet input[name=again]', 'li123456'); await B.click('.sheet footer button[type=submit]');
  ok(await until(async () => (await toast(B)).includes('密码已修改')), '修改密码成功');
  ok(JSON.stringify(await B.$$eval('.hm-card', xs => xs.map(x => x.dataset.do))) === '["hmTasks","hmTodo"]', '员工首页是执行者卡片');
  ok(!(await B.evaluate(() => JSON.stringify(window.__tm.S))).includes('明年扩张计划'), '员工拿不到老板的草稿');
  await B.goto(URL + '#/me'); await B.waitForTimeout(150);
  ok(await B.locator('.me-acct').count() === 1 && await B.locator('[data-do=demoStart]').count() === 0, '我的：账号与安全，没有演示向导');
  ok(await B.locator('[data-do=srvDeactivate]').count() === 1, '成员能在 App 里注销账号');

  // ---- 实时同步：老板改了员工的资料，员工不用刷新就能看到
  await B.goto(URL + '#/team'); await B.waitForTimeout(150);
  const li = (await api('GET', '/api/state', null, bossTok)).state.users.find(u => u.name === '小李').id;
  await api('POST', '/api/act', { name: 'member.update', payload: { id: li, motto: '实时同步测试' } }, bossTok);
  ok(await until(async () => (await B.textContent('#app')).includes('实时同步测试')), '员工页面实时收到更新');

  // ---- 附件：老板在项目里上传图片 → 员工在另一台设备打开（从服务器读取）
  const wangR = await api('POST', '/api/act', { name: 'member.add', payload: { name: '小王', title: '运营', role: 'operator', group: '行政运营' } }, bossTok);
  const wang = wangR.state.users.find(u => u.name === '小王').id;
  const pj = await api('POST', '/api/act', { name: 'project.create', payload: { title: '新官网', ptype: 'tech', operatorId: wang, goal: '上线', tasks: [{ title: '画首页', ownerId: li, expected: '设计稿', criteria: '老板认可' }] } }, bossTok);
  ok(pj.ok && pj.r.workId, '建了一个有小李任务的项目 ' + (pj.error || ''));
  const wid = pj.r.workId;
  await A.goto(URL + '#/work/' + wid); await A.waitForTimeout(300);
  await A.click('[data-do=wTab][data-t=files]'); await A.waitForTimeout(150);
  await A.click('.wf-up'); await A.waitForSelector('.sheet.on');
  await A.setInputFiles('.sheet input[data-wfile]:not([accept]):not([capture])', path.join(__dirname, 'fixtures', 'pic.jpg')); await A.waitForTimeout(300);
  const lid = await A.evaluate((w) => { const x = window.__tm.S.workItems.find(v => v.id === w); return x && (x.files || []).map(f => f.localId).filter(Boolean).pop(); }, wid);
  ok(!!lid, '附件记录带文件 ID');
  ok(await until(async () => (await fetch(URL + 'api/files/' + lid, { headers: { Authorization: 'Bearer ' + bossTok } })).status === 200, 8000), '附件已上传到服务器');
  ok(await until(async () => (await B.evaluate(() => TMS.uploading || 0)) === 0 && (await A.evaluate(() => TMS.uploading || 0)) === 0), '上传队列清空');
  await B.goto(URL + '#/work/' + wid); await B.waitForTimeout(400);
  const t0 = Date.now(); const seen = await until(async () => (await B.evaluate((w) => !!window.__tm.S.workItems.find(v => v.id === w), wid)), 15000);
  ok(seen && Date.now() - t0 < 4000, '员工能看到这个项目（实时）');
  await B.click('[data-do=wTab][data-t=files]'); await B.waitForTimeout(150);
  await B.click('[data-do=wfOpen]'); await B.waitForSelector('.sheet img');
  ok(await until(async () => B.evaluate(() => { const i = document.querySelector('.sheet img'); return i && i.complete && i.naturalWidth > 0 && /\/api\/files\//.test(i.src); })), '员工在另一台设备打开了老板上传的图片');
  await B.evaluate(() => document.querySelectorAll('.scrim.on').forEach(x => x.click()));

  // ---- 离线：员工记待办，联网后自动补发
  await B.context().setOffline(true);
  await B.goto(URL + '#/todo/new/manual').catch(() => {}); await B.waitForTimeout(200);
  await B.evaluate(() => { location.hash = '#/todo/new/manual'; }); await B.waitForTimeout(200);
  await B.fill('[data-tf=title]', '离线时记下的待办'); await B.click('[data-do=tfSave]'); await B.waitForTimeout(300);
  ok(await until(async () => (await B.evaluate(() => TMS.outbox.length)) === 1), '断网时操作进发件箱');
  ok(await until(async () => /离线/.test(await B.textContent('#sync-pill').catch(() => ''))), '显示离线提示');
  // 断网期间老板也新建了待办（会和员工本地生成的序号撞上）
  await api('POST', '/api/act', { name: 'todo.create', payload: { title: '老板同时记的待办', date: '2026-10-03' } }, bossTok);
  await B.context().setOffline(false); await B.evaluate(() => window.dispatchEvent(new Event('online')));
  ok(await until(async () => (await B.evaluate(() => TMS.outbox.length)) === 0, 8000), '联网后发件箱清空');
  const full = (await api('GET', '/api/state', null, bossTok)).state;
  const liTok = await B.evaluate(() => localStorage.getItem('tm_token'));
  const mine = (await api('GET', '/api/state', null, liTok)).state.todos;
  ok(mine.some(t => t.title === '离线时记下的待办') && !mine.some(t => t.title === '老板同时记的待办'), '员工的待办到了服务器，看不到老板的待办');
  ok(full.todos.some(t => t.title === '老板同时记的待办'), '老板的待办也在');
  ok(new Set(full.todos.map(t => t.id)).size === full.todos.length, '序号冲突后 ID 仍唯一');
  ok(await until(async () => (await B.evaluate(() => window.__tm.S.todos.map(t => t.title).join())).includes('离线时记下的待办')), '员工本地数据与服务器一致');

  // ---- 退出登录
  await B.goto(URL + '#/me'); await B.waitForTimeout(100); await B.click('[data-do=srvLogout]'); await B.click('.sheet footer button[type=submit]');
  await B.waitForSelector('form[data-form=srvLogin]');
  ok(await B.evaluate(() => !localStorage.getItem('tm_token') && !localStorage.getItem('tm_demo_v3')), '退出后本机不留数据和令牌');
  ok((await api('GET', '/api/state', null, liTok)).error, '退出后旧令牌失效');
  // ---- 老板停用员工账号
  await A.goto(URL + '#/team'); await A.waitForTimeout(150);
  await A.locator('.tm-card', { hasText: '小李' }).locator('[data-do=tmMember]').click(); await A.click('.sheet [data-do=srvAccount]');
  await A.waitForSelector('.sheet [data-do=srvDisable]'); ok((await A.textContent('.sheet .callout')).includes('xiaoli'), '账号页显示当前账号');
  await A.click('.sheet [data-do=srvDisable]'); ok(await until(async () => (await toast(A)).includes('已停用')), '老板停用账号');
  await B.fill('input[name=login]', 'xiaoli'); await B.fill('input[name=password]', 'li123456'); await B.click('form[data-form=srvLogin] button[type=submit]');
  ok(await until(async () => (await toast(B)).includes('已停用')), '停用后不能登录');
  await A.screenshot({ path: 'srv-boss.png' });
  ok(A.errs.length === 0 && B.errs.length === 0, '无报错 ' + A.errs.concat(B.errs).join('|'));
  console.log(`服务器模式 E2E 通过 ${pass}，失败 ${fail}`);
  await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
