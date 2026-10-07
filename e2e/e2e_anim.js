// 页面切换动画：进入下一级 push、返回 pop、切换底部标签 fade；弹窗关闭有收起动画；动画结束后状态清干净
// 自动化测试里动画默认关闭，这里用 window.__tmAnim = true 强制打开
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await c.addInitScript(() => {
    window.__tmAnim = true; window.__navLog = [];
    // 记下每次切换时 <html data-nav> 的值
    new MutationObserver(() => { const v = document.documentElement.getAttribute('data-nav'); if (v) window.__navLog.push(v); }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-nav'] });
  });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.click('.acct:has-text("Philip")'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => typeof document.startViewTransition === 'function'), '浏览器支持 View Transitions');
  const last = () => p.evaluate(() => window.__navLog[window.__navLog.length - 1]);
  const settle = () => p.waitForTimeout(500);
  // 切换底部标签：淡入淡出
  await p.click('.tabs a:has-text("想法")'); await settle();
  ok(await last() === 'fade' && p.url().endsWith('#/ideas'), '切换标签：fade');
  ok(await p.evaluate(() => !document.documentElement.hasAttribute('data-nav')), '动画结束后清掉 data-nav');
  // 进入详情：push
  const id = await p.evaluate(() => window.__tm.S.ideas.find(d => d.status !== 'draft' && !d.deleted).id);
  await p.evaluate(h => { location.hash = h; }, '#/idea/' + id); await settle();
  ok(await last() === 'push' && await p.locator('.ix2, main').count() > 0, '进入想法详情：push');
  // 返回：pop
  await p.click('[data-do=back]'); await settle();
  ok(await last() === 'pop' && p.url().endsWith('#/ideas'), '返回：pop ' + p.url());
  // 多级进入后直接点底部标签回到根页：按返回方向
  await p.evaluate(h => { location.hash = h; }, '#/idea/' + id); await settle();
  await p.evaluate(() => { location.hash = '#/new'; }); await settle();
  await p.evaluate(() => { location.hash = '#/new/text'; }); await settle();
  ok(await last() === 'push', '再进一级：push');
  await p.evaluate(() => { location.hash = '#/home'; }); await settle();
  ok(await last() === 'pop', '从深层回到首页：pop');
  // 页面内容正确、可以继续操作
  ok(await p.locator('.hm-card').count() > 0, '动画后首页正常显示');
  // 弹窗：关闭后原层立即清空，收起动画结束后动画层也清空
  await p.click('.tabs a:has-text("我的")'); await settle();
  await p.click('[data-do=meEdit][data-k=email]'); await p.waitForTimeout(350);
  ok(await p.locator('#layer .sheet.on').count() === 1, '弹窗打开');
  await p.click('.sheet header .circle');
  ok(await p.locator('#layer .sheet').count() === 0 && await p.locator('#layer-out .sheet').count() === 1, '关闭：原层清空，收起动画层接管');
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('layer-out')).pointerEvents) === 'none', '收起动画层不挡点击');
  await p.waitForTimeout(400);
  ok(await p.locator('#layer-out *').count() === 0, '收起动画结束后清空');
  // 关闭后马上打开另一个弹窗：不受影响
  await p.click('[data-do=meEdit][data-k=email]'); await p.waitForTimeout(50); await p.click('.sheet header .circle'); await p.click('[data-do=meEdit][data-k=email]'); await p.waitForTimeout(350);
  ok(await p.locator('#layer .sheet.on').count() === 1, '连续关闭再打开弹窗正常');
  // 系统要求减少动态效果时：不播放动画
  const c2 = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  await c2.addInitScript(() => { window.__tmAnim = true; window.__navN = 0; new MutationObserver(() => { if (document.documentElement.hasAttribute('data-nav')) window.__navN++; }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-nav'] }); });
  const p2 = await c2.newPage(); await p2.goto(URL); await p2.click('.acct:has-text("Philip")'); await p2.click('.tabs a:has-text("想法")'); await p2.waitForTimeout(300);
  ok(await p2.evaluate(() => window.__navN) === 0 && p2.url().endsWith('#/ideas'), '减少动态效果：不播放切换动画');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`页面动画 E2E 通过 ${pass}，失败 ${fail}`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
