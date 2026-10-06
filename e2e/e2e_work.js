const { chromium, devices } = require('playwright');
const URL=(require('./_env').URL);
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('✗',m);}};
(async()=>{const b=await chromium.launch();const c=await b.newContext({...devices['iPhone 13']});
await c.route(/fonts\.(googleapis|gstatic)\.com/, r=>r.fulfill({status:200,contentType:'text/css',body:''}));
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const toast=async()=>p.textContent('#toast');const sub=async()=>{await p.click('.sheet footer button[type=submit]');await p.waitForTimeout(120);};
await p.goto(URL);await p.click('.acct:has-text("Enos")');await p.click('.tabs a:has-text("项目")');await p.waitForTimeout(150);ok(p.url().endsWith('#/work') && (await p.locator('.tabs a').allTextContents()).join(',')==='首页,想法,任务,项目,我的','导航顺序：首页、想法、任务、项目、我的');ok(await p.locator('.sc-chip[data-do=workFilter]').count()>=4 && await p.evaluate(()=>document.querySelector('.w-card').getBoundingClientRect().top<innerHeight),'项目状态改为紧凑胶囊，打开即见项目');
ok((await p.textContent('.tk2-top h1'))==='项目','项目页标题');
ok(await p.locator('.w-card').count()===2,'进行中 2 个项目');
const meta=await p.locator('.w-card').first().locator('.wc-m').textContent();console.log('卡片信息:',meta);ok(/个任务未完成|任务已全部完成|还没有任务/.test(meta) && await p.locator('.w-card .wc-th').count()>=1,'卡片含图片与任务情况');
await p.screenshot({path:'w-list.png',fullPage:true});
await p.click('[data-do=workFilter][data-f=acceptance]');ok(await p.locator('.w-card',{hasText:'团队培训计划'}).count()===1,'待验收筛选');
await p.click('[data-do=workFilter][data-f=done]');ok(await p.locator('.w-card .wc-pct',{hasText:'100%'}).count()===1,'已完成 100%');
await p.click('.tabs a:has-text("想法")');await p.waitForTimeout(150);ok(p.url().endsWith('#/ideas') && (await p.textContent('.tk2-top h1'))==='想法','想法独立导航');
await p.click('.tabs a:has-text("项目")');await p.waitForTimeout(150);await p.click('[data-do=workFilter][data-f=active]');
await p.locator('.w-card',{hasText:'清醒'}).locator('.w-link').click();await p.waitForTimeout(150);
ok(p.url().endsWith('#/work/W1'),'进入项目详情');
ok((await p.textContent('.wx-sh strong'))==='0%','进度 0%');
ok(await p.locator('.wd-ms li').count()===4 && await p.locator('.wd-ms li.done').count()===1 && await p.locator('.wd-ms li.cur').count()===1,'里程碑：1 完成 1 当前');
ok(await p.locator('.wx-mem > div').count()>=4,'成员展示');
await p.screenshot({path:'w-detail.png',fullPage:true});
await p.click('.wx-edit[data-do=wInfo]');await p.check('.sheet input[name=priority][value=lo]');await p.fill('.sheet input[name=tags]','产品、招聘');await sub();ok((await p.textContent('.wx-pri'))==='低' && (await p.textContent('.wx-tags')).includes('招聘'),'改优先级和标签');
await p.click('.wx-edit[data-do=wInfo]');await p.fill('.sheet textarea[name=keyResults]','原型、评审纪要');await sub();ok((await p.textContent('.wx-grid')).includes('评审纪要'),'改关键成果');
await p.click('[data-do=wAddMs]');await p.fill('.sheet input[name=title]','上线发布');await p.fill('.sheet input[name=date]','2026-11-20');await sub();ok(await p.locator('.wd-ms li').count()===5,'添加里程碑');
await p.click('.wd-ms li.cur .wd-dot');await p.waitForTimeout(120);ok(await p.locator('.wd-ms li.done').count()===2,'完成当前里程碑');
await p.click('[data-do=wTab][data-t=tasks]');ok(await p.locator('.list .row').count()===2,'任务页签');
await p.click('[data-do=wTab][data-t=mem]');ok(await p.locator('.list .row').count()>=4,'成员页签');
await p.click('[data-do=wTab][data-t=files]');ok(await p.locator('.list .row',{hasText:'交付物'}).count()===1,'文件页签含交付物');
await p.click('[data-do=wTab][data-t=log]');ok((await p.textContent('main')).includes('里程碑'),'动态含里程碑');
await p.click('.actions .btn:has-text("更多操作")');ok(await p.locator('.sheet [data-do=stage]').count()===1 && await p.locator('.sheet [data-do=pause]').count()===1,'更多操作含推进阶段与暂停');
await p.click('.sheet [data-do=stage]');await p.check('.sheet input[value=ui_review]');await sub();ok(await p.locator('.wx-chips i',{hasText:'原型/UI 审核阶段'}).count()===1,'推进阶段');
await p.click('.actions .btn:has-text("新建任务")');ok(p.url().endsWith('#/assign/W1'),'新建任务进入分配');
// 想法页
await p.goto(URL+'#/ideas');await p.waitForTimeout(150);ok(await p.locator('.id-cta').count()===0 && await p.locator('.std-hero .tk-month').count()===0 && await p.locator('.id-tile').count()===6,'想法页：去掉长条按钮和数量胶囊，6 个状态卡');
ok((await p.textContent('.ib-head b'))==='最近动态' && await p.locator('.id-row').count()>=3,'默认显示最近动态');
await p.click('.id-tile[data-f=awaiting]');await p.waitForTimeout(100);ok((await p.textContent('.ib-head b'))==='等决策' && await p.locator('.id-row').count()===1,'点「等决策」筛选');
await p.click('[data-do=ideasRecent]');await p.waitForTimeout(100);ok((await p.textContent('.ib-head b'))==='最近动态','返回动态');
await p.click('.std-hero .w-plus');await p.waitForTimeout(100);ok(p.url().endsWith('#/new'),'右上角 + 直接记录想法');
// 想法详情
await p.goto(URL+'#/idea/I2');await p.waitForTimeout(150);ok(await p.locator('.ix-steps > div').count()===5 && await p.locator('.ix-steps .cur').count()===1,'想法详情：5 步进度');
ok((await p.textContent('.ix-next')).includes('陈立'),'下一步提示');
await p.click('[data-do=ixAttach]');await p.waitForSelector('.sheet.on');await p.setInputFiles('.ix2-opt:has-text("文件") [data-ixfile]',{name:'团队扩编需求说明.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4')});await p.waitForTimeout(150);ok(await p.locator('.ix-file .ix-p').count()===1,'添加 PDF 附件');
await p.click('.ix-dots');await p.waitForSelector('.sheet h2:has-text("更多操作")');ok(await p.locator('.sheet [data-do=ixLog]').count()===1,'更多操作');await p.click('.sheet footer button[type=submit]');
// 老板删除想法
await p.goto(URL+'#/idea/I4');await p.waitForTimeout(150);await p.click('.ix-dots');await p.click('.sheet [data-do=ixDelete]');await p.waitForSelector('.sheet h2:has-text("删除想法")');
await p.fill('.sheet input[name=reason]','重复了');await p.click('.sheet footer button[type=submit]');await p.waitForTimeout(200);
ok(p.url().endsWith('#/ideas') && (await p.textContent('main')).indexOf('官网改版并对外发布')<0,'老板删除想法后列表里消失');
await p.goto(URL+'#/idea/I5');await p.waitForTimeout(150);await p.click('.ix-dots');await p.click('.sheet [data-do=ixDelete]');await p.waitForSelector('.sheet h2:has-text("删除想法")');ok((await p.textContent('.sheet')).includes('需要先在项目里取消'),'已形成进行中项目的想法提示先取消');await p.click('.sheet footer button[type=submit]');
// 运营者验收培训项目
await p.click('[data-do=back]').catch(()=>{});
await p.goto(URL);await p.goto(URL+'#/home');await p.waitForTimeout(80);await p.click('[data-do=switch]');await p.click('.acct:has-text("林晓")');await p.goto(URL+'#/work/W3');await p.waitForTimeout(120);
ok(await p.locator('.wd-accept').count()===1,'验收人看到确认提示');
await p.click('.wd-accept [data-do=closeWork]');await sub();ok(await p.locator('.ws',{hasText:'已完成'}).count()===1,'确认完成');
// 执行者只读
await p.goto(URL+'#/home');await p.waitForTimeout(80);await p.click('[data-do=switch]');await p.click('.acct:has-text("何静")');await p.goto(URL+'#/work/W1');await p.waitForTimeout(120);
ok(await p.locator('[data-do=wAddMs]').count()===0 && await p.locator('.actions').count()===0,'执行者只读，无操作按钮');
ok(errs.length===0,'无报错 '+errs.join('|'));
// 取消项目：更多操作 → 取消项目 → 写原因 → 项目已取消、任务一并取消
// 项目里上报老板决策（负责人）→ 老板在「需要你决策」里批准 → 老板对已提交的任务写复核意见
{ await p.goto(URL+'#/home');await p.click('[data-do=switch]');await p.click('.acct:has-text("陈立")');await p.waitForTimeout(150);
  const wid=await p.evaluate(()=>{const S=window.__tm.S;const w=S.workItems.find(x=>x.leadId==='u_lead'&&!['done','cancelled'].includes(x.status));return w&&w.id;});
  await p.goto(URL+'#/work/'+wid);await p.waitForTimeout(200);await p.click('.actions .btn:has-text("更多操作")');await p.click('.sheet [data-do=wEscalate]');
  await p.selectOption('.sheet select[name=kind]','over_budget');await p.fill('.sheet textarea[name=question]','场地费超出预算 3000 元，是否同意？');await sub();await p.waitForTimeout(150);
  ok(await p.evaluate((w)=>window.__tm.S.decisions.some(d=>d.workId===w&&d.status==='pending'),wid),'负责人在项目里上报老板决策');
  await p.goto(URL+'#/home');await p.click('[data-do=switch]');await p.click('.acct:has-text("Enos")');await p.goto(URL+'#/stat/decide');await p.waitForTimeout(200);
  ok((await p.textContent('main')).includes('场地费超出预算'),'老板在「需要你决策」里看到项目上报');
  const did=await p.evaluate((w)=>window.__tm.S.decisions.find(d=>d.workId===w&&d.status==='pending').id,wid);
  await p.evaluate((id)=>{const b=document.querySelector('[data-do=decide][data-arg="'+id+'"]');if(b)b.click();},did);await p.waitForSelector('.sheet input[name=status]');await sub();await p.waitForTimeout(150);
  ok(await p.evaluate((id)=>window.__tm.S.decisions.find(d=>d.id===id).status==='approved',did),'老板批准项目上报');
  const tid=await p.evaluate(()=>{const t=window.__tm.S.tasks.find(x=>['submitted','done'].includes(x.status));return t&&t.id;});
  await p.goto(URL+'#/task/'+tid);await p.waitForTimeout(200);await p.click('.actions [data-do=reviewNote]');await p.fill('.sheet textarea[name=note]','再补一份预算表');await sub();await p.waitForTimeout(150);
  ok(await p.evaluate((id)=>window.__tm.S.reviews.some(r=>r.taskId===id&&r.verdict==='comment'),tid),'老板写复核意见'); }
await p.goto(URL+'#/home');await p.waitForTimeout(80);await p.click('[data-do=switch]');await p.click('.acct:has-text("Enos")');
await p.goto(URL+'#/work/W1');await p.waitForTimeout(200);await p.click('.actions .btn:has-text("更多操作")');ok(await p.locator('.sheet [data-do=cancelWork]').count()===1,'更多操作含取消项目');
await p.click('.sheet [data-do=cancelWork]');await p.fill('.sheet textarea[name=reason]','方向调整');await sub();await p.waitForTimeout(150);
ok(await p.evaluate(()=>{const S=window.__tm.S;return S.workItems.find(w=>w.id==='W1').status==='cancelled'&&S.tasks.filter(t=>t.workId==='W1').every(t=>['done','cancelled'].includes(t.status));}),'取消项目后项目和未完成任务都已取消');
ok(await p.locator('.actions .btn:has-text("更多操作")').count()===0 || !(await p.evaluate(()=>!!document.querySelector('.sheet [data-do=cancelWork]'))),'已取消的项目不再提供取消');
// 编辑任务：改截止日期和优先级
{ const tid=await p.evaluate(()=>{const S=window.__tm.S;const t=S.tasks.find(x=>!['done','cancelled'].includes(x.status)&&S.workItems.find(w=>w.id===x.workId).status!=='paused'&&S.workItems.find(w=>w.id===x.workId).status!=='cancelled');return t&&t.id;});
  await p.goto(URL+'#/task/'+tid);await p.waitForTimeout(200);ok(await p.locator('[data-do=taskEdit]').count()===1,'老板在任务详情看到「编辑任务」');
  await p.click('[data-do=taskEdit]');await p.fill('.sheet input[name=due]','2026-12-24');await p.check('.sheet input[name=priority][value=hi]');await sub();await p.waitForTimeout(150);
  ok(await p.evaluate((id)=>{const t=window.__tm.S.tasks.find(x=>x.id===id);return t.due==='2026-12-24'&&t.priority==='hi';},tid),'编辑任务保存成功');
  // 更换项目人员：验收人
  const wid=await p.evaluate((id)=>window.__tm.S.tasks.find(x=>x.id===id).workId,tid);
  await p.goto(URL+'#/work/'+wid);await p.waitForTimeout(200);await p.click('.actions .btn:has-text("更多操作")');await p.click('.sheet [data-do=wReassign]');await p.waitForSelector('.sheet h2:has-text("更换项目人员")');
  const nr=await p.evaluate(()=>{const s=document.querySelector('.sheet select[name=reviewerId]');const o=[...s.options].find(x=>!x.selected);return o&&o.value;});
  await p.selectOption('.sheet select[name=reviewerId]',nr);await sub();await p.waitForTimeout(150);
  ok(await p.evaluate(([w,r])=>window.__tm.S.workItems.find(x=>x.id===w).reviewerId===r,[wid,nr]),'更换验收人成功'); }
console.log(`项目页 E2E 通过 ${pass}，失败 ${fail}`);await b.close();process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1)});
