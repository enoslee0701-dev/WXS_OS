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

  // 服务器地址容错：中文键盘打出的全角「：」「。」、空格、漏写 http://、漏写端口（局域网 IP 默认 8787）、局域网地址误写成 https
  api.normUrl = function (u) { return norm(u); };
  function norm(u) {
    u = String(u || '').trim().replace(/[：]/g, ':').replace(/[。．]/g, '.').replace(/[／]/g, '/').replace(/\s+/g, '').replace(/\/+$/, '');
    // 没写协议：公网域名（例如临时公网地址 xxx.trycloudflare.com）用 https；IP、.local、localhost、带端口的用 http
    if (u && !/^https?:\/\//i.test(u)) { u = u.replace(/^\/+/, ''); u = (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/.*)?$/i.test(u) && !/\.local(\/|$)/i.test(u) ? 'https://' : 'http://') + u; }
    var m = /^(https?):\/\/((?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)(?:\.\d{1,3}){2,3})(:\d+)?(\/.*)?$/i.exec(u);
    if (m) u = 'http://' + m[2] + (m[3] || ':8787') + (m[4] || '');
    return u;
  }
  // 原生网络模式：App 里的浏览器内核连不上服务器、但手机系统网络能通时（例如新版安卓 WebView 的限制），API 请求改走原生
  api.nativeMode = g('tm_native_net') === '1';
  api.setNativeMode = function (on) { api.nativeMode = !!on; put('tm_native_net', on ? '1' : null); };
  function reqAt(base, method, path, body, token, wait) {
    if (api.nativeMode && typeof TMN !== 'undefined' && TMN.nativeRequest && /^http:/.test(base)) {
      var hd = Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {});
      return TMN.nativeRequest(method, base + path, hd, body ? body : undefined).then(function (r) {
        var j = r.data; if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { j = {}; } }
        if (r.status >= 200 && r.status < 300) return j || {};
        throw Object.assign({ status: r.status }, j || {}, { error: (j && j.error) || '请求失败（' + r.status + '）' });
      }, function () { throw { status: 0, error: '连不上服务器（原生网络）' }; });
    }
    var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, wait || 15000);
    return fetch(base + path, { method: method, signal: ctl && ctl.signal, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { clearTimeout(tm); return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { j.status = r.status; throw j; } return j; }); },
        function () { clearTimeout(tm); throw { status: 0, error: '连不上服务器。请检查：① 手机和服务器电脑连的是同一个 Wi-Fi（不是流量、不是访客 Wi-Fi）；② 关掉手机的 VPN / 代理；③ 地址形如 http://192.168.1.108:8787；④ 服务器电脑开着、没睡眠' }; });
  }
  function req(method, path, body, wait) { return reqAt(api.base, method, path, body, api.token, wait); }
  var AI_WAIT = 120000; // AI 生成要几十秒，不能用 15 秒的普通超时（客户端放弃了服务器照样跑完、照样扣次数）
  // iOS 里：localStorage 的删除要先同步到原生备份再刷新，否则刷新后会被当成「丢失」又补回来（退出了又登录回去）
  // 刷新前先收起键盘并稍等：旧版安卓 WebView 在刷新瞬间收到原生「键盘收起」事件时，新页面还没有 Capacitor，会报错
  function reloadSafe() { var done = false, kb = false; try { var a = document.activeElement; kb = !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName)); if (kb) a.blur(); } catch (e) {}
    var go = function () { if (!done) { done = true; setTimeout(function () { location.reload(); }, kb ? 350 : 0); } }; try { if (window.TMN && TMN.native && TMN.flush) { TMN.flush().then(go, go); setTimeout(go, 1500); return; } } catch (e) {} go(); }
  function toast(m, bad) { if (window.__tm && window.__tm.toast) window.__tm.toast(m, bad); }

  /* ---------- 状态提示 ---------- */
  var pill = null, pillT = null;
  function setStatus(s) {
    api.status = s;
    clearTimeout(pillT);
    pillT = setTimeout(function () {
      if (!pill) { pill = document.createElement('div'); pill.id = 'sync-pill'; pill.setAttribute('role', 'status'); document.body.appendChild(pill); }
      var n = api.outbox.length + (api.uploading || 0), off = api.status === 'offline';
      pill.textContent = off ? (n ? '离线 · ' + n + ' 项待同步' : '离线，联网后自动同步') : n ? '同步中…' : '';
      pill.className = off ? 'off' : n ? 'busy' : '';
    }, off0() ? 0 : 1200);
  }
  function off0() { return api.status === 'offline'; }

  /* ---------- 发件箱 ---------- */
  var busy = false, retryT = null, delay = 2000;
  // 发件箱记下属于哪个账号、哪台服务器：换人或换服务器后不能把旧操作发出去
  function saveBox() { put('tm_outbox', api.outbox.length ? JSON.stringify(api.outbox) : null); if (api.outbox.length) { put('tm_outbox_uid', g(KU)); put('tm_outbox_srv', g('tm_server') || ''); } }
  function opId() { var a = ''; try { var b = new Uint8Array(12); crypto.getRandomValues(b); for (var i = 0; i < b.length; i++) a += ('0' + b[i].toString(16)).slice(-2); } catch (e) { a = Date.now().toString(36) + Math.random().toString(36).slice(2, 12); } return a; }
  function ids(r) { var o = {}; Object.keys(r || {}).forEach(function (k) { if (k !== 'ok' && (typeof r[k] === 'string' || typeof r[k] === 'number')) o[k] = r[k]; }); return o; }
  function swapIds(o, map) { if (typeof o === 'string') return map[o] || o; if (Array.isArray(o)) return o.map(function (x) { return swapIds(x, map); }); if (o && typeof o === 'object') { var r = {}; Object.keys(o).forEach(function (k) { r[k] = swapIds(o[k], map); }); return r; } return o; }
  function remap(a, b) {
    if (!a || !b) return;
    // 后面还在排队的操作如果引用了本地生成的 ID，也换成服务器的 ID
    var map = {}, n = 0; Object.keys(a).forEach(function (k) { if (typeof a[k] === 'string' && typeof b[k] === 'string' && a[k] !== b[k]) { map[a[k]] = b[k]; n++; } });
    if (n) { api.outbox.forEach(function (op) { op.p = swapIds(op.p, map); }); saveBox(); }
    Object.keys(a).forEach(function (k) { if (typeof a[k] === 'string' && typeof b[k] === 'string' && a[k] !== b[k] && location.hash.indexOf(a[k]) >= 0) history.replaceState(null, '', location.hash.split(a[k]).join(b[k])); });
  }
  function flush() {
    if (busy || !api.outbox.length || !api.loggedIn()) return;
    // 发件箱是别人留下的（换了人登录）：不能用当前账号发出去
    var ou = g('tm_outbox_uid'), os = g('tm_outbox_srv'); if ((ou && ou !== g(KU)) || (os != null && os !== (g('tm_server') || ''))) { api.outbox = []; saveBox(); put('tm_outbox_uid', null); put('tm_outbox_srv', null); return; }
    busy = true; setStatus(api.status === 'offline' ? 'offline' : 'syncing');
    var op = api.outbox[0];
    if (!op.id) { op.id = opId(); saveBox(); } // 旧版本留下的操作没有 ID：补上，重发也只执行一次
    req('POST', '/api/act', { name: op.n, payload: op.p, base: api.version, op: op.id }).then(function (res) {
      busy = false; delay = 2000; api.outbox.shift(); saveBox();
      if (!res.ok) toast('这一步没能同步到服务器：' + (res.error || '未知原因'), true);
      remap(op.r, res.r && ids(res.r));
      accept(res.version, res.state);
      setStatus('online'); flush();
    }, function (e) {
      busy = false;
      if (e.status === 401) return expired();
      if (e.status === 403 && e.mustChange) { setStatus('online'); return; } // 先改初始密码，改完再补发
      // 服务器暂时出问题（5xx）、限流（429）、超时（408）：保留，退避重试；其他 4xx 是这条操作本身不对：丢弃并提示
      if (e.status && !(e.status >= 500 || e.status === 429 || e.status === 408)) { api.outbox.shift(); saveBox(); toast('同步出错：' + (e.error || e.status), true); setStatus('online'); return flush(); }
      setStatus('offline'); clearTimeout(retryT); retryT = setTimeout(flush, delay); delay = Math.min(delay * 2, 30000);
    });
  }
  function enqueue(name, p, r) {
    var c; try { c = JSON.parse(JSON.stringify(p || {})); } catch (e) { c = {}; }
    api.outbox.push({ n: name, p: c, r: ids(r), t: Date.now(), id: opId() }); saveBox(); setStatus(api.status); setTimeout(flush, 0);
  }

  /* ---------- 应用服务器数据 ---------- */
  var pending = null, pendT = null, LOCAL_ONLY = ['fileRecent'];
  function editing() {
    var a = document.activeElement;
    if (a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/checkbox|radio|button|submit|file/.test(a.type)) || a.isContentEditable)) return true;
    return !!document.querySelector('#layer .sheet, .ai-panel');
  }
  function keepLocal(st, cur) { LOCAL_ONLY.forEach(function (k) { if (cur && cur[k] !== undefined) st[k] = cur[k]; }); }
  function apply(st) {
    if (!st || !window.__tm) return;
    if (editing()) { pending = st; clearTimeout(pendT); pendT = setTimeout(function () { var x = pending; pending = null; apply(x); }, 1500); return; }
    pending = null;
    var cur = window.__tm.S;
    keepLocal(st, cur);
    if (cur && JSON.stringify(cur) === JSON.stringify(st)) return;
    window.__tm.setState(st);
  }
  function accept(v, st) {
    if (typeof v === 'number') { if (v < api.version) return; /* 迟到的旧数据：不能覆盖新的 */ api.version = v; put('tm_ver', v); }
    if (api.outbox.length || busy) return; // 后面还有本地操作在排队：等最后一个回执再应用
    if (st) apply(st);
  }
  function pull() {
    if (!api.loggedIn() || busy || api.outbox.length) return;
    return req('GET', '/api/state').then(function (res) {
      setStatus('online');
      if (res.mustChange && !api.mustChange) { api.mustChange = true; put('tm_must', '1'); }
      if (res.fileToken && res.fileToken !== g('tm_ft')) put('tm_ft', res.fileToken);
      accept(res.version, res.state);
    }, function (e) { if (e.status === 401) expired(); else setStatus('offline'); });
  }
  function expired() {
    clearBig();
    // 发件箱保留：同一个人重新登录后继续补发（换了人就清掉）
    ['tm_token', 'tm_ft', 'tm_ver', 'tm_must', 'tm_boot', K, KU].forEach(function (k) { put(k, null); });
    toast('登录已过期，请重新登录', true); setTimeout(function () { location.hash = '#/login'; reloadSafe(); }, 800);
  }

  /* ---------- 推送：SSE，失败时轮询 ---------- */
  var es = null, pollT = null;
  function connect() {
    if (!api.loggedIn()) return;
    var poll = function () { if (pollT) return; pollT = setInterval(pull, 8000); }; // 只开一个定时器（以前每次断线都重开，8 秒永远到不了）
    if (!window.EventSource || api.nativeMode) return poll(); // 原生网络模式下浏览器内核连不上服务器：改成定时拉取
    try {
      es = new EventSource(api.base + '/api/events?token=' + encodeURIComponent(api.token));
      es.addEventListener('v', function (e) { var v = 0; try { v = JSON.parse(e.data).version; } catch (x) {} setStatus('online'); clearInterval(pollT); pollT = null; if (v > api.version) pull(); flush(); });
      // 断线时马上拉一次：如果是账号被停用 / 会话失效，会拿到 401 立即回到登录页
      es.onerror = function () { setStatus('offline'); var now = Date.now(); if (!es.lastPull || now - es.lastPull > 5000) { es.lastPull = now; pull(); } poll(); };
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
    put('tm_server', api.sameOrigin ? null : base); put('tm_token', res.token); put('tm_ft', res.fileToken || null); put('tm_ver', res.version);
    if (g('tm_outbox_uid') !== res.uid) { put('tm_outbox', null); put('tm_outbox_uid', null); }
    put('tm_prefill_login', null);
    var j = JSON.stringify(res.state), big = false;
    try { localStorage.setItem(K, j); } catch (e) { big = true; try { localStorage.removeItem(K); } catch (x) {} }
    put('tm_boot', JSON.stringify({ users: res.state.users, settings: res.state.settings, seq: res.state.seq, real: res.state.real }));
    put(KU, res.uid); put('tm_must', res.mustChange ? '1' : null);
    location.hash = '#/home';
    if (big) api.cacheBig(j).then(reloadSafe, reloadSafe); else reloadSafe();
  }
  // 录音 / 视频交给服务器转文字（服务器装了 whisper 时）；返回文字
  api.transcribe = function (blob) {
    if (!api.loggedIn()) return Promise.reject({ error: '没有连接团队服务器' });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; if (ctl) setTimeout(function () { ctl.abort(); }, 15 * 60e3);
    return fetch(api.base + '/api/transcribe', { method: 'POST', signal: ctl && ctl.signal, headers: { Authorization: 'Bearer ' + api.token, 'Content-Type': blob.type || 'application/octet-stream' }, body: blob })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw { error: j.error || '转文字失败' }; return j.text || ''; }); },
        function () { throw { error: '连不上服务器，稍后再试' }; });
  };
  // 诊断信息（语音识别出错等，不含内容）：发给服务器记到 diag.log，失败就算了
  api.diag = function (o) { if (!api.loggedIn()) return; req('POST', '/api/diag', o).catch(function () {}); };
  api.serverUrl = function () { return api.sameOrigin ? location.origin : api.base; };
  api.probe = function (server) { var b = api.sameOrigin ? '' : norm(server); return reqAt(b, 'GET', '/api/health').then(function (r) { return { base: b, setup: r.setup }; }); };
  api.login = function (server, login, password) { var b = api.sameOrigin ? '' : norm(server); return reqAt(b, 'POST', '/api/login', { login: login, password: password }).then(function (res) { establish(b, res); }); };
  api.setup = function (server, o) { var b = api.sameOrigin ? '' : norm(server); return reqAt(b, 'POST', '/api/setup', o).then(function (res) { establish(b, res); }); };
  // 在同一个 Wi-Fi 里自动查找团队服务器：按手机自己的网段（拿不到就试常见网段）逐个问 /api/health，返回找到的地址
  api.scan = function (onProgress) {
    var port = 8787, hits = [];
    var nets = function () { return (typeof TMN !== 'undefined' && TMN.localIps ? TMN.localIps() : Promise.resolve([])).then(function (ips) {
      var own = ips.map(function (ip) { return ip.split('.').slice(0, 3).join('.'); }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      return own.length ? own : ['192.168.1', '192.168.0', '192.168.31', '192.168.2', '192.168.3', '10.0.0', '192.168.10', '192.168.100'];
    }); };
    var probe = function (host) {
      var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 1200);
      return fetch('http://' + host + ':' + port + '/api/health', { signal: ctl && ctl.signal }).then(function (r) { return r.json(); }).then(function (j) { clearTimeout(tm); if (j && j.ok === true && 'setup' in j) hits.push('http://' + host + ':' + port); }, function () { clearTimeout(tm); });
    };
    return nets().then(function (list) {
      var hosts = []; list.forEach(function (n) { for (var i = 1; i < 255; i++) hosts.push(n + '.' + i); });
      var next = 0, done = 0;
      return new Promise(function (ok) {
        var worker = function () { if (hits.length) return ok(); if (next >= hosts.length) { if (done >= hosts.length || !hosts.length) ok(); return; } var h = hosts[next++]; probe(h).then(function () { done++; if (onProgress) onProgress(done, hosts.length); worker(); }); };
        if (!hosts.length) return ok();
        for (var k = 0; k < 64; k++) worker();
        setTimeout(ok, 45000); // 最多找 45 秒
      });
    }).then(function () { return hits.filter(function (x, i, a) { return a.indexOf(x) === i; }); });
  };
  api.useServer = function (server) { clearBig(); if (norm(server) !== g('tm_server')) ['tm_outbox', 'tm_outbox_uid', 'tm_outbox_srv', 'tm_token', 'tm_ft', 'tm_ver'].forEach(function (k) { put(k, null); }); put('tm_server', norm(server) || 'http://'); put(K, null); put(KU, null); location.hash = '#/login'; reloadSafe(); };
  api.useLocal = function () { clearBig(); ['tm_server', 'tm_token', 'tm_ft', 'tm_ver', 'tm_outbox', 'tm_outbox_uid', 'tm_outbox_srv', 'tm_must', 'tm_boot', K, KU].forEach(function (k) { put(k, null); }); location.hash = '#/login'; reloadSafe(); };
  api.logout = function () {
    var done = function () { clearBig(); ['tm_token', 'tm_ft', 'tm_ver', 'tm_outbox', 'tm_outbox_uid', 'tm_outbox_srv', 'tm_must', 'tm_boot', K, KU].forEach(function (k) { put(k, null); }); location.hash = '#/login'; reloadSafe(); };
    var out = function () { req('POST', '/api/logout').then(done, done); };
    // 先注销这台手机的推送（退出后会话就失效了），再退出
    var pt = g('tm_push_token'); if (pt) req('POST', '/api/devices/remove', { token: pt }).then(out, out); else out();
  };
  api.changePassword = function (old, pw) { return req('POST', '/api/password', { old: old, password: pw }).then(function (r) { api.mustChange = false; put('tm_must', null); flush(); pump(); return r; }); };
  api.registerDevice = function (t) { if (api.loggedIn() && t) req('POST', '/api/devices', { token: t, platform: 'ios' }).catch(function () {}); };
  api.deactivate = function (pw) { return req('POST', '/api/account/deactivate', { password: pw }).then(function (r) { clearBig(); ['tm_token', 'tm_ft', 'tm_ver', 'tm_outbox', 'tm_outbox_uid', 'tm_outbox_srv', 'tm_must', 'tm_boot', K, KU].forEach(function (k) { put(k, null); }); return r; }); };
  api.usage = function () { return req('GET', '/api/usage'); };
  api.sessions = function () { return req('GET', '/api/sessions'); };
  api.revokeSession = function (id, all) { return req('POST', '/api/sessions/revoke', all ? { all: true } : { id: id }); };
  api.ops = function (o) { o = o || {}; return req('GET', '/api/ops?before=' + (o.before || '') + '&uid=' + encodeURIComponent(o.uid || '') + (o.fail ? '&fail=1' : '')); };
  api.exportAll = function () { return req('GET', '/api/export'); };
  api.accounts = function () { return req('GET', '/api/accounts'); };
  api.setAccount = function (o) { return req('POST', '/api/accounts', o); };
  api.disable = function (uid, d) { return req('POST', '/api/accounts/disable', { uid: uid, disabled: d }); };
  /* ---------- 附件上传：先存 IndexedDB 排队，上传成功再删；断网、App 被关掉都不会丢 ---------- */
  var IDB = null, upBusy = false, upT = null, upDelay = 3000;
  api.uploading = 0;
  function idb() {
    if (IDB) return IDB;
    IDB = new Promise(function (ok, bad) { try { var r = indexedDB.open('tm_uploads', 1); r.onupgradeneeded = function () { r.result.createObjectStore('q', { keyPath: 'id' }); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { bad(r.error); }; } catch (e) { bad(e); } });
    return IDB;
  }
  function tx(mode, fn) { return idb().then(function (db) { return new Promise(function (ok, bad) { var t = db.transaction('q', mode), st = t.objectStore('q'), r = fn(st); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { bad(t.error); }; }); }); }
  function pump() {
    if (upBusy || !api.loggedIn()) return;
    upBusy = true;
    // 只取一个属于当前登录人的（不把所有大视频一次读进内存；换人登录时，前一个人的文件留着等他回来）
    var who = g(KU);
    Promise.all([tx('readonly', function (st) { return st.count(); }), idb().then(function (db) { return new Promise(function (ok, bad) { var r = db.transaction('q', 'readonly').objectStore('q').openCursor(); r.onsuccess = function () { var c = r.result; if (!c) return ok(null); if (!c.value.uid || c.value.uid === who) return ok(c.value); c.continue(); }; r.onerror = function () { bad(r.error); }; }); })]).then(function (x) {
      api.uploading = x[0] || 0; setStatus(api.status);
      var it = x[1]; if (!it) { upBusy = false; return; }
      return fetch(api.base + '/api/files/' + encodeURIComponent(it.id), { method: 'PUT', headers: { Authorization: 'Bearer ' + api.token, 'Content-Type': it.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(it.name || '') }, body: it.blob })
        .then(function (r) {
          if (r.status === 401) { upBusy = false; return expired(); }
          if (r.status === 403) { upBusy = false; return; } // 还没改初始密码：先留着，改完再传
          // 成功，或服务器明确拒绝（太大、ID 冲突）：从队列移除并提示，避免卡住后面的文件
          if (r.ok || (r.status >= 400 && r.status < 500)) {
            if (!r.ok) r.json().then(function (j) { toast('附件「' + (it.name || '') + '」没能上传：' + (j.error || r.status), true); }, function () {});
            return tx('readwrite', function (st) { return st.delete(it.id); }).then(function () { upBusy = false; upDelay = 3000; pump(); });
          }
          throw new Error('server ' + r.status);
        });
    }).catch(function () { upBusy = false; clearTimeout(upT); upT = setTimeout(pump, upDelay); upDelay = Math.min(upDelay * 2, 60000); });
  }
  api.upload = function (id, blob, name) {
    if (!api.loggedIn() || !id || !blob) return;
    tx('readwrite', function (st) { return st.put({ id: String(id), uid: g(KU), blob: blob, name: name || blob.name || '', type: blob.type || '', at: Date.now() }); }).then(pump, function () {
      // 没有 IndexedDB（极少数环境）：直接上传一次
      fetch(api.base + '/api/files/' + encodeURIComponent(id), { method: 'PUT', headers: { Authorization: 'Bearer ' + api.token, 'Content-Type': blob.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(name || blob.name || '') }, body: blob }).catch(function () {});
    });
  };
  // 网址里只放「只能读附件」的文件令牌，不放会话令牌（链接被转发也拿不到账号）
  api.exportTgzUrl = function () { var ft = g('tm_ft'); return api.loggedIn() && ft ? api.base + '/api/export.tgz?ft=' + encodeURIComponent(ft) : null; };
  api.fileUrl = function (id) { var ft = g('tm_ft'); return api.loggedIn() && id && ft ? api.base + '/api/files/' + encodeURIComponent(id) + '?ft=' + encodeURIComponent(ft) : null; };
  if (api.loggedIn()) { window.addEventListener('load', pump); window.addEventListener('online', function () { upDelay = 3000; pump(); }); }

  /* ---------- 真实 AI（服务器代理）：未启用或出错时由调用方退回规则模拟 ---------- */
  var aiSt = null;
  api.aiStatus = function () { if (!api.loggedIn()) return Promise.resolve({ enabled: false }); return aiSt || (aiSt = req('GET', '/api/ai/status').catch(function () { aiSt = null; return { enabled: false }; })); };
  api.aiImage = function (data, type) { return req('POST', '/api/ai/image', { data: data, type: type }, AI_WAIT); };
  api.aiAsk = function (q, history, focus) { return req('POST', '/api/ai/ask', { q: q, history: history || [], focus: focus || null }, AI_WAIT); };
  // 决策弹窗开着时常规同步会推迟，这里直接应用（用户就是在等这份结果）
  api.aiAdvice = function (id) { return req('POST', '/api/ai/advice', { id: id }, AI_WAIT).then(function (r) { if (!api.outbox.length && !busy && r.version >= api.version && window.__tm) { api.version = r.version; put('tm_ver', r.version); keepLocal(r.state, window.__tm.S); window.__tm.setState(r.state); } return r; }); };
  api.aiProject = function (text) { return req('POST', '/api/ai/project', { text: text }, AI_WAIT); };
  api.aiDoc = function (name, base64) { return req('POST', '/api/ai/doc', { name: name, data: base64 }, 300000); };
  api.aiWrite = function (kind, title, note, due) { return req('POST', '/api/ai/write', { kind: kind, title: title, note: note, due: due }, AI_WAIT); };
  api.aiTodos = function (text) { return req('POST', '/api/ai/todos', { text: text }, AI_WAIT); };
  api.aiKb = function (topic, text) { return req('POST', '/api/ai/kb', { topic: topic, text: text }, AI_WAIT); };
  /* ---------- 大缓存：完整数据超过 localStorage 容量时存 IndexedDB ---------- */
  var CDB = null;
  function cdb() { if (CDB) return CDB; CDB = new Promise(function (ok, bad) { try { var r = indexedDB.open('tm_cache', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { bad(r.error); }; } catch (e) { bad(e); } }); return CDB; }
  function ckv(mode, fn) { return cdb().then(function (db) { return new Promise(function (ok, bad) { var t = db.transaction('kv', mode), st = t.objectStore('kv'), r = fn(st); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { bad(t.error); }; }); }); }
  api.cacheBig = function (json) { put('tm_cache_idb', '1'); return ckv('readwrite', function (st) { return st.put({ uid: g(KU), server: api.serverUrl(), json: json }, 'state'); }).catch(function () {}); };
  function clearBig() { if (g('tm_cache_idb')) { put('tm_cache_idb', null); ckv('readwrite', function (st) { return st.delete('state'); }).catch(function () {}); } }
  // 启动：localStorage 里没有完整缓存、但 IndexedDB 里有（同一个人的）→ 先用它显示（离线也能看），再和服务器同步
  var noFull = (function () { try { var x = JSON.parse(g(K) || 'null'); return !x || !!x.loading; } catch (e) { return true; } })();
  if (api.loggedIn() && noFull && g('tm_cache_idb')) {
    window.addEventListener('load', function () {
      ckv('readonly', function (st) { return st.get('state'); }).then(function (x) {
        if (x && x.json && x.uid === g(KU) && x.server === api.serverUrl() && window.__tm && window.__tm.S && window.__tm.S.loading && !api.outbox.length) { try { window.__tm.setState(JSON.parse(x.json)); } catch (e) {} }
      }).catch(function () {});
    });
  }

  api.flush = flush; api.pull = pull;
  return api;
})();
