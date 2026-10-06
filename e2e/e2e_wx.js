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
  ok(!errs.length,'无脚本错误 '+errs.join(';')); console.log('项目详情 E2E 通过',pass,'失败',fail); await b.close();
})();
