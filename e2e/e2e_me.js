const { chromium, devices } = require('playwright');
const URL=(require('./_env').URL);
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('✗',m);}};
(async()=>{const b=await chromium.launch();const c=await b.newContext({...devices['iPhone 13']});
await c.route(/fonts\.(googleapis|gstatic)\.com/, r=>r.fulfill({status:200,contentType:'text/css',body:''}));
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const toast=async()=>p.textContent('#toast');const sub=async()=>{await p.click('.sheet footer button[type=submit]');await p.waitForTimeout(150);};
await p.goto(URL);await p.click('.acct:has-text("Enos")');await p.click('.tabs a:has-text("我的")');await p.waitForTimeout(150);
ok((await p.textContent('.tk2-top h1'))==='我的','我的页');
await p.click('[data-do=meAbout]');await p.waitForTimeout(200);ok((await p.textContent('#layer .sheet')).includes('演示模式')&&!(await p.textContent('#layer .sheet')).includes('Supabase'),'关于：显示当前模式，不再有过时说明');await p.click('#layer .sheet footer button[type=submit]');await p.waitForTimeout(150);
ok((await p.textContent('.me-badge')).includes('老板') && (await p.textContent('.me-meta')).includes('清迈'),'资料卡：老板、所在地');
ok(await p.locator('.me-stats .tm-stat').count()===4,'4 个统计');
await p.screenshot({path:'me.png',fullPage:true});
await p.selectOption('[data-set=ownerApprovalMode]','all');await p.waitForTimeout(120);ok(await p.evaluate(()=>window.__tm.S.settings.ownerApprovalMode)==='all','C2 切换');
await p.selectOption('[data-set=ownerApprovalMode]','exceptions_only');
await p.locator('[data-set=ownerFinalAdmin]').evaluate(e=>e.click());await p.waitForTimeout(100);ok(await p.evaluate(()=>window.__tm.S.settings.ownerFinalAdmin)===true,'C1 开关');
await p.click('[data-do=notifSet]');await p.waitForSelector('.sheet input[name=c_cmt]');await p.uncheck('.sheet input[name=c_cmt]');ok(await p.locator('.sheet input[name=push]').isDisabled(),'演示版不能开推送（开关置灰）');await p.check('.sheet input[name=quietOn]');await p.click('.sheet footer button[type=submit]');await p.waitForTimeout(150);
ok(await p.evaluate(()=>{const pr=window.__tm.S.users.find(u=>u.id==='u_owner').prefs;return pr.mute.includes('cmt')&&pr.quietOn&&pr.quietFrom==='22:00';}),'通知设置：静音留言类、开免打扰');
await p.click('[data-do=meEdit][data-k=email]');await p.fill('.sheet input[name=v]','bad');await sub();ok((await toast()).includes('邮箱'),'邮箱校验');
await p.fill('.sheet input[name=v]','enos@team.org');await sub();ok((await p.textContent('.me-sec')).length>0 && (await p.locator('.me-info',{hasText:'邮箱'}).textContent()).includes('enos@team.org'),'改邮箱');
await p.click('.me-round[href="#/settings"]');await p.waitForTimeout(120);ok(p.url().endsWith('#/settings') && await p.locator('[data-set=staleDays]').count()===1,'更多设置页');
await p.goto(URL+'#/me');await p.click('[data-do=switch]');await p.click('.acct:has-text("周敏")');await p.click('.tabs a:has-text("我的")');await p.waitForTimeout(120);
ok((await p.textContent('.me-badge')).includes('执行者') && await p.locator('[data-set=ownerFinalAdmin]').count()===0 && await p.locator('[data-do=notifSet]').count()===1,'执行者不显示流程开关，只保留个人通知设置');
ok(await p.locator('a[href="#/settings"]').count()===0,'执行者没有更多设置入口');
await p.goto(URL+'#/settings');await p.waitForTimeout(100);ok(p.url().endsWith('#/me'),'执行者打开设置被送回我的');
ok(await p.locator('[data-do=meEdit][data-k=name]').count()===0,'执行者不能改姓名');
// 使用帮助：按角色说明
await p.goto(URL+'#/me');await p.waitForTimeout(100);await p.click('[data-do=meHelp]');await p.waitForSelector('.sheet .hp-h');
ok((await p.textContent('.sheet')).includes('你的角色')&&(await p.textContent('.sheet')).includes('常见问题'),'我的 → 使用帮助');await p.click('.sheet footer button[type=submit]');await p.waitForTimeout(100);
// 报表导出（老板）：任务表、项目表是 CSV，带 BOM，有表头和数据
await p.goto(URL+'#/home');await p.click('[data-do=switch]');await p.click('.acct:has-text("Enos")');await p.goto(URL+'#/settings');await p.waitForTimeout(150);
{ const fs=require('fs');const [d1]=await Promise.all([p.waitForEvent('download'),p.click('[data-do=csvTasks]')]);const t1=fs.readFileSync(await d1.path(),'utf8');
  ok(/^任务表-.*\.csv$/.test(d1.suggestedFilename())&&t1.charCodeAt(0)===0xFEFF&&t1.includes('任务,所属项目,状态')&&t1.split('\r\n').length>3,'导出任务表 CSV');
  const [d2]=await Promise.all([p.waitForEvent('download'),p.click('[data-do=csvWorks]')]);const t2=fs.readFileSync(await d2.path(),'utf8');
  ok(t2.includes('项目,类型,状态')&&t2.split('\r\n').length>2,'导出项目表 CSV'); }
// 全部文件：我的 → 全部文件，按类型筛选、按名字搜
await p.goto(URL+'#/me');await p.waitForTimeout(100);await p.click('a[href="#/files"]');await p.waitForTimeout(150);
{ const n=await p.locator('.fl-list .row').count();ok(n>=1&&(await p.textContent('main')).includes('全部文件'),'全部文件列出附件 '+n);
  await p.click('[data-do=flKind][data-k=img]');await p.waitForTimeout(80);const ni=await p.locator('.fl-list .row').count();
  await p.click('[data-do=flKind][data-k=all]');await p.fill('#flq','不存在的文件名xyz');await p.waitForTimeout(400);ok(await p.locator('.fl-list .row').count()===0&&ni<=n,'按类型筛选、按名字搜');await p.fill('#flq','');await p.waitForTimeout(300); }
// 字体大小：特大 → 页面按比例放大；切回标准恢复设计图尺寸；刷新后仍记得
await p.goto(URL+'#/me');await p.waitForTimeout(150);await p.evaluate(()=>document.querySelector('[data-do=fsSet][data-v=xl]').click());await p.waitForTimeout(150);
ok(await p.evaluate(()=>document.documentElement.classList.contains('fs-xl')&&getComputedStyle(document.querySelector('main')).zoom==='1'),'字体特大：页面放大');
await p.reload();await p.waitForTimeout(400);ok(await p.evaluate(()=>document.documentElement.classList.contains('fs-xl')),'刷新后仍是特大');
await p.evaluate(()=>document.querySelector('[data-do=fsSet][data-v=""]').click());await p.waitForTimeout(150);ok(await p.evaluate(()=>!document.documentElement.classList.contains('fs-xl')&&getComputedStyle(document.querySelector('main')).zoom==='0.8'),'切回标准');
ok(errs.length===0,'无报错 '+errs.join('|'));
console.log(`我的 E2E 通过 ${pass}，失败 ${fail}`);await b.close();process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1)});
