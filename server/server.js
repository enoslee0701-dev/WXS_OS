/* 团队协同 · 服务器（零依赖：node:http + node:sqlite）
   - 权威数据在服务器：客户端发来操作，服务器用登录身份跑同一个 engine.js，再按身份裁剪后下发
   - 账号由老板 / 管理员创建并分派；密码 scrypt 加盐；会话令牌（只走请求头）+ 只能读附件的文件令牌（可放进网址）
   - SSE 推送版本号，客户端收到后拉取最新数据
   用法：node server/server.js
   环境变量：PORT（8787）、HOST（0.0.0.0）、DATA_DIR（server/data）、MAX_FILE_MB（500）、USER_QUOTA_MB（5000）、
            SETUP_CODE（首次创建团队的初始化码；不设则随机生成并打印）、TRUST_PROXY=1（在反向代理后，按 X-Forwarded-For 识别 IP） */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const { DatabaseSync } = require('node:sqlite');
const TM = require('../engine.js');
const AI = require('./ai.js');
const TR = require('./transcribe.js');
const LLM = require('./llm.js');
const PUSH = require('./push.js');

const PORT = +process.env.PORT || 8787, HOST = process.env.HOST || '0.0.0.0';
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const WEB = path.join(__dirname, '..', 'dist', 'team-ops.html');
const SESSION_DAYS = 90, MAX_BODY = 2 * 1024 * 1024, MAX_FILE = (+process.env.MAX_FILE_MB || 500) * 1024 * 1024;
const QUOTA = (+process.env.USER_QUOTA_MB || 5000) * 1024 * 1024;
const FILES = path.join(DATA, 'files');
fs.mkdirSync(path.join(DATA, 'backups'), { recursive: true }); fs.mkdirSync(FILES, { recursive: true });

