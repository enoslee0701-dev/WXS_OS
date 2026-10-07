// 返回检查：每个角色 × 每个页面 × 页面上每个会跳到别的页面的按钮。
// 从 A 点进 B 后，点 B 页面左上角的返回（或手机返回键），必须回到 A，而不是首页或别的页面。
// 用法：node e2e/crawl_back.js [角色名...]
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0, tried = 0; const bad = [];
const ROLES = process.argv.slice(2).length ? process.argv.slice(2) : ['Philip', '林晓', '陈立', '周敏', '孙磊'];
const ROUTES = ['home', 'ideas', 'tasks', 'work', 'me', 'team', 'inbox', 'kb', 'settings', 'work/W1', 'work/W2', 'idea/I2', 'idea/I4', 'task/T1', 'task/T3', 'stat/decide', 'stat/due', 'stat/rate', 'stat/notif', 'new', 'project', 'todo/new'];
const SKIP = /^(switch|reset|clearDemo|demoStart|srvLogout|srvLocal|srvConnect|login|demoChoose|back|pBack|closeSheet|demoExit)$/;
const BACK = '[data-do=back]:visible, [data-do=pBack]:visible, [aria-label="返回"]:visible';
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss().catch(() => {}));
  const hash = () => p.evaluate(() => location.hash);
  for (const who of ROLES) {
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.click(`.acct:has-text("${who}")`); await p.waitForTimeout(100);
    const snap = await p.evaluate(() => JSON.stringify({ s: localStorage.getItem('tm_demo_v3'), u: localStorage.getItem('tm_user_v3') }));
    // 每次都从首页正常点进来（有真实的浏览历史），不是直接打开网址
    const open = async (r) => {
      await p.evaluate((x) => { const o = JSON.parse(x); localStorage.clear(); if (o.s) localStorage.setItem('tm_demo_v3', o.s); localStorage.setItem('tm_user_v3', o.u); }, snap);
      await p.goto(URL + '#/home'); await p.reload(); await p.waitForTimeout(60);
      if (r !== 'home') { await p.evaluate((h) => { location.hash = h; }, '#/' + r); await p.waitForTimeout(80); }
      return (await hash()) === '#/' + r;
    };
    for (const r of ROUTES) {
      if (!(await open(r))) continue;
      const list = await p.$$eval('[data-do], a[href^="#/"]', xs => xs.filter(x => { const q = x.getBoundingClientRect(); return q.width && q.height && !x.closest('.dock'); }).map((x, i) => ({ i, d: x.dataset.do || ('a:' + x.getAttribute('href')) })));
      for (const it of list) {
        if (SKIP.test(it.d)) continue;
        await open(r);
        const el = p.locator('[data-do], a[href^="#/"]').filter({ visible: true }).nth(it.i);
        const before = await hash();
        try { await el.click({ timeout: 1200, force: true }); } catch (e) { continue; }
        await p.waitForTimeout(120);
        const after = await hash();
        if (after === before || await p.locator('#layer .sheet').count()) continue; // 没跳页面（或弹出了面板）
        const back = p.locator(BACK).first();
        if (!(await back.count())) continue; // 根页面（底部标签页）没有返回键
        tried++;
        await back.click({ force: true }); await p.waitForTimeout(150);
        const end = await hash();
        if (end === before) pass++;
        else { fail++; bad.push(`${who}｜${before} 点「${it.d}」到 ${after}，返回后到了 ${end}`); }
        // 手机返回键（history.back）也要回到原页
        await open(r);
        try { await p.locator('[data-do], a[href^="#/"]').filter({ visible: true }).nth(it.i).click({ timeout: 1200, force: true }); } catch (e) { continue; }
        await p.waitForTimeout(120);
        if ((await hash()) !== after) continue;
        await p.goBack(); await p.waitForTimeout(150);
        const end2 = await hash();
        if (end2 === before) pass++;
        else { fail++; bad.push(`${who}｜${before} 点「${it.d}」到 ${after}，按手机返回键后到了 ${end2}`); }
      }
    }
  }
  [...new Set(bad)].forEach(m => console.log('✗ ' + m));
  if (errs.length) { fail++; console.log('✗ 报错：' + [...new Set(errs)].slice(0, 5).join(' | ')); }
  console.log(`返回检查：试了 ${tried} 条路径`);
  console.log(`返回检查 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
