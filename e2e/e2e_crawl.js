// 界面爬虫：5 个角色 × 主要页面 × 页面上每一个可点的按钮，逐个点一遍（每次重新加载），不能有任何脚本报错
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0, clicks = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const ROLES = ['Enos', '林晓', '陈立', '何静', '孙磊'];
const ROUTES = ['home', 'ideas', 'tasks', 'work', 'me', 'team', 'inbox', 'kb', 'settings', 'work/W1', 'work/W2', 'idea/I2', 'idea/I4', 'task/T1', 'task/T3', 'stat/decide', 'stat/due', 'stat/rate', 'stat/notif', 'new', 'project', 'todo/new'];
// 会改变登录身份或清空数据的按钮不点（另有专门测试）
const SKIP = /^(switch|reset|clearDemo|demoStart|srvLogout|srvLocal|srvConnect|login|demoChoose)$/;
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); let errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss().catch(() => {}));
  for (const who of ROLES) {
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.click(`.acct:has-text("${who}")`); await p.waitForTimeout(100);
    const snap = await p.evaluate(() => JSON.stringify({ s: localStorage.getItem('tm_demo_v3'), u: localStorage.getItem('tm_user_v3') }));
    const restore = async () => { await p.evaluate((x) => { const o = JSON.parse(x); localStorage.clear(); if (o.s) localStorage.setItem('tm_demo_v3', o.s); localStorage.setItem('tm_user_v3', o.u); }, snap); };
    for (const r of ROUTES) {
      await restore(); await p.goto(URL + '#/' + r); await p.reload(); await p.waitForTimeout(80);
      if (!p.url().endsWith('#/' + r)) continue; // 这个角色进不了（被送回），跳过
      const list = await p.$$eval('[data-do]', xs => xs.filter(x => { const r = x.getBoundingClientRect(); return r.width && r.height; }).map((x, i) => ({ i, d: x.dataset.do })));
      for (const it of list) {
        if (SKIP.test(it.d)) continue;
        await restore(); await p.goto(URL + '#/' + r); await p.reload(); await p.waitForTimeout(60);
        errs = [];
        const el = p.locator('[data-do]').filter({ visible: true }).nth(it.i);
        try { await el.click({ timeout: 1500, force: true }); clicks++; } catch (e) { continue; }
        await p.waitForTimeout(120);
        // 弹出的面板里再点一层（选项、确认按钮之外的）
        const inner = await p.$$eval('#layer [data-do]', xs => xs.filter(x => x.getBoundingClientRect().width).map(x => x.dataset.do).filter(d => d !== 'closeSheet')).catch(() => []);
        for (let k = 0; k < Math.min(inner.length, 3); k++) { if (SKIP.test(inner[k])) continue; try { await p.locator('#layer [data-do="' + inner[k] + '"]').first().click({ timeout: 800, force: true }); clicks++; await p.waitForTimeout(80); } catch (e) {} }
        if (errs.length) ok(false, `${who} ${r} 点「${it.d}」报错：${[...new Set(errs)].join(' | ').slice(0, 200)}`); else pass++;
      }
    }
  }
  console.log(`界面爬虫：点了 ${clicks} 次`);
  console.log(`界面爬虫 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
