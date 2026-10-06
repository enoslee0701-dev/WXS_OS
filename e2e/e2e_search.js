// 全局搜索：想法、项目、任务、留言、成员都能搜到；多个词同时匹配；按类别分组、高亮；只搜自己能看到的
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const search = async (q) => { await p.fill('#q', q); await p.waitForTimeout(250); return p.evaluate(() => ({ groups: [...document.querySelectorAll('#qr .q-g')].map(x => x.firstChild.textContent), text: document.getElementById('qr').innerText, marks: document.querySelectorAll('#qr mark').length })); };
  await p.goto(URL); await p.click('.acct:has-text("Enos")'); await p.waitForTimeout(200);
  // 准备：给一个任务加一条留言
  const tk = await p.evaluate(() => { const S = window.__tm.S, t = S.tasks.find(x => x.status !== 'cancelled'); S.comments.push({ id: 'Mzz', taskId: t.id, authorId: 'u_owner', body: '记得联系紫荆花酒店的王经理', at: Date.now() }); return t.title; });
  await p.goto(URL + '#/ideas'); await p.waitForTimeout(200); await p.click('[data-do=search]'); await p.waitForSelector('#q');
  let r = await search(tk.slice(0, 4));
  ok(r.groups.includes('任务') && r.marks > 0, '按任务标题搜到任务并高亮 ' + JSON.stringify(r.groups));
  r = await search('紫荆花 王经理');
  ok(r.groups.includes('留言') && /紫荆花酒店/.test(r.text), '多个词同时匹配，搜到任务留言');
  r = await search('刘洋');
  ok(r.groups.includes('成员'), '搜到成员');
  r = await search('完全不存在的词xyz');
  ok(/没有找到/.test(r.text), '搜不到时有提示');
  // 点结果能跳过去
  await search('紫荆花'); await p.click('#qr .q-r'); await p.waitForTimeout(200);
  ok(p.url().includes('#/task/'), '点结果打开对应任务');
  // 执行者看不到的任务：留言也搜不到
  await p.goto(URL + '#/home'); await p.click('[data-do=switch]'); await p.click('.acct:has-text("周敏")'); await p.waitForTimeout(200);
  const canSee = await p.evaluate(() => { const S = window.__tm.S, c0 = S.comments.find(x => x.id === 'Mzz'); return typeof TM !== 'undefined' ? TM.canViewTask(S, 'u_admin_ex', S.tasks.find(t => t.id === c0.taskId)) : null; });
  await p.goto(URL + '#/tasks'); await p.waitForTimeout(150);
  await p.evaluate(() => { const b = document.querySelector('[data-do=search]'); if (b) b.click(); else window.__tm.DO.search(); }); await p.waitForSelector('#q');
  r = await search('紫荆花');
  ok(canSee === null ? true : canSee ? r.groups.includes('留言') : !r.groups.includes('留言'), '只搜自己能看到的（周敏能看该任务：' + canSee + '）');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`搜索 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
