// iOS 推送测试：本地模拟 APNs（HTTP/2 明文），验证令牌签名、请求格式、收件人、偏好、失效设备清理
const http2 = require('http2'), crypto = require('crypto'), path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗ ' + m); } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-push-')), PORT = 23000 + Math.floor(Math.random() * 2000), B = 'http://127.0.0.1:' + PORT;
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const KEY = path.join(DIR, 'AuthKey_TEST.p8'); fs.writeFileSync(KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }));
const DEAD = 'dead'.repeat(16), got = [];
const apns = http2.createServer();
apns.on('stream', (st, h) => {
  let b = ''; st.on('data', d => b += d); st.on('end', () => {
    got.push({ h, body: JSON.parse(b) });
    const tok = h[':path'].split('/').pop();
    if (tok === DEAD) { st.respond({ ':status': 410 }); return st.end(JSON.stringify({ reason: 'Unregistered' })); }
    st.respond({ ':status': 200 }); st.end();
  });
});
const call = async (method, u, body, tok) => { const r = await fetch(B + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
const post = (u, b, t) => call('POST', u, b, t), get = (u, t) => call('GET', u, null, t);
const wait = (ms) => new Promise(z => setTimeout(z, ms));
(async () => {
  await new Promise(r => apns.listen(0, '127.0.0.1', r));
  const srv = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: 'c', APNS_KEY_FILE: KEY, APNS_KEY_ID: 'KEY123', APNS_TEAM_ID: 'TEAM99', APNS_BUNDLE_ID: 'com.teamops.app', APNS_HOST: 'http://127.0.0.1:' + apns.address().port }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => { if (/已启动/.test(String(d))) r(); }));
  const boss = (await post('/api/setup', { name: '王老板', login: 'boss', password: 'boss1234', code: 'c' })).token;
  let r = await post('/api/act', { name: 'member.add', payload: { name: '小李', title: '设计', role: 'executor', group: '设计创意' } }, boss);
  const li = r.state.users.find(u => u.name === '小李').id;
  r = await post('/api/act', { name: 'member.add', payload: { name: '小王', title: '运营', role: 'operator', group: '行政运营' } }, boss);
  const wang = r.state.users.find(u => u.name === '小王').id;
  await post('/api/accounts', { uid: li, login: 'xiaoli', password: 'li123456' }, boss);
  const liTok = (await post('/api/login', { login: 'xiaoli', password: 'li123456' })).token;
  await post('/api/password', { password: 'li654321' }, liTok);

  ok((await post('/api/devices', { token: 'not-hex' }, liTok)).status === 400, '设备令牌格式校验');
  const LI_DEV = 'ab'.repeat(32);
  r = await post('/api/devices', { token: LI_DEV, platform: 'ios' }, liTok);
  ok(r.ok && r.push === true, '登记设备，服务器已配置推送');
  await post('/api/devices', { token: DEAD }, liTok);

  // 派任务给小李 → 引擎给小李发通知 → 推送到小李的设备
  r = await post('/api/act', { name: 'project.create', payload: { title: '新官网', ptype: 'tech', operatorId: wang, goal: '上线', tasks: [{ title: '画首页', ownerId: li, expected: '设计稿', criteria: '老板认可' }] } }, boss);
  ok(r.ok, '老板派任务');
  await wait(500);
  const toLi = got.filter(x => x.h[':path'] === '/3/device/' + LI_DEV);
  ok(toLi.length >= 1, '小李收到推送');
  const p0 = toLi[0] || { h: {}, body: { aps: { alert: {} } } };
  ok(p0.h[':method'] === 'POST' && p0.h['apns-topic'] === 'com.teamops.app' && p0.h['apns-push-type'] === 'alert', '请求头：主题、类型');
  ok(p0.body.aps.alert.title && p0.body.aps.badge >= 1 && /^#\//.test(p0.body.link), '消息体：标题、角标、跳转链接');
  // ES256 令牌可以用公钥验证
  const jwt = String(p0.h.authorization || '').replace(/^bearer /, '').split('.');
  const head = JSON.parse(Buffer.from(jwt[0] || 'e30', 'base64url')), claims = JSON.parse(Buffer.from(jwt[1] || 'e30', 'base64url'));
  ok(head.alg === 'ES256' && head.kid === 'KEY123' && claims.iss === 'TEAM99' && Math.abs(claims.iat - Date.now() / 1000) < 60, '令牌头和声明');
  ok(crypto.verify('sha256', Buffer.from(jwt[0] + '.' + jwt[1]), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(jwt[2] || '', 'base64url')), '令牌签名有效');
  ok(!got.some(x => x.h[':path'].endsWith(LI_DEV) && x.body.aps.alert.title === undefined), '没有空推送');
  // 失效设备被清理：再推一次，失效的那个不会再收到
  const nDead = got.filter(x => x.h[':path'].endsWith(DEAD)).length;
  ok(nDead >= 1, '失效设备收到过一次');
  // 小李关掉「重要事项通知我」→ 不推
  await post('/api/act', { name: 'member.update', payload: { id: li, prefs: { notifyImportant: false } } }, liTok);
  const n1 = got.length;
  await post('/api/act', { name: 'project.create', payload: { title: '第二个项目', ptype: 'tech', operatorId: wang, goal: 'x', tasks: [{ title: '再画一张', ownerId: li, expected: '图', criteria: '好' }] } }, boss);
  await wait(400);
  ok(got.length === n1, '关掉通知偏好后不推送');
  await post('/api/act', { name: 'member.update', payload: { id: li, prefs: { notifyImportant: true } } }, liTok);
  await post('/api/act', { name: 'project.create', payload: { title: '第三个项目', ptype: 'tech', operatorId: wang, goal: 'x', tasks: [{ title: '第三张', ownerId: li, expected: '图', criteria: '好' }] } }, boss);
  await wait(400);
  ok(got.filter(x => x.h[':path'].endsWith(DEAD)).length === nDead, '失效设备已清理，不再推送');
  // 小李静音「任务」类：派任务给她不推送；恢复后照常
  await post('/api/act', { name: 'member.update', payload: { id: li, prefs: { mute: ['task'] } } }, liTok);
  const nM = got.length;
  await post('/api/act', { name: 'project.create', payload: { title: '第四个项目', ptype: 'tech', operatorId: wang, goal: 'x', tasks: [{ title: '第四张', ownerId: li, expected: '图', criteria: '好' }] } }, boss);
  await wait(400);
  ok(!got.slice(nM).some(x => x.h[':path'].endsWith(LI_DEV)), '静音的类别不推送');
  await post('/api/act', { name: 'member.update', payload: { id: li, prefs: { mute: [] } } }, liTok);
  ok(got.filter(x => x.h[':path'].endsWith(LI_DEV)).length > toLi.length, '重新打开后继续推送');
  // 同一台手机换人登录：设备归属跟着换
  const bossDev = await post('/api/devices', { token: LI_DEV }, boss);
  ok(bossDev.ok, '老板在同一台手机登录，设备改归老板');
  const n2 = got.length;
  await post('/api/act', { name: 'project.create', payload: { title: '第四个项目', ptype: 'tech', operatorId: wang, goal: 'x', tasks: [{ title: '第四张', ownerId: li, expected: '图', criteria: '好' }] } }, boss);
  await wait(400);
  ok(got.length === n2, '设备换主人后，小李的通知不再推到这台手机');
  ok((await post('/api/devices/remove', { token: LI_DEV }, boss)).ok, '退出登录时注销设备');
  ok((await post('/api/devices', { token: 'ab'.repeat(31) + 'a' }, liTok)).status === 400, '令牌长度不对被拒');
  // 小李重新登记自己的手机；老板重置小李密码（手机丢了）→ 这台手机不再收到推送
  const LI2 = 'ef'.repeat(32), liTok2 = (await post('/api/login', { login: 'xiaoli', password: 'li654321' })).token;
  await post('/api/devices', { token: LI2 }, liTok2);
  await post('/api/act', { name: 'project.create', payload: { title: '第五个项目', ptype: 'tech', operatorId: wang, goal: 'x', tasks: [{ title: '第五张', ownerId: li, expected: '图', criteria: '好' }] } }, boss);
  await wait(400);
  const n3 = got.filter(x => x.h[':path'].endsWith(LI2)).length;
  ok(n3 >= 1, '重新登记后收到推送');
  await post('/api/accounts', { uid: li, reset: true }, boss);
  await post('/api/act', { name: 'project.create', payload: { title: '第六个项目', ptype: 'tech', operatorId: wang, goal: 'x', tasks: [{ title: '第六张', ownerId: li, expected: '图', criteria: '好' }] } }, boss);
  await wait(400);
  ok(got.filter(x => x.h[':path'].endsWith(LI2)).length === n3, '密码被重置（会话失效）后这台手机不再收到推送');
  srv.kill(); apns.close(); fs.rmSync(DIR, { recursive: true, force: true });
  console.log(`\n推送 通过 ${pass}，失败 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
