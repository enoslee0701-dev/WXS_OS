/* 团队协同 · 服务器（零依赖：node:http + node:sqlite）
   - 权威数据在服务器：客户端发来操作，服务器用登录身份跑同一个 engine.js，再按身份裁剪后下发
   - 账号由老板 / 管理员创建并分派；密码 scrypt 加盐；会话令牌
   - SSE 推送版本号，客户端收到后拉取最新数据
   用法：node server/server.js   环境变量：PORT（默认 8787）、HOST（默认 0.0.0.0）、DATA_DIR（默认 server/data） */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const TM = require('../engine.js');
const AI = require('./ai.js');

const PORT = +process.env.PORT || 8787, HOST = process.env.HOST || '0.0.0.0';
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const WEB = path.join(__dirname, '..', 'dist', 'team-ops.html');
const SESSION_DAYS = 90, MAX_BODY = 2 * 1024 * 1024, MAX_FILE = (+process.env.MAX_FILE_MB || 500) * 1024 * 1024;
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
CREATE TABLE IF NOT EXISTS ops(seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, uid TEXT, action TEXT, payload TEXT, ok INTEGER, error TEXT);`);
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

/* ---------- 密码与会话 ---------- */
function hashPw(pw, salt) { return crypto.scryptSync(String(pw), salt, 32).toString('hex'); }
function checkPw(c, pw) { const h = Buffer.from(hashPw(pw, c.salt), 'hex'), x = Buffer.from(c.hash, 'hex'); return h.length === x.length && crypto.timingSafeEqual(h, x); }
function genPw() { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const b = crypto.randomBytes(8); for (let i = 0; i < 8; i++) s += A[b[i] % A.length]; return s.slice(0, 4) + '-' + s.slice(4); }
function setCred(uid, login, pw, mustChange) {
  const salt = crypto.randomBytes(16).toString('hex'), t = Date.now();
  q(`INSERT INTO creds(uid,login,salt,hash,must_change,disabled,created) VALUES(?,?,?,?,?,0,?)
     ON CONFLICT(uid) DO UPDATE SET login=excluded.login, salt=excluded.salt, hash=excluded.hash, must_change=excluded.must_change, disabled=0`).run(uid, login, salt, hashPw(pw, salt), mustChange ? 1 : 0, t);
}
function newSession(uid, agent) { const tok = crypto.randomBytes(32).toString('hex'), t = Date.now(); q('INSERT INTO sessions VALUES(?,?,?,?,?)').run(tok, uid, t, t, String(agent || '').slice(0, 120)); return tok; }
function auth(req, url) {
  const h = req.headers.authorization || '', tok = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  if (!tok) return null;
  const s = q('SELECT * FROM sessions WHERE token=?').get(tok); if (!s) return null;
  if (s.seen < Date.now() - SESSION_DAYS * 864e5) { q('DELETE FROM sessions WHERE token=?').run(tok); return null; }
  const c = q('SELECT * FROM creds WHERE uid=?').get(s.uid);
  if (!c || c.disabled || !S || !TM.user(S, s.uid)) return null;
  if (s.seen < Date.now() - 60e3) q('UPDATE sessions SET seen=? WHERE token=?').run(Date.now(), tok);
  return { uid: s.uid, token: tok, mustChange: !!c.must_change, login: c.login };
}
const fails = new Map(); // 登录失败限流：同一 IP+账号 15 分钟内最多 10 次
function limited(key) { const f = fails.get(key); return f && f.n >= 10 && f.t > Date.now() - 15 * 60e3; }
function failed(key) { const f = fails.get(key); if (!f || f.t < Date.now() - 15 * 60e3) fails.set(key, { n: 1, t: Date.now() }); else f.n++; }
const isMgr = (uid) => TM.hasRole(S, uid, 'owner') || TM.hasRole(S, uid, 'admin');
const LOGIN_RE = /^[A-Za-z0-9_.@-]{3,32}$/;

/* ---------- SSE ---------- */
const clients = new Set();
function broadcast() { const msg = 'event: v\ndata: ' + JSON.stringify({ version }) + '\n\n'; clients.forEach(c => { try { c.res.write(msg); } catch (e) {} }); }
setInterval(() => clients.forEach(c => { try { c.res.write(': ping\n\n'); } catch (e) {} }), 25e3).unref();

/* ---------- HTTP ---------- */
function send(res, code, obj) { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); }
function body(req) {
  return new Promise((ok, bad) => { let n = 0; const ch = []; req.on('data', d => { n += d.length; if (n > MAX_BODY) { bad(new Error('too large')); req.destroy(); } else ch.push(d); }); req.on('end', () => { try { ok(ch.length ? JSON.parse(Buffer.concat(ch).toString('utf8')) : {}); } catch (e) { bad(e); } }); req.on('error', bad); });
}
const stateFor = (uid) => ({ version, state: TM.viewFor(S, uid) });

const routes = {
  'GET /api/health': async () => [200, { ok: true, version, setup: !!S }],
  'GET /api/setup': async () => [200, { needsSetup: !S }],
  /* 首次启动：老板创建团队（可选带演示数据） */
  'POST /api/setup': async (req, url, b) => {
    if (S) return [409, { error: '团队已经创建过了' }];
    const name = String(b.name || '').trim(), login = String(b.login || '').trim(), pw = String(b.password || '');
    if (!name) return [400, { error: '请填写你的姓名' }];
    if (!LOGIN_RE.test(login)) return [400, { error: '账号 3–32 位，只能用字母、数字和 _ . @ -' }];
    if (pw.length < 6) return [400, { error: '密码至少 6 位' }];
    if (b.demo) { S = TM.migrate(TM.seed()); const o = TM.user(S, 'u_owner'); o.name = name; if (b.title) o.title = String(b.title).slice(0, 20); }
    else S = TM.blank({ name, title: b.title });
    version = 1; persist(); setCred('u_owner', login, pw, false);
    const token = newSession('u_owner', req.headers['user-agent']);
    return [200, { token, uid: 'u_owner', ...stateFor('u_owner') }];
  },
  'POST /api/login': async (req, url, b) => {
    if (!S) return [409, { error: '团队还没有创建', needsSetup: true }];
    const login = String(b.login || '').trim(), key = req.socket.remoteAddress + '|' + login.toLowerCase();
    if (limited(key)) return [429, { error: '尝试次数太多，请 15 分钟后再试' }];
    const c = q('SELECT * FROM creds WHERE login=?').get(login);
    if (!c || !checkPw(c, b.password || '')) { failed(key); return [401, { error: '账号或密码不对' }]; }
    if (c.disabled) return [403, { error: '这个账号已停用，请联系老板或管理员' }];
    if (!TM.user(S, c.uid)) return [403, { error: '这个账号对应的成员不存在了' }];
    fails.delete(key); q('UPDATE creds SET last_login=? WHERE uid=?').run(Date.now(), c.uid);
    return [200, { token: newSession(c.uid, req.headers['user-agent']), uid: c.uid, mustChange: !!c.must_change, ...stateFor(c.uid) }];
  },
  'POST /api/logout': async (req, url, b, me) => { q('DELETE FROM sessions WHERE token=?').run(me.token); return [200, { ok: true }]; },
  'GET /api/me': async (req, url, b, me) => [200, { uid: me.uid, login: me.login, mustChange: me.mustChange }],
  'GET /api/state': async (req, url, b, me) => [200, { ...stateFor(me.uid), mustChange: me.mustChange }],
  /* 执行业务操作：权限全部由 engine.js 按登录身份判断 */
  'POST /api/act': async (req, url, b, me) => {
    const name = String(b.name || ''), payload = b.payload && typeof b.payload === 'object' ? b.payload : {};
    const snap = JSON.stringify(S); let r;
    try { r = TM.act(S, me.uid, name, payload); }
    catch (e) { S = JSON.parse(snap); console.error('act 异常', name, e); r = { ok: false, error: '服务器处理出错，已回滚' }; }
    q('INSERT INTO ops(at,uid,action,payload,ok,error) VALUES(?,?,?,?,?,?)').run(Date.now(), me.uid, name, JSON.stringify(payload).slice(0, 20000), r.ok ? 1 : 0, r.ok ? null : r.error);
    if (r.ok) { version++; persist(); broadcast(); }
    return [200, { ok: r.ok, error: r.error, r, ...stateFor(me.uid) }];
  },
  'POST /api/password': async (req, url, b, me) => {
    const c = q('SELECT * FROM creds WHERE uid=?').get(me.uid);
    if (!me.mustChange && !checkPw(c, b.old || '')) return [400, { error: '原密码不对' }];
    const pw = String(b.password || ''); if (pw.length < 6) return [400, { error: '新密码至少 6 位' }];
    setCred(me.uid, c.login, pw, false);
    q('DELETE FROM sessions WHERE uid=? AND token<>?').run(me.uid, me.token);
    return [200, { ok: true }];
  },
  /* 真实 AI：没配置密钥或没有权限时 enabled=false，客户端用规则模拟 */
  'GET /api/ai/status': async (req, url, b, me) => [200, { enabled: AI.enabled() && AI.allowed(S, me.uid), configured: AI.enabled(), model: AI.MODEL }],
  'POST /api/ai/ask': async (req, url, b, me) => aiRun(me, 'ask', () => AI.ask(S, me.uid, String(b.q || ''), b.history)),
  'POST /api/ai/kb': async (req, url, b, me) => {
    if (!TM.kbCan(S, me.uid)) return [403, { error: '只有老板或管理员可以整理知识库' }];
    return aiRun(me, 'kb', () => AI.kbOrganize(S, me.uid, String(b.topic || ''), String(b.text || '')));
  },
  /* 账号管理：老板 / 管理员给成员分派登录账号 */
  'GET /api/accounts': async (req, url, b, me) => {
    if (!isMgr(me.uid)) return [403, { error: '只有老板或管理员可以管理账号' }];
    const rows = q('SELECT uid,login,must_change,disabled,last_login FROM creds').all();
    return [200, { accounts: rows.map(r => ({ uid: r.uid, login: r.login, mustChange: !!r.must_change, disabled: !!r.disabled, lastLogin: r.last_login })) }];
  },
  'POST /api/accounts': async (req, url, b, me) => {
    if (!isMgr(me.uid)) return [403, { error: '只有老板或管理员可以管理账号' }];
    const uid = String(b.uid || ''); if (!TM.user(S, uid)) return [404, { error: '没有这个成员' }];
    if (TM.hasRole(S, uid, 'owner') && uid !== me.uid) return [403, { error: '老板的账号只能由老板自己修改' }];
    const old = q('SELECT * FROM creds WHERE uid=?').get(uid);
    const login = String(b.login || (old && old.login) || '').trim();
    if (!LOGIN_RE.test(login)) return [400, { error: '账号 3–32 位，只能用字母、数字和 _ . @ -' }];
    const dup = q('SELECT uid FROM creds WHERE login=?').get(login); if (dup && dup.uid !== uid) return [409, { error: '这个账号名已经有人用了' }];
    let pw = b.password ? String(b.password) : null;
    if (pw && pw.length < 6) return [400, { error: '密码至少 6 位' }];
    if (!pw && (!old || b.reset)) pw = genPw();
    if (pw) { setCred(uid, login, pw, uid !== me.uid); q('DELETE FROM sessions WHERE uid=?').run(uid); }
    else q('UPDATE creds SET login=? WHERE uid=?').run(login, uid);
    return [200, { uid, login, password: pw }];
  },
  'POST /api/accounts/disable': async (req, url, b, me) => {
    if (!isMgr(me.uid)) return [403, { error: '只有老板或管理员可以管理账号' }];
    const uid = String(b.uid || '');
    if (uid === me.uid) return [400, { error: '不能停用自己的账号' }];
    if (TM.hasRole(S, uid, 'owner')) return [403, { error: '不能停用老板的账号' }];
    q('UPDATE creds SET disabled=? WHERE uid=?').run(b.disabled ? 1 : 0, uid);
    if (b.disabled) q('DELETE FROM sessions WHERE uid=?').run(uid);
    return [200, { ok: true }];
  }
};
/* ---------- 附件：客户端用自己生成的随机 localId 作为文件 ID 上传，其他设备按 ID 读取 ---------- */
const FILE_ID = /^[A-Za-z0-9_-]{4,64}$/;
function putFile(req, res, id, me) {
  if (!FILE_ID.test(id)) return send(res, 400, { error: '文件 ID 不对' });
  const old = q('SELECT * FROM files WHERE id=?').get(id);
  if (old && old.uid !== me.uid) return send(res, 409, { error: '文件 ID 已被占用' });
  const len = +req.headers['content-length'] || 0;
  if (len > MAX_FILE) return send(res, 413, { error: '文件太大（上限 ' + Math.round(MAX_FILE / 1048576) + 'MB）' });
  const tmp = path.join(FILES, id + '.part-' + crypto.randomBytes(4).toString('hex')), out = fs.createWriteStream(tmp);
  let n = 0, bad = false;
  req.on('data', d => { n += d.length; if (n > MAX_FILE && !bad) { bad = true; req.unpipe(out); out.destroy(); fs.rm(tmp, () => {}); send(res, 413, { error: '文件太大' }); req.destroy(); } });
  req.pipe(out);
  out.on('finish', () => {
    if (bad) return;
    fs.renameSync(tmp, path.join(FILES, id));
    let name = ''; try { name = decodeURIComponent(req.headers['x-file-name'] || ''); } catch (e) {}
    const type = String(req.headers['content-type'] || 'application/octet-stream').slice(0, 100);
    q(`INSERT INTO files(id,uid,name,type,size,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,size=excluded.size`).run(id, me.uid, name.slice(0, 200), type, n, Date.now());
    send(res, 200, { id, size: n });
  });
  out.on('error', () => { if (!bad) send(res, 500, { error: '保存文件失败' }); });
}
function getFile(req, res, id) {
  const f = FILE_ID.test(id) && q('SELECT * FROM files WHERE id=?').get(id);
  const p = f && path.join(FILES, id);
  if (!f || !fs.existsSync(p)) return send(res, 404, { error: '文件不存在或还没上传完' });
  const size = fs.statSync(p).size, h = { 'Content-Type': f.type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(f.name || id) };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m) { // 视频 / 录音在 iPhone 上播放需要分段读取
    let a = m[1] === '' ? size - +m[2] : +m[1], z = m[1] !== '' && m[2] !== '' ? +m[2] : size - 1;
    if (a < 0 || a >= size || z >= size || a > z) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); }
    res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${z}/${size}`, 'Content-Length': z - a + 1 });
    return fs.createReadStream(p, { start: a, end: z }).pipe(res);
  }
  res.writeHead(200, { ...h, 'Content-Length': size }); fs.createReadStream(p).pipe(res);
}

