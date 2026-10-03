// 服务器测试：临时目录起一个真实实例，走 HTTP 验证账号、权限、裁剪、同步
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗ ' + m); } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-srv-')), PORT = 18000 + Math.floor(Math.random() * 2000);
const B = 'http://127.0.0.1:' + PORT;
function start() {
  const p = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: DIR, MAX_FILE_MB: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderr.on('data', d => { const t = String(d); if (!/ExperimentalWarning|act 异常/.test(t)) process.stderr.write(t); });
  return new Promise(r => p.stdout.on('data', d => { if (/已启动/.test(String(d))) r(p); }));
}
const call = async (method, url, body, tok) => { const r = await fetch(B + url, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
const post = (u, b, t) => call('POST', u, b, t), get = (u, t) => call('GET', u, null, t);

(async () => {
  let srv = await start();
  // 1. 首次创建团队
  ok((await get('/api/setup')).needsSetup === true, '新服务器需要创建团队');
  ok((await post('/api/login', { login: 'boss', password: '123456' })).status === 409, '未创建团队时不能登录');
  ok((await post('/api/setup', { name: '王老板', login: 'b', password: '123456' })).status === 400, '账号太短被拒');
  ok((await post('/api/setup', { name: '王老板', login: 'boss', password: '123' })).status === 400, '密码太短被拒');
  const st = await post('/api/setup', { name: '王老板', title: '创始人', login: 'boss', password: 'boss123' });
  ok(st.status === 200 && st.token && st.uid === 'u_owner' && st.state.users.length === 1 && st.state.users[0].name === '王老板', '老板创建空白团队');
  ok((await post('/api/setup', { name: 'x', login: 'xxx', password: '123456' })).status === 409, '不能重复创建团队');
  const boss = st.token;
  ok((await get('/api/state')).status === 401, '没登录拿不到数据');

  // 2. 老板添加成员并分派账号
  let r = await post('/api/act', { name: 'member.add', payload: { name: '小李', title: '设计', role: 'executor', group: '设计创意' } }, boss);
  ok(r.ok && r.state.users.length === 2, '老板添加成员');
  const li = r.state.users.find(u => u.name === '小李').id;
  r = await post('/api/act', { name: 'member.add', payload: { name: '小王', title: '运营', role: 'operator', group: '行政运营' } }, boss);
  const wang = r.state.users.find(u => u.name === '小王').id;
  const acc = await post('/api/accounts', { uid: li, login: 'xiaoli' }, boss);
  ok(acc.status === 200 && /^[a-z2-9]{4}-[a-z2-9]{4}$/.test(acc.password), '分派账号自动生成初始密码 ' + acc.password);
  ok((await post('/api/accounts', { uid: wang, login: 'XiaoLi' }, boss)).status === 409, '账号名不能重复（不分大小写）');
  const accW = await post('/api/accounts', { uid: wang, login: 'xiaowang', password: 'wang123' }, boss);
  ok(accW.password === 'wang123', '也可以由老板指定密码');
  ok((await post('/api/accounts', { uid: 'u_owner', login: 'boss2' }, (await post('/api/login', { login: 'xiaowang', password: 'wang123' })).token)).status === 403, '运营者不能管理账号');

  // 3. 成员登录、首次改密
  let lg = await post('/api/login', { login: 'xiaoli', password: 'wrong' });
  ok(lg.status === 401, '密码错误');
  lg = await post('/api/login', { login: 'XIAOLI', password: acc.password });
  ok(lg.status === 200 && lg.uid === li && lg.mustChange === true, '成员登录（账号不分大小写），要求改初始密码');
  const liTok = lg.token;
  ok((await post('/api/password', { password: '12' }, liTok)).status === 400, '新密码太短');
  ok((await post('/api/password', { password: 'li123456' }, liTok)).ok, '首次改密不需要原密码');
  ok((await get('/api/me', liTok)).mustChange === false, '改密后不再要求');
  ok((await post('/api/password', { old: 'bad', password: 'li654321' }, liTok)).status === 400, '再次改密需要原密码');
  ok((await post('/api/login', { login: 'xiaoli', password: 'li123456' })).status === 200, '新密码可以登录');

  // 4. 权限由引擎按登录身份判断
  r = await post('/api/act', { name: 'idea.create', payload: { note: '执行者想记想法' } }, liTok);
  ok(r.ok === false && /只有/.test(r.error), '执行者不能记录想法（服务器拒绝）');
  r = await post('/api/act', { name: 'idea.create', payload: { note: '老板的私人草稿：明年计划' } }, boss);
  ok(r.ok && r.r.id && r.state.ideas.length === 1, '老板记录想法');
  const draftId = r.r.id;
  r = await get('/api/state', liTok);
  ok(r.state.ideas.length === 0 && !JSON.stringify(r.state).includes('明年计划'), '老板的草稿不会下发给成员');
  r = await post('/api/act', { name: 'settings.update', payload: { staleDays: 9 } }, liTok);
  ok(!r.ok, '执行者不能改设置');
  r = await post('/api/act', { name: 'no.such', payload: {} }, boss);
  ok(!r.ok && /未知操作/.test(r.error), '未知操作被拒');
  const v0 = (await get('/api/state', boss)).version;
  r = await post('/api/act', { name: 'idea.update', payload: { id: draftId, note: '改过的草稿' } }, boss);
  ok(r.ok && r.version === v0 + 1, '成功操作版本号 +1');
  r = await post('/api/act', { name: 'idea.update', payload: { id: draftId, note: '' } }, liTok);
  ok(!r.ok && r.version === v0 + 1, '失败操作版本号不变');

  // 5. SSE 推送
  const ac = new AbortController(); const got = [];
  fetch(B + '/api/events?token=' + liTok, { signal: ac.signal }).then(async res => { const rd = res.body.getReader(); for (;;) { const { value, done } = await rd.read(); if (done) break; got.push(String(Buffer.from(value))); } }).catch(() => {});
  await new Promise(z => setTimeout(z, 150));
  await post('/api/act', { name: 'todo.create', payload: { title: '老板的待办', date: '2026-10-03' } }, boss);
  await new Promise(z => setTimeout(z, 150)); ac.abort();
  ok(got.join('').split('event: v').length >= 3, '有人改动时推送新版本号');

  // 6. 停用账号
  ok((await post('/api/accounts/disable', { uid: 'u_owner', disabled: true }, boss)).status === 400, '不能停用自己');
  ok((await post('/api/accounts/disable', { uid: li, disabled: true }, boss)).ok, '老板停用成员账号');
  ok((await get('/api/state', liTok)).status === 401, '停用后原会话失效');
  ok((await post('/api/login', { login: 'xiaoli', password: 'li123456' })).status === 403, '停用后不能登录');
  await post('/api/accounts/disable', { uid: li, disabled: false }, boss);
  ok((await post('/api/login', { login: 'xiaoli', password: 'li123456' })).status === 200, '恢复后可以登录');
  const list = await get('/api/accounts', boss);
  ok(list.accounts.length === 3 && list.accounts.every(a => !('hash' in a) && !('salt' in a)), '账号列表不含密码信息');

  // 7. 重置密码：旧会话失效
  const rs = await post('/api/accounts', { uid: wang, reset: true }, boss);
  ok(rs.password && rs.password !== 'wang123', '重置密码生成新密码');
  ok((await post('/api/login', { login: 'xiaowang', password: 'wang123' })).status === 401, '旧密码失效');

  // 8. 登录限流
  for (let i = 0; i < 10; i++) await post('/api/login', { login: 'xiaowang', password: 'x' + i });
  ok((await post('/api/login', { login: 'xiaowang', password: rs.password })).status === 429, '连续输错 10 次后暂时锁定');

  // 8.5 附件
  const up = (id, body, tok, type) => fetch(B + '/api/files/' + id, { method: 'PUT', headers: { 'Content-Type': type || 'text/plain', 'X-File-Name': encodeURIComponent('会议记录.txt'), ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body });
  const liTok2 = (await post('/api/login', { login: 'xiaoli', password: 'li123456' })).token;
  ok((await up('f_abc123', 'hello', null)).status === 401, '没登录不能上传');
  ok((await up('bad id!', 'x', boss)).status === 400, '非法文件 ID');
  let ur = await up('f_abc123', '0123456789 附件内容', boss);
  ok(ur.status === 200 && (await ur.json()).size > 10, '老板上传附件');
  ok((await up('f_abc123', 'hack', liTok2)).status === 409, '别人不能覆盖这个文件');
  ok((await up('f_abc123', '0123456789 附件内容 v2', boss)).status === 200, '上传人重传（断网重试）可以覆盖');
  let gr = await fetch(B + '/api/files/f_abc123?token=' + liTok2);
  ok(gr.status === 200 && (await gr.text()) === '0123456789 附件内容 v2' && /会议记录/.test(decodeURIComponent(gr.headers.get('content-disposition'))), '成员用链接令牌读取附件（含文件名）');
  gr = await fetch(B + '/api/files/f_abc123', { headers: { Authorization: 'Bearer ' + liTok2, Range: 'bytes=2-5' } });
  ok(gr.status === 206 && (await gr.text()) === '2345' && gr.headers.get('content-range') === 'bytes 2-5/' + Buffer.byteLength('0123456789 附件内容 v2'), '分段读取（iPhone 播放视频需要）');
  ok((await fetch(B + '/api/files/f_abc123')).status === 401, '没登录不能读取');
  ok((await fetch(B + '/api/files/f_none00?token=' + liTok2)).status === 404, '不存在的文件');
  ok((await up('f_big001', Buffer.alloc(1.5 * 1024 * 1024), boss, 'application/octet-stream')).status === 413, '超过大小上限被拒');
  ok(!fs.readdirSync(path.join(DIR, 'files')).some(f => f.includes('.part-') || f === 'f_big001'), '被拒的文件不留残片');
  // 9. 重启后数据还在
  srv.kill(); await new Promise(z => setTimeout(z, 200)); srv = await start();
  r = await get('/api/state', boss);
  ok(r.status === 200 && r.state.users.length === 3 && r.state.ideas.length === 1 && r.state.ideas[0].note === '改过的草稿', '重启后数据和会话都在');
  ok((await (await fetch(B + '/api/files/f_abc123?token=' + boss)).text()).endsWith('v2'), '重启后附件还在');
  ok(fs.readdirSync(path.join(DIR, 'backups')).length === 1, '每天一份备份');
  // 10. 演示团队
  srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR);
  srv = await start();
  r = await post('/api/setup', { name: 'Enos', login: 'enos', password: 'enos123', demo: true });
  ok(r.state.users.length === 7 && r.state.ideas.length > 0 && r.state.users[0].name === 'Enos', '可以带演示数据创建');
  r = await post('/api/act', { name: 'data.clearDemo', payload: {} }, r.token);
  ok(r.ok && r.state.ideas.length === 0 && r.state.users.length === 7, '一键清理演示数据');
  srv.kill(); fs.rmSync(DIR, { recursive: true, force: true });
  console.log(`\n服务器 通过 ${pass}，失败 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
