/* iOS 推送（APNs）：零依赖，node:http2 + ES256 令牌（.p8 密钥）。
   需要苹果开发者账号里生成的推送密钥。没配置时 enabled() 为 false，什么都不发。
   环境变量：APNS_KEY_FILE（.p8 路径）、APNS_KEY_ID、APNS_TEAM_ID、APNS_BUNDLE_ID（默认 com.teamops.app）、
            APNS_ENV（production / development，默认 production）、APNS_HOST（测试用，覆盖推送服务地址） */
'use strict';
const http2 = require('http2'), crypto = require('crypto'), fs = require('fs');

const cfg = () => ({
  keyFile: process.env.APNS_KEY_FILE, keyId: process.env.APNS_KEY_ID, teamId: process.env.APNS_TEAM_ID,
  bundle: process.env.APNS_BUNDLE_ID || 'com.teamops.app',
  host: process.env.APNS_HOST || (process.env.APNS_ENV === 'development' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com')
});
const enabled = () => { const c = cfg(); return !!(c.keyFile && c.keyId && c.teamId && fs.existsSync(c.keyFile)); };

const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
let jwtCache = null;
function token() {
  const c = cfg(), now = Math.floor(Date.now() / 1000);
  if (jwtCache && jwtCache.at > now - 50 * 60 && jwtCache.kid === c.keyId) return jwtCache.jwt; // APNs 令牌 20–60 分钟内复用
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: c.keyId })), body = b64u(JSON.stringify({ iss: c.teamId, iat: now }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: fs.readFileSync(c.keyFile, 'utf8'), dsaEncoding: 'ieee-p1363' });
  jwtCache = { at: now, kid: c.keyId, jwt: head + '.' + body + '.' + b64u(sig) };
  return jwtCache.jwt;
}

let session = null;
function drop(s) { if (session === s) session = null; try { s.destroy(); } catch (e) {} }
function conn() {
  if (session && !session.closed && !session.destroyed) return session;
  const s = http2.connect(cfg().host);
  session = s;
  s.on('error', () => drop(s));
  s.on('goaway', () => drop(s));
  s.setTimeout(5 * 60e3, () => drop(s)); // 长时间空闲的连接（可能已经半断）直接丢弃，下次重连
  s.unref && s.unref();
  return s;
}

/* 发一条：返回 { ok, status, reason }；reason 为 BadDeviceToken / Unregistered 时调用方应删掉这个设备 */
function send(deviceToken, msg) {
  return new Promise((resolve) => {
    let s; try { s = conn(); } catch (e) { return resolve({ ok: false, status: 0, reason: 'connect' }); }
    const payload = JSON.stringify({ aps: { alert: { title: String(msg.title || '').slice(0, 100), body: String(msg.body || '').slice(0, 300) }, sound: 'default', badge: msg.badge || 0, 'thread-id': 'team' }, link: msg.link || '' });
    let req;
    try {
      req = s.request({ ':method': 'POST', ':path': '/3/device/' + deviceToken, authorization: 'bearer ' + token(), 'apns-topic': cfg().bundle, 'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json' });
    } catch (e) { session = null; return resolve({ ok: false, status: 0, reason: 'request' }); }
    let status = 0, data = '';
    // 超时多半是连接已经半断（网络切换、NAT 超时）：丢掉整个连接，下次重建
    req.setTimeout(10000, () => { req.close(); drop(s); resolve({ ok: false, status: 0, reason: 'timeout' }); });
    req.on('response', (h) => { status = h[':status']; });
    req.on('data', (d) => { data += d; });
    req.on('end', () => { let reason = ''; try { reason = JSON.parse(data || '{}').reason || ''; } catch (e) {} resolve({ ok: status === 200, status, reason }); });
    req.on('error', () => { if (!status) drop(s); resolve({ ok: false, status: 0, reason: 'error' }); });
    req.end(payload);
  });
}
const dead = (r) => r.status === 410 || ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(r.reason);

module.exports = { enabled, send, dead };
