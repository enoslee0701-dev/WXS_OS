// 大视频实测：老板在 App 里选一条 8 分钟 / 700MB 视频 → 分段上传（中途服务器重启一次，从断点续传）→ 真 whisper 转写 → 本机 AI 整理
const R = require('path').join(__dirname, '..', '..') + '/';
const { chromium, devices } = require(R + 'node_modules/playwright');
const fs = require('fs'), { spawn } = require('child_process'), L = __dirname, PORT = 24873, SRV = 'http://127.0.0.1:' + PORT, DATA = L + '/data3';
const log = (...a) => { const s = '[' + new Date().toTimeString().slice(0, 8) + '] ' + a.join(' '); console.log(s); fs.appendFileSync(L + '/run3.log', s + '\n'); };
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; log(c ? '✓' : '✗', m); };
const api = async (m, u, b, t) => (await fetch(SRV + u, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let srv, slog = '';
const start = () => new Promise(r => { srv = spawn(process.execPath, [R + 'server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: DATA, SETUP_CODE: 'c', KEEP_AWAKE: '0' }, stdio: ['ignore', 'pipe', 'pipe'] }); srv.stdout.on('data', d => { slog += d; if (/已启动/.test(String(d))) r(); }); srv.stderr.on('data', d => slog += d); });
(async () => {
  fs.rmSync(DATA, { recursive: true, force: true }); fs.rmSync(L + '/run3.log', { force: true });
  await start();
  const setup = await api('POST', '/api/setup', { name: '王总', title: '总经理', login: 'boss', password: 'Boss2026x', code: 'c' }); const tok = setup.token;
  const size = fs.statSync(L + '/big.mp4').size; log('视频', Math.round(size / 1048576) + 'MB');
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(SRV + '/'); await p.waitForSelector('form[data-form=srvLogin]');
  await p.fill('form[data-form=srvLogin] input[name=login]', 'boss'); await p.fill('form[data-form=srvLogin] input[name=password]', 'Boss2026x'); await p.click('form[data-form=srvLogin] button[type=submit]'); await p.waitForTimeout(2000);
  for (let i = 0; i < 3 && await p.locator('#layer .sheet').count(); i++) { await p.evaluate(() => { const x = document.querySelector('#layer .sheet footer button[type=submit]') || document.querySelector('#layer .sheet [data-do=closeSheet]'); x && x.click(); }); await p.waitForTimeout(400); }
  await c.route(/\/api\/files\/[^/]+\/chunk/, async r => { await wait(250); r.continue(); }); // 模拟 8MB/s 左右的网速，每段 2MB
  await p.goto(SRV + '/#/new/video'); await p.waitForTimeout(500);
  const t0 = Date.now(); await p.setInputFiles('.cx-drop input[data-camfile]', L + '/big.mp4'); await p.waitForTimeout(1500);
  log('选好视频（' + ((Date.now() - t0) / 1000).toFixed(1) + 's）：', (await p.textContent('#toast')).trim(), '| 页面显示：', (await p.evaluate(() => (document.querySelector('.cx-vi') || {}).innerText || '')).replace(/\n/g, ' '));
  await p.fill('[data-cap="cam.title"]', '十月经营会口述（长视频）');
  await p.evaluate(() => document.querySelector('[data-do=capNext]').click()); await p.waitForSelector('#layer .sheet'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#layer .sheet footer button[type=submit]').click()); await p.waitForTimeout(800);
  const t1 = Date.now(); log('提交：', (await p.textContent('#toast')).trim());
  const st0 = (await api('GET', '/api/state', null, tok)).state; const d = st0.ideas[0], fid = d.media[0].localId; log('附件 ID', fid, d.media[0].name);
  // 看上传进度；到 30% 时把服务器杀掉再启动，看能不能从断点接着传
  let restarted = false, lastPct = -1, sizeAtRestart = 0;
  for (let i = 0; i < 1800; i++) {
    const r = await fetch(SRV + '/api/files/' + fid + '/upload', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json()).catch(() => null);
    if (r) { const pct = Math.round((r.size || 0) / size * 100); if (pct !== lastPct && pct % 10 === 0) { log('  上传 ' + pct + '%', r.done ? '完成' : ''); lastPct = pct; }
      if (r.done) { log('上传完成，用时 ' + ((Date.now() - t1) / 1000).toFixed(1) + 's，页面状态：' + (await p.evaluate(() => (document.querySelector('.sync, .st-sync, [data-sync]') || {}).textContent || '（无）'))); break; }
      if (!restarted && pct >= 30) { restarted = true; sizeAtRestart = r.size; srv.kill(); await wait(800); await start(); log('  服务器在 ' + pct + '% 时重启'); } }
    await wait(500);
  }
  const got = fs.statSync(DATA + '/files/' + fid).size; ok(got === size, '服务器收到的文件大小一致（' + got + ' / ' + size + '）' + (restarted ? '，中途重启后从 ' + Math.round(sizeAtRestart / 1048576) + 'MB 处续传' : ''));
  ok(restarted, '测到了中途重启');
  // 转写 + AI
  const t2 = Date.now(); let fin = null, lastS = '';
  for (let i = 0; i < 600 && !fin; i++) {
    const st = (await api('GET', '/api/state', null, tok)).state, dd = st.ideas[0], m = dd.media[0], sm = st.summaries.filter(x => x.ideaId === dd.id && x.kind === 'analysis').pop();
    const s = '转写=' + (m.transcriptStatus || '-') + ' 整理稿=' + (sm ? (sm.payload.simulated ? '规则版' : '真实AI') : '无'); if (s !== lastS) { log('  ' + ((Date.now() - t2) / 1000).toFixed(0) + 's ' + s); lastS = s; }
    if (m.transcriptStatus === 'done' && sm && !sm.payload.simulated) fin = { m, sm }; else if (m.transcriptStatus === 'failed') break; else await wait(2000);
  }
  ok(fin && fin.m.transcript.length > 1000, '8 分钟视频转写完成（' + (fin ? fin.m.transcript.length : 0) + ' 字）');
  if (fin) { log('转写开头：', fin.m.transcript.slice(0, 120)); log('AI 标题：', fin.sm.payload.title, '| 摘要：', fin.sm.payload.summary.slice(0, 100)); log('AI 建议任务：', fin.sm.payload.suggested_tasks.map(t => t.title).join(' | ')); }
  // 想法页能播放、能看转写
  await p.goto(SRV + '/#/idea/' + d.id); await p.waitForTimeout(1500);
  const vt = await p.evaluate(() => document.body.innerText); ok(/视频转成的文字/.test(vt), '想法页显示转写入口'); ok(/本机 AI 整理/.test(vt), '想法页显示本机 AI 整理');
  const rng = await fetch(SRV + '/api/files/' + fid, { headers: { Authorization: 'Bearer ' + tok, Range: 'bytes=1000000-1000999' } }); ok(rng.status === 206 && (await rng.arrayBuffer()).byteLength === 1000, '视频支持分段播放（Range 206）');
  await p.screenshot({ path: L + '/p3_idea.png', fullPage: true });
  ok(!errs.length, '页面无报错 ' + errs.join('|')); ok(!/出错|Error/.test(slog), '服务器无报错 ' + (slog.match(/.*(出错|Error).*/g) || []).slice(0, 2).join('|'));
  log(`大视频：通过 ${pass}，失败 ${fail}`); await b.close(); srv.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { log('出错', e.stack.split('\n').slice(0, 3).join(' ')); if (srv) srv.kill(); process.exit(1); });
