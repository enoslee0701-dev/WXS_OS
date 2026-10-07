// 闭环实测 第 1 段：老板建团队、加成员、上传视频提交 → 真实 whisper 转写 → 真实本机模型整理
const R = require('path').join(__dirname, '..', '..') + '/';
const { chromium, devices } = require(R + 'node_modules/playwright');
const fs = require('fs'), L = __dirname, SRV = process.env.SRV || 'http://127.0.0.1:24871';
const log = (...a) => { const s = '[' + new Date().toTimeString().slice(0, 8) + '] ' + a.join(' '); console.log(s); fs.appendFileSync(L + '/run.log', s + '\n'); };
const api = async (m, u, b, t) => (await fetch(SRV + u, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(SRV + '/'); await p.waitForSelector('form[data-form=srvSetup]');
  await p.fill('input[name=code]', 'c'); await p.fill('input[name=name]', '王总'); await p.fill('input[name=title]', '总经理'); await p.fill('input[name=login]', 'boss'); await p.fill('input[name=password]', 'Boss2026x');
  await p.click('form[data-form=srvSetup] button[type=submit]'); await p.waitForSelector('.hm-card'); log('老板创建团队，进入首页');
  await p.waitForTimeout(800); if (await p.locator('#layer .sheet').count()) await p.click('#layer .sheet footer button[type=submit]');
  const tok = await p.evaluate(() => localStorage.getItem('tm_token'));
  const team = [['李娜', 'operator', '行政运营', 'lina'], ['张伟', 'executor', '行政运营', 'zhangwei'], ['王芳', 'executor', '设计创意', 'wangfang'], ['刘强', 'executor', '行政运营', 'liuqiang']];
  const accts = {};
  for (const [name, role, group, login] of team) {
    const r = await api('POST', '/api/act', { name: 'member.add', payload: { name, role, group, title: role === 'operator' ? '运营' : '专员' } }, tok);
    const st = (await api('GET', '/api/state', null, tok)).state; const u = st.users.find(x => x.name === name);
    const a = await api('POST', '/api/accounts', { uid: u.id, login }, tok); accts[name] = { uid: u.id, login, pw: a.password };
    log('加成员', name, role, group, r.ok === false ? '失败 ' + r.error : 'OK', '账号', login, '初始密码', a.password);
  }
  fs.writeFileSync(L + '/accts.json', JSON.stringify({ boss: { login: 'boss', pw: 'Boss2026x', tok }, ...accts }, null, 1));
  // 上传视频
  await p.goto(SRV + '/#/new/video'); await p.waitForTimeout(500);
  await p.setInputFiles('.cx-drop input[data-camfile]', L + '/boss.mp4'); await p.waitForTimeout(1500);
  await p.fill('[data-cap="cam.title"]', '年终客户答谢会');
  await p.evaluate(() => document.querySelector('[data-do=capNext]').click()); await p.waitForSelector('#layer .sheet'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#layer .sheet footer button[type=submit]').click()); await p.waitForTimeout(800);
  log('老板提交视频想法，提示：', await p.textContent('#toast'), '页面：', p.url().replace(SRV, ''));
  const t0 = Date.now(); let lastS = '';
  for (let i = 0; i < 600; i++) {
    const st = (await api('GET', '/api/state', null, tok)).state, d = st.ideas[0];
    const m = (d.media || [])[0] || {}, sm = st.summaries.filter(x => x.ideaId === d.id && x.kind === 'analysis').pop();
    const s = `状态=${d.status} 转写=${m.transcriptStatus || '-'} AI=${d.aiStatus} 整理稿=${sm ? (sm.payload.simulated ? '规则版' : '真实AI:' + sm.model) : '无'}`;
    if (s !== lastS) { log(((Date.now() - t0) / 1000).toFixed(0) + 's', s); lastS = s; }
    if (sm && !sm.payload.simulated && m.transcriptStatus === 'done') { fs.writeFileSync(L + '/idea1.json', JSON.stringify({ idea: d, summary: sm }, null, 1)); break; }
    await new Promise(r => setTimeout(r, 2000));
  }
  await p.reload(); await p.waitForTimeout(1500); await p.screenshot({ path: L + '/p1_idea.png', fullPage: true });
  log('页面报错：', errs.length ? errs.join(' | ') : '无');
  await b.close();
})().catch(e => { log('出错', e.stack); process.exit(1); });