/* ---------- 数据库 ---------- */
const db = new DatabaseSync(path.join(DATA, 'team.db'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS creds(uid TEXT PRIMARY KEY, login TEXT UNIQUE COLLATE NOCASE, salt TEXT, hash TEXT, must_change INTEGER DEFAULT 1, disabled INTEGER DEFAULT 0, created INTEGER, last_login INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, uid TEXT, created INTEGER, seen INTEGER, agent TEXT);
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, uid TEXT, name TEXT, type TEXT, size INTEGER, created INTEGER);
CREATE TABLE IF NOT EXISTS ai_log(at INTEGER, uid TEXT, kind TEXT, in_tok INTEGER, out_tok INTEGER, ok INTEGER);
CREATE TABLE IF NOT EXISTS devices(token TEXT PRIMARY KEY, uid TEXT, platform TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS ai_jobs(summary_id TEXT PRIMARY KEY, at INTEGER);
CREATE TABLE IF NOT EXISTS transcripts(file_id TEXT PRIMARY KEY, status TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS ops(seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, uid TEXT, action TEXT, payload TEXT, ok INTEGER, error TEXT);`);
// 操作 ID：手机重发同一条操作（超时、断线后重试）时不重复执行
if (!db.prepare('PRAGMA table_info(ops)').all().some(c => c.name === 'op_id')) { db.exec('ALTER TABLE ops ADD COLUMN op_id TEXT'); db.exec('ALTER TABLE ops ADD COLUMN r TEXT'); }
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ops_op_id ON ops(op_id) WHERE op_id IS NOT NULL');
if (!db.prepare('PRAGMA table_info(sessions)').all().some(c => c.name === 'ft')) db.exec('ALTER TABLE sessions ADD COLUMN ft TEXT');
if (!db.prepare('PRAGMA table_info(devices)').all().some(c => c.name === 'session')) db.exec('ALTER TABLE devices ADD COLUMN session TEXT');
const q = (sql) => db.prepare(sql);
const getMeta = (k) => { const r = q('SELECT v FROM meta WHERE k=?').get(k); return r ? r.v : null; };
const setMeta = (k, v) => q('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, v);

let S = null, version = 0;
(function load() {
  const raw = getMeta('state');
  if (raw) { S = TM.migrate(JSON.parse(raw)); version = +getMeta('version') || 1; }
})();
function persist() {
  setMeta('state', JSON.stringify(S)); setMeta('version', String(version));
  const day = new Date().toISOString().slice(0, 10), f = path.join(DATA, 'backups', 'state-' + day + '.json');
  if (!fs.existsSync(f)) fs.writeFile(f, JSON.stringify(S), () => {});
}
/* 首次创建团队需要初始化码（防止同一网络里有人抢先创建团队、成为老板） */
const SETUP_FILE = path.join(DATA, 'setup-code.txt');
let SETUP_CODE = null;
if (!S) {
  SETUP_CODE = process.env.SETUP_CODE || (fs.existsSync(SETUP_FILE) ? fs.readFileSync(SETUP_FILE, 'utf8').trim() : String(crypto.randomInt(100000, 1000000)));
  if (!process.env.SETUP_CODE) fs.writeFileSync(SETUP_FILE, SETUP_CODE, { mode: 0o600 });
}

/* ---------- 密码与会话 ---------- */
function hashPw(pw, salt) { return crypto.scryptSync(String(pw), salt, 32).toString('hex'); }
const DUMMY = { salt: crypto.randomBytes(16).toString('hex'), hash: '' }; DUMMY.hash = hashPw('x', DUMMY.salt);
function checkPw(c, pw) { const h = Buffer.from(hashPw(pw, c.salt), 'hex'), x = Buffer.from(c.hash, 'hex'); return h.length === x.length && crypto.timingSafeEqual(h, x); }
function genPw() { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const b = crypto.randomBytes(8); for (let i = 0; i < 8; i++) s += A[b[i] % A.length]; return s.slice(0, 4) + '-' + s.slice(4); }
function setCred(uid, login, pw, mustChange) {
  const salt = crypto.randomBytes(16).toString('hex'), t = Date.now();
  // 注意：不碰 disabled（给停用的账号重置密码，不会悄悄恢复启用）
  q(`INSERT INTO creds(uid,login,salt,hash,must_change,disabled,created) VALUES(?,?,?,?,?,0,?)
     ON CONFLICT(uid) DO UPDATE SET login=excluded.login, salt=excluded.salt, hash=excluded.hash, must_change=excluded.must_change`).run(uid, login, salt, hashPw(pw, salt), mustChange ? 1 : 0, t);
}
// 新登录时顺带清理：这个人过期的会话，并且每人最多保留 20 个（最旧的先踢）
function pruneSessions(uid) {
  dropSessions('uid=? AND seen<?', uid, Date.now() - SESSION_DAYS * 864e5);
  const keep = q('SELECT token FROM sessions WHERE uid=? ORDER BY seen DESC LIMIT 19').all(uid).map(r => r.token);
  if (keep.length >= 19) dropSessions('uid=? AND token NOT IN (' + keep.map(() => '?').join(',') + ')', uid, ...keep);
}
function newSession(uid, agent) { pruneSessions(uid); const tok = crypto.randomBytes(32).toString('hex'), ft = crypto.randomBytes(24).toString('hex'), t = Date.now(); q('INSERT INTO sessions(token,uid,created,seen,agent,ft) VALUES(?,?,?,?,?,?)').run(tok, uid, t, t, String(agent || '').slice(0, 120), ft); return { token: tok, ft }; }
function dropSessions(where, ...args) { q('DELETE FROM devices WHERE session IN (SELECT token FROM sessions WHERE ' + where + ')').run(...args); q('DELETE FROM sessions WHERE ' + where).run(...args); kickStale(); }
/* 会话令牌只认请求头；网址里只在 SSE（EventSource 不能带请求头）时认 token，读附件时认文件令牌 ft */
function auth(req, url, mode) {
  const h = req.headers.authorization || '';
  let s = null;
  if (h.startsWith('Bearer ')) s = q('SELECT * FROM sessions WHERE token=?').get(h.slice(7));
  else if (mode === 'sse' && url.searchParams.get('token')) s = q('SELECT * FROM sessions WHERE token=?').get(url.searchParams.get('token'));
  else if (mode === 'file' && url.searchParams.get('ft')) s = q('SELECT * FROM sessions WHERE ft=?').get(url.searchParams.get('ft'));
  if (!s) return null;
  if (s.seen < Date.now() - SESSION_DAYS * 864e5) { q('DELETE FROM sessions WHERE token=?').run(s.token); return null; }
  const c = q('SELECT * FROM creds WHERE uid=?').get(s.uid);
  if (!c || c.disabled || !S || !TM.user(S, s.uid)) return null;
  if (s.seen < Date.now() - 60e3) q('UPDATE sessions SET seen=? WHERE token=?').run(Date.now(), s.token);
  return { uid: s.uid, token: s.token, ft: s.ft, mustChange: !!c.must_change, login: c.login };
}
/* 登录限流：同一 IP+账号 15 分钟最多 10 次失败，同一 IP 最多 50 次；账号不存在也算一次哈希（防止按耗时猜账号） */
const fails = new Map(), WIN = 15 * 60e3;
// 公网通道（cloudflared）在本机转发：来自本机的请求按通道给的真实 IP 限流，否则所有外网用户共用一个 127.0.0.1
const isLoop = (a) => /^(127\.|::1$|::ffff:127\.)/.test(a || '');
const clientIp = (req) => (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
  : isLoop(req.socket.remoteAddress) && req.headers['cf-connecting-ip'] ? String(req.headers['cf-connecting-ip']).trim().slice(0, 64) : req.socket.remoteAddress) || '?';
function limited(key, max) { const f = fails.get(key); return !!f && f.n >= max && f.t > Date.now() - WIN; }
function failed(key) { const f = fails.get(key); if (!f || f.t < Date.now() - WIN) fails.set(key, { n: 1, t: Date.now() }); else f.n++; }
setInterval(() => { const t = Date.now() - WIN; for (const [k, f] of fails) if (f.t < t) fails.delete(k); }, 5 * 60e3).unref();
const isOwner = (uid) => TM.hasRole(S, uid, 'owner');
const isMgr = (uid) => isOwner(uid) || TM.hasRole(S, uid, 'admin');
const LOGIN_RE = /^[A-Za-z0-9_.@-]{3,32}$/;

/* ---------- SSE ---------- */
const clients = new Set();
function broadcast() { const msg = 'event: v\ndata: ' + JSON.stringify({ version }) + '\n\n'; clients.forEach(c => { try { c.res.write(msg); } catch (e) {} }); }
/* 退出、停用、重置密码后：断开已失效会话的推送连接 */
function kickStale() { clients.forEach(c => { if (!q('SELECT 1 FROM sessions WHERE token=?').get(c.token)) { try { c.res.end(); } catch (e) {} clients.delete(c); } }); }
setInterval(() => clients.forEach(c => { try { c.res.write(': ping\n\n'); } catch (e) {} }), 25e3).unref();

/* 数据变了：版本 +1、写库、通知在线客户端；新产生的通知发 iOS 推送 */
function changed(nNotif) {
  version++; persist(); broadcast();
  if (typeof nNotif === 'number') pushNew(S.notifications.slice(nNotif));
}
function pushNew(list) {
  if (!PUSH.enabled() || !list.length) return;
  list.forEach(n => {
    const u = TM.user(S, n.userId); if (!u || (u.prefs && u.prefs.notifyImportant === false)) return;
    const badge = S.notifications.filter(x => x.userId === n.userId && !x.read).length;
    // 只推给还登录着的设备（会话有效、账号没停用）
    q('SELECT d.token FROM devices d JOIN sessions s ON s.token = d.session JOIN creds c ON c.uid = d.uid WHERE d.uid=? AND c.disabled=0').all(n.userId).forEach(d => {
      PUSH.send(d.token, { title: n.title, body: n.body, link: n.link, badge }).then(r => { if (PUSH.dead(r)) q('DELETE FROM devices WHERE token=?').run(d.token); }).catch(e => console.error('推送出错', e));
    });
  });
}

/* ---------- HTTP ---------- */
/* 响应压缩：完整数据用久了会到几 MB，压缩后只有几百 KB（brotli / gzip，按客户端支持选） */
const zlib = require('zlib');
function send(res, code, obj) {
  if (res.headersSent) return;
  let b = Buffer.from(JSON.stringify(obj)); const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' };
  const ae = String((res.req && res.req.headers['accept-encoding']) || '');
  if (b.length > 1024) {
    if (/\bbr\b/.test(ae)) { b = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }); h['Content-Encoding'] = 'br'; }
    else if (/\bgzip\b/.test(ae)) { b = zlib.gzipSync(b, { level: 6 }); h['Content-Encoding'] = 'gzip'; }
  }
  h['Content-Length'] = b.length; res.writeHead(code, h); res.end(b);
}
function body(req, limit) {
  const max = limit || MAX_BODY;
  return new Promise((ok, bad) => { let n = 0; const ch = []; req.on('data', d => { n += d.length; if (n > max) { bad(new Error('too large')); req.destroy(); } else ch.push(d); }); req.on('end', () => { try { const v = ch.length ? JSON.parse(Buffer.concat(ch).toString('utf8')) : {}; ok(v && typeof v === 'object' ? v : {}); } catch (e) { e.badRequest = true; bad(e); } }); req.on('error', bad); });
}
const stateFor = (uid) => ({ version, state: TM.viewFor(S, uid) });
// 操作结果只回传简单字段（新建记录的 ID 等），绝不回传对象
const pickR = (r) => { const o = {}; Object.keys(r || {}).forEach(k => { const v = r[k]; if (k !== 'ok' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) o[k] = v; }); return o; };

const routes = {
  'GET /api/health': async () => [200, { ok: true, version, setup: !!S }],
  // 安卓安装包（npm run android 会把新版放到 DATA/app/）：App 启动时查有没有新版本
  'GET /api/app': async () => [200, { android: androidMeta() }],
  // App 发来的诊断信息（语音识别出错的错误代码、手机型号等，不含内容）：记到 DATA/diag.log，方便排查真机问题
  'POST /api/diag': async (req, url, b, me) => {
    const now = Date.now(), k = me.uid, w = diagRate.get(k) || []; const recent = w.filter(t => now - t < 3600e3);
    if (recent.length >= 20) return [429, { error: '太频繁' }];
    recent.push(now); diagRate.set(k, recent);
    const line = JSON.stringify({ at: new Date(now).toISOString(), uid: me.uid, login: me.login, ua: String(req.headers['user-agent'] || '').slice(0, 200), d: b }).slice(0, 4000);
    const f = path.join(DATA, 'diag.log');
    try { if (fs.existsSync(f) && fs.statSync(f).size > 1048576) fs.renameSync(f, f + '.old'); fs.appendFileSync(f, line + '\n'); } catch (e) {}
    return [200, { ok: true }];
  },
  'GET /api/setup': async () => [200, { needsSetup: !S }],
  /* 首次启动：老板创建团队（可选带演示数据），需要服务器日志里的初始化码 */
  'POST /api/setup': async (req, url, b) => {
    if (S) return [409, { error: '团队已经创建过了' }];
    const key = 'setup|' + clientIp(req);
    if (limited(key, 10)) return [429, { error: '尝试次数太多，请 15 分钟后再试' }];
    const code = String(b.code || '').trim();
    if (!code || !crypto.timingSafeEqual(crypto.createHash('sha256').update(code).digest(), crypto.createHash('sha256').update(SETUP_CODE).digest())) { failed(key); return [403, { error: '初始化码不对（在服务器启动时显示，也保存在数据目录的 setup-code.txt）' }]; }
    const name = String(b.name || '').trim(), login = String(b.login || '').trim(), pw = String(b.password || '');
    if (!name) return [400, { error: '请填写你的姓名' }];
    if (!LOGIN_RE.test(login)) return [400, { error: '账号 3–32 位，只能用字母、数字和 _ . @ -' }];
    if (pw.length < 6) return [400, { error: '密码至少 6 位' }];
    if (b.demo) { S = TM.migrate(TM.seed()); const o = TM.user(S, 'u_owner'); o.name = name.slice(0, 20); if (b.title) o.title = String(b.title).slice(0, 16); }
    else S = TM.blank({ name: name.slice(0, 20), title: String(b.title || '').slice(0, 16) });
    version = 1; persist(); setCred('u_owner', login, pw, false);
    fs.rm(SETUP_FILE, () => {}); SETUP_CODE = null;
    const ss = newSession('u_owner', req.headers['user-agent']);
    return [200, { token: ss.token, fileToken: ss.ft, uid: 'u_owner', ...stateFor('u_owner') }];
  },
  'POST /api/login': async (req, url, b) => {
    if (!S) return [409, { error: '团队还没有创建', needsSetup: true }];
    const login = String(b.login || '').trim().slice(0, 64), ip = clientIp(req), key = ip + '|' + login.toLowerCase();
    if (limited(key, 10) || limited(ip, 50)) return [429, { error: '尝试次数太多，请 15 分钟后再试' }];
    const c = q('SELECT * FROM creds WHERE login=?').get(login);
    if (!checkPw(c || DUMMY, b.password || '') || !c) { failed(key); failed(ip); return [401, { error: '账号或密码不对' }]; }
    if (c.disabled) return [403, { error: '这个账号已停用，请联系老板或管理员' }];
    if (!TM.user(S, c.uid)) return [403, { error: '这个账号对应的成员不存在了' }];
    fails.delete(key); q('UPDATE creds SET last_login=? WHERE uid=?').run(Date.now(), c.uid);
    const ss = newSession(c.uid, req.headers['user-agent']);
    return [200, { token: ss.token, fileToken: ss.ft, uid: c.uid, mustChange: !!c.must_change, ...stateFor(c.uid) }];
  },
  'POST /api/logout': async (req, url, b, me) => { dropSessions('token=?', me.token); return [200, { ok: true }]; },
  'GET /api/me': async (req, url, b, me) => [200, { uid: me.uid, login: me.login, mustChange: me.mustChange }],
  'GET /api/state': async (req, url, b, me) => [200, { ...stateFor(me.uid), fileToken: me.ft, mustChange: me.mustChange }],
  /* 执行业务操作：权限全部由 engine.js 按登录身份判断 */
  'POST /api/act': async (req, url, b, me) => {
    const name = String(b.name || '').slice(0, 64), payload = b.payload && typeof b.payload === 'object' && !Array.isArray(b.payload) ? b.payload : {};
    const opId = typeof b.op === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(b.op) ? me.uid + ':' + b.op : null;
    if (opId) { const prev = q('SELECT ok,error,r FROM ops WHERE op_id=?').get(opId); if (prev) { let pr = {}; try { pr = JSON.parse(prev.r || '{}'); } catch (e) {} return [200, { ok: !!prev.ok, dup: true, error: prev.ok ? undefined : prev.error, r: pr, ...stateFor(me.uid) }]; } }
    const snap = JSON.stringify(S), nSum = S.summaries.length, nNotif = S.notifications.length; let r;
    // 清理数据前留一份完整备份
    if (name === 'data.clearDemo' && isOwner(me.uid)) fs.writeFileSync(path.join(DATA, 'backups', 'before-clear-' + Date.now() + '.json'), snap);
    try { r = TM.act(S, me.uid, name, payload); }
    catch (e) { S = JSON.parse(snap); console.error('act 异常', name, e); r = { ok: false, error: '服务器处理出错，已回滚' }; }
    // 操作成功后先试算一次下发数据：算不出来（坏数据）就回滚，避免「操作已存下但谁都读不出来」
    let st = null;
    if (r.ok) { try { st = stateFor(me.uid); } catch (e) { S = JSON.parse(snap); console.error('act 后数据无法下发，已回滚', name, e); r = { ok: false, error: '这次操作的数据有问题，已撤销' }; } }
    q('INSERT INTO ops(at,uid,action,payload,ok,error,op_id,r) VALUES(?,?,?,?,?,?,?,?)').run(Date.now(), me.uid, name, JSON.stringify(payload).slice(0, 20000), r.ok ? 1 : 0, r.ok ? null : String(r.error || '').slice(0, 200), opId, JSON.stringify(pickR(r)));
    if (r.ok) { changed(nNotif); if (st) st.version = version; autoAnalyze(S.summaries.slice(nSum)); if (/^idea\.(create|attach|update|submit)$/.test(name)) setTimeout(trScan, 50); }
    return [200, { ok: !!r.ok, error: r.ok ? undefined : r.error, r: pickR(r), ...(st || stateFor(me.uid)) }];
  },
  'POST /api/password': async (req, url, b, me) => {
    const c = q('SELECT * FROM creds WHERE uid=?').get(me.uid), pk = 'pw|' + me.uid;
    if (limited(pk, 10)) return [429, { error: '尝试次数太多，请 15 分钟后再试' }];
    if (!me.mustChange && !checkPw(c, b.old || '')) { failed(pk); return [400, { error: '原密码不对' }]; }
    const pw = String(b.password || ''); if (pw.length < 6) return [400, { error: '新密码至少 6 位' }];
    setCred(me.uid, c.login, pw, false);
    dropSessions('uid=? AND token<>?', me.uid, me.token);
    return [200, { ok: true }];
  },
  /* 在 App 里注销自己的账号（App Store 要求）：需要当前密码；老板不能注销（团队会没人管） */
  'POST /api/account/deactivate': async (req, url, b, me) => {
    if (isOwner(me.uid)) return [400, { error: '老板的账号不能注销。如需交接团队，请联系开发者' }];
    const c = q('SELECT * FROM creds WHERE uid=?').get(me.uid), pk = 'pw|' + me.uid;
    if (limited(pk, 10)) return [429, { error: '尝试次数太多，请 15 分钟后再试' }];
    if (!checkPw(c, b.password || '')) { failed(pk); return [400, { error: '密码不对' }]; }
    q('UPDATE creds SET disabled=1 WHERE uid=?').run(me.uid);
    dropSessions('uid=?', me.uid);
    q('DELETE FROM devices WHERE uid=?').run(me.uid);
    const n0 = S.notifications.length, r = TM.act(S, 'agent', 'account.deactivated', { id: me.uid });
    if (r.ok) changed(n0);
    return [200, { ok: true }];
  },
  /* iOS 推送：登记 / 注销设备（同一台手机换人登录，归属跟着换） */
  'POST /api/devices': async (req, url, b, me) => {
    const t = String(b.token || '').toLowerCase(); if (!/^[0-9a-f]{64,200}$/.test(t) || t.length % 2) return [400, { error: '设备令牌不对' }];
    q('INSERT INTO devices(token,uid,platform,created,session) VALUES(?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET uid=excluded.uid, platform=excluded.platform, session=excluded.session, created=excluded.created').run(t, me.uid, b.platform === 'android' ? 'android' : 'ios', Date.now(), me.token);
    // 每人最多 10 台设备，多了删最早的
    q('DELETE FROM devices WHERE uid=? AND token NOT IN (SELECT token FROM devices WHERE uid=? ORDER BY created DESC LIMIT 10)').run(me.uid, me.uid);
    return [200, { ok: true, push: PUSH.enabled() }];
  },
  'POST /api/devices/remove': async (req, url, b, me) => { q('DELETE FROM devices WHERE token=? AND uid=?').run(String(b.token || '').toLowerCase(), me.uid); return [200, { ok: true }]; },
  /* 真实 AI：没配置密钥或没有权限时 enabled=false，客户端用规则模拟 */
  'GET /api/ai/status': async (req, url, b, me) => [200, { enabled: AI.enabled() && AI.allowed(S, me.uid), configured: AI.enabled(), model: AI.MODEL, provider: AI.provider(), transcribe: TR.enabled() }],
  'POST /api/ai/ask': async (req, url, b, me) => aiRun(me, 'ask', () => AI.ask(S, me.uid, String(b.q || ''), b.history, b.focus && typeof b.focus === 'object' ? { type: String(b.focus.type || ''), id: String(b.focus.id || '') } : null)),
  'POST /api/ai/kb': async (req, url, b, me) => {
    if (!TM.kbCan(S, me.uid)) return [403, { error: '只有老板或管理员可以整理知识库' }];
    return aiRun(me, 'kb', () => AI.kbOrganize(S, me.uid, String(b.topic || ''), String(b.text || '')));
  },
  'POST /api/ai/project': async (req, url, b, me) => {
    if (!TM.canCreateProject(S, me.uid)) return [403, { error: '你不能新建项目' }];
    const text = String(b.text || '').trim(); if (text.length < 6) return [400, { error: '内容太少' }];
    return aiRun(me, 'project', () => AI.parseProject(S, me.uid, text));
  },
  'POST /api/ai/write': async (req, url, b, me) => {
    const kind = b.kind === 'goal' ? 'goal' : b.kind === 'task' ? 'task' : 'optimize';
    if (!String(b.title || b.note || '').trim()) return [400, { error: '先写项目名称或描述' }];
    return aiRun(me, 'write', () => AI.writeHelper(kind, b.title, b.note, b.due));
  },
  'POST /api/ai/todos': async (req, url, b, me) => {
    const text = String(b.text || '').trim(); if (text.length < 4) return [400, { error: '内容太少' }];
    return aiRun(me, 'todos', () => AI.parseTodos(S, me.uid, text));
  },
  'POST /api/ai/image': async (req, url, b, me) => {
    const data = String(b.data || ''), type = String(b.type || '');
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return [400, { error: '只支持 JPG、PNG、WebP、GIF 图片' }];
    if (!/^[A-Za-z0-9+/=]+$/.test(data) || data.length < 16) return [400, { error: '图片格式不对' }];
    if (data.length > 7 * 1048576) return [413, { error: '图片太大' }];
    return aiRun(me, 'image', () => AI.readImage(data, type));
  },
  'POST /api/ai/doc': async (req, url, b, me) => {
    if (!TM.kbCan(S, me.uid)) return [403, { error: '只有老板或管理员可以整理知识库' }];
    const data = String(b.data || ''); if (!/^[A-Za-z0-9+/=]+$/.test(data) || data.length < 16) return [400, { error: '文件格式不对' }];
    if (Buffer.from(data.slice(0, 8), 'base64').toString('latin1').indexOf('%PDF') !== 0) return [400, { error: '只支持 PDF 文件' }];
    return aiRun(me, 'doc', () => AI.pdfToMarkdown(data, b.name));
  },
  'POST /api/ai/advice': async (req, url, b, me) => {
    if (!isOwner(me.uid)) return [403, { error: '决策建议只给老板' }];
    const id = String(b.id || ''); if (!S.decisions.some(x => x.id === id)) return [404, { error: '决策不存在' }];
    const [code, out] = await aiRun(me, 'advice', () => AI.adviseDecision(S, id));
    if (code !== 200) return [code, out];
    const n0 = S.notifications.length, r = TM.act(S, 'agent', 'decision.aiAdvice', { id, model: AI.MODEL, advice: out.advice });
    if (!r.ok) return [409, { error: r.error }];
    changed(n0);
    return [200, { ok: true, ...stateFor(me.uid) }];
  },
  /* 使用情况：AI 调用与估算费用、账号、设备、附件空间（老板 / 管理员） */
  'GET /api/usage': async (req, url, b, me) => {
    if (!isMgr(me.uid)) return [403, { error: '只有老板或管理员可以查看' }];
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    const agg = (since) => q('SELECT COUNT(*) AS n, COALESCE(SUM(in_tok),0) AS i, COALESCE(SUM(out_tok),0) AS o FROM ai_log WHERE at>=? AND ok=1').get(since);
    const today = agg(day0.getTime()), month = agg(Date.now() - 30 * 864e5);
    // 估算：claude-opus-5-5 每百万 token 输入 $4、输出 $20（不含缓存折扣，按上限估）
    const usd = (x) => Math.round(((x.i * 4 + x.o * 20) / 1e6) * 100) / 100;
    const byKind = q('SELECT kind, COUNT(*) AS n FROM ai_log WHERE at>=? AND ok=1 GROUP BY kind').all(Date.now() - 30 * 864e5);
    return [200, {
      ai: { enabled: AI.enabled(), model: AI.MODEL, limit: AI.LIMIT, systemLimit: AI.SYSTEM_LIMIT, today: { calls: today.n, usd: usd(today) }, month: { calls: month.n, inTok: month.i, outTok: month.o, usd: usd(month) }, byKind: Object.fromEntries(byKind.map(r => [r.kind, r.n])) },
      accounts: q('SELECT COUNT(*) AS n FROM creds WHERE disabled=0').get().n,
      devices: q('SELECT COUNT(*) AS n FROM devices d JOIN sessions s ON s.token=d.session').get().n,
      push: PUSH.enabled(),
      files: { count: q('SELECT COUNT(*) AS n FROM files').get().n, bytes: q('SELECT COALESCE(SUM(size),0) AS n FROM files').get().n },
      version
    }];
  },
  /* 导出全部数据（老板）：完整备份，不含密码 */
  'GET /api/export': async (req, url, b, me) => {
    if (!isOwner(me.uid)) return [403, { error: '只有老板可以导出全部数据' }];
    const accounts = q('SELECT uid,login,disabled,created,last_login FROM creds').all();
    return [200, { exportedAt: new Date().toISOString(), version, state: S, accounts, files: q('SELECT id,uid,name,type,size,created FROM files').all() }];
  },
  /* 账号管理：老板 / 管理员给成员分派登录账号；管理员不能管老板和其他管理员 */
  'GET /api/accounts': async (req, url, b, me) => {
    if (!isMgr(me.uid)) return [403, { error: '只有老板或管理员可以管理账号' }];
    const rows = q('SELECT uid,login,must_change,disabled,last_login FROM creds').all();
    return [200, { accounts: rows.map(r => ({ uid: r.uid, login: r.login, mustChange: !!r.must_change, disabled: !!r.disabled, lastLogin: r.last_login })) }];
  },
  'POST /api/accounts': async (req, url, b, me) => {
    if (!isMgr(me.uid)) return [403, { error: '只有老板或管理员可以管理账号' }];
    const uid = String(b.uid || ''); if (!TM.user(S, uid)) return [404, { error: '没有这个成员' }];
    if (isOwner(uid) && uid !== me.uid) return [403, { error: '老板的账号只能由老板自己修改' }];
    if (!isOwner(me.uid) && TM.hasRole(S, uid, 'admin') && uid !== me.uid) return [403, { error: '管理员的账号只能由老板修改' }];
    const old = q('SELECT * FROM creds WHERE uid=?').get(uid);
    if (uid === me.uid && old && (b.password || b.reset)) return [400, { error: '修改自己的密码请到「我的 → 修改密码」（需要原密码）' }];
    const login = String(b.login || (old && old.login) || '').trim();
    if (!LOGIN_RE.test(login)) return [400, { error: '账号 3–32 位，只能用字母、数字和 _ . @ -' }];
    const dup = q('SELECT uid FROM creds WHERE login=?').get(login); if (dup && dup.uid !== uid) return [409, { error: '这个账号名已经有人用了' }];
    let pw = b.password ? String(b.password) : null;
    if (pw && pw.length < 6) return [400, { error: '密码至少 6 位' }];
    if (!pw && (!old || b.reset)) pw = genPw();
    if (pw) { setCred(uid, login, pw, uid !== me.uid); dropSessions('uid=?', uid); }
    else q('UPDATE creds SET login=? WHERE uid=?').run(login, uid);
    return [200, { uid, login, password: pw }];
  },
  'POST /api/accounts/disable': async (req, url, b, me) => {
    if (!isMgr(me.uid)) return [403, { error: '只有老板或管理员可以管理账号' }];
    const uid = String(b.uid || '');
    if (uid === me.uid) return [400, { error: '不能停用自己的账号' }];
    if (isOwner(uid)) return [403, { error: '不能停用老板的账号' }];
    if (!isOwner(me.uid) && TM.hasRole(S, uid, 'admin')) return [403, { error: '管理员的账号只能由老板停用' }];
    q('UPDATE creds SET disabled=? WHERE uid=?').run(b.disabled ? 1 : 0, uid);
    if (b.disabled) { dropSessions('uid=?', uid); q('DELETE FROM devices WHERE uid=?').run(uid); }
    // 团队数据里也标记停用：不再能被派任务；手上有工作时提醒老板交接
    const n0 = S.notifications.length, r = TM.act(S, 'agent', 'member.active', { id: uid, active: !b.disabled });
    if (r.ok) changed(n0);
    return [200, { ok: true, open: r.ok ? r.open || 0 : 0 }];
  }
};
/* 没改初始密码前只能做这些 */
const MUST_OK = new Set(['POST /api/diag', 'POST /api/devices', 'POST /api/devices/remove', 'POST /api/account/deactivate', 'GET /api/me', 'GET /api/state', 'POST /api/password', 'POST /api/logout', 'GET /api/ai/status']);

/* ---------- 附件 ---------- */
const FILE_ID = /^[A-Za-z0-9_-]{4,64}$/;
// 只有这些类型按原类型返回（可直接显示 / 播放）；其余一律按下载处理，防止上传 HTML / SVG 做 XSS
const SAFE_TYPE = /^(image\/(jpeg|png|gif|webp|heic|heif|avif)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf)$/;
const safeType = (t) => { t = String(t || '').split(';')[0].trim().toLowerCase(); return SAFE_TYPE.test(t) ? t : 'application/octet-stream'; };
/* 读权限：上传人自己；或者附件挂在他看得到的想法（且该附件对他可见）/ 项目上 */
function canReadFile(uid, f) {
  if (f.uid === uid) return true;
  // 头像：全队可见——但只认本人上传的文件（否则谁都能把别人的私有附件设成自己的头像，让全队可读）
  if (S.users.some(u => u.avatar === f.id && u.id === f.uid)) return true;
  for (const d of S.ideas) for (const m of d.media || []) if (m.localId === f.id && TM.canSeeMediaItem(S, uid, d, m)) return true;
  for (const w of S.workItems) for (const m of w.files || []) if (m.localId === f.id && TM.canViewWork(S, uid, w)) return true;
  // 任务交付物的照片 / 文件：能看到这个任务的人都能打开
  for (const x of S.deliverables) for (const m of x.media || []) if (m.localId === f.id) { const t = S.tasks.find(t => t.id === x.taskId); if (t && TM.canViewTask(S, uid, t)) return true; }
  return false;
}
function putFile(req, res, id, me) {
  if (!FILE_ID.test(id)) return send(res, 400, { error: '文件 ID 不对' });
  const old = q('SELECT * FROM files WHERE id=?').get(id);
  if (old && old.uid !== me.uid) return send(res, 409, { error: '文件 ID 已被占用' });
  const len = +req.headers['content-length'] || 0;
  if (len > MAX_FILE) return send(res, 413, { error: '文件太大（上限 ' + Math.round(MAX_FILE / 1048576) + 'MB）' });
  const used = q('SELECT COALESCE(SUM(size),0) AS n FROM files WHERE uid=? AND id<>?').get(me.uid, id).n;
  if (used + len > QUOTA) return send(res, 413, { error: '你的附件空间已用完（' + Math.round(QUOTA / 1048576) + 'MB），请联系老板' });
  const tmp = path.join(FILES, id + '.part-' + crypto.randomBytes(4).toString('hex')), out = fs.createWriteStream(tmp);
  let n = 0, done = false;
  const abort = (code, msg) => { if (done) return; done = true; req.unpipe(out); out.destroy(); fs.rm(tmp, { force: true }, () => {}); if (code) send(res, code, { error: msg }); req.resume(); };
  req.on('data', d => { n += d.length; if (n > MAX_FILE || used + n > QUOTA) abort(413, '文件太大'); });
  req.on('aborted', () => abort()); req.on('close', () => { if (!req.complete) abort(); });
  req.pipe(out);
  out.on('finish', () => {
    if (done) return; done = true;
    fs.rename(tmp, path.join(FILES, id), (err) => {
      if (err) { fs.rm(tmp, { force: true }, () => {}); return send(res, 500, { error: '保存文件失败' }); }
      let name = ''; try { name = decodeURIComponent(req.headers['x-file-name'] || ''); } catch (e) {}
      q(`INSERT INTO files(id,uid,name,type,size,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,size=excluded.size`).run(id, me.uid, name.slice(0, 200), safeType(req.headers['content-type']), n, Date.now());
      send(res, 200, { id, size: n });
      setTimeout(trScan, 50); // 录音 / 视频传上来了：看看要不要转写
    });
  });
  out.on('error', () => abort(500, '保存文件失败'));
}
function getFile(req, res, id, me) {
  const f = FILE_ID.test(id) && q('SELECT * FROM files WHERE id=?').get(id);
  const p = f && path.join(FILES, id);
  // 没权限也回 404：不暴露文件是否存在
  if (!f || !fs.existsSync(p) || !canReadFile(me.uid, f)) return send(res, 404, { error: '文件不存在或你没有权限' });
  const type = safeType(f.type), inline = type !== 'application/octet-stream';
  const size = fs.statSync(p).size, h = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'", 'Content-Disposition': (inline ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(f.name || id) };
  const stream = (opts) => { const s = fs.createReadStream(p, opts); s.on('error', () => res.destroy()); s.pipe(res); };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && size > 0 && (m[1] !== '' || m[2] !== '')) { // 视频 / 录音在 iPhone 上播放需要分段读取
    let a, z;
    if (m[1] === '') { a = Math.max(0, size - +m[2]); z = size - 1; } else { a = +m[1]; z = m[2] === '' ? size - 1 : Math.min(+m[2], size - 1); }
    if (a >= size || a > z) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); }
    res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${z}/${size}`, 'Content-Length': z - a + 1 });
    return stream({ start: a, end: z });
  }
  res.writeHead(200, { ...h, 'Content-Length': size }); stream();
}

