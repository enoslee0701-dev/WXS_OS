// 按角色区分界面：每个账号只看到自己用得上的入口；点任何看得到的入口都不会被「没有权限」挡回
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const DENY = /只有|没有权限|不能|无权/;
const EXPECT = {
  Enos: { cards: ['quickIdea', 'quickProject'], tabs: ['首页', '想法', '任务', '项目', '我的'] },
  林晓: { cards: ['hmTriage', 'quickProject'], tabs: ['首页', '想法', '任务', '项目', '我的'] },
  陈立: { cards: ['quickIdea', 'quickProject'], tabs: ['首页', '想法', '任务', '项目', '我的'] },
  周敏: { cards: ['hmTasks', 'hmTodo'], tabs: ['首页', '想法', '任务', '项目', '我的'] },
  何静: { cards: ['hmTasks', 'hmTodo'], tabs: ['首页', '想法', '任务', '项目', '我的'] },
  刘洋: { cards: ['hmTasks', 'hmTodo'], tabs: ['首页', '想法', '任务', '项目', '我的'] },
  孙磊: { cards: ['hmTeam', 'hmKB'], tabs: ['首页', '任务', '我的'] }
};
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // 记录所有出现过的提示
  await p.addInitScript(() => { window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('toast'); if (t && t.textContent) window.__toasts.push(t.textContent); }).observe(document, { subtree: true, childList: true, characterData: true }); });
  const denied = async () => (await p.evaluate(() => window.__toasts.splice(0))).filter(t => DENY.test(t));
  const login = async (n) => { await p.goto(URL + '#/home'); await p.evaluate(() => { localStorage.removeItem('tm_user_v3'); }); await p.goto(URL + '#/login'); await p.reload(); await p.click(`.acct:has-text("${n}")`); await p.waitForTimeout(120); };
  const shut = async () => { await p.evaluate(() => { document.querySelectorAll('.scrim.on, .ai-scrim').forEach(x => x.click()); }); await p.waitForTimeout(60); };
  const home = async () => { await shut(); await p.goto(URL + '#/home'); await p.waitForTimeout(100); };

  for (const [n, e] of Object.entries(EXPECT)) {
    await login(n); await home();
    const cards = await p.$$eval('.hm-card', xs => xs.map(x => x.dataset.do));
    ok(JSON.stringify(cards) === JSON.stringify(e.cards), `${n} 首页卡片 ${cards.join(',')}`);
    await p.screenshot({ path: `role-${n}.png` });
    const tabs = await p.$$eval('.tabs a', xs => xs.map(x => x.textContent.replace(/\d+/g, '').trim()));
    ok(JSON.stringify(tabs) === JSON.stringify(e.tabs), `${n} 底部标签 ${tabs.join(',')}`);
    // 想法页六宫格：执行者看到和自己相关的分类，老板 / 运营者 / 负责人保留待整理、等决策
    await shut(); await p.goto(URL + '#/ideas'); await p.waitForTimeout(120);
    if (p.url().endsWith('#/ideas')) {
      const ts = await p.$$eval('.id-tile', xs => xs.map(x => x.dataset.f));
      const ex = ['周敏', '何静', '刘洋'].includes(n);
      ok(ex ? JSON.stringify(ts) === '["all","cocreate","mine","planned","finished","closed"]' : ts.includes('triage') && ts.includes('awaiting'), `${n} 想法页六宫格 ${ts.join(',')}`);
    }
    // 首页每张卡片都能用
    for (const k of cards) {
      await home(); await p.evaluate(() => window.__toasts.splice(0)); await p.click(`.hm-card[data-do=${k}]`); await p.waitForTimeout(150);
      const d = await denied(); ok(!d.length, `${n} 点首页「${k}」不被拒 ${d.join('|')}`);
      ok(!p.url().endsWith('#/home'), `${n} 点首页「${k}」进入对应页面`);
    }
    // 想法页 / 项目页的「+」和新建菜单
    for (const tab of ['ideas', 'work']) {
      await shut(); await p.goto(URL + '#/' + tab); await p.waitForTimeout(100); await shut();
      if (!p.url().endsWith('#/' + tab)) continue;
      const plus = p.locator('.w-plus');
      if (await plus.count()) {
        await plus.first().click(); await p.waitForTimeout(120);
        const items = await p.$$eval('.sheet .wn-item', xs => xs.map(x => x.dataset.do));
        if (!items.length) { const d = await denied(); ok(!d.length, `${n} ${tab} 页「+」不被拒 ${d.join('|')}`); }
        for (const it of items) {
          await shut(); await p.goto(URL + '#/' + tab); await p.waitForTimeout(80); await shut(); await p.click('.w-plus'); await p.waitForTimeout(80); await p.evaluate(() => window.__toasts.splice(0));
          await p.click(`.sheet [data-do=${it}]`); await p.waitForTimeout(150);
          const d = await denied(); ok(!d.length, `${n} 新建菜单「${it}」不被拒 ${d.join('|')}`);
          await p.evaluate(() => { const x = document.querySelector('.sheet [data-do=closeSheet], .ai-x, [data-do=aiClose]'); if (x) x.click(); });
        }
      }
    }
    // AI 助手快捷按钮
    await home(); await p.evaluate(() => { const m = window.__tm; }); await p.goto(URL + '#/me'); await p.waitForTimeout(80);
    const aiBtn = p.locator('.me-info[data-do=quickAI]');
    if (await aiBtn.count()) {
      await aiBtn.click(); await p.waitForTimeout(120);
      const chips = await p.$$eval('.ai-chips button', xs => xs.map(x => x.dataset.k));
      for (const k of chips.filter(k => ['plan', 'brain', 'rate'].includes(k))) {
        await shut(); await p.goto(URL + '#/me'); await p.waitForTimeout(60); await shut(); await p.click('.me-info[data-do=quickAI]'); await p.waitForTimeout(80); await p.evaluate(() => window.__toasts.splice(0));
        await p.click(`.ai-chips button[data-k=${k}]`); await p.waitForTimeout(150);
        const d = await denied(); ok(!d.length, `${n} AI「${k}」不被拒 ${d.join('|')}`);
      }
    }
    // 任务标签上的红点数 = 任务页今天能看到的「等我处理」的任务
    await shut(); await p.goto(URL + '#/tasks'); await p.waitForTimeout(150);
    const badge = +(await p.evaluate(() => { const b = document.querySelector('.tabs .badge'); return b ? b.textContent : '0'; }));
    const sysOnPage = await p.evaluate(() => document.querySelectorAll('main a[href^="#/task/"], main [href^="#/task/"]').length);
    ok(sysOnPage >= badge, `${n} 任务页能看到红点提示的 ${badge} 件任务（页面上 ${sysOnPage} 件）`);
    // 「我的」统计块：执行者看自己的（待接收、已逾期），其他角色看团队的
    await shut(); await p.goto(URL + '#/me'); await p.waitForTimeout(120);
    const st = await p.$$eval('.me-stats .tm-stat small', xs => xs.map(x => x.textContent));
    ok(['周敏', '何静', '刘洋'].includes(n) ? st[0] === '待接收' && st[3] === '已逾期' : st[0] === '团队成员' && st[3] === '团队效率', `${n} 我的统计块 ${st.join(',')}`);
    // 设置与重置入口
    await shut(); await p.goto(URL + '#/me'); await p.waitForTimeout(80);
    const canSet = n === 'Enos' || n === '孙磊';
    ok((await p.locator('a[href="#/settings"]').count() > 0) === canSet, `${n} 更多设置入口${canSet ? '可见' : '隐藏'}`);
  }
  // 对照：检测手段本身有效（伪造一个执行者用不了的按钮，应该能抓到被拒提示）
  await login('周敏'); await home(); await p.evaluate(() => { window.__toasts.splice(0); const x = document.createElement('button'); x.dataset.do = 'quickIdea'; document.getElementById('app').appendChild(x); x.click(); }); await p.waitForTimeout(120);
  ok((await denied()).length === 1, '对照：被拒提示能被检测到');
  // 每条都送：运营者和负责人首页不再出现新建项目
  await login('Enos'); await p.evaluate(() => { window.__tm.S.settings.ownerApprovalMode = 'all'; });
  await p.goto(URL + '#/me'); await p.selectOption('[data-set=ownerApprovalMode]', 'all'); await p.waitForTimeout(80);
  await login('林晓'); await home(); ok(await p.locator('.hm-card[data-do=quickProject]').count() === 0, '每条都送：运营者首页不显示新建项目');
  await login('陈立'); await home(); ok(await p.locator('.hm-card[data-do=quickProject]').count() === 0 && await p.locator('.hm-card[data-do=quickIdea]').count() === 1, '每条都送：负责人只剩记录想法');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`角色界面 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
