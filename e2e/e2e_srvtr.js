// 手机自己转不了文字（没有语音识别）时，由团队服务器转：语音记录页、AI 拆待办录音、AI 建项目上传视频、口述成规则
// 用假的 ffmpeg / whisper 起服务器；浏览器用模拟麦克风，并去掉语音识别（模拟国产手机）
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-srvtr-')), BIN = path.join(DIR, 'bin'); fs.mkdirSync(BIN);
fs.writeFileSync(path.join(BIN, 'ffmpeg'), '#!/bin/sh\nfor a in "$@"; do last="$a"; done\nhead -c 4096 /dev/zero > "$last"\n');
fs.writeFileSync(path.join(BIN, 'whisper'), '#!/bin/sh\necho "明天上午十点和陈立开周会, 准备感恩晚会场地."\n');
fs.chmodSync(path.join(BIN, 'ffmpeg'), 0o755); fs.chmodSync(path.join(BIN, 'whisper'), 0o755); fs.writeFileSync(path.join(DIR, 'm.bin'), 'm');
const PORT = 23000 + Math.floor(Math.random() * 2000), SRV = 'http://127.0.0.1:' + PORT;
let srv;
(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, LLM: '0', PORT, HOST: '127.0.0.1', DATA_DIR: path.join(DIR, 'data'), SETUP_CODE: 'c', WHISPER_BIN: path.join(BIN, 'whisper'), WHISPER_MODEL: path.join(DIR, 'm.bin'), FFMPEG: path.join(BIN, 'ffmpeg') }, stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise(r => { let o = ''; srv.stdout.on('data', d => { o += d; if (/已启动/.test(o)) r(); }); });
  await fetch(SRV + '/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '王老板', login: 'boss', password: 'boss123456', code: 'c', demo: true }) });
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const c = await b.newContext({ ...devices['iPhone 13'], permissions: ['microphone'] });
  await c.addInitScript(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.evaluate((u) => { localStorage.setItem('tm_server', u); localStorage.setItem('tm_demo_chosen', '1'); }, SRV); await p.reload();
  await p.fill('form[data-form=srvLogin] input[name=login]', 'boss'); await p.fill('form[data-form=srvLogin] input[name=password]', 'boss123456'); await p.click('form[data-form=srvLogin] button[type=submit]');
  await p.waitForSelector('.hm-card', { timeout: 10000 }); await p.waitForTimeout(800);
  if (await p.locator('#layer .sheet').count()) await p.click('#layer .sheet footer button[type=button]');
  const waitClosed = () => p.waitForFunction(() => !document.querySelector('#layer .sheet h2') || !/正在转文字/.test(document.querySelector('#layer .sheet h2').textContent), null, { timeout: 10000 });
  // 1. 语音记录页：录 2 秒 → 停止 → 服务器转写填进识别文字
  await p.evaluate(() => { location.hash = '#/new/voice'; }); await p.waitForTimeout(400);
  ok((await p.textContent('.vr-card')).includes('停止录音后由团队服务器转成文字'), '语音页提示：停止后由服务器转文字');
  await p.click('.vr-c[data-do=voStart]'); await p.waitForTimeout(2000); await p.click('.vr-c[data-do=voStop]');
  await p.waitForSelector('#layer .sheet h2:has-text("正在转文字")', { timeout: 5000 }).catch(() => {}); await waitClosed();
  await p.waitForTimeout(300);
  ok((await p.inputValue('[data-cap="vo.text"]')).includes('感恩晚会场地'), '语音记录：服务器转的文字填进识别文字');
  ok(await p.evaluate(() => { const t = document.querySelector('[data-cap="vo.text"]').value; return t.includes('，') && !t.includes(','); }), '转写结果是中文标点');
  // 2. AI 拆待办：录音 → 服务器转写 → 追加到文字框
  await p.evaluate(() => { location.hash = '#/todo/new/ai'; }); await p.waitForTimeout(400);
  const taStart = p.locator('[data-do=taRec], [data-do=taStart]').first();
  if (await taStart.count()) {
    await taStart.click(); await p.waitForTimeout(1500); await p.locator('[data-do=taRec], [data-do=taStop]').first().click();
    await waitClosed(); await p.waitForTimeout(300);
    ok((await p.inputValue('[data-ta="text"]')).includes('周会'), 'AI 拆待办：录音由服务器转成文字');
  } else ok(false, 'AI 拆待办页找不到录音按钮');
  // 3. AI 建项目：上传视频 → 服务器转写 → 进入 AI 解析
  await p.evaluate(() => { location.hash = '#/project/ai'; }); await p.waitForTimeout(400);
  await p.setInputFiles('input[data-aivideo]', { name: 'meeting.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fakevideo') });
  await waitClosed(); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ h: location.hash, sheet: (document.querySelector('#layer .sheet') || {}).textContent || '', pd: window.__tm && document.body.textContent.includes('感恩晚会') }));
  ok(after.pd || /感恩晚会|周会/.test(after.sheet), 'AI 建项目：视频由服务器转写后交给 AI 解析 ' + after.h);
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`服务器转文字 E2E 通过 ${pass}，失败 ${fail}`);
  await b.close(); srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
