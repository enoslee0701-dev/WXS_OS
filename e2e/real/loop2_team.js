// 闭环实测 第 2 段：运营者认领派发 → 执行人接收、开始、提交成果 → 验收（退回一次）→ 项目完成 → 老板收到通知；会议录音拆任务
const R = require('path').join(__dirname, '..', '..') + '/';
const { chromium, devices } = require(R + 'node_modules/playwright');
const fs = require('fs'), L = __dirname, SRV = process.env.SRV || 'http://127.0.0.1:24871';
const log = (...a) => { const s = '[' + new Date().toTimeString().slice(0, 8) + '] ' + a.join(' '); console.log(s); fs.appendFileSync(L + '/run.log', s + '\n'); };
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; log(c ? '✓' : '✗', m); };
const api = async (m, u, b, t) => (await fetch(SRV + u, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
const AC = require(L + '/accts.json'), BT = AC.boss.tok;
const state = async () => (await api('GET', '/api/state', null, BT)).state;
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const open = async (who) => {
    const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); p.who = who;
    p.on('pageerror', e => errs.push(who + '：' + e.message));
    await p.goto(SRV + '/'); await p.waitForSelector('form[data-form=srvLogin]');
    const a = AC[who]; await p.fill('form[data-form=srvLogin] input[name=login]', a.login); await p.fill('form[data-form=srvLogin] input[name=password]', a.pw);
    await p.click('form[data-form=srvLogin] button[type=submit]'); await p.waitForSelector('.hm-card, .tabbar, nav', { timeout: 15000 }); await p.waitForTimeout(1500);
    // 第一次登录：强制修改初始密码
    const must = await p.locator('#layer .sheet h2:has-text("修改初始密码")').count();
    if (must) { await p.fill('#layer .sheet input[name=password]', 'Team2026pw'); await p.fill('#layer .sheet input[name=again]', 'Team2026pw'); await p.evaluate(() => document.querySelector('#layer .sheet footer button[type=submit]').click()); await p.waitForTimeout(1200); }
    ok(must > 0, who + ' 首次登录被要求修改初始密码' + (must ? '，已改' : ''));
    for (let i = 0; i < 3 && await p.locator('#layer .sheet').count(); i++) { await p.evaluate(() => { const x = document.querySelector('#layer .sheet footer button[type=submit]') || document.querySelector('#layer .sheet [data-do=closeSheet]'); x && x.click(); }); await p.waitForTimeout(400); } // 欢迎说明等
    p.tok = await p.evaluate(() => localStorage.getItem('tm_token'));
    return p;
  };
  const go = async (p, h) => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(700); };
  const clickDo = async (p, d, arg) => p.evaluate(([d, arg]) => { const x = [...document.querySelectorAll('[data-do="' + d + '"]')].find(e => !arg || e.dataset.arg === arg); if (!x) return false; x.click(); return true; }, [d, arg]);
  const clickText = async (p, t) => p.evaluate(t => { const x = [...document.querySelectorAll('button,a,[data-do]')].filter(e => e.offsetParent !== null || e.closest('#layer')).find(e => e.textContent.trim() === t || e.textContent.trim().startsWith(t)); if (!x) return null; x.click(); return x.dataset.do || x.tagName; }, t);
  const sheetSubmit = async (p) => { await p.evaluate(() => document.querySelector('#layer .sheet footer button[type=submit]').click()); await p.waitForTimeout(900); };
  const toast = async (p) => (await p.textContent('#toast')).trim();
  const unread = async (tok) => (await api('GET', '/api/state', null, tok)).state.notifications.filter(n => !n.read).map(n => n.title + '：' + n.body);

  let st = await state(); const idea = st.ideas.find(x => x.status === 'triage'); log('想法', idea.id, idea.title, '状态', idea.status);
  // ===== 运营者 李娜
  const op = await open('李娜');
  log('李娜 未读通知：', JSON.stringify(await unread(op.tok)));
  const home = await op.evaluate(() => document.body.innerText);
  ok(/认领|待整理|新想法/.test(home), '李娜首页看到有想法待认领：' + (home.match(/.{0,8}(认领|待整理).{0,12}/) || [''])[0]);
  await go(op, '#/idea/' + idea.id); await op.screenshot({ path: L + '/p2_op_idea.png', fullPage: true });
  const claimed = await clickText(op, '认领'); await op.waitForTimeout(800); log('点认领：', claimed, await toast(op));
  st = await state(); ok(st.ideas.find(x => x.id === idea.id).followerId === AC['李娜'].uid, '李娜成为跟进人');
  // 派发：AI 建议的任务一次派完
  await clickDo(op, 'route'); await op.waitForSelector('#layer .sheet'); await op.waitForTimeout(400);
  const rs = await op.evaluate(() => ({ kind: (document.querySelector('.sheet input[name=kind]:checked') || {}).value, n: document.querySelectorAll('.sheet [name$=title]').length, titles: [...document.querySelectorAll('.sheet input[name$=_title]')].map(x => x.value), btn: document.querySelector('.sheet footer button[type=submit]').textContent }));
  log('派发面板：类型=' + rs.kind, '任务=' + JSON.stringify(rs.titles), '按钮=' + rs.btn);
  ok(rs.kind === 'admin', '派发默认按行政类（AI 分类经规则校正）');
  ok(rs.titles.length >= 3, 'AI 建议的任务全部带进派发面板（' + rs.titles.length + ' 个）');
  await op.screenshot({ path: L + '/p2_route.png', fullPage: true });
  const who = [AC['张伟'].uid, AC['王芳'].uid, AC['刘强'].uid, AC['刘强'].uid, AC['张伟'].uid];
  await op.evaluate((who) => { ['t_', 't1_', 't2_', 't3_', 't4_'].forEach((k, i) => { const s = document.querySelector('.sheet select[name="' + k + 'ownerId"]'); if (s) s.value = who[i]; }); }, who);
  await sheetSubmit(op); log('派发：', await toast(op), op.url().replace(SRV, ''));
  st = await state(); const w = st.workItems.find(x => x.ideaId === idea.id);
  ok(w && st.tasks.filter(t => t.workId === w.id).length === rs.titles.length, '项目已建立，' + (w ? st.tasks.filter(t => t.workId === w.id).length : 0) + ' 个任务全部派出');
  const tasks = st.tasks.filter(t => t.workId === w.id); tasks.forEach(t => log('  任务', t.id, t.title, '→', st.users.find(u => u.id === t.ownerId).name, '截止', t.due, '验收人', st.users.find(u => u.id === t.reviewerId).name));
  log('老板 未读通知：', JSON.stringify(await unread(BT)));

  // ===== 会议录音拆任务（真实 whisper + 本机模型）
  await go(op, '#/work/' + w.id); await op.waitForTimeout(500);
  await op.evaluate(() => document.querySelector('.wx-tabs button[data-t=tasks]').click()); await op.waitForTimeout(500);
  const mOpened = await op.evaluate(() => { const x = document.querySelector('.wt-meet, [data-do=wMeeting]'); if (x) { x.click(); return x.textContent.trim(); } return false; }); log('打开会议拆任务：', mOpened);
  await op.waitForSelector('#layer .sheet [data-mtfile]', { timeout: 5000, state: 'attached' });
  const t0 = Date.now(); await op.setInputFiles('#layer .sheet [data-mtfile]', L + '/meet.m4a');
  await op.waitForFunction(() => { const t = document.getElementById('mt-text'); return t && t.value.length > 20; }, null, { timeout: 180000 });
  const mtext = await op.inputValue('#mt-text'); log('会议录音转写（' + ((Date.now() - t0) / 1000).toFixed(0) + 's）：', mtext);
  ok(/张伟|王芳|李娜|刘强/.test(mtext), '会议录音转成文字，面板还在');
  const t1 = Date.now(); await clickDo(op, 'mtGo');
  await op.waitForSelector('#layer .sheet .mt-list', { timeout: 180000 });
  const items = await op.evaluate(() => ({ src: document.querySelector('#layer .sheet .body p').textContent, xs: [...document.querySelectorAll('.mt-it')].map(e => ({ t: e.querySelector('[data-mt=title]').value, o: e.querySelector('[data-mt=ownerId]').selectedOptions[0].textContent, d: e.querySelector('[data-mt=due]').value })) }));
  log('拆任务（' + ((Date.now() - t1) / 1000).toFixed(0) + 's）', items.src); items.xs.forEach(x => log('  -', x.t, '|', x.o, '|', x.d));
  ok(items.xs.length >= 3 && items.xs.filter(x => x.o !== '选负责人').length >= 3, '会议拆出任务，负责人识别出来');
  await op.screenshot({ path: L + '/p2_meeting.png', fullPage: true });
  await op.evaluate(() => document.querySelectorAll('.mt-it [data-mt=ownerId]').forEach(s => { if (!s.value) s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); }));
  const picked = await op.evaluate(() => [...document.querySelectorAll('.mt-it')].filter(x => x.querySelector('[data-mt=on]').checked).length), warns = await op.evaluate(() => [...document.querySelectorAll('.mt-warn')].map(x => x.textContent));
  log('重复 / 时间提示：', JSON.stringify(warns));
  await sheetSubmit(op); log('会议任务派出：', await toast(op));
  st = await state(); const all = st.tasks.filter(t => t.workId === w.id); ok(all.length === tasks.length + picked, '会议任务加进同一个项目（勾选 ' + picked + ' 个，共 ' + all.length + ' 个）');

  // ===== 执行人：接收 → 开始 → 提交成果
  const people = {};
  for (const nm of ['张伟', '王芳', '刘强', '李娜']) {
    const p = nm === '李娜' ? op : await open(nm); people[nm] = p;
    const un = await unread(p.tok); log(nm, '未读通知', un.length, '条：', JSON.stringify(un.slice(0, 4)));
    await go(p, '#/tasks'); const tl = await p.evaluate(() => document.body.innerText);
    const mine = (await state()).tasks.filter(t => t.ownerId === AC[nm].uid && t.status !== 'cancelled');
    ok((nm === '李娜' || un.some(x => /新任务|派给你|任务/.test(x))) && mine.every(t => tl.includes(t.title.slice(0, 6))), nm + ' 收到任务通知，任务页能看到全部 ' + mine.length + ' 个任务');
    for (const t of mine) {
      await go(p, '#/task/' + t.id);
      for (const a of ['accept', 'start']) { const r = await clickDo(p, 'tt', a); await p.waitForTimeout(500); if (!r) log('  ', nm, t.title, '找不到按钮', a); }
      await clickDo(p, 'submit'); await p.waitForSelector('#layer .sheet textarea[name=note]');
      await p.fill('#layer .sheet textarea[name=note]', '已完成「' + t.title + '」，详见附件。');
      if (nm === '王芳') { await p.setInputFiles('#layer .sheet input[data-dvfile][multiple]', L + '/p1_idea.png'); await p.waitForTimeout(800); }
      await sheetSubmit(p); log('  ', nm, '提交', t.title, '→', await toast(p));
    }
    if (nm === '王芳') await p.screenshot({ path: L + '/p2_exec_task.png', fullPage: true });
  }
  await wait(2500);
  st = await state(); log('任务状态：', st.tasks.filter(t => t.workId === w.id).map(t => t.title.slice(0, 8) + '=' + t.status).join('，'));
  ok(st.tasks.filter(t => t.workId === w.id).every(t => t.status === 'submitted'), '全部任务已提交待验收');
  const dv = st.deliverables.find(d => (d.media || []).length); ok(!!dv, '王芳的成果附件已提交');
  if (dv) { const r = await fetch(SRV + '/api/files/' + dv.media[0].localId, { headers: { Authorization: 'Bearer ' + op.tok } }); ok(r.status === 200 && (await r.arrayBuffer()).byteLength > 1000, '验收人能打开执行人上传的附件'); }

  const bc = await b.newContext({ ...devices['iPhone 13'] }); const bp = await bc.newPage(); bp.on('pageerror', e => errs.push('老板：' + e.message)); await bp.goto(SRV + '/');
  await bp.fill('form[data-form=srvLogin] input[name=login]', 'boss'); await bp.fill('form[data-form=srvLogin] input[name=password]', 'Boss2026x'); await bp.click('form[data-form=srvLogin] button[type=submit]'); await bp.waitForTimeout(2500);
  for (let i = 0; i < 3 && await bp.locator('#layer .sheet').count(); i++) { await bp.evaluate(() => { const x = document.querySelector('#layer .sheet [data-do=closeSheet]'); x && x.click(); }); await bp.waitForTimeout(400); }
  // ===== 验收：退回王芳一次，其余通过（验收人是谁就由谁验收）
  log('李娜 未读通知：', JSON.stringify((await unread(op.tok)).slice(-6)));
  for (const t of st.tasks.filter(x => x.workId === w.id)) {
    const rv = st.users.find(u => u.id === t.reviewerId).name; const p = rv === '李娜' ? op : rv === '王总' ? bp : null; if (!p) { log('  验收人：', rv, '跳过'); continue; }
    await go(p, '#/task/' + t.id);
    const v = t.ownerId === AC['王芳'].uid && !t._ret ? 'return' : 'pass';
    await clickDo(p, 'review', v); await p.waitForSelector('#layer .sheet textarea[name=note]');
    await p.fill('#layer .sheet textarea[name=note]', v === 'return' ? '背景板颜色和公司 VI 不一致，请改用蓝色主色' : '符合要求'); await sheetSubmit(p);
    log('  ' + rv + ' 验收', t.title, v === 'return' ? '退回' : '通过', '→', await toast(p));
  }
  const wf = people['王芳']; const un2 = await unread(wf.tok); ok(un2.some(x => /退回/.test(x)), '王芳收到退回通知：' + JSON.stringify(un2.filter(x => /退回/.test(x))));
  st = await state();
  for (const t of st.tasks.filter(x => x.workId === w.id && x.status === 'in_progress')) {
    await go(wf, '#/task/' + t.id); await clickDo(wf, 'submit'); await wf.waitForSelector('#layer .sheet textarea[name=note]');
    await wf.fill('#layer .sheet textarea[name=note]', '已按意见改成蓝色主色'); await sheetSubmit(wf); log('  王芳重新提交', t.title, await toast(wf));
    const rp = t.reviewerId === AC['李娜'].uid ? op : bp; await go(rp, '#/task/' + t.id); await clickDo(rp, 'review', 'pass'); await rp.waitForSelector('#layer .sheet textarea[name=note]'); await rp.fill('#layer .sheet textarea[name=note]', '改好了，通过'); await sheetSubmit(rp); log('  验收通过', await toast(rp));
  }
  await wait(1000); st = await state(); let w2 = st.workItems.find(x => x.id === w.id);
  log('项目状态：', w2.status, w2.stage, '任务：', st.tasks.filter(t => t.workId === w.id).map(t => t.status).join(','));
  if (w2.status === 'acceptance') {
    await go(op, '#/work/' + w.id); await op.screenshot({ path: L + '/p2_work_accept.png', fullPage: true });
    const btn = await op.evaluate(() => [...document.querySelectorAll('[data-do]')].map(x => x.dataset.do + ':' + x.textContent.trim().slice(0, 10)).filter(x => /验收|完成|close/i.test(x)));
    log('项目页验收按钮：', JSON.stringify(btn));
    const did = await clickDo(op, 'closeWork') || await clickDo(op, 'wClose') || await clickText(op, '项目验收');
    if (await op.locator('#layer .sheet').count()) { const ta = op.locator('#layer .sheet textarea'); if (await ta.count()) await ta.first().fill('答谢会筹备全部完成'); await sheetSubmit(op); }
    log('李娜点项目验收：', did, await toast(op));
  }
  await wait(1000); st = await state(); w2 = st.workItems.find(x => x.id === w.id);
  ok(w2.status === 'done', '项目完成（状态 ' + w2.status + '）');
  const bn = await unread(BT); log('老板 未读通知：', JSON.stringify(bn)); ok(bn.some(x => /项目完成/.test(x)), '老板收到「项目完成」通知');
  // 老板端看到结果
  await go(bp, '#/idea/' + idea.id); await bp.screenshot({ path: L + '/p2_boss_idea.png', fullPage: true });
  const bt = await bp.evaluate(() => document.body.innerText); ok(/已完成|完成/.test(bt), '老板在想法页看到落实结果');
  await go(bp, '#/work/' + w.id); await bp.screenshot({ path: L + '/p2_boss_work.png', fullPage: true });
  log('页面报错：', errs.length ? errs.join(' | ') : '无');
  log(`第 2 段：通过 ${pass}，失败 ${fail}`);
  await b.close();
})().catch(e => { log('出错', e.stack.split('\n').slice(0, 3).join(' ')); process.exit(1); });