/* 后台：新生成的规则版整理稿交给 Claude 升级（AI_AUTO_ANALYZE=0 关闭）；写回时整理稿已被人工改过就放弃 */
const analyzing = new Set(), lastAuto = new Map();
function autoAnalyze(added) {
  if (!AI.enabled() || process.env.AI_AUTO_ANALYZE === '0') return;
  added.filter(x => (x.kind === 'analysis' || x.kind === 'digest') && x.authorType === 'agent' && x.payload && x.payload.simulated).forEach(sm => {
    if (analyzing.has(sm.id)) return;
    // 同一个想法 10 分钟内只自动跑一次（防止反复「重新整理」刷掉全队的 AI 额度）
    const k = sm.kind + '|' + sm.ideaId; if (lastAuto.get(k) > Date.now() - 10 * 60e3) return; lastAuto.set(k, Date.now());
    analyzing.add(sm.id); q('INSERT OR REPLACE INTO ai_jobs VALUES(?,?)').run(sm.id, Date.now());
    const dig = sm.kind === 'digest';
    aiRun({ uid: 'agent' }, dig ? 'digest' : 'analyze', () => dig ? AI.digestDiscussion(S, sm.ideaId) : AI.analyzeIdea(S, sm.ideaId), true).then(([code, out]) => {
      analyzing.delete(sm.id); q('DELETE FROM ai_jobs WHERE summary_id=?').run(sm.id);
      if (code !== 200 || !S) return;
      const snap = JSON.stringify(S), n0 = S.notifications.length;
      try {
        const r = TM.act(S, 'agent', dig ? 'idea.digestResult' : 'idea.aiResult', { id: sm.ideaId, summaryId: sm.id, model: AI.MODEL, payload: out.payload });
        if (r.ok) changed(n0);
      } catch (e) { S = JSON.parse(snap); console.error('写回 AI 结果出错，已回滚', e); }
    }).catch(e => { analyzing.delete(sm.id); console.error('后台 AI 出错', e); });
  });
}

