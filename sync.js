/* 同步层：在 engine.js 之后、app.js 之前加载。
   本地模式（演示，没有连接服务器）：什么都不做。
   服务器模式：
   - 拦截 TM.act：本地先执行（界面立即响应），成功后进发件箱，按顺序发给服务器；以服务器结果为准
   - 断网时操作留在发件箱（存本机），联网后补发
   - 服务器 SSE 推送新版本 → 拉取最新数据；用户正在输入或弹窗打开时推迟应用，避免冲掉正在写的内容
   - 服务器生成的 ID 与本地不同（多人同时创建）时，修正当前页面地址 */
var TMS = (function () {
  'use strict';
  var LS = window.localStorage, K = 'tm_demo_v3', KU = 'tm_user_v3';
  function g(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) LS.removeItem(k); else LS.setItem(k, String(v)); } catch (e) {} }
  var same = !!document.querySelector('meta[name=tm-server]');
  var api = { server: same || g('tm_server') != null, sameOrigin: same, base: same ? '' : (g('tm_server') || ''), token: g('tm_token'), version: +g('tm_ver') || 0, mustChange: g('tm_must') === '1', status: 'idle', outbox: [] };
  try { api.outbox = JSON.parse(g('tm_outbox') || '[]') || []; } catch (e) { api.outbox = []; }
  api.loggedIn = function () { return api.server && !!api.token; };
  // 服务器模式但没登录：清掉缓存，避免看到上一个人的数据或演示数据
  if (api.server && !api.token) { put(K, null); put(KU, null); }

  function norm(u) { u = String(u || '').trim().replace(/\/+$/, ''); if (u && !/^https?:\/\//i.test(u)) u = 'http://' + u; return u; }
  function reqAt(base, method, path, body, token) {
    var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    return fetch(base + path, { method: method, signal: ctl && ctl.signal, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { clearTimeout(tm); return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { j.status = r.status; throw j; } return j; }); },
        function () { clearTimeout(tm); throw { status: 0, error: '连不上服务器，请检查网络和服务器地址' }; });
  }
  function req(method, path, body) { return reqAt(api.base, method, path, body, api.token); }
  function toast(m, bad) { if (window.__tm && window.__tm.toast) window.__tm.toast(m, bad); }

  /* ---------- 状态提示 ---------- */
  var pill = null, pillT = null;
  function setStatus(s) {
    api.status = s;
    clearTimeout(pillT);
    pillT = setTimeout(function () {
      if (!pill) { pill = document.createElement('div'); pill.id = 'sync-pill'; pill.setAttribute('role', 'status'); document.body.appendChild(pill); }
      var n = api.outbox.length, off = api.status === 'offline';
      pill.textContent = off ? (n ? '离线 · ' + n + ' 项待同步' : '离线，联网后自动同步') : n ? '同步中…' : '';
      pill.className = off ? 'off' : n ? 'busy' : '';
    }, off0() ? 0 : 1200);
  }
  function off0() { return api.status === 'offline'; }

  /* ---------- 发件箱 ---------- */
  var busy = false, retryT = null, delay = 2000;
  function saveBox() { put('tm_outbox', api.outbox.length ? JSON.stringify(api.outbox) : null); }
  function ids(r) { var o = {}; Object.keys(r || {}).forEach(function (k) { if (k !== 'ok' && (typeof r[k] === 'string' || typeof r[k] === 'number')) o[k] = r[k]; }); return o; }
  function remap(a, b) {
    if (!a || !b) return;
    Object.keys(a).forEach(function (k) { if (typeof a[k] === 'string' && typeof b[k] === 'string' && a[k] !== b[k] && location.hash.indexOf(a[k]) >= 0) history.replaceState(null, '', location.hash.split(a[k]).join(b[k])); });
  }
  function flush() {
    if (busy || !api.outbox.length || !api.loggedIn()) return;
    busy = true; setStatus(api.status === 'offline' ? 'offline' : 'syncing');
    var op = api.outbox[0];
    req('POST', '/api/act', { name: op.n, payload: op.p, base: api.version }).then(function (res) {
      busy = false; delay = 2000; api.outbox.shift(); saveBox();
      if (!res.ok) toast('这一步没能同步到服务器：' + (res.error || '未知原因'), true);
      remap(op.r, res.r && ids(res.r));
      accept(res.version, res.state);
      setStatus('online'); flush();
    }, function (e) {
      busy = false;
      if (e.status === 401) return expired();
      if (e.status) { api.outbox.shift(); saveBox(); toast('同步出错：' + (e.error || e.status), true); setStatus('online'); return flush(); }
      setStatus('offline'); clearTimeout(retryT); retryT = setTimeout(flush, delay); delay = Math.min(delay * 2, 30000);
    });
  }
  function enqueue(name, p, r) {
    var c; try { c = JSON.parse(JSON.stringify(p || {})); } catch (e) { c = {}; }
    api.outbox.push({ n: name, p: c, r: ids(r), t: Date.now() }); saveBox(); setStatus(api.status); setTimeout(flush, 0);
  }

  /* ---------- 应用服务器数据 ---------- */
  var pending = null, pendT = null, LOCAL_ONLY = ['fileRecent'];
  function editing() {
    var a = document.activeElement;
    if (a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/checkbox|radio|button|submit|file/.test(a.type)) || a.isContentEditable)) return true;
    return !!document.querySelector('#layer .sheet, .ai-panel');
  }
  function apply(st) {
    if (!st || !window.__tm) return;
    if (editing()) { pending = st; clearTimeout(pendT); pendT = setTimeout(function () { var x = pending; pending = null; apply(x); }, 1500); return; }
    pending = null;
    var cur = window.__tm.S;
    LOCAL_ONLY.forEach(function (k) { if (cur && cur[k] !== undefined) st[k] = cur[k]; });
    if (cur && JSON.stringify(cur) === JSON.stringify(st)) return;
    window.__tm.setState(st);
  }
  function accept(v, st) {
    if (typeof v === 'number') { api.version = v; put('tm_ver', v); }
    if (api.outbox.length || busy) return; // 后面还有本地操作在排队：等最后一个回执再应用
    if (st) apply(st);
  }
  function pull() {
    if (!api.loggedIn() || busy || api.outbox.length) return;
    return req('GET', '/api/state').then(function (res) {
      setStatus('online');
      if (res.mustChange && !api.mustChange) { api.mustChange = true; put('tm_must', '1'); }
      accept(res.version, res.state);
    }, function (e) { if (e.status === 401) expired(); else setStatus('offline'); });
  }
  function expired() {
    ['tm_token', 'tm_ver', 'tm_outbox', 'tm_must', K, KU].forEach(function (k) { put(k, null); });
    toast('登录已过期，请重新登录', true); setTimeout(function () { location.hash = '#/login'; location.reload(); }, 800);
  }

  /* ---------- 推送：SSE，失败时轮询 ---------- */
  var es = null, pollT = null;
  function connect() {
    if (!api.loggedIn()) return;
    var poll = function () { clearInterval(pollT); pollT = setInterval(pull, 8000); };
    if (!window.EventSource) return poll();
    try {
      es = new EventSource(api.base + '/api/events?token=' + encodeURIComponent(api.token));
      es.addEventListener('v', function (e) { var v = 0; try { v = JSON.parse(e.data).version; } catch (x) {} setStatus('online'); clearInterval(pollT); if (v > api.version) pull(); flush(); });
      es.onerror = function () { setStatus('offline'); poll(); };
    } catch (e) { poll(); }
  }

  /* ---------- 拦截引擎操作 ---------- */
  if (api.loggedIn() && window.TM) {
    var orig = TM.act;
    TM.act = function (s, uid, name, p) {
      var r = orig.apply(this, arguments);
      if (r && r.ok && window.__tm && s === window.__tm.S) enqueue(name, p, r);
      return r;
    };
    window.addEventListener('load', function () { connect(); pull(); flush(); });
    window.addEventListener('online', function () { delay = 2000; flush(); pull(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { flush(); pull(); } });
  }

  /* ---------- 登录、创建团队、账号 ---------- */
  function establish(base, res) {
    put('tm_server', api.sameOrigin ? null : base); put('tm_token', res.token); put('tm_ver', res.version);
    put(K, JSON.stringify(res.state)); put(KU, res.uid); put('tm_must', res.mustChange ? '1' : null); put('tm_outbox', null);
    location.hash = '#/home'; location.reload();
  }
  api.serverUrl = function () { return api.sameOrigin ? location.origin : api.base; };
  api.probe = function (server) { var b = api.sameOrigin ? '' : norm(server); return reqAt(b, 'GET', '/api/health').then(function (r) { return { base: b, setup: r.setup }; }); };
  api.login = function (server, login, password) { var b = api.sameOrigin ? '' : norm(server); return reqAt(b, 'POST', '/api/login', { login: login, password: password }).then(function (res) { establish(b, res); }); };
  api.setup = function (server, o) { var b = api.sameOrigin ? '' : norm(server); return reqAt(b, 'POST', '/api/setup', o).then(function (res) { establish(b, res); }); };
  api.useServer = function (server) { put('tm_server', norm(server) || 'http://'); put(K, null); put(KU, null); location.hash = '#/login'; location.reload(); };
  api.useLocal = function () { ['tm_server', 'tm_token', 'tm_ver', 'tm_outbox', 'tm_must', K, KU].forEach(function (k) { put(k, null); }); location.hash = '#/login'; location.reload(); };
  api.logout = function () {
    var done = function () { ['tm_token', 'tm_ver', 'tm_outbox', 'tm_must', K, KU].forEach(function (k) { put(k, null); }); location.hash = '#/login'; location.reload(); };
    req('POST', '/api/logout').then(done, done);
  };
  api.changePassword = function (old, pw) { return req('POST', '/api/password', { old: old, password: pw }).then(function (r) { api.mustChange = false; put('tm_must', null); return r; }); };
  api.accounts = function () { return req('GET', '/api/accounts'); };
  api.setAccount = function (o) { return req('POST', '/api/accounts', o); };
  api.disable = function (uid, d) { return req('POST', '/api/accounts/disable', { uid: uid, disabled: d }); };
  api.flush = flush; api.pull = pull;
  return api;
})();
