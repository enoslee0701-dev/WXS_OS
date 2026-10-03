const { chromium, devices } = require('playwright');
const URL=(require('./_env').URL);
let pass=0, fail=0; const ok=(c,m)=>{ if(c)pass++; else {fail++; console.log('✗',m);} };
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({...devices['iPhone 13']});
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto(URL);
  const login=async(name)=>{ if(!(await p.locator('.login').count())){ await p.goto(URL.replace(/#.*/,'')+'#/home'); await p.waitForTimeout(80); await p.click('[data-do=switch]'); } await p.click(`.acct:has-text("${name}")`); await p.waitForSelector('.hero, main'); };
  const btn=async(t)=>{ await p.locator('.actions .btn',{hasText:t}).first().click(); };
  const sheetSubmit=async()=>{ await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(120); };
  const toastTxt=async()=> (await p.textContent('#toast'));
  await p.screenshot({path:'shot-login.png'});
  // ---- 黄金路径一：老板录想法 → 直接推进
  await login('Enos');
  await p.screenshot({path:'shot-owner-home.png',fullPage:true});
  ok((await p.textContent('.hm-copy h1')).includes('福音'),'首页极简：标语');
  ok(await p.locator('.hm-card').count()===2,'首页两张卡：记录想法、新建项目');
  ok(await p.locator('.h-stat, .h-todo, .h-proj-card').count()===0,'首页不再堆其他模块');
  await p.goto(URL+'#/me'); ok((await p.textContent('.me-ov[href="#/stat/decide"] strong'))==='1','我的：需要你决策=1'); await p.goto(URL+'#/home');
  await p.click('[data-do=quickIdea]'); await p.click('[data-m=text]'); await p.fill('[data-cap="tx.note"]','最近打印机老卡纸，换一台新的'); await p.click('[data-do=capNext]');
  await p.waitForSelector('.sheet.on'); await sheetSubmit();
  ok((await toastTxt()).includes('已提交'),'提交成功提示');
  ok(await p.locator('.pill',{hasText:'待运营整理'}).count()>0,'状态为待运营整理');
  const ideaUrl=p.url();
  // 运营者认领 + 派发
  await login('林晓');
  await p.goto(ideaUrl); await btn('认领跟进'); ok((await toastTxt()).includes('认领'),'认领成功');
  await btn('派发'); await p.waitForSelector('.sheet.on');
  await p.selectOption('select[name=t_ownerId]','u_admin_ex'); await p.fill('input[name=t_expected]','新打印机照片'); await p.fill('textarea[name=t_criteria]','连续打印 20 页不卡纸');
  await p.screenshot({path:'shot-route.png'});
  await sheetSubmit(); ok(p.url().includes('#/work/'),'派发后跳到事项');
  await p.click('[data-do=wTab][data-t=tasks]'); await p.locator('.list .row').first().click(); const taskUrl=p.url(); ok(taskUrl.includes('#/task/'),'进入任务');
  // 执行者
  await login('周敏'); await p.goto(taskUrl);
  await p.screenshot({path:'shot-task-exec.png',fullPage:true});
  await btn('接收任务'); await btn('开始执行'); await btn('提交成果');
  await p.fill('.sheet textarea[name=note]','已换新，打印 20 页正常'); await sheetSubmit();
  ok(await p.locator('.pill',{hasText:'待验收'}).count()>0,'执行者提交后待验收');
  // 运营者退回再通过
  await login('林晓'); await p.goto(taskUrl);
  await btn('退回'); await sheetSubmit(); ok((await toastTxt()).includes('意见'),'退回无意见被拒并提示');
  await p.fill('.sheet textarea[name=note]','缺打印测试照片'); await sheetSubmit();
  await login('周敏'); await p.goto(taskUrl); await btn('提交成果'); await p.fill('.sheet textarea[name=note]','补照片'); await sheetSubmit();
  await login('林晓'); await p.goto(taskUrl); await btn('验收通过'); await p.fill('.sheet textarea[name=note]','符合标准'); await sheetSubmit();
  ok(await p.locator('.pill',{hasText:'完成'}).count()>0,'任务完成');
  await p.locator('.tx-work').first().click();
  await p.click('.wd-accept [data-do=closeWork]'); await sheetSubmit(); ok(await p.locator('.ws',{hasText:'已完成'}).count()>0,'事项完成');
  // 老板查验 + 纠偏
  await login('Enos'); await p.goto(taskUrl);
  ok(await p.locator('.tx-log .wx-tl li').count()>=6,'老板看到完整操作记录');
  await btn('纠偏'); await p.fill('.sheet textarea[name=reason]','照片模糊，需复查'); await sheetSubmit();
  ok(await p.locator('.pill',{hasText:'进行中'}).count()>0,'撤销验收后回执行中');
  ok(await p.locator('.sug .pill',{hasText:'验收通过'}).count()>0 && await p.locator('.sug .pill',{hasText:'撤销验收'}).count()>0,'原验收记录保留');
  // 老板决策 D1
  await p.goto(URL.replace(/#.*/,'')+'#/idea/I4'); await p.waitForTimeout(100); await btn('做决定'); await sheetSubmit();
  ok(await p.locator('.pill',{hasText:'待运营整理'}).count()>0,'批准后回运营整理');
  // ---- 黄金路径二：共创
  await login('周敏'); await p.goto(URL+'#/idea/I2');
  await p.fill('form[data-form=suggest] textarea','担心内容成本太高，有风险'); await p.click('form[data-form=suggest] button');
  ok(await p.locator('.dz-m').count()>=4,'执行者建议已发出');
  await p.goto(URL+'#/home'); await p.waitForTimeout(100); ok(await p.locator('[data-do=quickIdea]').count()===0 && await p.locator('.hm-card[data-do=hmTasks]').count()===1,'执行者首页不显示记录想法，改为我的待办');
  await login('陈立'); await p.goto(URL+'#/idea/I2'); await btn('结束讨论'); await sheetSubmit();
  ok(await p.locator('.src').count()>3,'汇总带来源引用');
  await p.screenshot({path:'shot-cocreate.png',fullPage:true});
  await btn('确认方向'); await sheetSubmit();
  ok(await p.locator('.pill',{hasText:'待运营整理'}).count()>0,'确认方向后进运营');
  await login('林晓'); await p.goto(URL+'#/idea/I2'); await btn('认领跟进'); await btn('派发');
  ok(await p.locator('input[name=kind][value=product]').isChecked(),'AI 预填产品类');
  await sheetSubmit(); const wUrl=p.url();
  await login('陈立'); await p.goto(wUrl); await btn('新建任务'); await p.waitForTimeout(150);
  await p.fill('[data-as=title]','录制流程原型'); await p.fill('[data-as=desc]','能录能听');
  await p.click('[data-do=asPickOwner]'); await p.check('.sheet input[value=u_design]'); await sheetSubmit();
  await p.click('[data-do=asCreate]'); await p.waitForTimeout(200); await p.click('[data-do=wTab][data-t=tasks]'); ok(await p.locator('.list .row').count()===1,'负责人派出任务');
  for (const st of ['prototype','ui_review','dev']) { await btn('更多操作'); await p.click('.sheet [data-do=stage]'); await p.check(`.sheet input[value=${st}]`); await sheetSubmit(); }
  ok(await p.locator('.wx-chips i',{hasText:'开发阶段'}).count()===1,'推进到开发阶段');
  // ---- 权限：管理员
  await login('孙磊'); await p.goto(URL+'#/ideas'); ok(await p.locator('.row').count()===0,'管理员看不到想法');
  await p.goto(URL+'#/idea/I3'); await p.waitForTimeout(100); ok(p.url().endsWith('#/home') && !(await p.textContent('#app')).includes('I3'),'管理员打不开老板草稿（送回首页）');
  ok(await p.locator('.tabs a:has-text("想法")').count()===0 && await p.locator('.tabs a:has-text("项目")').count()===0,'管理员底部没有想法、项目标签');
  ok(await p.locator('.hm-card[data-do=hmTeam]').count()===1 && await p.locator('.hm-card[data-do=hmKB]').count()===1,'管理员首页：成员与账号、AI 知识库');
  // 设置开关
  await login('Enos'); await p.goto(URL+'#/me'); await p.locator('input[data-set=ownerFinalAdmin]').evaluate(e=>e.click());
  await p.waitForTimeout(100); ok(await p.evaluate(()=>window.__tm.S.settings.ownerFinalAdmin)===true,'C1 开关生效');
  await p.screenshot({path:'shot-settings.png',fullPage:true});
  // 持久化
  await p.reload(); ok(await p.evaluate(()=>window.__tm.S.settings.ownerFinalAdmin)===true,'刷新后数据仍在');
  // 暗色
  const dc=await b.newContext({...devices['iPhone 13'],colorScheme:'dark'}); const dp=await dc.newPage(); await dp.goto(URL); await dp.click('.acct:has-text("林晓")'); await dp.screenshot({path:'shot-dark.png'});
  // 横向溢出检查
  for (const r of ['#/home','#/ideas','#/work','#/idea/I1','#/task/T3','#/me']) { await p.goto(URL+r); const ov=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1); ok(!ov,'无横向溢出 '+r); }
  ok(errs.length===0,'控制台无报错: '+errs.join(' | '));
  console.log(`E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
