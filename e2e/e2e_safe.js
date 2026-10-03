// iPhone 安全区回归：Chromium 的 env(safe-area-inset-*) 恒为 0，这里把它替换成 iPhone 真实数值（顶 59 / 底 34）再检查
// 大图页：大图顶到屏幕最上方、标题在状态栏之下；首页铺满整屏；所有页面状态栏区域不是突兀的白条
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const SRC = path.join(__dirname, '..', 'dist', 'team-ops.html'), TOP = 59, BOT = 34;
const html = fs.readFileSync(SRC, 'utf8').replace(/env\(safe-area-inset-top(,\s*0(px)?)?\)/g, TOP + 'px').replace(/env\(safe-area-inset-bottom(,\s*0(px)?)?\)/g, BOT + 'px');
const F = path.join(os.tmpdir(), 'tm-safe-' + process.pid + '.html'); fs.writeFileSync(F, html);
const URL = 'file://' + F;
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.click('.acct:has-text("Enos")'); await p.waitForTimeout(200);
  const HERO = '.hm,.tk2-hero,.wp-hero,.tm-hero,.n-hero,.vr-hero';
  for (const r of ['home', 'ideas', 'tasks', 'work', 'me', 'team', 'new/voice']) {
    await p.goto(URL + '#/' + r); await p.waitForTimeout(200);
    const g = await p.evaluate((H) => { const e = document.querySelector(H); if (!e) return null; const h = e.querySelector('h1'), r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h1: h ? h.getBoundingClientRect().top : null, vh: innerHeight }; }, HERO);
    ok(g && Math.abs(g.top) < 1, `${r} 大图顶到屏幕最上方（top=${g && g.top}）`);
    if (g && g.h1 != null) ok(g.h1 >= TOP, `${r} 标题在状态栏之下（${g.h1}）`);
    if (r === 'home') ok(g.bottom >= g.vh - 1, `首页铺满整屏（bottom=${g.bottom} vh=${g.vh}）`);
  }
  // 详情页：状态栏区域的颜色和页面背景一致（不是 html 的白底）
  for (const r of ['work/W1', 'idea/I2', 'task/T1', 'kb', 'settings']) {
    await p.goto(URL + '#/' + r); await p.waitForTimeout(200);
    const t = await p.evaluate(() => { const e = document.elementFromPoint(195, 20); return e ? e.tagName : ''; });
    const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    ok(t !== 'HTML' || bg === 'rgba(0, 0, 0, 0)', `${r} 状态栏区域跟随页面背景（${t} ${bg}）`);
  }
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  fs.unlinkSync(F);
  console.log(`安全区 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
