// Android 原生层（native.js 在 Android 上的行为）：在浏览器里伪造 Capacitor Android 端
// 推送不启用、没有语音识别服务时去掉转写、返回键、闪退记录提示、打开文件 / 导出走「分享」、外部链接交给系统浏览器、「浏览器」措辞
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const FAKE = (opts) => {
  const o = opts || {};
  if (!sessionStorage.getItem('__wl')) { localStorage.setItem('tm_demo_chosen', '1'); sessionStorage.setItem('__wl', '1'); }
  const subs = {}; let cid = 0;
  const F = window.__fake = { calls: [], args: {}, emit(pl, ev, data) { (subs[pl + ':' + ev] || []).forEach(cb => cb(data)); } };
  const M = (n, ms) => ({ name: n, methods: ms.map(x => ({ name: x, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }, { name: 'removeAllListeners', rtype: 'promise' }]) });
  window.androidBridge = { postMessage() {} };
  window.Capacitor = {
    PluginHeaders: [M('Preferences', ['get', 'set', 'remove', 'keys']), M('Clipboard', ['write', 'read']), M('App', ['exitApp', 'getInfo']), M('StatusBar', ['setStyle']), M('Keyboard', ['setAccessoryBarVisible']), M('SplashScreen', ['hide', 'show']), M('Speech', ['available', 'checkPermissions', 'requestPermissions', 'start', 'stop']), M('PushNotifications', ['checkPermissions', 'requestPermissions', 'register']), M('Haptics', ['impact', 'notification']), M('Diag', ['lastCrash', 'simulate']), M('Filesystem', ['writeFile']), M('Share', ['share'])],
    nativeCallback(pl, m, a, cb) { const k = pl + ':' + a.eventName; (subs[k] = subs[k] || []).push(cb); return String(++cid); },
    nativePromise(pl, m, a) {
      F.calls.push(pl + '.' + m); F.args[pl + '.' + m] = a;
      if (pl === 'Preferences') { if (m === 'get') return Promise.resolve({ value: null }); if (m === 'keys') return Promise.resolve({ keys: [] }); return Promise.resolve({}); }
      if (pl === 'Speech' && m === 'available') return Promise.resolve({ available: !o.noSpeech });
      // 模拟「一启动就出错」的语音服务（某些手机）
      if (pl === 'Speech' && m === 'start' && o.srBroken) { F.starts = (F.starts || 0) + 1; setTimeout(() => F.emit('Speech', 'error', { error: o.srBroken, code: 5, tried: ['default#5'], service: 'com.vendor/.Svc', device: 'Vendor X1 · Android 14' }), 20); return Promise.resolve({}); }
      if (pl === 'Speech' && m === 'requestPermissions') return Promise.resolve({ speech: 'granted', microphone: 'granted' });
      if (pl === 'App' && m === 'getInfo') return Promise.resolve({ version: '1.3', build: '4' });
      if (pl === 'Diag' && m === 'lastCrash') return Promise.resolve({ text: o.crash || '' });
      if (pl === 'Filesystem' && m === 'writeFile') return Promise.resolve({ uri: 'file:///cache/' + a.path });
      if (pl === 'PushNotifications' && m === 'checkPermissions') return Promise.resolve({ receive: 'granted' });
      return Promise.resolve({});
    }
  };
};
(async () => {
  const b = await chromium.launch();
  const mk = async (opts, hash) => {
    const c = await b.newContext({ ...devices['Pixel 7'] }); await c.addInitScript(FAKE, opts || null);
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.errs = errs;
    await p.goto(URL + (hash || '')); await p.waitForTimeout(400);
    if (await p.locator('.acct:has-text("Enos")').count()) { await p.click('.acct:has-text("Enos")'); await p.waitForTimeout(300); }
    return p;
  };
  const calls = (p) => p.evaluate(() => window.__fake.calls);

  // 1. 平台识别、推送不启用
  let p = await mk();
  ok(await p.evaluate(() => TMN.native && TMN.platform === 'android'), '识别为 Android');
  await p.waitForTimeout(2000);
  ok(!(await calls(p)).some(x => /^PushNotifications\./.test(x)), 'Android 不注册推送（没有 Firebase）');
  ok(await p.evaluate(() => typeof window.SpeechRecognition === 'function' && !TMN.noSpeech), '有语音识别服务：保留语音转文字');
  // 2. 「浏览器」措辞改成手机
  await p.evaluate(() => { location.hash = '#/new/voice'; }); await p.waitForTimeout(300);
  ok(!/浏览器/.test(await p.evaluate(() => document.getElementById('app').innerHTML)), '语音页没有「浏览器」字样');
  await p.evaluate(() => window.__tm.toast('没有拿到麦克风权限，请在浏览器设置里允许后再试', true));
  ok((await p.textContent('#toast')).includes('设置 → 应用 → 团队协同 → 权限'), '权限提示改成手机设置路径：' + await p.textContent('#toast'));
  // 3. 返回键：弹窗 → 返回上一页 → 标签页回首页 → 首页退出
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(200);
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForTimeout(200);
  await p.click('[data-do=meEdit][data-k=email]'); await p.waitForTimeout(300);
  const backKey = async () => { await p.evaluate(() => window.__fake.emit('App', 'backButton', { canGoBack: true })); await p.waitForTimeout(250); };
  await backKey(); ok(await p.locator('#layer .sheet').count() === 0 && p.url().endsWith('#/me'), '返回键先关弹窗');
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(200);
  await backKey(); ok(p.url().endsWith('#/me'), '返回键回到上一页：' + p.url());
  await backKey(); ok(p.url().endsWith('#/home'), '标签页按返回键回首页');
  await backKey(); ok(!(await calls(p)).includes('App.exitApp') && (await p.textContent('#toast')).includes('再按一次退出'), '首页按返回键：先提示，不退出');
  await backKey(); ok((await calls(p)).includes('App.exitApp'), '2 秒内再按：退出 App');
  // 4. 导出 / 打开本地文件：写入缓存再分享
  await p.evaluate(() => TMN.shareFile(new Blob(['{"a":1}'], { type: 'application/json' }), '团队/备份:1.json'));
  const a = await p.evaluate(() => window.__fake.args);
  ok(a['Filesystem.writeFile'] && a['Filesystem.writeFile'].path === '团队_备份_1.json' && a['Filesystem.writeFile'].directory === 'CACHE' && atob(a['Filesystem.writeFile'].data) === '{"a":1}', '文件写进缓存目录（文件名去掉非法字符）');
  ok(a['Share.share'] && a['Share.share'].files[0] === 'file:///cache/团队_备份_1.json', '弹出系统分享 / 用其他应用打开');
  ok(p.errs.length === 0, '无报错 ' + p.errs.join('|'));
  // 4b. 相机 / 相册给的文件名换成看得懂的名字
  await p.evaluate(() => { location.hash = '#/new/video'; }); await p.waitForTimeout(300);
  await p.setInputFiles('input[data-camfile] >> nth=0', { name: '1000000019.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fake') });
  await p.waitForTimeout(400);
  const vn = await p.evaluate(() => document.getElementById('app').textContent);
  ok(/视频 \d+月\d+日 \d\d:\d\d\.mp4/.test(vn) && !vn.includes('1000000019'), '相机文件名换成「视频 X月X日 时:分」');
  // 4c. 只用来查看的面板只有一个「关闭」按钮（不再同时有「取消」和「关闭」）
  await p.evaluate(() => { location.hash = '#/work/W1'; }); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('[data-do=wTab]')].find(x => /文件/.test(x.textContent)).click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-do=wUpload]').click()); await p.waitForTimeout(300);
  ok(await p.locator('#layer .sheet footer button').count() === 1 && (await p.textContent('#layer .sheet footer')).trim() === '关闭', '上传面板底部只有「关闭」');
  await p.evaluate(() => window.__tm.back()); await p.waitForTimeout(200);
  // 4d. 旧 WebView 不支持 :has()：选中的选项卡片靠 is-checked 类显示
  await p.evaluate(() => { location.hash = '#/team'; }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-do=tmInvite]').click()); await p.waitForTimeout(300);
  ok(await p.locator('#layer .opt.is-checked').count() === 1, '打开面板时默认选项有选中样式');
  await p.locator('#layer .opt').nth(1).click(); await p.waitForTimeout(100);
  ok(await p.evaluate(() => { const l = [...document.querySelectorAll('#layer .opt')]; return l[1].classList.contains('is-checked') && !l[0].classList.contains('is-checked'); }), '点另一个选项：选中样式跟着移动');
  await p.evaluate(() => window.__tm.back()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { location.hash = '#/home'; return new Promise(r => setTimeout(() => r(document.documentElement.classList.contains('home-lock')), 300)); }), '首页给 html 加 home-lock（代替 :has）');
  // 5. 外部链接交给系统浏览器（页面导航到外部地址，由 Capacitor 转给系统浏览器）
  await p.context().route('https://example.org/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'ext' }));
  await p.evaluate(() => { const x = document.createElement('a'); x.href = 'https://example.org/doc'; x.target = '_blank'; x.textContent = 'ext'; x.id = 'extl'; x.style.cssText = 'position:fixed;top:120px;left:20px;z-index:9999;padding:10px;background:#fff'; document.body.appendChild(x); });
  const pages0 = p.context().pages().length;
  await Promise.all([p.waitForURL('https://example.org/doc', { timeout: 3000 }).catch(() => {}), p.click('#extl')]);
  ok(p.url() === 'https://example.org/doc' && p.context().pages().length === pages0, '外部链接（target=_blank）不开新窗口，交给系统浏览器：' + p.url());
  await p.context().close();

  // 5b. 旧 WebView 不支持 flex gap：换成子元素外边距（这里强制按不支持处理）
  { const c3 = await b.newContext({ ...devices['Pixel 7'] }); await c3.addInitScript(() => { window.__tmNoFlexGap = true; localStorage.setItem('tm_demo_chosen', '1'); });
    const p3 = await c3.newPage(); const e3 = []; p3.on('pageerror', e => e3.push(e.message)); await p3.goto(URL); await p3.click('.acct:has-text("Enos")'); await p3.evaluate(() => { location.hash = '#/ideas'; }); await p3.waitForTimeout(400);
    const r = await p3.evaluate(() => { const fx = [...document.querySelectorAll('[data-fg]')]; const kids = fx.flatMap(e => [...e.children]).filter(k => k.style.marginLeft || k.style.marginTop || k.style.marginRight || k.style.marginBottom); return { fx: fx.length, kids: kids.length }; });
    ok(r.fx > 5 && r.kids > 5, '不支持 flex gap 时补上外边距 ' + JSON.stringify(r));
    ok(e3.length === 0, '无报错 ' + e3.join('|')); await c3.close(); }
  // 6. 没有语音识别服务的手机（不少国产手机）
  p = await mk({ noSpeech: true }, '#/new/voice'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => TMN.noSpeech === true && !window.SpeechRecognition), '没有识别服务：去掉语音转文字');
  ok(await p.evaluate(() => !document.querySelector('[data-fg]')), '支持 flex gap 的浏览器不做任何改动');
  await p.evaluate(() => { location.hash = '#/new/voice'; }); await p.waitForTimeout(300);
  ok((await p.textContent('.vr-card')).includes('这台手机不支持转写'), '语音页提示不支持转写（录音照常）：' + (await p.textContent('.vr-card')).slice(0, 40));
  ok(p.errs.length === 0, '无报错 ' + p.errs.join('|'));
  await p.context().close();

  // 6b. 语音服务一启动就出错：不能无限重启（以前会每秒上百次启动，拖垮 App），放弃后提示用户
  for (const code of ['aborted', 'network']) {
    p = await mk({ srBroken: code }, '#/kb/voice'); await p.waitForTimeout(300);
    await p.evaluate(() => { location.hash = '#/kb/voice'; }); await p.waitForTimeout(300);
    await p.click('[data-do=kbvRec]'); await p.waitForTimeout(5000);
    const n = await p.evaluate(() => window.__fake.starts || 0);
    ok(n >= 1 && n <= 5, `识别出错（${code}）：5 秒内只启动了 ${n} 次`);
    ok((await p.textContent('#toast')).includes('语音转文字'), `识别出错（${code}）：提示用户改用输入法语音键 ` + await p.textContent('#toast'));
    ok(await p.evaluate(() => TMN.lastSpeechError && TMN.lastSpeechError.code === 5), `识别出错（${code}）：记下原生给的错误代码`);
    ok(p.errs.length === 0, '无报错 ' + p.errs.join('|'));
    await p.context().close();
  }
  // 7. 上次闪退：打开时提示，可复制
  p = await mk({ crash: '2026-10-05 10:00:00\nApp 异常\n手机：Xiaomi 13\njava.lang.IllegalStateException: boom' });
  await p.waitForTimeout(500);
  ok(await p.locator('.sheet h2:has-text("App 上次意外关闭")').count() === 1, '显示「App 上次意外关闭」');
  ok((await p.inputValue('#crashText')).includes('IllegalStateException'), '显示闪退原因');
  await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__fake.args['Clipboard.write'] && window.__fake.args['Clipboard.write'].string || '')).includes('Xiaomi 13'), '一键复制闪退信息');
  ok(p.errs.length === 0, '无报错 ' + p.errs.join('|'));
  await p.context().close();

  // 8. 安卓 App 更新：团队服务器上有更新的安装包时提示下载；「以后再说」后同一版本不再自动提示
  { const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
    const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-upd-')), PORT = 26000 + Math.floor(Math.random() * 900), SRV = 'http://127.0.0.1:' + PORT;
    fs.mkdirSync(path.join(DIR, 'app')); fs.writeFileSync(path.join(DIR, 'app', 'teamops.apk'), 'apk'); fs.writeFileSync(path.join(DIR, 'app', 'android.json'), JSON.stringify({ versionName: '1.4', versionCode: 5, notes: '修复录音问题' }));
    const sv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: 'c' }, stdio: ['ignore', 'pipe', 'ignore'] });
    await new Promise(r => sv.stdout.on('data', d => { if (/已启动/.test(String(d))) r(); }));
    await fetch(SRV + '/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '王老板', login: 'boss', password: 'boss123456', code: 'c' }) });
    p = await mk(); await p.context().route(SRV + '/app/android.apk', r => r.fulfill({ status: 200, contentType: 'text/plain', body: 'apk' }));
    await p.evaluate((u) => { localStorage.removeItem('tm_user_v3'); localStorage.setItem('tm_server', u); }, SRV); await p.reload(); await p.waitForTimeout(600);
    await p.fill('form[data-form=srvLogin] input[name=login]', 'boss'); await p.fill('form[data-form=srvLogin] input[name=password]', 'boss123456'); await p.click('form[data-form=srvLogin] button[type=submit]');
    await p.waitForSelector('.hm-card', { timeout: 10000 });
    if (await p.locator('#layer .sheet').count()) { await p.click('#layer .sheet footer button[type=button]'); } // 「三步开始」引导
    await p.waitForSelector('#layer .sheet h2:has-text("发现新版本")', { timeout: 8000 }).catch(() => {});
    const t = await p.textContent('#layer .sheet').catch(() => '');
    ok(t.includes('1.4') && t.includes('1.3') && t.includes('修复录音问题'), '提示发现新版本（新旧版本号、更新说明）');
    await p.click('#layer .sheet footer button[type=button]'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => localStorage.getItem('tm_upd_skip')) === '5', '点「以后再说」：记住这个版本，不再自动提示');
    await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForTimeout(300);
    ok((await p.textContent('[data-do=appUpdate]')).includes('1.3') && (await p.textContent('[data-do=appUpdate]')).includes('有新版本'), '「我的」显示当前版本和「有新版本」');
    await p.click('[data-do=appShare]'); await p.waitForTimeout(300);
    ok(await p.locator('#layer .sheet svg').count() === 1 && (await p.textContent('#layer .sheet')).includes(SRV + '/app'), '老板可以出示安装页二维码给同事');
    await p.click('#layer .sheet footer button[type=submit]'); await p.waitForTimeout(200);
    await p.click('[data-do=appUpdate]'); await p.waitForSelector('#layer .sheet h2:has-text("发现新版本")', { timeout: 5000 });
    await Promise.all([p.waitForURL(SRV + '/app/android.apk', { timeout: 5000 }).catch(() => {}), p.click('#layer .sheet footer button[type=submit]')]);
    ok(p.url() === SRV + '/app/android.apk', '点「下载安装」交给系统浏览器下载安装包：' + p.url());
    sv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); await p.context().close(); }

  console.log(`Android 原生层 E2E 通过 ${pass}，失败 ${fail}`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