/* AI：先占名额再调用（并发请求也不会超过每日上限） */
async function aiRun(me, kind, fn, system) {
  if (!AI.enabled()) return [503, { error: 'AI 还没有配置（服务器缺少 ANTHROPIC_API_KEY）' }];
  if (!system && !AI.allowed(S, me.uid)) return [403, { error: 'AI 目前只对老板和管理员开放' }];
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const n = q('SELECT COUNT(*) AS n FROM ai_log WHERE uid=? AND at>=?').get(me.uid, since.getTime()).n;
  if (n >= (system ? AI.SYSTEM_LIMIT : AI.LIMIT)) return [429, { error: '今天的 AI 使用次数已用完（' + AI.LIMIT + ' 次）' }];
  const row = q('INSERT INTO ai_log VALUES(?,?,?,0,0,2)').run(Date.now(), me.uid, kind).lastInsertRowid;
  try {
    const r = await fn();
    q('UPDATE ai_log SET in_tok=?, out_tok=?, ok=1 WHERE rowid=?').run((r.usage && r.usage.input_tokens) || 0, (r.usage && r.usage.output_tokens) || 0, row);
    delete r.usage; return [200, r];
  } catch (e) {
    q('UPDATE ai_log SET ok=0 WHERE rowid=?').run(row);
    if (e && e.status && e.error) return [e.status, { error: e.error }];
    console.error('AI 出错', e); return [500, { error: 'AI 处理出错' }];
  }
}

