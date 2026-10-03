/* 团队协同 · 服务器（零依赖：node:http + node:sqlite）
   - 权威数据在服务器：客户端发来操作，服务器用登录身份跑同一个 engine.js，再按身份裁剪后下发
   - 账号由老板 / 管理员创建并分派；密码 scrypt 加盐；会话令牌（只走请求头）+ 只能读附件的文件令牌（可放进网址）
   - SSE 推送版本号，客户端收到后拉取最新数据
   用法：node server/server.js
   环境变量：PORT（8787）、HOST（0.0.0.0）、DATA_DIR（server/data）、MAX_FILE_MB（500）、USER_QUOTA_MB（5000）、
            SETUP_CODE（首次创建团队的初始化码；不设则随机生成并打印）、TRUST_PROXY=1（在反向代理后，按 X-Forwarded-For 识别 IP） */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const TM = require('../engine.js');
const AI = require('./ai.js');
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
CREATE TABLE IF NOT EXISTS ops(seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, uid TEXT, action TEXT, payload TEXT, ok INTEGER, error TEXT);`);
if (!db.prepare('PRAGMA table_info(sessions)').all().some(c => c.name === 'ft')) db.exec('ALTER TABLE sessions ADD COLUMN ft TEXT');
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
function newSession(uid, agent) { const tok = crypto.randomBytes(32).toString('hex'), ft = crypto.randomBytes(24).toString('hex'), t = Date.now(); q('INSERT INTO sessions(token,uid,created,seen,agent,ft) VALUES(?,?,?,?,?,?)').run(tok, uid, t, t, String(agent || '').slice(0, 120), ft); return { token: tok, ft }; }
function dropSessions(where, ...args) { q('DELETE FROM sessions WHERE ' + where).run(...args); kickStale(); }
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
const clientIp = (req) => (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '?';
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
    q('SELECT token FROM devices WHERE uid=?').all(n.userId).forEach(d => {
      PUSH.send(d.token, { title: n.title, body: n.body, link: n.link, badge }).then(r => { if (PUSH.dead(r)) q('DELETE FROM devices WHERE token=?').run(d.token); });
    });
  });
}

/* ---------- HTTP ---------- */
function send(res, code, obj) { if (res.headersSent) return; const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); }
function body(req) {
  return new Promise((ok, bad) => { let n = 0; const ch = []; req.on('data', d => { n += d.length; if (n > MAX_BODY) { bad(new Error('too large')); req.destroy(); } else ch.push(d); }); req.on('end', () => { try { const v = ch.length ? JSON.parse(Buffer.concat(ch).toString('utf8')) : {}; ok(v && typeof v === 'object' ? v : {}); } catch (e) { bad(e); } }); req.on('error', bad); });
}
const stateFor = (uid) => ({ version, state: TM.viewFor(S, uid) });
// 操作结果只回传简单字段（新建记录的 ID 等），绝不回传对象
const pickR = (r) => { const o = {}; Object.keys(r || {}).forEach(k => { const v = r[k]; if (k !== 'ok' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) o[k] = v; }); return o; };

const routes = {
  'GET /api/health': async () => [200, { ok: true, version, setup: !!S }],
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
    const snap = JSON.stringify(S), nSum = S.summaries.length, nNotif = S.notifications.length; let r;
    // 清理数据前留一份完整备份
    if (name === 'data.clearDemo' && isOwner(me.uid)) fs.writeFileSync(path.join(DATA, 'backups', 'before-clear-' + Date.now() + '.json'), snap);
    try { r = TM.act(S, me.uid, name, payload); }
    catch (e) { S = JSON.parse(snap); console.error('act 异常', name, e); r = { ok: false, error: '服务器处理出错，已回滚' }; }
    q('INSERT INTO ops(at,uid,action,payload,ok,error) VALUES(?,?,?,?,?,?)').run(Date.now(), me.uid, name, JSON.stringify(payload).slice(0, 20000), r.ok ? 1 : 0, r.ok ? null : String(r.error || '').slice(0, 200));
    if (r.ok) { changed(nNotif); autoAnalyze(S.summaries.slice(nSum)); }
    return [200, { ok: !!r.ok, error: r.ok ? undefined : r.error, r: pickR(r), ...stateFor(me.uid) }];
  },
  'POST /api/password': async (req, url, b, me) => {
    const c = q('SELECT * FROM creds WHERE uid=?').get(me.uid);
    if (!me.mustChange && !checkPw(c, b.old || '')) return [400, { error: '原密码不对' }];
    const pw = String(b.password || ''); if (pw.length < 6) return [400, { error: '新密码至少 6 位' }];
    setCred(me.uid, c.login, pw, false);
    dropSessions('uid=? AND token<>?', me.uid, me.token);
    return [200, { ok: true }];
  },
  /* 在 App 里注销自己的账号（App Store 要求）：需要当前密码；老板不能注销（团队会没人管） */
  'POST /api/account/deactivate': async (req, url, b, me) => {
    if (isOwner(me.uid)) return [400, { error: '老板的账号不能注销。如需交接团队，请联系开发者' }];
    const c = q('SELECT * FROM creds WHERE uid=?').get(me.uid);
    if (!checkPw(c, b.password || '')) return [400, { error: '密码不对' }];
    q('UPDATE creds SET disabled=1 WHERE uid=?').run(me.uid);
    dropSessions('uid=?', me.uid);
    q('DELETE FROM devices WHERE uid=?').run(me.uid);
    const n0 = S.notifications.length, r = TM.act(S, 'agent', 'account.deactivated', { id: me.uid });
    if (r.ok) changed(n0);
    return [200, { ok: true }];
  },
  /* iOS 推送：登记 / 注销设备（同一台手机换人登录，归属跟着换） */
  'POST /api/devices': async (req, url, b, me) => {
    const t = String(b.token || ''); if (!/^[0-9a-fA-F]{32,200}$/.test(t)) return [400, { error: '设备令牌不对' }];
    q('INSERT INTO devices(token,uid,platform,created) VALUES(?,?,?,?) ON CONFLICT(token) DO UPDATE SET uid=excluded.uid, platform=excluded.platform').run(t, me.uid, b.platform === 'android' ? 'android' : 'ios', Date.now());
    return [200, { ok: true, push: PUSH.enabled() }];
  },
  'POST /api/devices/remove': async (req, url, b, me) => { q('DELETE FROM devices WHERE token=? AND uid=?').run(String(b.token || ''), me.uid); return [200, { ok: true }]; },
  /* 真实 AI：没配置密钥或没有权限时 enabled=false，客户端用规则模拟 */
  'GET /api/ai/status': async (req, url, b, me) => [200, { enabled: AI.enabled() && AI.allowed(S, me.uid), configured: AI.enabled(), model: AI.MODEL }],
  'POST /api/ai/ask': async (req, url, b, me) => aiRun(me, 'ask', () => AI.ask(S, me.uid, String(b.q || ''), b.history)),
  'POST /api/ai/kb': async (req, url, b, me) => {
    if (!TM.kbCan(S, me.uid)) return [403, { error: '只有老板或管理员可以整理知识库' }];
    return aiRun(me, 'kb', () => AI.kbOrganize(S, me.uid, String(b.topic || ''), String(b.text || '')));
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
    return [200, { ok: true }];
  }
};
/* 没改初始密码前只能做这些 */
const MUST_OK = new Set(['POST /api/devices', 'POST /api/devices/remove', 'POST /api/account/deactivate', 'GET /api/me', 'GET /api/state', 'POST /api/password', 'POST /api/logout', 'GET /api/ai/status']);

/* ---------- 附件 ---------- */
const FILE_ID = /^[A-Za-z0-9_-]{4,64}$/;
// 只有这些类型按原类型返回（可直接显示 / 播放）；其余一律按下载处理，防止上传 HTML / SVG 做 XSS
const SAFE_TYPE = /^(image\/(jpeg|png|gif|webp|heic|heif|avif)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf)$/;
const safeType = (t) => { t = String(t || '').split(';')[0].trim().toLowerCase(); return SAFE_TYPE.test(t) ? t : 'application/octet-stream'; };
/* 读权限：上传人自己；或者附件挂在他看得到的想法（且该附件对他可见）/ 项目上 */
function canReadFile(uid, f) {
  if (f.uid === uid) return true;
  for (const d of S.ideas) for (const m of d.media || []) if (m.localId === f.id && TM.canSeeMediaItem(S, uid, d, m)) return true;
  for (const w of S.workItems) for (const m of w.files || []) if (m.localId === f.id && TM.canViewWork(S, uid, w)) return true;
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
const analyzing = new Set();
function autoAnalyze(added) {
  if (!AI.enabled() || process.env.AI_AUTO_ANALYZE === '0') return;
  added.filter(x => (x.kind === 'analysis' || x.kind === 'digest') && x.authorType === 'agent' && x.payload && x.payload.simulated).forEach(sm => {
    if (analyzing.has(sm.id)) return; analyzing.add(sm.id);
    const dig = sm.kind === 'digest';
    aiRun({ uid: 'agent' }, dig ? 'digest' : 'analyze', () => dig ? AI.digestDiscussion(S, sm.ideaId) : AI.analyzeIdea(S, sm.ideaId), true).then(([code, out]) => {
      analyzing.delete(sm.id);
      if (code !== 200 || !S) return;
      const n0 = S.notifications.length, r = TM.act(S, 'agent', dig ? 'idea.digestResult' : 'idea.aiResult', { id: sm.ideaId, summaryId: sm.id, model: AI.MODEL, payload: out.payload });
      if (r.ok) changed(n0);
    }, () => analyzing.delete(sm.id));
  });
}

/* AI：先占名额再调用（并发请求也不会超过每日上限） */
async function aiRun(me, kind, fn, system) {
  if (!AI.enabled()) return [503, { error: 'AI 还没有配置（服务器缺少 ANTHROPIC_API_KEY）' }];
  if (!system && !AI.allowed(S, me.uid)) return [403, { error: 'AI 目前只对老板和管理员开放' }];
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const n = q('SELECT COUNT(*) AS n FROM ai_log WHERE uid=? AND at>=?').get(me.uid, since.getTime()).n;
  if (n >= AI.LIMIT) return [429, { error: '今天的 AI 使用次数已用完（' + AI.LIMIT + ' 次）' }];
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

const PUBLIC = new Set(['GET /api/health', 'GET /api/setup', 'POST /api/setup', 'POST /api/login']);

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
      const b = req.method === 'POST' ? await body(req) : {};
      const [code, out] = await fn(req, url, b, me);
      return send(res, code, out);
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      if (!fs.existsSync(WEB)) return send(res, 404, { error: '请先运行 npm run build' });
      // 同源网页版：告诉前端走服务器模式
      const html = fs.readFileSync(WEB, 'utf8').replace('<head>', '<head><meta name="tm-server" content="same-origin">');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' }); return res.end(html);
    }
    send(res, 404, { error: '没有这个地址' });
  } catch (e) {
    console.error(e); send(res, e.message === 'too large' ? 413 : 400, { error: e.message === 'too large' ? '内容太大' : '请求格式不对' });
  }
});
if (require.main === module) server.listen(PORT, HOST, () => {
  console.log(`团队协同服务器已启动：http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  数据目录：${DATA}`);
  if (SETUP_CODE) console.log(`还没有创建团队。创建团队时需要初始化码：${SETUP_CODE}`);
});
module.exports = { server, routes, db, get S() { return S; } };
