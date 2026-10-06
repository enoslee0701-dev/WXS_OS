const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto((require('./_env').URL));
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('tm_user_v3', 'u_owner'); }); await p.reload();
  await p.goto((require('./_env').URL+'#/me')); await p.waitForTimeout(300);
  await p.click('[data-do=demoStart]'); let pass = 0, fail = 0;
  const ok = (c, m) => { c ? pass++ : (fail++, console.log('✗', m)); };
  ok(await p.isVisible('#demo-coach'), '面板出现');
  const shots = {};
  for (let i = 0; i < 30; i++) {
    const btn = await p.textContent('#demo-coach .dc-go');
    if (btn.includes('结束')) break;
    await p.click('#demo-coach .dc-go'); await p.waitForTimeout(250);
    const h = await p.textContent('#demo-coach h3');
    if (h.includes('派发') && !shots.w) { shots.w = 1; await p.screenshot({ path: 'demo_work.png' }); }
    if (h.includes('确认项目完成') && h.includes('✓')) await p.screenshot({ path: 'demo_done.png' });
  }
  ok((await p.textContent('#demo-coach h3')).includes('流程走完了'), '走到结尾');
  const st = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('tm_demo_v3')); const i = s.ideas.find(x => x.title.includes('【演示】')); const w = s.workItems.find(x => x.ideaId === i.id); return { i: i.status, w: w.status, me: localStorage.getItem('tm_user_v3') }; });
  ok(st.w === 'done', '项目完成 ' + st.w); ok(st.me === 'u_owner', '切回老板');
  await p.screenshot({ path: 'demo_end.png' });
  ok(await p.locator('.fl-card .fl-s').count()===5 && (await p.textContent('.fl-now')).includes('完成'), '落实过程：5 段摘要 + 现在状态');
  ok(!(await p.isVisible('.fl-full')), '默认只显示摘要');
  await p.click('.fl-card [data-do=ixFold]'); const ft = await p.textContent('.fl-full');
  ok(['认领跟进','报老板决策','批准','形成项目','开始做','提交成果','验收通过','确认项目完成'].every(x=>ft.includes(x)), '展开后完整显示谁接手每一步');
  await p.click('#demo-coach .dc-go'); ok(!(await p.isVisible('#demo-coach')), '退出后面板消失');
  ok(!errs.length, '无脚本错误 ' + errs.join(';'));
  console.log('通过', pass, '失败', fail); await b.close();
})();
