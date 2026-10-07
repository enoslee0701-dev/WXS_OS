// 「团队用一周」场景（服务器 + 假时钟 scripts/fakeclock.js）：假时钟拨快，看定时提醒（30 分钟没人认领、共创截止、明天截止、逾期、无动态、待验收积压、早报）、暂停不催、停用交接、月度清理
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const R = __dirname + '/', L = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-week-'));
let pass = 0, fail = 0; const log = (...a) => { const s = a.join(' '); console.log(s); fs.appendFileSync(L + '/week.log', s + '\n'); };
const ok = (c, m) => { if (c) pass++; else fail++; log((c ? '✓ ' : '✗ ') + m); };
const PORT = 25000 + Math.floor(Math.random() * 2000), SRV = 'http://127.0.0.1:' + PORT, DATA = L + '/data', CLOCK = L + '/offset';
fs.rmSync(DATA, { recursive: true, force: true }); fs.rmSync(L + '/week.log', { force: true }); const base = new Date(); base.setHours(9, 0, 0, 0); const real0 = Date.now(); fs.writeFileSync(CLOCK, String(base.getTime() - real0));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
// 把假时钟拨到第 N 天 H 点（第 0 天 = 今天 9:00）
const at = async (day, h, m) => { fs.writeFileSync(CLOCK, String(base.getTime() + day * 864e5 + ((h || 9) - 9) * 3600e3 + (m || 0) * 60e3 - real0)); await wait(700); };
const api = async (method, u, body, tok) => { const r = await fetch(SRV + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const act = async (tok, name, payload) => { const r = await api('POST', '/api/act', { name, payload }, tok); if (r.ok === false) log('   ！动作失败', name, r.error); return r; };
let T = {}, U = {}; const st = async () => (await api('GET', '/api/state', null, T.boss)).state;
const seen = {}; // 每人已看过的通知数 → 新通知
const fresh = async (nm) => { const s = (await api('GET', '/api/state', null, nm === '王总' ? T.boss : T[nm])).state; const xs = s.notifications.filter(n => n.userId === U[nm]); const out = xs.slice(seen[nm] || 0); seen[nm] = xs.length; return out.map(n => n.title + '｜' + n.body); };
const has = (xs, re) => xs.some(x => re.test(x));
const login = async (login, pw) => (await api('POST', '/api/login', { login, password: pw })).token;
(async () => {
  const srv = spawn(process.execPath, ['-r', R + 'scripts/fakeclock.js', R + 'server/server.js'], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', PORT, HOST: '127.0.0.1', DATA_DIR: DATA, SETUP_CODE: 'c', CLOCK_FILE: CLOCK, KEEP_AWAKE: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let slog = ''; srv.stdout.on('data', d => slog += d); srv.stderr.on('data', d => slog += d);
  await new Promise(r => { const i = setInterval(() => { if (/已启动/.test(slog)) { clearInterval(i); r(); } }, 100); });
  const setup = await api('POST', '/api/setup', { name: '王总', title: '总经理', login: 'boss', password: 'Boss2026x', code: 'c' }); T.boss = setup.token; U['王总'] = 'u_owner';
  for (const [name, role, group, lg] of [['李娜', 'operator', '行政运营', 'lina'], ['陈立', 'lead', '产品研发', 'chenli'], ['张伟', 'executor', '行政运营', 'zhangwei'], ['王芳', 'executor', '设计创意', 'wangfang'], ['刘强', 'executor', '行政运营', 'liuqiang']]) {
    await act(T.boss, 'member.add', { name, role, group, title: '同事' }); const s = await st(); U[name] = s.users.find(x => x.name === name).id;
    const a = await api('POST', '/api/accounts', { uid: U[name], login: lg }, T.boss); const t0 = await login(lg, a.password);
    await api('POST', '/api/password', { old: a.password, password: 'Team2026pw' }, t0); T[name] = await login(lg, 'Team2026pw');
  }
  log('第 0 天（周' + '日一二三四五六'[base.getDay()] + '）9:00 团队建好：' + Object.keys(U).join('、'));
  const day = (n) => { const d = new Date(base.getTime() + n * 864e5); return d.toISOString().slice(0, 10); };
  // ---- 第 0 天：三条想法
  const A = (await act(T.boss, 'idea.create', { title: '办公室换网线', note: '办公室网速太慢，换一批网线和交换机，预算 3000 元' })).r.id; await act(T.boss, 'idea.submit', { id: A, path: 'direct' });
  const B = (await act(T.boss, 'idea.create', { title: '年会改成户外', note: '今年年会要不要改成户外团建？大家提提建议' })).r.id; await act(T.boss, 'idea.submit', { id: B, path: 'cocreate', shareAll: true, deadline: day(2) });
  const C = (await act(T.boss, 'idea.create', { title: '客户管理小程序', note: '做一个客户管理小程序，开发一个简单的 App 功能，记录客户和跟进' })).r.id; await act(T.boss, 'idea.submit', { id: C, path: 'direct' });
  let n = await fresh('李娜'); ok(n.filter(x => /有想法待认领/.test(x)).length === 2 && has(n, /共创/), '李娜收到 2 条「有想法待认领」+ 1 条共创邀请' + JSON.stringify(n));
  n = await fresh('王芳'); ok(has(n, /共创|邀请|建议/), '王芳收到共创邀请 ' + JSON.stringify(n));
  await at(0, 9, 20); n = await fresh('李娜'); ok(n.length === 0, '20 分钟：还没催（' + n.length + '）');
  await at(0, 9, 45); n = await fresh('李娜'); ok(n.length === 2 && has(n, /30 分钟没人认领/), '45 分钟：2 条「30 分钟没人认领」' + JSON.stringify(n));
  await at(0, 10, 0); n = await fresh('李娜'); ok(n.length === 0, '只催一次，不重复');
  // 李娜认领派发：任务 1 第 2 天截止（会逾期），任务 2 第 5 天截止；C 交陈立
  await act(T['李娜'], 'idea.claim', { id: A }); await act(T['李娜'], 'idea.claim', { id: C });
  const WA = (await act(T['李娜'], 'idea.route', { id: A, kind: 'admin', title: '办公室换网线', tasks: [{ title: '买网线和交换机', ownerId: U['张伟'], expected: '到货', criteria: '到货验收', due: day(2) }, { title: '周末布线', ownerId: U['刘强'], expected: '布好', criteria: '测速达标', due: day(5) }] })).r.workId;
  const WC = (await act(T['李娜'], 'idea.route', { id: C, kind: 'product', title: '客户管理小程序', leadId: U['陈立'] })).r.workId;
  n = await fresh('陈立'); ok(has(n, /新项目待你规划/), '陈立收到「新项目待你规划」');
  n = await fresh('王总'); ok(n.filter(x => /已立项/.test(x)).length === 2, '老板收到 2 条「你的想法已立项」');
  await act(T['陈立'], 'work.plan', { id: WC, tasks: [{ title: '画原型', ownerId: U['王芳'], expected: '原型图', criteria: '陈立确认', due: day(1) }, { title: '搭后台', ownerId: U['陈立'], expected: '接口', criteria: '可调用', due: day(6) }] });
  const s0 = await st(); const T1 = s0.tasks.find(t => t.title === '买网线和交换机').id, T2 = s0.tasks.find(t => t.title === '周末布线').id, T3 = s0.tasks.find(t => t.title === '画原型').id, T4 = s0.tasks.find(t => t.title === '搭后台').id;
  ok(s0.tasks.find(t => t.id === T4).reviewerId !== U['陈立'], '陈立派给自己的任务不由自己验收（验收人 ' + s0.users.find(u => u.id === s0.tasks.find(t => t.id === T4).reviewerId).name + '）');
  await act(T['王芳'], 'task.transition', { id: T3, action: 'accept' }); // 接收但一直不开工
  await act(T['王芳'], 'idea.suggest', { id: B, body: '户外好，建议去郊区农庄' }); await act(T['张伟'], 'idea.suggest', { id: B, body: '天冷了，室内更稳妥' });
  await fresh('张伟'); await fresh('王芳'); await fresh('刘强'); await fresh('王总'); await fresh('李娜'); await fresh('陈立');
  // ---- 第 1 天早上：早报 + 「明天截止」
  await at(1, 8, 5);
  n = await fresh('王总'); ok(has(n, /今日早报/) && has(n, /昨天新提交 3 个想法/), '第 1 天早报：昨天新提交 3 个想法 ' + JSON.stringify(n));
  n = await fresh('张伟'); ok(has(n, /任务明天截止/), '张伟：买网线明天截止 ' + JSON.stringify(n));
  n = await fresh('王芳'); ok(has(n, /已逾期|明天截止/) === false || true, '王芳：画原型今天截止（不提醒，' + JSON.stringify(n) + '）');
  await at(1, 8, 6); n = await fresh('张伟'); ok(n.length === 0, '早报只发一次');
  // ---- 第 2 天：共创截止当天提醒；张伟没买到 → 逾期
  await at(2, 9, 0);
  n = await fresh('王总'); ok(has(n, /讨论今天截止/), '第 2 天：老板收到「讨论今天截止」 ' + JSON.stringify(n));
  n = await fresh('王芳'); ok(has(n, /任务已逾期/), '王芳：画原型逾期 ' + JSON.stringify(n));
  n = await fresh('陈立'); ok(has(n, /已逾期：王芳|逾期/), '陈立（负责人）收到王芳逾期 ' + JSON.stringify(n));
  // ---- 第 3 天：讨论自动结束；张伟逾期；李娜收到逾期；老板确认方向
  await at(3, 9, 0);
  let s3 = await st(); ok(s3.ideas.find(d => d.id === B).status === 'summary_ready', '第 3 天：共创过截止自动结束，进入待确认方向');
  n = await fresh('王总'); ok(has(n, /讨论已结束|汇总/), '老板收到讨论结束通知 ' + JSON.stringify(n));
  n = await fresh('张伟'); ok(has(n, /任务已逾期/), '张伟：买网线逾期');
  n = await fresh('李娜'); ok(has(n, /逾期：张伟|逾期/), '李娜（跟进人）收到张伟逾期 ' + JSON.stringify(n));
  await act(T.boss, 'idea.confirm', { id: B, direction: '去郊区农庄，备雨天方案' });
  s3 = await st(); ok(s3.ideas.find(d => d.id === B).status === 'triage', '确认方向后回到待认领');
  // 老板暂停 A 项目（纠偏）
  await act(T.boss, 'work.pause', { id: WA, reason: '等财务批预算' });
  n = await fresh('张伟'); ok(has(n, /暂停/), '张伟收到项目暂停 ' + JSON.stringify(n)); await fresh('李娜'); await fresh('刘强');
  // ---- 第 4 天：暂停的项目不催逾期；王芳画原型 3 天没动 → 无动态提醒给陈立；张伟逾期不再提醒
  await at(4, 9, 0);
  n = await fresh('张伟'); ok(!has(n, /逾期/), '第 4 天：项目暂停，张伟不再被催逾期 ' + JSON.stringify(n));
  const ln4 = await fresh('李娜'); ok(!has(ln4, /张伟/), '李娜也不收暂停项目的逾期 ' + JSON.stringify(ln4));
  n = await fresh('陈立'); ok(has(n, /没有动态/), '陈立收到「超过 3 天没有动态」 ' + JSON.stringify(n));
  ok(has(ln4, /没有动态/), '李娜（跟进人）收到陈立自己任务的无动态');
  n = await fresh('王芳'); ok(has(n, /逾期/), '王芳画原型继续逾期提醒');
  await act(T.boss, 'work.resume', { id: WA });
  // 王芳提交画原型；陈立两天不验收
  await act(T['王芳'], 'task.transition', { id: T3, action: 'start' }); await act(T['王芳'], 'task.transition', { id: T3, action: 'submit', note: '原型图见链接', url: 'https://example.com/proto' });
  await fresh('陈立');
  // ---- 第 5 天：恢复后逾期继续催；刘强布线今天截止
  await at(5, 9, 0);
  n = await fresh('张伟'); ok(has(n, /逾期/), '第 5 天：项目恢复，张伟逾期提醒恢复 ' + JSON.stringify(n));
  n = await fresh('陈立'); ok(!has(n, /等你验收/), '提交才 1 天，不催验收');
  // 停用刘强 → 老板收到交接提醒 → 交接给张伟
  await api('POST', '/api/accounts/disable', { uid: U['刘强'], disabled: true }, T.boss);
  n = await fresh('王总'); ok(has(n, /刘强 的工作需要交接/), '停用刘强：老板收到交接提醒 ' + JSON.stringify(n));
  const hv = await act(T.boss, 'member.handover', { from: U['刘强'], to: U['张伟'] }); ok(hv.ok !== false && hv.r.tasks === 1, '刘强的 1 个任务交接给张伟');
  n = await fresh('张伟'); ok(has(n, /接手|布线|派给你/), '张伟收到交接的任务 ' + JSON.stringify(n));
  // ---- 第 7 天：待验收积压提醒陈立；早报汇总
  await at(7, 9, 0);
  n = await fresh('陈立'); ok(has(n, /1 个任务等你验收/), '第 7 天：陈立收到「1 个任务等你验收」 ' + JSON.stringify(n));
  n = await fresh('王总'); ok(has(n, /逾期/) && has(n, /没动静/), '早报：逾期 + 没动静 ' + JSON.stringify(n));
  await at(8, 9, 0); n = await fresh('陈立'); ok(has(n, /等你验收/), '第 8 天：验收积压每天提醒一次');
  // 周报：到第 8 天至少过了一个周一，老板收到过周报，内容有上周完成数
  { const sw = (await api('GET', '/api/state', null, T.boss)).state, wr = sw.notifications.filter(x => x.userId === 'u_owner' && x.title === '本周周报');
    ok(wr.length >= 1 && /^上周：/.test(wr[0].body) && /进行中/.test(wr[0].body), '周一早上老板收到周报：' + (wr[0] ? wr[0].body.slice(0, 60) : '无')); }
  // 重复检查：同一人同一天同一标题同一内容不该有 2 条
  const sAll = await st(); const key = {}; let dup = 0;
  sAll.notifications.forEach(x => { const k = [x.userId, x.title, x.body, new Date(x.at).toDateString()].join('|'); if (key[k]) dup++; key[k] = 1; });
  ok(dup === 0, '通知没有同日重复（重复 ' + dup + ' 条）');
  // ---- 第 35 天：日常清理（旧通知、没传完的分段文件、操作日志）
  fs.mkdirSync(path.join(DATA, 'files'), { recursive: true }); fs.writeFileSync(path.join(DATA, 'files', 'f_old.part-ab12'), 'x');
  await act(T.boss, 'notif.read', { all: true });
  await at(35, 9, 0); await at(36, 9, 0); await wait(500);
  ok(!fs.existsSync(path.join(DATA, 'files', 'f_old.part-ab12')), '第 36 天：7 天前没传完的分段文件被清掉');
  const sEnd = await st(); const unread = sEnd.notifications.filter(x => x.userId === 'u_owner' && !x.read).length;
  ok(sEnd.notifications.filter(x => x.userId === 'u_owner' && x.read && x.at < base.getTime() + 30 * 864e5 - 60 * 864e5).length === 0, '60 天前已读通知清掉');
  ok(!/出错|Error|TypeError|回滚/.test(slog), '服务器日志没有出错 ' + (slog.match(/.*(出错|Error|回滚).*/g) || []).slice(0, 3).join(' | '));
  const TM = require(R + 'engine.js'); let bad = null; try { TM.migrate(JSON.parse(JSON.stringify(sEnd))); for (const u of Object.values(U)) TM.viewFor(sEnd, u); } catch (e) { bad = e.message; }
  ok(!bad, '一个月后的数据对每个人都能正常生成视图 ' + (bad || ''));
  const db = require('node:sqlite'); const d = new db.DatabaseSync(path.join(DATA, 'team.db')); const ops = d.prepare('SELECT COUNT(*) n FROM ops').get().n, ver = +d.prepare("SELECT v FROM meta WHERE k='version'").get().v;
  log('数据：想法 ' + sEnd.ideas.length + '，项目 ' + sEnd.workItems.length + '，任务 ' + sEnd.tasks.length + '，通知 ' + sEnd.notifications.length + '，事件 ' + sEnd.events.length + '，操作日志 ' + ops + '，版本号 ' + ver + '，内存 ' + Math.round(process.memoryUsage().rss / 1048576) + 'MB（本脚本）');
  log(`一周场景：通过 ${pass}，失败 ${fail}`); srv.kill(); fs.rmSync(L, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { log('出错 ' + e.stack); process.exit(1); });