async function aiRun(me, kind, fn) {
  if (!AI.enabled()) return [503, { error: 'AI 还没有配置（服务器缺少 ANTHROPIC_API_KEY）' }];
  if (!AI.allowed(S, me.uid)) return [403, { error: 'AI 目前只对老板和管理员开放' }];
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const n = q('SELECT COUNT(*) AS n FROM ai_log WHERE uid=? AND at>=?').get(me.uid, since.getTime()).n;
  if (n >= AI.LIMIT) return [429, { error: '今天的 AI 使用次数已用完（' + AI.LIMIT + ' 次）' }];
  try {
    const r = await fn();
    q('INSERT INTO ai_log VALUES(?,?,?,?,?,1)').run(Date.now(), me.uid, kind, (r.usage && r.usage.input_tokens) || 0, (r.usage && r.usage.output_tokens) || 0);
    delete r.usage; return [200, r];
  } catch (e) {
    q('INSERT INTO ai_log VALUES(?,?,?,0,0,0)').run(Date.now(), me.uid, kind);
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
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/events') {
      const me = auth(req, url); if (!me) return send(res, 401, { error: '请重新登录' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('event: v\ndata: ' + JSON.stringify({ version }) + '\n\n');
      const c = { res, uid: me.uid }; clients.add(c); req.on('close', () => clients.delete(c)); return;
    }
    const fm = /^\/api\/files\/([^/]+)$/.exec(url.pathname);
    if (fm && (req.method === 'PUT' || req.method === 'GET')) {
      const me = auth(req, url); if (!me) return send(res, 401, { error: '请重新登录' });
      return req.method === 'PUT' ? putFile(req, res, fm[1], me) : getFile(req, res, fm[1]);
    }
    const key = req.method + ' ' + url.pathname, fn = routes[key];
    if (fn) {
      let me = null;
      if (!PUBLIC.has(key)) { me = auth(req, url); if (!me) return send(res, 401, { error: '请重新登录' }); }
      const b = req.method === 'POST' ? await body(req) : {};
      const [code, out] = await fn(req, url, b, me);
      return send(res, code, out);
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      if (!fs.existsSync(WEB)) return send(res, 404, { error: '请先运行 npm run build' });
      // 同源网页版：告诉前端走服务器模式
      const html = fs.readFileSync(WEB, 'utf8').replace('<head>', '<head><meta name="tm-server" content="same-origin">');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(html);
    }
    send(res, 404, { error: '没有这个地址' });
  } catch (e) {
    console.error(e); send(res, e.message === 'too large' ? 413 : 400, { error: e.message === 'too large' ? '内容太大' : '请求格式不对' });
  }
});
if (require.main === module) server.listen(PORT, HOST, () => console.log(`团队协同服务器已启动：http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  数据目录：${DATA}`));
module.exports = { server, routes, db, get S() { return S; } };
