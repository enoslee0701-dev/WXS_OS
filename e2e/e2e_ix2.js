const { chromium } = require('playwright');
const URL=(require('./_env').URL);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message)); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('✗',m));};
  await p.goto(URL); await p.evaluate(()=>{localStorage.clear();localStorage.setItem('tm_user_v3','u_owner');}); await p.reload();
  await p.goto(URL+'#/idea/I1'); await p.waitForTimeout(200);
  const t = await p.textContent('main');
  ok(t.includes('想法详情') && t.includes('想法原文') && !t.includes('相关标签') && t.includes('创建于'), '详情页四块齐全');
  ok(!(await p.locator('.card h3:has-text("整理稿")').count()), '旧整理稿卡片已移走');
  ok(await p.locator('.ix2-aiwrap.ix2-fold').count()===1, 'AI 整理折叠卡');
  ok(!(await p.isVisible('.ix2-aiwrap .ix2-sec >> nth=1')), '默认只显示核心概述');
  await p.click('.ix2-aiwrap [data-do=ixFold]'); ok(await p.isVisible('.ix2-aiwrap .ix2-sec >> nth=3'), '点击展开全部');
  await p.click('.ix2-aiwrap [data-do=ixFold]'); ok(!(await p.isVisible('.ix2-aiwrap .ix2-sec >> nth=1')), '可收起');
  await p.goto(URL+'#/idea/I1/ai'); await p.waitForTimeout(200);
  const ta = await p.textContent('main');
  ok(['核心概述','目标','当前问题','建议方向'].every(x=>ta.includes(x)), 'AI 整理四段');
  ok(await p.locator('.ix2-sec ol li').count()>=3, '建议方向编号');
  await p.goBack(); await p.waitForTimeout(150);
  await p.click('.ix-dots'); await p.click('.sheet [data-do=ixLog]'); await p.waitForTimeout(150);
  ok(p.url().endsWith('/log') && (await p.textContent('main')).includes('直接推进'), '操作记录子页');
  // 跟进人重新整理
  await p.evaluate(()=>localStorage.setItem('tm_user_v3','u_op')); await p.reload();
  const s = await p.evaluate(()=>(JSON.parse(localStorage.getItem('tm_demo_v3')||'{"ideas":[]}')).ideas.find(x=>x.status==='triage' && x.followerId==='u_op'));
  if (s) { await p.goto(URL+'#/idea/'+s.id+'/ai'); await p.waitForTimeout(150); await p.click('[data-do=ixReAI]'); await p.waitForTimeout(150); ok((await p.textContent('.ix2-foot')).includes('共'), '重新整理生成新版本'); }
  await p.evaluate(()=>localStorage.setItem('tm_user_v3','u_owner')); await p.reload(); await p.goto(URL+'#/idea/I1'); await p.waitForTimeout(150);
  const n0 = await p.locator('.ix2-file').count();
  await p.click('[data-do=ixAttach]'); await p.waitForSelector('.sheet.on'); ok(await p.locator('.ix2-opt').count()===5, '五种添加方式');
  await p.setInputFiles('.ix2-opt:has-text("相册") input', {name:'现场.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')}); await p.waitForTimeout(200);
  ok(await p.locator('.ix2-thumbs img').count()===1 && await p.locator('.ix2-file').count()===n0+1, '图片缩略图');
  await p.click('.ix2-thumbs button'); await p.waitForSelector('.sheet.on img'); ok(true,'点图预览'); await p.click('.sheet footer button[type=submit]');
  await p.click('[data-do=ixAttach]'); await p.click('.sheet [data-do=ixLink]'); await p.fill('.sheet input[name=url]','https://example.com/plan'); await p.fill('.sheet input[name=name]','招聘方案草稿'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(150);
  ok((await p.textContent('.ix2-files')).includes('招聘方案草稿') && await p.locator('.ix-fi.ix-l').count()===1, '添加链接');
  await p.click('.ix2-file:has-text("招聘方案草稿") .ix2-del'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(150);
  ok(!(await p.textContent('.ix2-files')).includes('招聘方案草稿'), '删除附件');
  const nf = await p.locator('.ix2-file').count();
  await p.click('.ix2-file >> nth=0 >> .ix2-eye'); await p.waitForTimeout(150);
  ok(await p.locator('.ix2-file.off').count()===1 && (await p.textContent('.ix2-files')).includes('不呈现'), '老板设为不呈现');
  const fid = await p.evaluate(()=>location.hash.split('/')[2]);
  const fol = await p.evaluate((id)=>JSON.parse(localStorage.getItem('tm_demo_v3')).ideas.find(x=>x.id===id).followerId, fid);
  if (fol) { await p.evaluate((u)=>localStorage.setItem('tm_user_v3',u), fol); await p.reload(); await p.waitForTimeout(150); ok(await p.locator('.ix2-file').count()===nf-1 && !(await p.locator('.ix2-eye').count()), '跟进人看不到隐藏附件，也没有开关'); await p.evaluate(()=>localStorage.setItem('tm_user_v3','u_owner')); await p.reload(); await p.waitForTimeout(150); }
  await p.click('.ix2-file.off .ix2-eye'); await p.waitForTimeout(150); ok(!(await p.locator('.ix2-file.off').count()), '恢复呈现');
  await p.evaluate(()=>{localStorage.clear();localStorage.setItem('tm_user_v3','u_owner');}); await p.reload(); await p.goto(URL+'#/idea/I4'); await p.waitForTimeout(200);
  ok(await p.locator('.ix2-adv').count()===1 && !(await p.isVisible('.ix2-advb')), '决策卡有 AI 建议（默认折叠）');
  await p.click('.ix2-adv [data-do=ixFold]'); ok(await p.isVisible('.ix2-advb'), '看理由展开');
  await p.click('.actions button:has-text("做决定")'); await p.waitForSelector('.sheet.on .ix2-adv');
  await p.click('.sheet [data-do=advAdopt]'); ok((await p.inputValue('.sheet textarea[name=note]')).length>4, '采用建议填入批语');
  await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(200); ok(!(await p.locator('.ix2-adv').count()), '决定后建议收起');
  await p.evaluate(()=>{localStorage.clear();localStorage.setItem('tm_user_v3','u_owner');}); await p.reload(); await p.goto(URL+'#/new/text'); await p.waitForTimeout(150);
  await p.fill('[data-cap="tx.note"]','会议室投影仪坏了，换一台'); await p.click('[data-do=capNext][data-k=tx]'); await p.waitForTimeout(200);
  if (await p.isVisible('.sheet.on')) { const dd = p.locator('.sheet .opt:has-text("直接推进")'); if (await dd.count()) await dd.click(); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(200); }
  ok((await p.textContent('.ix2-main h2')).includes('更换会议室投影仪') && await p.locator('.ix2-ait').count()===1, '记录后自动 AI 拟题');
  await p.click('[data-do=ixTitle]'); await p.fill('.sheet input[name=title]','会议室换新投影仪'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(150);
  ok((await p.textContent('.ix2-main h2')).includes('会议室换新投影仪') && !(await p.locator('.ix2-ait').count()), '老板改标题后不再标 AI 拟题');
  // 老板改派跟进人：先加一位运营者，再把一条待整理的想法改派给他
  { const iid = await p.evaluate(() => { const S = window.__tm.S; S.users.push({ id: 'u_op2', name: '小运', title: '运营', tier: '', roles: [{ role: 'operator', dept: 'd_ops' }], group: '行政运营', presence: 'offline' }); const r = TM.act(S, 'u_owner', 'idea.create', { note: '换会议室门锁' }); TM.act(S, 'u_owner', 'idea.submit', { id: r.id, path: 'direct' }); const d0 = S.ideas.find(x => x.id === r.id); if (!d0.followerId) TM.act(S, 'u_op', 'idea.claim', { id: r.id }); return r.id; });
    await p.goto(URL + '#/home'); await p.click('[data-do=switch]'); await p.click('.acct:has-text("Philip")'); await p.waitForTimeout(150);
    if (iid) { await p.goto(URL + '#/idea/' + iid); await p.waitForTimeout(200); await p.click('.ix-dots'); await p.click('.sheet [data-do=ixFollow]'); await p.selectOption('.sheet select[name=to]', 'u_op2'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(150);
      ok(await p.evaluate((id) => window.__tm.S.ideas.find(x => x.id === id).followerId === 'u_op2', iid), '老板改派跟进人'); } else ok(false, '找不到待整理的想法'); }
  ok(!errs.length,'无脚本错误 '+errs.join(';')); console.log('想法详情 E2E 通过',pass,'失败',fail); await b.close();
})();
