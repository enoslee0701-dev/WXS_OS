// 原生桥接层（native.js）：在浏览器里伪造 Capacitor iOS 原生端，验证数据双存/恢复、语音识别兼容层、剪贴板深链接、启动屏
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
// 伪原生端：插件方法走 nativePromise / nativeCallback；Preferences 存在 sessionStorage（刷新后仍在，模拟原生持久化）
const FAKE = (opts) => {
  const o = opts || {};
  const ss = window.sessionStorage;
  if (!o.welcome && !ss.getItem('__wl')) { localStorage.setItem('tm_demo_chosen', '1'); ss.setItem('__wl', '1'); }
  if (o.prefs && !ss.getItem('__fp_init')) { ss.setItem('__fp', JSON.stringify(o.prefs)); ss.setItem('__fp_init', '1'); }
  const P = () => JSON.parse(ss.getItem('__fp') || '{}'), setP = (x) => ss.setItem('__fp', JSON.stringify(x));
  const subs = {}; let cid = 0;
  const F = window.__fake = { calls: [], clip: null, emit(pl, ev, data) { (subs[pl + ':' + ev] || []).forEach(cb => cb(data)); }, prefs: P, perm: o.perm || 'granted' };
  const M = (n, ms) => ({ name: n, methods: ms.map(x => ({ name: x, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }, { name: 'removeAllListeners', rtype: 'promise' }]) });
  window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
  window.Capacitor = {
    PluginHeaders: [M('Preferences', ['get', 'set', 'remove', 'keys']), M('Clipboard', ['write', 'read']), M('App', ['exitApp']), M('StatusBar', ['setStyle']), M('Keyboard', ['setAccessoryBarVisible']), M('SplashScreen', ['hide', 'show']), M('Speech', ['available', 'checkPermissions', 'requestPermissions', 'start', 'stop']), M('PushNotifications', ['checkPermissions', 'requestPermissions', 'register'])],
    nativeCallback(pl, m, a, cb) { const k = pl + ':' + a.eventName; (subs[k] = subs[k] || []).push(cb); return String(++cid); },
    nativePromise(pl, m, a) {
      F.calls.push(pl + '.' + m);
      if (pl === 'Preferences') { const p = P(); if (m === 'get') return Promise.resolve({ value: p[a.key] == null ? null : p[a.key] }); if (m === 'set') { p[a.key] = a.value; setP(p); } if (m === 'remove') { delete p[a.key]; setP(p); } return Promise.resolve({}); }
      if (pl === 'Clipboard' && m === 'write') { F.clip = a.string; return Promise.resolve(); }
      if (pl === 'Speech' && m === 'requestPermissions') return Promise.resolve({ speech: F.perm, microphone: F.perm });
      if (pl === 'Speech' && m === 'start') F.lang = a.lang;
      if (pl === 'PushNotifications' && m === 'checkPermissions') return Promise.resolve({ receive: 'prompt' });
      if (pl === 'PushNotifications' && m === 'requestPermissions') return Promise.resolve({ receive: o.pushDeny ? 'denied' : 'granted' });
      if (pl === 'PushNotifications' && m === 'register') setTimeout(() => F.emit('PushNotifications', 'registration', { value: 'cd'.repeat(32) }), 50);
      return Promise.resolve({});
    }
  };
};
(async () => {
  const b = await chromium.launch();
  const mk = async (opts) => { const c = await b.newContext({ ...devices['iPhone 13'] }); await c.addInitScript(FAKE, opts || null); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.errs = errs; await p.goto(URL); await p.waitForTimeout(300); return p; };

  // 0. 普通浏览器：桥接层不生效
  { const c = await b.newContext(); const p = await c.newPage(); await p.goto(URL);
    ok(await p.evaluate(() => TMN.native === false && !document.documentElement.classList.contains('native')), '浏览器里不启用原生层');
    ok(await p.evaluate(() => !/maximum-scale/.test(document.querySelector('meta[name=viewport]').content)), '网页版保留缩放');
    await c.close(); }

  // 1. 原生环境基础（首次打开：欢迎页）
  let p = await mk({ welcome: true });
  ok(await p.evaluate(() => TMN.native && TMN.platform === 'ios' && document.documentElement.classList.contains('p-ios')), '识别为 iOS 原生');
  ok(await p.evaluate(() => window.SpeechRecognition === TMN.SpeechRecognition && window.webkitSpeechRecognition === TMN.SpeechRecognition), '语音识别换成原生实现');
  ok(await p.evaluate(() => __fake.calls.includes('SplashScreen.hide')), '加载后关闭启动屏');
  ok(await p.evaluate(() => !TMN.error), '桥接层无错误');
  ok(await p.evaluate(() => /maximum-scale=1/.test(document.querySelector('meta[name=viewport]').content)), 'App 里禁止缩放（避免点输入框页面放大）');

  ok(await p.locator('.welcome [data-do=srvConnect]').count() === 1 && await p.locator('.acct').count() === 0, 'App 首次打开是欢迎页（连接服务器 / 看演示）');
  await p.click('[data-do=demoChoose]'); await p.waitForTimeout(100);
  ok(await p.locator('.acct').count() > 0, '选择看演示后出现演示账号');
  await p.reload(); await p.waitForTimeout(300);
  ok(await p.locator('.acct').count() > 0, '演示选择被记住');
  // 2. 数据双存
  await p.click('.acct:has-text("Enos")'); await p.waitForTimeout(500);
  let pf = await p.evaluate(() => __fake.prefs());
  ok(pf.tm_user_v3 === 'u_owner', '登录身份备份到原生存储');
  ok(JSON.parse(pf.tm_backup_keys || '[]').includes('tm_user_v3'), '备份清单');
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__tm.S)); s.users[0].motto = '备份测试'; localStorage.setItem('tm_demo_v3', JSON.stringify(s)); });
  await p.waitForTimeout(500);
  pf = await p.evaluate(() => __fake.prefs());
  ok(pf.tm_demo_v3 && pf.tm_demo_v3.includes('备份测试'), '业务数据写入后同步备份');

  // 3. 剪贴板深链接 + 外部打开
  await p.evaluate(() => navigator.clipboard.writeText('capacitor://localhost/#/idea/I2')); await p.waitForTimeout(50);
  ok(await p.evaluate(() => __fake.clip) === 'teamops://idea/I2', '复制链接转成 teamops:// 深链接');
  await p.evaluate(() => navigator.clipboard.writeText('普通文字')); await p.waitForTimeout(50);
  ok(await p.evaluate(() => __fake.clip) === '普通文字', '普通文字原样复制');
  await p.evaluate(() => __fake.emit('App', 'appUrlOpen', { url: 'teamops://ideas' })); await p.waitForTimeout(150);
  ok(p.url().endsWith('#/ideas'), '深链接打开对应页面');

  // 4. 语音识别：连续模式按停顿切句
  const r1 = await p.evaluate(async () => {
    const out = { fin: [], ends: 0, lang: '' }; const r = new SpeechRecognition(); r.lang = 'zh-CN'; r.continuous = true;
    r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) out.fin.push(e.results[i][0].transcript); };
    r.onend = () => out.ends++; r.start(); await new Promise(z => setTimeout(z, 100)); out.lang = __fake.lang;
    __fake.emit('Speech', 'partial', { text: '今天开会' }); await new Promise(z => setTimeout(z, 1400));
    __fake.emit('Speech', 'partial', { text: '今天开会，讨论预算' }); await new Promise(z => setTimeout(z, 300));
    r.stop(); await new Promise(z => setTimeout(z, 50)); return out;
  });
  ok(r1.lang === 'zh-CN', '语言传给原生');
  ok(r1.fin.join('|') === '今天开会|讨论预算', '停顿切句、停止时补最后一句：' + r1.fin.join('|'));
  ok(r1.ends === 1, '停止后 onend 一次');
  // 单次模式：停顿后自动结束；results[0][0] 可读
  const r2 = await p.evaluate(async () => {
    const out = { t: '', ends: 0 }; const r = new SpeechRecognition(); r.onresult = e => { out.t = e.results[0][0].transcript; }; r.onend = () => out.ends++;
    r.start(); await new Promise(z => setTimeout(z, 100)); __fake.emit('Speech', 'partial', { text: '项目进度' }); await new Promise(z => setTimeout(z, 1500)); return out;
  });
  ok(r2.t === '项目进度' && r2.ends === 1, '单次识别停顿后出结果并结束');
  // 原生会话自然结束（约一分钟上限）→ onend，由 app.js 自己决定是否重启
  const r3 = await p.evaluate(async () => {
    const out = { fin: [], ends: 0 }; const r = new SpeechRecognition(); r.continuous = true; r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) out.fin.push(e.results[i][0].transcript); }; r.onend = () => out.ends++;
    r.start(); await new Promise(z => setTimeout(z, 100)); __fake.emit('Speech', 'partial', { text: '最后一句' }); __fake.emit('Speech', 'end', {}); await new Promise(z => setTimeout(z, 50)); return out;
  });
  ok(r3.fin.join() === '最后一句' && r3.ends === 1, '原生会话结束时提交并 onend');
  ok(p.errs.length === 0, '无报错 ' + p.errs.join('|'));
  await p.context().close();

  // 5. 权限被拒 → onerror not-allowed
  p = await mk({ perm: 'denied' });
  const r4 = await p.evaluate(async () => { const out = { err: '', ends: 0 }; const r = new SpeechRecognition(); r.onerror = e => out.err = e.error; r.onend = () => out.ends++; r.start(); await new Promise(z => setTimeout(z, 150)); return out; });
  ok(r4.err === 'not-allowed' && r4.ends === 1, '没有权限时报 not-allowed');
  await p.context().close();

  // 6. WebView 数据被清：从原生备份恢复
  const seed = await (async () => { const q = await mk(); await q.click('.acct:has-text("林晓")'); await q.waitForTimeout(100);
    const s = await q.evaluate(() => { const x = window.__tm.S; x.users.find(u => u.id === 'u_owner').motto = '从备份恢复'; return JSON.stringify(x); }); await q.context().close(); return s; })();
  p = await mk({ prefs: { tm_demo_v3: seed, tm_user_v3: 'u_op', tm_backup_keys: JSON.stringify(['tm_demo_v3', 'tm_user_v3']) } });
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => localStorage.getItem('tm_user_v3')) === 'u_op', '恢复登录身份');
  ok(await p.evaluate(() => window.__tm && window.__tm.S.users.find(u => u.id === 'u_owner').motto) === '从备份恢复', '恢复业务数据并重新加载');
  ok(await p.locator('.acct').count() === 0, '恢复后直接进入，不用重新选身份');
  ok(p.errs.length === 0, '恢复无报错 ' + p.errs.join('|'));

  await p.context().close();
  // 7. 只丢了部分数据（例如登录令牌）：缺的键从备份补回
  const seed2 = await (async () => { const q = await mk(); const s = await q.evaluate(() => JSON.stringify(window.__tm.S)); await q.context().close(); return s; })();
  { const c2 = await b.newContext({ ...devices['iPhone 13'] });
    // 页面脚本运行前：本机已有业务数据和身份，只缺登录令牌（模拟部分写盘丢失）
    await c2.addInitScript((s) => { if (!sessionStorage.getItem('__ls_init')) { localStorage.setItem('tm_demo_v3', s); localStorage.setItem('tm_user_v3', 'u_op'); sessionStorage.setItem('__ls_init', '1'); } }, seed2);
    await c2.addInitScript(FAKE, { prefs: { tm_demo_v3: seed2, tm_user_v3: 'u_op', tm_token: 'tok-123', tm_backup_keys: JSON.stringify(['tm_demo_v3', 'tm_user_v3', 'tm_token']) } });
    p = await c2.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(URL); }
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => localStorage.getItem('tm_token')) === 'tok-123' && await p.evaluate(() => localStorage.getItem('tm_user_v3')) === 'u_op', '部分丢失：只补回缺的登录令牌');
  ok(await p.evaluate(() => window.__tm.me) === 'u_op' && p.errs.length === 0, '部分恢复后正常进入');
  await p.context().close();
  // 8. 推送：服务器模式登录后申请权限、登记设备；点通知跳页；退出时先注销设备再退出
  { const c3 = await b.newContext({ ...devices['iPhone 13'] }); const reqs = [];
    await c3.addInitScript((st) => { if (!sessionStorage.getItem('__s3')) { localStorage.setItem('tm_server', 'http://push.test'); localStorage.setItem('tm_token', 'tok'); localStorage.setItem('tm_user_v3', 'u_owner'); localStorage.setItem('tm_demo_v3', st); sessionStorage.setItem('__s3', '1'); } }, seed2);
    await c3.addInitScript(FAKE, null);
    await c3.route('http://push.test/**', async (route) => { const r = route.request(), u = new globalThis.URL(r.url()); reqs.push(r.method() + ' ' + u.pathname + ' ' + (r.postData() || ''));
      if (u.pathname === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
      if (u.pathname === '/api/state') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 1, state: JSON.parse(seed2) }) });
      if (u.pathname === '/api/health') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"setup":true}' });
      if (u.pathname === '/api/logout') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"enabled":false}' }); });
    p = await c3.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(URL);
    await p.waitForTimeout(2300);
    ok(reqs.some(x => x.startsWith('POST /api/devices ') && x.includes('cd'.repeat(32))), '登录后申请通知权限并登记设备');
    await p.evaluate(() => __fake.emit('PushNotifications', 'pushNotificationActionPerformed', { notification: { data: { link: '#/ideas' } } })); await p.waitForTimeout(150);
    ok(p.url().endsWith('#/ideas'), '点通知跳到对应页面');
    const n0 = reqs.length; ok('tm_token' in await p.evaluate(() => __fake.prefs()), '登录状态已备份到原生存储'); await p.evaluate(() => TMS.logout()); await p.waitForTimeout(600);
    const tail = reqs.slice(n0).map(x => x.split(' ')[1]);
    ok(tail.indexOf('/api/devices/remove') >= 0 && tail.indexOf('/api/devices/remove') < tail.indexOf('/api/logout'), '退出时先注销设备再退出 ' + tail.join(','));
    await p.waitForTimeout(800);
    ok(await p.evaluate(() => !localStorage.getItem('tm_token') && !localStorage.getItem('tm_demo_v3')) && !('tm_token' in await p.evaluate(() => __fake.prefs())), '退出后刷新：令牌和数据不会被原生备份「复活」');
    ok(await p.locator('form[data-form=srvLogin]').count() === 1, '退出后停在登录页');
    ok(p.errs.length === 0, '推送流程无报错 ' + p.errs.join('|'));
    await c3.close(); }
  console.log(`原生桥接 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
