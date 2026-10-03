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
  var Prefs = plug('Preferences'), Clip = plug('Clipboard'), App = plug('App'), Bar = plug('StatusBar'), Kb = plug('Keyboard'), Splash = plug('SplashScreen'), Speech = plug('Speech'), Push = plug('PushNotifications');
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
  NSR.prototype.start = function () {
    var self = this; if (self._on) return; self._on = true; self._res = []; self._cur = null; self._full = ''; self._base = '';
    if (!Speech) return self._fail('service-not-allowed');
    Speech.requestPermissions().then(function (p) {
      if (!self._on) return;
      if (!p || p.speech !== 'granted' || p.microphone !== 'granted') return self._fail('not-allowed');
      return Promise.all([
        Speech.addListener('partial', function (e) { if (!self._on) return; self._full = e.text || ''; var b = self._base; var d = self._full.indexOf(b) === 0 ? self._full.slice(b.length) : self._full; if (d.trim()) self._emit(d.replace(/^[\s，。,.]+/, ''), false); clearTimeout(self._pt); self._pt = setTimeout(function () { if (self.continuous) self._commit(); else self.stop(); }, PAUSE); }),
        Speech.addListener('end', function () { if (self._on) self._finish(); }),
        Speech.addListener('error', function (e) { if (self._on) self._fail(e && e.error || 'network'); })
      ]).then(function (subs) {
        self._subs = subs;
        return Speech.start({ lang: self.lang || 'zh-CN' }).then(function () { if (self.onstart) self.onstart({}); });
      });
    }).catch(function (e) { self._fail(/permission|denied|authori/i.test(String(e && e.message)) ? 'not-allowed' : 'audio-capture'); });
  };
  NSR.prototype._fail = function (code) { var self = this; if (self.onerror) try { self.onerror({ error: code }); } catch (e) {} self._finish(); };
  NSR.prototype._finish = function () {
    if (!this._on) return; this._on = false; clearTimeout(this._pt); this._commit();
    this._subs.forEach(function (s) { try { s.remove(); } catch (e) {} }); this._subs = [];
    if (Speech) Speech.stop().catch(function () {});
    var self = this; setTimeout(function () { if (self.onend) self.onend({}); }, 0);
  };
  NSR.prototype.stop = function () { this._finish(); };
  NSR.prototype.abort = function () { this._finish(); };
  if (Speech) { window.SpeechRecognition = window.webkitSpeechRecognition = NSR; }
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
    App.addListener('appUrlOpen', function (e) { var m = String(e && e.url || '').match(/^teamops:\/\/(.*)$/); if (m) location.hash = '#/' + m[1]; });
    App.addListener('pause', function () { flush(); });
    App.addListener('backButton', function (e) { if (location.hash && location.hash !== '#/home' && e && e.canGoBack) history.back(); else App.exitApp(); });
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
  /* ---------- 4. 外观 ---------- */
  if (Bar) Bar.setStyle({ style: 'LIGHT' }).catch(function () {});
  if (Kb) Kb.setAccessoryBarVisible({ isVisible: true }).catch(function () {});
  window.addEventListener('load', function () { setTimeout(function () { if (Splash) Splash.hide({ fadeOutDuration: 200 }).catch(function () {}); }, 60); });
  } catch (e) {
    // 桥接层出错不能挡住 App：记录错误，至少把启动屏关掉
    api.error = String(e && e.message || e);
    try { console.error('TMN', e); C.registerPlugin('SplashScreen').hide(); } catch (x) {}
  }
  return api;
})();
