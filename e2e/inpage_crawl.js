/* 在 App 页面里运行的界面爬虫（由 e2e/device_ios.js 通过调试版的 TM_SCRIPT 注入；也可用于其他 WebView）。
   每个角色 × 每个页面 × 每个可点的按钮：恢复演示数据 → 打开页面 → 点按钮 → 再点弹出面板里的按钮 → 记录报错。
   结果逐条 POST 回加载本脚本的地址（/r），结束时 POST /done。不刷新页面，所以很快。 */
(async function () {
  var base = (document.currentScript && document.currentScript.src || '').replace(/\/[^/]*$/, '');
  var post = function (path, o) { return fetch(base + path, { method: 'POST', body: JSON.stringify(o) }).catch(function () {}); };
  var errs = [];
  window.addEventListener('error', function (e) { errs.push(String(e.message || e) + (e.filename ? ' @' + String(e.filename).slice(-30) + ':' + e.lineno : '') + (e.error && e.error.stack ? ' ' + String(e.error.stack).split('\n').slice(0, 3).join(' < ') : '')); });
  window.addEventListener('unhandledrejection', function (e) { errs.push('promise: ' + str(e.reason)); });
  var str = function (x) { if (x && typeof x === 'object') { if (x.message) return (x.name ? x.name + ': ' : '') + x.message; try { return JSON.stringify(x); } catch (e) { return String(x); } } return String(x); };
  var ce = console.error; console.error = function () { errs.push('console: ' + [].map.call(arguments, str).join(' ')); return ce.apply(console, arguments); };
  // 系统对话框、文件选择器会挡住自动操作：替换掉
  window.confirm = function () { return false; }; window.alert = function () {}; window.prompt = function () { return null; };
  var ic = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') return; return ic.call(this); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  for (var w = 0; w < 100 && !(window.__tm && window.__tm.S && window.__tm.S.users); w++) await sleep(200);
  if (!window.__tm) return post('/done', { error: '页面没有加载' });
  localStorage.setItem('tm_demo_chosen', '1');
  // 脚本地址可带 ?roles=陈立,何静 只测部分角色
  var qs = (document.currentScript && document.currentScript.src.split('?')[1] || '').match(/roles=([^&]*)/);
  var ROLES = qs ? decodeURIComponent(qs[1]).split(',') : ['Enos', '林晓', '陈立', '何静', '孙磊'];
  var ROUTES = ['home', 'ideas', 'tasks', 'work', 'me', 'team', 'inbox', 'kb', 'settings', 'work/W1', 'work/W2', 'idea/I2', 'idea/I4', 'task/T1', 'task/T3', 'stat/decide', 'stat/due', 'stat/rate', 'stat/notif', 'new', 'new/voice', 'new/video', 'new/text', 'new/file', 'project', 'project/ai', 'todo/new', 'todo/new/ai', 'assign/W1', 'kb/voice'];
  var SKIP = /^(switch|reset|clearDemo|demoStart|srvLogout|srvLocal|srvConnect|login|demoChoose|demoExit|meDelete)$/;
  var snap = JSON.stringify(window.__tm.S);
  var vis = function (sel, root) { return Array.prototype.filter.call((root || document).querySelectorAll(sel), function (x) { var q = x.getBoundingClientRect(); return q.width && q.height; }); };
  var open = async function (uid, r) {
    if (location.hash !== '#/home') { location.hash = '#/home'; await sleep(120); }
    window.__tm.setState(JSON.parse(snap)); window.__tm.as(uid);
    location.hash = '#/' + r; await sleep(260);
    return location.hash === '#/' + r || (r === 'home' && location.hash === '#/home');
  };
  var total = 0, bad = 0;
  for (var a = 0; a < ROLES.length; a++) {
    var u = window.__tm.S.users.find(function (x) { return x.name === ROLES[a]; }); if (!u) continue;
    for (var k = 0; k < ROUTES.length; k++) {
      var r = ROUTES[k];
      if (!(await open(u.id, r))) continue;
      var n = vis('[data-do]').length;
      for (var i = 0; i < n; i++) {
        if (!(await open(u.id, r))) break;
        var el = vis('[data-do]')[i]; if (!el) break;
        var d = el.dataset.do; if (SKIP.test(d)) continue;
        errs = [];
        try { el.click(); } catch (e) { errs.push('click: ' + e.message); }
        await sleep(320);
        var inner = vis('#layer [data-do]').map(function (x) { return x.dataset.do; }).filter(function (x) { return x !== 'closeSheet' && !SKIP.test(x); }).slice(0, 3);
        for (var j = 0; j < inner.length; j++) { var b = document.querySelector('#layer [data-do="' + inner[j] + '"]'); if (b) { try { b.click(); } catch (e) { errs.push('click: ' + e.message); } await sleep(150); } }
        total++;
        if (errs.length) { bad++; await post('/r', { ok: false, who: ROLES[a], r: r, d: d, errs: errs.slice(0, 4) }); }
        else if (total % 20 === 0) await post('/r', { ok: true, n: total, who: ROLES[a], r: r });
      }
    }
    await post('/r', { ok: true, role: ROLES[a], n: total });
  }
  window.__tm.setState(JSON.parse(snap)); location.hash = '#/home';
  post('/done', { total: total, bad: bad });
})();
