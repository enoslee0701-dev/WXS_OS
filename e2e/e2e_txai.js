const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('✗',m));};
  await p.goto((require('./_env').URL));
  // 用户截图中已被污染的草稿
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('tm_user_v3','u_owner'); localStorage.setItem('tm_txdraft', JSON.stringify({title:'',note:'【要点】。\n1. 1. 1. 1. 1. 1. 明年我们可能需要再招两名开发，现在项目越来越多，一个人开发有点跟不上。\n2. 2. 2. 2. 2. 2. 我的想法是最好一个前端一个后端，但也要考虑预算。\n3. 3. 3. 3. 3. 3. 现在还没确定什么时候招，也不知道是全职还是兼职比较合适。',tags:[],ai:true})); });
  await p.goto((require('./_env').URL+'#/new/text')); await p.reload(); await p.waitForTimeout(400);
  const v = () => p.inputValue('[data-cap="tx.note"]');
  for (let i=0;i<4;i++){ await p.click('[data-do=txPoints]'); await p.waitForTimeout(80); }
  let a = await v(); ok(!/\d\. \d\./.test(a), '无重复编号'); ok((a.match(/【要点】/g)||[]).length===1, '只有一个要点块');
  for (let i=0;i<4;i++){ await p.click('[data-do=txPolish]'); await p.waitForTimeout(80); }
  let b2 = await v(); ok(!/。。|】。/.test(b2), '无重复标点'); ok((b2.match(/【要点】/g)||[]).length===1,'润色后仍一个要点块');
  for (let i=0;i<3;i++){ await p.click('[data-do=txPoints]'); await p.click('[data-do=txPolish]'); }
  ok(await v()===b2, '反复点击结果稳定');
  console.log(b2);
  ok(await p.isVisible('.cx-undo'), '出现撤销按钮');
  while (await p.isVisible('.cx-undo')) { await p.click('.cx-undo'); await p.waitForTimeout(60); }
  ok((await v()).startsWith('【要点】。\n1. 1. 1.'), '可撤销回原文');
  await p.click('[data-do=txPoints]'); await p.fill('[data-cap="tx.note"]', '手写内容'); ok(!(await p.isVisible('.cx-undo')), '手动编辑后撤销清空');
  await p.screenshot({path:'txai.png'});
  ok(!errs.length,'无脚本错误 '+errs.join(';')); console.log('通过',pass,'失败',fail); await b.close();
})();