const BIG_BODY = new Set(['POST /api/ai/doc', 'POST /api/ai/image']); // 上传 PDF 给 AI 读，单独放宽请求体上限
const PUBLIC = new Set(['GET /api/health', 'GET /api/app', 'GET /api/setup', 'POST /api/setup', 'POST /api/login']);

/* 安卓安装包分发：不上应用商店，由团队服务器提供下载和新版本提示 */
const APP_DIR = path.join(DATA, 'app'), APK = path.join(APP_DIR, 'teamops.apk'), APK_META = path.join(APP_DIR, 'android.json');
function androidMeta() {
  try { if (!fs.existsSync(APK)) return null; const m = JSON.parse(fs.readFileSync(APK_META, 'utf8')); return { versionName: String(m.versionName || ''), versionCode: +m.versionCode || 0, size: fs.statSync(APK).size, at: +m.at || 0, notes: String(m.notes || '').slice(0, 500), url: '/app/android.apk' }; } catch (e) { return null; }
}
function sendApk(req, res) {
  if (!fs.existsSync(APK)) return send(res, 404, { error: '服务器上还没有安卓安装包' });
  const st = fs.statSync(APK);
  res.writeHead(200, { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': st.size, 'Content-Disposition': "attachment; filename=\"team-ops.apk\"; filename*=UTF-8''" + encodeURIComponent('团队协同.apk'), 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(APK).pipe(res);
}
// 隐私政策（PRIVACY.md 转成网页；上架应用商店时填这个地址）
function privacyPage(res) {
  let md = ''; try { md = fs.readFileSync(path.join(__dirname, '..', 'PRIVACY.md'), 'utf8'); } catch (e) { return send(res, 404, { error: '没有隐私政策' }); }
  const esc = (t) => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'), inl = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  let html = '', inList = false;
  md.split('\n').forEach(l => {
    const li = /^\s*-\s+(.*)/.exec(l);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inl(li[1]) + '</li>'; return; }
    if (inList) { html += '</ul>'; inList = false; }
    const h = /^(#{1,3})\s+(.*)/.exec(l); if (h) { html += '<h' + h[1].length + '>' + inl(h[2]) + '</h' + h[1].length + '>'; return; }
    if (l.trim()) html += '<p>' + inl(l) + '</p>';
  });
  if (inList) html += '</ul>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
  res.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>隐私政策 · 团队协同</title><style>body{margin:0;font:16px/1.7 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#F3F6FB;color:#141B2D}.w{max-width:680px;margin:0 auto;padding:32px 22px 60px}h1{font-size:26px}h2{font-size:19px;margin-top:28px}li{margin:6px 0}p,li{color:#3A4356}</style></head><body><div class="w">' + html + '</div></body></html>');
}
// 扫码后在手机浏览器里打开的安装页
function appPage(res) {
  const m = androidMeta(), esc = (t) => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>安装团队协同</title>
<style>body{margin:0;font:16px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#F3F6FB;color:#141B2D}.w{max-width:440px;margin:0 auto;padding:40px 22px}.m{width:84px;height:84px;border-radius:22px;background:linear-gradient(160deg,#2A55D4,#1B347F 55%,#121C3A);color:#fff;font:900 30px/84px "PingFang SC",sans-serif;text-align:center}h1{font-size:26px;margin:22px 0 6px}p{color:#5A6375;margin:0 0 14px}a.b{display:block;text-align:center;background:#141B2D;color:#fff;text-decoration:none;font-weight:700;padding:15px;border-radius:999px;margin:22px 0 10px}.c{background:#fff;border-radius:18px;padding:16px 18px;margin-top:18px;font-size:14.5px}.c b{display:block;margin-bottom:4px}small{color:#8A93A5}</style></head>
<body><div class="w"><div class="m">协同</div><h1>安装团队协同</h1>
${m ? `<p>安卓版 ${esc(m.versionName)} · ${(m.size / 1048576).toFixed(1)} MB</p><a class="b" href="/app/android.apk">下载安卓 App</a>
<div class="c"><b>下载后怎么装？</b>点通知栏里下载好的文件安装。手机提示「禁止安装未知来源应用」时，按提示允许浏览器安装一次即可。装好后打开 App，用老板给你的账号登录。</div>` : '<p>服务器上还没有安卓安装包，请联系老板。</p>'}
<div class="c"><b>iPhone</b>请向老板索取 TestFlight 邀请，用 TestFlight 安装。</div>
<p style="margin-top:18px"><small>团队服务器：只在团队内部使用</small></p></div></body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
  res.end(html);
}
const diagRate = new Map(), trBusy = new Set();
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-File-Name, Range');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let url; try { url = new URL(req.url, 'http://x'); } catch (e) { return send(res, 400, { error: '地址不对' }); }
  try {
    if (url.pathname === '/api/events') {
      const me = auth(req, url, 'sse'); if (!me) return send(res, 401, { error: '请重新登录' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('event: v\ndata: ' + JSON.stringify({ version }) + '\n\n');
      const c = { res, uid: me.uid, token: me.token }; clients.add(c); req.on('close', () => clients.delete(c)); return;
    }
    // 录音 / 视频直接转文字（AI 建项目、AI 拆待办、手机识别不了时的语音输入）：请求体是音视频本身，返回 {text}
    if (url.pathname === '/api/transcribe' && req.method === 'POST') {
      const me = auth(req, url); if (!me) return send(res, 401, { error: '请重新登录' });
      if (me.mustChange) return send(res, 403, { error: '请先修改初始密码', mustChange: true });
      if (!TR.enabled()) return send(res, 503, { error: '服务器还没有安装语音转写' });
      if (trBusy.has(me.uid)) return send(res, 429, { error: '上一段还在转，请稍等' });
      const max = 300 * 1048576, len = +req.headers['content-length'] || 0;
      if (len > max) return send(res, 413, { error: '文件太大（上限 300MB）' });
      const tmp = path.join(os.tmpdir(), 'tm-up-' + crypto.randomBytes(6).toString('hex')), out = fs.createWriteStream(tmp);
      let n = 0, bad = false; trBusy.add(me.uid);
      const done = (code, obj) => { trBusy.delete(me.uid); fs.rm(tmp, { force: true }, () => {}); send(res, code, obj); };
      req.on('data', d => { n += d.length; if (n > max && !bad) { bad = true; req.unpipe(out); out.destroy(); done(413, { error: '文件太大（上限 300MB）' }); req.resume(); } });
      req.on('aborted', () => { if (!bad) { bad = true; out.destroy(); trBusy.delete(me.uid); fs.rm(tmp, { force: true }, () => {}); } });
      req.pipe(out);
      out.on('finish', () => { if (bad) return; TR.transcribe(tmp, trPrompt()).then(text => done(200, { text: text || '' }), e => done(500, { error: '转文字失败：' + e.message })); });
      out.on('error', () => { if (!bad) { bad = true; done(500, { error: '保存失败' }); } });
      return;
    }
    const fm = /^\/api\/files\/([^/]+)$/.exec(url.pathname);
    if (fm && (req.method === 'PUT' || req.method === 'GET')) {
      const me = auth(req, url, req.method === 'GET' ? 'file' : null); if (!me) return send(res, 401, { error: '请重新登录' });
      if (req.method === 'PUT') { if (me.mustChange) return send(res, 403, { error: '请先修改初始密码' }); return putFile(req, res, fm[1], me); }
      return getFile(req, res, fm[1], me);
    }
    const key = req.method + ' ' + url.pathname, fn = Object.prototype.hasOwnProperty.call(routes, key) ? routes[key] : null;
    if (fn) {
      let me = null;
      if (!PUBLIC.has(key)) {
        me = auth(req, url); if (!me) return send(res, 401, { error: '请重新登录' });
        if (me.mustChange && !MUST_OK.has(key)) return send(res, 403, { error: '请先修改初始密码', mustChange: true });
      }
      const b = req.method === 'POST' ? await body(req, BIG_BODY.has(key) ? 15 * 1024 * 1024 : 0) : {};
      const [code, out] = await fn(req, url, b, me);
      return send(res, code, out);
    }
    if (req.method === 'GET' && (url.pathname === '/app' || url.pathname === '/app/')) return appPage(res);
    if (req.method === 'GET' && url.pathname === '/privacy') return privacyPage(res);
    if (req.method === 'GET' && url.pathname === '/app/android.apk') return sendApk(req, res);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      if (!fs.existsSync(WEB)) return send(res, 404, { error: '请先运行 npm run build' });
      // 同源网页版：告诉前端走服务器模式
      const html = fs.readFileSync(WEB, 'utf8').replace('<head>', '<head><meta name="tm-server" content="same-origin">');
      const hh = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', Vary: 'Accept-Encoding' };
      let hb = Buffer.from(html); if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) { hb = zlib.gzipSync(hb); hh['Content-Encoding'] = 'gzip'; }
      res.writeHead(200, hh); return res.end(hb);
    }
    send(res, 404, { error: '没有这个地址' });
  } catch (e) {
    // 请求本身有问题（太大、不是 JSON）回 4xx；服务器处理时出错回 500，不再伪装成「请求格式不对」
    if (e.message === 'too large') return send(res, 413, { error: '内容太大' });
    if (e.badRequest) return send(res, 400, { error: '请求格式不对' });
    console.error('处理请求出错', req.method, req.url && req.url.split('?')[0], e); send(res, 500, { error: '服务器出错，请稍后再试' });
  }
});
process.on('unhandledRejection', (e) => console.error('未处理的异步错误（已忽略，服务继续运行）', e));
// 后台任务（转写扫描、早报、清理）里的意外错误：记下来，服务继续运行（以前会让进程退出，launchd 下反复崩溃）
process.on('uncaughtException', (e) => console.error('未捕获的错误（已忽略，服务继续运行）', e));
/* 重启后补做：只补「发起过、但因为重启没做完」的后台任务（记录在 ai_jobs 里），不会去动其他规则版内容 */
/* 录音 / 视频转文字（server/transcribe.js，本机 whisper 离线转写）：想法里的音视频附件上传到服务器后自动转写，
   写回想法（idea.transcript），整理稿按「原文 + 转写」重新生成。转过或失败的记在 transcripts 表，重启后不重做 */
const trQueued = new Set();
// 转写提示：团队成员名字、正在做的项目、常用词，能明显减少同音错字（例如「感恩」被听成「赶恩」）
const TR_WORDS = '同工、同工会、感恩、感恩节、事工、宣教、福音、灵修、团契、教会、门徒、祷告、敬拜、奉献、预算、方案、项目、活动、场地、海报、报名、复盘';
function trPrompt() {
  const works = S.workItems.filter(w => w.status !== 'done').slice(-12).map(w => w.title).filter(Boolean).join('、');
  return '以下是团队工作想法和会议的普通话录音，用简体中文和中文标点。团队成员：' + S.users.map(u => u.name).join('、') + '。' + (works ? '正在做的项目：' + works + '。' : '') + '常用词：' + TR_WORDS + '。';
}
function trScan() { try { trScan0(); } catch (e) { console.error('转写扫描出错（已跳过）', e); } }
function trScan0() {
  if (!S || !TR.enabled()) return;
  S.ideas.forEach(d => {
    if (d.deleted) return;
    (Array.isArray(d.media) ? d.media : []).forEach(m => {
      if (!m || !(m.kind === 'audio' || m.kind === 'video') || !m.localId || ['done', 'failed', 'intext'].includes(m.transcriptStatus) || trQueued.has(m.localId)) return; // intext：App 已经让服务器转过、写进了正文
      if (!FILE_ID.test(m.localId) || !fs.existsSync(path.join(FILES, m.localId))) return; // 文件还没传上来
      const row = q('SELECT status FROM transcripts WHERE file_id=?').get(m.localId); if (row && row.status !== 'queued') return;
      trQueued.add(m.localId); q('INSERT OR REPLACE INTO transcripts VALUES(?,?,?)').run(m.localId, 'queued', Date.now());
      trWrite({ id: d.id, localId: m.localId, status: 'pending' });
      TR.transcribe(path.join(FILES, m.localId), trPrompt()).then(text => {
        trQueued.delete(m.localId); q('INSERT OR REPLACE INTO transcripts VALUES(?,?,?)').run(m.localId, 'done', Date.now());
        const nSum = S.summaries.length; trWrite({ id: d.id, localId: m.localId, status: 'done', text: text || '' });
        autoAnalyze(S.summaries.slice(nSum));
      }).catch(e => {
        trQueued.delete(m.localId); q('INSERT OR REPLACE INTO transcripts VALUES(?,?,?)').run(m.localId, 'failed', Date.now());
        console.error('转写失败', m.localId, e.message); trWrite({ id: d.id, localId: m.localId, status: 'failed' });
      });
    });
  });
}
function trWrite(p) {
  if (!S) return; const snap = JSON.stringify(S), n0 = S.notifications.length;
  try { const r = TM.act(S, 'agent', 'idea.transcript', p); if (r.ok) changed(n0); } catch (e) { S = JSON.parse(snap); console.error('写回转写出错，已回滚', e); }
}
function sweepAi() {
  if (!S) return; const ids = new Set(q('SELECT summary_id FROM ai_jobs WHERE at > ?').all(Date.now() - 2 * 864e5).map(r => r.summary_id)); q('DELETE FROM ai_jobs').run();
  autoAnalyze(S.summaries.filter(x => ids.has(x.id) && x.payload && x.payload.simulated && TM.latestSummary(S, x.ideaId, x.kind) === x));
}
/* 老板早报：每天 BRIEF_AT（默认 08:00，服务器时区）发一条；AI 启用时附 Claude 写的要点（AI_DAILY_BRIEF=0 关闭 AI 部分） */
async function dailyBrief() {
  if (!S) return;
  try {
    let ai = '';
    const owner = TM.usersWith(S, 'owner')[0], b = TM.briefStats(S);
    const any = Object.keys(b).some(k => b[k]);
    if (any && owner && AI.enabled() && process.env.AI_DAILY_BRIEF !== '0') {
      const [code, out] = await aiRun({ uid: 'agent' }, 'brief', () => AI.ask(S, owner, '请用不超过三句话告诉老板：今天最该关注的事是什么、建议先做什么。只说结论，不要列数字（数字另外显示）。', []), true);
      if (code === 200) ai = out.text || '';
    }
    const n0 = S.notifications.length, r = TM.act(S, 'agent', 'system.dailyBrief', { ai });
    const r2 = TM.act(S, 'agent', 'system.dueReminders', {}); // 同一时间给执行人发截止提醒
    if ((r.ok && r.sent) || (r2.ok && r2.sent)) changed(n0);
  } catch (e) { console.error('早报出错', e); }
}
function scheduleBrief() {
  const [h, m] = String(process.env.BRIEF_AT || '08:00').split(':').map(Number), t = new Date();
  t.setHours(h || 0, m || 0, 0, 0); if (t <= new Date()) t.setDate(t.getDate() + 1);
  setTimeout(() => { dailyBrief(); scheduleBrief(); }, t - Date.now()).unref();
}

/* 每天清理一次（启动 1 分钟后先跑一次） */
function housekeep() { if (!S) return;
  // 操作日志只留 180 天（每条最多 20KB，不清会一直长）
  try { const n = q('DELETE FROM ops WHERE at<?').run(Date.now() - 180 * 864e5).changes; if (n) console.log('日常清理：删掉 ' + n + ' 条半年前的操作日志'); } catch (e) {}
  try { const r = TM.act(S, 'agent', 'system.housekeep', {}); if (r.ok && r.removed) { changed(); console.log('日常清理：删掉 ' + r.removed + ' 条旧通知'); } } catch (e) { console.error('日常清理出错', e); } }
if (require.main === module) server.listen(PORT, HOST, () => {
  setTimeout(sweepAi, 3000); setTimeout(trScan, 4000);
  // Mac 上运行时不让电脑自动睡眠（睡着了同事就连不上）；caffeinate -w 跟着本进程，服务器退出它也退出。KEEP_AWAKE=0 关闭
  if (process.platform === 'darwin' && process.env.KEEP_AWAKE !== '0' && fs.existsSync('/usr/bin/caffeinate')) { try { require('child_process').spawn('/usr/bin/caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore', detached: true }).unref(); } catch (e) {} }
  // 日志别无限长：每小时看一次，超过 10MB 就把最后 1MB 留到 server.log.old，再清空（launchd 以追加方式写，清空是安全的）
  setInterval(() => { const f = path.join(DATA, 'server.log'); try { const st = fs.statSync(f); if (st.size > 10 * 1048576) { const fd = fs.openSync(f, 'r'), b = Buffer.alloc(1048576); fs.readSync(fd, b, 0, b.length, st.size - b.length); fs.closeSync(fd); fs.writeFileSync(f + '.old', b); fs.truncateSync(f, 0); } } catch (e) {} }, 3600e3).unref();
  // 没有 Claude 密钥时拉起本机 AI（装了才会启动）
  if (!AI.claudeOn()) { LLM.start(); if (!LLM.configured()) console.log('AI：没有 Claude 密钥，也没有安装本机 AI（运行 scripts/llm-mac.sh 安装），先用规则版'); }
  console.log(TR.enabled() ? '语音转写：已启用（' + TR.status().model + '）' : '语音转写：未安装（运行 scripts/whisper-mac.sh 安装后，录音和视频会自动转成文字）');
  setTimeout(housekeep, 60e3).unref(); setInterval(housekeep, 864e5).unref();
  scheduleBrief(); if (process.env.BRIEF_NOW === '1') setTimeout(dailyBrief, 800);
  console.log(`团队协同服务器已启动：http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  数据目录：${DATA}`);
  if (SETUP_CODE) console.log(`还没有创建团队。创建团队时需要初始化码：${SETUP_CODE}`);
});
module.exports = { server, routes, db, get S() { return S; } };
