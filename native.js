/* 原生桥接层：在 engine.js / app.js 之前加载。浏览器里什么都不做；在 iOS/Android App（Capacitor）里：
   1. 数据双存：localStorage 的 tm_* 同步备份到原生 Preferences，WebView 数据被系统清理后启动时自动恢复
   2. 语音识别：用原生 Speech 插件模拟浏览器 SpeechRecognition 接口（app.js 无需改动）
   3. 剪贴板、深链接（teamops://）、状态栏、键盘、启动屏、返回键 */
var TMN = (function () {
  'use strict';
  var C = window.Capacitor;
  var native = !!(C && C.isNativePlatform && C.isNativePlatform());
  var api = { native: native, platform: native ? C.getPlatform() : 'web' };
  if (!native) return api;
  try {
  document.documentElement.classList.add('native', 'p-' + api.platform);
  // App 里禁止缩放：iOS 遇到字号小于 16px 的输入框会自动放大页面（网页版保留缩放，照顾无障碍）
  (function () { var m = document.querySelector('meta[name=viewport]'); if (m && !/maximum-scale/.test(m.content)) m.content += ', maximum-scale=1, user-scalable=no'; })();
  function plug(n) { try { return C.registerPlugin(n); } catch (e) { return null; } }
  var Prefs = plug('Preferences'), Clip = plug('Clipboard'), App = plug('App'), Bar = plug('StatusBar'), Kb = plug('Keyboard'), Splash = plug('SplashScreen'), Speech = plug('Speech'), Push = plug('PushNotifications'), Hap = plug('Haptics'), Diag = native && C.getPlatform() === 'android' ? plug('Diag') : null;
  if (api.platform === 'android') Push = null; // Android 推送要接 Firebase（google-services.json），暂不启用；服务器端也只接了 APNs
  api.plugins = { PushNotifications: Push, Preferences: Prefs, Clipboard: Clip, App: App, StatusBar: Bar, Keyboard: Kb, SplashScreen: Splash, Speech: Speech };

  /* ---------- 1. 数据双存 ---------- */
  var PFX = 'tm_', MAIN = 'tm_demo_v3', BK = 'tm_backup_keys';
  var ls = window.localStorage, hadData = false;
  try { hadData = !!ls.getItem(MAIN); } catch (e) {}
  var ready = false, dirty = {}, timer = null;
  function flush() {
    timer = null; if (!ready || !Prefs) return Promise.resolve();
    var ks = Object.keys(dirty); dirty = {};
    return Promise.all(ks.map(function (k) {
      var v = null; try { v = ls.getItem(k); } catch (e) {}
      return v == null ? Prefs.remove({ key: k }) : Prefs.set({ key: k, value: v });
    })).then(function () {
      var srv = ls.getItem('tm_server') != null, all = []; try { for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(PFX) === 0 && k !== BK && !(srv && k === MAIN)) all.push(k); } } catch (e) {}
      return Prefs.set({ key: BK, value: JSON.stringify(all) });
    }).catch(function () {});
  }
  // 服务器模式下的完整数据缓存不镜像到原生存储（可能几 MB；服务器才是源头，随时能重新拉取）
  function mark(k) { if (String(k).indexOf(PFX) !== 0) return; if (k === MAIN && ls.getItem('tm_server') != null) return; dirty[k] = 1; if (!timer) timer = setTimeout(flush, 300); }
  var proto = Object.getPrototypeOf(ls), oSet = proto.setItem, oRm = proto.removeItem;
  proto.setItem = function (k, v) { oSet.call(this, k, v); if (this === ls) mark(k); };
  proto.removeItem = function (k) { oRm.call(this, k); if (this === ls) mark(k); };
  api.restored = (Prefs ? Prefs.get({ key: BK }).then(function (r) {
    var keys = []; try { keys = JSON.parse(r && r.value || '[]') || []; } catch (e) {}
    // WebView 的 localStorage 是异步写盘的，App 被强制结束时最近的写入可能丢失（整体或部分，例如只丢了登录令牌）：
    // 备份清单里有、本机却没有的键，从原生备份补回，然后重新加载
    var missing = keys.filter(function (k) { try { return k !== BK && ls.getItem(k) == null && (k !== MAIN || !hadData); } catch (e) { return false; } });
    if (missing.length) {
      return Promise.all(missing.map(function (k) { return Prefs.get({ key: k }).then(function (x) { if (x && x.value != null) { oSet.call(ls, k, x.value); return 1; } return 0; }); }))
        .then(function (got) { if (got.some(Boolean)) { location.reload(); return true; } ready = true; return false; });
    }
    ready = true;
    try { var srv0 = ls.getItem('tm_server') != null; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(PFX) === 0 && !(srv0 && k === MAIN)) dirty[k] = 1; } } catch (e) {}
    return flush().then(function () { return false; });
  }) : Promise.resolve(false)).catch(function () { ready = true; return false; });
  api.flush = flush;

  /* ---------- 2. 语音识别 ---------- */
  // 原生插件给出「本次识别会话到目前为止的全文」；这里按停顿切成句子，模拟 continuous + isFinal 的行为。
  var PAUSE = 1200;
  function NSR() { this.lang = 'zh-CN'; this.continuous = false; this.interimResults = false; this.onresult = this.onend = this.onerror = this.onstart = null; this._on = false; this._subs = []; }
  NSR.prototype._emit = function (txt, fin) {
    if (!txt) return;
    var res = this._res, i = this._cur;
    if (i == null) { i = this._cur = res.length; res.push(null); }
    var item = [{ transcript: txt, confidence: 0.9 }]; item.isFinal = fin; res[i] = item;
    if (fin) this._cur = null;
    if ((fin || this.interimResults) && this.onresult) try { this.onresult({ resultIndex: i, results: res }); } catch (e) { setTimeout(function () { throw e; }); }
  };
  NSR.prototype._commit = function () {
    var full = this._full || '', base = this._base || '';
    var delta = full.indexOf(base) === 0 ? full.slice(base.length) : full.slice(Math.min(base.length, full.length));
    this._base = full; clearTimeout(this._pt);
    delta = delta.replace(/^[\s，。,.]+/, '');
    if (delta) this._emit(delta, true); else this._cur = null;
  };
  var srFails = []; // 熔断：5 秒内失败 5 次就不再碰原生识别器（防止调用方无限重启拖垮 App）
  NSR.prototype.start = function () {
    var self = this; if (self._on) return; self._on = true; self._res = []; self._cur = null; self._full = ''; self._base = '';
    if (!Speech) return self._fail('service-not-allowed');
    var now = Date.now(); srFails = srFails.filter(function (t) { return now - t < 5000; });
    if (srFails.length >= 5) { setTimeout(function () { self._fail('service-not-allowed'); }, 0); return; }
    Speech.requestPermissions().then(function (p) {
      if (!self._on) return;
      if (!p || p.speech !== 'granted' || p.microphone !== 'granted') return self._fail('not-allowed');
      return Promise.all([
        Speech.addListener('partial', function (e) { if (!self._on) return; self._full = e.text || ''; var b = self._base; var d = self._full.indexOf(b) === 0 ? self._full.slice(b.length) : self._full; if (d.trim()) self._emit(d.replace(/^[\s，。,.]+/, ''), false); clearTimeout(self._pt); self._pt = setTimeout(function () { if (self.continuous) self._commit(); else self.stop(); }, PAUSE); }),
        Speech.addListener('end', function () { if (self._on) self._finish(); }),
        Speech.addListener('error', function (e) { if (self._on) self._fail(e && e.error || 'network', e); })
      ]).then(function (subs) {
        self._subs = subs;
        // 没网时用手机本地识别
        return Speech.start({ lang: self.lang || 'zh-CN', onDevice: navigator.onLine === false }).then(function () { if (self.onstart) self.onstart({}); });
      });
    }).catch(function (e) { self._fail(/permission|denied|authori/i.test(String(e && e.message)) ? 'not-allowed' : 'audio-capture'); });
  };
  NSR.prototype._fail = function (code, detail) { var self = this; srFails.push(Date.now()); if (detail && detail.code != null) api.lastSpeechError = detail; if (self.onerror) try { self.onerror({ error: code, detail: detail || null }); } catch (e) {} self._finish(); };
  NSR.prototype._finish = function () {
    if (!this._on) return; this._on = false; clearTimeout(this._pt); this._commit();
    this._subs.forEach(function (s) { try { s.remove(); } catch (e) {} }); this._subs = [];
    if (Speech) Speech.stop().catch(function () {});
    var self = this; setTimeout(function () { if (self.onend) self.onend({}); }, 0);
  };
  NSR.prototype.stop = function () { this._finish(); };
  NSR.prototype.abort = function () { this._finish(); };
  if (Speech) { window.SpeechRecognition = window.webkitSpeechRecognition = NSR; }
  // Android：不少国产手机没有系统语音识别服务。没有时去掉语音转文字（录音照常），页面会提示改用输入法的语音键
  api.noSpeech = false;
  if (Speech && api.platform === 'android') {
    Speech.available().then(function (r) {
      if (r && r.available) return;
      api.noSpeech = true; window.SpeechRecognition = window.webkitSpeechRecognition = undefined;
      window.dispatchEvent(new Event('tm-nospeech'));
    }).catch(function () {});
  }
  api.SpeechRecognition = NSR;

  /* ---------- 3. 剪贴板与深链接 ---------- */
  // App 内地址是 capacitor://localhost/#/idea/x，复制给同事没有意义，换成 teamops://idea/x
  function deep(t) { var m = String(t).match(/^(capacitor|https?):\/\/localhost\/?(?:index\.html)?#\/(.*)$/); return m ? 'teamops://' + m[2] : t; }
  api.deepLink = deep;
  if (Clip) {
    var cb = navigator.clipboard || {};
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: cb }); } catch (e) {}
    cb.writeText = function (t) { return Clip.write({ string: deep(t) }); };
  }
  if (App) {
    App.addListener('appUrlOpen', function (e) {
      var u = String(e && e.url || ''), j = u.match(/^teamops:\/\/join\?(.*)$/);
      if (j) { // 扫老板给的二维码加入：记下服务器地址和账号，登录页自动填好
        var q = {}; j[1].split('&').forEach(function (kv) { var p = kv.split('='); try { q[p[0]] = decodeURIComponent(p[1] || ''); } catch (x) {} });
        // 只接受干净的服务器地址：http/https、没有用户名密码、路径 / 查询 / # 都为空；显示和保存都只用 origin
        var su; try { su = new URL(q.server); } catch (x) { return; }
        if (!/^https?:$/.test(su.protocol) || su.username || su.password || (su.pathname && su.pathname !== '/') || su.search || su.hash) return;
        q.server = su.origin; q.login = /^[A-Za-z0-9_.@-]{3,32}$/.test(q.login || '') ? q.login : ''; q.invite = /^[A-Za-z0-9_-]{16,40}$/.test(q.invite || '') ? q.invite : '';
        if (window.TMS && TMS.loggedIn()) { if (window.__tm && window.__tm.toast) window.__tm.toast('你已经登录了。要换账号，请先在「我的」里退出登录', true); return; }
        // 防钓鱼：别人也能做这种链接，切换服务器前必须让用户确认地址
        var go = function () {
          try { localStorage.setItem('tm_server', q.server); if (q.login) localStorage.setItem('tm_prefill_login', q.login); localStorage.setItem('tm_demo_chosen', '1'); } catch (x) {}
          location.hash = q.invite ? '#/join/' + q.invite : '#/login'; flush().then(function () { location.reload(); }, function () { location.reload(); });
        };
        var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
        // 用 App 自己的确认面板（样式统一）；页面还没准备好时退回系统对话框
        if (window.__tm && window.__tm.ask) window.__tm.ask('连接团队服务器', '要连接到这个团队服务器吗？<br><br><b>' + esc(q.server) + '</b>' + (q.login ? '<br>账号：' + esc(q.login) : '') + '<br><br><span class="muted">只在扫描老板给你的二维码时才确认。如果不认识这个地址，请点取消。</span>', '连接').then(function (y) { if (y) go(); });
        else if (window.confirm('要连接到这个团队服务器吗？\n\n' + q.server + (q.login ? '\n账号：' + q.login : '') + '\n\n只在扫描老板给你的二维码时才确认。如果不认识这个地址，请点取消。')) go();
        return;
      }
      var m = u.match(/^teamops:\/\/(.*)$/); if (m) location.hash = '#/' + m[1];
    });
    App.addListener('pause', function () { flush(); });
    App.addListener('backButton', function () { var t = window.__tm; if (t && t.back && t.back()) return; App.exitApp(); });
  }
  /* ---------- 推送：登录后申请通知权限、登记设备；点通知跳到对应页面 ---------- */
  api.pushInit = function () {
    if (!Push || !window.TMS || !TMS.loggedIn() || api._push) return; api._push = true;
    Push.addListener('registration', function (t) { if (t && t.value) { try { localStorage.setItem('tm_push_token', t.value); } catch (e) {} TMS.registerDevice(t.value); } });
    Push.addListener('pushNotificationActionPerformed', function (a) { var d = a && a.notification && a.notification.data || {}; if (d.link && /^#\//.test(d.link)) location.hash = d.link; });
    Push.addListener('pushNotificationReceived', function () { if (TMS.pull) TMS.pull(); });
    Push.checkPermissions().then(function (p) { return p.receive === 'prompt' ? Push.requestPermissions() : p; })
      .then(function (p) { if (p.receive === 'granted') return Push.register(); }).catch(function () {});
  };
  window.addEventListener('load', function () { setTimeout(api.pushInit, 1500); });
  /* ---------- 打开链接 / 文件（App 里没有新窗口，也不能网页式下载） ----------
     openUrl：http(s) 地址交给系统浏览器（导航到外部地址时 Capacitor 会改用系统浏览器打开）；
     shareFile：把 Blob 写进缓存目录，再弹出系统的「分享 / 用其他应用打开」 */
  var Fs = native ? plug('Filesystem') : null, Shr = native ? plug('Share') : null;
  api.openUrl = function (u) {
    if (!native) { window.open(u, '_blank', 'noopener'); return; }
    if (/^https?:\/\//i.test(u) && !/^https?:\/\/localhost(\/|$)/i.test(u)) { location.href = u; return; }
    window.open(u, '_blank');
  };
  // 页面里所有指向外部网址的链接（包括 target=_blank）都交给系统浏览器
  if (native) document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(h) && !/^https?:\/\/localhost(\/|$)/i.test(h)) { e.preventDefault(); api.openUrl(h); }
  }, true);
  api.canShareFile = !!(Fs && Shr);
  var sharing = false; // 系统分享面板还开着时再点一次：忽略（否则系统报「正在分享」）
  /* 系统通知（App 在后台还没被系统关掉时）：新通知出现在手机通知栏，点一下打开对应页面。Android 没有推送时靠它提醒 */
  // 只在原生壳里真的装了这个插件时才用（老版本安装包没有，调用会报「插件没实现」）
  // iOS 用苹果推送，不再另弹本地通知（避免同一条弹两次）
  var LN = api.platform !== 'android' || (C.isPluginAvailable && !C.isPluginAvailable('LocalNotifications')) ? null : plug('LocalNotifications'), lnAsked = false, lnOk = null, lnSeq = 1;
  if (LN && LN.addListener) try { var lp = LN.addListener('localNotificationActionPerformed', function (e) { var l = e && e.notification && e.notification.extra && e.notification.extra.link; if (l && /^#\//.test(l)) location.hash = l; }); if (lp && lp.catch) lp.catch(function () { LN = null; api.canLocalNotify = false; }); } catch (e) { LN = null; }
  api.canLocalNotify = !!LN;
  api.localNotify = function (list) {
    if (!LN || !list || !list.length) return Promise.resolve();
    var go = function () { if (!lnOk) return; var xs = list.length > 3 ? [{ title: list.length + ' 条新通知', body: list.slice(0, 3).map(function (n) { return n.title; }).join('、'), link: '#/inbox' }] : list;
      return LN.schedule({ notifications: xs.map(function (n) { return { id: (Date.now() % 100000) * 10 + (lnSeq++ % 10), title: String(n.title || '团队协同').slice(0, 60), body: String(n.body || '').slice(0, 120), extra: { link: n.link || '#/inbox' } }; }) }).catch(function () {}); };
    if (lnOk != null) return Promise.resolve(go());
    if (lnAsked) return Promise.resolve(); lnAsked = true;
    return LN.checkPermissions().then(function (p) { if (p.display === 'granted') return p; return LN.requestPermissions(); }).then(function (p) { lnOk = p && p.display === 'granted'; return go(); }, function () { lnOk = false; });
  };
  api.shareFile = function (blob, name) {
    if (!Fs || !Shr) return Promise.reject(new Error('unsupported'));
    if (sharing) return Promise.resolve(); sharing = true; var done = function (v) { sharing = false; return v; }, fail = function (e) { sharing = false; throw e; };
    var safe = String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
    return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1] || ''); }; r.onerror = no; r.readAsDataURL(blob); })
      .then(function (b64) { return Fs.writeFile({ path: safe, data: b64, directory: 'CACHE' }); })
      .then(function (w) { return Shr.share({ title: safe, files: [w.uri] }); })
      .catch(function (e) { if (/cancel|in progress/i.test(String(e && e.message))) return; throw e; }).then(done, fail);
  };
  // 安装的 App 版本（versionName / versionCode），用于检查更新
  api.appInfo = function () { return App && App.getInfo ? App.getInfo().catch(function () { return null; }) : Promise.resolve(null); };
  // 手机当前的局域网 IP（安卓原生给；其他平台返回空，由调用方按常见网段查找）
  api.localIps = function () { return Diag && Diag.netInfo ? Diag.netInfo().then(function (r) { return r && r.ips || []; }, function () { return []; }) : Promise.resolve([]); };
  // 连不上服务器时的诊断（安卓）：① Android 16+ 先申请「本地网络」权限（没给权限时系统会悄悄拦住连同一 Wi-Fi 的设备）；
  // ② 用系统原生网络直接访问服务器，判断是网络不通，还是只有 App 里的浏览器内核被拦住。返回 {granted: 刚给了权限, nativeOk, ...}
  api.netDiag = function (base) {
    if (!Diag || !Diag.netState) return Promise.resolve(null);
    var out = {};
    return Diag.netState().then(function (st) {
      out.sdk = st.sdk; out.device = st.device; out.localnet = st.localnet; out.nearby = st.nearby;
      // 只申请一次：有的系统不认识 ACCESS_LOCAL_NETWORK，状态一直是 prompt，反复申请会一直弹 / 一直重试
      if (st.sdk >= 36 && st.localnet !== 'granted' && st.nearby !== 'granted' && !api._lnAsked) {
        api._lnAsked = true;
        var want = ['localnet', 'nearby'];
        return Diag.requestPermissions({ permissions: want }).then(function (r) { out.granted = r && (r.localnet === 'granted' || r.nearby === 'granted'); out.localnet = r && r.localnet; }, function () {});
      }
    }).then(function () { return Diag.httpGet({ url: base + '/api/health' }); }).then(function (h) {
      out.nativeOk = !!(h && h.ok && /"ok":true/.test(h.body || '')); out.nativeErr = h && h.error; return out;
    }, function (e) { out.nativeErr = String(e && e.message || e); return out; });
  };
  // 原生网络发请求（浏览器内核被拦住、但系统网络能通时用）：Capacitor 自带的 CapacitorHttp
  var CHttp = native ? plug('CapacitorHttp') : null;
  api.nativeRequest = function (method, url, headers, body) {
    if (!CHttp) return Promise.reject(new Error('unsupported'));
    return CHttp.request({ method: method, url: url, headers: headers || {}, data: body, connectTimeout: 15000, readTimeout: 120000 }).then(function (r) { return { status: r.status, data: r.data }; });
  };
  /* ---------- 诊断：上次闪退的原因（Android），由 app.js 启动后提示 ---------- */
  api.lastCrash = function () { return Diag ? Diag.lastCrash().then(function (r) { return r && r.text || ''; }, function () { return ''; }) : Promise.resolve(''); };
  api.plugins.Diag = Diag;
  /* ---------- 触感反馈：操作成功轻震，出错提示性震动 ---------- */
  api.haptic = function (kind) { if (!Hap) return; try { (kind === 'error' ? Hap.notification({ type: 'ERROR' }) : kind === 'warning' ? Hap.notification({ type: 'WARNING' }) : Hap.impact({ style: 'LIGHT' })).catch(function () {}); } catch (e) {} };
  /* ---------- 4. 外观 ---------- */
  if (Bar) Bar.setStyle({ style: 'LIGHT' }).catch(function () {});
  if (Kb && api.platform === 'ios') Kb.setAccessoryBarVisible({ isVisible: true }).catch(function () {}); // 只有 iOS 有键盘工具条
  // 关启动屏：页面加载很快时，第一次调用可能早于系统准备好启动屏（Android 11 及以下实测会被忽略，屏幕一直黑着），所以隔一会儿再补两次
  window.addEventListener('load', function () { [60, 700, 1800].forEach(function (t) { setTimeout(function () { if (Splash) Splash.hide({ fadeOutDuration: 200 }).catch(function () {}); }, t); }); });
  } catch (e) {
    // 桥接层出错不能挡住 App：记录错误，至少把启动屏关掉
    api.error = String(e && e.message || e);
    try { console.error('TMN', e); C.registerPlugin('SplashScreen').hide(); } catch (x) {}
  }
  return api;
})();
