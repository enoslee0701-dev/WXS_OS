const { chromium } = require('playwright');
const URL=(require('./_env').URL);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message)); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('✗',m));};
  await p.goto(URL); await p.evaluate(()=>{localStorage.clear();localStorage.setItem('tm_user_v3','u_owner');}); await p.reload();
  // 1. 提交前显示 AI 拟题
  await p.goto(URL+'#/new/text'); await p.waitForTimeout(150);
  ok(!(await p.isVisible('#cx-ait-tx')), '没内容时不显示拟题');
  await p.fill('[data-cap="tx.note"]','会议室投影仪坏了，换一台'); await p.waitForTimeout(80);
  ok((await p.textContent('#cx-ait-tx b'))==='更换会议室投影仪', '输入后实时显示 AI 拟题');
  await p.fill('[data-cap="tx.title"]','自己起的'); await p.waitForTimeout(80);
  ok(!(await p.isVisible('#cx-ait-tx')), '自己填了标题就隐藏');
  await p.fill('[data-cap="tx.title"]',''); await p.waitForTimeout(80);
  await p.click('[data-do=aitEdit][data-k=tx]'); await p.waitForSelector('.sheet.on');
  ok((await p.inputValue('.sheet input[name=title]'))==='更换会议室投影仪', '改一改弹窗预填 AI 标题');
  await p.fill('.sheet input[name=title]','会议室换投影仪'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(150);
  ok((await p.inputValue('[data-cap="tx.title"]'))==='会议室换投影仪' && !(await p.isVisible('#cx-ait-tx')), '改后的标题填回');
  await p.click('[data-do=capNext][data-k=tx]'); await p.waitForSelector('.sheet.on'); await p.click('.sheet footer button[type=button]'); await p.waitForTimeout(150);
  ok((await p.textContent('.ix2-main h2')).includes('会议室换投影仪') && !(await p.locator('.ix2-ait').count()), '提交后用改过的标题，不标 AI');
  // 保留 AI 标题时仍标 AI 拟题
  await p.goto(URL+'#/new/text'); await p.waitForTimeout(150); await p.fill('[data-cap="tx.note"]','12 月年会，提前订场地，准备物资。');
  await p.click('[data-do=aitEdit][data-k=tx]'); await p.waitForSelector('.sheet.on'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(150);
  ok(await p.isVisible('#cx-ait-tx'), '原样确认仍显示 AI 拟题');
  await p.click('[data-do=capNext][data-k=tx]'); await p.waitForSelector('.sheet.on'); await p.click('.sheet footer button[type=button]'); await p.waitForTimeout(150);
  ok(await p.locator('.ix2-ait').count()===1, '保留 AI 标题时详情标 AI 拟题');
  // 2. 形成的事项紧凑卡片
  let found=null;
  for (let i=1;i<=12 && !found;i++){ await p.goto(URL+'#/idea/I'+i); await p.waitForTimeout(120); if (await p.locator('.ix2-wk').count()) found='I'+i; }
  ok(!!found, '找到有事项的想法');
  if (found) {
    ok(!(await p.locator('.ix2-card .list .row').count()), '不再用旧大行');
    const h = await p.locator('.ix2-wk').first().evaluate(e=>e.getBoundingClientRect().height);
    ok(h<=110, '事项卡片紧凑（高 '+Math.round(h)+'）');
    const fs = await p.locator('.ix2-wkt b').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)); ok(fs<=15.5, '标题字号 '+fs);
    await p.locator('.ix2-wk').first().click(); await p.waitForTimeout(150); ok(p.url().includes('#/work/'), '点击进入项目');
    await p.goto(URL+'#/idea/'+found); await p.waitForTimeout(150); await p.screenshot({ path: 'shot_wk.png', fullPage: true });
  }
  await p.goto(URL+'#/new/text'); await p.fill('[data-cap="tx.note"]','下个月整理一下仓库的旧设备'); await p.waitForTimeout(80); await p.screenshot({ path: 'shot_ait.png' });
  ok(!errs.length,'无脚本错误 '+errs.join(';')); console.log('AI 拟题/事项卡片 E2E 通过',pass,'失败',fail); await b.close();
})();
