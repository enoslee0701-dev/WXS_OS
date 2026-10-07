// 应用内确认面板（askSheet，代替系统对话框）：删除待办、清空录音、重置演示数据——点取消不生效，点确认才生效
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'], permissions: ['microphone'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let sys = 0; p.on('dialog', d => { sys++; d.dismiss(); });
  await p.goto(URL); await p.click('.acct:has-text("Philip")'); await p.waitForTimeout(200);
  const S = () => p.evaluate(() => window.__tm.S);
  // 1. 删除待办
  const mine = (await S()).todos.find(t => t.ownerId === 'u_owner');
  await p.evaluate(() => { location.hash = '#/tasks'; }); await p.waitForTimeout(200);
  await p.click(`[data-do=tdOpen][data-id="${mine.id}"]`); await p.waitForTimeout(250);
  await p.click('[data-do=tdDelete]'); await p.waitForTimeout(250);
  ok((await p.textContent('#layer .sheet h2')) === '删除待办', '删除待办：弹出应用内确认');
  await p.click('#layer .sheet footer button[type=button]'); await p.waitForTimeout(200);
  ok((await S()).todos.some(t => t.id === mine.id) && await p.locator('#layer .sheet').count() === 0, '点取消：待办还在，面板关闭');
  await p.click(`[data-do=tdOpen][data-id="${mine.id}"]`); await p.waitForTimeout(250);
  await p.click('[data-do=tdDelete]'); await p.waitForTimeout(250); await p.click('#layer .sheet footer button[type=submit]'); await p.waitForTimeout(250);
  ok(!(await S()).todos.some(t => t.id === mine.id), '点删除：待办已删除');
  // 2. 清空录音
  await p.evaluate(() => { location.hash = '#/new/voice'; }); await p.waitForTimeout(250);
  ok(await p.locator('.demo-tip [data-do=srvConnect]').count() === 1, '演示模式的录音页：提示这是演示，可一键连接团队服务器');
  await p.fill('[data-cap="vo.text"]', '要点：周二开会'); await p.waitForTimeout(100);
  await p.click('.vr-c[data-do=voCancel]'); await p.waitForTimeout(250);
  ok((await p.textContent('#layer .sheet h2')) === '清空录音', '清空录音：弹出应用内确认');
  await p.click('#layer .sheet footer button[type=button]'); await p.waitForTimeout(200);
  ok((await p.inputValue('[data-cap="vo.text"]')) === '要点：周二开会', '点取消：识别文字还在');
  await p.click('.vr-c[data-do=voCancel]'); await p.waitForTimeout(250); await p.click('#layer .sheet footer button[type=submit]'); await p.waitForTimeout(250);
  ok((await p.inputValue('[data-cap="vo.text"]')) === '', '点清空：识别文字已清空');
  // 3. 重置演示数据（更多设置页）
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(250);
  const n0 = (await S()).todos.length;
  const rb = p.locator('[data-do=reset]').first();
  if (await rb.count()) {
    await rb.click(); await p.waitForTimeout(250);
    ok((await p.textContent('#layer .sheet h2')) === '重置演示数据', '重置：弹出应用内确认');
    await p.click('#layer .sheet footer button[type=submit]'); await p.waitForTimeout(250);
    ok((await S()).todos.length > n0, '点重置：恢复初始示例数据（删掉的待办回来了）');
  } else ok(false, '更多设置页找不到重置按钮');
  ok(sys === 0, '没有弹出系统对话框（' + sys + '）');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`确认面板 E2E 通过 ${pass}，失败 ${fail}`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
