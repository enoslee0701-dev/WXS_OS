const { chromium, devices } = require('playwright');
const URL=(require('./_env').URL);
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('✗',m);}};
(async()=>{const b=await chromium.launch();const c=await b.newContext({...devices['iPhone 13']});
await c.route(/fonts\.(googleapis|gstatic)\.com/, r=>r.fulfill({status:200,contentType:'text/css',body:''}));
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const sub=async()=>{await p.click('.sheet footer button[type=submit]');await p.waitForTimeout(150);};
await p.goto(URL);await p.click('.acct:has-text("Enos")');await p.goto(URL+'#/me');await p.waitForTimeout(100);
const homeN={};for(const k of ['decide','notif','due','rate']) homeN[k]=(await p.textContent(`a.me-ov[href="#/stat/${k}"] strong`)).trim();
console.log('首页数字',JSON.stringify(homeN));
// 1 决策
await p.click('a.me-ov[href="#/stat/decide"]');await p.waitForTimeout(150);
ok((await p.textContent('.s-hero b')).trim()===homeN.decide,'决策页数字与首页一致');
ok(await p.locator('.s-dec').count()===1 && await p.locator('.s-rel li').count()>=1,'待决策卡含相关信息');
ok(await p.locator('.s-hrow').count()===3,'历史决策 3 条');
await p.screenshot({path:'s1.png',fullPage:true});
await p.click('.s-dec [data-do=decide]');await p.waitForSelector('.sheet h2:has-text("老板决策")');await sub();
ok(await p.locator('.s-dec').count()===0 && (await p.textContent('.s-hist')).includes('（4）'),'决策后移入历史');
await p.click('[data-do=sDecTab][data-t=done]');ok(await p.locator('.s-hrow').count()===4,'已处理页签');
// 2 通知
await p.goto(URL+'#/me');await p.waitForTimeout(100);const nN=(await p.textContent('a.me-ov[href="#/stat/notif"] strong')).trim();
await p.click('a.me-ov[href="#/stat/notif"]');await p.waitForTimeout(150);
ok((await p.textContent('.s-hero b')).trim()===nN,'通知页数字与首页一致');
await p.click('[data-do=sNotif][data-f=at]');ok(await p.locator('.s-noti').count()===1 && (await p.textContent('.s-noti')).includes('@Enos'),'@我 分类');
await p.screenshot({path:'s2.png',fullPage:true});
await p.click('[data-do=sNotif][data-f=all]');const before=await p.locator('.s-noti').count();
await p.locator('.s-noti').first().click();await p.waitForTimeout(150);await p.goto(URL+'#/stat/notif');await p.waitForTimeout(100);
ok(await p.locator('.s-noti').count()===before-1,'点开后变为已读');
// 3 今天到期
await p.goto(URL+'#/me');await p.waitForTimeout(100);const dN=(await p.textContent('a.me-ov[href="#/stat/due"] strong')).trim();
await p.click('a.me-ov[href="#/stat/due"]');await p.waitForTimeout(150);
ok((await p.textContent('.s-hero b')).trim()===dN && await p.locator('.s-due').count()===+dN,'到期页数字与列表、首页一致');
await p.screenshot({path:'s3.png',fullPage:true});
await p.locator('.s-due [data-do=tdToggle]').first().click();await p.waitForTimeout(120);ok(await p.locator('.s-due').count()===+dN-1,'勾选完成后移出');
await p.click('[data-do=sDue][data-f=ms]');ok((await p.textContent('main')).includes('今天没有到期'),'里程碑分类');
await p.click('[data-do=sDueNew]');ok(p.url().includes('#/assign'),'新建任务');
// 4 完成率
await p.goto(URL+'#/me');await p.waitForTimeout(100);const rN=(await p.textContent('a.me-ov[href="#/stat/rate"] strong')).trim();
await p.click('a.me-ov[href="#/stat/rate"]');await p.waitForTimeout(150);
ok((await p.textContent('.s-hero b')).trim()===rN,'完成率与首页一致 '+rN);
ok(await p.locator('.s-bars > div').count()===7 && await p.locator('.s-prow').count()>=3 && await p.locator('.s-line circle').count()>=1,'柱图、项目统计、折线');
await p.screenshot({path:'s4.png',fullPage:true});
await p.selectOption('[data-speriod]','1');await p.waitForTimeout(120);ok((await p.textContent('.s-hero > div > span'))==='上周完成率','切换上周');
// 非老板
await p.goto(URL+'#/home');await p.click('[data-do=switch]');await p.click('.acct:has-text("林晓")');await p.goto(URL+'#/me');await p.waitForTimeout(100);await p.click('a.me-ov[href="#/stat/decide"]');await p.waitForTimeout(120);
ok((await p.textContent('.s-head h1'))==='等你处理','运营者看到「等你处理」');
// 执行者有受阻且逾期的任务：首页不能说「都处理完了」，今天到期页列出逾期任务
await p.goto(URL+'#/home');await p.click('[data-do=switch]');await p.click('.acct:has-text("周敏")');await p.waitForTimeout(150);
await p.evaluate(()=>{const S=window.__tm.S,t=S.tasks.find(x=>x.ownerId==='u_admin_ex'&&!['done','cancelled'].includes(x.status));t.status='blocked';const d=new Date();d.setDate(d.getDate()-1);t.due=d.toISOString().slice(0,10);});
await p.goto(URL+'#/me');await p.goto(URL+'#/home');await p.waitForTimeout(150);
ok(!(await p.textContent('.hm-cards')).includes('都处理完了'),'执行者有受阻逾期任务时首页不说「都处理完了」：'+(await p.textContent('.hm-cards')).replace(/\s+/g,' ').slice(0,60));
await p.goto(URL+'#/stat/due');await p.waitForTimeout(150);ok((await p.textContent('main')).includes('已逾期'),'今天到期页列出已逾期的任务');
ok(errs.length===0,'无报错 '+errs.join('|'));
console.log(`数据卡 E2E 通过 ${pass}，失败 ${fail}`);await b.close();process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1)});
