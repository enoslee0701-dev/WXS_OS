// 录音 / 视频转写在想法详情里的显示：转写中、失败、没识别到说话、转好的文字（可展开）
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.click('.acct:has-text("Enos")'); await p.waitForTimeout(200);
  const id = await p.evaluate(() => {
    const S = JSON.parse(JSON.stringify(window.__tm.S)), d = S.ideas.find(x => x.creatorId === 'u_owner' && x.status !== 'draft' && !x.deleted);
    d.media = [
      { id: 'M1', kind: 'audio', name: '录音 0:30', localId: 'b_a1', transcriptStatus: 'done', transcript: '下周二开同工会，讨论感恩晚会的预算。' },
      { id: 'M2', kind: 'video', name: '视频 10月5日.mp4', localId: 'b_v2', transcriptStatus: 'pending' },
      { id: 'M3', kind: 'audio', name: '录音 0:03', localId: 'b_a3', transcriptStatus: 'failed' },
      { id: 'M4', kind: 'audio', name: '录音 0:02', localId: 'b_a4', transcriptStatus: 'done', transcript: '' },
      { id: 'M5', kind: 'image', name: '照片.jpg', localId: 'b_i5' }];
    window.__tm.setState(S); return d.id;
  });
  await p.evaluate((h) => { location.hash = h; }, '#/idea/' + id); await p.waitForTimeout(300);
  const t = await p.evaluate(() => [...document.querySelectorAll('.ix2-tr')].map(e => e.textContent));
  ok(t.length === 4, '图片之外的 4 个音视频都有转写状态 ' + t.length);
  ok(t.some(x => /录音转成的文字 · 18 字/.test(x)), '转好的文字：显示字数');
  ok(t.some(x => /正在把视频里的话转成文字/.test(x)), '转写中');
  ok(t.some(x => /没能转成文字/.test(x)), '转写失败');
  ok(t.some(x => /没有识别到说话/.test(x)), '没有识别到说话');
  await p.click('details.ix2-tr summary'); await p.waitForTimeout(100);
  ok(await p.isVisible('details.ix2-tr p:has-text("感恩晚会")'), '点开看到转写全文');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`转写显示 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
