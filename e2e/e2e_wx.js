const { chromium } = require('playwright');
const URL=(require('./_env').URL);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message)); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('✗',m));};
  const as = async u => { await p.goto(URL); await p.evaluate(u=>{localStorage.clear();localStorage.setItem('tm_user_v3',u);},u); await p.reload(); };
  await as('u_owner'); await p.goto(URL+'#/work/W1'); await p.waitForTimeout(200);
  // 概览：问 AI + 落实过程
  ok(await p.locator('.wx-ask').count()===1, '概览有问 AI 入口');
  ok(await p.locator('.wx-flow').count()===1 && (await p.textContent('.wx-flow')).includes('落实过程'), '概览有落实过程');
  ok((await p.textContent('.wx-flow .fl-now')).length>3, '落实过程显示「现在」');
  await p.click('.wx-flow [data-do=ixFold]'); ok(await p.isVisible('.wx-flow .fl-full'), '落实过程可展开');
  await p.click('.wx-ask'); await p.waitForSelector('#wc-panel');
  await p.click('#wc-panel [data-do=wcAsk][data-q="现在进度如何"]'); await p.waitForTimeout(100);
  ok((await p.textContent('#wc-list')).includes('完成'), '问进度有回答');
  await p.fill('#wc-q','谁在做什么'); await p.press('#wc-q','Enter'); await p.waitForTimeout(100);
  ok((await p.locator('#wc-list .ic-a').count())===2 && (await p.textContent('#wc-list')).includes('负责人'), '回车提问，回答分工');
  await p.fill('#wc-q','有哪些风险'); await p.click('[data-do=wcSend]'); await p.waitForTimeout(100); ok((await p.locator('#wc-list .ic-a').count())===3, '按钮发送');
  await p.click('[data-do=wcClose]'); ok(!(await p.locator('#wc-panel').count()), '可收起');
  // 任务页
  await p.click('[data-do=wTab][data-t=tasks]'); await p.waitForTimeout(100);
  const all = await p.locator('.wt-list .row.wt').count(); ok(all>=2, '任务卡片 '+all);
  ok(await p.locator('.wt-chips button').count()===5, '五个筛选');
  ok(await p.locator('.wt-list .wt-who').count()===all, '每张卡显示负责人');
  await p.click('.wt-chips [data-f=done]'); await p.waitForTimeout(80);
  const nd = await p.locator('.wt-list .row.wt').count(); const cd = +(await p.textContent('.wt-chips [data-f=done] i'));
  ok(nd===cd || (cd===0 && await p.locator('.empty').count()===1), '筛选数量与计数一致');
  await p.click('.wt-chips [data-f=all]'); const h1 = await p.locator('.wt-list .row.wt').first().evaluate(e=>e.getBoundingClientRect().height); ok(h1<=120, '任务卡紧凑（'+Math.round(h1)+'）');
  await p.screenshot({path:'s_tasks.png'});
  await p.locator('.wt-list .row.wt').first().click(); await p.waitForTimeout(120); ok(p.url().includes('#/task/'), '点任务进入详情');
  // 成员页
  await p.goto(URL+'#/work/W1'); await p.waitForTimeout(120); await p.click('[data-do=wTab][data-t=mem]'); await p.waitForTimeout(80);
  const nm = await p.locator('.wm-list .row.wm').count(); ok(nm>=3, '成员卡片 '+nm);
  ok((await p.textContent('.wm-list .row.wm >> nth=0')).includes('负责人'), '负责人排第一');
  ok((await p.textContent('.wm-sum')).includes(String(nm)), '成员数汇总');
  await p.screenshot({path:'s_mem.png'});
  await p.locator('.wm-list .row.wm').first().click(); await p.waitForSelector('.sheet.on'); ok((await p.textContent('.sheet')).includes('负责人'), '点成员看他的任务'); await p.click('.sheet footer button[type=submit]');
  // 文件页 + 上传
  await p.click('[data-do=wTab][data-t=files]'); await p.waitForTimeout(80);
  ok(await p.locator('.wf-sec').count()>=2 && await p.locator('.list .row',{hasText:'交付物'}).count()>=1, '分区显示交付物');
  ok(await p.locator('.wf-empty').count()===1, '项目文件为空时有上传引导');
  await p.click('.wf-up'); await p.waitForSelector('.sheet.on');
  await p.setInputFiles('.sheet input[data-wfile]:not([accept]):not([capture])', [require('path').join(__dirname,'fixtures','plan.pdf'),require('path').join(__dirname,'fixtures','pic.jpg')]); await p.waitForTimeout(200);
  ok(await p.locator('.wf-sec >> nth=0').locator('.row.wf').count()===2, '上传两个文件');
  ok((await p.textContent('.wf-head')).includes('项目文件 2'), '汇总更新');
  ok(await p.locator('.wf-ic img').count()>=1, '图片显示缩略图');
  await p.locator('.wf-o',{hasText:'pic.jpg'}).click(); await p.waitForSelector('.sheet.on'); ok(await p.locator('.sheet img').count()===1, '点图片预览'); await p.click('.sheet footer button[type=submit]');
  await p.click('.wf-up'); await p.click('[data-do=wLink]'); await p.fill('.sheet input[name=url]','https://figma.com/file/x'); await p.fill('.sheet input[name=name]','设计稿'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(120);
  ok(await p.locator('.row.wf',{hasText:'设计稿'}).count()===1, '添加链接');
  await p.screenshot({path:'s_files.png', fullPage:true});
  await p.locator('.row.wf',{hasText:'plan.pdf'}).locator('.wf-x').click(); await p.waitForSelector('.sheet.on'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(120);
  ok(!(await p.locator('.row.wf',{hasText:'plan.pdf'}).count()), '删除文件');
  await p.click('[data-do=wTab][data-t=log]'); ok((await p.textContent('main')).includes('上传'), '动态里有上传记录');
  // 执行者：可上传，不能删别人的
  await as('u_dev'); await p.goto(URL+'#/work/W1'); await p.waitForTimeout(150);
  await p.evaluate(()=>{}); await p.click('[data-do=wTab][data-t=files]'); await p.waitForTimeout(80);
  ok(await p.locator('.wf-up').count()===1, '执行者能上传');
  await p.click('[data-do=wTab][data-t=ov]'); await p.click('.wx-ask'); await p.click('[data-do=wcAsk][data-q="下一步做什么"]'); await p.waitForTimeout(80); ok((await p.textContent('#wc-list')).length>10, '执行者也能问 AI');
  // 任务看板：切换后按状态分 5 列，任务卡点进任务详情；切回列表
  await p.click('[data-do=wTab][data-t=tasks]'); await p.waitForTimeout(80); await p.click('[data-do=wtView][data-v=board]'); await p.waitForTimeout(100);
  ok(await p.locator('.wt-col').count() === 5 && await p.locator('.wt-bc').count() >= 1, '任务看板按状态分列');
  await p.click('[data-do=wtView][data-v=list]'); await p.waitForTimeout(80); ok(await p.locator('.wt-board').count() === 0 && await p.locator('.wt-list').count() === 1, '切回列表');
  // 项目讨论：概览底部发言
  await p.click('[data-do=wTab][data-t=ov]'); await p.waitForTimeout(80);
  if (await p.locator('form[data-form=wComment]').count()) { await p.fill('form[data-form=wComment] textarea','这周五前给初稿'); await p.click('form[data-form=wComment] button[type=submit]'); await p.waitForTimeout(150);
    ok((await p.textContent('.wx-disc')).includes('这周五前给初稿'),'项目讨论发言后显示'); } else ok(false,'项目概览里没有讨论区');
  // 会议拆任务：贴一段会议纪要 → 拆出「谁、做什么、什么时候」→ 核对后一次派出
  { const wid = await p.evaluate(() => { const S = window.__tm.S; const w = S.workItems.find(x => x.status === 'active' && x.kind !== 'product'); return w && w.id; });
    await p.evaluate(() => { const S = window.__tm.S; }); await p.goto(URL + '#/home'); await p.click('[data-do=switch]'); await p.click('.acct:has-text("Philip")');
    await p.goto(URL + '#/work/' + wid); await p.waitForTimeout(200); await p.evaluate(() => document.querySelector('[data-do=wTab][data-t=tasks]').click()); await p.waitForTimeout(120);
    await p.evaluate(() => document.querySelector('[data-do=wMeeting]').click()); await p.waitForSelector('#mt-text');
    await p.fill('#mt-text', '会上定了：周五前刘洋把报名页面做出来；何静下周一给出海报初稿；餐盒由周敏这周订好。');
    await p.evaluate(() => document.querySelector('[data-do=mtGo]').click()); await p.waitForTimeout(250);
    const its = await p.evaluate(() => [...document.querySelectorAll('.mt-it')].map(x => x.querySelector('select').selectedOptions[0].textContent));
    ok(its.length === 3 && its.join() === '刘洋,何静,周敏', '会议拆任务：拆出 3 个任务并认出负责人 ' + its.join());
    await p.evaluate(() => document.querySelector('.mt-it input[data-mt=on]').click()); await p.waitForTimeout(80);
    const n0 = await p.evaluate(() => window.__tm.S.tasks.length);
    await p.evaluate(() => document.querySelector('.sheet footer button[type=submit]').click()); await p.waitForTimeout(250);
    const made = await p.evaluate((n) => window.__tm.S.tasks.slice(n).map(t => t.ownerId), n0);
    ok(made.length === 2 && made.includes('u_design') && !made.includes('u_dev'), '取消勾选的不派，其余一次派出 ' + made.join()); }
  // 录音转写常见的冒号断句：只补时间的半句并进上一个任务（闭环实测发现）
  { await p.evaluate(() => document.querySelector('[data-do=wMeeting]').click()); await p.waitForSelector('#mt-text');
    await p.fill('#mt-text', '今天定一下分工：何静负责设计邀请函和背景板：10月20号前出初稿：刘洋负责采购礼品：11月15号前到货');
    await p.evaluate(() => document.querySelector('[data-do=mtGo]').click()); await p.waitForTimeout(250);
    const its = await p.evaluate(() => [...document.querySelectorAll('.mt-it')].map(x => x.querySelector('[data-mt=title]').value + '|' + x.querySelector('select').selectedOptions[0].textContent + '|' + x.querySelector('[data-mt=due]').value));
    ok(its.length === 2 && /^设计邀请函和背景板，出初稿\|何静\|\d{4}-10-20$/.test(its[0]) && /^采购礼品，到货\|刘洋\|\d{4}-11-15$/.test(its[1]), '只补时间的半句并进上一个任务 ' + JSON.stringify(its));
    await p.evaluate(() => document.querySelector('.sheet [data-do=closeSheet]').click()); await p.waitForTimeout(200); }
  // 拆出的任务和项目里已有任务重复 → 标出并默认不勾；AI 时间和会议里说的不一致 → 提示核对
  { const wid2 = await p.evaluate(() => location.hash.split('/')[2]);
    const exist = await p.evaluate(() => { const S = window.__tm.S, w = S.workItems.find(x => x.id === location.hash.split('/')[2]); return S.tasks.filter(t => t.workId === w.id && !['done', 'cancelled'].includes(t.status)).map(t => t.title); });
    await p.evaluate(() => document.querySelector('[data-do=wMeeting]').click()); await p.waitForSelector('#mt-text');
    await p.fill('#mt-text', '刘洋负责' + exist[0] + '；何静周五前印制桌卡；何静周五前印制桌卡');
    await p.evaluate(() => document.querySelector('[data-do=mtGo]').click()); await p.waitForTimeout(250);
    const its = await p.evaluate(() => [...document.querySelectorAll('.mt-it')].map(x => ({ t: x.querySelector('[data-mt=title]').value, on: x.querySelector('[data-mt=on]').checked, warn: (x.querySelector('.mt-warn') || {}).textContent || '' })));
    ok(its.length === 3 && !its[0].on && /和已有任务/.test(its[0].warn) && its[1].on && !its[2].on && /像是同一件事/.test(its[2].warn), '重复任务默认不勾并说明 ' + JSON.stringify(its));
    ok(await p.evaluate(() => document.querySelector('.sheet footer button[type=submit]').textContent) === '派出 1 个任务', '按钮只算勾选的');
    const flag = await p.evaluate(() => { const S = window.__tm.S, w = S.workItems.find(x => x.id === location.hash.split('/')[2]); const items = [{ title: '采购礼品', ownerId: 'u_dev', due: '2027-01-05', on: true }]; window.__tm.mtFlag(items, w, [{ title: '采购抽奖礼品', ownerId: 'u_dev', due: '2027-01-20' }]); return items[0]; });
    ok(flag.dueAlt === '2027-01-20' && flag.on, 'AI 时间和会议里说的不一致时标出来：' + flag.dueAlt);
    ok(await p.evaluate(() => window.__tm.mtSimilar('联系酒店', '联系酒店签合同') && window.__tm.mtSimilar('设计邀请函和背景板', '邀请函背景板设计') && !window.__tm.mtSimilar('联系酒店', '采购礼品')), '相似判断：包含 / 大部分字相同算相似，不相干的不算');
    await p.evaluate(() => document.querySelector('.sheet [data-do=closeSheet]').click()); await p.waitForTimeout(200); void wid2; }
  // 派发：AI 建议的多个任务一次派完，不要的取消勾选（闭环实测：之前只带出第一个）
  { const iid = await p.evaluate(() => { window.__tm.as('u_owner'); const S = JSON.parse(JSON.stringify(window.__tm.S));
      const at = Date.now(), d = { id: 'Ixmulti', creatorId: 'u_owner', dept: null, path: 'direct', status: 'triage', aiStatus: 'ready', title: '答谢会', note: '年终客户答谢会', followerId: 'u_op', shareAll: false, shares: [], media: [], tags: [], submittedAt: at, lastActivity: at, createdAt: at };
      S.ideas.push(d); S.summaries.push({ id: 'Sxmulti', ideaId: d.id, kind: 'analysis', version: 1, authorType: 'agent', payload: { simulated: false, title: '答谢会', summary: '办答谢会', category: 'admin', exception_flags: [], suggested_route: 'operator_direct', suggested_tasks: [['订酒店', 9], ['做邀请函', 5], ['电话邀请客户', 12]].map(x => ({ title: x[0], expected_output: x[0] + '完成', acceptance_criteria: '验收人确认', suggested_due_days: x[1] })) }, at });
      window.__tm.setState(S); window.__tm.as('u_op'); return d.id; });
    await p.goto(URL + '#/idea/' + iid); await p.waitForTimeout(300);
    await p.evaluate(() => [...document.querySelectorAll('[data-do=route]')][0].click()); await p.waitForSelector('.sheet.on');
    const rs = await p.evaluate(() => ({ titles: [...document.querySelectorAll('.sheet input[name$=_title]')].map(x => x.value), btn: document.querySelector('.sheet footer button[type=submit]').textContent, owners: [...document.querySelectorAll('.sheet select[name$=_ownerId]')].map(x => x.value) }));
    ok(rs.titles.join() === '订酒店,做邀请函,电话邀请客户' && /派发 3 个任务/.test(rs.btn), '派发面板带出 AI 建议的全部任务 ' + JSON.stringify(rs));
    ok(new Set(rs.owners).size > 1, '默认负责人轮流分配，不全压给一个人 ' + rs.owners.join());
    await p.evaluate(() => document.querySelector('.sheet input[name=t2_on]').click());
    const n0 = await p.evaluate(() => window.__tm.S.tasks.length);
    await p.evaluate(() => document.querySelector('.sheet footer button[type=submit]').click()); await p.waitForTimeout(300);
    const made = await p.evaluate((n) => window.__tm.S.tasks.slice(n).map(t => t.title), n0);
    ok(made.join() === '订酒店,做邀请函' && p.url().includes('#/work/'), '取消勾选的不派，其余一起派出 ' + made.join());
  }
  ok(!errs.length,'无脚本错误 '+errs.join(';')); console.log('项目详情 E2E 通过',pass,'失败',fail); await b.close();
})();
