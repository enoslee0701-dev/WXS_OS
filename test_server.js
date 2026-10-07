// 服务器测试：临时目录起一个真实实例，走 HTTP 验证账号、权限、裁剪、同步
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗ ' + m); } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-srv-')), PORT = 18000 + Math.floor(Math.random() * 2000);
const B = 'http://127.0.0.1:' + PORT;
function start() {
  const p = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', PORT, HOST: '127.0.0.1', DATA_DIR: DIR, MAX_FILE_MB: '1', SETUP_CODE: 'code-1234' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  ok((await post('/api/setup', { name: '王老板', login: 'boss', password: 'boss1234' })).status === 403, '没有初始化码不能创建团队');
  ok((await post('/api/setup', { name: '王老板', login: 'boss', password: 'boss1234', code: 'wrong' })).status === 403, '初始化码不对');
  ok((await post('/api/setup', { name: '王老板', login: 'b', password: '123456', code: 'code-1234' })).status === 400, '账号太短被拒');
  ok((await post('/api/setup', { name: '王老板', login: 'boss', password: '123', code: 'code-1234' })).status === 400, '密码太短被拒');
  const st = await post('/api/setup', { name: '王老板', title: '创始人', login: 'boss', password: 'boss1234', code: 'code-1234' });
  ok(st.status === 200 && st.token && st.uid === 'u_owner' && st.state.users.length === 1 && st.state.users[0].name === '王老板', '老板创建空白团队');
  ok((await post('/api/setup', { name: 'x', login: 'xxx', password: '123456', code: 'code-1234' })).status === 409, '不能重复创建团队');
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
  const accW = await post('/api/accounts', { uid: wang, login: 'xiaowang', password: 'wang1234' }, boss);
  ok(accW.password === 'wang1234', '也可以由老板指定密码');
  ok((await post('/api/accounts', { uid: 'u_owner', login: 'boss2' }, (await post('/api/login', { login: 'xiaowang', password: 'wang1234' })).token)).status === 403, '运营者不能管理账号');
  // 邀请链接：分派账号时一并生成；同事点开能看到是谁邀请、账号是什么；设好密码直接登录（不用初始密码、不用再改密码）；只能用一次
  { ok(/^[A-Za-z0-9_-]{16,40}$/.test(acc.invite || ''), '分派账号时生成邀请码 ' + acc.invite);
    let pk = await get('/api/invite?token=' + acc.invite); ok(pk.status === 200 && pk.name === '小李' && pk.login === 'xiaoli' && pk.by === '王老板', '邀请链接公开可看：谁邀请、账号是什么 ' + JSON.stringify(pk));
    ok((await get('/api/invite?token=nope-nope-nope-nope')).status === 410, '无效邀请码：410');
    ok((await post('/api/invite/accept', { token: acc.invite, password: '12345678' })).status === 400, '邀请时也不能设弱密码');
    const jn = await post('/api/invite/accept', { token: acc.invite, password: 'Li-2026-strong' });
    ok(jn.status === 200 && jn.token && jn.uid === li && jn.mustChange === false && jn.state.users.length >= 2, '通过邀请设密码后直接登录，不用再改密码');
    ok((await get('/api/invite?token=' + acc.invite)).status === 410 && (await post('/api/invite/accept', { token: acc.invite, password: 'Another-123' })).status === 410, '邀请码用过就失效');
    ok((await post('/api/login', { login: 'xiaoli', password: 'Li-2026-strong' })).status === 200 && (await post('/api/login', { login: 'xiaoli', password: acc.password })).status === 401, '新密码能登录，初始密码作废');
    const re = await post('/api/invite', { uid: li }, boss); ok(re.status === 200 && re.invite && re.invite !== acc.invite, '老板可以重新生成邀请');
    ok((await post('/api/invite', { uid: 'u_owner' }, boss)).status === 400, '不能给老板生成邀请');
    ok((await post('/api/invite', { uid: li }, jn.token)).status === 403, '执行者不能生成邀请');
    ok((await get('/api/me', jn.token)).status === 200, '邀请登录得到的会话可用');
    const rs = await post('/api/accounts', { uid: li, login: 'xiaoli', reset: true }, boss); acc.password = rs.password; /* 后面的流程仍按初始密码 → 首次改密走 */ }

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
  ok((await get('/api/state', boss)).state.users.find(u => u.id === li).inactive === true, '停用后团队数据里标记停用（不能再被派任务）');
  ok((await get('/api/state', liTok)).status === 401, '停用后原会话失效');
  ok((await post('/api/login', { login: 'xiaoli', password: 'li123456' })).status === 403, '停用后不能登录');
  await post('/api/accounts/disable', { uid: li, disabled: false }, boss);
  ok(!(await get('/api/state', boss)).state.users.find(u => u.id === li).inactive, '恢复后团队数据里取消停用');
  ok((await post('/api/login', { login: 'xiaoli', password: 'li123456' })).status === 200, '恢复后可以登录');
  const list = await get('/api/accounts', boss);
  ok(list.accounts.length === 3 && list.accounts.every(a => !('hash' in a) && !('salt' in a)), '账号列表不含密码信息');

  // 7. 重置密码：旧会话失效
  const rs = await post('/api/accounts', { uid: wang, reset: true }, boss);
  ok(rs.password && rs.password !== 'wang1234', '重置密码生成新密码');
  ok((await post('/api/login', { login: 'xiaowang', password: 'wang1234' })).status === 401, '旧密码失效');

  // 7.5 首次改密前不能操作
  const mc = await post('/api/accounts', { uid: wang, reset: true }, boss);
  const wTok = (await post('/api/login', { login: 'xiaowang', password: mc.password })).token;
  ok((await post('/api/act', { name: 'todo.create', payload: { title: 'x', date: '2026-10-03' } }, wTok)).status === 403, '没改初始密码前不能操作');
  ok((await get('/api/state', wTok)).status === 200, '没改初始密码前可以读数据');
  ok((await post('/api/password', { password: 'wang654321' }, wTok)).ok, '改密码');
  ok((await post('/api/act', { name: 'todo.create', payload: { title: 'x', date: '2026-10-03' } }, wTok)).ok, '改完可以操作');
  // 8. 登录限流
  for (let i = 0; i < 10; i++) await post('/api/login', { login: 'xiaowang', password: 'x' + i });
  ok((await post('/api/login', { login: 'xiaowang', password: 'wang654321' })).status === 429, '连续输错 10 次后暂时锁定');
  { const viaTunnel = (ip) => fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ login: 'xiaowang', password: 'wang654321' }) });
    ok((await viaTunnel('203.0.113.9')).status === 200, '公网通道：别的外网 IP 不受这个锁定影响'); }

  // 8.4 坏附件数据：以前会让所有人拿不到数据、甚至登录失败；现在被清洗，数据照常下发
  for (const bad of ['abc', [null], {}, [{ kind: { x: 1 }, name: ['a'], localId: '../../etc' }]]) {
    const rb = await post('/api/act', { name: 'idea.create', payload: { title: '坏附件', note: 'x', media: bad } }, boss);
    ok(rb.status === 200, '坏附件不会让操作报 400：' + JSON.stringify(bad) + ' → ' + rb.status);
  }
  { const st = await get('/api/state', boss); ok(st.status === 200 && st.state.ideas.filter(d => d.title === '坏附件').every(d => Array.isArray(d.media) && d.media.every(m => m && typeof m.kind === 'string' && !m.localId)), '坏附件被清洗（非法 localId 丢弃），数据照常下发');
    ok((await post('/api/login', { login: 'boss', password: 'boss1234' })).status === 200, '有坏附件数据后仍能登录'); }
  // 8.45 同一条操作重发（手机超时后重试）：只执行一次，返回当时的结果
  { const a1 = await post('/api/act', { name: 'idea.create', payload: { note: '重发测试' }, op: 'op_abcdef123456' }, boss);
    const a2 = await post('/api/act', { name: 'idea.create', payload: { note: '重发测试' }, op: 'op_abcdef123456' }, boss);
    const n = (await get('/api/state', boss)).state.ideas.filter(d => d.note === '重发测试').length;
    ok(a1.ok && a2.ok && a2.dup && a2.r.id === a1.r.id && n === 1, '同一操作 ID 重发只执行一次 ' + n);
    const a3 = await post('/api/act', { name: 'idea.create', payload: { note: '重发测试' }, op: 'op_abcdef999999' }, boss);
    ok(a3.ok && !a3.dup, '不同操作 ID 正常执行'); }
  // 8.46 操作日志
  { ok((await get('/api/ops', wTok)).status === 403, '普通成员看不到操作日志');
    const o1 = await get('/api/ops', boss); ok(o1.status === 200 && o1.ops.length > 0 && o1.ops[0].action && o1.ops[0].payload === undefined, '老板看操作日志（不含操作内容）');
    const o2 = await get('/api/ops?fail=1', boss); ok(o2.ops.length > 0 && o2.ops.every(x => !x.ok), '只看失败的操作');
    const o3 = await get('/api/ops?uid=u_owner', boss); ok(o3.ops.every(x => x.uid === 'u_owner'), '按人筛选'); }
  // 8.47 登录设备：列出、退出某一台、退出其他全部
  { const t2 = (await post('/api/login', { login: 'boss', password: 'boss1234' })).token, t3 = (await post('/api/login', { login: 'boss', password: 'boss1234' })).token;
    const ls = await get('/api/sessions', boss); ok(ls.sessions.length >= 3 && ls.sessions.filter(x => x.current).length === 1 && !JSON.stringify(ls).includes(boss), '列出登录设备（不回传令牌）');
    const other = ls.sessions.find(x => !x.current); await post('/api/sessions/revoke', { id: other.id }, boss);
    ok((await get('/api/sessions', boss)).sessions.length === ls.sessions.length - 1, '退出某一台设备');
    const ra = await post('/api/sessions/revoke', { all: true }, boss); ok(ra.n >= 1 && (await get('/api/state', t3)).status === 401 && (await get('/api/state', boss)).status === 200, '退出其他全部，这台保留'); }
  // 8.48 断点续传：分段上传，中断后从服务器已收到的位置接着传
  { const H = { Authorization: 'Bearer ' + boss, 'Content-Type': 'video/mp4', 'X-File-Name': encodeURIComponent('长视频.mp4') };
    const big = Buffer.alloc(900 * 1024); for (let i = 0; i < big.length; i++) big[i] = i % 251;
    const put = (off, buf) => fetch(B + '/api/files/f_chunk01/chunk?offset=' + off + '&total=' + big.length, { method: 'PUT', headers: H, body: buf });
    let r = await put(0, big.subarray(0, 300 * 1024)); let j = await r.json(); ok(r.status === 200 && !j.done && j.size === 300 * 1024, '第一段收到');
    const st1 = await (await fetch(B + '/api/files/f_chunk01/upload', { headers: { Authorization: 'Bearer ' + boss } })).json(); ok(!st1.done && st1.size === 300 * 1024, '中断后查到已收到 300KB');
    r = await put(0, big.subarray(0, 300 * 1024)); j = await r.json(); ok(r.status === 409 && j.size === 300 * 1024, '位置不对时告诉手机从哪里接着传');
    r = await put(300 * 1024, big.subarray(300 * 1024, 600 * 1024)); r = await put(600 * 1024, big.subarray(600 * 1024)); j = await r.json(); ok(j.done && j.size === big.length, '最后一段传完，文件合成');
    const got = Buffer.from(await (await fetch(B + '/api/files/f_chunk01', { headers: { Authorization: 'Bearer ' + boss } })).arrayBuffer()); ok(got.equals(big), '合成后的文件内容完全一致');
    const st2 = await (await fetch(B + '/api/files/f_chunk01/upload', { headers: { Authorization: 'Bearer ' + boss } })).json(); ok(st2.done, '传完后查询显示已完成');
    r = await fetch(B + '/api/files/f_chunk02/chunk?offset=0&total=' + (5 * 1048576), { method: 'PUT', headers: H, body: Buffer.alloc(10) }); ok(r.status === 413, '总大小超过上限被拒'); }
  // 8.5 附件
  const up = (id, body, tok, type) => fetch(B + '/api/files/' + id, { method: 'PUT', headers: { 'Content-Type': type || 'text/plain', 'X-File-Name': encodeURIComponent('会议记录.txt'), ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body });
  const liTok2 = (await post('/api/login', { login: 'xiaoli', password: 'li123456' })).token;
  ok((await up('f_abc123', 'hello', null)).status === 401, '没登录不能上传');
  ok((await up('bad id!', 'x', boss)).status === 400, '非法文件 ID');
  let ur = await up('f_abc123', '0123456789 附件内容', boss);
  ok(ur.status === 200 && (await ur.json()).size > 10, '老板上传附件');
  ok((await up('f_abc123', 'hack', liTok2)).status === 409, '别人不能覆盖这个文件');
  ok((await up('f_abc123', '0123456789 附件内容 v2', boss)).status === 200, '上传人重传（断网重试）可以覆盖');
  ok((await fetch(B + '/api/files/f_abc123', { headers: { Authorization: 'Bearer ' + liTok2 } })).status === 404, '没被任何想法 / 项目引用的附件，别人读不到');
  ok((await fetch(B + '/api/files/f_abc123', { headers: { Authorization: 'Bearer ' + boss } })).status === 200, '上传人自己能读');
  const liSt = await get('/api/state', liTok2); const liFt = liSt.fileToken;
  ok(typeof liFt === 'string' && liFt.length >= 32 && liFt !== liTok2, '数据接口给出单独的文件令牌');
  const wangR = await post('/api/act', { name: 'member.add', payload: { name: '小赵', title: '运营', role: 'operator', group: '行政运营' } }, boss);
  const zhao = wangR.state.users.find(u => u.name === '小赵').id;
  const pj = await post('/api/act', { name: 'project.create', payload: { title: '附件测试', ptype: 'tech', operatorId: zhao, goal: 'x', tasks: [{ title: '画图', ownerId: li, expected: '图', criteria: '好' }] } }, boss);
  ok((await post('/api/act', { name: 'work.attach', payload: { id: pj.r.workId, media: [{ kind: 'file', name: '会议记录.txt', localId: 'f_abc123' }] } }, boss)).ok, '老板把附件挂到小李参与的项目');
  let gr = await fetch(B + '/api/files/f_abc123?ft=' + liFt);
  ok(gr.status === 200 && (await gr.text()) === '0123456789 附件内容 v2' && /会议记录/.test(decodeURIComponent(gr.headers.get('content-disposition'))), '成员用链接令牌读取附件（含文件名）');
  gr = await fetch(B + '/api/files/f_abc123', { headers: { Authorization: 'Bearer ' + liTok2, Range: 'bytes=2-5' } });
  ok(gr.status === 206 && (await gr.text()) === '2345' && gr.headers.get('content-range') === 'bytes 2-5/' + Buffer.byteLength('0123456789 附件内容 v2'), '分段读取（iPhone 播放视频需要）');
  ok((await fetch(B + '/api/files/f_abc123')).status === 401, '没登录不能读取');
  ok((await fetch(B + '/api/files/f_abc123?token=' + liTok2)).status === 401, '网址里的会话令牌不再被接受（只认文件令牌）');
  ok((await fetch(B + '/api/state?token=' + liTok2)).status === 401, '数据接口不接受网址里的令牌');
  ok((await fetch(B + '/api/files/f_none00?ft=' + liFt)).status === 404, '不存在的文件');
  gr = await fetch(B + '/api/files/f_abc123?ft=' + liFt, { headers: { Range: 'bytes=0-999999' } });
  ok(gr.status === 206 && /^bytes 0-\d+\//.test(gr.headers.get('content-range')), '分段结束位置超出时截断到文件末尾');
  // 存储型 XSS：上传 HTML 不会按网页打开
  await up('f_evil0001', '<script>alert(localStorage.tm_token)</script>', liTok2, 'text/html');
  gr = await fetch(B + '/api/files/f_evil0001', { headers: { Authorization: 'Bearer ' + liTok2 } });
  ok(gr.headers.get('content-type') === 'application/octet-stream' && /attachment/.test(gr.headers.get('content-disposition')) && gr.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(gr.headers.get('content-security-policy') || ''), 'HTML 附件按下载处理（防 XSS）');
  await up('f_pic00001', 'GIF89a', liTok2, 'image/gif');
  gr = await fetch(B + '/api/files/f_pic00001', { headers: { Authorization: 'Bearer ' + liTok2 } });
  ok(gr.headers.get('content-type') === 'image/gif' && /inline/.test(gr.headers.get('content-disposition')), '图片仍可直接显示');
  await up('f_svg00001', '<svg onload=alert(1)>', liTok2, 'image/svg+xml');
  ok((await fetch(B + '/api/files/f_svg00001', { headers: { Authorization: 'Bearer ' + liTok2 } })).headers.get('content-type') === 'application/octet-stream', 'SVG 不当图片显示');
  // 操作结果不回传整个状态
  let ct = await post('/api/act', { name: 'constructor', payload: {} }, liTok2);
  ok(ct.ok === false && !(ct.r && ct.r.ideas) && !JSON.stringify(ct).includes('明年计划'), 'constructor 不能拿到整库');
  ct = await post('/api/act', { name: 'todo.create', payload: { title: 'x', date: '2026-10-03' } }, liTok2);
  ok(ct.ok && Object.values(ct.r).every(v => typeof v !== 'object'), '操作结果只回传简单字段');
  // 账号接口加固
  ok((await post('/api/accounts', { uid: 'u_owner', password: 'newpass1' }, boss)).status === 400, '改自己密码必须走修改密码（要原密码）');
  await post('/api/accounts', { uid: zhao, login: 'xiaozhao' }, boss);
  await post('/api/accounts/disable', { uid: zhao, disabled: true }, boss);
  await post('/api/accounts', { uid: zhao, reset: true }, boss);
  ok((await get('/api/accounts', boss)).accounts.find(a => a.uid === zhao).disabled === true, '给停用的账号重置密码不会悄悄恢复');

  ok((await up('f_big001', Buffer.alloc(1.5 * 1024 * 1024), boss, 'application/octet-stream')).status === 413, '超过大小上限被拒');
  ok(!fs.readdirSync(path.join(DIR, 'files')).some(f => f.includes('.part-') || f === 'f_big001'), '被拒的文件不留残片');
  // 8.8 在 App 里注销账号
  ok((await post('/api/account/deactivate', { password: 'boss1234' }, boss)).status === 400, '老板不能注销');
  const zt = await post('/api/accounts', { uid: zhao, password: 'zhao12345' }, boss);
  await post('/api/accounts/disable', { uid: zhao, disabled: false }, boss);
  const zTok = (await post('/api/login', { login: 'xiaozhao', password: 'zhao12345' })).token;
  ok((await post('/api/account/deactivate', { password: 'wrong' }, zTok)).status === 400, '注销要输对密码');
  ok((await post('/api/account/deactivate', { password: 'zhao12345' }, zTok)).ok, '成员注销账号（首次改密前也能注销）');
  ok((await get('/api/state', zTok)).status === 401 && (await post('/api/login', { login: 'xiaozhao', password: 'zhao12345' })).status === 403, '注销后会话失效、不能登录');
  ok((await get('/api/state', boss)).state.notifications.some(n => /注销/.test(n.title)), '老板收到注销通知');
  // 8.85 头像不能借用别人的私有附件
  await up('f_bossonly', 'TOPSECRET', boss);
  ok((await fetch(B + '/api/files/f_bossonly', { headers: { Authorization: 'Bearer ' + liTok2 } })).status === 404, '别人的私有附件读不到');
  await post('/api/act', { name: 'member.update', payload: { id: li, avatar: 'f_bossonly' } }, liTok2);
  ok((await fetch(B + '/api/files/f_bossonly', { headers: { Authorization: 'Bearer ' + liTok2 } })).status === 404, '把别人的附件设成头像也读不到');
  await up('f_liavatar', 'GIF89a', liTok2, 'image/gif');
  await post('/api/act', { name: 'member.update', payload: { id: li, avatar: 'f_liavatar' } }, liTok2);
  ok((await fetch(B + '/api/files/f_liavatar', { headers: { Authorization: 'Bearer ' + boss } })).status === 200, '自己上传的头像全队可见');
  // 8.9 使用情况、导出
  let us = await get('/api/usage', boss);
  ok(us.status === 200 && us.accounts >= 2 && us.files.count >= 1 && us.ai.enabled === false, '老板查看使用情况');
  ok((await get('/api/usage', liTok2)).status === 403, '执行者不能看使用情况');
  const ex = await get('/api/export', boss);
  ok(ex.status === 200 && ex.state.users.length >= 3 && ex.accounts.length >= 2 && !JSON.stringify(ex).includes('"hash"') && !JSON.stringify(ex).includes('"salt"'), '老板导出全部数据（不含密码）');
  ok((await get('/api/export', liTok2)).status === 403, '执行者不能导出');
  // 8.95 响应压缩
  const raw = await new Promise((ok) => require('http').get(B + '/api/state', { headers: { Authorization: 'Bearer ' + boss, 'Accept-Encoding': 'gzip' } }, (r) => { const ch = []; r.on('data', d => ch.push(d)); r.on('end', () => ok({ enc: r.headers['content-encoding'], body: Buffer.concat(ch) })); }));
  ok(raw.enc === 'gzip' && JSON.parse(require('zlib').gunzipSync(raw.body)).state.users.length >= 3, '数据接口 gzip 压缩');
  const raw2 = await new Promise((ok) => require('http').get(B + '/api/state', { headers: { Authorization: 'Bearer ' + boss } }, (r) => { const ch = []; r.on('data', d => ch.push(d)); r.on('end', () => ok({ enc: r.headers['content-encoding'], body: Buffer.concat(ch) })); }));
  ok(!raw2.enc && JSON.parse(raw2.body).state.users.length >= 3, '不支持压缩的客户端拿到原文');
  // 8.97 安卓安装包分发：没有安装包时不提示；放上安装包后 App 能查到新版本并下载；安装页公开
  ok((await get('/api/app')).android === null, '还没有安卓安装包：android 为空（不用登录也能查）');
  ok((await fetch(B + '/app/android.apk')).status === 404, '没有安装包时下载返回 404');
  fs.mkdirSync(path.join(DIR, 'app'), { recursive: true });
  fs.writeFileSync(path.join(DIR, 'app', 'teamops.apk'), Buffer.alloc(2048, 7));
  fs.writeFileSync(path.join(DIR, 'app', 'android.json'), JSON.stringify({ versionName: '1.4', versionCode: 5, at: 1, notes: '修复录音<闪退>' }));
  { const a = (await get('/api/app')).android;
    ok(a && a.versionName === '1.4' && a.versionCode === 5 && a.size === 2048 && a.url === '/app/android.apk' && a.notes === '修复录音<闪退>', '查到新版本信息 ' + JSON.stringify(a));
    const d = await fetch(B + '/app/android.apk'), buf = Buffer.from(await d.arrayBuffer());
    ok(d.status === 200 && d.headers.get('content-type') === 'application/vnd.android.package-archive' && /attachment/.test(d.headers.get('content-disposition')) && buf.length === 2048, '下载安装包（不用登录）');
    const pg = await fetch(B + '/app'), html = await pg.text();
    ok(pg.status === 200 && html.includes('下载安卓 App') && html.includes('1.4') && html.includes('/app/android.apk') && pg.headers.get('x-frame-options') === 'DENY', '安装页显示版本和下载按钮'); }
  { const pv = await fetch(B + '/privacy'), ht = await pv.text();
    ok(pv.status === 200 && /<h1>WSX OS · 隐私政策<\/h1>/.test(ht) && ht.includes('离线转写') && ht.includes('<li>') && !ht.includes('**'), '隐私政策网页（上架时填这个地址）'); }
  // 8.98 App 发来的诊断信息：要登录；记到 diag.log；太频繁会被拒
  ok((await post('/api/diag', { kind: 'speech', code: 5 })).status === 401, '诊断信息：没登录不收');
  { const r1 = await post('/api/diag', { kind: 'speech', error: 'aborted', code: 5, device: 'Xiaomi 13 · Android 14' }, boss);
    const log = fs.readFileSync(path.join(DIR, 'diag.log'), 'utf8');
    ok(r1.status === 200 && log.includes('"code":5') && log.includes('Xiaomi 13') && log.includes('"uid":"u_owner"'), '诊断信息记到 diag.log');
    let last = 0; for (let i = 0; i < 20; i++) last = (await post('/api/diag', { kind: 'x', i }, boss)).status;
    ok(last === 429, '一小时超过 20 条被拒'); }
  // 9. 重启后数据还在
  srv.kill(); await new Promise(z => setTimeout(z, 200)); srv = await start();
  r = await get('/api/state', boss);
  ok(r.status === 200 && r.state.users.length === 4 && r.state.ideas.some(d => d.note === '改过的草稿'), '重启后数据和会话都在');
  ok((await (await fetch(B + '/api/files/f_abc123', { headers: { Authorization: 'Bearer ' + boss } })).text()).endsWith('v2'), '重启后附件还在');
  ok(fs.readdirSync(path.join(DIR, 'backups')).length === 1, '每天一份备份');
  // 9.4 完整备份（含附件）：只有老板能下，压缩包里有团队数据和附件
  const tgz = path.join(DIR, 'full.tar.gz');
  { const bft = (await get('/api/state', boss)).fileToken;
    ok((await fetch(B + '/api/export.tgz?ft=' + liFt)).status === 403, '非老板不能下载完整备份');
    const rr = await fetch(B + '/api/export.tgz?ft=' + bft); fs.writeFileSync(tgz, Buffer.from(await rr.arrayBuffer()));
    const ls = require('child_process').spawnSync('tar', ['-tzf', tgz], { encoding: 'utf8' }).stdout;
    ok(rr.status === 200 && ls.includes('team-export.json') && ls.includes('files/f_abc123'), '完整备份是标准 tar.gz，含团队数据和附件 ' + ls.split('\n').length); }
  // 9.5 从备份恢复（先停服务器）
  srv.kill(); await new Promise(z => setTimeout(z, 300));
  const bk = path.join(DIR, 'backups', fs.readdirSync(path.join(DIR, 'backups')).find(f => f.startsWith('state-')));
  const { spawnSync } = require('child_process');
  let rs1 = spawnSync(process.execPath, [path.join(__dirname, 'server', 'restore.js'), bk], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', DATA_DIR: DIR }, encoding: 'utf8' });
  ok(/加 --yes/.test(rs1.stdout), '不加 --yes 只预览不恢复');
  ok(spawnSync(process.execPath, [path.join(__dirname, 'server', 'restore.js'), path.join(__dirname, 'package.json'), '--yes'], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', DATA_DIR: DIR }, encoding: 'utf8' }).status === 1, '无效文件被拒');
  rs1 = spawnSync(process.execPath, [path.join(__dirname, 'server', 'restore.js'), bk, '--yes'], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', DATA_DIR: DIR }, encoding: 'utf8' });
  ok(rs1.status === 0 && /已恢复/.test(rs1.stdout) && fs.readdirSync(path.join(DIR, 'backups')).some(f => f.startsWith('before-restore-')), '从每日备份恢复，恢复前另存当前数据');
  // 从完整备份恢复：附件丢了也能放回
  fs.rmSync(path.join(DIR, 'files', 'f_abc123'));
  rs1 = spawnSync(process.execPath, [path.join(__dirname, 'server', 'restore.js'), tgz, '--yes'], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', DATA_DIR: DIR }, encoding: 'utf8' });
  ok(rs1.status === 0 && /附件已放回：[1-9]/.test(rs1.stdout) && fs.existsSync(path.join(DIR, 'files', 'f_abc123')), '从完整备份恢复，附件放回 ' + rs1.stdout.slice(-80) + rs1.stderr.slice(0, 200));
  srv = await start();
  ok((await get('/api/state', boss)).status === 200, '恢复后账号仍能登录');
  ok((await (await fetch(B + '/api/files/f_abc123', { headers: { Authorization: 'Bearer ' + boss } })).text()).endsWith('v2'), '恢复后附件内容正确');
  // 10. 演示团队
  srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR);
  srv = await start();
  r = await post('/api/setup', { name: 'Enos', login: 'enos', password: 'enos1234', demo: true, code: 'code-1234' });
  ok(r.state.users.length === 7 && r.state.ideas.length > 0 && r.state.users[0].name === 'Enos', '可以带演示数据创建');
  // 任务交付物的照片：能看到任务的人能打开，看不到任务的人打不开
  { const enos = r.token, st0 = r.state;
    const t = st0.tasks.find(x => ['accepted', 'in_progress'].includes(x.status) && x.ownerId !== 'u_owner');
    const ex = st0.users.find(u => u.id === t.ownerId), out = st0.users.find(u => u.id !== t.ownerId && u.id !== t.reviewerId && u.id !== 'u_owner' && !['u_op', 'u_lead'].includes(u.id) && !u.roles.some(x => x.role === 'admin'));
    const pwOf = async (uid, login) => { const a = await post('/api/accounts', { uid, login, password: 'pass123456' }, enos); const lt = (await post('/api/login', { login, password: 'pass123456' })).token; await post('/api/password', { old: 'pass123456', password: 'pass654321' }, lt); return (await post('/api/login', { login, password: 'pass654321' })).token; };
    const exTok = await pwOf(ex.id, 'exec1'), outTok = await pwOf(out.id, 'other1');
    if (t.status === 'accepted') await post('/api/act', { name: 'task.transition', payload: { id: t.id, action: 'start' } }, exTok);
    ok((await fetch(B + '/api/files/b_dvphoto1', { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', Authorization: 'Bearer ' + exTok }, body: Buffer.from('jpg') })).status === 200, '执行人上传交付照片');
    const sub = await post('/api/act', { name: 'task.transition', payload: { id: t.id, action: 'submit', media: [{ kind: 'image', name: '现场照片.jpg', localId: 'b_dvphoto1' }] } }, exTok);
    ok(sub.ok, '只带照片提交成果 ' + (sub.error || ''));
    const canSee = async (tok) => (await fetch(B + '/api/files/b_dvphoto1', { headers: { Authorization: 'Bearer ' + tok } })).status;
    ok(await canSee(enos) === 200, '老板能打开交付照片');
    ok(await canSee(outTok) === 404, '看不到这个任务的人打不开交付照片'); }
  r = await post('/api/act', { name: 'data.clearDemo', payload: {} }, r.token);
  ok(r.ok && r.state.ideas.length === 0 && r.state.users.length === 7, '一键清理演示数据');
  srv.kill(); fs.rmSync(DIR, { recursive: true, force: true });
  console.log(`\n服务器 通过 ${pass}，失败 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
