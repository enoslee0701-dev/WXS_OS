// 任务交付物带照片 / 文件：执行人提交时选照片，任务页显示缩略图，点开能看；只有照片没写说明也能提交
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.click('.acct:has-text("Philip")'); await p.waitForTimeout(200);
  // 找一个执行中的任务，切到它的负责人
  const t = await p.evaluate(() => { const t = window.__tm.S.tasks.find(x => x.status === 'in_progress'); window.__tm.as(t.ownerId); return { id: t.id, owner: t.ownerId }; });
  await p.evaluate((h) => { location.hash = h; }, '#/task/' + t.id); await p.waitForTimeout(300);
  await p.click('.actions [data-do=submit]'); await p.waitForSelector('#layer .sheet.on');
  ok(await p.locator('#layer input[data-dvfile][capture]').count() === 1 && await p.locator('#layer input[data-dvfile][multiple]').count() === 1, '提交面板有「拍照」和「选照片或文件」');
  await p.setInputFiles('#layer input[data-dvfile][multiple]', [path.join(__dirname, 'fixtures', 'pic.jpg'), path.join(__dirname, 'fixtures', 'plan.pdf')]);
  await p.waitForTimeout(200);
  ok(await p.locator('#dv-files .dv-f').count() === 2 && await p.locator('#dv-files .dv-f img').count() === 1, '选了 1 张照片 1 个 PDF：照片有缩略图');
  await p.click('#dv-files [data-do=dvRm][data-i="1"]'); await p.waitForTimeout(100);
  ok(await p.locator('#dv-files .dv-f').count() === 1, '可以移除选错的文件');
  await p.click('#layer .sheet footer button[type=submit]'); await p.waitForTimeout(300);
  const dv = await p.evaluate((id) => window.__tm.S.deliverables.filter(x => x.taskId === id).pop(), t.id);
  ok(dv && dv.media.length === 1 && dv.media[0].kind === 'image' && dv.note === '', '只带照片也能提交成果');
  ok(await p.evaluate((id) => window.__tm.S.tasks.find(x => x.id === id).status, t.id) === 'submitted', '任务进入待验收');
  ok(await p.locator('.dv-th img').count() >= 1, '任务页显示交付照片缩略图');
  await p.click('.dv-th'); await p.waitForSelector('#layer .sheet.on img');
  ok(true, '点缩略图看大图');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`交付物附件 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
