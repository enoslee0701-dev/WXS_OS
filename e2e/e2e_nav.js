// 返回逻辑：从哪里进来就回到哪里；提交表单后，表单页不留在返回路径里；手机返回键（Android）先关弹窗、再返回、标签页先回首页
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const h = () => p.evaluate(() => location.hash), w = (t) => p.waitForTimeout(t || 200), go = (x) => p.evaluate((y) => { location.hash = y; }, x);
  await p.goto(URL); await p.click('.acct:has-text("Enos")'); await w();
  // 1. 项目页 → 新建项目 → 返回：回项目页（以前回首页）
  await p.click('.tabs a:has-text("项目")'); await w(); await go('#/project'); await w();
  await p.click('[data-do=pBack]'); await w();
  ok(await h() === '#/work', '项目页进新建项目，返回回到项目页：' + await h());
  // 2. 项目详情 → 分配任务 → 返回：回项目详情
  await go('#/work/W1'); await w(); await p.click('[data-do=goAssignWork]'); await w();
  ok((await h()).startsWith('#/assign'), '进入分配任务');
  await p.click('[data-do=pBack]'); await w();
  ok(await h() === '#/work/W1', '分配任务返回回到项目详情：' + await h());
  // 3. 提交想法后：结果页按返回，回到开始记录前的页面（首页），不是已清空的表单
  await go('#/home'); await w(); await go('#/new'); await w(); await p.click('[data-m=text]'); await w();
  await p.fill('[data-cap="tx.note"]', '返回测试的想法'); await p.fill('[data-cap="tx.title"]', '返回测试');
  await p.click('[data-do=capNext][data-k=tx]'); await p.waitForSelector('.sheet.on'); await p.click('.sheet footer button[type=button]'); await w(900);
  ok((await h()).startsWith('#/idea/'), '存为草稿后到想法详情');
  await p.click('[data-do=back] >> visible=true'); await w(300);
  ok(await h() === '#/home', '想法详情返回回到首页（表单页已从返回路径去掉）：' + await h());
  // 4. 任务页 → 新建待办 → 手动创建 → 保存：回任务页；再按返回不会回到表单
  await p.click('.tabs a:has-text("任务")'); await w(); await p.click('.t-fab'); await w(); await p.click('.t-tgrid [data-t=meeting]'); await w();
  ok(await h() === '#/todo/new/manual', '进入手动创建待办');
  await p.click('[data-do=pBack]'); await w();
  ok(await h() === '#/todo/new', '手动创建返回回到新建待办：' + await h());
  await p.click('.t-tgrid [data-t=meeting]'); await w(); await p.fill('[data-tf=title]', '会议纪要：返回测试'); await p.click('[data-do=tfSave]'); await w(900);
  ok(await h() === '#/tasks', '保存待办后回到任务页：' + await h());
  await p.goBack(); await w(300);
  ok(!(await h()).startsWith('#/todo'), '保存后按返回不会回到待办表单：' + await h());
  // 5. 重新打开 App 后直接在深层页面：返回到上一级，不是首页
  await p.goto(URL + '#/assign/W2'); await p.reload(); await w(300);
  await p.click('[data-do=pBack]'); await w();
  ok(await h() === '#/work/W2', '没有来源页时回到上一级（分配任务 → 项目详情）：' + await h());
  await p.goto(URL + '#/task/T1'); await p.reload(); await w(300);
  await p.click('[data-do=back] >> visible=true'); await w();
  ok(await h() === '#/tasks', '没有来源页时：任务详情 → 任务页：' + await h());
  // 6. 手机返回键（Android）
  const back = () => p.evaluate(() => window.__tm.back());
  await p.click('.tabs a:has-text("我的")'); await w(); await p.click('[data-do=meEdit][data-k=email]'); await w(300);
  ok(await back() === true && await p.locator('#layer .sheet').count() === 0 && await h() === '#/me', '返回键先关弹窗，不离开页面');
  ok(await back() === true && (await w(), await h()) === '#/home', '在标签页按返回键先回首页');
  ok(await back() === true && (await p.textContent('#toast')).includes('再按一次退出'), '在首页按返回键：先提示「再按一次退出」');
  ok(await back() === false, '2 秒内再按：退出 App');
  await go('#/idea/I2'); await w(); ok(await back() === true && (await w(), await h()) === '#/home', '详情页按返回键回到上一页');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`返回逻辑 E2E 通过 ${pass}，失败 ${fail}`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
